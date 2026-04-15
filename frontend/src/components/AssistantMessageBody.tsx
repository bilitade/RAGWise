import { FiChevronDown, FiChevronUp, FiCpu, FiDatabase, FiDownload, FiFileText, FiGlobe } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ChatCitation } from "../types";
import {
  downloadTextFile,
  getAssistantMessageDownloadPayload,
  normalizeFenceLanguage,
} from "../utils";
import ChatFileBlock from "./ChatFileBlock";

import { useMemo, useState } from "react";

export default function AssistantMessageBody({
  content,
  citations,
  reasoning,
  conversationTitle,
}: {
  content: string;
  citations?: ChatCitation[];
  reasoning?: string;
  conversationTitle: string;
}) {
  const [reasoningExpanded, setReasoningExpanded] = useState(true);
  let codeBlockIndex = 0;
  const downloadableMessage = getAssistantMessageDownloadPayload(content);

  const displayContent = content.replace(/\[DOWNLOAD_FILE:\s*[^\]]+\]/i, "").trim();

  const isRawJson = useMemo(() => {
    const trimmed = displayContent.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}") && !content.includes("```")) {
      try {
        JSON.parse(trimmed);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }, [displayContent, content]);

  const hasInternalCodeBlocks = content.includes("```");
  const showSuggestedDocument = !!downloadableMessage && !hasInternalCodeBlocks && !isRawJson;

  return (
    <div className="chat-markdown">
      {reasoning ? (
        <div className="mb-4 overflow-hidden rounded-r-xl border-l-4 border-l-[var(--primary)] border-y border-r border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]">
          <button
            type="button"
            onClick={() => setReasoningExpanded(!reasoningExpanded)}
            className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
          >
            <div className="flex items-center gap-2">
              <FiCpu className="size-3.5" />
              <span>Thought Process</span>
            </div>
            {reasoningExpanded ? <FiChevronUp /> : <FiChevronDown />}
          </button>
          {reasoningExpanded && (
            <div className="border-t border-[color-mix(in_srgb,var(--primary)_10%,transparent)] px-3 py-2.5 text-[12px] leading-relaxed text-[var(--text-secondary)] italic">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{reasoning}</ReactMarkdown>
            </div>
          )}
        </div>
      ) : null}

      {showSuggestedDocument ? (
        <div className="chat-artifact-suggestion brand-elevated mx-auto mb-6 flex max-w-[90%] items-center justify-between gap-4 rounded-2xl p-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="chat-artifact-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white">
              <FiFileText className="size-5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Document</div>
              <div className="truncate text-sm font-semibold">{downloadableMessage.spec.filename}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                downloadableMessage.spec,
                downloadableMessage.content,
              )
            }
            className="brand-primary shrink-0 flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all hover:scale-105 active:scale-95"
          >
            <FiDownload />
            Download
          </button>
        </div>
      ) : null}

      {isRawJson ? (
        <ChatFileBlock
          language="json"
          content={displayContent.trim()}
          index={999}
          baseName={conversationTitle}
        />
      ) : (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            pre: ({ children }) => <>{children}</>,
            code: ({ className, children, ...props }: any) => {
              const code = String(children ?? "");
              const language = normalizeFenceLanguage(className);
              const isInline = !className && !code.includes("\n");

              if (isInline) {
                return (
                  <code className="chat-inline-code" {...props}>
                    {children}
                  </code>
                );
              }

              const currentIndex = codeBlockIndex;
              codeBlockIndex += 1;

              return (
                <ChatFileBlock
                  language={language}
                  content={code.replace(/\n$/, "")}
                  index={currentIndex}
                  baseName={conversationTitle}
                />
              );
            },
          }}
        >
          {displayContent}
        </ReactMarkdown>
      )}

      {citations && citations.length > 0 ? (
        <div className="chat-sources mt-6 border-t border-[var(--border)] pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-muted text-[10px] font-bold uppercase tracking-widest">Sources & Citations</div>
            <div className="flex gap-2">
              <span className="flex items-center gap-1 text-[9px] font-medium text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] opacity-60" /> Knowledge base
              </span>
              <span className="flex items-center gap-1 text-[9px] font-medium text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--data)] opacity-60" /> Web
              </span>
            </div>
          </div>
          
          <div className="chat-sources-grid grid grid-cols-1 gap-2 sm:grid-cols-2">
            {citations.map((c, i) => (
              <div
                key={`${c.kind}-${c.label}-${c.url ?? c.ref ?? i}`}
                className="chat-source-card group flex flex-col rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_40%,transparent)] p-3 transition-all hover:border-[color-mix(in_srgb,var(--primary)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--surface)_80%,transparent)]"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={`inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-black uppercase tracking-tighter ${
                      c.kind === "web"
                        ? "bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]"
                        : "bg-[color-mix(in_srgb,var(--data)_12%,transparent)] text-[var(--data)]"
                    }`}
                  >
                    {c.kind === "web" ? "Web" : "KB"}
                  </span>
                  <span className="text-muted group-hover:text-[var(--primary)] transition-colors">
                    {c.kind === "web" ? <FiGlobe className="size-3" /> : <FiDatabase className="size-3" />}
                  </span>
                </div>
                
                <div className="min-w-0 flex-1">
                  {c.kind === "web" && c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-[12px] font-semibold text-[var(--text-primary)] hover:text-[var(--primary)]"
                    >
                      {c.label}
                    </a>
                  ) : (
                    <span className="block truncate text-[12px] font-semibold text-[var(--text-primary)]">{c.label}</span>
                  )}
                  {c.detail ? (
                    <p className="text-muted mt-1.5 line-clamp-2 text-[10px] leading-normal opacity-80 group-hover:opacity-100 transition-opacity">
                      {c.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
