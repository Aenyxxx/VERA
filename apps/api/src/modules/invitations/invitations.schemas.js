import { z } from "zod";

export const vacancyParams = z.object({ id: z.uuid("Vacancy not found") });
export const noBody = z.object({}).optional().default({});
