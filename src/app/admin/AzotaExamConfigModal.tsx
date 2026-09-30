"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  Loader2, Layers, CheckCircle2, XCircle, PenTool, CircleDot, 
  CheckSquare, AlignLeft, Edit3, Sigma, Eye, AlertTriangle, 
  ArrowRight, ArrowLeft, Settings2, Clock, Play, Sparkles, X, Link as LinkIcon, Video,
  BookOpen, ChevronDown, ChevronUp, Check, RefreshCw, FolderCheck, ImagePlus, Calculator, Wand2, Percent, FileText
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

export interface ExtendedParsedQuestion extends ParsedQuestion {
  points?: number;
  sub_points?: Record<string, number>;
  sub_percentages?: Record<string, number>;
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
  if (name === "sSubSup") {
    const e = Array.from(el.childNodes).find((n: any) => n.nodeName && n.nodeName.includes("e")) as any;
    const sub = Array.from(el.childNodes).find((n: any) => n.nodeName && n.nodeName.includes("sub")) as any;
    const sup = Array.from(el.childNodes).find((n: any) => n.nodeName && n.nodeName.includes("sup")) as any;
    return "{" + (e ? convertOmmlToLatex(e) : "") + "}_{" + (sub ? convertOmmlToLatex(sub) : "") + "}^{" + (sup ? convertOmmlToLatex(sup) : "") + "}";
  }
  if (name === "d") {
    const e = Array.from(el.childNodes).find((n: any) => n.nodeName && n.nodeName.includes("e")) as any;
    const inner = e ? convertOmmlToLatex(e).trim() : "";
    if (!inner) return "";
    return "\\left(" + inner + "\\right)";
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
  0x2220: "\\angle ", 0x00B0: "^\\circ "
};

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
    raw = raw.replace(/\\left\(\s*\\right\)|\(\s*\)|\\langle\s*\(\)\s*|\\sqrt\{\s*\}/g, "").trim();
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

  text = text.replace(/([a-zA-Z0-9\)\}])\s*>>\s*(\$|\s|\.|\,|$)/g, "$1 > 0$2");
  text = text.replace(/([a-zA-Z0-9\)\}])\s*><\s*(\$|\s|\.|\,|$)/g, "$1 < 0$2");
  text = text.replace(/\$([a-zA-Z0-9])>>\$/g, "$$$1 > 0$$");
  text = text.replace(/\$([a-zA-Z0-9])><\$/g, "$$$1 < 0$$");
  text = text.replace(/([a-zA-Z0-9])>>/g, "$1 > 0");
  text = text.replace(/([a-zA-Z0-9])><(?!\w)/g, "$1 < 0");

  text = text.replace(/y\s*=\s*\(\^\{?([0-9a-zA-Z]+)\}?\)/g, "y = ax^{3} + bx^{2} + cx + d");
  text = text.replace(/\(\^\{?E\}?\)/gi, "ax^{3}");
  text = text.replace(/([a-zA-Z0-9])\^\{\{\}\}/g, "$1");
  text = text.replace(/\$([a-zA-Z0-9])\.\^\{\}\$/g, "$$$1$$");
  text = text.replace(/\$([a-zA-Z0-9])\^\{\}\$/g, "$$$1$$");

  text = text.replace(/\$([a-d])\>\<\$/g, "$$$1 < 0$$");
  text = text.replace(/\$([a-d])\>\>\$/g, "$$$1 > 0$$");

  return text;
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
      if (rId && targetToToken[rId]) {
        return " " + targetToToken[rId] + " ";
      }
    }

    return "";
  };

  const processParagraphNode = (p: Element): string => {
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
          Array.from(el.getElementsByTagNameNS("*", "imagedata")).forEach((imgData: any) => {
            const rId = imgData.getAttribute("r:id") || imgData.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
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

  return { text: rawLines.join("\n").normalize("NFC"), mediaMap };
}

// ============================================================================
// 1.5 BỘ TÁCH & CẮT PDF CHUẨN XÁC THEO FILE MẪU TCT
// ============================================================================

function loadPdfJsScript(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && (window as any).pdfjsLib) {
      return resolve((window as any).pdfjsLib);
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(lib);
    };
    script.onerror = () => reject(new Error("Không thể tải thư viện PDF.js từ CDN"));
    document.head.appendChild(script);
  });
}

function autoTrimCanvasWhitespace(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let top = -1, bottom = -1, left = -1, right = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx] < 240 || data[idx + 1] < 240 || data[idx + 2] < 240) {
        if (top === -1) top = y;
        bottom = y;
        if (left === -1 || x < left) left = x;
        if (right === -1 || x > right) right = x;
      }
    }
  }

  if (top === -1) return canvas.toDataURL("image/png");

  const pad = 12;
  const cropX = Math.max(0, left - pad);
  const cropY = Math.max(0, top - pad);
  const cropW = Math.min(w - cropX, (right - left) + pad * 2);
  const cropH = Math.min(h - cropY, (bottom - top) + pad * 2);

  const trimmedCanvas = document.createElement("canvas");
  trimmedCanvas.width = cropW;
  trimmedCanvas.height = cropH;

  const tCtx = trimmedCanvas.getContext("2d");
  if (!tCtx) return canvas.toDataURL("image/png");

  tCtx.fillStyle = "#ffffff";
  tCtx.fillRect(0, 0, cropW, cropH);
  tCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  return trimmedCanvas.toDataURL("image/png");
}

