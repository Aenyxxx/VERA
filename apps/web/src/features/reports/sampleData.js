// Decision 34: Recruitment Reports is a PREVIEW with fixed sample numbers. Nothing here comes from the API or the
// database; the page says so in a banner. The numbers are made up but consistent with each other (the table adds up
// to the tiles, the pipeline, and the outcomes), and the companies are fictitious ("Sample …"), never real clients.

export const SAMPLE_TILES = [
  { label: "Total applications", value: 248 },
  { label: "Active vacancies", value: 5 },
  { label: "Endorsed", value: 22 },
  { label: "Hired", value: 14 },
];

/** Applications that reached each stage (each stage includes everyone who went further). */
export const SAMPLE_PIPELINE = [
  { stage: "Applications", value: 248 },
  { stage: "Qualified", value: 196 },
  { stage: "Shortlisted", value: 64 },
  { stage: "Interviewed", value: 48 },
  { stage: "Passed", value: 31 },
  { stage: "Endorsed", value: 22 },
  { stage: "Hired", value: 14 },
];

/** What happened to the 22 endorsed applicants (part-to-whole). */
export const SAMPLE_OUTCOMES = [
  { key: "hired", label: "Hired", value: 14 },
  { key: "not_hired", label: "Not hired", value: 5 },
  { key: "with_client", label: "Still with the client", value: 3 },
];

export const SAMPLE_VACANCIES = [
  { vacancy: "Store Crew", company: "Sample Food Corp.", applications: 82, shortlisted: 20, endorsed: 7, hired: 5, slots: 6 },
  { vacancy: "Cashier", company: "Sample Retail Co.", applications: 64, shortlisted: 16, endorsed: 6, hired: 4, slots: 4 },
  { vacancy: "Warehouse Helper", company: "Sample Logistics Inc.", applications: 45, shortlisted: 12, endorsed: 4, hired: 2, slots: 3 },
  { vacancy: "Sales Associate", company: "Sample Retail Co.", applications: 38, shortlisted: 10, endorsed: 3, hired: 2, slots: 2 },
  { vacancy: "Utility Crew", company: "Sample Food Corp.", applications: 19, shortlisted: 6, endorsed: 2, hired: 1, slots: 2 },
];

/** Whole-number percentage of `part` in `whole` (0 when the whole is 0). */
export const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
