# Changelog

All notable changes to VERA are recorded here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/) (`0.x` until the defense release `1.0.0`).

**Rules**
- Every PR adds a line under **Unreleased** in the right group: Added, Changed, Fixed, Removed, Security, Database.
- Reference the roadmap task or PRD requirement: `- Apply endpoint with prescreen and matching (P4.3, FR-APP-02..07)`.
- On release, rename **Unreleased** to `[x.y.z] — YYYY-MM-DD` and start a new empty **Unreleased**.
- Suggested versions: `0.2.0` after Phase 0–1, `0.3.0` after Phase 2–3, `0.4.0` after Phase 4–5, `0.5.0` after Phase 6–7, `0.6.0` after Phase 8–9, `1.0.0` after Phase 10.

---

## [Unreleased]

### Added
- Solo 7-day sprint plan (Oct 7–13) in `docs/ROADMAP.md`: slices S1–S18, daily gates, cut order, demo-script definition of done, deferred list, tips for one Claude account. PRD §8, CLAUDE.md (sprint mode), CONTRIBUTING.md, and GETTING_STARTED Step 4 updated.
- `CLAUDE.md` with project context and rules for Claude Code.
- Documentation set in `docs/`: PRD, TRD, DATABASE_SCHEMA, APP_FLOW, ROADMAP.
- Aligned database schema `supabase/migrations/20261006000000_initial_schema.sql` and `supabase/seed.sql` (not yet applied).
- `docs/ALGORITHM.md`: SBERT + cosine matching and WSM scoring explained step by step, algorithm registry, worked example, defense walkthrough and Q&A.
- `scripts/algo-map.mjs` (`pnpm algo:check | algo:map | algo:snippets`) and the `VERA-ALGO[ID] BEGIN/END` marker convention for highlighting algorithm code; first markers on `final_evaluation` (FIN-01).
- `docs/UI_GUIDELINES.md` (DESIGN.md tokens → Tailwind/shadcn, status tones, navigation, page → mockup map, reconciliation) and `docs/DESIGN.md` (draft UI design system).
- `docs/test-cases.md` (TC-01..72 mapped to PRD requirements).
- `.env.example` for api, web, svc; `.claude/` settings and commands (`/task`, `/done`, `/algo`, `/migration`); `CONTRIBUTING.md`; PR template; `.vscode/` Todo Tree highlighting for `VERA-ALGO`.
- svc joins `pnpm dev` and `pnpm test`: `scripts/run-py.mjs` (runs the venv python on any OS), `apps/svc/package.json` (`dev`/`test`), `apps/svc/requirements.txt` (runtime + test deps) (S2, P0.3).
- `packages/shared` (`@vera/shared`): roles, statuses, document and notification types mirroring the SQL enums, plus HR/applicant labels and badge tones (S3, P0.4).
- API foundation (S3, P0.6/P0.7): zod-validated `config/env.js`, `db/pool.js`, `db/tx.js` `withTransaction(actorId, fn)` (sets `vera.actor_id`), `lib/errors.js` + `errorHandler` (`{ error: { code, message, details? } }`), `validate`, `notFound`, helmet, CORS to `WEB_ORIGIN`, pino logging (auth headers redacted, no query strings).
- `authenticate` (Supabase token → `user_account`; inactive → 403) and `requireRole(...roles)`; `GET /api/me` and `GET /api/health` (db + svc) (S3, FR-AUTH-01/08).
- `pnpm --filter api seed:admin` creates or updates the admin and one HR account (idempotent; replaces the User Management UI during the sprint) (S3, P1.5).
- api tests (vitest + supertest, mocked db/Supabase): auth, roles (TC-10), inactive account (TC-09 API part), errors, validate, health, transactions, env, and an `@vera/shared` ↔ SQL enum drift check.
- Web shell (S4, P0.8): UI_GUIDELINES tokens in `index.css` (Roboto; Montserrat only for the login tagline; no dark theme), `cn` = `twMerge(clsx())`, themed shadcn components (44px controls, 4px radius) + badge, table, skeleton, sonner, dropdown-menu, sheet, avatar, separator.
- Web auth (S4, P1.1, FR-AUTH-01/02/03/08): `lib/supabase.js` remember-me storage, `lib/apiClient.js` (`ApiError`, sign-out on 401), react-query, `AuthProvider`/`useAuth`/`useMe`; guards `RequireAuth` (deactivated → signed out with message), `RequireRole`, `RequireProfile`; Login page wired to Supabase with role redirect via `GET /api/me`; `/auth/callback`.
- VERA shell: `AuthLayout` (58/42 brand split), `AppShell` with navy sidebar (drawer below 1200px) and header (page context, bell, avatar, name + role, account menu); route map from APP_FLOW §1 with placeholder pages naming their slice.
- Shared components: `PageHeader`, `StatusBadge` (labels/tones from `@vera/shared`), `EmptyState`, `ScoreChip` (`null` → "Not evaluated"), `DataTable` (TanStack Table: sorting, pagination, loading/empty/no-match/error), `FullPageSpinner`.
- web tests (vitest + Testing Library): remember-me storage (TC-05 logic), role redirect (TC-04 logic), apiClient, LoginForm, route guards, StatusBadge/ScoreChip.

