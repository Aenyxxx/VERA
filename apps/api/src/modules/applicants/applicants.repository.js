// SQL for Applicant Management (S18, PRD FR-ADM-02). Read-only, HR only: may show the company.
// Current application = the ongoing or hired one (unique by application_one_ongoing_per_applicant), else the latest
// by updated_at. Any $n used twice in one statement carries the same explicit cast.
import { BLOCKS_APPLYING_STATUSES } from "@vera/shared";

import { pool } from "../../db/pool.js";
import { freePoolEntry } from "../../domain/pool.js";

const escapeLike = (text) => text.replace(/[\\%_]/g, (ch) => `\\${ch}`);

// $1 search pattern · $2 BLOCKS_APPLYING_STATUSES · $3 status set of the chosen tile (or null) · $4 applicant-pool filter
const FROM_WHERE = `
  with cur as (
    select distinct on (a.applicant_id)
           a.applicant_id, a.application_id, a.status, a.updated_at, v.job_title, c.company_name
      from public.application a
      join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
      join public.company c on c.company_id = v.company_id
     order by a.applicant_id, (a.status = any($2::public.application_status[])) desc, a.updated_at desc, a.application_id desc
  )
  select %COLUMNS%
    from public.applicant p
    join public.user_account u on u.user_account_id = p.user_account_id
    left join cur on cur.applicant_id = p.applicant_id
   where (concat_ws(' ', p.first_name, p.middle_name, p.last_name, p.suffix) ilike $1 or u.email ilike $1)
     and ($3::public.application_status[] is null or cur.status = any($3::public.application_status[]))
     and (not $4::boolean or exists (select 1 from public.talent_pool tp
                                      where tp.applicant_id = p.applicant_id and ${freePoolEntry("tp", "$2")}))`;

const COLUMNS = `p.applicant_id as "applicantId",
         trim(concat_ws(' ', p.first_name, p.middle_name, p.last_name, p.suffix)) as "applicantName",
         u.email, cur.application_id as "applicationId", cur.status, cur.job_title as "jobTitle",
         cur.company_name as "companyName", coalesce(cur.updated_at, p.updated_at) as "lastUpdate"`;

/**
 * One page of applicants with their current application, and the total.
 * @param {{ search: string, statuses: string[]|null, poolOnly: boolean, page: number, pageSize: number }} query
 */
export async function listApplicants({ search, statuses, poolOnly, page, pageSize }, db = pool) {
  const filters = [`%${escapeLike(search)}%`, BLOCKS_APPLYING_STATUSES, statuses, poolOnly];
  const [{ rows }, { rows: totals }] = await Promise.all([
    db.query(
      `${FROM_WHERE.replace("%COLUMNS%", COLUMNS)}
        order by "lastUpdate" desc, p.applicant_id
        limit $5 offset $6`,
      [...filters, pageSize, (page - 1) * pageSize],
    ),
    db.query(FROM_WHERE.replace("%COLUMNS%", "count(*)::int as total"), filters),
  ]);
  return { rows, total: totals[0].total };
}
