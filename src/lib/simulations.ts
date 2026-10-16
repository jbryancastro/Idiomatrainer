export type Simulation = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  // Saludo inicial de Alex, ya dentro del rol de la simulación.
  greeting: string;
  // Instrucción para la IA (en inglés) que define el escenario.
  scenario: string;
};

export type WeaknessExercise = {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  greeting: string;
  scenario: string;
};

export const createWeaknessExercise = (weakness: string, index: number): WeaknessExercise => {
  const text = weakness.toLocaleLowerCase();

  if (/breve|fragment|desarroll|fluidez|oraci.n completa|respuesta corta/.test(text)) {
    return {
      id: `weakness-${index}`,
      icon: '💬',
      title: weakness,
      subtitle: 'Practica respuestas completas con más detalles',
      greeting: 'What do you like to do in your free time, and what makes it special for you?',
      scenario:
        `A focused English practice for the student's weakness: "${weakness}". Encourage the student to answer in complete sentences and add a reason, example, or detail. Ask follow-up questions that help them expand their answer. Give one short, supportive suggestion when useful. Keep the conversation at the student's current level.`,
    };
  }

  if (/pasad|past|preté|preter|verbo|gram.tic|grammar|rutina/.test(text)) {
    return {
      id: `weakness-${index}`,
      icon: '📘',
      title: weakness,
      subtitle: 'Practica pasado y variedad gramatical',
      greeting: 'What did you do yesterday, and what was the most interesting part of your day?',
      scenario:
        `A focused English practice for the student's weakness: "${weakness}". Ask questions that make the student describe past activities and routines using varied, accurate grammar. Give one brief, supportive correction when useful, then ask a follow-up question. Keep the conversation at the student's current level.`,
    };
  }

  if (/repet|memor|vocab|palabra|expresi/.test(text)) {
    return {
      id: `weakness-${index}`,
      icon: '🧩',
      title: weakness,
      subtitle: 'Amplía tu vocabulario y evita repetir frases',
      greeting: 'Tell me about something you enjoy doing, and explain what makes it interesting for you.',
      scenario:
        `A focused English practice for the student's weakness: "${weakness}". Help the student express the same idea in different ways and use varied vocabulary. Ask natural follow-up questions and briefly suggest a more natural alternative when useful. Keep the conversation at the student's current level.`,
    };
  }

  if (/pronunci|sonido|acento/.test(text)) {
    return {
      id: `weakness-${index}`,
      icon: '🎤',
      title: weakness,
      subtitle: 'Practica claridad y pronunciación al hablar',
      greeting: 'Tell me about a person, place, or activity that is important to you.',
      scenario:
        `A focused English speaking practice for the student's weakness: "${weakness}". Ask short questions that encourage clear, complete spoken answers. Do not claim to measure individual sounds from a transcript; coach the student to speak clearly and naturally. Keep the conversation at the student's current level.`,
    };
  }

  if (/comprensi|entend|pregunta|responder|respuesta/.test(text)) {
    return {
      id: `weakness-${index}`,
      icon: '👂',
      title: weakness,
      subtitle: 'Escucha la pregunta y responde con detalles',
      greeting: 'Imagine you are planning a day off. What would you like to do, and why?',
      scenario:
        `A focused English practice for the student's weakness: "${weakness}". Ask one clear question at a time, check that the student answers it, and encourage a complete answer with a reason or example. Give brief, supportive guidance when useful. Keep the conversation at the student's current level.`,
    };
  }

  return {
    id: `weakness-${index}`,
    icon: '🎯',
    title: weakness,
    subtitle: 'Práctica conversacional personalizada',
    greeting: 'Let’s practice together. Can you tell me about something you did recently?',
    scenario:
      `A focused English practice for the student's weakness: "${weakness}". Ask one question at a time and give the student a chance to practice. Provide one brief, supportive suggestion when useful. Keep the conversation at the student's current level.`,
  };
};

