"use client";

import { useEffect, useMemo, useState } from "react";
import {
  findZappySourceChapter,
  isExactDikshaBookId,
  loadZappySourceBook,
  normaliseSourceTitle,
  sourceKindIcon,
  type ZappySourceBook,
  type ZappySourceResource,
} from "./zappy-source";
import {
  evaluateExamEvidence,
  getLocalGreeting,
  getNextTeachingDate,
  selectTeacherModule,
  teacherPrepStorageKey,
  type TeachingHistoryEntry,
} from "./teacher-prep";
import {
  FORCE_AND_PRESSURE_OFFICIAL_LEARNING_OUTCOMES,
  FORCE_AND_PRESSURE_OFFICIAL_QUESTION_BANK,
  FORCE_AND_PRESSURE_SOURCE_INTEGRITY,
  KARNATAKA_CLASS_8_SCIENCE_2026_27_NOTICE,
  KARNATAKA_CLASS_8_SCIENCE_LEGACY_DIKSHA_BOOK,
  KARNATAKA_CLASS_8_SCIENCE_SOURCE,
  KARNATAKA_CLASS_8_SCIENCE_UNITS,
  type OfficialPracticeQuestion,
} from "./karnataka-class8-science";
import {
  mergeLearningProof,
  mergeScopedTeacherProofs,
  legacyTeacherLearningProofKey,
  parseStudentAssignmentsFor,
  parseStudentLearningProofsFor,
  parseTeacherAssignments,
  proofMatchesTeacherScope,
  reviewStudentLearningProof,
  studentAssignmentForRecipient,
  studentAssignmentInboxKey,
  studentLearningProofKey,
  teacherLearningProofKey,
  type StudentLearningProof,
  type TeacherAssignmentRecord,
  type TeacherQuestionReview,
} from "./learning-proof";

export type TeacherPrepStudyContext = {
  board: string;
  grade: string;
  subject: string;
  chapter: string;
  bookId?: string;
  book?: string;
  source?: string;
  chapters?: string[];
};

type DurationSource = "teacher" | "school" | "official";
type TeachingOutcome = "taught" | "partial" | "not-taught";
type ClassConfidence = "needs-review" | "steady" | "strong";

type ScriptBlock = {
  id: string;
  label: string;
  startMinute: number;
  endMinute: number;
  teacherSays: string;
  studentsDo: string;
  sourceRef: string;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  answer: string;
  sourceRef: string;
  origin?: { kind: "teacher-cited" } | { kind: "official-practice"; sourceQuestionId: string };
};

type ReviewedVideo = {
  id: string;
  title: string;
  youtubeId: string;
  reviewedAt: string;
};

type TeachingHistory = {
  id: string;
  chapter: string;
  outcome: TeachingOutcome;
  actualMinutes: number;
  confidence: ClassConfidence;
  recordedAt: string;
};

type TeacherAiMessage = {
  id: string;
  role: "teacher" | "ai";
  text: string;
};

type TeacherPrepState = {
  version: 1;
  autoPrepEnabled: boolean;
  classLabel: string;
  medium: string;
  timetableDays: number[];
  classTime: string;
  periodMinutes: number;
  periodCount: number;
  durationSource: DurationSource;
  selectedChapter: string;
  selectionMode: "ai" | "teacher";
  selectionReason: string;
  scripts: Record<string, ScriptBlock[]>;
  quizzes: Record<string, QuizQuestion[]>;
  reviewedVideos: Record<string, ReviewedVideo[]>;
  linkedStudentIds: string[];
  dueDate: string;
  readyAt: string;
  history: TeachingHistory[];
  assignments: TeacherAssignmentRecord[];
};

type TeacherPrepCopilotProps = {
  actorId: string;
  teacherName: string;
  tenant: string;
  context: TeacherPrepStudyContext | null;
  onOpenSource: () => void;
  onOpenEvidence: () => void;
  onLessonOutcome?: (outcome: TeachingOutcome, confidence: ClassConfidence) => void;
  onClose: () => void;
};

const WEEKDAYS = [
  { id: 1, label: "M" },
  { id: 2, label: "T" },
  { id: 3, label: "W" },
  { id: 4, label: "T" },
  { id: 5, label: "F" },
  { id: 6, label: "S" },
] as const;

const RUNWAY = [
  { id: "script", icon: "📝", label: "Script" },
  { id: "materials", icon: "📚", label: "Materials" },
  { id: "videos", icon: "▶️", label: "Videos" },
  { id: "questions", icon: "🎯", label: "Questions" },
  { id: "likelihood", icon: "📊", label: "Likelihood" },
  { id: "quiz", icon: "✅", label: "Quiz" },
] as const;

const DAILY_PREP_SUMMARY = [
  { icon: "✨", label: "AI prepares", detail: "Script + sources" },
  { icon: "👀", label: "You review", detail: "Edit the essentials" },
  { icon: "✅", label: "Teach & save", detail: "Next topic updates" },
] as const;

const WAITING_PREP_SUMMARY = [
  { icon: "🧭", label: "Set class stage", detail: "Board + book + chapter" },
  { icon: "🔒", label: "AI prepares", detail: "Unlocks after setup" },
  { icon: "🔒", label: "Teach & save", detail: "Keeps the book order" },
] as const;

function greetingFor(date: Date) {
  return getLocalGreeting(date.getHours());
}

function localDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function nextScheduledLesson(now: Date, days: number[], clock: string) {
  return getNextTeachingDate(now, days, clock);
}

function formatLessonDate(date: Date | null) {
  if (!date) return "Next class time not set";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatLocalTimestamp(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "time unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function prepStorageKey(actorId: string, tenant: string, context: TeacherPrepStudyContext | null) {
  const classScope = context
    ? [context.board, context.grade, context.subject, context.bookId || "framework"].join("|")
    : "unconfigured";
  return teacherPrepStorageKey(actorId, tenant, classScope);
}

function defaultScript(chapter: string, periodMinutes: number, officialForceSource = false): ScriptBlock[] {
  const cap = Math.max(20, periodMinutes);
  const scale = cap / 40;
  const ranges = [[0, 3], [3, 6], [6, 18], [18, 28], [28, 35], [35, 40]];
  const labels = ["Retrieval", "Hook", "Explain", "Demonstrate", "Check", "Exit ticket"];
  const teacherPrompts = [
    "Reconnect to the last taught source. Add one retrieval question and its page or timestamp.",
    "Show the exact chapter title, " + chapter + ". Add a short opening question grounded in the source.",
    "Open the exact source in Zappy. Add the source-cited explanation you will say in your own words.",
    "Add one demonstration, example, or worked step taken from the selected source.",
    "Add two quick checks for understanding. Record the source location for the expected answers.",
    "Ask every student for one source-backed takeaway before the period ends.",
  ];
  const studentPrompts = [
    "Recall one idea from the previous lesson.",
    "Predict, notice, or ask one question.",
    "Follow the source and capture the key idea.",
    "Try the example or discuss the demonstration.",
    "Answer independently, then compare.",
    "Submit one clear takeaway or question.",
  ];
  const officialRefs = [
    "",
    "DSERT Karnataka 2025–26 LBA · PDF p. 21",
    "DSERT Karnataka 2025–26 LBA · PDF p. 21",
    "DSERT Karnataka 2025–26 LBA · PDF pp. 22–24",
    "DSERT Karnataka 2025–26 LBA · PDF pp. 22–24",
    "DSERT Karnataka 2025–26 LBA · PDF pp. 22–24",
  ];
  return ranges.map((range, index) => ({
    id: labels[index].toLowerCase().replace(/\s/g, "-"),
    label: labels[index],
    startMinute: Math.round(range[0] * scale),
    endMinute: Math.round(range[1] * scale),
    teacherSays: teacherPrompts[index],
    studentsDo: studentPrompts[index],
    sourceRef: officialForceSource ? officialRefs[index] : "",
  }));
}

function defaultQuiz(chapter: string): QuizQuestion[] {
  const prompts = [
    "State one key idea from " + chapter + " and cite where it appears in the source.",
    "Use one source example to explain the idea in your own words.",
    "Compare two ideas, cases, or examples from this chapter.",
    "Write and correct one likely misconception using the source.",
    "What is the most important takeaway from this chapter? Support it with evidence.",
  ];
  return prompts.map((prompt, index) => ({
    id: "q" + (index + 1),
    prompt,
    answer: "",
    sourceRef: "",
    origin: { kind: "teacher-cited" },
  }));
}

function officialQuizPrompt(question: OfficialPracticeQuestion) {
  return question.prompt + (question.options?.length ? "\n" + question.options.join("\n") : "");
}

function officialQuizSource(question: OfficialPracticeQuestion) {
  return "DSERT 2025–26 LBA · Q" + question.sourceNumber + " · PDF p. " + question.sourcePdfPages.join(", ");
}

export function resolveQuizEvidenceKind(question: QuizQuestion, officialBank: readonly OfficialPracticeQuestion[]) {
  if (question.origin?.kind !== "official-practice") return "teacher-cited" as const;
  const sourceQuestion = officialBank.find(item => item.id === question.origin?.sourceQuestionId);
  return sourceQuestion && question.prompt === officialQuizPrompt(sourceQuestion) && question.sourceRef === officialQuizSource(sourceQuestion)
    ? "official-practice" as const
    : "teacher-cited" as const;
}

function createPrepState(context: TeacherPrepStudyContext | null): TeacherPrepState {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + 1);
  return {
    version: 1,
    autoPrepEnabled: false,
    classLabel: context?.grade || "",
    medium: "",
    timetableDays: [],
    classTime: "",
    periodMinutes: 40,
    periodCount: 1,
    durationSource: "teacher",
    selectedChapter: context?.chapter || "",
    selectionMode: "ai",
    selectionReason: context ? "Exact current position saved in the selected book." : "Choose the exact class stage first.",
    scripts: {},
    quizzes: {},
    reviewedVideos: {},
    linkedStudentIds: [],
    dueDate: localDateInput(nextDate),
    readyAt: "",
    history: [],
    assignments: [],
  };
}

