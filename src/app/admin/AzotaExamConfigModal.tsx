"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  Loader2, Layers, CheckCircle2, XCircle, PenTool, CircleDot, 
  CheckSquare, AlignLeft, Edit3, Sigma, Eye, AlertTriangle, 
  ArrowRight, ArrowLeft, Settings2, Clock, Play, Sparkles, X, Link as LinkIcon, Video,
  BookOpen, ChevronDown, ChevronUp, Check, RefreshCw, FolderCheck, ImagePlus, Calculator
} from "lucide-react";
import katex from "katex";
import JSZip from "jszip";
import { QuestionType, QuestionOption, ParsedQuestion, ExamSection, ExamSettings } from "@/types";

export const PRACTICE_CATEGORIES = [
  "ĐGNL HSA (ĐHQGHN)",
  "ĐGTD TSA (ĐHBK)",
  "Tốt Nghiệp THPT", 
  "Giữa Kì 1",
  "Học Kì 1",
  "Giữa Kì 2",
  "Học Kì 2"
];

// MỞ RỘNG INTERFACE ĐỂ HỖ TRỢ ĐIỂM CON VÀ TỶ LỆ PHẦN TRĂM
export interface ExtendedParsedQuestion extends ParsedQuestion {
  points?: number;
  sub_weights?: { a: number, b: number, c: number, d: number };
  sub_points?: { a: number, b: number, c: number, d: number };
}

export interface ExtendedExamSection extends ExamSection {
  questions: ExtendedParsedQuestion[];
}

// ============================================================================
// 1. ENGINE DỊCH MATHTYPE & OMML SANG LATEX CHUẨN XÁC
// ============================================================================

function isCleanLatex(latex: string): boolean {
  if (!latex || typeof latex !== "string") return false;
  const trimmed = latex.trim();
  if (trimmed.length < 1) return false;

  if (trimmed.includes("\\langle") || 
      trimmed.includes("\\rangle") || 
      trimmed.includes("()") || 
      trimmed.includes("[]") || 
      /\\sqrt\{\s*\}/.test(trimmed)) {
    return false;
  }

  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if ((code >= 0x4e00 && code <= 0x9fff) || 
        (code >= 0x3400 && code <= 0x4dbf) || 
        (code >= 0x3040 && code <= 0x30ff) || 
        (code >= 0xac00 && code <= 0xd7af)) {
      return false;
    }
  }

  if (/EquationNative|MTExtra|CompObj|OleObject|Times New Roman|Symbol|Word\.Document/i.test(trimmed)) {
    return false;
  }

  return true;
}

function convertOmmlToLatex(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  const el = node as Element;
  const name = el.localName || el.nodeName?.split(":").pop() || "";
  if (name === "t") return el.textContent || "";
  if (name === "f") {
    const num = Array.from(el.childNodes).find((n: any) => n.nodeName && n.nodeName.includes("num")) as any;
    const den = Array.from(el.childNodes).find((n: any) => n.nodeName && n.nodeName.includes("den")) as any;
    return "\\frac{" + (num ? convertOmmlToLatex(num) : "") + "}{" + (den ? convertOmmlToLatex(den) : "") + "}";
  }
  if (name === "sSup") {
    const e = Array.from(el.childNodes).find((n: any) => n.nodeName && n.nodeName.includes("e")) as any;
    const sup = Array.from(el.childNodes).find((n: any) => n.nodeName && n.nodeName.includes("sup")) as any;
    return "{" + (e ? convertOmmlToLatex(e) : "") + "}^{" + (sup ? convertOmmlToLatex(sup) : "") + "}";
  }
  if (name === "sSub") {
    const e = Array.from(el.childNodes).find((n: any) => n.nodeName && n.nodeName.includes("e")) as any;
    const sub = Array.from(el.childNodes).find((n: any) => n.nodeName && n.nodeName.includes("sub")) as any;
    return "{" + (e ? convertOmmlToLatex(e) : "") + "}_{" + (sub ? convertOmmlToLatex(sub) : "") + "}";
  }
  if (name === "rad") {
    const deg = Array.from(el.childNodes).find((n: any) => n.nodeName && n.nodeName.includes("deg")) as any;
    const e = Array.from(el.childNodes).find((n: any) => n.nodeName && n.nodeName.includes("e")) as any;
    const degStr = deg ? convertOmmlToLatex(deg).trim() : "";
    return degStr 
      ? "\\sqrt[" + degStr + "]{" + (e ? convertOmmlToLatex(e) : "") + "}" 
      : "\\sqrt{" + (e ? convertOmmlToLatex(e) : "") + "}";
  }
  let str = "";
  for (let i = 0; i < el.childNodes.length; i++) {
    str += convertOmmlToLatex(el.childNodes[i]);
  }
  return str;
}

