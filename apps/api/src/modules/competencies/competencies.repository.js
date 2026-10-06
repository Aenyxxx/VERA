import { pool } from "../../db/pool.js";

/** The fixed competency list (seeded; maintained by the admin later). Active ones, in display order. */
export async function listActiveCompetencies(db = pool) {
  const { rows } = await db.query(
    `select competency_id as "competencyId", competency_name as "competencyName", description
       from public.competency
      where is_active
      order by sort_order, competency_name`,
  );
  return rows;
}
