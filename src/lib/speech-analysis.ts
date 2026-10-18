import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken, getSessionUser } from '@/lib/auth';
import { fetchProgressSnapshot } from '@/lib/practice-progress';
import { updateLearnerProfile } from '@/lib/profile';
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

export type AssessmentInsights = {
  ready: boolean;
  fromLevel: SpeechAnalysis['level'];
  targetLevel: SpeechAnalysis['level'];
  weaknesses: string[];
  evidence: string;
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

const insightsKey = async () => {
  const user = await getSessionUser();
  return `idiomatrainer.assessment-insights.${user?.id ?? 'guest'}`;
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

export const saveAssessmentScores = async (scores: SpeechAnalysis['scores']) => {
  await AsyncStorage.setItem(await scoresKey(), JSON.stringify(scores));
};

export const getSavedAssessmentInsights = async (): Promise<AssessmentInsights | null> => {
  const raw = await AsyncStorage.getItem(await insightsKey());
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null) return null;

  const insights = value as Partial<AssessmentInsights>;
  if (
    typeof insights.ready !== 'boolean' ||
    !isLevel(insights.fromLevel) ||
    !isLevel(insights.targetLevel) ||
    !Array.isArray(insights.weaknesses) ||
    !insights.weaknesses.every((weakness) => typeof weakness === 'string') ||
    typeof insights.evidence !== 'string' ||
    typeof insights.tip !== 'string'
  ) {
    return null;
  }
  return insights as AssessmentInsights;
};

export const saveAssessmentInsights = async (insights: AssessmentInsights) => {
  await AsyncStorage.setItem(await insightsKey(), JSON.stringify(insights));
};

const isLevel = (value: unknown): value is SpeechAnalysis['level'] =>
  typeof value === 'string' && value in LEVEL_NAMES;

export const getSavedLevel = async (): Promise<SpeechAnalysis['level'] | null> => {
  const key = await levelKey();
  try {
    const snapshot = await fetchProgressSnapshot();
    if (isLevel(snapshot.currentLevel)) {
      await AsyncStorage.setItem(key, snapshot.currentLevel);
      return snapshot.currentLevel;
    }
    return null;
  } catch (error) {
    const local = await AsyncStorage.getItem(key);
    if (isLevel(local)) return local;
    throw error;
  }
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
  await updateLearnerProfile({
    initialAssessment: { level: analysis.level, scores: analysis.scores },
  }).catch(() => {});
  const levels: SpeechAnalysis['level'][] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const nextLevel = levels[levels.indexOf(analysis.level) + 1];
  if (nextLevel) {
    await saveAssessmentInsights({
      ready: false,
      fromLevel: analysis.level,
      targetLevel: nextLevel,
      weaknesses: analysis.challenge ? [analysis.challenge] : [],
      evidence: 'Evaluación inicial de voz completada.',
      tip: analysis.tip,
    }).catch((error: unknown) => {
      console.warn('Could not cache initial assessment recommendations', error);
    });
  }
  return analysis;
};
