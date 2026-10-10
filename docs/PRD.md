# VERA — Product Requirements Document (PRD)

| | |
|---|---|
| Product | **VERA** — Verified Evaluation and Recruitment Assistant |
| Client | Confiable Manpower Solutions Inc. (manpower agency) |
| Type | BS Computer Science thesis — web-based recruitment management system |
| Version | 1.0 (aligned with the final process review, 2026-10-06) |
| Related | [TRD](./TRD.md) · [DATABASE_SCHEMA](./DATABASE_SCHEMA.md) · [APP_FLOW](./APP_FLOW.md) · [ROADMAP](./ROADMAP.md) · [ALGORITHM](./ALGORITHM.md) · [UI_GUIDELINES](./UI_GUIDELINES.md) · [test-cases](./test-cases.md) |

---

## 1. Overview

### 1.1 Problem
Confiable runs recruitment through disconnected tools: Facebook/TikTok for postings, Gmail for resumes, Messenger for applicants, Viber for clients, and Google Sheets/Excel for records. Resumes are screened by hand, evaluation is inconsistent between HR staff, and applicants have no visibility into their status.

### 1.2 Solution
One platform where:
- client companies' manpower requests become **agency-branded vacancies**;
- applicants apply with **one stored resume** (no duplicates);
- the system **prescreens** basic conditions and computes a **resume matching score** (Sentence-BERT + cosine similarity) the moment someone applies;
- HR only **verifies documents** of an automatically ranked shortlist;
- HR rates competencies after an **online interview**, the system computes an **interview score** (Weighted Sum Model) and a **final score**;
- the best candidates are **endorsed** to the company, and outcomes feed a reusable **talent pool**;
- an applicant has **one ongoing application at a time**; after an unsuccessful one they may apply elsewhere, and their earlier competency ratings are **reused** with the new vacancy's weights instead of a new interview.

**Decision support, not decisions:** VERA recommends (matching, shortlist, scores, ranking, rematch suggestions); **HR** verifies, rates, endorses, and decides whether to offer a suggested job; the **applicant** decides whether to apply again or accept an offer; the **client** makes the final hiring decision. *(decided Oct 7, 2026)*

### 1.3 Goals
1. Cut manual resume screening: HR reviews only the shortlist (2 × slots per applicant group).
2. Make evaluation consistent and explainable (scores with matched/missing skills and per-competency ratings).
3. Give applicants real-time status and notifications.
4. Keep the full recruitment trail (status history) in one database.

### 1.4 Non-goals (delimitations)
- No automated hiring decisions. Scores are decision support: VERA recommends, the applicant decides whether to apply or accept a suggested vacancy, HR evaluates and endorses, and the client makes the final hiring decision.
- Client companies are **not users**. Company interviews, results, and post-hiring details are communicated outside VERA and encoded by HR.
- No payroll, attendance, performance, benefits, or post-deployment monitoring.
- No OCR: resumes must be **text-based PDFs in English**. DOCX/images are a later phase.
- No automatic authenticity checking of documents (HR verifies manually).

---

## 2. Users and roles

| Role | Who | Can do |
|---|---|---|
| **Administrator** | Agency owner / system admin (one) | Everything HR can do **plus** manage HR accounts, roles, and the fixed competency list |
| **HR personnel** | Agency recruiters | Companies, vacancies, screening, interviews, evaluation, endorsement, talent pool, settings (deadlines) |
| **Applicant** | Job seekers | Register, build profile from resume, apply, upload documents, confirm interviews/endorsement, view status and notifications |

Client companies receive endorsement emails only.

---

## 3. Glossary

| Term | Meaning |
|---|---|
| **Vacancy** | A job posting created from a client's manpower request. Applicants see it under the agency name only. |
| **Slots** | Number of workers the client needs. |
| **Applicant type** | `first_time` or `experienced`, chosen by radio button when applying. Controls matching and screening group. |
| **Prescreen** | Automatic hard-filter check of the profile (age, gender, education, height) against the vacancy. |
| **Matching score** | 0–100. SBERT similarity of the resume's skills (first-time) or skills + experience (experienced) to the vacancy requirements. |
| **Matching threshold** | Minimum matching score to stay in the process (default 40). |
| **Waiting pool** | Scored applications waiting for a shortlist slot, per vacancy and group. |
| **Shortlist** | Top `2 × slots` per group, shown in Resume Screening for document verification. |
| **Interview score** | 0–100. Σ (competency weight × rating ÷ 5). Weighted Sum Model. |
| **Final score** | (matching score + interview score) ÷ 2. |
| **Passing score** | Minimum final score set per vacancy. |
| **Endorsement count** | How many passed applicants HR endorses (≥ slots, extra as a safety margin). |
| **Talent pool** (UI label: **Applicant Pool**) | Applicants who passed the agency process but were not placed, or did not pass; reusable for other vacancies. |
| **Archive** | Applications closed because the applicant declined/ignored the endorsement confirmation. Applicant may still apply elsewhere. |

