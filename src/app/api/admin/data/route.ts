import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Khởi tạo Supabase Server Client với SERVICE_ROLE_KEY để bypass RLS an toàn
const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
    const body = await req.json();
    const { action } = body;

    // ACTION 1: CẬP NHẬT TRẠNG THÁI DUYỆT HỌC VIÊN
    if (action === "update_status") {
      const { studentId, status } = body;
      if (!studentId) {
        return NextResponse.json({ success: false, error: "Thiếu studentId" }, { status: 400 });
      }

      const isApproved = status === "approved";
      const { data, error } = await supabaseServer
        .from("profiles")
        .update({
          approval_status: status,
          status: status,
          is_approved: isApproved,
          updated_at: new Date().toISOString(),
        })
        .eq("id", studentId)
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, data });
    }

    // ACTION 2: XÓA HỌC SINH VĨNH VIỄN KHỎI CƠ SỞ DỮ LIỆU
    if (action === "delete_student") {
      const { studentId } = body;
      if (!studentId) {
        return NextResponse.json({ success: false, error: "Thiếu studentId" }, { status: 400 });
      }

      const { error } = await supabaseServer
        .from("profiles")
        .delete()
        .eq("id", studentId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // ACTION 3: GHI ĐÈ HỒ SƠ HỌC SINH MỚI ĐĂNG KÝ BẤT CHẤP RLS
    if (action === "register_profile") {
      const { profileData } = body;
      if (!profileData || !profileData.id) {
        return NextResponse.json({ success: false, error: "Thiếu profileData" }, { status: 400 });
      }

      const mode = (profileData.learningMode || "offline").toLowerCase();

      const newRecord = {
        id: profileData.id,
        full_name: profileData.fullName || "",
        email: (profileData.email || "").toLowerCase().trim(),
        phone: profileData.phone || "",
        school: profileData.school || "THPT",
        grade: profileData.grade || "Lớp 12",
        learning_mode: mode,
        study_mode: mode,
        role: "student",
        approval_status: "pending",
        status: "pending",
        is_approved: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseServer
        .from("profiles")
        .upsert([newRecord]);

      if (error) throw error;
      return NextResponse.json({ success: true, profile: newRecord });
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
