export const TEACHER_PREP_STORAGE_VERSION = 1 as const;

export type TeacherDurationSource = "teacher" | "school" | "official";
export type TeachingOutcome = "taught" | "partial" | "not-taught";
export type TeacherModuleSelectionReason =
  | "deferred-not-taught"
  | "needs-review"
  | "exact-current-chapter";

export type TeacherClassProfile = {
  classId: string;
  classLabel: string;
  medium: string;
  timetableWeekdays: number[];
  nextClassTime: string;
  periodMinutes: number;
  periodCount: number;
  durationSource: TeacherDurationSource;
  linkedStudentIds: string[];
};

export type TeachingHistoryEntry = {
  id: string;
  localDate: string;
  recordedAt: string;
  bookId: string;
  chapter: string;
  chapterIndex: number | null;
  outcome: TeachingOutcome;
  actualMinutes: number | null;
  needsReview: boolean;
};

export type TeacherSourceReference = {
  id: string;
  title: string;
};

export type TeacherScriptBlock = {
  id: string;
  label: string;
  startMinute: number;
  endMinute: number;
  text: string;
  sourceResourceId: string | null;
};

export type TeacherScriptDraft = {
  id: string;
  chapter: string;
  createdAt: string;
  updatedAt: string;
  blocks: TeacherScriptBlock[];
};

export type TeacherQuizQuestion = {
  id: string;
  prompt: string;
  answer: string;
  sourceResourceId: string | null;
  evidenceStatus: "manual" | "source-reviewed";
};

export type TeacherQuizDraft = {
  id: string;
  title: string;
  chapter: string;
  dueAt: string | null;
  updatedAt: string;
  questions: TeacherQuizQuestion[];
};

export type TeacherAssignmentReceipt = {
  id: string;
  quizId: string;
  classId: string;
  recipients: string[];
  assignedAt: string;
  delivery: "local-only";
  deliveryStatus: "saved-on-this-device";
};

export type TeacherPrepState = {
  version: typeof TEACHER_PREP_STORAGE_VERSION;
  actorId: string;
  tenant: string;
  classScope: string;
  profile: TeacherClassProfile;
  history: TeachingHistoryEntry[];
  scriptDraft: TeacherScriptDraft | null;
  quizDraft: TeacherQuizDraft;
  assignmentReceipts: TeacherAssignmentReceipt[];
  updatedAt: string;
};

export type TeacherModuleSelection = {
  chapter: string;
  chapterIndex: number | null;
  reason: TeacherModuleSelectionReason;
  historyEntryId: string | null;
};

export type ExamYearEvidence = {
  id: string;
  year: string;
  verified: boolean;
  sourceReference: string;
  questionKeys: string[];
};

export type CalibratedExamModel = {
  modelId: string;
  calibrated: boolean;
  backtested: boolean;
  probability: number;
};

export type ExamEvidenceEvaluation = {
  frequency: {
    locked: boolean;
    verifiedYearCount: number;
    occurrenceYearCount: number;
    observedPercent: number | null;
    reason: string;
  };
  forecast: {
    locked: boolean;
    probability: number | null;
    modelId: string | null;
    reason: string;
  };
};

export type LocalAssignmentResult =
  | { ok: true; receipt: TeacherAssignmentReceipt }
  | {
      ok: false;
      reason: "no-linked-students" | "no-reviewed-questions";
    };

const DEFAULT_WEEKDAYS = [1, 2, 3, 4, 5];
const MAX_SCRIPT_TEXT_LENGTH = 50_000;
const MAX_QUIZ_QUESTIONS = 100;
const MAX_HISTORY_ENTRIES = 730;
const MAX_RECEIPTS = 500;

function requireScopeSegment(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return encodeURIComponent(normalized);
}

/**
 * Keeps every saved prep isolated by storage version, tenant, actor, and class.
 */
