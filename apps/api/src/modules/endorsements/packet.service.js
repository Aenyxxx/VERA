// GET /api/admin/applications/:id/packet (decision 21; decision 33: by application, from the Ranking tab): staff only
// (admin router), read-only, built on request, never stored. Logs (if any) carry ids only: no names, no resume text.
import { PACKET_STATUSES } from "@vera/shared";

import { conflict, notFound } from "../../lib/errors.js";
import { downloadFile } from "../../lib/storage.js";
import { listRubric } from "../competencies/competencies.repository.js";
import { listRatings } from "../evaluations/evaluations.repository.js";

import { findPacketData } from "./endorsements.repository.js";
import { buildPacket, packetContent, packetFileName } from "./packet.js";

const RESUME_BUCKET = "resumes";

/**
 * Only an evaluated application that passed (final ≥ passing, stored `final_evaluation.passed`) and is passed or later
 * (PACKET_STATUSES) gets a packet.
 * @returns {Promise<{ fileName: string, bytes: Uint8Array }>}
 */
export async function getEndorsementPacket(applicationId) {
  const row = await findPacketData(applicationId);
  if (!row) throw notFound("Application not found.");
  if (!row.sourceApplicationId) throw conflict("This applicant has no evaluation for a packet.");
  if (row.passed !== true || !PACKET_STATUSES.includes(row.status)) {
    throw conflict("Only an applicant who passed the assessment can get an endorsement packet.");
  }
  if (!row.resumePath) throw conflict("This application has no resume file.");

  const [rubric, ratings] = await Promise.all([
    listRubric(),
    listRatings(row.sourceApplicationId), // the original interview's 15 ratings (WSM-03 source)
  ]);
  const content = packetContent(row, rubric, ratings);
  const resume = await downloadFile(RESUME_BUCKET, row.resumePath); // application.resume_id: the verified file
  return { fileName: packetFileName(row), bytes: await buildPacket(content, resume) };
}
