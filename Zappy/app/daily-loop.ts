export type LoopConfidence = "needs-help" | "steady" | "mastered";

export type DailyLoopEntry = {
  date: string;
  chapterIndex: number;
  chapter: string;
  confidence: LoopConfidence;
};

export type DailyLoopState = {
  version: 1;
  board: string;
  grade: string;
  subject: string;
  bookId: string;
  bookName: string;
  sourceFingerprint: string;
  chapterIndex: number;
  nextChapterIndex: number;
  dayKey: string;
  completedToday: boolean;
  lastConfidence: LoopConfidence | null;
  sessionMinutes: 8 | 15 | 25 | 40;
  reminderEnabled: boolean;
  reminderTime: string;
  history: DailyLoopEntry[];
};

export const DAILY_LOOP_STORAGE_VERSION = 1 as const;

export function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayOffset(dayKey: string, offset: number) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + offset);
  return localDayKey(date);
}

function safeIndex(index: number, chapterCount: number) {
  return Math.max(0, Math.min(Math.max(0, chapterCount - 1), index));
}

export function createDailyLoopState(input: {
  board: string;
  grade: string;
  subject: string;
  bookId: string;
  bookName: string;
  sourceFingerprint: string;
  chapterIndex: number;
  sessionMinutes: 8 | 15 | 25 | 40;
  reminderEnabled: boolean;
  reminderTime: string;
  today?: string;
}): DailyLoopState {
  return {
    version: DAILY_LOOP_STORAGE_VERSION,
    board: input.board,
    grade: input.grade,
    subject: input.subject,
    bookId: input.bookId,
    bookName: input.bookName,
    sourceFingerprint: input.sourceFingerprint,
    chapterIndex: input.chapterIndex,
    nextChapterIndex: input.chapterIndex,
    dayKey: input.today ?? localDayKey(),
    completedToday: false,
    lastConfidence: null,
    sessionMinutes: input.sessionMinutes,
    reminderEnabled: input.reminderEnabled,
    reminderTime: input.reminderTime,
    history: [],
  };
}

export function parseDailyLoopState(raw: string | null) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DailyLoopState>;
    if (
      value.version !== DAILY_LOOP_STORAGE_VERSION ||
      typeof value.board !== "string" ||
      typeof value.grade !== "string" ||
      typeof value.subject !== "string" ||
      typeof value.bookId !== "string" ||
      typeof value.bookName !== "string" ||
      typeof value.sourceFingerprint !== "string" ||
      typeof value.chapterIndex !== "number" ||
      typeof value.nextChapterIndex !== "number" ||
      typeof value.dayKey !== "string" ||
      typeof value.completedToday !== "boolean" ||
      ![8, 15, 25, 40].includes(value.sessionMinutes ?? 0) ||
      typeof value.reminderEnabled !== "boolean" ||
      typeof value.reminderTime !== "string" ||
      !Array.isArray(value.history)
    ) {
      return null;
    }
    return value as DailyLoopState;
  } catch {
    return null;
  }
}

export function rollDailyLoop(
  state: DailyLoopState,
  today: string,
  chapterCount: number,
): DailyLoopState {
  if (state.dayKey === today) {
    const chapterIndex = safeIndex(state.chapterIndex, chapterCount);
    const nextChapterIndex = safeIndex(state.nextChapterIndex, chapterCount);
    return chapterIndex === state.chapterIndex &&
      nextChapterIndex === state.nextChapterIndex
      ? state
      : { ...state, chapterIndex, nextChapterIndex };
  }

  const chapterIndex = safeIndex(
    state.completedToday ? state.nextChapterIndex : state.chapterIndex,
    chapterCount,
  );
  return {
    ...state,
    dayKey: today,
    chapterIndex,
    nextChapterIndex: chapterIndex,
    completedToday: false,
    lastConfidence: null,
  };
}

export function completeDailyLoop(
  state: DailyLoopState,
  confidence: LoopConfidence,
  chapterTitles: string[],
): DailyLoopState {
  if (state.completedToday || !chapterTitles.length) return state;
  const chapterIndex = safeIndex(state.chapterIndex, chapterTitles.length);
  const canAdvance =
    confidence !== "needs-help" && chapterIndex < chapterTitles.length - 1;
  const nextChapterIndex = canAdvance ? chapterIndex + 1 : chapterIndex;
  const entry: DailyLoopEntry = {
    date: state.dayKey,
    chapterIndex,
    chapter: chapterTitles[chapterIndex],
    confidence,
  };

  return {
    ...state,
    chapterIndex,
    nextChapterIndex,
    completedToday: true,
    lastConfidence: confidence,
    history: [
      ...state.history.filter((item) => item.date !== state.dayKey),
      entry,
    ].slice(-60),
  };
}

export function calculateDailyStreak(
  history: DailyLoopEntry[],
  today: string,
) {
  const completed = new Set(history.map((entry) => entry.date));
  let cursor = completed.has(today) ? today : dayOffset(today, -1);
  let streak = 0;
  while (completed.has(cursor)) {
    streak += 1;
    cursor = dayOffset(cursor, -1);
  }
  return streak;
}

export function getDailyRecommendation(
  state: DailyLoopState,
  chapterTitles: string[],
) {
  const currentIndex = safeIndex(state.chapterIndex, chapterTitles.length);
  const nextIndex = safeIndex(state.nextChapterIndex, chapterTitles.length);
  const currentChapter = chapterTitles[currentIndex] ?? "";
  const nextChapter = chapterTitles[nextIndex] ?? currentChapter;
  const courseComplete =
    state.completedToday &&
    state.lastConfidence !== "needs-help" &&
    currentIndex === chapterTitles.length - 1;

  if (!state.completedToday) {
    return {
      currentChapter,
      nextChapter:
        currentIndex < chapterTitles.length - 1
          ? chapterTitles[currentIndex + 1]
          : currentChapter,
      action: "continue" as const,
      courseComplete: false,
      reason:
        "This is the next item in the verified curriculum sequence you selected.",
    };
  }

  if (state.lastConfidence === "needs-help") {
    return {
      currentChapter,
      nextChapter: currentChapter,
      action: "revisit" as const,
      courseComplete: false,
      reason:
        "You marked this as needing help, so tomorrow repeats it with a simpler explanation before advancing.",
    };
  }

  if (courseComplete) {
    return {
      currentChapter,
      nextChapter: currentChapter,
      action: "complete" as const,
      courseComplete: true,
      reason:
        "You reached the final sourced item in this subject. Zappy will not jump into an unrelated or unsupported topic.",
    };
  }

  return {
    currentChapter,
    nextChapter,
    action: "advance" as const,
    courseComplete: false,
    reason:
      state.lastConfidence === "mastered"
        ? "You marked today’s item mastered, so tomorrow advances one step in the same verified source."
        : "You marked today’s item steady, so tomorrow advances one step and begins with a short retrieval check.",
  };
}
