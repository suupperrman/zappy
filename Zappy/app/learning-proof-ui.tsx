"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createParentDiaryEntry,
  createStudentLearningProof,
  mergeLearningProof,
  mergeParentDiaryEntry,
  mergeScopedTeacherProofs,
  legacyTeacherLearningProofKey,
  parentLearningDiaryKey,
  parseParentDiaryEntriesFor,
  parseStudentAssignmentDraft,
  parseStudentAssignmentsFor,
  parseStudentLearningProofsFor,
  studentAssignmentDraftKey,
  studentAssignmentInboxKey,
  studentLearningProofKey,
  teacherLearningProofKey,
  type LearningConfidence,
  type ParentDiaryEntry,
  type StudentAssignmentRecord,
  type StudentLearningProof,
} from "./learning-proof";
import { buildParentHomeAction } from "./zappy-pulse";

const CONFIDENCE_CHOICES: Array<{ id: LearningConfidence; icon: string; label: string }> = [
  { id: "needs-help", icon: "🛟", label: "Need help" },
  { id: "almost", icon: "🌱", label: "Almost" },
  { id: "got-it", icon: "⭐", label: "Got it" },
];

function proofForAssignment(proofs: StudentLearningProof[], assignmentId: string) {
  return proofs.find(proof => proof.assignmentId === assignmentId) || null;
}

