// Edge Function: conversación por voz con un tutor de inglés (Gemini).
// Recibe { audio: <base64>, mimeType, history: [{ role, text }] }, transcribe lo que
// dijo el estudiante y devuelve { userText, reply }. La llave vive solo en el servidor.
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';
import {
  hasSufficientEvidence,
  calculateProgressPercent,
  creditedPracticeSeconds,
  isValidPracticeWindow,
  nextLevel,
  qualifiesForPromotion,
  SKILLS,
  validRule,
} from './progression.mjs';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
const GEMINI_MODELS = [
  Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
];

const MAX_AUDIO_BASE64_LENGTH = 10_000_000;
const MAX_HISTORY = 12;
const MAX_DAILY_QUESTIONS = 5;
const ASSESSMENT_TURNS = 5;
// Cambiar a true para reactivar el límite diario al terminar las pruebas.
const ENFORCE_DAILY_QUESTION_LIMIT = true;
type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
type Skill = (typeof SKILLS)[number];

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1 });

// RLS activo y sin políticas: solo esta función (conexión directa) puede leer o escribir.
const ready = sql`
  create table if not exists public.question_usage (
    user_id uuid primary key,
    window_start timestamptz not null default now(),
    count int not null default 0
  )
`.then(() => sql`alter table public.question_usage enable row level security`);

// Identifica al usuario con su token; no se confía en nada que mande el cliente.
const getUserId = async (req: Request): Promise<string | null> => {
  const auth = req.headers.get('authorization');
  if (!auth) return null;
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null);
  return typeof user?.id === 'string' ? user.id : null;
};

const getUsed = async (userId: string) => {
  const rows = await sql`
    select count from public.question_usage
    where user_id = ${userId} and window_start > now() - interval '24 hours'
  `;
  return rows[0]?.count ?? 0;
};

// Reserva una pregunta de forma atómica; devuelve null si ya se alcanzó el límite.
const reserve = async (userId: string): Promise<number | null> => {
  if (!ENFORCE_DAILY_QUESTION_LIMIT) {
    const rows = await sql`
      insert into public.question_usage (user_id, window_start, count)
      values (${userId}, now(), 0)
      on conflict (user_id) do update set
        window_start = now(),
        count = 0
      returning count
    `;
    return rows[0]?.count ?? null;
  }

  const rows = await sql`
    insert into public.question_usage (user_id, window_start, count)
    values (${userId}, now(), 1)
    on conflict (user_id) do update set
      window_start = case when public.question_usage.window_start <= now() - interval '24 hours'
        then now() else public.question_usage.window_start end,
      count = case when public.question_usage.window_start <= now() - interval '24 hours'
        then 1 else public.question_usage.count + 1 end
    where public.question_usage.window_start <= now() - interval '24 hours'
      or public.question_usage.count < ${MAX_DAILY_QUESTIONS}
    returning count
  `;
  return rows[0]?.count ?? null;
};

const refund = (userId: string) =>
  sql`
    update public.question_usage set count = greatest(count - 1, 0) where user_id = ${userId}
  `.catch((error) => console.error('refund failed', error));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const SYSTEM_PROMPT = `Eres "Alex", un tutor de inglés amable y conversador que habla con un estudiante hispanohablante. Mantén una conversación natural e interactiva, como una llamada.

Reglas:
- Responde en inglés con frases cortas (1 a 3 oraciones) y vocabulario adecuado al estudiante.
- Reacciona a lo que dijo el estudiante y termina con UNA pregunta de seguimiento, salvo en el turno final de evaluación.
- Si pide ayuda en español, ayúdalo brevemente y vuelve al inglés.
- No uses emojis, listas ni formato: tu respuesta se leerá en voz alta.

Primero transcribe literalmente lo que dice el estudiante en "userText". Si el audio está en silencio, solo tiene ruido o no se entiende, deja "userText" vacío y "heard": false.

Devuelve únicamente JSON con userText, heard y reply.`;

const responseSchema = {
  type: 'OBJECT',
  properties: {
    userText: { type: 'STRING' },
    heard: { type: 'BOOLEAN' },
    reply: { type: 'STRING' },
  },
  required: ['userText', 'heard', 'reply'],
};

