// HR-facing labels for the rematch offer and the applicant pool (S17). Applicants never see these.

/** pool_invitation.status → label and tone (tones from components/shared/tones). */
export const OFFER_STATUS_LOOK = {
  pending: { label: "Waiting for the applicant", tone: "warning" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
  expired: { label: "Expired (no longer available)", tone: "neutral" },
};

export const POOL_REASON_LABELS = {
  did_not_pass: "Did not pass",
  standby: "Standby",
  not_hired: "Not hired",
  training_failed: "Training failed",
  not_selected: "Not selected",
};

export const POOL_AVAILABILITY_LABELS = {
  available: "Available",
  invited: "Offer pending",
  reapplied: "Back in the process",
  unavailable: "Unavailable",
};

/**
 * Toast text for a rematch result (the not-hired response's `rematch`, or Run rematch again).
 * @param {{ status: "offered"|"no_match"|"failed", jobTitle?: string, companyName?: string }} rematch
 */
export function rematchMessage(rematch) {
  if (rematch.status === "offered") return `VERA offered them ${rematch.jobTitle} at ${rematch.companyName}.`;
  if (rematch.status === "no_match") return "No matching open job right now; they stay in the applicant pool.";
  return "The rematch did not run. Use Run rematch again.";
}
