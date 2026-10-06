import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";

import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

import { FieldError } from "@/components/shared/FieldError";
import { PASSWORD_RULE, signUpSchema } from "./schemas";

function messageFor(error) {
  if (error.status === 429 || /rate limit/i.test(error.message)) {
    return "Too many sign-up attempts. Wait a few minutes and try again.";
  }
  if (error.name === "AuthRetryableFetchError" || error.status === 0) {
    return "Can't reach VERA right now. Check your connection and try again.";
  }
  if (/password/i.test(error.message)) return error.message;
  return "We couldn't create your account. Please try again.";
}

/**
 * Applicant sign-up (FR-AUTH-02, FR-AUTH-06 simplified): Supabase emails a confirmation link that opens
 * /auth/callback. The account (user_account) is created only once the email is confirmed (DB trigger).
 * Data Privacy Act consent is stored in user_metadata.privacy_consent_at (TRD §14).
 */
export function SignUpForm() {
  const [sentTo, setSentTo] = useState("");
  const [formError, setFormError] = useState("");
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: "", password: "", confirmPassword: "", consent: false },
  });

  async function onSubmit({ email, password }) {
    setFormError("");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { privacy_consent_at: new Date().toISOString() },
      },
    });
    // An already-registered email also lands here without an error, so the form never reveals who has an account.
    if (error) setFormError(messageFor(error));
    else setSentTo(email);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-3 text-center" role="status">
        <MailCheck className="size-10 text-primary" aria-hidden="true" />
        <h2 className="text-section-title font-bold">Check your email</h2>
        <p className="text-body text-muted-foreground">
          We sent a confirmation link to <span className="font-semibold text-heading">{sentTo}</span>. Open it to
          activate your account, then set up your profile.
        </p>
        <Link to="/login" className={buttonVariants({ variant: "secondary", className: "mt-2 w-full" })}>
          Back to login
        </Link>
      </div>
    );
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
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          aria-describedby="password-hint"
          {...register("password")}
        />
        {errors.password ? (
          <FieldError id="password-hint" message={errors.password.message} />
        ) : (
          <p id="password-hint" className="text-body-sm text-muted-foreground">
            {PASSWORD_RULE}.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.confirmPassword)}
          aria-describedby={errors.confirmPassword ? "confirm-error" : undefined}
          {...register("confirmPassword")}
        />
        <FieldError id="confirm-error" message={errors.confirmPassword?.message} />
      </div>

      <Controller
        control={control}
        name="consent"
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <Label className="items-start gap-3 py-1 font-normal leading-normal">
              <Checkbox
                className="mt-0.5"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                aria-invalid={Boolean(errors.consent)}
              />
              <span>
                I agree to the processing of my personal data for recruitment purposes under the Data Privacy Act of
                2012 (RA 10173).
              </span>
            </Label>
            <FieldError id="consent-error" message={errors.consent?.message} />
          </div>
        )}
      />

      <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        Create account
      </Button>
    </form>
  );
}