export function teacherPrepStorageKey(
  actorId: string,
  tenant: string,
  classScope: string,
) {
  return [
    "zappy",
    "teacher-prep",
    `v${TEACHER_PREP_STORAGE_VERSION}`,
    requireScopeSegment(tenant, "tenant"),
    requireScopeSegment(actorId, "actorId"),
    requireScopeSegment(classScope, "classScope"),
  ].join(":");
}

function isoNow(value?: string) {
  if (value && !Number.isNaN(Date.parse(value))) return value;
  return new Date().toISOString();
}

function safeWeekdays(value: number[] | undefined) {
  if (!value?.length) return [...DEFAULT_WEEKDAYS];
  const valid = [...new Set(value.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))];
  return valid.length ? valid.sort((a, b) => a - b) : [...DEFAULT_WEEKDAYS];
}

function safeInteger(value: number | undefined, fallback: number, min: number, max: number) {
  return Number.isInteger(value) && value! >= min && value! <= max
    ? value!
    : fallback;
}

function isClockTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function blankQuizQuestions(count = 5): TeacherQuizQuestion[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `question-${index + 1}`,
    prompt: "",
    answer: "",
    sourceResourceId: null,
    evidenceStatus: "manual",
  }));
}

export function createTeacherPrepState(input: {
  actorId: string;
  tenant: string;
  classScope: string;
  profile?: Partial<Omit<TeacherClassProfile, "classId">>;
  chapter?: string;
  sourceResource?: TeacherSourceReference | null;
  now?: string;
}): TeacherPrepState {
  const actorId = input.actorId.trim();
  const tenant = input.tenant.trim();
  const classScope = input.classScope.trim();
  if (!actorId || !tenant || !classScope) {
    throw new TypeError("actorId, tenant, and classScope are required.");
  }

  const now = isoNow(input.now);
  const chapter = input.chapter?.trim() ?? "";
  const profile = input.profile ?? {};
  const nextClassTime =
    typeof profile.nextClassTime === "string" && isClockTime(profile.nextClassTime)
      ? profile.nextClassTime
      : "09:00";

  return {
    version: TEACHER_PREP_STORAGE_VERSION,
    actorId,
    tenant,
    classScope,
    profile: {
      classId: classScope,
      classLabel: profile.classLabel?.trim() || classScope,
      medium: profile.medium?.trim() || "English",
      timetableWeekdays: safeWeekdays(profile.timetableWeekdays),
      nextClassTime,
      periodMinutes: safeInteger(profile.periodMinutes, 40, 10, 180),
      periodCount: safeInteger(profile.periodCount, 1, 1, 12),
      durationSource: ["teacher", "school", "official"].includes(
        profile.durationSource ?? "",
      )
        ? (profile.durationSource as TeacherDurationSource)
        : "teacher",
      linkedStudentIds: Array.isArray(profile.linkedStudentIds)
        ? [...new Set(profile.linkedStudentIds.map((id) => id.trim()).filter(Boolean))]
        : [],
    },
    history: [],
    scriptDraft: chapter
      ? createTeacherScriptTemplate({
          chapter,
          sourceResource: input.sourceResource,
          now,
        })
      : null,
    quizDraft: {
      id: `quiz:${classScope}:${chapter || "unselected"}`,
      title: chapter ? `${chapter} · class check` : "New class check",
      chapter,
      dueAt: null,
      updatedAt: now,
      questions: blankQuizQuestions(),
    },
    assignmentReceipts: [],
    updatedAt: now,
  };
}

export function getLocalGreeting(hour: number) {
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    throw new RangeError("hour must be between 0 and 23.");
  }
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Returns the next local scheduled class. Today is returned only when its class
 * time is still in the future; otherwise the search continues through next week.
 */
