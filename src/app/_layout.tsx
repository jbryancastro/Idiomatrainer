import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useSettings } from '@/lib/settings';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const systemScheme = useColorScheme();
  const { theme } = useSettings();
  const colorScheme = theme === 'system' ? systemScheme : theme;
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {/* Stack root: todas las pantallas son planas, sin barra de tabs */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="create-account" />
        <Stack.Screen name="login" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="objetive" />
        <Stack.Screen name="idioma" />
        <Stack.Screen name="level" />
        <Stack.Screen name="evaluating" />
        <Stack.Screen name="perfil" />
        <Stack.Screen name="plans" />
        <Stack.Screen name="home" />
        <Stack.Screen name="speak" />
        <Stack.Screen name="practice" />
        <Stack.Screen name="progress" />
        <Stack.Screen name="account" />
        <Stack.Screen name="personal-info" />
        <Stack.Screen name="settings" />
      </Stack>
    </ThemeProvider>
  );
}
