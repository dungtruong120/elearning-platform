"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Loader2, Layers, CheckCircle2, XCircle, PenTool, CircleDot, 
  CheckSquare, AlignLeft, Edit3, Sigma, Code2, Eye,
  AlertTriangle, ArrowRight, ArrowLeft, Settings2,
  Clock, Play, Sparkles, X, Target, Link as LinkIcon
} from "lucide-react";
import katex from "katex";
import JSZip from "jszip";

export type QuestionType = "multiple_choice" | "true_false" | "short_answer";

export interface QuestionOption {
  key: string;
  text_html: string;
  is_true_false_ans?: boolean | null;
}

export interface ParsedQuestion {
  id: string;
  order_index: number;
  section_title?: string;
  type: QuestionType;
  original_label: string;
  prompt_html: string;
  options: QuestionOption[];
  correct_answer: string;
  solution_html?: string;
  has_valid_answer?: boolean;
}

export interface ExamSection {
  section_title: string;
  section_type: QuestionType;
  questions: ParsedQuestion[];
}

export interface ExamSettings {
  title: string;
  duration_minutes: number;
  category?: string;
  driveUrl?: string;
}

export const PRACTICE_CATEGORIES = [
  "ĐGNL HSA (ĐHQGHN)",
  "ĐGTD TSA (ĐHBK)",
  "Tốt Nghiệp THPT", 
  "Giữa Kì 1",
  "Học Kì 1",
  "Giữa Kì 2",
  "Học Kì 2"
];

// ============================================================================
// 1. ENGINE DỊCH MATHTYPE BINARY & WORD EQUATION
// ============================================================================
function convertOmmlToLatex(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  const el = node as Element;
  const name = el.localName || el.nodeName?.split(":").pop() || "";
  if (name === "t") return el.textContent || "";
  if (name === "f") {
    const num = Array.from(el.childNodes).find((n: any) => n.nodeName.includes("num")) as any;
    const den = Array.from(el.childNodes).find((n: any) => n.nodeName.includes("den")) as any;
    return `\\frac{\({num ? convertOmmlToLatex(num) : ""}}{\){den ? convertOmmlToLatex(den) : ""}}`;
  }
  if (name === "sSup") {
    const e = Array.from(el.childNodes).find((n: any) => n.nodeName.includes("e")) as any;
    const sup = Array.from(el.childNodes).find((n: any) => n.nodeName.includes("sup")) as any;
    return `{\({e ? convertOmmlToLatex(e) : ""}}^{\){sup ? convertOmmlToLatex(sup) : ""}}`;
  }
  if (name === "sSub") {
    const e = Array.from(el.childNodes).find((n: any) => n.nodeName.includes("e")) as any;
    const sub = Array.from(el.childNodes).find((n: any) => n.nodeName.includes("sub")) as any;
    return `{\({e ? convertOmmlToLatex(e) : ""}}_{\){sub ? convertOmmlToLatex(sub) : ""}}`;
  }
  let str = "";
  for (let i = 0; i < el.childNodes.length; i++) str += convertOmmlToLatex(el.childNodes[i]);
  return str;
}

async function extractDocxDirectly(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const mediaMap: Record = {};
  const relsMap: Record = {};

  const relsFile = zip.files["word/_rels/document.xml.rels"];
  if (relsFile) {
    const xml = new DOMParser().parseFromString(await relsFile.async("string"), "text/xml");
    Array.from(xml.getElementsByTagName("Relationship")).forEach(rel => {
      const id = rel.getAttribute("Id");
      const target = rel.getAttribute("Target");
      if (id && target) relsMap[id] = target.replace(/^media\//, "word/media/");
    });
  }

  const targetToToken: Record = {};
  let imgCount = 1;

  for (const [rId, path] of Object.entries(relsMap)) {
    const zipPath = path.startsWith("word/") ? path : `word/${path}`;
    const fileEntry = zip.files[zipPath];
    if (fileEntry && /\.(png|jpe?g)$/i.test(zipPath)) {
      const b64 = await fileEntry.async("base64");
      const key = `img_${imgCount++}`;
      mediaMap[key] = `data:image/\({zipPath.toLowerCase().endsWith("png") ? "png" : "jpeg"};base64,\){b64}`;
      targetToToken[rId] = `[img:${key}]`;
    }
  }

  const docFile = zip.files["word/document.xml"];
  if (!docFile) throw new Error("File Word không hợp lệ.");
  const docXml = new DOMParser().parseFromString(await docFile.async("string"), "text/xml");
  const paragraphs = Array.from(docXml.getElementsByTagName("w:p"));
  const rawLines: string[] = [];

  paragraphs.forEach(p => {
    let line = "";
    Array.from(p.childNodes).forEach(child => {
      const name = (child as Element).localName || child.nodeName.split(":").pop() || "";
      if (name === "oMath" || name === "oMathPara") {
        const latex = convertOmmlToLatex(child).trim();
        if (latex) line += ` $\({latex.replace(/==/g, "=").replace(/R/g, "\\mathbb{R}")}\) `;
      } else if (name === "r") {
        Array.from((child as Element).getElementsByTagNameNS("*", "t")).forEach(t => { line += t.textContent; });
        Array.from((child as Element).getElementsByTagNameNS("*", "blip")).forEach(blip => {
          const rId = blip.getAttribute("r:embed") || blip.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
          if (rId && targetToToken[rId]) line += ` \n${targetToToken[rId]}\n `;
        });
      } else if (name === "object" || name === "OLEObject") {
           line += ` [MathType_Object] `;
      }
    });

    line = line.trim();
    if (line) rawLines.push(line);
  });

  return { text: rawLines.join("\n").normalize("NFC"), mediaMap };
}

// ============================================================================
// 2. CHUẨN HÓA & BÓC TÁCH ĐỀ THI
// ============================================================================
export function renumberAllQuestions(rawText: string): string {
  if (!rawText) return "";
  let counter = 1;
  const clean = rawText;
  return clean;
}