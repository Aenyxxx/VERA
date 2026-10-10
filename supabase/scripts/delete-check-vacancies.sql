-- =============================================================================
-- CHECK-SCRIPT CLEANUP ONLY. NOT a migration: never copy this into supabase/migrations/.
-- Deletes the throwaway vacancies created by scripts/check-s14.ps1 (and later
-- check scripts): every job_vacancy whose title starts with 'ZZ Check', with all
-- of their applications and the rows under them, then the 'ZZ Check' companies
-- that have no vacancy left. Nothing else is touched: no demo vacancy (Cashier,
-- Store Crew), no applicant account, resume, or document.
--
-- Usage: run the whole file in the Supabase SQL editor. One transaction; the
-- counts appear as notices. Stops (and changes nothing) if an application
-- outside these vacancies reused ratings from one of them.
--
-- Foreign keys that would block a delete (initial schema; checked Oct 10):
--   endorsement.job_vacancy_id  -> job_vacancy  ON DELETE RESTRICT   (deleted explicitly, S16)
--   endorsement.company_id      -> company      ON DELETE RESTRICT   (gone with the endorsements)
--   application.job_vacancy_id  -> job_vacancy  ON DELETE RESTRICT   (applications deleted first)
--   job_vacancy.company_id      -> company      ON DELETE RESTRICT   (vacancies deleted first)
--   final_evaluation.ratings_source_application_id -> application (no ON DELETE; guard + evaluations first)
-- Everything else cascades or is SET NULL (notification, document_request: deleted explicitly).
-- =============================================================================
begin;

do $$
declare
  v_vacancies uuid[];
  v_apps      uuid[];
  v_count     int;
begin
  select coalesce(array_agg(job_vacancy_id), '{}') into v_vacancies
    from public.job_vacancy where job_title like 'ZZ Check%';
  raise notice 'job_vacancy: % found (title starts with ZZ Check)', cardinality(v_vacancies);

  select coalesce(array_agg(application_id), '{}') into v_apps
    from public.application where job_vacancy_id = any(v_vacancies);
  raise notice 'application: % found', cardinality(v_apps);

  -- final_evaluation.ratings_source_application_id has no ON DELETE: an outside evaluation that reused a check
  -- application's ratings would block the delete. Stop with a clear message instead.
  if exists (
    select 1 from public.final_evaluation
     where ratings_source_application_id = any(v_apps) and not (application_id = any(v_apps))
  ) then
    raise exception 'An application outside the ZZ Check vacancies reused ratings from one of them; nothing deleted.';
  end if;

  -- ON DELETE SET NULL, so deleted explicitly (otherwise they stay without an application).
  delete from public.notification where application_id = any(v_apps);
  get diagnostics v_count = row_count;
  raise notice 'notification: % deleted', v_count;

  delete from public.document_request where application_id = any(v_apps);
  get diagnostics v_count = row_count;
  raise notice 'document_request: % deleted', v_count;

  -- S16: endorsement items (by the vacancies' endorsements AND by the vacancies' applications), then the
  -- endorsements themselves: endorsement.job_vacancy_id and endorsement.company_id are ON DELETE RESTRICT.
  delete from public.endorsement_item i
   where i.application_id = any(v_apps)
      or i.endorsement_id in (select e.endorsement_id from public.endorsement e where e.job_vacancy_id = any(v_vacancies));
  get diagnostics v_count = row_count;
  raise notice 'endorsement_item: % deleted', v_count;

  delete from public.endorsement where job_vacancy_id = any(v_vacancies);
  get diagnostics v_count = row_count;
  raise notice 'endorsement: % deleted', v_count;

  -- Before the applications: evaluations point at each other through ratings_source_application_id.
  delete from public.final_evaluation where application_id = any(v_apps);
  get diagnostics v_count = row_count;
  raise notice 'final_evaluation: % deleted', v_count;

  -- The rest cascade with the application; deleted explicitly so the counts show.
  delete from public.competency_rating where application_id = any(v_apps);
  get diagnostics v_count = row_count;
  raise notice 'competency_rating: % deleted', v_count;

  delete from public.interview_schedule where application_id = any(v_apps);
  get diagnostics v_count = row_count;
  raise notice 'interview_schedule: % deleted', v_count;

  delete from public.talent_pool where source_application_id = any(v_apps);
  get diagnostics v_count = row_count;
  raise notice 'talent_pool: % deleted', v_count;

  delete from public.post_hiring_details where application_id = any(v_apps);
  get diagnostics v_count = row_count;
  raise notice 'post_hiring_details: % deleted', v_count;

  delete from public.matching_result where application_id = any(v_apps);
  get diagnostics v_count = row_count;
  raise notice 'matching_result: % deleted', v_count;

  delete from public.application_status_history where application_id = any(v_apps);
  get diagnostics v_count = row_count;
  raise notice 'application_status_history: % deleted', v_count;

  delete from public.application where application_id = any(v_apps);
  get diagnostics v_count = row_count;
  raise notice 'application: % deleted', v_count;

  delete from public.job_section_weight where job_vacancy_id = any(v_vacancies);
  get diagnostics v_count = row_count;
  raise notice 'job_section_weight: % deleted', v_count;

  -- Cascades with the vacancy (and with its pool entry); explicit so the count shows. Unused during the sprint.
  delete from public.pool_invitation where job_vacancy_id = any(v_vacancies);
  get diagnostics v_count = row_count;
  raise notice 'pool_invitation: % deleted', v_count;

  delete from public.job_vacancy where job_vacancy_id = any(v_vacancies);
  get diagnostics v_count = row_count;
  raise notice 'job_vacancy: % deleted', v_count;

  delete from public.company c
   where c.company_name like 'ZZ Check%'
     and not exists (select 1 from public.job_vacancy v where v.company_id = c.company_id);
  get diagnostics v_count = row_count;
  raise notice 'company: % deleted (name starts with ZZ Check, no vacancy left)', v_count;
end
$$;

commit;
