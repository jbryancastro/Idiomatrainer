import { fetchQuestionsUsed, MAX_QUESTIONS, QuestionLimitError, sendVoiceTurn, type ChatTurn } from '@/lib/speak-chat';
import { findSimulation } from '@/lib/simulations';
import { getSavedLevel } from '@/lib/speech-analysis';
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

const DEFAULT_GREETING = "Hi! I'm Alex, your English tutor. How are you today?";
const MAX_RECORDING_MS = 30_000;

type Status = 'idle' | 'listening' | 'thinking' | 'speaking';

const STATUS_LABELS: Record<Status, string> = {
  idle: 'Toca para hablar',
  listening: 'Te escucho… toca para enviar',
  thinking: 'Pensando…',
  speaking: 'Alex está hablando… toca para responder',
};

export default function SpeakScreen() {
  const activeTab = 'hablar';
  const { topic } = useLocalSearchParams<{ topic?: string }>();
  const simulation = findSimulation(topic);
  const greeting = simulation?.greeting ?? DEFAULT_GREETING;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [messages, setMessages] = useState<ChatTurn[]>([{ role: 'ia', text: greeting }]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const statusRef = useRef<Status>('idle');
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [level, setLevel] = useState<string | null>(null);
  const [used, setUsed] = useState(0);
  const limitReached = used >= MAX_QUESTIONS;

  useEffect(() => {
    getSavedLevel().then(setLevel).catch(() => {});
    fetchQuestionsUsed().then(setUsed).catch(() => {});
  }, []);

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
    speak(greeting);
    return () => {
      Speech.stop();
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (statusRef.current === 'listening') recorder.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      const { userText, reply, used: serverUsed } = await sendVoiceTurn(
        recorder.uri,
        messages,
        simulation?.scenario
      );
      setMessages((current) => [
        ...current,
        { role: 'user', text: userText },
        { role: 'ia', text: reply },
      ]);
      speak(reply);
      setUsed(serverUsed);
    } catch (err) {
      if (err instanceof QuestionLimitError) setUsed(MAX_QUESTIONS);
      setError(err instanceof Error ? err.message : 'No se pudo obtener la respuesta.');
      updateStatus('idle');
    }
  };

  const handleMicPress = () => {
    if (status === 'thinking') return;
    if (limitReached && status !== 'listening') {
      Speech.stop();
      updateStatus('idle');
      setError(`Usaste tus ${MAX_QUESTIONS} preguntas de esta práctica, mejora el plan.`);
      return;
    }
    if (status === 'listening') finishListening();
    else startListening();
  };

  const listening = status === 'listening';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Text style={styles.headerIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>{simulation?.title ?? 'Conversación con IA'}</Text>
          <View style={styles.iaBadge}>
            <Text style={styles.iaBadgeText}>IA</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerButton}>
          <Text style={styles.headerIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* USAGE */}
      <View style={styles.usageCard}>
        <View style={styles.usageHeader}>
          <View>
            <Text style={styles.usageTitle}>Práctica de conversación</Text>
            <Text style={styles.usageSubtitle}>
              Tema: {simulation?.title ?? 'situaciones cotidianas'}
              {level ? ` · Nivel ${level}` : ''}
            </Text>
          </View>
          <Text style={styles.usageIcon}>💬</Text>
        </View>
        <View style={styles.usageRow}>
          <Text style={styles.usageLabel}>Preguntas utilizadas</Text>
          <Text style={styles.usageCount}>
            {Math.min(used, MAX_QUESTIONS)} de {MAX_QUESTIONS}
          </Text>
        </View>
        <View style={styles.segments}>
          {Array.from({ length: MAX_QUESTIONS }, (_, i) => (
            <View key={i} style={[styles.segment, i < used && styles.segmentFilled]} />
          ))}
        </View>
      </View>

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
        {error && limitReached ? (
          <TouchableOpacity onPress={() => router.push('/plans')}>
            <Text style={[styles.errorText, styles.upgradeLink]}>{error}</Text>
          </TouchableOpacity>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
        <TouchableOpacity
          style={[styles.micOuter, listening && styles.micOuterActive]}
          activeOpacity={0.8}
          onPress={handleMicPress}
          disabled={status === 'thinking'}
        >
          <View style={[styles.micInner, listening && styles.micInnerActive]}>
            <Text style={styles.micIcon}>{listening ? '⏹️' : '🎙️'}</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.micLabel}>{STATUS_LABELS[status]}</Text>
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

  upgradeLink: {
    textDecorationLine: 'underline',
    fontWeight: '700',
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
