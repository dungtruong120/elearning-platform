import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text, apiKey } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Văn bản rỗng" }, { status: 400 });
    }

    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Chưa cấu hình GEMINI_API_KEY. Vui lòng nhập API Key!" },
        { status: 401 }
      );
    }

    const systemPrompt = "Bạn là chuyên gia chuyển đổi và phục hồi đề thi Toán học Việt Nam từ định dạng Word/MathType sang Markdown/LaTeX chuẩn KaTeX.\n" +
      "Nhiệm vụ của bạn:\n" +
      "1. Sửa toàn bộ các công thức toán bị lỗi hoặc sót do trích xuất MathType:\n" +
      "   - Khôi phục các tọa độ điểm trong không gian Oxyz: ví dụ 'M(0;1/2;1); N(1/2;0;1); P(1;1/2;0); Q(1;1/2;1)' -> chuyển thành LaTeX chuẩn KaTeX: $M\\left(0; \\frac{1}{2}; 1\\right); N\\left(\\frac{1}{2}; 0; 1\\right); P\\left(1; \\frac{1}{2}; 0\\right); Q\\left(1; 1; \\frac{1}{2}\\right)$. TUYỆT ĐỐI KHÔNG ĐỂ RỖNG CÁC PHƯƠNG ÁN A, B, C, D.\n" +
      "   - Các biểu thức rỗng như $x^{{}}$ -> khôi phục thành $x_1, x_2$ hoặc lũy thừa đúng ngữ cảnh bài toán.\n" +
      "   - Các biểu thức dính lỗi như $3a.0^{{}}$ -> sửa thành $3a \\cdot 0$ hoặc $3a_0$.\n" +
      "   - Các so sánh bị lỗi như $a>>$, $a><$, $a>$ -> sửa thành $a > 0$, $a < 0$.\n" +
      "   - Hàm số bị lỗi như y=(^{E}), y=(^{3}) -> sửa thành $y = ax^3 + bx^2 + cx + d$ hoặc hàm phân thức đúng theo ngữ cảnh bài toán.\n" +
      "   - Bảng biến thiên, giới hạn, tích phân, đạo hàm: đưa tất cả vào cặp dấu $...$ (inline) hoặc $$...$$ (khối).\n" +
      "2. TUYỆT ĐỐI GIỮ NGUYÊN các thẻ ảnh có định dạng [img:$...$] hoặc [img:https://...], không được xóa hoặc thay đổi tên thẻ ảnh.\n" +
      "3. Giữ nguyên cấu trúc: Câu 1:, Câu 2:, các phương án A. B. C. D. và Lời giải (nếu có).\n" +
      "4. Chỉ trả về nội dung đề thi đã được sửa chuẩn xác, KHÔNG thêm lời chào, KHÔNG bọc trong block code markdown.";

    // Danh sách model thế hệ mới, tự động luân chuyển nếu một model gặp lỗi High Demand (503)
    const candidateModels = [
      "gemini-3.5-flash",
      "gemini-3.8-flash",
      "gemini-3.1-flash-lite",
      "gemini-3-flash"
    ];

    let outputText = "";
    let lastError = "";
    const cleanKey = String(key).trim();

    for (const model of candidateModels) {
      try {
        const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + cleanKey;
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: systemPrompt + "\n\n--- DƯỚI ĐÂY LÀ ĐỀ THI CẦN SỬA ---\n" + text }]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192
            }
          })
        });

        const data = await response.json();
        if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
          outputText = data.candidates[0].content.parts[0].text;
          break;
        } else {
          lastError = data?.error?.message || ("Lỗi model " + model);
        }
      } catch (e: any) {
        lastError = e?.message || "Lỗi kết nối";
      }
    }

    if (!outputText) {
      return NextResponse.json({ error: lastError || "Không thể kết nối tới AI" }, { status: 400 });
    }

    return NextResponse.json({ result: outputText });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi máy chủ" }, { status: 500 });
  }
}
