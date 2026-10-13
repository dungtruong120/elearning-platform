import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Tăng thời gian timeout và ép runtime Node.js cho Next.js App Router
export const maxDuration = 60; // 60s
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Khởi tạo Supabase Server Client với SERVICE_ROLE_KEY để bypass RLS
const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET() {
  try {
    const [profilesRes, examsRes, attemptsRes, resultsRes] = await Promise.allSettled([
      supabaseServer
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseServer
        .from("practice_exams")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseServer
        .from("exam_attempts")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseServer
        .from("quiz_results")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    const profiles = profilesRes.status === "fulfilled" && profilesRes.value.data ? profilesRes.value.data : [];
    const practiceExams = examsRes.status === "fulfilled" && examsRes.value.data ? examsRes.value.data : [];
    const examAttempts = attemptsRes.status === "fulfilled" && attemptsRes.value.data ? attemptsRes.value.data : [];
    const quizResults = resultsRes.status === "fulfilled" && resultsRes.value.data ? resultsRes.value.data : [];

    return NextResponse.json({
      success: true,
      profiles,
      practiceExams,
      examAttempts,
      quizResults,
    });
  } catch (error: any) {
    console.error("[API /api/admin/data GET] Lỗi:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi nạp dữ liệu Admin" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // Đọc dạng text trước để chống crash JSON parser khi payload quá lớn
    const rawBodyText = await req.text();
    if (!rawBodyText) {
      return NextResponse.json({ success: false, error: "Empty body" }, { status: 400 });
    }

    let body: any;
    try {
      body = JSON.parse(rawBodyText);
    } catch (parseErr) {
      return NextResponse.json({ success: false, error: "Dữ liệu gửi lên không đúng định dạng JSON" }, { status: 400 });
    }

    const { action } = body;

    // 1. CẬP NHẬT TRẠNG THÁI DUYỆT HỌC VIÊN
    if (action === "update_status") {
      const { studentId, status } = body;
      if (!studentId || !status) {
        return NextResponse.json({ success: false, error: "Thiếu tham số" }, { status: 400 });
      }

      const isApproved = status === "approved";
      const { error } = await supabaseServer
        .from("profiles")
        .update({
          approval_status: status,
          status: status,
          is_approved: isApproved,
          updated_at: new Date().toISOString(),
        })
        .eq("id", studentId);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // 2. XÓA HỌC SINH VĨNH VIỄN Ở CẢ AUTH USERS VÀ PUBLIC PROFILES
    if (action === "delete_student") {
      const { studentId } = body;
      if (!studentId) {
        return NextResponse.json({ success: false, error: "Thiếu studentId" }, { status: 400 });
      }

      try {
        const { error: authError } = await supabaseServer.auth.admin.deleteUser(studentId);
        if (authError) {
          console.warn("[API delete_student] Cảnh báo xóa auth user:", authError.message);
        }

        const { error: profileError } = await supabaseServer
          .from("profiles")
          .delete()
          .eq("id", studentId);

        if (profileError) throw profileError;

        return NextResponse.json({ success: true });
      } catch (err: any) {
        console.error("[API delete_student] Lỗi:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // 3. GHI ĐÈ HỒ SƠ HỌC SINH MỚI ĐĂNG KÝ BẤT CHẤP RLS
    if (action === "register_profile") {
      const { id, fullName, email, phone, school, grade, learningMode } = body.profileData || {};
      const mode = String(learningMode || "offline").toLowerCase();

      const { error } = await supabaseServer
        .from("profiles")
        .upsert([{
          id,
          full_name: fullName || "",
          email: (email || "").toLowerCase().trim(),
          phone: (phone || "").trim(),
          school: (school || "THPT").trim(),
          grade: grade || "Lớp 12",
          learning_mode: mode,
          study_mode: mode,
          role: "student",
          approval_status: "pending",
          status: "pending",
          is_approved: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // 4. LƯU / CẬP NHẬT ĐỀ THI LUYỆN ĐỀ (PRACTICE EXAMS) - XỬ LÝ AN TOÀN PAYLOAD LỚN
    if (action === "save_practice_exam") {
      const { examData } = body;
      if (!examData || !examData.id) {
        return NextResponse.json({ success: false, error: "Thiếu thông tin examData hoặc id" }, { status: 400 });
      }

      const examPayload = {
        id: String(examData.id).trim(),
        title: examData.title || "Đề luyện thi mới",
        category: examData.category || "Tự do",
        duration_minutes: Number(examData.duration_minutes) || 45,
        target_mode: examData.target_mode || "all",
        allowRetake: examData.allowRetake ?? true,
        allowViewFile: examData.allowViewFile ?? true,
        driveUrl: examData.driveUrl || "",
        solutionVideoUrl: examData.solutionVideoUrl || "",
        data: examData.sections || examData.data || [],
        sections: examData.sections || examData.data || [],
        media_map: examData.media_map || examData.mediaMap || {},
        mediaMap: examData.media_map || examData.mediaMap || {},
        created_at: examData.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseServer
        .from("practice_exams")
        .upsert([examPayload]);

      if (error) {
        console.error("[API save_practice_exam] Lỗi Supabase upsert:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, examId: examPayload.id });
    }

    return NextResponse.json({ success: false, error: "Action không hợp lệ" }, { status: 400 });
  } catch (error: any) {
    console.error("[API /api/admin/data POST] Lỗi:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Lỗi xử lý server" },
      { status: 500 }
    );
  }
}
