// Decision 34: Recruitment Reports is a PREVIEW with fixed sample numbers. Nothing here comes from the API or the
// database (owner change Oct 20: no on-page banner; the presenter says so). The numbers are made up but consistent with
// each other (the table adds up to the tiles, the pipeline, and the outcomes), and the companies are fictitious
// ("Sample …"), never real clients. Decision 40-4: one such set per period (Week, Month, Year); Month is the original.

/** The period selector, in display order; Month is the default. */
export const PERIODS = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "year", label: "Year" },
];
export const DEFAULT_PERIOD = "month";

/**
 * Builds one period's set from its vacancy rows, pipeline and outcomes, so the tiles are the table's own totals.
 * The pipeline counts applications that reached each stage (each stage includes everyone who went further); the
 * outcomes split the endorsed applicants (part-to-whole). decision 37C: hired = Deployed everywhere.
 */
function period({ vacancies, qualified, interviewed, passed, notHired, withClient }) {
  const sum = (key) => vacancies.reduce((total, v) => total + v[key], 0);
  const applications = sum("applications");
  const endorsed = sum("endorsed");
  const hired = sum("hired");
  return {
    tiles: [
      { label: "Total applications", value: applications },
      { label: "Active vacancies", value: vacancies.length },
      { label: "Endorsed", value: endorsed },
      { label: "Deployed", value: hired },
    ],
    pipeline: [
      { stage: "Applications", value: applications },
      { stage: "Qualified", value: qualified },
      { stage: "Shortlisted", value: sum("shortlisted") },
      { stage: "Interviewed", value: interviewed },
      { stage: "Passed", value: passed },
      { stage: "Endorsed", value: endorsed },
      { stage: "Deployed", value: hired },
    ],
    outcomes: [
      { key: "hired", label: "Deployed", value: hired },
      { key: "not_hired", label: "Not hired", value: notHired },
      { key: "with_client", label: "Still with the client", value: withClient },
    ],
    vacancies,
  };
}

const row = (vacancy, company, applications, shortlisted, endorsed, hired, slots) => ({
  vacancy, company, applications, shortlisted, endorsed, hired, slots,
});

export const SAMPLE_PERIODS = {
  week: period({
    vacancies: [
      row("Store Crew", "Sample Food Corp.", 21, 6, 2, 1, 6),
      row("Cashier", "Sample Retail Co.", 16, 4, 1, 1, 4),
      row("Warehouse Helper", "Sample Logistics Inc.", 9, 2, 1, 0, 3),
    ],
    qualified: 37,
    interviewed: 9,
    passed: 6,
    notHired: 1,
    withClient: 1,
  }),
  month: period({
    vacancies: [
      row("Store Crew", "Sample Food Corp.", 82, 20, 7, 5, 6),
      row("Cashier", "Sample Retail Co.", 64, 16, 6, 4, 4),
      row("Warehouse Helper", "Sample Logistics Inc.", 45, 12, 4, 2, 3),
      row("Sales Associate", "Sample Retail Co.", 38, 10, 3, 2, 2),
      row("Utility Crew", "Sample Food Corp.", 19, 6, 2, 1, 2),
    ],
    qualified: 196,
    interviewed: 48,
    passed: 31,
    notHired: 5,
    withClient: 3,
  }),
  year: period({
    vacancies: [
      row("Store Crew", "Sample Food Corp.", 610, 140, 42, 30, 30),
      row("Cashier", "Sample Retail Co.", 480, 112, 35, 24, 24),
      row("Warehouse Helper", "Sample Logistics Inc.", 350, 84, 26, 18, 20),
      row("Sales Associate", "Sample Retail Co.", 290, 70, 21, 14, 15),
      row("Utility Crew", "Sample Food Corp.", 160, 40, 12, 8, 10),
      row("Forklift Operator", "Sample Logistics Inc.", 120, 30, 9, 6, 6),
      row("Bagger", "Sample Retail Co.", 95, 24, 8, 5, 6),
      row("Kitchen Helper", "Sample Food Corp.", 75, 20, 7, 5, 5),
    ],
    qualified: 1720,
    interviewed: 390,
    passed: 230,
    notHired: 38,
    withClient: 12,
  }),
};

/** Whole-number percentage of `part` in `whole` (0 when the whole is 0). */
export const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
