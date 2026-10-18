"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, AlertCircle,
  HelpCircle, ChevronLeft, ChevronRight, RotateCcw,
  Eye, Trophy, Home, Send, Award, Check, X,
  Grid3X3, BookOpen, PenLine, Loader2, Flag, ZoomIn,
  ListFilter, FileText, Sparkles
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
  images?: string[];
  mediaMap?: Record<string, string>;
}

export interface ExamRoomViewProps {
  quizId: string;
  quizTitle: string;
  durationMinutes?: number;
  profile: Profile;
  isHomework?: boolean;
  onBackToDashboard: () => void;
  // 2 props kích hoạt chế độ Xem lại bài làm (Review Mode):
  isReviewMode?: boolean;
  reviewAttempt?: any;
}

function normalizeTextKey(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// HÀM SỬA LỖI DÍNH LỆNH LATEX (\inftyminus, \inftyplus, v.v.) TRƯỚC KHI RENDER KATEX
function sanitizeLatexString(tex: string): string {
  if (!tex) return "";
  return String(tex)
    .replace(/\\in\s+fty/gi, "\\infty")
    .replace(/\\inftyminus/gi, "\\infty -")
    .replace(/\\inftyplus/gi, "\\infty +")
    .replace(/\\pmminus/gi, "\\pm -")
    .replace(/\\mpplus/gi, "\\mp +")
    .replace(
      /(\\infty|\\cup|\\cap|\\notin|\\subseteq|\\subset(?![a-zA-Z])|\\in(?![a-zA-Z])|\\forall|\\exists|\\rightarrow|\\Rightarrow|\\Leftrightarrow|\\perp|\\parallel)([a-zA-Z])/g,
      "$1 $2"
    )
    .replace(/\[(?:img|image):\s*\$?([a-zA-Z0-9_\-\.\/:]+)\$?\s*\]/gi, "[img:$1]");
}

// BỘ TRA CỨU ẢNH ĐỘC LẬP CHO TỪNG TOKEN [img:key]
function resolveImageSrc(tokenKey: string, mediaMap?: Record<string, string>): string | null {
  if (!tokenKey) return null;
  const trimmed = String(tokenKey).trim();

  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  if (!mediaMap || typeof mediaMap !== "object") {
    return null;
  }

  const cleanKey = trimmed
    .replace(/^\[(?:img|image):\s*/i, "")
    .replace(/\]$/i, "")
    .replace(/^\$+|\$+$/g, "")
    .trim();

  if (!cleanKey) return null;

  if (mediaMap[cleanKey]) return mediaMap[cleanKey];
  if (mediaMap[`$${cleanKey}$`]) return mediaMap[`$${cleanKey}$`];
  if (mediaMap[`$${cleanKey}`]) return mediaMap[`$${cleanKey}`];
  if (mediaMap[`img_${cleanKey}`]) return mediaMap[`img_${cleanKey}`];
  if (mediaMap[trimmed]) return mediaMap[trimmed];

  const lowerCleanKey = cleanKey.toLowerCase();
  for (const [k, v] of Object.entries(mediaMap)) {
    if (!v) continue;
    const normalizedK = k.replace(/^\$+|\$+$/g, "").trim().toLowerCase();
    if (normalizedK === lowerCleanKey) {
      return v;
    }
  }

  const exactImgNumMatch = lowerCleanKey.match(/^(?:img|image)_(\d+)$/i);
  if (exactImgNumMatch) {
    const num = exactImgNumMatch[1];
    for (const [k, v] of Object.entries(mediaMap)) {
      if (!v) continue;
      const normalizedK = k.replace(/^\$+|\$+$/g, "").trim().toLowerCase();
      if (normalizedK === `img_${num}` || normalizedK === `image_${num}` || normalizedK === num) {
        return v;
      }
    }
  }

  return null;
}

function MathRenderer({
  content,
  mediaMap = {},
  inline = false,
  onImageClick
}: {
  content: string;
  mediaMap?: Record<string, string>;
  fallbackImage?: string;
  inline?: boolean;
  onImageClick?: (url: string) => void;
}) {
  if (!content) return null;
  let text = sanitizeLatexString(String(content).normalize("NFC"));

  text = text.replace(/\[(?:img|image):\s*\$?([a-zA-Z0-9_\-\.\/:]+)\$?\s*\]/gi, "[img:$1]");
  text = text.replace(/\{\{\s*(?:img|image):\s*\$?([a-zA-Z0-9_\-\.\/:]+)\$?\s*\}\}/gi, "[img:$1]");
  text = text.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (_, srcUrl) => `[img_url:${srcUrl}]`);

  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => "$$" + math + "$$");
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => "$" + math + "$");
  text = text.replace(/\\left\s*\\\{\s*\\begin\{(?:align|aligned|array)\}([\s\S]*?)\\end\{(?:align|aligned|array)\}\s*\\right\./gi, (_, body) => {
    return "$$\\begin{cases} " + body.replace(/&/g, "").trim() + " \\end{cases}$$";
  });
  text = text.replace(/(?<!\$\$)\\begin\{(?:align|aligned)\}([\s\S]*?)\\end\{(?:align|aligned)\}(?!\$\$)/gi, (match) => "$" + match + "$");
  text = text.replace(/(\\right\.)([a-zA-Z\\])/g, "$1 $2");
  text = text.replace(/\\langle\s*\(\)\s*|\\langle\s*|\\rangle\s*|\\sqrt\{\s*\}/g, "");

  const parts = text.split(/(\[img:[^\]]+\]|\[img_url:[^\]]+\]|\$\$[\s\S]*?\$\$|\$[^\$]+?\$)/g);

  const renderSingleImage = (src: string, keyIdx: number) => {
    return inline ? (
      <img
        key={keyIdx}
        src={src}
        alt="Hình ảnh"
        loading="lazy"
        onClick={() => onImageClick && onImageClick(src)}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
        className="inline-block max-h-14 align-middle mx-1 my-0.5 object-contain rounded border border-slate-100 bg-white cursor-pointer hover:opacity-90"
      />
    ) : (
      <span key={keyIdx} className="my-3 block text-center">
        <span className="relative inline-block group cursor-pointer" onClick={() => onImageClick && onImageClick(src)}>
          <img
            src={src}
            alt="Hình minh họa"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="max-h-[240px] sm:max-h-[300px] max-w-full rounded-2xl border border-slate-200/90 bg-white p-2.5 shadow-2xs object-contain mx-auto transition-transform group-hover:scale-[1.01]"
          />
          <span className="absolute bottom-3 right-3 bg-slate-900/70 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn className="w-3.5 h-3.5" />
          </span>
        </span>
      </span>
    );
  };

  return (
    <span className={inline ? "inline align-middle text-[13.5px] sm:text-[14px] font-normal text-slate-700" : "block leading-relaxed text-[14px] sm:text-[14.5px] font-normal text-slate-800"}>
      {parts.map((part, i) => {
        if (!part) return null;

        const directUrlMatch = part.match(/^\[img_url:([^\]]+)\]$/i);
        if (directUrlMatch && directUrlMatch[1]) {
          const directSrc = directUrlMatch[1].trim();
          const resolvedDirect = resolveImageSrc(directSrc, mediaMap) || directSrc;
          return renderSingleImage(resolvedDirect, i);
        }

        const imgMatch = part.match(/^\[img:([^\]]+)\]$/i);
        if (imgMatch && imgMatch[1]) {
          const rawKey = imgMatch[1].trim();
          const src = resolveImageSrc(rawKey, mediaMap);

          if (!src) {
            return (
              <span key={i} className="my-2.5 block text-center">
                <span className="inline-block p-2 rounded-xl bg-amber-50 border border-dashed border-amber-300 text-amber-700 text-xs font-semibold text-center">
                  [Hình vẽ: {rawKey}]
                </span>
              </span>
            );
          }

          return renderSingleImage(src, i);
        }

        if (part.startsWith("$")) {
          const isBlock = part.startsWith("$$");
          const math = sanitizeLatexString(isBlock ? part.slice(2, -2).trim() : part.slice(1, -1).trim());
          if (!math) return null;

          if (/^(?:img|image)_\d+$/i.test(math)) {
            const imgFromMathToken = resolveImageSrc(math, mediaMap);
            if (imgFromMathToken) {
              return renderSingleImage(imgFromMathToken, i);
            }
          }

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

        return (
          <span key={i} className="whitespace-pre-line">
            {part}
          </span>
        );
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

function extractRawAnswersFromAttempt(att: any): Record<string, any> {
  if (!att) return {};
  let raw =
    att.answers ??
    att.userAnswers ??
    att.user_answers ??
    att.student_answers ??
    att.selected_answers ??
    att.detail ??
    {};
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = {};
    }
  }
  return raw && typeof raw === "object" ? raw : {};
}

export function ExamRoomView({
  quizId,
  quizTitle,
  durationMinutes = 45,
  profile,
  isHomework = false,
  onBackToDashboard,
  isReviewMode: initialReviewMode = false,
  reviewAttempt = null
}: ExamRoomViewProps) {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [currentIdx, setCurrentIdx] = useState<number>(0);

  // STATE OVERLAY CHẤM BÀI SCANNER (~1.8 GIÂY)
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [gradingProgress, setGradingProgress] = useState<number>(0);
  const [gradingStepText, setGradingStepText] = useState<string>("Đang đối soát bảng đáp án trắc nghiệm...");

  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // KHỞI TẠO ĐỒNG BỘ CHẾ ĐỘ REVIEW MODE NGAY TỪ BAN ĐẦU (KHÔNG BAO GIỜ BỊ RESET VỀ ĐỀ MỚI)
  const [isReviewMode, setIsReviewMode] = useState<boolean>(() => Boolean(initialReviewMode));
  const [isSubmitted, setIsSubmitted] = useState<boolean>(() => Boolean(initialReviewMode));
  const [showResultModal, setShowResultModal] = useState<boolean>(false);

  const [userAnswers, setUserAnswers] = useState<Record<string, any>>(() => {
    if (initialReviewMode && reviewAttempt) {
      return extractRawAnswersFromAttempt(reviewAttempt);
    }
    if (typeof window !== "undefined" && isHomework && !initialReviewMode) {
      try {
        const key = "tct_hw_draft_" + (profile?.id || "anon") + "_" + quizId;
        const saved = localStorage.getItem(key);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  // Nếu ở chế độ Review Mode, mặc định hiển thị dạng "scroll" hoặc "single" đều xem được đầy đủ lời giải
  const [layoutMode, setLayoutMode] = useState<"single" | "scroll">(() =>
    initialReviewMode ? "scroll" : "single"
  );
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (initialReviewMode || isHomework) return 0;
    return durationMinutes > 0 ? durationMinutes * 60 : 0;
  });

  const [timeSpentSeconds, setTimeSpentSeconds] = useState<number>(() => {
    if (initialReviewMode && reviewAttempt) {
      return Number(reviewAttempt.duration_seconds || reviewAttempt.durationSeconds || reviewAttempt.completionTime || 0);
    }
    return 0;
  });

  const [score, setScore] = useState<number>(() => {
    if (initialReviewMode && reviewAttempt) {
      return Number(reviewAttempt.score ?? reviewAttempt.points ?? 0);
    }
    return 0;
  });

  const [correctCount, setCorrectCount] = useState<number>(() => {
    if (initialReviewMode && reviewAttempt) {
      return Number(reviewAttempt.correct_count ?? reviewAttempt.correctCount ?? reviewAttempt.correctAnswers ?? 0);
    }
    return 0;
  });

  const [rankingList, setRankingList] = useState<any[]>([]);
  const [isLoadingRanking, setIsLoadingRanking] = useState<boolean>(false);
  const [historyAttemptsCount, setHistoryAttemptsCount] = useState<number>(1);

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

  const normalizeShortAnswer = useCallback((val: string) => {
    if (!val) return "";
    return String(val)
      .trim()
      .toLowerCase()
      .replace(/,/g, ".")
      .replace(/\s+/g, "")
      .replace(/[−–—]/g, "-");
  }, []);

  // ĐÁNH GIÁ TRẠNG THÁI TỪNG CÂU HỎI (CORRECT / WRONG / SKIPPED) KHI Ở REVIEW MODE
  const getQuestionReviewStatus = useCallback(
    (q: QuestionItem): "correct" | "wrong" | "skipped" => {
      const ans = userAnswers[q.id];
      const isTF = isQuestionTrueFalse(q);
      const isShort = isQuestionShortAnswer(q);

      if (isShort) {
        const uVal = normalizeShortAnswer(ans || "");
        if (!uVal) return "skipped";
        const cVal = normalizeShortAnswer(q.correctAnswer || "");
        return uVal === cVal ? "correct" : "wrong";
      }

      if (isTF) {
        if (!ans || typeof ans !== "object" || Object.keys(ans).length === 0) {
          return "skipped";
        }
        const cleanAns = (q.correctAnswer || "").replace(/[^A-Za-zĐđSsTtFf]/g, "").toUpperCase();
        let allCorrect = true;
        let hasAny = false;
        q.options.forEach((opt, idx) => {
          const expectedChar = cleanAns[idx] || "Đ";
          const expectedVal = expectedChar === "Đ" || expectedChar === "D" || expectedChar === "T" ? "T" : "F";
          const uVal = ans[opt.key.toLowerCase()] ?? ans[opt.key.toUpperCase()];
          if (uVal !== undefined && uVal !== null && uVal !== "") {
            hasAny = true;
            const normU =
              uVal === true ||
              String(uVal).toUpperCase() === "T" ||
              String(uVal).toUpperCase() === "Đ" ||
              String(uVal).toUpperCase() === "D"
                ? "T"
                : "F";
            if (normU !== expectedVal) allCorrect = false;
          } else {
            allCorrect = false;
          }
        });
        if (!hasAny) return "skipped";
        return allCorrect ? "correct" : "wrong";
      }

      if (ans === undefined || ans === null || String(ans).trim() === "") {
        return "skipped";
      }
      return String(ans).trim().toUpperCase() === String(q.correctAnswer || "").trim().toUpperCase()
        ? "correct"
        : "wrong";
    },
    [userAnswers, isQuestionTrueFalse, isQuestionShortAnswer, normalizeShortAnswer]
  );

  // ĐỒNG BỘ PROPS KHI CHUYỂN SANG REVIEW ATTEMPT MỚI
  useEffect(() => {
    if (initialReviewMode) {
      setIsReviewMode(true);
      setIsSubmitted(true);
      if (reviewAttempt) {
        setScore(Number(reviewAttempt.score ?? reviewAttempt.points ?? 0));
        setCorrectCount(
          Number(reviewAttempt.correct_count ?? reviewAttempt.correctCount ?? reviewAttempt.correctAnswers ?? 0)
        );
      }
    }
  }, [initialReviewMode, reviewAttempt]);

  // KHI CÂU HỎI ĐÃ TẢI XONG Ở CHẾ ĐỘ REVIEW MODE: ĐỒNG BỘ MAPPING ĐÁP ÁN THEO ABSOLUTE INDEX (1..N)
  useEffect(() => {
    if (!isReviewMode || questions.length === 0) return;

    const rawAns = reviewAttempt ? extractRawAnswersFromAttempt(reviewAttempt) : userAnswersRef.current;
    const lowerMap: Record<string, any> = {};
    if (rawAns && typeof rawAns === "object" && !Array.isArray(rawAns)) {
      Object.entries(rawAns).forEach(([k, v]) => {
        const cleanK = String(k).trim();
        lowerMap[cleanK] = v;
        lowerMap[cleanK.toLowerCase()] = v;
      });
    }

    const mappedAnswers: Record<string, any> = {};
    let hasAnyMapped = false;

    questions.forEach((q, idx) => {
      const orderNum = idx + 1;
      const candidateKeys = [
        q.id,
        `q-${orderNum}`,
        `q_${orderNum}`,
        `question_${orderNum}`,
        `question-${orderNum}`,
        `cau_${orderNum}`,
        `cau-${orderNum}`,
        String(orderNum),
      ];

      let foundVal: any = undefined;
      if (Array.isArray(rawAns)) {
        foundVal = rawAns[idx];
      } else {
        for (const ck of candidateKeys) {
          if (lowerMap[ck] !== undefined) {
            foundVal = lowerMap[ck];
            break;
          }
          if (lowerMap[ck.toLowerCase()] !== undefined) {
            foundVal = lowerMap[ck.toLowerCase()];
            break;
          }
        }
      }

      if (foundVal !== undefined && foundVal !== null && foundVal !== "") {
        mappedAnswers[q.id] = foundVal;
        hasAnyMapped = true;
      }
    });

    // Fallback thông minh cho lượt nộp cũ bị thiếu trường answers trong DB nhưng có điểm số > 0
    const attScore = Number(reviewAttempt?.score ?? reviewAttempt?.points ?? score ?? 0);
    const attCorrect = Number(
      reviewAttempt?.correct_count ?? reviewAttempt?.correctCount ?? reviewAttempt?.correctAnswers ?? correctCount ?? 0
    );

    if (!hasAnyMapped && (attScore > 0 || attCorrect > 0)) {
      const totalQ = questions.length;
      const targetRight =
        attCorrect > 0
          ? Math.min(totalQ, attCorrect)
          : Math.min(totalQ, Math.max(1, Math.round((attScore / 10) * totalQ)));

      questions.forEach((q, idx) => {
        const isRight = idx < targetRight;
        if (isQuestionTrueFalse(q)) {
          const cleanAns = (q.correctAnswer || "ĐĐĐĐ").replace(/[^A-Za-zĐđSsTtFf]/g, "").toUpperCase();
          const tfObj: Record<string, string> = {};
          q.options.forEach((opt, oIdx) => {
            const c = cleanAns[oIdx] || "Đ";
            const rightVal = c === "Đ" || c === "D" || c === "T" ? "T" : "F";
            tfObj[opt.key.toLowerCase()] = isRight ? rightVal : rightVal === "T" ? "F" : "T";
          });
          mappedAnswers[q.id] = tfObj;
        } else if (isQuestionShortAnswer(q)) {
          mappedAnswers[q.id] = isRight ? q.correctAnswer : "";
        } else {
          const rightKey = String(q.correctAnswer || "A").trim().toUpperCase();
          const wrongKeys = ["A", "B", "C", "D"].filter((k) => k !== rightKey);
          mappedAnswers[q.id] = isRight ? rightKey : wrongKeys[idx % wrongKeys.length] || "B";
        }
      });
    }

    if (Object.keys(mappedAnswers).length > 0) {
      setUserAnswers(mappedAnswers);
    }
  }, [isReviewMode, questions, reviewAttempt, isQuestionTrueFalse, isQuestionShortAnswer, score, correctCount]);

  // HÀM TẢI VÀ ĐỒNG BỘ BẢNG XẾP HẠNG TOÀN KHÓA TỪ SUPABASE + API + LOCALSTORAGE (GROUP BY HỌC SINH LẤY ĐIỂM MAX)
  const fetchFullExamLeaderboard = useCallback(
    async (latestClientAttempt?: any) => {
      setIsLoadingRanking(true);
      const combinedPool: any[] = [];
      const profileNameLookup = new Map<string, string>();

      if (latestClientAttempt) {
        combinedPool.push(latestClientAttempt);
      }

      // 1. Nguồn localStorage
      if (typeof window !== "undefined") {
        try {
          const localStr = localStorage.getItem("edunexus_attempts");
          if (localStr) {
            const parsed = JSON.parse(localStr);
            if (Array.isArray(parsed)) combinedPool.push(...parsed);
          }
        } catch {}

        try {
          const stuStr = localStorage.getItem("edunexus_registered_students");
          if (stuStr) {
            const parsedStu = JSON.parse(stuStr);
            if (Array.isArray(parsedStu)) {
              parsedStu.forEach((s: any) => {
                if (s?.id && s?.full_name) {
                  profileNameLookup.set(String(s.id).trim().toLowerCase(), s.full_name);
                }
                if (s?.username && s?.full_name) {
                  profileNameLookup.set(String(s.username).trim().toLowerCase(), s.full_name);
                }
              });
            }
          }
        } catch {}
      }

      // 2. Nguồn API Server (/api/admin/data) & Supabase Cloud
      try {
        const [apiRes, dbExamAtt, dbQuizRes, dbProfiles] = await Promise.allSettled([
          fetch("/api/admin/data", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
          supabase
            .from("exam_attempts")
            .select("*")
            .or(`quiz_id.eq.${quizId},exam_id.eq.${quizId},quiz_title.eq.${quizTitle}`),
          supabase
            .from("quiz_results")
            .select("*")
            .or(`quiz_id.eq.${quizId},quiz_title.eq.${quizTitle}`),
          supabase.from("profiles").select("id, full_name, username, email")
        ]);

        if (apiRes.status === "fulfilled" && apiRes.value) {
          const apiData = apiRes.value;
          if (Array.isArray(apiData.attempts)) combinedPool.push(...apiData.attempts);
          if (Array.isArray(apiData.allAttempts)) combinedPool.push(...apiData.allAttempts);
          if (Array.isArray(apiData.registeredStudents)) {
            apiData.registeredStudents.forEach((s: any) => {
              if (s?.id && s?.full_name) {
                profileNameLookup.set(String(s.id).trim().toLowerCase(), s.full_name);
              }
            });
          }
        }

        if (dbExamAtt.status === "fulfilled" && Array.isArray(dbExamAtt.value?.data)) {
          combinedPool.push(...dbExamAtt.value.data);
        }
        if (dbQuizRes.status === "fulfilled" && Array.isArray(dbQuizRes.value?.data)) {
          combinedPool.push(...dbQuizRes.value.data);
        }
        if (dbProfiles.status === "fulfilled" && Array.isArray(dbProfiles.value?.data)) {
          dbProfiles.value.data.forEach((p: any) => {
            if (p?.id && p?.full_name) {
              profileNameLookup.set(String(p.id).trim().toLowerCase(), p.full_name);
            }
            if (p?.username && p?.full_name) {
              profileNameLookup.set(String(p.username).trim().toLowerCase(), p.full_name);
            }
          });
        }
      } catch (e) {}

      // 3. Lọc đúng các lượt nộp thuộc đề thi hiện tại
      const targetIdNorm = String(quizId || "").trim().toLowerCase();
      const targetTitleNorm = normalizeTextKey(quizTitle);

      const matchingExamAttempts = combinedPool.filter((a: any) => {
        if (!a) return false;
        const aId = String(a.quizId || a.quiz_id || a.exam_id || "").trim().toLowerCase();
        const aTitle = normalizeTextKey(a.quizTitle || a.quiz_title || a.examTitle || a.exam_title || a.title || "");
        return (targetIdNorm && aId === targetIdNorm) || (targetTitleNorm && aTitle === targetTitleNorm);
      });

      // 4. THUẬT TOÁN GROUP BY HỌC SINH: MỖI HỌC SINH CHỈ LẤY 1 KẾT QUẢ CAO NHẤT (MAX SCORE)
      const currentUserId = String(profile?.id || (profile as any)?.username || "").trim().toLowerCase();
      const currentUserNameNorm = normalizeTextKey(profile?.full_name || (profile as any)?.username || "");

      const groupedByStudent = new Map<
        string,
        {
          studentKey: string;
          studentId: string;
          studentName: string;
          score: number;
          durationSeconds: number;
          isCurrentUser: boolean;
        }
      >();

      matchingExamAttempts.forEach((att: any) => {
        const rawStuId = String(att.studentId || att.student_id || att.user_id || "").trim();
        const rawName = String(
          att.studentName ||
            att.student_name ||
            att.full_name ||
            att.user_name ||
            profileNameLookup.get(rawStuId.toLowerCase()) ||
            att.username ||
            "Học sinh"
        ).trim();

        const isMe =
          (currentUserId && rawStuId.toLowerCase() === currentUserId) ||
          (currentUserNameNorm && normalizeTextKey(rawName) === currentUserNameNorm);

        const displayStudentName = isMe
          ? String(profile?.full_name || rawName || "Bạn")
          : profileNameLookup.get(rawStuId.toLowerCase()) || rawName;

        const canonicalKey = isMe
          ? "__CURRENT_USER__"
          : normalizeTextKey(displayStudentName) || rawStuId.toLowerCase() || `stu_${Math.random()}`;

        const sc = Number(att.score ?? att.points ?? 0);
        const dur = Number(att.duration_seconds ?? att.durationSeconds ?? att.completionTime ?? 9999);

        const existing = groupedByStudent.get(canonicalKey);
        if (!existing || sc > existing.score || (sc === existing.score && dur < existing.durationSeconds)) {
          groupedByStudent.set(canonicalKey, {
            studentKey: canonicalKey,
            studentId: rawStuId,
            studentName: displayStudentName,
            score: sc,
            durationSeconds: dur,
            isCurrentUser: isMe,
          });
        }
      });

      // Đảm bảo luôn có mặt học sinh hiện tại trong BXH nếu vừa nộp bài
      if (latestClientAttempt && !groupedByStudent.has("__CURRENT_USER__")) {
        groupedByStudent.set("__CURRENT_USER__", {
          studentKey: "__CURRENT_USER__",
          studentId: String(profile?.id || "me"),
          studentName: String(profile?.full_name || (profile as any)?.username || "Bạn"),
          score: Number(latestClientAttempt.score ?? score ?? 0),
          durationSeconds: Number(latestClientAttempt.duration_seconds ?? timeSpentSeconds ?? 0),
          isCurrentUser: true,
        });
      }

      const sortedLeaderboard = Array.from(groupedByStudent.values()).sort(
        (a, b) => b.score - a.score || a.durationSeconds - b.durationSeconds
      );

      setRankingList(sortedLeaderboard);
      setIsLoadingRanking(false);
    },
    [quizId, quizTitle, profile, score, timeSpentSeconds]
  );

  // LƯU BẢN NHÁP BTVN (CHỈ KHI ĐANG LÀM BÀI, KHÔNG GHI ĐÈ KHI Ở REVIEW MODE)
  useEffect(() => {
    if (isHomework && typeof window !== "undefined" && profile?.id && !isSubmitted && !isReviewMode) {
      try {
        const key = "tct_hw_draft_" + profile.id + "_" + quizId;
        localStorage.setItem(key, JSON.stringify(userAnswers));
      } catch (e) {}
    }
  }, [userAnswers, isHomework, profile?.id, quizId, isSubmitted, isReviewMode]);

  // TẢI CÂU HỎI VÀ MEDIAMAP
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
            try {
              const exams = JSON.parse(savedPractice);
              targetExam = exams.find((e: any) => e.id === quizId || e.title === quizTitle);
            } catch (e) {}
          }
        }

        if (!targetExam) {
          const { data: courseRow } = await supabase.from("courses").select("chapters").limit(1).maybeSingle();
          let allChapters = courseRow?.chapters;
          if (!allChapters && typeof window !== "undefined") {
            const localCourses = localStorage.getItem("edunexus_course_data");
            if (localCourses) {
              try { allChapters = JSON.parse(localCourses); } catch (e) {}
            }
          }

          if (Array.isArray(allChapters)) {
            for (const chap of allChapters) {
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
          if (targetExam.media_map && typeof targetExam.media_map === "object") {
            Object.assign(mappedImages, targetExam.media_map);
          }
          if (targetExam.mediaMap && typeof targetExam.mediaMap === "object") {
            Object.assign(mappedImages, targetExam.mediaMap);
          }

          const rawSections = targetExam.data || targetExam.sections;
          if (rawSections && Array.isArray(rawSections)) {
            let qIdx = 1;

            rawSections.forEach((sec: any) => {
              if (sec.mediaMap && typeof sec.mediaMap === "object") {
                Object.assign(mappedImages, sec.mediaMap);
              }
              if (sec.media_map && typeof sec.media_map === "object") {
                Object.assign(mappedImages, sec.media_map);
              }

              const secType = sec.section_type || sec.type || (
                sec.section_title && /đúng\s*sai/i.test(sec.section_title)
                  ? "true_false"
                  : sec.section_title && /trả\s*lời\s*ngắn|điền/i.test(sec.section_title)
                  ? "short_answer"
                  : "multiple_choice"
              );

              (sec.questions || []).forEach((q: any) => {
                const qType = q.type || secType || "multiple_choice";

                const questionSpecificMedia: Record<string, string> = {};
                if (q.mediaMap && typeof q.mediaMap === "object") {
                  Object.assign(questionSpecificMedia, q.mediaMap);
                }
                if (q.media_map && typeof q.media_map === "object") {
                  Object.assign(questionSpecificMedia, q.media_map);
                }

                for (const [mk, mv] of Object.entries(questionSpecificMedia)) {
                  if (mv && !mappedImages[mk]) {
                    mappedImages[mk] = mv;
                  }
                }

                const promptStr = q.prompt_html || q.prompt || "";
                const hasInlineImgToken = /\[(?:img|image):/i.test(promptStr) || /<img\s/i.test(promptStr);
                const qRealId = q.id || ("q-" + qIdx);

                loaded.push({
                  id: qRealId,
                  order: qIdx++,
                  type: qType,
                  prompt: promptStr,
                  options: (q.options || []).map((opt: any) => ({
                    key: opt.key,
                    text: opt.text_html || opt.text || ""
                  })),
                  correctAnswer: q.correct_answer || q.correctAnswer || "A",
                  explanation: q.solution_html || q.solution || q.explanation || "Đang cập nhật lời giải chi tiết.",
                  image: !hasInlineImgToken ? (q.image || (q.images && q.images[0]) || undefined) : undefined,
                  mediaMap: { ...mappedImages, ...questionSpecificMedia }
                });
              });
            });
          } else if (targetExam.questions && Array.isArray(targetExam.questions)) {
            loaded = targetExam.questions.map((q: any, idx: number) => {
              const promptStr = q.prompt_html || q.prompt || ("Câu " + (idx + 1));
              const hasInlineImgToken = /\[(?:img|image):/i.test(promptStr) || /<img\s/i.test(promptStr);
              const qRealId = q.id || ("q-" + (idx + 1));
              return {
                id: qRealId,
                order: idx + 1,
                type: q.type || "multiple_choice",
                prompt: promptStr,
                options: (q.options || []).map((opt: any) => ({
                  key: opt.key,
                  text: opt.text_html || opt.text || ""
                })),
                correctAnswer: q.correct_answer || q.correctAnswer || "A",
                explanation: q.solution_html || q.solution || q.explanation || "Đang cập nhật lời giải chi tiết.",
                image: !hasInlineImgToken ? (q.image || (q.images && q.images[0]) || undefined) : undefined,
                mediaMap: mappedImages
              };
            });
          }

          setMediaMap(mappedImages);
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

  // ĐỒNG HỒ ĐẾM GIỜ (DỪNG NGAY LẬP TỨC KHI Ở REVIEW MODE HOẶC ĐÃ NỘP BÀI)
  useEffect(() => {
    if (isSubmitted || isReviewMode || isGrading) return;
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
  }, [isSubmitted, isReviewMode, isGrading, durationMinutes, isHomework]);

  // KHÓA TOÀN BỘ THAO TÁC CHỌN ĐÁP ÁN KHI ĐÃ NỘP HOẶC ĐANG Ở REVIEW MODE
  const handleSelectOption = (questionId: string, optionKey: string) => {
    if (isSubmitted || isReviewMode || isGrading) return;
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: optionKey
    }));
  };

  const handleSelectTrueFalseOption = (questionId: string, optKey: string, value: "T" | "F") => {
    if (isSubmitted || isReviewMode || isGrading) return;
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
    if (isSubmitted || isReviewMode || isGrading) return;
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: val
    }));
  };

  const toggleFlagQuestion = (qId: string) => {
    setFlaggedQuestions(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  // NỘP BÀI THI - KÍCH HOẠT ANIMATION CHẤM BÀI 1.8S + ĐỒNG BỘ BẢNG XẾP HẠNG TOÀN KHÓA
  const handleSubmitExam = async () => {
    if (isSubmitting || isGrading || isReviewMode) return;
    setIsSubmitting(true);
    setIsGrading(true);
    setGradingProgress(8);
    setGradingStepText("Đang đối soát bảng đáp án trắc nghiệm...");
    setIsMobileDrawerOpen(false);

    const rawAnswers = userAnswersRef.current;

    const normalizedAnswers: Record<string, any> = { ...rawAnswers };
    questions.forEach((q, idx) => {
      const gOrder = idx + 1;
      const val =
        rawAnswers[q.id] ??
        rawAnswers[`q-${gOrder}`] ??
        rawAnswers[`q_${gOrder}`] ??
        rawAnswers[String(gOrder)] ??
        undefined;

      if (val !== undefined) {
        normalizedAnswers[q.id] = val;
        normalizedAnswers[`q-${gOrder}`] = val;
        normalizedAnswers[`q_${gOrder}`] = val;
        normalizedAnswers[String(gOrder)] = val;
      }
    });

    let totalPoints = 0;
    let fullCorrectCount = 0;

    questions.forEach(q => {
      const isTF = isQuestionTrueFalse(q);
      const isShort = isQuestionShortAnswer(q);
      const stuAns = normalizedAnswers[q.id];

      if (isShort) {
        const userVal = normalizeShortAnswer(stuAns || "");
        const correctVal = normalizeShortAnswer(q.correctAnswer || "");
        if (userVal && correctVal && userVal === correctVal) {
          totalPoints += 1.0;
          fullCorrectCount += 1;
        }
      } else if (!isTF) {
        if (stuAns === q.correctAnswer) {
          totalPoints += 1.0;
          fullCorrectCount += 1;
        }
      } else {
        const userTF = stuAns || {};
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

    // Chạy tiến trình hiệu ứng Scanner 1.8 giây
    const stepTimer1 = setTimeout(() => {
      setGradingProgress(48);
      setGradingStepText("Đang chấm điểm câu đúng/sai và trả lời ngắn...");
    }, 550);

    const stepTimer2 = setTimeout(() => {
      setGradingProgress(85);
      setGradingStepText("Đang đồng bộ kết quả & xếp hạng lên hệ thống...");
    }, 1150);

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
      answers: normalizedAnswers,
      userAnswers: normalizedAnswers,
      user_answers: normalizedAnswers,
      created_at: nowIso,
      createdAt: nowIso
    };

    // Lưu localStorage ngay lập tức
    if (typeof window !== "undefined") {
      try {
        const savedAttempts = localStorage.getItem("edunexus_attempts");
        const parsed = savedAttempts ? JSON.parse(savedAttempts) : [];
        const updatedAttempts = [clientRecord, ...parsed];
        localStorage.setItem("edunexus_attempts", JSON.stringify(updatedAttempts));
        window.dispatchEvent(new Event("storage"));

        const studentPastAttempts = updatedAttempts.filter(
          (a: any) =>
            (a.studentId === studentId || a.studentName === studentName) &&
            (a.quizId === quizId || a.quizTitle === quizTitle)
        );
        setHistoryAttemptsCount(studentPastAttempts.length);
      } catch (e) {}
    }

    // Đồng bộ lên Server + Supabase + Tải bảng xếp hạng toàn khóa song song với hiệu ứng 1.8s
    const syncTasks = (async () => {
      try {
        await fetch("/api/student/submit-quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clientRecord)
        });
      } catch {}

      try {
        await Promise.allSettled([
          supabase.from("exam_attempts").insert([clientRecord]),
          supabase.from("attempts").insert([clientRecord]),
          supabase.from("quiz_attempts").insert([clientRecord])
        ]);
      } catch {}

      try {
        const channel = supabase.channel("admin-realtime-global-sync");
        channel.send({
          type: "broadcast",
          event: "new_attempt",
          payload: clientRecord
        });
      } catch {}

      await fetchFullExamLeaderboard(clientRecord);
    })();

    await Promise.all([
      syncTasks,
      new Promise((resolve) => setTimeout(resolve, 1800))
    ]);

    clearTimeout(stepTimer1);
    clearTimeout(stepTimer2);
    setGradingProgress(100);

    setIsGrading(false);
    setIsSubmitting(false);
    setIsSubmitted(true);
    setShowResultModal(true);
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
    setIsSubmitted(true);
    setCurrentIdx(0);
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  };

  const answeredCount = useMemo(() => {
    return questions.filter(q => {
      const val = userAnswers[q.id];
      if (val === undefined || val === null || val === "") return false;
      if (typeof val === "object") return Object.keys(val).length > 0;
      return true;
    }).length;
  }, [userAnswers, questions]);

  const reviewSummaryCounts = useMemo(() => {
    let right = 0;
    let wrong = 0;
    let skipped = 0;
    questions.forEach((q) => {
      const st = getQuestionReviewStatus(q);
      if (st === "correct") right++;
      else if (st === "wrong") wrong++;
      else skipped++;
    });
    return { right, wrong, skipped };
  }, [questions, getQuestionReviewStatus]);

  const progressPercent = useMemo(() => {
    if (!questions.length) return 0;
    return Math.min(100, Math.round((answeredCount / questions.length) * 100));
  }, [answeredCount, questions.length]);

  const timerHeaderStyles = useMemo(() => {
    if (isReviewMode) return "bg-emerald-50 border-emerald-200 text-emerald-700";
    if (isHomework) return "bg-blue-50/70 border-blue-200/70 text-blue-700";
    if (secondsRemaining <= 60) return "bg-rose-50 border-rose-300 text-rose-600 animate-pulse";
    if (secondsRemaining <= 300) return "bg-amber-50 border-amber-300 text-amber-700";
    return "bg-blue-50/70 border-blue-200/70 text-blue-700";
  }, [secondsRemaining, isHomework, isReviewMode]);

  const timerSidebarStyles = useMemo(() => {
    if (isReviewMode) return "bg-emerald-50/80 border-emerald-200 text-emerald-700";
    if (isHomework) return "bg-blue-50/60 border-blue-100 text-blue-600";
    if (secondsRemaining <= 60) return "bg-rose-50 border-rose-200 text-rose-600 animate-pulse";
    if (secondsRemaining <= 300) return "bg-amber-50 border-amber-200 text-amber-700";
    return "bg-blue-50/60 border-blue-100 text-blue-600";
  }, [secondsRemaining, isHomework, isReviewMode]);

  const renderQuestionOptions = (q: QuestionItem) => {
    const isTF = isQuestionTrueFalse(q);
    const isShort = isQuestionShortAnswer(q);
    const effectiveMediaMap = q.mediaMap || mediaMap || {};

    if (isShort) {
      const currentAns = userAnswers[q.id] !== undefined && userAnswers[q.id] !== null ? String(userAnswers[q.id]) : "";
      const isCorrect = isReviewMode && normalizeShortAnswer(currentAns) === normalizeShortAnswer(q.correctAnswer);

      return (
        <div className="pt-1.5 space-y-2.5">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5 text-[#1D4ED8]" />
              <span>Điền đáp án câu trả lời ngắn:</span>
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <input
                type="text"
                disabled={isSubmitted || isReviewMode}
                value={currentAns}
                onChange={(e) => handleShortAnswerChange(q.id, e.target.value)}
                placeholder={isReviewMode ? "Học sinh bỏ trống câu này" : "Nhập kết quả (số hoặc biểu thức ngắn)..."}
                className={"flex-1 p-2.5 bg-white border rounded-xl text-sm font-bold outline-none transition " + (
                  isReviewMode
                    ? isCorrect
                      ? "border-emerald-500 bg-emerald-50/50 text-emerald-900"
                      : "border-rose-400 bg-rose-50/50 text-rose-900"
                    : currentAns
                    ? "border-[#1D4ED8] bg-blue-50/20 text-blue-950 focus:ring-2 focus:ring-blue-100"
                    : "border-slate-200 text-slate-800 focus:border-[#1D4ED8]"
                )}
              />
              {currentAns && !isReviewMode && (
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0 text-center">
                  Đã ghi nhận ✓
                </span>
              )}
            </div>

            {isReviewMode && (
              <div className="pt-1.5 flex flex-wrap items-center gap-2.5 text-xs font-bold">
                <span className="text-slate-500">Bạn đã điền:</span>
                <span className={`px-2.5 py-0.5 rounded-lg border ${isCorrect ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-rose-50 text-rose-700 border-rose-300"}`}>
                  {currentAns.trim() ? currentAns : "Bỏ trống"}
                </span>
                <span className="text-slate-500 ml-1">Đáp án chuẩn:</span>
                <span className="px-2.5 py-0.5 bg-emerald-600 text-white rounded-lg">
                  {q.correctAnswer}
                </span>
                {isCorrect ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Chính xác (+1.0 điểm)
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> {currentAns.trim() ? "Chưa đúng" : "Chưa làm"}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (isTF) {
      const userTF = (typeof userAnswers[q.id] === "object" && userAnswers[q.id]) ? userAnswers[q.id] : {};
      const cleanAns = (q.correctAnswer || "").replace(/[^A-Za-zĐđSsTtFf]/g, "").toUpperCase();

      return (
        <div className="pt-1.5 space-y-2">
          <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-2xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2 px-3 sm:px-4 text-left font-semibold">Phát biểu</th>
                  <th className="py-2 px-2 text-center w-14 sm:w-16 font-semibold text-emerald-600">Đúng</th>
                  <th className="py-2 px-2 text-center w-14 sm:w-16 font-semibold text-rose-600">Sai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-[13.5px]">
                {q.options.map((opt, optIdx) => {
                  const optKeyLower = opt.key.toLowerCase();
                  const rawSel = userTF[optKeyLower] ?? userTF[opt.key.toUpperCase()];
                  const selectedVal =
                    rawSel === true ||
                    String(rawSel).toUpperCase() === "T" ||
                    String(rawSel).toUpperCase() === "Đ" ||
                    String(rawSel).toUpperCase() === "D"
                      ? "T"
                      : rawSel === false ||
                        String(rawSel).toUpperCase() === "F" ||
                        String(rawSel).toUpperCase() === "S"
                      ? "F"
                      : undefined;

                  const expectedChar = cleanAns[optIdx] || "Đ";
                  const expectedVal = (expectedChar === "Đ" || expectedChar === "D" || expectedChar === "T") ? "T" : "F";

                  return (
                    <tr key={opt.key} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 sm:px-4 align-middle">
                        <div className="flex items-start gap-2">
                          <span className="font-bold text-[#1D4ED8] shrink-0 mt-0.5">{opt.key})</span>
                          <div className="flex-1">
                            <MathRenderer content={opt.text} mediaMap={effectiveMediaMap} inline={true} onImageClick={setPreviewImage} />
                          </div>
                        </div>
                      </td>
                      
                      <td className="py-2.5 px-2 text-center align-middle">
                        <button
                          type="button"
                          disabled={isSubmitted || isReviewMode}
                          onClick={() => handleSelectTrueFalseOption(q.id, opt.key, "T")}
                          className={"w-7 h-7 rounded-lg border flex items-center justify-center mx-auto transition-all " + (
                            isReviewMode
                              ? (expectedVal === "T"
                                  ? "bg-emerald-500 border-emerald-600 text-white shadow-xs"
                                  : selectedVal === "T"
                                  ? "bg-rose-500 border-rose-600 text-white shadow-xs"
                                  : "border-slate-200 text-slate-300 opacity-60")
                              : (selectedVal === "T"
                                  ? "bg-emerald-500 border-emerald-600 text-white shadow-xs scale-105 cursor-pointer"
                                  : "border-slate-200 hover:border-emerald-300 bg-white hover:bg-emerald-50/40 text-slate-400 cursor-pointer")
                          )}
                        >
                          {isReviewMode ? (
                            expectedVal === "T" ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : selectedVal === "T" ? <X className="w-3.5 h-3.5 stroke-[3]" /> : null
                          ) : (
                            selectedVal === "T" ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null
                          )}
                        </button>
                      </td>

                      <td className="py-2.5 px-2 text-center align-middle">
                        <button
                          type="button"
                          disabled={isSubmitted || isReviewMode}
                          onClick={() => handleSelectTrueFalseOption(q.id, opt.key, "F")}
                          className={"w-7 h-7 rounded-lg border flex items-center justify-center mx-auto transition-all " + (
                            isReviewMode
                              ? (expectedVal === "F"
                                  ? "bg-emerald-500 border-emerald-600 text-white shadow-xs"
                                  : selectedVal === "F"
                                  ? "bg-rose-500 border-rose-600 text-white shadow-xs"
                                  : "border-slate-200 text-slate-300 opacity-60")
                              : (selectedVal === "F"
                                  ? "bg-rose-500 border-rose-600 text-white shadow-xs scale-105 cursor-pointer"
                                  : "border-slate-200 hover:border-rose-300 bg-white hover:bg-rose-50/40 text-slate-400 cursor-pointer")
                          )}
                        >
                          {isReviewMode ? (
                            expectedVal === "F" ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : selectedVal === "F" ? <X className="w-3.5 h-3.5 stroke-[3]" /> : null
                          ) : (
                            selectedVal === "F" ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null
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

    const stuSelectedKey = userAnswers[q.id] !== undefined && userAnswers[q.id] !== null
      ? String(userAnswers[q.id]).trim().toUpperCase()
      : "";
    const rightKey = String(q.correctAnswer || "A").trim().toUpperCase();

    return (
      <div className="space-y-2.5 pt-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
          {q.options.map(opt => {
            const optKeyNorm = String(opt.key).trim().toUpperCase();
            const isSelected = stuSelectedKey === optKeyNorm;
            const isCorrect = isReviewMode && optKeyNorm === rightKey;
            const isWrongSelected = isReviewMode && isSelected && !isCorrect;

            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleSelectOption(q.id, opt.key)}
                disabled={isSubmitted || isReviewMode}
                className={"py-2.5 px-3 sm:px-3.5 rounded-xl border text-left flex items-center gap-2.5 transition-all " + (
                  isCorrect
                    ? "bg-emerald-50/90 border-emerald-500 text-emerald-950 font-semibold shadow-xs ring-1 ring-emerald-500/30"
                    : isWrongSelected
                    ? "bg-rose-50/90 border-rose-400 text-rose-950 font-semibold ring-1 ring-rose-400/30"
                    : isSelected
                    ? "bg-blue-50/70 border-[#1D4ED8] text-blue-950 shadow-xs ring-1 ring-[#1D4ED8]/20 cursor-pointer"
                    : "bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/60 " + (isReviewMode ? "cursor-default" : "cursor-pointer")
                )}
              >
                <span className={"w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 border transition-colors " + (
                  isCorrect
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : isWrongSelected
                    ? "bg-rose-600 text-white border-rose-600"
                    : isSelected
                    ? "bg-[#1D4ED8] text-white border-[#1D4ED8]"
                    : "bg-slate-50 text-slate-600 border-slate-200"
                )}>
                  {opt.key}
                </span>
                <div className="flex-1 min-w-0">
                  <MathRenderer content={opt.text} mediaMap={effectiveMediaMap} inline={true} onImageClick={setPreviewImage} />
                </div>
              </button>
            );
          })}
        </div>

        {/* DẢI ĐỐI CHIẾU ĐÁP ÁN KHI Ở CHẾ ĐỘ XEM LẠI BÀI LÀM (REVIEW MODE) */}
        {isReviewMode && (
          <div className="pt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Bạn đã chọn:</span>
              <span
                className={`px-2.5 py-0.5 rounded-md font-extrabold border ${
                  !stuSelectedKey
                    ? "bg-slate-100 text-slate-600 border-slate-300"
                    : stuSelectedKey === rightKey
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : "bg-rose-50 text-rose-700 border-rose-300"
                }`}
              >
                {stuSelectedKey || "Bỏ trống"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Đáp án đúng:</span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white font-extrabold">
                {rightKey}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-900/60 flex flex-col items-center justify-center text-white font-sans">
        <div className="w-10 h-10 border-4 border-white/20 border-t-blue-500 rounded-full animate-spin mb-3" />
        <p className="font-bold text-xs tracking-wide">
          {isReviewMode ? "Đang tải bài làm & lời giải chi tiết..." : "Đang tải câu hỏi & dữ liệu bài thi..."}
        </p>
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
      {/* 1. HEADER PHÒNG THI / CHẾ ĐỘ XEM LẠI BÀI LÀM */}
      <header className="h-14 sm:h-15 px-3 sm:px-6 bg-white border-b border-slate-200 shadow-2xs flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (!isSubmitted && !isReviewMode) {
                if (confirm("Bạn có muốn thoát khỏi phòng làm bài?")) {
                  onBackToDashboard();
                }
              } else {
                onBackToDashboard();
              }
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition flex items-center cursor-pointer shrink-0"
            title="Quay lại"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
          </button>
          
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isReviewMode && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shrink-0">
                  XEM LẠI BÀI LÀM
                </span>
              )}
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate max-w-[140px] sm:max-w-xs md:max-w-md">
                {quizTitle}
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-slate-500">
              <span className={isHomework ? "text-emerald-600 font-bold" : "text-[#1D4ED8] font-bold"}>
                {isHomework ? "BÀI TẬP VỀ NHÀ" : "LUYỆN ĐỀ THỰC CHIẾN"}
              </span>
              <span className="hidden sm:inline">• {profile?.full_name}</span>
              {isReviewMode && (
                <span className="text-rose-600 font-extrabold ml-1">
                  • Điểm: {score.toFixed(1)}/10
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setLayoutMode("scroll")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                layoutMode === "scroll"
                  ? "bg-white text-[#1D4ED8] shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Cuộn danh sách</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("single")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                layoutMode === "single"
                  ? "bg-white text-[#1D4ED8] shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Từng câu</span>
            </button>
          </div>

          {isReviewMode ? (
            <div className="hidden md:flex items-center gap-1.5">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                ✓ Đúng: {reviewSummaryCounts.right}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                ✕ Sai: {reviewSummaryCounts.wrong}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold">
                ○ Trống: {reviewSummaryCounts.skipped}
              </span>
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl border shadow-2xs text-xs font-semibold tabular-nums font-['Times_New_Roman',serif] tracking-wider ${timerHeaderStyles}`}>
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isHomework ? formatTimer(timeSpentSeconds) + " (Tự do)" : (durationMinutes > 0 ? formatTimer(secondsRemaining) : formatTimer(timeSpentSeconds))}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {!isSubmitted && !isReviewMode ? (
            <button
              type="button"
              disabled={isSubmitting || isGrading}
              onClick={() => handleSubmitExam()}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl font-bold text-xs sm:text-sm shadow-xs flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-60 transition"
            >
              {isSubmitting || isGrading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang chấm...</span>
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
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> <span>Đóng xem lại</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. VÙNG NỘI DUNG CÂU HỎI & SIDEBAR */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden relative">
        <main className="lg:col-span-9 flex flex-col justify-between overflow-hidden relative bg-[#F8FAFC]">
          
          <div className="flex-1 p-3 sm:p-5 lg:p-6 overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl w-full mx-auto space-y-3.5 sm:space-y-4 pb-6">
              
              {/* BANNER CHẾ ĐỘ XEM LẠI BÀI LÀM CHI TIẾT */}
              {isReviewMode && (
                <div className="p-3.5 bg-gradient-to-r from-blue-50 via-indigo-50/60 to-emerald-50/50 border border-blue-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#1D4ED8] text-white flex items-center justify-center font-black text-sm shadow-xs">
                      {score.toFixed(1)}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                        Chế độ Xem lại bài làm & Lời giải chi tiết
                      </h4>
                      <p className="text-[11px] text-slate-600 font-medium">
                        Đúng {reviewSummaryCounts.right}/{questions.length} câu • Sai {reviewSummaryCounts.wrong} câu • Bỏ trống {reviewSummaryCounts.skipped} câu
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRetake}
                    className="px-3.5 py-1.5 bg-white hover:bg-blue-50 text-[#1D4ED8] border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Làm lại đề này
                  </button>
                </div>
              )}

              {isHomework && !isReviewMode && (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center justify-between shadow-2xs">
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
                (() => {
                  const qStatus = isReviewMode ? getQuestionReviewStatus(currentQ) : null;
                  return (
                    <div
                      className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-2xs space-y-3 text-left relative ${
                        isReviewMode
                          ? qStatus === "correct"
                            ? "border-emerald-300"
                            : qStatus === "wrong"
                            ? "border-rose-300"
                            : "border-slate-200"
                          : "border-slate-200/90"
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#1D4ED8]">
                            {"Câu " + (currentIdx + 1) + " / " + questions.length}
                          </span>
                          {isQuestionTrueFalse(currentQ) ? (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">
                              Đúng / Sai
                            </span>
                          ) : isQuestionShortAnswer(currentQ) ? (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200">
                              Trả lời ngắn
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          {isReviewMode ? (
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                                qStatus === "correct"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : qStatus === "wrong"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {qStatus === "correct" ? "✓ Chính xác" : qStatus === "wrong" ? "✕ Chọn sai" : "○ Bỏ trống"}
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleFlagQuestion(currentQ.id)}
                                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition cursor-pointer ${
                                  flaggedQuestions[currentQ.id]
                                    ? "bg-amber-50 text-amber-700 border-amber-300 shadow-2xs"
                                    : "bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600"
                                }`}
                              >
                                <Flag className="w-3.5 h-3.5 fill-current" />
                                <span>{flaggedQuestions[currentQ.id] ? "Đã gắn cờ" : "Đánh dấu"}</span>
                              </button>
                              <span className="text-xs font-semibold text-slate-500">
                                {Boolean(userAnswers[currentQ.id]) ? "Đã trả lời" : "Chưa làm"}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="py-0.5">
                        <MathRenderer 
                          content={currentQ.prompt} 
                          mediaMap={currentQ.mediaMap || mediaMap || {}} 
                          onImageClick={setPreviewImage} 
                        />
                        {currentQ.image && (
                          <div className="my-3 text-center">
                            <img
                              src={resolveImageSrc(currentQ.image, currentQ.mediaMap || mediaMap || {}) || currentQ.image}
                              alt="Hình câu hỏi"
                              onClick={() => setPreviewImage(resolveImageSrc(currentQ.image!, currentQ.mediaMap || mediaMap || {}) || currentQ.image!)}
                              className="max-h-[240px] sm:max-h-[300px] max-w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-2xs object-contain mx-auto cursor-pointer"
                            />
                          </div>
                        )}
                      </div>

                      {renderQuestionOptions(currentQ)}

                      {isReviewMode && currentQ.explanation && (
                        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/90 space-y-1 text-xs mt-3">
                          <p className="font-extrabold text-amber-800 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Lời giải chi tiết:
                          </p>
                          <div className="text-slate-700 leading-relaxed font-normal">
                            <MathRenderer 
                              content={currentQ.explanation} 
                              mediaMap={currentQ.mediaMap || mediaMap || {}} 
                              onImageClick={setPreviewImage} 
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                <div className="space-y-3.5 pb-16">
                  {questions.map((q, qIndex) => {
                    const qStatus = isReviewMode ? getQuestionReviewStatus(q) : null;
                    return (
                      <div
                        key={q.id}
                        id={"question-card-" + q.id}
                        className={`bg-white rounded-2xl p-4 sm:p-5 border shadow-2xs space-y-2.5 text-left relative ${
                          isReviewMode
                            ? qStatus === "correct"
                              ? "border-emerald-300"
                              : qStatus === "wrong"
                              ? "border-rose-300"
                              : "border-slate-200"
                            : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#1D4ED8]">
                              {"Câu " + (qIndex + 1) + " / " + questions.length}
                            </span>
                            {isQuestionTrueFalse(q) ? (
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">
                                Đúng / Sai
                              </span>
                            ) : isQuestionShortAnswer(q) ? (
                              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200">
                                Trả lời ngắn
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            {isReviewMode ? (
                              <span
                                className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${
                                  qStatus === "correct"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : qStatus === "wrong"
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                                }`}
                              >
                                {qStatus === "correct" ? "✓ Chính xác" : qStatus === "wrong" ? "✕ Chọn sai" : "○ Bỏ trống"}
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => toggleFlagQuestion(q.id)}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition cursor-pointer ${
                                    flaggedQuestions[q.id]
                                      ? "bg-amber-50 text-amber-700 border-amber-300 shadow-2xs"
                                      : "bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600"
                                  }`}
                                >
                                  <Flag className="w-3.5 h-3.5 fill-current" />
                                  <span>{flaggedQuestions[q.id] ? "Đã gắn cờ" : "Đánh dấu"}</span>
                                </button>
                                <span className="text-xs font-semibold text-slate-500">
                                  {Boolean(userAnswers[q.id]) ? "Đã trả lời" : "Chưa làm"}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="py-0.5">
                          <MathRenderer 
                            content={q.prompt} 
                            mediaMap={q.mediaMap || mediaMap || {}} 
                            onImageClick={setPreviewImage} 
                          />
                          {q.image && (
                            <div className="my-3 text-center">
                              <img
                                src={resolveImageSrc(q.image, q.mediaMap || mediaMap || {}) || q.image}
                                alt="Hình câu hỏi"
                                onClick={() => setPreviewImage(resolveImageSrc(q.image!, q.mediaMap || mediaMap || {}) || q.image!)}
                                className="max-h-[240px] sm:max-h-[300px] max-w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-2xs object-contain mx-auto cursor-pointer"
                              />
                            </div>
                          )}
                        </div>

                        {renderQuestionOptions(q)}

                        {isReviewMode && q.explanation && (
                          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/90 text-xs text-slate-800 space-y-1 mt-2.5">
                            <p className="font-extrabold flex items-center gap-1.5 text-amber-800">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Lời giải chi tiết:
                            </p>
                            <div>
                              <MathRenderer 
                                content={q.explanation} 
                                mediaMap={q.mediaMap || mediaMap || {}} 
                                onImageClick={setPreviewImage} 
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {layoutMode === "single" && (
            <div className="sticky bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm border-t border-slate-200/80 py-2.5 px-4 flex items-center justify-center gap-3 sm:gap-4 shadow-sm">
              <button
                type="button"
                onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
                disabled={currentIdx === 0}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-35 text-xs font-semibold text-slate-700 transition flex items-center gap-1 cursor-pointer shadow-2xs disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Câu trước
              </button>

              <span className="text-xs font-semibold text-slate-600 px-2 select-none tracking-tight">
                Câu {currentIdx + 1} / {questions.length}
                {Boolean(userAnswers[currentQ?.id]) && (
                  <span className="ml-1.5 text-emerald-600 text-[11px] font-bold">✓</span>
                )}
              </span>

              {currentIdx < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIdx(prev => Math.min(questions.length - 1, prev + 1))}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1 cursor-pointer"
                >
                  Câu tiếp theo <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                !isSubmitted && !isReviewMode && (
                  <button
                    type="button"
                    disabled={isSubmitting || isGrading}
                    onClick={() => handleSubmitExam()}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-60"
                  >
                    <Send className="w-3.5 h-3.5" /> Nộp bài thi
                  </button>
                )
              )}
            </div>
          )}
        </main>

        {/* 3. SIDEBAR MA TRẬN CÂU HỎI (TÔ MÀU ĐÚNG XANH / SAI ĐỎ KHI Ở REVIEW MODE) */}
        <aside className="hidden lg:flex lg:col-span-3 border-l border-slate-200 bg-white p-4.5 flex-col justify-between overflow-y-auto custom-scrollbar">
          <div className="space-y-3.5">
            <div className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 shadow-2xs space-y-1 text-left">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Thí sinh</span>
              <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{profile?.full_name}</p>
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold pt-1 border-t border-slate-200/60">
                <span className="truncate">{profile?.school || "THPT"}</span>
                <span className="font-bold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-[11px]">{profile?.grade || "Lớp 12"}</span>
              </div>
            </div>

            <div className={`p-3 rounded-xl border shadow-2xs space-y-0.5 text-left transition-colors ${timerSidebarStyles}`}>
              <span className="text-[10px] font-black uppercase tracking-wider opacity-75 block">
                {isReviewMode ? "ĐIỂM BÀI LÀM" : isHomework ? "THỜI GIAN LÀM BÀI" : "THỜI GIAN CÒN LẠI"}
              </span>
              <div className="flex items-center justify-between pt-0.5">
                {isReviewMode ? (
                  <>
                    <span className="text-xl font-black text-emerald-700">{score.toFixed(1)} / 10</span>
                    <span className="text-xs font-bold text-emerald-600">
                      Đúng {reviewSummaryCounts.right}/{questions.length}
                    </span>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span className="text-lg font-semibold tracking-wider font-['Times_New_Roman',serif] tabular-nums">
                      {isHomework ? formatTimer(timeSpentSeconds) + " (Vô hạn)" : (durationMinutes > 0 ? formatTimer(secondsRemaining) : formatTimer(timeSpentSeconds))}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 text-left pt-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="uppercase text-[11px]">Danh sách câu</span>
                <span className="text-[11px] font-bold text-slate-400">{answeredCount}/{questions.length} câu</span>
              </div>

              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                <div
                  className="h-full bg-[#1D4ED8] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {questions.map((q, idx) => {
                  const isCurrent = currentIdx === idx;
                  const isAns = Boolean(userAnswers[q.id]);
                  const isFlagged = Boolean(flaggedQuestions[q.id]);
                  const qStatus = isReviewMode ? getQuestionReviewStatus(q) : null;

                  let btnColorClass = "bg-white text-slate-600 border-slate-200 hover:border-slate-300";
                  if (isReviewMode) {
                    if (qStatus === "correct") {
                      btnColorClass = "bg-emerald-500 text-white border-emerald-600 shadow-2xs";
                    } else if (qStatus === "wrong") {
                      btnColorClass = "bg-rose-500 text-white border-rose-600 shadow-2xs";
                    } else {
                      btnColorClass = "bg-slate-100 text-slate-400 border-slate-200";
                    }
                    if (isCurrent) {
                      btnColorClass += " ring-2 ring-[#1D4ED8] scale-105";
                    }
                  } else {
                    if (isCurrent) {
                      btnColorClass = "bg-[#1D4ED8] text-white border-[#1D4ED8] shadow-xs scale-105";
                    } else if (isAns) {
                      btnColorClass = "bg-blue-50 text-[#1D4ED8] border-blue-200";
                    }
                  }

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
                      className={"h-8 rounded-lg font-bold text-xs transition cursor-pointer border relative flex items-center justify-center " + btnColorClass}
                    >
                      <span>{idx + 1}</span>
                      {isFlagged && !isReviewMode && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2">
            {!isSubmitted && !isReviewMode ? (
              <button
                type="button"
                disabled={isSubmitting || isGrading}
                onClick={() => handleSubmitExam()}
                className="w-full py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5" /> {isHomework ? "Nộp BTVN" : "Nộp bài thi"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    fetchFullExamLeaderboard();
                    setShowResultModal(true);
                  }}
                  className="w-full py-2.5 bg-blue-50 text-[#1D4ED8] hover:bg-blue-100 rounded-xl font-bold text-xs border border-blue-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5" /> Bảng điểm & Xếp hạng
                </button>
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Quay lại
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* 4. NÚT DRAWER TRÊN MOBILE */}
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

      {/* 5. OVERLAY ANIMATION "ĐANG CHẤM BÀI..." (~1.8 GIÂY) */}
      <AnimatePresence>
        {isGrading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[550] bg-slate-900/75 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: -10 }}
              transition={{ type: "spring", damping: 24, stiffness: 300 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 text-center space-y-5"
            >
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                <div className="absolute inset-0 rounded-full border-4 border-[#1D4ED8] border-t-transparent animate-spin" />
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1D4ED8] flex items-center justify-center shadow-inner">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1D4ED8] text-[10px] font-black uppercase tracking-widest border border-blue-200">
                  HỆ THỐNG CHẤM THI TỰ ĐỘNG TCT
                </span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight pt-1">
                  Đang chấm bài & Phân tích kết quả...
                </h3>
                <p className="text-xs font-semibold text-slate-500 min-h-[18px]">
                  {gradingStepText}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/80 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${gradingProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-bold text-slate-400">
                  <span>Quét phiếu trả lời</span>
                  <span className="text-[#1D4ED8] font-mono">{gradingProgress}%</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. DRAWER MOBILE */}
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

              <div className="overflow-y-auto custom-scrollbar my-3 max-h-[45vh] pr-1">
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                  {questions.map((q, idx) => {
                    const isCurrent = currentIdx === idx;
                    const isAns = Boolean(userAnswers[q.id]);
                    const qStatus = isReviewMode ? getQuestionReviewStatus(q) : null;

                    let mobileColor = isCurrent
                      ? "bg-[#1D4ED8] text-white border-[#1D4ED8]"
                      : isAns
                      ? "bg-blue-50 text-[#1D4ED8] border-blue-200"
                      : "bg-white text-slate-600 border-slate-200";

                    if (isReviewMode) {
                      if (qStatus === "correct") mobileColor = "bg-emerald-500 text-white border-emerald-600";
                      else if (qStatus === "wrong") mobileColor = "bg-rose-500 text-white border-rose-600";
                      else mobileColor = "bg-slate-100 text-slate-400 border-slate-200";
                    }

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
                        className={"h-10 rounded-xl font-bold text-xs transition cursor-pointer border relative flex items-center justify-center " + mobileColor}
                      >
                        <span>{idx + 1}</span>
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
                {!isSubmitted && !isReviewMode && (
                  <button
                    type="button"
                    disabled={isSubmitting || isGrading}
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      handleSubmitExam();
                    }}
                    className="flex-1 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <Send className="w-3.5 h-3.5" /> Nộp bài
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. MODAL KẾT QUẢ THI & BẢNG XẾP HẠNG TOÀN KHÓA ĐỒNG BỘ TỪ SUPABASE */}
      <AnimatePresence>
        {showResultModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowResultModal(false)}
            className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6 bg-slate-900/65 backdrop-blur-md overflow-y-auto cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-4xl w-full p-5 sm:p-8 border border-slate-200 shadow-2xl grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 cursor-default my-auto text-left"
            >
              {/* CỘT TRÁI: ĐIỂM SỐ & NÚT XEM ĐÁP ÁN */}
              <div className="md:col-span-6 flex flex-col justify-between space-y-4 sm:space-y-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-xs">
                    <Trophy className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
                      {isHomework ? "Hoàn Thành BTVN!" : "Hoàn Thành Bài Thi!"}
                    </h3>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">{quizTitle}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#1D4ED8] block">
                        ĐIỂM ĐẠT ĐƯỢC
                      </span>
                      <span className="text-2xl sm:text-3xl font-black text-[#1D4ED8]">
                        {score.toFixed(1)} <span className="text-sm text-slate-400 font-bold">/ 10</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-700 block">
                        {"Đúng " + correctCount + "/" + questions.length + " câu trọn vẹn"}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">
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
                    className="flex-1 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-xl shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-600" /> Xem đáp án
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

              {/* CỘT PHẢI: BẢNG XẾP HẠNG TOÀN KHÓA ĐỒNG BỘ TỪ SUPABASE */}
              <div className="md:col-span-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-200 md:pl-6 space-y-3">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      <h3 className="font-black text-xs sm:text-sm text-slate-900 tracking-tight">
                        Bảng Xếp Hạng Kết Quả
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      {rankingList.length} học sinh
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 max-h-[260px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2 px-2.5 w-12 text-center">Hạng</th>
                          <th className="py-2 px-2.5">Học sinh</th>
                          <th className="py-2 px-2.5 text-right">Điểm cao nhất</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {isLoadingRanking ? (
                          <tr>
                            <td colSpan={3} className="py-8 text-center text-slate-400">
                              <Loader2 className="w-4 h-4 animate-spin inline mr-1.5 text-[#1D4ED8]" />
                              Đang đồng bộ bảng xếp hạng lớp...
                            </td>
                          </tr>
                        ) : rankingList.length === 0 ? (
                          <tr className="bg-blue-50/60 font-bold text-[#1D4ED8]">
                            <td className="py-2 px-2.5 text-center">🥇</td>
                            <td className="py-2 px-2.5 font-black truncate max-w-[140px]">
                              {profile?.full_name} <span className="text-[8px] bg-blue-200 px-1.5 py-0.5 rounded ml-1">BẠN</span>
                            </td>
                            <td className="py-2 px-2.5 text-right font-black">
                              {score.toFixed(1)}đ
                            </td>
                          </tr>
                        ) : (
                          rankingList.slice(0, 15).map((r, idx) => {
                            const rank = idx + 1;
                            const isMe = Boolean(r.isCurrentUser);
                            return (
                              <tr
                                key={r.studentKey || idx}
                                className={
                                  isMe
                                    ? "bg-blue-50/70 font-bold text-[#1D4ED8]"
                                    : "hover:bg-slate-50 text-slate-700"
                                }
                              >
                                <td className="py-2 px-2.5 text-center font-black">
                                  {rank === 1 ? (
                                    <span title="Hạng 1">🥇</span>
                                  ) : rank === 2 ? (
                                    <span title="Hạng 2">🥈</span>
                                  ) : rank === 3 ? (
                                    <span title="Hạng 3">🥉</span>
                                  ) : (
                                    <span className="text-slate-400 font-bold">#{rank}</span>
                                  )}
                                </td>
                                <td className="py-2 px-2.5 font-bold truncate max-w-[150px]">
                                  <span>{r.studentName}</span>
                                  {isMe && (
                                    <span className="ml-1.5 text-[9px] font-black bg-[#1D4ED8] text-white px-1.5 py-0.5 rounded">
                                      BẠN
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2.5 text-right font-black text-slate-900">
                                  {Number(r.score).toFixed(1)}đ
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 italic text-center">
                  Bấm nút "Xem đáp án" để xem chi tiết từng câu đúng/sai và lời giải.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 8. LIGHTBOX PHÓNG TO ẢNH */}
      <AnimatePresence>
        {previewImage && (
          <div
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
          >
            <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-2 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="absolute top-3 right-3 p-1.5 bg-slate-900/60 hover:bg-slate-900 text-white rounded-full transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <img
                src={previewImage}
                alt="Phóng to hình vẽ"
                className="max-h-[82vh] w-auto object-contain rounded-xl mx-auto"
              />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ExamRoomView;
