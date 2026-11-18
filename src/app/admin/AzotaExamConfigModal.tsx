"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  Loader2, Layers, CheckCircle2, XCircle, PenTool, CircleDot, 
  CheckSquare, AlignLeft, Edit3, Sigma, Eye, AlertTriangle, 
  ArrowRight, ArrowLeft, Settings2, Clock, Play, Sparkles, X, Link as LinkIcon, Video,
  BookOpen, ChevronDown, ChevronUp, Check, RefreshCw, FolderCheck, ImagePlus, Calculator, Wand2, Percent, FileText,
  Hash, Lock, Unlock, Plus, FilePlus2, Trash2
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

export type HsaPartKey = "quant" | "qual" | "english" | "history_geo";

export const HSA_PART_CONFIG: Record<
  HsaPartKey,
  {
    key: HsaPartKey;
    label: string;
    shortTitle: string;
    headerTitle: string;
    defaultDuration: number;
    maxPoints: number;
    order: number;
  }
> = {
  quant: {
    key: "quant",
    label: "Phần 1: Tư duy Định lượng (Toán học & Xử lý số liệu - 75 phút - 50 điểm)",
    shortTitle: "Tư duy Định lượng",
    headerTitle: "TOÁN HỌC & XỬ LÝ SỐ LIỆU",
    defaultDuration: 75,
    maxPoints: 50,
    order: 1,
  },
  qual: {
    key: "qual",
    label: "Phần 2: Tư duy Định tính (Ngôn ngữ - Văn học - 60 phút - 50 điểm)",
    shortTitle: "Tư duy Định tính",
    headerTitle: "NGÔN NGỮ - VĂN HỌC",
    defaultDuration: 60,
    maxPoints: 50,
    order: 2,
  },
  english: {
    key: "english",
    label: "Phần 3 (Tự chọn 1): Tiếng Anh (60 phút - 50 điểm)",
    shortTitle: "Tự chọn 1: Tiếng Anh",
    headerTitle: "TIẾNG ANH",
    defaultDuration: 60,
    maxPoints: 50,
    order: 3,
  },
  history_geo: {
    key: "history_geo",
    label: "Phần 3 (Tự chọn 2): Khoa học (Lịch sử - Địa lý - 60 phút - 50 điểm)",
    shortTitle: "Tự chọn 2: Khoa học (Sử - Địa)",
    headerTitle: "KHOA HỌC (LỊCH SỬ - ĐỊA LÝ)",
    defaultDuration: 60,
    maxPoints: 50,
    order: 4,
  },
};

export interface ExtendedParsedQuestion extends ParsedQuestion {
  points?: number;
  sub_points?: Record<string, number>;
  sub_percentages?: Record<string, number>;
  image?: string;
  passage_html?: string;
  group_id?: string;
  group_passage?: string;
  part_key?: string;
  media_map?: Record<string, string>;
  mediaMap?: Record<string, string>;
}

export interface ExtendedExamSection extends ExamSection {
  key?: string;
  part_key?: HsaPartKey | string;
  title?: string;
  headerTitle?: string;
  shortTitle?: string;
  duration_minutes?: number;
  durationMinutes?: number;
  max_points?: number;
  maxScore?: number;
  raw_source_text?: string;
  questions: ExtendedParsedQuestion[];
  media_map?: Record<string, string>;
  mediaMap?: Record<string, string>;
}

// ============================================================================
// 1. ENGINE DỊCH MATHTYPE & OMML SANG LATEX CHUẨN XÁC
// ============================================================================

function isCleanLatex(latex: string): boolean {
  if (!latex || typeof latex !== "string") return false;
  const trimmed = latex.trim();
  if (trimmed.length < 1) return false;

  if (trimmed === "()" || trimmed === "[]" || trimmed === "{}" || trimmed === "\\left(\\right)" || trimmed === "$$") {
    return false;
  }

  if (/MathType|DSMT|WinAllBasic|Courier|MTExtra|CompObj|OleObject|Times New Roman|Symbol|Word\.Document/i.test(trimmed)) {
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

  return true;
}

function convertOmmlToLatex(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  const el = node as Element;
  const name = el.localName || el.nodeName?.split(":").pop() || "";
  
  if (name === "t") return el.textContent || "";
  
  if (name === "f") {
    const num = Array.from(el.childNodes).find((n: any) => (n.localName || n.nodeName || "").includes("num")) as any;
    const den = Array.from(el.childNodes).find((n: any) => (n.localName || n.nodeName || "").includes("den")) as any;
    return "\\frac{" + (num ? convertOmmlToLatex(num) : "") + "}{" + (den ? convertOmmlToLatex(den) : "") + "}";
  }
  
  if (name === "sSup") {
    const e = Array.from(el.childNodes).find((n: any) => (n.localName || n.nodeName || "") === "e") as any;
    const sup = Array.from(el.childNodes).find((n: any) => (n.localName || n.nodeName || "") === "sup") as any;
    return "{" + (e ? convertOmmlToLatex(e) : "") + "}^{" + (sup ? convertOmmlToLatex(sup) : "") + "}";
  }
  
  if (name === "sSub") {
    const e = Array.from(el.childNodes).find((n: any) => (n.localName || n.nodeName || "") === "e") as any;
    const sub = Array.from(el.childNodes).find((n: any) => (n.localName || n.nodeName || "") === "sub") as any;
    return "{" + (e ? convertOmmlToLatex(e) : "") + "}_{" + (sub ? convertOmmlToLatex(sub) : "") + "}";
  }
  
  if (name === "sSubSup") {
    const e = Array.from(el.childNodes).find((n: any) => (n.localName || n.nodeName || "") === "e") as any;
    const sub = Array.from(el.childNodes).find((n: any) => (n.localName || n.nodeName || "") === "sub") as any;
    const sup = Array.from(el.childNodes).find((n: any) => (n.localName || n.nodeName || "") === "sup") as any;
    return "{" + (e ? convertOmmlToLatex(e) : "") + "}_{" + (sub ? convertOmmlToLatex(sub) : "") + "}^{" + (sup ? convertOmmlToLatex(sup) : "") + "}";
  }
  
  if (name === "d") {
    const e = Array.from(el.childNodes).find((n: any) => (n.localName || n.nodeName || "") === "e") as any;
    const inner = e ? convertOmmlToLatex(e).trim() : "";
    if (!inner) return "";
    return "\\left(" + inner + "\\right)";
  }
  
  if (name === "rad") {
    const degNode = Array.from(el.childNodes).find((n: any) => (n.localName || n.nodeName || "").includes("deg")) as any;
    const eNode = Array.from(el.childNodes).find((n: any) => (n.localName || n.nodeName || "") === "e") as any;
    
    const degStr = degNode ? convertOmmlToLatex(degNode).trim() : "";
    const eStr = eNode ? convertOmmlToLatex(eNode).trim() : "";
    
    if (degStr && degStr !== "") {
      return "\\sqrt[" + degStr + "]{" + eStr + "}";
    }
    return "\\sqrt{" + (eStr || "") + "}";
  }

  if (name === "acc") {
    const e = Array.from(el.childNodes).find((n: any) => (n.localName || n.nodeName || "") === "e") as any;
    const inner = e ? convertOmmlToLatex(e).trim() : "";
    return "\\vec{" + inner + "}";
  }

  if (name === "bar") {
    const e = Array.from(el.childNodes).find((n: any) => (n.localName || n.nodeName || "") === "e") as any;
    return "\\overline{" + (e ? convertOmmlToLatex(e) : "") + "}";
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

const SYMBOL_MAP: Record<number, string> = {
  0x03B1: "\\alpha", 0x03B2: "\\beta", 0x03B3: "\\gamma", 0x03B4: "\\delta",
  0x03C0: "\\pi", 0x03B8: "\\theta", 0x03BB: "\\lambda", 0x03BC: "\\mu",
  0x03C3: "\\sigma", 0x03C9: "\\omega", 0x0394: "\\Delta", 0x03A9: "\\Omega",
  0x00B1: "\\pm ", 0x00D7: "\\times ", 0x00F7: "\\div ", 0x2264: "\\le ",
  0x2265: "\\ge ", 0x2260: "\\ne ", 0x221E: "+\\infty ", 0x2208: "\\in ",
  0x2192: "\\to ", 0x21D2: "\\Rightarrow ", 0x2248: "\\approx ",
  0x2205: "\\emptyset ", 0x2229: "\\cap ", 0x222A: "\\cup ",
  0x2212: "-", 0x2013: "-", 0x2014: "-", 0x003E: ">", 0x003C: "<",
  0x003B: "; ", 0x002C: ", ", 0x2225: "\\parallel ", 0x22A5: "\\perp ",
  0x2220: "\\angle ", 0x00B0: "^\\circ ", 0x2216: "\\setminus "
};

function decodeMtefToLatex(uint8: Uint8Array): string {
  const minBytes = 16;
  if (!uint8 || uint8.length < minBytes) return "";
  let start = -1;

  const searchBoundary = uint8.length - 12;
  for (let i = 0; i < searchBoundary; i++) {
    if ((uint8[i] === 2 || uint8[i] === 3 || uint8[i] === 5) && 
        (uint8[i + 1] === 0 || uint8[i + 1] === 1) && 
        (uint8[i + 2] === 0 || uint8[i + 2] === 1) && 
        uint8[i + 3] >= 1 && uint8[i + 3] <= 15) {
      start = i;
      break;
    }
  }

  if (start === -1) {
    const deepBoundary = uint8.length - 24;
    for (let i = 0; i < deepBoundary; i++) {
      if (uint8[i] === 0x1C && uint8[i + 1] === 0x00) {
        for (let j = i; j < Math.min(uint8.length - 6, i + 64); j++) {
          if (uint8[j] === 2 || uint8[j] === 3 || uint8[j] === 5) {
            start = j;
            break;
          }
        }
        if (start !== -1) break;
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
        let chCode = 0;
        if (version >= 5) {
          chCode = reader.readUint16();
        } else {
          chCode = (opts & 0x01) ? reader.readUint16() : reader.readByte();
        }

        if (opts & 0x02) {
          const emb = reader.readByte();
          if (emb === 5 || emb === 4) res.push("'");
          else if (emb === 6) res.push("''");
        }
        if (SYMBOL_MAP[chCode]) {
          res.push(SYMBOL_MAP[chCode]);
        } else if (chCode >= 32 && chCode <= 126) {
          res.push(String.fromCharCode(chCode));
        } else if (chCode === 0xBA) {
          res.push("\\equiv ");
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
          const inner = parseLine().trim();
          if (inner) res.push("\\left(" + inner + "\\right)");
        } else if (selector === 2) { 
          const inner = parseLine().trim();
          if (inner) res.push("\\left\\{" + inner + "\\right\\}");
        } else if (selector === 3) { 
          const inner = parseLine().trim();
          if (inner) res.push("\\left[" + inner + "\\right]");
        } else if (selector === 4) { 
          const inner = parseLine().trim();
          if (inner) res.push("\\left|" + inner + "\\right|");
        } else if (selector === 10 || selector === 13) { 
          if (variation === 1) { 
            const deg = parseLine();
            const rad = parseLine();
            res.push("\\sqrt[" + deg + "]{" + (rad || "") + "}");
          } else { 
            const rad = parseLine();
            res.push("\\sqrt{" + (rad || "") + "}");
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
        } else if (selector === 19) { 
          const body = parseLine().trim();
          res.push("\\vec{" + body + "}");
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
        if (embType === 5 || embType === 4) res.push("'");
        else if (embType === 6) res.push("''");
      }
    }
    return res.join("");
  };

  try {
    let raw = parseLine().trim();
    raw = raw.replace(/\\left\(\s*\\right\)|\(\s*\)|\\langle\s*\(\)\s*/g, "").trim();
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

export function repairMathTypeGlitch(raw: string): string {
  if (!raw) return "";
  let text = raw;

  text = text.replace(/\\left\(\s*\\right\)/g, "");
  text = text.replace(/\(\s*\)/g, "");

  text = text.replace(/[\u02B9\u2032\u2019]/g, "'");
  text = text.replace(/([A-Za-z0-9\)])\s*'\s*'/g, "$1''");

  text = text.replace(/(\\right\))\s*\\\{([0-9a-zA-Z\s;,]+)\\\}/g, "$1 \\setminus \\{$2\\}");
  text = text.replace(/([0-9a-zA-Z\)])\s*\\\{([0-9a-zA-Z\s;,]+)\\\}/g, "$1 \\setminus \\{$2\\}");

  text = text.replace(/(?:\$)?\b([A-Z]{2}(?:')?)\s*\+\s*([A-Z]{2}(?:')?)(?:\s*\+\s*([A-Z]{2}(?:')?))?\s*=\s*([A-Z]{2}(?:')?)\b(?:\$)?/g, (match, v1, v2, v3, v4) => {
    if (v3) {
      return "$\\vec{" + v1 + "} + \\vec{" + v2 + "} + \\vec{" + v3 + "} = \\vec{" + v4 + "}$";
    }
    return "$\\vec{" + v1 + "} + \\vec{" + v2 + "} = \\vec{" + v4 + "}$";
  });

  text = text.replace(/([a-zA-Z0-9\)\}])\s*>>\s*(\$|\s|\.|\,|$)/g, "$1 > 0$2");
  text = text.replace(/([a-zA-Z0-9\)\}])\s*><\s*(\$|\s|\.|\,|$)/g, "$1 < 0$2");
  text = text.replace(/\$([a-zA-Z0-9])>>\$/g, "$$$1 > 0$$");
  text = text.replace(/\$([a-zA-Z0-9])><\$/g, "$$$1 < 0$$");
  text = text.replace(/([a-zA-Z0-9])>>/g, "$1 > 0");
  text = text.replace(/([a-zA-Z0-9])><(?!\w)/g, "$1 < 0");

  text = text.replace(/([a-zA-Z0-9])\^\{\{\}\}/g, "$1");
  text = text.replace(/\$([a-zA-Z0-9])\.\^\{\}\$/g, "$$$1$$");
  text = text.replace(/\$([a-zA-Z0-9])\^\{\}\$/g, "$$$1$$");

  return text;
}

// ============================================================================
// 2. TRÍCH XUẤT ĐỆ QUY FILE WORD (.DOCX) - LƯU BASE64 VĨNH CỬU CHUẨN XÁC
// ============================================================================

export async function extractDocxDirectly(file: File, keyPrefix: string = "img_") {
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
  const pathToToken: Record<string, string> = {};
  const relIdToToken: Record<string, string> = {};

  for (const [rId, path] of Object.entries(relsMap)) {
    const zipPath = path.startsWith("word/") ? path : ("word/" + path);
    const fileEntry = zip.files[zipPath];
    if (fileEntry && /\.(png|jpe?g|gif|webp|svg)$/i.test(zipPath)) {
      if (!pathToToken[zipPath]) {
        const b64 = await fileEntry.async("base64");
        let ext = "jpeg";
        if (zipPath.toLowerCase().endsWith("png")) ext = "png";
        else if (zipPath.toLowerCase().endsWith("svg")) ext = "svg+xml";
        else if (zipPath.toLowerCase().endsWith("webp")) ext = "webp";
        else if (zipPath.toLowerCase().endsWith("gif")) ext = "gif";
        
        const key = keyPrefix + (imgCount++);
        // BẮT BUỘC LƯU DATAURL ĐỂ ẢNH VĨNH CỬU KHÔNG BỊ REVOKE
        mediaMap[key] = `data:image/${ext};base64,${b64}`;
        pathToToken[zipPath] = "[img:$" + key + "$]";
      }
      relIdToToken[rId] = pathToToken[zipPath];
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

    const fallbackText = Array.from(objNode.getElementsByTagNameNS("*", "t"))
      .map((t: any) => t.textContent || "")
      .join("")
      .trim();
    if (fallbackText && isCleanLatex(fallbackText)) {
      return " $" + fallbackText + "$ ";
    }

    for (const el of allDescendants) {
      const rId = el.getAttribute("r:id") || el.getAttribute("r:embed") || el.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || el.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
      if (rId && relIdToToken[rId]) {
        return " " + relIdToToken[rId] + " ";
      }
    }

    return "";
  };

  const processParagraphNode = (p: Element): string => {
    let line = "";

    const traverse = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) return;
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const el = node as Element;
      const name = el.localName || el.nodeName?.split(":").pop() || "";

      if (name === "oMath" || name === "oMathPara") {
        const latex = convertOmmlToLatex(el).trim();
        if (latex) line += " $" + latex + "$ ";
        return;
      }
      
      if (name === "object") {
        line += processOleObject(el);
        return;
      }
      
      if (name === "blip" || name === "imagedata") {
        const rId = el.getAttribute("r:embed") || el.getAttribute("r:id") || el.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed") || el.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
        if (rId && relIdToToken[rId]) {
          line += " " + relIdToToken[rId] + " ";
        }
        return;
      }

      if (name === "t") {
        line += el.textContent || "";
        return;
      }

      for (let i = 0; i < el.childNodes.length; i++) {
        traverse(el.childNodes[i]);
      }
    };

    traverse(p);
    return line.trim();
  };

  const rawLines: string[] = [];
  const body = docXml.getElementsByTagName("w:body")[0] || docXml.documentElement;

  const traverseNodes = (parent: Element) => {
    Array.from(parent.childNodes).forEach(node => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      const name = el.localName || el.nodeName?.split(":").pop() || "";

      if (name === "p") {
        const line = processParagraphNode(el);
        if (line) rawLines.push(repairMathTypeGlitch(line));
      } else if (name === "tbl") {
        const rows = Array.from(el.getElementsByTagNameNS("*", "tr"));
        rows.forEach(tr => {
          const cells = Array.from(tr.getElementsByTagNameNS("*", "tc"));
          const cellTexts: string[] = [];
          cells.forEach(tc => {
            const pList = Array.from(tc.getElementsByTagNameNS("*", "p"));
            const pTexts = pList.map(p => processParagraphNode(p as Element)).filter(Boolean);
            if (pTexts.length > 0) cellTexts.push(pTexts.join(" "));
          });
          if (cellTexts.length > 0) {
            rawLines.push(repairMathTypeGlitch(cellTexts.join("\t")));
          }
        });
      } else {
        traverseNodes(el);
      }
    });
  };

  traverseNodes(body);

  const initialText = rawLines.join("\n").normalize("NFC");
  return { text: initialText, mediaMap };
}

