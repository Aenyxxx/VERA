// SQL for Endorsement Management and client outcomes (S16; PRD FR-END-05..09). HR only: company and scores allowed.
// Functions that write take the transaction client first. pg returns numeric as strings, so scores go through
// Number(). Any $n used twice in one statement carries the same explicit cast.
import { APPLICATION_STATUS as A, VACANCY_STATUS as V } from "@vera/shared";

import { pool } from "../../db/pool.js";

const num = (value) => (value == null ? null : Number(value));
const COUNTED = [A.FOR_ENDORSEMENT, A.ENDORSED, A.HIRED];

/** Vacancies that have reached endorsement: someone for_endorsement, endorsed, or hired, or the vacancy endorsing/filled. */
export async function listEndorsementVacancies(db = pool) {
  const { rows } = await db.query(
    `select v.job_vacancy_id as "vacancyId", v.job_title as "jobTitle", c.company_name as "companyName", v.status,
            v.slots_needed as "slotsNeeded", v.endorsement_count as "endorsementCount",
            count(*) filter (where a.status = $1::public.application_status)::int as "forEndorsement",
            count(*) filter (where a.status = $2::public.application_status)::int as "endorsed",
            count(*) filter (where a.status = $3::public.application_status)::int as "hired"
       from public.job_vacancy v
       join public.company c on c.company_id = v.company_id
       left join public.application a on a.job_vacancy_id = v.job_vacancy_id
      group by v.job_vacancy_id, c.company_name
     having count(*) filter (where a.status = any($4::public.application_status[])) > 0
         or v.status = any($5::public.vacancy_status[])
      order by v.job_title`,
    [A.FOR_ENDORSEMENT, A.ENDORSED, A.HIRED, COUNTED, [V.ENDORSING, V.FILLED]],
  );
  return rows;
}

/** One vacancy for Endorsement Management (and the hired count that decides "filled"). */
export async function findEndorsementVacancy(vacancyId, db = pool) {
  const { rows } = await db.query(
    `select v.job_vacancy_id as "vacancyId", v.job_title as "jobTitle", c.company_name as "companyName", v.status,
            v.slots_needed as "slotsNeeded", v.endorsement_count as "endorsementCount",
            (select count(*)::int from public.application a
              where a.job_vacancy_id = v.job_vacancy_id and a.status = $2::public.application_status) as "hiredCount",
            (select count(*)::int from public.application a
              where a.job_vacancy_id = v.job_vacancy_id and a.status = $3::public.application_status) as "passedCount"
       from public.job_vacancy v
       join public.company c on c.company_id = v.company_id
      where v.job_vacancy_id = $1::uuid`,
    [vacancyId, A.HIRED, A.PASSED],
  );
  return rows[0] ?? null;
}

/** Applications of the vacancy in the given statuses, with applicant ids (ascending application id). */
export async function listApplicationsByStatus(client, vacancyId, statuses) {
  const { rows } = await client.query(
    `select application_id as "applicationId", applicant_id as "applicantId", status
       from public.application
      where job_vacancy_id = $1::uuid and status = any($2::public.application_status[])
      order by application_id`,
    [vacancyId, statuses],
  );
  return rows;
}

/** Applicant row locks in one statement, ascending id (DATABASE_SCHEMA §8: after job_vacancy, before applications). */
export async function lockApplicants(client, applicantIds) {
  await client.query(
    `select applicant_id from public.applicant
      where applicant_id = any($1::uuid[])
      order by applicant_id
      for update`,
    [applicantIds],
  );
}

/** Application row locks in one statement, ascending id; the statuses returned are the ones that count. */
export async function lockApplications(client, applicationIds) {
  const { rows } = await client.query(
    `select a.application_id as "applicationId", a.applicant_id as "applicantId", a.job_vacancy_id as "vacancyId",
            a.status, p.user_account_id as "userId"
       from public.application a
       join public.applicant p on p.applicant_id = a.applicant_id
      where a.application_id = any($1::uuid[])
      order by a.application_id
      for update of a`,
    [applicationIds],
  );
  return rows;
}

