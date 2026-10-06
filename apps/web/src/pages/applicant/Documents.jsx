import { DOCUMENT_TYPE_LABELS } from "@vera/shared";
import { Info, Plus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { openSignedUrl, useDocuments, useResume } from "@/features/documents/api";
import { DocumentTable } from "@/features/documents/DocumentTable";
import { UploadDocumentDialog } from "@/features/documents/UploadDocumentDialog";

function InfoNote({ children }) {
  return (
    <p className="mb-4 flex gap-2 rounded-sm bg-info-soft px-3 py-2 text-body text-info">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

/**
 * My Documents (APP_FLOW §1.2): Resume tab (the current resume) and Supporting documents tab
 * (FR-DOC-01/02/04). Document requests from HR are added in S12.
 */
export default function Documents() {
  const resume = useResume();
  const documents = useDocuments();
  // `dialog` = null (closed) or { replacing } ; the key resets the dialog's form each time it opens.
  const [dialog, setDialog] = useState(null);
  const [dialogKey, setDialogKey] = useState(0);

  function openDialog(replacing = null) {
    setDialogKey((key) => key + 1);
    setDialog({ replacing });
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

      <Tabs defaultValue="supporting">
        <TabsList aria-label="Document groups">
          <TabsTrigger value="resume">Resume</TabsTrigger>
          <TabsTrigger value="supporting">Supporting documents</TabsTrigger>
        </TabsList>

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
        />
      )}
    </>
  );
}
