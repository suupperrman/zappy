export type LearningConfidence = "needs-help" | "almost" | "got-it";

export type TeacherAssignmentQuestion = {
  id: string;
  prompt: string;
  answer: string;
  sourceRef: string;
  evidenceKind: "official-practice" | "teacher-cited";
};

export type StudentAssignmentQuestion = Omit<TeacherAssignmentQuestion, "answer">;

export type TeacherAssignmentRecord = {
  version: 1;
  id: string;
  teacherId: string;
  title: string;
  fromTeacher: string;
  workspace: string;
  board: string;
  grade: string;
  subject: string;
  chapter: string;
  bookId: string;
  bookName: string;
  sourceEdition: string;
  sourceAuthority: string;
  dueDate: string;
  createdAt: string;
  recipients: string[];
  questions: TeacherAssignmentQuestion[];
  delivery: "same-browser-local";
};

export type StudentAssignmentRecord = {
  version: 1;
  id: string;
  teacherId: string;
  recipientId: string;
  title: string;
  fromTeacher: string;
  workspace: string;
  board: string;
  grade: string;
  subject: string;
  chapter: string;
  bookId: string;
  bookName: string;
  sourceEdition: string;
  sourceAuthority: string;
  dueDate: string;
  createdAt: string;
  questions: StudentAssignmentQuestion[];
  delivery: "same-browser-local";
};

export type StudentQuestionProof = {
  questionId: string;
  prompt: string;
  response: string;
  sourceRef: string;
  evidenceKind: "official-practice" | "teacher-cited";
  confidence: LearningConfidence;
};

export type TeacherQuestionReview = {
  questionId: string;
  outcome: "correct" | "partly" | "retry";
  feedback: string;
};

export type TeacherLearningReview = {
  teacherId: string;
  reviewedAt: string;
  items: TeacherQuestionReview[];
  summary: string;
};

export type StudentLearningProof = {
  version: 1;
  id: string;
  assignmentId: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  workspace: string;
  board: string;
  grade: string;
  subject: string;
  chapter: string;
  bookId: string;
  bookName: string;
  sourceEdition: string;
  sourceAuthority: string;
  dueDate: string;
  late: boolean;
  submittedAt: string;
  answers: StudentQuestionProof[];
  selfCheck: Record<LearningConfidence, number>;
  sourceProofCount: number;
  coinsAwarded: number;
  delivery: "same-browser-local";
  status: "completed";
  review?: TeacherLearningReview;
};

export type StudentAnswerDraft = {
  questionId: string;
  response: string;
  confidence: LearningConfidence | null;
};

export type StudentAssignmentDraft = {
  version: 1;
  assignmentId: string;
  studentId: string;
  currentIndex: number;
  responses: Record<string, string>;
  confidence: Record<string, LearningConfidence>;
  updatedAt: string;
};

export type ParentDiaryEntry = {
  version: 1;
  id: string;
  parentId: string;
  studentId: string;
  proofId: string;
  childResponse: string;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateLearningProofResult =
  | { ok: true; proof: StudentLearningProof }
  | { ok: false; reason: "not-recipient" | "invalid-assignment" | "incomplete-answers" | "invalid-time" };

export type ReviewLearningProofResult =
  | { ok: true; proof: StudentLearningProof }
  | { ok: false; reason: "wrong-teacher" | "incomplete-review" | "invalid-time" };

const ID_PATTERN = /^@[a-z0-9_.-]+$/;
const CONFIDENCES = new Set<LearningConfidence>(["needs-help", "almost", "got-it"]);

function boundedRecordId(prefix: string, ...parts: string[]) {
  let hash = 14_695_981_039_346_656_037n;
  const input = parts.join("\u241f");
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 1_099_511_628_211n);
  }
  return prefix + ":" + hash.toString(36);
}

export function normaliseZappyId(value: string) {
  const result = value.trim().toLowerCase();
  return ID_PATTERN.test(result) ? result : "";
}

export function studentAssignmentInboxKey(studentId: string) {
  const id = normaliseZappyId(studentId);
  if (!id) throw new Error("A valid student Zappy ID is required.");
  return "zappy:student-inbox:v1:" + encodeURIComponent(id);
}

export function studentLearningProofKey(studentId: string) {
  const id = normaliseZappyId(studentId);
  if (!id) throw new Error("A valid student Zappy ID is required.");
  return "zappy:student-learning-proof:v1:" + encodeURIComponent(id);
}

