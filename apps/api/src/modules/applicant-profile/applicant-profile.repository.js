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
