import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  const effectiveKey = serviceKey || anonKey;
  const supabaseServer = createClient(supabaseUrl, effectiveKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const [profilesRes, attemptsRes, resultsRes, examsRes] = await Promise.allSettled([
      // 1. BẢNG PROFILES: Đã bỏ cột 'username' gây lỗi 42703
      supabaseServer
        .from("profiles")
        .select("id, full_name, email, phone, school, grade, role, learning_mode, study_mode, approval_status, created_at")
        .neq("role", "admin")
        .order("created_at", { ascending: false }),

      // 2. BẢNG EXAM_ATTEMPTS: Đã bỏ cột 'user_id' gây lỗi 42703
      supabaseServer
        .from("exam_attempts")
        .select("id, quiz_id, exam_id, student_id, student_name, full_name, user_name, quiz_title, exam_title, score, points, type, is_homework, duration_seconds, time_spent, created_at, feedback")
        .order("created_at", { ascending: false })
        .limit(3000),

      // 3. BẢNG QUIZ_RESULTS: Đã bỏ cột 'created_at' gây lỗi 42703
      supabaseServer
        .from("quiz_results")
        .select("id, quiz_id, student_id, score")
        .limit(3000),

      // 4. BẢNG PRACTICE_EXAMS: Hoạt động chuẩn xác
      supabaseServer
        .from("practice_exams")
        .select("id, title, category, target_mode, allowRetake, allowViewFile, driveUrl, solutionVideoUrl, duration_minutes, created_at")
        .order("created_at", { ascending: false })
    ]);

    const profiles = profilesRes.status === "fulfilled" && profilesRes.value.data ? profilesRes.value.data : [];
    const examAttempts = attemptsRes.status === "fulfilled" && attemptsRes.value.data ? attemptsRes.value.data : [];
    const quizResults = resultsRes.status === "fulfilled" && resultsRes.value.data ? resultsRes.value.data : [];
    const practiceExams = examsRes.status === "fulfilled" && examsRes.value.data ? examsRes.value.data : [];

    return NextResponse.json({
      success: true,
      counts: {
        profilesCount: profiles.length,
        attemptsCount: examAttempts.length,
        resultsCount: quizResults.length,
        examsCount: practiceExams.length
      },
      profiles,
      examAttempts,
      quizResults,
      practiceExams
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
