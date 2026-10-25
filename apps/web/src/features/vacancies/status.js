// Which HR actions a vacancy status allows (same rules as apps/api/src/domain/vacancyStatus.js, APP_FLOW §5.2).
import { VACANCY_STATUS as V } from "@vera/shared";

export const VACANCY_ACTIONS = {
  publish: { from: [V.DRAFT], label: "Publish", done: "Vacancy published" },
  close: { from: [V.OPEN], label: "Close", done: "Vacancy closed" },
  reopen: { from: [V.CLOSED, V.ENDORSING], label: "Reopen", done: "Vacancy reopened" },
  archive: { from: [V.DRAFT, V.CLOSED, V.FILLED], label: "Archive", done: "Vacancy archived" }, // decision 40-3: + filled
  // Decision 40-5: back to draft / filled / closed (the API decides; never open).
  unarchive: { from: [V.ARCHIVED], label: "Unarchive", done: "Vacancy unarchived" },
};

/** Decision 40-3: what the Archive vacancies dialog lists (filled, or closed with nobody still with the client). */
export const canBulkArchive = (vacancy) =>
  vacancy.status === V.FILLED || (vacancy.status === V.CLOSED && (vacancy.withClientCount ?? 0) === 0);

export const actionsFor = (status) => Object.keys(VACANCY_ACTIONS).filter((action) => VACANCY_ACTIONS[action].from.includes(status));
