// Endorsement Management and client outcomes (PRD FR-END-05..09, BR-17, BR-19, BR-22, BR-23; ROADMAP S16, decided
// Oct 10, 2026):
// - Create endorsement: every for_endorsement application of the vacancy → endorsed (HR); the remaining passed →
//   standby + pool (FR-END-06, recorded as the system); vacancy → endorsing. A printable page replaces the PDF/email.
//   Unanswered passed_awaiting_confirmation stay (they become standby at fill).
// - Outcome: endorsed → hired (blocks applying until training_failed, BR-17) or not_hired (failed: frees and blocks
//   the company, BR-19; pool not_hired now, S17's accepted rematch closes it). When hired reaches slots_needed the
//   vacancy fills and closes out in the same transaction (endorsed still pending → standby).
// - Training failed: hired → training_failed (failed) + pool.
// Lock order (DATABASE_SCHEMA §8): job_vacancy → applicants (ascending) → applications (ascending), level by level.
// No svc calls. Status changes only through statusMachine.transition; HR is the actor, system moves use asSystem.
import {
  APPLICATION_STATUS as A,
  ENDORSEMENT_OUTCOME,
  ENDORSEMENT_STATUS,
  NOTIFICATION_TYPE as N,
  POOL_REASON,
} from "@vera/shared";

import { withTransaction } from "../../db/tx.js";
import { closeOutCandidates, closeOutVacancy } from "../../domain/closeOut.js";
import { notify } from "../../domain/notify.js";
import { addToPool } from "../../domain/pool.js";
import { rankApplications } from "../../domain/ranking.js";
import { asSystem } from "../../domain/shortlist.js";
import { transition } from "../../domain/statusMachine.js";
import { assertSystemMove } from "../../domain/vacancyStatus.js";
import { businessRule, conflict, notFound } from "../../lib/errors.js";
import { listEvaluatedApplications } from "../ranking/ranking.repository.js";
import { lockApplication } from "../screening/screening.repository.js";
import { lockVacancy, setVacancyStatus } from "../vacancies/vacancies.repository.js";

import {
  countHired,
  findApplicationForOutcome,
  findEndorsementForPrint,
  findEndorsementVacancy,
  findItem,
  findItemOutcome,
  insertEndorsement,
  insertEndorsementItem,
  listApplicationsByStatus,
  listEndorsements,
  listEndorsementVacancies,
  lockApplicants,
  lockApplications,
  setItemOutcome,
} from "./endorsements.repository.js";

const NOT_INCLUDED = "endorsement created: not included";
const changed = () => conflict("These applications were changed by someone else. Refresh and try again.");

/** Last line of defense for a double Create: an application can be in one endorsement only. */
async function rethrowDuplicate(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error.code === "23505" && error.constraint === "endorsement_item_application_id_key") {
      throw conflict("This applicant is already endorsed. Refresh the page.");
    }
    throw error;
  }
}

// ---------------------------------------------------------------- read

/** GET /api/admin/endorsements */
export async function getEndorsementVacancies() {
  return listEndorsementVacancies();
}

/** GET /api/admin/endorsements/:vacancyId — candidates (for_endorsement, RANK-03 order) and the endorsements. */
export async function getEndorsementVacancy(vacancyId) {
  const vacancy = await findEndorsementVacancy(vacancyId);
  if (!vacancy) throw notFound("Vacancy not found.");
  const ranked = rankApplications(await listEvaluatedApplications(vacancyId));
  return {
    vacancy,
    candidates: ranked.filter((r) => r.status === A.FOR_ENDORSEMENT),
    awaitingConfirmation: ranked.filter((r) => r.status === A.PASSED_AWAITING_CONFIRMATION).length,
    endorsements: await listEndorsements(vacancyId),
  };
}

/** GET /api/admin/endorsements/print/:endorsementId — the printable endorsement (HR document for the client). */
export async function getEndorsementPrint(endorsementId) {
  const printable = await findEndorsementForPrint(endorsementId);
  if (!printable) throw notFound("Endorsement not found.");
  return printable;
}

