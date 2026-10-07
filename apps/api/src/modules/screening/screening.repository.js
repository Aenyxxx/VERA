// SQL for Resume Screening (HR side). HR may see company names and scores; nothing here is used by applicant routes.
// Functions that write take the transaction client first.
import { MULTI_DOCUMENT_TYPES, REQUEST_STATUS, VERIFICATION_STATUS } from "@vera/shared";

import { pool } from "../../db/pool.js";

/**
 * "New upload to verify": a current supporting document that is pending AND either replaced an earlier copy of the
 * same document (re-upload, FR-DOC-04; for certificate/other the same label) or fulfilled a document request.
 * Explains why an application that was fully verified no longer is. `d` = supporting_document alias.
 */
const NEW_UPLOAD = `(
  d.verification_status = '${VERIFICATION_STATUS.PENDING}'
  and (
    exists (select 1 from public.supporting_document o
             where o.applicant_id = d.applicant_id and o.document_type = d.document_type
               and not o.is_current and o.replaced_at is not null
               and (d.document_type <> all(array[${MULTI_DOCUMENT_TYPES.map((t) => `'${t}'`).join(", ")}]::public.document_type[])
                    or o.label is not distinct from d.label))
    or exists (select 1 from public.document_request r where r.fulfilled_document_id = d.supporting_document_id)
  ))`;

/** Vacancies HR screens (open, closed at the cap, endorsing) with shortlist counts per group. */
export async function listScreeningVacancies({ statuses, shortlisted, waiting, rejected }, db = pool) {
  const { rows } = await db.query(
    `select v.job_vacancy_id as "vacancyId", v.job_title as "jobTitle", c.company_name as "companyName",
            v.status, v.slots_needed as "slotsNeeded", v.shortlist_per_group as "quota",
            count(a.*) filter (where a.status = $2 and a.applicant_type = 'first_time')::int as "firstTimeShortlisted",
            count(a.*) filter (where a.status = $2 and a.applicant_type = 'experienced')::int as "experiencedShortlisted",
            count(a.*) filter (where a.status = $3)::int as "waiting",
            count(a.*) filter (where a.status = any($4::public.application_status[]))::int as "notShortlisted"
       from public.job_vacancy v
       join public.company c on c.company_id = v.company_id
       left join public.application a on a.job_vacancy_id = v.job_vacancy_id
      where v.status = any($1::public.vacancy_status[])
      group by v.job_vacancy_id, c.company_name
      order by v.posted_at desc nulls last, v.job_title`,
    [statuses, shortlisted, waiting, rejected],
  );
  return rows;
}

export async function findScreeningVacancy(vacancyId, db = pool) {
  const { rows } = await db.query(
    `select v.job_vacancy_id as "vacancyId", v.job_title as "jobTitle", c.company_name as "companyName",
            v.status, v.slots_needed as "slotsNeeded", v.shortlist_per_group as "quota",
            v.matching_threshold::float as "matchingThreshold"
       from public.job_vacancy v
       join public.company c on c.company_id = v.company_id
      where v.job_vacancy_id = $1`,
    [vacancyId],
  );
  return rows[0] ?? null;
}

/**
 * Applications of one vacancy in the given statuses, with the document summary of each applicant
 * (verification is per applicant document) and whether earlier ratings are on file (BR-21).
 */
export async function listScreeningApplications(vacancyId, statuses, db = pool) {
  const { rows } = await db.query(
    `select a.application_id as "applicationId", a.applicant_type as "applicantType", a.status,
            a.status_reason as "statusReason", a.applied_at as "appliedAt",
            a.verification_started_at as "verificationStartedAt",
            trim(concat_ws(' ', p.first_name, p.last_name)) as "applicantName",
            m.matching_score::float as "matchingScore",
            (select r.verification_status from public.resume r
              where r.applicant_id = a.applicant_id and r.is_current) as "resumeStatus",
            (select coalesce(array_agg(d.verification_status::text), '{}') from public.supporting_document d
              where d.applicant_id = a.applicant_id and d.is_current) as "documentStatuses",
            (select count(*)::int from public.supporting_document d
              where d.applicant_id = a.applicant_id and d.is_current and ${NEW_UPLOAD}) as "newUploads",
            (select count(*)::int from public.document_request q
              where q.application_id = a.application_id and q.status = '${REQUEST_STATUS.PENDING}') as "pendingRequests",
            exists (select 1 from public.final_evaluation fe
                     join public.application x on x.application_id = fe.application_id
                    where x.applicant_id = a.applicant_id and x.application_id <> a.application_id) as "ratingsOnFile"
       from public.application a
       join public.applicant p on p.applicant_id = a.applicant_id
       left join public.matching_result m on m.application_id = a.application_id
      where a.job_vacancy_id = $1 and a.status = any($2::public.application_status[])`,
    [vacancyId, statuses],
  );
  return rows;
}

