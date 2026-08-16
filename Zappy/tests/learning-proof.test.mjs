import assert from "node:assert/strict";
import test from "node:test";

import {
  createParentDiaryEntry,
  createStudentLearningProof,
  legacyTeacherLearningProofKey,
  mergeLearningProof,
  mergeParentDiaryEntry,
  mergeScopedTeacherProofs,
  normaliseZappyId,
  parseStudentAssignments,
  parseStudentAssignmentsFor,
  parseStudentAssignmentDraft,
  parseStudentLearningProofs,
  parseStudentLearningProofsFor,
  parseTeacherLearningProofsFor,
  parseTeacherAssignments,
  parseParentDiaryEntries,
  parseParentDiaryEntriesFor,
  parentLearningDiaryKey,
  reviewStudentLearningProof,
  studentAssignmentForRecipient,
  studentAssignmentDraftKey,
  studentAssignmentInboxKey,
  studentLearningProofKey,
  teacherLearningProofKey,
} from "../app/learning-proof.ts";

const assignment = {
  version: 1,
  id: "assignment-1",
  teacherId: "@mssharma_zappy",
  title: "Force and Pressure · source check",
  fromTeacher: "Ms. Sharma",
  workspace: "Delhi Public School",
  board: "Karnataka State Board",
  grade: "Class 8",
  subject: "Science",
  chapter: "Force and Pressure",
  bookId: "dsert-karnataka-class-8-science-2025-26",
  bookName: "Class 8 Science LBA 2025–26",
  sourceEdition: "DSERT 2025–26 · 2026–27 verification pending",
  sourceAuthority: "Department of School Education, Karnataka",
  dueDate: "2026-08-04",
  createdAt: "2026-08-03T09:00:00.000Z",
  recipients: ["@arjun_zappy"],
  questions: [
    { id: "q1", prompt: "What is force?", answer: "A push or pull.", sourceRef: "DSERT PDF p. 21", evidenceKind: "official-practice" },
    { id: "q2", prompt: "Name one effect of force.", answer: "It can change motion.", sourceRef: "DSERT PDF p. 22", evidenceKind: "official-practice" },
  ],
  delivery: "same-browser-local",
};
const studentAssignment = studentAssignmentForRecipient(assignment, "@arjun_zappy");

test("learning-proof keys normalize and isolate teacher and student records", () => {
  assert.equal(normaliseZappyId("  @Arjun_Zappy "), "@arjun_zappy");
  assert.equal(normaliseZappyId("not an id"), "");
  assert.match(studentAssignmentInboxKey("@Arjun_Zappy"), /^zappy:student-inbox:v1:/);
  assert.match(studentLearningProofKey("@Arjun_Zappy"), /^zappy:student-learning-proof:v1:/);
  assert.match(studentAssignmentDraftKey("@Arjun_Zappy", "assignment-1"), /^zappy:student-assignment-draft:v1:/);
  assert.match(legacyTeacherLearningProofKey("@MsSharma_Zappy"), /^zappy:teacher-learning-proof:v1:/);
  assert.match(teacherLearningProofKey("@MsSharma_Zappy", "Delhi Public School"), /^zappy:teacher-learning-proof:v2:/);
  assert.notEqual(teacherLearningProofKey("@MsSharma_Zappy", "Delhi Public School"), teacherLearningProofKey("@MsSharma_Zappy", "Bright Future Academy"));
  assert.match(parentLearningDiaryKey("@priya_zappy", "@arjun_zappy"), /^zappy:parent-learning-diary:v1:/);
  assert.notEqual(studentLearningProofKey("@arjun_zappy"), studentLearningProofKey("@anaya_zappy"));
  assert.throws(() => studentLearningProofKey("bad id"), /valid student/i);
  assert.throws(() => teacherLearningProofKey("@mssharma_zappy", ""), /valid workspace/i);
});

