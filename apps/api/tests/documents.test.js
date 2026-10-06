// Supporting documents (FR-DOC-01, 02, 04; TC-18, TC-19) and the resume view.
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
  signedUrl: vi.fn(async (bucket, path) => `https://storage.test/${bucket}/${path}?token=t`),
}));

const { pool } = await import("../src/db/pool.js");
const { withTransaction } = await import("../src/db/tx.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const storage = await import("../src/lib/storage.js");
const { app } = await import("../src/app.js");

const APPLICANT_ID = "22222222-2222-4222-8222-222222222222";
const TOR_ID = "33333333-3333-4333-8333-333333333333";
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(200)]);

const TOR = {
  documentId: TOR_ID,
  documentType: "transcript_of_records",
  label: null,
  fileName: "TOR.pdf",
  fileSizeBytes: 2000,
  uploadedAt: "2026-10-08T01:14:00.000Z",
  verificationStatus: "pending",
  verificationRemarks: null,
  filePath: `${APPLICANT_ID}/tor.pdf`,
};

let currentDocuments;

beforeEach(() => {
  vi.clearAllMocks();
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  currentDocuments = [TOR];
  pool.query.mockImplementation(async (sql, params) => {
    if (sql.includes("from public.user_account")) return { rows: [account()] };
    if (sql.includes("select applicant_id")) return { rows: [{ applicantId: APPLICANT_ID }] };
    if (sql.includes("supporting_document_id = $2")) {
      return { rows: currentDocuments.filter((d) => d.documentId === params[1]) };
    }
    if (sql.includes("from public.supporting_document")) {
      return { rows: currentDocuments.map(({ filePath: _p, ...d }) => d) };
    }
    if (sql.includes("from public.resume r")) {
      return {
        rows: [
          {
            resumeId: "r1",
            filePath: `${APPLICANT_ID}/resume.pdf`,
            fileName: "Juan_Resume.pdf",
            fileSizeBytes: 12345,
            uploadedAt: "2026-10-07T02:00:00.000Z",
            verificationStatus: "pending",
            verificationRemarks: null,
          },
        ],
      };
    }
    return { rows: [] };
  });
  txClient.query.mockImplementation(async (sql, params) =>
    sql.includes("insert into public.supporting_document")
      ? { rows: [{ documentId: "new-doc", documentType: params[1], label: params[2], verificationStatus: "pending" }] }
      : { rows: [] },
  );
});

const upload = (fields, file = PDF, name = "doc.pdf") => {
  let req = request(app).post("/api/applicant/documents").set("Authorization", "Bearer t");
  for (const [key, value] of Object.entries(fields)) req = req.field(key, value);
  return req.attach("file", file, { filename: name, contentType: "application/pdf" });
};
const txSql = () => txClient.query.mock.calls.map(([sql]) => sql.replace(/\s+/g, " ").trim());

