"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Flag,
  HelpCircle,
  LayoutList,
  Maximize2,
  RotateCcw,
  Send,
  Trophy,
  X,
  XCircle,
} from "lucide-react";

export interface HsaExamRoomViewProps {
  quizId: string;
  quizTitle: string;
  examData?: any;
  initialPartKey?: "all" | string;
  profile: any;
  onBackToDashboard: () => void;
  isReviewMode?: boolean;
  reviewAttempt?: any;
}

type QuestionType = "mcq" | "short_answer";
type ReviewFilter = "all" | "wrong" | "blank";

interface NormalizedOption {
  key: string;
  text: string;
}

interface NormalizedQuestion {
  id: string;
  number: number;
  partKey: string;
  type: QuestionType;
  prompt: string;
  passageHtml?: string;
  passageId?: string;
  options: NormalizedOption[];
  correctAnswer: string;
  explanation?: string;
  images: string[];
}

interface NormalizedPart {
  key: string;
  headerTitle: string;
  shortTitle: string;
  durationMinutes: number;
  questions: NormalizedQuestion[];
}

interface SectionScoreResult {
  key: string;
  title: string;
  correct: number;
  total: number;
  score: number;
  maxScore: number;
}

interface ScoreSummary {
  totalScore: number;
  maxTotalScore: number;
  sections: SectionScoreResult[];
  byCategory: {
    quant: number | null;
    qual: number | null;
    english: number | null;
  };
}

let cachedSupabase: SupabaseClient | null = null;
function getSupabaseClient(): SupabaseClient | null {
  if (cachedSupabase) return cachedSupabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  cachedSupabase = createClient(url, anonKey);
  return cachedSupabase;
}

const PART_DEFINITIONS: Record<
  string,
  {
    headerTitle: string;
    shortTitle: string;
    category: "quant" | "qual" | "english";
    defaultDuration: number;
    order: number;
  }
> = {
  quant: {
    headerTitle: "TOÁN HỌC & XỬ LÝ SỐ LIỆU",
    shortTitle: "Tư duy Định lượng",
    category: "quant",
    defaultDuration: 75,
    order: 1,
  },
  dinh_luong: {
    headerTitle: "TOÁN HỌC & XỬ LÝ SỐ LIỆU",
    shortTitle: "Tư duy Định lượng",
    category: "quant",
    defaultDuration: 75,
    order: 1,
  },
  toan: {
    headerTitle: "TOÁN HỌC & XỬ LÝ SỐ LIỆU",
    shortTitle: "Tư duy Định lượng",
    category: "quant",
    defaultDuration: 75,
    order: 1,
  },
  math: {
    headerTitle: "TOÁN HỌC & XỬ LÝ SỐ LIỆU",
    shortTitle: "Tư duy Định lượng",
    category: "quant",
    defaultDuration: 75,
    order: 1,
  },
  qual: {
    headerTitle: "NGÔN NGỮ - VĂN HỌC",
    shortTitle: "Tư duy Định tính",
    category: "qual",
    defaultDuration: 60,
    order: 2,
  },
  dinh_tinh: {
    headerTitle: "NGÔN NGỮ - VĂN HỌC",
    shortTitle: "Tư duy Định tính",
    category: "qual",
    defaultDuration: 60,
    order: 2,
  },
  van: {
    headerTitle: "NGÔN NGỮ - VĂN HỌC",
    shortTitle: "Tư duy Định tính",
    category: "qual",
    defaultDuration: 60,
    order: 2,
  },
  literature: {
    headerTitle: "NGÔN NGỮ - VĂN HỌC",
    shortTitle: "Tư duy Định tính",
    category: "qual",
    defaultDuration: 60,
    order: 2,
  },
  english: {
    headerTitle: "TIẾNG ANH",
    shortTitle: "Tiếng Anh",
    category: "english",
    defaultDuration: 60,
    order: 3,
  },
  tieng_anh: {
    headerTitle: "TIẾNG ANH",
    shortTitle: "Tiếng Anh",
    category: "english",
    defaultDuration: 60,
    order: 3,
  },
  science: {
    headerTitle: "KHOA HỌC",
    shortTitle: "Khoa học",
    category: "english",
    defaultDuration: 60,
    order: 3,
  },
  khoa_hoc: {
    headerTitle: "KHOA HỌC",
    shortTitle: "Khoa học",
    category: "english",
    defaultDuration: 60,
    order: 3,
  },
};

