import {
  AlertTriangle,
  CloudUpload,
  FileText,
  Trash2,
} from "lucide-react";

const resumeDocuments = [
  {
    name: "Resume",
    fileName: "Juan_Dela_Cruz_Resume.pdf",
    size: "1.2 MB",
    date: "Sep 18, 2026",
    time: "09:14 AM",
    required: true,
  },
];

const supportingDocuments = [
  {
    name: "Diploma",
    fileName: "Diploma_Juan_Dela_Cruz.pdf",
    size: "1.4 MB",
    date: "Sep 18, 2026",
    time: "09:20 AM",
    reuploadRequired: true,
  },
  {
    name: "Transcript of Records",
    fileName: "TOR_Juan_Dela_Cruz.pdf",
    size: "2.1 MB",
    date: "Sep 18, 2026",
    time: "09:25 AM",
    reuploadRequired: false,
  },
];

function DocumentTable({ activeTab }) {
  const isResume = activeTab === "resume";

  const documents = isResume
    ? resumeDocuments
    : supportingDocuments;

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-blue-100 bg-white">

      {/* Information Banner */}
      <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50 px-3 py-2">
        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
          <span className="text-[9px] font-bold">i</span>
        </div>

        <p className="text-[8px] text-blue-600 sm:text-[9px]">
          {isResume
            ? "One resume is required. Upload one file at a time."
            : "Supporting documents are optional. Upload one file at a time."}
        </p>
      </div>

      {/* Table Header */}
      <div className="hidden grid-cols-[2fr_1.5fr_1.2fr_1.3fr] gap-4 bg-blue-50/70 px-3 py-2.5 text-[8px] font-semibold uppercase tracking-wide text-blue-500 md:grid">
        <span>Document Name</span>
        <span>File Name</span>
        <span>Uploaded Date</span>
        <span>Actions</span>
      </div>

      {/* Documents */}
      {documents.map((document) => (
        <div
          key={document.fileName}
          className="grid grid-cols-1 gap-2 border-t border-blue-50 px-3 py-2 md:grid-cols-[2fr_1.5fr_1.2fr_1.3fr] md:items-center md:gap-4"
        >

          {/* Document Name */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
              <FileText size={17} />
            </div>

            <div>
              <p className="text-[10px] font-semibold text-[#102f53]">
                {document.name}
              </p>

              {isResume && (
                <span className="mt-1 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[7px] font-semibold text-blue-600">
                  Required
                </span>
              )}
            </div>
          </div>

          {/* File Name */}
          <div>
            <p className="text-[9px] font-medium text-blue-600">
              {document.fileName}
            </p>

            <p className="mt-0.5 text-[8px] text-blue-400">
              ({document.size})
            </p>
          </div>

          {/* Uploaded Date */}
          <div>
            <p className="text-[9px] text-blue-600">
              {document.date}
            </p>

            <p className="mt-0.5 text-[8px] text-blue-400">
              {document.time}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-start gap-2">

            {/* Warning */}
            {document.reuploadRequired && (
              <div className="flex flex-col items-center">
                <AlertTriangle
                  size={19}
                  className="text-amber-500"
                />

                <span className="mt-1 text-[7px] font-medium text-amber-500">
                  Reupload required
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-[8px] font-medium text-blue-600 transition hover:bg-blue-100"
              >
                <CloudUpload size={12} />
                Reupload
              </button>

              <button
                type="button"
                className="flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-[8px] font-medium text-red-500 transition hover:bg-red-100"
              >
                <Trash2 size={12} />

                {isResume ? "Delete" : "Remove"}
              </button>
            </div>

          </div>
        </div>
      ))}

    </div>
  );
}

export default DocumentTable;