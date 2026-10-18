// Edge Function: analiza con Gemini la grabación de la prueba de nivel.
// Recibe { audio: <base64>, mimeType } y devuelve nivel CEFR, puntajes por
// habilidad y el principal reto. La llave GEMINI_API_KEY vive solo en el servidor.
import postgres from 'https://deno.land/x/postgresjs@v3.4.5/mod.js';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// Orden de preferencia; GEMINI_MODEL permite forzar el primero desde Supabase.
const GEMINI_MODELS = [
  Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];

// Límite del payload en base64 (~15 MB de audio) para evitar abusos.
const MAX_AUDIO_BASE64_LENGTH = 20_000_000;
const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1 });
type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
type GeminiAnalysis = {
  transcript?: unknown;
  validSpeech?: unknown;
  level?: unknown;
  scores?: Partial<Record<'conversation' | 'pronunciation' | 'grammar' | 'comprehension' | 'response', unknown>>;
  challenge?: unknown;
  tip?: unknown;
};
const isLevel = (value: unknown): value is Level =>
  typeof value === 'string' && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(value);

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

const PROMPT = `Eres un evaluador experto de inglés (marco CEFR). Escucha la grabación de un estudiante hispanohablante que habla en inglés unos 60 segundos sobre quién es, qué hace y por qué quiere aprender.

Evalúa solo lo que realmente escuchas, sin inventar. Primero transcribe literalmente lo que dice el estudiante en el campo "transcript". Si el audio está en silencio, solo tiene ruido o no hay palabras en inglés, deja "transcript" vacío y pon "validSpeech": false (no estimes puntajes por defecto: usa 0).

Devuelve únicamente JSON con:
- transcript: transcripción literal en inglés (vacía si no hay voz).
- validSpeech: boolean.
- level: uno de A1, A2, B1, B2, C1, C2.
- scores: enteros 0-100 para conversation (fluidez y coherencia), pronunciation, grammar, comprehension (qué tan bien entiende y responde al tema) y response (rapidez y naturalidad al responder).
- challenge: una frase corta en español (máximo 12 palabras) con su principal reto, formulada como acción, por ejemplo "Responder rápidamente durante una conversación."
- tip: un consejo breve en español (máximo 20 palabras).`;

const responseSchema = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING' },
    validSpeech: { type: 'BOOLEAN' },
    level: { type: 'STRING', enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
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
    challenge: { type: 'STRING' },
    tip: { type: 'STRING' },
  },
  required: ['transcript', 'validSpeech', 'level', 'scores', 'challenge', 'tip'],
};

