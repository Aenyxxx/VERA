-- =============================================================================
-- DEMO RESETS ONLY. NOT a migration: never copy this into supabase/migrations/.
-- Deletes every application of ONE vacancy, with its notifications, document
-- requests, interviews, matching results and status history, so the apply flow
-- (S11) and screening/interviews (S12/S13) can be demonstrated again.
-- The vacancy, company, applicants, resumes and documents are kept.
--
-- Usage: replace the id below, then run the whole file in the Supabase SQL editor.
-- Everything runs in one transaction; an unknown id changes nothing.
--
-- Notes:
-- - The vacancy status is NOT changed. If it auto-closed at the cap, reopen it in
--   the app (Job Vacancies → Reopen).
-- - notification and document_request are ON DELETE SET NULL, so they are deleted
--   explicitly (otherwise they would stay behind without an application).
-- - interview_schedule cascades, but is deleted explicitly too (counted below).
-- - Rows from later slices (ratings, evaluations, endorsement items, post-hiring,
--   pool entries) cascade with the application. The delete fails, and rolls back,
--   if another vacancy's evaluation reused ratings from one of these applications.
-- - Applicant-level data stays: verification of resumes/documents (incl. any
--   "reupload_requested" mark from a deleted request) is per applicant, not per
--   application.
-- =============================================================================
begin;

do $$
declare
  v_vacancy uuid := '00000000-0000-0000-0000-000000000000';  -- <-- the vacancy's job_vacancy_id
  v_count   int;
begin
  if not exists (select 1 from public.job_vacancy where job_vacancy_id = v_vacancy) then
    raise exception 'No vacancy with id %', v_vacancy;
  end if;

  -- notification.application_id is ON DELETE SET NULL, so these must be deleted explicitly.
  delete from public.notification n
   using public.application a
   where n.application_id = a.application_id and a.job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  raise notice 'notification: % deleted', v_count;

  -- document_request.application_id is ON DELETE SET NULL as well (S12).
  delete from public.document_request q
   using public.application a
   where q.application_id = a.application_id and a.job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  raise notice 'document_request: % deleted', v_count;

  -- Cascades with the application; explicit so the count shows (S13).
  delete from public.interview_schedule s
   using public.application a
   where s.application_id = a.application_id and a.job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  raise notice 'interview_schedule: % deleted', v_count;

  delete from public.matching_result m
   using public.application a
   where m.application_id = a.application_id and a.job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  raise notice 'matching_result: % deleted', v_count;

  delete from public.application_status_history h
   using public.application a
   where h.application_id = a.application_id and a.job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  raise notice 'application_status_history: % deleted', v_count;

  delete from public.application where job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  raise notice 'application: % deleted', v_count;
end
$$;

commit;
