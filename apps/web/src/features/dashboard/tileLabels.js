import { DASHBOARD_TILES } from "@vera/shared";

/**
 * The label a dashboard tile (and its Applicant Management filter) shows. Decision 37C: the `hired` tile reads
 * "Deployed". Web text only: @vera/shared keeps "Hired" (the API sends it too), and the key, ?status=hired and the
 * counted statuses stay.
 */
export const tileLabel = (key) => (key === "hired" ? "Deployed" : DASHBOARD_TILES[key].label);
