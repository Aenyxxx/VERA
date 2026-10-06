// Vacancy form (FR-VAC-01, BR-01..03; TC-23, TC-24).
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { VacancyForm } from "./VacancyForm";

const COMPETENCIES = [
  { competencyId: "c-comm", competencyName: "Communication" },
  { competencyId: "c-tech", competencyName: "Technical Skills" },
  { competencyId: "c-adapt", competencyName: "Adaptability" },
];
const COMPANIES = [{ companyId: "co-1", companyName: "Kabayan Mart" }];
const DEFAULTS = { matchingThreshold: 40, capMultiplier: 8 };

function renderForm(props = {}) {
  const onSubmit = vi.fn(async () => {});
  // fast typing: the form has many fields
  const user = userEvent.setup({ delay: null });
  render(<VacancyForm mode="new" defaults={DEFAULTS} competencies={COMPETENCIES} companies={COMPANIES} onSubmit={onSubmit} {...props} />);
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

async function fillCashier(user, { adaptability = "30" } = {}) {
  await user.selectOptions(screen.getByLabelText("Company"), "co-1");
  await set(user, "Job title", "Cashier");
  await set(user, "Description", "Handles payments at the counter.");
  await set(user, "Key responsibilities", "Process payments");
  await set(user, "Required skills", "Cash handling\nPOS system operation");
  await set(user, "Slots needed", "2");
  await set(user, "Endorsement count", "3");
  await set(user, "Passing score (%)", "75");
  await set(user, "Communication", "30");
  await set(user, "Technical Skills", "40");
  await set(user, "Adaptability", adaptability);
}

describe("VacancyForm", () => {
  it("shows a live total in the error tone and blocks publishing when weights are 90% (TC-23)", async () => {
    const { user, onSubmit } = renderForm();
    await fillCashier(user, { adaptability: "20" });

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
      competencies: [
        { competencyId: "c-comm", weight: 30 },
        { competencyId: "c-tech", weight: 40 },
        { competencyId: "c-adapt", weight: 30 },
      ],
    });
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
      competencies: COMPETENCIES.map((c, i) => ({ ...c, weight: [30, 40, 30][i] })),
    };
    const { user, onSubmit } = renderForm({ mode: "published", vacancy });

    expect(screen.getByLabelText("Required skills")).toBeDisabled();
    expect(screen.getByLabelText("Passing score (%)")).toBeDisabled();
    expect(screen.getByLabelText("Communication")).toBeDisabled();
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
