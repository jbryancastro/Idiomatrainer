import {
  getSavedLevel,
  getSavedScores,
  LEVEL_NAMES,
  type SpeechAnalysis,
} from '@/lib/speech-analysis';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TABS = [
  { id: 'inicio', icon: '🏠', label: 'Home', route: '/home' },
  { id: 'hablar', icon: '💬', label: 'Speak', route: '/speak' },
  { id: 'entrenar', icon: '❗', label: 'Practice', route: '/practice' },
  { id: 'progreso', icon: '📊', label: 'Progress', route: '/progress' },
  { id: 'perfil', icon: '👤', label: 'Perfil', route: '/account' },
] as const;

type Level = SpeechAnalysis['level'];
type Scores = SpeechAnalysis['scores'];

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const SKILLS: { key: keyof Scores; icon: string; label: string; focus: string }[] = [
  { key: 'conversation', icon: '💬', label: 'Fluidez', focus: 'tu fluidez' },
  { key: 'comprehension', icon: '👂', label: 'Comprensión', focus: 'tu comprensión' },
  { key: 'response', icon: '🗨️', label: 'Vocabulario', focus: 'tu vocabulario' },
  { key: 'pronunciation', icon: '🎤', label: 'Pronunciación', focus: 'tu pronunciación' },
];

const average = (scores: Scores) => {
  const values = SKILLS.map((skill) => scores[skill.key]);
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
};

