// Notification types (notification.notification_type). Catalog: docs/TRD.md §9.

export const NOTIFICATION_TYPE = Object.freeze({
  APPLICATION_SUBMITTED: "application_submitted",
  PRESCREEN_FAILED: "prescreen_failed",
  BELOW_THRESHOLD: "below_threshold",
  SHORTLISTED: "shortlisted",
  SHORTLIST_DISPLACED: "shortlist_displaced",
  DOCUMENT_REQUESTED: "document_requested",
  DOCUMENT_VERIFIED: "document_verified",
  APPLICATION_DROPPED: "application_dropped",
  INTERVIEW_SCHEDULED: "interview_scheduled",
  INTERVIEW_RESCHEDULED: "interview_rescheduled",
  INTERVIEW_REMINDER: "interview_reminder",
  EVALUATION_DID_NOT_PASS: "evaluation_did_not_pass",
  PASSED_CONFIRM_ENDORSEMENT: "passed_confirm_endorsement", // old rows only: decision 37B sends endorsement_notice
  ENDORSEMENT_NOTICE: "endorsement_notice", // decision 37B: Notify, information only (with the final interview)
  ENDORSEMENT_REMOVED: "endorsement_removed", // decision 37B: HR removed the applicant from the endorsement
  ENDORSED: "endorsed",
  MOVED_TO_STANDBY: "moved_to_standby",
  HIRED: "hired",
  NOT_HIRED: "not_hired",
  POST_HIRING_DETAILS: "post_hiring_details",
  POOL_INVITATION: "pool_invitation",
  HR_INTERVIEW_CONFIRMED: "hr_interview_confirmed",
  HR_RESCHEDULE_REQUESTED: "hr_reschedule_requested",
  HR_DOCUMENT_UPLOADED: "hr_document_uploaded",
  HR_ENDORSEMENT_CONFIRMED: "hr_endorsement_confirmed", // never sent since decision 37B (nobody confirms)
  HR_ENDORSEMENT_DECLINED: "hr_endorsement_declined", // never sent since decision 37B
  NOT_SELECTED: "not_selected", // S15: vacancy filled or archived before the application finished (BR-22)
  TRAINING_FAILED: "training_failed", // S16: HR marked a hired applicant's training failed (FR-END-08)
  // S17 automatic rematch (PRD BR-23)
  REMATCH_OFFER: "rematch_offer",
  REMATCH_OFFER_EXPIRED: "rematch_offer_expired",
  HR_REMATCH_OFFERED: "hr_rematch_offered",
  HR_REMATCH_ACCEPTED: "hr_rematch_accepted",
  HR_REMATCH_DECLINED: "hr_rematch_declined",
  // Phase 2 (decisions 14/15): the client's final interview and "For hiring"
  FINAL_INTERVIEW_SCHEDULED: "final_interview_scheduled",
  FINAL_INTERVIEW_RESCHEDULED: "final_interview_rescheduled",
  FOR_HIRING: "for_hiring",
  // Phase 3 (decision 17): job invitations from the applicant pool after a publish
  JOB_INVITATION: "job_invitation",
  JOB_INVITATION_EXPIRED: "job_invitation_expired",
  HR_INVITATION_ACCEPTED: "hr_invitation_accepted",
  HR_INVITATION_DECLINED: "hr_invitation_declined",
  HR_POOL_MATCHING_FINISHED: "hr_pool_matching_finished",
  // Phase 4 (decision 20): HR declined the applicant's reschedule request (approve reuses interview_rescheduled)
  RESCHEDULE_DECLINED: "reschedule_declined",
});

/** Length of the editable Notify message body (FR-END-03, S15). The final interview line is added by the API. */
export const NOTIFY_MESSAGE_LIMITS = Object.freeze({ min: 10, max: 1000 });

/**
 * Default body of the Notify message (FR-END-03, S15): editable by HR, shown in the Notify dialog and used by the
 * API when no message is sent. No company, no score, and no date: the API appends the final interview line
 * (decision 32); decision 37B: no deadline line, nothing to confirm.
 */
export function notifyMessageDefault(jobTitle) {
  return (
    `You passed the agency assessment for ${jobTitle}, and we would like to endorse you to the employer. ` +
    "The employer makes the final hiring decision."
  );
}
