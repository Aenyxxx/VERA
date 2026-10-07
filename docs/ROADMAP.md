# VERA — Roadmap (solo 7-day sprint)

> **Sprint:** Day 1 = Wed Oct 7 → Day 7 = Tue Oct 13, 2026 · **one developer, one Claude account.**
> Goal: the full recruitment pipeline works end to end for the defense demo, and the algorithm code is ready for code review.
> Legend: `[x]` done · `[~]` partly done · `[ ]` to do · `[-]` **deferred** (do not build; see §6).
> Work is organized in **slices** (`S1`…`S18`): each slice is one feature built end to end (database → API → screen) in one Claude conversation. Old task IDs (`P4.3`, …) are listed in each slice so PRD, ALGORITHM.md, and test-cases.md references still work.

---

## 1. Sprint rules

1. **Simplest version that passes the demo script (§5).** *(simplified)* notes override the longer PRD wording. Deferred items (§6) are never built, even if they look small.
2. **One slice = one Claude conversation.** Start a new conversation for each slice so context stays small and cheap.
3. **Commit after every working slice** on `master` (`git commit -m "feat: S8 companies"`), and push at the end of each day. No PR reviews during the sprint; the commit history is your rollback point.
4. **Claude modes:** Plan → approve → **Edit automatically** → test it in the browser → review the diff in Source Control → commit. Use **Manual** mode only for `VERA-ALGO` code and SQL.
5. **Stuck more than 30 minutes?** Paste the error to Claude once. If it's still stuck, take the simpler path or move the item to §6 and continue.
6. **Daily gate:** don't start the next day's slices until today's gate works in the browser.
7. **Feature freeze: Day 6, 8 PM.** Day 7 is only testing, fixing, and defense prep.

### Making one Claude account last
- Check `/usage` at lunch and in the evening. If you're near the limit, do testing, data preparation, or doc updates by hand while it resets.
- Give Claude the slice ID and nothing else to read beyond what the slice references. Avoid "read the whole repo".
- Use `/compact` when a conversation gets long; start a new one for the next slice.
- Use the model picker: a faster model for routine screens and CRUD, the strongest model for S5, S11, S12, S14 (algorithm and pipeline logic).
- Batch small fixes into one message instead of many short ones.

---

## 2. Current state (Oct 6)

| Area | Status |
|---|---|
| Repo hygiene, pnpm scripts (`pnpm -r`; turbo blocked by Smart App Control), lint passes | `[x]` P0.2 |
| `VERA-ALGO` markers on existing svc code; `pnpm algo:check` passes | `[x]` P0.10 |
| API foundation, `@vera/shared`, `authenticate`/`requireRole`, `/api/me`, `/api/health`, `seed:admin` | `[x]` S3 |
| Web shell (tokens, Roboto, guards, navy sidebar + header, placeholder routes), Supabase login with remember me and role redirect | `[x]` S4 |
| Old applicant mock pages | moved to `apps/web/src/legacy/` (unrouted; reference until S6/S7/S10) |
| svc extraction + SBERT matching (`/process-resume`, `/match-resume`) | `[~]` |
| New schema + seed applied, keys rotated | `[x]` S1 (verified: 24 tables, 6 competencies, 5 settings, 2 auth triggers) |
| svc in `pnpm dev`/`pnpm test`, `X-Internal-Key`, 127.0.0.1 | `[x]` S2 |
| Admin side | `[ ]` |

---

## 3. Time budget

*Rescheduled Oct 7 after the agency process change (one ongoing application, company block, rating reuse; PRD BR-17..BR-22). Day 1 finished S1–S11, about three days ahead, so the change fits without new deferrals.*

| Day | Slices | Hours (approx.) |
|---|---|---|
| 1 Wed Oct 7 | S1–S11 ✅ · **S11b** one ongoing application + company block | 8–10 |
| 2 Thu Oct 8 | S12 screening (+ reused-ratings button) · S13 interviews (simplified) | 8–10 |
| 3 Fri Oct 9 | S14 evaluation + WSM-03 rating reuse (Manual mode) · S15 ranking, notify, close-out | 9–10 |
| 4 Sat Oct 10 | S16 endorsement, outcomes (close-out hook, not_hired → rematch) · S17 automatic rematch + applicant pool (migration first, Manual mode) | 9–10 |
| 5 Sun Oct 11 | S18 dashboards · first full demo run (Juan via rematch, §5) | 8 |
| 6 Mon Oct 12 | bug fixes · second demo run · freeze 8 PM | 8 |
| 7 Tue Oct 13 | test, fix, defense prep | 8 |

