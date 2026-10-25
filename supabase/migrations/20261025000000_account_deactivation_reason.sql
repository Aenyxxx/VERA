-- =============================================================================
-- VERA — the applicant deactivation reason lives on the account (decision 39-4, approved by the owner Oct 25, 2026)
--
-- Decision 39-4 moves Activate / Deactivate to Applicant Management for EVERY applicant (not only Applicant Pool
-- entries). HR's reason (required to deactivate, HR only, never sent to the applicant) therefore needs a home that
-- every applicant has: user_account.
--   1. user_account.deactivation_reason text NULL (no default). Set on Deactivate, cleared (null) on Activate.
--      Staff deactivation (decision 19) does not use it: it stays null for staff.
--   2. Backfill (decision 37D data): for every applicant account that is inactive today, copy HR's reason from its
--      applicant-pool entry (`talent_pool.remarks`; the active entry first, else the latest entry with remarks), then
--      clear those remarks, so the reason has ONE home. `talent_pool.remarks` is not used for anything else.
-- No constraint (the API checks 5–500 characters). No other column, table, enum, index or row change.
-- Idempotent: the column is added only if missing and the backfill only fills an empty reason.
--
-- Run once in the Supabase SQL Editor, then restart `pnpm dev`.
-- Verification queries: docs/DATABASE_SCHEMA.md §7.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- 1. The column
-- -----------------------------------------------------------------------------
alter table public.user_account
  add column if not exists deactivation_reason text;

comment on column public.user_account.deactivation_reason is
  'Decision 39-4: HR''s reason for deactivating an applicant account (HR only, never sent to the applicant); null while active and for staff.';

-- -----------------------------------------------------------------------------
-- 2. Backfill from the applicant-pool entry (decision 37D kept the reason in talent_pool.remarks)
-- -----------------------------------------------------------------------------
with source as (
  select distinct on (u.user_account_id)
         u.user_account_id, tp.talent_pool_id, tp.remarks
    from public.user_account u
    join public.applicant p on p.user_account_id = u.user_account_id
    join public.talent_pool tp on tp.applicant_id = p.applicant_id
   where u.role = 'applicant'
     and u.account_status = 'inactive'
     and u.deactivation_reason is null
     and nullif(btrim(tp.remarks), '') is not null
   order by u.user_account_id, (tp.removed_at is null) desc, tp.added_at desc
),
copied as (
  update public.user_account u
     set deactivation_reason = btrim(s.remarks)
    from source s
   where u.user_account_id = s.user_account_id
  returning u.user_account_id
)
update public.talent_pool tp
   set remarks = null
  from public.applicant p, copied c
 where p.applicant_id = tp.applicant_id
   and p.user_account_id = c.user_account_id
   and tp.remarks is not null;

commit;
