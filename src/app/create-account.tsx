import { router } from 'expo-router';
import { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateAccountScreen() {
  // Estado local del formulario: nombre, correo, contraseña y aceptación de términos.
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* BACK BUTTON */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        {/* TITLE */}
        <Text style={styles.title}>Crea tu cuenta</Text>
        <Text style={styles.subtitle}>
          Comienza tu entrenamiento personalizado.
        </Text>

        {/* NAME FIELD */}
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          placeholder="Carlos"
          placeholderTextColor="#B0B4BA"
          value={name}
          onChangeText={setName}
        />

        {/* EMAIL FIELD */}
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

        {/* PASSWORD FIELD */}
        <Text style={styles.label}>Contraseña</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={styles.passwordInput}
            placeholder="••••••••"
            placeholderTextColor="#B0B4BA"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        </View>

        {/* TERMS CHECKBOX */}
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setAcceptedTerms((prev) => !prev)}
        >
          <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
            {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.termsText}>
            Acepto los{' '}
            <Text style={styles.termsLink}>términos y política de privacidad</Text>
          </Text>
        </TouchableOpacity>

        {/* CONTINUE BUTTON */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => router.push('/objetive')}
        >
          <Text style={styles.continueButtonText}>CONTINUAR</Text>
          <Text style={styles.continueArrow}>→</Text>
        </TouchableOpacity>

        {/* LOGIN LINK */}
        <Text style={styles.loginPrompt}>
          ¿Ya tienes cuenta?{' '}
          <Text style={styles.loginLink} onPress={() => router.back()}>
            Iniciar sesión
          </Text>
        </Text>
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
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 32,
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 16,
  },

  backIcon: {
    fontSize: 22,
    color: '#171923',
  },

  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#171923',
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 14,
    color: '#8A8F9C',
    marginBottom: 28,
  },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#171923',
    marginBottom: 8,
  },

  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E6EB',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#171923',
    marginBottom: 20,
  },

  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E6EB',
    paddingHorizontal: 16,
    marginBottom: 20,
  },

  passwordInput: {
    flex: 1,
    fontSize: 15,
    color: '#171923',
  },

  eyeIcon: {
    fontSize: 18,
  },

  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 32,
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 1,
  },

  checkboxChecked: {
    backgroundColor: '#2F6BFF',
  },

  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  termsText: {
    flex: 1,
    fontSize: 13,
    color: '#171923',
    lineHeight: 18,
  },

  termsLink: {
    color: '#2F6BFF',
    fontWeight: '700',
  },

  continueButton: {
    flexDirection: 'row',
    width: '100%',
    height: 54,
    borderRadius: 14,
    backgroundColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },

  continueButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    marginRight: 8,
  },

  continueArrow: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '800',
  },

  loginPrompt: {
    fontSize: 14,
    color: '#8A8F9C',
    textAlign: 'center',
  },

  loginLink: {
    color: '#2F6BFF',
    fontWeight: '700',
  },
});
