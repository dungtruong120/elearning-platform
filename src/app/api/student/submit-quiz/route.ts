import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const effectiveKey = serviceKey || anonKey;

const supabaseServer = createClient(supabaseUrl, effectiveKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

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
      learningMode,
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
        { error: "Thiếu quizId hoặc score bắt buộc" },
        { status: 400 }
      );
    }

    const nowIso = createdAt || new Date().toISOString();
    const finalScore = Number(score) || 0;
    const finalStudentId = String(studentId || username || "student").trim();
    const finalStudentName = String(studentName || username || "Học sinh").trim();
    const finalLearningMode = String(learningMode || "online").toLowerCase();
    const cleanDuration =
      timeSpent ||
      (durationSeconds
        ? `${Math.floor(durationSeconds / 60)} phút ${durationSeconds % 60} giây`
        : "15 phút");
    const uniqueId = id || `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    let savedSuccessfully = false;
    const executionResults: Record<string, any> = {};

    // 1. GHI VÀO EXAM_ATTEMPTS: Đảm bảo lưu đúng student_name, full_name, quiz_title
    try {
      const fullSnakeRecord: any = {
        id: uniqueId,
        quiz_id: String(quizId),
        exam_id: String(quizId),
        quiz_title: String(quizTitle || "Đề thi"),
        exam_title: String(quizTitle || "Đề thi"),
        student_id: finalStudentId,
        student_name: finalStudentName,
        full_name: finalStudentName,
        school: school || "THPT",
        score: finalScore,
        points: finalScore,
        type: isHomework ? "homework" : "practice",
        is_homework: Boolean(isHomework),
        created_at: nowIso
      };

      const { error: err1 } = await supabaseServer
        .from("exam_attempts")
        .upsert([fullSnakeRecord], { onConflict: "id", ignoreDuplicates: true });

      if (!err1) {
        executionResults["exam_attempts"] = "success";
        savedSuccessfully = true;
      } else {
        // Fallback tối giản nếu schema thiếu một số trường phụ
        const minimalRecord = {
          id: uniqueId,
          quiz_id: String(quizId),
          student_id: finalStudentId,
          score: finalScore,
          type: isHomework ? "homework" : "practice",
          created_at: nowIso
        };
        const { error: fallbackErr } = await supabaseServer
          .from("exam_attempts")
          .upsert([minimalRecord], { onConflict: "id", ignoreDuplicates: true });

        if (!fallbackErr) {
          executionResults["exam_attempts"] = "success_minimal";
          savedSuccessfully = true;
        } else {
          executionResults["exam_attempts"] = fallbackErr.message;
        }
      }
    } catch (e: any) {
      executionResults["exam_attempts"] = e.message;
    }

    // 2. GHI VÀO QUIZ_RESULTS: Đảm bảo không ghi các cột không tồn tại
    try {
      const quizResultRecord = {
        id: uniqueId,
        quiz_id: String(quizId),
        student_id: finalStudentId,
        score: finalScore
      };

      const { error: err2 } = await supabaseServer
        .from("quiz_results")
        .upsert([quizResultRecord], { onConflict: "id", ignoreDuplicates: true });

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
      record: {
        id: uniqueId,
        quizId: String(quizId),
        quiz_id: String(quizId),
        quizTitle: String(quizTitle || "Đề thi"),
        examTitle: String(quizTitle || "Đề thi"),
        studentId: finalStudentId,
        student_id: finalStudentId,
        studentName: finalStudentName,
        student_name: finalStudentName,
        learningMode: finalLearningMode,
        score: finalScore,
        type: isHomework ? "homework" : "practice",
        timeSpent: cleanDuration,
        createdAt: nowIso,
        created_at: nowIso
      }
    });
  } catch (error: any) {
    console.error("Lỗi API submit-quiz:", error);
    return NextResponse.json(
      { error: error.message || "Lỗi xử lý server nội bộ" },
      { status: 500 }
    );
  }
}
