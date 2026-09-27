"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle, 
  HelpCircle, ChevronLeft, ChevronRight, RotateCcw, 
  Eye, Trophy, Home, Send, List, LayoutGrid, Award, Check,
  ShieldAlert, ShieldCheck, Maximize2, Minimize2, X, Grid3X3
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

// BỘ RENDER CHUẨN XÁC: RENDER KATEX VÀ HÌNH ẢNH MINH HỌA/ĐỒ THỊ TỪ WORD
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
  const cleanContent = content.replace(/\\langle\s*\(\)\s*|\\langle\s*|\\rangle\s*|\\sqrt\{\s*\}|\(\)/g, "");
  const parts = cleanContent.split(/(\[img:[^\]]+\]|\$\$[\s\S]*?\$$|\$[\s\S]*?\$)/g);

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

        if (part.startsWith("$") && part.endsWith("$")) {
          const isBlock = part.startsWith("$$");
          const math = isBlock ? part.slice(2, -2).trim() : part.slice(1, -1).trim();
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
    prompt: "Cho hàm số $y = f(x)$ có đồ thị như hình vẽ. Hàm số đồng biến trên khoảng nào dưới đây?",
    options: [
      { key: "A", text: "$(0; 2)$" },
      { key: "B", text: "$(-\\infty; 0)$" },
      { key: "C", text: "$(2; +\\infty)$" },
      { key: "D", text: "$(-1; 1)$" }
    ],
    correctAnswer: "A",
    explanation: "Dựa vào đồ thị ta thấy hàm số đồng biến trên khoảng (0; 2)."
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
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [layoutMode, setLayoutMode] = useState<"single" | "scroll">("scroll");
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
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

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [fullscreenExitCount, setFullscreenExitCount] = useState<number>(0);
  const [showFullscreenWarningModal, setShowFullscreenWarningModal] = useState<boolean>(false);
  const [tabSwitchCount, setTabSwitchCount] = useState<number>(0);
  const [cheatWarning, setCheatWarning] = useState<string>("");

  const userAnswersRef = useRef<Record<string, string>>({});
  userAnswersRef.current = userAnswers;

  const enterFullscreen = useCallback(() => {
    try {
      if (typeof document !== "undefined" && !document.fullscreenElement) {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          elem.requestFullscreen().catch(() => {});
        } else if ((elem as any).webkitRequestFullscreen) {
          (elem as any).webkitRequestFullscreen();
        } else if ((elem as any).msRequestFullscreen) {
          (elem as any).msRequestFullscreen();
        }
      }
    } catch (err) {}
  }, []);

  const exitFullscreen = useCallback(() => {
    try {
      if (typeof document !== "undefined" && document.fullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      }
    } catch (err) {}
  }, []);

  useEffect(() => {
    enterFullscreen();
  }, [enterFullscreen]);

  useEffect(() => {
    if (isSubmitted || isReviewMode) return;

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(isCurrentlyFullscreen);

      if (!isCurrentlyFullscreen && !isSubmitted && !isReviewMode) {
        setFullscreenExitCount(prev => {
          const nextCount = prev + 1;
          if (nextCount >= 2) {
            setCheatWarning("CẢNH BÁO TỐI CAO: Bạn đã thoát chế độ Toàn Màn hình quá 2 lần! Hệ thống đang tự động thu bài và khóa bài thi.");
            setTimeout(() => {
              handleSubmitExam(undefined, nextCount);
            }, 1200);
          } else {
            setShowFullscreenWarningModal(true);
            setCheatWarning("Cảnh báo: Bạn vừa thoát chế độ Toàn Màn hình! Vui lòng quay lại ngay (Vi phạm 1/2 lần).");
          }
          return nextCount;
        });
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isSubmitted, isReviewMode]);

  useEffect(() => {
    if (isSubmitted || isReviewMode) return;

    const handleFocusLoss = () => {
      if (document.hidden || !document.hasFocus()) {
        setTabSwitchCount(prev => {
          const nextCount = prev + 1;
          if (nextCount >= 2) {
            setCheatWarning("CẢNH BÁO TỐI CAO: Bạn đã rời khỏi màn hình làm bài lần 2! Hệ thống đang tự động thu bài.");
            setTimeout(() => {
              handleSubmitExam(nextCount);
            }, 1200);
          } else {
            setCheatWarning("Cảnh báo vi phạm: Bạn đã rời khỏi màn hình làm bài (" + nextCount + "/2 lần)!");
          }
          return nextCount;
        });
      }
    };

    document.addEventListener("visibilitychange", handleFocusLoss);
    window.addEventListener("blur", handleFocusLoss);

    return () => {
      document.removeEventListener("visibilitychange", handleFocusLoss);
      window.removeEventListener("blur", handleFocusLoss);
    };
  }, [isSubmitted, isReviewMode]);

  useEffect(() => {
    if (isSubmitted || isReviewMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F12") {
        e.preventDefault();
        setCheatWarning("Hành động bị cấm: Phím F12 đã bị vô hiệu hóa.");
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === "c" || k === "v" || k === "u" || (e.shiftKey && (k === "i" || k === "j" || k === "c"))) {
          e.preventDefault();
          setCheatWarning("Hành động bị cấm: Phím tắt đã bị vô hiệu hóa để bảo mật đề thi.");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitted, isReviewMode]);

  useEffect(() => {
    if (cheatWarning) {
      const timer = setTimeout(() => setCheatWarning(""), 4500);
      return () => clearTimeout(timer);
    }
  }, [cheatWarning]);

  // NẠP ĐỀ THI TỪ SUPABASE HOẶC LOCALSTORAGE (KÈM MEDIAMAP ẢNH)
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
            targetExam = exams.find((e: any) => e.id === quizId);
          }
        }

        if (!targetExam) {
          const { data: courseRow } = await supabase.from("courses").select("chapters").limit(1).maybeSingle();
          if (courseRow && Array.isArray(courseRow.chapters)) {
            for (const chap of courseRow.chapters) {
              for (const les of chap.lessons || []) {
                const foundHw = (les.homework_files || []).find((f: any) => f.id === quizId);
                const foundTest = (les.test_quizzes || []).find((f: any) => f.id === quizId);
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
              (sec.questions || []).forEach((q: any) => {
                loaded.push({
                  id: q.id || ("q-" + qIdx),
                  order: qIdx++,
                  prompt: q.prompt_html || q.prompt || "",
                  options: (q.options || []).map((opt: any) => ({
                    key: opt.key,
                    text: opt.text_html || opt.text || ""
                  })),
                  correctAnswer: q.correct_answer || "A",
                  explanation: q.solution_html || q.solution || "Đang cập nhật lời giải chi tiết."
                });
              });
            });
          } else if (targetExam.questions && Array.isArray(targetExam.questions)) {
            loaded = targetExam.questions.map((q: any, idx: number) => ({
              id: q.id || ("q-" + (idx + 1)),
              order: idx + 1,
              prompt: q.prompt_html || q.prompt || ("Câu " + (idx + 1)),
              options: (q.options || []).map((opt: any) => ({
                key: opt.key,
                text: opt.text_html || opt.text || ""
              })),
              correctAnswer: q.correct_answer || "A",
              explanation: q.solution_html || q.solution || "Đang cập nhật lời giải chi tiết."
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
  }, [quizId]);

  useEffect(() => {
    if (isSubmitted || isReviewMode) return;

    const timer = setInterval(() => {
      setTimeSpentSeconds(prev => prev + 1);
      if (durationMinutes > 0) {
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
  }, [isSubmitted, isReviewMode, durationMinutes]);

  const handleSelectOption = (questionId: string, optionKey: string) => {
    if (isSubmitted && !isReviewMode) return;
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: optionKey
    }));
  };

  const handleSubmitExam = (overrideTabSwitches?: number, overrideFullscreenExits?: number) => {
    exitFullscreen();
    setShowFullscreenWarningModal(false);
    setIsMobileDrawerOpen(false);

    const switches = typeof overrideTabSwitches === "number" ? overrideTabSwitches : tabSwitchCount;
    const exits = typeof overrideFullscreenExits === "number" ? overrideFullscreenExits : fullscreenExitCount;

    const answers = userAnswersRef.current;
    let correct = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correctAnswer) {
        correct += 1;
      }
    });

    const calculatedScore = Number(((correct / (questions.length || 1)) * 10).toFixed(1));
    setScore(calculatedScore);
    setCorrectCount(correct);
    setIsSubmitted(true);
    setShowResultModal(true);

    if (typeof window !== "undefined") {
      try {
        const savedAttempts = localStorage.getItem("edunexus_attempts");
        const parsed = savedAttempts ? JSON.parse(savedAttempts) : [];
        const newAttempt = {
          attemptId: "att-" + Date.now(),
          studentId: profile?.id || "stu-current",
          studentName: profile?.full_name || "Trương Ngọc Quang",
          school: profile?.school || "THPT Chuyên",
          quizId,
          quizTitle,
          score: calculatedScore,
          totalQuestions: questions.length,
          correctCount: correct,
          timeSpentSeconds,
          tabSwitchCount: switches,
          fullscreenExitCount: exits,
          isHomework: Boolean(isHomework),
          submittedAt: new Date().toISOString()
        };

        const updatedAttempts = [newAttempt, ...parsed];
        localStorage.setItem("edunexus_attempts", JSON.stringify(updatedAttempts));
        window.dispatchEvent(new Event("storage"));

        const studentPastAttempts = updatedAttempts.filter(
          (a: any) => a.studentId === profile?.id && a.quizId === quizId
        );
        setHistoryAttemptsCount(studentPastAttempts.length);

        const examAttempts = updatedAttempts.filter((a: any) => a.quizId === quizId);
        const sorted = [...examAttempts].sort((a, b) => b.score - a.score || a.timeSpentSeconds - b.timeSpentSeconds);
        setRankingList(sorted.slice(0, 10));
      } catch (e) {}
    }
  };

  const handleRetake = () => {
    setUserAnswers({});
    setCurrentIdx(0);
    setIsSubmitted(false);
    setShowResultModal(false);
    setIsReviewMode(false);
    setTabSwitchCount(0);
    setFullscreenExitCount(0);
    setShowFullscreenWarningModal(false);
    setIsMobileDrawerOpen(false);
    setSecondsRemaining(durationMinutes > 0 ? durationMinutes * 60 : 0);
    setTimeSpentSeconds(0);
    enterFullscreen();
  };

  const handleViewSolutions = () => {
    exitFullscreen();
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
    return Object.keys(userAnswers).length;
  }, [userAnswers]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-900/60 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin mb-4" />
        <p className="font-bold text-sm tracking-wide">Đang tải cấu trúc đề thi & hình vẽ minh họa...</p>
      </div>
    );
  }

  const currentQ = questions[currentIdx] || questions[0];

  return (
    <div 
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onPaste={(e) => e.preventDefault()}
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Plus Jakarta Sans", sans-serif'
      }}
      className="fixed inset-0 z-[120] bg-[#F8FAFC] text-slate-800 flex flex-col overflow-hidden select-none"
    >
      {/* 1. CẢNH BÁO VI PHẠM GIAN LẬN */}
      <AnimatePresence>
        {cheatWarning && (
          <motion.div
            initial={{ opacity: 0, y: -24, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -24, x: "-50%" }}
            className="fixed top-3 left-1/2 z-[600] bg-rose-600 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 font-bold text-xs sm:text-sm border border-rose-400 max-w-[90vw] text-center"
          >
            <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-white shrink-0 animate-bounce" />
            <span className="truncate">{cheatWarning}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. MODAL CẢNH BÁO THOÁT TOÀN MÀN HÌNH */}
      <AnimatePresence>
        {showFullscreenWarningModal && !isSubmitted && (
          <div className="fixed inset-0 z-[700] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 text-center space-y-4 border-2 border-rose-500 shadow-2xl"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <ShieldAlert className="w-8 h-8 animate-bounce" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg sm:text-xl font-black text-rose-600 uppercase">
                  Cảnh Báo Vi Phạm Quy Chế
                </h3>
                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  Bạn vừa thoát Toàn Màn hình (Vi phạm 1/2 lần)!
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
                  Nếu tái diễn hoặc chuyển tab lần 2, hệ thống sẽ tự động khóa và nộp bài làm của bạn.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  enterFullscreen();
                  setShowFullscreenWarningModal(false);
                }}
                className="w-full py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
                <span>QUAY LẠI TOÀN MÀN HÌNH NGAY</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. THANH BAR GỌN GÀNG TRÊN CÙNG (RESPONSIVE CHO TẤT CẢ THIẾT BỊ) */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-white border-b border-slate-200 shadow-xs flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (!isSubmitted) {
                if (confirm("Bạn có chắc muốn thoát phòng thi? Bài làm hiện tại sẽ được nộp để tính điểm!")) {
                  handleSubmitExam();
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
              <span className="text-[#1D4ED8] font-bold">{isHomework ? "BTVN" : "Thi thử"}</span>
              <span className="hidden sm:inline">• {profile?.full_name}</span>
            </div>
          </div>
        </div>

        {/* Cụm thông tin giữa: Đồng hồ thời gian nhỏ gọn */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 text-white rounded-xl shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span className="text-xs sm:text-sm font-black tracking-tight font-mono">
            {durationMinutes > 0 ? formatTimer(secondsRemaining) : formatTimer(timeSpentSeconds)}
          </span>
        </div>

        {/* Cụm nút thao tác phải */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* Nút bật/tắt toàn màn hình trên desktop */}
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) exitFullscreen();
              else enterFullscreen();
            }}
            className="hidden sm:flex p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
            title="Toàn màn hình"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Nút nộp bài trực tiếp trên top bar */}
          {!isSubmitted ? (
            <button
              type="button"
              onClick={() => handleSubmitExam()}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs flex items-center gap-1 cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Nộp bài <span className="hidden sm:inline">({answeredCount}/{questions.length})</span></span>
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

      {/* 4. VÙNG LÀM BÀI CHÍNH */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden relative">
        <main className="lg:col-span-9 p-3 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar flex flex-col justify-between">
          <div className="max-w-4xl w-full mx-auto space-y-4 sm:space-y-6 pb-20 lg:pb-0">
            {layoutMode === "single" ? (
              <div className="bg-white rounded-2xl p-4 sm:p-7 border border-slate-200/90 shadow-2xs space-y-4 text-left">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-[#1D4ED8]">
                    {"Câu " + (currentIdx + 1) + " / " + questions.length}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {userAnswers[currentQ.id] ? "Đã chọn: " + userAnswers[currentQ.id] : "Chưa làm"}
                  </span>
                </div>

                <div className="py-1">
                  <MathRenderer content={currentQ.prompt} mediaMap={mediaMap} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {currentQ.options.map(opt => {
                    const isSelected = userAnswers[currentQ.id] === opt.key;
                    const isCorrect = isReviewMode && opt.key === currentQ.correctAnswer;
                    const isWrongSelected = isReviewMode && isSelected && !isCorrect;

                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => handleSelectOption(currentQ.id, opt.key)}
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
                          onClick={() => handleSubmitExam()}
                          className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" /> Nộp bài
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
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        {userAnswers[q.id] ? "Đã chọn: " + userAnswers[q.id] : "Chưa làm"}
                      </span>
                    </div>

                    <div className="py-0.5">
                      <MathRenderer content={q.prompt} mediaMap={mediaMap} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      {q.options.map(opt => {
                        const isSelected = userAnswers[q.id] === opt.key;
                        const isCorrect = isReviewMode && q.correctAnswer === opt.key;
                        const isWrongSelected = isReviewMode && isSelected && !isCorrect;

                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => handleSelectOption(q.id, opt.key)}
                            disabled={isSubmitted && !isReviewMode}
                            className={"p-3 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer " + (
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

        {/* 5. SIDEBAR MA TRẬN & THỜI GIAN TRÊN DESKTOP (lg:flex) */}
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
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Thời gian</span>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-xl font-black tracking-tight font-mono">
                  {durationMinutes > 0 ? formatTimer(secondsRemaining) : formatTimer(timeSpentSeconds)}
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
                onClick={() => handleSubmitExam()}
                className="w-full py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" /> Nộp bài thi
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

      {/* 6. NÚT NỔI BÊN PHẢI MÀN HÌNH MỞ MA TRẬN CÂU HỎI TRÊN MOBILE/IPAD */}
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

      {/* 7. DRAWER MA TRẬN CÂU HỎI CHO MOBILE & IPAD (TRƯỢT LÊN TỪ ĐÁY) */}
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
                  <span className="text-xs font-bold text-slate-500">({answeredCount}/{questions.length} đã làm)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-3 flex items-center justify-between text-xs font-bold text-slate-600 bg-slate-50 px-3 rounded-xl my-2">
                <span>Thời gian làm bài:</span>
                <span className="text-[#1D4ED8] font-black font-mono">
                  {durationMinutes > 0 ? formatTimer(secondsRemaining) : formatTimer(timeSpentSeconds)}
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
                  Đóng lại
                </button>
                {!isSubmitted && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      handleSubmitExam();
                    }}
                    className="flex-1 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" /> Nộp bài ngay
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. MODAL KẾT QUẢ THI */}
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
                    <h3 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                      Hoàn Thành Bài Thi!
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
                        {"Đúng " + correctCount + "/" + questions.length + " câu"}
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
                      Bảng Xếp Hạng Đề Thi
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
                        {rankingList.filter(r => r.studentId !== profile?.id).map((r, idx) => (
                          <tr key={r.attemptId || idx} className="hover:bg-slate-50 text-slate-700">
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
