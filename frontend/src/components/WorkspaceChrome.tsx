import { useState, useRef, useEffect } from "react";
import { FiLayers, FiLogOut, FiMessageSquare, FiMoon, FiSettings, FiSun, FiUser } from "react-icons/fi";
import { LuPanelLeft } from "react-icons/lu";

import { canAccessDocuments, canAccessSettings, useAuth } from "../auth";
import type { ThemeMode } from "../types";
import { goHome, navigateTo } from "../utils";
import BrandWordmark from "./BrandWordmark";

export const WORKSPACE_SIDEBAR_WIDTH = 280;

export type WorkspaceAppPage = "documents" | "chat" | "settings";

const toolbarIconBtn =
  "flex h-10 w-10 touch-manipulation items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)] text-secondary transition-all active:scale-[0.96]";

function roleBadgeLabel(role: string): string {
  if (role === "admin") return "Admin";
  if (role === "pro") return "Pro";
  return "Normal";
}

export function WorkspaceAppBar({
  theme,
  setTheme,
  activePage,
}: {
  theme: ThemeMode;
  setTheme: React.Dispatch<React.SetStateAction<ThemeMode>>;
  activePage: WorkspaceAppPage;
}) {
  const { user, clearSession } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const showDocuments = canAccessDocuments(user?.role);
  const showSettings = canAccessSettings(user?.role);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [profileMenuOpen]);

  function logout() {
    clearSession();
    navigateTo("/login");
  }

  const activeRing = "ring-2 ring-[color-mix(in_srgb,var(--primary)_45%,transparent)] ring-offset-2 ring-offset-[var(--background)]";

  return (
    <header className="flex shrink-0 flex-col border-b border-[var(--border)] pb-4">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <BrandWordmark onClick={goHome} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5" role="toolbar" aria-label="Workspace">
          {showDocuments && (
            <button
              type="button"
              onClick={() => navigateTo("/documents")}
              title="Documents"
              aria-label="Documents"
              aria-current={activePage === "documents" ? "page" : undefined}
              className={`${toolbarIconBtn} hover:border-[color-mix(in_srgb,var(--data)_40%,transparent)] hover:text-[var(--data)] ${activePage === "documents" ? activeRing : "hover:border-[var(--border)]"}`}
            >
              <FiLayers className="size-5" strokeWidth={2.25} />
            </button>
          )}
          <button
            type="button"
            onClick={() => navigateTo("/chat")}
            title="Chat"
            aria-label="Chat"
            aria-current={activePage === "chat" ? "page" : undefined}
            className={`${toolbarIconBtn} hover:border-[color-mix(in_srgb,var(--primary)_40%,transparent)] hover:text-[var(--primary)] ${activePage === "chat" ? activeRing : "hover:border-[var(--border)]"}`}
          >
            <FiMessageSquare className="size-5" strokeWidth={2.25} />
          </button>
          {showSettings && (
            <button
              type="button"
              onClick={() => navigateTo("/settings")}
              title="Settings"
              aria-label="Settings"
              aria-current={activePage === "settings" ? "page" : undefined}
              className={`${toolbarIconBtn} hover:border-[color-mix(in_srgb,var(--primary)_40%,transparent)] hover:text-[var(--primary)] ${activePage === "settings" ? activeRing : "hover:border-[var(--border)]"}`}
            >
              <FiSettings className="size-5" strokeWidth={2.25} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setTheme((c) => (c === "dark" ? "light" : "dark"))}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
            className={`${toolbarIconBtn} hover:border-[color-mix(in_srgb,var(--warning)_35%,transparent)] hover:text-[var(--warning)]`}
          >
            {theme === "dark" ? <FiSun className="size-5" strokeWidth={2.25} /> : <FiMoon className="size-5" strokeWidth={2.25} />}
          </button>

          {/* Profile Button & Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className={`${toolbarIconBtn} hover:border-[color-mix(in_srgb,var(--primary)_40%,transparent)] hover:text-[var(--primary)] ${profileMenuOpen ? "border-[color-mix(in_srgb,var(--primary)_40%,transparent)] text-[var(--primary)]" : ""}`}
              aria-expanded={profileMenuOpen}
              aria-haspopup="true"
              aria-label="User profile"
            >
              <FiUser className="size-5" strokeWidth={2.25} />
            </button>

            {profileMenuOpen && user && (
              <div className="absolute right-0 top-full z-[100] mt-2 w-64 origin-top-right overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_95%,transparent)] p-1.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3.5 py-3">
                  <p className="truncate text-sm font-semibold text-[var(--text-primary)]" title={user.email}>
                    {user.email}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="rounded-md bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
                      {roleBadgeLabel(user.role)}
                    </span>
                    {user.role === "pro" && (
                      <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--warning)]">
                        Premium Member
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="my-1 h-px bg-[var(--border)] opacity-50" />
                
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[var(--error)] transition-colors hover:bg-[color-mix(in_srgb,var(--error)_8%,transparent)] active:scale-[0.98]"
                >
                  <FiLogOut className="size-4" strokeWidth={2.25} />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export function SidebarToggleButton({
  open,
  onToggle,
  sidebarId,
  labelOpen,
  labelClosed,
}: {
  open: boolean;
  onToggle: () => void;
  sidebarId: string;
  labelOpen: string;
  labelClosed: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={open ? labelOpen : labelClosed}
      aria-label={open ? labelOpen : labelClosed}
      aria-expanded={open}
      aria-controls={sidebarId}
      className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)] text-secondary transition-all hover:border-[color-mix(in_srgb,var(--primary)_35%,transparent)] hover:text-[var(--primary)] active:scale-[0.96]"
    >
      <LuPanelLeft
        className={`size-5 transition-transform duration-300 ease-out ${open ? "" : "scale-x-[-1]"}`}
        strokeWidth={2.25}
        aria-hidden
      />
    </button>
  );
}

type WorkspaceSidebarRailProps = {
  sidebarId: string;
  open: boolean;
  onOverlayDismiss: () => void;
  children: React.ReactNode;
};

export function WorkspaceSidebarRail({ sidebarId, open, onOverlayDismiss, children }: WorkspaceSidebarRailProps) {
  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-[color-mix(in_srgb,var(--text-primary)_18%,transparent)] backdrop-blur-[2px] lg:hidden"
          onClick={onOverlayDismiss}
        />
      ) : null}

      <aside
        id={sidebarId}
        aria-hidden={!open}
        className={`z-40 min-w-0 shrink-0 overflow-hidden transition-[width,max-width,opacity] duration-300 ease-out motion-reduce:transition-none max-lg:shadow-none ${
          open
            ? "fixed inset-y-0 left-0 flex h-[100dvh] min-h-[100dvh] max-h-[100dvh] w-[min(100vw-1rem,280px)] max-w-[280px] flex-col border-b-0 border-[var(--border)] opacity-100 max-lg:rounded-r-2xl max-lg:border-r lg:relative lg:inset-auto lg:top-auto lg:bottom-auto lg:z-auto lg:h-full lg:max-h-full lg:min-h-0 lg:w-[280px] lg:max-w-[280px] lg:self-stretch lg:border-0 lg:shadow-none"
            : "pointer-events-none hidden opacity-0 lg:flex lg:h-full lg:max-h-full lg:min-h-0 lg:w-0 lg:max-w-0 lg:self-stretch lg:border-0"
        }`}
      >
        <div className="flex h-full min-h-0 w-full min-w-[min(280px,100vw-1rem)] max-w-[280px] flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] p-4 lg:max-h-full lg:overflow-hidden">
          {children}
        </div>
      </aside>
    </>
  );
}

export function WorkspaceMainColumn({
  children,
  className,
  noOuterScroll,
}: {
  children: React.ReactNode;
  className?: string;
  noOuterScroll?: boolean;
}) {
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 flex-col px-4 pb-6 pt-4 lg:min-h-0 ${
        noOuterScroll ? "overflow-hidden" : "overflow-y-auto"
      } ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
