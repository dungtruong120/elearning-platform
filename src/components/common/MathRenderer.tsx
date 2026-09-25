"use client";

import React, { useEffect, useRef } from "react";
import katex from "katex";

interface MathRendererProps {
  content: string;
  className?: string;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = "" }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Phân tách nội dung text thường và công thức toán học ($...$ hoặc $$...$$)
    const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
    const parts = content.split(regex);

    containerRef.current.innerHTML = "";

    parts.forEach((part) => {
      if (!part) return;

      if (part.startsWith("$$") && part.endsWith("$$")) {
        // Display Math (Khối công thức đứng độc lập)
        const math = part.slice(2, -2);
        const div = document.createElement("div");
        div.className = "my-2 text-center overflow-x-auto py-1";
        try {
          katex.render(math, div, {
            displayMode: true,
            throwOnError: false,
          });
        } catch {
          div.textContent = part;
        }
        containerRef.current?.appendChild(div);
      } else if (part.startsWith("$") && part.endsWith("$")) {
        // Inline Math (Công thức toán cùng dòng)
        const math = part.slice(1, -1);
        const span = document.createElement("span");
        span.className = "inline-block align-baseline px-0.5";
        try {
          katex.render(math, span, {
            displayMode: false,
            throwOnError: false,
          });
        } catch {
          span.textContent = part;
        }
        containerRef.current?.appendChild(span);
      } else {
        // Text thường: giữ nguyên tiếng Việt không định dạng gắt gao
        const span = document.createElement("span");
        span.textContent = part;
        containerRef.current?.appendChild(span);
      }
    });
  }, [content]);

  return <span ref={containerRef} className={`math-content font-sans leading-relaxed ${className}`} />;
};