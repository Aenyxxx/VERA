import { zodResolver } from "@hookform/resolvers/zod";
import { EDUCATION_LEVEL_LABELS, EDUCATION_LEVELS, GENDER_REQUIREMENT } from "@vera/shared";
import { Loader2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { FieldError } from "@/components/shared/FieldError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

import { newVacancyValues, POSTING_FIELDS, publishedFormSchema, toFormValues, toPayload, vacancyFormSchema, weightTotal } from "./schemas";

const selectClass =
  "h-11 w-full rounded-sm border border-input bg-card px-3 text-body outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-surface-subtle disabled:opacity-70 aria-invalid:border-destructive";

const GENDER_LABELS = { any: "Any", male: "Male only", female: "Female only" };

function Field({ id, label, hint, error, className, children }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <FieldError id={`${id}-error`} message={error} /> : hint && <p className="text-body-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({ title, description, locked, children, className }) {
  return (
    <fieldset disabled={locked} className="flex min-w-0 flex-col gap-4 rounded-md border bg-card p-6">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="flex items-center gap-2 text-card-title font-semibold text-heading">
          {title}
          {locked && <Lock className="size-4 text-muted-foreground" aria-label="Locked after publishing" />}
        </h2>
        {description && <p className="mt-1 text-body-sm text-muted-foreground">{description}</p>}
      </div>
      <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>{children}</div>
    </fieldset>
  );
}

/**
 * Vacancy form (FR-VAC-01; UI_GUIDELINES §6 groups). mode:
 * - "new" / "draft": everything editable; Save draft or Save and publish (needs weights = 100%).
 * - "published": only posting text and a higher application cap (PRD FR-VAC-03); other groups are locked.
 * onSubmit(payload, { publish }) must return a promise; API field errors are shown next to their fields.
 */
export function VacancyForm({ mode, vacancy, defaults, competencies, companies, onSubmit }) {
  const published = mode === "published";
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(published ? publishedFormSchema(vacancy.applicationCap) : vacancyFormSchema),
    defaultValues: vacancy ? toFormValues(vacancy) : newVacancyValues(defaults),
  });

  const slots = useWatch({ control, name: "slotsNeeded" });
  const weights = useWatch({ control, name: "weights" });
  const total = weightTotal(weights);

  // New vacancy: cap follows slots × capMultiplier and the endorsement count follows slots until HR edits them (BR-02/03).
  useEffect(() => {
    if (mode !== "new") return;
    const n = Number(slots);
    if (!Number.isInteger(n) || n < 1) return;
    if (!getFieldState("applicationCap").isDirty) setValue("applicationCap", String(n * defaults.capMultiplier));
    if (!getFieldState("endorsementCount").isDirty) setValue("endorsementCount", String(n));
  }, [mode, slots, defaults, getFieldState, setValue]);

  const field = (name) => ({
    id: name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
    ...register(name),
  });
  const error = (name) => errors[name]?.message;

  // The clicked button tells us whether to publish (its value is the form submitter).
  async function submit(values, event) {
    setFormError("");
    const publish = event?.nativeEvent?.submitter?.value === "publish";
    const payload = published
      ? Object.fromEntries([...POSTING_FIELDS, "applicationCap"].map((key) => [key, values[key]]))
      : toPayload(values);
    try {
      await onSubmit(payload, { publish });
    } catch (err) {
      const details = err instanceof ApiError && Array.isArray(err.details) ? err.details : [];
      const known = details.filter((d) => d.path && d.path !== "competencies");
      known.forEach((d) => setError(d.path, { message: d.message }));
      const weightIssue = details.find((d) => d.path === "competencies");
      if (weightIssue) setError("weights", { message: weightIssue.message });
      if (known.length === 0 && !weightIssue) setFormError(err.message);
    }
  }

  const totalTone = total === 100 ? "bg-success-soft text-success" : total === 0 ? "bg-surface-subtle text-muted-foreground" : "bg-error-soft text-error";
  const shortlist = Number.isInteger(Number(slots)) && Number(slots) > 0 ? Number(slots) * 2 : "—";

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-6">
      {published && (
        <p className="flex gap-2 rounded-sm bg-info-soft px-3 py-2 text-body text-info">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This vacancy is published. Only the posting text and a higher application cap can change, so every applicant is
          screened and scored by the same rules.
        </p>
      )}

      <Section title="Company & position">
        <Field id="companyId" label="Company" error={error("companyId")}>
          <select className={selectClass} disabled={published} {...field("companyId")}>
            <option value="">Select a company</option>
            {companies.map((c) => (
              <option key={c.companyId} value={c.companyId}>
                {c.companyName}
              </option>
            ))}
          </select>
        </Field>
        <Field id="jobTitle" label="Job title" error={error("jobTitle")}>
          <Input {...field("jobTitle")} />
        </Field>
        <Field id="deploymentLocation" label="Deployment location (optional)" error={error("deploymentLocation")}>
          <Input placeholder="e.g. Baliuag, Bulacan" {...field("deploymentLocation")} />
        </Field>
        <Field id="employmentType" label="Employment type (optional)" error={error("employmentType")}>
          <Input placeholder="e.g. Full-time, Contractual" {...field("employmentType")} />
        </Field>
      </Section>

      <Section title="Job description" className="sm:grid-cols-1">
        <Field id="jobDescription" label="Description" error={error("jobDescription")}>
          <Textarea {...field("jobDescription")} />
        </Field>
        <Field id="keyResponsibilities" label="Key responsibilities" hint="One per line." error={error("keyResponsibilities")}>
          <Textarea {...field("keyResponsibilities")} />
        </Field>
      </Section>

      <Section
        title="Requirements"
        description="Used for resume matching (SBERT): write short phrases, one per line."
        locked={published}
        className="sm:grid-cols-1"
      >
        <Field id="requiredSkills" label="Required skills" hint="One skill per line, e.g. Cash handling." error={error("requiredSkills")}>
          <Textarea {...field("requiredSkills")} />
        </Field>
        <Field
          id="experienceRequirement"
          label="Experience requirement (optional)"
          hint="Job title on the first line, then one duty per line."
          error={error("experienceRequirement")}
        >
          <Textarea {...field("experienceRequirement")} />
        </Field>
        <Field id="minYearsExperience" label="Minimum years of experience" error={error("minYearsExperience")} className="sm:max-w-xs">
          <Input type="number" min="0" step="1" {...field("minYearsExperience")} />
        </Field>
      </Section>

      <Section
        title="Qualifications (prescreen)"
        description="Basic conditions checked before matching. They are never used in any score."
        locked={published}
      >
        <Field id="minAge" label="Minimum age (optional)" error={error("minAge")}>
          <Input type="number" min="15" step="1" {...field("minAge")} />
        </Field>
        <Field id="maxAge" label="Maximum age (optional)" error={error("maxAge")}>
          <Input type="number" min="15" step="1" {...field("maxAge")} />
        </Field>
        <Field id="genderRequirement" label="Gender" error={error("genderRequirement")}>
          <select className={selectClass} {...field("genderRequirement")}>
            {Object.values(GENDER_REQUIREMENT).map((g) => (
              <option key={g} value={g}>
                {GENDER_LABELS[g]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="minEducationLevel" label="Minimum education (optional)" error={error("minEducationLevel")}>
          <select className={selectClass} {...field("minEducationLevel")}>
            <option value="">Any</option>
            {EDUCATION_LEVELS.map((level) => (
              <option key={level} value={level}>
                {EDUCATION_LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="minHeightCm" label="Minimum height in cm (optional)" error={error("minHeightCm")}>
          <Input type="number" min="100" max="250" step="0.1" {...field("minHeightCm")} />
        </Field>
      </Section>

      <Section title="Pipeline settings" description="How many applicants move through each stage.">
        <fieldset disabled={published} className="contents">
          <Field id="slotsNeeded" label="Slots needed" hint={`Shortlist per group: slots × 2 = ${shortlist}`} error={error("slotsNeeded")}>
            <Input type="number" min="1" step="1" {...field("slotsNeeded")} />
          </Field>
        </fieldset>
        <Field
          id="applicationCap"
          label="Application cap"
          hint={published ? `Can only be raised (now ${vacancy.applicationCap}).` : "At least slots × 4; default slots × 8."}
          error={error("applicationCap")}
        >
          <Input type="number" min="1" step="1" {...field("applicationCap")} />
        </Field>
        <fieldset disabled={published} className="contents">
          <Field id="endorsementCount" label="Endorsement count" hint="At least the number of slots." error={error("endorsementCount")}>
            <Input type="number" min="1" step="1" {...field("endorsementCount")} />
          </Field>
          <Field id="matchingThreshold" label="Matching threshold (%)" hint="Below this, applicants are not shortlisted." error={error("matchingThreshold")}>
            <Input type="number" min="0" max="100" step="0.01" {...field("matchingThreshold")} />
          </Field>
          <Field id="passingScore" label="Passing score (%)" hint="Final score needed to pass." error={error("passingScore")}>
            <Input type="number" min="0" max="100" step="0.01" {...field("passingScore")} />
          </Field>
        </fieldset>
      </Section>

      <Section
        title="Competency weights"
        description="The interview rubric: give a weight to each competency you will rate. Weights must total 100%."
        locked={published}
        className="sm:grid-cols-1"
      >
        <ul className="flex flex-col divide-y rounded-md border">
          {competencies.map((c) => {
            const name = `weights.${c.competencyId}`;
            const weightError = errors.weights?.[c.competencyId]?.message;
            return (
              <li key={c.competencyId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2">
                <Label htmlFor={name} className="font-normal">
                  {c.competencyName}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={name}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    placeholder="0"
                    className="w-24 text-right tabular"
                    aria-invalid={Boolean(weightError)}
                    {...register(name)}
                  />
                  <span className="text-body text-muted-foreground">%</span>
                </div>
                {weightError && <FieldError id={`${name}-error`} message={weightError} />}
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-between gap-3">
          <span className="text-body-sm text-muted-foreground">Leave a competency empty to leave it out.</span>
          <Badge className={cn("text-body", totalTone)} role="status" aria-label={`Total ${total}%`}>
            Total {total}%
          </Badge>
        </div>
        <FieldError id="weights-error" message={errors.weights?.message} />
      </Section>

      {formError && (
        <p role="alert" className="rounded-sm bg-error-soft px-3 py-2 text-body text-error">
          {formError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {published ? (
          <Button type="submit" value="save" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save changes
          </Button>
        ) : (
          <>
            <Button type="submit" value="save" variant="secondary" disabled={isSubmitting}>
              Save draft
            </Button>
            <Button type="submit" value="publish" disabled={isSubmitting || total !== 100}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              Save and publish
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
