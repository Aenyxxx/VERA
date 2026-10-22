/** Avatar initials (decision 31): first letter of the first name + first letter of the last name ("Ana Marie Santos" → "AS"). */
export function initials(firstName, lastName) {
  return [firstName, lastName].map((part) => part?.trim()?.[0]?.toUpperCase() ?? "").join("");
}
