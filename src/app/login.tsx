import { emailHasAccount, sendPasswordReset, signInWithEmail } from '@/lib/auth';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleLogin = async () => {
    const nextEmailError = validateEmail(email)
      ? ''
      : 'Escribe un correo electrónico válido.';
    const nextPasswordError = password.trim()
      ? ''
      : 'Escribe tu contraseña para continuar.';

    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError || nextPasswordError) {
      return;
    }

    try {
      await signInWithEmail(email, password);
      router.replace('/home');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/invalid login credentials/i.test(message)) {
        const hasAccount = await emailHasAccount(email);
        if (hasAccount === false) {
          setEmailError('No existe una cuenta con ese correo. Crea una cuenta para continuar.');
        } else if (hasAccount === true) {
          setPasswordError('Contraseña incorrecta. Inténtalo de nuevo.');
        } else {
          setPasswordError('Correo o contraseña incorrectos.');
        }
        return;
      }
      setPasswordError(message || 'No se pudo iniciar sesión. Revisa tu correo y contraseña.');
    }
  };

  const handlePasswordRecovery = async () => {
    if (!validateEmail(email)) {
      setEmailError('Escribe tu correo para recuperar la contraseña.');
      return;
    }

    try {
      await sendPasswordReset(email);
      Alert.alert(
        'Revisa tu correo',
        'Te enviamos un código de recuperación. Escríbelo en la siguiente pantalla.'
      );
      router.push({ pathname: '/reset-password', params: { email: email.trim().toLowerCase() } });
    } catch (error) {
      setEmailError(
        error instanceof Error ? error.message : 'No se pudo enviar el código. Inténtalo nuevamente.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Inicia sesión</Text>
          <Text style={styles.subtitle}>
            Continúa tu entrenamiento personalizado.
          </Text>

          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            style={[styles.input, emailError && styles.inputError]}
            placeholder="ejemplo@email.com"
            placeholderTextColor="#B0B4BA"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setEmailError('');
            }}
          />
          {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

          <View style={styles.passwordHeader}>
            <Text style={styles.label}>Contraseña</Text>
            <TouchableOpacity onPress={() => setShowForgotPassword((value) => !value)}>
              <Text style={styles.forgotLink}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.passwordRow, passwordError && styles.inputError]}>
            <TextInput
              style={styles.passwordInput}
              placeholder="••••••••"
              placeholderTextColor="#B0B4BA"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              textContentType="password"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                setPasswordError('');
              }}
            />
            <TouchableOpacity onPress={() => setShowPassword((value) => !value)}>
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
            </TouchableOpacity>
          </View>
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

          {showForgotPassword && (
            <View style={styles.recoveryPanel}>
              <Text style={styles.recoveryText}>
                Usaremos tu correo para enviarte un código de recuperación.
              </Text>
              <TouchableOpacity
                style={styles.recoveryButton}
                onPress={handlePasswordRecovery}
              >
                <Text style={styles.recoveryButtonText}>ENVIAR ENLACE</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
            <Text style={styles.loginButtonText}>INICIAR SESIÓN</Text>
          </TouchableOpacity>

          <Text style={styles.registerPrompt}>
            ¿Aún no tienes cuenta?{' '}
            <Text
              style={styles.registerLink}
              onPress={() => router.push('/create-account')}
            >
              Crear cuenta
            </Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
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
    marginBottom: 6,
  },
  inputError: {
    borderColor: '#D64545',
  },
  errorText: {
    color: '#D64545',
    fontSize: 12,
    marginBottom: 16,
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  forgotLink: {
    color: '#2F6BFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E6EB',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    color: '#171923',
  },
  eyeIcon: {
    fontSize: 18,
  },
  recoveryPanel: {
    backgroundColor: '#F4F7FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  recoveryText: {
    color: '#596170',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  recoveryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#E6EDFF',
  },
  recoveryButtonText: {
    color: '#2F6BFF',
    fontSize: 12,
    fontWeight: '800',
  },
  loginButton: {
    width: '100%',
    height: 54,
    borderRadius: 14,
    backgroundColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  registerPrompt: {
    fontSize: 14,
    color: '#8A8F9C',
    textAlign: 'center',
  },
  registerLink: {
    color: '#2F6BFF',
    fontWeight: '700',
  },
});
