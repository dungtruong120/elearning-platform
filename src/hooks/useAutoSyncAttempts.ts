"use client";

import { useEffect, useRef } from "react";
import { Profile } from "@/types";
import { supabase } from "@/lib/supabaseClient";

export function useAutoSyncAttempts(profile: Profile | null) {
  const hasTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    if (!profile?.id || hasTriggeredRef.current) return;
    if (typeof window === "undefined") return;

    const migrationKey = `edunexus_migrated_v1_${profile.id}`;
    const alreadyMigrated = localStorage.getItem(migrationKey);
    if (alreadyMigrated === "true") {
      return;
    }

    hasTriggeredRef.current = true;

    // Trì hoãn 2 giây để nhường toàn bộ tài nguyên cho giao diện học sinh render mượt mà
    const timer = setTimeout(async () => {
      try {
        const rawLocal = localStorage.getItem("edunexus_attempts");
        if (!rawLocal) {
          localStorage.setItem(migrationKey, "true");
          return;
        }

        const localList: any[] = JSON.parse(rawLocal);
        if (!Array.isArray(localList) || localList.length === 0) {
          localStorage.setItem(migrationKey, "true");
          return;
        }

        // Lọc các bản ghi của chính học sinh này
        const myLocalAttempts = localList.filter((item: any) => {
          if (!item) return false;
          const stuId = String(item.studentId || item.student_id || item.user_id || "").trim();
          const stuName = String(item.studentName || item.student_name || item.full_name || "").trim().toLowerCase();
          const curId = String(profile.id).trim();
          const curName = String(profile.full_name).trim().toLowerCase();

          return (
            stuId === curId ||
            (profile.username && stuId === profile.username) ||
            (stuName && stuName === curName)
          );
        });

        if (myLocalAttempts.length === 0) {
          localStorage.setItem(migrationKey, "true");
          return;
        }

        // 1. Kiểm tra các bản ghi đã có sẵn trên Supabase để chống nhân đôi dữ liệu
        const { data: serverAttempts } = await supabase
          .from("exam_attempts")
          .select("quiz_id, score, created_at, id")
          .eq("student_id", profile.id)
          .limit(500);

        const existingKeys = new Set<string>();
        (serverAttempts || []).forEach((row: any) => {
          if (row.id) existingKeys.add(String(row.id));
          const composite = `${row.quiz_id}_${row.score}`;
          existingKeys.add(composite);
        });

        // 2. Lọc ra các bài chưa từng được đẩy lên Supabase
        const unsyncedAttempts = myLocalAttempts.filter((att: any) => {
          const qId = String(att.quizId || att.quiz_id || att.exam_id || "");
          const sc = Number(att.score ?? att.points ?? 0);
          if (att.id && existingKeys.has(String(att.id))) return false;
          if (existingKeys.has(`${qId}_${sc}`)) return false;
          return true;
        });

        if (unsyncedAttempts.length === 0) {
          localStorage.setItem(migrationKey, "true");
          return;
        }

        // 3. Đẩy tuần tự các bài cũ lên API server để ghi vào cả exam_attempts & quiz_results
        for (const att of unsyncedAttempts) {
          const payload = {
            quizId: att.quizId || att.quiz_id || att.exam_id,
            quizTitle: att.quizTitle || att.quiz_title || att.examTitle || att.title || "Bài luyện tập",
            studentId: profile.id,
            studentName: profile.full_name,
            username: profile.username || profile.id,
            school: profile.school || "THPT",
            score: Number(att.score ?? att.points ?? 0),
            totalQuestions: Number(att.totalQuestions || att.total_questions || 0),
            correctCount: Number(att.correctCount || att.correct_count || 0),
            timeSpent: att.timeSpent || att.time_spent || "15 phút",
            durationSeconds: Number(att.duration_seconds || att.durationSeconds || 0),
            isHomework: Boolean(att.isHomework || att.is_homework || att.type === "homework"),
            answers: att.answers || att.userAnswers || {}
          };

          try {
            await fetch("/api/student/submit-quiz", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
          } catch (e) {
            // Tiếp tục vòng lặp nếu 1 bài bị lỗi mạng lẻ
          }
        }

        // 4. Phát tín hiệu Realtime cho Admin cập nhật số liệu
        try {
          const channel = supabase.channel("admin-realtime-global-sync");
          channel.send({
            type: "broadcast",
            event: "new_attempt",
            payload: {
              studentName: profile.full_name,
              message: "Đồng bộ hoàn tất dữ liệu lịch sử"
            }
          });
        } catch (e) {}

        // Gắn cờ hoàn tất để không bao giờ lặp lại
        localStorage.setItem(migrationKey, "true");
      } catch (err) {
        console.error("Lỗi đồng bộ ngầm lịch sử học sinh:", err);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [profile]);
}
