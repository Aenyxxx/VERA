import { Link } from "react-router-dom";

import logo from "@/assets/images/logo.png";
import { SignUpForm } from "@/features/auth/SignUpForm";

export default function SignUp() {
  return (
    <div className="w-full max-w-[420px] rounded-lg border bg-card p-8 shadow-[0_2px_8px_rgba(17,43,73,0.10)]">
      <div className="mb-6 flex flex-col items-center text-center">
        <img src={logo} alt="Confiable Manpower Solutions" className="mb-3 size-16 object-contain" />
        <h1 className="text-page-title font-bold">Create your account</h1>
        <p className="mt-1 text-body text-muted-foreground">Apply to Confiable Manpower job openings with one resume.</p>
      </div>

      <SignUpForm />

      <p className="mt-6 text-center text-body text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
