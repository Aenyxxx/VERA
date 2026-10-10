// Automatic rematch after a client rejection (PRD BR-23, FR-END-10, FR-POOL-01; ROADMAP S17, decided Oct 10, 2026):
// - Scan: right after a not_hired commit (or HR's "Run rematch again"), every eligible open vacancy is prescreened
//   (RANK-01), matched from the stored resume with the carried-over applicant type (MAT-04, svc /match, before any
//   transaction), checked against its threshold (RANK-02), and scored from the ORIGINAL interview ratings with its own
//   section weights (WSM-01/03, FIN-01). RANK-04 keeps and orders them; rank 1 is offered automatically.
// - Offer: one pool_invitation row (pending) under the applicant lock; at most one pending per pool entry.
// - Answer: accept → a new application (source rematch) straight at for_endorsement with matching_result and
//   final_evaluation from the offer; the pool entry closes. Decline → declined; HR may run the rematch again and the
//   declined vacancy is skipped. A failed re-check at accept expires the offer (committed) and answers 409.
// Lock order (DATABASE_SCHEMA §8): job_vacancy → applicant → application. The applicant never sees the company or a
// score (CLAUDE.md rule 4); HR may. Applications are only created through assertInitial (CLAUDE.md rule 1).
import {
  APPLICATION_SOURCE,
  APPLICATION_STATUS as A,
  INVITATION_STATUS as IS,
  NOTIFICATION_TYPE as N,
  POOL_AVAILABILITY,
  resolveMatchingWeights,
  VACANCY_STATUS,
} from "@vera/shared";

import { withTransaction } from "../../db/tx.js";
import { notify, notifyStaff } from "../../domain/notify.js";
import { prescreen } from "../../domain/prescreen.js";
import { rankRematch } from "../../domain/rematch.js";
import { buildEvaluation } from "../../domain/scoring.js";
import { meetsThreshold, storedMatchingScore } from "../../domain/shortlist.js";
import { assertInitial } from "../../domain/statusMachine.js";
import { responseDueAt } from "../../domain/verification.js";
import { AppError, businessRule, conflict, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { matchResume } from "../../lib/svcClient.js";
import {
  findApplicantForApply,
  findVacancyForApply,
  hasApplied,
  insertMatchingResult,
  isAtFailedCompany,
  lockApplicant,
} from "../applications/applications.repository.js";
import { listRubric } from "../competencies/competencies.repository.js";
import { insertFinalEvaluation, listRatings } from "../evaluations/evaluations.repository.js";
import { findVacancySectionWeights, lockVacancy } from "../vacancies/vacancies.repository.js";

import {
  closePoolEntry,
  countCommitted,
  findBlocking,
  findOffer,
  findPendingOffer,
  findRematchSource,
  insertOffer,
  insertRematchApplication,
  listMyOffers,
  listPool,
  listRematchVacancies,
  setOfferStatus,
  setPoolAvailability,
} from "./rematch.repository.js";

const POOL_PATH = "/admin/talent-pool";
const alreadyOffered = () => conflict("This applicant already has a pending rematch offer.");

// Last line of defense for simultaneous runs / answers (the re-checks under the locks normally answer first).
// Default Postgres names of the unique constraints involved; any other error stays a 500.
const DUPLICATE_MESSAGES = {
  pool_invitation_one_pending: "This applicant already has a pending rematch offer.",
  pool_invitation_talent_pool_id_job_vacancy_id_key: "This job was already offered to this applicant.",
  application_one_ongoing_per_applicant: "You already have an ongoing application. Refresh the page.",
  application_applicant_id_job_vacancy_id_key: "You already applied for this job.",
  final_evaluation_application_id_key: "This offer was already accepted. Refresh the page.",
};

async function rethrowDuplicate(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error.code === "23505" && DUPLICATE_MESSAGES[error.constraint]) throw conflict(DUPLICATE_MESSAGES[error.constraint]);
    throw error;
  }
}

// ---------------------------------------------------------------- scan + offer

/** Why the rematch cannot start for this application (null = it can). Checked before the scan and under the lock. */
async function notReadyReason(source, db) {
  if (source.status !== A.NOT_HIRED) return "Only a not-hired application can be rematched.";
  if (!source.talentPoolId || source.poolSourceApplicationId !== source.applicationId) {
    return "This applicant is no longer in the applicant pool for this application.";
  }
  if (await findBlocking(source.applicantId, db)) return "This applicant already has an ongoing or hired application.";
  if (await findPendingOffer(source.talentPoolId, db)) return "This applicant already has a pending rematch offer.";
  return null;
}

