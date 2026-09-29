```typescript
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

    const systemPrompt =
      "Bạn là chuyên gia số 1 về bóc tách, chuẩn hóa và phục hồi đề thi Toán học Việt Nam sang Markdown và LaTeX chuẩn KaTeX.\n" +
      "Nhiệm vụ của bạn:\n" +
      "1. ĐỌC TOÀN BỘ NỘI DUNG TỪ TỆP ĐÍNH KÈM (PDF/DOCX) HOẶC VĂN BẢN ĐƯỢC CUNG CẤP:\n" +
      "   - Chuyển mọi công thức toán học (tọa độ Oxyz, phân số, căn thức, ma trận, bảng biến thiên, vectơ, góc) sang KaTeX chuẩn: kẹp trong $...$ hoặc $$...$$.\n" +
      "   - Khôi phục trọn vẹn mọi biểu thức bị sót, không để rỗng các phương án A, B, C, D.\n" +
      "   - Khôi phục toàn bộ nội dung Lời giải chi tiết từ Câu 1 đến câu cuối cùng.\n" +
      "2. ĐÁNH SỐ THỨ TỰ CÂU CHUẨN XÁC:\n" +
      "   - Đánh số lần lượt Câu 1, Câu 2, Câu 3... liên tục theo đúng thứ tự đề thi.\n" +
      "   - Tuyệt đối không lặp lại số câu.\n" +
      "3. PHẦN III TRẢ LỜI NGẮN:\n" +
      "   - Ghi định dạng chuẩn: 'Đáp số: <giá trị>', không chèn chữ 'Lời giải' vào ô đáp số.\n" +
      "4. GIỮ NGUYÊN CÁC THẺ ẢNH:\n" +
      "   - Giữ nguyên các thẻ ảnh dạng [img:$...$] hoặc [img:https://...] nếu có trong đề bài tham khảo.\n" +
      "5. Chỉ trả về nội dung đề thi đã sửa và phục hồi chuẩn xác, KHÔNG thêm lời chào, KHÔNG bọc trong markdown code block (```).";

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
        text: systemPrompt + (text ? "\n\n--- DƯỚI ĐÂY LÀ VĂN BẢN THAM KHẢO VỊ TRÍ THẺ ẢNH NẾU CÓ ---\n" + text : "")
      });
    } else {
      parts.push({
        text: systemPrompt + "\n\n--- DƯỚI ĐÂY LÀ ĐỀ THI CẦN SỬA VÀ KHÔI PHỤC ---\n" + text
      });
    }

    const host = String.fromCharCode(103,101,110,101,114,97,116,105,118,101,108,97,110,103,117,97,103,101,46,103,111,111,103,108,101,97,112,105,115,46,99,111,109);
    const targetModel = "gemini-3.8-flash";
    const fullUrl = "https://" + host + "/v1beta/models/" + targetModel + ":generateContent?key=" + cleanKey;

    let resultText = "";
    let lastError = "";

    // Thực hiện gọi API với cơ chế tự động thử lại tối đa 3 lần nếu gặp quá tải cục bộ
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
          // Nếu gặp lỗi quá tải tải cao điểm (high demand), tạm dừng và thử lại
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
