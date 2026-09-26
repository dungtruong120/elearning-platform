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
import { QuestionType, QuestionOption, ParsedQuestion, ExamSection } from "@/types";

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
  sub_weights?: { a: number; b: number; c: number; d: number };
  sub_points?: { a: number; b: number; c: number; d: number };
}

export interface ExtendedExamSection extends ExamSection {
  questions: ExtendedParsedQuestion[];
}

function isCleanLatex(latex: string): boolean {
  if (!latex || typeof latex !== "string") return false;
  const trimmed = latex.trim();
  if (trimmed.length < 1) return false;
  if (trimmed.includes("\\langle") || trimmed.includes("\\rangle") || trimmed.includes("()") || trimmed.includes("[]") || /\\sqrt\{\s*\}/.test(trimmed)) return false;
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.charCodeAt(i);
    if ((code >= 0x4e00 && code <= 0x9fff) || (code >= 0x3400 && code <= 0x4dbf) || (code >= 0x3040 && code <= 0x30ff) || (code >= 0xac00 && code <= 0xd7af)) return false;
  }
  if (/EquationNative|MTExtra|CompObj|OleObject|Times New Roman|Symbol|Word\.Document/i.test(trimmed)) return false;
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
    return degStr ? "\\sqrt[" + degStr + "]{" + (e ? convertOmmlToLatex(e) : "") + "}" : "\\sqrt{" + (e ? convertOmmlToLatex(e) : "") + "}";
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
  constructor(data: Uint8Array) { this.data = data; }
  readByte(): number { return this.pos < this.data.length ? this.data[this.pos++] : 0; }
  readUint16(): number {
    if (this.pos + 1 < this.data.length) {
      const val = this.data[this.pos] | (this.data[this.pos + 1] << 8);
      this.pos += 2;
      return val;
    }
    return 0;
  }
  hasMore(): boolean { return this.pos < this.data.length; }
}

