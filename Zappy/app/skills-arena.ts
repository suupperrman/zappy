export const SKILLS_ARENA_STORAGE_VERSION = 1 as const;
export const SKILLS_ARENA_STORAGE_PREFIX = "zappy:skills-arena:v1";
export const MAX_TAKES_PER_ROUND = 3 as const;
export const MAX_RANKED_SUBMISSIONS_PER_CHALLENGE =
  MAX_TAKES_PER_ROUND;
export const ARENA_SEASON_ROUNDS = 6 as const;
export const COUNTED_SEASON_ROUNDS = 4 as const;
export const MICRO_WINS_FOR_100X = 100 as const;
export const MINIMUM_COHORT_SIZE: Record<CompetitionScope, number> = {
  class: 5,
  school: 15,
  zappy: 100,
};
export const ARENA_RULES = {
  baselineTakes: 3,
  sessionMinutes: 10,
  maxTakesPerRound: MAX_TAKES_PER_ROUND,
  seasonRounds: ARENA_SEASON_ROUNDS,
  countedRounds: COUNTED_SEASON_ROUNDS,
  microWins: MICRO_WINS_FOR_100X,
  minimumCohortSize: MINIMUM_COHORT_SIZE,
  schoolUnlock: {
    completedClassRounds: 3,
    qualifyingClassRounds: 2,
    minimumMastery: 60,
  },
  zappyUnlock: {
    completedSchoolRounds: 3,
    qualifyingSchoolRounds: 2,
    minimumMastery: 70,
  },
} as const;

export const ARENA_SKILLS = [
  "public",
  "vlog",
  "leadership",
  "social",
  "mindfulness",
] as const;
export type ArenaSkill = (typeof ARENA_SKILLS)[number];

export const ARENA_SKILL_LABELS: Record<ArenaSkill, string> = {
  public: "Public speaking",
  vlog: "Vlogging",
  leadership: "Leadership",
  social: "Social confidence",
  mindfulness: "Mindfulness",
};

export const COMPETITION_SCOPE_ORDER = [
  "class",
  "school",
  "zappy",
] as const;
export type CompetitionScope = (typeof COMPETITION_SCOPE_ORDER)[number];

export const MEASURED_SIGNAL_ORDER = [
  "script",
  "pace",
  "timing",
  "voice",
] as const;
export type MeasuredSignal = (typeof MEASURED_SIGNAL_ORDER)[number];
export type MeasuredSignals = Record<MeasuredSignal, number | null>;

export type ReviewMode = "measured" | "self-review";
export type ArenaRoundType = "baseline" | "competition";
export type AttemptRankingStatus =
  | "ranked"
  | "practice"
  | "self-review"
  | "insufficient-evidence"
  | "limit-reached";

export type SkillAttempt = {
  id: string;
  skill: ArenaSkill;
  challengeId: string;
  weekKey: string;
  scope: CompetitionScope;
  createdAt: string;
  overallScore: number | null;
  signals: MeasuredSignals;
  reviewMode: ReviewMode;
  roundType: ArenaRoundType;
  rankingStatus: AttemptRankingStatus;
};

export type SkillsArenaState = {
  version: typeof SKILLS_ARENA_STORAGE_VERSION;
  actorId: string;
  tenant: string;
  attempts: SkillAttempt[];
};

export type SkillAttemptInput = Omit<SkillAttempt, "rankingStatus"> & {
  submitForRanking: boolean;
};

export type RecordAttemptReason =
  | AttemptRankingStatus
  | "duplicate"
  | "invalid-attempt";

export type RecordAttemptResult =
  | {
      ok: true;
      created: boolean;
      reason: Exclude<RecordAttemptReason, "invalid-attempt">;
      state: SkillsArenaState;
      attempt: SkillAttempt;
    }
  | {
      ok: false;
      created: false;
      reason: "invalid-attempt";
      state: SkillsArenaState;
      attempt: null;
    };

export type CompetitionLockReason =
  | "class-verification"
  | "school-verification"
  | "intro"
  | "baseline"
  | "progress"
  | "mastery"
  | "safety"
  | "global-safety"
  | "moderation"
  | "network"
  | "consent"
  | "cohort";

