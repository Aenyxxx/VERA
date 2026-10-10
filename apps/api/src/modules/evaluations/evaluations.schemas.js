import { COMPETENCY_SECTIONS } from "@vera/shared";
import { z } from "zod";

/** 15: every Competency Profile item is rated at each interview (FR-INT-06). */
export const ITEM_COUNT = COMPETENCY_SECTIONS.reduce((count, section) => count + section.items.length, 0);

export const idParams = z.object({ id: z.uuid("Application not found") });

// Only the ratings are accepted; any score in the body is ignored (the server recomputes, domain/scoring.js).
export const evaluationSchema = z.object({
  ratings: z
    .array(
      z.object({
        competencyId: z.uuid("Unknown Competency Profile item"),
        rating: z.number().int("Choose a rating from 1 to 5").min(1, "Choose a rating from 1 to 5").max(5, "Choose a rating from 1 to 5"),
      }),
    )
    .length(ITEM_COUNT, `Rate all ${ITEM_COUNT} items`)
    .refine((list) => new Set(list.map((r) => r.competencyId)).size === list.length, "Each item can be rated once"),
});

export const noBody = z.object({}).optional().default({});
