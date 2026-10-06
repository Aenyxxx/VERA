// Display labels and badge tones (docs/UI_GUIDELINES.md §4.1, applicant wording from docs/APP_FLOW.md §6).
// Components read labels from here and never hard-code them.
// Tones: success | warning | error | info | interview | neutral.

import { ROLES } from "./roles.js";
import {
  APPLICATION_STATUS as A,
  VACANCY_STATUS as V,
  VERIFICATION_STATUS,
  INTERVIEW_STATUS as I,
  APPLICANT_TYPE,
} from "./statuses.js";
import { DOCUMENT_TYPE as D } from "./documents.js";

export const APPLICATION_STATUS_LABELS = Object.freeze({
  [A.PRESCREEN_FAILED]: { hr: "Prescreen failed", applicant: "Not qualified", tone: "error" },
  [A.BELOW_THRESHOLD]: { hr: "Below threshold", applicant: "Not shortlisted", tone: "neutral" },
  [A.WAITING_POOL]: { hr: "Waiting pool", applicant: "Application received", tone: "neutral" },
  [A.SHORTLISTED]: { hr: "Screening", applicant: "Under review", tone: "info" },
  [A.INTERVIEW_SCHEDULED]: { hr: "For interview", applicant: "Interview scheduled", tone: "warning" },
  [A.INTERVIEW_CONFIRMED]: { hr: "Interview confirmed", applicant: "Interview confirmed", tone: "interview" },
  [A.DID_NOT_PASS]: { hr: "Did not pass", applicant: "Not selected (kept in applicant pool)", tone: "error" },
  [A.PASSED]: { hr: "Passed", applicant: "Under final review", tone: "success" },
  [A.PASSED_AWAITING_CONFIRMATION]: { hr: "Awaiting confirmation", applicant: "Passed — confirm endorsement", tone: "warning" },
  [A.FOR_ENDORSEMENT]: { hr: "For endorsement", applicant: "For client interview", tone: "info" },
  [A.ENDORSED]: { hr: "Endorsed", applicant: "For client interview", tone: "info" },
  [A.HIRED]: { hr: "Hired", applicant: "Hired", tone: "success" },
  [A.NOT_HIRED]: { hr: "Not hired", applicant: "Kept in applicant pool", tone: "error" },
  [A.TRAINING_FAILED]: { hr: "Training failed", applicant: "Kept in applicant pool", tone: "error" },
  [A.STANDBY]: { hr: "Standby", applicant: "Kept in applicant pool", tone: "neutral" },
  [A.TERMINATED]: { hr: "Terminated", applicant: "Closed (you continued with another job)", tone: "neutral" },
  [A.DROPPED]: { hr: "Dropped", applicant: "Closed (no response)", tone: "neutral" },
  [A.ARCHIVED]: { hr: "Archived", applicant: "Closed (endorsement declined)", tone: "neutral" },
});

export const VERIFICATION_STATUS_LABELS = Object.freeze({
  [VERIFICATION_STATUS.PENDING]: { label: "For verification", tone: "warning" },
  [VERIFICATION_STATUS.VERIFIED]: { label: "Verified", tone: "success" },
  [VERIFICATION_STATUS.REJECTED]: { label: "Rejected", tone: "error" },
  [VERIFICATION_STATUS.REUPLOAD_REQUESTED]: { label: "Reupload required", tone: "warning" },
});

export const VACANCY_STATUS_LABELS = Object.freeze({
  [V.DRAFT]: { label: "Draft", tone: "neutral" },
  [V.OPEN]: { label: "Active", tone: "success" },
  [V.CLOSED]: { label: "Closed", tone: "neutral" },
  [V.ENDORSING]: { label: "Endorsing", tone: "info" },
  [V.FILLED]: { label: "Filled", tone: "success" },
  [V.ARCHIVED]: { label: "Archived", tone: "neutral" },
});

export const INTERVIEW_STATUS_LABELS = Object.freeze({
  [I.PENDING_CONFIRMATION]: { label: "Awaiting confirmation", tone: "warning" },
  [I.CONFIRMED]: { label: "Scheduled", tone: "info" },
  [I.RESCHEDULE_REQUESTED]: { label: "Reschedule requested", tone: "warning" },
  [I.RESCHEDULED]: { label: "Rescheduled", tone: "neutral" },
  [I.COMPLETED]: { label: "Completed", tone: "success" },
  [I.NO_SHOW]: { label: "No-show", tone: "error" },
  [I.EXPIRED]: { label: "Expired", tone: "error" },
  [I.CANCELLED]: { label: "Cancelled", tone: "neutral" },
});

export const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: "Admin",
  [ROLES.HR]: "HR",
  [ROLES.APPLICANT]: "Applicant",
});

export const APPLICANT_TYPE_LABELS = Object.freeze({
  [APPLICANT_TYPE.FIRST_TIME]: "First-time",
  [APPLICANT_TYPE.EXPERIENCED]: "Experienced",
});

export const EDUCATION_LEVEL_LABELS = Object.freeze({
  elementary: "Elementary",
  junior_high: "Junior high school",
  senior_high: "Senior high school",
  vocational: "Vocational",
  college_undergraduate: "College undergraduate",
  college_graduate: "College graduate",
  postgraduate: "Postgraduate",
});

export const DOCUMENT_TYPE_LABELS = Object.freeze({
  [D.RESUME]: "Resume",
  [D.TRANSCRIPT_OF_RECORDS]: "Transcript of records",
  [D.DIPLOMA]: "Diploma",
  [D.NBI_CLEARANCE]: "NBI clearance",
  [D.POLICE_CLEARANCE]: "Police clearance",
  [D.BARANGAY_CLEARANCE]: "Barangay clearance",
  [D.VALID_ID]: "Valid ID",
  [D.BIRTH_CERTIFICATE]: "Birth certificate",
  [D.CERTIFICATE]: "Certificate",
  [D.MEDICAL_CERTIFICATE]: "Medical certificate",
  [D.OTHER]: "Other",
});
