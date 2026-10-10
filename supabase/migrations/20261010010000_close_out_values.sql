-- =============================================================================
-- VERA — close-out enum values (roadmap slice S15, fix found by check-s15 on Oct 10, 2026)
--
-- Why: the close-out (apps/api/src/domain/closeOut.js, PRD BR-22) moves applications to 'not_selected' and adds
-- applicant-pool entries with pool_reason 'not_selected'. 20261008000000_one_ongoing_application.sql declares both
-- values, but the real database did not have them (check-s15's archive step failed with "invalid input value for
-- enum application_status: not_selected"). `add value if not exists` makes this safe to run whether or not they
-- exist already. Every other value S15 uses was checked on the database and exists.
--
-- 'not_selected' is a neutral final status (BR-19: no company block) and NOT ongoing (BR-17): it is not added to
-- is_active_application_status(), application_active_idx, or application_one_ongoing_per_applicant, and no other
-- SQL function, view, or trigger lists application statuses (the company-block and ongoing checks live in the
-- API, from @vera/shared). No existing row changes.
--
-- Run once in the Supabase SQL Editor (after 20261010000000_application_source_rematch.sql), then restart
-- `pnpm dev`. Verification queries: docs/DATABASE_SCHEMA.md §7.
-- =============================================================================
begin;

-- The new values are not used anywhere in this transaction (Postgres only allows using a new enum value after
-- the transaction that added it commits).
alter type public.application_status add value if not exists 'not_selected';
alter type public.pool_reason add value if not exists 'not_selected';

commit;
