import { ROLE_LABELS, STAFF_ROLES } from "@vera/shared";
import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications } from "@/features/notifications/api";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { initialsOf } from "@/lib/auth";
import { cn } from "@/lib/utils";

import { pageContextFor } from "./navigation";

/**
 * 56px translucent white top bar: page context left; bell, avatar, name + role, account menu right
 * (docs/UI_REDESIGN.md §3).
 * The bell shows the real unread count only when it is above 0 (S11); a fake count is never shown.
 */
export function Header({ items, onMenuClick }) {
  const { pathname } = useLocation();
  const { signOut } = useAuth();
  const { data: me } = useMe();

  const isStaff = STAFF_ROLES.includes(me?.role);
  const name = me?.fullName || me?.email || ""; // applicants: name from the profile once confirmed
  const notificationsPath = isStaff ? "/admin/notifications" : "/applicant/notifications";
  const unread = useNotifications(5).data?.meta.unreadCount ?? 0; // same query as the dashboard card

  return (
    <header className="sticky top-0 z-30 flex h-header items-center gap-2 border-b border-border/70 bg-card/85 px-4 backdrop-blur-md md:px-6">
      <Button variant="ghost" size="icon" className="desktop:hidden" aria-label="Open navigation" onClick={onMenuClick}>
        <Menu className="size-5" />
      </Button>
      <p className="truncate font-heading text-card-title font-bold text-heading">{pageContextFor(pathname, items)}</p>

      <div className="ml-auto flex items-center gap-1">
        <Link
          to={notificationsPath}
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative rounded-full text-primary hover:bg-primary-soft")}
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span
              className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-card"
              aria-hidden="true"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>

        <span aria-hidden="true" className="mx-1 hidden h-7 w-px bg-border sm:block" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-11 items-center gap-2 rounded-lg px-2 outline-none transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar>
              <AvatarFallback className="bg-nav text-label-sm font-semibold text-white">
                {initialsOf(name)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-48 text-left sm:block">
              <span className="block truncate text-body font-semibold text-heading">{name}</span>
              <span className="block text-caption text-primary">{ROLE_LABELS[me?.role] ?? ""}</span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Account menu</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="size-4" aria-hidden="true" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
