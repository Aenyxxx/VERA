import { ROLES, STAFF_ROLES } from "@vera/shared";

/**
 * Where a signed-in user belongs (FR-AUTH-01, APP_FLOW §2.2).
 * @param {{ role: string, hasProfile: boolean }} me response of GET /api/me
 */
export function homePathFor(me) {
  if (STAFF_ROLES.includes(me.role)) return "/admin";
  if (me.role === ROLES.APPLICANT) return me.hasProfile ? "/applicant" : "/applicant/setup";
  return "/login";
}

/** "Juan Dela Cruz" → "JD"; "hr@vera.test" → "H". */
export function initialsOf(nameOrEmail = "") {
  const name = nameOrEmail.split("@")[0].trim();
  const parts = name.split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}
