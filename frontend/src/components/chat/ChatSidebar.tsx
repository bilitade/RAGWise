import type { MouseEvent } from "react";
import { FiMessageSquare, FiPlus, FiTrash2 } from "react-icons/fi";

import type { ChatConversation } from "../../types";
import { WorkspaceSidebarRail } from "../WorkspaceChrome";

type ChatSidebarProps = {
  open: boolean;
  conversations: ChatConversation[];
  activeConversationId: string;
  onOverlayDismiss: () => void;
  onCreateConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string, event: MouseEvent) => void;
};

export default function ChatSidebar({
  open,
  conversations,
  activeConversationId,
  onOverlayDismiss,
  onCreateConversation,
  onSelectConversation,
  onDeleteConversation,
}: ChatSidebarProps) {
  return (
    <WorkspaceSidebarRail sidebarId="chat-sidebar" open={open} onOverlayDismiss={onOverlayDismiss}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2.5 border-b border-[var(--border)] pb-3 text-[var(--data)]">
          <FiMessageSquare className="size-5 shrink-0" strokeWidth={2.25} />
          <span className="text-xs font-semibold uppercase tracking-wide">Conversations</span>
        </div>

        <button
          type="button"
          onClick={onCreateConversation}
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
                      onClick={() => onSelectConversation(conversation.id)}
                      className="min-w-0 flex-1 px-3 py-3 text-left"
                    >
                      <div className="truncate text-sm font-medium">{conversation.title}</div>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => onDeleteConversation(conversation.id, event)}
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
      </div>
    </WorkspaceSidebarRail>
  );
}
