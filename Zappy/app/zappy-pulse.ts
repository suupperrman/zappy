import type { StudentLearningProof } from "./learning-proof";

export type ZappyPulseRole = "teacher" | "child";

export type ZappyPulseContext = {
  board: string;
  grade: string;
  subject: string;
  chapter: string;
  bookId?: string;
  book?: string;
  source?: string;
};

export type ZappyRolePulse = {
  status: "ready" | "source-required";
  eyebrow: string;
  title: string;
  contextLine: string;
  hook: string;
  explanation: string;
  question: string;
  misconception?: string;
  sourceLabel: string;
};

export type ParentHomeAction = {
  title: string;
  contextLine: string;
  prompt: string;
  steps: readonly [string, string, string];
  evidenceNote: string;
};

function normalise(value: string) {
  return value
    .toLowerCase()
    .replace(/[–—&]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasConnectedForceAndPressure(context: ZappyPulseContext | null) {
  if (!context) return false;
  const exactSubject = normalise(context.subject) === "science";
  const exactChapter = normalise(context.chapter) === "force and pressure";
  return exactSubject && exactChapter && Boolean(context.bookId || context.source);
}

function contextLine(context: ZappyPulseContext | null) {
  if (!context) return "Exact board · class · subject · chapter still needed";
  return [context.board, context.grade, context.subject, context.chapter].filter(Boolean).join(" · ");
}

export function buildRoleAIPulse(role: ZappyPulseRole, context: ZappyPulseContext | null): ZappyRolePulse {
  const ready = hasConnectedForceAndPressure(context);
  if (!ready) {
    return {
      status: "source-required",
      eyebrow: role === "teacher" ? "ZAPPY AI · PREP PULSE" : "ZAPPY COACH · BRAIN WARM-UP",
      title: role === "teacher" ? "One calm teaching move—after the source is set" : "Your next playful idea is source-gated",
      contextLine: contextLine(context),
      hook: "Choose the exact learning stage in today’s path.",
      explanation: "Zappy will not fill a missing chapter with a generic explanation or pretend it came from your board.",
      question: role === "teacher" ? "Set the class stage, then open the teaching copilot." : "Set the stage, then start one finite sourced quest.",
      sourceLabel: "No curriculum claim generated",
    };
  }

  const isKarnatakaPilot = context?.board === "Karnataka State Board" && context.grade === "Class 8";
  const sourceLabel = isKarnatakaPilot
    ? "DSERT 2025–26 learning outcome 7 · Zappy-created teaching analogy"
    : "Connected exact book · Zappy-created teaching analogy";

  if (role === "teacher") {
    return {
      status: "ready",
      eyebrow: "ZAPPY AI · PREP PULSE",
      title: "Pressure, without the common mix-up",
      contextLine: contextLine(context),
      hook: "Walk in with one object: a schoolbag with a wide strap.",
      explanation: "Compare the same bag with a thin strap. The bag’s force can stay similar while the smaller contact area makes the pressure feel greater.",
      question: "Ask the class: If the bag is unchanged, why can one strap hurt more?",
      misconception: "Misconception to catch: “more force always means more pressure.” Prompt learners to compare both force and contact area.",
      sourceLabel,
    };
  }

  return {
    status: "ready",
    eyebrow: "ZAPPY COACH · BRAIN WARM-UP",
    title: "Beat the schoolbag mystery",
    contextLine: contextLine(context),
    hook: "Same bag. Two straps. One feels sharper—why?",
    explanation: "A thin strap touches less area. With the same bag pushing down, that can make the pressure on your shoulder greater.",
    question: "Your turn: why do some heavy schoolbags use wide, padded straps? Say it in your own words.",
    sourceLabel,
  };
}

export function buildParentHomeAction(proof: StudentLearningProof | null, childName: string): ParentHomeAction | null {
  if (!proof) return null;
  const exactForceChapter = normalise(proof.subject) === "science" && normalise(proof.chapter) === "force and pressure";
  const retryCount = proof.review?.items.filter(item => item.outcome === "retry" || item.outcome === "partly").length || 0;
  const helpCount = proof.selfCheck["needs-help"] || 0;
  const startingPoint = retryCount
    ? `Begin with one of the ${retryCount} response${retryCount === 1 ? "" : "s"} the teacher marked for another look.`
    : helpCount
      ? `Begin with one answer ${childName} marked “need help”.`
      : `Begin with one answer ${childName} already submitted.`;
  const prompt = exactForceChapter
    ? `Ask ${childName}: “A schoolbag has the same books, but one strap is thin and one is wide. Which should feel more comfortable, and what does that tell you about pressure?”`
    : `Ask ${childName}: “Show me one idea from ${proof.chapter} using the source clue in your quest. What makes sense now, and what still feels confusing?”`;

  return {
    title: "Tonight in 8 minutes",
    contextLine: `${proof.subject} · ${proof.chapter}`,
    prompt,
    steps: [
      `2 min · ${startingPoint}`,
      `4 min · Listen to ${childName} explain; ask “what makes you think that?”`,
      "2 min · Save one observation or one calm next action—then stop.",
    ],
    evidenceNote: proof.review
      ? "Built from this child’s latest submitted proof and human teacher review."
      : "Built from this child’s latest submitted proof. Free-text work is still awaiting human teacher review.",
  };
}
