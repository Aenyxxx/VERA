import { ACCOUNT_STATUS, ROLES } from "@vera/shared";

import { findApplicantName, hasApplicantProfile } from "./me.repository.js";

// GET /api/me — what the web needs for the role redirect (FR-AUTH-01, APP_FLOW §2.2) and the header name.
export async function getMe(req, res) {
  const { userId, email, role, fullName } = req.auth;
  const hasProfile = await hasApplicantProfile(userId);
  const applicantName = role === ROLES.APPLICANT && hasProfile ? await findApplicantName(userId) : null;

  res.json({
    data: { userId, email, role, fullName: applicantName ?? fullName, accountStatus: ACCOUNT_STATUS.ACTIVE, hasProfile },
  });
}
