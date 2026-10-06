# Contributing to VERA

Team: Malicia, Peralta, Valleser, Visto. These rules keep four people and Claude Code working on one repo without breaking each other's work.

## 1. First-time setup
1. Clone, then `pnpm install` at the root (never inside an app; there is one lockfile).
2. Copy each `.env.example` to `.env` (`apps/api`, `apps/web`, `apps/svc`) and ask the team lead for values. Never commit or zip `.env` files.
3. Python: `cd apps/svc && python -m venv .venv && .venv\Scripts\pip install -r requirements.txt` (macOS/Linux: `.venv/bin/pip`).
4. `pnpm dev` → web http://localhost:5173 · api http://localhost:5000 · svc http://localhost:8000.
5. VS Code: install the recommended extensions (prompt appears). Todo Tree highlights every `VERA-ALGO` block.
6. `.gitignore` must contain `!.vscode/settings.json` so the shared highlight settings are committed.

## 2. Branches
- `main` is always runnable. No direct pushes; merge by pull request.
- One branch per roadmap task: `feat/p4-3-apply-endpoint`, `fix/login-redirect`, `docs/algorithm-tuning`, `chore/p0-2-repo-hygiene`.
- Rebase on `main` before opening the PR; delete the branch after merge.

## 3. Commits
Conventional commits with IDs:
```
feat(applications): P4.3 prescreen and matching on apply (FR-APP-03, FR-APP-04)
fix(screening): keep locked slots when refreshing shortlist (BR-12)
docs(algorithm): document LOW/HIGH tuning results
db: add company.website
```
Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `db`, `style`.

## 4. Working with Claude Code
- Start: `/task P4.3`. Read the plan, check it against the docs, then approve.
- Finish: `/done` (tests, lint, `algo:check`, changelog, roadmap tick, commit message).
- Schema change: `/migration <what>`. Algorithm review: `/algo` or `/algo COS-01`.
- Claude must not invent business rules. If the docs are silent or conflict, decide as a team and write the decision into `docs/PRD.md` first.
- Read every diff Claude produces before committing. You will be asked about this code at the defense.

## 5. Algorithm code (defense-critical)
- Every matching and scoring step is wrapped in `VERA-ALGO[ID] BEGIN … END` (see `docs/ALGORITHM.md` §3).
- Changing a formula or parameter = update `docs/ALGORITHM.md` §4–§6, the unit tests, and the CHANGELOG in the same PR.
- `pnpm algo:check` must pass before merge.

## 6. Pull requests
- Use the PR template; link the roadmap task.
- At least **one teammate** reviews; anything touching `apps/svc/app/matchers`, `apps/api/src/domain`, or `supabase/migrations` needs **two** (one should be the algorithm owner).
- CI/local checks: `pnpm test`, `pnpm lint`, `pnpm algo:check`.
- Screenshots for UI changes (desktop + 360 px).

## 7. Code ownership (suggested)
| Area | Owner | Backup |
|---|---|---|
| `apps/svc` (extraction, SBERT, cosine) | | |
| `apps/api` domain + pipeline | | |
| `apps/web` HR side | | |
| `apps/web` applicant side + auth | | |
| `supabase/` schema, docs, testing | | |
