import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ScoreChip } from "./ScoreChip";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("shows the HR label and tone by default", () => {
    render(<StatusBadge kind="application" value="shortlisted" />);
    expect(screen.getByText("Screening")).toHaveClass("bg-info-soft", "text-info");
  });

  it("shows the applicant label for the applicant audience", () => {
    render(<StatusBadge kind="application" value="dropped" audience="applicant" />);
    expect(screen.getByText("Closed (no response)")).toBeInTheDocument();
  });

  it("supports document, vacancy, and interview statuses", () => {
    render(
      <>
        <StatusBadge kind="verification" value="pending" />
        <StatusBadge kind="vacancy" value="open" />
        <StatusBadge kind="interview" value="confirmed" />
      </>,
    );
    expect(screen.getByText("For verification")).toHaveClass("bg-warning-soft");
    expect(screen.getByText("Active")).toHaveClass("bg-success-soft");
    expect(screen.getByText("Scheduled")).toHaveClass("bg-info-soft");
  });
});

describe("ScoreChip", () => {
  it("shows the label and a 2-decimal percentage", () => {
    render(<ScoreChip kind="final" value={78.66} />);
    expect(screen.getByText("78.66%")).toBeInTheDocument();
    expect(screen.getByText("Final")).toBeInTheDocument();
  });

  it("shows 'Not evaluated' instead of 0 when there is no score", () => {
    render(<ScoreChip kind="interview" value={null} />);
    expect(screen.getByText("Not evaluated")).toBeInTheDocument();
    expect(screen.queryByText(/0\.00%/)).not.toBeInTheDocument();
  });
});