export type CompetitionScopeAccess = {
  scope: CompetitionScope;
  ready: boolean;
  unlocked: boolean;
  evidenceScope: CompetitionScope | null;
  qualifyingBaselineTakes: number;
  qualifyingRounds: number;
  masteryRounds: number;
  bestScore: number | null;
  cohortSize: number;
  minimumCohortSize: number;
  requiredBaselineTakes: number;
  requiredRounds: number;
  requiredMasteryRounds: number;
  requiredBestScore: number | null;
  lockReasons: CompetitionLockReason[];
};

export type CompetitionAccess = Record<
  CompetitionScope,
  CompetitionScopeAccess
>;

export type CompetitionEligibilityFlags = {
  classVerified: boolean;
  schoolVerified: boolean;
  introPassed: boolean;
  safetyPassed: boolean;
  globalSafetyPassed: boolean;
  moderationPassed: boolean;
  isMinor: boolean;
  guardianConsent: boolean;
  networkConnected: boolean;
  cohortSizes: Record<CompetitionScope, number>;
};

export const DEFAULT_COMPETITION_ELIGIBILITY: CompetitionEligibilityFlags = {
  classVerified: false,
  schoolVerified: false,
  introPassed: false,
  safetyPassed: false,
  globalSafetyPassed: false,
  moderationPassed: false,
  isMinor: true,
  guardianConsent: false,
  networkConnected: false,
  cohortSizes: { class: 0, school: 0, zappy: 0 },
};

export type ArenaCoachingDrill = {
  skill: ArenaSkill;
  signal: MeasuredSignal | null;
  title: string;
  reason: string;
  target: string;
  minutes: number;
  steps: readonly string[];
};

const signalSet = new Set<string>(MEASURED_SIGNAL_ORDER);
const skillSet = new Set<string>(ARENA_SKILLS);
const scopeSet = new Set<string>(COMPETITION_SCOPE_ORDER);
const reviewModeSet = new Set<string>(["measured", "self-review"]);
const roundTypeSet = new Set<string>(["baseline", "competition"]);
const rankingStatusSet = new Set<string>([
  "ranked",
  "practice",
  "self-review",
  "insufficient-evidence",
  "limit-reached",
]);

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

function isNullableScore(value: unknown): value is number | null {
  return value === null || isScore(value);
}

function isMeasuredSignals(value: unknown): value is MeasuredSignals {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  return (
    keys.length === MEASURED_SIGNAL_ORDER.length &&
    keys.every((key) => signalSet.has(key)) &&
    MEASURED_SIGNAL_ORDER.every((signal) =>
      isNullableScore(record[signal]),
    )
  );
}

function isWeekKey(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/.test(value)
  );
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    Number.isFinite(Date.parse(value))
  );
}

export function countMeasuredSignals(signals: MeasuredSignals) {
  return MEASURED_SIGNAL_ORDER.reduce(
    (total, signal) => total + (isScore(signals[signal]) ? 1 : 0),
    0,
  );
}

export function isRankableAttempt(
  attempt: Pick<
    SkillAttempt,
    "overallScore" | "signals" | "reviewMode"
  >,
) {
  return (
    attempt.reviewMode === "measured" &&
    isScore(attempt.overallScore) &&
    isMeasuredSignals(attempt.signals) &&
    countMeasuredSignals(attempt.signals) >= 3
  );
}

function rankingBucket(
  attempt: Pick<
    SkillAttempt,
    "skill" | "weekKey" | "challengeId" | "scope"
  >,
) {
  return `${attempt.skill}\u001f${attempt.weekKey}\u001f${attempt.challengeId}\u001f${attempt.scope}`;
}

function isSkillAttempt(value: unknown): value is SkillAttempt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const attempt = value as Partial<SkillAttempt>;
  if (
    !isNonEmptyString(attempt.id) ||
    !skillSet.has(attempt.skill ?? "") ||
    !isNonEmptyString(attempt.challengeId) ||
    !isWeekKey(attempt.weekKey) ||
    !scopeSet.has(attempt.scope ?? "") ||
    !isTimestamp(attempt.createdAt) ||
    !isNullableScore(attempt.overallScore) ||
    !isMeasuredSignals(attempt.signals) ||
    !reviewModeSet.has(attempt.reviewMode ?? "") ||
    !roundTypeSet.has(attempt.roundType ?? "") ||
    !rankingStatusSet.has(attempt.rankingStatus ?? "")
  ) {
    return false;
  }

  const rankable = isRankableAttempt(attempt as SkillAttempt);
  if (attempt.rankingStatus === "ranked" && !rankable) return false;
  if (
    attempt.rankingStatus === "self-review" &&
    attempt.reviewMode !== "self-review"
  ) {
    return false;
  }
  if (
    attempt.rankingStatus === "insufficient-evidence" &&
    (attempt.reviewMode !== "measured" || rankable)
  ) {
    return false;
  }
  if (
    attempt.rankingStatus === "limit-reached" &&
    (attempt.reviewMode !== "measured" || !rankable)
  ) {
    return false;
  }
  return true;
}

