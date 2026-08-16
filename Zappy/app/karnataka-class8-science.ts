/**
 * Verified, source-bound Karnataka Class 8 Science data.
 *
 * This module intentionally contains no generated lesson durations, previous-year
 * question claims, appearance frequencies, or exam probabilities. The questions
 * below are official practice/question-bank material from the cited 2025-26 DSERT
 * Lesson Based Assessment document.
 */

export type DsertSciencePart = "Part-1" | "Part-2";
export type OfficialPracticeDifficulty = "Easy" | "Average" | "Difficult";
export type OfficialPracticeQuestionType =
  | "multiple-choice"
  | "one-mark-answer"
  | "two-mark-answer"
  | "three-mark-answer"
  | "four-mark-answer";

export type DsertScienceUnit = {
  sourceOrder: number;
  unitNumber: number;
  part: DsertSciencePart;
  title: string;
  indexedContentPageRange: string;
};

export type OfficialPracticeQuestion = {
  id: string;
  sourceNumber: number;
  sourceSection: "I" | "II" | "III" | "IV" | "V";
  questionType: OfficialPracticeQuestionType;
  marks: 1 | 2 | 3 | 4;
  difficulty: OfficialPracticeDifficulty;
  prompt: string;
  options?: readonly string[];
  /** One-indexed pages in the 96-page source PDF. */
  sourcePdfPages: readonly number[];
  evidenceKind: "official-practice-question-bank";
  isPreviousYearQuestion: false;
};

export type OfficialLearningOutcome = {
  id: string;
  sourceNumber: number;
  text: string;
  /** One-indexed pages in the 96-page source PDF. */
  sourcePdfPages: readonly number[];
  evidenceKind: "official-learning-outcome";
};

export const KARNATAKA_CLASS_8_SCIENCE_SOURCE = {
  authority: "Department of State Educational Research and Training (DSERT), Karnataka",
  documentTitle: "Lesson Based Assessment Material",
  academicYear: "2025-26",
  board: "Karnataka State Board",
  grade: "Class 8",
  subject: "Science",
  medium: "English",
  documentType: "official-practice-question-bank",
  pdfUrl:
    "https://dsert.karnataka.gov.in/storage/pdf-files/lba/8thLBAScienceEM1.pdf",
  landingPageUrl:
    "https://dsert.karnataka.gov.in/50/Lesson%20Based%20Assesment%20material/en",
  pdfPageCount: 96,
  indexPdfPage: 3,
  verifiedOn: "2026-08-01",
  evidenceNotice:
    "Official 2025-26 DSERT lesson-based assessment material. Its questions are official practice/question-bank items, not previous-year examination questions.",
} as const;

/**
 * Exact order, unit numbers, part labels, titles, and printed content-page ranges
 * shown in the source index on physical PDF page 3. Source spelling is retained.
 */
export const KARNATAKA_CLASS_8_SCIENCE_UNITS = [
  {
    sourceOrder: 1,
    unitNumber: 1,
    part: "Part-1",
    title: "Crop Production and Management",
    indexedContentPageRange: "1-6",
  },
  {
    sourceOrder: 2,
    unitNumber: 2,
    part: "Part-1",
    title: "Micro Organisms Friend and Foe",
    indexedContentPageRange: "7-9",
  },
  {
    sourceOrder: 3,
    unitNumber: 3,
    part: "Part-1",
    title: "Coal and Petroleum",
    indexedContentPageRange: "10-13",
  },
  {
    sourceOrder: 4,
    unitNumber: 4,
    part: "Part-1",
    title: "Combustion and Flame",
    indexedContentPageRange: "14-17",
  },
  {
    sourceOrder: 5,
    unitNumber: 8,
    part: "Part-1",
    title: "Force and Pressure",
    indexedContentPageRange: "18-21",
  },
  {
    sourceOrder: 6,
    unitNumber: 9,
    part: "Part-1",
    title: "Friction",
    indexedContentPageRange: "22-26",
  },
  {
    sourceOrder: 7,
    unitNumber: 5,
    part: "Part-2",
    title: "Conservation of Plants and Animals",
    indexedContentPageRange: "27-29",
  },
  {
    sourceOrder: 8,
    unitNumber: 6,
    part: "Part-2",
    title: "Reproduction in Animals",
    indexedContentPageRange: "30-33",
  },
  {
    sourceOrder: 9,
    unitNumber: 7,
    part: "Part-2",
    title: "Reaching of Adoloscence",
    indexedContentPageRange: "34-36",
  },
  {
    sourceOrder: 10,
    unitNumber: 10,
    part: "Part-2",
    title: "Sound",
    indexedContentPageRange: "37-39",
  },
  {
    sourceOrder: 11,
    unitNumber: 11,
    part: "Part-2",
    title: "Chemical effects of Electric Current",
    indexedContentPageRange: "40-43",
  },
  {
    sourceOrder: 12,
    unitNumber: 12,
    part: "Part-2",
    title: "Natural Phenomena",
    indexedContentPageRange: "44-46",
  },
  {
    sourceOrder: 13,
    unitNumber: 13,
    part: "Part-2",
    title: "Light",
    indexedContentPageRange: "47-52",
  },
] as const satisfies readonly DsertScienceUnit[];