/** The endorsement batch (status sent: the printable page replaces email, ROADMAP §6). */
export async function insertEndorsement(client, { vacancyId, status, hrId }) {
  const { rows } = await client.query(
    `insert into public.endorsement (job_vacancy_id, company_id, status, sent_by, sent_at)
     select v.job_vacancy_id, v.company_id, $2::public.endorsement_status, $3::uuid, now()
       from public.job_vacancy v
      where v.job_vacancy_id = $1::uuid
     returning endorsement_id as "endorsementId", sent_at as "sentAt"`,
    [vacancyId, status, hrId],
  );
  return rows[0];
}

export async function insertEndorsementItem(client, { endorsementId, applicationId, rank, finalScore }) {
  await client.query(
    `insert into public.endorsement_item (endorsement_id, application_id, rank_at_endorsement, final_score)
     values ($1::uuid, $2::uuid, $3::smallint, $4::numeric)`,
    [endorsementId, applicationId, rank, finalScore],
  );
}

/** Endorsements of a vacancy with their items (newest first), for the Outcomes view. */
export async function listEndorsements(vacancyId, db = pool) {
  const { rows } = await db.query(
    `select e.endorsement_id as "endorsementId", e.sent_at as "sentAt",
            i.endorsement_item_id as "itemId", i.application_id as "applicationId",
            i.rank_at_endorsement as "rank", i.final_score as "finalScore", i.outcome,
            i.client_interview_at as "clientInterviewAt", i.outcome_remarks as "outcomeRemarks",
            i.outcome_recorded_at as "outcomeRecordedAt",
            a.status, a.applicant_type as "applicantType",
            trim(concat_ws(' ', p.first_name, p.last_name)) as "applicantName"
       from public.endorsement e
       join public.endorsement_item i on i.endorsement_id = e.endorsement_id
       join public.application a on a.application_id = i.application_id
       join public.applicant p on p.applicant_id = a.applicant_id
      where e.job_vacancy_id = $1::uuid
      order by e.sent_at desc, i.rank_at_endorsement`,
    [vacancyId],
  );
  const byId = new Map();
  for (const row of rows) {
    if (!byId.has(row.endorsementId)) byId.set(row.endorsementId, { endorsementId: row.endorsementId, sentAt: row.sentAt, items: [] });
    const { endorsementId: _e, sentAt: _s, ...item } = row;
    byId.get(row.endorsementId).items.push({ ...item, finalScore: num(item.finalScore) });
  }
  return [...byId.values()];
}

