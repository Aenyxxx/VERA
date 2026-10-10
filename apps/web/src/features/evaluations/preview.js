import { finalScore, interviewScore, isPassed, overallRating, sectionScores } from "@vera/shared";

// Live preview on the evaluation page. It calls the same @vera/shared functions the API uses (WSM-01, WSM-02,
// FIN-01), so the numbers match what will be stored; the API still recomputes from the ratings on save.

/**
 * @param {{ sectionCode: string, weight: number, items: { competencyId: string }[] }[]} sections
 * @param {Record<string, number|undefined>} ratings competencyId → 1–5 (missing = not rated yet)
 * @param {number} matchingScore
 * @param {number} passingScore
 * @returns {{ sections: Record<string, number|null>, rated: number, total: number,
 *             interviewScore: number|null, overallRating: number|null, finalScore: number|null, passed: boolean|null }}
 *   a section score appears once all its items are rated; the totals once all items are rated
 */
export function previewScores(sections, ratings, matchingScore, passingScore) {
  const bySection = {};
  let rated = 0;
  let total = 0;
  for (const section of sections) {
    const values = section.items.map((item) => ratings[item.competencyId]).filter((value) => value != null);
    rated += values.length;
    total += section.items.length;
    bySection[section.sectionCode] = values.length === section.items.length ? sectionScores({ [section.sectionCode]: values })[section.sectionCode] : null;
  }

  if (rated < total) {
    return { sections: bySection, rated, total, interviewScore: null, overallRating: null, finalScore: null, passed: null };
  }
  const weights = Object.fromEntries(sections.map((section) => [section.sectionCode, section.weight]));
  const interview = interviewScore(weights, bySection);
  const final = finalScore(matchingScore, interview);
  return {
    sections: bySection,
    rated,
    total,
    interviewScore: interview,
    overallRating: overallRating(interview),
    finalScore: final,
    passed: isPassed(final, passingScore),
  };
}
