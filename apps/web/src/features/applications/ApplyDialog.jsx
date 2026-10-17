import { zodResolver } from "@hookform/resolvers/zod";
import { APPLICANT_TYPE, DOCUMENT_TYPE_LABELS } from "@vera/shared";
import { BriefcaseBusiness, Loader2, Send } from "lucide-react";
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

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-2 text-body font-semibold text-heading">Attach documents to this application?</legend>
      {documents.isPending ? (
        <Skeleton className="h-11 w-full" aria-label="Loading your documents" />
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
              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                <Label className="gap-3 py-1 font-semibold">
                  <Checkbox
                    checked={field.value.length === allIds.length}
                    onCheckedChange={(checked) => field.onChange(checked === true ? allIds : [])}
                  />
                  Select all
                </Label>
                {list.map((doc) => (
                  <Label key={doc.documentId} className="items-start gap-3 py-1 font-normal leading-normal">
                    <Checkbox
                      className="mt-0.5"
                      checked={field.value.includes(doc.documentId)}
                      onCheckedChange={(checked) => toggle(doc.documentId, checked === true)}
                    />
                    <span className="flex flex-col">
                      <span className="text-body text-heading">{documentName(doc)}</span>
                      <span className="text-body-sm text-muted-foreground">{doc.fileName}</span>
                    </span>
                  </Label>
                ))}
              </div>
            );
          }}
        />
      )}
    </fieldset>
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
      <DialogContent showCloseButton={!apply.isPending}>
        <DialogHeader className="flex-row items-start gap-3 pr-8">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary">
            <BriefcaseBusiness className="size-5" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-1">
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
            <fieldset className="flex flex-col gap-2" disabled={apply.isPending}>
              <legend className="mb-2 text-body font-semibold text-heading">Which describes you?</legend>
              <Controller
                name="applicantType"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    aria-invalid={errors.applicantType ? true : undefined}
                    aria-describedby={errors.applicantType ? "applicantType-error" : undefined}
                  >
                    {OPTIONS.map((option) => (
                      <div
                        key={option.value}
                        className={cn(
                          "flex items-start gap-3 rounded-md border p-4 transition-colors",
                          field.value === option.value ? "border-primary bg-surface-blue" : "hover:bg-surface-blue",
                        )}
                      >
                        <RadioGroupItem
                          id={`applicantType-${option.value}`}
                          value={option.value}
                          aria-describedby={`applicantType-${option.value}-hint`}
                          className="mt-0.5"
                        />
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`applicantType-${option.value}`} className="cursor-pointer text-body-lg">
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
      <div className="flex flex-col items-start gap-3 rounded-md border bg-surface-subtle p-4" role="status">
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
