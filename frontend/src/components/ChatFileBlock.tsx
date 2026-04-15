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
  baseName,
}: {
  language: string | null;
  content: string;
  index: number;
  baseName?: string;
}) {
  const spec = buildDownloadableFileSpec(language, content, index, baseName);
  const fileContent =
    spec.extension === "json" ? normalizeJsonContent(content) : content;

  return (
    <div className="chat-file-card mx-auto w-full max-w-[90%]">
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
          title="Download this content as a file"
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