test("parent diary notes are explicit, child-isolated, and update idempotently", () => {
  const first = createParentDiaryEntry({
    parentId: "@priya_zappy",
    studentId: "@arjun_zappy",
    proofId: "proof-1",
    childResponse: "Force can move an object.",
    nextAction: "Ask for one more example tomorrow.",
    savedAt: "2026-08-03T13:00:00.000Z",
  });
  assert.ok(first);
  assert.equal(createParentDiaryEntry({ parentId: "bad", studentId: "@arjun_zappy", proofId: "proof-1", childResponse: "Note", nextAction: "Action", savedAt: "2026-08-03T13:00:00.000Z" }), null);
  const updated = createParentDiaryEntry({
    parentId: "@priya_zappy",
    studentId: "@arjun_zappy",
    proofId: "proof-1",
    childResponse: "Force is a push or pull.",
    nextAction: "Revisit pressure next.",
    savedAt: "2026-08-03T14:00:00.000Z",
  });
  assert.ok(updated);
  const merged = mergeParentDiaryEntry([first], updated);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].createdAt, first.createdAt);
  assert.equal(merged[0].updatedAt, updated.updatedAt);
  const migrated = mergeParentDiaryEntry([{ ...first, id: "parent-diary:legacy-readable-id" }], updated);
  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].createdAt, first.createdAt);
  assert.deepEqual(parseParentDiaryEntries(JSON.stringify([merged[0], { ...merged[0], studentId: "not-an-id" }])), merged);
  const misfiled = { ...merged[0], id: "misfiled", studentId: "@anaya_zappy" };
  assert.deepEqual(parseParentDiaryEntriesFor(JSON.stringify([merged[0], misfiled]), "@priya_zappy", "@arjun_zappy"), merged);
});

test("only complete assigned source-backed work becomes a learning proof", () => {
  assert.ok(studentAssignment);
  assert.ok(studentAssignment.questions.every((question) => !("answer" in question)));
  assert.doesNotMatch(JSON.stringify(studentAssignment), /A push or pull|change motion/);
  const answers = [
    { questionId: "q1", response: "It is a push or pull.", confidence: "got-it" },
    { questionId: "q2", response: "It can make an object move.", confidence: "almost" },
  ];
  assert.deepEqual(
    createStudentLearningProof({ assignment: studentAssignment, studentId: "@someone_else", studentName: "Other", answers, submittedAt: "2026-08-03T10:00:00.000Z" }),
    { ok: false, reason: "not-recipient" },
  );
  assert.deepEqual(
    createStudentLearningProof({ assignment: studentAssignment, studentId: "@arjun_zappy", studentName: "Arjun", answers: answers.slice(0, 1), submittedAt: "2026-08-03T10:00:00.000Z" }),
    { ok: false, reason: "incomplete-answers" },
  );

  const result = createStudentLearningProof({ assignment: studentAssignment, studentId: "@Arjun_Zappy", studentName: "Arjun Sharma", answers, submittedAt: "2026-08-03T10:00:00.000Z" });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.proof.status, "completed");
  assert.equal(result.proof.answers.length, 2);
  assert.equal(result.proof.selfCheck["got-it"], 1);
  assert.equal(result.proof.selfCheck.almost, 1);
  assert.equal(result.proof.selfCheck["needs-help"], 0);
  assert.equal(result.proof.sourceProofCount, 2);
  assert.equal(result.proof.coinsAwarded, 14);
  assert.equal(result.proof.late, false);
  assert.equal(result.proof.delivery, "same-browser-local");

  const late = createStudentLearningProof({ assignment: studentAssignment, studentId: "@arjun_zappy", studentName: "Arjun", answers, submittedAt: "2026-08-05T10:00:00.000Z" });
  assert.equal(late.ok && late.proof.late, true);
  assert.deepEqual(parseTeacherAssignments(JSON.stringify([{ ...assignment, dueDate: "2026-02-31" }])), []);
});

