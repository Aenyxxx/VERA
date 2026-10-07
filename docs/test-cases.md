# VERA — System Test Cases

> Black-box test cases mapped to [PRD](./PRD.md) requirements. This file becomes **Table 2** in Chapter 3 §3.5.3.
> Each feature's task in [ROADMAP](./ROADMAP.md) is done only when its test cases pass.
> Fill **Actual** and **Status** (Pass / Fail / Blocked) during P10.1. Record the build/commit tested at the top of each run.

**Test run:** commit `________` · date `________` · tester `________` · environment `local / staging`

**Standard test data** (create with `supabase/seed.sql` → `pnpm --filter api seed:admin` → `pnpm --filter api seed:demo`, or by hand in the app): admin `admin@vera.test`; HR `hr@vera.test`; company *Kabayan Mart*; vacancy *Cashier* (slots 2 → shortlist 4 per group, cap 16, endorsement count 3, threshold 40, passing 75, min age 18–35, min education senior_high, min height 150 cm, min 1 year of experience; required skills *Handling cash and giving correct change · Operating a cash register or POS · Serving and assisting customers · Counting and balancing the cash drawer*; experience *Experience as a cashier or sales staff in a retail store, grocery or supermarket, handling payments and serving customers*; section weights A 30 / B 30 / C 40); company *ClayGo*; vacancy *Store Crew* (slots 1 → shortlist 2 per group, cap 8, endorsement count 1, threshold 40, passing 75, min age 18–35, any gender, min education senior_high, min height 150 cm, 0 years of experience; required skills *Stocking and arranging items on shelves · Keeping the store clean and organized · Assisting customers in finding items · Working under pressure during busy hours*; experience *Experience as store crew, stock clerk or helper in a retail store, grocery or fast-food restaurant*; section weights A 20 / B 80 / C 0); applicants A1–A10 with prepared text PDFs (`apps/svc/tests/fixtures/resumes/`), each with a height of at least 150 cm unless the case tests the height condition. The algorithm worked example (ALGORITHM.md §6, TC-68..71) keeps its own illustrative Cashier skills.

---

## 1. Authentication and accounts

| TC | FR | Scenario | Steps / data | Expected result | Actual | Status |
|---|---|---|---|---|---|---|
| TC-01 | FR-AUTH-06 | Sign up with code | Sign up with a new email, valid password, consent → enter emailed code | Account created only after the code; lands on `/applicant/setup` | | |
| TC-02 | FR-AUTH-06 | Wrong / expired code | Enter a wrong code, then an expired one | Clear error; no `user_account` row; can resend after 60 s | | |
| TC-03 | FR-AUTH-02 | Password rules | Sign up with `abc123` and with mismatched confirm | Field errors; nothing submitted | | |
| TC-04 | FR-AUTH-01 | Role redirect | Log in as applicant (with/without profile), HR, admin | `/applicant` or `/applicant/setup`; HR/admin → `/admin` | | |
| TC-05 | FR-AUTH-03 | Remember me | Log in with Remember me on, close browser, reopen; repeat with it off | On: still signed in. Off: signed out | | |
| TC-06 | FR-AUTH-04 | Forgot password | Request reset → open link → set new password → log in | New password works; old one fails | | |
| TC-07 | FR-AUTH-05 | Google sign-in | First Google sign-in with a new Gmail | Applicant account without a code; goes to setup | | |
| TC-08 | FR-AUTH-07 | Admin creates HR | Admin adds HR → HR logs in | HR lands on `/admin`; no User Management / Competencies in nav | | |
| TC-09 | FR-AUTH-08 | Deactivated account | Admin deactivates HR → HR logs in | Login refused with a message; API returns 401/403 | | |
| TC-10 | FR-AUTH-08 | Role enforcement | Applicant token calls `GET /api/admin/companies` | 403 `FORBIDDEN` | | |

## 2. Profile, resume, documents

| TC | FR | Scenario | Steps / data | Expected result | Actual | Status |
|---|---|---|---|---|---|---|
| TC-11 | FR-PROF-01 | Non-PDF / too large / scanned | Upload `.docx`, 12 MB PDF, scanned PDF | Specific error each time; nothing saved | | |
| TC-12 | FR-PROF-02/03 | Auto-fill | Upload A1 resume | Card pre-filled (name, birthday, gender, city, province, education); age computed | | |
| TC-13 | FR-PROF-04 | Confirm before save | Edit two fields → Confirm profile | `applicant`, `resume`, `resume_extraction` saved together; draft removed | | |
| TC-14 | FR-PROF-04 | Abandon setup | Upload, close browser before confirming | No `applicant` row; draft purged after 24 h | | |
| TC-15 | FR-PROF-05 | Edit profile | Change address → Save changes | Saved; email not editable | | |
| TC-16 | FR-PROF-06 | Replace resume | No active application → Replace resume → confirm | New current resume; old archived/deleted; verification = pending | | |
| TC-17 | FR-PROF-07 | Replace blocked | Applicant with a `shortlisted` application tries to replace | Button disabled with reason; API returns `BUSINESS_RULE` | | |
| TC-18 | FR-DOC-01/02 | Upload documents | Upload TOR and NBI clearance before applying | Listed with type, size, date, "For verification" | | |
| TC-19 | FR-DOC-04 | Re-upload document | Re-upload TOR | Old row not current; new one pending | | |

