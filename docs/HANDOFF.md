# VERA — Handoff (end of build session, Oct 19, 2026)

Short, factual status for the next session. Rules and conventions: `CLAUDE.md`. Decisions: `docs/FINAL_DESIGN_DECISIONS.md`. How the app works now: `docs/USER_GUIDE.md`.

## 1. Project status

**The build is done.** Every decision in `docs/FINAL_DESIGN_DECISIONS.md` is built: 5 and 11–21 (Oct 17), the Oct 19 post-testing changes 22–28, and the final-test prep 29–30 (see 1.2; counts there). Suites at handoff: api **735**, web **302**, svc **151** passed; `pnpm lint` clean; `pnpm algo:check` passed (29 blocks, 22 registered steps). Working tree clean at `de0eb23`.

### 1.1 Decisions 5, 11–21 (Oct 17)
| Phase | Decisions | Commit | Check results |
|---|---|---|---|
| 1 | 11 (no minimum years, `S_exp = R`), 12 (whole-resume fallback), 5 (1-year company block) | `43e193d` | check-p1 **22/22** |
| 2 | 14 (final interview notice), 15 (For hiring sequence), 21 (endorsement packet) | `e6b646e` | check-p2 **55/55**, check-s16 **121/121**, check-s18 **17/17** |
| 3 | 17 (screening failures → pool, pool matching on publish, job invitations), 18 (pool tabs Waiting / Returned by Client) | `438840f` | (check-p3: see 1.3) |
| 4 A+B | 19 (User Management), 20 (reschedule requests) | `1caafed` | check-p4 parts 1–2 **60/60**, check-s13 **63/63** |
| 5 | 13 (Evaluate card layout; per-choice text later replaced by decision 23) | `e097628` | web tests |
| 4 C | 16 (attach documents when applying, resume replacement during active applications) | `819e660` | check-p4 parts 1–3 **85/85** |

### 1.2 Post-testing changes 22–28 (Oct 19)
| Pass | Decisions | Commit |
|---|---|---|
| A | 22 User Management (Password + Confirm password; admin edits full name / password, never the email), 23 Evaluate column headers, 24 score breakdown without the rank line, 25 lean endorsement packet (header + 15 ratings + interview score), 28 replaced supporting documents deleted when pending and unreferenced | `76f00ee` |
| B | 26 skill evidence from the Skills section only (no duty bullets, no evidence weights) | `c92ce74` |
| C | 27 credit = raw cosine (`LOW, HIGH = 0, 1`); missing skills = best similarity ≤ 0.35, display only | `f0bedda` |
| fix | svc matching scores round half-up on the decimal value (`round2`, like the API): 71.125 → 71.13 | `f879275` |
| prep | 29 supporting document types **Certificate, Diploma, Other** only (uploads and HR requests; no migration, the older enum values stay unused), 30 upload dialog helper line removed; reschedule-request staff notice says "Interview Assessment". Suites: api **740**, web **304**, svc **151**; lint clean; algo:check passed | (owner commits) |

### 1.2a Final-test changes 31–34 (Oct 20; one commit each, order 32 → 33 → 31 → 34; no database change)
| Decision | What | Status |
|---|---|---|
| 32 | The client's final interview is in the Notify message (required) and confirmed once; Create endorsement sets it on every item and moves `endorsed` → `final_interview_scheduled` in one transaction, no second notice (different → 409 `FINAL_INTERVIEW_CHANGED`, then "time changed"; rematch → "scheduled") | Built (`0ed094c`); api **749**, web **309**; check-p2 / s15 / s16 / s17 updated, **not run** (reset database) |
| 33 | Endorsement packet downloaded from the Ranking tab (rows that passed, at passed … hired / not hired) by application id; removed from Outcomes and the old item route | Built (`85adbc0`); api **760**, web **311**; check-p2 / s16 updated, **not run** |
| 31 | My Profile: initials avatar (first + last name) and a disabled "Upload photo" (Coming soon); nothing uploaded | Built; web **313** (web only) |

### 1.3 Latest check results
- **After Pass C and the rounding fix:** check-s17 **90/90**, check-p3 **49/49**. Live matching of the demo resume (Experienced): Cashier **78.95**, final **79.48** with the demo interview 80.00.
- **Still valid** (paths not touched by the Oct 19 changes): check-p1 22/22, check-p2 55/55, check-p4 85/85, check-s13 63/63, check-s16 121/121, check-s18 17/17.
- check-s11 / check-s12 were not re-run after Phase 4 C; their two manual paths (**HR requests a document**, **HR rejects a resume**) are in the final test.

### 1.4 Also done (Oct 19)
- `docs/USER_GUIDE.md`: plain-language guide (navigation, workflow, rules, scoring, notifications, troubleshooting, glossary) with the doc-vs-app differences in §9 (`d74ca29`).
- Label fixes: "Log out" everywhere; sidebar "Interview Assessment" like the page titles (`de0eb23`).
- Browser tab icon: the VERA logo (`5df742d`).
- One-off reset script `supabase/scripts/reset-all-for-final-test.sql` (`868869b`).

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
| 13 | `20261021010000_application_document.sql` | last one; the Oct 19 changes needed no migration |

