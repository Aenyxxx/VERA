# VERA — Defense Demo Checklist (Oct 19, 2026)

One full flow with **new** companies, vacancies and resumes, then short extra demos. Each step says what to click and what the panel should see. Times are Philippine time. Source of truth for the rules: `docs/FINAL_DESIGN_DECISIONS.md`.

---

## 1. Before the panel arrives

- [ ] Latest `master` pulled; `pnpm install` done; all migrations applied (last one `20261021010000_application_document.sql`).
- [ ] `pnpm dev` running: web `:5173`, api `:5000`, svc `:8000`.
- [ ] svc log shows **"Application startup complete."** (the SBERT model is preloaded; the first match is then fast).
- [ ] `http://localhost:5000/api/health` → db **up**, svc **up**.
- [ ] Cleanup run in the Supabase SQL Editor: `supabase/scripts/delete-check-vacancies.sql` (final row all 0). No `ZZ Check` vacancy or company is left.
- [ ] Test HR accounts from check-p4 deleted (`docs/GETTING_STARTED.md` → "Remove test HR accounts"); User Management shows only the real admin and HR.
- [ ] Laptop clock correct (Windows → Date & time → Sync now). The interview steps depend on it (§3).
- [ ] One browser window per role, each in its own profile or private window, signed in and side by side: **HR**, **Admin**, **Applicant A**, **B**, **C**, **D**.
- [ ] Resume PDFs on the desktop (text-based, English; scanned PDFs are refused on purpose) and two extra PDFs to use as supporting documents: a **Certificate** (e.g. a training certificate) and a **Diploma** (the app offers only Certificate, Diploma, Other; decision 29).
- [ ] Old demo data will not get in the way: pool matching on publish invites **every** free pool applicant who qualifies, so old throwaway applicants still in the Applicant Pool may also receive invitations. That is correct behaviour; mention it if it happens.

## 2. Accounts to prepare

| Account | Role in the demo | Prepare |
|---|---|---|
| Admin | User Management, dashboard | existing (`seed:admin`) |
| HR | everything on the agency side | existing (`seed:admin`) |
| Applicant **A** | main flow → **hired** | throwaway applicant, no profile yet (`pnpm --filter api seed:applicant -- --email <a>`); profile set up live in step 3 |
| Applicant **B** | main flow → **not hired** → automatic rematch → accept | throwaway, profile confirmed beforehand (Experienced resume, height ≥ 150 cm) |
| Applicant **C** | prescreen failure → pool → job invitation; resume replacement | throwaway, profile confirmed beforehand with **height 145 cm** |
| Applicant **D** | resume rejected (remarks) → dropped | throwaway, profile confirmed beforehand |

Use cashier / store-crew style resumes for A, B, D so they pass the matching threshold. Sign-up by email is not part of the run (the confirmation mail can be slow); mention it instead.

## 3. Interview clock tip

- **Schedule interview** accepts only a future time, and **Evaluate** opens only once the interview is **confirmed** and its start time has **passed** (before that it is disabled with the reason).
- So schedule each interview **about 2 minutes ahead**, let the applicant **Confirm attendance** right away, and talk through the screen until the time passes. Then click **Evaluate**.
- If the panel asks: the same rule stops HR from rating someone before the interview took place.

---

## 4. Main flow