class MTEFStreamReader {
  private data: Uint8Array;
  public pos: number = 0;
  constructor(data: Uint8Array) {
    this.data = data;
  }
  readByte(): number {
    return this.pos < this.data.length ? this.data[this.pos++] : 0;
  }
  readUint16(): number {
    if (this.pos + 1 < this.data.length) {
      const val = this.data[this.pos] | (this.data[this.pos + 1] << 8);
      this.pos += 2;
      return val;
    }
    return 0;
  }
  hasMore(): boolean {
    return this.pos < this.data.length;
  }
}

function decodeMtefToLatex(uint8: Uint8Array): string {
  if (!uint8 || uint8.length < 10) return "";
  let start = -1;

  for (let i = 0; i < uint8.length - 10; i++) {
    if ((uint8[i] === 3 || uint8[i] === 5) && 
        (uint8[i + 1] === 0 || uint8[i + 1] === 1) && 
        (uint8[i + 2] === 0 || uint8[i + 2] === 1) && 
        uint8[i + 3] >= 1 && uint8[i + 3] <= 10 && 
        uint8[i + 4] === 0) {
      start = i;
      break;
    }
  }

  if (start === -1) {
    for (let i = 0; i < uint8.length - 30; i++) {
      if (uint8[i] === 0x1C && uint8[i + 1] === 0x00) {
        const cand = i + 28;
        if (cand + 5 <= uint8.length && (uint8[cand] === 3 || uint8[cand] === 5)) {
          start = cand;
          break;
        }
      }
    }
  }

  if (start === -1) return "";

  const version = uint8[start];
  let offset = start + 5;
  while (offset < uint8.length && uint8[offset] !== 0) {
    offset++;
  }
  if (offset < uint8.length && uint8[offset] === 0) {
    offset += 2;
  }

  const reader = new MTEFStreamReader(uint8.subarray(offset));

  const SYMBOL_MAP: Record<number, string> = {
    0x03B1: "\\alpha", 0x03B2: "\\beta", 0x03B3: "\\gamma", 0x03B4: "\\delta",
    0x03C0: "\\pi", 0x03B8: "\\theta", 0x03BB: "\\lambda", 0x03BC: "\\mu",
    0x03C3: "\\sigma", 0x03C9: "\\omega", 0x0394: "\\Delta", 0x03A9: "\\Omega",
    0x00B1: "\\pm ", 0x00D7: "\\times ", 0x00F7: "\\div ", 0x2264: "\\le ",
    0x2265: "\\ge ", 0x2260: "\\ne ", 0x221E: "+\\infty ", 0x2208: "\\in ",
    0x2192: "\\to ", 0x21D2: "\\Rightarrow ", 0x2248: "\\approx ",
    0x2205: "\\emptyset ", 0x2229: "\\cap ", 0x222A: "\\cup ",
    0x2212: "-", 0x2013: "-", 0x2014: "-"
  };

  const parseLine = (): string => {
    const res: string[] = [];
    reader.readByte();

    while (reader.hasMore()) {
      const tag = reader.readByte();
      if (tag === 0) break;
      const recType = tag & 0x0F;
      const opts = version >= 5 ? reader.readByte() : (tag >> 4);

      if (recType === 1) { 
        if (opts & 0x08) { reader.readByte(); reader.readByte(); }
        if (opts & 0x04) { reader.readByte(); }
        res.push(parseLine());
      } else if (recType === 2) { 
        if (opts & 0x08) { reader.readByte(); reader.readByte(); }
        reader.readByte();
        const chCode = reader.readUint16();
        if (opts & 0x02) {
          const emb = reader.readByte();
          if (emb === 5) res.push("'");
          else if (emb === 6) res.push("''");
        }
        if (SYMBOL_MAP[chCode]) {
          res.push(SYMBOL_MAP[chCode]);
        } else if (chCode >= 32 && chCode <= 126) {
          res.push(String.fromCharCode(chCode));
        } else if (chCode >= 0x0370 && chCode <= 0x03FF) {
          res.push(String.fromCharCode(chCode));
        } else if (chCode >= 0x2000 && chCode <= 0x22FF) {
          res.push(String.fromCharCode(chCode));
        }
      } else if (recType === 3) { 
        if (opts & 0x08) { reader.readByte(); reader.readByte(); }
        const selector = reader.readByte();
        const variation = version >= 5 ? reader.readUint16() : reader.readByte();

        if (selector === 0 || selector === 1) { 
          const inner = parseLine();
          res.push("(" + inner + ")");
        } else if (selector === 2) { 
          const inner = parseLine();
          res.push("\\{" + inner + "\\}");
        } else if (selector === 3) { 
          const inner = parseLine();
          res.push("[" + inner + "]");
        } else if (selector === 4) { 
          const inner = parseLine();
          res.push("|" + inner + "|");
        } else if (selector === 10 || selector === 13) { 
          if (variation === 1) {
            const deg = parseLine();
            const rad = parseLine();
            res.push("\\sqrt[" + deg + "]{" + rad + "}");
          } else {
            const rad = parseLine();
            res.push("\\sqrt{" + rad + "}");
          }
        } else if (selector === 11 || selector === 14) { 
          const num = parseLine();
          const den = parseLine();
          res.push("\\frac{" + num + "}{" + den + "}");
        } else if (selector === 15 || selector === 27 || selector === 28 || selector === 29) { 
          if (variation === 0 || selector === 28) {
            const sup = parseLine();
            res.push("^{" + sup + "}");
          } else if (variation === 1 || selector === 27) {
            const sub = parseLine();
            res.push("_{" + sub + "}");
          } else {
            const sub = parseLine();
            const sup = parseLine();
            res.push("_{" + sub + "}^{" + sup + "}");
          }
        } else if (selector === 15) {
          const body = parseLine();
          res.push("\\int " + body);
        } else if (selector === 16) {
          const body = parseLine();
          res.push("\\sum " + body);
        } else {
          const inner = parseLine();
          if (inner) res.push(inner);
        }
      } else if (recType === 4) {
        const lines: string[] = [];
        while (reader.hasMore()) {
          const t = reader.readByte();
          if (t === 0) break;
          if ((t & 0x0F) === 1) lines.push(parseLine());
        }
        res.push(lines.join(" "));
      } else if (recType === 6) {
        const embType = reader.readByte();
        if (embType === 5) res.push("'");
        else if (embType === 6) res.push("''");
      }
    }
    return res.join("");
  };

  try {
    let raw = parseLine().trim();
    raw = raw.replace(/\\langle\s*\(\)\s*|\\langle\s*|\\rangle\s*|\\sqrt\{\s*\}|\(\)/g, "").trim();
    if (raw) {
      raw = raw.replace(/--/g, "-").replace(/\+-/g, "-");
      return "$" + raw + "$";
    }
  } catch (e) {}

  return "";
}

