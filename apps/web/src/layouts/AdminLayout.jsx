import { AppShell } from "./AppShell";
import { ADMIN_NAV } from "./navigation";

export function AdminLayout() {
  return <AppShell items={ADMIN_NAV} />;
}
