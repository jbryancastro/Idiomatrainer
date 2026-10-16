// Edge Function: analiza con Gemini la grabación de la prueba de nivel.
// Recibe { audio: <base64>, mimeType } y devuelve nivel CEFR, puntajes por
// habilidad y el principal reto. La llave GEMINI_API_KEY vive solo en el servidor.
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
// Orden de preferencia; GEMINI_MODEL permite forzar el primero desde Supabase.
const GEMINI_MODELS = [
  Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
];

// Límite del payload en base64 (~15 MB de audio) para evitar abusos.
const MAX_AUDIO_BASE64_LENGTH = 20_000_000;

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

const clamp = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
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

  try {
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text as string;
    const result = JSON.parse(text);

    // Se exige una transcripción real: evita que la IA califique silencio o ruido.
    const wordCount = String(result.transcript ?? '').trim().split(/\s+/).filter(Boolean).length;
    if (!result.validSpeech || wordCount < 5) {
      return json({ error: 'No se detectó voz en inglés en la grabación. Habla más cerca del micrófono e inténtalo de nuevo.' }, 422);
    }

    return json({
      level: result.level,
      scores: {
        conversation: clamp(result.scores?.conversation),
        pronunciation: clamp(result.scores?.pronunciation),
        grammar: clamp(result.scores?.grammar),
        comprehension: clamp(result.scores?.comprehension),
        response: clamp(result.scores?.response),
      },
      challenge: String(result.challenge ?? ''),
      tip: String(result.tip ?? ''),
    });
  } catch {
    return json({ error: 'La IA devolvió una respuesta inesperada.' }, 502);
  }
});
