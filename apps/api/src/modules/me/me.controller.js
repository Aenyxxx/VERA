import { ACCOUNT_STATUS } from "@vera/shared";

import { hasApplicantProfile } from "./me.repository.js";

// GET /api/me — what the web needs for the role redirect (FR-AUTH-01, APP_FLOW §2.2).
export async function getMe(req, res) {
  const { userId, email, role, fullName } = req.auth;
  const hasProfile = await hasApplicantProfile(userId);

  res.json({
    data: { userId, email, role, fullName, accountStatus: ACCOUNT_STATUS.ACTIVE, hasProfile },
  });
}
