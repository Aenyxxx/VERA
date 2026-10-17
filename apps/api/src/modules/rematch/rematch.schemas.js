import { POOL_TABS } from "@vera/shared";
import { z } from "zod";

export const offerParams = z.object({ id: z.uuid("Offer not found") });
export const applicationParams = z.object({ id: z.uuid("Application not found") });

export const noBody = z.object({}).optional().default({});

// Applicant Pool tabs (decision 18): Waiting / Returned by Client; no tab = every reason.
export const poolQuery = z.object({ tab: z.enum(Object.keys(POOL_TABS), "Unknown pool tab").optional() });
