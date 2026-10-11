-- =============================================================================
-- DEMO RESETS ONLY. NOT a migration: never copy this into supabase/migrations/.
-- Deletes every application of ONE vacancy, with its notifications, document
-- requests, endorsements and endorsement items, rematch offers, evaluations,
-- ratings, applicant-pool entries, interviews, matching results and status
-- history, so the apply flow (S11), screening/interviews (S12/S13),
-- evaluation/ranking (S14/S15), endorsement/outcomes (S16) and the rematch (S17)
-- can be demonstrated again. The vacancy, company, applicants, resumes and
-- documents are kept.
--
-- NEVER for Cashier (dc4c5084-7d53-4da9-933e-e6ec91f492db): it holds the
-- live-defense applicant. The first statement refuses that id, before anything
-- is written.
--
-- Usage: replace the id below, then run the whole file in the Supabase SQL editor.
-- Everything runs in one transaction; an unknown id changes nothing. The SQL
-- editor does not show NOTICE output, so the script ends with ONE result: the
-- rows deleted per table, and the ids of applicant-pool entries left closed.
--
-- Notes:
-- - The vacancy status is NOT changed. It is left as it was:
--     open      -> nothing to do.
--     closed    -> reopen it in the app (Job Vacancies -> Reopen; raise the cap if asked).
--     endorsing -> reopen it in the app (Reopen works from endorsing too).
--     filled / archived -> the app cannot reopen it (APP_FLOW §5.2). For a demo vacancy, re-create it:
--                  supabase/scripts/delete-demo-vacancies.sql, then pnpm --filter api seed:demo.
-- - Endorsements of this vacancy (S16) are deleted explicitly, items first:
--   endorsement.job_vacancy_id is ON DELETE RESTRICT (it never cascades).
-- - Rematch offers (S17, pool_invitation) are deleted when they are offers OF this
--   vacancy, point at one of its applications (application_id /
--   ratings_source_application_id are ON DELETE SET NULL), or were made from a pool
--   entry that came from one of its applications.
-- - An applicant who ACCEPTED an offer of this vacancy had their earlier pool entry
--   closed (availability 'reapplied'). The script does not reopen it; it lists the
--   entry ids in the result ("pool entry left closed").
-- - notification and document_request are ON DELETE SET NULL, so they are deleted
--   explicitly (otherwise they would stay behind without an application).
-- - interview_schedule cascades, but is deleted explicitly too (counted below).
-- - Evaluations, ratings and applicant-pool entries (S14/S15) are deleted explicitly,
--   evaluations first (their ratings_source_application_id has no ON DELETE). The
--   script stops, and changes nothing, if another vacancy's evaluation reused
--   ratings from one of these applications. Post-hiring rows cascade with the
--   application (the form is cut, so there are none during the sprint).
-- - Deleting a pool entry does not bring back an earlier entry it replaced.
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
  -- Cashier guard: the FIRST statement, before any delete or update.
  if v_vacancy = 'dc4c5084-7d53-4da9-933e-e6ec91f492db'::uuid then
    raise exception 'Cashier (dc4c5084-7d53-4da9-933e-e6ec91f492db) holds the live-defense applicant: this script never resets it. Nothing changed.';
  end if;

  if not exists (select 1 from public.job_vacancy where job_vacancy_id = v_vacancy) then
    raise exception 'No vacancy with id %', v_vacancy;
  end if;

  -- final_evaluation.ratings_source_application_id has no ON DELETE: an evaluation at ANOTHER vacancy that reused
  -- ratings from one of these applications (BR-21) would block the delete. Stop with a clear message instead.
  if exists (
    select 1
      from public.final_evaluation fe
      join public.application src on src.application_id = fe.ratings_source_application_id
      join public.application own on own.application_id = fe.application_id
     where src.job_vacancy_id = v_vacancy and own.job_vacancy_id <> v_vacancy
  ) then
    raise exception 'Another vacancy''s evaluation reused ratings from this vacancy; nothing deleted.';
  end if;

  -- The result table (this session only), read by the SELECT at the end of the file.
  drop table if exists pg_temp.reset_report;
  create temp table reset_report (step int not null, item text not null, detail text not null);

  -- Pool entries closed by an ACCEPTED offer of this vacancy (S17) stay closed: listed, not reopened. Entries that
  -- came from this vacancy's own applications are deleted below, so they are not listed.
  insert into pg_temp.reset_report (step, item, detail)
  select 100, 'pool entry left closed (reapplied)', tp.talent_pool_id::text
    from public.pool_invitation pi
    join public.talent_pool tp on tp.talent_pool_id = pi.talent_pool_id
    join public.application acc on acc.application_id = pi.application_id
    left join public.application src on src.application_id = tp.source_application_id
   where acc.job_vacancy_id = v_vacancy
     and pi.status = 'accepted'
     and tp.removed_at is not null
     and src.job_vacancy_id is distinct from v_vacancy;

  -- notification.application_id is ON DELETE SET NULL, so these must be deleted explicitly.
  delete from public.notification n
   using public.application a
   where n.application_id = a.application_id and a.job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  insert into pg_temp.reset_report values (1, 'notification', v_count::text);

  -- document_request.application_id is ON DELETE SET NULL as well (S12).
  delete from public.document_request q
   using public.application a
   where q.application_id = a.application_id and a.job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  insert into pg_temp.reset_report values (2, 'document_request', v_count::text);

  -- S16: endorsement items (by this vacancy's endorsements AND by its applications), then the endorsements:
  -- endorsement.job_vacancy_id is ON DELETE RESTRICT, and its items would block the endorsement delete otherwise.
  delete from public.endorsement_item i
   where i.endorsement_id in (select e.endorsement_id from public.endorsement e where e.job_vacancy_id = v_vacancy)
      or i.application_id in (select a.application_id from public.application a where a.job_vacancy_id = v_vacancy);
  get diagnostics v_count = row_count;
  insert into pg_temp.reset_report values (3, 'endorsement_item', v_count::text);

  delete from public.endorsement where job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  insert into pg_temp.reset_report values (4, 'endorsement', v_count::text);

  -- S17: rematch offers of this vacancy, pointing at its applications, or made from its applications' pool entries.
  -- Before the evaluations, pool entries, and applications (their links to applications are ON DELETE SET NULL).
  delete from public.pool_invitation pi
   where pi.job_vacancy_id = v_vacancy
      or pi.application_id in (select a.application_id from public.application a where a.job_vacancy_id = v_vacancy)
      or pi.ratings_source_application_id in (select a.application_id from public.application a where a.job_vacancy_id = v_vacancy)
      or pi.talent_pool_id in (select tp.talent_pool_id
                                 from public.talent_pool tp
                                 join public.application a on a.application_id = tp.source_application_id
                                where a.job_vacancy_id = v_vacancy);
  get diagnostics v_count = row_count;
  insert into pg_temp.reset_report values (5, 'pool_invitation', v_count::text);

  -- S14/S15: evaluations BEFORE the applications (and before competency_rating): evaluations of this vacancy may
  -- point at each other through ratings_source_application_id, which has no ON DELETE.
  delete from public.final_evaluation fe
   using public.application a
   where fe.application_id = a.application_id and a.job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  insert into pg_temp.reset_report values (6, 'final_evaluation', v_count::text);

  -- Cascades with the application; explicit so the counts show (S14/S15).
  delete from public.competency_rating r
   using public.application a
   where r.application_id = a.application_id and a.job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  insert into pg_temp.reset_report values (7, 'competency_rating', v_count::text);

  delete from public.talent_pool t
   using public.application a
   where t.source_application_id = a.application_id and a.job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  insert into pg_temp.reset_report values (8, 'talent_pool', v_count::text);

  -- Cascades with the application; explicit so the count shows (S13).
  delete from public.interview_schedule s
   using public.application a
   where s.application_id = a.application_id and a.job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  insert into pg_temp.reset_report values (9, 'interview_schedule', v_count::text);

  delete from public.matching_result m
   using public.application a
   where m.application_id = a.application_id and a.job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  insert into pg_temp.reset_report values (10, 'matching_result', v_count::text);

  delete from public.application_status_history h
   using public.application a
   where h.application_id = a.application_id and a.job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  insert into pg_temp.reset_report values (11, 'application_status_history', v_count::text);

  delete from public.application where job_vacancy_id = v_vacancy;
  get diagnostics v_count = row_count;
  insert into pg_temp.reset_report values (12, 'application', v_count::text);
end
$$;

commit;

-- The result: rows deleted per table (in deletion order), then the pool entries left closed (ids only).
select item, detail from pg_temp.reset_report order by step, detail;
