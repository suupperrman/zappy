import assert from "node:assert/strict";
import test from "node:test";

import { buildParentHomeAction, buildRoleAIPulse } from "../app/zappy-pulse.ts";

const exactContext = {
  board: "Karnataka State Board",
  grade: "Class 8",
  subject: "Science",
  chapter: "Force and Pressure",
  bookId: "official:dsert:karnataka:class8:science:2025-26",
};

test("the role pulse teaches only when an exact connected context is present", () => {
  const teacher = buildRoleAIPulse("teacher", exactContext);
  const child = buildRoleAIPulse("child", exactContext);
  const missing = buildRoleAIPulse("child", { ...exactContext, bookId: undefined, source: undefined });
  const wrongChapter = buildRoleAIPulse("teacher", { ...exactContext, chapter: "Citizen and Citizenship" });

  assert.equal(teacher.status, "ready");
  assert.equal(child.status, "ready");
  assert.match(teacher.misconception, /force always means more pressure/i);
  assert.match(child.question, /wide, padded straps/i);
  assert.match(teacher.sourceLabel, /DSERT 2025–26 learning outcome 7/);
  assert.equal(missing.status, "source-required");
  assert.equal(wrongChapter.status, "source-required");
  assert.doesNotMatch(`${missing.explanation} ${wrongChapter.explanation}`, /schoolbag|contact area/i);
});

test("the role pulse never turns practice material into an exam prediction", () => {
  const pulse = buildRoleAIPulse("teacher", exactContext);
  const copy = JSON.stringify(pulse);

  assert.doesNotMatch(copy, /99%|likely to appear|previous-year|appearance frequency/i);
  assert.match(copy, /Zappy-created teaching analogy/);
});

test("the parent action is derived from a real proof and has a firm eight-minute exit", () => {
  const action = buildParentHomeAction({
    studentName: "Arjun Sharma",
    subject: "Science",
    chapter: "Force and Pressure",
    selfCheck: { "needs-help": 1, almost: 1, "got-it": 1 },
    review: {
      items: [
        { questionId: "q1", outcome: "partly", feedback: "Compare area as well as force." },
        { questionId: "q2", outcome: "correct", feedback: "Clear explanation." },
      ],
      summary: "Revisit pressure and contact area.",
    },
  }, "Arjun");

  assert.ok(action);
  assert.equal(action.steps.length, 3);
  assert.match(action.prompt, /same books.*thin.*wide/i);
  assert.match(action.steps.join(" "), /2 min.*4 min.*2 min/i);
  assert.match(action.steps[0], /teacher marked for another look/i);
  assert.match(action.evidenceNote, /human teacher review/i);
  assert.doesNotMatch(JSON.stringify(action), /mastery score|streak|guilt|99%/i);
  assert.equal(buildParentHomeAction(null, "Arjun"), null);
});

test("a non-pilot parent prompt stays on the proof instead of inventing subject facts", () => {
  const action = buildParentHomeAction({
    studentName: "Arjun Sharma",
    subject: "Social Science",
    chapter: "Citizen and Citizenship",
    selfCheck: { "needs-help": 0, almost: 0, "got-it": 2 },
  }, "Arjun");

  assert.ok(action);
  assert.match(action.prompt, /Show me one idea from Citizen and Citizenship using the source clue/i);
  assert.doesNotMatch(action.prompt, /force|pressure|schoolbag/i);
});
