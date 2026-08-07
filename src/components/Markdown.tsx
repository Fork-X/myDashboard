import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownProps {
  content: string;
}

export default function Markdown({ content }: MarkdownProps) {
  return (
    <div className="text-sm break-words leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-vintage-brown">{children}</strong>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-dashed underline-offset-2 text-vintage-red hover:text-vintage-dark"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => <ul className="my-1.5 list-disc pl-5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 list-decimal pl-5 space-y-0.5">{children}</ol>,
          code: ({ children, className }) =>
            className ? (
              <code className="text-xs">{children}</code>
            ) : (
              <code className="rounded bg-vintage-paper px-1 py-0.5 text-xs text-vintage-red">{children}</code>
            ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded border border-dashed border-vintage-border bg-vintage-paper p-2 text-xs">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-dashed border-vintage-border bg-vintage-paper px-2 py-1 text-left font-bold text-vintage-brown">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-dashed border-vintage-border px-2 py-1 align-top">{children}</td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-1.5 border-l-2 border-dashed border-vintage-border pl-2 opacity-80">
              {children}
            </blockquote>
          ),
          h1: ({ children }) => <p className="my-1.5 text-base font-bold text-vintage-brown">{children}</p>,
          h2: ({ children }) => <p className="my-1.5 text-base font-bold text-vintage-brown">{children}</p>,
          h3: ({ children }) => <p className="my-1.5 font-bold text-vintage-brown">{children}</p>,
          hr: () => <hr className="my-2 border-t-2 border-dashed border-vintage-border" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
