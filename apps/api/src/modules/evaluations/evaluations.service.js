// Evaluation and scores (PRD FR-INT-06, FR-INT-08, FR-END-02, BR-06, BR-07, BR-21; ROADMAP S14, decided Oct 10, 2026):
// - Evaluate: HR rates all 15 Competency Profile items once the confirmed interview has started.
// - Reuse: an applicant with an earlier evaluation is never interviewed again; their original 15 ratings are scored
//   with this vacancy's section weights (WSM-03) after full verification.
// Both store competency_rating (evaluate only) + final_evaluation and move the application to passed / did_not_pass;
// did_not_pass also enters the applicant pool. The server recomputes every score from the ratings (domain/scoring.js).
// Lock order in every transaction (DATABASE_SCHEMA §8): job_vacancy → applicant → application. Rows read again after
// the application lock are the ones that count. No svc calls here. Status changes only through
// statusMachine.transition; HR is the history actor (vera.actor_id).
import {
  APPLICATION_STATUS as A,
  INTERVIEW_STATUS as I,
  NOTIFICATION_TYPE as N,
  POOL_REASON,
} from "@vera/shared";

import { withTransaction } from "../../db/tx.js";
import { notify } from "../../domain/notify.js";
import { addToPool } from "../../domain/pool.js";
import { reusedRatingsSource } from "../../domain/reuse.js";
import { buildEvaluation } from "../../domain/scoring.js";
import { transition } from "../../domain/statusMachine.js";
import { isFullyVerified } from "../../domain/verification.js";
import { businessRule, conflict, notFound } from "../../lib/errors.js";
import { lockApplicant } from "../applications/applications.repository.js";
import { listRubric } from "../competencies/competencies.repository.js";
import { setInterviewStatus } from "../interviews/interviews.repository.js";
import {
  findCurrentResume,
  listApplicationRequests,
  listCurrentDocumentsForHr,
  lockApplication,
} from "../screening/screening.repository.js";
import { findVacancySectionWeights, lockVacancy } from "../vacancies/vacancies.repository.js";

import {
  findApplicationForEvaluation,
  findEvaluation,
  findLatestAttempt,
  insertFinalEvaluation,
  insertRatings,
  listRatings,
} from "./evaluations.repository.js";

// Last line of defense for a double submit (the status re-check under the locks normally answers first).
// Default Postgres names of the two unique constraints; any other error stays a 500.
const ALREADY_EVALUATED_CONSTRAINTS = ["final_evaluation_application_id_key", "competency_rating_application_id_competency_id_key"];
const alreadyEvaluated = () => conflict("This application was already evaluated. Refresh the page.");

async function rethrowDuplicate(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error.code === "23505" && ALREADY_EVALUATED_CONSTRAINTS.includes(error.constraint)) throw alreadyEvaluated();
    throw error;
  }
}

/** Why HR cannot evaluate yet (null = they can). Same rules as the POST, shown on the page. */
function evaluateBlockedReason(app, attempt, evaluation) {
  if (evaluation) return "This application already has an evaluation.";
  if (app.status !== A.INTERVIEW_CONFIRMED || attempt?.status !== I.CONFIRMED) {
    return "Only a confirmed interview can be evaluated.";
  }
  if (!attempt.started) return "The interview has not started yet.";
  return null;
}

// ---------------------------------------------------------------- read

