// Guards against drift: @vera/shared values must equal the SQL enums: created in the initial migration,
// extended by `alter type … add value` in later migrations (appended in file order, like Postgres does).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import * as shared from "@vera/shared";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(import.meta.dirname, "../../../supabase/migrations");
const read = (file) => readFileSync(path.join(migrationsDir, file), "utf8").replace(/--.*$/gm, ""); // drop SQL comments
const sql = read("20261006000000_initial_schema.sql");

// Types created in ANY migration (Phase 3 adds invitation_kind in 20261020010000), in file order.
const sqlEnums = {};
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
  for (const [, name, body] of read(file).matchAll(/create type public\.(\w+)\s+as enum\s*\(([^;]*?)\);/g)) {
    sqlEnums[name] = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  }
}
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
  for (const [, name, value] of read(file).matchAll(/alter type public\.(\w+) add value (?:if not exists )?'([^']+)'/g)) {
    if (!sqlEnums[name].includes(value)) sqlEnums[name].push(value);
  }
}

// The LAST definition across the migrations (file order) is the one in force: Phase 2 (20261019010000) replaces the
// function and rebuilds the index with the final-interview statuses.
const migrationFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
function lastMatch(pattern) {
  let found = null;
  for (const file of migrationFiles) {
    for (const match of read(file).matchAll(pattern)) found = match[1];
  }
  return [...found.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const cases = {
  user_role: shared.ROLES,
  account_status: shared.ACCOUNT_STATUS,
  gender_type: shared.GENDER,
  gender_requirement: shared.GENDER_REQUIREMENT,
  education_level: shared.EDUCATION_LEVELS,
  vacancy_status: shared.VACANCY_STATUS,
  applicant_type: shared.APPLICANT_TYPE,
  application_source: shared.APPLICATION_SOURCE,
  application_status: shared.APPLICATION_STATUS,
  verification_status: shared.VERIFICATION_STATUS,
  document_type: shared.DOCUMENT_TYPE,
  request_status: shared.REQUEST_STATUS,
  interview_status: shared.INTERVIEW_STATUS,
  endorsement_status: shared.ENDORSEMENT_STATUS,
  endorsement_outcome: shared.ENDORSEMENT_OUTCOME,
  training_status: shared.TRAINING_STATUS,
  pool_reason: shared.POOL_REASON,
  pool_availability: shared.POOL_AVAILABILITY,
  invitation_status: shared.INVITATION_STATUS,
  invitation_kind: shared.INVITATION_KIND, // Phase 3
  email_status: shared.EMAIL_STATUS,
};

describe("@vera/shared mirrors the SQL enums", () => {
  it("covers every enum in the migration", () => {
    expect(Object.keys(cases).sort()).toEqual(Object.keys(sqlEnums).sort());
  });

  it.each(Object.entries(cases))("%s", (name, values) => {
    expect(Object.values(values)).toEqual(sqlEnums[name]);
  });

  it("ACTIVE_APPLICATION_STATUSES equals the latest is_active_application_status()", () => {
    const active = lastMatch(/function public\.is_active_application_status[\s\S]*?select s in \(([^)]*)\)/g);
    expect([...shared.ACTIVE_APPLICATION_STATUSES]).toEqual(active);
    expect(active).toEqual(expect.arrayContaining(["endorsed", "final_interview_scheduled", "for_hiring"]));
  });

  it("decision 33: PACKET_STATUSES = passed onward through the client's decision, never a neutral or pre-pass end", () => {
    expect([...shared.PACKET_STATUSES]).toEqual([
      "passed", "passed_awaiting_confirmation", "for_endorsement", "endorsed", "final_interview_scheduled", "for_hiring",
      "for_training", "for_requirements", "for_orientation", "hired", "not_hired", // decision 37C stages
    ]);
    for (const s of ["did_not_pass", "standby", "archived", "training_failed", "not_selected", "dropped", "waiting_pool", "shortlisted"]) {
      expect(shared.PACKET_STATUSES).not.toContain(s);
    }
    for (const s of shared.PACKET_STATUSES) expect(Object.values(shared.APPLICATION_STATUS)).toContain(s);
  });

  it("WITH_CLIENT_STATUSES are endorsed, final_interview_scheduled, for_hiring and the 37C stages (all ongoing)", () => {
    expect([...shared.WITH_CLIENT_STATUSES]).toEqual([
      "endorsed", "final_interview_scheduled", "for_hiring", "for_training", "for_requirements", "for_orientation",
    ]);
    for (const s of shared.WITH_CLIENT_STATUSES) expect(shared.ACTIVE_APPLICATION_STATUSES).toContain(s);
  });

  it("decision 37C: CLIENT_STAGES is the fixed order ending at hired; NEXT_CLIENT_STAGE moves one stage forward", () => {
    expect([...shared.CLIENT_STAGES]).toEqual(["final_interview_scheduled", "for_training", "for_requirements", "for_orientation", "hired"]);
    expect({ ...shared.NEXT_CLIENT_STAGE }).toEqual({
      final_interview_scheduled: "for_training",
      for_training: "for_requirements",
      for_requirements: "for_orientation",
    });
    for (const s of shared.CLIENT_STAGES) expect(Object.values(shared.APPLICATION_STATUS)).toContain(s);
  });

  it("POOL_TABS (decision 18) cover every pool reason exactly once: Waiting and Returned by Client", () => {
    const all = Object.values(shared.POOL_TABS).flatMap((tab) => tab.reasons);
    expect([...all].sort()).toEqual([...sqlEnums.pool_reason].sort());
    expect(new Set(all).size).toBe(all.length);
    expect(shared.POOL_TABS.client.reasons).toEqual(["not_hired", "training_failed"]);
    expect([shared.POOL_TABS.waiting.label, shared.POOL_TABS.client.label]).toEqual(["Waiting", "Returned by Client"]);
  });

  it("every application status has HR and applicant labels and a tone", () => {
    for (const status of Object.values(shared.APPLICATION_STATUS)) {
      expect(shared.APPLICATION_STATUS_LABELS[status]).toMatchObject({
        hr: expect.any(String),
        applicant: expect.any(String),
        tone: expect.any(String),
      });
    }
  });

  it("every application status has exactly one outcome class (BR-17..BR-19)", () => {
    const classes = Object.values(shared.APPLICATION_OUTCOME).flat();
    expect([...classes].sort()).toEqual(Object.values(shared.APPLICATION_STATUS).sort());
    expect(new Set(classes).size).toBe(classes.length);
  });

  it("BLOCKS_APPLYING_STATUSES equals the latest predicate of application_one_ongoing_per_applicant", () => {
    const blocking = lastMatch(
      /create unique index (?:if not exists )?application_one_ongoing_per_applicant[\s\S]*?where status in \(([^)]*)\)/g,
    );
    expect([...shared.BLOCKS_APPLYING_STATUSES]).toEqual(blocking);
    expect(blocking.at(-1)).toBe("hired");
  });

  it("application_active_idx (latest) lists exactly the active statuses", () => {
    const active = lastMatch(/create index (?:if not exists )?application_active_idx[\s\S]*?where status in \(([^)]*)\)/g);
    expect(active).toEqual([...shared.ACTIVE_APPLICATION_STATUSES]);
  });
});

