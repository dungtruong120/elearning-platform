import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  // Debug môi trường
  const envDebug = {
    hasUrl: Boolean(supabaseUrl),
    hasServiceKey: Boolean(serviceKey),
    serviceKeyLength: serviceKey ? serviceKey.length : 0,
    usingFallbackAnon: !serviceKey
  };

  console.log("=== CHECK SUPABASE SERVER KEY ===", envDebug);

  // Khởi tạo client với key hiện có
  const effectiveKey = serviceKey || anonKey;
  const supabaseServer = createClient(supabaseUrl, effectiveKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const [profilesRes, attemptsRes, resultsRes, examsRes] = await Promise.allSettled([
      supabaseServer
        .from("profiles")
        .select("id, full_name, email, phone, school, grade, role, learning_mode, study_mode, approval_status, created_at, username")
        .neq("role", "admin")
        .order("created_at", { ascending: false }),

      supabaseServer
        .from("exam_attempts")
        .select("id, quiz_id, exam_id, student_id, user_id, student_name, full_name, user_name, quiz_title, exam_title, score, points, type, is_homework, duration_seconds, time_spent, created_at, feedback")
        .order("created_at", { ascending: false })
        .limit(3000),

      supabaseServer
        .from("quiz_results")
        .select("id, quiz_id, student_id, score, created_at")
        .order("created_at", { ascending: false })
        .limit(3000),

      supabaseServer
        .from("practice_exams")
        .select("id, title, category, target_mode, allowRetake, allowViewFile, driveUrl, solutionVideoUrl, duration_minutes, created_at")
        .order("created_at", { ascending: false })
    ]);

    const profiles = profilesRes.status === "fulfilled" && profilesRes.value.data ? profilesRes.value.data : [];
    const examAttempts = attemptsRes.status === "fulfilled" && attemptsRes.value.data ? attemptsRes.value.data : [];
    const quizResults = resultsRes.status === "fulfilled" && resultsRes.value.data ? resultsRes.value.data : [];
    const practiceExams = examsRes.status === "fulfilled" && examsRes.value.data ? examsRes.value.data : [];

    // Ghi nhận chi tiết lỗi của từng bảng nếu có
    const errors = {
      profilesError: profilesRes.status === "rejected" ? profilesRes.reason : (profilesRes.value as any)?.error,
      attemptsError: attemptsRes.status === "rejected" ? attemptsRes.reason : (attemptsRes.value as any)?.error,
      resultsError: resultsRes.status === "rejected" ? resultsRes.reason : (resultsRes.value as any)?.error
    };

    return NextResponse.json({
      success: true,
      envDebug,
      errors,
      profiles,
      examAttempts,
      quizResults,
      practiceExams
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, envDebug },
      { status: 500 }
    );
  }
}
