import {
  getSavedLevel,
  getSavedAssessmentInsights,
  getSavedScores,
  LEVEL_NAMES,
  type AssessmentInsights,
  type SpeechAnalysis,
} from '@/lib/speech-analysis';
import {
  fetchProgressSnapshot,
  getCachedProgressSnapshot,
  type ProgressSnapshot,
} from '@/lib/practice-progress';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  { key: 'response', icon: '🗨️', label: 'Respuesta', focus: 'la naturalidad de tus respuestas' },
  { key: 'pronunciation', icon: '🎤', label: 'Pronunciación', focus: 'tu pronunciación' },
  { key: 'grammar', icon: '📚', label: 'Gramática', focus: 'tu gramática' },
];

export default function ProgressScreen() {
  const activeTab = 'progreso';
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [level, setLevel] = useState<Level | null>(null);
  const [scores, setScores] = useState<Partial<Scores> | null>(null);
  const [insights, setInsights] = useState<AssessmentInsights | null>(null);
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);
  const [practiceProgressLoaded, setPracticeProgressLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const goalAssessmentStarted = useRef<Level | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoadError('');
      setPracticeProgressLoaded(false);
      Promise.all([
        fetchProgressSnapshot(),
        getSavedScores(),
      ]).then(([remoteSnapshot, cachedScores]) => {
        if (!active) return;
        setSnapshot(remoteSnapshot);
        setLevel(remoteSnapshot.currentLevel);
        const assessmentScores = remoteSnapshot.latestAssessment?.scores;
        setScores(assessmentScores ?? cachedScores);
        const latest = remoteSnapshot.latestAssessment;
        const recommendationLevel = remoteSnapshot.nextLevel;
        setInsights(
          latest && latest.assessment_type === 'progression' && latest.from_level && latest.to_level
            ? {
                ready: latest.recommendation === 'promote',
                fromLevel: latest.from_level,
                targetLevel: latest.to_level,
                weaknesses: latest.weaknesses,
                evidence: latest.evidence_summary,
                tip: latest.tip,
              }
            : latest?.assessment_type === 'initial' &&
                remoteSnapshot.currentLevel &&
                recommendationLevel
              ? {
                  ready: false,
                  fromLevel: remoteSnapshot.currentLevel,
                  targetLevel: recommendationLevel,
                  weaknesses: latest.weaknesses,
                  evidence: latest.evidence_summary,
                  tip: latest.tip,
                }
            : null
        );
        setPracticeProgressLoaded(true);
      }).catch((error: unknown) => {
        Promise.all([
          getCachedProgressSnapshot(),
          getSavedLevel().catch((levelError: unknown) => {
            console.warn('Could not load locally cached level', levelError);
            return null;
          }),
          getSavedScores(),
          getSavedAssessmentInsights().catch((cacheError: unknown) => {
            console.warn('Could not load cached assessment insights', cacheError);
            return null;
          }),
        ]).then(([cachedSnapshot, cachedLevel, cachedScores, cachedInsights]) => {
          if (!active) return;
          setSnapshot(cachedSnapshot);
          setLevel(cachedSnapshot?.currentLevel ?? cachedLevel);
          setScores(cachedSnapshot?.latestAssessment?.scores ?? cachedScores);
          setInsights(cachedInsights);
          setLoadError(
            `${error instanceof Error ? error.message : 'No se pudo cargar tu progreso.'}` +
              (cachedSnapshot ? ' Se muestran los últimos datos guardados en este dispositivo.' : '')
          );
          setPracticeProgressLoaded(true);
        });
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const next = snapshot
    ? snapshot.nextLevel ?? undefined
    : level
      ? LEVELS[LEVELS.indexOf(level) + 1]
      : undefined;
  const progress = snapshot?.progressPercent ?? 0;
  const transitionSeconds = snapshot?.transitionPracticeSeconds ?? 0;
  const targetHours = snapshot?.rule?.targetHours ?? 0;
  const practicedHours = transitionSeconds / 3600;
  const remainingHours = next
    ? Math.max(0, Math.ceil(targetHours - practicedHours))
    : 0;
  const latestAssessment = snapshot?.latestAssessment;
  const scoredSkills = SKILLS.filter((skill) => typeof scores?.[skill.key] === 'number');
  const weakest = scoredSkills.length
    ? scoredSkills.reduce((low, skill) =>
        (scores?.[skill.key] ?? 0) < (scores?.[low.key] ?? 0) ? skill : low
      )
    : null;

  useEffect(() => {
    if (
      practiceProgressLoaded &&
      !loadError &&
      level &&
      level !== 'C2' &&
      snapshot?.progressPercent === 100 &&
      latestAssessment?.recommendation !== 'continue' &&
      goalAssessmentStarted.current !== level
    ) {
      goalAssessmentStarted.current = level;
      router.push({
        pathname: '/speak',
        params: { practice: 'false', goalAssessment: 'true' },
      });
    }
  }, [level, snapshot, latestAssessment?.recommendation, practiceProgressLoaded, loadError]);

  const goalText = !level
    ? 'Haz tu evaluación de voz para conocer tu nivel y tus habilidades.'
    : next
      ? latestAssessment?.recommendation === 'continue'
        ? progress >= 100
          ? `Completaste las horas estimadas, pero necesitas reforzar ${weakest ? weakest.focus : 'algunas habilidades'} antes de avanzar a ${next}.`
          : `La evaluación recomienda reforzar ${weakest ? weakest.focus : 'algunas habilidades'} antes de avanzar a ${next}.`
        : latestAssessment?.recommendation === 'promote'
          ? `La IA recomienda otra evaluación comparable antes de confirmar tu avance a ${next}.`
          : `Para avanzar a ${next}, mejora especialmente ${weakest ? weakest.focus : 'tus habilidades'}.`
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
              <View style={styles.levelHeadings}>
                <Text style={styles.smallCaps}>NIVEL ACTUAL</Text>
                <Text style={styles.smallCaps}>PRÓXIMO NIVEL</Text>
              </View>
              <View style={styles.levelHeadings}>
                <Text style={styles.levelTitle}>
                  {level ? `${level} · ${LEVEL_NAMES[level]}` : 'Sin evaluar'}
                </Text>
                <Text style={styles.progressNext}>{next ?? '—'}</Text>
              </View>
              <Text style={styles.levelText}>
                {level
                  ? snapshot?.latestPromotion?.to_level === level
                    ? `¡Felicidades! Has avanzado de ${snapshot.latestPromotion.from_level} a ${level}.`
                    : latestAssessment?.recommendation === 'promote'
                      ? `La IA recomienda ${next}; falta una evaluación comparable para confirmar el ascenso.`
                      : insights && insights.targetLevel === next && !insights.ready
                        ? `Conservas ${level}. Sigue las recomendaciones personalizadas y practica para volver a intentarlo.`
                        : 'Practica para alcanzar la meta estimada y demostrar las competencias del siguiente nivel.'
                  : 'Aún no tienes un nivel. Haz la evaluación para obtenerlo.'}
              </Text>
            </View>
          </View>

          <View style={wide ? styles.dividerVertical : styles.divider} />

          <View style={wide && styles.colWide}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Horas de práctica</Text>
              <Text style={styles.progressNext}>
                {!next
                  ? '—'
                  : practiceProgressLoaded
                    ? snapshot
                      ? `${practicedHours.toFixed(2)} / ${targetHours} h`
                      : '—'
                    : 'Cargando…'}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressPercent}>
              {snapshot && next ? `${progress.toFixed(1)}%` : '—'}
            </Text>
            <Text style={styles.progressHint}>
              {!snapshot && loadError
                ? 'No se pudieron consultar las horas de práctica guardadas.'
                : !level
                ? 'Haz tu evaluación inicial para establecer tu nivel.'
                : next
                  ? progress >= 100
                    ? latestAssessment?.recommendation === 'continue'
                      ? 'Completaste las horas estimadas. Refuerza habilidades y vuelve a evaluar.'
                      : latestAssessment?.recommendation === 'promote'
                        ? 'La evaluación recomienda avanzar; falta confirmar con otra evaluación comparable.'
                        : 'Has completado las horas de práctica estimadas. Es momento de comprobar tus competencias.'
                    : `Restan aproximadamente ${remainingHours} h para el objetivo de ${targetHours} h · estimación ${snapshot?.rule?.minHours}–${snapshot?.rule?.maxHours} h`
                  : 'Has alcanzado el nivel máximo. Sigue practicando para mantenerlo.'}
            </Text>
            {snapshot ? (
              <Text style={styles.progressHint}>
                Total histórico: {(snapshot.totalPracticeSeconds / 3600).toFixed(2)} h
                {snapshot.rule
                  ? ` · rango orientativo ${snapshot.rule.minHours}–${snapshot.rule.maxHours} h`
                  : ''}
              </Text>
            ) : null}
          </View>

          <View style={wide ? styles.dividerVertical : styles.spacer} />

          <View style={[styles.goalCard, wide && styles.colWide]}>
            <Text style={styles.goalTitle}>🎯  Siguiente objetivo</Text>
            <Text style={styles.goalText}>{goalText}</Text>
            {next && insights && insights.targetLevel === next && (
              <View style={styles.recommendations}>
                <Text style={styles.recommendationsTitle}>
                  Recomendaciones de la IA ({insights.fromLevel} → {insights.targetLevel})
                </Text>
                {insights.weaknesses.map((weakness, index) => (
                  <Text key={`${index}-${weakness}`} style={styles.recommendationText}>
                    • {weakness}
                  </Text>
                ))}
                <Text style={styles.recommendationEvidence}>{insights.evidence}</Text>
                <Text style={styles.recommendationTip}>{insights.tip}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() =>
                router.push(!level ? '/evaluating' : snapshot && progress >= 100 ? '/speak' : '/practice')
              }
            >
              <Text style={styles.goalLink}>
                {!level
                  ? 'Hacer evaluación →'
                  : snapshot && progress >= 100
                    ? 'Comprobar competencias →'
                    : 'Ver recomendaciones →'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {!level && loadError ? <Text style={styles.loadError}>{loadError}</Text> : null}

        {/* SKILLS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📶  Tus habilidades</Text>
          <Text style={styles.sectionSubtitle}>
            Porcentajes de la última evaluación conversacional de la IA.
          </Text>

          <View style={[styles.skillsWrap, wide && styles.skillsWrapWide]}>
            {SKILLS.map((skill) => {
              const value = scores?.[skill.key];
              const hasScore = typeof value === 'number';
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
                      {hasScore ? value : '–'}
                      {hasScore ? <Text style={styles.skillMax}>/100</Text> : null}
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${hasScore ? value : 0}%` }]} />
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
  levelHeadings: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
    color: '#16A34A',
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
  recommendations: { gap: 5, marginTop: 4 },
  recommendationsTitle: { fontSize: 12, fontWeight: '800', color: '#2F6BFF' },
  recommendationText: { fontSize: 12, color: '#2B3558', lineHeight: 17 },
  recommendationEvidence: { fontSize: 11, color: '#5B6788', lineHeight: 16, marginTop: 2 },
  recommendationTip: { fontSize: 12, fontWeight: '700', color: '#2B3558', lineHeight: 17 },
  loadError: { fontSize: 12, color: '#D64545' },

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
