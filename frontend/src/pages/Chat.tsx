import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCheckCircle,
  FiClock,
  FiCpu,
  FiDatabase,
  FiEdit2,
  FiGlobe,
  FiLayers,
  FiMic,
  FiMicOff,
  FiMoon,
  FiPlus,
  FiSend,
  FiSettings,
  FiSquare,
  FiSun,
  FiXCircle,
} from "react-icons/fi";
import { LuPanelLeft } from "react-icons/lu";

import type { ChatConversation, ChatMessage, ThemeMode } from "../types";
import { API_BASE_URL, buildAuthHeaders, navigateTo } from "../utils";
import AssistantMessageBody from "../components/AssistantMessageBody";
import BrandWordmark from "../components/BrandWordmark";

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

const CHAT_SIDEBAR_STORAGE_KEY = "chat-sidebar-open";

function readSidebarOpen(): boolean {
  try {
    const v = localStorage.getItem(CHAT_SIDEBAR_STORAGE_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
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
        <span className="text-xs text-muted">{cfg.subtitle}</span>
      </div>
    </div>
  );
}

export default function Chat({
  theme,
  setTheme,
}: {
  theme: ThemeMode;
  setTheme: React.Dispatch<React.SetStateAction<ThemeMode>>;
}) {
  const [conversations, setConversations] = useState<ChatConversation[]>([
    {
      id: "chat-1",
      title: "New chat",
      messages: [],
      updatedAt: Date.now(),
    },
  ]);
  const [activeConversationId, setActiveConversationId] = useState("chat-1");
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatStatus, setChatStatus] = useState("Ready");
  const [chatActivity, setChatActivity] = useState<string[]>([]);
  const [personas, setPersonas] = useState<{ id: string; name: string; description: string }[]>([]);
  const [personaId, setPersonaId] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(readSidebarOpen);
  const recognitionRef = useRef<any>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_SIDEBAR_STORAGE_KEY, chatSidebarOpen ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [chatSidebarOpen]);

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
    () => conversations.find((item) => item.id === activeConversationId) ?? conversations[0],
    [activeConversationId, conversations],
  );
  const chatMessages = activeConversation?.messages ?? [];

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ block: "end" });
  }, [chatMessages, chatStreaming]);

  useEffect(() => {
    void fetch(`${API_BASE_URL}/api/personas`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPersonas(Array.isArray(data) ? data : []))
      .catch(() => setPersonas([]));
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

  function createConversation() {
    const id = `chat-${Date.now()}`;
    const conversation: ChatConversation = {
      id,
      title: "New chat",
      messages: [],
      updatedAt: Date.now(),
    };
    setConversations((current) => [conversation, ...current]);
    setActiveConversationId(id);
    setChatInput("");
    setChatStatus("Ready");
    setChatActivity([]);
  }

  async function handleChatSubmit() {
    if (!chatInput.trim() || chatStreaming || !activeConversation) return;
    const nextMessages: ChatMessage[] = [...chatMessages, { role: "user", content: chatInput }];
    updateActiveConversation((conversation) => ({
      ...conversation,
      title: buildConversationTitle(nextMessages),
      messages: [...nextMessages, { role: "assistant", content: "" }],
      updatedAt: Date.now(),
    }));
    setChatInput("");
    setChatStreaming(true);
    setChatStatus("Thinking");
    setChatActivity(["Thinking"]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers: buildAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          messages: nextMessages,
          persona_id: personaId || null,
        }),
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
            updateActiveConversation((conversation) => {
              const updated = [...conversation.messages];
              const lastIndex = updated.length - 1;
              updated[lastIndex] = {
                role: "assistant",
                content: `${updated[lastIndex]?.content ?? ""}${payload.text}`,
              };
              return { ...conversation, messages: updated, updatedAt: Date.now() };
            });
          }

          if (event === "status" && payload.label) {
            setChatStatus(payload.label);
            setChatActivity((current) =>
              current[current.length - 1] === payload.label ? current : [...current, payload.label],
            );
          }

          if (event === "error" && payload.error) {
            setChatStatus("Failed");
            updateActiveConversation((conversation) => {
              const updated = [...conversation.messages];
              updated[updated.length - 1] = { role: "assistant", content: payload.error ?? "Chat failed." };
              return { ...conversation, messages: updated, updatedAt: Date.now() };
            });
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

  const breadcrumbTitle =
    activeConversation?.title && activeConversation.title.length > 36
      ? `${activeConversation.title.slice(0, 36)}…`
      : activeConversation?.title ?? "Chat";

  return (
    <div className="chat-workspace-shell relative flex min-h-[calc(100vh-3rem)] flex-col gap-0 lg:flex-row lg:gap-0">
      {/* Mobile: dim overlay when sidebar open (tap to close) */}
      {chatSidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-30 bg-[color-mix(in_srgb,var(--text-primary)_12%,transparent)] backdrop-blur-[1px] lg:hidden"
          onClick={() => setChatSidebarOpen(false)}
        />
      ) : null}

      {/* Left rail — collapsible (ChatGPT-style); min-w-0 so flex can animate width to 0 */}
      <aside
        id="chat-sidebar"
        aria-hidden={!chatSidebarOpen}
        className={`chat-sidebar-rail relative z-40 min-w-0 shrink-0 overflow-hidden border-[var(--border)] transition-[width,max-width,opacity] duration-300 ease-out motion-reduce:transition-none ${
          chatSidebarOpen
            ? "flex w-full max-w-none border-b opacity-100 lg:z-auto lg:w-[300px] lg:max-w-[300px] lg:border-b-0 lg:border-r"
            : "pointer-events-none hidden max-h-0 max-w-0 border-0 opacity-0 lg:flex lg:max-h-none lg:w-0 lg:max-w-0 lg:border-0"
        }`}
      >
        <div className="brand-card flex h-[min(100vh-5rem,880px)] w-full min-w-[280px] max-w-[300px] flex-col rounded-none border-0 border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] p-4 sm:min-w-[300px] lg:sticky lg:top-6 lg:h-[min(calc(100vh-3rem),900px)] lg:max-h-none lg:rounded-[24px] lg:border lg:p-4">
          {/* Brand + primary new-chat action */}
          <div className="flex justify-end border-b border-[var(--border)] pb-3">
            <div className="min-w-0 pt-0.5 text-right [&_.brand-mark]:text-[clamp(1rem,2.8vw,1.35rem)]">
              <BrandWordmark />
            </div>
          </div>

          <button
            type="button"
            onClick={createConversation}
            className="brand-gradient mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-sm"
          >
            <FiPlus className="text-base" />
            New conversation
          </button>

          {/* Conversation list */}
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <p className="text-muted mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]">Chats</p>
            <div className="chat-history-list flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pr-0.5">
              {conversations
                .slice()
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map((conversation) => {
                  const active = conversation.id === activeConversationId;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setActiveConversationId(conversation.id)}
                      className={`w-full rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "border-[color-mix(in_srgb,var(--primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] shadow-[inset_3px_0_0_0_var(--primary)]"
                          : "border-transparent hover:bg-[color-mix(in_srgb,var(--elevated)_85%,transparent)]"
                      }`}
                    >
                      <div className="truncate text-sm font-semibold">{conversation.title}</div>
                      <div className="text-muted mt-1 line-clamp-2 text-[11px] leading-snug">
                        {conversation.messages.at(-1)?.content || "No messages yet"}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="text-muted mt-2 truncate border-t border-[var(--border)] pt-2 font-mono text-[9px]" title={API_BASE_URL}>
            {API_BASE_URL}
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="chat-main-column flex min-h-0 min-w-0 flex-1 flex-col px-0 pt-6 pb-8 lg:px-8 lg:pt-2 lg:pb-10">
        <header className="mb-5">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <button
                type="button"
                onClick={() => setChatSidebarOpen((o) => !o)}
                title={chatSidebarOpen ? "Hide chat list (Ctrl+\\)" : "Show chat list (Ctrl+\\)"}
                aria-label={chatSidebarOpen ? "Hide sidebar" : "Show sidebar"}
                aria-expanded={chatSidebarOpen}
                aria-controls="chat-sidebar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)] text-secondary transition-all hover:border-[color-mix(in_srgb,var(--primary)_35%,transparent)] hover:text-[var(--primary)] active:scale-[0.96] sm:h-10 sm:w-10"
              >
                <LuPanelLeft
                  className={`text-lg transition-transform duration-300 ease-out ${chatSidebarOpen ? "" : "scale-x-[-1]"}`}
                  strokeWidth={2}
                  aria-hidden
                />
              </button>
              <nav className="text-muted flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs font-medium" aria-label="Breadcrumb">
                <span className="rounded-md bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)] px-2 py-0.5">Assistant</span>
                <span className="text-[var(--border)]">/</span>
                <span className="text-secondary">Chat</span>
                <span className="text-[var(--border)]">/</span>
                <span
                  className="max-w-[min(200px,calc(100vw-14rem))] truncate text-[var(--text-primary)] sm:max-w-[min(200px,calc(100vw-19rem))]"
                  title={activeConversation?.title}
                >
                  {breadcrumbTitle}
                </span>
              </nav>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-1.5" role="toolbar" aria-label="Workspace shortcuts">
              <button
                type="button"
                onClick={() => navigateTo("/documents")}
                title="Knowledge base"
                aria-label="Knowledge base"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)] text-secondary transition-all hover:border-[color-mix(in_srgb,var(--data)_40%,transparent)] hover:text-[var(--data)] active:scale-[0.96] sm:h-10 sm:w-10"
              >
                <FiLayers className="text-base sm:text-lg" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setTheme((c) => (c === "dark" ? "light" : "dark"))}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)] text-secondary transition-all hover:border-[color-mix(in_srgb,var(--warning)_35%,transparent)] hover:text-[var(--warning)] active:scale-[0.96] sm:h-10 sm:w-10"
              >
                {theme === "dark" ? <FiSun className="text-base sm:text-lg" strokeWidth={2} /> : <FiMoon className="text-base sm:text-lg" strokeWidth={2} />}
              </button>
              <button
                type="button"
                onClick={() => navigateTo("/settings")}
                title="Admin settings"
                aria-label="Admin settings"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)] text-secondary transition-all hover:border-[color-mix(in_srgb,var(--primary)_40%,transparent)] hover:text-[var(--primary)] active:scale-[0.96] sm:h-10 sm:w-10"
              >
                <FiSettings className="text-base sm:text-lg" strokeWidth={2} />
              </button>
            </div>
          </div>
          <h1 className="mt-3 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {activeConversation?.title ?? "Chat"}
          </h1>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-secondary max-w-2xl text-sm leading-relaxed">
              Streaming responses with retrieval and web tools. Choose a persona below if your admin configured any.
            </p>
            <div className="flex shrink-0 flex-col items-end gap-2 sm:pt-0.5">
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                  chatStreaming ? "bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-[var(--primary)]" : "text-muted bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)]"
                }`}
              >
                {chatStreaming ? "Streaming" : "Idle"}
              </span>
              <span className="text-muted text-xs">
                {chatMessages.length} message{chatMessages.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </header>

        {personas.length ? (
          <div className="mb-5 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--elevated)_50%,transparent)] px-4 py-3 sm:flex sm:items-center sm:gap-4">
            <div className="min-w-0 shrink-0 sm:w-40">
              <div className="text-xs font-semibold text-[var(--text-primary)]">Agent persona</div>
              <div className="text-muted mt-0.5 text-[11px] leading-snug">Overrides the default system prompt for this chat.</div>
            </div>
            <select
              className="brand-input mt-3 w-full rounded-xl px-3 py-2.5 text-sm sm:mt-0 sm:max-w-md sm:flex-1"
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
            >
              <option value="">Default (built-in prompt)</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.description ? ` — ${p.description.slice(0, 40)}${p.description.length > 40 ? "…" : ""}` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="brand-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px]">
          <div className="brand-elevated flex min-h-0 flex-1 flex-col rounded-[20px] p-3 sm:p-4">
            <div className="chat-transcript flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
              {chatMessages.length ? (
                chatMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`chat-bubble max-w-[min(92%,42rem)] rounded-[16px] px-3 py-2 text-[13px] leading-5.5 ${
                      message.role === "user" ? "ml-auto brand-primary" : "mr-auto brand-card"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      chatStreaming && index === chatMessages.length - 1 && !message.content ? (
                        <InlineStatusPlaceholder status={chatStatus} activity={chatActivity} />
                      ) : (
                        <AssistantMessageBody content={message.content} conversationTitle={activeConversation.title} />
                      )
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </div>
                ))
              ) : (
                <div className="m-auto flex max-w-lg flex-col items-center gap-3 px-4 text-center">
                  <div className="brand-elevated rounded-2xl px-4 py-3 text-sm leading-relaxed text-secondary">
                    <strong className="text-[var(--text-primary)]">Tip:</strong> Ask about policies, products, or procedures in your
                    indexed docs. The agent can also search the web when something is not in the knowledge base.
                  </div>
                </div>
              )}
              <div ref={bottomAnchorRef} />
            </div>

            <div className="chat-composer mt-4 flex items-end gap-2.5 border-t border-[var(--border)] pt-4">
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`chat-composer-voice-btn shrink-0 ${isListening ? "is-listening" : ""}`}
                title={isListening ? "Stop listening" : "Start voice input"}
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
              >
                {isListening ? <FiSquare size={18} /> : <FiMic size={20} />}
              </button>

              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={handleChatInputKeyDown}
                placeholder={isListening ? "Listening…" : "Message the agent… (Enter to send, Shift+Enter for newline)"}
                rows={1}
                className="surface-input min-h-[48px] max-h-36 flex-1 resize-y rounded-[14px] px-3.5 py-3 text-[13px] leading-relaxed"
              />

              <button
                type="button"
                onClick={() => void handleChatSubmit()}
                disabled={chatStreaming || !chatInput.trim()}
                className="chat-send-btn h-[48px] shrink-0 px-4"
              >
                <FiSend size={16} />
                <span className="hidden sm:inline">Send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