/** The printable endorsement (HR document sent to the client: company and scores included). */
export async function findEndorsementForPrint(endorsementId, db = pool) {
  const { rows } = await db.query(
    `select e.endorsement_id as "endorsementId", e.sent_at as "sentAt", coalesce(u.full_name, u.email) as "sentBy",
            v.job_vacancy_id as "vacancyId", v.job_title as "jobTitle", v.deployment_location as "deploymentLocation",
            v.employment_type as "employmentType", v.slots_needed as "slotsNeeded",
            c.company_name as "companyName", c.contact_person_name as "contactPersonName", c.contact_email as "contactEmail",
            i.endorsement_item_id as "itemId", i.application_id as "applicationId", i.rank_at_endorsement as "rank",
            i.final_score as "finalScore", i.outcome, a.applicant_type as "applicantType",
            p.first_name as "firstName", p.middle_name as "middleName", p.last_name as "lastName", p.suffix,
            p.email, p.contact_number as "contactNumber", p.age, p.gender, p.education_level as "educationLevel",
            p.address_line as "addressLine", p.city, p.province,
            fe.matching_score as "matchingScore", fe.interview_score as "interviewScore",
            fe.overall_rating as "overallRating", m.matched_skills as "matchedSkills"
       from public.endorsement e
       join public.job_vacancy v on v.job_vacancy_id = e.job_vacancy_id
       join public.company c on c.company_id = e.company_id
       left join public.user_account u on u.user_account_id = e.sent_by
       join public.endorsement_item i on i.endorsement_id = e.endorsement_id
       join public.application a on a.application_id = i.application_id
       join public.v_applicant_profile p on p.applicant_id = a.applicant_id
       left join public.final_evaluation fe on fe.application_id = a.application_id
       left join public.matching_result m on m.application_id = a.application_id
      where e.endorsement_id = $1::uuid
      order by i.rank_at_endorsement`,
    [endorsementId],
  );
  if (rows.length === 0) return null;
  const head = rows[0];
  return {
    endorsementId: head.endorsementId,
    sentAt: head.sentAt,
    sentBy: head.sentBy,
    vacancy: {
      vacancyId: head.vacancyId,
      jobTitle: head.jobTitle,
      deploymentLocation: head.deploymentLocation,
      employmentType: head.employmentType,
      slotsNeeded: head.slotsNeeded,
    },
    company: { companyName: head.companyName, contactPersonName: head.contactPersonName, contactEmail: head.contactEmail },
    candidates: rows.map((r) => ({
      itemId: r.itemId,
      applicationId: r.applicationId,
      rank: r.rank,
      outcome: r.outcome,
      applicantType: r.applicantType,
      fullName: [r.firstName, r.middleName, r.lastName, r.suffix].filter(Boolean).join(" "),
      email: r.email,
      contactNumber: r.contactNumber,
      age: r.age,
      gender: r.gender,
      educationLevel: r.educationLevel,
      address: [r.addressLine, r.city, r.province].filter(Boolean).join(", "),
      matchedSkills: r.matchedSkills ?? [],
      matchingScore: num(r.matchingScore),
      interviewScore: num(r.interviewScore),
      finalScore: num(r.finalScore),
      overallRating: num(r.overallRating),
    })),
  };
}

/** One endorsement item with what the outcome needs (read before the transaction to know which rows to lock). */
export async function findItem(itemId, db = pool) {
  const { rows } = await db.query(
    `select i.endorsement_item_id as "itemId", i.application_id as "applicationId", i.outcome,
            a.job_vacancy_id as "vacancyId", a.applicant_id as "applicantId", a.status,
            p.user_account_id as "userId", v.job_title as "jobTitle"
       from public.endorsement_item i
       join public.application a on a.application_id = i.application_id
       join public.applicant p on p.applicant_id = a.applicant_id
       join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
      where i.endorsement_item_id = $1::uuid`,
    [itemId],
  );
  return rows[0] ?? null;
}

/** The item's outcome, re-read under the application lock (items are written only while it is held). */
export async function findItemOutcome(client, itemId) {
  const { rows } = await client.query(
    `select outcome from public.endorsement_item where endorsement_item_id = $1::uuid`,
    [itemId],
  );
  return rows[0]?.outcome ?? null;
}

export async function setItemOutcome(client, { itemId, outcome, hrId, clientInterviewAt, remarks }) {
  await client.query(
    `update public.endorsement_item
        set outcome = $2::public.endorsement_outcome, outcome_recorded_by = $3::uuid, outcome_recorded_at = now(),
            client_interview_at = $4::timestamptz, outcome_remarks = $5::text
      where endorsement_item_id = $1::uuid`,
    [itemId, outcome, hrId, clientInterviewAt ?? null, remarks ?? null],
  );
}

/** Hired applications of the vacancy (decides "filled": hired = slots, FR-END-09). */
export async function countHired(client, vacancyId) {
  const { rows } = await client.query(
    `select count(*)::int as "hired" from public.application
      where job_vacancy_id = $1::uuid and status = $2::public.application_status`,
    [vacancyId, A.HIRED],
  );
  return rows[0].hired;
}

/** One application with what Training failed needs (read before the transaction). */
export async function findApplicationForOutcome(applicationId, db = pool) {
  const { rows } = await db.query(
    `select a.application_id as "applicationId", a.job_vacancy_id as "vacancyId", a.applicant_id as "applicantId",
            a.status, p.user_account_id as "userId", v.job_title as "jobTitle"
       from public.application a
       join public.applicant p on p.applicant_id = a.applicant_id
       join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
      where a.application_id = $1::uuid`,
    [applicationId],
  );
  return rows[0] ?? null;
}
