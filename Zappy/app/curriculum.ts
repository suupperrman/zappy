import imported from "./curriculum.index.json";

export const BOARD_OPTIONS = [
  "CBSE",
  "Karnataka State Board",
  "Kerala State Board",
  "Tamil Nadu State Board",
  "Telangana State Board",
  "ICSE / ISC",
] as const;

export const GRADE_OPTIONS = [
  "LKG",
  "UKG",
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
  "Class 11",
  "Class 12",
] as const;

export type CurriculumCoverage =
  | "textbook-catalogue"
  | "framework"
  | "syllabus";

export type CurriculumBook = {
  name: string;
  mediums: string[];
  edition: string;
  source: string;
};

export type CurriculumRecord = {
  board: string;
  grade: string;
  subject: string;
  book: string;
  books: CurriculumBook[];
  edition: string;
  source: string;
  sourceLabel: string;
  chapters: string[];
  modules: string[];
  coverage: CurriculumCoverage;
  coverageLabel: string;
  coverageNote: string;
};

type IndexedRecord = {
  board: string;
  grade: string;
  subject: string;
  books: CurriculumBook[];
  chapters: string[];
  source: string;
  sourceLabel: string;
};

const records = imported.records as IndexedRecord[];

const NCF_FOUNDATIONAL_SOURCE =
  "https://www.ncert.nic.in/pdf/NCF_for_Foundational_Stage_20_October_2022.pdf";
const CISCE_PRESCHOOL_SOURCE =
  "https://cisce.org/wp-content/uploads/2022/10/PreSchoolCurriculum2.pdf";
const CISCE_PRIMARY_SOURCE =
  "https://cisce.org/wp-content/uploads/2025/03/PrimaryCurriculum.pdf";
const CISCE_UPPER_PRIMARY_SOURCE =
  "https://www.cisce.org/wp-content/uploads/2022/10/UpperPrimary.pdf";
const ICSE_SYLLABUS_SOURCE =
  "https://cisce.org/icse-regulations-and-syllabuses-2027/";
const ISC_SYLLABUS_SOURCE =
  "https://cisce.org/isc-regulations-and-syllabuses-2027/";

/*
 * These are NCF-FS curricular goals, not LKG/UKG textbook chapters. State and
 * school curriculum developers contextualise this national framework.
 */
const NCF_FOUNDATIONAL_MODULES: Record<string, string[]> = {
  "Physical Development": [
    "CG-1 · Healthy and safe habits",
    "CG-2 · Sharpness in sensorial perceptions",
    "CG-3 · A fit and flexible body",
  ],
  "Socio-Emotional and Ethical Development": [
    "CG-4 · Emotional intelligence and positive response to social norms",
    "CG-5 · Productive work and service or Seva",
    "CG-6 · Positive regard for the natural environment",
  ],
  "Cognitive Development": [
    "CG-7 · Observation and logical thinking about the world",
    "CG-8 · Quantities, shapes and measures",
  ],
  "Language and Literacy Development": [
    "CG-9 · Communication for day-to-day interactions in two languages",
    "CG-10 · Reading and writing in Language 1",
    "CG-11 · Beginning to read and write in Language 2",
  ],
  "Aesthetic and Cultural Development": [
    "CG-12 · Visual and performing arts, expression and appreciation",
  ],
  "Positive Learning Habits": [
    "CG-13 · Habits for active engagement in formal learning environments",
  ],
};

/*
 * CISCE names six integrated preschool learning areas. The items below are
 * high-level areas within those domains, never represented as book chapters.
 */
const CISCE_PRESCHOOL_MODULES: Record<string, string[]> = {
  "Personal, Social and Emotional Development": [
    "Self and adjustment to preschool",
    "Social relationships, life skills and values",
  ],
  "Physical and Motor Development": [
    "Gross motor development",
    "Fine motor development",
    "Physical fitness, hygiene and cleanliness",
  ],
  "Cognitive Development": [
    "Early mathematics or mathematical readiness",
    "Environmental concepts or studies",
    "Early science experiences",
  ],
  "Language and Literacy Development": [
    "Listening and speaking",
    "Reading readiness",
    "Writing readiness",
  ],
  "Arts and Creative Development": [
    "Art and creative expression",
    "Music and movement",
  ],
  Technology: ["Computer play"],
};

