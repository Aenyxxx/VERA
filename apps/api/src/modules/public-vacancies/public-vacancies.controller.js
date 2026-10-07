import { getOpenVacancy, searchOpenVacancies } from "./public-vacancies.service.js";

// GET /api/applicant/vacancies?search=&page=&pageSize=
export async function list(req, res) {
  res.json(await searchOpenVacancies(req.valid.query, req.auth.userId));
}

// GET /api/applicant/vacancies/:id
export async function show(req, res) {
  res.json({ data: await getOpenVacancy(req.valid.params.id, req.auth.userId) });
}
