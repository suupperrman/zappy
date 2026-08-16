import assert from "node:assert/strict";
import test from "node:test";

import {
  createLocalAssignmentReceipt,
  createTeacherPrepState,
  createTeacherScriptTemplate,
  evaluateExamEvidence,
  getLocalGreeting,
  getNextTeachingDate,
  parseTeacherPrepState,
  selectTeacherModule,
  serializeTeacherPrepState,
  teacherPrepStorageKey,
} from "../app/teacher-prep.ts";

const NOW = "2026-08-01T12:00:00.000Z";

function historyEntry(overrides = {}) {
  return {
    id: "history-1",
    localDate: "2026-07-31",
    recordedAt: "2026-07-31T12:00:00.000Z",
    bookId: "science-8",
    chapter: "Force and Pressure",
    chapterIndex: 7,
    outcome: "taught",
    actualMinutes: 40,
    needsReview: false,
    ...overrides,
  };
}

test("saved prep keys are versioned and isolated by tenant, actor, and class", () => {
  const base = teacherPrepStorageKey("teacher 7", "Delhi Public School", "8 A");

  assert.match(base, /^zappy:teacher-prep:v1:/);
  assert.notEqual(base, teacherPrepStorageKey("teacher 8", "Delhi Public School", "8 A"));
  assert.notEqual(base, teacherPrepStorageKey("teacher 7", "Other School", "8 A"));
  assert.notEqual(base, teacherPrepStorageKey("teacher 7", "Delhi Public School", "8 B"));
  assert.match(base, /Delhi%20Public%20School/);
  assert.throws(() => teacherPrepStorageKey("", "School", "8 A"), /actorId/);
});

test("state defaults are honest, serializable, schema-gated, and scope-gated", () => {
  const state = createTeacherPrepState({
    actorId: "teacher-1",
    tenant: "school-1",
    classScope: "class-8-a",
    chapter: "Force and Pressure",
    sourceResource: { id: "diksha-resource-1", title: "Official textbook PDF" },
    now: NOW,
  });

  assert.equal(state.version, 1);
  assert.deepEqual(state.profile.timetableWeekdays, [1, 2, 3, 4, 5]);
  assert.equal(state.profile.periodMinutes, 40);
  assert.equal(state.profile.periodCount, 1);
  assert.equal(state.profile.durationSource, "teacher");
  assert.deepEqual(state.profile.linkedStudentIds, []);
  assert.equal(state.quizDraft.questions.length, 5);
  assert.ok(state.quizDraft.questions.every((question) => question.prompt === ""));

  const raw = serializeTeacherPrepState(state);
  assert.deepEqual(parseTeacherPrepState(raw), state);
  assert.deepEqual(
    parseTeacherPrepState(raw, {
      actorId: "teacher-1",
      tenant: "school-1",
      classScope: "class-8-a",
    }),
    state,
  );
  assert.equal(
    parseTeacherPrepState(raw, {
      actorId: "teacher-1",
      tenant: "school-1",
      classScope: "class-8-b",
    }),
    null,
  );
  assert.equal(parseTeacherPrepState("{bad json"), null);
  assert.equal(parseTeacherPrepState(JSON.stringify({ ...state, version: 2 })), null);
  assert.equal(
    parseTeacherPrepState(
      JSON.stringify({
        ...state,
        profile: { ...state.profile, timetableWeekdays: [1, 9] },
      }),
    ),
    null,
  );
});

test("local greetings use clear time-of-day boundaries", () => {
  assert.equal(getLocalGreeting(5), "Good morning");
  assert.equal(getLocalGreeting(11), "Good morning");
  assert.equal(getLocalGreeting(12), "Good afternoon");
  assert.equal(getLocalGreeting(16), "Good afternoon");
  assert.equal(getLocalGreeting(17), "Good evening");
  assert.equal(getLocalGreeting(0), "Good evening");
  assert.throws(() => getLocalGreeting(24), /between 0 and 23/);
});

test("next teaching date skips unscheduled days and only uses today when time is future", () => {
  const weekdays = [1, 2, 3, 4, 5];
  const saturday = new Date(2026, 7, 1, 10, 0, 0, 0);
  const mondayBeforeClass = new Date(2026, 7, 3, 8, 0, 0, 0);
  const mondayAfterClass = new Date(2026, 7, 3, 10, 0, 0, 0);

  const afterWeekend = getNextTeachingDate(saturday, weekdays, "09:00");
  assert.equal(afterWeekend?.getDay(), 1);
  assert.equal(afterWeekend?.getDate(), 3);
  assert.equal(afterWeekend?.getHours(), 9);

  assert.equal(
    getNextTeachingDate(mondayBeforeClass, weekdays, "09:00")?.getDate(),
    3,
  );
  assert.equal(
    getNextTeachingDate(mondayAfterClass, weekdays, "09:00")?.getDate(),
    4,
  );
  assert.equal(getNextTeachingDate(saturday, [], "09:00"), null);
  assert.equal(getNextTeachingDate(saturday, weekdays, "25:00"), null);
});

