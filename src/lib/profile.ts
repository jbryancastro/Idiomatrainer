import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessionUser } from '@/lib/auth';
import type { SpeechAnalysis } from '@/lib/speech-analysis';

export type InitialAssessment = {
  level: SpeechAnalysis['level'];
  scores: SpeechAnalysis['scores'];
};

export type LearnerProfile = {
  nativeLanguage: string;
  learningLanguage: string;
  initialAssessment: InitialAssessment | null;
};

const DEFAULT_PROFILE: LearnerProfile = {
  nativeLanguage: 'Español',
  learningLanguage: 'Inglés',
  initialAssessment: null,
};

const profileKey = async () => {
  const user = await getSessionUser();
  return `idiomatrainer.learner-profile.${user?.id ?? 'guest'}`;
};

export const getLearnerProfile = async (): Promise<LearnerProfile> => {
  try {
    const raw = await AsyncStorage.getItem(await profileKey());
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<LearnerProfile>) };
  } catch {
    return DEFAULT_PROFILE;
  }
};

export const updateLearnerProfile = async (changes: Partial<LearnerProfile>) => {
  const next = { ...(await getLearnerProfile()), ...changes };
  await AsyncStorage.setItem(await profileKey(), JSON.stringify(next));
  return next;
};
