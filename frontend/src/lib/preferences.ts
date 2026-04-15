import type { ThemeMode } from "../types";
import { THEME_STORAGE_KEY } from "./storageKeys";

export function readThemePreference(): ThemeMode {
    try {
        const v = localStorage.getItem(THEME_STORAGE_KEY);
        if (v === "light" || v === "dark") return v;
    } catch {
        /* ignore */
    }
    return "dark";
}

export function writeThemePreference(theme: ThemeMode): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
        /* ignore */
    }
}

export function readSidebarPreference(key: string, defaultOpen = true): boolean {
    try {
        const v = localStorage.getItem(key);
        if (v === "0") return false;
        if (v === "1") return true;
    } catch {
        /* ignore */
    }
    return defaultOpen;
}

export function writeSidebarPreference(key: string, open: boolean): void {
    try {
        localStorage.setItem(key, open ? "1" : "0");
    } catch {
        /* ignore */
    }
}
