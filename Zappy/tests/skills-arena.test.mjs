import assert from "node:assert/strict";
import test from "node:test";

import {
  ARENA_RULES,
  buildSkillAttemptId,
  calculateMicroWins,
  calculateSeasonScore,
  createSkillsArenaState,
  getCompetitionAccess,
  getWeakestSignalCoaching,
  isRankableAttempt,
  parseSkillsArenaState,
  rankArenaEntries,
  recordSkillAttempt,
  scoreArenaEntry,
  serializeSkillsArenaState,
  skillsArenaStorageKey,
} from "../app/skills-arena.ts";

const actorId = "@learner";
const tenant = "Class 4-A";
const fullSignals = { script: 72, pace: 74, timing: 76, voice: 78 };
const eligibility = {
  classVerified: true,
  schoolVerified: true,
  introPassed: true,
  safetyPassed: true,
  globalSafetyPassed: true,
  moderationPassed: true,
  isMinor: true,
  guardianConsent: true,
  networkConnected: true,
  cohortSizes: { class: 5, school: 15, zappy: 100 },
};

function addAttempt(state, {
  id,
  score = 72,
  signals = fullSignals,
  weekKey = "2026-W01",
  challengeId = "public-baseline",
  scope = "class",
  roundType = "baseline",
  submitForRanking = false,
  reviewMode = "measured",
} = {}) {
  const attemptId = buildSkillAttemptId({
    actorId,
    tenant,
    skill: "public",
    weekKey,
    challengeId,
    scope,
    clientAttemptKey: id ?? `${weekKey}-${challengeId}-${state.attempts.length}`,
  });
  const result = recordSkillAttempt(state, {
    id: attemptId,
    skill: "public",
    challengeId,
    weekKey,
    scope,
    createdAt: `2026-01-${String(state.attempts.length + 1).padStart(2, "0")}T10:00:00.000Z`,
    overallScore: score,
    signals,
    reviewMode,
    roundType,
    submitForRanking,
  });
  assert.equal(result.ok, true);
  return result;
}

function withThreeBaselines() {
  let state = createSkillsArenaState({ actorId, tenant });
  for (let index = 0; index < 3; index += 1) {
    state = addAttempt(state, { id: `baseline-${index}` }).state;
  }
  return state;
}

test("class competition unlocks only after three valid measured baselines", () => {
  let state = createSkillsArenaState({ actorId, tenant });
  for (let index = 0; index < 2; index += 1) {
    state = addAttempt(state, { id: `baseline-${index}` }).state;
  }
  assert.equal(getCompetitionAccess(state, "public", eligibility).class.unlocked, false);

  state = addAttempt(state, { id: "baseline-2" }).state;
  const access = getCompetitionAccess(state, "public", eligibility);
  assert.equal(access.class.qualifyingBaselineTakes, ARENA_RULES.baselineTakes);
  assert.equal(access.class.unlocked, true);
});

test("competition progresses classmates to school to Zappy without score skipping", () => {
  let state = withThreeBaselines();
  const highSchoolTake = addAttempt(state, {
    id: "premature-school",
    score: 99,
    scope: "school",
    roundType: "competition",
    submitForRanking: true,
    challengeId: "school-week-one",
  });
  state = highSchoolTake.state;
  assert.equal(getCompetitionAccess(state, "public", eligibility).school.unlocked, false);

  for (const [index, score] of [65, 62, 55].entries()) {
    state = addAttempt(state, {
      id: `class-${index}`,
      score,
      weekKey: `2026-W0${index + 2}`,
      challengeId: `class-round-${index}`,
      scope: "class",
      roundType: "competition",
      submitForRanking: true,
    }).state;
  }
  assert.equal(getCompetitionAccess(state, "public", eligibility).school.unlocked, true);

  for (const [index, score] of [75, 72, 60].entries()) {
    state = addAttempt(state, {
      id: `school-${index}`,
      score,
      weekKey: `2026-W0${index + 5}`,
      challengeId: `school-round-${index}`,
      scope: "school",
      roundType: "competition",
      submitForRanking: true,
    }).state;
  }
  assert.equal(getCompetitionAccess(state, "public", eligibility).zappy.unlocked, true);

  const lowerLaterTake = addAttempt(state, {
    id: "class-lower-later",
    score: 30,
    weekKey: "2026-W08",
    challengeId: "class-round-later",
    scope: "class",
    roundType: "competition",
    submitForRanking: true,
  });
  assert.equal(
    getCompetitionAccess(lowerLaterTake.state, "public", eligibility).school.unlocked,
    true,
  );
});