---

## 4. Functional requirements

IDs are referenced by the roadmap, tests, and commit messages (e.g. `feat(apply): FR-APP-03 prescreen`).

### 4.1 Authentication and accounts (AUTH)
- **FR-AUTH-01** Single login page; after login, redirect by role (`admin`/`hr` → `/admin`, `applicant` → `/applicant` or `/applicant/setup` if no profile).
- **FR-AUTH-02** Email + password login. Email is the username. Password rules: ≥ 8 chars, at least 1 letter and 1 number.
- **FR-AUTH-03** **Remember me**: checked → session persists across browser restarts; unchecked → session ends when the browser closes.
- **FR-AUTH-04** **Forgot password**: email reset link → set new password page.
- **FR-AUTH-05** **Sign in with Google** (applicants). First Google sign-in creates an applicant account with no verification code.
- **FR-AUTH-06** **Applicant sign-up**: email, password, confirm password → a 6-digit code is emailed → account is created only after the code is verified.
- **FR-AUTH-07** The admin creates HR accounts (email, full name, temporary password); HR cannot self-register. Admin can deactivate/reactivate HR accounts.
- **FR-AUTH-08** Inactive accounts cannot log in. All API routes check role server-side.

### 4.2 Applicant profile and resume (PROF)
- **FR-PROF-01** A new applicant must upload a resume before the profile exists. Only text-based PDF ≤ 10 MB.
- **FR-PROF-02** The system extracts personal information and pre-fills the profile card: first, middle, last name, suffix, gender, birthday, house/street, municipality/city, province, education level (plus contact number and height when found). Age is shown, computed from birthday. Education level = the highest level stated; an old-curriculum "High School" / "High School Graduate" (no Junior/Senior wording) pre-fills as **Senior high school** (decided Oct 6, 2026); the applicant can change it before confirming.
- **FR-PROF-03** The system extracts skills and work experience (and years of experience) for matching.
- **FR-PROF-04** The applicant reviews/edits every field and confirms; only then are the profile, resume, and extraction saved together.
- **FR-PROF-05** Applicants can edit their profile later (except email).
- **FR-PROF-06** Applicants can **replace** their resume in My Documents: re-parse → review profile changes → confirm. The new resume replaces the old one (old one archived if used by an application, otherwise deleted). Verification status resets to pending.
- **FR-PROF-07** Resume replacement is blocked while the applicant has an active application; the UI explains why.
- **FR-PROF-08** Applicant dashboard: application status panel (each application with its current stage), interview schedule pop-up requiring confirmation, endorsement confirmation pop-up, recent notifications.

### 4.3 Supporting documents (DOC)
- **FR-DOC-01** Applicants upload supporting documents in My Documents with a type (TOR, diploma, NBI clearance, police clearance, barangay clearance, valid ID, birth certificate, certificate, medical certificate, other + label). PDF only for now.
- **FR-DOC-02** Documents can be uploaded in advance, before any request.
- **FR-DOC-03** HR document requests appear as action items with reason and deadline; uploading the requested type fulfills the request.
- **FR-DOC-04** Re-uploading a document replaces it and resets its verification. An applicant has **one current document per type**: uploading a type they already have replaces it (old row kept, not current). **Certificate** and **Other** may have several, each with a label (required for Other); those are replaced only through that row's Re-upload. Applicants cannot remove documents (HR's verification history stays intact). *(decided Oct 7, 2026)*

### 4.4 Companies (COMP)
- **FR-COMP-01** HR lists and searches companies by name.
- **FR-COMP-02** HR adds/edits a company: name, industry, description, website, contact person name, position, email, number.
- **FR-COMP-03** Company detail: info, number of vacancies, endorsed, for-interview, and hired counts. Counts *(decided Oct 7, 2026)*: **Vacancies** = non-archived (with the open count); **In agency interview** = applications `interview_scheduled` / `interview_confirmed`; **Awaiting client** = endorsement items in sent endorsements with outcome `pending`; **Hired** = outcome `hired`; **Total endorsed** = all endorsement items in sent endorsements.