const validateScore = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error('Gemini returned an invalid skill score');
  }
  return value;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido.' }, 405);
  }
  if (!GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY no está configurada en Supabase.' }, 500);
  }

  // Solo usuarios con sesión: la clave anon por sí sola no basta.
  const auth = req.headers.get('authorization');
  const userResponse = auth
    ? await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
        headers: { Authorization: auth, apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
      }).catch(() => null)
    : null;
  if (!userResponse?.ok) {
    return json({ error: 'Vuelve a iniciar sesión para usar la IA.' }, 401);
  }
  const authUser = await userResponse.json().catch(() => null);
  if (typeof authUser?.id !== 'string') {
    return json({ error: 'No se pudo verificar la cuenta autenticada.' }, 401);
  }

  let audio: string | undefined;
  let mimeType: string | undefined;
  try {
    ({ audio, mimeType } = await req.json());
  } catch {
    return json({ error: 'Solicitud inválida.' }, 400);
  }

  if (!audio || typeof audio !== 'string' || !mimeType?.startsWith('audio/')) {
    return json({ error: 'Falta el audio de la grabación.' }, 400);
  }
  if (audio.length > MAX_AUDIO_BASE64_LENGTH) {
    return json({ error: 'La grabación es demasiado grande.' }, 413);
  }

  // Gemini responde 503/429 en picos de demanda: se reintenta con espera creciente.
  const callGemini = async () => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType, data: audio } }] }],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema,
      },
    });

    // Si un modelo está saturado (503/429) o tarda demasiado, se prueba el siguiente.
    // El total queda por debajo del límite de 150 s de las Edge Functions.
    let res: Response | undefined;
    for (const model of GEMINI_MODELS) {
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': GEMINI_API_KEY,
            },
            body,
            signal: AbortSignal.timeout(40_000),
          }
        );
      } catch (error) {
        console.error('Gemini timeout/red', model, (error as Error).message);
        continue;
      }
      if (res.ok) break;
      console.error('Gemini error', model, res.status);
      if (res.status !== 503 && res.status !== 429 && res.status !== 404) break;
    }
    return res;
  };

  const response = await callGemini();

  if (!response?.ok) {
    return json({ error: 'La IA está saturada en este momento. Inténtalo de nuevo en un minuto.' }, 503);
  }

  let result: GeminiAnalysis;
  try {
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text as string;
    result = JSON.parse(text) as GeminiAnalysis;
  } catch (error) {
    console.error('Could not parse analyze-speech response', error);
    return json({ error: 'La IA devolvió una respuesta inesperada.' }, 502);
  }

  // Se exige una transcripción real: evita que la IA califique silencio o ruido.
  const wordCount = String(result.transcript ?? '').trim().split(/\s+/).filter(Boolean).length;
  if (result.validSpeech !== true || wordCount < 5) {
    return json({ error: 'No se detectó voz en inglés en la grabación. Habla más cerca del micrófono e inténtalo de nuevo.' }, 422);
  }

  if (!isLevel(result.level)) {
    return json({ error: 'La IA devolvió un nivel estimado no válido.' }, 502);
  }
  let scores: Record<'conversation' | 'pronunciation' | 'grammar' | 'comprehension' | 'response', number>;
  try {
    scores = {
      conversation: validateScore(result.scores?.conversation),
      pronunciation: validateScore(result.scores?.pronunciation),
      grammar: validateScore(result.scores?.grammar),
      comprehension: validateScore(result.scores?.comprehension),
      response: validateScore(result.scores?.response),
    };
  } catch (error) {
    console.error('Gemini returned incomplete baseline scores', error);
    return json({ error: 'La IA no devolvió puntuaciones completas para esta evaluación.' }, 502);
  }
  const transcript = String(result.transcript).trim().slice(0, 5000);
  let officialLevel: string;
  try {
    officialLevel = await sql.begin(async (tx) => {
      await tx`
        insert into public.progression_profiles (user_id)
        values (${authUser.id})
        on conflict (user_id) do nothing
      `;
      const profiles = await tx`
        select current_level from public.progression_profiles
        where user_id = ${authUser.id} for update
      `;
      let level = profiles[0]?.current_level;
      if (!level) {
        const initialized = await tx`
          update public.progression_profiles
          set current_level = ${result.level}, updated_at = now()
          where user_id = ${authUser.id} and current_level is null
          returning current_level
        `;
        level = initialized[0]?.current_level;
      }
      if (!isLevel(level)) {
        throw new Error('Could not initialize authoritative level');
      }
      await tx`
        insert into public.progress_assessments (
          user_id, assessment_type, estimated_level, scores, assessed_skills,
          skill_evidence, weaknesses, recommendation, evidence_summary, tip, criteria_applied
        ) values (
          ${authUser.id}, 'initial', ${result.level}, ${tx.json(scores)},
          ${['conversation', 'comprehension', 'response', 'pronunciation', 'grammar']},
          ${tx.json({ transcript })}, ${[String(result.challenge ?? '').slice(0, 300)]},
          'baseline', ${transcript}, ${String(result.tip ?? '').slice(0, 500)},
          ${tx.json({ source: 'analyze-speech', version: 1 })}
        )
      `;
      return level;
    });
  } catch (error) {
    console.error('Could not persist initial progression assessment', error);
    return json({ error: 'No se pudo guardar la evaluación en tu progreso.' }, 500);
  }

  return json({
    level: officialLevel,
    estimatedLevel: result.level,
    scores,
    challenge: String(result.challenge ?? ''),
    tip: String(result.tip ?? ''),
  });
});
