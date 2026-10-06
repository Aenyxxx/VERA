import {
  APPLICATION_STATUS,
  ENDORSEMENT_OUTCOME,
  ENDORSEMENT_STATUS,
  VACANCY_STATUS,
} from "@vera/shared";

import { conflict, notFound } from "../../lib/errors.js";

import {
  companyCounts,
  findCompany,
  insertCompany,
  listCompanies,
  updateCompany,
} from "./companies.repository.js";

// What each FR-COMP-03 count means (PRD FR-COMP-03).
const COUNT_STATUSES = {
  archived: VACANCY_STATUS.ARCHIVED,
  open: VACANCY_STATUS.OPEN,
  interviewStatuses: [APPLICATION_STATUS.INTERVIEW_SCHEDULED, APPLICATION_STATUS.INTERVIEW_CONFIRMED],
  sent: ENDORSEMENT_STATUS.SENT,
  pending: ENDORSEMENT_OUTCOME.PENDING,
  hired: ENDORSEMENT_OUTCOME.HIRED,
};

const duplicateName = () =>
  conflict("A company with this name already exists.", [
    { path: "companyName", message: "A company with this name already exists" },
  ]);

/** Unique index company_name_key = lower(company_name): "Kabayan Mart" and "kabayan mart" are the same company. */
async function saveOrConflict(write) {
  try {
    return await write();
  } catch (error) {
    if (error.code === "23505") throw duplicateName();
    throw error;
  }
}

export async function searchCompanies(query) {
  const { rows, total } = await listCompanies({ ...query, archivedStatus: VACANCY_STATUS.ARCHIVED });
  return { data: rows, meta: { page: query.page, pageSize: query.pageSize, total } };
}

export async function getCompany(companyId) {
  const company = await findCompany(companyId);
  if (!company) throw notFound("Company not found.");
  return { ...company, counts: await companyCounts(companyId, COUNT_STATUSES) };
}

export async function createCompany(fields, createdBy) {
  const companyId = await saveOrConflict(() => insertCompany(fields, createdBy));
  return findCompany(companyId);
}

export async function editCompany(companyId, fields) {
  const updated = await saveOrConflict(() => updateCompany(companyId, fields));
  if (!updated) throw notFound("Company not found.");
  return findCompany(companyId);
}