test("an unfinished side quest restores only valid answers for the same learner and assignment", () => {
  assert.ok(studentAssignment);
  const raw = JSON.stringify({
    version: 1,
    assignmentId: studentAssignment.id,
    studentId: "@arjun_zappy",
    currentIndex: 1,
    responses: { q1: "A push or pull", unknown: "discard me" },
    confidence: { q1: "got-it", q2: "invalid" },
    updatedAt: "2026-08-03T10:30:00.000Z",
  });
  const restored = parseStudentAssignmentDraft(raw, studentAssignment, "@arjun_zappy");
  assert.deepEqual(restored?.responses, { q1: "A push or pull" });
  assert.deepEqual(restored?.confidence, { q1: "got-it" });
  assert.equal(parseStudentAssignmentDraft(raw, studentAssignment, "@anaya_zappy"), null);
});

test("saved records are schema-gated, deduplicated, and most-recent first", () => {
  assert.ok(studentAssignment);
  assert.deepEqual(parseTeacherAssignments(JSON.stringify([assignment, { ...assignment, teacherId: "bad" }])), [assignment]);
  assert.deepEqual(parseStudentAssignments(JSON.stringify([studentAssignment, { ...studentAssignment, questions: assignment.questions }])), [studentAssignment]);
  assert.deepEqual(parseTeacherAssignments("{bad json"), []);

  const first = createStudentLearningProof({
    assignment: studentAssignment,
    studentId: "@arjun_zappy",
    studentName: "Arjun",
    answers: [
      { questionId: "q1", response: "First answer", confidence: "needs-help" },
      { questionId: "q2", response: "First answer", confidence: "almost" },
    ],
    submittedAt: "2026-08-03T10:00:00.000Z",
  });
  const second = createStudentLearningProof({
    assignment: studentAssignment,
    studentId: "@arjun_zappy",
    studentName: "Arjun",
    answers: [
      { questionId: "q1", response: "Improved answer", confidence: "got-it" },
      { questionId: "q2", response: "Improved answer", confidence: "got-it" },
    ],
    submittedAt: "2026-08-03T11:00:00.000Z",
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;

  const merged = mergeLearningProof([first.proof], second.proof);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].submittedAt, "2026-08-03T11:00:00.000Z");
  assert.equal(merged[0].answers[0].response, "Improved answer");
  assert.deepEqual(parseStudentLearningProofs(JSON.stringify([...merged, { ...merged[0], status: "pending" }])), merged);
});

