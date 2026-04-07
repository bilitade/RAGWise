import { useEffect, useState } from "react";
import {
  FiActivity,
  FiFileText,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiUploadCloud,
} from "react-icons/fi";

import type {
  DocumentsTab,
  IngestionJob,
  ManagedDocument,
  RetrievalMode,
  RetrievalResult,
} from "../types";
import {
  API_BASE_URL,
  fetchJson,
  formatBytes,
  formatDate,
  getDocumentBadge,
  getJobSummary,
  getStatusClass,
} from "../utils";

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
  const [activeJob, setActiveJob] = useState<IngestionJob | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retrievalMode, setRetrievalMode] = useState<RetrievalMode>("similarity");
  const [retrievalQuery, setRetrievalQuery] = useState("");
  const [retrievalLoading, setRetrievalLoading] = useState(false);
  const [retrievalResults, setRetrievalResults] = useState<RetrievalResult[]>([]);

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

  const filesSection = (
    <section className="brand-card rounded-[28px] p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="brand-elevated rounded-2xl p-3">
          <FiFileText className="text-lg status-data" />
        </div>
        <div>
          <h2 className="text-xl font-medium">Files</h2>
          <p className="text-sm text-secondary">List existing files and manage delete or reindex operations.</p>
        </div>
      </div>

      <div className="grid gap-3">
        {documentsLoading ? (
          <div className="brand-elevated rounded-3xl px-4 py-6 text-sm text-secondary">Loading documents...</div>
        ) : documents.length ? (
          documents.map((document) => (
            <div key={document.document_id} className="brand-elevated rounded-3xl p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-sm font-medium">{document.filename}</h3>
                    <span className={`text-xs uppercase tracking-[0.18em] ${getDocumentBadge(document)}`}>
                      {document.status}
                    </span>
                  </div>
                  <p className="mt-2 break-all text-xs text-muted">{document.relative_path}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-secondary">
                    <span>{formatBytes(document.size_bytes)}</span>
                    <span>Modified {formatDate(document.modified_at)}</span>
                    <span>Indexed {formatDate(document.indexed_at)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void handleReindex(document.document_id)}
                    className="brand-secondary rounded-2xl px-3 py-2 text-xs font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <FiRefreshCw />
                      Reindex
                    </span>
                  </button>
                  <button
                    onClick={() => void handleDelete(document.document_id)}
                    className="rounded-2xl border px-3 py-2 text-xs font-medium"
                    style={{ color: "var(--error)", borderColor: "var(--border)" }}
                  >
                    <span className="flex items-center gap-2">
                      <FiTrash2 />
                      Delete
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="brand-elevated rounded-3xl px-4 py-6 text-sm text-secondary">
            No documents are available yet. Upload a file to begin.
          </div>
        )}
      </div>
    </section>
  );

  const ingestionSection = (
    <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
      <section className="brand-card rounded-[28px] p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="brand-elevated rounded-2xl p-3">
            <FiUploadCloud className="text-lg status-data" />
          </div>
          <div>
            <h2 className="text-xl font-medium">Ingestion</h2>
            <p className="text-sm text-secondary">Upload files, ingest a single file, or reingest existing documents.</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {actionMessage ? (
            <div className="brand-elevated rounded-2xl px-4 py-3 text-sm status-success">{actionMessage}</div>
          ) : null}
          {actionError ? (
            <div className="brand-elevated rounded-2xl px-4 py-3 text-sm status-error">{actionError}</div>
          ) : null}

          <input
            type="file"
            multiple
            onChange={(event) => setSelectedFiles(event.target.files)}
            className="surface-input rounded-3xl px-4 py-4 text-sm"
          />

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleUpload}
              disabled={uploading || !selectedFiles?.length}
              className="brand-secondary rounded-2xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload only"}
            </button>
            <button
              onClick={handleUploadAndIngest}
              disabled={uploadingAndIngesting || !selectedFiles?.length}
              className="brand-gradient rounded-2xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadingAndIngesting ? "Queueing..." : "Upload and ingest"}
            </button>
            <button
              onClick={handleIngestAll}
              disabled={bulkIngesting}
              className="brand-primary rounded-2xl px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkIngesting ? "Queueing..." : "Reingest all"}
            </button>
          </div>
        </div>
      </section>

      <section className="brand-card rounded-[28px] p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="brand-elevated rounded-2xl p-3">
            <FiActivity className="text-lg status-success" />
          </div>
          <div>
            <h2 className="text-xl font-medium">Ingestion jobs</h2>
            <p className="text-sm text-secondary">Track chunking, embeddings, and indexing progress.</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="brand-elevated rounded-[28px] p-4">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <div className={`text-sm font-medium ${getStatusClass(activeStage)}`}>
                  {jobSummary.title}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">{jobSummary.status}</div>
              </div>
              <div className="text-sm text-secondary">{jobSummary.progress}%</div>
            </div>
            <div className="progress-track h-2 rounded-full">
              <div className="progress-fill h-2 rounded-full transition-all" style={{ width: `${jobSummary.progress}%` }} />
            </div>
            {activeJob?.task_id ? <div className="mt-3 text-xs text-muted">Job ID {activeJob.task_id}</div> : null}
            {activeJob?.failed && activeJob.error ? <div className="mt-3 text-sm status-error">{activeJob.error}</div> : null}
          </div>

          <div className="brand-elevated rounded-[28px] px-4 py-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Current step</div>
            <div className="mt-2 text-lg font-medium">{jobSummary.title}</div>
            <p className="mt-2 text-sm leading-6 text-secondary">{jobSummary.detail}</p>
            <div className="mt-4 flex items-center justify-between gap-3 text-sm">
              <span className="text-secondary">{jobSummary.nextLabel}</span>
              <span className={getStatusClass(activeStage)}>{jobSummary.status}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const searchSection = (
    <section className="brand-card rounded-[28px] p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="brand-elevated rounded-2xl p-3">
          <FiSearch className="text-lg status-data" />
        </div>
        <div>
          <h2 className="text-xl font-medium">Search</h2>
          <p className="text-sm text-secondary">Run similarity, BM25, or hybrid retrieval.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {(["similarity", "bm25", "advanced"] as RetrievalMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setRetrievalMode(mode)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                retrievalMode === mode ? "brand-pill-active" : "brand-pill"
              }`}
            >
              {mode === "bm25" ? "BM25" : mode === "advanced" ? "Hybrid" : "Similarity"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={retrievalQuery}
            onChange={(event) => setRetrievalQuery(event.target.value)}
            placeholder="Search policies, products, FAQs, or procedures"
            className="surface-input min-w-0 flex-1 rounded-3xl px-4 py-4 text-sm"
          />
          <button
            onClick={handleRetrieval}
            disabled={retrievalLoading}
            className="brand-primary rounded-2xl px-5 py-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {retrievalLoading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="grid gap-3">
          {retrievalResults.length ? (
            retrievalResults.map((result) => (
              <div key={result.node_id} className="brand-elevated rounded-3xl p-4">
                <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-muted">
                  <span>{String(result.metadata.filename ?? result.source)}</span>
                  <span className="status-data">{result.score.toFixed(4)}</span>
                </div>
                <p className="mt-3 text-sm leading-7">{result.text}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.matched_by.map((item) => (
                    <span key={`${result.node_id}-${item}`} className="brand-pill rounded-full px-3 py-1 text-xs">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="brand-elevated rounded-3xl px-4 py-6 text-sm text-secondary">
              Search results will appear here once the knowledge base has indexed content.
            </div>
          )}
        </div>
      </div>
    </section>
  );

  if (activeTab === "files") return filesSection;
  if (activeTab === "ingestion") return ingestionSection;
  return searchSection;
}
