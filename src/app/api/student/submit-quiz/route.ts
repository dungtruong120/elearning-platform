import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Khởi tạo Supabase Client phía Server bằng quyền Service Role hoặc Anon Key
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
        { error: "Thiếu thông tin bắt buộc của bài thi (quizId hoặc score)" },
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

    // 1. Payload chuẩn snake_case dành cho exam_attempts
    const examAttemptsSnake = {
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

    // 2. Payload camelCase dự phòng cho exam_attempts
    const examAttemptsCamel = {
      id: uniqueId,
      quizId: String(quizId),
      examId: String(quizId),
      quizTitle: String(quizTitle || ""),
      examTitle: String(quizTitle || ""),
      studentId: finalStudentId,
      userId: finalStudentId,
      studentName: finalStudentName,
      fullName: finalStudentName,
      userName: finalStudentName,
      school: school || "THPT",
      score: finalScore,
      points: finalScore,
      totalQuestions: Number(totalQuestions) || 0,
      correctCount: Number(correctCount) || 0,
      timeSpent: cleanDuration,
      durationSeconds: Number(durationSeconds) || 0,
      isHomework: Boolean(isHomework),
      type: isHomework ? "homework" : "practice",
      answers: answers || {},
      createdAt: nowIso
    };

    // 3. Payload chuẩn cấu trúc cho bảng quiz_results
    const quizResultsPayload = {
      id: uniqueId,
      quiz_id: String(quizId),
      student_id: finalStudentId,
      score: finalScore,
      correct_count: Number(correctCount) || 0,
      total_questions: Number(totalQuestions) || 0,
      answers: answers || {},
      created_at: nowIso
    };

    let savedSuccessfully = false;
    const executionResults: Record<string, any> = {};

    // Ghi an toàn vào bảng 1: exam_attempts (sử dụng upsert để bỏ qua nếu id đã tồn tại)
    try {
      let { error: err1 } = await supabaseServer
        .from("exam_attempts")
        .upsert([examAttemptsSnake], { onConflict: "id", ignoreDuplicates: true });

      if (err1) {
        const { error: retryErr } = await supabaseServer
          .from("exam_attempts")
          .upsert([examAttemptsCamel], { onConflict: "id", ignoreDuplicates: true });

        if (!retryErr) {
          executionResults["exam_attempts"] = "success_camel";
          savedSuccessfully = true;
        } else {
          executionResults["exam_attempts"] = retryErr.message;
        }
      } else {
        executionResults["exam_attempts"] = "success_snake";
        savedSuccessfully = true;
      }
    } catch (e: any) {
      executionResults["exam_attempts"] = e.message;
    }

    // Ghi an toàn vào bảng 2: quiz_results
    try {
      const { error: err2 } = await supabaseServer
        .from("quiz_results")
        .upsert([quizResultsPayload], { onConflict: "id", ignoreDuplicates: true });

      if (!err2) {
        executionResults["quiz_results"] = "success";
        savedSuccessfully = true;
      } else {
        executionResults["quiz_results"] = err2.message;
      }
    } catch (e: any) {
      executionResults["quiz_results"] = e.message;
    }

    return NextResponse.json({
      success: savedSuccessfully,
      results: executionResults,
      record: examAttemptsSnake
    });
  } catch (error: any) {
    console.error("Lỗi API nộp bài submit-quiz:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi xử lý server nội bộ" },
      { status: 500 }
    );
  }
}
