import { useEffect, useMemo, useRef, useState } from "react";
import {
  FiCheckCircle,
  FiClock,
  FiCpu,
  FiDatabase,
  FiEdit2,
  FiFileText,
  FiGlobe,
  FiMessageSquare,
  FiMoon,
  FiPlus,
  FiSend,
  FiSun,
  FiXCircle,
} from "react-icons/fi";

import type { ChatConversation, ChatMessage, ThemeMode } from "../types";
import { API_BASE_URL, navigateTo } from "../utils";
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
      color: "var(--accent)",
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
      color: "var(--accent)",
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
      color: "var(--accent)",
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

// ── InlineStatusPlaceholder ───────────────────────────────────────────────────
// Shown inside the last assistant bubble while streaming but content is still empty
function InlineStatusPlaceholder({
  status,
  activity,
}: {
  status: string;
  activity: string[];
}) {
  const cfg = getStatusConfig(status, true);

  return (
    <div className="flex flex-col gap-2 py-0.5">
      {/* Current status */}
      <div className="flex items-center gap-2">
        {/* Pulsing dot */}
        <span
          className="agent-status-dot shrink-0"
          style={{
            background: cfg.color,
            animation: cfg.pulse ? "status-pulse 1.4s ease-in-out infinite" : "none",
          }}
        />
        {/* Icon */}
        <span className="shrink-0 text-sm" style={{ color: cfg.color }}>
          {cfg.icon}
        </span>
        {/* Label + subtitle */}
        <span className="text-xs font-semibold" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
        <span className="text-xs text-muted">{cfg.subtitle}</span>
      </div>

      {/* Activity trail — previous steps */}
      {activity.length > 1 && (
        <div className="flex flex-wrap items-center gap-1">
          {activity.slice(0, -1).map((step, i) => (
            <span
              key={`${step}-${i}`}
              className="rounded-full px-2 py-0.5 text-[10px] text-muted"
              style={{ background: "var(--surface)" }}
            >
              {step}
            </span>
          ))}
          <span className="text-[10px] text-muted">→ {activity[activity.length - 1]}</span>
        </div>
      )}
    </div>
  );
}


// ── Chat page ────────────────────────────────────────────────────────────────
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
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? conversations[0],
    [activeConversationId, conversations],
  );
  const chatMessages = activeConversation?.messages ?? [];

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ block: "end" });
  }, [chatMessages, chatStreaming]);

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
              current[current.length - 1] === payload.label
                ? current
                : [...current, payload.label],
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

  return (
    <section className="chat-workspace mx-auto flex h-[calc(100vh-5.5rem)] min-h-[36rem] w-full max-w-7xl flex-col gap-3">
      <header className="brand-card chat-topbar flex items-center justify-between gap-3 rounded-[22px] px-4 py-3">
        <div className="flex items-center gap-3">
          <BrandWordmark />
          <div className="hidden h-6 w-px bg-[var(--border)] sm:block" />
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => navigateTo("/documents")}
              className="brand-secondary flex items-center gap-2 rounded-[14px] px-3 py-2 text-sm"
            >
              <FiFileText />
              Documents
            </button>
            <button type="button" className="brand-pill-active flex items-center gap-2 rounded-[14px] px-3 py-2 text-sm">
              <FiMessageSquare />
              Chat
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={createConversation}
            className="brand-secondary flex items-center gap-2 rounded-[14px] px-3 py-2 text-sm"
          >
            <FiPlus />
            New chat
          </button>
          <button
            type="button"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            className="brand-secondary flex items-center gap-2 rounded-[14px] px-3 py-2 text-sm"
          >
            {theme === "dark" ? <FiSun /> : <FiMoon />}
            <span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"}</span>
          </button>
        </div>
      </header>

      <div className="chat-panels grid min-h-0 flex-1 gap-3">
        {/* Conversation sidebar */}
        <aside className="brand-card chat-history-panel flex min-h-0 flex-col rounded-[22px] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Chats</div>
              <div className="text-xs text-secondary">
                {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <div className="chat-history-list flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            {conversations
              .slice()
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setActiveConversationId(conversation.id)}
                  className={`chat-history-item text-left ${conversation.id === activeConversationId ? "chat-history-item-active" : ""}`}
                >
                  <div className="truncate text-sm font-medium">{conversation.title}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-secondary">
                    {conversation.messages.at(-1)?.content || "Start a new conversation"}
                  </div>
                </button>
              ))}
          </div>
        </aside>

        {/* Main chat panel */}
        <div className="brand-card flex min-h-0 flex-col overflow-hidden rounded-[22px] p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-medium">{activeConversation?.title ?? "Chat"}</h2>
              <p className="text-xs text-secondary">Streaming assistant interface for grounded answers.</p>
            </div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
              {chatStreaming
                ? <span className="status-data">Streaming</span>
                : `${chatMessages.length} message${chatMessages.length === 1 ? "" : "s"}`}
            </div>
          </div>


          <div className="brand-elevated chat-shell flex min-h-0 flex-1 flex-col rounded-[20px] p-3">
            {/* ── Transcript ── */}
            <div ref={transcriptRef} className="chat-transcript flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
              {chatMessages.length ? (
                chatMessages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`chat-bubble max-w-[82%] rounded-[16px] px-3 py-2 text-[13px] leading-5.5 ${
                      message.role === "user" ? "ml-auto brand-primary" : "brand-card"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      /* Show inline status placeholder when streaming and no content yet */
                      chatStreaming && index === chatMessages.length - 1 && !message.content ? (
                        <InlineStatusPlaceholder
                          status={chatStatus}
                          activity={chatActivity}
                        />
                      ) : (
                        <AssistantMessageBody 
                          content={message.content} 
                          conversationTitle={activeConversation.title}
                        />
                      )
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </div>
                ))
              ) : (
                <div className="m-auto max-w-md text-center text-sm leading-6 text-secondary">
                  Start a conversation about company policy, banking FAQ, internal procedures, or
                  current public information.
                </div>
              )}
              <div ref={bottomAnchorRef} />
            </div>

            {/* ── Composer ── */}
            <div className="chat-composer mt-2.5 flex gap-2">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={handleChatInputKeyDown}
                placeholder="Ask the agent anything relevant to the bank or current public context."
                rows={2}
                className="surface-input min-h-[56px] max-h-32 flex-1 rounded-[18px] px-3 py-2.5 text-[13px]"
              />
              <button
                onClick={handleChatSubmit}
                disabled={chatStreaming || !chatInput.trim()}
                className="brand-gradient self-end rounded-[16px] px-3.5 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <FiSend />
                  Send
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
