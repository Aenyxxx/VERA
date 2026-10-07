import { VACANCY_STATUS } from "@vera/shared";

import { notFound } from "../../lib/errors.js";

import { findOpenVacancy, listOpenVacancies } from "./public-vacancies.repository.js";

/** Applicants see only open vacancies (FR-VAC-04). */
export async function searchOpenVacancies(query) {
  const { rows, total } = await listOpenVacancies({ ...query, openStatus: VACANCY_STATUS.OPEN });
  return { data: rows, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export async function getOpenVacancy(vacancyId) {
  const vacancy = await findOpenVacancy(vacancyId, VACANCY_STATUS.OPEN);
  if (!vacancy) throw notFound("This job is no longer open.");
  return vacancy;
}
