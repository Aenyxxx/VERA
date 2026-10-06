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

### Database
- `company.website` added; competency seed aligned with the mockup list (Communication, Problem Solving, Work Experience, Technical Skills, Teamwork, Adaptability).
- Initial schema and seed applied to Supabase by hand and verified: 24 tables, 6 competencies, 5 settings, 2 auth triggers (S1, P0.5).

### Changed
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
- Legacy `ApplicantDashboard`, `MyDocuments`, `DocumentTable`, `UploadDocumentModal` (rebuilt in S7) (S7).
- Legacy `ApplicantSetup` page, `ResumeUpload`, and `ProfileInformation` (rebuilt in S6) (S6).
- svc prototype endpoints `/process-resume` and `/match-resume` and `app/matchers/matching.py` (replaced by `/extract` and `/match`) (S5).
- web: old `/api/auth` login form, `ProtectedRoute`, `lib/api.js`, per-page sidebar/header, `styles/global.css` + `styles/login.css`, `cn` and Inter packages. Remaining mock applicant UI moved to `apps/web/src/legacy/` (unrouted) (S4).
- Legacy api prototype code: mock routes/controllers/services, `POST /api/auth`, old applicant profile/resume routes (queried dropped columns), `database/*`, old auth/role middleware. Web login is rewired to Supabase in S4; resume upload returns in S6 (S3).
- Per-app `apps/api/pnpm-lock.yaml` and `apps/web/pnpm-lock.yaml`; the root lockfile is the only one (P0.2).
- Tracked Python bytecode (`apps/svc/**/__pycache__/*.pyc`) removed from git; already ignored (P0.2).

### Fixed
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
