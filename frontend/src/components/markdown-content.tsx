import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

type MarkdownContentProps = {
  content: string;
  className?: string;
};

function normalizeMarkdownInput(rawContent: string): string {
  let normalized = typeof rawContent === "string" ? rawContent : "";
  normalized = normalized.replace(/\r\n?/g, "\n");

  if (!normalized.includes("\n") && normalized.includes("\\n")) {
    normalized = normalized.replace(/\\n/g, "\n");
  }

  normalized = normalized
    .split("\n")
    .map((line) => line.replace(/^(\s{0,3})(#{1,6})([^\s#])/, "$1$2 $3"))
    .join("\n");

  return normalized;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const normalizedContent = normalizeMarkdownInput(content || "");

  return (
    <div className={`markdown-content ${className || ""}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