// Decision 29: the SQL enum keeps its older values, but applicants upload and HR requests only these three.
describe("supporting document types (decision 29)", () => {
  it("upload and request offer Certificate, Diploma, Other, in that order", () => {
    expect([...shared.SUPPORTING_DOCUMENT_TYPES]).toEqual(["certificate", "diploma", "other"]);
    expect([...shared.REQUESTABLE_DOCUMENT_TYPES]).toEqual(["certificate", "diploma", "other"]);
    expect(shared.SUPPORTING_DOCUMENT_TYPES.map((t) => shared.DOCUMENT_TYPE_LABELS[t])).toEqual(["Certificate", "Diploma", "Other"]);
  });

  it("Certificate and Other may have several copies; Diploma is one current document", () => {
    expect([...shared.MULTI_DOCUMENT_TYPES]).toEqual(["certificate", "other"]);
  });
});

// Phase 4 (decision 19): one FR-AUTH-02 password rule for seed:admin, the User Management API, and its web form.
describe("PASSWORD_PATTERN (FR-AUTH-02)", () => {
  it("needs 8+ characters with a letter and a number", () => {
    expect(["Temp1234", "abcdefg1", "1234567a"].every((p) => shared.PASSWORD_PATTERN.test(p))).toBe(true);
    expect(["abcdefgh", "12345678", "abc123", ""].some((p) => shared.PASSWORD_PATTERN.test(p))).toBe(false);
  });

  it("seed:admin and the users schema import it instead of keeping their own regex", () => {
    for (const file of ["scripts/seed-admin.js", "src/modules/users/users.schemas.js"]) {
      const text = readFileSync(path.join(import.meta.dirname, "..", file), "utf8");
      expect(text).toMatch(/import \{[^}]*PASSWORD_PATTERN[^}]*\} from "@vera\/shared"/);
      expect(text).not.toMatch(/\(\?=\.\*\[A-Za-z\]\)/);
    }
  });
});