## 3. Companies and vacancies

| TC | FR | Scenario | Steps / data | Expected result | Actual | Status |
|---|---|---|---|---|---|---|
| TC-20 | FR-COMP-02 | Add company | Fill all fields incl. website | Appears in list; detail drawer shows contact person | | |
| TC-21 | FR-COMP-02 | Duplicate company | Add "kabayan mart" | `CONFLICT` error on the name field | | |
| TC-22 | FR-COMP-01 | Search | Search "kaba" | Kabayan Mart only | | |
| TC-23 | FR-VAC-01 | Weights ≠ 100 | Section weights A 30 / B 40 / C 20 → Publish | Publish blocked; total shows 90% in error tone | | |
| TC-24 | FR-VAC-01 | Cap too low | Slots 2, cap 6 | Validation: cap must be ≥ 8 | | |
| TC-25 | FR-VAC-03 | Publish | Valid Cashier → Publish | Status Active; visible to applicants | | |
| TC-26 | FR-VAC-04 | Agency branding | Applicant opens Cashier list + detail; inspect API response | No company name/fields anywhere | | |
| TC-27 | FR-VAC-07 | Auto-close at cap | Submit applications until cap | Vacancy `closed`; hidden; further applies refused | | |

## 4. Applying, prescreen, matching

| TC | FR | Scenario | Steps / data | Expected result | Actual | Status |
|---|---|---|---|---|---|---|
| TC-28 | FR-APP-01 | Apply without profile | New account → Apply | Redirected to setup | | |
| TC-29 | FR-APP-02 | Radio required | Open Apply → Submit without choosing | Submit disabled / field error | | |
| TC-30 | FR-APP-03 | Prescreen fail | Applicant aged 40 applies to Cashier (max 35) | `prescreen_failed`; notification names the age condition | | |
| TC-31 | FR-APP-04 | Below threshold | Unrelated resume (nurse) applies | Matching < 40 → `below_threshold`; notified | | |
| TC-32 | FR-APP-04/05 | Enters waiting pool | A1 (cashier experience) applies as Experienced | `matching_result` saved with weights 0.5/0.5; status `waiting_pool` or `shortlisted` | | |
| TC-33 | FR-APP-04 | First-time weights | A2 applies as First-time | `matching_result.weights` = {skills:1, experience:0} | | |
| TC-34 | FR-APP-06 | No re-apply | A1 applies to Cashier again | `CONFLICT`; button shows existing status | | |
| TC-35 | BR-01 | Shortlist size | 6 experienced applicants above threshold, slots 2 | Top 4 by matching `shortlisted`, 2 remain `waiting_pool` | | |
| TC-36 | BR-12 | Locked slot | HR starts verifying #4; a new applicant scores higher than #4 | #4 stays shortlisted; the newcomer displaces only an unlocked one or waits | | |

## 5. Resume screening

| TC | FR | Scenario | Steps / data | Expected result | Actual | Status |
|---|---|---|---|---|---|---|
| TC-37 | FR-SCR-01 | Two groups | Open Cashier in Resume Screening | Tabs *Applicants with Work Experience* / *First-Time Job Seekers*, each ≤ 4, ordered by matching | | |
| TC-38 | FR-SCR-02/03 | Verify | Mark resume and TOR verified | Status updates; `verification_started_at` set | | |
| TC-39 | FR-SCR-04 | Request new copy | Request NBI clearance with reason | Applicant gets email + in-app with reason and deadline (3 days) | | |
| TC-40 | FR-DOC-03 | Fulfil request | Applicant uploads NBI clearance | Request `fulfilled`; HR alert | | |
| TC-41 | FR-SCR-05 | Request expires | Move `due_at` to the past; run job | Application `dropped`; next waiting applicant `shortlisted` | | |
| TC-42 | FR-SCR-06 | Schedule gating | One document still pending | Schedule interview disabled with reason | | |

## 6. Interviews and evaluation

