-- =============================================================================
-- VERA — final interview and "For hiring" status values (Phase 2, decisions 14 and 15, confirmed Oct 13, 2026)
--
-- After endorsement: Schedule final interview → notify → proceeds → For hiring → Mark as hired / not hired.
-- Enum values only: Postgres cannot use a new enum value in the transaction that adds it, so the function and
-- index changes that use them are in the next file (20261019010000_final_interview.sql). Same pattern as
-- 20261010010000_close_out_values.sql. No existing row changes.
-- notification.notification_type is plain text (not an enum), so the new notification types need no migration.
--
-- Run once in the Supabase SQL Editor, then 20261019010000, BEFORE restarting `pnpm dev` with the Phase 2 code
-- (the new API sends these values in its ongoing-status lists). Verification queries: docs/DATABASE_SCHEMA.md §7.
-- =============================================================================
begin;

alter type public.application_status add value if not exists 'final_interview_scheduled';
alter type public.application_status add value if not exists 'for_hiring';

commit;
