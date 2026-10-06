/** Age in whole years from an ISO birthdate ("2002-07-10"); null when empty or invalid. Age is never stored. */
export function ageFrom(birthdate, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate ?? "")) return null;
  const [year, month, day] = birthdate.split("-").map(Number);
  let age = today.getFullYear() - year;
  const beforeBirthday = today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}
