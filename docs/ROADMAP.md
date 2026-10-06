# VERA — Roadmap

> Build order for the whole system. Each phase ends in something you can demo.
> Tick boxes as tasks merge. `[x]` done · `[~]` partly done in the current code · `[ ]` not started.
> Task IDs (e.g. `P2.3`) go in commit messages and Claude prompts.

---

## How to build with Claude Code

1. Start every session with: **"Read CLAUDE.md, then docs/ROADMAP.md. We are doing task `P<phase>.<n>`."**
2. Ask for a **plan first** (plan mode / "propose the plan, don't code yet"). Check it against the PRD/TRD before approving.
3. One task per session/branch (`feat/p2-3-profile-confirm`). Small PRs are easier to review and to explain at your defense.
4. Claude must: write/adjust tests, run `pnpm test` and `pnpm lint`, update `CHANGELOG.md` (Unreleased) and tick the task here.
5. If a rule is unclear or the docs conflict, Claude should **stop and ask** rather than guess, then the answer gets written into the PRD.
6. Schema changes = a **new** file in `supabase/migrations/` + update `docs/DATABASE_SCHEMA.md` in the same PR.

**Prompt template**
```
Read CLAUDE.md and docs/ROADMAP.md. Task P4.2: implement POST /api/applicant/applications.
Follow PRD FR-APP-02..07, DATABASE_SCHEMA §6.1–6.2, TRD §3.3 module pattern and §5 domain files.
Propose a plan with the files you will create/change and the tests you will add. Wait for my OK.
```

---

## Current state (from the uploaded code, 2026-10-04)

| Area | Status |
|---|---|
| Monorepo (pnpm + turbo) | `[~]` workspace exists; no root `dev` script; svc not in turbo; per-app lockfiles |
| Login UI | `[~]` screen built; login via custom `POST /api/auth`; remember me / forgot / Google not wired |
| Role redirect | `[~]` applicant only; no admin routes |
| Applicant pages | `[~]` Dashboard, Setup, Job Vacancies, My Documents UIs built with mock data |
| API | `[~]` auth middleware, role middleware, profile status/profile endpoints, resume → svc proxy; mock routes to delete |
| Algorithm markers | `[x]` `VERA-ALGO` blocks on all existing extraction and matching code; `pnpm algo:check` passes |
| svc | `[~]` PDF validation, column-aware extraction, cleaning, regex profile entities, sections, SBERT matching (`/process-resume`, `/match-resume`), tests, NER training pipeline |
| Database | `[~]` `user_account`, `applicant` (old columns) |
| Admin side | `[ ]` |

---

## Phase 0 — Clean structure and foundation  *(≈ 3–4 days)*

- [ ] **P0.1** Rotate the Supabase secret key and DB password; copy the kit's `.env.example` files for api, web, svc; confirm `.env` is ignored.
- [x] **P0.2** Repo hygiene: delete per-app `pnpm-lock.yaml`; add `.gitattributes` (LF); root scripts `dev/build/lint/test` + `algo:check/map/snippets`; update `turbo.json`; add `!.vscode/settings.json` to `.gitignore`; write root `README.md`; commit the kit's `.claude/`, `.github/`, `.vscode/`, `CONTRIBUTING.md`.
- [ ] **P0.3** svc in turbo: `scripts/run-py.mjs`, `apps/svc/package.json`, `apps/svc/requirements.txt`; `pnpm dev` starts web + api + svc.
- [ ] **P0.4** `packages/shared` (`@vera/shared`): roles, application/vacancy/interview statuses, applicant-facing labels (APP_FLOW §6), document types, notification types; consumed by web and api.
- [ ] **P0.5** Database: apply `supabase/migrations/20261006000000_initial_schema.sql` + `seed.sql` to a clean project (DATABASE_SCHEMA §7).
- [ ] **P0.6** API skeleton: `config/env.js` (zod), `db/pool.js` (`DATABASE_URL`, SSL), `db/tx.js` (`withTransaction` + `vera.actor_id`), `lib/errors.js`, `errorHandler`, `notFound`, `validate`, helmet, CORS, pino; delete mock routes/controllers/services (TRD §3.2).
- [ ] **P0.7** API auth: `authenticate` (no PII logs, loads role/status), `requireRole(...roles)`, `GET /api/me`, `GET /api/health` (db + svc).
- [ ] **P0.8** Web skeleton: `lib/supabase.js` (remember-me storage), `lib/apiClient.js`, react-query provider, sonner, `cn` fix, design tokens + Roboto + themed shadcn components (UI_GUIDELINES §1–3), `AuthLayout` / `ApplicantLayout` / `AdminLayout` with `<Outlet/>` and the reconciled navigation (UI_GUIDELINES §5), guards `RequireAuth` / `RequireRole` / `RequireProfile`, route map from APP_FLOW §1 with placeholder pages, shared components from UI_GUIDELINES §4 (`PageHeader`, `StatusBadge`, `EmptyState`, `DataTable`).
- [ ] **P0.9** svc hardening: `X-Internal-Key` dependency, env config, listen on 127.0.0.1.
- [x] **P0.10** Algorithm markers: add `VERA-ALGO` blocks to the existing svc code for every `implemented`/`partial` step in ALGORITHM.md §2 (EXT-01..04, MAT-01..04, SBERT-01/02, COS-01 inline, COS-02); `pnpm algo:check` passes; generate `docs/ALGORITHM_INDEX.md`.

