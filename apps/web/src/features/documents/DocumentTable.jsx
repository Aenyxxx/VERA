import { CloudUpload, Eye, FileText } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatBytes, formatDateTime } from "@/lib/format";

const NEEDS_ACTION = new Set(["rejected", "reupload_requested"]);

/**
 * Documents list for My Documents (from the legacy DocumentTable), on the shared DataTable.
 * rows: { id, typeLabel, label, fileName, fileSizeBytes, uploadedAt, verificationStatus, verificationRemarks }
 * onReupload is omitted for the resume (replacement is not available in the sprint).
 */
export function DocumentTable({ rows, isLoading, isError, onRetry, empty, onView, onReupload }) {
  const columns = [
    {
      id: "document",
      header: "Document",
      accessorFn: (row) => row.typeLabel,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-primary">
            <FileText className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-heading">{row.original.typeLabel}</p>
            {row.original.label && <p className="text-body-sm text-muted-foreground">{row.original.label}</p>}
          </div>
        </div>
      ),
    },
    {
      id: "file",
      header: "File",
      accessorFn: (row) => row.fileName,
      cell: ({ row }) => (
        <div>
          <p className="max-w-56 truncate" title={row.original.fileName}>
            {row.original.fileName}
          </p>
          <p className="text-body-sm text-muted-foreground">{formatBytes(row.original.fileSizeBytes)}</p>
        </div>
      ),
    },
    {
      id: "uploaded",
      header: "Uploaded",
      accessorFn: (row) => row.uploadedAt,
      cell: ({ row }) => <span className="tabular">{formatDateTime(row.original.uploadedAt)}</span>,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => row.verificationStatus,
      cell: ({ row }) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge kind="verification" value={row.original.verificationStatus} />
          {NEEDS_ACTION.has(row.original.verificationStatus) && row.original.verificationRemarks && (
            <p className="max-w-56 text-body-sm text-warning">{row.original.verificationRemarks}</p>
          )}
        </div>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onView(row.original)} aria-label={`View ${row.original.typeLabel}`}>
            <Eye aria-hidden="true" />
            View
          </Button>
          {onReupload && (
            <Button variant="secondary" size="sm" onClick={() => onReupload(row.original)} aria-label={`Re-upload ${row.original.typeLabel}`}>
              <CloudUpload aria-hidden="true" />
              Re-upload
            </Button>
          )}
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} data={rows} isLoading={isLoading} isError={isError} onRetry={onRetry} empty={empty} />;
}
