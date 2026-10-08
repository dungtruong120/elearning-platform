import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Khởi tạo Supabase Client phía Server
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      quizId,
      quizTitle,
      studentId,
      studentName,
      username,
      school,
      score,
      totalQuestions,
      correctCount,
      timeSpent,
      durationSeconds,
      isHomework,
      answers,
      createdAt
    } = body;

    if (!quizId || score === undefined) {
      return NextResponse.json(
        { error: "Thiếu thông tin bắt buộc (quizId hoặc score)" },
        { status: 400 }
      );
    }

    const nowIso = createdAt || new Date().toISOString();
    const finalScore = Number(score) || 0;
    const finalStudentId = String(studentId || username || "student").trim();
    const finalStudentName = String(studentName || username || "Học sinh").trim();
    const cleanDuration =
      timeSpent ||
      (durationSeconds
        ? `${Math.floor(durationSeconds / 60)} phút ${durationSeconds % 60} giây`
        : "15 phút");
    const uniqueId = id || `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let savedSuccessfully = false;
    const executionResults: Record<string, any> = {};

    // =========================================================================
    // 1. THAO TÁC TRÊN BẢNG: exam_attempts
    // =========================================================================
    try {
      // Thử bản ghi đầy đủ chuẩn snake_case (bỏ hẳn camelCase)
      const fullRecordSnake: any = {
        id: uniqueId,
        quiz_id: String(quizId),
        exam_id: String(quizId),
        quiz_title: String(quizTitle || ""),
        exam_title: String(quizTitle || ""),
        student_id: finalStudentId,
        user_id: finalStudentId,
        student_name: finalStudentName,
        full_name: finalStudentName,
        user_name: finalStudentName,
        school: school || "THPT",
        score: finalScore,
        points: finalScore,
        total_questions: Number(totalQuestions) || 0,
        correct_count: Number(correctCount) || 0,
        time_spent: cleanDuration,
        duration_seconds: Number(durationSeconds) || 0,
        is_homework: Boolean(isHomework),
        type: isHomework ? "homework" : "practice",
        answers: answers || {},
        created_at: nowIso
      };

      const res1 = await supabaseServer
        .from("exam_attempts")
        .upsert([fullRecordSnake], { onConflict: "id", ignoreDuplicates: true });

      if (!res1.error) {
        executionResults["exam_attempts"] = "success_full";
        savedSuccessfully = true;
      } else {
        // Nếu lỗi do cột không tồn tại, fallback về bản ghi tinh gọn (minimal schema)
        const minimalRecord: any = {
          id: uniqueId,
          quiz_id: String(quizId),
          student_id: finalStudentId,
          score: finalScore,
          type: isHomework ? "homework" : "practice",
          created_at: nowIso
        };

        const resFallback = await supabaseServer
          .from("exam_attempts")
          .upsert([minimalRecord], { onConflict: "id", ignoreDuplicates: true });

        if (!resFallback.error) {
          executionResults["exam_attempts"] = "success_minimal";
          savedSuccessfully = true;
        } else {
          executionResults["exam_attempts"] = resFallback.error.message;
        }
      }
    } catch (e: any) {
      executionResults["exam_attempts"] = e.message;
    }

    // =========================================================================
    // 2. THAO TÁC TRÊN BẢNG: quiz_results (LOẠI BỎ correct_count VÌ POSTGRES BÁO KHÔNG CÓ)
    // =========================================================================
    try {
      const quizResultsPayload: any = {
        id: uniqueId,
        quiz_id: String(quizId),
        student_id: finalStudentId,
        score: finalScore,
        created_at: nowIso
      };

      // Thêm answers nếu có
      if (answers && Object.keys(answers).length > 0) {
        quizResultsPayload["answers"] = answers;
      }

      const res2 = await supabaseServer
        .from("quiz_results")
        .upsert([quizResultsPayload], { onConflict: "id", ignoreDuplicates: true });

      if (!res2.error) {
        executionResults["quiz_results"] = "success";
        savedSuccessfully = true;
      } else {
        executionResults["quiz_results"] = res2.error.message;
      }
    } catch (e: any) {
      executionResults["quiz_results"] = e.message;
    }

    return NextResponse.json({
      success: savedSuccessfully,
      results: executionResults,
      record: {
        id: uniqueId,
        quiz_id: String(quizId),
        quizId: String(quizId),
        student_id: finalStudentId,
        studentId: finalStudentId,
        student_name: finalStudentName,
        studentName: finalStudentName,
        score: finalScore,
        type: isHomework ? "homework" : "practice",
        created_at: nowIso
      }
    });
  } catch (error: any) {
    console.error("Lỗi API nộp bài submit-quiz:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi xử lý server nội bộ" },
      { status: 500 }
    );
  }
}
