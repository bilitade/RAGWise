import type { AppRoute } from "../types";

export function getCurrentRoute(): AppRoute {
    const p = window.location.pathname;
    if (p === "/chat") return "/chat";
    if (p === "/documents") return "/documents";
    if (p === "/settings") return "/settings";
    if (p === "/login") return "/login";
    return "/";
}

export function navigateTo(route: AppRoute): void {
    if (window.location.pathname === route) return;
    window.history.pushState({}, "", route);
    window.dispatchEvent(new PopStateEvent("popstate"));
}
