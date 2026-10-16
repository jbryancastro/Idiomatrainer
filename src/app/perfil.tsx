import { analyzeRecording, type SpeechAnalysis } from '@/lib/speech-analysis';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LEVEL_LABELS: Record<SpeechAnalysis['level'], string> = {
  A1: 'NIVEL PRINCIPIANTE',
  A2: 'NIVEL BÁSICO',
  B1: 'NIVEL INTERMEDIO',
  B2: 'NIVEL INTERMEDIO ALTO',
  C1: 'NIVEL AVANZADO',
  C2: 'NIVEL DE DOMINIO',
};

const SKILLS: Array<{
  id: keyof SpeechAnalysis['scores'];
  icon: string;
  label: string;
}> = [
  { id: 'conversation', icon: '💬', label: 'Conversación' },
  { id: 'pronunciation', icon: '🎙️', label: 'Pronunciación' },
  { id: 'grammar', icon: '📚', label: 'Gramática' },
  { id: 'comprehension', icon: '👂', label: 'Comprensión' },
  { id: 'response', icon: '⚡', label: 'Respuesta' },
];

export default function ProfileScreen() {
  const { uri } = useLocalSearchParams<{ uri?: string }>();
  const [analysis, setAnalysis] = useState<SpeechAnalysis | null>(null);
  const [error, setError] = useState(uri ? '' : 'No hay una grabación para analizar.');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    setAnalysis(null);
    setError('');

    analyzeRecording(uri)
      .then((result) => {
        if (!cancelled) setAnalysis(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo analizar la grabación.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [uri, attempt]);

  if (!analysis) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.statusContainer}>
          {error ? (
            <>
              <Text style={styles.statusIcon}>😕</Text>
              <Text style={styles.statusTitle}>No pudimos analizar tu voz</Text>
              <Text style={styles.statusText}>{error}</Text>
              {uri && (
                <TouchableOpacity
                  style={styles.startButton}
                  onPress={() => setAttempt((prev) => prev + 1)}
                >
                  <Text style={styles.startButtonText}>REINTENTAR</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.replace('/evaluating')}
              >
                <Text style={styles.secondaryButtonText}>VOLVER A GRABAR</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#2F6BFF" />
              <Text style={styles.statusTitle}>Analizando tu voz con IA…</Text>
              <Text style={styles.statusText}>Esto puede tardar unos segundos.</Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* PROGRESS BAR */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
          <Text style={styles.progressLabel}>5/5</Text>
        </View>

        {/* HEADER */}
        <View style={styles.headerRow}>
          <Text style={styles.headerIcon}>🎉</Text>
          <Text style={styles.headerTitle}>TU PERFIL ESTÁ LISTO</Text>
        </View>

        {/* LEVEL */}
        <Text style={styles.levelText}>{analysis.level}</Text>
        <Text style={styles.levelSubtitle}>{LEVEL_LABELS[analysis.level]}</Text>

        {/* SKILLS */}
        <View style={styles.skillsList}>
          {SKILLS.map((skill) => {
            const percent = analysis.scores[skill.id];
            return (
              <View key={skill.id} style={styles.skillRow}>
                <Text style={styles.skillIcon}>{skill.icon}</Text>
                <Text style={styles.skillLabel}>{skill.label}</Text>
                <View style={styles.skillBarTrack}>
                  <View style={[styles.skillBarFill, { width: `${percent}%` }]} />
                </View>
                <Text style={styles.skillPercent}>{percent}%</Text>
              </View>
            );
          })}
        </View>

        {/* CHALLENGE CARD */}
        <View style={styles.challengeCard}>
          <View style={styles.challengeHeaderRow}>
            <Text style={styles.challengeIcon}>🎯</Text>
            <Text style={styles.challengeTitle}>TU PRINCIPAL RETO</Text>
          </View>
          <Text style={styles.challengeQuote}>“{analysis.challenge}”</Text>
          <Text style={styles.challengeNote}>{analysis.tip}</Text>
        </View>

        {/* START BUTTON */}
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => router.push('/plans')}
        >
          <Text style={styles.startButtonText}>COMENZAR</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statusContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },

  statusIcon: {
    fontSize: 48,
  },

  statusTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#171923',
    textAlign: 'center',
  },

  statusText: {
    fontSize: 14,
    color: '#5B6472',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
  },

  secondaryButton: {
    width: '100%',
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2F6BFF',
    letterSpacing: 0.5,
  },

  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 32,
  },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 28,
  },

  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E4E6EB',
    overflow: 'hidden',
    marginRight: 12,
  },

  progressFill: {
    width: '100%',
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#2F6BFF',
  },

  progressLabel: {
    fontSize: 13,
    color: '#8A8F9C',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  headerIcon: {
    fontSize: 18,
    marginRight: 8,
  },

  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2F6BFF',
    letterSpacing: 0.3,
  },

  levelText: {
    fontSize: 56,
    fontWeight: '800',
    color: '#2F6BFF',
  },

  levelSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8A8F9C',
    letterSpacing: 0.5,
    marginBottom: 28,
  },

  skillsList: {
    width: '100%',
    gap: 16,
    marginBottom: 24,
  },

  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  skillIcon: {
    fontSize: 18,
    width: 26,
  },

  skillLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#171923',
    width: 100,
  },

  skillBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E4E6EB',
    overflow: 'hidden',
    marginRight: 10,
  },

  skillBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#2F6BFF',
  },

  skillPercent: {
    fontSize: 13,
    fontWeight: '700',
    color: '#171923',
    width: 36,
    textAlign: 'right',
  },

  challengeCard: {
    width: '100%',
    backgroundColor: '#EDF1FF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },

  challengeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  challengeIcon: {
    fontSize: 16,
    marginRight: 8,
  },

  challengeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2F6BFF',
    letterSpacing: 0.3,
  },

  challengeQuote: {
    fontSize: 15,
    fontWeight: '700',
    color: '#171923',
    lineHeight: 22,
    marginBottom: 10,
  },

  challengeNote: {
    fontSize: 13,
    color: '#5B6472',
    lineHeight: 18,
  },

  startButton: {
    width: '100%',
    height: 54,
    borderRadius: 14,
    backgroundColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  startButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
