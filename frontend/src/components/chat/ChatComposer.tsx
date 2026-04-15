import { useEffect, useRef } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { FiChevronDown, FiMic, FiSend, FiSquare } from "react-icons/fi";
import { LuBrain } from "react-icons/lu";

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
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textAreaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      if (chatInput.trim() === "") {
        textarea.style.height = "44px";
      } else {
        textarea.style.height = `${Math.min(scrollHeight, 200)}px`;
      }
    }
  }, [chatInput]);

  const canSubmit = !chatStreaming &&
    chatInput.trim() &&
    threadsLoaded &&
    hasActiveConversation &&
    !(messagesLoading && !activeConversationHydrated);

  return (
    <div className="chat-composer-container">
      <div className="chat-composer-inner">
        {/* Left Action: Microphone */}
        <button
          type="button"
          onClick={onToggleVoiceInput}
          className={`chat-composer-action-btn ${isListening ? "is-listening" : ""}`}
          title={isListening ? "Stop" : "Voice Input"}
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
        >
          {isListening ? (
            <FiSquare className="size-[18px]" strokeWidth={2.5} />
          ) : (
            <FiMic className="size-[18px]" strokeWidth={2.25} />
          )}
        </button>

        {/* Center Content: Expanding Textarea */}
        <textarea
          ref={textAreaRef}
          value={chatInput}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={isListening ? "Listening…" : "Ask anything…"}
          rows={1}
          className="chat-composer-textarea"
        />

        {/* Right Actions: Context Dropdown + Send */}
        <div className="chat-composer-actions-right">
          <div
            ref={contextModeRef}
            className="chat-context-dropdown"
            data-open={contextModeMenuOpen ? "true" : "false"}
          >
            <button
              type="button"
              className="chat-context-dropdown-trigger-unified"
              aria-expanded={contextModeMenuOpen}
              aria-haspopup="listbox"
              onClick={onToggleContextMenu}
              title="Memory Context Window"
            >
              <LuBrain className="size-3.5" strokeWidth={2.25} />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {CONTEXT_MODE_OPTIONS.find((opt) => opt.value === contextWindow)?.label}
              </span>
              <FiChevronDown className={`size-3 transition-transform ${contextModeMenuOpen ? "rotate-180" : ""}`} />
            </button>
            
            {contextModeMenuOpen && (
              <ul className="chat-context-dropdown-menu-unified" role="listbox">
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
            )}
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className={`chat-composer-send-btn ${canSubmit ? "is-active" : ""}`}
            title="Send Message"
          >
            <FiSend className="size-[18px]" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