test("module selection prioritizes deferred work, then review, then exact current chapter", () => {
  const history = [
    historyEntry({
      id: "partial-new",
      chapter: "Friction",
      chapterIndex: 8,
      outcome: "partial",
      recordedAt: "2026-07-31T15:00:00.000Z",
    }),
    historyEntry({
      id: "deferred-old",
      chapter: "Force and Pressure",
      outcome: "not-taught",
      recordedAt: "2026-07-30T15:00:00.000Z",
    }),
  ];

  assert.deepEqual(
    selectTeacherModule({
      exactCurrentChapter: "Sound",
      exactCurrentChapterIndex: 9,
      bookId: "science-8",
      history,
    }),
    {
      chapter: "Force and Pressure",
      chapterIndex: 7,
      reason: "deferred-not-taught",
      historyEntryId: "deferred-old",
    },
  );

  const clearedDeferral = [
    ...history,
    historyEntry({
      id: "later-taught",
      chapter: "Force and Pressure",
      outcome: "taught",
      recordedAt: "2026-08-01T09:00:00.000Z",
    }),
  ];
  assert.equal(
    selectTeacherModule({
      exactCurrentChapter: "Sound",
      bookId: "science-8",
      history: clearedDeferral,
    })?.reason,
    "needs-review",
  );
  assert.equal(
    selectTeacherModule({
      exactCurrentChapter: "Sound",
      exactCurrentChapterIndex: 9,
      bookId: "another-book",
      history: clearedDeferral,
    })?.reason,
    "exact-current-chapter",
  );
});

test("the script is a finite six-block, forty-minute editable source scaffold", () => {
  const script = createTeacherScriptTemplate({
    chapter: "Force and Pressure",
    sourceResource: { id: "pdf-1", title: "Official textbook PDF" },
    now: NOW,
  });

  assert.equal(script.blocks.length, 6);
  assert.equal(script.blocks[0].startMinute, 0);
  assert.equal(script.blocks.at(-1).endMinute, 40);
  assert.equal(
    script.blocks.reduce(
      (minutes, block) => minutes + block.endMinute - block.startMinute,
      0,
    ),
    40,
  );
  assert.ok(script.blocks.every((block, index) => index === 0 || block.startMinute === script.blocks[index - 1].endMinute));
  assert.match(script.blocks[2].text, /page or timestamp you have reviewed/i);
  assert.match(script.blocks[2].text, /\[teaching point\]/);
  assert.doesNotMatch(script.blocks.map((block) => block.text).join(" "), /force is|pressure is/i);
});

function paper(year, matched, overrides = {}) {
  return {
    id: `paper-${year}`,
    year: String(year),
    verified: true,
    sourceReference: `Official paper ${year}, page 2`,
    questionKeys: matched ? ["force-definition"] : [],
    ...overrides,
  };
}

test("exam recurrence needs five verified years and probability needs a calibrated model", () => {
  const fourYears = [
    paper(2022, true),
    paper(2023, false),
    paper(2024, true),
    paper(2025, false),
    paper(2025, true, { id: "duplicate-paper-2025" }),
    paper(2021, true, { verified: false }),
  ];
  const locked = evaluateExamEvidence(fourYears, "force-definition");
  assert.equal(locked.frequency.verifiedYearCount, 4);
  assert.equal(locked.frequency.locked, true);
  assert.equal(locked.frequency.observedPercent, null);
  assert.equal(locked.forecast.locked, true);
  assert.equal(locked.forecast.probability, null);

  const fiveYears = [...fourYears, paper(2020, false)];
  const recurrence = evaluateExamEvidence(fiveYears, "force-definition");
  assert.equal(recurrence.frequency.locked, false);
  assert.equal(recurrence.frequency.verifiedYearCount, 5);
  assert.equal(recurrence.frequency.occurrenceYearCount, 3);
  assert.equal(recurrence.frequency.observedPercent, 60);
  assert.equal(recurrence.forecast.locked, true);

  const modelled = evaluateExamEvidence(fiveYears, "force-definition", {
    modelId: "backtest-v1",
    calibrated: true,
    backtested: true,
    probability: 0.72,
  });
  assert.equal(modelled.forecast.locked, false);
  assert.equal(modelled.forecast.probability, 0.72);
});

test("quiz assignment stays local and is gated by citations and linked students", () => {
  const state = createTeacherPrepState({
    actorId: "teacher-1",
    tenant: "school-1",
    classScope: "class-8-a",
    chapter: "Force and Pressure",
    profile: { linkedStudentIds: ["student-1", "student-2"] },
    now: NOW,
  });

  assert.deepEqual(
    createLocalAssignmentReceipt({ profile: state.profile, quiz: state.quizDraft }),
    { ok: false, reason: "no-reviewed-questions" },
  );

  const reviewedQuiz = {
    ...state.quizDraft,
    questions: [
      {
        ...state.quizDraft.questions[0],
        prompt: "Teacher-reviewed source question",
        sourceResourceId: "pdf-1-page-10",
        evidenceStatus: "source-reviewed",
      },
    ],
  };
  const result = createLocalAssignmentReceipt({
    profile: state.profile,
    quiz: reviewedQuiz,
    recipientIds: ["student-2", "not-in-this-class"],
    assignedAt: NOW,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.receipt.recipients, ["student-2"]);
    assert.equal(result.receipt.delivery, "local-only");
    assert.equal(result.receipt.deliveryStatus, "saved-on-this-device");
  }

  const noRoster = createLocalAssignmentReceipt({
    profile: { ...state.profile, linkedStudentIds: [] },
    quiz: reviewedQuiz,
  });
  assert.deepEqual(noRoster, { ok: false, reason: "no-linked-students" });
});
