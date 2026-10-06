import { FileText, Loader2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { pdfProblem } from "@/lib/files";
import { cn } from "@/lib/utils";

/**
 * PDF upload area: drag and drop or "Choose file", PDF only, ≤ 10 MB (UI_GUIDELINES §3 file upload).
 * Calls onFile(file) as soon as a valid file is chosen. `busy` shows the upload/parsing state; `error`
 * shows the server's message (e.g. a scanned PDF).
 */
export function FileDropzone({ title, description, busy = false, busyText = "Uploading…", error, onFile }) {
  const inputId = useId();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState("");
  const [fileName, setFileName] = useState("");

  function choose(file) {
    if (!file || busy) return;
    const problem = pdfProblem(file);
    setLocalError(problem);
    setFileName(file.name);
    if (!problem) onFile(file);
  }

  const message = localError || error;

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        choose(event.dataTransfer.files[0]);
      }}
      className={cn(
        "flex flex-col items-center rounded-md border-2 border-dashed bg-surface-subtle px-6 py-10 text-center transition-colors",
        dragging && "border-primary bg-primary-soft",
        message && "border-error",
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        {busy ? <Loader2 className="size-6 animate-spin" aria-hidden="true" /> : <FileText className="size-6" aria-hidden="true" />}
      </span>

      <p className="mt-4 text-card-title font-semibold text-heading">{busy ? busyText : title}</p>
      {!busy && <p className="mt-1 text-body text-muted-foreground">{description} PDF only, up to 10 MB.</p>}
      {fileName && !message && <p className="mt-2 text-body-sm font-medium text-heading">{fileName}</p>}

      {message && (
        <p role="alert" className="mt-3 max-w-md text-body text-error">
          {message}
        </p>
      )}

      <label htmlFor={inputId} className="sr-only">
        Choose a PDF file
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          choose(event.target.files[0]);
          event.target.value = ""; // allow choosing the same file again after an error
        }}
      />
      <Button type="button" className="mt-5" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload aria-hidden="true" />
        {fileName ? "Choose another file" : "Choose file"}
      </Button>
    </div>
  );
}
