import { pool } from "../../db/pool.js";

const COMPANY_COLUMNS = `
  c.company_id as "companyId", c.company_name as "companyName", c.industry, c.description, c.website,
  c.contact_person_name as "contactPersonName", c.contact_person_position as "contactPersonPosition",
  c.contact_email as "contactEmail", c.contact_number as "contactNumber",
  c.created_at as "createdAt", c.updated_at as "updatedAt"`;

/** "50%_off" → "50\%\_off" so user input is matched literally inside ILIKE. */
const escapeLike = (text) => text.replace(/[\\%_]/g, (ch) => `\\${ch}`);

/** FR-COMP-01: companies by name (case-insensitive contains), alphabetical, paginated. */
export async function listCompanies({ search, page, pageSize, archivedStatus }, db = pool) {
  const pattern = `%${escapeLike(search)}%`;
  const offset = (page - 1) * pageSize;

  const [{ rows }, { rows: totals }] = await Promise.all([
    db.query(
      `select c.company_id as "companyId", c.company_name as "companyName", c.industry,
              c.contact_person_name as "contactPersonName", c.contact_email as "contactEmail",
              (select count(*)::int from public.job_vacancy v
                where v.company_id = c.company_id and v.status <> $4) as "vacancyCount"
         from public.company c
        where c.company_name ilike $1
        order by lower(c.company_name)
        limit $2 offset $3`,
      [pattern, pageSize, offset, archivedStatus],
    ),
    db.query(`select count(*)::int as total from public.company c where c.company_name ilike $1`, [pattern]),
  ]);
  return { rows, total: totals[0].total };
}

export async function findCompany(companyId, db = pool) {
  const { rows } = await db.query(`select ${COMPANY_COLUMNS} from public.company c where c.company_id = $1`, [companyId]);
  return rows[0] ?? null;
}

/**
 * FR-COMP-03 summary counts for one company. Status values come from @vera/shared (passed as parameters).
 * @param {{ archived: string, open: string, interviewStatuses: string[], sent: string, pending: string, hired: string }} s
 */
export async function companyCounts(companyId, s, db = pool) {
  const { rows } = await db.query(
    `select
       (select count(*)::int from public.job_vacancy v where v.company_id = $1 and v.status <> $2) as "vacancies",
       (select count(*)::int from public.job_vacancy v where v.company_id = $1 and v.status = $3) as "openVacancies",
       (select count(*)::int
          from public.application a
          join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
         where v.company_id = $1 and a.status = any($4::public.application_status[])) as "inAgencyInterview",
       (select count(*)::int
          from public.endorsement_item ei
          join public.endorsement e on e.endorsement_id = ei.endorsement_id
         where e.company_id = $1 and e.status = $5 and ei.outcome = $6) as "awaitingClient",
       (select count(*)::int
          from public.endorsement_item ei
          join public.endorsement e on e.endorsement_id = ei.endorsement_id
         where e.company_id = $1 and e.status = $5 and ei.outcome = $7) as "hired",
       (select count(*)::int
          from public.endorsement_item ei
          join public.endorsement e on e.endorsement_id = ei.endorsement_id
         where e.company_id = $1 and e.status = $5) as "endorsed"`,
    [companyId, s.archived, s.open, s.interviewStatuses, s.sent, s.pending, s.hired],
  );
  return rows[0];
}

export async function insertCompany(c, createdBy, db = pool) {
  const { rows } = await db.query(
    `insert into public.company
       (company_name, industry, description, website, contact_person_name, contact_person_position,
        contact_email, contact_number, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning company_id as "companyId"`,
    [
      c.companyName, c.industry, c.description, c.website, c.contactPersonName, c.contactPersonPosition,
      c.contactEmail, c.contactNumber, createdBy,
    ],
  );
  return rows[0].companyId;
}

/** Returns false when the company does not exist. */
export async function updateCompany(companyId, c, db = pool) {
  const { rowCount } = await db.query(
    `update public.company
        set company_name = $2, industry = $3, description = $4, website = $5, contact_person_name = $6,
            contact_person_position = $7, contact_email = $8, contact_number = $9
      where company_id = $1`,
    [
      companyId, c.companyName, c.industry, c.description, c.website, c.contactPersonName,
      c.contactPersonPosition, c.contactEmail, c.contactNumber,
    ],
  );
  return rowCount > 0;
}