function hasValidRankedSubmissionLimits(attempts: SkillAttempt[]) {
  const counts = new Map<string, number>();
  for (const attempt of attempts) {
    if (attempt.rankingStatus !== "ranked") continue;
    const bucket = rankingBucket(attempt);
    const nextCount = (counts.get(bucket) ?? 0) + 1;
    if (nextCount > MAX_RANKED_SUBMISSIONS_PER_CHALLENGE) return false;
    counts.set(bucket, nextCount);
  }
  return true;
}

export function skillsArenaStorageKey(actorId: string, tenant: string) {
  return `${SKILLS_ARENA_STORAGE_PREFIX}:${encodeURIComponent(
    actorId,
  )}:${encodeURIComponent(tenant)}`;
}

export function createSkillsArenaState(input: {
  actorId: string;
  tenant: string;
}): SkillsArenaState {
  if (!isNonEmptyString(input.actorId) || !isNonEmptyString(input.tenant)) {
    throw new Error("Skills Arena requires a non-empty actor and tenant.");
  }
  return {
    version: SKILLS_ARENA_STORAGE_VERSION,
    actorId: input.actorId,
    tenant: input.tenant,
    attempts: [],
  };
}

export function parseSkillsArenaState(
  raw: string | null,
  expected?: { actorId: string; tenant: string },
): SkillsArenaState | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SkillsArenaState>;
    if (
      value.version !== SKILLS_ARENA_STORAGE_VERSION ||
      !isNonEmptyString(value.actorId) ||
      !isNonEmptyString(value.tenant) ||
      !Array.isArray(value.attempts) ||
      !value.attempts.every(isSkillAttempt)
    ) {
      return null;
    }
    if (
      expected &&
      (value.actorId !== expected.actorId || value.tenant !== expected.tenant)
    ) {
      return null;
    }
    const ids = new Set(value.attempts.map((attempt) => attempt.id));
    if (
      ids.size !== value.attempts.length ||
      !hasValidRankedSubmissionLimits(value.attempts)
    ) {
      return null;
    }
    return value as SkillsArenaState;
  } catch {
    return null;
  }
}

export function serializeSkillsArenaState(state: SkillsArenaState) {
  return JSON.stringify(state);
}

/**
 * Builds a retry-safe ID from values the caller already owns. Reusing the same
 * clientAttemptKey produces the same ID; the engine never uses randomness.
 */
export function buildSkillAttemptId(input: {
  actorId: string;
  tenant: string;
  skill: ArenaSkill;
  weekKey: string;
  challengeId: string;
  scope: CompetitionScope;
  clientAttemptKey: string;
}) {
  const parts = [
    input.actorId,
    input.tenant,
    input.skill,
    input.weekKey,
    input.challengeId,
    input.scope,
    input.clientAttemptKey,
  ];
  if (parts.some((part) => !isNonEmptyString(part))) {
    throw new Error("Attempt ID parts must be non-empty.");
  }
  return `zappy-arena-attempt:v1:${parts
    .map((part) => encodeURIComponent(part))
    .join(":")}`;
}

function isSkillAttemptInput(value: unknown): value is SkillAttemptInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Partial<SkillAttemptInput>;
  return (
    isNonEmptyString(input.id) &&
    skillSet.has(input.skill ?? "") &&
    isNonEmptyString(input.challengeId) &&
    isWeekKey(input.weekKey) &&
    scopeSet.has(input.scope ?? "") &&
    isTimestamp(input.createdAt) &&
    isNullableScore(input.overallScore) &&
    isMeasuredSignals(input.signals) &&
    reviewModeSet.has(input.reviewMode ?? "") &&
    roundTypeSet.has(input.roundType ?? "") &&
    typeof input.submitForRanking === "boolean"
  );
}

