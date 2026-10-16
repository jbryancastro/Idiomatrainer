import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAccountLevel, getAccessToken, getSessionUser, saveAccountLevel } from '@/lib/auth';
import { Platform } from 'react-native';

export type SpeechAnalysis = {
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  scores: {
    conversation: number;
    pronunciation: number;
    grammar: number;
    comprehension: number;
    response: number;
  };
  challenge: string;
  tip: string;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const LEVEL_NAMES: Record<SpeechAnalysis['level'], string> = {
  A1: 'Principiante',
  A2: 'Básico',
  B1: 'Intermedio',
  B2: 'Intermedio alto',
  C1: 'Avanzado',
  C2: 'Dominio',
};

// El nivel vive en la cuenta de Supabase; el almacenamiento local es solo respaldo
// para cuando no hay conexión o la sesión no tiene token (Google/Apple).
const levelKey = async () => {
  const user = await getSessionUser();
  return `idiomatrainer.level.${user?.id ?? 'guest'}`;
};

const scoresKey = async () => {
  const user = await getSessionUser();
  return `idiomatrainer.scores.${user?.id ?? 'guest'}`;
};

// Puntuaciones del último análisis hecho en este dispositivo; null si no hay.
export const getSavedScores = async (): Promise<SpeechAnalysis['scores'] | null> => {
  try {
    const raw = await AsyncStorage.getItem(await scoresKey());
    return raw ? (JSON.parse(raw) as SpeechAnalysis['scores']) : null;
  } catch {
    return null;
  }
};

const isLevel = (value: unknown): value is SpeechAnalysis['level'] =>
  typeof value === 'string' && value in LEVEL_NAMES;

export const getSavedLevel = async (): Promise<SpeechAnalysis['level'] | null> => {
  const key = await levelKey();
  const remote = await fetchAccountLevel();

  if (isLevel(remote)) {
    await AsyncStorage.setItem(key, remote);
    return remote;
  }

  const local = await AsyncStorage.getItem(key);
  if (!isLevel(local)) return null;

  // La cuenta aún no tiene nivel pero este dispositivo sí: se sube una vez.
  if (remote === null) saveAccountLevel(local).catch(() => {});
  return local;
};

export const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // El resultado es "data:<mime>;base64,<datos>": solo se envían los datos.
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('No se pudo leer la grabación.'));
    reader.readAsDataURL(blob);
  });

export const analyzeRecording = async (uri: string): Promise<SpeechAnalysis> => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env.local.');
  }

  const token = await getAccessToken();
  if (!token) throw new Error('Vuelve a iniciar sesión con tu correo para hacer la evaluación.');

  const blob = await (await fetch(uri)).blob();
  // En web el navegador indica el formato; en móvil expo-audio graba AAC en .m4a.
  const mimeType = Platform.OS === 'web' && blob.type ? blob.type : 'audio/mp4';
  const audio = await blobToBase64(blob);

  const response = await fetch(`${supabaseUrl}/functions/v1/analyze-speech`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ audio, mimeType: mimeType.split(';')[0] }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error ?? result.message ?? 'No se pudo analizar la grabación.');
  }

  const analysis = result as SpeechAnalysis;
  await AsyncStorage.setItem(await levelKey(), analysis.level);
  await AsyncStorage.setItem(await scoresKey(), JSON.stringify(analysis.scores)).catch(() => {});
  await saveAccountLevel(analysis.level).catch(() => {});
  return analysis;
};
