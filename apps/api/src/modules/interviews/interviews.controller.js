import {
  approveReschedule,
  declineReschedule,
  editInterview,
  getInterviewers,
  getInterviewsForHr,
  getMyInterviews,
  markNoShow,
  requestReschedule,
  scheduleInterview,
} from "./interviews.service.js";

// GET /api/admin/interviewers
export async function interviewers(req, res) {
  res.json({ data: await getInterviewers() });
}

// GET /api/admin/interviews?vacancyId=
export async function list(req, res) {
  res.json({ data: await getInterviewsForHr(req.valid.query) });
}

// POST /api/admin/interviews
export async function schedule(req, res) {
  res.status(201).json({ data: await scheduleInterview(req.auth.userId, req.valid.body) });
}

// PATCH /api/admin/interviews/:id
export async function edit(req, res) {
  res.json({ data: await editInterview(req.auth.userId, req.valid.params.id, req.valid.body) });
}

// POST /api/admin/interviews/:id/no-show
export async function noShow(req, res) {
  res.json({ data: await markNoShow(req.auth.userId, req.valid.params.id) });
}

// GET /api/applicant/interviews
export async function mine(req, res) {
  res.json({ data: await getMyInterviews(req.auth.userId) });
}

// POST /api/applicant/interviews/:id/reschedule-request (Phase 4, decision 20)
export async function rescheduleRequest(req, res) {
  res.json({ data: await requestReschedule(req.auth.userId, req.valid.params.id, req.valid.body) });
}

// POST /api/admin/interviews/:id/reschedule/approve
export async function rescheduleApprove(req, res) {
  res.json({ data: await approveReschedule(req.auth.userId, req.valid.params.id, req.valid.body) });
}

// POST /api/admin/interviews/:id/reschedule/decline
export async function rescheduleDecline(req, res) {
  res.json({ data: await declineReschedule(req.auth.userId, req.valid.params.id) });
}