---

## 4. Slices

### Day 1 (Wed Oct 7) — Foundation
*Gate: `pnpm dev` runs web + api + svc; new schema applied; HR and applicant can log in and land on role-based placeholder pages in the VERA shell.*

- [x] **S1 — Keys and database (you, by hand, ~45 min)** — applied and verified Oct 6: 24 tables, 6 competencies, 5 settings, 2 auth triggers.
  - P0.1: rotate the Supabase secret key and DB password; update `apps/api/.env`.
  - P0.5: in the Supabase SQL Editor, drop the old `applicant` and `user_account` tables, run `supabase/migrations/20261006000000_initial_schema.sql`, then `supabase/seed.sql` (DATABASE_SCHEMA §7).
- [x] **S2 — Python service in `pnpm dev`** · P0.3, P0.9
  - `scripts/run-py.mjs`, `apps/svc/package.json` (dev/test), `apps/svc/requirements.txt` (TRD §13); `X-Internal-Key` dependency; listen on 127.0.0.1.
- [x] **S3 — API foundation and auth** · P0.4, P0.6, P0.7, P1.5
  - `packages/shared` (`@vera/shared`): roles, statuses, labels, document types (plain JS).
  - API skeleton (`config/env.js`, `db/pool.js`, `db/tx.js` with `vera.actor_id`, errors, `errorHandler`, `validate`, helmet, CORS); delete mock routes/controllers/services; `node --watch --watch-path=src`.
  - `authenticate`, `requireRole`, `GET /api/me`, `GET /api/health`.
  - `pnpm --filter api seed:admin` creates the **admin and one HR account** *(simplified: replaces the User Management UI)*.
- [x] **S4 — Web shell and login** · P0.8, P1.1
  - `lib/supabase.js` (remember-me storage), `lib/apiClient.js`, react-query, sonner, `cn` fix, tokens + Roboto (UI_GUIDELINES §1–2), `AuthLayout` / `ApplicantLayout` / `AdminLayout` with the reconciled navigation (UI_GUIDELINES §5), guards, route map with placeholder pages (APP_FLOW §1), shared `PageHeader`, `StatusBadge`, `EmptyState`, `DataTable`, `ScoreChip`.
  - Login wired to Supabase: email/password, validation, remember me, errors, role redirect via `/api/me`.

### Day 2 (Thu Oct 8) — Algorithm and applicant onboarding
*Gate: matcher tests pass with the worked example; an applicant signs up, uploads a resume, sees the auto-filled profile, confirms, edits it, and uploads documents.*

- [x] **S5 — Extraction and matching endpoints (Manual mode)** · P2.1, P4.1a, P4.1b *(simplified)*, P4.1c
  - svc `POST /extract`: add `addressLine`, `educationLevel`, `heightCm`, `yearsExperience`; camelCase response (TRD §8).
  - Tests: `test_similarity.py`, `test_matcher_math.py` (ALGORITHM.md §6 worked example with injected similarities), `test_rules.py`.
  - Explicit `cosine_similarity_matrix` (COS-01) inside `algorithm.py`, used by `_coverage`; **no file split**.
  - svc `POST /match` from stored sections + weights; `matchedSkills` / `missingSkills` (MAT-05).
  - Update ALGORITHM.md registry statuses; `pnpm algo:check` passes.
- [x] **S6 — Sign-up and resume setup** · P1.2 *(simplified)*, P2.2, P2.3, P2.4
  - Sign-up page: email, password, confirm, privacy consent → Supabase sends its **default confirmation link** *(simplified: no 6-digit code screen)*.
  - `POST /api/applicant/resume/parse` (draft) and `POST /api/applicant/profile/confirm` (applicant + resume + extraction in one transaction).
  - Setup page: dropzone → parsing state → editable profile card → Confirm profile.
- [x] **S7 — Profile and documents** · P2.5, P2.6
  - `GET/PATCH /api/applicant/profile`; dashboard profile card (view/edit).
  - Documents upload/list/signed-URL view (API + My Documents page). Resume tab shows the current resume.

### Day 3 (Fri Oct 9) — HR setup and job list
*Gate: HR creates a company and publishes a vacancy with weights totalling 100%; the applicant sees it without the company name.*

