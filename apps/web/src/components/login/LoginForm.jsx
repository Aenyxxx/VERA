import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";

import logo from "@/assets/images/logo.png"

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  return (
    <section className="flex min-h-screen w-full flex-col bg-[#f7f9f8] lg:w-[42%]">

      {/* Top branding */}
      <div className="flex justify-end px-6 py-5 lg:px-10">
        <div className="text-right">
          <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-gray-700">
            Work today.
          </p>

          <p className="text-[7px] font-bold uppercase tracking-[0.2em] text-gray-700">
            A better tomorrow.
          </p>

          <div className="ml-auto mt-1 h-[3px] w-5 rounded-full bg-yellow-400" />
        </div>
      </div>

      {/* Login area */}
      <div className="flex flex-1 items-center justify-center px-5 pb-8">
        <div className="w-full max-w-[390px]">

          <Card className="border border-gray-100 bg-white shadow-md">
            <CardContent className="px-6 py-7 sm:px-8">

              {/* Login header */}
              <div className="flex flex-col items-center text-center">

                <img
                  src={logo}
                  alt="Confiable Manpower Solutions"
                  className="mb-3 h-14 w-14 object-contain"
                />

                <h1 className="text-lg font-bold text-gray-900">
                  Welcome to VERA
                </h1>

                <p className="mt-1 max-w-[280px] text-[10px] leading-relaxed text-gray-500">
                  Verified Evaluation and Recruitment Assistant
                </p>

                <p className="mt-3 text-[10px] text-gray-300">
                  Sign in to your account to continue
                </p>

              </div>

              <form 
                className="mt-7"
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmedEmail = email.trim();
                  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (!trimmedEmail || !password) {
                    setError("Email and password are required")
                    return;
                  }

                  if (!emailPattern.test(trimmedEmail))
                  {
                    setError("Please eneter a valid email address")
                  }

                  if (password.length < 6) {
                    setError("Password must be at least 6 characters.");
                    return;
                  }
                  setError("")
                  setIsLoading(true);
                  setTimeout(() => {
                    console.log("Authentication request completed");
                    setIsLoading(false);
                  }, 1500);
                }}
              >
                {/*Email Input */}
                <div className="mt-7">
                  <label
                    htmlFor="email"
                    className="mb-2 block text-xs font-medium text-gray-700"
                  >
                    Email Address
                  </label>

                  <div className="relative">
                    <Mail
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={16}
                    />

                    <Input
                      id="email"
                      type="email"
                      placeholder="Email Address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10 pl-9 text-sm"
                    />
                  </div>
                </div>

                {/*Password Input */}
                <div className="mt-4">
                  <label
                    htmlFor="password"
                    className="mb-2 block text-xs font-medium text-gray-700"
                  >
                    Password
                  </label>

                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={16}
                    />

                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 pl-9 text-sm"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                    </button>
                  </div>
                </div>

                {/*Remember Me Checkbox*/}
                <div className="mt-4 flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-[10px] text-gray-600">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-gray-300"
                      />
                    <span>Remember me</span>
                  </label>

                  {/*Forgot Password But*/}
                  <button
                    type="button"
                    className="text-[10px] font-medium text-blue-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                {/*Error Message*/}
                {error && (
                  <p className="mt-3 text-center text-xs text-red-500">
                    {error}
                  </p>
                )}

                {/*Log In Button */}
                <div className="mt-5">
                  <Button
                    type="submit"
                    className="h-10 w-full bg-[#1f2937] text-sm font-semibold text-white hover:bg-[#111827]"
                  >
                    {isLoading ? "Logging in ..." : "Log In"}
                    {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
                  </Button>
                </div>
              </form>

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />

                <span className="text-[9px] text-gray-400">
                  or
                </span>

                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/*Sign In with Google Button*/}
              <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full border-gray-200 bg-white text-xs font-medium text-gray-800 hover:bg-gray-50"
                >
                  <span className="mr-2 font-bold text-sm">G</span>
                  Sign in with Google
              </Button>

              <div className="mt-5 text-center">
                <p className="text-[9px] text-gray-400">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    className="font-medium text-blue-700 hover:underline"
                  >
                    Contact your administrator
                  </button>
                </p>
              </div>

            </CardContent>
          </Card>

        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-5 px-6 pb-5 text-[8px] text-blue-700 lg:px-10">
        <a href="#">Privacy Policy</a>
        <a href="#">Terms of Use</a>
        <a href="#">Help</a>
      </div>

    </section>
  );
}