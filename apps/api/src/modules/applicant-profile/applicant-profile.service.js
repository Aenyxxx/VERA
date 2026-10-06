import { randomUUID } from "node:crypto";

import { withTransaction } from "../../db/tx.js";
import { businessRule, conflict } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { moveFile } from "../../lib/storage.js";
import { hasApplicantProfile } from "../me/me.repository.js";
import { deleteDraft, findDraft } from "../resumes/resumes.repository.js";

import { insertApplicant, insertExtraction, insertResume } from "./applicant-profile.repository.js";

const BUCKET = "resumes";
const ALREADY_SET_UP = "Your profile is already set up.";

/**
 * Confirm profile (FR-PROF-04): applicant + resume + resume_extraction are saved together, the draft is removed.
 * The file is moved out of drafts/ before the transaction (storage is not transactional) and moved back on failure.
 */
export async function confirmProfile({ userId, profile }) {
  if (await hasApplicantProfile(userId)) throw conflict(ALREADY_SET_UP);
  const draft = await findDraft(userId);
  if (!draft) throw businessRule("Upload your resume first.");

  const applicantId = randomUUID();
  const filePath = `${applicantId}/${draft.filePath.split("/").pop()}`;
  await moveFile(BUCKET, draft.filePath, filePath);

  try {
    await withTransaction(userId, async (client) => {
      await insertApplicant(client, applicantId, userId, profile);
      const resumeId = await insertResume(client, {
        applicantId,
        filePath,
        originalFilename: draft.originalFilename,
        fileSizeBytes: draft.fileSizeBytes,
      });
      await insertExtraction(client, resumeId, draft.extraction);
      await deleteDraft(userId, client);
    });
  } catch (error) {
    await moveFile(BUCKET, filePath, draft.filePath).catch(() => logger.error("resume file not moved back to drafts"));
    if (error.code === "23505") throw conflict(ALREADY_SET_UP); // a second confirm won the race
    throw error;
  }

  return { applicantId };
}
