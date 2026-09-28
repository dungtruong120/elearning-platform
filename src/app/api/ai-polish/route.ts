import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text, apiKey } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Văn bản rỗng" }, { status: 400 });
    }

    // Ưu tiên key người dùng truyền vào hoặc lấy từ biến môi trường
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Chưa cấu hình GEMINI_API_KEY. Vui lòng nhập API Key!" },
        { status: 401 }
      );
    }

    const systemPrompt = `Bạn là chuyên gia chuyển đổi đề thi Toán học Việt Nam từ định dạng Word/MathType sang Markdown/LaTeX chuẩn KaTeX.
Nhiệm vụ của bạn:
1. Sửa toàn bộ các công thức toán bị lỗi do trích xuất MathType:
   - Các biểu thức rỗng như $x^{{}}$ -> khôi phục thành $x_1, x_2$ hoặc lũy thừa đúng ngữ cảnh.
   - Các biểu thức dính lỗi như $3a.0^{{}}$ -> sửa thành $3a \cdot 0$ hoặc $3a_0$.
   - Các so sánh bị lỗi như $a>>$, $a><$, $a>$ -> sửa thành $a > 0$, $a < 0$.
   - Hàm số bị lỗi như y=(^{E}), y=(^{3}) -> sửa thành $y = ax^3 + bx^2 + cx + d$ hoặc hàm phân thức đúng theo ngữ cảnh bài toán.
   - Bảng biến thiên, giới hạn, tích phân, đạo hàm: đưa tất cả vào cặp dấu $...$ (inline) hoặc $$...$$ (khối).
2. TUYỆT ĐỐI GIỮ NGUYÊN các thẻ ảnh có định dạng [img:$...$] hoặc [img:https://...], không được xóa hoặc thay đổi tên thẻ ảnh.
3. Giữ nguyên cấu trúc: Câu 1:, Câu 2:, các phương án A. B. C. D. và Lời giải (nếu có).
4. Chỉ trả về nội dung đề thi đã được sửa chuẩn xác, KHÔNG thêm lời chào, KHÔNG bọc trong block code \`\`\`markdown.`;

    const response = await fetch(
      https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key},
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: ${systemPrompt}\n\n--- DƯỚI ĐÂY LÀ ĐỀ THI CẦN SỬA ---\n${text} }]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message || "Lỗi khi gọi Gemini API" },
        { status: response.status }
      );
    }

    const outputText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return NextResponse.json({ result: outputText });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi máy chủ" }, { status: 500 });
  }
}
