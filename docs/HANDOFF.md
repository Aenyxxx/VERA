# VERA — Handoff (end of session, Oct 20, 2026)

Short, factual status for the next session. Rules and conventions: `CLAUDE.md`. Decisions: `docs/FINAL_DESIGN_DECISIONS.md`. How the app works now: `docs/USER_GUIDE.md`.

## 1. Project status

**The build is done.** Every decision in `docs/FINAL_DESIGN_DECISIONS.md` is built and committed: 5 and 11–21 (Oct 17), the Oct 19 post-testing changes 22–28, the final-test prep 29–30, and the **final-test changes 31–34 (Oct 20, see 1.2a)**, including the decision 34 owner change (no sample-data banner; exports enabled but inactive). Suites: api **760**, web **318**, svc **151** passed; `pnpm lint` clean; `pnpm algo:check` passed (29 blocks, 22 registered steps). **Verified on the laptop after `git pull`.** Working tree clean at `124020c`.

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
| 32 | The client's final interview is in the Notify message (required) and confirmed once; Create endorsement sets it on every item and moves `endorsed` → `final_interview_scheduled` in one transaction, no second notice (different → 409 `FINAL_INTERVIEW_CHANGED`, then "time changed"; rematch → "scheduled") | `0ed094c`; check-s16 fix `0f368f3` |
| 33 | Endorsement packet downloaded from the Ranking tab (rows that passed, at passed … hired / not hired) by application id; removed from Outcomes and the old item route | `85adbc0` |
| 31 | My Profile: initials avatar (first + last name) and a disabled "Upload photo" (Coming soon); nothing uploaded | `b63a2c8` |
| 34 | Recruitment Reports (`/admin/reports`, last sidebar item for HR and admin): sample tiles, pipeline and hiring-outcome charts (HTML/CSS, no new dependency), vacancy table with "Sample …" companies; no API | `2fdf4cc` |
| 34 owner change | The "Preview: sample data" banner and "Coming soon" are removed; Export PDF / Export Excel are enabled (normal look) but inactive (no request, navigation, download, or toast); still sample data, still no API. The presenter says aloud that it is sample data (DEFENSE_DEMO_CHECKLIST Extra F) | `124020c` |

All built and committed; no migration, no ERD/DFD change. Suites after the last commit: api **760**, web **318**, svc **151**; lint clean; algo:check passed.

