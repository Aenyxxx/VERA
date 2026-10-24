-- =============================================================================
-- VERA — client-outcome stage values (decision 37C, confirmed by the owner Oct 24, 2026)
--
-- After the client's final interview: Proceed → For training → For requirements → For orientation → Deployed (= hired).
-- Training failed only at For training; Not hired at every step before Deployed. `for_hiring` stays for old rows only.
-- Enum values only: Postgres cannot use a new enum value in the transaction that adds it, so the function and index
-- changes that use them are in the next file (20261024010000_outcome_stages.sql). Same pattern as
-- 20261019000000_final_interview_values.sql. No existing row changes.
-- notification.notification_type is plain text (not an enum), so the new notification types need no migration.
--
-- Run once in the Supabase SQL Editor, then 20261024010000, BEFORE restarting `pnpm dev` with the decision 37C code
-- (the new API sends these values in its ongoing-status lists). Verification queries: docs/DATABASE_SCHEMA.md §7.
-- =============================================================================
begin;

alter type public.application_status add value if not exists 'for_training';
alter type public.application_status add value if not exists 'for_requirements';
alter type public.application_status add value if not exists 'for_orientation';

commit;
