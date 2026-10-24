import { zodResolver } from "@hookform/resolvers/zod";
import { APPLICANT_TYPE, DOCUMENT_TYPE_LABELS } from "@vera/shared";
import { BriefcaseBusiness, FileText, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { FieldError } from "@/components/shared/FieldError";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocuments } from "@/features/documents/api";
import { cn } from "@/lib/utils";

import { useApply } from "./api";
import { applySchema } from "./schemas";

const OPTIONS = [
  {
    value: APPLICANT_TYPE.FIRST_TIME,
    label: "First-time job seeker",
    hint: "You have no work experience yet. Your skills are matched to the job.",
  },
  {
    value: APPLICANT_TYPE.EXPERIENCED,
    label: "Experienced",
    hint: "You have worked before. Your skills and work experience are matched to the job.",
  },
];

const documentName = (doc) =>
  doc.label ? `${DOCUMENT_TYPE_LABELS[doc.documentType]} (${doc.label})` : DOCUMENT_TYPE_LABELS[doc.documentType];

/**
 * Decision 16: "Attach documents to this application?" — the applicant's current documents, none checked. Optional:
 * the agency may still request documents later, and verification stays per document.
 */
function AttachDocuments({ control, disabled }) {
  const documents = useDocuments();
  const list = documents.data ?? [];

  // Design 36: a soft blue panel; each document is a white row card, blue when checked.
  return (
    <div className="rounded-xl bg-surface-blue p-3 ring-1 ring-border sm:p-4">
      <fieldset className="flex min-w-0 flex-col gap-2" disabled={disabled}>
        <legend className="mb-3 flex items-center gap-3 font-heading text-body-lg font-bold text-heading">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-primary ring-1 ring-border"
            aria-hidden="true"
          >
            <FileText className="size-5" />
          </span>
          Attach documents to this application?
        </legend>
        {documents.isPending ? (
          <Skeleton className="h-11 w-full rounded-lg" aria-label="Loading your documents" />
        ) : documents.isError ? (
          <p className="text-body-sm text-muted-foreground">
            Your documents could not be loaded. You can still apply; the agency may request them later.
          </p>
        ) : list.length === 0 ? (
          <p className="text-body-sm text-muted-foreground">
            You have no documents yet. Upload them in My Documents; the agency may request them later.
          </p>
        ) : (
          <Controller
            name="attachDocumentIds"
            control={control}
            render={({ field }) => {
              const allIds = list.map((doc) => doc.documentId);
              const toggle = (id, checked) =>
                field.onChange(checked ? [...field.value, id] : field.value.filter((value) => value !== id));
              return (
                <div className="flex max-h-56 flex-col gap-2 overflow-y-auto p-0.5">
                  <Label className="gap-3 border-b border-border px-3 pt-1 pb-2.5 font-semibold text-heading">
                    <Checkbox
                      checked={field.value.length === allIds.length}
                      onCheckedChange={(checked) => field.onChange(checked === true ? allIds : [])}
                    />
                    Select all
                  </Label>
                  {list.map((doc) => {
                    const checked = field.value.includes(doc.documentId);
                    return (
                      <Label
                        key={doc.documentId}
                        className={cn(
                          "min-w-0 items-center gap-3 rounded-lg border bg-card px-3 py-2.5 font-normal leading-normal transition-colors",
                          checked ? "border-primary bg-primary-soft" : "border-border hover:border-input",
                        )}
                      >
                        <Checkbox checked={checked} onCheckedChange={(next) => toggle(doc.documentId, next === true)} />
                        <FileText className="size-6 shrink-0 text-primary" aria-hidden="true" />
                        <span className="flex min-w-0 flex-col">
                          <span className="text-body font-semibold text-heading">{documentName(doc)}</span>
                          <span className="text-body-sm break-all text-muted-foreground">{doc.fileName}</span>
                        </span>
                      </Label>
                    );
                  })}
                </div>
              );
            }}
          />
        )}
      </fieldset>
    </div>
  );
}

