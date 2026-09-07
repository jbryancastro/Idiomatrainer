import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {/* Stack root: todas las pantallas son planas, sin barra de tabs */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="explore" />
        <Stack.Screen name="create-account" />
        <Stack.Screen name="objetive" />
        <Stack.Screen name="idioma" />
        <Stack.Screen name="level" />
        <Stack.Screen name="evaluating" />
        <Stack.Screen name="perfil" />
        <Stack.Screen name="plans" />
      </Stack>
    </ThemeProvider>
  );
}
