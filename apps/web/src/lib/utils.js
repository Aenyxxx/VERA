import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// VERA's font-size tokens (index.css @theme --text-*). Without them tailwind-merge reads text-body, text-label-sm…
// as text colours, so a size and a colour class on the same element would drop each other.
const FONT_SIZES = [
  "display",
  "page-title",
  "section-title",
  "card-title",
  "body-lg",
  "body",
  "body-sm",
  "label-sm",
  "caption",
  "metric",
];

const twMerge = extendTailwindMerge({ extend: { theme: { text: FONT_SIZES } } });

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
