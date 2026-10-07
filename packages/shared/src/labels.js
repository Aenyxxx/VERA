// Display labels and badge tones (docs/UI_GUIDELINES.md §4.1, applicant wording from docs/APP_FLOW.md §6).
// Components read labels from here and never hard-code them.
// `next` = the applicant's next action (APP_FLOW §6), null when there is nothing to do. Every final status except
// hired says "You can apply to other jobs" (BR-18).
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
  [A.PRESCREEN_FAILED]: { hr: "Prescreen failed", applicant: "Not qualified", tone: "error", next: "You can apply to other jobs" },
  [A.BELOW_THRESHOLD]: { hr: "Below threshold", applicant: "Not shortlisted", tone: "neutral", next: "You can apply to other jobs" },
  [A.WAITING_POOL]: { hr: "Waiting pool", applicant: "Application received", tone: "neutral", next: null },
  // Shown with the due date while a document request is pending; otherwise SHORTLISTED_IDLE_NEXT (APP_FLOW §6).
  [A.SHORTLISTED]: { hr: "Screening", applicant: "Under review", tone: "info", next: "Upload requested documents" },
  [A.INTERVIEW_SCHEDULED]: { hr: "For interview", applicant: "Interview scheduled", tone: "warning", next: "Confirm or reschedule" },
  [A.INTERVIEW_CONFIRMED]: { hr: "Interview confirmed", applicant: "Interview confirmed", tone: "interview", next: "Attend online interview" },
  [A.DID_NOT_PASS]: { hr: "Did not pass", applicant: "Not selected (kept in applicant pool)", tone: "error", next: "You can apply to other jobs" },
  [A.PASSED]: { hr: "Passed", applicant: "Under final review", tone: "success", next: null },
  [A.PASSED_AWAITING_CONFIRMATION]: { hr: "Awaiting confirmation", applicant: "Passed — confirm endorsement", tone: "warning", next: "Confirm or decline" },
  [A.FOR_ENDORSEMENT]: { hr: "For endorsement", applicant: "For client interview", tone: "info", next: "Wait for agency update" },
  [A.ENDORSED]: { hr: "Endorsed", applicant: "For client interview", tone: "info", next: "Wait for agency update" },
  [A.HIRED]: { hr: "Hired", applicant: "Hired", tone: "success", next: "Read post-hiring details" },
  [A.NOT_HIRED]: { hr: "Not hired", applicant: "Kept in applicant pool", tone: "error", next: "You can apply to other jobs" },
  [A.TRAINING_FAILED]: { hr: "Training failed", applicant: "Kept in applicant pool", tone: "error", next: "You can apply to other jobs" },
  [A.STANDBY]: { hr: "Standby", applicant: "Kept in applicant pool", tone: "neutral", next: "You can apply to other jobs" },
  [A.TERMINATED]: { hr: "Terminated", applicant: "Closed (you continued with another job)", tone: "neutral", next: "You can apply to other jobs" },
  [A.DROPPED]: { hr: "Dropped", applicant: "Closed (no response)", tone: "neutral", next: "You can apply to other jobs" },
  [A.ARCHIVED]: { hr: "Archived", applicant: "Closed (endorsement declined)", tone: "neutral", next: "You can apply to other jobs" },
  [A.NOT_SELECTED]: { hr: "Not selected", applicant: "Not selected (kept in applicant pool)", tone: "neutral", next: "You can apply to other jobs" },
});

/** Shortlisted applicant with no pending document request (APP_FLOW §6). */
export const SHORTLISTED_IDLE_NEXT = "Wait for the agency to review your application";

/** Why HR dropped an application (FR-SCR-05 simplified: HR drops manually; the applicant never sees the reason). */
export const DROP_REASON_LABELS = Object.freeze({
  failed_verification: "Failed document verification",
  no_response: "No response by the deadline",
  other: "Other",
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
