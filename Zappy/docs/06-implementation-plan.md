# Zappy — Implementation Plan

## Delivery principle
Ship a trustworthy, narrow pilot first: one school, one board/grade/subject set with fully verified sources, then expand by a repeatable ingestion process. Never launch unverified curriculum or paper claims as if complete.

## Phase 0 — Foundation (1–2 weeks)
- Confirm target pilot school, board, grades, subjects, content rights and privacy/legal requirements.
- Decide production hosting/data stack and authentication provider.
- Define product analytics events and success baseline.
- Deliver: architecture decision record, data protection plan, source inventory, clickable role flows.

## Phase 1 — Secure multi-tenant core (2–4 weeks)
- Implement tenant/user/membership/RBAC, school/class roster, student/guardian links and onboarding.
- Add PostgreSQL migrations, fixtures, audit logs, consent controls and local/staging environments.
- Migrate prototype local-only state to authenticated APIs.
- Acceptance: tenant-isolation integration tests pass; parents cannot access an unlinked child; teacher sees only assigned classes.

## Phase 2 — Curriculum pipeline and library (3–6 weeks)
- Build source uploader/registry, parser/extractor, human review queue, curriculum hierarchy, search and versioning.
- Ingest and verify the pilot scope with book/page citations.
- Acceptance: every surfaced lesson item has a source and reviewed status; coverage dashboard reports gaps honestly.

## Phase 3 — Daily loops (3–5 weeks)
- Teacher: recommendation, lesson planner, source-grounded script, editable quiz and assignment publishing.
- Student: finite playful revision path, practice, confidence check, mastery update, coins.
- Parent: diary, evidence summary, next support action and reviewed teacher message.
- Acceptance: each role completes a full daily loop on mobile; all workflows recover gracefully when AI is unavailable.

## Phase 4 — Grounded AI and exam workspace (3–6 weeks)
- Implement retrieval, prompt templates, citation renderer, moderation, logs and cost controls.
- Add papers/question bank, practice pack builder and export.
- Add prediction research only after corpus quality passes threshold; validate/calibrate against held-out papers.
- Acceptance: no unsupported factual answer is marked as sourced; prediction UI hides when validation is insufficient.

## Phase 5 — Skills Arena and shop (3–5 weeks)
- Launch rubric challenges and class/school leagues; add global scope later behind privacy review.
- Add consent-based mirror practice and safe media lifecycle.
- Implement immutable coin ledger, catalogue, guardian approval and fulfilment ops.
- Acceptance: reward duplication cannot occur; recording deletion works; leaderboard scope is enforced.

## Phase 6 — Quality, pilot and scale (ongoing)
- Accessibility review, security threat model, load testing, content QA, teacher usability sessions and child-safety review.
- Pilot with weekly feedback and measured outcomes; iterate before new-board ingestion.
- Expand board/grade/subject coverage one verified package at a time.

## Cross-cutting work
- CI/CD, monitoring, backups, feature flags, support tooling, translations/localization, analytics privacy, documentation and runbooks begin in Phase 1 and continue throughout.

## Definition of done for every feature
1. Product acceptance criteria met.
2. Tenant/RBAC and privacy impact considered.
3. Responsive and keyboard-tested; WCAG AA checks pass.
4. Loading, empty, error and permission states designed.
5. Tests and telemetry added; feature flag/release notes prepared.
6. AI output is source-cited, safe and can decline honestly.

## Immediate next sprint
1. Lock the Phase 0 decisions and choose the pilot curriculum scope.
2. Implement real authentication, tenant/RBAC and database schema migrations.
3. Replace localStorage learning records with API-backed daily loops.
4. Ingest/review the first curriculum package and wire citations into teacher/student/parent loops.
