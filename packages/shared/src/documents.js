// Document types (SQL enum document_type).

export const DOCUMENT_TYPE = Object.freeze({
  RESUME: "resume", // only used by document_request (re-upload of the resume)
  TRANSCRIPT_OF_RECORDS: "transcript_of_records",
  DIPLOMA: "diploma",
  NBI_CLEARANCE: "nbi_clearance",
  POLICE_CLEARANCE: "police_clearance",
  BARANGAY_CLEARANCE: "barangay_clearance",
  VALID_ID: "valid_id",
  BIRTH_CERTIFICATE: "birth_certificate",
  CERTIFICATE: "certificate",
  MEDICAL_CERTIFICATE: "medical_certificate",
  OTHER: "other",
});

/**
 * Types an applicant can upload as a supporting document (decision 29): Certificate, Diploma, Other only.
 * The other values above stay in the SQL enum (Postgres cannot drop enum values) but cannot be chosen.
 */
export const SUPPORTING_DOCUMENT_TYPES = Object.freeze([DOCUMENT_TYPE.CERTIFICATE, DOCUMENT_TYPE.DIPLOMA, DOCUMENT_TYPE.OTHER]);

/**
 * Types an applicant may hold several of at once (each with a label). Every other supporting type is
 * one current document: uploading it again replaces the old one (PRD FR-DOC-04).
 */
export const MULTI_DOCUMENT_TYPES = Object.freeze([DOCUMENT_TYPE.CERTIFICATE, DOCUMENT_TYPE.OTHER]);

/**
 * Types HR may request (FR-SCR-04). The resume is not requestable while resume replacement is deferred
 * (ROADMAP §6): a resume that fails verification is rejected, then HR drops the application.
 */
export const REQUESTABLE_DOCUMENT_TYPES = SUPPORTING_DOCUMENT_TYPES;