- svc `POST /extract` (TRD §8): sections, skills/experience text, years of experience, auto-filled `profile` (address line, education level, height in cm, ISO birthdate), warnings; camelCase (S5, P2.1, FR-PROF-02/03).
- svc `POST /match`: scores stored sections against a job with applicant-type weights; `matchScore` 0–100 (2 decimals), sub-scores, `matchedSkills` / `missingSkills` (MAT-05), skill and experience matches, `modelName` (S5, P4.1c, FR-APP-04, BR-04).
- Algorithm: explicit `cosine_similarity_matrix` (COS-01), `explain` (MAT-05), model name from `SBERT_MODEL` (SBERT-01, default all-MiniLM-L6-v2), EXT-04 profile normalization in `app/extractors/profile.py` (S5, P4.1a/b).
- svc tests: worked example through the matcher and the endpoint (TC-69: 79.31 / 87.50), cosine properties (TC-68), real-model paraphrase checks (TC-70, skipped without the cached model), merged date ranges (TC-71), profile/education rules, `/extract` and `/match` endpoints.

- Applicant sign-up page (`/signup`): email, password rules (FR-AUTH-02), confirm, Data Privacy Act consent (`user_metadata.privacy_consent_at`) → Supabase confirmation link; "Check your email" state that never reveals existing accounts (S6, P1.2 simplified, FR-AUTH-06).
- `/auth/callback` handles implicit `#access_token` and PKCE `?code=`; falls back to "Your email is confirmed. Please log in."; PKCE code verifiers always stored in `localStorage` so the link works in a new tab (S6).
- `POST /api/applicant/resume/parse` (svc `/extract` → draft in `resumes/drafts/<userId>/…`, pre-filled profile) and `POST /api/applicant/profile/confirm` (file moved to `resumes/<applicantId>/…`; applicant + resume + resume_extraction in one transaction; draft deleted; file moved back on failure) (S6, P2.2–P2.4, FR-PROF-01..04).
- api: `lib/svcClient.js` (internal key, 60 s timeout, svc 400 → readable 400, otherwise 503), `lib/storage.js`, `middleware/upload.js` (PDF only, 10 MB, `%PDF` signature), rate limit 20/min on parse (`express-rate-limit`), Multer errors in `errorHandler`.
- web: `/applicant/setup` (dropzone → "Reading your resume…" → editable pre-filled profile card with computed age → Confirm profile), shared `FileDropzone` (from legacy `ResumeUpload`), `features/profile/ProfileForm` (from legacy `ProfileInformation`), shared `FieldError`, `lib/format.ageFrom`.
- Tests: api parse/confirm/svcClient (TC-11, TC-13), web sign-up (TC-03), FileDropzone (TC-11), Setup (TC-12, TC-13), AuthCallback, remember-me code-verifier storage.