// ============================================================================
// 3. TỰ ĐỘNG CHUẨN HÓA THỨ TỰ CÂU HỎI, CÂU HỎI CHÙM, NGỮ LIỆU ĐỌC HIỂU & ĐÁP ÁN
// ============================================================================

export function autoNormalizeQuestions(rawText: string): string {
  if (!rawText) return "";
  let text = rawText.normalize("NFC");

  let globalCount = 1;
  text = text.replace(/(?:^|[\r\n]+)\s*(?:Câu|Bài|Question)\s*\d+[:.\-\)]?\s*/gi, () => {
    return "\n\nCâu " + (globalCount++) + ": ";
  });

  return text.trim();
}

export function normalizeOptionsSmart(text: string): string {
  if (!text) return "";
  let res = text;
  res = res.replace(/(\S+)\s*\.([B-D]\.)/g, "$1.\n$2");
  res = res.replace(/(?:\t|[ ]{2,})([A-D]\.|\([A-D]\)|[A-D]\)|[a-d]\))/g, "\n$1");
  res = res.replace(/([^\n\r])\s+([B-D]\.|\([B-D]\)|[B-D]\))/g, "$1\n$2");
  return res;
}

const SECTION_HEADER_REGEX = /(?:^|[\r\n]+)\s*((?:(?:Phần|PHẦN)\s*(?:[IVX]+|\d+)|(?:I{1,3}|IV)\.)\s*[:\-]?[^\r\n]*)/gi;
const PASSAGE_BLOCK_REGEX = /\[(?:NGU_LIEU|NGỮ_LIỆU|NGU\s*LIEU|NGỮ\s*LIỆU|PASSAGE)\]([\s\S]*?)\[\/(?:NGU_LIEU|NGỮ_LIỆU|NGU\s*LIEU|NGỮ\s*LIỆU|PASSAGE)\]/gi;

// Regex nhận diện "Câu hỏi chùm:", "Hết câu hỏi chùm", "=== Hết câu hỏi chùm ===" và "Câu đơn:"
const GROUP_START_LINE_REGEX = /^\s*(?:\*{1,2})?Câu\s*hỏi\s*chùm\s*:\s*(?:\*{1,2})?(.*)$/i;
const GROUP_END_LINE_REGEX = /^\s*(?:={2,}\s*)?Hết\s*câu\s*hỏi\s*chùm(?:\s*={2,})?\s*$/i;
const SINGLE_QUESTION_MARKER_REGEX = /^\s*(?:\*{1,2})?Câu\s*đơn\s*:?\s*(?:\*{1,2})?(.*)$/i;

function getSectionTypeFromTitle(title: string): QuestionType {
  if (/đúng\s*sai|true\s*false/i.test(title)) return "true_false";
  if (/trả\s*lời\s*ngắn|điền\s*khuyết|short\s*answer/i.test(title)) return "short_answer";
  return "multiple_choice";
}

function processBodyAndNumberQuestions(text: string, startQIdx: number, secType: QuestionType): { labeledText: string; nextQIdx: number } {
  let norm = normalizeOptionsSmart(text);

  if (secType === "true_false") {
    norm = norm.replace(/((?:^|[\r\n]+)Câu\s*\d+[:.\s]+[\s\S]*?)([\r\n]+)(?![a-d]\))([^\r\n]+)([\r\n]+)(?![a-d]\))([^\r\n]+)([\r\n]+)(?![a-d]\))([^\r\n]+)([\r\n]+)(?![a-d]\))([^\r\n]+)(?=[\r\n]+(?:Lời\s*giải|Đáp\s*án|Câu|$))/gi, 
      (m, head, r1, l1, r2, l2, r3, l3, r4, l4) => {
        if (/Lời\s*giải|Đáp\s*án|Chọn/i.test(l1)) return m;
        return head + "\na) " + l1 + "\nb) " + l2 + "\nc) " + l3 + "\nd) " + l4;
      }
    );
  }

  // Nếu văn bản có chứa "Câu hỏi chùm:", chỉ đánh số lại các dòng Câu <số>: mà bảo toàn nguyên vẹn vị trí các khối Câu hỏi chùm: / Hết câu hỏi chùm / Câu đơn:
  if (/câu\s*hỏi\s*chùm\s*:/i.test(norm)) {
    let cur = startQIdx;
    const updated = norm.replace(
      /(?:^|[\r\n]+)\s*(?:Câu|Bài|Question)\s*\d+[:.]?\s*/gi,
      () => "\n\nCâu " + (cur++) + ": \n"
    );
    return { labeledText: updated.trim(), nextQIdx: cur };
  }

  // Bảo toàn khối [NGU_LIEU]...[/NGU_LIEU] đặt trước Câu hỏi đầu tiên của đoạn (100% logic cũ khi không có Câu hỏi chùm:)
  const qSplitRegex = /(?:^|[\r\n]+)(?=(?:Câu|Bài|Question)\s*\d+[:.]?\s*)/gi;
  const rawPieces = norm.split(qSplitRegex).map(s => s.trim()).filter(Boolean);

  if (rawPieces.length > 0) {
    let cur = startQIdx;
    let pendingPrefixPassage = "";
    const pieces: string[] = [];

    for (const chunk of rawPieces) {
      if (/^(?:Câu|Bài|Question)\s*\d+[:.]?\s*/i.test(chunk)) {
        const bodyWithoutHeader = chunk.replace(/^(?:Câu|Bài|Question)\s*\d+[:.]?\s*/i, "").trim();
        const combined = pendingPrefixPassage
          ? pendingPrefixPassage + "\n" + bodyWithoutHeader
          : bodyWithoutHeader;
        pendingPrefixPassage = "";
        pieces.push("Câu " + (cur++) + ": \n" + combined);
      } else {
        pendingPrefixPassage = pendingPrefixPassage
          ? pendingPrefixPassage + "\n\n" + chunk
          : chunk;
      }
    }

    if (pendingPrefixPassage && pieces.length === 0) {
      return { labeledText: norm, nextQIdx: startQIdx };
    }
    return { labeledText: pieces.join("\n\n"), nextQIdx: cur };
  }

  return { labeledText: norm, nextQIdx: startQIdx };
}

