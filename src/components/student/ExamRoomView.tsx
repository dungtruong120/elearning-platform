"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle,
  HelpCircle, ChevronLeft, ChevronRight, RotateCcw,
  Eye, Trophy, Home, Send, List, LayoutGrid, Award, Check,
  Maximize2, Minimize2, X, Grid3X3, BookOpen, PenLine, Loader2
} from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Profile } from "@/types";
import { supabase } from "@/lib/supabaseClient";

interface QuestionOption {
  key: string;
  text: string;
}

interface QuestionItem {
  id: string;
  order: number;
  type?: "multiple_choice" | "true_false" | "short_answer";
  prompt: string;
  options: QuestionOption[];
  correctAnswer: string;
  explanation?: string;
  image?: string;
}

interface ExamRoomViewProps {
  quizId: string;
  quizTitle: string;
  durationMinutes?: number;
  profile: Profile;
  isHomework?: boolean;
  onBackToDashboard: () => void;
}

function MathRenderer({
  content,
  mediaMap = {},
  inline = false
}: {
  content: string;
  mediaMap?: Record<string, string>;
  inline?: boolean;
}) {
  if (!content) return null;
  let text = content.normalize("NFC");
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => "$$" + math + "$$");
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => "$" + math + "$");
  text = text.replace(/\\left\s*\\\{\s*\\begin\{(?:align|aligned|array)\}([\s\S]*?)\\end\{(?:align|aligned|array)\}\s*\\right\./gi, (_, body) => {
    return "$$\\begin{cases} " + body.replace(/&/g, "").trim() + " \\end{cases}$$";
  });
  text = text.replace(/(?<!\$\$)\\begin\{(?:align|aligned)\}([\s\S]*?)\\end\{(?:align|aligned)\}(?!\$\$)/gi, (match) => "$" + match + "$");
  text = text.replace(/(\\right\.)([a-zA-Z\\])/g, "$1 $2");
  text = text.replace(/([0-9a-zA-Z])(\\[a-zA-Z]+)/g, "$1 $2");
  text = text.replace(/\\langle\s*\(\)\s*|\\langle\s*|\\rangle\s*|\\sqrt\{\s*\}|\(\)/g, "");

  const parts = text.split(/(\[img:[^\]]+\]|\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

  return (
    <span className={inline ? "inline align-middle text-[13.5px] sm:text-[14px] font-normal text-slate-700" : "block leading-relaxed text-[14px] sm:text-[15px] font-normal text-slate-800"}>
      {parts.map((part, i) => {
        if (!part) return null;
        const imgMatch = part.match(/^\[img:([^\]]+)\]$/);
        if (imgMatch && imgMatch[1]) {
          let rawKey = imgMatch[1].trim();
          if (rawKey.startsWith("$") && rawKey.endsWith("$")) {
            rawKey = rawKey.slice(1, -1);
          }
          const isDirectUrl = rawKey.startsWith("http://") || rawKey.startsWith("https://") || rawKey.startsWith("data:");
          const src = isDirectUrl ? rawKey : mediaMap[rawKey];
          if (!src) return null;
          return inline ? (
            <img
              key={i}
              src={src}
              alt="Hình ảnh"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
              className="inline-block max-h-12 align-middle mx-1 my-0.5 object-contain rounded border border-slate-100 bg-white"
            />
          ) : (
            <span key={i} className="my-2.5 block text-center">
              <img
                src={src}
                alt="Hình minh họa"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
                className="max-h-60 sm:max-h-72 max-w-full rounded-xl border border-slate-200/90 bg-white shadow-2xs p-1 object-contain inline-block"
              />
            </span>
          );
        }

        if (part.startsWith("$")) {
          const isBlock = part.startsWith("$$");
          const math = isBlock ? part.slice(2, -2).trim() : part.slice(1, -1).trim();
          if (!math) return null;
          try {
            return (
              <span
                key={i}
                className={isBlock ? "block my-2 text-center overflow-x-auto custom-scrollbar" : "inline-block align-middle px-0.5 text-[14.5px] sm:text-[15px] font-serif"}
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(math, {
                    displayMode: isBlock,
                    throwOnError: false
                  })
                }}
              />
            );
          } catch {
            return <span key={i} className="font-serif italic text-blue-700 px-0.5">{math}</span>;
          }
        }

        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

const DEFAULT_QUESTIONS: QuestionItem[] = [
  {
    id: "q-1",
    order: 1,
    prompt: "Cho hàm số $y=f(x)$ có đạo hàm $f'(x) = x(x-1)^2$. Số điểm cực trị của hàm số đã cho là:",
    options: [
      { key: "A", text: "1" },
      { key: "B", text: "2" },
      { key: "C", text: "0" },
      { key: "D", text: "3" }
    ],
    correctAnswer: "A",
    explanation: "Đạo hàm đổi dấu qua nghiệm bội lẻ x = 0. Do đó hàm số có đúng 1 điểm cực trị."
  }
];

export function ExamRoomView({
  quizId,
  quizTitle,
  durationMinutes = 45,
  profile,
  isHomework = false,
  onBackToDashboard
}: ExamRoomViewProps) {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [currentIdx, setCurrentIdx] = useState<number>(0);

  const [userAnswers, setUserAnswers] = useState<Record<string, any>>(() => {
    if (typeof window !== "undefined" && isHomework) {
      try {
        const key = "tct_hw_draft_" + (profile?.id || "anon") + "_" + quizId;
        const saved = localStorage.getItem(key);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  const [layoutMode, setLayoutMode] = useState<"single" | "scroll">("scroll");
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (isHomework) return 0;
    return durationMinutes > 0 ? durationMinutes * 60 : 0;
  });

  const [timeSpentSeconds, setTimeSpentSeconds] = useState<number>(0);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [rankingList, setRankingList] = useState<any[]>([]);
  const [historyAttemptsCount, setHistoryAttemptsCount] = useState<number>(1);
  const [isReviewMode, setIsReviewMode] = useState<boolean>(false);

  const userAnswersRef = useRef<Record<string, any>>({});
  userAnswersRef.current = userAnswers;

  const isQuestionTrueFalse = useCallback((q: QuestionItem) => {
    if (q.type === "true_false") return true;
    const cleanAns = (q.correctAnswer || "").replace(/[^A-Za-zĐđSsTtFf]/g, "").toUpperCase();
    if (["Đ", "S", "T", "F"].includes(cleanAns[0]) && cleanAns.length >= 2) return true;
    return false;
  }, []);

  const isQuestionShortAnswer = useCallback((q: QuestionItem) => {
    if (q.type === "short_answer") return true;
    if (!q.options || q.options.length === 0) return true;
    return false;
  }, []);

  // LƯU BẢN NHÁP BTVN
  useEffect(() => {
    if (isHomework && typeof window !== "undefined" && profile?.id && !isSubmitted) {
      try {
        const key = "tct_hw_draft_" + profile.id + "_" + quizId;
        localStorage.setItem(key, JSON.stringify(userAnswers));
      } catch (e) {}
    }
  }, [userAnswers, isHomework, profile?.id, quizId, isSubmitted]);

  // TẢI CÂU HỎI VÀ HÌNH VẼ
  useEffect(() => {
    setIsLoading(true);
    const loadExamQuestions = async () => {
      let loaded: QuestionItem[] = [];
      let mappedImages: Record<string, string> = {};
      try {
        const { data: dbExam } = await supabase
          .from("practice_exams")
          .select("*")
          .eq("id", quizId)
          .maybeSingle();

        let targetExam = dbExam;
        if (!targetExam && typeof window !== "undefined") {
          const savedPractice = localStorage.getItem("edunexus_practice_exams");
          if (savedPractice) {
            const exams = JSON.parse(savedPractice);
            targetExam = exams.find((e: any) => e.id === quizId || e.title === quizTitle);
          }
        }

        if (!targetExam) {
          const { data: courseRow } = await supabase.from("courses").select("chapters").limit(1).maybeSingle();
          if (courseRow && Array.isArray(courseRow.chapters)) {
            for (const chap of courseRow.chapters) {
              for (const les of chap.lessons || []) {
                const foundHw = (les.homework_files || []).find((f: any) => f.id === quizId || f.title === quizTitle);
                const foundTest = (les.test_quizzes || []).find((f: any) => f.id === quizId || f.title === quizTitle);
                if (foundHw) { targetExam = foundHw; break; }
                if (foundTest) { targetExam = foundTest; break; }
              }
              if (targetExam) break;
            }
          }
        }

        if (targetExam) {
          mappedImages = targetExam.media_map || targetExam.mediaMap || {};
          setMediaMap(mappedImages);

          if (targetExam.data && Array.isArray(targetExam.data)) {
            let qIdx = 1;
            targetExam.data.forEach((sec: any) => {
              const secType = sec.section_type || sec.type || (
                sec.title && /đúng\s*sai/i.test(sec.title)
                  ? "true_false"
                  : sec.title && /trả\s*lời\s*ngắn|điền/i.test(sec.title)
                  ? "short_answer"
                  : "multiple_choice"
              );
              (sec.questions || []).forEach((q: any) => {
                const qType = q.type || secType || "multiple_choice";
                loaded.push({
                  id: q.id || ("q-" + qIdx),
                  order: qIdx++,
                  type: qType,
                  prompt: q.prompt_html || q.prompt || "",
                  options: (q.options || []).map((opt: any) => ({
                    key: opt.key,
                    text: opt.text_html || opt.text || ""
                  })),
                  correctAnswer: q.correct_answer || q.correctAnswer || "A",
                  explanation: q.solution_html || q.solution || q.explanation || "Đang cập nhật lời giải chi tiết."
                });
              });
            });
          } else if (targetExam.questions && Array.isArray(targetExam.questions)) {
            loaded = targetExam.questions.map((q: any, idx: number) => ({
              id: q.id || ("q-" + (idx + 1)),
              order: idx + 1,
              type: q.type || "multiple_choice",
              prompt: q.prompt_html || q.prompt || ("Câu " + (idx + 1)),
              options: (q.options || []).map((opt: any) => ({
                key: opt.key,
                text: opt.text_html || opt.text || ""
              })),
              correctAnswer: q.correct_answer || q.correctAnswer || "A",
              explanation: q.solution_html || q.solution || q.explanation || "Đang cập nhật lời giải chi tiết."
            }));
          }
        }
      } catch (err) {
        console.error("Lỗi khi tải đề thi:", err);
      }

      if (loaded.length === 0) {
        loaded = DEFAULT_QUESTIONS;
      }
      setQuestions(loaded);
      setIsLoading(false);
    };

    loadExamQuestions();
  }, [quizId, quizTitle]);

  // ĐỒNG HỒ ĐẾM GIỜ
  useEffect(() => {
    if (isSubmitted || isReviewMode) return;
    const timer = setInterval(() => {
      setTimeSpentSeconds(prev => prev + 1);
      if (!isHomework && durationMinutes > 0) {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [isSubmitted, isReviewMode, durationMinutes, isHomework]);

  const handleSelectOption = (questionId: string, optionKey: string) => {
    if (isSubmitted && !isReviewMode) return;
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: optionKey
    }));
  };

  const handleSelectTrueFalseOption = (questionId: string, optKey: string, value: "T" | "F") => {
    if (isSubmitted && !isReviewMode) return;
    setUserAnswers(prev => {
      const currentTF = typeof prev[questionId] === "object" && prev[questionId] !== null ? { ...prev[questionId] } : {};
      currentTF[optKey.toLowerCase()] = value;
      return {
        ...prev,
        [questionId]: currentTF
      };
    });
  };

  const handleShortAnswerChange = (questionId: string, val: string) => {
    if (isSubmitted && !isReviewMode) return;
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: val
    }));
  };

  const normalizeShortAnswer = (val: string) => {
    if (!val) return "";
    return String(val)
      .trim()
      .toLowerCase()
      .replace(/,/g, ".")
      .replace(/\s+/g, "")
      .replace(/[−–—]/g, "-");
  };

  // NỘP BÀI THI: XỬ LÝ AN TOÀN QUA API ROUTE VÀ FALLBACK SUPABASE CLIENT
  const handleSubmitExam = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setIsMobileDrawerOpen(false);
    const answers = userAnswersRef.current;

    let totalPoints = 0;
    let fullCorrectCount = 0;

    questions.forEach(q => {
      const isTF = isQuestionTrueFalse(q);
      const isShort = isQuestionShortAnswer(q);

      if (isShort) {
        const userVal = normalizeShortAnswer(answers[q.id] || "");
        const correctVal = normalizeShortAnswer(q.correctAnswer || "");
        if (userVal && correctVal && userVal === correctVal) {
          totalPoints += 1.0;
          fullCorrectCount += 1;
        }
      } else if (!isTF) {
        if (answers[q.id] === q.correctAnswer) {
          totalPoints += 1.0;
          fullCorrectCount += 1;
        }
      } else {
        const userTF = answers[q.id] || {};
        const cleanAns = (q.correctAnswer || "").replace(/[^A-Za-zĐđSsTtFf]/g, "").toUpperCase();
        let correctSubItems = 0;
        
        q.options.forEach((opt, idx) => {
          const expectedChar = cleanAns[idx] || "Đ";
          const expectedVal = (expectedChar === "Đ" || expectedChar === "D" || expectedChar === "T") ? "T" : "F";
          const userVal = userTF[opt.key.toLowerCase()];
          if (userVal === expectedVal) {
            correctSubItems += 1;
          }
        });

        if (correctSubItems === 1) totalPoints += 0.1;
        else if (correctSubItems === 2) totalPoints += 0.25;
        else if (correctSubItems === 3) totalPoints += 0.5;
        else if (correctSubItems === 4) {
          totalPoints += 1.0;
          fullCorrectCount += 1;
        }
      }
    });

    const calculatedScore = Number(((totalPoints / (questions.length || 1)) * 10).toFixed(1));
    setScore(calculatedScore);
    setCorrectCount(fullCorrectCount);
    setIsSubmitted(true);
    setShowResultModal(true);

    if (isHomework && typeof window !== "undefined" && profile?.id) {
      try {
        const key = "tct_hw_draft_" + profile.id + "_" + quizId;
        localStorage.removeItem(key);
      } catch (e) {}
    }

    const durationText = Math.floor(timeSpentSeconds / 60) + " phút " + (timeSpentSeconds % 60) + " giây";
    const nowIso = new Date().toISOString();

    const studentId = String(profile?.id || (profile as any)?.username || "student");
    const studentName = String(profile?.full_name || (profile as any)?.username || "Học sinh");
    const learningMode = String(profile?.learning_mode || profile?.study_mode || "offline");

    const attemptPayload = {
      id: "att-" + Date.now(),
      quizId: String(quizId),
      quizTitle: String(quizTitle),
      studentId: studentId,
      studentName: studentName,
      username: String((profile as any)?.username || studentId),
      learningMode: learningMode,
      school: profile?.school || "THPT",
      score: calculatedScore,
      totalQuestions: questions.length,
      correctCount: fullCorrectCount,
      timeSpent: durationText,
      durationSeconds: timeSpentSeconds,
      isHomework: Boolean(isHomework),
      answers,
      createdAt: nowIso
    };

    // 1. GỬI QUA API ROUTE SERVER-SIDE (ĐẢM BẢO KHÔNG BỊ RLS CHẶN)
    try {
      const response = await fetch("/api/student/submit-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attemptPayload)
      });
      const resJson = await response.json();
      if (!response.ok) {
        console.warn("API Server phản hồi lỗi, kích hoạt fallback client:", resJson);
      }
    } catch (apiErr) {
      console.warn("Không kết nối được API Route, dùng client fallback:", apiErr);
    }

    // 2. FALLBACK TRỰC TIẾP TỪ SUPABASE CLIENT
    const clientRecord: any = {
      id: "att-" + Date.now(),
      quiz_id: String(quizId),
      quizId: String(quizId),
      exam_id: String(quizId),
      quiz_title: String(quizTitle),
      quizTitle: String(quizTitle),
      exam_title: String(quizTitle),
      examTitle: String(quizTitle),
      student_id: studentId,
      studentId: studentId,
      user_id: studentId,
      student_name: studentName,
      studentName: studentName,
      full_name: studentName,
      user_name: studentName,
      school: profile?.school || "THPT",
      score: calculatedScore,
      points: calculatedScore,
      total_questions: questions.length,
      totalQuestions: questions.length,
      correct_count: fullCorrectCount,
      correctCount: fullCorrectCount,
      time_spent: durationText,
      timeSpent: durationText,
      duration_seconds: timeSpentSeconds,
      is_homework: Boolean(isHomework),
      isHomework: Boolean(isHomework),
      type: isHomework ? "homework" : "practice",
      created_at: nowIso,
      createdAt: nowIso
    };

    try {
      await Promise.allSettled([
        supabase.from("exam_attempts").insert([clientRecord]),
        supabase.from("attempts").insert([clientRecord]),
        supabase.from("quiz_attempts").insert([clientRecord])
      ]);
    } catch (clientErr) {
      console.error("Lỗi Fallback Client:", clientErr);
    }

    // 3. PHÁT REALTIME CHO TOÀN BỘ CÁC TAB ADMIN ĐANG MỞ
    try {
      const channel = supabase.channel("admin-realtime-global-sync");
      channel.send({
        type: "broadcast",
        event: "new_attempt",
        payload: clientRecord
      });
    } catch (e) {}

    // 4. LƯU LOCALSTORAGE ĐỂ PHỤC VỤ HIỂN THỊ OFFLINE
    if (typeof window !== "undefined") {
      try {
        const savedAttempts = localStorage.getItem("edunexus_attempts");
        const parsed = savedAttempts ? JSON.parse(savedAttempts) : [];
        const updatedAttempts = [clientRecord, ...parsed];
        localStorage.setItem("edunexus_attempts", JSON.stringify(updatedAttempts));
        window.dispatchEvent(new Event("storage"));

        const studentPastAttempts = updatedAttempts.filter(
          (a: any) => (a.studentId === studentId || a.studentName === studentName) && (a.quizId === quizId || a.quizTitle === quizTitle)
        );
        setHistoryAttemptsCount(studentPastAttempts.length);

        const examAttempts = updatedAttempts.filter((a: any) => a.quizId === quizId || a.quizTitle === quizTitle);
        const sorted = [...examAttempts].sort((a, b) => b.score - a.score || a.duration_seconds - b.duration_seconds);
        setRankingList(sorted.slice(0, 10));
      } catch (e) {}
    }

    setIsSubmitting(false);
  };

  const handleRetake = () => {
    setUserAnswers({});
    setCurrentIdx(0);
    setIsSubmitted(false);
    setShowResultModal(false);
    setIsReviewMode(false);
    setIsMobileDrawerOpen(false);
    setSecondsRemaining(!isHomework && durationMinutes > 0 ? durationMinutes * 60 : 0);
    setTimeSpentSeconds(0);
  };

  const handleViewSolutions = () => {
    setShowResultModal(false);
    setIsReviewMode(true);
    setCurrentIdx(0);
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  };

  const answeredCount = useMemo(() => {
    return Object.keys(userAnswers).filter(k => {
      const val = userAnswers[k];
      if (val === undefined || val === null || val === "") return false;
      if (typeof val === "object") return Object.keys(val).length > 0;
      return true;
    }).length;
  }, [userAnswers]);

  const renderQuestionOptions = (q: QuestionItem) => {
    const isTF = isQuestionTrueFalse(q);
    const isShort = isQuestionShortAnswer(q);

    // DẠNG TRẢ LỜI NGẮN
    if (isShort) {
      const currentAns = userAnswers[q.id] || "";
      const isCorrect = isReviewMode && normalizeShortAnswer(currentAns) === normalizeShortAnswer(q.correctAnswer);

      return (
        <div className="pt-2 space-y-3">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-2">
              <PenLine className="w-4 h-4 text-[#1D4ED8]" />
              <span>Điền đáp án câu trả lời ngắn:</span>
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                disabled={isSubmitted && !isReviewMode}
                value={currentAns}
                onChange={(e) => handleShortAnswerChange(q.id, e.target.value)}
                placeholder="Nhập kết quả (số hoặc biểu thức ngắn)..."
                className={"flex-1 p-3 bg-white border-2 rounded-xl text-sm font-bold outline-none transition " + (
                  isReviewMode
                    ? isCorrect
                      ? "border-emerald-500 bg-emerald-50/50 text-emerald-900"
                      : "border-rose-400 bg-rose-50/50 text-rose-900"
                    : currentAns
                    ? "border-[#1D4ED8] text-blue-950 focus:ring-2 focus:ring-blue-100"
                    : "border-slate-200 text-slate-800 focus:border-[#1D4ED8]"
                )}
              />
              {currentAns && !isReviewMode && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 shrink-0 text-center">
                  Đã ghi nhận ✓
                </span>
              )}
            </div>

            {isReviewMode && (
              <div className="pt-2 flex flex-wrap items-center gap-3 text-xs font-bold">
                <span className="text-slate-500">Đáp án chuẩn:</span>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-300">
                  {q.correctAnswer}
                </span>
                {isCorrect ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Chính xác (+1.0 điểm)
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> Chưa đúng
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // DẠNG ĐÚNG / SAI
    if (isTF) {
      const userTF = (typeof userAnswers[q.id] === "object" && userAnswers[q.id]) ? userAnswers[q.id] : {};
      const cleanAns = (q.correctAnswer || "").replace(/[^A-Za-zĐđSsTtFf]/g, "").toUpperCase();

      return (
        <div className="pt-2">
          <div className="overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-2xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3 sm:px-4 text-left font-semibold">Phát biểu</th>
                  <th className="py-2.5 px-2 sm:px-3 text-center w-16 sm:w-20 font-semibold text-emerald-600">Đúng</th>
                  <th className="py-2.5 px-2 sm:px-3 text-center w-16 sm:w-20 font-semibold text-rose-600">Sai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {q.options.map((opt, optIdx) => {
                  const optKeyLower = opt.key.toLowerCase();
                  const selectedVal = userTF[optKeyLower];
                  const expectedChar = cleanAns[optIdx] || "Đ";
                  const expectedVal = (expectedChar === "Đ" || expectedChar === "D" || expectedChar === "T") ? "T" : "F";

                  return (
                    <tr key={opt.key} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 sm:px-4 align-middle">
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-[#1D4ED8] shrink-0 mt-0.5">{opt.key})</span>
                          <div className="flex-1">
                            <MathRenderer content={opt.text} mediaMap={mediaMap} inline={true} />
                          </div>
                        </div>
                      </td>
                      
                      <td className="py-3 px-2 sm:px-3 text-center align-middle">
                        <button
                          type="button"
                          disabled={isSubmitted && !isReviewMode}
                          onClick={() => handleSelectTrueFalseOption(q.id, opt.key, "T")}
                          className={"w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center mx-auto transition-all cursor-pointer " + (
                            isReviewMode
                              ? (expectedVal === "T"
                                  ? "bg-emerald-500 border-emerald-600 text-white shadow-xs"
                                  : selectedVal === "T"
                                  ? "bg-rose-500 border-rose-600 text-white shadow-xs"
                                  : "border-slate-200 text-slate-300 opacity-60")
                              : (selectedVal === "T"
                                  ? "bg-emerald-500 border-emerald-600 text-white shadow-xs scale-105"
                                  : "border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/40 text-slate-400")
                          )}
                        >
                          {isReviewMode ? (
                            expectedVal === "T" ? <Check className="w-4 h-4 stroke-[3]" /> : selectedVal === "T" ? <X className="w-4 h-4 stroke-[3]" /> : null
                          ) : (
                            selectedVal === "T" ? <Check className="w-4 h-4 stroke-[3]" /> : null
                          )}
                        </button>
                      </td>

                      <td className="py-3 px-2 sm:px-3 text-center align-middle">
                        <button
                          type="button"
                          disabled={isSubmitted && !isReviewMode}
                          onClick={() => handleSelectTrueFalseOption(q.id, opt.key, "F")}
                          className={"w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center mx-auto transition-all cursor-pointer " + (
                            isReviewMode
                              ? (expectedVal === "F"
                                  ? "bg-rose-500 border-rose-600 text-white shadow-xs"
                                  : selectedVal === "F"
                                  ? "bg-rose-500 border-rose-600 text-white shadow-xs"
                                  : "border-slate-200 text-slate-300 opacity-60")
                              : (selectedVal === "F"
                                  ? "bg-rose-500 border-rose-600 text-white shadow-xs scale-105"
                                  : "border-slate-200 hover:border-rose-300 bg-white hover:bg-rose-50/40 text-slate-400")
                          )}
                        >
                          {isReviewMode ? (
                            expectedVal === "F" ? <Check className="w-4 h-4 stroke-[3]" /> : selectedVal === "F" ? <X className="w-4 h-4 stroke-[3]" /> : null
                          ) : (
                            selectedVal === "F" ? <Check className="w-4 h-4 stroke-[3]" /> : null
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // DẠNG TRẮC NGHIỆM ĐƠN A, B, C, D
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {q.options.map(opt => {
          const isSelected = userAnswers[q.id] === opt.key;
          const isCorrect = isReviewMode && opt.key === q.correctAnswer;
          const isWrongSelected = isReviewMode && isSelected && !isCorrect;

          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => handleSelectOption(q.id, opt.key)}
              disabled={isSubmitted && !isReviewMode}
              className={"p-3 sm:p-4 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer " + (
                isCorrect
                  ? "bg-emerald-50/90 border-emerald-500 text-emerald-950 font-medium"
                  : isWrongSelected
                  ? "bg-rose-50/90 border-rose-400 text-rose-950 font-medium"
                  : isSelected
                  ? "bg-blue-50/80 border-[#1D4ED8] text-blue-950 font-medium"
                  : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/50"
              )}
            >
              <span className={"w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 border " + (
                isSelected
                  ? "bg-[#1D4ED8] text-white border-[#1D4ED8]"
                  : "bg-slate-50 text-slate-700 border-slate-200"
              )}>
                {opt.key}
              </span>
              <div className="flex-1 min-w-0">
                <MathRenderer content={opt.text} mediaMap={mediaMap} inline={true} />
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-900/60 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="font-bold text-sm tracking-wide">Đang tải câu hỏi & dữ liệu bài thi...</p>
      </div>
    );
  }

  const currentQ = questions[currentIdx] || questions[0];

  return (
    <div
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Plus Jakarta Sans", sans-serif'
      }}
      className="fixed inset-0 z-[120] bg-[#F8FAFC] text-slate-800 flex flex-col overflow-hidden"
    >
      {/* 1. THANH HEADER TRÊN CÙNG */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-white border-b border-slate-200 shadow-xs flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (!isSubmitted) {
                if (confirm("Bạn có muốn thoát khỏi phòng làm bài?")) {
                  onBackToDashboard();
                }
              } else {
                onBackToDashboard();
              }
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition flex items-center cursor-pointer shrink-0"
            title="Thoát phòng thi"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
          </button>
          
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[130px] sm:max-w-xs md:max-w-md">
              {quizTitle}
            </h2>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-slate-500">
              <span className={isHomework ? "text-emerald-600 font-bold" : "text-[#1D4ED8] font-bold"}>
                {isHomework ? "BÀI TẬP VỀ NHÀ" : "LUYỆN ĐỀ THỰC CHIẾN"}
              </span>
              <span className="hidden sm:inline">• {profile?.full_name}</span>
            </div>
          </div>
        </div>

        {/* ĐỒNG HỒ THỜI GIAN */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 text-white rounded-xl shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-xs sm:text-sm font-black tracking-tight font-mono">
            {isHomework ? formatTimer(timeSpentSeconds) + " (Tự do)" : (durationMinutes > 0 ? formatTimer(secondsRemaining) : formatTimer(timeSpentSeconds))}
          </span>
        </div>

        {/* NÚT THAO TÁC */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {!isSubmitted ? (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmitExam()}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang nộp...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>{isHomework ? "Nộp bài tập" : "Nộp bài"} <span className="hidden sm:inline">({answeredCount}/{questions.length})</span></span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-xs flex items-center gap-1 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Trang chủ</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. VÙNG LÀM BÀI CHÍNH */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden relative">
        <main className="lg:col-span-9 p-3 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar flex flex-col justify-between">
          <div className="max-w-4xl w-full mx-auto space-y-4 sm:space-y-6 pb-20 lg:pb-0">
            
            {isHomework && (
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  Chế độ BTVN: Tự do làm bài, hệ thống tự động lưu kết quả khi nộp.
                </span>
                <span className="text-[11px] font-bold bg-white px-2 py-0.5 rounded border border-emerald-300">
                  Đã làm {answeredCount}/{questions.length} câu ✓
                </span>
              </div>
            )}

            {layoutMode === "single" ? (
              <div className="bg-white rounded-2xl p-4 sm:p-7 border border-slate-200/90 shadow-2xs space-y-4 text-left">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-[#1D4ED8]">
                    {"Câu " + (currentIdx + 1) + " / " + questions.length}
                    {isQuestionTrueFalse(currentQ) ? (
                      <span className="ml-2 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">
                        Đúng / Sai
                      </span>
                    ) : isQuestionShortAnswer(currentQ) ? (
                      <span className="ml-2 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200">
                        Trả lời ngắn
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {Boolean(userAnswers[currentQ.id]) ? "Đã trả lời" : "Chưa làm"}
                  </span>
                </div>

                <div className="py-1">
                  <MathRenderer content={currentQ.prompt} mediaMap={mediaMap} />
                </div>

                {renderQuestionOptions(currentQ)}

                {isReviewMode && currentQ.explanation && (
                  <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-1 text-xs">
                    <p className="font-bold text-[#1D4ED8] flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5" /> Lời giải chi tiết:
                    </p>
                    <div className="text-slate-700 leading-relaxed font-normal">
                      <MathRenderer content={currentQ.explanation} mediaMap={mediaMap} />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
                    disabled={currentIdx === 0}
                    className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Câu trước
                  </button>

                  <div className="flex items-center gap-2">
                    {currentIdx < questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))}
                        className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                      >
                        Câu tiếp <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      !isSubmitted && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleSubmitExam()}
                          className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-60"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Đang nộp...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" /> Hoàn tất
                            </>
                          )}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {questions.map((q, qIndex) => (
                  <div
                    key={q.id}
                    id={"question-card-" + q.id}
                    className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-2xs space-y-3 text-left"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-[#1D4ED8]">
                        {"Câu " + (qIndex + 1) + " / " + questions.length}
                        {isQuestionTrueFalse(q) ? (
                          <span className="ml-2 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">
                            Đúng / Sai
                          </span>
                        ) : isQuestionShortAnswer(q) ? (
                          <span className="ml-2 px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200">
                            Trả lời ngắn
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {Boolean(userAnswers[q.id]) ? "Đã trả lời" : "Chưa làm"}
                      </span>
                    </div>

                    <div className="py-0.5">
                      <MathRenderer content={q.prompt} mediaMap={mediaMap} />
                    </div>

                    {renderQuestionOptions(q)}

                    {isReviewMode && q.explanation && (
                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-slate-800 space-y-1">
                        <p className="font-bold flex items-center gap-1 text-[#1D4ED8]">
                          <HelpCircle className="w-3.5 h-3.5" /> Lời giải chi tiết:
                        </p>
                        <div>
                          <MathRenderer content={q.explanation} mediaMap={mediaMap} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* 3. SIDEBAR MA TRẬN & THỜI GIAN TRÊN DESKTOP */}
        <aside className="hidden lg:flex lg:col-span-3 border-l border-slate-200 bg-white p-5 flex-col justify-between overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-1.5 text-left">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Thí sinh</span>
              <p className="text-sm font-bold text-slate-900 truncate">{profile?.full_name}</p>
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold pt-1 border-t border-slate-100">
                <span className="truncate">{profile?.school || "THPT"}</span>
                <span className="font-bold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded-md">{profile?.grade || "Lớp 12"}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900 text-white shadow-xs space-y-0.5 text-left">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                {isHomework ? "THỜI GIAN LÀM BÀI" : "THỜI GIAN CÒN LẠI"}
              </span>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-xl font-black tracking-tight font-mono">
                  {isHomework ? formatTimer(timeSpentSeconds) + " (Vô hạn)" : (durationMinutes > 0 ? formatTimer(secondsRemaining) : formatTimer(timeSpentSeconds))}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase">Danh sách câu</span>
                <span className="text-[11px] font-bold text-slate-400">{answeredCount}/{questions.length} câu</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {questions.map((q, idx) => {
                  const isCurrent = currentIdx === idx && layoutMode === "single";
                  const isAns = Boolean(userAnswers[q.id]);
                  return (
                    <button
                      type="button"
                      key={q.id}
                      onClick={() => {
                        setCurrentIdx(idx);
                        if (layoutMode === "scroll") {
                          const el = document.getElementById("question-card-" + q.id);
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        }
                      }}
                      className={"h-8 rounded-lg font-bold text-xs transition cursor-pointer border " + (
                        isCurrent
                          ? "bg-[#1D4ED8] text-white border-[#1D4ED8] shadow-xs"
                          : isAns
                          ? "bg-blue-50 text-[#1D4ED8] border-blue-200"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      )}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            {!isSubmitted ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmitExam()}
                className="w-full py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang nộp...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> {isHomework ? "Nộp BTVN" : "Nộp bài thi"}
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowResultModal(true)}
                className="w-full py-2.5 bg-blue-50 text-[#1D4ED8] hover:bg-blue-100 rounded-xl font-bold text-xs border border-blue-200 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5" /> Xem kết quả
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* 4. NÚT NỔI MA TRẬN CHO MOBILE */}
      <div className="lg:hidden fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-900/90 backdrop-blur-md text-white rounded-full shadow-lg border border-slate-700 font-bold text-xs active:scale-95 transition-all cursor-pointer"
        >
          <Grid3X3 className="w-4 h-4 text-blue-400" />
          <span>{answeredCount}/{questions.length}</span>
        </button>
      </div>

      {/* 5. DRAWER MOBILE */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <div
            onClick={() => setIsMobileDrawerOpen(false)}
            className="lg:hidden fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl max-h-[80vh] flex flex-col p-5 shadow-2xl border-t border-slate-100"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Grid3X3 className="w-5 h-5 text-[#1D4ED8]" />
                  <h3 className="font-black text-sm text-slate-900">Danh sách câu hỏi</h3>
                  <span className="text-xs font-bold text-slate-500">({answeredCount}/{questions.length} câu)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-2.5 flex items-center justify-between text-xs font-bold text-slate-600 bg-slate-50 px-3 rounded-xl my-2">
                <span>Thời gian:</span>
                <span className="text-[#1D4ED8] font-black font-mono">
                  {isHomework ? formatTimer(timeSpentSeconds) + " (Vô hạn)" : (durationMinutes > 0 ? formatTimer(secondsRemaining) : formatTimer(timeSpentSeconds))}
                </span>
              </div>

              <div className="overflow-y-auto custom-scrollbar my-2 max-h-[45vh] pr-1">
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                  {questions.map((q, idx) => {
                    const isCurrent = currentIdx === idx && layoutMode === "single";
                    const isAns = Boolean(userAnswers[q.id]);
                    return (
                      <button
                        type="button"
                        key={q.id}
                        onClick={() => {
                          setCurrentIdx(idx);
                          setIsMobileDrawerOpen(false);
                          if (layoutMode === "scroll") {
                            const el = document.getElementById("question-card-" + q.id);
                            if (el) el.scrollIntoView({ behavior: "smooth" });
                          }
                        }}
                        className={"h-10 rounded-xl font-bold text-xs transition cursor-pointer border " + (
                          isCurrent
                            ? "bg-[#1D4ED8] text-white border-[#1D4ED8] shadow-xs"
                            : isAns
                            ? "bg-blue-50 text-[#1D4ED8] border-blue-200"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        )}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  Đóng
                </button>
                {!isSubmitted && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      handleSubmitExam();
                    }}
                    className="flex-1 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang nộp...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> Nộp bài
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. MODAL KẾT QUẢ THI NGUYÊN BẢN */}
      <AnimatePresence>
        {showResultModal && (
          <div
            onClick={() => setShowResultModal(false)}
            className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm overflow-y-auto cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-8 border border-slate-200 shadow-2xl grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 cursor-default my-auto text-left"
            >
              <div className="md:col-span-6 flex flex-col justify-between space-y-4 sm:space-y-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-xs">
                    <Trophy className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:2xl font-black text-slate-900 tracking-tight">
                      {isHomework ? "Hoàn Thành BTVN!" : "Hoàn Thành Bài Thi!"}
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">{quizTitle}</p>
                  </div>
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#1D4ED8] block">
                        ĐIỂM ĐẠT ĐƯỢC
                      </span>
                      <span className="text-2xl sm:text-3xl font-black text-[#1D4ED8]">
                        {score.toFixed(1)} <span className="text-sm text-slate-400 font-bold">/ 10</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-600 block">
                        {"Đúng " + correctCount + "/" + questions.length + " câu trọn vẹn"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {"(" + historyAttemptsCount + " lần nộp)"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="flex-1 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Làm lại bài
                  </button>
                  <button
                    type="button"
                    onClick={handleViewSolutions}
                    className="flex-1 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#1D4ED8]" /> Xem đáp án
                  </button>
                  <button
                    type="button"
                    onClick={onBackToDashboard}
                    className="flex-1 py-2 text-slate-400 hover:text-slate-600 font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Home className="w-3.5 h-3.5" /> Trang chủ
                  </button>
                </div>
              </div>

              {/* BẢNG XẾP HẠNG */}
              <div className="md:col-span-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-200 md:pl-6 space-y-3">
                <div>
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 mb-2">
                    <Award className="w-4 h-4 text-amber-500" />
                    <h3 className="font-black text-xs sm:text-sm text-slate-900 tracking-tight">
                      Bảng Xếp Hạng Kết Quả
                    </h3>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-2.5">Hạng</th>
                          <th className="py-2 px-2.5">Học sinh</th>
                          <th className="py-2 px-2 text-center">Điểm</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        <tr className="bg-blue-50/60 font-bold text-[#1D4ED8]">
                          <td className="py-2 px-2.5">
                            <span className="w-4 h-4 rounded bg-[#1D4ED8] text-white flex items-center justify-center text-[9px] font-black">
                              1
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-black truncate max-w-[120px]">
                            {profile?.full_name} <span className="text-[8px] bg-blue-200 px-1 rounded">BẠN</span>
                          </td>
                          <td className="py-2 px-2 text-center font-black">
                            {score.toFixed(1)}
                          </td>
                        </tr>
                        {rankingList.filter(r => r.studentId !== (profile?.id || (profile as any)?.username)).map((r, idx) => (
                          <tr key={r.attemptId || r.id || idx} className="hover:bg-slate-50 text-slate-700">
                            <td className="py-1.5 px-2.5 font-semibold text-slate-400">{idx + 2}</td>
                            <td className="py-1.5 px-2.5 font-bold truncate max-w-[120px]">{r.studentName}</td>
                            <td className="py-1.5 px-2 text-center font-black text-slate-800">{Number(r.score).toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 italic text-center">
                  Bấm ra ngoài vùng hộp thoại để đóng bảng kết quả.
                </p>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ExamRoomView;
