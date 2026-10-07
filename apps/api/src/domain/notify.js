// In-app notifications (docs/TRD.md §9). Written inside the business transaction so they commit with the
// status change. Emails are deferred (ROADMAP §6), so email_status keeps its default 'not_required'.
// Messages never name the client company (CLAUDE.md rule 4).
import { NOTIFICATION_TYPE as N } from "@vera/shared";

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
export async function notify(client, { userId, type, applicationId = null, vars, linkPath = "/applicant" }) {
  const { title, message } = messageFor(type, vars);
  await client.query(
    `insert into public.notification (user_account_id, application_id, notification_type, title, message, link_path)
     values ($1, $2, $3, $4, $5, $6)`,
    [userId, applicationId, type, title, message, linkPath],
  );
  return { title, message };
}
