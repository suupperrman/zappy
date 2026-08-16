# Zappy — Backend Schema Document

## 1. Conventions
Use PostgreSQL UUID primary keys, `created_at`, `updated_at`, soft deletion where needed, UTC timestamps, and `tenant_id` on all tenant-owned tables. Apply database row-level security or equivalent repository-enforced tenant predicates. JSONB is for flexible AI payloads only, not relational facts.

## 2. Identity and tenancy
| Table | Key fields |
| --- | --- |
| tenants | id, name, type, status, board_defaults |
| users | id, email/phone, display_name, auth_state, consent_version |
| memberships | id, tenant_id, user_id, role, status |
| schools | id, tenant_id, name, address, board_affiliations |
| classes | id, tenant_id, school_id, academic_year, grade, section, board_id |
| teacher_class_assignments | id, tenant_id, teacher_membership_id, class_id, subject_id |
| student_enrolments | id, tenant_id, student_membership_id, class_id |
| guardian_links | id, tenant_id, guardian_membership_id, student_membership_id, verified_at |

## 3. Curriculum and provenance
| Table | Key fields |
| --- | --- |
| boards | id, country, state, name, code |
| curriculum_versions | id, board_id, academic_year, edition, status, source_id |
| subjects | id, board_id nullable, name, code |
| curriculum_nodes | id, version_id, parent_id, node_type, grade, subject_id, title, sequence, estimated_minutes, source_id, review_status |
| sources | id, publisher, title, url, file_object_key, licence, published_year, checksum, imported_at |
| source_chunks | id, source_id, curriculum_node_id, content, page_ref, embedding_ref, reviewer_status |
| past_papers | id, board_id, class_grade, subject_id, exam_type, year, source_id, verified_at |
| questions | id, source_id, curriculum_node_id, text, answer, marks, question_type, verified_at |
| question_occurrences | question_id, past_paper_id, page_ref, normalized_match_confidence |

## 4. Learning and teaching
| Table | Key fields |
| --- | --- |
| lesson_plans | id, tenant_id, class_id, teacher_id, node_id, scheduled_for, status, source_snapshot |
| lesson_plan_blocks | id, lesson_plan_id, type, position, content, duration_minutes, citations |
| assignments | id, tenant_id, class_id, author_id, title, due_at, status |
| assignment_items | id, assignment_id, question_id nullable, content, position, points |
| submissions | id, assignment_id, student_id, submitted_at, score, status |
| submission_items | id, submission_id, assignment_item_id, response, is_correct, feedback |
| mastery | id, tenant_id, student_id, node_id, state, confidence, evidence_count, last_practiced_at |
| daily_loops | id, tenant_id, user_id, role, date, recommended_node_id, status, rationale |
| learning_events | id, tenant_id, actor_id, event_type, node_id, payload, occurred_at |

## 5. AI, recommendations and predictions
| Table | Key fields |
| --- | --- |
| ai_requests | id, tenant_id, user_id, feature, model, prompt_version, input_source_ids, output, safety_state, cost, created_at |
| recommendations | id, tenant_id, user_id, node_id, reason, evidence_ids, rank, delivered_at, acted_at |
| prediction_runs | id, board_id, version_id, class_grade, subject_id, method_version, corpus_cutoff, validation_metrics, status |
| prediction_items | id, run_id, question_id/node_id, likelihood_band, evidence, explanation |

## 6. Skills, rewards and commerce
| Table | Key fields |
| --- | --- |
| skills | id, name, category, age_min, rubric_version |
| skill_challenges | id, skill_id, title, scope, instructions, reward_rule |
| skill_attempts | id, tenant_id, student_id, challenge_id, visibility, consent_id, result, feedback |
| leaderboard_entries | id, scope_type, scope_id, user_alias, score, period |
| coin_ledger | id, tenant_id, student_id, amount, direction, reason, idempotency_key, balance_after |
| products | id, name, category, price_coins, stock, image_key, active |
| orders | id, tenant_id, student_id, guardian_approval_id, status, total_coins |
| order_items | id, order_id, product_id, quantity, unit_price_coins |

## 7. Parent communication, privacy and audit
| Table | Key fields |
| --- | --- |
| parent_diary_entries | id, tenant_id, student_id, date, evidence_event_ids, summary, generated_by |
| teacher_messages | id, tenant_id, sender_id, recipient_id, student_id, draft_content, sent_content, reviewed_at, sent_at |
| consents | id, user_id, child_id nullable, type, version, granted_at, revoked_at |
| media_assets | id, tenant_id, owner_id, consent_id, storage_key, visibility, expires_at, deleted_at |
| notifications | id, tenant_id, user_id, type, channel, payload, scheduled_at, sent_at, read_at |
| audit_events | id, tenant_id, actor_id, action, entity_type, entity_id, before_json, after_json, ip_hash |

## 8. Critical indexes/constraints
- Unique memberships `(tenant_id, user_id)`; enrolment `(student_membership_id, class_id)`.
- Curriculum unique `(version_id, parent_id, sequence)`; source checksum unique.
- Past paper unique `(board_id, class_grade, subject_id, exam_type, year, source_id)`.
- Coin ledger unique `(tenant_id, idempotency_key)`; never update historical ledger amounts.
- Index all tenant/date/user/task lookup paths and full-text/vector index `source_chunks`.
