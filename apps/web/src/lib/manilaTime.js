// Interview times are entered and shown in Philippine time (UTC+8, no daylight saving), whatever the
// browser's own time zone is. The API stores UTC; the web always sends an explicit +08:00 offset.

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/**
 * "2026-10-12" + "10:00" (Philippine time) → "2026-10-12T10:00:00+08:00". Never uses the browser's local
 * time zone (no `new Date(date, time)` parsing). Null when either part is missing or malformed.
 */
export function manilaIso(date, time) {
  if (!DATE.test(date ?? "") || !TIME.test(time ?? "")) return null;
  return `${date}T${time}:00+08:00`;
}

const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** A stored time (ISO, any offset) → { date: "YYYY-MM-DD", time: "HH:mm" } in Philippine time (edit form values). */
export function manilaParts(iso) {
  const p = Object.fromEntries(parts.formatToParts(new Date(iso)).map(({ type, value }) => [type, value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Today's date in the Philippines ("YYYY-MM-DD"), for the date input's minimum. */
export function manilaToday(now = new Date()) {
  return manilaParts(now.toISOString()).date;
}

const timeOnly = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit" });

/** "10:00 AM – 10:30 AM" in Philippine time for an interview that starts at `iso` and lasts `minutes`. */
export function manilaTimeRange(iso, minutes) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + minutes * 60_000);
  return `${timeOnly.format(start)} – ${timeOnly.format(end)}`;
}
