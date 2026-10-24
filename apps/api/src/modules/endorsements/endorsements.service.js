// Endorsement Management and client outcomes (PRD FR-END-05..09, BR-17, BR-19, BR-22, BR-23; ROADMAP S16, decided
// Oct 10, 2026):
// - Create endorsement: every for_endorsement application of the vacancy → endorsed (HR); the remaining passed →
//   standby + pool (FR-END-06, recorded as the system); vacancy → endorsing. A printable page replaces the PDF/email.
//   Old passed_awaiting_confirmation rows (before decision 37B) stay; they become standby at fill.
// - Outcome: hired (Deployed; blocks applying, BR-17) or not_hired (failed: frees and blocks
//   the company, BR-19; pool not_hired, then the automatic rematch, S17). When hired reaches slots_needed the
//   vacancy fills and closes out in the same transaction (endorsed still pending → standby).
// - Decision 37C (fixed client-outcome order): final interview → Proceed (for_training) → training passed
//   (for_requirements) → requirements complete (for_orientation) → Deployed (the hired outcome: fills the vacancy and
//   closes out as before). Not hired at every step before Deployed (pool not_hired + automatic rematch). Training failed
//   only at for_training: item outcome not_hired with remarks "Training failed", pool training_failed, no rematch.
//   No clock check anywhere: HR can record each step right away.
// - Decision 32 (Oct 20): the final interview is in the Notify message (decision 37B: an information notice, nothing
//   to confirm). Create endorsement takes
//   one schedule for the batch and moves each application endorsed → final_interview_scheduled in the same
//   transaction, with no schedule notice when it matches the message ("time changed" when it differs and HR
//   acknowledged; "scheduled" when the applicant got no Notify, e.g. an accepted rematch offer).
// - Decision 37B: HR "Remove from endorsement" (the applicant told the agency they will not continue):
//   for_endorsement → archived, neutral (no pool entry, no company block); the place counts again for Notify.
// Lock order (DATABASE_SCHEMA §8): job_vacancy → applicants (ascending) → applications (ascending), level by level.
// No svc calls. Status changes only through statusMachine.transition; HR is the actor, system moves use asSystem.
import {
  APPLICATION_STATUS as A,
  ENDORSEMENT_OUTCOME,
  ENDORSEMENT_STATUS,
  NEXT_CLIENT_STAGE,
  NOTIFICATION_TYPE as N,
  POOL_REASON,
  VACANCY_STATUS,
  WITH_CLIENT_STATUSES,
} from "@vera/shared";

import { withTransaction } from "../../db/tx.js";
import { closeOutCandidates, closeOutVacancy } from "../../domain/closeOut.js";
import { expireJobInvitations } from "../../domain/invitationExpiry.js";
import { notify, scheduleNoticeFor } from "../../domain/notify.js";
import { addToPool } from "../../domain/pool.js";
import { rankApplications } from "../../domain/ranking.js";
import { asSystem } from "../../domain/shortlist.js";
import { transition } from "../../domain/statusMachine.js";
import { assertSystemMove } from "../../domain/vacancyStatus.js";
import { AppError, businessRule, conflict, notFound } from "../../lib/errors.js";
import { listEvaluatedApplications } from "../ranking/ranking.repository.js";
import { assertNoCompany } from "../ranking/ranking.service.js";
import { runRematchAfterNotHired } from "../rematch/rematch.service.js";
import { lockApplication } from "../screening/screening.repository.js";
import { lockVacancy, setVacancyStatus } from "../vacancies/vacancies.repository.js";

import {
  countHired,
  findApplicationForOutcome,
  findConfirmMessages,
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
  setFinalInterview,
  setItemOutcome,
} from "./endorsements.repository.js";

