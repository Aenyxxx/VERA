// Endorsement packet (decision 21): cover content from the stored rows (own evaluation + own vacancy weights, the
// ratings source's 15 ratings and interview date), never matching / final / rank / company; one merged PDF; file name;
// and the staff-only GET endpoint.
import { PDFDocument } from "pdf-lib";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { account, USER_ID } from "./helpers.js";

vi.mock("../src/db/pool.js", () => ({ pool: { query: vi.fn() } }));
vi.mock("../src/lib/supabaseAdmin.js", () => ({ supabaseAdmin: { auth: { getUser: vi.fn() } } }));
vi.mock("../src/lib/storage.js", async (importOriginal) => ({ ...(await importOriginal()), downloadFile: vi.fn() }));

const { COMPETENCY_SECTIONS, RATING_INTERPRETATIONS } = await import("@vera/shared");
const { pool } = await import("../src/db/pool.js");
const { supabaseAdmin } = await import("../src/lib/supabaseAdmin.js");
const { downloadFile } = await import("../src/lib/storage.js");
const { buildPacket, coverLines, packetContent, packetFileName } = await import("../src/modules/endorsements/packet.js");
const { app } = await import("../src/app.js");

const APP_SC = "c1c1c1c1-0000-4000-8000-000000000001";
const SOURCE = "a0a0a0a0-0000-4000-8000-000000000000";

// The Competency Profile as listRubric returns it; Juan's demo ratings (ALGORITHM.md §6) A 5,4,4 · B 5,5,5,4,4,4,4,4,4 · C 4,4,4.
const RUBRIC = COMPETENCY_SECTIONS.map((s) => ({
  sectionCode: s.code,
  sectionName: s.name,
  items: s.items.map((name, i) => ({ competencyId: `${s.code}${i}`, competencyName: name })),
}));
const JUAN = { A: [5, 4, 4], B: [5, 5, 5, 4, 4, 4, 4, 4, 4], C: [4, 4, 4] };
const RATINGS = RUBRIC.flatMap((s) => s.items.map((item, i) => ({ competencyId: item.competencyId, rating: JUAN[s.sectionCode][i] })));
const STORE_CREW_WEIGHTS = [
  { sectionCode: "A", sectionName: "x", weight: 20, items: [] },
  { sectionCode: "B", sectionName: "x", weight: 80, items: [] },
  { sectionCode: "C", sectionName: "x", weight: 0, items: [] },
];
// A rematch application at Store Crew: its own evaluation (re-weighted 83.33), ratings from the Cashier interview.
const ROW = {
  applicationId: APP_SC, status: "final_interview_scheduled", passed: true, firstName: "Juan", middleName: "Santos", lastName: "Dela Cruz", suffix: null,
  vacancyId: "v-sc", jobTitle: "Store Crew", interviewScore: "83.33", sectionScores: { A: 83.33, B: 83.33, C: 75 },
  sourceApplicationId: SOURCE, interviewDate: "2026-10-08T02:00:00.000Z", resumePath: "resumes/p1/r1.pdf",
};

async function resumePdf(pages) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([300, 400]).drawText(`Resume page ${i + 1}`, { x: 20, y: 300, size: 12 });
  return Buffer.from(await doc.save());
}