- Applicant profile view/edit: `GET`/`PATCH /api/applicant/profile` (same schema as confirm, email never changed); dashboard `/applicant` with `ProfileCard` (read-only view → Edit profile → Save changes / Cancel) and an empty applications panel (S7, P2.5, FR-PROF-05, TC-15).
- My Documents `/applicant/documents`: Resume tab (current resume) and Supporting documents tab; `GET`/`POST /api/applicant/documents`, `GET /api/applicant/documents/:id/url`, `GET /api/applicant/resume` + `/url` (signed URLs, 10 min, ownership checked); upload/re-upload dialog with type, label, replace note, and `FileDropzone` (S7, P2.6, FR-DOC-01/02/04, TC-18, TC-19).
- One current document per type (certificate/other may have several; replaced via Re-upload), old rows kept as not current; `MULTI_DOCUMENT_TYPES` in `@vera/shared` (PRD FR-DOC-04).
- View opens a blank tab synchronously in the click, then points it at the signed URL (pop-up blockers); on failure the tab closes and a toast explains.
- `/api/me` returns the applicant's name (first + last) as `fullName`; the header shows it.
- web: shadcn `tabs` (underline style) and `dialog` themed; `lib/format` `formatBytes` / `formatDateTime` (Asia/Manila); `ProfileForm` read-only mode.
- Tests: api profile edit, documents (upload/replace/re-upload/validation/rollback/signed URLs), resume view; web ProfileCard, Documents (incl. pop-up-safe View), format.

- Company Management (S8, P3.1, FR-COMP-01..03): `/api/admin/*` area (admin + HR); `GET/POST /api/admin/companies` (name search, pagination), `GET/PATCH /api/admin/companies/:id` (five summary counts per PRD FR-COMP-03; statuses passed from `@vera/shared`); duplicate names → `409 CONFLICT` on `companyName` (TC-21).
- web `/admin/companies`: searchable table (debounced, TC-22), Add/Edit company dialog with Company information and Contact person groups incl. website (TC-20), URL-driven detail drawer `/admin/companies/:id` with counts and contact person; shadcn `textarea`; `hooks/useDebounce`.
- Tests: api companies (roles TC-10, search, create/edit, conflict, counts, validation); web Companies (list, search, empty/no-match, add, duplicate, drawer, edit).

- Vacancies (S9, P3.3–P3.5, FR-VAC-01/03/05/07, BR-01..03): `GET /api/admin/competencies`; `GET /api/admin/vacancies/defaults` (from `system_setting`); list/search with remaining slots and stage counts; create/edit drafts with competency weights in one transaction; publish/close/reopen/archive under a row lock (`domain/vacancyStatus.js`); edit lock after publishing (posting text + higher cap only); reopen blocked at the cap unless HR raises it.
- web: `/admin/vacancies` cards (company, status, slots remaining, stage counts; search + status filter), `/admin/vacancies/new` and `/:id/edit` form (Company & position · Job description · Requirements · Qualifications · Pipeline settings · Competency weights with live total; cap follows slots × 8), `/admin/vacancies/:id` detail with status actions (confirm dialogs; Reopen offers "Raise the application cap") and a Ranking placeholder tab; shared `ConfirmDialog`.
- Tests: api vacancyStatus + vacancies (TC-23, TC-24, TC-25, edit lock, reopen at cap); web VacancyForm (TC-23, TC-24, lock), list + detail (TC-25, reopen at cap). Web test timeout 15 s for form-heavy tests under the parallel `pnpm test`.