export function normaliseWorkspace(value: string) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLowerCase() : "";
}

export function legacyTeacherLearningProofKey(teacherId: string) {
  const id = normaliseZappyId(teacherId);
  if (!id) throw new Error("A valid teacher Zappy ID is required.");
  return "zappy:teacher-learning-proof:v1:" + encodeURIComponent(id);
}

export function teacherLearningProofKey(teacherId: string, workspace: string) {
  const id = normaliseZappyId(teacherId);
  const scope = normaliseWorkspace(workspace);
  if (!id) throw new Error("A valid teacher Zappy ID is required.");
  if (!scope || scope.length > 2_000) throw new Error("A valid workspace is required.");
  return "zappy:teacher-learning-proof:v2:" + encodeURIComponent(id) + ":" + encodeURIComponent(scope);
}

export function studentAssignmentDraftKey(studentId: string, assignmentId: string) {
  const id = normaliseZappyId(studentId);
  if (!id) throw new Error("A valid student Zappy ID is required.");
  if (!assignmentId.trim()) throw new Error("An assignment ID is required.");
  return "zappy:student-assignment-draft:v1:" + encodeURIComponent(id) + ":" + encodeURIComponent(assignmentId);
}

export function parentLearningDiaryKey(parentId: string, studentId: string) {
  const parent = normaliseZappyId(parentId);
  const student = normaliseZappyId(studentId);
  if (!parent || !student) throw new Error("Valid parent and student Zappy IDs are required.");
  return "zappy:parent-learning-diary:v1:" + encodeURIComponent(parent) + ":" + encodeURIComponent(student);
}

function safeText(value: unknown, maxLength = 20_000): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function isIsoTime(value: string) {
  return Number.isFinite(Date.parse(value));
}

function isLocalDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function localDateFromIso(value: string) {
  const date = new Date(value);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function isQuestion(value: unknown): value is TeacherAssignmentQuestion {
  if (!value || typeof value !== "object") return false;
  const question = value as Partial<TeacherAssignmentQuestion>;
  return safeText(question.id, 500) && safeText(question.prompt) && safeText(question.answer) && safeText(question.sourceRef, 2_000) && (question.evidenceKind === "official-practice" || question.evidenceKind === "teacher-cited");
}

function isStudentQuestion(value: unknown): value is StudentAssignmentQuestion {
  if (!value || typeof value !== "object") return false;
  const question = value as Partial<StudentAssignmentQuestion>;
  return safeText(question.id, 500) && safeText(question.prompt) && safeText(question.sourceRef, 2_000) && (question.evidenceKind === "official-practice" || question.evidenceKind === "teacher-cited") && !("answer" in value);
}

export function isTeacherAssignmentRecord(value: unknown): value is TeacherAssignmentRecord {
  if (!value || typeof value !== "object") return false;
  const assignment = value as Partial<TeacherAssignmentRecord>;
  if (
    assignment.version !== 1 ||
    !safeText(assignment.id, 1_000) ||
    !normaliseZappyId(assignment.teacherId || "") ||
    !safeText(assignment.title, 2_000) ||
    !safeText(assignment.fromTeacher, 1_000) ||
    !safeText(assignment.workspace, 2_000) ||
    !safeText(assignment.board, 1_000) ||
    !safeText(assignment.grade, 1_000) ||
    !safeText(assignment.subject, 1_000) ||
    !safeText(assignment.chapter, 2_000) ||
    !safeText(assignment.bookId, 2_000) ||
    !safeText(assignment.bookName, 2_000) ||
    !safeText(assignment.sourceEdition, 2_000) ||
    !safeText(assignment.sourceAuthority, 2_000) ||
    !safeText(assignment.dueDate, 100) ||
    !isLocalDate(assignment.dueDate) ||
    !safeText(assignment.createdAt, 100) ||
    !isIsoTime(assignment.createdAt) ||
    assignment.delivery !== "same-browser-local" ||
    !Array.isArray(assignment.recipients) ||
    !assignment.recipients.length ||
    !assignment.recipients.every(recipient => Boolean(normaliseZappyId(recipient))) ||
    !Array.isArray(assignment.questions) ||
    !assignment.questions.length ||
    assignment.questions.length > 50 ||
    !assignment.questions.every(isQuestion)
  ) return false;
  return new Set(assignment.questions.map(question => question.id)).size === assignment.questions.length;
}

export function isStudentAssignmentRecord(value: unknown): value is StudentAssignmentRecord {
  if (!value || typeof value !== "object") return false;
  const assignment = value as Partial<StudentAssignmentRecord>;
  if (
    assignment.version !== 1 ||
    !safeText(assignment.id, 1_000) ||
    !normaliseZappyId(assignment.teacherId || "") ||
    !normaliseZappyId(assignment.recipientId || "") ||
    !safeText(assignment.title, 2_000) ||
    !safeText(assignment.fromTeacher, 1_000) ||
    !safeText(assignment.workspace, 2_000) ||
    !safeText(assignment.board, 1_000) ||
    !safeText(assignment.grade, 1_000) ||
    !safeText(assignment.subject, 1_000) ||
    !safeText(assignment.chapter, 2_000) ||
    !safeText(assignment.bookId, 2_000) ||
    !safeText(assignment.bookName, 2_000) ||
    !safeText(assignment.sourceEdition, 2_000) ||
    !safeText(assignment.sourceAuthority, 2_000) ||
    !safeText(assignment.dueDate, 100) ||
    !isLocalDate(assignment.dueDate) ||
    !safeText(assignment.createdAt, 100) ||
    !isIsoTime(assignment.createdAt) ||
    assignment.delivery !== "same-browser-local" ||
    !Array.isArray(assignment.questions) ||
    !assignment.questions.length ||
    assignment.questions.length > 50 ||
    !assignment.questions.every(isStudentQuestion)
  ) return false;
  return new Set(assignment.questions.map(question => question.id)).size === assignment.questions.length;
}

export function studentAssignmentForRecipient(assignment: TeacherAssignmentRecord, recipientId: string): StudentAssignmentRecord | null {
  if (!isTeacherAssignmentRecord(assignment)) return null;
  const recipient = normaliseZappyId(recipientId);
  if (!recipient || !assignment.recipients.map(normaliseZappyId).includes(recipient)) return null;
  return {
    version: 1,
    id: assignment.id,
    teacherId: normaliseZappyId(assignment.teacherId),
    recipientId: recipient,
    title: assignment.title,
    fromTeacher: assignment.fromTeacher,
    workspace: assignment.workspace,
    board: assignment.board,
    grade: assignment.grade,
    subject: assignment.subject,
    chapter: assignment.chapter,
    bookId: assignment.bookId,
    bookName: assignment.bookName,
    sourceEdition: assignment.sourceEdition,
    sourceAuthority: assignment.sourceAuthority,
    dueDate: assignment.dueDate,
    createdAt: assignment.createdAt,
    questions: assignment.questions.map(question => ({ id: question.id, prompt: question.prompt, sourceRef: question.sourceRef, evidenceKind: question.evidenceKind })),
    delivery: "same-browser-local",
  };
}

function isQuestionProof(value: unknown): value is StudentQuestionProof {
  if (!value || typeof value !== "object") return false;
  const proof = value as Partial<StudentQuestionProof>;
  return safeText(proof.questionId, 500) && safeText(proof.prompt) && safeText(proof.response) && safeText(proof.sourceRef, 2_000) && (proof.evidenceKind === "official-practice" || proof.evidenceKind === "teacher-cited") && CONFIDENCES.has(proof.confidence as LearningConfidence) && !("expectedAnswer" in value);
}

function isLearningReview(value: unknown, proof: Partial<StudentLearningProof>): value is TeacherLearningReview {
  if (!value || typeof value !== "object") return false;
  const review = value as Partial<TeacherLearningReview>;
  if (
    normaliseZappyId(review.teacherId || "") !== normaliseZappyId(proof.teacherId || "") ||
    !safeText(review.reviewedAt, 100) ||
    !isIsoTime(review.reviewedAt) ||
    !safeText(review.summary, 5_000) ||
    !Array.isArray(review.items) ||
    review.items.length !== proof.answers?.length
  ) return false;
  const questionIds = new Set(proof.answers?.map(answer => answer.questionId));
  return review.items.every(item =>
    safeText(item.questionId, 500) &&
    questionIds.has(item.questionId) &&
    (item.outcome === "correct" || item.outcome === "partly" || item.outcome === "retry") &&
    typeof item.feedback === "string" &&
    item.feedback.length <= 5_000,
  ) && new Set(review.items.map(item => item.questionId)).size === review.items.length;
}

export function isStudentLearningProof(value: unknown): value is StudentLearningProof {
  if (!value || typeof value !== "object") return false;
  const proof = value as Partial<StudentLearningProof>;
  if (
    proof.version !== 1 ||
    !safeText(proof.id, 2_000) ||
    !safeText(proof.assignmentId, 1_000) ||
    !normaliseZappyId(proof.teacherId || "") ||
    !normaliseZappyId(proof.studentId || "") ||
    !safeText(proof.teacherName, 1_000) ||
    !safeText(proof.studentName, 1_000) ||
    !safeText(proof.workspace, 2_000) ||
    !safeText(proof.board, 1_000) ||
    !safeText(proof.grade, 1_000) ||
    !safeText(proof.subject, 1_000) ||
    !safeText(proof.chapter, 2_000) ||
    !safeText(proof.bookId, 2_000) ||
    !safeText(proof.bookName, 2_000) ||
    !safeText(proof.sourceEdition, 2_000) ||
    !safeText(proof.sourceAuthority, 2_000) ||
    !safeText(proof.dueDate, 100) ||
    !isLocalDate(proof.dueDate) ||
    typeof proof.late !== "boolean" ||
    !safeText(proof.submittedAt, 100) ||
    !isIsoTime(proof.submittedAt) ||
    !Array.isArray(proof.answers) ||
    !proof.answers.length ||
    proof.answers.length > 50 ||
    !proof.answers.every(isQuestionProof) ||
    proof.delivery !== "same-browser-local" ||
    proof.status !== "completed" ||
    !Number.isInteger(proof.sourceProofCount) ||
    !Number.isInteger(proof.coinsAwarded) ||
    proof.coinsAwarded < 0 ||
    !proof.selfCheck ||
    !(["needs-help", "almost", "got-it"] as LearningConfidence[]).every(confidence => Number.isInteger(proof.selfCheck?.[confidence]) && (proof.selfCheck?.[confidence] || 0) >= 0)
  ) return false;
  const counted = proof.selfCheck["needs-help"] + proof.selfCheck.almost + proof.selfCheck["got-it"];
  return counted === proof.answers.length &&
    proof.sourceProofCount === proof.answers.filter(answer => answer.sourceRef.trim()).length &&
    (proof.review === undefined || isLearningReview(proof.review, proof));
}

function parseList<T>(raw: string | null, guard: (value: unknown) => value is T) {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(guard).slice(0, 100) : [];
  } catch {
    return [];
  }
}

