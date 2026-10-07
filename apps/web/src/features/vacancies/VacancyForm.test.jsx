// Vacancy form (FR-VAC-01, BR-01..03; TC-23, TC-24) with Competency Profile section weights (S9b).
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { VacancyForm } from "./VacancyForm";

const RUBRIC = [
  {
    sectionCode: "A",
    sectionName: "Communication and Interpersonal Skills",
    items: [{ competencyId: "i1", competencyName: "Oral Communication/Listening" }, { competencyId: "i2", competencyName: "Customer Relations" }],
  },
  { sectionCode: "B", sectionName: "Personal Effectiveness Skills and Traits", items: [{ competencyId: "i3", competencyName: "Problem Solving" }] },
  { sectionCode: "C", sectionName: "Job Specific Skills and Experience", items: [{ competencyId: "i4", competencyName: "Technical Skills" }] },
];
const A = "A. Communication and Interpersonal Skills";
const B = "B. Personal Effectiveness Skills and Traits";
const C = "C. Job Specific Skills and Experience";
const COMPANIES = [{ companyId: "co-1", companyName: "Kabayan Mart" }];
const DEFAULTS = { matchingThreshold: 40, capMultiplier: 8 };

function renderForm(props = {}) {
  const onSubmit = vi.fn(async () => {});
  // fast typing: the form has many fields
  const user = userEvent.setup({ delay: null });
  render(<VacancyForm mode="new" defaults={DEFAULTS} rubric={RUBRIC} companies={COMPANIES} onSubmit={onSubmit} {...props} />);
  return { user, onSubmit };
}

async function set(user, label, value) {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  if (value !== "") {
    await user.click(input);
    await user.paste(value);
  }
}

async function fillCashier(user, { c = "40" } = {}) {
  await user.selectOptions(screen.getByLabelText("Company"), "co-1");
  await set(user, "Job title", "Cashier");
  await set(user, "Description", "Handles payments at the counter.");
  await set(user, "Key responsibilities", "Process payments");
  await set(user, "Required skills", "Cash handling\nPOS system operation");
  await set(user, "Slots needed", "2");
  await set(user, "Endorsement count", "3");
  await set(user, "Passing score (%)", "75");
  await set(user, A, "30");
  await set(user, B, "30");
  await set(user, C, c);
}

describe("VacancyForm", () => {
  it("lists each section's items", () => {
    renderForm();
    expect(screen.getByText("Oral Communication/Listening · Customer Relations")).toBeInTheDocument();
  });

  it("shows a live total in the error tone and blocks publishing when weights are 90% (TC-23)", async () => {
    const { user, onSubmit } = renderForm();
    await fillCashier(user, { c: "30" }); // 30 + 30 + 30

    const total = screen.getByRole("status", { name: "Total 90%" });
    expect(total).toHaveClass("text-error");
    expect(screen.getByRole("button", { name: "Save and publish" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("Weights must total 100%; now 90%")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires the cap to be at least slots × 4 (TC-24)", async () => {
    const { user, onSubmit } = renderForm();
    await fillCashier(user);
    await set(user, "Application cap", "6");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByText("Application cap must be at least 8 (slots × 4)")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("follows slots × 8 for the cap and slots for the endorsement count until edited", async () => {
    const { user } = renderForm();
    expect(screen.getByLabelText("Application cap")).toHaveValue(8);
    await set(user, "Slots needed", "3");
    expect(screen.getByLabelText("Application cap")).toHaveValue(24);
    expect(screen.getByLabelText("Endorsement count")).toHaveValue(3);
    expect(screen.getByText("Shortlist per group: slots × 2 = 6")).toBeInTheDocument();

    await set(user, "Application cap", "30");
    await set(user, "Slots needed", "4");
    expect(screen.getByLabelText("Application cap")).toHaveValue(30);
  });

  it("submits the payload with competencies and the publish intent", async () => {
    const { user, onSubmit } = renderForm();
    await fillCashier(user);
    expect(screen.getByRole("status", { name: "Total 100%" })).toHaveClass("text-success");

    await user.click(screen.getByRole("button", { name: "Save and publish" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    const [payload, options] = onSubmit.mock.calls[0];
    expect(options).toEqual({ publish: true });
    expect(payload).toMatchObject({
      companyId: "co-1",
      jobTitle: "Cashier",
      slotsNeeded: 2,
      applicationCap: 16,
      endorsementCount: 3,
      matchingThreshold: 40,
      passingScore: 75,
      minAge: null,
      genderRequirement: "any",
      minEducationLevel: null,
      sectionWeights: [
        { sectionCode: "A", weight: 30 },
        { sectionCode: "B", weight: 30 },
        { sectionCode: "C", weight: 40 },
      ],
    });
  });

  it("allows a section at 0% (empty counts as 0)", async () => {
    const { user, onSubmit } = renderForm();
    await fillCashier(user);
    await set(user, A, "60");
    await set(user, B, "");
    expect(screen.getByRole("status", { name: "Total 100%" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save and publish" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].sectionWeights).toEqual([
      { sectionCode: "A", weight: 60 },
      { sectionCode: "B", weight: 0 },
      { sectionCode: "C", weight: 40 },
    ]);
  });

  it("sends no section weights for a draft without any", async () => {
    const { user, onSubmit } = renderForm();
    await fillCashier(user);
    await set(user, A, "");
    await set(user, B, "");
    await set(user, C, "");
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].sectionWeights).toEqual([]);
  });

  it("locks everything but posting text and the cap after publishing (PRD FR-VAC-03)", async () => {
    const vacancy = {
      companyId: "co-1",
      jobTitle: "Cashier",
      jobDescription: "Handles payments.",
      keyResponsibilities: "Process payments",
      deploymentLocation: "Baliuag",
      employmentType: "Full-time",
      requiredSkills: "Cash handling",
      experienceRequirement: null,
      minYearsExperience: 1,
      minAge: 18,
      maxAge: 35,
      genderRequirement: "any",
      minEducationLevel: "senior_high",
      minHeightCm: null,
      slotsNeeded: 2,
      applicationCap: 16,
      endorsementCount: 3,
      matchingThreshold: 40,
      passingScore: 75,
      sectionWeights: RUBRIC.map((s, i) => ({ sectionCode: s.sectionCode, sectionName: s.sectionName, weight: [30, 30, 40][i], items: [] })),
    };
    const { user, onSubmit } = renderForm({ mode: "published", vacancy });

    expect(screen.getByLabelText("Required skills")).toBeDisabled();
    expect(screen.getByLabelText("Passing score (%)")).toBeDisabled();
    expect(screen.getByLabelText(A)).toBeDisabled();
    expect(screen.getByLabelText("Company")).toBeDisabled();
    expect(screen.getByLabelText("Job title")).toBeEnabled();
    expect(screen.getByLabelText("Application cap")).toBeEnabled();

    await set(user, "Application cap", "12");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("The cap can only be raised (now 16)")).toBeInTheDocument();

    await set(user, "Application cap", "20");
    await set(user, "Job title", "Cashier (Baliuag)");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0]).toEqual({
      jobTitle: "Cashier (Baliuag)",
      jobDescription: "Handles payments.",
      keyResponsibilities: "Process payments",
      deploymentLocation: "Baliuag",
      employmentType: "Full-time",
      applicationCap: 20,
    });
  });
});
