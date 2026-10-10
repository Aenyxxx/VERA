-- =============================================================================
-- VERA — application_source gains 'rematch' (roadmap slice S15, decided Oct 10, 2026)
--
-- Why now: RANK-02 (apps/api/src/domain/shortlist.js) leaves rematch applications out of the occupied
-- shortlist slots (PRD BR-23: an accepted rematch offer starts at for_endorsement, never occupies a shortlist
-- slot, and never displaces anyone). Adding the value now lets the shortlist SQL name it with a typed parameter.
-- Nothing creates rematch applications until S17; the S17 rematch migration does not add this value again.
-- No existing row changes (every current application is 'direct' or 'talent_pool').
--
-- Run once in the Supabase SQL Editor (after 20261008000000_one_ongoing_application.sql), then restart
-- `pnpm dev`. Verification queries: docs/DATABASE_SCHEMA.md §7.
-- =============================================================================
begin;

-- The new value is not used anywhere in this transaction (Postgres only allows using a new enum value after
-- the transaction that added it commits).
alter type public.application_source add value if not exists 'rematch';

comment on type public.application_source is
  'direct = applied by themselves; talent_pool = applied through an invitation (deferred); rematch = accepted rematch offer, starts at for_endorsement and never occupies a shortlist slot (PRD BR-23, S17)';

commit;
