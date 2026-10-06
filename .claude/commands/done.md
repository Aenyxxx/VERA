---
description: Finish the current task — tests, lint, algorithm check, changelog, roadmap, commit message
---
Finish the current task:

1. Run `pnpm test` and `pnpm lint`. Fix failures caused by this task.
2. Run `pnpm algo:check`. If any `VERA-ALGO` block was added or moved, also run `pnpm algo:map`.
3. Add a line under **Unreleased** in `CHANGELOG.md` (right group: Added / Changed / Fixed / Removed / Security / Database) with the task and requirement IDs.
4. Tick the task in `docs/ROADMAP.md` (`[x]`), and update `docs/ALGORITHM.md` registry statuses if a step changed from planned/partial.
5. If the schema changed, confirm there is a new migration file and `docs/DATABASE_SCHEMA.md` is updated.
6. Summarize what changed (files, endpoints, tests) and propose a conventional commit message, e.g. `feat(screening): P5.2 lock slot on first verification (FR-SCR-03)`.
Do not push.
