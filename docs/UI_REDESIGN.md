# VERA — UI Redesign Reference

> The reference for every redesign tab. Read this instead of `docs/design/UI_RULES.pdf`; if they ever differ, the PDF wins.
> Behaviour, copy and what exists come from the [PRD](./PRD.md), [APP_FLOW](./APP_FLOW.md) and [UI_GUIDELINES](./UI_GUIDELINES.md) (§7 copy rules, §9 mockups vs process). Phase 0 (Oct 24, 2026) built §2 tokens and the §3 shell and shared components; pages follow one tab at a time.

---

## 1. Rules digest (UI_RULES.pdf, non-negotiable)

1. **Visual only.** No change to `apps/api`, `packages/shared` logic, `apps/svc`, `supabase/`, routes, data, API contracts, validation, workflows, statuses, roles, permissions, matching or scoring (SBERT, cosine, WSM, weights, thresholds, ranking).
2. **No new dependency.** Use what `apps/web/package.json` already has (Tailwind 4, shadcn/base-ui, lucide-react, Roboto + Montserrat via `@fontsource-variable`).
3. **Keep everything that exists:** every navigation item, label, heading, button text, field, column, action, status label, aria role and accessible name (tests query them). Keep event handlers, state, data bindings and form submissions.
4. **Add nothing that does not exist:** no fake data, no non-working buttons, no new metrics, charts, AI explanations, recommendations, notifications, statuses or empty-state actions. Only show values the app already calculates or stores.
5. **Matching is the visual centrepiece** where it already appears (Resume Screening, Ranking, scores): polished score badges and progress bars, restrained electric blue and cyan. Never add scores to pages that do not show them.
6. **ERD, DFD and Use Case Diagrams stay valid**: nothing here may require changing them.
7. **Names:** the app is **VERA — Virtual Employment and Recruitment Assistant** (the mockups' "Verified Evaluation and Recruitment Assistant" and "Confiable Recruitment and Employment System" are wrong). The `hired` status shows as **Deployed** (decision 37C).
8. **PRD wins over mockups** (UI_GUIDELINES §9). Where a mockup shows something VERA does not have, skip it and add it to §5.
9. **Accessibility:** text ≥ 4.5:1, control borders and focus rings ≥ 3:1, visible keyboard focus, 44px targets, no horizontal page scroll at phone width; dense HR tables stay usable.
10. **Tests:** run `pnpm --filter web test` and `pnpm lint` after every tab; fix only what the change broke, assertions at least as strict. Never claim a check passed without running it.

---

## 2. Tokens (`apps/web/src/index.css`)

Token **names** are the ones UI_GUIDELINES §2 introduced (pages and tests use them); Phase 0 changed their **values**.

### 2.1 Palette
| Token / class | Value | Use |
|---|---|---|
| `nav` (`--sidebar`) | **#0D1B2A** midnight navy | sidebar, avatar disc, headings |
| `navy-deep` | **#123A63** deep navy | sidebar gradient end |
| `nav-hover` | #1A2E45 | navy hover |
| `primary` | **#155EEF** electric blue (white text 5.4:1) | primary actions, active nav, links, focus ring |
| `primary-hover` / `primary-pressed` | #0F4FD6 / #0B3FB0 | button states |
| `primary-soft` | #E8F0FF | soft blue fills, selected rows, icon discs |
| `cyan` | **#22D3EE** | decorative accents only (gradients, underline, glow) — **never text on white** (1.8:1) |
| `brand-yellow` | **#FFCC00** Confiable yellow | short brand rules, logo area — decorative only |
| `background` / `surface-blue` | **#F3F8FF** workspace | page background, row hover |
| `surface-subtle` / `muted` | #EEF3FA | table header, neutral badge fill |
| `card` / `popover` | #FFFFFF | cards, dialogs, inputs |
| `heading` | #0D1B2A | titles |
| `text` / `foreground` | #1E293B slate-800 | body text |
| `muted-foreground` | #475569 slate-600 (7.6:1 on white) | supporting text, labels in tiles |
| `border` | #DCE5F2 | hairlines, card rings |
| `input` / `control-border` | #71839A (3.88:1) | input and select borders |
| `destructive` | #B42332 | destructive actions |

### 2.2 Status tones (`components/shared/tones.js` → `TONE_CLASSES`, class names fixed)
| Tone | Text | Soft fill | Contrast |
|---|---|---|---|
| success | #137A43 | #E3F6E9 | ≥ 4.5:1 |
| warning | #8A5300 | #FFF5DF | ≥ 4.5:1 |
| error | #B42332 | #FFE6E9 | ≥ 4.5:1 |
| info | #1D4ED8 | #E8F0FF | 5.9:1 |
| interview | #6F35B5 | #F0E7FF | ≥ 4.5:1 |
| neutral | #475569 | #EEF3FA | 6.8:1 |
| resume (ScoreChip) | #087B61 | #E0F7F1 | ≥ 4.5:1 |

### 2.3 Radius, spacing, shadows
- Radius: `sm` 6px (small controls), `md` 8px (buttons, inputs, badges), `lg` 12px (menus, toasts), `xl` 16px (cards, tables, dialogs, metric tiles, empty states).
- Spacing: Tailwind's 4px scale. Page padding 16px (phone) / 24px (≥ md); card padding 16 / 24px; gaps 8 / 12 / 16 / 24px. Sidebar `w-sidebar` 256px; top bar `h-header` 56px; content `max-w-content` 1440px.
- Shadows (navy-tinted): `shadow-card` (cards, tables, tiles), `shadow-raised` (menus, toasts, hovered tiles), `shadow-dialog` (dialogs, sheets), `shadow-glow` (blue glow: **only** primary-button hover and the active nav item).

### 2.4 Typography
Montserrat Variable = `font-heading` (titles, metric numbers, brand). Roboto Variable = `font-sans` (everything else). `h1`–`h4` use `font-heading` by default.
| Role | Class | Size / weight |
|---|---|---|
| Page title | `text-page-title font-extrabold` (PageHeader) | 28px / 800, Montserrat |
| Section heading | `text-section-title font-bold` | 20px / 700, Montserrat |
| Card title | `text-card-title font-bold` | 18px / 700, Montserrat |
| Metric number | `text-metric font-extrabold tabular` | 32px / 800, Montserrat |
| Body | `text-body` | 14px / 400, Roboto |
| Supporting text | `text-body-sm text-muted-foreground` | 13px |
| Form label | `Label` (`text-sm font-medium`, unchanged in Phase 0) | 14px / 500 |
| Table header / cell | `text-label-sm font-semibold text-heading` / `text-body` | 12px / 600; 14px |
| Badge | `text-label-sm font-semibold` | 12px / 600 |

### 2.5 Focus and motion
- Focus: `focus-visible:ring-3 ring-ring/40` + `border-ring` on controls (electric blue); **white** ring (`ring-sidebar-ring`) on the navy sidebar. Never remove an outline without a ring.
- Motion: 150–200 ms `ease-out` on colour, shadow and small translations (tile lift 2px, chevron 2px). `prefers-reduced-motion: reduce` turns transitions and animations off globally (index.css).

---

## 3. Component rules

### 3.1 Shell (built in Phase 0)
- **Sidebar** (`layouts/Sidebar.jsx`): navy gradient `nav → navy-deep`, two faint CSS circles at the bottom (no image, `aria-hidden`), logo 96px + **VERA** (Montserrat 800) + a short yellow rule. Items: 44px, `rounded-lg`, icon 20px + label, `text-white/80`, hover `bg-white/8`. **Active** = electric-blue pill, white semibold text, `shadow-glow`. **Log out** pinned at the bottom, white semibold label, red icon. Same items per role (`navigation.js`), same disabled state on Setup, `aria-label="Main"`. Below 1200px it is the drawer (Sheet).
- **Top bar** (`layouts/Header.jsx`): 56px, white 85% with blur and a hairline. Left: the page label (kept, Montserrat bold). Right: bell (blue, round hover, red count only when unread > 0), a divider, account trigger = navy initials avatar + name + role (blue) + chevron; the menu keeps **Log out**.
- **Footer** (`layouts/AppShell.jsx`): static, hairline on top: "Virtual Employment and Recruitment Assistant" (left, Montserrat) and "© 2026 Confiable Manpower Solutions Inc." (right). No links (no Privacy/Terms/Help pages exist). Not on the login and print pages.

### 3.2 Building blocks
- **Page header** (`PageHeader`): Montserrat 28px extrabold title, optional slate description (decision 36 removed most), actions on the right; stacks on phones.
- **Card** (`ui/card`): white, `rounded-xl`, `shadow-card`, `ring-1 ring-border/80`; `CardTitle` Montserrat bold heading colour. Pages that build their own card (`rounded-md border bg-card`) move to this look in their tab.
- **Metric tile** (`MetricTile`): white `rounded-xl` card with a 4px **blue → cyan** top bar, label (12px slate semibold) directly followed by the number (Montserrat 32px); with `to` the whole tile is a link, lifts 2px with `shadow-raised` on hover and shows a blue chevron. With the optional `icon` prop (Dashboard) the tile switches to the tinted look: soft `tone` fill (info, warning, resume, interview, success, neutral; badge pairs of §2.2), icon in a round disc on the left, number above the label (label stays first in the DOM), chevron in the tone colour. Dashboard tints: Total applicants and For endorsement info · Waiting pool warning · For screening resume · For interview interview · Hired and Active vacancies success · Applicant pool neutral. Keep the label and the number as direct siblings.
- **Table / DataTable**: container `rounded-xl` + `shadow-card` + ring; header row `bg-surface-subtle`, 44px, 12px semibold heading-colour labels, sort buttons turn blue on hover; rows 56px, hairline separators, hover `bg-surface-blue`, selected `bg-primary-soft`. **Pagination** = the existing "Showing X–Y of N" + **Previous** / **Next** secondary buttons (keep the words; no numbered pages unless the page already has them). Narrow screens scroll the table inside its container, never the page.
- **Buttons** (`ui/button`, `rounded-md`, 44px): **default/primary** electric blue, white text, glow on hover; **secondary** white with a blue border and blue label (hover `primary-soft`); **destructive** white with a red border and red label (the solid red fill only on the final confirm in `ConfirmDialog`); **ghost** for icon buttons; **link** for inline links. One primary action per area.
- **Input / textarea** (`ui/input`, `ui/textarea`): white, `rounded-md`, `border-input`, slate placeholder, darker border on hover, blue border + ring on focus, red border + ring when `aria-invalid`; disabled = 50% (Setup keeps its own full-opacity rule).
- **Select**: VERA uses native `<select>` with page classes; `index.css` adds the focus ring, transition and pointer cursor to every `select`. Each tab gives its selects the input look (`rounded-md border-input bg-card h-11 px-3`).
- **Tabs** (`ui/tabs`, line variant): semibold slate labels, active = electric blue with a 2px **blue → cyan** underline; long tab lists scroll inside themselves (`overflow-x-auto`).
- **Badge / StatusBadge**: `rounded-md`, `px-2 py-0.5`, 12px semibold, soft fill + tone text from `TONE_CLASSES`; never a bare colour without the label.
- **Score badge** (ScoreChip, restyled in the Resume Screening / Ranking tab): keeps "Resume / Interview / Final" + the value with two decimals + "%", and "Not evaluated" for null. Colour bands (owner, Oct 24) — **blue scale, no red/green, so no implied pass/fail** (the vacancy's own threshold and passing score stay the only rules):
  | Score | Look |
  |---|---|
  | ≥ 80.00 | solid `primary` fill, white text (5.4:1) |
  | 60.00–79.99 | `info-soft` fill, `info` text |
  | < 60.00 | `surface-subtle` fill, `muted-foreground` text |
  | null | `surface-subtle`, "Not evaluated" |
  A progress bar may show the same value (track `progress-track`, fill `primary → cyan`), only where the score is already shown.
- **Empty state** (`EmptyState`): white `rounded-xl` panel with shadow and ring, a 56px soft blue → cyan disc with the icon, Montserrat title, optional description (decision 36: most lists show the title only), the action only if the page already has it.
- **Dialog / Sheet** (`ui/dialog`, `ui/sheet`, `ConfirmDialog`): navy 55% overlay with a light blur; `rounded-xl` white popup, `shadow-dialog`, 24px padding, Montserrat title; footer buttons right-aligned (Cancel = secondary, confirm = primary or solid red when destructive); API errors in a `bg-error-soft` box with `role="alert"`. Existing widths stay (dialog 560px, review sheet 480px).
- **Dropdown menu**: `rounded-lg`, `shadow-raised`, ring.
- **Toast** (sonner): white, `rounded-lg` (12px), `shadow-raised`, lucide icons per type; text unchanged.
- **Loading**: existing skeletons (`Skeleton`) and spinners (`Loader2`) stay; no new loaders.

### 3.3 Status → colour map (from `@vera/shared` `APPLICATION_STATUS_LABELS`; change tones there only with the owner)
| Status | HR label | Applicant label | Tone |
|---|---|---|---|
| prescreen_failed | Prescreen failed | Not shortlisted | neutral |
| below_threshold | Below threshold | Not shortlisted | neutral |
| waiting_pool | Waiting pool | Application received | neutral |
| shortlisted | Screening | Under review | info |
| interview_scheduled *(old rows)* | For interview | Interview scheduled | warning |
| interview_confirmed | For interview | Interview scheduled | interview |
| did_not_pass | Did not pass | Not selected (kept in applicant pool) | error |
| passed | Passed | Under final review | success |
| passed_awaiting_confirmation *(old rows)* | Awaiting confirmation | Passed — for endorsement | warning |
| for_endorsement | For endorsement | For client interview | info |
| endorsed | Endorsed | For client interview | info |
| final_interview_scheduled | Final interview | Final interview scheduled | interview |
| for_hiring *(old rows)* | For hiring | For hiring | info |
| for_training | For training | For training | info |
| for_requirements | For requirements | For requirements | info |
| for_orientation | For orientation | For orientation | info |
| hired | **Deployed** | **Deployed** | success |
| not_hired | Not hired | Kept in applicant pool | error |
| training_failed | Training failed | Kept in applicant pool | error |
| standby | Standby | Kept in applicant pool | neutral |
| terminated *(old rows)* | Terminated | Closed (you continued with another job) | neutral |
| dropped | Dropped | Closed (no response) | neutral |
| archived | Archived | Closed (not endorsed) | neutral |
| not_selected | Not selected | Not selected (kept in applicant pool) | neutral |

Other kinds (same `StatusBadge`): **vacancy** Draft neutral · Active success · Closed neutral · Endorsing info · Filled success · Archived neutral. **Verification** For verification warning · Verified success · Rejected error · Reupload required warning. **Interview** Awaiting confirmation warning · Scheduled info · Reschedule requested warning · Rescheduled neutral · Completed success · No-show error · Expired error · Cancelled neutral. **Document request** Pending warning · Uploaded success · Expired error · Withdrawn neutral.

---

## 4. Page map (route → component → design image)

Images are in `docs/design/pages/`. Phase 0 reviewed only **01, 02, 15, 33**; each tab reviews its own images first and adds what it skips to §5.

| Route | Component | Image(s) |
|---|---|---|
| `/login`, `/signup` (AuthLayout) | `pages/auth/Login.jsx`, `pages/auth/SignUp.jsx`, `layouts/AuthLayout.jsx` | 01 |
| `/auth/callback` | `pages/auth/AuthCallback.jsx` | — |
| `/admin` | `pages/admin/Dashboard.jsx` | 02 |
| `/admin/companies`, `/admin/companies/:id` | `pages/admin/Companies.jsx` | 03, 04, 05 |
| `/admin/vacancies` | `pages/admin/Vacancies.jsx` | 06 |
| `/admin/vacancies/new`, `/admin/vacancies/:id/edit` | `pages/admin/VacancyEdit.jsx` (+ `features/vacancies/VacancyForm.jsx`) | 07 |
| `/admin/vacancies/:id` (details, Ranking tab) | `pages/admin/VacancyDetail.jsx` | 08, 09, 10, 11 |
| `/admin/applicants` | `pages/admin/Applicants.jsx` | 12 (13 = applicant detail: **skip**) |
| `/admin/screening` | `pages/admin/Screening.jsx` | 14 |
| `/admin/screening/:vacancyId(/:applicationId)` | `pages/admin/ScreeningVacancy.jsx` (+ `features/screening/ReviewSheet.jsx`, `features/interviews/ScheduleInterviewDialog.jsx`) | 15, 16, 17, 18 |
| `/admin/interviews(/:vacancyId)` | `pages/admin/Interviews.jsx` | 19 |
| `/admin/interviews/:vacancyId/:applicationId` | `pages/admin/InterviewEvaluation.jsx` | 20 |
| `/admin/endorsements` | `pages/admin/Endorsements.jsx` | 21 |
| `/admin/endorsements/:vacancyId` | `pages/admin/EndorsementVacancy.jsx` (+ `features/endorsements/*`) | 22 |
| `/admin/endorsements/:vacancyId/print/:endorsementId` | `pages/admin/EndorsementPrint.jsx` | — (print page, no shell) |
| `/admin/talent-pool` | `pages/admin/TalentPool.jsx` | 23, 24 (25–30: **skip**) |
| `/admin/users` (admin only) | `pages/admin/Users.jsx` | — (follow 03's table look) |
| `/admin/reports` | `pages/admin/Reports.jsx` | 31 |
| `/admin/notifications`, `/applicant/notifications` | `pages/Notifications.jsx` (+ `features/notifications/NotificationList.jsx`) | 32 |
| `/applicant/setup` | `pages/applicant/Setup.jsx` | — (follow 33's form look) |
| `/applicant` (My Profile) | `pages/applicant/Dashboard.jsx` | 33 |
| `/applicant/jobs` | `pages/applicant/Jobs.jsx` | 34 |
| `/applicant/jobs/:vacancyId` | `pages/applicant/JobDetailPage.jsx` (+ apply dialog) | 35, 36 |
| `/applicant/documents` | `pages/applicant/Documents.jsx` | 37, 38 |
| `*`, placeholders | `pages/NotFound.jsx`, `pages/ComingSoon.jsx` | — |

---

## 5. Skip list and conflicts (never build these)

**Known (owner):** Remember me · Forgot password · Google sign-in ("Sign in with Google", "or") · Privacy Policy / Terms of Use / Help links · **Run Resume Screening** button (the shortlist is automatic) · applicant detail page (13) · Applicant Pool **Final Interview / On Training** tabs and training steps (25–30; the client stages live on the Outcomes tab's stage tracker, decision 37C) · any 6-competency or 0–100 rubric (VERA: 15 items in A/B/C, ratings 1–5).

**Found in 01 (Login):** the wrong long name and "Welcome to VERA" wording (keep Login's real texts and the real name) · "Don't have an account? Contact your administrator." (check the real sign-up link first) · "WORK TODAY. A BETTER TOMORROW." tagline (no source; keep the existing brand panel texts) · "Sign in to your account to continue" subtitle (no source) · placeholder-only fields (VERA keeps visible labels; the mail/lock icons are decorative) · "Log In" capitalisation (keep "Log in"). VERA's existing **Remember me** checkbox (FR-AUTH-03) stays: the owner skip covers only adding the mockup's version.

**Found in 02 (HR dashboard):** "Good day, Admin!" greeting, the subtitle and the date panel (decision 36 removed page descriptions; no greeting exists) · tile names that differ from VERA's 8 tiles (keep VERA's labels: Total applicants, Waiting pool, For screening, For interview, For endorsement, Hired, Applicant pool, Active vacancies; "Hired" on this tile stays as built) · six tiles instead of eight · per-row **View** button, ⋮ row menu, **View All** button, a "Scheduled" status column and a "Join Meeting" link column (use only the columns and links the dashboard already has) · footer wording.

**Found in 03–05 (Company Management):** page description and date panel (decision 36) · **All Industries** filter and **Sort by** dropdown (VERA searches by name and sorts by column header) · search placeholder "company name, industry, email or contact person…" (the search covers the name only) · `#`, **Industry**, **Contact Number** and **Date Added** columns (list rows carry none of the last two; industry stays under the name) · numbered pagination · company logos (a decorative initials tile from the real name instead) · the add form as a full page with "Back to Company Management" (VERA keeps the dialog, which also edits) · group subtitles, red required asterisks, "Company Description" / "Company Website" / "Contact Person Name" wording, an **Industry** select and the mockup placeholders (keep VERA's labels, free-text industry and "(optional)" on Website only) · **Add Company's Job Vacancies** button · "Company Details" drawer title and industry pill under the name (the title stays the company name, nothing under it — decision 36) · company Address, company-level Email / Contact Number separate from the contact person · **Total Applicants**, **Ongoing Interviews**, **Hired Applicants** tiles and their **View All / View Applicants / View Interviews / View Reports** links (VERA shows its five FR-COMP-03 counts, at the top, without links) · the wide two-column drawer (it keeps 440px).

**Found in 06–08 (Job Vacancies):** page descriptions and the date panel (decision 36) · "Add Job Vacancies" / "Add Job Vacancy" / "Create Job Vacancy" / "Job Vacancy Details" wording (keep "Create job vacancy", **Save draft** / **Save and publish**, and the job title as the details heading) · search placeholder "Search job title or company…" (keep "Search title or company") · company logos (the decorative initials tile instead) · separate **Needed Slots** / **Remaining Slots** tiles on the list card (VERA keeps its "X of Y slots remaining" line, status badge and four stage counts) · numbered form steps 1–5 (section icons instead; the form stays one page) · **Back to Job Vacancies** and **Cancel** buttons on the form (it has neither; the details page keeps its "Job Vacancies" back link) · red asterisks, 0/2000 character counters, mockup placeholders, an **Other Qualifications** field and required education/gender (keep VERA's labels and "(optional)" fields) · six competency weights with icons and a pencil button (VERA weights its A/B/C sections) · Job Description and Key Responsibilities as two cards (VERA keeps both in its "Job description" section, side by side from 1024px) · company industry / employee-size line, meta chips (industry, location, On-site, Full-time, **Competitive Salary**) and "Posted on" beside the status (location, employment type and Posted stay in the Position card; no salary is stored) · **Hiring Information** slot tiles, competency-weight **progress bars** (the weights table stays; no charts) · **Additional Information** (Job ID, company website, email, number — not on the vacancy) · **Rank Candidates** button and its note (Ranking is a tab) · bullet lists for responsibilities and qualifications (the text shows as entered, one per line) · an icon-only edit button (keep **Edit**).

**Found in 15 (Resume Screening):** per-row **View Supporting Documents** and **Schedule Interview** buttons (VERA opens the review sheet; scheduling is inside it) · "Back to Job Vacancies" (keep the back link the page already has) · applicant-count pill · numbered pagination · resume file-name links in the table · "Document Status" wording and icons (use VERA's verification labels) · **red / green / amber score colours** (use the blue bands, §3.2).

**Found in 33 (My Profile):** "Manage your personal information…" description (removed by decision 36) · date panel · an Age field with a spinner and a Birthday date picker (keep VERA's existing profile fields and controls; number spinners stay hidden, decision 35) · edit pencil if it differs from the existing Edit button · **Upcoming Interview** extras: "Online" pill, "Via Google Meet", "Interviewer: HR Team", "link active 10 minutes before" note and **View Details** / **View All** buttons (show only what the Upcoming interviews card already shows) · notification icons and texts that are not VERA's notification types.

**General:** the mockups' top bar has no page label — VERA keeps it (PDF §5) · mockup footer "Confiable Recruitment and Employment System" — use the real name · any sample names, numbers, photos or counts in the mockups are illustrations, never data.