const assessmentSchema = {
  type: 'OBJECT',
  properties: {
    estimatedLevel: { type: 'STRING', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
    recommendation: { type: 'STRING', enum: ['promote', 'continue'] },
    assessedSkills: { type: 'ARRAY', items: { type: 'STRING', enum: ['conversation', 'comprehension', 'response', 'pronunciation', 'grammar'] } },
    scores: {
      type: 'OBJECT',
      properties: {
        conversation: { type: 'INTEGER' },
        pronunciation: { type: 'INTEGER' },
        grammar: { type: 'INTEGER' },
        comprehension: { type: 'INTEGER' },
        response: { type: 'INTEGER' },
      },
    },
    skillEvidence: {
      type: 'OBJECT',
      properties: {
        conversation: { type: 'STRING' },
        comprehension: { type: 'STRING' },
        response: { type: 'STRING' },
        pronunciation: { type: 'STRING' },
        grammar: { type: 'STRING' },
      },
    },
    weaknesses: { type: 'ARRAY', items: { type: 'STRING' } },
    evidenceSummary: { type: 'STRING' },
    tip: { type: 'STRING' },
  },
  required: ['estimatedLevel', 'recommendation', 'assessedSkills', 'scores', 'skillEvidence', 'weaknesses', 'evidenceSummary', 'tip'],
};

const finalResponseSchema = {
  ...responseSchema,
  properties: { ...responseSchema.properties, assessment: assessmentSchema },
  required: [...responseSchema.required, 'assessment'],
};

type Turn = { role: 'user' | 'ia'; text: string };

const isLevel = (value: unknown): value is Level =>
  ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].some((level) => level === value);

const validateScore = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error('Invalid assessment score');
  }
  return value;
};

const getCurrentLevel = async (userId: string): Promise<Level | null> => {
  const profiles = await sql`
    select current_level from public.progression_profiles
    where user_id = ${userId}
  `;
  const currentLevel = profiles[0]?.current_level;
  if (isLevel(currentLevel)) return currentLevel;

  const baselines = await sql`
    select estimated_level
    from public.progress_assessments
    where user_id = ${userId} and assessment_type = 'initial'
    order by created_at desc
    limit 1
  `;
  const baselineLevel = baselines[0]?.estimated_level;
  if (!isLevel(baselineLevel)) return null;

  const restored = await sql`
    update public.progression_profiles
    set current_level = ${baselineLevel}, updated_at = now()
    where user_id = ${userId} and current_level is null
    returning current_level
  `;
  if (isLevel(restored[0]?.current_level)) return restored[0].current_level;

  const concurrentUpdate = await sql`
    select current_level from public.progression_profiles
    where user_id = ${userId}
  `;
  return isLevel(concurrentUpdate[0]?.current_level)
    ? concurrentUpdate[0].current_level
    : null;
};