export function injectQuestionLabelsIfMissing(rawText: string): string {
  if (!rawText) return "";
  let text = rawText.normalize("NFC");
  text = repairMathTypeGlitch(text);
  text = normalizeOptionsSmart(text);

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

function parseSingleQuestionChunk(
  chunk: string,
  qIndex: number,
  sectionTitle: string,
  sectionType: QuestionType,
  sectionIndex: number,
  groupMeta?: { group_id: string; group_passage: string }
): ExtendedParsedQuestion {
  let norm = chunk.normalize("NFC").trim();
  norm = repairMathTypeGlitch(norm);
  norm = normalizeOptionsSmart(norm);

  // Tách khối [NGU_LIEU]...[/NGU_LIEU] nếu nằm trong chunk câu hỏi
  let extractedPassages: string[] = [];
  norm = norm.replace(PASSAGE_BLOCK_REGEX, (_, pContent) => {
    if (pContent && pContent.trim()) {
      extractedPassages.push(pContent.trim());
    }
    return "";
  });
  const chunkPassageHtml =
    groupMeta?.group_passage ||
    (extractedPassages.length > 0 ? extractedPassages.join("\n\n") : undefined);

  const cleanChunk = (norm || "")
    .replace(/^\s*(?:\*{1,2})?(?:(?:Câu|Bài|Question)\s*\d+[:.\-\)]?|\d+[\.:\)])\s*(?:\*{1,2})?[:.\-\s]*/gi, "")
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

    const fullTextSearch = cleanChunk + " " + solutionText;
    const compactAnsMatch = fullTextSearch.match(/Đáp\s*án\s*:\s*([ĐđSsTtFf\s\/\,\-]+)/i);
    if (compactAnsMatch && compactAnsMatch[1]) {
      const letters = compactAnsMatch[1].replace(/[^ĐđSsTtFf]/g, "").toUpperCase().split("");
      if (letters.length >= 4) {
        options[0].is_true_false_ans = (letters[0] === "Đ" || letters[0] === "T");
        options[1].is_true_false_ans = (letters[1] === "Đ" || letters[1] === "T");
        options[2].is_true_false_ans = (letters[2] === "Đ" || letters[2] === "T");
        options[3].is_true_false_ans = (letters[3] === "Đ" || letters[3] === "T");
      }
    }

    if (solutionText) {
      const solLines = solutionText.split(/[\r\n]+/);
      let foundLineIndex = 0;
      solLines.forEach(line => {
        const trimmed = line.trim();
        if (/^Đúng\s*:/i.test(trimmed) && foundLineIndex < 4) {
          options[foundLineIndex].is_true_false_ans = true;
          foundLineIndex++;
        } else if (/^Sai\s*:/i.test(trimmed) && foundLineIndex < 4) {
          options[foundLineIndex].is_true_false_ans = false;
          foundLineIndex++;
        }
      });
    }

    return {
      id: uniqueId,
      order_index: qIndex,
      section_title: sectionTitle,
      type: "true_false",
      original_label: "Câu " + qIndex,
      prompt_html: promptHtml,
      passage_html: chunkPassageHtml,
      group_id: groupMeta?.group_id,
      group_passage: groupMeta?.group_passage,
      options,
      correct_answer: options.map(o => (o.is_true_false_ans ? "Đ" : "S")).join(""),
      solution_html: solutionText,
      points: 1.0,
      sub_percentages: { a: 25, b: 25, c: 25, d: 25 },
      sub_points: { a: 0.25, b: 0.25, c: 0.25, d: 0.25 }
    };
  }

  if (sectionType === "short_answer") {
    let correctAns = "";
    const ansMatch = /(?:Đáp\s*án|Đáp\s*số|KQ|Kết\s*quả)[:\s]+([^Lời\r\n]+)/i.exec(cleanChunk + " " + solutionText);
    if (ansMatch && ansMatch[1]) {
      correctAns = ansMatch[1].replace(/Lời\s*giải.*$/i, "").trim();
    }
    return {
      id: uniqueId,
      order_index: qIndex,
      section_title: sectionTitle,
      type: "short_answer",
      original_label: "Câu " + qIndex,
      prompt_html: promptAndOpts,
      passage_html: chunkPassageHtml,
      group_id: groupMeta?.group_id,
      group_passage: groupMeta?.group_passage,
      options: [],
      correct_answer: correctAns,
      solution_html: solutionText,
      points: 0.5
    };
  }

  let correctAns = "A";
  const ansMatch = /(?:Chọn|Đáp\s*án|Đáp\s*số)\s*(?:đáp\s*án\s*)?([A-D])\b/i.exec(cleanChunk + " " + solutionText);
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
      .replace(/\\left\(\s*\\right\)|\(\s*\)/g, "")
      .trim();

    options[0].text_html = cleanOpt(textA);
    options[1].text_html = cleanOpt(textB);
    options[2].text_html = cleanOpt(textC);
    options[3].text_html = cleanOpt(textD);
  } else {
    // Nếu trong phần HSA (ví dụ câu điền đáp án của Tư duy định lượng không có A/B/C/D)
    const shortAnsMatch = /(?:Đáp\s*án|Đáp\s*số|KQ|Kết\s*quả)[:\s]+([^Lời\r\n]+)/i.exec(cleanChunk + " " + solutionText);
    if (shortAnsMatch && shortAnsMatch[1]) {
      return {
        id: uniqueId,
        order_index: qIndex,
        section_title: sectionTitle,
        type: "short_answer",
        original_label: "Câu " + qIndex,
        prompt_html: promptAndOpts.replace(/(?:Đáp\s*án|Đáp\s*số|KQ|Kết\s*quả)[:\s]+[^\r\n]+/gi, "").trim(),
        passage_html: chunkPassageHtml,
        group_id: groupMeta?.group_id,
        group_passage: groupMeta?.group_passage,
        options: [],
        correct_answer: shortAnsMatch[1].replace(/Lời\s*giải.*$/i, "").trim(),
        solution_html: solutionText,
        points: 0.5
      };
    }
  }

  return {
    id: uniqueId,
    order_index: qIndex,
    section_title: sectionTitle,
    type: "multiple_choice",
    original_label: "Câu " + qIndex,
    prompt_html: promptHtml,
    passage_html: chunkPassageHtml,
    group_id: groupMeta?.group_id,
    group_passage: groupMeta?.group_passage,
    options,
    correct_answer: correctAns,
    solution_html: solutionText,
    points: 0.25
  };
}

/**
 * Gán ngữ liệu đọc hiểu `[NGU_LIEU]...[/NGU_LIEU]` cho các câu hỏi liên tiếp trong cùng nhóm đọc hiểu
 */
function propagateReadingPassages(questions: ExtendedParsedQuestion[]): ExtendedParsedQuestion[] {
  let activePassage: string | undefined = undefined;
  let activeGroupId: string | undefined = undefined;
  let activeRangeEnd: number | null = null;
  let passageCounter = 1;

  return questions.map((q, idx) => {
    const qNum = q.order_index || idx + 1;
    let prompt = q.prompt_html || "";

    // Nếu câu hỏi đã được gắn group_id & group_passage từ bộ nhận diện "Câu hỏi chùm:", giữ nguyên
    if (q.group_id && q.group_passage) {
      return {
        ...q,
        passage_html: q.passage_html || q.group_passage,
      };
    }

    if (/\[\/(?:KET_THUC_NGU_LIEU|END_PASSAGE)\]/i.test(prompt)) {
      prompt = prompt.replace(/\[\/(?:KET_THUC_NGU_LIEU|END_PASSAGE)\]/gi, "").trim();
      activePassage = undefined;
      activeGroupId = undefined;
      activeRangeEnd = null;
    }

    if (q.passage_html) {
      activePassage = q.passage_html;
      activeGroupId = "grp-" + Date.now() + "-" + (passageCounter++);
      const rangeMatch = (q.passage_html + " " + prompt).match(/(?:câu|question)\s*(\d+)\s*(?:đến|tới|\-|–|~|to)\s*(?:câu|question)?\s*(\d+)/i);
      if (rangeMatch && rangeMatch[2]) {
        activeRangeEnd = parseInt(rangeMatch[2], 10);
      } else {
        activeRangeEnd = qNum + 4;
      }
    }

    const isWithinActivePassage =
      Boolean(activePassage) && (activeRangeEnd === null || qNum <= activeRangeEnd);

    const assignedPassage = q.passage_html || (isWithinActivePassage ? activePassage : undefined);
    const assignedGroupId = q.group_id || (assignedPassage ? activeGroupId : undefined);

    return {
      ...q,
      prompt_html: prompt,
      passage_html: assignedPassage,
      group_id: assignedGroupId,
      group_passage: assignedPassage,
    };
  });
}

/**
 * Tách câu hỏi có hỗ trợ nhận diện tự động từ khóa "Câu hỏi chùm:"
 * - Khi gặp dòng bắt đầu bằng "Câu hỏi chùm:", gom toàn bộ văn bản + hình ảnh từ sau dấu ":" đến trước câu hỏi con đầu tiên làm `group_passage`, sinh `group_id = "grp-" + Date.now() + "-" + idx`.
 * - Gắn `group_id` và `group_passage` cho tất cả các câu hỏi con liên tiếp phía sau cho đến khi gặp "Hết câu hỏi chùm", "=== Hết câu hỏi chùm ===", khối "Câu hỏi chùm:" mới, hoặc "Câu đơn:".
 */
function parseQuestionsWithClusterSupport(
  content: string,
  secTitle: string,
  secType: QuestionType,
  sIdx: number
): ExtendedParsedQuestion[] {
  const lines = content.split(/\r?\n/);
  const qHeaderLineRegex = /^\s*(?:\*{1,2})?(?:Câu|Bài|Question)\s*(\d+)[:.\-\)]?\s*(?:\*{1,2})?(.*)$/i;

  let groupIdxCounter = 1;
  let currentGroupId: string | undefined = undefined;
  let currentGroupPassageLines: string[] = [];
  let isCollectingGroupPassage = false;

  const collectedQuestions: {
    qNum: number;
    label: string;
    lines: string[];
    groupId?: string;
    groupPassage?: string;
  }[] = [];

  let activeQuestion: {
    qNum: number;
    label: string;
    lines: string[];
    groupId?: string;
    groupPassage?: string;
  } | null = null;

  const flushActiveQuestion = () => {
    if (activeQuestion) {
      collectedQuestions.push(activeQuestion);
      activeQuestion = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Kiểm tra dòng bắt đầu "Câu hỏi chùm:"
    const groupStartMatch = line.match(GROUP_START_LINE_REGEX);
    if (groupStartMatch) {
      flushActiveQuestion();
      currentGroupId = "grp-" + Date.now() + "-" + (groupIdxCounter++);
      currentGroupPassageLines = [];
      const afterColon = (groupStartMatch[1] || "").trim();
      if (afterColon) {
        currentGroupPassageLines.push(afterColon);
      }
      isCollectingGroupPassage = true;
      continue;
    }

    // 2. Kiểm tra dòng kết thúc "Hết câu hỏi chùm" hoặc "=== Hết câu hỏi chùm ==="
    if (GROUP_END_LINE_REGEX.test(line)) {
      flushActiveQuestion();
      currentGroupId = undefined;
      currentGroupPassageLines = [];
      isCollectingGroupPassage = false;
      continue;
    }

    // 3. Kiểm tra dòng đánh dấu "Câu đơn:"
    const singleMarkerMatch = line.match(SINGLE_QUESTION_MARKER_REGEX);
    if (singleMarkerMatch) {
      flushActiveQuestion();
      currentGroupId = undefined;
      currentGroupPassageLines = [];
      isCollectingGroupPassage = false;
      const remainder = (singleMarkerMatch[1] || "").trim();
      if (remainder) {
        const inlineQMatch = remainder.match(qHeaderLineRegex);
        if (inlineQMatch) {
          const qNum = parseInt(inlineQMatch[1], 10);
          activeQuestion = {
            qNum,
            label: "Câu " + qNum,
            lines: [inlineQMatch[2] || ""],
          };
        }
      }
      continue;
    }

    // 4. Kiểm tra dòng bắt đầu "Câu <số>:"
    const qMatch = line.match(qHeaderLineRegex);
    if (qMatch) {
      flushActiveQuestion();
      isCollectingGroupPassage = false;
      const qNum = parseInt(qMatch[1], 10);
      const passageStr =
        currentGroupId && currentGroupPassageLines.length > 0
          ? currentGroupPassageLines.join("\n").trim()
          : undefined;

      activeQuestion = {
        qNum,
        label: "Câu " + qNum,
        lines: [qMatch[2] || ""],
        groupId: currentGroupId,
        groupPassage: passageStr,
      };
      continue;
    }

    // 5. Dòng nội dung thông thường: đưa vào dữ kiện chùm hoặc câu hỏi đang mở
    if (isCollectingGroupPassage) {
      currentGroupPassageLines.push(line);
    } else if (activeQuestion) {
      activeQuestion.lines.push(line);
    }
  }

  flushActiveQuestion();

  const parsedList: ExtendedParsedQuestion[] = collectedQuestions.map((item) => {
    const chunkText = item.lines.join("\n").trim();
    const groupMeta =
      item.groupId && item.groupPassage
        ? { group_id: item.groupId, group_passage: item.groupPassage }
        : undefined;
    const parsed = parseSingleQuestionChunk(chunkText, item.qNum, secTitle, secType, sIdx, groupMeta);
    parsed.original_label = item.label;
    return parsed;
  });

  return propagateReadingPassages(parsedList);
}

export function parseExamHierarchical(rawText: string): ExtendedExamSection[] {
  if (!rawText || !rawText.trim()) return [];
  let text = rawText.normalize("NFC").trim();
  text = repairMathTypeGlitch(text);

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
    // Nếu có từ khóa "Câu hỏi chùm:", kích hoạt bộ bóc tách câu hỏi chùm chuyên biệt
    if (/câu\s*hỏi\s*chùm\s*:/i.test(content)) {
      return parseQuestionsWithClusterSupport(content, secTitle, secType, sIdx);
    }

    // Nếu không có từ khóa "Câu hỏi chùm:", chạy y hệt logic cũ 100%
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
      const leadingText = content.slice(0, matches[0].index).trim();

      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index + matches[i].fullMatch.length;
        const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
        let chunk = content.slice(start, end).trim();
        if (i === 0 && leadingText && PASSAGE_BLOCK_REGEX.test(leadingText)) {
          PASSAGE_BLOCK_REGEX.lastIndex = 0;
          chunk = leadingText + "\n" + chunk;
        }
        PASSAGE_BLOCK_REGEX.lastIndex = 0;
        const parsed = parseSingleQuestionChunk(chunk, matches[i].qNum, secTitle, secType, sIdx);
        parsed.original_label = matches[i].label;
        qList.push(parsed);
      }
      return propagateReadingPassages(qList);
    } else {
      const paragraphs = content.split(/\n\s*\n+/).filter(Boolean);
      const qList = paragraphs.map((p, idx) => {
        return parseSingleQuestionChunk(p.trim(), idx + 1, secTitle, secType, sIdx);
      });
      return propagateReadingPassages(qList);
    }
  };

  let sectionsResult: ExtendedExamSection[] = [];
  if (secMatches.length > 0) {
    let currentGlobalNum = 1;
    for (let i = 0; i < secMatches.length; i++) {
      const secTitle = secMatches[i].title;
      const secType = getSectionTypeFromTitle(secTitle);
      const start = secMatches[i].end;
      const end = i + 1 < secMatches.length ? secMatches[i + 1].start : readyText.length;
      const secContent = readyText.slice(start, end).trim();

      const questions = parseQuestionsFromText(secContent, secTitle, secType, i);
      questions.forEach(q => {
        q.order_index = currentGlobalNum;
        q.original_label = "Câu " + currentGlobalNum;
        currentGlobalNum++;
      });

      sectionsResult.push({
        section_title: secTitle,
        section_type: secType,
        questions
      });
    }
  } else {
    const questions = parseQuestionsFromText(readyText, "PHẦN I. TRẮC NGHIỆM", "multiple_choice", 0);
    sectionsResult = [
      {
        section_title: "PHẦN I. TRẮC NGHIỆM",
        section_type: "multiple_choice",
        questions
      }
    ];
  }

  const totalQ = sectionsResult.reduce((sum, s) => sum + s.questions.length, 0);
  if (totalQ > 0) {
    const basePt = Number((10 / totalQ).toFixed(2));
    let currentSum = 0;
    sectionsResult.forEach(sec => {
      sec.questions.forEach(q => {
        q.points = basePt;
        currentSum += basePt;
      });
    });
    const diff = Number((10 - currentSum).toFixed(2));
    if (sectionsResult[0]?.questions[0]) {
      sectionsResult[0].questions[0].points = Number(((sectionsResult[0].questions[0].points || 0) + diff).toFixed(2));
    }
  }

  return sectionsResult;
}

