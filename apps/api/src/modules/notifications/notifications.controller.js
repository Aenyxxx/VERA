import { listForUser, markAllRead } from "./notifications.repository.js";

// GET /api/notifications?limit= → newest first + unread count
export async function list(req, res) {
  const { rows, unreadCount } = await listForUser(req.auth.userId, req.valid.query.limit);
  res.json({ data: rows, meta: { unreadCount } });
}

// POST /api/notifications/read-all
export async function readAll(req, res) {
  res.json({ data: { updated: await markAllRead(req.auth.userId) } });
}
