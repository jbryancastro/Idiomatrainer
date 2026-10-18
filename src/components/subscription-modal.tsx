import { fetchSubscription, type Plan, type Subscription, type SubscriptionResult } from '@/lib/subscription';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const STATUS_LABELS: Record<Subscription['status'], string> = {
  active: 'Activo',
  trialing: 'En prueba',
  past_due: 'Pago pendiente',
  canceled: 'Cancelado',
  expired: 'Vencido',
};

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function SubscriptionModal({ visible, onClose }: Props) {
  const [result, setResult] = useState<SubscriptionResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    setError('');
    fetchSubscription()
      .then((data) => active && setResult(data))
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'No se pudo cargar tu suscripción.');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [visible]);

  const subscription = result?.state === 'subscribed' ? result.subscription : null;
  const plan: Plan | null = subscription?.plan ?? (result?.state === 'none' ? result.basicPlan : null);
  const isPremium = plan?.code === 'premium';
  const accent = isPremium ? '#F5B82E' : '#7FB0FF';
  const canceled = subscription?.status === 'canceled' || subscription?.status === 'expired';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <View style={styles.headerIconBox}>
                <Text style={styles.headerIcon}>👑</Text>
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title}>Mi suscripción</Text>
                <Text style={styles.subtitle}>Gestiona tu plan de aprendizaje</Text>
              </View>
              <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar">
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>

            {loading ? <ActivityIndicator style={styles.loader} color="#171923" /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {!loading && plan ? (
              <View style={styles.planCard}>
                <View style={styles.planTop}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {subscription ? (
                    <View style={[styles.statusPill, canceled && styles.statusPillOff]}>
                      <Text style={[styles.statusPillText, canceled && styles.statusPillTextOff]}>
                        {STATUS_LABELS[subscription.status]}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.tagline, { color: accent }]}>{plan.tagline}</Text>
                <Text style={styles.description}>{plan.description}</Text>
                <View style={styles.divider} />
                {plan.features.map((feature) => (
                  <View key={feature} style={styles.featureRow}>
                    <View style={styles.check}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {!loading && result ? (
              <View style={styles.details}>
                <DetailRow
                  label="Estado"
                  value={subscription ? STATUS_LABELS[subscription.status] : 'Sin suscripción'}
                />
                <DetailRow
                  label="Tipo de plan"
                  value={
                    subscription
                      ? subscription.billingInterval === 'yearly'
                        ? 'Anual'
                        : 'Mensual'
                      : 'Gratuito'
                  }
                />
                {subscription ? (
                  <>
                    <DetailRow label="Inicio" value={formatDate(subscription.startedAt)} />
                    <DetailRow
                      label={canceled ? 'Vigente hasta' : 'Próxima renovación'}
                      value={formatDate(subscription.currentPeriodEnd)}
                    />
                  </>
                ) : null}
              </View>
            ) : null}

            {!loading && result && !isPremium ? (
              <TouchableOpacity
                style={styles.upgrade}
                onPress={() => {
                  onClose();
                  router.push('/plans');
                }}
              >
                <Text style={styles.upgradeText}>Ver planes</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#18254F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headerIcon: { fontSize: 22 },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: '#171923' },
  subtitle: { fontSize: 13, color: '#5B6472', marginTop: 2 },
  close: { fontSize: 18, color: '#5B6472', padding: 4 },
  loader: { marginVertical: 32 },
  error: { color: '#E53935', fontSize: 14, marginVertical: 16 },
  planCard: { backgroundColor: '#18254F', borderRadius: 14, padding: 18 },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planName: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', flexShrink: 1 },
  statusPill: {
    backgroundColor: 'rgba(46,204,113,0.18)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPillOff: { backgroundColor: 'rgba(229,57,53,0.2)' },
  statusPillText: { color: '#2ECC71', fontSize: 12, fontWeight: '600' },
  statusPillTextOff: { color: '#FF6B66' },
  tagline: { fontSize: 28, fontWeight: '800', marginTop: 18 },
  description: { color: '#E6EAF5', fontSize: 14, marginTop: 14 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: 18 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#5FD3A0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkMark: { color: '#5FD3A0', fontSize: 11, fontWeight: '800' },
  featureText: { color: '#FFFFFF', fontSize: 14, flex: 1 },
  details: {
    borderWidth: 1,
    borderColor: '#E7EAF0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 16,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, gap: 12 },
  detailLabel: { fontSize: 14, color: '#5B6472' },
  detailValue: { fontSize: 14, fontWeight: '700', color: '#171923', textAlign: 'right' },
  upgrade: {
    backgroundColor: '#111111',
    borderRadius: 22,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 16,
  },
  upgradeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