function parsePrepState(raw: string | null, context: TeacherPrepStudyContext | null) {
  if (!raw) return createPrepState(context);
  try {
    const value = JSON.parse(raw) as Partial<TeacherPrepState>;
    if (value.version !== 1) return createPrepState(context);
    const fresh = createPrepState(context);
    return {
      ...fresh,
      ...value,
      autoPrepEnabled: Boolean(value.autoPrepEnabled),
      timetableDays: Array.isArray(value.timetableDays) ? value.timetableDays.filter(day => Number.isInteger(day) && day >= 1 && day <= 6) : [],
      scripts: value.scripts && typeof value.scripts === "object" ? value.scripts : {},
      quizzes: value.quizzes && typeof value.quizzes === "object" ? value.quizzes : {},
      reviewedVideos: value.reviewedVideos && typeof value.reviewedVideos === "object" ? value.reviewedVideos : {},
      linkedStudentIds: Array.isArray(value.linkedStudentIds) ? value.linkedStudentIds.filter(item => typeof item === "string") : [],
      history: Array.isArray(value.history) ? value.history : [],
      assignments: parseTeacherAssignments(JSON.stringify(Array.isArray(value.assignments) ? value.assignments : [])),
      selectedChapter: context?.chapters?.includes(value.selectedChapter || "") ? value.selectedChapter! : context?.chapter || "",
    } satisfies TeacherPrepState;
  } catch {
    return createPrepState(context);
  }
}

function youtubeIdFrom(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    let id = "";
    if (host === "youtu.be") id = url.pathname.slice(1).split("/")[0];
    if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com") {
      id = url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop() || "";
    }
    return /^[A-Za-z0-9_-]{6,15}$/.test(id) ? id : "";
  } catch {
    return "";
  }
}

function sourceLabel(resource: ZappySourceResource) {
  return resource.title + " · " + resource.kind.toUpperCase() + " · " + (resource.creator || resource.organisation[0] || "Source creator");
}

function resolveTeacherModule(
  state: TeacherPrepState,
  context: TeacherPrepStudyContext,
  chapters: string[],
) {
  const exactChapter = (value: string) => chapters.find(chapter => normaliseSourceTitle(chapter) === normaliseSourceTitle(value)) || "";
  const exactCurrentChapter = exactChapter(context.chapter) || chapters[0] || "";
  const history: TeachingHistoryEntry[] = state.history.map(entry => {
    const chapterIndex = chapters.findIndex(chapter => normaliseSourceTitle(chapter) === normaliseSourceTitle(entry.chapter));
    return {
      id: entry.id,
      localDate: entry.recordedAt.slice(0, 10),
      recordedAt: entry.recordedAt,
      bookId: context.bookId || "",
      chapter: entry.chapter,
      chapterIndex: chapterIndex >= 0 ? chapterIndex : null,
      outcome: entry.outcome,
      actualMinutes: entry.actualMinutes,
      needsReview: entry.confidence === "needs-review",
    };
  });
  const selection = selectTeacherModule({
    exactCurrentChapter,
    exactCurrentChapterIndex: chapters.indexOf(exactCurrentChapter),
    bookId: context.bookId,
    history,
  });
  if (!selection) return null;
  const reason = selection.reason === "deferred-not-taught"
    ? "The previous class was marked not taught, so Zappy will not skip it."
    : selection.reason === "needs-review"
      ? "The previous class needs review or was partly taught, so Zappy keeps it for completion."
      : "Exact current position saved in the selected book.";
  return {
    chapter: exactChapter(selection.chapter) || selection.chapter,
    reason,
  };
}

function resolveReviewedStudentSignal(
  assignments: TeacherAssignmentRecord[],
  proofs: StudentLearningProof[],
  context: TeacherPrepStudyContext,
) {
  const scopedAssignments = assignments.filter(item => item.board === context.board && item.grade === context.grade && item.subject === context.subject);
  for (const assignment of scopedAssignments) {
    const reviewed = proofs.filter(proof => proof.assignmentId === assignment.id && proof.review);
    const revisitCount = reviewed.reduce((count, proof) => count + (proof.review?.items.filter(item => item.outcome === "retry" || item.outcome === "partly").length || 0), 0);
    if (revisitCount) return {
      chapter: assignment.chapter,
      reason: `Teacher-reviewed student work includes ${revisitCount} response${revisitCount === 1 ? "" : "s"} marked partly or retry, so Daily Assist keeps this exact module for targeted review.`,
    };
  }
  return null;
}

export function TeacherPrepLaunchCard({
  teacherName,
  tenant,
  context,
  onOpen,
  onSetStage,
}: {
  teacherName: string;
  tenant: string;
  context: TeacherPrepStudyContext | null;
  onOpen: () => void;
  onSetStage: () => void;
}) {
  const now = new Date();
  const summary = context ? DAILY_PREP_SUMMARY : WAITING_PREP_SUMMARY;
  return <section className={`teacher-prep-launch ${context ? "ready" : "waiting"}`} aria-label="Daily teacher preparation summary">
    <div className="tpl-owl"><span>🦉</span><i>✓</i></div>
    <div className="tpl-copy">
      <small>DAILY EASY PREP · 3 STEPS</small>
      <h2>{greetingFor(now)}, {teacherName}!</h2>
      <p>{context
        ? context.grade + " · " + context.subject + " · “" + context.chapter + "”. Your short preparation summary is ready."
        : "Set the class stage once below. After that, Zappy prepares this same simple loop every teaching day."}</p>
      <div className="tpl-easy-loop" aria-label="Daily preparation summary">{summary.map((step, index) => <span key={step.label}><b>{index + 1}</b><i>{step.icon}</i><p><strong>{step.label}</strong><small>{step.detail}</small></p></span>)}</div>
    </div>
    <div><small>{tenant}</small><button onClick={context ? onOpen : onSetStage}>{context ? "OPEN TODAY’S PREP →" : "SET CLASS STAGE ↓"}</button></div>
  </section>;
}

