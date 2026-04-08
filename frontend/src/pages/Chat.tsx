import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCheckCircle,
  FiChevronDown,
  FiClock,
  FiCpu,
  FiDatabase,
  FiEdit2,
  FiGlobe,
  FiMessageSquare,
  FiMic,
  FiPlus,
  FiSend,
  FiSquare,
  FiTrash2,
  FiXCircle,
} from "react-icons/fi";

import type { ChatContextWindow, ChatCitation, ChatConversation, ChatMessage } from "../types";
import {
  API_BASE_URL,
  buildAuthHeaders,
  CHAT_SIDEBAR_KEY,
  getAccessToken,
  isServerChatThreadId,
  mergeCitationLists,
  readSidebarPreference,
  splitMessageCitations,
  writeSidebarPreference,
} from "../utils";
import AssistantMessageBody from "../components/AssistantMessageBody";
import { SidebarToggleButton, WorkspaceMainColumn, WorkspaceSidebarRail } from "../components/WorkspaceChrome";
import { LuMemoryStick } from "react-icons/lu";

const CONTEXT_MODE_OPTIONS: { value: ChatContextWindow; label: string; hint: string }[] = [
  { value: "min", label: "mini", hint: "5 messages" },
  { value: "medium", label: "mid", hint: "10 messages" },
  { value: "max", label: "max", hint: "15 messages" },
];

// ── Status config ────────────────────────────────────────────────────────────
type StatusConfig = {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  color: string;
  pulse: boolean;
};

function getStatusConfig(status: string, streaming: boolean): StatusConfig {
  const s = status.toLowerCase();

  if (s.includes("knowledge") || s.includes("retriev")) {
    return {
      icon: <FiDatabase />,
      label: "Retrieving",
      subtitle: "Searching the knowledge base",
      color: "var(--primary)",
      pulse: true,
    };
  }
  if (s.includes("web") || s.includes("internet") || s.includes("search")) {
    return {
      icon: <FiGlobe />,
      label: "Web Search",
      subtitle: "Searching the internet for context",
      color: "var(--data)",
      pulse: true,
    };
  }
  if (s.includes("reasoning") || s.includes("result")) {
    return {
      icon: <FiCpu />,
      label: "Reasoning",
      subtitle: "Processing tool results",
      color: "var(--primary)",
      pulse: true,
    };
  }
  if (s.includes("draft") || s.includes("writing")) {
    return {
      icon: <FiEdit2 />,
      label: "Drafting",
      subtitle: "Writing the response",
      color: "var(--success)",
      pulse: true,
    };
  }
  if (s.includes("finaliz")) {
    return {
      icon: <FiCheckCircle />,
      label: "Finalizing",
      subtitle: "Wrapping up the answer",
      color: "var(--success)",
      pulse: false,
    };
  }
  if (s.includes("think")) {
    return {
      icon: <FiCpu />,
      label: "Thinking",
      subtitle: "Deciding what to do next",
      color: "var(--primary)",
      pulse: true,
    };
  }
  if (s === "failed") {
    return {
      icon: <FiXCircle />,
      label: "Failed",
      subtitle: "Something went wrong",
      color: "var(--error)",
      pulse: false,
    };
  }
  if (streaming) {
    return {
      icon: <FiClock />,
      label: "Working",
      subtitle: "Agent is processing",
      color: "var(--accent)",
      pulse: true,
    };
  }
  return {
    icon: <FiCheckCircle />,
    label: "Ready",
    subtitle: "Waiting for your message",
    color: "var(--success)",
    pulse: false,
  };
}

