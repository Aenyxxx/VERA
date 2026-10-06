import { CircleCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { FullPageSpinner } from "@/components/shared/FullPageSpinner";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

/**
 * Landing page for the sign-up confirmation link (and OAuth later).
 * - #access_token=… (implicit flow, the supabase-js default here): read automatically by detectSessionInUrl.
 * - ?code=…  (PKCE flow): exchanged here for a session.
 * If no session results (another browser/device, expired, or already used link), the email is still
 * confirmed on Supabase's side once the link is opened, so we ask the user to log in.
 */
export default function AuthCallback() {
  const { session, loading } = useAuth();
  const [exchanging, setExchanging] = useState(() => new URLSearchParams(window.location.search).has("code"));

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) return;
    supabase.auth.exchangeCodeForSession(code).finally(() => setExchanging(false));
  }, []);

  if (session) return <Navigate to="/" replace />;
  if (loading || exchanging) return <FullPageSpinner label="Signing you in…" />;

  return (
    <div className="w-full max-w-[420px] rounded-lg border bg-card p-8 text-center">
      <CircleCheck className="mx-auto size-10 text-success" aria-hidden="true" />
      <h1 className="mt-3 text-section-title font-bold">Your email is confirmed. Please log in.</h1>
      <p className="mt-2 text-body text-muted-foreground">Use the email and password you signed up with.</p>
      <Link to="/login" className={buttonVariants({ className: "mt-6 w-full" })}>
        Go to login
      </Link>
    </div>
  );
}
