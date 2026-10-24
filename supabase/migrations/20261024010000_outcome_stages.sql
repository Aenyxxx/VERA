-- =============================================================================
-- VERA — client-outcome stages are ongoing (decision 37C, confirmed by the owner Oct 24, 2026)
--
-- The three new stages (for_training, for_requirements, for_orientation) are ONGOING (PRD BR-17): the applicant is
-- still with the client and cannot apply elsewhere.
--   1. the same safety check as 20261019010000 (refuse while any applicant has more than one ongoing-or-hired
--      application);
--   2. is_active_application_status() and the two literal-list indexes gain the new values (dropped and rebuilt in
--      this transaction; every existing row stays inside the new predicates).
-- No existing row changes. No column or table change.
--
-- Run once in the Supabase SQL Editor AFTER 20261024000000_outcome_stage_values.sql, then restart `pnpm dev`.
-- Verification queries: docs/DATABASE_SCHEMA.md §7.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- 1. Safety: the unique index below cannot be rebuilt while an applicant has more than one ongoing (or hired)
--    application.
-- -----------------------------------------------------------------------------
do $$
declare
  v_applicants int;
begin
  select count(*) into v_applicants
    from (select applicant_id
            from public.application
           where status in ('waiting_pool', 'shortlisted', 'interview_scheduled', 'interview_confirmed',
                            'passed', 'passed_awaiting_confirmation', 'for_endorsement', 'endorsed',
                            'final_interview_scheduled', 'for_hiring',
                            'for_training', 'for_requirements', 'for_orientation', 'hired')
           group by applicant_id
          having count(*) > 1) as multiple;
  if v_applicants > 0 then
    raise exception '% applicant(s) have more than one ongoing application. Stop and report.', v_applicants;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Ongoing statuses (BR-17), same list and order as @vera/shared ACTIVE_APPLICATION_STATUSES.
-- -----------------------------------------------------------------------------
create or replace function public.is_active_application_status(s public.application_status)
returns boolean language sql immutable as $$
  select s in (
    'waiting_pool', 'shortlisted', 'interview_scheduled', 'interview_confirmed',
    'passed', 'passed_awaiting_confirmation', 'for_endorsement', 'endorsed',
    'final_interview_scheduled', 'for_hiring',
    'for_training', 'for_requirements', 'for_orientation'
  );
$$;

-- One ongoing-or-hired application per applicant (BR-17); same list as @vera/shared BLOCKS_APPLYING_STATUSES.
drop index if exists public.application_one_ongoing_per_applicant;
create unique index application_one_ongoing_per_applicant on public.application (applicant_id)
  where status in ('waiting_pool', 'shortlisted', 'interview_scheduled', 'interview_confirmed',
                   'passed', 'passed_awaiting_confirmation', 'for_endorsement', 'endorsed',
                   'final_interview_scheduled', 'for_hiring',
                   'for_training', 'for_requirements', 'for_orientation', 'hired');

drop index if exists public.application_active_idx;
create index application_active_idx on public.application (applicant_id)
  where status in ('waiting_pool', 'shortlisted', 'interview_scheduled', 'interview_confirmed',
                   'passed', 'passed_awaiting_confirmation', 'for_endorsement', 'endorsed',
                   'final_interview_scheduled', 'for_hiring',
                   'for_training', 'for_requirements', 'for_orientation');

commit;
