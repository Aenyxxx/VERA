// My Documents: list, upload, re-upload, and pop-up-safe View (FR-DOC-01/02/04; TC-18, TC-19).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { api, ApiError } = await import("@/lib/apiClient");
const { toast } = await import("sonner");
const { default: Documents } = await import("./Documents");

const RESUME = {
  resumeId: "r1",
  fileName: "Juan_Resume.pdf",
  fileSizeBytes: 1_258_291,
  uploadedAt: "2026-10-07T02:00:00.000Z",
  verificationStatus: "pending",
  verificationRemarks: null,
};
const TOR = {
  documentId: "d1",
  documentType: "transcript_of_records",
  label: null,
  fileName: "TOR.pdf",
  fileSizeBytes: 12_390,
  uploadedAt: "2026-10-08T01:14:00.000Z",
  verificationStatus: "pending",
  verificationRemarks: null,
};
const NBI = { ...TOR, documentId: "d2", documentType: "nbi_clearance", fileName: "NBI.pdf" };

let documents;

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <Documents />
    </QueryClientProvider>,
  );
}

const pdf = () => new File([new Uint8Array(300)], "doc.pdf", { type: "application/pdf" });

let requests = [];

describe("My Documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    documents = [TOR, NBI];
    requests = [];
    api.get.mockImplementation(async (path) => {
      if (path === "/applicant/resume") return RESUME;
      if (path === "/applicant/documents") return documents;
      if (path === "/applicant/document-requests") return requests;
      if (path.endsWith("/url")) return { url: `https://storage.test${path}` };
      throw new Error(`unexpected ${path}`);
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lists supporting documents with type, size, date, and 'For verification' (TC-18)", async () => {
    renderPage();
    const tor = (await screen.findByText("Transcript of records")).closest("tr");
    expect(within(tor).getByText("TOR.pdf")).toBeInTheDocument();
    expect(within(tor).getByText("12.1 KB")).toBeInTheDocument();
    expect(within(tor).getByText("Oct 8, 2026, 9:14 AM")).toBeInTheDocument();
    expect(within(tor).getByText("For verification")).toBeInTheDocument();
    expect(screen.getByText("NBI clearance")).toBeInTheDocument();
  });

  it("decision 16 (TC-16): Replace resume reads the PDF, shows the notes, then replaces it (profile unchanged)", async () => {
    api.post.mockImplementation(async (path) => {
      if (path === "/applicant/resume/parse") {
        return { fileName: "Juan_2026.pdf", warnings: ["no skills section found: the whole resume was used for skills"], yearsExperience: 1 };
      }
      if (path === "/applicant/resume/replace") return { ...RESUME, resumeId: "r2", fileName: "Juan_2026.pdf" };
      throw new Error(`unexpected ${path}`);
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Resume" }));
    const row = (await screen.findByText("Juan_Resume.pdf")).closest("tr");
    expect(within(row).getByText("1.2 MB")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Re-upload Resume" }));

    const dialog = await screen.findByRole("dialog", { name: "Replace resume" });
    expect(within(dialog).getByText(/Applications you already sent keep their resume/)).toBeInTheDocument();
    const use = within(dialog).getByRole("button", { name: "Use this resume" });
    expect(use).toBeDisabled(); // nothing read yet

    await user.upload(within(dialog).getByLabelText("Choose a PDF file"), pdf());
    expect(await within(dialog).findByText("Juan_2026.pdf is ready")).toBeInTheDocument();
    expect(within(dialog).getByText(/whole resume was used for skills/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/applicant/resume/parse", expect.any(FormData));

    await user.click(use);
    await waitFor(() => expect(api.post).toHaveBeenCalledWith("/applicant/resume/replace"));
    expect(toast.success).toHaveBeenCalledWith("Resume replaced. The agency will check it again.");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Replace resume" })).not.toBeInTheDocument());
    expect(await screen.findByText("Juan_2026.pdf")).toBeInTheDocument();
  });

  it("decision 16 (TC-17): a pending job offer or invitation → the 409 message stays in the dialog", async () => {
    api.post.mockImplementation(async (path) => {
      if (path === "/applicant/resume/parse") return { fileName: "Juan_2026.pdf", warnings: [], yearsExperience: 1 };
      throw new ApiError(409, "CONFLICT", "Answer your pending job offer or invitation first.");
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Resume" }));
    await user.click(await screen.findByRole("button", { name: "Re-upload Resume" }));
    const dialog = await screen.findByRole("dialog", { name: "Replace resume" });
    await user.upload(within(dialog).getByLabelText("Choose a PDF file"), pdf());
    await user.click(await within(dialog).findByRole("button", { name: "Use this resume" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Answer your pending job offer or invitation first.");
    expect(screen.getByRole("dialog", { name: "Replace resume" })).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("shows an empty state with an upload action", async () => {
    documents = [];
    renderPage();
    expect(await screen.findByText("No supporting documents yet")).toBeInTheDocument();
  });

  it("shows an error state with retry", async () => {
    api.get.mockImplementation(async (path) => {
      if (path === "/applicant/documents") throw new ApiError(500, "INTERNAL", "boom");
      if (path === "/applicant/document-requests") return [];
      return RESUME;
    });
    renderPage();
    expect(await screen.findByText("This list could not be loaded")).toBeInTheDocument();
  });

  it("uploads a new document type with FormData", async () => {
    api.post.mockResolvedValue({ documentId: "d3" });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Upload document" }));
    await user.selectOptions(screen.getByLabelText("Document type"), "diploma");
    expect(screen.queryByText(/This replaces your current/)).not.toBeInTheDocument();
    await user.upload(screen.getByLabelText("Choose a PDF file"), pdf());
    await user.click(screen.getByRole("button", { name: "Upload document" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
    const [path, form] = api.post.mock.calls[0];
    expect(path).toBe("/applicant/documents");
    expect(form.get("documentType")).toBe("diploma");
    expect(form.get("file").name).toBe("doc.pdf");
    expect(form.get("replacesDocumentId")).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("Document uploaded");
  });

  it("warns that uploading a type you already have replaces it (TC-19)", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Upload document" }));
    await user.selectOptions(screen.getByLabelText("Document type"), "transcript_of_records");
    expect(screen.getByText(/This replaces your current Transcript of records/)).toBeInTheDocument();
  });

  it("requires a name for 'Other'", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Upload document" }));
    await user.selectOptions(screen.getByLabelText("Document type"), "other");
    await user.upload(screen.getByLabelText("Choose a PDF file"), pdf());
    await user.click(screen.getByRole("button", { name: "Upload document" }));

    expect(await screen.findByText("Name this document")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("re-uploads a row with replacesDocumentId and a locked type (TC-19)", async () => {
    api.post.mockResolvedValue({ documentId: "d4" });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Re-upload Transcript of records" }));
    expect(screen.getByRole("heading", { name: "Re-upload Transcript of records" })).toBeInTheDocument();
    expect(screen.getByLabelText("Document type")).toBeDisabled();
    await user.upload(screen.getByLabelText("Choose a PDF file"), pdf());
    await user.click(screen.getByRole("button", { name: "Upload document" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
    const form = api.post.mock.calls[0][1];
    expect(form.get("replacesDocumentId")).toBe("d1");
    expect(form.get("documentType")).toBe("transcript_of_records");
  });

  describe("View (pop-up safe)", () => {
    it("opens a blank tab synchronously, then points it at the signed URL", async () => {
      const tab = { location: { href: "" }, close: vi.fn(), opener: {} };
      const open = vi.fn(() => {
        // the tab must exist before the URL request starts (still inside the click)
        expect(api.get).not.toHaveBeenCalledWith("/applicant/documents/d1/url");
        return tab;
      });
      vi.stubGlobal("open", open);
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "View Transcript of records" }));

      expect(open).toHaveBeenCalledWith("", "_blank");
      await waitFor(() => expect(tab.location.href).toBe("https://storage.test/applicant/documents/d1/url"));
      expect(tab.opener).toBeNull();
      expect(tab.close).not.toHaveBeenCalled();
    });

    it("closes the blank tab and shows a toast when the URL request fails", async () => {
      const tab = { location: { href: "" }, close: vi.fn(), opener: {} };
      vi.stubGlobal("open", vi.fn(() => tab));
      api.get.mockImplementation(async (path) => {
        if (path.endsWith("/url")) throw new ApiError(404, "NOT_FOUND", "That document was not found.");
        if (path === "/applicant/document-requests") return [];
        return path === "/applicant/resume" ? RESUME : documents;
      });
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "View Transcript of records" }));

      await waitFor(() => expect(tab.close).toHaveBeenCalledOnce());
      expect(tab.location.href).toBe("");
      expect(toast.error).toHaveBeenCalledWith("That document was not found.", expect.any(Object));
    });

    it("opens the resume through its own URL endpoint", async () => {
      const tab = { location: { href: "" }, close: vi.fn(), opener: {} };
      vi.stubGlobal("open", vi.fn(() => tab));
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("tab", { name: "Resume" }));
      await user.click(await screen.findByRole("button", { name: "View Resume" }));
      await waitFor(() => expect(tab.location.href).toBe("https://storage.test/applicant/resume/url"));
    });
  });

  describe("Requests (FR-DOC-03; TC-39/40)", () => {
    const PENDING = {
      requestId: "q1",
      documentType: "nbi_clearance",
      reason: "The copy is blurred.",
      status: "pending",
      dueAt: "2026-10-11T04:00:00.000Z",
      targetDocumentId: null,
      jobTitle: "Cashier",
    };

    it("opens on Requests with the reason, deadline, and an upload action when HR asked for a document", async () => {
      requests = [PENDING, { ...PENDING, requestId: "q0", documentType: "valid_id", status: "fulfilled", reason: "Expired ID." }];
      renderPage();

      expect(await screen.findByText(/HR asked for 1 document/)).toBeInTheDocument();
      expect(await screen.findByText("Reason: The copy is blurred.")).toBeInTheDocument();
      expect(screen.getByText("Due Oct 11, 2026, 12:00 PM (Philippine time)")).toBeInTheDocument();
      expect(screen.getAllByText("For your application: Cashier")).toHaveLength(2);
      expect(screen.getByText("Uploaded")).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/kabayan|company/i);
    });

    it("Upload pre-selects the requested type", async () => {
      requests = [PENDING];
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Upload NBI clearance" }));
      expect(await screen.findByLabelText("Document type")).toHaveValue("nbi_clearance");
    });

    it("a request for a new copy re-uploads that copy", async () => {
      requests = [{ ...PENDING, targetDocumentId: NBI.documentId }];
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByRole("button", { name: "Upload NBI clearance" }));
      expect(await screen.findByRole("heading", { name: "Re-upload NBI clearance" })).toBeInTheDocument();
    });
  });
});