export function getNextTeachingDate(
  now: Date,
  timetableWeekdays: number[],
  nextClassTime: string,
) {
  if (Number.isNaN(now.getTime()) || !isClockTime(nextClassTime)) return null;
  const weekdays = new Set(
    timetableWeekdays.filter(
      (day) => Number.isInteger(day) && day >= 0 && day <= 6,
    ),
  );
  if (!weekdays.size) return null;
  const [hour, minute] = nextClassTime.split(":").map(Number);

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(hour, minute, 0, 0);
    if (weekdays.has(candidate.getDay()) && candidate.getTime() > now.getTime()) {
      return candidate;
    }
  }
  return null;
}

function compareHistoryNewestFirst(a: TeachingHistoryEntry, b: TeachingHistoryEntry) {
  const recordedDifference = Date.parse(b.recordedAt) - Date.parse(a.recordedAt);
  if (Number.isFinite(recordedDifference) && recordedDifference !== 0) {
    return recordedDifference;
  }
  const dateDifference = b.localDate.localeCompare(a.localDate);
  return dateDifference || b.id.localeCompare(a.id);
}

/**
 * A previously deferred chapter wins first, then a partial/review chapter, then
 * the exact current chapter supplied by the verified curriculum sequence.
 */
export function selectTeacherModule(input: {
  exactCurrentChapter: string;
  exactCurrentChapterIndex?: number | null;
  bookId?: string;
  history: TeachingHistoryEntry[];
}): TeacherModuleSelection | null {
  const history = input.history
    .filter((entry) => !input.bookId || entry.bookId === input.bookId)
    .slice()
    .sort(compareHistoryNewestFirst);

  // Only the newest outcome for a chapter is actionable. A later "taught"
  // result clears an older deferral for that same chapter.
  const newestByChapter = new Map<string, TeachingHistoryEntry>();
  for (const entry of history) {
    if (!newestByChapter.has(entry.chapter)) newestByChapter.set(entry.chapter, entry);
  }
  const latestOutcomes = [...newestByChapter.values()].sort(compareHistoryNewestFirst);
  const deferred = latestOutcomes.find((entry) => entry.outcome === "not-taught");
  if (deferred) {
    return {
      chapter: deferred.chapter,
      chapterIndex: deferred.chapterIndex,
      reason: "deferred-not-taught",
      historyEntryId: deferred.id,
    };
  }
  const review = latestOutcomes.find(
    (entry) => entry.outcome === "partial" || entry.needsReview,
  );
  if (review) {
    return {
      chapter: review.chapter,
      chapterIndex: review.chapterIndex,
      reason: "needs-review",
      historyEntryId: review.id,
    };
  }

  const exactCurrentChapter = input.exactCurrentChapter.trim();
  if (!exactCurrentChapter) return null;
  return {
    chapter: exactCurrentChapter,
    chapterIndex:
      typeof input.exactCurrentChapterIndex === "number"
        ? input.exactCurrentChapterIndex
        : null,
    reason: "exact-current-chapter",
    historyEntryId: null,
  };
}

/**
 * Builds an editable planning scaffold, never purported textbook prose. Each
 * content-bearing step tells the teacher to use a reviewed source/page/time.
 */