/**
 * Apply dialog (PRD FR-APP-02; rebuilt from the legacy ApplicationModal / ApplicationHeader / ApplicationActions).
 * One required radio button; the saved profile and current resume are used. Decision 16: the applicant may also
 * attach documents they already uploaded (optional). Prescreen and matching run right away, and the outcome is
 * shown in the dialog. The parent remounts the dialog (key) each time it opens.
 */
export function ApplyDialog({ open, onOpenChange, job }) {
  const apply = useApply();
  const [result, setResult] = useState(null);
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(applySchema), defaultValues: { applicantType: "", attachDocumentIds: [] } });
  const chosen = useWatch({ control, name: "applicantType" });

  function submit({ applicantType, attachDocumentIds }) {
    apply.mutate(
      { vacancyId: job.vacancyId, applicantType, attachDocumentIds },
      {
        onSuccess: (data) => setResult(data),
        onError: (error) => {
          toast.error(error.message);
          if (error.status === 404 || error.status === 409) onOpenChange(false); // closed, already applied, …
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !apply.isPending && onOpenChange(next)}>
      <DialogContent showCloseButton={!apply.isPending} className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader className="flex-row items-start gap-3 pr-8 sm:gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-primary/15">
            <BriefcaseBusiness className="size-6" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-1 pt-0.5">
            <DialogTitle>Apply for {job.jobTitle}</DialogTitle>
            <DialogDescription>
              {result
                ? "Here is the result of your application."
                : "Your saved profile and current resume will be used. You can also attach documents you already uploaded."}
            </DialogDescription>
          </div>
        </DialogHeader>

        {result ? (
          <ApplyResult result={result} onClose={() => onOpenChange(false)} />
        ) : (
          <form onSubmit={handleSubmit(submit)} noValidate className="flex flex-col gap-5">
            <fieldset className="flex min-w-0 flex-col gap-2" disabled={apply.isPending}>
              <legend className="mb-3 font-heading text-body-lg font-bold text-heading">Which describes you?</legend>
              <Controller
                name="applicantType"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    className="sm:grid-cols-2"
                    value={field.value}
                    onValueChange={field.onChange}
                    aria-invalid={errors.applicantType ? true : undefined}
                    aria-describedby={errors.applicantType ? "applicantType-error" : undefined}
                  >
                    {OPTIONS.map((option) => (
                      <div
                        key={option.value}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors",
                          field.value === option.value
                            ? "border-primary bg-primary-soft ring-1 ring-primary"
                            : "border-border hover:border-input hover:bg-surface-blue",
                        )}
                      >
                        <RadioGroupItem
                          id={`applicantType-${option.value}`}
                          value={option.value}
                          aria-describedby={`applicantType-${option.value}-hint`}
                          className="mt-0.5"
                        />
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`applicantType-${option.value}`} className="cursor-pointer text-body-lg font-semibold text-heading">
                            {option.label}
                          </Label>
                          <p id={`applicantType-${option.value}-hint`} className="text-body-sm text-muted-foreground">
                            {option.hint}
                          </p>
                        </div>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              />
              <FieldError id="applicantType-error" message={errors.applicantType?.message} />
            </fieldset>

            <AttachDocuments control={control} disabled={apply.isPending} />

            <DialogFooter>
              <Button type="button" variant="secondary" disabled={apply.isPending} onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!chosen || apply.isPending}>
                {apply.isPending ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Checking your qualifications…
                  </>
                ) : (
                  <>
                    <Send aria-hidden="true" />
                    Submit application
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The outcome right after applying: the applicant stage label (APP_FLOW §6) and the message. No score. */
function ApplyResult({ result, onClose }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-start gap-3 rounded-xl bg-surface-blue p-4 ring-1 ring-border" role="status">
        <StatusBadge kind="application" value={result.status} audience="applicant" />
        <p className="text-body text-text">{result.message}</p>
      </div>
      <DialogFooter>
        <Link to="/applicant" className={buttonVariants({ variant: "secondary" })} onClick={onClose}>
          Go to My Profile
        </Link>
        <Button type="button" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </div>
  );
}
