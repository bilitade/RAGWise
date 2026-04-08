import { useEffect, useMemo, useState } from "react";
import {
  FiDownload,
  FiFileText,
  FiLayers,
  FiMessageSquare,
  FiMoon,
  FiRefreshCw,
  FiSearch,
  FiSettings,
  FiSun,
  FiTrash2,
  FiUploadCloud,
} from "react-icons/fi";

import type { DocumentsTab, IngestionJob, ManagedDocument, RetrievalMode, RetrievalResult, ThemeMode } from "../types";
import {
  API_BASE_URL,
  downloadDocumentFile,
  fetchJson,
  formatBytes,
  formatDate,
  getDocumentBadge,
  getJobSummary,
  getStatusClass,
  navigateTo,
} from "../utils";
import BrandWordmark from "../components/BrandWordmark";

const DOC_NAV: {
  id: DocumentsTab;
  title: string;
  hint: string;
  icon: React.ReactNode;
  group: string;
}[] = [
  {
    id: "files",
    title: "Files",
    hint: "Uploads, download, delete",
    icon: <FiFileText className="text-lg" />,
    group: "Sources",
  },
  {
    id: "ingestion",
    title: "Ingestion",
    hint: "Queue jobs & track progress",
    icon: <FiUploadCloud className="text-lg" />,
    group: "Sources",
  },
  {
    id: "search",
    title: "Search",
    hint: "Test retrieval before chat",
    icon: <FiSearch className="text-lg" />,
    group: "Retrieval",
  },
];

function navMeta(tab: DocumentsTab) {
  const item = DOC_NAV.find((n) => n.id === tab);
  return (
    item ?? {
      id: "files" as DocumentsTab,
      title: "Workspace",
      hint: "Manage your knowledge base",
      group: "Knowledge base",
      icon: <FiLayers className="text-lg" />,
    }
  );
}

function DocSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="brand-card rounded-[24px] p-6 sm:p-8">
      <div className="border-b border-[var(--border)] pb-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-secondary mt-1.5 max-w-3xl text-sm leading-relaxed">{description}</p>
      </div>
      <div className="pt-6">{children}</div>
    </section>
  );
}