/** One application with everything the review sheet needs (HR only: includes the company). */
export async function findApplicationForHr(applicationId, db = pool) {
  const { rows } = await db.query(
    `select a.application_id as "applicationId", a.applicant_id as "applicantId", a.job_vacancy_id as "vacancyId",
            a.applicant_type as "applicantType", a.status, a.status_reason as "statusReason",
            a.applied_at as "appliedAt", a.verification_started_at as "verificationStartedAt",
            a.application_source as "applicationSource",
            v.job_title as "jobTitle", c.company_name as "companyName",
            p.user_account_id as "userId", p.first_name as "firstName", p.middle_name as "middleName",
            p.last_name as "lastName", p.suffix, p.email, p.contact_number as "contactNumber", p.age, p.gender,
            p.education_level as "educationLevel", p.height_cm::float as "heightCm",
            p.address_line as "addressLine", p.city, p.province,
            m.matching_score::float as "matchingScore", m.skills_score::float as "skillsScore",
            m.experience_score::float as "experienceScore", m.years_experience::float as "yearsExperience",
            m.matched_skills as "matchedSkills", m.missing_skills as "missingSkills",
            m.skill_matches as "skillMatches", m.experience_matches as "experienceMatches",
            m.weights, m.model_name as "modelName"
       from public.application a
       join public.job_vacancy v on v.job_vacancy_id = a.job_vacancy_id
       join public.company c on c.company_id = v.company_id
       join public.v_applicant_profile p on p.applicant_id = a.applicant_id
       left join public.matching_result m on m.application_id = a.application_id
      where a.application_id = $1`,
    [applicationId],
  );
  return rows[0] ?? null;
}

export async function findCurrentResume(applicantId, db = pool) {
  const { rows } = await db.query(
    `select resume_id as "resumeId", original_filename as "fileName", file_size_bytes as "fileSizeBytes",
            uploaded_at as "uploadedAt", verification_status as "verificationStatus",
            verification_remarks as "verificationRemarks", verified_at as "verifiedAt", file_path as "filePath"
       from public.resume
      where applicant_id = $1 and is_current`,
    [applicantId],
  );
  return rows[0] ?? null;
}

/** Current supporting documents of the applicant with the "New upload to verify" marker. */
export async function listCurrentDocumentsForHr(applicantId, db = pool) {
  const { rows } = await db.query(
    `select d.supporting_document_id as "documentId", d.document_type as "documentType", d.label,
            d.original_filename as "fileName", d.file_size_bytes as "fileSizeBytes", d.uploaded_at as "uploadedAt",
            d.verification_status as "verificationStatus", d.verification_remarks as "verificationRemarks",
            d.verified_at as "verifiedAt", ${NEW_UPLOAD} as "newUpload"
       from public.supporting_document d
      where d.applicant_id = $1 and d.is_current
      order by d.uploaded_at desc`,
    [applicantId],
  );
  return rows;
}

export async function findCurrentDocumentForHr(applicantId, documentId, db = pool) {
  const { rows } = await db.query(
    `select supporting_document_id as "documentId", document_type as "documentType", file_path as "filePath"
       from public.supporting_document
      where applicant_id = $1 and supporting_document_id = $2 and is_current`,
    [applicantId, documentId],
  );
  return rows[0] ?? null;
}

