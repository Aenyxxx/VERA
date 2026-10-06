import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setRememberMe, supabase } from "@/lib/supabase";

import { loginSchema } from "./schemas";

function messageFor(error) {
  if (error.code === "invalid_credentials" || /invalid login credentials/i.test(error.message)) {
    return "Incorrect email or password.";
  }
  if (error.code === "email_not_confirmed") {
    return "Confirm your email first: open the link we sent you, then log in.";
  }
  if (error.name === "AuthRetryableFetchError" || error.status === 0) {
    return "Can't reach VERA right now. Check your connection and try again.";
  }
  return "We couldn't log you in. Please try again.";
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="text-body-sm text-error">
      {message}
    </p>
  );
}

/**
 * Email + password login with Remember me (FR-AUTH-02, FR-AUTH-03).
 * On success the session changes and RedirectIfSignedIn → "/" sends the user home by role (FR-AUTH-01).
 */
export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  async function onSubmit({ email, password, remember }) {
    setFormError("");
    setRememberMe(remember); // decides where supabase-js stores the session
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setFormError(messageFor(error));
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {formError && (
        <p role="alert" className="rounded-sm bg-error-soft px-3 py-2 text-body text-error">
          {formError}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? "email-error" : undefined}
          {...register("email")}
        />
        <FieldError id="email-error" message={errors.email?.message} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="pr-12"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-sm text-muted-foreground hover:text-heading focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        <FieldError id="password-error" message={errors.password?.message} />
      </div>

      <Controller
        control={control}
        name="remember"
        render={({ field }) => (
          <Label className="w-fit gap-3 py-2 font-normal">
            <Checkbox checked={field.value} onCheckedChange={(checked) => field.onChange(checked === true)} />
            Remember me
          </Label>
        )}
      />

      <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        Log in
      </Button>
    </form>
  );
}