const CISCE_PRIMARY_BASE = [
  "English",
  "Second Language",
  "Mathematics",
] as const;

const CISCE_PRIMARY_ADDITIONAL = [
  "Computer Studies",
  "Arts Education",
  "Physical Education / Yoga",
  "Education in Moral and Spiritual Values",
] as const;

const CISCE_UPPER_PRIMARY_SUBJECTS = [
  "English",
  "Second Language",
  "Mathematics",
  "Science",
  "History, Civics and Geography",
  "Computer Studies",
  "Arts Education",
  "Third Language",
  "Physical Education / Yoga",
  "Education in Moral and Spiritual Values",
  "SUPW and Community Service",
] as const;

/*
 * Official ICSE 2027 Groups I–III, with compulsory internal areas appended.
 * Availability of elective and vocational subjects depends on the school.
 */
const ICSE_SUBJECTS = [
  "English",
  "Second Language",
  "History, Civics and Geography",
  "Mathematics",
  "Science",
  "Economics",
  "Commercial Studies",
  "Modern Foreign Language",
  "Classical Language",
  "Environmental Science",
  "Computer Applications",
  "Economic Applications",
  "Commercial Applications",
  "Art",
  "Performing Arts",
  "Home Science",
  "Cookery",
  "Fashion Designing",
  "Physical Education",
  "Yoga",
  "Technical Drawing Applications",
  "Environmental Applications",
  "Mass Media & Communication",
  "Hospitality Management",
  "Robotics and Artificial Intelligence",
  "Assistant Beauty Therapist",
  "Assistant Hair Stylist",
  "Basic Data Entry Operator",
  "Dietetic Aide",
  "Cashier",
  "Early Years Physical Activity Facilitator",
  "Auto Service Technician",
  "SUPW and Community Service",
  "Education in Moral and Spiritual Values",
] as const;

/*
 * Official ISC 2027 external subjects plus compulsory internal SUPW.
 * A school only offers subjects for which it has made teaching provision.
 */
const ISC_SUBJECTS = [
  "English / Modern English",
  "Indian Language",
  "Modern Foreign Language",
  "Classical Language",
  "Elective English",
  "History",
  "Political Science",
  "Geography",
  "Sociology",
  "Psychology",
  "Economics",
  "Commerce",
  "Accountancy",
  "Business Studies",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Home Science",
  "Fashion Designing",
  "Electricity & Electronics",
  "Engineering Science",
  "Computer Science",
  "Geometrical & Mechanical Drawing",
  "Geometrical & Building Drawing",
  "Art",
  "Music",
  "Physical Education",
  "Environmental Science",
  "Biotechnology",
  "Mass Media & Communication",
  "Hospitality Management",
  "Legal Studies",
  "Artificial Intelligence",
  "Robotics",
  "Applied Mathematics",
  "SUPW and Community Service",
] as const;

function classNumber(grade: string) {
  const match = /^Class (\d{1,2})$/.exec(grade);
  return match ? Number(match[1]) : undefined;
}

function canonicalBoard(board: string) {
  return board === "ICSE" ? "ICSE / ISC" : board;
}

function cisceSubjects(grade: string): string[] {
  if (grade === "LKG" || grade === "UKG") {
    return Object.keys(CISCE_PRESCHOOL_MODULES);
  }

  const level = classNumber(grade);
  if (!level) return [];

  if (level <= 2) {
    return [
      ...CISCE_PRIMARY_BASE,
      "Environmental Studies",
      ...CISCE_PRIMARY_ADDITIONAL,
    ];
  }

  if (level <= 4) {
    return [
      ...CISCE_PRIMARY_BASE,
      "Science",
      "Social Studies",
      ...CISCE_PRIMARY_ADDITIONAL,
    ];
  }

  if (level === 5) {
    return [
      ...CISCE_PRIMARY_BASE,
      "Science",
      "Social Studies",
      ...CISCE_PRIMARY_ADDITIONAL,
      "Third Language",
    ];
  }

  if (level <= 8) return [...CISCE_UPPER_PRIMARY_SUBJECTS];
  if (level <= 10) return [...ICSE_SUBJECTS];
  if (level <= 12) return [...ISC_SUBJECTS];
  return [];
}

