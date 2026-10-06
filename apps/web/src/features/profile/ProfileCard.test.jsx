// Dashboard profile card: view → edit → save (FR-PROF-05; TC-15).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), patch: vi.fn() },
}));

const { api } = await import("@/lib/apiClient");
const { ProfileCard } = await import("./ProfileCard");

const PROFILE = {
  applicantId: "a1",
  firstName: "Juan",
  middleName: null,
  lastName: "Dela Cruz",
  suffix: null,
  contactNumber: "0917-123-4567",
  birthdate: "2002-07-10",
  gender: "male",
  heightCm: 172.7,
  addressLine: "Blk 5 Lot 3",
  city: "Baliuag",
  province: "Bulacan",
  educationLevel: "senior_high",
  email: "juan@vera.test",
};

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ProfileCard />
    </QueryClientProvider>,
  );
}

describe("ProfileCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue(PROFILE);
  });

  it("shows the stored profile read-only", async () => {
    renderCard();
    expect(await screen.findByRole("heading", { name: "Juan Dela Cruz" })).toBeInTheDocument();
    expect(screen.getByLabelText("House number / street")).toHaveValue("Blk 5 Lot 3");
    expect(screen.getByLabelText("House number / street")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("edits the address and saves it; the email stays locked (TC-15)", async () => {
    api.patch.mockResolvedValue({ ...PROFILE, addressLine: "45 Mabini St." });
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByRole("button", { name: "Edit profile" }));
    expect(screen.getByLabelText("Email")).toBeDisabled();
    const address = screen.getByLabelText("House number / street");
    expect(address).toBeEnabled();
    await user.clear(address);
    await user.type(address, "45 Mabini St.");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledOnce());
    const [path, body] = api.patch.mock.calls[0];
    expect(path).toBe("/applicant/profile");
    expect(body).toMatchObject({ addressLine: "45 Mabini St.", city: "Baliuag", heightCm: 172.7 });
    expect(body).not.toHaveProperty("email");

    await waitFor(() => expect(screen.getByLabelText("House number / street")).toBeDisabled());
    expect(screen.getByLabelText("House number / street")).toHaveValue("45 Mabini St.");
  });

  it("discards changes on Cancel", async () => {
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByRole("button", { name: "Edit profile" }));
    await user.clear(screen.getByLabelText("Municipality / city"));
    await user.type(screen.getByLabelText("Municipality / city"), "Malolos");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByLabelText("Municipality / city")).toHaveValue("Baliuag");
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("shows an error with retry when the profile cannot load", async () => {
    api.get.mockRejectedValue(new Error("Network down"));
    renderCard();
    expect(await screen.findByText("Your profile could not be loaded")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
