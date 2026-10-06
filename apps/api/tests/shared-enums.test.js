// Guards against drift: @vera/shared values must equal the SQL enums in the initial migration.
import { readFileSync } from "node:fs";
import path from "node:path";

import * as shared from "@vera/shared";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(import.meta.dirname, "../../../supabase/migrations/20261006000000_initial_schema.sql"),
  "utf8",
).replace(/--.*$/gm, ""); // drop SQL comments

const sqlEnums = Object.fromEntries(
  [...sql.matchAll(/create type public\.(\w+)\s+as enum\s*\(([^;]*?)\);/g)].map(([, name, body]) => [
    name,
    [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]),
  ]),
);

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

  it("ACTIVE_APPLICATION_STATUSES equals is_active_application_status()", () => {
    const body = sql.match(/is_active_application_status[\s\S]*?select s in \(([^)]*)\)/)[1];
    const active = [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect([...shared.ACTIVE_APPLICATION_STATUSES]).toEqual(active);
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
});