function decodeMtefToLatex(uint8: Uint8Array): string {
  if (!uint8 || uint8.length < 10) return "";
  let start = -1;
  for (let i = 0; i < uint8.length - 10; i++) {
    if ((uint8[i] === 3 || uint8[i] === 5) && (uint8[i + 1] === 0 || uint8[i + 1] === 1) && (uint8[i + 2] === 0 || uint8[i + 2] === 1) && uint8[i + 3] >= 1 && uint8[i + 3] <= 10 && uint8[i + 4] === 0) {
      start = i;
      break;
    }
  }
  if (start === -1) return "";
  const version = uint8[start];
  let offset = start + 5;
  while (offset < uint8.length && uint8[offset] !== 0) offset++;
  if (offset < uint8.length && uint8[offset] === 0) offset += 2;

  const reader = new MTEFStreamReader(uint8.subarray(offset));
  const SYMBOL_MAP: Record<number, string> = {
    0x03B1: "\\alpha", 0x03B2: "\\beta", 0x03B3: "\\gamma", 0x03B4: "\\delta", 0x03C0: "\\pi", 0x03B8: "\\theta",
    0x03BB: "\\lambda", 0x03BC: "\\mu", 0x03C3: "\\sigma", 0x03C9: "\\omega", 0x0394: "\\Delta", 0x03A9: "\\Omega",
    0x00B1: "\\pm ", 0x00D7: "\\times ", 0x00F7: "\\div ", 0x2264: "\\le ", 0x2265: "\\ge ", 0x2260: "\\ne ",
    0x221E: "+\\infty ", 0x2208: "\\in ", 0x2192: "\\to ", 0x21D2: "\\Rightarrow ", 0x2248: "\\approx ",
    0x2205: "\\emptyset ", 0x2229: "\\cap ", 0x222A: "\\cup ", 0x2212: "-", 0x2013: "-", 0x2014: "-"
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
        if (opts & 0x04) reader.readByte();
        res.push(parseLine());
      } else if (recType === 2) {
        if (opts & 0x08) { reader.readByte(); reader.readByte(); }
        reader.readByte();
        const chCode = reader.readUint16();
        if (opts & 0x02) { const emb = reader.readByte(); if (emb === 5) res.push("'"); else if (emb === 6) res.push("''"); }
        if (SYMBOL_MAP[chCode]) res.push(SYMBOL_MAP[chCode]);
        else if (chCode >= 32 && chCode <= 126) res.push(String.fromCharCode(chCode));
      } else if (recType === 3) {
        if (opts & 0x08) { reader.readByte(); reader.readByte(); }
        const selector = reader.readByte();
        const variation = version >= 5 ? reader.readUint16() : reader.readByte();
        if (selector === 0 || selector === 1) res.push("(" + parseLine() + ")");
        else if (selector === 2) res.push("\\{" + parseLine() + "\\}");
        else if (selector === 3) res.push("[" + parseLine() + "]");
        else if (selector === 10 || selector === 13) {
          if (variation === 1) res.push("\\sqrt[" + parseLine() + "]{" + parseLine() + "}");
          else res.push("\\sqrt{" + parseLine() + "}");
        } else if (selector === 11 || selector === 14) res.push("\\frac{" + parseLine() + "}{" + parseLine() + "}");
        else if (selector === 15 || selector === 27 || selector === 28 || selector === 29) {
          if (variation === 0 || selector === 28) res.push("^{" + parseLine() + "}");
          else if (variation === 1 || selector === 27) res.push("_{" + parseLine() + "}");
          else res.push("_{" + parseLine() + "}^{" + parseLine() + "}");
        } else {
          const inner = parseLine();
          if (inner) res.push(inner);
        }
      }
    }
    return res.join("");
  };

  try {
    let raw = parseLine().trim().replace(/\\langle\s*\(\)\s*|\\langle\s*|\\rangle\s*|\\sqrt\{\s*\}|\(\)/g, "").trim();
    if (raw) return "$" + raw.replace(/--/g, "-").replace(/\+-/g, "-") + "$";
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
      if (tag.includes("oleobject")) oleRId = el.getAttribute("r:id") || el.getAttribute("id") || "";
    }
    if (oleRId && oleCache[oleRId] && isCleanLatex(oleCache[oleRId])) return " " + oleCache[oleRId] + " ";
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
          objects.forEach(obj => { line += processOleObject(obj as Element); });
        } else {
          Array.from(el.getElementsByTagNameNS("*", "t")).forEach((t: any) => { line += t.textContent || ""; });
          Array.from(el.getElementsByTagNameNS("*", "blip")).forEach((blip: any) => {
            const rId = blip.getAttribute("r:embed");
            if (rId && targetToToken[rId]) line += " " + targetToToken[rId] + " ";
          });
        }
      }
    });
    line = line.trim();
    if (line) rawLines.push(line);
  });

  return { text: rawLines.join("\n").normalize("NFC"), mediaMap };
}

