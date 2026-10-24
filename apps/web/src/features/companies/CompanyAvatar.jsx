import { cn } from "@/lib/utils";

/** Decorative initials tile for a company (design 03/05). Hidden from screen readers: the name is always next to it. */
export function CompanyAvatar({ name, className }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-nav font-heading text-body-sm font-bold text-white",
        className,
      )}
    >
      {initials}
    </span>
  );
}
