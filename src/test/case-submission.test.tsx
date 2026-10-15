import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  upload: vi.fn(),
  save: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options, useSearch: () => ({ tab: "new" }) }),
  useNavigate: () => mocks.navigate,
  Link: () => null,
}));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: vi.fn(), warning: mocks.warning } }));
vi.mock("@/components/ClientNav", () => ({ ClientNav: () => null }));
vi.mock("@/components/CaseProof", () => ({ CaseProof: () => null }));
vi.mock("@/components/CaseTimeline", () => ({ CaseTimeline: () => null }));
vi.mock("@/lib/cases", () => ({
  CASE_STATUS_LABELS: { under_review: "Under review" },
  MAX_CASE_PROOF_FILES: 10,
  uploadCaseProofFiles: mocks.upload,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "client-id" } } }) },
    from: () => ({
      select: () => ({
        order: () => new Promise(() => {}),
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
      insert: () => ({ select: () => ({ single: mocks.save }) }),
    }),
  },
}));

import { Route } from "@/routes/_authenticated/dashboard";

const savedCase = {
  id: "saved-case", case_number: 42, title: "Investment fraud report", asset_type: "Bitcoin (BTC)",
  amount_lost: 5000, amount_recovered: 0, status: "under_review", description: "An investment platform withheld my funds.",
  admin_note: "", created_at: "2026-10-15T14:00:00Z",
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["cases"], []);
  const Page = Route.options.component as ComponentType;
  render(<QueryClientProvider client={client}><Page /></QueryClientProvider>);
  fireEvent.change(screen.getByPlaceholderText("e.g. Investment platform fraud"), { target: { value: savedCase.title } });
  fireEvent.change(screen.getByPlaceholderText("5000"), { target: { value: "5000" } });
  fireEvent.change(screen.getByPlaceholderText(/Describe how the funds/), { target: { value: savedCase.description } });
  return client;
}

describe("Client case submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.save.mockResolvedValue({ data: savedCase, error: null });
  });

  it("notifies and returns to the dashboard with the saved case without waiting for proof uploads", async () => {
    mocks.upload.mockReturnValue(new Promise(() => {}));
    const client = setup();
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["proof"], "proof.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit case" }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard", search: { tab: "cases" }, replace: true }));
    expect(mocks.success).toHaveBeenCalledOnce();
    expect(client.getQueryData(["cases"])).toEqual([savedCase]);
    expect(mocks.upload).toHaveBeenCalledWith(expect.objectContaining({ caseId: "saved-case", userId: "client-id" }));
  });

  it("keeps the form and does not announce success if saving fails", async () => {
    mocks.save.mockResolvedValue({ data: null, error: new Error("Save failed") });
    const client = setup();
    fireEvent.click(screen.getByRole("button", { name: "Submit case" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit case" })).not.toBeDisabled());
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(client.getQueryData(["cases"])).toEqual([]);
    expect(screen.getByPlaceholderText("e.g. Investment platform fraud")).toHaveValue(savedCase.title);
  });
});