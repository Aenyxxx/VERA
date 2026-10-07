// Document verification rules for Resume Screening (PRD FR-SCR-02..06, decided Oct 7, 2026).
// Verification is stored per applicant document (resume, supporting_document), never per application or vacancy:
// a document verified once stays verified for every later application (rating reuse, rematch), until the
// applicant re-uploads it (FR-DOC-04 resets it to pending).
import { REQUEST_STATUS, VERIFICATION_STATUS } from "@vera/shared";

/**
 * FR-SCR-06: an application is fully verified when the applicant's current resume and every current supporting
 * document are verified and no document request is pending. There is no per-vacancy list of required types:
 * anything missing is asked for with a document request, which keeps the application unverified until the
 * uploaded document is verified.
 * @param {{ resume: { verificationStatus: string } | null,
 *           documents: { verificationStatus: string }[],
 *           requests: { status: string }[] }} input
 */
export function isFullyVerified({ resume, documents, requests }) {
  return (
    resume?.verificationStatus === VERIFICATION_STATUS.VERIFIED &&
    documents.every((d) => d.verificationStatus === VERIFICATION_STATUS.VERIFIED) &&
    !requests.some((r) => r.status === REQUEST_STATUS.PENDING)
  );
}

/** Response deadline for the applicant (BR-08): now + system_setting response_deadline_days (default 3). */
export async function responseDueAt(db, now = new Date()) {
  const { rows } = await db.query(
    "select setting_value as \"days\" from public.system_setting where setting_key = 'response_deadline_days'",
  );
  const days = Number(rows[0]?.days ?? 3);
  return new Date(now.getTime() + (Number.isFinite(days) && days > 0 ? days : 3) * 24 * 60 * 60 * 1000);
}