function compactLocalTime(value: string) {
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

export function StudentAssignmentInbox({
  actorId,
  studentName,
  onCoinsEarned,
}: {
  actorId: string;
  studentName: string;
  onCoinsEarned: (coins: number, rewardId: string) => void;
}) {
  const [assignments, setAssignments] = useState<StudentAssignmentRecord[]>([]);
  const [proofs, setProofs] = useState<StudentLearningProof[]>([]);
  const [activeId, setActiveId] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [confidence, setConfidence] = useState<Record<string, LearningConfidence>>({});
  const [draftProgress, setDraftProgress] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("");
  const submissionLock = useRef(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const launchButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const activeAssignment = assignments.find(assignment => assignment.id === activeId) || null;
  const activeProof = activeAssignment ? proofForAssignment(proofs, activeAssignment.id) : null;
  const answeredCount = activeAssignment?.questions.filter(question => responses[question.id]?.trim() && confidence[question.id]).length || 0;

  useEffect(() => {
    let active = true;
    const load = () => {
      if (!active) return;
      const nextAssignments = parseStudentAssignmentsFor(window.localStorage.getItem(studentAssignmentInboxKey(actorId)), actorId);
      setAssignments(nextAssignments);
      setProofs(parseStudentLearningProofsFor(window.localStorage.getItem(studentLearningProofKey(actorId)), actorId));
      setDraftProgress(Object.fromEntries(nextAssignments.map(assignment => {
        const draft = parseStudentAssignmentDraft(window.localStorage.getItem(studentAssignmentDraftKey(actorId, assignment.id)), assignment, actorId);
        const count = assignment.questions.filter(question => draft?.responses[question.id]?.trim() || draft?.confidence[question.id]).length;
        return [assignment.id, count];
      })));
    };
    queueMicrotask(load);
    window.addEventListener("storage", load);
    return () => {
      active = false;
      window.removeEventListener("storage", load);
    };
  }, [actorId]);

  useEffect(() => {
    if (!activeAssignment) return;
    queueMicrotask(() => (stepHeadingRef.current || panelRef.current)?.focus());
  }, [activeAssignment, activeProof, currentIndex]);

  function saveDraft(assignment: StudentAssignmentRecord, nextResponses: Record<string, string>, nextConfidence: Record<string, LearningConfidence>, nextIndex: number) {
    try {
      window.localStorage.setItem(studentAssignmentDraftKey(actorId, assignment.id), JSON.stringify({
        version: 1,
        assignmentId: assignment.id,
        studentId: actorId.trim().toLowerCase(),
        currentIndex: nextIndex,
        responses: nextResponses,
        confidence: nextConfidence,
        updatedAt: new Date().toISOString(),
      }));
      const count = assignment.questions.filter(question => nextResponses[question.id]?.trim() || nextConfidence[question.id]).length;
      setDraftProgress(current => ({ ...current, [assignment.id]: count }));
      return true;
    } catch {
      setStatus("This draft could not be saved on this browser. Keep this page open and try again.");
      return false;
    }
  }

  function openAssignment(assignment: StudentAssignmentRecord) {
    const proof = proofForAssignment(proofs, assignment.id);
    setActiveId(assignment.id);
    submissionLock.current = false;
    setStatus("");
    if (proof) {
      setResponses(Object.fromEntries(proof.answers.map(answer => [answer.questionId, answer.response])));
      setConfidence(Object.fromEntries(proof.answers.map(answer => [answer.questionId, answer.confidence])));
      setCurrentIndex(assignment.questions.length);
      return;
    }
    const draft = parseStudentAssignmentDraft(window.localStorage.getItem(studentAssignmentDraftKey(actorId, assignment.id)), assignment, actorId);
    setResponses(draft?.responses || {});
    setConfidence(draft?.confidence || {});
    setCurrentIndex(draft?.currentIndex || 0);
  }

  function updateResponse(questionId: string, response: string) {
    if (!activeAssignment || activeProof) return;
    const next = { ...responses, [questionId]: response.slice(0, 20_000) };
    setResponses(next);
    saveDraft(activeAssignment, next, confidence, currentIndex);
  }

  function updateConfidence(questionId: string, value: LearningConfidence) {
    if (!activeAssignment || activeProof) return;
    const next = { ...confidence, [questionId]: value };
    setConfidence(next);
    saveDraft(activeAssignment, responses, next, currentIndex);
  }

  function moveTo(index: number) {
    if (!activeAssignment || activeProof) return;
    const bounded = Math.max(0, Math.min(activeAssignment.questions.length, index));
    setCurrentIndex(bounded);
    if (saveDraft(activeAssignment, responses, confidence, bounded)) setStatus("");
  }

  function nextQuestion() {
    if (!activeAssignment) return;
    const question = activeAssignment.questions[currentIndex];
    if (!question || !responses[question.id]?.trim() || !confidence[question.id]) {
      setStatus("Write your answer and choose how it feels before moving on.");
      return;
    }
    moveTo(currentIndex + 1);
  }

  function closeAssignment() {
    const closingId = activeId;
    setActiveId("");
    queueMicrotask(() => launchButtonRefs.current[closingId]?.focus());
  }

  async function submitAssignment() {
    if (!activeAssignment || activeProof || submissionLock.current) return;
    submissionLock.current = true;
    const assignment = activeAssignment;
    const commit = async () => {
      const studentKey = studentLearningProofKey(actorId);
      const teacherKey = teacherLearningProofKey(assignment.teacherId, assignment.workspace);
      const legacyTeacherKey = legacyTeacherLearningProofKey(assignment.teacherId);
      const previousStudent = window.localStorage.getItem(studentKey);
      const previousTeacher = window.localStorage.getItem(teacherKey);
      const freshStudent = parseStudentLearningProofsFor(previousStudent, actorId);
      const existing = proofForAssignment(freshStudent, assignment.id);
      if (existing) {
        setProofs(freshStudent);
        setStatus("This learning proof was already submitted. No duplicate coins were added.");
        return;
      }
      const result = createStudentLearningProof({
        assignment,
        studentId: actorId,
        studentName,
        answers: assignment.questions.map(question => ({
          questionId: question.id,
          response: responses[question.id] || "",
          confidence: confidence[question.id] || null,
        })),
        submittedAt: new Date().toISOString(),
      });
      if (!result.ok) {
        setStatus("Every answer and confidence check is required, and each answer must stay within 20,000 characters.");
        return;
      }
      const scopedTeacher = mergeScopedTeacherProofs(previousTeacher, window.localStorage.getItem(legacyTeacherKey), assignment.teacherId, assignment.workspace);
      const nextStudent = mergeLearningProof(freshStudent, result.proof);
      const nextTeacher = mergeLearningProof(scopedTeacher, result.proof);
      try {
        window.localStorage.setItem(studentKey, JSON.stringify(nextStudent));
        window.localStorage.setItem(teacherKey, JSON.stringify(nextTeacher));
        window.localStorage.removeItem(studentAssignmentDraftKey(actorId, assignment.id));
        setDraftProgress(current => ({ ...current, [assignment.id]: 0 }));
        setProofs(nextStudent);
        setStatus("Learning proof saved. Your teacher can now review your words—no automatic score was invented.");
        onCoinsEarned(result.proof.coinsAwarded, result.proof.id);
      } catch {
        try {
          if (previousStudent === null) window.localStorage.removeItem(studentKey);
          else window.localStorage.setItem(studentKey, previousStudent);
          if (previousTeacher === null) window.localStorage.removeItem(teacherKey);
          else window.localStorage.setItem(teacherKey, previousTeacher);
        } catch {
          // The visible failure remains truthful even if browser storage rollback is unavailable.
        }
        setStatus("Submission could not be saved. No completion or coins were recorded.");
      }
    };
    try {
      const locks = (navigator as Navigator & { locks?: { request: (name: string, callback: () => Promise<void>) => Promise<void> } }).locks;
      if (!locks) {
        setStatus("This browser cannot safely guarantee a one-time reward across tabs. Open this quest in a current browser with Web Locks support to submit.");
        return;
      }
      await locks.request("zappy-learning-proof:" + assignment.id + ":" + actorId.trim().toLowerCase(), commit);
    } finally {
      submissionLock.current = false;
    }
  }

  return <section id="teacher-side-quests" className="student-assignment-hub" aria-label="Teacher side quests">
    <header className="student-assignment-head"><span>📬</span><div><small>TEACHER SIDE QUESTS</small><h2>School learning, replayed your way</h2><p>Answer in your own words, keep every citation, and finish with a real learning proof.</p></div><b>{assignments.length}</b></header>
    {!assignments.length ? <div className="student-assignment-empty"><span>🛸</span><div><b>No teacher quest on this browser yet</b><p>When your teacher saves a reviewed quiz to your confirmed local Zappy ID, it will appear here.</p><small>Same-browser pilot · account delivery is not verified</small></div></div> : <div className="student-assignment-trail">{assignments.map(assignment => {
      const proof = proofForAssignment(proofs, assignment.id);
      const isActive = activeId === assignment.id;
      const savedCount = draftProgress[assignment.id] || 0;
      return <article className={`student-inbox-row ${proof ? "is-submitted" : isActive ? "is-active" : "is-new"}`} key={assignment.id}>
        <span>{proof ? "🏆" : savedCount ? "🧭" : "⚡"}</span><div><small>{assignment.subject} · {assignment.grade}</small><b>{assignment.chapter}</b><p>{assignment.fromTeacher} · {assignment.workspace}</p><em>📎 {assignment.questions.length} cited questions · due {assignment.dueDate}</em></div><i className="student-inbox-status">{proof ? proof.review ? "REVIEWED" : "SUBMITTED" : savedCount ? `SAVED ${savedCount}/${assignment.questions.length}` : "NEW QUEST"}</i><button ref={element => { launchButtonRefs.current[assignment.id] = element; }} onClick={() => openAssignment(assignment)}>{proof ? "VIEW PROOF" : isActive ? "CONTINUE" : savedCount ? "RESUME QUEST" : "START QUEST"}</button>
      </article>;
    })}</div>}

    {activeAssignment && <div className="student-quiz-panel" ref={panelRef} role="region" aria-label={`${activeAssignment.chapter} teacher side quest`} tabIndex={-1} onKeyDown={event => { if (event.key === "Escape") closeAssignment(); }}>
      <header><button onClick={closeAssignment} aria-label="Close teacher side quest">×</button><div><small>{activeAssignment.board} · {activeAssignment.grade} · {activeAssignment.subject}</small><h3>{activeAssignment.chapter}</h3><p>{activeAssignment.fromTeacher} is waiting for your own explanation.</p></div><span>{activeProof ? "PROOF" : currentIndex === activeAssignment.questions.length ? "REVIEW" : `${currentIndex + 1}/${activeAssignment.questions.length}`}</span></header>
      <div className="student-quiz-progress" role="progressbar" aria-label="Teacher quest progress" aria-valuemin={0} aria-valuemax={activeAssignment.questions.length} aria-valuenow={activeProof ? activeAssignment.questions.length : answeredCount}><i style={{ width: `${Math.round((activeProof ? 1 : answeredCount / activeAssignment.questions.length) * 100)}%` }}/>{activeAssignment.questions.map((question, index) => <b className={responses[question.id]?.trim() && confidence[question.id] ? "done" : index === currentIndex ? "active" : ""} key={question.id}>{index + 1}</b>)}</div>

      {activeProof ? <div className="student-submission-receipt"><span>{activeProof.review ? "🎓" : "📨"}</span><small>REAL LOCAL LEARNING PROOF</small><h3 ref={stepHeadingRef} tabIndex={-1}>{activeProof.review ? "Your teacher reviewed it!" : "Submitted—human review next"}</h3><p>{activeProof.answers.length} answers saved with {activeProof.sourceProofCount} citations on {compactLocalTime(activeProof.submittedAt)}.</p><div><b>⭐ {activeProof.selfCheck["got-it"]} got it</b><b>🌱 {activeProof.selfCheck.almost} almost</b><b>🛟 {activeProof.selfCheck["needs-help"]} need help</b><b>🪙 +{activeProof.coinsAwarded} shop coins</b></div>{activeProof.review ? <section><small>TEACHER’S REVIEW</small><p>{activeProof.review.summary}</p><div>{activeProof.review.items.map(item => <span className={item.outcome} key={item.questionId}>{item.outcome}</span>)}</div></section> : <em>Free-text answers are never auto-scored. Your teacher must review them.</em>}</div>
        : currentIndex < activeAssignment.questions.length ? (() => {
          const question = activeAssignment.questions[currentIndex];
          return <div className="student-quiz-question" key={question.id}><div className="student-quiz-spark"><span>💡</span><p><small>MISSION {currentIndex + 1}</small><b>Think first. Explain it your way.</b></p></div><h3 ref={stepHeadingRef} tabIndex={-1}>{question.prompt}</h3><div className="student-quiz-source"><span>🛡️</span><p><small>{question.evidenceKind === "official-practice" ? "OFFICIAL PRACTICE" : "TEACHER-CITED"} · SOURCE CLUE</small><b>{question.sourceRef}</b></p></div><label htmlFor={`student-answer-${question.id}`}>Your answer<textarea id={`student-answer-${question.id}`} maxLength={20_000} value={responses[question.id] || ""} onChange={event => updateResponse(question.id, event.target.value)} placeholder="Explain what you understand. Your teacher—not an algorithm—will review it."/></label><fieldset><legend>How does this answer feel?</legend>{CONFIDENCE_CHOICES.map(choice => <button type="button" aria-pressed={confidence[question.id] === choice.id} className={confidence[question.id] === choice.id ? "on" : ""} onClick={() => updateConfidence(question.id, choice.id)} key={choice.id}><span>{choice.icon}</span>{choice.label}</button>)}</fieldset><div className="student-quiz-actions"><button disabled={currentIndex === 0} onClick={() => moveTo(currentIndex - 1)}>← BACK</button><button className="primary" onClick={nextQuestion}>{currentIndex === activeAssignment.questions.length - 1 ? "REVIEW MY QUEST →" : "SAVE & NEXT →"}</button></div></div>;
        })() : <div className="student-quiz-review"><span>🧭</span><small>FINAL CHECKPOINT</small><h3 ref={stepHeadingRef} tabIndex={-1}>Review before you submit</h3><p>All {answeredCount}/{activeAssignment.questions.length} answers need your words and a confidence check.</p><div>{activeAssignment.questions.map((question, index) => <button onClick={() => moveTo(index)} className={responses[question.id]?.trim() && confidence[question.id] ? "ready" : "missing"} key={question.id}><span>{index + 1}</span><p><b>{question.prompt}</b><small>{responses[question.id]?.trim() ? responses[question.id] : "Answer missing"}</small></p><em>{confidence[question.id] || "confidence missing"}</em></button>)}</div><aside><b>No automatic grading</b><p>Submitting creates a local learning proof for your teacher. It does not advance the separate daily curriculum path.</p></aside><div className="student-quiz-actions"><button onClick={() => moveTo(activeAssignment.questions.length - 1)}>← EDIT</button><button className="primary" disabled={answeredCount !== activeAssignment.questions.length} onClick={submitAssignment}>SUBMIT TO TEACHER REVIEW →</button></div></div>}
      {status && <p className="student-quiz-status" role="status">{status}</p>}
    </div>}
  </section>;
}

export function TeacherLearningProofSummary({ actorId, workspace, onOpen }: { actorId: string; workspace: string; onOpen: () => void }) {
  const [proofs, setProofs] = useState<StudentLearningProof[]>([]);
  useEffect(() => {
    let active = true;
    const load = () => {
      if (!active) return;
      const key = teacherLearningProofKey(actorId, workspace);
      const scoped = mergeScopedTeacherProofs(window.localStorage.getItem(key), window.localStorage.getItem(legacyTeacherLearningProofKey(actorId)), actorId, workspace);
      setProofs(scoped);
      try { window.localStorage.setItem(key, JSON.stringify(scoped)); } catch { /* The summary remains read-only if migration cannot persist. */ }
    };
    queueMicrotask(load);
    window.addEventListener("storage", load);
    return () => { active = false; window.removeEventListener("storage", load); };
  }, [actorId, workspace]);
  const awaiting = proofs.filter(proof => !proof.review).length;
  const reviewed = proofs.length - awaiting;
  return <section className="teacher-proof-summary">
    <header><span>👥</span><div><small>{workspace.toUpperCase()} · ACTUAL STUDENT TRACKING</small><h2>Learning proofs</h2><p>Only explicit student submissions for this workspace appear here—never estimated activity.</p></div><button onClick={onOpen}>OPEN REVIEW WORKSPACE →</button></header>
    <div className="teacher-proof-counts"><span><b>{proofs.length}</b><small>submitted locally</small></span><span><b>{awaiting}</b><small>need human review</small></span><span><b>{reviewed}</b><small>teacher reviewed</small></span></div>
    {!proofs.length ? <p className="teacher-proof-empty">No student learning proof has been submitted to this teacher ID on this browser yet.</p> : <div className="teacher-proof-latest">{proofs.slice(0, 3).map(proof => <article key={proof.id}><span>{proof.review ? "✓" : "…"}</span><p><b>{proof.studentName} · {proof.chapter}</b><small>{proof.subject} · {compactLocalTime(proof.submittedAt)}</small></p><em>{proof.review ? "REVIEWED" : "REVIEW NEEDED"}</em></article>)}</div>}
  </section>;
}

function parentLetter(proof: StudentLearningProof | null, parentName: string, childName: string) {
  if (!proof) return "";
  const reviewLine = proof.review
    ? `Your review says: “${proof.review.summary}”`
    : "The free-text work is awaiting your review, so I am not treating it as graded.";
  return `Dear ${proof.teacherName},\n\nI’m writing about ${childName}’s recent ${proof.subject} learning proof for “${proof.chapter}”. ${childName} completed ${proof.answers.length} cited responses and marked ${proof.selfCheck["needs-help"]} answer(s) as needing help. ${reviewLine}\n\nCould you please suggest the one concept we should revisit at home without moving ahead of the class?\n\nRegards,\n${parentName}`;
}

export function ParentLearningDiary({
  parentId,
  parentName,
  child,
  onOpenSource,
}: {
  parentId: string;
  parentName: string;
  child: { name: string; id: string };
  onOpenSource: () => void;
}) {
  const [proofs, setProofs] = useState<StudentLearningProof[]>([]);
  const [assignments, setAssignments] = useState<StudentAssignmentRecord[]>([]);
  const [entries, setEntries] = useState<ParentDiaryEntry[]>([]);
  const [childResponse, setChildResponse] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [letter, setLetter] = useState("");
  const [status, setStatus] = useState("");
  const latest = proofs[0] || null;
  const latestEntry = latest ? entries.find(entry => entry.proofId === latest.id) || null : null;
  const pendingCount = assignments.filter(assignment => !proofForAssignment(proofs, assignment.id)).length;
  const reviewedCount = proofs.filter(proof => proof.review).length;
  const helpSignals = proofs.reduce((sum, proof) => sum + proof.selfCheck["needs-help"], 0);
  const earnedCoins = proofs.reduce((sum, proof) => sum + proof.coinsAwarded, 0);
  const letterTemplate = useMemo(() => parentLetter(latest, parentName, child.name), [latest, parentName, child.name]);
  const homeAction = useMemo(() => buildParentHomeAction(latest, child.name), [latest, child.name]);

  useEffect(() => {
    let active = true;
    const load = () => {
      if (!active) return;
      setProofs(parseStudentLearningProofsFor(window.localStorage.getItem(studentLearningProofKey(child.id)), child.id));
      setAssignments(parseStudentAssignmentsFor(window.localStorage.getItem(studentAssignmentInboxKey(child.id)), child.id));
      setEntries(parseParentDiaryEntriesFor(window.localStorage.getItem(parentLearningDiaryKey(parentId, child.id)), parentId, child.id));
    };
    queueMicrotask(load);
    window.addEventListener("storage", load);
    return () => { active = false; window.removeEventListener("storage", load); };
  }, [parentId, child.id]);

  useEffect(() => {
    queueMicrotask(() => {
      setChildResponse(latestEntry?.childResponse || "");
      setNextAction(latestEntry?.nextAction || "");
      setLetter(letterTemplate);
    });
  }, [latestEntry, letterTemplate]);

  function saveDiary() {
    if (!latest) return;
    const savedAt = new Date().toISOString();
    const entry = createParentDiaryEntry({ parentId, studentId: child.id, proofId: latest.id, childResponse, nextAction, savedAt });
    if (!entry) {
      setStatus("Write what your child said and one next action before saving the diary.");
      return;
    }
    const key = parentLearningDiaryKey(parentId, child.id);
    const previous = window.localStorage.getItem(key);
    const next = mergeParentDiaryEntry(parseParentDiaryEntriesFor(previous, parentId, child.id), entry);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
      setEntries(next);
      setStatus("Parent observation saved locally with this learning proof.");
    } catch {
      setStatus("The diary could not be saved on this browser. No saved claim was created.");
    }
  }

  async function copyLetter() {
    if (!letter.trim()) return;
    try {
      await navigator.clipboard.writeText(letter);
      setStatus("Letter copied. Review it yourself before sending through your school’s real channel.");
    } catch {
      setStatus("Copy was unavailable. Select the letter text and copy it manually.");
    }
  }

  async function copyHomePrompt() {
    if (!homeAction) return;
    try {
      await navigator.clipboard.writeText(homeAction.prompt);
      setStatus("Tonight’s prompt copied. Keep it curious, calm, and under eight minutes.");
    } catch {
      setStatus("Copy was unavailable. You can read tonight’s prompt directly from this card.");
    }
  }

  return <section className="parent-learning-diary">
    <header className="parent-diary-head"><span>💙</span><div><small>DAILY DIARY · ACCOUNTABILITY · GROWTH PROOF</small><h2>Today with {child.name}</h2><p>{latest ? `${latest.subject} · ${latest.chapter}` : "Waiting for the first explicit learning proof"}</p></div><b>LOCAL-ONLY</b></header>
    <div className="parent-diary-counts"><span><b>{proofs.length}</b><small>completed proofs</small></span><span><b>{pendingCount}</b><small>pending quests</small></span><span><b>{reviewedCount}</b><small>teacher reviewed</small></span><span><b>{helpSignals}</b><small>help signals</small></span><span><b>{earnedCoins}</b><small>earned shop coins</small></span></div>
    <section className={`parent-tonight-coach ${homeAction ? "ready" : "waiting"}`} aria-label="Tonight in eight minutes">
      <header><span aria-hidden="true">🌙</span><div><small>ZAPPY PARENT AI · ONE CALM ACTION</small><h3>{homeAction?.title || "Tonight’s action unlocks after real learning"}</h3><p>{homeAction?.contextLine || `Waiting for ${child.name}’s first submitted learning proof`}</p></div><b>{homeAction ? "8 MIN" : "PROOF FIRST"}</b></header>
      {homeAction ? <><blockquote>{homeAction.prompt}</blockquote><ol>{homeAction.steps.map(step => <li key={step}>{step}</li>)}</ol><footer><small>🛡️ {homeAction.evidenceNote}</small><button onClick={copyHomePrompt}>COPY TONIGHT’S PROMPT →</button></footer></> : <div className="parent-tonight-waiting"><p>Zappy will build one small home conversation from actual submitted work—not a guessed score, generic trend, or guilt reminder.</p><button onClick={onOpenSource}>OPEN TODAY’S SOURCE</button></div>}
    </section>
    {!latest ? <div className="parent-diary-empty"><span>📖</span><div><b>No learning proof yet</b><p>Zappy will not invent a score, study time, streak, or mastery claim. Ask your child to complete a real teacher side quest first.</p><button onClick={onOpenSource}>OPEN TODAY’S SOURCE</button></div></div> : <div className="parent-diary-body">
      <section className="parent-diary-source-recap"><small>LATEST VERIFIED ACTIVITY</small><h3>{latest.chapter}</h3><p>{latest.studentName} explicitly submitted {latest.answers.length} answer(s) with {latest.sourceProofCount} source citation(s).</p><div><span>⭐ {latest.selfCheck["got-it"]} got it</span><span>🌱 {latest.selfCheck.almost} almost</span><span>🛟 {latest.selfCheck["needs-help"]} need help</span></div><em>{latest.review ? "Teacher reviewed: " + latest.review.summary : "Awaiting human teacher review · no score shown"}</em><small>{latest.sourceAuthority} · {latest.sourceEdition}</small><small>{latest.teacherName} · {compactLocalTime(latest.submittedAt)}{latest.late ? " · submitted late" : ""}</small></section>
      <section className="parent-diary-compose"><small>YOUR OBSERVATION</small><label>What did {child.name} say or notice?<textarea maxLength={10_000} value={childResponse} onChange={event => setChildResponse(event.target.value)} placeholder="Write the child’s own words or question."/></label><label>What should we revisit next?<textarea maxLength={10_000} value={nextAction} onChange={event => setNextAction(event.target.value)} placeholder="One calm next action—not another score."/></label><button onClick={saveDiary}>SAVE TODAY’S DIARY NOTE →</button></section>
    </div>}
    {entries.length > 0 && <details className="parent-diary-timeline"><summary>Recent parent notes <span>{entries.length}</span></summary><div>{entries.slice(0, 5).map(entry => {
      const proof = proofs.find(item => item.id === entry.proofId);
      return <article className="parent-diary-entry" key={entry.id}><small>{proof ? `${proof.subject} · ${proof.chapter}` : "Saved learning proof"}</small><b>“{entry.childResponse}”</b><p>Next: {entry.nextAction}</p><em>{compactLocalTime(entry.updatedAt)}</em></article>;
    })}</div></details>}
    {latest && <details className="parent-letter-assistant"><summary>✉️ Draft a teacher letter from this context</summary><div><p>Zappy uses only this child’s latest local proof. Nothing is sent automatically.</p><textarea maxLength={10_000} value={letter} onChange={event => setLetter(event.target.value)} aria-label="Editable letter to teacher"/><button onClick={copyLetter}>COPY REVIEWED DRAFT →</button></div></details>}
    {status && <p className="parent-diary-toast" role="status">{status}</p>}
  </section>;
}
