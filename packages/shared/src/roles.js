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

/** FR-AUTH-02: at least 8 characters, at least 1 letter and 1 number (seed:admin, User Management). */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const PASSWORD_HINT = "At least 8 characters with a letter and a number";
