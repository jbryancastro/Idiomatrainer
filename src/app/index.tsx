import { router } from 'expo-router';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
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
        <TouchableOpacity style={styles.socialButton}>
          <Image
            source={require('../../img/google logo.png')}
            style={styles.socialIcon}
            resizeMode="contain"
          />
          <Text style={styles.socialButtonText}>CONTINUAR CON GOOGLE</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.socialButton}>
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
          ¿Ya tienes cuenta? <Text style={styles.loginLink}>Iniciar sesión</Text>
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
