import { percent } from "./sampleData";

// Decision 34 charts, drawn with plain HTML/CSS (apps/web has no chart library; none is added).
// Pipeline = magnitude per stage → one hue (the brand blue, 5.55:1 on the white card).
// Outcomes = part-to-whole of the endorsed applicants → categorical, fixed order. Checked with the dataviz palette
// validator (light, surface #FFFFFF): lightness, chroma, CVD (worst adjacent ΔE 9.2), and normal-vision checks pass;
// the aqua is 2.82:1 on white, so every segment is also named with its value in the legend (and the vacancy table
// gives the numbers without the chart).
const PIPELINE_COLOR = "#1464D2";
const OUTCOME_COLORS = { hired: "#1464D2", not_hired: "#eb6834", with_client: "#1baf7a" };

/** Hover / keyboard-focus readout for one mark: the value first, then what it is (UI text, never the mark color). */
function MarkTooltip({ value, label }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none invisible absolute bottom-full left-0 z-10 mb-1 rounded-sm border bg-card px-2 py-1 text-body-sm whitespace-nowrap text-text shadow-sm group-hover:visible group-focus-within:visible"
    >
      <span className="font-semibold text-heading tabular">{value}</span> <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

/** Pipeline: applications that reached each stage, as horizontal bars from a shared baseline, direct-labeled. */
export function PipelineChart({ stages }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  const first = stages[0]?.value ?? 0;
  return (
    <figure className="flex flex-col gap-3" aria-labelledby="report-pipeline-title">
      <figcaption id="report-pipeline-title" className="text-card-title font-semibold text-heading">
        Recruitment pipeline
      </figcaption>
      <p className="text-body-sm text-muted-foreground">Applications that reached each stage.</p>
      <ul className="flex flex-col gap-2">
        {stages.map((s) => (
          <li key={s.stage} className="grid grid-cols-[6.5rem_1fr] items-center gap-3 sm:grid-cols-[8rem_1fr]">
            <span className="text-body-sm text-text">{s.stage}</span>
            <div className="group relative flex items-center gap-2">
              <div
                tabIndex={0}
                role="img"
                aria-label={`${s.stage}: ${s.value} applications, ${percent(s.value, first)}% of all applications`}
                className="h-5 rounded-r-sm outline-none transition-opacity group-hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
                style={{ width: `${(s.value / max) * 85}%`, minWidth: 4, backgroundColor: PIPELINE_COLOR }}
              />
              <span className="text-body-sm font-semibold text-text tabular">{s.value}</span>
              <MarkTooltip value={`${percent(s.value, first)}%`} label={`of all applications reached ${s.stage}`} />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Hiring outcomes: one stacked bar (2px gaps between segments) with a legend that names every segment and value. */
export function OutcomeChart({ outcomes }) {
  const total = outcomes.reduce((sum, o) => sum + o.value, 0);
  return (
    <figure className="flex flex-col gap-3" aria-labelledby="report-outcomes-title">
      <figcaption id="report-outcomes-title" className="text-card-title font-semibold text-heading">
        Hiring outcomes
      </figcaption>
      <p className="text-body-sm text-muted-foreground">What happened to the {total} endorsed applicants.</p>
      <div className="flex h-8 w-full gap-0.5">
        {outcomes.map((o, i) => (
          <div key={o.key} className="group relative" style={{ width: `${percent(o.value, total)}%` }}>
            <div
              tabIndex={0}
              role="img"
              aria-label={`${o.label}: ${o.value} of ${total} (${percent(o.value, total)}%)`}
              className={`h-full outline-none transition-opacity group-hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50 ${i === 0 ? "rounded-l-sm" : ""} ${i === outcomes.length - 1 ? "rounded-r-sm" : ""}`}
              style={{ backgroundColor: OUTCOME_COLORS[o.key] }}
            />
            <MarkTooltip value={`${o.value} (${percent(o.value, total)}%)`} label={o.label} />
          </div>
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legend">
        {outcomes.map((o) => (
          <li key={o.key} className="flex items-center gap-2 text-body-sm text-text">
            <span aria-hidden="true" className="size-3 rounded-sm" style={{ backgroundColor: OUTCOME_COLORS[o.key] }} />
            <span>{o.label}</span>
            <span className="font-semibold text-heading tabular">{o.value}</span>
            <span className="text-muted-foreground tabular">({percent(o.value, total)}%)</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