function parseMathTypeBinary(uint8: Uint8Array): string {
  const latex = decodeMtefToLatex(uint8);
  if (latex && isCleanLatex(latex)) return latex;
  return "";
}

export async function extractDocxDirectly(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const mediaMap: Record<string, string> = {};
  const relsMap: Record<string, string> = {};
  const relsFile = zip.files["word/_rels/document.xml.rels"];

  if (relsFile) {
    const xml = new DOMParser().parseFromString(await relsFile.async("string"), "text/xml");
    Array.from(xml.getElementsByTagName("Relationship")).forEach(rel => {
      const id = rel.getAttribute("Id");
      const target = rel.getAttribute("Target");
      if (id && target) relsMap[id] = target.replace(/^media\//, "word/media/");
    });
  }

  let imgCount = 1;
  const targetToToken: Record<string, string> = {};
  for (const [rId, path] of Object.entries(relsMap)) {
    const zipPath = path.startsWith("word/") ? path : ("word/" + path);
    const fileEntry = zip.files[zipPath];
    if (fileEntry && /\.(png|jpe?g|gif|webp|svg)$/i.test(zipPath)) {
      const b64 = await fileEntry.async("base64");
      const key = "img_" + (imgCount++);
      let ext = "jpeg";
      if (zipPath.toLowerCase().endsWith("png")) ext = "png";
      else if (zipPath.toLowerCase().endsWith("svg")) ext = "svg+xml";
      else if (zipPath.toLowerCase().endsWith("gif")) ext = "gif";
      else if (zipPath.toLowerCase().endsWith("webp")) ext = "webp";
      mediaMap[key] = "data:image/" + ext + ";base64," + b64;
      targetToToken[rId] = "[img:$" + key + "$]";
    }
  }

  const oleCache: Record<string, string> = {};
  for (const [rId, path] of Object.entries(relsMap)) {
    const zipPath = path.startsWith("word/") ? path : ("word/" + path);
    if (/embeddings\/oleObject\d*\.bin$/i.test(zipPath)) {
      const fileEntry = zip.files[zipPath];
      if (fileEntry) {
        const uint8 = await fileEntry.async("uint8array");
        const parsed = parseMathTypeBinary(uint8);
        if (parsed) oleCache[rId] = parsed;
      }
    }
  }

  const docFile = zip.files["word/document.xml"];
  if (!docFile) throw new Error("File Word không hợp lệ.");
  const docXml = new DOMParser().parseFromString(await docFile.async("string"), "text/xml");
  const paragraphs = Array.from(docXml.getElementsByTagName("w:p"));
  const rawLines: string[] = [];

  const processOleObject = (objNode: Element): string => {
    const allDescendants = Array.from(objNode.getElementsByTagName("*"));
    let oleRId = "";

    for (const el of allDescendants) {
      const tag = (el.localName || el.nodeName).toLowerCase();
      if (tag.includes("oleobject")) {
        oleRId = el.getAttribute("r:id") || el.getAttribute("id") || el.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || "";
      }
    }

    if (oleRId && oleCache[oleRId] && isCleanLatex(oleCache[oleRId])) {
      return " " + oleCache[oleRId] + " ";
    }
    return "";
  };

  paragraphs.forEach(p => {
    let line = "";
    Array.from(p.childNodes).forEach(child => {
      const el = child as Element;
      const name = el.localName || el.nodeName?.split(":").pop() || "";

      if (name === "oMath" || name === "oMathPara") {
        const latex = convertOmmlToLatex(el).trim();
        if (latex) line += " $" + latex + "$ ";
      } else if (name === "object") {
        line += processOleObject(el);
      } else if (name === "r") {
        const objects = Array.from(el.getElementsByTagNameNS("*", "object"));
        if (objects.length > 0) {
          objects.forEach(obj => {
            line += processOleObject(obj as Element);
          });
        } else {
          Array.from(el.getElementsByTagNameNS("*", "t")).forEach((t: any) => { line += t.textContent || ""; });
          Array.from(el.getElementsByTagNameNS("*", "blip")).forEach((blip: any) => {
            const rId = blip.getAttribute("r:embed") || blip.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
            if (rId && targetToToken[rId]) {
              line += " " + targetToToken[rId] + " ";
            }
          });
        }
      } else if (name === "drawing") {
        Array.from(el.getElementsByTagNameNS("*", "blip")).forEach((blip: any) => {
          const rId = blip.getAttribute("r:embed") || blip.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
          if (rId && targetToToken[rId]) {
            line += " " + targetToToken[rId] + " ";
          }
        });
      }
    });

    line = line.trim();
    if (line) rawLines.push(line);
  });

  return { text: rawLines.join("\n").normalize("NFC"), mediaMap };
}

// ============================================================================
// 2. BÓC TÁCH SECTION & CÂU HỎI
// ============================================================================

export function normalizeOptionsSmart(text: string): string {
  if (!text) return "";
  let res = text;
  res = res.replace(/(\S+)\s*\.([B-D]\.)/g, "$1.\n$2");
  res = res.replace(/(?:\t|[ ]{2,})([A-D]\.|\([A-D]\)|[A-D]\)|[a-d]\))/g, "\n$1");
  res = res.replace(/([^\n\r])\s+([B-D]\.|\([B-D]\)|[B-D]\))/g, "$1\n$2");
  return res;
}

