import { getSavedAssessmentInsights } from '@/lib/speech-analysis';
import { router, useFocusEffect } from 'expo-router';
import { createWeaknessExercise, getDailySimulations, type WeaknessExercise } from '@/lib/simulations';
import { useCallback, useState } from 'react';
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

type Item = { id: string; icon: string; title: string; subtitle: string };

function ItemCard({ item, onPress }: { item: Item; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.cardIconBox}>
        <Text style={styles.cardIcon}>{item.icon}</Text>
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

export default function PracticeScreen() {
  const activeTab = 'entrenar';
  const [weaknessExercises, setWeaknessExercises] = useState<WeaknessExercise[]>([]);
  const [weaknessesLoaded, setWeaknessesLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSavedAssessmentInsights()
        .then((insights) => {
          if (!active) return;
          setLoadError('');
          setWeaknessExercises(
            insights?.weaknesses.map((weakness, index) =>
              createWeaknessExercise(weakness, index)
            ) ?? []
          );
        })
        .catch((error: unknown) => {
          if (!active) return;
          setLoadError(
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar las debilidades de tu evaluación.'
          );
        })
        .finally(() => {
          if (active) setWeaknessesLoaded(true);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Entrenar</Text>
          <Text style={styles.streak}>🔥 7 días de racha</Text>
        </View>

        {/* WEAKNESSES */}
        <Text style={styles.sectionTitle}>Entrena tus debilidades</Text>
        {loadError ? <Text style={styles.emptyText}>{loadError}</Text> : null}
        {!weaknessesLoaded ? (
          <Text style={styles.emptyText}>Cargando las recomendaciones de tu evaluación…</Text>
        ) : weaknessExercises.length > 0 ? (
          <View style={styles.list}>
            {weaknessExercises.map((exercise) => (
              <ItemCard
                key={exercise.id}
                item={{
                  id: exercise.id,
                  icon: exercise.icon,
                  title: exercise.title,
                  subtitle: exercise.subtitle,
                }}
                onPress={() =>
                  router.push({
                    pathname: '/speak',
                    params: {
                      practice: 'true',
                      practiceTitle: exercise.title,
                      practiceSubtitle: exercise.subtitle,
                      practiceGreeting: exercise.greeting,
                      practiceScenario: exercise.scenario,
                    },
                  })
                }
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              Cuando completes una evaluación conversacional, aquí aparecerán ejercicios creados
              para tus debilidades.
            </Text>
            <TouchableOpacity onPress={() => router.push('/speak')}>
              <Text style={styles.emptyLink}>Hacer evaluación conversacional →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SIMULATIONS */}
        <Text style={[styles.sectionTitle, styles.sectionSpacing]}>Simulaciones</Text>
        <View style={styles.list}>
          {getDailySimulations().map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onPress={() => router.push({ pathname: '/speak', params: { topic: item.id } })}
            />
          ))}
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

  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#171923',
    marginRight: 12,
  },

  streak: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5B6472',
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#171923',
    marginBottom: 12,
  },

  sectionSpacing: {
    marginTop: 24,
  },

  emptyCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E6EB',
    backgroundColor: '#F7F9FF',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#5B6472',
  },
  emptyLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2F6BFF',
  },

  list: {
    gap: 12,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E6EB',
    padding: 14,
  },

  cardIconBox: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#EDF1FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  cardIcon: {
    fontSize: 28,
  },

  cardText: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#171923',
  },

  cardSubtitle: {
    fontSize: 13,
    color: '#5B6472',
    marginTop: 2,
  },

  chevron: {
    fontSize: 26,
    color: '#8A8F9C',
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
