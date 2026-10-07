import { z } from "zod";

export const listJobsQuery = z.object({
  search: z.string().trim().max(100).optional().default(""),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const jobIdParams = z.object({ id: z.uuid("This job is no longer open.") });
