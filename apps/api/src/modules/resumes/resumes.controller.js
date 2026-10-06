import { parseResume } from "./resumes.service.js";

// POST /api/applicant/resume/parse (multipart `resume`)
export async function parse(req, res) {
  const result = await parseResume({ userId: req.auth.userId, email: req.auth.email, file: req.file });
  res.json({ data: result });
}
