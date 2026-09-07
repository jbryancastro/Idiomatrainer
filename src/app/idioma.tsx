import { router } from 'expo-router';
import { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FlagCode, FlagIcon } from '@/components/flag-icon';

const LANGUAGES: { id: string; flag: FlagCode; label: string; recommended: boolean }[] = [
  { id: 'ingles', flag: 'US', label: 'Inglés', recommended: true },
  { id: 'frances', flag: 'FR', label: 'Francés', recommended: false },
  { id: 'aleman', flag: 'DE', label: 'Alemán', recommended: false },
  { id: 'italiano', flag: 'IT', label: 'Italiano', recommended: false },
  { id: 'portugues', flag: 'PT', label: 'Portugués', recommended: false },
];

export default function LanguageScreen() {
  // Idioma seleccionado por el usuario para su entrenamiento; Inglés viene preseleccionado.
  const [selected, setSelected] = useState('ingles');

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* PROGRESS BAR */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
          <Text style={styles.progressLabel}>2/5</Text>
        </View>

        {/* TITLE */}
        <Text style={styles.title}>¿Qué idioma quieres aprender?</Text>

        {/* LANGUAGE OPTIONS */}
        <View style={styles.optionsList}>
          {LANGUAGES.map((language) => {
            const isSelected = selected === language.id;
            return (
              <TouchableOpacity
                key={language.id}
                style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                onPress={() => setSelected(language.id)}
              >
                <View style={styles.flagWrapper}>
                  <FlagIcon code={language.flag} size={32} />
                </View>
                <View style={styles.optionTextGroup}>
                  <Text style={styles.optionLabel}>{language.label}</Text>
                  {language.recommended && (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedText}>Recomendado</Text>
                    </View>
                  )}
                </View>
                {isSelected && (
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          {/* MORE LANGUAGES COMING SOON */}
          <View style={[styles.optionRow, styles.optionRowDisabled]}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.disabledLabel}>Próximamente más idiomas</Text>
          </View>
        </View>

        {/* CONTINUE BUTTON */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => router.push('/level')}
        >
          <Text style={styles.continueButtonText}>CONTINUAR</Text>
          <Text style={styles.continueArrow}>→</Text>
        </TouchableOpacity>
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

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },

  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E4E6EB',
    overflow: 'hidden',
    marginRight: 12,
  },

  progressFill: {
    width: '40%',
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#2F6BFF',
  },

  progressLabel: {
    fontSize: 13,
    color: '#8A8F9C',
  },

  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#171923',
    marginBottom: 28,
  },

  optionsList: {
    gap: 14,
    marginBottom: 32,
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E6EB',
    paddingHorizontal: 16,
  },

  optionRowSelected: {
    borderColor: '#2F6BFF',
    backgroundColor: '#F2F6FF',
  },

  optionRowDisabled: {
    minHeight: 56,
    opacity: 0.6,
  },

  flagWrapper: {
    marginRight: 14,
  },

  optionTextGroup: {
    flex: 1,
    gap: 4,
  },

  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#171923',
  },

  recommendedBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E9F0FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

  recommendedText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2F6BFF',
  },

  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  checkMark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  lockIcon: {
    fontSize: 18,
    marginRight: 14,
  },

  disabledLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#B0B4BA',
  },

  continueButton: {
    flexDirection: 'row',
    width: '100%',
    height: 54,
    borderRadius: 14,
    backgroundColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
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
});
