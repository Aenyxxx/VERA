// Status and type values. Each object mirrors a SQL enum in
// supabase/migrations/20261006000000_initial_schema.sql (checked by apps/api/tests/shared-enums.test.js).

export const APPLICATION_STATUS = Object.freeze({
  PRESCREEN_FAILED: "prescreen_failed",
  BELOW_THRESHOLD: "below_threshold",
  WAITING_POOL: "waiting_pool",
  SHORTLISTED: "shortlisted",
  INTERVIEW_SCHEDULED: "interview_scheduled",
  INTERVIEW_CONFIRMED: "interview_confirmed",
  DID_NOT_PASS: "did_not_pass",
  PASSED: "passed",
  PASSED_AWAITING_CONFIRMATION: "passed_awaiting_confirmation",
  FOR_ENDORSEMENT: "for_endorsement",
  ENDORSED: "endorsed",
  HIRED: "hired",
  NOT_HIRED: "not_hired",
  TRAINING_FAILED: "training_failed",
  STANDBY: "standby",
  TERMINATED: "terminated",
  DROPPED: "dropped",
  ARCHIVED: "archived",
});

/** Statuses that block resume replacement and count as "in progress" (SQL is_active_application_status). */
export const ACTIVE_APPLICATION_STATUSES = Object.freeze([
  APPLICATION_STATUS.WAITING_POOL,
  APPLICATION_STATUS.SHORTLISTED,
  APPLICATION_STATUS.INTERVIEW_SCHEDULED,
  APPLICATION_STATUS.INTERVIEW_CONFIRMED,
  APPLICATION_STATUS.PASSED,
  APPLICATION_STATUS.PASSED_AWAITING_CONFIRMATION,
  APPLICATION_STATUS.FOR_ENDORSEMENT,
  APPLICATION_STATUS.ENDORSED,
]);

export const VACANCY_STATUS = Object.freeze({
  DRAFT: "draft",
  OPEN: "open",
  CLOSED: "closed",
  ENDORSING: "endorsing",
  FILLED: "filled",
  ARCHIVED: "archived",
});

export const VERIFICATION_STATUS = Object.freeze({
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
  REUPLOAD_REQUESTED: "reupload_requested",
});

export const REQUEST_STATUS = Object.freeze({
  PENDING: "pending",
  FULFILLED: "fulfilled",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
});

export const INTERVIEW_STATUS = Object.freeze({
  PENDING_CONFIRMATION: "pending_confirmation",
  CONFIRMED: "confirmed",
  RESCHEDULE_REQUESTED: "reschedule_requested",
  RESCHEDULED: "rescheduled",
  COMPLETED: "completed",
  NO_SHOW: "no_show",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
});

export const ENDORSEMENT_STATUS = Object.freeze({
  DRAFT: "draft",
  SENT: "sent",
});

export const ENDORSEMENT_OUTCOME = Object.freeze({
  PENDING: "pending",
  HIRED: "hired",
  NOT_HIRED: "not_hired",
});

export const TRAINING_STATUS = Object.freeze({
  PENDING: "pending",
  PASSED: "passed",
  FAILED: "failed",
});

export const POOL_REASON = Object.freeze({
  DID_NOT_PASS: "did_not_pass",
  STANDBY: "standby",
  NOT_HIRED: "not_hired",
  TRAINING_FAILED: "training_failed",
});

export const POOL_AVAILABILITY = Object.freeze({
  AVAILABLE: "available",
  INVITED: "invited",
  REAPPLIED: "reapplied",
  UNAVAILABLE: "unavailable",
});

export const INVITATION_STATUS = Object.freeze({
  PENDING: "pending",
  ACCEPTED: "accepted",
  DECLINED: "declined",
  EXPIRED: "expired",
});

export const EMAIL_STATUS = Object.freeze({
  NOT_REQUIRED: "not_required",
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
});

export const APPLICANT_TYPE = Object.freeze({
  FIRST_TIME: "first_time",
  EXPERIENCED: "experienced",
});

export const APPLICATION_SOURCE = Object.freeze({
  DIRECT: "direct",
  TALENT_POOL: "talent_pool",
});

export const GENDER = Object.freeze({
  MALE: "male",
  FEMALE: "female",
});

export const GENDER_REQUIREMENT = Object.freeze({
  ANY: "any",
  MALE: "male",
  FEMALE: "female",
});

/** Lowest to highest, same order as the SQL enum, so index comparisons work. */
export const EDUCATION_LEVELS = Object.freeze([
  "elementary",
  "junior_high",
  "senior_high",
  "vocational",
  "college_undergraduate",
  "college_graduate",
  "postgraduate",
]);
