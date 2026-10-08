"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Clock, CheckCircle2, RotateCcw, Award, Check, Eye } from "lucide-react";
import { Profile } from "@/types";
import { supabase } from "@/lib/supabaseClient";

interface ExamRoomViewProps {
  quizId: string;
  quizTitle: string;
  durationMinutes: number;
  profile: Profile;
  isHomework?: boolean;
  onBackToDashboard: () => void;
}

export function ExamRoomView({
  quizId,
  quizTitle,
  durationMinutes,
  profile,
  isHomework = false,
  onBackToDashboard
}: ExamRoomViewProps) {
  const [examData, setExamData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(durationMinutes * 60);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [examResult, setExamResult] = useState<{
    score: number;
    correctCount: number;
    totalCount: number;
    submittedAt: string;
  } | null>(null);

  // 1. TẢI CÂU HỎI ĐỀ THI
  useEffect(() => {
    async function loadExam() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("practice_exams")
          .select("*")
          .eq("id", quizId)
          .maybeSingle();

        if (!error && data) {
          setExamData(data);
          if (data.duration_minutes) {
            setSecondsRemaining(data.duration_minutes * 60);
          }
        }
      } catch (err) {
        console.error("Lỗi nạp đề thi:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadExam();
  }, [quizId]);

  // 2. ĐẾM NGƯỢC THỜI GIAN
  useEffect(() => {
    if (showResultModal || isSubmitting) return;
    const timer = setInterval(() => {
      setSecondsRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showResultModal, isSubmitting]);

  const allQuestions = useMemo(() => {
    if (!examData?.data || !Array.isArray(examData.data)) return [];
    return examData.data.flatMap((sec: any) => sec.questions || []);
  }, [examData]);

  // 3. HÀM NỘP BÀI TẬP TRUNG DUY NHẤT (ONLINE & OFFLINE)
  const handleSubmitExam = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    let correct = 0;
    const total = allQuestions.length || 1;

    allQuestions.forEach((q: any, idx: number) => {
      const qKey = q.id || `q_${idx + 1}`;
      const correctAns = String(q.correctAnswer || q.answer || "").trim().toUpperCase();
      const userAns = String(userAnswers[qKey] || "").trim().toUpperCase();
      if (correctAns && userAns === correctAns) {
        correct++;
      }
    });

    const calculatedScore = Number(((correct / total) * 10).toFixed(1));
    const nowIso = new Date().toISOString();
    const durationSpentSec = durationMinutes * 60 - secondsRemaining;
    const timeSpentStr = `${Math.floor(durationSpentSec / 60)} phút ${durationSpentSec % 60} giây`;
    const uniqueAttemptId = `att-${Date.now()}`;

    const studentId = profile.id;
    const studentName = profile.full_name || profile.username || "Học sinh";
    const learningMode = profile.learning_mode || profile.study_mode || "offline";

    const payload = {
      id: uniqueAttemptId,
      quizId: quizId,
      quizTitle: quizTitle,
      studentId: studentId,
      studentName: studentName,
      username: profile.username || profile.id,
      learningMode: learningMode,
      school: profile.school || "THPT",
      score: calculatedScore,
      totalQuestions: total,
      correctCount: correct,
      timeSpent: timeSpentStr,
      durationSeconds: durationSpentSec,
      isHomework: isHomework,
      answers: userAnswers,
      createdAt: nowIso
    };

    // A. Gửi ngay lập tức lên Server API
    try {
      await fetch("/api/student/submit-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn("Lỗi gửi bài qua API server:", e);
    }

    // B. Lưu đồng bộ ngay vào key chuẩn duy nhất edunexus_attempts
    try {
      const rawLocal = localStorage.getItem("edunexus_attempts");
      const localList = rawLocal ? JSON.parse(rawLocal) : [];
      const updatedList = [payload, ...(Array.isArray(localList) ? localList : [])];
      localStorage.setItem("edunexus_attempts", JSON.stringify(updatedList));
    } catch (e) {}

    // C. Bắn Realtime cho Admin nhận điểm lập tức
    try {
      const channel = supabase.channel("admin-realtime-global-sync");
      channel.send({
        type: "broadcast",
        event: "new_attempt",
        payload: {
          studentName: studentName,
          learningMode: learningMode,
          quizTitle: quizTitle,
          score: calculatedScore
        }
      });
    } catch (e) {}

    setExamResult({
      score: calculatedScore,
      correctCount: correct,
      totalCount: total,
      submittedAt: nowIso
    });
    setIsSubmitting(false);
    setShowResultModal(true);
  }, [allQuestions, userAnswers, durationMinutes, secondsRemaining, quizId, quizTitle, profile, isHomework, isSubmitting]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 font-sans">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#1D4ED8] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Đang chuẩn bị đề thi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] font-sans text-slate-800 flex flex-col">
      {/* HEADER PHÒNG THI */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 line-clamp-1">{quizTitle}</h1>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
              {profile.full_name} • Phân hệ: {profile.learning_mode === "offline" ? "Lớp Offline" : "Lớp Online"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 text-[#1D4ED8] rounded-xl border border-blue-100 font-black text-xs sm:text-sm shadow-2xs">
            <Clock className="w-4 h-4" />
            <span>{formatTimer(secondsRemaining)}</span>
          </div>
          <button
            type="button"
            onClick={handleSubmitExam}
            disabled={isSubmitting}
            className="px-5 py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? "Đang nộp..." : "Nộp bài thi"}
          </button>
        </div>
      </header>

      {/* DANH SÁCH CÂU HỎI */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6 pb-24">
        {allQuestions.map((q: any, idx: number) => {
          const qKey = q.id || `q_${idx + 1}`;
          const currentAns = userAnswers[qKey];

          return (
            <div key={qKey} className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-start gap-3">
                <span className="px-2.5 py-1 bg-blue-50 text-[#1D4ED8] font-black text-xs rounded-lg border border-blue-100 shrink-0">
                  Câu {q.order_index || idx + 1}
                </span>
                <div
                  className="text-sm font-semibold text-slate-800 leading-relaxed flex-1"
                  dangerouslySetInnerHTML={{ __html: q.prompt_html || q.prompt || "Nội dung câu hỏi" }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                {(q.options || []).map((opt: any, oIdx: number) => {
                  const optKey = opt.key || String.fromCharCode(65 + oIdx);
                  const isSelected = currentAns === optKey;

                  return (
                    <button
                      key={optKey}
                      type="button"
                      onClick={() => setUserAnswers(prev => ({ ...prev, [qKey]: optKey }))}
                      className={
                        "p-3 rounded-xl border text-left text-xs font-semibold flex items-center gap-3 transition cursor-pointer " +
                        (isSelected
                          ? "bg-blue-50 border-[#1D4ED8] text-[#1D4ED8] shadow-xs"
                          : "bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100")
                      }
                    >
                      <div
                        className={
                          "w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 " +
                          (isSelected ? "bg-[#1D4ED8] text-white" : "bg-white border border-slate-300 text-slate-600")
                        }
                      >
                        {optKey}
                      </div>
                      <div dangerouslySetInnerHTML={{ __html: opt.text_html || opt.text || "" }} />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </main>

      {/* POPUP KẾT QUẢ THI HOÀN CHỈNH */}
      <AnimatePresence>
        {showResultModal && examResult && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white rounded-[28px] max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col md:flex-row"
            >
              {/* BÊN TRÁI: ĐIỂM SỐ CỦA BẠN */}
              <div className="p-6 md:p-8 flex-1 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-100 bg-white">
                <div>
                  <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-4">
                    <Award className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900 mb-1">Hoàn Thành Bài Thi!</h2>
                  <p className="text-xs font-bold text-slate-500 mb-6">{quizTitle}</p>

                  <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-5 mb-6 text-center">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">ĐIỂM ĐẠT ĐƯỢC</p>
                    <div className="text-4xl font-black text-[#1D4ED8] mb-2">{examResult.score.toFixed(1)} <span className="text-sm text-slate-400">/ 10</span></div>
                    <p className="text-xs font-bold text-slate-600">
                      Đúng {examResult.correctCount}/{examResult.totalCount} câu trọn vẹn
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResultModal(false);
                      setUserAnswers({});
                      setSecondsRemaining(durationMinutes * 60);
                    }}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> Làm lại bài
                  </button>
                  <button
                    type="button"
                    onClick={onBackToDashboard}
                    className="w-full py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
                  >
                    Về Trang Chủ
                  </button>
                </div>
              </div>

              {/* BÊN PHẢI: BẢNG XẾP HẠNG KẾT QUẢ VỚI TÊN THẬT */}
              <div className="p-6 md:p-8 w-full md:w-72 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" /> Bảng Xếp Hạng Kết Quả
                  </h3>

                  <div className="space-y-2">
                    <div className="bg-white p-3.5 rounded-xl border border-blue-200 shadow-2xs flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-lg bg-[#1D4ED8] text-white font-black text-xs flex items-center justify-center">1</div>
                        <div>
                          <p className="text-xs font-black text-slate-900">{profile.full_name || profile.username}</p>
                          <span className="text-[10px] font-bold text-[#1D4ED8] bg-blue-50 px-1.5 py-0.2 rounded border border-blue-100">BẠN</span>
                        </div>
                      </div>
                      <span className="text-sm font-black text-[#1D4ED8]">{examResult.score.toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 font-semibold text-center mt-6">
                  Dữ liệu đã được đồng bộ trực tiếp lên hệ thống TCT.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
