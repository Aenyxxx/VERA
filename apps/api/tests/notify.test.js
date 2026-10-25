// Notification templates (docs/TRD.md §9): no company names, neutral shortlist wording.
import { describe, expect, it, vi } from "vitest";

import { finalInterviewLine, messageFor, notify } from "../src/domain/notify.js";

const vars = { jobTitle: "Cashier", conditions: ["Age must be between 18 and 35 (you are 40)."] };

describe("notification templates", () => {
  it("keeps shortlisted and shortlist_displaced neutral: a shortlist place can be lost again", () => {
    for (const type of ["shortlisted", "shortlist_displaced"]) {
      const { title, message } = messageFor(type, vars);
      expect(`${title} ${message}`).not.toMatch(/congratulations|congrats|!|selected|hired|passed/i);
    }
    expect(messageFor("shortlisted", vars).title).toBe("Under review: Cashier");
    expect(messageFor("shortlist_displaced", vars).title).toBe("Back in line for Cashier");
  });

  it("names the unmet prescreen condition", () => {
    expect(messageFor("prescreen_failed", vars).message).toContain("Age must be between 18 and 35 (you are 40).");
  });

  it("inserts the row for the user with the in-app link", async () => {
    const client = { query: vi.fn().mockResolvedValue({ rowCount: 1 }) };
    await notify(client, { userId: "u1", type: "application_submitted", applicationId: "a1", vars });
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toMatch(/insert into public\.notification/);
    expect(params).toEqual(["u1", "a1", "application_submitted", "Application received", expect.stringContaining("Cashier"), "/applicant", false]);
  });

  it("document requested: type, reason, and the deadline with date, time, and time zone (UI_GUIDELINES §7)", () => {
    const { title, message } = messageFor("document_requested", {
      jobTitle: "Cashier",
      documentLabel: "Diploma",
      reason: "The copy is blurred.",
      dueAt: "2026-10-11T04:00:00.000Z",
    });
    expect(title).toBe("Document requested: Diploma");
    expect(message).toBe(
      "For your application for Cashier, please upload your Diploma by Oct 11, 2026, 12:00 PM (Philippine time). Reason: The copy is blurred.",
    );
  });

  it("application dropped: no company, no internal reason, and the applicant may apply elsewhere (BR-18)", () => {
    const { message } = messageFor("application_dropped", { jobTitle: "Cashier", reason: "failed_verification" });
    expect(message).toBe("Your application for Cashier has been closed. You can apply to other jobs.");
    expect(message).not.toMatch(/verification|kabayan|company/i);
  });

  // Forbidden words: no client company, no scores, no internal reasons, no meeting link in a notification (rule 4).
  it("interview templates (S13) never name the company, scores, internal reasons, or the meeting link", () => {
    const interview = {
      jobTitle: "Store Crew",
      applicantName: "Ana Cruz",
      scheduledAt: "2026-10-12T02:00:00.000Z",
      durationMinutes: 30,
      confirmDueAt: "2026-10-11T02:00:00.000Z",
    };
    for (const type of ["interview_scheduled", "interview_rescheduled", "hr_interview_confirmed"]) {
      const { title, message } = messageFor(type, interview);
      expect(`${title} ${message}`).not.toMatch(/claygo|kabayan|company|score|matching|no-show|status_reason|https?:|meet\./i);
      // Neutral wording: an interview is not a selection (same rule as the shortlist templates).
      expect(`${title} ${message}`).not.toMatch(/congratulations|congrats|!|selected|passed|hired/i);
      expect(message).toContain("Oct 12, 2026, 10:00 AM (Philippine time)");
    }
  });

  it("Phase 4 reschedule texts: the staff notice names the company and the reason; the decline never names the company", () => {
    const staff = messageFor("hr_reschedule_requested", {
      applicantName: "Ana Cruz",
      jobTitle: "Store Crew",
      companyName: "ClayGo",
      scheduledAt: "2026-10-12T02:00:00.000Z",
      reason: "  Medical check-up  ",
    });
    expect(staff).toEqual({
      title: "Reschedule requested: Ana Cruz",
      message:
        'Ana Cruz asked to reschedule the interview for Store Crew at ClayGo on Oct 12, 2026, 10:00 AM (Philippine time). ' +
        'Reason: "Medical check-up". Approve with a new time or decline in Interview Assessment.',
    });
    // Decision 37: nothing to confirm, so no deadline line even if a caller still passed one
    const declined = messageFor("reschedule_declined", {
      jobTitle: "Store Crew",
      scheduledAt: "2026-10-12T02:00:00.000Z",
      confirmDueAt: "2026-10-11T02:00:00.000Z",
    });
    expect(declined).toEqual({
      title: "Reschedule request declined: Store Crew",
      message:
        "Your interview for Store Crew stays on Oct 12, 2026, 10:00 AM (Philippine time). If you can't attend, please contact Confiable Manpower.",
    });
    expect(`${declined.title} ${declined.message}`).not.toMatch(/claygo|company|score|confirm|https?:/i);
  });

  it("decision 37: interview_scheduled tells the time and where the link is, and asks for no confirmation", () => {
    const scheduled = messageFor("interview_scheduled", {
      jobTitle: "Store Crew",
      scheduledAt: "2026-10-12T02:00:00.000Z",
      durationMinutes: 30,
      confirmDueAt: "2026-10-11T02:00:00.000Z",
    });
    expect(scheduled).toEqual({
      title: "Interview scheduled: Store Crew",
      message:
        "Your online interview for Store Crew is on Oct 12, 2026, 10:00 AM (Philippine time) (30 minutes). " +
        "The meeting link is on your dashboard.",
    });
    expect(scheduled.message).not.toMatch(/confirm|Oct 11/i);
  });

  it("evaluation_did_not_pass (S14): neutral, no company, score, reason, or interview; may apply elsewhere (BR-18)", () => {
    const { title, message } = messageFor("evaluation_did_not_pass", { jobTitle: "Cashier" });
    expect(title).toBe("Application update: Cashier");
    expect(message).toBe(
      "Your application for Cashier was not successful this time. " +
        "We keep your profile in our applicant pool. You can apply to other jobs.",
    );
    expect(`${title} ${message}`).not.toMatch(/claygo|kabayan|company|score|matching|rating|passing|status_reason|interview|https?:/i);
    // Same neutral-wording rule as the shortlist and interview templates.
    expect(`${title} ${message}`).not.toMatch(/congratulations|congrats|!|selected|passed|hired/i);
  });

  // S15 (BR-22, FR-END-03): forbidden everywhere: company, scores, ratings, internal reasons, links.
  const NO_LEAK = /claygo|kabayan|company|score|matching|rating|%|status_reason|https?:/i;

  it("not_selected (S15 close-out): neutral, its own wording (not 'Application update'), may apply elsewhere", () => {
    const { title, message } = messageFor("not_selected", { jobTitle: "Store Crew" });
    expect(title).toBe("Job closed: Store Crew");
    expect(message).toBe(
      "The Store Crew job is no longer open, so your application has ended. " +
        "We keep your profile in our applicant pool. You can apply to other jobs.",
    );
    expect(title).not.toBe(messageFor("evaluation_did_not_pass", { jobTitle: "Store Crew" }).title);
    expect(`${title} ${message}`).not.toMatch(NO_LEAK);
    expect(`${title} ${message}`).not.toMatch(/congratulations|congrats|!|selected|passed|hired/i);
  });

  it("moved_to_standby (S15 close-out, S16 endorsement): fits archive, fill, and others endorsed; may say 'passed'", () => {
    const { title, message } = messageFor("moved_to_standby", { jobTitle: "Cashier" });
    expect(title).toBe("Kept in our applicant pool: Cashier");
    expect(message).toBe(
      "Your application for Cashier will not go forward to the employer. " +
        "You passed the agency assessment, so we keep your profile in our applicant pool. You can apply to other jobs.",
    );
    expect(`${title} ${message}`).not.toMatch(NO_LEAK);
    expect(`${title} ${message}`).not.toMatch(/congratulations|congrats|!|selected|hired/i);
  });

  it("passed_confirm_endorsement (S15 Notify, decision 32): fixed title, HR's body, the final interview line, then the fixed deadline line", () => {
    const body = "You passed the agency assessment for Cashier, and we would like to endorse you to the employer. The employer makes the final hiring decision.";
    const { title, message } = messageFor("passed_confirm_endorsement", {
      jobTitle: "Cashier",
      message: `  ${body}  `,
      finalInterviewAt: "2026-10-16T01:30:00.000Z",
      finalInterviewDetails: "  Bring two valid IDs.\n\nAsk for  the store manager.  ",
      actionDueAt: "2026-10-13T06:00:00.000Z",
    });
    expect(title).toBe("Please confirm: Cashier");
    expect(message).toBe(
      `${body} Final interview: Oct 16, 2026, 9:30 AM (Philippine time). Bring two valid IDs. Ask for the store manager. ` +
        "Please confirm on your dashboard by Oct 13, 2026, 2:00 PM (Philippine time).",
    );
    expect(message.match(/\(Philippine time\)/g)).toHaveLength(2);
    expect(message).toContain("final hiring decision");
    expect(`${title} ${message}`).not.toMatch(NO_LEAK);
    expect(`${title} ${message}`).not.toMatch(/congratulations|congrats|!|hired/i);
  });

  it("decision 32: finalInterviewLine = Manila time + details with whitespace runs folded to one space", () => {
    expect(finalInterviewLine("2026-10-16T01:30:00.000Z", " Bring  IDs.\nBe early. ")).toBe(
      "Final interview: Oct 16, 2026, 9:30 AM (Philippine time). Bring IDs. Be early.",
    );
  });

  it("decision 39-3: the decision 32 schedule comparison is gone (Notify sets the schedule itself)", async () => {
    const notifyModule = await import("../src/domain/notify.js");
    expect(notifyModule).not.toHaveProperty("scheduleNoticeFor");
  });

  it("decision 37B: endorsement_notice = fixed title, HR's body, then the final interview line; no deadline, no confirm", () => {
    const body = "You passed the agency assessment for Cashier, and we would like to endorse you to the employer. The employer makes the final hiring decision.";
    const { title, message } = messageFor("endorsement_notice", {
      jobTitle: "Cashier",
      message: `  ${body}  `,
      finalInterviewAt: "2026-10-16T01:30:00.000Z",
      finalInterviewDetails: "  Bring two valid IDs.\n\nAsk for  the store manager.  ",
      actionDueAt: "2026-10-13T06:00:00.000Z", // ignored even if a caller passed one
    });
    expect(title).toBe("Selected for endorsement: Cashier");
    expect(message).toBe(`${body} Final interview: Oct 16, 2026, 9:30 AM (Philippine time). Bring two valid IDs. Ask for the store manager.`);
    expect(message.match(/\(Philippine time\)/g)).toHaveLength(1);
    expect(message).not.toMatch(/confirm|Oct 13/i);
    expect(`${title} ${message}`).not.toMatch(NO_LEAK);
    expect(`${title} ${message}`).not.toMatch(/congratulations|congrats|!|hired/i);
  });

  it("decision 39-3: endorsement_removed (Remove at the final interview) is neutral: job title only, never a reason or the company", () => {
    const note = messageFor("endorsement_removed", { jobTitle: "Cashier", reason: "Accepted another job", companyName: "Kabayan Mart" });
    expect(note).toEqual({
      title: "Application closed: Cashier",
      message: "Your application for Cashier is closed. You can apply to other jobs.",
    });
    // the applicant was already endorsed, so the text no longer says it "will not go forward to the employer"
    expect(`${note.title} ${note.message}`).not.toMatch(/employer|another job|kabayan|reason/i);
    expect(`${note.title} ${note.message}`).not.toMatch(NO_LEAK);
  });

  it("notifyMessageDefault has no date, no company, and no score; it names the final decision", async () => {
    const { notifyMessageDefault } = await import("@vera/shared");
    const text = notifyMessageDefault("Cashier");
    expect(text).toBe(
      "You passed the agency assessment for Cashier, and we would like to endorse you to the employer. " +
        "The employer makes the final hiring decision.",
    );
    expect(text).not.toMatch(/\d|Philippine time|by /);
    expect(text).not.toMatch(NO_LEAK);
  });

  it("decision 37C: the client stage notices name the job and the next step, never the company or a score", () => {
    expect(messageFor("for_training", { jobTitle: "Cashier" })).toEqual({
      title: "For training: Cashier",
      message: "You passed the employer's final interview for Cashier and move on to training. The agency will contact you about the details.",
    });
    expect(messageFor("for_requirements", { jobTitle: "Cashier" })).toEqual({
      title: "For requirements: Cashier",
      message: "Your training for Cashier is complete. Next, prepare your pre-employment requirements; the agency will contact you about the details.",
    });
    expect(messageFor("for_orientation", { jobTitle: "Cashier" })).toEqual({
      title: "For orientation: Cashier",
      message: "Your requirements for Cashier are complete. Next is the orientation; the agency will contact you about the details.",
    });
    for (const type of ["for_training", "for_requirements", "for_orientation"]) {
      const { title, message } = messageFor(type, { jobTitle: "Cashier" });
      expect(`${title} ${message}`).not.toMatch(NO_LEAK);
      expect(`${title} ${message}`).not.toMatch(/congratulations|congrats|!|hired/i);
    }
  });

  it("S16 endorsed / hired: may sound positive, never the company, a score, or the word 'congratulations'", () => {
    const endorsed = messageFor("endorsed", { jobTitle: "Cashier" });
    expect(endorsed).toEqual({
      title: "Sent to the employer: Cashier",
      message: "The agency sent your profile to the employer for Cashier. The employer makes the final hiring decision. We will tell you the result.",
    });
    const hired = messageFor("hired", { jobTitle: "Cashier" });
    expect(hired).toEqual({
      title: "Deployed: Cashier", // decision 37C: hired is shown as Deployed
      message: "You are deployed for Cashier. The agency will contact you about the next steps.",
    });
    for (const { title, message } of [endorsed, hired]) {
      expect(`${title} ${message}`).not.toMatch(NO_LEAK);
      expect(`${title} ${message}`).not.toMatch(/congratulations|congrats|!/i);
    }
  });

  it("S16 not_hired / training_failed: neutral, own titles, may apply elsewhere (BR-18)", () => {
    const notHired = messageFor("not_hired", { jobTitle: "Cashier" });
    expect(notHired).toEqual({
      title: "Employer decision: Cashier",
      message: "The employer did not continue with your application for Cashier. We keep your profile in our applicant pool. You can apply to other jobs.",
    });
    const training = messageFor("training_failed", { jobTitle: "Cashier" });
    expect(training).toEqual({
      title: "Training update: Cashier",
      message: "Your training for Cashier was not completed, so this placement has ended. We keep your profile in our applicant pool. You can apply to other jobs.",
    });
    for (const { title, message } of [notHired, training]) {
      expect(`${title} ${message}`).not.toMatch(NO_LEAK);
      expect(`${title} ${message}`).not.toMatch(/congratulations|congrats|!|selected|passed|hired/i);
      expect(title).not.toBe("Application update: Cashier"); // evaluation_did_not_pass keeps its own title
    }
  });

  it("hr_endorsement_confirmed / declined go to staff with the applicant's name", () => {
    expect(messageFor("hr_endorsement_confirmed", { applicantName: "Ana Cruz", jobTitle: "Cashier" })).toEqual({
      title: "Endorsement confirmed: Ana Cruz",
      message: "Ana Cruz confirmed that they want to be endorsed for Cashier. They are ready for Endorsement Management.",
    });
    expect(messageFor("hr_endorsement_declined", { applicantName: "Ana Cruz", jobTitle: "Cashier" })).toEqual({
      title: "Endorsement declined: Ana Cruz",
      message: "Ana Cruz declined the endorsement for Cashier. You can notify the next passed applicant.",
    });
  });

  it("S17 rematch_offer / rematch_offer_expired: job title and deadline only, never the company or a score", () => {
    const offerText = messageFor("rematch_offer", { jobTitle: "Store Crew", dueAt: "2026-10-13T04:00:00.000Z" });
    expect(offerText).toEqual({
      title: "Another job for you: Store Crew",
      message:
        "The agency found another job that fits your profile: Store Crew. " +
        "Do you want the agency to endorse you for it? Please answer on your dashboard by Oct 13, 2026, 12:00 PM (Philippine time). " +
        "The employer makes the final hiring decision.",
    });
    const expired = messageFor("rematch_offer_expired", { jobTitle: "Store Crew" });
    expect(expired).toEqual({
      title: "Job no longer available: Store Crew",
      message: "The Store Crew job you were offered is no longer available. We keep your profile in our applicant pool. You can apply to other jobs.",
    });
    for (const { title, message } of [offerText, expired]) {
      expect(`${title} ${message}`).not.toMatch(NO_LEAK);
      expect(`${title} ${message}`).not.toMatch(/congratulations|congrats|!|selected|hired/i);
    }
  });

  it("S17 staff rematch notices name the applicant, the job, and the company", () => {
    const vars = { applicantName: "Juan Dela Cruz", jobTitle: "Store Crew", companyName: "ClayGo" };
    expect(messageFor("hr_rematch_offered", vars)).toEqual({
      title: "Rematch offer: Juan Dela Cruz",
      message: "VERA offered Juan Dela Cruz the Store Crew job at ClayGo after the client's rejection.",
    });
    expect(messageFor("hr_rematch_accepted", vars)).toEqual({
      title: "Rematch accepted: Juan Dela Cruz",
      // decision 39-3: endorsed through Notify on the Ranking tab (no Create endorsement)
      message: "Juan Dela Cruz accepted Store Crew at ClayGo. Notify them from the vacancy's Ranking tab to endorse them.",
    });
    expect(messageFor("hr_rematch_declined", vars)).toEqual({
      title: "Rematch declined: Juan Dela Cruz",
      // decision 39-2: no manual rematch to point to
      message: "Juan Dela Cruz declined Store Crew at ClayGo. They stay in the applicant pool and are matched when a new job is published.",
    });
    expect(messageFor("hr_rematch_declined", vars).message).not.toMatch(/rematch again/i);
  });

  it("interview_rescheduled (decision 37): the new time, the link on the dashboard, the contact line; never a confirm line", () => {
    const vars = { jobTitle: "Store Crew", scheduledAt: "2026-10-12T02:00:00.000Z", durationMinutes: 45 };
    const expected =
      "Your online interview for Store Crew is now on Oct 12, 2026, 10:00 AM (Philippine time) (45 minutes). " +
      "The meeting link is on your dashboard. If you can't attend at the new time, please contact Confiable Manpower.";
    expect(messageFor("interview_rescheduled", vars).message).toBe(expected);
    // a deadline passed by mistake is never shown
    expect(messageFor("interview_rescheduled", { ...vars, confirmDueAt: "2026-10-11T02:00:00.000Z" }).message).toBe(expected);
  });

  it("notifyStaff writes one row per active HR/admin account", async () => {
    const { notifyStaff } = await import("../src/domain/notify.js");
    const client = { query: vi.fn().mockResolvedValue({ rowCount: 2 }) };
    await notifyStaff(client, {
      type: "hr_document_uploaded",
      applicationId: "a1",
      vars: { applicantName: "Ana Cruz", documentLabel: "Diploma", jobTitle: "Cashier" },
      linkPath: "/admin/screening/v1/a1",
    });
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toMatch(/from public\.user_account\s+where role = any\(\$1::public\.user_role\[\]\) and account_status = \$2/);
    expect(params.slice(0, 2)).toEqual([["admin", "hr"], "active"]);
  });
});
