/** Age in whole years from an ISO birthdate ("2002-07-10"); null when empty or invalid. Age is never stored. */
export function ageFrom(birthdate, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate ?? "")) return null;
  const [year, month, day] = birthdate.split("-").map(Number);
  let age = today.getFullYear() - year;
  const beforeBirthday = today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

/** 512 B, 12.1 KB, 1.2 MB. */
export function formatBytes(bytes) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const manilaDateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Oct 8, 2026, 9:14 AM" in Philippine time (UI_GUIDELINES §7). */
export function formatDateTime(iso) {
  return iso ? manilaDateTime.format(new Date(iso)) : "";
}