/**
 * Scores one candidate vacancy. Returns null when it never reaches RANK-04 (prescreen fails, or its section weights
 * are unusable); otherwise the numbers RANK-04 needs plus what the offer stores. Calls svc: never inside a transaction.
 */
async function scoreVacancy({ applicant, applicantType, ratings, rubric }, vacancy) {
  if (!prescreen(applicant, vacancy).passed) return null; // RANK-01
  const weights = resolveMatchingWeights(applicantType, vacancy); // MAT-04, the carried-over applicant type
  const match = await matchResume({
    sections: applicant.sections,
    job: { skills: vacancy.requiredSkills, experience: vacancy.experienceRequirement ?? "", minYears: vacancy.minYearsExperience },
    weights,
  });
  const matchingScore = storedMatchingScore(match.matchScore); // RANK-02 rounding, the stored value
  let scores;
  try {
    scores = buildEvaluation({
      rubric,
      ratings,
      sectionWeights: await findVacancySectionWeights(vacancy.vacancyId),
      matchingScore,
      passingScore: vacancy.passingScore,
      incompleteMessage: "The original evaluation does not have all Competency Profile ratings.",
    });
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    logger.warn({ vacancyId: vacancy.vacancyId, code: error.code }, "rematch: vacancy skipped (section weights)");
    return null;
  }
  return {
    vacancyId: vacancy.vacancyId,
    jobTitle: vacancy.jobTitle,
    companyName: vacancy.companyName,
    matchingThreshold: vacancy.matchingThreshold,
    passingScore: vacancy.passingScore,
    matchingScore,
    interviewScore: scores.interviewScore,
    sectionScores: scores.sectionScores,
    finalScore: scores.finalScore,
    matching: { match, weights, matchingScore },
  };
}

/**
 * Scan and offer (BR-23). Used by the not_hired hook and by POST /api/admin/applications/:id/rematch.
 * @param {string|null} actorId HR who recorded the outcome / clicked Run rematch again (history actor only)
 * @param {string} applicationId the not_hired application
 * @returns {Promise<{ status: "offered", offerId: string, vacancyId: string, jobTitle: string, companyName: string,
 *   matchingScore: number, interviewScore: number, finalScore: number, dueAt: string } | { status: "no_match" }>}
 */
export async function runRematch(actorId, applicationId) {
  // 1. Reads and the svc calls happen before the transaction (CLAUDE.md rule 7).
  const source = await findRematchSource(applicationId);
  if (!source) throw notFound("Application not found.");
  const notReady = await notReadyReason(source);
  if (notReady) throw conflict(notReady);
  if (!source.ratingsSourceApplicationId) throw businessRule("This application has no evaluation to reuse.");

  const applicant = await findApplicantForApply(source.userId);
  if (!applicant?.resumeId || !applicant.sections) throw businessRule("This applicant's resume details could not be read.");
  const ratings = await listRatings(source.ratingsSourceApplicationId); // the original interview (chain-safe, BR-21)
  const rubric = await listRubric();
  const vacancies = await listRematchVacancies({
    applicantId: source.applicantId,
    userId: source.userId,
    talentPoolId: source.talentPoolId,
  });

  // 2. One vacancy after another (svc is called once per vacancy).
  const candidates = [];
  for (const vacancy of vacancies) {
    const scored = await scoreVacancy({ applicant, applicantType: source.applicantType, ratings, rubric }, vacancy);
    if (scored) candidates.push(scored);
  }
  const [best] = rankRematch(candidates); // RANK-04: rank 1 is offered
  if (!best) return { status: "no_match" };

  // 3. The offer, under the applicant lock (the pool entry and the pending offer are per applicant).
  return rethrowDuplicate(() =>
    withTransaction(actorId, async (client) => {
      await lockApplicant(client, source.applicantId); // 2. applicant (no vacancy row changes)
      const current = await findRematchSource(applicationId, client);
      const reason = current?.talentPoolId === source.talentPoolId ? await notReadyReason(current, client) : "The applicant pool entry changed.";
      if (reason) throw conflict(reason);

      const offer = await insertOffer(client, {
        talentPoolId: source.talentPoolId,
        vacancyId: best.vacancyId,
        dueAt: await responseDueAt(client),
        applicantType: source.applicantType,
        matching: best.matching,
        matchingScore: best.matchingScore,
        sectionScores: best.sectionScores,
        interviewScore: best.interviewScore,
        finalScore: best.finalScore,
        ratingsSourceApplicationId: source.ratingsSourceApplicationId,
      });
      await setPoolAvailability(client, source.talentPoolId, POOL_AVAILABILITY.INVITED);
      await notify(client, {
        userId: source.userId,
        type: N.REMATCH_OFFER,
        vars: { jobTitle: best.jobTitle, dueAt: offer.dueAt },
        requiresAction: true,
      });
      await notifyStaff(client, {
        type: N.HR_REMATCH_OFFERED,
        applicationId,
        vars: { applicantName: source.applicantName, jobTitle: best.jobTitle, companyName: best.companyName },
        linkPath: POOL_PATH,
      });
      return {
        status: "offered",
        offerId: offer.offerId,
        vacancyId: best.vacancyId,
        jobTitle: best.jobTitle,
        companyName: best.companyName,
        matchingScore: best.matchingScore,
        interviewScore: best.interviewScore,
        finalScore: best.finalScore,
        dueAt: offer.dueAt,
      };
    }),
  );
}

