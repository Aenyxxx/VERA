// Applicant (talent) pool entries (PRD FR-END-02; DATABASE_SCHEMA §3.5). At most one active entry per applicant
// (unique index talent_pool_one_active_entry): a new entry replaces the active one.
// Call only inside withTransaction while the APPLICANT row is locked (DATABASE_SCHEMA §8), so two writers can
// never both close and insert.

/**
 * Closes the applicant's active pool entry (if any) and adds a new one for this application.
 * @param {import("pg").PoolClient} client
 * @param {{ applicantId: string, applicationId: string, reason: string }} input reason = POOL_REASON value
 */
export async function addToPool(client, { applicantId, applicationId, reason }) {
  await client.query(
    `update public.talent_pool set removed_at = now()
      where applicant_id = $1::uuid and removed_at is null`,
    [applicantId],
  );
  await client.query(
    `insert into public.talent_pool (applicant_id, source_application_id, pool_reason)
     values ($1::uuid, $2::uuid, $3::public.pool_reason)`,
    [applicantId, applicationId, reason],
  );
}
