# VERA — Technical Requirements Document (TRD)

> How VERA is built. Product rules: [PRD](./PRD.md). Data: [DATABASE_SCHEMA](./DATABASE_SCHEMA.md). Screens/flows: [APP_FLOW](./APP_FLOW.md). Plan: [ROADMAP](./ROADMAP.md).

---

## 1. Architecture

```mermaid
flowchart LR
  B[Browser\nReact + Vite] -- "Supabase Auth only\n(publishable key)" --> SA[(Supabase Auth)]
  B -- "REST /api\nBearer access token" --> API[Express API\napps/api]
  API -- "verify token\nadmin createUser\nstorage" --> SA
  API -- "SQL (pg Pool)\ntransactions" --> PG[(Supabase Postgres)]
  API -- "upload / signed URLs" --> ST[(Supabase Storage\nresumes · documents · endorsements)]
  API -- "HTTP + X-Internal-Key" --> SVC[Python svc\nFastAPI + PyMuPDF + SBERT\napps/svc]
  API -- SMTP --> MAIL[Email\nNodemailer]
  API -. "node-cron every 15 min" .-> JOBS[Scheduled jobs]
```

**Responsibilities**

| Part | Owns | Never does |
|---|---|---|
| `apps/web` | UI, routing, Supabase Auth session (sign-up/in, OTP, Google, reset), calls `/api` | Reads/writes app tables directly, holds secrets |
| `apps/api` | All business rules, authorization, SQL, storage, emails, scheduled jobs, calls svc | Parses PDFs or runs ML |
| `apps/svc` | PDF validation, text extraction, section split, profile extraction, SBERT matching | Talks to the database or is exposed publicly |
| Postgres | Data, constraints, status history trigger, generated scores | Business workflow logic beyond constraints |

---

## 2. Tech stack

| Layer | Choice (current version in repo) | Add |
|---|---|---|
| Monorepo | pnpm workspaces + Turborepo 2 | `packages/shared` |
| Frontend | React 19, Vite 7, React Router 7, Tailwind 4, shadcn/ui (base-ui, `base-vega` style), lucide-react | Roboto (`@fontsource-variable/roboto`, replaces Inter), `@supabase/supabase-js`, `@tanstack/react-query`, `react-hook-form`, `zod`, `@hookform/resolvers`, `sonner`, `date-fns`, `clsx` + `tailwind-merge` (replace the `cn` npm package) |
| Backend | Node (ESM), Express 5, `pg`, `@supabase/supabase-js`, `multer`, `cors`, `dotenv` | `zod`, `helmet`, `express-rate-limit`, `pino` + `pino-http`, `node-cron`, `nodemailer`, `pdfkit`, `exceljs`, `archiver`; dev: `vitest`, `supertest`. **Added (Phase 2): `pdf-lib` 1.17.1** for the per-applicant endorsement packet (draws the cover and copies the resume pages into one PDF; pdfkit cannot merge) |
| Microservice | Python 3.11, FastAPI, PyMuPDF (`fitz`), sentence-transformers (`all-MiniLM-L6-v2`), numpy | `requirements.txt`, `uvicorn[standard]`, `python-multipart`, internal-key dependency |
| Database / Auth / Files | Supabase (Postgres 15+, Auth, Storage) | migrations in `supabase/migrations` |

---

## 3. Repository structure

### 3.1 Target layout
```
VERA/
├── CLAUDE.md                     # instructions for Claude Code (read first)
├── CHANGELOG.md
├── CONTRIBUTING.md               # team workflow
├── README.md                     # setup + run (replace the empty one)
├── .claude/                      # Claude Code settings + slash commands (/task, /done, /algo, /migration)
├── .github/pull_request_template.md
├── .vscode/                      # recommended extensions; Todo Tree highlights VERA-ALGO blocks
├── docs/                         # PRD, TRD, DATABASE_SCHEMA, APP_FLOW, ROADMAP, ALGORITHM (+ generated
│                                 # ALGORITHM_INDEX / ALGORITHM_CODE), UI_GUIDELINES, DESIGN, test-cases
├── supabase/
│   ├── migrations/               # 20261006000000_initial_schema.sql, then new files only
│   └── seed.sql
├── scripts/
│   ├── run-py.mjs                # runs the svc venv python on Windows/macOS/Linux
│   └── algo-map.mjs              # VERA-ALGO marker check + index/handout generator
├── packages/
│   └── shared/                   # @vera/shared — enums, labels, constants used by web + api
│       ├── package.json
│       └── src/{index.js,statuses.js,roles.js,documents.js,notifications.js}
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── main.jsx
│   │       ├── app/              # App.jsx, router.jsx, providers.jsx
│   │       ├── layouts/          # AuthLayout, ApplicantLayout, AdminLayout (sidebar + header + <Outlet/>)
│   │       ├── routes/           # RequireAuth, RequireRole, RequireProfile
│   │       ├── pages/
│   │       │   ├── auth/         # Login, SignUp, VerifyCode, ForgotPassword, ResetPassword, AuthCallback
│   │       │   ├── applicant/    # Setup, Dashboard, Jobs, JobDetail, Documents, Notifications
│   │       │   └── admin/        # Dashboard, Companies, Vacancies, Applicants, Screening, Interviews, Endorsements, TalentPool, Settings, Users, Competencies
│   │       ├── features/         # <feature>/{components/, api.js (react-query hooks), schemas.js}
│   │       ├── components/
│   │       │   ├── ui/           # shadcn-generated ONLY (do not hand-edit beyond theming)
│   │       │   └── shared/       # StatusBadge, PageHeader, EmptyState, ConfirmDialog, FileDropzone, DataTable, ScoreBar
│   │       ├── lib/              # supabase.js, apiClient.js, utils.js (cn), format.js, queryClient.js
│   │       ├── hooks/            # useAuth, useMe, useDebounce
│   │       ├── assets/
│   │       └── index.css         # Tailwind + shadcn tokens (merge global.css and login.css here)
│   ├── api/
│   │   ├── scripts/seed-admin.js
│   │   ├── tests/
│   │   └── src/
│   │       ├── server.js         # import 'dotenv/config'; start http + jobs
│   │       ├── app.js            # helmet, cors, json, pino-http, routes, notFound, errorHandler
│   │       ├── routes.js         # mounts every module router under /api
│   │       ├── config/env.js     # zod-validated process.env (fail fast)
│   │       ├── db/{pool.js,tx.js}
│   │       ├── lib/{supabaseAdmin.js,storage.js,svcClient.js,mailer.js,logger.js,errors.js}
│   │       ├── middleware/{authenticate.js,requireRole.js,validate.js,upload.js,notFound.js,errorHandler.js}
│   │       ├── domain/{statusMachine.js,shortlist.js,prescreen.js,scoring.js,deadlines.js,notify.js}
│   │       ├── modules/          # one folder per feature (see 3.3)
│   │       └── jobs/{index.js, expireDocumentRequests.js, expireInterviewConfirmations.js, ...}
│   └── svc/
│       ├── package.json          # pnpm wrapper: dev/test scripts call ../../scripts/run-py.mjs
│       ├── requirements.txt      # runtime deps (training/requirements.txt stays separate)
│       ├── app/
│       │   ├── main.py           # FastAPI app, lifespan preload, routers
│       │   ├── api/{deps.py,extract.py,match.py}
│       │   ├── core/config.py
│       │   ├── cleaners/ extractors/ standardizers/ validators/   # keep existing modules
│       │   └── matchers/         # chunking, embedding, similarity, coverage, experience, scoring, rules, algorithm (ALGORITHM.md §2)
│       ├── tests/
│       └── training/             # NER training pipeline (not imported by the service)
├── package.json  pnpm-workspace.yaml  turbo.json  .gitignore
```

### 3.2 Cleanup: current → target

| Current | Action |
|---|---|
| `apps/api/.env` was inside the shared zip | **Rotate the Supabase secret key and DB password now.** Keep `.env` out of git and zips; add `.env.example` files |
| `apps/api/pnpm-lock.yaml`, `apps/web/pnpm-lock.yaml` | Delete; keep only the root lockfile; run `pnpm install` at root |
| Root `package.json` has no `dev`/`test` scripts | Add `dev`, `test`, `lint`, `build` (`pnpm -r`; turbo opt-in) |
| svc not started by turbo; no runtime `requirements.txt` | Add `apps/svc/package.json` + `scripts/run-py.mjs` + `requirements.txt` |
| `routes/applicant.router.js`, `routes/user.router.js`, `controllers/test.controllers.js`, `controllers/applicant.controller.js`, `controllers/user.controller.js`, `services/test.service.js`, `services/applicant.service.js`, `services/user.service.js` | **Delete** (mock data; `user.service.js` contains plaintext sample passwords) — **done (S3)** |
| `routes/login/authRoutes.js` + `authController` + `authServices` (`POST /api/auth`) | Replace with Supabase client login in web + `GET /api/me` — API **done (S3)**, web S4 |
| `controllers/applicant/*`, `services/applicant/*`, `routes/applicant/*` | Move into `modules/applicant-profile` and `modules/resumes` — old files **deleted (S3)**; rebuilt in S6 |
| `database/connection.js` (separate `DB_*` vars, unused `Result` import, logs on import) | `db/pool.js` using `DATABASE_URL` + SSL; health check in `/api/health` — **done (S3)** |
| `dotenv.config()` in several files | Load once: `import 'dotenv/config'` in `server.js`, validate in `config/env.js` — **done (S3)** |
| `authMiddleware.js` logs the full user object | Remove PII logs; attach `req.auth = { userId, role, email }` — **done (S3)** |
| `roleMiddleware.js` single role, extra query per route | `requireRole(...roles)` using role loaded once in `authenticate` — **done (S3)** |
| `cors()` open to all | `cors({ origin: env.WEB_ORIGIN, credentials: true })` — **done (S3)** |
| No error handler / validation / rate limit | Add `errorHandler`, `validate(schema)`, `express-rate-limit` on sensitive routes — handler + validate **done (S3)**; rate limit with S6/S11 routes |
| svc URL hard-coded `http://localhost:8000` | `env.SVC_URL` + `X-Internal-Key` |
| multer with no limits | `limits: { fileSize: 10 MB }`, PDF-only `fileFilter` |
| Web: hard-coded `http://localhost:5000` in components | `lib/apiClient.js` with `VITE_API_URL` |
| Web: token in `localStorage` via custom `/api/auth` | `supabase-js` session (remember-me storage adapter, §7.2) |
| Web: each page renders Sidebar + Header itself | Layout routes with `<Outlet/>` |
| Web: mock arrays in `JobVacancies.jsx`, `MyDocuments.jsx`, `DocumentTable.jsx`, `ResumeUpload.jsx` (application) | Replace with react-query hooks to real endpoints |
| Web: two components named `ResumeUpload` | `features/profile/ResumeDropzone.jsx` (setup + replace) and remove the document-selection one (Apply only needs the radio button) |
| Web: file input accepts `.pdf,.doc,.docx` | `.pdf` only until DOCX phase |
| Web: `lib/utils.js` re-exports `cn` from the `cn` package | Standard shadcn `cn` = `twMerge(clsx(...))` |
| Web: `shadcn` in `dependencies` | Move to `devDependencies` (or use `pnpm dlx shadcn`) |
| Web: `styles/global.css`, `styles/login.css` | Merge into `index.css` with Tailwind utilities |
| Folder casing `components/Applicant` vs `components/login` | lowercase folders, PascalCase component files |
| Branches `master`, `frontend-changes`, `backend-changes` | `main` + short-lived `feat/<module>` / `fix/<topic>` branches, merged by PR |

