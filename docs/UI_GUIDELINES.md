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
| sidebar | `sidebar` | `bg-nav w-sidebar`; active item `bg-primary`; hover `bg-nav-hover`; Log Out pinned to the bottom |
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
| `ScoreBreakdownDialog` | View matching details: matched/missing skills, per-requirement similarity and credit, interview ratings × weights, final formula with the same rounded numbers (ALGORITHM.md §4) |
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
| hired | Hired | Hired | success |
| not_hired | Not hired | Kept in applicant pool | error |
| training_failed | Training failed | Kept in applicant pool | error |
| standby | Standby | Kept in applicant pool | neutral |
| terminated | Terminated | Closed (you continued with another job) | neutral |
| dropped | Dropped | Closed (no response) | neutral |
| archived | Archived | Closed (endorsement declined) | neutral |

Documents: pending "For verification" (warning) · verified "Verified" (success, check icon) · rejected "Rejected" (error) · reupload_requested "Reupload required" (warning + reason).
Vacancy: draft (neutral) · open "Active" (success) · closed (neutral) · endorsing (info) · filled (success) · archived (neutral).
Interview: pending_confirmation "Awaiting confirmation" (warning) · confirmed "Scheduled" (info) · completed (success) · no_show / expired (error) · cancelled / rescheduled (neutral).

Labels live in `packages/shared/src/labels.js` (`@vera/shared`); components never hard-code them. Applicant labels match APP_FLOW §6 exactly; the UI says "applicant pool" (`talent_pool` is only the DB name).

---

## 5. Shell and navigation

- Sidebar 232px navy (`bg-nav`), emblem ~80px + "VERA" at top, destinations, Log Out at the bottom (red exit icon, readable label); scrolls on short screens.
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
| 6 | Interviews Assessment | `/admin/interviews` | keep the source label |
| 7 | Endorsement Management | `/admin/endorsements` | includes client outcomes + post-hiring (§9) |
| 8 | Applicant Pool | `/admin/talent-pool` | DB name `talent_pool` |
| 9 | Recruitment Reports | `/admin/reports` | optional (ROADMAP P9.6) |
| — | Settings | `/admin/settings` | below a divider |
| — | User Management · Competencies | `/admin/users` · `/admin/competencies` | **admin only**, below a divider |

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
| `/admin/vacancies` (+new, :id) | HR pp.6–8 | 3-col cards; form groups Company & Position · Job Description · Key Responsibilities · Qualifications (prescreen) · **Pipeline settings** (slots, cap, endorsement count, threshold, passing score — new group) · Competency Weights (live total, must be 100%) |
| `/admin/vacancies/:id` ranking | HR pp.9–11 | ranking table with ScoreChips; Notify dialog; Matching Details dialog with worked calculation |
| `/admin/applicants` (+:id) | HR pp.12–13 | stage tiles, table, documents with download + ZIP; add status timeline |
| `/admin/screening` (+:vacancyId) | HR pp.14–15 | vacancy list → tabs *Applicants with Work Experience* / *First-Time Job Seekers*; **no Run Resume Screening button** (shortlist is automatic; show "Shortlist updates automatically" caption + last refreshed time) |
| `/admin/screening/:vacancyId/:applicationId` | HR pp.16–17 | DocumentViewer; Mark as verified; Request new copy (reason required, shows deadline) |
| schedule interview `sheet` | HR p.18 | date, time, duration, meeting link, interviewer; reminders are automatic (24 h) — show as info text, not toggles |
| `/admin/interviews` (+:vacancyId) | HR pp.19–20 | combined list; evaluation page: applicant summary + 3 score slots, resume/notes 40% + rubric 60%; rubric = vacancy's weighted competencies **rated 1–5** (all active competencies listed; weighted ones first) |
| `/admin/endorsements` (+:vacancyId) | HR pp.21–22 | vacancy rows → confirmed candidates; Generate form, Send to company, Download (single/bulk); tabs **Outcomes** (Hired / Not hired) and **Post-hiring** (details form, training failed) |
| `/admin/talent-pool` | HR pp.23–24 | tabs **Waiting** (available) · **Invited**; history dialog = Timeline; Invite to vacancy |
| `/admin/reports` | HR p.31 | optional; charts from real data; PDF/Excel export only if implemented |
| `/applicant` | Applicant p.1 | 60/40: profile card · status panel + upcoming interview + notifications |
| `/applicant/setup` | — | dropzone → parsing state → profile card in edit mode → Confirm profile |
| `/applicant/jobs` (+:id) | Applicant pp.2–3 | 2-col cards, no company; detail with Apply |
| Apply dialog | Applicant p.4 → **replaced** | radio group *First-time job seeker* / *Experienced* + Submit application (no document selection) |
| `/applicant/documents` | Applicant pp.5–6 | Resume tab (one file, Replace resume — disabled with reason during active applications) · Supporting documents tab · Requests list |

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
| Apply dialog selects documents (Applicant p.4) | Radio button for applicant type only; stored resume is used |
| Interview rubric separate from vacancy competency weights; scores 0–100 | The vacancy's weighted competencies **are** the rubric; ratings 1–5; interview = Σ w·r/5 |
| Rubric criteria (Communication Skills, Technical Knowledge, Attitude and Behavior, Analytical Thinking, Overall Impression) | Fixed competency list managed by the admin; seeded from the vacancy-form list in the mockup: Communication, Problem Solving, Work Experience, Technical Skills, Teamwork, Adaptability |
| 50/50 final formula marked "proposed" | Confirmed: final = (matching + interview) / 2 |
| Applicant Pool tabs Waiting / Final Interview / On Training | Applicant Pool = talent pool (Waiting, Invited). Final (client) interview and training are tracked in Endorsement Management as outcomes and post-hiring details; client interview scheduling stays outside VERA (optional date field only) |
| Final-interview scheduling drawer (address, person to look for) | Not built (client handles it); HR records the outcome |
| Training invitation form | Post-hiring details form (training schedule, pre-employment requirements, orientation, deployment) |
| Recruitment Reports page | Optional, after all PRD requirements (P9.6) |
| Company form has Website | Added (`company.website`) |
| My Profile shows age and birthday | Age is computed from birthday (read-only) |
| Age/gender in vacancy qualifications "policy undecided" | Used only as HR-set prescreen conditions; never in any score |
| No registration/recovery screens | Built per APP_FLOW §2 using the login card layout |
| Notify Applicant = availability message | Notify = "passed, confirm endorsement" with editable text and a 3-day deadline |
