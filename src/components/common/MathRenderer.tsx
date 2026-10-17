"use client";

import React, { useEffect, useRef } from "react";
import katex from "katex";

interface MathRendererProps {
  content: string;
  className?: string;
  mediaMap?: Record<string, string>;
}

function resolveCommonImageSrc(tokenKey: string, mediaMap?: Record<string, string>): string | null {
  if (!tokenKey) return null;
  const trimmed = String(tokenKey).trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  if (!mediaMap || typeof mediaMap !== "object") return null;

  const cleanKey = trimmed
    .replace(/^\[(?:img\vert{}image):\s*/i, "") .replace(/\]$/i, "")
    .replace(/^\$+|\$+$/g, "")
    .trim();

  if (!cleanKey) return null;
  if (mediaMap[cleanKey]) return mediaMap[cleanKey];
  if (mediaMap[`$${cleanKey}$`]) return mediaMap[`$${cleanKey}$`];
  if (mediaMap[`$${cleanKey}`]) return mediaMap[`$${cleanKey}`];
  if (mediaMap[`img_${cleanKey}`]) return mediaMap[`img_${cleanKey}`];

  const lowerKey = cleanKey.toLowerCase();
  for (const [k, v] of Object.entries(mediaMap)) {
    if (!v) continue;
    if (k.replace(/^\$+|\$+$/g, "").trim().toLowerCase() === lowerKey) {
      return v;
    }
  }
  return null;
}

export const MathRenderer: React.FC<MathRendererProps> = ({ content, className = "", mediaMap }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!content) {
      containerRef.current.innerHTML = "";
      return;
    }

    let text = String(content).normalize("NFC");
    // Chỉ chuẩn hóa token có tiền tố tường minh [img:...] hoặc {{img:...}}
    text = text.replace(/\[(?:img\vert{}image):\s*\$?([a-zA-Z0-9_\-\.\/:]+)\$?\s*\]/gi, "[img:$1]");
    text = text.replace(/\{\{\s*(?:img|image):\s*\$?([a-zA-Z0-9_\-\.\/:]+)\$?\s*\}\}/gi, "[img:$1]");
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => "$$" + math + "$$");
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => "$" + math + "$");

    // Phân tách token ảnh [img:...], khối toán $$...$$ và toán inline $...$
    const regex = /(\[img:[^\]]+\]|\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
    const parts = text.split(regex);

    containerRef.current.innerHTML = "";

    parts.forEach((part) => {
      if (!part) return;

      const imgMatch = part.match(/^\[img:([^\]]+)\]$/i);
      if (imgMatch && imgMatch[1]) {
        const rawKey = imgMatch[1].trim();
        const src = resolveCommonImageSrc(rawKey, mediaMap);
        if (src) {
          const img = document.createElement("img");
          img.src = src;
          img.alt = "Hình minh họa";
          img.className = "my-2 max-h-64 max-w-full rounded-xl border border-slate-200 bg-white p-1.5 object-contain mx-auto block";
          containerRef.current?.appendChild(img);
        }
        return;
      }

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
        // Text thường: giữ nguyên tiếng Việt
        const span = document.createElement("span");
        span.textContent = part;
        containerRef.current?.appendChild(span);
      }
    });
  }, [content, mediaMap]);

  return <span ref={containerRef} className={`math-content font-sans leading-relaxed ${className}`} />;
};
