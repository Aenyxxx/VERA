import { AlertCircle, Camera, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useProfile, useUpdateProfile } from "./api";
import { ProfileForm } from "./ProfileForm";

/**
 * Dashboard profile card (FR-PROF-05): read-only view → Edit profile → Save changes / Cancel.
 * Email is shown but never editable (it is the login). Decision 31: the avatar shows the initials of the first and
 * last name; "Upload photo" is disabled with "Coming soon" (no file input, no request).
 */
export function ProfileCard() {
  const profile = useProfile();
  const update = useUpdateProfile();
  const [editing, setEditing] = useState(false);

  if (profile.isPending) {
    return (
      <section className="flex flex-col gap-4 rounded-md border bg-card p-6" aria-busy="true">
        <Skeleton className="h-11 w-56" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </section>
    );
  }

  if (profile.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Your profile could not be loaded"
        description={profile.error.message}
        action={<Button onClick={() => profile.refetch()}>Try again</Button>}
      />
    );
  }

  const data = profile.data;
  const name = [data.firstName, data.lastName].filter(Boolean).join(" ");
  // Decision 31: initials of the first and the last name (not the first two words: "Ana Marie Santos" → "AS").
  const initials = [data.firstName, data.lastName].map((part) => part?.trim()?.[0]?.toUpperCase() ?? "").join("");

  function save(values) {
    update.mutate(values, {
      onSuccess: () => {
        setEditing(false);
        toast.success("Profile saved");
      },
    });
  }

  function cancel() {
    update.reset();
    setEditing(false);
  }

  return (
    <section className="rounded-md border bg-card p-6" aria-label="Profile">
      <div className="mb-6 flex flex-wrap items-center gap-3 border-b pb-4">
        <Avatar className="size-12">
          <AvatarFallback className="bg-nav text-body font-semibold text-white">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-section-title font-bold">{name}</h2>
          <p className="text-body-sm text-muted-foreground">Personal information</p>
        </div>
        {/* Decision 31: a placeholder only. Nothing is uploaded or saved; the photo arrives after the defense. */}
        <div className="flex flex-col items-start gap-0.5">
          <Button type="button" variant="secondary" disabled aria-describedby="profile-photo-soon">
            <Camera aria-hidden="true" />
            Upload photo
          </Button>
          <span id="profile-photo-soon" className="text-label-sm text-muted-foreground">
            Coming soon
          </span>
        </div>
        {!editing && (
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil aria-hidden="true" />
            Edit profile
          </Button>
        )}
      </div>

      <ProfileForm
        // remount after a save or cancel so the fields show the stored values
        key={`${editing}-${profile.dataUpdatedAt}`}
        profile={data}
        email={data.email}
        readOnly={!editing}
        onSubmit={save}
        submitting={update.isPending}
        submitLabel="Save changes"
        serverError={update.error?.message}
        secondaryAction={
          <Button type="button" variant="secondary" onClick={cancel} disabled={update.isPending}>
            Cancel
          </Button>
        }
      />
    </section>
  );
}