- Applicant job list (S10, P3.6, FR-VAC-04, BR-16): `GET /api/applicant/vacancies` (open only, title search) and `/:id` (404 when not open), explicit column allow-list with no company columns or join (TC-26) and no age/gender requirement (RA 10911); web `/applicant/jobs` (2-column cards, search, states) and `/applicant/jobs/:vacancyId` (description, qualifications = skills, years, education, height; key responsibilities; experience; Apply disabled "Applications open soon" until S11).
- Tests: api public vacancies (open-only, TC-26, no age/gender, 404, roles); web Jobs list + detail (TC-26 UI, age/gender hidden, Apply disabled, no-longer-open).

- **S9b Competency Profile rubric:** 3 sections / 15 items each rated 1–5 (`@vera/shared` `COMPETENCY_SECTIONS`, `RATING_INTERPRETATIONS`, `SUCCESS_PROBABILITY_BANDS`, `successProbabilityFor`); vacancies weight the 3 sections (total 100%, 0% allowed); `GET /api/admin/competencies` grouped by section; vacancy API/form/detail reworked to `sectionWeights` (live total, publish needs 100, edit lock unchanged); two-level WSM-01 and WSM-02 overall rating documented (ALGORITHM.md §4–§6 new worked example: 77.50, rating 4, 78.41 / 82.50); PRD FR-VAC-01, FR-INT-06, BR-06, §5.1; test-cases TC-23, TC-48.
- Tests: competency rubric (migration and seed vs `@vera/shared`, WSM-02 thresholds, band boundaries, migration guard and RLS); vacancy section weights (create/replace, 0% section, TC-23, unknown/duplicate section); web VacancyForm and detail with sections.

