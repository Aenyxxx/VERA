import { zodResolver } from "@hookform/resolvers/zod";
import { EDUCATION_LEVEL_LABELS, EDUCATION_LEVELS, GENDER_REQUIREMENT } from "@vera/shared";
import { BriefcaseBusiness, FileText, GraduationCap, ListChecks, Loader2, Lock, Scale, SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { SELECT_CLASS } from "@/components/shared/fieldClasses";
import { FieldError } from "@/components/shared/FieldError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

import { newVacancyValues, POSTING_FIELDS, publishedFormSchema, toFormValues, toPayload, vacancyFormSchema, weightTotal } from "./schemas";

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

// Section card (design 07): white card with a soft blue icon disc next to the heading.
function Section({ title, icon: Icon, description, locked, children, className }) {
  return (
    <fieldset disabled={locked} className="flex min-w-0 flex-col gap-5 rounded-xl bg-card p-4 shadow-card ring-1 ring-border/80 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary" aria-hidden="true">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 pt-1.5">
          <h2 className="flex items-center gap-2 font-heading text-card-title font-bold text-heading">
            {title}
            {locked && <Lock className="size-4 text-muted-foreground" aria-label="Locked after publishing" />}
          </h2>
          {description && <p className="mt-1 text-body-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>{children}</div>
    </fieldset>
  );
}

/**
 * Vacancy form (FR-VAC-01; UI_GUIDELINES §6 groups). mode:
 * - "new" / "draft": everything editable; Save draft or Save and publish (needs weights = 100%).
 * - "published": only posting text and a higher application cap (PRD FR-VAC-03); other groups are locked.
 * `rubric` = GET /api/admin/competencies (sections with items); weights are per section (S9b).
 * onSubmit(payload, { publish }) must return a promise; API field errors are shown next to their fields.
 */
export function VacancyForm({ mode, vacancy, defaults, rubric, companies, onSubmit }) {
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
      const known = details.filter((d) => d.path && d.path !== "sectionWeights");
      known.forEach((d) => setError(d.path, { message: d.message }));
      const weightIssue = details.find((d) => d.path === "sectionWeights");
      if (weightIssue) setError("weights", { message: weightIssue.message });
      if (known.length === 0 && !weightIssue) setFormError(err.message);
    }
  }

  const totalTone = total === 100 ? "bg-success-soft text-success" : total === 0 ? "bg-surface-subtle text-muted-foreground" : "bg-error-soft text-error";

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-6">
      {published && (
        <p className="flex gap-2 rounded-xl bg-info-soft px-4 py-3 text-body text-info ring-1 ring-info/15">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This vacancy is published. Only the posting text and a higher application cap can change, so every applicant is
          screened and scored by the same rules.
        </p>
      )}

      <Section title="Company & position" icon={BriefcaseBusiness}>
        <Field id="companyId" label="Company" error={error("companyId")}>
          <select className={SELECT_CLASS} disabled={published} {...field("companyId")}>
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
        <Field id="deploymentLocation" label="Deployment location" error={error("deploymentLocation")}>
          <Input placeholder="e.g. Baliuag, Bulacan" {...field("deploymentLocation")} />
        </Field>
        <Field id="employmentType" label="Employment type" error={error("employmentType")}>
          <Input placeholder="e.g. Full-time, Contractual" {...field("employmentType")} />
        </Field>
      </Section>

      <Section title="Job description" icon={FileText} className="sm:grid-cols-1 lg:grid-cols-2">
        <Field id="jobDescription" label="Description" error={error("jobDescription")}>
          <Textarea {...field("jobDescription")} />
        </Field>
        <Field id="keyResponsibilities" label="Key responsibilities" hint="One per line." error={error("keyResponsibilities")}>
          <Textarea {...field("keyResponsibilities")} />
        </Field>
      </Section>

      <Section title="Requirements" icon={ListChecks} locked={published} className="sm:grid-cols-1 lg:grid-cols-2">
        <Field id="requiredSkills" label="Required skills" hint="One skill per line." error={error("requiredSkills")}>
          <Textarea {...field("requiredSkills")} />
        </Field>
        <Field id="experienceRequirement" label="Experience requirement (optional)" error={error("experienceRequirement")}>
          <Textarea {...field("experienceRequirement")} />
        </Field>
      </Section>

      <Section title="Qualifications (prescreen)" icon={GraduationCap} locked={published} className="lg:grid-cols-3">
        <Field id="minAge" label="Minimum age (optional)" error={error("minAge")}>
          <Input type="number" min="15" step="1" {...field("minAge")} />
        </Field>
        <Field id="maxAge" label="Maximum age (optional)" error={error("maxAge")}>
          <Input type="number" min="15" step="1" {...field("maxAge")} />
        </Field>
        <Field id="genderRequirement" label="Gender" error={error("genderRequirement")}>
          <select className={SELECT_CLASS} {...field("genderRequirement")}>
            {Object.values(GENDER_REQUIREMENT).map((g) => (
              <option key={g} value={g}>
                {GENDER_LABELS[g]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="minEducationLevel" label="Minimum education (optional)" error={error("minEducationLevel")}>
          <select className={SELECT_CLASS} {...field("minEducationLevel")}>
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

      <Section title="Selection Settings" icon={SlidersHorizontal} className="lg:grid-cols-3">
        <fieldset disabled={published} className="contents">
          <Field id="slotsNeeded" label="Slots needed" error={error("slotsNeeded")}>
            <Input type="number" min="1" step="1" {...field("slotsNeeded")} />
          </Field>
        </fieldset>
        <Field
          id="applicationCap"
          label="Application cap"
          hint={published ? `Can only be raised (now ${vacancy.applicationCap}).` : undefined}
          error={error("applicationCap")}
        >
          <Input type="number" min="1" step="1" {...field("applicationCap")} />
        </Field>
        <fieldset disabled={published} className="contents">
          <Field id="endorsementCount" label="Endorsement count" hint="At least the number of slots." error={error("endorsementCount")}>
            <Input type="number" min="1" step="1" {...field("endorsementCount")} />
          </Field>
          <Field id="matchingThreshold" label="Matching threshold (%)" error={error("matchingThreshold")}>
            <Input type="number" min="0" max="100" step="0.01" {...field("matchingThreshold")} />
          </Field>
          <Field id="passingScore" label="Passing score (%)" hint="Final score needed to pass." error={error("passingScore")}>
            <Input type="number" min="0" max="100" step="0.01" {...field("passingScore")} />
          </Field>
        </fieldset>
      </Section>

      <Section
        title="Competency weights"
        icon={Scale}
        description="Set how much each section counts. Weights must total 100%."
        locked={published}
        className="sm:grid-cols-1"
      >
        <ul className="flex flex-col gap-2">
          {rubric.map((section) => {
            const name = `weights.${section.sectionCode}`;
            const weightError = errors.weights?.[section.sectionCode]?.message;
            return (
              <li key={section.sectionCode} className="flex flex-col gap-2 rounded-lg bg-surface-blue px-4 py-3 ring-1 ring-border/80">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label htmlFor={name} className="font-semibold text-heading">
                    {section.sectionCode}. {section.sectionName}
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
                </div>
                <p className="text-body-sm text-muted-foreground">{section.items.map((item) => item.competencyName).join(" · ")}</p>
                {weightError && <FieldError id={`${name}-error`} message={weightError} />}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <span className="text-body-sm text-muted-foreground">An empty section counts as 0%.</span>
          <Badge className={cn("px-3 py-1 font-heading text-body font-bold tabular", totalTone)} role="status" aria-label={`Total ${total}%`}>
            Total {total}%
          </Badge>
        </div>
        <FieldError id="weights-error" message={errors.weights?.message} />
      </Section>

      {formError && (
        <p role="alert" className="rounded-lg bg-error-soft px-4 py-3 text-body text-error">
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
