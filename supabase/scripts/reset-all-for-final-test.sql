-- =============================================================================
-- ONE-OFF RESET FOR THE FINAL TEST. NOT a migration: never copy this into supabase/migrations/.
-- Run it yourself in the Supabase SQL Editor (Claude never runs it).
--
-- Leaves a clean start. KEPT:
--   - the two staff accounts admin@vera.test (admin) and hr.vera@email.test (hr): their auth.users rows (passwords
--     unchanged), their auth identities / sessions, and their user_account rows;
--   - the Competency Profile (competency, competency_section) and system_setting;
--   - the schema itself (tables, enums, functions, triggers, views, RLS).
-- DELETED: every other row in the public schema (companies, vacancies, applicants, resumes, documents, applications
-- and everything under them, notifications, pool entries, offers and invitations, endorsements), every other
-- user_account (all applicants, every other HR / admin, incl. old zz-check-p4-hr-* accounts) and their auth.users rows
-- (auth.identities, sessions and refresh tokens of those users cascade from auth.users).
--
-- Every public table (26), accounted for:
--   kept (3):      competency, competency_section, system_setting
--   filtered (1):  user_account (only the two accounts above)
--   emptied (22):  notification, application_document, document_request, endorsement_item, endorsement,
--                  pool_invitation, final_evaluation, competency_rating, post_hiring_details, talent_pool,
--                  interview_schedule, matching_result, application_status_history, application,
--                  job_section_weight, job_vacancy, company, resume_extraction, resume, supporting_document,
--                  resume_draft, applicant
--   (job_competency was dropped by 20261007000000; the views v_applicant_profile / v_latest_competency_rating hold
--   no data.) auth.users is filtered to the same two accounts.
--
-- Foreign keys from KEPT rows to accounts, handled before the account delete (both are ON DELETE SET NULL; set
-- explicitly so the script says what happened):
--   system_setting.updated_by  -> null when it points to an account being deleted (kept when admin or HR)
--   user_account.created_by    -> null on the two kept rows when it points to an account being deleted
-- competency and competency_section have no account columns.
--
-- Usage:
--   1. Type the confirmation phrase into v_confirm below (exactly: RESET EVERYTHING EXCEPT ADMIN AND HR).
--   2. Run the whole file. One transaction: if a guard or the final check fails, NOTHING is changed.
--   3. The SQL Editor hides NOTICE output, so the script ends with ONE result: rows deleted per table, then the
--      remaining counts (expected: user_account 2, auth.users 2, 0 for every emptied table).
--
-- !!! STORAGE FILES ARE NOT DELETED BY SQL !!!
-- After the script succeeds, empty the two buckets in the Supabase dashboard:
--   Storage -> resumes   -> select all (incl. the drafts/ folder) -> Delete
--   Storage -> documents -> select all -> Delete
-- (Files left there are orphans: no row points to them any more. The endorsements bucket is unused: packets are
-- never stored.)
-- =============================================================================
begin;

do $$
declare
  v_confirm constant text := '';   -- <-- type: RESET EVERYTHING EXCEPT ADMIN AND HR
  c_phrase  constant text := 'RESET EVERYTHING EXCEPT ADMIN AND HR';
  v_admin   uuid;
  v_hr      uuid;
  v_role    public.user_role;
  v_count   bigint;
  v_table   text;
  v_bad     text := '';
  v_emptied constant text[] := array[
    'notification', 'application_document', 'document_request', 'endorsement_item', 'endorsement',
    'pool_invitation', 'final_evaluation', 'competency_rating', 'post_hiring_details', 'talent_pool',
    'interview_schedule', 'matching_result', 'application_status_history', 'application',
    'job_section_weight', 'job_vacancy', 'company', 'resume_extraction', 'resume', 'supporting_document',
    'resume_draft', 'applicant'];