function cisceModules(grade: string, subject: string): string[] {
  if (grade === "LKG" || grade === "UKG") {
    return CISCE_PRESCHOOL_MODULES[subject]
      ? [...CISCE_PRESCHOOL_MODULES[subject]]
      : [];
  }

  const level = classNumber(grade);
  if (level && level >= 9) {
    if (subject === "English") {
      return ["English Language", "Literature in English"];
    }
    if (subject === "English / Modern English") {
      return [
        "English or Modern English Language",
        "Literature in English",
      ];
    }
    if (subject === "Science") return ["Physics", "Chemistry", "Biology"];
    if (subject === "History, Civics and Geography") {
      return ["History and Civics", "Geography"];
    }
    return [`Official ${level <= 10 ? "ICSE" : "ISC"} ${subject} syllabus scope`];
  }

  const shared: Record<string, string[]> = {
    English: [
      "Listening and speaking",
      "Reading",
      "Writing",
      "Vocabulary and grammar",
    ],
    "Second Language": [
      "Listening and speaking",
      "Reading",
      "Writing",
      "Language and literature",
    ],
    Mathematics: [
      "Numbers and operations",
      "Fractions",
      "Geometry",
      "Measurement",
      "Data handling",
    ],
    "Environmental Studies": [
      "Natural environment",
      "Social environment",
      "Cultural environment",
    ],
    "History, Civics and Geography": ["History and Civics", "Geography"],
    "Computer Studies": ["Knowledge and skills in ICT"],
    "Arts Education": [
      "Creative expression",
      "Appreciation",
      "Working together",
    ],
    "Physical Education / Yoga": ["Physical Education and Yoga"],
    "Education in Moral and Spiritual Values": [
      "Moral and spiritual values",
    ],
    "SUPW and Community Service": ["SUPW and Community Service"],
  };

  if (shared[subject]) return [...shared[subject]];

  if (subject === "Science") {
    return level && level >= 6
      ? ["Physics", "Chemistry", "Biology"]
      : ["Science themes and learning outcomes"];
  }

  return [`Official CISCE ${grade} ${subject} curriculum area`];
}

function ncfFrameworkRecord(
  board: string,
  grade: string,
  subject: string,
): CurriculumRecord | undefined {
  const modules = NCF_FOUNDATIONAL_MODULES[subject];
  if (!modules) return undefined;

  const book: CurriculumBook = {
    name: "National Curriculum Framework for Foundational Stage",
    mediums: ["English", "Hindi"],
    edition: "2022",
    source: NCF_FOUNDATIONAL_SOURCE,
  };

  return {
    board,
    grade,
    subject,
    book: book.name,
    books: [book],
    edition: "NCF-FS 2022 · national framework, not a board textbook",
    source: NCF_FOUNDATIONAL_SOURCE,
    sourceLabel: "NCERT · National Curriculum Framework for Foundational Stage",
    chapters: [...modules],
    modules: [...modules],
    coverage: "framework",
    coverageLabel: "NCERT foundational framework",
    coverageNote:
      `${board} ${grade} is represented by the national NCF Foundational ` +
      "Stage framework only. This is not a board-specific LKG/UKG textbook " +
      "catalogue. Add the current board, state or school material for " +
      "page-level explanations.",
  };
}