### 4.5 Vacancies (VAC)
- **FR-VAC-01** HR creates a vacancy under a company: title, description, key responsibilities, required skills, experience requirement, minimum years, prescreen conditions (age range, gender, minimum education, minimum height), deployment location, employment type, slots, application cap, endorsement count, matching threshold, passing score, and **weights for the 3 Competency Profile sections** (A, B, C; total 100%, a section may be 0%; §5.1). *(S9b, decided Oct 7, 2026)*
- **FR-VAC-02** Before posting HR can run **Find matches in talent pool**: the system scores active talent-pool applicants against the vacancy and lists those who pass prescreen and the threshold, so HR can invite them.
- **FR-VAC-03** HR publishes (`open`), closes/pauses, and archives vacancies. Publishing requires weights = 100. *(decided Oct 7, 2026)* A draft is fully editable (weights total 0 or 100). After publishing (open, closed, endorsing) HR may edit only the posting text — title, description, key responsibilities, deployment location, employment type — and may **raise** (never lower) the application cap; matching inputs, prescreen conditions, threshold, passing score, slots, endorsement count, and weights are locked so every applicant is judged by the same rules.
- **FR-VAC-04** Applicants see only `open` vacancies, with agency branding, never the company.
- **FR-VAC-05** HR vacancy list shows company, status, slots, remaining slots, applicant counts per stage; search by title/company.
- **FR-VAC-06** Vacancy detail shows the final ranking (combined groups) with **Notify** and **View matching details** per applicant.
- **FR-VAC-07** Vacancy auto-closes when the application cap is reached; becomes `endorsing` when the first endorsement is sent; becomes `filled` (hidden, kept as a record) when hired count = slots. A closed vacancy can be reopened only while applications < cap (qualified applications, FR-APP-07); otherwise HR must raise the cap first (the Reopen dialog offers "Raise the application cap to reopen"). *(decided Oct 7, 2026)*

### 4.6 Applying (APP)
- **FR-APP-01** Applicants can browse vacancies without a profile, but **Apply** requires a confirmed profile (otherwise redirect to setup).
- **FR-APP-02** Apply dialog: one required radio button — *First-time job seeker* / *Experienced* — then Submit. No other form; the stored profile and current resume are used.
- **FR-APP-03** **Prescreen** immediately; failure → `prescreen_failed` + notification with the unmet condition.
- **FR-APP-04** **Matching** immediately from the stored extraction: first-time = skills only; experienced = skills 50% + experience 50% (with minimum years); skills only for both when the vacancy has no experience criterion (BR-04). Below threshold → `below_threshold` + notification.
- **FR-APP-05** Otherwise → `waiting_pool`; the shortlist is refreshed.
- **FR-APP-06** One application per vacancy ever; no withdrawal.
- **FR-APP-08** **One ongoing application at a time** (BR-17): Apply is refused (409) and disabled with the reason while the applicant has an ongoing or hired application. There is no list of preferred positions. *(decided Oct 7, 2026)*
- **FR-APP-09** **Company block** (BR-19): vacancies of a company where the applicant has a failed application are left out of their job list, their detail answers like a closed job, and Apply is refused with "This job is not available for your application." The applicant is never told the company or the reason (BR-16, RA 10911). *(decided Oct 7, 2026)*
- **FR-APP-07** When the cap is reached, the vacancy stops accepting applications (it closes automatically). The cap counts **qualified** applications only: every status except `prescreen_failed` and `below_threshold`, so rejected applicants never use it up. *(decided Oct 7, 2026)*

