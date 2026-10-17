-- Phase 4 (decision 16): supporting documents the applicant chose to attach when applying. Verification stays per
-- document (FR-SCR-02); this only records what the applicant sent with the application. Documents are never
-- deleted (a re-upload sets is_current = false), so the restrict foreign key never blocks. No existing row changes.
begin;

create table if not exists public.application_document (
  application_id         uuid not null references public.application (application_id) on delete cascade,
  supporting_document_id uuid not null references public.supporting_document (supporting_document_id) on delete restrict,
  attached_at            timestamptz not null default now(),
  primary key (application_id, supporting_document_id)
);

create index if not exists application_document_document_idx on public.application_document (supporting_document_id);

alter table public.application_document enable row level security;  -- rule 6: no policies, API only

comment on table public.application_document is 'Phase 4, decision 16: documents attached when applying.';

commit;
