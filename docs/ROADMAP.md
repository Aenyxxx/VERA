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

| Day | Slices | Hours (approx.) |
|---|---|---|
| 1 Wed | S1–S4 foundation | 8–10 |
| 2 Thu | S5–S7 algorithm + applicant onboarding | 8–10 |
| 3 Fri | S8–S10 companies, vacancies, job list | 7–9 |
| 4 Sat | S11–S12 apply, match, shortlist, screening | 9–10 |
| 5 Sun | S13–S15 interviews, scoring, ranking | 9–10 |
| 6 Mon | S16–S18 endorsement, outcomes, pool, dashboards | 8–10 |
| 7 Tue | demo runs, fixes, tests, defense prep | 8 |

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

- [ ] **S5 — Extraction and matching endpoints (Manual mode)** · P2.1, P4.1a, P4.1b *(simplified)*, P4.1c
  - svc `POST /extract`: add `addressLine`, `educationLevel`, `heightCm`, `yearsExperience`; camelCase response (TRD §8).
  - Tests: `test_similarity.py`, `test_matcher_math.py` (ALGORITHM.md §6 worked example with injected similarities), `test_rules.py`.
  - Explicit `cosine_similarity_matrix` (COS-01) inside `algorithm.py`, used by `_coverage`; **no file split**.
  - svc `POST /match` from stored sections + weights; `matchedSkills` / `missingSkills` (MAT-05).
  - Update ALGORITHM.md registry statuses; `pnpm algo:check` passes.
- [ ] **S6 — Sign-up and resume setup** · P1.2 *(simplified)*, P2.2, P2.3, P2.4
  - Sign-up page: email, password, confirm, privacy consent → Supabase sends its **default confirmation link** *(simplified: no 6-digit code screen)*.
  - `POST /api/applicant/resume/parse` (draft) and `POST /api/applicant/profile/confirm` (applicant + resume + extraction in one transaction).
  - Setup page: dropzone → parsing state → editable profile card → Confirm profile.
- [ ] **S7 — Profile and documents** · P2.5, P2.6
  - `GET/PATCH /api/applicant/profile`; dashboard profile card (view/edit).
  - Documents upload/list/signed-URL view (API + My Documents page). Resume tab shows the current resume.

### Day 3 (Fri Oct 9) — HR setup and job list
*Gate: HR creates a company and publishes a vacancy with weights totalling 100%; the applicant sees it without the company name.*

- [ ] **S8 — Companies** · P3.1
  - API: list/search/create/edit/detail with counts. UI: Company List table, add/edit dialog, detail sheet (incl. website).
- [ ] **S9 — Vacancies** · P3.3, P3.4, P3.5
  - API: create/edit draft with competency weights (must total 100%), publish/close; `GET /api/admin/competencies` (read-only seeded list).
  - UI: vacancy form (Details · Requirements · Qualifications/prescreen · Pipeline settings · Competency weights with live total), vacancy cards list, detail shell.
- [ ] **S10 — Applicant job list** · P3.6
  - `GET /api/applicant/vacancies` and `/:id` (no company fields); Job Vacancies list + detail page.

### Day 4 (Sat Oct 10) — Apply, match, shortlist, screening
*Gate: applicants apply with the radio button and are prescreened and scored instantly; top 2 × slots per group appear in Resume Screening; HR verifies documents and requests a new copy.*

- [ ] **S11 — Apply flow (strongest model)** · P4.2, P4.3, P4.4, P4.5, P4.6 *(simplified)*
  - `domain/prescreen.js` (`VERA-ALGO[RANK-01]`), `domain/statusMachine.js`, `domain/shortlist.js` (`VERA-ALGO[RANK-02]`, vacancy row lock, locked slots) + unit tests.
  - `POST /api/applicant/applications`: prescreen → svc `/match` → threshold → waiting pool → cap → shortlist refresh; one per job.
  - Apply dialog (radio button); dashboard **status panel** (APP_FLOW §6 labels); notifications written to the table and shown as a simple bell list.
- [ ] **S12 — Resume Screening** · P5.1, P5.2, P5.3, P5.5
  - API: shortlist per group, application detail with matching details, verify resume/documents (sets `verification_started_at`), document requests (reason + due date shown), **HR "Drop" action** *(simplified: replaces automatic expiry; refills the slot)*.
  - UI: vacancy list → tabs *Work Experience* / *First-Time* → review sheet (PDF viewer, Mark as verified, Request new copy, Drop) → Schedule interview enabled when all verified.
  - Applicant side: Requests list in My Documents; uploading the requested type fulfils it.

### Day 5 (Sun Oct 11) — Interviews, scoring, ranking
*Gate: interview scheduled and confirmed (other applications terminated); ratings produce correct interview/final scores (worked example: 78.00 / 78.66); ranking shows them; HR notifies; applicant confirms endorsement.*

