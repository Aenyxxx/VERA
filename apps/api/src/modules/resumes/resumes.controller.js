import { getCurrentResume, getCurrentResumeUrl, parseResume, replaceResume } from "./resumes.service.js";

// POST /api/applicant/resume/parse (multipart `resume`)
export async function parse(req, res) {
  const result = await parseResume({ userId: req.auth.userId, email: req.auth.email, file: req.file });
  res.json({ data: result });
}

// POST /api/applicant/resume/replace (decision 16; no body: the parsed draft is used)
export async function replace(req, res) {
  res.json({ data: await replaceResume(req.auth.userId) });
}

// GET /api/applicant/resume
export async function show(req, res) {
  res.json({ data: await getCurrentResume(req.auth.userId) });
}

// GET /api/applicant/resume/url
export async function url(req, res) {
  res.json({ data: await getCurrentResumeUrl(req.auth.userId) });
}