export function createTeacherScriptTemplate(input: {
  chapter: string;
  sourceResource?: TeacherSourceReference | null;
  now?: string;
}): TeacherScriptDraft {
  const chapter = input.chapter.trim() || "the selected chapter";
  const source = input.sourceResource;
  const sourceName = source?.title.trim() || "the reviewed in-Zappy source";
  const sourceId = source?.id.trim() || null;
  const now = isoNow(input.now);

  return {
    id: `script:${chapter}`,
    chapter,
    createdAt: now,
    updatedAt: now,
    blocks: [
      {
        id: "retrieval",
        label: "Reconnect",
        startMinute: 0,
        endMinute: 3,
        text: "Welcome the class. Add one teacher-written retrieval question from the previous lesson: [write question].",
        sourceResourceId: null,
      },
      {
        id: "hook",
        label: "Set the purpose",
        startMinute: 3,
        endMinute: 6,
        text: `Write “${chapter}” on the board. Ask students what they predict they will learn; do not confirm content until you open the source.`,
        sourceResourceId: null,
      },
      {
        id: "source-explanation",
        label: "Source-led explanation",
        startMinute: 6,
        endMinute: 18,
        text: `Open “${sourceName}”. Choose a page or timestamp you have reviewed. Add the exact teaching point in your own words here: [teaching point] [page/timestamp].`,
        sourceResourceId: sourceId,
      },
      {
        id: "guided-practice",
        label: "Guided example",
        startMinute: 18,
        endMinute: 28,
        text: `Choose one example or activity from “${sourceName}”. Add its page or timestamp and your prompts: [source location] [teacher prompts].`,
        sourceResourceId: sourceId,
      },
      {
        id: "check-understanding",
        label: "Check understanding",
        startMinute: 28,
        endMinute: 35,
        text: "Write two checks based only on the reviewed source, then note which answer would show understanding: [check 1] [check 2] [success clue].",
        sourceResourceId: sourceId,
      },
      {
        id: "exit-ticket",
        label: "Exit and next step",
        startMinute: 35,
        endMinute: 40,
        text: "Write one source-aligned exit question: [question]. Record who is ready, who needs review, and whether this chapter was taught, partial, or not taught.",
        sourceResourceId: sourceId,
      },
    ],
  };
}

function normalizedQuestionKey(value: string) {
  return value.trim().toLocaleLowerCase();
}

export function evaluateExamEvidence(
  evidence: ExamYearEvidence[],
  questionKey: string,
  calibratedModel?: CalibratedExamModel | null,
): ExamEvidenceEvaluation {
  const key = normalizedQuestionKey(questionKey);
  const verifiedByYear = new Map<string, ExamYearEvidence[]>();
  for (const item of evidence) {
    const year = item.year.trim();
    if (!item.verified || !year || !item.sourceReference.trim()) continue;
    const yearItems = verifiedByYear.get(year) ?? [];
    yearItems.push(item);
    verifiedByYear.set(year, yearItems);
  }

  const verifiedYearCount = verifiedByYear.size;
  let occurrenceYearCount = 0;
  if (key) {
    for (const yearItems of verifiedByYear.values()) {
      if (
        yearItems.some((item) =>
          item.questionKeys.some((candidate) => normalizedQuestionKey(candidate) === key),
        )
      ) {
        occurrenceYearCount += 1;
      }
    }
  }

  const frequencyLocked = verifiedYearCount < 5 || !key;
  const validModel =
    calibratedModel?.calibrated === true &&
    calibratedModel.backtested === true &&
    calibratedModel.modelId.trim().length > 0 &&
    Number.isFinite(calibratedModel.probability) &&
    calibratedModel.probability >= 0 &&
    calibratedModel.probability <= 1;
  const forecastLocked = frequencyLocked || !validModel;

  return {
    frequency: {
      locked: frequencyLocked,
      verifiedYearCount,
      occurrenceYearCount,
      observedPercent: frequencyLocked
        ? null
        : Math.round((occurrenceYearCount / verifiedYearCount) * 1000) / 10,
      reason: frequencyLocked
        ? key
          ? `Add verified papers from ${Math.max(0, 5 - verifiedYearCount)} more distinct year(s) before showing recurrence.`
          : "Choose a question key before measuring recurrence."
        : `Observed in ${occurrenceYearCount} of ${verifiedYearCount} verified paper years; this is recurrence, not an exam forecast.`,
    },
    forecast: {
      locked: forecastLocked,
      probability: forecastLocked ? null : calibratedModel!.probability,
      modelId: forecastLocked ? null : calibratedModel!.modelId,
      reason: forecastLocked
        ? frequencyLocked
          ? "Forecast locked until the verified evidence threshold is met."
          : "Forecast locked: connect a calibrated, backtested model before showing a probability."
        : "Probability supplied by the connected calibrated, backtested model.",
    },
  };
}

