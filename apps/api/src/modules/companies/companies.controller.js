import { createCompany, editCompany, getCompany, searchCompanies } from "./companies.service.js";

// GET /api/admin/companies?search=&page=&pageSize=
export async function list(req, res) {
  res.json(await searchCompanies(req.valid.query));
}

// GET /api/admin/companies/:id
export async function show(req, res) {
  res.json({ data: await getCompany(req.valid.params.id) });
}

// POST /api/admin/companies
export async function create(req, res) {
  res.status(201).json({ data: await createCompany(req.valid.body, req.auth.userId) });
}

// PATCH /api/admin/companies/:id
export async function update(req, res) {
  res.json({ data: await editCompany(req.valid.params.id, req.valid.body) });
}
