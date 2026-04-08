import { useMemo } from "react";
import { FiDownload, FiFileText } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  downloadTextFile,
  getAssistantMessageDownloadPayload,
  normalizeFenceLanguage,
} from "../utils";
import ChatFileBlock from "./ChatFileBlock";

export default function AssistantMessageBody({
  content,
  conversationTitle,
}: {
  content: string;
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
    </div>
  );
}
