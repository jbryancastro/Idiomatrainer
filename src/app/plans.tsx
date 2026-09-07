import { router } from 'expo-router';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const FEATURES = [
  'Conversaciones ilimitadas',
  'Tutorial personalizado',
  'Análisis avanzado de voz',
  'Entrenamiento de debilidades',
  'Simulaciones reales',
  'Memoria de tu progreso',
  'Estadísticas avanzadas',
];

export default function PlansScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* BRAND NAME */}
        <Text style={styles.brand}>
          Lingo<Text style={styles.brandAccent}>FIT</Text>
        </Text>

        {/* TITLE */}
        <View style={styles.titleRow}>
          <Text style={styles.titleIcon}>⭐</Text>
          <Text style={styles.title}>ENTRENA SIN LÍMITES</Text>
        </View>

        {/* FEATURES */}
        <View style={styles.featuresList}>
          {FEATURES.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <View style={styles.checkCircle}>
                <Text style={styles.checkMark}>✓</Text>
              </View>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* PREMIUM CARD */}
        <View style={styles.premiumCard}>
          <View style={styles.premiumBadgeRow}>
            <Text style={styles.premiumBadgeIcon}>⭐</Text>
            <Text style={styles.premiumBadgeText}>PREMIUM</Text>
          </View>
          <Text style={styles.premiumPrice}>
            US$9.99 <Text style={styles.premiumPricePeriod}>/ mes</Text>
          </Text>
          <TouchableOpacity style={styles.premiumButton}>
            <Text style={styles.premiumButtonText}>COMENZAR PREMIUM</Text>
          </TouchableOpacity>
        </View>

        {/* FREE LINK */}
        <TouchableOpacity onPress={() => router.push('/')}>
          <Text style={styles.freeLink}>Continuar gratis</Text>
        </TouchableOpacity>

        {/* CANCEL NOTE */}
        <Text style={styles.cancelNote}>Cancela cuando quieras</Text>
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
    paddingTop: 32,
    paddingBottom: 32,
  },

  brand: {
    fontSize: 24,
    fontWeight: '800',
    color: '#171923',
    marginBottom: 24,
  },

  brandAccent: {
    color: '#2F6BFF',
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  titleIcon: {
    fontSize: 18,
    marginRight: 8,
  },

  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#171923',
    letterSpacing: 0.3,
  },

  featuresList: {
    width: '100%',
    gap: 16,
    marginBottom: 28,
  },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  checkMark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  featureText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#171923',
  },

  premiumCard: {
    width: '100%',
    backgroundColor: '#101B4C',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
  },

  premiumBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  premiumBadgeIcon: {
    fontSize: 14,
    marginRight: 6,
  },

  premiumBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFCE00',
    letterSpacing: 0.5,
  },

  premiumPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 16,
  },

  premiumPricePeriod: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C7CDEB',
  },

  premiumButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#FFCE00',
    justifyContent: 'center',
    alignItems: 'center',
  },

  premiumButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#101B4C',
    letterSpacing: 0.5,
  },

  freeLink: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2F6BFF',
    marginBottom: 8,
  },

  cancelNote: {
    fontSize: 12,
    color: '#8A8F9C',
  },
});
