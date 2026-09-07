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

const OPTIONS = [
  { id: 'trabajo', icon: '💼', label: 'Conseguir trabajo' },
  { id: 'confianza', icon: '💬', label: 'Hablar con confianza' },
  { id: 'viajar', icon: '✈️', label: 'Viajar' },
  { id: 'estudiar', icon: '🎓', label: 'Estudiar' },
  { id: 'vivir', icon: '🌎', label: 'Vivir en otro país' },
  { id: 'ingles', icon: '🧠', label: 'Mejorar mi inglés' },
];

export default function ObjectiveScreen() {
  // Opción de objetivo seleccionada por el usuario en este paso del onboarding.
  const [selected, setSelected] = useState<string | null>(null);

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
          <Text style={styles.progressLabel}>1/5</Text>
        </View>

        {/* TITLE */}
        <Text style={styles.title}>¿Cuál es tu objetivo?</Text>
        <Text style={styles.subtitle}>Elige lo que quieres lograr.</Text>

        {/* OPTIONS */}
        <View style={styles.optionsList}>
          {OPTIONS.map((option) => {
            const isSelected = selected === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                onPress={() => setSelected(option.id)}
              >
                <Text style={styles.optionIcon}>{option.icon}</Text>
                <Text style={styles.optionLabel}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* CONTINUE BUTTON */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => router.push('/idioma')}
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
    width: '20%',
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
    textAlign: 'center',
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 14,
    color: '#8A8F9C',
    textAlign: 'center',
    marginBottom: 28,
  },

  optionsList: {
    gap: 14,
    marginBottom: 32,
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E6EB',
    paddingHorizontal: 16,
  },

  optionRowSelected: {
    borderColor: '#2F6BFF',
    backgroundColor: '#F2F6FF',
  },

  optionIcon: {
    fontSize: 22,
    marginRight: 14,
  },

  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#171923',
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