const getProgressSnapshot = async (userId: string) => {
  const profiles = await sql`
    select current_level, total_practice_seconds
    from public.progression_profiles
    where user_id = ${userId}
  `;
  const profile = profiles[0];
  if (!profile) throw new Error('No se encontró el perfil de progresión.');

  const level = await getCurrentLevel(userId);
  const totalSeconds = Number(profile.total_practice_seconds);
  const rules = level
    ? await sql`
        select from_level, to_level, min_hours, target_hours, max_hours, criteria
        from public.progression_rules
        where from_level = ${level}
      `
    : [];
  const rule = rules[0] ?? null;
  if (level && level !== 'C2' && !validRule(rule, level)) {
    throw new Error(`No existe una regla válida para ${level}.`);
  }
  const transitionSeconds = level
    ? await sql`
        select coalesce(sum(duration_seconds), 0)::bigint as seconds
        from public.practice_sessions
        where user_id = ${userId}
          and from_level = ${level}
          and status = 'completed'
      `
    : [];
  const seconds = Number(transitionSeconds[0]?.seconds ?? 0);
  const recentAssessments = level
    ? await sql`
        select id, assessment_type, estimated_level, recommendation, scores,
               weaknesses, evidence_summary, tip, from_level, to_level, created_at
        from public.progress_assessments
        where user_id = ${userId}
          and assessment_type = 'progression'
          and from_level = ${level}
        order by created_at desc
        limit 1
      `
    : [];
  const latestAssessment = recentAssessments[0] ?? (level
    ? (await sql`
        select id, assessment_type, estimated_level, recommendation, scores,
               weaknesses, evidence_summary, tip, from_level, to_level, created_at
        from public.progress_assessments
        where user_id = ${userId} and assessment_type = 'initial'
        order by created_at desc
        limit 1
      `)[0] ?? null
    : null);
  const promotions = await sql`
    select from_level, to_level, promoted_at
    from public.level_promotions
    where user_id = ${userId}
    order by promoted_at desc
    limit 1
  `;

  return {
    currentLevel: level,
    nextLevel: rule?.to_level ?? null,
    totalPracticeSeconds: Number.isSafeInteger(totalSeconds) && totalSeconds >= 0 ? totalSeconds : 0,
    transitionPracticeSeconds: Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : 0,
    progressPercent:
      rule && Number.isFinite(seconds) && seconds >= 0
        ? calculateProgressPercent(seconds, rule.target_hours)
        : null,
    rule: rule
      ? {
          minHours: rule.min_hours,
          targetHours: rule.target_hours,
          maxHours: rule.max_hours,
          criteria: rule.criteria,
        }
      : null,
    latestAssessment,
    latestPromotion: promotions[0] ?? null,
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  let audio: string | undefined;
  let mimeType: string | undefined;
  let history: Turn[] = [];
  let scenario: string | undefined;
  let action: string | undefined;
  let currentLevel: string | undefined;
  let mode: string | undefined;
  let practiceSessionId: string | undefined;
  let assessmentSessionId: string | undefined;
  let requestId: string | undefined;
  let origin: string | undefined;
  try {
    ({
      audio,
      mimeType,
      history = [],
      scenario,
      action,
      mode,
      practiceSessionId,
      assessmentSessionId,
      requestId,
      origin,
    } = await req.json());
  } catch {
    return json({ error: 'Solicitud inválida.' }, 400);
  }

  const userId = await getUserId(req);
  if (!userId) return json({ error: 'Vuelve a iniciar sesión para usar la IA.' }, 401);

  try {
    await ready;
    if (action === 'progress') {
      return json(await getProgressSnapshot(userId));
    }
    if (action === 'start-practice-session') {
      if (!['weakness', 'simulation', 'conversation'].includes(origin ?? '')) {
        return json({ error: 'El origen de práctica no es válido.' }, 400);
      }
      const currentLevel = await getCurrentLevel(userId);
      if (!currentLevel) {
        return json({ error: 'Completa la evaluación inicial antes de practicar.' }, 409);
      }
      await sql`
        update public.practice_sessions
        set status = 'expired'
        where user_id = ${userId}
          and status in ('started', 'processing')
          and started_at < now() - interval '2 minutes'
      `;
      let rows: Record<string, unknown>[];
      try {
        rows = await sql`
          insert into public.practice_sessions (user_id, from_level, origin)
          select ${userId}, ${currentLevel}, ${origin}
          from public.progression_profiles
          where user_id = ${userId} and current_level = ${currentLevel}
          returning id, from_level, started_at
        `;
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          return json({ error: 'Ya hay una sesión de práctica abierta. Termínala antes de iniciar otra.' }, 409);
        }
        throw error;
      }
      if (!rows[0]) return json({ error: 'Completa la evaluación inicial antes de practicar.' }, 409);
      return json({
        practiceSessionId: rows[0].id,
        currentLevel: rows[0].from_level,
        startedAt: rows[0].started_at,
      });
    }
    if (action === 'cancel-practice-session') {
      if (typeof practiceSessionId !== 'string') {
        return json({ error: 'Falta el identificador de la sesión.' }, 400);
      }
      await sql`
        update public.practice_sessions
        set status = 'cancelled'
        where id = ${practiceSessionId}
          and user_id = ${userId}
          and status = 'started'
      `;
      return json({ cancelled: true });
    }
    if (action === 'start-assessment-session') {
      const fromLevel = await getCurrentLevel(userId);
      if (!isLevel(fromLevel)) {
        return json({ error: 'Completa la evaluación inicial antes de evaluar tu progreso.' }, 409);
      }
      const toLevel = nextLevel(fromLevel);
      if (!toLevel) return json({ error: 'Ya alcanzaste el nivel máximo C2.' }, 409);
      const rules = await sql`
        select from_level, to_level, min_hours, target_hours, max_hours, criteria
        from public.progression_rules where from_level = ${fromLevel}
      `;
      const rule = rules[0];
      if (!validRule(rule, fromLevel)) {
        throw new Error(`No existe una regla válida para ${fromLevel} → ${toLevel}.`);
      }
      const progress = await getProgressSnapshot(userId);
      await sql`
        update public.progress_assessment_sessions
        set status = 'cancelled'
        where user_id = ${userId}
          and status in ('active', 'processing')
      `;
      let rows: Record<string, unknown>[];
      try {
        rows = await sql`
          insert into public.progress_assessment_sessions (user_id, from_level, to_level)
          values (${userId}, ${fromLevel}, ${toLevel})
          returning id
        `;
      } catch (error) {
        if ((error as { code?: string }).code === '23505') {
          return json({ error: 'Ya hay una evaluación activa para tu cuenta.' }, 409);
        }
        throw error;
      }
      return json({
        assessmentSessionId: rows[0].id,
        currentLevel: fromLevel,
        targetLevel: toLevel,
        transitionPracticeSeconds: progress.transitionPracticeSeconds,
        targetHours: rule.target_hours,
      });
    }
    if (action === 'usage') {
      return json({ used: await getUsed(userId), max: MAX_DAILY_QUESTIONS });
    }
  } catch (error) {
    console.error('progression action failed', error);
    return json({ error: 'No se pudo completar la acción de progreso.' }, 500);
  }

  if (!GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY no está configurada en Supabase.' }, 500);
  }

  const practiceMode = mode === 'practice';
  if (mode !== undefined && mode !== 'practice' && mode !== 'assessment') {
    return json({ error: 'Modo de conversación inválido.' }, 400);
  }
  if (practiceMode && typeof practiceSessionId !== 'string') {
    return json({ error: 'Inicia una sesión de práctica antes de enviar tu voz.' }, 400);
  }
  if (!practiceMode && typeof assessmentSessionId !== 'string') {
    return json({ error: 'Inicia una sesión de evaluación antes de enviar tu voz.' }, 400);
  }
  if (!practiceMode && typeof requestId !== 'string') {
    return json({ error: 'Falta el identificador del turno de evaluación.' }, 400);
  }

  if (practiceMode) {
    const practiceSessions = await sql`
      select from_level
      from public.practice_sessions
      where id = ${practiceSessionId}
        and user_id = ${userId}
        and status = 'started'
    `;
    currentLevel = practiceSessions[0]?.from_level;
  } else {
    const assessmentSessions = await sql`
      select from_level
      from public.progress_assessment_sessions
      where id = ${assessmentSessionId}
        and user_id = ${userId}
        and status = 'active'
    `;
    currentLevel = assessmentSessions[0]?.from_level;
  }
  if (!isLevel(currentLevel)) {
    return json(
      {
        error: practiceMode
          ? 'No se pudo validar el nivel de esta sesión de práctica. Inicia una conversación nueva.'
          : 'No se pudo validar esta evaluación de progreso. Inicia una evaluación nueva desde Progreso.',
      },
      409
    );
  }
  const targetLevel = nextLevel(currentLevel);
  if (!practiceMode && !targetLevel) {
    return json({ error: 'Ya alcanzaste el nivel C2.' }, 409);
  }
  const rules = targetLevel
    ? await sql`
        select from_level, to_level, min_hours, target_hours, max_hours, criteria
        from public.progression_rules where from_level = ${currentLevel}
      `
    : [];
  const rule = rules[0];
  if (!practiceMode && !validRule(rule, currentLevel)) {
    return json({ error: 'No hay criterios de progresión configurados para tu nivel.' }, 500);
  }

  if (!audio || typeof audio !== 'string' || !mimeType?.startsWith('audio/')) {
    return json({ error: 'Falta el audio.' }, 400);
  }
  if (audio.length > MAX_AUDIO_BASE64_LENGTH) {
    return json({ error: 'La grabación es demasiado grande.' }, 413);
  }

  let audioFingerprint: string | undefined;
  if (practiceMode) {
    try {
      const bytes = Uint8Array.from(atob(audio), (character) => character.charCodeAt(0));
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
      audioFingerprint = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
    } catch {
      return json({ error: 'El formato de audio no es válido.' }, 400);
    }
    const duplicates = await sql`
      select id from public.practice_sessions
      where user_id = ${userId} and audio_fingerprint = ${audioFingerprint}
      limit 1
    `;
    if (duplicates.length) {
      return json({ error: 'Esta grabación ya se usó en una sesión de práctica.' }, 409);
    }
  }

  if (
    !practiceMode &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId ?? '')
  ) {
    return json({ error: 'El identificador del turno de evaluación no es válido.' }, 400);
  }

  let validPracticeSeconds = 0;
  let practiceElapsedSeconds = 0;
  if (practiceMode) {
    let sessions: Record<string, unknown>[];
    try {
      sessions = await sql`
        update public.practice_sessions
        set status = 'processing',
            received_at = clock_timestamp(),
            audio_fingerprint = ${audioFingerprint}
        where id = ${practiceSessionId}
          and user_id = ${userId}
          and from_level = ${currentLevel}
          and status = 'started'
        returning started_at,
          extract(epoch from (received_at - started_at))::double precision as elapsed_seconds
      `;
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        return json({ error: 'Esta grabación ya se usó en otra sesión.' }, 409);
      }
      console.error('practice session reservation failed', error);
      return json({ error: 'No se pudo iniciar la sesión de práctica.' }, 500);
    }
    if (!sessions[0]) {
      return json({ error: 'La sesión de práctica no existe, ya se utilizó o cambió tu nivel.' }, 409);
    }
    const elapsedSeconds = Number(sessions[0].elapsed_seconds);
    if (!isValidPracticeWindow(elapsedSeconds)) {
      await sql`
        update public.practice_sessions set status = 'cancelled'
        where id = ${practiceSessionId} and user_id = ${userId} and status = 'processing'
      `;
      return json({ error: 'La grabación quedó fuera del tiempo permitido; inicia otra sesión.' }, 422);
    }
    practiceElapsedSeconds = elapsedSeconds;
  }

  let assessmentTurns: Turn[] = [];
  if (!practiceMode) {
    const sessions = await sql`
      update public.progress_assessment_sessions
      set status = 'processing', processing_request_id = ${requestId}
      where id = ${assessmentSessionId}
        and user_id = ${userId}
        and from_level = ${currentLevel}
        and to_level = ${targetLevel}
        and status = 'active'
      returning turns
    `;
    if (!sessions[0] || !Array.isArray(sessions[0].turns)) {
      return json({ error: 'La evaluación no existe, ya fue enviada o tu nivel cambió.' }, 409);
    }
    assessmentTurns = sessions[0].turns;
    const previousAnswers = assessmentTurns.filter((turn) => turn?.role === 'user').length;
    if (previousAnswers >= ASSESSMENT_TURNS) {
      await sql`
        update public.progress_assessment_sessions
        set status = 'cancelled', processing_request_id = null
        where id = ${assessmentSessionId} and status = 'processing'
      `;
      return json({ error: 'La evaluación ya está completa.' }, 409);
    }
    if (Array.isArray(history) && history.length > 0) {
      console.warn('Ignoring client-supplied assessment history');
    }
  } else {
    assessmentTurns = Array.isArray(history) ? history.slice(-MAX_HISTORY) : [];
  }

  const previousAnswers = assessmentTurns.filter((turn) => turn?.role === 'user').length;
  const releaseSession = async (cancelPractice: boolean) => {
    if (practiceMode) {
      await sql`
        update public.practice_sessions
        set status = ${cancelPractice ? 'cancelled' : 'started'}, received_at = null
        where id = ${practiceSessionId}
          and user_id = ${userId}
          and status = 'processing'
      `;
    } else {
      await sql`
        update public.progress_assessment_sessions
        set status = 'active', processing_request_id = null
        where id = ${assessmentSessionId}
          and user_id = ${userId}
          and status = 'processing'
          and processing_request_id = ${requestId}
      `;
    }
  };
  if (ENFORCE_DAILY_QUESTION_LIMIT) {
    let usedBefore: number;
    try {
      usedBefore = await getUsed(userId);
    } catch (error) {
      console.error('usage failed', error);
      await releaseSession(false);
      return json({ error: 'No se pudo comprobar tu límite de preguntas.' }, 500);
    }
    const remainingAssessmentTurns = practiceMode ? 1 : ASSESSMENT_TURNS - previousAnswers;
    if (usedBefore + remainingAssessmentTurns > MAX_DAILY_QUESTIONS) {
      await releaseSession(false);
      return json(
        {
          code: 'assessment_quota',
          error: `La evaluación necesita ${ASSESSMENT_TURNS} respuestas disponibles. Vuelve cuando se renueve tu límite de 24 horas.`,
        },
        429
      );
    }
  }

  // La pregunta se reserva antes de llamar a la IA y se devuelve si no hubo respuesta útil.
  let used: number | null;
  try {
    used = await reserve(userId);
  } catch (error) {
    console.error('reserve failed', error);
    await releaseSession(false);
    return json({ error: 'No se pudo comprobar tu límite de preguntas.' }, 500);
  }
  if (used === null) {
    await releaseSession(practiceMode);
    return json(
      {
        code: 'limit',
        error: `Usaste tus ${MAX_DAILY_QUESTIONS} preguntas de esta práctica, mejora el plan.`,
      },
      429
    );
  }
  const fail = async (body: unknown, status: number) => {
    await refund(userId);
    if (practiceMode) {
      await releaseSession(true);
    } else {
      await releaseSession(false);
    }
    return json(body, status);
  };

  // Gemini exige que el primer turno sea del usuario; el saludo de la IA abre la charla.
  const past = assessmentTurns.slice(-MAX_HISTORY).map((turn) => ({
    role: turn.role === 'ia' ? 'model' : 'user',
    parts: [{ text: String(turn.text ?? '').slice(0, 1000) }],
  }));
  if (past[0]?.role === 'model') {
    past.unshift({ role: 'user', parts: [{ text: '(The student has just joined the call.)' }] });
  }

  const finalTurn = !practiceMode && previousAnswers === ASSESSMENT_TURNS - 1;
  const conversationPrompt = practiceMode
    ? `\n\nEsta es una práctica, no un examen. El nivel aproximado del estudiante es ${currentLevel}. Ayúdalo a practicar el punto débil descrito en el escenario. Responde en inglés sencillo y natural, corrige con amabilidad solo un error relevante por turno, ofrece una alternativa breve y termina con una pregunta de seguimiento. No califiques, no decidas si avanza de nivel y no incluyas assessment.`
    : `\n\nEsta es una evaluación conversacional para decidir si el estudiante demuestra las competencias de ${targetLevel}, con nivel actual ${currentLevel}. Criterio de producto para esta transición: ${rule.criteria.descriptor}. Comprueba con el diálogo completo fluidez, comprensión, respuesta, pronunciación y gramática. No corrijas ni enseñes durante la evaluación. Usa solo habilidades para las que el diálogo aporte evidencia suficiente: assessedSkills debe enumerarlas; scores y skillEvidence solo deben incluirlas. No inventes puntuaciones ni afirmes preparación por una respuesta memorizada. En las primeras cuatro respuestas no reveles resultado; en la quinta termina sin hacer otra pregunta y devuelve assessment con estimatedLevel, recommendation (promote o continue), assessedSkills, scores, skillEvidence (evidencia concreta breve por habilidad), weaknesses, evidenceSummary y tip. Recomienda promote solo cuando la evidencia del diálogo completo sustente el descriptor objetivo; si falta evidencia suficiente, recomienda continue. No uses un umbral numérico universal para decidir el nivel.`;

  // Conversación previa como turnos de texto + el audio nuevo como último turno.
  const contents = [
    ...past,
    { role: 'user', parts: [{ inlineData: { mimeType, data: audio } }] },
  ];

  const scenarioPrompt =
    typeof scenario === 'string' && scenario.trim()
      ? `\n\nRole-play: the conversation is ${scenario.trim().slice(0, 600)} Stay in character the whole time and keep the situation realistic, while still helping the student practice English.`
      : '';

  const body = JSON.stringify({
    systemInstruction: {
      parts: [
        {
          text:
            SYSTEM_PROMPT +
            conversationPrompt +
            (practiceMode
              ? ''
              : `\n\nNivel actual: ${currentLevel}. Nivel objetivo: ${targetLevel}.`) +
            scenarioPrompt,
        },
      ],
    },
    contents,
    generationConfig: {
      temperature: 0.8,
      responseMimeType: 'application/json',
      responseSchema: finalTurn ? finalResponseSchema : responseSchema,
    },
  });

  let response: Response | undefined;
  let lastStatus = 0;
  for (const model of GEMINI_MODELS) {
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
          body,
          signal: AbortSignal.timeout(25_000),
        }
      );
    } catch (error) {
      console.error('Gemini timeout/red', model, (error as Error).message);
      continue;
    }
    if (response.ok) break;
    console.error('Gemini error', model, response.status);
    lastStatus = response.status;
    if (response.status !== 503 && response.status !== 429 && response.status !== 404) break;
  }

  if (!response?.ok) {
    const quota = lastStatus === 429;
    return fail(
      {
        error: quota
          ? 'Se alcanzó el límite de uso de la IA por hoy. Inténtalo más tarde.'
          : 'La IA está saturada en este momento. Inténtalo de nuevo.',
      },
      quota ? 429 : 503
    );
  }

  try {
    const data = await response.json();
    const result = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text as string);

    if (!result.heard || !String(result.userText ?? '').trim()) {
      return fail({ error: 'No te escuché bien. Toca el micrófono y habla de nuevo.' }, 422);
    }
    if (practiceMode) {
      const credited = creditedPracticeSeconds(practiceElapsedSeconds, true);
      if (credited === null) {
        return fail({ error: 'No se pudo verificar la duración de práctica.' }, 422);
      }
      validPracticeSeconds = credited;
    }

    const reply = String(result.reply ?? '').trim();
    if (!reply) throw new Error('Missing conversational reply');

    const responseBody: Record<string, unknown> = {
      userText: String(result.userText).trim(),
      reply,
      used,
    };

    if (practiceMode) {
      const saved = await sql.begin(async (tx) => {
        const rows = await tx`
          update public.practice_sessions
          set status = 'completed',
              duration_seconds = ${validPracticeSeconds},
              completed_at = now()
          where id = ${practiceSessionId}
            and user_id = ${userId}
            and from_level = ${currentLevel}
            and status = 'processing'
          returning duration_seconds
        `;
        if (!rows[0]) throw new Error('Practice session could not be completed exactly once');
        const profile = await tx`
          update public.progression_profiles
          set total_practice_seconds = total_practice_seconds + ${validPracticeSeconds},
              updated_at = now()
          where user_id = ${userId} and current_level = ${currentLevel}
          returning total_practice_seconds
        `;
        if (!profile[0]) throw new Error('Progression level changed while completing practice');
        return Number(profile[0].total_practice_seconds);
      });
      responseBody.validPracticeSeconds = validPracticeSeconds;
      responseBody.totalPracticeSeconds = saved;
    } else {
      const updatedTurns: Turn[] = [
        ...assessmentTurns,
        { role: 'user' as const, text: String(result.userText).trim().slice(0, 1000) },
        { role: 'ia' as const, text: reply.slice(0, 1000) },
      ].slice(-MAX_HISTORY);

      if (finalTurn) {
        const raw = result.assessment;
        if (
          !isLevel(raw?.estimatedLevel) ||
          !['promote', 'continue'].includes(raw?.recommendation) ||
          !Array.isArray(raw?.assessedSkills) ||
          !raw?.scores ||
          !raw?.skillEvidence ||
          !Array.isArray(raw?.weaknesses) ||
          typeof raw?.evidenceSummary !== 'string' ||
          typeof raw?.tip !== 'string'
        ) {
          throw new Error('Missing or invalid structured assessment');
        }
        const assessedSkills = [...new Set(raw.assessedSkills.filter((skill: unknown) =>
          SKILLS.includes(skill as Skill)
        ))] as Skill[];
        const scores: Partial<Record<Skill, number>> = {};
        const skillEvidence: Partial<Record<Skill, string>> = {};
        for (const skill of assessedSkills) {
          if (typeof raw.skillEvidence[skill] !== 'string') continue;
          const evidence = raw.skillEvidence[skill].trim().slice(0, 1000);
          if (!evidence) continue;
          skillEvidence[skill] = evidence;
          scores[skill] = validateScore(raw.scores[skill]);
        }
        const normalized = {
          estimatedLevel: raw.estimatedLevel as Level,
          recommendation: raw.recommendation as 'promote' | 'continue',
          assessedSkills: Object.keys(skillEvidence) as Skill[],
          scores,
          skillEvidence,
          weaknesses: raw.weaknesses
            .filter((item: unknown): item is string => typeof item === 'string')
            .map((item: string) => item.trim().slice(0, 300))
            .filter(Boolean)
            .slice(0, 5),
          evidenceSummary: raw.evidenceSummary.trim().slice(0, 1500),
          tip: raw.tip.trim().slice(0, 500),
        };
        if (!normalized.evidenceSummary || !normalized.tip) {
          throw new Error('Assessment summary is empty');
        }

        const decision = await sql.begin(async (tx) => {
          const locked = await tx`
            select current_level from public.progression_profiles
            where user_id = ${userId} for update
          `;
          if (locked[0]?.current_level !== currentLevel) {
            throw new Error('Progression level changed during assessment');
          }
          const savedSessions = await tx`
            update public.progress_assessment_sessions
            set status = 'completed', completed_at = now(), turns = ${tx.json(updatedTurns)}
            where id = ${assessmentSessionId}
              and user_id = ${userId}
              and from_level = ${currentLevel}
              and to_level = ${targetLevel}
              and status = 'processing'
              and processing_request_id = ${requestId}
            returning id
          `;
          if (!savedSessions[0]) throw new Error('Assessment session was already consumed');

          const stored = await tx`
            insert into public.progress_assessments (
              user_id, assessment_type, session_id, from_level, to_level,
              estimated_level, scores, assessed_skills, skill_evidence, weaknesses,
              recommendation, evidence_summary, tip, criteria_applied
            ) values (
              ${userId}, 'progression', ${assessmentSessionId}, ${currentLevel}, ${targetLevel},
              ${normalized.estimatedLevel}, ${tx.json(normalized.scores)},
              ${normalized.assessedSkills}, ${tx.json(normalized.skillEvidence)},
              ${normalized.weaknesses}, ${normalized.recommendation},
              ${normalized.evidenceSummary}, ${normalized.tip}, ${tx.json(rule.criteria)}
            )
            returning id
          `;
          const previous = await tx`
            select id, from_level, to_level, estimated_level, scores, assessed_skills,
                   skill_evidence, recommendation, criteria_applied
            from public.progress_assessments
            where user_id = ${userId}
              and assessment_type = 'progression'
              and from_level = ${currentLevel}
              and to_level = ${targetLevel}
              and id <> ${stored[0].id}
            order by created_at desc
            limit 1
          `;
          const eligible = qualifiesForPromotion(
            {
              id: stored[0].id,
              ...normalized,
              from_level: currentLevel,
              to_level: targetLevel,
              criteria_applied: rule.criteria,
            },
            previous,
            rule
          );
          let status: 'not_ready' | 'needs_confirmation' | 'promoted';
          if (!hasSufficientEvidence(normalized, rule)) {
            status = 'not_ready';
          } else if (!eligible) {
            status = 'needs_confirmation';
          } else {
            const promotions = await tx`
              insert into public.level_promotions
                (user_id, from_level, to_level, assessment_id, criteria_applied)
              values (${userId}, ${currentLevel}, ${targetLevel}, ${stored[0].id}, ${tx.json(rule.criteria)})
              on conflict (user_id, from_level, to_level) do nothing
              returning id
            `;
              if (!promotions[0]) throw new Error('Promotion already exists for this transition');
              const updated = await tx`
                update public.progression_profiles
                set current_level = ${targetLevel}, updated_at = now()
                where user_id = ${userId} and current_level = ${currentLevel}
                returning user_id
              `;
              if (!updated[0]) throw new Error('Could not atomically update progression level');
              status = 'promoted';
          }
          return { status, assessmentId: stored[0].id };
        });

        responseBody.assessment = {
          ...normalized,
          ready: decision.status === 'promoted',
          promotionStatus: decision.status,
          assessmentId: decision.assessmentId,
          currentLevel: decision.status === 'promoted' ? targetLevel : currentLevel,
          targetLevel,
        };
      } else {
        const sessions = await sql`
          update public.progress_assessment_sessions
          set status = 'active', processing_request_id = null, turns = ${sql.json(updatedTurns)}
          where id = ${assessmentSessionId}
            and user_id = ${userId}
            and status = 'processing'
            and processing_request_id = ${requestId}
          returning id
        `;
        if (!sessions[0]) throw new Error('Assessment turn could not be saved');
      }
    }

    return json(responseBody);
  } catch (error) {
    console.error('conversation response processing failed', error);
    return fail({ error: 'La IA devolvió una respuesta inesperada.' }, 502);
  }
});