- [x] **S8 — Companies** · P3.1
  - API: list/search/create/edit/detail with counts. UI: Company List table, add/edit dialog, detail sheet (incl. website).
- [x] **S9 — Vacancies** · P3.3, P3.4, P3.5
  - API: create/edit draft with weights (must total 100%; reworked to 3 section weights in S9b), publish/close; `GET /api/admin/competencies` (read-only seeded list).
  - UI: vacancy form (Details · Requirements · Qualifications/prescreen · Pipeline settings · Competency weights with live total), vacancy cards list, detail shell.
- [x] **S9b — Competency Profile rubric** (inserted Oct 7) — `20261007000000_competency_profile_rubric.sql` applied and verified Oct 7: 3 sections (A 3 / B 9 / C 3 items), `job_competency` gone, all section-weight totals 0 or 100, `section_scores` + `overall_rating` columns, rounding 78.41, overall rating 4, worked example 77.50 (first-time 82.50), Cashier converted to A 30 / B 30 / C 40.
  - 3 sections / 15 items rated 1–5; vacancies weight the 3 sections (total 100%, 0% allowed); two-level WSM-01 and the WSM-02 overall rating (generated column); `GET /api/admin/competencies` grouped by section; vacancy form/detail rework.
- [x] **S10 — Applicant job list** · P3.6
  - `GET /api/applicant/vacancies` and `/:id` (no company fields); Job Vacancies list + detail page.

### Days 1–2 (Wed Oct 7 – Thu Oct 8) — Apply, match, shortlist, screening *(rescheduled Oct 7)*
*Gate: applicants apply with the radio button and are prescreened and scored instantly; one ongoing application at a time; a failed company's vacancies are hidden; top 2 × slots per group appear in Resume Screening; HR verifies documents and requests a new copy.*

- [x] **S11 — Apply flow (strongest model)** · P4.2, P4.3, P4.4, P4.5, P4.6 *(simplified)* — done Oct 7: cap counts qualified applications; skills-only weights when a vacancy has no experience criterion (BR-04); `seed:demo` + demo SQL scripts.
  - `domain/prescreen.js` (`VERA-ALGO[RANK-01]`), `domain/statusMachine.js`, `domain/shortlist.js` (`VERA-ALGO[RANK-02]`, vacancy row lock, locked slots) + unit tests.
  - `POST /api/applicant/applications`: prescreen → svc `/match` → threshold → waiting pool → cap → shortlist refresh; one per job.
  - Apply dialog (radio button); dashboard **status panel** (APP_FLOW §6 labels); notifications written to the table and shown as a simple bell list.
- [x] **S11b — One ongoing application, company block** *(agency decision Oct 7)* · PRD BR-17..BR-20, FR-APP-08/09 — done Oct 7.
  - Migration `20261008000000_one_ongoing_application.sql` (applied Oct 7): `not_selected` status + pool reason, unique index `application_one_ongoing_per_applicant`.
  - `@vera/shared` `APPLICATION_OUTCOME` (ongoing / hired / failed / neutral), `BLOCKS_APPLYING_STATUSES`; "You can apply to other jobs" next action.
  - Apply: 409 while an ongoing or hired application exists (re-checked under an applicant row lock; index as last line), 404 "not available for your application" at a failed company; job list/detail leave failed-company vacancies out (`domain/eligibility.js`); state machine without "→ terminated", with close-out moves; RANK-02 counts every application of the group.
  - Web: ongoing-application notice on the job list and detail; Apply disabled with the reason.
- [ ] **S12 — Resume Screening** · P5.1, P5.2, P5.3, P5.5
  - API: shortlist per group, application detail with matching details, verify resume/documents (sets `verification_started_at`), document requests (reason + due date shown), **HR "Drop" action** *(simplified: replaces automatic expiry; refills the slot)*.
  - UI: vacancy list → tabs *Work Experience* / *First-Time* → review sheet (PDF viewer, Mark as verified, Request new copy, Drop) → Schedule interview enabled when all verified.
  - **Rating reuse (BR-21):** detail returns `reusableEvaluation`; "Ratings on file" chip; when all verified, **Compute final score (reused ratings)** replaces Schedule interview (disabled until S14).
  - **Decided Oct 7:** fully verified = FR-SCR-06 (per applicant, no required-type list); lock on HR's first verify/reject/request; Reject never drops by itself; "Upload requested documents" only while a request is pending; "New upload to verify" marker; one global lock order job_vacancy → applicant → application (DATABASE_SCHEMA §8, S11b apply fixed); Schedule interview is a disabled placeholder until S13; resume not requestable.
  - [x] Step 0: `seed:applicant` (confirmed demo applicants, dashboard-user repair). [x] Backend + tests. [ ] Web.
  - Applicant side: Requests list in My Documents; uploading the requested type fulfils it.

