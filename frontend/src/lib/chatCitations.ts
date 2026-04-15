import type { ChatCitation } from "../types";

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
