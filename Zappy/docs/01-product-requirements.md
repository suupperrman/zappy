# Zappy — Product Requirements Document

## 1. Product definition
Zappy is a multi-tenant learning platform for Indian school education. It gives teachers an AI-supported daily teaching loop, students a playful daily revision and independent-learning loop, and parents a clear daily account of learning, accountability, and growth. It serves LKG through Class 12 across Karnataka, Kerala, Tamil Nadu, Telangana state boards, CBSE, and ICSE.

## 2. Product goals
- Make a teacher's next class preparation fast, source-backed, and useful.
- Turn school learning into a short, motivating student practice loop at home.
- Give parents trustworthy evidence of learning and simple ways to support it.
- Reward meaningful learning with coins redeemable in a stationery shop.
- Build a safe, skill-focused competition system from classroom to Zappy-wide.

## 3. Users and tenancy
| Role | Primary job | Scope |
| --- | --- | --- |
| School admin | Onboard school, users, classes and board configuration | school |
| Teacher | Prepare, teach, assign, review and track students | assigned classes |
| Student/child | Learn, revise, play curriculum games and build skills | self |
| Parent | See child progress, support routines, contact teachers | linked children |

Every record must have `tenant_id` (school/workspace) and role-based access checks. Parent accounts may link to multiple children; a child may have multiple verified guardians.

## 4. Core experience requirements

### 4.1 Teacher daily teaching loop
On opening the app, show one calm summary: tomorrow/today's assigned class, board, subject, recommended chapter/topic, why it is due, estimated preparation/teaching time, and a single “Prepare class” action. Teacher can accept, change chapter, or choose another assigned class.

Preparation must provide:
1. verified syllabus/module and textbook context;
2. lesson periods split into topic-sized chunks;
3. copy-ready classroom script and learning objective;
4. explanation, activity, material and in-app approved video/media links;
5. important-question list with source, year, frequency and only evidence-backed confidence;
6. editable quiz generator and assignment delivery;
7. completion/reflection that schedules the next step.

The teacher dashboard retains quick class snapshot, student risk alerts, assignments and exam workspace without hiding the daily loop.

### 4.2 Student daily learning loop
Student landing page is a Duolingo-style, finite path—not an endless game. It has one recommended 10–20 minute session, visible progress, a clear finish state, celebration, confidence check, coins and the unlocked next topic. The loop revises what the teacher taught, adapts from responses, and allows independent stage selection.

Learning activities: explanation cards, retrieval questions, short quizzes, curriculum games, review cards and topic mastery. Student AI can explain, recommend, recap and guide but cannot create or send class quizzes on the teacher’s behalf.

### 4.3 Parent daily family loop
Parent home shows per child: today’s learning, completed work, confidence signal, teacher assignments, streak/routine, growth evidence and one small “Tonight in 8 minutes” action. Parents can read an AI-generated, evidence-cited summary, set reminders, acknowledge work and create/send a teacher message from an editable template. No unsupported performance claims.

### 4.4 Exam intelligence
For teachers and students, exam workspace provides current syllabus versions, question banks, annual/semester papers, filters by board/class/subject/year/chapter, practice sets and export. A prediction is displayed only when the underlying past-paper corpus, matching method and evidence are available; show likelihood bands and sources, never “99% guaranteed” or fabricated historic frequency.

### 4.5 Skills Arena
Skills Arena teaches and measures practical skills: public speaking, vlogging/presentation, communication, creativity and confidence. It provides guided challenges, consent-based camera/microphone practice mirror, rubric feedback, age-safe exemplars and finite challenge rounds. Rankings are selectable by class, school or Zappy-wide and default to privacy-protective aliases. Users may opt out of global competition.

### 4.6 Rewards and shop
Award coins for completed, quality-checked learning—not merely time online. Shop lists stationery, designer bags, pens, pencils and similar items with price, stock, fulfilment state and parental approval rules. Coins are ledger-based and cannot be edited from the client.

## 5. Curriculum content requirements
- Canonical hierarchy: board → academic year/version → grade → subject → book → chapter → topic → learning object.
- Store source URL/file, publisher, edition/year, licence/rights, extraction status and reviewer status for every curriculum object.
- Support LKG–12 and named boards progressively. A board/grade must never appear “complete” unless source coverage is actually verified.
- Content shown in Zappy must be embedded or licensed for use; external links are optional, not required for core learning.
- Maintain annual syllabus changes and superseded editions.

## 6. Non-functional product requirements
- Mobile-first; usable at 320px width and desktop.
- WCAG 2.2 AA target; keyboard, focus, contrast, captions/transcripts and reduced motion.
- Fast: landing interactive within 3s on a typical Indian 4G connection for cached content.
- All loops have clear exit/finish states and no manipulative engagement patterns.
- Children’s privacy and guardian consent are mandatory before profiles, media capture or public rankings.

## 7. Success metrics
- Teacher: weekly prepared lessons, time-to-ready lesson, assignment completion, teacher satisfaction.
- Student: completed finite loops, retrieval improvement, voluntary return rate, mastery—not raw watch time.
- Parent: weekly summary opens, acknowledged actions, positive teacher contact rate.
- Content: verified coverage percentage by board/grade/subject and source freshness.

## 8. Assumptions and boundaries
- Phase 1 starts with source-verified coverage rather than claiming all six boards/LKG–12 are already imported.
- Schools provide roster, assignments and curriculum/board configuration during onboarding.
- AI supports teachers; it must not be marketed as a replacement for licensed teachers or as a guarantee of exam questions.
