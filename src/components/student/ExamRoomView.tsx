"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Clock, CheckCircle2, RotateCcw, Award, 
  Check, Eye, Home, AlertCircle, ChevronRight, HelpCircle 
} from "lucide-react";
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
  const [isReviewMode, setIsReviewMode] = useState<boolean>(false);
  
  const [examResult, setExamResult] = useState<{
    score: number;
    correctCount: number;
    totalCount: number;
    submittedAt: string;
    attemptsCount: number;
  } | null>(null);

  const syncTriggeredRef = useRef<boolean>(false);

  // 1. TẢI CẤU TRÚC ĐỀ THI GỐC
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

  // 2. BẢO TOÀN CƠ CHẾ ĐẾM NGƯỢC THỜI GIAN
  useEffect(() => {
    if (showResultModal || isSubmitting || isReviewMode) return;
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
  }, [showResultModal, isSubmitting, isReviewMode]);

  const allQuestions = useMemo(() => {
    if (!examData?.data || !Array.isArray(examData.data)) return [];
    return examData.data.flatMap((sec: any) => sec.questions || []);
  }, [examData]);

  // 3. CƠ CHẾ QUÉT VÉT BÙ CÁC LƯỢT THI CŨ CHƯA ĐỒNG BỘ LÊN SERVER
  useEffect(() => {
    if (!profile?.id || syncTriggeredRef.current) return;
    syncTriggeredRef.current = true;

    const timer = setTimeout(async () => {
      try {
        const rawLocal = localStorage.getItem("edunexus_attempts");
        if (!rawLocal) return;

        const localList: any[] = JSON.parse(rawLocal);
        if (!Array.isArray(localList) || localList.length === 0) return;

        const myUnsynced = localList.filter((item: any) => {
          if (!item) return false;
          const qId = String(item.quizId || item.quiz_id || item.exam_id || "").trim();
          const targetQuizId = String(quizId).trim();
          return (
            qId === targetQuizId ||
            (targetQuizId && qId.includes(targetQuizId.replace("prac-", "")))
          );
        });

        for (const att of myUnsynced) {
          const payload = {
            id: att.id || `att-recovery-${Date.now()}`,
            quizId: quizId,
            quizTitle: quizTitle,
            studentId: profile.id,
            studentName: profile.full_name || profile.username || "Học sinh",
            username: profile.username || profile.id,
            learningMode: profile.learning_mode || profile.study_mode || "offline",
            school: profile.school || "THPT",
            score: Number(att.score ?? att.points ?? 0),
            totalQuestions: Number(att.totalQuestions || att.total_questions || allQuestions.length || 20),
            correctCount: Number(att.correctCount || att.correct_count || 0),
            timeSpent: att.timeSpent || att.time_spent || "15 phút",
            durationSeconds: Number(att.durationSeconds || att.duration_seconds || 900),
            isHomework: Boolean(isHomework),
            answers: att.answers || att.userAnswers || {},
            createdAt: att.createdAt || att.created_at || new Date().toISOString()
          };

          try {
            await fetch("/api/student/submit-quiz", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
          } catch (e) {}
        }
      } catch (e) {}
    }, 1500);

    return () => clearTimeout(timer);
  }, [profile, quizId, quizTitle, isHomework, allQuestions.length]);

  // 4. HÀM NỘP BÀI TẬP TRUNG DUY NHẤT (BẢO TOÀN LOGIC CHẤM ĐIỂM VÀ ĐẨY DỮ LIỆU)
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

    // A. Gửi trực tiếp lên Serverless API
    try {
      await fetch("/api/student/submit-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.warn("Lỗi đồng bộ qua submit-quiz:", e);
    }

    // B. Cập nhật vào LocalStorage
    let updatedAttemptsCount = 1;
    try {
      const rawLocal = localStorage.getItem("edunexus_attempts");
      const localList = rawLocal ? JSON.parse(rawLocal) : [];
      const updatedList = [payload, ...(Array.isArray(localList) ? localList : [])];
      localStorage.setItem("edunexus_attempts", JSON.stringify(updatedList));

      const myAttemptsForThisQuiz = updatedList.filter(
        (a: any) => String(a.quizId || a.quiz_id) === String(quizId)
      );
      updatedAttemptsCount = myAttemptsForThisQuiz.length || 1;
    } catch (e) {}

    // C. Bắn Realtime cho Admin cập nhật tức thời
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
      submittedAt: nowIso,
      attemptsCount: updatedAttemptsCount
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
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 font-sans">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-[#1D4ED8] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Đang chuẩn bị đề thi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] font-sans text-slate-800 flex flex-col">
      {/* HEADER PHÒNG THI GỐC */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-xs">
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
              {profile.full_name} • {profile.learning_mode === "offline" ? "Lớp Offline" : "Lớp Online"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
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
            {isSubmitting ? "Đang nộp bài..." : "Nộp bài thi"}
          </button>
        </div>
      </header>

      {/* DANH SÁCH CÂU HỎI THEO GIAO DIỆN NGUYÊN BẢN */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6 pb-28">
        {allQuestions.map((q: any, idx: number) => {
          const qKey = q.id || `q_${idx + 1}`;
          const currentAns = userAnswers[qKey];
          const correctAns = String(q.correctAnswer || q.answer || "").trim().toUpperCase();

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
                  const isCorrect = isReviewMode && optKey === correctAns;
                  const isWrongSelected = isReviewMode && isSelected && optKey !== correctAns;

                  let btnStyle = "bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100";
                  let badgeStyle = "bg-white border border-slate-300 text-slate-600";

                  if (isSelected) {
                    btnStyle = "bg-blue-50 border-[#1D4ED8] text-[#1D4ED8] shadow-xs";
                    badgeStyle = "bg-[#1D4ED8] text-white";
                  }
                  if (isCorrect) {
                    btnStyle = "bg-emerald-50 border-emerald-500 text-emerald-800";
                    badgeStyle = "bg-emerald-600 text-white";
                  } else if (isWrongSelected) {
                    btnStyle = "bg-rose-50 border-rose-500 text-rose-800";
                    badgeStyle = "bg-rose-600 text-white";
                  }

                  return (
                    <button
                      key={optKey}
                      type="button"
                      disabled={isReviewMode}
                      onClick={() => setUserAnswers(prev => ({ ...prev, [qKey]: optKey }))}
                      className={`p-3 rounded-xl border text-left text-xs font-semibold flex items-center gap-3 transition cursor-pointer ${btnStyle}`}
                    >
                      <div className={`w-6 h-6 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${badgeStyle}`}>
                        {optKey}
                      </div>
                      <div dangerouslySetInnerHTML={{ __html: opt.text_html || opt.text || "" }} />
                    </button>
                  );
                })}
              </div>

              {/* LỜI GIẢI CHI TIẾT (KHI BẬT CHẾ ĐỘ XEM ĐÁP ÁN) */}
              {isReviewMode && q.explanation && (
                <div className="mt-4 p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                  <p className="font-bold text-amber-800 mb-1 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4" /> Lời giải chi tiết:
                  </p>
                  <div dangerouslySetInnerHTML={{ __html: q.explanation_html || q.explanation }} />
                </div>
              )}
            </div>
          );
        })}
      </main>

      {/* POPUP HOÀN THÀNH BÀI THI NGUYÊN BẢN GỐC (KHỚP 100% ẢNH THỰC TẾ) */}
      <AnimatePresence>
        {showResultModal && examResult && (
          <div 
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowResultModal(false);
              }
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs cursor-pointer"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[28px] max-w-4xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col md:flex-row cursor-default"
            >
              {/* CỘT TRÁI: ĐIỂM SỐ VÀ CÁC THAO TÁC */}
              <div className="p-8 md:p-10 flex-1 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-100 bg-white">
                <div>
                  <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-5">
                    <Award className="w-6 h-6" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
                    Hoàn Thành Bài Thi!
                  </h2>
                  <p className="text-xs font-bold text-slate-400 mb-8">{quizTitle}</p>

                  <div className="bg-blue-50/40 border border-blue-100 rounded-2xl p-6 mb-8 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-[#1D4ED8] mb-1">
                        ĐIỂM ĐẠT ĐƯỢC
                      </p>
                      <div className="text-4xl font-black text-[#1D4ED8]">
                        {examResult.score.toFixed(1)} <span className="text-sm font-bold text-slate-400">/ 10</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-700">
                        Đúng {examResult.correctCount}/{examResult.totalCount} câu trọn vẹn
                      </p>
                      <span className="text-[11px] font-bold text-slate-400">
                        ({examResult.attemptsCount} lần nộp)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowResultModal(false);
                      setIsReviewMode(false);
                      setUserAnswers({});
                      setSecondsRemaining(durationMinutes * 60);
                    }}
                    className="flex-1 py-3 px-4 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> Làm lại bài
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowResultModal(false);
                      setIsReviewMode(true);
                    }}
                    className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" /> Xem đáp án
                  </button>

                  <button
                    type="button"
                    onClick={onBackToDashboard}
                    className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Home className="w-4 h-4" /> Trang chủ
                  </button>
                </div>
              </div>

              {/* CỘT PHẢI: BẢNG XẾP HẠNG KẾT QUẢ GỐC */}
              <div className="p-8 md:p-10 w-full md:w-80 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-6 flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" /> Bảng Xếp Hạng Kết Quả
                  </h3>

                  <div className="space-y-3">
                    <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-2xs flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-lg bg-[#1D4ED8] text-white font-black text-xs flex items-center justify-center">
                          1
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-900">
                              {profile.full_name || profile.username}
                            </span>
                            <span className="text-[9px] font-black text-[#1D4ED8] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                              BẠN
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-sm font-black text-[#1D4ED8]">
                        {examResult.score.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 font-medium text-center mt-8 italic">
                  Bấm ra ngoài vùng hộp thoại để đóng bảng kết quả.
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
