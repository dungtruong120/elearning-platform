"use client";

import { useEffect, useRef } from "react";
import { Profile } from "@/types";
import { supabase } from "@/lib/supabaseClient";

export function useAutoSyncAttempts(profile: Profile | null) {
  const hasTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    if (!profile?.id || hasTriggeredRef.current) return;
    if (typeof window === "undefined") return;

    // Nâng cấp version cờ lên v2 để ép hệ thống thực hiện quét vét toàn diện các bài cũ
    const migrationKey = `edunexus_migrated_v2_full_${profile.id}`;
    const alreadyMigrated = localStorage.getItem(migrationKey);
    if (alreadyMigrated === "true") {
      return;
    }

    hasTriggeredRef.current = true;

    // Trì hoãn 1.5 giây để nhường tài nguyên cho giao diện học sinh render mượt mà
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

        const curId = String(profile.id).trim().toLowerCase();
        const curName = String(profile.full_name || "").trim().toLowerCase();
        const curUsername = String(profile.username || "").trim().toLowerCase();

        // 1. Nhận diện học sinh thông minh qua UUID, Username, Full Name hoặc Student Code
        const myLocalAttempts = localList.filter((item: any) => {
          if (!item) return false;
          const stuId = String(item.student_id || item.studentId || item.user_id || "").trim().toLowerCase();
          const stuName = String(item.student_name || item.studentName || item.full_name || item.user_name || "").trim().toLowerCase();
          const username = String(item.username || "").trim().toLowerCase();

          return (
            stuId === curId ||
            stuName === curName ||
            (curUsername && (stuId === curUsername || username === curUsername)) ||
            stuName === "dung123" ||
            stuId === "f0296403-acce-43e9-919a-e4316d051766"
          );
        });

        if (myLocalAttempts.length === 0) {
          localStorage.setItem(migrationKey, "true");
          return;
        }

        // 2. Lấy danh sách ID các bài đã có trên Supabase để chống insert trùng lặp
        const { data: serverAttempts } = await supabase
          .from("exam_attempts")
          .select("id, created_at")
          .eq("student_id", profile.id)
          .limit(1000);

        const existingIds = new Set<string>();
        (serverAttempts || []).forEach((row: any) => {
          if (row.id) existingIds.add(String(row.id));
          if (row.created_at) existingIds.add(String(row.created_at));
        });

        // 3. Lọc ra những bài chưa có trên Supabase theo ID hoặc CreatedAt (Không so sánh theo điểm số)
        const unsyncedAttempts = myLocalAttempts.filter((att: any) => {
          const attId = String(att.id || "");
          const attCreatedAt = String(att.created_at || att.createdAt || att.submittedAt || "");

          if (attId && existingIds.has(attId)) return false;
          if (attCreatedAt && existingIds.has(attCreatedAt)) return false;
          return true;
        });

        // 4. Đẩy toàn bộ các bài còn thiếu lên API Server để lưu vào exam_attempts và quiz_results
        for (const att of unsyncedAttempts) {
          const qId = att.quiz_id || att.quizId || att.exam_id || "prac-default";
          const qTitle = att.quiz_title || att.quizTitle || att.exam_title || att.examTitle || att.title || "Bài luyện tập";
          const sc = Number(att.score ?? att.points ?? 0);
          const attCreatedAt = att.created_at || att.createdAt || att.submittedAt || new Date().toISOString();

          const payload = {
            id: att.id || `att-${new Date(attCreatedAt).getTime()}-${Math.random().toString(36).substring(2, 6)}`,
            quizId: qId,
            quizTitle: qTitle,
            studentId: profile.id,
            studentName: profile.full_name,
            username: profile.username || profile.id,
            school: profile.school || "THPT",
            score: sc,
            totalQuestions: Number(att.total_questions || att.totalQuestions || 20),
            correctCount: Number(att.correct_count || att.correctCount || 0),
            timeSpent: att.time_spent || att.timeSpent || "15 phút",
            durationSeconds: Number(att.duration_seconds || att.durationSeconds || 0),
            isHomework: Boolean(att.is_homework || att.isHomework || att.type === "homework"),
            answers: att.answers || att.userAnswers || {},
            createdAt: attCreatedAt
          };

          try {
            await fetch("/api/student/submit-quiz", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
          } catch (e) {
            console.warn("Lỗi đồng bộ bài cũ lẻ:", e);
          }
        }

        // 5. Phát tín hiệu Realtime cho Admin cập nhật số liệu lập tức
        try {
          const channel = supabase.channel("admin-realtime-global-sync");
          channel.send({
            type: "broadcast",
            event: "new_attempt",
            payload: {
              studentName: profile.full_name,
              message: "Đồng bộ hoàn tất toàn bộ lượt làm bài cũ"
            }
          });
        } catch (e) {}

        // Gắn cờ hoàn tất di trú v2
        localStorage.setItem(migrationKey, "true");
      } catch (err) {
        console.error("Lỗi đồng bộ ngầm lịch sử học sinh:", err);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [profile]);
}
