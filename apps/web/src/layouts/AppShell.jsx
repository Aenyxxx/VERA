import { useState } from "react";
import { Outlet } from "react-router-dom";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

/**
 * VERA shell: 232px navy sidebar (fixed at ≥1200px, a drawer below), 56px header, main content
 * with 24px padding and max width 1440px (UI_GUIDELINES §5, DESIGN.md Layout).
 */
export function AppShell({ items, navDisabled = false }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden desktop:block">
        <Sidebar items={items} disabled={navDisabled} />
      </aside>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" showCloseButton={false} className="w-sidebar border-0 p-0 sm:max-w-none">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar items={items} disabled={navDisabled} onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="desktop:pl-sidebar">
        <Header items={items} onMenuClick={() => setNavOpen(true)} />
        <main className="mx-auto w-full max-w-content p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