// ---------------------------------------------------------------- write

/**
 * POST /api/admin/endorsements { vacancyId } (FR-END-05/06). One transaction: the endorsement + one item per
 * for_endorsement application (rank = RANK-03 rank, final = stored final), those applications → endorsed, the
 * remaining passed → standby + pool, vacancy → endorsing.
 */
export async function createEndorsement(hrId, { vacancyId }) {
  return rethrowDuplicate(() =>
    withTransaction(hrId, async (client) => {
      const current = await lockVacancy(client, vacancyId); // 1. job_vacancy
      if (!current) throw notFound("Vacancy not found.");
      const nextStatus = assertSystemMove(current.status, "endorse"); // 409 for draft, filled, archived

      const affected = await listApplicationsByStatus(client, vacancyId, [A.FOR_ENDORSEMENT, A.PASSED]);
      if (!affected.some((a) => a.status === A.FOR_ENDORSEMENT)) {
        throw businessRule("Nobody has confirmed the endorsement yet: notify passed applicants first.");
      }
      // 2. every affected applicant (pool entries for the standby moves), ascending id
      await lockApplicants(client, [...new Set(affected.map((a) => a.applicantId))].sort());
      // 3. every affected application, ascending id; these statuses count
      const locked = await lockApplications(client, affected.map((a) => a.applicationId));
      const included = locked.filter((a) => a.status === A.FOR_ENDORSEMENT);
      const notIncluded = locked.filter((a) => a.status === A.PASSED);
      if (included.length === 0) throw changed();

      // rank_at_endorsement and final_score from the stored evaluations (RANK-03 order, like the ranking tab)
      const rankOf = new Map(rankApplications(await listEvaluatedApplications(vacancyId, client)).map((r) => [r.applicationId, r]));
      const { jobTitle } = (await findEndorsementVacancy(vacancyId, client)) ?? {};

      const endorsement = await insertEndorsement(client, { vacancyId, status: ENDORSEMENT_STATUS.SENT, hrId });
      for (const application of included) {
        const ranked = rankOf.get(application.applicationId);
        if (!ranked) throw new Error("An application for endorsement has no final evaluation.");
        await insertEndorsementItem(client, {
          endorsementId: endorsement.endorsementId,
          applicationId: application.applicationId,
          rank: ranked.rank,
          finalScore: ranked.finalScore,
        });
        await transition(client, application, A.ENDORSED, "Endorsed to the client"); // HR = actor
        await notify(client, { userId: application.userId, type: N.ENDORSED, applicationId: application.applicationId, vars: { jobTitle } });
      }

      // FR-END-06: the passed applicants who were not notified will not go forward (system, like the close-out)
      await asSystem(client, async () => {
        for (const application of notIncluded) {
          await transition(client, application, A.STANDBY, NOT_INCLUDED);
          await addToPool(client, { ...application, reason: POOL_REASON.STANDBY });
          await notify(client, { userId: application.userId, type: N.MOVED_TO_STANDBY, applicationId: application.applicationId, vars: { jobTitle } });
        }
      });

      await setVacancyStatus(client, vacancyId, nextStatus);
      return {
        endorsementId: endorsement.endorsementId,
        sentAt: endorsement.sentAt,
        endorsed: included.map((a) => a.applicationId),
        standby: notIncluded.map((a) => a.applicationId),
        vacancyStatus: nextStatus,
      };
    }),
  );
}

/**
 * PATCH /api/admin/endorsement-items/:id/outcome { outcome, clientInterviewAt?, remarks? } (FR-END-07/09).
 * hired → hired; when the vacancy's hired count reaches slots_needed it fills and closes out here (BR-22).
 * not_hired → not_hired + pool (not_hired). A second outcome, or an application that moved, → 409.
 */