const NOT_INCLUDED = "endorsement created: not included";
/** Why the client did not hire, by the step the applicant was at (status history reason; PRD FR-END-07). */
const NOT_HIRED_REASON = {
  [A.ENDORSED]: "Client declined before the final interview",
  [A.FINAL_INTERVIEW_SCHEDULED]: "Did not proceed after the final interview",
  [A.FOR_HIRING]: "Client decision: not hired", // old rows
  [A.FOR_TRAINING]: "Client decision: not hired during training",
  [A.FOR_REQUIREMENTS]: "Client decision: not hired at the requirements step",
  [A.FOR_ORIENTATION]: "Client decision: not hired at orientation",
};
/** Decision 37C: the status history reason and the applicant notice of each advance. */
const ADVANCE = {
  [A.FOR_TRAINING]: { reason: "Proceeds after the final interview", notice: N.FOR_TRAINING },
  [A.FOR_REQUIREMENTS]: { reason: "Training passed", notice: N.FOR_REQUIREMENTS },
  [A.FOR_ORIENTATION]: { reason: "Requirements completed", notice: N.FOR_ORIENTATION },
};
/** Deployed (the hired outcome) only from the last stage, or from an old for_hiring row. */
const DEPLOYABLE = [A.FOR_ORIENTATION, A.FOR_HIRING];
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
 * POST /api/admin/endorsements { vacancyId, finalInterviewAt, finalInterviewDetails, acknowledgeChange? }
 * (FR-END-05/06, decision 32). One transaction: the endorsement + one item per for_endorsement application (rank =
 * RANK-03 rank, final = stored final, the final interview), those applications → endorsed → final_interview_scheduled,
 * the remaining passed → standby + pool, vacancy → endorsing. A schedule that differs from someone's Notify message →
 * 409 FINAL_INTERVIEW_CHANGED (nothing written) unless acknowledgeChange.
 */
