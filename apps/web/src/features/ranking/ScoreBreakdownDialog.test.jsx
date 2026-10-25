// Score breakdown dialog (FR-VAC-06; Oct 19 change 3): the stored matching, interview, and final scores are shown, and
// there is no "Rank N" line or rounding note under the title (the rank stays in the ranking table).
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/screening/api", () => ({ useReviewApplication: vi.fn() }));
vi.mock("@/features/evaluations/api", () => ({ useEvaluation: vi.fn() }));

const { useReviewApplication } = await import("@/features/screening/api");
const { useEvaluation } = await import("@/features/evaluations/api");
const { ScoreBreakdownDialog } = await import("./ScoreBreakdownDialog");

const ROW = { applicationId: "a1", applicantName: "Ana Cruz", rank: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  useReviewApplication.mockReturnValue({
    isPending: false,
    isError: false,
    data: {
      matching: {
        matchingScore: 88.19,
        skillsScore: 87.5,
        experienceScore: 88.89,
        weights: { skills: 0.5, experience: 0.5 },
        matchedSkills: ["Cash handling"],
        missingSkills: [],
      },
    },
  });
  useEvaluation.mockReturnValue({
    isPending: false,
    isError: false,
    data: {
      sections: [
        { sectionCode: "A", sectionName: "Communication and Interpersonal Skills", weight: 30 },
        { sectionCode: "B", sectionName: "Personal Effectiveness Skills and Traits", weight: 30 },
        { sectionCode: "C", sectionName: "Job Specific Skills and Experience", weight: 40 },
      ],
      evaluation: {
        reused: false,
        sectionScores: { A: 83.33, B: 75, C: 75 },
        interviewScore: 77.5,
        overallRating: 4,
        matchingScore: 88.19,
        finalScore: 82.85,
        passingScore: 75,
        passed: true,
      },
    },
  });
});

describe("ScoreBreakdownDialog", () => {
  it("shows the stored scores with no rank line or rounding note under the title", () => {
    render(<ScoreBreakdownDialog row={ROW} onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "Score breakdown: Ana Cruz" });
    // decision 40-1: the matching block is titled "RESUME MATCHING" (was "Matching (SBERT)")
    expect(within(dialog).getByRole("heading", { name: "RESUME MATCHING" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("heading", { name: "Matching (SBERT)" })).not.toBeInTheDocument();
    expect(within(dialog).getByText("Cash handling")).toBeInTheDocument();
    expect(within(dialog).getAllByText("82.85%").length).toBeGreaterThan(0); // the final score
    // decision 40-1: the interview score stays, without the "Sum of the weighted sections … (WSM-01)." caption
    expect(within(dialog).getAllByText("77.50%").length).toBeGreaterThan(0);
    expect(dialog.textContent).not.toMatch(/Sum of the weighted sections/);
    expect(dialog.textContent).not.toMatch(/WSM-01/);

    expect(dialog.textContent).toMatch(/Score breakdown: Ana Cruz/);
    expect(dialog.textContent).not.toMatch(/Rank\s*#?\s*\d/);
    expect(dialog.textContent).not.toMatch(/rounded to 2 decimals/i);
    expect(dialog).not.toHaveAttribute("aria-describedby");
  });
});