export function createLocalAssignmentReceipt(input: {
  profile: TeacherClassProfile;
  quiz: TeacherQuizDraft;
  recipientIds?: string[];
  assignedAt?: string;
}): LocalAssignmentResult {
  const reviewedQuestions = input.quiz.questions.filter(
    (question) =>
      question.prompt.trim() &&
      question.evidenceStatus === "source-reviewed" &&
      Boolean(question.sourceResourceId?.trim()),
  );
  if (!reviewedQuestions.length) {
    return { ok: false, reason: "no-reviewed-questions" };
  }

  const linked = new Set(input.profile.linkedStudentIds);
  const requested = input.recipientIds ?? input.profile.linkedStudentIds;
  const recipients = [...new Set(requested.filter((id) => linked.has(id)))];
  if (!recipients.length) {
    return { ok: false, reason: "no-linked-students" };
  }

  const assignedAt = isoNow(input.assignedAt);
  return {
    ok: true,
    receipt: {
      id: `local-assignment:${input.quiz.id}:${assignedAt}`,
      quizId: input.quiz.id,
      classId: input.profile.classId,
      recipients,
      assignedAt,
      delivery: "local-only",
      deliveryStatus: "saved-on-this-device",
    },
  };
}

function isString(value: unknown, maxLength = 10_000): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isNullableString(value: unknown, maxLength = 10_000) {
  return value === null || isString(value, maxLength);
}