Check results (Oct 20, real database, live API, after the unit commits):
- **check-s15: 141/142.** The one FAIL, "Notify without the final interview -> 400", got status **0** (connection closed by the server: a Windows PowerShell 5.1 keep-alive race on the reused connection), not an API error; the next request on the same route passed. Not a code finding.
- **check-s16: 138/139.** The one FAIL, "Create endorsement again (nobody for_endorsement) -> 422", got 400 VALIDATION_ERROR: a **script bug** (that call sent no `finalInterviewAt` / `finalInterviewDetails`, required since decision 32). Fixed in the script: the call now sends the notified schedule (`$createBody`) and still expects exactly 422, now also with the message "Nobody has confirmed the endorsement yet: notify passed applicants first."; not re-run. The API path is covered by `endorsements.test.js` "nobody for_endorsement → 422, nothing written" (valid body). Not a code finding.
- check-s17 and check-p2: skipped by decision; decision 32/33 paths are covered by unit tests and check-s15/s16 on the real DB.
- **Status history confirmed** on the real DB (check-s16's printed query): each endorsed application has `for_endorsement → endorsed` ("Endorsed to the client") then `endorsed → final_interview_scheduled` ("Final interview scheduled"), with the **same `changed_at`**, ordered by **`history_id`** (endorsed first), **HR as the actor**.

### 1.3 Latest check results
- **After Pass C and the rounding fix:** check-s17 **90/90**, check-p3 **49/49**. Live matching of the demo resume (Experienced): Cashier **78.95**, final **79.48** with the demo interview 80.00.
- **Still valid** (paths not touched by the Oct 19–20 changes): check-p1 22/22, check-p4 85/85, check-s13 63/63, check-s18 17/17. *Superseded by Oct 20:* check-p2 55/55 and check-s16 121/121 (the scripts changed for decisions 32–33; see 1.2a for the new runs).
- check-s11 / check-s12 were not re-run after Phase 4 C; their two manual paths (**HR requests a document**, **HR rejects a resume**) are in the final test.

### 1.4 Also done (Oct 19)
- `docs/USER_GUIDE.md`: plain-language guide (navigation, workflow, rules, scoring, notifications, troubleshooting, glossary) with the doc-vs-app differences in §9 (`d74ca29`).
- Label fixes: "Log out" everywhere; sidebar "Interview Assessment" like the page titles (`de0eb23`).
- Browser tab icon: the VERA logo (`5df742d`).
- One-off reset script `supabase/scripts/reset-all-for-final-test.sql` (`868869b`).

### 1.5 Decisions this session (Oct 20, not built)
- **UI redesign:** dropped for now.
- **Deployment:** postponed. The PC or the laptop is the server, reached through a **dev tunnel**; GitHub only holds the code (it does not host the app).
- **Brevo (email sending):** still postponed; VERA sends no email (USER_GUIDE §6, §9).

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

- **Oct 19:** reset with `supabase/scripts/reset-all-for-final-test.sql` (only **admin@vera.test** and **hr.vera@email.test** kept, passwords unchanged; Competency Profile and `system_setting` kept; every other table emptied; `resumes` and `documents` buckets emptied).
- **Oct 20:** check-s15 and check-s16 then ran on this database, so it holds **ZZ companies / vacancies and `zz-…@vera.test` throwaway applicants** (with resumes in Storage) until the next reset.
- **TODO: confirm reset.** The owner must confirm whether the fresh-start reset was done after those runs (`reset-all-for-final-test.sql` in the SQL Editor + empty the `resumes` and `documents` buckets in the dashboard). Until confirmed, assume the ZZ data is still there.
- The old **Juan / Cashier / Store Crew** data no longer exists. (`reset-applications.sql` still refuses the old Cashier id; harmless.)
- The check scripts create ZZ data and need throwaway applicants: do not run them again before the team re-test.

## 4. Known limitations (documented, not fixed)

- **Resume-replacement race** (`docs/DATABASE_SCHEMA.md` §8, "Resume replace"): a rematch scan or pool-matching run that called svc with the old resume can still insert its offer just after a replacement commits; the stored matching is then from the previous resume. Seconds-wide; accepted for the demo.
- **Rematch offers can stay pending**: no automatic expiry (deadline shown, not enforced); a stale offer is expired only by the accept re-check (PRD BR-23 note).
- **`job_vacancy.min_years_experience`** column is still present and unused; the drop migration is **post-defense** (ROADMAP "Final cleanup").
- **The design docs mention features that are not in the app** (e.g. Forgot password, Google sign-in, Settings, scheduled expiry jobs, emails, "Find matches in talent pool"): see `docs/USER_GUIDE.md` §9.

## 5. Next steps

In this order:

1. [ ] **Fresh-start reset**, if not done (see §3 TODO): `supabase/scripts/reset-all-for-final-test.sql` in the SQL Editor, then empty the `resumes` and `documents` buckets.
2. [ ] **Team re-test** on the reset database, following `docs/DEFENSE_DEMO_CHECKLIST.md` and `docs/USER_GUIDE.md`. Besides the earlier items (**HR requests a document**, a Diploma, with a Certificate attached when applying; run the read-only type check in `docs/DATABASE_SCHEMA.md` §7 first; **HR rejects a resume**; passing-score notes: V1 passing 75 needs an interview of about 71+, V2 passing 70 about 77+), check the Oct 20 changes:
   - [ ] **Notify carries the schedule:** the dialog requires the final interview date, time, and details; the "Please confirm" notice contains them.
   - [ ] **The applicant pop-up shows it:** "Confirm your endorsement" shows the message with the final interview.
   - [ ] **Create endorsement sends no second notice** when the schedule matches (the applicants are at *Final interview*, "Sent to the employer" only); a different time shows the warning, then "Final interview time changed".
   - [ ] **Download on Ranking, not in Outcomes:** the packet button is on the vacancy's Ranking tab for applicants who passed; the Outcomes rows have none.
   - [ ] **Profile avatar placeholder:** initials of the first and last name; "Upload photo" disabled with "Coming soon".
   - [ ] **Reports page:** last sidebar item for HR and admin; sample tiles, charts, and table; no banner; Export PDF / Excel clickable but doing nothing.
3. [ ] **Fix any findings**: findings go to the reviewer before any fix; fixes follow §6.
4. [ ] After a clean run: **`git tag defense-freeze`** and **push the tag** (`git push origin defense-freeze`).
5. [ ] **Manuscript alignment:** `docs/USER_GUIDE.md` §9 (features described in the docs but not in the app, incl. item 11, the final interview notice), the new matching numbers (decisions 26–27, half-up rounding: worked example 71.13 / final 74.32; demo resume Cashier 78.95), and **Recruitment Reports = a layout preview with placeholder data, future work**. **No Reports screenshot as a results figure.**

## 6. How to resume (working rules used in this build)

- **Manual approval, file by file (show the diff first)** for any change to rematch, endorsement, status machine, close-out, eligibility, or scoring code (and VERA-ALGO blocks). Plan first for each part; keep it lean.
- **Claude never writes SQL to the database.** Claude writes migration files + verification queries and stops; the owner applies them in the Supabase SQL Editor. Never read or print a `.env` file.
- **The owner commits and pushes**; Claude suggests the commit message.
- Shell commands beyond tests, lint, `algo:*`, and read-only git need approval.
- Tests: fix failures in code; changed assertions at least as strict; empty/zero checks only after a positive assertion on the same container; no `sed -i`.
- **Check scripts:** Windows PowerShell 5.1, ASCII only, API only, ZZ data only, height rule (ZZ vacancies `minHeightCm = 249`, throwaway applicants 250 cm), arrays returned with `return ,@(...)`.
- **pnpm 12.5.1**: no `-s` flag; `npx` is blocked → `pnpm --filter <app> exec vitest run <files>`. Heredocs with apostrophes break: write edit scripts to the scratchpad and run them.
- **Setup gotchas on the PC:** the svc venv is Python 3.13, built from the laptop's freeze file; pnpm comes from the standalone install; paths use `C:\Users\NYNX\...` on the PC and `C:\Users\NYXX\...` on the laptop.
- **One server at a time:** run `pnpm dev` and the dev tunnel from **one machine at a time** (both use the same Supabase project). **The laptop is the current server.** Before switching machines, stop `pnpm dev` and the tunnel on the other one, then `git pull`.

## 7. Where things are

- How the app works: `docs/USER_GUIDE.md`
- Defense flow: `docs/DEFENSE_DEMO_CHECKLIST.md`
- Decisions (incl. Oct 19, 22–30, and Oct 20, 31–34): `docs/FINAL_DESIGN_DECISIONS.md`
- Matching and scoring: `docs/ALGORITHM.md` (+ generated `ALGORITHM_INDEX.md`, `ALGORITHM_CODE.md`)
- Check scripts: `scripts/` (`check-p1..p4.ps1`, `check-s11..s18.ps1` and helpers)
- Cleanup scripts (not migrations): `supabase/scripts/` (`reset-all-for-final-test.sql`, `delete-check-vacancies.sql`, `reset-applications.sql`, `delete-demo-vacancies.sql`)
- Build order and status: `docs/ROADMAP.md` ("Post-sprint build"); changes: `CHANGELOG.md`
