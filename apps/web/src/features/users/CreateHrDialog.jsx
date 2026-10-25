import { zodResolver } from "@hookform/resolvers/zod";
import { PASSWORD_HINT } from "@vera/shared";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FieldError } from "@/components/shared/FieldError";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useCreateHrAccount } from "./api";
import { createHrSchema } from "./schemas";

/**
 * Add HR account (FR-AUTH-07, decision 19): email, full name, password + confirm (Oct 19 change 1a; only the password
 * is sent). VERA sends no email, so the admin shares the password with the new HR staff member. The API's message
 * (e.g. 409 email taken) is shown in the dialog. Decision 40-1: each password field has a show / hide button. The
 * parent remounts the dialog (key) each time it opens.
 */
export function CreateHrDialog({ open, onOpenChange }) {
  const create = useCreateHrAccount();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createHrSchema),
    defaultValues: { email: "", fullName: "", temporaryPassword: "", confirmPassword: "" },
  });

  const field = (name) => ({
    id: name,
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
    ...register(name),
  });

  function submit({ email, fullName, temporaryPassword }) {
    create.mutate({ email, fullName, temporaryPassword }, {
      onSuccess: (account) => {
        toast.success(`HR account created for ${account.fullName}`);
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[520px]">
        <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Add HR account</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input type="email" autoComplete="off" {...field("email")} />
            <FieldError id="email-error" message={errors.email?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input autoComplete="off" {...field("fullName")} />
            <FieldError id="fullName-error" message={errors.fullName?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="temporaryPassword">Password</Label>
            <PasswordInput autoComplete="new-password" {...field("temporaryPassword")} />
            <p className="text-body-sm text-muted-foreground">{PASSWORD_HINT}.</p>
            <FieldError id="temporaryPassword-error" message={errors.temporaryPassword?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <PasswordInput autoComplete="new-password" {...field("confirmPassword")} />
            <FieldError id="confirmPassword-error" message={errors.confirmPassword?.message} />
          </div>
          {create.error && (
            <p role="alert" className="rounded-md bg-error-soft px-3 py-2 text-body text-error">
              {create.error.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Create HR account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
