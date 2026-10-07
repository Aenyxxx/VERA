-- =============================================================================
-- VERA — One ongoing application per applicant (roadmap slice S11b, agency decision Oct 7, 2026)
--
-- Process rules (docs/PRD.md BR-17..BR-22):
--   - An applicant may have only ONE ongoing application (waiting_pool … endorsed) at a time; a hired
--     applicant cannot apply again until training_failed (BR-17).
--   - When a vacancy is filled or archived, applicants still in its waiting pool or shortlist become
--     'not_selected' (BR-22, built in S15/S16). It is a neutral final status: it frees the applicant and
--     does not block the company (BR-19).
--   - Not-selected applicants stay in the applicant pool (pool_reason 'not_selected', S17).
-- Rating reuse (BR-21, WSM-03) needs no new column: final_evaluation.ratings_source_application_id
-- already records the application whose 15 item ratings were used.
-- The same-company block (BR-19) needs no schema change: it is a query on application → job_vacancy.company_id.
--
-- Run once in the Supabase SQL Editor (after 20261007000000_competency_profile_rubric.sql).
-- Verification queries: docs/DATABASE_SCHEMA.md §7.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- 1. Safety: refuse to run while any applicant already has more than one ongoing (or hired) application.
--    Demo data from S11 testing can do this; clear it with supabase/scripts/reset-applications.sql first.
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
-- 2. New values. They are not used anywhere in this transaction (Postgres only allows using a new enum
--    value after the transaction that added it commits).
-- -----------------------------------------------------------------------------
-- Vacancy filled/archived while the application was waiting or shortlisted (BR-22). Neutral final status.
alter type public.application_status add value if not exists 'not_selected';

-- Applicant pool reason for not-selected applicants (rule 8, S17).
alter type public.pool_reason add value if not exists 'not_selected';

-- -----------------------------------------------------------------------------
-- 3. BR-17 in the database: at most one ongoing-or-hired application per applicant.
--    The API checks first (409 with a readable message); this index also stops two simultaneous applies.
--    Ongoing = is_active_application_status(); 'hired' blocks too until training_failed.
-- -----------------------------------------------------------------------------
create unique index application_one_ongoing_per_applicant on public.application (applicant_id)
  where status in ('waiting_pool', 'shortlisted', 'interview_scheduled', 'interview_confirmed',
                   'passed', 'passed_awaiting_confirmation', 'for_endorsement', 'endorsed', 'hired');

-- -----------------------------------------------------------------------------
-- 4. Document the rating-reuse link (no structural change).
-- -----------------------------------------------------------------------------
comment on column public.final_evaluation.ratings_source_application_id is
  'Application whose 15 competency_rating rows were used: this application (interviewed), or for a reused '
  'evaluation (BR-21, WSM-03) the original interviewed application, resolved through the most recent '
  'completed final_evaluation''s ratings_source_application_id, so a chain of reuses always points to the interview.';

commit;
