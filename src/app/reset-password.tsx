import { updatePassword, verifyPasswordResetCode } from '@/lib/auth';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ResetPasswordScreen() {
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof emailParam === 'string' ? emailParam : '');
  const [code, setCode] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const handleReset = async () => {
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('Correo no válido', 'Escribe el correo donde recibiste el código.');
      return;
    }

    if (!/^\d{6}$/.test(code.trim())) {
      Alert.alert('Código no válido', 'Escribe el código de 6 dígitos recibido por correo.');
      return;
    }

    let verifiedAccessToken = accessToken;

    if (!verifiedAccessToken) {
      try {
        const result = await verifyPasswordResetCode(email, code);
        if (!result.access_token) {
          Alert.alert('Código inválido', 'Solicita un código nuevo e inténtalo otra vez.');
          return;
        }
        verifiedAccessToken = result.access_token;
        setAccessToken(verifiedAccessToken);
      } catch (error) {
        Alert.alert(
          'Código inválido',
          error instanceof Error ? error.message : 'El código expiró o no es correcto.'
        );
        return;
      }
    }

    if (password.length < 6) {
      Alert.alert('Contraseña insegura', 'Usa al menos 6 caracteres.');
      return;
    }

    if (password !== confirmation) {
      Alert.alert('Las contraseñas no coinciden', 'Revisa ambos campos.');
      return;
    }

    try {
      await updatePassword(verifiedAccessToken, password);
      Alert.alert('Contraseña actualizada', 'Ya puedes iniciar sesión con tu nueva contraseña.');
      router.replace('/login');
    } catch (error) {
      Alert.alert(
        'No se pudo actualizar',
        error instanceof Error ? error.message : 'Solicita un enlace nuevo.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Restablece tu contraseña</Text>
        <Text style={styles.subtitle}>Escribe el código que enviamos a tu correo.</Text>

        <Text style={styles.label}>Correo electrónico</Text>
        <TextInput
          style={styles.input}
          placeholder="ejemplo@email.com"
          placeholderTextColor="#B0B4BA"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Código de recuperación</Text>
        <TextInput
          style={styles.input}
          placeholder="123456"
          placeholderTextColor="#B0B4BA"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
        />

        <Text style={styles.label}>Nueva contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor="#B0B4BA"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>Repite la contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="Repite tu contraseña"
          placeholderTextColor="#B0B4BA"
          secureTextEntry
          value={confirmation}
          onChangeText={setConfirmation}
        />

        <TouchableOpacity style={styles.button} onPress={handleReset}>
          <Text style={styles.buttonText}>RESTABLECER CONTRASEÑA</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 32 },
  backButton: { width: 40, height: 40, justifyContent: 'center', marginBottom: 16 },
  backIcon: { fontSize: 22, color: '#171923' },
  title: { fontSize: 24, fontWeight: '800', color: '#171923', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#8A8F9C', marginBottom: 28 },
  label: { fontSize: 13, fontWeight: '700', color: '#171923', marginBottom: 8, marginTop: 12 },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E6EB',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#171923',
  },
  button: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
});