const SECTION_HEADER_REGEX = /(?:^|[\r\n]+)\s*((?:(?:Phần|PHẦN)\s*(?:[IVX]+|\d+)|(?:I{1,3}|IV)\.)\s*[:\-]?[^\r\n]*)/gi;

function getSectionTypeFromTitle(title: string): QuestionType {
  if (/đúng\s*sai|true\s*false/i.test(title)) return "true_false";
  if (/trả\s*lời\s*ngắn|điền\s*khuyết|short\s*answer/i.test(title)) return "short_answer";
  return "multiple_choice";
}

function processBodyAndNumberQuestions(text: string, startQIdx: number, secType: QuestionType): { labeledText: string; nextQIdx: number } {
  const norm = normalizeOptionsSmart(text);

  if (secType === "true_false") {
    const qSplit = norm.split(/(?:^|[\r\n]+)(?:Câu|Bài|Question)\s*\d+[:.]?\s*/gi).filter(Boolean);
    if (qSplit.length > 1) {
      let cur = startQIdx;
      const pieces = qSplit.map(chunk => "Câu " + (cur++) + ":\n" + (chunk || "").trim());
      return { labeledText: pieces.join("\n\n"), nextQIdx: cur };
    }
  }

  const optPattern = /(?:^|[\r\n\t\s\.])A[\.\)]\s*/gm;
  const aMatches: { start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = optPattern.exec(norm)) !== null) {
    aMatches.push({ start: m.index, end: m.index + m[0].length });
  }

  if (aMatches.length === 0) {
    const qSplit = norm.split(/(?:^|[\r\n]+)(?:Câu|Bài|Question)\s*\d+[:.]?\s*/gi).filter(Boolean);
    if (qSplit.length > 0) {
      let cur = startQIdx;
      const pieces = qSplit.map(chunk => "Câu " + (cur++) + ":\n" + (chunk || "").trim());
      return { labeledText: pieces.join("\n\n"), nextQIdx: cur };
    }
    return { labeledText: norm, nextQIdx: startQIdx };
  }

  const validAGroups: { start: number; end: number }[] = [];
  for (let i = 0; i < aMatches.length; i++) {
    const startPos = aMatches[i].start;
    const endPos = i + 1 < aMatches.length ? aMatches[i + 1].start : norm.length;
    const sub = norm.slice(startPos, endPos);
    if (/(?:^|[\r\n\t\s\.])B[\.\)]/.test(sub)) {
      validAGroups.push(aMatches[i]);
    }
  }

  if (validAGroups.length === 0) return { labeledText: norm, nextQIdx: startQIdx };

  const qStarts: number[] = [0];
  const solRegex = /(?:[\r\n]+|^)\s*(?:Lời\s*giải|Lơ\u0300i\s*giải|Hướng\s*dẫn\s*giải|Hươ\u0301ng\s*dâ\u0303n\s*giải|HDG|Giải\s*:|LỜI\s*GIẢI)\b/gi;

  for (let k = 0; k < validAGroups.length - 1; k++) {
    const currAPos = validAGroups[k].start;
    const nextAPos = validAGroups[k + 1].start;
    const between = norm.slice(currAPos, nextAPos);

    solRegex.lastIndex = 0;
    const solMatch = solRegex.exec(between);
    if (solMatch) {
      const solAbsStart = currAPos + solMatch.index;
      const solText = norm.slice(solAbsStart, nextAPos);
      const qStarter = /[\r\n]+\s*(?:(?=[A-ZĐ][a-zđ]+.*?(?:hàm số|đạo hàm|tích phân|phương trình|nghiệm|đồ thị|bảng biến thiên|hình vẽ|giá trị|cho|biết|tính|tìm|có bao nhiêu|gọi|trong không gian|hình chóp|hình lăng trụ|thể tích|mặt phẳng|đường thẳng|tọa độ)))/i;
      const starterMatch = qStarter.exec(solText);
      if (starterMatch) {
        qStarts.push(solAbsStart + starterMatch.index);
      } else {
        const doubleNl = solText.lastIndexOf("\n\n");
        if (doubleNl !== -1) {
          qStarts.push(solAbsStart + doubleNl);
        } else {
          const lastPeriod = solText.lastIndexOf(".");
          if (lastPeriod !== -1 && lastPeriod + 1 < solText.length) {
            qStarts.push(solAbsStart + lastPeriod + 1);
          } else {
            qStarts.push(currAPos + Math.floor((nextAPos - currAPos) * 0.7));
          }
        }
      }
    } else {
      const qStarter = /[\r\n]+\s*(?:(?=[A-ZĐ][a-zđ]+.*?(?:hàm số|đạo hàm|tích phân|phương trình|nghiệm|đồ thị|bảng biến thiên|hình vẽ|giá trị|cho|biết|tính|tìm|có bao nhiêu|gọi)))/i;
      const starterMatch = qStarter.exec(between);
      if (starterMatch) {
        qStarts.push(currAPos + starterMatch.index);
      } else {
        qStarts.push(currAPos + Math.floor((nextAPos - currAPos) * 0.5));
      }
    }
  }

  const allStarts = [...qStarts, norm.length];
  const pieces: string[] = [];
  let currIdx = startQIdx;

  for (let idx = 0; idx < allStarts.length - 1; idx++) {
    const chunk = norm.slice(allStarts[idx], allStarts[idx + 1]).trim();
    if (!chunk) continue;
    const clean = (chunk || "")
      .replace(/^\s*(?:\*{1,2})?(?:(?:Câu|Bài|Question)\s*\d+[:.\-\)]?|\d+[\.😕)])\s*(?:\*{1,2})?[:.\-\s]*/gi, "")
      .trim();
    pieces.push("Câu " + (currIdx++) + ":\n" + clean);
  }

  return { labeledText: pieces.join("\n\n"), nextQIdx: currIdx };
}

