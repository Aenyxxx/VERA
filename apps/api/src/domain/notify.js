// In-app notifications (docs/TRD.md §9). Written inside the business transaction so they commit with the
// status change. Emails are deferred (ROADMAP §6), so email_status keeps its default 'not_required'.
// Messages never name the client company (CLAUDE.md rule 4).
import { ACCOUNT_STATUS, NOTIFICATION_TYPE as N, STAFF_ROLES } from "@vera/shared";

const manila = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
/** Deadlines always show date, time, and time zone (UI_GUIDELINES §7). */
const due = (date) => `${manila.format(new Date(date))} (Philippine time)`;

const TEMPLATES = {
  [N.APPLICATION_SUBMITTED]: ({ jobTitle }) => ({
    title: "Application received",
    message: `Your application for ${jobTitle} was received. You are in line for document review.`,
  }),
  [N.PRESCREEN_FAILED]: ({ jobTitle, conditions }) => ({
    title: `Not qualified for ${jobTitle}`,
    message: `You do not meet this job's requirements: ${conditions.join(" ")} You can apply to other jobs.`,
  }),
  [N.BELOW_THRESHOLD]: ({ jobTitle }) => ({
    title: `Not shortlisted for ${jobTitle}`,
    message: "Your resume did not match this job's requirements closely enough. You can apply to other jobs.",
  }),
  [N.SHORTLISTED]: ({ jobTitle }) => ({
    title: `Under review: ${jobTitle}`,
    message: "You are on the shortlist. HR will review your resume and documents.",
  }),
  [N.SHORTLIST_DISPLACED]: ({ jobTitle }) => ({
    title: `Back in line for ${jobTitle}`,
    message: "Applicants with a closer match took the review slots for now. Your application is kept and can move up again.",
  }),
  [N.DOCUMENT_REQUESTED]: ({ jobTitle, documentLabel, reason, dueAt }) => ({
    title: `Document requested: ${documentLabel}`,
    message: `For your application for ${jobTitle}, please upload your ${documentLabel} by ${due(dueAt)}. Reason: ${reason}`,
  }),
  // Never the internal reason and never the company; dropped frees the applicant (BR-18).
  [N.APPLICATION_DROPPED]: ({ jobTitle }) => ({
    title: `Application closed: ${jobTitle}`,
    message: `Your application for ${jobTitle} has been closed. You can apply to other jobs.`,
  }),
  [N.HR_DOCUMENT_UPLOADED]: ({ applicantName, documentLabel, jobTitle }) => ({
    title: `Requested document uploaded: ${documentLabel}`,
    message: `${applicantName} uploaded the requested ${documentLabel} for ${jobTitle}. It is ready to verify.`,
  }),
  // S13: the meeting link is never in a notification; the dashboard shows it once the applicant confirms.
  [N.INTERVIEW_SCHEDULED]: ({ jobTitle, scheduledAt, durationMinutes, confirmDueAt }) => ({
    title: `Interview scheduled: ${jobTitle}`,
    message:
      `Your online interview for ${jobTitle} is on ${due(scheduledAt)} (${durationMinutes} minutes). ` +
      `Please confirm it on your dashboard by ${due(confirmDueAt)}. The meeting link appears once you confirm.`,
  }),
  // confirmDueAt only while the applicant has not confirmed yet (a confirmed interview stays confirmed).
  [N.INTERVIEW_RESCHEDULED]: ({ jobTitle, scheduledAt, durationMinutes, confirmDueAt }) => ({
    title: `Interview time changed: ${jobTitle}`,
    message:
      `Your online interview for ${jobTitle} is now on ${due(scheduledAt)} (${durationMinutes} minutes). ` +
      (confirmDueAt ? `Please confirm it on your dashboard by ${due(confirmDueAt)}. ` : "") +
      "If you can't attend at the new time, please contact Confiable Manpower.",
  }),
  // S14: no score, no company, no reason; did_not_pass frees the applicant (BR-18). The same text after an
  // interview and after reused ratings (BR-21), so it never mentions the interview. Not "selected": S15's
  // not_selected status (BR-22) has its own wording.
  [N.EVALUATION_DID_NOT_PASS]: ({ jobTitle }) => ({
    title: `Application update: ${jobTitle}`,
    message:
      `Your application for ${jobTitle} was not successful this time. ` +
      "We keep your profile in our applicant pool. You can apply to other jobs.",
  }),
  [N.HR_INTERVIEW_CONFIRMED]: ({ applicantName, jobTitle, scheduledAt }) => ({
    title: `Interview confirmed: ${applicantName}`,
    message: `${applicantName} confirmed the online interview for ${jobTitle} on ${due(scheduledAt)}.`,
  }),
  // S15 Notify (FR-END-03): fixed title; HR's editable body (checked for the company name by the API), then a fixed
  // deadline line the body can never change. Positive wording is allowed here: they passed the agency assessment.
  [N.PASSED_CONFIRM_ENDORSEMENT]: ({ jobTitle, message, actionDueAt }) => ({
    title: `Please confirm: ${jobTitle}`,
    message: `${message.trim()} Please confirm on your dashboard by ${due(actionDueAt)}.`,
  }),
  // S15 close-out and S16 endorsement (BR-22, FR-END-06): one text for archive, fill, and "others were endorsed".
  // May say "passed" (they did); never "selected" or "hired".
  [N.MOVED_TO_STANDBY]: ({ jobTitle }) => ({
    title: `Kept in our applicant pool: ${jobTitle}`,
    message:
      `Your application for ${jobTitle} will not go forward to the employer. ` +
      "You passed the agency assessment, so we keep your profile in our applicant pool. You can apply to other jobs.",
  }),
  // S15 close-out (BR-22): neutral, no company block. Different from evaluation_did_not_pass ("Application update").
  [N.NOT_SELECTED]: ({ jobTitle }) => ({
    title: `Job closed: ${jobTitle}`,
    message:
      `The ${jobTitle} job is no longer open, so your application has ended. ` +
      "We keep your profile in our applicant pool. You can apply to other jobs.",
  }),
  // S16 (FR-END-05/07/08): never the company, never a score (rule 4). Endorsed and hired may sound positive; not hired
  // and training failed are neutral, free the applicant (BR-18), and end with "You can apply to other jobs".
  [N.ENDORSED]: ({ jobTitle }) => ({
    title: `Sent to the employer: ${jobTitle}`,
    message:
      `The agency sent your profile to the employer for ${jobTitle}. ` +
      "The employer makes the final hiring decision. We will tell you the result.",
  }),
  [N.HIRED]: ({ jobTitle }) => ({
    title: `Hired: ${jobTitle}`,
    message: `You are hired for ${jobTitle}. The agency will contact you about the next steps.`,
  }),
  [N.NOT_HIRED]: ({ jobTitle }) => ({
    title: `Employer decision: ${jobTitle}`,
    message:
      `The employer did not continue with your application for ${jobTitle}. ` +
      "We keep your profile in our applicant pool. You can apply to other jobs.",
  }),
  [N.TRAINING_FAILED]: ({ jobTitle }) => ({
    title: `Training update: ${jobTitle}`,
    message:
      `Your training for ${jobTitle} was not completed, so this placement has ended. ` +
      "We keep your profile in our applicant pool. You can apply to other jobs.",
  }),
  // S17 automatic rematch (BR-23): the applicant sees the job title and the deadline, never the company or a score.
  [N.REMATCH_OFFER]: ({ jobTitle, dueAt }) => ({
    title: `Another job for you: ${jobTitle}`,
    message:
      `The agency found another job that fits your profile: ${jobTitle}. ` +
      `Do you want the agency to endorse you for it? Please answer on your dashboard by ${due(dueAt)}. ` +
      "The employer makes the final hiring decision.",
  }),
  [N.REMATCH_OFFER_EXPIRED]: ({ jobTitle }) => ({
    title: `Job no longer available: ${jobTitle}`,
    message:
      `The ${jobTitle} job you were offered is no longer available. ` +
      "We keep your profile in our applicant pool. You can apply to other jobs.",
  }),
  [N.HR_REMATCH_OFFERED]: ({ applicantName, jobTitle, companyName }) => ({
    title: `Rematch offer: ${applicantName}`,
    message: `VERA offered ${applicantName} the ${jobTitle} job at ${companyName} after the client's rejection.`,
  }),
  [N.HR_REMATCH_ACCEPTED]: ({ applicantName, jobTitle, companyName }) => ({
    title: `Rematch accepted: ${applicantName}`,
    message: `${applicantName} accepted ${jobTitle} at ${companyName}. They are ready for Endorsement Management.`,
  }),
  [N.HR_REMATCH_DECLINED]: ({ applicantName, jobTitle, companyName }) => ({
    title: `Rematch declined: ${applicantName}`,
    message: `${applicantName} declined ${jobTitle} at ${companyName}. You can run the rematch again.`,
  }),
  [N.HR_ENDORSEMENT_CONFIRMED]: ({ applicantName, jobTitle }) => ({
    title: `Endorsement confirmed: ${applicantName}`,
    message: `${applicantName} confirmed that they want to be endorsed for ${jobTitle}. They are ready for Endorsement Management.`,
  }),
  [N.HR_ENDORSEMENT_DECLINED]: ({ applicantName, jobTitle }) => ({
    title: `Endorsement declined: ${applicantName}`,
    message: `${applicantName} declined the endorsement for ${jobTitle}. You can notify the next passed applicant.`,
  }),
};

