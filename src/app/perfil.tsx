import { router } from 'expo-router';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SKILLS = [
  { id: 'conversacion', icon: '💬', label: 'Conversación', percent: 74 },
  { id: 'pronunciacion', icon: '🎙️', label: 'Pronunciación', percent: 82 },
  { id: 'gramatica', icon: '📚', label: 'Gramática', percent: 68 },
  { id: 'comprension', icon: '👂', label: 'Comprensión', percent: 79 },
  { id: 'respuesta', icon: '⚡', label: 'Respuesta', percent: 61 },
];

export default function ProfileScreen() {
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
        <Text style={styles.levelText}>B1</Text>
        <Text style={styles.levelSubtitle}>NIVEL INTERMEDIO</Text>

        {/* SKILLS */}
        <View style={styles.skillsList}>
          {SKILLS.map((skill) => (
            <View key={skill.id} style={styles.skillRow}>
              <Text style={styles.skillIcon}>{skill.icon}</Text>
              <Text style={styles.skillLabel}>{skill.label}</Text>
              <View style={styles.skillBarTrack}>
                <View style={[styles.skillBarFill, { width: `${skill.percent}%` }]} />
              </View>
              <Text style={styles.skillPercent}>{skill.percent}%</Text>
            </View>
          ))}
        </View>

        {/* CHALLENGE CARD */}
        <View style={styles.challengeCard}>
          <View style={styles.challengeHeaderRow}>
            <Text style={styles.challengeIcon}>🎯</Text>
            <Text style={styles.challengeTitle}>TU PRINCIPAL RETO</Text>
          </View>
          <Text style={styles.challengeQuote}>
            “Responder rápidamente durante una conversación.”
          </Text>
          <Text style={styles.challengeNote}>
            No te preocupes. LingoFIT entrenará esto contigo.
          </Text>
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