export function injectQuestionLabelsIfMissing(rawText: string): string {
  if (!rawText) return "";
  let text = rawText.normalize("NFC");
  text = text.replace(/\\langle\s*\(\)\s*|\\langle\s*|\\rangle\s*|\\sqrt\{\s*\}|\(\)/g, "");
  text = normalizeOptionsSmart(text);

  const existingMatches = text.match(/(?:^|\n)\s*(?:Câu|Bài|Question)\s*\d+[:.]?/gi);
  if (existingMatches && existingMatches.length >= 2) {
    return text;
  }

  SECTION_HEADER_REGEX.lastIndex = 0;
  const secMatches: { title: string; start: number; end: number }[] = [];
  let sm: RegExpExecArray | null;
  while ((sm = SECTION_HEADER_REGEX.exec(text)) !== null) {
    if (sm[1]) {
      secMatches.push({ title: sm[1].trim(), start: sm.index, end: sm.index + sm[0].length });
    }
  }

  if (secMatches.length > 0) {
    const parts: string[] = [];
    if (secMatches[0].start > 0) {
      const pre = text.slice(0, secMatches[0].start).trim();
      if (pre) parts.push(pre);
    }

    let globalQIdx = 1;
    for (let i = 0; i < secMatches.length; i++) {
      const secHeader = secMatches[i].title;
      const secType = getSectionTypeFromTitle(secHeader);
      const start = secMatches[i].end;
      const end = i + 1 < secMatches.length ? secMatches[i + 1].start : text.length;
      const secBody = text.slice(start, end).trim();

      const { labeledText, nextQIdx } = processBodyAndNumberQuestions(secBody, globalQIdx, secType);
      globalQIdx = nextQIdx;
      parts.push(secHeader + "\n\n" + labeledText);
    }
    return parts.join("\n\n");
  } else {
    const { labeledText } = processBodyAndNumberQuestions(text, 1, "multiple_choice");
    return labeledText;
  }
}

