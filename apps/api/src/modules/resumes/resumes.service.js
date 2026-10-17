import { randomUUID } from "node:crypto";

import { withTransaction } from "../../db/tx.js";
import { businessRule, conflict, notFound } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { moveFile, removeFiles, signedUrl, uploadFile } from "../../lib/storage.js";
import { extractResume } from "../../lib/svcClient.js";
import { insertExtraction, insertResume } from "../applicant-profile/applicant-profile.repository.js";
import { lockApplicant } from "../applications/applications.repository.js";
import { findApplicantId } from "../documents/documents.repository.js";
import { hasApplicantProfile } from "../me/me.repository.js";

import {
  archiveCurrentResume,
  deleteDraft,
  findCurrentResume,
  findDraft,
  hasPendingOffer,
  upsertDraft,
} from "./resumes.repository.js";

const BUCKET = "resumes";
const PENDING_OFFER = "Answer your pending job offer or invitation first.";

/**
 * Upload & parse (FR-PROF-01..03): svc /extract first, then store the PDF and the extraction as a draft.
 * Nothing is saved when the svc rejects the file. The profile is created only on confirm (FR-PROF-04).
 * Decision 16: with a confirmed profile the draft is a replacement resume (see replaceResume); the profile is not
 * auto-filled again, so only the file name, warnings and years are returned.
 */
export async function parseResume({ userId, email, file }) {
  const replacing = await hasApplicantProfile(userId);

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

  const result = {
    warnings: extraction.warnings ?? [],
    fileName: file.originalname,
    yearsExperience: extraction.yearsExperience ?? 0,
  };
  if (replacing) return result;
  // The account email is the login and cannot be changed here (FR-PROF-05); the resume's email is ignored.
  return { profile: { ...extraction.profile, email }, ...result };
}

/**
 * POST /api/applicant/resume/replace (decision 16, PRD FR-PROF-06/07, BR-13): the parsed draft becomes the current
 * resume. The old one is archived (file kept); applications already sent keep their own resume_id and matching. The
 * new resume starts unverified; the profile does not change. Refused while a job offer or invitation is pending.
 * The file is moved out of drafts/ before the transaction (storage is not transactional) and moved back on failure.
 */
export async function replaceResume(userId) {
  const applicantId = await findApplicantId(userId);
  if (!applicantId) throw conflict("Confirm your profile before replacing your resume.");
  const draft = await findDraft(userId);
  if (!draft) throw businessRule("Upload your new resume first.");
  if (await hasPendingOffer(applicantId)) throw conflict(PENDING_OFFER);

  const filePath = `${applicantId}/${draft.filePath.split("/").pop()}`;
  await moveFile(BUCKET, draft.filePath, filePath);

  try {
    await withTransaction(userId, async (client) => {
      await lockApplicant(client, applicantId); // serializes with apply and a second replace
      if (await hasPendingOffer(applicantId, client)) throw conflict(PENDING_OFFER);
      await archiveCurrentResume(client, applicantId);
      const resumeId = await insertResume(client, {
        applicantId,
        filePath,
        originalFilename: draft.originalFilename,
        fileSizeBytes: draft.fileSizeBytes,
      });
      await insertExtraction(client, resumeId, draft.extraction); // matching reads it; the PDF is never re-sent
      await deleteDraft(userId, client);
    });
  } catch (error) {
    await moveFile(BUCKET, filePath, draft.filePath).catch(() => logger.error("resume file not moved back to drafts"));
    throw error;
  }

  return getCurrentResume(userId);
}

/** My Documents → Resume tab. The storage path stays on the server. */
export async function getCurrentResume(userId) {
  const resume = await findCurrentResume(userId);
  if (!resume) throw notFound("You have no resume yet.");
  const { filePath: _path, ...view } = resume;
  return view;
}

/** Signed link (10 min) to the applicant's own current resume. */
export async function getCurrentResumeUrl(userId) {
  const resume = await findCurrentResume(userId);
  if (!resume) throw notFound("You have no resume yet.");
  return { url: await signedUrl(BUCKET, resume.filePath) };
}
