import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Building2, Loader2, Save, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { FieldError } from "@/components/shared/FieldError";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

import { useCompany, useCreateCompany, useUpdateCompany } from "./api";
import { companySchema, toFormValues } from "./schemas";

// Each group is a ringed panel (design 04). The panel wraps the fieldset so the legend is not drawn on its border.
const GROUP_CLASS = "rounded-xl bg-card p-4 ring-1 ring-border/80 sm:p-5";

function GroupLegend({ icon: Icon, children }) {
  return (
    <legend className="mb-4 flex items-center gap-3 font-heading text-card-title font-bold text-heading">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      {children}
    </legend>
  );
}

function Field({ id, label, error, className, children }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/**
 * Add / edit a client company (FR-COMP-02). Company information and the contact person are separate groups
 * (DESIGN.md "Company and vacancy forms"). A duplicate name (409) is shown under the name field (TC-21).
 * Pass `companyId` to edit: the full company is loaded first (list rows do not carry every field).
 * The parent remounts the dialog (key) each time it opens.
 */
export function CompanyFormDialog({ open, onOpenChange, companyId = null }) {
  const existing = useCompany(companyId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-[640px]">
        {!companyId || existing.data ? (
          <CompanyForm company={existing.data ?? null} onDone={() => onOpenChange(false)} />
        ) : existing.isError ? (
          <EmptyState icon={AlertCircle} title="The company could not be loaded" description={existing.error.message} />
        ) : (
          <div className="flex flex-col gap-3" aria-busy="true">
            <DialogTitle>Edit company</DialogTitle>
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CompanyForm({ company, onDone }) {
  const create = useCreateCompany();
  const update = useUpdateCompany(company?.companyId);
  const mutation = company ? update : create;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({ resolver: zodResolver(companySchema), defaultValues: toFormValues(company) });

  const field = (name) => ({
    id: name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
    ...register(name),
  });

  function submit(values) {
    mutation.mutate(values, {
      onSuccess: () => {
        toast.success(company ? "Company updated" : "Company added");
        onDone();
      },
      onError: (error) => {
        // Server field errors (e.g. duplicate name) go next to their field.
        if (error instanceof ApiError && Array.isArray(error.details)) {
          for (const detail of error.details) {
            if (detail.path in values) setError(detail.path, { message: detail.message });
          }
        }
      },
    });
  }

  const fieldErrorFromServer = mutation.error instanceof ApiError && Array.isArray(mutation.error.details);

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{company ? "Edit company" : "Add company"}</DialogTitle>
      </DialogHeader>

      <div className={GROUP_CLASS}>
        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GroupLegend icon={Building2}>Company information</GroupLegend>
          <Field id="companyName" label="Company name" error={errors.companyName?.message}>
            <Input autoComplete="organization" {...field("companyName")} />
          </Field>
          <Field id="industry" label="Industry" error={errors.industry?.message}>
            <Input placeholder="e.g. Retail" {...field("industry")} />
          </Field>
          <Field id="description" label="Description" className="sm:col-span-2" error={errors.description?.message}>
            <Textarea {...field("description")} />
          </Field>
          <Field id="website" label="Website (optional)" className="sm:col-span-2" error={errors.website?.message}>
            <Input placeholder="e.g. kabayanmart.com" {...field("website")} />
          </Field>
        </fieldset>
      </div>

      <div className={GROUP_CLASS}>
        <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GroupLegend icon={UserRound}>Contact person</GroupLegend>
          <Field id="contactPersonName" label="Name" error={errors.contactPersonName?.message}>
            <Input {...field("contactPersonName")} />
          </Field>
          <Field id="contactPersonPosition" label="Position" error={errors.contactPersonPosition?.message}>
            <Input {...field("contactPersonPosition")} />
          </Field>
          <Field id="contactEmail" label="Email" error={errors.contactEmail?.message}>
            <Input type="email" {...field("contactEmail")} />
          </Field>
          <Field id="contactNumber" label="Contact number" error={errors.contactNumber?.message}>
            <Input type="tel" {...field("contactNumber")} />
          </Field>
        </fieldset>
      </div>

      {mutation.error && !fieldErrorFromServer && (
        <p role="alert" className="rounded-md bg-error-soft px-3 py-2 text-body text-error">
          {mutation.error.message}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          Save company
        </Button>
      </DialogFooter>
    </form>
  );
}