**Done when:** `pnpm dev` runs all three apps, `/api/health` reports db + svc OK, the web app routes to placeholder pages by role in the VERA shell, and `pnpm algo:check` passes.

---

## Phase 1 — Authentication and accounts  *(≈ 3 days)*

- [~] **P1.1** Login page wired to Supabase: email/password, validation, remember me, errors, role redirect via `/api/me` (FR-AUTH-01..03, 08).
- [ ] **P1.2** Sign-up + 6-digit code verification + resend + privacy consent (FR-AUTH-06). Configure the Supabase email template and SMTP.
- [ ] **P1.3** Forgot / reset password (FR-AUTH-04).
- [ ] **P1.4** Google sign-in + `/auth/callback` (FR-AUTH-05).
- [ ] **P1.5** `seed:admin` script (TRD §7.3).
- [ ] **P1.6** Admin User Management: list/create/deactivate HR (FR-AUTH-07) — API + page.

**Done when:** an applicant can register with a code, log in (remembered or not), reset the password, and use Google; the admin can create an HR account that lands on `/admin`.

---

## Phase 2 — Applicant profile, resume, documents  *(≈ 5 days)*

- [~] **P2.1** svc `POST /extract` (TRD §8): reuse existing pipeline; add `addressLine`, `educationLevel`, `heightCm`, `yearsExperience`; camelCase response; tests.
- [ ] **P2.2** `POST /api/applicant/resume/parse`: upload to `resumes/drafts/…`, call svc, upsert `resume_draft`, return prefilled profile.
- [ ] **P2.3** `POST /api/applicant/profile/confirm`: transaction creates `applicant`, moves file, inserts `resume` + `resume_extraction`, deletes draft.
- [~] **P2.4** Setup page: dropzone → parsing state → editable profile card (shadcn form, zod) → confirm (FR-PROF-01..04).
- [~] **P2.5** Dashboard profile card (view/edit) wired to `GET/PATCH /api/applicant/profile` (FR-PROF-05).
- [~] **P2.6** My Documents: upload/list/view supporting documents with type; signed URLs (FR-DOC-01, 02, 04).
- [ ] **P2.7** Resume replacement with active-application lock and profile diff review (FR-PROF-06, 07).

**Done when:** a new applicant uploads a PDF, sees the auto-filled card, confirms, and finds the resume and documents in My Documents.

---

## Phase 3 — Companies, competencies, vacancies  *(≈ 4 days)*

