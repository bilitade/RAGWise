import { useEffect, useLayoutEffect, useState } from "react";
import { FiMoon, FiSun } from "react-icons/fi";

import { defaultRouteForRole, useAuth } from "./auth";
import type { AppRoute, DocumentsTab, SettingsTab, ThemeMode } from "./types";
import { getAccessToken, getCurrentRoute, goHome, navigateTo, readThemePreference, writeThemePreference } from "./utils";
import BrandWordmark from "./components/BrandWordmark";
import { WorkspaceAppBar, type WorkspaceAppPage } from "./components/WorkspaceChrome";
import Landing from "./pages/Landing";
import Documents from "./pages/Documents";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";

export default function App() {
  const { user, authLoading } = useAuth();
  const [theme, setTheme] = useState<ThemeMode>(() => readThemePreference());
  const [route, setRoute] = useState<AppRoute>(getCurrentRoute());
  const [documentsTab, setDocumentsTab] = useState<DocumentsTab>("files");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("api");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    const handleRouteChange = () => setRoute(getCurrentRoute());
    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, []);

  const isProtectedRoute = route === "/chat" || route === "/documents" || route === "/settings";

  useLayoutEffect(() => {
    if (authLoading) return;
    if (isProtectedRoute && !user) {
      navigateTo("/login");
    }
  }, [isProtectedRoute, authLoading, user, route]);

  useLayoutEffect(() => {
    if (authLoading || !user) return;
    if (route === "/login") {
      navigateTo(defaultRouteForRole(user.role));
    }
  }, [authLoading, user, route]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (user.role === "normal" && (route === "/documents" || route === "/settings")) {
      navigateTo("/chat");
      return;
    }
    if (user.role === "pro" && route === "/settings") {
      navigateTo("/documents");
    }
  }, [route, user, authLoading]);

  const workspaceRoute = route !== "/" && route !== "/login";
  const tokenPresent = !!getAccessToken();
  const showWorkspaceLoading = workspaceRoute && tokenPresent && authLoading;
  const blockingUnauthenticated = isProtectedRoute && !authLoading && !user;

  return (
    <div className="app-shell box-border min-h-[100dvh] w-full px-[5%] py-4">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-none flex-1 flex-col gap-4">
        {showWorkspaceLoading ? (
          <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-2 px-4">
            <p className="text-secondary text-sm">Loading workspace…</p>
          </div>
        ) : blockingUnauthenticated ? (
          <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-2 px-4">
            <p className="text-secondary text-sm">Redirecting to sign in…</p>
          </div>
        ) : route === "/" ? (
          <div className="flex flex-col gap-3">
            <header className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="flex min-w-0 flex-1 justify-start">
                <BrandWordmark onClick={goHome} />
              </div>
              <nav
                className="flex max-w-[100vw] shrink-0 items-center justify-center gap-3 overflow-x-auto px-1 py-0.5 text-center sm:gap-8 sm:px-2"
                aria-label="Page sections"
              >
                <a
                  href="#landing-home"
                  className="text-secondary hover:text-[var(--text-primary)] whitespace-nowrap text-sm font-medium transition-colors"
                >
                  Home
                </a>
                <a
                  href="#landing-features"
                  className="text-secondary hover:text-[var(--text-primary)] whitespace-nowrap text-sm font-medium transition-colors"
                >
                  Features
                </a>
                <a
                  href="#landing-flow"
                  className="text-secondary hover:text-[var(--text-primary)] whitespace-nowrap text-sm font-medium transition-colors"
                >
                  Flow
                </a>
              </nav>
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                {user ? (
                  <button
                    type="button"
                    onClick={() => navigateTo(defaultRouteForRole(user.role))}
                    className="brand-pill rounded-xl px-3 py-2.5 text-sm font-medium"
                  >
                    Open app
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigateTo("/login")}
                    className="brand-pill rounded-xl px-3 py-2.5 text-sm font-medium"
                  >
                    Log in
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                  className="brand-secondary flex h-10 w-10 items-center justify-center rounded-xl"
                  aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
                  title={theme === "dark" ? "Light" : "Dark"}
                >
                  {theme === "dark" ? <FiSun className="size-5" strokeWidth={2.25} /> : <FiMoon className="size-5" strokeWidth={2.25} />}
                </button>
              </div>
            </header>

            <Landing />
          </div>
        ) : route === "/login" || route === "/forgot-password" || route === "/reset-password" ? (
          route === "/forgot-password" ? (
            <ForgotPassword />
          ) : route === "/reset-password" ? (
            <ResetPassword />
          ) : authLoading ? (
            <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-2 px-4">
              <p className="text-secondary text-sm">Loading…</p>
            </div>
          ) : user ? (
            <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-2 px-4">
              <p className="text-secondary text-sm">Loading…</p>
            </div>
          ) : (
            <Login />
          )
        ) : (
          <div className="grid h-[calc(100dvh-2rem)] min-h-0 w-full shrink-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
            <WorkspaceAppBar
              theme={theme}
              setTheme={setTheme}
              activePage={
                (route === "/settings"
                  ? "settings"
                  : route === "/documents"
                    ? "documents"
                    : "chat") satisfies WorkspaceAppPage
              }
            />
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              {route === "/settings" ? (
                <Settings activeTab={settingsTab} onTabChange={setSettingsTab} />
              ) : route === "/documents" ? (
                <Documents activeTab={documentsTab} onTabChange={setDocumentsTab} />
              ) : (
                <Chat />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