/** GET /api/admin/applications/:id/evaluation — the Interview Assessment evaluation page. */
export async function getEvaluation(applicationId) {
  const app = await findApplicationForEvaluation(applicationId);
  if (!app) throw notFound("Application not found.");
  const rubric = await listRubric();
  const weights = await findVacancySectionWeights(app.vacancyId);
  const attempt = await findLatestAttempt(applicationId);
  const stored = await findEvaluation(applicationId);

  const weightOf = Object.fromEntries(weights.map((w) => [w.sectionCode, Number(w.weight ?? 0)]));
  let evaluation = null;
  if (stored) {
    // A reused evaluation has no ratings of its own: show the original interview's (read-only).
    const reused = stored.sourceApplicationId !== applicationId;
    evaluation = {
      ratings: await listRatings(stored.sourceApplicationId),
      sectionScores: stored.sectionScores,
      interviewScore: stored.interviewScore,
      overallRating: stored.overallRating,
      matchingScore: stored.matchingScore,
      finalScore: stored.finalScore,
      passingScore: stored.passingScore,
      passed: stored.passed,
      computedAt: stored.computedAt,
      reused,
      source: reused
        ? {
            applicationId: stored.sourceApplicationId,
            jobTitle: stored.sourceJobTitle,
            companyName: stored.sourceCompanyName,
            ratedAt: stored.sourceRatedAt,
          }
        : null,
    };
  }
  const blockedReason = evaluateBlockedReason(app, attempt, stored);

  return {
    application: {
      applicationId: app.applicationId,
      status: app.status,
      applicantType: app.applicantType,
      applicantName: app.applicantName,
      matchingScore: app.matchingScore,
      passingScore: app.passingScore,
    },
    vacancy: { vacancyId: app.vacancyId, jobTitle: app.jobTitle, companyName: app.companyName },
    sections: rubric.map((section) => ({ ...section, weight: weightOf[section.sectionCode] ?? 0 })),
    interview: attempt
      ? { interviewId: attempt.interviewId, status: attempt.status, scheduledAt: attempt.scheduledAt, started: attempt.started }
      : null,
    evaluation,
    canEvaluate: blockedReason === null,
    blockedReason,
  };
}

// ---------------------------------------------------------------- write

/**
 * Stores final_evaluation and moves the application (both endpoints). The stored generated columns decide
 * passed / did_not_pass; they must equal the JS result (FIN-01 is enforced twice, ALGORITHM.md §4).
 */
async function saveEvaluation(client, { app, locked, hrId, scores, sourceApplicationId, reason }) {
  const saved = await insertFinalEvaluation(client, {
    applicationId: app.applicationId,
    matchingScore: app.matchingScore,
    interviewScore: scores.interviewScore,
    passingScore: app.passingScore,
    sectionScores: scores.sectionScores,
    sourceApplicationId,
    hrId,
  });
  if (saved.finalScore !== scores.finalScore || saved.passed !== scores.passed || saved.overallRating !== scores.overallRating) {
    throw new Error("Stored final score differs from the computed one (FIN-01 / WSM-02 in SQL vs JS).");
  }

  const status = saved.passed ? A.PASSED : A.DID_NOT_PASS;
  await transition(client, locked, status, reason); // HR is the history actor (vera.actor_id)
  if (status === A.DID_NOT_PASS) {
    // FR-END-02: applicant pool (applicant row locked above) + neutral notice (no score, no company).
    await addToPool(client, { applicantId: app.applicantId, applicationId: app.applicationId, reason: POOL_REASON.DID_NOT_PASS });
    await notify(client, {
      userId: app.userId,
      type: N.EVALUATION_DID_NOT_PASS,
      applicationId: app.applicationId,
      vars: { jobTitle: app.jobTitle },
    });
  }

  return {
    applicationId: app.applicationId,
    status,
    sectionScores: saved.sectionScores,
    interviewScore: saved.interviewScore,
    overallRating: saved.overallRating,
    matchingScore: saved.matchingScore,
    finalScore: saved.finalScore,
    passingScore: saved.passingScore,
    passed: saved.passed,
    ratingsSourceApplicationId: saved.sourceApplicationId,
    reused: saved.sourceApplicationId !== app.applicationId,
  };
}

/**
 * POST /api/admin/applications/:id/evaluation { ratings: [{ competencyId, rating }] } (FR-INT-06).
 * Allowed only for interview_confirmed with a confirmed attempt whose start time has passed (checked in SQL
 * under the locks, like Mark no-show); earlier → 409. The attempt becomes completed.
 */
