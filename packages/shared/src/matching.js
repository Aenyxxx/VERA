// Matching weights per applicant type (radio button at apply time). The API sends them to svc /match
// and stores them in matching_result.weights. docs/ALGORITHM.md §4 MAT-04, PRD BR-04.
import { APPLICANT_TYPE } from "./statuses.js";

// VERA-ALGO[MAT-04] BEGIN Matching weights by applicant type (sent to svc /match)
// Formula: matching = 100 · (w_s · S_skills + w_e · S_exp) / (w_s + w_e);  first-time (w_s, w_e) = (1, 0), experienced = (0.5, 0.5)   Ref: docs/ALGORITHM.md §4 MAT-04
// Rule: a vacancy with no experience criterion (experience text blank AND min years = 0) uses (1, 0) for every applicant type
export const MATCHING_WEIGHTS = Object.freeze({
  [APPLICANT_TYPE.FIRST_TIME]: Object.freeze({ skills: 1, experience: 0 }), // skills only
  [APPLICANT_TYPE.EXPERIENCED]: Object.freeze({ skills: 0.5, experience: 0.5 }), // skills 50% + experience 50%
});

const SKILLS_ONLY = MATCHING_WEIGHTS[APPLICANT_TYPE.FIRST_TIME];

/**
 * The weights actually used for one application (sent to /match and stored in matching_result.weights).
 * Without an experience criterion the svc scores experience as 1.0 (nothing to match), which would hand
 * experienced applicants a free 50-point floor; so such a vacancy is matched on skills only.
 * @param {"first_time"|"experienced"} applicantType radio button at apply time
 * @param {{ experienceRequirement: string|null, minYearsExperience: number }} vacancy
 * @returns {{ skills: number, experience: number }}
 */
export function resolveMatchingWeights(applicantType, vacancy) {
  const hasExperienceCriterion =
    (vacancy.experienceRequirement ?? "").trim() !== "" || Number(vacancy.minYearsExperience) > 0;
  return hasExperienceCriterion ? MATCHING_WEIGHTS[applicantType] : SKILLS_ONLY;
}
// VERA-ALGO[MAT-04] END
