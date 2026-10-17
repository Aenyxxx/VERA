import { useMe } from "@/hooks/useMe";

import { AppShell } from "./AppShell";
import { ADMIN_NAV, navFor } from "./navigation";

export function AdminLayout() {
  const { data: me } = useMe(); // loaded by RequireAuth / RequireRole before this renders
  return <AppShell items={navFor(ADMIN_NAV, me?.role)} />;
}
