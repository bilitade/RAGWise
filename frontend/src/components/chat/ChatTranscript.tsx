import type { RefObject } from "react";
import { FiCheckCircle, FiClock, FiCpu, FiDatabase, FiEdit2, FiFileText, FiGlobe, FiXCircle } from "react-icons/fi";

import AssistantMessageBody from "../AssistantMessageBody";
import type { ChatCitation, ChatMessage } from "../../types";
import { mergeCitationLists, splitMessageCitations } from "../../utils";

type StatusConfig = {
  icon: React.ReactNode;
  label: string;
  color: string;
  pulse: boolean;
};

function getStatusConfig(status: string, streaming: boolean): StatusConfig {
  const normalized = status.toLowerCase();

  if (normalized.includes("generating") || normalized.includes("file") || normalized.includes("artifact")) {
    return { icon: <FiFileText />, label: "Generating File", color: "var(--accent)", pulse: true };
  }
  if (normalized.includes("knowledge") || normalized.includes("retriev")) {
    return { icon: <FiDatabase />, label: "Retrieving KB", color: "var(--primary)", pulse: true };
  }
  if (normalized.includes("web") || normalized.includes("internet") || normalized.includes("search")) {
    return { icon: <FiGlobe />, label: "Web Search", color: "var(--data)", pulse: true };
  }
  if (normalized.includes("reasoning") || normalized.includes("result")) {
    return { icon: <FiCpu />, label: "Reasoning", color: "var(--primary)", pulse: true };
  }
  if (normalized.includes("draft") || normalized.includes("writing")) {
    return { icon: <FiEdit2 />, label: "Drafting", color: "var(--success)", pulse: true };
  }
  if (normalized.includes("finaliz")) {
    return { icon: <FiCheckCircle />, label: "Finalizing", color: "var(--success)", pulse: false };
  }
  if (normalized.includes("think")) {
    return { icon: <FiCpu />, label: "Thinking", color: "var(--primary)", pulse: true };
  }
  if (normalized === "failed") {
    return { icon: <FiXCircle />, label: "Failed", color: "var(--error)", pulse: false };
  }
  if (streaming) {
    return { icon: <FiClock />, label: "Working", color: "var(--accent)", pulse: true };
  }
  return { icon: <FiCheckCircle />, label: "Ready", color: "var(--success)", pulse: false };
}

function InlineStatusPlaceholder({ status }: { status: string }) {
  const config = getStatusConfig(status, true);

  return (
    <div className="flex flex-col gap-2 py-0.5">
      <div className="flex items-center gap-2">
        <span
          className="agent-status-dot shrink-0"
          style={{
            background: config.color,
            animation: config.pulse ? "status-pulse 1.4s ease-in-out infinite" : "none",
          }}
        />
        <span className="shrink-0 text-sm" style={{ color: config.color }}>
          {config.icon}
        </span>
        <span className="text-xs font-semibold" style={{ color: config.color }}>
          {config.label}
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
      {[0.92, 0.78, 0.65].map((width, index) => (
        <div
          key={index}
          className="h-14 max-w-[min(100%,85%)] animate-pulse rounded-2xl bg-[color-mix(in_srgb,var(--border)_55%,var(--elevated)_45%)]"
          style={{ width: `${width * 100}%` }}
        />
      ))}
    </div>
  );
}

function buildAssistantMessage(
  message: ChatMessage,
  conversationTitle: string,
): { body: string; citations?: ChatCitation[] } {
  const { body, citations: footerCitations } = splitMessageCitations(message.content);
  const citations = mergeCitationLists(message.citations ?? [], footerCitations);
  return {
    body,
    citations: citations.length ? citations : undefined,
  };
}

type ChatTranscriptProps = {
  threadsLoaded: boolean;
  messagesLoading: boolean;
  activeConversationHydrated: boolean;
  chatMessages: ChatMessage[];
  chatStreaming: boolean;
  chatStatus: string;
  conversationTitle: string;
  bottomAnchorRef: RefObject<HTMLDivElement | null>;
};

export default function ChatTranscript({
  threadsLoaded,
  messagesLoading,
  activeConversationHydrated,
  chatMessages,
  chatStreaming,
  chatStatus,
  conversationTitle,
  bottomAnchorRef,
}: ChatTranscriptProps) {
  if (!threadsLoaded || (messagesLoading && !activeConversationHydrated)) {
    return <ChatMessagesSkeleton />;
  }

  if (!chatMessages.length) {
    return (
      <div className="chat-transcript flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5 sm:gap-2.5 sm:pr-1">
        <p className="text-muted m-auto px-2 text-center text-sm">No messages yet.</p>
        <div ref={bottomAnchorRef} />
      </div>
    );
  }

  return (
    <div className="chat-transcript flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-0.5 sm:gap-2.5 sm:pr-1">
      {chatStreaming ? (
        <div className="sticky top-0 z-10 mr-auto mb-2 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] px-3 py-1 text-[11px] font-semibold tracking-wide text-[var(--text-secondary)] backdrop-blur">
          {chatStatus}
        </div>
      ) : null}
      {chatMessages.map((message, index) => {
        const isStreamingPlaceholder =
          chatStreaming &&
          index === chatMessages.length - 1 &&
          !message.content &&
          !(message.citations && message.citations.length > 0);
        const assistantMessage = buildAssistantMessage(message, conversationTitle);

        return (
          <div
            key={`${message.role}-${index}`}
            className={`chat-bubble max-w-[min(100%,42rem)] rounded-2xl px-3 py-2.5 text-[13px] leading-snug sm:max-w-[min(92%,42rem)] ${
              message.role === "user" ? "ml-auto brand-primary" : "mr-auto brand-card"
            }`}
          >
            {message.role === "assistant" ? (
              isStreamingPlaceholder ? (
                <InlineStatusPlaceholder status={chatStatus} />
              ) : (
                <AssistantMessageBody
                  content={assistantMessage.body}
                  citations={assistantMessage.citations}
                  reasoning={message.reasoning}
                  conversationTitle={conversationTitle}
                />
              )
            ) : (
              <div className="whitespace-pre-wrap">{message.content}</div>
            )}
          </div>
        );
      })}
      <div ref={bottomAnchorRef} />
    </div>
  );
}
