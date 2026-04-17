import { useEffect, useMemo, useState } from "react";
import {
  FiAlignLeft,
  FiDownload,
  FiFileText,
  FiGitMerge,
  FiLayers,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUploadCloud,
  FiZap,
} from "react-icons/fi";

import type { DocumentsTab, IngestionJob, ManagedDocument, RetrievalMode, RetrievalResult } from "../types";

import {
  API_BASE_URL,
  DOCUMENTS_SIDEBAR_KEY,
  downloadDocumentFile,
  fetchJson,
  formatBytes,
  formatDate,
  getDocumentBadge,
  getJobSummary,
  getStatusClass,
  readSidebarPreference,
  writeSidebarPreference,
} from "../utils";
import { SidebarToggleButton, WorkspaceMainColumn, WorkspaceSidebarRail } from "../components/WorkspaceChrome";

const DOC_NAV: {
  id: DocumentsTab;
  title: string;
  icon: React.ReactNode;
  group: string;
}[] = [
  {
    id: "files",
    title: "Files",
    icon: <FiFileText className="size-[1.1rem]" strokeWidth={2.25} />,
    group: "Sources",
  },
  {
    id: "ingestion",
    title: "Ingestion",
    icon: <FiUploadCloud className="size-[1.1rem]" strokeWidth={2.25} />,
    group: "Sources",
  },
  {
    id: "search",
    title: "Search",
    icon: <FiSearch className="size-[1.1rem]" strokeWidth={2.25} />,
    group: "Retrieval",
  },
];

function navMeta(tab: DocumentsTab) {
  const item = DOC_NAV.find((n) => n.id === tab);
  return (
    item ?? {
      id: "files" as DocumentsTab,
      title: "Workspace",
      group: "Knowledge base",
      icon: <FiLayers className="size-[1.1rem]" strokeWidth={2.25} />,
    }
  );
}

function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="brand-card rounded-2xl p-3 sm:p-4">
      <div className="border-b border-[var(--border)] pb-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="pt-3">{children}</div>
    </section>
  );
}

