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

    const systemPrompt = "Bạn là chuyên gia chuyển đổi và phục hồi đề thi Toán học Việt Nam từ file Word trích xuất MathType sang LaTeX chuẩn KaTeX.\n" +
      "Nhiệm vụ của bạn:\n" +
      "1. XÓA BỎ HOÀN TOÀN các cặp dấu ngoặc rỗng do lỗi trích xuất như: '\\left(\\right)', '()', '[]', '{}'. Ví dụ: '$\\left(\\right)ABCD.A\'$' -> chuyển thành '$ABCD.A\'$'.\n" +
      "2. KHÔI PHỤC ĐẦY ĐỦ CÁC TỌA ĐỘ VÀ CÔNG THỨC TOÁN Ở TẤT CẢ CÂU VÀ CÁC PHƯƠNG ÁN A, B, C, D:\n" +
      "   - Các tọa độ điểm không gian Oxyz: viết dưới dạng $M\\left(0; \\frac{1}{2}; 1\\right)$, $N\\left(\\frac{1}{2}; 0; 1\\right)$, $P\\left(1; \\frac{1}{2}; 0\\right)$, $Q\\left(1; 1; \\frac{1}{2}\\right)$. Tuyệt đối không để trống dòng A. B. C. D.\n" +
      "   - Các ký hiệu hình học: \\vec{a}, \\overrightarrow{AB}, \\parallel, \\perp, \\angle, ^\\circ\n" +
      "   - Phân số: \\frac{a}{b}, căn thức: \\sqrt{...}, \\sqrt[n]{...}\n" +
      "   - Tập hợp: \\mathbb{R}, \\in, \\notin, \\subset, \\cup, \\cap, \\emptyset\n" +
      "   - So sánh: sửa 'a>>', 'a><' thành $a > 0$, $a < 0$.\n" +
      "3. TUYỆT ĐỐI GIỮ NGUYÊN các thẻ ảnh có định dạng [img:$...$] hoặc [img:https://...], không được xóa hoặc thay đổi tên thẻ ảnh.\n" +
      "4. Giữ nguyên cấu trúc: Câu 1:, Câu 2:, các phương án A. B. C. D. và Lời giải (nếu có).\n" +
      "5. Chỉ trả về nội dung đề thi đã sửa, KHÔNG thêm lời chào, KHÔNG bọc trong markdown code block (```).";

    const apiUrl = "[https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=](https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=)" + key.trim();

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
      return NextResponse.json({ result: data.candidates[0].content.parts[0].text });
    } else {
      const errMsg = data?.error?.message || "Lỗi xử lý từ Google AI API";
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi máy chủ" }, { status: 500 });
  }
}
