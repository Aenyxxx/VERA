// Endorsement Management and client outcomes (PRD FR-END-05..09, BR-17, BR-19, BR-22, BR-23; ROADMAP S16, decided
// Oct 10, 2026):
// - Decision 39-3: there is no Create endorsement. Notify on the Ranking tab (ranking.service notifyApplicants) creates
//   each batch with its final interview; this module shows the batches (Outcomes, printable page) and records the
//   client's steps. Passed applicants who were not notified stay passed (close-out → standby). Old
//   passed_awaiting_confirmation rows (before decision 37B) stay; they become standby at fill.
// - Outcome: hired (Deployed; blocks applying, BR-17) or not_hired (failed: frees and blocks
//   the company, BR-19; pool not_hired, then the automatic rematch, S17). When hired reaches slots_needed the
//   vacancy fills and closes out in the same transaction (endorsed still pending → standby).
// - Decision 37C (fixed client-outcome order): final interview → Proceed (for_training) → training passed
//   (for_requirements) → requirements complete (for_orientation) → Deployed (the hired outcome: fills the vacancy and
//   closes out as before). Not hired at every step before Deployed (pool not_hired + automatic rematch). Training failed
//   only at for_training: item outcome not_hired with remarks "Training failed", pool training_failed, no rematch.
//   No clock check anywhere: HR can record each step right away.
// - Decision 39-3: HR "Remove" at the final interview (the applicant told the agency they will not continue):
//   final_interview_scheduled → archived, neutral (no pool entry, no company block); the item stays pending with
//   remarks; the place counts again for Notify.
// Lock order (DATABASE_SCHEMA §8): job_vacancy → applicants (ascending) → applications (ascending), level by level.
// No svc calls. Status changes only through statusMachine.transition; HR is the actor, system moves use asSystem.
import {
  APPLICATION_STATUS as A,
  ENDORSEMENT_OUTCOME,
  NEXT_CLIENT_STAGE,
  NOTIFICATION_TYPE as N,
  POOL_REASON,
  VACANCY_STATUS,
  WITH_CLIENT_STATUSES,
} from "@vera/shared";

import { withTransaction } from "../../db/tx.js";
import { closeOutCandidates, closeOutVacancy } from "../../domain/closeOut.js";
import { expireJobInvitations } from "../../domain/invitationExpiry.js";
import { notify } from "../../domain/notify.js";
import { addToPool } from "../../domain/pool.js";
import { transition } from "../../domain/statusMachine.js";
import { assertSystemMove } from "../../domain/vacancyStatus.js";
import { businessRule, conflict, notFound } from "../../lib/errors.js";
import { assertNoCompany } from "../ranking/ranking.service.js";
import { runRematchAfterNotHired } from "../rematch/rematch.service.js";
import { lockApplication } from "../screening/screening.repository.js";
import { lockVacancy, setVacancyStatus } from "../vacancies/vacancies.repository.js";

import {
  countHired,
  findEndorsementForPrint,
  findEndorsementVacancy,
  findItem,
  findItemOutcome,
  listEndorsements,
  listEndorsementVacancies,
  lockApplicants,
  setFinalInterview,
  setItemOutcome,
  setItemRemarks,
} from "./endorsements.repository.js";

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

// ---------------------------------------------------------------- read

/** GET /api/admin/endorsements */
export async function getEndorsementVacancies() {
  return listEndorsementVacancies();
}

/** GET /api/admin/endorsements/:vacancyId — the vacancy and its endorsements (decision 39-3: Outcomes only). */
export async function getEndorsementVacancy(vacancyId) {
  const vacancy = await findEndorsementVacancy(vacancyId);
  if (!vacancy) throw notFound("Vacancy not found.");
  return { vacancy, endorsements: await listEndorsements(vacancyId) };
}

/** GET /api/admin/endorsements/print/:endorsementId — the printable endorsement (HR document for the client). */
export async function getEndorsementPrint(endorsementId) {
  const printable = await findEndorsementForPrint(endorsementId);
  if (!printable) throw notFound("Endorsement not found.");
  return printable;
}

// ---------------------------------------------------------------- write

/**
 * The item's application under the locks (job_vacancy → applicant → application), with its status re-read and the
 * item's outcome still pending; 409 otherwise. Used by the final interview, stage, Training failed and Remove steps.
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
 * POST /api/admin/endorsement-items/:id/remove { reason } (decision 39-3; moved from decision 37B's Candidates tab). Only at
 * the final interview: final_interview_scheduled → archived (HR = actor; HR's reason in status_reason, never shown to the
 * applicant). The item's outcome stays pending with outcome_remarks "Removed from endorsement" (like the close-out's
 * "vacancy filled"; no enum change). Neutral: no pool entry, no company block, no rematch; the place counts again for
 * Notify; the row leaves Outcomes. Any other status, or an outcome already recorded → 409.
 */
export async function removeFromEndorsement(hrId, itemId, { reason }) {
  const item = await findItem(itemId);
  if (!item) throw notFound("Endorsement item not found.");
  return withTransaction(hrId, async (client) => {
    const locked = await lockItemApplication(
      client,
      item,
      [A.FINAL_INTERVIEW_SCHEDULED],
      "Only an applicant at the final interview can be removed. Refresh the page.",
    );
    await setItemRemarks(client, itemId, "Removed from endorsement");
    await transition(client, locked, A.ARCHIVED, `Removed from endorsement: ${reason.trim()}`); // HR = actor
    await notify(client, { userId: item.userId, type: N.ENDORSEMENT_REMOVED, applicationId: item.applicationId, vars: { jobTitle: item.jobTitle } });
    return { itemId, applicationId: item.applicationId, status: A.ARCHIVED }; // never the company or the reason
  });
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
  // throws: the not_hired stays committed; without an offer the applicant stays in the pool (decision 39-2).
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