export default function Documents({
  activeTab,
  onTabChange,
}: {
  activeTab: DocumentsTab;
  onTabChange: (tab: DocumentsTab) => void;
}) {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [documents, setDocuments] = useState<ManagedDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingAndIngesting, setUploadingAndIngesting] = useState(false);
  const [bulkIngesting, setBulkIngesting] = useState(false);
  const [syncStaleIngesting, setSyncStaleIngesting] = useState(false);
  const [activeJob, setActiveJob] = useState<IngestionJob | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retrievalMode, setRetrievalMode] = useState<RetrievalMode>("similarity");
  const [retrievalQuery, setRetrievalQuery] = useState("");
  const [retrievalLoading, setRetrievalLoading] = useState(false);
  const [retrievalResults, setRetrievalResults] = useState<RetrievalResult[]>([]);
  const [docSidebarOpen, setDocSidebarOpen] = useState(() => readSidebarPreference(DOCUMENTS_SIDEBAR_KEY));

  const meta = useMemo(() => navMeta(activeTab), [activeTab]);

  useEffect(() => {
    writeSidebarPreference(DOCUMENTS_SIDEBAR_KEY, docSidebarOpen);
  }, [docSidebarOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setDocSidebarOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  async function handleSyncStale() {
    setSyncStaleIngesting(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const job = await fetchJson<{ task_id: string; status: string }>(
        `${API_BASE_URL}/api/documents/sync-stale`,
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
      setActionMessage("Sync-stale job started (changed files only).");
      await loadDocuments();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Sync stale failed to start.");
    } finally {
      setSyncStaleIngesting(false);
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
          ? { query: retrievalQuery, top_k: 5, vector_top_k: 10, sparse_top_k: 10 }
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

  // ── Files ────────────────────────────────────────────────────────────────
  const filesSection = (
    <DocSection title="Library">
      <div className="grid gap-2">
        {documentsLoading ? (
          <div className="brand-elevated rounded-xl px-4 py-6 text-center text-sm text-secondary">
            Loading…
          </div>
        ) : documents.length ? (
          documents.map((document) => (
            <div key={document.document_id} className="brand-elevated rounded-xl p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{document.filename}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getDocumentBadge(document)}`}>
                      {document.status}
                    </span>
                  </div>
                  <div className="text-muted mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                    <span>{formatBytes(document.size_bytes)}</span>
                    <span>Modified {formatDate(document.modified_at)}</span>
                    <span>Indexed {formatDate(document.indexed_at)}</span>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleDownload(document)}
                    className="brand-secondary flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  >
                    <FiDownload className="size-3.5" />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReindex(document.document_id)}
                    className="brand-secondary flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium"
                  >
                    <FiRefreshCw className="size-3.5" />
                    Reindex
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(document.document_id)}
                    className="flex items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--error)_35%,transparent)] px-2.5 py-1.5 text-xs font-medium text-[var(--error)] hover:bg-[color-mix(in_srgb,var(--error)_8%,transparent)]"
                  >
                    <FiTrash2 className="size-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="brand-elevated rounded-xl px-4 py-8 text-center text-sm text-secondary">
            No files yet.
          </div>
        )}
      </div>
    </DocSection>
  );

  // ── Ingestion ────────────────────────────────────────────────────────────
  const ingestionSection = (
    <div className="space-y-4">
      <DocSection title="Ingestion">
        {actionMessage ? (
          <div className="mb-3 rounded-xl border border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color-mix(in_srgb,var(--success)_8%,transparent)] px-3 py-2 text-sm status-success">
            {actionMessage}
          </div>
        ) : null}
        {actionError ? (
          <div className="mb-3 rounded-xl border border-[color-mix(in_srgb,var(--error)_45%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-3 py-2 text-sm status-error">
            {actionError}
          </div>
        ) : null}

        {/* Drop zone */}
        <label className="group relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_40%,transparent)] px-6 py-8 text-center transition-colors hover:border-[color-mix(in_srgb,var(--primary)_50%,transparent)] hover:bg-[color-mix(in_srgb,var(--primary)_4%,transparent)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)] transition-transform group-hover:scale-105">
            <FiUploadCloud className="size-6" strokeWidth={2} />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {selectedFiles?.length
                ? `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} selected`
                : "Drop files here or click to browse"}
            </p>
            <p className="text-muted mt-0.5 text-xs">PDF, DOCX, TXT, MD and more</p>
          </div>
          <input
            type="file"
            multiple
            onChange={(event) => setSelectedFiles(event.target.files)}
            className="sr-only"
          />
        </label>

        {/* Primary actions (require file selection) */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleUploadAndIngest()}
            disabled={uploadingAndIngesting || !selectedFiles?.length}
            className="brand-primary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiUploadCloud className="size-3.5" />
            {uploadingAndIngesting ? "Queueing…" : "Upload & index"}
          </button>
          <button
            type="button"
            onClick={() => void handleUpload()}
            disabled={uploading || !selectedFiles?.length}
            className="brand-secondary flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload only"}
          </button>
        </div>

        {/* Bulk actions (no file needed) */}
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
          <span className="text-muted text-xs">Bulk:</span>
          <button
            type="button"
            onClick={() => void handleIngestAll()}
            disabled={bulkIngesting || syncStaleIngesting}
            className="brand-secondary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiRefreshCw className="size-3" />
            {bulkIngesting ? "Queueing…" : "Re-index all"}
          </button>
          <button
            type="button"
            onClick={() => void handleSyncStale()}
            disabled={bulkIngesting || syncStaleIngesting}
            className="brand-secondary flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
            title="Reindex only files changed since the last successful index."
          >
            <FiRefreshCw className="size-3" />
            {syncStaleIngesting ? "Queueing…" : "Sync changed"}
          </button>
        </div>
      </DocSection>

      {/* Job status — only shown when a job exists */}
      {activeJob?.task_id ? (
        <DocSection title="Job status">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="brand-elevated rounded-xl p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className={`text-sm font-semibold ${getStatusClass(activeStage)}`}>{jobSummary.title}</div>
                  <div className="text-muted mt-0.5 text-[10px] uppercase tracking-[0.2em]">{jobSummary.status}</div>
                </div>
                <div className="text-secondary text-sm tabular-nums">{jobSummary.progress}%</div>
              </div>
              <div className="progress-track h-1.5 rounded-full">
                <div className="progress-fill h-1.5 rounded-full transition-all" style={{ width: `${jobSummary.progress}%` }} />
              </div>
              <div className="text-muted mt-3 font-mono text-[11px]">Task {activeJob.task_id}</div>
              {activeJob.failed && activeJob.error ? (
                <div className="mt-2 text-sm status-error">{activeJob.error}</div>
              ) : null}
            </div>
            <div className="brand-elevated rounded-xl p-3">
              <div className="text-muted text-[10px] font-semibold uppercase tracking-[0.2em]">Detail</div>
              <div className="mt-1.5 text-base font-semibold">{jobSummary.title}</div>
              <p className="text-secondary mt-1.5 text-sm leading-relaxed">{jobSummary.detail}</p>
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3 text-sm">
                <span className="text-secondary">{jobSummary.nextLabel}</span>
                <span className={getStatusClass(activeStage)}>{jobSummary.status}</span>
              </div>
            </div>
          </div>
        </DocSection>
      ) : null}
    </div>
  );

  // ── Search ───────────────────────────────────────────────────────────────
  const searchModes: { id: RetrievalMode; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      id: "similarity",
      label: "Similarity",
      desc: "Semantic vector search — finds passages by meaning.",
      icon: <FiZap className="size-4" strokeWidth={2.25} />,
    },
    {
      id: "splade",
      label: "SPLADE",
      desc: "Keyword ranking — precise term matching.",
      icon: <FiAlignLeft className="size-4" strokeWidth={2.25} />,
    },
    {
      id: "advanced",
      label: "Hybrid",
      desc: "Combines vector and keyword for best coverage.",
      icon: <FiGitMerge className="size-4" strokeWidth={2.25} />,
    },
  ];

  const searchSection = (
    <DocSection title="Search">
      {/* Mode cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {searchModes.map((m) => {
          const active = retrievalMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setRetrievalMode(m.id)}
              className={`group flex flex-col gap-2 rounded-xl border p-3 text-left transition-all ${
                active
                  ? "border-[color-mix(in_srgb,var(--primary)_45%,transparent)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] shadow-sm"
                  : "border-[var(--border)] hover:border-[color-mix(in_srgb,var(--primary)_25%,transparent)] hover:bg-[color-mix(in_srgb,var(--elevated)_60%,transparent)]"
              }`}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  active
                    ? "bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-[var(--primary)]"
                    : "bg-[color-mix(in_srgb,var(--elevated)_80%,transparent)] text-secondary group-hover:text-[var(--text-primary)]"
                }`}
              >
                {m.icon}
              </span>
              <div>
                <p className={`text-xs font-semibold ${active ? "text-[var(--primary)]" : "text-[var(--text-primary)]"}`}>
                  {m.label}
                </p>
                <p className="text-muted mt-0.5 hidden text-[11px] leading-snug sm:block">{m.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Query bar */}
      <div className="mt-3 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <FiSearch className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-secondary" strokeWidth={2.25} />
          <input
            value={retrievalQuery}
            onChange={(event) => setRetrievalQuery(event.target.value)}
            placeholder="Enter a query…"
            className="surface-input w-full rounded-xl py-2 pl-9 pr-3 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRetrieval();
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => void handleRetrieval()}
          disabled={retrievalLoading}
          className="brand-primary shrink-0 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {retrievalLoading ? "Searching…" : "Search"}
        </button>
      </div>

      {/* Results */}
      <div className="mt-3 grid gap-2">
        {retrievalResults.length ? (
          retrievalResults.map((result) => (
            <div key={result.node_id} className="brand-elevated rounded-xl p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FiFileText className="size-3.5 shrink-0 text-[var(--primary)]" strokeWidth={2.25} />
                  <span className="truncate text-xs font-medium text-[var(--text-primary)]">
                    {String(result.metadata.filename ?? result.source)}
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <span className="status-data font-mono text-xs tabular-nums">{result.score.toFixed(4)}</span>
                  {result.score_kind ? (
                    <span className="text-muted ml-1.5 text-[10px] font-normal">{result.score_kind}</span>
                  ) : null}
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-secondary">{result.text}</p>
              {result.matched_by.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.matched_by.map((item) => (
                    <span key={`${result.node_id}-${item}`} className="brand-pill rounded-full px-2.5 py-0.5 text-[11px]">
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="brand-elevated rounded-xl px-4 py-8 text-center text-sm text-secondary">
            No results yet.
          </div>
        )}
      </div>
    </DocSection>
  );

  return (
    <div className="documents-shell relative flex h-full min-h-0 w-full flex-1 flex-col gap-4 overflow-x-hidden lg:flex-row lg:items-stretch lg:gap-6 lg:overflow-hidden">
      <WorkspaceSidebarRail
        sidebarId="documents-sidebar"
        open={docSidebarOpen}
        onOverlayDismiss={() => setDocSidebarOpen(false)}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0">
            <div className="flex items-center gap-2.5 text-[var(--data)]">
              <FiLayers className="size-4 shrink-0" strokeWidth={2.25} />
              <span className="text-xs font-semibold uppercase tracking-wide">Knowledge Base</span>
            </div>
          </div>

          <nav
            className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain"
            aria-label="Workspace sections"
          >
            {Object.entries(groupedNav).map(([groupLabel, items]) => (
              <div key={groupLabel}>
                <p className="text-muted mb-2 text-[10px] font-semibold uppercase tracking-wide">
                  {groupLabel}
                </p>
                <ul className="flex flex-col gap-1">
                  {items.map((item) => {
                    const active = activeTab === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => onTabChange(item.id)}
                          className={`doc-nav-btn group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors ${
                            active
                              ? "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--text-primary)]"
                              : "text-secondary hover:bg-[color-mix(in_srgb,var(--elevated)_75%,transparent)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          <span className={`shrink-0 ${active ? "text-[var(--primary)]" : "text-secondary opacity-90"}`}>
                            {item.icon}
                          </span>
                          <span className="min-w-0">{item.title}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </WorkspaceSidebarRail>

      <WorkspaceMainColumn>
        <header className="mb-3">
          <div className="flex items-center gap-2">
            <SidebarToggleButton
              open={docSidebarOpen}
              onToggle={() => setDocSidebarOpen((o) => !o)}
              sidebarId="documents-sidebar"
              labelOpen="Hide sidebar (Ctrl+\\)"
              labelClosed="Show sidebar (Ctrl+\\)"
            />
            <div className="min-w-0">
              <nav className="text-secondary text-xs font-medium" aria-label="Location">
                Documents
              </nav>
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">{meta.title}</h1>
            </div>
          </div>
        </header>

        {activeTab === "files" && (actionMessage || actionError) ? (
          <div
            className={`mb-3 rounded-xl border px-3 py-2 text-sm ${
              actionError
                ? "border-[color-mix(in_srgb,var(--error)_45%,transparent)] bg-[color-mix(in_srgb,var(--error)_10%,transparent)]"
                : "border-[color-mix(in_srgb,var(--success)_35%,transparent)] bg-[color-mix(in_srgb,var(--success)_8%,transparent)]"
            }`}
          >
            {actionError ? (
              <span className="status-error">{actionError}</span>
            ) : (
              <span className="status-success">{actionMessage}</span>
            )}
          </div>
        ) : null}

        <div className="space-y-4">
          {activeTab === "files" ? filesSection : null}
          {activeTab === "ingestion" ? ingestionSection : null}
          {activeTab === "search" ? searchSection : null}
        </div>
      </WorkspaceMainColumn>
    </div>
  );
}
