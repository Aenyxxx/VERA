/**
 * One panel of the job detail (replaces the legacy JobDescription, JobQualifications, and
 * JobResponsibilities, which differed only in icon and content). Design 35: icon tile, body under the heading.
 */
export function JobSection({ icon: Icon, title, children }) {
  const headingId = `job-section-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className="min-w-0 rounded-xl bg-card p-4 shadow-card ring-1 ring-border/80 sm:p-6">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary" aria-hidden="true">
          <Icon className="size-5" />
        </span>
        <h2 id={headingId} className="font-heading text-card-title font-bold text-heading">
          {title}
        </h2>
      </div>
      <div className="break-words sm:pl-14">{children}</div>
    </section>
  );
}

export function BulletList({ items }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-body text-text marker:text-primary">
      {items.map((item, index) => (
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}
