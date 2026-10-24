import { cn } from "@/lib/utils"

function Textarea({
  className,
  ...props
}) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Decision 39-1: editable = white (also in OS dark mode); disabled / read-only = light gray, readable text
        "flex field-sizing-content min-h-28 w-full rounded-md border border-input bg-card px-3 py-2 text-base shadow-xs transition-[color,box-shadow,border-color] duration-150 outline-none placeholder:text-muted-foreground hover:border-heading/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-muted-foreground read-only:bg-surface-subtle aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
