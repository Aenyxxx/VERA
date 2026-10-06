-- =============================================================================
-- VERA — Seed data (development / first deployment)
-- The admin account is NOT created here (it needs Supabase Auth).
-- Create it with:  pnpm --filter api seed:admin   (see docs/TRD.md section 7)
-- =============================================================================

-- Starter fixed competency list, taken from the vacancy form in the UI mockups (DESIGN.md).
-- The administrator can edit this list in Competencies.
insert into public.competency (competency_name, description, sort_order) values
  ('Communication',     'Expresses ideas clearly and listens actively',               1),
  ('Problem Solving',   'Identifies issues and finds workable solutions',             2),
  ('Work Experience',   'Relevance and depth of past work shown in the interview',    3),
  ('Technical Skills',  'Job-specific knowledge and practical ability',               4),
  ('Teamwork',          'Works well with others toward shared goals',                 5),
  ('Adaptability',      'Adjusts to new tasks, people, and environments',             6)
on conflict do nothing;
