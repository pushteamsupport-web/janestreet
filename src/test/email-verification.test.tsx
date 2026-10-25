import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmailVerification } from "@/components/EmailVerification";

const { getUser, resend, unsubscribe, onAuthStateChange } = vi.hoisted(() => ({
  getUser: vi.fn(), resend: vi.fn(), unsubscribe: vi.fn(), onAuthStateChange: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser, resend, onAuthStateChange } } }));

beforeEach(() => {
  window.history.replaceState({}, "", "/verified");
  getUser.mockResolvedValue({ data: { user: null }, error: null });
  onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("Signup confirmation links", () => {
  it("resends a signup link returning to the same-origin confirmation page", async () => {
    resend.mockResolvedValueOnce({ error: null });
    render(<EmailVerification onVerified={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "client@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Resend verification link" }));
    await waitFor(() => expect(resend).toHaveBeenCalledWith({
      type: "signup", email: "client@example.com", options: { emailRedirectTo: `${window.location.origin}/verified` },
    }));
  });

  it("continues only after the server confirms the email", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "client-id", email_confirmed_at: "2026-10-25T01:12:00Z" } }, error: null });
    const onVerified = vi.fn();
    render(<EmailVerification onVerified={onVerified} onBack={vi.fn()} />);
    await waitFor(() => expect(onVerified).toHaveBeenCalledOnce());
  });

  it("does not continue for an unconfirmed account", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "client-id", email_confirmed_at: null } }, error: null });
    const onVerified = vi.fn();
    render(<EmailVerification onVerified={onVerified} onBack={vi.fn()} />);
    await waitFor(() => expect(getUser).toHaveBeenCalledOnce());
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("does not continue when the server rejects a session", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "expired" } });
    const onVerified = vi.fn();
    render(<EmailVerification onVerified={onVerified} onBack={vi.fn()} />);
    await waitFor(() => expect(getUser).toHaveBeenCalledOnce());
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("does not continue from an expired link even with an existing confirmed session", async () => {
    window.history.replaceState({}, "", "/verified#error=access_denied&error_code=otp_expired");
    getUser.mockResolvedValueOnce({ data: { user: { email_confirmed_at: "2026-10-25" } }, error: null });
    const onVerified = vi.fn();
    render(<EmailVerification onVerified={onVerified} onBack={vi.fn()} />);
    expect(onVerified).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });
});