function InlineStatusPlaceholder({
  status,
  activity: _activity,
}: {
  status: string;
  activity: string[];
}) {
  const cfg = getStatusConfig(status, true);

  return (
    <div className="flex flex-col gap-2 py-0.5">
      <div className="flex items-center gap-2">
        <span
          className="agent-status-dot shrink-0"
          style={{
            background: cfg.color,
            animation: cfg.pulse ? "status-pulse 1.4s ease-in-out infinite" : "none",
          }}
        />
        <span className="shrink-0 text-sm" style={{ color: cfg.color }}>
          {cfg.icon}
        </span>
        <span className="text-xs font-semibold" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

function ChatMessagesSkeleton() {
  return (
    <div className="flex min-h-[12rem] flex-col gap-3 py-2" aria-busy="true" aria-label="Loading messages">
      <div className="text-muted flex items-center gap-2 text-xs">
        <FiClock className="size-3.5 animate-pulse" strokeWidth={2.25} />
        <span>Loading conversation…</span>
      </div>
      {[0.92, 0.78, 0.65].map((w, i) => (
        <div
          key={i}
          className="h-14 max-w-[min(100%,85%)] animate-pulse rounded-2xl bg-[color-mix(in_srgb,var(--border)_55%,var(--elevated)_45%)]"
          style={{ width: `${w * 100}%` }}
        />
      ))}
    </div>
  );
}

async function fetchThreadMessages(threadId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE_URL}/api/chat/threads/${threadId}/messages`, {
    headers: buildAuthHeaders(),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { messages: { role: string; content: string }[] };
  return (data.messages ?? []).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
}

export default function Chat() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState("");
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  /** True while fetching messages for the active thread (initial load or switching threads). */
  const [messagesLoading, setMessagesLoading] = useState(false);
  const threadMessagesFetchId = useRef(0);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatStatus, setChatStatus] = useState("Ready");
  const [chatActivity, setChatActivity] = useState<string[]>([]);
  const [personas, setPersonas] = useState<{ id: string; name: string; description: string }[]>([]);
  const [personaId, setPersonaId] = useState("");
  const [contextWindow, setContextWindow] = useState<ChatContextWindow>("min");
  const [contextModeMenuOpen, setContextModeMenuOpen] = useState(false);
  const contextModeRef = useRef<HTMLDivElement | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(() => readSidebarPreference(CHAT_SIDEBAR_KEY));
  const recognitionRef = useRef<any>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  /** Skip auto-scroll when the user switched threads; still scroll on same-thread updates (send/stream). */
  const prevThreadIdRef = useRef<string | null>(null);
  const conversationsRef = useRef(conversations);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    writeSidebarPreference(CHAT_SIDEBAR_KEY, chatSidebarOpen);
  }, [chatSidebarOpen]);

  useEffect(() => {
    if (!contextModeMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = contextModeRef.current;
      if (el && !el.contains(e.target as Node)) setContextModeMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextModeMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [contextModeMenuOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setChatSidebarOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId),
    [activeConversationId, conversations],
  );
  const chatMessages = activeConversation?.messages ?? [];

  useEffect(() => {
    const prev = prevThreadIdRef.current;
    prevThreadIdRef.current = activeConversationId;
    if (prev !== null && prev !== activeConversationId) return;
    bottomAnchorRef.current?.scrollIntoView({ block: "end" });
  }, [chatMessages, chatStreaming, activeConversationId]);

  useEffect(() => {
    void fetch(`${API_BASE_URL}/api/personas`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPersonas(Array.isArray(data) ? data : []))
      .catch(() => setPersonas([]));
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!getAccessToken()) {
        const id = `local-${Date.now()}`;
        setConversations([{ id, title: "New chat", messages: [], updatedAt: Date.now(), messagesHydrated: true }]);
        setActiveConversationId(id);
        setThreadsLoaded(true);
        setMessagesLoading(false);
        return;
      }

      try {
        const listRes = await fetch(`${API_BASE_URL}/api/chat/threads`, { headers: buildAuthHeaders() });
        const listData = listRes.ok ? await listRes.json() : { threads: [] };
        const raw = Array.isArray(listData.threads) ? listData.threads : [];

        let firstId: string;
        let initial: ChatConversation[];

        if (raw.length === 0) {
          const createRes = await fetch(`${API_BASE_URL}/api/chat/threads`, {
            method: "POST",
            headers: buildAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ context_window: "min" }),
          });
          if (!createRes.ok) throw new Error(await createRes.text());
          const t = (await createRes.json()) as {
            id: string;
            title: string;
            updated_at?: string;
          };
          const updatedAt = t.updated_at ? Date.parse(t.updated_at) : Date.now();
          firstId = t.id;
          initial = [{ id: t.id, title: t.title, messages: [], updatedAt, messagesHydrated: true }];
        } else {
          firstId = raw[0].id;
          initial = raw.map((t: { id: string; title: string; updated_at?: string }) => ({
            id: t.id,
            title: t.title,
            messages: [],
            updatedAt: t.updated_at ? Date.parse(t.updated_at) : Date.now(),
            messagesHydrated: false,
          }));
        }

        if (cancelled) return;
        setConversations(initial);
        setActiveConversationId(firstId);
        setThreadsLoaded(true);
        setMessagesLoading(true);
        const fetchId = ++threadMessagesFetchId.current;
        const msgs = await fetchThreadMessages(firstId);
        if (cancelled || fetchId !== threadMessagesFetchId.current) return;
        setConversations((cur) =>
          cur.map((c) => (c.id === firstId ? { ...c, messages: msgs, messagesHydrated: true } : c)),
        );
      } catch {
        if (cancelled) return;
        const id = `local-${Date.now()}`;
        setConversations([{ id, title: "New chat", messages: [], updatedAt: Date.now(), messagesHydrated: true }]);
        setActiveConversationId(id);
        setThreadsLoaded(true);
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateActiveConversation(updater: (conversation: ChatConversation) => ChatConversation) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversationId ? updater(conversation) : conversation,
      ),
    );
  }

  function buildConversationTitle(messages: ChatMessage[]): string {
    const firstUserMessage = messages.find((message) => message.role === "user")?.content.trim();
    if (!firstUserMessage) return "New chat";
    return firstUserMessage.slice(0, 48) + (firstUserMessage.length > 48 ? "..." : "");
  }

  async function createConversation() {
    setChatInput("");
    setChatStatus("Ready");
    setChatActivity([]);

    if (getAccessToken()) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/chat/threads`, {
          method: "POST",
          headers: buildAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ context_window: contextWindow }),
        });
        if (!res.ok) throw new Error(await res.text());
        const t = (await res.json()) as { id: string; title: string; updated_at?: string };
        const updatedAt = t.updated_at ? Date.parse(t.updated_at) : Date.now();
        const conversation: ChatConversation = {
          id: t.id,
          title: t.title,
          messages: [],
          updatedAt,
          messagesHydrated: true,
        };
        setConversations((current) => [conversation, ...current]);
        setActiveConversationId(t.id);
      } catch {
        const id = `local-${Date.now()}`;
        const conversation: ChatConversation = {
          id,
          title: "New chat",
          messages: [],
          updatedAt: Date.now(),
          messagesHydrated: true,
        };
        setConversations((current) => [conversation, ...current]);
        setActiveConversationId(id);
      }
      return;
    }

    const id = `local-${Date.now()}`;
    const conversation: ChatConversation = {
      id,
      title: "New chat",
      messages: [],
      updatedAt: Date.now(),
      messagesHydrated: true,
    };
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(id);
  }

  async function selectConversation(id: string) {
    setActiveConversationId(id);
    setChatInput("");
    setChatStatus("Ready");
    setChatActivity([]);
    if (!getAccessToken() || !isServerChatThreadId(id)) {
      setMessagesLoading(false);
      return;
    }

    const conv = conversationsRef.current.find((c) => c.id === id);
    const silent = conv?.messagesHydrated === true;
    const fetchId = ++threadMessagesFetchId.current;
    if (!silent) setMessagesLoading(true);

    try {
      const messages = await fetchThreadMessages(id);
      if (fetchId !== threadMessagesFetchId.current) return;
      setConversations((current) =>
        current.map((c) => (c.id === id ? { ...c, messages, messagesHydrated: true } : c)),
      );
    } catch {
      if (fetchId === threadMessagesFetchId.current) {
        setConversations((current) =>
          current.map((c) => (c.id === id ? { ...c, messagesHydrated: true } : c)),
        );
      }
    } finally {
      if (fetchId === threadMessagesFetchId.current && !silent) setMessagesLoading(false);
    }
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    threadMessagesFetchId.current += 1;
    if (getAccessToken() && isServerChatThreadId(id)) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/chat/threads/${id}`, {
          method: "DELETE",
          headers: buildAuthHeaders(),
        });
        if (!res.ok) return;
      } catch {
        return;
      }
    }

    const next = conversationsRef.current.filter((c) => c.id !== id);
    setConversations(next);
    setActiveConversationId((aid) => {
      if (aid !== id) return aid;
      return next[0]?.id ?? "";
    });
    if (next.length === 0) {
      queueMicrotask(() => void createConversation());
    }
  }

  async function handleChatSubmit() {
    if (!chatInput.trim() || chatStreaming || !activeConversation) return;
    const trimmed = chatInput.trim();
    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", content: trimmed }];
    const previousConversationId = activeConversation.id;
    const authed = !!getAccessToken();
    const serverThread = authed && isServerChatThreadId(activeConversation.id);

    updateActiveConversation((conversation) => ({
      ...conversation,
      title: buildConversationTitle(nextMessages),
      messages: [...nextMessages, { role: "assistant", content: "", citations: [] }],
      updatedAt: Date.now(),
    }));
    setChatInput("");
    setChatStreaming(true);
    setChatStatus("Thinking");
    setChatActivity(["Thinking"]);

    const requestBody = serverThread
      ? {
          messages: [{ role: "user" as const, content: trimmed }],
          thread_id: activeConversation.id,
          context_window: contextWindow,
          persona_id: personaId || null,
        }
      : {
          messages: nextMessages,
          context_window: contextWindow,
          persona_id: personaId || null,
        };

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(requestBody),
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
          const payload = JSON.parse(dataLine.replace("data:", "").trim()) as Record<string, unknown>;

          if (event === "token" && typeof payload.text === "string" && payload.text) {
            updateActiveConversation((conversation) => {
              const updated = [...conversation.messages];
              const lastIndex = updated.length - 1;
              const prev = updated[lastIndex];
              updated[lastIndex] = {
                ...prev,
                role: "assistant",
                content: `${prev?.content ?? ""}${payload.text}`,
              };
              return { ...conversation, messages: updated, updatedAt: Date.now() };
            });
          }

          if (event === "citations" && Array.isArray(payload.items)) {
            const parsed: ChatCitation[] = payload.items
              .filter((x): x is Record<string, unknown> => x != null && typeof x === "object")
              .map((x): ChatCitation => ({
                kind: x.kind === "web" ? "web" : "knowledge_base",
                label: String(x.label ?? ""),
                detail: x.detail != null ? String(x.detail) : undefined,
                url: x.url != null ? String(x.url) : undefined,
                ref: x.ref != null ? String(x.ref) : undefined,
              }))
              .filter((c) => c.label.length > 0);
            if (!parsed.length) continue;
            updateActiveConversation((conversation) => {
              const updated = [...conversation.messages];
              const lastIndex = updated.length - 1;
              const prev = updated[lastIndex];
              updated[lastIndex] = {
                ...prev,
                role: "assistant",
                citations: mergeCitationLists(prev?.citations ?? [], parsed),
              };
              return { ...conversation, messages: updated, updatedAt: Date.now() };
            });
          }

          if (event === "status" && typeof payload.label === "string") {
            const statusLabel = payload.label;
            setChatStatus(statusLabel);
            setChatActivity((current) =>
              current[current.length - 1] === statusLabel ? current : [...current, statusLabel],
            );
          }

          if (event === "error" && typeof payload.error === "string") {
            setChatStatus("Failed");
            const errText = payload.error || "Chat failed.";
            updateActiveConversation((conversation) => {
              const updated = [...conversation.messages];
              updated[updated.length - 1] = { role: "assistant", content: errText };
              return { ...conversation, messages: updated, updatedAt: Date.now() };
            });
          }

          if (
            event === "done" &&
            typeof (payload as Record<string, unknown>).thread_id === "string" &&
            !isServerChatThreadId(previousConversationId)
          ) {
            const tid = String((payload as Record<string, unknown>).thread_id);
            setConversations((current) =>
              current.map((c) =>
                c.id === previousConversationId
                  ? { ...c, id: tid, updatedAt: Date.now(), messagesHydrated: true }
                  : c,
              ),
            );
            setActiveConversationId(tid);
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat failed.";
      setChatStatus("Failed");
      updateActiveConversation((conversation) => {
        const updated = [...conversation.messages];
        updated[updated.length - 1] = { role: "assistant", content: message };
        return { ...conversation, messages: updated, updatedAt: Date.now() };
      });
    } finally {
      setChatStreaming(false);
      setChatStatus((current) => (current === "Failed" ? current : "Ready"));
    }
  }

  function handleChatInputKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleChatSubmit();
    }
  }

  function toggleVoiceInput() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: new () => any }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setChatInput((prev) => (prev ? `${prev} ${finalTranscript}` : finalTranscript));
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  return (
    <div className="chat-workspace-shell relative flex h-full min-h-0 w-full flex-1 flex-col gap-4 overflow-x-hidden lg:flex-row lg:items-stretch lg:gap-6 lg:overflow-hidden">
      <WorkspaceSidebarRail
        sidebarId="chat-sidebar"
        open={chatSidebarOpen}
        onOverlayDismiss={() => setChatSidebarOpen(false)}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--border)] pb-3 text-[var(--data)]">
            <FiMessageSquare className="size-5 shrink-0" strokeWidth={2.25} />
            <span className="text-xs font-semibold uppercase tracking-wide">Conversations</span>
          </div>

          <button
            type="button"
            onClick={createConversation}
            className="brand-primary mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
          >
            <FiPlus className="text-base" strokeWidth={2.25} />
            New conversation
          </button>

          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <p className="text-muted mb-2.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide">History</p>
            <div className="chat-history-list flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pr-0.5">
              {conversations
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((conversation) => {
                  const active = conversation.id === activeConversationId;
                  return (
                    <div
                      key={conversation.id}
                      className={`flex min-w-0 items-stretch gap-1 rounded-xl border transition-colors ${
                        active
                          ? "border-[color-mix(in_srgb,var(--primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
                          : "border-transparent hover:bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void selectConversation(conversation.id)}
                        className="min-w-0 flex-1 px-3 py-2.5 text-left"
                      >
                        <div className="truncate text-sm font-semibold">{conversation.title}</div>
                        <div className="text-muted mt-1 line-clamp-2 text-[11px] leading-snug">
                          {conversation.messages.at(-1)?.content || "No messages yet"}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => void deleteConversation(conversation.id, e)}
                        className="text-muted hover:text-[var(--error)] shrink-0 self-start rounded-lg p-2.5 transition-colors"
                        title="Delete conversation"
                        aria-label={`Delete ${conversation.title}`}
                      >
                        <FiTrash2 className="size-4" strokeWidth={2.25} />
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="mt-2 shrink-0 truncate border-t border-[var(--border)] pt-2 font-mono text-[9px] text-muted" title={API_BASE_URL}>
            {API_BASE_URL}
          </div>
        </div>
      </WorkspaceSidebarRail>

      <WorkspaceMainColumn className="pb-5" noOuterScroll>
        <header className="mb-4">
          <div className="flex items-center gap-2">
            <SidebarToggleButton
              open={chatSidebarOpen}
              onToggle={() => setChatSidebarOpen((o) => !o)}
              sidebarId="chat-sidebar"
              labelOpen="Hide chat list (Ctrl+\\)"
              labelClosed="Show chat list (Ctrl+\\)"
            />
            <nav className="text-secondary flex min-w-0 flex-1 items-center text-xs font-medium" aria-label="Location">
              Chat
            </nav>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {threadsLoaded ? activeConversation?.title ?? "Chat" : "Loading…"}
            </h1>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide sm:text-[11px] ${
                  chatStreaming ? "bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-[var(--primary)]" : "text-muted bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)]"
                }`}
              >
                {chatStreaming ? "Live" : "Idle"}
              </span>
              <span className="text-muted text-xs tabular-nums">
                {chatMessages.length} msg{chatMessages.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </header>

        {personas.length ? (
          <div className="mb-4 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_45%,transparent)] px-3 py-3 sm:px-4 sm:py-3.5">
            <label className="text-muted mb-2 block text-[11px] font-semibold uppercase tracking-wide">Persona</label>
            <select
              className="brand-input w-full rounded-lg px-3 py-2.5 text-sm"
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
            >
              <option value="">Default</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.description ? ` — ${p.description.slice(0, 40)}${p.description.length > 40 ? "…" : ""}` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--elevated)_50%,transparent)]">
          <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
            <div className="chat-transcript flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5 sm:gap-2.5 sm:pr-1">
              {!threadsLoaded ||
              (messagesLoading && activeConversation && activeConversation.messagesHydrated === false) ? (
                <ChatMessagesSkeleton />
              ) : chatMessages.length ? (
                chatMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`chat-bubble max-w-[min(100%,42rem)] rounded-2xl px-3 py-2.5 text-[13px] leading-snug sm:max-w-[min(92%,42rem)] ${
                      message.role === "user" ? "ml-auto brand-primary" : "mr-auto brand-card"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      chatStreaming &&
                      index === chatMessages.length - 1 &&
                      !message.content &&
                      !(message.citations && message.citations.length > 0) ? (
                        <InlineStatusPlaceholder status={chatStatus} activity={chatActivity} />
                      ) : (
                        (() => {
                          const { body, citations: fromFooter } = splitMessageCitations(message.content);
                          const citations = mergeCitationLists(message.citations ?? [], fromFooter);
                          return (
                            <AssistantMessageBody
                              content={body}
                              citations={citations.length ? citations : undefined}
                              conversationTitle={activeConversation?.title ?? ""}
                            />
                          );
                        })()
                      )
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-muted m-auto px-2 text-center text-sm">No messages yet.</p>
              )}
              <div ref={bottomAnchorRef} />
            </div>

            <div className="chat-composer mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:items-end sm:gap-2.5">
              <div className="flex min-w-0 flex-1 items-end gap-2">
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`chat-composer-voice-btn shrink-0 ${isListening ? "is-listening" : ""}`}
                  title={isListening ? "Stop" : "Voice"}
                  aria-label={isListening ? "Stop voice input" : "Start voice input"}
                >
                  {isListening ? <FiSquare className="size-[18px]" strokeWidth={2.5} /> : <FiMic className="size-5" strokeWidth={2.25} />}
                </button>
                <div className="flex min-w-0 min-h-0 flex-1 flex-row flex-wrap items-end gap-2">
                  <textarea
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={handleChatInputKeyDown}
                    placeholder={isListening ? "Listening…" : "Message…"}
                    rows={1}
                    className="surface-input min-h-[48px] max-h-36 min-w-0 w-full flex-1 resize-y rounded-xl px-3 py-3 text-sm leading-relaxed sm:min-w-0"
                  />
                  <div
                    ref={contextModeRef}
                    className="chat-context-dropdown shrink-0"
                    data-open={contextModeMenuOpen ? "true" : "false"}
                  >
                    <span
                      className="chat-context-dropdown-prefix inline-flex items-center gap-1"
                      id="chat-context-mode-label"
                    >
                      <LuMemoryStick className="size-3.5 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                      <span>Mode</span>
                    </span>
                    <button
                      type="button"
                      className="chat-context-dropdown-trigger"
                      aria-expanded={contextModeMenuOpen}
                      aria-haspopup="listbox"
                      aria-labelledby="chat-context-mode-label"
                      title="How many recent messages the model sees each turn"
                      onClick={() => setContextModeMenuOpen((o) => !o)}
                    >
                      <span className="chat-context-dropdown-trigger-value">
                        {CONTEXT_MODE_OPTIONS.find((o) => o.value === contextWindow)?.label ?? "mini"}
                      </span>
                      <FiChevronDown
                        className={`chat-context-dropdown-chevron h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                          contextModeMenuOpen ? "rotate-180" : ""
                        }`}
                        strokeWidth={2.5}
                        aria-hidden
                      />
                    </button>
                    {contextModeMenuOpen ? (
                      <ul className="chat-context-dropdown-menu" role="listbox" aria-label="Context window size">
                        {CONTEXT_MODE_OPTIONS.map((opt) => (
                          <li key={opt.value} role="presentation">
                            <button
                              type="button"
                              role="option"
                              className="chat-context-dropdown-option"
                              aria-selected={contextWindow === opt.value}
                              onClick={() => {
                                setContextWindow(opt.value);
                                setContextModeMenuOpen(false);
                              }}
                            >
                              <span className="chat-context-dropdown-option-title">{opt.label}</span>
                              <span className="chat-context-dropdown-option-hint">{opt.hint}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleChatSubmit()}
                disabled={
                  chatStreaming ||
                  !chatInput.trim() ||
                  !threadsLoaded ||
                  !activeConversation ||
                  (messagesLoading && activeConversation.messagesHydrated === false)
                }
                className="chat-send-btn flex h-12 w-full shrink-0 items-center justify-center gap-2 px-4 sm:h-[48px] sm:w-auto"
              >
                <FiSend className="size-4" strokeWidth={2.25} />
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      </WorkspaceMainColumn>
    </div>
  );
}
