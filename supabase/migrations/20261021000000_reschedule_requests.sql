-- Phase 4 (decision 20): the applicant may request an interview reschedule at most max_reschedules (2) times per
-- application; approved AND declined requests both count, so the counter lives on the application. The attempt
-- statuses reschedule_requested / rescheduled, interview_schedule.reschedule_reason, attempt_number 1..3 and the
-- max_reschedules setting already exist (initial schema). No existing row changes meaning.
begin;

alter table public.application
  add column if not exists reschedule_requests smallint not null default 0
    check (reschedule_requests between 0 and 2);

comment on column public.application.reschedule_requests is
  'Phase 4, decision 20: interview reschedule requests made by the applicant (approved or declined), max 2.';

commit;
