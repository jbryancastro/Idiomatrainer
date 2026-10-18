import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken, getSessionUser } from '@/lib/auth';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export type ProgressLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type ProgressSnapshot = {
  currentLevel: ProgressLevel | null;
  nextLevel: ProgressLevel | null;
  totalPracticeSeconds: number;
  transitionPracticeSeconds: number;
  progressPercent: number | null;
  rule: {
    minHours: number;
    targetHours: number;
    maxHours: number;
    criteria: {
      requiredConsecutiveReadyAssessments: number;
      requiredEvidenceSkills: string[];
      descriptor: string;
    };
  } | null;
  latestAssessment: {
    id: string;
    assessment_type: 'initial' | 'progression';
    from_level: ProgressLevel | null;
    to_level: ProgressLevel | null;
    estimated_level: ProgressLevel;
    recommendation: 'promote' | 'continue' | 'baseline';
    scores: Partial<Record<'conversation' | 'comprehension' | 'response' | 'pronunciation' | 'grammar', number>>;
    weaknesses: string[];
    evidence_summary: string;
    tip: string;
    created_at: string;
  } | null;
  latestPromotion: {
    from_level: ProgressLevel;
    to_level: ProgressLevel;
    promoted_at: string;
  } | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const callProgression = async (payload: Record<string, unknown>) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Configura EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY en .env.local.');
  }
  const token = await getAccessToken();
  if (!token) throw new Error('Vuelve a iniciar sesión para cargar tu progreso.');

  const response = await fetch(`${supabaseUrl}/functions/v1/speak-chat`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!isRecord(result)) throw new Error('Supabase devolvió un progreso inesperado.');
  if (!response.ok) {
    throw new Error(
      typeof result.error === 'string' ? result.error : 'No se pudo cargar tu progreso.'
    );
  }
  return result;
};

const isLevel = (value: unknown): value is ProgressLevel =>
  typeof value === 'string' && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(value);

const isProgressSnapshot = (value: Record<string, unknown>): value is Record<string, unknown> & ProgressSnapshot =>
  (value.currentLevel === null || isLevel(value.currentLevel)) &&
  (value.nextLevel === null || isLevel(value.nextLevel)) &&
  typeof value.totalPracticeSeconds === 'number' &&
  Number.isSafeInteger(value.totalPracticeSeconds) &&
  typeof value.transitionPracticeSeconds === 'number' &&
  Number.isSafeInteger(value.transitionPracticeSeconds) &&
  (value.progressPercent === null ||
    (typeof value.progressPercent === 'number' &&
      Number.isFinite(value.progressPercent) &&
      value.progressPercent >= 0 &&
      value.progressPercent <= 100));

const progressCacheKey = async () => {
  const user = await getSessionUser();
  return user ? `idiomatrainer.progress.${user.id}` : null;
};

export const fetchProgressSnapshot = async (): Promise<ProgressSnapshot> => {
  const result = await callProgression({ action: 'progress' });
  if (!isProgressSnapshot(result)) {
    throw new Error('Supabase devolvió un progreso inválido.');
  }
  const key = await progressCacheKey();
  if (key) {
    await AsyncStorage.setItem(key, JSON.stringify(result)).catch((error: unknown) =>
      console.warn('Could not cache progression snapshot', error)
    );
  }
  return result;
};

export const getCachedProgressSnapshot = async (): Promise<ProgressSnapshot | null> => {
  try {
    const key = await progressCacheKey();
    if (!key) return null;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    return isRecord(value) && isProgressSnapshot(value) ? value : null;
  } catch (error) {
    console.warn('Could not read cached progression snapshot', error);
    return null;
  }
};

export const startPracticeSession = async (
  origin: 'weakness' | 'simulation' | 'conversation'
): Promise<{ practiceSessionId: string; currentLevel: ProgressLevel }> => {
  const result = await callProgression({ action: 'start-practice-session', origin });
  if (typeof result.practiceSessionId !== 'string' || !isLevel(result.currentLevel)) {
    throw new Error('No se pudo iniciar la sesión de práctica.');
  }
  return { practiceSessionId: result.practiceSessionId, currentLevel: result.currentLevel };
};

export const cancelPracticeSession = async (practiceSessionId: string) => {
  await callProgression({ action: 'cancel-practice-session', practiceSessionId });
};

export const startAssessmentSession = async (): Promise<{
  assessmentSessionId: string;
  currentLevel: ProgressLevel;
  targetLevel: ProgressLevel;
}> => {
  const result = await callProgression({ action: 'start-assessment-session' });
  if (
    typeof result.assessmentSessionId !== 'string' ||
    !isLevel(result.currentLevel) ||
    !isLevel(result.targetLevel)
  ) {
    throw new Error('No se pudo iniciar la evaluación de progreso.');
  }
  return {
    assessmentSessionId: result.assessmentSessionId,
    currentLevel: result.currentLevel,
    targetLevel: result.targetLevel,
  };
};