/**
 * Chuyển văn bản thô của 1 file Word thành 1 Phần thi HSA chuẩn (thang 50 điểm / phần)
 */
export function buildHsaPartSectionFromText(
  rawText: string,
  partKey: HsaPartKey,
  mediaMap: Record<string, string> = {}
): ExtendedExamSection {
  const partMeta = HSA_PART_CONFIG[partKey] || HSA_PART_CONFIG.quant;
  const parsedSecs = parseExamHierarchical(rawText);

  const flatQuestions: ExtendedParsedQuestion[] = [];
  parsedSecs.forEach((sec) => {
    sec.questions.forEach((q) => {
      flatQuestions.push(q);
    });
  });

  const propagated = propagateReadingPassages(flatQuestions);
  const totalQ = propagated.length;
  const ptPerQuestion = totalQ > 0 ? Number((50 / totalQ).toFixed(4)) : 1;

  const normalizedQuestions: ExtendedParsedQuestion[] = propagated.map((q, idx) => ({
    ...q,
    id: `${partKey}_q_${idx + 1}`,
    order_index: idx + 1,
    original_label: `Câu ${idx + 1}`,
    section_title: partMeta.headerTitle,
    part_key: partKey,
    points: ptPerQuestion,
    group_id: q.group_id,
    group_passage: q.group_passage || q.passage_html,
    passage_html: q.passage_html || q.group_passage,
  }));

  return {
    key: partKey,
    part_key: partKey,
    title: partMeta.shortTitle,
    shortTitle: partMeta.shortTitle,
    headerTitle: partMeta.headerTitle,
    section_title: `${partMeta.headerTitle} (${partMeta.shortTitle})`,
    section_type: "multiple_choice",
    duration_minutes: partMeta.defaultDuration,
    durationMinutes: partMeta.defaultDuration,
    max_points: 50,
    maxScore: 50,
    raw_source_text: rawText,
    questions: normalizedQuestions,
    media_map: mediaMap,
    mediaMap: mediaMap,
  };
}

function inferNextAvailableHsaPartKey(existingSections: ExtendedExamSection[]): HsaPartKey {
  const used = new Set(
    existingSections.map((s) => String(s.part_key || s.key || "").toLowerCase())
  );
  if (!used.has("quant")) return "quant";
  if (!used.has("qual")) return "qual";
  if (!used.has("english")) return "english";
  if (!used.has("history_geo")) return "history_geo";
  return "quant";
}

function normalizeExistingHsaSections(rawSections: any[]): ExtendedExamSection[] {
  if (!Array.isArray(rawSections)) return [];
  return rawSections.map((sec: any, idx: number) => {
    const rawKey = String(sec.part_key || sec.key || "").toLowerCase();
    const titleStr = String(sec.section_title || sec.title || "");
    let partKey: HsaPartKey = "quant";

    if (
      rawKey === "history_geo" ||
      rawKey.includes("su") ||
      rawKey.includes("dia") ||
      rawKey.includes("khoa_hoc") ||
      /lịch\s*sử|địa\s*lý|địa\s*lí|khoa\s*học/i.test(titleStr)
    ) {
      partKey = "history_geo";
    } else if (
      rawKey === "qual" ||
      rawKey.includes("dinh_tinh") ||
      rawKey.includes("van") ||
      /ngôn\s*ngữ|văn\s*học|định\s*tính/i.test(titleStr)
    ) {
      partKey = "qual";
    } else if (
      rawKey === "english" ||
      rawKey.includes("anh") ||
      /tiếng\s*anh|english/i.test(titleStr)
    ) {
      partKey = "english";
    } else if (idx === 1 && !rawKey) {
      partKey = "qual";
    } else if (idx === 2 && !rawKey) {
      partKey = "english";
    } else if (idx >= 3 && !rawKey) {
      partKey = "history_geo";
    }

    const meta = HSA_PART_CONFIG[partKey];
    const qList: ExtendedParsedQuestion[] = Array.isArray(sec.questions) ? sec.questions : [];
    const ptPerQ = qList.length > 0 ? Number((50 / qList.length).toFixed(4)) : 1;

    return {
      ...sec,
      key: partKey,
      part_key: partKey,
      title: sec.title || meta.shortTitle,
      shortTitle: sec.shortTitle || meta.shortTitle,
      headerTitle: sec.headerTitle || meta.headerTitle,
      section_title: sec.section_title || `${meta.headerTitle} (${meta.shortTitle})`,
      section_type: sec.section_type || "multiple_choice",
      duration_minutes: Number(sec.duration_minutes || sec.durationMinutes || meta.defaultDuration),
      durationMinutes: Number(sec.durationMinutes || sec.duration_minutes || meta.defaultDuration),
      max_points: 50,
      maxScore: 50,
      questions: qList.map((q, qIdx) => ({
        ...q,
        order_index: qIdx + 1,
        original_label: `Câu ${qIdx + 1}`,
        part_key: partKey,
        points: ptPerQ,
        group_id: q.group_id,
        group_passage: q.group_passage || q.passage_html,
        passage_html: q.passage_html || q.group_passage,
      })),
    };
  });
}

// ============================================================================
// 4. RENDER KATEX, ẢNH VÀ CÔNG THỨC TOÁN HỌC
// ============================================================================

export function cleanAndNormalizeMath(raw: string): string {
  if (!raw) return "";
  let text = raw.normalize("NFC");
  text = repairMathTypeGlitch(text);

  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => "$$" + math.trim() + "$$");
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => "$" + math.trim() + "$");

  text = text.replace(/\\left\s*\\\{\s*\\begin\{(?:align|aligned|array)\}([\s\S]*?)\\end\{(?:align|aligned|array)\}\s*\\right\./gi, (_, body) => {
    const cleanBody = body.replace(/&/g, "").trim();
    return "$$\\begin{cases} " + cleanBody + " \\end{cases}$$";
  });

  text = text.replace(/(?<!\$\$)\\begin\{(?:align|aligned)\}([\s\S]*?)\\end\{(?:align|aligned)\}(?!\$\$)/gi, (match) => {
    return "$$" + match + "$$";
  });

  text = text.replace(/(\\right\.)([a-zA-Z\\])/g, "$1 $2");
  text = text.replace(/([0-9a-zA-Z])(\\[a-zA-Z]+)/g, "$1 $2");

  return text;
}

