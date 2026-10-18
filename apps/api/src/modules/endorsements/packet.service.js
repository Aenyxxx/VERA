// GET /api/admin/endorsement-items/:id/packet (decision 21): staff only (admin router), read-only, built on request,
// never stored. Logs (if any) carry ids only: no names, no resume text.
import { conflict, notFound } from "../../lib/errors.js";
import { downloadFile } from "../../lib/storage.js";
import { listRubric } from "../competencies/competencies.repository.js";
import { listRatings } from "../evaluations/evaluations.repository.js";

import { findPacketData } from "./endorsements.repository.js";
import { buildPacket, packetContent, packetFileName } from "./packet.js";

const RESUME_BUCKET = "resumes";

/** @returns {Promise<{ fileName: string, bytes: Uint8Array }>} */
export async function getEndorsementPacket(itemId) {
  const row = await findPacketData(itemId);
  if (!row) throw notFound("Endorsement item not found.");
  if (!row.sourceApplicationId) throw conflict("This applicant has no evaluation for a packet.");
  if (!row.resumePath) throw conflict("This application has no resume file.");

  const [rubric, ratings] = await Promise.all([
    listRubric(),
    listRatings(row.sourceApplicationId), // the original interview's 15 ratings (WSM-03 source)
  ]);
  const content = packetContent(row, rubric, ratings);
  const resume = await downloadFile(RESUME_BUCKET, row.resumePath); // application.resume_id: the verified file
  return { fileName: packetFileName(row), bytes: await buildPacket(content, resume) };
}
