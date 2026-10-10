import { z } from "zod";

// Evaluation form (FR-INT-06): every Competency Profile item rated 1–5. Mirrors the API body
// (apps/api/src/modules/evaluations/evaluations.schemas.js); the API re-checks the item set.

/** Form values { [competencyId]: 1–5 } for the given items. */
export function ratingsSchema(itemIds) {
  return z.object(
    Object.fromEntries(
      itemIds.map((id) => [id, z.number({ error: "Choose a rating from 1 to 5" }).int().min(1).max(5)]),
    ),
  );
}

/** The POST body: ratings only, in rubric order. */
export function toRatingsBody(itemIds, values) {
  return itemIds.map((competencyId) => ({ competencyId, rating: values[competencyId] }));
}
