-- =============================================================================
-- VERA — automatic rematch offer (roadmap slice S17, decided Oct 10, 2026)
--
-- PRD BR-23: after a not_hired commit VERA rescans the open vacancies and offers the best one to the applicant.
-- Lean: the offer reuses public.pool_invitation (initial schema, unused until now): talent_pool_id = the applicant's
-- active pool entry (pool_reason not_hired, S16), job_vacancy_id = the offered vacancy, status invitation_status
-- (pending | accepted | declined | expired), invited_by null = the system, due_at, responded_at, and
-- unique (talent_pool_id, job_vacancy_id) so a re-run never offers the same vacancy twice.
-- This migration adds the numbers the accept needs (stored at scan time: the accept creates the application without
-- calling svc again, CLAUDE.md rule 7) and "one pending offer per pool entry". No new enum value; no existing row
-- changes. The new foreign keys are ON DELETE SET NULL so the reset / cleanup scripts are never blocked.
--
-- Run once in the Supabase SQL Editor (after 20261010020000_one_ongoing_index_repair.sql), then restart
-- `pnpm dev`. Verification queries: docs/DATABASE_SCHEMA.md §7.
-- =============================================================================
begin;

alter table public.pool_invitation
  add column if not exists applicant_type                public.applicant_type,   -- carried over from not_hired (BR-20 exception)
  add column if not exists matching                      jsonb,                   -- { match, weights, matchingScore } from svc /match
  add column if not exists matching_score                numeric(5, 2),           -- RANK-02 stored score
  add column if not exists section_scores                jsonb,                   -- WSM-01 with this vacancy's weights
  add column if not exists interview_score               numeric(5, 2),           -- WSM-01/03 from the original interview
  add column if not exists final_score                   numeric(5, 2),           -- FIN-01
  add column if not exists ratings_source_application_id uuid references public.application (application_id) on delete set null,
  add column if not exists application_id                uuid references public.application (application_id) on delete set null;  -- set on accept

-- At most one pending offer per pool entry: a second scan or a double click answers 409 (named in the API).
create unique index if not exists pool_invitation_one_pending on public.pool_invitation (talent_pool_id)
  where status = 'pending';

comment on table public.pool_invitation is
  'S17: automatic rematch offer after not_hired (PRD BR-23). One row per offered vacancy; at most one pending per pool entry.';

commit;
