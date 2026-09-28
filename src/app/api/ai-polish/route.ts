import { NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { text, fileBase64, apiKey } = await req.json();

    if (!text && !fileBase64) {
      return NextResponse.json({ error: "Dữ liệu đề thi rỗng" }, { status: 400 });
    }

    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Chưa cấu hình GEMINI_API_KEY. Vui lòng nhập API Key!" },
        { status: 401 }
      );
    }

    const systemPrompt = "Bạn là chuyên gia khôi phục đề thi Toán học từ file Word MathType sang LaTeX KaTeX.\n" +
      "Nhiệm vụ:\n" +
      "1. Khôi phục các tọa độ Oxyz, phân số, căn thức, ma trận, vector, góc bị mất.\n" +
      "2. Đánh số lần lượt Câu 1, Câu 2, Câu 3... không lặp lại số câu.\n" +
      "3. Điền đầy đủ 4 phương án A, B, C, D cho từng câu, tuyệt đối không để rỗng.\n" +
      "4. Khôi phục trọn vẹn Lời giải chi tiết của tất cả các câu.\n" +
      "5. Giữ nguyên 100% các thẻ ảnh [img:$...$].\n" +
      "6. Chỉ trả về nội dung đề thi, không thêm lời chào, không bọc trong ```.";

    const cleanKey = String(key).trim();
    const parts: any[] = [];

    if (fileBase64) {
      parts.push({
        inlineData: {
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          data: fileBase64
        }
      });
      parts.push({
        text: systemPrompt + "\n\n--- THAM KHẢO THẺ ẢNH [img:$...$] TỪ BẢN GỐC ---\n" + (text || "")
      });
    } else {
      parts.push({
        text: systemPrompt + "\n\n--- DƯỚI ĐÂY LÀ ĐỀ THI CẦN SỬA ---\n" + text
      });
    }

    // URL trực tiếp tuyệt đối không dính markdown link
    const targetUrl = new URL("[https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent](https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent)");
    targetUrl.searchParams.set("key", cleanKey);

    const response = await fetch(targetUrl.toString(), {
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
      return NextResponse.json({ error: "Lỗi phản hồi server: " + resText.slice(0, 100) }, { status: 502 });
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
