// Resume Screening (PRD FR-SCR-01..06; TC-35..40, TC-42, TC-75): shortlist view, review sheet, verification
// (lock on the first HR action), document requests, Drop + refill, and the global lock order.
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

const txClient = { query: vi.fn() };
vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/db/tx.js", () => ({ withTransaction: vi.fn(async (_actor, fn) => fn(txClient)) }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));
vi.mock("../src/lib/storage.js", () => ({
  uploadFile: vi.fn(),
  moveFile: vi.fn(),
  removeFiles: vi.fn(),
  signedUrl: vi.fn(async (bucket, path) => `https://storage.test/${bucket}/${path}?token=t`),
}));

const { pool } = await import("../src/db/pool.js");
const { withTransaction } = await import("../src/db/tx.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { app } = await import("../src/app.js");

const VACANCY_ID = "66666666-6666-4666-8666-666666666666";
const APP_ID = "77777777-7777-4777-8777-777777777777";
const APPLICANT_ID = "22222222-2222-4222-8222-222222222222";
const APPLICANT_USER = "88888888-8888-4888-8888-888888888888";
const RESUME_ID = "33333333-3333-4333-8333-333333333333";
const DOC_ID = "44444444-4444-4444-8444-444444444444";
const NEXT_APP = "99999999-9999-4999-8999-999999999999";

let role;
let appRow;
let resume;
let documents;
let requests;
let reuse;
let owner;
let lockedApp;
let screeningRows;
let txCalls;

const hrApp = (overrides = {}) => ({
  applicationId: APP_ID,
  applicantId: APPLICANT_ID,
  vacancyId: VACANCY_ID,
  applicantType: "experienced",
  status: "shortlisted",
  statusReason: null,
  appliedAt: "2026-10-08T01:00:00.000Z",
  verificationStartedAt: null,
  applicationSource: "direct",
  jobTitle: "Cashier",
  companyName: "Kabayan Mart",
  userId: APPLICANT_USER,
  firstName: "Ana",
  middleName: null,
  lastName: "Cruz",
  suffix: null,
  email: "ana@vera.test",
  contactNumber: null,
  age: 24,
  gender: "female",
  educationLevel: "college_graduate",
  heightCm: 158,
  addressLine: "1 Rizal St",
  city: "Baliuag",
  province: "Bulacan",
  matchingScore: 79.31,
  skillsScore: 87.5,
  experienceScore: 71.11,
  yearsExperience: 0.5,
  matchedSkills: ["Handling cash and giving correct change"],
  missingSkills: [],
  skillMatches: [],
  experienceMatches: [],
  weights: { skills: 0.5, experience: 0.5 },
  modelName: "all-MiniLM-L6-v2",
  ...overrides,
});
const row = (overrides) => ({
  applicationId: APP_ID,
  applicantType: "experienced",
  status: "shortlisted",
  statusReason: null,
  appliedAt: "2026-10-08T01:00:00.000Z",
  verificationStartedAt: null,
  applicantName: "Ana Cruz",
  matchingScore: 79.31,
  resumeStatus: "verified",
  documentStatuses: ["verified"],
  newUploads: 0,
  pendingRequests: 0,
  ratingsOnFile: false,
  ...overrides,
});

const hr = (method, path) => request(app)[method](path).set("Authorization", "Bearer t");
const txSql = (start) => txCalls.filter((c) => c.sql.startsWith(start));
// Which table each "for update" locks, in order (the main FROM is the last one: lockVacancy has a subquery first).
const lockSequence = () =>
  txCalls.filter((c) => c.sql.endsWith("for update")).map((c) => [...c.sql.matchAll(/ from public\.(\w+)/g)].at(-1)[1]);

beforeEach(() => {
  vi.clearAllMocks();
  role = "hr";
  appRow = hrApp();
  resume = { resumeId: RESUME_ID, fileName: "Ana.pdf", verificationStatus: "verified", filePath: `${APPLICANT_ID}/r.pdf` };
  documents = [{ documentId: DOC_ID, documentType: "nbi_clearance", verificationStatus: "verified", newUpload: false }];
  requests = [];
  reuse = [];
  owner = APPLICANT_ID;
  lockedApp = { applicationId: APP_ID, applicantId: APPLICANT_ID, vacancyId: VACANCY_ID, applicantType: "experienced", status: "shortlisted", verificationStartedAt: null };
  screeningRows = [];
  txCalls = [];

  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  pool.query.mockImplementation(async (sql) => {
    if (sql.includes("from public.user_account")) return { rows: [account({ role })] };
    if (sql.includes("join public.v_applicant_profile p")) return { rows: appRow ? [appRow] : [] };
    if (sql.includes("from public.resume\n") && sql.includes("is_current`") === false && sql.includes("original_filename")) return { rows: resume ? [resume] : [] };
    if (sql.includes('as "newUpload"')) return { rows: documents };
    if (sql.includes("from public.document_request\n")) return { rows: requests };
    if (sql.includes("with latest as")) return { rows: reuse };
    if (sql.includes('select applicant_id as "applicantId" from public.resume')) return { rows: owner ? [{ applicantId: owner }] : [] };
    if (sql.includes('select applicant_id as "applicantId" from public.supporting_document')) return { rows: owner ? [{ applicantId: owner }] : [] };
    if (sql.includes('as "firstTimeShortlisted"')) return { rows: [{ vacancyId: VACANCY_ID, jobTitle: "Cashier", companyName: "Kabayan Mart", quota: 4 }] };
    if (sql.includes('as "matchingThreshold"')) return { rows: [{ vacancyId: VACANCY_ID, jobTitle: "Cashier", companyName: "Kabayan Mart", quota: 4, slotsNeeded: 2 }] };
    if (sql.includes('as "documentStatuses"')) return { rows: screeningRows };
    if (sql.includes('file_path as "filePath"') && sql.includes("supporting_document")) {
      return { rows: [{ documentId: DOC_ID, documentType: "nbi_clearance", filePath: `${APPLICANT_ID}/nbi.pdf` }] };
    }
    return { rows: [] };
  });
  txClient.query.mockImplementation(async (sql, params) => {
    txCalls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
    if (sql.includes("application_cap") && sql.includes("for update")) return { rows: [{ status: "open", applicationCap: 16, applicationCount: 5 }] };
    if (sql.includes("from public.application where application_id = $1 for update")) return { rows: lockedApp ? [lockedApp] : [] };
    if (sql.includes("shortlist_per_group") && sql.includes("for update")) return { rows: [{ quota: 4, jobTitle: "Cashier" }] };
    if (sql.includes('as "occupied"')) return { rows: [{ occupied: 0 }] };
    if (sql.includes("join public.matching_result")) {
      return { rows: [{ applicationId: NEXT_APP, status: "waiting_pool", matchingScore: 70, appliedAt: "2026-10-08T02:00:00Z", userId: "u-next" }] };
    }
    if (sql.includes("current_setting('vera.actor_id'")) return { rows: [{ actor: USER_ID }] };
    if (sql.includes("from public.system_setting")) return { rows: [{ days: 3 }] };
    if (sql.includes('file_path as "filePath"')) return { rows: [{ documentId: DOC_ID, documentType: "nbi_clearance", filePath: "x" }] };
    if (sql.includes("insert into public.document_request")) return { rows: [{ requestId: "q1", dueAt: params[6] }] };
    return { rows: [], rowCount: 1 };
  });
});

describe("roles", () => {
  it("admin can do everything HR can (PRD §2): screening list, vacancy view, review sheet, and actions", async () => {
    role = "admin";
    expect((await hr("get", "/api/admin/screening")).status).toBe(200);
    expect((await hr("get", `/api/admin/screening/${VACANCY_ID}`)).status).toBe(200);
    expect((await hr("get", `/api/admin/applications/${APP_ID}`)).status).toBe(200);
    const verify = await hr("patch", `/api/admin/resumes/${RESUME_ID}/verification`).send({ status: "verified", applicationId: APP_ID });
    expect(verify.status).toBe(200);
  });

  it("TC-10: applicants cannot use screening", async () => {
    role = "applicant";
    expect((await hr("get", "/api/admin/screening")).status).toBe(403);
    expect((await hr("get", `/api/admin/applications/${APP_ID}`)).status).toBe(403);
  });
});

describe("GET /api/admin/screening/:vacancyId (FR-SCR-01; TC-35, TC-37)", () => {
  it("returns both groups with quota, locked markers, verification progress, the waiting pool, and the not-shortlisted lists", async () => {
    screeningRows = [
      row({ applicationId: "a1", matchingScore: 70, verificationStartedAt: "2026-10-08T03:00:00Z" }),
      row({ applicationId: "a2", matchingScore: 90, documentStatuses: ["verified", "pending"], newUploads: 1 }),
      row({ applicationId: "a3", status: "waiting_pool", matchingScore: 60 }),
      row({ applicationId: "a4", applicantType: "first_time", matchingScore: 88, ratingsOnFile: true }),
      row({ applicationId: "a5", status: "prescreen_failed", matchingScore: null, statusReason: "Age must be between 18 and 35 (you are 40)." }),
      row({ applicationId: "a6", status: "below_threshold", matchingScore: 21.4, statusReason: "Matching score 21.4 is below the threshold 40." }),
    ];
    const res = await hr("get", `/api/admin/screening/${VACANCY_ID}`);
    expect(res.status).toBe(200);
    const { vacancy, groups, notShortlisted } = res.body.data;
    expect(vacancy).toMatchObject({ companyName: "Kabayan Mart", quota: 4 }); // HR sees the company

    const exp = groups.experienced;
    expect(exp.quota).toBe(4);
    expect(exp.shortlisted.map((s) => s.applicationId)).toEqual(["a2", "a1"]); // matching desc
    expect(exp.shortlisted[1]).toMatchObject({ locked: true, fullyVerified: true, documentsVerified: 1, documentsTotal: 1 });
    expect(exp.shortlisted[0]).toMatchObject({ locked: false, fullyVerified: false, newUploads: 1 }); // "New upload to verify"
    expect(exp.waitingPool.map((s) => s.applicationId)).toEqual(["a3"]);
    expect(groups.first_time.shortlisted[0]).toMatchObject({ applicationId: "a4", ratingsOnFile: true });

    expect(notShortlisted.prescreenFailed).toEqual([
      expect.objectContaining({ applicationId: "a5", reason: "Age must be between 18 and 35 (you are 40).", matchingScore: null }),
    ]);
    expect(notShortlisted.belowThreshold).toEqual([expect.objectContaining({ applicationId: "a6", matchingScore: 21.4 })]);
  });

  it("is 404 for an unknown vacancy", async () => {
    pool.query.mockImplementationOnce(async () => ({ rows: [account({ role })] })).mockImplementationOnce(async () => ({ rows: [] }));
    expect((await hr("get", `/api/admin/screening/${VACANCY_ID}`)).status).toBe(404);
  });
});

describe("GET /api/admin/applications/:id (FR-SCR-02, FR-SCR-06; TC-42)", () => {
  it("returns the review sheet: applicant, company, matching details, documents, and the next step", async () => {
    documents = [{ documentId: DOC_ID, documentType: "nbi_clearance", verificationStatus: "pending", newUpload: true }];
    const res = await hr("get", `/api/admin/applications/${APP_ID}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.vacancy).toEqual({ vacancyId: VACANCY_ID, jobTitle: "Cashier", companyName: "Kabayan Mart" });
    expect(data.matching).toMatchObject({ matchingScore: 79.31, matchedSkills: ["Handling cash and giving correct change"] });
    expect(data.documents[0].newUpload).toBe(true);
    expect(data.resume).not.toHaveProperty("filePath");
    expect(data.fullyVerified).toBe(false);
    expect(data.nextStep).toBeNull(); // TC-42: a pending document keeps the next step closed
  });

  it("fully verified, no earlier evaluation → next step = schedule interview (S13 placeholder)", async () => {
    const res = await hr("get", `/api/admin/applications/${APP_ID}`);
    expect(res.body.data).toMatchObject({ fullyVerified: true, nextStep: "schedule_interview", reusableEvaluation: null });
  });

  it("fully verified with ratings on file → next step = reuse ratings, with the chain-resolved source (BR-21)", async () => {
    reuse = [{ sourceApplicationId: "orig", jobTitle: "Cashier", companyName: "Kabayan Mart", ratedAt: "2026-10-09T01:00:00Z" }];
    const res = await hr("get", `/api/admin/applications/${APP_ID}`);
    expect(res.body.data.nextStep).toBe("reuse_ratings");
    expect(res.body.data.reusableEvaluation).toEqual(reuse[0]);
    const lookup = pool.query.mock.calls.find(([sql]) => sql.includes("with latest as"));
    expect(lookup[1]).toEqual([APPLICANT_ID, APP_ID]);
  });

  it("a pending request keeps it not fully verified (FR-SCR-06)", async () => {
    requests = [{ requestId: "q1", status: "pending" }];
    expect((await hr("get", `/api/admin/applications/${APP_ID}`)).body.data.fullyVerified).toBe(false);
  });

  it("signed links come from the right buckets and only for this applicant's current files", async () => {
    const resumeLink = await hr("get", `/api/admin/applications/${APP_ID}/resume/url`);
    expect(resumeLink.body.data.url).toContain(`resumes/${APPLICANT_ID}/r.pdf`);
    const docLink = await hr("get", `/api/admin/applications/${APP_ID}/documents/${DOC_ID}/url`);
    expect(docLink.body.data.url).toContain(`documents/${APPLICANT_ID}/nbi.pdf`);
    const lookup = pool.query.mock.calls.find(([sql]) => sql.includes('file_path as "filePath"') && sql.includes("supporting_document"));
    expect(lookup[1]).toEqual([APPLICANT_ID, DOC_ID]);
  });
});

describe("verification (FR-SCR-02/03; TC-38)", () => {
  const verify = (path, body) => hr("patch", path).send(body);

  it("marks the resume verified, records HR, and locks the slot on the first action", async () => {
    const res = await verify(`/api/admin/resumes/${RESUME_ID}/verification`, { status: "verified", applicationId: APP_ID });
    expect(res.status).toBe(200);
    expect(withTransaction).toHaveBeenCalledWith(USER_ID, expect.any(Function)); // HR is the actor
    expect(lockSequence()).toEqual(["job_vacancy", "application"]); // global order, applicant row not needed
    const start = txSql("update public.application set verification_started_at = now()");
    expect(start[0].sql).toMatch(/verification_started_at is null/); // only the first action sets it
    const update = txSql("update public.resume");
    expect(update[0].params).toEqual([RESUME_ID, APPLICANT_ID, "verified", null, USER_ID]);
  });

  it("rejects a document only with remarks; nothing is dropped automatically", async () => {
    expect((await verify(`/api/admin/documents/${DOC_ID}/verification`, { status: "rejected", applicationId: APP_ID })).status).toBe(400);
    const res = await verify(`/api/admin/documents/${DOC_ID}/verification`, {
      status: "rejected",
      remarks: "Expired NBI clearance.",
      applicationId: APP_ID,
    });
    expect(res.status).toBe(200);
    expect(txSql("update public.supporting_document")[0].params).toEqual([DOC_ID, APPLICANT_ID, "rejected", "Expired NBI clearance.", USER_ID]);
    expect(txSql("update public.application set status")).toHaveLength(0);
  });

  it("refuses a document of another applicant", async () => {
    owner = "someone-else";
    const res = await verify(`/api/admin/documents/${DOC_ID}/verification`, { status: "verified", applicationId: APP_ID });
    expect(res.status).toBe(422);
    expect(txSql("update public.supporting_document")).toHaveLength(0);
  });

  it("refuses when the application left screening (e.g. displaced or dropped meanwhile)", async () => {
    lockedApp = { ...lockedApp, status: "waiting_pool" };
    const res = await verify(`/api/admin/resumes/${RESUME_ID}/verification`, { status: "verified", applicationId: APP_ID });
    expect(res.status).toBe(409);
    expect(txSql("update")).toHaveLength(0);
  });
});

describe("document requests (FR-SCR-04; TC-39)", () => {
  const ask = (body) => hr("post", "/api/admin/document-requests").send(body);

  it("creates the request with the setting's deadline, marks the target for re-upload, notifies, and locks the slot", async () => {
    const before = Date.now();
    const res = await ask({ applicationId: APP_ID, documentType: "nbi_clearance", targetDocumentId: DOC_ID, reason: "The copy is blurred." });
    expect(res.status).toBe(201);
    const insert = txSql("insert into public.document_request")[0];
    expect(insert.params.slice(0, 6)).toEqual([APPLICANT_ID, APP_ID, "nbi_clearance", DOC_ID, "The copy is blurred.", USER_ID]);
    const days = (new Date(insert.params[6]).getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(2.99);
    expect(days).toBeLessThan(3.01);
    expect(txSql("update public.supporting_document")[0].sql).toMatch(/verification_status = 'reupload_requested'/);
    expect(txSql("update public.application set verification_started_at")).toHaveLength(1);
    const notice = txSql("insert into public.notification")[0];
    expect(notice.params).toEqual([
      APPLICANT_USER,
      APP_ID,
      "document_requested",
      "Document requested: NBI clearance",
      expect.stringContaining("Reason: The copy is blurred."),
      "/applicant/documents",
      true,
    ]);
    expect(notice.params[4]).not.toMatch(/kabayan/i);
  });

  it("refuses the resume type while resume replacement is deferred", async () => {
    const res = await ask({ applicationId: APP_ID, documentType: "resume", reason: "Unreadable" });
    expect(res.status).toBe(400);
  });

  it("requires a reason", async () => {
    expect((await ask({ applicationId: APP_ID, documentType: "valid_id", reason: "" })).status).toBe(400);
  });

  it("DELETE withdraws only a pending request", async () => {
    expect((await hr("delete", "/api/admin/document-requests/55555555-5555-4555-8555-555555555555")).status).toBe(404);
  });
});

describe("POST /api/admin/applications/:id/drop (FR-SCR-05 simplified; TC-75)", () => {
  it("drops with the reason, cancels requests, notifies without company or reason, and refills from the waiting pool", async () => {
    const res = await hr("post", `/api/admin/applications/${APP_ID}/drop`).send({ reason: "failed_verification", remarks: "Fake NBI clearance" });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ applicationId: APP_ID, status: "dropped", promoted: [NEXT_APP] });

    // Global lock order, before any write.
    expect(lockSequence().slice(0, 3)).toEqual(["job_vacancy", "applicant", "application"]);

    const [dropped, promoted] = txSql("update public.application set status");
    expect(dropped.params).toEqual([APP_ID, "shortlisted", "dropped", "Dropped by HR: Failed document verification — Fake NBI clearance"]);
    expect(promoted.params).toEqual([NEXT_APP, "waiting_pool", "shortlisted", "shortlist refresh"]);

    // HR is the actor for the drop; the refill runs as the system (actor cleared before it).
    const clear = txCalls.findIndex((c) => c.sql === "select set_config('vera.actor_id', '', true)");
    expect(txCalls.indexOf(dropped)).toBeLessThan(clear);
    expect(txCalls.indexOf(promoted)).toBeGreaterThan(clear);

    expect(txSql("update public.document_request set status = 'cancelled'")).toHaveLength(1);
    const notice = txSql("insert into public.notification")[0];
    expect(notice.params[2]).toBe("application_dropped");
    expect(notice.params[4]).toBe("Your application for Cashier has been closed. You can apply to other jobs.");
  });

  it("only from screening", async () => {
    lockedApp = { ...lockedApp, status: "interview_scheduled" };
    expect((await hr("post", `/api/admin/applications/${APP_ID}/drop`).send({ reason: "no_response" })).status).toBe(409);
  });

  it("requires a known reason", async () => {
    expect((await hr("post", `/api/admin/applications/${APP_ID}/drop`).send({ reason: "because" })).status).toBe(400);
  });
});
