"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle, 
  HelpCircle, ChevronLeft, ChevronRight, RotateCcw, 
  Eye, Trophy, Home, Send, List, LayoutGrid, Award, Check,
  ShieldAlert, ShieldCheck, Maximize2, Minimize2
} from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Profile } from "@/types";

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

// BỘ RENDER CHỮ THƯỜNG GỌN GÀNG, KHÔNG IN ĐẬM THÔ CỨNG
function MathRenderer({ content, inline = false }: { content: string; inline?: boolean }) {
  if (!content) return null;
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);

  return (
    <span className={inline ? "inline align-middle text-[14px] font-normal text-slate-700" : "block leading-relaxed text-[14.5px] font-normal text-slate-800"}>
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith("$") && part.endsWith("$")) {
          const isBlock = part.startsWith("$$");
          const math = isBlock ? part.slice(2, -2).trim() : part.slice(1, -1).trim();
          try {
            return (
              <span
                key={i}
                className={isBlock ? "block my-2 text-center" : "inline-block align-middle px-0.5 text-[15px] font-serif"}
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
    prompt: "Cho hình chóp $S.ABC$ có $SA$ vuông góc với mặt phẳng $(ABC)$, $SA = a\\sqrt{2}$, $AB = a\\sqrt{2}$ (xem hình minh họa). Góc giữa đường thẳng $SB$ và mặt phẳng $(ABC)$ bằng:",
    options: [
      { key: "A", text: "$45^\\circ$" },
      { key: "B", text: "$30^\\circ$" },
      { key: "C", text: "$60^\\circ$" },
      { key: "D", text: "$90^\\circ$" }
    ],
    correctAnswer: "A",
    explanation: "Vì SA ⊥ (ABC) nên hình chiếu vuông góc của SB lên mặt phẳng (ABC) là AB. Do đó góc giữa SB và (ABC) là góc SBA. Xét tam giác SAB vuông tại A: tan(SBA) = SA / AB = (a√2) / (a√2) = 1 => góc SBA = 45°."
  },
  {
    id: "q-2",
    order: 2,
    prompt: "Cho hàm số $y = f(x)$ có đạo hàm $f'(x) = x(x - 1)^2(x + 2)^3$. Số điểm cực trị của hàm số đã cho là:",
    options: [
      { key: "A", text: "1" },
      { key: "B", text: "2" },
      { key: "C", text: "3" },
      { key: "D", text: "4" }
    ],
    correctAnswer: "B",
    explanation: "Đạo hàm f'(x) đổi dấu qua các nghiệm bội lẻ. Ở đây x = 0 (bội 1) và x = -2 (bội 3) là các nghiệm bội lẻ. Còn x = 1 (bội 2) là nghiệm bội chẵn nên qua đó f'(x) không đổi dấu. Vậy hàm số có đúng 2 điểm cực trị."
  },
  {
    id: "q-3",
    order: 3,
    prompt: "Giá trị lớn nhất của hàm số $f(x) = x^3 - 3x + 2$ trên đoạn $[0; 2]$ bằng:",
    options: [
      { key: "A", text: "2" },
      { key: "B", text: "0" },
      { key: "C", text: "4" },
      { key: "D", text: "1" }
    ],
    correctAnswer: "C",
    explanation: "Ta có f'(x) = 3x² - 3 = 0 <=> x = 1. Trên đoạn [0; 2], ta xét các điểm: f(0) = 2, f(1) = 0, f(2) = 4. Do đó giá trị lớn nhất bằng 4 tại x = 2."
  },
  {
    id: "q-4",
    order: 4,
    prompt: "Trong không gian $Oxyz$, mặt cầu $(S): (x - 1)^2 + (y + 2)^2 + (z - 3)^2 = 16$ có tọa độ tâm $I$ và bán kính $R$ lần lượt là:",
    options: [
      { key: "A", text: "$I(1; -2; 3), R = 4$" },
      { key: "B", text: "$I(-1; 2; -3), R = 4$" },
      { key: "C", text: "$I(1; -2; 3), R = 16$" },
      { key: "D", text: "$I(-1; 2; -3), R = 16$" }
    ],
    correctAnswer: "A",
    explanation: "Phương trình mặt cầu dạng (x - a)² + (y - b)² + (z - c)² = R² có tâm I(a; b; c) và bán kính R. Ở đây a = 1, b = -2, c = 3 và R = √16 = 4."
  },
  {
    id: "q-5",
    order: 5,
    prompt: "Tập nghiệm của bất phương trình $\\log_2(x - 1) < 3$ là:",
    options: [
      { key: "A", text: "$(1; 9)$" },
      { key: "B", text: "$(-\\infty; 9)$" },
      { key: "C", text: "$(1; 8)$" },
      { key: "D", text: "$[1; 9)$" }
    ],
    correctAnswer: "A",
    explanation: "Điều kiện xác định: x - 1 > 0 <=> x > 1. BPT tương đương: x - 1 < 2³ = 8 <=> x < 9. Kết hợp điều kiện ta được tập nghiệm là (1; 9)."
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [layoutMode, setLayoutMode] = useState<"single" | "scroll">("scroll");

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
            setCheatWarning("CẢNH BÁO TỐI CAO: Bạn đã rời khỏi màn hình làm bài lần 2! Hệ thống đang tự động thu bài và khóa đề thi.");
            setTimeout(() => {
              handleSubmitExam(nextCount);
            }, 1200);
          } else {
            setCheatWarning("Cảnh báo vi phạm: Bạn đã rời khỏi màn hình làm bài (" + nextCount + "/2 lần)! Vi phạm sẽ bị ghi nhận.");
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
        setCheatWarning("Hành động bị cấm: Phím F12 (Developer Tools) đã bị vô hiệu hóa.");
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === "c" || k === "v" || k === "u" || (e.shiftKey && (k === "i" || k === "j" || k === "c"))) {
          e.preventDefault();
          setCheatWarning("Hành động bị cấm: Phím tắt Ctrl+" + k.toUpperCase() + " đã bị vô hiệu hóa để bảo mật đề thi.");
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

  useEffect(() => {
    setIsLoading(true);
    let loaded: QuestionItem[] = [];

    if (typeof window !== "undefined") {
      try {
        const savedPractice = localStorage.getItem("edunexus_practice_exams");
        if (savedPractice) {
          const exams = JSON.parse(savedPractice);
          const found = exams.find((e: any) => e.id === quizId);
          if (found && found.questions && found.questions.length > 0) {
            loaded = found.questions.map((q: any, idx: number) => ({
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
      } catch (e) {}
    }

    if (loaded.length === 0) {
      loaded = DEFAULT_QUESTIONS;
    }

    setQuestions(loaded);
    setIsLoading(false);
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
        <p className="font-bold text-sm tracking-wide">Đang tải cấu trúc đề thi...</p>
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
            className="fixed top-5 left-1/2 z-[600] bg-rose-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-xs sm:text-sm border border-rose-400 max-w-xl text-center"
          >
            <ShieldAlert className="w-5 h-5 text-white shrink-0 animate-bounce" />
            <span>{cheatWarning}</span>
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
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 text-center space-y-5 border-2 border-rose-500 shadow-2xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
                <ShieldAlert className="w-9 h-9 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-rose-600 uppercase tracking-tight">
                  Cảnh Báo Vi Phạm Quy Chế Thi
                </h3>
                <p className="text-xs sm:text-sm font-bold text-slate-800 leading-relaxed">
                  Bạn vừa thoát khỏi chế độ Toàn Màn hình (Vi phạm 1/2 lần)!
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Quy chế thi yêu cầu bạn phải giữ toàn màn hình liên tục. Nếu tái diễn lần 2 hoặc rời màn hình, bài làm sẽ tự động bị thu và tính điểm ngay lập tức.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  enterFullscreen();
                  setShowFullscreenWarningModal(false);
                }}
                className="w-full py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-black text-xs sm:text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
                <span>QUAY LẠI TOÀN MÀN HÌNH NGAY</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. HEADER PHÒNG THI */}
      <header className="h-16 px-4 sm:px-6 bg-white border-b border-slate-200 shadow-xs flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
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
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition flex items-center gap-1 cursor-pointer"
            title="Quay lại bảng điều khiển"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate">{quizTitle}</h2>
            <p className="text-[11px] font-semibold text-[#1D4ED8]">
              {isHomework ? "BÀI TẬP VỀ NHÀ" : "CHẾ ĐỘ: THI ĐỊNH KỲ"}
              {isReviewMode && <span className="text-emerald-600 font-bold ml-2">• Xem lời giải chi tiết</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (document.fullscreenElement) exitFullscreen();
              else enterFullscreen();
            }}
            className={"px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer " + (
              isFullscreen 
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                : "bg-rose-50 text-rose-700 border border-rose-300 animate-pulse"
            )}
            title="Bật/Tắt chế độ Toàn màn hình"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Toàn màn hình: BẬT</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Bật Fullscreen</span>
              </>
            )}
          </button>

          <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setLayoutMode("single")}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer " + (
                layoutMode === "single" ? "bg-white text-[#1D4ED8] shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Từng câu
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("scroll")}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer " + (
                layoutMode === "scroll" ? "bg-white text-[#1D4ED8] shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <List className="w-3.5 h-3.5" /> Cuộn danh sách
            </button>
          </div>

          {!isSubmitted && (
            <button
              type="button"
              onClick={() => handleSubmitExam()}
              className="px-5 py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl font-bold text-xs sm:text-sm shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{"Nộp bài (" + answeredCount + "/" + questions.length + ")"}</span>
            </button>
          )}

          {isReviewMode && (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" /> Về trang chủ
            </button>
          )}
        </div>
      </header>

      {/* 4. VÙNG LÀM BÀI CHÍNH */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
        <main className="lg:col-span-9 p-4 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar flex flex-col justify-between">
          <div className="max-w-4xl w-full mx-auto space-y-6">
            {layoutMode === "single" ? (
              <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs space-y-5 text-left">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-bold text-[#1D4ED8]">
                    {"Câu " + (currentIdx + 1) + " / " + questions.length}
                  </span>
                  {userAnswers[currentQ.id] ? (
                    <span className="text-xs font-semibold text-slate-500">
                      {"Đã chọn: " + userAnswers[currentQ.id]}
                    </span>
                  ) : (
                    <span className="text-xs font-normal text-slate-400">
                      Chưa làm
                    </span>
                  )}
                </div>

                <div className="py-1">
                  <MathRenderer content={currentQ.prompt} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
                        className={"p-3.5 sm:p-4 rounded-xl border text-left flex items-center gap-3 transition cursor-pointer " + (
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
                          <MathRenderer content={opt.text} inline={true} />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {isReviewMode && currentQ.explanation && (
                  <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-1 text-xs sm:text-sm">
                    <p className="font-bold text-[#1D4ED8] flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4" /> Hướng dẫn giải chi tiết:
                    </p>
                    <div className="text-slate-700 leading-relaxed font-normal">
                      <MathRenderer content={currentQ.explanation} />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
                    disabled={currentIdx === 0}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Câu trước
                  </button>

                  <div className="flex items-center gap-2">
                    {currentIdx < questions.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))}
                        className="px-5 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold shadow-sm transition flex items-center gap-1 cursor-pointer"
                      >
                        Câu tiếp <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      !isSubmitted && (
                        <button
                          type="button"
                          onClick={() => handleSubmitExam()}
                          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" /> Hoàn tất & Nộp bài
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* CHẾ ĐỘ CUỘN DANH SÁCH: CỠ CHỮ THON GỌN, KHÔNG IN ĐẬM */
              <div className="space-y-4">
                {questions.map((q, qIndex) => (
                  <div
                    key={q.id}
                    id={"question-card-" + q.id}
                    className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-3.5 text-left"
                  >
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                      <span className="text-xs font-bold text-[#1D4ED8]">
                        {"Câu " + (qIndex + 1) + " / " + questions.length}
                      </span>
                      {userAnswers[q.id] ? (
                        <span className="text-xs font-semibold text-slate-500">
                          {"Đã chọn: " + userAnswers[q.id]}
                        </span>
                      ) : (
                        <span className="text-xs font-normal text-slate-400">
                          Chưa làm
                        </span>
                      )}
                    </div>

                    <div className="py-0.5">
                      <MathRenderer content={q.prompt} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
                            className={"p-3.5 rounded-xl border text-left flex items-center gap-3 transition cursor-pointer " + (
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
                              <MathRenderer content={opt.text} inline={true} />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {isReviewMode && q.explanation && (
                      <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-slate-800 space-y-1">
                        <p className="font-bold flex items-center gap-1.5 text-[#1D4ED8]">
                          <HelpCircle className="w-4 h-4" /> Lời giải chi tiết:
                        </p>
                        <div>
                          <MathRenderer content={q.explanation} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* 5. SIDEBAR MA TRẬN & THỜI GIAN */}
        <aside className="lg:col-span-3 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white p-5 flex flex-col justify-between overflow-y-auto custom-scrollbar">
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2 text-left">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Thông tin thí sinh
              </span>
              <p className="text-sm font-bold text-slate-900">
                {profile?.full_name || "Trương Ngọc Quang"}
              </p>
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold pt-1 border-t border-slate-100">
                <span>{profile?.school || "THPT Chuyên"}</span>
                <span className="font-bold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded-md">{profile?.grade || "Lớp 12"}</span>
              </div>
              <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-slate-500 font-semibold">
                  <span>Rời màn hình / Chuyển tab:</span>
                  <span className={"font-black " + (tabSwitchCount > 0 ? "text-rose-600" : "text-emerald-600")}>
                    {tabSwitchCount + " / 2 lần " + (tabSwitchCount >= 2 ? "(Tự nộp)" : "")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl font-bold text-[10px] border border-emerald-200 mt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Bảo mật: Fullscreen Anti-Cheat BẬT</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xs space-y-1 text-left">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                {durationMinutes > 0 ? "THỜI GIAN CÒN LẠI" : "THỜI GIAN LÀM BÀI"}
              </span>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-400" />
                <span className="text-2xl font-black tracking-tight font-mono">
                  {durationMinutes > 0 ? formatTimer(secondsRemaining) : formatTimer(timeSpentSeconds)}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Danh sách câu hỏi</span>
                <span className="text-[11px] font-bold text-slate-400">{answeredCount}/{questions.length} câu</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
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
                      className={"h-9 rounded-xl font-bold text-xs transition cursor-pointer border " + (
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

          <div className="pt-4 mt-4 border-t border-slate-100">
            {!isSubmitted ? (
              <button
                type="button"
                onClick={() => handleSubmitExam()}
                className="w-full py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Nộp bài thi</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowResultModal(true)}
                className="w-full py-3 bg-blue-50 text-[#1D4ED8] hover:bg-blue-100 rounded-xl font-bold text-xs border border-blue-200 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trophy className="w-4 h-4" /> Xem lại bảng kết quả
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* 6. MODAL KẾT QUẢ THI */}
      <AnimatePresence>
        {showResultModal && (
          <div 
            onClick={() => setShowResultModal(false)}
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto cursor-pointer"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 border border-slate-200 shadow-2xl grid grid-cols-1 md:grid-cols-12 gap-8 cursor-default my-auto text-left"
            >
              <div className="md:col-span-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-xs">
                    <Trophy className="w-7 h-7" />
                  </div>

                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                      Hoàn Thành Bài Thi!
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-1">{quizTitle}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#1D4ED8] block">
                        ĐIỂM ĐẠT ĐƯỢC
                      </span>
                      <span className="text-3xl font-black text-[#1D4ED8]">
                        {score.toFixed(1)} <span className="text-base text-slate-400 font-bold">/ 10</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-600 block">
                        {"Đúng " + correctCount + "/" + questions.length + " câu"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {"(" + historyAttemptsCount + " lần nộp bài)"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="text-slate-600 font-medium">Rời màn hình vi phạm:</span>
                    <span className={"font-black " + (tabSwitchCount > 0 ? "text-rose-600" : "text-emerald-600")}>
                      {tabSwitchCount} lần {tabSwitchCount >= 2 ? "(Bị buộc nộp bài)" : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="text-slate-600 font-medium">Thoát Toàn màn hình:</span>
                    <span className={"font-black " + (fullscreenExitCount > 0 ? "text-rose-600" : "text-emerald-600")}>
                      {fullscreenExitCount} lần {fullscreenExitCount >= 2 ? "(Bị buộc nộp bài)" : ""}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="flex-1 py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" /> Làm lại bài
                  </button>
                  <button
                    type="button"
                    onClick={handleViewSolutions}
                    className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-[#1D4ED8]" /> Xem đáp án
                  </button>
                  <button
                    type="button"
                    onClick={onBackToDashboard}
                    className="flex-1 py-2.5 text-slate-400 hover:text-slate-600 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Home className="w-4 h-4" /> Trang chủ
                  </button>
                </div>
              </div>

              {/* BẢNG XẾP HẠNG */}
              <div className="md:col-span-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-200 md:pl-8 space-y-4">
                <div>
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-3">
                    <Award className="w-5 h-5 text-amber-500" />
                    <h3 className="font-black text-sm text-slate-900 tracking-tight">
                      Bảng Xếp Hạng Đề Thi
                    </h3>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Hạng</th>
                          <th className="py-2.5 px-3">Học sinh</th>
                          <th className="py-2.5 px-2 text-center">Điểm số</th>
                          <th className="py-2.5 px-3 text-right">Thời gian</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        <tr className="bg-blue-50/60 font-bold text-[#1D4ED8]">
                          <td className="py-2.5 px-3">
                            <span className="w-5 h-5 rounded-md bg-[#1D4ED8] text-white flex items-center justify-center text-[10px] font-black">
                              1
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-black">
                            {profile?.full_name || "Trương Ngọc Quang"}
                            <span className="ml-1 px-1.5 py-0.2 rounded text-[8px] bg-blue-200 text-[#1D4ED8]">
                              BẠN
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center font-black">
                            {score.toFixed(1)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-400 text-[11px]">
                            {Math.floor(timeSpentSeconds / 60) + "p " + (timeSpentSeconds % 60) + "s"}
                          </td>
                        </tr>
                        {rankingList.filter(r => r.studentId !== profile?.id).map((r, idx) => (
                          <tr key={r.attemptId || idx} className="hover:bg-slate-50 text-slate-700">
                            <td className="py-2 px-3 font-semibold text-slate-400">{idx + 2}</td>
                            <td className="py-2 px-3 font-bold truncate max-w-[120px]">{r.studentName}</td>
                            <td className="py-2 px-2 text-center font-black text-slate-800">{Number(r.score).toFixed(1)}</td>
                            <td className="py-2 px-3 text-right text-slate-400 text-[11px]">{Math.floor((r.timeSpentSeconds || 60) / 60) + "p"}</td>
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