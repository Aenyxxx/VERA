// SQL for the confirmed profile. All functions receive the transaction client.

export async function insertApplicant(client, applicantId, userId, p) {
  await client.query(
    `insert into public.applicant
       (applicant_id, user_account_id, first_name, middle_name, last_name, suffix, contact_number,
        birthdate, gender, height_cm, address_line, city, province, education_level)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      applicantId, userId, p.firstName, p.middleName, p.lastName, p.suffix, p.contactNumber,
      p.birthdate, p.gender, p.heightCm ?? null, p.addressLine, p.city, p.province, p.educationLevel,
    ],
  );
}

/** The applicant's first (current) resume; verification starts as pending. Returns resume_id. */
export async function insertResume(client, { applicantId, filePath, originalFilename, fileSizeBytes }) {
  const { rows } = await client.query(
    `insert into public.resume (applicant_id, file_path, original_filename, file_size_bytes)
     values ($1, $2, $3, $4)
     returning resume_id as "resumeId"`,
    [applicantId, filePath, originalFilename, fileSizeBytes],
  );
  return rows[0].resumeId;
}

/** Stored svc /extract output; matching later reads it from here and never re-sends the PDF. */
export async function insertExtraction(client, resumeId, x) {
  await client.query(
    `insert into public.resume_extraction
       (resume_id, raw_text, standardized_text, sections, skills_text, experience_text,
        years_experience, extracted_profile, warnings, extractor_version)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      resumeId, x.rawText ?? null, x.standardizedText ?? "", x.sections ?? {}, x.skillsText ?? null,
      x.experienceText ?? null, x.yearsExperience ?? 0, x.profile ?? {}, JSON.stringify(x.warnings ?? []),
      x.extractorVersion ?? null,
    ],
  );
}

// camelCase view of the profile card; birthdate as YYYY-MM-DD text so no time zone shifts it.
const PROFILE_COLUMNS = `
  a.applicant_id as "applicantId", a.first_name as "firstName", a.middle_name as "middleName",
  a.last_name as "lastName", a.suffix, a.contact_number as "contactNumber",
  to_char(a.birthdate, 'YYYY-MM-DD') as "birthdate", a.gender, a.height_cm::float as "heightCm",
  a.address_line as "addressLine", a.city, a.province, a.education_level as "educationLevel",
  u.email`;

/** The applicant's profile + account email, or null when the profile is not confirmed yet. */
export async function findProfile(db, userId) {
  const { rows } = await db.query(
    `select ${PROFILE_COLUMNS}
       from public.applicant a
       join public.user_account u on u.user_account_id = a.user_account_id
      where a.user_account_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

/** FR-PROF-05: every card field except email (the login, kept on user_account). Returns false if no profile. */
export async function updateProfile(db, userId, p) {
  const { rowCount } = await db.query(
    `update public.applicant
        set first_name = $2, middle_name = $3, last_name = $4, suffix = $5, contact_number = $6,
            birthdate = $7, gender = $8, height_cm = $9, address_line = $10, city = $11, province = $12,
            education_level = $13
      where user_account_id = $1`,
    [
      userId, p.firstName, p.middleName, p.lastName, p.suffix, p.contactNumber,
      p.birthdate, p.gender, p.heightCm ?? null, p.addressLine, p.city, p.province, p.educationLevel,
    ],
  );
  return rowCount > 0;
}
