import { AuthRequestError, signUpWithEmail } from '@/lib/auth';
import { router } from 'expo-router';
import { useState } from 'react';
import {
    Modal, ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateAccountScreen() {
  // Estado local del formulario: nombre, correo, contraseña y aceptación de términos.
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [alert, setAlert] = useState({
    visible: false,
    title: '',
    message: '',
  });
  const [fieldErrors, setFieldErrors] = useState({
    name: '',
    email: '',
    password: '',
    terms: '',
  });
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleCreateAccount = async () => {
    const nextErrors = {
      name: name.trim() ? '' : 'Escribe tu nombre para continuar.',
      email: isValidEmail ? '' : 'Escribe un correo electrónico válido.',
      password: password.length >= 6 ? '' : 'Usa una contraseña de al menos 6 caracteres.',
      terms: acceptedTerms ? '' : 'Debes aceptar los términos y la política de privacidad.',
    };

    setFieldErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    try {
      const result = await signUpWithEmail(email, password, name);

      if (result.access_token) {
        router.replace('/objetive');
      } else {
        setAlert({
          visible: true,
          title: 'Confirma tu correo',
          message: 'Revisa tu bandeja de entrada para activar tu cuenta.',
        });
        router.replace('/login');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      const isRateLimited = /rate limit|too many requests|demasiados intentos/i.test(
        errorMessage
      );
      const isExistingEmail =
        !isRateLimited &&
        error instanceof AuthRequestError &&
        (error.status === 422 ||
          /already registered|already exists|user_already_exists|ya está registrado/i.test(
            errorMessage
          ));

      const title = isRateLimited
        ? 'Demasiados intentos'
        : isExistingEmail
          ? 'Correo ya registrado'
          : 'No se pudo crear la cuenta';
      const message = isRateLimited
        ? 'Supabase ha limitado temporalmente los correos de registro. Espera unos minutos antes de intentarlo nuevamente.'
        : isExistingEmail
          ? 'Este correo ya tiene una cuenta. Inicia sesión o usa otro correo.'
          : errorMessage || 'Inténtalo nuevamente.';

      setAlert({ visible: true, title, message });
    }
  };

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
          style={[styles.input, fieldErrors.name && styles.inputError]}
          placeholder="Carlos"
          placeholderTextColor="#B0B4BA"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setFieldErrors((errors) => ({ ...errors, name: '' }));
          }}
        />
        {fieldErrors.name ? <Text style={styles.errorText}>{fieldErrors.name}</Text> : null}

        {/* EMAIL FIELD */}
        <Text style={styles.label}>Correo electrónico</Text>
        <TextInput
          style={[styles.input, fieldErrors.email && styles.inputError]}
          placeholder="ejemplo@email.com"
          placeholderTextColor="#B0B4BA"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setFieldErrors((errors) => ({ ...errors, email: '' }));
          }}
        />
        {fieldErrors.email ? <Text style={styles.errorText}>{fieldErrors.email}</Text> : null}

        {/* PASSWORD FIELD */}
        <Text style={styles.label}>Contraseña</Text>
        <View style={[styles.passwordRow, fieldErrors.password && styles.inputError]}>
          <TextInput
            style={styles.passwordInput}
            placeholder="••••••••"
            placeholderTextColor="#B0B4BA"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setFieldErrors((errors) => ({ ...errors, password: '' }));
            }}
          />
          <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        </View>
        {fieldErrors.password ? <Text style={styles.errorText}>{fieldErrors.password}</Text> : null}

        {/* TERMS CHECKBOX */}
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => {
            setAcceptedTerms((prev) => !prev);
            setFieldErrors((errors) => ({ ...errors, terms: '' }));
          }}
        >
          <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
            {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.termsText}>
            Acepto los{' '}
            <Text style={styles.termsLink}>términos y política de privacidad</Text>
          </Text>
        </TouchableOpacity>
        {fieldErrors.terms ? <Text style={styles.errorText}>{fieldErrors.terms}</Text> : null}

        {/* CONTINUE BUTTON */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleCreateAccount}
          activeOpacity={0.8}
        >
          <Text style={styles.continueButtonText}>CONTINUAR</Text>
          <Text style={styles.continueArrow}>→</Text>
        </TouchableOpacity>

        {/* LOGIN LINK */}
        <Text style={styles.loginPrompt}>
          ¿Ya tienes cuenta?{' '}
          <Text style={styles.loginLink} onPress={() => router.push('/login')}>
            Iniciar sesión
          </Text>
        </Text>

        <Modal
          transparent
          animationType="fade"
          visible={alert.visible}
          onRequestClose={() => setAlert((current) => ({ ...current, visible: false }))}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>{alert.title}</Text>
              <Text style={styles.modalMessage}>{alert.message}</Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setAlert((current) => ({ ...current, visible: false }))}
              >
                <Text style={styles.modalButtonText}>ACEPTAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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

  inputError: {
    borderColor: '#D64545',
  },

  errorText: {
    color: '#D64545',
    fontSize: 12,
    marginTop: -14,
    marginBottom: 16,
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

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(23, 25, 35, 0.58)',
    paddingHorizontal: 24,
  },

  modalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  modalTitle: {
    color: '#171923',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },

  modalMessage: {
    color: '#596170',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 22,
  },

  modalButton: {
    alignSelf: 'flex-end',
    minWidth: 104,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },

  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
