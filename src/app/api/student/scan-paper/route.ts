import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

function getSupabaseServerClient() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let attemptId = "att-paper-" + Date.now();
    let examId = "";
    let examTitle = "Đề thi trên giấy";
    let studentId = "student";
    let studentName = "Học sinh";
    let school = "THPT";
    let score = 0;
    let totalQuestions = 0;
    let correctCount = 0;
    let isHomework = false;
    let answers: Record<string, any> = {};
    let omrData: any = null;
    let imageBuffer: Buffer | null = null;
    let incomingImageUrl = "";

    // 1. Hỗ trợ cả multipart/form-data (Blob/File) lẫn application/json (Base64 Data URL)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      attemptId = String(formData.get("attemptId") || attemptId);
      examId = String(formData.get("examId") || "");
      examTitle = String(formData.get("examTitle") || "Đề thi trên giấy");
      studentId = String(formData.get("studentId") || "student");
      studentName = String(formData.get("studentName") || "Học sinh");
      school = String(formData.get("school") || "THPT");
      score = Number(formData.get("score") || 0);
      totalQuestions = Number(formData.get("totalQuestions") || 0);
      correctCount = Number(formData.get("correctCount") || 0);
      isHomework = formData.get("isHomework") === "true";

      const rawAnswers = formData.get("answers");
      if (typeof rawAnswers === "string" && rawAnswers.trim()) {
        try {
          answers = JSON.parse(rawAnswers);
        } catch {}
      }

      const rawOmr = formData.get("omrData");
      if (typeof rawOmr === "string" && rawOmr.trim()) {
        try {
          omrData = JSON.parse(rawOmr);
        } catch {}
      }

      const filePart = formData.get("file") || formData.get("image");
      if (filePart && typeof (filePart as any).arrayBuffer === "function") {
        const arrBuf = await (filePart as Blob).arrayBuffer();
        imageBuffer = Buffer.from(arrBuf);
      }
    } else {
      const body = await req.json();
      attemptId = String(body.attemptId || body.id || attemptId);
      examId = String(body.examId || body.quizId || body.quiz_id || "");
      examTitle = String(body.examTitle || body.quizTitle || body.quiz_title || "Đề thi trên giấy");
      studentId = String(body.studentId || body.student_id || "student");
      studentName = String(body.studentName || body.student_name || "Học sinh");
      school = String(body.school || "THPT");
      score = Number(body.score ?? body.points ?? 0);
      totalQuestions = Number(body.totalQuestions ?? body.total_questions ?? 0);
      correctCount = Number(body.correctCount ?? body.correct_count ?? 0);
      isHomework = Boolean(body.isHomework || body.is_homework);
      answers = body.answers || body.userAnswers || body.user_answers || {};
      omrData = body.omrData || body.omr_raw_data || null;

      const base64Str = String(
        body.imageBase64 ||
          body.paper_scan_url ||
          omrData?.warped_image_data_url ||
          ""
      );

      if (base64Str.startsWith("data:image/")) {
        incomingImageUrl = base64Str;
        const base64Data = base64Str.replace(/^data:image\/\w+;base64,/, "");
        imageBuffer = Buffer.from(base64Data, "base64");
      } else if (base64Str.startsWith("http://") || base64Str.startsWith("https://")) {
        incomingImageUrl = base64Str;
      }
    }

    const supabase = getSupabaseServerClient();
    let finalPaperScanUrl = incomingImageUrl;

    // 2. Upload ảnh phiếu đã quét lên Supabase Storage bucket "exam-paper-scans"
    if (supabase && imageBuffer) {
      const safeExamFolder = (examId || "general").replace(/[^a-zA-Z0-9_-]/g, "_");
      const safeStudentPrefix = (studentId || "student").replace(/[^a-zA-Z0-9_-]/g, "_");
      const storagePath = `exam-paper-scans/${safeExamFolder}/${safeStudentPrefix}_${Date.now()}.jpg`;

      try {
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("exam-paper-scans")
          .upload(storagePath, imageBuffer, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (!uploadError && uploadData) {
          const { data: pubData } = supabase.storage
            .from("exam-paper-scans")
            .getPublicUrl(storagePath);
          if (pubData?.publicUrl) {
            finalPaperScanUrl = pubData.publicUrl;
          }
        }
      } catch (storageErr) {
        // Nếu bucket chưa khởi tạo trên Supabase, giữ nguyên chuỗi Base64 Data URL để hiển thị không lỗi
      }
    }

    if (omrData && typeof omrData === "object" && finalPaperScanUrl) {
      omrData = {
        ...omrData,
        warped_image_data_url: finalPaperScanUrl,
      };
    }

    const nowIso = new Date().toISOString();

    const dbRecord: Record<string, any> = {
      id: attemptId,
      quiz_id: examId,
      quizId: examId,
      exam_id: examId,
      quiz_title: examTitle,
      quizTitle: examTitle,
      exam_title: examTitle,
      examTitle: examTitle,
      student_id: studentId,
      studentId: studentId,
      user_id: studentId,
      student_name: studentName,
      studentName: studentName,
      full_name: studentName,
      user_name: studentName,
      school: school,
      score: score,
      points: score,
      total_questions: totalQuestions,
      totalQuestions: totalQuestions,
      correct_count: correctCount,
      correctCount: correctCount,
      time_spent: "Làm trên giấy",
      timeSpent: "Làm trên giấy",
      duration_seconds: 0,
      is_homework: isHomework,
      isHomework: isHomework,
      type: isHomework ? "homework" : "practice",
      submission_type: "paper",
      paper_scan_url: finalPaperScanUrl || null,
      omr_raw_data: omrData || null,
      recognition_confidence: Number(omrData?.confidence ?? 98.0),
      flagged_questions: Array.isArray(omrData?.flagged_questions) ? omrData.flagged_questions : [],
      answers: answers,
      userAnswers: answers,
      user_answers: answers,
      created_at: nowIso,
      createdAt: nowIso,
    };

    // 3. Lưu bản ghi vào bảng exam_attempts / quiz_results trong Supabase
    if (supabase) {
      await Promise.allSettled([
        supabase.from("exam_attempts").upsert([dbRecord], { onConflict: "id" }),
        supabase.from("quiz_results").upsert([dbRecord], { onConflict: "id" }),
        supabase.from("attempts").upsert([dbRecord], { onConflict: "id" }),
      ]);
    }

    return NextResponse.json({
      success: true,
      attemptId,
      paperScanUrl: finalPaperScanUrl,
      attempt: dbRecord,
    });
  } catch (error: any) {
    console.error("Lỗi API /api/student/scan-paper:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Lỗi máy chủ khi lưu phiếu chấm trên giấy.",
      },
      { status: 500 }
    );
  }
}
