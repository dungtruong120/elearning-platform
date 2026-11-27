"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Eye,
  Trophy,
  Home,
  Send,
  Award,
  Check,
  X,
  Grid3X3,
  BookOpen,
  PenLine,
  Loader2,
  Flag,
  ZoomIn,
  ListFilter,
  FileText,
  Sparkles,
  ImagePlus
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
  originalId?: string;
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

interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  imagePreview?: string;
}

export interface ExamRoomViewProps {
  quizId: string;
  quizTitle: string;
  durationMinutes?: number;
  profile: Profile;
  isHomework?: boolean;
  onBackToDashboard: () => void;
  isReviewMode?: boolean;
  reviewAttempt?: any;
}

const KATEX_NORMALIZED_CLASS =
  "[&_.katex]:text-[1.03em] [&_.katex]:font-normal [&_.katex]:text-slate-800 [&_.katex-display]:my-2 [&_.katex-display]:text-[1.06em]";

function normalizeTextKey(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

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
  text = text.replace(
    /\\left\s*\\\{\s*\\begin\{(?:align|aligned|array)\}([\s\S]*?)\\end\{(?:align|aligned|array)\}\s*\\right\./gi,
    (_, body) => {
      return "$$\\begin{cases} " + body.replace(/&/g, "").trim() + " \\end{cases}$$";
    }
  );
  text = text.replace(
    /(?<!\$\$)\\begin\{(?:align|aligned)\}([\s\S]*?)\\end\{(?:align|aligned)\}(?!\$\$)/gi,
    (match) => "$" + match + "$"
  );
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
        className="inline-block max-h-12 align-middle mx-1 my-0.5 object-contain rounded border border-slate-100 bg-white cursor-pointer hover:opacity-90"
      />
    ) : (
      <span key={keyIdx} className="my-2.5 block text-center">
        <span
          className="relative inline-block group cursor-pointer"
          onClick={() => onImageClick && onImageClick(src)}
        >
          <img
            src={src}
            alt="Hình minh họa"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
            className="max-h-52 max-w-full rounded-xl border border-slate-200/90 bg-white p-1.5 object-contain mx-auto transition-transform group-hover:scale-[1.01]"
          />
          <span className="absolute bottom-2.5 right-2.5 bg-slate-900/70 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn className="w-3.5 h-3.5" />
          </span>
        </span>
      </span>
    );
  };

  return (
    <span
      className={
        (inline
          ? "inline align-baseline text-[15px] font-normal text-slate-800 "
          : "block text-[15px] font-normal leading-[1.65] text-slate-800 ") +
        KATEX_NORMALIZED_CLASS
      }
    >
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
              <span key={i} className="my-2 block text-center">
                <span className="inline-block p-2 rounded-xl bg-[#F8FAFC] border border-dashed border-slate-300 text-slate-500 text-xs font-semibold text-center">
                  [Hình vẽ: {rawKey}]
                </span>
              </span>
            );
          }

          return renderSingleImage(src, i);
        }

        if (part.startsWith("$")) {
          const isBlock = part.startsWith("$$");
          const rawMath = sanitizeLatexString(
            isBlock ? part.slice(2, -2).trim() : part.slice(1, -1).trim()
          );
          if (!rawMath) return null;

          if (/^(?:img|image)_\d+$/i.test(rawMath)) {
            const imgFromMathToken = resolveImageSrc(rawMath, mediaMap);
            if (imgFromMathToken) {
              return renderSingleImage(imgFromMathToken, i);
            }
          }

          if (!isBlock && /^[+-]?\d+(?:[.,]\d+)?$/.test(rawMath)) {
            return <span key={i}>{rawMath}</span>;
          }

          const needsDisplaySize =
            !isBlock &&
            !rawMath.startsWith("\\displaystyle") &&
            /(?:\\frac|\\int|\\sum|\\lim|\\prod)(?![a-zA-Z])/.test(rawMath);
          const math = needsDisplaySize ? `\\displaystyle ${rawMath}` : rawMath;

          try {
            return (
              <span
                key={i}
                className={
                  isBlock
                    ? "block my-2 text-center overflow-x-auto custom-scrollbar font-normal"
                    : "inline align-baseline px-0.5 font-normal"
                }
                dangerouslySetInnerHTML={{
                  __html: katex.renderToString(math, {
                    displayMode: isBlock,
                    throwOnError: false
                  })
                }}
              />
            );
          } catch {
            return (
              <span key={i} className="italic text-[#1D4ED8] px-0.5 font-normal">
                {rawMath}
              </span>
            );
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
    id: "q_1",
    originalId: "q-1",
    order: 1,
    prompt:
      "Cho hàm số $y=f(x)$ có đạo hàm $f'(x) = x(x-1)^2$. Số điểm cực trị của hàm số đã cho là:",
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

function readSavedDraftFromStorage(studentId: string, quizId: string): {
  answers: Record<string, any>;
  secondsRemaining?: number;
  timeSpentSeconds?: number;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const draftKey = `tct_draft_${studentId}_${quizId}`;
    const raw = localStorage.getItem(draftKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.answers && typeof parsed.answers === "object") {
      return {
        answers: parsed.answers,
        secondsRemaining:
          typeof parsed.secondsRemaining === "number" ? parsed.secondsRemaining : undefined,
        timeSpentSeconds:
          typeof parsed.timeSpentSeconds === "number" ? parsed.timeSpentSeconds : undefined
      };
    }
    return { answers: parsed };
  } catch {
    return null;
  }
}

function detectMentionedQuestionIndex(messageText: string, totalQuestions: number): number | null {
  if (!messageText || totalQuestions <= 0) return null;
  const norm = String(messageText).normalize("NFC");
  const match = norm.match(/(?:câu|cau)\s*(?:số|so)?\s*(\d+)/i);
  if (!match || !match[1]) return null;
  const qNum = parseInt(match[1], 10);
  if (isNaN(qNum) || qNum < 1 || qNum > totalQuestions) return null;
  return qNum - 1;
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
  const studentId = String(profile?.id || "guest");

  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, string>>({});
  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [currentIdx, setCurrentIdx] = useState<number>(0);

  const [fetchedReviewAnswers, setFetchedReviewAnswers] = useState<Record<string, any> | null>(
    null
  );

  // STATE GIA SƯ AI TỐI GIẢN (CHỈ MỞ KHI LÀM BTVN HOẶC ĐÃ NỘP / XEM LẠI)
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);
  const [aiQuestionIdx, setAiQuestionIdx] = useState<number>(0);
  const [aiMessagesByQuestion, setAiMessagesByQuestion] = useState<
    Record<string, AiChatMessage[]>
  >({});
  const [aiInputText, setAiInputText] = useState<string>("");
  const [aiDraftImageBase64, setAiDraftImageBase64] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const aiFileInputRef = useRef<HTMLInputElement | null>(null);
  const aiChatEndRef = useRef<HTMLDivElement | null>(null);

  // STATE OVERLAY CHẤM BÀI SCANNER (~1.8 GIÂY)
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [gradingProgress, setGradingProgress] = useState<number>(0);
  const [gradingStepText, setGradingStepText] = useState<string>(
    "Đang đối soát bảng đáp án trắc nghiệm..."
  );

  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const [isReviewMode, setIsReviewMode] = useState<boolean>(() => Boolean(initialReviewMode));
  const [isSubmitted, setIsSubmitted] = useState<boolean>(() => Boolean(initialReviewMode));
  const [showResultModal, setShowResultModal] = useState<boolean>(false);

  const canUseAiTutor = Boolean(isHomework || isSubmitted || isReviewMode);

  useEffect(() => {
    if (!canUseAiTutor && isAiDrawerOpen) {
      setIsAiDrawerOpen(false);
    }
  }, [canUseAiTutor, isAiDrawerOpen]);

  const [userAnswers, setUserAnswers] = useState<Record<string, any>>(() => {
    if (initialReviewMode && reviewAttempt) {
      return extractRawAnswersFromAttempt(reviewAttempt);
    }
    const savedDraft = readSavedDraftFromStorage(studentId, quizId);
    return savedDraft?.answers || {};
  });

  const [layoutMode, setLayoutMode] = useState<"single" | "scroll">(() =>
    initialReviewMode ? "scroll" : "single"
  );
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (initialReviewMode || isHomework) return 0;
    const savedDraft = readSavedDraftFromStorage(studentId, quizId);
    if (savedDraft?.secondsRemaining !== undefined && savedDraft.secondsRemaining > 0) {
      return savedDraft.secondsRemaining;
    }
    return durationMinutes > 0 ? durationMinutes * 60 : 0;
  });

  const [timeSpentSeconds, setTimeSpentSeconds] = useState<number>(() => {
    if (initialReviewMode && reviewAttempt) {
      return Number(
        reviewAttempt.duration_seconds ||
          reviewAttempt.durationSeconds ||
          reviewAttempt.completionTime ||
          0
      );
    }
    const savedDraft = readSavedDraftFromStorage(studentId, quizId);
    return savedDraft?.timeSpentSeconds || 0;
  });

  const [score, setScore] = useState<number>(() => {
    if (initialReviewMode && reviewAttempt) {
      return Number(reviewAttempt.score ?? reviewAttempt.points ?? 0);
    }
    return 0;
  });

  const [correctCount, setCorrectCount] = useState<number>(() => {
    if (initialReviewMode && reviewAttempt) {
      return Number(
        reviewAttempt.correct_count ??
          reviewAttempt.correctCount ??
          reviewAttempt.correctAnswers ??
          0
      );
    }
    return 0;
  });

  const [rankingList, setRankingList] = useState<any[]>([]);
  const [isLoadingRanking, setIsLoadingRanking] = useState<boolean>(false);
  const [historyAttemptsCount, setHistoryAttemptsCount] = useState<number>(1);

  const userAnswersRef = useRef<Record<string, any>>({});
  userAnswersRef.current = userAnswers;

  const secondsRemainingRef = useRef<number>(secondsRemaining);
  secondsRemainingRef.current = secondsRemaining;

  const timeSpentSecondsRef = useRef<number>(timeSpentSeconds);
  timeSpentSecondsRef.current = timeSpentSeconds;

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
          const expectedVal =
            expectedChar === "Đ" || expectedChar === "D" || expectedChar === "T" ? "T" : "F";
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
      return String(ans).trim().toUpperCase() ===
        String(q.correctAnswer || "")
          .trim()
          .toUpperCase()
        ? "correct"
        : "wrong";
    },
    [userAnswers, isQuestionTrueFalse, isQuestionShortAnswer, normalizeShortAnswer]
  );

  useEffect(() => {
    setFetchedReviewAnswers(null);
    if (initialReviewMode) {
      setIsReviewMode(true);
      setIsSubmitted(true);
      if (reviewAttempt) {
        setScore(Number(reviewAttempt.score ?? reviewAttempt.points ?? 0));
        setCorrectCount(
          Number(
            reviewAttempt.correct_count ??
              reviewAttempt.correctCount ??
              reviewAttempt.correctAnswers ??
              0
          )
        );
      }
    }
  }, [initialReviewMode, reviewAttempt]);

  useEffect(() => {
    if (!isReviewMode || !reviewAttempt?.id) return;
    const existingRaw = extractRawAnswersFromAttempt(reviewAttempt);
    if (Object.keys(existingRaw).length > 0) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("exam_attempts")
          .select("id, answers")
          .eq("id", reviewAttempt.id)
          .maybeSingle();

        if (!cancelled && !error && data?.answers) {
          const parsed = extractRawAnswersFromAttempt(data);
          if (Object.keys(parsed).length > 0) {
            setFetchedReviewAnswers(parsed);
          }
        }
      } catch (err) {
        console.warn("Lỗi tải cột answers theo ID cho chế độ Xem lại:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReviewMode, reviewAttempt]);

  useEffect(() => {
    if (!isReviewMode || questions.length === 0) return;

    const rawFromProp = reviewAttempt ? extractRawAnswersFromAttempt(reviewAttempt) : {};
    const rawAns =
      Object.keys(rawFromProp).length > 0
        ? rawFromProp
        : fetchedReviewAnswers && Object.keys(fetchedReviewAnswers).length > 0
          ? fetchedReviewAnswers
          : userAnswersRef.current;

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
      const sequentialKeys = [
        `q_${orderNum}`,
        String(orderNum),
        `question_${orderNum}`,
        `question-${orderNum}`,
        `cau_${orderNum}`,
        `cau-${orderNum}`
      ];

      const fallbackKeys = [q.originalId, `q-${orderNum}`].filter(Boolean) as string[];
      const orderedCandidates = [...sequentialKeys, ...fallbackKeys];

      let foundVal: any = undefined;
      if (Array.isArray(rawAns)) {
        foundVal = rawAns[idx];
      } else {
        for (const ck of orderedCandidates) {
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

    const attScore = Number(reviewAttempt?.score ?? reviewAttempt?.points ?? score ?? 0);
    const attCorrect = Number(
      reviewAttempt?.correct_count ??
        reviewAttempt?.correctCount ??
        reviewAttempt?.correctAnswers ??
        correctCount ??
        0
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
          const cleanAns = (q.correctAnswer || "ĐĐĐĐ")
            .replace(/[^A-Za-zĐđSsTtFf]/g, "")
            .toUpperCase();
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
  }, [
    isReviewMode,
    questions,
    reviewAttempt,
    fetchedReviewAnswers,
    isQuestionTrueFalse,
    isQuestionShortAnswer,
    score,
    correctCount
  ]);

  const fetchFullExamLeaderboard = useCallback(
    async (latestClientAttempt?: any) => {
      setIsLoadingRanking(true);
      const combinedPool: any[] = [];
      const profileNameLookup = new Map<string, string>();

      if (latestClientAttempt) {
        combinedPool.push(latestClientAttempt);
      }

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

      try {
        let attQuery = supabase
          .from("exam_attempts")
          .select(
            "student_id, student_name, full_name, score, points, duration_seconds, durationSeconds, completionTime, quiz_id, exam_id, quiz_title"
          );

        if (quizId) {
          attQuery = attQuery.or(`quiz_id.eq.${quizId},exam_id.eq.${quizId}`);
        } else if (quizTitle) {
          attQuery = attQuery.ilike("quiz_title", `%${quizTitle.trim()}%`);
        }

        const [dbExamAtt, dbProfiles] = await Promise.allSettled([
          attQuery.order("score", { ascending: false }).limit(50),
          supabase.from("profiles").select("id, full_name, username").limit(100)
        ]);

        if (dbExamAtt.status === "fulfilled" && Array.isArray(dbExamAtt.value?.data)) {
          combinedPool.push(...dbExamAtt.value.data);
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
      } catch {}

      const targetIdNorm = String(quizId || "").trim().toLowerCase();
      const targetTitleNorm = normalizeTextKey(quizTitle);

      const matchingExamAttempts = combinedPool.filter((a: any) => {
        if (!a) return false;
        const aId = String(a.quizId || a.quiz_id || a.exam_id || "").trim().toLowerCase();
        const aTitle = normalizeTextKey(
          a.quizTitle || a.quiz_title || a.examTitle || a.exam_title || a.title || ""
        );
        return (
          (targetIdNorm && aId === targetIdNorm) ||
          (targetTitleNorm && aTitle === targetTitleNorm)
        );
      });

      const currentUserId = String(profile?.id || (profile as any)?.username || "")
        .trim()
        .toLowerCase();
      const currentUserNameNorm = normalizeTextKey(
        profile?.full_name || (profile as any)?.username || ""
      );

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
          : normalizeTextKey(displayStudentName) ||
            rawStuId.toLowerCase() ||
            `stu_${Math.random()}`;

        const sc = Number(att.score ?? att.points ?? 0);
        const dur = Number(
          att.duration_seconds ?? att.durationSeconds ?? att.completionTime ?? 9999
        );

        const existing = groupedByStudent.get(canonicalKey);
        if (
          !existing ||
          sc > existing.score ||
          (sc === existing.score && dur < existing.durationSeconds)
        ) {
          groupedByStudent.set(canonicalKey, {
            studentKey: canonicalKey,
            studentId: rawStuId,
            studentName: displayStudentName,
            score: sc,
            durationSeconds: dur,
            isCurrentUser: isMe
          });
        }
      });

      if (latestClientAttempt && !groupedByStudent.has("__CURRENT_USER__")) {
        groupedByStudent.set("__CURRENT_USER__", {
          studentKey: "__CURRENT_USER__",
          studentId: String(profile?.id || "me"),
          studentName: String(profile?.full_name || (profile as any)?.username || "Bạn"),
          score: Number(latestClientAttempt.score ?? score ?? 0),
          durationSeconds: Number(latestClientAttempt.duration_seconds ?? timeSpentSeconds ?? 0),
          isCurrentUser: true
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

  useEffect(() => {
    if (typeof window !== "undefined" && !isSubmitted && !isReviewMode) {
      try {
        const draftKey = `tct_draft_${studentId}_${quizId}`;
        if (Object.keys(userAnswers).length > 0) {
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              answers: userAnswers,
              secondsRemaining: secondsRemainingRef.current,
              timeSpentSeconds: timeSpentSecondsRef.current,
              updatedAt: Date.now()
            })
          );
        }
      } catch {}
    }
  }, [userAnswers, studentId, quizId, isSubmitted, isReviewMode]);

  useEffect(() => {
    let isCancelled = false;

    setQuestions([]);
    setMediaMap({});
    setCurrentIdx(0);
    setIsLoadingQuestions(true);

    const loadExamQuestions = async () => {
      const loaded: QuestionItem[] = [];
      const mappedImages: Record<string, string> = {};

      try {
        let dbExam: any = null;

        const hasPayloadQuestions = (obj: any) =>
          obj &&
          ((Array.isArray(obj.data) && obj.data.length > 0) ||
            (Array.isArray(obj.sections) && obj.sections.length > 0) ||
            (Array.isArray(obj.questions) && obj.questions.length > 0));

        if (typeof window !== "undefined" && quizId) {
          try {
            const cachedExamRaw = localStorage.getItem(`tct_exam_cache_${quizId}`);
            if (cachedExamRaw) {
              const parsedCache = JSON.parse(cachedExamRaw);
              if (hasPayloadQuestions(parsedCache)) {
                dbExam = parsedCache;
              }
            }
          } catch {}
        }

        if (!dbExam && typeof window !== "undefined") {
          try {
            const cachedRoom = sessionStorage.getItem("tct_active_exam_room");
            if (cachedRoom) {
              const parsed = JSON.parse(cachedRoom);
              const isExactMatch =
                parsed &&
                (quizId
                  ? String(parsed.id || "").trim() === String(quizId).trim()
                  : String(parsed.title || "").trim() === String(quizTitle).trim());
              if (isExactMatch && hasPayloadQuestions(parsed)) {
                dbExam = parsed;
              }
            }
          } catch {}
        }

        if (!dbExam) {
          const targetTable = isHomework ? "homeworks" : "practice_exams";
          const primaryCols = isHomework
            ? "id, lesson_id, title, data, sections, media_map, duration_minutes"
            : "id, title, data, media_map, duration_minutes";
          const fallbackCols = "id, title, data, duration_minutes";

          const querySingleRowWithFallback = async (
            mode: "id" | "title",
            value: string
          ): Promise<any | null> => {
            const runSelect = async (cols: string) => {
              let q = supabase.from(targetTable).select(cols);
              if (mode === "id") {
                const filterQuery = isHomework
                  ? `id.eq.${value},lesson_id.eq.${value}`
                  : `id.eq.${value}`;
                q = q.or(filterQuery);
              } else {
                q = q.ilike("title", `%${value}%`);
              }
              return await q.limit(1).maybeSingle();
            };

            const resPrimary = await runSelect(primaryCols);
            if (!resPrimary.error && resPrimary.data) {
              return resPrimary.data;
            }
            if (resPrimary.error) {
              const resFallback = await runSelect(fallbackCols);
              if (!resFallback.error && resFallback.data) {
                return resFallback.data;
              }
            }
            return null;
          };

          if (quizId) {
            dbExam = await querySingleRowWithFallback("id", String(quizId).trim());
          }

          if (!dbExam && quizTitle) {
            dbExam = await querySingleRowWithFallback("title", quizTitle.trim());
          }

          if (!dbExam) {
            const { data: allLessons } = await supabase
              .from("lessons")
              .select("id, title, homework_files, test_quizzes");

            if (Array.isArray(allLessons)) {
              const normTargetId = String(quizId || "").trim().toLowerCase();
              const normTargetTitle = normalizeTextKey(quizTitle);

              for (const les of allLessons) {
                const pool = [
                  ...(Array.isArray(les.homework_files) ? les.homework_files : []),
                  ...(Array.isArray(les.test_quizzes) ? les.test_quizzes : [])
                ];

                const matched = pool.find((item: any) => {
                  if (!item) return false;
                  const iId = String(item.id || item.quiz_id || item.exam_id || "")
                    .trim()
                    .toLowerCase();
                  const iTitle = normalizeTextKey(item.title || "");
                  return (
                    (normTargetId && iId === normTargetId) ||
                    (normTargetTitle &&
                      (iTitle === normTargetTitle || iTitle.includes(normTargetTitle)))
                  );
                });

                if (matched) {
                  dbExam = matched;
                  break;
                }
              }
            }
          }

          if (dbExam && quizId && typeof window !== "undefined") {
            try {
              localStorage.setItem(`tct_exam_cache_${quizId}`, JSON.stringify(dbExam));
            } catch {}
          }
        }

        let targetExam = dbExam;

        if (!targetExam && typeof window !== "undefined") {
          try {
            const saved = localStorage.getItem("edunexus_practice_exams");
            if (saved) {
              const parsed = JSON.parse(saved);
              const list = Array.isArray(parsed) ? parsed : parsed?.exams || [];
              targetExam = list.find(
                (e: any) =>
                  (quizId && (e.id === quizId || e.lesson_id === quizId)) ||
                  (!quizId && e.title === quizTitle)
              );
            }
          } catch {}
        }

        if (targetExam) {
          if (targetExam.media_map && typeof targetExam.media_map === "object") {
            Object.assign(mappedImages, targetExam.media_map);
          }

          const extractAllQuestionsFromPayload = (...candidates: any[]): any[] => {
            for (let c of candidates) {
              if (!c) continue;
              if (typeof c === "string") {
                try {
                  c = JSON.parse(c);
                } catch {
                  continue;
                }
              }
              if (c && typeof c === "object" && !Array.isArray(c)) {
                if (c.media_map && typeof c.media_map === "object") {
                  Object.assign(mappedImages, c.media_map);
                }
                const inner = c.sections || c.questions || c.data || c.items;
                if (Array.isArray(inner) && inner.length > 0) {
                  c = inner;
                }
              }
              if (Array.isArray(c) && c.length > 0) {
                return c;
              }
            }
            return [];
          };

          const rawData = extractAllQuestionsFromPayload(
            targetExam.sections,
            targetExam.data,
            targetExam.questions_data,
            targetExam.questions
          );

          if (Array.isArray(rawData) && rawData.length > 0) {
            let qIdx = 1;

            rawData.forEach((item: any) => {
              if (!item) return;
              if (item.media_map && typeof item.media_map === "object") {
                Object.assign(mappedImages, item.media_map);
              }

              if (Array.isArray(item.questions) && item.questions.length > 0) {
                const secType =
                  item.section_type ||
                  item.type ||
                  (item.section_title && /đúng\s*sai/i.test(item.section_title)
                    ? "true_false"
                    : item.section_title && /trả\s*lời\s*ngắn|điền/i.test(item.section_title)
                      ? "short_answer"
                      : "multiple_choice");

                item.questions.forEach((q: any) => {
                  const qType = q.type || secType || "multiple_choice";
                  const promptStr = q.prompt_html || q.prompt || q.question || q.content || "";
                  const hasInlineImgToken =
                    /\[(?:img|image):/i.test(promptStr) || /<img\s/i.test(promptStr);

                  if (q.media_map && typeof q.media_map === "object") {
                    Object.assign(mappedImages, q.media_map);
                  }

                  const seqNum = qIdx++;
                  loaded.push({
                    id: `q_${seqNum}`,
                    originalId: q.id ? String(q.id).trim() : undefined,
                    order: seqNum,
                    type: qType,
                    prompt: promptStr,
                    options: (q.options || []).map((opt: any) => ({
                      key: opt.key,
                      text: opt.text_html || opt.text || ""
                    })),
                    correctAnswer: q.correct_answer || q.correctAnswer || "A",
                    explanation:
                      q.solution_html ||
                      q.solution ||
                      q.explanation ||
                      "Đang cập nhật lời giải chi tiết.",
                    image: !hasInlineImgToken
                      ? q.image || (q.images && q.images[0]) || undefined
                      : undefined,
                    mediaMap: mappedImages
                  });
                });
              } else if (
                item.prompt_html ||
                item.prompt ||
                item.question ||
                item.content ||
                Array.isArray(item)
              ) {
                const flatList = Array.isArray(item) ? item : [item];
                flatList.forEach((q: any) => {
                  const promptStr = q.prompt_html || q.prompt || q.question || q.content || "";
                  if (!promptStr) return;
                  const hasInlineImgToken =
                    /\[(?:img|image):/i.test(promptStr) || /<img\s/i.test(promptStr);

                  if (q.media_map && typeof q.media_map === "object") {
                    Object.assign(mappedImages, q.media_map);
                  }

                  const seqNum = qIdx++;
                  loaded.push({
                    id: `q_${seqNum}`,
                    originalId: q.id ? String(q.id).trim() : undefined,
                    order: seqNum,
                    type: q.type || "multiple_choice",
                    prompt: promptStr,
                    options: (q.options || []).map((opt: any) => ({
                      key: opt.key,
                      text: opt.text_html || opt.text || ""
                    })),
                    correctAnswer: q.correct_answer || q.correctAnswer || "A",
                    explanation:
                      q.solution_html ||
                      q.solution ||
                      q.explanation ||
                      "Đang cập nhật lời giải chi tiết.",
                    image: !hasInlineImgToken
                      ? q.image || (q.images && q.images[0]) || undefined
                      : undefined,
                    mediaMap: mappedImages
                  });
                });
              }
            });
          }
        }
      } catch (err) {
        console.error("Lỗi khi nạp dữ liệu đề thi:", err);
      } finally {
        if (!isCancelled) {
          setQuestions(loaded.length > 0 ? loaded : DEFAULT_QUESTIONS);
          setMediaMap(mappedImages);
          setIsLoadingQuestions(false);
        }
      }
    };

    loadExamQuestions();

    return () => {
      isCancelled = true;
    };
  }, [quizId, quizTitle, isHomework]);

  useEffect(() => {
    if (isLoadingQuestions || isSubmitted || isReviewMode || isGrading) return;
    const timer = setInterval(() => {
      setTimeSpentSeconds((prev) => prev + 1);
      if (!isHomework && durationMinutes > 0) {
        setSecondsRemaining((prev) => {
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
  }, [isLoadingQuestions, isSubmitted, isReviewMode, isGrading, durationMinutes, isHomework]);

  const handleSelectOption = (questionId: string, optionKey: string) => {
    if (isSubmitted || isReviewMode || isGrading) return;
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey
    }));
  };

  const handleSelectTrueFalseOption = (questionId: string, optKey: string, value: "T" | "F") => {
    if (isSubmitted || isReviewMode || isGrading) return;
    setUserAnswers((prev) => {
      const currentTF =
        typeof prev[questionId] === "object" && prev[questionId] !== null
          ? { ...prev[questionId] }
          : {};
      currentTF[optKey.toLowerCase()] = value;
      return {
        ...prev,
        [questionId]: currentTF
      };
    });
  };

  const handleShortAnswerChange = (questionId: string, val: string) => {
    if (isSubmitted || isReviewMode || isGrading) return;
    setUserAnswers((prev) => ({
      ...prev,
      [questionId]: val
    }));
  };

  const toggleFlagQuestion = (qId: string) => {
    setFlaggedQuestions((prev) => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  function sanitizeAnswersPayload(rawAnswers: Record<string, any>): Record<string, any> {
    if (!rawAnswers || typeof rawAnswers !== "object") return {};

    const cleaned: Record<string, any> = {};

    Object.entries(rawAnswers).forEach(([key, val]) => {
      if (key === "bubble_coordinates" || key === "bubbleCoordinates") return;

      if (key === "__paper_omr_meta") {
        if (val && typeof val === "object") {
          cleaned.__paper_omr_meta = {
            school: val.school || "THPT",
            detected_sbd: val.detected_sbd || "",
            detected_exam_code: val.detected_exam_code || "101",
            student_name: val.student_name || "",
            submission_type: val.submission_type || "paper",
            exam_title: val.exam_title || "",
            scanned_image_url: val.scanned_image_url || "",
            flagged_questions: val.flagged_questions || []
          };
        }
        return;
      }

      cleaned[key] = val;
    });

    return cleaned;
  }

  const handleSubmitExam = async () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(`tct_draft_${studentId}_${quizId}`);
        sessionStorage.removeItem("tct_active_exam_room");
        sessionStorage.removeItem("tct_dashboard_cache_v1");
      } catch {}
    }
    if (isSubmitting || isGrading || isReviewMode) return;
    setIsSubmitting(true);
    setIsGrading(true);
    setGradingProgress(8);
    setGradingStepText("Đang đối soát bảng đáp án trắc nghiệm...");
    setIsMobileDrawerOpen(false);
    setIsAiDrawerOpen(false);

    const rawAnswers = userAnswersRef.current;

    const cleanAnswersPayload: Record<string, any> = {};
    questions.forEach((q, idx) => {
      const qNum = idx + 1;
      const canonicalKey = `q_${qNum}`;
      const val = rawAnswers[canonicalKey] ?? rawAnswers[q.id];

      if (val !== undefined && val !== null) {
        cleanAnswersPayload[canonicalKey] = val;
        cleanAnswersPayload[String(qNum)] = val;
      }
    });

    let totalPoints = 0;
    let fullCorrectCount = 0;

    questions.forEach((q, idx) => {
      const isTF = isQuestionTrueFalse(q);
      const isShort = isQuestionShortAnswer(q);
      const stuAns = cleanAnswersPayload[`q_${idx + 1}`];

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

        q.options.forEach((opt, optIdx) => {
          const expectedChar = cleanAns[optIdx] || "Đ";
          const expectedVal =
            expectedChar === "Đ" || expectedChar === "D" || expectedChar === "T" ? "T" : "F";
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
      } catch {}
    }

    const durationText =
      Math.floor(timeSpentSeconds / 60) + " phút " + (timeSpentSeconds % 60) + " giây";
    const nowIso = new Date().toISOString();
    const stuId = String(profile?.id || (profile as any)?.username || "student");
    const studentName = String(profile?.full_name || (profile as any)?.username || "Học sinh");
    const attemptId = "att-" + Date.now();

    const finalCleanAnswers = sanitizeAnswersPayload(cleanAnswersPayload);

    const clientRecord: any = {
      id: attemptId,
      quiz_id: String(quizId),
      quizId: String(quizId),
      exam_id: String(quizId),
      quiz_title: String(quizTitle),
      quizTitle: String(quizTitle),
      exam_title: String(quizTitle),
      examTitle: String(quizTitle),
      student_id: stuId,
      studentId: stuId,
      user_id: stuId,
      student_name: studentName,
      studentName: studentName,
      full_name: studentName,
      school: profile?.school || "THPT",
      score: calculatedScore,
      points: calculatedScore,
      total_questions: questions.length,
      correct_count: fullCorrectCount,
      time_spent: durationText,
      duration_seconds: timeSpentSeconds,
      is_homework: Boolean(isHomework),
      type: isHomework ? "homework" : "practice",
      submission_type: "web",
      answers: finalCleanAnswers,
      created_at: nowIso,
      updated_at: nowIso
    };

    const supabasePayload: any = {
      id: attemptId,
      quiz_id: String(quizId),
      exam_id: String(quizId),
      quiz_title: String(quizTitle),
      exam_title: String(quizTitle),
      student_id: stuId,
      student_name: studentName,
      full_name: studentName,
      school: profile?.school || "THPT",
      score: calculatedScore,
      points: calculatedScore,
      total_questions: questions.length,
      correct_count: fullCorrectCount,
      correct_answers_count: fullCorrectCount,
      time_spent: durationText,
      duration_seconds: timeSpentSeconds,
      is_homework: Boolean(isHomework),
      type: isHomework ? "homework" : "practice",
      submission_type: "web",
      answers: finalCleanAnswers,
      created_at: nowIso,
      updated_at: nowIso
    };

    if (typeof window !== "undefined") {
      try {
        const savedAttempts = localStorage.getItem("edunexus_attempts");
        const parsed = savedAttempts ? JSON.parse(savedAttempts) : [];
        const updatedAttempts = [clientRecord, ...parsed];
        localStorage.setItem("edunexus_attempts", JSON.stringify(updatedAttempts));
        window.dispatchEvent(new Event("storage"));

        const studentPastAttempts = updatedAttempts.filter(
          (a: any) =>
            (a.studentId === stuId || a.studentName === studentName) &&
            (a.quizId === quizId || a.quizTitle === quizTitle)
        );
        setHistoryAttemptsCount(studentPastAttempts.length);
      } catch {}
    }

    const syncTasks = (async () => {
      try {
        await fetch("/api/student/submit-quiz", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clientRecord)
        });
      } catch {}

      try {
        const { error: dbErr } = await supabase.from("exam_attempts").insert([supabasePayload]);
        if (dbErr) {
          console.error("Lỗi lưu Supabase exam_attempts:", dbErr);
        }
      } catch (errDb) {
        console.error("Lỗi kết nối Supabase:", errDb);
      }

      try {
        const channel = supabase.channel("admin-realtime-global-sync");
        await channel.send({
          type: "broadcast",
          event: "new_attempt",
          payload: clientRecord
        });
      } catch {}

      await fetchFullExamLeaderboard(clientRecord);
    })();

    await Promise.all([syncTasks, new Promise((resolve) => setTimeout(resolve, 1800))]);

    clearTimeout(stepTimer1);
    clearTimeout(stepTimer2);
    setGradingProgress(100);

    setIsGrading(false);
    setIsSubmitting(false);
    setIsSubmitted(true);
    setShowResultModal(true);
  };

  const handleRetake = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(`tct_draft_${studentId}_${quizId}`);
        localStorage.removeItem(`tct_hw_draft_${studentId}_${quizId}`);
      } catch {}
    }
    setUserAnswers({});
    setFetchedReviewAnswers(null);
    setCurrentIdx(0);
    setIsSubmitted(false);
    setShowResultModal(false);
    setIsReviewMode(false);
    setIsMobileDrawerOpen(false);
    setIsAiDrawerOpen(false);
    setSecondsRemaining(!isHomework && durationMinutes > 0 ? durationMinutes * 60 : 0);
    setTimeSpentSeconds(0);
  };

  const handleViewSolutions = () => {
    setShowResultModal(false);
    setIsReviewMode(true);
    setIsSubmitted(true);
    setCurrentIdx(0);
  };

  const handleOpenAiDrawer = () => {
    if (!canUseAiTutor) return;
    setAiQuestionIdx(Math.min(Math.max(0, currentIdx), Math.max(0, questions.length - 1)));
    setIsMobileDrawerOpen(false);
    setIsAiDrawerOpen(true);
  };

  const selectedAiQuestion = questions[aiQuestionIdx] || questions[0];
  const aiThreadKey = selectedAiQuestion ? `${quizId}_${selectedAiQuestion.id}` : "default";
  const currentAiMessages = aiMessagesByQuestion[aiThreadKey] || [];

  useEffect(() => {
    if (isAiDrawerOpen && aiChatEndRef.current) {
      aiChatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentAiMessages.length, isAiDrawerOpen, isAiLoading]);

  const handleAiImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAiDraftImageBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSendAiPrompt = async (customPrompt?: string) => {
    if (!canUseAiTutor) return;
    const promptText = (customPrompt !== undefined ? customPrompt : aiInputText).trim();
    if ((!promptText && !aiDraftImageBase64) || isAiLoading || questions.length === 0) return;

    const mentionedIdx = detectMentionedQuestionIndex(promptText, questions.length);
    const targetQuestionIdx = mentionedIdx !== null ? mentionedIdx : aiQuestionIdx;
    const targetQuestion = questions[targetQuestionIdx] || questions[0];
    if (!targetQuestion) return;

    if (mentionedIdx !== null && mentionedIdx !== aiQuestionIdx) {
      setAiQuestionIdx(mentionedIdx);
    }

    const targetThreadKey = `${quizId}_${targetQuestion.id}`;
    const targetHistory = aiMessagesByQuestion[targetThreadKey] || [];

    const userMsg: AiChatMessage = {
      id: "u-" + Date.now(),
      role: "user",
      text: promptText || "Nhờ Gia sư AI kiểm tra giúp ảnh nháp của câu này.",
      imagePreview: aiDraftImageBase64 || undefined
    };

    const attachedImg = aiDraftImageBase64;
    if (customPrompt === undefined) setAiInputText("");
    setAiDraftImageBase64(null);

    setAiMessagesByQuestion((prev) => ({
      ...prev,
      [targetThreadKey]: [...(prev[targetThreadKey] || []), userMsg]
    }));

    setIsAiLoading(true);
    try {
      const modeVal =
        isReviewMode || isSubmitted
          ? "REVIEW_SOCRATIC"
          : isHomework
            ? "HOMEWORK_HINT"
            : "HOMEWORK_HINT";

      const res = await fetch("/api/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: modeVal,
          questionKey: targetThreadKey,
          lessonTitle: `${quizTitle} - Câu ${targetQuestionIdx + 1}`,
          questionType: isQuestionTrueFalse(targetQuestion)
            ? "true_false"
            : isQuestionShortAnswer(targetQuestion)
              ? "short_answer"
              : "multiple_choice",
          questionText: targetQuestion.prompt,
          options: (targetQuestion.options || []).map((o) => `${o.key}. ${o.text}`),
          studentAnswer:
            typeof userAnswers[targetQuestion.id] === "object"
              ? JSON.stringify(userAnswers[targetQuestion.id])
              : String(userAnswers[targetQuestion.id] || ""),
          correctAnswer: isReviewMode || isSubmitted ? targetQuestion.correctAnswer : undefined,
          officialSolution: isReviewMode || isSubmitted ? targetQuestion.explanation : undefined,
          message: userMsg.text,
          imageBase64: attachedImg || undefined,
          history: targetHistory.slice(-6).map((m) => ({
            role: m.role,
            content: m.text
          }))
        })
      });

      let replyText = "Gia sư AI đang tạm bận, em vui lòng thử gửi lại sau vài giây nhé.";
      if (res.ok) {
        const data = await res.json();
        replyText =
          data?.reply ||
          data?.message ||
          data?.answer ||
          data?.text ||
          "Em thử phân tích giả thiết đề bài trước và cho thầy biết bước đầu tiên nhé!";
      }

      setAiMessagesByQuestion((prev) => ({
        ...prev,
        [targetThreadKey]: [
          ...(prev[targetThreadKey] || []),
          {
            id: "a-" + Date.now(),
            role: "assistant",
            text: replyText
          }
        ]
      }));
    } catch {
      setAiMessagesByQuestion((prev) => ({
        ...prev,
        [targetThreadKey]: [
          ...(prev[targetThreadKey] || []),
          {
            id: "a-" + Date.now(),
            role: "assistant",
            text: "Không thể kết nối tới Gia sư AI lúc này. Em kiểm tra lại mạng và thử lại nhé."
          }
        ]
      }));
    } finally {
      setIsAiLoading(false);
    }
  };

  const navigateToQuestion = (targetIdx: number) => {
    const safeIdx = Math.min(Math.max(0, targetIdx), Math.max(0, questions.length - 1));
    setCurrentIdx(safeIdx);
    if (layoutMode === "scroll") {
      const targetQ = questions[safeIdx];
      if (targetQ) {
        const el = document.getElementById("question-card-" + targetQ.id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  };

  const answeredCount = useMemo(() => {
    return questions.filter((q) => {
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
    if (isHomework) return "bg-blue-50/70 border-blue-200/70 text-[#1D4ED8]";
    if (secondsRemaining <= 60) return "bg-rose-50 border-rose-300 text-rose-600 animate-pulse";
    if (secondsRemaining <= 300) return "bg-amber-50 border-amber-300 text-amber-700";
    return "bg-blue-50/70 border-blue-200/70 text-[#1D4ED8]";
  }, [secondsRemaining, isHomework]);

  const timerSidebarStyles = useMemo(() => {
    if (isReviewMode) return "bg-[#F8FAFC] border-slate-200/90 text-slate-800";
    if (isHomework) return "bg-[#F8FAFC] border-slate-200/90 text-[#1D4ED8]";
    if (secondsRemaining <= 60) return "bg-rose-50 border-rose-200 text-rose-600 animate-pulse";
    if (secondsRemaining <= 300) return "bg-amber-50 border-amber-200 text-amber-700";
    return "bg-[#F8FAFC] border-slate-200/90 text-[#1D4ED8]";
  }, [secondsRemaining, isHomework, isReviewMode]);

  const renderQuestionOptions = (q: QuestionItem) => {
    const isTF = isQuestionTrueFalse(q);
    const isShort = isQuestionShortAnswer(q);
    const effectiveMediaMap = q.mediaMap || mediaMap || {};

    if (isShort) {
      const currentAns =
        userAnswers[q.id] !== undefined && userAnswers[q.id] !== null
          ? String(userAnswers[q.id])
          : "";
      const isCorrect =
        isReviewMode && normalizeShortAnswer(currentAns) === normalizeShortAnswer(q.correctAnswer);

      return (
        <div className="pt-1 space-y-2">
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-200/90 space-y-2">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5 text-[#1D4ED8]" />
              <span>Điền đáp án câu trả lời ngắn:</span>
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                disabled={isSubmitted || isReviewMode}
                value={currentAns}
                onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => handleShortAnswerChange(q.id, e.target.value)}
                placeholder={
                  isReviewMode
                    ? "Học sinh bỏ trống câu này"
                    : "Nhập kết quả (VD: 12,5 hoặc -3)..."
                }
                className={
                  "flex-1 py-2 px-3 bg-white border rounded-lg text-[15px] font-semibold outline-none transition " +
                  (isReviewMode
                    ? isCorrect
                      ? "border-emerald-500 bg-white text-emerald-900"
                      : "border-rose-400 bg-white text-rose-900"
                    : currentAns
                      ? "border-[#1D4ED8] bg-blue-50/20 text-blue-950 focus:ring-2 focus:ring-blue-100"
                      : "border-slate-200/90 text-slate-800 focus:border-[#1D4ED8]")
                }
              />
              {currentAns && !isReviewMode && (
                <span className="text-[11px] font-semibold text-[#1D4ED8] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 shrink-0 text-center">
                  Đã ghi nhận ✓
                </span>
              )}
            </div>

            {isReviewMode && (
              <div className="pt-1 flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="text-slate-500">Bạn đã điền:</span>
                <span
                  className={`px-2 py-0.5 rounded-md border ${
                    isCorrect
                      ? "bg-white text-emerald-700 border-emerald-300"
                      : "bg-white text-rose-700 border-rose-300"
                  }`}
                >
                  {currentAns.trim() ? currentAns : "Bỏ trống"}
                </span>
                <span className="text-slate-500 ml-1">Đáp án chuẩn:</span>
                <span className="px-2 py-0.5 bg-[#1D4ED8] text-white rounded-md">
                  {q.correctAnswer}
                </span>
                {isCorrect ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Chính xác (+1.0 điểm)
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> {currentAns.trim() ? "Chưa đúng" : "Chưa làm"}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (isTF) {
      const userTF =
        typeof userAnswers[q.id] === "object" && userAnswers[q.id] ? userAnswers[q.id] : {};
      const cleanAns = (q.correctAnswer || "").replace(/[^A-Za-zĐđSsTtFf]/g, "").toUpperCase();

      return (
        <div className={`pt-1 ${KATEX_NORMALIZED_CLASS}`}>
          <div className="overflow-hidden border border-slate-200/90 rounded-xl bg-white">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200/90 bg-[#F8FAFC] text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-2 px-3.5 text-left font-semibold">Phát biểu</th>
                  <th className="py-2 px-2 text-center w-14 sm:w-16 font-semibold text-emerald-700">
                    Đúng
                  </th>
                  <th className="py-2 px-2 text-center w-14 sm:w-16 font-semibold text-rose-600">
                    Sai
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[15px] font-normal leading-[1.65] text-slate-800">
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
                  const expectedVal =
                    expectedChar === "Đ" || expectedChar === "D" || expectedChar === "T"
                      ? "T"
                      : "F";

                  return (
                    <tr key={opt.key} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-2.5 px-3.5 align-middle">
                        <div className="flex items-start gap-2">
                          <span className="font-semibold text-[#1D4ED8] shrink-0 mt-0.5 text-[14px]">
                            {opt.key})
                          </span>
                          <div className="flex-1 min-w-0">
                            <MathRenderer
                              content={opt.text}
                              mediaMap={effectiveMediaMap}
                              inline={true}
                              onImageClick={setPreviewImage}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-2 text-center align-middle">
                        <button
                          type="button"
                          disabled={isSubmitted || isReviewMode}
                          onClick={() => handleSelectTrueFalseOption(q.id, opt.key, "T")}
                          className={
                            "w-7 h-7 rounded-lg border flex items-center justify-center mx-auto transition-all " +
                            (isReviewMode
                              ? expectedVal === "T"
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : selectedVal === "T"
                                  ? "bg-rose-500 border-rose-600 text-white"
                                  : "border-slate-200 text-slate-300 opacity-60"
                              : selectedVal === "T"
                                ? "bg-[#1D4ED8] border-[#1D4ED8] text-white scale-105 cursor-pointer"
                                : "border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/40 text-slate-400 cursor-pointer")
                          }
                        >
                          {isReviewMode ? (
                            expectedVal === "T" ? (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            ) : selectedVal === "T" ? (
                              <X className="w-3.5 h-3.5 stroke-[3]" />
                            ) : null
                          ) : selectedVal === "T" ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : null}
                        </button>
                      </td>

                      <td className="py-2.5 px-2 text-center align-middle">
                        <button
                          type="button"
                          disabled={isSubmitted || isReviewMode}
                          onClick={() => handleSelectTrueFalseOption(q.id, opt.key, "F")}
                          className={
                            "w-7 h-7 rounded-lg border flex items-center justify-center mx-auto transition-all " +
                            (isReviewMode
                              ? expectedVal === "F"
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : selectedVal === "F"
                                  ? "bg-rose-500 border-rose-600 text-white"
                                  : "border-slate-200 text-slate-300 opacity-60"
                              : selectedVal === "F"
                                ? "bg-[#1D4ED8] border-[#1D4ED8] text-white scale-105 cursor-pointer"
                                : "border-slate-200 hover:border-blue-300 bg-white hover:bg-blue-50/40 text-slate-400 cursor-pointer")
                          }
                        >
                          {isReviewMode ? (
                            expectedVal === "F" ? (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            ) : selectedVal === "F" ? (
                              <X className="w-3.5 h-3.5 stroke-[3]" />
                            ) : null
                          ) : selectedVal === "F" ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : null}
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

    const stuSelectedKey =
      userAnswers[q.id] !== undefined && userAnswers[q.id] !== null
        ? String(userAnswers[q.id]).trim().toUpperCase()
        : "";
    const rightKey = String(q.correctAnswer || "A").trim().toUpperCase();

    return (
      <div className={`space-y-2.5 pt-1 ${KATEX_NORMALIZED_CLASS}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {q.options.map((opt) => {
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
                className={
                  "py-2.5 px-3.5 rounded-xl border text-left flex items-center gap-2.5 transition-all text-[15px] font-normal leading-[1.8] text-slate-800 " +
                  (isCorrect
                    ? "bg-[#F8FAFC] border-emerald-500 text-slate-900 ring-1 ring-emerald-500/25"
                    : isWrongSelected
                      ? "bg-[#F8FAFC] border-rose-400 text-slate-900 ring-1 ring-rose-400/25"
                      : isSelected
                        ? "bg-blue-50/60 border-[#1D4ED8] text-slate-900 ring-1 ring-[#1D4ED8]/20 cursor-pointer"
                        : "bg-white border-slate-200/90 hover:border-slate-300 text-slate-800 hover:bg-[#F8FAFC] " +
                          (isReviewMode ? "cursor-default" : "cursor-pointer"))
                }
              >
                <span
                  className={
                    "w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 border transition-colors " +
                    (isCorrect
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : isWrongSelected
                        ? "bg-rose-600 text-white border-rose-600"
                        : isSelected
                          ? "bg-[#1D4ED8] text-white border-[#1D4ED8]"
                          : "bg-[#F8FAFC] text-slate-600 border-slate-200/90")
                  }
                >
                  {opt.key}
                </span>
                <div className="flex-1 min-w-0">
                  <MathRenderer
                    content={opt.text}
                    mediaMap={effectiveMediaMap}
                    inline={true}
                    onImageClick={setPreviewImage}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {isReviewMode && (
          <div className="pt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Bạn đã chọn:</span>
              <span
                className={`px-2 py-0.5 rounded-md font-bold border ${
                  !stuSelectedKey
                    ? "bg-[#F8FAFC] text-slate-600 border-slate-200/90"
                    : stuSelectedKey === rightKey
                      ? "bg-white text-emerald-700 border-emerald-300"
                      : "bg-white text-rose-700 border-rose-300"
                }`}
              >
                {stuSelectedKey || "Bỏ trống"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">Đáp án đúng:</span>
              <span className="px-2 py-0.5 rounded-md bg-[#1D4ED8] text-white font-bold">
                {rightKey}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isLoadingQuestions || questions.length === 0) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#F1F5F9] flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl px-8 py-7 flex flex-col items-center gap-3.5 max-w-sm w-full text-center">
          <Loader2 className="w-8 h-8 text-[#1D4ED8] animate-spin" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900">Đang tải nội dung đề thi...</p>
            <p className="text-xs text-slate-500 truncate max-w-[260px]">{quizTitle}</p>
          </div>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentIdx] || questions[0];

  return (
    <div className="fixed inset-0 z-[120] bg-[#F1F5F9] text-slate-800 flex flex-col overflow-hidden antialiased">
      {/* 1. HEADER PHÒNG THI */}
      <header className="h-14 sm:h-16 px-3 sm:px-6 bg-white border-b border-slate-200/90 flex items-center justify-between gap-2 shrink-0 z-30">
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
            className="p-1.5 sm:p-2 rounded-lg bg-[#F8FAFC] hover:bg-slate-100 text-slate-700 border border-slate-200/90 transition flex items-center cursor-pointer shrink-0"
            title="Quay lại"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isReviewMode && (
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#1D4ED8] border border-blue-200 text-[10px] font-bold uppercase tracking-wider shrink-0">
                  XEM LẠI
                </span>
              )}
              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate max-w-[150px] sm:max-w-xs md:max-w-md">
                {quizTitle}
              </h2>
            </div>

            {isReviewMode ? (
              <div className="text-[11px] font-medium text-slate-500 truncate">
                Đúng {reviewSummaryCounts.right}/{questions.length} câu • Điểm:{" "}
                <span className="font-bold text-[#1D4ED8]">{score.toFixed(1)}/10</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-slate-500">
                <span className="text-[#1D4ED8] font-bold">
                  {isHomework ? "BÀI TẬP VỀ NHÀ" : "LUYỆN ĐỀ THỰC CHIẾN"}
                </span>
                <span className="hidden sm:inline">• {profile?.full_name}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center bg-[#F1F5F9] p-0.5 rounded-lg border border-slate-200/90">
            <button
              type="button"
              onClick={() => setLayoutMode("scroll")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                layoutMode === "scroll"
                  ? "bg-white text-[#1D4ED8] border border-slate-200/80"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Cuộn danh sách</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("single")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                layoutMode === "single"
                  ? "bg-white text-[#1D4ED8] border border-slate-200/80"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Từng câu</span>
            </button>
          </div>

          {!isReviewMode && (
            <div
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg border text-xs font-semibold tabular-nums font-['Times_New_Roman',serif] tracking-wider ${timerHeaderStyles}`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isHomework
                  ? formatTimer(timeSpentSeconds)
                  : durationMinutes > 0
                    ? formatTimer(secondsRemaining)
                    : formatTimer(timeSpentSeconds)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {canUseAiTutor && (
            <button
              type="button"
              onClick={handleOpenAiDrawer}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F8FAFC] hover:bg-blue-50/40 text-slate-700 hover:text-[#1D4ED8] border border-slate-200/90 text-xs font-semibold transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#1D4ED8]" />
              <span>Gia sư AI</span>
            </button>
          )}

          {!isSubmitted && !isReviewMode ? (
            <button
              type="button"
              disabled={isSubmitting || isGrading}
              onClick={() => handleSubmitExam()}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-lg font-semibold text-xs sm:text-sm flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-60 transition"
            >
              {isSubmitting || isGrading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang chấm...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    Nộp bài{" "}
                    <span className="hidden sm:inline">
                      ({answeredCount}/{questions.length})
                    </span>
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onBackToDashboard}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> <span>Đóng xem lại</span>
            </button>
          )}
        </div>
      </header>

      {/* 2. VÙNG NỘI DUNG CÂU HỎI & SIDEBAR */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden relative">
        <main className="lg:col-span-9 flex flex-col justify-between overflow-hidden relative bg-[#F1F5F9]">
          <div className="flex-1 p-3 sm:p-4 lg:p-5 overflow-y-auto custom-scrollbar">
            <div className="max-w-4xl w-full mx-auto space-y-4 pb-6">
              {isReviewMode && (
                <div className="p-3.5 bg-white border border-slate-200/90 rounded-xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-[#1D4ED8] flex items-center justify-center font-bold text-sm">
                      {score.toFixed(1)}
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                        Chế độ Xem lại bài làm &amp; Lời giải chi tiết
                      </h4>
                      <p className="text-[11px] text-slate-500 font-normal">
                        Đúng {reviewSummaryCounts.right}/{questions.length} câu • Sai{" "}
                        {reviewSummaryCounts.wrong} câu • Bỏ trống {reviewSummaryCounts.skipped} câu
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRetake}
                    className="px-3.5 py-2 bg-[#F8FAFC] hover:bg-white text-[#1D4ED8] border border-slate-200/90 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Làm lại đề này
                  </button>
                </div>
              )}

              {isHomework && !isReviewMode && (
                <div className="hidden lg:flex p-3 bg-white border border-slate-200/90 text-slate-700 rounded-xl text-xs font-medium items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-[#1D4ED8]" />
                    Chế độ BTVN: Tự do làm bài, hệ thống tự động lưu nháp &amp; kết quả khi nộp.
                  </span>
                  <span className="text-[11px] font-semibold text-[#1D4ED8] bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                    Đã làm {answeredCount}/{questions.length} câu
                  </span>
                </div>
              )}

              {layoutMode === "single" ? (
                (() => {
                  const qStatus = isReviewMode ? getQuestionReviewStatus(currentQ) : null;
                  return (
                    <div
                      className={`bg-white rounded-xl p-4 sm:p-5 border space-y-3 text-left relative ${KATEX_NORMALIZED_CLASS} ${
                        isReviewMode
                          ? qStatus === "correct"
                            ? "border-emerald-300/90"
                            : qStatus === "wrong"
                              ? "border-rose-300/90"
                              : "border-slate-200/90"
                          : "border-slate-200/90"
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#1D4ED8]">
                            {"Câu " + (currentIdx + 1) + " / " + questions.length}
                          </span>
                          {isQuestionTrueFalse(currentQ) ? (
                            <span className="px-2 py-0.5 rounded bg-[#F8FAFC] text-slate-700 text-[10px] font-semibold border border-slate-200/90">
                              Đúng / Sai
                            </span>
                          ) : isQuestionShortAnswer(currentQ) ? (
                            <span className="px-2 py-0.5 rounded bg-[#F8FAFC] text-slate-700 text-[10px] font-semibold border border-slate-200/90">
                              Trả lời ngắn
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          {isReviewMode ? (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase border ${
                                qStatus === "correct"
                                  ? "bg-white text-emerald-700 border-emerald-300"
                                  : qStatus === "wrong"
                                    ? "bg-white text-rose-700 border-rose-300"
                                    : "bg-[#F8FAFC] text-slate-600 border-slate-200/90"
                              }`}
                            >
                              {qStatus === "correct"
                                ? "Chính xác"
                                : qStatus === "wrong"
                                  ? "Chọn sai"
                                  : "Bỏ trống"}
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleFlagQuestion(currentQ.id)}
                                className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition cursor-pointer ${
                                  flaggedQuestions[currentQ.id]
                                    ? "bg-blue-50 text-[#1D4ED8] border-blue-200"
                                    : "bg-[#F8FAFC] text-slate-500 border-slate-200/90 hover:text-slate-700"
                                }`}
                              >
                                <Flag className="w-3.5 h-3.5 fill-current" />
                                <span>
                                  {flaggedQuestions[currentQ.id] ? "Đã gắn cờ" : "Đánh dấu"}
                                </span>
                              </button>
                              <span className="text-xs font-medium text-slate-500 hidden sm:inline">
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
                          <div className="my-2.5 text-center">
                            <img
                              src={
                                resolveImageSrc(
                                  currentQ.image,
                                  currentQ.mediaMap || mediaMap || {}
                                ) || currentQ.image
                              }
                              alt="Hình câu hỏi"
                              onClick={() =>
                                setPreviewImage(
                                  resolveImageSrc(
                                    currentQ.image!,
                                    currentQ.mediaMap || mediaMap || {}
                                  ) || currentQ.image!
                                )
                              }
                              className="max-h-52 max-w-full rounded-xl border border-slate-200/90 bg-white p-1.5 object-contain mx-auto cursor-pointer"
                            />
                          </div>
                        )}
                      </div>

                      {renderQuestionOptions(currentQ)}

                      {isReviewMode && currentQ.explanation && (
                        <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/90 space-y-1.5 mt-2.5">
                          <p className="text-xs font-bold text-[#1D4ED8] flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[#1D4ED8]" /> Lời giải chi tiết:
                          </p>
                          <div className="text-slate-800 leading-[1.65] font-normal">
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
                <div className="space-y-4 pb-8">
                  {questions.map((q, qIndex) => {
                    const qStatus = isReviewMode ? getQuestionReviewStatus(q) : null;
                    return (
                      <div
                        key={q.id}
                        id={"question-card-" + q.id}
                        onClick={() => setCurrentIdx(qIndex)}
                        className={`bg-white rounded-xl p-4 sm:p-5 border space-y-3 text-left relative ${KATEX_NORMALIZED_CLASS} ${
                          isReviewMode
                            ? qStatus === "correct"
                              ? "border-emerald-300/90"
                              : qStatus === "wrong"
                                ? "border-rose-300/90"
                                : "border-slate-200/90"
                            : "border-slate-200/90"
                        }`}
                      >
                        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#1D4ED8]">
                              {"Câu " + (qIndex + 1) + " / " + questions.length}
                            </span>
                            {isQuestionTrueFalse(q) ? (
                              <span className="px-2 py-0.5 rounded bg-[#F8FAFC] text-slate-700 text-[10px] font-semibold border border-slate-200/90">
                                Đúng / Sai
                              </span>
                            ) : isQuestionShortAnswer(q) ? (
                              <span className="px-2 py-0.5 rounded bg-[#F8FAFC] text-slate-700 text-[10px] font-semibold border border-slate-200/90">
                                Trả lời ngắn
                              </span>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-2">
                            {isReviewMode ? (
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase border ${
                                  qStatus === "correct"
                                    ? "bg-white text-emerald-700 border-emerald-300"
                                    : qStatus === "wrong"
                                      ? "bg-white text-rose-700 border-rose-300"
                                      : "bg-[#F8FAFC] text-slate-600 border-slate-200/90"
                                }`}
                              >
                                {qStatus === "correct"
                                  ? "Chính xác"
                                  : qStatus === "wrong"
                                    ? "Chọn sai"
                                    : "Bỏ trống"}
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => toggleFlagQuestion(q.id)}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 border transition cursor-pointer ${
                                    flaggedQuestions[q.id]
                                      ? "bg-blue-50 text-[#1D4ED8] border-blue-200"
                                      : "bg-[#F8FAFC] text-slate-500 border-slate-200/90 hover:text-slate-700"
                                  }`}
                                >
                                  <Flag className="w-3.5 h-3.5 fill-current" />
                                  <span>{flaggedQuestions[q.id] ? "Đã gắn cờ" : "Đánh dấu"}</span>
                                </button>
                                <span className="text-xs font-medium text-slate-500 hidden sm:inline">
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
                            <div className="my-2.5 text-center">
                              <img
                                src={
                                  resolveImageSrc(q.image, q.mediaMap || mediaMap || {}) || q.image
                                }
                                alt="Hình câu hỏi"
                                onClick={() =>
                                  setPreviewImage(
                                    resolveImageSrc(q.image!, q.mediaMap || mediaMap || {}) ||
                                      q.image!
                                  )
                                }
                                className="max-h-52 max-w-full rounded-xl border border-slate-200/90 bg-white p-1.5 object-contain mx-auto cursor-pointer"
                              />
                            </div>
                          )}
                        </div>

                        {renderQuestionOptions(q)}

                        {isReviewMode && q.explanation && (
                          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200/90 text-slate-800 space-y-1.5 mt-2">
                            <p className="text-xs font-bold flex items-center gap-1.5 text-[#1D4ED8]">
                              <Sparkles className="w-3.5 h-3.5 text-[#1D4ED8]" /> Lời giải chi tiết:
                            </p>
                            <div className="leading-[1.65]">
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

          {/* THANH ĐIỀU HƯỚNG ĐÁY DESKTOP (KHI Ở CHẾ ĐỘ 1 CÂU) */}
          {layoutMode === "single" && (
            <div className="hidden lg:flex sticky bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm border-t border-slate-200/90 py-2.5 px-4 items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => navigateToQuestion(currentIdx - 1)}
                disabled={currentIdx === 0}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200/90 bg-white hover:bg-[#F8FAFC] disabled:opacity-35 text-xs font-semibold text-slate-700 transition flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Câu trước
              </button>

              <span className="text-xs font-semibold text-slate-600 px-2 select-none tracking-tight">
                Câu {currentIdx + 1} / {questions.length}
                {Boolean(userAnswers[currentQ?.id]) && (
                  <span className="ml-1.5 text-[#1D4ED8] text-[11px] font-bold">✓</span>
                )}
              </span>

              {currentIdx < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => navigateToQuestion(currentIdx + 1)}
                  className="px-3.5 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                >
                  Câu tiếp theo <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                !isSubmitted &&
                !isReviewMode && (
                  <button
                    type="button"
                    disabled={isSubmitting || isGrading}
                    onClick={() => handleSubmitExam()}
                    className="px-3.5 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-semibold transition flex items-center gap-1 cursor-pointer disabled:opacity-60"
                  >
                    <Send className="w-3.5 h-3.5" /> Nộp bài thi
                  </button>
                )
              )}
            </div>
          )}

          {/* THANH ĐIỀU HƯỚNG ĐÁY MOBILE */}
          <div
            className={`lg:hidden shrink-0 grid ${
              canUseAiTutor ? "grid-cols-4" : "grid-cols-3"
            } gap-1.5 px-2 py-2 bg-white border-t border-slate-200/90 z-30`}
          >
            <button
              type="button"
              disabled={currentIdx === 0}
              onClick={() => navigateToQuestion(currentIdx - 1)}
              className="py-2 px-1 rounded-lg border border-slate-200/90 bg-white hover:bg-[#F8FAFC] disabled:opacity-35 text-slate-700 text-xs font-semibold flex items-center justify-center gap-0.5 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Trước</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="py-2 px-1 rounded-lg border border-slate-200/90 bg-[#F8FAFC] hover:bg-slate-100 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
            >
              <Grid3X3 className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0" />
              <span className="truncate">
                {answeredCount}/{questions.length}
              </span>
            </button>

            {canUseAiTutor && (
              <button
                type="button"
                onClick={handleOpenAiDrawer}
                className="py-2 px-1 rounded-lg border border-slate-200/90 bg-[#F8FAFC] hover:bg-blue-50/40 text-slate-800 hover:text-[#1D4ED8] text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0" />
                <span className="truncate">Gia sư AI</span>
              </button>
            )}

            <button
              type="button"
              disabled={currentIdx >= questions.length - 1}
              onClick={() => navigateToQuestion(currentIdx + 1)}
              className="py-2 px-1 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center justify-center gap-0.5 cursor-pointer"
            >
              <span className="truncate">Tiếp</span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>
        </main>

        {/* 3. SIDEBAR MA TRẬN CÂU HỎI DESKTOP */}
        <aside className="hidden lg:flex lg:col-span-3 border-l border-slate-200/90 bg-white p-4 flex-col justify-between overflow-y-auto custom-scrollbar">
          <div className="space-y-3.5">
            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-slate-200/90 space-y-1 text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Thí sinh
              </span>
              <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                {profile?.full_name}
              </p>
              <div className="flex items-center justify-between text-xs text-slate-500 font-medium pt-1 border-t border-slate-200/70">
                <span className="truncate">{profile?.school || "THPT"}</span>
                <span className="font-semibold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                  {profile?.grade || "Lớp 12"}
                </span>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border space-y-0.5 text-left transition-colors ${timerSidebarStyles}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                {isReviewMode
                  ? "ĐIỂM BÀI LÀM"
                  : isHomework
                    ? "THỜI GIAN LÀM BÀI"
                    : "THỜI GIAN CÒN LẠI"}
              </span>
              <div className="flex items-center justify-between pt-0.5">
                {isReviewMode ? (
                  <>
                    <span className="text-xl font-bold text-[#1D4ED8]">
                      {score.toFixed(1)} / 10
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      Đúng {reviewSummaryCounts.right}/{questions.length}
                    </span>
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span className="text-lg font-semibold tracking-wider font-['Times_New_Roman',serif] tabular-nums">
                      {isHomework
                        ? formatTimer(timeSpentSeconds) + " (Vô hạn)"
                        : durationMinutes > 0
                          ? formatTimer(secondsRemaining)
                          : formatTimer(timeSpentSeconds)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 text-left pt-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="uppercase text-[11px] tracking-wider">Danh sách câu</span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {answeredCount}/{questions.length} câu
                </span>
              </div>

              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/70">
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

                  let btnColorClass =
                    "bg-white text-slate-600 border-slate-200/90 hover:border-slate-300";
                  if (isReviewMode) {
                    if (qStatus === "correct") {
                      btnColorClass = "bg-emerald-600 text-white border-emerald-600";
                    } else if (qStatus === "wrong") {
                      btnColorClass = "bg-rose-500 text-white border-rose-600";
                    } else {
                      btnColorClass = "bg-[#F8FAFC] text-slate-400 border-slate-200/90";
                    }
                    if (isCurrent) {
                      btnColorClass += " ring-2 ring-[#1D4ED8] scale-105";
                    }
                  } else {
                    if (isCurrent) {
                      btnColorClass = "bg-[#1D4ED8] text-white border-[#1D4ED8] scale-105";
                    } else if (isAns) {
                      btnColorClass = "bg-blue-50 text-[#1D4ED8] border-blue-200";
                    }
                  }

                  return (
                    <button
                      type="button"
                      key={q.id}
                      onClick={() => navigateToQuestion(idx)}
                      className={
                        "h-8 rounded-lg font-bold text-xs transition cursor-pointer border relative flex items-center justify-center " +
                        btnColorClass
                      }
                    >
                      <span>{idx + 1}</span>
                      {isFlagged && !isReviewMode && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#1D4ED8] ring-1 ring-white" />
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
                className="w-full py-2.5 bg-[#1D4ED8] hover:bg-blue-800 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Send className="w-3.5 h-3.5" /> {isHomework ? "Nộp BTVN" : "Nộp bài thi"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (rankingList.length === 0) {
                      fetchFullExamLeaderboard();
                    }
                    setShowResultModal(true);
                  }}
                  className="w-full py-2.5 bg-blue-50 text-[#1D4ED8] hover:bg-blue-100/70 rounded-xl font-semibold text-xs border border-blue-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5" /> Bảng điểm &amp; Xếp hạng
                </button>
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="w-full py-2 bg-[#F8FAFC] hover:bg-slate-100 text-slate-700 border border-slate-200/90 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Quay lại
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      {/* 4. CỬA SỔ GIA SƯ AI GỌN NHẸ GÓC DƯỚI PHẢI */}
      <AnimatePresence>
        {canUseAiTutor && isAiDrawerOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="fixed bottom-16 left-3 right-3 h-[55vh] lg:bottom-4 lg:right-4 lg:left-auto lg:w-[360px] lg:h-[460px] z-[140] bg-white rounded-2xl border border-slate-200/90 shadow-xs flex flex-col overflow-hidden text-left"
          >
            <div className="bg-white border-b border-slate-200/90 px-3.5 py-2.5 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 shrink-0">Gia sư AI</h3>
                <select
                  value={aiQuestionIdx}
                  onChange={(e) => setAiQuestionIdx(Number(e.target.value))}
                  className="ml-0.5 px-2 py-1 rounded-lg bg-[#F8FAFC] border border-slate-200/90 text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] cursor-pointer"
                >
                  {questions.map((_, idx) => (
                    <option key={idx} value={idx}>
                      Câu {idx + 1}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setIsAiDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
                title="Đóng Gia sư AI"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-3.5 py-2 shrink-0 border-b border-slate-100 bg-[#F8FAFC]">
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  disabled={isAiLoading}
                  onClick={() =>
                    handleSendAiPrompt(
                      "Nêu dạng bài và các công thức trọng tâm cần dùng cho câu này."
                    )
                  }
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-white border border-slate-200/90 hover:border-blue-300 hover:bg-blue-50/40 text-slate-700 hover:text-[#1D4ED8] whitespace-nowrap shrink-0 transition cursor-pointer disabled:opacity-50"
                >
                  Dạng bài &amp; Công thức
                </button>
                <button
                  type="button"
                  disabled={isAiLoading}
                  onClick={() =>
                    handleSendAiPrompt("Gợi ý bước làm đầu tiên cho câu này mà chưa lộ đáp án.")
                  }
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-white border border-slate-200/90 hover:border-blue-300 hover:bg-blue-50/40 text-slate-700 hover:text-[#1D4ED8] whitespace-nowrap shrink-0 transition cursor-pointer disabled:opacity-50"
                >
                  Gợi ý bước đầu
                </button>
                <button
                  type="button"
                  disabled={isAiLoading}
                  onClick={() => aiFileInputRef.current?.click()}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-full bg-white border border-slate-200/90 hover:border-blue-300 hover:bg-blue-50/40 text-slate-700 hover:text-[#1D4ED8] whitespace-nowrap shrink-0 transition cursor-pointer disabled:opacity-50"
                >
                  Kiểm tra ảnh nháp
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar bg-white">
              {currentAiMessages.length === 0 ? (
                <div className="py-8 text-center space-y-1.5 px-2">
                  <p className="text-[13px] font-semibold text-slate-800">
                    Sẵn sàng hỗ trợ Câu {aiQuestionIdx + 1}
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Chọn câu ở góc trên hoặc nhắn kèm số câu (VD: &quot;Câu 5 giải sao ạ&quot;) để
                    Gia sư AI hướng dẫn từng bước.
                  </p>
                </div>
              ) : (
                currentAiMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed space-y-1.5 ${
                        msg.role === "user"
                          ? "bg-[#1D4ED8] text-white"
                          : "bg-[#F8FAFC] border border-slate-200/90 text-slate-800"
                      }`}
                    >
                      {msg.imagePreview && (
                        <img
                          src={msg.imagePreview}
                          alt="Ảnh nháp"
                          className="max-h-36 rounded-lg border border-white/20 object-contain"
                        />
                      )}
                      {msg.role === "assistant" ? (
                        <MathRenderer content={msg.text} inline={false} />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      )}
                    </div>
                  </div>
                ))
              )}

              {isAiLoading && (
                <div className="flex justify-start">
                  <div className="bg-[#F8FAFC] border border-slate-200/90 text-slate-600 rounded-2xl px-3.5 py-2.5 text-xs flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1D4ED8]" />
                    <span>Gia sư AI đang phân tích...</span>
                  </div>
                </div>
              )}
              <div ref={aiChatEndRef} />
            </div>

            <div className="p-2.5 bg-white border-t border-slate-200/90 shrink-0 space-y-2">
              {aiDraftImageBase64 && (
                <div className="flex items-center gap-2 bg-[#F8FAFC] border border-slate-200/90 rounded-lg p-1.5">
                  <img
                    src={aiDraftImageBase64}
                    alt="Ảnh đính kèm"
                    className="w-9 h-9 rounded object-cover border border-slate-200"
                  />
                  <span className="text-[11px] text-slate-600 flex-1 truncate">
                    Đã đính kèm ảnh nháp
                  </span>
                  <button
                    type="button"
                    onClick={() => setAiDraftImageBase64(null)}
                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendAiPrompt();
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  ref={aiFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAiImageSelected}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => aiFileInputRef.current?.click()}
                  className="p-2 rounded-lg border border-slate-200/90 bg-[#F8FAFC] hover:bg-slate-100 text-slate-600 transition cursor-pointer shrink-0"
                  title="Gửi ảnh nháp"
                >
                  <ImagePlus className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={aiInputText}
                  onChange={(e) => setAiInputText(e.target.value)}
                  placeholder={`Hỏi về Câu ${aiQuestionIdx + 1}...`}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200/90 bg-[#F8FAFC] focus:bg-white focus:border-[#1D4ED8] text-[13px] text-slate-800 outline-none"
                />

                <button
                  type="submit"
                  disabled={isAiLoading || (!aiInputText.trim() && !aiDraftImageBase64)}
                  className="p-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 disabled:opacity-40 text-white transition cursor-pointer shrink-0"
                  title="Gửi câu hỏi"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. OVERLAY ANIMATION "ĐANG CHẤM BÀI..." (~1.8 GIÂY) */}
      <AnimatePresence>
        {isGrading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[550] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: -10 }}
              transition={{ type: "spring", damping: 24, stiffness: 300 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 border border-slate-200/90 text-center space-y-5 shadow-xs"
            >
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
                <div className="absolute inset-0 rounded-full border-4 border-[#1D4ED8] border-t-transparent animate-spin" />
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1D4ED8] flex items-center justify-center">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1D4ED8] text-[10px] font-bold uppercase tracking-widest border border-blue-200">
                  HỆ THỐNG CHẤM THI TỰ ĐỘNG TCT
                </span>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight pt-1">
                  Đang chấm bài &amp; Phân tích kết quả...
                </h3>
                <p className="text-xs font-medium text-slate-500 min-h-[18px]">
                  {gradingStepText}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/90 p-0.5">
                  <div
                    className="h-full bg-[#1D4ED8] rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${gradingProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-400">
                  <span>Quét phiếu trả lời</span>
                  <span className="text-[#1D4ED8] font-mono">{gradingProgress}%</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6. BOTTOM SHEET CHỌN CÂU MOBILE */}
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
              className="bg-white rounded-t-2xl max-h-[80vh] flex flex-col p-5 border-t border-slate-200/90"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Grid3X3 className="w-4 h-4 text-[#1D4ED8]" />
                  <h3 className="font-bold text-sm text-slate-900">Bảng câu hỏi</h3>
                  <span className="text-xs font-semibold text-slate-500">
                    ({answeredCount}/{questions.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1 rounded-xl text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto custom-scrollbar my-3 max-h-[48vh] pr-1">
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, idx) => {
                    const isCurrent = currentIdx === idx;
                    const isAns = Boolean(userAnswers[q.id]);
                    const qStatus = isReviewMode ? getQuestionReviewStatus(q) : null;

                    let mobileColor = isCurrent
                      ? "bg-[#1D4ED8] text-white border-[#1D4ED8]"
                      : isAns
                        ? "bg-blue-50 text-[#1D4ED8] border-blue-200"
                        : "bg-white text-slate-600 border-slate-200/90";

                    if (isReviewMode) {
                      if (qStatus === "correct")
                        mobileColor = "bg-emerald-600 text-white border-emerald-600";
                      else if (qStatus === "wrong")
                        mobileColor = "bg-rose-500 text-white border-rose-600";
                      else mobileColor = "bg-[#F8FAFC] text-slate-400 border-slate-200/90";
                    }

                    return (
                      <button
                        type="button"
                        key={q.id}
                        onClick={() => {
                          navigateToQuestion(idx);
                          setIsMobileDrawerOpen(false);
                        }}
                        className={
                          "h-10 rounded-xl font-bold text-xs transition cursor-pointer border relative flex items-center justify-center " +
                          mobileColor
                        }
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
                  className="flex-1 py-2.5 bg-[#F8FAFC] hover:bg-slate-100 text-slate-700 border border-slate-200/90 rounded-xl font-semibold text-xs transition cursor-pointer"
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
                    className="flex-1 py-2.5 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-xl font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <Send className="w-3.5 h-3.5" /> Nộp bài
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. MODAL KẾT QUẢ THI & BẢNG XẾP HẠNG TOÀN KHÓA */}
      <AnimatePresence>
        {showResultModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowResultModal(false)}
            className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto cursor-pointer"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-7 border border-slate-200/90 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 cursor-default my-auto text-left"
            >
              <div className="md:col-span-6 flex flex-col justify-between space-y-4 sm:space-y-6">
                <div className="space-y-3 sm:space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1D4ED8] flex items-center justify-center border border-blue-200">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                      {isHomework ? "Hoàn Thành BTVN!" : "Hoàn Thành Bài Thi!"}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{quizTitle}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-slate-200/90 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        ĐIỂM ĐẠT ĐƯỢC
                      </span>
                      <span className="text-2xl sm:text-3xl font-bold text-[#1D4ED8]">
                        {score.toFixed(1)}{" "}
                        <span className="text-sm text-slate-400 font-semibold">/ 10</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-700 block">
                        {"Đúng " + correctCount + "/" + questions.length + " câu trọn vẹn"}
                      </span>
                      <span className="text-[11px] text-slate-500 font-normal">
                        {"(" + historyAttemptsCount + " lần nộp)"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="flex-1 py-2.5 bg-[#1D4ED8] hover:bg-blue-800 text-white font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Làm lại bài
                  </button>
                  <button
                    type="button"
                    onClick={handleViewSolutions}
                    className="flex-1 py-2.5 bg-[#F8FAFC] hover:bg-blue-50/40 text-[#1D4ED8] border border-slate-200/90 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#1D4ED8]" /> Xem đáp án
                  </button>
                  <button
                    type="button"
                    onClick={onBackToDashboard}
                    className="flex-1 py-2 text-slate-500 hover:text-slate-800 font-semibold text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Home className="w-3.5 h-3.5" /> Trang chủ
                  </button>
                </div>
              </div>

              <div className="md:col-span-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-200/90 md:pl-6 space-y-3">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-[#1D4ED8]" />
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 tracking-tight">
                        Bảng Xếp Hạng Kết Quả
                      </h3>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500">
                      {rankingList.length} học sinh
                    </span>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-slate-200/90 max-h-[260px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200/90 sticky top-0">
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
                          <tr className="bg-blue-50/50 font-semibold text-[#1D4ED8]">
                            <td className="py-2 px-2.5 text-center">#1</td>
                            <td className="py-2 px-2.5 font-bold truncate max-w-[140px]">
                              {profile?.full_name}{" "}
                              <span className="text-[9px] bg-[#1D4ED8] text-white px-1.5 py-0.5 rounded ml-1">
                                BẠN
                              </span>
                            </td>
                            <td className="py-2 px-2.5 text-right font-bold">
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
                                    ? "bg-blue-50/60 font-semibold text-[#1D4ED8]"
                                    : "hover:bg-[#F8FAFC] text-slate-700"
                                }
                              >
                                <td className="py-2 px-2.5 text-center font-bold">
                                  <span className={rank <= 3 ? "text-[#1D4ED8]" : "text-slate-400"}>
                                    #{rank}
                                  </span>
                                </td>
                                <td className="py-2 px-2.5 font-semibold truncate max-w-[150px]">
                                  <span>{r.studentName}</span>
                                  {isMe && (
                                    <span className="ml-1.5 text-[9px] font-bold bg-[#1D4ED8] text-white px-1.5 py-0.5 rounded">
                                      BẠN
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-2.5 text-right font-bold text-slate-900">
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
                <p className="text-[11px] text-slate-500 text-center">
                  Bấm nút &quot;Xem đáp án&quot; để xem chi tiết từng câu đúng/sai và lời giải.
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
            className="fixed inset-0 z-[600] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-zoom-out"
          >
            <div
              className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-2 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
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
