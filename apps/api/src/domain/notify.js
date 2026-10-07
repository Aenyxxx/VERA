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
