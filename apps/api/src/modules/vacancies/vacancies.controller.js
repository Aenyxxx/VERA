import {
  changeVacancyStatus,
  createVacancy,
  editVacancy,
  getVacancy,
  getVacancyDefaults,
  searchVacancies,
} from "./vacancies.service.js";

// GET /api/admin/vacancies/defaults
export async function defaults(req, res) {
  res.json({ data: await getVacancyDefaults() });
}

// GET /api/admin/vacancies?search=&status=&page=&pageSize=
export async function list(req, res) {
  res.json(await searchVacancies(req.valid.query));
}

// GET /api/admin/vacancies/:id
export async function show(req, res) {
  res.json({ data: await getVacancy(req.valid.params.id) });
}

// POST /api/admin/vacancies
export async function create(req, res) {
  res.status(201).json({ data: await createVacancy(req.valid.body, req.auth.userId) });
}

// PATCH /api/admin/vacancies/:id (the schema depends on the vacancy's status, so the service validates)
export async function update(req, res) {
  res.json({ data: await editVacancy(req.valid.params.id, req.body ?? {}, req.auth.userId) });
}

// POST /api/admin/vacancies/:id/{publish|close|reopen|archive}
export const statusAction = (action) => async (req, res) => {
  res.json({ data: await changeVacancyStatus(req.valid.params.id, action, req.valid.body ?? {}, req.auth.userId) });
};
