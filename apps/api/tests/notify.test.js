// Notification templates (docs/TRD.md §9): no company names, neutral shortlist wording.
import { describe, expect, it, vi } from "vitest";

import { messageFor, notify } from "../src/domain/notify.js";

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
      documentLabel: "NBI clearance",
      reason: "The copy is blurred.",
      dueAt: "2026-10-11T04:00:00.000Z",
    });
    expect(title).toBe("Document requested: NBI clearance");
    expect(message).toBe(
      "For your application for Cashier, please upload your NBI clearance by Oct 11, 2026, 12:00 PM (Philippine time). Reason: The copy is blurred.",
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

  it("passed_confirm_endorsement (S15 Notify): fixed title, HR's body, then the fixed deadline line with the time zone once", () => {
    const body = "You passed the agency assessment for Cashier, and we would like to endorse you to the employer. The employer makes the final hiring decision.";
    const { title, message } = messageFor("passed_confirm_endorsement", {
      jobTitle: "Cashier",
      message: `  ${body}  `,
      actionDueAt: "2026-10-13T06:00:00.000Z",
    });
    expect(title).toBe("Please confirm: Cashier");
    expect(message).toBe(`${body} Please confirm on your dashboard by Oct 13, 2026, 2:00 PM (Philippine time).`);
    expect(message.match(/\(Philippine time\)/g)).toHaveLength(1);
    expect(message).toContain("final hiring decision");
    expect(`${title} ${message}`).not.toMatch(NO_LEAK);
    expect(`${title} ${message}`).not.toMatch(/congratulations|congrats|!|hired/i);
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

  it("S16 endorsed / hired: may sound positive, never the company, a score, or the word 'congratulations'", () => {
    const endorsed = messageFor("endorsed", { jobTitle: "Cashier" });
    expect(endorsed).toEqual({
      title: "Sent to the employer: Cashier",
      message: "The agency sent your profile to the employer for Cashier. The employer makes the final hiring decision. We will tell you the result.",
    });
    const hired = messageFor("hired", { jobTitle: "Cashier" });
    expect(hired).toEqual({
      title: "Hired: Cashier",
      message: "You are hired for Cashier. The agency will contact you about the next steps.",
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

  it("interview_rescheduled ends with the contact line; the confirm line only while unconfirmed", () => {
    const vars = { jobTitle: "Store Crew", scheduledAt: "2026-10-12T02:00:00.000Z", durationMinutes: 45 };
    const confirmed = messageFor("interview_rescheduled", vars).message;
    expect(confirmed).toBe(
      "Your online interview for Store Crew is now on Oct 12, 2026, 10:00 AM (Philippine time) (45 minutes). " +
        "If you can't attend at the new time, please contact Confiable Manpower.",
    );
    const pending = messageFor("interview_rescheduled", { ...vars, confirmDueAt: "2026-10-11T02:00:00.000Z" }).message;
    expect(pending).toMatch(/Please confirm it on your dashboard by Oct 11, 2026, 10:00 AM \(Philippine time\)\. If you can't attend/);
    expect(pending.endsWith("If you can't attend at the new time, please contact Confiable Manpower.")).toBe(true);
  });

  it("notifyStaff writes one row per active HR/admin account", async () => {
    const { notifyStaff } = await import("../src/domain/notify.js");
    const client = { query: vi.fn().mockResolvedValue({ rowCount: 2 }) };
    await notifyStaff(client, {
      type: "hr_document_uploaded",
      applicationId: "a1",
      vars: { applicantName: "Ana Cruz", documentLabel: "NBI clearance", jobTitle: "Cashier" },
      linkPath: "/admin/screening/v1/a1",
    });
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toMatch(/from public\.user_account\s+where role = any\(\$1::public\.user_role\[\]\) and account_status = \$2/);
    expect(params.slice(0, 2)).toEqual([["admin", "hr"], "active"]);
  });
});
