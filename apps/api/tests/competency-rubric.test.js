// S9b Competency Profile: the migration, the seed, and @vera/shared must describe the same rubric,
// and the WSM-02 band thresholds in SQL must match SUCCESS_PROBABILITY_BANDS.
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  COMPETENCY_SECTIONS,
  RATING_INTERPRETATIONS,
  SUCCESS_PROBABILITY_BANDS,
  successProbabilityFor,
} from "@vera/shared";
import { describe, expect, it } from "vitest";

const root = path.join(import.meta.dirname, "../../..");
const read = (file) => readFileSync(path.join(root, file), "utf8").replace(/--.*$/gm, "");
const migration = read("supabase/migrations/20261007000000_competency_profile_rubric.sql");
const seed = read("supabase/seed.sql");

/** ('A', 'Communication and Interpersonal Skills', 1) rows of the section insert. */
function sectionsIn(sql) {
  const block = sql.match(/insert into public\.competency_section[\s\S]*?values([\s\S]*?)(?:on conflict[^;]*)?;/)[1];
  return [...block.matchAll(/\('([ABC])',\s*'([^']+)',\s*(\d+)\)/g)].map(([, code, name]) => ({ code, name }));
}

/** ('B', 'Problem Solving', 4) rows of the item insert, in sort order. */
function itemsIn(sql) {
  const block = sql.match(/insert into public\.competency \(competency_name, section_id, sort_order\)[\s\S]*?from \(values([\s\S]*?)\) as item/)[1];
  return [...block.matchAll(/\('([ABC])',\s*'([^']+)',\s*(\d+)\)/g)]
    .map(([, code, name, order]) => ({ code, name, order: Number(order) }))
    .sort((a, b) => a.order - b.order);
}

const expectedItems = COMPETENCY_SECTIONS.flatMap((section) => section.items.map((name) => ({ code: section.code, name })));

describe.each([
  ["migration", migration],
  ["seed", seed],
])("%s matches @vera/shared COMPETENCY_SECTIONS", (_label, sql) => {
  it("has the 3 sections in order", () => {
    expect(sectionsIn(sql)).toEqual(COMPETENCY_SECTIONS.map(({ code, name }) => ({ code, name })));
  });

  it("has the 15 items under their sections, in order", () => {
    const items = itemsIn(sql);
    expect(items).toHaveLength(15);
    expect(items.map(({ code, name }) => ({ code, name }))).toEqual(expectedItems);
    expect(items.map((i) => i.order)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
  });
});

describe("rubric shape", () => {
  it("has 3 / 9 / 3 items per section", () => {
    expect(COMPETENCY_SECTIONS.map((s) => s.items.length)).toEqual([3, 9, 3]);
  });

  it("interprets every rating 1–5", () => {
    expect(Object.keys(RATING_INTERPRETATIONS)).toEqual(["1", "2", "3", "4", "5"]);
    expect(RATING_INTERPRETATIONS[3]).toEqual({ short: "Achieves expectations", long: "Neither strength nor development need" });
  });
});

describe("WSM-02 overall rating of probability of success", () => {
  it("uses the same thresholds in the generated column as in @vera/shared", () => {
    const block = migration.match(/overall_rating smallint generated always as \(([\s\S]*?)\) stored/)[1];
    const sqlBands = [...block.matchAll(/when interview_score >= (\d+) then (\d)/g)].map(([, min, rating]) => ({
      min: Number(min),
      rating: Number(rating),
    }));
    expect(block).toMatch(/else 1/);
    expect(sqlBands).toEqual(SUCCESS_PROBABILITY_BANDS.filter((b) => b.min > 0).map(({ min, rating }) => ({ min, rating })));
  });

  it.each([
    [0, 1],
    [19.99, 1],
    [20, 2],
    [39.99, 2],
    [40, 3],
    [59.99, 3],
    [60, 4],
    [77.5, 4], // docs/ALGORITHM.md §6 worked example
    [79.99, 4],
    [80, 5],
    [100, 5],
  ])("interview %d → rating %d", (score, rating) => {
    expect(successProbabilityFor(score).rating).toBe(rating);
  });

  it("describes each band", () => {
    expect(successProbabilityFor(85).description).toBe("HIGH — Very good probability of success (80–100%)");
    expect(successProbabilityFor(5).label).toBe("Low");
  });
});

describe("migration safety", () => {
  it("refuses to run when ratings exist and wraps everything in one transaction", () => {
    expect(migration).toMatch(/if exists \(select 1 from public\.competency_rating\) then\s+raise exception/);
    expect(migration.trim()).toMatch(/^begin;[\s\S]*commit;$/);
  });

  it("enables RLS on the new tables (rule 6)", () => {
    expect(migration).toContain("alter table public.competency_section enable row level security;");
    expect(migration).toContain("alter table public.job_section_weight enable row level security;");
  });
});
