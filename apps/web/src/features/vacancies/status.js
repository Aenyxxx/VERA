// Which HR actions a vacancy status allows (same rules as apps/api/src/domain/vacancyStatus.js, APP_FLOW §5.2).
import { VACANCY_STATUS as V } from "@vera/shared";

export const VACANCY_ACTIONS = {
  publish: { from: [V.DRAFT], label: "Publish", done: "Vacancy published" },
  close: { from: [V.OPEN], label: "Close", done: "Vacancy closed" },
  reopen: { from: [V.CLOSED, V.ENDORSING], label: "Reopen", done: "Vacancy reopened" },
  archive: { from: [V.DRAFT, V.CLOSED], label: "Archive", done: "Vacancy archived" },
};

export const actionsFor = (status) => Object.keys(VACANCY_ACTIONS).filter((action) => VACANCY_ACTIONS[action].from.includes(status));
