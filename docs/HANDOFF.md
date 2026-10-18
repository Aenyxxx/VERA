# VERA — Handoff (end of build session, Oct 17, 2026)

Short, factual status for the next session. Rules and conventions: `CLAUDE.md`. Decisions: `docs/FINAL_DESIGN_DECISIONS.md`.

## 1. Project status

**Every decision in `docs/FINAL_DESIGN_DECISIONS.md` (5, 11–21) is built.** Suites at handoff: api **719**, web **296**, svc **141** passed; `pnpm lint` clean; `pnpm algo:check` passed (29 blocks, 22 registered steps). Working tree clean at `f7d8e70`.

| Phase | Decisions | Commit | Check results |
|---|---|---|---|
| 1 | 11 (no minimum years, `S_exp = R`), 12 (whole-resume fallback), 5 (1-year company block) | `43e193d` | check-p1 **22/22** |
| 2 | 14 (final interview notice), 15 (For hiring sequence), 21 (endorsement packet) | `e6b646e` | check-p2 **55/55**, check-s16 **121/121**, check-s17 **84/84**, check-s18 **17/17** |
| 3 | 17 (screening failures → pool, pool matching on publish, job invitations), 18 (pool tabs Waiting / Returned by Client) | `438840f` | check-p3 **49/49**; check-s17 offer keys now include `kind` (= `rematch_offer`) |
| 4 A+B | 19 (User Management), 20 (reschedule requests) | `1caafed` | check-p4 parts 1–2 **60/60**, check-s13 **63/63** |
| 5 | 13 (Evaluate card layout, UI only) | `e097628` | web tests (no check script) |
| 4 C | 16 (attach documents when applying, resume replacement during active applications) | `819e660` | check-p4 parts 1–3 **85/85**, check-p3 re-run **49/49** |
| docs | defense demo checklist | `f7d8e70` | — |

**Post-testing changes (Oct 19, decisions 22–28 in `docs/FINAL_DESIGN_DECISIONS.md`):** **Pass A committed** (decisions 22 User Management edit + confirm password, 23 Evaluate column headers, 24 no rank line on the breakdown, 25 packet cover reduced, 28 replaced supporting documents deleted when pending and unreferenced; no migration; api **735**, web **302**). **Pass B committed** (decision 26: skill evidence = Skills section only). **Pass C done, not committed yet** (decision 27 approved: credit = raw cosine, `LOW, HIGH = 0, 1`; missing skills = similarity ≤ 0.35, display only; svc **144**). Demo resume now matches Cashier 78.95 / Store Crew 63.16 (Experienced); stored rows keep 99.38 / 71.15. **Next:** owner re-runs check-s17 and check-p3 on ZZ data; rehearse the demo with the passing-score notes in `docs/DEFENSE_DEMO_CHECKLIST.md` (V1 passing 75 needs an interview of about 71+, V2 passing 70 about 77+). Plan: ROADMAP "Post-testing changes (Oct 19)".

**check-s11 / check-s12 were not re-run after Phase 4 C**: their paths are covered by check-p3, check-p4 part 3, check-s13 and check-s16, except **document request** and **resume rejection**, which are in the team run-through (§5).

## 2. Migrations applied on the real database (in order)

| # | File | Note |
|---|---|---|
| 1 | `20261006000000_initial_schema.sql` | + `supabase/seed.sql` |
| 2 | `20261007000000_competency_profile_rubric.sql` | 15-item Competency Profile, section weights |
| 3 | `20261008000000_one_ongoing_application.sql` | did not commit on the real DB; re-applied idempotently by #5 and #6 |
| 4 | `20261010000000_application_source_rematch.sql` | |
| 5 | `20261010010000_close_out_values.sql` | |
| 6 | `20261010020000_one_ongoing_index_repair.sql` | |
| 7 | `20261011000000_rematch_offer.sql` | |
| 8 | `20261019000000_final_interview_values.sql` | enum values alone |
| 9 | `20261019010000_final_interview.sql` | |
| 10 | `20261020000000_pool_reason_values.sql` | enum values alone |
| 11 | `20261020010000_job_invitation.sql` | |
| 12 | `20261021000000_reschedule_requests.sql` | |
| 13 | `20261021010000_application_document.sql` | last one |