### 4.7 Resume screening (SCR)
- **FR-SCR-01** Per vacancy, two tabs/groups: Experienced and First-time. Each shows the auto-shortlisted applicants (top `2 × slots` by matching score) — no "Run screening" button.
- **FR-SCR-02** Opening an applicant shows profile, resume, supporting documents, and matching details. HR marks each item verified/rejected (a rejection needs remarks). Rejecting does not drop the application: HR then requests a new copy or drops it (FR-SCR-05). Verification is stored per applicant document and carries across applications. A re-uploaded document returns to pending and is marked **New upload to verify**. *(decided Oct 7, 2026)*
- **FR-SCR-03** HR's first verify, reject, or document-request action on the application sets `verification_started_at`, locking that applicant's slot. An applicant whose documents were already verified stays unlocked until HR acts.
- **FR-SCR-04** HR can request a document or a new copy with a mandatory reason; deadline = now + `response_deadline_days` (default 3). *Sprint:* the resume is not requestable while resume replacement is deferred; a resume that fails verification is rejected and the application dropped.
- **FR-SCR-05** Rejected/unanswered (expired) requests → application `dropped`; the next applicant in that group moves up automatically. *Sprint (simplified):* no automatic expiry; HR clicks **Drop** with a reason (failed verification, no response by the deadline, other). `dropped` is a failed outcome (BR-19); the applicant is told only that the application was closed and that they can apply to other jobs.
- **FR-SCR-06** **Schedule interview** is enabled only when the resume and all current supporting documents are verified and no request is pending ("fully verified"; no per-vacancy list of required types; HR requests anything missing). With earlier ratings on file (BR-21) the next step is **Compute final score (reused ratings)** instead. *(decided Oct 7, 2026)*

