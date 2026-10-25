// Final ranking and Notify (PRD FR-END-01, FR-END-03, FR-VAC-06; ROADMAP S15, decided Oct 10, 2026):
// - Ranking: every evaluated application of the vacancy, both groups, ordered by RANK-03.
// - Notify (decision 39-3) = the endorsement: HR picks passed applicants (up to the places left, BR-23) and accepted
//   rematch offers waiting at for_endorsement (they already hold a place), with HR's message and the client's final
//   interview. ONE transaction (HR = actor): one endorsement batch (sent) + one item per applicant with the schedule,
//   each passed / for_endorsement → endorsed → final_interview_scheduled (two history rows), ONE notice each
//   ("Selected for endorsement" = HR's body + the final interview line), vacancy → endorsing (an open job's pending
//   job invitations end). Passed applicants not notified stay passed (close-out → standby at fill / archive).
// Lock order (DATABASE_SCHEMA §8): job_vacancy → application (no applicant row: no pool entry is written here).
// No svc calls. Status changes only through statusMachine.transition; HR is the history actor.
import {
  APPLICATION_STATUS as A,
  ENDORSEMENT_STATUS,
  NOTIFICATION_TYPE as N,
  VACANCY_STATUS as V,
  notifyMessageDefault,
} from "@vera/shared";

import { withTransaction } from "../../db/tx.js";
import { expireJobInvitations } from "../../domain/invitationExpiry.js";
import { notify } from "../../domain/notify.js";
import { rankApplications } from "../../domain/ranking.js";
import { transition } from "../../domain/statusMachine.js";
import { assertSystemMove } from "../../domain/vacancyStatus.js";
import { businessRule, conflict, notFound } from "../../lib/errors.js";
import { insertEndorsement, insertEndorsementItem } from "../endorsements/endorsements.repository.js";
import { lockVacancy, setVacancyStatus } from "../vacancies/vacancies.repository.js";

import { findRankingVacancy, listEvaluatedApplications, lockApplicationsForNotify } from "./ranking.repository.js";

/** Vacancies whose passed applicants can still be notified (not draft, filled, or archived). */
export const NOTIFIABLE_VACANCY_STATUSES = Object.freeze([V.OPEN, V.CLOSED, V.ENDORSING]);

/** Decision 39-3: who Notify endorses. for_endorsement = an accepted rematch offer (or an older notified row). */
export const NOTIFIABLE_STATUSES = Object.freeze([A.PASSED, A.FOR_ENDORSEMENT]);

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
 * POST /api/admin/vacancies/:id/notify { applicationIds, message?, finalInterviewAt, finalInterviewDetails }
 * (FR-END-03/05; decision 39-3: Notify = the endorsement). Everything is re-checked under the locks: vacancy status,
 * each application passed or for_endorsement and in this vacancy, then the places left (only passed rows take a new
 * place). One batch, one item each with the final interview, passed / for_endorsement → endorsed →
 * final_interview_scheduled, one notice each (HR's message or the default + the final interview line), vacancy →
 * endorsing.
 */
export async function notifyApplicants(hrId, vacancyId, { applicationIds, message, finalInterviewAt, finalInterviewDetails }) {
  const ids = [...new Set(applicationIds)].sort();
  return withTransaction(hrId, async (client) => {
    if (!(await lockVacancy(client, vacancyId))) throw notFound("Vacancy not found."); // 1. job_vacancy
    const vacancy = await findRankingVacancy(vacancyId, client); // read under the vacancy lock
    if (!NOTIFIABLE_VACANCY_STATUSES.includes(vacancy.status)) {
      throw conflict(`This vacancy is ${vacancy.status}; its applicants can no longer be notified.`);
    }
    const nextStatus = assertSystemMove(vacancy.status, "endorse"); // open, closed, endorsing → endorsing
    const body = (message ?? notifyMessageDefault(vacancy.jobTitle)).trim();
    assertNoCompany(body, vacancy.companyName);
    assertNoCompany(finalInterviewDetails, vacancy.companyName, "finalInterviewDetails"); // decision 32, rule 4

    const locked = await lockApplicationsForNotify(client, ids); // 2. applications, ascending id
    if (locked.length !== ids.length || locked.some((a) => a.vacancyId !== vacancyId)) {
      throw notFound("One of the applications is not in this vacancy.");
    }
    if (locked.some((a) => !NOTIFIABLE_STATUSES.includes(a.status))) {
      throw conflict("Only passed applicants (or accepted job offers waiting for the endorsement) can be notified. Refresh the ranking.");
    }
    // BR-23: only passed applicants take a new place (a for_endorsement row already counts in `committed`)
    const newPlaces = locked.filter((a) => a.status === A.PASSED).length;
    const remaining = remainingPlaces(vacancy);
    if (newPlaces > remaining) {
      throw businessRule(
        `Only ${remaining} more applicant${remaining === 1 ? "" : "s"} can be notified (endorsement count ${vacancy.endorsementCount}).`,
      );
    }

    // rank_at_endorsement and final_score from the stored evaluations (RANK-03 order, like this tab)
    const rankOf = new Map(rankApplications(await listEvaluatedApplications(vacancyId, client)).map((r) => [r.applicationId, r]));
    const endorsement = await insertEndorsement(client, { vacancyId, status: ENDORSEMENT_STATUS.SENT, hrId });
    for (const application of locked) {
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
      await transition(client, { ...application, status: A.ENDORSED }, A.FINAL_INTERVIEW_SCHEDULED, "Final interview scheduled");
      await notify(client, {
        userId: application.userId,
        type: N.ENDORSEMENT_NOTICE, // the ONE notice (decision 39-3)
        applicationId: application.applicationId,
        vars: { jobTitle: vacancy.jobTitle, message: body, finalInterviewAt, finalInterviewDetails },
      });
    }
    await setVacancyStatus(client, vacancyId, nextStatus);
    if (vacancy.status === V.OPEN) await expireJobInvitations(client, vacancyId); // vacancy already locked
    return {
      endorsementId: endorsement.endorsementId,
      sentAt: endorsement.sentAt,
      notified: ids,
      status: A.FINAL_INTERVIEW_SCHEDULED,
      vacancyStatus: nextStatus,
      remaining: remaining - newPlaces,
    };
  });
}

// Decision 37B: POST /api/applicant/applications/:id/endorsement/confirm | /decline are removed (the routes → 404).