/**
 * The not_hired hook (endorsements.service recordOutcome): the outcome is already committed and is never undone, so
 * any error here only means "no offer yet". Logged with ids only (no names, emails, or resume text).
 */
export async function runRematchAfterNotHired(actorId, applicationId) {
  try {
    const result = await runRematch(actorId, applicationId);
    return result.status === "offered"
      ? { status: result.status, offerId: result.offerId, jobTitle: result.jobTitle, companyName: result.companyName }
      : result;
  } catch (error) {
    logger.error({ applicationId, status: error.status, code: error.code }, "automatic rematch failed");
    return { status: "failed" };
  }
}

// ---------------------------------------------------------------- applicant answer

/**
 * Re-checks everything the scan assumed, under the vacancy and applicant locks. Returns the scores to store, or null
 * when the offer can no longer be accepted (the caller expires it).
 */
async function recheckOffer(client, { offer, vacancy, locked, userId, rubric, ratings, sectionWeights }) {
  if (!offer.poolActive) return null; // the pool entry was replaced (a later application ended)
  if (locked.status !== VACANCY_STATUS.OPEN) return null;
  if ((await countCommitted(client, offer.vacancyId)) >= offer.endorsementCount) return null; // endorsement full
  if (await findBlocking(offer.applicantId, client)) return null; // applied elsewhere in the meantime (BR-17)
  if (await isAtFailedCompany(offer.vacancyId, userId, client)) return null; // BR-19
  if (await hasApplied(offer.applicantId, offer.vacancyId, client)) return null; // BR-14
  const applicant = await findApplicantForApply(userId, client);
  if (!applicant?.resumeId || !prescreen(applicant, vacancy).passed) return null; // RANK-01 (profile may have changed)
  if (!meetsThreshold(offer.matchingScore, vacancy.matchingThreshold)) return null; // RANK-02, current threshold
  const scores = buildEvaluation({
    rubric,
    ratings,
    sectionWeights,
    matchingScore: offer.matchingScore,
    passingScore: offer.passingScore, // the vacancy's current passing score (read under the vacancy lock)
    incompleteMessage: "The original evaluation does not have all Competency Profile ratings.",
  });
  return scores.passed ? { scores, resumeId: applicant.resumeId } : null;
}

/**
 * POST /api/applicant/offers/:id/accept | /decline. Someone else's offer → 404; an answered offer → 409.
 * @param {"accept"|"decline"} answer
 */
