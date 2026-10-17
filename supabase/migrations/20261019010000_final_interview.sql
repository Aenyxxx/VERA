-- =============================================================================
-- VERA — final interview (Phase 2, decisions 14 and 15, confirmed Oct 13, 2026)
--
-- Both new statuses are ONGOING (PRD BR-17): the applicant is still with the client.
--   1. the same safety check as 20261010020000 (refuse while any applicant has more than one ongoing-or-hired
--      application);
--   2. is_active_application_status() and the two literal-list indexes gain the new values (dropped and rebuilt in
--      this transaction; every endorsed row stays inside the new predicates);
--   3. endorsement_item.final_interview_details, the only missing column: the final interview time reuses
--      endorsement_item.client_interview_at (until now optional and recorded with the outcome).
-- No existing row changes.
--
-- Run once in the Supabase SQL Editor AFTER 20261019000000_final_interview_values.sql, then restart `pnpm dev`.
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
                            'final_interview_scheduled', 'for_hiring', 'hired')
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
    'final_interview_scheduled', 'for_hiring'
  );
$$;

-- One ongoing-or-hired application per applicant (BR-17); same list as @vera/shared BLOCKS_APPLYING_STATUSES.
drop index if exists public.application_one_ongoing_per_applicant;
create unique index application_one_ongoing_per_applicant on public.application (applicant_id)
  where status in ('waiting_pool', 'shortlisted', 'interview_scheduled', 'interview_confirmed',
                   'passed', 'passed_awaiting_confirmation', 'for_endorsement', 'endorsed',
                   'final_interview_scheduled', 'for_hiring', 'hired');

drop index if exists public.application_active_idx;
create index application_active_idx on public.application (applicant_id)
  where status in ('waiting_pool', 'shortlisted', 'interview_scheduled', 'interview_confirmed',
                   'passed', 'passed_awaiting_confirmation', 'for_endorsement', 'endorsed',
                   'final_interview_scheduled', 'for_hiring');

-- -----------------------------------------------------------------------------
-- 3. Final interview details (decision 14).
-- -----------------------------------------------------------------------------
alter table public.endorsement_item add column if not exists final_interview_details text;

comment on column public.endorsement_item.client_interview_at is
  'Decision 14: the client''s final interview time, set by HR (Schedule final interview) and sent to the applicant. '
  'Before Oct 2026 it was optional and recorded with the outcome.';
comment on column public.endorsement_item.final_interview_details is
  'Decision 14: HR''s instructions for the final interview (never the company name), sent to the applicant.';

commit;