Verification queries for each are in `docs/DATABASE_SCHEMA.md` §7.

## 3. Current database

- **Reset for the final test** with `supabase/scripts/reset-all-for-final-test.sql`: only **admin@vera.test** and **hr.vera@email.test** remain (auth rows and passwords unchanged); the Competency Profile (`competency`, `competency_section`) and `system_setting` are kept; every other table is empty. The `resumes` and `documents` Storage buckets were emptied in the dashboard.
- The old **Juan / Cashier / Store Crew** data no longer exists. (`reset-applications.sql` still refuses the old Cashier id; harmless.)
- The check scripts create ZZ data and need throwaway applicants: do not run them on this database before the final test.

## 4. Known limitations (documented, not fixed)

- **Resume-replacement race** (`docs/DATABASE_SCHEMA.md` §8, "Resume replace"): a rematch scan or pool-matching run that called svc with the old resume can still insert its offer just after a replacement commits; the stored matching is then from the previous resume. Seconds-wide; accepted for the demo.
- **Rematch offers can stay pending**: no automatic expiry (deadline shown, not enforced); a stale offer is expired only by the accept re-check (PRD BR-23 note).
- **`job_vacancy.min_years_experience`** column is still present and unused; the drop migration is **post-defense** (ROADMAP "Final cleanup").
- **The design docs mention features that are not in the app** (e.g. Forgot password, Google sign-in, Settings, scheduled expiry jobs, emails, "Find matches in talent pool"): see `docs/USER_GUIDE.md` §9.

## 5. Next steps

- [ ] **Final test** with the team on the reset database, following `docs/DEFENSE_DEMO_CHECKLIST.md` and `docs/USER_GUIDE.md` (incl. **HR requests a document**, now a Diploma, with a Certificate attached when applying (decision 29; run the read-only type check in `docs/DATABASE_SCHEMA.md` §7 first), and **HR rejects a resume**; mind the passing-score notes: V1 passing 75 needs an interview of about 71+, V2 passing 70 about 77+).
- [ ] **Findings go to the reviewer before any fix**; fixes follow §6.
- [ ] After a clean run: `git tag defense-freeze`.
- [ ] **Manuscript:** align it with `docs/USER_GUIDE.md` §9 (features described in the docs but not in the app) and the new matching numbers (decisions 26–27, half-up rounding: worked example 71.13 / final 74.32; demo resume Cashier 78.95).

## 6. How to resume (working rules used in this build)

- **Manual approval, file by file (show the diff first)** for any change to rematch, endorsement, status machine, close-out, eligibility, or scoring code (and VERA-ALGO blocks). Plan first for each part; keep it lean.
- **Claude never writes SQL to the database.** Claude writes migration files + verification queries and stops; the owner applies them in the Supabase SQL Editor. Never read or print a `.env` file.
- **The owner commits and pushes**; Claude suggests the commit message.
- Shell commands beyond tests, lint, `algo:*`, and read-only git need approval.
- Tests: fix failures in code; changed assertions at least as strict; empty/zero checks only after a positive assertion on the same container; no `sed -i`.
- **Check scripts:** Windows PowerShell 5.1, ASCII only, API only, ZZ data only, height rule (ZZ vacancies `minHeightCm = 249`, throwaway applicants 250 cm), arrays returned with `return ,@(...)`.
- **pnpm 12.5.1**: no `-s` flag; `npx` is blocked → `pnpm --filter <app> exec vitest run <files>`. Heredocs with apostrophes break: write edit scripts to the scratchpad and run them.
- **Setup gotchas on the PC:** the svc venv is Python 3.13, built from the laptop's freeze file; pnpm comes from the standalone install; paths use `C:\Users\NYNX\...` on the PC and `C:\Users\NYXX\...` on the laptop.

## 7. Where things are

- How the app works: `docs/USER_GUIDE.md`
- Defense flow: `docs/DEFENSE_DEMO_CHECKLIST.md`
- Decisions (incl. Oct 19, 22–28): `docs/FINAL_DESIGN_DECISIONS.md`
- Matching and scoring: `docs/ALGORITHM.md` (+ generated `ALGORITHM_INDEX.md`, `ALGORITHM_CODE.md`)
- Check scripts: `scripts/` (`check-p1..p4.ps1`, `check-s11..s18.ps1` and helpers)
- Cleanup scripts (not migrations): `supabase/scripts/` (`reset-all-for-final-test.sql`, `delete-check-vacancies.sql`, `reset-applications.sql`, `delete-demo-vacancies.sql`)
- Build order and status: `docs/ROADMAP.md` ("Post-sprint build"); changes: `CHANGELOG.md`
