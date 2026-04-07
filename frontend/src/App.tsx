import { useEffect, useState } from "react";
import {
  FiFileText,
  FiMessageSquare,
  FiMoon,
  FiSearch,
  FiSun,
  FiUploadCloud,
} from "react-icons/fi";

import type { AppRoute, DocumentsTab, ThemeMode } from "./types";
import { API_BASE_URL, getCurrentRoute, navigateTo } from "./utils";
import BrandWordmark from "./components/BrandWordmark";
import Landing from "./pages/Landing";
import Documents from "./pages/Documents";
import Chat from "./pages/Chat";

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [route, setRoute] = useState<AppRoute>(getCurrentRoute());
  const [documentsTab, setDocumentsTab] = useState<DocumentsTab>("files");

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
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {route === "/" ? (
          <>
            <div className="flex items-center justify-between gap-4 px-1">
              <BrandWordmark />
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

            <Landing />
          </>
        ) : (
          <>
            {route === "/documents" ? (
            <header className="brand-card rounded-[28px] px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="brand-elevated rounded-2xl p-3">
                    {route === "/documents" ? (
                      <FiFileText className="text-lg status-data" />
                    ) : (
                      <FiMessageSquare className="text-lg" style={{ color: "var(--accent)" }} />
                    )}
                  </div>
                  <div>
                    <BrandWordmark />
                    <div className="text-sm text-secondary">{route === "/documents" ? "Workspace" : "Agent chat"}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        navigateTo("/documents");
                        setDocumentsTab("files");
                      }}
                      className={`rounded-2xl px-4 py-2.5 text-sm font-medium ${
                        route === "/documents" && documentsTab === "files" ? "brand-pill-active" : "brand-pill"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <FiFileText />
                        Files
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        navigateTo("/documents");
                        setDocumentsTab("ingestion");
                      }}
                      className={`rounded-2xl px-4 py-2.5 text-sm font-medium ${
                        route === "/documents" && documentsTab === "ingestion" ? "brand-pill-active" : "brand-pill"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <FiUploadCloud />
                        Ingestion
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        navigateTo("/documents");
                        setDocumentsTab("search");
                      }}
                      className={`rounded-2xl px-4 py-2.5 text-sm font-medium ${
                        route === "/documents" && documentsTab === "search" ? "brand-pill-active" : "brand-pill"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <FiSearch />
                        Search
                      </span>
                    </button>
                    <button
                    onClick={() => navigateTo("/chat")}
                    className="brand-pill rounded-2xl px-4 py-2.5 text-sm font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <FiMessageSquare />
                      Chat
                    </span>
                  </button>
                </div>

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

                <div className="rounded-2xl border px-4 py-3 text-sm text-secondary">
                  <span className="status-data font-medium">API</span>
                  <span className="ml-2 text-muted">{API_BASE_URL}</span>
                </div>
                </div>
              </div>
            </header>
            ) : null}

            {route === "/documents" ? (
              <Documents activeTab={documentsTab} onTabChange={setDocumentsTab} />
            ) : (
              <Chat theme={theme} setTheme={setTheme} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