### Days 2–3 (Thu Oct 8 – Fri Oct 9) — Interviews, scoring, ranking
*Gate: interview scheduled and confirmed; ratings produce correct interview/final scores (worked example: 77.50 / 78.41); a returning applicant's reused ratings give 76.67 on Store Crew with no interview; ranking shows them; HR notifies; applicant confirms endorsement.*

- [ ] **S13 — Interview scheduling** · P6.1, P6.2 *(simplified)*
  - HR schedules (date/time, duration, meeting link) and can edit the time; applicant **confirms** in a dashboard pop-up; HR can mark no-show (→ dropped). *(No applicant reschedule requests. No termination of other applications: BR-17 leaves none. Applicants with reused ratings are never scheduled.)*
- [ ] **S14 — Evaluation and scores (strongest model, Manual mode)** · P6.4, P6.5, P7.7
  - `domain/scoring.js` (`VERA-ALGO[WSM-01]` two-level: section % → weighted sum, exact hundredths half-up; `[WSM-02]` band via `@vera/shared`; `[FIN-01]`) + `scoring.test.js` with the S9b worked example (83.33 / 75 / 75 → 77.50, rating 4, 78.41 / 82.50).
  - `POST /api/admin/applications/:id/evaluation` (all 15 item ratings required) → `competency_rating` + `final_evaluation` (with `section_scores`); `did_not_pass` → talent pool.
  - Interview Assessment page: combined list, evaluation form = the 15 items grouped by section A/B/C (section weight shown, rating interpretations on each 1–5 choice), live section %, interview score, and overall rating of probability of success.
  - **WSM-03 rating reuse (BR-21):** `POST /api/admin/applications/:id/evaluation/reuse`; source = most recent completed `final_evaluation` → its `ratings_source_application_id` → that application's 15 ratings × the new section weights; tests: Store Crew 76.67 / 78.34 and a 3-application chain resolving to the original interview (TC-78, TC-84). Reused evaluations show the ratings read-only.
- [ ] **S15 — Ranking and notify** · P7.1, P7.2
  - Final ranking API (`VERA-ALGO[RANK-03]`) + vacancy ranking tab with ScoreChips and `ScoreBreakdownDialog` (matched/missing skills, section scores × section weights, overall rating of probability of success, final formula).
  - Notify (editable message) → `passed_awaiting_confirmation`; applicant confirm/decline pop-up (decline → archived).
  - `domain/closeOut.js` (BR-22): vacancy filled/archived → `waiting_pool` / `shortlisted` / `interview_*` → `not_selected` (pool, notified), `passed` → `standby`; failure notifications say "You can apply to other jobs" (BR-18).

### Days 4–5 (Sat Oct 10 – Sun Oct 11) — Endorsement, outcomes, pool, dashboards (freeze Mon Oct 12, 8 PM)
*Gate: the full demo script (§5) runs once end to end, including Juan's story.*

- [ ] **S16 — Endorsement and outcomes** · P7.3, P7.4, P7.5, P7.6 *(simplified)*
  - Endorsement Management: per vacancy, confirmed candidates → **Create endorsement** (applications → `endorsed`, vacancy → `endorsing`, remaining passed → `standby` + pool) → **printable endorsement page** (vacancy, company, candidate table with scores, one profile section per candidate) saved with the browser's **Print → Save as PDF** *(simplified: no pdfkit, no storage, no email)*.
  - Outcomes: Mark as hired / not hired; **not hired → automatic rematch** after the commit (S17, BR-23; the pool entry comes only if no suggestion is accepted); vacancy → `filled` when hired = slots, then `closeOutVacancy` (BR-22) inside the transaction, which also cancels live rematch candidates for the vacancy and returns the affected applicants for rescans after the commit; archiving a vacancy also closes it out.
  - **Create endorsement** includes accepted rematch applicants (`for_endorsement`, source `rematch`).
  - Post-hiring details: one form (training, requirements, orientation, deployment) shown on the hired applicant's dashboard.
