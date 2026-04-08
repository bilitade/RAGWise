import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCheckCircle,
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
  FiXCircle,
} from "react-icons/fi";

import type { ChatConversation, ChatMessage } from "../types";
import { API_BASE_URL, buildAuthHeaders, CHAT_SIDEBAR_KEY, readSidebarPreference, writeSidebarPreference } from "../utils";
import AssistantMessageBody from "../components/AssistantMessageBody";
import { SidebarToggleButton, WorkspaceMainColumn, WorkspaceSidebarRail } from "../components/WorkspaceChrome";

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

export default function Chat() {
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
  const [chatSidebarOpen, setChatSidebarOpen] = useState(() => readSidebarPreference(CHAT_SIDEBAR_KEY));
  const recognitionRef = useRef<any>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    writeSidebarPreference(CHAT_SIDEBAR_KEY, chatSidebarOpen);
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
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => setActiveConversationId(conversation.id)}
                      className={`w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "border-[color-mix(in_srgb,var(--primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
                          : "border-transparent hover:bg-[color-mix(in_srgb,var(--elevated)_70%,transparent)]"
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
            <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight sm:text-2xl">{activeConversation?.title ?? "Chat"}</h1>
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
              {chatMessages.length ? (
                chatMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`chat-bubble max-w-[min(100%,42rem)] rounded-2xl px-3 py-2.5 text-[13px] leading-snug sm:max-w-[min(92%,42rem)] ${
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
                <textarea
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={handleChatInputKeyDown}
                  placeholder={isListening ? "Listening…" : "Message…"}
                  rows={1}
                  className="surface-input min-h-[48px] max-h-36 min-w-0 flex-1 resize-y rounded-xl px-3 py-3 text-sm leading-relaxed"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleChatSubmit()}
                disabled={chatStreaming || !chatInput.trim()}
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
