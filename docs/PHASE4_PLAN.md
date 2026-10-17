# VERA — Phase 4 detailed plan (decisions 19, 20, then 16 as a cuttable last pass)

*Copied into the repo Oct 17, 2026 from the approved planning file. Parts A and B are built (`1caafed`); Part C is being built with the confirmed answers below.*

## Context
Phases 1–3 are committed. Phase 4 brings three cut sprint items back in scope (docs/FINAL_DESIGN_DECISIONS.md): **19** the admin creates HR accounts and activates/deactivates them; **20** the applicant requests an interview reschedule with a reason (max 2), HR approves (new time) or declines; **16** attach existing documents when applying, plus resume replacement. Priority and time box: **19 + 20 tonight**, **16 tomorrow morning if time** (16 is a separate last pass that can be cut without touching 19/20).

Confirmed answers applied:
- **11** — resume replacement is allowed during an active application; existing applications keep their own resume (`application.resume_id`) and matching; new applications use the new resume.
- **12** — approving a reschedule of a **confirmed** interview moves the application back to `interview_scheduled` (new status move) so the applicant confirms the new time.
- **13** — an admin cannot deactivate themselves or the last active admin; deactivation also bans the user in Supabase Auth.
- New (today): the reschedule limit counts **every request** (approved and declined), so one counter column; replacement leaves the **profile unchanged**; replacement is **blocked while a job offer or invitation is pending**.

