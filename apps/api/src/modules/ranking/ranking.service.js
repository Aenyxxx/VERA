// Final ranking, Notify, and the applicant's endorsement answer (PRD FR-END-01, FR-END-03, FR-END-04, FR-VAC-06;
// ROADMAP S15, decided Oct 10, 2026):
// - Ranking: every evaluated application of the vacancy, both groups, ordered by RANK-03.
// - Notify: HR picks any passed applicants, up to the places left in the endorsement (endorsement_count −
//   notified − confirmed − endorsed, BR-23 definition); each → passed_awaiting_confirmation with action_due_at =
//   now + response_deadline_days; the message body is HR's (never the company), the deadline line is fixed.
// - Answer: the applicant confirms (→ for_endorsement, S16 picks it up) or declines (→ archived: neutral, no pool
//   entry, no company block). The deadline is shown, not enforced (automatic expiry deferred, ROADMAP §6).
// Lock order (DATABASE_SCHEMA §8): job_vacancy → application (no applicant row: no pool entry is written here).
// No svc calls. Status changes only through statusMachine.transition; HR or the applicant is the history actor.
import {
  APPLICATION_STATUS as A,
  NOTIFICATION_TYPE as N,
  VACANCY_STATUS as V,
  notifyMessageDefault,
} from "@vera/shared";

import { withTransaction } from "../../db/tx.js";
import { notify, notifyStaff } from "../../domain/notify.js";
import { rankApplications } from "../../domain/ranking.js";
import { transition } from "../../domain/statusMachine.js";
import { responseDueAt } from "../../domain/verification.js";
import { businessRule, conflict, notFound } from "../../lib/errors.js";
import { lockApplication } from "../screening/screening.repository.js";
import { lockVacancy } from "../vacancies/vacancies.repository.js";

import {
  findApplicationForAnswer,
  findRankingVacancy,
  listEvaluatedApplications,
  lockApplicationsForNotify,
  setActionDueAt,
} from "./ranking.repository.js";

/** Vacancies whose passed applicants can still be notified (not draft, filled, or archived). */
export const NOTIFIABLE_VACANCY_STATUSES = Object.freeze([V.OPEN, V.CLOSED, V.ENDORSING]);

const remainingPlaces = (vacancy) => Math.max(vacancy.endorsementCount - vacancy.committed, 0);

// ---------------------------------------------------------------- read

/** GET /api/admin/vacancies/:id/ranking (HR: company and scores allowed). */
export async function getRanking(vacancyId) {
  const vacancy = await findRankingVacancy(vacancyId);
  if (!vacancy) throw notFound("Vacancy not found.");
  const rows = await listEvaluatedApplications(vacancyId);
  const { committed, ...rest } = vacancy;
  return {
    vacancy: {
      ...rest,
      committed,
      notifyRemaining: remainingPlaces(vacancy),
      canNotify: NOTIFIABLE_VACANCY_STATUSES.includes(vacancy.status),
    },
    ranking: rankApplications(rows),
  };
}

// ---------------------------------------------------------------- write

/** The applicant must never see the client company (CLAUDE.md rule 4), so HR's text may not name it. */
function assertNoCompany(message, companyName) {
  if (message.toLowerCase().includes(companyName.toLowerCase())) {
    throw businessRule("Remove the company name: applicants never see the client company.", [
      { path: "message", message: "Remove the company name" },
    ]);
  }
}

/**
 * POST /api/admin/vacancies/:id/notify { applicationIds, message? } (FR-END-03).
 * Everything is re-checked under the locks: vacancy status, places left, each application passed and in this
 * vacancy. The notification body = HR's message (or the default) + "Please confirm on your dashboard by …".
 */
export async function notifyApplicants(hrId, vacancyId, { applicationIds, message }) {
  const ids = [...new Set(applicationIds)].sort();
  return withTransaction(hrId, async (client) => {
    if (!(await lockVacancy(client, vacancyId))) throw notFound("Vacancy not found."); // 1. job_vacancy
    const vacancy = await findRankingVacancy(vacancyId, client); // read under the vacancy lock
    if (!NOTIFIABLE_VACANCY_STATUSES.includes(vacancy.status)) {
      throw conflict(`This vacancy is ${vacancy.status}; its applicants can no longer be notified.`);
    }
    const body = (message ?? notifyMessageDefault(vacancy.jobTitle)).trim();
    assertNoCompany(body, vacancy.companyName);

    const remaining = remainingPlaces(vacancy);
    if (ids.length > remaining) {
      throw businessRule(
        `Only ${remaining} more applicant${remaining === 1 ? "" : "s"} can be notified (endorsement count ${vacancy.endorsementCount}).`,
      );
    }

    const locked = await lockApplicationsForNotify(client, ids); // 2. applications, ascending id
    if (locked.length !== ids.length || locked.some((a) => a.vacancyId !== vacancyId)) {
      throw notFound("One of the applications is not in this vacancy.");
    }
    if (locked.some((a) => a.status !== A.PASSED)) {
      throw conflict("Only passed applicants can be notified. Refresh the ranking.");
    }

    const actionDueAt = await responseDueAt(client);
    for (const application of locked) {
      await transition(client, application, A.PASSED_AWAITING_CONFIRMATION, "Notified for endorsement"); // HR = actor
      await setActionDueAt(client, application.applicationId, actionDueAt);
      await notify(client, {
        userId: application.userId,
        type: N.PASSED_CONFIRM_ENDORSEMENT,
        applicationId: application.applicationId,
        vars: { jobTitle: vacancy.jobTitle, message: body, actionDueAt },
        requiresAction: true,
      });
    }
    return { notified: ids, actionDueAt, remaining: remaining - ids.length };
  });
}

/**
 * POST /api/applicant/applications/:id/endorsement/confirm | /decline (FR-END-04). Someone else's application → 404.
 * Only while passed_awaiting_confirmation (a close-out that won the lock moved it to standby → 409).
 * @param {"confirm"|"decline"} answer
 */
export async function answerEndorsement(userId, applicationId, answer) {
  const found = await findApplicationForAnswer(applicationId);
  if (!found || found.userId !== userId) throw notFound("Application not found.");
  const confirming = answer === "confirm";

  return withTransaction(userId, async (client) => {
    await lockVacancy(client, found.vacancyId); // 1. job_vacancy (a close-out or Notify holds it too)
    const locked = await lockApplication(client, applicationId); // 3. application (no applicant row needed)
    if (!locked || locked.status !== A.PASSED_AWAITING_CONFIRMATION) {
      if (confirming && locked?.status === A.FOR_ENDORSEMENT) throw conflict("You already confirmed this endorsement.");
      throw conflict("This endorsement is no longer waiting for your answer. Refresh the page.");
    }

    const status = confirming ? A.FOR_ENDORSEMENT : A.ARCHIVED;
    await transition(client, locked, status, confirming ? "Applicant confirmed the endorsement" : "Applicant declined the endorsement");
    await setActionDueAt(client, applicationId, null);
    await notifyStaff(client, {
      type: confirming ? N.HR_ENDORSEMENT_CONFIRMED : N.HR_ENDORSEMENT_DECLINED,
      applicationId,
      vars: { applicantName: found.applicantName, jobTitle: found.jobTitle },
      linkPath: `/admin/vacancies/${found.vacancyId}`,
    });
    return { applicationId, status }; // never the company, scores, or status_reason
  });
}
