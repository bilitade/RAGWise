import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { AppRoute, MeUser, UserRole } from "./types";
import { API_BASE_URL, buildAuthHeaders, getAccessToken, setAccessToken } from "./utils";

type AuthContextValue = {
    user: MeUser | null;
    authLoading: boolean;
    refreshUser: () => Promise<MeUser | null>;
    clearSession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function canAccessDocuments(role: UserRole | undefined): boolean {
    return role === "pro" || role === "admin";
}

export function canAccessSettings(role: UserRole | undefined): boolean {
    return role === "admin";
}

export function defaultRouteForRole(role: UserRole): AppRoute {
    if (role === "normal") return "/chat";
    if (role === "pro") return "/documents";
    return "/settings";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<MeUser | null>(null);
    const [authLoading, setAuthLoading] = useState(() => !!getAccessToken());

    const clearSession = useCallback(() => {
        setAccessToken(null);
        setUser(null);
        setAuthLoading(false);
    }, []);

    const refreshUser = useCallback(async (): Promise<MeUser | null> => {
        const token = getAccessToken();
        if (!token) {
            setUser(null);
            setAuthLoading(false);
            return null;
        }
        setAuthLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/me`, { headers: buildAuthHeaders() });
            if (!res.ok) {
                clearSession();
                return null;
            }
            const data = (await res.json()) as MeUser;
            if (!data.email || !data.role) {
                clearSession();
                return null;
            }
            setUser(data);
            return data;
        } catch {
            clearSession();
            return null;
        } finally {
            setAuthLoading(false);
        }
    }, [clearSession]);

    useEffect(() => {
        void refreshUser();
    }, [refreshUser]);

    const value = useMemo(
        () => ({ user, authLoading, refreshUser, clearSession }),
        [user, authLoading, refreshUser, clearSession],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return ctx;
}
