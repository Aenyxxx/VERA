# VERA — Handoff (updated Oct 24, 2026; decision 37 built, Unit C awaiting the owner's commit, see 1.2e)

Short, factual status for the next session. Rules and conventions: `CLAUDE.md`. Decisions: `docs/FINAL_DESIGN_DECISIONS.md`. How the app works now: `docs/USER_GUIDE.md`.

## 1. Project status

**The build is done.** Every decision in `docs/FINAL_DESIGN_DECISIONS.md` is built and committed: 5 and 11–21 (Oct 17), the Oct 19 post-testing changes 22–28, the final-test prep 29–30, and the **final-test changes 31–34 (Oct 20, see 1.2a)**, including the decision 34 owner change (no sample-data banner; exports enabled but inactive). Suites: api **760**, web **318**, svc **151** passed; `pnpm lint` clean; `pnpm algo:check` passed (29 blocks, 22 registered steps). **Verified on the laptop after `git pull`.** **Oct 23: decision 35 and its owner follow-up** (team test changes, web only, see 1.2b) are built and committed (`5728e76`, `b0dba31`). Suites: api **760**, web **325**, svc **151** (svc unchanged since Oct 19); `pnpm lint` clean; `pnpm algo:check` passed (29 blocks, 22 registered steps). **Oct 24: decision 36** (owner text changes and the new name **Virtual Employment and Recruitment Assistant**, web text only, see 1.2d) is built and committed (`67b471d`).

**Current state (Oct 24):** decisions **35** (`5728e76`), **35 follow-up** (`b0dba31`) and **36** (`67b471d`) are built and committed; docs wrap-up `48c87d3`. **Decision 37** (1.2e): A `443195e`, B `90e9ce0`, D `199f227` committed; **C built, awaiting the owner's commit** (with migrations #14–15, already applied). Suites after C: api **778**, web **341**, svc **151**; `pnpm lint` clean; `pnpm algo:check` passed (29 blocks, 22 registered steps). **No scoring or VERA-ALGO change.** Database: decision 37C added three `application_status` values (migrations #14–15); no ERD entity or column change. DFD: Figures 12–16 and 19–21 have pending decision 37 changes (FINAL_DESIGN_DECISIONS DFD table).

**Name:** VERA = **Virtual Employment and Recruitment Assistant** (decision 36; was "Verified Evaluation and Recruitment Assistant"). The owner updates the manuscript **title page, abstract and Chapter 1**; the **adviser must confirm the new name**.

### 1.1 Decisions 5, 11–21 (Oct 17)
| Phase | Decisions | Commit | Check results |
|---|---|---|---|
| 1 | 11 (no minimum years, `S_exp = R`), 12 (whole-resume fallback), 5 (1-year company block) | `43e193d` | check-p1 **22/22** |
| 2 | 14 (final interview notice), 15 (For hiring sequence), 21 (endorsement packet) | `e6b646e` | check-p2 **55/55**, check-s16 **121/121**, check-s18 **17/17** |
| 3 | 17 (screening failures → pool, pool matching on publish, job invitations), 18 (pool tabs Waiting / Returned by Client) | `438840f` | (check-p3: see 1.3) |
| 4 A+B | 19 (User Management), 20 (reschedule requests) | `1caafed` | check-p4 parts 1–2 **60/60**, check-s13 **63/63** |
| 5 | 13 (Evaluate card layout; per-choice text later replaced by decision 23) | `e097628` | web tests |
| 4 C | 16 (attach documents when applying, resume replacement during active applications) | `819e660` | check-p4 parts 1–3 **85/85** |