export function rankedSubmissionCount(
  attempts: SkillAttempt[],
  input: {
    skill: ArenaSkill;
    weekKey: string;
    challengeId: string;
    scope: CompetitionScope;
  },
) {
  const bucket = rankingBucket(input);
  return attempts.filter(
    (attempt) =>
      attempt.rankingStatus === "ranked" &&
      rankingBucket(attempt) === bucket,
  ).length;
}

export function recordSkillAttempt(
  state: SkillsArenaState,
  input: SkillAttemptInput,
): RecordAttemptResult {
  const existing = state.attempts.find((attempt) => attempt.id === input.id);
  if (existing) {
    return {
      ok: true,
      created: false,
      reason: "duplicate",
      state,
      attempt: existing,
    };
  }
  if (!isSkillAttemptInput(input)) {
    return {
      ok: false,
      created: false,
      reason: "invalid-attempt",
      state,
      attempt: null,
    };
  }

  const eligible = isRankableAttempt(input);
  let rankingStatus: AttemptRankingStatus = "practice";
  if (input.roundType === "baseline") {
    rankingStatus =
      input.reviewMode === "self-review" ? "self-review" : "practice";
  } else if (input.submitForRanking) {
    if (input.reviewMode === "self-review") {
      rankingStatus = "self-review";
    } else if (!eligible) {
      rankingStatus = "insufficient-evidence";
    } else if (
      rankedSubmissionCount(state.attempts, input) >=
      MAX_RANKED_SUBMISSIONS_PER_CHALLENGE
    ) {
      rankingStatus = "limit-reached";
    } else {
      rankingStatus = "ranked";
    }
  } else if (input.reviewMode === "self-review") {
    rankingStatus = "self-review";
  }

  const { submitForRanking: _submitForRanking, ...attemptFields } = input;
  void _submitForRanking;
  const attempt: SkillAttempt = { ...attemptFields, rankingStatus };
  const nextState: SkillsArenaState = {
    ...state,
    attempts: [...state.attempts, attempt],
  };
  return {
    ok: true,
    created: true,
    reason: rankingStatus,
    state: nextState,
    attempt,
  };
}

function rankedAttemptsFor(
  state: SkillsArenaState,
  skill: ArenaSkill,
  scope: CompetitionScope,
) {
  return state.attempts.filter(
    (attempt) =>
      attempt.skill === skill &&
      attempt.scope === scope &&
      attempt.rankingStatus === "ranked" &&
      isRankableAttempt(attempt),
  );
}

function qualifyingRoundSummary(
  state: SkillsArenaState,
  skill: ArenaSkill,
  scope: CompetitionScope,
  minimumMastery: number,
) {
  const attempts = rankedAttemptsFor(state, skill, scope);
  const roundBest = new Map<string, number>();
  for (const attempt of attempts) {
    if (!isScore(attempt.overallScore)) continue;
    const key = `${attempt.weekKey}\u001f${attempt.challengeId}`;
    roundBest.set(
      key,
      Math.max(roundBest.get(key) ?? 0, attempt.overallScore),
    );
  }
  const scores = [...roundBest.values()];
  return {
    rounds: roundBest.size,
    masteryRounds: scores.filter((score) => score >= minimumMastery).length,
    bestScore: scores.length ? Math.max(...scores) : null,
  };
}

