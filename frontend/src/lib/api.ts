const TOKEN_KEY = "rag_access_token";

export function getAccessToken(): string | null {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
    if (typeof localStorage === "undefined") return;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
}

export function buildAuthHeaders(base?: HeadersInit): Headers {
    const headers = new Headers(base);
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return headers;
}

export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function fetchJson<T>(
    input: RequestInfo,
    init?: RequestInit,
): Promise<T> {
    const headers = buildAuthHeaders(init?.headers);
    const response = await fetch(input, { ...init, headers });
    if (!response.ok) {
        throw new Error(await response.text());
    }
    return response.json() as Promise<T>;
}

export async function downloadDocumentFile(
    documentId: string,
    filename: string,
): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/download`, {
        headers: buildAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error(await response.text());
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
