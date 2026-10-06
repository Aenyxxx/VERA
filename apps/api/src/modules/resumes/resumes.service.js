import { randomUUID } from "node:crypto";

import { conflict } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { removeFiles, uploadFile } from "../../lib/storage.js";
import { extractResume } from "../../lib/svcClient.js";
import { hasApplicantProfile } from "../me/me.repository.js";

import { findDraft, upsertDraft } from "./resumes.repository.js";

const BUCKET = "resumes";

/**
 * Upload & parse (FR-PROF-01..03): svc /extract first, then store the PDF and the extraction as a draft.
 * Nothing is saved when the svc rejects the file. The profile is created only on confirm (FR-PROF-04).
 */
export async function parseResume({ userId, email, file }) {
  if (await hasApplicantProfile(userId)) {
    throw conflict("Your profile is already set up. Resume replacement is not available yet.");
  }

  const extraction = await extractResume(file.buffer, file.originalname);

  const filePath = `drafts/${userId}/${randomUUID()}.pdf`; // never trust the client's file name for paths
  await uploadFile(BUCKET, filePath, file.buffer);

  const previous = await findDraft(userId);
  try {
    await upsertDraft({
      userId,
      filePath,
      originalFilename: file.originalname.slice(0, 255),
      fileSizeBytes: file.size,
      extraction,
    });
  } catch (error) {
    await removeFiles(BUCKET, [filePath]).catch(() => {});
    throw error;
  }
  if (previous) {
    await removeFiles(BUCKET, [previous.filePath]).catch(() => logger.warn("old resume draft file not removed"));
  }

  return {
    // The account email is the login and cannot be changed here (FR-PROF-05); the resume's email is ignored.
    profile: { ...extraction.profile, email },
    warnings: extraction.warnings ?? [],
    fileName: file.originalname,
    yearsExperience: extraction.yearsExperience ?? 0,
  };
}