export const KARNATAKA_CLASS_8_SCIENCE_LEGACY_DIKSHA_BOOK = {
  bookId: "do_31312970330422476812389",
  url: "https://diksha.gov.in/play/collection/do_31312970330422476812389",
  classification: "legacy-reference-only",
  currentSyllabusVerified: false,
  notice:
    "Legacy DIKSHA collection. Do not use it as proof of the current Karnataka Class 8 Science syllabus.",
} as const;

export const KARNATAKA_CLASS_8_SCIENCE_2026_27_NOTICE = {
  academicYear: "2026-27",
  verificationStatus: "pending",
  lastVerifiedOfficialAcademicYear: "2025-26",
  notice:
    "A 2026-27 official DSERT or Karnataka Textbook Society Class 8 Science edition has not been verified for this dataset. Keep the 2025-26 year visible and do not label these units as verified for 2026-27.",
} as const;

/**
 * Exact source wording from the Force and Pressure learning-outcomes block on
 * physical PDF page 21. Typographical and grammatical source errors are retained.
 */
export const FORCE_AND_PRESSURE_OFFICIAL_LEARNING_OUTCOMES = [
  {
    id: "dsert-2025-26-force-pressure-lo1",
    sourceNumber: 1,
    text: "Define force",
    sourcePdfPages: [21],
    evidenceKind: "official-learning-outcome",
  },
  {
    id: "dsert-2025-26-force-pressure-lo2",
    sourceNumber: 2,
    text: "Identify the situations where force is applied.",
    sourcePdfPages: [21],
    evidenceKind: "official-learning-outcome",
  },
  {
    id: "dsert-2025-26-force-pressure-lo3",
    sourceNumber: 3,
    text: "Recognise push and pull types of actions applied during diifferent daily life situations.",
    sourcePdfPages: [21],
    evidenceKind: "official-learning-outcome",
  },
  {
    id: "dsert-2025-26-force-pressure-lo4",
    sourceNumber: 4,
    text: "Narrate and list the effects of force on the objects.",
    sourcePdfPages: [21],
    evidenceKind: "official-learning-outcome",
  },
  {
    id: "dsert-2025-26-force-pressure-lo5",
    sourceNumber: 5,
    text: "Name different types of forces.",
    sourcePdfPages: [21],
    evidenceKind: "official-learning-outcome",
  },
  {
    id: "dsert-2025-26-force-pressure-lo6",
    sourceNumber: 6,
    text: "Mention the examples for different types of forces.",
    sourcePdfPages: [21],
    evidenceKind: "official-learning-outcome",
  },
  {
    id: "dsert-2025-26-force-pressure-lo7",
    sourceNumber: 7,
    text: "Differentiate between force and pressure",
    sourcePdfPages: [21],
    evidenceKind: "official-learning-outcome",
  },
  {
    id: "dsert-2025-26-force-pressure-lo8",
    sourceNumber: 8,
    text: "Differentiate between different kinds of forces.",
    sourcePdfPages: [21],
    evidenceKind: "official-learning-outcome",
  },
  {
    id: "dsert-2025-26-force-pressure-lo9",
    sourceNumber: 9,
    text: "Decide how frictional force acts as ‘ friend ‘ and as ‘ foe’ in day to day life situations",
    sourcePdfPages: [21],
    evidenceKind: "official-learning-outcome",
  },
  {
    id: "dsert-2025-26-force-pressure-lo10",
    sourceNumber: 10,
    text: "Prove that liquids and gases also exerts pressure with the help of demonstrations.",
    sourcePdfPages: [21],
    evidenceKind: "official-learning-outcome",
  },
  {
    id: "dsert-2025-26-force-pressure-lo11",
    sourceNumber: 11,
    text: "Define atmospheric pressure",
    sourcePdfPages: [21],
    evidenceKind: "official-learning-outcome",
  },
  {
    id: "dsert-2025-26-force-pressure-lo12",
    sourceNumber: 12,
    text: "Mention the importance of gravitational force",
    sourcePdfPages: [21],
    evidenceKind: "official-learning-outcome",
  },
] as const satisfies readonly OfficialLearningOutcome[];

