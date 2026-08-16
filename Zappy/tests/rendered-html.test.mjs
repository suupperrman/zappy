import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Zappy multi-role login", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Zappy — Play\. Learn\. Level Up\.<\/title>/i);
  assert.match(html, /I’m a learner/);
  assert.match(html, /I’m a teacher/);
  assert.match(html, /I’m a parent/);
  assert.match(html, /Local pilot role preview\. These fields do not authenticate an account yet/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("curriculum games stay exact, source-backed, and learner-isolated", async () => {
  const [page, css, indexText] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/curriculum.index.json", import.meta.url), "utf8"),
  ]);
  const index = JSON.parse(indexText);
  const science = index.records.find(
    (record) =>
      record.board === "CBSE" &&
      record.grade === "Class 8" &&
      record.subject === "Science",
  );

  assert.ok(science, "CBSE Class 8 Science curriculum record is required");
  assert.match(page, /board!=="CBSE"\|\|grade!=="Class 8"/);
  assert.match(page, /CURRICULUM_GAME_PACKS\[chapterKey\]/);
  assert.doesNotMatch(page, /normal\.includes\(key\)|key\.includes\(normal\)/);
  assert.match(page, /displayedOptions=useMemo/);
  assert.match(page, /lastRewardedRound/);
  assert.match(page, /\$\{playerId\}-\$\{context\.board\}/);
  assert.match(css, /\.curriculum-game-launcher/);

  const start = page.indexOf("const CURRICULUM_GAME_PACKS");
  const end = page.indexOf("const normaliseChapter", start);
  const packBlock = page.slice(start, end);
  const packKeys = [...packBlock.matchAll(/^\s{2}"([^"]+)":\{theme:/gm)].map(
    (match) => match[1],
  );
  const normalise = (value) =>
    value
      .toLowerCase()
      .replace(/[–—&]/g, " ")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const importedChapters = new Set(science.chapters.map(normalise));

  assert.equal(packKeys.length, 13);
  assert.ok(
    packKeys.every((chapter) => importedChapters.has(chapter)),
    "Every enabled pack must exactly match an imported textbook chapter",
  );
});

