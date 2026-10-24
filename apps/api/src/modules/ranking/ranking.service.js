// Final ranking and Notify (PRD FR-END-01, FR-END-03, FR-VAC-06; ROADMAP S15, decided Oct 10, 2026):
// - Ranking: every evaluated application of the vacancy, both groups, ordered by RANK-03.
// - Notify: HR picks any passed applicants, up to the places left in the endorsement (endorsement_count − committed,
//   BR-23 definition). Decision 37B: no applicant confirmation; each → for_endorsement at once, with an information
//   notice "Selected for endorsement: {job}" = HR's body (never the company) + the final interview line (decision 32).
//   No deadline, nothing to answer; S16's Create endorsement picks them up.
// Lock order (DATABASE_SCHEMA §8): job_vacancy → application (no applicant row: no pool entry is written here).
// No svc calls. Status changes only through statusMachine.transition; HR is the history actor.
import {
  APPLICATION_STATUS as A,
  NOTIFICATION_TYPE as N,
  VACANCY_STATUS as V,
  notifyMessageDefault,
} from "@vera/shared";

import { withTransaction } from "../../db/tx.js";
import { notify } from "../../domain/notify.js";
import { rankApplications } from "../../domain/ranking.js";
import { transition } from "../../domain/statusMachine.js";
import { businessRule, conflict, notFound } from "../../lib/errors.js";
import { lockVacancy } from "../vacancies/vacancies.repository.js";

import { findRankingVacancy, listEvaluatedApplications, lockApplicationsForNotify } from "./ranking.repository.js";

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

/**
 * The applicant must never see the client company (CLAUDE.md rule 4), so HR's text may not name it. Also used for
 * the final interview details (decision 14, field "details").
 */
export function assertNoCompany(message, companyName, field = "message") {
  if (message.toLowerCase().includes(companyName.toLowerCase())) {
    throw businessRule("Remove the company name: applicants never see the client company.", [
      { path: field, message: "Remove the company name" },
    ]);
  }
}

/**
 * POST /api/admin/vacancies/:id/notify { applicationIds, message? } (FR-END-03).
 * Everything is re-checked under the locks: vacancy status, places left, each application passed and in this
 * vacancy. Decision 37B: each → for_endorsement (no confirmation, no action_due_at); the notice body = HR's message
 * (or the default) + the final interview line.
 */
export async function notifyApplicants(hrId, vacancyId, { applicationIds, message, finalInterviewAt, finalInterviewDetails }) {
  const ids = [...new Set(applicationIds)].sort();
  return withTransaction(hrId, async (client) => {
    if (!(await lockVacancy(client, vacancyId))) throw notFound("Vacancy not found."); // 1. job_vacancy
    const vacancy = await findRankingVacancy(vacancyId, client); // read under the vacancy lock
    if (!NOTIFIABLE_VACANCY_STATUSES.includes(vacancy.status)) {
      throw conflict(`This vacancy is ${vacancy.status}; its applicants can no longer be notified.`);
    }
    const body = (message ?? notifyMessageDefault(vacancy.jobTitle)).trim();
    assertNoCompany(body, vacancy.companyName);
    assertNoCompany(finalInterviewDetails, vacancy.companyName, "finalInterviewDetails"); // decision 32, rule 4

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

    for (const application of locked) {
      await transition(client, application, A.FOR_ENDORSEMENT, "Notified for endorsement"); // HR = actor
      await notify(client, {
        userId: application.userId,
        type: N.ENDORSEMENT_NOTICE,
        applicationId: application.applicationId,
        vars: { jobTitle: vacancy.jobTitle, message: body, finalInterviewAt, finalInterviewDetails },
      });
    }
    return { notified: ids, status: A.FOR_ENDORSEMENT, remaining: remaining - ids.length };
  });
}

// Decision 37B: POST /api/applicant/applications/:id/endorsement/confirm | /decline are removed (the routes → 404).