export function parseTeacherAssignments(raw: string | null) {
  return parseList(raw, isTeacherAssignmentRecord);
}

export function parseStudentAssignments(raw: string | null) {
  return parseList(raw, isStudentAssignmentRecord);
}

export function parseStudentLearningProofs(raw: string | null) {
  return parseList(raw, isStudentLearningProof);
}

export function parseStudentAssignmentsFor(raw: string | null, studentId: string) {
  const actor = normaliseZappyId(studentId);
  if (!actor) return [];
  return parseStudentAssignments(raw).filter(assignment => normaliseZappyId(assignment.recipientId) === actor);
}

export function parseStudentLearningProofsFor(raw: string | null, studentId: string) {
  const actor = normaliseZappyId(studentId);
  if (!actor) return [];
  return parseStudentLearningProofs(raw).filter(proof => normaliseZappyId(proof.studentId) === actor);
}

export function proofMatchesTeacherScope(proof: StudentLearningProof, teacherId: string, workspace: string) {
  return normaliseZappyId(proof.teacherId) === normaliseZappyId(teacherId) &&
    normaliseWorkspace(proof.workspace) === normaliseWorkspace(workspace);
}

export function parseTeacherLearningProofsFor(raw: string | null, teacherId: string, workspace: string) {
  if (!normaliseZappyId(teacherId) || !normaliseWorkspace(workspace)) return [];
  return parseStudentLearningProofs(raw).filter(proof => proofMatchesTeacherScope(proof, teacherId, workspace));
}

export function mergeScopedTeacherProofs(primaryRaw: string | null, legacyRaw: string | null, teacherId: string, workspace: string) {
  const legacy = parseTeacherLearningProofsFor(legacyRaw, teacherId, workspace);
  const primary = parseTeacherLearningProofsFor(primaryRaw, teacherId, workspace);
  const byId = new Map(legacy.map(proof => [proof.id, proof]));
  primary.forEach(proof => byId.set(proof.id, proof));
  return [...byId.values()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 100);
}