| TC | FR | Scenario | Steps / data | Expected result | Actual | Status |
|---|---|---|---|---|---|---|
| TC-43 | FR-INT-02 | Schedule | Schedule A1 with link | `interview_scheduled`; email + pop-up; deadline 3 days | | |
| TC-44 | FR-INT-04 | *(removed Oct 7, 2026)* Confirm terminates others | — | Replaced by TC-73: an applicant can no longer hold a second ongoing application | | |
| TC-45 | FR-INT-03 | Reschedule limit | Request reschedule 3 times | First 2 accepted (HR sets new time); 3rd refused | | |
| TC-46 | FR-INT-05 | No confirmation | Let `confirm_due_at` pass; run job | `dropped`; slot refilled | | |
| TC-47 | FR-INT-07 | Reminder | Confirmed interview within 24 h; run job | One reminder email + in-app; not sent twice | | |
| TC-48 | FR-INT-06 | Evaluate (worked example) | Section weights A 30 / B 30 / C 40; ratings A 5,4,4 · B 4,4,4,4,5,4,3,4,4 · C 4,4,4; matching 79.31 (experienced) | Sections 83.33 / 75.00 / 75.00; interview 77.50; overall rating 4; final 78.41; `passed` (passing 75) — same values in evaluation, ranking, and matching details | | |
| TC-49 | FR-INT-06 | Missing rating | Save with one competency unrated | Validation error; nothing saved | | |

## 7. Ranking, endorsement, outcomes

| TC | FR | Scenario | Steps / data | Expected result | Actual | Status |
|---|---|---|---|---|---|---|
| TC-50 | FR-END-01 | Combined ranking | Evaluate 4 applicants from both groups | One list ordered by final, then matching | | |
| TC-51 | FR-END-02 | Did not pass | Final 70 (passing 75) | `did_not_pass`; added to Applicant Pool; notified | | |
| TC-52 | FR-END-03/04 | Notify and confirm | Notify top 3 → A1 confirms, A3 declines | A1 `for_endorsement`; A3 `archived` | | |
| TC-53 | FR-END-04 | Confirmation expires | Let `action_due_at` pass; run job | `archived` | | |
| TC-54 | FR-END-05 | Generate + send | Generate form → Send to company | PDF + XLSX stored; email received at contact address; applicants `endorsed`; vacancy `endorsing` | | |
| TC-55 | FR-END-06 | Standby | A passed applicant not notified when the endorsement is sent | `standby` + Applicant Pool | | |
| TC-56 | FR-END-07/09 | Outcomes fill slots | Mark 2 hired, 1 not hired | Hired notified; not hired → pool; vacancy `filled` | | |
| TC-57 | FR-END-08 | Post-hiring | Enter details → Send; later Mark training failed | Applicant receives details; training failed → pool | | |

## 8. Applicant pool

| TC | FR | Scenario | Steps / data | Expected result | Actual | Status |
|---|---|---|---|---|---|---|
| TC-58 | FR-POOL-01 | Pool list | Open Applicant Pool | Entries with reason, last scores, ratings | | |
| TC-59 | FR-VAC-02 | Find matches | New vacancy → Find matches in applicant pool | Pool applicants passing prescreen and threshold, ranked by matching | | |
| TC-60 | FR-POOL-02/03 | *(to be revised)* Suggested vacancy | HR offers pooled A3 a vacancy → A3 accepts | Normal application: prescreen, fresh matching, shortlist, document screening; ratings reused (TC-78), no interview; appears in ranking | | |
| TC-61 | FR-POOL-03 | *(deferred: resume replacement)* Verification reset | — | — | | |
| TC-62 | FR-POOL-04 | *(removed Oct 7, 2026)* No shortlist slot | — | Replaced by TC-80: pool and reuse applications take shortlist slots | | |

## 9. Dashboards, notifications, settings

| TC | FR | Scenario | Steps / data | Expected result | Actual | Status |
|---|---|---|---|---|---|---|
| TC-63 | FR-ADM-01 | Dashboard counts | Compare tiles with SQL counts (DATABASE_SCHEMA §6.5) | Equal; upcoming interviews sorted by date/time | | |
| TC-64 | FR-ADM-02 | Applicant detail | Open A1 | Profile, documents (download + ZIP), status timeline | | |
| TC-65 | FR-ADM-03 | Change deadline | Set response deadline to 5 days → request a document | Deadline = now + 5 days | | |
| TC-66 | FR-NOTIF-01 | Feed | Trigger 3 notifications → open bell → Mark all read | Unread count 3 → 0 | | |
| TC-67 | FR-NOTIF-02 | Email outage | Wrong SMTP password → schedule interview | Status change saved; `email_status = failed` after retries | | |

## 9b. One ongoing application, company block, rating reuse *(decided Oct 7, 2026)*

