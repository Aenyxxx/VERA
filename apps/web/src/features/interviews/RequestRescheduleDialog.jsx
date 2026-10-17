import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { FieldError } from "@/components/shared/FieldError";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";

import { useRequestReschedule } from "./api";

// Same limits as the API (interviews.schemas.js rescheduleRequestSchema).
const schema = z.object({
  reason: z.string().trim().min(5, "Tell the agency why (at least 5 characters).").max(500, "At most 500 characters."),
});

const left = (n) => (n === 1 ? "1 more reschedule" : `${n} more reschedules`);

/**
 * Applicant reschedule request (decision 20, FR-INT-03): a reason, then the agency sets a new time or keeps this one.
 * Max 2 requests per application, approved or declined; the API re-checks. Job title only, never the company.
 * The parent remounts it (key) each time it opens.
 */
export function RequestRescheduleDialog({ interview, open, onOpenChange }) {
  const request = useRequestReschedule();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { reason: "" } });

  function submit({ reason }) {
    request.mutate(
      { interviewId: interview.interviewId, reason },
      {
        onSuccess: () => {
          toast.success("Reschedule request sent. The agency will set a new time or keep this one.");
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <form noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>Request a new interview time</DialogTitle>
            <DialogDescription>
              Your interview for {interview.jobTitle} is on {formatDateTime(interview.scheduledAt)} (Philippine time). You can request{" "}
              {left(interview.requestsLeft)}. The agency sets the new time.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reschedule-reason">Why can't you attend?</Label>
            <Textarea
              id="reschedule-reason"
              rows={4}
              aria-invalid={Boolean(errors.reason)}
              aria-describedby={errors.reason ? "reschedule-reason-error" : undefined}
              {...register("reason")}
            />
            <FieldError id="reschedule-reason-error" message={errors.reason?.message} />
          </div>
          {request.error && (
            <p role="alert" className="rounded-sm bg-error-soft px-3 py-2 text-body text-error">
              {request.error.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={request.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={request.isPending}>
              {request.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Send request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
