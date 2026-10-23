import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailVerification } from "@/components/EmailVerification";

const { verifyOtp, resend } = vi.hoisted(() => ({ verifyOtp: vi.fn(), resend: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { verifyOtp, resend } } }));

afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });

describe("Six-digit signup verification", () => {
  it("rejects fewer than six digits without checking or signing in", () => {
    const onVerified = vi.fn();
    render(<EmailVerification email="client@example.com" onVerified={onVerified} onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Six-digit email code"), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("verifies the six-digit signup code and continues only with a session", async () => {
    verifyOtp.mockResolvedValueOnce({ data: { session: { user: { id: "client-id" } } }, error: null });
    const onVerified = vi.fn();
    render(<EmailVerification email="client@example.com" onVerified={onVerified} onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Six-digit email code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
    await waitFor(() => expect(onVerified).toHaveBeenCalledOnce());
    expect(verifyOtp).toHaveBeenCalledWith({ email: "client@example.com", token: "123456", type: "signup" });
  });

  it("does not continue after a rejected code", async () => {
    verifyOtp.mockResolvedValueOnce({ data: { session: null }, error: { message: "expired" } });
    const onVerified = vi.fn();
    render(<EmailVerification email="client@example.com" onVerified={onVerified} onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Six-digit email code"), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("resends signup verification for the entered address", async () => {
    resend.mockResolvedValueOnce({ error: null });
    render(<EmailVerification onVerified={vi.fn()} onBack={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "client@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    await waitFor(() => expect(resend).toHaveBeenCalledWith({ type: "signup", email: "client@example.com" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Resend code in 60s" })).toBeDisabled());
  });

  it("waits 60 seconds before allowing another signup code", async () => {
    vi.useFakeTimers();
    render(<EmailVerification email="client@example.com" onVerified={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Resend code in 60s" })).toBeDisabled();
    for (let second = 0; second < 60; second++) {
      await act(async () => { vi.advanceTimersByTime(1000); });
    }
    expect(screen.getByRole("button", { name: "Resend code" })).toBeEnabled();
  });
});