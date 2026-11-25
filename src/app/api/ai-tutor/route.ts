import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { supabase } from "@/lib/supabaseClient";

export type AiTutorMode = "HIDDEN" | "HOMEWORK_HINT" | "REVIEW_SOCRATIC" | "VIDEO_QA";

export interface ChatMessageItem {
  role: "user" | "model";
  text: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Chưa cấu hình GEMINI_API_KEY trên hệ thống." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const body: any = await req.json();
    const mode: AiTutorMode = body?.mode || "HOMEWORK_HINT";
    const isDislikeFeedback = Boolean(body?.isDislikeFeedback);
    const messages: ChatMessageItem[] = Array.isArray(body?.messages)
      ? body.messages
      : body?.prompt || body?.message || body?.question
      ? [{ role: "user", text: String(body.prompt || body.message || body.question) }]
      : [];
    const imageBase64: string | undefined = body?.imageBase64;
    const imageMimeType: string | undefined = body?.imageMimeType;

    const rawCtx =
      body?.questionContext && typeof body.questionContext === "object"
        ? body.questionContext
        : body || {};

    const questionContext = {
      questionKey: rawCtx?.questionKey,
      lessonTitle: rawCtx?.lessonTitle || body?.lessonTitle || "Toán THPT",
      questionType: rawCtx?.questionType || body?.questionType || "multiple_choice",
      questionText: rawCtx?.questionText || body?.questionText || body?.content || "",
      options: Array.isArray(rawCtx?.options)
        ? rawCtx.options
        : Array.isArray(body?.options)
        ? body.options
        : [],
      studentAnswer: rawCtx?.studentAnswer || body?.studentAnswer || "",
      correctAnswer: rawCtx?.correctAnswer || body?.correctAnswer || "",
      officialSolution: rawCtx?.officialSolution || body?.officialSolution || "",
      videoTimestamp: rawCtx?.videoTimestamp || body?.videoTimestamp || "",
    };

    if (mode === "HIDDEN") {
      return NextResponse.json(
        { error: "Trợ giảng AI bị vô hiệu hóa trong thời gian làm bài kiểm tra." },
        { status: 403 }
      );
    }

    if (isDislikeFeedback && messages.length === 0) {
      if (questionContext.questionKey) {
        void Promise.resolve(
          supabase.rpc("track_ai_tutor_event", {
            p_is_image: false,
            p_tokens: 0,
            p_question_key: questionContext.questionKey,
            p_is_dislike: true,
          })
        ).catch(() => {});
      }
      return NextResponse.json({ ok: true });
    }

    // Chỉ dùng các model thế hệ mới đang mở cho key của bạn (tránh 404 model cũ)
    const candidateModels = Array.from(
      new Set(
        [
          process.env.GEMINI_MODEL,
          "gemini-3.5-flash-lite",
          "gemini-3.6-flash",
          "gemini-3.8-flash",
          "gemma-3-27b-it",
        ].filter(Boolean) as string[]
      )
    );

    const vietnamMathStandard = `
QUY TẮC BẮT BUỘC:
- Trả lời súc tích, đi thẳng vào trọng tâm (tối đa 5-7 dòng), không viết dài dòng.
- Ký hiệu Toán THPT Việt Nam: dùng $\\ln x$, $\\log x$, $C_n^k$, $A_n^k$, khoảng $(a; b)$. Mọi công thức bọc trong $...$ hoặc $$...$$.
- Chỉ trả lời Toán THPT & bài học này. Tuyệt đối KHÔNG chốt đáp án chữ cái (A, B, C, D) hoặc con số kết quả cuối cùng.`;

    const optionsBlock =
      questionContext.options.length > 0
        ? `\nPhương án:\n${questionContext.options
            .map((opt: any) => (typeof opt === "string" ? opt : opt?.text || opt?.label || ""))
            .filter(Boolean)
            .join("\n")}`
        : "";

    const solutionBlock = questionContext.officialSolution
      ? `\n[LỜI GIẢI GỐC]:\n${questionContext.officialSolution}`
      : "";

