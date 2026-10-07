/** Lines of a multi-line field ("one per line"), without bullets or blanks. */
export function linesOf(text) {
  return (text ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
}
