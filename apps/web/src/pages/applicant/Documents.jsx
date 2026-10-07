import { DOCUMENT_TYPE_LABELS, REQUEST_STATUS, REQUEST_STATUS_LABELS } from "@vera/shared";
import { AlertCircle, FileClock, Info, Plus, Upload } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { TONE_CLASSES } from "@/components/shared/tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { openSignedUrl, useDocumentRequests, useDocuments, useResume } from "@/features/documents/api";
import { DocumentTable } from "@/features/documents/DocumentTable";
import { UploadDocumentDialog } from "@/features/documents/UploadDocumentDialog";
import { formatDateTime } from "@/lib/format";

function InfoNote({ children }) {
  return (
    <p className="mb-4 flex gap-2 rounded-sm bg-info-soft px-3 py-2 text-body text-info">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

/** HR document requests (FR-DOC-03): action items with reason and deadline; Upload pre-selects the type. */
function RequestsList({ requests, onUpload }) {
  if (requests.isPending) return <Skeleton className="h-24 w-full" aria-busy="true" />;
  if (requests.isError) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Requests could not be loaded"
        description={requests.error.message}
        action={<Button onClick={() => requests.refetch()}>Try again</Button>}
      />
    );
  }
  if (requests.data.length === 0) {
    return <EmptyState icon={FileClock} title="No requests" description="When HR asks for a document, it appears here with the reason and deadline." />;
  }
  return (
    <ul className="flex flex-col gap-3">
      {requests.data.map((r) => {
        const pending = r.status === REQUEST_STATUS.PENDING;
        const status = REQUEST_STATUS_LABELS[r.status];
        return (
          <li key={r.requestId} className="flex flex-col gap-2 rounded-md border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="flex flex-wrap items-center gap-2 text-body font-semibold text-heading">
                {DOCUMENT_TYPE_LABELS[r.documentType]}
                <Badge className={TONE_CLASSES[status.tone]}>{status.label}</Badge>
              </p>
              {r.jobTitle && <p className="text-body-sm text-muted-foreground">For your application: {r.jobTitle}</p>}
              <p className="text-body-sm text-text">Reason: {r.reason}</p>
              <p className="text-body-sm text-muted-foreground">
                {pending ? "Due" : "Was due"} {formatDateTime(r.dueAt)} (Philippine time)
              </p>
            </div>
            {pending && (
              <Button className="self-start sm:self-center" onClick={() => onUpload(r)}>
                <Upload aria-hidden="true" />
                Upload {DOCUMENT_TYPE_LABELS[r.documentType]}
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * My Documents (APP_FLOW §1.2): Resume tab (the current resume), Supporting documents tab (FR-DOC-01/02/04), and
 * Requests from HR (FR-DOC-03). With a pending request the page opens on Requests.
 */
export default function Documents() {
  const resume = useResume();
  const documents = useDocuments();
  const requests = useDocumentRequests();
  // `dialog` = null (closed) or { replacing, initialType } ; the key resets the dialog's form each time it opens.
  const [dialog, setDialog] = useState(null);
  const [dialogKey, setDialogKey] = useState(0);
  const pendingCount = (requests.data ?? []).filter((r) => r.status === REQUEST_STATUS.PENDING).length;

  function openDialog(replacing = null, initialType = "") {
    setDialogKey((key) => key + 1);
    setDialog({ replacing, initialType });
  }

  /** A request for a new copy re-uploads that copy; a request for a missing type opens a new upload of that type. */
  function uploadForRequest(request) {
    const target = request.targetDocumentId ? (documents.data ?? []).find((d) => d.documentId === request.targetDocumentId) : null;
    openDialog(target ?? null, request.documentType);
  }

  const resumeRows = resume.data ? [{ ...resume.data, id: resume.data.resumeId, typeLabel: "Resume" }] : [];
  const documentRows = (documents.data ?? []).map((doc) => ({
    ...doc,
    id: doc.documentId,
    typeLabel: DOCUMENT_TYPE_LABELS[doc.documentType],
  }));

  return (
    <>
      <PageHeader
        title="My Documents"
        description="Your resume and supporting documents. HR checks them during screening."
        actions={
          <Button onClick={() => openDialog()}>
            <Plus aria-hidden="true" />
            Upload document
          </Button>
        }
      />

      {pendingCount > 0 && (
        <p role="status" className="mb-4 flex gap-2 rounded-sm bg-warning-soft px-3 py-2 text-body text-warning">
          <FileClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          HR asked for {pendingCount} document{pendingCount > 1 ? "s" : ""}. Open Requests to see the reason and deadline.
        </p>
      )}

      <Tabs key={pendingCount > 0 ? "with-requests" : "plain"} defaultValue={pendingCount > 0 ? "requests" : "supporting"}>
        <TabsList aria-label="Document groups">
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="supporting">Supporting documents</TabsTrigger>
          <TabsTrigger value="requests">Requests{pendingCount > 0 ? ` (${pendingCount})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="pt-4">
          <RequestsList requests={requests} onUpload={uploadForRequest} />
        </TabsContent>

        <TabsContent value="resume" className="pt-4">
          <InfoNote>One resume per applicant. It is used for matching when you apply.</InfoNote>
          <DocumentTable
            rows={resumeRows}
            isLoading={resume.isPending}
            isError={resume.isError}
            onRetry={resume.refetch}
            empty={{ title: "No resume yet" }}
            onView={() => openSignedUrl("/applicant/resume/url")}
          />
        </TabsContent>

        <TabsContent value="supporting" className="pt-4">
          <InfoNote>Optional. Upload them early to speed up screening; uploading a document again replaces it.</InfoNote>
          <DocumentTable
            rows={documentRows}
            isLoading={documents.isPending}
            isError={documents.isError}
            onRetry={documents.refetch}
            empty={{
              title: "No supporting documents yet",
              description: "Upload your TOR, diploma, clearances, or IDs.",
              action: <Button onClick={() => openDialog()}>Upload document</Button>,
            }}
            onView={(row) => openSignedUrl(`/applicant/documents/${row.documentId}/url`)}
            onReupload={(row) => openDialog(row)}
          />
        </TabsContent>
      </Tabs>

      {dialog && (
        <UploadDocumentDialog
          key={dialogKey}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          documents={documents.data ?? []}
          replacing={dialog.replacing}
          initialType={dialog.initialType}
        />
      )}
    </>
  );
}
