---
description: Review the SBERT + cosine matching and WSM scoring code against docs/ALGORITHM.md
argument-hint: [step id, e.g. COS-01 — empty = all steps]
---
Review the algorithm implementation for: **$ARGUMENTS** (if empty, review every step in the registry).

1. Read `docs/ALGORITHM.md` (registry, formulas §4, parameters §5, worked example §6).
2. Run `pnpm algo:check` and report problems.
3. For each requested step, open its `VERA-ALGO[ID]` block(s) and check:
   - the code computes exactly the documented formula (show the formula line next to the code line that implements it)
   - parameters match §5 (LOW, HIGH, BULLET_DISCOUNT, EXP_YEARS_SHARE, weights, rounding)
   - the BEGIN line has a clear title and the next line states the formula and doc anchor
   - a unit test covers it, including the worked example values
4. List discrepancies as: step · file:line · expected · found · proposed fix. Do not change code until I approve.
5. If everything matches, run `pnpm algo:snippets` to refresh `docs/ALGORITHM_CODE.md` for the defense handout.
