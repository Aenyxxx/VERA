---
version: alpha
name: VERA Recruitment Design System
description: Shared visual system for the Confiable Manpower Solutions Inc. HR workspace
  and applicant portal, derived from 37 supplied PDF mockup pages.
colors:
  primary: '#1464D2'
  primary-hover: '#1054B3'
  primary-pressed: '#0D4594'
  primary-soft: '#E2F0FF'
  on-primary: '#FFFFFF'
  nav: '#112B49'
  nav-hover: '#1E3A59'
  nav-active: '#1464D2'
  on-nav: '#FFFFFF'
  brand-yellow: '#FEDE20'
  background: '#F5F8FC'
  surface: '#FFFFFF'
  surface-subtle: '#F0F4F9'
  surface-blue: '#F0F8FF'
  heading: '#112B49'
  text: '#24364B'
  text-muted: '#52647A'
  border: '#D7E2EE'
  control-border: '#71839A'
  focus: '#1464D2'
  success: '#137A43'
  success-soft: '#E3F6E9'
  warning: '#8A5300'
  warning-soft: '#FFF5DF'
  error: '#B42332'
  error-soft: '#FFE6E9'
  info: '#1054B3'
  info-soft: '#E2F0FF'
  interview: '#6F35B5'
  interview-soft: '#F0E7FF'
  resume: '#087B61'
  resume-soft: '#E0F7F1'
  disabled: '#E8EDF3'
  on-disabled: '#52647A'
  overlay: '#112B4980'
  progress-track: '#E2E9F1'
typography:
  display:
    fontFamily: Roboto
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0em
  page-title:
    fontFamily: Roboto
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: 0em
  section-title:
    fontFamily: Roboto
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0em
  card-title:
    fontFamily: Roboto
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: 0em
  body-lg:
    fontFamily: Roboto
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  body:
    fontFamily: Roboto
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  body-sm:
    fontFamily: Roboto
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  label:
    fontFamily: Roboto
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0em
  label-sm:
    fontFamily: Roboto
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0em
  caption:
    fontFamily: Roboto
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  metric:
    fontFamily: Roboto
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: 0em
    fontFeature: '"tnum" 1'
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  sidebar: 232px
  header: 56px
  content-max: 1440px
  gutter: 24px
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    height: 44px
    padding: 12px
  button-primary-hover:
    backgroundColor: '{colors.primary-hover}'
    textColor: '{colors.on-primary}'
  button-primary-pressed:
    backgroundColor: '{colors.primary-pressed}'
    textColor: '{colors.on-primary}'
  button-disabled:
    backgroundColor: '{colors.disabled}'
    textColor: '{colors.on-disabled}'
  button-secondary:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.primary}'
    rounded: '{rounded.sm}'
    height: 44px
  button-danger:
    backgroundColor: '{colors.error}'
    textColor: '{colors.on-primary}'
    rounded: '{rounded.sm}'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    height: 44px
    padding: 12px
  sidebar:
    backgroundColor: '{colors.nav}'
    textColor: '{colors.on-nav}'
    width: '{spacing.sidebar}'
  nav-item:
    textColor: '{colors.on-nav}'
    rounded: '{rounded.sm}'
    height: 44px
    padding: 12px
  nav-item-active:
    backgroundColor: '{colors.nav-active}'
    textColor: '{colors.on-nav}'
  header:
    backgroundColor: '{colors.surface}'
    height: '{spacing.header}'
  card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.md}'
    padding: '{spacing.lg}'
  table-header:
    backgroundColor: '{colors.surface-subtle}'
    textColor: '{colors.heading}'
    typography: '{typography.label-sm}'
    height: 40px
  table-row:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    typography: '{typography.body}'
    height: 48px
  table-row-hover:
    backgroundColor: '{colors.surface-blue}'
  badge-success:
    backgroundColor: '{colors.success-soft}'
    textColor: '{colors.success}'
    typography: '{typography.label-sm}'
    rounded: '{rounded.sm}'
    padding: 4px
  badge-warning:
    backgroundColor: '{colors.warning-soft}'
    textColor: '{colors.warning}'
    typography: '{typography.label-sm}'
    rounded: '{rounded.sm}'
    padding: 4px
  badge-error:
    backgroundColor: '{colors.error-soft}'
    textColor: '{colors.error}'
    typography: '{typography.label-sm}'
    rounded: '{rounded.sm}'
    padding: 4px
  badge-info:
    backgroundColor: '{colors.info-soft}'
    textColor: '{colors.info}'
    typography: '{typography.label-sm}'
    rounded: '{rounded.sm}'
    padding: 4px
  badge-interview:
    backgroundColor: '{colors.interview-soft}'
    textColor: '{colors.interview}'
    typography: '{typography.label-sm}'
    rounded: '{rounded.sm}'
    padding: 4px
  badge-neutral:
    backgroundColor: '{colors.surface-subtle}'
    textColor: '{colors.text-muted}'
    typography: '{typography.label-sm}'
    rounded: '{rounded.sm}'
    padding: 4px
  tabs:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text-muted}'
    typography: '{typography.label}'
    height: 44px
  tab-active:
    textColor: '{colors.primary}'
  dialog:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.lg}'
    padding: '{spacing.lg}'
    width: 640px
  drawer:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    width: 480px
    padding: '{spacing.lg}'
  tooltip:
    backgroundColor: '{colors.nav}'
    textColor: '{colors.on-nav}'
    typography: '{typography.caption}'
    rounded: '{rounded.sm}'
    padding: 8px
  toast:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.md}'
    padding: 16px
  file-row:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.sm}'
    padding: 16px
  score-resume:
    backgroundColor: '{colors.resume-soft}'
    textColor: '{colors.resume}'
    typography: '{typography.metric}'
  score-interview:
    backgroundColor: '{colors.interview-soft}'
    textColor: '{colors.interview}'
    typography: '{typography.metric}'
  score-final:
    backgroundColor: '{colors.info-soft}'
    textColor: '{colors.info}'
    typography: '{typography.metric}'