### 3.3 API module pattern
```
modules/vacancies/
  vacancies.routes.js       # router, middleware chain, no logic
  vacancies.controller.js   # parse req → call service → send response
  vacancies.service.js      # business rules, transactions, calls domain/*
  vacancies.repository.js   # SQL only (parameterized), receives a pg client
  vacancies.schemas.js      # zod schemas for body/query/params
```
Modules: `me`, `users` (Phase 4), `applicant-profile`, `resumes`, `documents`, `public-vacancies`, `applications`, `companies`, `competencies`, `vacancies`, `screening`, `interviews`, `evaluations`, `endorsements`, `post-hiring`, `talent-pool`, `applicants`, `dashboard`, `notifications`, `settings`, `users`.

---

## 4. Conventions

**General**
- JavaScript ESM everywhere (`"type": "module"`). No TypeScript for now; use JSDoc on domain functions.
- Shared enums/labels come from `@vera/shared` — never hard-code status strings in web or api.
- Files: components `PascalCase.jsx`; everything else `camelCase.js`; folders lowercase-kebab.
- Line endings LF (`.gitattributes`: `* text=auto eol=lf`).
- Matching/scoring code sits inside `VERA-ALGO[ID]` blocks (ALGORITHM.md §3); `pnpm algo:check` must pass.
- UI follows UI_GUIDELINES.md (tokens from DESIGN.md).

