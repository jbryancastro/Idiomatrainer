import { getSessionUser } from '@/lib/auth';
import { getSavedLevel, LEVEL_NAMES, type SpeechAnalysis } from '@/lib/speech-analysis';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const TABS = [
  { id: 'inicio', icon: '🏠', label: 'Home' },
  { id: 'hablar', icon: '🎙️', label: 'Speak' },
  { id: 'entrenar', icon: '❗', label: 'Practice' },
  { id: 'progreso', icon: '📊', label: 'Progress' },
  { id: 'perfil', icon: '👤', label: 'Perfil' },
];

const RECOMMENDATIONS = [
  {
    topic: 'viajes',
    icon: '💬',
    title: 'Habla sobre tus viajes y experiencias.',
    description:
      'Practica cómo contar dónde has estado, qué te gustó y qué aprendiste. Ideal para mejorar tu fluidez y vocabulario.',
  },
  {
    topic: 'restaurante',
    icon: '🍽️',
    title: 'Pide comida en un restaurante.',
    description:
      'Simula una conversación con el mesero: pide platillos, pregunta por ingredientes y solicita la cuenta.',
  },
  {
    topic: 'entrevista',
    icon: '💼',
    title: 'Preséntate en una entrevista de trabajo.',
    description:
      'Explica tu experiencia, tus fortalezas y por qué eres el candidato ideal usando frases claras y seguras.',
  },
  {
    topic: 'direcciones',
    icon: '🗺️',
    title: 'Pregunta y da direcciones.',
    description:
      'Practica cómo pedir ayuda para llegar a un lugar y cómo explicar un camino con vocabulario sencillo.',
  },
  {
    topic: 'pelicula',
    icon: '🎬',
    title: 'Cuenta sobre tu película favorita.',
    description:
      'Describe la trama, los personajes y por qué te gusta. Excelente para practicar pasado y opiniones.',
  },
  {
    topic: 'tienda',
    icon: '🛍️',
    title: 'Compra en una tienda.',
    description:
      'Pregunta precios, tallas y formas de pago, y aprende a negociar o pedir una devolución con cortesía.',
  },
  {
    topic: 'planes',
    icon: '📅',
    title: 'Habla de tus planes a futuro.',
    description:
      'Cuenta qué harás este fin de semana o el próximo año usando “going to” y “will” con naturalidad.',
  },
];

// Cambia una vez al día según la fecha local, sin necesidad de guardar estado.
const getDailyRecommendation = () => {
  const now = new Date();
  const dayNumber = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000
  );
  return RECOMMENDATIONS[dayNumber % RECOMMENDATIONS.length];
};

const TIPS = [
  'Usa conectores como “because”, “but” o “so” para dar más detalles en tus respuestas.',
  'Habla despacio: pronunciar con claridad importa más que hablar rápido.',
  'Aprende frases completas en lugar de palabras sueltas; las recordarás mejor.',
  'Escucha una canción en inglés hoy y repite el estribillo en voz alta.',
  'No temas equivocarte: cada error es una oportunidad para mejorar.',
  'Describe en inglés lo que ves a tu alrededor para ampliar tu vocabulario.',
  'Graba tu voz y escúchala: notarás detalles de pronunciación que mejorar.',
];

// Cambia una vez al día según la fecha local.
const getDailyTip = () => {
  const now = new Date();
  const dayNumber = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000
  );
  return TIPS[dayNumber % TIPS.length];
};

