# VERA — Verified Evaluation and Recruitment Assistant

NLP-assisted recruitment system for **Confiable Manpower Solutions Inc.** (BS Computer Science thesis, Pambayang Dalubhasaan ng Marilao).
Applicants upload one resume and apply to agency-branded vacancies; VERA prescreens them, scores resume–job fit with **Sentence-BERT + cosine similarity**, lets HR verify a ranked shortlist, scores interviews with the **Weighted Sum Model**, and supports endorsement to client companies and a reusable applicant pool.

## Stack
pnpm + Turborepo monorepo · `apps/web` React 19 + Vite + Tailwind 4 + shadcn/ui · `apps/api` Express 5 + PostgreSQL (Supabase) · `apps/svc` Python FastAPI (PyMuPDF, sentence-transformers) · Supabase Auth and Storage.

## Quick start
```bash
pnpm install                      # at the repo root
# copy apps/api/.env.example, apps/web/.env.example, apps/svc/.env.example to .env and fill them in
cd apps/svc && python -m venv .venv && .venv\Scripts\pip install -r requirements.txt && cd ../..
pnpm dev                          # web :5173 · api :5000 · svc :8000 (127.0.0.1)
```

## Commands
```bash
pnpm dev            # all apps in parallel (pnpm -r)
pnpm test           # tests in every app (pnpm -r)
pnpm lint
pnpm algo:check     # VERA-ALGO markers vs docs/ALGORITHM.md registry
```
Turbo is optional: `pnpm dev:turbo` / `pnpm test:turbo` on machines where Windows Smart App Control allows `turbo.exe`.
Run `pnpm install` only at the root: there is one lockfile (`pnpm-lock.yaml`). Line endings are LF (`.gitattributes`).

New here? Read **[docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)** (VS Code + Claude Code setup and first tasks).

## Documentation
| | |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Rules for Claude Code (and for us) |
| [docs/PRD.md](docs/PRD.md) | Requirements and business rules |
| [docs/TRD.md](docs/TRD.md) | Architecture, structure, API, conventions |
| [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Tables, enums, key queries |
| [docs/APP_FLOW.md](docs/APP_FLOW.md) | Routes, flows, state machines |
| [docs/ALGORITHM.md](docs/ALGORITHM.md) | SBERT + cosine matching and WSM scoring, code-review guide |
| [docs/UI_GUIDELINES.md](docs/UI_GUIDELINES.md) · [docs/DESIGN.md](docs/DESIGN.md) | UI implementation and design system |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Build order and task IDs |
| [docs/test-cases.md](docs/test-cases.md) | System test cases |
| [CONTRIBUTING.md](CONTRIBUTING.md) · [CHANGELOG.md](CHANGELOG.md) | Team workflow · history |

> Set the same random `SVC_INTERNAL_KEY` (32+ chars) in `apps/api/.env` and `apps/svc/.env`; the svc rejects calls without it.
