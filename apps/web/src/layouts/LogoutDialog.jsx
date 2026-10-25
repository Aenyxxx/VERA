import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";

/**
 * Decision 39-5: Log out asks first (sidebar, the phone drawer and the top-bar account menu; every role). Only
 * "Log out" signs out, with the same `signOut` as before; Cancel or Escape keeps the session. The dialog cannot be
 * closed while signing out.
 */
export function LogoutDialog({ open, onOpenChange }) {
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      await signOut();
    } finally {
      setPending(false);
      onOpenChange(false);
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => !pending && onOpenChange(next)}
      title="Log out?"
      description="You will need to sign in again to use VERA."
      confirmLabel="Log out"
      pending={pending}
      onConfirm={confirm}
    />
  );
}
