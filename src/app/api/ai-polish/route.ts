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

    const systemPrompt = "Bạn là chuyên gia khôi phục và biên tập đề thi Toán học Việt Nam từ file Word trích xuất MathType sang LaTeX chuẩn KaTeX.\n" +
      "Nhiệm vụ của bạn:\n" +
      "1. XÓA BỎ HOÀN TOÀN các cặp dấu ngoặc rỗng do lỗi trích xuất như: '\\left(\\right)', '()', '[]', '{}'. Ví dụ: '$\\left(\\right)ABCD.A\'$' -> chuyển thành '$ABCD.A\'$'.\n" +
      "2. KHÔI PHỤC TOÀN BỘ CÁC PHƯƠNG ÁN A, B, C, D VÀ TỌA ĐỘ BỊ MẤT:\n" +
      "   - Các tọa độ điểm không gian Oxyz: viết dưới dạng $M\\left(0; \\frac{1}{2}; 1\\right)$, $N\\left(\\frac{1}{2}; 0; 1\\right)$, $P\\left(1; \\frac{1}{2}; 0\\right)$, $Q\\left(1; 1; \\frac{1}{2}\\right)$. Tuyệt đối không để trống dòng A. B. C. D.\n" +
      "3. Sửa triệt để các ký hiệu toán học:\n" +
      "   - Phân số: \\frac{a}{b}\n" +
      "   - Căn thức: \\sqrt{...}, \\sqrt[n]{...}\n" +
      "   - Ký hiệu hình học: \\vec{a}, \\overrightarrow{AB}, \\parallel, \\perp, \\widehat{ABC}, ^\\circ\n" +
      "   - Tập hợp: \\mathbb{R}, \\in, \\notin, \\subset, \\cup, \\cap, \\emptyset\n" +
      "   - So sánh: sửa 'a>>', 'a><' thành $a > 0$, $a < 0$.\n" +
      "4. TUYỆT ĐỐI GIỮ NGUYÊN các thẻ ảnh dạng [img:$...$] hoặc [img:https://...], không xóa hay sửa tên thẻ ảnh.\n" +
      "5. Giữ nguyên cấu trúc: Câu 1:, Câu 2:, các phương án A. B. C. D. và Lời giải (nếu có).\n" +
      "6. Chỉ trả về nội dung đề thi đã sửa, KHÔNG thêm lời chào, KHÔNG bọc trong markdown code block (```).";

    // Sử dụng model được chỉ định chính xác bởi hệ thống Google API
    const candidateModels = [
      "gemini-3.8-flash"
    ];

    let outputText = "";
    let lastError = "";

    for (const model of candidateModels) {
      try {
        const apiUrl = "[https://generativelanguage.googleapis.com/v1beta/models/](https://generativelanguage.googleapis.com/v1beta/models/)" + model + ":generateContent?key=" + key;
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
      return NextResponse.json({ error: lastError || "Không gọi được model AI" }, { status: 400 });
    }

    return NextResponse.json({ result: outputText });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi máy chủ" }, { status: 500 });
  }
}
