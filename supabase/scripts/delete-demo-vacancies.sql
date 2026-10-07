-- =============================================================================
-- DEMO ONLY. NOT a migration: never copy this into supabase/migrations/.
-- Deletes the two demo vacancies, Cashier (Kabayan Mart) and Store Crew (ClayGo),
-- with everything that belongs to them, so `pnpm --filter api seed:demo` can
-- create them again with the current demo values. The companies are kept.
--
-- Usage: run the whole file in the Supabase SQL editor. One transaction: if
-- either vacancy is missing (or exists twice), nothing is deleted.
--
-- Order:
--   1. The applications' dependent rows (same as reset-applications.sql):
--      notification, matching_result, application_status_history.
--      Later-slice rows cascade with the application: interview_schedule,
--      competency_rating, final_evaluation, endorsement_item,
--      post_hiring_details, talent_pool (+ its pool_invitation).
--      document_request.application_id and application.source_application_id
--      are set to null (they belong to the applicant / another application).
--      The delete fails, and rolls back, if another vacancy's evaluation reused
--      ratings from one of these applications (final_evaluation.ratings_source_application_id).
--   2. Every table that references job_vacancy (found in supabase/migrations/):
--      application      (ON DELETE RESTRICT)
--      endorsement      (ON DELETE RESTRICT; its endorsement_item rows cascade)
--      pool_invitation  (ON DELETE CASCADE, deleted explicitly anyway)
--      job_section_weight (ON DELETE CASCADE, deleted explicitly anyway)
--      (job_competency also referenced it but was dropped in 20261007000000.)
--   3. The two job_vacancy rows.
-- =============================================================================
begin;

do $$
declare
  v_cashier    uuid[];
  v_store_crew uuid[];
  v_ids        uuid[];
  v_count      int;
begin
  select array_agg(v.job_vacancy_id) into v_cashier
    from public.job_vacancy v join public.company c on c.company_id = v.company_id
   where lower(c.company_name) = 'kabayan mart' and lower(v.job_title) = 'cashier';
  select array_agg(v.job_vacancy_id) into v_store_crew
    from public.job_vacancy v join public.company c on c.company_id = v.company_id
   where lower(c.company_name) = 'claygo' and lower(v.job_title) = 'store crew';

  if coalesce(cardinality(v_cashier), 0) <> 1 then
    raise exception 'Expected exactly 1 Cashier vacancy at Kabayan Mart, found %', coalesce(cardinality(v_cashier), 0);
  end if;
  if coalesce(cardinality(v_store_crew), 0) <> 1 then
    raise exception 'Expected exactly 1 Store Crew vacancy at ClayGo, found %', coalesce(cardinality(v_store_crew), 0);
  end if;
  v_ids := v_cashier || v_store_crew;

  -- 1. Application dependents (notification.application_id is ON DELETE SET NULL, so delete explicitly).
  delete from public.notification n
   using public.application a
   where n.application_id = a.application_id and a.job_vacancy_id = any(v_ids);
  get diagnostics v_count = row_count;
  raise notice 'notification: % deleted', v_count;

  delete from public.matching_result m
   using public.application a
   where m.application_id = a.application_id and a.job_vacancy_id = any(v_ids);
  get diagnostics v_count = row_count;
  raise notice 'matching_result: % deleted', v_count;

  delete from public.application_status_history h
   using public.application a
   where h.application_id = a.application_id and a.job_vacancy_id = any(v_ids);
  get diagnostics v_count = row_count;
  raise notice 'application_status_history: % deleted', v_count;

  -- 2. Rows that reference the vacancies.
  delete from public.application where job_vacancy_id = any(v_ids);
  get diagnostics v_count = row_count;
  raise notice 'application: % deleted', v_count;

  delete from public.endorsement where job_vacancy_id = any(v_ids);
  get diagnostics v_count = row_count;
  raise notice 'endorsement: % deleted', v_count;

  delete from public.pool_invitation where job_vacancy_id = any(v_ids);
  get diagnostics v_count = row_count;
  raise notice 'pool_invitation: % deleted', v_count;

  delete from public.job_section_weight where job_vacancy_id = any(v_ids);
  get diagnostics v_count = row_count;
  raise notice 'job_section_weight: % deleted', v_count;

  -- 3. The vacancies themselves (companies are kept).
  delete from public.job_vacancy where job_vacancy_id = any(v_ids);
  get diagnostics v_count = row_count;
  raise notice 'job_vacancy: % deleted', v_count;
end
$$;

commit;
