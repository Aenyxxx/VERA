-- =============================================================================
-- VERA — Seed data (development / first deployment)
-- The admin account is NOT created here (it needs Supabase Auth).
-- Create it with:  pnpm --filter api seed:admin   (see docs/TRD.md section 7)
--
-- Run after both migrations. Safe to run more than once.
-- =============================================================================

-- Competency Profile rubric (S9b): 3 sections, 15 items, each rated 1–5 at every agency interview.
-- Same list as supabase/migrations/20261007000000_competency_profile_rubric.sql and @vera/shared COMPETENCY_SECTIONS.
insert into public.competency_section (section_code, section_name, sort_order) values
  ('A', 'Communication and Interpersonal Skills', 1),
  ('B', 'Personal Effectiveness Skills and Traits', 2),
  ('C', 'Job Specific Skills and Experience',       3)
on conflict do nothing;

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
join public.competency_section s on s.section_code = item.section_code
on conflict do nothing;
