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

    const systemPrompt = "Bạn là chuyên gia khôi phục và biên tập đề thi Toán học Việt Nam từ file Word chứa MathType sang định dạng chuẩn KaTeX/Markdown.\n" +
      "Nhiệm vụ của bạn:\n" +
      "1. ĐỌC VÀ KHÔI PHỤC TOÀN BỘ CÔNG THỨC TOÁN BỊ MẤT HOẶC BỊ SÓT (tọa độ Oxyz, phân số, căn thức, ma trận, vector, góc, tích vô hướng...).\n" +
      "2. ĐÁNH SỐ THỨ TỰ CÂU CHUẨN XÁC: Đánh số lần lượt Câu 1, Câu 2, Câu 3... theo đúng thứ tự. Tuyệt đối không lặp lại số câu (như Câu 2 rồi lại Câu 2).\n" +
      "3. PHƯƠNG ÁN A, B, C, D: Đảm bảo đầy đủ cả 4 phương án cho từng câu trắc nghiệm. Không để rỗng bất kỳ phương án nào.\n" +
      "4. LỜI GIẢI CHI TIẾT: Khôi phục trọn vẹn phần Lời giải chi tiết của tất cả các câu (kể cả các đoạn bị cụt như 'Khi đó:', 'Có .', 'Ta có:').\n" +
      "5. GIỮ NGUYÊN CÁC THẺ ẢNH: Tuyệt đối giữ nguyên các thẻ ảnh dạng [img:$...$] hoặc [img:https://...], không xóa hay sửa đổi tên thẻ.\n" +
      "6. CẤU TRÚC: Giữ nguyên các phân mục lớn (I. TRẮC NGHIỆM, PHẦN II. TRẮC NGHIỆM ĐÚNG SAI, PHẦN III. TRẢ LỜI NGẮN).\n" +
      "7. Chỉ trả về nội dung đề thi đã sửa và phục hồi, KHÔNG thêm lời chào, KHÔNG bọc trong markdown code block (```).";

    const cleanKey = String(key).trim();
    const candidateModels = ["gemini-2.5-flash", "gemini-3.8-flash"];

    const parts: any[] = [];
    if (fileBase64) {
      parts.push({
        inlineData: {
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          data: fileBase64
        }
      });
      parts.push({
        text: systemPrompt + "\n\n--- DƯỚI ĐÂY LÀ VĂN BẢN THÔ TRÍCH XUẤT ĐỂ THAM KHẢO THẺ ẢNH [img:$...$] ---\n" + (text || "")
      });
    } else {
      parts.push({
        text: systemPrompt + "\n\n--- DƯỚI ĐÂY LÀ ĐỀ THI CẦN SỬA VÀ BỔ SUNG CÔNG THỨC ---\n" + text
      });
    }

    let outputText = "";
    let lastError = "";

    for (const model of candidateModels) {
      try {
        // Chuỗi URL thuần túy, tuyệt đối không có markdown link
        const endpoint = "https://" + "[generativelanguage.googleapis.com/v1beta/models/](https://generativelanguage.googleapis.com/v1beta/models/)" + model + ":generateContent?key=" + cleanKey;

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
          lastError = "Lỗi phản hồi server: " + resText.slice(0, 100);
          continue;
        }

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
      return NextResponse.json({ error: lastError || "Máy chủ AI đang bận, vui lòng thử lại sau giây lát!" }, { status: 400 });
    }

    return NextResponse.json({ result: outputText });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lỗi máy chủ" }, { status: 500 });
  }
}
