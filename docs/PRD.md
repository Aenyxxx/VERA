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
- the best candidates are **endorsed** to the company, and outcomes feed a reusable **talent pool**.

### 1.3 Goals
1. Cut manual resume screening: HR reviews only the shortlist (2 × slots per applicant group).
2. Make evaluation consistent and explainable (scores with matched/missing skills and per-competency ratings).
3. Give applicants real-time status and notifications.
4. Keep the full recruitment trail (status history) in one database.

### 1.4 Non-goals (delimitations)
- No automated hiring decisions. Scores are decision support; HR and the client decide.
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
- **FR-PROF-02** The system extracts personal information and pre-fills the profile card: first, middle, last name, suffix, gender, birthday, house/street, municipality/city, province, education level (plus contact number and height when found). Age is shown, computed from birthday.
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
- **FR-DOC-04** Re-uploading a document replaces it and resets its verification.

### 4.4 Companies (COMP)
- **FR-COMP-01** HR lists and searches companies by name.
- **FR-COMP-02** HR adds/edits a company: name, industry, description, website, contact person name, position, email, number.
- **FR-COMP-03** Company detail: info, number of vacancies, endorsed, for-interview, and hired counts.

### 4.5 Vacancies (VAC)
- **FR-VAC-01** HR creates a vacancy under a company: title, description, key responsibilities, required skills, experience requirement, minimum years, prescreen conditions (age range, gender, minimum education, minimum height), deployment location, employment type, slots, application cap, endorsement count, matching threshold, passing score, competencies from the fixed list with weights totalling 100%.
- **FR-VAC-02** Before posting HR can run **Find matches in talent pool**: the system scores active talent-pool applicants against the vacancy and lists those who pass prescreen and the threshold, so HR can invite them.
- **FR-VAC-03** HR publishes (`open`), closes/pauses, and archives vacancies. Publishing requires weights = 100.
- **FR-VAC-04** Applicants see only `open` vacancies, with agency branding, never the company.
- **FR-VAC-05** HR vacancy list shows company, status, slots, remaining slots, applicant counts per stage; search by title/company.
- **FR-VAC-06** Vacancy detail shows the final ranking (combined groups) with **Notify** and **View matching details** per applicant.
- **FR-VAC-07** Vacancy auto-closes when the application cap is reached; becomes `endorsing` when the first endorsement is sent; becomes `filled` (hidden, kept as a record) when hired count = slots.

### 4.6 Applying (APP)
- **FR-APP-01** Applicants can browse vacancies without a profile, but **Apply** requires a confirmed profile (otherwise redirect to setup).
- **FR-APP-02** Apply dialog: one required radio button — *First-time job seeker* / *Experienced* — then Submit. No other form; the stored profile and current resume are used.
- **FR-APP-03** **Prescreen** immediately; failure → `prescreen_failed` + notification with the unmet condition.
- **FR-APP-04** **Matching** immediately from the stored extraction: first-time = skills only; experienced = skills 50% + experience 50% (with minimum years). Below threshold → `below_threshold` + notification.
- **FR-APP-05** Otherwise → `waiting_pool`; the shortlist is refreshed.
- **FR-APP-06** One application per vacancy ever; no withdrawal.
- **FR-APP-07** When the cap is reached, the vacancy stops accepting applications.

### 4.7 Resume screening (SCR)
- **FR-SCR-01** Per vacancy, two tabs/groups: Experienced and First-time. Each shows the auto-shortlisted applicants (top `2 × slots` by matching score) — no "Run screening" button.
- **FR-SCR-02** Opening an applicant shows profile, resume, supporting documents, and matching details. HR marks each item verified/rejected.
- **FR-SCR-03** The first verification action sets `verification_started_at`, locking that applicant's slot.
- **FR-SCR-04** HR can request a document or a new copy with a mandatory reason; deadline = now + `response_deadline_days` (default 3).
- **FR-SCR-05** Rejected/unanswered (expired) requests → application `dropped`; the next applicant in that group moves up automatically.
- **FR-SCR-06** **Schedule interview** is enabled only when the resume and all current supporting documents are verified and no request is pending.

### 4.8 Interview assessment (INT)
- **FR-INT-01** One combined list per vacancy (both groups) from `interview_scheduled` onward.
- **FR-INT-02** HR schedules an online interview (date/time, duration, meeting link, interviewer). Applicant must confirm within 3 days.
- **FR-INT-03** Applicant can confirm or request a reschedule (with reason). HR picks the new date. Max **2** reschedules.
- **FR-INT-04** On confirmation, all the applicant's other active applications become `terminated` (their slots refill).
- **FR-INT-05** No confirmation by the deadline, or no-show → `dropped`; next in line moves up.
- **FR-INT-06** After the interview, HR rates **every active competency** on the fixed list 1–5 (weighted ones are highlighted). The system computes interview score and final score and sets `passed` / `did_not_pass`.
- **FR-INT-07** Reminder notification 24 h before the interview.