export async function listApplicationRequests(applicationId, db = pool) {
  const { rows } = await db.query(
    `select document_request_id as "requestId", document_type as "documentType",
            target_document_id as "targetDocumentId", reason, status, due_at as "dueAt",
            created_at as "requestedAt", fulfilled_at as "fulfilledAt"
       from public.document_request
      where application_id = $1
      order by created_at desc`,
    [applicationId],
  );
  return rows;
}

/** Row lock on the application (after the vacancy lock: job_vacancy → applicant → application). */
export async function lockApplication(client, applicationId) {
  const { rows } = await client.query(
    `select application_id as "applicationId", applicant_id as "applicantId", job_vacancy_id as "vacancyId",
            applicant_type as "applicantType", status, verification_started_at as "verificationStartedAt"
       from public.application where application_id = $1 for update`,
    [applicationId],
  );
  return rows[0] ?? null;
}

/** FR-SCR-03: the first HR verification action locks the slot (RANK-02 never displaces it afterwards). */
export async function startVerification(client, applicationId) {
  await client.query(
    `update public.application set verification_started_at = now()
      where application_id = $1 and verification_started_at is null`,
    [applicationId],
  );
}

export async function setResumeVerification(client, { resumeId, applicantId, status, remarks, hrId }) {
  const { rowCount } = await client.query(
    `update public.resume
        set verification_status = $3, verification_remarks = $4, verified_by = $5, verified_at = now()
      where resume_id = $1 and applicant_id = $2 and is_current`,
    [resumeId, applicantId, status, remarks, hrId],
  );
  return rowCount === 1;
}

export async function setDocumentVerification(client, { documentId, applicantId, status, remarks, hrId }) {
  const { rowCount } = await client.query(
    `update public.supporting_document
        set verification_status = $3, verification_remarks = $4, verified_by = $5, verified_at = now()
      where supporting_document_id = $1 and applicant_id = $2 and is_current`,
    [documentId, applicantId, status, remarks, hrId],
  );
  return rowCount === 1;
}

/** Applicant id of a current resume / document, so the route can find the application context. */
export async function findResumeOwner(resumeId, db = pool) {
  const { rows } = await db.query("select applicant_id as \"applicantId\" from public.resume where resume_id = $1 and is_current", [resumeId]);
  return rows[0]?.applicantId ?? null;
}

export async function findDocumentOwner(documentId, db = pool) {
  const { rows } = await db.query(
    "select applicant_id as \"applicantId\" from public.supporting_document where supporting_document_id = $1 and is_current",
    [documentId],
  );
  return rows[0]?.applicantId ?? null;
}

export async function insertDocumentRequest(client, { applicantId, applicationId, documentType, targetDocumentId, reason, hrId, dueAt }) {
  const { rows } = await client.query(
    `insert into public.document_request
       (applicant_id, application_id, document_type, target_document_id, reason, requested_by, due_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning document_request_id as "requestId", due_at as "dueAt"`,
    [applicantId, applicationId, documentType, targetDocumentId, reason, hrId, dueAt],
  );
  return rows[0];
}

/** The copy HR asked to replace shows "Reupload required" until the new copy arrives. */
export async function markReuploadRequested(client, { documentId, applicantId, remarks, hrId }) {
  await client.query(
    `update public.supporting_document
        set verification_status = '${VERIFICATION_STATUS.REUPLOAD_REQUESTED}', verification_remarks = $3,
            verified_by = $4, verified_at = now()
      where supporting_document_id = $1 and applicant_id = $2 and is_current`,
    [documentId, applicantId, remarks, hrId],
  );
}

export async function cancelRequest(client, requestId) {
  const { rows } = await client.query(
    `update public.document_request set status = '${REQUEST_STATUS.CANCELLED}'
      where document_request_id = $1 and status = '${REQUEST_STATUS.PENDING}'
      returning application_id as "applicationId"`,
    [requestId],
  );
  return rows[0] ?? null;
}

export async function cancelPendingRequests(client, applicationId) {
  await client.query(
    `update public.document_request set status = '${REQUEST_STATUS.CANCELLED}'
      where application_id = $1 and status = '${REQUEST_STATUS.PENDING}'`,
    [applicationId],
  );
}

