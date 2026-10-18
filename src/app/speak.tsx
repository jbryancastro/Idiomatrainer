import {
  ASSESSMENT_TURNS,
  sendVoiceTurn,
  type ChatTurn,
  type ConversationAssessment,
} from '@/lib/speak-chat';
import { findSimulation } from '@/lib/simulations';
import { loadSettings } from '@/lib/settings';
import {
  getSavedLevel,
  LEVEL_NAMES,
  saveAssessmentInsights,
  type SpeechAnalysis,
} from '@/lib/speech-analysis';
import {
  cancelPracticeSession,
  fetchProgressSnapshot,
  startAssessmentSession,
  startPracticeSession,
} from '@/lib/practice-progress';
import {
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioRecorder,
} from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TABS = [
  { id: 'inicio', icon: '🏠', label: 'Home', route: '/home' },
  { id: 'hablar', icon: '💬', label: 'Speak', route: '/speak' },
  { id: 'entrenar', icon: '❗', label: 'Practice', route: '/practice' },
  { id: 'progreso', icon: '📊', label: 'Progress', route: '/progress' },
  { id: 'perfil', icon: '👤', label: 'Perfil', route: '/account' },
] as const;

const MAX_RECORDING_MS = 30_000;
const LEVELS: SpeechAnalysis['level'][] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const OPENING_QUESTIONS: Record<SpeechAnalysis['level'], string> = {
  A1: '',
  A2: 'Tell me about your daily routine and something you did last weekend.',
  B1: 'Describe an important experience you have had. What happened, and how did you feel?',
  B2: 'Describe a challenge you faced and explain how you handled it.',
  C1: 'Some people say technology makes life better but less personal. What is your view, and why?',
  C2: 'What does it mean to communicate effectively across cultures? Discuss nuances and give an example.',
};

type Status = 'idle' | 'listening' | 'thinking' | 'speaking';

const STATUS_LABELS: Record<Status, string> = {
  idle: 'Toca para hablar',
  listening: 'Te escucho… toca para enviar',
  thinking: 'Pensando…',
  speaking: 'Alex está hablando… toca para responder',
};

