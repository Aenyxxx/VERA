---
description: Start a roadmap task — read the docs, propose a plan, wait for approval
argument-hint: <task id, e.g. P4.3>
---
We are starting roadmap task **$ARGUMENTS**.

1. Read `CLAUDE.md`, then find task $ARGUMENTS in `docs/ROADMAP.md`.
2. Read every PRD requirement (FR-…, BR-…), TRD section, DATABASE_SCHEMA section, APP_FLOW section, and UI_GUIDELINES section the task depends on. If the task touches matching or scoring, also read `docs/ALGORITHM.md`.
3. Look at the existing code you will change.
4. Reply with a plan only — no code yet:
   - goal in one sentence and the requirement IDs it satisfies
   - files to create / change / delete
   - database changes (new migration file?) and API endpoints
   - `VERA-ALGO` blocks you will add, move, or change (if any)
   - tests you will add and the test cases from `docs/test-cases.md` it should make pass
   - anything unclear or conflicting in the docs (ask; do not guess business rules)
5. Wait for my approval before writing code.