- **S11 apply flow, API part** (FR-APP-01..07, FR-VAC-07, BR-01/04/05/11/12/14): `POST /api/applicant/applications` `{ vacancyId, applicantType }` → prescreen → svc `/match` with the stored `resume_extraction.sections` and the type's weights (before the transaction) → threshold → one transaction under the vacancy row lock (application + `matching_result` + notification, shortlist refresh, auto-close at the cap). 409 when there is no profile, no readable resume, a duplicate application, or "Applications for this job just closed." (the cap filled or the vacancy closed while matching ran). 20 req/min per IP. `GET /api/applicant/applications` for the status panel (never company, `status_reason`, or scores).
- Domain: `prescreen.js` (`VERA-ALGO[RANK-01]`), `shortlist.js` (`VERA-ALGO[RANK-02]`: score rounded once to hundredths half-up and stored, threshold on the stored value, ranking by matching desc / applied_at asc / application_id asc, locked slots never displaced, moves recorded as system with reason "shortlist refresh"), `statusMachine.js` (APP_FLOW §5.1 `ALLOWED` map, initial statuses, stale-read-safe `transition`), `notify.js`, `round.js`; svc client `matchResume`.
- `@vera/shared`: `MATCHING_WEIGHTS` and `resolveMatchingWeights(applicantType, vacancy)` (`VERA-ALGO[MAT-04]`, first-time 1/0, experienced 0.5/0.5; skills only 1/0 for every type when the vacancy has no experience criterion, i.e. blank experience text and 0 minimum years, because the svc scores an empty experience requirement as 1.0 and would give experienced applicants a free 50-point floor; PRD BR-04 / FR-APP-04, ALGORITHM.md MAT-03/MAT-04; svc `_coverage` unchanged), applicant next action (`next`) on `APPLICATION_STATUS_LABELS` (APP_FLOW §6), notification type `shortlist_displaced` (sent when a higher score moves a shortlisted applicant back to the waiting pool, since "Under review" → "Application received" is visible to them).
- Notifications API: `GET /api/notifications?limit=` (own feed + `unreadCount`, every role) and `POST /api/notifications/read-all`.
- Tests: prescreen (TC-30), statusMachine, shortlist (TC-35, TC-36, 39.995 boundary, tie-break, system attribution), applications (TC-10, TC-27, TC-28..34 API side, cap race, svc down, unique-index race, rate limit, weights by experience criterion), `resolveMatchingWeights`, notifications, svc client `/match`, qualified cap count.
- `pnpm --filter api seed:demo` (`apps/api/scripts/seed-demo.js` + `demo-data.js`, run after `seed:admin`): demo companies Kabayan Mart → Cashier (ages 18–35, min height 150 cm, four cashier skills and retail experience wording, A 30 / B 30 / C 40, slots 2 / cap 16) and ClayGo → Store Crew (ages 18–35, any gender, senior high, min height 150 cm, four store-crew skills and experience wording, 0 years, A 20 / B 80 / C 0, slots 1 / cap 8 / endorsement 1), both open. Published by the seeded HR user, validated with the company and vacancy form schemas; insert-only (existing rows never changed). Setup order in GETTING_STARTED Step 4; ROADMAP §5 step 1 and test-cases standard data use the new Cashier and Store Crew wording (svc worked-example tests unchanged).
- `supabase/scripts/reset-applications.sql` (demo resets only, not a migration): deletes one vacancy's notifications, matching results, status history and applications in one transaction.
- `supabase/scripts/delete-demo-vacancies.sql` (demo only, not a migration): deletes Cashier (Kabayan Mart) and Store Crew (ClayGo) with their applications' dependent rows, applications, endorsements, pool invitations and section weights in one transaction; companies kept; refuses (rolls back) unless each vacancy exists exactly once.
- **S11b — one ongoing application, company block** (agency decision Oct 7; PRD BR-17..BR-22, FR-APP-08/09, FR-INT-08; decision-support wording in PRD §1): apply refuses with 409 while the applicant has an ongoing or hired application (re-checked under an applicant row lock; the new unique index answers simultaneous applies) and with 404 "This job is not available for your application." at a company where they have a failed application; the applicant job list and detail leave those vacancies out (`domain/eligibility.js`, only `job_vacancy.company_id` compared). Web: ongoing-application notice on the job list and detail, Apply disabled with the reason.
- `@vera/shared`: `NOT_SELECTED` status and pool reason, `APPLICATION_OUTCOME` (ongoing / hired / failed / neutral), `BLOCKS_APPLYING_STATUSES`; every final status except hired has the next action "You can apply to other jobs".
- Tests: TC-73 (API + UI), TC-74, TC-75 (list, detail, apply), TC-76, TC-77, TC-82 (API + UI), TC-83, re-checks under the lock; state machine (no terminate, close-out moves, finals frozen); enum drift test reads `add value` from every migration and checks the outcome classes against the index predicate.
- **S11 apply flow, web part** (FR-APP-01/02/06, FR-PROF-08, FR-NOTIF-01 simplified): job detail **Apply** → `ApplyDialog` (rebuilt from the legacy ApplicationModal/Header/Actions; one required radio *First-time job seeker* / *Experienced*, react-hook-form + zod, "Checking your qualifications…" while matching runs, result shown as the applicant stage label + message, never a score); already applied → disabled **Applied** with the current stage (TC-34). Dashboard `StatusPanel` (job, type, applied date, APP_FLOW §6 label, next action + deadline) and `RecentNotifications`; `/applicant/notifications` and `/admin/notifications` page with **Mark all as read**; header bell shows the real unread count (only when > 0).
- web: shadcn `radio-group` (base-ui), themed 20px circle in a 44px hit area. The CLI also tried to add an unrelated npm package `cn` for a broken import; removed, the component imports `cn` from `@/lib/utils`.
- Tests: web ApplyDialog (TC-29, result, refusal toast), StatusPanel (labels, shortlisted next action, empty, error), Notifications page + bell, job detail Apply / Applied (TC-34 UI); api notification templates (neutral shortlist wording, no company).

