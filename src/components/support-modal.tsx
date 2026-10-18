import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useEffect, useState } from 'react';

const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL;

const TOPICS = ['Problema técnico', 'Mi cuenta', 'Suscripción o plan', 'Sugerencia de mejora', 'Otro'];

type Props = {
  visible: boolean;
  defaultEmail: string;
  onClose: () => void;
};

export function SupportModal({ visible, defaultEmail, onClose }: Props) {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) setEmail((current) => current || defaultEmail);
  }, [visible, defaultEmail]);

  const submit = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Escribe un correo de contacto válido.');
      return;
    }
    if (!subject.trim() || !details.trim()) {
      setError('Completa el asunto y la descripción de tu consulta.');
      return;
    }
    if (!SUPPORT_EMAIL) {
      setError('Falta configurar EXPO_PUBLIC_SUPPORT_EMAIL en .env.local.');
      return;
    }
    const body = `Tipo de consulta: ${topic}\nCorreo de contacto: ${email.trim()}\n\n${details.trim()}`;
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
      `[${topic}] ${subject.trim()}`
    )}&body=${encodeURIComponent(body)}`;
    try {
      await Linking.openURL(url);
      setSubject('');
      setDetails('');
      setError('');
      onClose();
    } catch {
      setError('No se pudo abrir tu aplicación de correo.');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.headerIcon}>🎧</Text>
              <View style={styles.headerText}>
                <Text style={styles.title}>Ayuda y soporte</Text>
                <Text style={styles.subtitle}>Estamos aquí para ayudarte.</Text>
              </View>
              <TouchableOpacity onPress={onClose} accessibilityLabel="Cerrar">
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Tipo de consulta</Text>
            {TOPICS.map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.radioRow}
                onPress={() => setTopic(item)}
                accessibilityRole="radio"
                accessibilityState={{ selected: topic === item }}
              >
                <View style={[styles.radio, topic === item && styles.radioActive]}>
                  {topic === item ? <View style={styles.radioDot} /> : null}
                </View>
                <Text style={styles.radioLabel}>{item}</Text>
              </TouchableOpacity>
            ))}

            <Text style={styles.fieldLabel}>Correo de contacto</Text>
            <TextInput
              style={styles.input}
              placeholder="tu@correo.com"
              placeholderTextColor="#9AA0AC"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.fieldLabel}>Asunto</Text>
            <TextInput
              style={styles.input}
              placeholder="¿En qué podemos ayudarte?"
              placeholderTextColor="#9AA0AC"
              value={subject}
              onChangeText={setSubject}
              maxLength={120}
            />

            <Text style={styles.fieldLabel}>Describe tu consulta</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Cuéntanos qué ocurrió o qué necesitas..."
              placeholderTextColor="#9AA0AC"
              multiline
              textAlignVertical="top"
              value={details}
              onChangeText={setDetails}
              maxLength={2000}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity style={styles.submit} onPress={submit}>
              <Text style={styles.submitText}>Preparar envío de soporte</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
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
    padding: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  headerIcon: { fontSize: 24, marginRight: 14 },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: '#171923' },
  subtitle: { fontSize: 13, color: '#5B6472', marginTop: 2 },
  close: { fontSize: 18, color: '#5B6472', padding: 4 },
  label: { fontSize: 13, color: '#5B6472', marginBottom: 6 },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#C5CAD5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioActive: { borderColor: '#111111', backgroundColor: '#111111' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  radioLabel: { fontSize: 14, color: '#171923' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#171923', marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E1E4EA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#171923',
    backgroundColor: '#FFFFFF',
  },
  textarea: { borderRadius: 12, minHeight: 100 },
  error: { color: '#E53935', fontSize: 13, marginTop: 12 },
  submit: {
    backgroundColor: '#111111',
    borderRadius: 22,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 18,
  },
  submitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
