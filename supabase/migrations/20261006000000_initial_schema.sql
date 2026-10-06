-- =============================================================================
-- VERA — Initial schema
-- Target: Supabase (PostgreSQL 15+)
-- Source of truth for docs/DATABASE_SCHEMA.md. Change the schema ONLY through
-- new migration files; never edit this file after it has been applied.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enums
-- -----------------------------------------------------------------------------
create type public.user_role            as enum ('admin', 'hr', 'applicant');
create type public.account_status       as enum ('active', 'inactive');
create type public.gender_type          as enum ('male', 'female');
create type public.gender_requirement   as enum ('any', 'male', 'female');

-- Declared lowest -> highest so comparisons like  education_level >= 'senior_high'  work.
create type public.education_level as enum (
  'elementary',
  'junior_high',
  'senior_high',
  'vocational',
  'college_undergraduate',
  'college_graduate',
  'postgraduate'
);

create type public.vacancy_status as enum (
  'draft',       -- being prepared, not visible to applicants
  'open',        -- visible, accepting applications
  'closed',      -- not accepting applications (cap reached or paused); hidden
  'endorsing',   -- endorsement ongoing; hidden
  'filled',      -- all slots filled; kept as a record
  'archived'     -- manually archived
);

create type public.applicant_type     as enum ('first_time', 'experienced');
create type public.application_source as enum ('direct', 'talent_pool');

-- Full lifecycle of ONE application (applicant x vacancy). See docs/APP_FLOW.md.
create type public.application_status as enum (
  'prescreen_failed',              -- failed basic conditions (age, gender, education, height)
  'below_threshold',               -- matching score below the vacancy threshold
  'waiting_pool',                  -- scored, waiting to be shortlisted
  'shortlisted',                   -- in Resume Screening (document verification)
  'interview_scheduled',           -- schedule sent, awaiting applicant confirmation
  'interview_confirmed',           -- applicant confirmed; other applications terminated
  'did_not_pass',                  -- final score below passing score
  'passed',                        -- final score >= passing score, not yet notified
  'passed_awaiting_confirmation',  -- notified, must confirm within the deadline
  'for_endorsement',               -- confirmed, will be endorsed
  'endorsed',                      -- included in a sent endorsement
  'hired',                         -- hired by the client company
  'not_hired',                     -- not hired by the client company
  'training_failed',               -- hired but failed client training
  'standby',                       -- passed but outside the endorsement count
  'terminated',                    -- closed because the applicant confirmed another interview
  'dropped',                       -- no response / failed verification / interview no-show
  'archived'                       -- declined (or ignored) the endorsement confirmation
);

create type public.verification_status as enum ('pending', 'verified', 'rejected', 'reupload_requested');

create type public.document_type as enum (
  'resume',                -- only used by document_request (re-upload of the resume)
  'transcript_of_records',
  'diploma',
  'nbi_clearance',
  'police_clearance',
  'barangay_clearance',
  'valid_id',
  'birth_certificate',
  'certificate',
  'medical_certificate',
  'other'
);

create type public.request_status      as enum ('pending', 'fulfilled', 'expired', 'cancelled');
create type public.interview_status    as enum (
  'pending_confirmation', 'confirmed', 'reschedule_requested', 'rescheduled',
  'completed', 'no_show', 'expired', 'cancelled'
);
create type public.endorsement_status  as enum ('draft', 'sent');
create type public.endorsement_outcome as enum ('pending', 'hired', 'not_hired');
create type public.training_status     as enum ('pending', 'passed', 'failed');
create type public.pool_reason         as enum ('did_not_pass', 'standby', 'not_hired', 'training_failed');
create type public.pool_availability   as enum ('available', 'invited', 'reapplied', 'unavailable');
create type public.invitation_status   as enum ('pending', 'accepted', 'declined', 'expired');
create type public.email_status        as enum ('not_required', 'pending', 'sent', 'failed');

-- -----------------------------------------------------------------------------
-- 2. Helper functions
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Applications that block resume replacement and count as "in progress".
create or replace function public.is_active_application_status(s public.application_status)
returns boolean language sql immutable as $$
  select s in (
    'waiting_pool', 'shortlisted', 'interview_scheduled', 'interview_confirmed',
    'passed', 'passed_awaiting_confirmation', 'for_endorsement', 'endorsed'
  );