    const systemInstruction =
      mode === "HOMEWORK_HINT" || mode === "VIDEO_QA"
        ? `Bạn là Trợ giảng Toán THPT Tâm Chí Tài (TCT Study). Học sinh đang luyện tập (chưa nộp bài): KHÔNG nêu đáp án cuối hay A/B/C/D; chỉ nêu công thức áp dụng và gợi ý 1-2 bước biến đổi đầu tiên.${vietnamMathStandard}
Bài học: ${questionContext.lessonTitle}
Đề bài: ${questionContext.questionText}${optionsBlock}${solutionBlock}`
        : `Bạn là Trợ giảng Toán THPT Tâm Chí Tài (TCT Study). Học sinh đã nộp bài và đang xem lại: chỉ ra lỗi sai giữa "${questionContext.studentAnswer || "bỏ trống"}" với đáp án đúng "${questionContext.correctAnswer || "xem lời giải"}", hướng dẫn từng bước tới biểu thức bấm máy cuối cùng (không nêu chữ cái A/B/C/D).${vietnamMathStandard}
Bài học: ${questionContext.lessonTitle}
Đề bài: ${questionContext.questionText}${optionsBlock}${solutionBlock}`;

    const recentMessages = messages.slice(-4);
    const formattedContents: any[] = recentMessages.map((msg, idx) => {
      const isLastUserMsg = idx === recentMessages.length - 1 && msg.role === "user";
      if (isLastUserMsg && imageBase64) {
        return {
          role: "user",
          parts: [
            { text: msg.text || "Xem giúp em ảnh bài này với ạ." },
            {
              inlineData: {
                data: imageBase64.replace(/^data:image\/\w+;base64,/, ""),
                mimeType: imageMimeType || "image/jpeg",
              },
            },
          ],
        };
      }
      return {
        role: msg.role === "model" ? "model" : "user",
        parts: [{ text: String(msg.text || "") }],
      };
    });

    if (formattedContents.length === 0) {
      formattedContents.push({
        role: "user",
        parts: [{ text: "Gợi ý giúp em hướng giải câu này ạ." }],
      });
    }

    let response: any = null;
    let modelActuallyUsed = candidateModels[0];
    let lastError: any = null;

    for (const modelName of candidateModels) {
      try {
        modelActuallyUsed = modelName;
        const isGemma = modelName.startsWith("gemma");

        const contentsToSend = isGemma
          ? [
              { role: "user", parts: [{ text: systemInstruction }] },
              { role: "model", parts: [{ text: "Đã hiểu, em sẵn sàng hỗ trợ." }] },
              ...formattedContents,
            ]
          : formattedContents;

        // Không truyền thinkingConfig để tránh lỗi 400 BadRequest
        const configToSend: any = {
          temperature: 0.2,
          maxOutputTokens: 700,
        };

        if (!isGemma) {
          configToSend.systemInstruction = systemInstruction;
        }

        response = await ai.models.generateContent({
          model: modelName,
          contents: contentsToSend,
          config: configToSend,
        });

        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("Tất cả các máy chủ AI đều đang bận, em thử lại sau 5 giây nhé.");
    }

    const totalTokensUsed = response.usageMetadata?.totalTokenCount || 300;

    void Promise.resolve(
      supabase.rpc("track_ai_tutor_event", {
        p_is_image: Boolean(imageBase64),
        p_tokens: totalTokensUsed,
        p_question_key: questionContext.questionKey || null,
        p_lesson_title: questionContext.lessonTitle || null,
        p_question_preview: questionContext.questionText || "Hỏi qua hình ảnh",
        p_is_dislike: isDislikeFeedback,
      })
    ).catch(() => {});

    return NextResponse.json({
      reply: response.text,
      modelUsed: modelActuallyUsed,
    });
  } catch (error: any) {
    console.error("Lỗi AI Tutor API:", error);
    return NextResponse.json(
      { error: error?.message || "Hệ thống trợ giảng AI đang bận, em thử lại sau nhé!" },
      { status: 500 }
    );
  }
}