- [ ] **S17 — Automatic rematch + Applicant Pool (strongest model)** · P8.1, P8.3, PRD BR-23, FR-END-10
  - **Migration first (Manual mode)**, written after the S12–S15 migrations: `application_source` + `rematch`; `rematch_run` (partial unique index: one `running` run per applicant) and `rematch_candidate` (one live suggestion/offer per run).
  - `domain/rematch.js`: `startRematch` (cancel earlier live candidates as `superseded` → run `running` → svc `/match` per eligible vacancy **outside any transaction** → store results → suggest rank 1; `finally` → `failed` on any error), `rankRematch` (`VERA-ALGO[RANK-04]`, Manual mode), reusing RANK-01/02, MAT-04, WSM-01/03, FIN-01. RANK-02 skips `rematch` applications in `occupied`.
  - API: HR suggestions / offer / skip / rescan; applicant offers / accept (applicant + vacancy rows locked; a failed re-check commits the cancellation, then rescans) / decline; apply cancels a pending offer (`applied_elsewhere`); statusMachine allows `for_endorsement` as the start for source `rematch` only.
  - Web: Applicant Pool page with **Suggestions** (Offer / Skip / Rescan); applicant dashboard **Job offer** card (job title only; Accept / Decline; "You decide; the employer makes the final hiring decision.").
  - Tests: TC-81, TC-85..98 (incl. concurrent rescan 409, superseded offers, crash → failed).
- [ ] **S18 — Dashboards and applicant management** · P9.1, P9.2 *(simplified)*
  - HR Dashboard tiles + upcoming interviews.
  - Applicant Management list + detail (profile, documents with single-file download, status history list).
- [ ] **Evening:** run the demo script once; write down every bug.

### Day 7 (Tue Oct 13) — Test, fix, defend
- [ ] Morning: fix the bugs from last night's run (one Claude conversation per bug batch).
- [ ] Run the demo script twice on fresh data.
- [ ] Record the critical test cases (§5) in `docs/test-cases.md`.
- [ ] `pnpm lint`, `pnpm test`, `pnpm algo:check`, `pnpm algo:snippets` → print `docs/ALGORITHM_CODE.md`.
- [ ] Rehearse: demo script + ALGORITHM.md §7 walkthrough + §8 questions; run the worked-example tests live.
- [ ] CHANGELOG release `[0.9.0] — 2026-10-13`; push.

> If your deadline is earlier, fold Day 7 into Day 6 evening and cut S17's re-application path and S18's applicant detail first.

**If you fall behind, cut in this order:** (1) S18 Applicant Management detail page, (2) post-hiring details form, (3) the HR **Rescan** button: *limbo fallback* — a failed rescan then creates the `not_hired` pool entry itself so the applicant is never stranded (the applicant can still self-apply with rating reuse), (4) document requests (HR only verifies or drops), (5) notifications bell (status panel and pop-ups remain). Rating reuse (BR-21) and the automatic rematch (BR-23) are part of the core flow, not cut items.

---

## 5. Definition of done — the demo script

