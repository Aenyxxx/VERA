import { DOCUMENT_TYPE, DOCUMENT_TYPE_LABELS, MULTI_DOCUMENT_TYPES, SUPPORTING_DOCUMENT_TYPES } from "@vera/shared";
import { Info, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FieldError } from "@/components/shared/FieldError";
import { FileDropzone } from "@/components/shared/FileDropzone";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useUploadDocument } from "./api";

const selectClass =
  "h-11 w-full rounded-sm border border-input bg-card px-3 text-body-lg outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-surface-subtle md:text-body";

/**
 * Upload or re-upload a supporting document (from the legacy UploadDocumentModal; FR-DOC-01/04).
 * One current document per type, except Certificate/Other (several, each with a label): uploading a
 * single-instance type the applicant already has replaces it. `replacing` = the row being re-uploaded;
 * `initialType` pre-selects the type an HR request asked for (FR-DOC-03).
 */
export function UploadDocumentDialog({ open, onOpenChange, documents = [], replacing = null, initialType = "" }) {
  const upload = useUploadDocument();
  const [documentType, setDocumentType] = useState(replacing?.documentType ?? initialType);
  const [label, setLabel] = useState(replacing?.label ?? "");
  const [file, setFile] = useState(null);
  const [labelError, setLabelError] = useState("");

  const typeLabel = DOCUMENT_TYPE_LABELS[documentType];
  const isMulti = MULTI_DOCUMENT_TYPES.includes(documentType);
  const willReplace = Boolean(replacing) || (!isMulti && documents.some((d) => d.documentType === documentType));

  function submit(event) {
    event.preventDefault();
    if (documentType === DOCUMENT_TYPE.OTHER && !label.trim()) {
      setLabelError("Name this document");
      return;
    }
    upload.mutate(
      { file, documentType, label: label.trim(), replacesDocumentId: replacing?.documentId },
      {
        onSuccess: () => {
          toast.success("Document uploaded");
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>{replacing ? `Re-upload ${typeLabel}` : "Upload document"}</DialogTitle>
            <DialogDescription>PDF only, up to 10 MB. HR verifies each document.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="documentType">Document type</Label>
            <select
              id="documentType"
              className={selectClass}
              value={documentType}
              disabled={Boolean(replacing) || upload.isPending}
              onChange={(event) => {
                setDocumentType(event.target.value);
                setLabelError("");
              }}
            >
              <option value="">Select a document type</option>
              {SUPPORTING_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {DOCUMENT_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          {isMulti && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="documentLabel">
                {documentType === DOCUMENT_TYPE.OTHER ? "Document name" : "Certificate name (optional)"}
              </Label>
              <Input
                id="documentLabel"
                value={label}
                maxLength={100}
                placeholder={documentType === DOCUMENT_TYPE.OTHER ? "e.g. Barangay residency certificate" : "e.g. Food safety training"}
                aria-invalid={Boolean(labelError)}
                aria-describedby={labelError ? "documentLabel-error" : undefined}
                onChange={(event) => {
                  setLabel(event.target.value);
                  setLabelError("");
                }}
              />
              <FieldError id="documentLabel-error" message={labelError} />
            </div>
          )}

          {documentType && willReplace && (
            <p className="flex gap-2 rounded-sm bg-info-soft px-3 py-2 text-body text-info">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              This replaces your current {typeLabel}; it will need verification again.
            </p>
          )}

          {documentType && (
            <FileDropzone
              title="Choose the PDF"
              description="Scan or save the document as one PDF."
              busy={upload.isPending}
              busyText="Uploading…"
              error={upload.error?.message}
              onFile={setFile}
            />
          )}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={upload.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!documentType || !file || upload.isPending}>
              {upload.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Upload document
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