export async function createEndorsement(hrId, { vacancyId, finalInterviewAt, finalInterviewDetails, acknowledgeChange }) {
  // Decision 32, rule 4: details naming the company are refused before anything is locked or written.
  const found = await findEndorsementVacancy(vacancyId);
  if (!found) throw notFound("Vacancy not found.");
  assertNoCompany(finalInterviewDetails, found.companyName, "finalInterviewDetails");

  return rethrowDuplicate(() =>
    withTransaction(hrId, async (client) => {
      const current = await lockVacancy(client, vacancyId); // 1. job_vacancy
      if (!current) throw notFound("Vacancy not found.");
      const nextStatus = assertSystemMove(current.status, "endorse"); // 409 for draft, filled, archived

      const affected = await listApplicationsByStatus(client, vacancyId, [A.FOR_ENDORSEMENT, A.PASSED]);
      if (!affected.some((a) => a.status === A.FOR_ENDORSEMENT)) {
        throw businessRule("Nobody to endorse yet: notify passed applicants first."); // decision 37B: nobody confirms
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

      // Decision 32: what each applicant was told at Notify decides their schedule notice (none when it matches).
      const told = await findConfirmMessages(client, included.map((a) => a.applicationId));
      const noticeOf = new Map(
        included.map((a) => [a.applicationId, scheduleNoticeFor(told.get(a.applicationId), finalInterviewAt, finalInterviewDetails)]),
      );
      const idsWith = (type) => included.filter((a) => noticeOf.get(a.applicationId) === type).map((a) => a.applicationId);
      const timeChanged = idsWith(N.FINAL_INTERVIEW_RESCHEDULED);
      if (timeChanged.length > 0 && !acknowledgeChange) {
        throw new AppError(
          409,
          "FINAL_INTERVIEW_CHANGED",
          "This final interview differs from what some applicants were told. Confirm to send them 'Final interview time changed'.",
          timeChanged.map((applicationId) => ({ applicationId })),
        );
      }

      const endorsement = await insertEndorsement(client, { vacancyId, status: ENDORSEMENT_STATUS.SENT, hrId });
      for (const application of included) {
        const ranked = rankOf.get(application.applicationId);
        if (!ranked) throw new Error("An application for endorsement has no final evaluation.");
        await insertEndorsementItem(client, {
          endorsementId: endorsement.endorsementId,
          applicationId: application.applicationId,
          rank: ranked.rank,
          finalScore: ranked.finalScore,
          finalInterviewAt,
          finalInterviewDetails,
        });
        await transition(client, application, A.ENDORSED, "Endorsed to the client"); // HR = actor
        await notify(client, { userId: application.userId, type: N.ENDORSED, applicationId: application.applicationId, vars: { jobTitle } });
        // Decision 32: straight on to the final interview the applicant confirmed (second history row, HR = actor).
        await transition(client, { ...application, status: A.ENDORSED }, A.FINAL_INTERVIEW_SCHEDULED, "Final interview scheduled");
        const type = noticeOf.get(application.applicationId);
        if (type) {
          await notify(client, {
            userId: application.userId,
            type,
            applicationId: application.applicationId,
            vars: { jobTitle, scheduledAt: finalInterviewAt, details: finalInterviewDetails },
          });
        }
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
      // Phase 3: an open job becomes endorsing → its pending job invitations end (vacancy already locked).
      if (current.status === VACANCY_STATUS.OPEN) await expireJobInvitations(client, vacancyId);
      return {
        endorsementId: endorsement.endorsementId,
        sentAt: endorsement.sentAt,
        endorsed: included.map((a) => a.applicationId),
        standby: notIncluded.map((a) => a.applicationId),
        vacancyStatus: nextStatus,
        finalInterviewAt,
        timeChanged,
        firstNotice: idsWith(N.FINAL_INTERVIEW_SCHEDULED),
      };
    }),
  );
}

/**
 * POST /api/admin/applications/:id/remove-from-endorsement { reason } (decision 37B). for_endorsement → archived (HR =
 * actor; HR's reason in status_reason, never shown to the applicant): neutral, so no pool entry and no company block
 * (BR-15/BR-19); the place counts again for Notify. The applicant gets a neutral notice. Any other status → 409.
 * Lock order (DATABASE_SCHEMA §8): job_vacancy → application (no applicant row: no pool entry is written).
 */
export async function removeFromEndorsement(hrId, applicationId, { reason }) {
  const app = await findApplicationForOutcome(applicationId);
  if (!app) throw notFound("Application not found.");
  return withTransaction(hrId, async (client) => {
    await lockVacancy(client, app.vacancyId); // 1. job_vacancy (Notify and Create endorsement hold it too)
    const locked = await lockApplication(client, applicationId); // 3. application
    if (!locked || locked.status !== A.FOR_ENDORSEMENT) {
      throw conflict("Only an applicant waiting for the endorsement can be removed. Refresh the page.");
    }
    await transition(client, locked, A.ARCHIVED, `Removed from endorsement: ${reason.trim()}`); // HR = actor
    await notify(client, { userId: app.userId, type: N.ENDORSEMENT_REMOVED, applicationId, vars: { jobTitle: app.jobTitle } });
    return { applicationId, status: A.ARCHIVED }; // never the company or the reason
  });
}

/**
 * The item's application under the locks (job_vacancy → applicant → application), with its status re-read and the
 * item's outcome still pending; 409 otherwise. Used by the final interview and For hiring steps.
 */
async function lockItemApplication(client, item, allowed, message) {
  await lockVacancy(client, item.vacancyId); // 1. job_vacancy (same order as the fill close-out)
  await lockApplicants(client, [item.applicantId]); // 2. applicant
  const locked = await lockApplication(client, item.applicationId); // 3. application
  const pending = (await findItemOutcome(client, item.itemId)) === ENDORSEMENT_OUTCOME.PENDING;
  if (!locked || !pending || !allowed.includes(locked.status)) throw conflict(message);
  return locked;
}

/**
 * POST /api/admin/endorsement-items/:id/final-interview { scheduledAt, details? } (decision 14). endorsed →
 * final_interview_scheduled + notice; while already scheduled, the time/details change (no move) + "time changed"
 * notice. Any time is accepted (no clock check). Details naming the company are refused (CLAUDE.md rule 4).
 */
export async function scheduleFinalInterview(hrId, itemId, { scheduledAt, details }) {
  const item = await findItem(itemId);
  if (!item) throw notFound("Endorsement item not found.");
  if (details) assertNoCompany(details, item.companyName, "details");

  return withTransaction(hrId, async (client) => {
    const locked = await lockItemApplication(
      client,
      item,
      [A.ENDORSED, A.FINAL_INTERVIEW_SCHEDULED],
      "A final interview can be scheduled only for an endorsed applicant waiting for the client. Refresh the page.",
    );
    const rescheduling = locked.status === A.FINAL_INTERVIEW_SCHEDULED;
    await setFinalInterview(client, { itemId, scheduledAt, details });
    if (!rescheduling) await transition(client, locked, A.FINAL_INTERVIEW_SCHEDULED, "Final interview scheduled"); // HR = actor
    await notify(client, {
      userId: item.userId,
      type: rescheduling ? N.FINAL_INTERVIEW_RESCHEDULED : N.FINAL_INTERVIEW_SCHEDULED,
      applicationId: item.applicationId,
      vars: { jobTitle: item.jobTitle, scheduledAt, details },
    });
    return { itemId, applicationId: item.applicationId, status: A.FINAL_INTERVIEW_SCHEDULED, finalInterviewAt: scheduledAt, rescheduled: rescheduling };
  });
}

/**
 * POST /api/admin/endorsement-items/:id/advance { to } (decision 37C): exactly one stage forward (NEXT_CLIENT_STAGE):
 * final_interview_scheduled → for_training (Proceed) → for_requirements → for_orientation; HR = actor; the applicant
 * gets the stage notice. Skipping a stage or any other status → 409. Deployed is the hired outcome (recordOutcome).
 */
export async function advanceStage(hrId, itemId, { to }) {
  const from = Object.keys(NEXT_CLIENT_STAGE).find((status) => NEXT_CLIENT_STAGE[status] === to);
  if (!from) throw businessRule("Choose the next stage.");
  const item = await findItem(itemId);
  if (!item) throw notFound("Endorsement item not found.");
  return withTransaction(hrId, async (client) => {
    const locked = await lockItemApplication(client, item, [from], "This applicant is not at the step before that stage. Refresh the page.");
    await transition(client, locked, to, ADVANCE[to].reason); // HR = actor
    await notify(client, { userId: item.userId, type: ADVANCE[to].notice, applicationId: item.applicationId, vars: { jobTitle: item.jobTitle } });
    return { itemId, applicationId: item.applicationId, status: to };
  });
}

/**
 * PATCH /api/admin/endorsement-items/:id/outcome { outcome, remarks? } (FR-END-07/09; decision 15).
 * hired (Deployed, decision 37C), only from for_orientation (or an old for_hiring row) → hired; when the vacancy's
 * hired count reaches slots_needed it fills and closes out here (BR-22). not_hired, from any stage with the client
 * (WITH_CLIENT_STATUSES) → not_hired + pool (not_hired), then
 * the automatic rematch (S17): the response adds
 * `rematch: { status: "offered", offerId, jobTitle, companyName } | { status: "no_match" } | { status: "failed" }`.
 * A second outcome, or an application that moved, → 409.
 */
export async function recordOutcome(hrId, itemId, { outcome, remarks }) {
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
    if (!locked || !WITH_CLIENT_STATUSES.includes(locked.status) || (await findItemOutcome(client, itemId)) !== ENDORSEMENT_OUTCOME.PENDING) {
      throw conflict("The client's decision for this applicant was already recorded, or the application moved. Refresh the page.");
    }
    if (hiring && !DEPLOYABLE.includes(locked.status)) {
      throw conflict("Move the applicant through training, requirements and orientation first.");
    }

    await setItemOutcome(client, { itemId, outcome, hrId, remarks });
    const status = hiring ? A.HIRED : A.NOT_HIRED;
    await transition(client, locked, status, hiring ? "Client decision: hired" : NOT_HIRED_REASON[locked.status]); // HR = actor
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
      // Phase 3: an open job that fills → its pending job invitations end (vacancy already locked).
      if (vacancy.status === VACANCY_STATUS.OPEN) await expireJobInvitations(client, item.vacancyId);
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

  // S17 (BR-23): after the not_hired commit, the automatic rematch runs OUTSIDE the transaction (it calls svc). It never
  // throws: the not_hired stays committed and HR can run the rematch again.
  if (hiring) return result;
  return { ...result, rematch: await runRematchAfterNotHired(hrId, item.applicationId) };
}

/**
 * POST /api/admin/endorsement-items/:id/training-failed (FR-END-08; decision 37C: only at for_training) →
 * training_failed (failed: frees the applicant and blocks the company, BR-19) + pool (training_failed, Returned by
 * Client) + neutral notice. The item's outcome becomes not_hired with remarks "Training failed" (existing enum: the
 * client's decision is recorded once). No automatic rematch (as before). Same locks as the other steps.
 */
export async function markTrainingFailed(hrId, itemId) {
  const item = await findItem(itemId);
  if (!item) throw notFound("Endorsement item not found.");
  return withTransaction(hrId, async (client) => {
    const locked = await lockItemApplication(client, item, [A.FOR_TRAINING], "Training can be marked failed only at For training. Refresh the page.");
    await setItemOutcome(client, { itemId, outcome: ENDORSEMENT_OUTCOME.NOT_HIRED, hrId, remarks: "Training failed" });
    await transition(client, locked, A.TRAINING_FAILED, "Training failed"); // HR = actor
    await addToPool(client, { applicantId: item.applicantId, applicationId: item.applicationId, reason: POOL_REASON.TRAINING_FAILED });
    await notify(client, { userId: item.userId, type: N.TRAINING_FAILED, applicationId: item.applicationId, vars: { jobTitle: item.jobTitle } });
    return { itemId, applicationId: item.applicationId, status: A.TRAINING_FAILED };
  });
}