/** Title and message for a notification type (also returned to the applicant right after applying). */
export function messageFor(type, vars) {
  return TEMPLATES[type](vars);
}

/**
 * Inserts one notification for a user.
 * @param {import("pg").PoolClient} client inside withTransaction
 * @param {{ userId: string, type: string, applicationId?: string|null, vars: object, linkPath?: string }} input
 */
export async function notify(
  client,
  { userId, type, applicationId = null, vars, linkPath = "/applicant", requiresAction = false },
) {
  const { title, message } = messageFor(type, vars);
  await client.query(
    `insert into public.notification
       (user_account_id, application_id, notification_type, title, message, link_path, requires_action)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, applicationId, type, title, message, linkPath, requiresAction],
  );
  return { title, message };
}

/** The same notification for every active HR and admin account (TRD §9 "all active HR + admin"). */
export async function notifyStaff(client, { type, applicationId = null, vars, linkPath }) {
  const { title, message } = messageFor(type, vars);
  await client.query(
    `insert into public.notification (user_account_id, application_id, notification_type, title, message, link_path)
     select user_account_id, $3, $4, $5, $6, $7
       from public.user_account
      where role = any($1::public.user_role[]) and account_status = $2`,
    [STAFF_ROLES, ACCOUNT_STATUS.ACTIVE, applicationId, type, title, message, linkPath],
  );
}
