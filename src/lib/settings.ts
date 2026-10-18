import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

export type AppSettings = {
  voiceAccent: 'en-US' | 'en-GB';
  speechRate: number;
  theme: ThemePreference;
  remindersEnabled: boolean;
  reminderTime: string;
  reminderDays: number[];
};

export const DEFAULT_SETTINGS: AppSettings = {
  voiceAccent: 'en-US',
  speechRate: 1,
  theme: 'system',
  remindersEnabled: false,
  reminderTime: '19:00',
  reminderDays: [1, 2, 3, 4, 5],
};

const SETTINGS_KEY = 'idiomatrainer.settings';

let current: AppSettings = DEFAULT_SETTINGS;
let loaded: Promise<AppSettings> | null = null;
const listeners = new Set<(settings: AppSettings) => void>();

export const loadSettings = () => {
  loaded ??= AsyncStorage.getItem(SETTINGS_KEY)
    .then((raw) => {
      if (raw) current = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
      return current;
    })
    .catch(() => current);
  return loaded;
};

export const updateSettings = async (changes: Partial<AppSettings>) => {
  await loadSettings();
  current = { ...current, ...changes };
  listeners.forEach((listener) => listener(current));
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(current));
  return current;
};

export const useSettings = () => {
  const [settings, setSettings] = useState(current);

  useEffect(() => {
    listeners.add(setSettings);
    loadSettings().then(setSettings);
    return () => {
      listeners.delete(setSettings);
    };
  }, []);

  return settings;
};
