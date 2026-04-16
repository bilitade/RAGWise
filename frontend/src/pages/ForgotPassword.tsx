import { useState } from "react";
import { FiArrowLeft, FiMail } from "react-icons/fi";

import BrandWordmark from "../components/BrandWordmark";
import { API_BASE_URL, navigateTo } from "../utils";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      setMessage(
        "If an account exists for that address, we sent a reset link. Check your inbox and spam folder.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-2 py-6 sm:px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandWordmark onClick={() => navigateTo("/")} />
          <h1 className="text-xl font-semibold tracking-tight">Reset your password</h1>
          <p className="text-secondary text-sm leading-relaxed">
            Enter your work email. We will send a one-time link if the account exists and outbound email is configured.
          </p>
        </div>

        {(message || error) && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              error
                ? "border-[color-mix(in_srgb,var(--error)_45%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
                : "border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color-mix(in_srgb,var(--success)_8%,transparent)]"
            }`}
            role="status"
          >
            {error ? <span className="status-error">{error}</span> : <span className="status-success">{message}</span>}
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="brand-card space-y-4 rounded-2xl p-6">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-secondary font-medium">Email</span>
            <div className="relative">
              <FiMail className="text-muted pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" aria-hidden />
              <input
                type="email"
                required
                className="brand-input w-full rounded-xl py-2.5 pl-10 pr-4"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="brand-pill-active w-full rounded-xl py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => navigateTo("/login")}
          className="text-secondary hover:text-[var(--text-primary)] mx-auto flex items-center gap-2 text-sm font-medium"
        >
          <FiArrowLeft className="size-4" aria-hidden />
          Back to sign in
        </button>
      </div>
    </div>
  );
}
