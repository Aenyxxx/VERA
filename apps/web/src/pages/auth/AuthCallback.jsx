import { Link, Navigate } from "react-router-dom";

import { FullPageSpinner } from "@/components/shared/FullPageSpinner";
import { useAuth } from "@/hooks/useAuth";

/** Landing page for email-confirmation / OAuth links: supabase-js reads the session from the URL. */
export default function AuthCallback() {
  const { session, loading } = useAuth();

  if (loading) return <FullPageSpinner label="Signing you in…" />;
  if (session) return <Navigate to="/" replace />;

  return (
    <div className="w-full max-w-[420px] rounded-lg border bg-card p-8 text-center">
      <h1 className="text-section-title font-bold">This link is invalid or has expired</h1>
      <p className="mt-2 text-body text-muted-foreground">Log in with your email and password to continue.</p>
      <Link to="/login" className="mt-4 inline-block font-semibold text-primary hover:underline">
        Go to login
      </Link>
    </div>
  );
}
