import { router } from 'expo-router';
import { getDailySimulations } from '@/lib/simulations';
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

const WEAKNESSES = [
  { id: 'rapido', icon: '🎯', title: 'Responder rápidamente', subtitle: '11 ejercicios' },
  { id: 'pasado', icon: '📘', title: 'Pasado simple', subtitle: '8 ejercicios' },
  { id: 'preposiciones', icon: '🧩', title: 'Preposiciones', subtitle: '6 ejercicios' },
];

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
        <View style={styles.list}>
          {WEAKNESSES.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </View>

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
