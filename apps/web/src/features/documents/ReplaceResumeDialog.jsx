import { FileCheck2, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { FileDropzone } from "@/components/shared/FileDropzone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useParseResume } from "@/features/profile/api";

import { useReplaceResume } from "./api";

/**
 * Replace resume (decision 16; PRD FR-PROF-06/07): choose a PDF → it is read (svc /extract, saved as a draft) →
 * the file name and any reading notes are shown → Use this resume. The profile is not changed. The API refuses
 * while a job offer or invitation is pending (409) or without a draft (422); the message is shown here.
 * The parent remounts the dialog (key) each time it opens.
 */
export function ReplaceResumeDialog({ open, onOpenChange }) {
  const parse = useParseResume();
  const replace = useReplaceResume();
  const busy = parse.isPending || replace.isPending;
  const parsed = parse.data;

  function confirmReplace() {
    replace.mutate(undefined, {
      onSuccess: () => {
        toast.success("Resume replaced. The agency will check it again.");
        onOpenChange(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent showCloseButton={!busy} className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Replace resume</DialogTitle>
          <DialogDescription>
            Applications you already sent keep their resume. New applications use this one, and the agency checks it
            again. Your profile does not change; edit it in My Profile if needed.
          </DialogDescription>
        </DialogHeader>

        <FileDropzone
          title="Upload your new resume"
          description="Text-based English PDF."
          busy={parse.isPending}
          busyText="Reading your resume…"
          error={parse.error?.message}
          onFile={(file) => {
            replace.reset();
            parse.mutate(file);
          }}
        />

        {parsed && (
          <div role="status" className="flex flex-col gap-2 rounded-xl bg-surface-blue p-4 ring-1 ring-border">
            <p className="flex items-center gap-2 text-body font-semibold text-heading">
              <FileCheck2 className="size-4 shrink-0 text-success" aria-hidden="true" />
              {parsed.fileName} is ready
            </p>
            {parsed.warnings.length > 0 && (
              <ul aria-label="Reading notes" className="flex flex-col gap-1 text-body-sm text-muted-foreground">
                {parsed.warnings.map((warning) => (
                  <li key={warning} className="flex gap-2">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {warning}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {replace.error && (
          <p role="alert" className="rounded-md bg-error-soft px-3 py-2 text-body text-error">
            {replace.error.message}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!parsed || busy} onClick={confirmReplace}>
            {replace.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Use this resume
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