export function TokenViewer({ 
  content, 
  mediaMap = {}, 
  inline = false 
}: { 
  content?: string; 
  mediaMap: Record<string, string>; 
  inline?: boolean;
}) {
  if (!content) return null;
  const readyContent = cleanAndNormalizeMath(content);

  const parts = readyContent.split(/(\[img:[^\]]+\]|\$\$[\s\S]*?\$\$|\$[^\$]+?\$)/g);

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
          const src = isDirectUrl ? rawKey : (mediaMap[rawKey] || mediaMap["$" + rawKey + "$"]);
          if (!src) return null;

          return inline ? (
            <img 
              key={idx} 
              src={src} 
              alt="Minh họa" 
              className="inline-block max-h-12 align-middle mx-1 my-0.5 object-contain rounded border border-slate-100 bg-white" 
            />
          ) : (
            <div key={idx} className="my-3 text-center flex flex-col items-center justify-center">
              <img 
                src={src} 
                alt="Hình minh họa đề thi" 
                className="max-h-80 max-w-full rounded-2xl border border-slate-200/90 bg-white shadow-xs p-2 object-contain inline-block" 
              />
            </div>
          );
        }

        if (part.startsWith("$") && part.endsWith("$")) {
          const isDisplay = part.startsWith("$$");
          let mathStr = isDisplay ? part.slice(2, -2) : part.slice(1, -1);
          mathStr = mathStr.trim();
          if (!mathStr || mathStr === "\\left(\\right)" || mathStr === "()") return null;

          try {
            return (
              <span 
                key={idx} 
                className={isDisplay ? "block my-2 text-center overflow-x-auto custom-scrollbar" : "inline-block align-middle px-0.5 text-[15px] font-serif"} 
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
// 5. COMPONENT MODAL AZOTA CHÍNH (HỖ TRỢ THANG 10 THPT & THANG 50Đ/PHẦN HSA)
// ============================================================================

interface AzotaExamConfigModalProps {
  isOpen: boolean;
  file: File | null;
  mode: "course" | "practice";
  onClose: () => void;
  onSave?: (examData: any) => void;
  onSaveExam?: (examData: any) => void;
  onSuccess?: (examData: any) => void;
  onComplete?: (examData: any) => void;
  initialData?: any;
  appendToExam?: any;
}

export function AzotaExamConfigModal(props: AzotaExamConfigModalProps) {
  const { 
    isOpen, 
    file, 
    mode, 
    onClose, 
    onSave, 
    onSaveExam, 
    onSuccess, 
    onComplete,
    initialData,
    appendToExam
  } = props;

  const targetBaseExam = appendToExam || (initialData?.__appendHsa ? initialData : null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [examTitle, setExamTitle] = useState<string>("");
  const [duration, setDuration] = useState<number>(50);
  const [category, setCategory] = useState<string>(PRACTICE_CATEGORIES[0]);
  const [examFormat, setExamFormat] = useState<"thpt" | "hsa">("thpt");
  const [currentHsaPartKey, setCurrentHsaPartKey] = useState<HsaPartKey>("quant");
  const [activeHsaSectionIndex, setActiveHsaSectionIndex] = useState<number>(0);

  const [sections, setSections] = useState<ExtendedExamSection[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, string>>({});
  const [rawText, setRawText] = useState<string>("");
  const [expandedSolutions, setExpandedSolutions] = useState<Record<string, boolean>>({});

  const [lockedSections, setLockedSections] = useState<Record<number, boolean>>({});

  const [tfGlobalPercent, setTfGlobalPercent] = useState<Record<string, number>>({
    a: 25,
    b: 25,
    c: 25,
    d: 25
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appendWordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const baseExam = targetBaseExam || initialData;
    const isHsaDetected = Boolean(
      targetBaseExam ||
      baseExam?.exam_format === "hsa" ||
      /\b(hsa|đgnl|dgnl)\b/i.test(String(baseExam?.category || baseExam?.title || ""))
    );

    // Trường hợp 1: Ghép thêm phần thi vào đề HSA đã có (hoặc chỉnh sửa đề HSA kèm file mới)
    if (targetBaseExam || (initialData && isHsaDetected && file)) {
      const refExam = targetBaseExam || initialData;
      setExamFormat("hsa");
      setExamTitle(refExam.title || "Đề thi ĐGNL HSA");
      setCategory("ĐGNL HSA (ĐHQGHN)");

      const rawExistingSecs = Array.isArray(refExam.sections)
        ? refExam.sections
        : Array.isArray(refExam.data)
        ? refExam.data
        : [];
      const normalizedExisting = normalizeExistingHsaSections(rawExistingSecs);
      const existingMedia: Record<string, string> = {
        ...(refExam.mediaMap || refExam.media_map || {}),
      };
      normalizedExisting.forEach((s) => {
        Object.assign(existingMedia, s.mediaMap || s.media_map || {});
      });

      const nextPartKey = inferNextAvailableHsaPartKey(normalizedExisting);
      setCurrentHsaPartKey(nextPartKey);

      if (file) {
        setLoading(true);
        const prefix = `img_${nextPartKey}_${Date.now().toString().slice(-4)}_`;
        extractDocxDirectly(file, prefix)
          .then((res) => {
            const mergedMedia = { ...existingMedia, ...res.mediaMap };
            setMediaMap(mergedMedia);
            const repaired = repairMathTypeGlitch(res.text);
            const labeledText = injectQuestionLabelsIfMissing(repaired);
            setRawText(labeledText);

            const newHsaSec = buildHsaPartSectionFromText(labeledText, nextPartKey, mergedMedia);
            const mergedSections = [
              ...normalizedExisting.filter((s) => s.part_key !== nextPartKey),
              newHsaSec,
            ].sort(
              (a, b) =>
                (HSA_PART_CONFIG[(a.part_key as HsaPartKey) || "quant"]?.order || 99) -
                (HSA_PART_CONFIG[(b.part_key as HsaPartKey) || "quant"]?.order || 99)
            );

            setSections(mergedSections);
            const newIdx = mergedSections.findIndex((s) => s.part_key === nextPartKey);
            setActiveHsaSectionIndex(newIdx >= 0 ? newIdx : mergedSections.length - 1);
            setDuration(
              mergedSections.reduce(
                (sum, s) => sum + (Number(s.duration_minutes || s.durationMinutes) || 60),
                0
              )
            );
            setLoading(false);
          })
          .catch((err) => {
            console.error("Lỗi đọc file Word khi ghép phần HSA:", err);
            alert("Lỗi đọc file Word. Vui lòng kiểm tra định dạng file .docx!");
            setSections(normalizedExisting);
            setMediaMap(existingMedia);
            setLoading(false);
          });
      } else {
        setSections(normalizedExisting);
        setMediaMap(existingMedia);
        setActiveHsaSectionIndex(0);
        if (normalizedExisting[0]?.part_key) {
          setCurrentHsaPartKey(normalizedExisting[0].part_key as HsaPartKey);
        }
        setRawText(normalizedExisting[0]?.raw_source_text || "");
        setDuration(
          normalizedExisting.reduce(
            (sum, s) => sum + (Number(s.duration_minutes || s.durationMinutes) || 60),
            0
          ) || 75
        );
      }
      return;
    }

    // Trường hợp 2: Chỉnh sửa đề thi hiện có (không có file mới)
    if (initialData && !file) {
      setExamTitle(initialData.title || "");
      setDuration(initialData.duration_minutes || (isHsaDetected ? 75 : 50));
      setCategory(
        isHsaDetected
          ? "ĐGNL HSA (ĐHQGHN)"
          : initialData.category || PRACTICE_CATEGORIES[2]
      );
      setExamFormat(isHsaDetected ? "hsa" : "thpt");

      const initSecs = Array.isArray(initialData.sections)
        ? initialData.sections
        : Array.isArray(initialData.data)
        ? initialData.data
        : [];

      if (initSecs.length > 0) {
        const readySecs = isHsaDetected ? normalizeExistingHsaSections(initSecs) : initSecs;
        setSections(readySecs);
        if (isHsaDetected && readySecs[0]?.part_key) {
          setCurrentHsaPartKey(readySecs[0].part_key as HsaPartKey);
          setRawText(readySecs[0].raw_source_text || "");
        }
      }
      if (initialData.mediaMap || initialData.media_map) {
        setMediaMap(initialData.mediaMap || initialData.media_map || {});
      }
      return;
    }

    // Trường hợp 3: Tải lên file Word mới
    if (file) {
      setLoading(true);
      const cleanFileName = file.name.replace(/\.[^/.]+$/, "");
      setExamTitle(cleanFileName);

      const fileLooksLikeHsa = /\b(hsa|đgnl|dgnl)\b|định\s*lượng|định\s*tính/i.test(cleanFileName);
      const detectedPart: HsaPartKey = /lịch\s*sử|địa\s*lý|địa\s*lí|khoa\s*học/i.test(cleanFileName)
        ? "history_geo"
        : /định\s*tính|ngôn\s*ngữ|văn/i.test(cleanFileName)
        ? "qual"
        : /tiếng\s*anh|english/i.test(cleanFileName)
        ? "english"
        : "quant";

      extractDocxDirectly(file)
        .then(res => {
          setMediaMap(res.mediaMap);
          const repaired = repairMathTypeGlitch(res.text);
          const labeledText = injectQuestionLabelsIfMissing(repaired);
          setRawText(labeledText);

          if (fileLooksLikeHsa) {
            setExamFormat("hsa");
            setCurrentHsaPartKey(detectedPart);
            setCategory("ĐGNL HSA (ĐHQGHN)");
            const hsaSec = buildHsaPartSectionFromText(labeledText, detectedPart, res.mediaMap);
            setSections([hsaSec]);
            setActiveHsaSectionIndex(0);
            setDuration(HSA_PART_CONFIG[detectedPart].defaultDuration);
          } else {
            setExamFormat("thpt");
            setCategory("Tốt Nghiệp THPT");
            const parsed = parseExamHierarchical(labeledText);
            setSections(parsed);
            setDuration(50);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error("Lỗi đọc file Word:", err);
          alert("Lỗi đọc file Word. Vui lòng kiểm tra định dạng file .docx!");
          setLoading(false);
        });
    }
  }, [file, isOpen, initialData, targetBaseExam]);

  // Chuyển đổi giữa Chế độ 1: Đề chuẩn THPT / Kiểm tra (Thang 10.0) và Chế độ 2: Đề ĐGNL HSA ĐHQGHN (Thang 50đ/phần)
  const handleSwitchExamFormat = (nextFormat: "thpt" | "hsa") => {
    if (nextFormat === examFormat) return;
    setExamFormat(nextFormat);

    if (nextFormat === "hsa") {
      setCategory("ĐGNL HSA (ĐHQGHN)");
      if (rawText.trim()) {
        const hsaSec = buildHsaPartSectionFromText(rawText, currentHsaPartKey, mediaMap);
        setSections([hsaSec]);
        setActiveHsaSectionIndex(0);
        setDuration(HSA_PART_CONFIG[currentHsaPartKey].defaultDuration);
      } else if (sections.length > 0) {
        const normalized = normalizeExistingHsaSections(sections);
        setSections(normalized);
        setActiveHsaSectionIndex(0);
        setDuration(
          normalized.reduce(
            (sum, s) => sum + (Number(s.duration_minutes || s.durationMinutes) || 60),
            0
          )
        );
      }
    } else {
      if (category === "ĐGNL HSA (ĐHQGHN)") {
        setCategory("Tốt Nghiệp THPT");
      }
      if (rawText.trim()) {
        const thptSecs = parseExamHierarchical(rawText);
        setSections(thptSecs);
        setDuration(50);
      }
    }
  };

  // Đổi loại phần thi HSA (quant / qual / english / history_geo) cho phần đang chọn
  const handleChangeActiveHsaPartKey = (newPartKey: HsaPartKey) => {
    setCurrentHsaPartKey(newPartKey);
    if (examFormat !== "hsa") return;

    const meta = HSA_PART_CONFIG[newPartKey];
    setSections((prev) => {
      if (prev.length === 0) return prev;
      const targetIdx = Math.min(activeHsaSectionIndex, prev.length - 1);
      const updated = prev.map((sec, idx) => {
        if (idx !== targetIdx) return sec;
        const qCount = sec.questions.length;
        const ptPerQ = qCount > 0 ? Number((50 / qCount).toFixed(4)) : 1;
        return {
          ...sec,
          key: newPartKey,
          part_key: newPartKey,
          title: meta.shortTitle,
          shortTitle: meta.shortTitle,
          headerTitle: meta.headerTitle,
          section_title: `${meta.headerTitle} (${meta.shortTitle})`,
          duration_minutes: meta.defaultDuration,
          durationMinutes: meta.defaultDuration,
          max_points: 50,
          maxScore: 50,
          questions: sec.questions.map((q, qIdx) => ({
            ...q,
            id: `${newPartKey}_q_${qIdx + 1}`,
            order_index: qIdx + 1,
            original_label: `Câu ${qIdx + 1}`,
            section_title: meta.headerTitle,
            part_key: newPartKey,
            points: ptPerQ,
          })),
        };
      });

      const totalDur = updated.reduce(
        (sum, s) => sum + (Number(s.duration_minutes || s.durationMinutes) || 60),
        0
      );
      setDuration(totalDur);
      return updated;
    });
  };

  // Nạp thêm file Word cho phần thi khác (Ghép phần HSA: hỗ trợ đủ 4 phần quant, qual, english, history_geo)
  const handleAppendAdditionalHsaWordFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFile = e.target.files?.[0];
    e.target.value = "";
    if (!newFile) return;

    const nextKey = inferNextAvailableHsaPartKey(sections);
    setLoading(true);
    try {
      const prefix = `img_${nextKey}_${Date.now().toString().slice(-4)}_`;
      const res = await extractDocxDirectly(newFile, prefix);
      const mergedMedia = { ...mediaMap, ...res.mediaMap };
      setMediaMap(mergedMedia);

      const repaired = repairMathTypeGlitch(res.text);
      const labeledText = injectQuestionLabelsIfMissing(repaired);
      setRawText(labeledText);
      setCurrentHsaPartKey(nextKey);

      const newSec = buildHsaPartSectionFromText(labeledText, nextKey, mergedMedia);
      setSections((prev) => {
        const filtered = prev.filter((s) => s.part_key !== nextKey);
        const combined = [...filtered, newSec].sort(
          (a, b) =>
            (HSA_PART_CONFIG[(a.part_key as HsaPartKey) || "quant"]?.order || 99) -
            (HSA_PART_CONFIG[(b.part_key as HsaPartKey) || "quant"]?.order || 99)
        );
        const newIdx = combined.findIndex((s) => s.part_key === nextKey);
        setActiveHsaSectionIndex(newIdx >= 0 ? newIdx : combined.length - 1);
        setDuration(
          combined.reduce(
            (sum, s) => sum + (Number(s.duration_minutes || s.durationMinutes) || 60),
            0
          )
        );
        return combined;
      });
    } catch (err) {
      console.error("Lỗi ghép thêm file Word HSA:", err);
      alert("Không thể đọc file Word vừa chọn. Vui lòng kiểm tra định dạng .docx!");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveHsaSection = (idxToRemove: number) => {
    if (sections.length <= 1) {
      alert("Đề thi cần có ít nhất 1 phần thi!");
      return;
    }
    setSections((prev) => {
      const next = prev.filter((_, idx) => idx !== idxToRemove);
      const nextActive = Math.max(0, Math.min(activeHsaSectionIndex, next.length - 1));
      setActiveHsaSectionIndex(nextActive);
      if (next[nextActive]) {
        setCurrentHsaPartKey((next[nextActive].part_key as HsaPartKey) || "quant");
        setRawText(next[nextActive].raw_source_text || "");
      }
      setDuration(
        next.reduce(
          (sum, s) => sum + (Number(s.duration_minutes || s.durationMinutes) || 60),
          0
        )
      );
      return next;
    });
  };

  const handleSelectActiveHsaTab = (idx: number) => {
    const target = sections[idx];
    if (!target) return;
    setActiveHsaSectionIndex(idx);
    if (target.part_key) {
      setCurrentHsaPartKey(target.part_key as HsaPartKey);
    }
    if (target.raw_source_text !== undefined) {
      setRawText(target.raw_source_text);
    }
  };

  const handleRawTextChange = (newText: string) => {
    setRawText(newText);
    if (examFormat === "hsa") {
      const rebuilt = buildHsaPartSectionFromText(newText, currentHsaPartKey, mediaMap);
      setSections((prev) => {
        if (prev.length <= 1) return [rebuilt];
        const targetIdx = Math.min(activeHsaSectionIndex, prev.length - 1);
        return prev.map((sec, idx) => (idx === targetIdx ? rebuilt : sec));
      });
    } else {
      const parsed = parseExamHierarchical(newText);
      setSections(parsed);
    }
  };

  const handleAutoReIndexQuestions = () => {
    const reIndexed = autoNormalizeQuestions(rawText);
    handleRawTextChange(reIndexed);
  };

  // Nút chèn nhanh mẫu "Câu hỏi chùm:" vào trình biên tập thô
  const handleInsertClusterTemplate = () => {
    const template =
      "\nCâu hỏi chùm: Đọc ngữ liệu / dữ kiện sau và trả lời các câu hỏi bên dưới:\n(Dán nội dung ngữ liệu hoặc hình ảnh chung vào đây...)\n\nCâu 1: Nội dung câu hỏi con thứ nhất?\nA. Phương án A\nB. Phương án B\nC. Phương án C\nD. Phương án D\n\n=== Hết câu hỏi chùm ===\n";
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart || 0;
      const end = textareaRef.current.selectionEnd || 0;
      const selected = rawText.substring(start, end);
      const block = selected
        ? `\nCâu hỏi chùm: ${selected}\n=== Hết câu hỏi chùm ===\n`
        : template;
      const updated = rawText.substring(0, start) + block + rawText.substring(end);
      handleRawTextChange(updated);
    } else {
      handleRawTextChange(template + "\n" + rawText);
    }
  };

  // Nút chèn nhanh thẻ [NGU_LIEU]...[/NGU_LIEU]
  const handleInsertPassageBlockTag = () => {
    const template = "\n[NGU_LIEU]\nĐọc đoạn ngữ liệu sau và trả lời các câu hỏi bên dưới:\n(Dán nội dung văn bản đọc hiểu vào đây...)\n[/NGU_LIEU]\n";
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart || 0;
      const end = textareaRef.current.selectionEnd || 0;
      const selected = rawText.substring(start, end);
      const block = selected
        ? `\n[NGU_LIEU]\n${selected}\n[/NGU_LIEU]\n`
        : template;
      const updated = rawText.substring(0, start) + block + rawText.substring(end);
      handleRawTextChange(updated);
    } else {
      handleRawTextChange(template + "\n" + rawText);
    }
  };

  const handleTextareaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (!blob) return;

        // DÙNG FileReader ĐỌC DATAURL BASE64 VĨNH CỬU
        const reader = new FileReader();
        reader.onload = (event) => {
          const b64 = event.target?.result as string;
          if (!b64) return;

          const newKey = "img_clip_" + Date.now();
          setMediaMap(prev => ({ ...prev, [newKey]: b64 }));

          const token = "\n[img:$" + newKey + "$]\n";
          if (textareaRef.current) {
            const start = textareaRef.current.selectionStart || 0;
            const end = textareaRef.current.selectionEnd || 0;
            const updated = rawText.substring(0, start) + token + rawText.substring(end);
            handleRawTextChange(updated);
          } else {
            handleRawTextChange(rawText + token);
          }
        };
        reader.readAsDataURL(blob);
        break;
      }
    }
  };

  const handleUpdateAnswer = (qId: string, newAns: string) => {
    setSections(prev => prev.map(sec => ({
      ...sec,
      questions: sec.questions.map(q => q.id === qId ? { ...q, correct_answer: newAns } : q)
    })));
  };

  const handleToggleTrueFalseOpt = (qId: string, optKey: string, val: boolean) => {
    setSections(prev => prev.map(sec => ({
      ...sec,
      questions: sec.questions.map(q => {
        if (q.id !== qId) return q;
        const newOpts = q.options.map(o => o.key === optKey ? { ...o, is_true_false_ans: val } : o);
        const newAnsStr = newOpts.map(o => (o.is_true_false_ans ? "Đ" : "S")).join("");
        return { ...q, options: newOpts, correct_answer: newAnsStr };
      })
    })));
  };

  const handleToggleLockSection = (sIdx: number) => {
    setLockedSections(prev => ({
      ...prev,
      [sIdx]: !prev[sIdx]
    }));
  };

  const handleUpdateSectionTotalPoints = (sIdx: number, targetSecPts: number) => {
    if (examFormat === "hsa") {
      // Trong chế độ HSA, mỗi phần cố định thang 50 điểm
      setSections(prev => prev.map((sec, idx) => {
        if (idx !== sIdx) return sec;
        const qCount = sec.questions.length;
        const ptPerQ = qCount > 0 ? Number((50 / qCount).toFixed(4)) : 1;
        return {
          ...sec,
          max_points: 50,
          questions: sec.questions.map(q => ({ ...q, points: ptPerQ }))
        };
      }));
      return;
    }

    const validPts = Math.max(0, Math.min(10, Number(targetSecPts) || 0));
    const targetSec = sections[sIdx];
    if (!targetSec || targetSec.questions.length === 0) return;

    const qCount = targetSec.questions.length;
    const ptPerQ = Number((validPts / qCount).toFixed(2));

    setLockedSections(prev => ({ ...prev, [sIdx]: true }));

    setSections(prev => {
      let lockedPointsSum = 0;
      prev.forEach((sec, idx) => {
        if (idx !== sIdx && lockedSections[idx]) {
          lockedPointsSum += sec.questions.reduce((sum, q) => sum + (q.points || 0), 0);
        }
      });

      const unlockedOtherSecs = prev.filter((_, idx) => idx !== sIdx && !lockedSections[idx]);
      const remainingForUnlocked = Math.max(0, 10 - validPts - lockedPointsSum);
      const totalUnlockedOtherQ = unlockedOtherSecs.reduce((acc, s) => acc + s.questions.length, 0);
      const unlockedPtPerQ = totalUnlockedOtherQ > 0 ? Number((remainingForUnlocked / totalUnlockedOtherQ).toFixed(2)) : 0;

      let sum = 0;
      const updated = prev.map((sec, idx) => {
        if (idx === sIdx) {
          return {
            ...sec,
            questions: sec.questions.map(q => {
              sum += ptPerQ;
              const subPts: Record<string, number> = {};
              if (sec.section_type === "true_false") {
                ["a", "b", "c", "d"].forEach(k => {
                  subPts[k] = Number(((ptPerQ * (tfGlobalPercent[k] || 25)) / 100).toFixed(3));
                });
              }
              return { ...q, points: ptPerQ, sub_points: subPts };
            })
          };
        } else if (lockedSections[idx]) {
          sec.questions.forEach(q => { sum += (q.points || 0); });
          return sec;
        } else {
          return {
            ...sec,
            questions: sec.questions.map(q => {
              sum += unlockedPtPerQ;
              const subPts: Record<string, number> = {};
              if (sec.section_type === "true_false") {
                ["a", "b", "c", "d"].forEach(k => {
                  subPts[k] = Number(((unlockedPtPerQ * (tfGlobalPercent[k] || 25)) / 100).toFixed(3));
                });
              }
              return { ...q, points: unlockedPtPerQ, sub_points: subPts };
            })
          };
        }
      });

      const diff = Number((10 - sum).toFixed(2));
      const firstUnlockedSec = updated.find((_, idx) => !lockedSections[idx]);
      if (firstUnlockedSec && firstUnlockedSec.questions[0]) {
        firstUnlockedSec.questions[0].points = Number(((firstUnlockedSec.questions[0].points || 0) + diff).toFixed(2));
      }
      return updated;
    });
  };

  const handleAutoDistribute10Points = () => {
    if (examFormat === "hsa") {
      setSections(prev => prev.map(sec => {
        const qCount = sec.questions.length;
        const ptPerQ = qCount > 0 ? Number((50 / qCount).toFixed(4)) : 1;
        return {
          ...sec,
          max_points: 50,
          questions: sec.questions.map(q => ({ ...q, points: ptPerQ }))
        };
      }));
      return;
    }

    setLockedSections({});
    const totalQ = sections.reduce((acc, s) => acc + s.questions.length, 0);
    if (totalQ === 0) return;
    const basePoint = Number((10 / totalQ).toFixed(2));
    let sum = 0;

    setSections(prev => {
      const updated = prev.map(sec => ({
        ...sec,
        questions: sec.questions.map(q => {
          sum += basePoint;
          const subPts: Record<string, number> = {};
          if (sec.section_type === "true_false") {
            ["a", "b", "c", "d"].forEach(k => {
              subPts[k] = Number(((basePoint * (tfGlobalPercent[k] || 25)) / 100).toFixed(3));
            });
          }
          return {
            ...q,
            points: basePoint,
            sub_percentages: { ...tfGlobalPercent },
            sub_points: subPts
          };
        })
      }));

      const diff = Number((10 - sum).toFixed(2));
      if (updated[0]?.questions[0]) {
        updated[0].questions[0].points = Number(((updated[0].questions[0].points || 0) + diff).toFixed(2));
      }
      return updated;
    });
  };

  const handleUpdatePoints = (qId: string, newPoints: number) => {
    if (examFormat === "hsa") {
      setSections(prev => prev.map(sec => ({
        ...sec,
        questions: sec.questions.map(q => q.id === qId ? { ...q, points: Math.max(0, Number(newPoints) || 0) } : q)
      })));
      return;
    }

    const validPoint = Math.max(0, Math.min(10, Number(newPoints) || 0));

    setSections(prev => {
      const allQuestions: { secIdx: number; qIdx: number; id: string; points: number }[] = [];
      prev.forEach((sec, sI) => {
        sec.questions.forEach((q, qI) => {
          allQuestions.push({ secIdx: sI, qIdx: qI, id: q.id, points: q.points || 0 });
        });
      });

      if (allQuestions.length <= 1) {
        return prev.map(sec => ({
          ...sec,
          questions: sec.questions.map(q => q.id === qId ? { ...q, points: 10 } : q)
        }));
      }

      let lockedPointsSum = 0;
      prev.forEach((sec, idx) => {
        if (lockedSections[idx]) {
          lockedPointsSum += sec.questions.reduce((sum, q) => sum + (q.points || 0), 0);
        }
      });

      const otherQuestions = allQuestions.filter(item => item.id !== qId && !lockedSections[item.secIdx]);
      const remainingPoints = Math.max(0, 10 - validPoint - lockedPointsSum);
      const newAverageForOthers = otherQuestions.length > 0 ? Number((remainingPoints / otherQuestions.length).toFixed(2)) : 0;

      let currentAllocated = validPoint;
      const pointMap: Record<string, number> = { [qId]: validPoint };

      otherQuestions.forEach((item, idx) => {
        if (idx === otherQuestions.length - 1) {
          const finalPt = Number(Math.max(0, 10 - currentAllocated - lockedPointsSum).toFixed(2));
          pointMap[item.id] = finalPt;
        } else {
          pointMap[item.id] = newAverageForOthers;
          currentAllocated += newAverageForOthers;
        }
      });

      return prev.map((sec, sI) => ({
        ...sec,
        questions: sec.questions.map(q => {
          if (lockedSections[sI] && q.id !== qId) return q;
          const pt = pointMap[q.id] !== undefined ? pointMap[q.id] : (q.points || 0);
          const subPts: Record<string, number> = {};
          if (sec.section_type === "true_false") {
            ["a", "b", "c", "d"].forEach(k => {
              const pct = q.sub_percentages?.[k] !== undefined ? q.sub_percentages[k] : (tfGlobalPercent[k] || 25);
              subPts[k] = Number(((pt * pct) / 100).toFixed(3));
            });
          }
          return {
            ...q,
            points: pt,
            sub_points: subPts
          };
        })
      }));
    });
  };

  const handleUpdateTfPercent = (key: string, percent: number) => {
    const val = Math.max(0, Math.min(100, percent || 0));
    const nextPercents = { ...tfGlobalPercent, [key]: val };
    setTfGlobalPercent(nextPercents);

    setSections(prev => prev.map(sec => {
      if (sec.section_type !== "true_false") return sec;
      return {
        ...sec,
        questions: sec.questions.map(q => {
          const qPt = q.points || 0;
          const subPts: Record<string, number> = {};
          ["a", "b", "c", "d"].forEach(k => {
            const p = nextPercents[k] || 0;
            subPts[k] = Number(((qPt * p) / 100).toFixed(3));
          });
          return {
            ...q,
            sub_percentages: nextPercents,
            sub_points: subPts
          };
        })
      };
    }));
  };

  const handleTriggerUploadImage = () => {
    fileInputRef.current?.click();
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // DÙNG FileReader ĐỌC DATAURL BASE64 VĨNH CỬU
    const reader = new FileReader();
    reader.onload = (event) => {
      const b64 = event.target?.result as string;
      if (!b64) return;

      const newKey = "img_custom_" + Date.now();
      setMediaMap(prev => ({ ...prev, [newKey]: b64 }));

      const token = "\n[img:$" + newKey + "$]\n";
      if (textareaRef.current) {
        const start = textareaRef.current.selectionStart || 0;
        const end = textareaRef.current.selectionEnd || 0;
        const updatedText = rawText.substring(0, start) + token + rawText.substring(end);
        handleRawTextChange(updatedText);
      } else {
        handleRawTextChange(rawText + token);
      }
    };
    reader.readAsDataURL(selectedFile);
    e.target.value = "";
  };

  const handleInsertImageUrl = () => {
    const url = window.prompt("Nhập đường dẫn URL của hình ảnh (https://...):");
    if (!url || !url.trim()) return;

    const cleanUrl = url.trim();
    const token = "\n[img:" + cleanUrl + "]\n";

    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart || 0;
      const end = textareaRef.current.selectionEnd || 0;
      const updatedText = rawText.substring(0, start) + token + rawText.substring(end);
      handleRawTextChange(updatedText);
    } else {
      handleRawTextChange(rawText + token);
    }
  };

  const toggleSolution = (qId: string) => {
    setExpandedSolutions(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const totalQuestions = useMemo(() => {
    return sections.reduce((acc, s) => acc + s.questions.length, 0);
  }, [sections]);

  const tfTotalPercent = useMemo(() => {
    return (tfGlobalPercent.a || 0) + (tfGlobalPercent.b || 0) + (tfGlobalPercent.c || 0) + (tfGlobalPercent.d || 0);
  }, [tfGlobalPercent]);

  const totalMaxPoints = useMemo(() => {
    return examFormat === "hsa" ? sections.length * 50 : 10.0;
  }, [examFormat, sections.length]);

  // HÀM XUẤT BẢN ĐỀ THI: "INLINE EMBEDDING" ĐÓNG GÓI ẢNH TRỰC TIẾP VÀO TỪNG CÂU HỎI
  const handleFinalPublish = () => {
    // NHÚNG TRỰC TIẾP ẢNH VÀO TỪNG CÂU HỎI VÀ TỪNG SECTION
    const embeddedSections = sections.map((sec: any, idx: number) => {
      const hsaKey: HsaPartKey | undefined =
        examFormat === "hsa"
          ? ((sec.part_key ||
              sec.key ||
              (idx === 0
                ? "quant"
                : idx === 1
                ? "qual"
                : idx === 2
                ? "english"
                : "history_geo")) as HsaPartKey)
          : undefined;
      const hsaMeta = hsaKey ? HSA_PART_CONFIG[hsaKey] : undefined;
      const qList = sec.questions || [];
      const hsaPtPerQ = qList.length > 0 ? Number((50 / qList.length).toFixed(4)) : 1;

      return {
        ...sec,
        ...(examFormat === "hsa" && hsaMeta
          ? {
              key: hsaKey,
              part_key: hsaKey,
              title: hsaMeta.shortTitle,
              shortTitle: hsaMeta.shortTitle,
              headerTitle: hsaMeta.headerTitle,
              section_title: `${hsaMeta.headerTitle} (${hsaMeta.shortTitle})`,
              duration_minutes: Number(sec.duration_minutes || sec.durationMinutes || hsaMeta.defaultDuration),
              durationMinutes: Number(sec.durationMinutes || sec.duration_minutes || hsaMeta.defaultDuration),
              max_points: 50,
              maxScore: 50,
            }
          : {}),
        media_map: mediaMap,
        mediaMap: mediaMap,
        questions: qList.map((q: any, qIdx: number) => {
          let resolvedSrc = q.image || "";
          const promptText = q.prompt_html || q.prompt || "";
          const m = promptText.match(/\[(?:img|image):\s*\$?([a-zA-Z0-9_\-\.\/]+)\$?\s*\]/i);
          if (m && m[1]) {
            const cleanK = m[1].replace(/\$/g, "").trim();
            resolvedSrc = mediaMap[cleanK] || mediaMap[`$${cleanK}$`] || mediaMap[m[1]] || resolvedSrc;
          }

          return {
            ...q,
            number: qIdx + 1,
            order_index: examFormat === "hsa" ? qIdx + 1 : q.order_index,
            part_key: hsaKey || q.part_key,
            points: examFormat === "hsa" ? hsaPtPerQ : q.points,
            group_id: q.group_id || undefined,
            group_passage: q.group_passage || q.passage_html || undefined,
            passage_html: q.passage_html || q.group_passage || undefined,
            image: resolvedSrc || undefined,
            media_map: mediaMap,
            mediaMap: mediaMap
          };
        })
      };
    });

    const existingId = targetBaseExam?.id || initialData?.id;

    const examPayload = {
      id: existingId || ("exam-" + Date.now()),
      title: examTitle || (examFormat === "hsa" ? "Đề thi ĐGNL HSA" : "Đề thi mới"),
      duration_minutes: duration,
      category: examFormat === "hsa" ? "ĐGNL HSA (ĐHQGHN)" : category,
      exam_format: examFormat,
      hsa_parts_count: examFormat === "hsa" ? embeddedSections.length : undefined,
      total_questions: totalQuestions,
      sections: embeddedSections,
      data: embeddedSections,
      total_points: totalMaxPoints,
      mediaMap: mediaMap,
      media_map: mediaMap,
      createdAt: targetBaseExam?.createdAt || initialData?.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (typeof onSave === "function") onSave(examPayload);
    if (typeof onSaveExam === "function") onSaveExam(examPayload);
    if (typeof onSuccess === "function") onSuccess(examPayload);
    if (typeof onComplete === "function") onComplete(examPayload);

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 w-screen h-screen z-[200] bg-white flex flex-col rounded-none border-none text-left font-sans overflow-hidden">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageFileChange} 
        accept="image/*" 
        className="hidden" 
      />
      <input
        type="file"
        ref={appendWordInputRef}
        onChange={handleAppendAdditionalHsaWordFile}
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
      />

      <header className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm">
            {examFormat === "hsa" ? "HSA" : "AZ"}
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              {examFormat === "hsa" ? "Cấu hình Đề thi ĐGNL HSA (ĐHQGHN)" : "Azota All-In-One Exam Engine"}
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                {examFormat === "hsa" ? `${sections.length}/4 phần • ${totalMaxPoints}đ` : "Thang 10.0 THPT"}
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Bước {step}/3: {step === 1 ? "Bóc tách & Biên tập đề thi" : step === 2 ? `Ma trận đáp án & Thang điểm (${totalMaxPoints}đ)` : "Cài đặt & Xuất bản"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* CÔNG TẮC CHỌN CHẾ ĐỘ ĐỀ: ĐỀ CHUẨN THPT / KIỂM TRA (THANG 10.0) VS ĐỀ ĐGNL HSA ĐHQGHN (THANG 50Đ/PHẦN) */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => handleSwitchExamFormat("thpt")}
              className={
                "px-3 py-1.5 rounded-lg transition-all cursor-pointer " +
                (examFormat === "thpt"
                  ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              Đề chuẩn THPT / Kiểm tra (Thang 10.0 điểm)
            </button>
            <button
              type="button"
              onClick={() => handleSwitchExamFormat("hsa")}
              className={
                "px-3 py-1.5 rounded-lg transition-all cursor-pointer " +
                (examFormat === "hsa"
                  ? "bg-blue-900 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              Đề ĐGNL HSA ĐHQGHN (Thang 50 điểm / phần)
            </button>
          </div>

          <div className="hidden xl:flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <span className={"px-3 py-1 rounded-lg transition-all " + (step === 1 ? "bg-white text-blue-800 shadow-2xs" : "")}>
              1. Biên tập & Preview
            </span>
            <span className={"px-3 py-1 rounded-lg transition-all " + (step === 2 ? "bg-white text-blue-800 shadow-2xs" : "")}>
              2. Ma trận đáp án & Điểm
            </span>
            <span className={"px-3 py-1 rounded-lg transition-all " + (step === 3 ? "bg-white text-blue-800 shadow-2xs" : "")}>
              3. Cài đặt đề thi
            </span>
          </div>

          <button 
            type="button"
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            title="Đóng trình cấu hình"
          >
            <X className="w-6 h-6"/>
          </button>
        </div>
      </header>

      {/* THANH CÔNG CỤ QUẢN LÝ 4 PHẦN THI HSA (CHỈ HIỂN THỊ KHI CHỌN ĐGNL HSA) */}
      {examFormat === "hsa" && (
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Các phần trong đề ({sections.length}/4):
            </span>
            {sections.map((sec, idx) => {
              const pKey = (sec.part_key || sec.key || "quant") as HsaPartKey;
              const pMeta = HSA_PART_CONFIG[pKey] || HSA_PART_CONFIG.quant;
              const isSelected = idx === activeHsaSectionIndex;
              return (
                <div
                  key={`hsa-tab-${pKey}-${idx}`}
                  onClick={() => handleSelectActiveHsaTab(idx)}
                  className={
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all " +
                    (isSelected
                      ? "bg-blue-900 text-white border-blue-900"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100")
                  }
                >
                  <span>
                    {pMeta.shortTitle} ({sec.questions.length} câu • 50đ)
                  </span>
                  {sections.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveHsaSection(idx);
                      }}
                      className={
                        "p-0.5 rounded hover:bg-red-500/20 " +
                        (isSelected ? "text-blue-200 hover:text-white" : "text-slate-400 hover:text-red-600")
                      }
                      title="Xóa phần thi này"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}

            {sections.length < 4 && (
              <button
                type="button"
                onClick={() => appendWordInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-blue-800 border border-dashed border-blue-400 text-xs font-bold cursor-pointer transition-all"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>+ Nạp thêm file Word cho phần thi khác (Ghép phần HSA)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600 whitespace-nowrap">
              Chọn phần thi cho file đang mở:
            </label>
            <select
              value={currentHsaPartKey}
              onChange={(e) => handleChangeActiveHsaPartKey(e.target.value as HsaPartKey)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:border-blue-800 cursor-pointer"
            >
              <option value="quant">1. Phần 1: Tư duy Định lượng (Toán học & Xử lý số liệu - 75p - 50đ)</option>
              <option value="qual">2. Phần 2: Tư duy Định tính (Ngôn ngữ - Văn học - 60p - 50đ)</option>
              <option value="english">3. Phần 3 (Tự chọn 1): Tiếng Anh (60p - 50đ)</option>
              <option value="history_geo">4. Phần 3 (Tự chọn 2): Khoa học (Lịch sử - Địa lý - 60p - 50đ)</option>
            </select>
          </div>
        </div>
      )}

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col bg-[#F8FAFC]">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600"/>
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-slate-800">Đang phân tích cấu trúc đề thi Word / MathType...</p>
              <p className="text-xs text-slate-500">Tự động nhận diện công thức, câu hỏi chùm, quét toàn bộ hình ảnh và chuẩn hóa phát biểu...</p>
            </div>
          </div>
        ) : step === 1 ? (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 min-h-0 overflow-hidden">
            {/* CỘT PREVIEW BÊN TRÁI (NHÓM CÁC CÂU CÙNG group_id VÀO CHUNG 1 KHUNG THẺ) */}
            <div className="flex flex-col h-full border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden">
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                <span className="text-xs font-black uppercase tracking-wider text-blue-800 flex items-center gap-1.5">
                  <Eye className="w-4 h-4"/> Xem trước đề thi (Preview)
                </span>
                <span className="text-xs text-slate-600 font-bold bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                  {totalQuestions} câu hỏi • {sections.length} phần thi ({totalMaxPoints}đ)
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {sections.map((sec, sIdx) => {
                  // Gom nhóm các câu hỏi liên tiếp có cùng group_id vào chung 1 khối thẻ hiển thị trên Preview
                  const previewBlocks: {
                    blockKey: string;
                    isCluster: boolean;
                    groupId?: string;
                    groupPassage?: string;
                    questions: { q: ExtendedParsedQuestion; qIdx: number }[];
                  }[] = [];

                  sec.questions.forEach((q, qIdx) => {
                    const gId = q.group_id;
                    const gPass = q.group_passage || q.passage_html;
                    if (gId) {
                      const prevBlock = previewBlocks[previewBlocks.length - 1];
                      if (prevBlock && prevBlock.isCluster && prevBlock.groupId === gId) {
                        prevBlock.questions.push({ q, qIdx });
                        if (!prevBlock.groupPassage && gPass) {
                          prevBlock.groupPassage = gPass;
                        }
                        return;
                      }
                      previewBlocks.push({
                        blockKey: `cluster-${sIdx}-${gId}-${qIdx}`,
                        isCluster: true,
                        groupId: gId,
                        groupPassage: gPass,
                        questions: [{ q, qIdx }],
                      });
                    } else {
                      previewBlocks.push({
                        blockKey: `single-${sIdx}-${q.id}-${qIdx}`,
                        isCluster: false,
                        questions: [{ q, qIdx }],
                      });
                    }
                  });

                  const renderQuestionCard = (q: ExtendedParsedQuestion, idx: number, inCluster: boolean = false) => {
                    const isSolOpen = !!expandedSolutions[q.id];
                    const isAnyOptionLong = q.options?.some(opt => {
                      const t = opt.text_html || "";
                      return t.length > 30 || t.includes("\\frac") || t.includes("right)");
                    });

                    return (
                      <div
                        key={q.id}
                        className={
                          inCluster
                            ? "p-4 rounded-xl border border-slate-200 bg-white space-y-3"
                            : "p-5 rounded-2xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50/70 transition-all space-y-3"
                        }
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-xs text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/60">
                              {q.original_label || ("Câu " + (idx + 1))}
                            </span>
                            {(q.group_id || q.passage_html) && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                Câu hỏi chùm
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">Đáp án:</span>
                            <span className="font-black text-xs text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300">
                              {q.correct_answer || "A"}
                            </span>
                          </div>
                        </div>

                        <div className="py-1">
                          <TokenViewer content={q.prompt_html} mediaMap={mediaMap}/>
                        </div>

                        {q.type !== "short_answer" && sec.section_type === "multiple_choice" && q.options && q.options.some(o => o.text_html) && (
                          <div className={"grid gap-2.5 pt-1 " + (isAnyOptionLong ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
                            {q.options.map(opt => {
                              const isCorrect = opt.key === q.correct_answer;
                              return (
                                <div 
                                  key={opt.key}
                                  onClick={() => handleUpdateAnswer(q.id, opt.key)}
                                  className={"p-3 rounded-xl border text-xs flex items-center gap-2.5 transition-all cursor-pointer " + (
                                    isCorrect 
                                      ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 font-bold shadow-2xs ring-1 ring-emerald-300" 
                                      : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                                  )}
                                >
                                  <span className={"w-6 h-6 rounded-lg flex items-center justify-center font-black shrink-0 " + (
                                    isCorrect ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                                  )}>
                                    {opt.key}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <TokenViewer content={opt.text_html} inline={true} mediaMap={mediaMap}/>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {sec.section_type === "true_false" && q.options && (
                          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                            <table className="w-full text-left text-[13px]">
                              <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                  <th className="py-2.5 px-3 font-bold text-slate-600">Phát biểu</th>
                                  <th className="py-2.5 px-3 text-center font-bold text-emerald-600 w-16">Đúng</th>
                                  <th className="py-2.5 px-3 text-center font-bold text-rose-600 w-16">Sai</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {q.options.map(opt => {
                                  const isTrue = opt.is_true_false_ans === true;
                                  const isFalse = opt.is_true_false_ans === false;
                                  return (
                                    <tr key={opt.key} className="hover:bg-slate-50/50">
                                      <td className="py-2.5 px-3">
                                        <div className="flex items-start gap-2">
                                          <span className="font-bold text-blue-600">{opt.key})</span>
                                          <TokenViewer content={opt.text_html} inline={true} mediaMap={mediaMap}/>
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 text-center align-middle">
                                        <div 
                                          onClick={() => handleToggleTrueFalseOpt(q.id, opt.key, true)}
                                          className={"w-6 h-6 mx-auto rounded border flex items-center justify-center cursor-pointer transition-all " + (isTrue ? "bg-emerald-500 border-emerald-500 text-white shadow-sm scale-110" : "bg-slate-50 border-slate-300 text-transparent hover:bg-slate-100")}
                                        >
                                          <Check className="w-4 h-4"/>
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 text-center align-middle">
                                        <div 
                                          onClick={() => handleToggleTrueFalseOpt(q.id, opt.key, false)}
                                          className={"w-6 h-6 mx-auto rounded border flex items-center justify-center cursor-pointer transition-all " + (isFalse ? "bg-rose-500 border-rose-500 text-white shadow-sm scale-110" : "bg-slate-50 border-slate-300 text-transparent hover:bg-slate-100")}
                                        >
                                          <X className="w-4 h-4"/>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {(sec.section_type === "short_answer" || q.type === "short_answer") && (
                          <div className="p-3 bg-slate-100/80 rounded-xl border border-slate-200 flex items-center gap-3 text-xs mt-3">
                            <span className="font-bold text-slate-700 whitespace-nowrap">Đáp án điền:</span>
                            <input 
                              type="text" 
                              value={q.correct_answer || ""} 
                              onChange={(e) => handleUpdateAnswer(q.id, e.target.value)} 
                              placeholder="Nhập đáp án số hoặc chữ..." 
                              className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 outline-none focus:border-blue-700" 
                            />
                          </div>
                        )}

                        {q.solution_html && (
                          <div className="pt-3 border-t border-slate-100 mt-3">
                            <button
                              type="button"
                              onClick={() => toggleSolution(q.id)}
                              className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer bg-blue-50/60 px-2.5 py-1.5 rounded-lg border border-blue-200/60 transition-colors"
                            >
                              <BookOpen className="w-3.5 h-3.5"/>
                              <span>{isSolOpen ? "Thu gọn lời giải" : "Hiển thị lời giải gốc"}</span>
                            </button>
                            {isSolOpen && (
                              <div className="mt-2.5 p-4 bg-slate-50 rounded-xl border border-slate-200 text-[13px]">
                                <TokenViewer content={q.solution_html} mediaMap={mediaMap}/>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  };

                  return (
                    <div key={"sec-pv-" + sIdx} className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black text-xs">
                            {sIdx + 1}
                          </div>
                          <div>
                            <h4 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                              {sec.section_title}
                            </h4>
                            <p className="text-[11px] font-semibold text-slate-600">
                              {sec.questions.length} câu hỏi • {
                                examFormat === "hsa"
                                  ? `Thang 50 điểm (${sec.duration_minutes || 60} phút)`
                                  : sec.section_type === "true_false" 
                                    ? "Trắc nghiệm Đúng / Sai" 
                                    : sec.section_type === "short_answer" 
                                      ? "Trả lời ngắn" 
                                      : "Trắc nghiệm nhiều lựa chọn (A, B, C, D)"
                              }
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-slate-700 bg-white px-3 py-1 rounded-xl border border-slate-200">
                          {sec.questions.length} câu
                        </span>
                      </div>

                      <div className="space-y-4">
                        {previewBlocks.map((block) => {
                          if (!block.isCluster) {
                            const singleItem = block.questions[0];
                            return renderQuestionCard(singleItem.q, singleItem.qIdx, false);
                          }

                          const firstLabel =
                            block.questions[0]?.q.original_label ||
                            `Câu ${block.questions[0]?.qIdx + 1}`;
                          const lastLabel =
                            block.questions[block.questions.length - 1]?.q.original_label ||
                            `Câu ${block.questions[block.questions.length - 1]?.qIdx + 1}`;

                          return (
                            <div
                              key={block.blockKey}
                              className="rounded-2xl border-2 border-amber-200/90 bg-amber-50/20 overflow-hidden space-y-3 p-3.5"
                            >
                              {block.groupPassage && (
                                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
                                  <div className="flex items-center justify-between border-b border-amber-200/80 pb-1.5">
                                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                                      Dữ kiện / Ngữ liệu chung ({firstLabel}
                                      {lastLabel !== firstLabel ? ` – ${lastLabel}` : ""})
                                    </span>
                                    <span className="text-[11px] font-bold text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-200">
                                      {block.questions.length} câu hỏi con
                                    </span>
                                  </div>
                                  <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                    <TokenViewer content={block.groupPassage} mediaMap={mediaMap} />
                                  </div>
                                </div>
                              )}

                              <div className="space-y-3">
                                {block.questions.map((item) =>
                                  renderQuestionCard(item.q, item.qIdx, true)
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CỘT WORD RAW EDITOR */}
            <div className="flex flex-col h-full border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden">
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-slate-700"/>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Word Raw Editor {examFormat === "hsa" ? `(${HSA_PART_CONFIG[currentHsaPartKey]?.shortTitle})` : ""}
                  </span>
                </div>
                
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleInsertClusterTemplate}
                    className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Chèn nhanh mẫu Câu hỏi chùm: ... === Hết câu hỏi chùm ==="
                  >
                    <Layers className="w-3.5 h-3.5 text-amber-700"/>
                    <span>+ Câu hỏi chùm:</span>
                  </button>

                  {examFormat === "hsa" && (
                    <button
                      type="button"
                      onClick={handleInsertPassageBlockTag}
                      className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Chèn thẻ [NGU_LIEU]...[/NGU_LIEU] cho đoạn đọc hiểu Văn học / Tiếng Anh"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-700"/>
                      <span>+ Khối [NGU_LIEU]</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleAutoReIndexQuestions}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Đánh số lại câu tuần tự từ Câu 1, Câu 2... và chuẩn hóa ý a, b, c, d"
                  >
                    <Hash className="w-3.5 h-3.5 text-blue-700"/>
                    <span>Đánh lại số câu (1, 2...)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerUploadImage}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Chèn ảnh từ máy tính hoặc bấm Ctrl+V để dán trực tiếp ảnh"
                  >
                    <ImagePlus className="w-3.5 h-3.5 text-blue-600"/>
                    <span>Tải ảnh (Ctrl+V)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleInsertImageUrl}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Dán đường link (URL) ảnh từ internet"
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-slate-600"/>
                    <span>Chèn Link Ảnh</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-white relative">
                <textarea
                  ref={textareaRef}
                  value={rawText}
                  onPaste={handleTextareaPaste}
                  onChange={(e) => handleRawTextChange(e.target.value)}
                  placeholder="Nội dung đề thi thô... Để tạo câu hỏi chùm, bắt đầu bằng dòng 'Câu hỏi chùm: <dữ kiện chung>' trước câu con đầu tiên và kết thúc bằng dòng 'Hết câu hỏi chùm'."
                  className="w-full h-full p-4 font-mono text-[12.5px] text-slate-900 bg-white resize-none outline-none leading-relaxed custom-scrollbar border-none focus:ring-0"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
        ) : step === 2 ? (
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar max-w-5xl mx-auto w-full space-y-6">
            <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-blue-700"/>
                  {examFormat === "hsa"
                    ? `Cấu hình Ma trận Đáp án & Thang điểm HSA (${sections.length} phần × 50đ = ${totalMaxPoints}đ)`
                    : "Cấu hình Ma trận đáp án & Thang điểm 10.0 (Auto-Balance)"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {examFormat === "hsa"
                    ? "Mỗi phần thi HSA có tổng điểm chuẩn 50 điểm, tự động chia đều cho tổng số câu trong phần đó (VD: 50 câu = 1.0 điểm/câu)."
                    : "Bấm biểu tượng 🔒 để Khóa cố định điểm phần bạn muốn. Điểm các phần chưa khóa sẽ tự động điều chỉnh."}
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleAutoDistribute10Points}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5"/>
                  <span>
                    {examFormat === "hsa"
                      ? "Chuẩn hóa 50 điểm / phần"
                      : "Chia đều 10 điểm (Mở khóa hết)"}
                  </span>
                </button>

                <div className="px-3.5 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600"/>
                  <span>
                    Tổng điểm: {totalMaxPoints.toFixed(1)} / {totalMaxPoints.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* BẢNG CẤU HÌNH % ĐIỂM CHO PHẦN ĐÚNG/SAI */}
            {examFormat === "thpt" && sections.some(s => s.section_type === "true_false") && (
              <div className="p-5 bg-slate-50 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-slate-700"/>
                    <h4 className="font-black text-xs sm:text-sm text-slate-900 uppercase">
                      Cấu hình tỷ lệ % điểm từng ý (Phần Đúng / Sai)
                    </h4>
                  </div>
                  <span className={"text-xs font-bold px-2 py-0.5 rounded-md border " + (tfTotalPercent === 100 ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-amber-50 text-amber-700 border-amber-300")}>
                    Tổng: {tfTotalPercent}% / 100%
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Bạn có thể quy định tỷ lệ % điểm mà học sinh nhận được khi làm đúng từng ý. Ví dụ câu 1.0 điểm, ý a là 50% thì ý a nhận 0.5 điểm.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  {(["a", "b", "c", "d"] as const).map(key => (
                    <div key={key} className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-slate-700">Ý {key}:</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={tfGlobalPercent[key] !== undefined ? tfGlobalPercent[key] : 25}
                          onChange={(e) => handleUpdateTfPercent(key, parseFloat(e.target.value) || 0)}
                          className="w-14 px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-center text-xs font-black text-slate-900 outline-none focus:border-blue-700 focus:bg-white"
                        />
                        <span className="text-xs font-bold text-slate-400">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DANH SÁCH CÁC PHẦN THI KÈM NÚT KHÓA CỐ ĐỊNH ĐIỂM */}
            <div className="space-y-6">
              {sections.map((sec, sIdx) => {
                const secTotalPoints =
                  examFormat === "hsa"
                    ? 50
                    : Number(sec.questions.reduce((sum, q) => sum + (q.points || 0), 0).toFixed(2));
                const isLocked = Boolean(lockedSections[sIdx]);

                return (
                  <div key={"sec-cfg-" + sIdx} className={"bg-white p-5 rounded-3xl border transition-all space-y-4 " + (isLocked ? "border-amber-300 shadow-sm ring-1 ring-amber-200" : "border-slate-200 shadow-xs")}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm text-slate-900 uppercase">
                            {sec.section_title}
                          </h4>
                          {isLocked && examFormat === "thpt" && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                              <Lock className="w-3 h-3"/> Đã Khóa
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          {examFormat === "hsa"
                            ? `Thang 50 điểm • ${sec.questions.length} câu hỏi (${sec.questions.length > 0 ? Number((50 / sec.questions.length).toFixed(2)) : 1}đ/câu)`
                            : `${sec.section_type === "true_false" ? "Trắc nghiệm Đúng/Sai" : sec.section_type === "short_answer" ? "Trả lời ngắn" : "Trắc nghiệm 4 phương án"} • ${sec.questions.length} câu hỏi`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 bg-slate-50 p-1.5 px-3 rounded-2xl border border-slate-200">
                        <span className="text-xs font-extrabold text-slate-800 whitespace-nowrap">
                          Điểm phần:
                        </span>
                        <div className="flex items-center gap-1">
                          <input 
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            disabled={examFormat === "hsa"}
                            value={secTotalPoints}
                            onChange={(e) => handleUpdateSectionTotalPoints(sIdx, parseFloat(e.target.value) || 0)}
                            className="w-16 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center text-xs font-black text-blue-800 outline-none focus:border-blue-600 disabled:bg-slate-100"
                          />
                          <span className="text-xs font-bold text-slate-700 mr-1.5">đ</span>
                        </div>

                        {examFormat === "thpt" && (
                          <button
                            type="button"
                            onClick={() => handleToggleLockSection(sIdx)}
                            className={"px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer " + (
                              isLocked 
                                ? "bg-amber-500 hover:bg-amber-600 text-white" 
                                : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-300"
                            )}
                            title={isLocked ? "Bấm để Mở khóa điểm" : "Bấm để Khóa cố định điểm"}
                          >
                            {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            <span>{isLocked ? "Cố định" : "Khóa"}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 pt-1">
                      {sec.questions.map((q, idx) => (
                        <div key={q.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                            <span className="font-black text-blue-800">{q.original_label || ("Câu " + (idx + 1))}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-400">Điểm:</span>
                              <input 
                                type="number"
                                step="0.05"
                                value={q.points !== undefined ? Number(q.points.toFixed(2)) : 0.25}
                                onChange={(e) => handleUpdatePoints(q.id, parseFloat(e.target.value) || 0)}
                                className="w-14 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-center text-xs font-black text-slate-900 outline-none focus:border-blue-600"
                              />
                            </div>
                          </div>

                          {q.type !== "short_answer" && sec.section_type === "multiple_choice" && (
                            <div className="grid grid-cols-4 gap-1">
                              {["A", "B", "C", "D"].map(k => {
                                const isSel = q.correct_answer === k;
                                return (
                                  <button
                                    key={k}
                                    type="button"
                                    onClick={() => handleUpdateAnswer(q.id, k)}
                                    className={"py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer " + (
                                      isSel 
                                        ? "bg-emerald-600 text-white shadow-xs" 
                                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                                    )}
                                  >
                                    {k}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {sec.section_type === "true_false" && (
                            <div className="space-y-1.5">
                              {["a", "b", "c", "d"].map(subKey => {
                                const opt = q.options.find(o => o.key === subKey);
                                const isTrue = opt?.is_true_false_ans === true;
                                const subPt = q.sub_points?.[subKey] !== undefined ? q.sub_points[subKey] : Number((((q.points || 0) * (tfGlobalPercent[subKey] || 25)) / 100).toFixed(3));
                                return (
                                  <div key={subKey} className="flex items-center justify-between gap-1 text-[11px]">
                                    <div className="flex items-center gap-1">
                                      <span className="font-bold text-slate-700 uppercase">{subKey}:</span>
                                      <span className="text-[9px] text-slate-400 font-semibold">({subPt}đ)</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleTrueFalseOpt(q.id, subKey, true)}
                                        className={"px-1.5 py-0.5 rounded font-black text-[10px] border cursor-pointer " + (
                                          isTrue ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"
                                        )}
                                      >
                                        Đ
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleTrueFalseOpt(q.id, subKey, false)}
                                        className={"px-1.5 py-0.5 rounded font-black text-[10px] border cursor-pointer " + (
                                          !isTrue ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-200"
                                        )}
                                      >
                                        S
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {(sec.section_type === "short_answer" || q.type === "short_answer") && (
                            <input 
                              type="text" 
                              value={q.correct_answer || ""} 
                              onChange={(e) => handleUpdateAnswer(q.id, e.target.value)} 
                              placeholder="Đáp án điền..." 
                              className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 outline-none focus:border-blue-600" 
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex items-center justify-center">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xs max-w-lg w-full space-y-5">
              <div className="text-center space-y-1 pb-2 border-b border-slate-100">
                <h3 className="font-black text-lg text-slate-900">Thiết lập Thông số Đề thi</h3>
                <p className="text-xs text-slate-500">Hoàn tất các cài đặt bên dưới để xuất bản đề thi</p>
              </div>

              <div className="space-y-4 text-xs font-bold text-slate-700">
                <div>
                  <label className="block mb-1.5">Tiêu đề đề thi *</label>
                  <input 
                    type="text" 
                    value={examTitle} 
                    onChange={e => setExamTitle(e.target.value)} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all" 
                  />
                </div>

                <div>
                  <label className="block mb-1.5">Tổng thời gian làm bài (Phút) *</label>
                  <input 
                    type="number" 
                    value={duration} 
                    onChange={e => setDuration(Number(e.target.value))} 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all" 
                  />
                </div>

                {mode === "practice" && (
                  <div>
                    <label className="block mb-1.5">Danh mục Luyện đề</label>
                    <select 
                      value={category} 
                      onChange={e => setCategory(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:bg-white transition-all cursor-pointer"
                    >
                      {PRACTICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                )}

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-slate-800 text-xs leading-relaxed font-normal space-y-1">
                  <div>
                    • Định dạng đề:{" "}
                    <strong className="font-bold">
                      {examFormat === "hsa"
                        ? `ĐGNL HSA ĐHQGHN (${sections.length}/4 phần)`
                        : "Chuẩn Tốt nghiệp THPT / Kiểm tra"}
                    </strong>
                  </div>
                  <div>
                    • Tổng số câu hỏi:{" "}
                    <strong className="font-bold">{totalQuestions} câu</strong> thuộc{" "}
                    <strong className="font-bold">{sections.length} phần thi</strong>.
                  </div>
                  <div>
                    • Thang điểm chuẩn:{" "}
                    <strong className="font-bold">
                      {totalMaxPoints.toFixed(1)} điểm
                    </strong>{" "}
                    {examFormat === "hsa" ? "(50 điểm / phần)" : "(Auto-Balanced 10.0)"}.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="h-16 px-6 border-t border-slate-200 bg-white flex items-center justify-between shrink-0 z-10">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => setStep(step === 3 ? 2 : 1)}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs disabled:opacity-40 cursor-pointer hover:bg-slate-50 transition-all flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4"/> Quay lại
        </button>

        <div className="flex items-center gap-3">
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step === 1 ? 2 : 3)}
              className="px-6 py-2.5 rounded-xl bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <span>Tiếp tục ({totalQuestions} câu)</span>
              <ArrowRight className="w-4 h-4"/>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalPublish}
              className="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs cursor-pointer transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4"/>
              <span>
                {targetBaseExam ? "Lưu & Cập Nhật Đề HSA" : "Lưu & Xuất Bản Đề Thi"}
              </span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default AzotaExamConfigModal;