function parseSingleQuestionChunk(chunk: string, qIndex: number, sectionTitle: string, sectionType: QuestionType, sectionIndex: number): ExtendedParsedQuestion {
  let norm = chunk.normalize("NFC").trim();
  norm = norm.replace(/\\langle\s*\(\)\s*|\\langle\s*|\\rangle\s*|\\sqrt\{\s*\}|\(\)/g, "");
  norm = normalizeOptionsSmart(norm);

  const cleanChunk = (norm || "")
    .replace(/^\s*(?:\*{1,2})?(?:(?:Câu|Bài|Question)\s*\d+[:.\-\)]?|\d+[\.😕)])\s*(?:\*{1,2})?[:.\-\s]*/gi, "")
    .trim();

  const solRegex = /(?:[\r\n]+|^)\s*(?:Lời\s*giải|Lơ\u0300i\s*giải|Hướng\s*dẫn\s*giải|Hươ\u0301ng\s*dâ\u0303n\s*giải|HDG|Giải\s*:|LỜI\s*GIẢI)\b/gi;
  const solMatch = solRegex.exec(cleanChunk);

  let promptAndOpts = cleanChunk;
  let solutionText = "";
  if (solMatch) {
    promptAndOpts = cleanChunk.slice(0, solMatch.index).trim();
    solutionText = cleanChunk.slice(solMatch.index).trim();
  }

  const uniqueId = "sec-" + sectionIndex + "-q-" + qIndex + "-" + Math.random().toString(36).substring(2, 8);

  if (sectionType === "true_false") {
    const tfOptRegex = /(?:^|[\r\n\t\s])([a-d])[\.\)]\s*/gim;
    const tfMatches: { key: string; start: number; end: number }[] = [];
    let tm: RegExpExecArray | null;
    while ((tm = tfOptRegex.exec(promptAndOpts)) !== null) {
      if (tm[1]) tfMatches.push({ key: tm[1].toLowerCase(), start: tm.index, end: tm.index + tm[0].length });
    }

    const options: QuestionOption[] = [
      { key: "a", text_html: "", is_true_false_ans: false },
      { key: "b", text_html: "", is_true_false_ans: false },
      { key: "c", text_html: "", is_true_false_ans: false },
      { key: "d", text_html: "", is_true_false_ans: false }
    ];

    let promptHtml = promptAndOpts;
    let tfAIdx = -1;
    for (let i = 0; i <= tfMatches.length - 4; i++) {
      if (tfMatches[i].key === "a" && 
          tfMatches[i + 1].key === "b" && 
          tfMatches[i + 2].key === "c" && 
          tfMatches[i + 3].key === "d") {
        tfAIdx = i;
        break;
      }
    }

    if (tfAIdx !== -1) {
      const mA = tfMatches[tfAIdx];
      const mB = tfMatches[tfAIdx + 1];
      const mC = tfMatches[tfAIdx + 2];
      const mD = tfMatches[tfAIdx + 3];

      promptHtml = promptAndOpts.slice(0, mA.start).trim();
      const rawOpts = [
        promptAndOpts.slice(mA.end, mB.start).trim(),
        promptAndOpts.slice(mB.end, mC.start).trim(),
        promptAndOpts.slice(mC.end, mD.start).trim(),
        promptAndOpts.slice(mD.end).trim()
      ];

      for (let i = 0; i < 4; i++) {
        let t = rawOpts[i];
        let ansVal: boolean | null = null;
        if (/\[(Đúng|Đ)\]/i.test(t)) { ansVal = true; t = t.replace(/\[(Đúng|Đ)\]/i, "").trim(); }
        else if (/\[(Sai|S)\]/i.test(t)) { ansVal = false; t = t.replace(/\[(Sai|S)\]/i, "").trim(); }
        options[i].text_html = t;
        if (ansVal !== null) options[i].is_true_false_ans = ansVal;
      }
    }

    if (solutionText) {
      for (let i = 0; i < 4; i++) {
        const subKey = options[i].key;
        const guessRegex = new RegExp("(?:^|[\\s\\n,.])(?:[Ýý]\\s*)?" + subKey + "[\\)\\.:\\s]+(?:là\\s+(?:mệnh\\s*đề\\s*)?)?([Đđ]úng|[Ss]ai|[ĐđSs])\\b", "i");
        const guessMatch = solutionText.match(guessRegex);
        if (guessMatch && options[i].is_true_false_ans === false) {
          options[i].is_true_false_ans = /[Đđ]úng|[Đđ]/.test(guessMatch[1]);
        }
      }
    }

    // MẶC ĐỊNH LÀ 1 ĐIỂM, CHIA TỶ TRỌNG 25% MỖI Ý CHO ĐÚNG/SAI
    return {
      id: uniqueId,
      order_index: qIndex,
      section_title: sectionTitle,
      type: "true_false",
      original_label: "Câu " + qIndex,
      prompt_html: promptHtml,
      options,
      correct_answer: options.map(o => (o.is_true_false_ans ? "Đ" : "S")).join(""),
      solution_html: solutionText,
      points: 1.0,
      sub_weights: { a: 25, b: 25, c: 25, d: 25 },
      sub_points: { a: 0.25, b: 0.25, c: 0.25, d: 0.25 }
    };
  }

  if (sectionType === "short_answer") {
    let correctAns = "";
    const ansMatch = /(?:Đáp\s*án|Đáp\s*số|KQ|Kết\s*quả)[:\s]+([^\r\n]+)/i.exec(cleanChunk);
    if (ansMatch && ansMatch[1]) {
      correctAns = ansMatch[1].trim();
    }
    return {
      id: uniqueId,
      order_index: qIndex,
      section_title: sectionTitle,
      type: "short_answer",
      original_label: "Câu " + qIndex,
      prompt_html: promptAndOpts,
      options: [],
      correct_answer: correctAns,
      solution_html: solutionText,
      points: 0.5
    };
  }

  let correctAns = "A";
  const ansMatch = /(?:Chọn|Đáp\s*án|Đáp\s*số)\s*(?:đáp\s*án\s*)?([A-D])\b/i.exec(cleanChunk);
  if (ansMatch && ansMatch[1]) {
    correctAns = ansMatch[1].toUpperCase();
  }

  const optRegex = /(?:^|[\r\n\t\s\.])([A-D])[\.\)]\s*/gm;
  const optMatches: { key: string; start: number; end: number }[] = [];
  let om: RegExpExecArray | null;
  while ((om = optRegex.exec(promptAndOpts)) !== null) {
    if (om[1]) {
      optMatches.push({ key: om[1].toUpperCase(), start: om.index, end: om.index + om[0].length });
    }
  }

  let optAIdx = -1;
  for (let i = 0; i <= optMatches.length - 4; i++) {
    if (optMatches[i].key === "A" && 
        optMatches[i + 1].key === "B" && 
        optMatches[i + 2].key === "C" && 
        optMatches[i + 3].key === "D") {
      optAIdx = i;
      break;
    }
  }

  let promptHtml = promptAndOpts;
  const options: QuestionOption[] = [
    { key: "A", text_html: "" },
    { key: "B", text_html: "" },
    { key: "C", text_html: "" },
    { key: "D", text_html: "" }
  ];

  if (optAIdx !== -1) {
    const mA = optMatches[optAIdx];
    const mB = optMatches[optAIdx + 1];
    const mC = optMatches[optAIdx + 2];
    const mD = optMatches[optAIdx + 3];

    promptHtml = promptAndOpts.slice(0, mA.start).trim();
    const textA = promptAndOpts.slice(mA.end, mB.start).trim();
    const textB = promptAndOpts.slice(mB.end, mC.start).trim();
    const textC = promptAndOpts.slice(mC.end, mD.start).trim();
    const textD = promptAndOpts.slice(mD.end).trim();

    const cleanOpt = (s: string) => (s || "")
      .replace(/^\.+|\.+$/g, "")
      .replace(/\\langle\s*\(\)\s*|\\langle\s*|\\rangle\s*|\\sqrt\{\s*\}|\(\)/g, "")
      .trim();

    options[0].text_html = cleanOpt(textA);
    options[1].text_html = cleanOpt(textB);
    options[2].text_html = cleanOpt(textC);
    options[3].text_html = cleanOpt(textD);
  }

  // TRẮC NGHIỆM MẶC ĐỊNH LÀ 0.25
  return {
    id: uniqueId,
    order_index: qIndex,
    section_title: sectionTitle,
    type: "multiple_choice",
    original_label: "Câu " + qIndex,
    prompt_html: promptHtml,
    options,
    correct_answer: correctAns,
    solution_html: solutionText,
    points: 0.25
  };
}

