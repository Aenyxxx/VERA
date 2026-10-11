// Applicant Management (PRD FR-ADM-02, S18): searchable, filterable, paged list of applicants with their current
// application. The status filter reuses the dashboard tiles (@vera/shared DASHBOARD_TILES). Read-only.
import { DASHBOARD_TILES } from "@vera/shared";

import { listApplicants } from "./applicants.repository.js";

/** GET /api/admin/applicants?search=&status=&page=&pageSize= → { data, meta: { page, pageSize, total } } */
export async function searchApplicants({ search, status, page, pageSize }) {
  const { rows, total } = await listApplicants({
    search,
    statuses: status && status !== "applicantPool" ? DASHBOARD_TILES[status].statuses : null,
    poolOnly: status === "applicantPool",
    page,
    pageSize,
  });
  return { data: rows, meta: { page, pageSize, total } };
}
