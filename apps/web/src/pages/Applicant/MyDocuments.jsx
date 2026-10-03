import { useState } from "react";

import ApplicantSidebar from "@/components/Applicant/dashboard/ApplicantSidebar";
import ApplicantHeader from "@/components/Applicant/dashboard/ApplicantHeader";
import DocumentTable from "@/components/Applicant/myDocuments/DocumentTable";
import UploadDocumentModal from "@/components/Applicant/myDocuments/UploadDocumentModal";

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

function MyDocuments({ activePage, onNavigate }) {
const [sidebarOpen, setSidebarOpen] = useState(false);
const [activeTab, setActiveTab] = useState("resume");
const [showUploadModal, setShowUploadModal] = useState(false);

const [resumeExists, setResumeExists] = useState(true);
const [supportingCount, setSupportingCount] = useState(2);

const [uploadedDocuments, setUploadedDocuments] = useState([]);

  return (
    <div className="min-h-screen bg-[#f7faff]">
      <ApplicantSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activePage={activePage}
        onNavigate={onNavigate}
      />

      <main className="min-h-screen lg:ml-64">
        <ApplicantHeader
          onMenuClick={() => setSidebarOpen(true)}
        />

        <div className="p-4 sm:p-6 lg:p-8">

        <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <span className="text-xl">▤</span>
                </div>

                <div>
                <h1 className="text-xl font-bold text-[#102f53] sm:text-2xl">
                    My Documents
                </h1>

                <p className="mt-0.5 text-xs text-blue-500">
                    Upload your resume and manage your supporting documents.
                </p>
            </div>
        </div>

        <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="flex shrink-0 items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-[10px] font-semibold text-white transition hover:bg-blue-700"
        >
            <span className="text-sm">+</span>
            Upload Document
        </button>
        </div>

          {/* Tabs */}
          <div className="mt-5 border-b border-blue-100">
            <div className="flex gap-6">
              <button
                type="button"
                onClick={() => setActiveTab("resume")}
                className={`border-b-2 px-1 pb-3 text-xs font-semibold transition ${
                  activeTab === "resume"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-blue-600"
                }`}
              >
                Resume
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("supporting")}
                className={`border-b-2 px-1 pb-3 text-xs font-semibold transition ${
                  activeTab === "supporting"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-blue-600"
                }`}
              >
                Supporting Documents
              </button>
            </div>
          </div>

          {/* Document Table */}
            <DocumentTable
            activeTab={activeTab}
            documents={
                activeTab === "resume"
                ? [
                    ...resumeDocuments,
                    ...uploadedDocuments.filter(
                        (document) => document.type === "resume"
                    ),
                    ]
                : [
                    ...supportingDocuments,
                    ...uploadedDocuments.filter(
                        (document) => document.type === "supporting"
                    ),
                    ]
            }
            />
            {showUploadModal && (
                <UploadDocumentModal
                    onClose={() => setShowUploadModal(false)}
                    resumeExists={resumeExists}
                    supportingCount={supportingCount}
                    onUpload={(document) => {
                        setUploadedDocuments((current) => [
                        ...current,
                        document,
                        ]);
                }}
                />
            )}

        </div>
      </main>
    </div>
  );
}

export default MyDocuments;