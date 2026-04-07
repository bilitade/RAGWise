import type {
    AppRoute,
    DownloadableFileSpec,
    IngestionJob,
    ManagedDocument,
    Stage,
} from "./types";

// ── API ──────────────────────────────────────────────────────────────────────
export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export async function fetchJson<T>(
    input: RequestInfo,
    init?: RequestInit,
): Promise<T> {
    const response = await fetch(input, init);
    if (!response.ok) {
        throw new Error(await response.text());
    }
    return response.json() as Promise<T>;
}

// ── Routing ──────────────────────────────────────────────────────────────────
export function getCurrentRoute(): AppRoute {
    if (window.location.pathname === "/chat") return "/chat";
    if (window.location.pathname === "/documents") return "/documents";
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

export function buildDownloadableFileSpec(
    language: string | null,
    content: string,
    index: number,
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

    return {
        extension: mapped.extension,
        filename: `assistant-file-${index + 1}.${mapped.extension}`,
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
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function getAssistantMessageDownloadPayload(
    content: string,
): { spec: DownloadableFileSpec; content: string } | null {
    const trimmed = content.trim();
    if (!trimmed) return null;

    try {
        const normalizedJson = JSON.stringify(JSON.parse(trimmed), null, 2);
        return {
            spec: buildDownloadableFileSpec("json", normalizedJson, 0),
            content: normalizedJson,
        };
    } catch {
        // fall through
    }

    const fenceMatch = trimmed.match(
        /^```([a-zA-Z0-9_+-]+)?\n([\s\S]*?)\n```$/,
    );
    if (fenceMatch) {
        const language = fenceMatch[1]?.toLowerCase() ?? "txt";
        const fileContent = fenceMatch[2];
        const spec = buildDownloadableFileSpec(language, fileContent, 0);
        return {
            spec,
            content:
                spec.extension === "json"
                    ? normalizeJsonContent(fileContent)
                    : fileContent,
        };
    }

    const looksLikeMarkdown =
        /^#{1,6}\s/m.test(trimmed) ||
        /^[-*+]\s/m.test(trimmed) ||
        /^\d+\.\s/m.test(trimmed) ||
        /^\|.+\|$/m.test(trimmed) ||
        /^>\s/m.test(trimmed) ||
        trimmed.includes("\n");

    if (looksLikeMarkdown) {
        return {
            spec: buildDownloadableFileSpec("md", trimmed, 0),
            content: trimmed,
        };
    }

    if (trimmed.length >= 120) {
        return {
            spec: buildDownloadableFileSpec("txt", trimmed, 0),
            content: trimmed,
        };
    }

    return null;
}
