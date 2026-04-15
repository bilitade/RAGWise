import type { DownloadableFileSpec } from "../types";

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
        .replace(/\s+/g, "-")
        .replace(/[^\w-]+/g, "")
        .replace(/--+/g, "-")
        .replace(/^-+/, "")
        .replace(/-+$/, "");
}

export function buildDownloadableFileSpec(
    language: string | null,
    content: string,
    _index: number,
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

    let subTitle = "";
    if (isMarkdownLanguage(normalizedLanguage)) {
        const headerMatch = content.match(/^#+\s+(.+)$/m);
        if (headerMatch) subTitle = headerMatch[1];
    } else if (normalizedLanguage === "json") {
        try {
            const parsed = JSON.parse(content) as Record<string, unknown>;
            subTitle = String(parsed.title ?? parsed.name ?? "");
            if (!subTitle && typeof parsed === "object" && parsed !== null) {
                const firstKey = Object.keys(parsed)[0];
                if (firstKey && firstKey.length < 32) subTitle = firstKey;
            }
        } catch {
            /* ignore */
        }
    }

    const finalBaseName = slugify(subTitle || baseName || "assistant-file");
    const uniqueName = finalBaseName;

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

    const markerMatch = trimmed.match(/\[DOWNLOAD_FILE:\s*([^\]]+)\]/i);
    if (!markerMatch) return null;

    const filename = markerMatch[1].trim();
    const extension = filename.split(".").pop()?.toLowerCase() ?? "txt";
    const cleanContent = trimmed.replace(markerMatch[0], "").trim();

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
