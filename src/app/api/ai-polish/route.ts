import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = body?.text || "";
    const fileBase64 = body?.fileBase64 || "";
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
      "Bạn là chuyên gia khôi phục và chuẩn hóa đề thi Toán học Việt Nam từ định dạng Word MathType sang Markdown/LaTeX chuẩn KaTeX.\n" +
      "Nhiệm vụ của bạn:\n" +
      "1. ĐỌC VÀ KHÔI PHỤC TỔNG QUÁT MỌI CÔNG THỨC TOÁN BỊ MẤT HOẶC BỊ SÓT:\n" +
      "   - Khôi phục mọi ký tự MathType bị lỗi rỗng, dấu bằng rỗng 😊), các biểu thức tọa độ không gian Oxyz, vectơ, phân số, căn thức, ma trận, bảng biến thiên.\n" +
      "   - Đảm bảo các phương án A, B, C, D có nội dung toán học đầy đủ, không để rỗng bất kỳ phương án nào.\n" +
      "   - Khôi phục trọn vẹn Lời giải chi tiết của tất cả các câu từ Câu 1 đến câu cuối cùng.\n" +
      "2. ĐÁNH SỐ THỨ TỰ CÂU CHUẨN XÁC: Đánh số lần lượt Câu 1, Câu 2, Câu 3... liên tục, không lặp lại số câu.\n" +
      "3. PHẦN III TRẢ LỜI NGẮN: Ghi rõ 'Đáp số: <giá trị>', không chèn chữ 'Lời giải' vào sau dấu hai chấm của đáp số.\n" +
      "4. GIỮ NGUYÊN CÁC THẺ ẢNH: Tuyệt đối giữ nguyên các thẻ ảnh dạng [img:$...$] hoặc [img:https://...].\n" +
      "5. Chỉ trả về nội dung đề thi đã sửa và phục hồi, KHÔNG thêm lời chào, KHÔNG bọc trong markdown code block.";

    const parts: any[] = [];
    if (fileBase64) {
      parts.push({
        inlineData: {
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          data: fileBase64
        }
      });
      parts.push({
        text: systemPrompt + "\n\n--- DƯỚI ĐÂY LÀ VĂN BẢN THÔ TRÍCH XUẤT ĐỂ THAM KHẢO VỊ TRÍ ẢNH ---\n" + text
      });
    } else {
      parts.push({
        text: systemPrompt + "\n\n--- DƯỚI ĐÂY LÀ ĐỀ THI CẦN SỬA VÀ KHÔI PHỤC ---\n" + text
      });
    }

    const candidateModels = [
      "gemini-2.5-flash",
      "gemini-2.0-flash"
    ];

    let resultText = "";
    let lastError = "";

    for (const model of candidateModels) {
      try {
        const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + cleanKey;

        const response = await fetch(endpoint, {
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
          lastError = "Lỗi phản hồi từ Google AI";
          continue;
        }

        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          resultText = data.candidates[0].content.parts[0].text;
          break;
        } else {
          lastError = data?.error?.message || ("Lỗi model " + model);
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
      }
    }

    if (!resultText) {
      return NextResponse.json({ error: lastError || "Máy chủ AI đang bận!" }, { status: 400 });
    }

    return NextResponse.json({ result: resultText });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi máy chủ nội bộ" }, { status: 500 });
  }
}