export default function SpeakScreen() {
  const activeTab = 'hablar';
  const {
    topic,
    practice,
    practiceTitle,
    practiceSubtitle,
    practiceGreeting,
    practiceScenario,
    goalAssessment,
  } = useLocalSearchParams<{
    topic?: string | string[];
    practice?: string | string[];
    practiceTitle?: string | string[];
    practiceSubtitle?: string | string[];
    practiceGreeting?: string | string[];
    practiceScenario?: string | string[];
    goalAssessment?: string | string[];
  }>();
  const firstParam = (value?: string | string[]) =>
    Array.isArray(value) ? value[0] : value;
  const practiceParam = firstParam(practice);
  const assessmentParam = firstParam(goalAssessment);
  const practiceMode = practiceParam === 'true' || assessmentParam !== 'true';
  const simulation = findSimulation(firstParam(topic));
  const exerciseGreeting = firstParam(practiceGreeting);
  const exerciseScenario = firstParam(practiceScenario);
  const exerciseTitle = firstParam(practiceTitle);
  const exerciseSubtitle = firstParam(practiceSubtitle);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const statusRef = useRef<Status>('idle');
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const greetingSpokenRef = useRef(false);
  const practiceSessionRef = useRef<string | null>(null);
  const assessmentSessionRef = useRef<string | null>(null);

  const [level, setLevel] = useState<SpeechAnalysis['level'] | null>(null);
  const [levelLoaded, setLevelLoaded] = useState(false);
  const [assessment, setAssessment] = useState<ConversationAssessment | null>(null);
  const [assessmentTransition, setAssessmentTransition] = useState<{
    from: SpeechAnalysis['level'];
    to: SpeechAnalysis['level'];
  } | null>(null);
  const targetLevel = level ? LEVELS[LEVELS.indexOf(level) + 1] : undefined;
  const answeredTurns = messages.filter((message) => message.role === 'user').length;

  useEffect(() => {
    let active = true;
    getSavedLevel()
      .then(async (saved) => {
        if (!saved) {
          if (active) {
            setLevel(null);
            setLevelLoaded(true);
            setError('Completa primero la evaluación inicial para conocer tu nivel.');
          }
          return;
        }
        let officialLevel = saved;
        if (!practiceMode && saved !== 'C2') {
          const session = await startAssessmentSession();
          assessmentSessionRef.current = session.assessmentSessionId;
          officialLevel = session.currentLevel;
        }
        if (!active) return;
        setLevel(officialLevel);
        setLevelLoaded(true);
        if (officialLevel !== 'C2') {
          const nextLevel = LEVELS[LEVELS.indexOf(officialLevel) + 1];
          const opening = practiceMode
            ? exerciseGreeting ??
              simulation?.greeting ??
              'Let’s practice together. Tell me about something you did recently.'
            : simulation?.greeting ?? OPENING_QUESTIONS[nextLevel];
          setMessages([{ role: 'ia', text: opening }]);
        } else {
          setMessages([
            {
              role: 'ia',
              text: practiceMode
                ? exerciseGreeting ?? 'Let’s practice together. What would you like to talk about?'
                : 'You have reached C2. Keep practicing to maintain your English.',
            },
          ]);
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'No se pudo cargar tu nivel.');
        setLevelLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [exerciseGreeting, practiceMode, simulation]);

  const updateStatus = (next: Status) => {
    statusRef.current = next;
    setStatus(next);
  };

  const speak = async (text: string) => {
    updateStatus('speaking');
    const { voiceAccent, speechRate } = await loadSettings();
    Speech.speak(text, {
      language: voiceAccent,
      rate: speechRate,
      onDone: () => {
        if (statusRef.current === 'speaking') updateStatus('idle');
      },
      onStopped: () => {
        if (statusRef.current === 'speaking') updateStatus('idle');
      },
      onError: () => {
        if (statusRef.current === 'speaking') updateStatus('idle');
      },
    });
  };

  const restartAssessment = async () => {
    setError('');
    try {
      const session = await startAssessmentSession();
      assessmentSessionRef.current = session.assessmentSessionId;
      setLevel(session.currentLevel);
      setAssessment(null);
      setAssessmentTransition(null);
      const opening = OPENING_QUESTIONS[session.targetLevel];
      setMessages([{ role: 'ia', text: opening }]);
      greetingSpokenRef.current = true;
      speak(opening);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar otra evaluación.');
    }
  };

  useEffect(() => {
    if (
      !levelLoaded ||
      !level ||
      (!targetLevel && !practiceMode) ||
      !messages.length ||
      greetingSpokenRef.current
    ) return;
    greetingSpokenRef.current = true;
    speak(messages[0].text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelLoaded, level, targetLevel, practiceMode, messages]);

  useEffect(
    () => () => {
      Speech.stop();
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (statusRef.current === 'listening') recorder.stop().catch(() => {});
      if (practiceSessionRef.current) {
        cancelPracticeSession(practiceSessionRef.current).catch((error: unknown) =>
          console.error('Could not cancel practice session', error)
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, status]);

  const startListening = async () => {
    setError('');
    await Speech.stop();
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Permite el acceso al micrófono para hablar con la IA.');
        updateStatus('idle');
        return;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      if (practiceMode) {
        const session = await startPracticeSession(
          simulation ? 'simulation' : exerciseTitle ? 'weakness' : 'conversation'
        );
        practiceSessionRef.current = session.practiceSessionId;
        setLevel(session.currentLevel);
      } else if (!assessmentSessionRef.current) {
        const session = await startAssessmentSession();
        assessmentSessionRef.current = session.assessmentSessionId;
        setLevel(session.currentLevel);
      }
      recorder.record();
      updateStatus('listening');
      autoStopRef.current = setTimeout(() => {
        if (statusRef.current === 'listening') finishListening();
      }, MAX_RECORDING_MS);
    } catch (err) {
      if (practiceSessionRef.current) {
        await cancelPracticeSession(practiceSessionRef.current).catch((error: unknown) =>
          console.error('Could not cancel practice session', error)
        );
        practiceSessionRef.current = null;
      }
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la grabación.');
      updateStatus('idle');
    }
  };

  const finishListening = async () => {
    if (statusRef.current !== 'listening') return;
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    updateStatus('thinking');
    try {
      await recorder.stop();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (!recorder.uri) throw new Error('No se pudo guardar la grabación.');

      const isFinalTurn = !practiceMode && answeredTurns === ASSESSMENT_TURNS - 1;
      if (!level || (!targetLevel && !practiceMode)) {
        throw new Error('No se pudo determinar tu nivel actual.');
      }
      const {
        userText,
        reply,
        assessment: finalAssessment,
      } = await sendVoiceTurn(
        recorder.uri,
        messages,
        practiceMode ? exerciseScenario ?? simulation?.scenario : simulation?.scenario,
        practiceMode ? 'practice' : 'assessment',
        practiceMode ? practiceSessionRef.current ?? undefined : assessmentSessionRef.current ?? undefined
      );
      if (practiceMode) practiceSessionRef.current = null;
      if (isFinalTurn && !finalAssessment) {
        throw new Error('La IA no completó la evaluación. Inténtalo de nuevo.');
      }
      let assessmentTarget: SpeechAnalysis['level'] | undefined;
      if (finalAssessment) {
        if (practiceMode) {
          throw new Error('La IA devolvió una evaluación en un ejercicio de práctica.');
        }
        assessmentTarget = finalAssessment.targetLevel;
      }
      setMessages((current) => [
        ...current,
        { role: 'user', text: userText },
        { role: 'ia', text: reply },
      ]);
      speak(reply);
      if (finalAssessment) {
        if (!assessmentTarget) throw new Error('No se pudo determinar el nivel objetivo.');
        assessmentSessionRef.current = null;
        setAssessment(finalAssessment);
        setAssessmentTransition({ from: finalAssessment.currentLevel, to: assessmentTarget });
        saveAssessmentInsights({
            ...finalAssessment,
            fromLevel: finalAssessment.currentLevel,
            targetLevel: assessmentTarget,
          }).catch((saveError: unknown) => {
          setError(
            saveError instanceof Error
              ? `La evaluación se guardó en Supabase, pero no se pudo actualizar la caché local: ${saveError.message}`
              : 'La evaluación se guardó en Supabase, pero no se pudo actualizar la caché local.'
          );
        });
        if (finalAssessment.ready) setLevel(assessmentTarget);
      }
      if (practiceMode) {
        try {
          const progress = await fetchProgressSnapshot();
          if (progress.progressPercent === 100 && level !== 'C2') {
            router.push({
              pathname: '/speak',
              params: { practice: 'false', goalAssessment: 'true' },
            });
            return;
          }
        } catch (progressError) {
          setError(
            progressError instanceof Error
              ? `La práctica se guardó, pero no se pudo actualizar la barra: ${progressError.message}`
              : 'La práctica se guardó, pero no se pudo actualizar la barra.'
          );
        }
      }
    } catch (err) {
      if (practiceSessionRef.current) {
        await cancelPracticeSession(practiceSessionRef.current).catch((cancelError: unknown) =>
          console.error('Could not cancel failed practice session', cancelError)
        );
        practiceSessionRef.current = null;
      }
      setError(err instanceof Error ? err.message : 'No se pudo obtener la respuesta.');
      updateStatus('idle');
    }
  };

  const handleMicPress = () => {
    if (status === 'thinking') return;
    if (status === 'listening') {
      finishListening();
      return;
    }
    if (!level || (!targetLevel && !practiceMode) || assessment) return;
    startListening();
  };

  const listening = status === 'listening';
  const loading = !levelLoaded;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Text style={styles.headerIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>
            {practiceMode
              ? exerciseTitle ?? simulation?.title ?? 'Conversación con IA'
              : simulation?.title ?? 'Evaluación de progreso'}
          </Text>
          <View style={styles.iaBadge}>
            <Text style={styles.iaBadgeText}>IA</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/progress')}>
          <Text style={styles.headerIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* ASSESSMENT PROGRESS */}
      <View style={styles.usageCard}>
        <View style={styles.usageHeader}>
          <View>
            <Text style={styles.usageTitle}>
              {practiceMode
                ? exerciseTitle
                  ? 'Práctica personalizada'
                  : simulation?.title ?? 'Conversación con IA'
                : 'Evaluación de progreso'}
            </Text>
            <Text style={styles.usageSubtitle}>
              {loading
                ? 'Cargando tu nivel…'
                : practiceMode
                  ? exerciseSubtitle ??
                    (exerciseTitle
                      ? 'Practica la debilidad detectada por la IA'
                      : simulation?.subtitle ?? 'Conversación abierta: practica a tu ritmo.')
                  : level && targetLevel
                  ? `Objetivo: ${level} → ${targetLevel}`
                  : level === 'C2'
                    ? 'Ya alcanzaste el nivel C2'
                    : 'Evaluación inicial requerida'}
            </Text>
          </View>
          <Text style={styles.usageIcon}>{practiceMode ? '🧩' : '🎯'}</Text>
        </View>
        {practiceMode ? (
          <Text style={styles.practiceHint}>
            {exerciseTitle
              ? `Ejercicio enfocado en: ${exerciseTitle}`
              : 'Conversación abierta: practica a tu ritmo.'}
          </Text>
        ) : (
          <>
            <View style={styles.usageRow}>
              <Text style={styles.usageLabel}>Respuestas completadas</Text>
              <Text style={styles.usageCount}>
                {Math.min(answeredTurns, ASSESSMENT_TURNS)} de {ASSESSMENT_TURNS}
              </Text>
            </View>
            <View style={styles.segments}>
              {Array.from({ length: ASSESSMENT_TURNS }, (_, i) => (
                <View key={i} style={[styles.segment, i < answeredTurns && styles.segmentFilled]} />
              ))}
            </View>
          </>
        )}
      </View>

      {!loading && !level && (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>
            Necesitamos una evaluación inicial para establecer tu nivel antes de medir tu avance.
          </Text>
          <TouchableOpacity style={styles.noticeButton} onPress={() => router.push('/evaluating')}>
            <Text style={styles.noticeButtonText}>HACER EVALUACIÓN INICIAL</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && level === 'C2' && (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>
            C2 es el nivel más alto del MCER. Puedes seguir practicando para mantener tu dominio.
          </Text>
        </View>
      )}

      {/* CHAT */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.chat}
      >
        {messages.map((message, index) =>
          message.role === 'ia' ? (
            <View key={index} style={styles.iaRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarEmoji}>👨🏽</Text>
              </View>
              <View style={styles.iaBubble}>
                <Text style={styles.iaText}>{message.text}</Text>
              </View>
            </View>
          ) : (
            <View key={index} style={styles.userRow}>
              <View style={styles.userBubble}>
                <Text style={styles.userText}>{message.text}</Text>
              </View>
            </View>
          )
        )}

        {assessment && assessmentTransition && (
          <View style={styles.assessmentCard}>
            <Text style={styles.assessmentTitle}>
              {assessment.ready
                ? `¡Felicidades! Has avanzado de ${assessmentTransition.from} a ${assessmentTransition.to}.`
                : assessment.promotionStatus === 'needs_confirmation'
                  ? 'La evaluación muestra preparación; falta una segunda evaluación comparable.'
                  : 'Sigue fortaleciendo tu inglés antes de avanzar.'}
            </Text>
            <Text style={styles.assessmentLevel}>
              Evaluación {assessmentTransition.from} → {assessmentTransition.to}
            </Text>
            <Text style={styles.assessmentSectionTitle}>Competencias con evidencia</Text>
            {([
              ['Conversación', assessment.scores.conversation],
              ['Pronunciación', assessment.scores.pronunciation],
              ['Gramática', assessment.scores.grammar],
              ['Comprensión', assessment.scores.comprehension],
              ['Respuesta', assessment.scores.response],
            ] as const).map(([label, score]) => (
              <View key={label} style={styles.assessmentScoreRow}>
                <Text style={styles.assessmentScoreLabel}>{label}</Text>
                <Text style={styles.assessmentScoreValue}>
                  {score === undefined ? 'Sin evidencia suficiente' : `${score}/100`}
                </Text>
              </View>
            ))}
            <Text style={styles.assessmentSectionTitle}>Lo que observó la IA</Text>
            <Text style={styles.assessmentBody}>{assessment.evidence}</Text>
            {assessment.weaknesses.length > 0 && (
              <>
                <Text style={styles.assessmentSectionTitle}>Aspectos por mejorar</Text>
                {assessment.weaknesses.map((weakness, index) => (
                  <Text key={`${index}-${weakness}`} style={styles.assessmentBody}>
                    • {weakness}
                  </Text>
                ))}
              </>
            )}
            <Text style={styles.assessmentTip}>{assessment.tip}</Text>
            <Text style={styles.assessmentDisclaimer}>
              Resultado orientativo; el ascenso se confirma y guarda únicamente en el servidor. No sustituye una certificación oficial del MCER.
            </Text>
            {assessment.ready ? (
              <Text style={styles.confirmedText}>
                Tu nivel confirmado es {assessmentTransition.to} · {LEVEL_NAMES[assessmentTransition.to]}
              </Text>
            ) : assessment.promotionStatus === 'needs_confirmation' ? (
              <TouchableOpacity style={styles.noticeButton} onPress={restartAssessment}>
                <Text style={styles.noticeButtonText}>INICIAR OTRA EVALUACIÓN COMPARABLE</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.noticeButton} onPress={() => router.push('/practice')}>
                <Text style={styles.noticeButtonText}>PRACTICAR Y VOLVER A EVALUAR</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* TYPING */}
        {status === 'thinking' && (
          <View style={styles.typingBubble}>
            <View style={styles.dot} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        )}
      </ScrollView>

      {/* MIC */}
      <View style={styles.micArea}>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
        <TouchableOpacity
          style={[styles.micOuter, listening && styles.micOuterActive]}
          activeOpacity={0.8}
          onPress={handleMicPress}
          disabled={
            status === 'thinking' ||
            loading ||
            !level ||
            (!targetLevel && !practiceMode) ||
            Boolean(assessment)
          }
        >
          <View style={[styles.micInner, listening && styles.micInnerActive]}>
            <Text style={styles.micIcon}>{listening ? '⏹️' : '🎙️'}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.micLabel}>
          {loading
            ? 'Cargando tu nivel…'
            : !level
              ? 'Completa primero la evaluación inicial'
              : !targetLevel && !practiceMode
                ? 'Nivel máximo alcanzado'
                : assessment
                  ? 'Evaluación completada'
                  : status === 'idle'
                    ? 'Toca para responder en inglés'
                    : STATUS_LABELS[status]}
        </Text>
      </View>

      {/* TAB BAR */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => {
                if (tab.route && !active) router.replace(tab.route);
              }}
            >
              <Text style={[styles.tabIcon, !active && styles.tabIconInactive]}>
                {tab.icon}
              </Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  headerButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerIcon: {
    fontSize: 20,
    color: '#171923',
  },

  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#171923',
  },

  iaBadge: {
    marginLeft: 6,
    backgroundColor: '#DDE6FF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },

  iaBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2F6BFF',
  },

  usageCard: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  usageTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  usageSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  usageIcon: { fontSize: 20 },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 8,
  },
  usageLabel: { fontSize: 13, fontWeight: '700', color: '#111827' },
  usageCount: { fontSize: 13, fontWeight: '700', color: '#2F6BFF' },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  segmentFilled: { backgroundColor: '#2F6BFF' },
  practiceHint: {
    marginTop: 12,
    fontSize: 12,
    lineHeight: 17,
    color: '#5B6472',
  },

  noticeCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F3F6FF',
    gap: 10,
  },
  noticeText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#3F4B63',
  },
  noticeButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#2F6BFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  noticeButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  chat: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 16,
  },

  iaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8EDFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  avatarEmoji: {
    fontSize: 22,
  },

  iaBubble: {
    maxWidth: '72%',
    backgroundColor: '#EDF1FF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  iaText: {
    fontSize: 15,
    lineHeight: 21,
    color: '#171923',
  },

  userBubble: {
    maxWidth: '72%',
    backgroundColor: '#2F6BFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  userText: {
    fontSize: 15,
    lineHeight: 21,
    color: '#FFFFFF',
  },

  assessmentCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#F4F7FF',
    gap: 8,
  },
  assessmentTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#171923',
  },
  assessmentLevel: {
    marginBottom: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  assessmentSectionTitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '800',
    color: '#171923',
  },
  assessmentScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E7F5',
  },
  assessmentScoreLabel: {
    fontSize: 13,
    color: '#3F4B63',
  },
  assessmentScoreValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#171923',
  },
  assessmentBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#3F4B63',
  },
  assessmentTip: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    color: '#2F6BFF',
  },
  assessmentDisclaimer: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 16,
    color: '#6B7280',
  },
  confirmedText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '800',
    color: '#16834A',
  },

  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginLeft: 50,
    backgroundColor: '#EDF1FF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#9AA7C7',
  },

  micArea: {
    alignItems: 'center',
    paddingVertical: 16,
  },

  micOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#DDE6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  micInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2F6BFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  micOuterActive: {
    backgroundColor: '#FFD9D9',
  },

  micInnerActive: {
    backgroundColor: '#E5484D',
  },

  errorText: {
    marginBottom: 10,
    paddingHorizontal: 24,
    textAlign: 'center',
    fontSize: 13,
    color: '#D64545',
  },

  micIcon: {
    fontSize: 28,
  },

  micLabel: {
    marginTop: 10,
    fontSize: 14,
    color: '#5B6472',
  },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E4E6EB',
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 8,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
  },

  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },

  tabIconInactive: {
    opacity: 0.45,
  },

  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A8F9C',
  },

  tabLabelActive: {
    color: '#2F6BFF',
  },
});
