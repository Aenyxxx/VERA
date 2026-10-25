// Applicant Management (PRD FR-ADM-02, S18): searchable, filterable, paged list of applicants with their current
// application. The status filter reuses the dashboard tiles (@vera/shared DASHBOARD_TILES).
// Decision 39-4 (Oct 25): HR and admin activate / deactivate ANY applicant's account from here (moved from the
// Applicant Pool, decision 37D); deactivating closes an ongoing application neutrally.
import {
  ACCOUNT_STATUS,
  APPLICATION_STATUS as A,
  DASHBOARD_TILES,
  POOL_AVAILABILITY,
  WITH_CLIENT_STATUSES,
} from "@vera/shared";

import { withTransaction } from "../../db/tx.js";
import { refreshShortlist } from "../../domain/shortlist.js";
import { transition } from "../../domain/statusMachine.js";
import { conflict, notFound } from "../../lib/errors.js";
import { blockSignIn, unblockSignIn } from "../../lib/signIn.js";
import { lockApplicant } from "../applications/applications.repository.js";
import { expirePendingOffers, setPoolAvailability } from "../rematch/rematch.repository.js";
import { cancelPendingRequests, lockApplication } from "../screening/screening.repository.js";
import { setApplicantAccount } from "../users/users.repository.js";
import { lockVacancy } from "../vacancies/vacancies.repository.js";

import {
  cancelLiveInterviews,
  findActivePoolEntry,
  findApplicantAccount,
  findOngoingApplication,
  listApplicants,
  markItemDeactivated,
} from "./applicants.repository.js";

const CLOSED_REASON = "Account deactivated";
/** Closing one of these frees a shortlist place, so the group is refreshed as after a Drop (BR-11). */
const SHORTLIST_STAGES = [A.WAITING_POOL, A.SHORTLISTED, A.INTERVIEW_SCHEDULED, A.INTERVIEW_CONFIRMED];

/** GET /api/admin/applicants?search=&status=&page=&pageSize= → { data, meta: { page, pageSize, total } } */
export async function searchApplicants({ search, status, page, pageSize }) {
  const { rows, total } = await listApplicants({
    search,
    statuses: status && status !== "applicantPool" ? DASHBOARD_TILES[status].statuses : null,
    poolOnly: status === "applicantPool",
    page,
    pageSize,
  });
  return { data: rows, meta: { page, pageSize, total } };
}

/**
 * PATCH /api/admin/applicants/:applicantId/account { accountStatus, reason? } (decision 39-4; HR and admin; any applicant).
 * The WHOLE account, the same mechanism as staff (decision 19): user_account.account_status + reason, then the Supabase
 * ban after the commit (a failure → signInBlocked: false; pressing Deactivate again retries it).
 * Deactivate, ONE transaction, locks job_vacancy (of the ongoing application) → applicant → application:
 *   the ongoing application (if any) → archived "Account deactivated" (HR actor; neutral: no pool entry, no company
 *   block, no rematch, no notice — Q4-b); its live interview attempts → cancelled; pending document requests →
 *   cancelled; with the client → the endorsement item keeps outcome pending with remarks "Account deactivated";
 *   waiting pool / shortlist / interview → the group's shortlist is refreshed (system moves). A Deployed (hired)
 *   application is not ongoing and stays (Q4-a). The active pool entry (if any): pending offer or invitation →
 *   expired, availability unavailable. Then the account: inactive + reason.
 * Activate: unban first (502: nothing changes), then active, reason null, the pool entry available again. A closed
 * application and expired offers are not restored.
 */
export async function changeApplicantAccountStatus(actorId, applicantId, { accountStatus, reason }) {
  const account = await findApplicantAccount(applicantId);
  if (!account) throw notFound("Applicant not found.");

  if (accountStatus === ACCOUNT_STATUS.ACTIVE) {
    await unblockSignIn(account.userId, "activate applicant");
    await withTransaction(actorId, async (client) => {
      await lockApplicant(client, applicantId);
      const entry = await findActivePoolEntry(client, applicantId);
      if (entry?.availability === POOL_AVAILABILITY.UNAVAILABLE) {
        await setPoolAvailability(client, entry.talentPoolId, POOL_AVAILABILITY.AVAILABLE);
      }
      await setApplicantAccount(client, account.userId, { accountStatus: ACCOUNT_STATUS.ACTIVE, reason: null });
    });
    return { applicantId, accountStatus: ACCOUNT_STATUS.ACTIVE, signInBlocked: false };
  }

  const ongoing = await findOngoingApplication(applicantId); // read first: its vacancy is locked first
  const result = await withTransaction(actorId, async (client) => {
    if (ongoing) await lockVacancy(client, ongoing.vacancyId); // 1. job_vacancy
    await lockApplicant(client, applicantId); // 2. applicant
    const current = await findOngoingApplication(applicantId, client);
    if (current?.applicationId !== ongoing?.applicationId) {
      throw conflict("This applicant's application changed meanwhile. Refresh the page.");
    }
    let closed = null;
    if (current) {
      const locked = await lockApplication(client, current.applicationId); // 3. application
      await transition(client, locked, A.ARCHIVED, CLOSED_REASON); // HR = actor; 409 if it moved
      await cancelLiveInterviews(client, locked.applicationId);
      await cancelPendingRequests(client, locked.applicationId);
      if (WITH_CLIENT_STATUSES.includes(locked.status)) await markItemDeactivated(client, locked.applicationId);
      if (SHORTLIST_STAGES.includes(locked.status)) await refreshShortlist(client, locked.vacancyId, locked.applicantType);
      closed = { applicationId: locked.applicationId, from: locked.status };
    }
    const entry = await findActivePoolEntry(client, applicantId);
    const expiredOffers = entry ? await expirePendingOffers(client, entry.talentPoolId) : 0;
    if (entry) await setPoolAvailability(client, entry.talentPoolId, POOL_AVAILABILITY.UNAVAILABLE);
    await setApplicantAccount(client, account.userId, { accountStatus: ACCOUNT_STATUS.INACTIVE, reason: reason.trim() });
    return { closed, expiredOffers };
  });
  const signInBlocked = await blockSignIn(account.userId, "deactivate applicant");
  return {
    applicantId,
    accountStatus: ACCOUNT_STATUS.INACTIVE,
    closedApplication: result.closed,
    expiredOffers: result.expiredOffers,
    signInBlocked,
  };
}
