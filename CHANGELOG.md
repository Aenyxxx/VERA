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

### Database
- `company.website` added; competency seed aligned with the mockup list (Communication, Problem Solving, Work Experience, Technical Skills, Teamwork, Adaptability).
- Initial schema and seed applied to Supabase by hand and verified: 24 tables, 6 competencies, 5 settings, 2 auth triggers (S1, P0.5).

### Changed
- Applicant-facing status labels aligned: APP_FLOW §6 wording with "applicant pool" (UI_GUIDELINES §4.1 updated to match).
- `pnpm-workspace.yaml` includes `packages/*`; api `dev` watches only `src/`; api `test` runs vitest.
- `VERA-ALGO[ID]` marker comments added around the existing extraction and matching code in `apps/svc` (EXT-01..04, MAT-01..04, SBERT-01/02, COS-01/02). Comments only; no behavior change. `pnpm algo:check` passes (P0.10).
- Root `package.json`: `dev`, `test`, `algo:check`, `algo:map`, `algo:snippets` scripts.
- `.gitignore`: commit shared `.vscode/settings.json`; ignore personal `.claude/settings.local.json`, Python caches, and `.turbo/`.
- Root `README.md` and `docs/GETTING_STARTED.md` (VS Code + Claude Code setup and first sessions).
- Repo hygiene (P0.2): `.gitattributes` enforces LF (binary assets marked, Windows scripts CRLF); `turbo.json` adds a `test` task and `build` outputs; README lists the daily commands.
- Root `dev/build/lint/test` scripts use `pnpm -r` instead of turbo (Windows Smart App Control blocks the unsigned `turbo.exe`); `dev:turbo` / `test:turbo` kept as opt-in. README, CLAUDE.md, TRD §13, PRD, ROADMAP P0.3, GETTING_STARTED, CONTRIBUTING updated (P0.2).

### Removed
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
