import { useState } from "react";
import { FiLock } from "react-icons/fi";

import { defaultRouteForRole, useAuth } from "../auth";
import BrandWordmark from "../components/BrandWordmark";
import { API_BASE_URL, goHome, navigateTo, setAccessToken } from "../utils";

export default function Login() {
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const res = (await response.json()) as { access_token: string };
      setAccessToken(res.access_token);
      const me = await refreshUser();
      navigateTo(me ? defaultRouteForRole(me.role) : "/chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-2 py-6 sm:px-4">
      <div className="flex w-full max-w-md flex-col gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandWordmark onClick={goHome} />
          <p className="text-secondary text-sm">Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="brand-card flex w-full flex-col gap-4 rounded-[28px] p-8">
          <div className="flex items-center gap-2 text-secondary">
            <FiLock />
            <span className="text-sm font-medium">Credentials</span>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-secondary">Email</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="brand-input rounded-2xl px-4 py-3"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-secondary">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="brand-input rounded-2xl px-4 py-3"
              required
            />
          </label>
          {error ? <p className="text-sm status-error">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="brand-pill-active rounded-2xl px-4 py-3 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
