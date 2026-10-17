// Phase 3 (decision 17): a job invitation can only be accepted while its vacancy is "open". When the vacancy leaves
// open (HR close, the cap close, Create endorsement → endorsing, the hire that fills), its pending job invitations
// expire in the SAME transaction, so an applicant who never answers does not keep the one-pending slot of their pool
// entry (pool_invitation_one_pending) and can be invited or rematched again.
// Only kind = 'job_invitation': S17 rematch offers keep their behaviour (they expire when the applicant answers and
// the accept re-check fails).
// Call it while holding the job_vacancy row lock (every caller does): every other writer of a job invitation (pool
// matching's invite, the applicant's accept / decline) takes that vacancy lock first, so the pool-entry updates here
// cannot race with them.
import { INVITATION_KIND, INVITATION_STATUS as IS, NOTIFICATION_TYPE as N, POOL_AVAILABILITY } from "@vera/shared";

import { notify } from "./notify.js";

/**
 * @param {import("pg").PoolClient} client inside withTransaction, job_vacancy row already locked
 * @param {string} vacancyId
 * @returns {Promise<string[]>} the expired invitation ids
 */
export async function expireJobInvitations(client, vacancyId) {
  const { rows } = await client.query(
    `update public.pool_invitation pi
        set status = $3::public.invitation_status, responded_at = now()
       from public.talent_pool tp, public.applicant p, public.job_vacancy v
      where pi.job_vacancy_id = $1::uuid and pi.kind = $2::public.invitation_kind and pi.status = $4::public.invitation_status
        and tp.talent_pool_id = pi.talent_pool_id and p.applicant_id = tp.applicant_id and v.job_vacancy_id = pi.job_vacancy_id
      returning pi.pool_invitation_id as "invitationId", pi.talent_pool_id as "talentPoolId",
                p.user_account_id as "userId", v.job_title as "jobTitle"`,
    [vacancyId, INVITATION_KIND.JOB_INVITATION, IS.EXPIRED, IS.PENDING],
  );
  if (rows.length === 0) return [];

  // The pool entries are free again (only active entries that are still marked invited).
  await client.query(
    `update public.talent_pool set availability = $2::public.pool_availability
      where talent_pool_id = any($1::uuid[]) and removed_at is null and availability = $3::public.pool_availability`,
    [rows.map((r) => r.talentPoolId), POOL_AVAILABILITY.AVAILABLE, POOL_AVAILABILITY.INVITED],
  );
  for (const row of rows) {
    await notify(client, { userId: row.userId, type: N.JOB_INVITATION_EXPIRED, vars: { jobTitle: row.jobTitle } });
  }
  return rows.map((r) => r.invitationId);
}