1. HR logs in → adds company *Kabayan Mart* → creates vacancy *Cashier* (slots 2, cap 16, ages 18–35, min height 150 cm, skills *Handling cash and giving correct change · Operating a cash register or POS · Serving and assisting customers · Counting and balancing the cash drawer*, experience *Experience as a cashier or sales staff in a retail store, grocery or supermarket, handling payments and serving customers*, section weights A 30 / B 30 / C 40, threshold 40, passing 75) → publishes. A second client, *ClayGo*, has *Store Crew* (slots 1, cap 8, endorsement count 1, ages 18–35, any gender, senior high, min height 150 cm, 0 years, skills *Stocking and arranging items on shelves · Keeping the store clean and organized · Assisting customers in finding items · Working under pressure during busy hours*, experience *Experience as store crew, stock clerk or helper in a retail store, grocery or fast-food restaurant*, section weights A 20 / B 80 / C 0, threshold 40, passing 75). *(Rehearsals: `pnpm --filter api seed:demo` after `seed:admin` creates both companies and both vacancies, already published; reset applications with `supabase/scripts/reset-applications.sql`, or delete and re-seed both vacancies with `supabase/scripts/delete-demo-vacancies.sql`.)*
2. Applicant signs up (confirmation email) → uploads resume → profile auto-fills → confirms → uploads TOR.
3. Applicant opens Job Vacancies (no company name) → applies as **Experienced**; a second applicant applies as **First-time**; a third is rejected by prescreen (age); a fourth falls below the threshold.
4. HR opens Resume Screening → both groups ranked by matching score → matching details (matched/missing skills) → verifies documents → requests a new copy → applicant uploads it.
5. HR schedules interviews → applicants confirm → HR rates competencies → interview and final scores appear; one applicant does not pass (→ pool). The applicant with an ongoing application cannot apply anywhere else (Apply disabled with the reason).
6. HR opens the ranking → notifies passed applicants → they confirm → HR creates the endorsement and saves it as PDF.
7. **Juan's story** (BR-17..BR-23): Juan passed Cashier and was endorsed → HR marks another applicant **hired** (post-hiring details on their dashboard; Cashier shows **filled**, anyone still waiting becomes *not selected*) and Juan **not hired** (Kabayan Mart rejected him).
8. **Automatic rematch:** right after *Mark as not hired*, VERA rescans the open vacancies (Kabayan Mart excluded) and HR sees the suggestion **Store Crew (ClayGo)** — matching 80.00, final 78.34 (his Cashier ratings × A 20 / B 80 / C 0 = 76.67) → HR clicks **Offer to applicant** → Juan sees "Store Crew — Bocaue, Bulacan" (no company) → **Accept** → his Store Crew application starts at **for endorsement** (no screening, no interview) → HR creates the Store Crew endorsement with Juan in it. *(Self-apply with rating reuse, S12/S14, is still shown with another applicant if time allows.)*
9. HR dashboard counts match.
10. Code review: `docs/ALGORITHM_INDEX.md` → SBERT → cosine → scores → WSM → final; run the worked-example tests.

**Critical test cases (thesis Table 2):** TC-03, 04, 05, 06, 10, 11, 12, 13, 17, 20, 23, 25, 26, 27, 30, 31, 32, 33, 35, 37, 38, 39, 40, 42, 43, 44, 48, 50, 51, 52, 54 *(printable page instead of email)*, 56, 57, 58, 63, 68, 69, 70, 71, 72, 73, 75, 76, 77, 78, 79, 82, 83, 84. TC-01 is run with the confirmation link instead of a code.

---

## 6. Deferred until after the defense

| Item (IDs) | During the sprint instead |
|---|---|
| 6-digit sign-up code screen (P1.2 part, TC-02) | Supabase default confirmation link |
| Forgot / reset password (P1.3, TC-06) | **Day 7 stretch** if all else is green |
| Google sign-in (P1.4, TC-07) | — |
| Admin User Management UI (P1.6, TC-08/09) | `seed:admin` creates admin + HR |
| Competency management UI (P3.2) | Seeded fixed list |
| Resume replacement (P2.7, TC-16/17) | Applicant keeps the first resume |
| Matcher split into modules (P4.1b full) | Explicit cosine function in `algorithm.py` |
| Automatic deadline expiry and reminders (P5.4, P6.3, TC-41/46/47/53) | Deadlines shown; HR uses Drop / No-show |
| Applicant reschedule requests (FR-INT-03, TC-45) | HR edits the interview time |
| Pull next applicant (P5.6) | Automatic refill on drop |
| Release a hired applicant so they can apply again (BR-17; decided Oct 7) | Hired blocks applying until `training_failed` |
| Endorsement PDF file, XLSX, email to company (P7.3/P7.4 part) | Printable endorsement page → Save as PDF |
| Invitation deadlines, find matches in pool (P8.2, P8.4, TC-59) | Automatic rematch suggestions after a client rejection (BR-23); HR browses the pool |
| Manual HR invitations to pooled applicants (`pool_invitation`, FR-POOL-02 part; decided Oct 7) | Pooled applicants self-apply with rating reuse; rematch covers client rejections |
| svc `/match/batch` for the rematch rescan | One `/match` call per eligible vacancy, sequential |
| All emails except Supabase auth emails (P9.3, TC-67) | In-app status panel, pop-ups, bell |
| Settings page, ZIP downloads, Reports, company stats polish (P9.4–P9.6) | Seeded settings; single downloads |
| Integration test suite, deployment, ISO survey (P10.2, P10.5) | Unit tests (svc + domain), manual system tests, local demo |

---

## 7. Prompt template

```
/task S11
Sprint mode, solo: build the simplest version that passes docs/ROADMAP.md §5. Do not build anything in §6.
Build the API, the screen, and the tests for this slice in this conversation.
```
