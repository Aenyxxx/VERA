import { Link } from "react-router-dom";

import logo from "@/assets/images/logo.png";
import { LoginForm } from "@/features/auth/LoginForm";

// Google sign-in and Forgot password are deferred (ROADMAP §6), so they are not shown.
export default function Login() {
  return (
    <div className="w-full max-w-[420px] rounded-lg border bg-card p-8 shadow-[0_2px_8px_rgba(17,43,73,0.10)]">
      <div className="mb-6 flex flex-col items-center text-center">
        <img src={logo} alt="Confiable Manpower Solutions" className="mb-3 size-16 object-contain" />
        <h1 className="text-page-title font-bold">Welcome to VERA</h1>
        <p className="mt-1 text-body text-muted-foreground">Verified Evaluation and Recruitment Assistant</p>
      </div>

      <LoginForm />

      <p className="mt-6 text-center text-body text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link to="/signup" className="font-semibold text-primary hover:underline">
          Create account
        </Link>
      </p>
    </div>
  );
}
