import { clearSessionUser, getSessionUser } from '@/lib/auth';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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

type MenuItem = {
  id: string;
  icon: string;
  label: string;
  badge?: string;
  tag?: string;
};

const MENU: MenuItem[] = [
  { id: 'info', icon: '👤', label: 'Información personal' },
  { id: 'errores', icon: '🕘', label: 'Historial de errores', badge: '12' },
  { id: 'suscripcion', icon: '💳', label: 'Suscripción', tag: 'FREE' },
  { id: 'config', icon: '⚙️', label: 'Configuración' },
  { id: 'ayuda', icon: '❓', label: 'Ayuda y soporte' },
  { id: 'salir', icon: '🚪', label: 'Cerrar sesión' },
];

export default function AccountScreen() {
  const activeTab = 'perfil';
  const [userName, setUserName] = useState('');

  useEffect(() => {
    getSessionUser().then((user) => {
      if (user) setUserName(user.name);
    });
  }, []);

  const handleItemPress = async (id: string) => {
    if (id === 'salir') {
      await clearSessionUser();
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* NOMBRE */}
        <Text style={styles.name}>{userName || 'Usuario'}</Text>
        <Text style={styles.level}>Nivel B1</Text>

        {/* MENU */}
        <View style={styles.menu}>
          {MENU.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuRow}
              activeOpacity={0.7}
              onPress={() => handleItemPress(item.id)}
            >
              <Text style={styles.menuIcon}>{item.icon}</Text>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
              {item.tag && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{item.tag}</Text>
                </View>
              )}
              {item.id !== 'salir' && <Text style={styles.chevron}>›</Text>}
            </TouchableOpacity>
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
                if (!active) router.replace(tab.route);
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
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },

  name: {
    fontSize: 22,
    fontWeight: '800',
    color: '#171923',
  },

  level: {
    fontSize: 14,
    color: '#5B6472',
    marginTop: 2,
    marginBottom: 24,
  },

  menu: {
    width: '100%',
  },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F4',
  },

  menuIcon: {
    fontSize: 20,
    width: 36,
  },

  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#171923',
  },

  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    marginRight: 8,
  },

  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  tag: {
    borderWidth: 1,
    borderColor: '#D5D9E2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginRight: 8,
  },

  tagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#171923',
  },

  chevron: {
    fontSize: 24,
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