describe("packet content (decision 21; Oct 19 change 4)", () => {
  const content = () => packetContent(ROW, RUBRIC, RATINGS);

  it("uses the application's OWN interview score with the SOURCE ratings and interview date; no weights or section scores", () => {
    const c = content();
    expect(c).toEqual({
      fullName: "Juan Santos Dela Cruz",
      jobTitle: "Store Crew",
      interviewDate: ROW.interviewDate,
      interviewScore: 83.33,
      sections: RUBRIC.map((s) => ({
        sectionCode: s.sectionCode,
        sectionName: s.sectionName,
        items: s.items.map((item, i) => ({ name: item.competencyName, rating: JUAN[s.sectionCode][i] })),
      })),
    });
    expect(c.sections.map((s) => [s.sectionCode, s.items.length])).toEqual([["A", 3], ["B", 9], ["C", 3]]);
    expect(c.sections[0].items[0]).toEqual({ name: "Oral Communication/Listening", rating: 5 });
    for (const section of c.sections) expect(Object.keys(section).sort()).toEqual(["items", "sectionCode", "sectionName"]);
  });

  it("a missing rating → 409 (never a partial cover)", () => {
    expect(() => packetContent(ROW, RUBRIC, RATINGS.slice(1))).toThrow(
      expect.objectContaining({ status: 409, message: "The evaluation does not have all Competency Profile ratings." }),
    );
  });

  it("cover lines: ONLY the header, the 15 ratings under their section headings, and the interview score", () => {
    const lines = coverLines(content());
    const text = lines.map((l) => (l.right ? `${l.text} ${l.right}` : l.text));
    expect(text).toEqual([
      "Confiable Manpower Solutions Inc. · VERA",
      "ENDORSEMENT PACKET — Competency Evaluation",
      "Applicant: Juan Santos Dela Cruz",
      "Position: Store Crew",
      "Agency interview date: Oct 8, 2026",
      ...RUBRIC.flatMap((s) => [
        `${s.sectionCode}. ${s.sectionName}`,
        ...s.items.map((item, i) => `${item.competencyName} ${JUAN[s.sectionCode][i]}`),
      ]),
      "Interview score: 83.33 / 100",
    ]);
    expect(text).toContain("A. Communication and Interpersonal Skills");
    expect(text).toContain("Oral Communication/Listening 5");
    expect(lines.filter((l) => l.right)).toHaveLength(15);

    // the client never sees how the score is computed (Oct 19), nor internal data
    const all = text.join("\n");
    expect(all).not.toMatch(/weight|section score|mean rating|rating scale|x 100|%|generated|resume follows/i);
    for (const n of [1, 2, 3, 4, 5]) {
      expect(all).not.toContain(RATING_INTERPRETATIONS[n].short);
      expect(all).not.toContain(RATING_INTERPRETATIONS[n].long);
    }
    expect(all).not.toMatch(/matching|final score|rank|kabayan|claygo|company:|status|77\.24|71\.15/i);
  });

  it("file name: <LastName>_<FirstName>_<JobTitle>_Endorsement.pdf, letters, digits and dashes only", () => {
    expect(packetFileName(ROW)).toBe("Dela-Cruz_Juan_Store-Crew_Endorsement.pdf");
    expect(packetFileName({ lastName: "Peña", firstName: "Ana Marie", jobTitle: 'Cashier / "POS"' })).toBe("Pena_Ana-Marie_Cashier--POS_Endorsement.pdf");
  });

  it("one merged PDF: the cover, then every resume page", async () => {
    const bytes = await buildPacket(content(), await resumePdf(2));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
    expect(doc.getTitle()).toBe("Endorsement packet - Juan Santos Dela Cruz");
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    // saved without object streams: the page objects are plain text (check-p2 counts them in the raw bytes)
    expect(Buffer.from(bytes).toString("latin1").match(/\/Type\s*\/Page[^s]/g)).toHaveLength(3);
  });

  it("an unreadable resume → 409 with the readable message", async () => {
    await expect(buildPacket(content(), Buffer.from("not a pdf"))).rejects.toMatchObject({
      status: 409,
      message: "The resume file could not be added. Download it from Resume Screening.",
    });
  });
});

