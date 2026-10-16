import {
  ASSESSMENT_TURNS,
  sendVoiceTurn,
  type ChatTurn,
  type ConversationAssessment,
} from '@/lib/speak-chat';
import { findSimulation } from '@/lib/simulations';
import {
  getSavedLevel,
  LEVEL_NAMES,
  saveAssessmentInsights,
  saveAssessmentLevel,
  saveAssessmentScores,
  type SpeechAnalysis,
} from '@/lib/speech-analysis';
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
  } = useLocalSearchParams<{
    topic?: string;
    practice?: string;
    practiceTitle?: string;
    practiceSubtitle?: string;
    practiceGreeting?: string;
    practiceScenario?: string;
  }>();
  const practiceMode = practice === 'true';
  const simulation = findSimulation(topic);
  const exerciseGreeting = Array.isArray(practiceGreeting) ? practiceGreeting[0] : practiceGreeting;
  const exerciseScenario = Array.isArray(practiceScenario) ? practiceScenario[0] : practiceScenario;
  const exerciseTitle = Array.isArray(practiceTitle) ? practiceTitle[0] : practiceTitle;
  const exerciseSubtitle = Array.isArray(practiceSubtitle) ? practiceSubtitle[0] : practiceSubtitle;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const statusRef = useRef<Status>('idle');
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const greetingSpokenRef = useRef(false);

  const [level, setLevel] = useState<SpeechAnalysis['level'] | null>(null);
  const [levelLoaded, setLevelLoaded] = useState(false);
  const [assessment, setAssessment] = useState<ConversationAssessment | null>(null);
  const [assessmentTransition, setAssessmentTransition] = useState<{
    from: SpeechAnalysis['level'];
    to: SpeechAnalysis['level'];
  } | null>(null);
  const [savingLevel, setSavingLevel] = useState(false);
  const [levelConfirmed, setLevelConfirmed] = useState(false);
  const targetLevel = level ? LEVELS[LEVELS.indexOf(level) + 1] : undefined;
  const answeredTurns = messages.filter((message) => message.role === 'user').length;

  useEffect(() => {
    let active = true;
    getSavedLevel()
      .then((saved) => {
        if (!active) return;
        setLevel(saved);
        setLevelLoaded(true);
        if (!saved) setError('Completa primero la evaluación inicial para conocer tu nivel.');
        else if (saved !== 'C2') {
          const nextLevel = LEVELS[LEVELS.indexOf(saved) + 1];
          const opening = practiceMode
            ? exerciseGreeting ?? 'Let’s practice together. Tell me about something you did recently.'
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

  const speak = (text: string) => {
    updateStatus('speaking');
    Speech.speak(text, {
      language: 'en-US',
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
      recorder.record();
      updateStatus('listening');
      autoStopRef.current = setTimeout(() => {
        if (statusRef.current === 'listening') finishListening();
      }, MAX_RECORDING_MS);
    } catch {
      setError('No se pudo iniciar la grabación.');
      updateStatus('idle');
    }
  };

  const finishListening = async () => {
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
      const { userText, reply, assessment: finalAssessment } = await sendVoiceTurn(
        recorder.uri,
        messages,
        level,
        practiceMode ? exerciseScenario : simulation?.scenario,
        practiceMode ? 'practice' : 'assessment'
      );
      if (isFinalTurn && !finalAssessment) {
        throw new Error('La IA no completó la evaluación. Inténtalo de nuevo.');
      }
      let assessmentTarget: SpeechAnalysis['level'] | undefined;
      if (finalAssessment) {
        if (practiceMode || !targetLevel) {
          throw new Error('La IA devolvió una evaluación en un ejercicio de práctica.');
        }
        assessmentTarget = targetLevel;
      }
      setMessages((current) => [
        ...current,
        { role: 'user', text: userText },
        { role: 'ia', text: reply },
      ]);
      speak(reply);
      if (finalAssessment) {
        if (!assessmentTarget) throw new Error('No se pudo determinar el nivel objetivo.');
        setAssessment(finalAssessment);
        setAssessmentTransition({ from: level, to: assessmentTarget });
        Promise.all([
          saveAssessmentScores(finalAssessment.scores),
          saveAssessmentInsights({
            ...finalAssessment,
            fromLevel: level,
            targetLevel: assessmentTarget,
          }),
        ]).catch((saveError: unknown) => {
          setError(
            saveError instanceof Error
              ? `La evaluación terminó, pero no se pudieron guardar los resultados: ${saveError.message}`
              : 'La evaluación terminó, pero no se pudieron guardar los resultados.'
          );
        });
      }
    } catch (err) {
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

  const confirmLevel = async () => {
    if (!assessment?.ready || !targetLevel) return;
    setSavingLevel(true);
    setError('');
    try {
      await saveAssessmentLevel(targetLevel);
      setLevel(targetLevel);
      setLevelConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el nuevo nivel.');
    } finally {
      setSavingLevel(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Text style={styles.headerIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>
            {practiceMode ? exerciseTitle ?? 'Práctica personalizada' : simulation?.title ?? 'Evaluación de nivel'}
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
              {practiceMode ? 'Práctica personalizada' : 'Evaluación conversacional'}
            </Text>
            <Text style={styles.usageSubtitle}>
              {loading
                ? 'Cargando tu nivel…'
                : practiceMode
                  ? exerciseSubtitle ?? 'Practica la debilidad detectada por la IA'
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
              {assessment.ready ? '¡Estás preparado para avanzar!' : 'Sigue fortaleciendo tu inglés'}
            </Text>
            <Text style={styles.assessmentLevel}>
              Evaluación {assessmentTransition.from} → {assessmentTransition.to}
            </Text>
            <Text style={styles.assessmentSectionTitle}>Puntuaciones</Text>
            {([
              ['Conversación', assessment.scores.conversation],
              ['Pronunciación', assessment.scores.pronunciation],
              ['Gramática', assessment.scores.grammar],
              ['Comprensión', assessment.scores.comprehension],
              ['Respuesta', assessment.scores.response],
            ] as const).map(([label, score]) => (
              <View key={label} style={styles.assessmentScoreRow}>
                <Text style={styles.assessmentScoreLabel}>{label}</Text>
                <Text style={styles.assessmentScoreValue}>{score}/100</Text>
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
              Resultado orientativo; no sustituye una certificación oficial del MCER.
            </Text>
            {assessment.ready &&
              (levelConfirmed ? (
                <Text style={styles.confirmedText}>
                  Tu nivel ahora es {assessmentTransition.to} · {LEVEL_NAMES[assessmentTransition.to]}
                </Text>
              ) : (
                <TouchableOpacity
                  style={styles.noticeButton}
                  disabled={savingLevel}
                  onPress={confirmLevel}
                >
                  <Text style={styles.noticeButtonText}>
                    {savingLevel ? 'GUARDANDO…' : `ACTUALIZAR MI NIVEL A ${assessmentTransition.to}`}
                  </Text>
                </TouchableOpacity>
              ))}
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
            ? 'Cargando evaluación…'
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
