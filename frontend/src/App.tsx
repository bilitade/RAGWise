import { useEffect, useMemo, useState } from "react";
import { FiActivity, FiDatabase, FiMessageSquare, FiSearch, FiUploadCloud } from "react-icons/fi";

type UploadedFile = {
  filename: string;
  path: string;
  size: number;
};

type UploadResponse = {
  files: UploadedFile[];
};

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

type RetrievalResult = {
  node_id: string;
  score: number;
  text: string;
  metadata: Record<string, unknown>;
  source: string;
  matched_by: string[];
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const cardClass =
  "rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.4)] backdrop-blur";

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export default function App() {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const [ingestTask, setIngestTask] = useState<IngestionJob | null>(null);
  const [startingIngestion, setStartingIngestion] = useState(false);

  const [retrievalMode, setRetrievalMode] = useState<"similarity" | "hybrid">("similarity");
  const [retrievalQuery, setRetrievalQuery] = useState("");
  const [retrievalLoading, setRetrievalLoading] = useState(false);
  const [retrievalResults, setRetrievalResults] = useState<RetrievalResult[]>([]);

  const [chatInput, setChatInput] = useState("");
  const [chatOutput, setChatOutput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);

  useEffect(() => {
    if (!ingestTask?.task_id) return;
    if (ingestTask.successful || ingestTask.failed) return;

    const interval = window.setInterval(async () => {
      try {
        const nextStatus = await fetchJson<IngestionJob>(
          `${API_BASE_URL}/api/ingestion/jobs/${ingestTask.task_id}`,
        );
        setIngestTask(nextStatus);
      } catch {
        window.clearInterval(interval);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [ingestTask]);

  const currentProgress = ingestTask?.stage?.progress ?? 0;
  const stageHistory = useMemo(() => ingestTask?.stage_history ?? [], [ingestTask]);

  async function handleUpload() {
    if (!selectedFiles?.length) return;
    const formData = new FormData();
    Array.from(selectedFiles).forEach((file) => formData.append("files", file));
    setUploading(true);
    try {
      const result = await fetchJson<UploadResponse>(`${API_BASE_URL}/api/files/upload`, {
        method: "POST",
        body: formData,
      });
      setUploadedFiles(result.files);
    } finally {
      setUploading(false);
    }
  }

  async function handleIngest() {
    setStartingIngestion(true);
    try {
      const task = await fetchJson<{ task_id: string; status: string }>(
        `${API_BASE_URL}/api/ingestion/jobs`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recreate_collection: true }),
        },
      );
      setIngestTask({
        task_id: task.task_id,
        status: task.status,
        successful: false,
        failed: false,
        stage_history: [],
      });
    } finally {
      setStartingIngestion(false);
    }
  }

  async function handleRetrieval() {
    if (!retrievalQuery.trim()) return;
    setRetrievalLoading(true);
    try {
      const endpoint =
        retrievalMode === "similarity" ? "/api/retrieval/similarity" : "/api/retrieval/hybrid";
      const payload =
        retrievalMode === "similarity"
          ? { query: retrievalQuery, top_k: 5 }
          : { query: retrievalQuery, top_k: 5, vector_top_k: 10, bm25_top_k: 10 };
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

  async function handleChat() {
    if (!chatInput.trim()) return;
    setChatStreaming(true);
    setChatOutput("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: chatInput }),
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
            setChatOutput((current) => current + payload.text);
          }
          if (event === "error" && payload.error) {
            setChatOutput(payload.error);
          }
        }
      }
    } finally {
      setChatStreaming(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-950/80 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Banking RAG Console</p>
          <h1 className="text-3xl font-semibold text-white">Upload, index, search, and chat</h1>
          <p className="max-w-3xl text-sm text-slate-400">
            Minimal frontend for file upload, queued ingestion progress, retrieval, and streaming agent chat.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className={cardClass}>
            <div className="mb-4 flex items-center gap-3">
              <FiUploadCloud className="text-xl text-cyan-300" />
              <h2 className="text-lg font-semibold">Upload Files</h2>
            </div>
            <div className="flex flex-col gap-4">
              <input
                type="file"
                multiple
                onChange={(event) => setSelectedFiles(event.target.files)}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
              />
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFiles?.length}
                className="rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {uploading ? "Uploading..." : "Upload to /upload"}
              </button>
              <div className="space-y-2">
                {uploadedFiles.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm"
                  >
                    <span>{file.filename}</span>
                    <span className="text-slate-400">{formatBytes(file.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <div className="mb-4 flex items-center gap-3">
              <FiActivity className="text-xl text-emerald-300" />
              <h2 className="text-lg font-semibold">Ingestion Progress</h2>
            </div>
            <div className="flex flex-col gap-4">
              <button
                onClick={handleIngest}
                disabled={startingIngestion}
                className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {startingIngestion ? "Queueing..." : "Start Ingestion"}
              </button>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span>{ingestTask?.stage?.message ?? "No active job"}</span>
                  <span className="text-slate-400">{currentProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-emerald-400 transition-all"
                    style={{ width: `${currentProgress}%` }}
                  />
                </div>
                {ingestTask?.task_id ? (
                  <p className="mt-3 text-xs text-slate-400">Task ID: {ingestTask.task_id}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                {stageHistory.map((stage, index) => (
                  <div
                    key={`${stage.name}-${index}`}
                    className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-200">{stage.name}</span>
                      <span className="text-slate-400">{stage.progress}%</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{stage.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className={cardClass}>
            <div className="mb-4 flex items-center gap-3">
              <FiSearch className="text-xl text-violet-300" />
              <h2 className="text-lg font-semibold">Retrieval</h2>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setRetrievalMode("similarity")}
                  className={`rounded-full px-4 py-2 text-sm ${
                    retrievalMode === "similarity"
                      ? "bg-violet-300 text-slate-950"
                      : "border border-slate-700 text-slate-300"
                  }`}
                >
                  Similarity
                </button>
                <button
                  onClick={() => setRetrievalMode("hybrid")}
                  className={`rounded-full px-4 py-2 text-sm ${
                    retrievalMode === "hybrid"
                      ? "bg-violet-300 text-slate-950"
                      : "border border-slate-700 text-slate-300"
                  }`}
                >
                  Hybrid BM25
                </button>
              </div>
              <div className="flex gap-3">
                <input
                  value={retrievalQuery}
                  onChange={(event) => setRetrievalQuery(event.target.value)}
                  placeholder="Search the knowledge base"
                  className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
                />
                <button
                  onClick={handleRetrieval}
                  disabled={retrievalLoading}
                  className="rounded-2xl bg-violet-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-violet-200 disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {retrievalLoading ? "Searching..." : "Search"}
                </button>
              </div>
              <div className="space-y-3">
                {retrievalResults.map((result) => (
                  <div key={result.node_id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                      <span>{result.source}</span>
                      <span>{result.score.toFixed(4)}</span>
                    </div>
                    <p className="text-sm leading-6 text-slate-200">{result.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <div className="mb-4 flex items-center gap-3">
              <FiMessageSquare className="text-xl text-amber-300" />
              <h2 className="text-lg font-semibold">Agent Chat</h2>
            </div>
            <div className="flex flex-col gap-4">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder="Ask about the bank, policies, FAQs, or current public information."
                rows={5}
                className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm"
              />
              <button
                onClick={handleChat}
                disabled={chatStreaming}
                className="rounded-2xl bg-amber-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:bg-slate-700 disabled:text-slate-400"
              >
                {chatStreaming ? "Streaming..." : "Send"}
              </button>
              <div className="min-h-72 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                  <FiDatabase />
                  Streaming response
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">
                  {chatOutput || "The agent response will stream here."}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
