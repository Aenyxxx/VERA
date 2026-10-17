-- =============================================================================
-- VERA — applicant pool reasons for screening failures and drops (Phase 3, decisions 17 and 18, Oct 13, 2026)
--
-- Decision 17: an applicant who fails the prescreen or falls below the matching threshold is told right away
-- ("Not shortlisted") and kept in the applicant pool ("Waiting" tab), where pool matching invites them to new
-- vacancies. Decision 18 (answer 4): a dropped application (failed verification, no response, no-show) also enters
-- the pool. Enum values only: Postgres cannot use a new enum value in the transaction that adds it (same pattern as
-- 20261010010000). No row changes. application_source already has 'talent_pool' (initial schema), used when a job
-- invitation is accepted.
--
-- Run once in the Supabase SQL Editor, then 20261020010000, then the verification queries in
-- docs/DATABASE_SCHEMA.md §7, and only then restart `pnpm dev` with the Phase 3 code.
-- =============================================================================
begin;

alter type public.pool_reason add value if not exists 'prescreen_failed';
alter type public.pool_reason add value if not exists 'below_threshold';
alter type public.pool_reason add value if not exists 'dropped';

commit;
