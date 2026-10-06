import { useLocation } from "react-router-dom";

import { AppShell } from "./AppShell";
import { APPLICANT_NAV } from "./navigation";

// The sidebar stays disabled until the profile is confirmed (APP_FLOW §1.2).
export function ApplicantLayout() {
  const { pathname } = useLocation();
  return <AppShell items={APPLICANT_NAV} navDisabled={pathname === "/applicant/setup"} />;
}
