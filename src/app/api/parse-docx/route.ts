import { NextResponse } from "next/server";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";

function salvageMathType(uint8: Uint8Array): string {
  let str = "";
  for (let i = 0; i < uint8.length; i++) {
    const b = uint8[i];
    if (b >= 32 && b <= 126) str += String.fromCharCode(b);
    else if (b === 0xB1) str += "\\pm ";
    else if (b === 0x221E) str += "\\infty ";
    else str += "*";
  }
  let mathStr = str;
  const eqIdx = str.lastIndexOf("EquationNative");
  if (eqIdx !== -1) {
    const chunks = str.slice(eqIdx + 14).split(/\*+/).filter(Boolean);
    const validChunk = chunks.find(c => !/MTExtra|MathType|Times|Symbol/i.test(c) && /[a-zA-Z0-9=+\-()]/.test(c));
    if (validChunk) mathStr = validChunk;
  }
  mathStr = mathStr.replace(/[^a-zA-Z0-9=+\-()<>|/.,;!'\\]/g, "");
  mathStr = mathStr.replace(/==/g, "=").replace(/fx/g, "f(x)").replace(/f'x/g, "f'(x)").replace(/R/g, "\\mathbb{R}");
  if (/^(-?[0-9a-zA-Z\\]+);(-?[0-9a-zA-Z\\]+)$/.test(mathStr)) mathStr = `(${mathStr.replace(';', '; ')})`;
  return (mathStr && mathStr !== "=") ? `$${mathStr}$` : "";
}

function convertOmmlToLatex(node: any): string {
  if (node.nodeType === 3) return node.textContent || "";
  const name = node.localName || node.nodeName?.split(":").pop() || "";
  if (name === "t") return node.textContent || "";
  if (name === "f") {
    const num = Array.from(node.childNodes).find((n: any) => n.nodeName.includes("num"));
    const den = Array.from(node.childNodes).find((n: any) => n.nodeName.includes("den"));
    return `\\frac{${num ? convertOmmlToLatex(num) : ""}}{${den ? convertOmmlToLatex(den) : ""}}`;
  }
  if (name === "sSup") {
    const e = Array.from(node.childNodes).find((n: any) => n.nodeName.includes("e"));
    const sup = Array.from(node.childNodes).find((n: any) => n.nodeName.includes("sup"));
    return `{${e ? convertOmmlToLatex(e) : ""}}^{${sup ? convertOmmlToLatex(sup) : ""}}`;
  }
  if (name === "sSub") {
    const e = Array.from(node.childNodes).find((n: any) => n.nodeName.includes("e"));
    const sub = Array.from(node.childNodes).find((n: any) => n.nodeName.includes("sub"));
    return `{${e ? convertOmmlToLatex(e) : ""}}_{${sub ? convertOmmlToLatex(sub) : ""}}`;
  }
  let str = "";
  if (node.childNodes) {
    for (let i = 0; i < node.childNodes.length; i++) {
      str += convertOmmlToLatex(node.childNodes[i]);
    }
  }
  return str;
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "Không tìm thấy file tải lên" }, { status: 400 });

    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const mediaMap: Record<string, string> = {};
    const relsMap: Record<string, string> = {};

    const relsFile = zip.files["word/_rels/document.xml.rels"];
    if (relsFile) {
      const xmlString = await relsFile.async("string");
      const xml = new DOMParser().parseFromString(xmlString, "text/xml");
      Array.from(xml.getElementsByTagName("Relationship")).forEach((rel: any) => {
        const id = rel.getAttribute("Id");
        const target = rel.getAttribute("Target");
        if (id && target) relsMap[id] = target.replace(/^media\//, "word/media/");
      });
    }

    const targetToToken: Record<string, string> = {};
    let imgCount = 1;

    for (const [rId, path] of Object.entries(relsMap)) {
      const zipPath = path.startsWith("word/") ? path : `word/${path}`;
      const fileEntry = zip.files[zipPath];
      if (fileEntry && /\.(png|jpe?g)$/i.test(zipPath)) {
        const b64 = await fileEntry.async("base64");
        const key = `img_${imgCount++}`;
        mediaMap[key] = `data:image/${zipPath.toLowerCase().endsWith("png") ? "png" : "jpeg"};base64,${b64}`;
        targetToToken[rId] = `[img:$${key}$]`;
      }
    }

    const docFile = zip.files["word/document.xml"];
    if (!docFile) throw new Error("File Word không hợp lệ.");
    const docXmlString = await docFile.async("string");
    const docXml = new DOMParser().parseFromString(docXmlString, "text/xml");
    const paragraphs = Array.from(docXml.getElementsByTagName("w:p"));
    const rawLines: string[] = [];

    paragraphs.forEach((p: any) => {
      let line = "";
      Array.from(p.childNodes).forEach((child: any) => {
        const name = child.localName || child.nodeName?.split(":").pop() || "";
        if (name === "oMath" || name === "oMathPara") {
          const latex = convertOmmlToLatex(child).trim();
          if (latex) line += ` $${latex.replace(/==/g, "=").replace(/R/g, "\\mathbb{R}")}$ `;
        } else if (name === "r") {
          Array.from(child.getElementsByTagNameNS("*", "t")).forEach((t: any) => { line += t.textContent; });
          Array.from(child.getElementsByTagNameNS("*", "blip")).forEach((blip: any) => {
            const rId = blip.getAttribute("r:embed") || blip.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed");
            if (rId && targetToToken[rId]) line += ` \n${targetToToken[rId]}\n `;
          });
        }
      });
      if (line.trim()) rawLines.push(line.trim());
    });

    let rawText = rawLines.join("\n");

    // ============================================================================
    // BẮT BUỘC: CHUẨN HÓA UNICODE NFC CHỐNG XÉ ĐÔI TỪ TIẾNG VIỆT
    // ============================================================================
    rawText = rawText.normalize("NFC");

    // Chuẩn hóa ngắt dòng: tiêu đề phần chuẩn (không bắt nhầm từ thường)
    rawText = rawText.replace(/(?:^|\n)\s*((?:Phần\s+[I|V|X|0-9]+|[I|V|X]+\.\s*Trắc\s*nghiệm|[I|V|X]+\.\s*Trả\s*lời)[^\n]*)/gi, "\n\n$1\n\n");

    // Bọc khối Lời giải an toàn, không ngắt đôi từ "Lời" hay "giải"
    rawText = rawText.replace(/(?:^|\n|[^\n])\s*(Lời\s+giải[\s:]*)/gi, "\n\nLời giải\n");

    // Chỉ tách phương án A-D khi có khoảng trắng phía trước VÀ dấu chấm + khoảng trắng phía sau
    rawText = rawText.replace(/(?:^|\s)(\*?[A-D])\s*([.:])\s+/g, "\n$1. ");

    // Chỉ tách ý đúng sai a-d khi có khoảng trắng phía trước VÀ dấu ngoặc đơn + khoảng trắng phía sau
    rawText = rawText.replace(/(?:^|\s)(\*?[a-d])\s*\)\s+/gi, "\n$1) ");

    return NextResponse.json({ text: rawText, mediaMap });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}