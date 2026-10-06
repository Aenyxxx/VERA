import { useState } from "react";
import { FileText, Upload } from "lucide-react";

function ResumeUpload() {
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    setSelectedFile(file);
  };
    const handleUpload = async () => {
        if (!selectedFile) {
            return;
        }

        try {
            const token = localStorage.getItem("access_token");

            const formData = new FormData();

            formData.append("resume", selectedFile);

            const response = await fetch(
                "http://localhost:5000/api/applicant/resume",
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    body: formData,
                }
            );

            const data = await response.json();

            if (!response.ok) {
                console.error("Resume upload failed:", data);
                return;
            }

            console.log("Resume processing result:", data);
        } catch (error) {
            console.error("Resume upload error:", error);
        }
    };

  return (
    <div className="mt-8">
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-[#f7f9f8] p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#1e3a5f]">
          <FileText size={24} />
        </div>

        <h3 className="mt-4 text-sm font-semibold text-[#102f53]">
          Upload your resume
        </h3>

        <p className="mt-1 text-xs text-gray-500">
          Upload your resume in PDF or DOCX format.
        </p>

        <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#1e3a5f] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#162d4a]">
          <Upload size={16} />

          {selectedFile ? "Change Resume" : "Choose Resume"}

          <input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {selectedFile && (
        <div className="mt-4">
            <p className="text-xs font-medium text-[#102f53]">
            Selected: {selectedFile.name}
            </p>

            <button
                type="button"
                onClick={handleUpload}
                className="mt-3 rounded-lg bg-[#1e3a5f] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#162d4a]"
            >
                Upload Resume
            </button>
        </div>
        )}
      </div>
    </div>
  );
}

export default ResumeUpload;