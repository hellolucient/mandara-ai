import React from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { safeHttpUrl } from "@/lib/answer-text";

function safeUrl(url: string): string {
  return safeHttpUrl(url);
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="font-heading text-xl font-normal tracking-[-0.01em] text-foreground">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-heading text-lg font-normal tracking-[-0.01em] text-foreground">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-heading text-base font-medium text-foreground">{children}</h3>
  ),
  h4: ({ children }) => <h4 className="text-sm font-semibold text-foreground">{children}</h4>,
  p: ({ children }) => <p>{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  ul: ({ children }) => <ul className="list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  a: ({ href, children }) => {
    const safe = safeHttpUrl(typeof href === "string" ? href : "");
    if (!safe) return <span>{children}</span>;
    return (
      <a
        className="underline decoration-border underline-offset-2 hover:decoration-foreground"
        href={safe}
        target="_blank"
        rel="noreferrer noopener"
      >
        {children}
      </a>
    );
  },
  code: ({ className, children }) => {
    if (className) return <code className={className}>{children}</code>;
    return <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">{children}</pre>
  ),
  table: ({ children }) => (
    <div className="-mx-1 overflow-x-auto">
      <table className="min-w-full divide-y divide-border text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-muted/30">{children}</tr>,
  th: ({ children }) => <th className="bg-muted/50 px-3 py-2 text-left font-medium whitespace-nowrap">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 whitespace-nowrap">{children}</td>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>
  ),
  hr: () => <hr className="border-border" />,
  img: ({ src, alt }) => {
    const safe = safeHttpUrl(typeof src === "string" ? src : "");
    if (!safe) return null;
    return (
      // Markdown images are remote http(s) URLs already checked by safeHttpUrl.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={safe} alt={typeof alt === "string" ? alt : ""} className="max-w-full rounded-lg border" />
    );
  },
};

export function MarkdownMessage({ text, className = "space-y-3 text-sm leading-6" }: { text: string; className?: string }) {
  if (!text) return null;
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} urlTransform={safeUrl} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
