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

const LEVELS = [
  { id: 'empezando', icon: '🌱', label: 'Estoy empezando' },
  { id: 'algunas', icon: '😊', label: 'Entiendo algunas cosas' },
  { id: 'conversaciones', icon: '😐', label: 'Puedo mantener conversaciones' },
  { id: 'bien', icon: '😎', label: 'Hablo bastante bien' },
  { id: 'inseguro', icon: '🤷', label: 'No estoy seguro' },
];

export default function LevelScreen() {
  // Nivel de comodidad hablando, elegido por el usuario en este paso del onboarding.
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
          <Text style={styles.progressLabel}>3/5</Text>
        </View>

        {/* TITLE */}
        <Text style={styles.title}>¿Qué tan cómodo te sientes hablando?</Text>

        {/* OPTIONS */}
        <View style={styles.optionsList}>
          {LEVELS.map((level) => {
            const isSelected = selected === level.id;
            return (
              <TouchableOpacity
                key={level.id}
                style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                onPress={() => setSelected(level.id)}
              >
                <Text style={styles.optionIcon}>{level.icon}</Text>
                <Text style={styles.optionLabel}>{level.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* INFO BOX */}
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>🕒</Text>
          <View style={styles.infoTextGroup}>
            <Text style={styles.infoTitle}>Vamos a descubrirlo.</Text>
            <Text style={styles.infoSubtitle}>
              Haremos una pequeña prueba para conocerte mejor.
            </Text>
          </View>
        </View>

        {/* CONTINUE BUTTON */}
        <TouchableOpacity
          style={styles.continueButton}
          onPress={() => router.push('/evaluating')}
        >
          <Text style={styles.continueButtonText}>HACER PRUEBA DE NIVEL</Text>
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
    width: '60%',
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#2F6BFF',
  },

  progressLabel: {
    fontSize: 13,
    color: '#8A8F9C',
  },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#171923',
    marginBottom: 28,
  },

  optionsList: {
    gap: 14,
    marginBottom: 24,
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
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
    fontSize: 20,
    marginRight: 14,
  },

  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#171923',
  },

  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EDF1FF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },

  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },

  infoTextGroup: {
    flex: 1,
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#171923',
    marginBottom: 2,
  },

  infoSubtitle: {
    fontSize: 13,
    color: '#5B6472',
    lineHeight: 18,
  },

  continueButton: {
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
  },
});
