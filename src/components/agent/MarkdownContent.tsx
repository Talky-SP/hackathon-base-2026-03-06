import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = {
  content: string;
};

export default function MarkdownContent({ content }: Props) {
  return (
    <div className="prose-agent">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Strip any download links the AI puts in markdown (we handle files via artifacts)
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 underline underline-offset-2 hover:text-brand-700 transition-colors"
              {...props}
            >
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => <h3 className="text-base font-bold text-gray-900 mt-4 mb-2">{children}</h3>,
          h2: ({ children }) => <h3 className="text-sm font-bold text-gray-900 mt-3 mb-1.5">{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-semibold text-gray-800 mt-2.5 mb-1">{children}</h4>,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 ml-1 space-y-0.5 list-none">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-4 space-y-0.5 list-decimal">{children}</ol>,
          li: ({ children }) => (
            <li className="relative pl-4 before:content-['•'] before:absolute before:left-0 before:text-gray-400 before:text-xs">
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-gray-200 pl-3 my-2 text-gray-600 italic">
              {children}
            </blockquote>
          ),
          code: ({ className, children }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return (
                <pre className="bg-gray-900 text-gray-100 rounded-lg px-4 py-3 my-2 overflow-x-auto text-xs leading-relaxed">
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code className="bg-gray-100 text-gray-800 rounded px-1.5 py-0.5 text-[13px] font-mono">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-lg border border-gray-200">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b border-gray-200">{children}</th>
          ),
          td: ({ children }) => <td className="px-3 py-2 border-b border-gray-100 text-gray-700">{children}</td>,
          hr: () => <hr className="my-3 border-gray-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