test("Zappy remains network and consent locked for a local minor", () => {
  let state = withThreeBaselines();
  for (const [scope, offset, scores] of [
    ["class", 2, [65, 64, 63]],
    ["school", 5, [75, 74, 73]],
  ]) {
    for (const [index, score] of scores.entries()) {
      state = addAttempt(state, {
        id: `${scope}-${index}`,
        score,
        weekKey: `2026-W0${offset + index}`,
        challengeId: `${scope}-round-${index}`,
        scope,
        roundType: "competition",
        submitForRanking: true,
      }).state;
    }
  }
  const local = getCompetitionAccess(state, "public", {
    ...eligibility,
    guardianConsent: false,
    networkConnected: false,
  }).zappy;
  assert.equal(local.unlocked, false);
  assert.ok(local.lockReasons.includes("consent"));
  assert.ok(local.lockReasons.includes("network"));
});

test("ranking requires three measured signals and never uses self-review", () => {
  assert.equal(
    isRankableAttempt({
      overallScore: 70,
      signals: { script: 70, pace: 70, timing: null, voice: null },
      reviewMode: "measured",
    }),
    false,
  );
  assert.equal(
    isRankableAttempt({
      overallScore: 70,
      signals: fullSignals,
      reviewMode: "self-review",
    }),
    false,
  );
  assert.equal(
    isRankableAttempt({
      overallScore: 75,
      signals: fullSignals,
      reviewMode: "measured",
    }),
    true,
  );
});

test("scoring, coaching, season totals, and shared ranks are deterministic", () => {
  assert.deepEqual(
    scoreArenaEntry({ script: 80, pace: 80, timing: 80, voice: 80 }, 70),
    {
      eligible: true,
      mastery: 80,
      growthScore: 83,
      balance: 80,
      points: 81,
    },
  );
  assert.equal(calculateSeasonScore([10, 20, 30, 40, 50, 60]), 180);
  assert.deepEqual(
    rankArenaEntries([
      { id: "b", points: 90 },
      { id: "a", points: 90 },
      { id: "c", points: 85 },
    ]).map(({ id, rank }) => ({ id, rank })),
    [
      { id: "a", rank: 1 },
      { id: "b", rank: 1 },
      { id: "c", rank: 3 },
    ],
  );
  assert.equal(
    getWeakestSignalCoaching("public", {
      script: 60,
      pace: 60,
      timing: 75,
      voice: null,
    }).signal,
    "script",
  );
});

test("attempt IDs are idempotent, ranked takes are capped, and micro-wins are finite", () => {
  let state = withThreeBaselines();
  const input = {
    id: "ranked",
    weekKey: "2026-W09",
    challengeId: "weekly-class",
    scope: "class",
    roundType: "competition",
    submitForRanking: true,
  };
  const first = addAttempt(state, input);
  const duplicate = recordSkillAttempt(first.state, {
    ...first.attempt,
    submitForRanking: true,
  });
  assert.equal(duplicate.reason, "duplicate");
  assert.strictEqual(duplicate.state, first.state);
  state = first.state;

  for (let index = 1; index < 4; index += 1) {
    const result = addAttempt(state, { ...input, id: `ranked-${index}` });
    state = result.state;
    if (index === 3) assert.equal(result.reason, "limit-reached");
  }
  assert.ok(calculateMicroWins(state, "public") <= 100);
});

test("saved arena state is isolated and contains no recording or transcript data", () => {
  const state = withThreeBaselines();
  const raw = serializeSkillsArenaState(state);
  assert.deepEqual(parseSkillsArenaState(raw, { actorId, tenant }), state);
  assert.equal(
    parseSkillsArenaState(raw, { actorId: "@different", tenant }),
    null,
  );
  assert.notEqual(
    skillsArenaStorageKey(actorId, tenant),
    skillsArenaStorageKey(actorId, "Class 5-B"),
  );
  assert.doesNotMatch(raw, /blob:|transcript|recordingUrl|camera|email/i);
  assert.equal(parseSkillsArenaState("{broken"), null);
});
