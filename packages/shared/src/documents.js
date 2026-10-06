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

/** Types an applicant can upload as a supporting document (everything except the resume). */
export const SUPPORTING_DOCUMENT_TYPES = Object.freeze(
  Object.values(DOCUMENT_TYPE).filter((type) => type !== DOCUMENT_TYPE.RESUME),
);
