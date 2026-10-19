# VERA — User Guide

> **VERA (Verified Evaluation and Recruitment Assistant)** is the recruitment system of **Confiable Manpower Solutions Inc.**
> This guide explains how VERA works **today** (after the October 19, 2026 changes), in plain language, for HR staff,
> administrators, and the thesis panel. Menu, page, button, and status names are written exactly as they appear on screen.
> Differences between this guide and the older design documents are listed in [§9](#9-where-the-older-documents-differ-from-the-app).

---

## Contents
1. [Overview](#1-overview)
2. [Navigation map per role](#2-navigation-map-per-role)
3. [The end-to-end workflow](#3-the-end-to-end-workflow)
4. [Rules of each feature](#4-rules-of-each-feature)
5. [Scoring in plain words](#5-scoring-in-plain-words)
6. [Notifications](#6-notifications)
7. [Troubleshooting](#7-troubleshooting)
8. [Glossary](#8-glossary)
9. [Where the older documents differ from the app](#9-where-the-older-documents-differ-from-the-app)

---

## 1. Overview

### 1.1 What VERA does
Client companies ask the agency for workers. HR records each request as a **job vacancy**. Applicants upload **one resume**, apply to vacancies, and VERA:
1. checks the basic conditions of the job (**prescreen**: age, gender, education, height);
2. compares the resume with the job's required skills and experience (**matching**, Sentence-BERT) and gives a **matching score** (0–100);
3. keeps everyone who reaches the job's **matching threshold** (default 40) in line, and **automatically shortlists** the best ones;
4. lets HR **verify** the resume and documents, **interview** the applicant online, and **rate** 15 competencies;
5. computes the **interview score** and the **final score**, **ranks** the applicants, and lets HR **endorse** the best ones to the client;
6. records the client's **final interview** and **hiring decision**, and automatically offers another job to an applicant the client did not hire (**rematch**).

Applicants who do not get through are kept in the **Applicant Pool** and are invited again when a new job fits them.

### 1.2 The three roles
| Role | Who | Signs in to | Main job |
|---|---|---|---|
| **Admin** | System administrator | the staff area (`/admin`) | Everything HR can do, plus **User Management** (create, edit, activate, deactivate staff accounts) |
| **HR** | Agency recruitment staff | the staff area (`/admin`) | Companies, vacancies, screening, interviews, evaluation, ranking, endorsement, outcomes |
| **Applicant** | Job seekers | the applicant area (`/applicant`) | Profile, resume and documents, applying, answering requests, offers, and invitations |

Client companies are **not** users. HR records what the client says (final interview time, hired / not hired).

### 1.3 Signing in
- **Log in** page: **Email address**, **Password**, **Remember me**, then **Log in**.
  - With **Remember me** ticked, the browser keeps you signed in after it is closed; otherwise you are signed out when the browser closes.
  - Wrong details show "Incorrect email or password."
- **Applicants** create their own account with **Create account**: email address, password, **Confirm password**, and the Data Privacy Act consent box. VERA emails a **confirmation link** ("Check your email"). Opening the link activates the account; the applicant then sets up the profile.
- **HR accounts** are created only by the Admin (**User Management → Add HR account**); HR cannot sign up. VERA sends no email: the admin gives the password to the HR staff member.
- An account that the admin deactivated cannot sign in.
- **Log out**: the account menu in the header or the bottom of the sidebar (both **Log out**).

### 1.4 What each role can and cannot see
| | Applicant | HR | Admin |
|---|---|---|---|
| Client company name | **Never** (jobs are shown under the agency's name) | Yes | Yes |
| Their own matching, interview, or final score | **Never** | Yes (everyone's) | Yes |
| Why an application ended (drop reason, client's reason) | **Never** (neutral messages only) | Yes | Yes |
| Which prescreen condition they failed | **Yes** (the notice names it, e.g. "Height must be at least 150 cm.") | Yes | Yes |
| Age and gender requirements of a job | Not on the job page (RA 10911); only if they fail them | Yes | Yes |
| Other applicants | Never | Yes | Yes |
| User Management | No | No (HR is sent back to the Dashboard) | Yes |

---

## 2. Navigation map per role

### 2.1 Applicant
The sidebar is locked until the profile is set up.

| Menu / page | What it shows | Actions |
|---|---|---|
| **Set up your profile** (first sign-in only) | Steps **Upload resume** → **Review your profile** | Upload a text-based English PDF; VERA reads it ("Reading your resume…") and fills in the profile; check every field; **Confirm profile**. **Upload a different resume** starts again. |
| **My Profile** (home page) | Profile card (initials avatar; **Upload photo** is shown but disabled, "Coming soon": photos cannot be added yet); **My applications** (one row per application with its status and **Next:** action); **Job offers** (rematch offers and job invitations); **Upcoming interview**; **Recent notifications** | **Edit profile** → **Save changes** (email cannot change); **Browse job vacancies**; **View job offer** / **View invitation**; **Confirm attendance**; **Request reschedule**; **Join the online interview** (after confirming); **View all** notifications. Pop-ups ask for answers when needed (interview, endorsement, job offer). |
| **Job Vacancies** | Open jobs under the agency's name (never the company); **Search job title** | Open a job → **Job description**, **Qualifications** (education, height, "No work experience required" when relevant), **Key responsibilities** → **Apply**. Shows **Applied** if already applied, or why applying is not possible (ongoing or hired application). |
| **Apply** dialog | **Which describes you?** **First-time job seeker** / **Experienced**; **Attach documents to this application?** (optional, **Select all**) | **Submit application** → the result is shown at once ("Here is the result of your application."); **Go to My Profile** / **Done** |
| **My Documents** | Tabs **Resume** and **Supporting documents**; a list of **Requests** (reason, deadline, status) | **Upload document** (type **Certificate**, **Diploma**, or **Other**; PDF ≤ 10 MB; a name for **Other**, optional name for **Certificate**); **View**; **Re-upload** (replace a document; for the resume this opens **Replace resume** → **Use this resume**) |
| **Notifications** (bell in the header) | All notices, unread first marked "(unread)" | **Mark all as read**; open a notice's link |

Pop-ups on **My Profile**:
- **Confirm your interview**: date, time, length, interviewer, "Online (the link is shown after you confirm)", **Please confirm by** → **Confirm attendance**, or request a new time.
- **Request a new interview time**: **Why can't you attend?** (5–500 characters) → **Send request**.
- **Confirm your endorsement**: the agency's message with the **final interview** (date, time, place and details), **Please answer by** → **Confirm endorsement**, **Decline**, or **Not now**.
- **Another job for you** (rematch offer) → **Accept job offer** / **Decline job offer**; **Job invitation** → **Apply** / **Decline invitation**. Both show job, location, employment type, and **Please answer by**, never the company or a score.

### 2.2 HR (and Admin)
| Menu / page | What it shows | Actions |
|---|---|---|
| **Dashboard** | 8 tiles: **Total applicants**, **Waiting pool**, **For screening**, **For interview**, **For endorsement**, **Hired**, **Applicant pool**, **Active vacancies**; **Upcoming interviews** (next 10, Philippine time) | Click a tile → the filtered **Applicant Management** list (Active vacancies → Job Vacancies); **All interviews** |
| **Company List** (page title **Company Management**) | Companies with contact person, email, vacancy count; **Search company name** | **Add company**, **View** (company details and recruitment summary: Vacancies, In agency interview, Awaiting client, Hired, Total endorsed), **Edit** / **Edit company** → **Save company** |
| **Job Vacancies** | Vacancy cards (status, counts: Applicants, Screening, Interview, Hired); search title or company; status filter | **Create job vacancy**; open a vacancy |
| Vacancy form | Sections **Company & position**, **Job description**, **Requirements** (used for matching), **Qualifications (prescreen)**, **Pipeline settings**, **Competency weights** | **Save draft**, **Save and publish**; on a published vacancy **Save changes** (only the posting text and a higher application cap) |
| Vacancy detail | Tabs **Details**, **Ranking**, **Pool invitations** | **Edit**; status actions **Publish**, **Close**, **Reopen** (or **Raise cap and reopen**), **Archive**; on **Ranking**: select passed applicants → **Notify**, **Breakdown** (score breakdown), **Download** (endorsement packet, on applicants who passed); on **Pool invitations**: **Run pool matching again** |
| **Applicant Management** | Every applicant with a confirmed profile: current application (job + company), HR status, last update; 20 per page | **Search name or email**; status filter (the dashboard tiles); **Previous** / **Next**. (Rows do not open a detail page; use Resume Screening.) |
| **Resume Screening** | Vacancies with applicants. Per vacancy: tabs **Applicants with Work Experience** / **First-Time Job Seekers**, each with **Shortlist · n of quota**, **Waiting pool**, and **Not shortlisted** (Prescreen failed / Below threshold) | **Review** an applicant → review sheet: Applicant, **Matching details** (Matched / Missing, matching notes), **Resume**, **Supporting documents**, **Requests** → **View**, **Mark as verified**, **Reject** (remarks), **Request new copy** / **Request a document**, **Withdraw request**, **Drop application**; **Next step**: **Schedule interview** or **Compute final score (reused ratings)**; **View evaluation** |
| **Interview Assessment** | Open interviews of all vacancies (vacancy filter): applicant, vacancy, matching, time (Philippine time), interviewer, meeting link, status | **Evaluate**, **Edit time**, **Mark no-show**; for a reschedule request: **Approve** (set the new time → **Approve with this time**) or **Decline** (keep the current time) |
| Evaluation page (title **Interview Assessment**) | The 15 Competency Profile items by section A/B/C with each section's weight; live section scores, interview score, overall rating, final score; applicant card with **View resume** | Rate every item 1–5 → **Save evaluation** (final, cannot be changed) |
| **Endorsement Management** | Vacancies with **To endorse**, **Endorsed**, **Hired** counts. Per vacancy: tabs **Candidates** and **Outcomes** | **Candidates**: **Create endorsement**. **Outcomes**: per endorsement **Printable page**; per applicant **Schedule final interview** (older records), **Change time**, **Proceeds**, **Did not proceed**, **Mark as hired**, **Mark as not hired**, **Training failed**, **Run rematch again** |
| **Applicant Pool** | Tabs **Waiting** and **Returned by Client**: applicant, reason, added date, from (job + company), latest offer or invitation | View only |
| **Notifications** (bell) | Staff notices (see §6) | **Mark all as read** |

### 2.3 Admin only
| Menu / page | What it shows | Actions |
|---|---|---|
| **User Management** | Staff accounts: name and email (your row says "(you)"), role, **Active** / **Inactive**, last sign-in | **Add HR account** (Email, Full name, **Password**, **Confirm password** → **Create HR account**); **Edit** on every row (Full name, **New password**, **Confirm new password**; blank keeps the password; the email is shown, never editable → **Save changes**); **Deactivate** / **Activate** (not on your own row) |

---

## 3. The end-to-end workflow

The status after each step is shown as **HR label** / *applicant label*.

### Step 1 — Company and vacancy (HR)
1. **Company List → Add company** (name, industry, contact person, email…). Applicants never see these details.
2. **Job Vacancies → Create job vacancy**:
   - **Requirements**: **Required skills** (one short phrase per line) and **Experience requirement** (job title on the first line, then one duty per line; leave it blank if no experience is needed). These are what the resume is matched against.
   - **Qualifications (prescreen)**: minimum/maximum age, gender, minimum education, minimum height. Never used in a score.
   - **Pipeline settings**: **Slots needed**, **Application cap** (at least slots × 4; default slots × 8), **Endorsement count** (at least the slots), **Matching threshold (%)** (default 40), **Passing score (%)**.
   - **Competency weights**: the weight of sections A, B, C (total 100%; a section may be 0%).
3. **Save draft** or **Save and publish**. Publishing needs weights totalling 100%. After publishing, requirements, prescreen, pipeline numbers, and weights are **locked**; only the posting text can change and the cap can only be raised.
4. **On publish, VERA runs pool matching in the background** (see Step 2b). The toast says "Vacancy published. Pool matching is running: see Pool invitations."

Vacancy status: **Draft** → **Active** (open).

### Step 2 — Applying (Applicant)
1. The applicant opens a job and clicks **Apply**, chooses **First-time job seeker** or **Experienced**, optionally ticks documents to attach, and clicks **Submit application**.
2. VERA checks, in order:
   - the applicant has **no ongoing or hired application** (else Apply is not possible);
   - the job is not at a company where they **failed within the last year** (else "This job is not available for your application." — such jobs are also hidden from their list);
   - **prescreen** (age, gender, education, height): fail → **Prescreen failed** / *Not shortlisted*; the notice names the unmet condition; the applicant enters the **Applicant Pool** (Waiting);
   - **matching** against the job: score below the threshold → **Below threshold** / *Not shortlisted*; Applicant Pool (Waiting);
   - otherwise → **Waiting pool** / *Application received*, and the shortlist is refreshed at once (Step 3).
3. When the number of qualified applications reaches the **application cap**, the vacancy closes automatically.

### Step 2b — Pool matching and job invitations (automatic)
When HR publishes a vacancy (or clicks **Run pool matching again** while it is open), VERA checks every free Applicant Pool entry: prescreen, then matching (with the applicant type of their earlier application), then the threshold. Everyone who passes gets a **Job invitation** (job title and deadline only). The **Pool invitations** tab shows the run (invited / skipped / failed) and each invitation.
- Applicant **Apply** → a normal application at **Waiting pool** (no new matching; the stored score is re-checked), then the shortlist.
- Applicant **Decline invitation** → stays in the pool.
- If the vacancy stops being open (closed, cap reached, endorsing, filled, archived), pending invitations **expire** at once and the applicant is told "Job no longer available".

### Step 3 — Waiting pool and automatic shortlisting (automatic)
- Per applicant group (Experienced / First-time), the **top 2 × slots** by matching score are **Screening** / *Under review* (shortlisted); the rest stay in the **Waiting pool**.
- Ties: earlier application first.
- When someone with a higher score arrives, the lowest **unlocked** shortlisted applicant goes back to the waiting pool (*"Back in line for {job}"*). A slot is **Locked** once HR starts verifying it; locked applicants are never pushed out.
- When a shortlisted applicant leaves (dropped, etc.), the next in line moves up automatically.

### Step 4 — Resume and document verification (HR, Resume Screening)
1. **Review** the shortlisted applicant. HR's first verify, reject, or request **locks** the slot.
2. For the **resume** (the one sent with this application) and every current **supporting document**: **View** → **Mark as verified** or **Reject** (remarks required).
   - Verification belongs to the **document**, not the application: a verified document stays verified for later applications until the applicant re-uploads it.
   - A re-uploaded document returns to *For verification* and is marked **New upload to verify**.
   - Documents the applicant chose when applying show **Attached when applying** (information only).
3. Missing or rejected? **Request a document** / **Request new copy** with a reason. The applicant is notified with a deadline (now + 3 days by default). The request is fulfilled when the applicant uploads that type. (The resume itself cannot be requested: reject it and drop the application instead.)
4. **Rejecting never drops the application by itself.** HR either requests a new copy or clicks **Drop application** (reason: failed verification, no response by the deadline, other). Drop → **Dropped** / *Closed (no response)*; the next applicant moves up; the company is blocked for this applicant for 1 year; Applicant Pool (Waiting).
5. **Next step** opens when the resume and every document are verified and no request is pending:
   - **Schedule interview** (normal case), or
   - **Compute final score (reused ratings)** when the applicant already has an evaluation from an earlier application (they are **not** interviewed again; see §4.13). Result: **Passed** or **Did not pass** directly.

### Step 5 — Interview (HR and Applicant)
1. **Schedule interview**: **Date**, **Time (Philippine time)** (must be in the future), **Duration**, **Interviewer** (an active staff account), **Meeting link** → **For interview** / *Interview scheduled*.
2. The applicant must confirm by the **confirm-by** time (the earlier of 3 days from now and the interview time). **Confirm attendance** → **Interview confirmed** / *Interview confirmed*; the meeting link then appears on their dashboard.
3. **Edit time** (HR): changes the time; a confirmed interview stays confirmed; the applicant is notified.
4. **Reschedule request** (Applicant, **Request reschedule**): allowed while the interview awaits confirmation or is confirmed and has not started, with a reason; **at most 2 requests per application** (approved or declined both count).
   - While a request waits, HR cannot edit the time, mark a no-show, or evaluate ("Answer the reschedule request first").
   - **Approve**: HR sets a new time; the applicant must confirm it again (a confirmed application goes back to **For interview**).
   - **Decline**: the time stays ("Keep the current time"); the applicant is notified.
5. **Mark no-show** (HR): allowed for an unconfirmed interview after the confirm-by time or the interview time, and for a confirmed interview after the interview time. → **Dropped** / *Closed (no response)*; next in line moves up; company blocked 1 year; Applicant Pool (Waiting).

### Step 6 — Evaluation (HR)
1. **Evaluate** opens once the interview is **confirmed** and its **start time has passed**.
2. Rate all **15 items** from 1 to 5. The five rating labels are shown once per section as column headers; each row shows only 1–5. The page shows the section scores, the interview score, the overall rating, and the final score live.
3. **Save evaluation** (final; cannot be edited):
   - final ≥ passing score → **Passed** / *Under final review* (no notice yet);
   - final < passing score → **Did not pass** / *Not selected (kept in applicant pool)*; Applicant Pool (Waiting); company blocked 1 year.

### Step 7 — Ranking (HR, vacancy → Ranking tab)
- Every evaluated application of the vacancy, both groups together, ordered by **final score**, then matching score, then application time.
- **Breakdown** shows the matching details (skills, experience, weights, matched/missing skills), the section scores × weights, the overall rating, and the final-score formula with the stored numbers.

### Step 8 — Notify and applicant confirmation
1. HR ticks **passed** applicants (the top ones are preselected) up to the **places left** = endorsement count − (awaiting confirmation + for endorsement + endorsed), and clicks **Notify**. The message body is editable (it may not name the company); the title "Please confirm: {job}" and the deadline line are fixed. → **Awaiting confirmation** / *Passed — confirm endorsement*.
   - HR must also fill in the client's **final interview**: **Date**, **Time** (Philippine time), and **Location and details** (no company name). It is the same for everyone notified in that click. VERA adds it to the message: "Final interview: Oct 25, 2026, 2:00 PM (Philippine time). {details}". Any date is accepted.
2. The applicant answers in the **Confirm your endorsement** pop-up, which shows that message, so they confirm the final interview **once**:
   - **Confirm endorsement** → **For endorsement** / *For client interview*;
   - **Decline** → **Archived** / *Closed (endorsement declined)*. No Applicant Pool entry, no company block.
3. Notify works only while the vacancy is open, closed, or endorsing.

### Step 9 — Endorsement and packet (HR, Endorsement Management)
1. **Candidates** tab → **Create endorsement**: HR types the final interview again (**Date**, **Time**, **Location and details**; VERA cannot fill it in from the Notify message). Every **For endorsement** application becomes **Endorsed** and, in the same step, **Final interview** / *Final interview scheduled*, with that time stored. Any other **Passed** applicant who was never notified → **Standby** / *Kept in applicant pool* (Applicant Pool, Waiting). Applicants still deciding (**Awaiting confirmation**) stay. The vacancy becomes **Endorsing**. Several endorsements per vacancy are allowed.
   - The applicant gets "Sent to the employer" but **no second final interview notice** when the time and details are the ones in their Notify message.
   - If they differ, VERA warns first ("This final interview differs from what … was told in the Notify message.") and nothing is saved. HR either fixes the schedule or clicks **Create and send 'time changed'**: those applicants get "Final interview time changed".
   - An applicant who came from a rematch offer never got a Notify message, so they get "Final interview scheduled".
2. **Outcomes** tab → **Printable page** (the batch summary; print → Save as PDF). The per-applicant **endorsement packet** (one PDF to send to the client, see §4.16) is downloaded from the vacancy's **Ranking** tab → **Download**. VERA does not email the client; HR sends the packets.

### Step 10 — Final interview and For hiring (HR records the client's steps)
1. The final interview is already set by **Create endorsement** (Step 9). **Change time** sets a new time and instructions (no company name) and notifies the applicant ("Final interview time changed"). **Schedule final interview** appears only for an applicant still at **Endorsed** (older records).
2. **Proceeds** → **For hiring** / *For hiring*. **Did not proceed** → **Not hired**.
3. There is no clock check: HR can record these right after scheduling.

### Step 11 — Hired / Not hired / Training failed
- **Mark as hired** (only from **For hiring**) → **Hired** / *Hired*. The applicant cannot apply elsewhere while hired.
- **Mark as not hired** (allowed at **Endorsed**, **Final interview**, or **For hiring**; at Endorsed it means the client declined before the final interview) → **Not hired** / *Kept in applicant pool*; Applicant Pool (Returned by Client); company blocked 1 year; **automatic rematch** starts.
- **Training failed** (only from **Hired**) → **Training failed** / *Kept in applicant pool*; Applicant Pool (Returned by Client); company blocked 1 year.

### Step 12 — Automatic rematch (after Not hired)
1. Right after **Mark as not hired**, VERA rescans every **open** vacancy for the applicant, leaving out: companies where they failed within 1 year, vacancies whose endorsement is full, vacancies they already applied to or were already offered, and vacancies whose prescreen they fail.
2. For each remaining vacancy it computes the matching score (same applicant type), reuses the original interview ratings with that vacancy's weights, and keeps it only if matching ≥ threshold **and** final ≥ passing score.
3. The best one (highest matching, then highest final) is **offered automatically** ("Another job for you"). HR sees the result in a toast and on the **Outcomes** row ("VERA offered them … at …", "No matching open job right now; they stay in the applicant pool.", or "The rematch did not run. Use Run rematch again.").
4. Applicant **Accept job offer** → a new application that starts directly at **For endorsement** (no screening or interview). **Decline job offer** → stays in the pool; HR may **Run rematch again** (the declined job is skipped).

### Step 13 — Close-out when a vacancy fills or is archived (automatic)
- **Fill**: when the hired count reaches the slots, the vacancy becomes **Filled** in the same step, and everyone still in its pipeline is closed out:
  - **Waiting pool**, **Screening**, **For interview**, **Interview confirmed** → **Not selected** / *Not selected (kept in applicant pool)*;
  - **Passed**, **Awaiting confirmation**, **For endorsement**, **Endorsed**, **Final interview**, **For hiring** → **Standby** / *Kept in applicant pool*.
- **Archive** (from Draft or Closed): the same close-out, but archiving is **refused** while anyone is still with the client ("Record the client's decision for every endorsed applicant before archiving this vacancy.").
- **Close** only pauses the vacancy (hidden from applicants, waiting pool kept); **Reopen** brings it back while applications are below the cap (else **Raise cap and reopen**).

---

## 4. Rules of each feature

### 4.1 Application statuses
| Status | HR label | Applicant label | Applicant's next step |
|---|---|---|---|
| prescreen_failed | Prescreen failed | Not shortlisted | You can apply to other jobs |
| below_threshold | Below threshold | Not shortlisted | You can apply to other jobs |
| waiting_pool | Waiting pool | Application received | — |
| shortlisted | Screening | Under review | Upload requested documents (only while a request is pending), else "Wait for the agency to review your application" |
| interview_scheduled | For interview | Interview scheduled | Confirm your interview |
| interview_confirmed | Interview confirmed | Interview confirmed | Attend online interview |
| did_not_pass | Did not pass | Not selected (kept in applicant pool) | You can apply to other jobs |
| passed | Passed | Under final review | — |
| passed_awaiting_confirmation | Awaiting confirmation | Passed — confirm endorsement | Confirm or decline |
| for_endorsement | For endorsement | For client interview | Wait for agency update |
| endorsed | Endorsed | For client interview | Wait for agency update |
| final_interview_scheduled | Final interview | Final interview scheduled | Attend the final interview (see your notifications for the date) |
| for_hiring | For hiring | For hiring | Wait for agency update |
| hired | Hired | Hired | Wait for the agency to contact you about the next steps |
| not_hired | Not hired | Kept in applicant pool | You can apply to other jobs |
| training_failed | Training failed | Kept in applicant pool | You can apply to other jobs |
| standby | Standby | Kept in applicant pool | You can apply to other jobs |
| not_selected | Not selected | Not selected (kept in applicant pool) | You can apply to other jobs |
| dropped | Dropped | Closed (no response) | You can apply to other jobs |
| archived | Archived | Closed (endorsement declined) | You can apply to other jobs |
| terminated | Terminated | Closed (you continued with another job) | old records only |

Vacancy statuses: **Draft**, **Active** (open), **Closed**, **Endorsing**, **Filled**, **Archived**.

### 4.2 One ongoing application
1. An applicant may have **one ongoing application** at a time: Waiting pool, Screening, For interview, Interview confirmed, Passed, Awaiting confirmation, For endorsement, Endorsed, Final interview, For hiring.
2. A **hired** applicant cannot apply anywhere until their training is marked failed.
3. Every other ending frees the applicant to apply again ("You can apply to other jobs").
4. One application per vacancy, ever; there is no withdrawal.

### 4.3 Application cap and shortlist size
1. **Shortlist per group** = 2 × slots (Experienced and First-time are shortlisted separately; the final ranking combines them).
2. **Application cap** ≥ 4 × slots (default 8 × slots). Only qualified applications count (Prescreen failed and Below threshold never use it up). At the cap the vacancy closes automatically.
3. **Endorsement count** ≥ slots. It limits how many can be notified/endorsed at a time.

### 4.4 Deadlines (shown, not enforced)
1. Document requests, interview confirmations, endorsement confirmations, rematch offers, and job invitations show a deadline: **3 days** (`response_deadline_days`), shown in Philippine time.
2. **VERA does not act automatically when a deadline passes.** HR decides: **Drop application** for an unanswered request, **Mark no-show** for an unconfirmed interview. A late endorsement answer is still accepted while the status has not changed.
3. Exceptions that do happen automatically: job invitations **expire** when their vacancy stops being open; a rematch offer **expires** if its re-check fails when the applicant accepts.

### 4.5 Company block (1 year)
1. **Failed** outcomes block every vacancy of that company for **1 year** from the day of the outcome: Did not pass, Not hired, Training failed, Dropped.
2. Blocked vacancies are hidden from the applicant's job list; opening one says "This job is not available for your application." The applicant is never told why.
3. **Neutral** outcomes never block: Prescreen failed, Below threshold, Not selected, Standby, Archived (declined endorsement).
4. Pool matching and the rematch apply the same rule.

### 4.6 Applicant Pool
1. An applicant enters (or re-enters) the pool when an application ends as: Prescreen failed, Below threshold, Dropped, Did not pass, Not selected, Standby, Not hired, Training failed. **Archived** (declined endorsement) never enters.
2. One active entry per applicant; a new ending replaces the old entry.
3. **Waiting** tab = everyone who did not reach the client (Prescreen failed, Below threshold, Not selected, Dropped, Did not pass, Standby).
4. **Returned by Client** tab = the client side (Not hired, Training failed).
5. The page lists only applicants who are free (no ongoing or hired application). The entry closes when they are back in a process (e.g. accepted an invitation or offer).

### 4.7 Pool matching on publish and job invitations
1. Runs automatically right after a vacancy is published, and again only with **Run pool matching again** (open vacancy only; never on reopen).
2. Checks every **free** pool entry: no pending offer or invitation, not invited to or applied for this vacancy, no ongoing or hired application, no company block.
3. Invite = prescreen passed **and** matching ≥ the vacancy's threshold. No ranking and no limit.
4. Each matching call waits at most 15 seconds; a timeout counts as **failed** and the run continues.
5. At most **one pending offer or invitation** per applicant.
6. Accepting creates a normal application (Waiting pool, then screening and interview or rating reuse).

### 4.8 Rematch offers
1. Only after **Not hired**. Rank 1 is offered automatically; HR does not choose.
2. The offer stores every number, so accepting needs no new matching. Before creating the application, VERA re-checks everything (vacancy open, endorsement not full, applicant free, no company block, prescreen, matching ≥ threshold, final ≥ passing). A failed re-check expires the offer ("This job is no longer available.").
3. Accepted → **For endorsement** at the new vacancy, with the original interview ratings re-weighted.

### 4.9 Interviews and reschedule requests
1. Online only; the meeting link is shown to the applicant only after confirming.
2. **At most 2 reschedule requests per application** (approved or declined); then "You have used both reschedule requests. Please contact Confiable Manpower."
3. At most 3 interview attempts (the first + 2 reschedules).
4. HR's own **Edit time** never counts as a request.

### 4.10 Resume replacement
1. One **current** resume per applicant. **My Documents → Resume → Re-upload → Replace resume → Use this resume**.
2. Allowed even during an application: applications already sent **keep their own resume and score**; HR screens, verifies, and evaluates with that one. New applications, pool matching, and rematch use the new resume.
3. The new resume starts *For verification*. The profile is not changed (edit it in **My Profile**).
4. Blocked while a job offer or job invitation is pending: "Answer your pending job offer or invitation first."
5. Text-based English PDF only (no scans), up to 10 MB.

### 4.11 Supporting documents and re-upload
1. Types: **Certificate**, **Diploma**, **Other** (needs a name). Anything else (a clearance, an ID, a transcript) goes under **Other** with its name. PDF only, up to 10 MB; HR verifies each document. HR's document requests use the same three types.
2. **One Diploma**: uploading a Diploma again replaces it. **Certificate** and **Other** may have several; each is replaced only through its own **Re-upload**.
3. On replacement, the old copy is **deleted** (with its file) only if HR never verified or rejected it, it was not attached to an application, and no document request points to it. Otherwise it is kept for HR's records (hidden from the applicant).
4. The new copy is *For verification* and HR sees **New upload to verify**.
5. Uploading the requested type fulfils a pending request and tells HR it is ready to verify.
6. Applicants cannot delete documents.

### 4.12 Verification
1. HR verifies the resume sent with the application and every **current** supporting document. **Reject** needs remarks.
2. **Schedule interview** / **Compute final score (reused ratings)** open only when everything is verified and no request is pending.

### 4.13 Rating reuse
1. An applicant who already has an evaluation from an earlier application is **not interviewed again**.
2. After verification, HR clicks **Compute final score (reused ratings)**: the original 15 ratings × this vacancy's section weights → interview score; the matching score is always new.
3. The evaluation page opens read-only: "Ratings from {job} ({company}), {date}".

### 4.14 Notify and endorsement
1. Only **Passed** applicants can be notified, up to the places left (§3 Step 8).
2. The message may not name the client company.
3. **Create endorsement** needs at least one **For endorsement** applicant ("Nobody has confirmed the endorsement yet: notify passed applicants first.").
4. Notify and Create endorsement both need the final interview date, time, and details; the details may not name the company. The applicant confirms the schedule once; a second notice is sent only when the schedule changed or they had no Notify message (rematch).

### 4.15 Final interview and hiring decisions
1. Final interview details may not name the company.
2. **Mark as hired** only from **For hiring** ("Schedule the final interview and mark it as proceeding first.").
3. Each applicant's client decision is recorded once.

### 4.16 Endorsement packet
1. One PDF per applicant, file name `<LastName>_<FirstName>_<JobTitle>_Endorsement.pdf`, built when downloaded and never stored. **Where:** Job Vacancies → the vacancy → **Ranking** → **Download** (HR and Admin only).
   - **Who has one:** an applicant who **passed** (final ≥ passing score) and is now **Passed**, **Awaiting confirmation**, **For endorsement**, **Endorsed**, **Final interview**, **For hiring**, **Hired**, or **Not hired**. Others (Did not pass, Standby, Archived, Training failed, …) have no Download button; asking anyway is refused.
2. **Cover page — only:** the agency line, "ENDORSEMENT PACKET — Competency Evaluation", **Applicant**, **Position**, **Agency interview date**, the **15 ratings** (item names under the section headings A/B/C), and the **Interview score** (0–100). For a rematch application the interview score is re-weighted for the new vacancy.
3. **Then:** the applicant's resume (the one matched and verified for this application).
4. **Never on the cover:** section scores, section weights, the formula, the rating legend, matching score, final score, rank, status, notes, other applicants, or the client company. The client does not see how scores are computed.

### 4.17 User Management (Admin)
1. Only the Admin sees **User Management**; HR opening the page is sent to the Dashboard.
2. **Add HR account**: Email, Full name, **Password** + **Confirm password** (must match; at least 8 characters with a letter and a number). The account can sign in immediately; VERA sends no email. Admin accounts are not created here.
3. **Edit** (every staff row, including your own): full name and/or a new password (+ confirm). The **email never changes**. A blank password keeps the current one. Passwords are never shown or stored by VERA.
4. **Deactivate** / **Activate**: deactivation also blocks sign-in at the login service. **Nobody can deactivate their own account**, and the **last active admin** cannot be deactivated ("Keep at least one active admin.").

### 4.18 Settings (fixed values)
Response deadline 3 days · max 2 reschedule requests · default matching threshold 40 · default cap multiplier 8. There is no Settings page; these values are stored in the database.

---

## 5. Scoring in plain words

### 5.1 Matching score (0–100)
1. **What is compared:** the job's **Required skills** and **Experience requirement**, phrase by phrase, with the applicant's resume:
   - skills are compared with the resume's **Skills section** only (if the resume has no Skills heading, the whole resume is used);
   - experience is compared with the resume's **Experience section** (or the whole resume if there is none).
2. **How:** **Sentence-BERT** (all-MiniLM-L6-v2) turns each phrase into a vector; **cosine similarity** (0 to 1) says how close two phrases are in meaning (e.g. "Cash handling" vs "Handled cash" is close, vs "welding" is not). Abbreviations are written one way first ("point-of-sale" → "POS").
3. **Credit:** each job phrase earns the similarity of its **best-matching** resume phrase as its credit (0–1; the raw cosine).
4. **Skills score** = average credit of the job's skills; **Experience score** = average credit of the job's experience phrases.
5. **Weights by applicant type:**
   - **First-time job seeker:** skills only (100% skills);
   - **Experienced:** 50% skills + 50% experience;
   - a job with **no experience requirement**: skills only for both groups.
6. **Matching score** = 100 × the weighted average, rounded **half-up** to 2 decimals.
7. **Threshold:** below the vacancy's matching threshold (default **40**) → *Not shortlisted* (Below threshold).
8. **Missing skills (display only):** a required skill whose best similarity is **0.35 or lower** is listed as *missing*; the others as *matched*. This list never changes the score.
9. Years worked are shown to HR but never scored. Age, gender, education, and height are prescreen only.

### 5.2 Interview score (0–100): two-level Weighted Sum Model
1. HR rates **15 items** from 1 to 5 in three sections:
   - **A. Communication and Interpersonal Skills** (3 items),
   - **B. Personal Effectiveness Skills and Traits** (9 items),
   - **C. Job Specific Skills and Experience** (3 items).
2. Rating meanings: 1 Does not achieve expectations · 2 Partially achieves expectations · 3 Achieves expectations · 4 Exceeds expectations · 5 Greatly exceeds expectations.
3. **Section score** = (average rating of the section − 1) ÷ 4 × 100 (1 → 0%, 3 → 50%, 5 → 100%).
4. **Interview score** = Σ (section weight × section score) ÷ 100, with the vacancy's weights (total 100%).
5. **Overall rating of probability of success** (information only): 80–100 → 5 · 60–79.99 → 4 · 40–59.99 → 3 · 20–39.99 → 2 · below 20 → 1.

### 5.3 Final score and passing
1. **Final score** = (matching score + interview score) ÷ 2.
2. **Passed** when final ≥ the vacancy's **passing score**; otherwise **Did not pass**.
3. All scores are rounded **half-up** to 2 decimals (e.g. 74.315 → 74.32), the same everywhere (matching service, server, database, screen).

### 5.4 Worked example (Cashier, passing score 75, weights A 30 / B 30 / C 40)
*Similarities are illustrative.*
- Skills: Cash handling 0.92 · POS system operation 0.71 · Customer service 0.88 · Issuing receipts 0.50 → **skills 0.7525**.
- Experience: 0.80 · 0.66 · 0.55 → **experience 0.67**.
- **Experienced:** 100 × (0.5 × 0.7525 + 0.5 × 0.67) = 71.125 → **matching 71.13**. **First-time:** 100 × 0.7525 = **75.25**.
- Ratings A = 5, 4, 4 · B = 4, 4, 4, 4, 5, 4, 3, 4, 4 · C = 4, 4, 4 → sections **A 83.33%**, **B 75.00%**, **C 75.00%**.
- **Interview** = 30 × 83.33 / 100 + 30 × 75 / 100 + 40 × 75 / 100 = **77.50** → overall rating **4** (Good).
- **Final (Experienced)** = (71.13 + 77.50) ÷ 2 = 74.315 → **74.32** → **Did not pass** (below 75).
- **Final (First-time)** = (75.25 + 77.50) ÷ 2 = 76.375 → **76.38** → **Passed**.

---

## 6. Notifications
All notices are in-app (bell and **Recent notifications**); VERA sends no email. Applicant notices show the **job title only**: never the company, a score, or an internal reason. Staff notices go to **every active HR and Admin account**.

### 6.1 To the applicant
| Event | Title |
|---|---|
| Application accepted into the waiting pool (also after applying from an invitation) | Application received |
| Prescreen failed / below threshold | Not shortlisted for {job} |
| Shortlisted | Under review: {job} |
| Pushed back to the waiting pool by a higher score | Back in line for {job} |
| HR requests a document | Document requested: {document} |
| Dropped (incl. no-show) | Application closed: {job} |
| Interview scheduled | Interview scheduled: {job} |
| Interview time edited, or reschedule approved | Interview time changed: {job} |
| Reschedule request declined | Reschedule request declined: {job} |
| Did not pass (interview or reused ratings) | Application update: {job} |
| Notified for endorsement (with the final interview) | Please confirm: {job} |
| Endorsed to the client | Sent to the employer: {job} |
| Not included in the endorsement, or vacancy filled/archived after passing | Kept in our applicant pool: {job} |
| Vacancy filled/archived before the application finished | Job closed: {job} |
| Final interview scheduled (only after a rematch, or an older Endorsed record) / changed (Change time, or Create endorsement with a different time) | Final interview scheduled: {job} / Final interview time changed: {job} |
| Proceeds after the final interview | For hiring: {job} |
| Hired | Hired: {job} |
| Not hired | Employer decision: {job} |
| Training failed | Training update: {job} |
| Rematch offer | Another job for you: {job} |
| Job invitation | Job invitation: {job} |
| Offer or invitation no longer valid | Job no longer available: {job} |

### 6.2 To staff (HR and Admin)
| Event | Title |
|---|---|
| Applicant confirmed the interview | Interview confirmed: {applicant} |
| Applicant asked for a new interview time | Reschedule requested: {applicant} |
| Applicant uploaded a requested document | Requested document uploaded: {document} |
| Applicant confirmed / declined the endorsement | Endorsement confirmed: {applicant} / Endorsement declined: {applicant} |
| Rematch offer sent / accepted / declined | Rematch offer: {applicant} / Rematch accepted: {applicant} / Rematch declined: {applicant} |
| Job invitation accepted / declined | Invitation accepted: {applicant} / Invitation declined: {applicant} |
| Pool matching finished | Pool matching finished: {job} (invited, skipped, failed) |

No notice is sent when an applicant **passes** the evaluation (they hear only when HR clicks **Notify**), and there are no interview reminders.

---

## 7. Troubleshooting

### 7.1 Common messages
| Message | Meaning / what to do |
|---|---|
| "This PDF has no selectable text. Upload a text-based PDF (not a scanned image)." | The resume is a scan or picture. Export it from Word/Google Docs as PDF and upload again. |
| "The resume service is unavailable. Try again later." | The matching service (svc) is not running or not reachable. See §7.2. |
| "You already have an ongoing application. You can apply to another job once it is finished." | One ongoing application at a time (§4.2). |
| "You are already hired through Confiable Manpower, so you cannot apply to another job." | Hired applicants cannot apply until training is marked failed. |
| "This job is not available for your application." | Company block (failed there within 1 year), shown without the reason. |
| "You already applied for this job." | One application per vacancy, ever. |
| "Applications for this job just closed." | The cap was reached or HR closed it a moment ago. |
| "Answer your pending job offer or invitation first." | Resume replacement waits until the pending offer/invitation is answered. |
| "Select a document type" | **Upload document** stays disabled until a type (Certificate, Diploma, or Other, §4.11) and a PDF are chosen. |
| "Name this document" | A document of type **Other** needs a name (e.g. "NBI clearance"). |
| "You have used both reschedule requests. Please contact Confiable Manpower." | Two requests already used for this application. |
| "The interview time has passed. Please contact Confiable Manpower." | Too late to confirm or request a reschedule online. |
| "Answer the reschedule request first." | HR must approve or decline before editing the time, no-show, or evaluating. |
| "The interview has not started yet." / "Available after the interview time" | **Evaluate** opens only after a confirmed interview's start time. |
| "Evaluate after the applicant confirms" | The interview is still awaiting confirmation; after the deadline use **Mark no-show**. |
| "The applicant can still confirm. Mark a no-show after the confirmation deadline." | Too early for a no-show. |
| "Verify the resume and every document before scheduling the interview." | Something is unverified or a request is pending. |
| "This applicant has ratings on file. Compute the final score with the reused ratings instead." | Use **Compute final score (reused ratings)** (§4.13). |
| "Section weights must total 100% before publishing (now X%)." | Fix the competency weights. |
| "The application cap can only be raised (now N)." | Caps never go down after publishing. |
| "Only passed applicants can be notified. Refresh the ranking." | Someone's status changed; refresh. |
| "Remove the company name: applicants never see the client company." | The Notify message or final-interview instructions named the client. |
| "Nobody has confirmed the endorsement yet: notify passed applicants first." | **Create endorsement** needs at least one For endorsement applicant. |
| "Enter the date and the time." / "Enter the final interview details." | Notify and Create endorsement need the client's final interview. |
| "This final interview differs from what … was told in the Notify message." | The schedule typed at Create endorsement is not the one in their Notify message. Fix it, or click **Create and send 'time changed'**. |
| "Schedule the final interview and mark it as proceeding first." | **Mark as hired** works only from **For hiring**. |
| "Record the client's decision for every endorsed applicant before archiving this vacancy." | Archive is refused while anyone is with the client. |
| "Keep at least one active admin." / "You cannot deactivate your own account." | User Management safety rules (§4.17). |
| "An account with this email already exists." | Use a different email for the new HR account. |
| "… was changed by someone else. Refresh and try again." / "… Refresh the page." | Two people acted at the same time; refresh and look again. |

### 7.2 The matching service (svc) is down
- Profile setup, resume replacement, and applying need it: they show "The resume service is unavailable. Try again later." Nothing is saved; try again once it runs (`pnpm dev` starts it on port 8000; the first start downloads the model).
- Pool matching counts each failed call as **failed**: use **Run pool matching again** later.
- The rematch says "The rematch did not run. Use Run rematch again."

### 7.3 Evaluate is not enabled yet
It needs all three: the applicant **confirmed**, the interview **start time has passed** (Philippine time), and **no reschedule request** is waiting.

### 7.4 No rematch offer after Not hired
Possible reasons: no other vacancy is **open**; the open ones are at a company where the applicant failed within 1 year; their endorsement is full; the applicant already applied there or was offered it; prescreen fails; matching is below the threshold; or the final score (original ratings × that vacancy's weights) is below its passing score. Open a suitable vacancy, then **Run rematch again** on the Outcomes row.

### 7.5 Pool matching invited nobody
Possible reasons: nobody in the pool is free (all have an ongoing or hired application, or a pending offer/invitation); they fail the prescreen; their matching is below the threshold; they were already invited to or applied for this vacancy; or the company is blocked for them. The **Pool invitations** tab shows invited / skipped / failed; reopening a vacancy does not run it again.

---

## 8. Glossary
| Term | Meaning |
|---|---|
| **Waiting pool** (status) | Qualified applicants of **one vacancy** waiting for a shortlist slot. |
| **Applicant Pool – Waiting** (page tab) | Applicants whose application ended **before the client** (not shortlisted, dropped, did not pass, not selected, standby). Not the same as the waiting pool. |
| **Applicant Pool – Returned by Client** | Applicants the client did not hire, or whose training failed. |
| **Shortlist** | The top 2 × slots per applicant group, chosen automatically by matching score. |
| **Locked slot** | A shortlisted applicant HR has started verifying; never pushed out. |
| **Prescreen** | The vacancy's basic conditions (age, gender, education, height), checked before matching; never part of a score. |
| **Matching score** | How well the resume fits the job's skills and experience (0–100), from Sentence-BERT + cosine similarity. |
| **Threshold** | Minimum matching score to stay in line (default 40). |
| **Interview score** | 0–100 from the 15 ratings and the vacancy's section weights (two-level WSM). |
| **Final score** | (matching + interview) ÷ 2; passed when ≥ the passing score. |
| **Rating reuse** | Using an applicant's earlier 15 ratings instead of a new interview. |
| **Notify** | HR's invitation to passed applicants to confirm they want to be endorsed. |
| **Endorsement** | Sending confirmed applicants to the client company (one batch; per-applicant packets). |
| **Endorsement packet** | One PDF per applicant: competency cover + resume, for the client. |
| **Final interview** | The client's own interview after endorsement, recorded by HR. |
| **For hiring** | The applicant proceeded after the final interview; the client's hiring decision is pending. |
| **Standby** | Passed the agency assessment but will not go to the client this time; kept in the pool. |
| **Not selected** | The vacancy filled or was archived before the application finished. |
| **Rematch / job offer** | VERA's automatic offer of another open job after a client rejection; accepting goes straight to For endorsement. |
| **Job invitation** | VERA's invitation to a pool applicant when a fitting job is published; accepting creates a normal application. |
| **Company block** | 1-year exclusion from a company's vacancies after a failed outcome there. |
| **Close-out** | The automatic closing of every unfinished application when a vacancy fills or is archived. |
| **svc** | VERA's internal matching service (PDF reading + Sentence-BERT). |

---

## 9. Where the older documents differ from the app
The app (code) is what this guide follows. These older statements no longer match it:

1. **Routes not built** (APP_FLOW §1): `/signup/verify` (6-digit code), `/forgot-password`, `/reset-password`, `/admin/reports`, `/admin/settings`, `/admin/competencies` do not exist. Sign-up uses an emailed **confirmation link**, not a 6-digit code (PRD FR-AUTH-06); **Google sign-in** and **Forgot password** are not shown (FR-AUTH-04/05); there is no Settings or Competencies page.
2. **Scheduled jobs** (APP_FLOW §7) do not exist: no automatic expiry of document requests, interview confirmations, or endorsement confirmations, no interview reminders (FR-INT-07), no emails, no draft purge. Deadlines are shown only (§4.4).
3. **Menu names:** **Company List** opens a page titled **Company Management**. (Fixed Oct 19: the sidebar now says **Interview Assessment** like the page titles, and **Log out** in both places; the staff notice for a reschedule request says "Interview Assessment" too. DESIGN.md still keeps the mockup's "Interviews Assessment".)
4. **Vacancy setup** (APP_FLOW §4.1): there is no **Find matches in talent pool** step; pool matching runs automatically on publish. The form sections are **Company & position · Job description · Requirements · Qualifications (prescreen) · Pipeline settings · Competency weights** (docs: "Details · Requirements · Prescreen · Pipeline · Competencies & weights").
5. **Endorsement Management** (APP_FLOW §1.3, §4.4): tabs are **Candidates** and **Outcomes** (no Post-hiring tab); there is no **Generate form** (PDF + XLSX) or **Send to company**: HR uses **Create endorsement**, **Printable page**, and the packet **Download** on the Ranking tab (decision 33; it was on Outcomes before Oct 20).
6. **Applicant Pool** (APP_FLOW §1.3): tabs are **Waiting** and **Returned by Client** (not "Waiting · Invited"); manual HR invitations do not exist (APP_FLOW §3.3 "Suggested vacancy" is now the automatic rematch offer).
7. **Resume Screening tabs** (APP_FLOW §4.2): labelled **Applicants with Work Experience** and **First-Time Job Seekers** (docs: "Experienced | First-time").
8. **Unused notification types:** `document_verified`, `interview_reminder`, `post_hiring_details`, and `pool_invitation` exist in the code's list but are never sent.
9. **Applicant detail page** (`/admin/applicants/:id`) is a placeholder; HR sees an applicant's profile and documents in the Resume Screening review sheet.
10. **Document types** (decision 29): older documents list ten supporting types (TOR, NBI / police / barangay clearance, valid ID, birth and medical certificates, …); the app offers only **Certificate, Diploma, Other**, for uploads and HR requests. The upload dialog has no "PDF only, up to 10 MB. HR verifies each document." line (decision 30); the rules still apply.
11. **Final interview notice** (decision 32, Oct 20): older documents (APP_FLOW before Oct 20, decisions 14–15, TC-103) describe a separate **Schedule final interview** step after the endorsement that always notifies the applicant. Now the final interview is in the **Notify** message the applicant confirms, and **Create endorsement** sets it on everyone at once without a second notice (only a changed time, or an applicant from a rematch, gets one). The DFD keeps its processes and flows (9.4 still records the schedule; 11.1's notice now carries it).
