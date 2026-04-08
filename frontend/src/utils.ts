import type {
    AppRoute,
    ChatCitation,
    DownloadableFileSpec,
    IngestionJob,
    ManagedDocument,
    Stage,
    ThemeMode,
} from "./types";

// ── API ──────────────────────────────────────────────────────────────────────
export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const TOKEN_KEY = "rag_access_token";

/** Workspace sidebar open/closed (1/0 in localStorage). */
export const DOCUMENTS_SIDEBAR_KEY = "documents-sidebar-open";
export const SETTINGS_SIDEBAR_KEY = "settings-sidebar-open";
export const CHAT_SIDEBAR_KEY = "chat-sidebar-open";

/** Persisted light/dark choice (localStorage). */
export const THEME_STORAGE_KEY = "rag-theme";

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

/** Whether `id` looks like a server-issued chat thread UUID. */
export function isServerChatThreadId(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

const RAG_CITATIONS_BEGIN = "<!--RAG_CITATIONS\n";
const RAG_CITATIONS_END = "\n-->";

/** Strip persisted citation JSON from assistant text and return structured sources. */
export function splitMessageCitations(content: string): { body: string; citations: ChatCitation[] } {
    const idx = content.lastIndexOf(RAG_CITATIONS_BEGIN);
    if (idx < 0) return { body: content, citations: [] };
    const head = content.slice(0, idx).trimEnd();
    const rest = content.slice(idx + RAG_CITATIONS_BEGIN.length);
    const end = rest.indexOf(RAG_CITATIONS_END);
    if (end < 0) return { body: content, citations: [] };
    try {
        const raw = rest.slice(0, end).trim();
        const data = JSON.parse(raw) as { items?: unknown };
        const items = Array.isArray(data.items) ? data.items : [];
        const citations: ChatCitation[] = items
            .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
            .map((x): ChatCitation => ({
                kind: x.kind === "web" ? "web" : "knowledge_base",
                label: String(x.label ?? ""),
                detail: x.detail != null ? String(x.detail) : undefined,
                url: x.url != null ? String(x.url) : undefined,
                ref: x.ref != null ? String(x.ref) : undefined,
            }))
            .filter((c) => c.label.length > 0);
        return { body: head, citations };
    } catch {
        return { body: content, citations: [] };
    }
}

export function mergeCitationLists(a: ChatCitation[], b: ChatCitation[]): ChatCitation[] {
    const seen = new Set<string>();
    const out: ChatCitation[] = [];
    for (const c of [...a, ...b]) {
        const k = `${c.kind}|${c.label}|${c.url ?? ""}|${c.ref ?? ""}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(c);
    }
    return out;
}

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

// ── Routing ──────────────────────────────────────────────────────────────────
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

// ── Formatters ───────────────────────────────────────────────────────────────
export function formatBytes(value: number): string {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatStageName(name: string): string {
    return name.replace(/_/g, " ");
}

export function formatDate(value: string | null | undefined): string {
    if (!value) return "Not indexed";
    return new Date(value).toLocaleString();
}

// ── Ingestion helpers ────────────────────────────────────────────────────────
export const INGESTION_STEPS = [
    { name: "queued", label: "Queued" },
    { name: "upload_received", label: "Upload received" },
    { name: "discovering_files", label: "Discovering files" },
    { name: "loading_documents", label: "Loading documents" },
    { name: "chunking_documents", label: "Chunking documents" },
    { name: "preparing_vector_store", label: "Preparing vector store" },
    { name: "embedding_and_indexing", label: "Embedding and indexing" },
    { name: "persisting_bm25_cache", label: "Persisting BM25 cache" },
    { name: "completed", label: "Completed" },
] as const;

export function getStepLabel(stepName: string | null | undefined): string {
    return (
        INGESTION_STEPS.find((step) => step.name === stepName)?.label ?? "Idle"
    );
}

export function getJobSummary(job: IngestionJob | null): {
    title: string;
    detail: string;
    status: string;
    progress: number;
    nextLabel: string;
} {
    if (!job) {
        return {
            title: "No active ingestion job",
            detail: "Queue an ingestion job to start processing documents.",
            status: "idle",
            progress: 0,
            nextLabel: "Waiting to start",
        };
    }

    if (job.failed) {
        return {
            title: "Ingestion failed",
            detail: job.error ?? job.stage?.message ?? "The ingestion job failed.",
            status: "failed",
            progress: 100,
            nextLabel: "Review the error and retry",
        };
    }

    if (job.successful) {
        return {
            title: "Ingestion completed",
            detail:
                job.stage?.message ??
                "The ingestion workflow completed successfully.",
            status: "completed",
            progress: 100,
            nextLabel: "Knowledge base is up to date",
        };
    }

    if (job.stage) {
        const stepIndex = INGESTION_STEPS.findIndex(
            (step) => step.name === job.stage?.name,
        );
        return {
            title: getStepLabel(job.stage.name),
            detail: job.stage.message,
            status: job.stage.status,
            progress: job.stage.progress,
            nextLabel:
                stepIndex >= 0 && stepIndex < INGESTION_STEPS.length - 1
                    ? `Next: ${INGESTION_STEPS[stepIndex + 1].label}`
                    : "Processing",
        };
    }

    return {
        title: "Ingestion queued",
        detail: "The job is waiting for a worker to start processing.",
        status: "pending",
        progress: 0,
        nextLabel: "Next: Queued",
    };
}

// ── Document / status helpers ────────────────────────────────────────────────
export function getStatusClass(stage?: Stage | null): string {
    if (!stage) return "text-muted";
    if (stage.status === "failed") return "status-error";
    if (stage.status === "completed") return "status-success";
    if (stage.status === "running") return "status-data";
    return "text-muted";
}

export function getDocumentBadge(document: ManagedDocument): string {
    if (document.needs_reindex) return "status-warning";
    if (document.indexed) return "status-success";
    return "status-data";
}

// ── File / download helpers ──────────────────────────────────────────────────
export const FILE_LANGUAGE_MAP: Record<
    string,
    { extension: string; mimeType: string; label: string }
> = {
    bash: { extension: "sh", mimeType: "text/x-shellscript", label: "Shell" },
    csv: { extension: "csv", mimeType: "text/csv", label: "CSV" },
    html: { extension: "html", mimeType: "text/html", label: "HTML" },
    javascript: {
        extension: "js",
        mimeType: "text/javascript",
        label: "JavaScript",
    },
    js: {
        extension: "js",
        mimeType: "text/javascript",
        label: "JavaScript",
    },
    json: {
        extension: "json",
        mimeType: "application/json",
        label: "JSON",
    },
    markdown: {
        extension: "md",
        mimeType: "text/markdown",
        label: "Markdown",
    },
    md: { extension: "md", mimeType: "text/markdown", label: "Markdown" },
    python: {
        extension: "py",
        mimeType: "text/x-python",
        label: "Python",
    },
    py: { extension: "py", mimeType: "text/x-python", label: "Python" },
    text: { extension: "txt", mimeType: "text/plain", label: "Text" },
    plaintext: {
        extension: "txt",
        mimeType: "text/plain",
        label: "Text",
    },
    ts: {
        extension: "ts",
        mimeType: "text/typescript",
        label: "TypeScript",
    },
    tsx: { extension: "tsx", mimeType: "text/tsx", label: "TSX" },
    txt: { extension: "txt", mimeType: "text/plain", label: "Text" },
    xml: {
        extension: "xml",
        mimeType: "application/xml",
        label: "XML",
    },
    yaml: { extension: "yml", mimeType: "text/yaml", label: "YAML" },
    yml: { extension: "yml", mimeType: "text/yaml", label: "YAML" },
};

export function normalizeFenceLanguage(
    className?: string,
): string | null {
    const match = className?.match(/language-([a-z0-9_+-]+)/i);
    return match?.[1]?.toLowerCase() ?? null;
}

export function isMarkdownLanguage(language: string | null): boolean {
    return language === "md" || language === "markdown";
}

export function normalizeJsonContent(content: string): string {
    try {
        return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
        return content;
    }
}

export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-") // Replace spaces with -
        .replace(/[^\w-]+/g, "") // Remove all non-word chars
        .replace(/--+/g, "-") // Replace multiple - with single -
        .replace(/^-+/, "") // Trim - from start of text
        .replace(/-+$/, ""); // Trim - from end of text
}

export function buildDownloadableFileSpec(
    language: string | null,
    content: string,
    index: number,
    baseName?: string,
): DownloadableFileSpec {
    const normalizedLanguage =
        language?.toLowerCase() ??
        (content.trim().startsWith("{") || content.trim().startsWith("[")
            ? "json"
            : "text");
    const mapped = FILE_LANGUAGE_MAP[normalizedLanguage] ?? {
        extension: normalizedLanguage || "txt",
        mimeType: "text/plain",
        label: normalizedLanguage
            ? normalizedLanguage.toUpperCase()
            : "Text",
    };

    // Attempt to extract a more specific title from the content
    let subTitle = "";
    if (isMarkdownLanguage(normalizedLanguage)) {
        const headerMatch = content.match(/^#+\s+(.+)$/m);
        if (headerMatch) subTitle = headerMatch[1];
    } else if (normalizedLanguage === "json") {
        try {
            const parsed = JSON.parse(content);
            subTitle = parsed.title || parsed.name || "";
            if (!subTitle && typeof parsed === "object" && parsed !== null) {
                // If no title/name, use the first key that isn't too long
                const firstKey = Object.keys(parsed)[0];
                if (firstKey && firstKey.length < 32) subTitle = firstKey;
            }
        } catch {
            // Un-parseable JSON, fallback to topic
        }
    }

    const finalBaseName = slugify(subTitle || baseName || "assistant-file");
    const uniqueName = finalBaseName; // Removed numeric suffix as requested

    return {
        extension: mapped.extension,
        filename: `${uniqueName}.${mapped.extension}`,
        language: mapped.label,
        mimeType: mapped.mimeType,
    };
}

export function downloadTextFile(
    spec: DownloadableFileSpec,
    content: string,
): void {
    const blob = new Blob([content], {
        type: `${spec.mimeType};charset=utf-8`,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = spec.filename;
    
    document.body.appendChild(link);
    link.click();
    
    // Delay revocation to ensure the browser has started the download
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}

export function getAssistantMessageDownloadPayload(
    content: string,
): { spec: DownloadableFileSpec; content: string } | null {
    const trimmed = content.trim();
    if (!trimmed) return null;

    // Look for the explicit marker [DOWNLOAD_FILE: filename.ext]
    const markerMatch = trimmed.match(/\[DOWNLOAD_FILE:\s*([^\]]+)\]/i);
    if (!markerMatch) return null;

    const filename = markerMatch[1].trim();
    const extension = filename.split(".").pop()?.toLowerCase() ?? "txt";
    const cleanContent = trimmed.replace(markerMatch[0], "").trim();

    // Use the explicit filename and extension provided in the marker
    const spec: DownloadableFileSpec = {
        extension,
        filename,
        language: FILE_LANGUAGE_MAP[extension]?.label ?? extension.toUpperCase(),
        mimeType: FILE_LANGUAGE_MAP[extension]?.mimeType ?? "text/plain",
    };

    return {
        spec,
        content: cleanContent,
    };
}
