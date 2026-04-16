import { useMemo, useState } from "react";
import { FiArrowLeft, FiLock } from "react-icons/fi";

import BrandWordmark from "../components/BrandWordmark";
import { API_BASE_URL, navigateTo } from "../utils";

function readTokenFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return (params.get("token") || "").trim();
}

export default function ResetPassword() {
  const initialToken = useMemo(() => readTokenFromUrl(), []);
  const [token, setToken] = useState(initialToken);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== password2) {
      setError("Passwords do not match.");
      return;
    }
    if (!token.trim()) {
      setError("Missing reset token. Open the link from your email again.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), new_password: password }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Reset failed.");
      }
      setMessage("Password updated. You can sign in with your new password.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-2 py-6 sm:px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandWordmark onClick={() => navigateTo("/")} />
          <h1 className="text-xl font-semibold tracking-tight">Choose a new password</h1>
          <p className="text-secondary text-sm leading-relaxed">Links expire after one hour for security.</p>
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
            <span className="text-secondary font-medium">Reset token</span>
            <input
              type="text"
              className="brand-input w-full rounded-xl px-4 py-2.5 font-mono text-xs"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste token from email link"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-secondary font-medium">New password</span>
            <div className="relative">
              <FiLock className="text-muted pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" aria-hidden />
              <input
                type="password"
                required
                minLength={8}
                className="brand-input w-full rounded-xl py-2.5 pl-10 pr-4"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-secondary font-medium">Confirm password</span>
            <input
              type="password"
              required
              minLength={8}
              className="brand-input w-full rounded-xl px-4 py-2.5"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="brand-pill-active w-full rounded-xl py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {loading ? "Saving…" : "Update password"}
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
