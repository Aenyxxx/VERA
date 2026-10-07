// Apply flow (PRD FR-APP-01..09, BR-17..BR-20, docs/APP_FLOW.md §3.2):
// one ongoing application + no failed company (BR-17, BR-19) → prescreen (RANK-01) → svc /match from the stored extraction (MAT-04 weights) → threshold (RANK-02)
// → waiting pool → shortlist refresh (RANK-02) → vacancy closes when qualified applications reach the cap.
import {
  APPLICATION_STATUS as A,
  NOTIFICATION_TYPE as N,
  resolveMatchingWeights,
  VACANCY_STATUS,
} from "@vera/shared";

import { withTransaction } from "../../db/tx.js";
import { messageFor, notify } from "../../domain/notify.js";
import { prescreen } from "../../domain/prescreen.js";
import { meetsThreshold, refreshShortlist, storedMatchingScore } from "../../domain/shortlist.js";
import { assertInitial } from "../../domain/statusMachine.js";
import { assertTransition as assertVacancyTransition } from "../../domain/vacancyStatus.js";
import { conflict, notFound } from "../../lib/errors.js";
import { matchResume } from "../../lib/svcClient.js";
import { lockVacancy, setVacancyStatus } from "../vacancies/vacancies.repository.js";

import {
  findApplicantForApply,
  findBlockingApplication,
  findVacancyForApply,
  hasApplied,
  insertApplication,
  insertMatchingResult,
  isAtFailedCompany,
  listMyApplications,
  lockApplicant,
} from "./applications.repository.js";

const NOTIFICATION_FOR = {
  [A.PRESCREEN_FAILED]: N.PRESCREEN_FAILED,
  [A.BELOW_THRESHOLD]: N.BELOW_THRESHOLD,
  [A.WAITING_POOL]: N.APPLICATION_SUBMITTED,
};

const alreadyApplied = () => conflict("You already applied for this job.");
// BR-19: never say which company or why (CLAUDE.md rule 4); the job list already hides these vacancies.
const notAvailable = () => notFound("This job is not available for your application.");

/** BR-17: one ongoing application at a time; hired blocks applying until training_failed. */
function assertFreeToApply(blocking) {
  if (!blocking) return;
  if (blocking.status === A.HIRED) {
    throw conflict("You are already hired through Confiable Manpower, so you cannot apply to another job.");
  }
  throw ongoingApplication();
}
const ongoingApplication = () =>
  conflict("You already have an ongoing application. You can apply to another job once it is finished.");
const hasText = (sections) => Object.values(sections ?? {}).some((text) => String(text ?? "").trim() !== "");

/**
 * POST /api/applicant/applications
 * @param {string} userId the signed-in applicant (also the history actor for their own new application)
 * @param {{ vacancyId: string, applicantType: "first_time"|"experienced" }} input
 */