export function normalizeOptionsSmart(text: string): string {
  if (!text) return "";
  let res = text.replace(/(\S+)\s*\.([B-D]\.)/g, "$1.\n$2");
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
  let norm = normalizeOptionsSmart(chunk.normalize("NFC").trim());
  const cleanChunk = norm.replace(/^\s*(?:\*{1,2})?(?:(?:Câu|Bài|Question)\s*\d+[:.\-\)]?|\d+[\.😕)])\s*(?:\*{1,2})?[:.\-\s]*/gi, "").trim();

  const solRegex = /(?:[\r\n]+|^)\s*(?:Lời\s*giải|HDG|Giải\s*:|LỜI\s*GIẢI)\b/gi;
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

    const tfMatches = Array.from(promptAndOpts.matchAll(/(?:^|[\r\n\t\s])([a-d])[\.\)]\s*/gim));
    let promptHtml = promptAndOpts;
    if (tfMatches.length >= 4) {
      promptHtml = promptAndOpts.slice(0, tfMatches[0].index).trim();
      for (let i = 0; i < 4; i++) {
        const start = tfMatches[i].index! + tfMatches[i][0].length;
        const end = i < 3 ? tfMatches[i + 1].index! : promptAndOpts.length;
        let t = promptAndOpts.slice(start, end).trim();
        if (/\[(Đúng|Đ)\]/i.test(t)) { options[i].is_true_false_ans = true; t = t.replace(/\[(Đúng|Đ)\]/i, "").trim(); }
        else if (/\[(Sai|S)\]/i.test(t)) { options[i].is_true_false_ans = false; t = t.replace(/\[(Sai|S)\]/i, "").trim(); }
        options[i].text_html = t;
      }
    }

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
    const ansMatch = /(?:Đáp\s*án|KQ)[:\s]+([^\r\n]+)/i.exec(cleanChunk);
    if (ansMatch) correctAns = ansMatch[1].trim();
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
  const optMatches = Array.from(promptAndOpts.matchAll(/(?:^|[\r\n\t\s\.])([A-D])[\.\)]\s*/gm));
  let promptHtml = promptAndOpts;
  const options: QuestionOption[] = [
    { key: "A", text_html: "" },
    { key: "B", text_html: "" },
    { key: "C", text_html: "" },
    { key: "D", text_html: "" }
  ];

  if (optMatches.length >= 4) {
    promptHtml = promptAndOpts.slice(0, optMatches[0].index).trim();
    for (let i = 0; i < 4; i++) {
      const start = optMatches[i].index! + optMatches[i][0].length;
      const end = i < 3 ? optMatches[i + 1].index! : promptAndOpts.length;
      options[i].text_html = promptAndOpts.slice(start, end).trim();
    }
  }

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
  const readyText = rawText.normalize("NFC").trim();
  SECTION_HEADER_REGEX.lastIndex = 0;
  const secMatches = Array.from(readyText.matchAll(SECTION_HEADER_REGEX));

  if (secMatches.length > 0) {
    const res: ExtendedExamSection[] = [];
    for (let i = 0; i < secMatches.length; i++) {
      const title = secMatches[i][1].trim();
      const start = secMatches[i].index! + secMatches[i][0].length;
      const end = i + 1 < secMatches.length ? secMatches[i + 1].index! : readyText.length;
      const body = readyText.slice(start, end).trim();
      const qChunks = body.split(/(?:^|[\r\n]+)(?:Câu|Bài|Question)\s*\d+[:.]?\s*/gi).filter(Boolean);
      const questions = qChunks.map((chunk, idx) => parseSingleQuestionChunk(chunk, idx + 1, title, getSectionTypeFromTitle(title), i));
      res.push({ section_title: title, section_type: getSectionTypeFromTitle(title), questions });
    }
    return res;
  }

  const qChunks = readyText.split(/(?:^|[\r\n]+)(?:Câu|Bài|Question)\s*\d+[:.]?\s*/gi).filter(Boolean);
  return [{
    section_title: "PHẦN I. TRẮC NGHIỆM",
    section_type: "multiple_choice",
    questions: qChunks.map((chunk, idx) => parseSingleQuestionChunk(chunk, idx + 1, "PHẦN I. TRẮC NGHIỆM", "multiple_choice", 0))
  }];
}