export async function evaluateApplication(hrId, applicationId, { ratings }) {
  const app = await findApplicationForEvaluation(applicationId);
  if (!app) throw notFound("Application not found.");
  const rubric = await listRubric();
  const weights = await findVacancySectionWeights(app.vacancyId);
  // Validated before any lock: a wrong set of items is a 422 and no transaction starts.
  buildEvaluation({ rubric, ratings, sectionWeights: weights, matchingScore: app.matchingScore, passingScore: app.passingScore });

  return rethrowDuplicate(() =>
    withTransaction(hrId, async (client) => {
      await lockVacancy(client, app.vacancyId); // 1. job_vacancy (DATABASE_SCHEMA §8)
      await lockApplicant(client, app.applicantId); // 2. applicant (the pool entry is per applicant)
      const locked = await lockApplication(client, applicationId); // 3. application
      if (!locked || locked.status !== A.INTERVIEW_CONFIRMED) {
        // A no-show that won the lock (dropped) or an earlier evaluation (passed / did_not_pass) ends here.
        throw conflict("Only a confirmed interview can be evaluated. Refresh the page.");
      }
      const attempt = await findLatestAttempt(applicationId, client); // re-read under the application lock
      if (!attempt || attempt.status !== I.CONFIRMED) throw conflict("This interview is no longer open. Refresh the page.");
      if (!attempt.started) throw conflict("The interview has not started yet.");

      // The stored matching and passing scores are the ones read under the locks.
      const current = await findApplicationForEvaluation(applicationId, client);
      const scores = buildEvaluation({
        rubric,
        ratings,
        sectionWeights: weights,
        matchingScore: current.matchingScore,
        passingScore: current.passingScore,
      });
      await insertRatings(client, { applicationId, applicantId: current.applicantId, interviewId: attempt.interviewId, hrId, ratings });
      const result = await saveEvaluation(client, {
        app: current,
        locked,
        hrId,
        scores,
        sourceApplicationId: applicationId, // interviewed: the ratings are its own
        reason: "Interview evaluated",
      });
      if (!(await setInterviewStatus(client, attempt.interviewId, I.CONFIRMED, I.COMPLETED))) {
        throw conflict("This interview was changed by someone else. Refresh and try again.");
      }
      return { ...result, interviewId: attempt.interviewId, interviewStatus: I.COMPLETED };
    }),
  );
}

/**
 * POST /api/admin/applications/:id/evaluation/reuse (FR-INT-08, BR-21, WSM-03). No body.
 * Shortlisted + fully verified; source = reusedRatingsSource (the original interview, chain-safe); its 15 ratings ×
 * this vacancy's section weights. No interview, no rating rows of its own.
 */
export async function reuseRatings(hrId, applicationId) {
  const app = await findApplicationForEvaluation(applicationId);
  if (!app) throw notFound("Application not found.");
  const rubric = await listRubric();
  const weights = await findVacancySectionWeights(app.vacancyId);

  return rethrowDuplicate(() =>
    withTransaction(hrId, async (client) => {
      await lockVacancy(client, app.vacancyId); // 1. job_vacancy (DATABASE_SCHEMA §8)
      await lockApplicant(client, app.applicantId); // 2. applicant (the pool entry is per applicant)
      const locked = await lockApplication(client, applicationId); // 3. application
      if (!locked || locked.status !== A.SHORTLISTED) {
        throw conflict("Only a shortlisted application can use reused ratings. Refresh the page.");
      }

      // Re-read under the locks; one transaction client, so one query after another.
      const resume = await findCurrentResume(locked.applicantId, client);
      const documents = await listCurrentDocumentsForHr(locked.applicantId, client);
      const requests = await listApplicationRequests(applicationId, client);
      if (!isFullyVerified({ resume, documents, requests })) {
        throw businessRule("Verify the resume and every document before computing the final score.");
      }
      const source = await reusedRatingsSource(client, locked.applicantId, applicationId);
      if (!source) throw businessRule("This applicant has no earlier evaluation. Schedule an interview instead.");

      // The stored matching and passing scores are the ones read under the locks.
      const current = await findApplicationForEvaluation(applicationId, client);
      const scores = buildEvaluation({
        rubric,
        ratings: await listRatings(source.sourceApplicationId, client),
        sectionWeights: weights,
        matchingScore: current.matchingScore,
        passingScore: current.passingScore,
        incompleteMessage: "The earlier evaluation does not have all Competency Profile ratings.",
      });
      return saveEvaluation(client, {
        app: current,
        locked,
        hrId,
        scores,
        sourceApplicationId: source.sourceApplicationId,
        reason: "Reused ratings (BR-21)",
      });
    }),
  );
}