export function getCompetitionAccess(
  state: SkillsArenaState,
  skill: ArenaSkill,
  flags: CompetitionEligibilityFlags =
    DEFAULT_COMPETITION_ELIGIBILITY,
): CompetitionAccess {
  const baselineTakes = state.attempts.filter(
    (attempt) =>
      attempt.skill === skill &&
      attempt.roundType === "baseline" &&
      isRankableAttempt(attempt),
  ).length;
  const classLocks: CompetitionLockReason[] = [];
  if (!flags.classVerified) classLocks.push("class-verification");
  if (!flags.introPassed) classLocks.push("intro");
  if (baselineTakes < ARENA_RULES.baselineTakes) {
    classLocks.push("baseline");
  }
  const classReady = classLocks.length === 0;

  const classEvidence = qualifyingRoundSummary(
    state,
    skill,
    "class",
    ARENA_RULES.schoolUnlock.minimumMastery,
  );
  const schoolLocks: CompetitionLockReason[] = [];
  if (!classReady) schoolLocks.push("progress");
  if (!flags.schoolVerified) {
    schoolLocks.push("school-verification");
  }
  if (!flags.safetyPassed) schoolLocks.push("safety");
  if (
    classEvidence.rounds <
    ARENA_RULES.schoolUnlock.completedClassRounds
  ) {
    schoolLocks.push("progress");
  }
  if (
    classEvidence.masteryRounds <
    ARENA_RULES.schoolUnlock.qualifyingClassRounds
  ) {
    schoolLocks.push("mastery");
  }
  const schoolReady = schoolLocks.length === 0;

  const schoolEvidence = qualifyingRoundSummary(
    state,
    skill,
    "school",
    ARENA_RULES.zappyUnlock.minimumMastery,
  );
  const zappyLocks: CompetitionLockReason[] = [];
  if (!schoolReady) zappyLocks.push("progress");
  if (!flags.globalSafetyPassed) {
    zappyLocks.push("global-safety");
  }
  if (!flags.moderationPassed) zappyLocks.push("moderation");
  if (
    schoolEvidence.rounds <
    ARENA_RULES.zappyUnlock.completedSchoolRounds
  ) {
    zappyLocks.push("progress");
  }
  if (
    schoolEvidence.masteryRounds <
    ARENA_RULES.zappyUnlock.qualifyingSchoolRounds
  ) {
    zappyLocks.push("mastery");
  }
  if (flags.isMinor && !flags.guardianConsent) {
    zappyLocks.push("consent");
  }
  const zappyReady = zappyLocks.length === 0;
  if (!flags.networkConnected) zappyLocks.push("network");

  return {
    class: {
      scope: "class",
      ready: classReady,
      unlocked: classReady,
      evidenceScope: null,
      qualifyingBaselineTakes: baselineTakes,
      qualifyingRounds: 0,
      masteryRounds: 0,
      bestScore: null,
      cohortSize: flags.cohortSizes.class,
      minimumCohortSize: MINIMUM_COHORT_SIZE.class,
      requiredBaselineTakes: ARENA_RULES.baselineTakes,
      requiredRounds: 0,
      requiredMasteryRounds: 0,
      requiredBestScore: null,
      lockReasons: classLocks,
    },
    school: {
      scope: "school",
      ready: schoolReady,
      unlocked: schoolReady,
      evidenceScope: "class",
      qualifyingBaselineTakes: baselineTakes,
      qualifyingRounds: classEvidence.rounds,
      masteryRounds: classEvidence.masteryRounds,
      bestScore: classEvidence.bestScore,
      cohortSize: flags.cohortSizes.school,
      minimumCohortSize: MINIMUM_COHORT_SIZE.school,
      requiredBaselineTakes: ARENA_RULES.baselineTakes,
      requiredRounds:
        ARENA_RULES.schoolUnlock.completedClassRounds,
      requiredMasteryRounds:
        ARENA_RULES.schoolUnlock.qualifyingClassRounds,
      requiredBestScore:
        ARENA_RULES.schoolUnlock.minimumMastery,
      lockReasons: [...new Set(schoolLocks)],
    },
    zappy: {
      scope: "zappy",
      ready: zappyReady,
      unlocked: zappyReady && flags.networkConnected,
      evidenceScope: "school",
      qualifyingBaselineTakes: baselineTakes,
      qualifyingRounds: schoolEvidence.rounds,
      masteryRounds: schoolEvidence.masteryRounds,
      bestScore: schoolEvidence.bestScore,
      cohortSize: flags.cohortSizes.zappy,
      minimumCohortSize: MINIMUM_COHORT_SIZE.zappy,
      requiredBaselineTakes: ARENA_RULES.baselineTakes,
      requiredRounds:
        ARENA_RULES.zappyUnlock.completedSchoolRounds,
      requiredMasteryRounds:
        ARENA_RULES.zappyUnlock.qualifyingSchoolRounds,
      requiredBestScore:
        ARENA_RULES.zappyUnlock.minimumMastery,
      lockReasons: [...new Set(zappyLocks)],
    },
  };
}

const coachingDrills: Record<
  ArenaSkill,
  Record<MeasuredSignal, Omit<ArenaCoachingDrill, "skill" | "signal">>