export default function HomeScreen() {
  const tip = getDailyTip();
  const recommendation = getDailyRecommendation();
  const activeTab = 'inicio';
  const [userName, setUserName] = useState('');

  const [level, setLevel] = useState<SpeechAnalysis['level'] | null>(null);
  const [levelLoaded, setLevelLoaded] = useState(false);
  const [focused, setFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      getSavedLevel().then((saved) => {
        setLevel(saved);
        setLevelLoaded(true);
      });
      return () => setFocused(false);
    }, [])
  );

  const levels = Object.keys(LEVEL_NAMES);
  const nextLevel = level ? levels[Math.min(levels.indexOf(level) + 1, levels.length - 1)] : null;
  const suggestedLevel = level ? (nextLevel === level ? level : `${level} – ${nextLevel}`) : '—';

  useEffect(() => {
    getSessionUser().then((user) => {
      if (user) setUserName(user.name);
    });
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>
              Hola{userName ? `, ${userName.split(' ')[0]}` : ''}! 👋
            </Text>
            <Text style={styles.greetingSub}>¡Tu inglés te acerca a nuevas oportunidades!</Text>
          </View>
          <TouchableOpacity style={styles.bellButton}>
            <Text style={styles.bellIcon}>🔔</Text>
            <View style={styles.bellDot} />
          </TouchableOpacity>
        </View>

        {/* SUMMARY */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <View style={styles.levelCircle}>
              <Text style={styles.levelCircleText}>{level ?? '—'}</Text>
            </View>
            <View>
              <Text style={styles.summaryTitle}>Nivel actual</Text>
              <Text style={styles.summarySub}>{level ? LEVEL_NAMES[level] : 'Sin evaluar'}</Text>
            </View>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryIcon}>🎯</Text>
            <View style={styles.summaryTextWrap}>
              <Text style={styles.summaryTitle}>Objetivo diario</Text>
              <Text style={styles.summaryValue}>10 minutos</Text>
              <Text style={styles.summarySub}>Habla, mejora, avanza.</Text>
            </View>
          </View>
        </View>

        {/* TRAINING CARD */}
        <View style={styles.trainingCard}>
          <View style={styles.trainingHeader}>
            <Text style={styles.trainingTitle}>📅 Tu entrenamiento de hoy</Text>
            <View style={styles.recommendedBadge}>
              <Text style={styles.recommendedText}>✦ Recomendado para ti</Text>
            </View>
          </View>

          <View style={styles.topicRow}>
            <Text style={styles.topicIcon}>{recommendation.icon}</Text>
            <View style={styles.topicTextWrap}>
              <Text style={styles.topicTitle}>{recommendation.title}</Text>
              <Text style={styles.topicDescription}>{recommendation.description}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>🎯</Text>
              <View>
                <Text style={styles.metaLabel}>Objetivo</Text>
                <Text style={styles.metaValue}>10 minutos</Text>
              </View>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>📶</Text>
              <View>
                <Text style={styles.metaLabel}>Nivel sugerido</Text>
                <Text style={styles.metaValue}>{suggestedLevel}</Text>
              </View>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>🕒</Text>
              <View>
                <Text style={styles.metaLabel}>Tiempo estimado</Text>
                <Text style={styles.metaValue}>5 – 10 min</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.startButton}
            onPress={() =>
              router.push({
                pathname: '/speak',
                params: {
                  topic: recommendation.topic,
                  practice: 'true',
                  goalAssessment: 'false',
                },
              })
            }
          >
            <Text style={styles.startButtonText}>🎙️  ENTRENAR AHORA</Text>
          </TouchableOpacity>

          <View style={styles.tipRow}>
            <Text style={styles.tipIcon}>💡</Text>
            <View style={styles.tipTextWrap}>
              <Text style={styles.tipTitle}>Consejo de hoy</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* TAB BAR */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tabItem}
              onPress={() => {
                if (tab.id === 'hablar') {
                  router.replace({
                    pathname: '/speak',
                    params: { practice: 'true', goalAssessment: 'false' },
                  });
                }
                if (tab.id === 'entrenar') router.replace('/practice');
                if (tab.id === 'progreso') router.replace('/progress');
                if (tab.id === 'perfil') router.push('/account');
              }}
            >
              <Text style={[styles.tabIcon, !active && styles.tabIconInactive]}>
                {tab.icon}
              </Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* MODAL: evaluación pendiente */}
      <Modal visible={focused && levelLoaded && !level} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>🎙️</Text>
            <Text style={styles.modalTitle}>Haz tu evaluación</Text>
            <Text style={styles.modalMessage}>
              Para seguir usando la app necesitas completar la grabación de evaluación. Con ella
              obtendrás tu nivel y tu análisis personalizado.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => router.push('/evaluating')}
            >
              <Text style={styles.modalButtonText}>HACER EVALUACIÓN</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },

  greeting: {
    fontSize: 24,
    fontWeight: '800',
    color: '#171923',
  },

  greetingSub: {
    fontSize: 14,
    color: '#5B6472',
    marginTop: 4,
  },

  bellButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bellIcon: {
    fontSize: 22,
  },

  bellDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },

  headerText: {
    flex: 1,
    paddingRight: 8,
  },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF1FF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },

  summaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  summaryDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#D3DCF5',
    marginHorizontal: 12,
  },

  levelCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2F6BFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  levelCircleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  summaryIcon: {
    fontSize: 28,
    marginRight: 8,
  },

  summaryTextWrap: {
    flex: 1,
  },

  summaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#171923',
  },

  summaryValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2F6BFF',
  },

  summarySub: {
    fontSize: 12,
    color: '#5B6472',
  },

  trainingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E4E6EB',
    padding: 14,
  },

  trainingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  trainingTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#171923',
    flexShrink: 1,
  },

  recommendedBadge: {
    backgroundColor: '#EDF1FF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  recommendedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2F6BFF',
  },

  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF1FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },

  topicIcon: {
    fontSize: 32,
    marginRight: 12,
  },

  topicTextWrap: {
    flex: 1,
  },

  topicTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#171923',
    marginBottom: 4,
  },

  topicDescription: {
    fontSize: 12,
    color: '#5B6472',
    lineHeight: 17,
  },

  chevron: {
    fontSize: 24,
    color: '#2F6BFF',
    marginLeft: 8,
  },

  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  metaIcon: {
    fontSize: 20,
    marginRight: 6,
  },

  metaLabel: {
    fontSize: 11,
    color: '#5B6472',
  },

  metaValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#171923',
  },

  startButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  startButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDF1FF',
    borderRadius: 12,
    padding: 12,
  },

  tipIcon: {
    fontSize: 24,
    marginRight: 10,
  },

  tipTextWrap: {
    flex: 1,
  },

  tipTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#171923',
  },

  tipText: {
    fontSize: 12,
    color: '#5B6472',
    lineHeight: 17,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(23, 25, 35, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },

  modalIcon: {
    fontSize: 40,
    marginBottom: 10,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#171923',
    marginBottom: 8,
  },

  modalMessage: {
    fontSize: 14,
    color: '#5B6472',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },

  modalButton: {
    height: 50,
    alignSelf: 'stretch',
    borderRadius: 14,
    backgroundColor: '#2F6BFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E4E6EB',
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 8,
  },

  tabItem: {
    flex: 1,
    alignItems: 'center',
  },

  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },

  tabIconInactive: {
    opacity: 0.45,
  },

  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8A8F9C',
  },

  tabLabelActive: {
    color: '#2F6BFF',
  },
});