export default function ProgressScreen() {
  const activeTab = 'progreso';
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [level, setLevel] = useState<Level | null>(null);
  const [scores, setScores] = useState<Scores | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSavedLevel()
        .then((saved) => active && setLevel(saved))
        .catch(() => {});
      getSavedScores().then((saved) => active && setScores(saved));
      return () => {
        active = false;
      };
    }, [])
  );

  const next = level ? LEVELS[LEVELS.indexOf(level) + 1] : undefined;
  const progress = scores ? average(scores) : 0;
  const weakest = scores
    ? SKILLS.reduce((low, skill) => (scores[skill.key] < scores[low.key] ? skill : low))
    : null;

  const goalText = !level
    ? 'Haz tu evaluación de voz para conocer tu nivel y tus habilidades.'
    : next
      ? `Para avanzar a ${next}, mejora especialmente ${weakest ? weakest.focus : 'tu vocabulario y pronunciación'}.`
      : 'Has alcanzado el nivel más alto. ¡Sigue practicando para mantenerlo!';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        {/* HEADER */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>📊  Tu progreso</Text>
        </View>
        <Text style={styles.subtitle}>
          Revisa tu nivel, tus habilidades y sigue las recomendaciones de la IA para alcanzar tus objetivos.
        </Text>

        {/* LEVEL */}
        <View style={[styles.card, wide && styles.levelCardWide]}>
          <View style={[styles.levelRow, wide && styles.colWide]}>
            <View style={styles.badge}>
              <Text style={styles.badgeStar}>★</Text>
              <Text style={styles.badgeText}>{level ?? '?'}</Text>
            </View>
            <View style={styles.levelInfo}>
              <Text style={styles.smallCaps}>TU NIVEL ACTUAL</Text>
              <Text style={styles.levelTitle}>
                {level ? `${level} · ${LEVEL_NAMES[level]}` : 'Sin evaluar'}
              </Text>
              <Text style={styles.levelText}>
                {level
                  ? 'Tienes una buena base. Ahora la IA te ayudará a fortalecer tus habilidades para avanzar al siguiente nivel.'
                  : 'Aún no tienes un nivel. Haz la evaluación para obtenerlo.'}
              </Text>
            </View>
          </View>

          <View style={wide ? styles.dividerVertical : styles.divider} />

          <View style={wide && styles.colWide}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progreso hacia el siguiente nivel</Text>
              <Text style={styles.progressNext}>{next ?? level ?? ''}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressPercent}>{progress}%</Text>
            <Text style={styles.progressHint}>
              {next
                ? `Necesitas completar las evaluaciones de las habilidades clave para desbloquear ${next}.`
                : 'Mantén tus habilidades practicando con la IA.'}
            </Text>
          </View>

          <View style={wide ? styles.dividerVertical : styles.spacer} />

          <View style={[styles.goalCard, wide && styles.colWide]}>
            <Text style={styles.goalTitle}>🎯  Siguiente objetivo</Text>
            <Text style={styles.goalText}>{goalText}</Text>
            <TouchableOpacity onPress={() => router.push(level ? '/practice' : '/evaluating')}>
              <Text style={styles.goalLink}>
                {level ? 'Ver recomendaciones →' : 'Hacer evaluación →'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SKILLS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📶  Tus habilidades</Text>
          <Text style={styles.sectionSubtitle}>
            Cada habilidad se evalúa en base a tus conversaciones con la IA.
          </Text>

          <View style={[styles.skillsWrap, wide && styles.skillsWrapWide]}>
            {SKILLS.map((skill) => {
              const value = scores?.[skill.key] ?? 0;
              return (
                <View key={skill.key} style={[styles.skillCard, wide && styles.skillCardWide]}>
                  <View style={styles.skillHeader}>
                    <View style={styles.skillIconBox}>
                      <Text style={styles.skillIcon}>{skill.icon}</Text>
                    </View>
                    <Text style={styles.skillName} numberOfLines={1}>
                      {skill.label}
                    </Text>
                    <Text style={styles.skillScore}>
                      {scores ? value : '–'}
                      <Text style={styles.skillMax}>/100</Text>
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${value}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* TAB BAR */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => {
                if (!active) router.replace(tab.route);
              }}
            >
              <Text style={[styles.tabIcon, !active && styles.tabIconInactive]}>{tab.icon}</Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F7F9FF' },
  container: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24, gap: 14 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F1B4C' },
  periodButton: {
    borderWidth: 1,
    borderColor: '#DCE4F5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  subtitle: { fontSize: 13, color: '#5B6788', lineHeight: 18 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E1E9FA',
    padding: 16,
  },

  levelCardWide: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  colWide: { flex: 1 },
  dividerVertical: { width: 1, alignSelf: 'stretch', backgroundColor: '#E1E9FA', marginHorizontal: 24 },
  spacer: { height: 16 },
  badgeStar: { fontSize: 12, color: '#FFFFFF', position: 'absolute', bottom: 8 },

  skillsWrap: { gap: 10 },
  skillsWrapWide: { flexDirection: 'row' },
  skillCardWide: { flex: 1, marginBottom: 0 },
  skillIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#E6EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillIcon: { fontSize: 16 },

  levelRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  badge: {
    width: 76,
    height: 86,
    borderRadius: 18,
    backgroundColor: '#DCE8FF',
    borderWidth: 2,
    borderColor: '#B9D0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 26, fontWeight: '900', color: '#2F6BFF' },
  levelInfo: { flex: 1 },
  smallCaps: { fontSize: 10, fontWeight: '700', color: '#5B6788', letterSpacing: 0.5 },
  levelTitle: { fontSize: 22, fontWeight: '900', color: '#0F1B4C', marginVertical: 4 },
  levelText: { fontSize: 12, color: '#5B6788', lineHeight: 17 },

  divider: { height: 1, backgroundColor: '#E1E9FA', marginVertical: 16 },

  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 13, fontWeight: '700', color: '#0F1B4C' },
  progressNext: { fontSize: 13, fontWeight: '800', color: '#0F1B4C' },
  track: { height: 10, borderRadius: 5, backgroundColor: '#E6EEFF', overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%', borderRadius: 5, backgroundColor: '#2F6BFF' },
  progressPercent: {
    alignSelf: 'flex-end',
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
    color: '#2F6BFF',
  },
  progressHint: { fontSize: 11, color: '#5B6788', marginTop: 2 },

  goalCard: {
    backgroundColor: '#EAF1FF',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  goalTitle: { fontSize: 13, fontWeight: '800', color: '#2F6BFF' },
  goalText: { fontSize: 12, color: '#2B3558', lineHeight: 17 },
  goalLink: { fontSize: 12, fontWeight: '800', color: '#2F6BFF', marginTop: 4 },

  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F1B4C' },
  sectionSubtitle: { fontSize: 12, color: '#5B6788', marginTop: 4, marginBottom: 12 },
  skillCard: {
    borderWidth: 1,
    borderColor: '#E1E9FA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  skillHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skillName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F1B4C' },
  skillScore: { fontSize: 14, fontWeight: '800', color: '#0F1B4C' },
  skillMax: { fontSize: 11, fontWeight: '500', color: '#5B6788' },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E4E6EB',
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 8,
  },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 20, marginBottom: 2 },
  tabIconInactive: { opacity: 0.45 },
  tabLabel: { fontSize: 11, fontWeight: '600', color: '#8A8F9C' },
  tabLabelActive: { color: '#2F6BFF' },
});