> = {
  public: {
    script: {
      title: "One-message speech",
      reason: "A clear message makes every delivery skill easier to improve.",
      target: "State one idea, support it twice, and end with one memorable line.",
      minutes: 8,
      steps: [
        "Write your main message in one sentence.",
        "Add one fact and one short example.",
        "Deliver it without adding a second message.",
      ],
    },
    pace: {
      title: "Pause-and-land drill",
      reason: "A controlled pace gives listeners time to understand key ideas.",
      target: "Use one clean pause after each important sentence.",
      minutes: 6,
      steps: [
        "Mark three pause points in a 45-second speech.",
        "Breathe silently for one beat at each mark.",
        "Repeat once while keeping every word clear.",
      ],
    },
    timing: {
      title: "Sixty-second finish",
      reason: "Finishing on time builds structure and confidence.",
      target: "Complete a beginning, middle, and ending in 55–60 seconds.",
      minutes: 7,
      steps: [
        "Reserve 10 seconds for the opening.",
        "Use 35 seconds for the main idea.",
        "Finish with a 10-second takeaway and review the measured time.",
      ],
    },
    voice: {
      title: "Meaningful emphasis",
      reason: "Vocal contrast helps the audience remember the right words.",
      target: "Emphasize only three words and keep the rest natural.",
      minutes: 6,
      steps: [
        "Underline three words that carry the message.",
        "Say each with slightly stronger energy, not extra volume.",
        "Record one measured take and listen for clear contrast.",
      ],
    },
  },
  vlog: {
    script: {
      title: "Hook–value–close",
      reason: "A useful vlog needs a promise, a payoff, and a clear finish.",
      target: "Deliver one hook, three useful points, and one closing action.",
      minutes: 10,
      steps: [
        "Write a one-line promise for the viewer.",
        "List exactly three supporting points.",
        "Close by restating what the viewer can now do.",
      ],
    },
    pace: {
      title: "Conversational camera pace",
      reason: "Natural phrasing is easier to follow than rushed delivery.",
      target: "Speak in short thought groups with a breath between them.",
      minutes: 7,
      steps: [
        "Split a 45-second script into short thought groups.",
        "Look into the lens and speak one group per breath.",
        "Repeat only the fastest section at a calmer pace.",
      ],
    },
    timing: {
      title: "Ninety-second story",
      reason: "A time box keeps a vlog focused on viewer value.",
      target: "Reach the payoff before 70 seconds and finish by 90 seconds.",
      minutes: 9,
      steps: [
        "Plan 15 seconds for the hook.",
        "Deliver the useful example by 70 seconds.",
        "Use the final 20 seconds for the takeaway and close.",
      ],
    },
    voice: {
      title: "Lens-energy ladder",
      reason: "Warm, varied energy makes a camera delivery feel personal.",
      target: "Use calm, bright, and confident energy without shouting.",
      minutes: 7,
      steps: [
        "Say the opening calmly.",
        "Lift energy slightly for the most useful point.",
        "End confidently, then compare the measured voice signal.",
      ],
    },
  },
  leadership: {
    script: {
      title: "Context–decision–owner",
      reason: "Teams act faster when the message explains what, why, and who.",
      target: "State the situation, decision, owner, and next check-in.",
      minutes: 8,
      steps: [
        "Describe the situation in one neutral sentence.",
        "Name the decision and its reason.",
        "Assign one owner and one clear check-in time.",
      ],
    },
    pace: {
      title: "Lead, then leave space",
      reason: "A leader needs enough pace control for others to contribute.",
      target: "Pause after the decision and after asking for input.",
      minutes: 6,
      steps: [
        "Deliver a 30-second team update.",
        "Pause for two beats after the main decision.",
        "Ask one open question and leave another two-beat pause.",
      ],
    },
    timing: {
      title: "Two-minute team brief",
      reason: "A concise brief protects the team’s time and attention.",
      target: "Give context, action, and check-in within two minutes.",
      minutes: 8,
      steps: [
        "Use 30 seconds for context.",
        "Use 60 seconds for actions and owners.",
        "Use 30 seconds for risks, questions, and the next check-in.",
      ],
    },
    voice: {
      title: "Calm authority",
      reason: "A steady voice makes direction clear without sounding harsh.",
      target: "Keep volume steady and lower tension on the final words.",
      minutes: 6,
      steps: [
        "Take one slow breath before speaking.",
        "Deliver the decision at an even volume.",
        "Repeat with a relaxed ending and compare the measured signal.",
      ],
    },
  },
  social: {
    script: {
      title: "Open–ask–reflect",
      reason: "A simple conversation structure reduces uncertainty.",
      target: "Open warmly, ask one real question, and reflect one detail back.",
      minutes: 7,
      steps: [
        "Prepare one context-based opening.",
        "Ask a question that cannot be answered with only yes or no.",
        "Respond by reflecting one detail you heard.",
      ],
    },
    pace: {
      title: "Balanced turns",
      reason: "Good conversations make room for both people.",
      target: "Keep each turn brief and wait for the full reply.",
      minutes: 6,
      steps: [
        "Answer a prompt in two sentences.",
        "Pause instead of filling the silence.",
        "Ask one follow-up based on the other person’s reply.",
      ],
    },
    timing: {
      title: "Two-minute connection",
      reason: "A small time box makes social practice approachable.",
      target: "Open, exchange two ideas, and close naturally in two minutes.",
      minutes: 7,
      steps: [
        "Use 20 seconds for a warm opening.",
        "Exchange two questions or observations.",
        "Close with a genuine thank-you or future connection point.",
      ],
    },
    voice: {
      title: "Warm and audible",
      reason: "Clear warmth helps others feel comfortable joining in.",
      target: "Use an audible volume, relaxed tone, and friendly ending.",
      minutes: 6,
      steps: [
        "Relax your shoulders and take one breath.",
        "Say the opening clearly at conversational volume.",
        "Repeat with a gentle lift in tone on the question.",
      ],
    },
  },
  mindfulness: {
    script: {
      title: "One calm instruction",
      reason: "Simple language makes a reset easier to follow.",
      target: "Give one safe breathing cue, one focus cue, and one close.",
      minutes: 6,
      steps: [
        "Write one optional breathing cue without promising a health result.",
        "Add one neutral cue to notice sound, posture, or the room.",
        "Finish by inviting the listener to continue when ready.",
      ],
    },
    pace: {
      title: "Space between cues",
      reason: "A slower pace leaves room to follow each instruction.",
      target: "Use a full two-beat pause after every short cue.",
      minutes: 5,
      steps: [
        "Split the guide into four short sentences.",
        "Count two silent beats after each sentence.",
        "Repeat without stretching or whispering the words.",
      ],
    },
    timing: {
      title: "One-minute reset",
      reason: "A clear time boundary keeps mindful practice approachable.",
      target: "Open, guide three cues, and close within 55–65 seconds.",
      minutes: 6,
      steps: [
        "Use 10 seconds to explain the choice to participate.",
        "Use 40 seconds for three simple cues.",
        "Use 10 seconds to close and return attention to the room.",
      ],
    },
    voice: {
      title: "Steady, natural voice",
      reason: "A calm guide can still sound clear and fully audible.",
      target: "Keep volume even, words clear, and tone natural.",
      minutes: 5,
      steps: [
        "Relax your jaw and take one comfortable breath.",
        "Speak at normal conversational volume.",
        "Replay the take and check that every word is easy to hear.",
      ],
    },
  },
};

