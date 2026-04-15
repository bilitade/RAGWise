import type { RefObject } from "react";
import { 
  FiCheckCircle, 
  FiClock, 
  FiCpu, 
  FiDatabase, 
  FiEdit2, 
  FiFileText, 
  FiGlobe, 
  FiUser,
  FiXCircle 
} from "react-icons/fi";

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
    <div className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-4">
      <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading messages">
        {[0.92, 0.78, 0.65].map((width, index) => (
          <div key={index} className="flex flex-col gap-4">
            <div className="h-4 w-24 animate-pulse rounded bg-[var(--border)]" />
            <div
              className="h-20 animate-pulse rounded-xl bg-[color-mix(in_srgb,var(--border)_55%,var(--elevated)_45%)]"
              style={{ width: `${width * 100}%` }}
            />
          </div>
        ))}
      </div>
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
      <div className="chat-transcript flex min-h-0 flex-1 flex-col overflow-y-auto pb-36 sm:pb-48">
        <p className="text-muted m-auto px-4 text-center text-sm">No messages yet. Ask anything to start!</p>
        <div ref={bottomAnchorRef} />
      </div>
    );
  }

  return (
    <div className="chat-transcript flex min-h-0 flex-1 flex-col overflow-y-auto pb-36 sm:pb-48">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-3 py-5 sm:px-4">
        {chatStreaming && (
          <div className="sticky top-0 z-10 mx-auto mb-2 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_96%,transparent)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-secondary">
            {chatStatus}
          </div>
        )}

        {chatMessages.map((message, index) => {
          const isStreamingPlaceholder =
            chatStreaming &&
            index === chatMessages.length - 1 &&
            !message.content &&
            !(message.citations && message.citations.length > 0) &&
            !message.reasoning;
          
          const assistantMessage = buildAssistantMessage(message, conversationTitle);
          const isUser = message.role === "user";

          return (
            <div
              key={`${message.role}-${index}`}
              className="flex w-full flex-col gap-1.5"
            >
              <div className="flex items-center gap-2 px-0.5">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    isUser
                      ? "bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] text-[var(--primary)]"
                      : "bg-[color-mix(in_srgb,var(--text-muted)_20%,transparent)] text-secondary"
                  }`}
                >
                  {isUser ? <FiUser className="size-3.5" /> : <FiCpu className="size-3.5" />}
                </div>
                <span className="text-xs font-semibold text-secondary">{isUser ? "You" : "Assistant"}</span>
              </div>

              <div className="min-w-0 pl-0">
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
                  <div className="whitespace-pre-wrap rounded-2xl bg-[color-mix(in_srgb,var(--elevated)_88%,transparent)] px-3.5 py-2.5 text-[15px] leading-[1.65] text-[var(--text-primary)]">
                    {message.content}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomAnchorRef} />
      </div>
    </div>
  );
}