- [ ] **P3.1** Companies API + Company List page (search, add/edit panel) + detail with stats (FR-COMP-*).
- [ ] **P3.2** Competencies API + admin page (fixed list).
- [ ] **P3.3** Vacancy API: create/edit draft with competencies + weights (100% check), publish/close/reopen/archive (FR-VAC-01, 03, 07).
- [ ] **P3.4** Vacancy form page (sections: details, requirements, prescreen, pipeline, competencies) with live weight total.
- [ ] **P3.5** Admin vacancy list + detail shell (FR-VAC-05).
- [~] **P3.6** Applicant Job Vacancies list + detail from `GET /api/applicant/vacancies` — agency-branded, search (FR-VAC-04).

**Done when:** HR creates a company and a vacancy with weights, publishes it, and an applicant sees it without the company name.

---

## Phase 4 — Applying, prescreen, matching, waiting pool  *(≈ 5 days)*

- [ ] **P4.1a** Matcher unit tests **first** (no behavior change): `test_similarity.py`, `test_matcher_math.py` (worked example, ALGORITHM.md §6, with injected similarities), `test_rules.py`.
- [ ] **P4.1b** Refactor `app/matchers/algorithm.py` into `chunking.py`, `embedding.py`, `similarity.py`, `coverage.py`, `experience.py`, `scoring.py` (ALGORITHM.md §2 target locations); explicit `cosine_similarity_matrix` (COS-01); markers moved; tests still green.
- [~] **P4.1c** svc `POST /match` and `/match/batch` from stored sections; first-time = skills only, experienced = 50/50 with min years; `matchedSkills` / `missingSkills` (MAT-05).
- [ ] **P4.2** `domain/prescreen.js` (`VERA-ALGO[RANK-01]`), `domain/statusMachine.js` (+ unit tests).
- [ ] **P4.3** `POST /api/applicant/applications` (FR-APP-02..07): prescreen → match → threshold → `waiting_pool` → cap check → shortlist refresh; one-per-job; notifications.
- [ ] **P4.4** `domain/shortlist.js` `refreshShortlist` (`VERA-ALGO[RANK-02]`) with row lock and slot locking rules (DATABASE_SCHEMA §6.2) + tests.
- [ ] **P4.5** Apply dialog (radio button) and applicant **status panel** on the dashboard (APP_FLOW §3.5, §6).
- [ ] **P4.6** In-app notifications API + bell/feed (FR-NOTIF-01).

**Done when:** applicants apply, get prescreened and scored instantly, and the top 2 × slots per group are marked `shortlisted`.

---

## Phase 5 — Resume screening and document requests  *(≈ 4 days)*

- [ ] **P5.1** Screening API: vacancies list, shortlist per group, application detail with matching details.
- [ ] **P5.2** Verification endpoints (resume, documents); first action sets `verification_started_at`.
- [ ] **P5.3** Document requests with reason + deadline; applicant Requests tab; fulfillment on upload (FR-SCR-04, FR-DOC-03).
- [ ] **P5.4** Scheduled job runner (`node-cron`, `JOBS_ENABLED`) + `expire-document-requests` → `dropped` → refill (FR-SCR-05).
- [ ] **P5.5** Screening pages: vacancy picker, Experienced / First-time tabs, applicant review drawer, Schedule button gating (FR-SCR-06).
- [ ] **P5.6** Pull next applicant (open decision D1).

**Done when:** HR verifies a shortlist, requests a document, and an expired request drops the applicant and pulls in the next one.

---

## Phase 6 — Interviews and evaluation  *(≈ 5 days)*

- [ ] **P6.1** Schedule / reschedule (max 2) / no-show API; `confirm_due_at` (FR-INT-02, 03, 05).
- [ ] **P6.2** Applicant confirm / reschedule request; on confirm terminate other active applications and refill their slots (FR-INT-04).
- [ ] **P6.3** Jobs: `expire-interview-confirmations`, `send-interview-reminders` (FR-INT-07).
- [ ] **P6.4** `domain/scoring.js` (`VERA-ALGO[WSM-01]`, `[FIN-01]`; worked-example tests) + `POST /api/admin/applications/:id/evaluation` (rate all active competencies; `final_evaluation`) (FR-INT-06).
- [ ] **P6.5** Interview Assessment page (combined list, schedule dialog, evaluate dialog with live score preview); applicant interview pop-up.

**Done when:** an interview is scheduled, confirmed, evaluated, and the applicant becomes `passed` or `did_not_pass` with correct scores.