export async function answerOffer(userId, offerId, answer) {
  const found = await findOffer(offerId);
  if (!found || found.userId !== userId) throw notFound("Offer not found.");
  const accepting = answer === "accept";
  // Read before the transaction (they do not change while the vacancy is locked for the answer).
  const rubric = accepting ? await listRubric() : null;
  const ratings = accepting ? await listRatings(found.ratingsSourceApplicationId) : null;
  const sectionWeights = accepting ? await findVacancySectionWeights(found.vacancyId) : null;
  const staffVars = { applicantName: found.applicantName, jobTitle: found.jobTitle, companyName: found.companyName };

  const result = await rethrowDuplicate(() =>
    withTransaction(userId, async (client) => {
      const locked = await lockVacancy(client, found.vacancyId); // 1. job_vacancy
      await lockApplicant(client, found.applicantId); // 2. applicant (pool entry, BR-17)
      const offer = await findOffer(offerId, client); // re-read under the locks
      if (!locked || !offer || offer.status !== IS.PENDING) {
        throw conflict(offer?.status === IS.EXPIRED ? "This job is no longer available." : "You already answered this offer. Refresh the page.");
      }

      if (!accepting) {
        if (!(await setOfferStatus(client, offerId, IS.PENDING, IS.DECLINED))) throw conflict("You already answered this offer.");
        await setPoolAvailability(client, offer.talentPoolId, POOL_AVAILABILITY.AVAILABLE);
        await notifyStaff(client, { type: N.HR_REMATCH_DECLINED, vars: staffVars, linkPath: POOL_PATH });
        return { offerId, status: IS.DECLINED };
      }

      const vacancy = await findVacancyForApply(offer.vacancyId, client);
      const checked = await recheckOffer(client, { offer, vacancy, locked, userId, rubric, ratings, sectionWeights });
      if (!checked) {
        // Committed on purpose (no throw inside the transaction): the offer ends, the applicant is told neutrally.
        if (!(await setOfferStatus(client, offerId, IS.PENDING, IS.EXPIRED))) throw conflict("You already answered this offer.");
        await setPoolAvailability(client, offer.talentPoolId, POOL_AVAILABILITY.AVAILABLE);
        await notify(client, { userId, type: N.REMATCH_OFFER_EXPIRED, vars: { jobTitle: offer.jobTitle } });
        return { offerId, status: IS.EXPIRED };
      }

      // 3. the new application: source rematch, straight to for_endorsement (BR-23)
      assertInitial(A.FOR_ENDORSEMENT, APPLICATION_SOURCE.REMATCH);
      const applicationId = await insertRematchApplication(client, {
        applicantId: offer.applicantId,
        vacancyId: offer.vacancyId,
        resumeId: checked.resumeId,
        applicantType: offer.applicantType,
      });
      await insertMatchingResult(client, applicationId, { ...offer.matching, matchingScore: offer.matchingScore });
      const { scores } = checked;
      const saved = await insertFinalEvaluation(client, {
        applicationId,
        matchingScore: offer.matchingScore,
        interviewScore: scores.interviewScore,
        passingScore: offer.passingScore,
        sectionScores: scores.sectionScores,
        sourceApplicationId: offer.ratingsSourceApplicationId, // the original interview (WSM-03)
        hrId: null, // computed by the system at accept
      });
      // FIN-01 is enforced twice (ALGORITHM.md §4): the stored generated columns must equal the JS result.
      if (saved.finalScore !== scores.finalScore || saved.passed !== scores.passed || saved.overallRating !== scores.overallRating) {
        throw new Error("Stored final score differs from the computed one (FIN-01 / WSM-02 in SQL vs JS).");
      }
      if (!(await setOfferStatus(client, offerId, IS.PENDING, IS.ACCEPTED, applicationId))) {
        throw conflict("You already answered this offer.");
      }
      await closePoolEntry(client, offer.talentPoolId);
      await notifyStaff(client, {
        type: N.HR_REMATCH_ACCEPTED,
        applicationId,
        vars: staffVars,
        linkPath: `/admin/endorsements/${offer.vacancyId}`,
      });
      return { offerId, status: IS.ACCEPTED, applicationId, applicationStatus: A.FOR_ENDORSEMENT }; // no company, no score
    }),
  );

  if (result.status === IS.EXPIRED) throw conflict("This job is no longer available. You can apply to other jobs.");
  return result;
}

// ---------------------------------------------------------------- reads

/** GET /api/applicant/offers — pending offers: job title, location, type, deadline (never the company or a score). */
export function getMyOffers(userId) {
  return listMyOffers(userId);
}

/** GET /api/admin/pool — the applicant pool (FR-POOL-01, minimal): free applicants only, with the latest offer. */
export function getPool() {
  return listPool();
}
