/** Catálogo inicial reutilizable; no contiene sesiones ni datos personales. */
import { outdoorExercises } from './outdoor-exercises.js';
import { homeParkExpansion } from './home-park-expansion.js';
import {exerciseGuides} from './exercise-guides.js';
const baseExercises = [
  { name: "Sentadilla", muscleGroup: "Piernas", equipment: "Barra", movementPattern: "Sentadilla", trainingType: "POWER" },
  { name: "Press banca", muscleGroup: "Pecho", equipment: "Barra", movementPattern: "Empuje horizontal", trainingType: "POWER" },
  { name: "Peso muerto rumano", muscleGroup: "Isquiotibiales", equipment: "Barra", movementPattern: "Bisagra de cadera", trainingType: "POWER" },
  { name: "Remo sentado", muscleGroup: "Espalda", equipment: "Polea", movementPattern: "Traccion horizontal", trainingType: "POWER" },
  { name: "Press militar", muscleGroup: "Hombros", equipment: "Mancuernas", movementPattern: "Empuje vertical", trainingType: "POWER" },
  { name: "Dominadas", muscleGroup: "Espalda", equipment: "Barra fija", movementPattern: "Traccion vertical", trainingType: "POWER" },
  { name: "Hip thrust", muscleGroup: "Gluteos", equipment: "Barra", movementPattern: "Extension de cadera", trainingType: "POWER" },
  { name: "Curl de biceps", muscleGroup: "Brazos", equipment: "Mancuernas", movementPattern: "Flexion de codo", trainingType: "POWER" },
  { name: "Correr", muscleGroup: "Cardio", equipment: "Cinta o exterior", movementPattern: "Carrera continua", trainingType: "AEROBIC" },
  { name: "Bicicleta", muscleGroup: "Cardio", equipment: "Bicicleta", movementPattern: "Pedaleo continuo", trainingType: "AEROBIC" },
  { name: "Caminata inclinada", muscleGroup: "Cardio", equipment: "Cinta", movementPattern: "Marcha", trainingType: "AEROBIC" },
  { name: "Eliptica", muscleGroup: "Cardio", equipment: "Eliptica", movementPattern: "Cardio continuo", trainingType: "AEROBIC" },
  { name: "Remo continuo", muscleGroup: "Cuerpo completo", equipment: "Remo ergometro", movementPattern: "Cardio continuo", trainingType: "AEROBIC" },
  { name: "Sprints", muscleGroup: "Piernas", equipment: "Pista o cinta", movementPattern: "Carrera por intervalos", trainingType: "ANAEROBIC" },
  { name: "Bicicleta por intervalos", muscleGroup: "Piernas", equipment: "Bicicleta", movementPattern: "Pedaleo por intervalos", trainingType: "ANAEROBIC" },
  { name: "Burpees", muscleGroup: "Cuerpo completo", equipment: "Peso corporal", movementPattern: "Acondicionamiento", trainingType: "ANAEROBIC" },
  { name: "Kettlebell swing", muscleGroup: "Cuerpo completo", equipment: "Kettlebell", movementPattern: "Bisagra explosiva", trainingType: "ANAEROBIC" },
  { name: "Saltar cuerda", muscleGroup: "Cardio", equipment: "Cuerda", movementPattern: "Saltos por intervalos", trainingType: "ANAEROBIC" },
];