begin
  -- ---------------------------------------------------------------- guards: before ANY write
  if v_confirm is distinct from c_phrase then
    raise exception 'Confirmation missing: set v_confirm to ''%'' at the top of the script. Nothing changed.', c_phrase;
  end if;

  select user_account_id, role into v_admin, v_role
    from public.user_account where lower(email) = 'admin@vera.test';
  if v_admin is null then
    raise exception 'admin@vera.test does not exist in user_account. Nothing changed.';
  end if;
  if v_role <> 'admin' then
    raise exception 'admin@vera.test has role %, expected admin. Nothing changed.', v_role;
  end if;

  select user_account_id, role into v_hr, v_role
    from public.user_account where lower(email) = 'hr.vera@email.test';
  if v_hr is null then
    raise exception 'hr.vera@email.test does not exist in user_account. Nothing changed.';
  end if;
  if v_role <> 'hr' then
    raise exception 'hr.vera@email.test has role %, expected hr. Nothing changed.', v_role;
  end if;

  if (select count(*) from auth.users where id in (v_admin, v_hr)) <> 2 then
    raise exception 'admin@vera.test or hr.vera@email.test has no auth.users row. Nothing changed.';
  end if;

  drop table if exists pg_temp.final_reset_report;
  create temp table final_reset_report (step int not null, section text not null, item text not null,
                                        value bigint not null, expected text not null);

  -- ---------------------------------------------------------------- deletes, children first (explicit + counted)
  -- Notifications and document requests are ON DELETE SET NULL / RESTRICT towards application and user_account:
  -- deleted first, explicitly.
  delete from public.notification;
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (1, 'deleted', 'notification', v_count, '');

  delete from public.application_document;            -- restrict towards supporting_document
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (2, 'deleted', 'application_document', v_count, '');

  delete from public.document_request;                -- requested_by is ON DELETE RESTRICT
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (3, 'deleted', 'document_request', v_count, '');

  delete from public.endorsement_item;
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (4, 'deleted', 'endorsement_item', v_count, '');

  delete from public.endorsement;                     -- restrict towards job_vacancy and company
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (5, 'deleted', 'endorsement', v_count, '');

  delete from public.pool_invitation;                 -- rematch offers and job invitations
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (6, 'deleted', 'pool_invitation', v_count, '');

  delete from public.final_evaluation;                -- ratings_source_application_id has no ON DELETE
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (7, 'deleted', 'final_evaluation', v_count, '');

  delete from public.competency_rating;               -- rated_by is ON DELETE RESTRICT
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (8, 'deleted', 'competency_rating', v_count, '');

  delete from public.post_hiring_details;
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (9, 'deleted', 'post_hiring_details', v_count, '');

  delete from public.talent_pool;
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (10, 'deleted', 'talent_pool', v_count, '');

  delete from public.interview_schedule;
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (11, 'deleted', 'interview_schedule', v_count, '');

  delete from public.matching_result;
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (12, 'deleted', 'matching_result', v_count, '');

  delete from public.application_status_history;
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (13, 'deleted', 'application_status_history', v_count, '');

  delete from public.application;                     -- resume_id has no ON DELETE: before resume
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (14, 'deleted', 'application', v_count, '');

  delete from public.job_section_weight;              -- deferred total check accepts 0
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (15, 'deleted', 'job_section_weight', v_count, '');

  delete from public.job_vacancy;                     -- restrict towards company
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (16, 'deleted', 'job_vacancy', v_count, '');

  delete from public.company;
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (17, 'deleted', 'company', v_count, '');

  delete from public.resume_extraction;
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (18, 'deleted', 'resume_extraction', v_count, '');

  delete from public.resume;
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (19, 'deleted', 'resume', v_count, '');

  delete from public.supporting_document;
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (20, 'deleted', 'supporting_document', v_count, '');

  delete from public.resume_draft;
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (21, 'deleted', 'resume_draft', v_count, '');

  delete from public.applicant;
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (22, 'deleted', 'applicant', v_count, '');

  -- ---------------------------------------------------------------- kept rows that point at accounts being deleted
  update public.system_setting set updated_by = null
   where updated_by is not null and updated_by not in (v_admin, v_hr);
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (23, 'cleared', 'system_setting.updated_by -> null', v_count, '');

  update public.user_account set created_by = null
   where user_account_id in (v_admin, v_hr) and created_by is not null and created_by not in (v_admin, v_hr);
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (24, 'cleared', 'user_account.created_by (kept rows) -> null', v_count, '');

  -- ---------------------------------------------------------------- accounts: everyone except the two
  delete from public.user_account where user_account_id not in (v_admin, v_hr);
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (25, 'deleted', 'user_account (all but admin + hr)', v_count, '');

  select count(*) into v_count from auth.identities where user_id not in (v_admin, v_hr);
  insert into pg_temp.final_reset_report values (26, 'deleted', 'auth.identities (cascade from auth.users)', v_count, '');

  delete from auth.users where id not in (v_admin, v_hr);   -- identities, sessions, refresh tokens cascade
  get diagnostics v_count = row_count;
  insert into pg_temp.final_reset_report values (27, 'deleted', 'auth.users (all but admin + hr)', v_count, '');

  -- ---------------------------------------------------------------- remaining counts + final check (rolls back on failure)
  select count(*) into v_count from public.user_account;
  insert into pg_temp.final_reset_report values (100, 'remaining', 'user_account', v_count, '2');
  if v_count <> 2 then v_bad := v_bad || ' user_account=' || v_count; end if;

  select count(*) into v_count from auth.users;
  insert into pg_temp.final_reset_report values (101, 'remaining', 'auth.users', v_count, '2');
  if v_count <> 2 then v_bad := v_bad || ' auth.users=' || v_count; end if;

  select count(*) into v_count from auth.identities;
  insert into pg_temp.final_reset_report values (102, 'remaining', 'auth.identities (of admin + hr)', v_count, 'kept');

  for i in 1 .. array_length(v_emptied, 1) loop
    v_table := v_emptied[i];
    execute format('select count(*) from public.%I', v_table) into v_count;
    insert into pg_temp.final_reset_report values (102 + i, 'remaining', v_table, v_count, '0');
    if v_count <> 0 then v_bad := v_bad || ' ' || v_table || '=' || v_count; end if;
  end loop;

  select count(*) into v_count from public.competency;
  insert into pg_temp.final_reset_report values (200, 'remaining', 'competency', v_count, 'kept');
  select count(*) into v_count from public.competency_section;
  insert into pg_temp.final_reset_report values (201, 'remaining', 'competency_section', v_count, 'kept');
  select count(*) into v_count from public.system_setting;
  insert into pg_temp.final_reset_report values (202, 'remaining', 'system_setting', v_count, 'kept');

  if v_bad <> '' then
    raise exception 'Final check failed (rolled back, nothing changed):%', v_bad;
  end if;
end
$$;

commit;

-- The ONE result: rows deleted / cleared per table, then the remaining counts with the expected value.
select section, item, value, expected from pg_temp.final_reset_report order by step;
