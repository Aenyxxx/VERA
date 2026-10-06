// Account roles and statuses (SQL enums user_role, account_status).

export const ROLES = Object.freeze({
  ADMIN: "admin",
  HR: "hr",
  APPLICANT: "applicant",
});

/** Roles that use the admin side of VERA. */
export const STAFF_ROLES = Object.freeze([ROLES.ADMIN, ROLES.HR]);

export const ACCOUNT_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
});