describe("POST /api/applicant/documents", () => {
  it("stores the PDF and inserts a pending document in a transaction (TC-18)", async () => {
    currentDocuments = [];
    const res = await upload({ documentType: "nbi_clearance" });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ documentType: "nbi_clearance", verificationStatus: "pending" });
    expect(storage.uploadFile).toHaveBeenCalledWith(
      "documents",
      expect.stringMatching(new RegExp(`^${APPLICANT_ID}/[0-9a-f-]{36}\\.pdf$`)),
      expect.any(Buffer),
    );
    expect(withTransaction).toHaveBeenCalledWith(USER_ID, expect.any(Function));
    const insertParams = txClient.query.mock.calls.at(-1)[1];
    expect(insertParams.slice(0, 3)).toEqual([APPLICANT_ID, "nbi_clearance", null]);
    expect(insertParams[4]).toBe("doc.pdf");
  });

  it("replaces the current document of the same type (TC-19)", async () => {
    const res = await upload({ documentType: "transcript_of_records" });

    expect(res.status).toBe(201);
    const sql = txSql();
    expect(sql[0]).toMatch(/^update public\.supporting_document set is_current = false, replaced_at = now\(\) where applicant_id = \$1 and document_type = \$2/);
    expect(txClient.query.mock.calls[0][1]).toEqual([APPLICANT_ID, "transcript_of_records"]);
    expect(sql[1]).toMatch(/^insert into public\.supporting_document/);
  });

  it("keeps earlier certificates (several allowed)", async () => {
    await upload({ documentType: "certificate", label: "Food safety training" });
    expect(txSql().some((sql) => sql.startsWith("update"))).toBe(false);
    expect(txClient.query.mock.calls.at(-1)[1][2]).toBe("Food safety training");
  });

  it("re-uploads a specific row through replacesDocumentId", async () => {
    const res = await upload({ documentType: "transcript_of_records", replacesDocumentId: TOR_ID });
    expect(res.status).toBe(201);
    expect(txSql()[0]).toMatch(/supporting_document_id = \$2/);
    expect(txClient.query.mock.calls[0][1]).toEqual([APPLICANT_ID, TOR_ID]);
  });

  it("rejects a re-upload of another applicant's (or unknown) document", async () => {
    const res = await upload({ documentType: "transcript_of_records", replacesDocumentId: "44444444-4444-4444-8444-444444444444" });
    expect(res.status).toBe(404);
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it("rejects a re-upload with a different type", async () => {
    const res = await upload({ documentType: "diploma", replacesDocumentId: TOR_ID });
    expect(res.status).toBe(400);
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it.each([
    ["Other without a label", { documentType: "other" }, "label"],
    ["the resume type", { documentType: "resume" }, "documentType"],
    ["no type", {}, "documentType"],
  ])("rejects %s", async (_label, fields, path) => {
    const res = await upload(fields);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(path);
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it("rejects a non-PDF file", async () => {
    const res = await upload({ documentType: "diploma" }, Buffer.from("not a pdf"));
    expect(res.status).toBe(400);
  });

  it("removes the stored file when the transaction fails", async () => {
    withTransaction.mockRejectedValueOnce(new Error("db down"));
    const res = await upload({ documentType: "diploma" });
    expect(res.status).toBe(500);
    expect(storage.removeFiles).toHaveBeenCalledWith("documents", [expect.stringMatching(new RegExp(`^${APPLICANT_ID}/`))]);
  });
});

describe("GET /api/applicant/documents", () => {
  it("lists the current documents without storage paths", async () => {
    const res = await request(app).get("/api/applicant/documents").set("Authorization", "Bearer t");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).not.toHaveProperty("filePath");
    expect(res.body.data[0]).toMatchObject({ documentType: "transcript_of_records", verificationStatus: "pending" });
  });
});

describe("signed URLs", () => {
  it("returns a short-lived link to the applicant's own document", async () => {
    const res = await request(app).get(`/api/applicant/documents/${TOR_ID}/url`).set("Authorization", "Bearer t");
    expect(res.status).toBe(200);
    expect(res.body.data.url).toContain(`documents/${APPLICANT_ID}/tor.pdf`);
    expect(storage.signedUrl).toHaveBeenCalledWith("documents", `${APPLICANT_ID}/tor.pdf`);
  });

  it("is 404 for a document that is not theirs", async () => {
    const res = await request(app)
      .get("/api/applicant/documents/44444444-4444-4444-8444-444444444444/url")
      .set("Authorization", "Bearer t");
    expect(res.status).toBe(404);
    expect(storage.signedUrl).not.toHaveBeenCalled();
  });

  it("returns the current resume and a link to it", async () => {
    const meta = await request(app).get("/api/applicant/resume").set("Authorization", "Bearer t");
    expect(meta.body.data).toEqual({
      resumeId: "r1",
      fileName: "Juan_Resume.pdf",
      fileSizeBytes: 12345,
      uploadedAt: "2026-10-07T02:00:00.000Z",
      verificationStatus: "pending",
      verificationRemarks: null,
    });
    const link = await request(app).get("/api/applicant/resume/url").set("Authorization", "Bearer t");
    expect(link.body.data.url).toContain(`resumes/${APPLICANT_ID}/resume.pdf`);
  });
});