function isFiniteInteger(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function isProfile(value: unknown): value is TeacherClassProfile {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TeacherClassProfile>;
  return (
    isString(item.classId, 500) &&
    Boolean(item.classId.trim()) &&
    isString(item.classLabel, 500) &&
    isString(item.medium, 200) &&
    Array.isArray(item.timetableWeekdays) &&
    item.timetableWeekdays.length <= 7 &&
    item.timetableWeekdays.every((day) => isFiniteInteger(day, 0, 6)) &&
    new Set(item.timetableWeekdays).size === item.timetableWeekdays.length &&
    isString(item.nextClassTime, 5) &&
    isClockTime(item.nextClassTime) &&
    isFiniteInteger(item.periodMinutes, 10, 180) &&
    isFiniteInteger(item.periodCount, 1, 12) &&
    ["teacher", "school", "official"].includes(item.durationSource ?? "") &&
    Array.isArray(item.linkedStudentIds) &&
    item.linkedStudentIds.length <= 2_000 &&
    item.linkedStudentIds.every((id) => isString(id, 500) && Boolean(id.trim()))
  );
}

function isHistoryEntry(value: unknown): value is TeachingHistoryEntry {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TeachingHistoryEntry>;
  return (
    isString(item.id, 500) &&
    Boolean(item.id.trim()) &&
    isString(item.localDate, 20) &&
    isString(item.recordedAt, 100) &&
    !Number.isNaN(Date.parse(item.recordedAt)) &&
    isString(item.bookId, 1_000) &&
    isString(item.chapter, 2_000) &&
    Boolean(item.chapter.trim()) &&
    (item.chapterIndex === null || isFiniteInteger(item.chapterIndex, 0, 10_000)) &&
    ["taught", "partial", "not-taught"].includes(item.outcome ?? "") &&
    (item.actualMinutes === null || isFiniteInteger(item.actualMinutes, 0, 1_440)) &&
    typeof item.needsReview === "boolean"
  );
}

function isScriptBlock(value: unknown): value is TeacherScriptBlock {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TeacherScriptBlock>;
  return (
    isString(item.id, 500) &&
    isString(item.label, 500) &&
    isFiniteInteger(item.startMinute, 0, 1_440) &&
    isFiniteInteger(item.endMinute, 0, 1_440) &&
    item.endMinute > item.startMinute &&
    isString(item.text, MAX_SCRIPT_TEXT_LENGTH) &&
    isNullableString(item.sourceResourceId, 1_000)
  );
}

function isScriptDraft(value: unknown): value is TeacherScriptDraft {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TeacherScriptDraft>;
  return (
    isString(item.id, 2_000) &&
    isString(item.chapter, 2_000) &&
    isString(item.createdAt, 100) &&
    !Number.isNaN(Date.parse(item.createdAt)) &&
    isString(item.updatedAt, 100) &&
    !Number.isNaN(Date.parse(item.updatedAt)) &&
    Array.isArray(item.blocks) &&
    item.blocks.length <= 20 &&
    item.blocks.every(isScriptBlock)
  );
}

function isQuizQuestion(value: unknown): value is TeacherQuizQuestion {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TeacherQuizQuestion>;
  return (
    isString(item.id, 500) &&
    isString(item.prompt, 20_000) &&
    isString(item.answer, 20_000) &&
    isNullableString(item.sourceResourceId, 1_000) &&
    ["manual", "source-reviewed"].includes(item.evidenceStatus ?? "")
  );
}

function isQuizDraft(value: unknown): value is TeacherQuizDraft {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TeacherQuizDraft>;
  return (
    isString(item.id, 2_000) &&
    isString(item.title, 2_000) &&
    isString(item.chapter, 2_000) &&
    isNullableString(item.dueAt, 100) &&
    isString(item.updatedAt, 100) &&
    !Number.isNaN(Date.parse(item.updatedAt)) &&
    Array.isArray(item.questions) &&
    item.questions.length <= MAX_QUIZ_QUESTIONS &&
    item.questions.every(isQuizQuestion)
  );
}

function isAssignmentReceipt(value: unknown): value is TeacherAssignmentReceipt {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<TeacherAssignmentReceipt>;
  return (
    isString(item.id, 5_000) &&
    isString(item.quizId, 2_000) &&
    isString(item.classId, 500) &&
    Array.isArray(item.recipients) &&
    item.recipients.length <= 2_000 &&
    item.recipients.every((id) => isString(id, 500) && Boolean(id.trim())) &&
    isString(item.assignedAt, 100) &&
    !Number.isNaN(Date.parse(item.assignedAt)) &&
    item.delivery === "local-only" &&
    item.deliveryStatus === "saved-on-this-device"
  );
}

export function parseTeacherPrepState(
  raw: string | null,
  expectedScope?: { actorId: string; tenant: string; classScope: string },
): TeacherPrepState | null {
  if (!raw || raw.length > 5_000_000) return null;
  try {
    const value = JSON.parse(raw) as Partial<TeacherPrepState>;
    if (
      !value ||
      typeof value !== "object" ||
      value.version !== TEACHER_PREP_STORAGE_VERSION ||
      !isString(value.actorId, 500) ||
      !value.actorId.trim() ||
      !isString(value.tenant, 500) ||
      !value.tenant.trim() ||
      !isString(value.classScope, 500) ||
      !value.classScope.trim() ||
      !isProfile(value.profile) ||
      value.profile.classId !== value.classScope ||
      !Array.isArray(value.history) ||
      value.history.length > MAX_HISTORY_ENTRIES ||
      !value.history.every(isHistoryEntry) ||
      !(value.scriptDraft === null || isScriptDraft(value.scriptDraft)) ||
      !isQuizDraft(value.quizDraft) ||
      !Array.isArray(value.assignmentReceipts) ||
      value.assignmentReceipts.length > MAX_RECEIPTS ||
      !value.assignmentReceipts.every(isAssignmentReceipt) ||
      !isString(value.updatedAt, 100) ||
      Number.isNaN(Date.parse(value.updatedAt))
    ) {
      return null;
    }
    if (
      expectedScope &&
      (value.actorId !== expectedScope.actorId ||
        value.tenant !== expectedScope.tenant ||
        value.classScope !== expectedScope.classScope)
    ) {
      return null;
    }
    return value as TeacherPrepState;
  } catch {
    return null;
  }
}

export function serializeTeacherPrepState(state: TeacherPrepState) {
  const raw = JSON.stringify(state);
  if (!parseTeacherPrepState(raw)) {
    throw new TypeError("Teacher prep state does not match the saved schema.");
  }
  return raw;
}