export async function recordOutcome(hrId, itemId, { outcome, clientInterviewAt, remarks }) {
  const item = await findItem(itemId);
  if (!item) throw notFound("Endorsement item not found.");
  const hiring = outcome === ENDORSEMENT_OUTCOME.HIRED;

  const result = await withTransaction(hrId, async (client) => {
    const vacancy = await lockVacancy(client, item.vacancyId); // 1. job_vacancy (the close-out relies on it)
    // Decided under the vacancy lock: does this hire fill the vacancy (hired = slots)?
    const willFill = hiring && (await countHired(client, item.vacancyId)) + 1 >= vacancy.slotsNeeded;
    // 2. applicants: this one, plus every applicant the fill close-out will move, ascending id, before any
    //    application row (closeOutVacancy re-locks them later: already held, so the order stays level by level)
    const closing = willFill ? await closeOutCandidates(client, item.vacancyId, "filled") : [];
    await lockApplicants(client, [...new Set([item.applicantId, ...closing.map((c) => c.applicantId)])].sort());
    // 3. the endorsed application; status and item outcome re-read under its lock
    const locked = await lockApplication(client, item.applicationId);
    if (!locked || locked.status !== A.ENDORSED || (await findItemOutcome(client, itemId)) !== ENDORSEMENT_OUTCOME.PENDING) {
      throw conflict("The client's decision for this applicant was already recorded, or the application moved. Refresh the page.");
    }

    await setItemOutcome(client, { itemId, outcome, hrId, clientInterviewAt, remarks });
    const status = hiring ? A.HIRED : A.NOT_HIRED;
    await transition(client, locked, status, hiring ? "Client decision: hired" : "Client decision: not hired"); // HR = actor
    if (hiring) {
      await notify(client, { userId: item.userId, type: N.HIRED, applicationId: item.applicationId, vars: { jobTitle: item.jobTitle } });
    } else {
      await addToPool(client, { applicantId: item.applicantId, applicationId: item.applicationId, reason: POOL_REASON.NOT_HIRED });
      await notify(client, { userId: item.userId, type: N.NOT_HIRED, applicationId: item.applicationId, vars: { jobTitle: item.jobTitle } });
    }

    let vacancyStatus = vacancy.status;
    let closeOut = null;
    if (willFill) {
      if ((await countHired(client, item.vacancyId)) < vacancy.slotsNeeded) throw changed(); // cannot happen under the lock
      vacancyStatus = assertSystemMove(vacancy.status, "fill");
      await setVacancyStatus(client, item.vacancyId, vacancyStatus);
      closeOut = await closeOutVacancy(client, item.vacancyId, "filled"); // moves recorded as the system
    }
    return {
      itemId,
      applicationId: item.applicationId,
      outcome,
      status,
      vacancyStatus,
      closeOut: closeOut ? { notSelected: closeOut.notSelected.length, standby: closeOut.standby.length } : null,
    };
  });

  // S17 hook (BR-23, not built yet): after a not_hired commit, start the automatic rematch OUTSIDE any transaction,
  // e.g. `await startRematch(hrId, { applicantId: item.applicantId, notHiredApplicationId: item.applicationId })`.
  return result;
}

/**
 * POST /api/admin/applications/:id/training-failed (FR-END-08, TC-82): hired → training_failed (failed: frees the
 * applicant and blocks the company, BR-19) + pool (training_failed) + neutral notice.
 */
export async function markTrainingFailed(hrId, applicationId) {
  const app = await findApplicationForOutcome(applicationId);
  if (!app) throw notFound("Application not found.");
  return withTransaction(hrId, async (client) => {
    await lockVacancy(client, app.vacancyId); // 1. job_vacancy
    await lockApplicants(client, [app.applicantId]); // 2. applicant (pool entry)
    const locked = await lockApplication(client, applicationId); // 3. application
    if (!locked || locked.status !== A.HIRED) throw conflict("Only a hired applicant's training can be marked failed. Refresh the page.");

    await transition(client, locked, A.TRAINING_FAILED, "Training failed"); // HR = actor
    await addToPool(client, { applicantId: app.applicantId, applicationId, reason: POOL_REASON.TRAINING_FAILED });
    await notify(client, { userId: app.userId, type: N.TRAINING_FAILED, applicationId, vars: { jobTitle: app.jobTitle } });
    return { applicationId, status: A.TRAINING_FAILED };
  });
}
