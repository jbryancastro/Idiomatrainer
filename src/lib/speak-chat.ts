import { getAccessToken } from '@/lib/auth';
import { blobToBase64, type SpeechAnalysis } from '@/lib/speech-analysis';
import { Platform } from 'react-native';

export type ChatTurn = { role: 'user' | 'ia'; text: string };
type Level = SpeechAnalysis['level'];
type ConversationMode = 'assessment' | 'practice';

export const ASSESSMENT_TURNS = 5;

export type ConversationAssessment = {
  ready: boolean;
  scores: SpeechAnalysis['scores'];
  weaknesses: string[];
  evidence: string;
  tip: string;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export class QuestionLimitError extends Error {}
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const callFunction = async (payload: Record<string, unknown>): Promise<Record<string, unknown>> => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env.local.');
  }
  const token = await getAccessToken();
  if (!token) throw new Error('Vuelve a iniciar sesión para usar la conversación con IA.');

  const response = await fetch(`${supabaseUrl}/functions/v1/speak-chat`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result: unknown = await response.json().catch(() => ({}));
  if (!isRecord(result)) throw new Error('La IA devolvió una respuesta inesperada.');
  if (!response.ok) {
    const message =
      (typeof result.error === 'string' && result.error) ||
      (typeof result.message === 'string' && result.message) ||
      'No se pudo obtener la respuesta de la IA.';
    if (result.code === 'limit') throw new QuestionLimitError(message);
    throw new Error(message);
  }
  return result;
};

// Preguntas usadas en la ventana de 24 h actual; el servidor es quien las cuenta.
export const fetchQuestionsUsed = async (): Promise<number> => {
  const result = await callFunction({ action: 'usage' });
  if (typeof result.used !== 'number' || !Number.isInteger(result.used) || result.used < 0) {
    throw new Error('No se pudo comprobar tu límite de preguntas.');
  }
  return result.used;
};

// Envía la grabación y el historial; devuelve lo que dijo el usuario, la respuesta y el conteo.
export const sendVoiceTurn = async (
  uri: string,
  history: ChatTurn[],
  currentLevel: Level,
  scenario?: string,
  mode: ConversationMode = 'assessment'
): Promise<{ userText: string; reply: string; used: number; assessment?: ConversationAssessment }> => {
  const blob = await (await fetch(uri)).blob();
  const mimeType = Platform.OS === 'web' && blob.type ? blob.type : 'audio/mp4';
  const audio = await blobToBase64(blob);

  const result = await callFunction({
    audio,
    mimeType: mimeType.split(';')[0],
    history,
    currentLevel,
    scenario,
    mode,
  });
  if (
    typeof result.userText !== 'string' ||
    typeof result.reply !== 'string' ||
    typeof result.used !== 'number' ||
    !Number.isInteger(result.used) ||
    result.used < 0
  ) {
    throw new Error('La IA devolvió una respuesta inesperada.');
  }

  let assessment: ConversationAssessment | undefined;
  if (result.assessment !== undefined) {
    if (!isRecord(result.assessment) || typeof result.assessment.ready !== 'boolean') {
      throw new Error('La IA devolvió una evaluación inesperada.');
    }
    const scores = result.assessment.scores;
    if (!isRecord(scores)) throw new Error('La IA devolvió puntuaciones inesperadas.');
    const validateScore = (value: unknown) => {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) {
        throw new Error('La IA devolvió puntuaciones inesperadas.');
      }
      return value;
    };
    const validatedScores: SpeechAnalysis['scores'] = {
      conversation: validateScore(scores.conversation),
      pronunciation: validateScore(scores.pronunciation),
      grammar: validateScore(scores.grammar),
      comprehension: validateScore(scores.comprehension),
      response: validateScore(scores.response),
    };
    if (
      !Array.isArray(result.assessment.weaknesses) ||
      !result.assessment.weaknesses.every((item) => typeof item === 'string') ||
      typeof result.assessment.evidence !== 'string' ||
      !result.assessment.evidence.trim() ||
      typeof result.assessment.tip !== 'string' ||
      !result.assessment.tip.trim()
    ) {
      throw new Error('La IA devolvió comentarios de evaluación inesperados.');
    }
    assessment = {
      ready: result.assessment.ready,
      scores: validatedScores,
      weaknesses: result.assessment.weaknesses,
      evidence: result.assessment.evidence,
      tip: result.assessment.tip,
    };
  }

  return {
    userText: result.userText,
    reply: result.reply,
    used: result.used,
    assessment,
  };
};
