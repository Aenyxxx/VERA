import { LogOut } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

import logo from "@/assets/images/logo.png";
import { cn } from "@/lib/utils";

import { LogoutDialog } from "./LogoutDialog";

const itemClass =
  "flex h-11 items-center gap-3 rounded-lg px-3 text-body font-medium text-white/80 outline-none transition-colors duration-150 ease-out hover:bg-white/8 hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-ring";

/**
 * Midnight-navy navigation rail: emblem + VERA, destinations, Log out pinned to the bottom (docs/UI_REDESIGN.md §3).
 * The active item is an electric-blue pill; the wave at the bottom is CSS only (no image, no content).
 * Decision 39-5: Log out opens a confirmation first (also in the phone drawer).
 * @param {{ items: object[], disabled?: boolean, onNavigate?: () => void }} props
 */
export function Sidebar({ items, disabled = false, onNavigate }) {
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  return (
    <nav
      aria-label="Main"
      className="relative flex h-full w-sidebar flex-col overflow-hidden bg-linear-to-b from-nav to-navy-deep text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-white/[0.04]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-36 left-20 size-80 rounded-full bg-cyan/[0.05]"
      />

      <div className="relative flex flex-col items-center gap-1 px-4 pt-6 pb-5">
        <img src={logo} alt="Confiable Manpower Solutions" className="size-24 object-contain drop-shadow-lg" />
        <span className="font-heading text-page-title font-extrabold tracking-wide text-white">VERA</span>
        <span aria-hidden="true" className="h-1 w-8 rounded-full bg-brand-yellow" />
      </div>

      <ul className="relative flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map(({ label, to, icon: Icon, end }) => (
          <li key={to}>
            {disabled ? (
              <span
                aria-disabled="true"
                title="Confirm your profile first"
                className={cn(itemClass, "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-white/80")}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </span>
            ) : (
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(itemClass, isActive && "bg-primary font-semibold text-white shadow-glow hover:bg-primary")
                }
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </NavLink>
            )}
          </li>
        ))}
      </ul>

      <div className="relative border-t border-sidebar-border p-3">
        <button type="button" onClick={() => setConfirmingLogout(true)} className={cn(itemClass, "w-full font-semibold text-white")}>
          <LogOut className="size-5 text-red-400" aria-hidden="true" />
          Log out
        </button>
      </div>
      <LogoutDialog open={confirmingLogout} onOpenChange={setConfirmingLogout} />
    </nav>
  );
}
