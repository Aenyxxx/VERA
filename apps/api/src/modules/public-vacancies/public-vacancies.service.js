import { VACANCY_STATUS } from "@vera/shared";

import { notFound } from "../../lib/errors.js";

import { findOpenVacancy, listOpenVacancies } from "./public-vacancies.repository.js";

/** Applicants see only open vacancies (FR-VAC-04), never one at a company where they failed (BR-19). */
export async function searchOpenVacancies(query, userId) {
  const { rows, total } = await listOpenVacancies({ ...query, openStatus: VACANCY_STATUS.OPEN, userId });
  return { data: rows, meta: { page: query.page, pageSize: query.pageSize, total } };
}

/** A failed-company vacancy answers exactly like a closed one: no hint about the company or the reason. */
export async function getOpenVacancy(vacancyId, userId) {
  const vacancy = await findOpenVacancy(vacancyId, VACANCY_STATUS.OPEN, userId);
  if (!vacancy) throw notFound("This job is no longer open.");
  return vacancy;
}
