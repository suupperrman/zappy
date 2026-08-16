# Zappy — App Flow Document

## 1. Entry and onboarding
1. User opens Zappy and signs in.
2. System resolves tenant, role and permissions.
3. If new: choose/join school; admin verifies roster; parent links child via verified invitation; user confirms board, grade, subjects and learning stage.
4. Show role-specific daily loop home. If curriculum is unavailable, show coverage status and an honest fallback rather than fake topic content.

## 2. Teacher flow
```text
Sign in → Daily Teaching Loop → choose assigned class
→ accept/change recommended topic → lesson preparation
→ review script/material/questions → generate/edit quiz
→ publish assignment → teach → mark taught/reflection
→ student results & risk view → next-day recommendation
```
Teacher can detour to: Classroom, Exam Intelligence, Student Tracking, Curriculum Library, Exports and Settings. Returning preserves the draft.

### Lesson preparation flow
1. Select board, academic edition, class, subject and module.
2. Validate source coverage.
3. Display period plan, objectives, script, materials and cited important questions.
4. Teacher edits anything; changes are saved as a lesson draft.
5. Generate a quiz from approved question templates/source material.
6. Choose recipients/schedule, preview as student, publish.
7. At completion, record what was actually taught and schedule recommendation.

## 3. Student flow
```text
Sign in → Today’s Learning Loop → Start
→ recap teacher topic → playful learn activity → practice/quiz
→ confidence check → coins + progress → clear finish
→ “next up” preview or exit
```
Student can choose independent learning by board/class/subject only from covered content. Assignments have a due date and finite completion state. Student may ask AI for an explanation, example, recap or help; AI cites material and cannot impersonate a teacher or publish assignments.

## 4. Parent flow
```text
Sign in → Child switcher → Today’s Family Loop
→ evidence diary → review assignment/mastery/routine
→ choose 8-minute support action → acknowledge/remind
→ optional AI letter draft → review → send to teacher
```
The parent sees only linked children. The “letter to teacher” cannot send until parent reviews/edits and confirms.

## 5. Exam Intelligence flow
1. Choose board, edition, class, subject, exam type and time range.
2. Browse verified syllabus, papers and question bank.
3. Filter by chapter/learning outcome.
4. Build practice sheet or teacher quiz.
5. If prediction data is validated, show evidence, years, method and calibrated likelihood; otherwise show “insufficient verified corpus.”
6. Export a selected, cited pack as PDF/DOCX/CSV with generated-at date and source appendix.

## 6. Skills Arena flow
1. Pick skill and competition scope: class, school or global.
2. Read challenge, rubric, consent and safety guidance.
3. Practice in mirror mode or submit permitted artifact.
4. Receive rubric feedback and private improvement drill.
5. Complete round, earn eligible coins and optionally join leaderboard.

## 7. System recommendation flow
Nightly/triggered job reads teaching completion, assignment results, student confidence and curriculum sequence. It recommends a next learning object, logs the reason/evidence, respects user schedule and notification preferences, and never uses engagement time as the primary optimization target.

## 8. Failure states
- No source coverage: show exact gap and request/import workflow.
- Offline: allow cached plan/view only; queue safe actions.
- AI unavailable: show cited source content and retry; no invented output.
- Permission failure: show role-safe explanation and route to admin/guardian.
