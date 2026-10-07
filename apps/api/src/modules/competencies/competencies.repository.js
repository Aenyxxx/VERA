import { pool } from "../../db/pool.js";

/**
 * The Competency Profile rubric: 3 sections with their items, in display order.
 * HR rates every active item at each interview; vacancies weight the sections (S9b).
 */
export async function listRubric(db = pool) {
  const { rows } = await db.query(
    `select s.section_code as "sectionCode", s.section_name as "sectionName",
            c.competency_id as "competencyId", c.competency_name as "competencyName"
       from public.competency_section s
       join public.competency c on c.section_id = s.competency_section_id and c.is_active
      order by s.sort_order, c.sort_order, c.competency_name`,
  );

  const sections = [];
  for (const row of rows) {
    let section = sections.at(-1);
    if (section?.sectionCode !== row.sectionCode) {
      section = { sectionCode: row.sectionCode, sectionName: row.sectionName, items: [] };
      sections.push(section);
    }
    section.items.push({ competencyId: row.competencyId, competencyName: row.competencyName });
  }
  return sections;
}
