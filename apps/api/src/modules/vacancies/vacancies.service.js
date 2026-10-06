import { APPLICATION_STATUS as A, VACANCY_STATUS } from "@vera/shared";

import { withTransaction } from "../../db/tx.js";
import { assertTransition, PUBLISHED_EDITABLE_STATUSES } from "../../domain/vacancyStatus.js";
import { AppError, businessRule, notFound, validationError } from "../../lib/errors.js";

import {
  competencyTotal,
  findVacancy,
  findVacancyCompetencies,
  findVacancyDefaults,
  insertVacancy,
  listVacancies,
  lockVacancy,
  replaceCompetencies,
  setApplicationCap,
  setVacancyStatus,
  updatePostingText,
  updateVacancyFull,
} from "./vacancies.repository.js";
import { PUBLISHED_EDITABLE_FIELDS, publishedVacancySchema, vacancySchema, weightTotal } from "./vacancies.schemas.js";

// Applicant counts per stage on the HR vacancy list (FR-VAC-05).
const STAGES = {
  screening: [A.WAITING_POOL, A.SHORTLISTED],
  interview: [A.INTERVIEW_SCHEDULED, A.INTERVIEW_CONFIRMED],
  passed: [A.PASSED, A.PASSED_AWAITING_CONFIRMATION, A.FOR_ENDORSEMENT, A.ENDORSED],
  hired: [A.HIRED],
};

const capOnlyUp = (current) =>
  businessRule(`The application cap can only be raised (now ${current}).`, [
    { path: "applicationCap", message: `Use ${current} or more` },
  ]);

/** Constraint errors from Postgres → readable API errors (the zod schema catches these first). */
async function withDbErrors(work) {
  try {
    return await work();
  } catch (error) {
    if (error.code === "23503") {
      throw businessRule("The selected company or competency no longer exists.", [{ path: "companyId", message: "Select an existing company" }]);
    }
    if (error.code === "23514") throw validationError("Some values are not allowed. Check the pipeline settings and competency weights.");
    throw error;
  }
}

export function getVacancyDefaults() {
  return findVacancyDefaults();
}

export async function searchVacancies(query) {
  const { rows, total } = await listVacancies({ ...query, stages: STAGES });
  const data = rows.map(({ total: all, screening, interview, passed, hired, ...vacancy }) => ({
    ...vacancy,
    hiredCount: hired,
    remainingSlots: Math.max(vacancy.slotsNeeded - hired, 0),
    counts: { total: all, screening, interview, passed, hired },
  }));
  return { data, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export async function getVacancy(vacancyId) {
  const vacancy = await findVacancy(vacancyId);
  if (!vacancy) throw notFound("Vacancy not found.");
  const competencies = await findVacancyCompetencies(vacancyId);
  const published = PUBLISHED_EDITABLE_STATUSES.includes(vacancy.status);
  return {
    ...vacancy,
    competencies,
    weightTotal: weightTotal(competencies),
    editable: { full: vacancy.status === VACANCY_STATUS.DRAFT, postingText: published, capIncrease: published },
  };
}

/** New vacancy = draft + its competency weights, in one transaction (CLAUDE.md rule 7). */
export async function createVacancy(fields, userId) {
  const vacancyId = await withDbErrors(() =>
    withTransaction(userId, async (client) => {
      const id = await insertVacancy(client, fields, userId);
      await replaceCompetencies(client, id, fields.competencies);
      return id;
    }),
  );
  return getVacancy(vacancyId);
}

/**
 * Edit (PRD FR-VAC-03): drafts change freely; after publishing only the posting text and a higher
 * application cap, so every applicant is screened and scored by the same rules.
 */
export async function editVacancy(vacancyId, body, userId) {
  await withDbErrors(() =>
    withTransaction(userId, async (client) => {
      const current = await lockVacancy(client, vacancyId);
      if (!current) throw notFound("Vacancy not found.");

      if (current.status === VACANCY_STATUS.DRAFT) {
        const fields = vacancySchema.parse(body);
        await updateVacancyFull(client, vacancyId, fields);
        await replaceCompetencies(client, vacancyId, fields.competencies);
        return;
      }

      if (!PUBLISHED_EDITABLE_STATUSES.includes(current.status)) {
        throw new AppError(409, "BUSINESS_RULE", `A ${current.status} vacancy can no longer be edited.`);
      }
      const locked = Object.keys(body).filter((key) => !PUBLISHED_EDITABLE_FIELDS.includes(key));
      if (locked.length > 0) {
        throw businessRule(
          "These fields are locked after publishing.",
          locked.map((path) => ({ path, message: "Locked after publishing" })),
        );
      }
      const fields = publishedVacancySchema.parse(body);
      if (fields.applicationCap < current.applicationCap) throw capOnlyUp(current.applicationCap);
      await updatePostingText(client, vacancyId, fields);
    }),
  );
  return getVacancy(vacancyId);
}

/**
 * Publish / close / reopen / archive (FR-VAC-03, APP_FLOW §5.2), under the vacancy row lock.
 * Publish needs weights = 100. Reopen needs applications < cap; the cap may be raised in the same step (FR-VAC-07).
 */
export async function changeVacancyStatus(vacancyId, action, body, userId) {
  await withTransaction(userId, async (client) => {
    const current = await lockVacancy(client, vacancyId);
    if (!current) throw notFound("Vacancy not found.");
    const nextStatus = assertTransition(current.status, action);

    if (action === "publish") {
      const { total, count } = await competencyTotal(client, vacancyId);
      if (count === 0 || total !== 100) {
        throw businessRule(`Competency weights must total 100% before publishing (now ${total}%).`);
      }
    }

    if (action === "reopen") {
      let cap = current.applicationCap;
      if (body.applicationCap !== undefined) {
        if (body.applicationCap < cap) throw capOnlyUp(cap);
        cap = body.applicationCap;
        await setApplicationCap(client, vacancyId, cap);
      }
      if (current.applicationCount >= cap) {
        throw businessRule(
          `Applications (${current.applicationCount}) have reached the cap (${cap}). Raise the application cap to reopen.`,
          [{ path: "applicationCap", message: `Use more than ${current.applicationCount}` }],
        );
      }
    }

    await setVacancyStatus(client, vacancyId, nextStatus, { posted: action === "publish", closed: action === "close" });
  });
  return getVacancy(vacancyId);
}