| TC | Ref | Scenario | Steps / data | Expected result | Actual | Status |
|---|---|---|---|---|---|---|
| TC-73 | BR-17, FR-APP-08 | Ongoing blocks applying | A1 is `shortlisted` for Store Crew → opens Cashier → Apply | Apply disabled with "You have an ongoing application for Store Crew…"; API `POST` → 409 with the same reason; nothing written | | |
| TC-74 | BR-18 | Apply again after a failure | A1 `did_not_pass` at Kabayan Mart → opens a ClayGo vacancy | Apply enabled; the failure notification said "You can apply to other jobs" | | |
| TC-75 | BR-19, FR-APP-09 | Failed company hidden | A1 `not_hired` at Kabayan Mart (also try `dropped`) → Job Vacancies; open a Kabayan Mart vacancy URL; call the apply API | Kabayan Mart vacancies missing from the list; detail = "This job is no longer open."; apply → 404 "This job is not available for your application."; no company name or reason anywhere | | |
| TC-76 | BR-19 | Prescreen failure does not block | A4 (aged 40) `prescreen_failed` on Cashier → Kabayan Mart posts a vacancy without an age limit | The new vacancy is listed and A4 can apply (RA 10911: no permanent age-based block) | | |
| TC-77 | BR-20 | Fresh matching per vacancy | A1 applies to Store Crew after Cashier ended, choosing First-time this time | New `matching_result` against Store Crew with weights 1/0; the Cashier score is not reused | | |
| TC-78 | BR-21, WSM-03 | Rating reuse, no interview | A1 (interviewed for Cashier: worked-example ratings) applies to Store Crew, is shortlisted, documents verified → HR clicks **Compute final score (reused ratings)** | No interview scheduled; interview 76.67 (A 20 / B 80 / C 0), final (80.00 + 76.67) / 2 = 78.34 with the illustrative matching; `ratings_source_application_id` = the Cashier application | | |
| TC-79 | BR-22, BR-19 | Close-out, no company block | Store Crew becomes `filled` with A5 `waiting_pool`, A6 locked `shortlisted`, A7 `passed` (not endorsed); also check a cap-close | A5, A6 → `not_selected` (notified, applicant pool), A7 → `standby`; ClayGo's other vacancies stay visible to A5/A6 (`not_selected` does NOT block); a cap-close keeps the waiting pool | | |
| TC-80 | BR-21, BR-01 | Reuse still takes a shortlist slot | Slots 1, one reuse applicant and two direct applicants above threshold | Top 2 by matching shortlisted, whoever they are; the reuse applicant goes through document screening | | |
| TC-81 | FR-POOL-02, BR-17/19 | *(to be revised)* Suggested vacancy respects the rules | HR offers pooled A3 a vacancy at a company where A3 failed; and while A3 has an ongoing application | Neither offer is possible | | |
| TC-82 | BR-17 | Hired blocks applying | A2 `hired` → opens any vacancy; later HR marks training failed | Apply disabled ("You are hired as …"), API 409; after `training_failed` A2 can apply elsewhere (not to that company) | | |
| TC-83 | BR-17 | Simultaneous applies | A1 submits two different vacancies at the same moment (two tabs) | Exactly one application is created; the other gets the ongoing message (index `application_one_ongoing_per_applicant`) | | |
| TC-84 | BR-21, WSM-03 | Reuse chain resolves to the interview | A1: Cashier (interviewed) → Store Crew (reused) → third vacancy | The third evaluation uses the Cashier interview's 15 ratings; its `ratings_source_application_id` = the Cashier application | | |

## 10. Algorithm (also unit-tested)

| TC | Ref | Scenario | Steps / data | Expected result | Actual | Status |
|---|---|---|---|---|---|---|
| TC-68 | COS-01 | Cosine properties | identical, orthogonal, opposite vectors | 1, 0, −1 | | |
| TC-69 | COS-02, MAT-02..04 | Worked example | ALGORITHM.md §6 similarity values | skills 0.875, experience 0.7111, experienced 79.31, first-time 87.50 | | |
| TC-70 | SBERT-02, EXT-02 | Paraphrase vs unrelated | (a) "Cash handling" vs "Handled cash" and vs "welding"; (b) "POS system operation" vs "point-of-sale terminal" before and after standardization | (a) paraphrase ≥ 0.65 (full credit), unrelated ≤ 0.35 (no credit); (b) raw ≈ 0.22 (no credit), standardized "POS terminal" ≈ 0.65 (credit) | | |
| TC-71 | MAT-03 | Overlapping dates | Ranges Jan 2021–Dec 2022 and Jun 2022–Jun 2023 | Years = 2.5 (overlap counted once) | | |
| TC-72 | — | Algorithm markers | `pnpm algo:check` | Passes; every implemented step has a `VERA-ALGO` block | | |
