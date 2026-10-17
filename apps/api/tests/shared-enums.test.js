// Guards against drift: @vera/shared values must equal the SQL enums: created in the initial migration,
// extended by `alter type … add value` in later migrations (appended in file order, like Postgres does).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import * as shared from "@vera/shared";
import { describe, expect, it } from "vitest";

const migrationsDir = path.join(import.meta.dirname, "../../../supabase/migrations");
const read = (file) => readFileSync(path.join(migrationsDir, file), "utf8").replace(/--.*$/gm, ""); // drop SQL comments
const sql = read("20261006000000_initial_schema.sql");

const sqlEnums = Object.fromEntries(
  [...sql.matchAll(/create type public\.(\w+)\s+as enum\s*\(([^;]*?)\);/g)].map(([, name, body]) => [
    name,
    [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]),
  ]),
);
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

  it("WITH_CLIENT_STATUSES are endorsed, final_interview_scheduled, for_hiring (all ongoing)", () => {
    expect([...shared.WITH_CLIENT_STATUSES]).toEqual(["endorsed", "final_interview_scheduled", "for_hiring"]);
    for (const s of shared.WITH_CLIENT_STATUSES) expect(shared.ACTIVE_APPLICATION_STATUSES).toContain(s);
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
