import { getAccessToken } from '@/lib/auth';
import { blobToBase64 } from '@/lib/speech-analysis';
import { Platform } from 'react-native';

export type ChatTurn = { role: 'user' | 'ia'; text: string };

export const MAX_QUESTIONS = 5;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export class QuestionLimitError extends Error {}

const callFunction = async (payload: Record<string, unknown>) => {
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

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (result.code === 'limit') throw new QuestionLimitError(result.error);
    throw new Error(result.error ?? result.message ?? 'No se pudo obtener la respuesta de la IA.');
  }
  return result;
};

// Preguntas usadas en la ventana de 24 h actual; el servidor es quien las cuenta.
export const fetchQuestionsUsed = async (): Promise<number> =>
  (await callFunction({ action: 'usage' })).used ?? 0;

// Envía la grabación y el historial; devuelve lo que dijo el usuario, la respuesta y el conteo.
export const sendVoiceTurn = async (
  uri: string,
  history: ChatTurn[],
  scenario?: string
): Promise<{ userText: string; reply: string; used: number }> => {
  const blob = await (await fetch(uri)).blob();
  const mimeType = Platform.OS === 'web' && blob.type ? blob.type : 'audio/mp4';
  const audio = await blobToBase64(blob);

  return callFunction({ audio, mimeType: mimeType.split(';')[0], history, scenario });
};