function isParentDiaryEntry(value: unknown): value is ParentDiaryEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<ParentDiaryEntry>;
  return entry.version === 1 &&
    safeText(entry.id, 2_000) &&
    Boolean(normaliseZappyId(entry.parentId || "")) &&
    Boolean(normaliseZappyId(entry.studentId || "")) &&
    safeText(entry.proofId, 2_000) &&
    safeText(entry.childResponse, 10_000) &&
    safeText(entry.nextAction, 10_000) &&
    safeText(entry.createdAt, 100) && isIsoTime(entry.createdAt) &&
    safeText(entry.updatedAt, 100) && isIsoTime(entry.updatedAt);
}

export function parseParentDiaryEntries(raw: string | null) {
  return parseList(raw, isParentDiaryEntry);
}

export function parseParentDiaryEntriesFor(raw: string | null, parentId: string, studentId: string) {
  const parent = normaliseZappyId(parentId);
  const student = normaliseZappyId(studentId);
  if (!parent || !student) return [];
  return parseParentDiaryEntries(raw).filter(entry => entry.parentId === parent && entry.studentId === student);
}

export function createParentDiaryEntry(input: {
  parentId: string;
  studentId: string;
  proofId: string;
  childResponse: string;
  nextAction: string;
  savedAt: string;
}): ParentDiaryEntry | null {
  const parentId = normaliseZappyId(input.parentId);
  const studentId = normaliseZappyId(input.studentId);
  const proofId = input.proofId.trim();
  const childResponse = input.childResponse.trim();
  const nextAction = input.nextAction.trim();
  if (!parentId || !studentId || !safeText(proofId, 2_000) || !safeText(childResponse, 10_000) || !safeText(nextAction, 10_000) || !isIsoTime(input.savedAt)) return null;
  return {
    version: 1,
    id: boundedRecordId("parent-diary", parentId, studentId, proofId),
    parentId,
    studentId,
    proofId,
    childResponse,
    nextAction,
    createdAt: input.savedAt,
    updatedAt: input.savedAt,
  };
}

export function mergeParentDiaryEntry(entries: ParentDiaryEntry[], entry: ParentDiaryEntry) {
  const sameProof = (item: ParentDiaryEntry) => item.parentId === entry.parentId && item.studentId === entry.studentId && item.proofId === entry.proofId;
  const createdAt = entries.filter(sameProof).reduce((earliest, item) => item.createdAt < earliest ? item.createdAt : earliest, entry.createdAt);
  return [{ ...entry, createdAt }, ...entries.filter(item => !sameProof(item))]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 100);
}

export function parseStudentAssignmentDraft(raw: string | null, assignment: StudentAssignmentRecord, studentId: string): StudentAssignmentDraft | null {
  if (!raw || !isStudentAssignmentRecord(assignment)) return null;
  try {
    const value = JSON.parse(raw) as Partial<StudentAssignmentDraft>;
    const actor = normaliseZappyId(studentId);
    if (
      value.version !== 1 ||
      value.assignmentId !== assignment.id ||
      normaliseZappyId(value.studentId || "") !== actor ||
      !Number.isInteger(value.currentIndex) ||
      (value.currentIndex || 0) < 0 ||
      (value.currentIndex || 0) > assignment.questions.length ||
      !value.responses || typeof value.responses !== "object" || Array.isArray(value.responses) ||
      !value.confidence || typeof value.confidence !== "object" || Array.isArray(value.confidence) ||
      !safeText(value.updatedAt, 100) || !isIsoTime(value.updatedAt)
    ) return null;
    const questionIds = new Set(assignment.questions.map(question => question.id));
    const responses = Object.fromEntries(Object.entries(value.responses).filter(([questionId, response]) => questionIds.has(questionId) && typeof response === "string" && response.length <= 20_000));
    const confidence = Object.fromEntries(Object.entries(value.confidence).filter(([questionId, answerConfidence]) => questionIds.has(questionId) && CONFIDENCES.has(answerConfidence as LearningConfidence))) as Record<string, LearningConfidence>;
    return {
      version: 1,
      assignmentId: assignment.id,
      studentId: actor,
      currentIndex: value.currentIndex || 0,
      responses,
      confidence,
      updatedAt: value.updatedAt,
    };
  } catch {
    return null;
  }
}

