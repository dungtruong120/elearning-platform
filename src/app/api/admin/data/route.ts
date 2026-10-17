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

    return NextResponse.json(
      {
        success: true,
        profiles,
        practiceExams,
        examAttempts,
        quizResults,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
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
        .upsert([
          {
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
          },
        ]);

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
        // Fallback 11 cột chuẩn nếu bảng practice_exams không có cột phụ
        const slimExamPayload = {
          id: examPayload.id,
          title: examPayload.title,
          category: examPayload.category,
          duration_minutes: examPayload.duration_minutes,
          allowRetake: examPayload.allowRetake,
          allowViewFile: examPayload.allowViewFile,
          driveUrl: examPayload.driveUrl,
          solutionVideoUrl: examPayload.solutionVideoUrl,
          data: examPayload.data,
          media_map: examPayload.media_map,
          created_at: examPayload.created_at,
        };

        const { error: retryErr } = await supabaseServer
          .from("practice_exams")
          .upsert([slimExamPayload]);

        if (retryErr) {
          console.error("[API save_practice_exam] Lỗi Supabase upsert:", retryErr);
          return NextResponse.json({ success: false, error: retryErr.message }, { status: 500 });
        }
      }

      return NextResponse.json({ success: true, examId: examPayload.id });
    }

    // 5. XÓA VĨNH VIỄN LƯỢT NỘP BÀI CỦA HỌC SINH BẰNG SERVICE_ROLE_KEY (BYPASS RLS 100%)
    if (action === "delete_attempt") {
      const { attemptId, studentId, quizId, examTitle, createdAt } = body;
      if (!attemptId && !studentId && !createdAt) {
        return NextResponse.json({ success: false, error: "Thiếu thông tin định danh lượt nộp bài" }, { status: 400 });
      }

      const targetTables = ["exam_attempts", "quiz_results", "exam_submissions"];
      const deleteTasks: Promise<any>[] = [];

      for (const tableName of targetTables) {
        // 5.1. Xóa trực tiếp theo cột id
        if (attemptId) {
          deleteTasks.push(
            Promise.resolve(supabaseServer.from(tableName).delete().eq("id", String(attemptId).trim()))
          );
        }

        // 5.2. Nếu có createdAt + studentId, xóa khớp chính xác theo thời điểm nộp và học sinh (phòng trường hợp synthetic ID)
        if (createdAt && studentId) {
          deleteTasks.push(
            Promise.resolve(
              supabaseServer
                .from(tableName)
                .delete()
                .eq("created_at", createdAt)
                .eq("student_id", String(studentId).trim())
            ),
            Promise.resolve(
              supabaseServer
                .from(tableName)
                .delete()
                .eq("created_at", createdAt)
                .eq("user_id", String(studentId).trim())
            )
          );
        }

        // 5.3. Nếu attemptId là synthetic ID dạng `${quizId}_${studentId}_${createdAt}` nhưng chỉ có createdAt
        if (createdAt && quizId) {
          deleteTasks.push(
            Promise.resolve(
              supabaseServer
                .from(tableName)
                .delete()
                .eq("created_at", createdAt)
                .eq("quiz_id", String(quizId).trim())
            ),
            Promise.resolve(
              supabaseServer
                .from(tableName)
                .delete()
                .eq("created_at", createdAt)
                .eq("exam_id", String(quizId).trim())
            )
          );
        }

        // 5.4. Nếu không có ID thực mà khớp theo studentId + quizId + examTitle (khi chỉ có 1 lượt nộp trùng khớp)
        if (studentId && quizId && !createdAt) {
          deleteTasks.push(
            Promise.resolve(
              supabaseServer
                .from(tableName)
                .delete()
                .eq("student_id", String(studentId).trim())
                .eq("quiz_id", String(quizId).trim())
            ),
            Promise.resolve(
              supabaseServer
                .from(tableName)
                .delete()
                .eq("user_id", String(studentId).trim())
                .eq("exam_id", String(quizId).trim())
            )
          );
        }

        if (studentId && examTitle && createdAt) {
          deleteTasks.push(
            Promise.resolve(
              supabaseServer
                .from(tableName)
                .delete()
                .eq("student_id", String(studentId).trim())
                .eq("exam_title", String(examTitle).trim())
                .eq("created_at", createdAt)
            )
          );
        }
      }

      await Promise.allSettled(deleteTasks);

      return NextResponse.json({
        success: true,
        deletedAttemptId: attemptId,
      });
    }

    // 6. CẬP NHẬT NHẬN XÉT (FEEDBACK) CHO LƯỢT NỘP BÀI QUA SERVICE_ROLE_KEY
    if (action === "update_attempt_feedback") {
      const { attemptId, feedback } = body;
      if (!attemptId) {
        return NextResponse.json({ success: false, error: "Thiếu attemptId" }, { status: 400 });
      }

      const targetTables = ["exam_attempts", "quiz_results", "exam_submissions"];
      await Promise.allSettled(
        targetTables.map((table) =>
          Promise.resolve(
            supabaseServer
              .from(table)
              .update({ feedback: String(feedback ?? "") })
              .eq("id", String(attemptId).trim())
          )
        )
      );

      return NextResponse.json({ success: true });
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