### Database
- Migration `20261008000000_one_ongoing_application.sql` (S11b, agency decision Oct 7; applied to Supabase Oct 7): `application_status` + `not_selected` and `pool_reason` + `not_selected`; partial unique index `application_one_ongoing_per_applicant` (one ongoing-or-hired application per applicant, BR-17); comment on `final_evaluation.ratings_source_application_id` (rating reuse resolves to the original interview, BR-21). Refuses to run while an applicant has more than one ongoing application. Outcome classes and verification queries in DATABASE_SCHEMA §4 / §7.
- Migration `20261007000000_competency_profile_rubric.sql` (S9b): `competency_section` (A/B/C), `competency.section_id`, `job_section_weight` with the deferred total-0-or-100 trigger; existing `job_competency` weights summed into sections (Communication + Teamwork → A, Problem Solving + Adaptability → B, Work Experience + Technical Skills → C) and `job_competency` dropped; the 6 old competencies replaced by the 15 items; `final_evaluation.section_scores` (jsonb) and generated `overall_rating` (1–5, `VERA-ALGO[WSM-02]`); refuses to run if `competency_rating` has rows. Verification queries in DATABASE_SCHEMA §7; applied to Supabase and verified Oct 7 (A 3 / B 9 / C 3, worked example 77.50, rounding 78.41, overall rating 4, Cashier A 30 / B 30 / C 40). `supabase/seed.sql` seeds the same sections and items.
- `company.website` added; competency seed aligned with the mockup list (Communication, Problem Solving, Work Experience, Technical Skills, Teamwork, Adaptability).
- Initial schema and seed applied to Supabase by hand and verified: 24 tables, 6 competencies, 5 settings, 2 auth triggers (S1, P0.5).

