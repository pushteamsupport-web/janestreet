import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailVerification } from "@/components/EmailVerification";
import { EmailConfirmation } from "@/components/EmailConfirmation";

const { getSession, exchangeCodeForSession, resend } = vi.hoisted(() => ({ getSession: vi.fn(), exchangeCodeForSession: vi.fn(), resend: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession, exchangeCodeForSession, resend } } }));

afterEach(() => { cleanup(); vi.resetAllMocks(); vi.useRealTimers(); window.history.replaceState(null, "", "/"); });

describe("Email-link signup verification", () => {
  it("resends a confirmation link with the same-origin callback", async () => {
    resend.mockResolvedValueOnce({ error: null });
    render(<EmailVerification onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "client@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Resend verification link" }));
    await waitFor(() => expect(resend).toHaveBeenCalledWith({ type: "signup", email: "client@example.com", options: { emailRedirectTo: `${window.location.origin}/verified` } }));
  });

  it("does not send a link for an invalid address", () => {
    render(<EmailVerification onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Resend verification link" }));
    expect(resend).not.toHaveBeenCalled();
  });

  it("waits 60 seconds before allowing another confirmation email", async () => {
    vi.useFakeTimers();
    resend.mockResolvedValueOnce({ error: null });
    render(<EmailVerification email="client@example.com" onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Resend link in 60s" }));
    expect(resend).not.toHaveBeenCalled();
    for (let second = 0; second < 60; second++) {
      await act(async () => { vi.advanceTimersByTime(1000); });
    }
    fireEvent.click(screen.getByRole("button", { name: "Resend verification link" }));
    await act(async () => {});
    expect(resend).toHaveBeenCalledOnce();
  });

  it("continues only after a confirmation link returns a session", async () => {
    getSession.mockResolvedValueOnce({ data: { session: { user: { id: "client-id" } } }, error: null });
    const onVerified = vi.fn();
    render(<EmailConfirmation onVerified={onVerified} onBack={vi.fn()} />);
    await waitFor(() => expect(onVerified).toHaveBeenCalledOnce());
  });

  it("does not continue without a confirmed session", async () => {
    getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    const onVerified = vi.fn();
    render(<EmailConfirmation onVerified={onVerified} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("exchanges a PKCE confirmation link before continuing", async () => {
    window.history.replaceState(null, "", "/verified?code=confirmation-code");
    exchangeCodeForSession.mockResolvedValueOnce({ data: { session: { user: { id: "client-id" } } }, error: null });
    const onVerified = vi.fn();
    render(<EmailConfirmation onVerified={onVerified} onBack={vi.fn()} />);
    await waitFor(() => expect(onVerified).toHaveBeenCalledOnce());
    expect(exchangeCodeForSession).toHaveBeenCalledWith("confirmation-code");
    expect(window.location.search).toBe("");
  });

  it("does not accept an expired link even when a prior session exists", async () => {
    window.history.replaceState(null, "", "/verified#error=access_denied&error_code=otp_expired");
    const onVerified = vi.fn();
    render(<EmailConfirmation onVerified={onVerified} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(getSession).not.toHaveBeenCalled();
    expect(onVerified).not.toHaveBeenCalled();
  });
});