function extractMediaTokens(text: string): string[] {
  if (!text) return [];
  const tokens: string[] = [];
  const regex = /\[img:([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    tokens.push(match[1].trim());
  }
  return tokens;
}

function resolveMediaUrl(
  token: string,
  mediaMap: Record<string, any>
): string {
  const entry = mediaMap[token];
  if (!entry) {
    if (
      token.startsWith("http://") ||
      token.startsWith("https://") ||
      token.startsWith("data:image/") ||
      token.startsWith("/")
    ) {
      return token;
    }
    return "";
  }
  if (typeof entry === "string") return entry;
  return entry.url || entry.src || entry.publicUrl || "";
}

function normalizeQuestionItem(
  raw: any,
  index: number,
  partKey: string,
  globalMediaMap: Record<string, any>
): NormalizedQuestion {
  const qId = String(raw.id ?? raw.question_id ?? `${partKey}_q_${index + 1}`);
  const prompt = String(
    raw.question ?? raw.prompt ?? raw.content ?? raw.text ?? raw.title ?? ""
  );

  const rawOptions = raw.options ?? raw.choices ?? raw.answers ?? [];
  const optionLabels = ["A", "B", "C", "D", "E", "F"];
  const options: NormalizedOption[] = [];

  if (Array.isArray(rawOptions)) {
    rawOptions.forEach((opt: any, optIdx: number) => {
      if (typeof opt === "string") {
        options.push({ key: optionLabels[optIdx] || String(optIdx + 1), text: opt });
      } else if (opt && typeof opt === "object") {
        options.push({
          key: String(
            opt.key ?? opt.label ?? opt.id ?? optionLabels[optIdx] ?? optIdx + 1
          ).toUpperCase(),
          text: String(opt.text ?? opt.content ?? opt.value ?? ""),
        });
      }
    });
  } else if (rawOptions && typeof rawOptions === "object") {
    Object.entries(rawOptions).forEach(([k, v]) => {
      options.push({ key: k.toUpperCase(), text: String(v ?? "") });
    });
  }

  const inferredType: QuestionType =
    raw.type === "short_answer" ||
    raw.type === "fill" ||
    raw.type === "numeric" ||
    options.length === 0
      ? "short_answer"
      : "mcq";

  const correctRaw =
    raw.correctAnswer ??
    raw.correct_answer ??
    raw.answer ??
    raw.key ??
    "";

  const mergedMedia = { ...globalMediaMap, ...(raw.mediaMap || {}) };
  const imageSet = new Set<string>();

  extractMediaTokens(prompt).forEach((t) => {
    const url = resolveMediaUrl(t, mergedMedia);
    if (url) imageSet.add(url);
  });

  if (raw.image_url) imageSet.add(String(raw.image_url));
  if (raw.imageUrl) imageSet.add(String(raw.imageUrl));
  if (raw.image) {
    const resolved = resolveMediaUrl(String(raw.image), mergedMedia);
    if (resolved) imageSet.add(resolved);
  }
  if (Array.isArray(raw.images)) {
    raw.images.forEach((img: string) => {
      const resolved = resolveMediaUrl(String(img), mergedMedia);
      if (resolved) imageSet.add(resolved);
    });
  }

  return {
    id: qId,
    number: Number(raw.number ?? raw.order ?? index + 1),
    partKey,
    type: inferredType,
    prompt,
    passageHtml: raw.passage_html || raw.passageHtml || raw.passage || undefined,
    passageId: raw.passage_id || raw.passageId || undefined,
    options,
    correctAnswer: String(correctRaw).trim(),
    explanation:
      raw.explanation ??
      raw.solution ??
      raw.solution_html ??
      raw.explanation_html ??
      raw.detail ??
      undefined,
    images: Array.from(imageSet),
  };
}

function normalizeExamParts(
  examData: any,
  initialPartKey: "all" | string
): { parts: NormalizedPart[]; mediaMap: Record<string, any> } {
  if (!examData) return { parts: [], mediaMap: {} };

  const dataRoot = examData.data ?? examData;
  const mediaMap: Record<string, any> = {
    ...(examData.mediaMap || {}),
    ...(examData.media || {}),
    ...(dataRoot?.mediaMap || {}),
    ...(dataRoot?.media || {}),
  };

  const rawSections =
    dataRoot?.sections ??
    dataRoot?.parts ??
    (Array.isArray(dataRoot) ? dataRoot : null) ??
    (typeof dataRoot === "object" ? dataRoot : null);

  const parts: NormalizedPart[] = [];

  if (Array.isArray(rawSections)) {
    rawSections.forEach((sec: any, idx: number) => {
      if (!sec) return;
      const key = String(sec.key ?? sec.id ?? sec.partKey ?? `part_${idx + 1}`);
      const def = PART_DEFINITIONS[key.toLowerCase()];
      const rawQuestions = Array.isArray(sec.questions)
        ? sec.questions
        : Array.isArray(sec.items)
        ? sec.items
        : [];
      if (rawQuestions.length === 0) return;

      parts.push({
        key,
        headerTitle: (
          sec.headerTitle ||
          sec.title ||
          sec.name ||
          def?.headerTitle ||
          `PHẦN THI ${idx + 1}`
        ).toUpperCase(),
        shortTitle: sec.shortTitle || sec.title || def?.shortTitle || `Phần ${idx + 1}`,
        durationMinutes:
          Number(sec.durationMinutes ?? sec.duration ?? sec.time_limit) ||
          def?.defaultDuration ||
          60,
        questions: rawQuestions.map((q: any, qIdx: number) =>
          normalizeQuestionItem(q, qIdx, key, mediaMap)
        ),
      });
    });
  } else if (rawSections && typeof rawSections === "object") {
    const ignoredKeys = new Set([
      "mediaMap",
      "media",
      "metadata",
      "title",
      "description",
      "config",
      "settings",
    ]);

    Object.entries(rawSections).forEach(([key, val]: [string, any], idx: number) => {
      if (ignoredKeys.has(key) || !val) return;
      const def = PART_DEFINITIONS[key.toLowerCase()];
      const rawQuestions = Array.isArray(val)
        ? val
        : Array.isArray(val.questions)
        ? val.questions
        : Array.isArray(val.items)
        ? val.items
        : [];
      if (rawQuestions.length === 0) return;

      parts.push({
        key,
        headerTitle: (
          val.headerTitle ||
          val.title ||
          val.name ||
          def?.headerTitle ||
          `PHẦN THI ${idx + 1}`
        ).toUpperCase(),
        shortTitle: val.shortTitle || val.title || def?.shortTitle || `Phần ${idx + 1}`,
        durationMinutes:
          Number(val.durationMinutes ?? val.duration ?? val.time_limit) ||
          def?.defaultDuration ||
          60,
        questions: rawQuestions.map((q: any, qIdx: number) =>
          normalizeQuestionItem(q, qIdx, key, mediaMap)
        ),
      });
    });
  }

  parts.sort((a, b) => {
    const orderA = PART_DEFINITIONS[a.key.toLowerCase()]?.order ?? 99;
    const orderB = PART_DEFINITIONS[b.key.toLowerCase()]?.order ?? 99;
    return orderA - orderB;
  });

  const filteredParts =
    initialPartKey && initialPartKey !== "all"
      ? parts.filter((p) => p.key === initialPartKey)
      : parts;

  return {
    parts: filteredParts.length > 0 ? filteredParts : parts,
    mediaMap,
  };
}

function renderKatexHtml(
  rawText: string,
  mediaMap: Record<string, any>,
  options?: { stripImgTokens?: boolean; onImageClick?: (url: string) => void }
): string {
  if (!rawText) return "";

  let processed = rawText;

  if (options?.stripImgTokens) {
    processed = processed.replace(/\[img:[^\]]+\]/g, "");
  } else {
    processed = processed.replace(/\[img:([^\]]+)\]/g, (_, token) => {
      const url = resolveMediaUrl(token.trim(), mediaMap);
      if (!url) return "";
      return `<img src="${url}" alt="Hình minh họa" class="my-2 max-h-56 rounded border border-slate-200 object-contain" />`;
    });
  }

  // Render block math $$...$$ first
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, mathExpr) => {
    try {
      return katex.renderToString(mathExpr.trim(), {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      return mathExpr;
    }
  });

  // Render inline math $...$
  processed = processed.replace(/\$([^$\n]+?)\$/g, (_, mathExpr) => {
    try {
      return katex.renderToString(mathExpr.trim(), {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return mathExpr;
    }
  });

  // Convert plain newlines if no HTML block tags are present
  if (!/<(p|div|br|ul|ol|li|table)\b/i.test(processed)) {
    processed = processed.replace(/\n/g, "<br />");
  }

  return processed.trim();
}

function MathContent({
  content,
  mediaMap,
  stripImgTokens = false,
  className = "",
}: {
  content: string;
  mediaMap: Record<string, any>;
  stripImgTokens?: boolean;
  className?: string;
}) {
  const html = useMemo(
    () => renderKatexHtml(content, mediaMap, { stripImgTokens }),
    [content, mediaMap, stripImgTokens]
  );

  return (
    <div
      className={`prose prose-slate max-w-none text-sm leading-relaxed text-slate-800 ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function normalizeAnswerValue(val: string | undefined | null): string {
  if (!val) return "";
  return val.trim().replace(/,/g, ".").toLowerCase();
}

function isQuestionCorrect(
  q: NormalizedQuestion,
  userAnswer: string | undefined
): boolean {
  if (!userAnswer || !userAnswer.trim()) return false;
  if (q.type === "mcq") {
    return userAnswer.trim().toUpperCase() === q.correctAnswer.trim().toUpperCase();
  }
  const uNorm = normalizeAnswerValue(userAnswer);
  const cNorm = normalizeAnswerValue(q.correctAnswer);
  if (uNorm === cNorm) return true;
  const uNum = Number(uNorm);
  const cNum = Number(cNorm);
  if (!Number.isNaN(uNum) && !Number.isNaN(cNum)) {
    return Math.abs(uNum - cNum) < 1e-6;
  }
  return false;
}

function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, "0")).join(":");
}

function formatScoreDisplay(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export default function HsaExamRoomView({
  quizId,
  quizTitle,
  examData,
  initialPartKey = "all",
  profile,
  onBackToDashboard,
  isReviewMode = false,
  reviewAttempt,
}: HsaExamRoomViewProps) {
  const { parts, mediaMap } = useMemo(
    () => normalizeExamParts(examData, initialPartKey),
    [examData, initialPartKey]
  );

  const [activePartKey, setActivePartKey] = useState<string>(
    parts[0]?.key || ""
  );
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    if (reviewAttempt?.answers && typeof reviewAttempt.answers === "object") {
      return { ...reviewAttempt.answers };
    }
    return {};
  });
  const [flaggedIds, setFlaggedIds] = useState<Record<string, boolean>>({});
  const [reviewMode, setReviewMode] = useState<boolean>(Boolean(isReviewMode));
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");

  const totalExamSeconds = useMemo(
    () => parts.reduce((sum, p) => sum + p.durationMinutes * 60, 0),
    [parts]
  );
  const [secondsLeft, setSecondsLeft] = useState<number>(totalExamSeconds);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
  const [showScoreModal, setShowScoreModal] = useState<boolean>(false);
  const [showLeaderboardNote, setShowLeaderboardNote] = useState<boolean>(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (parts.length > 0 && !parts.some((p) => p.key === activePartKey)) {
      setActivePartKey(parts[0].key);
    }
  }, [parts, activePartKey]);

  useEffect(() => {
    setReviewMode(Boolean(isReviewMode));
  }, [isReviewMode]);

  useEffect(() => {
    if (reviewAttempt?.answers && typeof reviewAttempt.answers === "object") {
      setAnswers({ ...reviewAttempt.answers });
    }
  }, [reviewAttempt]);

  const activePart = useMemo(
    () => parts.find((p) => p.key === activePartKey) || parts[0],
    [parts, activePartKey]
  );

  const computeScoreSummary = useCallback((): ScoreSummary => {
    const sections: SectionScoreResult[] = parts.map((part) => {
      const total = part.questions.length;
      const correct = part.questions.reduce(
        (acc, q) => acc + (isQuestionCorrect(q, answers[q.id]) ? 1 : 0),
        0
      );
      const rawScore = total > 0 ? (correct / total) * 50 : 0;
      return {
        key: part.key,
        title: part.shortTitle,
        correct,
        total,
        score: Math.round(rawScore * 100) / 100,
        maxScore: 50,
      };
    });

    const totalScore =
      Math.round(sections.reduce((s, sec) => s + sec.score, 0) * 100) / 100;
    const maxTotalScore = sections.length * 50;

    let quant: number | null = null;
    let qual: number | null = null;
    let english: number | null = null;

    sections.forEach((sec) => {
      const cat = PART_DEFINITIONS[sec.key.toLowerCase()]?.category;
      if (cat === "quant") quant = sec.score;
      else if (cat === "qual") qual = sec.score;
      else if (cat === "english") english = sec.score;
    });

    return {
      totalScore,
      maxTotalScore,
      sections,
      byCategory: { quant, qual, english },
    };
  }, [parts, answers]);

  const handleSubmitExam = useCallback(
    async (isAutoSubmit = false) => {
      if (isSubmitting || reviewMode) return;
      setIsSubmitting(true);
      setShowSubmitConfirm(false);
      setSaveError(null);

      const summary = computeScoreSummary();
      setScoreSummary(summary);

      const timeSpent = Math.max(0, totalExamSeconds - secondsLeft);
      const sectionScoresPayload: Record<string, number> = {};
      summary.sections.forEach((s) => {
        sectionScoresPayload[s.key] = s.score;
      });

      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const payload: Record<string, any> = {
            quiz_id: quizId,
            user_id: profile?.id ?? profile?.user_id ?? null,
            score: summary.totalScore,
            max_score: summary.maxTotalScore,
            section_scores: sectionScoresPayload,
            answers,
            time_spent_seconds: timeSpent,
            submitted_at: new Date().toISOString(),
          };
          const { error } = await supabase.from("exam_attempts").insert(payload);
          if (error) {
            setSaveError(
              "Đã chấm điểm nhưng chưa thể đồng bộ lên máy chủ. Kết quả vẫn được hiển thị."
            );
          }
        }
      } catch {
        setSaveError(
          "Không thể kết nối máy chủ lưu điểm. Kết quả tạm thời vẫn được hiển thị."
        );
      } finally {
        setIsSubmitting(false);
        setReviewMode(true);
        setShowScoreModal(true);
        if (isAutoSubmit) {
          setSecondsLeft(0);
        }
      }
    },
    [
      isSubmitting,
      reviewMode,
      computeScoreSummary,
      totalExamSeconds,
      secondsLeft,
      quizId,
      profile,
      answers,
    ]
  );

  // Countdown timer
  useEffect(() => {
    if (reviewMode || totalExamSeconds <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [reviewMode, totalExamSeconds, handleSubmitExam]);

  const handleSelectAnswer = (questionId: string, value: string) => {
    if (reviewMode) return;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleToggleFlag = (questionId: string) => {
    setFlaggedIds((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const handleRestartExam = () => {
    setAnswers({});
    setFlaggedIds({});
    setReviewMode(false);
    setReviewFilter("all");
    setShowScoreModal(false);
    setScoreSummary(null);
    setSaveError(null);
    setSecondsLeft(totalExamSeconds);
    if (parts[0]) {
      setActivePartKey(parts[0].key);
    }
  };

  const scrollToQuestion = (questionId: string) => {
    const el = questionRefs.current[questionId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const activeQuestions = activePart?.questions || [];

  const answeredCountInActive = activeQuestions.filter(
    (q) => Boolean(answers[q.id] && answers[q.id].trim() !== "")
  ).length;

  const filteredActiveQuestions = useMemo(() => {
    if (!reviewMode || reviewFilter === "all") return activeQuestions;
    if (reviewFilter === "blank") {
      return activeQuestions.filter(
        (q) => !answers[q.id] || answers[q.id].trim() === ""
      );
    }
    return activeQuestions.filter(
      (q) =>
        Boolean(answers[q.id] && answers[q.id].trim() !== "") &&
        !isQuestionCorrect(q, answers[q.id])
    );
  }, [activeQuestions, reviewMode, reviewFilter, answers]);

  const reviewStats = useMemo(() => {
    const wrong = activeQuestions.filter(
      (q) =>
        Boolean(answers[q.id] && answers[q.id].trim() !== "") &&
        !isQuestionCorrect(q, answers[q.id])
    ).length;
    const blank = activeQuestions.filter(
      (q) => !answers[q.id] || answers[q.id].trim() === ""
    ).length;
    return { total: activeQuestions.length, wrong, blank };
  }, [activeQuestions, answers]);

  const isMathSection = useMemo(() => {
    if (!activePart) return false;
    const cat = PART_DEFINITIONS[activePart.key.toLowerCase()]?.category;
    return cat === "quant" || activePart.headerTitle.includes("TOÁN");
  }, [activePart]);

  // Group consecutive questions that share the exact same passage_html
  const questionGroups = useMemo(() => {
    const groups: { passageHtml?: string; questions: NormalizedQuestion[] }[] =
      [];
    filteredActiveQuestions.forEach((q) => {
      const lastGroup = groups[groups.length - 1];
      if (
        q.passageHtml &&
        lastGroup &&
        lastGroup.passageHtml === q.passageHtml
      ) {
        lastGroup.questions.push(q);
      } else {
        groups.push({
          passageHtml: q.passageHtml,
          questions: [q],
        });
      }
    });
    return groups;
  }, [filteredActiveQuestions]);

  if (!activePart) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] p-6">
        <div className="max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center">
          <p className="text-sm font-medium text-slate-700">
            Không tìm thấy dữ liệu câu hỏi cho đề thi này.
          </p>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="mt-4 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] text-slate-900">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (reviewMode) {
                  onBackToDashboard();
                } else {
                  setShowExitConfirm(true);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Thoát
            </button>
            <span className="hidden max-w-[220px] truncate text-xs text-slate-500 sm:inline">
              {quizTitle}
            </span>
          </div>

          <h1 className="text-center text-sm font-bold tracking-wide text-slate-900 sm:text-base">
            {activePart.headerTitle}
          </h1>

          <div className="flex items-center gap-2">
            {reviewMode && scoreSummary && (
              <button
                type="button"
                onClick={() => setShowScoreModal(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-700 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                <Award className="h-3.5 w-3.5" />
                Phiếu báo điểm
              </button>
            )}
            {!reviewMode && (
              <span className="hidden text-xs font-medium text-slate-500 sm:inline">
                Thí sinh:{" "}
                <strong className="text-slate-800">
                  {profile?.full_name || profile?.name || "Thí sinh"}
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Multi-part compact tab bar */}
        {parts.length >= 2 && (
          <div className="border-t border-slate-200 bg-[#F8FAFC]">
            <div className="mx-auto flex max-w-[1440px] items-center gap-1.5 overflow-x-auto px-4 py-1.5">
              {parts.map((part, idx) => {
                const isActive = part.key === activePart.key;
                const doneCount = part.questions.filter(
                  (q) => Boolean(answers[q.id] && answers[q.id].trim() !== "")
                ).length;
                return (
                  <button
                    key={part.key}
                    type="button"
                    onClick={() => setActivePartKey(part.key)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded border px-3 py-1 text-xs font-medium transition-colors ${
                      isActive
                        ? "border-blue-800 bg-blue-800 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span>
                      Phần {idx + 1}: {part.shortTitle}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        isActive
                          ? "bg-blue-900/80 text-blue-100"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {doneCount}/{part.questions.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main 2-Column Exam Room */}
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 p-4 lg:flex-row">
        {/* Left Column (75%) - Questions */}
        <section className="w-full space-y-5 lg:w-3/4">
          {reviewMode && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <LayoutList className="h-4 w-4 text-slate-500" />
                <span>Chế độ xem lại đáp án & lời giải</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setReviewFilter("all")}
                  className={`rounded border px-3 py-1 text-xs font-medium ${
                    reviewFilter === "all"
                      ? "border-slate-800 bg-slate-800 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Tất cả ({reviewStats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter("wrong")}
                  className={`rounded border px-3 py-1 text-xs font-medium ${
                    reviewFilter === "wrong"
                      ? "border-red-700 bg-red-700 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Câu sai ({reviewStats.wrong})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter("blank")}
                  className={`rounded border px-3 py-1 text-xs font-medium ${
                    reviewFilter === "blank"
                      ? "border-amber-700 bg-amber-700 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Câu bỏ trống ({reviewStats.blank})
                </button>
              </div>
            </div>
          )}

          {questionGroups.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              Không có câu hỏi nào thuộc bộ lọc này.
            </div>
          ) : (
            questionGroups.map((group, gIdx) => (
              <div key={`group_${gIdx}`} className="space-y-4">
                {group.passageHtml && (
                  <div className="rounded-lg border border-slate-200 bg-[#FAF8F5] p-4">
                    <div className="mb-2 border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Ngữ liệu đọc hiểu
                    </div>
                    <div className="max-h-[320px] overflow-y-auto pr-2">
                      <MathContent
                        content={group.passageHtml}
                        mediaMap={mediaMap}
                      />
                    </div>
                  </div>
                )}

                {group.questions.map((q) => {
                  const userAnswer = answers[q.id] || "";
                  const isAnswered = userAnswer.trim() !== "";
                  const isFlagged = Boolean(flaggedIds[q.id]);
                  const isCorrect = reviewMode
                    ? isQuestionCorrect(q, userAnswer)
                    : false;
                  const showTwoColMath = isMathSection && q.images.length > 0;

                  return (
                    <div
                      key={q.id}
                      ref={(el) => {
                        questionRefs.current[q.id] = el;
                      }}
                      className={`scroll-mt-28 rounded-lg border bg-white p-5 ${
                        reviewMode
                          ? isAnswered
                            ? isCorrect
                              ? "border-emerald-300"
                              : "border-red-300"
                            : "border-slate-200"
                          : isFlagged
                          ? "border-amber-400"
                          : "border-slate-200"
                      }`}
                    >
                      {/* Question Header */}
                      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex items-center rounded border border-slate-200 bg-[#F8FAFC] px-2.5 py-0.5 text-xs font-bold text-slate-800">
                            Câu {q.number}
                          </span>
                          {q.type === "short_answer" && (
                            <span className="text-[11px] font-medium text-slate-500">
                              Điền đáp án
                            </span>
                          )}
                          {reviewMode && (
                            <span
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold ${
                                !isAnswered
                                  ? "bg-slate-100 text-slate-600"
                                  : isCorrect
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-red-50 text-red-700"
                              }`}
                            >
                              {!isAnswered ? (
                                <>
                                  <HelpCircle className="h-3 w-3" />
                                  Bỏ trống
                                </>
                              ) : isCorrect ? (
                                <>
                                  <CheckCircle2 className="h-3 w-3" />
                                  Chính xác
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3 w-3" />
                                  Chưa đúng
                                </>
                              )}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleFlag(q.id)}
                          className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium transition-colors ${
                            isFlagged
                              ? "border-amber-400 bg-amber-50 text-amber-800"
                              : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                          }`}
                        >
                          <Flag className="h-3 w-3" />
                          {isFlagged ? "Đã gắn cờ" : "Đánh dấu"}
                        </button>
                      </div>

                      {/* Question Content: 2-col for Math with Image, 1-col otherwise */}
                      <div
                        className={
                          showTwoColMath
                            ? "grid grid-cols-1 gap-5 md:grid-cols-12"
                            : "space-y-4"
                        }
                      >
                        <div
                          className={
                            showTwoColMath ? "space-y-4 md:col-span-8" : "space-y-4"
                          }
                        >
                          <MathContent
                            content={q.prompt}
                            mediaMap={mediaMap}
                            stripImgTokens={showTwoColMath}
                          />

                          {/* Non-math inline images if any */}
                          {!isMathSection && q.images.length > 0 && (
                            <div className="flex flex-wrap gap-3">
                              {q.images.map((imgUrl, iIdx) => (
                                <button
                                  key={`${q.id}_img_${iIdx}`}
                                  type="button"
                                  onClick={() => setLightboxImage(imgUrl)}
                                  className="group relative overflow-hidden rounded border border-slate-200 bg-[#F8FAFC] p-1"
                                >
                                  <img
                                    src={imgUrl}
                                    alt={`Hình câu ${q.number}`}
                                    className="max-h-[200px] w-auto object-contain"
                                  />
                                  <span className="absolute bottom-1.5 right-1.5 rounded bg-slate-900/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
                                    <Maximize2 className="h-3 w-3" />
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* MCQ Options */}
                          {q.type === "mcq" ? (
                            <div className="grid grid-cols-1 gap-2">
                              {q.options.map((opt) => {
                                const isChosen =
                                  userAnswer.trim().toUpperCase() ===
                                  opt.key.toUpperCase();
                                const isOptCorrect =
                                  q.correctAnswer.trim().toUpperCase() ===
                                  opt.key.toUpperCase();

                                let optClass =
                                  "border-slate-200 bg-white text-slate-800 hover:bg-slate-50";
                                if (reviewMode) {
                                  if (isOptCorrect) {
                                    optClass =
                                      "border-emerald-600 bg-emerald-50 text-emerald-900";
                                  } else if (isChosen && !isOptCorrect) {
                                    optClass =
                                      "border-red-500 bg-red-50 text-red-900";
                                  } else {
                                    optClass =
                                      "border-slate-200 bg-white text-slate-500";
                                  }
                                } else if (isChosen) {
                                  optClass =
                                    "border-blue-700 bg-blue-50/70 text-blue-950";
                                }

                                return (
                                  <button
                                    key={opt.key}
                                    type="button"
                                    disabled={reviewMode}
                                    onClick={() =>
                                      handleSelectAnswer(q.id, opt.key)
                                    }
                                    className={`flex items-start gap-3 rounded-md border px-3.5 py-2.5 text-left text-sm transition-colors disabled:cursor-default ${optClass}`}
                                  >
                                    <span
                                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border text-xs font-bold ${
                                        reviewMode
                                          ? isOptCorrect
                                            ? "border-emerald-700 bg-emerald-700 text-white"
                                            : isChosen
                                            ? "border-red-600 bg-red-600 text-white"
                                            : "border-slate-300 bg-[#F8FAFC] text-slate-600"
                                          : isChosen
                                          ? "border-blue-800 bg-blue-800 text-white"
                                          : "border-slate-300 bg-[#F8FAFC] text-slate-700"
                                      }`}
                                    >
                                      {opt.key}
                                    </span>
                                    <div className="flex-1 pt-0.5">
                                      <MathContent
                                        content={opt.text}
                                        mediaMap={mediaMap}
                                      />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            /* Short Answer Input */
                            <div className="max-w-xs space-y-2">
                              <label className="block text-xs font-medium text-slate-600">
                                Nhập đáp án của bạn:
                              </label>
                              <input
                                type="text"
                                disabled={reviewMode}
                                value={userAnswer}
                                onChange={(e) =>
                                  handleSelectAnswer(q.id, e.target.value)
                                }
                                placeholder="Nhập số hoặc đáp án..."
                                className={`w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none ${
                                  reviewMode
                                    ? isCorrect
                                      ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                                      : isAnswered
                                      ? "border-red-500 bg-red-50 text-red-900"
                                      : "border-slate-200 bg-slate-50 text-slate-500"
                                    : "border-slate-300 bg-white text-slate-900 focus:border-blue-700"
                                }`}
                              />
                              {reviewMode && (
                                <p className="text-xs font-medium text-emerald-700">
                                  Đáp án đúng:{" "}
                                  <span className="font-mono font-bold">
                                    {q.correctAnswer}
                                  </span>
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right 35% Image column for Math questions */}
                        {showTwoColMath && (
                          <div className="flex flex-col items-center justify-start gap-2.5 md:col-span-4">
                            {q.images.map((imgUrl, iIdx) => (
                              <button
                                key={`${q.id}_math_img_${iIdx}`}
                                type="button"
                                onClick={() => setLightboxImage(imgUrl)}
                                className="group relative w-full overflow-hidden rounded-md border border-slate-200 bg-[#F8FAFC] p-2 text-center hover:border-slate-300"
                              >
                                <img
                                  src={imgUrl}
                                  alt={`Hình câu ${q.number}`}
                                  className="mx-auto max-h-[175px] w-auto object-contain"
                                />
                                <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 group-hover:text-slate-700">
                                  <Maximize2 className="h-3 w-3" />
                                  Bấm để phóng to
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Detailed Explanation in Review Mode */}
                      {reviewMode && q.explanation && (
                        <div className="mt-4 rounded-md border border-slate-200 bg-[#F8FAFC] p-3.5">
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
                            Lời giải chi tiết
                          </p>
                          <MathContent
                            content={q.explanation}
                            mediaMap={mediaMap}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </section>

        {/* Right Column (25%) - Sticky Sidebar */}
        <aside className="w-full lg:w-1/4">
          <div className="sticky top-[104px] space-y-4 rounded-lg border border-slate-200 bg-white p-4">
            {/* Timer */}
            {!reviewMode ? (
              <div className="rounded-md border border-slate-200 bg-[#F8FAFC] p-3.5 text-center">
                <p className="flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                  <Clock className="h-3.5 w-3.5" />
                  Thời gian còn lại
                </p>
                <p
                  className={`mt-1 font-mono text-3xl font-bold tabular-nums ${
                    secondsLeft <= 300 ? "text-red-700" : "text-slate-900"
                  }`}
                >
                  {formatCountdown(secondsLeft)}
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                  Đã hoàn thành bài thi
                </p>
                {scoreSummary && (
                  <p className="mt-1 font-mono text-2xl font-bold text-emerald-900">
                    {formatScoreDisplay(scoreSummary.totalScore)} /{" "}
                    {scoreSummary.maxTotalScore}
                  </p>
                )}
              </div>
            )}

            {/* Submit Button */}
            {!reviewMode && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowSubmitConfirm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? "Đang nộp bài..." : "Nộp bài"}
              </button>
            )}

            {/* Progress Line */}
            <div className="flex items-center justify-between border-y border-slate-100 py-2 text-xs text-slate-600">
              <span>
                Bạn đã chọn{" "}
                <strong className="text-slate-900">
                  {answeredCountInActive}/{activeQuestions.length}
                </strong>
              </span>
              <span className="text-slate-400">{activePart.shortTitle}</span>
            </div>

            {/* 5-Column Question Grid */}
            <div>
              <div className="grid grid-cols-5 gap-1.5">
                {activeQuestions.map((q) => {
                  const ans = answers[q.id];
                  const isAnswered = Boolean(ans && ans.trim() !== "");
                  const isFlagged = Boolean(flaggedIds[q.id]);
                  const isCorrect = reviewMode
                    ? isQuestionCorrect(q, ans)
                    : false;

                  let btnStyle =
                    "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
                  if (reviewMode) {
                    if (!isAnswered) {
                      btnStyle =
                        "border-slate-200 bg-slate-100 text-slate-500";
                    } else if (isCorrect) {
                      btnStyle =
                        "border-emerald-700 bg-emerald-600 text-white";
                    } else {
                      btnStyle = "border-red-700 bg-red-600 text-white";
                    }
                  } else if (isAnswered) {
                    btnStyle = "border-blue-800 bg-blue-800 text-white";
                  }

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => scrollToQuestion(q.id)}
                      className={`relative flex h-9 items-center justify-center rounded border text-xs font-semibold transition-colors ${btnStyle}`}
                    >
                      {q.number}
                      {isFlagged && (
                        <span
                          className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-amber-400"
                          title="Đã gắn cờ"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500">
                {!reviewMode ? (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-blue-800" />
                      Đã chọn
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-white" />
                      Chưa chọn
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                      Gắn cờ
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
                      Đúng
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-red-600" />
                      Sai
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" />
                      Bỏ trống
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Lightbox Modal for Images */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl rounded-lg border border-slate-200 bg-white p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              aria-label="Đóng ảnh"
              className="absolute right-3 top-3 rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
            <img
              src={lightboxImage}
              alt="Phóng to hình minh họa"
              className="max-h-[84vh] w-auto rounded object-contain"
            />
          </div>
        </div>
      )}

      {/* Confirm Submit Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-base font-bold text-slate-900">
              Xác nhận nộp bài thi
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Bạn đã hoàn thành{" "}
              <strong className="text-slate-900">
                {parts.reduce(
                  (s, p) =>
                    s +
                    p.questions.filter(
                      (q) => Boolean(answers[q.id] && answers[q.id].trim() !== "")
                    ).length,
                  0
                )}
                /
                {parts.reduce((s, p) => s + p.questions.length, 0)}
              </strong>{" "}
              câu hỏi. Sau khi nộp bài, hệ thống sẽ chấm điểm và không thể thay
              đổi đáp án.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Làm tiếp
              </button>
              <button
                type="button"
                onClick={() => handleSubmitExam(false)}
                className="rounded-md bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900"
              >
                Xác nhận nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Exit Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="text-base font-bold text-slate-900">
              Thoát khỏi phòng thi?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Bài làm hiện tại chưa được nộp. Nếu thoát ngay bây giờ, kết quả sẽ
              không được ghi nhận.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Ở lại phòng thi
              </button>
              <button
                type="button"
                onClick={onBackToDashboard}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
              >
                Thoát ra ngoài
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HSA Score Report Modal (Phiếu báo điểm) */}
      {showScoreModal && scoreSummary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white">
            {/* Dark Green Header Strip */}
            <div className="bg-emerald-800 px-6 py-4 text-white">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-100">
                Hệ thống luyện thi TCT Study · Chuẩn ĐHQGHN
              </p>
              <h2 className="mt-0.5 text-lg font-bold uppercase tracking-wide">
                Phiếu báo điểm kỳ thi Đánh giá năng lực (HSA)
              </h2>
            </div>

            <div className="space-y-5 p-6">
              {saveError && (
                <div className="rounded border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs text-amber-800">
                  {saveError}
                </div>
              )}

              {/* 4 Score Blocks: Red Total Block on Left + 3 Component Blocks */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex flex-col items-center justify-center rounded-md border border-red-800 bg-red-700 p-4 text-center text-white">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-red-100">
                    Tổng điểm
                  </span>
                  <span className="mt-1.5 font-mono text-3xl font-bold">
                    {formatScoreDisplay(scoreSummary.totalScore)}
                  </span>
                  <span className="mt-0.5 text-xs text-red-100">
                    / {scoreSummary.maxTotalScore} điểm
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center rounded-md border border-slate-200 bg-[#F8FAFC] p-4 text-center">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Tư duy Định lượng
                  </span>
                  <span className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
                    {scoreSummary.byCategory.quant !== null
                      ? formatScoreDisplay(scoreSummary.byCategory.quant)
                      : "—"}
                  </span>
                  <span className="mt-0.5 text-xs text-slate-500">/ 50 điểm</span>
                </div>

                <div className="flex flex-col items-center justify-center rounded-md border border-slate-200 bg-[#F8FAFC] p-4 text-center">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Tư duy Định tính
                  </span>
                  <span className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
                    {scoreSummary.byCategory.qual !== null
                      ? formatScoreDisplay(scoreSummary.byCategory.qual)
                      : "—"}
                  </span>
                  <span className="mt-0.5 text-xs text-slate-500">/ 50 điểm</span>
                </div>

                <div className="flex flex-col items-center justify-center rounded-md border border-slate-200 bg-[#F8FAFC] p-4 text-center">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Tiếng Anh
                  </span>
                  <span className="mt-1.5 font-mono text-2xl font-bold text-slate-900">
                    {scoreSummary.byCategory.english !== null
                      ? formatScoreDisplay(scoreSummary.byCategory.english)
                      : "—"}
                  </span>
                  <span className="mt-0.5 text-xs text-slate-500">/ 50 điểm</span>
                </div>
              </div>

              {/* Compact per-section accuracy table */}
              <div className="overflow-hidden rounded-md border border-slate-200">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="border-b border-slate-200 bg-[#F8FAFC] font-semibold text-slate-600">
                    <tr>
                      <th className="px-3.5 py-2">Phần thi</th>
                      <th className="px-3 py-2 text-center">Số câu đúng</th>
                      <th className="px-3.5 py-2 text-right">Điểm đạt được</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {scoreSummary.sections.map((sec) => (
                      <tr key={sec.key}>
                        <td className="px-3.5 py-2 font-medium text-slate-800">
                          {sec.title}
                        </td>
                        <td className="px-3 py-2 text-center text-slate-600">
                          {sec.correct}/{sec.total}
                        </td>
                        <td className="px-3.5 py-2 text-right font-mono font-semibold text-slate-900">
                          {formatScoreDisplay(sec.score)} / {sec.maxScore}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {showLeaderboardNote && (
                <div className="rounded-md border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs text-slate-600">
                  Kết quả của bạn đã được ghi nhận vào bảng xếp hạng của đề thi{" "}
                  <strong className="text-slate-900">{quizTitle}</strong>. Quay
                  về danh sách đề để xem bảng xếp hạng chi tiết.
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 gap-2.5 border-t border-slate-200 pt-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowScoreModal(false);
                    setReviewMode(true);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-900"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Xem lại đáp án & Lời giải
                </button>
                <button
                  type="button"
                  onClick={handleRestartExam}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Làm lại bài
                </button>
                <button
                  type="button"
                  onClick={() => setShowLeaderboardNote((prev) => !prev)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Trophy className="h-4 w-4" />
                  Bảng xếp hạng
                </button>
                <button
                  type="button"
                  onClick={onBackToDashboard}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-[#F8FAFC] px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Về danh sách đề
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
