import { useEffect, useMemo, useRef, useState } from "react";

import type { ChatContextWindow, ChatCitation, ChatConversation, ChatMessage } from "../types";
import {
  API_BASE_URL,
  buildAuthHeaders,
  CHAT_SIDEBAR_KEY,
  getAccessToken,
  isServerChatThreadId,
  mergeCitationLists,
  readSidebarPreference,
  writeSidebarPreference,
} from "../utils";
import { SidebarToggleButton, WorkspaceMainColumn } from "../components/WorkspaceChrome";
import ChatComposer from "../components/chat/ChatComposer";
import ChatSidebar from "../components/chat/ChatSidebar";
import ChatTranscript from "../components/chat/ChatTranscript";

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
  const [messagesLoading, setMessagesLoading] = useState(false);
  const threadMessagesFetchId = useRef(0);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatStatus, setChatStatus] = useState("Ready");
  const [contextWindow, setContextWindow] = useState<ChatContextWindow>("min");
  const [contextModeMenuOpen, setContextModeMenuOpen] = useState(false);
  const contextModeRef = useRef<HTMLDivElement | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [chatSidebarOpen, setChatSidebarOpen] = useState(() => readSidebarPreference(CHAT_SIDEBAR_KEY));
  const recognitionRef = useRef<any>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);
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

    const requestBody = serverThread
      ? {
          messages: [{ role: "user" as const, content: trimmed }],
          thread_id: activeConversation.id,
          context_window: contextWindow,
        }
      : {
          messages: nextMessages,
          context_window: contextWindow,
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

          if (event === "reasoning" && typeof payload.text === "string" && payload.text) {
            updateActiveConversation((conversation) => {
              const updated = [...conversation.messages];
              const lastIndex = updated.length - 1;
              const prev = updated[lastIndex];
              updated[lastIndex] = {
                ...prev,
                role: "assistant",
                reasoning: `${prev?.reasoning ?? ""}${payload.text}`,
              };
              return { ...conversation, messages: updated, updatedAt: Date.now() };
            });
          }

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

          if (event === "done" && typeof payload.final_text === "string" && payload.final_text) {
            updateActiveConversation((conversation) => {
              const updated = [...conversation.messages];
              const lastIndex = updated.length - 1;
              const previous = updated[lastIndex];
              updated[lastIndex] = {
                ...previous,
                role: "assistant",
                content: payload.final_text as string,
              };
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
      <ChatSidebar
        open={chatSidebarOpen}
        apiBaseUrl={API_BASE_URL}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onOverlayDismiss={() => setChatSidebarOpen(false)}
        onCreateConversation={() => void createConversation()}
        onSelectConversation={(id) => void selectConversation(id)}
        onDeleteConversation={(id, event) => void deleteConversation(id, event)}
      />

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

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--border)_70%,transparent)] bg-[color-mix(in_srgb,var(--elevated)_50%,transparent)]">
          <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
            <ChatTranscript
              threadsLoaded={threadsLoaded}
              messagesLoading={messagesLoading}
              activeConversationHydrated={activeConversation?.messagesHydrated !== false}
              chatMessages={chatMessages}
              chatStreaming={chatStreaming}
              chatStatus={chatStatus}
              conversationTitle={activeConversation?.title ?? ""}
              bottomAnchorRef={bottomAnchorRef}
            />

            <ChatComposer
              chatInput={chatInput}
              chatStreaming={chatStreaming}
              isListening={isListening}
              threadsLoaded={threadsLoaded}
              messagesLoading={messagesLoading}
              hasActiveConversation={!!activeConversation}
              activeConversationHydrated={activeConversation?.messagesHydrated !== false}
              contextWindow={contextWindow}
              contextModeMenuOpen={contextModeMenuOpen}
              contextModeRef={contextModeRef}
              onInputChange={setChatInput}
              onInputKeyDown={handleChatInputKeyDown}
              onToggleVoiceInput={toggleVoiceInput}
              onSubmit={() => void handleChatSubmit()}
              onToggleContextMenu={() => setContextModeMenuOpen((open) => !open)}
              onSelectContextWindow={(value) => {
                setContextWindow(value);
                setContextModeMenuOpen(false);
              }}
            />
          </div>
        </div>
      </WorkspaceMainColumn>
    </div>
  );
}
