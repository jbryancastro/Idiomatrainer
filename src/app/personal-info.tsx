import { getSessionUser } from '@/lib/auth';
import { getLearnerProfile, updateLearnerProfile, type LearnerProfile } from '@/lib/profile';
import {
  getSavedLevel,
  getSavedScores,
  LEVEL_NAMES,
  type SpeechAnalysis,
} from '@/lib/speech-analysis';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const NATIVE_LANGUAGES = ['Español', 'Portugués', 'Francés', 'Alemán', 'Italiano', 'Otro'];

type Scores = SpeechAnalysis['scores'];

const SKILLS: { label: string; key: keyof Scores | null }[] = [
  { label: 'Comprensión oral', key: 'comprehension' },
  { label: 'Pronunciación', key: 'pronunciation' },
  { label: 'Fluidez al hablar', key: 'conversation' },
  { label: 'Gramática', key: 'grammar' },
  { label: 'Comprensión de preguntas y respuestas', key: 'response' },
];

export default function PersonalInfoScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [fallbackLevel, setFallbackLevel] = useState<SpeechAnalysis['level'] | null>(null);
  const [fallbackScores, setFallbackScores] = useState<Scores | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        getSessionUser(),
        getLearnerProfile(),
        getSavedLevel().catch(() => null),
        getSavedScores(),
      ]).then(([user, learner, level, scores]) => {
        if (!active) return;
        setName(user?.name ?? '');
        setEmail(user?.email ?? '');
        setProfile(learner);
        setFallbackLevel(level);
        setFallbackScores(scores);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const selectNative = async (language: string) => {
    setProfile(await updateLearnerProfile({ nativeLanguage: language }));
  };

  const initialLevel = profile?.initialAssessment?.level ?? fallbackLevel;
  const initialScores = profile?.initialAssessment?.scores ?? fallbackScores;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Información personal</Text>

        <Text style={styles.section}>Cuenta</Text>
        <Row label="Nombre" value={name || 'Usuario'} />
        <Row label="Correo electrónico" value={email || 'Sin correo'} />

        <Text style={styles.section}>Idiomas</Text>
        <Row label="Idioma de aprendizaje" value={profile?.learningLanguage ?? 'Inglés'} />
        <Text style={styles.rowLabel}>Idioma nativo</Text>
        <View style={styles.chips}>
          {NATIVE_LANGUAGES.map((language) => {
            const selected = profile?.nativeLanguage === language;
            return (
              <TouchableOpacity
                key={language}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => selectNative(language)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {language}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.section}>Evaluación inicial</Text>
        <Row
          label="Nivel inicial estimado"
          value={
            initialLevel
              ? `${initialLevel} · ${LEVEL_NAMES[initialLevel]}`
              : 'Aún sin evaluar'
          }
        />
        {SKILLS.map((skill) => {
          const score = skill.key ? initialScores?.[skill.key] : undefined;
          return (
            <Row
              key={skill.label}
              label={skill.label}
              value={typeof score === 'number' ? `${score}%` : 'Sin evaluar'}
            />
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 24, color: '#171923' },
  title: { fontSize: 24, fontWeight: '800', color: '#171923', marginBottom: 8 },
  section: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2F6BFF',
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F4',
  },
  rowLabel: { fontSize: 15, color: '#5B6472', flexShrink: 1 },
  rowValue: { fontSize: 15, fontWeight: '700', color: '#171923', textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 12 },
  chip: {
    borderWidth: 1,
    borderColor: '#D5D9E2',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: '#2F6BFF', borderColor: '#2F6BFF' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#171923' },
  chipTextSelected: { color: '#FFFFFF' },
});
