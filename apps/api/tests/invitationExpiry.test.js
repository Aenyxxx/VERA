// Phase 3 (approval change 1): when a vacancy leaves "open", its pending JOB INVITATIONS expire in the same
// transaction (status expired, pool entry available again, neutral notice), so an applicant who never answers does not
// keep the one-pending slot of their pool entry. Rematch offers (kind rematch_offer) are not touched.
import { describe, expect, it } from "vitest";

import { expireJobInvitations } from "../src/domain/invitationExpiry.js";

const VACANCY = "66666666-6666-4666-8666-666666666666";

function fakeClient(expired) {
  const calls = [];
  return {
    calls,
    query: async (sql, params = []) => {
      const flat = sql.replace(/\s+/g, " ").trim();
      calls.push({ sql: flat, params });
      if (flat.startsWith("update public.pool_invitation pi")) return { rows: expired, rowCount: expired.length };
      return { rows: [], rowCount: 1 };
    },
  };
}

describe("expireJobInvitations", () => {
  it("expires only this vacancy's PENDING JOB invitations, frees the pool entries, and tells each applicant neutrally", async () => {
    const client = fakeClient([
      { invitationId: "i1", talentPoolId: "tp1", userId: "u1", jobTitle: "Cashier" },
      { invitationId: "i2", talentPoolId: "tp2", userId: "u2", jobTitle: "Cashier" },
    ]);
    await expect(expireJobInvitations(client, VACANCY)).resolves.toEqual(["i1", "i2"]);

    const [update, pool, ...notices] = client.calls;
    expect(update.sql).toContain("set status = $3::public.invitation_status, responded_at = now()");
    expect(update.sql).toContain("pi.job_vacancy_id = $1::uuid and pi.kind = $2::public.invitation_kind and pi.status = $4::public.invitation_status");
    expect(update.params).toEqual([VACANCY, "job_invitation", "expired", "pending"]); // never rematch_offer
    expect(pool.sql).toBe(
      "update public.talent_pool set availability = $2::public.pool_availability where talent_pool_id = any($1::uuid[]) and removed_at is null and availability = $3::public.pool_availability",
    );
    expect(pool.params).toEqual([["tp1", "tp2"], "available", "invited"]);
    expect(notices.map((n) => n.params.slice(0, 5))).toEqual([
      ["u1", null, "job_invitation_expired", "Job no longer available: Cashier", "The Cashier job you were invited to is no longer available. We keep your profile in our applicant pool. You can apply to other jobs."],
      ["u2", null, "job_invitation_expired", "Job no longer available: Cashier", "The Cashier job you were invited to is no longer available. We keep your profile in our applicant pool. You can apply to other jobs."],
    ]);
  });

  it("nothing pending → one statement, no pool update, no notice", async () => {
    const client = fakeClient([]);
    await expect(expireJobInvitations(client, VACANCY)).resolves.toEqual([]);
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].sql.startsWith("update public.pool_invitation pi")).toBe(true);
  });
});
