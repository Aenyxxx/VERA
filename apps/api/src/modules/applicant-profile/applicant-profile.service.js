import { randomUUID } from "node:crypto";

import { pool } from "../../db/pool.js";
import { withTransaction } from "../../db/tx.js";
import { businessRule, conflict, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { moveFile } from "../../lib/storage.js";
import { hasApplicantProfile } from "../me/me.repository.js";
import { deleteDraft, findDraft } from "../resumes/resumes.repository.js";

import {
  findProfile,
  insertApplicant,
  insertExtraction,
  insertResume,
  updateProfile,
} from "./applicant-profile.repository.js";

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

export async function getProfile(userId) {
  const profile = await findProfile(pool, userId);
  if (!profile) throw notFound("Your profile is not set up yet.");
  return profile;
}

/** Edit the confirmed profile (FR-PROF-05). Email is never changed here. */
export async function editProfile({ userId, profile }) {
  const updated = await updateProfile(pool, userId, profile);
  if (!updated) throw notFound("Your profile is not set up yet.");
  return findProfile(pool, userId);
}
