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
