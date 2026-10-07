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
    expect(params).toEqual(["u1", "a1", "application_submitted", "Application received", expect.stringContaining("Cashier"), "/applicant"]);
  });
});
