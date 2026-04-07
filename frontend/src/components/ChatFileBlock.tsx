import { FiDownload, FiFile } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  buildDownloadableFileSpec,
  downloadTextFile,
  isMarkdownLanguage,
  normalizeJsonContent,
} from "../utils";

export default function ChatFileBlock({
  language,
  content,
  index,
}: {
  language: string | null;
  content: string;
  index: number;
}) {
  const spec = buildDownloadableFileSpec(language, content, index);
  const fileContent =
    spec.extension === "json" ? normalizeJsonContent(content) : content;

  return (
    <div className="chat-file-card">
      <div className="chat-file-toolbar">
        <div className="chat-file-meta">
          <div className="chat-file-icon">
            <FiFile />
          </div>
          <div>
            <div className="chat-file-name">{spec.filename}</div>
            <div className="chat-file-kind">{spec.language} file</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => downloadTextFile(spec, fileContent)}
          className="chat-file-action"
        >
          <FiDownload />
          Download
        </button>
      </div>

      {isMarkdownLanguage(language) ? (
        <div className="chat-file-preview chat-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {fileContent}
          </ReactMarkdown>
        </div>
      ) : (
        <pre className="chat-file-preview">
          <code>{fileContent}</code>
        </pre>
      )}
    </div>
  );
}
