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
- `CLAUDE.md` with project context and rules for Claude Code.
- Documentation set in `docs/`: PRD, TRD, DATABASE_SCHEMA, APP_FLOW, ROADMAP.
- Aligned database schema `supabase/migrations/20261006000000_initial_schema.sql` and `supabase/seed.sql` (not yet applied).
- `docs/ALGORITHM.md`: SBERT + cosine matching and WSM scoring explained step by step, algorithm registry, worked example, defense walkthrough and Q&A.
- `scripts/algo-map.mjs` (`pnpm algo:check | algo:map | algo:snippets`) and the `VERA-ALGO[ID] BEGIN/END` marker convention for highlighting algorithm code; first markers on `final_evaluation` (FIN-01).
- `docs/UI_GUIDELINES.md` (DESIGN.md tokens → Tailwind/shadcn, status tones, navigation, page → mockup map, reconciliation) and `docs/DESIGN.md` (draft UI design system).
- `docs/test-cases.md` (TC-01..72 mapped to PRD requirements).
- `.env.example` for api, web, svc; `.claude/` settings and commands (`/task`, `/done`, `/algo`, `/migration`); `CONTRIBUTING.md`; PR template; `.vscode/` Todo Tree highlighting for `VERA-ALGO`.

### Database
- `company.website` added; competency seed aligned with the mockup list (Communication, Problem Solving, Work Experience, Technical Skills, Teamwork, Adaptability).

### Changed
- `VERA-ALGO[ID]` marker comments added around the existing extraction and matching code in `apps/svc` (EXT-01..04, MAT-01..04, SBERT-01/02, COS-01/02). Comments only; no behavior change. `pnpm algo:check` passes (P0.10).
- Root `package.json`: `dev`, `test`, `algo:check`, `algo:map`, `algo:snippets` scripts.
- `.gitignore`: commit shared `.vscode/settings.json`; ignore personal `.claude/settings.local.json`, Python caches, and `.turbo/`.
- Root `README.md` and `docs/GETTING_STARTED.md` (VS Code + Claude Code setup and first sessions).
- Repo hygiene (P0.2): `.gitattributes` enforces LF (binary assets marked, Windows scripts CRLF); `turbo.json` adds a `test` task and `build` outputs; README lists the daily commands.
- Root `dev/build/lint/test` scripts use `pnpm -r` instead of turbo (Windows Smart App Control blocks the unsigned `turbo.exe`); `dev:turbo` / `test:turbo` kept as opt-in. README, CLAUDE.md, TRD §13, PRD, ROADMAP P0.3, GETTING_STARTED, CONTRIBUTING updated (P0.2).

### Removed
- Per-app `apps/api/pnpm-lock.yaml` and `apps/web/pnpm-lock.yaml`; the root lockfile is the only one (P0.2).
- Tracked Python bytecode (`apps/svc/**/__pycache__/*.pyc`) removed from git; already ignored (P0.2).

### Security
- The API `.env` file was included in a shared zip. Supabase secret key and database password must be rotated (P0.1).

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
