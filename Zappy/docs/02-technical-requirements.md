# Zappy — Technical Requirements Document

## 1. Current baseline and target architecture
Current prototype: TypeScript, React 19, Next-compatible Vinext/Vite frontend, CSS, local browser storage and Cloudflare-compatible API routes. Production target: TypeScript monorepo with a React/Next web app, Node.js backend/API services, PostgreSQL, object storage, asynchronous workers and a provider-agnostic LLM gateway.

## 2. Required services
| Service | Responsibility |
| --- | --- |
| Web application | role dashboards, daily loops, staff/admin UI |
| API | authenticated business operations and RBAC |
| Auth/identity | passwordless/email/phone or SSO, guardian verification, sessions |
| Curriculum ingestion | collect, parse, version, validate and index licensed sources |
| Retrieval/AI gateway | source-grounded generation, moderation, caching, audit logs |
| Assessment service | quizzes, submissions, mastery, adaptive recommendation |
| Notification service | email/push/WhatsApp only with consent and controls |
| Media service | safe uploads, transcode, consent, retention and deletion |
| Commerce service | catalogue, inventory, coin ledger, order/approval flow |

## 3. Backend API requirements
- REST or typed RPC endpoints, versioned under `/api/v1`.
- All requests authenticated except public auth callbacks/health checks.
- Tenant derived from session/server context, never trusted from a browser field.
- Authorization enforced in middleware and repository/service layer.
- Idempotency keys for coin awards, orders, assignment publishing and notifications.
- Cursor pagination; strict input schemas; consistent errors with correlation ID.
- Audit events for content changes, exports, predictions, guardian links, communication and role changes.

## 4. AI and data grounding
- Use an LLM gateway with provider abstraction, model/version logging, timeout/retry, rate limits and costs per tenant.
- Retrieval uses approved curriculum chunks and past-paper records filtered by board, grade, subject, year and permission.
- Every AI factual answer returns citations to stored source IDs; if evidence is absent, respond with a transparent limitation and recommended next action.
- Do not use NotebookLM as a backend dependency; it is not a general production API. Build owned retrieval/indexing instead.
- Question prediction requires a documented statistical model, held-out validation, confidence calibration and a clear “not a guarantee” label.
- Child prompts and output pass safety moderation. Never expose another student’s data in context.

## 5. Security and privacy
- Encrypt transport (TLS) and data at rest; secrets in a managed secret store.
- Password hashes using Argon2id; secure httpOnly sessions, CSRF protection and MFA for admins.
- Role/tenant isolation tests for every data-access path.
- Data minimisation; consent ledger; guardian controls; export/delete workflow; configurable retention.
- Camera/microphone features are off by default, clearly consented, and recordings are private by default.
- Rate limiting, WAF, dependency scanning, backups and disaster-recovery runbook.

## 6. Quality, observability and operations
- Unit, integration, API authorization, accessibility and end-to-end tests.
- Automated test data fixtures for each board/version but no unlicensed content in repository.
- Structured logs with redaction, metrics/traces, error reporting, uptime/health checks.
- CI: lint, typecheck, tests, build, migration validation, dependency/security scans.
- Environment separation: local, preview, staging, production; no production data in non-production.

## 7. Performance and compatibility
- P95 API reads <500ms excluding AI; cached curriculum search <300ms.
- AI request shows progressive status and supports cancellation; fallback never invents an answer.
- Responsive Chrome/Safari/Firefox and Android/iOS browsers; baseline low-bandwidth content mode.

## 8. Implementation choices to decide before production
- Hosting: Cloudflare (Workers/D1/R2) or Node runtime (e.g., managed container + PostgreSQL). Choose one primary data path; do not split critical data across ad-hoc stores.
- AI provider(s), vector store approach, notification provider, payment/fulfilment model, data residency and legal counsel for children’s data.
