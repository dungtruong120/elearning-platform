"use client";

import { useEffect, useRef } from "react";
import { Profile } from "@/types";
import { supabase } from "@/lib/supabaseClient";

export function useAutoSyncAttempts(profile: Profile | null) {
  const hasTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    if (!profile?.id || hasTriggeredRef.current) return;
    if (typeof window === "undefined") return;

    // Cờ đánh dấu version 3 tự động hoàn toàn
    const migrationKey = `edunexus_auto_synced_v3_${profile.id}`;
    const alreadyMigrated = localStorage.getItem(migrationKey);
    if (alreadyMigrated === "true") {
      return;
    }

    hasTriggeredRef.current = true;

    // Trì hoãn 1.2 giây để nhường toàn bộ luồng xử lý cho UI học sinh hiển thị mượt mà
    const timer = setTimeout(async () => {
      try {
        const rawLocal = localStorage.getItem("edunexus_attempts");
        if (!rawLocal) {
          localStorage.setItem(migrationKey, "true");
          return;
        }

        let allList: any[] = [];
        try {
          allList = JSON.parse(rawLocal);
        } catch {
          localStorage.setItem(migrationKey, "true");
          return;
        }

        if (!Array.isArray(allList) || allList.length === 0) {
          localStorage.setItem(migrationKey, "true");
          return;
        }

        const studentId = profile.id;
        const studentName = profile.full_name || profile.username || "Học sinh";
        const curUsername = profile.username || profile.id;

        // Quét toàn bộ các bài làm trong localStorage của thiết bị này
        for (let i = 0; i < allList.length; i++) {
          const att = allList[i];
          if (!att) continue;

          const qId = String(att.quizId || att.quiz_id || att.exam_id || "prac-default").trim();
          const qTitle = String(att.quizTitle || att.quiz_title || att.examTitle || att.title || "Bài luyện tập").trim();
          const scoreVal = Number(att.score ?? att.points ?? 0);
          const createdAtVal = att.created_at || att.createdAt || att.submittedAt || new Date().toISOString();
          const uniqueId = att.id || `att-auto-${i + 1}-${new Date(createdAtVal).getTime()}`;

          const payload = {
            id: uniqueId,
            quizId: qId,
            quizTitle: qTitle,
            studentId: studentId,
            studentName: studentName,
            username: curUsername,
            school: profile.school || "THPT",
            score: scoreVal,
            totalQuestions: Number(att.totalQuestions || att.total_questions || 20),
            correctCount: Number(att.correctCount || att.correct_count || 1),
            timeSpent: att.timeSpent || att.time_spent || "0 phút 15 giây",
            durationSeconds: Number(att.duration_seconds || att.durationSeconds || 15),
            isHomework: Boolean(att.isHomework || att.is_homework || att.type === "homework"),
            answers: att.answers || att.userAnswers || {},
            createdAt: createdAtVal
          };

          try {
            await fetch("/api/student/submit-quiz", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
          } catch {
            // Không làm gián đoạn nếu một bài nộp lẻ gặp trục trặc mạng
          }
        }

        // Bắn tín hiệu Realtime cho màn hình Admin cập nhật tức thì
        try {
          const channel = supabase.channel("admin-realtime-global-sync");
          channel.send({
            type: "broadcast",
            event: "new_attempt",
            payload: {
              studentName: studentName,
              message: "Tự động đồng bộ toàn bộ lịch sử thi hoàn tất"
            }
          });
        } catch {}

        // Gắn cờ hoàn tất di trú ngầm
        localStorage.setItem(migrationKey, "true");
      } catch (err) {
        console.error("Lỗi đồng bộ ngầm học sinh:", err);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [profile]);
}
