/**
 * Rounds to 2 decimals, half-up, on the decimal value (not the binary float):
 * 39.995 → 40.00, while Math.round(39.995 * 100) / 100 gives 39.99 because 39.995 * 100 = 3999.4999…
 * Used for every stored score so JS, SQL, and the UI show the same number (docs/ALGORITHM.md §5 Rounding).
 * @param {number} value a non-negative score
 * @returns {number}
 */
export function roundHundredths(value) {
  return Number(`${Math.round(Number(`${value}e2`))}e-2`);
}