test("only the assigned teacher can add a complete human review", () => {
  assert.ok(studentAssignment);
  const submitted = createStudentLearningProof({
    assignment: studentAssignment,
    studentId: "@arjun_zappy",
    studentName: "Arjun",
    answers: [
      { questionId: "q1", response: "Push or pull", confidence: "got-it" },
      { questionId: "q2", response: "Changes motion", confidence: "almost" },
    ],
    submittedAt: "2026-08-03T10:00:00.000Z",
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const items = [
    { questionId: "q1", outcome: "correct", feedback: "Clear." },
    { questionId: "q2", outcome: "partly", feedback: "Add another effect." },
  ];
  assert.deepEqual(
    reviewStudentLearningProof(submitted.proof, { teacherId: "@other_teacher", reviewedAt: "2026-08-03T12:00:00.000Z", items, summary: "Keep practising." }),
    { ok: false, reason: "wrong-teacher" },
  );
  const reviewed = reviewStudentLearningProof(submitted.proof, { teacherId: "@mssharma_zappy", reviewedAt: "2026-08-03T12:00:00.000Z", items, summary: "One strong answer and one idea to extend." });
  assert.equal(reviewed.ok, true);
  if (reviewed.ok) {
    assert.equal(reviewed.proof.review?.items[1].outcome, "partly");
    assert.equal(reviewed.proof.review?.summary, "One strong answer and one idea to extend.");
  }
});

test("misfiled inbox and proof records are filtered to the requested actor and workspace", () => {
  assert.ok(studentAssignment);
  const anayaAssignment = { ...studentAssignment, recipientId: "@anaya_zappy" };
  assert.deepEqual(parseStudentAssignmentsFor(JSON.stringify([studentAssignment, anayaAssignment]), "@arjun_zappy"), [studentAssignment]);

  const submitted = createStudentLearningProof({
    assignment: studentAssignment,
    studentId: "@arjun_zappy",
    studentName: "Arjun",
    answers: [
      { questionId: "q1", response: "Push or pull", confidence: "got-it" },
      { questionId: "q2", response: "Changes motion", confidence: "almost" },
    ],
    submittedAt: "2026-08-03T10:00:00.000Z",
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) return;
  const otherWorkspace = { ...submitted.proof, id: "other-proof", workspace: "Bright Future Academy" };
  assert.deepEqual(parseStudentLearningProofsFor(JSON.stringify([submitted.proof, { ...submitted.proof, studentId: "@anaya_zappy" }]), "@arjun_zappy"), [submitted.proof]);
  assert.deepEqual(parseTeacherLearningProofsFor(JSON.stringify([submitted.proof, otherWorkspace]), "@mssharma_zappy", "Delhi Public School"), [submitted.proof]);
  assert.deepEqual(mergeScopedTeacherProofs(JSON.stringify([submitted.proof]), JSON.stringify([otherWorkspace]), "@mssharma_zappy", "Delhi Public School"), [submitted.proof]);
});

test("creator limits match parser limits so successful records survive reload", () => {
  assert.ok(studentAssignment);
  const tooLong = "x".repeat(20_001);
  const rejected = createStudentLearningProof({
    assignment: studentAssignment,
    studentId: "@arjun_zappy",
    studentName: "Arjun",
    answers: [
      { questionId: "q1", response: tooLong, confidence: "got-it" },
      { questionId: "q2", response: "Changes motion", confidence: "almost" },
    ],
    submittedAt: "2026-08-03T10:00:00.000Z",
  });
  assert.deepEqual(rejected, { ok: false, reason: "incomplete-answers" });
  assert.equal(createParentDiaryEntry({ parentId: "@priya_zappy", studentId: "@arjun_zappy", proofId: "proof", childResponse: "x".repeat(10_001), nextAction: "Revisit", savedAt: "2026-08-03T13:00:00.000Z" }), null);

  const valid = createStudentLearningProof({
    assignment: studentAssignment,
    studentId: "@arjun_zappy",
    studentName: "Arjun",
    answers: [
      { questionId: "q1", response: "Push or pull", confidence: "got-it" },
      { questionId: "q2", response: "Changes motion", confidence: "almost" },
    ],
    submittedAt: "2026-08-03T10:00:00.000Z",
  });
  assert.equal(valid.ok, true);
  if (!valid.ok) return;
  const items = valid.proof.answers.map(answer => ({ questionId: answer.questionId, outcome: "correct", feedback: "" }));
  assert.deepEqual(reviewStudentLearningProof(valid.proof, { teacherId: "@mssharma_zappy", reviewedAt: "2026-08-03T12:00:00.000Z", items, summary: "x".repeat(5_001) }), { ok: false, reason: "incomplete-review" });
  assert.deepEqual(parseStudentLearningProofs(JSON.stringify([valid.proof])), [valid.proof]);

  const longIdAssignment = { ...studentAssignment, id: "🙂".repeat(500) };
  const longIdProof = createStudentLearningProof({
    assignment: longIdAssignment,
    studentId: "@arjun_zappy",
    studentName: "Arjun",
    answers: [
      { questionId: "q1", response: "Push or pull", confidence: "got-it" },
      { questionId: "q2", response: "Changes motion", confidence: "almost" },
    ],
    submittedAt: "2026-08-03T10:00:00.000Z",
  });
  assert.equal(longIdProof.ok, true);
  if (longIdProof.ok) assert.deepEqual(parseStudentLearningProofs(JSON.stringify([longIdProof.proof])), [longIdProof.proof]);

  const longProofDiary = createParentDiaryEntry({
    parentId: "@priya_zappy",
    studentId: "@arjun_zappy",
    proofId: "p".repeat(1_980),
    childResponse: "Force can move things.",
    nextAction: "Revisit pressure.",
    savedAt: "2026-08-03T13:00:00.000Z",
  });
  assert.ok(longProofDiary);
  assert.deepEqual(parseParentDiaryEntries(JSON.stringify([longProofDiary])), [longProofDiary]);
});
