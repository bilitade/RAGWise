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

function getStatusConfig(status: string): StatusConfig {
  const normalized = status.toLowerCase();

  if (normalized.includes("generating") || normalized.includes("file") || normalized.includes("artifact")) {
    return { icon: <FiFileText />, label: "Generating File", color: "var(--accent)", pulse: true };
  }
  if (normalized.includes("knowledge") || normalized.includes("retriev")) {
    return { icon: <FiDatabase />, label: "Retrieving Knowledge Base", color: "var(--primary)", pulse: true };
  }
  if (normalized.includes("web") || normalized.includes("internet") || normalized.includes("search")) {
    return { icon: <FiGlobe />, label: "Searching Web", color: "var(--data)", pulse: true };
  }
  if (normalized.includes("reasoning") || normalized.includes("result") || normalized.includes("thinking")) {
    return { icon: <FiCpu />, label: "Reasoning", color: "var(--primary)", pulse: true };
  }
  if (normalized.includes("draft") || normalized.includes("writing") || normalized.includes("answer")) {
    return { icon: <FiEdit2 />, label: "Drafting Answer", color: "var(--success)", pulse: true };
  }
  if (normalized.includes("finaliz")) {
    return { icon: <FiCheckCircle />, label: "Finalizing", color: "var(--success)", pulse: false };
  }
  if (normalized === "failed") {
    return { icon: <FiXCircle />, label: "Failed", color: "var(--error)", pulse: false };
  }

  // Fallback to "Thinking" instead of "Working"
  return { icon: <FiCpu />, label: "Thinking", color: "var(--primary)", pulse: true };
}

function InlineStatusPlaceholder({ status }: { status: string }) {
  const config = getStatusConfig(status);

  return (
    <div className="flex items-center gap-3 py-1.5 transition-all duration-500 ease-in-out">
      <div className="premium-status-ring" style={{ color: config.color }}>
        <div 
          className="h-1.5 w-1.5 rounded-full" 
          style={{ 
            background: config.color,
            animation: config.pulse ? "status-glow 1.5s ease-in-out infinite" : "none" 
          }}
        />
      </div>
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="shrink-0 text-sm opacity-80" style={{ color: config.color }}>
          {config.icon}
        </span>
        <span 
          key={config.label}
          className="status-label-animated text-[11px] font-black uppercase tracking-[0.08em]"
          style={{ color: config.color }}
        >
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
          !(message.citations && message.citations.length > 0) &&
          !message.reasoning;
        const assistantMessage = buildAssistantMessage(message, conversationTitle);

        return (
          <div
            key={`${message.role}-${index}`}
            className={`chat-bubble rounded-2xl text-[14px] leading-snug ${
              message.role === "user" ? "ml-auto w-[85%] sm:w-[60%] brand-primary px-3 py-2.5 sm:px-4 sm:py-3" : "w-full bg-transparent px-0 py-2 sm:py-4"
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