export function parseExamHierarchical(rawText: string): ExtendedExamSection[] {
  if (!rawText || !rawText.trim()) return [];
  let text = rawText.normalize("NFC").trim();
  text = text.replace(/\\langle\s*\(\)\s*|\\langle\s*|\\rangle\s*|\\sqrt\{\s*\}|\(\)/g, "");

  const readyText = injectQuestionLabelsIfMissing(text);

  SECTION_HEADER_REGEX.lastIndex = 0;
  const secMatches: { title: string; start: number; end: number }[] = [];
  let sm: RegExpExecArray | null;

  while ((sm = SECTION_HEADER_REGEX.exec(readyText)) !== null) {
    if (sm[1]) {
      secMatches.push({ title: sm[1].trim(), start: sm.index, end: sm.index + sm[0].length });
    }
  }

  const parseQuestionsFromText = (content: string, secTitle: string, secType: QuestionType, sIdx: number): ExtendedParsedQuestion[] => {
    const qSplitRegex = /(?:^|[\r\n]+)(?:Câu|Bài|Question)\s*(\d+)[:.]?\s*/gi;
    const matches: { index: number; label: string; fullMatch: string; qNum: number }[] = [];
    let qm: RegExpExecArray | null;

    while ((qm = qSplitRegex.exec(content)) !== null) {
      if (qm[1]) {
        matches.push({ index: qm.index, label: "Câu " + qm[1], fullMatch: qm[0], qNum: parseInt(qm[1], 10) });
      }
    }

    if (matches.length > 0) {
      const qList: ExtendedParsedQuestion[] = [];
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index + matches[i].fullMatch.length;
        const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
        const chunk = content.slice(start, end).trim();
        const parsed = parseSingleQuestionChunk(chunk, matches[i].qNum, secTitle, secType, sIdx);
        parsed.original_label = matches[i].label;
        qList.push(parsed);
      }
      return qList;
    } else {
      const paragraphs = content.split(/\n\s*\n+/).filter(Boolean);
      return paragraphs.map((p, idx) => {
        return parseSingleQuestionChunk(p.trim(), idx + 1, secTitle, secType, sIdx);
      });
    }
  };

  if (secMatches.length > 0) {
    const sectionsResult: ExtendedExamSection[] = [];
    for (let i = 0; i < secMatches.length; i++) {
      const secTitle = secMatches[i].title;
      const secType = getSectionTypeFromTitle(secTitle);
      const start = secMatches[i].end;
      const end = i + 1 < secMatches.length ? secMatches[i + 1].start : readyText.length;
      const secContent = readyText.slice(start, end).trim();

      const questions = parseQuestionsFromText(secContent, secTitle, secType, i);
      sectionsResult.push({
        section_title: secTitle,
        section_type: secType,
        questions
      });
    }
    return sectionsResult;
  } else {
    const questions = parseQuestionsFromText(readyText, "PHẦN I. TRẮC NGHIỆM", "multiple_choice", 0);
    return [
      {
        section_title: "PHẦN I. TRẮC NGHIỆM",
        section_type: "multiple_choice",
        questions
      }
    ];
  }
}

