import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiDatabase,
  FiFileText,
  FiMessageSquare,
  FiMoon,
  FiRefreshCw,
  FiSearch,
  FiSend,
  FiSun,
  FiTrash2,
  FiUploadCloud,
} from "react-icons/fi";

type ThemeMode = "dark" | "light";
type RetrievalMode = "similarity" | "bm25" | "advanced";
type AppRoute = "/" | "/documents" | "/chat";
type DocumentsTab = "files" | "ingestion" | "search";

type Stage = {
  name: string;
  status: string;
  progress: number;
  message: string;
  details: Record<string, unknown>;
};

type IngestionJob = {
  task_id: string;
  status: string;
  successful: boolean;
  failed: boolean;
  stage?: Stage | null;
  stage_history?: Stage[];
  result?: Record<string, unknown> | null;
  error?: string | null;
};

type ManagedDocument = {
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

type RetrievalResult = {
  node_id: string;
  score: number;
  text: string;
  metadata: Record<string, unknown>;
  source: string;
  matched_by: string[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const INGESTION_STEPS = [
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

function getStepLabel(stepName: string | null | undefined): string {
  return INGESTION_STEPS.find((step) => step.name === stepName)?.label ?? "Idle";
}

function getJobSummary(job: IngestionJob | null): {
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
      detail: job.stage?.message ?? "The ingestion workflow completed successfully.",
      status: "completed",
      progress: 100,
      nextLabel: "Knowledge base is up to date",
    };
  }

  if (job.stage) {
    const stepIndex = INGESTION_STEPS.findIndex((step) => step.name === job.stage?.name);
    return {
      title: getStepLabel(job.stage.name),
      detail: job.stage.message,
      status: job.stage.status,
      progress: job.stage.progress,
      nextLabel: stepIndex >= 0 && stepIndex < INGESTION_STEPS.length - 1
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

function getCurrentRoute(): AppRoute {
  if (window.location.pathname === "/chat") return "/chat";
  if (window.location.pathname === "/documents") return "/documents";
  return "/";
}

function navigateTo(route: AppRoute): void {
  if (window.location.pathname === route) return;
  window.history.pushState({}, "", route);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatStageName(name: string): string {
  return name.replace(/_/g, " ");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not indexed";
  return new Date(value).toLocaleString();
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

function getStatusClass(stage?: Stage | null): string {
  if (!stage) return "text-muted";
  if (stage.status === "failed") return "status-error";
  if (stage.status === "completed") return "status-success";
  if (stage.status === "running") return "status-data";
  return "text-muted";
}

function getDocumentBadge(document: ManagedDocument): string {
  if (document.needs_reindex) return "status-warning";
  if (document.indexed) return "status-success";
  return "status-data";
}

function BrandWordmark() {
  return (
    <div className="brand-mark" aria-label="RAGenius">
      <span className="brand-mark-core">RAG</span>
      <span className="brand-mark-accent">enius</span>
    </div>
  );
}

function LandingView() {
  return (
    <div className="flex flex-col gap-6">
      <section className="brand-card brand-hero rounded-[32px] p-6 sm:p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="max-w-4xl">
            <div className="heading-kicker text-xs font-medium uppercase">Agentic RAG System</div>
            <div className="mt-4">
              <BrandWordmark />
            </div>
            <h1 className="brand-title mt-5 max-w-3xl text-4xl font-medium leading-tight sm:text-6xl">
              Turn company knowledge into grounded answers.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-secondary">
              Ingest documents, retrieve context, and chat with confidence.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <div className="landing-stat rounded-2xl px-4 py-3 text-sm text-secondary">Qdrant-backed retrieval</div>
              <div className="landing-stat rounded-2xl px-4 py-3 text-sm text-secondary">Streaming responses</div>
              <div className="landing-stat rounded-2xl px-4 py-3 text-sm text-secondary">Document-level control</div>
            </div>
          </div>

          <div className="brand-elevated rounded-[28px] p-5 sm:p-6">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Get started</div>
            <div className="mt-3 text-2xl font-medium">Move from raw files to grounded answers.</div>
            <p className="mt-3 text-sm leading-7 text-secondary">
              Start with documents or jump straight into chat.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={() => navigateTo("/documents")}
                className="brand-gradient rounded-2xl px-5 py-3.5 text-sm font-medium"
              >
                Open documents
              </button>
              <button
                onClick={() => navigateTo("/chat")}
                className="brand-secondary rounded-2xl px-5 py-3.5 text-sm font-medium"
              >
                Start chat
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="brand-elevated rounded-[32px] p-5 sm:p-6 lg:p-8">
        <div className="mb-6 max-w-2xl">
          <div className="heading-kicker text-xs font-medium uppercase">What It Provides</div>
          <h2 className="brand-title mt-3 text-2xl font-medium sm:text-3xl">Core features for operational knowledge systems</h2>
          <p className="mt-3 text-sm leading-7 text-secondary">
            RAGenius is designed to keep the workflow direct: ingest, retrieve, monitor, and answer.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="brand-card rounded-3xl p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Documents</div>
            <div className="mt-3 text-xl font-medium">Upload, reindex, and control source files</div>
            <p className="mt-2 text-sm leading-7 text-secondary">
              Manage single-file ingestion, full reloads, and document deletion with clear operational control.
            </p>
          </div>
          <div className="brand-card rounded-3xl p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Retrieval</div>
            <div className="mt-3 text-xl font-medium">Dense, BM25, and advanced search</div>
            <p className="mt-2 text-sm leading-7 text-secondary">
              Switch between similarity, lexical search, and fused retrieval to improve grounded responses.
            </p>
          </div>
          <div className="brand-card rounded-3xl p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Ingestion</div>
            <div className="mt-3 text-xl font-medium">Tracked background processing</div>
            <p className="mt-2 text-sm leading-7 text-secondary">
              Follow chunking, embedding, and indexing progress through a clean asynchronous job timeline.
            </p>
          </div>
          <div className="brand-card rounded-3xl p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Agent</div>
            <div className="mt-3 text-xl font-medium">Streaming answers over company knowledge</div>
            <p className="mt-2 text-sm leading-7 text-secondary">
              Run a compact chat workflow that can use local retrieval or web search based on the question.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function DocumentsView({
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

function ChatView() {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);

  async function handleChatSubmit() {
    if (!chatInput.trim() || chatStreaming) return;
    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", content: chatInput }];
    setChatMessages([...nextMessages, { role: "assistant", content: "" }]);
    setChatInput("");
    setChatStreaming(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!response.ok || !response.body) {
        throw new Error(await response.text());
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          const event = lines.find((line) => line.startsWith("event:"))?.replace("event:", "").trim();
          const dataLine = lines.find((line) => line.startsWith("data:"));
          if (!event || !dataLine) continue;
          const payload = JSON.parse(dataLine.replace("data:", "").trim()) as Record<string, string>;

          if (event === "token" && payload.text) {
            setChatMessages((current) => {
              const updated = [...current];
              const lastIndex = updated.length - 1;
              updated[lastIndex] = {
                role: "assistant",
                content: `${updated[lastIndex]?.content ?? ""}${payload.text}`,
              };
              return updated;
            });
          }

          if (event === "error" && payload.error) {
            setChatMessages((current) => {
              const updated = [...current];
              updated[updated.length - 1] = { role: "assistant", content: payload.error ?? "Chat failed." };
              return updated;
            });
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat failed.";
      setChatMessages((current) => {
        const updated = [...current];
        updated[updated.length - 1] = { role: "assistant", content: message };
        return updated;
      });
    } finally {
      setChatStreaming(false);
    }
  }

  return (
    <section className="brand-card mx-auto flex min-h-[72vh] w-full max-w-5xl flex-col rounded-[28px] p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="brand-elevated rounded-2xl p-3">
          <FiMessageSquare className="text-lg" style={{ color: "var(--accent)" }} />
        </div>
        <div>
          <h2 className="text-xl font-medium">Chat</h2>
          <p className="text-sm text-secondary">Streaming assistant interface with a dedicated conversation surface.</p>
        </div>
      </div>

      <div className="brand-elevated flex min-h-0 flex-1 flex-col rounded-[28px] p-4">
        <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted">
          <FiDatabase className="status-data" />
          Live conversation
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          {chatMessages.length ? (
            chatMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[88%] rounded-[24px] px-4 py-3 text-sm leading-7 ${
                  message.role === "user" ? "ml-auto brand-primary" : "brand-card"
                }`}
              >
                {message.content || (chatStreaming && index === chatMessages.length - 1 ? "..." : "")}
              </div>
            ))
          ) : (
            <div className="m-auto max-w-md text-center text-sm leading-7 text-secondary">
              Start a conversation about company policy, banking FAQ, internal procedures, or current public information.
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-3">
          <textarea
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Ask the agent anything relevant to the bank or current public context."
            rows={3}
            className="surface-input min-h-[88px] flex-1 rounded-3xl px-4 py-4 text-sm"
          />
          <button
            onClick={handleChatSubmit}
            disabled={chatStreaming || !chatInput.trim()}
            className="brand-gradient self-end rounded-2xl px-4 py-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <FiSend />
              Send
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [route, setRoute] = useState<AppRoute>(getCurrentRoute());
  const [documentsTab, setDocumentsTab] = useState<DocumentsTab>("files");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const handleRouteChange = () => setRoute(getCurrentRoute());
    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, []);

  return (
    <div className="app-shell px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        {route === "/" ? (
          <>
            <div className="flex items-center justify-between gap-4 px-1">
              <BrandWordmark />
              <button
                type="button"
                onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                className="brand-secondary rounded-2xl px-4 py-3 text-sm font-medium"
              >
                <span className="flex items-center gap-2">
                  {theme === "dark" ? <FiSun /> : <FiMoon />}
                  {theme === "dark" ? "Light mode" : "Dark mode"}
                </span>
              </button>
            </div>

            <LandingView />
          </>
        ) : (
          <>
            <header className="brand-card rounded-[28px] px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="brand-elevated rounded-2xl p-3">
                    {route === "/documents" ? (
                      <FiFileText className="text-lg status-data" />
                    ) : (
                      <FiMessageSquare className="text-lg" style={{ color: "var(--accent)" }} />
                    )}
                  </div>
                  <div>
                    <BrandWordmark />
                    <div className="text-sm text-secondary">{route === "/documents" ? "Workspace" : "Agent chat"}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        navigateTo("/documents");
                        setDocumentsTab("files");
                      }}
                      className={`rounded-2xl px-4 py-2.5 text-sm font-medium ${
                        route === "/documents" && documentsTab === "files" ? "brand-pill-active" : "brand-pill"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <FiFileText />
                        Files
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        navigateTo("/documents");
                        setDocumentsTab("ingestion");
                      }}
                      className={`rounded-2xl px-4 py-2.5 text-sm font-medium ${
                        route === "/documents" && documentsTab === "ingestion" ? "brand-pill-active" : "brand-pill"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <FiUploadCloud />
                        Ingestion
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        navigateTo("/documents");
                        setDocumentsTab("search");
                      }}
                      className={`rounded-2xl px-4 py-2.5 text-sm font-medium ${
                        route === "/documents" && documentsTab === "search" ? "brand-pill-active" : "brand-pill"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <FiSearch />
                        Search
                      </span>
                    </button>
                    <button
                    onClick={() => navigateTo("/chat")}
                    className={`rounded-2xl px-4 py-2.5 text-sm font-medium ${
                      route === "/chat" ? "brand-pill-active" : "brand-pill"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <FiMessageSquare />
                      Chat
                    </span>
                  </button>
                </div>

                  <button
                    type="button"
                    onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                    className="brand-secondary rounded-2xl px-4 py-3 text-sm font-medium"
                  >
                    <span className="flex items-center gap-2">
                      {theme === "dark" ? <FiSun /> : <FiMoon />}
                      {theme === "dark" ? "Light mode" : "Dark mode"}
                    </span>
                  </button>

                <div className="rounded-2xl border px-4 py-3 text-sm text-secondary">
                  <span className="status-data font-medium">API</span>
                  <span className="ml-2 text-muted">{API_BASE_URL}</span>
                </div>
                </div>
              </div>
            </header>

            {route === "/documents" ? (
              <DocumentsView activeTab={documentsTab} onTabChange={setDocumentsTab} />
            ) : (
              <ChatView />
            )}
          </>
        )}
      </div>
    </div>
  );
}
