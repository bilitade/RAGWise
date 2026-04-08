import { useMemo } from "react";
import { FiDatabase, FiDownload, FiFileText, FiGlobe } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ChatCitation } from "../types";
import {
  downloadTextFile,
  getAssistantMessageDownloadPayload,
  normalizeFenceLanguage,
} from "../utils";
import ChatFileBlock from "./ChatFileBlock";

export default function AssistantMessageBody({
  content,
  citations,
  conversationTitle,
}: {
  content: string;
  citations?: ChatCitation[];
  conversationTitle: string;
}) {
  let codeBlockIndex = 0;
  const downloadableMessage = getAssistantMessageDownloadPayload(content);

  // Strip the marker from the visible content
  const displayContent = content.replace(/\[DOWNLOAD_FILE:\s*[^\]]+\]/i, "").trim();

  // Safety net: if the content looks like raw JSON but isn't wrapped in a code block, wrap it.
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

  // Determine if we should show the top-level suggested document card.
  // We only show it if there ARE NO internal code blocks and no "raw JSON" wrapped.
  const hasInternalCodeBlocks = content.includes("```");
  const showSuggestedDocument = !!downloadableMessage && !hasInternalCodeBlocks && !isRawJson;

  return (
    <div className="chat-markdown">
      {showSuggestedDocument ? (
        <div className="chat-artifact-suggestion brand-elevated mb-4 flex items-center justify-between gap-4 rounded-2xl p-3.5">
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
        <div className="chat-sources mt-4 border-t border-[var(--border)] pt-3">
          <div className="text-muted mb-1 text-[10px] font-semibold uppercase tracking-wide">Citations</div>
          <p className="text-muted mb-2 text-[11px] leading-snug">
            Retrieved references below are labeled as <strong className="text-[var(--text-secondary)]">Knowledge base</strong> (indexed documents) or{" "}
            <strong className="text-[var(--text-secondary)]">Web</strong> (external search).
          </p>
          <ul className="chat-sources-list m-0 flex list-none flex-col gap-2 p-0">
            {citations.map((c, i) => (
              <li
                key={`${c.kind}-${c.label}-${c.url ?? c.ref ?? i}`}
                className="chat-source-item rounded-lg border border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_75%,transparent)] px-2.5 py-2 text-[12px] leading-snug"
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`inline-flex shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                      c.kind === "web"
                        ? "bg-[color-mix(in_srgb,var(--primary)_18%,transparent)] text-[var(--primary)]"
                        : "bg-[color-mix(in_srgb,var(--data)_16%,transparent)] text-[var(--data)]"
                    }`}
                  >
                    {c.kind === "web" ? "Web" : "Knowledge base"}
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-muted mt-0.5 shrink-0" aria-hidden>
                    {c.kind === "web" ? <FiGlobe className="size-3.5" strokeWidth={2.25} /> : <FiDatabase className="size-3.5" strokeWidth={2.25} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    {c.kind === "web" && c.url ? (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[var(--primary)] underline decoration-[color-mix(in_srgb,var(--primary)_40%,transparent)] underline-offset-2 hover:decoration-[var(--primary)]"
                      >
                        {c.label}
                      </a>
                    ) : (
                      <span className="font-semibold text-[var(--text-primary)]">{c.label}</span>
                    )}
                    {c.detail ? <p className="text-muted mt-1 text-[11px] leading-relaxed">{c.detail}</p> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
