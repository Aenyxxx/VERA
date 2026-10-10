// Close-out of a vacancy (PRD BR-22; ROADMAP S15, decided Oct 10, 2026).
// Runs ONLY inside the transaction that archives a vacancy (S15: closed → archived, an explicit HR action) or fills
// it (S16: hired = slots). A cap-close or HR pause (open → closed) never calls it: the waiting pool is kept.
//   waiting_pool, shortlisted (locked or not), interview_scheduled, interview_confirmed → not_selected
//   passed, passed_awaiting_confirmation, for_endorsement                                → standby
//   endorsed (client decision pending) and every final status stay as they are.
// not_selected and standby are neutral (BR-19: no company block) and not ongoing (BR-17: the applicant is free).
// Both enter the applicant pool and get a neutral notice. Open interview attempts and pending document requests of
// not-selected applications are cancelled (APP_FLOW §5.1).
// The moves are recorded as the system (changed_by null) with reason "close-out: vacancy archived|filled".
import {
  APPLICATION_STATUS as A,
  INTERVIEW_STATUS as I,
  NOTIFICATION_TYPE as N,
  POOL_REASON,
  REQUEST_STATUS,
} from "@vera/shared";

import { OPEN_INTERVIEW_STATUSES } from "./interview.js";
import { notify } from "./notify.js";
import { addToPool } from "./pool.js";
import { asSystem } from "./shortlist.js";
import { transition } from "./statusMachine.js";

export const CLOSE_OUT_REASON = Object.freeze({
  archived: "close-out: vacancy archived",
  filled: "close-out: vacancy filled",
});

const TO_NOT_SELECTED = Object.freeze([A.WAITING_POOL, A.SHORTLISTED, A.INTERVIEW_SCHEDULED, A.INTERVIEW_CONFIRMED]);
const TO_STANDBY = Object.freeze([A.PASSED, A.PASSED_AWAITING_CONFIRMATION, A.FOR_ENDORSEMENT]);
export const CLOSED_OUT_STATUSES = Object.freeze([...TO_NOT_SELECTED, ...TO_STANDBY]);

/** Where one application goes at close-out, or null when it stays (endorsed, hired, every final status). */
export function closeOutTarget(status) {
  if (TO_NOT_SELECTED.includes(status)) return A.NOT_SELECTED;
  if (TO_STANDBY.includes(status)) return A.STANDBY;
  return null;
}

/** Archive is refused while an endorsed applicant waits for the client's decision (decided Oct 10, 2026). */
export async function countEndorsed(client, vacancyId) {
  const { rows } = await client.query(
    `select count(*)::int as "endorsed" from public.application
      where job_vacancy_id = $1::uuid and status = $2::public.application_status`,
    [vacancyId, A.ENDORSED],
  );
  return rows[0].endorsed;
}

/**
 * Moves every open application of the vacancy (see the table above). The CALLER already holds the job_vacancy row
 * lock (archive: changeVacancyStatus; fill: S16), so no other writer can change these applications meanwhile.
 * Lock order (DATABASE_SCHEMA §8), level by level: job_vacancy (caller) → every affected applicant, ascending id →
 * every affected application, ascending id; the statuses are read again under the application locks.
 * @param {import("pg").PoolClient} client inside withTransaction
 * @param {string} vacancyId
 * @param {"archived"|"filled"} cause
 * @returns {Promise<{ notSelected: string[], standby: string[] }>} application ids
 */
export async function closeOutVacancy(client, vacancyId, cause) {
  const reason = CLOSE_OUT_REASON[cause];
  if (!reason) throw new Error(`Unknown close-out cause: ${cause}`);

  const { rows: affected } = await client.query(
    `select application_id as "applicationId", applicant_id as "applicantId"
       from public.application
      where job_vacancy_id = $1::uuid and status = any($2::public.application_status[])
      order by application_id`,
    [vacancyId, CLOSED_OUT_STATUSES],
  );
  if (affected.length === 0) return { notSelected: [], standby: [] };

  // 2. applicant rows (the pool entry is per applicant), ascending id
  const applicantIds = [...new Set(affected.map((a) => a.applicantId))].sort();
  await client.query(
    `select applicant_id from public.applicant
      where applicant_id = any($1::uuid[])
      order by applicant_id
      for update`,
    [applicantIds],
  );
  // 3. application rows, ascending id; these statuses are the ones that count
  const { rows: locked } = await client.query(
    `select a.application_id as "applicationId", a.applicant_id as "applicantId", a.status,
            p.user_account_id as "userId"
       from public.application a
       join public.applicant p on p.applicant_id = a.applicant_id
      where a.application_id = any($1::uuid[])
      order by a.application_id
      for update of a`,
    [affected.map((a) => a.applicationId)],
  );
  const { rows: vacancy } = await client.query(
    `select job_title as "jobTitle" from public.job_vacancy where job_vacancy_id = $1::uuid`,
    [vacancyId],
  );
  const { jobTitle } = vacancy[0];

  const result = { notSelected: [], standby: [] };
  await asSystem(client, async () => {
    for (const application of locked) {
      const target = closeOutTarget(application.status);
      if (!target) continue;
      await transition(client, application, target, reason);
      await client.query(`update public.application set action_due_at = null where application_id = $1::uuid`, [
        application.applicationId,
      ]);

      if (target === A.NOT_SELECTED) {
        await client.query(
          `update public.interview_schedule set status = $2::public.interview_status, updated_at = now()
            where application_id = $1::uuid and status = any($3::public.interview_status[])`,
          [application.applicationId, I.CANCELLED, OPEN_INTERVIEW_STATUSES],
        );
        await client.query(
          `update public.document_request set status = $2::public.request_status
            where application_id = $1::uuid and status = $3::public.request_status`,
          [application.applicationId, REQUEST_STATUS.CANCELLED, REQUEST_STATUS.PENDING],
        );
        await addToPool(client, { ...application, reason: POOL_REASON.NOT_SELECTED });
        await notify(client, { userId: application.userId, type: N.NOT_SELECTED, applicationId: application.applicationId, vars: { jobTitle } });
        result.notSelected.push(application.applicationId);
      } else {
        await addToPool(client, { ...application, reason: POOL_REASON.STANDBY });
        await notify(client, { userId: application.userId, type: N.MOVED_TO_STANDBY, applicationId: application.applicationId, vars: { jobTitle } });
        result.standby.push(application.applicationId);
      }
    }
  });
  return result;
}