### 4.9 Final ranking and endorsement (END)
- **FR-END-01** Final ranking per vacancy (combined): final score desc, ties by matching score then application time.
- **FR-END-02** `did_not_pass` → talent pool (`did_not_pass`) with ratings saved; applicant notified.
- **FR-END-03** HR clicks **Notify** on passed applicants up to the endorsement count; auto-generated message (editable) via email + in-app → `passed_awaiting_confirmation`.
- **FR-END-04** Applicant confirms within 3 days → `for_endorsement`; declines or ignores → `archived`.
- **FR-END-05** Endorsement Management: per vacancy, list `for_endorsement` applicants; generate the endorsement form (PDF profile per applicant + XLSX summary), send it to the company contact email, and allow download. Applicants → `endorsed`; vacancy → `endorsing`.
- **FR-END-06** When the endorsement is sent, remaining `passed` applicants of that vacancy → `standby` + talent pool (`standby`).
- **FR-END-07** HR records each endorsed applicant's outcome: **hired** → `hired` + notification; **not hired** → `not_hired` + talent pool.
- **FR-END-08** For hired applicants HR enters and sends post-hiring details (training schedule, pre-employment requirements, orientation, deployment). HR can mark training failed → `training_failed` + talent pool.
- **FR-END-09** When hired = slots → vacancy `filled`. If every endorsed applicant fails, HR checks the talent pool (FR-VAC-02); if none qualifies, HR reopens the vacancy.

### 4.10 Talent pool (POOL)
- **FR-POOL-01** List active pool entries with reason, stage reached, last scores, stored ratings; search and filter.
- **FR-POOL-02** HR invites a pooled applicant to a vacancy (email + in-app). The applicant applies normally (radio button).
- **FR-POOL-03** A pooled applicant's application goes through prescreen, matching, threshold, and cap, then:
  - if resume and documents are still verified → **skips screening and interview**; the final score is computed immediately using their latest ratings with the new vacancy's weights;
  - if verification was reset (new resume) → goes to Resume Screening for verification only, then straight to evaluation (no interview).
- **FR-POOL-04** Talent-pool applications do not consume shortlist slots.
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
| BR-02 | `application_cap ≥ slots × 4` (both groups' shortlists). Default `slots × 8`. |
| BR-03 | `endorsement_count ≥ slots`. |
| BR-04 | First-time matching = skills only. Experienced = 0.5 × skills + 0.5 × experience (experience capped when below minimum years). |
| BR-05 | Below `matching_threshold` → `below_threshold` (dropped from the process). |
| BR-06 | Interview score = Σ (weight × rating ÷ 5); weights total 100; ratings 1–5. |
| BR-07 | Final score = (matching + interview) ÷ 2. `passed` = final ≥ passing score. |
| BR-08 | Response deadline (documents, interview confirmation, endorsement confirmation, pool invitation) = `response_deadline_days` (default 3), adjustable by HR. |
| BR-09 | Max 2 interview reschedules; HR sets the new date. |
| BR-10 | Confirming an interview terminates the applicant's other active applications. |
| BR-11 | Slots freed **before evaluation** (dropped, terminated) are refilled from the waiting pool automatically. |
| BR-12 | Applicants with verification started are locked in the shortlist; a higher-scoring newcomer only displaces unlocked shortlisted applicants. |
| BR-13 | One current resume; replacement blocked during active applications; replacement resets verification. |
| BR-14 | One application per applicant per vacancy, no withdrawal. |
| BR-15 | Archived applicants may apply to other vacancies. |
| BR-16 | Applicants never see the client company. |

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
| **Solo sprint MVP (Oct 7–13, defense-ready)** | Email/password login with remember me, sign-up with Supabase confirmation link, resume upload with auto-filled profile, documents, companies, vacancies with weights, apply with prescreen + SBERT matching + automatic shortlist, resume screening with document requests, interview scheduling and confirmation, competency evaluation (WSM) and final score, ranking with matching details, notify/confirm, printable endorsement, hired/not hired, post-hiring details, applicant pool (+ re-application if time), HR dashboard, applicant management, in-app notifications. Build order: [ROADMAP](./ROADMAP.md) §4; acceptance: ROADMAP §5. |
| **Deferred (after the defense)** | Everything in ROADMAP §6, including: 6-digit sign-up code, password reset (stretch), Google sign-in, admin user/competency/settings screens, resume replacement, automatic deadline expiry and reminders, applicant reschedule requests, endorsement PDF file/XLSX/email, invitation expiry, pool match search, all non-auth emails, ZIP downloads, Reports, deployment. |
| **Later** | DOCX and image resumes (OCR), audit-log viewer, bulk actions |

During the sprint, these requirements are out of scope or simplified: FR-AUTH-04 (stretch), FR-AUTH-05, FR-AUTH-06 (link instead of code), FR-AUTH-07, FR-PROF-06/07, FR-SCR-05 (HR drops manually), FR-INT-03 and FR-INT-05/07 (no applicant reschedule, no automatic expiry or reminders), FR-END-05 (printable page), FR-VAC-02, FR-POOL-02 (invite without deadline), FR-ADM-03/04, FR-NOTIF-02.

---

## 9. Open decisions (defaults applied until confirmed)

| ID | Question | Default in the docs |
|---|---|---|
| D1 | If too few applicants pass after interviews, should the shortlist refill? | No automatic refill. HR has a **Pull next applicant** action per group that shortlists the next person from the waiting pool. |
| D2 | Application cap: earlier "3–4 × slots" conflicts with two shortlists of 2 × slots each (= 4 × slots in screening). | Minimum 4 × slots, default 8 × slots. |
| D3 | A pooled applicant was never rated on a competency the new vacancy weights (e.g. added to the list later). | HR is asked to rate only the missing competencies before the final score is computed. |
| D4 | Paper says "WSM score is added to the matching score". | Final score is the **plain average** (equivalent to a WSM with 0.5/0.5 weights). Update Chapter 1 wording to match. |
