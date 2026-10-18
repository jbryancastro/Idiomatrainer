import { getAccessToken } from '@/lib/auth';
import { blobToBase64, type SpeechAnalysis } from '@/lib/speech-analysis';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

export type ChatTurn = { role: 'user' | 'ia'; text: string };
type ConversationMode = 'assessment' | 'practice';

export const ASSESSMENT_TURNS = 5;

export type ConversationAssessment = {
  ready: boolean;
  promotionStatus: 'not_ready' | 'needs_confirmation' | 'promoted';
  estimatedLevel: SpeechAnalysis['level'];
  currentLevel: SpeechAnalysis['level'];
  targetLevel: SpeechAnalysis['level'];
  scores: Partial<SpeechAnalysis['scores']>;
  assessedSkills: (keyof SpeechAnalysis['scores'])[];
  skillEvidence: Partial<Record<keyof SpeechAnalysis['scores'], string>>;
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
    if (result.code === 'limit' || result.code === 'assessment_quota') {
      throw new QuestionLimitError(message);
    }
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
  scenario?: string,
  mode: ConversationMode = 'assessment',
  sessionId?: string
): Promise<{
  userText: string;
  reply: string;
  used: number;
  assessment?: ConversationAssessment;
  validPracticeSeconds?: number;
}> => {
  if (!sessionId) throw new Error('Inicia una sesión antes de enviar tu voz.');

  const blob = await (await fetch(uri)).blob();
  const mimeType = Platform.OS === 'web' && blob.type ? blob.type : 'audio/mp4';
  const audio = await blobToBase64(blob);

  const result = await callFunction({
    audio,
    mimeType: mimeType.split(';')[0],
    history: mode === 'practice' ? history : undefined,
    scenario,
    mode,
    practiceSessionId: mode === 'practice' ? sessionId : undefined,
    assessmentSessionId: mode === 'assessment' ? sessionId : undefined,
    requestId: mode === 'assessment' ? Crypto.randomUUID() : undefined,
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
    if (
      !isRecord(result.assessment) ||
      typeof result.assessment.ready !== 'boolean' ||
      !['not_ready', 'needs_confirmation', 'promoted'].includes(String(result.assessment.promotionStatus)) ||
      !isLevel(result.assessment.estimatedLevel) ||
      !isLevel(result.assessment.currentLevel) ||
      !isLevel(result.assessment.targetLevel)
    ) {
      throw new Error('La IA devolvió una evaluación inesperada.');
    }
    const scores = isRecord(result.assessment.scores) ? result.assessment.scores : {};
    const validateScore = (value: unknown) => {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100) {
        throw new Error('La IA devolvió puntuaciones inesperadas.');
      }
      return value;
    };
    const skillNames = ['conversation', 'pronunciation', 'grammar', 'comprehension', 'response'] as const;
    const validatedScores: Partial<SpeechAnalysis['scores']> = {};
    const skillEvidence: Partial<Record<keyof SpeechAnalysis['scores'], string>> = {};
    for (const skill of skillNames) {
      if (scores[skill] !== undefined) validatedScores[skill] = validateScore(scores[skill]);
      if (
        isRecord(result.assessment.skillEvidence) &&
        typeof result.assessment.skillEvidence[skill] === 'string'
      ) {
        skillEvidence[skill] = result.assessment.skillEvidence[skill];
      }
    }
    if (
      !Array.isArray(result.assessment.weaknesses) ||
      !result.assessment.weaknesses.every((item) => typeof item === 'string') ||
      typeof result.assessment.evidenceSummary !== 'string' ||
      !result.assessment.evidenceSummary.trim() ||
      typeof result.assessment.tip !== 'string' ||
      !result.assessment.tip.trim()
    ) {
      throw new Error('La IA devolvió comentarios de evaluación inesperados.');
    }
    assessment = {
      ready: result.assessment.ready,
      promotionStatus: result.assessment.promotionStatus as ConversationAssessment['promotionStatus'],
      estimatedLevel: result.assessment.estimatedLevel,
      currentLevel: result.assessment.currentLevel,
      targetLevel: result.assessment.targetLevel,
      scores: validatedScores,
      assessedSkills: Array.isArray(result.assessment.assessedSkills)
        ? result.assessment.assessedSkills.filter(
            (item): item is keyof SpeechAnalysis['scores'] => skillNames.includes(item as keyof SpeechAnalysis['scores'])
          )
        : [],
      skillEvidence,
      weaknesses: result.assessment.weaknesses,
      evidence: result.assessment.evidenceSummary,
      tip: result.assessment.tip,
    };
  }

  const validPracticeSeconds =
    typeof result.validPracticeSeconds === 'number' &&
    Number.isSafeInteger(result.validPracticeSeconds) &&
    result.validPracticeSeconds > 0
      ? result.validPracticeSeconds
      : undefined;
  if (mode === 'practice' && validPracticeSeconds === undefined) {
    throw new Error('La IA no confirmó el tiempo válido de práctica.');
  }

  return {
    userText: result.userText,
    reply: result.reply,
    used: result.used,
    assessment,
    validPracticeSeconds,
  };
};

const isLevel = (value: unknown): value is SpeechAnalysis['level'] =>
  typeof value === 'string' && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(value);
