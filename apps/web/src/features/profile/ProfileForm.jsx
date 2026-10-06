import { zodResolver } from "@hookform/resolvers/zod";
import { EDUCATION_LEVEL_LABELS, EDUCATION_LEVELS } from "@vera/shared";
import { Loader2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import { FieldError } from "@/components/shared/FieldError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ageFrom } from "@/lib/format";
import { cn } from "@/lib/utils";

import { profileSchema, toFormValues } from "./schemas";

const selectClass =
  "h-11 w-full rounded-sm border border-input bg-card px-3 text-body-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-body";

function Field({ id, label, hint, error, className, children }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <FieldError id={`${id}-error`} message={error} /> : hint && <p className="text-body-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="mb-3 w-full border-b pb-2 text-card-title font-semibold text-heading">{title}</legend>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/**
 * The applicant's profile card (FR-PROF-02/04): every field editable, age computed from the birthday,
 * email read-only (it is the login). Used by setup (confirm) and by the dashboard profile card (view/edit).
 * `readOnly` shows the same fields disabled, without the action footer.
 */
export function ProfileForm({
  profile,
  email,
  onSubmit,
  readOnly = false,
  submitting = false,
  submitLabel = "Confirm profile",
  serverError,
  secondaryAction,
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm({ resolver: zodResolver(profileSchema), defaultValues: toFormValues(profile) });

  const birthdate = useWatch({ control, name: "birthdate" });
  const age = ageFrom(birthdate);

  const input = (name) => ({
    id: name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
    ...register(name),
  });

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-8">
      <fieldset
        disabled={readOnly}
        className={cn(
          "flex min-w-0 flex-col gap-8",
          // view mode: same layout, full-contrast text instead of the faded disabled look
          readOnly && "[&_input:disabled]:text-heading [&_input:disabled]:opacity-100 [&_select:disabled]:text-heading [&_select:disabled]:opacity-100",
        )}
      >
        <Section title="Personal information">
          <Field id="firstName" label="First name" error={errors.firstName?.message}>
            <Input autoComplete="given-name" {...input("firstName")} />
          </Field>
          <Field id="middleName" label="Middle name (optional)" error={errors.middleName?.message}>
            <Input autoComplete="additional-name" {...input("middleName")} />
          </Field>
          <Field id="lastName" label="Last name" error={errors.lastName?.message}>
            <Input autoComplete="family-name" {...input("lastName")} />
          </Field>
          <Field id="suffix" label="Suffix (optional)" hint="e.g. Jr., Sr., III" error={errors.suffix?.message}>
            <Input autoComplete="honorific-suffix" {...input("suffix")} />
          </Field>
          <Field id="birthdate" label="Birthday" error={errors.birthdate?.message}>
            <Input type="date" autoComplete="bday" {...input("birthdate")} />
          </Field>
          <Field id="age" label="Age">
            <Input id="age" value={age ?? ""} placeholder="From your birthday" readOnly disabled />
          </Field>
          <Field id="gender" label="Gender" error={errors.gender?.message}>
            <select className={selectClass} {...input("gender")}>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field id="heightCm" label="Height in cm (optional)" error={errors.heightCm?.message}>
            <Input type="number" inputMode="decimal" step="0.1" {...input("heightCm")} />
          </Field>
          <Field id="email" label="Email">
            <Input id="email" value={email ?? ""} readOnly disabled />
          </Field>
          <Field id="contactNumber" label="Contact number (optional)" hint="e.g. 0917 123 4567" error={errors.contactNumber?.message}>
            <Input type="tel" autoComplete="tel" {...input("contactNumber")} />
          </Field>
        </Section>

        <Section title="Address">
          <Field id="addressLine" label="House number / street" className="sm:col-span-2" error={errors.addressLine?.message}>
            <Input autoComplete="street-address" {...input("addressLine")} />
          </Field>
          <Field id="city" label="Municipality / city" error={errors.city?.message}>
            <Input autoComplete="address-level2" {...input("city")} />
          </Field>
          <Field id="province" label="Province" error={errors.province?.message}>
            <Input autoComplete="address-level1" {...input("province")} />
          </Field>
        </Section>

        <Section title="Education">
          <Field id="educationLevel" label="Highest education level" error={errors.educationLevel?.message}>
            <select className={selectClass} {...input("educationLevel")}>
              <option value="">Select education level</option>
              {EDUCATION_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {EDUCATION_LEVEL_LABELS[level]}
                </option>
              ))}
            </select>
          </Field>
        </Section>
      </fieldset>

      {serverError && (
        <p role="alert" className="rounded-sm bg-error-soft px-3 py-2 text-body text-error">
          {serverError}
        </p>
      )}

      {!readOnly && (
        <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
          {secondaryAction}
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
