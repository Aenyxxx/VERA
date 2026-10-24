import { percent } from "./sampleData";

// Decision 34 charts, drawn with plain HTML/CSS/SVG (apps/web has no chart library; none is added).
// Pipeline = magnitude per stage → one hue (the brand blue, 5.55:1 on the white card).
// Outcomes = part-to-whole of the endorsed applicants → categorical, fixed order. Checked with the dataviz palette
// validator (light, surface #FFFFFF): lightness, chroma, CVD (worst adjacent ΔE 9.2), and normal-vision checks pass;
// the aqua is 2.82:1 on white, so every segment is also named with its value in the legend (and the vacancy table
// gives the numbers without the chart).
const PIPELINE_COLOR = "#1464D2";
const OUTCOME_COLORS = { hired: "#1464D2", not_hired: "#eb6834", with_client: "#1baf7a" };

/**
 * Hover / keyboard-focus readout for one mark: the value first, then what it is (UI text, never the mark color).
 * `w-max max-w-full`: it wraps inside its anchor, so even while hidden it never widens the card or the page.
 */
function MarkTooltip({ value, label }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none invisible absolute bottom-full left-0 z-10 mb-1 w-max max-w-full rounded-md border bg-card px-2 py-1 text-body-sm text-text shadow-raised group-hover:visible group-focus-within:visible"
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
      <figcaption id="report-pipeline-title" className="font-heading text-card-title font-bold text-heading">
        Applicant progress
      </figcaption>
      <p className="text-body-sm text-muted-foreground">Applications that reached each stage.</p>
      <ul className="mt-1 flex flex-col gap-3">
        {stages.map((s) => (
          <li key={s.stage} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <span className="text-body-sm text-muted-foreground">{s.stage}</span>
            <div className="group relative flex min-w-0 items-center gap-2">
              <div
                tabIndex={0}
                role="img"
                aria-label={`${s.stage}: ${s.value} applications, ${percent(s.value, first)}% of all applications`}
                className="h-6 rounded-r-[4px] outline-none transition-opacity group-hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
                style={{ width: `${(s.value / max) * 85}%`, minWidth: 4, backgroundColor: PIPELINE_COLOR }}
              />
              <span className="text-body-sm font-semibold text-heading tabular">{s.value}</span>
              <MarkTooltip value={`${percent(s.value, first)}%`} label={`of all applications reached ${s.stage}`} />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}

// Ring geometry (SVG units; the ring is drawn at 160px). Room is left outside the outer edge for the focus stroke.
const SIZE = 160;
const CENTER = SIZE / 2;
const OUTER = 76;
const INNER = 52;

function point(radius, angle) {
  return `${(CENTER + radius * Math.cos(angle)).toFixed(2)} ${(CENTER + radius * Math.sin(angle)).toFixed(2)}`;
}

/**
 * One ring segment as a filled annular sector from `start` to `end` (radians, 0 = top, clockwise). Each edge is
 * pulled in by 1px at both radii, which leaves the 2px surface gap between neighbouring segments.
 */
function arcPath(start, end) {
  const top = -Math.PI / 2;
  const o0 = top + start + 1 / OUTER;
  const o1 = top + end - 1 / OUTER;
  const i0 = top + start + 1 / INNER;
  const i1 = top + end - 1 / INNER;
  const large = end - start > Math.PI ? 1 : 0;
  return [
    `M ${point(OUTER, o0)}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${point(OUTER, o1)}`,
    `L ${point(INNER, i1)}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${point(INNER, i0)}`,
    "Z",
  ].join(" ");
}

/**
 * Hiring outcomes: a ring (part-to-whole of the endorsed applicants, 2px gaps between segments) with the total in the
 * middle and a legend that names every segment and value. Each segment is its own layer (wrapper + svg + tooltip) so
 * the hover / focus tooltip stays plain CSS, like the pipeline bars.
 */
export function OutcomeChart({ outcomes }) {
  const total = outcomes.reduce((sum, o) => sum + o.value, 0);
  const toAngle = (value) => (total > 0 ? (value / total) * 2 * Math.PI : 0);
  const segments = outcomes.map((o, i) => {
    const start = toAngle(outcomes.slice(0, i).reduce((sum, prev) => sum + prev.value, 0));
    return { ...o, start, end: start + toAngle(o.value) };
  });
  return (
    <figure className="flex flex-col gap-4" aria-labelledby="report-outcomes-title">
      <figcaption id="report-outcomes-title" className="font-heading text-card-title font-bold text-heading">
        Hiring outcomes
      </figcaption>
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        <div className="relative size-40 shrink-0">
          {segments.map((s) => (
            <div key={s.key} className="group pointer-events-none absolute inset-0">
              <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full overflow-visible">
                <path
                  d={arcPath(s.start, s.end)}
                  fill={OUTCOME_COLORS[s.key]}
                  tabIndex={0}
                  role="img"
                  aria-label={`${s.label}: ${s.value} of ${total} (${percent(s.value, total)}%)`}
                  className="pointer-events-auto outline-none transition-opacity group-hover:opacity-80 focus-visible:stroke-ring focus-visible:[stroke-width:3]"
                />
              </svg>
              <MarkTooltip value={`${s.value} (${percent(s.value, total)}%)`} label={s.label} />
            </div>
          ))}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-heading text-metric leading-none font-extrabold text-heading tabular">{total}</span>
            <span className="mt-1 text-body-sm text-muted-foreground">endorsed</span>
          </div>
        </div>
        <ul className="flex w-full min-w-0 flex-col gap-3 sm:flex-1" aria-label="Legend">
          {outcomes.map((o) => (
            <li key={o.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 text-body-sm text-text">
              <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: OUTCOME_COLORS[o.key] }} />
              <span>{o.label}</span>
              <span className="text-right font-semibold text-heading tabular">{o.value}</span>
              <span className="w-12 text-right text-muted-foreground tabular">({percent(o.value, total)}%)</span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