export function TokenViewer({ content, mediaMap, inline = false }: { content?: string; mediaMap: Record<string, string>; inline?: boolean; }) {
  if (!content) return null;
  const parts = content.split(/(\[img:[^\]]+\]|\$\$[\s\S]*?\$$|\$[\s\S]*?\$)/g);
  return (
    <div className={inline ? "inline leading-relaxed text-slate-800 text-[13px]" : "leading-relaxed text-slate-800 text-[14px] whitespace-pre-wrap"}>
      {parts.map((part, idx) => {
        if (!part) return null;
        const imgMatch = part.match(/^\[img:([^\]]+)\]$/);
        if (imgMatch) {
          const rawKey = imgMatch[1].replace(/^\$|\$$/g, "");
          const src = rawKey.startsWith("http") || rawKey.startsWith("data:") ? rawKey : mediaMap[rawKey];
          if (!src) return null;
          return <img key={idx} src={src} alt="Ảnh" className="max-h-60 rounded-xl my-2 inline-block border border-slate-200" />;
        }
        if (part.startsWith("$") && part.endsWith("$")) {
          const isDisplay = part.startsWith("$$");
          const math = isDisplay ? part.slice(2, -2) : part.slice(1, -1);
          try {
            return <span key={idx} dangerouslySetInnerHTML={{ __html: katex.renderToString(math.trim(), { displayMode: isDisplay, throwOnError: false }) }} />;
          } catch { return <span key={idx}>{math}</span>; }
        }
        return <span key={idx}>{part}</span>;
      })}
    </div>
  );
}

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
  const [examTitle, setExamTitle] = useState<string>("");
  const [duration, setDuration] = useState<number>(50);
  const [category, setCategory] = useState<string>(PRACTICE_CATEGORIES[0]);
  const [sections, setSections] = useState<ExtendedExamSection[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, string>>({});
  const [rawText, setRawText] = useState<string>("");

  useEffect(() => {
    if (file && isOpen) {
      setLoading(true);
      setExamTitle(file.name.replace(/\.[^/.]+$/, ""));
      extractDocxDirectly(file).then(res => {
        setMediaMap(res.mediaMap);
        setRawText(res.text);
        setSections(parseExamHierarchical(res.text));
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [file, isOpen]);

  // CẬP NHẬT TỶ LỆ % ĐIỂM CHO TỪNG Ý CỦA CÂU ĐÚNG SAI
  const handleUpdateSubWeight = (qId: string, subKey: "a" | "b" | "c" | "d", weightPercent: number) => {
    setSections(prev => prev.map(sec => ({
      ...sec,
      questions: sec.questions.map(q => {
        if (q.id !== qId) return q;
        const currentWeights = q.sub_weights || { a: 25, b: 25, c: 25, d: 25 };
        const newWeights = { ...currentWeights, [subKey]: weightPercent };
        const qPoints = q.points || 1.0;
        
        // TÍNH ĐIỂM CON: (Điểm câu * Tỷ lệ %) / 100
        const newSubPoints = {
          a: parseFloat(((qPoints * (newWeights.a || 0)) / 100).toFixed(2)),
          b: parseFloat(((qPoints * (newWeights.b || 0)) / 100).toFixed(2)),
          c: parseFloat(((qPoints * (newWeights.c || 0)) / 100).toFixed(2)),
          d: parseFloat(((qPoints * (newWeights.d || 0)) / 100).toFixed(2))
        };

        return { ...q, sub_weights: newWeights, sub_points: newSubPoints };
      })
    })));
  };

  const handleUpdatePoints = (qId: string, points: number) => {
    setSections(prev => prev.map(sec => ({
      ...sec,
      questions: sec.questions.map(q => {
        if (q.id !== qId) return q;
        const weights = q.sub_weights || { a: 25, b: 25, c: 25, d: 25 };
        const newSubPoints = {
          a: parseFloat(((points * weights.a) / 100).toFixed(2)),
          b: parseFloat(((points * weights.b) / 100).toFixed(2)),
          c: parseFloat(((points * weights.c) / 100).toFixed(2)),
          d: parseFloat(((points * weights.d) / 100).toFixed(2))
        };
        return { ...q, points, sub_points: newSubPoints };
      })
    })));
  };

  // CHỨC NĂNG FIX CỨNG TỔNG 10 ĐIỂM CHO TOÀN BỘ ĐỀ
  const handleAutoDistribute10Points = () => {
    const totalQ = sections.reduce((acc, s) => acc + s.questions.length, 0);
    if (totalQ === 0) return;
    const avgPoint = parseFloat((10 / totalQ).toFixed(2));
    setSections(prev => prev.map(sec => ({
      ...sec,
      questions: sec.questions.map(q => {
        const weights = q.sub_weights || { a: 25, b: 25, c: 25, d: 25 };
        return {
          ...q,
          points: avgPoint,
          sub_points: {
            a: parseFloat(((avgPoint * weights.a) / 100).toFixed(2)),
            b: parseFloat(((avgPoint * weights.b) / 100).toFixed(2)),
            c: parseFloat(((avgPoint * weights.c) / 100).toFixed(2)),
            d: parseFloat(((avgPoint * weights.d) / 100).toFixed(2))
          }
        };
      })
    })));
  };

  const currentTotalPoints = useMemo(() => {
    let sum = 0;
    sections.forEach(sec => sec.questions.forEach(q => { sum += (q.points || 0); }));
    return parseFloat(sum.toFixed(2));
  }, [sections]);

  const handleFinishSave = () => {
    if (Math.abs(currentTotalPoints - 10) > 0.05) {
      if (!confirm(Tổng điểm đề thi hiện tại là ${currentTotalPoints}đ (khác 10.0đ). Bạn có chắc chắn muốn xuất bản không?)) {
        return;
      }
    }

    onSave({
      id: "exam-" + Date.now(),
      title: examTitle || "Đề thi mới",
      duration_minutes: duration,
      category,
      sections,
      total_points: currentTotalPoints,
      createdAt: new Date().toISOString()
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 w-screen h-screen z-[200] bg-white flex flex-col font-sans overflow-hidden">
      <header className="h-16 px-6 border-b border-slate-200 bg-white flex items-center justify-between shrink-0 shadow-xs">
        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
          Azota All-In-One Exam Engine
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold text-slate-600">
            <span className={step === 1 ? "bg-white text-blue-700 px-3 py-1 rounded-lg shadow-xs" : "px-3 py-1"}>1. Soạn đề</span>
            <span className={step === 2 ? "bg-white text-blue-700 px-3 py-1 rounded-lg shadow-xs" : "px-3 py-1"}>2. Điểm & Đúng/Sai (%)</span>
            <span className={step === 3 ? "bg-white text-blue-700 px-3 py-1 rounded-lg shadow-xs" : "px-3 py-1"}>3. Xuất bản</span>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"><X className="w-6 h-6" /></button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col bg-[#F8FAFC]">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        ) : step === 1 ? (
          <div className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-hidden">
            <div className="flex flex-col border border-slate-200 rounded-2xl bg-white p-4 overflow-y-auto">
              <span className="text-xs font-black uppercase text-blue-600 mb-3">Xem trước nội dung đề thi</span>
              {sections.map((sec, sIdx) => (
                <div key={sIdx} className="mb-6">
                  <h4 className="font-black text-sm uppercase text-slate-900 mb-3">{sec.section_title}</h4>
                  {sec.questions.map((q, qIdx) => (
                    <div key={q.id} className="p-3 mb-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="font-bold text-xs text-blue-700">{q.original_label || `Câu ${qIdx + 1}`}: </span>
                      <TokenViewer content={q.prompt_html} mediaMap={mediaMap} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex flex-col border border-slate-200 rounded-2xl bg-white p-4">
              <span className="text-xs font-black uppercase text-slate-700 mb-3">Văn bản nguồn Word / Công thức</span>
              <textarea 
                value={rawText} 
                onChange={e => { setRawText(e.target.value); setSections(parseExamHierarchical(e.target.value)); }} 
                className="w-full flex-1 p-3 font-mono text-xs outline-none resize-none border border-slate-200 rounded-xl"
              />
            </div>
          </div>
        ) : step === 2 ? (
          <div className="flex-1 p-6 overflow-y-auto max-w-5xl mx-auto w-full space-y-6">
            <div className="p-5 bg-white rounded-3xl border border-slate-200 flex items-center justify-between shadow-xs">
              <div>
                <h3 className="font-black text-slate-900 text-base">Cấu hình thang điểm & Tỷ trọng % Đúng/Sai</h3>
                <p className="text-xs text-slate-500">Đặt điểm từng câu hoặc bấm chia đều 10 điểm</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  type="button" 
                  onClick={handleAutoDistribute10Points} 
                  className="px-3.5 py-1.5 bg-blue-50 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Chia đều 10.0 điểm
                </button>
                <div className={`px-3.5 py-1.5 rounded-xl border text-xs font-black ${Math.abs(currentTotalPoints - 10) < 0.05 ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'}`}>
                  Tổng điểm: {currentTotalPoints} / 10.0đ
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {sections.map((sec, sIdx) => (
                <div key={sIdx} className="bg-white p-5 rounded-3xl border border-slate-200 space-y-4">
                  <h4 className="font-black text-sm uppercase text-slate-900">{sec.section_title}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {sec.questions.map((q, idx) => (
                      <div key={q.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-xs text-blue-700">{q.original_label || `Câu ${idx + 1}`}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500 font-bold">Điểm câu:</span>
                            <input 
                              type="number" 
                              step="0.05" 
                              value={q.points || 0.25} 
                              onChange={e => handleUpdatePoints(q.id, parseFloat(e.target.value) || 0)}
                              className="w-16 p-1 bg-white border border-slate-300 rounded text-center text-xs font-black text-blue-900"
                            />
                          </div>
                        </div>

                        {/* CẤU HÌNH % TỪNG Ý CHO CÂU ĐÚNG SAI */}
                        {sec.section_type === "true_false" && (
                          <div className="pt-2 border-t border-slate-200 space-y-2">
                            <span className="text-[11px] font-bold text-slate-600 block">Quy định % điểm từng ý (A, B, C, D):</span>
                            <div className="grid grid-cols-4 gap-2">
                              {(["a", "b", "c", "d"] as const).map(k => (
                                <div key={k} className="bg-white p-1.5 rounded-lg border border-slate-200 text-center">
                                  <span className="text-[10px] font-black uppercase text-slate-700 block mb-0.5">Ý {k.toUpperCase()}</span>
                                  <div className="flex items-center justify-center gap-0.5">
                                    <input 
                                      type="number" 
                                      value={q.sub_weights?.[k] || 25} 
                                      onChange={e => handleUpdateSubWeight(q.id, k, parseFloat(e.target.value) || 0)}
                                      className="w-10 p-0.5 text-center text-xs font-bold border rounded outline-none"
                                    />
                                    <span className="text-[10px] text-slate-400">%</span>
                                  </div>
                                  <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">
                                    ={q.sub_points?.[k] || 0.25}đ
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 p-6 flex items-center justify-center">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-lg w-full space-y-4">
              <h3 className="font-black text-lg text-slate-900 text-center">Xuất bản đề thi</h3>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên đề thi *</label>
                <input 
                  type="text" 
                  value={examTitle} 
                  onChange={e => setExamTitle(e.target.value)} 
                  className="w-full p-2.5 border rounded-xl text-xs font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Thời gian (phút) *</label>
                <input 
                  type="number" 
                  value={duration} 
                  onChange={e => setDuration(Number(e.target.value))} 
                  className="w-full p-2.5 border rounded-xl text-xs font-bold outline-none"
                />
              </div>
              <div className="p-3 bg-blue-50 text-blue-900 rounded-xl text-xs font-medium">
                • Tổng số câu: <strong>{sections.reduce((acc, s) => acc + s.questions.length, 0)} câu</strong><br/>
                • Tổng điểm bài thi: <strong>{currentTotalPoints} / 10.0 điểm</strong>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="h-16 px-6 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
        <button 
          type="button" 
          disabled={step === 1} 
          onClick={() => setStep(step === 3 ? 2 : 1)} 
          className="px-5 py-2 border rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40"
        >
          Quay lại
        </button>
        <div className="flex items-center gap-3">
          {step < 3 ? (
            <button 
              type="button" 
              onClick={() => setStep(step === 1 ? 2 : 3)} 
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Tiếp tục
            </button>
          ) : (
            <button 
              type="button" 
              onClick={handleFinishSave} 
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black cursor-pointer shadow-md"
            >
              Lưu & Xuất Bản Đề Thi
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default AzotaExamConfigModal;
