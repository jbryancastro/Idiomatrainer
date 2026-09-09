import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import {
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID_PLACEHOLDER = 'google-client-id-not-configured';

export default function WelcomeScreen() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId:
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || GOOGLE_CLIENT_ID_PLACEHOLDER,
    iosClientId:
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || GOOGLE_CLIENT_ID_PLACEHOLDER,
    webClientId:
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || GOOGLE_CLIENT_ID_PLACEHOLDER,
    selectAccount: true,
  });

  const hasGoogleClientId =
    Platform.OS === 'web'
      ? Boolean(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID)
      : Platform.OS === 'android'
        ? Boolean(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID)
        : Boolean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

  useEffect(() => {
    if (response?.type === 'success') {
      router.replace('/explore');
    }
  }, [response]);

  const handleGoogleLogin = async () => {
    if (!request || !hasGoogleClientId) {
      const message =
        'Añade el Client ID de Google en .env.local y reinicia Expo.';

      if (Platform.OS === 'web') {
        window.alert(`Google no está configurado.\n\n${message}`);
      } else {
        Alert.alert('Google no está configurado', message);
      }
      return;
    }

    await promptAsync();
  };

  const handleAppleLogin = async () => {
    if (Platform.OS === 'web') {
      window.alert(
        'Apple requiere configuración adicional para la web.\n\n' +
          'Crea un Service ID en Apple Developer y conecta un backend para completar el inicio de sesión.'
      );
      return;
    }

    if (!(await AppleAuthentication.isAvailableAsync())) {
      Alert.alert(
        'Apple no está disponible',
        'Inicia esta aplicación en un dispositivo Apple compatible.'
      );
      return;
    }

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        router.replace('/explore');
      }
    } catch (error: unknown) {
      if ((error as { code?: string }).code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('No se pudo iniciar sesión', 'Inténtalo nuevamente.');
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* LOGO */}
        <View style={styles.logoBadge}>
          <Image
            source={require('../../img/sms audio.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* BRAND NAME */}
        <Text style={styles.brand}>
          Lingo<Text style={styles.brandAccent}>FIT</Text>
        </Text>

        {/* TAGLINE */}
        <Text style={styles.tagline}>Entrena para hablar{'\n'}con confianza.</Text>
        <Text style={styles.subtitle}>
          Tu entrenador personal de idiomas con IA.
        </Text>

        {/* FEATURE ICONS */}
        <View style={styles.featureRow}>
          <View style={styles.featureBadge}>
            <Image
              source={require('../../img/burbuja chat.png')}
              style={styles.featureImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.featureBadge}>
            <Image
              source={require('../../img/objetivo.png')}
              style={styles.featureImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.featureBadge}>
            <Image
              source={require('../../img/cerebro.png')}
              style={styles.featureImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* SOCIAL LOGIN */}
        <TouchableOpacity
          style={styles.socialButton}
          onPress={handleGoogleLogin}
          activeOpacity={0.7}
        >
          <Image
            source={require('../../img/google logo.png')}
            style={styles.socialIcon}
            resizeMode="contain"
          />
          <Text style={styles.socialButtonText}>CONTINUAR CON GOOGLE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialButton}
          onPress={handleAppleLogin}
          activeOpacity={0.7}
        >
           <Image
            source={require('../../img/apple logo.png')}
            style={styles.socialIcon}
            resizeMode="contain"
          />
          <Text style={styles.socialButtonText}>CONTINUAR CON APPLE</Text>
        </TouchableOpacity>

        {/* DIVIDER */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* CREATE ACCOUNT */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/create-account')}
        >
          <Text style={styles.primaryButtonText}>CREAR CUENTA</Text>
        </TouchableOpacity>

        {/* LOGIN LINK */}
        <Text style={styles.loginPrompt}>
          ¿Ya tienes cuenta?{' '}
          <Text style={styles.loginLink} onPress={() => router.push('/login')}>
            Iniciar sesión
          </Text>
        </Text>

        {/* LEGAL */}
        <Text style={styles.legalText}>
          Al continuar aceptas nuestros{'\n'}
          <Text style={styles.legalLink}>Términos y Política de Privacidad</Text>
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
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 32,
  },

  logoBadge: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },

  logoImage: {
    width: 64,
    height: 64,
  },

  brand: {
    fontSize: 30,
    fontWeight: '800',
    color: '#171923',
    marginBottom: 24,
  },

  brandAccent: {
    color: '#2F6BFF',
  },

  tagline: {
    fontSize: 22,
    fontWeight: '700',
    color: '#171923',
    textAlign: 'center',
    lineHeight: 28,
  },

  subtitle: {
    fontSize: 14,
    color: '#8A8F9C',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 28,
  },

  featureRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },

  featureBadge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  featureBadgeBlue: {
    backgroundColor: '#E9F0FF',
  },

  featureBadgeRed: {
    backgroundColor: '#FDEBEB',
  },

  featureIcon: {
    fontSize: 22,
  },

  featureImage: {
    width: 28,
    height: 28,
  },

  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E6EB',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },

  googleIcon: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4285F4',
    marginRight: 10,
  },

  socialIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },

  appleIcon: {
    fontSize: 16,
    marginRight: 10,
  },

  socialButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#171923',
    letterSpacing: 0.3,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 16,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E4E6EB',
  },

  dividerText: {
    marginHorizontal: 12,
    color: '#8A8F9C',
    fontSize: 13,
  },

  primaryButton: {
    width: '100%',
    height: 54,
    borderRadius: 14,
    backgroundColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },

  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  loginPrompt: {
    fontSize: 14,
    color: '#8A8F9C',
    marginBottom: 28,
  },

  loginLink: {
    color: '#2F6BFF',
    fontWeight: '700',
  },

  legalText: {
    fontSize: 12,
    color: '#B0B4BA',
    textAlign: 'center',
    lineHeight: 18,
  },

  legalLink: {
    color: '#2F6BFF',
  },
});
