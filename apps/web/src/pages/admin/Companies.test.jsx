// Company Management (FR-COMP-01..03; TC-20, TC-21, TC-22).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), list: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { api, ApiError } = await import("@/lib/apiClient");
const { toast } = await import("sonner");
const { default: Companies } = await import("./Companies");

const KABAYAN_ROW = {
  companyId: "c1",
  companyName: "Kabayan Mart",
  industry: "Retail",
  contactPersonName: "Liza Santos",
  contactEmail: "liza@kabayanmart.com",
  vacancyCount: 2,
};
const SARI_ROW = { ...KABAYAN_ROW, companyId: "c2", companyName: "Sari Foods", industry: "Food" };
const KABAYAN = {
  ...KABAYAN_ROW,
  description: "Grocery chain in Bulacan",
  website: "https://kabayanmart.com",
  contactPersonPosition: "HR Manager",
  contactNumber: "0917-555-0101",
  counts: { vacancies: 3, openVacancies: 1, inAgencyInterview: 4, awaitingClient: 2, hired: 1, endorsed: 3 },
};

let rows;

function renderAt(path = "/admin/companies") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/admin/companies", element: <Companies /> },
      { path: "/admin/companies/:id", element: <Companies /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

// Paste instead of typing key by key: the form has many fields and typing is slow under parallel test load.
async function fillCompany(user, values) {
  for (const [label, value] of Object.entries(values)) {
    const input = screen.getByLabelText(label);
    await user.clear(input);
    if (value) {
      await user.click(input);
      await user.paste(value);
    }
  }
}

describe("Company Management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rows = [KABAYAN_ROW, SARI_ROW];
    api.list.mockImplementation(async (path) => {
      const search = new URL(path, "http://x").searchParams.get("search");
      const data = rows.filter((r) => r.companyName.toLowerCase().includes(search.toLowerCase()));
      return { data, meta: { page: 1, pageSize: 100, total: data.length } };
    });
    api.get.mockResolvedValue(KABAYAN);
  });

  it("lists companies with contact person and vacancy count", async () => {
    renderAt();
    const row = (await screen.findByText("Kabayan Mart")).closest("tr");
    expect(within(row).getByText("Retail")).toBeInTheDocument();
    expect(within(row).getByText("Liza Santos")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Sari Foods")).toBeInTheDocument();
  });

  it("searches by name (TC-22)", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByText("Sari Foods");

    await user.type(screen.getByLabelText("Search company name"), "kaba");

    await waitFor(() => expect(screen.queryByText("Sari Foods")).not.toBeInTheDocument());
    expect(screen.getByText("Kabayan Mart")).toBeInTheDocument();
    expect(api.list).toHaveBeenLastCalledWith("/admin/companies?search=kaba&pageSize=100");
  });

  it("shows a no-match state for a search with no results", async () => {
    const user = userEvent.setup();
    renderAt();
    await screen.findByText("Kabayan Mart");
    await user.type(screen.getByLabelText("Search company name"), "zzz");
    expect(await screen.findByText("No matches")).toBeInTheDocument();
  });

  it("shows an empty state with Add company", async () => {
    rows = [];
    renderAt();
    expect(await screen.findByText("No companies yet")).toBeInTheDocument();
  });

  it("adds a company with every field (TC-20)", async () => {
    api.post.mockResolvedValue({ ...KABAYAN, companyId: "c3" });
    const user = userEvent.setup();
    renderAt();

    await user.click((await screen.findAllByRole("button", { name: "Add company" }))[0]);
    await fillCompany(user, {
      "Company name": "Kabayan Mart",
      Industry: "Retail",
      "Description (optional)": "Grocery chain in Bulacan",
      "Website (optional)": "kabayanmart.com",
      Name: "Liza Santos",
      "Position (optional)": "HR Manager",
      Email: "liza@kabayanmart.com",
      "Contact number (optional)": "0917-555-0101",
    });
    await user.click(screen.getByRole("button", { name: "Save company" }));

    await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
    expect(api.post).toHaveBeenCalledWith("/admin/companies", {
      companyName: "Kabayan Mart",
      industry: "Retail",
      description: "Grocery chain in Bulacan",
      website: "https://kabayanmart.com",
      contactPersonName: "Liza Santos",
      contactPersonPosition: "HR Manager",
      contactEmail: "liza@kabayanmart.com",
      contactNumber: "0917-555-0101",
    });
    expect(toast.success).toHaveBeenCalledWith("Company added");
  });

  it("shows required-field errors and keeps the dialog open", async () => {
    const user = userEvent.setup();
    renderAt();
    await user.click((await screen.findAllByRole("button", { name: "Add company" }))[0]);
    await user.click(screen.getByRole("button", { name: "Save company" }));

    expect(await screen.findByText("Enter the company name")).toBeInTheDocument();
    expect(screen.getByText("Enter the contact email")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("shows a duplicate name under the Company name field (TC-21)", async () => {
    api.post.mockRejectedValue(
      new ApiError(409, "CONFLICT", "A company with this name already exists.", [
        { path: "companyName", message: "A company with this name already exists" },
      ]),
    );
    const user = userEvent.setup();
    renderAt();

    await user.click((await screen.findAllByRole("button", { name: "Add company" }))[0]);
    await fillCompany(user, {
      "Company name": "kabayan mart",
      Industry: "Retail",
      Name: "Liza Santos",
      Email: "liza@kabayanmart.com",
    });
    await user.click(screen.getByRole("button", { name: "Save company" }));

    const nameInput = screen.getByLabelText("Company name");
    await waitFor(() => expect(nameInput).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText("A company with this name already exists")).toHaveAttribute("id", "companyName-error");
    expect(nameInput).toHaveValue("kabayan mart");
  });

  it("opens the detail drawer with the contact person and the five counts", async () => {
    const user = userEvent.setup();
    const router = renderAt();

    await user.click(await screen.findByRole("button", { name: "View Kabayan Mart" }));

    expect(router.state.location.pathname).toBe("/admin/companies/c1");
    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText("HR Manager")).toBeInTheDocument();
    expect(within(drawer).getByText("Liza Santos")).toBeInTheDocument();
    for (const label of ["In agency interview", "Awaiting client", "Hired", "Total endorsed"]) {
      expect(within(drawer).getByText(label)).toBeInTheDocument();
    }
    expect(within(drawer).getByText("Vacancies (1 open)")).toBeInTheDocument();
    expect(within(drawer).getByRole("link", { name: "kabayanmart.com" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(api.get).toHaveBeenCalledWith("/admin/companies/c1");
  });

  it("edits a company from the table with the full record pre-filled", async () => {
    api.patch.mockResolvedValue({ ...KABAYAN, industry: "Supermarket" });
    const user = userEvent.setup();
    renderAt();

    await user.click(await screen.findByRole("button", { name: "Edit Kabayan Mart" }));
    expect(await screen.findByLabelText("Description (optional)")).toHaveValue("Grocery chain in Bulacan");
    await fillCompany(user, { Industry: "Supermarket" });
    await user.click(screen.getByRole("button", { name: "Save company" }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledOnce());
    const [path, body] = api.patch.mock.calls[0];
    expect(path).toBe("/admin/companies/c1");
    expect(body).toMatchObject({ industry: "Supermarket", website: "https://kabayanmart.com", contactNumber: "0917-555-0101" });
    expect(toast.success).toHaveBeenCalledWith("Company updated");
  });
});