// ============================================================================
// 3. RENDER KATEX, ẢNH NỘI TẠI VÀ LINK ẢNH TỪ WEB
// ============================================================================

export function TokenViewer({ 
  content, 
  mediaMap, 
  inline = false 
}: { 
  content?: string; 
  mediaMap: Record<string, string>; 
  inline?: boolean;
}) {
  if (!content) return null;
  const cleanContent = content.replace(/\\langle\s*\(\)\s*|\\langle\s*|\\rangle\s*|\\sqrt\{\s*\}|\(\)/g, "");
  const parts = cleanContent.split(/(\[img:[^\]]+\]|\$\$[\s\S]*?\$$|\$[\s\S]*?\$)/g);

  return (
    <div className={inline ? "inline leading-relaxed text-slate-800 text-[13px] break-words" : "leading-relaxed text-slate-800 text-[14px] whitespace-pre-wrap break-words"}>
      {parts.map((part, idx) => {
        if (!part) return null;
        const imgMatch = part.match(/^\[img:([^\]]+)\]$/);
        if (imgMatch && imgMatch[1]) {
          let rawKey = imgMatch[1].trim();
          if (rawKey.startsWith("$") && rawKey.endsWith("$")) {
            rawKey = rawKey.slice(1, -1);
          }
          const isDirectUrl = rawKey.startsWith("http://") || rawKey.startsWith("https://") || rawKey.startsWith("data:");
          const src = isDirectUrl ? rawKey : mediaMap[rawKey];
          if (!src) return null;

          return inline ? (
            <img 
              key={idx} 
              src={src} 
              alt="Ảnh" 
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              className="inline-block max-h-12 align-middle mx-1 my-0.5 object-contain rounded border border-slate-100 bg-white" 
            />
          ) : (
            <div key={idx} className="my-3 text-center flex flex-col items-center justify-center">
              <img 
                src={src} 
                alt="Hình minh họa" 
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                className="max-h-72 max-w-full rounded-xl border border-slate-200/90 bg-white shadow-sm p-1.5 object-contain inline-block" 
              />
            </div>
          );
        }
        if (part.startsWith("$") && part.endsWith("$")) {
          const isDisplay = part.startsWith("$$");
          let mathStr = isDisplay ? part.slice(2, -2) : part.slice(1, -1);
          mathStr = mathStr.replace(/\\langle\s*\(\)\s*|\\langle\s*|\\rangle\s*|\\sqrt\{\s*\}|\(\)/g, "").trim();
          if (!mathStr) return null;
          try {
            return (
              <span 
                key={idx} 
                className={isDisplay ? "block my-2 text-center" : "inline-block align-middle px-0.5 text-[15px] font-serif"} 
                dangerouslySetInnerHTML={{ 
                  __html: katex.renderToString(mathStr, { displayMode: isDisplay, throwOnError: false }) 
                }} 
              />
            );
          } catch {
            return <span key={idx} className="text-slate-700 font-mono">{mathStr}</span>;
          }
        }
        return <span key={idx}>{part}</span>;
      })}
    </div>
  );
}

// ============================================================================
// 4. COMPONENT MODAL AZOTA CHÍNH (FULL MÀN HÌNH + THANG ĐIỂM 10 + CHÈN ẢNH)
// ============================================================================

interface AzotaExamConfigModalProps {
  isOpen: boolean;
  file: File | null;
  mode: "course" | "practice";
  onClose: () => void;
  onSave: (examData: any) => void;
}

export function AzotaExamConfigModal({ isOpen, file
