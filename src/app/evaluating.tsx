import {
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioRecorder,
} from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TOTAL_SECONDS = 60;
// Alturas relativas de las barras de la onda de audio (decorativas, no reflejan audio real).
const WAVEFORM_BARS = [4, 10, 6, 16, 22, 12, 18, 8, 20, 10, 14, 6, 18, 10, 4, 8, 14, 6, 10, 4];

export default function EvaluatingScreen() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [seconds, setSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);

  const startRecording = async () => {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        const message = 'Permite el acceso al micrófono para evaluar tu nivel.';
        if (Platform.OS === 'web') window.alert(message);
        else Alert.alert('Micrófono sin permiso', message);
        return;
      }

      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      isRecordingRef.current = true;
      setSeconds(0);
      setIsRecording(true);
    } catch {
      Alert.alert('No se pudo grabar', 'Inténtalo nuevamente.');
    }
  };

  const stopRecording = async () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setIsRecording(false);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
    } catch {
      // La grabación ya estaba detenida.
    }
  };

  // Al salir de la pantalla se detiene cualquier grabación activa.
  useEffect(() => {
    return () => {
      if (isRecordingRef.current) {
        isRecordingRef.current = false;
        recorder.stop().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cronómetro: cuenta mientras se graba y detiene la grabación al llegar a 60 s.
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setSeconds((prev) => Math.min(prev + 1, TOTAL_SECONDS));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    if (isRecording && seconds >= TOTAL_SECONDS) {
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, isRecording]);

  const handleMicPress = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const handleFinish = async () => {
    await stopRecording();
    router.push(recorder.uri ? { pathname: '/perfil', params: { uri: recorder.uri } } : '/perfil');
  };

  const activeBars = Math.round((seconds / TOTAL_SECONDS) * WAVEFORM_BARS.length);

  const formatTime = (value: number) => {
    const mins = Math.floor(value / 60).toString().padStart(2, '0');
    const secs = (value % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

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
          <Text style={styles.progressLabel}>4/5</Text>
        </View>

        {/* HEADER */}
        <View style={styles.headerRow}>
          <Image
            source={require('../../img/microfono2.png')}
            style={styles.headerIcon}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>CONOZCAMOS TU NIVEL</Text>
        </View>
        <Text style={styles.subtitle}>
          Habla en inglés durante aproximadamente 60 segundos.
        </Text>

        {/* PROMPT LIST */}
        <Text style={styles.promptTitle}>Cuéntame:</Text>
        <View style={styles.promptList}>
          <Text style={styles.promptItem}>•  Quién eres</Text>
          <Text style={styles.promptItem}>•  Qué haces</Text>
          <Text style={styles.promptItem}>•  Por qué quieres aprender</Text>
        </View>

        {/* MIC BUTTON */}
        <View style={styles.micWrapper}>
          <View style={styles.micRingOuter}>
            <View style={styles.micRingInner}>
              <TouchableOpacity
                style={styles.micButton}
                onPress={handleMicPress}
              >
                <Image
                  source={require('../../img/microfono.png')}
                  style={styles.micIcon}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* WAVEFORM */}
        <View style={styles.waveformRow}>
          {WAVEFORM_BARS.map((height, index) => (
            <View
              key={index}
              style={[
                styles.waveformBar,
                { height },
                index < activeBars ? styles.waveformBarActive : styles.waveformBarInactive,
              ]}
            />
          ))}
        </View>

        {/* TIMER */}
        <Text style={styles.timerText}>
          <Text style={styles.timerElapsed}>{formatTime(seconds)}</Text>
          <Text style={styles.timerTotal}> / {formatTime(TOTAL_SECONDS)}</Text>
        </Text>

        {/* FINISH BUTTON */}
        <TouchableOpacity
          style={styles.finishButton}
          onPress={handleFinish}
        >
          <Text style={styles.finishButtonText}>TERMINAR</Text>
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
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 32,
  },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
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
    width: '80%',
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#2F6BFF',
  },

  progressLabel: {
    fontSize: 13,
    color: '#8A8F9C',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },

  headerIcon: {
    width: 18,
    height: 18,
    marginRight: 8,
  },

  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2F6BFF',
    letterSpacing: 0.3,
  },

  subtitle: {
    alignSelf: 'flex-start',
    fontSize: 14,
    color: '#171923',
    marginBottom: 20,
  },

  promptTitle: {
    alignSelf: 'flex-start',
    fontSize: 14,
    fontWeight: '800',
    color: '#171923',
    marginBottom: 8,
  },

  promptList: {
    alignSelf: 'flex-start',
    gap: 4,
    marginBottom: 36,
  },

  promptItem: {
    fontSize: 14,
    color: '#5B6472',
  },

  micWrapper: {
    marginBottom: 24,
  },

  micRingOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#E9F0FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  micRingInner: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: '#D3E1FF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  micButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  micIcon: {
    width: 32,
    height: 32,
  },

  waveformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 24,
    marginBottom: 14,
  },

  waveformBar: {
    width: 3,
    borderRadius: 2,
  },

  waveformBarActive: {
    backgroundColor: '#2F6BFF',
  },

  waveformBarInactive: {
    backgroundColor: '#D8DCE3',
  },

  timerText: {
    fontSize: 16,
    marginBottom: 32,
  },

  timerElapsed: {
    fontWeight: '800',
    color: '#171923',
  },

  timerTotal: {
    color: '#8A8F9C',
  },

  finishButton: {
    width: '100%',
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  finishButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2F6BFF',
    letterSpacing: 0.5,
  },
});