### Changed
- Docs for the **planned automatic rematch after a client rejection** (agency decision Oct 7; built in S16/S17, no code or migration yet): PRD BR-23, FR-END-10, FR-END-07 and FR-POOL-02/03 rewritten, BR-20/BR-21 exceptions, decision-support wording (VERA suggests, HR offers, the applicant decides, the client hires); APP_FLOW §3.7 flow diagram with the no-svc-inside-a-transaction rules (rescan after the not_hired commit; a failed accept commits the cancellation before rescanning; close-out only cancels candidates and returns applicant ids for rescans after commit) and concurrency rules (one running rescan per applicant → 409, run set to failed in a finally block, earlier live offers superseded, accept locks applicant + vacancy rows), §4.6, §5.1 start at for_endorsement; DATABASE_SCHEMA planned `rematch_run` / `rematch_candidate`; ALGORITHM RANK-04 (planned for S17) with the Juan → Store Crew 78.34 example and the RANK-02 rematch exclusion; TRD offer/suggestion endpoints and notification types; test-cases TC-81 rewritten, TC-85..98 added; ROADMAP S16/S17, cut order with the limbo fallback (a failed rescan creates the pool entry if the Rescan button is cut), §5 Juan via rematch, §6 manual HR invitations and `/match/batch` deferred.
- RANK-02: the shortlist refresh counts every application of the group (the talent-pool exclusion is gone; PRD BR-21 puts reuse and invited applicants through shortlisting). State machine: no "→ terminated" (BR-17 leaves nothing to terminate), new close-out moves to `not_selected` (BR-22), only prescreen_failed / below_threshold / waiting_pool as starting statuses (BR-20) (S11b).
- Docs for the agency process change: PRD BR-10 and FR-INT-04 removed, FR-POOL-02..04 rewritten (S17 marked "to be revised"), D3 obsolete; APP_FLOW §3.2 / §3.6 / §4.2 / §5.1 / §6; DATABASE_SCHEMA §6.2 / §6.6; ALGORITHM RANK-02 and new WSM-03 (planned, S14) with the Store Crew reuse example (76.67 / 78.34); TRD apply errors, reuse endpoint, `reusableEvaluation`; test-cases TC-73..84 (TC-44 / 62 removed, TC-60 / 61 revised); ROADMAP rescheduled with S11b and Juan's story in §5, "release a hired applicant" deferred; UI_GUIDELINES `not_selected` row (S11b).
- Shortlisted next action shows "Wait for the agency to review your application" until S12 adds document requests (`@vera/shared`, APP_FLOW §6 note). Reopen dialog, vacancy detail and the API reopen error say "Qualified applications (N) have reached the cap of M." (S11).
- Apply with no readable resume → 409 "We could not read your resume details. Please contact Confiable Manpower so we can update your resume." (no re-parse screen in the sprint) (S11).
- `refreshShortlist` restores `vera.actor_id` in a `finally` (transaction-local `set_config(…, true)`); a failing restore never hides the original error (S11).
- The application cap counts **qualified** applications only (all statuses except `prescreen_failed` / `below_threshold`); the reopen check and the vacancy detail `applicationCount` use the same count (PRD FR-APP-07, FR-VAC-07, BR-02; decided Oct 7) (S11).
- ALGORITHM.md: RANK-01 and RANK-02 `implemented` with their rules written out; MAT-04 lists the shared weights; §5 rounding applies to RANK-02. TRD §5/§6.1/§6.2/§9 updated; ALGORITHM_INDEX.md / ALGORITHM_CODE.md regenerated (S11).
- Applicant screens never show a vacancy's age range or gender requirement (RA 10911); still enforced at apply time. UI_GUIDELINES §9 updated (S10).
- web tests: Testing Library async wait 5 s (`src/test/setup.js`) so `findBy*` tolerates the parallel `pnpm test` (S10).
- EXT-02 standardization also maps `point-of-sale` / `point of sale` → `POS` and is applied to job text in `/match`: all-MiniLM-L6-v2 scores "POS system operation" vs "point-of-sale terminal" only ≈ 0.22 (no credit) but vs "POS terminal" ≈ 0.65. TC-70 and ALGORITHM.md §8 now use "Cash handling" vs "Handled cash" as the paraphrase example (S5).
- Education level auto-fill: old-curriculum "High School" → `senior_high` (PRD FR-PROF-02); degree abbreviations and SHS strands count only inside the education section and never as "MS Office/Excel…" (S5).
- ALGORITHM.md: EXT-04, COS-01, MAT-05 now `implemented`; §5 documents `SBERT_MODEL` and the abbreviation map; ALGORITHM_INDEX.md / ALGORITHM_CODE.md regenerated (S5).
- Applicant-facing status labels aligned: APP_FLOW §6 wording with "applicant pool" (UI_GUIDELINES §4.1 updated to match).
- `pnpm-workspace.yaml` includes `packages/*`; api `dev` watches only `src/`; api `test` runs vitest.
- `VERA-ALGO[ID]` marker comments added around the existing extraction and matching code in `apps/svc` (EXT-01..04, MAT-01..04, SBERT-01/02, COS-01/02). Comments only; no behavior change. `pnpm algo:check` passes (P0.10).
- Root `package.json`: `dev`, `test`, `algo:check`, `algo:map`, `algo:snippets` scripts.
- `.gitignore`: commit shared `.vscode/settings.json`; ignore personal `.claude/settings.local.json`, Python caches, and `.turbo/`.
- Root `README.md` and `docs/GETTING_STARTED.md` (VS Code + Claude Code setup and first sessions).
- Repo hygiene (P0.2): `.gitattributes` enforces LF (binary assets marked, Windows scripts CRLF); `turbo.json` adds a `test` task and `build` outputs; README lists the daily commands.
- Root `dev/build/lint/test` scripts use `pnpm -r` instead of turbo (Windows Smart App Control blocks the unsigned `turbo.exe`); `dev:turbo` / `test:turbo` kept as opt-in. README, CLAUDE.md, TRD §13, PRD, ROADMAP P0.3, GETTING_STARTED, CONTRIBUTING updated (P0.2).

