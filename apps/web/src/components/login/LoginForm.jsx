import { useState } from "react";

import {
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import logo from "@/assets/images/logo.png";


function LoginForm() {
  /* =====================================================
     FORM STATE
     ===================================================== */

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [rememberMe, setRememberMe] = useState(false);

  const [showPassword, setShowPassword] = useState(false);


  /* =====================================================
     FORM SUBMISSION
     ===================================================== */

  function handleSubmit(event) {
    event.preventDefault();

    /*
     * Authentication will be connected later.
     *
     * For now, we're simply checking that the
     * form submission works without reloading
     * the browser.
     */

    console.log({
      email,
      password,
      rememberMe,
    });
  }


  return (
    <section
      className="
        login-background
        relative
        flex
        min-h-screen
        w-full
        flex-col
        px-5
        py-6
        sm:px-8
        lg:px-10
        xl:px-14
      "
    >

      {/* =================================================
          TOP SLOGAN
          ================================================= */}

      <header
        className="
          flex
          justify-end
          pr-2
          sm:pr-4
        "
      >
        <div
          className="
            text-right
            text-[8px]
            font-bold
            tracking-[0.18em]
            text-slate-700
            sm:text-[9px]
          "
        >
          <p>
            WORK TODAY.
          </p>

          <p>
            A BETTER{" "}

            <span className="login-slogan-underline">
              TOMORROW.
            </span>
          </p>
        </div>
      </header>


      {/* =================================================
          LOGIN CARD CONTAINER
          ================================================= */}

      <div
        className="
          flex
          flex-1
          items-center
          justify-center
          py-8
        "
      >

        <Card
          className="
            login-card
            w-full
            max-w-[390px]
            border-0
            bg-white
          "
        >

          <CardContent
            className="
              px-6
              py-7
              sm:px-8
              sm:py-8
            "
          >

            {/* ===========================================
                LOGO
                =========================================== */}

            <div
              className="
                mb-4
                flex
                justify-center
              "
            >
              <img
                src={logo}
                alt="Confiable Manpower Solutions Inc."
                className="
                  h-16
                  w-16
                  object-contain
                  sm:h-20
                  sm:w-20
                "
              />
            </div>


            {/* ===========================================
                HEADING
                =========================================== */}

            <div className="text-center">

              <h1
                className="
                  text-xl
                  font-bold
                  tracking-tight
                  text-slate-900
                  sm:text-2xl
                "
              >
                Welcome to VERA
              </h1>


              <p
                className="
                  mt-1
                  text-[10px]
                  font-medium
                  text-slate-600
                  sm:text-xs
                "
              >
                Verified Evaluation and Recruitment Assistant
              </p>


              <p
                className="
                  mt-4
                  text-[10px]
                  text-slate-500
                  sm:text-xs
                "
              >
                Sign in to your account to continue
              </p>

            </div>


            {/* ===========================================
                FORM
                =========================================== */}

            <form
              onSubmit={handleSubmit}
              className="
                mt-6
                space-y-4
              "
            >

              {/* -----------------------------------------
                  EMAIL
                  ----------------------------------------- */}

              <div className="space-y-1.5">

                <Label
                  htmlFor="email"
                  className="sr-only"
                >
                  Email Address
                </Label>


                <div className="relative">

                  <Mail
                    className="
                      login-input-icon
                      absolute
                      left-3
                      top-1/2
                      h-4
                      w-4
                      -translate-y-1/2
                      text-slate-400
                    "
                  />


                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    className="
                      h-10
                      pl-10
                      pr-3
                      text-xs
                      shadow-none
                      focus-visible:ring-1
                      focus-visible:ring-[#003f9e]
                    "
                    required
                  />

                </div>

              </div>


              {/* -----------------------------------------
                  PASSWORD
                  ----------------------------------------- */}

              <div className="space-y-1.5">

                <Label
                  htmlFor="password"
                  className="sr-only"
                >
                  Password
                </Label>


                <div className="relative">

                  <Lock
                    className="
                      login-input-icon
                      absolute
                      left-3
                      top-1/2
                      h-4
                      w-4
                      -translate-y-1/2
                      text-slate-400
                    "
                  />


                  <Input
                    id="password"
                    name="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    autoComplete="current-password"
                    placeholder="Password"
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    className="
                      h-10
                      pl-10
                      pr-10
                      text-xs
                      shadow-none
                      focus-visible:ring-1
                      focus-visible:ring-[#003f9e]
                    "
                    required
                  />


                  {/* Show / Hide password */}

                  <button
                    type="button"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    onClick={() =>
                      setShowPassword(
                        (current) => !current
                      )
                    }
                    className="
                      absolute
                      right-2
                      top-1/2
                      flex
                      h-7
                      w-7
                      -translate-y-1/2
                      items-center
                      justify-center
                      rounded-md
                      text-slate-400
                      transition-colors
                      hover:bg-slate-100
                      hover:text-slate-700
                    "
                  >

                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}

                  </button>

                </div>

              </div>


              {/* =========================================
                  REMEMBER ME / FORGOT PASSWORD
                  ========================================= */}

              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-3
                "
              >

                {/* Remember me */}

                <div
                  className="
                    flex
                    items-center
                    gap-2
                  "
                >

                  <input
                    id="remember"
                    name="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) =>
                      setRememberMe(
                        event.target.checked
                      )
                    }
                    className="
                      h-3.5
                      w-3.5
                      cursor-pointer
                      rounded
                      border-slate-300
                      accent-[#003f9e]
                    "
                  />


                  <Label
                    htmlFor="remember"
                    className="
                      cursor-pointer
                      text-[10px]
                      font-normal
                      text-slate-600
                    "
                  >
                    Remember me
                  </Label>

                </div>


                {/* Forgot password */}

                <a
                  href="/forgot-password"
                  className="
                    text-[10px]
                    font-medium
                    text-[#003f9e]
                    transition-colors
                    hover:text-[#002d73]
                    hover:underline
                  "
                >
                  Forgot password?
                </a>

              </div>


              {/* =========================================
                  LOGIN BUTTON
                  ========================================= */}

              <Button
                type="submit"
                className="
                  h-10
                  w-full
                  rounded-md
                  bg-[#003f9e]
                  text-xs
                  font-semibold
                  text-white
                  shadow-sm
                  hover:bg-[#00327d]
                "
              >
                Log In →
              </Button>


              {/* =========================================
                  DIVIDER
                  ========================================= */}

              <div
                className="
                  flex
                  items-center
                  gap-3
                  py-1
                "
              >

                <div
                  className="
                    h-px
                    flex-1
                    bg-slate-200
                  "
                />


                <span
                  className="
                    text-[9px]
                    text-slate-400
                  "
                >
                  or
                </span>


                <div
                  className="
                    h-px
                    flex-1
                    bg-slate-200
                  "
                />

              </div>


              {/* =========================================
                  GOOGLE LOGIN
                  ========================================= */}

              <Button
                type="button"
                variant="ghost"
                className="
                  h-9
                  w-full
                  text-xs
                  font-medium
                  text-slate-700
                  hover:bg-slate-50
                "
              >
                <span
                  className="
                    mr-2
                    text-sm
                    font-bold
                  "
                >
                  G
                </span>

                Sign in with Google
              </Button>


              {/* =========================================
                  CARD FOOTER
                  ========================================= */}

              <p
                className="
                  pt-2
                  text-center
                  text-[9px]
                  text-slate-400
                "
              >
                Don't have an account?{" "}

                <a
                  href="/contact-administrator"
                  className="
                    font-medium
                    text-[#003f9e]
                    hover:underline
                  "
                >
                  Contact your administrator.
                </a>
              </p>

            </form>

          </CardContent>

        </Card>

      </div>

    </section>
  );
}


export default LoginForm;