function cisceFrameworkRecord(
  grade: string,
  subject: string,
): CurriculumRecord | undefined {
  if (!cisceSubjects(grade).includes(subject)) return undefined;

  const level = classNumber(grade);
  const isPreschool = grade === "LKG" || grade === "UKG";
  const isPrimary = Boolean(level && level <= 5);
  const isUpperPrimary = Boolean(level && level >= 6 && level <= 8);
  const isIcse = Boolean(level && level >= 9 && level <= 10);
  const coverage: CurriculumCoverage =
    isPreschool || isPrimary || isUpperPrimary ? "framework" : "syllabus";
  const source = isPreschool
    ? CISCE_PRESCHOOL_SOURCE
    : isPrimary
      ? CISCE_PRIMARY_SOURCE
      : isUpperPrimary
        ? CISCE_UPPER_PRIMARY_SOURCE
        : isIcse
          ? ICSE_SYLLABUS_SOURCE
          : ISC_SYLLABUS_SOURCE;
  const sourceName = isPreschool
    ? "CISCE Preschool Curriculum"
    : isPrimary
      ? "CISCE Curriculum for Primary Classes I–V"
      : isUpperPrimary
        ? "CISCE Curriculum for Upper Primary Classes VI–VIII"
        : isIcse
          ? "ICSE Regulations and Syllabuses 2027"
          : "ISC Regulations and Syllabuses 2027";
  const modules = cisceModules(grade, subject);
  const book: CurriculumBook = {
    name: sourceName,
    mediums: ["English"],
    edition: isIcse || (level !== undefined && level >= 11) ? "2027" : "Official framework",
    source,
  };

  return {
    board: "ICSE / ISC",
    grade,
    subject,
    book: book.name,
    books: [book],
    edition:
      coverage === "framework"
        ? "CISCE official curriculum framework · school textbook varies"
        : "CISCE Examination Year 2027 · verify the applicable exam-year edition",
    source,
    sourceLabel:
      coverage === "framework"
        ? "CISCE · Official curriculum framework"
        : `CISCE · Official ${isIcse ? "ICSE" : "ISC"} syllabus`,
    chapters: [...modules],
    modules: [...modules],
    coverage,
    coverageLabel:
      coverage === "framework"
        ? "CISCE curriculum framework"
        : `Official ${isIcse ? "ICSE" : "ISC"} syllabus`,
    coverageNote:
      coverage === "framework"
        ? "CISCE publishes this curriculum framework but does not prescribe " +
          "universal textbooks for Preschool–Class VIII. These are framework " +
          "areas, not textbook chapters. Add the school's chosen book for " +
          "page-level explanations."
        : "This is official CISCE syllabus-level coverage, not a universal " +
          "textbook catalogue. CISCE prescribes textbooks or study material " +
          "only for literature in English and other languages; schools choose " +
          "books for most other subjects. Add the school-selected book and " +
          "verify the applicable examination-year syllabus.",
  };
}

export function curriculumSubjects(board: string, grade: string) {
  const normalizedBoard = canonicalBoard(board);

  if (normalizedBoard === "ICSE / ISC") return cisceSubjects(grade);

  if (grade === "LKG" || grade === "UKG") {
    return Object.keys(NCF_FOUNDATIONAL_MODULES);
  }

  return [
    ...new Set(
      records
        .filter(
          (row) => row.board === normalizedBoard && row.grade === grade,
        )
        .map((row) => row.subject),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export function curriculumFor(
  board: string,
  grade: string,
  subject: string,
): CurriculumRecord | undefined {
  const normalizedBoard = canonicalBoard(board);

  if (normalizedBoard === "ICSE / ISC") {
    return cisceFrameworkRecord(grade, subject);
  }

  if (grade === "LKG" || grade === "UKG") {
    return ncfFrameworkRecord(normalizedBoard, grade, subject);
  }

  const row = records.find(
    (record) =>
      record.board === normalizedBoard &&
      record.grade === grade &&
      record.subject === subject,
  );
  if (!row) return undefined;

  return {
    board: normalizedBoard,
    grade,
    subject,
    book:
      row.books.length === 1
        ? row.books[0].name
        : `${row.books.length} DIKSHA textbooks`,
    books: row.books,
    edition: `Imported ${new Date(imported.generatedAt).toLocaleDateString("en-IN")} · check annual edition`,
    source: row.source,
    sourceLabel: row.sourceLabel,
    chapters: row.chapters,
    modules: row.chapters,
    coverage: "textbook-catalogue",
    coverageLabel: "DIKSHA textbook catalogue",
    coverageNote:
      "Exact textbook and chapter catalogue imported from DIKSHA. Zappy's " +
      "internal source adapter rechecks the Live record, per-item licence and " +
      "current asset before playback; catalogue titles alone never unlock an explanation.",
  };
}

export const curriculumStats = {
  authority: "DIKSHA · NCERT · CISCE official sources",
  importedAuthority: imported.authority,
  records: imported.recordCount,
  chapters: imported.chapterCount,
  boards: 6,
  textbookBoards: 5,
};