### Removed
- Legacy `jobVacancies/Application/*` (ApplicationModal, ApplicationHeader, ApplicationActions, ResumeUpload) and `dashboard/RecentNotifications.jsx` (rebuilt in S11); `UpcomingInterview.jsx` stays for S13. The S11 "Notifications" placeholders are replaced by the real page (S11).
- Legacy `JobVacancies` page and `jobCards/*` (rebuilt in S10); the legacy `Application/*` dialog stays for S11 (S10).
- Legacy `ApplicantDashboard`, `MyDocuments`, `DocumentTable`, `UploadDocumentModal` (rebuilt in S7) (S7).
- Legacy `ApplicantSetup` page, `ResumeUpload`, and `ProfileInformation` (rebuilt in S6) (S6).
- svc prototype endpoints `/process-resume` and `/match-resume` and `app/matchers/matching.py` (replaced by `/extract` and `/match`) (S5).
- web: old `/api/auth` login form, `ProtectedRoute`, `lib/api.js`, per-page sidebar/header, `styles/global.css` + `styles/login.css`, `cn` and Inter packages. Remaining mock applicant UI moved to `apps/web/src/legacy/` (unrouted) (S4).
- Legacy api prototype code: mock routes/controllers/services, `POST /api/auth`, old applicant profile/resume routes (queried dropped columns), `database/*`, old auth/role middleware. Web login is rewired to Supabase in S4; resume upload returns in S6 (S3).
- Per-app `apps/api/pnpm-lock.yaml` and `apps/web/pnpm-lock.yaml`; the root lockfile is the only one (P0.2).
- Tracked Python bytecode (`apps/svc/**/__pycache__/*.pyc`) removed from git; already ignored (P0.2).

### Fixed
- Docs: the FIN-01 comment in the applied `20261006000000_initial_schema.sql` still described the old interview formula (`SUM(weight_i * rating_i / 5)`), which appears in `ALGORITHM_CODE.md`; it now points to the two-level WSM-01 formula in `20261007000000_competency_profile_rubric.sql`. Comment-only change; no effect on the database (S9b).
- web: `pnpm lint` passes. Removed unused `onCancel` prop binding, unused `MyDocuments` state setters and unused `React` imports in `ui/card|input|label`; ESLint allows the shadcn `buttonVariants` export and gives `*.config.js` Node globals. No behavior change (P0.2 follow-up).

### Security
- The API `.env` file was included in a shared zip. Supabase secret key and database password rotated (S1, P0.1).
- svc requires `X-Internal-Key` on every endpoint except `/` and `/health` (401 on a wrong/missing key, 503 when `SVC_INTERNAL_KEY` is not configured) and listens on `127.0.0.1`; the legacy api resume call sends the key and uses `SVC_URL` (S2, P0.9).

---

## [0.1.0] — 2026-10-04

Initial prototype (branches `master`, `frontend-changes`, `backend-changes`).

### Added
- pnpm + Turborepo monorepo with `apps/web`, `apps/api`, `apps/svc`.
- **web:** React 19 + Vite + Tailwind 4 + shadcn/ui; login page with branding panel; applicant Setup, Dashboard (profile card, upcoming interview, recent notifications), Job Vacancies (list + details modal + application modal), and My Documents (resume and supporting tabs, upload modal) — UI with mock data.
- **web:** login against the API, token stored locally, `ProtectedRoute`, redirect to setup when the applicant has no profile.
- **api:** Express 5 modular backend; `pg` pool and Supabase client; `POST /api/auth` login via Supabase; `authenticate` and `authorizeRole` middleware; `GET /api/applicant/profile/status`, `GET /api/applicant/profile`; `POST /api/applicant/resume` proxy to the microservice.
- **svc:** FastAPI service with PDF validation, column-aware text extraction (PyMuPDF), cleaning, standardization, regex personal-info extraction (name, email, phone, birthdate, age, gender, height, city, province), section splitting, SBERT (`all-MiniLM-L6-v2`) skills/experience matching with years-of-experience rules (`/process-resume`, `/match-resume`), pytest suite, and NER training pipeline (Label Studio → BIO → transformer fine-tuning).
- **database:** `user_account` and `applicant` tables in Supabase.
