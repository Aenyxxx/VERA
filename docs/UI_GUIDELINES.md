# VERA — UI Implementation Guidelines

> How to turn [DESIGN.md](./DESIGN.md) (the visual source of truth, derived from the 37 mockup pages) into React + Tailwind 4 + shadcn/ui code.
> **Precedence:** DESIGN.md decides *how things look*. [PRD](./PRD.md) and [APP_FLOW](./APP_FLOW.md) decide *what exists and how it behaves*. Where the mockups show an older process, §9 lists what wins.

---

## 1. Setup checklist (task P0.8)

1. Font: replace Inter with Roboto (variable font, so the design's 600 weight renders exactly).
   `pnpm --filter web remove @fontsource-variable/inter && pnpm --filter web add @fontsource-variable/roboto`
2. Replace the shadcn neutral theme in `index.css` with the tokens in §2. Delete the `.dark` block (no dark theme — DESIGN.md Don'ts).
3. Merge `styles/global.css` and `styles/login.css` into Tailwind classes or `index.css` `@layer components`; delete both files.
4. Fix `cn`: `lib/utils.js` → `twMerge(clsx(...))`; update every `components/ui/*` import from `"cn"` to `"@/lib/utils"`.
5. Theme the generated shadcn components once (§3): 44px controls, 4px radius on buttons/inputs/badges.
6. Add shared components (§4) in `components/shared/`.

---

## 2. Tokens → `index.css`

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/roboto";

@theme inline {
  --font-sans: 'Roboto Variable', Roboto, Arial, sans-serif;
  --font-heading: var(--font-sans);

  /* shadcn semantic colors */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  /* VERA tokens (DESIGN.md front matter) → classes like bg-nav, text-heading, bg-resume-soft */
  --color-primary-hover: #1054B3;
  --color-primary-pressed: #0D4594;
  --color-primary-soft: #E2F0FF;
  --color-nav: #112B49;
  --color-nav-hover: #1E3A59;
  --color-brand-yellow: #FEDE20;
  --color-surface-subtle: #F0F4F9;
  --color-surface-blue: #F0F8FF;
  --color-heading: #112B49;
  --color-text: #24364B;
  --color-control-border: #71839A;
  --color-success: #137A43;
  --color-success-soft: #E3F6E9;
  --color-warning: #8A5300;
  --color-warning-soft: #FFF5DF;
  --color-error: #B42332;
  --color-error-soft: #FFE6E9;
  --color-info: #1054B3;
  --color-info-soft: #E2F0FF;
  --color-interview: #6F35B5;
  --color-interview-soft: #F0E7FF;
  --color-resume: #087B61;
  --color-resume-soft: #E0F7F1;
  --color-disabled: #E8EDF3;
  --color-progress-track: #E2E9F1;

  /* radius: DESIGN.md sm 4 / md 8 / lg 12 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* layout */
  --spacing-sidebar: 232px;
  --spacing-header: 56px;
  --container-content: 1440px;

  /* type scale (DESIGN.md typography) */
  --text-display: 36px;      --text-display--line-height: 1.2;
  --text-page-title: 28px;   --text-page-title--line-height: 1.25;
  --text-section-title: 20px;--text-section-title--line-height: 1.3;
  --text-card-title: 18px;   --text-card-title--line-height: 1.35;
  --text-body-lg: 16px;      --text-body-lg--line-height: 1.5;
  --text-body: 14px;         --text-body--line-height: 1.5;
  --text-body-sm: 13px;      --text-body-sm--line-height: 1.5;
  --text-label-sm: 12px;     --text-label-sm--line-height: 1.4;
  --text-caption: 12px;      --text-caption--line-height: 1.5;
  --text-metric: 32px;       --text-metric--line-height: 1.15;
}

:root {
  --radius: 8px;
  --background: #F5F8FC;
  --foreground: #24364B;
  --card: #FFFFFF;
  --card-foreground: #24364B;
  --popover: #FFFFFF;
  --popover-foreground: #24364B;
  --primary: #1464D2;
  --primary-foreground: #FFFFFF;
  --secondary: #FFFFFF;          /* secondary button = white fill, blue label (§3) */
  --secondary-foreground: #1464D2;
  --muted: #F0F4F9;
  --muted-foreground: #52647A;
  --accent: #F0F8FF;
  --accent-foreground: #112B49;
  --destructive: #B42332;
  --border: #D7E2EE;
  --input: #71839A;              /* visible control boundary (3.88:1) */
  --ring: #1464D2;
  --sidebar: #112B49;
  --sidebar-foreground: #FFFFFF;
  --sidebar-primary: #1464D2;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #1E3A59;
  --sidebar-accent-foreground: #FFFFFF;
  --sidebar-border: #1E3A59;
  --sidebar-ring: #FFFFFF;       /* white focus ring on the navy rail */
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-text font-sans text-body antialiased; }
  h1, h2, h3, h4 { @apply text-heading; }
  .tabular { font-feature-settings: "tnum" 1; }
}
```

Usage: `text-page-title font-bold`, `bg-nav`, `text-resume bg-resume-soft`, `rounded-sm`, `w-sidebar`, `h-header`, `max-w-content`.

---

## 3. shadcn components → design components

Add with `pnpm dlx shadcn@latest add <name>`; theme once, then reuse.

| Design component | shadcn component | Theming rule |
|---|---|---|
| button-primary / secondary / danger / link | `button` | default height **44px** (`h-11 px-4`), `rounded-sm`, `font-semibold`; variants: `default` = primary (`hover:bg-primary-hover active:bg-primary-pressed`), `secondary` = white + blue label + `border border-primary`, `destructive` = outline red (solid red only in the final confirm dialog), `link`; loading state keeps width + spinner + action label |
| input / textarea / select | `input`, `textarea`, `select`, `label`, `field` (react-hook-form) | `h-11 rounded-sm border-input`; textarea min-height 112px; applicant portal uses `text-body-lg` (16px) |
| checkbox / radio | `checkbox`, `radio-group` | 20px visual box in a 44px hit area |
| tabs (experience groups, pool, documents) | `tabs` | muted labels, `text-primary` active, 2px underline indicator |
| table | `table` (+ TanStack Table in `DataTable`) | header `bg-surface-subtle text-label-sm h-10`, rows `h-12`, hover `bg-surface-blue`, actions in last column |
| card / metric tile | `card` | `rounded-md border p-6`, no shadow |
| dialog (560–640px; 720–880px for endorsement table) | `dialog`, `alert-dialog` (destructive confirm) | `rounded-lg p-6`, shadow `0 16px 48px rgba(17,43,73,.24)`, overlay `#112B4980` |
| right drawer (420–480px) | `sheet` (`side="right"`) | company detail, schedule interview, applicant review |
| tooltip | `tooltip` | `bg-nav text-white text-caption rounded-sm` |
| toast | `sonner` | white, semantic icon; errors persist; success ~6 s |
| badge | `badge` | `rounded-sm px-1 text-label-sm` + tone classes (§4.1) |
| sidebar | `sidebar` | `bg-nav w-sidebar`; active item `bg-primary`; hover `bg-nav-hover`; Log out pinned to the bottom |
| file upload | `FileDropzone` (shared, built on `input type=file`) | PDF only, ≤ 10 MB message shown, upload/failed/complete states |
| pagination | `pagination` | range + total + page controls |
| skeleton | `skeleton` | list loading |
| calendar / date-time | `calendar` + `popover` | interview scheduling |

---

## 4. Shared components (`components/shared/`)

| Component | Purpose |
|---|---|
| `PageHeader` | title (`text-page-title`), supporting sentence, right-side actions |
| `StatusBadge` | `<StatusBadge kind="application" value={status} audience="hr|applicant" />` → label + tone from `@vera/shared` |
| `ScoreChip` / `ScoreBar` | resume (teal), interview (purple), final (blue); numeric % always visible; `null` → "Not evaluated" |
| `ScoreBreakdownDialog` | View matching details: matched/missing skills, per-requirement similarity and credit, interview ratings × weights, final formula with the same rounded numbers (ALGORITHM.md §4). Title "Score breakdown: {name}" only: no "Rank N" line or text under it (decision 24, Oct 19); the rank is the ranking table's column |
| `MetricTile` | dashboard total (`text-metric tabular`), optional link to the filtered list |
| `DataTable` | TanStack Table + shadcn table, sorting, pagination, empty/no-match states |
| `EmptyState` | icon, message, primary action ("Add company", "Upload resume") |
| `ConfirmDialog` | names the record and the consequence |
| `FileDropzone`, `FileRow` | uploads and document rows (type, filename, size, uploaded at, status, actions) |
| `DocumentViewer` | PDF preview ⅔ + metadata/actions ⅓ (Mark as verified, Request new copy) |
| `Timeline` | application status history (from `application_status_history`) |
| `DeadlineHint` | "Respond by Oct 9, 5:00 PM (3 days left)" |

### 4.1 Status tones

Tone classes: success `bg-success-soft text-success` · warning `bg-warning-soft text-warning` · error `bg-error-soft text-error` · info `bg-info-soft text-info` · interview `bg-interview-soft text-interview` · neutral `bg-surface-subtle text-muted-foreground`.

| Application status | HR label | Applicant label (APP_FLOW §6) | Tone |
|---|---|---|---|
| prescreen_failed | Prescreen failed | Not qualified | error |
| below_threshold | Below threshold | Not shortlisted | neutral |
| waiting_pool | Waiting pool | Application received | neutral |
| shortlisted | Screening | Under review | info |
| interview_scheduled | For interview | Interview scheduled | warning |
| interview_confirmed | Interview confirmed | Interview confirmed | interview |
| did_not_pass | Did not pass | Not selected (kept in applicant pool) | error |
| passed | Passed | Under final review | success |
| passed_awaiting_confirmation | Awaiting confirmation | Passed — confirm endorsement | warning |
| for_endorsement | For endorsement | For client interview | info |
| endorsed | Endorsed | For client interview | info |
| final_interview_scheduled *(Phase 2)* | Final interview | Final interview scheduled | interview |
| for_hiring *(Phase 2)* | For hiring | For hiring | info |
| hired | Hired | Hired | success |
| not_hired | Not hired | Kept in applicant pool | error |
| training_failed | Training failed | Kept in applicant pool | error |
| standby | Standby | Kept in applicant pool | neutral |
| terminated | Terminated | Closed (you continued with another job) — old rows only: confirming an interview does not touch any other application, because an applicant has at most one ongoing application (BR-17) | neutral |
| dropped | Dropped | Closed (no response) | neutral |
| archived | Archived | Closed (endorsement declined) | neutral |
| not_selected | Not selected | Not selected (kept in applicant pool) | neutral |

While the applicant has an ongoing or hired application, the job list and job detail show an info notice ("You have an ongoing application for {job}. You can apply to another job once it is finished.") and Apply is disabled (BR-17). Every final status except hired shows the next action "You can apply to other jobs".

Documents: pending "For verification" (warning) · verified "Verified" (success, check icon) · rejected "Rejected" (error) · reupload_requested "Reupload required" (warning + reason).
Vacancy: draft (neutral) · open "Active" (success) · closed (neutral) · endorsing (info) · filled (success) · archived (neutral).
Interview: pending_confirmation "Awaiting confirmation" (warning) · confirmed "Scheduled" (info) · completed (success) · no_show / expired (error) · cancelled / rescheduled (neutral).

Labels live in `packages/shared/src/labels.js` (`@vera/shared`); components never hard-code them. Applicant labels match APP_FLOW §6 exactly; the UI says "applicant pool" (`talent_pool` is only the DB name).

---

## 5. Shell and navigation

- Sidebar 232px navy (`bg-nav`), emblem ~80px + "VERA" at top, destinations, Log out at the bottom (red exit icon, readable label; same wording as the header menu); scrolls on short screens.
- Header 56px white: page context left; notification bell (real unread count), avatar initials, name + role, account menu right.
- Main: `p-6`, panel gaps 24px, `max-w-content`. Detail pages keep the parent nav item active.

**HR / Admin navigation (reconciled)**

| # | Label | Route | Note |
|---|---|---|---|
| 1 | Dashboard | `/admin` | |
| 2 | Company List | `/admin/companies` | page heading "Company Management" |
| 3 | Job Vacancies | `/admin/vacancies` | |
| 4 | Applicant Management | `/admin/applicants` | |
| 5 | Resume Screening | `/admin/screening` | |
| 6 | Interview Assessment | `/admin/interviews` | Oct 19: singular, matching the list and evaluation page titles (the mockup's "Interviews Assessment" is no longer used) |
| 7 | Endorsement Management | `/admin/endorsements` | includes client outcomes + post-hiring (§9) |
| 8 | Applicant Pool | `/admin/talent-pool` | DB name `talent_pool` |
| 9 | Recruitment Reports | `/admin/reports` | optional (ROADMAP P9.6). *Decision 34: in the sidebar as the **last** item for HR and admin (icon `BarChart3`); a sample-data preview* |
| — | Settings | `/admin/settings` | below a divider |
| — | User Management · Competencies | `/admin/users` · `/admin/competencies` | **admin only**, below a divider |

**Sprint scope (ROADMAP §6):** Settings, Recruitment Reports, User Management, and Competencies are deferred, so they are not in the sidebar yet (`apps/web/src/layouts/navigation.js`). *(Since then: User Management is built (decision 19, admin only) and Recruitment Reports is in the sidebar as a sample-data preview (decision 34); Settings and Competencies stay out.)* The login page hides Google sign-in and Forgot password until they are built. The bell has no count until notifications exist (S11).

**Applicant navigation:** My Profile (`/applicant` — the dashboard: profile card, status panel, upcoming interview, notifications) · Job Vacancies · My Documents.

Responsive (DESIGN.md Layout): ≥1200 full sidebar; 768–1199 sidebar becomes a `sheet` drawer; <768 single column, 16px padding, tables scroll inside their container.

---

## 6. Page → mockup map

| Route | Mockup | Build notes |
|---|---|---|
| `/login` | HR p.1 | 58/42 split; Montserrat only for the brand tagline; add **Create account** link (applicant sign-up) in place of "Contact your administrator" for applicants |
| `/signup`, `/signup/verify`, `/forgot-password`, `/reset-password` | — (not in mockups) | reuse the login card layout; 6-box OTP input (`input-otp`) |
| `/admin` | HR p.2 | 6 tiles: Total applicants, Waiting pool, For screening, For interview, For endorsement, Hired (+ active vacancies in header or 7th tile); upcoming interviews table |
| `/admin/companies` | HR pp.3–5 | table + Add company dialog + detail `sheet`; add **Website** field |
| `/admin/vacancies` (+new, :id) | HR pp.6–8 | 3-col cards; form groups Company & Position · Job Description · Key Responsibilities · Qualifications (prescreen) · **Pipeline settings** (slots, cap, endorsement count, threshold, passing score — new group) · Competency weights = the 3 Competency Profile **sections** (A/B/C, items listed under each; live total, must be 100%, 0% allowed) |
| `/admin/vacancies/:id` ranking | HR pp.9–11 | ranking table with ScoreChips; Notify dialog; Matching Details dialog with worked calculation. *Decision 32: the Notify dialog adds the shared `FinalInterviewFields` (fieldset "Final interview with the client (Philippine time)": Date, Time, "Location and details (no company name)"; all required, errors under the fields); the hint says the final interview and the confirm-by line are added automatically. Decision 33: a last column (header "Endorsement packet", screen-reader only) shows a secondary **Download** button (`PacketButton`, aria-label "Download {name}'s endorsement packet", spinner while pending, errors as a toast) on rows that passed and are in `PACKET_STATUSES`* |
| `/admin/users` *(Phase 4, decision 19)* | — | admin only (nav item hidden from HR): staff table (name + email, role, Active/Inactive badge, last sign-in), **Add HR account** dialog (Email, Full name, Password, Confirm password; "Passwords do not match" under the confirm field), **Edit** dialog on every row (decision 22, Oct 19: title "Edit {name}", the email as text, Full name, New password + Confirm new password, "Leave blank to keep the current password"; only changed fields are sent; "Nothing to change." when none), Deactivate / Activate confirm; your own row has Edit only |
| `/admin/applicants` (+:id) | HR pp.12–13 | stage tiles, table, documents with download + ZIP; add status timeline |
| `/admin/screening` (+:vacancyId) | HR pp.14–15 | vacancy list → tabs *Applicants with Work Experience* / *First-Time Job Seekers*; **no Run Resume Screening button** (shortlist is automatic; show "Shortlist updates automatically" caption + last refreshed time) |
| `/admin/screening/:vacancyId/:applicationId` | HR pp.16–17 | DocumentViewer; Mark as verified; Request new copy (reason required, shows deadline) |
| schedule interview `sheet` | HR p.18 | date, time, duration, meeting link, interviewer; reminders are automatic (24 h) — show as info text, not toggles. *Sprint (S13): a `dialog` over the review sheet (also used for **Edit time** on `/admin/interviews`); date + time inputs in Philippine time (sent as +08:00) instead of `calendar` + `popover`; no reminder text, because reminders are deferred (ROADMAP §6)* |
| `/admin/interviews` (+:vacancyId) | HR pp.19–20 | combined list; evaluation page (decision 13): rubric 60% on the left + applicant card 40% on the right (summary, 3 score slots, View resume, Save evaluation; on phones below the rubric); rubric = the **Competency Profile**: all 15 items rated 1–5, grouped by section A/B/C with the section weight shown, the five rating interpretations once per section as column headers aligned with the 1–5 columns, each row showing only the number and the radio (decision 23, Oct 19, replaces the text on each choice; every radio keeps "{interpretation} {n}" as its accessible name; phones hide the headers and show the compact "Rating scale" key), live section %, interview score, and overall rating of probability of success (S14) |
| `/admin/endorsements` (+:vacancyId) | HR pp.21–22 | vacancy rows → confirmed candidates; Generate form, Send to company, Download (single/bulk); tabs **Outcomes** (Hired / Not hired) and **Post-hiring** (details form, training failed). *Decision 32: the **Create endorsement** confirm has the same `FinalInterviewFields` (empty, required). A 409 `FINAL_INTERVIEW_CHANGED` shows a warning box (`bg-warning-soft`, not the red error) naming the applicants who were told another time; the confirm button becomes "Create and send 'time changed'"; editing the schedule clears the warning. Decision 33: no Download packet on the Outcomes rows (it is on the Ranking tab)* |
| `/admin/talent-pool` | HR pp.23–24 | tabs **Waiting** (available) · **Invited**; history dialog = Timeline; Invite to vacancy. *Phase 3 (decision 18; PRD wins): tabs **Waiting** · **Returned by Client** (by pool reason, `POOL_TABS`), column "Latest offer or invitation" with a kind badge, per-tab empty states; no manual invite. The vacancy detail gains a **Pool invitations** tab (run summary, Run pool matching again, invitation table).* |
| `/admin/reports` | HR p.31 | optional; charts from real data; PDF/Excel export only if implemented. *Decision 34 (Oct 20): a placeholder with **sample data** and no API: `PageHeader` with **Export PDF** / **Export Excel** (*owner change Oct 20: enabled, normal secondary look, inactive: no request, navigation, download, or toast; no "Coming soon" and no banner*), 4 `MetricTile`s, two chart cards drawn in HTML/CSS (no chart library): **Recruitment pipeline** (horizontal bars, one hue `#1464D2`, direct value labels) and **Hiring outcomes** (one stacked bar, fixed categorical order `#1464D2` / `#eb6834` / `#1baf7a` with 2px gaps and a legend naming each value; checked with the dataviz palette validator), each mark focusable with a hover/focus tooltip; then a **Vacancy performance** `DataTable` (the table view of the same numbers)* |
| `/applicant` | Applicant p.1 | 60/40: profile card · status panel + upcoming interview + notifications. *Decision 31: the profile card header has the initials avatar (first + last name, `bg-nav`), then a disabled secondary **Upload photo** button (camera icon) with "Coming soon" under it (`aria-describedby`); no file input. My Profile only (the header account menu is unchanged)* |
| `/applicant/setup` | — | dropzone → parsing state → profile card in edit mode → Confirm profile |
| `/applicant/jobs` (+:id) | Applicant pp.2–3 | 2-col cards, no company; detail with Apply |
| Apply dialog | Applicant p.4 → **replaced** | radio group *First-time job seeker* / *Experienced* + optional "Attach documents to this application?" checklist of current documents (none checked, Select all; decision 16) + Submit application |
| `/applicant/documents` | Applicant pp.5–6 | Resume tab (one file; **Re-upload** opens Replace resume, allowed during active applications, decision 16) · Supporting documents tab · Requests list. **Upload document** dialog (decisions 29–30): title, **Document type** select with only Certificate · Diploma · Other, name field for Certificate/Other, `FileDropzone` ("PDF only, up to 10 MB."); no description line. HR's **Request a document** select lists the same three |

---

## 7. Copy rules

- Sentence case everywhere except proper nav labels. Buttons say exactly what happens and keep the same verb in the toast: *Publish vacancy* → "Vacancy published".
- Key action names: Upload resume · Confirm profile · Submit application · Mark as verified · Request new copy · Schedule interview · Confirm attendance · Request reschedule · Save evaluation · Notify applicant · Confirm endorsement · Generate endorsement form · Send to company · Mark as hired · Mark as not hired · Send post-hiring details · Invite to vacancy.
- Errors say what happened and how to fix it: "This PDF has no selectable text. Upload a text-based PDF (not a scanned image)."
- Deadlines always show date, time, and time zone (Asia/Manila) plus days left.
- Never show a score without its label and %; never show 0 for an interview that did not happen.

---

## 8. Quality checklist per screen

- [ ] Loading, empty, no-match, error, and success states.
- [ ] Keyboard: focus visible (blue ring; white on the navy rail), dialogs trap focus and return it.
- [ ] Inputs keep values after a failed submit; errors are next to the field.
- [ ] Applicant/job/company context visible in every review dialog and drawer.
- [ ] Readable at 360, 768, 1024, 1440 px and 200% zoom; tables scroll inside their own container.
- [ ] Score values identical in ranking, matching details, and evaluation views.
- [ ] No company information on applicant screens.

---

## 9. Reconciliation: mockups vs agreed process

| Mockup / DESIGN.md | Agreed (PRD) — build this |
|---|---|
| "Run Resume Screening" button (HR p.15) | Removed; shortlist (2 × slots per group) refreshes automatically |
| Apply dialog selects documents (Applicant p.4) | Radio button for applicant type; stored resume is used. *(Decision 16: an optional checklist of the applicant's current supporting documents is back; the resume is never chosen.)* |
| Interview rubric separate from vacancy competency weights; scores 0–100 | Superseded by S9b (next row) |
| Rubric criteria (Communication Skills, Technical Knowledge, Attitude and Behavior, Analytical Thinking, Overall Impression); 6 flat competencies in the vacancy form | **Competency Profile** (the agency's form): 3 sections / 15 items, every item rated 1–5 in every interview; the vacancy weights the **3 sections** (total 100%, 0% allowed); interview = two-level WSM (ALGORITHM.md §4 WSM-01); plus an informational overall rating of probability of success (WSM-02). *(S9b, decided Oct 7, 2026)* |
| 50/50 final formula marked "proposed" | Confirmed: final = (matching + interview) / 2 |
| Applicant Pool tabs Waiting / Final Interview / On Training | Applicant Pool = talent pool (Waiting, Invited). Final (client) interview and training are tracked in Endorsement Management as outcomes and post-hiring details; client interview scheduling stays outside VERA (optional date field only) |
| Final-interview scheduling drawer (address, person to look for) | Not built (client handles it); HR records the outcome |
| Training invitation form | Post-hiring details form (training schedule, pre-employment requirements, orientation, deployment) |
| Recruitment Reports page | Optional, after all PRD requirements (P9.6). *Decision 34: a sample-data preview (banner, disabled exports) until real reports are built* |
| Company form has Website | Added (`company.website`) |
| My Profile shows age and birthday | Age is computed from birthday (read-only) |
| Age/gender in vacancy qualifications "policy undecided" | Used only as HR-set prescreen conditions; never in any score |
| Applicant job detail lists age range and gender | **Not shown on any applicant screen** (and not returned by the applicant API). RA 10911 (Anti-Age Discrimination in Employment Act) prohibits publishing job notices that state age preferences; gender preferences in job ads raise similar anti-discrimination concerns. Both are still enforced at apply time (prescreen) and the `prescreen_failed` notification names the unmet condition (FR-APP-03). Applicants see required skills, minimum years of experience, minimum education, and minimum height (when set). *(decided Oct 7, 2026)* |
| No registration/recovery screens | Built per APP_FLOW §2 using the login card layout |
| Notify Applicant = availability message | Notify = "passed, confirm endorsement" with editable text and a 3-day deadline; *decision 32:* plus the client's final interview (date, time, details), which the applicant's **Confirm your endorsement** pop-up shows ("Message from the agency (with your final interview)") |