export function mergeLearningProof(proofs: StudentLearningProof[], proof: StudentLearningProof) {
  return [proof, ...proofs.filter(item => item.id !== proof.id)]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 100);
}

export function createStudentLearningProof(input: {
  assignment: StudentAssignmentRecord;
  studentId: string;
  studentName: string;
  answers: StudentAnswerDraft[];
  submittedAt: string;
}): CreateLearningProofResult {
  if (!isStudentAssignmentRecord(input.assignment)) return { ok: false, reason: "invalid-assignment" };
  const studentId = normaliseZappyId(input.studentId);
  if (!studentId || normaliseZappyId(input.assignment.recipientId) !== studentId) return { ok: false, reason: "not-recipient" };
  if (!isIsoTime(input.submittedAt)) return { ok: false, reason: "invalid-time" };
  const drafts = new Map(input.answers.map(answer => [answer.questionId, answer]));
  const completed = input.assignment.questions.map(question => {
    const draft = drafts.get(question.id);
    if (!draft?.response.trim() || draft.response.trim().length > 20_000 || !draft.confidence || !CONFIDENCES.has(draft.confidence)) return null;
    return {
      questionId: question.id,
      prompt: question.prompt,
      response: draft.response.trim(),
      sourceRef: question.sourceRef,
      evidenceKind: question.evidenceKind,
      confidence: draft.confidence,
    } satisfies StudentQuestionProof;
  });
  if (completed.some(answer => !answer)) return { ok: false, reason: "incomplete-answers" };
  const answers = completed as StudentQuestionProof[];
  const selfCheck: Record<LearningConfidence, number> = { "needs-help": 0, almost: 0, "got-it": 0 };
  answers.forEach(answer => { selfCheck[answer.confidence] += 1; });
  return {
    ok: true,
    proof: {
      version: 1,
      id: boundedRecordId("learning-proof", input.assignment.id, studentId, input.assignment.workspace),
      assignmentId: input.assignment.id,
      teacherId: normaliseZappyId(input.assignment.teacherId),
      teacherName: input.assignment.fromTeacher,
      studentId,
      studentName: input.studentName.trim().slice(0, 1_000) || studentId,
      workspace: input.assignment.workspace,
      board: input.assignment.board,
      grade: input.assignment.grade,
      subject: input.assignment.subject,
      chapter: input.assignment.chapter,
      bookId: input.assignment.bookId,
      bookName: input.assignment.bookName,
      sourceEdition: input.assignment.sourceEdition,
      sourceAuthority: input.assignment.sourceAuthority,
      dueDate: input.assignment.dueDate,
      late: localDateFromIso(input.submittedAt) > input.assignment.dueDate,
      submittedAt: input.submittedAt,
      answers,
      selfCheck,
      sourceProofCount: answers.filter(answer => answer.sourceRef.trim()).length,
      coinsAwarded: Math.min(30, 10 + answers.length * 2),
      delivery: "same-browser-local",
      status: "completed",
    },
  };
}

export function reviewStudentLearningProof(proof: StudentLearningProof, input: {
  teacherId: string;
  reviewedAt: string;
  items: TeacherQuestionReview[];
  summary: string;
}): ReviewLearningProofResult {
  const teacherId = normaliseZappyId(input.teacherId);
  if (!teacherId || teacherId !== normaliseZappyId(proof.teacherId)) return { ok: false, reason: "wrong-teacher" };
  if (!isIsoTime(input.reviewedAt)) return { ok: false, reason: "invalid-time" };
  const expectedIds = new Set(proof.answers.map(answer => answer.questionId));
  const uniqueIds = new Set(input.items.map(item => item.questionId));
  const complete = input.summary.trim() && input.summary.trim().length <= 5_000 &&
    input.items.length === proof.answers.length &&
    uniqueIds.size === expectedIds.size &&
    input.items.every(item => expectedIds.has(item.questionId) && (item.outcome === "correct" || item.outcome === "partly" || item.outcome === "retry") && item.feedback.length <= 5_000);
  if (!complete) return { ok: false, reason: "incomplete-review" };
  return {
    ok: true,
    proof: {
      ...proof,
      review: {
        teacherId,
        reviewedAt: input.reviewedAt,
        items: input.items.map(item => ({ ...item, feedback: item.feedback.trim() })),
        summary: input.summary.trim(),
      },
    },
  };
}
