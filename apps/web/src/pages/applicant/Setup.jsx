import { useQueryClient } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { FileDropzone } from "@/components/shared/FileDropzone";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { useConfirmProfile, useParseResume } from "@/features/profile/api";
import { initials } from "@/features/profile/initials";
import { ProfileForm } from "@/features/profile/ProfileForm";
import { ProfilePhotoPicker } from "@/features/profile/ProfilePhotoPicker";
import { useAuth } from "@/hooks/useAuth";
import { useMe } from "@/hooks/useMe";
import { cn } from "@/lib/utils";

function Step({ number, label, active }) {
  return (
    <li className={cn("flex items-center gap-2 text-body", active ? "font-semibold text-heading" : "text-muted-foreground")}>
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full text-label-sm",
          active ? "bg-primary text-primary-foreground" : "bg-surface-subtle",
        )}
      >
        {number}
      </span>
      {label}
    </li>
  );
}

/**
 * First-time setup (APP_FLOW §3.1): upload resume → review the auto-filled profile → Confirm profile.
 * Nothing is saved as the applicant's profile until Confirm (FR-PROF-04). The profile photo is a local preview only
 * (decision 35): it is never sent with Confirm.
 */
export default function Setup() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { data: me } = useMe();
  const parse = useParseResume();
  const confirm = useConfirmProfile();
  const [parsed, setParsed] = useState(null);

  function startOver() {
    setParsed(null);
    parse.reset();
    confirm.reset();
  }

  function handleConfirm(values) {
    confirm.mutate(values, {
      onSuccess: () => {
        queryClient.setQueryData(["me", session.user.id], (current) => ({ ...current, hasProfile: true }));
        toast.success("Profile confirmed");
        navigate("/applicant", { replace: true });
      },
    });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Set up your profile"
        description="Upload your resume to get started."
      />
      <ol className="mb-6 flex flex-wrap gap-6" aria-label="Setup steps">
        <Step number={1} label="Upload resume" active={!parsed} />
        <Step number={2} label="Review your profile" active={Boolean(parsed)} />
      </ol>

      <section className="rounded-md border bg-card p-6">
        {!parsed ? (
          <FileDropzone
            title="Upload your resume"
            description="Use a text-based PDF in English (not a scanned image)."
            busy={parse.isPending}
            busyText="Reading your resume…"
            error={parse.error?.message}
            onFile={(file) => parse.mutate(file, { onSuccess: setParsed })}
          />
        ) : (
          <>
            <div className="mb-6">
              <ProfilePhotoPicker initials={initials(parsed.profile.firstName, parsed.profile.lastName)} />
            </div>
            <p className="mb-4 text-body text-muted-foreground">Check your profile and fill in any missing fields.</p>
            {parsed.warnings.length > 0 && (
              <div className="mb-6 flex gap-2 rounded-sm bg-warning-soft px-3 py-2 text-body text-warning">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <ul>
                  {parsed.warnings.map((warning) => (
                    <li key={warning}>Note: {warning}.</li>
                  ))}
                </ul>
              </div>
            )}
            <ProfileForm
              profile={parsed.profile}
              email={me?.email}
              onSubmit={handleConfirm}
              submitting={confirm.isPending}
              serverError={confirm.error?.message}
              secondaryAction={
                <Button type="button" variant="secondary" onClick={startOver} disabled={confirm.isPending}>
                  Upload a different resume
                </Button>
              }
            />
          </>
        )}
      </section>
    </div>
  );
}