describe("GET /api/admin/applications/:id/packet (decision 33: by application, from the Ranking tab)", () => {
  let role;
  let row;

  beforeEach(async () => {
    vi.clearAllMocks();
    role = "hr";
    row = { ...ROW };
    supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    downloadFile.mockResolvedValue(await resumePdf(1));
    pool.query.mockImplementation(async (sql, params) => {
      if (sql.includes("from public.user_account\n") && sql.includes("where user_account_id = $1")) return { rows: [account({ role })] };
      if (sql.includes('as "resumePath"')) return { rows: params[0] === APP_SC && row ? [row] : [] };
      if (sql.includes('c.competency_id as "competencyId"')) {
        return { rows: RUBRIC.flatMap((s) => s.items.map((i) => ({ sectionCode: s.sectionCode, sectionName: s.sectionName, ...i }))) };
      }
      if (sql.includes("from public.competency_rating")) return { rows: params[0] === SOURCE ? RATINGS : [] };
      if (sql.includes("public.job_section_weight")) return { rows: params[0] === "v-sc" ? STORE_CREW_WEIGHTS : [] };
      return { rows: [] };
    });
  });

  const get = (applicationId = APP_SC) => request(app).get(`/api/admin/applications/${applicationId}/packet`).set("Authorization", "Bearer t");

  it("HR gets the PDF as an attachment, built on request from the application's own resume, never cached", async () => {
    const res = await get().buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toBe('attachment; filename="Dela-Cruz_Juan_Store-Crew_Endorsement.pdf"');
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["access-control-expose-headers"]).toBe("Content-Disposition");
    expect(downloadFile).toHaveBeenCalledWith("resumes", "resumes/p1/r1.pdf");
    expect((await PDFDocument.load(res.body)).getPageCount()).toBe(2);
    // Oct 19 change 4: no section weights or section scores are read for the cover
    const sql = pool.query.mock.calls.map(([q]) => q);
    expect(sql.some((q) => q.includes('as "resumePath"'))).toBe(true);
    expect(sql.some((q) => q.includes("public.job_section_weight"))).toBe(false);
    const packetSql = sql.find((q) => q.includes('as "resumePath"'));
    expect(packetSql).not.toContain("section_scores");
    // decision 33: read by application id; the same sources (own evaluation, ratings source, application.resume_id)
    expect(packetSql).toContain("where a.application_id = $1::uuid");
    expect(packetSql).toContain("left join public.resume r on r.resume_id = a.resume_id");
    expect(packetSql).toContain("fe.ratings_source_application_id");
    expect(packetSql).not.toContain("endorsement_item");
  });

  it.each([["passed"], ["passed_awaiting_confirmation"], ["for_endorsement"], ["endorsed"], ["final_interview_scheduled"], ["for_hiring"], ["hired"], ["not_hired"]])(
    "decision 33: a passed application at %s gets its packet",
    async (status) => {
      row = { ...ROW, status };
      expect((await get()).status).toBe(200);
    },
  );

  it("decision 33: not passed (stored passed = false) or a status outside the list → 409, nothing downloaded", async () => {
    row = { ...ROW, status: "did_not_pass", passed: false };
    const res = await get();
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe("Only an applicant who passed the assessment can get an endorsement packet.");
    // passed once, but now outside the list (standby, archived, training failed, …)
    for (const status of ["standby", "archived", "training_failed", "not_selected", "dropped"]) {
      row = { ...ROW, status };
      expect((await get()).status).toBe(409);
    }
    // a listed status with passed = false (cannot happen today, but the stored flag decides)
    row = { ...ROW, status: "for_endorsement", passed: false };
    expect((await get()).status).toBe(409);
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it("staff only: an applicant gets 403 and nothing is read; admin gets the PDF too", async () => {
    role = "applicant";
    expect((await get()).status).toBe(403);
    expect(pool.query.mock.calls.some(([q]) => q.includes('as "resumePath"'))).toBe(false);
    expect(downloadFile).not.toHaveBeenCalled();
    role = "admin";
    expect((await get()).status).toBe(200);
  });

  it("decision 33: the old route by endorsement item is gone (404)", async () => {
    const res = await request(app).get("/api/admin/endorsement-items/b1b1b1b1-0000-4000-8000-000000000001/packet").set("Authorization", "Bearer t");
    expect(res.status).toBe(404);
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it("unknown application → 404; not evaluated or no resume → 409; a bad id → 400", async () => {
    expect((await get("b9b9b9b9-0000-4000-8000-000000000009")).status).toBe(404);
    expect((await get("nope")).status).toBe(400);
    row = { ...ROW, sourceApplicationId: null, passed: null, interviewScore: null }; // no final_evaluation row
    const notEvaluated = await get();
    expect(notEvaluated.status).toBe(409);
    expect(notEvaluated.body.error.message).toBe("This applicant has no evaluation for a packet.");
    row = { ...ROW, resumePath: null };
    expect((await get()).status).toBe(409);
    expect(downloadFile).not.toHaveBeenCalled();
  });
});
