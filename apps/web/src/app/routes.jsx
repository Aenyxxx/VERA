// Route map (APP_FLOW §1, sprint scope). Guards: RequireAuth → RequireRole → (applicant) RequireProfile.
// Placeholder pages say which roadmap slice builds them; each slice swaps in its real page.
import { ROLES, STAFF_ROLES } from "@vera/shared";

import { AdminLayout } from "@/layouts/AdminLayout";
import { ApplicantLayout } from "@/layouts/ApplicantLayout";
import { AuthLayout } from "@/layouts/AuthLayout";
import AuthCallback from "@/pages/auth/AuthCallback";
import Login from "@/pages/auth/Login";
import SignUp from "@/pages/auth/SignUp";
import Dashboard from "@/pages/applicant/Dashboard";
import Documents from "@/pages/applicant/Documents";
import JobDetailPage from "@/pages/applicant/JobDetailPage";
import Jobs from "@/pages/applicant/Jobs";
import Setup from "@/pages/applicant/Setup";
import Companies from "@/pages/admin/Companies";
import EndorsementPrint from "@/pages/admin/EndorsementPrint";
import Endorsements from "@/pages/admin/Endorsements";
import EndorsementVacancy from "@/pages/admin/EndorsementVacancy";
import InterviewEvaluation from "@/pages/admin/InterviewEvaluation";
import Interviews from "@/pages/admin/Interviews";
import Screening from "@/pages/admin/Screening";
import ScreeningVacancy from "@/pages/admin/ScreeningVacancy";
import TalentPool from "@/pages/admin/TalentPool";
import Vacancies from "@/pages/admin/Vacancies";
import VacancyDetail from "@/pages/admin/VacancyDetail";
import VacancyEdit from "@/pages/admin/VacancyEdit";
import ComingSoon from "@/pages/ComingSoon";
import NotFound from "@/pages/NotFound";
import Notifications from "@/pages/Notifications";
import { RedirectIfSignedIn } from "@/routes/RedirectIfSignedIn";
import { RequireAuth } from "@/routes/RequireAuth";
import { RequireNoProfile, RequireProfile } from "@/routes/RequireProfile";
import { RequireRole } from "@/routes/RequireRole";
import { RootRedirect } from "@/routes/RootRedirect";

const soon = (path, title, slice) => ({ path, element: <ComingSoon title={title} slice={slice} /> });

export const routes = [
  {
    element: <AuthLayout />,
    children: [
      {
        element: <RedirectIfSignedIn />,
        children: [
          { path: "/login", element: <Login /> },
          { path: "/signup", element: <SignUp /> },
        ],
      },
      { path: "/auth/callback", element: <AuthCallback /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      { path: "/", element: <RootRedirect /> },
      {
        element: <RequireRole roles={[ROLES.APPLICANT]} />,
        children: [
          {
            element: <ApplicantLayout />,
            children: [
              { element: <RequireNoProfile />, children: [{ path: "/applicant/setup", element: <Setup /> }] },
              {
                element: <RequireProfile />,
                children: [
                  { path: "/applicant", element: <Dashboard /> },
                  { path: "/applicant/jobs", element: <Jobs /> },
                  { path: "/applicant/jobs/:vacancyId", element: <JobDetailPage /> },
                  { path: "/applicant/documents", element: <Documents /> },
                  { path: "/applicant/notifications", element: <Notifications /> },
                ],
              },
            ],
          },
        ],
      },
      {
        element: <RequireRole roles={STAFF_ROLES} />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              soon("/admin", "Dashboard", "S18"),
              { path: "/admin/companies", element: <Companies /> },
              { path: "/admin/companies/:id", element: <Companies /> },
              { path: "/admin/vacancies", element: <Vacancies /> },
              { path: "/admin/vacancies/new", element: <VacancyEdit /> },
              { path: "/admin/vacancies/:id", element: <VacancyDetail /> },
              { path: "/admin/vacancies/:id/edit", element: <VacancyEdit /> },
              soon("/admin/applicants", "Applicant Management", "S18"),
              soon("/admin/applicants/:id", "Applicant", "S18"),
              { path: "/admin/screening", element: <Screening /> },
              { path: "/admin/screening/:vacancyId", element: <ScreeningVacancy /> },
              { path: "/admin/screening/:vacancyId/:applicationId", element: <ScreeningVacancy /> },
              { path: "/admin/interviews", element: <Interviews /> },
              { path: "/admin/interviews/:vacancyId", element: <Interviews /> },
              { path: "/admin/interviews/:vacancyId/:applicationId", element: <InterviewEvaluation /> },
              { path: "/admin/endorsements", element: <Endorsements /> },
              { path: "/admin/endorsements/:vacancyId", element: <EndorsementVacancy /> },
              { path: "/admin/talent-pool", element: <TalentPool /> },
              { path: "/admin/notifications", element: <Notifications /> },
            ],
          },
          // S16: the printable endorsement has no admin layout, so Print → Save as PDF shows only the document.
          { path: "/admin/endorsements/:vacancyId/print/:endorsementId", element: <EndorsementPrint /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFound /> },
];