export async function applyToVacancy(userId, { vacancyId, applicantType }) {
  // 1. Reads and the slow svc call happen before the transaction (CLAUDE.md rule 7).
  const applicant = await findApplicantForApply(userId);
  if (!applicant) throw conflict("Confirm your profile before applying.");
  if (!applicant.resumeId || !hasText(applicant.sections)) {
    // No resume re-parse screen exists in the sprint (resume replacement is deferred, ROADMAP §6).
    throw conflict("We could not read your resume details. Please contact Confiable Manpower so we can update your resume.");
  }

  const vacancy = await findVacancyForApply(vacancyId);
  if (!vacancy || vacancy.status !== VACANCY_STATUS.OPEN) throw notFound("This job is no longer open.");
  if (await isAtFailedCompany(vacancyId, userId)) throw notAvailable();
  if (await hasApplied(applicant.applicantId, vacancyId)) throw alreadyApplied();
  assertFreeToApply(await findBlockingApplication(applicant.applicantId));

  // 2. Prescreen (RANK-01), then matching from the stored extraction; the PDF is never re-sent (rule 5).
  const screen = prescreen(applicant, vacancy);
  let matching = null;
  if (screen.passed) {
    const weights = resolveMatchingWeights(applicantType, vacancy); // MAT-04: skills only when the job has no experience criterion
    const match = await matchResume({
      sections: applicant.sections,
      job: {
        skills: vacancy.requiredSkills,
        experience: vacancy.experienceRequirement ?? "",
        minYears: vacancy.minYearsExperience,
      },
      weights,
    });
    matching = { match, weights, matchingScore: storedMatchingScore(match.matchScore) };
  }

  // 3. Status (RANK-02 threshold on the stored, rounded score).
  let status = A.WAITING_POOL;
  let reason = null;
  if (!screen.passed) {
    status = A.PRESCREEN_FAILED;
    reason = screen.failedConditions.map((c) => c.message).join(" ");
  } else if (!meetsThreshold(matching.matchingScore, vacancy.matchingThreshold)) {
    status = A.BELOW_THRESHOLD;
    reason = `Matching score ${matching.matchingScore} is below the threshold ${vacancy.matchingThreshold}.`;
  }
  assertInitial(status);

  const vars = { jobTitle: vacancy.jobTitle, conditions: screen.failedConditions.map((c) => c.message) };

  try {
    return await withTransaction(userId, async (client) => {
      // 4. Re-check under locks while matching ran: this applicant may have applied elsewhere (other tab), and
      //    another applicant may have filled the cap. Lock order: applicant, then vacancy.
      await lockApplicant(client, applicant.applicantId);
      assertFreeToApply(await findBlockingApplication(applicant.applicantId, client));
      if (await isAtFailedCompany(vacancyId, userId, client)) throw notAvailable();

      //    Rejected outcomes only need the vacancy to be open; they never use up the cap.
      const locked = await lockVacancy(client, vacancyId);
      const open = locked?.status === VACANCY_STATUS.OPEN;
      const capFull = open && locked.applicationCount >= locked.applicationCap;
      if (!open || (status === A.WAITING_POOL && capFull)) {
        throw conflict("Applications for this job just closed.");
      }

      const applicationId = await insertApplication(client, {
        applicantId: applicant.applicantId,
        vacancyId,
        resumeId: applicant.resumeId,
        applicantType,
        status,
        reason,
      });
      // Every outcome that went through svc /match keeps its matching_result (waiting_pool and below_threshold);
      // only prescreen_failed never reached matching and has none.
      if (status !== A.PRESCREEN_FAILED) await insertMatchingResult(client, applicationId, matching);
      let { message } = await notify(client, { userId, type: NOTIFICATION_FOR[status], applicationId, vars });

      let finalStatus = status;
      if (status === A.WAITING_POOL) {
        const { promoted } = await refreshShortlist(client, vacancyId, applicantType);
        if (promoted.includes(applicationId)) {
          finalStatus = A.SHORTLISTED;
          message = messageFor(N.SHORTLISTED, vars).message;
        }
        // FR-APP-07 / FR-VAC-07: this application took the last qualified place → stop accepting applications.
        if (locked.applicationCount + 1 >= locked.applicationCap) {
          await setVacancyStatus(client, vacancyId, assertVacancyTransition(locked.status, "close"), { closed: true });
        }
      }

      return {
        applicationId,
        status: finalStatus,
        message,
        ...(status === A.PRESCREEN_FAILED && { failedConditions: vars.conditions }),
      };
    });
  } catch (error) {
    if (error.code === "23505") {
      // Last line of defense for simultaneous submits: BR-17's index, or the unique applicant × vacancy.
      throw error.constraint === "application_one_ongoing_per_applicant" ? ongoingApplication() : alreadyApplied();
    }
    throw error;
  }
}

/** GET /api/applicant/applications — status panel rows (no company, no reasons, no scores). */
export function getMyApplications(userId) {
  return listMyApplications(userId);
}
