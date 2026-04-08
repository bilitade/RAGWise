import { useEffect, useState } from "react";
import { FiMoon, FiSun } from "react-icons/fi";

import type { AppRoute, DocumentsTab, SettingsTab, ThemeMode } from "./types";
import { getCurrentRoute, navigateTo } from "./utils";
import BrandWordmark from "./components/BrandWordmark";
import Landing from "./pages/Landing";
import Documents from "./pages/Documents";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import Settings from "./pages/Settings";

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [route, setRoute] = useState<AppRoute>(getCurrentRoute());
  const [documentsTab, setDocumentsTab] = useState<DocumentsTab>("files");
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("config");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const handleRouteChange = () => setRoute(getCurrentRoute());
    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, []);

  return (
    <div className="app-shell px-4 py-6 sm:px-6 lg:px-8">
      <div
        className={`mx-auto flex w-full flex-col gap-6 ${route === "/settings" || route === "/documents" || route === "/chat" ? "max-w-[1600px]" : "max-w-7xl"}`}
      >
        {route === "/" ? (
          <>
            <div className="flex items-center justify-between gap-4 px-1">
              <BrandWordmark />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigateTo("/login")}
                  className="brand-pill rounded-2xl px-4 py-3 text-sm font-medium"
                >
                  Admin login
                </button>
                <button
                  type="button"
                  onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                  className="brand-secondary rounded-2xl px-4 py-3 text-sm font-medium"
                >
                  <span className="flex items-center gap-2">
                    {theme === "dark" ? <FiSun /> : <FiMoon />}
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                  </span>
                </button>
              </div>
            </div>

            <Landing />
          </>
        ) : route === "/login" ? (
          <Login />
        ) : route === "/settings" ? (
          <Settings activeTab={settingsTab} onTabChange={setSettingsTab} />
        ) : (
          <>
            {route === "/documents" ? (
              <Documents
                activeTab={documentsTab}
                onTabChange={setDocumentsTab}
                theme={theme}
                setTheme={setTheme}
              />
            ) : (
              <Chat theme={theme} setTheme={setTheme} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
