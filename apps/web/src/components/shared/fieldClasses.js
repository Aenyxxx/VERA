/**
 * The look of every native <select> (docs/UI_REDESIGN.md §3.2; decision 39-1): the same as `ui/input` — white when
 * editable (also in OS dark mode), light gray with readable text when disabled. Pages add only layout (widths).
 */
export const SELECT_CLASS =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-body-lg shadow-xs transition-[color,box-shadow,border-color] duration-150 outline-none hover:border-heading/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-body";