Lean: no emails (in-app only), no competency management (FR-ADM-04's other half stays deferred), no admin-creates-admin, no profile re-review on replacement, no automatic expiry of reschedule requests. No VERA-ALGO change in any part.

Manual approval, file by file (as before): `domain/statusMachine.js` (19/20), `domain/closeOut.js` (20), `modules/screening/*` resume reads (16), `modules/evaluations/evaluations.service.js` resume read (16).

---

## Part A — Decision 19: User Management (admin only)

### A.1 Database
**No migration.** `user_account.account_status` (`active | inactive`), `created_by`, `last_login_at` exist; the auth trigger creates `user_account` with the role from `app_metadata.vera_role` (initial schema); `authenticate` already answers 403 "Your account is deactivated. Contact the agency." for inactive accounts.

### A.2 API — new `modules/users/` (routes, controller, service, repository, schemas), mounted `admin.use("/users", requireRole(ROLES.ADMIN), usersRouter)` in `src/routes.js` (HR → 403)
- **`GET /api/admin/users`** → staff accounts only (`role in (admin, hr)`), ordered role, name: `[{ userId, email, fullName, role, accountStatus, lastLoginAt, createdAt, isSelf }]`.
- **`POST /api/admin/users`** `{ email, fullName (1–120), temporaryPassword }` → **201** `{ userId, email, fullName, role: "hr", accountStatus: "active" }`.
  - zod: password rule FR-AUTH-02 (8+ chars, 1 letter, 1 number; same regex as `scripts/seed-admin.js`, moved to `@vera/shared` `PASSWORD_RULE` and reused there and in the web form).
  - email already in `user_account` (case-insensitive) → **409** "An account with this email already exists." (checked before Supabase; a Supabase "already registered" error maps to the same 409).
  - `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { vera_role: "hr" }, user_metadata: { full_name } })` → the trigger inserts `user_account`; then one statement sets `created_by = <admin>` (insert-on-conflict like seed-admin if the trigger row is missing). Role is always `hr` (decision 19). Password is never logged or returned.
- **`PATCH /api/admin/users/:id/status`** `{ accountStatus: "active" | "inactive" }` → `{ userId, accountStatus, signInBlocked }`.
  - Target not a staff account → 404 "Staff account not found." · target = self and `inactive` → **409** "You cannot deactivate your own account."
  - **Deactivate:** transaction (`withTransaction(adminId)`): `select … from user_account where role = 'admin' and account_status = 'active' order by user_account_id for update` (serializes two admins deactivating each other) → if the target is an active admin and it is the last one → **409** "Keep at least one active admin." → `update … set account_status = 'inactive'`. After the commit: Supabase ban `updateUserById(id, { ban_duration: "876000h" })`; a ban failure is logged (ids only) and returns `signInBlocked: false` (VERA already refuses the account through `authenticate`); pressing Deactivate again re-applies the ban (idempotent: same status → only the ban).
  - **Activate:** Supabase unban (`ban_duration: "none"`) **first** (failure → 502 "Could not unblock sign-in. Try again.", nothing changed) → then the status update.
- Effects already in place: `notifyStaff` and the interviewer list use active accounts only; an inactive HR stays as the interviewer of existing attempts (display only).
- DATABASE_SCHEMA §8: new lock site "Deactivate staff" (active admin rows only; never combined with the job_vacancy order).

### A.3 Web
- `layouts/navigation.js`: item **User Management** (`/admin/users`, icon `UserCog`) with `roles: [ROLES.ADMIN]`; `AdminLayout` filters items by the signed-in role (HR never sees it).
- `app/routes.jsx`: `/admin/users` inside a `RequireRole roles={[ROLES.ADMIN]}` (HR → the existing not-allowed redirect).
- `pages/admin/Users.jsx` + `features/users/{api.js, CreateHrDialog.jsx, schemas.js}`: DataTable (name, email, role, status badge Active/Inactive, last sign-in in Philippine time); **Add HR account** dialog (email, full name, temporary password + "Share this password with the HR staff member; they sign in with it."); row action **Deactivate** / **Activate** with ConfirmDialog ("{name} can no longer sign in. Their past work stays in VERA."); no Deactivate on your own row; 409 messages shown in the dialog; toast warns when `signInBlocked` is false. Loading/empty/error states.

### A.4 Tests
- API `users.test.js`: admin-only (HR 403, applicant 403); list = staff only, `isSelf`; create → createUser args (`vera_role: "hr"`, `email_confirm: true`), `created_by` set, 409 duplicate (pre-check and Supabase error), 400 weak password, password never in the response or logger calls; deactivate self 409; last active admin 409 (lock query uses `for update`); HR deactivate → status + ban call after commit; ban failure → `signInBlocked: false`; activate → unban before the update, unban failure → 502 and no update; unknown/applicant id → 404.
- `shared-enums.test.js`: `PASSWORD_RULE` used by seed-admin and the web schema (one source).
- Web `Users.test.jsx`: HR never sees the nav item / route; table states; create form validation and post body; deactivate confirm; no button on own row; 409 shown.

---

## Part B — Decision 20: Applicant reschedule request, HR approve / decline (max 2 requests)

### B.1 Migration `supabase/migrations/20261021000000_reschedule_requests.sql`
```sql
-- Phase 4 (decision 20): the applicant may request an interview reschedule at most max_reschedules (2) times per
-- application; approved AND declined requests both count, so the counter lives on the application. The attempt
-- statuses reschedule_requested / rescheduled, interview_schedule.reschedule_reason, attempt_number 1..3 and the
-- max_reschedules setting already exist (initial schema). No existing row changes meaning.
begin;
alter table public.application
  add column if not exists reschedule_requests smallint not null default 0
    check (reschedule_requests between 0 and 2);
comment on column public.application.reschedule_requests is
  'Phase 4, decision 20: interview reschedule requests made by the applicant (approved or declined), max 2.';
commit;
```
Verification (read-only):
```sql
-- 1. Expect: reschedule_requests | smallint | 0 | NO
select column_name, data_type, column_default, is_nullable from information_schema.columns
 where table_schema = 'public' and table_name = 'application' and column_name = 'reschedule_requests';
-- 2. Expect one CHECK with "reschedule_requests >= 0 AND reschedule_requests <= 2"
select pg_get_constraintdef(oid) from pg_constraint
 where conrelid = 'public.application'::regclass and pg_get_constraintdef(oid) like '%reschedule_requests%';
-- 3. Expect 0 (nobody has a request yet)
select count(*) from public.application where reschedule_requests <> 0;
-- 4. Expect '2'
select value from public.system_setting where key = 'max_reschedules';
-- 5. The one-open index already covers reschedule_requested (expect ... status IN ('pending_confirmation','confirmed','reschedule_requested'))
select indexdef from pg_indexes where schemaname = 'public' and indexname = 'interview_one_open_per_application';
```

### B.2 Shared
- `notifications.js`: `RESCHEDULE_DECLINED: "reschedule_declined"` (`HR_RESCHEDULE_REQUESTED` already exists; approve reuses `INTERVIEW_RESCHEDULED`).
- `labels.js`: interview status `reschedule_requested` → HR "Reschedule requested" (warning), applicant "Reschedule requested"; `rescheduled` → "Rescheduled" (neutral).

### B.3 Status machine (manual approval) — `domain/statusMachine.js`
`[A.INTERVIEW_CONFIRMED]` gains `A.INTERVIEW_SCHEDULED` (answer 12: approved reschedule of a confirmed interview; history reason "Reschedule approved: please confirm the new time"). APP_FLOW §5.1 + `statusMachine.test.js`.

### B.4 Domain — `domain/interview.js`
- `LIVE_INTERVIEW_STATUSES = [pending_confirmation, confirmed, reschedule_requested]` (= the DB one-open index). `OPEN_INTERVIEW_STATUSES` (edit, confirm, no-show) stays as is.
- `assertCanRequestReschedule(attempt, application, used, max, now)`: attempt open and matching the application (`assertOpen`); before `scheduled_at` (else 409 "The interview time has passed. Please contact Confiable Manpower."); `used < min(max, 2)` (else **422** "You have used both reschedule requests. Please contact Confiable Manpower."; 2 = the `attempt_number ≤ 3` ceiling, commented).
- `statusAfterDecline(application)`: `interview_scheduled → pending_confirmation`, `interview_confirmed → confirmed`.
- `assertOpen` callers get a clearer 409 when the attempt is `reschedule_requested`: "Answer the reschedule request first." (HR edit, no-show) / "Your reschedule request is waiting for the agency." (applicant confirm).
- `LIVE_INTERVIEW_STATUSES` replaces `OPEN_INTERVIEW_STATUSES` in: `domain/closeOut.js` (cancel attempts on not_selected; **manual approval**: otherwise a requested attempt stays open after an archive/fill), `dashboard.repository.js` (upcoming interviews), `interviews.repository.js` `listInterviewsForHr` and `listMyInterviews`.

### B.5 API (`modules/interviews/`)
- **`POST /api/applicant/interviews/:id/reschedule-request`** `{ reason: 5–500 chars }` → `{ interviewId, status: "reschedule_requested", requestsLeft }`. Not their interview → 404. Locks job_vacancy → application (like confirm); re-read attempt; `assertCanRequestReschedule` (max from `system_setting.max_reschedules`, read like `response_deadline_days`); attempt `pending_confirmation|confirmed → reschedule_requested` (compare-and-set) + `reschedule_reason`; `application.reschedule_requests + 1`; application status unchanged; `notifyStaff(HR_RESCHEDULE_REQUESTED)` link `/admin/interviews`.
- **`POST /api/admin/interviews/:id/reschedule/approve`** `{ scheduledAt, durationMinutes, meetingLink, interviewerId }` (the existing `editSchema`: future time, https link) → `{ interviewId: <new>, attemptNumber, status: "pending_confirmation", applicationStatus: "interview_scheduled" }`. Locks job_vacancy → application; attempt must be `reschedule_requested` (409 otherwise); active interviewer (422); old attempt → `rescheduled`; insert attempt `attempt_number = old + 1` (`insertInterview` gains `attemptNumber`), `confirm_due_at = confirmDueAt(responseDueAt, scheduledAt)`; application `interview_confirmed → interview_scheduled` via `transition()` when confirmed (answer 12), else unchanged; applicant notice `INTERVIEW_RESCHEDULED` with the confirm deadline, `requiresAction: true`. 23505 on `interview_one_open_per_application` → 409.
- **`POST /api/admin/interviews/:id/reschedule/decline`** (no body) → `{ interviewId, status }`. Attempt must be `reschedule_requested`; back to `statusAfterDecline(application)` (compare-and-set); `reschedule_reason` kept; applicant notice `RESCHEDULE_DECLINED`, `requiresAction` only when still unconfirmed.
- HR **Edit time** stays (decision 20: "HR can still change a date on its own"; never counts as a request).
- Lists: HR list rows add `attemptNumber`, `rescheduleReason` (only while requested), `rescheduleRequests`; applicant list adds `requestsLeft` (never the reason of anything else, no company).
- DATABASE_SCHEMA §8 rows: request / approve / decline = job_vacancy → application (the attempt written only under the application lock).

### B.6 Notification texts (`domain/notify.js`; no company, no link, Philippine time)
- `hr_reschedule_requested` — **"Reschedule requested: {name}"** — "{name} asked to reschedule the interview for {job} at {company} on {date} (Philippine time). Reason: {reason}. Approve with a new time or decline in Interviews Assessment."
- `interview_rescheduled` (approve, existing text, with the confirm line) — **"Interview time changed: {job}"** — "Your online interview for {job} is now on {date} ({n} minutes). Please confirm it on your dashboard by {due}. If you can't attend at the new time, please contact Confiable Manpower."
- `reschedule_declined` — **"Reschedule request declined: {job}"** — "Your interview for {job} stays on {date} (Philippine time). {Please confirm it on your dashboard by {due}. | }If you can't attend, please contact Confiable Manpower."

### B.7 Web
- Applicant: `features/interviews/InterviewConfirmDialog.jsx` and `InterviewCard.jsx` gain **Request reschedule** (secondary; shown while open, before the time, and `requestsLeft > 0`) → new `RequestRescheduleDialog.jsx` (reason textarea, react-hook-form + zod, "You can request {n} more reschedule(s). The agency sets the new time."). While requested: the card shows "Reschedule requested. The agency will set a new time or keep this one." (no confirm button, no link). Hook `useRequestReschedule` in `features/interviews/api.js`.
- HR `pages/admin/Interviews.jsx`: status badge "Reschedule requested" + the reason under it + "Request {n} of 2"; actions **Approve** (opens `ScheduleInterviewDialog` in an `approve` mode, prefilled interviewer / duration / link, title "Set the new interview time") and **Decline** (ConfirmDialog "Keep the current time? The applicant is told the interview stays on {date}."); Edit time / Mark no-show disabled with a tooltip while requested. Hooks `useApproveReschedule`, `useDeclineReschedule`.

### B.8 Tests
- `interview.domain.test.js`: request allowed from pending/confirmed, refused after the time, refused at 2 used (and with a setting of 3 → still 2), `statusAfterDecline`, the clearer 409s.
- `interviews.test.js`: request (404 other applicant, locks order, counter +1, attempt reason, staff notice text, application status unchanged), 3rd request 422 even after a decline; approve (new attempt number + 1, old `rescheduled`, confirmed → `interview_scheduled` via transition, pending stays, notice with the deadline, 409 when not requested, 422 inactive interviewer); decline (back to the right attempt status, notice text with/without the confirm line); edit / confirm / no-show while requested → 409 messages; lists include requested attempts.
- `statusMachine.test.js`: the new move allowed, nothing else changed. `closeOut.test.js`: a requested attempt is cancelled. `dashboard.test.js`: upcoming includes requested. `notify.test.js`: the three texts (no company, no link).
- Web: `InterviewCard.test.jsx` (button visibility, requested state), new `RequestRescheduleDialog.test.jsx`, `Interviews.test.jsx` (approve posts the times as +08:00, decline, disabled actions).

---

## Part C — Decision 16 (separate last pass, can be cut): attach documents when applying, resume replacement

### C.1 Migration `supabase/migrations/20261021010000_application_document.sql`
```sql
-- Phase 4 (decision 16): supporting documents the applicant chose to attach when applying. Verification stays per
-- document (FR-SCR-02); this only records what the applicant sent with the application.
begin;
create table if not exists public.application_document (
  application_id         uuid not null references public.application (application_id) on delete cascade,
  supporting_document_id uuid not null references public.supporting_document (supporting_document_id) on delete restrict,
  attached_at            timestamptz not null default now(),
  primary key (application_id, supporting_document_id)
);
create index if not exists application_document_document_idx on public.application_document (supporting_document_id);
alter table public.application_document enable row level security;   -- rule 6: no policies, API only
comment on table public.application_document is 'Phase 4, decision 16: documents attached when applying.';
commit;
```
Verification: table exists with 3 columns; `relrowsecurity = true` and 0 policies (`select count(*) from pg_policies where tablename = 'application_document'`); FKs `on delete cascade` / `restrict` (`pg_get_constraintdef`); 0 rows. `supabase/scripts/delete-check-vacancies.sql` and `reset-applications.sql`: delete `application_document` rows of the deleted applications explicitly (cascade, but counted) and the restrict FK never blocks (documents are not deleted).

### C.2 Attach documents when applying
- `applications.schemas.js` `applySchema`: `attachDocumentIds: z.array(z.uuid()).max(20).default([])` (unique).
- `applyToVacancy`: under the applicant lock, every id must be a **current** document of this applicant (else **422** "Choose from your current documents."); after the application insert, insert the links (any outcome, so HR sees what was sent even for a pool entry). Invitation/rematch accept attach nothing (lean).
- HR review sheet (`screening.repository` documents query): each current document gets `attachedWhenApplying` (left join on `application_document` for this application) → badge **"Attached when applying"**; verification logic unchanged.
- Web `features/applications/ApplyDialog.jsx`: loads the applicant's current documents; if any, "Attach documents to this application?" with checkboxes (unchecked; "Select all"); none → "You have no documents yet. Upload them in My Documents; the agency may request them later." Sends `attachDocumentIds`.

### C.3 Resume replacement (answers 11, profile unchanged, pending-offer block)
- `POST /api/applicant/resume/parse` (existing): allowed when the profile exists (a draft for replacement; same svc `/extract`, same storage draft, same 400 for unreadable PDFs); the response for a replacement is `{ fileName, warnings, yearsExperience }`.
- **`POST /api/applicant/resume/replace`** (no body) → `{ resumeId, fileName, uploadedAt, verificationStatus: "pending" }`:
  - no draft → 422 "Upload your new resume first."; a pending job offer or invitation → **409** "Answer your pending job offer or invitation first."
  - move the draft file to `<applicantId>/<uuid>.pdf` before the transaction (moved back on failure, like confirmProfile); transaction: lock applicant → old current resume `is_current = false, archived_at = now()` (file kept) → insert the new resume (`pending`) + `resume_extraction` (reuse `insertResume` / `insertExtraction` from `applicant-profile.repository.js`) → delete the draft. Profile unchanged. No svc call inside the transaction (the extraction came from parse).
- **Existing applications keep their resume** (answer 11): every screening/interview/evaluation read of "the resume" becomes the **application's** resume (`application.resume_id`) instead of the current one: `screening.repository.findCurrentResume` → `findApplicationResume(applicationId)` in `screening.service` (detail, resume URL), `interviews.service.scheduleInterview` (fully verified), `evaluations.service` (reuse check); `setResumeVerification` / `findResumeOwner` match `resume_id = application.resume_id` instead of `is_current` (**manual approval**). The packet already uses the application's resume. New applications, rematch and pool matching already read the current resume + extraction (fresh matching, BR-20).
- FR-PROF-07 block is removed (answer 11); CLAUDE.md rule 5 reworded: "One current resume per applicant; replacement allowed (not while a job offer or invitation is pending); ongoing applications keep the resume they were sent with; the new resume starts unverified. Matching runs from stored `resume_extraction`, never by re-sending the PDF."
- Web `pages/applicant/Documents.jsx` Resume tab: **Replace resume** → dialog (FileDropzone → parsing → file name + warnings → **Use this resume**), text: "Applications you already sent keep their resume. New applications use this one, and the agency checks it again. Your profile does not change; edit it in My Profile if needed." 409/422 shown in the dialog.

### C.4 Tests
- API: apply with valid / foreign / replaced document ids (422), links inserted after the application; review sheet `attachedWhenApplying`; replace: no draft 422, pending offer 409, old row archived + new pending row + extraction in one transaction, file moved back on failure, profile untouched; screening detail / verify / schedule use the application's resume after a replacement (verify on the old resume still works; the new one is not offered for that application); a new application stores the new `resume_id`; `resumes.parse.test.js` allows a profile owner.
- Web: ApplyDialog document checklist and body; Documents replace dialog flow.

---

## Check scripts
- **check-s13** (re-run, no assertion change expected): the applicant interview list gains `requestsLeft` (not a leak-pattern key); HR edit-time path unchanged. Re-run **s11, s12** after Part C (apply body optional; the review sheet resume is the application's).
- **check-s14..s17**: no change (height rule already in place). **check-p3**: re-run once after Part C (apply schema).
- `supabase/scripts/delete-check-vacancies.sql`: Part C adds the explicit `application_document` delete (count shown) before the applications.

### New `scripts/check-p4.ps1` (PS 5.1, ASCII, API only, ZZ only, `return ,@()`; params `-AdminEmail -HrEmail -ApplicantAEmail -ApplicantBEmail [-ApplicantCEmail] -ResumePath`, passwords prompted)
- Pre-checks: Phase 4 migration(s) verified (type `MIGRATED`); no 'ZZ Check' vacancy exists (run `delete-check-vacancies.sql`); A, B (, C) fresh throwaways without a profile; Juan never used.
- **1. Users (19):** HR token on `GET /api/admin/users` → 403; admin list contains self with `isSelf`; create `zz-check-p4-hr-<ts>@example.com` "ZZ Check P4 HR" with a random in-memory password (letter + digit, never printed) → 201 role hr; same email → 409; weak password → 400; the new HR signs in → `/api/me` role hr; admin deactivates it → its next API call 403 and a new Supabase sign-in fails (banned); admin deactivates self → 409; activate → sign-in works; deactivate again at the end (the throwaway HR stays inactive; Supabase users are not deleted).
- **2. Reschedule (20):** company + ZZ vacancy **VR** (Cashier text, `minHeightCm = 249`, slots 2) published; A and B (250 cm) apply → shortlisted; HR verifies each resume → schedules both (now + 2 days).
  - A requests (#1, reason) → `reschedule_requested`, `requestsLeft = 1`, HR notice "Reschedule requested: …" (no link); HR edit → 409; A confirm → 409; applicant token on approve → 403; B on A's interview → 404.
  - HR approves A with a new time → new attempt 2 `pending_confirmation`, A notice "Interview time changed: {VR}" with the confirm line; A confirms → `interview_confirmed`.
  - A requests (#2) from confirmed → HR approves → attempt 3, application back to **`interview_scheduled`** (answer 12); A requests (#3) → **422**.
  - B requests (#1) → HR declines → B's attempt back to `pending_confirmation`, application still `interview_scheduled`, notice "Reschedule request declined: {VR}"; B requests (#2) → HR declines; B (#3) → **422** (declines count).
  - Read-only SQL printed: attempts of A and B by `attempt_number`; `reschedule_requests` = 2 for both.
- **3. Attach and replace (16, only if Part C is built; `-ApplicantCEmail`):** C uploads one document; **VD** published; C applies with `attachDocumentIds` → HR sheet shows it "attached when applying"; a foreign id → 422; C replaces the resume during the active application → 200 pending; HR sheet of VD still shows the **old** resume id (verified state unchanged); HR drops C → C is in the pool → publish **VF** (Cashier text, 249 cm) → C is invited → C replaces again → **409** (pending invitation); C declines → C applies to VF directly → the HR sheet resume id = the newest resume.
- 403 checks for every new endpoint; summary + cleanup hint (`delete-check-vacancies.sql`; the throwaway HR account stays inactive).

---

## Docs
- **PRD:** FR-AUTH-07 + FR-ADM-04 (Phase 4 note: admin creates HR, activate/deactivate, self/last-admin rule, Supabase ban; competency management still deferred); FR-INT-03 + BR-09 (request with reason, max 2 requests counting declines, approve → new attempt, confirmed → interview_scheduled, decline keeps the time; HR edit unchanged); FR-PROF-06/07 + BR-13 (Part C: allowed during active applications, ongoing keep their resume, not while an offer/invitation is pending, profile unchanged, old file kept); FR-APP-02 (Part C: optional document attach); §8 sprint scope list.
- **TRD:** §6.2/§6.3 the new endpoints; §9 the three notices; module list (`users`).
- **DATABASE_SCHEMA:** §3.4 `application.reschedule_requests`, interview attempt rules; §3.2 `application_document` (Part C); §7 Phase 4 verification queries; §8 lock rows (staff deactivate, reschedule request/approve/decline, resume replace).
- **APP_FLOW:** §3.3 (Request reschedule, Replace resume, attach), §4.3 (approve/decline), new §4.8 User Management, §5.1 (`interview_confirmed → interview_scheduled`), §5.3 (requested → rescheduled / back), §6 labels.
- **UI_GUIDELINES:** `/admin/users` row; interview status tones; nav note (admin only).
- **test-cases:** TC-08/09 (Phase 4 notes), TC-45 (max 2 requests incl. declines), TC-16/17 (rewritten for answer 11), new TC-110 (deactivate rules + ban), TC-111 (reschedule approve on confirmed → scheduled), TC-112 (decline keeps time), TC-113 (attach documents).
- **ROADMAP:** Phase 4 line; §6 rows "Admin User Management UI", "Applicant reschedule requests", "Resume replacement" → back in scope (Phase 4).
- **FINAL_DESIGN_DECISIONS:** repo status for 19, 20 (and 16 when built).
- **CLAUDE.md** rule 5 (Part C only). **GETTING_STARTED** (Phase 4 migrations before restart; check-p4). **CHANGELOG**. `seed-admin.js` header comment (the UI now exists; the script stays for the first admin).

## Build order (time box)
**Tonight — 19 + 20**
1. Migration `20261021000000` written → you apply + run B.1 verification.
2. Part A: shared `PASSWORD_RULE` → users module → routes → web page/nav → tests.
3. Part B: shared labels/notice → statusMachine move (**manual approval**) → `domain/interview.js` → closeOut (**manual approval**) → interviews service/routes/lists → notify texts → web applicant + HR → tests.
4. `pnpm test`, `pnpm lint`, `pnpm algo:check` (unchanged, still run); check-p4 parts 1–2; re-run check-s13.
5. Docs for 19/20 + CHANGELOG → you commit.

**Tomorrow morning — 16 (cut if short on time)**
6. Migration `20261021010000` → you apply + verify.
7. Attach (schema, apply, review sheet, ApplyDialog) → replacement (parse, replace, application-resume reads with **manual approval**, Documents dialog) → tests → cleanup scripts → check-p4 part 3 → re-run s11, s12, p3 → docs (CLAUDE.md rule 5, PRD, TC-16/17/113) → you commit.

## Verification
`pnpm test` / `pnpm lint` / `pnpm algo:check` green; Phase 4 verification queries match; `check-p4.ps1` passes (parts 1–2 tonight, part 3 after Part C); check-s13 (and s11, s12, p3 after Part C) still pass; browser: admin sees User Management, HR does not; applicant requests a reschedule from the dashboard card; HR approves with a new time and the applicant confirms again; HR declines and the old time stays.
