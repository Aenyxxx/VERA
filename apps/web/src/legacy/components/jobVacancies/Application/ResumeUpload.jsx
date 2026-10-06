import { useState } from "react";
import { FileText } from "lucide-react";

const documents = [
  {
    id: "resume",
    name: "Resume",
    fileName: "Juan_Dela_Cruz_Resume.pdf",
    required: true,
  },
  {
    id: "cover-letter",
    name: "Cover Letter",
    fileName: "Juan_Dela_Cruz_Cover_Letter.pdf",
    required: false,
  },
  {
    id: "tor",
    name: "Transcript of Records",
    fileName: "TOR_Juan_Dela_Cruz.pdf",
    required: false,
  },
  {
    id: "diploma",
    name: "Diploma",
    fileName: "Diploma_Juan_Dela_Cruz.pdf",
    required: false,
  },
  {
    id: "nbi",
    name: "NBI Clearance",
    fileName: "NBI_Clearance.pdf",
    required: false,
  },
  {
    id: "valid-id",
    name: "Valid ID",
    fileName: "Valid_ID.pdf",
    required: false,
  },
];

function ResumeUpload({ onSelectionChange }) {
  const [selectedDocuments, setSelectedDocuments] = useState(["resume"]);

  const handleToggle = (id) => {
    if (id === "resume") {
      return;
    }

    setSelectedDocuments((current) => {
      const updated = current.includes(id)
        ? current.filter((documentId) => documentId !== id)
        : [...current, id];

      onSelectionChange?.(updated);

      return updated;
    });
  };

  return (
    <div className="mt-4">
      {/* Section Header */}
      <div className="mb-2 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <FileText size={19} />
        </div>

        <div>
          <h3 className="text-xs font-bold text-[#102f53] sm:text-sm">
            Select Documents
          </h3>

          <p className="text-[9px] text-blue-400 sm:text-[10px]">
            Choose from your uploaded documents.
          </p>
        </div>
      </div>

      {/* Document List */}
      <div className="space-y-1.5">
        {documents.map((document) => {
          const isSelected = selectedDocuments.includes(document.id);

          return (
            <label
              key={document.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition ${
                isSelected
                  ? "border-blue-200 bg-blue-50/40"
                  : "border-blue-100 bg-white hover:bg-blue-50/30"
              }`}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={isSelected}
                disabled={document.required}
                onChange={() => handleToggle(document.id)}
                className="h-4 w-4 accent-blue-600"
              />

              {/* PDF Icon */}
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-red-500 text-[8px] font-bold text-white">
                PDF
              </div>

              {/* Document Information */}
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-[#102f53] sm:text-xs">
                  {document.name}
                </p>

                <p className="truncate text-[9px] text-blue-400 sm:text-[10px]">
                  {document.fileName}
                </p>
              </div>

              {/* Required Badge */}
              {document.required && (
                <span className="rounded-full bg-blue-100 px-2 py-1 text-[8px] font-semibold text-blue-600">
                  Required
                </span>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default ResumeUpload;