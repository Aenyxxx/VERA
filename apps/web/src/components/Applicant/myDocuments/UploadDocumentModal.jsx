import { useState } from "react";
import { FileUp, X } from "lucide-react";

function UploadDocumentModal({
  onClose,
  resumeExists,
  supportingCount,
  onUpload,
}) {
  const [documentType, setDocumentType] = useState("");
  const [file, setFile] = useState(null);

  const resumeLimitReached = resumeExists;
  const supportingLimitReached = supportingCount >= 5;

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (selectedFile) {
      setFile(selectedFile);
    }
  };

const handleSubmit = () => {
  if (!documentType || !file) {
    return;
  }

  const uploadedDocument = {
        name:
        documentType === "resume"
            ? "Resume"
            : "Supporting Document",
        fileName: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        }),
        time: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        }),
        type: documentType,
        required: documentType === "resume",
        reuploadRequired: false,
    };

    onUpload?.(uploadedDocument);
    onClose();
    };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-blue-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <FileUp size={19} />
            </div>

            <div>
              <h2 className="text-base font-bold text-[#102f53]">
                Upload Document
              </h2>

              <p className="mt-0.5 text-[10px] text-blue-400">
                Choose the type of document you want to upload.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-blue-600 transition hover:text-blue-800"
          >
            <X size={19} />
          </button>
        </div>

        {/* Document Type */}
        <div className="mt-4">
          <label className="text-[10px] font-semibold text-[#102f53]">
            Document Type
          </label>

          <div className="mt-2 space-y-2">

            {/* Resume */}
            <button
              type="button"
              disabled={resumeLimitReached}
              onClick={() => setDocumentType("resume")}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left transition ${
                documentType === "resume"
                  ? "border-blue-500 bg-blue-50"
                  : "border-blue-100 bg-white hover:bg-blue-50"
              } ${
                resumeLimitReached
                  ? "cursor-not-allowed opacity-50"
                  : ""
              }`}
            >
              <div>
                <p className="text-xs font-semibold text-[#102f53]">
                  Resume
                </p>

                <p className="mt-0.5 text-[9px] text-slate-400">
                  Maximum of 1 file
                </p>
              </div>

              <span className="rounded-full bg-blue-100 px-2 py-1 text-[8px] font-semibold text-blue-600">
                Required
              </span>
            </button>

            {/* Supporting Document */}
            <button
              type="button"
              disabled={supportingLimitReached}
              onClick={() => setDocumentType("supporting")}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2.5 text-left transition ${
                documentType === "supporting"
                  ? "border-blue-500 bg-blue-50"
                  : "border-blue-100 bg-white hover:bg-blue-50"
              } ${
                supportingLimitReached
                  ? "cursor-not-allowed opacity-50"
                  : ""
              }`}
            >
              <div>
                <p className="text-xs font-semibold text-[#102f53]">
                  Supporting Document
                </p>

                <p className="mt-0.5 text-[9px] text-slate-400">
                  Maximum of 5 files
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-2 py-1 text-[8px] font-semibold text-slate-500">
                Optional
              </span>
            </button>

          </div>
        </div>

        {/* File Upload */}
        {documentType && (
          <div className="mt-4">
            <label className="text-[10px] font-semibold text-[#102f53]">
              Select File
            </label>

            <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-blue-200 bg-blue-50/40 px-4 py-6 text-center transition hover:bg-blue-50">
              <FileUp size={22} className="text-blue-600" />

              <p className="mt-2 text-[10px] font-medium text-[#102f53]">
                {file ? file.name : "Choose a file"}
              </p>

              {!file && (
                <p className="mt-1 text-[9px] text-slate-400">
                  Click here to select a file
                </p>
              )}

              <input
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2 border-t border-blue-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-blue-200 bg-white px-4 py-2 text-[10px] font-medium text-blue-600 transition hover:bg-blue-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!documentType || !file}
            onClick={handleSubmit}
            className="rounded-md bg-blue-600 px-4 py-2 text-[10px] font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Upload
          </button>
        </div>

      </div>
    </div>
  );
}

export default UploadDocumentModal;