export const exerciseData = [...baseExercises, ...outdoorExercises, ...homeParkExpansion, ...[
  {
    "name": "Press banca inclinado con barra",
    "equipment": "Barra",
    "muscleGroup": "Pecho",
    "movementPattern": "Empuje horizontal",
    "trainingType": "POWER"
  },
  {
    "name": "Press banca declinado con barra",
    "equipment": "Barra",
    "muscleGroup": "Pecho",
    "movementPattern": "Empuje horizontal",
    "trainingType": "POWER"
  },
  {
    "name": "Press banca con mancuernas",
    "equipment": "Mancuernas",
    "muscleGroup": "Pecho",
    "movementPattern": "Empuje horizontal",
    "trainingType": "POWER"
  },
  {
    "name": "Press inclinado con mancuernas",
    "equipment": "Mancuernas",
    "muscleGroup": "Pecho",
    "movementPattern": "Empuje horizontal",
    "trainingType": "POWER"
  },
  {
    "name": "Press de pecho en máquina",
    "equipment": "Máquina",
    "muscleGroup": "Pecho",
    "movementPattern": "Empuje horizontal",
    "trainingType": "POWER"
  },
  {
    "name": "Press de pecho en polea",
    "equipment": "Polea",
    "muscleGroup": "Pecho",
    "movementPattern": "Empuje horizontal",
    "trainingType": "POWER"
  },
  {
    "name": "Aperturas con mancuernas",
    "equipment": "Mancuernas",
    "muscleGroup": "Pecho",
    "movementPattern": "Empuje horizontal",
    "trainingType": "POWER"
  },
  {
    "name": "Aperturas en máquina",
    "equipment": "Máquina",
    "muscleGroup": "Pecho",
    "movementPattern": "Empuje horizontal",
    "trainingType": "POWER"
  },
  {
    "name": "Cruces de polea",
    "equipment": "Polea",
    "muscleGroup": "Pecho",
    "movementPattern": "Empuje horizontal",
    "trainingType": "POWER"
  },
  {
    "name": "Flexiones de brazos",
    "equipment": "Peso corporal",
    "muscleGroup": "Pecho",
    "movementPattern": "Empuje horizontal",
    "trainingType": "POWER"
  },
  {
    "name": "Flexiones inclinadas",
    "equipment": "Banco",
    "muscleGroup": "Pecho",
    "movementPattern": "Empuje horizontal",
    "trainingType": "POWER"
  },
  {
    "name": "Flexiones con rodillas apoyadas",
    "equipment": "Peso corporal",
    "muscleGroup": "Pecho",
    "movementPattern": "Empuje horizontal",
    "trainingType": "POWER"
  },
  {
    "name": "Fondos para pecho",
    "equipment": "Paralelas",
    "muscleGroup": "Pecho",
    "movementPattern": "Empuje horizontal",
    "trainingType": "POWER"
  },
  {
    "name": "Peso muerto convencional",
    "equipment": "Barra",
    "muscleGroup": "Espalda",
    "movementPattern": "Tracción",
    "trainingType": "POWER"
  },
  {
    "name": "Remo con barra",
    "equipment": "Barra",
    "muscleGroup": "Espalda",
    "movementPattern": "Tracción",
    "trainingType": "POWER"
  },
  {
    "name": "Remo con mancuerna",
    "equipment": "Mancuerna",
    "muscleGroup": "Espalda",
    "movementPattern": "Tracción",
    "trainingType": "POWER"
  },
  {
    "name": "Remo en máquina",
    "equipment": "Máquina",
    "muscleGroup": "Espalda",
    "movementPattern": "Tracción",
    "trainingType": "POWER"
  },
  {
    "name": "Remo en barra T",
    "equipment": "Barra T",
    "muscleGroup": "Espalda",
    "movementPattern": "Tracción",
    "trainingType": "POWER"
  },
  {
    "name": "Remo invertido",
    "equipment": "Barra fija",
    "muscleGroup": "Espalda",
    "movementPattern": "Tracción",
    "trainingType": "POWER"
  },
  {
    "name": "Jalón al pecho",
    "equipment": "Polea",
    "muscleGroup": "Espalda",
    "movementPattern": "Tracción",
    "trainingType": "POWER"
  },
  {
    "name": "Jalón con agarre neutro",
    "equipment": "Polea",
    "muscleGroup": "Espalda",
    "movementPattern": "Tracción",
    "trainingType": "POWER"
  },
  {
    "name": "Jalón unilateral",
    "equipment": "Polea",
    "muscleGroup": "Espalda",
    "movementPattern": "Tracción",
    "trainingType": "POWER"
  },
  {
    "name": "Dominadas asistidas",
    "equipment": "Máquina",
    "muscleGroup": "Espalda",
    "movementPattern": "Tracción",
    "trainingType": "POWER"
  },
  {
    "name": "Dominadas supinas",
    "equipment": "Barra fija",
    "muscleGroup": "Espalda",
    "movementPattern": "Tracción",
    "trainingType": "POWER"
  },
  {
    "name": "Pullover en polea",
    "equipment": "Polea",
    "muscleGroup": "Espalda",
    "movementPattern": "Tracción",
    "trainingType": "POWER"
  },
  {
    "name": "Pullover con mancuerna",
    "equipment": "Mancuerna",
    "muscleGroup": "Espalda",
    "movementPattern": "Tracción",
    "trainingType": "POWER"
  },
  {
    "name": "Sentadilla frontal",
    "equipment": "Barra",
    "muscleGroup": "Piernas",
    "movementPattern": "Sentadilla y extensión de rodilla",
    "trainingType": "POWER"
  },
  {
    "name": "Sentadilla goblet",
    "equipment": "Mancuerna",
    "muscleGroup": "Piernas",
    "movementPattern": "Sentadilla y extensión de rodilla",
    "trainingType": "POWER"
  },
  {
    "name": "Sentadilla sumo",
    "equipment": "Mancuerna",
    "muscleGroup": "Piernas",
    "movementPattern": "Sentadilla y extensión de rodilla",
    "trainingType": "POWER"
  },
  {
    "name": "Sentadilla en multipower",
    "equipment": "Multipower",
    "muscleGroup": "Piernas",
    "movementPattern": "Sentadilla y extensión de rodilla",
    "trainingType": "POWER"
  },
  {
    "name": "Sentadilla hack",
    "equipment": "Máquina",
    "muscleGroup": "Piernas",
    "movementPattern": "Sentadilla y extensión de rodilla",
    "trainingType": "POWER"
  },
  {
    "name": "Prensa de piernas",
    "equipment": "Máquina",
    "muscleGroup": "Piernas",
    "movementPattern": "Sentadilla y extensión de rodilla",
    "trainingType": "POWER"
  },
  {
    "name": "Prensa unilateral",
    "equipment": "Máquina",
    "muscleGroup": "Piernas",
    "movementPattern": "Sentadilla y extensión de rodilla",
    "trainingType": "POWER"
  },
  {
    "name": "Extensión de cuádriceps",
    "equipment": "Máquina",
    "muscleGroup": "Piernas",
    "movementPattern": "Sentadilla y extensión de rodilla",
    "trainingType": "POWER"
  },
  {
    "name": "Zancadas caminando",
    "equipment": "Mancuernas",
    "muscleGroup": "Piernas",
    "movementPattern": "Sentadilla y extensión de rodilla",
    "trainingType": "POWER"
  },
  {
    "name": "Zancadas hacia atrás",
    "equipment": "Mancuernas",
    "muscleGroup": "Piernas",
    "movementPattern": "Sentadilla y extensión de rodilla",
    "trainingType": "POWER"
  },
  {
    "name": "Sentadilla búlgara",
    "equipment": "Banco y mancuernas",
    "muscleGroup": "Piernas",
    "movementPattern": "Sentadilla y extensión de rodilla",
    "trainingType": "POWER"
  },
  {
    "name": "Subida al banco",
    "equipment": "Banco",
    "muscleGroup": "Piernas",
    "movementPattern": "Sentadilla y extensión de rodilla",
    "trainingType": "POWER"
  },
  {
    "name": "Sentadilla con peso corporal",
    "equipment": "Peso corporal",
    "muscleGroup": "Piernas",
    "movementPattern": "Sentadilla y extensión de rodilla",
    "trainingType": "POWER"
  },
  {
    "name": "Sentadilla a una caja",
    "equipment": "Cajón",
    "muscleGroup": "Piernas",
    "movementPattern": "Sentadilla y extensión de rodilla",
    "trainingType": "POWER"
  },
  {
    "name": "Peso muerto rumano con mancuernas",
    "equipment": "Mancuernas",
    "muscleGroup": "Isquiotibiales",
    "movementPattern": "Flexión de rodilla y bisagra de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Peso muerto rumano unilateral",
    "equipment": "Mancuerna",
    "muscleGroup": "Isquiotibiales",
    "movementPattern": "Flexión de rodilla y bisagra de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Curl femoral sentado",
    "equipment": "Máquina",
    "muscleGroup": "Isquiotibiales",
    "movementPattern": "Flexión de rodilla y bisagra de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Curl femoral tumbado",
    "equipment": "Máquina",
    "muscleGroup": "Isquiotibiales",
    "movementPattern": "Flexión de rodilla y bisagra de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Curl femoral de pie",
    "equipment": "Máquina",
    "muscleGroup": "Isquiotibiales",
    "movementPattern": "Flexión de rodilla y bisagra de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Buenos días con barra",
    "equipment": "Barra",
    "muscleGroup": "Isquiotibiales",
    "movementPattern": "Flexión de rodilla y bisagra de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Curl femoral con fitball",
    "equipment": "Fitball",
    "muscleGroup": "Isquiotibiales",
    "movementPattern": "Flexión de rodilla y bisagra de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Curl femoral con deslizadores",
    "equipment": "Deslizadores",
    "muscleGroup": "Isquiotibiales",
    "movementPattern": "Flexión de rodilla y bisagra de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Hip thrust en máquina",
    "equipment": "Máquina",
    "muscleGroup": "Gluteos",
    "movementPattern": "Extensión y abducción de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Hip thrust unilateral",
    "equipment": "Banco",
    "muscleGroup": "Gluteos",
    "movementPattern": "Extensión y abducción de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Puente de glúteos",
    "equipment": "Peso corporal",
    "muscleGroup": "Gluteos",
    "movementPattern": "Extensión y abducción de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Patada de glúteo en polea",
    "equipment": "Polea",
    "muscleGroup": "Gluteos",
    "movementPattern": "Extensión y abducción de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Abducción de cadera en máquina",
    "equipment": "Máquina",
    "muscleGroup": "Gluteos",
    "movementPattern": "Extensión y abducción de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Abducción de cadera con banda",
    "equipment": "Banda elástica",
    "muscleGroup": "Gluteos",
    "movementPattern": "Extensión y abducción de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Caminata lateral con banda",
    "equipment": "Banda elástica",
    "muscleGroup": "Gluteos",
    "movementPattern": "Extensión y abducción de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Pull through en polea",
    "equipment": "Polea",
    "muscleGroup": "Gluteos",
    "movementPattern": "Extensión y abducción de cadera",
    "trainingType": "POWER"
  },
  {
    "name": "Press militar con barra",
    "equipment": "Barra",
    "muscleGroup": "Hombros",
    "movementPattern": "Empuje y elevación de hombro",
    "trainingType": "POWER"
  },
  {
    "name": "Press de hombros en máquina",
    "equipment": "Máquina",
    "muscleGroup": "Hombros",
    "movementPattern": "Empuje y elevación de hombro",
    "trainingType": "POWER"
  },
  {
    "name": "Press Arnold",
    "equipment": "Mancuernas",
    "muscleGroup": "Hombros",
    "movementPattern": "Empuje y elevación de hombro",
    "trainingType": "POWER"
  },
  {
    "name": "Elevaciones laterales con mancuernas",
    "equipment": "Mancuernas",
    "muscleGroup": "Hombros",
    "movementPattern": "Empuje y elevación de hombro",
    "trainingType": "POWER"
  },
  {
    "name": "Elevaciones laterales en polea",
    "equipment": "Polea",
    "muscleGroup": "Hombros",
    "movementPattern": "Empuje y elevación de hombro",
    "trainingType": "POWER"
  },
  {
    "name": "Elevaciones frontales",
    "equipment": "Mancuernas",
    "muscleGroup": "Hombros",
    "movementPattern": "Empuje y elevación de hombro",
    "trainingType": "POWER"
  },
  {
    "name": "Pájaros con mancuernas",
    "equipment": "Mancuernas",
    "muscleGroup": "Hombros",
    "movementPattern": "Empuje y elevación de hombro",
    "trainingType": "POWER"
  },
  {
    "name": "Aperturas inversas en máquina",
    "equipment": "Máquina",
    "muscleGroup": "Hombros",
    "movementPattern": "Empuje y elevación de hombro",
    "trainingType": "POWER"
  },
  {
    "name": "Face pull",
    "equipment": "Polea",
    "muscleGroup": "Hombros",
    "movementPattern": "Empuje y elevación de hombro",
    "trainingType": "POWER"
  },
  {
    "name": "Encogimientos con mancuernas",
    "equipment": "Mancuernas",
    "muscleGroup": "Hombros",
    "movementPattern": "Empuje y elevación de hombro",
    "trainingType": "POWER"
  },
  {
    "name": "Curl de bíceps con barra",
    "equipment": "Barra",
    "muscleGroup": "Brazos",
    "movementPattern": "Flexión y extensión de codo",
    "trainingType": "POWER"
  },
  {
    "name": "Curl de bíceps en polea",
    "equipment": "Polea",
    "muscleGroup": "Brazos",
    "movementPattern": "Flexión y extensión de codo",
    "trainingType": "POWER"
  },
  {
    "name": "Curl martillo",
    "equipment": "Mancuernas",
    "muscleGroup": "Brazos",
    "movementPattern": "Flexión y extensión de codo",
    "trainingType": "POWER"
  },
  {
    "name": "Curl predicador",
    "equipment": "Banco predicador y barra",
    "muscleGroup": "Brazos",
    "movementPattern": "Flexión y extensión de codo",
    "trainingType": "POWER"
  },
  {
    "name": "Curl concentrado",
    "equipment": "Mancuerna",
    "muscleGroup": "Brazos",
    "movementPattern": "Flexión y extensión de codo",
    "trainingType": "POWER"
  },
  {
    "name": "Curl inclinado con mancuernas",
    "equipment": "Mancuernas",
    "muscleGroup": "Brazos",
    "movementPattern": "Flexión y extensión de codo",
    "trainingType": "POWER"
  },
  {
    "name": "Curl inverso",
    "equipment": "Barra",
    "muscleGroup": "Brazos",
    "movementPattern": "Flexión y extensión de codo",
    "trainingType": "POWER"
  },
  {
    "name": "Extensión de tríceps con cuerda",
    "equipment": "Polea",
    "muscleGroup": "Brazos",
    "movementPattern": "Flexión y extensión de codo",
    "trainingType": "POWER"
  },
  {
    "name": "Extensión de tríceps con barra en polea",
    "equipment": "Polea",
    "muscleGroup": "Brazos",
    "movementPattern": "Flexión y extensión de codo",
    "trainingType": "POWER"
  },
  {
    "name": "Press francés",
    "equipment": "Barra Z",
    "muscleGroup": "Brazos",
    "movementPattern": "Flexión y extensión de codo",
    "trainingType": "POWER"
  },
  {
    "name": "Extensión de tríceps sobre la cabeza",
    "equipment": "Mancuerna",
    "muscleGroup": "Brazos",
    "movementPattern": "Flexión y extensión de codo",
    "trainingType": "POWER"
  },
  {
    "name": "Patada de tríceps",
    "equipment": "Mancuerna",
    "muscleGroup": "Brazos",
    "movementPattern": "Flexión y extensión de codo",
    "trainingType": "POWER"
  },
  {
    "name": "Press banca con agarre cerrado",
    "equipment": "Barra",
    "muscleGroup": "Brazos",
    "movementPattern": "Flexión y extensión de codo",
    "trainingType": "POWER"
  },
  {
    "name": "Fondos asistidos para tríceps",
    "equipment": "Máquina",
    "muscleGroup": "Brazos",
    "movementPattern": "Flexión y extensión de codo",
    "trainingType": "POWER"
  },
  {
    "name": "Plancha frontal",
    "equipment": "Peso corporal",
    "muscleGroup": "Abdominales",
    "movementPattern": "Estabilidad y flexión de tronco",
    "trainingType": "POWER"
  },
  {
    "name": "Plancha lateral",
    "equipment": "Peso corporal",
    "muscleGroup": "Abdominales",
    "movementPattern": "Estabilidad y flexión de tronco",
    "trainingType": "POWER"
  },
  {
    "name": "Crunch abdominal",
    "equipment": "Peso corporal",
    "muscleGroup": "Abdominales",
    "movementPattern": "Estabilidad y flexión de tronco",
    "trainingType": "POWER"
  },
  {
    "name": "Crunch en polea",
    "equipment": "Polea",
    "muscleGroup": "Abdominales",
    "movementPattern": "Estabilidad y flexión de tronco",
    "trainingType": "POWER"
  },
  {
    "name": "Elevación de rodillas colgado",
    "equipment": "Barra fija",
    "muscleGroup": "Abdominales",
    "movementPattern": "Estabilidad y flexión de tronco",
    "trainingType": "POWER"
  },
  {
    "name": "Elevación de piernas tumbado",
    "equipment": "Colchoneta",
    "muscleGroup": "Abdominales",
    "movementPattern": "Estabilidad y flexión de tronco",
    "trainingType": "POWER"
  },
  {
    "name": "Dead bug",
    "equipment": "Colchoneta",
    "muscleGroup": "Abdominales",
    "movementPattern": "Estabilidad y flexión de tronco",
    "trainingType": "POWER"
  },
  {
    "name": "Bird dog",
    "equipment": "Colchoneta",
    "muscleGroup": "Abdominales",
    "movementPattern": "Estabilidad y flexión de tronco",
    "trainingType": "POWER"
  },
  {
    "name": "Press Pallof",
    "equipment": "Polea",
    "muscleGroup": "Abdominales",
    "movementPattern": "Estabilidad y flexión de tronco",
    "trainingType": "POWER"
  },
  {
    "name": "Rueda abdominal",
    "equipment": "Rueda abdominal",
    "muscleGroup": "Abdominales",
    "movementPattern": "Estabilidad y flexión de tronco",
    "trainingType": "POWER"
  },
  {
    "name": "Crunch inverso",
    "equipment": "Colchoneta",
    "muscleGroup": "Abdominales",
    "movementPattern": "Estabilidad y flexión de tronco",
    "trainingType": "POWER"
  },
  {
    "name": "Paseo del granjero",
    "equipment": "Mancuernas",
    "muscleGroup": "Abdominales",
    "movementPattern": "Estabilidad y flexión de tronco",
    "trainingType": "POWER"
  },
  {
    "name": "Elevación de talones de pie",
    "equipment": "Máquina",
    "muscleGroup": "Pantorrillas",
    "movementPattern": "Flexión plantar",
    "trainingType": "POWER"
  },
  {
    "name": "Elevación de talones sentado",
    "equipment": "Máquina",
    "muscleGroup": "Pantorrillas",
    "movementPattern": "Flexión plantar",
    "trainingType": "POWER"
  },
  {
    "name": "Elevación de talones en prensa",
    "equipment": "Máquina",
    "muscleGroup": "Pantorrillas",
    "movementPattern": "Flexión plantar",
    "trainingType": "POWER"
  },
  {
    "name": "Elevación de talón unilateral",
    "equipment": "Peso corporal",
    "muscleGroup": "Pantorrillas",
    "movementPattern": "Flexión plantar",
    "trainingType": "POWER"
  }
]].map(exercise=>({...exercise,...exerciseGuides[exercise.name]}));