$$;

-- The API sets  SET LOCAL vera.actor_id = '<uuid>'  inside each transaction so
-- triggers can record who made a change. Null means "system" (scheduled job).
create or replace function public.current_actor_id()
returns uuid language sql stable as $$
  select nullif(current_setting('vera.actor_id', true), '')::uuid;
$$;

-- -----------------------------------------------------------------------------
-- 3. Accounts
-- -----------------------------------------------------------------------------
create table public.user_account (
  user_account_id uuid primary key references auth.users (id) on delete cascade,
  email           text not null,
  role            public.user_role not null default 'applicant',
  full_name       text,                                   -- staff display name
  account_status  public.account_status not null default 'active',
  auth_provider   text not null default 'email',          -- 'email' | 'google'
  last_login_at   timestamptz,
  created_by      uuid references public.user_account (user_account_id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index user_account_email_key on public.user_account (lower(email));
create index user_account_role_idx on public.user_account (role);

-- Creates the app account only once the email is confirmed
-- (OTP code for email sign-up; Google and admin-created users are confirmed on insert).
-- The role comes from app_metadata.vera_role, which only the service role can set.
create or replace function public.handle_confirmed_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_account (user_account_id, email, role, auth_provider, full_name)
  values (
    new.id,
    new.email,
    coalesce((new.raw_app_meta_data ->> 'vera_role')::public.user_role, 'applicant'),
    coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (user_account_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row when (new.email_confirmed_at is not null)
  execute function public.handle_confirmed_auth_user();

create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_confirmed_auth_user();

-- -----------------------------------------------------------------------------
-- 4. Applicant profile, resume, documents
-- -----------------------------------------------------------------------------
-- Created only when the applicant confirms the auto-filled profile card.
create table public.applicant (
  applicant_id         uuid primary key default gen_random_uuid(),
  user_account_id      uuid not null unique references public.user_account (user_account_id) on delete cascade,
  first_name           text not null,
  middle_name          text,
  last_name            text not null,
  suffix               text,
  contact_number       text,
  birthdate            date not null,                     -- age is always computed, never stored
  gender               public.gender_type not null,
  height_cm            numeric(5, 1),
  address_line         text not null,                     -- house no. / street
  city                 text not null,                     -- municipality / city
  province             text not null,
  education_level      public.education_level not null,
  profile_confirmed_at timestamptz not null default now(),   -- birthdate-in-the-past is validated in the API
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Holds the uploaded file + extraction between "upload & parse" and "confirm profile".
-- One row per user; replaced on every new parse; deleted once confirmed.
create table public.resume_draft (
  user_account_id   uuid primary key references public.user_account (user_account_id) on delete cascade,
  file_path         text not null,                        -- storage: resumes/drafts/<user_id>/<uuid>.pdf
  original_filename text not null,
  file_size_bytes   integer not null check (file_size_bytes > 0),
  extraction        jsonb not null,                       -- raw response of svc /extract
  created_at        timestamptz not null default now()
);

create table public.resume (
  resume_id            uuid primary key default gen_random_uuid(),
  applicant_id         uuid not null references public.applicant (applicant_id) on delete cascade,
  file_path            text not null,                     -- storage: resumes/<applicant_id>/<uuid>.pdf
  original_filename    text not null,
  file_size_bytes      integer not null check (file_size_bytes > 0),
  mime_type            text not null default 'application/pdf',
  is_current           boolean not null default true,
  verification_status  public.verification_status not null default 'pending',
  verified_by          uuid references public.user_account (user_account_id) on delete set null,
  verified_at          timestamptz,
  verification_remarks text,
  uploaded_at          timestamptz not null default now(),
  archived_at          timestamptz                        -- set when replaced but kept (used by an application)
);
create unique index resume_one_current_per_applicant on public.resume (applicant_id) where is_current;

create table public.resume_extraction (
  resume_extraction_id uuid primary key default gen_random_uuid(),
  resume_id            uuid not null unique references public.resume (resume_id) on delete cascade,
  raw_text             text,
  standardized_text    text not null,
  sections             jsonb not null default '{}'::jsonb, -- split_sections output
  skills_text          text,
  experience_text      text,
  years_experience     numeric(4, 1),
  extracted_profile    jsonb not null default '{}'::jsonb, -- name, birthdate, gender, address... as extracted
  warnings             jsonb not null default '[]'::jsonb,
  extractor_version    text,
  extracted_at         timestamptz not null default now()
);

create table public.supporting_document (
  supporting_document_id uuid primary key default gen_random_uuid(),
  applicant_id           uuid not null references public.applicant (applicant_id) on delete cascade,
  document_type          public.document_type not null,
  label                  text,                            -- required when document_type = 'other'
  file_path              text not null,                   -- storage: documents/<applicant_id>/<uuid>.pdf
  original_filename      text not null,
  file_size_bytes        integer not null check (file_size_bytes > 0),
  mime_type              text not null default 'application/pdf',
  is_current             boolean not null default true,
  verification_status    public.verification_status not null default 'pending',
  verified_by            uuid references public.user_account (user_account_id) on delete set null,
  verified_at            timestamptz,
  verification_remarks   text,
  uploaded_at            timestamptz not null default now(),
  replaced_at            timestamptz,
  constraint supporting_document_not_resume check (document_type <> 'resume'),
  constraint supporting_document_other_label check (document_type <> 'other' or label is not null)
);
create index supporting_document_applicant_idx on public.supporting_document (applicant_id) where is_current;

-- -----------------------------------------------------------------------------
-- 5. Companies, competencies, vacancies
-- -----------------------------------------------------------------------------
create table public.company (
  company_id              uuid primary key default gen_random_uuid(),
  company_name            text not null,
  industry                text not null,
  description             text,
  website                 text,
  contact_person_name     text not null,
  contact_person_position text,
  contact_email           text not null,
  contact_number          text,
  is_active               boolean not null default true,
  created_by              uuid references public.user_account (user_account_id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create unique index company_name_key on public.company (lower(company_name));

-- Fixed competency list maintained by the administrator.
create table public.competency (
  competency_id   uuid primary key default gen_random_uuid(),
  competency_name text not null,
  description     text,
  is_active       boolean not null default true,
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now()
);
create unique index competency_name_key on public.competency (lower(competency_name));

create table public.job_vacancy (
  job_vacancy_id         uuid primary key default gen_random_uuid(),
  company_id             uuid not null references public.company (company_id) on delete restrict,
  job_title              text not null,
  job_description        text not null,
  key_responsibilities   text not null,                   -- one per line
  required_skills        text not null,                   -- one per line; matcher input
  experience_requirement text,                            -- title on line 1, duties after; matcher input
  min_years_experience   smallint not null default 0 check (min_years_experience >= 0),
  -- Prescreening (hard filters, checked against the applicant profile)
  min_age                smallint check (min_age is null or min_age >= 15),
  max_age                smallint,
  gender_requirement     public.gender_requirement not null default 'any',
  min_education_level    public.education_level,
  min_height_cm          numeric(5, 1),
  -- Posting details
  deployment_location    text,
  employment_type        text,
  -- Pipeline configuration
  slots_needed           smallint not null check (slots_needed > 0),
  shortlist_per_group    smallint generated always as ((slots_needed * 2)::smallint) stored,  -- fixed by the system
  application_cap        integer not null,
  endorsement_count      smallint not null,
  matching_threshold     numeric(5, 2) not null default 40 check (matching_threshold between 0 and 100),
  passing_score          numeric(5, 2) not null check (passing_score between 0 and 100),
  status                 public.vacancy_status not null default 'draft',
  posted_at              timestamptz,
  closed_at              timestamptz,
  filled_at              timestamptz,
  created_by             uuid references public.user_account (user_account_id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint job_vacancy_age_range check (min_age is null or max_age is null or max_age >= min_age),
  constraint job_vacancy_cap_covers_shortlist check (application_cap >= slots_needed * 4),
  constraint job_vacancy_endorsement_covers_slots check (endorsement_count >= slots_needed)
);
create index job_vacancy_status_idx  on public.job_vacancy (status);
create index job_vacancy_company_idx on public.job_vacancy (company_id);

create table public.job_competency (
  job_competency_id uuid primary key default gen_random_uuid(),
  job_vacancy_id    uuid not null references public.job_vacancy (job_vacancy_id) on delete cascade,
  competency_id     uuid not null references public.competency (competency_id) on delete restrict,
  weight            numeric(5, 2) not null check (weight > 0 and weight <= 100),  -- percent
  unique (job_vacancy_id, competency_id)
);

-- Weights of a vacancy must total exactly 100 (or 0 while still a draft with none).
-- Deferred, so all weights can be inserted/updated in one transaction.
create or replace function public.check_job_competency_weights()
returns trigger language plpgsql as $$
declare
  v_job   uuid;
  v_total numeric;
begin
  if tg_op = 'DELETE' then
    v_job := old.job_vacancy_id;
  else
    v_job := new.job_vacancy_id;
  end if;

  select coalesce(sum(weight), 0) into v_total
  from public.job_competency
  where job_vacancy_id = v_job;

  if v_total <> 0 and v_total <> 100 then
    raise exception 'Competency weights for vacancy % must total 100 (currently %)', v_job, v_total
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create constraint trigger job_competency_weights_total
  after insert or update or delete on public.job_competency
  deferrable initially deferred
  for each row execute function public.check_job_competency_weights();

-- -----------------------------------------------------------------------------
-- 6. Applications and the pipeline
-- -----------------------------------------------------------------------------
create table public.application (
  application_id          uuid primary key default gen_random_uuid(),
  applicant_id            uuid not null references public.applicant (applicant_id) on delete cascade,
  job_vacancy_id          uuid not null references public.job_vacancy (job_vacancy_id) on delete restrict,
  resume_id               uuid not null references public.resume (resume_id),                    -- no action: checked at statement end
  applicant_type          public.applicant_type not null,         -- radio button at apply time
  application_source      public.application_source not null default 'direct',
  source_application_id   uuid references public.application (application_id) on delete set null,  -- talent-pool reuse
  status                  public.application_status not null,
  status_reason           text,
  verification_started_at timestamptz,                            -- locks the shortlist slot
  action_due_at           timestamptz,                            -- deadline of the applicant's pending action on the application itself (endorsement confirmation)
  applied_at              timestamptz not null default now(),
  status_changed_at       timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (applicant_id, job_vacancy_id)                          -- one application per job, ever
);
create index application_job_status_idx       on public.application (job_vacancy_id, status);
create index application_job_type_status_idx  on public.application (job_vacancy_id, applicant_type, status);
create index application_applicant_status_idx on public.application (applicant_id, status);
create index application_action_due_idx       on public.application (action_due_at) where action_due_at is not null;
create index application_active_idx           on public.application (applicant_id)
  where status in ('waiting_pool', 'shortlisted', 'interview_scheduled', 'interview_confirmed',
                   'passed', 'passed_awaiting_confirmation', 'for_endorsement', 'endorsed');

create table public.application_status_history (
  history_id     bigint generated always as identity primary key,
  application_id uuid not null references public.application (application_id) on delete cascade,
  from_status    public.application_status,
  to_status      public.application_status not null,
  reason         text,
  changed_by     uuid references public.user_account (user_account_id) on delete set null,  -- null = system
  changed_at     timestamptz not null default now()
);
create index application_status_history_app_idx on public.application_status_history (application_id, changed_at);

create or replace function public.touch_application_status()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.log_application_status()
returns trigger language plpgsql as $$
declare
  v_from public.application_status;
begin
  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status then
      return null;
    end if;
    v_from := old.status;
  end if;

  insert into public.application_status_history (application_id, from_status, to_status, reason, changed_by)
  values (new.application_id, v_from, new.status, new.status_reason, public.current_actor_id());
  return null;
end;
$$;

create trigger application_touch_status
  before update on public.application
  for each row execute function public.touch_application_status();

create trigger application_log_status
  after insert or update of status on public.application
  for each row execute function public.log_application_status();

create table public.matching_result (
  matching_result_id uuid primary key default gen_random_uuid(),
  application_id     uuid not null unique references public.application (application_id) on delete cascade,
  matching_score     numeric(5, 2) not null check (matching_score between 0 and 100),
  skills_score       numeric(5, 2),
  experience_score   numeric(5, 2),
  years_experience   numeric(4, 1),
  matched_skills     jsonb not null default '[]'::jsonb,
  missing_skills     jsonb not null default '[]'::jsonb,
  skill_matches      jsonb not null default '[]'::jsonb,  -- per required skill: found text + similarity
  experience_matches jsonb not null default '[]'::jsonb,
  warnings           jsonb not null default '[]'::jsonb,
  weights            jsonb not null,                       -- e.g. {"skills":1,"experience":0}
  model_name         text not null,
  computed_at        timestamptz not null default now()
);

create table public.document_request (
  document_request_id    uuid primary key default gen_random_uuid(),
  applicant_id           uuid not null references public.applicant (applicant_id) on delete cascade,
  application_id         uuid references public.application (application_id) on delete set null,
  document_type          public.document_type not null,   -- 'resume' = resume re-upload
  target_document_id     uuid references public.supporting_document (supporting_document_id) on delete set null,
  reason                 text not null,
  status                 public.request_status not null default 'pending',
  requested_by           uuid not null references public.user_account (user_account_id) on delete restrict,
  due_at                 timestamptz not null,
  fulfilled_document_id  uuid references public.supporting_document (supporting_document_id) on delete set null,
  fulfilled_resume_id    uuid references public.resume (resume_id) on delete set null,
  fulfilled_at           timestamptz,
  created_at             timestamptz not null default now()
);
create index document_request_pending_idx on public.document_request (due_at) where status = 'pending';
create index document_request_applicant_idx on public.document_request (applicant_id, status);

create table public.interview_schedule (
  interview_schedule_id uuid primary key default gen_random_uuid(),
  application_id        uuid not null references public.application (application_id) on delete cascade,
  interviewer_id        uuid references public.user_account (user_account_id) on delete set null,
  attempt_number        smallint not null default 1 check (attempt_number between 1 and 3),  -- 1 + max 2 reschedules
  scheduled_at          timestamptz not null,
  duration_minutes      smallint not null default 30 check (duration_minutes > 0),
  meeting_link          text not null,                    -- interviews are online only
  status                public.interview_status not null default 'pending_confirmation',
  confirm_due_at        timestamptz not null,
  confirmed_at          timestamptz,
  reschedule_reason     text,
  reminder_sent_at      timestamptz,
  created_by            uuid references public.user_account (user_account_id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (application_id, attempt_number)
);
create unique index interview_one_open_per_application on public.interview_schedule (application_id)
  where status in ('pending_confirmation', 'confirmed', 'reschedule_requested');
create index interview_upcoming_idx on public.interview_schedule (scheduled_at)
  where status in ('pending_confirmation', 'confirmed');

-- Every competency on the fixed list is rated at each agency interview (1-5),
-- so ratings can be reused with another vacancy's weights (talent pool).
create table public.competency_rating (
  competency_rating_id  uuid primary key default gen_random_uuid(),
  application_id        uuid not null references public.application (application_id) on delete cascade,
  applicant_id          uuid not null references public.applicant (applicant_id) on delete cascade,
  competency_id         uuid not null references public.competency (competency_id) on delete restrict,
  interview_schedule_id uuid references public.interview_schedule (interview_schedule_id) on delete set null,
  rating                smallint not null check (rating between 1 and 5),
  rated_by              uuid not null references public.user_account (user_account_id) on delete restrict,
  rated_at              timestamptz not null default now(),
  unique (application_id, competency_id)
);
create index competency_rating_applicant_idx on public.competency_rating (applicant_id, competency_id, rated_at desc);

-- VERA-ALGO[FIN-01] BEGIN Final score and pass rule stored as generated columns
-- final_score = (matching_score + interview_score) / 2   (plain average)      Ref: docs/ALGORITHM.md §4 FIN-01
-- interview_score = SUM(weight_i * rating_i / 5) is computed by the API (WSM-01) and stored here
create table public.final_evaluation (
  final_evaluation_id           uuid primary key default gen_random_uuid(),
  application_id                uuid not null unique references public.application (application_id) on delete cascade,
  matching_score                numeric(5, 2) not null check (matching_score between 0 and 100),
  interview_score               numeric(5, 2) not null check (interview_score between 0 and 100),
  final_score                   numeric(5, 2) generated always as (round((matching_score + interview_score) / 2, 2)) stored,
  passing_score                 numeric(5, 2) not null,   -- snapshot of the vacancy passing score
  passed                        boolean generated always as (round((matching_score + interview_score) / 2, 2) >= passing_score) stored,
  ratings_source_application_id uuid not null references public.application (application_id),
  computed_by                   uuid references public.user_account (user_account_id) on delete set null,
  computed_at                   timestamptz not null default now()
);
-- VERA-ALGO[FIN-01] END

create table public.endorsement (
  endorsement_id    uuid primary key default gen_random_uuid(),
  job_vacancy_id    uuid not null references public.job_vacancy (job_vacancy_id) on delete restrict,
  company_id        uuid not null references public.company (company_id) on delete restrict,
  status            public.endorsement_status not null default 'draft',
  sent_to_email     text,
  form_pdf_path     text,                                 -- storage: endorsements/<endorsement_id>/form.pdf
  summary_xlsx_path text,                                 -- storage: endorsements/<endorsement_id>/summary.xlsx
  remarks           text,
  sent_by           uuid references public.user_account (user_account_id) on delete set null,
  sent_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index endorsement_job_idx on public.endorsement (job_vacancy_id);

create table public.endorsement_item (
  endorsement_item_id uuid primary key default gen_random_uuid(),
  endorsement_id      uuid not null references public.endorsement (endorsement_id) on delete cascade,
  application_id      uuid not null unique references public.application (application_id) on delete cascade,
  rank_at_endorsement smallint not null check (rank_at_endorsement > 0),
  final_score         numeric(5, 2) not null,
  outcome             public.endorsement_outcome not null default 'pending',
  client_interview_at timestamptz,                        -- optional; encoded by HR if the client shares it
  outcome_remarks     text,
  outcome_recorded_by uuid references public.user_account (user_account_id) on delete set null,
  outcome_recorded_at timestamptz
);

create table public.post_hiring_details (
  post_hiring_id              uuid primary key default gen_random_uuid(),
  application_id              uuid not null unique references public.application (application_id) on delete cascade,
  training_schedule           text,
  training_status             public.training_status not null default 'pending',
  pre_employment_requirements text,
  orientation_schedule        text,
  deployment_details          text,
  sent_by                     uuid references public.user_account (user_account_id) on delete set null,
  sent_at                     timestamptz,
  updated_at                  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 7. Talent pool
-- -----------------------------------------------------------------------------
create table public.talent_pool (
  talent_pool_id        uuid primary key default gen_random_uuid(),
  applicant_id          uuid not null references public.applicant (applicant_id) on delete cascade,
  source_application_id uuid not null references public.application (application_id) on delete cascade,
  pool_reason           public.pool_reason not null,
  availability          public.pool_availability not null default 'available',
  remarks               text,
  added_at              timestamptz not null default now(),
  removed_at            timestamptz
);
create unique index talent_pool_one_active_entry on public.talent_pool (applicant_id) where removed_at is null;

create table public.pool_invitation (
  pool_invitation_id uuid primary key default gen_random_uuid(),
  talent_pool_id     uuid not null references public.talent_pool (talent_pool_id) on delete cascade,
  job_vacancy_id     uuid not null references public.job_vacancy (job_vacancy_id) on delete cascade,
  status             public.invitation_status not null default 'pending',
  invited_by         uuid references public.user_account (user_account_id) on delete set null,
  invited_at         timestamptz not null default now(),
  due_at             timestamptz not null,
  responded_at       timestamptz,
  unique (talent_pool_id, job_vacancy_id)
);

-- -----------------------------------------------------------------------------
-- 8. Notifications and settings
-- -----------------------------------------------------------------------------
create table public.notification (
  notification_id   uuid primary key default gen_random_uuid(),
  user_account_id   uuid not null references public.user_account (user_account_id) on delete cascade,
  application_id    uuid references public.application (application_id) on delete set null,
  notification_type text not null,                        -- catalog in docs/TRD.md section 9
  title             text not null,
  message           text not null,
  link_path         text,                                 -- in-app route, e.g. /applicant/interviews
  requires_action   boolean not null default false,
  is_read           boolean not null default false,
  read_at           timestamptz,
  email_status      public.email_status not null default 'not_required',
  email_sent_at     timestamptz,
  email_error       text,
  created_at        timestamptz not null default now()
);
create index notification_user_idx on public.notification (user_account_id, is_read, created_at desc);
create index notification_email_pending_idx on public.notification (created_at) where email_status = 'pending';

create table public.system_setting (
  setting_key   text primary key,
  setting_value jsonb not null,
  description   text,
  updated_by    uuid references public.user_account (user_account_id) on delete set null,
  updated_at    timestamptz not null default now()
);

insert into public.system_setting (setting_key, setting_value, description) values
  ('response_deadline_days',     '3',  'Days an applicant has to re-upload documents, confirm an interview, or confirm endorsement'),
  ('max_reschedules',            '2',  'Maximum interview reschedules per application'),
  ('interview_reminder_hours',   '24', 'Hours before an interview to send a reminder'),
  ('default_matching_threshold', '40', 'Default matching threshold (%) for new vacancies'),
  ('default_cap_multiplier',     '8',  'Default application cap = slots x this value (minimum is 4)');

-- -----------------------------------------------------------------------------
-- 9. Views
-- -----------------------------------------------------------------------------
create view public.v_applicant_profile with (security_invoker = true) as
select
  a.*,
  u.email,
  date_part('year', age(current_date, a.birthdate))::int as age
from public.applicant a
join public.user_account u on u.user_account_id = a.user_account_id;

-- Latest rating per applicant per competency (talent-pool reuse).
create view public.v_latest_competency_rating with (security_invoker = true) as
select distinct on (applicant_id, competency_id)
  applicant_id, competency_id, rating, application_id, rated_at
from public.competency_rating
order by applicant_id, competency_id, rated_at desc;

-- -----------------------------------------------------------------------------
-- 10. updated_at triggers
-- -----------------------------------------------------------------------------
create trigger set_updated_at before update on public.user_account        for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.applicant           for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.company             for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.job_vacancy         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.application         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.interview_schedule  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.endorsement         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.post_hiring_details for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 11. Row Level Security
-- All data access goes through the Express API (service connection), which
-- bypasses RLS. RLS is enabled with NO policies so the public anon/publishable
-- key used by the browser (for Supabase Auth only) can never read app tables.
-- -----------------------------------------------------------------------------
alter table public.user_account               enable row level security;
alter table public.applicant                  enable row level security;
alter table public.resume_draft               enable row level security;
alter table public.resume                     enable row level security;
alter table public.resume_extraction          enable row level security;
alter table public.supporting_document        enable row level security;
alter table public.company                    enable row level security;
alter table public.competency                 enable row level security;
alter table public.job_vacancy                enable row level security;
alter table public.job_competency             enable row level security;
alter table public.application                enable row level security;
alter table public.application_status_history enable row level security;
alter table public.matching_result            enable row level security;
alter table public.document_request           enable row level security;
alter table public.interview_schedule         enable row level security;
alter table public.competency_rating          enable row level security;
alter table public.final_evaluation           enable row level security;
alter table public.endorsement                enable row level security;
alter table public.endorsement_item           enable row level security;
alter table public.post_hiring_details        enable row level security;
alter table public.talent_pool                enable row level security;
alter table public.pool_invitation            enable row level security;
alter table public.notification               enable row level security;
alter table public.system_setting             enable row level security;

-- -----------------------------------------------------------------------------
-- 12. Storage buckets (private; files are served through short-lived signed URLs)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('resumes',      'resumes',      false, 10485760, array['application/pdf']),
  ('documents',    'documents',    false, 10485760, array['application/pdf']),
  ('endorsements', 'endorsements', false, 20971520,
     array['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;
