"use client";

import React, { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathTextRendererProps {
  content: string;
  className?: string;
}

export default function MathTextRenderer({ content, className = "" }: MathTextRendererProps) {
  const renderedHtml = useMemo(() => {
    if (!content) return "";

    let safeText = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    safeText = safeText.replace(/\$\$([\s\S]+?)\$\$/g, (_, mathExpr) => {
      try {
        return `<div class="my-2 overflow-x-auto py-1">${katex.renderToString(mathExpr.trim(), {
          displayMode: true,
          throwOnError: false,
        })}</div>`;
      } catch {
        return `$$${mathExpr}$$`;
      }
    });

    safeText = safeText.replace(/\$([^\$\n]+?)\$/g, (_, mathExpr) => {
      try {
        return katex.renderToString(mathExpr.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return `$${mathExpr}$`;
      }
    });

    safeText = safeText
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
      .replace(/\n/g, "<br />");

    return safeText;
  }, [content]);

  return (
    <div
      className={`text-xs sm:text-[13px] leading-relaxed text-slate-700 break-words ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}
