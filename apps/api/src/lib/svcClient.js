// Calls to the internal Python service (apps/svc). Call these BEFORE opening a DB transaction (CLAUDE.md rule 7).
import { env } from "../config/env.js";

import { svcUnavailable, validationError } from "./errors.js";
import { logger } from "./logger.js";

const SVC_TIMEOUT_MS = 60_000;

async function callSvc(path, init) {
  let response;
  try {
    response = await fetch(`${env.SVC_URL}${path}`, {
      ...init,
      headers: { ...init.headers, "X-Internal-Key": env.SVC_INTERNAL_KEY },
      signal: AbortSignal.timeout(SVC_TIMEOUT_MS),
    });
  } catch (error) {
    logger.warn({ name: error.name, path }, "svc unreachable");
    throw svcUnavailable();
  }

  const body = await response.json().catch(() => null);
  // 400 = the svc explains what is wrong with the file ("This PDF has no selectable text...").
  if (response.status === 400) throw validationError(body?.detail ?? "The resume could not be read.");
  if (!response.ok) {
    logger.warn({ status: response.status, path }, "svc error");
    throw svcUnavailable();
  }
  return body;
}

/**
 * POST /extract — PDF -> sections, skills/experience text, years, auto-filled profile (TRD §8).
 * @param {Buffer} buffer the uploaded PDF
 * @param {string} filename original file name (only used for the svc's extension check)
 */
export function extractResume(buffer, filename) {
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "application/pdf" }), filename);
  return callSvc("/extract", { method: "POST", body: form });
}

/**
 * POST /match — stored resume sections vs one job, with the applicant type's weights (TRD §8, MAT-04).
 * @param {{ sections: Record<string, string>, job: { skills: string, experience: string, minYears: number },
 *           weights: { skills: number, experience: number } }} input
 */
export function matchResume({ sections, job, weights }) {
  return callSvc("/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume: { sections }, job, weights }),
  });
}
