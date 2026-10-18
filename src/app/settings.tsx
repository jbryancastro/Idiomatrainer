import { getSessionUser, sendPasswordReset } from '@/lib/auth';
import {
  DEFAULT_SETTINGS,
  updateSettings,
  useSettings,
  type AppSettings,
  type ThemePreference,
} from '@/lib/settings';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AudioModule } from 'expo-audio';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const ACCENTS: { value: AppSettings['voiceAccent']; label: string }[] = [
  { value: 'en-US', label: 'Americano' },
  { value: 'en-GB', label: 'Británico' },
];
const RATES = [
  { value: 0.75, label: 'Lenta' },
  { value: 1, label: 'Normal' },
  { value: 1.25, label: 'Rápida' },
];
const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];
const DAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const TIMES = ['08:00', '12:00', '19:00', '21:00'];

// Datos de aprendizaje guardados en este dispositivo (no incluye la sesión).
const LEARNING_DATA_PREFIXES = [
  'idiomatrainer.scores.',
  'idiomatrainer.assessment-insights.',
  'idiomatrainer.level.',
  'idiomatrainer.progress.',
  'idiomatrainer.learner-profile.',
];

export default function SettingsScreen() {
  const settings = useSettings();
  const [message, setMessage] = useState('');

  const changePassword = async () => {
    const user = await getSessionUser();
    if (!user?.email) {
      setMessage('Inicia sesión con tu correo para cambiar la contraseña.');
      return;
    }
    try {
      await sendPasswordReset(user.email);
      router.push({ pathname: '/reset-password', params: { email: user.email } });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo enviar el código.');
    }
  };

  const requestMicrophone = async () => {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    setMessage(
      permission.granted
        ? 'El micrófono está permitido.'
        : 'El micrófono está bloqueado. Actívalo en los permisos del navegador o del dispositivo.'
    );
  };

  const deleteLearningData = async () => {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
      LEARNING_DATA_PREFIXES.some((prefix) => key.startsWith(prefix))
    );
    await AsyncStorage.multiRemove(keys);
    setMessage('Se borraron los datos de aprendizaje guardados en este dispositivo.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Configuración</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Text style={styles.section}>Voz y conversación</Text>
        <Text style={styles.label}>Voz de la IA</Text>
        <Options
          options={ACCENTS}
          selected={settings.voiceAccent}
          onSelect={(voiceAccent) => updateSettings({ voiceAccent })}
        />
        <Text style={styles.label}>Velocidad</Text>
        <Options
          options={RATES}
          selected={settings.speechRate}
          onSelect={(speechRate) => updateSettings({ speechRate })}
        />
        <TouchableOpacity
          style={styles.action}
          onPress={() => {
            Speech.stop();
            Speech.speak('Hello! This is how I will sound during your practice.', {
              language: settings.voiceAccent,
              rate: settings.speechRate,
            });
          }}
        >
          <Text style={styles.actionText}>🔊 Probar voz</Text>
        </TouchableOpacity>

        <Text style={styles.section}>Recordatorios</Text>
        <Text style={styles.hint}>
          Guardamos tu horario preferido. Los avisos automáticos aún no están disponibles.
        </Text>
        <Options
          options={[
            { value: true, label: 'Activados' },
            { value: false, label: 'Desactivados' },
          ]}
          selected={settings.remindersEnabled}
          onSelect={(remindersEnabled) => updateSettings({ remindersEnabled })}
        />
        {settings.remindersEnabled ? (
          <>
            <Text style={styles.label}>Hora</Text>
            <Options
              options={TIMES.map((time) => ({ value: time, label: time }))}
              selected={settings.reminderTime}
              onSelect={(reminderTime) => updateSettings({ reminderTime })}
            />
            <Text style={styles.label}>Días</Text>
            <View style={styles.chips}>
              {DAYS.map((day, index) => {
                const selected = settings.reminderDays.includes(index);
                return (
                  <TouchableOpacity
                    key={day + index}
                    style={[styles.dayChip, selected && styles.chipSelected]}
                    onPress={() =>
                      updateSettings({
                        reminderDays: selected
                          ? settings.reminderDays.filter((value) => value !== index)
                          : [...settings.reminderDays, index].sort(),
                      })
                    }
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.section}>Apariencia</Text>
        <Options
          options={THEMES}
          selected={settings.theme}
          onSelect={(theme) => updateSettings({ theme })}
        />

        <Text style={styles.section}>Privacidad y seguridad</Text>
        <TouchableOpacity style={styles.action} onPress={changePassword}>
          <Text style={styles.actionText}>🔑 Cambiar contraseña</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={requestMicrophone}>
          <Text style={styles.actionText}>🎤 Permiso del micrófono</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={deleteLearningData}>
          <Text style={[styles.actionText, styles.danger]}>🗑️ Borrar datos de aprendizaje locales</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.action}
          onPress={() => updateSettings(DEFAULT_SETTINGS)}
        >
          <Text style={styles.actionText}>↺ Restablecer configuración</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Options<T extends string | number | boolean>({
  options,
  selected,
  onSelect,
}: {
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <TouchableOpacity
            key={option.label}
            style={[styles.chip, active && styles.chipSelected]}
            onPress={() => onSelect(option.value)}
          >
            <Text style={[styles.chipText, active && styles.chipTextSelected]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  backIcon: { fontSize: 24, color: '#171923' },
  title: { fontSize: 24, fontWeight: '800', color: '#171923', marginBottom: 8 },
  message: { fontSize: 14, color: '#2F6BFF', marginTop: 4 },
  section: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2F6BFF',
    textTransform: 'uppercase',
    marginTop: 28,
    marginBottom: 4,
  },
  label: { fontSize: 15, color: '#5B6472', marginTop: 12 },
  hint: { fontSize: 13, color: '#8A8F9C', marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 10 },
  chip: {
    borderWidth: 1,
    borderColor: '#D5D9E2',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D5D9E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: '#2F6BFF', borderColor: '#2F6BFF' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#171923' },
  chipTextSelected: { color: '#FFFFFF' },
  action: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF0F4',
  },
  actionText: { fontSize: 15, fontWeight: '600', color: '#171923' },
  danger: { color: '#E53935' },
});