### 1.2 Post-testing changes 22–28 (Oct 19)
| Pass | Decisions | Commit |
|---|---|---|
| A | 22 User Management (Password + Confirm password; admin edits full name / password, never the email), 23 Evaluate column headers, 24 score breakdown without the rank line, 25 lean endorsement packet (header + 15 ratings + interview score), 28 replaced supporting documents deleted when pending and unreferenced | `76f00ee` |
| B | 26 skill evidence from the Skills section only (no duty bullets, no evidence weights) | `c92ce74` |
| C | 27 credit = raw cosine (`LOW, HIGH = 0, 1`); missing skills = best similarity ≤ 0.35, display only | `f0bedda` |
| fix | svc matching scores round half-up on the decimal value (`round2`, like the API): 71.125 → 71.13 | `f879275` |
| prep | 29 supporting document types **Certificate, Diploma, Other** only (uploads and HR requests; no migration, the older enum values stay unused), 30 upload dialog helper line removed; reschedule-request staff notice says "Interview Assessment". Suites: api **740**, web **304**, svc **151**; lint clean; algo:check passed | (owner commits) |

### 1.2a Final-test changes 31–34 (Oct 20; one commit each, order 32 → 33 → 31 → 34; no database change)
| Decision | What | Status |
|---|---|---|
| 32 | The client's final interview is in the Notify message (required) and confirmed once; Create endorsement sets it on every item and moves `endorsed` → `final_interview_scheduled` in one transaction, no second notice (different → 409 `FINAL_INTERVIEW_CHANGED`, then "time changed"; rematch → "scheduled") | `0ed094c`; check-s16 fix `0f368f3` |
| 33 | Endorsement packet downloaded from the Ranking tab (rows that passed, at passed … hired / not hired) by application id; removed from Outcomes and the old item route | `85adbc0` |
| 31 | My Profile: initials avatar (first + last name) and a disabled "Upload photo" (Coming soon); nothing uploaded | `b63a2c8` |
| 34 | Recruitment Reports (`/admin/reports`, last sidebar item for HR and admin): sample tiles, pipeline and hiring-outcome charts (HTML/CSS, no new dependency), vacancy table with "Sample …" companies; no API | `2fdf4cc` |
| 34 owner change | The "Preview: sample data" banner and "Coming soon" are removed; Export PDF / Export Excel are enabled (normal look) but inactive (no request, navigation, download, or toast); still sample data, still no API. The presenter says aloud that it is sample data (DEFENSE_DEMO_CHECKLIST Extra F) | `124020c` |

All built and committed; no migration, no ERD/DFD change. Suites after the last commit: api **760**, web **318**, svc **151**; lint clean; algo:check passed.

