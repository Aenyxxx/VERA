import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FileDropzone } from "./FileDropzone";

const pdf = (size = 1000, name = "resume.pdf") => new File([new Uint8Array(size)], name, { type: "application/pdf" });

function setup(props = {}) {
  const onFile = vi.fn();
  // applyAccept: false so the test can try files the browser picker would hide.
  const user = userEvent.setup({ applyAccept: false });
  render(<FileDropzone title="Upload your resume" description="Text-based PDF." onFile={onFile} {...props} />);
  return { user, onFile, input: screen.getByLabelText("Choose a PDF file") };
}

describe("FileDropzone", () => {
  it("passes a PDF to onFile", async () => {
    const { user, onFile, input } = setup();
    const file = pdf();
    await user.upload(input, file);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("rejects a Word file with a message (TC-11)", async () => {
    const { user, onFile, input } = setup();
    const docx = new File(["x"], "resume.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await user.upload(input, docx);
    expect(screen.getByRole("alert")).toHaveTextContent("Only PDF files are accepted");
    expect(onFile).not.toHaveBeenCalled();
  });

  it("rejects a PDF over 10 MB with a message (TC-11)", async () => {
    const { user, onFile, input } = setup();
    await user.upload(input, pdf(10 * 1024 * 1024 + 1));
    expect(screen.getByRole("alert")).toHaveTextContent("larger than 10 MB");
    expect(onFile).not.toHaveBeenCalled();
  });

  it("shows the server's error and the busy state", () => {
    render(<FileDropzone title="Upload" busy busyText="Reading your resume…" error="This PDF has no selectable text." onFile={() => {}} />);
    expect(screen.getByText("Reading your resume…")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("no selectable text");
    expect(screen.getByRole("button", { name: /Choose/ })).toBeDisabled();
  });
});
