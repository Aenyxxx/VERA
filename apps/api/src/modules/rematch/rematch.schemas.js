import { z } from "zod";

export const offerParams = z.object({ id: z.uuid("Offer not found") });
export const applicationParams = z.object({ id: z.uuid("Application not found") });

export const noBody = z.object({}).optional().default({});