---

# VERA Design System

## Overview

VERA, **Verified Evaluation and Recruitment Assistant**, is the recruitment interface for **Confiable Manpower Solutions Inc.** This system covers two related desktop web experiences: an operational HR workspace and an applicant self-service portal. Both use the same brand, navigation shell, control language, and feedback patterns. Their information density and available actions differ by role.

The visual character is professional, direct, and approachable. A dark navy navigation rail anchors the interface. Bright blue identifies actions and selected destinations. White panels and pale blue-gray backgrounds support document review, scheduling, and structured records. The yellow-and-navy Confiable emblem supplies the strongest brand detail. The result should feel like a dependable recruitment office, with applicant identities, job details, and next actions easy to locate.

### Source basis and interpretation

This document is based on visual review of every page in **HR SIDE LATEST V3.pdf** (31 pages) and **applicant side v2.pdf** (6 pages). References such as **HR p. 20** and **Applicant p. 4** refer to their one-based PDF page numbers. The original canvases are approximately 1254 × 706 points. Most interior content is embedded imagery; extracted PDF text alone does not describe the screens fully.

Format reference: [Google Labs DESIGN.md specification](https://github.com/google-labs-code/design.md/blob/main/docs/spec.md), reviewed October 6, 2026. The file uses YAML front matter for tokens and the eight prescribed Markdown sections. Component token maps contain string values or token references. Additional interaction details belong in the prose.

**Evidence levels:** “Observed” means visible in the supplied screens. “Standardized” means a deliberate implementation value chosen here to make inconsistent mockups coherent. “Proposed” means a completion rule for behavior or layouts the PDFs do not show. All front-matter tokens are normative for this design specification, but they are not claimed to be an exact export of the original design files. The navy `#112B49`, yellow `#FEDE20`, and dashboard background `#F5F8FC` have direct raster/vector evidence. Other colors, measurements, and text styles are standardized approximations or accessibility refinements.

Observed typography metadata includes Roboto Regular/Bold and Montserrat variants on the login composition. The font within every rasterized panel cannot be established from PDF metadata. Roboto is therefore the standardized application typeface; Montserrat is retained only for the login's brand messaging when editable artwork is available.

### Design priorities

- Keep each applicant's name, position, company, and current stage visible during review.
- Distinguish document verification, resume matching, interview assessment, availability, and hiring outcomes. These are separate concepts.
- Make dense HR tables scannable without compressing text into screenshot-sized labels.
- Give applicants plain actions: update a profile, upload a document, review a vacancy, and submit an application.
- Preserve the role-specific navigation and workflows shown in the PDFs. Do not import AlgoViu branding or learning-app features into VERA.
- Treat mockup names, company logos, dates, counts, credentials, and scores as illustrative source content, not verified live records.

### Screen inventory and composition

| Reference | Observed screen or state | Defining content and actions |
| --- | --- | --- |
| HR p. 1 | Login | Construction photograph and Confiable branding at left; email/password login card at right; remember me, password recovery, Google sign-in, administrator contact, legal/help links. |
| HR p. 2 | Dashboard | Six recruitment summary tiles and an upcoming-interviews table. |
| HR pp. 3–5 | Company management | Searchable company table, Add Company form, and Company Details right drawer. Company and contact-person information are grouped separately. |
| HR pp. 6–8 | Job vacancies | Three-column vacancy cards, Add Job Vacancy form, and vacancy detail page with hiring slots and competency weights. |
| HR pp. 9–11 | Candidate ranking | Ranked table with resume, interview, and final scores; Notify Applicant dialog; Matching Details dialog with evidence and a worked score calculation. |
| HR pp. 12–13 | Applicant management | Stage summary tiles, applicant table, and applicant document listing with download actions. |
| HR pp. 14–15 | Resume screening | Vacancy selector list, then applicant table with experience-group tabs, matching scores, document status, interview scheduling, and Run Resume Screening. |
| HR pp. 16–17 | Supporting documents | Certificate table, verification states, document preview, notes, Mark as Verified, and Request New Copy. |
| HR p. 18 | Schedule interview | Right drawer with date, time, meeting link, and optional reminders. |
| HR pp. 19–20 | Interviews Assessment / Interview Evaluation | Scheduled interview list; applicant summary; resume preview; notes; weighted interview rubric; Save and Submit Evaluation. |
| HR pp. 21–22 | Endorsement management | Vacancy rows and a modal listing confirmed candidates with individual/bulk download actions. |
| HR pp. 23–24 | Applicant pool: Waiting | Waiting list and applicant history dialog with previous application and dated timeline. |
| HR pp. 25–27 | Applicant pool: Final Interview | Candidate list before and after scheduling, final-interview scheduling drawer, and Update Status actions. |
| HR pp. 28–29 | Final-interview outcome and training invitation | For Training / Rejected outcome dialog, then training date, time, venue, details, reminders, and invitation action. |
| HR p. 30 | Applicant pool: On Training | Training-period table with View and Update Training Status actions. The update form itself is not shown. |
| HR p. 31 | Recruitment reports | Date/company filters, three metrics, pipeline bar chart, hiring-outcome donut, vacancy-performance table, PDF/Excel export actions. |
| Applicant p. 1 | My Profile | Personal and address fields at left; upcoming interview and recent notifications at right. |
| Applicant pp. 2–3 | Job vacancies and detail | Two-column vacancy cards; job description, qualifications, responsibilities, and Apply for this Job. |
| Applicant p. 4 | Apply dialog | Select previously uploaded documents, required resume, optional supporting files, selected count, and Submit. |
| Applicant pp. 5–6 | My Documents | Resume / Supporting Documents tabs, file metadata, reupload warnings, reupload and delete/remove actions. |

### Known inconsistencies and limits

| Source finding | Standardization or unresolved decision |
| --- | --- |
| Blue is used for nearly all body text in several screens. | Use navy headings and neutral body text. Reserve blue primarily for controls, links, and selected states. |
| The shell says Company List while the page says Company Management. | Keep Company List as the destination and Company Management as its page heading; both refer to the same module. |
| Interviews Assessment is the visible navigation label. | Retain it for source fidelity. A future copy revision may use Interview Assessments consistently, but do not mix both labels. |
| Waiting Applicant Pool appears in some PDF text layers; the visible current navigation says Applicant Pool. | Use Applicant Pool, with Waiting as a tab. |
| Applicant Pool tab ordering changes on HR p. 30. | Use Waiting, Final Interview, On Training in that order on every pool view. |
| HR p. 9 shows a first-row final score that differs from the 90% result in HR p. 11. | Render all score views from the same calculation and record. The displayed example is `(92 × 0.5) + (88 × 0.5) = 90`. |
| Vacancy competency weights and the interview rubric contain different criteria. | Keep them distinct. Do not silently reuse one weighting configuration for the other. |
| HR p. 31 shows a bar labeled 150 against an axis that tops out at 100. | Derive chart domains from the data so bars and axes agree. |
| Dashboard, reports, and other screens show different totals and example dates. | Treat them as separate mockup snapshots, not a reconciled dataset. |
| Footer expansions of VERA vary. | Use “VERA” in the compact footer and the login's full expansion where needed. Confirm any company-specific product subtitle before using it globally. |
| My Profile shows both age and birthday. | Proposed: derive age from birthday to avoid contradictory values. The final field policy needs product confirmation. |
| Age and gender appear in vacancy qualifications. | Record them as observed fields, not an approved screening or ranking rule. Their intended use and necessity remain product-policy decisions. |
| Applicant confirmation of availability, training outcomes, notification centers, recovery, and some edit forms are not shown. | Define shared presentation states here; do not invent their business rules or assert that these destinations already exist. |

## Colors

The core palette is navy, blue, and cool neutrals. Yellow belongs to the Confiable brand artwork and login accent. Green, amber, red, teal, and purple carry specific statuses or score-series meaning; they are not interchangeable decoration.

The source's pale page tints are retained as solid surfaces for reliable contrast. Do not reproduce screenshot compression artifacts, inconsistent blue hues, or accidental gradients in forms. A subtle tonal wave may remain at the foot of the sidebar because it is a repeated source motif; it must sit behind empty space and never reduce navigation legibility.

### Semantic color roles

| Token | Hex | Role |
| --- | --- | --- |
| `primary` | `#1464D2` | Primary buttons, links, selected tabs, active navigation. Standardized darker blue improves white-label contrast. |
| `primary-hover` / `primary-pressed` | `#1054B3` / `#0D4594` | Pointer and pressed action states. |
| `nav` | `#112B49` | Full-height navigation rail; source-derived navy. |
| `brand-yellow` | `#FEDE20` | Confiable emblem and login brand accent. Never body text on white. |
| `background` | `#F5F8FC` | Main application canvas. |
| `surface` | `#FFFFFF` | Cards, forms, dialogs, and drawers. |
| `surface-subtle` / `surface-blue` | `#F0F4F9` / `#F0F8FF` | Table headers, quiet grouping, and hover surfaces. |
| `heading` / `text` | `#112B49` / `#24364B` | Titles and ordinary content. |
| `text-muted` | `#52647A` | Secondary information, timestamps, and helper text. |
| `border` | `#D7E2EE` | Nonessential separators and card outlines. |
| `control-border` | `#71839A` | Input and selection boundaries that must remain visible. |
| `success` / `success-soft` | `#137A43` / `#E3F6E9` | Verified, confirmed, hired, or completed outcomes. |
| `warning` / `warning-soft` | `#8A5300` / `#FFF5DF` | Verification required, incomplete requirements, and reupload requests. |
| `error` / `error-soft` | `#B42332` / `#FFE6E9` | Validation errors, destructive actions, and unsuccessful outcomes. |
| `info` / `info-soft` | `#1054B3` / `#E2F0FF` | Scheduled or informational states and final-score presentation. |
| `interview` / `interview-soft` | `#6F35B5` / `#F0E7FF` | Interview score series. |
| `resume` / `resume-soft` | `#087B61` / `#E0F7F1` | Resume score series. |
| `disabled` / `on-disabled` | `#E8EDF3` / `#52647A` | Disabled controls with legible labels. |

### Contrast pairs

The following ratios are computed from the exact sRGB tokens in this file, rounded to two decimals. They assess these color pairs only, not full application accessibility. Normal text targets at least 4.5:1. Large text and essential non-text boundaries target at least 3:1. A thin card separator is not a substitute for a visible input boundary.

| Foreground / background | Ratio | Intended use |
| --- | --- | --- |
| `on-primary` / `primary` | 5.55:1 | Text. |
| `on-nav` / `nav` | 14.33:1 | Text. |
| `text` / `surface` | 12.32:1 | Text. |
| `text-muted` / `surface` | 6.06:1 | Text. |
| `text-muted` / `background` | 5.69:1 | Text. |
| `primary` / `surface` | 5.55:1 | Text. |
| `success` / `success-soft` | 4.78:1 | Text. |
| `warning` / `warning-soft` | 5.84:1 | Text. |
| `error` / `error-soft` | 5.50:1 | Text. |
| `interview` / `interview-soft` | 6.16:1 | Text. |
| `resume` / `resume-soft` | 4.67:1 | Text. |
| `on-disabled` / `disabled` | 5.15:1 | Text. |
| `control-border` / `surface` | 3.88:1 | Control boundary; non-text. |
| `nav` / `brand-yellow` | 10.70:1 | Text. |

The translucent overlay dims content behind a dialog and is not a text surface. Keep dialog text on opaque white. In score tables, give every bar a numeric percentage and a column label; color alone must not carry meaning.

## Typography

Use **Roboto** for application screens. It follows the recoverable PDF typography and supports compact forms and tables without an unfamiliar visual shift. Use `Roboto, Arial, sans-serif` as the application stack. Keep essential text in the DOM, not embedded in screenshots. Use the supplied Confiable/VERA artwork for brand marks; do not approximate the emblem with ordinary text.

Montserrat is not an application token. Where the login brand message is reconstructed as live text, use **Montserrat**, then Roboto, as a source-supported exception. Do not extend the login's uppercase, widely spaced tagline treatment to form labels or navigation.

| Role | Size | Weight | Line height | Use |
| --- | --- | --- | --- | --- |
| `display` | 36px | 700 | 1.2 | Login heading or large applicant page title on wide screens. |
| `page-title` | 28px | 700 | 1.25 | HR page titles and standard portal page titles. |
| `section-title` | 20px | 700 | 1.3 | Main content sections and dialogs. |
| `card-title` | 18px | 600 | 1.35 | Vacancy, profile, and interview card headings. |
| `body-lg` | 16px | 400 | 1.5 | Applicant forms and longer job descriptions. |
| `body` | 14px | 400 | 1.5 | Default operational content and HR tables. |
| `body-sm` | 13px | 400 | 1.5 | Secondary table content and compact detail metadata. |
| `label` | 14px | 600 | 1.4 | Buttons, field labels, navigation, and tabs. |
| `label-sm` | 12px | 600 | 1.4 | Table headers and short status labels. |
| `caption` | 12px | 400 | 1.5 | Timestamps, file sizes, and supporting notes. |
| `metric` | 32px | 700 | 1.15 | Dashboard totals and score values. |

Use sentence case for instructions, helper text, and status descriptions. Preserve named navigation destinations. Keep table headings short without abbreviating essential meaning. Use tabular numerals for percentages, totals, and scores. Keep dates readable and consistently formatted; show the relevant time zone with interview times when ambiguity is possible. Long names wrap; email addresses and filenames may break at safe boundaries. Truncation requires access to the full value by focus, tooltip, or detail view.

The reference uses very small text to fit complete screens on one canvas. These PDF dimensions are not production font sizes. Allow scrolling and use the scale above instead of shrinking content to reproduce the entire screenshot in one viewport.

## Layout

### Shared desktop shell

Use a 232px navy sidebar, a 56px white top bar, and a fluid main area. The source sidebar occupies roughly 230px of a 1254px canvas; the standardized value follows that proportion. Place the emblem and VERA wordmark at the top, destination rows below, and Log Out at the bottom. On short screens, let navigation scroll so Log Out does not overlap other destinations. Keep the notification bell, avatar, user name/role, and account disclosure in the top-right utility area.

The main area uses 24px outer padding, 24px panel gutters, and a maximum inner width of 1440px. Place the page title and supporting sentence at the upper left. Place page-level actions, date, or filters at the right when space allows. Keep contextual Back links immediately above the detail content. A quiet HR footer may sit after content, never over it. Applicant references omit that footer; do not force it into every portal screen.

### Navigation

| Role | Destination order |
| --- | --- |
| HR | Dashboard; Company List; Job Vacancies; Applicant Management; Resume Screening; Interviews Assessment; Endorsement Management; Applicant Pool; Recruitment Reports. |
| Applicant | My Profile; Job Vacancies; My Documents. |

Detail pages retain their parent module's selected navigation state. Role labels in the header identify the signed-in context. Do not expose HR controls in applicant pages. The references show HR and Admin identities but do not establish a complete permission matrix.

### Page patterns

- **Login:** a roughly 58/42 split between construction/brand imagery and the login area, following HR p. 1. The login card is about 420px wide with comfortable vertical spacing. The photograph, yellow diagonal accent, logo, and brief company values remain confined to the brand side.
- **HR dashboard:** a three-column, two-row metric area above the interview table. Six tiles are justified by the six visible recruitment categories, not a generic dashboard template.
- **Management lists:** title, compact action/filter row, full-width table, then count and pagination. Searches identify their target, such as company or applicant.
- **HR vacancy cards:** three columns on wide desktops; each card groups company identity, job title, and needed/remaining slots.
- **Applicant vacancy cards:** two columns; icon, title, concise job summary, and a clear detail affordance. Do not copy the HR slot-management controls into this view.
- **Forms:** two columns only where the field groups are short and related. Company Information and Contact Person are sibling groups. Vacancy description and responsibilities are separate long-text groups.
- **Applicant profile:** approximately 60/40 split between the profile form and stacked interview/notification panels.
- **Job detail:** broad description column and narrower qualifications/responsibilities column. In HR, keep capacity, weights, and ranking actions in the complementary area.
- **Evaluation:** applicant summary and three score slots above a roughly 40/60 split between resume/notes and the interview rubric.
- **Document review:** preview at roughly two-thirds width; document metadata, verification notes, and actions at one-third.
- **Reports:** three metrics, a wider pipeline chart beside the outcome chart, a full-width vacancy table, and a compact export area.

### Spacing and responsive completion

| Token | Value | Typical application |
| --- | --- | --- |
| `xxs` | 4px | Tight label/value separation. |
| `xs` | 8px | Icon-to-text gap and compact control spacing. |
| `sm` | 12px | Input padding and grouped metadata. |
| `md` | 16px | Related controls and compact panel padding. |
| `lg` | 24px | Standard panel padding, grid gutters, and page inset. |
| `xl` | 32px | Separation between major content sections. |
| `xxl` | 48px | Login breathing space and exceptional major separation. |

The PDFs show desktop layouts only. The following responsive rules are **proposed implementation standards**, not observed mobile designs.

| Viewport | Behavior |
| --- | --- |
| 1200px and wider | Full sidebar; HR vacancy grid at three columns; applicant vacancy grid at two columns; full split-detail views. |
| 768–1199px | Sidebar becomes a menu-triggered drawer when persistent navigation would constrain content. Use 24px page padding, two-column vacancy grids, and stack complex evaluation/preview panels as needed. |
| Below 768px | One content column with 16px page padding. Stack profile panels and form fields. Use a compact top bar with menu, title, and essential account controls. Login prioritizes the form and reduces the image to a short brand header. |

On narrow screens, simple document and vacancy lists become stacked labeled rows. Dense ranking and evaluation tables may scroll horizontally inside a labeled container while keeping names or criteria visible. Do not introduce page-wide horizontal overflow. Long dialogs become nearly full-screen surfaces with a scrollable body and reachable close/action controls. Preserve entered data when the viewport changes.

## Elevation & Depth

Most content sits flat: white surfaces on a pale canvas with a 1px `border` outline. This supports sustained review without making every table and form appear to float. The sidebar's dark/light contrast establishes the main structural depth.

| Layer | Treatment | Purpose |
| --- | --- | --- |
| Page and ordinary cards | No shadow; optional 1px outline. | Group related records and fields. |
| Login card or floating utility menu | `0 2px 8px rgba(17, 43, 73, 0.10)` | Separate a focused surface from its surroundings. |
| Tooltip or popover | `0 4px 16px rgba(17, 43, 73, 0.14)` | Keep contextual content visibly above a table or toolbar. |
| Dialog or right drawer | `0 16px 48px rgba(17, 43, 73, 0.24)` plus `overlay`. | Establish temporary focus and make the blocked background obvious. |

Suggested stacking order is base content 0, sticky table header 10, application header 20, popover 40, backdrop 50, dialog/drawer 60, and toast 70. A popover belonging to a dialog must render within that dialog's active layer. Do not stack separate blocking dialogs. Replace one step with the next when moving from final-interview outcome to training invitation.

Proposed motion is restrained: 120–180ms for color/focus feedback and 180–220ms for drawers or dialogs. Movement should clarify opening, closing, or progress. Respect reduced-motion preferences and remove decorative animation. Keep the sidebar wave static.

## Shapes

Use 4px corners for buttons, inputs, tabs' optional backgrounds, and small badges; 8px for cards and file groups; 12px for dialogs and the login card. Use circles only for identity avatars, the company emblem, and compact icon medallions. A full-round chip is acceptable for a concise count or status, but is not the universal shape for every control.

Borders are 1px except the 2px selected-tab indicator and 2px focus outline. Use a 2px offset around focused controls. Prefer visible boundary contrast over thick ornamental outlines.

Icons follow the source's recognizable office vocabulary: building for company, briefcase for vacancy, people for applicants, document/checklist for screening, calendar for interviews, paper plane for endorsement, chart for reports, and file for uploads. Use one coherent set with solid navigation silhouettes and clearly legible action symbols. Use 20–24px navigation icons and 16–20px inline icons. Match stroke weight within a context. Avoid emoji and unexplained decorative symbols.

Reuse approved Confiable artwork without redrawing it. Preserve aspect ratio, leave at least 8px clear space, and size the sidebar emblem around 80px. Company marks shown in sample rows are mockup assets, not a verified client roster. Use actual company assets where supplied; otherwise use restrained initials. Avatars may use initials without implying that a profile photograph exists.

## Components

### Shared interaction contract

All controls need default, hover where applicable, keyboard-focus, pressed/selected, disabled, and busy states. Focus uses the `focus` outline with an offset; it must remain visible on both light surfaces and the navy rail. Use a white focus outline within the dark rail if the blue outline lacks contrast. Disabled actions explain their prerequisite nearby when it is not obvious. Loading must not shift surrounding layout or discard entered data.

Every asynchronous list, upload, and submission needs loading, empty, error, and success feedback. These states are proposed completions because the PDFs primarily show populated success paths. Announce important updates through appropriate live regions. Keep permanent record changes visible in the record itself, not only in a short-lived toast.

### Buttons and links

| Variant/state | Presentation | Behavior |
| --- | --- | --- |
| Primary | Blue fill, white semibold label, 44px minimum height, 16px horizontal padding. | Main task action such as Save Company, Create Job Vacancy, or Submit Application. |
| Primary hover / pressed | Darker blue tokens; unchanged geometry. | Immediate pointer/press feedback. |
| Secondary | White fill, blue label, 1px blue or control-border outline. | Back, Cancel, View, Download, or a supporting action. |
| Tertiary/link | Blue text; underline ordinary inline links. | Navigation or a low-emphasis action with a real destination. |
| Destructive | Red text/outline for initial Delete or Remove; solid red in the final confirmation. | Name the affected item and consequences before committing. |
| Disabled | Disabled surface and text tokens; no hover emphasis. | No activation. Explain missing requirements where useful. |
| Loading | Preserve width, show a compact spinner and an action-specific label. | Prevent duplicate submissions until the request resolves. |

Table actions may look compact but retain a 44px hit region without overlapping adjacent controls. Icon-only controls require an accessible name and a focus-triggered tooltip. Add arrows only for navigation or disclosure, not as decoration on every action. Retain the source's red exit icon but keep Log Out text readable; logging out is not presented as deletion.

### Inputs, selects, checkboxes, and tabs

Place labels above fields, helper text below, and required indicators beside the label with an explanation at form level. Standard controls are 44px high. Use 16px input text in the applicant portal and on small touch screens; HR desktop controls may use the 14px body style. Textareas begin at 112px and grow or scroll.

| State | Visual rule | Interaction rule |
| --- | --- | --- |
| Default | White surface, neutral text, visible control border. | Placeholder is an example, never the only label. |
| Focus | Blue outline and caret; retain the field boundary. | Move focus without altering the value. |
| Error | Red outline plus specific message and error icon when useful. | Associate message with field; preserve the attempted value. |
| Read-only | Subtle surface with readable content. | Allow selection/copy; do not make it resemble an editable input. |
| Disabled | Disabled tokens. | Explain dependencies, such as municipality selection after province. |
| Busy | Inline progress near the dependent field or form. | Keep stable layout and prevent duplicate requests. |

Checkboxes use a 20px visible square in a 44px target. Support unchecked, checked, indeterminate, disabled, and focus states. Radio groups, where implemented, use the same target size and clearly indicate a single choice. The outcome buttons on HR p. 28 are not evidence that the whole application uses radio inputs.

Tabs use muted labels, a blue selected label, and a 2px underline. Keep the source's experience-group tabs, applicant-pool tabs, and document tabs. Counts are data, not permanent label text. Implement keyboard navigation, selected semantics, and associated panels. Keep tab order stable as state changes. Search and filters share the standard input styling; show active filters and a clear way to reset them. Empty results distinguish “no records yet” from “no matches for these filters.”

### Tables, lists, cards, and pagination

Use left-aligned text, right-aligned numeric values when comparison benefits, and aligned percentages. Table headers use a pale fill. Rows begin at 48px and expand for multiline content. Hover subtly tints actionable rows; selected rows need a visible control or indicator as well as tint. Do not imply that every row is clickable when only its View action is interactive.

Give each table a meaningful caption or accessible label. Expose sort state only on sortable columns. Keep row actions in a consistent final column and name icon-only actions with the record context. Preserve filters and pagination when returning from a detail view. Show the current range, total, and page controls. The displayed page size follows available data and design needs, not the mockup's sample count.

Cards group a real unit: a vacancy, company, profile, interview, or metric. Vacancy cards can be a single coherent link when no nested actions exist. A metric is clickable only when it leads to the corresponding filtered list. Sample totals are not hard-coded into components.

### Status labels

Use text, optionally an icon, and a restrained tinted background. This mapping standardizes presentation; it does not define a new recruitment state machine.

| Context | Labels shown or directly implied in the references | Presentation |
| --- | --- | --- |
| Application processing | Screening; For Interview | Informational blue for Screening; amber for For Interview. |
| Pool membership | Pooling / In Applicant Pool; Waiting | Neutral label; selected pool tab carries navigation emphasis. |
| Interview appointment | Scheduled; Online; On-site | Blue for Scheduled; neutral/blue metadata for meeting type. |
| Documents | Verified; Supporting Documents Verified | Green with check icon. |
| Documents requiring review | For Verification; Check Supporting Documents; Reupload required | Amber with explanatory text. |
| Vacancy | Active | Green. Other vacancy states require confirmed product rules. |
| Endorsement response | Confirmed | Green; distinct from a hiring decision. |
| Applicant response action | Confirm Availability; Not Available | Action labels in the notification flow, not assumed hiring statuses. |
| Final interview | For Training; Rejected | Blue for transition to training; red for rejected outcome. |
| Previous application | Not Selected | Red with neutral, factual explanatory text. |
| Employment outcome | Hired | Green. |
| Training | On Training | Blue or neutral stage label; do not invent completion outcomes. |
| Reporting only | In Process; Not Hired; For Feedback | Blue; red; neutral respectively. |

Use the same label and tone for the same state across relevant views. Do not conflate a verified file with a verified identity, a high match score with hiring approval, or an availability confirmation with endorsement delivery.

### Dialogs and right drawers

Center short focused tasks in a 560–640px dialog: matching explanation, availability notification, application document selection, applicant history, or final-interview outcome. Use a 720–880px dialog for the endorsement candidate table. Use a 420–480px right drawer for company detail and interview scheduling, following the source patterns.

Each overlay has a title, contextual applicant/job identity when relevant, an accessible close button, and a clear action area. Keep padding at 24px. Constrain height to the viewport with a scrollable body. Trap keyboard focus, make the background inert, allow Escape where safe, and return focus to the opening control. Closing a changed form prompts about discarding unsaved changes; a simple read-only detail can close immediately.

### Login and account controls

Preserve the observed email field, password visibility control, Remember me, Forgot password, primary Log In, Google sign-in option, and administrator-contact prompt. Password visibility is a labeled toggle. Invalid credentials show a form-level message without clearing the email. Keep the brand image separate from the form's reading order.

The PDFs do not supply applicant registration or recovery screens. Authentication provider behavior, contact destinations, and legal/help URLs must be configured before those controls are delivered. A notification badge reflects an actual unread count. Do not permanently reproduce the sample count of three.

### Company and vacancy forms

The company form groups company name, industry, description, and website separately from contact name, position, email, and number. Show field-level validation and preserve values after a failed save. Company Details can link to vacancies and related records; summary counts must come from the selected company.

The vacancy form preserves the five visible groups: Company & Position; Job Description; Key Responsibilities; Qualifications; Competency Weights. Source fields include education, age range, gender, and other qualifications, with their policy questions recorded in Overview. Competency entries are Communication, Problem Solving, Work Experience, Technical Skills, Teamwork, and Adaptability. Keep a visible total. Validate numerical weights and require a total of 100% before saving a configured model. A total that is missing or not 100% must not appear as a successful check.

### Resume screening, ranking, and score explanation

The screening flow begins with a vacancy, then displays the two observed groups: Applicants with Work Experience and First-Time Job Seekers. Rows contain applicant name, resume link, resume match, document status, and next actions. Running screening has a progress state, a recoverable error state, and a clear completion update. Keep manual document-review actions separate from calculated matching.

Ranking shows resume matching, interview score, and final matching in parallel columns. Use teal, purple, and blue respectively, with numeric values and labels. “Not evaluated” or an equivalent explicit missing-state label replaces an absent interview result; do not display zero as if an assessment happened. Provide View Matching Details from each candidate row.

The matching dialog shows each score, concise reasons, and references to the underlying evidence. The 50% resume / 50% interview formula on HR p. 11 is explicitly described as proposed in the source; do not assume it is an approved universal weighting rule. Show the configured formula and the same rounded result everywhere. Explanation text must reflect actual evidence or clearly labeled demonstration data.

### Interview evaluation and scheduling

The evaluation page retains the applicant context, resume preview, notes, and criterion table. The visible reference rubric is Communication Skills 20%, Technical Knowledge 30%, Attitude and Behavior 20%, Analytical Thinking 20%, and Overall Impression 10%. These are source example weights, not a claim of validated assessment policy.

Each score accepts 0–100. Weighted contribution equals score multiplied by its weight as a decimal. The total is the sum of contributions when all required scores exist. Clearly separate incomplete, saved draft, submitting, and submitted states. Save Evaluation preserves a draft; Submit Evaluation finalizes according to confirmed product rules. This distinction is proposed behavior inferred from two separate buttons, not demonstrated by the PDFs.

Initial interview scheduling uses date, time, online meeting link, and optional reminders. Final interview scheduling uses date, time, interview address, person to look for, and reminders. Show whether the appointment is online or on-site. Preserve the selected applicant/job in the drawer and confirm success in the underlying row.

### Documents and verification

File rows show document type, filename, size where available, upload time, status, and specific actions. PDF is the visibly demonstrated format. Accepted formats, maximum file size, retention, and replacement/version policy are not supplied; show actual configured limits rather than inventing them.

The applicant Resume tab communicates that one resume is required and one file is uploaded at a time. Supporting Documents communicates optional supporting files. Provide an initial Upload control when no file exists; the source shows replacement states but not the empty state. Uploading, failed, complete, and reupload-requested states preserve the row's identity. A reupload request includes the reason when one is available. Keep the old file visible until its replacement succeeds.

The HR document viewer pairs the preview with filename, seminar/training title, upload date, verification state, optional notes, Mark as Verified, and Request New Copy. Include zoom, page navigation, and download when supported by the actual file. A failed or unavailable preview leaves metadata and download usable. Do not claim verification based only on a filename or upload success.

### Applicant profile, applications, and notifications

The profile panel contains full name, age/birthday, gender, and address fields, with an edit control. The source does not show saving: proposed edit mode adds Save Changes and Cancel, clear editable styling, and validation. Province and municipality/city selection must remain consistent.

The upcoming-interview card highlights the date, appointment type, time, location/link, interviewer, and View Details. Recent Notifications uses a compact vertical list with an icon, concise event text, and timestamp. Full notification/interview lists need specified destinations before View All is implemented. The source's claim that a meeting link activates ten minutes before the interview is not assumed functionality; use such copy only if scheduling logic enforces it.

Applying opens the document-selection dialog for that job. The resume is selected and required; supporting files remain optional as shown. Display selected count, file names, and missing requirements. Proposed completion states include Submitting, Application submitted, and a retryable submission error. If repeat applications are restricted, show the existing application state using confirmed rules. Do not silently submit every stored document.

### Endorsement, pool history, and training

Notify Applicant prepares an availability message with recipient, subject, body, and response-link information. Sending needs a clear progress/result state. The dialog must accurately describe whether a message was sent; opening or closing it is not a send. The applicant response screen is outside the supplied visual set.

Endorsement Management lists vacancies and confirmed candidates, with individual and bulk detail downloads. Preserve the difference between confirming availability and completing endorsement. A history dialog uses a vertical dated timeline for application submission, screening, interview, outcome, and pool entry. Each event includes readable text and an icon; red may identify an unsuccessful outcome without dominating the history.

Final-interview outcome offers For Training and Rejected as observed. Training invitation collects date, time, venue/address, details, and optional reminders. On Training shows a training period and update action. The invitation form has one date while the list shows date ranges; the source does not establish how the end date is set. Confirm that model before implementing period editing or generating dates.

### Reports and charts

Use a vertical bar chart for Applied, Endorsed, and Hired, and a donut for hiring outcomes as shown. Keep direct numeric labels, a readable legend, and an equivalent accessible data table. Calculate percentages from the stated denominator and label any rounding. A funnel-looking sequence does not by itself prove that all bars share the same cohort.

Company and date filters must apply consistently to metrics, charts, tables, and exports. A completion bar shows its numeric percentage and is based on hired/needed slots when that is the configured metric. Do not infer success thresholds from the sample bar colors. Empty reports say no data for the selected period rather than displaying made-up trends. Exports identify their filters and generation time; PDF and Excel buttons reflect working outputs.

### Feedback and recovery

| Situation | Required presentation |
| --- | --- |
| List loading | Stable skeleton rows or a concise loading indicator with an accessible loading label. |
| No records | Contextual empty message and a relevant action, such as Add Company or Upload Resume. |
| No search matches | Show the active query/filters and a clear reset action. |
| Save or upload failure | Explain the failure near the affected task, preserve values, and provide Retry where supported. |
| Success | Update the record and show concise confirmation, such as “Company saved.” |
| Destructive action | Confirmation names the file/record and explains actual effects. Do not promise Undo unless it exists. |
| Long operation | Show real progress if available; otherwise show an indeterminate state without a fabricated percentage. |
| Tooltip | Show on hover and focus after a short delay; essential instructions remain visible outside it. |
| Toast | White surface, semantic icon, concise text, dismiss control; errors remain until dismissed or resolved. Routine success may dismiss after about six seconds, pausing while focused. |

## Do's and Don'ts

### Do

- Preserve the navy shell, Confiable identity, blue selected navigation, and distinct HR/applicant content patterns.
- Use front-matter tokens consistently; resolve `{group.token}` references before applying values.
- Use source page references to check a screen's purpose and composition.
- Keep applicant/job/company context visible through screening, assessment, scheduling, and endorsement.
- Provide visible field labels, keyboard focus, text status names, readable contrast, and sufficiently large targets.
- Keep score values, formulas, counts, slot totals, and exports consistent with their underlying data.
- Retain neutral body text and reserve blue for meaningful interaction or emphasis.
- Test long names, filenames, missing photos, zero records, incomplete scores, slow uploads, rejected requests, and narrow layouts.
- Treat illustrative records as sample data and replace them with authorized real data in a working product.

### Don't

- Copy small raster text sizes, conflicting counts, inconsistent tab order, or calculation errors from the PDFs.
- Use the Confiable yellow as body text on white or let decorative waves interfere with navigation.
- Make every field label, paragraph, table value, and link the same blue.
- Treat match scores as hiring decisions or document upload success as verified evidence.
- Invent a scoring algorithm, hiring threshold, applicant permission, training outcome, or document policy from appearance alone.
- Add a mobile bottom navigation, chatbot, dark theme, registration flow, or unrelated module and present it as source-derived.
- Render body content as screenshots or shrink whole pages to fit a fixed height.
- Leave View All, Google sign-in, recovery, export, scheduling, or notification actions without defined destinations and outcomes.
- Show sample names, logos, metrics, dates, message delivery, or verification results as confirmed operational facts.

### Implementation acceptance checklist

1. Both role shells match their documented destination order and active-module behavior.
2. Every inventoried screen has its source-supported content and actions, or an explicitly tracked implementation gap.
3. Component states cover keyboard focus, disabled, loading, error, empty, and success where relevant.
4. Forms preserve user input after failure; dialogs restore focus and scroll without hiding actions.
5. The same candidate has identical score values and calculation details across ranking and evaluation views.
6. All status labels retain context; document verification, availability, assessment, and employment outcomes remain separate.
7. Layouts remain readable at 360px, 768px, 1024px, and 1440px widths and at 200% zoom. Dense tables scroll within their own regions.
8. Color-pair checks use the tokens defined here; full keyboard and assistive-technology review still occurs during implementation.
9. Reports use consistent filters, valid chart domains, and real export behavior.
10. Unspecified business rules are resolved before their dependent controls are presented as complete.
