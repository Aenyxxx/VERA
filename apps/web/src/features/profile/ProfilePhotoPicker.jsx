import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FieldError } from "@/components/shared/FieldError";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

/**
 * Decision 35 (amends 31): Setup profile shows the initials avatar and an "Upload photo" button that previews the
 * chosen image in the avatar. Local only: nothing is uploaded, saved, or sent to the API, so the preview is gone
 * after a refresh.
 */
export function ProfilePhotoPicker({ initials }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  // Free the object URL when it is replaced or the page closes.
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  function choose(file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    setError("");
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar className="size-16">
        {preview ? (
          <img src={preview} alt="Profile photo preview" className="size-full rounded-full object-cover" />
        ) : (
          <AvatarFallback className="bg-nav text-card-title font-semibold text-white">{initials}</AvatarFallback>
        )}
      </Avatar>
      <div className="flex flex-col items-start gap-1">
        <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
          <Camera aria-hidden="true" />
          Upload photo
        </Button>
        <label htmlFor="profile-photo" className="sr-only">
          Choose a profile photo
        </label>
        <input
          ref={inputRef}
          id="profile-photo"
          type="file"
          accept="image/*"
          className="sr-only"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "profile-photo-error" : undefined}
          onChange={(event) => {
            choose(event.target.files[0]);
            event.target.value = ""; // allow choosing the same file again
          }}
        />
        <FieldError id="profile-photo-error" message={error} />
      </div>
    </div>
  );
}