export default function Documents({
  activeTab,
  onTabChange,
  theme,
  setTheme,
}: {
  activeTab: DocumentsTab;
  onTabChange: (tab: DocumentsTab) => void;
  theme: ThemeMode;
  setTheme: React.Dispatch<React.SetStateAction<ThemeMode>>;
}) {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [documents, setDocuments] = useState<ManagedDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingAndIngesting, setUploadingAndIngesting] = useState(false);
  const [bulkIngesting, setBulkIngesting] = useState(false);
  const [activeJob, setActiveJob] = useState<IngestionJob | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retrievalMode, setRetrievalMode] = useState<RetrievalMode>("similarity");
  const [retrievalQuery, setRetrievalQuery] = useState("");
  const [retrievalLoading, setRetrievalLoading] = useState(false);
  const [retrievalResults, setRetrievalResults] = useState<RetrievalResult[]>([]);

  const meta = useMemo(() => navMeta(activeTab), [activeTab]);

  useEffect(() => {
    void loadDocuments();
  }, []);

  useEffect(() => {
    if (!activeJob?.task_id) return;
    if (activeJob.successful || activeJob.failed) return;

    const interval = window.setInterval(async () => {
      try {
        const nextStatus = await fetchJson<IngestionJob>(
          `${API_BASE_URL}/api/documents/jobs/${activeJob.task_id}`,
        );
        setActiveJob(nextStatus);
        if (nextStatus.successful || nextStatus.failed) {
          if (nextStatus.successful) {
            setActionMessage("Ingestion job completed.");
            setActionError(null);
          }
          if (nextStatus.failed) {
            setActionError(nextStatus.error ?? "Ingestion job failed.");
            setActionMessage(null);
          }
          await loadDocuments();
        }
      } catch {
        window.clearInterval(interval);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [activeJob]);

  const activeStage = activeJob?.stage;
  const jobSummary = getJobSummary(activeJob);

  async function loadDocuments() {
    setDocumentsLoading(true);
    try {
      const result = await fetchJson<{ documents: ManagedDocument[] }>(`${API_BASE_URL}/api/documents`);
      setDocuments(result.documents);
    } finally {
      setDocumentsLoading(false);
    }
  }

  async function handleUpload() {
    if (!selectedFiles?.length) return;
    const formData = new FormData();
    Array.from(selectedFiles).forEach((file) => formData.append("files", file));
    setUploading(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await fetchJson(`${API_BASE_URL}/api/documents/upload`, {
        method: "POST",
        body: formData,
      });
      await loadDocuments();
      setSelectedFiles(null);
      setActionMessage("Files uploaded successfully.");
      onTabChange("files");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadAndIngest() {
    if (!selectedFiles?.length) return;
    const formData = new FormData();
    formData.append("file", selectedFiles[0]);
    setUploadingAndIngesting(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const job = await fetchJson<{ task_id: string; status: string }>(
        `${API_BASE_URL}/api/documents/upload-and-ingest`,
        {
          method: "POST",
          body: formData,
        },
      );
      setActiveJob({
        task_id: job.task_id,
        status: job.status,
        successful: false,
        failed: false,
        stage_history: [],
      });
      onTabChange("ingestion");
      setSelectedFiles(null);
      setActionMessage("Upload accepted. Ingestion job started.");
      await loadDocuments();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Upload and ingestion failed.");
    } finally {
      setUploadingAndIngesting(false);
    }
  }

  async function handleIngestAll() {
    setBulkIngesting(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const job = await fetchJson<{ task_id: string; status: string }>(
        `${API_BASE_URL}/api/documents/ingest-all`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      setActiveJob({
        task_id: job.task_id,
        status: job.status,
        successful: false,
        failed: false,
        stage_history: [],
      });
      onTabChange("ingestion");
      setActionMessage("Reingestion job started.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Reingestion failed to start.");
    } finally {
      setBulkIngesting(false);
    }
  }

  async function handleDelete(documentId: string) {
    setActionError(null);
    setActionMessage(null);
    try {
      await fetchJson(`${API_BASE_URL}/api/documents/${documentId}`, { method: "DELETE" });
      await loadDocuments();
      setActionMessage("Document deleted.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  async function handleDownload(document: ManagedDocument) {
    setActionError(null);
    try {
      await downloadDocumentFile(document.document_id, document.filename);
      setActionMessage(`Download started: ${document.filename}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Download failed.");
    }
  }

  async function handleReindex(documentId: string) {
    setActionError(null);
    setActionMessage(null);
    try {
      const job = await fetchJson<{ task_id: string; status: string }>(
        `${API_BASE_URL}/api/documents/${documentId}/reindex`,
        { method: "POST" },
      );
      setActiveJob({
        task_id: job.task_id,
        status: job.status,
        successful: false,
        failed: false,
        stage_history: [],
      });
      onTabChange("ingestion");
      setActionMessage("Reindex job started.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Reindex failed to start.");
    }
  }

  async function handleRetrieval() {
    if (!retrievalQuery.trim()) return;
    setRetrievalLoading(true);
    try {
      const endpoint = `/api/documents/search/${retrievalMode}`;
      const payload =
        retrievalMode === "advanced"
          ? { query: retrievalQuery, top_k: 5, vector_top_k: 10, bm25_top_k: 10 }
          : { query: retrievalQuery, top_k: 5 };
      const result = await fetchJson<{ results: RetrievalResult[] }>(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setRetrievalResults(result.results);
    } finally {
      setRetrievalLoading(false);
    }
  }

  const groupedNav = useMemo(() => {
    const groups: Record<string, typeof DOC_NAV> = {};
    for (const item of DOC_NAV) {
      if (!groups[item.group]) groups[item.group] = [];
      groups[item.group].push(item);
    }
    return groups;
  }, []);

  const filesSection = (
    <DocSection
      title="Library"
      description="Everything under your upload directory. Stale means the file changed since it was last embedded — reindex to refresh vectors and BM25."
    >
      <div className="grid gap-3">
        {documentsLoading ? (
          <div className="brand-elevated rounded-2xl px-4 py-8 text-center text-sm text-secondary">Loading documents…</div>
        ) : documents.length ? (
          documents.map((document) => (
            <div key={document.document_id} className="brand-elevated rounded-2xl p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-semibold">{document.filename}</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getDocumentBadge(document)}`}>
                      {document.status}
                    </span>
                  </div>
                  <p className="text-muted mt-2 break-all font-mono text-xs">{document.relative_path}</p>
                  <div className="text-secondary mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                    <span>{formatBytes(document.size_bytes)}</span>
                    <span>Modified {formatDate(document.modified_at)}</span>
                    <span>Indexed {formatDate(document.indexed_at)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleDownload(document)}
                    className="brand-secondary flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium"
                  >
                    <FiDownload />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReindex(document.document_id)}
                    className="brand-secondary flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium"
                  >
                    <FiRefreshCw />
                    Reindex
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(document.document_id)}
                    className="flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--error)_35%,transparent)] px-3 py-2 text-xs font-medium text-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_8%,transparent)]"
                  >
                    <FiTrash2 />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="brand-elevated rounded-2xl px-4 py-10 text-center text-sm text-secondary">
            No files yet. Use <strong className="text-[var(--text-primary)]">Ingestion</strong> to upload, or drop files in your server upload folder if configured.
          </div>
        )}
      </div>
    </DocSection>
  );

  const ingestionSection = (
    <div className="space-y-8">
      <DocSection
        title="Queue ingestion"
        description="Upload-only stores raw files. Upload + ingest parses, chunks, embeds, and writes to Qdrant. Reingest all rebuilds the collection from every file in the library (use after bulk changes)."
      >
        {actionMessage ? (
          <div className="mb-4 rounded-2xl border border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color-mix(in_srgb,var(--success)_8%,transparent)] px-4 py-3 text-sm status-success">
            {actionMessage}
          </div>
        ) : null}
        {actionError ? (
          <div className="mb-4 rounded-2xl border border-[color-mix(in_srgb,var(--error)_45%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-4 py-3 text-sm status-error">
            {actionError}
          </div>
        ) : null}

        <input
          type="file"
          multiple
          onChange={(event) => setSelectedFiles(event.target.files)}
          className="surface-input w-full rounded-2xl px-4 py-4 text-sm"
        />

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={uploading || !selectedFiles?.length}
            className="brand-secondary rounded-2xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload only"}
          </button>
          <button
            type="button"
            onClick={() => void handleUploadAndIngest()}
            disabled={uploadingAndIngesting || !selectedFiles?.length}
            className="brand-gradient rounded-2xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploadingAndIngesting ? "Queueing…" : "Upload & ingest"}
          </button>
          <button
            type="button"
            onClick={() => void handleIngestAll()}
            disabled={bulkIngesting}
            className="brand-primary rounded-2xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkIngesting ? "Queueing…" : "Reingest all files"}
          </button>
        </div>
      </DocSection>

      <DocSection
        title="Active job"
        description="Polls the Celery task until completion. For advanced chunk options (Pro/Admin), use the API with chunk_size and chunk_overlap query parameters."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="brand-elevated rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className={`text-sm font-semibold ${getStatusClass(activeStage)}`}>{jobSummary.title}</div>
                <div className="text-muted mt-1 text-[10px] uppercase tracking-[0.2em]">{jobSummary.status}</div>
              </div>
              <div className="text-secondary text-sm tabular-nums">{jobSummary.progress}%</div>
            </div>
            <div className="progress-track h-2 rounded-full">
              <div className="progress-fill h-2 rounded-full transition-all" style={{ width: `${jobSummary.progress}%` }} />
            </div>
            {activeJob?.task_id ? (
              <div className="text-muted mt-4 font-mono text-[11px]">Task {activeJob.task_id}</div>
            ) : (
              <p className="text-secondary mt-4 text-sm">No job yet — start an ingest above.</p>
            )}
            {activeJob?.failed && activeJob.error ? <div className="mt-3 text-sm status-error">{activeJob.error}</div> : null}
          </div>

          <div className="brand-elevated rounded-2xl p-5">
            <div className="text-muted text-[10px] font-semibold uppercase tracking-[0.2em]">Detail</div>
            <div className="mt-2 text-lg font-semibold">{jobSummary.title}</div>
            <p className="text-secondary mt-2 text-sm leading-relaxed">{jobSummary.detail}</p>
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-sm">
              <span className="text-secondary">{jobSummary.nextLabel}</span>
              <span className={getStatusClass(activeStage)}>{jobSummary.status}</span>
            </div>
          </div>
        </div>
      </DocSection>
    </div>
  );

  const searchModes: { id: RetrievalMode; label: string; desc: string }[] = [
    { id: "similarity", label: "Vector (similarity)", desc: "Dense embeddings — best for paraphrases and meaning." },
    { id: "bm25", label: "BM25 (lexical)", desc: "Keyword overlap — best for exact terms and SKUs. Requires Pro/Admin." },
    { id: "advanced", label: "Hybrid", desc: "Fuses vector + BM25. Requires Pro/Admin." },
  ];

  const searchSection = (
    <DocSection
      title="Retrieval playground"
      description="Same backends as production chat tools. Sign in with a Pro or Admin account to unlock BM25 and hybrid. Normal users: similarity only."
    >
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="flex min-w-[200px] flex-col gap-2 lg:w-56">
          <span className="text-muted text-[10px] font-semibold uppercase tracking-[0.2em]">Mode</span>
          {searchModes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setRetrievalMode(m.id)}
              className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                retrievalMode === m.id
                  ? "border-[color-mix(in_srgb,var(--primary)_40%,transparent)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] shadow-[inset_3px_0_0_0_var(--primary)]"
                  : "border-transparent hover:bg-[color-mix(in_srgb,var(--elevated)_80%,transparent)]"
              }`}
            >
              <span className="font-semibold">{m.label}</span>
              <span className="text-muted mt-1 block text-xs leading-snug">{m.desc}</span>
            </button>
          ))}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={retrievalQuery}
              onChange={(event) => setRetrievalQuery(event.target.value)}
              placeholder="Ask what a customer might ask…"
              className="surface-input min-w-0 flex-1 rounded-2xl px-4 py-3.5 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRetrieval();
              }}
            />
            <button
              type="button"
              onClick={() => void handleRetrieval()}
              disabled={retrievalLoading}
              className="brand-primary shrink-0 rounded-2xl px-6 py-3.5 text-sm font-semibold disabled:opacity-50"
            >
              {retrievalLoading ? "Searching…" : "Run search"}
            </button>
          </div>

          <div className="grid gap-3">
            {retrievalResults.length ? (
              retrievalResults.map((result) => (
                <div key={result.node_id} className="brand-elevated rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted font-medium uppercase tracking-wide">{String(result.metadata.filename ?? result.source)}</span>
                    <span className="status-data font-mono tabular-nums">{result.score.toFixed(4)}</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed">{result.text}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.matched_by.map((item) => (
                      <span key={`${result.node_id}-${item}`} className="brand-pill rounded-full px-3 py-1 text-[11px]">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="brand-elevated rounded-2xl px-4 py-10 text-center text-sm text-secondary">
                Results appear here. Ingest documents first, then try a query that should exist in your knowledge base.
              </div>
            )}
          </div>
        </div>
      </div>
    </DocSection>
  );

  return (
    <div className="documents-shell flex min-h-[calc(100vh-3rem)] flex-col gap-0 lg:flex-row lg:gap-0">
      <aside className="flex w-full shrink-0 flex-col border-b border-[var(--border)] lg:w-[280px] lg:border-b-0 lg:border-r">
        <div className="brand-card flex flex-col gap-4 rounded-none border-0 border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] p-5 lg:sticky lg:top-6 lg:mr-0 lg:rounded-[24px] lg:border lg:p-5">
          <div>
            <div className="flex items-center gap-2 text-[var(--data)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_90%,transparent)]">
                <FiLayers className="text-lg" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">Workspace</span>
            </div>
            <div className="mt-3 min-w-0">
              <BrandWordmark />
            </div>
            <p className="text-secondary mt-2 text-xs leading-relaxed">
              Manage source files, run ingestion against Qdrant, and debug retrieval before chatting.
            </p>
          </div>

          <nav className="flex flex-col gap-5" aria-label="Workspace sections">
            {Object.entries(groupedNav).map(([groupLabel, items]) => (
              <div key={groupLabel}>
                <p className="text-muted mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.22em]">{groupLabel}</p>
                <ul className="flex flex-col gap-1">
                  {items.map((item) => {
                    const active = activeTab === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onTabChange(item.id)}
                          className={`doc-nav-btn group flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors ${
                            active
                              ? "border border-[color-mix(in_srgb,var(--primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] shadow-[inset_3px_0_0_0_var(--primary)]"
                              : "border border-transparent hover:bg-[color-mix(in_srgb,var(--elevated)_85%,transparent)]"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] ${
                              active ? "text-[var(--primary)]" : "text-secondary group-hover:text-[var(--text-primary)]"
                            }`}
                          >
                            {item.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-sm font-semibold ${active ? "text-[var(--text-primary)]" : ""}`}>{item.title}</span>
                            <span className="text-muted mt-0.5 block text-[11px] leading-snug">{item.hint}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          <div className="border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={() => navigateTo("/chat")}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border)] px-4 py-3 text-sm font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--elevated)_80%,transparent)]"
            >
              <FiMessageSquare />
              Open chat
            </button>
            <button
              type="button"
              onClick={() => navigateTo("/settings")}
              className="text-secondary mt-2 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm hover:text-[var(--text-primary)]"
            >
              <FiSettings />
              Admin settings
            </button>
            <button
              type="button"
              onClick={() => setTheme((c) => (c === "dark" ? "light" : "dark"))}
              className="text-secondary mt-2 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm"
            >
              {theme === "dark" ? <FiSun /> : <FiMoon />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <div className="text-muted mt-4 rounded-xl border border-[var(--border)] px-3 py-2 font-mono text-[10px] break-all">
              <span className="text-secondary">API</span> {API_BASE_URL}
            </div>
          </div>
        </div>
      </aside>

      <div className="documents-main min-w-0 flex-1 px-0 pt-6 pb-10 lg:px-8 lg:pt-2 lg:pb-12">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <nav className="text-muted flex flex-wrap items-center gap-1.5 text-xs font-medium" aria-label="Breadcrumb">
              <span className="rounded-md bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)] px-2 py-0.5">Knowledge base</span>
              <span className="text-[var(--border)]">/</span>
              <span className="text-secondary">{meta.group}</span>
              <span className="text-[var(--border)]">/</span>
              <span className="text-[var(--text-primary)]">{meta.title}</span>
            </nav>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{meta.title}</h1>
            <p className="text-secondary mt-2 max-w-2xl text-sm leading-relaxed">{meta.hint}</p>
          </div>
        </header>

        {activeTab === "files" && (actionMessage || actionError) ? (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
              actionError
                ? "border-[color-mix(in_srgb,var(--error)_45%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
                : "border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color-mix(in_srgb,var(--success)_8%,transparent)]"
            }`}
          >
            {actionError ? <span className="status-error">{actionError}</span> : <span className="status-success">{actionMessage}</span>}
          </div>
        ) : null}

        <div className="space-y-8">
          {activeTab === "files" ? filesSection : null}
          {activeTab === "ingestion" ? ingestionSection : null}
          {activeTab === "search" ? searchSection : null}
        </div>
      </div>
    </div>
  );
}
