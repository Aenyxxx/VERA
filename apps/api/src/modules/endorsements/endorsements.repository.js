// SQL for Endorsement Management and client outcomes (S16; PRD FR-END-05..09). HR only: company and scores allowed.
// Functions that write take the transaction client first. pg returns numeric as strings, so scores go through
// Number(). Any $n used twice in one statement carries the same explicit cast.
import {
  APPLICATION_STATUS as A,
  INTERVIEW_STATUS,
  NOTIFICATION_TYPE as N,
  VACANCY_STATUS as V,
  WITH_CLIENT_STATUSES,
} from "@vera/shared";

import { pool } from "../../db/pool.js";

const num = (value) => (value == null ? null : Number(value));
const COUNTED = [A.FOR_ENDORSEMENT, ...WITH_CLIENT_STATUSES, A.HIRED];

/**
 * Vacancies that have reached endorsement: someone for_endorsement, with the client, or hired, or the vacancy
 * endorsing/filled. "endorsed" counts everyone with the client (endorsed, final interview, for hiring; Phase 2).
 */
export async function listEndorsementVacancies(db = pool) {
  const { rows } = await db.query(
    `select v.job_vacancy_id as "vacancyId", v.job_title as "jobTitle", c.company_name as "companyName", v.status,
            v.slots_needed as "slotsNeeded", v.endorsement_count as "endorsementCount",
            count(*) filter (where a.status = $1::public.application_status)::int as "forEndorsement",
            count(*) filter (where a.status = any($2::public.application_status[]))::int as "endorsed",
            count(*) filter (where a.status = $3::public.application_status)::int as "hired"
       from public.job_vacancy v
       join public.company c on c.company_id = v.company_id
       left join public.application a on a.job_vacancy_id = v.job_vacancy_id
      group by v.job_vacancy_id, c.company_name
     having count(*) filter (where a.status = any($4::public.application_status[])) > 0
         or v.status = any($5::public.vacancy_status[])
      order by v.job_title`,
    [A.FOR_ENDORSEMENT, WITH_CLIENT_STATUSES, A.HIRED, COUNTED, [V.ENDORSING, V.FILLED]],
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

/** Decision 32: the item starts with the batch's final interview (time + details). */
export async function insertEndorsementItem(client, { endorsementId, applicationId, rank, finalScore, finalInterviewAt, finalInterviewDetails }) {
  await client.query(
    `insert into public.endorsement_item
       (endorsement_id, application_id, rank_at_endorsement, final_score, client_interview_at, final_interview_details)
     values ($1::uuid, $2::uuid, $3::smallint, $4::numeric, $5::timestamptz, $6::text)`,
    [endorsementId, applicationId, rank, finalScore, finalInterviewAt, finalInterviewDetails],
  );
}

/** Decision 32: each application's latest "Please confirm" message (what the applicant was told at Notify). */
export async function findConfirmMessages(client, applicationIds) {
  const { rows } = await client.query(
    `select distinct on (n.application_id) n.application_id as "applicationId", n.message
       from public.notification n
      where n.application_id = any($1::uuid[]) and n.notification_type = $2
      order by n.application_id, n.created_at desc`,
    [applicationIds, N.PASSED_CONFIRM_ENDORSEMENT],
  );
  return new Map(rows.map((r) => [r.applicationId, r.message]));
}

/** Endorsements of a vacancy with their items (newest first), for the Outcomes view. */
export async function listEndorsements(vacancyId, db = pool) {
  const { rows } = await db.query(
    `select e.endorsement_id as "endorsementId", e.sent_at as "sentAt",
            i.endorsement_item_id as "itemId", i.application_id as "applicationId",
            i.rank_at_endorsement as "rank", i.final_score as "finalScore", i.outcome,
            i.client_interview_at as "clientInterviewAt", i.final_interview_details as "finalInterviewDetails",
            i.outcome_remarks as "outcomeRemarks",
            i.outcome_recorded_at as "outcomeRecordedAt",
            a.status, a.applicant_type as "applicantType",
            trim(concat_ws(' ', p.first_name, p.last_name)) as "applicantName",
            ro.status as "rematchStatus", ro.job_title as "rematchJobTitle", ro.company_name as "rematchCompanyName"
       from public.endorsement e
       join public.endorsement_item i on i.endorsement_id = e.endorsement_id
       join public.application a on a.application_id = i.application_id
       join public.applicant p on p.applicant_id = a.applicant_id
       -- S17: the latest rematch offer made from this item's pool entry (not_hired), HR only
       left join lateral (
         select pi.status, ov.job_title, oc.company_name
           from public.talent_pool tp
           join public.pool_invitation pi on pi.talent_pool_id = tp.talent_pool_id
           join public.job_vacancy ov on ov.job_vacancy_id = pi.job_vacancy_id
           join public.company oc on oc.company_id = ov.company_id
          where tp.source_application_id = i.application_id
          order by pi.invited_at desc
          limit 1
       ) ro on true
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

/**
 * One endorsement item with what the final interview and the outcome need (read before the transaction to know which
 * rows to lock). The company name is HR-only: it is used to refuse final interview details that name the company.
 */
export async function findItem(itemId, db = pool) {
  const { rows } = await db.query(
    `select i.endorsement_item_id as "itemId", i.application_id as "applicationId", i.outcome,
            a.job_vacancy_id as "vacancyId", a.applicant_id as "applicantId", a.status,
            p.user_account_id as "userId", v.job_title as "jobTitle", c.company_name as "companyName"
       from public.endorsement_item i
       join public.application a on a.application_id = i.application_id
       join public.applicant p on p.applicant_id = a.applicant_id
       join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
       join public.company c on c.company_id = v.company_id
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

/** The client's decision. client_interview_at is the final interview now (setFinalInterview), never written here. */
export async function setItemOutcome(client, { itemId, outcome, hrId, remarks }) {
  await client.query(
    `update public.endorsement_item
        set outcome = $2::public.endorsement_outcome, outcome_recorded_by = $3::uuid, outcome_recorded_at = now(),
            outcome_remarks = $4::text
      where endorsement_item_id = $1::uuid`,
    [itemId, outcome, hrId, remarks ?? null],
  );
}

/** Decision 14: the client's final interview time and HR's instructions (written under the application lock). */
export async function setFinalInterview(client, { itemId, scheduledAt, details }) {
  await client.query(
    `update public.endorsement_item
        set client_interview_at = $2::timestamptz, final_interview_details = $3::text
      where endorsement_item_id = $1::uuid`,
    [itemId, scheduledAt, details ?? null],
  );
}

/**
 * Decision 21: what the endorsement packet needs (HR only, read-only). The interview score is the endorsed
 * application's OWN evaluation (Oct 19: no section scores on the cover); the ratings source and its interview date
 * come from the original interview;
 * the resume is the application's own resume_id (the file that was matched and verified).
 */
export async function findPacketData(itemId, db = pool) {
  const { rows } = await db.query(
    `select i.endorsement_item_id as "itemId", a.application_id as "applicationId",
            p.first_name as "firstName", p.middle_name as "middleName", p.last_name as "lastName", p.suffix,
            v.job_vacancy_id as "vacancyId", v.job_title as "jobTitle",
            fe.interview_score as "interviewScore",
            fe.ratings_source_application_id as "sourceApplicationId",
            coalesce(
              (select s.scheduled_at from public.interview_schedule s
                where s.application_id = fe.ratings_source_application_id and s.status = $2::public.interview_status
                order by s.attempt_number desc limit 1),
              sfe.computed_at
            ) as "interviewDate",
            r.file_path as "resumePath"
       from public.endorsement_item i
       join public.application a on a.application_id = i.application_id
       join public.applicant p on p.applicant_id = a.applicant_id
       join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
       left join public.final_evaluation fe on fe.application_id = a.application_id
       left join public.final_evaluation sfe on sfe.application_id = fe.ratings_source_application_id
       left join public.resume r on r.resume_id = a.resume_id
      where i.endorsement_item_id = $1::uuid`,
    [itemId, INTERVIEW_STATUS.COMPLETED],
  );
  return rows[0] ?? null;
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