test("Zappy plays allowlisted official sources in-app without outbound learning handoffs", async () => {
  const [page, curriculum, css, sourceEngine, bookRoute, mediaRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/curriculum.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/zappy-source.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/diksha/book/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/diksha/media/route.ts", import.meta.url), "utf8"),
  ]);

  for (const board of [
    "CBSE",
    "Karnataka State Board",
    "Kerala State Board",
    "Tamil Nadu State Board",
    "Telangana State Board",
    "ICSE / ISC",
  ]) {
    assert.match(curriculum, new RegExp(board.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(curriculum, /export const GRADE_OPTIONS/);
  assert.match(curriculum, /"LKG"/);
  assert.match(curriculum, /"UKG"/);
  assert.match(curriculum, /"Class 12"/);
  assert.match(curriculum, /coverage: "textbook-catalogue"/);
  assert.match(curriculum, /coverage: "framework"/);
  assert.match(curriculum, /CISCE publishes this curriculum framework/);
  assert.match(curriculum, /national NCF Foundational/);

  assert.match(page, /function ZappyLessonQuest/);
  assert.match(page, /modal === "ai"[\s\S]{0,120}role==="teacher"/);
  assert.match(page, /<TeacherPrepCopilot[\s\S]{0,900}: <ZappyLessonQuest/);
  assert.match(page, /Stay inside Zappy/);
  assert.match(page, /Secure source adapter · no portal handoff/);
  assert.match(page, /ZAPPY_QUEST_STAGES\.map/);
  assert.match(page, /STAGE 1 · SPARK/);
  assert.match(page, /STAGE 2 · LEARN FROM THE ORIGINAL/);
  assert.match(page, /STAGE 3 · SOURCE TREASURE HUNT/);
  assert.match(page, /STAGE 4 · USE IT/);
  assert.match(page, /STAGE 5 · REFLECT/);
  assert.match(page, /No autoplay\. No next lesson starts until you choose it/);
  assert.match(page, /Learner self-check · no quiz formation/);
  assert.match(page, /Zappy will not substitute a generic topic/);
  assert.match(page, /function SourceProofDrawer/);
  assert.doesNotMatch(page, /NotebookLM|notebooklm\.google\.com/);
  assert.doesNotMatch(page, /target="_blank"|window\.open\(/);
  assert.doesNotMatch(page, /Anime Explainers|Anime explanation studio|genericTopics|function TeacherAIStudio|function AgentWorkspace/);
  assert.match(page, /NO FABRICATED PREDICTIONS/);
  assert.match(page, /Add five or more official previous-year papers/);
  assert.match(page, /ADD OFFICIAL PAPERS IN ZAPPY/);
  assert.doesNotMatch(page, /7 of 10 years|94% likely|10 years analysed/);
  assert.match(css, /\.grounded-studio/);
  assert.match(css, /\.coverage-badge\.textbook-catalogue/);
  assert.match(css, /\.predictor-empty-state/);
  assert.match(css, /\.quest-stage-nav/);
  assert.match(css, /\.source-proof-drawer/);

  assert.match(sourceEngine, /findZappySourceChapter/);
  assert.match(sourceEngine, /normaliseSourceTitle\(chapter\.title\) === exact/);
  assert.doesNotMatch(sourceEngine, /\.includes\(exact\)|exact\.includes/);
  assert.match(bookRoute, /url\.hostname === "obj\.diksha\.gov\.in"/);
  assert.match(bookRoute, /originalPlaybackAllowed/);
  assert.match(bookRoute, /commercialClearanceRequired/);
  assert.match(mediaRoute, /content\/v2\/read/);
  assert.match(mediaRoute, /url\.hostname === "obj\.diksha\.gov\.in"/);
  assert.match(mediaRoute, /const range = request\.headers\.get\("range"\)/);
  assert.match(mediaRoute, /"content-range"/);
  assert.doesNotMatch(mediaRoute, /searchParams\.get\("url"\)/);
});

test("all three roles share one finite, source-ordered daily learning loop", async () => {
  const [page, css, engine, sequenceText, teacherPrep] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/daily-loop.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../public/curriculum-sequences/cbse.json", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/teacher-prep-copilot.tsx", import.meta.url), "utf8"),
  ]);
  const sequences = JSON.parse(sequenceText);
  const exactBook = sequences.books.find(
    (book) =>
      book.name === "(NEW) Science Textbook for Class VIII" &&
      book.grades.includes("Class 8") &&
      book.subjects.includes("Science"),
  );

  assert.ok(exactBook, "an exact CBSE Class 8 Science book is required");
  assert.equal(exactBook.chapters[0], "CROP PRODUCTION AND MANAGEMENT");
  assert.equal(exactBook.chapters[1], "MICROORGANISMS FRIEND AND FOE");
  assert.ok(exactBook.source.startsWith("https://diksha.gov.in/"));

  assert.match(page, /function DailyLearningLoop/);
  assert.match(page, /role-\$\{role\}/);
  assert.match(page, /zappy:daily-loop:v1:\$\{role\}/);
  assert.match(page, /YOUR DAILY LEARNING FEED/);
  assert.match(page, /TODAY’S TEACHING LOOP/);
  assert.match(page, /YOUR DAILY FAMILY FEED/);
  assert.match(page, /label="Daily Loop"/);
  assert.match(page, /Today’s daily learning loop/);
  assert.match(page, /Today’s daily teaching loop/);
  assert.match(page, /Today’s daily family loop/);
  assert.match(page, /const dailyLoopId=`\$\{role\}-daily-loop`/);
  assert.match(page, /id=\{dailyLoopId\}/);
  assert.match(page, /if\(role==="child"\)/);
  assert.match(page, /student-path-onboarding/);
  assert.match(page, /BUILD MY ADVENTURE/);
  assert.match(page, /student-daily-path/);
  assert.match(page, /Today’s study path/);
  assert.match(page, /START MY QUEST/);
  assert.match(page, /QUEST RESULT SAVED/);
  assert.match(page, /FINISH TODAY’S PATH/);
  assert.match(page, /UP NEXT · TOMORROW/);
  assert.match(page, /aria-current=\{studentMapStep==="lesson"/);
  assert.match(page, /<ol className="student-path-road"/);
  assert.match(page, /student-path-track/);
  assert.match(page, /studentPathReceiptStorageKey/);
  assert.match(page, /zappy:student-path-receipt:v1/);
  assert.match(page, /draftSequencePlayable=draftSourceGate==="ready"/);
  assert.match(page, /draftSourceGateKey===draftSourceSelectionKey/);
  assert.match(page, /Loading the exact book, matching this chapter, and checking playable resources/);
  assert.match(page, /findZappySourceChapter\(book,draftChapterTitle\)/);
  assert.match(page, /!matched\.resources\.length/);
  assert.match(page, /role==="child"&&!isExactDikshaBookId\(sequence\.id\)/);
  assert.match(page, /findZappySourceChapter\(sourceBook,sequence\.chapters\[rolled\.chapterIndex\]\)/);
  assert.match(page, /preserved&&nextSequence\?Math\.min\(current,nextSequence\.chapters\.length-1\):pilotIndex>=0\?pilotIndex:0/);
  assert.match(page, /onComplete\?\.\(receipt\)/);
  assert.match(page, /disabled=\{!questDone\}/);
  assert.match(page, /You already answered this inside the quest—no second form/);
  assert.match(page, /teacher-home-content/);
  assert.match(page, /One sourced class plan for today/);
  assert.match(page, /TODAY’S TEACHING LOOP/);
  assert.match(page, /OPEN TODAY’S CLASS SOURCE/);
  assert.match(page, /<TeacherPrepLaunchCard/);
  assert.doesNotMatch(page, /dailyContext&&<TeacherPrepLaunchCard/);
  assert.match(page, /onSetStage=\{\(\)=>document\.getElementById\("teacher-daily-loop"\)/);
  assert.match(teacherPrep, /DAILY EASY PREP · 3 STEPS/);
  assert.match(teacherPrep, /AI prepares/);
  assert.match(teacherPrep, /You review/);
  assert.match(teacherPrep, /Teach & save/);
  assert.match(teacherPrep, /SET CLASS STAGE ↓/);
  assert.match(teacherPrep, /Teaching Command Centre/);
  assert.match(teacherPrep, /Today’s Teaching Pulse/);
  assert.match(teacherPrep, /Daily Assist/);
  assert.match(teacherPrep, /teacher-ai-smart-panel/);
  assert.match(teacherPrep, /teacher-ai-chat-stream/);
  assert.match(teacherPrep, /function askTeacherAi/);
  assert.doesNotMatch(teacherPrep, /dangerouslySetInnerHTML|\.innerHTML\b/);
  assert.doesNotMatch(teacherPrep, /\bonclick\s*=/);
  assert.match(teacherPrep, /saved\.autoPrepEnabled[\s\S]{0,100}resolveTeacherModule/);
  assert.match(teacherPrep, /const confirmedRecipients = \[\.\.\.new Set/);
  assert.match(teacherPrep, /const moduleAssignments = prep\.assignments\.filter/);
  assert.match(teacherPrep, /const selection = applyAiPick\(\)/);
  assert.doesNotMatch(teacherPrep, /prep\.assignments\[0\]|validRecipients/);
  assert.match(teacherPrep, /EXACT ORDERED MODULES/);
  assert.match(teacherPrep, /drafts\. You review, forward, and record what happened/);
  assert.doesNotMatch(teacherPrep, /95% likely|28 students|84h|₹3,200|ready by 7 AM|5\/5 years/);
  assert.match(css, /\.teacher-ai-shell\{/);
  assert.match(css, /\.teacher-ai-body\{/);
  assert.match(css, /\.teacher-ai-pulse\{/);
  assert.match(css, /\.teacher-ai-smart-panel\{/);
  assert.match(css, /\.teacher-ai-chat\{/);
  assert.match(css, /\.teacher-ai-command\{/);
  assert.match(css, /--tai-bg:#0f1b2d/);
  assert.match(css, /--tai-lime:#c8f135/);
  assert.match(css, /\.tpl-easy-loop/);
  assert.match(page, /className="notebook-top" onClick=\{\(\) => setModal\("notebook"\)\}/);
  assert.match(page, /onOpen=\{\(\)=>setModal\("ai"\)\}/);
  assert.doesNotMatch(page, /teacherPrepAutoOpen/);
  assert.doesNotMatch(page, /teacher-dashboard-section-title/);
  assert.match(page, /Exact book \/ framework/);
  assert.match(page, /Current chapter \/ module/);
  assert.match(page, /curriculum-sequences\/\$\{slug\}\.json/);
  assert.match(page, /sourceFingerprint\(sequence\)!==state\.sourceFingerprint/);
  assert.match(page, /initialContext=\{dailyContext\}/);
  assert.match(page, /DONE FOR TODAY/);
  assert.match(page, /no endless feed/i);
  assert.match(page, /WHY THIS TOPIC\?/);
  assert.match(page, /PAUSE SUGGESTIONS/);
  assert.match(page, /at most once per day/);
  assert.match(page, /No watch-time ranking/);
  assert.match(page, /without autoplay, infinite scroll, streak-loss pressure or random rewards/);

  const componentStart = page.indexOf("function DailyLearningLoop");
  const componentEnd = page.indexOf("type QuestSourceState", componentStart);
  const component = page.slice(componentStart, componentEnd);
  assert.doesNotMatch(component, /Math\.random|IntersectionObserver|setInterval|onScroll/);

  assert.match(engine, /confidence !== "needs-help"/);
  assert.match(engine, /chapterIndex < chapterTitles\.length - 1/);
  assert.match(engine, /state\.completedToday \? state\.nextChapterIndex : state\.chapterIndex/);
  assert.match(engine, /reached the final sourced item/);
  assert.match(css, /\.daily-loop-shell/);
  assert.match(css, /\.daily-loop-shell\{--loop:/);
  assert.match(css, /\.role-teacher/);
  assert.match(css, /\.role-parent/);
  assert.match(css, /\.student-daily-path/);
  assert.match(css, /\.student-path-onboarding/);
  assert.match(css, /\.student-game-world/);
  assert.match(css, /\.student-path-track/);
  assert.match(css, /Fixed mobile map geometry/);
  assert.match(css, /\.student-game-world \.student-path-bubble\{width:100%;max-width:100%\}/);
  assert.match(css, /\.student-path-road/);
  assert.match(css, /\.student-path-node/);
});

test("the Karnataka pilot closes the teacher, student, and parent learning-proof loop", async () => {
  const [page, ui, records, teacherPrep, css, pulse] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/learning-proof-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/learning-proof.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/teacher-prep-copilot.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/zappy-pulse.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /StudentAssignmentInbox/);
  assert.match(page, /TeacherLearningProofSummary/);
  assert.match(page, /ParentLearningDiary/);
  assert.match(page, /<RoleAIPulse role="teacher"/);
  assert.match(page, /<RoleAIPulse\s+role="child"/);
  assert.match(page, /<ParentLearningDiary key=\{`\$\{parentId\}-\$\{child\.id\}`\}/);
  assert.match(page, /<TeacherLearningProofSummary key=\{`\$\{current\.id\}-\$\{tenant\}`\}/);
  assert.match(page, /zappy:shop-reward-ledger:v1/);
  assert.match(page, /role==="teacher"\?"Karnataka State Board":"CBSE"/);
  assert.doesNotMatch(page, /had a great science day|learning score|65 XP|72% complete|41 submitted|Class mastery|32 students|86 students|42m|\+12%/);

  assert.match(records, /studentAssignmentForRecipient/);
  assert.match(records, /questions: assignment\.questions\.map\(question => \(\{ id: question\.id, prompt: question\.prompt, sourceRef: question\.sourceRef, evidenceKind: question\.evidenceKind \}\)\)/);
  assert.match(records, /parseStudentAssignmentDraft/);
  assert.match(records, /reviewStudentLearningProof/);
  assert.match(records, /parentLearningDiaryKey/);
  assert.match(records, /mergeLearningProof/);
  assert.match(records, /parseTeacherLearningProofsFor/);
  assert.match(records, /teacher-learning-proof:v2/);
  assert.match(records, /draft\.response\.trim\(\)\.length > 20_000/);
  assert.match(records, /boundedRecordId/);
  const publicAssignmentStart = records.indexOf("export function studentAssignmentForRecipient");
  const publicAssignmentEnd = records.indexOf("function isQuestionProof", publicAssignmentStart);
  assert.doesNotMatch(records.slice(publicAssignmentStart, publicAssignmentEnd), /answer:/);

  assert.match(ui, /TEACHER SIDE QUESTS/);
  assert.match(ui, /FINAL CHECKPOINT/);
  assert.match(ui, /No automatic grading/);
  assert.match(ui, /submissionLock\.current/);
  assert.match(ui, /teacherLearningProofKey\(assignment\.teacherId, assignment\.workspace\)/);
  assert.match(ui, /navigator as Navigator[\s\S]{0,160}locks/);
  assert.match(ui, /No duplicate coins were added/);
  assert.match(ui, /cannot safely guarantee a one-time reward across tabs/);
  assert.doesNotMatch(ui, /else await commit\(\)/);
  assert.match(ui, /parseStudentAssignmentsFor/);
  assert.match(ui, /parseParentDiaryEntriesFor/);
  assert.match(ui, /RESUME QUEST/);
  assert.match(ui, /maxLength=\{20_000\}/);
  assert.match(ui, /event\.key === "Escape"/);
  assert.match(ui, /DAILY DIARY · ACCOUNTABILITY · GROWTH PROOF/);
  assert.match(ui, /ZAPPY PARENT AI · ONE CALM ACTION/);
  assert.match(pulse, /Tonight in 8 minutes/);
  assert.match(ui, /buildParentHomeAction/);
  assert.match(ui, /COPY TONIGHT’S PROMPT/);
  assert.match(ui, /Nothing is sent automatically/);
  assert.match(ui, /No learning proof yet/);
  assert.doesNotMatch(ui, /StudentQuestReceipt|Math\.random|dangerouslySetInnerHTML|\.innerHTML\b/);

  assert.match(teacherPrep, /studentAssignmentForRecipient\(assignment, studentId\)/);
  assert.match(teacherPrep, /Expected answers stayed in the teacher record/);
  assert.match(teacherPrep, /Student learning proofs/);
  assert.match(teacherPrep, /SAVE HUMAN REVIEW/);
  assert.match(teacherPrep, /currentProofs\.length.*reviewAssignment\.recipients\.length/);
  assert.match(teacherPrep, /resolveQuizEvidenceKind/);
  assert.match(teacherPrep, /Edited · teacher-cited/);
  assert.match(teacherPrep, /assignment-run-picker/);
  assert.match(teacherPrep, /teacherLearningProofKey\(actorId, tenant\)/);
  assert.match(teacherPrep, /function resolveReviewedStudentSignal/);
  assert.match(teacherPrep, /item\.outcome === "retry" \|\| item\.outcome === "partly"/);
  assert.match(teacherPrep, /prep\.autoPrepEnabled.*automaticReviewChapter/);

  assert.match(css, /\.student-assignment-hub/);
  assert.match(css, /\.student-quiz-panel/);
  assert.match(css, /\.teacher-proof-summary/);
  assert.match(css, /\.assignment-results/);
  assert.match(css, /\.parent-learning-diary/);
  assert.match(css, /\.zappy-role-pulse/);
  assert.match(css, /\.parent-tonight-coach/);
  assert.match(css, /\.pilot-boundary-card/);
  assert.match(css, /\.student-quiz-progress\{[\s\S]{0,400}overflow-x:auto/);
  assert.match(css, /\.assignment-run-picker/);
});

test("Skills Arena teaches measurable growth before ordered, honest competition", async () => {
  const [page, css, engine, hostingText] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/skills-arena.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  const hosting = JSON.parse(hostingText);

  assert.equal(hosting.d1, null);
  assert.match(page, /ZAPPY 100X SKILL SYSTEM/);
  assert.match(page, /CLASSMATES/);
  assert.match(page, /SCHOOL/);
  assert.match(page, /ZAPPY/);
  assert.match(page, /LEARN THE MOVE/);
  assert.match(page, /TODAY’S FOCUSED DRILL/);
  assert.match(page, /MIRROR, COMPARE, RETRY/);
  assert.match(page, /LOCAL PRACTICE PREVIEW · NOT LIVE USERS/);
  assert.match(page, /Live Zappy ranking requires verified network data/);
  assert.match(page, /100 visible micro-wins/);
  assert.match(page, /65% demonstrated mastery · 25% improvement/);
  assert.match(page, /Visual self-review never enters competition scoring/);
  assert.match(page, /initialSkillId=\{arenaSkillId\}/);
  assert.match(page, /skillsArenaStorageKey\(current\.id,tenant\)/);
  assert.match(page, /No public child videos/);
  assert.doesNotMatch(page, /#4 across Zappy|live global users|Last AI Mirror score: 87/);

  assert.match(engine, /baselineTakes: 3/);
  assert.match(engine, /completedClassRounds: 3/);
  assert.match(engine, /minimumMastery: 60/);
  assert.match(engine, /completedSchoolRounds: 3/);
  assert.match(engine, /minimumMastery: 70/);
  assert.match(engine, /class: 5/);
  assert.match(engine, /school: 15/);
  assert.match(engine, /zappy: 100/);
  assert.match(engine, /countMeasuredSignals\(attempt\.signals\) >= 3/);
  assert.match(engine, /mastery \* 0\.65 \+ growthScore \* 0\.25 \+ balance \* 0\.1/);
  assert.match(engine, /MAX_TAKES_PER_ROUND = 3/);
  assert.match(engine, /COUNTED_SEASON_ROUNDS = 4/);
  assert.doesNotMatch(engine, /Math\.random|fetch\(|IntersectionObserver|watchTime|followerCount/);

  assert.match(css, /\.arena-ladder/);
  assert.match(css, /\.arena-coach-layout/);
  assert.match(css, /\.arena-competition-board/);
  assert.match(css, /\.arena-safety-strip/);
});
