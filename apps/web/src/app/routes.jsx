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
              soon("/admin/screening", "Resume Screening", "S12"),
              soon("/admin/screening/:vacancyId", "Resume Screening", "S12"),
              soon("/admin/screening/:vacancyId/:applicationId", "Applicant review", "S12"),
              soon("/admin/interviews", "Interviews Assessment", "S13"),
              soon("/admin/interviews/:vacancyId", "Interviews Assessment", "S14"),
              soon("/admin/endorsements", "Endorsement Management", "S16"),
              soon("/admin/endorsements/:vacancyId", "Endorsement Management", "S16"),
              soon("/admin/talent-pool", "Applicant Pool", "S17"),
              { path: "/admin/notifications", element: <Notifications /> },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFound /> },
];
