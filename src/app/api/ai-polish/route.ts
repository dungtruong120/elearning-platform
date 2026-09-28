import { NextResponse } from "next/server";

// Cấu hình cho phép Vercel Serverless Function chạy tối đa 60 giây thay vì bị timeout sau 15 giây
export const maxDuration = 60;
export const dynamic = "force-dynamic";

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

    const systemPrompt = "Bạn là chuyên gia chuẩn hóa đề thi Toán học Việt Nam từ định dạng Word/MathType sang KaTeX.\n" +
      "Nhiệm vụ:\n" +
      "1. Xóa sạch mọi cặp ngoặc rỗng do lỗi trích xuất như '()', '[]', '{}', '\\left(\\right)'.\n" +
      "2. Khôi phục các tọa độ điểm không gian Oxyz: ví dụ 'M(0;1/2;1)' thành '\(M\\left(0; \\frac{1}{2}; 1\\right)\)'. Điền đầy đủ tọa độ vào các phương án A. B. C. D.\n" +
      "3. Sửa các ký hiệu: phân số \\frac{a}{b}, căn thức \\sqrt{...}, vectơ, song song \\parallel, vuông góc \\perp, góc ^\\circ.\n" +
      "4. TUYỆT ĐỐI GIỮ NGUYÊN các thẻ ảnh dạng [img:\(...\)] hoặc [img:https://...].\n" +
      "5. Giữ nguyên cấu trúc: Câu 1:, Câu 2:, các phương án A. B. C. D. và Lời giải (nếu có).\n" +
      "6. Chỉ trả về nội dung đề thi đã sửa, KHÔNG thêm lời chào, KHÔNG bọc trong markdown block (```).";

    const cleanKey = String(key).trim();
    const apiUrl = "[https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=](https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=)" + cleanKey;

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

    const rawResText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(rawResText);
    } catch {
      return NextResponse.json({ error: "Phản hồi từ Google AI không hợp lệ: " + rawResText.slice(0, 120) }, { status: 502 });
    }

    if (response.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return NextResponse.json({ result: data.candidates[0].content.parts[0].text });
    } else {
      const errMsg = data?.error?.message || "Lỗi xử lý từ Google AI";
      return NextResponse.json({ error: errMsg }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi máy chủ" }, { status: 500 });
  }
}
