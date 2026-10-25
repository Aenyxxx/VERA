import { zodResolver } from "@hookform/resolvers/zod";
import { PASSWORD_HINT } from "@vera/shared";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { FieldError } from "@/components/shared/FieldError";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useUpdateStaff } from "./api";
import { editStaffSchema } from "./schemas";

/**
 * Edit a staff account (Oct 19 change 1b): full name and password only; the email is never editable (decision 40-1:
 * no longer repeated in the description). A blank password keeps the current one. Only the changed fields are sent.
 * Decision 40-1: each password field has a show / hide button. The parent remounts the dialog (key) each time.
 */
export function EditStaffDialog({ account, onOpenChange }) {
  const update = useUpdateStaff();
  const [nothingChanged, setNothingChanged] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(editStaffSchema),
    defaultValues: { fullName: account.fullName ?? "", password: "", confirmPassword: "" },
  });
  const name = account.fullName || account.email;

  const field = (id) => ({
    id,
    "aria-invalid": Boolean(errors[id]),
    "aria-describedby": errors[id] ? `${id}-error` : undefined,
    ...register(id),
  });

  function submit(values) {
    const body = {};
    if (values.fullName !== (account.fullName ?? "")) body.fullName = values.fullName;
    if (values.password) body.password = values.password;
    if (Object.keys(body).length === 0) {
      setNothingChanged(true);
      return;
    }
    setNothingChanged(false);
    update.mutate(
      { userId: account.userId, ...body },
      {
        onSuccess: () => {
          toast.success(`Saved the changes for ${body.fullName ?? name}`);
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-[520px]">
        <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Edit {name}</DialogTitle>
            <DialogDescription>Share a new password with the staff member.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input autoComplete="off" {...field("fullName")} />
            <FieldError id="fullName-error" message={errors.fullName?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">New password</Label>
            <PasswordInput autoComplete="new-password" {...field("password")} />
            <p className="text-body-sm text-muted-foreground">Leave blank to keep the current password. {PASSWORD_HINT}.</p>
            <FieldError id="password-error" message={errors.password?.message} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <PasswordInput autoComplete="new-password" {...field("confirmPassword")} />
            <FieldError id="confirmPassword-error" message={errors.confirmPassword?.message} />
          </div>
          {nothingChanged && <p className="text-body-sm text-muted-foreground">Nothing to change.</p>}
          {update.error && (
            <p role="alert" className="rounded-md bg-error-soft px-3 py-2 text-body text-error">
              {update.error.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
