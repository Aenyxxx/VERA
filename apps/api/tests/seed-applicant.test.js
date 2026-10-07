// seed:applicant helpers: email argument, consent record (RA 10173), staff accounts left alone.
import { describe, expect, it } from "vitest";

import {
  assertNotStaff,
  CONSENT_SOURCE,
  consentMetadata,
  parseEmailArg,
  passwordSchema,
} from "../scripts/applicant-seed.js";

describe("parseEmailArg", () => {
  it("reads --email value and --email=value, lower-cased", () => {
    expect(parseEmailArg(["--", "--email", "Demo1@VERA.test"])).toBe("demo1@vera.test");
    expect(parseEmailArg(["--email=demo2@vera.test"])).toBe("demo2@vera.test");
  });

  it("explains how to call it when the email is missing or invalid", () => {
    expect(() => parseEmailArg([])).toThrow(/--email demo1@vera\.test/);
    expect(() => parseEmailArg(["--email", "not-an-email"])).toThrow(/--email/);
  });
});

describe("consentMetadata", () => {
  const now = new Date("2026-10-08T01:00:00.000Z");

  it("records consent marked as the seed's, keeping other metadata", () => {
    expect(consentMetadata({ full_name: "Demo" }, now)).toEqual({
      full_name: "Demo",
      privacy_consent_at: "2026-10-08T01:00:00.000Z",
      privacy_consent_source: CONSENT_SOURCE,
    });
    expect(CONSENT_SOURCE).toBe("seed:applicant (demo account)");
  });

  it("never overwrites an existing consent (e.g. a real sign-up)", () => {
    expect(consentMetadata({ privacy_consent_at: "2026-10-07T09:00:00.000Z" }, now)).toBeNull();
  });

  it("handles a user without metadata", () => {
    expect(consentMetadata(undefined, now)).toMatchObject({ privacy_consent_source: CONSENT_SOURCE });
  });
});

describe("assertNotStaff", () => {
  it("refuses admin and HR accounts (by user_account role or app_metadata role)", () => {
    expect(() => assertNotStaff({ accountRole: "hr" })).toThrow(/staff account/);
    expect(() => assertNotStaff({ appMetadataRole: "admin" })).toThrow(/staff account/);
  });

  it("allows applicants and users without a VERA account yet", () => {
    expect(() => assertNotStaff({ accountRole: "applicant" })).not.toThrow();
    expect(() => assertNotStaff({ accountRole: null, appMetadataRole: undefined })).not.toThrow();
  });
});

describe("passwordSchema", () => {
  it("uses the FR-AUTH-02 rule", () => {
    expect(passwordSchema.safeParse("demo1234").success).toBe(true);
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("lettersonly").success).toBe(false);
  });
});
