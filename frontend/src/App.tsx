import { useEffect, useState } from "react";
import { FiMoon, FiSun } from "react-icons/fi";

import type { AppRoute, DocumentsTab, SettingsTab, ThemeMode } from "./types";
import { getCurrentRoute, navigateTo, readThemePreference, writeThemePreference } from "./utils";
import BrandWordmark from "./components/BrandWordmark";
import { WorkspaceAppBar, type WorkspaceAppPage } from "./components/WorkspaceChrome";
import Landing from "./pages/Landing";
import Documents from "./pages/Documents";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Settings from "./pages/Settings";

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => readThemePreference());
  const [route, setRoute] = useState<AppRoute>(getCurrentRoute());
  const [documentsTab, setDocumentsTab] = useState<DocumentsTab>("files");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("config");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeThemePreference(theme);
  }, [theme]);

  useEffect(() => {
    const handleRouteChange = () => setRoute(getCurrentRoute());
    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, []);

  return (
    <div className="app-shell box-border min-h-[100dvh] w-full px-[5%] py-4">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-none flex-1 flex-col gap-4">
        {route === "/" ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <BrandWordmark />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => navigateTo("/login")}
                  className="brand-pill rounded-xl px-3 py-2.5 text-sm font-medium"
                >
                  Log in
                </button>
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
            </div>

            <Landing />
          </>
        ) : route === "/login" ? (
          <Login />
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