Verification queries for each are in `docs/DATABASE_SCHEMA.md` §7.

## 3. Current database notes

- **Cashier** (Kabayan Mart) is *endorsing*; Juan is *endorsed*. Juan, Cashier and Store Crew are **no longer protected** (the demo uses new data). `supabase/scripts/reset-applications.sql` still refuses the Cashier id as its first statement; remove that guard only if Cashier must be reset.
- **Store Crew** (ClayGo) is **closed** and has no applications.
- The defense demo uses **new** companies, vacancies and resumes (`docs/DEFENSE_DEMO_CHECKLIST.md`).

## 4. Known limitations (documented, not fixed)

- **Resume-replacement race** (`docs/DATABASE_SCHEMA.md` §8, "Resume replace"): a rematch scan or pool-matching run that called svc with the old resume can still insert its offer just after a replacement commits; the stored matching is then from the previous resume. Seconds-wide; accepted for the demo.
- **Rematch offers can stay pending**: no automatic expiry (deadline shown, not enforced); a stale offer is expired only by the accept re-check (PRD BR-23 note).
- **`job_vacancy.min_years_experience`** column is still present and unused; the drop migration is **post-defense** (ROADMAP "Final cleanup").

## 5. Remaining before the defense (Mon Oct 19)

- [ ] Team run-through on the final code with `docs/DEFENSE_DEMO_CHECKLIST.md`, including the two manual paths: **HR requests a document** (applicant uploads, request fulfilled) and **HR rejects a resume** (remarks required, nothing dropped automatically).
- [ ] Fix anything the run-through finds (same rules as §6).
- [ ] **Freeze Sun Oct 18, 20:00**: `git tag defense-freeze`.
- [ ] Run `supabase/scripts/delete-check-vacancies.sql`; delete the test HR accounts (`docs/GETTING_STARTED.md` → "Remove test HR accounts").
- [ ] Prepare demo accounts A–D (checklist §2) and the resume / document PDFs.

## 6. How to resume (working rules used in this build)

- **Manual approval, file by file (show the diff first)** for any change to rematch, endorsement, status machine, close-out, eligibility, or scoring code (and VERA-ALGO blocks). Plan first for each part; keep it lean.
- **Claude never writes SQL to the database.** Claude writes migration files + verification queries and stops; the owner applies them in the Supabase SQL Editor. Never read or print a `.env` file.
- **The owner commits and pushes**; Claude suggests the commit message.
- Shell commands beyond tests, lint, `algo:*`, and read-only git need approval.
- Tests: fix failures in code; changed assertions at least as strict; empty/zero checks only after a positive assertion on the same container; no `sed -i`.
- **Check scripts:** Windows PowerShell 5.1, ASCII only, API only, ZZ data only, height rule (ZZ vacancies `minHeightCm = 249`, throwaway applicants 250 cm), arrays returned with `return ,@(...)`. Older check-s11/s12/s13 run on Store Crew (reopen, run, reset with `reset-applications.sql`, close again).
- **pnpm 12.5.1**: no `-s` flag; `npx` is blocked → `pnpm --filter <app> exec vitest run <files>`. Heredocs with apostrophes break: write edit scripts to the scratchpad and run them.
- **Setup gotchas on the PC:** the svc venv is Python 3.13, built from the laptop's freeze file; pnpm comes from the standalone install; paths use `C:\Users\NYNX\...` on the PC and `C:\Users\NYXX\...` on the laptop.

## 7. Where things are

- Phase 4 plan (A, B, C): `docs/PHASE4_PLAN.md`
- Defense flow: `docs/DEFENSE_DEMO_CHECKLIST.md`
- Check scripts: `scripts/` (`check-p1..p4.ps1`, `check-s11..s18.ps1` and helpers)
- Cleanup scripts (not migrations): `supabase/scripts/` (`delete-check-vacancies.sql`, `reset-applications.sql`, `delete-demo-vacancies.sql`)
- Build order and status: `docs/ROADMAP.md` ("Post-sprint build"); changes: `CHANGELOG.md`
