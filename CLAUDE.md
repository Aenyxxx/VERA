# CLAUDE.md — VERA

VERA (Verified Evaluation and Recruitment Assistant) is a thesis recruitment system for **Confiable Manpower Solutions Inc.** Applicants upload one resume, apply to agency-branded vacancies, get prescreened and scored (SBERT matching), HR verifies a shortlist, interviews online, rates competencies (Weighted Sum Model), and endorses the best candidates to client companies. Roles: `admin`, `hr`, `applicant`.

## Read before coding
| Need | File |
|---|---|
| What to build, business rules, requirement IDs | `docs/PRD.md` |
| Architecture, folder structure, conventions, endpoints, env | `docs/TRD.md` |
| Tables, enums, key SQL patterns | `docs/DATABASE_SCHEMA.md` + `supabase/migrations/` |
| Screens, routes, flows, state machines | `docs/APP_FLOW.md` |
| What to do next: solo sprint slices S1–S18, demo script, deferred list | `docs/ROADMAP.md` |
| SBERT + cosine matching, WSM scoring, `VERA-ALGO` markers | `docs/ALGORITHM.md` (+ generated `docs/ALGORITHM_INDEX.md`) |
| How screens look (tokens, components, page → mockup map) | `docs/UI_GUIDELINES.md` + `docs/DESIGN.md` |
| Acceptance tests per requirement | `docs/test-cases.md` |
| Team rules (branches, PRs, reviews) | `CONTRIBUTING.md` |
| Setup and daily workflow for humans | `docs/GETTING_STARTED.md` |
| What changed | `CHANGELOG.md` |

## Repo
- `apps/web` — React 19 + Vite + Tailwind 4 + shadcn/ui (base-ui) + lucide-react. Supabase Auth in the browser; all data through the API.
- `apps/api` — Express 5 (ESM JS) + `pg` + Supabase admin client. Feature modules in `src/modules/<feature>/`; business rules in `src/domain/`.
- `apps/svc` — Python FastAPI: PDF extraction + SBERT matching. Internal only (`X-Internal-Key`). Never touches the DB.
- `packages/shared` — `@vera/shared` enums/labels/constants used by web and api.
- `supabase/` — migrations + seed.

## Commands
```bash
pnpm install                 # root only (one lockfile)
pnpm dev                     # web :5173, api :5000, svc :8000 (pnpm -r --parallel)
pnpm test                    # all apps (pnpm -r)
pnpm dev:turbo | test:turbo  # same via turbo, where Windows allows turbo.exe
pnpm lint
pnpm --filter api seed:admin
pnpm --filter api seed:demo   # after seed:admin: Kabayan Mart → Cashier, ClayGo → Store Crew, both open (insert-only)
pnpm --filter svc test       # pytest through the venv
pnpm algo:check              # VERA-ALGO markers vs docs/ALGORITHM.md registry
pnpm algo:map                # regenerate docs/ALGORITHM_INDEX.md
pnpm algo:snippets           # + docs/ALGORITHM_CODE.md (defense handout)
```
Slash commands: `/task <id>` (plan first) · `/done` (finish checklist) · `/algo [id]` (algorithm review) · `/migration <change>`.
Developer machine is **Windows**: use cross-platform scripts (`scripts/run-py.mjs`), LF line endings, `path.join`.

