import { FiDownload } from "react-icons/fi";
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
}: {
  content: string;
}) {
  let codeBlockIndex = 0;
  const downloadableMessage = getAssistantMessageDownloadPayload(content);

  return (
    <div className="chat-markdown">
      {downloadableMessage ? (
        <div className="chat-message-actions">
          <button
            type="button"
            onClick={() =>
              downloadTextFile(
                downloadableMessage.spec,
                downloadableMessage.content,
              )
            }
            className="chat-file-action"
          >
            <FiDownload />
            Download{" "}
            {downloadableMessage.spec.extension.toUpperCase()}
          </button>
        </div>
      ) : null}
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
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
