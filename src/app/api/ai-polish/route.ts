import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = body?.text || "";
    const fileBase64 = body?.fileBase64 || "";
    const fileType = body?.fileType || "docx";
    const apiKey = body?.apiKey || process.env.GEMINI_API_KEY || "";

    const cleanKey = String(apiKey).replace(/\s+/g, "").trim();

    if (!text && !fileBase64) {
      return NextResponse.json({ error: "Dữ liệu đề thi rỗng" }, { status: 400 });
    }

    if (!cleanKey) {
      return NextResponse.json(
        { error: "Chưa cấu hình GEMINI_API_KEY. Vui lòng nhập API Key!" },
        { status: 401 }
      );
    }

    const promptLines = [
      "Ban la chuyen gia so 1 ve boc tach, chuan hoa va phuc hoi de thi Toan hoc Viet Nam sang Markdown va LaTeX chuan KaTeX.",
      "Nhiem vu cua ban:",
      "1. DOC TOAN BO NOI DUNG TU TEP DINH KEM (PDF/DOCX) HOAC VAN BAN DUOC CUNG CAP:",
      "   - Chuyen moi cong thuc toan hoc (toa do Oxyz, phan so, can thuc, ma tran, bang bien thien, vecto, goc) sang KaTeX: kep trong $...$ hoac $$...$$.",
      "   - Khoi phuc tron ven moi bieu thuc bi sot, khong de rong cac phuong an A, B, C, D.",
      "   - Khoi phuc toan bo noi dung Loi giai chi tiet tu Cau 1 den cau cuoi cung.",
      "2. DANH SO THU TU CAU CHUAN XAC:",
      "   - Danh so lan luot Cau 1, Cau 2, Cau 3... lien tuc theo dung thu tu de thi.",
      "   - Tuyet doi khong lap lai so cau.",
      "3. PHAN III TRA LOI NGAN:",
      "   - Ghi dinh dang chuan: 'Dap so: <gia tri>', khong chen chu 'Loi giai' vao o dap so.",
      "4. GIU NGUYEN CAC THE ANH:",
      "   - Giu nguyen cac the anh dang [img:$...$] hoac [img:https://...] neu co trong de bai tham khao.",
      "5. Chi tra ve noi dung de thi da sua va phuc hoi chuan xac, KHONG them loi chao, KHONG boc trong the markdown code block."
    ];
    const systemPrompt = promptLines.join("\n");

    const parts: any[] = [];
    if (fileBase64) {
      const mimeType = fileType === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      parts.push({
        inlineData: {
          mimeType,
          data: fileBase64
        }
      });
      parts.push({
        text: systemPrompt + (text ? "\n\n--- DANH SACH ANH VA VAN BAN THO THAM KHAO ---\n" + text : "")
      });
    } else {
      parts.push({
        text: systemPrompt + "\n\n--- DE THI CAN SUA VA KHOI PHUC ---\n" + text
      });
    }

    const host = String.fromCharCode(103,101,110,101,114,97,116,105,118,101,108,97,110,103,117,97,103,101,46,103,111,111,103,108,101,97,112,105,115,46,99,111,109);
    const targetModel = "gemini-3.8-flash";
    const fullUrl = "https://" + host + "/v1beta/models/" + targetModel + ":generateContent?key=" + cleanKey;

    let resultText = "";
    let lastError = "";

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(fullUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192
            }
          })
        });

        const resText = await response.text();
        let data: any = {};
        try {
          data = JSON.parse(resText);
        } catch {
          lastError = "Lỗi phản hồi cấu trúc dữ liệu từ máy chủ";
          continue;
        }

        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          resultText = data.candidates[0].content.parts[0].text;
          break;
        } else {
          lastError = data?.error?.message || "Máy chủ AI đang phản hồi chậm";
          if (resText.includes("high demand") || response.status === 503 || response.status === 429) {
            await sleep(1500 * attempt);
            continue;
          }
          break;
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
        await sleep(1500 * attempt);
      }
    }

    if (!resultText) {
      return NextResponse.json({ error: lastError || "Máy chủ AI hiện tại đang bận, vui lòng thử lại sau vài giây!" }, { status: 400 });
    }

    return NextResponse.json({ result: resultText });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}
