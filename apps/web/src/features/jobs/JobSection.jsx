/**
 * One panel of the job detail (replaces the legacy JobDescription, JobQualifications, and
 * JobResponsibilities, which differed only in icon and content).
 */
export function JobSection({ icon: Icon, title, children }) {
  const headingId = `job-section-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section aria-labelledby={headingId} className="rounded-md border bg-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-sm bg-primary-soft text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <h2 id={headingId} className="text-card-title font-semibold">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export function BulletList({ items }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-body text-text">
      {items.map((item, index) => (
        <li key={`${index}-${item}`}>{item}</li>
      ))}
    </ul>
  );
}
