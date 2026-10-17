// POST /api/applicant/resume/replace (decision 16; PRD FR-PROF-06/07, BR-13; TC-16, TC-17).
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

const txClient = { query: vi.fn() };
vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/db/tx.js", () => ({ withTransaction: vi.fn(async (_actor, fn) => fn(txClient)) }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));
vi.mock("../src/lib/storage.js", () => ({
  uploadFile: vi.fn(async () => {}),
  moveFile: vi.fn(async () => {}),
  removeFiles: vi.fn(async () => {}),
  signedUrl: vi.fn(async () => "https://signed"),
}));

const { pool } = await import("../src/db/pool.js");
const { withTransaction } = await import("../src/db/tx.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const storage = await import("../src/lib/storage.js");
const { app } = await import("../src/app.js");

const APPLICANT_ID = "22222222-2222-4222-8222-222222222222";
const NEW_RESUME = "33333333-3333-4333-8333-333333333334";
const DRAFT = {
  filePath: `drafts/${USER_ID}/abc.pdf`,
  originalFilename: "Juan_2026.pdf",
  fileSizeBytes: 4096,
  extraction: { standardizedText: "JUAN ...", sections: { skills: "Cash handling" }, yearsExperience: 1, profile: {}, warnings: [] },
};
const CURRENT_VIEW = {
  resumeId: NEW_RESUME,
  filePath: `${APPLICANT_ID}/abc.pdf`,
  fileName: "Juan_2026.pdf",
  fileSizeBytes: 4096,
  uploadedAt: "2026-10-18T01:00:00Z",
  verificationStatus: "pending",
  verificationRemarks: null,
};

let role;
let applicantId;
let draft;
let pendingOffer;
let pendingInTx;
let txCalls;

const replace = () => request(app).post("/api/applicant/resume/replace").set("Authorization", "Bearer t");
const txIndex = (start) => txCalls.findIndex((c) => c.sql.startsWith(start));

beforeEach(() => {
  vi.clearAllMocks();
  role = "applicant";
  applicantId = APPLICANT_ID;
  draft = DRAFT;
  pendingOffer = false;
  pendingInTx = undefined;
  txCalls = [];

  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  pool.query.mockImplementation(async (sql) => {
    if (sql.includes("from public.user_account")) return { rows: [account({ role })] };
    if (sql.includes('select applicant_id as "applicantId" from public.applicant')) return { rows: applicantId ? [{ applicantId }] : [] };
    if (sql.includes("from public.resume_draft")) return { rows: draft ? [draft] : [] };
    if (sql.includes("from public.pool_invitation")) return { rows: pendingOffer ? [{}] : [] };
    if (sql.includes("from public.resume r")) return { rows: [CURRENT_VIEW] };
    return { rows: [] };
  });
  txClient.query.mockImplementation(async (sql, params) => {
    txCalls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    if (sql.includes("from public.pool_invitation")) {
      const seen = pendingInTx === undefined ? pendingOffer : pendingInTx;
      return { rows: seen ? [{}] : [] };
    }
    if (sql.includes("insert into public.resume ")) return { rows: [{ resumeId: NEW_RESUME }] };
    return { rows: [], rowCount: 1 };
  });
});

describe("POST /api/applicant/resume/replace", () => {
  it("archives the old resume, saves the new one unverified with its extraction, and leaves the profile alone", async () => {
    const res = await replace();

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      resumeId: NEW_RESUME,
      fileName: "Juan_2026.pdf",
      fileSizeBytes: 4096,
      uploadedAt: "2026-10-18T01:00:00Z",
      verificationStatus: "pending",
      verificationRemarks: null,
    });
    expect(storage.moveFile).toHaveBeenCalledWith("resumes", DRAFT.filePath, `${APPLICANT_ID}/abc.pdf`);
    expect(storage.moveFile.mock.invocationCallOrder[0]).toBeLessThan(withTransaction.mock.invocationCallOrder[0]);

    // One transaction: lock → re-check offers → archive → insert resume → extraction → delete draft.
    const order = [
      txIndex("select 1 from public.applicant where applicant_id = $1 for update"),
      txCalls.findIndex((c) => c.sql.includes("from public.pool_invitation")),
      txIndex("update public.resume set is_current = false, archived_at = now()"),
      txIndex("insert into public.resume "),
      txIndex("insert into public.resume_extraction"),
      txIndex("delete from public.resume_draft"),
    ];
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(txCalls[order[0]].params).toEqual([APPLICANT_ID]);
    expect(txCalls[order[2]].params).toEqual([APPLICANT_ID]);
    expect(txCalls[order[3]].params).toEqual([APPLICANT_ID, `${APPLICANT_ID}/abc.pdf`, "Juan_2026.pdf", 4096]);
    expect(txCalls[order[4]].params[0]).toBe(NEW_RESUME);

    // Profile unchanged; existing applications untouched (they keep application.resume_id).
    expect(txCalls.some((c) => c.sql.startsWith("update public.applicant"))).toBe(false);
    expect(txCalls.some((c) => c.sql.startsWith("update public.application"))).toBe(false);
    expect(storage.moveFile).toHaveBeenCalledTimes(1); // never moved back
  });

  it("no draft → 422 and nothing moved or written", async () => {
    draft = null;
    const res = await replace();
    expect(res.status).toBe(422);
    expect(res.body.error.message).toBe("Upload your new resume first.");
    expect(storage.moveFile).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("a pending job offer or invitation → 409 before anything is moved", async () => {
    pendingOffer = true;
    const res = await replace();
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("Answer your pending job offer or invitation first.");
    expect(storage.moveFile).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("an offer that arrived meanwhile is caught under the lock: 409, file moved back, no resume written", async () => {
    pendingInTx = true;
    const res = await replace();
    expect(res.status).toBe(409);
    expect(txCalls.some((c) => c.sql.includes("from public.pool_invitation"))).toBe(true);
    expect(txIndex("update public.resume")).toBe(-1);
    expect(storage.moveFile).toHaveBeenLastCalledWith("resumes", `${APPLICANT_ID}/abc.pdf`, DRAFT.filePath);
  });

  it("a failed transaction moves the file back to drafts", async () => {
    const base = txClient.query.getMockImplementation();
    txClient.query.mockImplementation(async (sql, params) => {
      if (sql.includes("insert into public.resume_extraction")) throw new Error("db down");
      return base(sql, params);
    });
    const res = await replace();
    expect(res.status).toBe(500);
    expect(storage.moveFile).toHaveBeenCalledTimes(2);
    expect(storage.moveFile).toHaveBeenLastCalledWith("resumes", `${APPLICANT_ID}/abc.pdf`, DRAFT.filePath);
  });

  it("needs a confirmed profile", async () => {
    applicantId = null;
    const res = await replace();
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("Confirm your profile before replacing your resume.");
    expect(storage.moveFile).not.toHaveBeenCalled();
  });

  it("is for applicants only", async () => {
    role = "hr";
    const res = await replace();
    expect(res.status).toBe(403);
    expect(withTransaction).not.toHaveBeenCalled();
  });
});
