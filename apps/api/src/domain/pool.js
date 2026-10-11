// Applicant (talent) pool entries (PRD FR-END-02; DATABASE_SCHEMA §3.5). At most one active entry per applicant
// (unique index talent_pool_one_active_entry): a new entry replaces the active one.
// Call only inside withTransaction while the APPLICANT row is locked (DATABASE_SCHEMA §8), so two writers can
// never both close and insert.

/**
 * SQL condition: the pool entry aliased `alias` is in the applicant pool view (S17, FR-POOL-01) — it is active
 * and its applicant has no ongoing or hired application. An active entry can stay behind when the applicant applied
 * elsewhere, so `removed_at is null` alone is not enough. ONE definition, used by GET /api/admin/pool, the
 * dashboard's Applicant pool tile, and the Applicant Management filter (S18).
 * @param {string} alias talent_pool alias, e.g. "tp"
 * @param {string} blockingParam placeholder holding BLOCKS_APPLYING_STATUSES, e.g. "$1"
 */
export function freePoolEntry(alias, blockingParam) {
  return `${alias}.removed_at is null
        and not exists (select 1 from public.application b
                         where b.applicant_id = ${alias}.applicant_id and b.status = any(${blockingParam}::public.application_status[]))`;
}

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
