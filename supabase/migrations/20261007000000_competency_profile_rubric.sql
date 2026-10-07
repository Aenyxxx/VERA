-- =============================================================================
-- VERA — Competency Profile rubric (roadmap slice S9b)
--
-- Replaces the 6 flat competencies with the agency's Competency Profile:
--   3 sections (A, B, C) with 15 items, each item rated 1–5 at every agency interview.
-- Vacancies now weight the 3 SECTIONS (total 100%; a section may be 0%).
--
-- Interview score (two-level Weighted Sum Model, docs/ALGORITHM.md §4 WSM-01; computed by the API):
--   section%  = (mean of the section's item ratings − 1) / 4 × 100        (1 → 0%, 3 → 50%, 5 → 100%)
--   interview = Σ section_weight% × section% / 100
--   rounded to 2 decimals, half-up, computed in exact hundredths.
-- Final score and pass rule are unchanged (FIN-01).
--
-- Run once in the Supabase SQL Editor (after 20261006000000_initial_schema.sql). Verification queries:
-- docs/DATABASE_SCHEMA.md §7.
-- =============================================================================
begin;

-- -----------------------------------------------------------------------------
-- 1. Safety: refuse to run if interviews were already rated against the old list.
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.competency_rating) then
    raise exception 'competency_rating has rows; the old ratings cannot be mapped to the new 15 items automatically';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Sections
-- -----------------------------------------------------------------------------
create table public.competency_section (
  competency_section_id uuid primary key default gen_random_uuid(),
  section_code          char(1) not null unique check (section_code in ('A', 'B', 'C')),
  section_name          text not null,
  sort_order            smallint not null
);
alter table public.competency_section enable row level security;

insert into public.competency_section (section_code, section_name, sort_order) values
  ('A', 'Communication and Interpersonal Skills', 1),
  ('B', 'Personal Effectiveness Skills and Traits', 2),
  ('C', 'Job Specific Skills and Experience',       3);

alter table public.competency add column section_id uuid references public.competency_section (competency_section_id) on delete restrict;

-- -----------------------------------------------------------------------------
-- 3. Section weights per vacancy (replaces job_competency)
-- -----------------------------------------------------------------------------
create table public.job_section_weight (
  job_vacancy_id        uuid not null references public.job_vacancy (job_vacancy_id) on delete cascade,
  competency_section_id uuid not null references public.competency_section (competency_section_id) on delete restrict,
  weight                numeric(5, 2) not null check (weight >= 0 and weight <= 100),   -- percent; 0 allowed
  primary key (job_vacancy_id, competency_section_id)
);
alter table public.job_section_weight enable row level security;

-- Section weights of a vacancy must total exactly 100 (or 0 while a draft has none). Deferred, so all
-- rows can be replaced in one transaction. The API additionally requires 100 before publishing.
create or replace function public.check_job_section_weights()
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
  from public.job_section_weight
  where job_vacancy_id = v_job;

  if v_total <> 0 and v_total <> 100 then
    raise exception 'Section weights for vacancy % must total 100 (currently %)', v_job, v_total
      using errcode = 'check_violation';
  end if;
  return null;
end;
$$;

create constraint trigger job_section_weights_total
  after insert or update or delete on public.job_section_weight
  deferrable initially deferred
  for each row execute function public.check_job_section_weights();

-- -----------------------------------------------------------------------------
-- 4. Convert existing vacancy weights: old competency → section, summed
--    A = Communication + Teamwork; B = Problem Solving + Adaptability; C = Work Experience + Technical Skills
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from public.job_competency jc
    join public.competency c on c.competency_id = jc.competency_id
    where lower(c.competency_name) not in
      ('communication', 'teamwork', 'problem solving', 'adaptability', 'work experience', 'technical skills')
  ) then
    raise exception 'a vacancy uses a competency outside the original 6; map it to a section by hand first';
  end if;
end;
$$;

insert into public.job_section_weight (job_vacancy_id, competency_section_id, weight)
select v.job_vacancy_id, s.competency_section_id, coalesce(sum(jc.weight), 0)
from (select distinct job_vacancy_id from public.job_competency) v
cross join public.competency_section s
left join (
  select jc.job_vacancy_id, jc.weight,
         case lower(c.competency_name)
           when 'communication'    then 'A'
           when 'teamwork'         then 'A'
           when 'problem solving'  then 'B'
           when 'adaptability'     then 'B'
           when 'work experience'  then 'C'
           when 'technical skills' then 'C'
         end as section_code
  from public.job_competency jc
  join public.competency c on c.competency_id = jc.competency_id
) jc on jc.job_vacancy_id = v.job_vacancy_id and jc.section_code = s.section_code
group by v.job_vacancy_id, s.competency_section_id;

drop trigger job_competency_weights_total on public.job_competency;
drop function public.check_job_competency_weights();
drop table public.job_competency;

-- -----------------------------------------------------------------------------
-- 5. The 15 Competency Profile items (replace the 6 old competencies)
-- -----------------------------------------------------------------------------
delete from public.competency;

insert into public.competency (competency_name, section_id, sort_order)
select item.name, s.competency_section_id, item.sort_order
from (values
  ('A', 'Oral Communication/Listening', 1),
  ('A', 'Co-Worker Relations/Teamwork', 2),
  ('A', 'Customer Relations',           3),
  ('B', 'Problem Solving',              4),
  ('B', 'Time Management',              5),
  ('B', 'Quality',                      6),
  ('B', 'Initiative and Perseverance',  7),
  ('B', 'Personal Integrity',           8),
  ('B', 'Adaptability',                 9),
  ('B', 'Stress Tolerance',            10),
  ('B', 'Self-Development',            11),
  ('B', 'Commitment',                  12),
  ('C', 'Experience',                  13),
  ('C', 'Education / Training',        14),
  ('C', 'Technical Skills',            15)
) as item (section_code, name, sort_order)
join public.competency_section s on s.section_code = item.section_code;

alter table public.competency alter column section_id set not null;
create index competency_section_idx on public.competency (section_id, sort_order);

-- -----------------------------------------------------------------------------
-- 6. Final evaluation: section scores + overall rating of probability of success
-- -----------------------------------------------------------------------------
-- {"A": 83.33, "B": 75, "C": 75} — section% values used for the interview score, written by the API (S14).
alter table public.final_evaluation add column section_scores jsonb not null default '{}'::jsonb;

-- VERA-ALGO[WSM-02] BEGIN Overall rating of probability of success (band of the interview score)
-- rating = 5 if interview ≥ 80, 4 if ≥ 60, 3 if ≥ 40, 2 if ≥ 20, else 1 (informational; never decides pass/fail).   Ref: docs/ALGORITHM.md §4 WSM-02
alter table public.final_evaluation add column overall_rating smallint generated always as (
  (case
     when interview_score >= 80 then 5
     when interview_score >= 60 then 4
     when interview_score >= 40 then 3
     when interview_score >= 20 then 2
     else 1
   end)::smallint
) stored;
-- VERA-ALGO[WSM-02] END

comment on column public.final_evaluation.interview_score is
  'WSM-01: Σ section_weight% × section% / 100, section% = (mean item rating − 1) / 4 × 100; computed by the API, 2 dp half-up (docs/ALGORITHM.md §4)';

commit;
