import { startPoolMatching } from "../invitations/invitations.service.js";

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
// Publish (decision 17c, answer 8): after the commit, pool matching starts in the background; the response does not
// wait for svc and says so. Reopen never starts it.
export const statusAction = (action) => async (req, res) => {
  const data = await changeVacancyStatus(req.valid.params.id, action, req.valid.body ?? {}, req.auth.userId);
  if (action === "publish") {
    startPoolMatching(req.auth.userId, req.valid.params.id);
    res.json({ data: { ...data, poolMatching: "started" } });
    return;
  }
  res.json({ data });
};