- [ ] **S13 — Interview scheduling** · P6.1, P6.2 *(simplified)*
  - HR schedules (date/time, duration, meeting link) and can edit the time; applicant **confirms** in a dashboard pop-up → other active applications terminated and their slots refilled; HR can mark no-show (→ dropped). *(No applicant reschedule requests.)*
- [ ] **S14 — Evaluation and scores (strongest model, Manual mode)** · P6.4, P6.5, P7.7
  - `domain/scoring.js` (`VERA-ALGO[WSM-01]`, `[FIN-01]`) + `scoring.test.js` with the worked example.
  - `POST /api/admin/applications/:id/evaluation` → `final_evaluation`; `did_not_pass` → talent pool.
  - Interview Assessment page: combined list, evaluation form (all competencies 1–5, weighted ones first, live preview).
- [ ] **S15 — Ranking and notify** · P7.1, P7.2
  - Final ranking API (`VERA-ALGO[RANK-03]`) + vacancy ranking tab with ScoreChips and `ScoreBreakdownDialog` (matched/missing skills, ratings × weights, final formula).
  - Notify (editable message) → `passed_awaiting_confirmation`; applicant confirm/decline pop-up (decline → archived).

### Day 6 (Mon Oct 12) — Endorsement, outcomes, pool, dashboards (freeze 8 PM)
*Gate: the full demo script (§5) runs once end to end.*

- [ ] **S16 — Endorsement and outcomes** · P7.3, P7.4, P7.5, P7.6 *(simplified)*
  - Endorsement Management: per vacancy, confirmed candidates → **Create endorsement** (applications → `endorsed`, vacancy → `endorsing`, remaining passed → `standby` + pool) → **printable endorsement page** (vacancy, company, candidate table with scores, one profile section per candidate) saved with the browser's **Print → Save as PDF** *(simplified: no pdfkit, no storage, no email)*.
  - Outcomes: Mark as hired / not hired (→ pool); vacancy → `filled` when hired = slots.
  - Post-hiring details: one form (training, requirements, orientation, deployment) shown on the hired applicant's dashboard.
- [ ] **S17 — Applicant Pool** · P8.1, P8.3
  - Pool list (reason, last scores) + **Invite** (in-app notification).
  - Re-application path: verified pooled applicant skips screening and interview; latest ratings × new weights; lands in the ranking. *(First to cut if behind — keep the list.)*
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

**If you fall behind, cut in this order:** (1) S17 re-application path (keep the pool list), (2) post-hiring details form, (3) Applicant Management detail page, (4) document requests (HR only verifies or drops), (5) notifications bell (status panel and pop-ups remain).

---

## 5. Definition of done — the demo script

1. HR logs in → adds company *Kabayan Mart* → creates vacancy *Cashier* (slots 2, Communication 30 / Technical Skills 40 / Adaptability 30, passing 75) → publishes.
2. Applicant signs up (confirmation email) → uploads resume → profile auto-fills → confirms → uploads TOR.
3. Applicant opens Job Vacancies (no company name) → applies as **Experienced**; a second applicant applies as **First-time**; a third is rejected by prescreen (age); a fourth falls below the threshold.
4. HR opens Resume Screening → both groups ranked by matching score → matching details (matched/missing skills) → verifies documents → requests a new copy → applicant uploads it.
5. HR schedules interviews → applicants confirm (another application of theirs is terminated) → HR rates competencies → interview and final scores appear; one applicant does not pass (→ pool).
6. HR opens the ranking → notifies passed applicants → they confirm → HR creates the endorsement and saves it as PDF.
7. HR marks one hired, one not hired (→ pool); hired applicant sees post-hiring details; vacancy shows filled.
8. *(if S17 done)* HR invites a pooled applicant to a second vacancy → they apply → they appear in the ranking with a recomputed score and no new interview.
9. HR dashboard counts match.
10. Code review: `docs/ALGORITHM_INDEX.md` → SBERT → cosine → scores → WSM → final; run the worked-example tests.

**Critical test cases (thesis Table 2):** TC-03, 04, 05, 06, 10, 11, 12, 13, 17, 20, 23, 25, 26, 27, 30, 31, 32, 33, 35, 37, 38, 39, 40, 42, 43, 44, 48, 50, 51, 52, 54 *(printable page instead of email)*, 56, 57, 58, 60 *(if S17)*, 63, 68, 69, 70, 71, 72. TC-01 is run with the confirmation link instead of a code.

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
| Pull next applicant (P5.6) | Automatic refill on drop/terminate |
| Endorsement PDF file, XLSX, email to company (P7.3/P7.4 part) | Printable endorsement page → Save as PDF |
| Invitation deadlines, find matches in pool (P8.2, P8.4, TC-59) | Invite = in-app notification; HR browses the pool |
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
