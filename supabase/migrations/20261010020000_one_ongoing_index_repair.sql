-- =============================================================================
-- VERA — repair of the S11b one-ongoing-application index (roadmap slice S15, found by check-s15 on Oct 10, 2026)
--
-- Why: 20261008000000_one_ongoing_application.sql never committed on the real database: its enum values were
-- missing (re-added by 20261010010000_close_out_values.sql) and so is its unique index. This file re-applies the
-- rest of that migration, idempotently:
--   1. the same safety check (refuse while any applicant has more than one ongoing-or-hired application),
--   2. the unique index application_one_ongoing_per_applicant (definition and predicate copied exactly; PRD BR-17),
--   3. the column comment on final_evaluation.ratings_source_application_id (same text; re-setting it is harmless).
-- Its enum values (step 2 of 20261008000000) are not repeated here: 20261010010000 adds them.
-- Safe to rerun: the check only reads, the index uses `if not exists`, and the comment overwrites itself.
--
-- Run once in the Supabase SQL Editor AFTER 20261010010000_close_out_values.sql, then restart `pnpm dev`.
-- Verification queries: docs/DATABASE_SCHEMA.md §7.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- 1. Safety (copied from 20261008000000): the unique index cannot be built while an applicant has more than one
--    ongoing (or hired) application. Clear such data with supabase/scripts/reset-applications.sql first.
-- -----------------------------------------------------------------------------
do $$
declare
  v_applicants int;
begin
  select count(*) into v_applicants
    from (select applicant_id
            from public.application
           where status in ('waiting_pool', 'shortlisted', 'interview_scheduled', 'interview_confirmed',
                            'passed', 'passed_awaiting_confirmation', 'for_endorsement', 'endorsed', 'hired')
           group by applicant_id
          having count(*) > 1) as multiple;
  if v_applicants > 0 then
    raise exception '% applicant(s) have more than one ongoing application. Reset those applications first (supabase/scripts/reset-applications.sql).', v_applicants;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. BR-17 in the database: at most one ongoing-or-hired application per applicant (copied from 20261008000000).
--    The API checks first (409 with a readable message); this index also stops two simultaneous applies.
--    Ongoing = is_active_application_status(); 'hired' blocks too until training_failed.
-- -----------------------------------------------------------------------------
create unique index if not exists application_one_ongoing_per_applicant on public.application (applicant_id)
  where status in ('waiting_pool', 'shortlisted', 'interview_scheduled', 'interview_confirmed',
                   'passed', 'passed_awaiting_confirmation', 'for_endorsement', 'endorsed', 'hired');

-- -----------------------------------------------------------------------------
-- 3. Document the rating-reuse link (copied from 20261008000000; no structural change).
-- -----------------------------------------------------------------------------
comment on column public.final_evaluation.ratings_source_application_id is
  'Application whose 15 competency_rating rows were used: this application (interviewed), or for a reused '
  'evaluation (BR-21, WSM-03) the original interviewed application, resolved through the most recent '
  'completed final_evaluation''s ratings_source_application_id, so a chain of reuses always points to the interview.';

commit;
