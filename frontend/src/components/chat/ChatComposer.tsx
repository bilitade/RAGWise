import type { KeyboardEvent, RefObject } from "react";
import { FiChevronDown, FiMic, FiSend, FiSquare } from "react-icons/fi";
import { LuMemoryStick } from "react-icons/lu";

import type { ChatContextWindow } from "../../types";

export const CONTEXT_MODE_OPTIONS: { value: ChatContextWindow; label: string; hint: string }[] = [
  { value: "min", label: "mini", hint: "5 messages" },
  { value: "medium", label: "mid", hint: "10 messages" },
  { value: "max", label: "max", hint: "15 messages" },
];

type ChatComposerProps = {
  chatInput: string;
  chatStreaming: boolean;
  isListening: boolean;
  threadsLoaded: boolean;
  messagesLoading: boolean;
  hasActiveConversation: boolean;
  activeConversationHydrated: boolean;
  contextWindow: ChatContextWindow;
  contextModeMenuOpen: boolean;
  contextModeRef: RefObject<HTMLDivElement | null>;
  onInputChange: (value: string) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onToggleVoiceInput: () => void;
  onSubmit: () => void;
  onToggleContextMenu: () => void;
  onSelectContextWindow: (value: ChatContextWindow) => void;
};

export default function ChatComposer({
  chatInput,
  chatStreaming,
  isListening,
  threadsLoaded,
  messagesLoading,
  hasActiveConversation,
  activeConversationHydrated,
  contextWindow,
  contextModeMenuOpen,
  contextModeRef,
  onInputChange,
  onInputKeyDown,
  onToggleVoiceInput,
  onSubmit,
  onToggleContextMenu,
  onSelectContextWindow,
}: ChatComposerProps) {
  return (
    <div className="chat-composer mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:items-end sm:gap-2.5">
      <div className="flex min-w-0 flex-1 items-end gap-2">
        <button
          type="button"
          onClick={onToggleVoiceInput}
          className={`chat-composer-voice-btn shrink-0 ${isListening ? "is-listening" : ""}`}
          title={isListening ? "Stop" : "Voice"}
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
        >
          {isListening ? <FiSquare className="size-[18px]" strokeWidth={2.5} /> : <FiMic className="size-5" strokeWidth={2.25} />}
        </button>
        <div className="flex min-w-0 min-h-0 flex-1 flex-row flex-wrap items-end gap-2">
          <textarea
            value={chatInput}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={isListening ? "Listening…" : "Message…"}
            rows={1}
            className="surface-input min-h-[48px] max-h-36 min-w-0 w-full flex-1 resize-y rounded-xl px-3 py-3 text-sm leading-relaxed sm:min-w-0"
          />
          <div
            ref={contextModeRef}
            className="chat-context-dropdown shrink-0"
            data-open={contextModeMenuOpen ? "true" : "false"}
          >
            <span className="chat-context-dropdown-prefix inline-flex items-center gap-1" id="chat-context-mode-label">
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
              onClick={onToggleContextMenu}
            >
              <span className="chat-context-dropdown-trigger-value">
                {CONTEXT_MODE_OPTIONS.find((option) => option.value === contextWindow)?.label ?? "mini"}
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
                {CONTEXT_MODE_OPTIONS.map((option) => (
                  <li key={option.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      className="chat-context-dropdown-option"
                      aria-selected={contextWindow === option.value}
                      onClick={() => onSelectContextWindow(option.value)}
                    >
                      <span className="chat-context-dropdown-option-title">{option.label}</span>
                      <span className="chat-context-dropdown-option-hint">{option.hint}</span>
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
        onClick={onSubmit}
        disabled={
          chatStreaming ||
          !chatInput.trim() ||
          !threadsLoaded ||
          !hasActiveConversation ||
          (messagesLoading && !activeConversationHydrated)
        }
        className="chat-send-btn flex h-12 w-full shrink-0 items-center justify-center gap-2 px-4 sm:h-[48px] sm:w-auto"
      >
        <FiSend className="size-4" strokeWidth={2.25} />
        <span>Send</span>
      </button>
    </div>
  );
}