**API**
- REST, JSON, base path `/api`. Plural nouns, actions as sub-resources: `POST /api/admin/vacancies/:id/publish`.
- Request/response bodies use **camelCase**; DB stays snake_case; map in repositories.
- Success: `200/201` with `{ data }` (lists: `{ data, meta: { page, pageSize, total } }`).
- Errors: `{ error: { code, message, details? } }` with codes `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `BUSINESS_RULE`, `SVC_UNAVAILABLE`, `INTERNAL`.
- Every status change goes through `domain/statusMachine.transition(client, application, toStatus, reason)` which rejects illegal transitions (APP_FLOW §5.1).
- Every multi-step write runs in `withTransaction(actorId, fn)`; slow svc calls happen **before** opening the transaction.
- Pagination: `?page=1&pageSize=20`; search: `?search=`.

**Web**
- Server state with react-query (`features/<x>/api.js` exports `useVacancies`, `useCreateVacancy`, …). No `fetch` in components.
- Forms: react-hook-form + zod (mirror API schemas).
- UI from shadcn/ui; icons from lucide-react; toasts with sonner.
- Every list has loading, empty, and error states.

**Git**
- Conventional commits referencing PRD IDs: `feat(screening): FR-SCR-03 lock slot on first verification`.
- Update `CHANGELOG.md` under **Unreleased** in the same PR.

---

## 5. Domain logic (apps/api/src/domain)

| File | Function | Rule |
|---|---|---|
| `prescreen.js` | `prescreen(profile, vacancy) → { passed, failedConditions[] }` | DATABASE_SCHEMA §6.1 |
| `scoring.js` | `interviewScore(weights, ratings)`; `finalScore(matching, interview)` | Σ w·r/5 ; (m+i)/2, rounded 2 dp |
| `shortlist.js` | `storedMatchingScore`, `meetsThreshold`, `selectShortlist` (pure), `refreshShortlist(client, vacancyId, applicantType)` | DATABASE_SCHEMA §6.2, locks vacancy row `FOR UPDATE`; moves run with `vera.actor_id` cleared (system) |
| `statusMachine.js` | `transition(...)`, `ALLOWED` map, `assertInitial` | APP_FLOW §5.1; the UPDATE matches the status read (stale → 409) |
| `deadlines.js` | `dueAt(days = setting)` | `response_deadline_days` |
| `notify.js` | `notify(client, { userId, type, applicationId, vars })` | inserts `notification`; sets `email_status='pending'` when the type is emailable (emails deferred in the sprint: always `not_required`) |
| `round.js` | `roundHundredths(value)` | 2 dp half-up on the decimal value |
| `eligibility.js` | `atFailedCompany` / `notAtFailedCompany` (SQL condition), `FAILED_STATUSES`, `BLOCKS_APPLYING_STATUSES` | PRD BR-17, BR-19; DATABASE_SCHEMA §6.6 |

Unit-test these first; they are the thesis-critical logic.

---

## 6. API endpoints

All routes require `Authorization: Bearer <supabase access token>` except `/api/health`.

### 6.1 Common
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | API + DB + svc health |
| GET | `/api/me` | `{ userId, email, role, fullName, accountStatus, hasProfile }` |
| GET | `/api/notifications` | own feed, newest first, `?limit=` (1–50, default 20) → `{ data: [{ notificationId, type, title, message, linkPath, requiresAction, isRead, createdAt }], meta: { unreadCount } }`; every role (S11) |
| POST | `/api/notifications/read-all` | marks the user's unread notifications read → `{ data: { updated } }` (S11; PATCH `/:id/read` not built in the sprint) |

### 6.2 Applicant (`requireRole('applicant')`)
| Method | Path | Purpose (PRD) |
|---|---|---|
| POST | `/api/applicant/resume/parse` | multipart `resume` → svc `/extract` first, then store the draft → `{ profile, warnings, fileName, yearsExperience }` (`profile.email` = account email). 400 not a PDF / > 10 MB / unreadable (svc message), 503 svc down; 20 req/min per IP (FR-PROF-01..03). *(Phase 4, decision 16: with a confirmed profile the draft is a replacement and the response is `{ warnings, fileName, yearsExperience }` (no profile, no auto-fill); the 409 "already set up" is gone)* |
| POST | `/api/applicant/resume/replace` | (Phase 4, decision 16, FR-PROF-06/07, BR-13) no body: the parsed draft becomes the current resume → `200` the current-resume view (`verificationStatus: "pending"`). 409 no profile · 422 "Upload your new resume first." (no draft) · 409 "Answer your pending job offer or invitation first." (checked before and again under the applicant lock). File moved `drafts/…` → `<applicantId>/…` before the transaction (moved back on failure); one transaction: lock applicant → old current resume `is_current = false, archived_at = now()` (file kept) → new `resume` (pending) + `resume_extraction` → draft deleted. Profile and existing applications unchanged (they keep `application.resume_id`) |
| POST | `/api/applicant/profile/confirm` | profile fields → file moved `drafts/…` → `<applicantId>/…`, then applicant + resume + resume_extraction in one transaction and the draft deleted → `201 { applicantId }`. 422 no draft, 409 already set up (FR-PROF-04; replacement FR-PROF-06 deferred) |
| GET / PATCH | `/api/applicant/profile` | view / edit profile (FR-PROF-05). PATCH takes the full card (same schema as confirm); email is never changed. 404 before confirm |
| GET | `/api/applicant/resume` · `/api/applicant/resume/url` | current resume `{ resumeId, fileName, fileSizeBytes, uploadedAt, verificationStatus, verificationRemarks }` · `{ url }` signed 10 min. Always the **current** resume (My Documents); HR reads the application's resume instead (decision 16) |
| GET / POST | `/api/applicant/documents` | list current / upload (multipart `file`, `documentType` ∈ certificate, diploma, other (decision 29; any other type → 400), `label`, `replacesDocumentId?`); one current per type except certificate/other, i.e. one Diploma (FR-DOC-01..04). *Oct 19 (decision 28):* the upload transaction takes the applicant lock (DATABASE_SCHEMA §8), retires the replaced row, inserts the new one, fulfils requests, and last deletes the replaced row when it is pending and no FK references it (`application_document`, `document_request.target_document_id` / `fulfilled_document_id`); that file is removed from the `documents` bucket after the commit (a failure is logged with ids only, the upload still succeeds) |
| GET | `/api/applicant/documents/:id/url` | signed URL |
| GET | `/api/applicant/document-requests` | (S12) pending first, then history: `{ requestId, documentType, reason, status, dueAt, requestedAt, fulfilledAt, targetDocumentId, jobTitle }`; never company. Uploading the requested type (`POST /api/applicant/documents`) fulfils it and alerts HR |
| GET | `/api/applicant/vacancies` · `/:id` | open vacancies, agency-branded: list `?search=` (title) → `{ vacancyId, jobTitle, summary, deploymentLocation, employmentType, postedAt }`; detail adds `jobDescription, keyResponsibilities, requiredSkills, experienceRequirement, minEducationLevel, minHeightCm` (no minimum years, decision 11). Never company fields, never age range or gender (RA 10911, UI_GUIDELINES §9); not open → 404. Vacancies of a company where this applicant has a failed application from the last year (decision 5) are left out of the list, and their detail is the same 404 "This job is no longer open." (BR-19) |
| POST | `/api/applicant/applications` | `{ vacancyId, applicantType, attachDocumentIds? }` (decision 16: ≤ 20 unique uuids, default `[]`; under the applicant lock each must be a current supporting document of this applicant, else 422 "Choose from your current documents."; the links go to `application_document` for every outcome) → eligibility (BR-17 one ongoing-or-hired application, BR-19 failed company) → prescreen (RANK-01) → svc `/match` with the stored `resume_extraction.sections` and `resolveMatchingWeights(applicantType, vacancy)` (BR-04: skills only when the vacancy has no experience criterion; the weights used are stored in `matching_result.weights`) (before the transaction) → threshold on the rounded score (RANK-02) → one transaction under the applicant and vacancy row locks (eligibility re-checked): application + `matching_result` + notification, shortlist refresh, auto-close when qualified applications reach the cap → `201 { applicationId, status, message, failedConditions? }` (no score, no company). 400 validation · 404 not open · 404 "This job is not available for your application." (failed company; no company, no reason) · 409 "You already have an ongoing application. You can apply to another job once it is finished." (also when the index `application_one_ongoing_per_applicant` catches simultaneous applies) · 409 "You are already hired through Confiable Manpower, so you cannot apply to another job." · 409 no profile / no readable resume ("…Please replace your resume in My Documents, then apply again.") / already applied / "Applications for this job just closed." (cap filled or vacancy closed while matching ran) · 503 svc down; 20 req/min per IP (FR-APP-01..09) |
| GET | `/api/applicant/applications` | status panel → `[{ applicationId, vacancyId, jobTitle, applicantType, status, appliedAt, statusChangedAt, nextDueAt }]` (`nextDueAt` = the earliest pending document request's deadline; decision 37: no interview or endorsement confirmation deadline, no `actionDueAt`, no `confirmMessage`); never company, `status_reason`, or scores |
| GET | `/api/applicant/interviews` | (S13; decision 37) own interviews sorted by time → agency rows `{ kind: "agency", interviewId, applicationId, jobTitle, status, scheduledAt, durationMinutes, interviewerName, meetingLink, requestsLeft }` (`meetingLink` for a set attempt, i.e. `confirmed`: right after scheduling) and final-interview rows `{ kind: "final", applicationId, jobTitle, scheduledAt, details }` from `endorsement_item.client_interview_at` / `final_interview_details` while the application is `final_interview_scheduled` and the outcome `pending`. Never company, scores, `status_reason`, or a confirmation deadline. *(Phase 4: also an attempt whose reschedule request waits (`reschedule_requested`); `requestsLeft` = min(`max_reschedules`, 2) − requests used)* |
| ~~POST~~ | ~~`/api/applicant/interviews/:id/confirm`~~ | **Removed (decision 37, Oct 24):** the applicant never confirms; the route answers 404. (Was: attempt `pending_confirmation` → `confirmed`, application → `interview_confirmed`, staff notified `hr_interview_confirmed`.) |
| POST | `/api/applicant/interviews/:id/reschedule-request` | (Phase 4, decision 20, FR-INT-03) `{ reason: 5–500 }` → `{ interviewId, status: "reschedule_requested", requestsLeft }`. Attempt `pending_confirmation \| confirmed → reschedule_requested` (compare-and-set) with `reschedule_reason`; `application.reschedule_requests + 1`; application status unchanged; staff notified (`hr_reschedule_requested`). 404 not their interview · 409 not open / already waiting ("Your reschedule request is waiting for the agency.") / the interview time has passed · 422 "You have used both reschedule requests. Please contact Confiable Manpower." (approved and declined requests count). Locks job_vacancy → application |
| ~~POST~~ | ~~`/api/applicant/applications/:id/endorsement/confirm` · `/decline`~~ | **Removed (decision 37B, Oct 24):** the applicant never confirms or declines the endorsement; both routes answer 404. (Was: `passed_awaiting_confirmation → for_endorsement \| archived`, staff notified `hr_endorsement_confirmed` / `_declined`.) |
| GET | `/api/applicant/offers` | (S17, BR-23) the applicant's pending rematch offers → `[{ offerId, jobTitle, deploymentLocation, employmentType, dueAt, offeredAt }]`; never company fields or scores. *(Phase 3: also pending job invitations; every row has `kind` = `rematch_offer` \| `job_invitation`)* |
| POST | `/api/applicant/offers/:id/accept` · `/decline` | (S17, BR-23) no body. Someone else's or unknown offer → 404; answered → 409. Locks job_vacancy → applicant. **Accept** re-checks (offer pending, pool entry active, vacancy open, endorsement not full, BR-17, BR-19, never applied, prescreen, threshold, final ≥ current passing) → `200 { offerId, status: "accepted", applicationId, applicationStatus: "for_endorsement" }`: application (source `rematch`, `assertInitial(for_endorsement, rematch)`, applicant = actor) + `matching_result` from the offer + `final_evaluation` (ratings source from the offer, `computed_by` null, stored vs JS FIN-01) + offer `accepted` + pool entry closed (`reapplied`) + `hr_rematch_accepted`. A failed re-check → offer `expired` + `rematch_offer_expired` **committed**, then 409 "This job is no longer available. You can apply to other jobs."; no automatic rescan. **Decline** → `200 { offerId, status: "declined" }`, pool availability `available`, `hr_rematch_declined`. 23505 → 409 only for `application_one_ongoing_per_applicant`, `application_applicant_id_job_vacancy_id_key`, `final_evaluation_application_id_key`. **Phase 3, job invitations** (same endpoints; `answerOffer` hands a `job_invitation` row to `invitations.service.answerInvitation`): **Accept** re-checks (pending, pool entry active, vacancy open, qualified applications < cap, BR-17, BR-19, never applied, prescreen, stored matching ≥ current threshold) → `200 { offerId, status: "accepted", applicationId, applicationStatus: waiting_pool \| shortlisted, message }`: application (source `talent_pool`, the invitation's applicant type, current resume) + `matching_result` from the invitation (no svc call) + shortlist refresh + cap close-out as in apply + pool entry closed (`reapplied`) + `hr_invitation_accepted`. A failed re-check → invitation `expired`, availability `available`, `job_invitation_expired` **committed**, then 409 "This job is no longer available. You can apply to other jobs." An expired invitation answered later → 409 "This job is no longer available." **Decline** → `declined`, availability `available`, `hr_invitation_declined` |

### 6.3 Admin / HR (`requireRole('admin','hr')`; **A** = admin only)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/dashboard` | (S18, FR-ADM-01) `{ tiles: [{ key, label, counts, value, statuses? \| blockingStatuses? \| vacancyStatuses? }], upcomingInterviews: [{ interviewId, applicationId, status, scheduledAt, durationMinutes, applicantName, vacancyId, jobTitle, companyName, interviewerName }] }`. The 8 tiles come in `DASHBOARD_TILE_ORDER`, and each carries its own status set from `@vera/shared` `DASHBOARD_TILES`. All counts come from ONE statement (one snapshot; DATABASE_SCHEMA §6.5). Upcoming = open attempts (`pending_confirmation` / `confirmed`) whose application is `interview_scheduled` / `interview_confirmed`, `scheduled_at >= now()`, ordered by time then id, limit 10. Read-only |
| GET / POST | `/api/admin/companies` | list `?search=&page=&pageSize=` (name contains, case-insensitive; ≤ 100 per page) → `{ data: [{ companyId, companyName, industry, contactPersonName, contactEmail, vacancyCount }], meta }` / create (`website` normalized to https://) |
| GET / PATCH | `/api/admin/companies/:id` | detail + `counts: { vacancies, openVacancies, inAgencyInterview, awaitingClient, hired, endorsed }` (PRD FR-COMP-03) / edit. Duplicate name (case-insensitive) → `409 CONFLICT` with `details: [{ path: "companyName" }]` |
| GET | `/api/admin/competencies` | fixed list (active, by `sort_order`) |
| POST / PATCH | `/api/admin/competencies[/:id]` | **A** manage list |
| GET | `/api/admin/vacancies/defaults` | `{ matchingThreshold, capMultiplier }` from `system_setting` (form defaults) |
| GET / POST | `/api/admin/vacancies` | list `?search=` (title or company) `&status=&page=&pageSize=` → cards with `remainingSlots`, `counts { total, screening, interview, passed, hired }` / create draft + competency weights in one transaction (weights total 0 or 100) |
| GET / PATCH | `/api/admin/vacancies/:id` | detail (+ `competencies`, `weightTotal`, `applicationCount`, `editable`) / edit: draft = full form; open/closed/endorsing = posting text + higher cap only (other fields → 422 "Locked after publishing"); filled/archived → 409 |
| POST | `/api/admin/vacancies/:id/{publish,close,reopen,archive}` | status actions under a vacancy row lock (`domain/vacancyStatus.js`); publish needs weights = 100 (422); reopen `{ applicationCap? }` needs applications < cap (422); illegal transition → 409. **Archive** (S15, BR-22): refused (409) while any application is `endorsed`; otherwise closes out the vacancy in the same transaction (`domain/closeOut.js`) and the response adds `closeOut: { notSelected, standby }` counts. Close never closes out |
| GET | `/api/admin/vacancies/:id/ranking` | (S15, FR-END-01, RANK-03) `{ vacancy: { vacancyId, jobTitle, companyName, status, slotsNeeded, endorsementCount, committed, notifyRemaining, canNotify }, ranking: [{ rank, applicationId, applicantName, applicantType, status, appliedAt, actionDueAt, matchingScore, interviewScore, finalScore, passingScore, passed, overallRating, reused }] }`: every evaluated application of the vacancy, any status, both groups; `notifyRemaining` = endorsement count − (passed_awaiting_confirmation + for_endorsement + endorsed); `canNotify` = open, closed, or endorsing. 404 |
| ~~GET~~ | ~~`/api/admin/vacancies/:id/talent-pool-matches`~~ | *(replaced in Phase 3 by pool matching on publish, below)* |
| GET | `/api/admin/vacancies/:id/invitations` | (Phase 3, decision 17d) `{ running, poolMatchedAt, summary: { invited, skipped, failed, finishedAt } \| null, invitations: [{ invitationId, applicantName, status, matchingScore, invitedAt, dueAt, respondedAt, applicationId }] }` (this vacancy's job invitations, newest first). 404 |
| POST | `/api/admin/vacancies/:id/pool-matching` | (Phase 3) **Run pool matching again**, no body → `202 { status: "started" }`; the run happens in the background. 404 · 409 "Pool matching runs only for an open job." · 409 "Pool matching is already running for this job." (in-memory flag per vacancy, single API process). **Publish** (`POST …/publish`) starts the same run after its commit and adds `poolMatching: "started"` to its response; it never waits for svc. Run: `listPoolCandidates` (free entries, no pending row of either kind, never invited to or applied at this vacancy, BR-19 1-year company block) → per entry RANK-01 prescreen (fail → skipped, no svc) → svc `/match` with the source type's weights and a **15 s** timeout (error → failed) → RANK-05 threshold (below → skipped) → one transaction per invite (locks job_vacancy, stops if no longer open → applicant; re-check; `pool_invitation` kind `job_invitation`, `due_at` = now + `response_deadline_days`, stored matching; availability `invited`; `job_invitation` notice; 23505 → skipped) → summary on the vacancy + `hr_pool_matching_finished`. Leaving `open` (close, cap close, endorsing, filled, archive) expires the vacancy's pending job invitations in the same transaction (`domain/invitationExpiry.js`; rematch offers unaffected) |
| POST | `/api/admin/vacancies/:id/notify` | (S15, FR-END-03; decision 32) `{ applicationIds: uuid[] (1–50, unique), message? (10–1000; default from @vera/shared notifyMessageDefault), finalInterviewAt (ISO with offset, required, any time: no clock check), finalInterviewDetails (1–500 after trim, required) }` → `{ notified[], status: "for_endorsement", remaining }` (decision 37B); each → **`for_endorsement`** at once (HR = actor, reason "Notified for endorsement"; no `action_due_at`); notification `endorsement_notice` (information only, nothing to answer): fixed title "Selected for endorsement: {job}", HR's body + "Final interview: {date and time} (Philippine time). {details, whitespace runs folded}" (`finalInterviewLine` in `domain/notify.js`), nothing after it. Nothing else is stored. 400 validation · 404 vacancy or an application not in it · 409 vacancy not open/closed/endorsing or an application not `passed` · 422 more than the places left, or a message or final interview details naming the company (`details[0].path` = `message` / `finalInterviewDetails`). Locks job_vacancy → applications (ascending id). ***Decision 39-3 (Oct 25): Notify = the endorsement.*** *Selectable: `passed` and `for_endorsement` (accepted rematch offers, older rows; they already hold a place, so only passed rows count against the places left, checked after the lock). One transaction: one `endorsement` (sent, by HR) + one `endorsement_item` per applicant (RANK-03 rank, stored final, `client_interview_at`, `final_interview_details`), each → `endorsed` ("Endorsed to the client") → `final_interview_scheduled` ("Final interview scheduled"), ONE `endorsement_notice` each, vacancy → `endorsing` (open → its pending job invitations expire). → `200 { endorsementId, sentAt, notified, status: "final_interview_scheduled", vacancyStatus, remaining }`. 409 also for an application that is not passed / for_endorsement* |
| GET | `/api/admin/applications/:id` | full detail: profile, resume, docs, matching details, ratings, final, history; `reusableEvaluation: { sourceApplicationId, jobTitle, companyName, ratedAt } \| null` (S12, BR-21; chain-safe WSM-03 lookup: the original interview), plus `fullyVerified`, `nextStep: schedule_interview\|reuse_ratings\|null`, documents with `newUpload` and (decision 16) `attachedWhenApplying`; `resume` = **the application's own resume** (`application.resume_id`, current or archived; decision 16); (S14) `evaluation: { interviewScore, finalScore, passed, overallRating, reused } \| null` |
| GET | `/api/admin/screening` | vacancies with shortlisted counts |
| GET | `/api/admin/screening/:vacancyId` | (S12) both groups in one response: `{ vacancy, groups: { experienced, first_time }: { quota, shortlisted[], waitingPool[] }, notShortlisted: { prescreenFailed[], belowThreshold[] } }`; rows carry `locked`, `matchingScore`, `documentsVerified/Total`, `newUploads`, `pendingRequests`, `fullyVerified`, `ratingsOnFile`; HR only (company and scores shown) |
| POST | `/api/admin/screening/:vacancyId/pull-next` | `{ group }` (open decision D1) |
| PATCH | `/api/admin/resumes/:id/verification` · `/api/admin/documents/:id/verification` | (S12) `{ status: verified\|rejected, remarks? (required to reject), applicationId }`; the application must be shortlisted (409) and the file current and the applicant's (422); the first action sets `verification_started_at`. *(Decision 16: a resume must be the application's own `resume_id` (current or archived), else 422 "This is not the resume sent with this application. Refresh the page."; documents stay current-only)* |
| GET | `/api/admin/applications/:id/resume/url` · `/documents/:documentId/url` | (S12) signed URL (10 min): the application's own resume (decision 16) · the applicant's current document |
| POST | `/api/admin/applications/:id/drop` | (S12) `{ reason: failed_verification\|no_response\|other, remarks? }` → `dropped` (HR actor), pending requests cancelled, applicant notified (no company, no reason), shortlist refreshed → `{ applicationId, status, promoted[] }`; 409 when not shortlisted |
| POST / DELETE | `/api/admin/document-requests[/:id]` | create `{ applicationId, documentType (certificate, diploma, or other only, decision 29; resume and the older types refused with 400), targetDocumentId?, reason }` → due = now + `response_deadline_days`, target copy `reupload_requested`, applicant notified (requires action) / cancel a pending request (404 otherwise) |
| GET | `/api/admin/interviewers` | (S13) active HR + admin `[{ userId, fullName, role }]` for the interviewer select |
| GET | `/api/admin/interviews?vacancyId=` | (S13) open attempts (`pending_confirmation` / `confirmed`), both groups, optional vacancy filter → `[{ interviewId, applicationId, status, attemptNumber, scheduledAt, durationMinutes, meetingLink, confirmDueAt, confirmedAt, interviewerId, interviewerName, applicationStatus, applicantType, applicantName, matchingScore, vacancyId, jobTitle, companyName }]` |
| POST | `/api/admin/interviews` | (S13) schedule `{ applicationId, scheduledAt (ISO with offset, future), durationMinutes (15–240, default 30), meetingLink (https), interviewerId (active HR/admin) }` → `201` attempt 1 set at once (decision 37: status `confirmed`, `confirmed_at` null), application `shortlisted → interview_confirmed` (HR = actor, reason "Interview scheduled"), applicant notified only (`interview_scheduled`, no link, no company, nothing to answer); `confirm_due_at` (NOT NULL) = scheduledAt, no confirmation deadline. 400 validation · 404 · 409 not shortlisted / already has an interview (index `interview_one_open_per_application`) · 422 not fully verified / ratings on file (BR-21) / interviewer not active. Locks job_vacancy → application |
| PATCH | `/api/admin/interviews/:id` | (S13) edit the open attempt in place (same fields minus `applicationId`; `attempt_number` unchanged; also after the interview time has passed, decision 37): the status stays; `confirm_due_at` = the new time; applicant notified (`interview_rescheduled`, nothing to answer); never counts as a reschedule request. 409 once the attempt is no longer open. Locks job_vacancy → application |
| POST | `/api/admin/interviews/:id/reschedule/approve` | (Phase 4) same body as Edit time → `{ interviewId (new), status: "confirmed", attemptNumber, scheduledAt, confirmDueAt, applicationId, applicationStatus: "interview_confirmed" }` (decision 37): the waiting attempt → `rescheduled`; a new attempt `attempt_number + 1`, set at once (`confirmed`, `confirm_due_at` = the new time); the application stays `interview_confirmed` (an old `interview_scheduled` row moves to `interview_confirmed` through `transition()`, reason "Reschedule approved"; answer 12 superseded); applicant notified of the new time (`interview_rescheduled`, nothing to answer). 409 no request waiting / 23505 on `interview_one_open_per_application` · 422 inactive interviewer · 400 past time. Locks job_vacancy → application |
| POST | `/api/admin/interviews/:id/reschedule/decline` | (Phase 4) no body → `{ interviewId, status, applicationStatus }`: the attempt goes back to `pending_confirmation` (application `interview_scheduled`) or `confirmed` (`interview_confirmed`); the request still counts; applicant notified (`reschedule_declined`, the original time stays, nothing to answer; decision 37). 409 no request waiting. While a request waits, Edit time and Mark no-show answer 409 "Answer the reschedule request first." Locks job_vacancy → application |
| POST | `/api/admin/interviews/:id/no-show` | (S13, FR-INT-05 simplified) through the S12 drop service (`dropApplication` with an interview check under its locks): unconfirmed after the deadline or interview time → attempt `expired`, reason `no_response`; confirmed after the interview time → attempt `no_show`, reason `other` + "No-show"; application `dropped` (HR = actor), applicant notified (neutral), shortlist refilled (system) → `{ interviewId, interviewStatus, applicationId, status, promoted[] }`. 409 too early or no longer open (a confirm that won the lock). Locks job_vacancy → applicant → application |
| POST | `/api/admin/interviews/:id/reschedule` | new attempt after an applicant's reschedule request *(deferred with FR-INT-03, ROADMAP §6)* |
| GET | `/api/admin/applications/:id/evaluation` | (S14) evaluation page → `{ application: { applicationId, status, applicantType, applicantName, matchingScore, passingScore }, vacancy: { vacancyId, jobTitle, companyName }, sections: [{ sectionCode, sectionName, weight, items: [{ competencyId, competencyName }] }], interview: { interviewId, status, scheduledAt, started } \| null, evaluation: { ratings[], sectionScores, interviewScore, overallRating, matchingScore, finalScore, passingScore, passed, computedAt, reused, source: { applicationId, jobTitle, companyName, ratedAt } \| null } \| null, canEvaluate, blockedReason }`; a reused evaluation returns the original interview's ratings (read-only). HR only; 404 |
| POST | `/api/admin/applications/:id/evaluation` | (S14, FR-INT-06) `{ ratings: [{ competencyId, rating 1–5 }] }`, exactly the 15 active items (other body fields ignored; the server recomputes) → `201 { applicationId, status, sectionScores, interviewScore, overallRating, matchingScore, finalScore, passingScore, passed, ratingsSourceApplicationId, reused: false, interviewId, interviewStatus: "completed" }`; stores 15 `competency_rating` rows + `final_evaluation`, attempt → `completed`, `interview_confirmed → passed / did_not_pass` (HR = actor); `did_not_pass` → applicant pool + `evaluation_did_not_pass` notice. 400 validation (missing/duplicate item, rating outside 1–5) · 404 · 409 not `interview_confirmed` / attempt not confirmed / "The interview has not started yet." (`scheduled_at <= now()` in SQL) / already evaluated (incl. 23505 on `final_evaluation_application_id_key` or `competency_rating_application_id_competency_id_key`) · 422 not the 15 active items. Locks job_vacancy → applicant → application |
| POST | `/api/admin/applications/:id/evaluation/reuse` | (S14, FR-INT-08, BR-21) no body: shortlisted + fully verified → the original interview's 15 ratings × this vacancy's section weights (WSM-03) → `201` same shape with `reused: true` and `ratingsSourceApplicationId` = the original interview (chain-safe); no rating rows, no attempt; `shortlisted → passed / did_not_pass`, same pool entry and notice. 404 · 409 not shortlisted / already evaluated · 422 no earlier evaluation, not fully verified, or the source lacks a rating. Locks job_vacancy → applicant → application |
| GET | `/api/admin/endorsements` | (S16) vacancies that reached endorsement (someone for_endorsement, endorsed, or hired, or the vacancy endorsing/filled) → `[{ vacancyId, jobTitle, companyName, status, slotsNeeded, endorsementCount, forEndorsement, endorsed, hired }]`. *Decision 39-3: listed when someone is with the client or hired (or the vacancy is endorsing / filled); no `forEndorsement` field* |
| GET | `/api/admin/endorsements/:vacancyId` | (S16) `{ vacancy: { …, hiredCount, passedCount }, candidates: [for_endorsement rows in RANK-03 order with rank and scores], endorsements: [{ endorsementId, sentAt, items: [{ itemId, applicationId, applicantName, applicantType, status, rank, finalScore, outcome, clientInterviewAt, outcomeRemarks, outcomeRecordedAt, rematchStatus, rematchJobTitle, rematchCompanyName }] }] }` (S17: the latest rematch offer made from the item's pool entry, or nulls). *Decision 37C, Oct 24: items whose application is `not_hired` or `training_failed` are left out (the history stays in the database); a batch with no item left is still listed with `items: []` (Printable page). The rematch fields are therefore null on every listed item; the latest offer shows on the Applicant Pool row.* *Decision 39-3: `{ vacancy, endorsements }` only (no `candidates`); removed (archived) items are left out too.* 404 |
| GET | `/api/admin/endorsements/print/:endorsementId` | (S16) printable endorsement (HR document for the client): `{ endorsementId, sentAt, sentBy, vacancy, company: { companyName, contactPersonName, contactEmail }, candidates: [{ rank, fullName, email, contactNumber, age, gender, educationLevel, address, applicantType, matchedSkills, matchingScore, interviewScore, finalScore, overallRating, outcome }] }`. 404 |
| ~~POST~~ | ~~`/api/admin/endorsements`~~ | ***Removed by decision 39-3 (Oct 25): 404; Notify creates each batch.*** *Before:* (S16, FR-END-05/06; decision 32) `{ vacancyId, finalInterviewAt (ISO with offset, required, no clock check), finalInterviewDetails (1–500, required), acknowledgeChange? (boolean, default false) }` → `201 { endorsementId, sentAt, endorsed[], standby[], vacancyStatus: "endorsing", finalInterviewAt, timeChanged[], firstNotice[] }`: every `for_endorsement` application gets an item (RANK-03 rank, stored final, outcome pending, `client_interview_at`, `final_interview_details` as typed) → `endorsed` (HR, reason "Endorsed to the client", "Sent to the employer" notice) → `final_interview_scheduled` (HR, reason "Final interview scheduled"; same transaction, same `changed_at`, next `history_id`); schedule notice from the applicant's latest Notify message (`scheduleNoticeFor`; decision 37B: `endorsement_notice`, matched by its final line, or an old `passed_confirm_endorsement`): exactly this final interview → none; another one → `final_interview_rescheduled` (listed in `timeChanged`); none → `final_interview_scheduled` (listed in `firstNotice`, e.g. an accepted rematch). Remaining `passed` → `standby` + pool (system, reason "endorsement created: not included"); vacancy → `endorsing`; endorsement status `sent` (no email/PDF/XLSX: printable page). 400 validation · 404 · **409 `FINAL_INTERVIEW_CHANGED`** `details: [{ applicationId }]` when someone's message announced another final interview and `acknowledgeChange` is not true (nothing written) · 409 vacancy draft/filled/archived, a race, or 23505 on `endorsement_item_application_id_key` · 422 nobody for_endorsement ("Nobody to endorse yet: notify passed applicants first."), or details naming the company (checked before the transaction). Locks job_vacancy → applicants → applications (ascending) |
| POST | `/api/admin/endorsement-items/:id/remove` | (decision 39-3) `{ reason: 5–500 after trim }` → `{ itemId, applicationId, status: "archived" }`: only at the final interview, `final_interview_scheduled → archived` (HR = actor, reason in the status history only); the item keeps outcome `pending` with `outcome_remarks` "Removed from endorsement"; neutral (no pool entry, no company block, no rematch); notice `endorsement_removed` "Application closed: {job}"; the row leaves Outcomes; the place counts again for Notify. 400 validation · 403 applicants · 404 unknown item · 409 any other status or an outcome already recorded. Locks job_vacancy → applicant → application |
| ~~POST~~ | ~~`/api/admin/applications/:id/remove-from-endorsement`~~ | ***Removed by decision 39-3 (Oct 25): 404 (replaced by the item route above).*** *Before:* (decision 37Bt` | (decision 37B) `{ reason: 5–500 after trim }` → `{ applicationId, status: "archived" }`: `for_endorsement → archived` (HR = actor, status reason "Removed from endorsement: {reason}", HR only); neutral: no pool entry, no company block; applicant notified `endorsement_removed` ("Application closed: {job}", never the reason or the company); the place counts again for Notify. 400 validation · 403 applicants · 404 · 409 any other status. Locks job_vacancy → application |
| ~~POST~~ | ~~`/api/admin/endorsements/:id/send`~~ · ~~`/:id/files`~~ | *(deferred: no email, PDF, or XLSX during the sprint, ROADMAP §6; the printable page replaces them)* |
| POST | `/api/admin/endorsement-items/:id/final-interview` | (Phase 2, decision 14) `{ scheduledAt (ISO with offset, any time: no clock check), details? (≤ 500) }` → `{ itemId, applicationId, status: "final_interview_scheduled", finalInterviewAt, rescheduled }`. endorsed → `final_interview_scheduled` (HR, "Final interview scheduled") + `final_interview_scheduled` notice; already scheduled → time/details updated, no move, `final_interview_rescheduled` notice. Stores `endorsement_item.client_interview_at` and `final_interview_details`. 422 details naming the company (Notify's rule); 409 any other status or a recorded outcome; 404. Locks job_vacancy → applicant → application |
| POST | `/api/admin/endorsement-items/:id/advance` | (Decision 37C, Oct 24; replaces `/for-hiring`, removed → 404) `{ to: for_training \| for_requirements \| for_orientation }` (zod; anything else 400 "Choose the next stage.") → `{ itemId, applicationId, status }`. One stage forward only (`NEXT_CLIENT_STAGE`): `final_interview_scheduled → for_training` (HR, "Proceeds after the final interview"), `for_training → for_requirements` ("Training passed"), `for_requirements → for_orientation` ("Requirements completed"), each with its notice; a skipped or backward move, a wrong status or a recorded outcome → 409 "This applicant is not at the step before that stage. Refresh the page.". 404 unknown item; applicant 403. Locks job_vacancy → applicant → application |
| GET | `/api/admin/applications/:id/packet` | (Phase 2, decision 21; *decision 33, Oct 20: by application id from the Ranking tab, replaces `/endorsement-items/:id/packet`, which is removed*) Allowed only when the application has a `final_evaluation` with `passed = true` (final ≥ passing) and its status is in `PACKET_STATUSES` (`@vera/shared`: passed, passed_awaiting_confirmation, for_endorsement, endorsed, final_interview_scheduled, for_hiring, for_training, for_requirements, for_orientation (decision 37C), hired, not_hired); otherwise 409 ("This applicant has no evaluation for a packet." / "Only an applicant who passed the assessment can get an endorsement packet."). Same content and sources as before (own interview score, ratings source, `application.resume_id`) → `application/pdf` attachment `<LastName>_<FirstName>_<JobTitle>_Endorsement.pdf`, `Cache-Control: no-store`, `Access-Control-Expose-Headers: Content-Disposition`. One merged PDF (pdf-lib): cover (agency, name, position, agency interview date, 15 source ratings under the section headings, own interview score; *Oct 19, decision 25:* no section scores, section weights, formula, rating legend, or footer; no matching, final, rank, company) + the application's own resume. Built on request, never stored. 400 bad id; 404 unknown application; 409 no evaluation, not passed / status outside the list, no resume file, or an unreadable resume PDF; applicant 403 |
| PATCH | `/api/admin/endorsement-items/:id/outcome` | (S16, FR-END-07/09; *decision 37C, Oct 24: `hired` (Deployed) only from `for_orientation` or an old `for_hiring` row, else 409 "Move the applicant through training, requirements and orientation first."; `not_hired` also from for_training / for_requirements / for_orientation with reason "Client decision: not hired during training" / "… at the requirements step" / "… at orientation"*; Phase 2: `not_hired` from endorsed / final_interview_scheduled / for_hiring with reason "Client declined before the final interview" / "Did not proceed after the final interview" / "Client decision: not hired"; `clientInterviewAt` removed, ignored if sent) `{ outcome: hired \| not_hired, remarks? (≤ 500) }` → `{ itemId, applicationId, outcome, status, vacancyStatus, closeOut: { notSelected, standby } \| null }`. hired → `hired` (HR); not_hired → `not_hired` (HR) + pool `not_hired`; the hire that makes the vacancy's hired count = `slots_needed` sets the vacancy `filled` and runs `closeOutVacancy(…, "filled")` in the same transaction (endorsed still pending → standby, item remarks "vacancy filled"). 400 · 404 · 409 second decision or the application moved. Locks job_vacancy → this applicant + every close-out applicant (one statement, ascending) → the application. **S17:** after a not_hired commit the automatic rematch runs outside the transaction and the response adds `rematch: { status: "offered", offerId, jobTitle, companyName } \| { status: "no_match" } \| { status: "failed" }` (failed = any error, logged with ids only; the not_hired stays committed). The hired response has no `rematch` field |
| POST | `/api/admin/endorsement-items/:id/training-failed` | (S16, FR-END-08, TC-82; *decision 37C, Oct 24: by endorsement item and only at For training; replaces `/applications/:id/training-failed`, removed → 404*) no body → `{ itemId, applicationId, status: "training_failed" }`. `for_training → training_failed` (HR, "Training failed"), item outcome `not_hired` with remarks "Training failed" (recorded by HR), pool `training_failed`, notice `training_failed`; no rematch. 404 unknown item · 409 not at For training (hired included: Deployed is final) or outcome recorded. Locks job_vacancy → applicant → application |
| ~~PUT~~ | ~~`/api/admin/applications/:id/post-hiring`~~ · ~~`.../post-hiring/send`~~ | *(cut, decided Oct 10: ROADMAP cut #2)* |
| GET | `/api/admin/pool` | (S17, FR-POOL-01 minimal) active pool entries of applicants with no ongoing or hired application → `[{ talentPoolId, poolReason, availability, addedAt, sourceApplicationId, applicantName, sourceJobTitle, sourceCompanyName, offerStatus, offerKind, offerJobTitle, offerCompanyName, offeredAt }]` (latest offer or invitation, or nulls). *(Phase 3, decision 18: optional `?tab=waiting \| client` filters by `POOL_TABS` reasons; unknown tab → 400; no tab = all)* *(Decision 37D: optional `?q=` (trimmed, ≤ 100, blank = no filter) matches the name or email, case-insensitive, `%` `_` `\` escaped like Applicant Management; each row adds `userId`, `email`, `accountStatus`, `deactivationReason` (HR's reason, only while inactive). Inactive entries (availability `unavailable`) are listed on both tabs like any other; staff only.)* *(Decision 39-4: `deactivationReason` is read from `user_account.deactivation_reason`, no longer `talent_pool.remarks`; the pool shows it read-only.)* |
| ~~PATCH~~ | ~~`/api/admin/pool/:talentPoolId/account`~~ | ***Removed by decision 39-4 (Oct 25): 404; replaced by `PATCH /api/admin/applicants/:applicantId/account`.** Before:* (decision 37D; HR and admin) `{ accountStatus: "active" \| "inactive", reason? }` (reason 5–500 required for inactive) → deactivate `{ talentPoolId, accountStatus: "inactive", expiredOffers, signInBlocked }`: one transaction under the applicant lock: the entry still active and the applicant free (else 409), the entry's pending job offer or invitation → `expired` (no notice), availability `unavailable`, `remarks` = reason, `user_account.account_status = inactive`; then the Supabase ban (`lib/signIn.js`; a failure → `signInBlocked: false`, logged with ids). Activate `{ talentPoolId, accountStatus: "active", signInBlocked: false }`: unban first (502 "Could not unblock sign-in. Try again." changes nothing), then availability `available`, remarks null, account active. 400 validation · 403 applicants · 404 unknown or closed entry · 409 entry replaced / ongoing or hired application. Pool matching (`listPoolCandidates`, the invite re-check) and the rematch skip an inactive account |
| ~~GET~~ | ~~`/api/admin/talent-pool`~~ · ~~POST `/api/admin/talent-pool/:id/invite`~~ · ~~PATCH `/api/admin/talent-pool/:id`~~ | *(replaced by `GET /api/admin/pool` in S17; invitations and availability edits deferred, ROADMAP §6)* |
| ~~POST~~ | ~~`/api/admin/applications/:id/rematch`~~ | ***Removed by decision 39-2 (Oct 25): 404.** The same scan runs only from the not_hired hook (`runRematchAfterNotHired`). Before:* (S17, BR-23) **Run rematch again** for a not_hired application, no body (*decision 37C: started from the Applicant Pool → Returned by Client row with the entry's `sourceApplicationId`*). 404 · 409 not not_hired, its pool entry no longer active, applicant not free (BR-17), or an offer already pending (all before any svc call). Scan (prescreen, svc /match per vacancy with no transaction, RANK-02, WSM-01/03, FIN-01, RANK-04) → `200 { status: "offered", offerId, vacancyId, jobTitle, companyName, matchingScore, interviewScore, finalScore, dueAt } \| { status: "no_match" }`; the offer is one transaction under the applicant lock (`pool_invitation` pending, `invited_by` null, `due_at` = now + `response_deadline_days`; availability `invited`; `rematch_offer` + `hr_rematch_offered`). svc down → 503. 23505 → 409 only for `pool_invitation_one_pending`, `pool_invitation_talent_pool_id_job_vacancy_id_key`. Same function as the not_hired hook |
| ~~GET / POST~~ | ~~`/api/admin/rematch…`~~ (suggestions, offer/skip, rescan) | *(replaced in S17 by the automatic offer and Run rematch again, PRD BR-23 sprint note)* |
| GET | `/api/admin/applicants` | (S18, FR-ADM-02) `?search=` (trimmed, ≤ 100; name or email contains, case-insensitive; `%` `_` `\` escaped) `&status=` (a key of `APPLICANT_FILTERS`; unknown → 400) `&page=` (≥ 1) `&pageSize=` (default 20, values above 50 clamped to 50, not refused) → `{ data: [{ applicantId, applicantName, email, applicationId, status, jobTitle, companyName, lastUpdate }], meta: { page, pageSize, total } }`. Current application = the ongoing or hired one, else the latest by `updated_at` (nulls when the applicant never applied). `applicantPool` filters with the same condition as `GET /api/admin/pool`. Order: last update desc, applicant id. Staff only (company shown). *(Decision 39-4: each row adds `accountStatus` and `deactivationReason` (HR's reason; null while active).)* |
| PATCH | `/api/admin/applicants/:applicantId/account` | (decision 39-4, Oct 25; HR and admin; replaces `/api/admin/pool/:talentPoolId/account`) `{ accountStatus: "active" \| "inactive", reason? }` (reason trimmed, 5–500, required for inactive). **Deactivate** → `{ applicantId, accountStatus: "inactive", closedApplication: { applicationId, from } \| null, expiredOffers, signInBlocked }`: one HR transaction (`withTransaction`), the svc never called; locks job_vacancy of the ongoing application (if any) → applicant → application, re-reads the ongoing application under the lock (changed meanwhile → 409 "This applicant's application changed meanwhile. Refresh the page."). The ongoing application (any `APPLICATION_OUTCOME.ONGOING` status) → `archived` with reason "Account deactivated" (HR actor; no pool entry, no company block, no rematch, no notice); its live interviews → `cancelled`, pending document requests withdrawn; waiting_pool / shortlisted / interview_* → `refreshShortlist` (system moves); with the client → the endorsement item keeps outcome `pending` with `outcome_remarks` "Account deactivated". A `hired` (Deployed) application is not touched. The active pool entry (if any): pending job offer or invitation → `expired`, availability `unavailable`. `user_account.account_status = inactive`, `deactivation_reason = reason`; after the commit the Supabase ban (`lib/signIn.js`; a failure → `signInBlocked: false`, logged with ids). **Activate** → `{ applicantId, accountStatus: "active", signInBlocked: false }`: unban first (502 "Could not unblock sign-in. Try again." changes nothing), then active, reason null, an `unavailable` pool entry → `available`; nothing else restored. 400 validation · 403 applicants · 404 "Applicant not found." |
| ~~GET~~ | ~~`/api/admin/applicants/:id`~~ · ~~`/:id/resume/url`~~ · ~~`/:id/documents/:documentId/url`~~ · ~~`/:id/documents.zip`~~ | *(applicant detail cut, ROADMAP cut #1; ZIP deferred, ROADMAP §6)* |
| GET / PATCH | `/api/admin/settings` | deadlines and defaults |
| GET | `/api/admin/users` | **A** (Phase 4, decision 19) staff accounts only → `[{ userId, email, fullName, role, accountStatus, createdAt, lastSignInAt, isSelf }]` (last sign-in from `auth.users`) |
| POST | `/api/admin/users` | **A** `{ email, fullName (1–120), temporaryPassword (FR-AUTH-02, `PASSWORD_PATTERN`) }` → `201 { userId, email, fullName, role: "hr", accountStatus: "active" }`: Supabase `auth.admin.createUser` (confirmed, `app_metadata.vera_role = hr`), the trigger's `user_account` row gets `created_by`. 409 "An account with this email already exists." (VERA pre-check or Supabase) · 400 · 502 other Supabase errors (logged without email or password). The password is never stored, logged, or returned |
| PATCH | `/api/admin/users/:id` | **A** (Oct 19, decision 22) `{ fullName? (1–120), password? (FR-AUTH-02) }`, at least one; any other key (e.g. `email`) → 400 → `{ userId, email, fullName, role, accountStatus, createdAt, isSelf, passwordChanged }`. Any staff account, the caller's own included. Supabase `auth.admin.updateUserById` first (`password`, `user_metadata.full_name`): `weak_password` → 400, other errors → 502 with nothing changed (logged with the user id only); then `user_account.full_name`. 404 not a staff account. The email never changes; the password is never stored, logged, or returned |
| PATCH | `/api/admin/users/:id/status` | **A** `{ accountStatus: active \| inactive }` → `{ userId, accountStatus, signInBlocked }`. 404 not a staff account · 409 "You cannot deactivate your own account." · 409 "Keep at least one active admin." (checked under a lock on the active admin rows). Deactivate: status first, then the Supabase ban (`ban_duration` 876000h; a failed ban → `signInBlocked: false`, pressing again retries). Activate: Supabase unban first (failure → 502, nothing changed), then the status |

---

## 7. Authentication

### 7.1 Supabase project settings
- **Email confirmations ON**; edit the *Confirm signup* template to show the code `{{ .Token }}` (6 digits) instead of a link.
- **Custom SMTP** (Auth → SMTP) — the built-in sender is heavily rate-limited and only for testing.
- **Google provider** ON; authorized redirect: `<WEB_ORIGIN>/auth/callback` (add `http://localhost:5173/auth/callback` for dev).
- Site URL / redirect URLs include `/reset-password` and `/auth/callback`.

### 7.2 Web
```js
// lib/supabase.js — remember-me aware storage
const rememberKey = "vera.remember";
const storage = {
  getItem: (k) => (localStorage.getItem(rememberKey) === "true" ? localStorage : sessionStorage).getItem(k),
  setItem: (k, v) => (localStorage.getItem(rememberKey) === "true" ? localStorage : sessionStorage).setItem(k, v),
  removeItem: (k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); },
};
export const setRememberMe = (on) => localStorage.setItem(rememberKey, String(on));
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
```
- Sign-up: `supabase.auth.signUp({ email, password })` → `/signup/verify` → `supabase.auth.verifyOtp({ email, token, type: 'signup' })`.
  *Sprint (S6):* `signUp({ email, password, options: { emailRedirectTo: origin + '/auth/callback', data: { privacy_consent_at } } })` → Supabase's confirmation **link** → `/auth/callback`. The callback handles `#access_token` (implicit, the supabase-js default) and `?code=` (PKCE; `…-code-verifier` keys are always kept in `localStorage` so a link opened in a new tab works). If no session results (another browser/device, expired or used link) it shows "Your email is confirmed. Please log in.". Supabase Auth → URL configuration must allow `<WEB_ORIGIN>/auth/callback`.
- Login: `setRememberMe(checked)` then `signInWithPassword`; Google: `signInWithOAuth({ provider: 'google', options: { redirectTo: origin + '/auth/callback' } })`.
- `apiClient` reads `(await supabase.auth.getSession()).data.session?.access_token` for every request; on `401`, sign out → `/login`.

### 7.3 API
- `authenticate`: `supabaseAdmin.auth.getUser(token)` → load `user_account` (role, status) → reject if missing/inactive → `req.auth = { userId, email, role }`.
- `requireRole(...roles)`.
- `user_account` is created by the DB trigger after email confirmation (role from `app_metadata.vera_role`, default `applicant`).
- HR creation (admin): `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { vera_role: 'hr' }, user_metadata: { full_name } })`.
- Seed accounts: `pnpm --filter api seed:admin` runs `scripts/seed-admin.js` and creates or updates the admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_FULL_NAME`, `vera_role: 'admin'`) and one HR account (`HR_EMAIL` / `HR_PASSWORD` / `HR_FULL_NAME`, `vera_role: 'hr'`). Idempotent: an existing auth user gets its role and name fixed (password unchanged) and its `user_account` row upserted. Sprint replacement for the User Management UI.
- `authenticate` responses: no/invalid token or no `user_account` → `401 UNAUTHENTICATED`; `account_status = inactive` → `403 FORBIDDEN`.
- Rate limit: 20 req/min per IP on `/api/applicant/resume/parse` and `/api/applicant/applications`.

---

## 8. Microservice contract (`apps/svc`)

All endpoints except `/health` require header `X-Internal-Key: <SVC_INTERNAL_KEY>`. Bind to `127.0.0.1` in production.

### `POST /extract` (multipart `file`)
Validation: PDF, ≤ 10 MB, has extractable meaningful text (existing validators). Response:
```json
{
  "pageCount": 2,
  "rawText": "...",
  "standardizedText": "...",
  "sections": { "header": "...", "experience": "...", "skills": "...", "education": "..." },
  "skillsText": "...",
  "experienceText": "...",
  "yearsExperience": 2.5,
  "profile": {
    "firstName": "", "middleName": "", "lastName": "", "suffix": "",
    "email": "", "contactNumber": "", "birthdate": "YYYY-MM-DD", "gender": "male|female|",
    "heightCm": null, "addressLine": "", "city": "", "province": "",
    "educationLevel": "senior_high|college_graduate|..."
  },
  "warnings": ["no dates found in experience (years counted as 0)"],
  "extractorVersion": "1.0.0"
}
```
`profile` is built by `app/extractors/profile.py` (EXT-04): `addressLine` = house no./street/barangay before the city; `educationLevel` = highest level found (abbreviations and strands only inside the education section; see ALGORITHM.md §4 EXT-04); `heightCm` converted from cm or feet/inches; `birthdate` as `YYYY-MM-DD` (numeric dates read as MM/DD/YYYY); missing values are `""` (`heightCm`: `null`). Unreadable/scanned PDFs return **400** with a readable `detail`.

### `POST /match` (JSON)
```json
{
  "resume": { "sections": { "skills": "...", "experience": "..." } },
  "job": { "skills": "line\nline", "experience": "Title\nduty\nduty" },
  "weights": { "skills": 1, "experience": 0 }
}
```
No `minYears` (decision 11; a stale caller's `minYears` is ignored like any unknown key). Experience score = relevance. A skills or experience section missing from `sections` is replaced by the whole resume text (all sections joined, decision 12) and reported in `warnings` ("no skills section found: the whole resume was used for skills", same for experience).
Response: `{ matchScore, scores: { skills, experience }, yearsWorked, matchedSkills[], missingSkills[], skillMatches[], experienceMatches[], warnings[], modelName }` (scores 0–100; `yearsWorked` is shown, never scored).
`missingSkills` = required lines whose best similarity is ≤ 0.35; `matchedSkills` = the rest (decision 27, Oct 19: display only, never in a score; the credit is the raw cosine, `LOW, HIGH = 0, 1`). Skill evidence = the Skills section only (decision 26).

### `POST /match/batch` (JSON) — *deferred (P8.4, ROADMAP §6)*
`{ "items": [{ "id": "<applicantId>", "sections": {...} }], "job": {...}, "weights": {...} }` → `[{ "id", "matchScore", ... }]` — used by *Find matches in talent pool*. *(Phase 3: pool matching on publish calls the single `POST /match` per pool entry instead, with `matchResume(input, { timeoutMs: 15000 })`; apply and rematch keep the default timeout.)*

Implemented in S5 as `app/api/extract.py` and `app/api/match.py`; the prototype `/process-resume` and `/match-resume` were removed. `/match` applies the same spelling standardization (EXT-02) to the job text that `/extract` applied to the resume, scores are rounded to 2 decimals, and `modelName` comes from `SBERT_MODEL` (default `all-MiniLM-L6-v2`). Validation errors in the JSON body return **422**.

---

## 9. Notifications and email

Emails are queued (`notification.email_status = 'pending'`) inside the business transaction and sent by the `send-pending-emails` job, so a mail outage never rolls back a status change. Templates live in `apps/api/src/lib/emailTemplates/`.

| Type | Recipient | Email | Action |
|---|---|---|---|
| `application_submitted` | applicant | — | — |
| `prescreen_failed` *(Phase 3, decision 17a: "Not shortlisted for {job}" — the unmet conditions, then "We keep your profile in our applicant pool and will invite you when a job fits. You can apply to other jobs.")* | applicant | — | — |
| `below_threshold` *(Phase 3: same title and pool sentence)* | applicant | — | — |
| `shortlisted` | applicant | — | — |
| `shortlist_displaced` | applicant (moved back to the waiting pool by a higher score) | — | — |
| `document_requested` | applicant | ✓ | ✓ |
| `document_verified` | applicant | — | — |
| `application_dropped` | applicant | ✓ | — |
| `interview_scheduled` / `interview_rescheduled` *(decision 37: notify only — the time, the length, "The meeting link is on your dashboard."; never a confirm line or deadline; `requires_action` false)* | applicant | ✓ | ✓ |
| `interview_reminder` | applicant | ✓ | — |
| ~~`applications_terminated`~~ *(removed in S13: confirming an interview does not touch any other application, because an applicant has at most one ongoing application, BR-17)* | — | — | — |
| `not_selected` *(S15, BR-22: "Job closed: {job}" — the job is no longer open, kept in the applicant pool, "You can apply to other jobs."; never "selected")* | applicant | — | — |
| `rematch_offer` *(S17, BR-23: "Another job for you: {job}" — answer on the dashboard by {due} (Philippine time), the employer decides; no company, no score; application_id null)* | applicant | — | ✓ |
| `rematch_offer_expired` *(S17: "Job no longer available: {job}", neutral, ends "You can apply to other jobs."; after a failed accept re-check)* | applicant | — | — |
| `hr_rematch_offered` / `hr_rematch_accepted` / `hr_rematch_declined` *(S17: name the applicant, job, and company)* | all active HR + admin | — | — |
| `evaluation_did_not_pass` *(S14: "Application update: {job}" — not successful this time, kept in the applicant pool, "You can apply to other jobs."; no score, company, or reason; same text after reused ratings)* | applicant | ✓ | — |
| `passed_confirm_endorsement` *(S15: "Please confirm: {job}"; HR's body + (decision 32) the line "Final interview: {date and time} (Philippine time). {details}" + fixed deadline line; may say "passed", names the employer's final decision, never the company. **Decision 37B: no longer sent; old rows only**)* | applicant | ✓ | ✓ |
| `endorsement_notice` *(decision 37B: "Selected for endorsement: {job}"; HR's body + the final interview line, no deadline, nothing to answer; never the company)* · `endorsement_removed` *(decision 37B: "Application closed: {job}" — "Your application for {job} will not go forward to the employer. You can apply to other jobs."; never HR's reason or the company)* | applicant | — | — |
| `endorsed` *(S16: "Sent to the employer: {job}" — the employer makes the final hiring decision; no company)* | applicant | ✓ | — |
| `moved_to_standby` *(S15/S16: "Kept in our applicant pool: {job}" — will not go forward to the employer, passed the agency assessment, "You can apply to other jobs."; fits archive, fill, and others endorsed)* | applicant | ✓ | — |
| `hired` / `not_hired` *(S16: "Hired: {job}" may sound positive — **decision 37C: "Deployed: {job}" / "You are deployed for {job}. The agency will contact you about the next steps."**; "Employer decision: {job}" is neutral and ends "You can apply to other jobs."; never the company)* | applicant | ✓ | — |
| `training_failed` *(S16: "Training update: {job}", neutral, ends "You can apply to other jobs.")* | applicant | — | — |
| `final_interview_scheduled` / `final_interview_rescheduled` *(Phase 2, decision 14: "Final interview scheduled: {job}" / "Final interview time changed: {job}" — the date in Philippine time, HR's instructions, "If you can't attend, please contact Confiable Manpower."; never the company or a score. Decision 32: at Create endorsement "scheduled" goes only to an applicant without a final interview in their Notify message (accepted rematch), "time changed" only when HR acknowledged a different one; none when it matches)* | applicant | — | — |
| `for_hiring` *(Phase 2, decision 15: "For hiring: {job}" — passed the employer's final interview, the employer makes the final hiring decision. **Decision 37C: no longer sent; old rows only**)* | applicant | — | — |
| `for_training` / `for_requirements` / `for_orientation` *(decision 37C: "For training: {job}" — passed the employer's final interview, moves on to training; "For requirements: {job}" — training complete, prepare the pre-employment requirements; "For orientation: {job}" — requirements complete, next is the orientation; each "the agency will contact you about the details"; never the company, a score, or "hired")* | applicant | — | — |
| ~~`post_hiring_details`~~ *(cut with the post-hiring form, Oct 10)* | applicant | — | — |
| `pool_invitation` | applicant | ✓ | ✓ |
| `job_invitation` *(Phase 3: "Job invitation: {job}" — the agency found a job that fits your profile, do you want to apply, answer on the dashboard by {due} (Philippine time); no company, no score)* | applicant | — | — |
| `job_invitation_expired` *(Phase 3: "Job no longer available: {job}" — kept in the applicant pool, "You can apply to other jobs."; on a vacancy leaving open or a failed accept re-check)* | applicant | — | — |
| `hr_invitation_accepted` / `hr_invitation_declined` *(Phase 3: "Invitation accepted: {name}" / "Invitation declined: {name}", naming the job and company)* · `hr_pool_matching_finished` *("Pool matching finished: {job}" — "{n} invited, {n} skipped, {n} failed.")* | all active HR + admin | — | — |
| `hr_interview_confirmed` *(decision 37: never sent any more; type kept)* / `hr_reschedule_requested` *(Phase 4: "Reschedule requested: {name}" — job, company, the current time, the applicant's reason, "Approve with a new time or decline in Interview Assessment." (singular like the menu, fixed for the final test))* | all active HR + admin | — | ✓ (reschedule) |
| `reschedule_declined` *(Phase 4: "Reschedule request declined: {job}" — the interview stays on {date} (Philippine time), "If you can't attend, please contact Confiable Manpower."; no company; decision 37: no confirm line)* · an approved request reuses `interview_rescheduled` (the new time, no confirm line) | applicant | — | — |
| `hr_document_uploaded` | all active HR + admin | — | — |
| `hr_endorsement_confirmed` / `hr_endorsement_declined` *(decision 37B: never sent any more; types kept)* | all active HR + admin | — | — |

Auth emails (sign-up code, password reset) are sent by Supabase Auth, not by this table.

---

## 10. Files and storage

| Bucket | Path | Written by |
|---|---|---|
| `resumes` | `drafts/<userId>/<uuid>.pdf` → moved to `<applicantId>/<uuid>.pdf` on confirm | parse / confirm |
| `documents` | `<applicantId>/<uuid>.pdf` | document upload |
| `endorsements` | `<endorsementId>/form.pdf`, `<endorsementId>/summary.xlsx` | endorsement generation |

- Buckets are private; the API returns signed URLs valid for 10 minutes after checking ownership/role.
- **Endorsement packet (Phase 2, decision 21):** the API itself downloads the application's own resume (`resumes` bucket, `storage.downloadFile`), merges it behind the cover in memory, and streams the PDF to HR. Nothing is written to the `endorsements` bucket; the packet is never stored or cached. The cover reads only the rubric, the ratings source's 15 ratings, and the application's own interview score (no section weights, Oct 19).
- **Replaced supporting documents (Oct 19, decision 28):** the `documents` bucket file of a replaced row is removed only after the database delete commits; a failed removal leaves an orphan file (logged with document ids), never a row without a file.
- Uploads: multer memory storage, 10 MB, `application/pdf` + `%PDF` magic-byte check.
- Never trust client file names for paths; always generate UUID names.

---

## 11. Testing

| Level | Tool | Scope |
|---|---|---|
| Unit | `vitest` (api) | `domain/*`: prescreen, scoring, statusMachine, shortlist ordering |
| Unit | `pytest` (svc) | existing tests + `/extract` profile fields + `/match` weights |
| Integration | `supertest` + test Supabase project (or local `supabase start`) | each module's happy path + permission checks |
| Component | `vitest` + Testing Library (web) | forms (sign-up, vacancy form, evaluation form) |
| System (black-box) | manual test cases table `docs/test-cases.md` (TC-xx ↔ FR-xx) | thesis Table 2 |
| Algorithm evaluation | svc `training/` scripts | extraction P/R/F1; Spearman ρ vs HR ranking |

| Algorithm traceability | `pnpm algo:check` | every implemented step has a `VERA-ALGO` block; registry and code agree |

Run all: `pnpm test` (`pnpm -r` runs `test` in each app) and `pnpm algo:check`.

---

## 12. Environment variables

`apps/api/.env.example`
```
NODE_ENV=development
PORT=5000
WEB_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres
DATABASE_SSL=true
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=<secret / service_role key — server only>
SVC_URL=http://127.0.0.1:8000
SVC_INTERNAL_KEY=<random 32+ chars, same as svc>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=<gmail app password>
MAIL_FROM="Confiable Manpower (VERA) <your-address@gmail.com>"
JOBS_ENABLED=true
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_FULL_NAME=VERA Admin
HR_EMAIL=
HR_PASSWORD=
HR_FULL_NAME=VERA HR
```

`apps/web/.env.example`
```
VITE_API_URL=http://localhost:5000/api
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable / anon key — safe in the browser>
```

`apps/svc/.env.example`
```
SVC_INTERNAL_KEY=<same as api>
SBERT_MODEL=all-MiniLM-L6-v2
```

---

## 13. Local development

```bash
# once
pnpm install                                   # root
cd apps/svc && python -m venv .venv
.venv\Scripts\pip install -r requirements.txt  # Windows  (macOS/Linux: .venv/bin/pip ...)
cd ../..
# every day
pnpm dev                                       # pnpm -r --parallel runs web (5173), api (5000), svc (8000)
```

`scripts/run-py.mjs`
```js
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const venv = path.resolve(process.cwd(), ".venv");
const python = process.platform === "win32"
  ? path.join(venv, "Scripts", "python.exe")
  : path.join(venv, "bin", "python");

if (!existsSync(python)) {
  console.error(`[svc] venv not found at ${python}. Create it and install requirements.txt first.`);
  process.exit(1);
}
const child = spawn(python, process.argv.slice(2), { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
```

`apps/svc/package.json`
```json
{
  "name": "svc",
  "private": true,
  "scripts": {
    "dev": "node ../../scripts/run-py.mjs -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000",
    "test": "node ../../scripts/run-py.mjs -m pytest"
  }
}
```

Root `package.json` scripts
```json
{
  "dev": "pnpm -r --parallel --if-present run dev",
  "dev:turbo": "turbo run dev",
  "build": "pnpm -r --if-present run build",
  "lint": "pnpm -r --if-present run lint",
  "test": "pnpm -r --if-present run test",
  "test:turbo": "turbo run test",
  "algo:check": "node scripts/algo-map.mjs --check",
  "algo:map": "node scripts/algo-map.mjs",
  "algo:snippets": "node scripts/algo-map.mjs --snippets"
}
```

`turbo.json` tasks: `dev` (`cache: false`, `persistent: true`), `build` (`dependsOn: ["^build"]`, `outputs: ["dist/**"]`), `lint`, `test` (`dependsOn: ["^build"]`).

Root scripts use `pnpm -r` because Windows Smart App Control blocks the unsigned `turbo.exe`; `dev:turbo` / `test:turbo` remain for machines where turbo is allowed.

---

## 14. Security checklist

- [ ] Secrets rotated after the zip was shared; `.env` never committed or zipped.
- [ ] Browser only has the publishable key; RLS enabled on all tables with no public policies.
- [ ] Every admin route has `requireRole('admin','hr')`; user/competency management `requireRole('admin')`.
- [ ] Applicants can only access their own rows (service layer always filters by `req.auth.userId`).
- [ ] Applicant vacancy endpoints never return company fields.
- [ ] Parameterized SQL only (no string concatenation).
- [ ] File type + size validated in api **and** svc; private buckets; short signed URLs.
- [x] svc requires `X-Internal-Key` and listens on 127.0.0.1.
- [ ] No PII (names, emails, resume text) in logs.
- [ ] Rate limits on parse/apply; helmet headers; CORS restricted.
- [x] Data Privacy Act consent stored at sign-up (`user_metadata.privacy_consent_at`).
