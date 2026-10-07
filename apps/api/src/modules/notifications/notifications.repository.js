// In-app notification feed (PRD FR-NOTIF-01, simplified). Every query is scoped to the signed-in user.
import { pool } from "../../db/pool.js";

export async function listForUser(userId, limit, db = pool) {
  const [{ rows }, { rows: counts }] = await Promise.all([
    db.query(
      `select notification_id as "notificationId", notification_type as "type", title, message,
              link_path as "linkPath", requires_action as "requiresAction", is_read as "isRead", created_at as "createdAt"
         from public.notification
        where user_account_id = $1
        order by created_at desc
        limit $2`,
      [userId, limit],
    ),
    db.query(
      `select count(*)::int as "unreadCount" from public.notification where user_account_id = $1 and not is_read`,
      [userId],
    ),
  ]);
  return { rows, unreadCount: counts[0].unreadCount };
}

export async function markAllRead(userId, db = pool) {
  const { rowCount } = await db.query(
    `update public.notification set is_read = true, read_at = now()
      where user_account_id = $1 and not is_read`,
    [userId],
  );
  return rowCount;
}
