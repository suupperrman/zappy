import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDailyStreak,
  completeDailyLoop,
  createDailyLoopState,
  getDailyRecommendation,
  parseDailyLoopState,
  rollDailyLoop,
} from "../app/daily-loop.ts";

const chapters = ["Chapter one", "Chapter two", "Chapter three"];

function startingState(overrides = {}) {
  return {
    ...createDailyLoopState({
      board: "CBSE",
      grade: "Class 8",
      subject: "Science",
      bookId: "official-book-id",
      bookName: "Official Science Textbook",
      sourceFingerprint: "official-book-id:2026:https://example.test/book",
      chapterIndex: 0,
      sessionMinutes: 15,
      reminderEnabled: false,
      reminderTime: "18:00",
      today: "2026-07-28",
    }),
    ...overrides,
  };
}

test("an unfinished loop stays on the same exact chapter the next day", () => {
  const state = startingState();
  const rolled = rollDailyLoop(state, "2026-07-29", chapters.length);

  assert.equal(rolled.chapterIndex, 0);
  assert.equal(rolled.nextChapterIndex, 0);
  assert.equal(rolled.completedToday, false);
  assert.equal(rolled.dayKey, "2026-07-29");
});

test("needs-help feedback schedules a revisit instead of advancing", () => {
  const completed = completeDailyLoop(startingState(), "needs-help", chapters);
  const recommendation = getDailyRecommendation(completed, chapters);
  const rolled = rollDailyLoop(completed, "2026-07-29", chapters.length);

  assert.equal(completed.nextChapterIndex, 0);
  assert.equal(recommendation.action, "revisit");
  assert.equal(recommendation.nextChapter, "Chapter one");
  assert.equal(rolled.chapterIndex, 0);
});

test("steady and mastered feedback advance exactly one ordered item", () => {
  for (const confidence of ["steady", "mastered"]) {
    const completed = completeDailyLoop(startingState(), confidence, chapters);
    const repeatedClick = completeDailyLoop(completed, confidence, chapters);
    const rolled = rollDailyLoop(completed, "2026-07-29", chapters.length);

    assert.equal(completed.nextChapterIndex, 1);
    assert.strictEqual(repeatedClick, completed, "completion must be idempotent");
    assert.equal(rolled.chapterIndex, 1);
  }
});

test("the final sourced chapter completes without wrapping or inventing a topic", () => {
  const completed = completeDailyLoop(
    startingState({ chapterIndex: 2, nextChapterIndex: 2 }),
    "mastered",
    chapters,
  );
  const recommendation = getDailyRecommendation(completed, chapters);
  const rolled = rollDailyLoop(completed, "2026-07-29", chapters.length);

  assert.equal(completed.nextChapterIndex, 2);
  assert.equal(recommendation.action, "complete");
  assert.equal(recommendation.courseComplete, true);
  assert.equal(rolled.chapterIndex, 2);
});

test("recommendations are deterministic and saved state is schema-gated", () => {
  const state = startingState({ sessionMinutes: 8 });
  assert.deepEqual(
    getDailyRecommendation(state, chapters),
    getDailyRecommendation(state, chapters),
  );
  assert.deepEqual(parseDailyLoopState(JSON.stringify(state)), state);
  assert.equal(parseDailyLoopState("{bad json"), null);
  assert.equal(
    parseDailyLoopState(JSON.stringify({ ...state, version: 99 })),
    null,
  );
  assert.equal(
    parseDailyLoopState(JSON.stringify({ ...state, sessionMinutes: 999 })),
    null,
  );
});

test("the rhythm count allows today or yesterday and never punishes a rest day twice", () => {
  const history = [
    { date: "2026-07-25", chapterIndex: 0, chapter: "A", confidence: "steady" },
    { date: "2026-07-26", chapterIndex: 1, chapter: "B", confidence: "steady" },
    { date: "2026-07-27", chapterIndex: 2, chapter: "C", confidence: "mastered" },
  ];

  assert.equal(calculateDailyStreak(history, "2026-07-27"), 3);
  assert.equal(calculateDailyStreak(history, "2026-07-28"), 3);
  assert.equal(calculateDailyStreak(history, "2026-07-29"), 0);
});