export async function processPdfExamDirectly(file: File): Promise<{
  sections: ExtendedExamSection[];
  rawText: string;
  mediaMap: Record<string, string>;
}> {
  const pdfjsLib = await loadPdfJsScript();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  interface FoundLine {
    pageIdx: number;
    text: string;
    yPos: number;
  }

  const allLines: FoundLine[] = [];
  const pageCanvases: HTMLCanvasElement[] = [];
  const SCALE = 2.0;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: SCALE });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (ctx) {
      await page.render({ canvasContext: ctx, viewport }).promise;
    }
    pageCanvases.push(canvas);

    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    const lineBuckets: Record<number, string[]> = {};
    for (const item of items) {
      const str = (item.str || "").trim();
      if (!str) continue;

      const tx = item.transform;
      const pdfY = tx[5];
      const canvasY = Math.round(viewport.height - (pdfY * SCALE));

      // Bỏ qua header & footer ở mép trang
      if (canvasY < 45 || canvasY > viewport.height - 75) continue;

      let matchedY = Object.keys(lineBuckets).map(Number).find(y => Math.abs(y - canvasY) <= 6);
      if (matchedY === undefined) {
        matchedY = canvasY;
        lineBuckets[matchedY] = [];
      }
      lineBuckets[matchedY].push(str);
    }

    Object.keys(lineBuckets).map(Number).sort((a, b) => a - b).forEach(y => {
      allLines.push({
        pageIdx: pageNum - 1,
        text: lineBuckets[y].join(" ").trim(),
        yPos: y
      });
    });
  }

  interface ActionMarker {
    pageIdx: number;
    type: "section" | "question" | "solution";
    secTitle?: string;
    secType?: QuestionType;
    qNum?: number;
    yPos: number;
    fullText: string;
  }

  const markers: ActionMarker[] = [];

  for (const line of allLines) {
    const t = line.text;

    // 1. Nhận diện PHẦN I, PHẦN II, PHẦN III
    const secMatch = t.match(/^(?:Phần|PHẦN)\s*([IVX]+|\d+)[.:\-]?\s*(.*)$/i) || t.match(/^([IVX]+)\.\s*(TRẮC NGHIỆM.*)$/i);
    if (secMatch) {
      let sType: QuestionType = "multiple_choice";
      if (/đúng\s*sai/i.test(t)) sType = "true_false";
      else if (/trả\s*lời\s*ngắn|điền\s*khuyết/i.test(t)) sType = "short_answer";

      markers.push({
        pageIdx: line.pageIdx,
        type: "section",
        secTitle: t,
        secType: sType,
        yPos: Math.max(0, line.yPos - 20),
        fullText: t
      });
      continue;
    }

    // 2. Nhận diện mốc Câu hỏi (Câu 1., Câu 2.,...)
    const qMatch = t.match(/^(?:Câu|Bài|Question)\s*(\d+)[:.]/i);
    if (qMatch && !/buổi|chương|phương pháp|lý thuyết/i.test(t)) {
      markers.push({
        pageIdx: line.pageIdx,
        type: "question",
        qNum: parseInt(qMatch[1], 10),
        yPos: Math.max(0, line.yPos - 25),
        fullText: t
      });
      continue;
    }

    // 3. Nhận diện chữ LỜI GIẢI
    if (/^(?:Lời\s*giải|Lơ\u0300i\s*giải|Hướng\s*dẫn\s*giải|HDG|LỜI\s*GIẢI)[:.]?$/i.test(t)) {
      markers.push({
        pageIdx: line.pageIdx,
        type: "solution",
        yPos: Math.max(0, line.yPos - 12),
        fullText: t
      });
    }
  }

  markers.sort((a, b) => {
    if (a.pageIdx !== b.pageIdx) return a.pageIdx - b.pageIdx;
    return a.yPos - b.yPos;
  });

  // HÀM CẮT GHÉP LIÊN TRANG (Hỗ trợ câu hỏi tràn qua 2 trang)
  const cropMultiPageArea = (startPage: number, startY: number, endPage: number, endY: number): string => {
    if (startPage === endPage) {
      const srcCanvas = pageCanvases[startPage];
      if (!srcCanvas) return "";
      const h = Math.max(20, endY - startY);
      const cropped = document.createElement("canvas");
      cropped.width = srcCanvas.width;
      cropped.height = h;
      const cCtx = cropped.getContext("2d");
      if (!cCtx) return "";
      cCtx.fillStyle = "#ffffff";
      cCtx.fillRect(0, 0, cropped.width, cropped.height);
      cCtx.drawImage(srcCanvas, 0, startY, srcCanvas.width, h, 0, 0, srcCanvas.width, h);
      return autoTrimCanvasWhitespace(cropped);
    }

    const canvas1 = pageCanvases[startPage];
    const canvas2 = pageCanvases[endPage];
    if (!canvas1 || !canvas2) return "";

    const h1 = Math.max(20, (canvas1.height - 75) - startY);
    const h2 = Math.max(20, endY - 45);

    const merged = document.createElement("canvas");
    merged.width = Math.max(canvas1.width, canvas2.width);
    merged.height = h1 + h2 + 10;

    const mCtx = merged.getContext("2d");
    if (!mCtx) return "";
    mCtx.fillStyle = "#ffffff";
    mCtx.fillRect(0, 0, merged.width, merged.height);

    mCtx.drawImage(canvas1, 0, startY, canvas1.width, h1, 0, 0, canvas1.width, h1);
    mCtx.drawImage(canvas2, 0, 45, canvas2.width, h2, 0, h1 + 10, canvas2.width, h2);

    return autoTrimCanvasWhitespace(merged);
  };

  const getTextBetweenPages = (startPage: number, startY: number, endPage: number, endY: number): string => {
    return allLines
      .filter(l => {
        if (l.pageIdx === startPage && l.pageIdx === endPage) {
          return l.yPos >= startY && l.yPos <= endY;
        }
        if (l.pageIdx === startPage) return l.yPos >= startY;
        if (l.pageIdx === endPage) return l.yPos <= endY;
        return l.pageIdx > startPage && l.pageIdx < endPage;
      })
      .map(l => l.text)
      .join(" ");
  };

  const mediaMap: Record<string, string> = {};
  const sections: ExtendedExamSection[] = [];
  const rawTextLines: string[] = [];

  let currentSec: ExtendedExamSection = {
    section_title: "PHẦN I. TRẮC NGHIỆM",
    section_type: "multiple_choice",
    questions: []
  };
  sections.push(currentSec);

  let globalQuestionCounter = 1;

  for (let i = 0; i < markers.length; i++) {
    const item = markers[i];

    if (item.type === "section" && item.secTitle) {
      currentSec = {
        section_title: item.secTitle,
        section_type: item.secType || "multiple_choice",
        questions: []
      };
      sections.push(currentSec);
      rawTextLines.push("\n\n" + item.secTitle + "\n");
      continue;
    }

    if (item.type === "question") {
      const qNum = item.qNum || globalQuestionCounter;
      const startPage = item.pageIdx;
      const startY = item.yPos;

      let solMarker: ActionMarker | null = null;
      let nextQuestionMarker: ActionMarker | null = null;

      for (let j = i + 1; j < markers.length; j++) {
        const cand = markers[j];
        if (cand.type === "section") break;
        if (cand.type === "solution" && !solMarker) solMarker = cand;
        if (cand.type === "question") {
          nextQuestionMarker = cand;
          break;
        }
      }

      // Xác định điểm ngắt của câu hỏi
      let qEndPage = startPage;
      let qEndY = pageCanvases[startPage].height - 75;

      if (solMarker) {
        qEndPage = solMarker.pageIdx;
        qEndY = Math.max(20, solMarker.yPos - 12);
      } else if (nextQuestionMarker) {
        qEndPage = nextQuestionMarker.pageIdx;
        qEndY = Math.max(20, nextQuestionMarker.yPos - 12);
      }

      // 1. CẮT ẢNH ĐỀ BÀI (NGẮT TRƯỚC DÒNG CHỮ "LỜI GIẢI")
      const promptImg = cropMultiPageArea(startPage, startY, qEndPage, qEndY);
      const promptKey = "img_pdf_q_" + qNum + "_" + i;
      mediaMap[promptKey] = promptImg;

      const promptText = getTextBetweenPages(startPage, startY, qEndPage, qEndY);
      let solText = "";
      let solutionHtml = "";

      // 2. CẮT ẢNH LỜI GIẢI RIÊNG BIỆT (bắt đầu từ chữ Lời giải)
      if (solMarker) {
        const solStartPage = solMarker.pageIdx;
        const solStartY = solMarker.yPos;
        let solEndPage = solStartPage;
        let solEndY = pageCanvases[solStartPage].height - 75;

        if (nextQuestionMarker) {
          solEndPage = nextQuestionMarker.pageIdx;
          solEndY = Math.max(20, nextQuestionMarker.yPos - 12);
        }

        const solImg = cropMultiPageArea(solStartPage, solStartY, solEndPage, solEndY);
        const solKey = "img_pdf_sol_" + qNum + "_" + i;
        mediaMap[solKey] = solImg;
        solutionHtml = "[img:$" + solKey + "$]";

        solText = getTextBetweenPages(solStartPage, solStartY, solEndPage, solEndY);
      }

      const blockAllText = promptText + " " + solText;

      // Nhận diện loại câu hỏi
      let finalType: QuestionType = currentSec.section_type;
      if (/xét\s*tính\s*đúng\s*sai/i.test(blockAllText) || /Đáp\s*án\s*:\s*[ĐSđs\/]+/i.test(blockAllText)) {
        finalType = "true_false";
      } else if (/(?:Đáp\s*số|KQ|Kết\s*quả)[:\s]+/i.test(blockAllText)) {
        finalType = "short_answer";
      }

      let parsedCorrectAns = "A";
      let optionsList: QuestionOption[] = [];

      if (finalType === "true_false") {
        // Tự động nhận diện chuỗi Đ/S (Đ/S/S/D hoặc Đ/S/S/S)
        const tfMatch = blockAllText.match(/Đáp\s*án\s*:\s*([ĐSđs\/\s]+)/i);
        let tfSeq = ["S", "S", "S", "S"];
        if (tfMatch && tfMatch[1]) {
          const letters = tfMatch[1].replace(/[^ĐSđs]/g, "").toUpperCase().split("");
          letters.forEach((l, idx) => {
            if (idx < 4) tfSeq[idx] = l;
          });
        }

        optionsList = [
          { key: "a", text_html: "", is_true_false_ans: tfSeq[0] === "Đ" },
          { key: "b", text_html: "", is_true_false_ans: tfSeq[1] === "Đ" },
          { key: "c", text_html: "", is_true_false_ans: tfSeq[2] === "Đ" },
          { key: "d", text_html: "", is_true_false_ans: tfSeq[3] === "Đ" }
        ];
        parsedCorrectAns = tfSeq.join("");

        rawTextLines.push(
          "Câu " + qNum + ":\n[img:$" + promptKey + "$]\n" +
          (solutionHtml ? "Lời giải:\n" + solutionHtml + "\n" : "") +
          "a) [" + (tfSeq[0] === "Đ" ? "Đúng" : "Sai") + "]\n" +
          "b) [" + (tfSeq[1] === "Đ" ? "Đúng" : "Sai") + "]\n" +
          "c) [" + (tfSeq[2] === "Đ" ? "Đúng" : "Sai") + "]\n" +
          "d) [" + (tfSeq[3] === "Đ" ? "Đúng" : "Sai") + "]\n"
        );
      } else if (finalType === "short_answer") {
        // Tách đáp số phân số, số âm (-4, 64/27)
        const saMatch = blockAllText.match(/(?:Đáp\s*số|KQ|Kết\s*quả|Đáp\s*án)[:\s]+([^Lời\r\n\t]+)/i);
        if (saMatch && saMatch[1]) {
          parsedCorrectAns = saMatch[1].trim().replace(/^[:\s]+/, "");
        } else {
          parsedCorrectAns = "";
        }

        rawTextLines.push(
          "Câu " + qNum + ":\n[img:$" + promptKey + "$]\n" +
          (solutionHtml ? "Lời giải:\n" + solutionHtml + "\n" : "") +
          "Đáp án: " + parsedCorrectAns + "\n"
        );
      } else {
        // Trắc nghiệm: Tự động bóc "Chọn C", "Chọn D", "Chọn A"...
        const mcMatch = blockAllText.match(/(?:Chọn|Đáp\s*án)\s*([A-D])\b/i);
        if (mcMatch && mcMatch[1]) {
          parsedCorrectAns = mcMatch[1].toUpperCase();
        } else {
          parsedCorrectAns = "A";
        }

        optionsList = [
          { key: "A", text_html: "" },
          { key: "B", text_html: "" },
          { key: "C", text_html: "" },
          { key: "D", text_html: "" }
        ];

        rawTextLines.push(
          "Câu " + qNum + ":\n[img:$" + promptKey + "$]\n" +
          (solutionHtml ? "Lời giải:\n" + solutionHtml + "\n" : "") +
          "A.\nB.\nC.\nD.\nChọn " + parsedCorrectAns + "\n"
        );
      }

      const newQ: ExtendedParsedQuestion = {
        id: "q_pdf_" + qNum + "_" + Math.random().toString(36).substring(2, 7),
        order_index: globalQuestionCounter,
        original_label: "Câu " + qNum,
        section_title: currentSec.section_title,
        type: finalType,
        prompt_html: "[img:$" + promptKey + "$]",
        options: optionsList,
        correct_answer: parsedCorrectAns,
        solution_html: solutionHtml,
        points: finalType === "true_false" ? 1.0 : finalType === "short_answer" ? 0.5 : 0.25,
        sub_percentages: finalType === "true_false" ? { a: 25, b: 25, c: 25, d: 25 } : undefined,
        sub_points: finalType === "true_false" ? { a: 0.25, b: 0.25, c: 0.25, d: 0.25 } : undefined
      };

      currentSec.questions.push(newQ);
      globalQuestionCounter++;
    }
  }

  const validSections = sections.filter(s => s.questions.length > 0);

  // Auto-balance điểm chuẩn 10
  const totalQCount = validSections.reduce((acc, s) => acc + s.questions.length, 0);
  if (totalQCount > 0) {
    const basePt = Number((10 / totalQCount).toFixed(2));
    let curSum = 0;
    validSections.forEach(s => {
      s.questions.forEach(q => {
        q.points = basePt;
        curSum += basePt;
      });
    });
    const diff = Number((10 - curSum).toFixed(2));
    if (validSections[0]?.questions[0]) {
      validSections[0].questions[0].points = Number(((validSections[0].questions[0].points || 0) + diff).toFixed(2));
    }
  }

  return {
    sections: validSections,
    rawText: rawTextLines.join("\n\n"),
    mediaMap
  };
}