---

## Phase 7 — Ranking, notify, endorsement, outcomes  *(≈ 5 days)*

- [ ] **P7.1** Final ranking API (`VERA-ALGO[RANK-03]`) + vacancy detail ranking tab with `ScoreBreakdownDialog` (FR-VAC-06, FR-END-01).
- [ ] **P7.2** Notify (editable message) → `passed_awaiting_confirmation` with `action_due_at`; applicant confirm/decline; job `expire-endorsement-confirmations` (FR-END-03, 04).
- [ ] **P7.3** Endorsement generation: per-applicant PDF profile (pdfkit) + XLSX summary (exceljs) → storage; preview/download (FR-END-05).
- [ ] **P7.4** Send endorsement email with attachments (Nodemailer); vacancy → `endorsing`; remaining `passed` → `standby` + pool (FR-END-06).
- [ ] **P7.5** Record outcomes (hired / not hired) → pool; vacancy `filled` when hired = slots (FR-END-07, 09).
- [ ] **P7.6** Post-hiring details form + send; training failed → pool (FR-END-08).
- [ ] **P7.7** `did_not_pass` → pool on evaluation (FR-END-02).

**Done when:** a full vacancy runs from posting to `filled`, with an endorsement email received by the company address.

---

## Phase 8 — Talent pool  *(≈ 3 days)*

- [ ] **P8.1** Talent pool API + page (filters, ratings, availability) (FR-POOL-01).
- [ ] **P8.2** Invitations (email + in-app, deadline job) (FR-POOL-02).
- [ ] **P8.3** Pool application path: skip screening/interview when verified, reuse latest ratings with new weights, missing-rating prompt (FR-POOL-03, 04; D3).
- [ ] **P8.4** Find matches in talent pool for a vacancy via `/match/batch` (FR-VAC-02).

**Done when:** a pooled applicant is invited, applies, and lands directly in the final ranking with a recomputed score.

---

## Phase 9 — Dashboards, management, notifications, settings  *(≈ 4 days)*

- [ ] **P9.1** HR dashboard counts + upcoming interviews (FR-ADM-01).
- [ ] **P9.2** Applicant Management list/detail with status timeline and documents ZIP download (FR-ADM-02).
- [ ] **P9.3** Email outbox job + templates for every emailable type (TRD §9); HR alerts (FR-NOTIF-02, 03).
- [ ] **P9.4** Settings page (deadlines/defaults) (FR-ADM-03).
- [ ] **P9.5** Company detail stats and vacancy counts polish.
- [ ] **P9.6** *(optional)* Recruitment Reports page from mockup HR p.31: date/company filters, pipeline bar chart, outcome donut, vacancy table, PDF/Excel export.

**Done when:** every PRD requirement has a working screen.

---

## Phase 10 — Quality, evaluation, release  *(≈ 5 days)*

- [ ] **P10.1** `docs/test-cases.md`: system test cases TC-xx mapped to FR-xx; run and record results (thesis Table 2).
- [ ] **P10.2** Integration tests for each module (permissions included); fix defects.
- [ ] **P10.3** Algorithm evaluation: extraction P/R/F1, Spearman ρ vs HR ranking, and tuning of `LOW`/`HIGH` on the labeled set (svc `training/` scripts); record results in ALGORITHM.md §5.
- [ ] **P10.4** Security checklist (TRD §14), performance check (PRD §6), accessibility pass.
- [ ] **P10.5** Deployment (e.g. web on Vercel/Netlify, api + svc on a small VM/Render; Supabase cloud) and UAT with agency staff (ISO/IEC 25010 survey).
- [ ] **P10.6** Release `v1.0.0` in CHANGELOG; update Chapter 3 diagrams (ERD, DFD, use case) to match this schema.
- [ ] **P10.7** Defense prep: `/algo` review passes, `pnpm algo:snippets` handout printed, rehearse the ALGORITHM.md §7 walkthrough and §8 questions, worked-example tests run live.

---

## Later (post-defense)

- DOCX and image resumes (OCR), analytics/reports, audit-log viewer, bulk actions, applicant mobile polish.
