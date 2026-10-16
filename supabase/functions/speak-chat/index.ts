// Edge Function: conversación por voz con un tutor de inglés (Gemini).
// Recibe { audio: <base64>, mimeType, history: [{ role, text }] }, transcribe lo que
// dijo el estudiante y devuelve { userText, reply }. La llave vive solo en el servidor.
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';
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
const ENFORCE_DAILY_QUESTION_LIMIT = false;
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
type Level = (typeof LEVELS)[number];

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
- Reacciona a lo que dijo el estudiante y termina con UNA pregunta de seguimiento para que siga hablando.
- Si pide ayuda en español, ayúdalo brevemente y vuelve al inglés.
- No uses emojis, listas ni formato: tu respuesta se leerá en voz alta.

Primero transcribe literalmente lo que dice el estudiante en "userText". Si el audio está en silencio, solo tiene ruido o no se entiende, deja "userText" vacío y "heard": false.

Devuelve únicamente JSON con userText, heard y reply.`;

const LEVEL_GUIDANCE: Record<Level, string> = {
  A1: 'Puede comprender y usar expresiones cotidianas muy básicas e intercambiar información personal sencilla.',
  A2: 'Puede comunicarse en tareas rutinarias, describir su entorno y hablar brevemente de necesidades inmediatas.',
  B1: 'Puede desenvolverse en situaciones habituales, narrar experiencias y explicar brevemente planes u opiniones.',
  B2: 'Puede interactuar con fluidez razonable, desarrollar argumentos y tratar temas concretos y abstractos.',
  C1: 'Puede expresarse con fluidez y flexibilidad, organizar ideas complejas y usar el idioma eficazmente.',
  C2: 'Puede comprender prácticamente todo y expresarse con precisión, matices y naturalidad en situaciones complejas.',
};

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
    ready: { type: 'BOOLEAN' },
    scores: {
      type: 'OBJECT',
      properties: {
        conversation: { type: 'INTEGER' },
        pronunciation: { type: 'INTEGER' },
        grammar: { type: 'INTEGER' },
        comprehension: { type: 'INTEGER' },
        response: { type: 'INTEGER' },
      },
      required: ['conversation', 'pronunciation', 'grammar', 'comprehension', 'response'],
    },
    weaknesses: { type: 'ARRAY', items: { type: 'STRING' } },
    evidence: { type: 'STRING' },
    tip: { type: 'STRING' },
  },
  required: ['ready', 'scores', 'weaknesses', 'evidence', 'tip'],
};

const finalResponseSchema = {
  ...responseSchema,
  properties: { ...responseSchema.properties, assessment: assessmentSchema },
  required: [...responseSchema.required, 'assessment'],
};

type Turn = { role: 'user' | 'ia'; text: string };

const isLevel = (value: unknown): value is Level =>
  LEVELS.some((level) => level === value);

const clampScore = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Invalid assessment score');
  }
  return Math.max(0, Math.min(100, Math.round(value)));
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);
  if (!GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY no está configurada en Supabase.' }, 500);

  let audio: string | undefined;
  let mimeType: string | undefined;
  let history: Turn[] = [];
  let scenario: string | undefined;
  let action: string | undefined;
  let currentLevel: string | undefined;
  let mode: string | undefined;
  try {
    ({ audio, mimeType, history = [], scenario, action, currentLevel, mode } = await req.json());
  } catch {
    return json({ error: 'Solicitud inválida.' }, 400);
  }

  const userId = await getUserId(req);
  if (!userId) return json({ error: 'Vuelve a iniciar sesión para usar la IA.' }, 401);

  try {
    await ready;
    if (action === 'usage') {
      return json({ used: await getUsed(userId), max: MAX_DAILY_QUESTIONS });
    }
  } catch (error) {
    console.error('usage failed', error);
    return json({ error: 'No se pudo comprobar tu límite de preguntas.' }, 500);
  }

  const practiceMode = mode === 'practice';
  if (mode !== undefined && mode !== 'practice' && mode !== 'assessment') {
    return json({ error: 'Modo de conversación inválido.' }, 400);
  }
  if (!practiceMode && !isLevel(currentLevel)) {
    return json({ error: 'Necesitamos conocer tu nivel actual para iniciar la evaluación.' }, 400);
  }
  const targetLevel = isLevel(currentLevel)
    ? LEVELS[LEVELS.indexOf(currentLevel) + 1]
    : undefined;
  if (!practiceMode && !targetLevel) {
    return json({ error: 'Ya alcanzaste el nivel C2.' }, 409);
  }

  if (!audio || typeof audio !== 'string' || !mimeType?.startsWith('audio/')) {
    return json({ error: 'Falta el audio.' }, 400);
  }
  if (audio.length > MAX_AUDIO_BASE64_LENGTH) {
    return json({ error: 'La grabación es demasiado grande.' }, 413);
  }

  const previousAnswers = Array.isArray(history)
    ? history.filter((turn) => turn?.role === 'user').length
    : 0;
  if (!practiceMode && previousAnswers >= ASSESSMENT_TURNS) {
    return json({ error: 'La evaluación ya está completa.' }, 409);
  }

  if (ENFORCE_DAILY_QUESTION_LIMIT) {
    let usedBefore: number;
    try {
      usedBefore = await getUsed(userId);
    } catch (error) {
      console.error('usage failed', error);
      return json({ error: 'No se pudo comprobar tu límite de preguntas.' }, 500);
    }
    const remainingAssessmentTurns = practiceMode ? 1 : ASSESSMENT_TURNS - previousAnswers;
    if (usedBefore + remainingAssessmentTurns > MAX_DAILY_QUESTIONS) {
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
    return json({ error: 'No se pudo comprobar tu límite de preguntas.' }, 500);
  }
  if (used === null) {
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
    return json(body, status);
  };

  // Gemini exige que el primer turno sea del usuario; el saludo de la IA abre la charla.
  const past = (Array.isArray(history) ? history : []).slice(-MAX_HISTORY).map((turn) => ({
    role: turn.role === 'ia' ? 'model' : 'user',
    parts: [{ text: String(turn.text ?? '').slice(0, 1000) }],
  }));
  if (past[0]?.role === 'model') {
    past.unshift({ role: 'user', parts: [{ text: '(The student has just joined the call.)' }] });
  }

  const finalTurn = !practiceMode && previousAnswers === ASSESSMENT_TURNS - 1;
  const conversationPrompt = practiceMode
    ? `\n\nEsta es una práctica, no un examen. El nivel aproximado del estudiante es ${currentLevel ?? 'desconocido'}. Ayúdalo a practicar el punto débil descrito en el escenario. Responde en inglés sencillo y natural, corrige con amabilidad solo un error relevante por turno, ofrece una alternativa breve y termina con una pregunta de seguimiento. No califiques, no decidas si avanza de nivel y no incluyas assessment.`
    : `\n\nEsta es una evaluación conversacional para decidir si el estudiante está preparado para avanzar de ${currentLevel} a ${targetLevel}. Descriptor del nivel objetivo: ${LEVEL_GUIDANCE[targetLevel!]}. Adapta gradualmente las preguntas para comprobar estas habilidades sin convertir la charla en un examen de gramática. No corrijas ni enseñes durante la evaluación, porque eso podría influir en las respuestas posteriores. Considera todo el diálogo, no una respuesta aislada. En las primeras cuatro respuestas, continúa la conversación sin revelar una nota ni el resultado. En la quinta respuesta, termina con una despedida breve, no hagas otra pregunta y no reveles verbalmente el resultado; añade "assessment" al JSON: indica ready como true solo si el estudiante demuestra de forma consistente el descriptor del nivel objetivo; incluye puntuaciones enteras de 0 a 100 para conversación, pronunciación, gramática, comprensión y respuesta; enumera sus principales debilidades en español; y resume en español evidencia concreta de sus respuestas y un consejo breve. No afirmes que está listo basándote en una frase memorizada.`;

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

    const reply = String(result.reply ?? '').trim();
    if (!reply) throw new Error('Missing conversational reply');

    const responseBody: Record<string, unknown> = {
      userText: String(result.userText).trim(),
      reply,
      used,
    };

    if (finalTurn) {
      const assessment = result.assessment;
      if (
        typeof assessment?.ready !== 'boolean' ||
        !Array.isArray(assessment.weaknesses) ||
        typeof assessment.evidence !== 'string' ||
        typeof assessment.tip !== 'string'
      ) {
        throw new Error('Missing final assessment');
      }
      responseBody.assessment = {
        ready: assessment.ready,
        scores: {
          conversation: clampScore(assessment.scores?.conversation),
          pronunciation: clampScore(assessment.scores?.pronunciation),
          grammar: clampScore(assessment.scores?.grammar),
          comprehension: clampScore(assessment.scores?.comprehension),
          response: clampScore(assessment.scores?.response),
        },
        weaknesses: assessment.weaknesses.filter((item: unknown) => typeof item === 'string').slice(0, 5),
        evidence: assessment.evidence.slice(0, 1000),
        tip: assessment.tip.slice(0, 500),
      };
    }

    return json(responseBody);
  } catch {
    return fail({ error: 'La IA devolvió una respuesta inesperada.' }, 502);
  }
});
