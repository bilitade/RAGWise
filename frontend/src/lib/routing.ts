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

/** Landing page: navigate to `/` or scroll to top if already there. */
export function goHome(): void {
    if (window.location.pathname === "/") {
        window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
        navigateTo("/");
    }
}
