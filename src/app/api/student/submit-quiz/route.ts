import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Khởi tạo Supabase Client phía Server
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseServer = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
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
      answers
    } = body;

    if (!quizId || score === undefined) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc của bài thi" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const finalScore = Number(score) || 0;
    const finalStudentId = String(studentId || username || "student").trim();
    const finalStudentName = String(studentName || username || "Học sinh").trim();
    const cleanDuration = timeSpent || (durationSeconds ? `${Math.floor(durationSeconds / 60)} phút ${durationSeconds % 60} giây` : "15 phút");

    // 1. Chuẩn bị payload chuẩn snake_case
    const snakePayload = {
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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

    // 2. Chuẩn bị payload camelCase dự phòng
    const camelPayload = {
      id: snakePayload.id,
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

    // 3. Tiến hành ghi an toàn vào các bảng điểm hiện có trên Supabase
    const tables = ["exam_attempts", "attempts", "quiz_attempts"];
    let savedSuccessfully = false;
    const results: Record<string, any> = {};

    for (const table of tables) {
      try {
        // Thử insert snake_case trước
        let { data, error } = await supabaseServer.from(table).insert([snakePayload]).select();
        
        // Nếu lỗi do tên cột không khớp, thử insert bản camelCase
        if (error) {
          const retry = await supabaseServer.from(table).insert([camelPayload]).select();
          if (!retry.error) {
            results[table] = "success_camel";
            savedSuccessfully = true;
            continue;
          }
        } else {
          results[table] = "success_snake";
          savedSuccessfully = true;
          continue;
        }

        results[table] = error?.message;
      } catch (tableErr: any) {
        results[table] = tableErr?.message;
      }
    }

    return NextResponse.json({
      success: savedSuccessfully,
      results,
      savedRecord: snakePayload
    });
  } catch (error: any) {
    console.error("Lỗi API nộp bài submit-quiz:", error);
    return NextResponse.json({ error: error.message || "Lỗi server nội bộ" }, { status: 500 });
  }
}