const baselineDrills: Record<ArenaSkill, ArenaCoachingDrill> = {
  public: {
    skill: "public",
    signal: null,
    title: "Measured 45-second baseline",
    reason: "Zappy needs a measured take before choosing the weakest skill.",
    target: "Capture script, pace, timing, and voice signals in one short speech.",
    minutes: 5,
    steps: [
      "Choose one familiar topic.",
      "Speak for 45 seconds in one uninterrupted measured take.",
      "Use the resulting signals to select the first focused drill.",
    ],
  },
  vlog: {
    skill: "vlog",
    signal: null,
    title: "Measured 45-second vlog baseline",
    reason: "Zappy needs a measured take before choosing the weakest skill.",
    target: "Capture script, pace, timing, and voice signals in one short vlog.",
    minutes: 5,
    steps: [
      "Choose one useful tip you know well.",
      "Record a 45-second measured take with a hook and close.",
      "Use the resulting signals to select the first focused drill.",
    ],
  },
  leadership: {
    skill: "leadership",
    signal: null,
    title: "Measured team-brief baseline",
    reason: "Zappy needs a measured take before choosing the weakest skill.",
    target: "Capture all four signals in one short team update.",
    minutes: 5,
    steps: [
      "Choose a simple group task.",
      "Give a 45-second measured update with one next action.",
      "Use the resulting signals to select the first focused drill.",
    ],
  },
  social: {
    skill: "social",
    signal: null,
    title: "Measured conversation baseline",
    reason: "Zappy needs a measured take before choosing the weakest skill.",
    target: "Capture all four signals in a short conversation response.",
    minutes: 5,
    steps: [
      "Answer a friendly open question for 30–45 seconds.",
      "Include one question you would ask the other person.",
      "Use the resulting signals to select the first focused drill.",
    ],
  },
  mindfulness: {
    skill: "mindfulness",
    signal: null,
    title: "Measured one-minute guidance baseline",
    reason: "Zappy needs a measured take before choosing the first focused drill.",
    target: "Capture script, pace, timing, and voice without rating emotion or appearance.",
    minutes: 5,
    steps: [
      "Choose one simple, optional focus cue.",
      "Record a 45–60 second guide at a natural volume.",
      "Use only the measured delivery signals to choose the next drill.",
    ],
  },
};

