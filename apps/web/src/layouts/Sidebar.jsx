import { LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";

import logo from "@/assets/images/logo.png";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const itemClass =
  "flex h-11 items-center gap-3 rounded-sm px-3 text-body font-medium text-white/85 outline-none hover:bg-nav-hover hover:text-white focus-visible:ring-2 focus-visible:ring-sidebar-ring";

/**
 * Navy navigation rail: emblem + VERA, destinations, Log Out pinned to the bottom (UI_GUIDELINES §5).
 * @param {{ items: object[], disabled?: boolean, onNavigate?: () => void }} props
 */
export function Sidebar({ items, disabled = false, onNavigate }) {
  const { signOut } = useAuth();

  return (
    <nav aria-label="Main" className="flex h-full w-sidebar flex-col bg-nav text-white">
      <div className="flex flex-col items-center gap-2 px-4 pt-6 pb-4">
        <img src={logo} alt="Confiable Manpower Solutions" className="size-20 object-contain" />
        <span className="text-section-title font-bold tracking-wide text-white">VERA</span>
      </div>

      <ul className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {items.map(({ label, to, icon: Icon, end }) => (
          <li key={to}>
            {disabled ? (
              <span
                aria-disabled="true"
                title="Confirm your profile first"
                className={cn(itemClass, "cursor-not-allowed opacity-50 hover:bg-transparent")}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </span>
            ) : (
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) => cn(itemClass, isActive && "bg-primary text-white hover:bg-primary")}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </NavLink>
            )}
          </li>
        ))}
      </ul>

      <div className="border-t border-sidebar-border p-3">
        <button type="button" onClick={signOut} className={cn(itemClass, "w-full")}>
          <LogOut className="size-5 text-red-400" aria-hidden="true" />
          Log Out
        </button>
      </div>
    </nav>
  );
}