## Non-negotiable rules
1. **Statuses** change only through `apps/api/src/domain/statusMachine.js` (`transition()`); allowed moves are in `docs/APP_FLOW.md` §5. Status strings come from `@vera/shared`, never literals.
2. **Scores:** matching 0–100 from svc; interview = Σ(weight × rating ÷ 5) with weights totalling 100 and ratings 1–5; final = (matching + interview) ÷ 2; passed = final ≥ passing score. First-time = skills only; experienced = 50/50 skills/experience.
3. **Shortlist** = 2 × slots per applicant type, refreshed by `domain/shortlist.js` under a vacancy row lock. Locked slots (`verification_started_at`) are never displaced.
4. **Applicants never see the client company.** Applicant vacancy endpoints must not return company fields.
5. **One current resume** per applicant; replacement blocked during active applications; replacement resets verification. Matching runs from stored `resume_extraction`, never by re-sending the PDF.
6. **Browser never reads app tables.** RLS is on with no policies; only the API (server connection) touches data. Only the publishable key goes to the web app.
7. **Every multi-step write** uses `withTransaction(actorId, fn)` (sets `vera.actor_id` for the status-history trigger). Call the svc **before** opening the transaction.
8. **Schema changes** = new file in `supabase/migrations/` + update `docs/DATABASE_SCHEMA.md`. Never edit an applied migration.
9. **Security:** parameterized SQL only; validate input with zod; role check on every route; no secrets or PII (names, emails, resume text) in logs or commits; files are PDF ≤ 10 MB in private buckets with short signed URLs.
10. **Deadlines** come from `system_setting` (`response_deadline_days`, default 3), not hard-coded.
11. **Algorithm code is highlighted for the thesis defense.** Every matching/scoring step lives inside a `VERA-ALGO[ID] BEGIN … END` block whose ID is in the `docs/ALGORITHM.md` registry; the line after BEGIN states the formula. Keep markers when moving code, never put unrelated code inside a block, run `pnpm algo:check` after any change, and update ALGORITHM.md §4–§6 + tests whenever a formula or parameter changes. Keep this code simple, readable, and commented — the panel will read it.
12. **UI** follows `docs/UI_GUIDELINES.md` (tokens from `docs/DESIGN.md`). Where the mockups and the PRD disagree, the PRD wins (UI_GUIDELINES §9).

## Conventions (details in TRD §4)
- API: `<feature>.routes|controller|service|repository|schemas.js`; JSON camelCase; errors `{ error: { code, message, details? } }`.
- Web: pages in `pages/`, feature code in `features/<feature>/` (react-query hooks in `api.js`), shadcn components in `components/ui/` only, shared UI in `components/shared/`; forms with react-hook-form + zod; loading/empty/error states on every list.
- Files: components `PascalCase.jsx`, others `camelCase.js`, folders lowercase-kebab.
- Commits: conventional + IDs, e.g. `feat(screening): P5.2 lock slot on first verification (FR-SCR-03)`.

## Sprint mode (solo, Oct 7–13, 2026)
- One developer, one Claude account. Work is organized in **slices** `S1`–`S18` in `docs/ROADMAP.md` §4; each slice is built end to end (SQL/API/screen/tests) in one conversation.
- Build the **simplest version that passes the demo script** (ROADMAP §5). Items marked *(simplified)* override longer PRD wording.
- **Never build anything listed in ROADMAP §6 (deferred)**, even if it looks small. Mention it in your summary instead.
- Keep context small: read only the docs sections the slice references; don't scan the whole repo.
- Prefer plain, readable code over abstractions. The algorithm rules (rule 11) still apply in full.

## Workflow for every task
1. Read the task in `docs/ROADMAP.md` and the referenced PRD/TRD sections.
2. **Propose a plan** (files to add/change, tests) and wait for approval.
3. Implement in small steps; keep unrelated files untouched.
4. Add/update tests; run `pnpm test` and `pnpm lint`.
5. Add a line under **Unreleased** in `CHANGELOG.md`; tick the task in `docs/ROADMAP.md`.
6. If the docs conflict or a rule is missing, **stop and ask**. Do not invent business rules; write the answer into the PRD afterwards.

## Known gotchas
- svc downloads the SBERT model on first start if `app/matchers/model/` is empty; preload happens in the FastAPI lifespan.
- Resumes must be text-based English PDFs (no OCR). The svc returns 400 with a readable message otherwise; surface it in the UI.
- Supabase email sign-up creates `user_account` only after the OTP is verified (DB trigger). Google and admin-created users are confirmed immediately.
- Open decisions D1–D4 in `docs/PRD.md` §9 have defaults; do not change them without the team's confirmation.
