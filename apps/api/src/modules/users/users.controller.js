import { changeAccountStatus, createHrAccount, getStaff } from "./users.service.js";

// GET /api/admin/users
export async function list(req, res) {
  res.json({ data: await getStaff(req.auth.userId) });
}

// POST /api/admin/users
export async function create(req, res) {
  res.status(201).json({ data: await createHrAccount(req.auth.userId, req.valid.body) });
}

// PATCH /api/admin/users/:id/status
export async function status(req, res) {
  res.json({ data: await changeAccountStatus(req.auth.userId, req.valid.params.id, req.valid.body.accountStatus) });
}
