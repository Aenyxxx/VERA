-- =============================================================================
-- VERA — job invitations from the applicant pool (Phase 3, decision 17, Oct 13, 2026)
--
-- pool_invitation now carries two kinds of rows:
--   rematch_offer  (S17)      offer after not_hired; accept → application at for_endorsement (source rematch)
--   job_invitation (Phase 3)  invitation after HR publishes a vacancy (automatic pool matching); accept → a normal
--                             application at waiting_pool (source talent_pool), decline → stays in the pool
-- Every existing row is a rematch offer (the column default). The partial unique index pool_invitation_one_pending
-- (talent_pool_id) is unchanged and now means: at most ONE pending row of EITHER kind per pool entry. When a vacancy
-- leaves "open", its pending job invitations are expired by the API in the same transaction.
-- job_vacancy gains the result of the last pool-matching run (shown to HR on the vacancy's "Pool invitations" tab).
--
-- Run once in the Supabase SQL Editor AFTER 20261020000000_pool_reason_values.sql, then the verification queries in
-- docs/DATABASE_SCHEMA.md §7, then restart `pnpm dev`.
-- =============================================================================
begin;

create type public.invitation_kind as enum ('rematch_offer', 'job_invitation');

alter table public.pool_invitation
  add column if not exists kind public.invitation_kind not null default 'rematch_offer';

alter table public.job_vacancy
  add column if not exists pool_matched_at    timestamptz,  -- last pool-matching run finished
  add column if not exists pool_match_summary jsonb;        -- { invited, skipped, failed, finishedAt }

comment on column public.pool_invitation.kind is
  'rematch_offer: S17 offer after not_hired (accept → for_endorsement). job_invitation: Phase 3 invitation after a '
  'publish (accept → a normal application at waiting_pool, source talent_pool).';
comment on column public.job_vacancy.pool_match_summary is
  'Phase 3: result of the last pool-matching run { invited, skipped, failed, finishedAt }.';

commit;
