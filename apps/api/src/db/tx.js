import { pool } from "./pool.js";

/**
 * Runs fn(client) in one transaction. Sets vera.actor_id (transaction-local) so the
 * status-history trigger records who made the change; null actor = system job.
 * Call the svc BEFORE this, never inside it.
 * @template T
 * @param {string|null} actorId user_account_id of the person acting
 * @param {(client: import("pg").PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTransaction(actorId, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (actorId) {
      await client.query("select set_config('vera.actor_id', $1, true)", [actorId]);
    }
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
