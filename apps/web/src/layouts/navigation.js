// Sidebar destinations (UI_GUIDELINES §5). Sprint scope: Settings, Recruitment Reports, User Management,
// and Competencies are deferred (ROADMAP §6), so they are not listed.
import {
  BriefcaseBusiness,
  Building2,
  ClipboardCheck,
  FileSearch,
  FileText,
  Handshake,
  LayoutDashboard,
  UserRound,
  Users,
  UsersRound,
} from "lucide-react";

export const ADMIN_NAV = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Company List", to: "/admin/companies", icon: Building2 },
  { label: "Job Vacancies", to: "/admin/vacancies", icon: BriefcaseBusiness },
  { label: "Applicant Management", to: "/admin/applicants", icon: Users },
  { label: "Resume Screening", to: "/admin/screening", icon: FileSearch },
  { label: "Interviews Assessment", to: "/admin/interviews", icon: ClipboardCheck },
  { label: "Endorsement Management", to: "/admin/endorsements", icon: Handshake },
  { label: "Applicant Pool", to: "/admin/talent-pool", icon: UsersRound },
];

export const APPLICANT_NAV = [
  { label: "My Profile", to: "/applicant", icon: UserRound, end: true },
  { label: "Job Vacancies", to: "/applicant/jobs", icon: BriefcaseBusiness },
  { label: "My Documents", to: "/applicant/documents", icon: FileText },
];

/** Label for the header's page context: the nav item that owns the current path (detail pages keep the parent). */
export function pageContextFor(pathname, items) {
  if (pathname.endsWith("/notifications")) return "Notifications";
  if (pathname === "/applicant/setup") return "Set up your profile";
  const match = items
    .filter((item) => (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)))
    .sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label ?? "";
}
