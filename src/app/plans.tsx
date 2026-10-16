import { router } from 'expo-router';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const BASIC_FEATURES = [
  'Hasta 5 preguntas de la IA por conversación.',
  'Temas cotidianos',
  'Correcciones básicas',
  'Objetivo diario y resumen de progreso',
];

const PREMIUM_FEATURES = [
  'Conversación ilimitada con la IA.',
  'Práctica personalizada por nivel',
  'Seguimiento de errores anteriores.',
  'Simulaciones de entrevistas laborales.',
  'Ejercicios de pronunciación.',
  'Plan de mejora adaptativo.',
];

function FeatureList({ features }: { features: string[] }) {
  return (
    <View style={styles.featuresList}>
      {features.map((feature) => (
        <View key={feature} style={styles.featureRow}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.featureText}>{feature}</Text>
        </View>
      ))}
    </View>
  );
}

export default function PlansScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* TITLE */}
        <View style={styles.titleRow}>
          <Text style={styles.titleIcon}>⭐</Text>
          <Text style={styles.title}>PLANES Y FUNCIONES</Text>
        </View>
        <Text style={styles.subtitle}>
          Elige el plan que mejor se adapte a tus objetivos y lleva tu inglés al siguiente nivel.
        </Text>

        <View style={styles.cardsRow}>
          {/* BASIC CARD */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.planPill}>
                <Text style={styles.planPillIcon}>🌱</Text>
                <Text style={styles.planPillText}>Básico</Text>
              </View>
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>Gratis</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>5 preguntas por sesión</Text>
            <FeatureList features={BASIC_FEATURES} />
          </View>

          {/* PREMIUM CARD */}
          <View style={[styles.card, styles.cardPremium]}>
            <View style={styles.cardHeader}>
              <View style={styles.planPill}>
                <Text style={styles.planPillIcon}>👑</Text>
                <Text style={styles.planPillText}>Premium</Text>
              </View>
              <View style={styles.moreBadge}>
                <Text style={styles.moreBadgeText}>Más posibilidades</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>Conversación ilimitadas por sesión</Text>
            <FeatureList features={PREMIUM_FEATURES} />
          </View>
        </View>

        {/* PREMIUM PRICE */}
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },

  titleIcon: {
    fontSize: 20,
    marginRight: 8,
  },

  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#101B4C',
  },

  subtitle: {
    fontSize: 13,
    color: '#5B6472',
    lineHeight: 19,
    marginBottom: 18,
  },

  cardsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginBottom: 14,
  },

  card: {
    flex: 1,
    backgroundColor: '#F4F8FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE6FB',
    padding: 12,
  },

  cardPremium: {
    backgroundColor: '#EFF5FF',
    borderWidth: 1.5,
    borderColor: '#2F6BFF',
  },

  cardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 10,
  },

  planPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DDE8FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },

  planPillIcon: {
    fontSize: 14,
    marginRight: 6,
  },

  planPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2F6BFF',
  },

  freeBadge: {
    backgroundColor: '#DDE8FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  freeBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2F6BFF',
  },

  moreBadge: {
    backgroundColor: '#FFCE00',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  moreBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#101B4C',
  },

  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#101B4C',
    marginBottom: 12,
  },

  featuresList: {
    gap: 8,
  },

  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  checkCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    marginTop: 1,
  },

  checkMark: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },

  featureText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '500',
    color: '#101B4C',
    lineHeight: 15,
  },

  premiumCard: {
    width: '100%',
    backgroundColor: '#101B4C',
    borderRadius: 18,
    padding: 18,
    marginTop: 4,
    marginBottom: 20,
  },

  premiumBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
    marginBottom: 14,
  },

  premiumPricePeriod: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9FB4F0',
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
    textAlign: 'center',
    marginBottom: 6,
  },

  cancelNote: {
    fontSize: 12,
    color: '#8A8F9C',
    textAlign: 'center',
  },
});