### Step 1 — Company and vacancies (HR)
1. **Company List → Add company**: "Northgate Grocers" (any real-looking details). Add a second company, "Bayview Mart".
2. **Job Vacancies → Create vacancy** under Northgate Grocers: **V1 "Cashier"**: slots 2, cap 16, endorsement count 2, ages 18–35, any gender, senior high, **min height 150 cm**, cashier skills and experience text, section weights **A 30 / B 30 / C 40**, threshold 40, passing 75. *(Since decision 27, Oct 19, matching scores are lower: Juan's resume matches this Cashier text at about 79 (was 99), so with passing 75 the interview score must be about 71 or more for A to pass; rate A's interview accordingly, e.g. Juan's demo ratings give 80.00 → final 79.48.)*
3. **Publish** V1.
4. Under Bayview Mart create **V2 "Store Crew"** (store-crew skills and experience, min height **140 cm**, weights A 20 / B 80 / C 0, threshold 40, passing **70**, endorsement count 1; since decision 27 Juan's resume matches Store Crew text at about 63, so B's re-weighted interview must be about 77 or more to reach 70: Juan's demo ratings give 83.33 → final 73.25). **Do not publish yet** (step 2 needs it).

Panel sees: the weights must total 100 before Publish; after publishing, matching inputs are locked (only posting text and a higher cap can change).

### Step 2 — Applying (applicants)
1. **A**: Sign in → upload resume → the profile card **auto-fills** (name, birthday, address, education, height) → review → **Confirm**. My Documents → **Upload document** → **Certificate** (name e.g. "Food safety training"; the type list shows only Certificate, Diploma, Other).
2. **A**: Job Vacancies → Cashier (no company name anywhere) → **Apply** → **Experienced** → under **"Attach documents to this application?"** tick the Certificate → **Submit application**.
   Panel sees: "Checking your qualifications…", then the stage label (e.g. *Under review*), never a score or the company.
3. **B** and **D** apply to Cashier (no attachment).
4. **C** applies to Cashier → **Not shortlisted** right away (height 145 < 150), with the sentence that the profile is kept in the applicant pool.
5. **HR → Job Vacancies → V2 → Publish.** Pool matching runs in the background; open V2 → **Pool invitations** tab → after a few seconds C is listed as invited (C passes V2's 140 cm). Leave C's answer for Extra A.
6. **A** now tries to apply to Store Crew: **Apply** is disabled with "You have an ongoing application for Cashier" (one ongoing application).

### Step 3 — Resume Screening (HR)
1. **Resume Screening → Cashier**: two group tabs (Work Experience / First-Time), shortlist = 2 × slots per group, ranked by matching score; C under *Not shortlisted* with the reason.
2. Open **A** → review sheet: profile, matching details (matched / missing skills, warnings if a section was missing), resume, documents. The Certificate shows **"Attached when applying"**.
3. **Mark as verified** on A's resume → the row shows the **Locked** marker (a verified slot is never displaced).
4. **Request a document** for A → type *Diploma*, reason "Please upload your diploma." → deadline = today + 3 days (from System Settings).
5. **A**: dashboard shows the request with reason and deadline → My Documents → **Requests** → **Upload Diploma**.
6. **HR**: A's sheet shows the Diploma as **New upload to verify** and the request as fulfilled → **Mark as verified** on the Diploma and the Certificate → next step **Schedule interview** becomes available.
7. Verify **B**'s resume (and any documents) the same way.

### Step 4 — Reject a resume (HR, applicant D)
1. Open **D** → **Reject** on the resume → try to confirm with empty remarks → not allowed (remarks required).
2. Enter remarks "The resume does not show your work history." → **Reject**. D is **not** dropped automatically; the slot is locked.
3. **Drop application** → reason → D leaves the shortlist, the next applicant in the waiting pool (if any) moves up, and D enters the Applicant Pool (*Waiting*).

### Step 5 — Interviews (HR + A, B)
1. Review sheet → **Schedule interview** for A, **~2 minutes ahead** (§3), 30 min, a Google Meet link, interviewer = HR.
2. **A**: the dashboard pop-up asks to **Confirm attendance** → confirm → the meeting link appears only now.
3. Same for **B** (or use Extra B here to show a reschedule request first).

### Step 6 — Evaluate (HR)
1. **Interviews Assessment → Cashier → Evaluate** (enabled once the time passed).
2. Panel sees the Competency Profile: 15 items in sections A/B/C, the five rating labels **once per section as column headers** and only 1–5 on each row (decision 23, Oct 19), competency cards on the left, applicant card on the right; the section scores and the interview score update live; final = (matching + interview) ÷ 2.
3. Rate A high (passes), **Save evaluation** → confirm. Rate B so B also passes (final ≥ 75).
   Explain: WSM — each section score = (mean − 1) ÷ 4 × 100, interview = Σ weight × section ÷ 100.

### Step 7 — Rank and notify (HR → A, B)
1. **Job Vacancies → Cashier → Ranking** tab: both groups ranked together by final score, with matching / interview / final.
2. Select A and B → **Notify (2)** → fill in the client's **final interview** (Date, Time, Location and details, e.g. "Client HR office, 2nd floor. Bring two valid IDs."; naming the company is refused) → **Notify applicants** (decision 32).
3. **A** and **B**: dashboard pop-up shows the message with the final interview → **Confirm** (one confirmation, schedule included). Status: *For endorsement*.

### Step 8 — Endorse and packet (HR)
1. **Endorsement Management → Cashier → Candidates** → **Create endorsement** → type the **same** final interview (nothing is prefilled) → Cashier becomes *Endorsing*; A and B go straight to *Final interview* with that time. They get "Sent to the employer" and **no second final interview notice** (decision 32). Optional: type another time first to show the warning ("This final interview differs from what A, B were told…"), then fix it.
2. **Job Vacancies → Cashier → Ranking** tab → **Download** on A's row (decision 33: the packet is on the Ranking tab, for everyone who passed) → one PDF: cover page with the agency, name, position, agency interview date, the 15 ratings under their section headings, and the interview score, then A's resume. No section scores, weights, formula, or rating legend (decision 25, Oct 19: the client does not see how scores are computed); no matching score, no final score, no other applicants.

### Step 9 — Client side: final interview → hired (A)
1. Outcomes → A shows *Final interview* with the time from Step 8 (no separate scheduling step; **Change time** is there if the client moves it, and notifies A).
2. **A** already has the date in "Please confirm: Cashier" (Step 7), never the company.
3. HR → **Proceeds** → A is **For hiring** (A notified).
4. Do **Step 10 first**, then come back: HR → **Mark as hired** for A → A's next action: wait for the agency to contact them.

### Step 10 — Client side: not hired → automatic rematch (B)
1. Outcomes → B → **Mark as not hired** (Northgate rejected B) → confirm.
2. VERA rescans the open vacancies right away (Northgate's excluded for 1 year) and **offers Store Crew** to B: the toast and the Outcomes row show the offer with B's matching, the interview score **re-weighted** with Store Crew's A 20 / B 80 / C 0, and the final score.
3. **B**: dashboard **Job offer** pop-up: "Store Crew" with location, no company → **Accept**.
4. B's Store Crew application starts at **For endorsement**: no screening, no second interview (rating reuse).
5. Optional: Endorsement Management → Store Crew → **Create endorsement** (with a final interview; B came from the rematch, had no Notify message, so B gets "Final interview scheduled: Store Crew") → Store Crew **Ranking** tab → **Download** on B's row: the packet's interview score is re-weighted with the Store Crew weights.

---

## 5. Extra demos (short)

### Extra A — Prescreen failure → pool → job invitation (C)
- HR → **Applicant Pool → Waiting**: C (*prescreen failed*) and D (*dropped*). The second tab, **Returned by Client**, holds applicants who failed on the client side (B appeared there after *not hired*, until B accepted the rematch offer).
- C → dashboard **Job invitation: Store Crew** (job title only) → show **Decline** (C stays in the pool) or **Apply** (normal application, shortlist).
- HR → V2 **Pool invitations** tab shows C's answer.

### Extra B — Reschedule request (B, during step 5)
- B → Upcoming interview card → **Request reschedule** → reason → card says "Reschedule requested. The agency will set a new time or keep this one."
- HR → Interviews Assessment: the row shows the reason and "Request 1 of 2"; Edit time and no-show are disabled while it waits.
- **Approve** → set a new time (~2 min ahead) → B is asked to confirm the new time → B confirms.
- Optional: B requests again → HR **Decline** → "the interview stays on {date}". Both count; a third request is refused.

### Extra C — Resume replacement (C, after answering the invitation)
- While the invitation is still pending: My Documents → Resume → **Re-upload** → choose a PDF → **Use this resume** → "Answer your pending job offer or invitation first." (offers store matching from the current resume).
- After C answers: replace again → "Resume replaced. The agency will check it again." The new resume is *For verification*; the profile is unchanged.
- Point to the rule: an application already sent keeps the resume it was sent with (HR's review sheet still shows that one); new applications use the new resume.

### Extra D — User Management (Admin)
- Admin → **User Management** (HR does not have this menu) → **Add HR account** (email, name, temporary password) → the new HR can sign in.
- **Deactivate** → that HR is signed out on the next request and cannot sign in; the admin cannot deactivate themselves or the last active admin. **Activate** again, or leave it inactive and delete it after the defense.

### Extra E — Dashboard
- HR/Admin → **Dashboard**: the 8 tiles (vacancies, applicants in each stage, applicant pool, hired, …) and the upcoming interviews. Click a tile → Applicant Management filtered to those applicants. Counts should match what was done above (e.g. 1 hired, B in Store Crew *For endorsement*, C and D in the pool).

### Extra F — Recruitment Reports (preview)
- HR/Admin → **Recruitment Reports** (last menu item): **say aloud** that the page is a **preview with sample data** — the page has no banner, so the panel only knows this from you; the numbers and the "Sample …" companies are not from this demo. Show the **Applicant progress** and **Hiring outcomes** charts (hover a bar for its value) and the vacancy table. Export PDF / Export Excel can be clicked but do nothing yet: say so if the panel asks; don't click them as if they worked. Do not present these numbers as results.

---

## 6. If something goes wrong

- **svc down** → apply and pool matching answer "The resume service is unavailable"; restart `pnpm dev` and wait for "Application startup complete."
- **Evaluate still disabled** → the interview is not confirmed yet, or its time has not passed (check the laptop clock).
- **No rematch offer after not hired** → V2 must be open, B must pass V2's prescreen and threshold, and B's re-weighted final score must reach V2's passing score (70). **Run rematch again** on the Outcomes row after fixing.
- **Pool matching invited nobody** → V2 was published before C failed, or C's height is below V2's minimum; **Run pool matching again** on the Pool invitations tab.
- Not shown live (mention only): sign-up email confirmation, emailing the endorsement to the client and post-hiring details (described in the manuscript; HR downloads the packets).
