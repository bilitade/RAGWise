export type ThemeMode = "dark" | "light";
export type RetrievalMode = "similarity" | "bm25" | "advanced";
export type AppRoute = "/" | "/documents" | "/chat" | "/settings" | "/login";
export type SettingsTab =
    | "config"
    | "users"
    | "agents"
    | "jobs"
    | "usage"
    | "logs";
export type DocumentsTab = "files" | "ingestion" | "search";

export type Stage = {
    name: string;
    status: string;
    progress: number;
    message: string;
    details: Record<string, unknown>;
};

export type IngestionJob = {
    task_id: string;
    status: string;
    successful: boolean;
    failed: boolean;
    stage?: Stage | null;
    stage_history?: Stage[];
    result?: Record<string, unknown> | null;
    error?: string | null;
};

export type ManagedDocument = {
    document_id: string;
    filename: string;
    relative_path: string;
    absolute_path: string;
    size_bytes: number;
    modified_at: string;
    indexed: boolean;
    needs_reindex: boolean;
    status: string;
    indexed_at?: string | null;
};

export type RetrievalResult = {
    node_id: string;
    score: number;
    text: string;
    metadata: Record<string, unknown>;
    source: string;
    matched_by: string[];
};

export type ChatCitation = {
    kind: "knowledge_base" | "web";
    label: string;
    detail?: string;
    url?: string;
    ref?: string;
};

export type ChatMessage = {
    role: "user" | "assistant";
    content: string;
    /** Populated from stream or parsed from persisted assistant content. */
    citations?: ChatCitation[];
};

/** Sliding window for the agent (server applies last N user+assistant messages). */
export type ChatContextWindow = "min" | "medium" | "max";

export type ChatConversation = {
    id: string;
    title: string;
    messages: ChatMessage[];
    updatedAt: number;
    /** Set after the first successful message fetch for this thread (server-backed). */
    messagesHydrated?: boolean;
};

export type DownloadableFileSpec = {
    extension: string;
    filename: string;
    language: string;
    mimeType: string;
};