### 4.8 Interview assessment (INT)
- **FR-INT-01** One combined list per vacancy (both groups) from `interview_scheduled` onward.
- **FR-INT-02** HR schedules an online interview (date/time, duration, meeting link, interviewer). Applicant must confirm within 3 days. *(Sprint, S13, decided Oct 8, 2026: scheduled from the review sheet once fully verified and only without ratings on file (BR-21); times are entered in Philippine time; confirm deadline = the earlier of now + `response_deadline_days` and the interview time, shown but not enforced (confirming is refused only once the interview time has passed); the meeting link is shown to the applicant only after confirming; HR can **edit the time** in place: a confirmed interview stays confirmed and the applicant is notified to contact the agency if they can't attend.)*
- **FR-INT-03** Applicant can confirm or request a reschedule (with reason). HR picks the new date. Max **2** reschedules.
- **FR-INT-04** *(replaced Oct 7, 2026 by BR-17)* Confirming an interview does not touch any other application: an applicant has at most one ongoing application (BR-17).
- **FR-INT-05** No confirmation by the deadline, or no-show → `dropped`; next in line moves up. *(Sprint, S13: no automatic expiry; HR clicks **Mark no-show**, allowed for an unconfirmed interview once the confirmation deadline or the interview time has passed (attempt `expired`, drop reason "no response") and for a confirmed one once the interview time has passed (attempt `no_show`, drop reason "other — No-show"); both go through the Resume Screening drop: `dropped` (failed outcome, BR-19), neutral notice, slot refilled. Earlier → 409.)*
- **FR-INT-06** After the interview, HR rates **all 15 Competency Profile items** 1–5 (§5.1; interpretations shown with each rating). The system computes the section scores, the interview score (BR-06), the **overall rating of probability of success** (informational, §5.1), and the final score, and sets `passed` / `did_not_pass`. *(Sprint, S14, decided Oct 10, 2026: HR can evaluate only a confirmed interview (`interview_confirmed`, attempt `confirmed`) once its start time has passed, checked by the database clock under the locks like Mark no-show; earlier → "The interview has not started yet." An unconfirmed interview is not evaluated (HR uses Mark no-show). All 15 items are required; the server recomputes every score from the ratings and never trusts scores sent by the browser. An evaluation is final (no edit; a second save is refused). Saving sets the interview attempt to `completed`. `passed` gets no notification until HR notifies (FR-END-03). `did_not_pass` → applicant pool (an earlier active pool entry is closed, so there is one active entry) and a neutral notice "Application update: {job}" without scores, company, or reason, ending "You can apply to other jobs." (BR-18). The same rules apply to rating reuse (FR-INT-08), which starts from `shortlisted` after full verification.)*
- **FR-INT-07** Reminder notification 24 h before the interview.
- **FR-INT-08** **Rating reuse** (BR-21): an applicant with a completed evaluation from an earlier application is **not interviewed again**. After their documents are verified, HR clicks **Compute final score (reused ratings)**; the interview score is recomputed from their earlier 15 item ratings with the new vacancy's section weights. *(decided Oct 7, 2026)*

### 4.9 Final ranking and endorsement (END)
- **FR-END-01** Final ranking per vacancy (combined): final score desc, ties by matching score then application time. *(Sprint, S15, decided Oct 10, 2026: every evaluated application of the vacancy is listed, whatever its status now, so the ranking stays a record; the last tie-break is the application id, so every rank is unique (RANK-03).)*
- **FR-END-02** `did_not_pass` → talent pool (`did_not_pass`) with ratings saved; applicant notified.
- **FR-END-03** HR clicks **Notify** on passed applicants up to the endorsement count; auto-generated message (editable) via email + in-app → `passed_awaiting_confirmation`. *(Sprint, S15, decided Oct 10, 2026: HR may notify any passed applicant (the UI preselects the top ones); "up to the endorsement count" = endorsement count − (passed_awaiting_confirmation + for_endorsement + endorsed), as in BR-23, hired not counted; only while the vacancy is open, closed, or endorsing. HR edits only the message body, never the title or the deadline; a body naming the client company is refused; the system appends "Please confirm on your dashboard by {date} (Philippine time)." with the deadline = now + `response_deadline_days` (BR-08). In-app only; emails are deferred.)*
- **FR-END-04** Applicant confirms within 3 days → `for_endorsement`; declines or ignores → `archived`. *(Sprint, S15, decided Oct 10, 2026: the deadline is shown, not enforced (automatic expiry deferred); the applicant can answer while the status is still `passed_awaiting_confirmation`. Decline → `archived`: neutral, no applicant-pool entry, no company block (BR-15). HR is notified of either answer.)*
- **FR-END-05** Endorsement Management: per vacancy, list `for_endorsement` applicants; generate the endorsement form (PDF profile per applicant + XLSX summary), send it to the company contact email, and allow download. Applicants → `endorsed`; vacancy → `endorsing`.
- **FR-END-06** When the endorsement is sent, remaining `passed` applicants of that vacancy → `standby` + talent pool (`standby`).
- **FR-END-07** HR records each endorsed applicant's outcome: **hired** → `hired` + notification; **not hired** → `not_hired`, then the automatic rematch (FR-END-10); the applicant enters the pool only if no suggestion is accepted.
- **FR-END-08** For hired applicants HR enters and sends post-hiring details (training schedule, pre-employment requirements, orientation, deployment). HR can mark training failed → `training_failed` + talent pool.
- **FR-END-10** *(planned, S17)* **Automatic rematch after a client rejection** (BR-23): right after **Mark as not hired**, VERA rescans every open vacancy for that applicant and suggests the best one to HR (job, company, matching, final). HR **offers** it or **skips** it (the next candidate appears); the applicant **accepts** (→ `for_endorsement` at that vacancy, no shortlist, screening, or interview) or **declines** (→ applicant pool). *(decided Oct 7, 2026)*
- **FR-END-09** When hired = slots → vacancy `filled`. If every endorsed applicant fails, HR checks the talent pool (FR-VAC-02); if none qualifies, HR reopens the vacancy. Reopening follows FR-VAC-07: applications must be below the cap, and HR may raise the cap (never lower it) to reopen.

### 4.10 Talent pool (POOL)
- **FR-POOL-01** List active pool entries with reason, stage reached, last scores, stored ratings; search and filter.
- **FR-POOL-02** *(planned, S17)* Suggested vacancies come from the **automatic rematch** only (FR-END-10, BR-23): HR offers a suggestion, the applicant accepts or declines. Manual HR invitations (`pool_invitation`) are deferred (ROADMAP §6); pooled applicants apply by themselves with rating reuse (BR-21).
- **FR-POOL-03** *(planned, S17)* An accepted rematch offer creates the application directly as `for_endorsement` (BR-23). A self-applied pooled applicant follows the normal flow (prescreen, fresh matching, shortlist, document screening; BR-20) with rating reuse instead of an interview (BR-21).
- **FR-POOL-04** *(removed Oct 7, 2026)* Pool applications compete for shortlist slots like every other application (BR-21).
- **FR-POOL-05** The pool entry is closed (`removed_at`) when the applicant is hired, or replaced by a new entry when they re-enter the pool.

### 4.11 Applicant management, dashboards, settings (ADM)
- **FR-ADM-01** HR dashboard: totals (applicants, waiting pool, for screening, for interview, for endorsement, hired, active vacancies) and upcoming interviews sorted by date/time.
- **FR-ADM-02** Applicant Management: summary cards and a searchable list; view profile, documents, application history (status timeline); download documents (single and ZIP).
- **FR-ADM-03** Settings (HR/admin): response deadline days, interview reminder hours, default threshold, default cap multiplier.
- **FR-ADM-04** Admin only: User Management (HR accounts) and Competency list management.

### 4.12 Notifications (NOTIF)
- **FR-NOTIF-01** In-app notification feed with unread count; mark read / mark all read.
- **FR-NOTIF-02** Email for action-required and major status events (catalog in TRD §9).
- **FR-NOTIF-03** HR in-app alerts: interview confirmed/reschedule requested, requested document uploaded, endorsement confirmed/declined.

---

## 5. Business rules

| ID | Rule |
|---|---|
| BR-01 | `shortlist_per_group = slots × 2` (fixed by the system), separately for first-time and experienced. |
| BR-02 | `application_cap ≥ slots × 4` (both groups' shortlists). Default `slots × 8`. The cap counts qualified applications (FR-APP-07). |
| BR-03 | `endorsement_count ≥ slots`. |
| BR-04 | First-time matching = skills only. Experienced = 0.5 × skills + 0.5 × experience (experience capped when below minimum years). A vacancy with **no experience criterion** (blank experience requirement and 0 minimum years) is matched on skills only for both groups, so experienced applicants get no free experience points. *(decided Oct 7, 2026)* |
| BR-05 | Below `matching_threshold` → `below_threshold` (dropped from the process). |
| BR-06 | Interview score (two-level WSM): section % = (mean of the section's item ratings − 1) ÷ 4 × 100; interview = Σ section weight % × section % ÷ 100; section weights total 100 (0% allowed); ratings 1–5; 2 decimals, half-up, computed in exact hundredths. |
| BR-07 | Final score = (matching + interview) ÷ 2. `passed` = final ≥ passing score. |
| BR-08 | Response deadline (documents, interview confirmation, endorsement confirmation, pool invitation) = `response_deadline_days` (default 3), adjustable by HR. |
| BR-09 | Max 2 interview reschedules; HR sets the new date. |
| BR-10 | *(replaced Oct 7, 2026 by BR-17)* Confirming an interview does not touch any other application: an applicant has at most one ongoing application (BR-17). |
| BR-11 | Slots freed **before evaluation** (dropped) are refilled from the waiting pool automatically. |
| BR-12 | Applicants with verification started are locked in the shortlist; a higher-scoring newcomer only displaces unlocked shortlisted applicants. |
| BR-13 | One current resume; replacement blocked during active applications; replacement resets verification. |
| BR-14 | One application per applicant per vacancy, no withdrawal. |
| BR-15 | Archived applicants (endorsement declined) may apply to other vacancies, including the same company's (neutral outcome, BR-19). |
| BR-16 | Applicants never see the client company. |
| BR-17 | **One ongoing application per applicant.** Ongoing = `waiting_pool`, `shortlisted`, `interview_scheduled`, `interview_confirmed`, `passed`, `passed_awaiting_confirmation`, `for_endorsement`, `endorsed`. A `hired` applicant cannot apply until `training_failed`. Enforced by the API and a database index. *(decided Oct 7, 2026)* |
| BR-18 | After a final outcome other than `hired`, the applicant may apply to other vacancies; failure notifications say so ("You can apply to other jobs"). |
| BR-19 | **Company block.** The company block applies only when the agency or client actually assessed and rejected the applicant, or the applicant failed to follow through. **Failed** (frees the applicant and blocks every vacancy of that company, forever): `did_not_pass`, `not_hired`, `training_failed`, `dropped`. **Neutral** (frees, no block): `prescreen_failed`, `below_threshold` (never assessed; a permanent block from an age-based prescreen would conflict with RA 10911), `not_selected`, `standby` (they passed), `archived` (their own decision), `terminated`. *(decided Oct 7, 2026)* |
| BR-20 | **Fresh matching per vacancy.** Every application runs prescreen, SBERT matching against that vacancy, and the threshold; matching scores are never reused. The applicant chooses First-time / Experienced again each time. *Exception (BR-23):* a rematch application carries the applicant type over and uses the rescan's matching for that same vacancy and resume. |
| BR-21 | **Rating reuse.** If the applicant has a completed evaluation from an earlier application, its 15 item ratings are reused and HR does not interview again. Source = the applicant's most recent completed evaluation (even `did_not_pass`), followed to the application whose ratings it used, so a chain of reuses always reaches the original interview; recorded in `final_evaluation.ratings_source_application_id`. Interview score = WSM-01 with the **new** vacancy's section weights; final = (new matching + recomputed interview) ÷ 2; passed = final ≥ the new vacancy's passing score. Shortlisting (BR-01) and document screening still apply. *Exception (BR-23):* an accepted rematch offer skips shortlist, document screening, and interview. |
| BR-22 | **Close-out.** When a vacancy becomes `filled` or `archived`: `waiting_pool`, `shortlisted` (locked or not), `interview_scheduled`, `interview_confirmed` → `not_selected` (neutral, applicant pool, notified); `passed` but not endorsed → `standby`. A cap-close or HR pause (`closed`) keeps the waiting pool. *(decided Oct 7, 2026)* *Sprint (S15, decided Oct 10, 2026):* "passed but not endorsed" includes `passed_awaiting_confirmation` and `for_endorsement`; `endorsed` stays (the client decides) and archiving is refused while any application is `endorsed`. Close-out runs only when HR archives (S15) or the vacancy fills (S16), recorded as the system; `not_selected` and `standby` both enter the applicant pool with a neutral notice and are not ongoing (BR-17). |
| BR-23 | **Automatic rematch** *(planned, S17; decided Oct 7, 2026)*. **Trigger:** only when an application becomes `not_hired` (passed the agency interview, endorsed, rejected by the client). Every other failure keeps BR-18..BR-21. **Rescan** (after the not_hired commit, never inside a transaction): every `open` vacancy minus companies where the applicant failed (BR-19), prescreen failures, vacancies whose endorsement is full (`passed_awaiting_confirmation + for_endorsement + endorsed ≥ endorsement_count`), and matches below the threshold. Applicant type carries over from the rejected application. Final = (new matching + interview from the original ratings, WSM-03, with that vacancy's weights) ÷ 2, half-up hundredths; keep final ≥ that vacancy's passing score; order matching desc, final desc, vacancy id (RANK-04). Every matched vacancy is stored for audit. **Suggestion:** HR sees the top candidate (job, company, matching, final) and offers or skips it; none left → applicant pool (`not_hired`). **Offer:** the applicant sees the job title, never the company or a score, and accepts or declines. **Accept** (applicant and vacancy rows locked): vacancy still open, endorsement not full, prescreen, BR-17, BR-19 re-checked → application (source `rematch`) with matching result and a final evaluation from the reused ratings, status `for_endorsement`; it counts toward the application cap and the endorsement count, never occupies a shortlist slot, and never displaces anyone. If a re-check fails, the offer is cancelled (committed), the applicant gets a neutral notice, and a new rescan runs after the commit. **Decline** → applicant pool. A pending offer is not ongoing; applying elsewhere cancels it. One rescan at a time per applicant; a new rescan supersedes earlier live suggestions/offers. A failed rescan (svc down) offers HR a **Rescan** button. |

### 5.1 Competency Profile (interview rubric) *(S9b, decided Oct 7, 2026)*

| Section | Items (each rated 1–5) |
|---|---|
| **A. Communication and Interpersonal Skills** | Oral Communication/Listening · Co-Worker Relations/Teamwork · Customer Relations |
| **B. Personal Effectiveness Skills and Traits** | Problem Solving · Time Management · Quality · Initiative and Perseverance · Personal Integrity · Adaptability · Stress Tolerance · Self-Development · Commitment |
| **C. Job Specific Skills and Experience** | Experience · Education / Training · Technical Skills |

| Rating | Interpretation |
|---|---|
| 1 | Does not achieve expectations / Major development need |
| 2 | Partially achieves expectations / Development need |
| 3 | Achieves expectations / Neither strength nor development need |
| 4 | Exceeds expectations / Strength |
| 5 | Greatly exceeds expectations / Major strength |

The **overall rating of probability of success** is automatic and informational (it never decides pass/fail):

| Interview score | Overall rating of probability of success |
|---|---|
| 80–100 | **5** — HIGH — Very good probability of success (80–100%) |
| 60–<80 | **4** — Good probability of success (60–80%) |
| 40–<60 | **3** — MODERATE — Moderate probability of success with adequate training and coaching (40–60%) |
| 20–<40 | **2** — Poor probability of success; training unlikely to correct problem areas (20–40%) |
| 0–<20 | **1** — LOW — Very poor probability of success; training extremely unlikely to correct problem areas (0–20%) |

---

## 6. Non-functional requirements (ISO/IEC 25010)

| Characteristic | Requirement |
|---|---|
| Functional suitability | Every FR above has at least one system test case (TRD §11). |
| Performance efficiency | Resume parse ≤ 10 s for a 3-page PDF; matching ≤ 3 s per application (SBERT preloaded); list pages ≤ 2 s with 1,000 applications. |
| Compatibility | Latest Chrome, Edge, Firefox; responsive down to 360 px width. |
| Usability | Shadcn/ui components, clear empty states, every destructive or irreversible action asks for confirmation. |
| Reliability | Status changes are transactional; scheduled jobs are idempotent; svc downtime returns a clear error and does not create half-saved data. |
| Security | Supabase Auth, role checks on every API route, RLS enabled with no public policies, private storage with signed URLs, secrets only in `.env`, rate-limited auth endpoints, no PII in logs. Data Privacy Act (RA 10173) consent checkbox at sign-up. |
| Maintainability | Feature-module structure, shared constants package, migrations for every schema change, CHANGELOG updated per release. |
| Portability | Runs locally with `pnpm dev` (web + api + svc in parallel via pnpm -r; Turborepo optional). |

---

## 7. Success metrics (thesis evaluation)

- Extraction accuracy: precision / recall / F1 of extracted skills and experience vs manual labels.
- Ranking agreement: Spearman's ρ between VERA's ranking and HR's ranking.
- Acceptability: ISO/IEC 25010 survey mean per characteristic (experts and intended users).
- Process: time spent screening per vacancy before vs after VERA.

---

## 8. Release scope

| Release | Scope |
|---|---|
| **Solo sprint MVP (Oct 7–13, defense-ready)** | Email/password login with remember me, sign-up with Supabase confirmation link, resume upload with auto-filled profile, documents, companies, vacancies with weights, apply with prescreen + SBERT matching + automatic shortlist, resume screening with document requests, interview scheduling and confirmation, competency evaluation (WSM) and final score, ranking with matching details, notify/confirm, printable endorsement, hired/not hired, post-hiring details, applicant pool with suggested vacancies, one ongoing application per applicant, company block, rating reuse, HR dashboard, applicant management, in-app notifications. Build order: [ROADMAP](./ROADMAP.md) §4; acceptance: ROADMAP §5. |
| **Deferred (after the defense)** | Everything in ROADMAP §6, including: 6-digit sign-up code, password reset (stretch), Google sign-in, admin user/competency/settings screens, resume replacement, automatic deadline expiry and reminders, applicant reschedule requests, endorsement PDF file/XLSX/email, invitation expiry, pool match search, all non-auth emails, ZIP downloads, Reports, deployment. |
| **Later** | DOCX and image resumes (OCR), audit-log viewer, bulk actions |

During the sprint, these requirements are out of scope or simplified: FR-AUTH-04 (stretch), FR-AUTH-05, FR-AUTH-06 (link instead of code), FR-AUTH-07, FR-PROF-06/07, FR-SCR-05 (HR drops manually), FR-INT-03 and FR-INT-05/07 (no applicant reschedule, no automatic expiry or reminders), FR-END-05 (printable page), FR-VAC-02, FR-POOL-02 (invite without deadline), FR-ADM-03/04, FR-NOTIF-02.

---

## 9. Open decisions (defaults applied until confirmed)

| ID | Question | Default in the docs |
|---|---|---|
| D1 | If too few applicants pass after interviews, should the shortlist refill? | No automatic refill. HR has a **Pull next applicant** action per group that shortlists the next person from the waiting pool. |
| D2 | Application cap: earlier "3–4 × slots" conflicts with two shortlists of 2 × slots each (= 4 × slots in screening). | Minimum 4 × slots, default 8 × slots. |
| D3 | *(obsolete Oct 7, 2026)* A pooled applicant was never rated on a competency the new vacancy weights. | Every interview rates all 15 items (§5.1), so reused ratings always cover every section (BR-21). |
| D4 | Paper says "WSM score is added to the matching score". | Final score is the **plain average** (equivalent to a WSM with 0.5/0.5 weights). Update Chapter 1 wording to match. |