Check results (Oct 20, real database, live API, after the unit commits):
- **check-s15: 141/142.** The one FAIL, "Notify without the final interview -> 400", got status **0** (connection closed by the server: a Windows PowerShell 5.1 keep-alive race on the reused connection), not an API error; the next request on the same route passed. Not a code finding.
- **check-s16: 138/139.** The one FAIL, "Create endorsement again (nobody for_endorsement) -> 422", got 400 VALIDATION_ERROR: a **script bug** (that call sent no `finalInterviewAt` / `finalInterviewDetails`, required since decision 32). Fixed in the script: the call now sends the notified schedule (`$createBody`) and still expects exactly 422, now also with the message "Nobody has confirmed the endorsement yet: notify passed applicants first."; not re-run. The API path is covered by `endorsements.test.js` "nobody for_endorsement → 422, nothing written" (valid body). Not a code finding.
- check-s17 and check-p2: skipped by decision; decision 32/33 paths are covered by unit tests and check-s15/s16 on the real DB.
- **Status history confirmed** on the real DB (check-s16's printed query): each endorsed application has `for_endorsement → endorsed` ("Endorsed to the client") then `endorsed → final_interview_scheduled` ("Final interview scheduled"), with the **same `changed_at`**, ordered by **`history_id`** (endorsed first), **HR as the actor**.

### 1.2b Team test changes, decision 35 (Oct 23; web only, no API / database / ERD / DFD / scoring change)
| Item | What | Commit |
|---|---|---|
| 1–14, 16–18 | Helper texts removed or shortened (Setup, documents, Notifications, Dashboard, companies, vacancies, vacancy form, Evaluate, Notify); "(optional)" removed from labels (validation unchanged); **Selection Settings** on the vacancy form and detail panel; white profile inputs (light: no faded disabled Age / Email, no autofill tint; dark: no gray); Setup **Upload photo** = local preview only, never uploaded or saved, gone on refresh; My Profile = initials avatar only (amends 31) | `5728e76` |
| owner follow-up | No spinner arrows on any number field (one global rule in `index.css`); mouse-wheel guard (`lib/numberWheel.js`, installed in `main.jsx`: a focused number field is blurred on wheel, so its value never changes) | `b0dba31` |

Suites after both: api **760** (unchanged), web **325** (318 + 7 new), svc **151**; lint clean; algo:check passed. No check script re-run (no API change).

### 1.2c Blocked by the no-database rule (future work, not built)
- **Item 15, application cap "greater than slots needed":** needs a migration that drops (or relaxes) the table constraint `job_vacancy_cap_covers_shortlist` (`application_cap >= slots_needed * 4`, initial schema), plus the web and API validation and its tests. The rule also lets both groups' shortlists fill (2 × slots each). It stays ≥ slots × 4 (default slots × 8) everywhere.
- **DOCX / JPEG / PNG supporting documents:** needs a migration for the `documents` bucket's `allowed_mime_types` (PDF only today), a new upload check with magic bytes, real file extensions / MIME in storage, and web accept / checks. DOCX has no inline viewer (it downloads). The packet is unaffected (it merges only the PDF resume); no column change. Details: FINAL_DESIGN_DECISIONS 35.
- **Profile photo storage:** the Setup **Upload photo** is a local preview only (never uploaded, saved or sent to the API; gone on refresh; decision 35). Storing it needs a bucket, a column or table, an API route and upload checks.

### 1.2d Owner text changes, decision 36 (Oct 24; web text only, no API / database / ERD / DFD / scoring change)
| What | Commit |
|---|---|
| Page descriptions removed: Applicant Management, Resume Screening, Interview Assessment, Endorsement Management, Applicant Pool, User Management, Recruitment Reports, My Profile, My Documents; also the company drawer and Add HR account descriptions. Empty states keep only their title. Shorter lines on Candidates, the closed Ranking tab and Resume Screening. Reports chart **Applicant progress**. Name **Virtual Employment and Recruitment Assistant** on Login and in every doc / README. The API 409 text for a closed vacancy is unchanged | `67b471d` |

Suites: api **760** (unchanged), web **330** (325 + 5 new); lint clean; algo:check passed. No check script re-run (no API change). Applicant My Profile has no test file, so its removed description has no test.

**Manuscript (owner):** the **title page, abstract and Chapter 1** must use **"Virtual Employment and Recruitment Assistant"** (was "Verified Evaluation and Recruitment Assistant"); the **adviser confirms the new name**. Screenshots taken before Oct 24 show the old texts and name.

### 1.2e Workflow changes, decision 37 (Oct 24; four units, order A → B → D → C; plan approved by the owner)
| Unit | What | Status |
|---|---|---|
| A | Interviews notify only: set at once (`confirmed` / `interview_confirmed`), no confirm route / pop-up / deadline, reschedule only before the time, Approve sets the time at once, Edit time also after the time, final interview in the applicant's Upcoming interviews. No migration, no ERD change; DFD 9.2 → "Send Interview Notice" | built, **awaiting the owner's commit**; suites api **756** (760 − removed confirm tests + new ones), web **330**; lint clean; algo:check passed (29 / 22). Check scripts edited, **not run**: s13 (count unchanged **63**), p4 (count unchanged **85** with part 3), s14 (unchanged), s15 (**+1**: one "set at once" check per scheduled applicant replaces four confirm checks), s16 / s17 / p2 (unchanged: one step replaced by one) |
| A (commit) | | committed `443195e` |
| B | Endorsement without applicant confirmation: Notify → for_endorsement with "Selected for endorsement" (no deadline, no pop-up, routes removed); decision 32 comparison kept; HR Remove from endorsement (reason, neutral archived). No migration, no ERD change; DFD 11.2 → "Send Endorsement Notice", new **11.4 Remove from Endorsement** | built, **awaiting the owner's commit**; suites api **760**, web **326** (with `EndorsementConfirmDialog.test.jsx` excluded: the owner `git rm`s it with the dialog); lint clean; algo:check passed. Check scripts edited, **not run**: s15 (**+3** vs. after A: the confirm/decline checks become 404 checks plus Remove from endorsement 403 / 400 / 200 / notice / 409), s16 (**+1**: four confirm steps become four for_endorsement steps plus HR removes E; E ends archived, the fill closes out standby 1 instead of 2), s17 / p2 (unchanged: one step replaced by one) |
| B (commit) | | committed `90e9ce0` |
| D | Applicant Pool search (`?q=` name / email, both tabs) + account Active / Inactive (HR and admin; reason required in `talent_pool.remarks`; whole account like staff; pending offer expired; entry `unavailable`; skipped by pool matching and the rematch; inactive rows stay listed and searchable). No migration, no ERD change; DFD 1.3 / 3.1 flows. Also: the `InterviewEvaluation.test.jsx` timing flake fixed (see the CHANGELOG) | built, **awaiting the owner's commit**; suites api **768**, web see the stop message; lint clean; algo:check passed. check-p3 edited (**+9**: search ×2, 403, 400, deactivate, listed + reason, token refused, activate, back to available), **not run** |
| D (commit) | | committed `199f227` (without the two C migration files) |
| C | Client-outcome stages: migrations **#14–15** (`20261024000000_outcome_stage_values.sql`, `20261024010000_outcome_stages.sql`; applied and verified by the owner, DATABASE_SCHEMA §7); Final interview → Proceed → For training → Training passed → For requirements → For orientation → Mark as deployed (`hired` = **Deployed**), `/advance` one stage at a time with a notice each; Training failed only at For training (`/endorsement-items/:id/training-failed`, item outcome not_hired "Training failed"); Not hired at every stage; stage tracker + only the next buttons; not hired / training failed rows leave Outcomes; Run rematch again on the Applicant Pool row; "Hired" column → "Deployed". No ERD entity change; DFD Figure 21 (12.0) to redraw, Figure 14 label | built, **awaiting the owner's commit** (include the two migration files); suites api **778**, web **341**, svc **151**; lint clean; algo:check passed (29 / 22). Check scripts edited, **not run**: s16 (**+20** in sections 6–8: the stage steps with a notice check each, the skip / deploy-early / training-failed-elsewhere / old-route checks, A training failed at For training, the Outcomes-view check; the pre-check now expects **21** enum rows), p2 (**+13**: P and Q's VR application through every stage, the old route 404, the Deployed notice, Q not hired at For requirements, the VP Outcomes-view check; the dashboard tile check now needs all 5 with-client stages), s17 (count unchanged: the two VS Outcomes rematch checks become "batch still listed" and "R1, R2 left out"), s18 (no change; it reads the tile sets from the API) |

### 1.2f UI redesign progress (Oct 24; web look only, rules in `docs/UI_REDESIGN.md`)
| Done | Commit |
|---|---|
| Phase 0: tokens, app shell, shared components | `dc7280a` |
| Login and Sign up (01) | `fabf59a` |
| HR Dashboard (02) | `090bed6` |
| Company Management (03–05) | `a7bb7b5` |
| Job Vacancies (06–08) | `54c6320` |
| Ranking and Notify (09–11) | `6733302` |
| Resume Screening (14–18) | `e876513` |
| Interview Assessment (19–20) | `034fbaa` |
| `cn()` knows VERA's custom font sizes (tailwind-merge fix) | `0737cc6` |
| Endorsement Management (21–22; 28–29 for style only) | `f436ae1` |
| Applicant Pool (23–24) | `eb9245c` |
| Applicant Management (12) | `3b5f0a0` |
| User Management (no image) | `9fb5ea6` |
| Recruitment Reports (31) | `e766737` |
| Notifications (32) | `e97fd0b` |
| Setup and My Profile (33) | `039a0f2` |
| applicant Job Vacancies (34–36) | `2b1f8b3` |
| My Documents (37–38) | `8d5f2a7` |

**All tabs done** (branch `ui-redesign`).

**Polish after the tabs** (Oct 25, polish pass; web and docs only):
- [x] **Hired → Deployed** labels (decision 37C): Dashboard tile and the Applicant Management status filter (web-side `features/dashboard/tileLabels.js`; `@vera/shared` and the API keep "Hired"), vacancy cards, company summary, Recruitment Reports tile / pipeline / outcome ring and legend / table header. Endorsement counts already read Deployed. Status values, API fields, `?status=hired` and routes unchanged.
- [x] Faint inner frame of tables placed inside cards: `bare` prop on DataTable and EmptyState, used on the Dashboard's **Upcoming interviews**.
- [x] Dashboard tile link targets: decided and built (decision 38, Oct 24; For screening, For interview, For endorsement and Applicant pool open their own pages).
- [x] One CHANGELOG line for the redesign.
- [x] Outdated tailwind-merge workaround comments removed (ScoreChip, EvaluationForm, UI_REDESIGN §3.2); skip list for 37–38 added (UI_REDESIGN §5).

**Next step:** merge `ui-redesign` into `master` (owner).

### 1.2g Owner changes, decision 39 (Oct 25; four units, order 39-1 → 39-4; plan approved by the owner)
| Unit | What | Status |
|---|---|---|
| 39-1 | White fields: editable = white (also OS dark mode, autofill), disabled / read-only = light gray with readable text; shared `SELECT_CLASS`; Age / Email light gray (amends 35) | committed; web **355** (354 + 1 new test); lint clean; algo:check passed (29 / 22). No API, DB, ERD, DFD or check-script change |
| 39-2 | Applicant Pool: no Run rematch again; `POST /api/admin/applications/:id/rematch` removed (404); automatic rematch after Not hired unchanged; failed-rematch toast and "Rematch declined" staff notice reworded | built, **awaiting the owner's commit**; api **778** (unchanged: the route's roles test became the removed-route test; the scan / offer cases now call `runRematch` directly), web **354** (355 − 2 + 1); lint clean; algo:check passed (29 / 22). check-s17 edited (**−13**: the four manual-rematch calls become a 404 + 403 pair, the after-accept 409 removed, R2's Run rematch again → VOK → closed → 409 → expired block replaced by one "no pending offer after declining" check; pool row now "declined at VBEST"), **not run**. No migration, no ERD change; DFD: remove an HR → 3.0 manual rematch flow if drawn (Figures 13 / 16) |
| 39-3 | Notify = endorsement (batch + items + final interview in one step); Endorsement Management keeps only Outcomes; Remove at Final interview | planned |
| 39-4 | Activate / Deactivate on Applicant Management for every applicant; migration `user_account.deactivation_reason` (approved in principle; file shown before applying) | planned |

### 1.3 Latest check results
- **After Pass C and the rounding fix:** check-s17 **90/90**, check-p3 **49/49**. Live matching of the demo resume (Experienced): Cashier **78.95**, final **79.48** with the demo interview 80.00.
- **Still valid** (paths not touched by the Oct 19–20 changes): check-p1 22/22, check-p4 85/85, check-s13 63/63, check-s18 17/17. *Superseded by Oct 20:* check-p2 55/55 and check-s16 121/121 (the scripts changed for decisions 32–33; see 1.2a for the new runs).
- check-s11 / check-s12 were not re-run after Phase 4 C; their two manual paths (**HR requests a document**, **HR rejects a resume**) are in the final test.

### 1.4 Also done (Oct 19)
- `docs/USER_GUIDE.md`: plain-language guide (navigation, workflow, rules, scoring, notifications, troubleshooting, glossary) with the doc-vs-app differences in §9 (`d74ca29`).
- Label fixes: "Log out" everywhere; sidebar "Interview Assessment" like the page titles (`de0eb23`).
- Browser tab icon: the VERA logo (`5df742d`).
- One-off reset script `supabase/scripts/reset-all-for-final-test.sql` (`868869b`).

### 1.5 Decisions this session (Oct 20, not built)
- **UI redesign:** dropped for now. *(Oct 23: back as a tiered UI update after the team re-test; see §5 step 2.)*
- **Deployment:** postponed. The PC or the laptop is the server, reached through a **dev tunnel**; GitHub only holds the code (it does not host the app).
- **Brevo (email sending):** still postponed; VERA sends no email (USER_GUIDE §6, §9).

## 2. Migrations applied on the real database (in order)

| # | File | Note |
|---|---|---|
| 1 | `20261006000000_initial_schema.sql` | + `supabase/seed.sql` |
| 2 | `20261007000000_competency_profile_rubric.sql` | 15-item Competency Profile, section weights |
| 3 | `20261008000000_one_ongoing_application.sql` | did not commit on the real DB; re-applied idempotently by #5 and #6 |
| 4 | `20261010000000_application_source_rematch.sql` | |
| 5 | `20261010010000_close_out_values.sql` | |
| 6 | `20261010020000_one_ongoing_index_repair.sql` | |
| 7 | `20261011000000_rematch_offer.sql` | |
| 8 | `20261019000000_final_interview_values.sql` | enum values alone |
| 9 | `20261019010000_final_interview.sql` | |
| 10 | `20261020000000_pool_reason_values.sql` | enum values alone |
| 11 | `20261020010000_job_invitation.sql` | |
| 12 | `20261021000000_reschedule_requests.sql` | |
| 13 | `20261021010000_application_document.sql` | the Oct 19 changes and decisions 22–36, 37A/B/D needed no migration |
| 14 | `20261024000000_outcome_stage_values.sql` | decision 37C; enum values alone (`for_training`, `for_requirements`, `for_orientation`) |
| 15 | `20261024010000_outcome_stages.sql` | decision 37C; ongoing function + both indexes rebuilt; applied and verified by the owner on Oct 24 (5 queries as expected) |

Verification queries for each are in `docs/DATABASE_SCHEMA.md` §7.

## 3. Current database

- **Oct 19:** reset with `supabase/scripts/reset-all-for-final-test.sql` (only **admin@vera.test** and **hr.vera@email.test** kept, passwords unchanged; Competency Profile and `system_setting` kept; every other table emptied; `resumes` and `documents` buckets emptied).
- **Oct 20:** check-s15 and check-s16 then ran on this database, so it holds **ZZ companies / vacancies and `zz-…@vera.test` throwaway applicants** (with resumes in Storage) until the next reset.
- **TODO: confirm reset.** The owner must confirm whether the fresh-start reset was done after those runs (`reset-all-for-final-test.sql` in the SQL Editor + empty the `resumes` and `documents` buckets in the dashboard). Until confirmed, assume the ZZ data is still there.
- The old **Juan / Cashier / Store Crew** data no longer exists. (`reset-applications.sql` still refuses the old Cashier id; harmless.)
- The check scripts create ZZ data and need throwaway applicants: do not run them again before the team re-test.

## 4. Known limitations (documented, not fixed)

- **Resume-replacement race** (`docs/DATABASE_SCHEMA.md` §8, "Resume replace"): a rematch scan or pool-matching run that called svc with the old resume can still insert its offer just after a replacement commits; the stored matching is then from the previous resume. Seconds-wide; accepted for the demo.
- **Rematch offers can stay pending**: no automatic expiry (deadline shown, not enforced); a stale offer is expired only by the accept re-check (PRD BR-23 note).
- **`job_vacancy.min_years_experience`** column is still present and unused; the drop migration is **post-defense** (ROADMAP "Final cleanup").
- **The design docs mention features that are not in the app** (e.g. Forgot password, Google sign-in, Settings, scheduled expiry jobs, emails, "Find matches in talent pool"): see `docs/USER_GUIDE.md` §9.

## 5. Next steps

In this order:

1. [ ] **Team re-test on the current build** (`67b471d`). **First**, if not done (see §3 TODO), the fresh-start reset: `supabase/scripts/reset-all-for-final-test.sql` in the SQL Editor, then empty the `resumes` and `documents` buckets. Collect the findings (no fixes during the run); findings go to the reviewer before any fix, and fixes follow §6. Follow `docs/DEFENSE_DEMO_CHECKLIST.md` and `docs/USER_GUIDE.md`. Besides the earlier items (**HR requests a document**, a Diploma, with a Certificate attached when applying; run the read-only type check in `docs/DATABASE_SCHEMA.md` §7 first; **HR rejects a resume**; passing-score notes: V1 passing 75 needs an interview of about 71+, V2 passing 70 about 77+), check the Oct 20 changes:
   - [ ] **Notify carries the schedule:** the dialog requires the final interview date, time, and details; the "Please confirm" notice contains them.
   - [ ] **The applicant pop-up shows it:** "Confirm your endorsement" shows the message with the final interview.
   - [ ] **Create endorsement sends no second notice** when the schedule matches (the applicants are at *Final interview*, "Sent to the employer" only); a different time shows the warning, then "Final interview time changed".
   - [ ] **Download on Ranking, not in Outcomes:** the packet button is on the vacancy's Ranking tab for applicants who passed; the Outcomes rows have none.
   - [ ] **Profile photo (decision 35):** Setup profile: **Upload photo** shows the chosen image in the avatar, no network request, gone after a refresh; a PDF → "Choose an image file.". My Profile: initials of the first and last name only, no Upload photo in view or edit mode.
   - [ ] **Decision 35 texts:** the removed helper lines are gone; "Selection Settings" on the vacancy form and Details tab; Setup inputs white in OS light and dark mode (Age and Email included); Evaluate Save disabled until all 15 are rated; Notify still refuses a company name (422).
   - [ ] **Number fields (decision 35 follow-up):** no up/down arrows on any number field (vacancy form, reopen cap, Height); scrolling over a focused number field does not change its value.
   - [ ] **Reports page:** last sidebar item for HR and admin; sample tiles, charts (**Applicant progress**, Hiring outcomes), and table; no banner, no page description; Export PDF / Excel clickable but doing nothing.
   - [ ] **Decision 37 (TC-124–127):** the items above about confirming (the "Please confirm" notice, the endorsement pop-up) are replaced by decision 37A/B: no interview or endorsement confirmation, "Selected for endorsement" carries the schedule, Remove from endorsement; pool search and Active / Inactive; the Outcomes stage tracker through **Deployed** (Training failed only at For training; Not hired at every stage; Run rematch again on the Applicant Pool row). Follow the updated DEFENSE_DEMO_CHECKLIST Steps 7–10.
   - [ ] **Decision 36 texts (TC-123):** Login subtitle "Virtual Employment and Recruitment Assistant"; the removed page descriptions and helper lines are gone; empty lists show their title only; nothing looks broken.
2. [ ] **UI update to match the storyboard** (tiered; **copy the look, not the behaviour**). **Phase 0 (foundation) done Oct 24**: `docs/UI_REDESIGN.md` is the reference (tokens, component rules, page map, skip list); tokens, shell and shared components restyled. Next: one page tab per prompt from the owner.
   - **Before starting:** add the design PDFs to `docs/design/` first (the folder does not exist yet). Plan mode first; **one commit per tier**.
   - **Tier 1:** theme tokens, app shell, shared components.
   - **Tier 2:** Dashboard, Ranking, Endorsement, applicant My Applications.
   - **Keep** every label, field, route, and rule as built.
   - **Skip the known design conflicts:** 6 competencies, the 0–100 rubric, the Final Interview / On Training tabs (decision 37C built the stages as a tracker on the Outcomes tab instead), Run Resume Screening, the old document types, resume delete, a single Full Name field, an editable Age, Google sign-in.
3. [ ] After a clean run: **`git tag defense-freeze`** and **push the tag** (`git push origin defense-freeze`).
4. [ ] **Manuscript alignment:** `docs/USER_GUIDE.md` §9 (features described in the docs but not in the app, incl. item 11, the final interview notice), the new matching numbers (decisions 26–27, half-up rounding: worked example 71.13 / final 74.32; demo resume Cashier 78.95), and **Recruitment Reports = a layout preview with placeholder data, future work**. **No Reports screenshot as a results figure.** Also: the Setup profile photo is a local preview only (never stored; USER_GUIDE §9 item 12), and the three blocked items in 1.2c are future work. **New name (decision 36):** title page, abstract and Chapter 1 use "Virtual Employment and Recruitment Assistant" (adviser to confirm); retake any screenshot that shows the old texts (USER_GUIDE §9 item 13).

**Machine note:** the **laptop is the current server**. Run `pnpm dev` and the dev tunnel from **one machine at a time** (both use the same Supabase project); **push before switching** machines (see §6).

## 6. How to resume (working rules used in this build)

- **Manual approval, file by file (show the diff first)** for any change to rematch, endorsement, status machine, close-out, eligibility, or scoring code (and VERA-ALGO blocks). Plan first for each part; keep it lean.
- **Claude never writes SQL to the database.** Claude writes migration files + verification queries and stops; the owner applies them in the Supabase SQL Editor. Never read or print a `.env` file.
- **The owner commits and pushes**; Claude suggests the commit message.
- Shell commands beyond tests, lint, `algo:*`, and read-only git need approval.
- Tests: fix failures in code; changed assertions at least as strict; empty/zero checks only after a positive assertion on the same container; no `sed -i`.
- **Check scripts:** Windows PowerShell 5.1, ASCII only, API only, ZZ data only, height rule (ZZ vacancies `minHeightCm = 249`, throwaway applicants 250 cm), arrays returned with `return ,@(...)`.
- **pnpm 12.5.1**: no `-s` flag; `npx` is blocked → `pnpm --filter <app> exec vitest run <files>`. Heredocs with apostrophes break: write edit scripts to the scratchpad and run them.
- **Setup gotchas on the PC:** the svc venv is Python 3.13, built from the laptop's freeze file; pnpm comes from the standalone install; paths use `C:\Users\NYNX\...` on the PC and `C:\Users\NYXX\...` on the laptop.
- **One server at a time:** run `pnpm dev` and the dev tunnel from **one machine at a time** (both use the same Supabase project). **The laptop is the current server.** Before switching machines, push from the current one, stop `pnpm dev` and the tunnel there, then `git pull` on the other.

## 7. Where things are

- How the app works: `docs/USER_GUIDE.md`
- Defense flow: `docs/DEFENSE_DEMO_CHECKLIST.md`
- Decisions (incl. Oct 19, 22–30, Oct 20, 31–34, Oct 23, 35, and Oct 24, 36): `docs/FINAL_DESIGN_DECISIONS.md`
- Matching and scoring: `docs/ALGORITHM.md` (+ generated `ALGORITHM_INDEX.md`, `ALGORITHM_CODE.md`)
- Check scripts: `scripts/` (`check-p1..p4.ps1`, `check-s11..s18.ps1` and helpers)
- Cleanup scripts (not migrations): `supabase/scripts/` (`reset-all-for-final-test.sql`, `delete-check-vacancies.sql`, `reset-applications.sql`, `delete-demo-vacancies.sql`)
- Build order and status: `docs/ROADMAP.md` ("Post-sprint build"); changes: `CHANGELOG.md`