// ============================================================================
// 2. BÓC TÁCH CHO FILE WORD .DOCX
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

function parseSingleQuestionChunk(chunk: string, qIndex: number, sectionTitle: string, sectionType: QuestionType, sectionIndex: number): ExtendedParsedQuestion {
  let norm = chunk.normalize("NFC").trim();
  norm = repairMathTypeGlitch(norm);
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
    const options: QuestionOption[] = [
      { key: "a", text_html: "", is_true_false_ans: false },
      { key: "b", text_html: "", is_true_false_ans: false },
      { key: "c", text_html: "", is_true_false_ans: false },
      { key: "d", text_html: "", is_true_false_ans: false }
    ];

    return {
      id: uniqueId,
      order_index: qIndex,
      section_title: sectionTitle,
      type: "true_false",
      original_label: "Câu " + qIndex,
      prompt_html: promptAndOpts,
      options,
      correct_answer: "SSSS",
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

  const options: QuestionOption[] = [
    { key: "A", text_html: "" },
    { key: "B", text_html: "" },
    { key: "C", text_html: "" },
    { key: "D", text_html: "" }
  ];

  return {
    id: uniqueId,
    order_index: qIndex,
    section_title: sectionTitle,
    type: "multiple_choice",
    original_label: "Câu " + qIndex,
    prompt_html: promptAndOpts,
    options,
    correct_answer: correctAns,
    solution_html: solutionText,
    points: 0.25
  };
}

export function parseExamHierarchical(rawText: string): ExtendedExamSection[] {
  if (!rawText || !rawText.trim()) return [];
  let text = rawText.normalize("NFC").trim();
  text = repairMathTypeGlitch(text);

  SECTION_HEADER_REGEX.lastIndex = 0;
  const secMatches: { title: string; start: number; end: number }[] = [];
  let sm: RegExpExecArray | null;

  while ((sm = SECTION_HEADER_REGEX.exec(text)) !== null) {
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

  let sectionsResult: ExtendedExamSection[] = [];
  if (secMatches.length > 0) {
    let currentGlobalNum = 1;
    for (let i = 0; i < secMatches.length; i++) {
      const secTitle = secMatches[i].title;
      const secType = getSectionTypeFromTitle(secTitle);
      const start = secMatches[i].end;
      const end = i + 1 < secMatches.length ? secMatches[i + 1].start : text.length;
      const secContent = text.slice(start, end).trim();

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
    const questions = parseQuestionsFromText(text, "PHẦN I. TRẮC NGHIỆM", "multiple_choice", 0);
    sectionsResult = [
      {
        section_title: "PHẦN I. TRẮC NGHIỆM",
        section_type: "multiple_choice",
        questions
      }
    ];
  }

  return sectionsResult;
}

// ============================================================================
// 3. RENDER KATEX, ẢNH VÀ CÔNG THỨC TOÁN HỌC
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
          const src = isDirectUrl ? rawKey : mediaMap[rawKey];
          if (!src) return null;

          return inline ? (
            <img 
              key={idx} 
              src={src} 
              alt="Công thức" 
              className="inline-block max-h-12 align-middle mx-1 my-0.5 object-contain rounded border border-slate-100 bg-white" 
            />
          ) : (
            <div key={idx} className="my-2 flex flex-col items-start justify-start w-full">
              <img 
                src={src} 
                alt="Nội dung" 
                className="max-h-[600px] w-auto max-w-full rounded-xl border border-slate-200/90 bg-white shadow-2xs p-1 object-contain inline-block" 
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
// 4. COMPONENT MODAL AZOTA CHÍNH
// ============================================================================

interface AzotaExamConfigModalProps {
  isOpen: boolean;
  file: File | null;
  mode: "course" | "practice";
  onClose: () => void;
  onSave: (examData: any) => void;
}

export function AzotaExamConfigModal({ isOpen, file, mode, onClose, onSave }: AzotaExamConfigModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [isAiPolishing, setIsAiPolishing] = useState<boolean>(false);
  const [examTitle, setExamTitle] = useState<string>("");
  const [duration, setDuration] = useState<number>(50);
  const [category, setCategory] = useState<string>(PRACTICE_CATEGORIES[0]);
  const [sections, setSections] = useState<ExtendedExamSection[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, string>>({});
  const [rawText, setRawText] = useState<string>("");
  const [fileBase64, setFileBase64] = useState<string>("");
  const [expandedSolutions, setExpandedSolutions] = useState<Record<string, boolean>>({});

  const [tfGlobalPercent, setTfGlobalPercent] = useState<Record<string, number>>({
    a: 25,
    b: 25,
    c: 25,
    d: 25
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (file && isOpen) {
      setLoading(true);
      setExamTitle(file.name.replace(/\.[^/.]+$/, ""));

      const isPdf = file.name.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        processPdfExamDirectly(file)
          .then(res => {
            setMediaMap(res.mediaMap);
            setRawText(res.rawText);
            setSections(res.sections);
            setLoading(false);
          })
          .catch(err => {
            console.error("Lỗi cắt ảnh đề PDF:", err);
            alert("Lỗi phân tích file PDF. Vui lòng kiểm tra lại file!");
            setLoading(false);
          });
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const res = e.target?.result as string;
          if (res) {
            const b64 = res.split(",")[1] || "";
            setFileBase64(b64);
          }
        };
        reader.readAsDataURL(file);

        extractDocxDirectly(file)
          .then(res => {
            setMediaMap(res.mediaMap);
            const repaired = repairMathTypeGlitch(res.text);
            setRawText(repaired);
            const parsed = parseExamHierarchical(repaired);
            setSections(parsed);
            setLoading(false);
          })
          .catch(err => {
            console.error("Lỗi đọc file Word:", err);
            setLoading(false);
          });
      }
    }
  }, [file, isOpen]);

  const handleRawTextChange = (newText: string) => {
    setRawText(newText);
    const parsed = parseExamHierarchical(newText);
    setSections(parsed);
  };

  const handleAiPolishFormulas = async () => {
    if (!rawText.trim() && !fileBase64) return;

    let geminiKey = typeof window !== "undefined" ? localStorage.getItem("tct_gemini_api_key") || "" : "";
    if (!geminiKey) {
      const inputKey = window.prompt(
        "Nhập Google Gemini API Key của bạn để AI đọc trực tiếp file gốc và phục hồi 100% công thức:\n(Key được lưu an toàn trên máy bạn cho các lần sau)"
      );
      if (!inputKey || !inputKey.trim()) return;
      geminiKey = inputKey.trim();
      localStorage.setItem("tct_gemini_api_key", geminiKey);
    }

    setIsAiPolishing(true);

    try {
      const res = await fetch("/api/ai-polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawText,
          fileBase64,
          apiKey: geminiKey
        })
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch {
        alert("Lỗi máy chủ: Hàm xử lý mất nhiều thời gian hoặc phản hồi không đúng. Vui lòng thử lại!");
        return;
      }

      if (!res.ok) {
        if (res.status === 401 || data.error?.includes("API_KEY")) {
          localStorage.removeItem("tct_gemini_api_key");
          alert("API Key không hợp lệ hoặc đã hết hạn! Vui lòng bấm lại để nhập Key mới.");
        } else {
          alert("Lỗi AI: " + (data.error || "Không thể xử lý"));
        }
        return;
      }

      if (data.result && data.result.trim()) {
        handleRawTextChange(data.result.trim());
        alert("✨ AI Gemini đã đọc toàn bộ file và phục hồi 100% công thức toán học và lời giải chi tiết!");
      }
    } catch (err: any) {
      console.error("Lỗi Polish AI:", err);
      alert("Lỗi kết nối tới AI: " + err.message);
    } finally {
      setIsAiPolishing(false);
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

  const handleAutoDistribute10Points = () => {
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

      const otherQuestions = allQuestions.filter(item => item.id !== qId);
      const remainingPoints = Math.max(0, 10 - validPoint);
      const newAverageForOthers = Number((remainingPoints / otherQuestions.length).toFixed(2));

      let currentAllocated = validPoint;
      const pointMap: Record<string, number> = { [qId]: validPoint };

      otherQuestions.forEach((item, idx) => {
        if (idx === otherQuestions.length - 1) {
          const finalPt = Number(Math.max(0, 10 - currentAllocated).toFixed(2));
          pointMap[item.id] = finalPt;
        } else {
          pointMap[item.id] = newAverageForOthers;
          currentAllocated += newAverageForOthers;
        }
      });

      return prev.map(sec => ({
        ...sec,
        questions: sec.questions.map(q => {
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

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (!base64) return;

      const newKey = "img_custom_" + Date.now();
      setMediaMap(prev => ({ ...prev, [newKey]: base64 }));

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

      <header className="h-16 px-6 border-b border-slate-200 bg-white/90 backdrop-blur-md flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-700 to-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-base shadow-sm">
            AZ
          </div>
          <div>
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              Azota All-In-One Exam Engine
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                Fullscreen Pro
              </span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Bước {step}/3: {step === 1 ? "Bóc tách & Biên tập đề thi" : step === 2 ? "Ma trận đáp án & Thang điểm 10" : "Cài đặt & Xuất bản"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <span className={"px-3 py-1 rounded-lg transition-all " + (step === 1 ? "bg-white text-blue-700 shadow-xs" : "")}>
              1. Biên tập & Preview
            </span>
            <span className={"px-3 py-1 rounded-lg transition-all " + (step === 2 ? "bg-white text-blue-700 shadow-xs" : "")}>
              2. Ma trận đáp án & Điểm
            </span>
            <span className={"px-3 py-1 rounded-lg transition-all " + (step === 3 ? "bg-white text-blue-700 shadow-xs" : "")}>
              3. Cài đặt đề thi
            </span>
          </div>

          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            title="Đóng trình cấu hình"
          >
            <X className="w-6 h-6"/>
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col bg-[#F8FAFC]">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-500">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600"/>
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-slate-800">Đang phân tích cấu trúc đề thi...</p>
              <p className="text-xs text-slate-500">Tự động nhận diện câu hỏi, nối trang và tách riêng lời giải...</p>
            </div>
          </div>
        ) : step === 1 ? (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 min-h-0 overflow-hidden">
            <div className="flex flex-col h-full border border-slate-200 rounded-2xl bg-white shadow-xs overflow-hidden">
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                <span className="text-xs font-black uppercase tracking-wider text-blue-600 flex items-center gap-1.5">
                  <Eye className="w-4 h-4"/> Xem trước đề thi (Preview)
                </span>
                <span className="text-xs text-slate-500 font-bold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-lg border border-blue-200/50">
                  {totalQuestions} câu hỏi • {sections.length} phần thi
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {sections.map((sec, sIdx) => (
                  <div key={"sec-pv-" + sIdx} className="space-y-4">
                    <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 rounded-2xl border border-blue-200/80 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                          {sIdx + 1}
                        </div>
                        <div>
                          <h4 className="font-black text-sm text-slate-900 uppercase tracking-wide">
                            {sec.section_title}
                          </h4>
                          <p className="text-[11px] font-semibold text-blue-700">
                            {sec.questions.length} câu hỏi • {
                              sec.section_type === "true_false" 
                                ? "Trắc nghiệm Đúng / Sai" 
                                : sec.section_type === "short_answer" 
                                  ? "Trả lời ngắn" 
                                  : "Trắc nghiệm nhiều lựa chọn (A, B, C, D)"
                            }
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-2xs">
                        {sec.questions.length} câu
                      </span>
                    </div>

                    <div className="space-y-4">
                      {sec.questions.map((q, idx) => {
                        const isSolOpen = !!expandedSolutions[q.id];

                        return (
                          <div key={q.id} className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/40 hover:bg-slate-50/70 transition-all space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                              <span className="font-black text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200/60">
                                {q.original_label || ("Câu " + (idx + 1))}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500">Đáp án:</span>
                                <span className="font-black text-xs text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300">
                                  {q.correct_answer || "Chưa có"}
                                </span>
                              </div>
                            </div>

                            {/* Render ảnh câu hỏi */}
                            <div className="py-1">
                              <TokenViewer content={q.prompt_html} mediaMap={mediaMap}/>
                            </div>

                            {/* DẠNG 1: TRẮC NGHIỆM 4 NÚT CHỌN NHANH A, B, C, D (Gọn gàng đúng chuẩn Azota) */}
                            {sec.section_type === "multiple_choice" && (
                              <div className="flex items-center gap-3 pt-2">
                                <span className="text-xs font-bold text-slate-500">Chọn đáp án:</span>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {["A", "B", "C", "D"].map(k => {
                                    const isCorrect = k === q.correct_answer;
                                    return (
                                      <button
                                        key={k}
                                        type="button"
                                        onClick={() => handleUpdateAnswer(q.id, k)}
                                        className={"w-10 h-10 rounded-xl font-black text-sm flex items-center justify-center transition-all cursor-pointer " + (
                                          isCorrect 
                                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/25 scale-105" 
                                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                                        )}
                                      >
                                        {k}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* DẠNG 2: BẢNG TICK ĐÚNG / SAI CHO CÁC Ý a, b, c, d */}
                            {sec.section_type === "true_false" && q.options && (
                              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                                <table className="w-full text-left text-[13px]">
                                  <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                      <th className="py-2.5 px-3 font-bold text-slate-600">Phát biểu</th>
                                      <th className="py-2.5 px-3 text-center font-bold text-emerald-600 w-20">Đúng</th>
                                      <th className="py-2.5 px-3 text-center font-bold text-rose-600 w-20">Sai</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 bg-white">
                                    {["a", "b", "c", "d"].map(subKey => {
                                      const opt = q.options.find(o => o.key === subKey);
                                      const isTrue = opt?.is_true_false_ans === true;
                                      const isFalse = opt?.is_true_false_ans === false;
                                      return (
                                        <tr key={subKey} className="hover:bg-slate-50/50">
                                          <td className="py-2.5 px-3">
                                            <span className="font-bold text-blue-600 uppercase">Ý {subKey})</span>
                                          </td>
                                          <td className="py-2.5 px-3 text-center align-middle">
                                            <div 
                                              onClick={() => handleToggleTrueFalseOpt(q.id, subKey, true)}
                                              className={"w-7 h-7 mx-auto rounded-lg border flex items-center justify-center cursor-pointer transition-all " + (isTrue ? "bg-emerald-500 border-emerald-500 text-white shadow-sm scale-110" : "bg-slate-50 border-slate-300 text-transparent hover:bg-slate-100")}
                                            >
                                              <Check className="w-4 h-4"/>
                                            </div>
                                          </td>
                                          <td className="py-2.5 px-3 text-center align-middle">
                                            <div 
                                              onClick={() => handleToggleTrueFalseOpt(q.id, subKey, false)}
                                              className={"w-7 h-7 mx-auto rounded-lg border flex items-center justify-center cursor-pointer transition-all " + (isFalse ? "bg-rose-500 border-rose-500 text-white shadow-sm scale-110" : "bg-slate-50 border-slate-300 text-transparent hover:bg-slate-100")}
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

                            {/* DẠNG 3: TRẢ LỜI NGẮN / ĐIỀN KHUYẾT (Hỗ trợ phân số, số âm) */}
                            {sec.section_type === "short_answer" && (
                              <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 flex items-center gap-3 text-xs mt-3">
                                <span className="font-bold text-slate-700 whitespace-nowrap">Đáp số:</span>
                                <input 
                                  type="text" 
                                  value={q.correct_answer || ""} 
                                  onChange={(e) => handleUpdateAnswer(q.id, e.target.value)} 
                                  placeholder="Nhập đáp số (ví dụ: -4, 64/27)..." 
                                  className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-indigo-900 outline-none focus:border-indigo-600" 
                                />
                              </div>
                            )}

                            {/* NÚT XEM LỜI GIẢI GỐC */}
                            {q.solution_html && (
                              <div className="pt-3 border-t border-slate-100 mt-3">
                                <button
                                  type="button"
                                  onClick={() => toggleSolution(q.id)}
                                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50/50 px-2.5 py-1.5 rounded-lg border border-indigo-100 transition-colors"
                                >
                                  <BookOpen className="w-3.5 h-3.5"/>
                                  <span>{isSolOpen ? "Thu gọn lời giải" : "Hiển thị lời giải chi tiết"}</span>
                                </button>
                                {isSolOpen && (
                                  <div className="mt-2.5 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100/80 text-[13px]">
                                    <TokenViewer content={q.solution_html} mediaMap={mediaMap}/>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col h-full border border-slate-200 rounded-2xl bg-slate-50/50 shadow-xs overflow-hidden">
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-100/80 shrink-0">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-slate-700"/>
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Nội dung thô (Raw Editor)
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAiPolishFormulas}
                    disabled={isAiPolishing}
                    className="px-2.5 py-1 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    title="AI đọc trực tiếp file gốc để sửa toàn bộ công thức và lời giải chuẩn 100%"
                  >
                    {isAiPolishing ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Wand2 className="w-3.5 h-3.5"/>}
                    <span>Sửa lỗi công thức AI</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerUploadImage}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                    title="Chèn ảnh từ máy tính vào vị trí con trỏ chuột"
                  >
                    <ImagePlus className="w-3.5 h-3.5 text-blue-600"/>
                    <span>Tải ảnh</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleInsertImageUrl}
                    className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                    title="Dán đường link (URL) ảnh từ internet"
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-indigo-600"/>
                    <span>Chèn Link Ảnh</span>
                  </button>
                </div>
              </div>

              <div className="flex-1 p-2 bg-white relative">
                <textarea
                  ref={textareaRef}
                  value={rawText}
                  onChange={(e) => handleRawTextChange(e.target.value)}
                  placeholder="Nội dung đề thi thô... Bấm 'Sửa lỗi công thức AI' nếu thấy công thức bị dịch lỗi."
                  className="w-full h-full p-3 font-mono text-xs text-slate-800 bg-transparent resize-none outline-none leading-relaxed custom-scrollbar border-none focus:ring-0"
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
                  <Calculator className="w-5 h-5 text-blue-600"/>
                  Cấu hình Ma trận đáp án & Thang điểm 10.0 (Auto-Balance)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Điểm được khoá cứng chuẩn 10.0. Khi bạn sửa điểm bất kỳ câu nào, các câu còn lại sẽ tự động bù trừ cân bằng.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleAutoDistribute10Points}
                  className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <RefreshCw className="w-3.5 h-3.5"/>
                  <span>Chia đều 10 điểm</span>
                </button>

                <div className="px-3.5 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600"/>
                  <span>Tổng điểm: 10.00 / 10.0 (Cố định)</span>
                </div>
              </div>
            </div>

            {sections.some(s => s.section_type === "true_false") && (
              <div className="p-5 bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-white rounded-3xl border border-indigo-200/80 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-indigo-700"/>
                    <h4 className="font-black text-xs sm:text-sm text-indigo-950 uppercase">
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
                          className="w-14 px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-center text-xs font-black text-indigo-900 outline-none focus:border-indigo-600 focus:bg-white"
                        />
                        <span className="text-xs font-bold text-slate-400">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              {sections.map((sec, sIdx) => (
                <div key={"sec-cfg-" + sIdx} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="font-black text-sm text-slate-900 uppercase">
                        {sec.section_title}
                      </h4>
                      <span className="text-[11px] text-slate-500 font-semibold">
                        {sec.section_type === "true_false" ? "Trắc nghiệm Đúng/Sai" : sec.section_type === "short_answer" ? "Trả lời ngắn" : "Trắc nghiệm 4 phương án"}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-lg">
                      {sec.questions.length} câu hỏi
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 pt-1">
                    {sec.questions.map((q, idx) => (
                      <div key={q.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                          <span className="font-black text-blue-700">{q.original_label || ("Câu " + (idx + 1))}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Điểm:</span>
                            <input 
                              type="number"
                              step="0.05"
                              value={q.points !== undefined ? q.points : 0.25}
                              onChange={(e) => handleUpdatePoints(q.id, parseFloat(e.target.value) || 0)}
                              className="w-14 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-center text-xs font-black text-blue-900 outline-none focus:border-blue-600"
                            />
                          </div>
                        </div>

                        {sec.section_type === "multiple_choice" && (
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
                                      ? "bg-emerald-600 text-white shadow-xs scale-105" 
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

                        {sec.section_type === "short_answer" && (
                          <input 
                            type="text"
                            value={q.correct_answer || ""}
                            onChange={(e) => handleUpdateAnswer(q.id, e.target.value)}
                            placeholder="Đáp án..."
                            className="w-full p-1.5 bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
                  <label className="block mb-1.5">Thời gian làm bài (Phút) *</label>
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

                <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 text-blue-900 text-xs leading-relaxed font-normal">
                  • Đề thi gồm <strong className="font-bold">{totalQuestions} câu hỏi</strong> thuộc <strong className="font-bold">{sections.length} phần thi</strong> đã sẵn sàng xuất bản.<br />
                  • Tổng điểm: <strong className="font-bold">10.0 / 10.0 điểm chuẩn</strong> (Auto-Balanced).<br />
                  • Toàn bộ công thức toán KaTeX, tọa độ không gian và hình ảnh đồ thị đã được chuẩn hóa.
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
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer transition-all"
            >
              <span>Tiếp tục ({totalQuestions} câu)</span>
              <ArrowRight className="w-4 h-4"/>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onSave({
                  id: "exam-" + Date.now(),
                  title: examTitle || "Đề thi mới",
                  duration_minutes: duration,
                  category,
                  sections,
                  total_points: 10.0,
                  mediaMap,
                  createdAt: new Date().toISOString()
                });
                onClose();
              }}
              className="px-7 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-500/20 cursor-pointer transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4"/>
              <span>Lưu & Xuất Bản Đề Thi</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default AzotaExamConfigModal;