const OFFICIAL_PRACTICE_EVIDENCE = {
  evidenceKind: "official-practice-question-bank",
  isPreviousYearQuestion: false,
} as const;

/**
 * Verbatim Force and Pressure practice/question-bank items that can be read from
 * physical PDF pages 22-24. Source numbering is preserved, including its jump
 * from question 8 to question 10.
 */
export const FORCE_AND_PRESSURE_OFFICIAL_QUESTION_BANK = [
  {
    id: "dsert-2025-26-force-pressure-q1",
    sourceNumber: 1,
    sourceSection: "I",
    questionType: "multiple-choice",
    marks: 1,
    difficulty: "Easy",
    prompt: "The SI unit of pressure is",
    options: [
      "A. Newton",
      "B. Newton/meter",
      "C. Newton/ kilogram",
      "D. Newton/meter 2",
    ],
    sourcePdfPages: [22],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q2",
    sourceNumber: 2,
    sourceSection: "I",
    questionType: "multiple-choice",
    marks: 1,
    difficulty: "Average",
    prompt: "The pressure exerted by liquids is",
    options: [
      "A) Increases with depth",
      "B) Decreases with depth",
      "C) Remains constant",
      "D) First increases and then decreases",
    ],
    sourcePdfPages: [22],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q3",
    sourceNumber: 3,
    sourceSection: "I",
    questionType: "multiple-choice",
    marks: 1,
    difficulty: "Average",
    prompt: "The pressure exerted at the bottom of liquids depends on",
    options: [
      "A) The area of the container",
      "B) The shape assumed by the liquid",
      "C) The shape of the reservoir",
      "D) The volume of the liquid",
    ],
    sourcePdfPages: [22],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q4",
    sourceNumber: 4,
    sourceSection: "I",
    questionType: "multiple-choice",
    marks: 1,
    difficulty: "Average",
    prompt: "The pressure exerted at a given point in liquids is",
    options: [
      "A) Directly proportional to the depth of the liquid at that point",
      "B) Directly proportional to the density of the liquid",
      "C) Both A and B",
      "D) Inversely proportional to the density and volume of the liquids",
    ],
    sourcePdfPages: [22],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q5",
    sourceNumber: 5,
    sourceSection: "I",
    questionType: "multiple-choice",
    marks: 1,
    difficulty: "Easy",
    prompt: "Pressure exerted by liquids is always more towards",
    options: [
      "A) the walls of the container",
      "B) the bottom of the container",
      "C) all the directions",
      "D) the surface only",
    ],
    sourcePdfPages: [22],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q6",
    sourceNumber: 6,
    sourceSection: "I",
    questionType: "multiple-choice",
    marks: 1,
    difficulty: "Average",
    prompt:
      "one that is not an effect of force on an object among the following is, the force changes",
    options: [
      "A) shape of that object.",
      "B) mass of that object.",
      "C) the direction of movement",
      "D) the position of that object.",
    ],
    sourcePdfPages: [22, 23],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q7",
    sourceNumber: 7,
    sourceSection: "I",
    questionType: "multiple-choice",
    marks: 1,
    difficulty: "Easy",
    prompt: "An illustration for a contact force is",
    options: [
      "A) falling of an apple from apple tree",
      "B) repulsion between the like poles of two magnets",
      "C) pushing a car",
      "D) attraction of paper pieces towards a charged plastic comb",
    ],
    sourcePdfPages: [23],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q8",
    sourceNumber: 8,
    sourceSection: "I",
    questionType: "multiple-choice",
    marks: 1,
    difficulty: "Easy",
    prompt:
      "Statement A: Magnetic force is a non-contact force\nReason B : Non-contact force does not involve contact between objects",
    options: [
      "A) Statement A is correct; reason in the statement B is incorrect",
      "B) Statement A is incorrect ;reason in the statement B is correct",
      "C) Both of the statements are correct",
      "D) Both of the statements are incorrect",
    ],
    sourcePdfPages: [23],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q10",
    sourceNumber: 10,
    sourceSection: "I",
    questionType: "multiple-choice",
    marks: 1,
    difficulty: "Average",
    prompt: "Force means…",
    options: [
      "A) pushing an object",
      "B) either pushing or pulling of an object",
      "C) pulling an object",
      "D) displacing an object",
    ],
    sourcePdfPages: [23],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q11",
    sourceNumber: 11,
    sourceSection: "I",
    questionType: "multiple-choice",
    marks: 1,
    difficulty: "Easy",
    prompt:
      "When we rub our palms then the average temperature of the body increases a little . The force responsible for this effect is",
    options: [
      "A) Magnetic force",
      "B) Gravitational force",
      "C) Electrostatic force",
      "D) Frictional force",
    ],
    sourcePdfPages: [23],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q12",
    sourceNumber: 12,
    sourceSection: "I",
    questionType: "multiple-choice",
    marks: 1,
    difficulty: "Easy",
    prompt: "A situation in which the least friction is found is",
    options: [
      "A) walking on grass lawn with bare foot",
      "B) running cycle on muddy road",
      "C) writing on a paper with a pen",
      "D) rotation of a machine with the help of ball bearings",
    ],
    sourcePdfPages: [23],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q13",
    sourceNumber: 13,
    sourceSection: "I",
    questionType: "multiple-choice",
    marks: 1,
    difficulty: "Difficult",
    prompt:
      "An arrangement that indicates the descending order of friction among the following is",
    options: [
      "A) Rolling friction, static friction, sliding friction.",
      "B) Rolling friction, sliding friction, static friction",
      "C) Static friction, sliding friction, rolling friction",
      "D) Sliding friction, static friction, rolling friction",
    ],
    sourcePdfPages: [23],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q14",
    sourceNumber: 14,
    sourceSection: "I",
    questionType: "multiple-choice",
    marks: 1,
    difficulty: "Difficult",
    prompt:
      "If you push a wooden box on a sandy floor, marble floor and carpet floor then the degree of friction increases as in the order",
    options: [
      "A) Sand floor, marble floor, carpet floor",
      "B) Carpet floor, sand floor, marble floor",
      "C) Marble floor, carpet floor, sand floor",
      "D) Marble floor, sand floor, carpet floor",
    ],
    sourcePdfPages: [23],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q15",
    sourceNumber: 15,
    sourceSection: "II",
    questionType: "one-mark-answer",
    marks: 1,
    difficulty: "Easy",
    prompt: "Name the instrument used to measure the pressure difference of liquids.",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q16",
    sourceNumber: 16,
    sourceSection: "II",
    questionType: "one-mark-answer",
    marks: 1,
    difficulty: "Easy",
    prompt: "What is ‘gravitational force’?",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q17",
    sourceNumber: 17,
    sourceSection: "II",
    questionType: "one-mark-answer",
    marks: 1,
    difficulty: "Average",
    prompt: "Force is considered as Vector quantity. Why?",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q18",
    sourceNumber: 18,
    sourceSection: "II",
    questionType: "one-mark-answer",
    marks: 1,
    difficulty: "Average",
    prompt: "Define ‘atmospheric pressure’.",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q19",
    sourceNumber: 19,
    sourceSection: "II",
    questionType: "one-mark-answer",
    marks: 1,
    difficulty: "Easy",
    prompt: "What is ‘force of gravity’?",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q20",
    sourceNumber: 20,
    sourceSection: "II",
    questionType: "one-mark-answer",
    marks: 1,
    difficulty: "Average",
    prompt: "Define ‘pressure’.",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q21",
    sourceNumber: 21,
    sourceSection: "II",
    questionType: "one-mark-answer",
    marks: 1,
    difficulty: "Average",
    prompt: "“Submarines are made of strong and thick materials”. Why?",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q22",
    sourceNumber: 22,
    sourceSection: "III",
    questionType: "two-mark-answer",
    marks: 2,
    difficulty: "Difficult",
    prompt:
      "Explain an experiment to show that the pressure of liquids depends on their densities.",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q23",
    sourceNumber: 23,
    sourceSection: "III",
    questionType: "two-mark-answer",
    marks: 2,
    difficulty: "Difficult",
    prompt: "Do liquids and gases also exert pressure? Justify your answer.",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q24",
    sourceNumber: 24,
    sourceSection: "III",
    questionType: "two-mark-answer",
    marks: 2,
    difficulty: "Average",
    prompt:
      "Identify the type of force that is depicted in the following examples. (in terms of contact or non-contact force)\ni) Extraction of sugar cane juice using a suitable device.\nii) Attraction of iron filings towards a magnet.\nIii) Coconut falling from a tree.\niv) Lifting of a rice bag",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q25",
    sourceNumber: 25,
    sourceSection: "III",
    questionType: "two-mark-answer",
    marks: 2,
    difficulty: "Average",
    prompt: "List any four effects of force on the objects.",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q26",
    sourceNumber: 26,
    sourceSection: "III",
    questionType: "two-mark-answer",
    marks: 2,
    difficulty: "Average",
    prompt:
      "Name the two forces exerted on a ball when it is thrown downwards from the terrace of a tall building towards the ground.",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q27",
    sourceNumber: 27,
    sourceSection: "III",
    questionType: "two-mark-answer",
    marks: 2,
    difficulty: "Easy",
    prompt: "List any two advantages of frictional force.",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q28",
    sourceNumber: 28,
    sourceSection: "III",
    questionType: "two-mark-answer",
    marks: 2,
    difficulty: "Difficult",
    prompt: "Is it possible to walk easily on wet ground? Justify your answer.",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q29",
    sourceNumber: 29,
    sourceSection: "IV",
    questionType: "three-mark-answer",
    marks: 3,
    difficulty: "Difficult",
    prompt:
      "Give reason.\na) A camel walks easily on sand.\nb) Sailors who swim in the deep sea should wear prescribed clothes.\nc) A lizard easily moves on a wall.",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q30",
    sourceNumber: 30,
    sourceSection: "IV",
    questionType: "three-mark-answer",
    marks: 3,
    difficulty: "Difficult",
    prompt:
      "Explain the reasons for the following practices.\na ) A sharp knife will be used to cut fruits/to chop vegetables but not a blunt knife.\nb ) Usually, people keep a cloth or a rope while carrying heavy objects on their heads.",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
  {
    id: "dsert-2025-26-force-pressure-q31",
    sourceNumber: 31,
    sourceSection: "V",
    questionType: "four-mark-answer",
    marks: 4,
    difficulty: "Difficult",
    prompt:
      "a) How does the sun control planetary motion in our solar system?\nb) What causes the downward movement of river water?\nc) ‘ Frictional force acts as both advantageous and disadvantageous’. How? Justify with illustrations .",
    sourcePdfPages: [24],
    ...OFFICIAL_PRACTICE_EVIDENCE,
  },
] as const satisfies readonly OfficialPracticeQuestion[];

export const FORCE_AND_PRESSURE_SOURCE_INTEGRITY = {
  sourceDifficultyTable: {
    statedTotal: 31,
    byDifficulty: {
      Easy: 10,
      Average: 13,
      Difficult: 8,
    },
    byMarks: {
      1: { Easy: 9, Average: 9, Difficult: 2 },
      2: { Easy: 1, Average: 3, Difficult: 3 },
      3: { Easy: 0, Average: 1, Difficult: 2 },
      4: { Easy: 0, Average: 0, Difficult: 1 },
      5: { Easy: 0, Average: 0, Difficult: 0 },
    },
  },
  verifiedEnumeratedItemCount: 30,
  missingSourceNumbers: [9],
  notice:
    "The source table states 31 questions, but the printed bank exposes 30 numbered items and jumps from question 8 to question 10. No wording is inferred for question 9, so it is omitted.",
} as const;
