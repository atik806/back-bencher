import type { Difficulty, Option, Question } from "@/engine/types";

type Row = [
  id: string,
  subject: string,
  difficulty: Difficulty,
  prompt: string,
  options: [string, string, string, string],
  correct: Option,
  aiAnswer: Option,
  confidence: number,
  note?: string,
];

// BrainGPT's answer is stored separately from the truth: where they differ, the AI is
// confidently (or not so confidently) wrong. That's the point.
const ROWS: Row[] = [
  // ---- easy: you probably know these yourself
  ["e1", "Math", "easy", "What is 7 × 8?", ["54", "56", "64", "48"], 1, 1, 99],
  ["e2", "Geography", "easy", "What is the capital of Japan?", ["Kyoto", "Osaka", "Tokyo", "Seoul"], 2, 2, 99],
  ["e3", "Science", "easy", "Water boils at what temperature at sea level?", ["90 °C", "100 °C", "110 °C", "212 °C"], 1, 1, 97],
  ["e4", "English", "easy", "Which word is a noun?", ["Quickly", "Happy", "Elephant", "Run"], 2, 2, 98],
  ["e5", "Science", "easy", "Which planet is known as the Red Planet?", ["Venus", "Mars", "Jupiter", "Mercury"], 1, 1, 99],
  ["e6", "Math", "easy", "What is half of 150?", ["65", "70", "75", "85"], 2, 2, 99],
  ["e7", "Biology", "easy", "How many legs does a spider have?", ["6", "8", "10", "12"], 1, 1, 98],
  ["e8", "Geography", "easy", "Which is the largest ocean?", ["Atlantic", "Indian", "Arctic", "Pacific"], 3, 3, 99],
  ["e9", "Math", "easy", "How many sides does a hexagon have?", ["5", "6", "7", "8"], 1, 1, 99],
  ["e10", "Science", "easy", "What gas do plants absorb from the air?", ["Oxygen", "Nitrogen", "Carbon dioxide", "Helium"], 2, 2, 96],
  ["e11", "General", "easy", "How many days are in a leap year?", ["364", "365", "366", "367"], 2, 2, 99],
  ["e12", "English", "easy", "What is the opposite of 'ancient'?", ["Old", "Modern", "Historic", "Rusty"], 1, 1, 97],
  ["e13", "Math", "easy", "What is 100 − 37?", ["63", "73", "67", "53"], 0, 0, 99],
  ["e14", "Science", "easy", "What is H₂O commonly called?", ["Salt", "Water", "Hydrogen", "Ozone"], 1, 1, 99],

  // ---- medium
  ["m1", "Chemistry", "medium", "What is the chemical symbol for gold?", ["Go", "Gd", "Au", "Ag"], 2, 2, 96],
  ["m2", "History", "medium", "In which year did World War II end?", ["1918", "1939", "1945", "1950"], 2, 2, 97],
  ["m3", "Physics", "medium", "What is the SI unit of force?", ["Joule", "Newton", "Watt", "Pascal"], 1, 1, 95],
  ["m4", "Biology", "medium", "Which organelle is called the powerhouse of the cell?", ["Nucleus", "Ribosome", "Mitochondria", "Golgi body"], 2, 2, 99, "Every student on Earth knows this one."],
  ["m5", "Math", "medium", "What is √144?", ["11", "12", "13", "14"], 1, 1, 98],
  ["m6", "Geography", "medium", "Which river is the longest in Asia?", ["Ganges", "Mekong", "Yangtze", "Indus"], 2, 2, 88],
  ["m7", "Literature", "medium", "Who wrote 'Romeo and Juliet'?", ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"], 1, 1, 99],
  ["m8", "Physics", "medium", "Light travels fastest through…", ["Water", "Glass", "Vacuum", "Diamond"], 2, 2, 93],
  ["m9", "Math", "medium", "If 3x + 5 = 20, what is x?", ["3", "4", "5", "6"], 2, 2, 97],
  ["m10", "Computer Science", "medium", "What does CPU stand for?", ["Central Processing Unit", "Computer Personal Unit", "Core Power Utility", "Central Program Uplink"], 0, 0, 99],
  ["m11", "Biology", "medium", "Which blood cells fight infection?", ["Red blood cells", "Platelets", "White blood cells", "Plasma"], 2, 2, 95],
  ["m12", "Chemistry", "medium", "What is the pH of pure water?", ["5", "7", "9", "14"], 1, 1, 94],
  ["m13", "History", "medium", "Who was the first person to walk on the Moon?", ["Buzz Aldrin", "Yuri Gagarin", "Neil Armstrong", "Michael Collins"], 2, 2, 98],
  ["m14", "Geography", "medium", "Mount Everest lies on the border of Nepal and…", ["India", "Bhutan", "China", "Pakistan"], 2, 0, 71, "Pretty sure it's India. Mountains are mostly in India."],
  ["m15", "Math", "medium", "What is 15% of 200?", ["15", "20", "30", "35"], 2, 2, 96],
  ["m16", "Physics", "medium", "What does a voltmeter measure?", ["Current", "Resistance", "Potential difference", "Power"], 2, 2, 90],

  // ---- hard: you'll want the phone
  ["h1", "Chemistry", "hard", "What is Avogadro's number (approx.)?", ["6.02 × 10²³", "3.00 × 10⁸", "9.81 × 10¹", "1.60 × 10⁻¹⁹"], 0, 0, 95],
  ["h2", "Math", "hard", "What is the derivative of sin(x)?", ["−cos(x)", "cos(x)", "tan(x)", "−sin(x)"], 1, 1, 97],
  ["h3", "Biology", "hard", "Which enzyme unwinds the DNA double helix?", ["Ligase", "Helicase", "Polymerase", "Primase"], 1, 2, 82, "DNA polymerase does everything in DNA, I believe."],
  ["h4", "Physics", "hard", "The escape velocity of Earth is about…", ["7.9 km/s", "11.2 km/s", "15.0 km/s", "3.0 km/s"], 1, 1, 91],
  ["h5", "History", "hard", "The Treaty of Westphalia was signed in…", ["1492", "1648", "1776", "1815"], 1, 1, 86],
  ["h6", "Math", "hard", "∫ 2x dx = ?", ["2", "x²  + C", "2x² + C", "x + C"], 1, 1, 96],
  ["h7", "Chemistry", "hard", "Which element has the highest electronegativity?", ["Oxygen", "Chlorine", "Fluorine", "Nitrogen"], 2, 2, 94],
  ["h8", "Economics", "hard", "When demand rises and supply is fixed, price…", ["Falls", "Rises", "Stays the same", "Becomes zero"], 1, 1, 92],
  ["h9", "Physics", "hard", "What is the unit of magnetic flux?", ["Tesla", "Weber", "Henry", "Gauss"], 1, 0, 78, "Tesla. Like the cars. Magnets. Makes sense."],
  ["h10", "Computer Science", "hard", "Binary search runs in what time complexity?", ["O(n)", "O(n²)", "O(log n)", "O(1)"], 2, 2, 97],
  ["h11", "Biology", "hard", "Where in the cell does the Krebs cycle take place?", ["Cytoplasm", "Mitochondrial matrix", "Nucleus", "Ribosome"], 1, 1, 89],
  ["h12", "Math", "hard", "How many ways can 5 books be arranged on a shelf?", ["25", "60", "120", "720"], 2, 2, 95],
  ["h13", "Geography", "hard", "Which country has the most time zones (incl. territories)?", ["Russia", "USA", "China", "France"], 3, 0, 84, "Russia is very big, so it's Russia."],
  ["h14", "Chemistry", "hard", "What is the hybridisation of carbon in methane?", ["sp", "sp²", "sp³", "sp³d"], 2, 2, 90],
  ["h15", "Physics", "hard", "Which quantity is conserved in an elastic collision but not an inelastic one?", ["Momentum", "Mass", "Kinetic energy", "Charge"], 2, 2, 88],
  ["h16", "History", "hard", "Which empire built Machu Picchu?", ["Aztec", "Maya", "Inca", "Olmec"], 2, 2, 93],
  ["h17", "Math", "hard", "What is log₂(64)?", ["5", "6", "7", "8"], 1, 1, 98],
  ["h18", "Literature", "hard", "Who wrote 'One Hundred Years of Solitude'?", ["Pablo Neruda", "Gabriel García Márquez", "Jorge Luis Borges", "Isabel Allende"], 1, 3, 64, "Allende, maybe? Or someone near her."],

  // ---- absurd: nobody knows these. The AI pretends it does.
  ["a1", "Ornithology", "absurd", "What is the airspeed velocity of an unladen swallow?", ["11 m/s", "24 m/s", "African or European?", "Depends on the coconut"], 0, 2, 66, "Did you mean African or European?"],
  ["a2", "Teacher Studies", "absurd", "How many cups of tea does Mr. Dozy drink per exam?", ["1", "3", "7", "He IS tea"], 2, 2, 41, "I'm guessing. Nobody has ever counted."],
  ["a3", "Campus Lore", "absurd", "What colour is the invigilator's lucky pen?", ["Red", "Blue", "Green", "Invisible"], 1, 0, 58],
  ["a4", "Philosophy", "absurd", "If a student cheats and nobody sees, did it happen?", ["Yes", "No", "Only on CCTV", "Ask the snitch"], 2, 2, 72],
  ["a5", "Advanced Napping", "absurd", "Optimal angle for sleeping on a desk without detection?", ["15°", "37°", "90°", "Upright, eyes painted on"], 1, 1, 61],
  ["a6", "Cafeteria Science", "absurd", "Mystery Meat Monday is mostly…", ["Chicken", "Hope", "Cardboard", "Classified"], 3, 1, 55, "Hope. Definitely hope."],
  ["a7", "Exam Theory", "absurd", "When unsure on an MCQ, the classic guess is…", ["A", "B", "C", "Pray"], 2, 2, 70],
  ["a8", "Pigeon Studies", "absurd", "How many pigeons live on the exam hall roof?", ["12", "42", "97", "One very large one"], 1, 1, 49],
  ["a9", "Wi-Fi Studies", "absurd", "The exam hall Wi-Fi password is…", ["password123", "noCheating!", "there is no wifi", "dozy1987"], 2, 1, 77, "Teachers always pick motivational passwords."],
  ["a10", "Rocket Surgery", "absurd", "Is it rocket science or brain surgery?", ["Rocket science", "Brain surgery", "Rocket surgery", "Neither, it's MCQs"], 3, 2, 68],
];

export const QUESTIONS: Question[] = ROWS.map(([id, subject, difficulty, prompt, options, correct, answer, confidence, note]) => ({
  id,
  subject,
  difficulty,
  prompt,
  options,
  correct,
  ai: { answer, confidence, note },
}));