export function TeacherPrepCopilot({
  actorId,
  teacherName,
  tenant,
  context,
  onOpenSource,
  onOpenEvidence,
  onLessonOutcome,
  onClose,
}: TeacherPrepCopilotProps) {
  const storageKey = prepStorageKey(actorId, tenant, context);
  const [prep, setPrep] = useState<TeacherPrepState>(() => createPrepState(context));
  const [loaded, setLoaded] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const [sourceBook, setSourceBook] = useState<ZappySourceBook | null>(null);
  const [sourceState, setSourceState] = useState<"loading" | "ready" | "unavailable" | "error">("loading");
  const [sourceMessage, setSourceMessage] = useState("");
  const [toast, setToast] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoTitle, setVideoTitle] = useState("");
  const [showOfficialPdf, setShowOfficialPdf] = useState(false);
  const [outcome, setOutcome] = useState<TeachingOutcome>("taught");
  const [actualMinutes, setActualMinutes] = useState(40);
  const [classConfidence, setClassConfidence] = useState<ClassConfidence>("steady");
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<TeacherAiMessage[]>([]);
  const [recipientDraft, setRecipientDraft] = useState("");
  const [learningProofs, setLearningProofs] = useState<StudentLearningProof[]>([]);
  const [reviewAssignmentId, setReviewAssignmentId] = useState("");
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { outcomes: Record<string, TeacherQuestionReview["outcome"]>; summary: string }>>({});
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const saved = parsePrepState(window.localStorage.getItem(storageKey), context);
      const restoreChapters = context?.board === "Karnataka State Board" && context.grade === "Class 8" && context.subject.toLowerCase() === "science"
        ? KARNATAKA_CLASS_8_SCIENCE_UNITS.map(unit => unit.title)
        : context?.chapters || (context?.chapter ? [context.chapter] : []);
      const restoredSelection = context && saved.autoPrepEnabled
        ? resolveTeacherModule(saved, context, restoreChapters)
        : null;
      const restored = restoredSelection
        ? { ...saved, selectedChapter: restoredSelection.chapter, selectionMode: "ai" as const, selectionReason: restoredSelection.reason, readyAt: "" }
        : saved;
      setPrep(restored);
      setActualMinutes(restored.periodMinutes);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [storageKey, context]);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(storageKey, JSON.stringify(prep));
  }, [loaded, prep, storageKey]);

  useEffect(() => {
    let active = true;
    const resultsKey = teacherLearningProofKey(actorId, tenant);
    const load = () => {
      if (!active) return;
      const scoped = mergeScopedTeacherProofs(window.localStorage.getItem(resultsKey), window.localStorage.getItem(legacyTeacherLearningProofKey(actorId)), actorId, tenant);
      setLearningProofs(scoped);
      try { window.localStorage.setItem(resultsKey, JSON.stringify(scoped)); } catch { /* Review remains readable if migration cannot persist. */ }
    };
    queueMicrotask(load);
    window.addEventListener("storage", load);
    return () => {
      active = false;
      window.removeEventListener("storage", load);
    };
  }, [actorId, tenant]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    if (!context?.bookId || !isExactDikshaBookId(context.bookId)) {
      queueMicrotask(() => {
        if (!active) return;
        setSourceBook(null);
        setSourceState("unavailable");
        setSourceMessage("This saved curriculum path has no exact DIKSHA book ID, so source-dependent outputs remain paused.");
      });
      return () => {
        active = false;
        controller.abort();
      };
    }
    queueMicrotask(() => {
      if (active) setSourceState("loading");
    });
    loadZappySourceBook(context.bookId, controller.signal).then(book => {
      if (!active) return;
      setSourceBook(book);
      setSourceState("ready");
      setSourceMessage("");
      setPrep(current => current.medium ? current : { ...current, medium: book.medium[0] || "" });
    }).catch(error => {
      if (!active || error instanceof DOMException && error.name === "AbortError") return;
      setSourceBook(null);
      setSourceState("error");
      setSourceMessage(error instanceof Error ? error.message : "The exact source could not be loaded.");
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [context?.bookId]);

  const isKarnatakaClass8Science = context?.board === "Karnataka State Board" && context.grade === "Class 8" && context.subject.toLowerCase() === "science";
  const chapters = isKarnatakaClass8Science
    ? KARNATAKA_CLASS_8_SCIENCE_UNITS.map(unit => unit.title)
    : context?.chapters || (context?.chapter ? [context.chapter] : []);
  const canonicalChapter = (value: string) => chapters.find(chapter => normaliseSourceTitle(chapter) === normaliseSourceTitle(value)) || "";
  const canonicalContextChapter = canonicalChapter(context?.chapter || "") || chapters[0] || "";
  const selectedChapter = canonicalChapter(prep.selectedChapter) || canonicalContextChapter;
  const selectedIndex = Math.max(0, chapters.indexOf(selectedChapter));
  const sourceChapter = sourceBook ? findZappySourceChapter(sourceBook, selectedChapter) || null : null;
  const resources = sourceChapter?.resources || [];
  const sourceVideos = resources.filter(resource => resource.kind === "video");
  const reviewedVideos = prep.reviewedVideos[selectedChapter] || [];
  const isOfficialForceModule = isKarnatakaClass8Science && normaliseSourceTitle(selectedChapter) === normaliseSourceTitle("Force and Pressure");
  const officialQuestions = isOfficialForceModule ? FORCE_AND_PRESSURE_OFFICIAL_QUESTION_BANK : [];
  const officialOutcomes = isOfficialForceModule ? FORCE_AND_PRESSURE_OFFICIAL_LEARNING_OUTCOMES : [];
  const script = prep.scripts[selectedChapter] || defaultScript(selectedChapter || "this chapter", prep.periodMinutes, isOfficialForceModule);
  const quiz = prep.quizzes[selectedChapter] || defaultQuiz(selectedChapter || "this chapter");
  const nextLesson = nextScheduledLesson(now, prep.timetableDays, prep.classTime);
  const previousChapter = chapters[selectedIndex - 1] || "";
  const nextChapter = chapters[selectedIndex + 1] || "";
  const lastHistory = prep.history[prep.history.length - 1];
  const quizComplete = quiz.every(item => item.prompt.trim() && item.answer.trim() && item.sourceRef.trim());
  const confirmedRecipients = [...new Set(prep.linkedStudentIds
    .map(item => item.trim().toLowerCase())
    .filter(item => /^@[a-z0-9_.-]+$/.test(item)))];
  const moduleAssignments = prep.assignments.filter(assignment =>
    assignment.teacherId === actorId.trim().toLowerCase() &&
    assignment.workspace === tenant &&
    assignment.chapter === selectedChapter &&
    assignment.board === context?.board &&
    assignment.grade === context?.grade &&
    assignment.subject === context?.subject,
  );
  const currentAssignment = moduleAssignments[0] || null;
  const reviewAssignment = moduleAssignments.find(assignment => assignment.id === reviewAssignmentId) || currentAssignment;
  const currentProofs = reviewAssignment
    ? learningProofs.filter(proof => proof.assignmentId === reviewAssignment.id && proofMatchesTeacherScope(proof, actorId, tenant))
    : [];
  const reviewedProofCount = currentProofs.filter(proof => Boolean(proof.review)).length;
  const latestProofs = currentAssignment
    ? learningProofs.filter(proof => proof.assignmentId === currentAssignment.id && proofMatchesTeacherScope(proof, actorId, tenant))
    : [];
  const latestReviewedProofCount = latestProofs.filter(proof => Boolean(proof.review)).length;
  const studentReviewSignal = context ? resolveReviewedStudentSignal(prep.assignments, learningProofs, context) : null;
  const automaticReviewChapter = studentReviewSignal ? canonicalChapter(studentReviewSignal.chapter) : "";
  const automaticReviewReason = studentReviewSignal?.reason || "";
  const examEvaluation = evaluateExamEvidence([], selectedChapter);
  const statuses = [
    { label: "Classroom script", state: "input", detail: "Editable source-citation template" },
    { label: "Study material", state: resources.length || isKarnatakaClass8Science ? "ready" : "locked", detail: isKarnatakaClass8Science ? "Official DSERT 2025–26 pack + " + resources.length + " DIKSHA item(s)" : resources.length ? resources.length + " playable source item" + (resources.length === 1 ? "" : "s") : "Exact playable item unavailable" },
    { label: "Reviewed videos", state: reviewedVideos.length || sourceVideos.length ? "ready" : "locked", detail: reviewedVideos.length + " YouTube · " + sourceVideos.length + " official source" },
    { label: "Important questions", state: officialQuestions.length ? "ready" : "locked", detail: officialQuestions.length ? officialQuestions.length + " official practice items · 0 past-paper years" : examEvaluation.frequency.verifiedYearCount + " verified paper years" },
    { label: "Exam likelihood", state: "locked", detail: examEvaluation.forecast.reason },
    { label: "Quiz", state: quizComplete ? "ready" : "input", detail: quizComplete ? "Teacher-reviewed" : "Answer + citations required" },
  ] as const;
  const readyCount = statuses.filter(item => item.state === "ready").length;
  const sequencePosition = chapters.length ? Math.round((selectedIndex + 1) / chapters.length * 100) : 0;
  const scriptCitationsComplete = script.every(block => block.sourceRef.trim());
  const teacherPulse = [
    { label: "Class source selected", detail: context ? context.board + " · " + context.grade : "Exact stage required", done: Boolean(context) },
    { label: "Module selected", detail: selectedChapter || "No exact module", done: Boolean(selectedChapter) },
    { label: "Chapter source checked", detail: resources.length || isKarnatakaClass8Science ? (resources.length + (isKarnatakaClass8Science ? " + official DSERT source" : " playable item(s)")) : "Playable source unavailable", done: Boolean(resources.length || isKarnatakaClass8Science) },
    { label: "Script citations reviewed", detail: scriptCitationsComplete ? "Every block has a source reference" : "Citation fields still need review", done: scriptCitationsComplete },
    { label: "Quiz saved to local inbox", detail: currentAssignment ? latestProofs.length + "/" + currentAssignment.recipients.length + " submitted · " + latestReviewedProofCount + " reviewed" : "Teacher action required for this module", done: Boolean(currentAssignment) },
  ];
  const activePulseIndex = teacherPulse.findIndex(step => !step.done);

  useEffect(() => {
    if (!loaded || !prep.autoPrepEnabled || !automaticReviewChapter || !automaticReviewReason) return;
    queueMicrotask(() => {
      setPrep(current => current.selectedChapter === automaticReviewChapter && current.selectionReason === automaticReviewReason
        ? current
        : { ...current, selectedChapter: automaticReviewChapter, selectionMode: "ai", selectionReason: automaticReviewReason, readyAt: "" });
    });
  }, [loaded, prep.autoPrepEnabled, automaticReviewChapter, automaticReviewReason]);

  function updatePrep(patch: Partial<TeacherPrepState>) {
    setPrep(current => ({ ...current, ...patch }));
  }

  function chooseChapter(chapter: string, mode: "ai" | "teacher", reason: string) {
    const exactChapter = canonicalChapter(chapter) || chapter;
    updatePrep({ selectedChapter: exactChapter, selectionMode: mode, selectionReason: reason, readyAt: "" });
    setToast(mode === "ai" ? "Zappy kept the exact book order." : "Teacher module choice saved.");
  }

  function applyAiPick() {
    if (!context) return null;
    if (studentReviewSignal) {
      const chapter = canonicalChapter(studentReviewSignal.chapter) || studentReviewSignal.chapter;
      chooseChapter(chapter, "ai", studentReviewSignal.reason);
      return { chapter, reason: studentReviewSignal.reason };
    }
    const selection = resolveTeacherModule(prep, context, chapters);
    if (!selection) return null;
    chooseChapter(selection.chapter, "ai", selection.reason);
    return selection;
  }

  function toggleDailyAssist() {
    const enabled = !prep.autoPrepEnabled;
    updatePrep({ autoPrepEnabled: enabled });
    if (enabled && context) applyAiPick();
    setToast(enabled
      ? "Daily Assist enabled. Zappy will restore this class and suggest the exact current or review chapter when you open the app. Nothing is sent automatically."
      : "Daily Assist paused. Your saved class position and drafts are unchanged.");
  }

  function askTeacherAi(rawPrompt: string) {
    const prompt = rawPrompt.trim();
    if (!prompt) return;
    const lower = prompt.toLowerCase();
    let response = "I can open the sourced script, materials, reviewed videos, official-practice evidence, likelihood method, or teacher-reviewed quiz. I will not invent curriculum facts outside the connected source.";
    let stage: number | null = null;

    if (!context) {
      response = "Choose the exact board, class, subject, book, and chapter first. Source-dependent preparation stays paused until that stage is connected.";
    } else if (lower.includes("script") || lower.includes("classroom") || lower.includes("teach")) {
      stage = 0;
      response = "I opened the six-block classroom scaffold for “" + selectedChapter + "”. It scales to your " + prep.periodMinutes + "-minute teacher plan. Review every source page or timestamp before treating a block as source-backed.";
    } else if (lower.includes("material") || lower.includes("source") || lower.includes("book") || lower.includes("topic breakdown")) {
      stage = 1;
      response = resources.length || isKarnatakaClass8Science
        ? "I opened the original source lane for “" + selectedChapter + "”. Zappy currently has " + resources.length + " playable DIKSHA item(s)" + (isKarnatakaClass8Science ? " plus the dated DSERT 2025–26 assessment source." : ".")
        : "The exact chapter is indexed, but a playable chapter asset is unavailable. I opened the source gate instead of substituting generic material.";
    } else if (lower.includes("video") || lower.includes("youtube")) {
      stage = 2;
      response = "I opened the finite video lane: " + sourceVideos.length + " official source video(s) and " + reviewedVideos.length + " teacher-reviewed YouTube link(s). Zappy shows no autoplay, popularity ranking, or invented view counts.";
    } else if (lower.includes("question") || lower.includes("paper") || lower.includes("important")) {
      stage = 3;
      response = officialQuestions.length
        ? "I opened " + officialQuestions.length + " source-cited DSERT official practice items for Force and Pressure. They are not previous-year appearances; Zappy still has 0 verified past-paper years."
        : "Important-question ranking is locked for this chapter because Zappy has 0 verified past-paper years for the exact exam and syllabus edition.";
    } else if (lower.includes("probability") || lower.includes("likelihood") || lower.includes("predict")) {
      stage = 4;
      response = "Exam probability remains locked. Zappy requires a calibrated, backtested model; it will not turn recurrence or filenames into a prediction percentage.";
    } else if (lower.includes("quiz") || lower.includes("assign") || lower.includes("forward")) {
      stage = 5;
      response = "I opened the teacher-reviewed quiz. Every expected answer and source reference plus a due date and teacher-confirmed local roster ID is required before a same-browser receipt can be created. This prototype does not verify account existence.";
    } else if (lower.includes("next") || lower.includes("tomorrow") || lower.includes("module")) {
      const selection = applyAiPick();
      const pickedChapter = selection?.chapter || selectedChapter;
      const pickedIndex = chapters.indexOf(pickedChapter);
      const pickedNextChapter = pickedIndex >= 0 ? chapters[pickedIndex + 1] || "" : "";
      response = pickedNextChapter
        ? "The current exact pick is “" + pickedChapter + "”. The next item in the connected book is “" + pickedNextChapter + "”. Zappy advances only after you record what actually happened in class."
        : "“" + pickedChapter + "” is the final indexed item in this connected sequence. Zappy will not wrap to an invented next chapter.";
    } else if (lower.includes("auto") || lower.includes("daily assist")) {
      response = "Daily Assist restores the saved class, suggests the exact current or review chapter, and prepares editable templates when you open Zappy. It never sends quizzes, messages students, or marks teaching complete without you.";
    }

    if (stage !== null) setActiveStage(stage);
    const id = Date.now().toString() + "-" + assistantMessages.length;
    setAssistantMessages(current => [...current,
      { id: id + "-teacher", role: "teacher", text: prompt },
      { id: id + "-ai", role: "ai", text: response },
    ].slice(-12));
    setAssistantInput("");
  }

  function updateScript(id: string, field: keyof ScriptBlock, value: string) {
    const next = script.map(block => block.id === id ? { ...block, [field]: value } : block);
    updatePrep({ scripts: { ...prep.scripts, [selectedChapter]: next }, readyAt: "" });
  }

  function updateQuiz(id: string, field: "prompt" | "answer" | "sourceRef", value: string) {
    const next = quiz.map(question => question.id === id ? {
      ...question,
      [field]: value,
      origin: field === "prompt" || field === "sourceRef" ? { kind: "teacher-cited" as const } : question.origin,
    } : question);
    updatePrep({ quizzes: { ...prep.quizzes, [selectedChapter]: next }, readyAt: "" });
  }

  function addOfficialQuestionsToQuiz() {
    if (!officialQuestions.length) return;
    const next: QuizQuestion[] = officialQuestions.slice(0, 5).map(question => ({
      id: "official-" + question.sourceNumber,
      prompt: officialQuizPrompt(question),
      answer: "",
      sourceRef: officialQuizSource(question),
      origin: { kind: "official-practice", sourceQuestionId: question.id },
    }));
    updatePrep({ quizzes: { ...prep.quizzes, [selectedChapter]: next }, readyAt: "" });
    setActiveStage(5);
    setToast("Five official practice items added. Review and add the expected answers before forwarding.");
  }

  async function copyScript() {
    const text = [
      (context?.grade || "Class") + " · " + (context?.subject || "Subject") + " · " + selectedChapter,
      prep.periodCount + " × " + prep.periodMinutes + " min · " + prep.durationSource + " plan",
      "",
      ...script.map(block =>
        block.startMinute + "–" + block.endMinute + " min · " + block.label.toUpperCase() + "\n" +
        "TEACHER: " + block.teacherSays + "\n" +
        "STUDENTS: " + block.studentsDo + "\n" +
        "SOURCE: " + (block.sourceRef || "[add page or timestamp before teaching]")
      ),
    ].join("\n\n");
    await navigator.clipboard.writeText(text);
    setToast("Full classroom script copied.");
  }

  function addReviewedVideo() {
    const id = youtubeIdFrom(videoUrl);
    if (!id || !videoTitle.trim()) {
      setToast("Add a valid YouTube link and a clear title.");
      return;
    }
    const next = [...reviewedVideos.filter(video => video.youtubeId !== id), {
      id: selectedChapter + ":" + id,
      title: videoTitle.trim(),
      youtubeId: id,
      reviewedAt: new Date().toISOString(),
    }];
    updatePrep({ reviewedVideos: { ...prep.reviewedVideos, [selectedChapter]: next } });
    setVideoUrl("");
    setVideoTitle("");
    setToast("Teacher-reviewed video saved for this exact chapter.");
  }

  function removeReviewedVideo(id: string) {
    updatePrep({
      reviewedVideos: {
        ...prep.reviewedVideos,
        [selectedChapter]: reviewedVideos.filter(video => video.id !== id),
      },
    });
  }

  function confirmLocalRosterId() {
    const recipient = recipientDraft.trim().toLowerCase();
    if (!/^@[a-z0-9_.-]+$/.test(recipient)) {
      setToast("Enter one Zappy ID beginning with @. No account lookup is available in this local prototype.");
      return;
    }
    if (confirmedRecipients.includes(recipient)) {
      setToast("That local roster ID is already confirmed for this class.");
      return;
    }
    updatePrep({ linkedStudentIds: [...confirmedRecipients, recipient] });
    setRecipientDraft("");
    setToast("Local roster ID confirmed by the teacher. Account existence is not verified in this prototype.");
  }

  function removeLocalRosterId(recipient: string) {
    updatePrep({ linkedStudentIds: confirmedRecipients.filter(item => item !== recipient) });
  }

  function setReviewOutcome(proofId: string, questionId: string, outcomeValue: TeacherQuestionReview["outcome"]) {
    setReviewDrafts(current => ({
      ...current,
      [proofId]: {
        summary: current[proofId]?.summary || "",
        outcomes: { ...(current[proofId]?.outcomes || {}), [questionId]: outcomeValue },
      },
    }));
  }

  function setReviewSummary(proofId: string, summary: string) {
    setReviewDrafts(current => ({
      ...current,
      [proofId]: {
        outcomes: current[proofId]?.outcomes || {},
        summary,
      },
    }));
  }

  function saveLearningReview(proof: StudentLearningProof) {
    if (!reviewAssignment || proof.assignmentId !== reviewAssignment.id || !proofMatchesTeacherScope(proof, actorId, tenant)) {
      setToast("That proof is outside the selected school workspace or assignment run, so it was not changed.");
      return;
    }
    const draft = reviewDrafts[proof.id];
    const items = proof.answers.map(answer => ({
      questionId: answer.questionId,
      outcome: draft?.outcomes[answer.questionId],
      feedback: "",
    })).filter((item): item is TeacherQuestionReview => Boolean(item.outcome));
    const result = reviewStudentLearningProof(proof, {
      teacherId: actorId,
      reviewedAt: new Date().toISOString(),
      items,
      summary: draft?.summary || "",
    });
    if (!result.ok) {
      setToast("Review every response and add one useful summary before saving.");
      return;
    }
    const teacherKey = teacherLearningProofKey(actorId, tenant);
    const studentKey = studentLearningProofKey(proof.studentId);
    const previousTeacher = window.localStorage.getItem(teacherKey);
    const previousStudent = window.localStorage.getItem(studentKey);
    const scopedTeacher = mergeScopedTeacherProofs(previousTeacher, window.localStorage.getItem(legacyTeacherLearningProofKey(actorId)), actorId, tenant);
    const nextTeacher = mergeLearningProof(scopedTeacher, result.proof);
    const nextStudent = mergeLearningProof(parseStudentLearningProofsFor(previousStudent, proof.studentId), result.proof);
    try {
      window.localStorage.setItem(studentKey, JSON.stringify(nextStudent));
      window.localStorage.setItem(teacherKey, JSON.stringify(nextTeacher));
      setLearningProofs(nextTeacher);
      setToast("Teacher review saved to the student’s local learning proof. Parent view can now show the reviewed outcome.");
    } catch {
      try {
        if (previousStudent === null) window.localStorage.removeItem(studentKey);
        else window.localStorage.setItem(studentKey, previousStudent);
        if (previousTeacher === null) window.localStorage.removeItem(teacherKey);
        else window.localStorage.setItem(teacherKey, previousTeacher);
      } catch {
        // The visible error remains truthful even if browser storage rollback is unavailable.
      }
      setToast("The local review could not be saved. Nothing is shown as delivered.");
    }
  }

  function forwardQuiz() {
    if (!context || !quizComplete || !confirmedRecipients.length || !prep.dueDate) {
      setToast(!confirmedRecipients.length
        ? "Confirm at least one local roster ID before forwarding."
        : "Complete every answer, source reference, and due date first.");
      return;
    }
    const createdAt = new Date().toISOString();
    const assignment: TeacherAssignmentRecord = {
      version: 1,
      id: actorId + ":" + createdAt,
      teacherId: actorId.trim().toLowerCase(),
      title: selectedChapter + " · source check",
      fromTeacher: teacherName,
      workspace: tenant,
      board: context.board,
      grade: context.grade,
      subject: context.subject,
      chapter: selectedChapter,
      bookId: context.bookId || "framework:" + [context.board, context.grade, context.subject].join(":"),
      bookName: context.book || "Connected curriculum framework",
      sourceEdition: isKarnatakaClass8Science ? "DSERT 2025–26 · 2026–27 verification pending" : "Edition recorded by the connected curriculum source",
      sourceAuthority: isKarnatakaClass8Science ? KARNATAKA_CLASS_8_SCIENCE_SOURCE.authority : "Teacher-connected curriculum source",
      dueDate: prep.dueDate,
      createdAt,
      recipients: confirmedRecipients,
      questions: quiz.map(item => ({ id: item.id, prompt: item.prompt, answer: item.answer, sourceRef: item.sourceRef, evidenceKind: resolveQuizEvidenceKind(item, officialQuestions) })),
      delivery: "same-browser-local",
    };
    const inboxUpdates = confirmedRecipients.flatMap(studentId => {
      const studentAssignment = studentAssignmentForRecipient(assignment, studentId);
      if (!studentAssignment) return [];
      const key = studentAssignmentInboxKey(studentId);
      const previous = window.localStorage.getItem(key);
      const inbox = parseStudentAssignmentsFor(previous, studentId);
      return [{ key, previous, next: JSON.stringify([studentAssignment, ...inbox.filter(item => item.id !== assignment.id)].slice(0, 50)) }];
    });
    if (inboxUpdates.length !== confirmedRecipients.length) {
      setToast("The local roster could not be validated, so no assignment receipt was created.");
      return;
    }
    const previousPrep = window.localStorage.getItem(storageKey);
    const nextPrep = { ...prep, assignments: [assignment, ...prep.assignments.filter(item => item.id !== assignment.id)].slice(0, 50) };
    try {
      inboxUpdates.forEach(update => window.localStorage.setItem(update.key, update.next));
      window.localStorage.setItem(storageKey, JSON.stringify(nextPrep));
      setPrep(nextPrep);
      setReviewAssignmentId(assignment.id);
      setToast("Quiz saved to " + confirmedRecipients.length + " teacher-confirmed local inbox" + (confirmedRecipients.length === 1 ? "" : "es") + ". Expected answers stayed in the teacher record; account delivery is not verified.");
    } catch {
      inboxUpdates.forEach(update => {
        try {
          if (update.previous === null) window.localStorage.removeItem(update.key);
          else window.localStorage.setItem(update.key, update.previous);
        } catch {
          // The visible error remains truthful even if browser storage rollback is unavailable.
        }
      });
      try {
        if (previousPrep === null) window.localStorage.removeItem(storageKey);
        else window.localStorage.setItem(storageKey, previousPrep);
      } catch {
        // The visible error remains truthful even if browser storage rollback is unavailable.
      }
      setToast("The local quiz could not be saved. No delivery is claimed.");
    }
  }

  function saveOutcome() {
    const recordedAt = new Date().toISOString();
    const record: TeachingHistory = {
      id: actorId + ":" + recordedAt,
      chapter: selectedChapter,
      outcome,
      actualMinutes: Math.max(1, actualMinutes),
      confidence: classConfidence,
      recordedAt,
    };
    const next = { ...prep, history: [...prep.history, record].slice(-100), readyAt: "" };
    setPrep(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    onLessonOutcome?.(outcome, classConfidence);
    setToast(outcome === "taught" ? "Saved to today’s teaching loop. The exact next chapter can unlock on the next teaching day." : "Saved to today’s teaching loop. Zappy will keep this chapter in the next prep.");
  }

  function markReady(closeAfter = false) {
    const next = { ...prep, readyAt: new Date().toISOString() };
    setPrep(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    if (closeAfter) onClose();
    else setToast("Prep saved. Evidence-locked cards stay visible without blocking tomorrow’s class.");
  }

  function renderPanel() {
    if (!context) return <section className="prep-panel evidence-lock">
      <span>🧭</span><small>CLASS CONTEXT REQUIRED</small>
      <h2>Choose the exact learning stage first</h2>
      <p>Close this window and set board, class, subject, exact book, and current chapter. Zappy will not substitute a generic topic.</p>
      <button onClick={onClose}>SET CLASS STAGE</button>
    </section>;

    if (activeStage === 0) return <section className="prep-panel">
      <header className="prep-panel-head"><div><small>1 OF 6 · CLASSROOM SCRIPT</small><h2>Copy-ready teaching timeline</h2><p>Editable planning template. It is not textbook wording until you add page or timestamp citations.</p></div><button onClick={copyScript}>COPY FULL SCRIPT</button></header>
      <div className="script-blocks">{script.map(block => <article className="script-block" key={block.id}>
        <div><span>{block.startMinute}–{block.endMinute}</span><b>{block.label}</b></div>
        <label>Teacher says<textarea value={block.teacherSays} onChange={event => updateScript(block.id, "teacherSays", event.target.value)}/></label>
        <label>Students do<textarea value={block.studentsDo} onChange={event => updateScript(block.id, "studentsDo", event.target.value)}/></label>
        <label>Source page / timestamp<input value={block.sourceRef} onChange={event => updateScript(block.id, "sourceRef", event.target.value)} placeholder="Required before treating this block as source-backed"/></label>
      </article>)}</div>
    </section>;

    if (activeStage === 1) return <section className="prep-panel">
      <header className="prep-panel-head"><div><small>2 OF 6 · STUDY MATERIAL</small><h2>Original chapter sources, inside Zappy</h2><p>Use the official material directly. No external portal handoff.</p></div>{resources.length > 0 && <button onClick={onOpenSource}>OPEN DIKSHA PLAYER</button>}</header>
      {isKarnatakaClass8Science && <div className="source-material-grid official-material-card"><article className="source-material">
        <span>📘</span><div><small>OFFICIAL · {KARNATAKA_CLASS_8_SCIENCE_SOURCE.academicYear} · {KARNATAKA_CLASS_8_SCIENCE_SOURCE.medium}</small><b>{KARNATAKA_CLASS_8_SCIENCE_SOURCE.documentTitle}</b><p>{KARNATAKA_CLASS_8_SCIENCE_SOURCE.authority} · module pages {KARNATAKA_CLASS_8_SCIENCE_UNITS[selectedIndex]?.indexedContentPageRange || "see index"}</p></div><button onClick={() => setShowOfficialPdf(value => !value)}>{showOfficialPdf ? "CLOSE IN-APP PDF" : "READ IN ZAPPY"}</button>
      </article></div>}
      {showOfficialPdf && isKarnatakaClass8Science && <div className="official-material-viewer"><iframe title={KARNATAKA_CLASS_8_SCIENCE_SOURCE.documentTitle} src="/api/official-material?id=karnataka-class8-science-lba-2025-26"/></div>}
      {officialOutcomes.length > 0 && <div className="official-outcomes"><header><small>12 VERIFIED LEARNING OUTCOMES</small><b>Force and Pressure · DSERT PDF p. 21</b></header><div>{officialOutcomes.map(outcomeItem => <span key={outcomeItem.id}><i>{outcomeItem.sourceNumber}</i>{outcomeItem.text}</span>)}</div></div>}
      {sourceState === "loading" && !isKarnatakaClass8Science ? <div className="evidence-lock"><span>📚</span><h3>Checking playable sources…</h3></div>
        : resources.length ? <div className="source-material-grid">{resources.map(resource => <article className="source-material" key={resource.id}>
          <span>{sourceKindIcon(resource.kind)}</span><div><small>{resource.kind.toUpperCase()} · {resource.rights.license}</small><b>{resource.title}</b><p>{resource.creator || resource.organisation.join(", ") || "Creator listed in source proof"}</p></div><button onClick={onOpenSource}>PLAY IN ZAPPY</button>
        </article>)}</div>
        : !isKarnatakaClass8Science && <div className="evidence-lock"><span>🔒</span><h3>Exact chapter indexed; playable asset unavailable</h3><p>{sourceMessage || "No allowlisted PDF, video, audio, or image is attached to this exact chapter."}</p></div>}
      {isKarnatakaClass8Science && <div className="source-version-warning"><b>Source boundary</b><span>{KARNATAKA_CLASS_8_SCIENCE_2026_27_NOTICE.notice}</span><span>{KARNATAKA_CLASS_8_SCIENCE_LEGACY_DIKSHA_BOOK.notice}</span></div>}
    </section>;

    if (activeStage === 2) return <section className="prep-panel">
      <header className="prep-panel-head"><div><small>3 OF 6 · VIDEO LANE</small><h2>Finite, teacher-reviewed video choices</h2><p>At most three reviewed exact-chapter videos. Nothing autoplays and no watch-time feed appears.</p></div><span>{reviewedVideos.length}/3 REVIEWED</span></header>
      {sourceVideos.length > 0 && <div className="source-material-grid">{sourceVideos.map(resource => <article className="source-material" key={resource.id}>
        <span>▶️</span><div><small>OFFICIAL SOURCE VIDEO</small><b>{resource.title}</b><p>{sourceLabel(resource)}</p></div><button onClick={onOpenSource}>PLAY IN ZAPPY</button>
      </article>)}</div>}
      <div className="video-empty">
        <div><span>▶️</span><p><b>Reviewed YouTube catalogue</b><small>{reviewedVideos.length ? "Saved by the teacher for this exact chapter." : "No AI recommendation is shown until a human reviews the exact match."}</small></p></div>
        {reviewedVideos.map(video => <article key={video.id}>
          <iframe src={"https://www.youtube-nocookie.com/embed/" + video.youtubeId} title={video.title} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/>
          <p><b>{video.title}</b><small>Teacher reviewed · no autoplay</small></p><button onClick={() => removeReviewedVideo(video.id)}>REMOVE</button>
        </article>)}
        {reviewedVideos.length < 3 && <div className="video-review-form"><label>Video title<input value={videoTitle} onChange={event => setVideoTitle(event.target.value)} placeholder="Exact topic and language"/></label><label>YouTube link<input value={videoUrl} onChange={event => setVideoUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=…"/></label><button onClick={addReviewedVideo}>ADD AS TEACHER-REVIEWED</button></div>}
      </div>
    </section>;

    if (activeStage === 3 && officialQuestions.length) return <section className="prep-panel official-question-panel">
      <header className="prep-panel-head"><div><small>4 OF 6 · OFFICIAL PRACTICE BANK</small><h2>{officialQuestions.length} verified Force and Pressure questions</h2><p>DSERT 2025–26 · exact source number, marks, difficulty, and PDF page. These are not previous-year appearances.</p></div><button onClick={addOfficialQuestionsToQuiz}>ADD FIRST 5 TO QUIZ</button></header>
      <div className="question-evidence-banner"><span>✓</span><p><b>Official practice evidence</b><small>0 verified past-paper years · frequency and forecast remain locked</small></p></div>
      <div className="official-question-bank">{officialQuestions.map(question => <article key={question.id}>
        <header><span>Q{question.sourceNumber}</span><b>{question.marks} mark{question.marks === 1 ? "" : "s"}</b><em>{question.difficulty}</em><i>PDF p. {question.sourcePdfPages.join(", ")}</i></header>
        <p>{question.prompt}</p>
        {question.options && <div>{question.options.map(option => <span key={option}>{option}</span>)}</div>}
        <footer><b>OFFICIAL PRACTICE QUESTION BANK</b><small>Past-paper year: not applicable · appearance frequency: not available</small></footer>
      </article>)}</div>
      <div className="question-integrity-note"><b>Source integrity note</b><p>{FORCE_AND_PRESSURE_SOURCE_INTEGRITY.notice}</p></div>
      <button className="secondary-evidence-button" onClick={onOpenEvidence}>ADD VERIFIED PAST PAPERS FOR RECURRENCE →</button>
    </section>;

    if (activeStage === 3) return <section className="prep-panel evidence-lock">
      <span>🎯</span><small>4 OF 6 · IMPORTANT QUESTIONS</small><h2>Question ranking is evidence-locked</h2>
      <p>Zappy has <b>0 verified paper years</b> for this exact book, medium, syllabus edition, exam, and chapter. It will not invent a year, frequency, question number, marks, or page.</p>
      <div><b>Unlock rule</b><span>Paper + year + exam + syllabus edition + question number + marks + page citation</span><span>At least 5 distinct verified years for recurrence evidence</span></div>
      <button onClick={onOpenEvidence}>ADD & VERIFY OFFICIAL PAPERS</button>
    </section>;

    if (activeStage === 4) return <section className="prep-panel likelihood-lock">
      <span>📊</span><small>5 OF 6 · EXAM LIKELIHOOD</small><h2>Probability is locked—honestly</h2>
      <p>A percentage will appear only after a documented model is calibrated and tested on held-out exam years. Five uploaded filenames are not enough.</p>
      <div><span><b>Observed recurrence</b><em>LOCKED</em><small>Distinct verified years containing the pattern ÷ verified years analysed</small></span><span><b>Next-exam probability</b><em>LOCKED</em><small>Requires calibrated, backtested forecasting—not a confidence label</small></span></div>
      <button onClick={onOpenEvidence}>OPEN EVIDENCE METHOD</button>
    </section>;

    return <section className="prep-panel">
      <header className="prep-panel-head"><div><small>6 OF 6 · QUIZ</small><h2>Teacher-reviewed quiz to forward</h2><p>Five editable starter prompts. Complete the expected answer and source reference before delivery.</p></div><span>{quiz.filter(item => item.answer && item.sourceRef).length}/5 REVIEWED</span></header>
      <div className="quiz-send-panel">
        <div className="quiz-question-list">{quiz.map((question, index) => <article className="quiz-question" key={question.id}>
          <span>{index + 1}</span><div><small className={`quiz-origin ${resolveQuizEvidenceKind(question, officialQuestions)}`}>{resolveQuizEvidenceKind(question, officialQuestions) === "official-practice" ? "✓ Exact official practice item" : question.origin?.kind === "official-practice" ? "Edited · teacher-cited" : "Teacher-cited draft"}</small><label>Question<textarea maxLength={20_000} value={question.prompt} onChange={event => updateQuiz(question.id, "prompt", event.target.value)}/></label><label>Expected answer<textarea maxLength={20_000} value={question.answer} onChange={event => updateQuiz(question.id, "answer", event.target.value)} placeholder="Teacher-reviewed answer required"/></label><label>Source page / timestamp<input maxLength={2_000} value={question.sourceRef} onChange={event => updateQuiz(question.id, "sourceRef", event.target.value)} placeholder="Example: textbook p. 42 or video 03:10"/></label></div>
        </article>)}</div>
        <aside>
          <small>LOCAL DELIVERY CHECK</small><h3>Teacher-confirmed roster</h3>
          <div className="teacher-ai-roster-add"><label>One student Zappy ID<input value={recipientDraft} onChange={event => setRecipientDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); confirmLocalRosterId(); } }} placeholder="@student_zappy"/></label><button type="button" disabled={!recipientDraft.trim()} onClick={confirmLocalRosterId}>CONFIRM ID</button></div>
          {confirmedRecipients.length > 0 && <div className="teacher-ai-roster-list" aria-label="Teacher-confirmed local roster">{confirmedRecipients.map(recipient => <span key={recipient}>{recipient}<button type="button" onClick={() => removeLocalRosterId(recipient)} aria-label={"Remove " + recipient}>×</button></span>)}</div>}
          <label>Due date<input type="date" value={prep.dueDate} onChange={event => updatePrep({ dueDate: event.target.value })}/></label>
          <p>{confirmedRecipients.length ? confirmedRecipients.length + " teacher-confirmed local roster ID" + (confirmedRecipients.length === 1 ? "" : "s") + ". Account existence is not verified." : "No local roster IDs confirmed. This prototype cannot look up real accounts."}</p>
          <button disabled={!quizComplete || !confirmedRecipients.length || !prep.dueDate} onClick={forwardQuiz}>SAVE TO LOCAL INBOX →</button>
          {currentAssignment && <div className="assignment-receipt"><b>✓ Latest receipt for this module</b><small>{currentAssignment.recipients.length} recipient(s) · due {currentAssignment.dueDate}</small><em>Saved on this browser · account delivery unverified</em></div>}
        </aside>
      </div>
      {reviewAssignment && <details className="assignment-results">
        <summary><span><b>Student learning proofs</b><small>Every assignment run stays reviewable; free-text work waits for a human.</small></span><em>{currentProofs.length}/{reviewAssignment.recipients.length} submitted · {reviewedProofCount} reviewed</em></summary>
        {moduleAssignments.length > 1 && <label className="assignment-run-picker">Assignment run<select value={reviewAssignment.id} onChange={event => setReviewAssignmentId(event.target.value)}>{moduleAssignments.map(assignment => {
          const proofCount = learningProofs.filter(proof => proof.assignmentId === assignment.id).length;
          const reviewCount = learningProofs.filter(proof => proof.assignmentId === assignment.id && proof.review).length;
          return <option value={assignment.id} key={assignment.id}>{formatLocalTimestamp(assignment.createdAt)} · due {assignment.dueDate} · {proofCount} submitted · {reviewCount} reviewed</option>;
        })}</select></label>}
        {!currentProofs.length ? <div className="assignment-results-empty"><span>📭</span><p><b>No student submission yet</b><small>This updates only after a recipient explicitly submits on this browser.</small></p></div> : <div className="assignment-result-list">{currentProofs.map(proof => {
          const draft = reviewDrafts[proof.id];
          return <article className="assignment-result-row" key={proof.id}>
            <header><span>🧒</span><p><b>{proof.studentName}</b><small>{proof.studentId} · {formatLocalTimestamp(proof.submittedAt)}</small></p><em className={proof.review ? "reviewed" : "waiting"}>{proof.review ? "REVIEWED" : "NEEDS REVIEW"}</em></header>
            <div className="assignment-result-counts"><span>👍 {proof.selfCheck["got-it"]} got it</span><span>🌱 {proof.selfCheck.almost} almost</span><span>🛟 {proof.selfCheck["needs-help"]} need help</span><span>📎 {proof.sourceProofCount} cited</span></div>
            {proof.review ? <div className="assignment-result-review saved"><b>Teacher review</b><p>{proof.review.summary}</p><div>{proof.review.items.map(item => <span className={item.outcome} key={item.questionId}>{item.questionId}: {item.outcome}</span>)}</div></div> : <div className="assignment-result-review">
              {proof.answers.map((answer, answerIndex) => {
                const expected = reviewAssignment.questions.find(question => question.id === answer.questionId)?.answer || "Teacher answer unavailable";
                return <section key={answer.questionId}><small>QUESTION {answerIndex + 1}</small><b>{answer.prompt}</b><p><strong>Student:</strong> {answer.response}</p><p><strong>Teacher key:</strong> {expected}</p><em>{answer.sourceRef}</em><div>{(["correct", "partly", "retry"] as TeacherQuestionReview["outcome"][]).map(reviewOutcome => <button type="button" className={draft?.outcomes[answer.questionId] === reviewOutcome ? "on" : ""} onClick={() => setReviewOutcome(proof.id, answer.questionId, reviewOutcome)} key={reviewOutcome}>{reviewOutcome === "correct" ? "✓ Correct" : reviewOutcome === "partly" ? "◐ Partly" : "↻ Retry"}</button>)}</div></section>;
              })}
              <label>One useful teacher summary<textarea maxLength={5_000} value={draft?.summary || ""} onChange={event => setReviewSummary(proof.id, event.target.value)} placeholder="What was understood, and what should the learner revisit?"/></label>
              <button className="assignment-review-save" type="button" onClick={() => saveLearningReview(proof)}>SAVE HUMAN REVIEW →</button>
            </div>}
          </article>;
        })}</div>}
      </details>}
    </section>;
  }

  return <div className="teacher-prep-modal teacher-ai-modal modal-backdrop" role="dialog" aria-modal="true" aria-label="Zappy Teacher AI daily preparation">
    <section className="teacher-prep-shell teacher-ai-shell">
      <header className="prep-topbar teacher-ai-topbar">
        <div className="prep-brand"><span>⚡</span><div><small>ZAPPY TEACHER AI</small><b>Teaching Command Centre</b><p>Exact source · guided preparation · teacher stays in control</p></div></div>
        <div className={"prep-source-chip " + (context && (sourceState === "ready" || isKarnatakaClass8Science) ? "ready" : "locked")}><i>{context && (sourceState === "ready" || isKarnatakaClass8Science) ? "✓" : "!"}</i><span><b>{isKarnatakaClass8Science ? "DSERT 2025–26 · official assessment source" : context?.book || "Exact book not selected"}</b><small>{isKarnatakaClass8Science ? "13 indexed units · 2026–27 verification pending" : sourceState === "ready" ? (sourceBook?.playableResourceCount || 0) + " playable resources in this book" : "Source-dependent outputs remain gated"}</small></span></div>
        <button className="prep-close" onClick={onClose} aria-label="Close teacher preparation">×</button>
      </header>

      <div className="teacher-ai-body">
        <aside className="teacher-ai-pulse" aria-label="Today’s teaching pulse">
          <div className="teacher-ai-pulse-head"><span>⚡</span><div><b>Today’s Teaching Pulse</b><small>{teacherPulse.filter(step => step.done).length}/5 checks complete</small></div></div>
          <ol className="teacher-ai-pulse-list">{teacherPulse.map((step, index) => <li className={`teacher-ai-pulse-step ${step.done ? "done" : index === activePulseIndex ? "active" : "locked"}`} key={step.label}><span className="teacher-ai-step-dot">{step.done ? "✓" : index + 1}</span><p><b>{step.label}</b><small>{step.detail}</small></p></li>)}</ol>
          <nav className="teacher-ai-nav" aria-label="Teacher AI workspaces">{RUNWAY.map((step, index) => <button key={step.id} className={`${activeStage === index ? "active" : ""} ${statuses[index].state}`} onClick={() => setActiveStage(index)}><span>{step.icon}</span><p><b>{step.label}</b><small>{statuses[index].state === "ready" ? "Ready" : statuses[index].state === "input" ? "Review" : "Evidence locked"}</small></p></button>)}</nav>
          <button className={`teacher-ai-auto ${prep.autoPrepEnabled ? "on" : ""}`} aria-pressed={prep.autoPrepEnabled} onClick={toggleDailyAssist}><span>🤖</span><p><b>Daily Assist</b><small>{prep.autoPrepEnabled ? "Exact next/review pick enabled" : "Turn on safe AI pick"}</small></p><i>{prep.autoPrepEnabled ? "ON" : "OFF"}</i></button>
          <div className="teacher-ai-profile"><span>👩‍🏫</span><p><b>{teacherName}</b><small>{tenant}</small></p><em>{prep.readyAt ? "PREP SAVED" : "IN PREP"}</em></div>
        </aside>

        <aside className="teacher-ai-smart-panel" aria-label="Smart preparation cards">
          <section className="teacher-ai-smart-section"><small>📍 TODAY’S CLASS</small><article className="teacher-ai-smart-card"><header><span>🏫</span><p><b>{context?.board || "Class stage required"}</b><small>{context ? context.grade + " · " + context.subject : "Connect the exact source first"}</small></p></header><div className="teacher-ai-context-tags"><span>{prep.classLabel || context?.grade || "No section"}</span><span>{prep.periodCount} × {prep.periodMinutes}m</span><span>{prep.durationSource} plan</span></div><div className="teacher-ai-meter" role="progressbar" aria-label="Position in selected sequence" aria-valuemin={0} aria-valuemax={100} aria-valuenow={sequencePosition}><i style={{ width: sequencePosition + "%" }}/></div><p>{chapters.length ? `Position ${selectedIndex + 1} of ${chapters.length} in the connected sequence` : "No verified sequence connected"}</p></article></section>

          <section className="teacher-ai-smart-section"><small>📌 ACTIVE MODULE</small><article className="teacher-ai-smart-card active"><header><span>📚</span><p><b>{selectedChapter || "No exact module"}</b><small>{prep.selectionMode === "ai" ? "Daily Assist pick" : "Teacher pick"} · {prep.selectionReason}</small></p></header>{context && <label>Exact ordered module<select value={selectedChapter} onChange={event => chooseChapter(event.target.value, "teacher", "Teacher selected this module from the exact ordered book.")}>{chapters.map((chapter, index) => <option key={index + ":" + chapter} value={chapter}>{index + 1}. {chapter}</option>)}</select></label>}<button onClick={applyAiPick} disabled={!context}>USE SAFE AI PICK</button></article></section>

          <section className="teacher-ai-smart-section"><small>🛡️ SOURCE & EVIDENCE</small><article className="teacher-ai-smart-card"><div className="teacher-ai-evidence-row"><span className={resources.length || isKarnatakaClass8Science ? "ready" : "locked"}>{resources.length || isKarnatakaClass8Science ? "✓" : "🔒"}</span><p><b>Chapter material</b><small>{isKarnatakaClass8Science ? "Official DSERT PDF + " + resources.length + " DIKSHA item(s)" : resources.length + " playable item(s)"}</small></p></div><div className="teacher-ai-evidence-row"><span className={officialQuestions.length ? "ready" : "locked"}>{officialQuestions.length ? "✓" : "🔒"}</span><p><b>Important questions</b><small>{officialQuestions.length ? officialQuestions.length + " official practice items · not past papers" : "0 verified past-paper years"}</small></p></div><div className="teacher-ai-evidence-row"><span className="locked">🔒</span><p><b>Exam probability</b><small>Requires a calibrated, backtested model</small></p></div></article></section>

          <section className="teacher-ai-smart-section"><small>📊 PREP STATUS</small><div className="prep-status-list teacher-ai-smart-card">{statuses.map((item, index) => <button key={item.label} className={item.state} onClick={() => setActiveStage(index)}><i>{item.state === "ready" ? "✓" : item.state === "input" ? "✎" : "🔒"}</i><span><b>{item.label}</b><small>{item.detail}</small></span></button>)}</div></section>

          <details className="teacher-ai-controls"><summary>⚙️ Class controls <span>Schedule, medium & period plan</span></summary><div><label>Class / section<input value={prep.classLabel} onChange={event => updatePrep({ classLabel: event.target.value })} placeholder={context?.grade || "Class and section"}/></label><label>Medium<input value={prep.medium} onChange={event => updatePrep({ medium: event.target.value })} placeholder="Set school medium"/></label><label>Next period<input type="time" value={prep.classTime} onChange={event => updatePrep({ classTime: event.target.value })}/></label><fieldset><legend>Teaching days</legend>{WEEKDAYS.map(day => <button type="button" key={day.id} aria-pressed={prep.timetableDays.includes(day.id)} onClick={() => updatePrep({ timetableDays: prep.timetableDays.includes(day.id) ? prep.timetableDays.filter(item => item !== day.id) : [...prep.timetableDays, day.id].sort() })}>{day.label}</button>)}</fieldset><label>Periods<input type="number" min={1} max={12} value={prep.periodCount} onChange={event => updatePrep({ periodCount: Math.min(12, Math.max(1, Number(event.target.value) || 1)) })}/></label><label>Minutes<input type="number" min={20} max={120} value={prep.periodMinutes} onChange={event => updatePrep({ periodMinutes: Math.min(120, Math.max(20, Number(event.target.value) || 40)), scripts: {} })}/></label><label>Time source<select value={prep.durationSource === "official" ? "teacher" : prep.durationSource} onChange={event => updatePrep({ durationSource: event.target.value as DurationSource })}><option value="teacher">Teacher estimate</option><option value="school">School plan</option><option value="official" disabled>Official hours not published</option></select></label></div></details>

          <section className="prep-outcome teacher-ai-smart-card"><small>AFTER CLASS · DAILY LOOP</small><b>What actually happened?</b><div>{(["taught", "partial", "not-taught"] as TeachingOutcome[]).map(item => <button className={outcome === item ? "on" : ""} key={item} onClick={() => setOutcome(item)}>{item === "taught" ? "Taught" : item === "partial" ? "Partly" : "Not taught"}</button>)}</div><label>Actual minutes<input type="number" min={1} max={180} value={actualMinutes} onChange={event => setActualMinutes(Number(event.target.value) || 1)}/></label><label>Class confidence<select value={classConfidence} onChange={event => setClassConfidence(event.target.value as ClassConfidence)}><option value="needs-review">Needs review</option><option value="steady">Steady</option><option value="strong">Strong</option></select></label><button className="save-outcome" disabled={!context} onClick={saveOutcome}>SAVE TO TODAY’S LOOP</button>{lastHistory && <p>Last saved: {lastHistory.chapter} · {lastHistory.outcome}</p>}</section>
        </aside>

        <main className="teacher-ai-chat">
          <header className="teacher-ai-toolbar"><div><b>AI Teaching Assistant</b><small>{context ? context.board + " · " + context.grade + " · " + context.subject : "Exact class stage not connected"}</small></div><span>{readyCount}/6 ready</span><button onClick={toggleDailyAssist}>{prep.autoPrepEnabled ? "⚡ DAILY ASSIST ON" : "⚡ ENABLE DAILY ASSIST"}</button><button onClick={copyScript} disabled={!context}>📋 COPY SCRIPT</button></header>
          <div className="teacher-ai-chat-stream" aria-live="polite">
            <article className="teacher-ai-message ai"><span className="teacher-ai-avatar">⚡</span><div><small>ZAPPY TEACHER AI</small><div className="teacher-ai-bubble"><p>{greetingFor(now)}, {teacherName}! {nextLesson ? "Your next scheduled period is " + formatLessonDate(nextLesson) + "." : context ? "Add a timetable if you want the next period shown here." : "Choose the exact learning stage to begin."}</p><p>{context ? `I’m holding “${selectedChapter}” in the exact connected order. ${readyCount} of 6 preparation lanes are ready; the remaining lanes clearly show teacher input or evidence locks.` : "I will not substitute a generic topic while the class source is missing."}</p><div className="teacher-ai-highlight"><b>Today’s safe preparation</b><span>Editable classroom script</span><span>Original source material inside Zappy</span><span>Finite reviewed videos</span><span>Evidence-gated questions and quiz delivery</span></div><div className="teacher-ai-actions"><button onClick={() => askTeacherAi("Show today’s classroom script")}>📋 Today’s script</button><button onClick={() => askTeacherAi("Show the source material and topic breakdown")}>📖 Topic source</button><button onClick={() => askTeacherAi("Show important questions")}>🎯 Questions</button><button onClick={() => askTeacherAi("Prepare the teacher-reviewed quiz")}>📝 Quiz</button></div></div></div></article>

            {context && <article className="teacher-ai-message ai"><span className="teacher-ai-avatar">⚡</span><div><small>EXACT ORDERED MODULES</small><div className="teacher-ai-bubble"><p>Zappy reads these module names from the connected sequence. It does not invent Biology, Physics, or Chemistry categories unless the source publishes them.</p><div className="teacher-ai-module-list">{chapters.map((chapter, index) => <button className={chapter === selectedChapter ? "active" : ""} onClick={() => chooseChapter(chapter, "teacher", "Teacher selected this module from the exact ordered book.")} key={index + ":" + chapter}><span>{chapter === selectedChapter ? "✓" : index + 1}</span><p><b>{chapter}</b><small>{isKarnatakaClass8Science ? KARNATAKA_CLASS_8_SCIENCE_UNITS[index]?.part + " · source pages " + KARNATAKA_CLASS_8_SCIENCE_UNITS[index]?.indexedContentPageRange : "Exact book position " + (index + 1)}</small></p></button>)}</div></div></div></article>}

            {assistantMessages.map(message => <article className={`teacher-ai-message ${message.role}`} key={message.id}><span className="teacher-ai-avatar">{message.role === "teacher" ? "👩‍🏫" : "⚡"}</span><div><small>{message.role === "teacher" ? teacherName : "ZAPPY TEACHER AI"}</small><div className="teacher-ai-bubble"><p>{message.text}</p></div></div></article>)}

            <section className="prep-stage-workspace" aria-label={`${RUNWAY[activeStage].label} workspace`}>
              <header><div><small>{activeStage + 1} OF 6 · GUIDED WORKSPACE</small><b>{RUNWAY[activeStage].icon} {RUNWAY[activeStage].label}</b></div><p>{statuses[activeStage].detail}</p></header>
              {context && <section className="prep-overview"><div className="prep-module-picker"><div><small>{context.board} · {context.grade} · {context.subject}</small><h2>{selectedChapter}</h2><p>{prep.selectionMode === "ai" ? "AI PICK · " : "TEACHER PICK · "}{prep.selectionReason}</p></div><button onClick={applyAiPick}>USE AI PICK</button><label>Choose module<select value={selectedChapter} onChange={event => chooseChapter(event.target.value, "teacher", "Teacher selected this module from the exact ordered book.")}>{chapters.map((chapter, index) => <option key={index + ":" + chapter} value={chapter}>{index + 1}. {chapter}</option>)}</select></label></div>{isKarnatakaClass8Science && <div className="prep-version-note"><span>🛡️</span><p><b>Official 2025–26 assessment source · 2026–27 verification pending</b><small>The 2023 DIKSHA collection remains a legacy playback source, not current-syllabus proof.</small></p></div>}<div className="prep-module-window"><article className={!previousChapter ? "empty" : ""}><small>PREVIOUS</small><b>{previousChapter || "Start of book"}</b></article><article className="current"><small>CURRENT · {selectedIndex + 1}/{chapters.length}</small><b>{selectedChapter}</b><span>{prep.periodCount} × {prep.periodMinutes} min · {prep.durationSource} plan</span></article><article className={!nextChapter ? "empty" : ""}><small>NEXT IN BOOK</small><b>{nextChapter || "End of book"}</b></article></div></section>}
              {renderPanel()}
            </section>
          </div>
          <form className="teacher-ai-command" onSubmit={event => { event.preventDefault(); askTeacherAi(assistantInput); }}><label className="visually-hidden" htmlFor="teacher-ai-command">Ask Zappy Teacher AI</label><textarea id="teacher-ai-command" value={assistantInput} onChange={event => setAssistantInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); askTeacherAi(assistantInput); } }} placeholder="Ask: Show my script · Open sources · Why is probability locked?" rows={1}/><button disabled={!assistantInput.trim()} aria-label="Send teacher command">➤</button></form>
        </main>
      </div>

      <footer className="prep-footer"><p><b>Daily Assist suggests and drafts. You review, forward, and record what happened.</b><small>No autoplay, background sending, invented exam evidence, or fake delivery receipts.</small></p><button onClick={() => markReady(false)} disabled={!context}>MARK PREP READY</button><button className="primary" onClick={() => markReady(true)} disabled={!context}>SAVE PREP & CLOSE</button></footer>
      {toast && <button className="prep-toast" onClick={() => setToast("")} aria-live="polite">{toast}<span>×</span></button>}
    </section>
  </div>;
}