export function getWeakestSignalCoaching(
  skill: ArenaSkill,
  signals: MeasuredSignals,
): ArenaCoachingDrill {
  let weakest: MeasuredSignal | null = null;
  let weakestScore = Number.POSITIVE_INFINITY;
  for (const signal of MEASURED_SIGNAL_ORDER) {
    const score = signals[signal];
    if (isScore(score) && score < weakestScore) {
      weakest = signal;
      weakestScore = score;
    }
  }
  if (!weakest) return baselineDrills[skill];
  return {
    skill,
    signal: weakest,
    ...coachingDrills[skill][weakest],
  };
}

export function arenaWeekKey(date = new Date()) {
  const utcDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((utcDate.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${utcDate.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function scoreArenaEntry(
  signals: MeasuredSignals,
  frozenBaseline: number,
) {
  if (!isScore(frozenBaseline) || !isMeasuredSignals(signals)) {
    return {
      eligible: false,
      reason: "INVALID_SCORE" as const,
    };
  }
  const measured = MEASURED_SIGNAL_ORDER.map(
    (signal) => signals[signal],
  ).filter(isScore);
  if (measured.length < 3) {
    return {
      eligible: false,
      reason: "REQUIRED_SIGNAL_UNAVAILABLE" as const,
    };
  }
  const mastery = Math.round(
    measured.reduce((sum, score) => sum + score, 0) /
      measured.length,
  );
  const growthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(50 + ((mastery - frozenBaseline) * 50) / 15),
    ),
  );
  const balance = Math.min(...measured);
  return {
    eligible: true,
    mastery,
    growthScore,
    balance,
    points: Math.round(
      mastery * 0.65 + growthScore * 0.25 + balance * 0.1,
    ),
  } as const;
}

export function calculateSeasonScore(roundScores: number[]) {
  return roundScores
    .slice(0, ARENA_SEASON_ROUNDS)
    .filter(isScore)
    .sort((a, b) => b - a)
    .slice(0, COUNTED_SEASON_ROUNDS)
    .reduce((sum, score) => sum + score, 0);
}

export function rankArenaEntries<T extends { id: string; points: number }>(
  entries: T[],
) {
  const sorted = entries
    .filter(
      (entry) =>
        isNonEmptyString(entry.id) && isScore(entry.points),
    )
    .slice()
    .sort(
      (a, b) =>
        b.points - a.points || a.id.localeCompare(b.id),
    );
  return sorted.map((entry, index) => ({
    ...entry,
    rank:
      index > 0 && sorted[index - 1].points === entry.points
        ? sorted.findIndex((item) => item.points === entry.points) + 1
        : index + 1,
  }));
}

export function calculateMicroWins(
  state: SkillsArenaState,
  skill: ArenaSkill,
) {
  const attempts = state.attempts
    .filter(
      (attempt) =>
        attempt.skill === skill && isRankableAttempt(attempt),
    )
    .slice()
    .sort(
      (a, b) =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
  if (!attempts.length) return 0;
  let wins = 1;
  let previousScore: number | null = null;
  for (const attempt of attempts) {
    wins += 1;
    if (
      previousScore !== null &&
      isScore(attempt.overallScore) &&
      attempt.overallScore >= previousScore + 3
    ) {
      wins += 1;
    }
    if (isScore(attempt.overallScore)) {
      previousScore = attempt.overallScore;
    }
  }
  return Math.min(MICRO_WINS_FOR_100X, wins);
}
