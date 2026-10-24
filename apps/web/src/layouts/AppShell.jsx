import { useState } from "react";
import { Outlet } from "react-router-dom";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

/**
 * VERA shell (docs/UI_REDESIGN.md §3): 256px midnight-navy sidebar (fixed at ≥1200px, a drawer below), 56px top bar,
 * main content with 24px padding and max width 1440px on the workspace background, and a static footer.
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

      <div className="flex min-h-screen flex-col desktop:pl-sidebar">
        <Header items={items} onMenuClick={() => setNavOpen(true)} />
        <main className="mx-auto w-full max-w-content flex-1 p-4 md:p-6">
          <Outlet />
        </main>
        <footer className="mx-auto flex w-full max-w-content flex-col gap-1 border-t border-border/70 px-4 py-4 text-caption text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-6">
          <span className="font-heading font-semibold text-heading">Virtual Employment and Recruitment Assistant</span>
          <span>© 2026 Confiable Manpower Solutions Inc.</span>
        </footer>
      </div>
    </div>
  );
}
