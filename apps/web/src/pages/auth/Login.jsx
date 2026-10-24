import { Link } from "react-router-dom";

import logo from "@/assets/images/logo.png";
import { LoginForm } from "@/features/auth/LoginForm";

// Google sign-in and Forgot password are deferred (ROADMAP §6), so they are not shown.
export default function Login() {
  return (
    <div className="w-full max-w-[440px] rounded-xl bg-card p-6 shadow-card ring-1 ring-border/80 sm:p-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <img src={logo} alt="Confiable Manpower Solutions" className="mb-4 size-24 object-contain" />
        <h1 className="text-page-title font-extrabold text-heading">Welcome to VERA</h1>
        <p className="mt-1 text-body-lg font-medium text-text">Virtual Employment and Recruitment Assistant</p>
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