export const SIMULATIONS: Simulation[] = [
  {
    id: 'entrevista',
    icon: '💼',
    title: 'Entrevista laboral',
    subtitle: 'Nivel intermedio',
    greeting: "Good morning! Thanks for coming in. Please, tell me a little about yourself.",
    scenario: 'a job interview. You are the interviewer; ask about experience, strengths and goals.',
  },
  {
    id: 'aeropuerto',
    icon: '✈️',
    title: 'Viaje al aeropuerto',
    subtitle: 'Nivel básico',
    greeting: "Welcome to the airport! May I see your passport and ticket, please?",
    scenario: 'checking in at an airport. You are the airline agent; ask for documents, luggage and seat preference.',
  },
  {
    id: 'restaurante',
    icon: '🍽️',
    title: 'Pedir en un restaurante',
    subtitle: 'Nivel básico',
    greeting: "Hello, welcome to our restaurant! Can I get you something to drink?",
    scenario: 'ordering food at a restaurant. You are the waiter; take the order and answer questions about the menu.',
  },
  {
    id: 'hotel',
    icon: '🏨',
    title: 'Reservar un hotel',
    subtitle: 'Nivel básico',
    greeting: "Good evening, and welcome to the Grand Hotel. Do you have a reservation?",
    scenario: 'checking in at a hotel. You are the receptionist; ask about the reservation, nights and room needs.',
  },
  {
    id: 'doctor',
    icon: '🩺',
    title: 'Cita con el doctor',
    subtitle: 'Nivel intermedio',
    greeting: "Hello, please have a seat. What brings you in today?",
    scenario: 'a doctor appointment. You are the doctor; ask about symptoms and give simple advice.',
  },
  {
    id: 'tienda',
    icon: '🛍️',
    title: 'Compras en una tienda',
    subtitle: 'Nivel básico',
    greeting: "Hi there! Are you looking for anything in particular today?",
    scenario: 'shopping in a clothing store. You are the shop assistant; talk about sizes, prices and payment.',
  },
  {
    id: 'taxi',
    icon: '🚕',
    title: 'Tomar un taxi',
    subtitle: 'Nivel básico',
    greeting: "Hello! Where would you like to go today?",
    scenario: 'taking a taxi. You are the driver; ask for the destination and make small talk during the ride.',
  },
  {
    id: 'reunion',
    icon: '🤝',
    title: 'Reunión de trabajo',
    subtitle: 'Nivel avanzado',
    greeting: "Alright, let's get started. Could you give us a quick update on your project?",
    scenario: 'a team meeting at work. You are a colleague; ask about project progress, problems and deadlines.',
  },
];

const dayNumber = () => {
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
};

// Dos simulaciones por día, rotando por la lista según la fecha local.
export const getDailySimulations = (count = 2): Simulation[] => {
  const start = (dayNumber() * count) % SIMULATIONS.length;
  return Array.from({ length: count }, (_, i) => SIMULATIONS[(start + i) % SIMULATIONS.length]);
};

// Temas de conversación del botón "Entrenar ahora" de home (no rotan en practice).
export const TOPICS: Simulation[] = [
  {
    id: 'viajes',
    icon: '💬',
    title: 'Viajes y experiencias',
    subtitle: 'Conversación libre',
    greeting: "Hi! I'd love to hear about your travels. Where is the most interesting place you have been?",
    scenario: "a friendly chat about the student's trips and experiences; ask where they have been, what they liked and what they learned.",
  },
  {
    id: 'direcciones',
    icon: '🗺️',
    title: 'Direcciones',
    subtitle: 'Nivel básico',
    greeting: "Hi! I'm a bit lost. Could you tell me how to get to the nearest train station?",
    scenario: 'asking for and giving directions. You are a tourist who needs help; the student explains the way.',
  },
  {
    id: 'pelicula',
    icon: '🎬',
    title: 'Tu película favorita',
    subtitle: 'Nivel intermedio',
    greeting: "Hey! I'm looking for a movie to watch. What is your favorite film, and why do you like it?",
    scenario: "talking about movies; ask about the student's favorite film, its plot, characters and opinions, using past tenses.",
  },
  {
    id: 'planes',
    icon: '📅',
    title: 'Planes a futuro',
    subtitle: 'Nivel básico',
    greeting: "Hi! What are you going to do this weekend?",
    scenario: "talking about future plans; ask what the student is going to do and will do, encouraging 'going to' and 'will'.",
  },
];

export const findSimulation = (id?: string) =>
  [...SIMULATIONS, ...TOPICS].find((item) => item.id === id);
