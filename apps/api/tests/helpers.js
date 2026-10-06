// Shared test helpers: a signed-in user for supertest requests, with db and Supabase mocked by the test file.
export const USER_ID = "11111111-1111-1111-1111-111111111111";

export function account(overrides = {}) {
  return {
    userId: USER_ID,
    email: "applicant@vera.test",
    role: "applicant",
    fullName: null,
    accountStatus: "active",
    ...overrides,
  };
}

/** Route pool.query by SQL text: user_account → account, applicant exists → hasProfile, draft → draft. */
export function fakeQueries({ account: acc = account(), hasProfile = false, draft = null, extra } = {}) {
  return async (sql, params) => {
    if (sql.includes("from public.user_account")) return { rows: acc ? [acc] : [] };
    if (sql.includes("from public.applicant")) return { rows: [{ hasProfile }] };
    if (sql.includes("from public.resume_draft")) return { rows: draft ? [draft] : [] };
    if (extra) return extra(sql, params);
    return { rows: [] };
  };
}
