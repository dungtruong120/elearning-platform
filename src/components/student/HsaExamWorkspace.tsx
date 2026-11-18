"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import katex from "katex";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  Clock,
  Flag,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Eye,
  Award,
  ZoomIn,
  X,
  BookOpen,
  Check,
  AlertCircle,
  Loader2,
  FileCheck2,
  Layers,
  Lock
} from "lucide-react";

export interface HsaExamWorkspaceProps {
  quizId: string;
  quizTitle: string;
  examData?: any;
  profile: any;
  onBackToDashboard: () => void;
  initialReviewMode?: boolean;
  reviewAttempt?: any;
}

export type HsaPartKey = "quant" | "qual" | "english" | "history_geo";

export interface HsaPartConfig {
  key: HsaPartKey;
  code: string;
  title: string;
  upperTitle: string;
  shortTitle: string;
  defaultQuestions: number;
  defaultDurationMinutes: number;
  maxPoints: number;
  isElective: boolean;
}

export const HSA_PARTS_CONFIG: Record<HsaPartKey, HsaPartConfig> = {
  quant: {
    key: "quant",
    code: "Phần 1 (Bắt buộc)",
    title: "Toán học & Xử lý số liệu",
    upperTitle: "PHẦN 1: TOÁN HỌC & XỬ LÝ SỐ LIỆU",
    shortTitle: "Toán học & Xử lý số liệu",
    defaultQuestions: 50,
    defaultDurationMinutes: 75,
    maxPoints: 50,
    isElective: false
  },
  qual: {
    key: "qual",
    code: "Phần 2 (Bắt buộc)",
    title: "Ngôn ngữ - Văn học",
    upperTitle: "PHẦN 2: NGÔN NGỮ - VĂN HỌC",
    shortTitle: "Ngôn ngữ - Văn học",
    defaultQuestions: 50,
    defaultDurationMinutes: 60,
    maxPoints: 50,
    isElective: false
  },
  english: {
    key: "english",
    code: "Phần 3 (Tự chọn • Tổ hợp 1)",
    title: "Tổ hợp 1: Tiếng Anh",
    upperTitle: "PHẦN 3: TIẾNG ANH",
    shortTitle: "Tiếng Anh",
    defaultQuestions: 50,
    defaultDurationMinutes: 60,
    maxPoints: 50,
    isElective: true
  },
  history_geo: {
    key: "history_geo",
    code: "Phần 3 (Tự chọn • Tổ hợp 2)",
    title: "Tổ hợp 2: Khoa học (Lịch sử - Địa lý)",
    upperTitle: "PHẦN 3: KHOA HỌC (LỊCH SỬ - ĐỊA LÝ)",
    shortTitle: "Lịch sử - Địa lý",
    defaultQuestions: 50,
    defaultDurationMinutes: 60,
    maxPoints: 50,
    isElective: true
  }
};

export const HSA_PART_ORDER: HsaPartKey[] = ["quant", "qual", "english", "history_geo"];

export interface NormalizedHsaQuestion {
  id: string;
  localIndex: number; // 1 -> N trong phần thi
  partKey: HsaPartKey;
  type: "multiple_choice" | "short_answer" | "true_false";
  promptHtml: string;
  images: string[];
  options: {
    key: string;
    textHtml: string;
    isTrueFalseAns?: boolean;
  }[];
  correctAnswer: string;
  solutionHtml: string;
  groupId?: string;
  groupPassage?: string;
  groupImages: string[];
}

export interface NormalizedHsaPart {
  partKey: HsaPartKey;
  title: string;
  upperTitle: string;
  shortTitle: string;
  durationMinutes: number;
  maxPoints: number;
  isElective: boolean;
  questions: NormalizedHsaQuestion[];
  mediaMap: Record<string, string>;
}

export interface HsaPartProgress {
  partKey: HsaPartKey;
  completed: boolean;
  score: number; // Thang 50, làm tròn 1 chữ số thập phân
  correctCount: number;
  totalCount: number;
  answers: Record<string, string>;
  flaggedIds?: string[];
  timeSpentSeconds: number;
  completedAt: string;
}

export interface HsaSavedProgress {
  quizId: string;
  studentId: string;
  selectedElective: "english" | "history_geo";
  parts: Partial<Record<HsaPartKey, HsaPartProgress>>;
  activeDraftAnswers?: Partial<Record<HsaPartKey, Record<string, string>>>;
  activeDraftFlags?: Partial<Record<HsaPartKey, string[]>>;
  updatedAt: string;
}

// ============================================================================
// HÀM TIỆN ÍCH XỬ LÝ CÔNG THỨC TOÁN KATEX & HÌNH ẢNH TOKEN
// ============================================================================

function normalizeMathString(raw: string): string {
  if (!raw) return "";
  let text = String(raw).normalize("NFC");

  text = text.replace(/\\left\(\s*\\right\)/g, "");
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => "$$" + m.trim() + "$$");
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => "$" + m.trim() + "$");

  text = text.replace(
    /\\left\s*\\\{\s*\\begin\{(?:align|aligned|array)\}([\s\S]*?)\\end\{(?:align|aligned|array)\}\s*\\right\./gi,
    (_, body) => {
      const cleanBody = body.replace(/&/g, "").trim();
      return "$$\\begin{cases} " + cleanBody + " \\end{cases}$$";
    }
  );

  return text;
}

function resolveTokenImageSrc(rawTokenInner: string, mediaMap: Record<string, string>): string | null {
  if (!rawTokenInner) return null;
  let cleanKey = rawTokenInner.trim();
  if (cleanKey.startsWith("$") && cleanKey.endsWith("$")) {
    cleanKey = cleanKey.slice(1, -1).trim();
  }
  if (
    cleanKey.startsWith("http://") ||
    cleanKey.startsWith("https://") ||
    cleanKey.startsWith("data:image")
  ) {
    return cleanKey;
  }
  return (
    mediaMap[cleanKey] ||
    mediaMap["$" + cleanKey + "$"] ||
    mediaMap[rawTokenInner.trim()] ||
    null
  );
}

function extractImagesAndCleanText(
  rawText: string,
  mediaMap: Record<string, string>,
  explicitImage?: string
): { cleanedText: string; images: string[] } {
  const images: string[] = [];
  if (explicitImage && typeof explicitImage === "string" && explicitImage.trim()) {
    const resolvedExplicit =
      resolveTokenImageSrc(explicitImage.trim(), mediaMap) || explicitImage.trim();
    if (resolvedExplicit && !images.includes(resolvedExplicit)) {
      images.push(resolvedExplicit);
    }
  }

  if (!rawText) {
    return { cleanedText: "", images };
  }

  const tokenRegex = /\[(?:img|image):\s*([^\]]+)\]/gi;
  const cleanedText = rawText
    .replace(tokenRegex, (_, inner) => {
      const src = resolveTokenImageSrc(inner, mediaMap);
      if (src && !images.includes(src)) {
        images.push(src);
      }
      return "";
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { cleanedText, images };
}

function MathAndImageRenderer({
  content,
  mediaMap = {},
  inline = false,
  onOpenLightbox
}: {
  content?: string;
  mediaMap?: Record<string, string>;
  inline?: boolean;
  onOpenLightbox?: (src: string) => void;
}) {
  if (!content) return null;
  const normalized = normalizeMathString(content);
  const segments = normalized.split(/(\[(?:img|image):[^\]]+\]|\$\$[\s\S]*?\$\$|\$[^\$]+?\$)/g);

  return (
    <div
      className={
        inline
          ? "inline font-sans antialiased text-[15px] leading-[1.7] text-slate-900 break-words"
          : "font-sans antialiased text-[15px] leading-[1.7] text-slate-900 whitespace-pre-wrap break-words"
      }
    >
      {segments.map((seg, idx) => {
        if (!seg) return null;

        const imgMatch = seg.match(/^\[(?:img|image):([^\]]+)\]$/i);
        if (imgMatch && imgMatch[1]) {
          const src = resolveTokenImageSrc(imgMatch[1], mediaMap);
          if (!src) return null;
          return (
            <img
              key={idx}
              src={src}
              alt="Minh họa"
              onClick={() => onOpenLightbox && onOpenLightbox(src)}
              className="inline-block max-h-24 align-middle mx-1.5 my-1 object-contain rounded border border-slate-200 bg-white p-0.5 cursor-zoom-in"
            />
          );
        }

        if (seg.startsWith("$") && seg.endsWith("$")) {
          const isDisplay = seg.startsWith("$$");
          const latex = (isDisplay ? seg.slice(2, -2) : seg.slice(1, -1)).trim();
          if (!latex || latex === "()") return null;

          try {
            const html = katex.renderToString(latex, {
              displayMode: isDisplay,
              throwOnError: false
            });
            return (
              <span
                key={idx}
                className={
                  isDisplay
                    ? "block my-2.5 text-center overflow-x-auto py-1 text-[16px] text-slate-900"
                    : "inline align-baseline px-0.5 text-[15.5px] text-slate-900"
                }
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          } catch {
            return (
              <span key={idx} className="font-mono text-slate-800 text-[15px]">
                {latex}
              </span>
            );
          }
        }

        return <span key={idx}>{seg}</span>;
      })}
    </div>
  );
}

// ============================================================================
// HÀM CHUẨN HÓA DỮ LIỆU ĐỀ HSA (4 PHẦN: quant, qual, english, history_geo)
// ============================================================================

function detectPartKeyFromSection(sec: any, fallbackIndex: number): HsaPartKey {
  const rawKey = String(
    sec?.part_key || sec?.hsa_part_key || sec?.partKey || sec?.subject_key || ""
  )
    .trim()
    .toLowerCase();

  if (rawKey === "quant" || rawKey.includes("quant") || rawKey.includes("toan")) return "quant";
  if (rawKey === "qual" || rawKey.includes("qual") || rawKey.includes("van") || rawKey.includes("ngon_ngu")) {
    return "qual";
  }
  if (rawKey === "english" || rawKey === "eng" || rawKey.includes("anh")) return "english";
  if (
    rawKey === "history_geo" ||
    rawKey === "science" ||
    rawKey.includes("su") ||
    rawKey.includes("dia") ||
    rawKey.includes("khoa_hoc")
  ) {
    return "history_geo";
  }

  const titleLower = String(sec?.section_title || sec?.title || sec?.name || "")
    .normalize("NFC")
    .toLowerCase();

  if (
    titleLower.includes("định lượng") ||
    titleLower.includes("toán") ||
    titleLower.includes("xử lý số liệu") ||
    titleLower.includes("phần 1") ||
    titleLower.includes("phần i:")
  ) {
    return "quant";
  }
  if (
    titleLower.includes("định tính") ||
    titleLower.includes("ngôn ngữ") ||
    titleLower.includes("văn học") ||
    titleLower.includes("ngữ văn") ||
    titleLower.includes("phần 2") ||
    titleLower.includes("phần ii:")
  ) {
    return "qual";
  }
  if (titleLower.includes("tiếng anh") || titleLower.includes("english") || titleLower.includes("ngoại ngữ")) {
    return "english";
  }
  if (
    titleLower.includes("lịch sử") ||
    titleLower.includes("địa lý") ||
    titleLower.includes("địa lí") ||
    titleLower.includes("khoa học")
  ) {
    return "history_geo";
  }

  if (fallbackIndex === 0) return "quant";
  if (fallbackIndex === 1) return "qual";
  if (fallbackIndex === 2) return "english";
  return "history_geo";
}

function normalizeShortAnswerText(val: string): string {
  return String(val || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/,/g, ".");
}

function isQuestionAnswered(q: NormalizedHsaQuestion, userAns?: string): boolean {
  if (userAns === undefined || userAns === null) return false;
  const trimmed = String(userAns).trim();
  if (!trimmed) return false;
  if (q.type === "true_false") {
    return trimmed.length > 0 && !/^[-_]+$/.test(trimmed);
  }
  return true;
}

function checkIsQuestionCorrect(q: NormalizedHsaQuestion, userAns?: string): boolean {
  if (!isQuestionAnswered(q, userAns)) return false;
  const cleanUser = String(userAns || "").trim();
  const cleanCorrect = String(q.correctAnswer || "").trim();

  if (q.type === "short_answer") {
    const normU = normalizeShortAnswerText(cleanUser);
    const possibleCorrects = cleanCorrect
      .split(/[;|\/]/)
      .map((s) => normalizeShortAnswerText(s))
      .filter(Boolean);

    if (possibleCorrects.includes(normU)) return true;
    const numU = Number(normU);
    for (const c of possibleCorrects) {
      const numC = Number(c);
      if (!isNaN(numU) && !isNaN(numC) && Math.abs(numU - numC) < 1e-6) {
        return true;
      }
    }
    return false;
  }

  return cleanUser.toUpperCase() === cleanCorrect.toUpperCase();
}

function parseExamIntoHsaParts(rawExam: any): Record<HsaPartKey, NormalizedHsaPart | null> {
  const result: Record<HsaPartKey, NormalizedHsaPart | null> = {
    quant: null,
    qual: null,
    english: null,
    history_geo: null
  };

  if (!rawExam) return result;

  const globalMediaMap: Record<string, string> = {
    ...(rawExam.mediaMap || {}),
    ...(rawExam.media_map || {})
  };

  let rawSections: any[] = [];
  if (Array.isArray(rawExam.data) && rawExam.data.length > 0) {
    rawSections = rawExam.data;
  } else if (Array.isArray(rawExam.sections) && rawExam.sections.length > 0) {
    rawSections = rawExam.sections;
  } else if (typeof rawExam.data === "string") {
    try {
      const parsed = JSON.parse(rawExam.data);
      if (Array.isArray(parsed)) rawSections = parsed;
      else if (Array.isArray(parsed?.sections)) rawSections = parsed.sections;
      else if (Array.isArray(parsed?.data)) rawSections = parsed.data;
    } catch {}
  } else if (Array.isArray(rawExam.questions) && rawExam.questions.length > 0) {
    rawSections = [
      {
        part_key: rawExam.part_key || "quant",
        section_title: rawExam.title || "Toán học & Xử lý số liệu",
        duration_minutes: rawExam.duration_minutes || 75,
        questions: rawExam.questions
      }
    ];
  }

  if (
    rawSections.length > 0 &&
    (rawSections[0]?.prompt_html || rawSections[0]?.prompt || rawSections[0]?.options) &&
    !Array.isArray(rawSections[0]?.questions)
  ) {
    rawSections = [
      {
        part_key: rawExam.part_key || "quant",
        section_title: rawExam.title || "Toán học & Xử lý số liệu",
        duration_minutes: rawExam.duration_minutes || 75,
        questions: rawSections
      }
    ];
  }

  rawSections.forEach((sec: any, sIdx: number) => {
    const partKey = detectPartKeyFromSection(sec, sIdx);
    const cfg = HSA_PARTS_CONFIG[partKey];
    const secMediaMap: Record<string, string> = {
      ...globalMediaMap,
      ...(sec?.mediaMap || {}),
      ...(sec?.media_map || {})
    };

    if (!result[partKey]) {
      result[partKey] = {
        partKey,
        title: cfg.title,
        upperTitle: cfg.upperTitle,
        shortTitle: cfg.shortTitle,
        durationMinutes: Number(sec?.duration_minutes || sec?.duration) || cfg.defaultDurationMinutes,
        maxPoints: cfg.maxPoints,
        isElective: cfg.isElective,
        questions: [],
        mediaMap: secMediaMap
      };
    } else {
      result[partKey]!.mediaMap = {
        ...result[partKey]!.mediaMap,
        ...secMediaMap
      };
    }

    const targetPart = result[partKey]!;
    const rawQuestions = Array.isArray(sec?.questions) ? sec.questions : [];

    rawQuestions.forEach((q: any) => {
      const qMediaMap: Record<string, string> = {
        ...targetPart.mediaMap,
        ...(q?.mediaMap || {}),
        ...(q?.media_map || {})
      };
      targetPart.mediaMap = qMediaMap;

      const localIndex = targetPart.questions.length + 1;
      const qId = String(q?.id || `${partKey}-q-${localIndex}`);

      const rawPrompt = String(q?.prompt_html || q?.prompt || q?.question || "");
      const { cleanedText: promptHtml, images: qImages } = extractImagesAndCleanText(
        rawPrompt,
        qMediaMap,
        q?.image
      );

      // Xử lý câu hỏi chùm (group_id & group_passage / passage_html)
      const rawPassage = String(
        q?.group_passage || q?.passage_html || q?.passage || sec?.passage_html || ""
      ).trim();
      const { cleanedText: groupPassage, images: groupImages } = extractImagesAndCleanText(
        rawPassage,
        qMediaMap,
        q?.group_image || q?.passage_image
      );

      let groupId: string | undefined = q?.group_id ? String(q.group_id).trim() : undefined;
      if (!groupId && (groupPassage || groupImages.length > 0)) {
        // Nếu có ngữ liệu chung nhưng chưa gán group_id, tự sinh group_id ổn định theo nội dung ngữ liệu để gom nhóm các câu liên tiếp
        groupId = `passage_${partKey}_${rawPassage.slice(0, 48).replace(/\s+/g, "_")}`;
      }

      const rawOpts = Array.isArray(q?.options) ? q.options : [];
      const hasValidMcOptions = rawOpts.some(
        (o: any) => String(o?.text_html || o?.text || "").trim() !== ""
      );

      let qType: "multiple_choice" | "short_answer" | "true_false" = "multiple_choice";
      if (q?.type === "short_answer" || sec?.section_type === "short_answer") {
        qType = "short_answer";
      } else if (q?.type === "true_false" || sec?.section_type === "true_false") {
        qType = "true_false";
      } else if (!hasValidMcOptions && rawOpts.length === 0) {
        qType = "short_answer";
      }

      const normalizedOptions =
        qType === "short_answer"
          ? []
          : rawOpts.map((o: any, oIdx: number) => ({
              key: String(o?.key || ["A", "B", "C", "D"][oIdx] || "A"),
              textHtml: String(o?.text_html || o?.text || "").trim(),
              isTrueFalseAns: o?.is_true_false_ans
            }));

      let correctAnswer = String(q?.correct_answer ?? q?.answer ?? "").trim();
      if (qType === "true_false" && !correctAnswer && normalizedOptions.length === 4) {
        correctAnswer = normalizedOptions
          .map((o) => (o.isTrueFalseAns ? "Đ" : "S"))
          .join("");
      }
      if (qType === "multiple_choice" && !correctAnswer) {
        correctAnswer = "A";
      }

      targetPart.questions.push({
        id: qId,
        localIndex,
        partKey,
        type: qType,
        promptHtml,
        images: qImages,
        options: normalizedOptions,
        correctAnswer,
        solutionHtml: String(q?.solution_html || q?.solution || q?.explanation || "").trim(),
        groupId,
        groupPassage: groupPassage || undefined,
        groupImages
      });
    });
  });

  return result;
}

// ============================================================================
// COMPONENT CHÍNH: HsaExamWorkspace
// ============================================================================

export function HsaExamWorkspace({
  quizId,
  quizTitle,
  examData: initialExamData,
  profile,
  onBackToDashboard,
  initialReviewMode = false,
  reviewAttempt
}: HsaExamWorkspaceProps) {
  const [loadedExam, setLoadedExam] = useState<any | null>(initialExamData || null);
  const [isFetchingExam, setIsFetchingExam] = useState<boolean>(false);

  // 3 màn hình chính: "hub" (Màn hình 1) | "room" (Màn hình 2 & Review 2 cột) | "report" (Màn hình 3 - Phiếu điểm HSA)
  const [screen, setScreen] = useState<"hub" | "room" | "report">(
    initialReviewMode ? "report" : "hub"
  );

  // Phần thi đang mở ở Màn hình 2 (hoặc đang xem lại)
  const [activePartKey, setActivePartKey] = useState<HsaPartKey>("quant");
  const [isReviewMode, setIsReviewMode] = useState<boolean>(Boolean(initialReviewMode));
  const [reviewFilter, setReviewFilter] = useState<"all" | "wrong" | "unanswered">("all");

  // Tổ hợp tự chọn Phần 3: "english" | "history_geo"
  const [selectedElective, setSelectedElective] = useState<"english" | "history_geo">("english");

  // Tiến trình các phần đã lưu
  const [partsProgress, setPartsProgress] = useState<Partial<Record<HsaPartKey, HsaPartProgress>>>({});

  // State làm bài trong phòng thi thực chiến (Màn hình 2)
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestionIds, setFlaggedQuestionIds] = useState<Set<string>>(new Set());
  const [remainingSeconds, setRemainingSeconds] = useState<number>(75 * 60);
  const [partStartTimeMs, setPartStartTimeMs] = useState<number>(Date.now());
  const [isSubmittingPart, setIsSubmittingPart] = useState<boolean>(false);

  // Lightbox phóng to hình ảnh & Modal xác nhận nộp phần thi / làm lại
  const [lightboxImageSrc, setLightboxImageSrc] = useState<string | null>(null);
  const [confirmSubmitModal, setConfirmSubmitModal] = useState<boolean>(false);
  const [confirmResetModal, setConfirmResetModal] = useState<boolean>(false);

  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const studentId = useMemo(() => String(profile?.id || "guest"), [profile?.id]);
  const studentName = useMemo(
    () => String(profile?.full_name || profile?.name || profile?.username || "Thí sinh"),
    [profile]
  );
  const studentSbd = useMemo(() => {
    const raw = profile?.student_code || profile?.sbd;
    if (raw && !String(raw).includes("HS-")) {
      const clean = String(raw).replace(/\D/g, "");
      if (clean) return clean.padStart(6, "0").slice(-6);
    }
    return "000001";
  }, [profile]);

  const progressStorageKey = useMemo(
    () => `tct_hsa_progress_${studentId}_${quizId}`,
    [studentId, quizId]
  );

  // --------------------------------------------------------------------------
  // 1. TỰ ĐỘNG FETCH DỮ LIỆU ĐỀ THI TỪ SUPABASE (`practice_exams`) NẾU CHƯA CÓ
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    const hasLoadedSections = (ex: any) => {
      if (!ex) return false;
      if (Array.isArray(ex.data) && ex.data.length > 0) return true;
      if (Array.isArray(ex.sections) && ex.sections.length > 0) return true;
      if (Array.isArray(ex.questions) && ex.questions.length > 0) return true;
      return false;
    };

    if (hasLoadedSections(initialExamData)) {
      setLoadedExam(initialExamData);
      return;
    }

    const fetchExamFromSource = async () => {
      setIsFetchingExam(true);
      try {
        // Kiểm tra trong localStorage trước nếu có bản đầy đủ
        if (typeof window !== "undefined") {
          const cacheKeys = ["edunexus_practice_exams", "edunexus_quizzes"];
          for (const key of cacheKeys) {
            try {
              const raw = localStorage.getItem(key);
              if (!raw) continue;
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                const found = list.find((item: any) => String(item?.id) === String(quizId));
                if (found && hasLoadedSections(found)) {
                  if (isMounted) {
                    setLoadedExam(found);
                    setIsFetchingExam(false);
                  }
                  return;
                }
              }
            } catch {}
          }
        }

        // Fetch từ bảng practice_exams trên Supabase
        const { data: dbExam, error } = await supabase
          .from("practice_exams")
          .select("*")
          .eq("id", quizId)
          .maybeSingle();

        if (!error && dbExam && isMounted) {
          setLoadedExam(dbExam);
        }
      } catch (err) {
        console.error("Lỗi tải dữ liệu đề HSA:", err);
      } finally {
        if (isMounted) setIsFetchingExam(false);
      }
    };

    fetchExamFromSource();

    return () => {
      isMounted = false;
    };
  }, [quizId, initialExamData]);

  // Chuẩn hóa 4 phần thi từ dữ liệu đề
  const partsMap = useMemo(() => parseExamIntoHsaParts(loadedExam), [loadedExam]);

  const availablePartKeys = useMemo(
    () => HSA_PART_ORDER.filter((k) => partsMap[k] !== null && partsMap[k]!.questions.length > 0),
    [partsMap]
  );

  const hasEnglishQuestions = useMemo(
    () => Boolean(partsMap.english && partsMap.english.questions.length > 0),
    [partsMap]
  );

  const hasHistoryGeoQuestions = useMemo(
    () => Boolean(partsMap.history_geo && partsMap.history_geo.questions.length > 0),
    [partsMap]
  );

  const hasBothElectives = useMemo(
    () => hasEnglishQuestions && hasHistoryGeoQuestions,
    [hasEnglishQuestions, hasHistoryGeoQuestions]
  );

  // Tự động chọn tổ hợp đã có dữ liệu nếu đề thi chỉ mở 1 trong 2 tổ hợp
  useEffect(() => {
    if (!hasEnglishQuestions && hasHistoryGeoQuestions) {
      setSelectedElective("history_geo");
    } else if (hasEnglishQuestions && !hasHistoryGeoQuestions) {
      setSelectedElective("english");
    }
  }, [hasEnglishQuestions, hasHistoryGeoQuestions]);

  // Cấu trúc 3 phần thi cố định của thí sinh hiển thị ở Màn hình 1: Phần 1 (quant), Phần 2 (qual), Phần 3 (selectedElective)
  const threeExamSlotKeys = useMemo<HsaPartKey[]>(
    () => ["quant", "qual", selectedElective],
    [selectedElective]
  );

  // Danh sách các phần trong cấu trúc 3 phần thi đã mở câu hỏi trong đề này
  const activeRequiredAndSelectedPartKeys = useMemo(
    () =>
      threeExamSlotKeys.filter(
        (k) => partsMap[k] !== null && partsMap[k]!.questions.length > 0
      ),
    [threeExamSlotKeys, partsMap]
  );

  // --------------------------------------------------------------------------
  // 2. KHÔI PHỤC TIẾN TRÌNH TỪ LOCALSTORAGE, REVIEW ATTEMPT & SUPABASE
  // --------------------------------------------------------------------------
  const reconstructProgressFromAnswersMap = useCallback(
    (
      rawAnswersObj: any,
      fallbackCreatedAt?: string
    ): {
      reconstructedParts: Partial<Record<HsaPartKey, HsaPartProgress>>;
      detectedElective?: "english" | "history_geo";
    } => {
      const reconstructedParts: Partial<Record<HsaPartKey, HsaPartProgress>> = {};
      let detectedElective: "english" | "history_geo" | undefined = undefined;

      if (!rawAnswersObj || typeof rawAnswersObj !== "object") {
        return { reconstructedParts, detectedElective };
      }

      // Nếu có __hsa_meta lưu cấu trúc từng phần đã hoàn thành
      const hsaMeta = rawAnswersObj.__hsa_meta;
      if (hsaMeta && typeof hsaMeta === "object") {
        if (hsaMeta.selectedElective === "english" || hsaMeta.selectedElective === "history_geo") {
          detectedElective = hsaMeta.selectedElective;
        }
        if (hsaMeta.completedParts && typeof hsaMeta.completedParts === "object") {
          HSA_PART_ORDER.forEach((pKey) => {
            const pMeta = hsaMeta.completedParts[pKey];
            const partObj = partsMap[pKey];
            if (pMeta && partObj) {
              const partAnswers: Record<string, string> = {};
              let correctCount = 0;
              partObj.questions.forEach((q) => {
                const ans =
                  rawAnswersObj[q.id] ??
                  pMeta.answers?.[q.id] ??
                  rawAnswersObj[`${pKey}_${q.localIndex}`];
                if (ans !== undefined && ans !== null && String(ans).trim() !== "") {
                  partAnswers[q.id] = String(ans);
                }
                if (checkIsQuestionCorrect(q, ans)) {
                  correctCount++;
                }
              });

              const totalCount = partObj.questions.length;
              const computedScore =
                totalCount > 0 ? Number(((correctCount / totalCount) * 50).toFixed(1)) : 0;

              reconstructedParts[pKey] = {
                partKey: pKey,
                completed: true,
                score: typeof pMeta.score === "number" ? pMeta.score : computedScore,
                correctCount,
                totalCount,
                answers: partAnswers,
                timeSpentSeconds: Number(pMeta.timeSpentSeconds || 0),
                completedAt: pMeta.completedAt || fallbackCreatedAt || new Date().toISOString()
              };
            }
          });
          return { reconstructedParts, detectedElective };
        }
      }

      // Nếu là attempt thông thường (chỉ có map questionId -> answer)
      HSA_PART_ORDER.forEach((pKey) => {
        const partObj = partsMap[pKey];
        if (!partObj || partObj.questions.length === 0) return;

        const partAnswers: Record<string, string> = {};
        let answeredCount = 0;
        let correctCount = 0;

        partObj.questions.forEach((q, idx) => {
          const ans =
            rawAnswersObj[q.id] ??
            rawAnswersObj[String(idx + 1)] ??
            rawAnswersObj[`q-${idx + 1}`];
          if (ans !== undefined && ans !== null && String(ans).trim() !== "") {
            partAnswers[q.id] = String(ans);
            answeredCount++;
          }
          if (checkIsQuestionCorrect(q, ans)) {
            correctCount++;
          }
        });

        if (answeredCount > 0 || initialReviewMode) {
          const totalCount = partObj.questions.length;
          const score = totalCount > 0 ? Number(((correctCount / totalCount) * 50).toFixed(1)) : 0;
          reconstructedParts[pKey] = {
            partKey: pKey,
            completed: true,
            score,
            correctCount,
            totalCount,
            answers: partAnswers,
            timeSpentSeconds: 0,
            completedAt: fallbackCreatedAt || new Date().toISOString()
          };
          if (pKey === "english" || pKey === "history_geo") {
            detectedElective = pKey;
          }
        }
      });

      return { reconstructedParts, detectedElective };
    },
    [partsMap, initialReviewMode]
  );

  useEffect(() => {
    if (availablePartKeys.length === 0) return;

    // Trường hợp mở từ Lịch sử làm bài (reviewAttempt)
    if (initialReviewMode && reviewAttempt) {
      let rawAns = reviewAttempt.answers || {};
      if (typeof rawAns === "string") {
        try {
          rawAns = JSON.parse(rawAns);
        } catch {
          rawAns = {};
        }
      }
      const { reconstructedParts, detectedElective } = reconstructProgressFromAnswersMap(
        rawAns,
        reviewAttempt.created_at || reviewAttempt.createdAt
      );
      if (detectedElective) setSelectedElective(detectedElective);
      setPartsProgress(reconstructedParts);
      const firstCompletedKey =
        HSA_PART_ORDER.find((k) => reconstructedParts[k]?.completed) || availablePartKeys[0];
      setActivePartKey(firstCompletedKey);
      setIsReviewMode(true);
      setScreen("report");
      return;
    }

    // Trường hợp mở đề làm bài bình thường -> Đọc từ localStorage trước, sau đó đồng bộ từ Supabase exam_attempts
    let foundLocal = false;
    if (typeof window !== "undefined") {
      try {
        const savedRaw = localStorage.getItem(progressStorageKey);
        if (savedRaw) {
          const parsed: HsaSavedProgress = JSON.parse(savedRaw);
          if (parsed && parsed.parts && Object.keys(parsed.parts).length > 0) {
            setPartsProgress(parsed.parts);
            if (
              parsed.selectedElective === "english" ||
              parsed.selectedElective === "history_geo"
            ) {
              setSelectedElective(parsed.selectedElective);
            }
            foundLocal = true;
          }
        }
      } catch {}
    }

    if (!foundLocal && profile?.id) {
      (async () => {
        try {
          const { data: cloudAttempt } = await supabase
            .from("exam_attempts")
            .select("id, quiz_id, student_id, score, answers, created_at")
            .eq("quiz_id", quizId)
            .eq("student_id", profile.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (cloudAttempt && cloudAttempt.answers) {
            let rawAns = cloudAttempt.answers;
            if (typeof rawAns === "string") {
              try {
                rawAns = JSON.parse(rawAns);
              } catch {
                rawAns = {};
              }
            }
            const { reconstructedParts, detectedElective } = reconstructProgressFromAnswersMap(
              rawAns,
              cloudAttempt.created_at
            );
            if (Object.keys(reconstructedParts).length > 0) {
              setPartsProgress(reconstructedParts);
              if (detectedElective) setSelectedElective(detectedElective);
              if (typeof window !== "undefined") {
                const payload: HsaSavedProgress = {
                  quizId,
                  studentId,
                  selectedElective: detectedElective || "english",
                  parts: reconstructedParts,
                  updatedAt: new Date().toISOString()
                };
                try {
                  localStorage.setItem(progressStorageKey, JSON.stringify(payload));
                } catch {}
              }
            }
          }
        } catch {}
      })();
    }
  }, [
    availablePartKeys,
    initialReviewMode,
    reviewAttempt,
    progressStorageKey,
    profile?.id,
    quizId,
    studentId,
    reconstructProgressFromAnswersMap
  ]);

  // Kiểm tra xem thí sinh đã bắt đầu / hoàn thành 1 trong 2 phần tự chọn chưa (để khóa đổi tổ hợp)
  const lockedElectiveKey = useMemo<"english" | "history_geo" | null>(() => {
    if (partsProgress.english?.completed) return "english";
    if (partsProgress.history_geo?.completed) return "history_geo";
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(progressStorageKey);
        if (raw) {
          const parsed: HsaSavedProgress = JSON.parse(raw);
          const draftEng = Object.keys(parsed.activeDraftAnswers?.english || {}).length;
          const draftHist = Object.keys(parsed.activeDraftAnswers?.history_geo || {}).length;
          if (draftEng > 0) return "english";
          if (draftHist > 0) return "history_geo";
        }
      } catch {}
    }
    return null;
  }, [partsProgress, progressStorageKey]);

  const handleSelectElective = (electiveKey: "english" | "history_geo") => {
    const isAvailable =
      electiveKey === "english" ? hasEnglishQuestions : hasHistoryGeoQuestions;
    if (!isAvailable) return;
    if (lockedElectiveKey && lockedElectiveKey !== electiveKey) return;

    setSelectedElective(electiveKey);
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(progressStorageKey);
        const existing: HsaSavedProgress = raw
          ? JSON.parse(raw)
          : {
              quizId,
              studentId,
              selectedElective: electiveKey,
              parts: partsProgress,
              updatedAt: new Date().toISOString()
            };
        existing.selectedElective = electiveKey;
        existing.updatedAt = new Date().toISOString();
        localStorage.setItem(progressStorageKey, JSON.stringify(existing));
      } catch {}
    }
  };

  // --------------------------------------------------------------------------
  // 3. BẮT ĐẦU LÀM 1 PHẦN HOẶC XEM LẠI ĐÁP ÁN PHẦN ĐÓ
  // --------------------------------------------------------------------------
  const handleStartPartExam = (partKey: HsaPartKey) => {
    const partObj = partsMap[partKey];
    if (!partObj || partObj.questions.length === 0) return;

    if (partKey === "english" || partKey === "history_geo") {
      setSelectedElective(partKey);
    }

    // Khôi phục bản nháp nếu đang làm dở trong localStorage
    let restoredAnswers: Record<string, string> = {};
    let restoredFlags: string[] = [];
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(progressStorageKey);
        if (raw) {
          const parsed: HsaSavedProgress = JSON.parse(raw);
          if (parsed.activeDraftAnswers?.[partKey]) {
            restoredAnswers = parsed.activeDraftAnswers[partKey]!;
          }
          if (parsed.activeDraftFlags?.[partKey]) {
            restoredFlags = parsed.activeDraftFlags[partKey]!;
          }
        }
      } catch {}
    }

    setActivePartKey(partKey);
    setCurrentAnswers(restoredAnswers);
    setFlaggedQuestionIds(new Set(restoredFlags));
    setRemainingSeconds((partObj.durationMinutes || 60) * 60);
    setPartStartTimeMs(Date.now());
    setIsReviewMode(false);
    setReviewFilter("all");
    setScreen("room");
  };

  const handleReviewPart = (partKey: HsaPartKey) => {
    const savedPart = partsProgress[partKey];
    if (!savedPart) return;
    setActivePartKey(partKey);
    setCurrentAnswers(savedPart.answers || {});
    setFlaggedQuestionIds(new Set(savedPart.flaggedIds || []));
    setIsReviewMode(true);
    setReviewFilter("all");
    setScreen("room");
  };

  // Lưu nháp câu trả lời vào localStorage mỗi khi chọn đáp án ở Màn hình 2
  const saveDraftToLocalStorage = useCallback(
    (partKey: HsaPartKey, nextAnswers: Record<string, string>, nextFlags: Set<string>) => {
      if (typeof window === "undefined" || isReviewMode) return;
      try {
        const raw = localStorage.getItem(progressStorageKey);
        const existing: HsaSavedProgress = raw
          ? JSON.parse(raw)
          : {
              quizId,
              studentId,
              selectedElective,
              parts: partsProgress,
              updatedAt: new Date().toISOString()
            };
        existing.selectedElective = selectedElective;
        existing.parts = partsProgress;
        existing.activeDraftAnswers = {
          ...(existing.activeDraftAnswers || {}),
          [partKey]: nextAnswers
        };
        existing.activeDraftFlags = {
          ...(existing.activeDraftFlags || {}),
          [partKey]: Array.from(nextFlags)
        };
        existing.updatedAt = new Date().toISOString();
        localStorage.setItem(progressStorageKey, JSON.stringify(existing));
      } catch {}
    },
    [isReviewMode, progressStorageKey, quizId, studentId, selectedElective, partsProgress]
  );

  const handleSelectAnswer = (questionId: string, value: string) => {
    if (isReviewMode) return;
    setCurrentAnswers((prev) => {
      const next = { ...prev, [questionId]: value };
      saveDraftToLocalStorage(activePartKey, next, flaggedQuestionIds);
      return next;
    });
  };

  const handleToggleTrueFalseSubOption = (
    questionId: string,
    subIndex: number,
    charVal: "Đ" | "S"
  ) => {
    if (isReviewMode) return;
    setCurrentAnswers((prev) => {
      const currentStr = String(prev[questionId] || "----").padEnd(4, "-");
      const chars = currentStr.split("").slice(0, 4);
      chars[subIndex] = charVal;
      const nextVal = chars.join("");
      const next = { ...prev, [questionId]: nextVal };
      saveDraftToLocalStorage(activePartKey, next, flaggedQuestionIds);
      return next;
    });
  };

  const handleToggleFlag = (questionId: string) => {
    setFlaggedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      saveDraftToLocalStorage(activePartKey, currentAnswers, next);
      return next;
    });
  };

  // --------------------------------------------------------------------------
  // 4. ĐỒNG BỘ KẾT QUẢ LÊN BẢNG `exam_attempts` TRÊN SUPABASE (SIÊU GỌN NHẸ)
  // --------------------------------------------------------------------------
  const syncProgressToSupabase = useCallback(
    async (
      updatedParts: Partial<Record<HsaPartKey, HsaPartProgress>>,
      electiveChoice: "english" | "history_geo"
    ) => {
      const completedEntries = Object.values(updatedParts).filter(
        (p): p is HsaPartProgress => Boolean(p && p.completed)
      );
      if (completedEntries.length === 0) return;

      const totalScore = Number(
        completedEntries.reduce((sum, p) => sum + Number(p.score || 0), 0).toFixed(1)
      );
      const totalCorrectCount = completedEntries.reduce(
        (sum, p) => sum + Number(p.correctCount || 0),
        0
      );
      const totalQuestionsCount = completedEntries.reduce(
        (sum, p) => sum + Number(p.totalCount || 0),
        0
      );
      const totalTimeSeconds = completedEntries.reduce(
        (sum, p) => sum + Number(p.timeSpentSeconds || 0),
        0
      );

      // Chỉ đóng gói answers gọn nhẹ (map questionId -> đáp án + metadata điểm từng phần), tuyệt đối không lưu dữ liệu rác
      const cleanCombinedAnswers: Record<string, any> = {};
      const completedMeta: Record<string, any> = {};

      completedEntries.forEach((partProg) => {
        Object.entries(partProg.answers || {}).forEach(([qId, ansVal]) => {
          if (ansVal !== undefined && ansVal !== null && String(ansVal).trim() !== "") {
            cleanCombinedAnswers[qId] = String(ansVal).trim();
          }
        });
        completedMeta[partProg.partKey] = {
          score: partProg.score,
          correctCount: partProg.correctCount,
          totalCount: partProg.totalCount,
          timeSpentSeconds: partProg.timeSpentSeconds,
          completedAt: partProg.completedAt
        };
      });

      cleanCombinedAnswers.__hsa_meta = {
        examFormat: "hsa",
        selectedElective: electiveChoice,
        maxPossibleScore: completedEntries.length * 50,
        completedParts: completedMeta
      };

      const attemptId = `hsa-${studentId}-${quizId}`;
      const nowIso = new Date().toISOString();

      // Lưu vào localStorage `edunexus_attempts` để đồng bộ với Lịch sử làm bài trên Dashboard
      if (typeof window !== "undefined") {
        try {
          const rawAtts = localStorage.getItem("edunexus_attempts");
          const parsedAtts = rawAtts ? JSON.parse(rawAtts) : [];
          const localRecord = {
            id: attemptId,
            quizId,
            quiz_id: quizId,
            exam_id: quizId,
            quizTitle,
            quiz_title: quizTitle,
            examTitle: quizTitle,
            exam_title: quizTitle,
            studentId,
            student_id: studentId,
            studentName,
            student_name: studentName,
            score: totalScore,
            points: totalScore,
            total_questions: totalQuestionsCount,
            correct_answers_count: totalCorrectCount,
            answers: cleanCombinedAnswers,
            time_spent: `${Math.max(1, Math.round(totalTimeSeconds / 60))} phút`,
            type: "practice",
            submission_type: "web_hsa",
            exam_format: "hsa",
            created_at: nowIso,
            createdAt: nowIso
          };
          const filtered = Array.isArray(parsedAtts)
            ? parsedAtts.filter((a: any) => String(a?.id) !== attemptId)
            : [];
          localStorage.setItem("edunexus_attempts", JSON.stringify([localRecord, ...filtered]));
          window.dispatchEvent(new Event("storage"));
        } catch {}
      }

      if (!profile?.id) return;

      try {
        const { data: existingRow } = await supabase
          .from("exam_attempts")
          .select("id")
          .eq("quiz_id", quizId)
          .eq("student_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const dbPayload: Record<string, any> = {
          quiz_id: quizId,
          quiz_title: quizTitle,
          student_id: profile.id,
          student_name: studentName,
          score: totalScore,
          total_questions: totalQuestionsCount,
          correct_answers_count: totalCorrectCount,
          answers: cleanCombinedAnswers
        };

        if (existingRow?.id) {
          const { error: updateErr } = await supabase
            .from("exam_attempts")
            .update(dbPayload)
            .eq("id", existingRow.id);

          if (updateErr) {
            await supabase
              .from("exam_attempts")
              .update({
                score: totalScore,
                answers: cleanCombinedAnswers
              })
              .eq("id", existingRow.id);
          }
        } else {
          const { error: insertErr } = await supabase.from("exam_attempts").insert([dbPayload]);
          if (insertErr) {
            await supabase.from("exam_attempts").insert([
              {
                quiz_id: quizId,
                student_id: profile.id,
                student_name: studentName,
                score: totalScore,
                answers: cleanCombinedAnswers
              }
            ]);
          }
        }
      } catch (err) {
        console.error("Lỗi đồng bộ tiến trình HSA lên Supabase:", err);
      }
    },
    [profile?.id, quizId, quizTitle, studentId, studentName]
  );

  // --------------------------------------------------------------------------
  // 5. CHẤM ĐIỂM TRỰC TIẾP PHẦN VỪA THI (THANG 50 ĐIỂM) & QUAY VỀ MÀN HÌNH 1
  // --------------------------------------------------------------------------
  const handleSubmitCurrentPart = useCallback(async () => {
    const partObj = partsMap[activePartKey];
    if (!partObj || isReviewMode || isSubmittingPart) return;

    setIsSubmittingPart(true);
    setConfirmSubmitModal(false);

    const totalCount = partObj.questions.length;
    let correctCount = 0;
    const cleanPartAnswers: Record<string, string> = {};

    partObj.questions.forEach((q) => {
      const userAns = currentAnswers[q.id];
      if (userAns !== undefined && userAns !== null && String(userAns).trim() !== "") {
        cleanPartAnswers[q.id] = String(userAns).trim();
      }
      if (checkIsQuestionCorrect(q, userAns)) {
        correctCount++;
      }
    });

    // Chấm điểm trực tiếp theo thang 50 điểm, làm tròn 1 chữ số thập phân (50 câu -> 1 câu = 1 điểm)
    const rawScore = totalCount > 0 ? (correctCount / totalCount) * 50 : 0;
    const partScore = Number(rawScore.toFixed(1));
    const timeSpentSeconds = Math.max(1, Math.round((Date.now() - partStartTimeMs) / 1000));

    const newPartProgress: HsaPartProgress = {
      partKey: activePartKey,
      completed: true,
      score: partScore,
      correctCount,
      totalCount,
      answers: cleanPartAnswers,
      flaggedIds: Array.from(flaggedQuestionIds),
      timeSpentSeconds,
      completedAt: new Date().toISOString()
    };

    const nextPartsProgress: Partial<Record<HsaPartKey, HsaPartProgress>> = {
      ...partsProgress,
      [activePartKey]: newPartProgress
    };

    setPartsProgress(nextPartsProgress);

    // Lưu vào localStorage (`tct_hsa_progress_${profile.id}_${quizId}`)
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(progressStorageKey);
        const existing: HsaSavedProgress = raw
          ? JSON.parse(raw)
          : {
              quizId,
              studentId,
              selectedElective,
              parts: {},
              updatedAt: new Date().toISOString()
            };
        existing.selectedElective = selectedElective;
        existing.parts = nextPartsProgress;
        if (existing.activeDraftAnswers) {
          delete existing.activeDraftAnswers[activePartKey];
        }
        if (existing.activeDraftFlags) {
          delete existing.activeDraftFlags[activePartKey];
        }
        existing.updatedAt = new Date().toISOString();
        localStorage.setItem(progressStorageKey, JSON.stringify(existing));
      } catch {}
    }

    await syncProgressToSupabase(nextPartsProgress, selectedElective);

    setIsSubmittingPart(false);
    // Chuyển về Màn hình 1 (Bảng điều khiển Ca thi)
    setScreen("hub");
  }, [
    partsMap,
    activePartKey,
    isReviewMode,
    isSubmittingPart,
    currentAnswers,
    partStartTimeMs,
    flaggedQuestionIds,
    partsProgress,
    progressStorageKey,
    quizId,
    studentId,
    selectedElective,
    syncProgressToSupabase
  ]);

  // Đồng hồ đếm ngược ở Màn hình 2 (Tự động nộp phần hiện tại khi hết giờ)
  useEffect(() => {
    if (screen !== "room" || isReviewMode) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSubmitCurrentPart();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [screen, isReviewMode, handleSubmitCurrentPart]);

  // Xóa toàn bộ tiến trình để làm lại từ đầu
  const handleResetAllProgress = async () => {
    setConfirmResetModal(false);
    setPartsProgress({});
    setCurrentAnswers({});
    setFlaggedQuestionIds(new Set());
    setIsReviewMode(false);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(progressStorageKey);
      } catch {}
    }
    setScreen("hub");
  };

  // --------------------------------------------------------------------------
  // 6. TÍNH TOÁN DỮ LIỆU THỐNG KÊ CHO MÀN HÌNH 1, MÀN HÌNH 2 & MÀN HÌNH 3
  // --------------------------------------------------------------------------
  const activePart = useMemo(() => partsMap[activePartKey] || null, [partsMap, activePartKey]);

  const completedPartsList = useMemo(
    () =>
      HSA_PART_ORDER.map((k) => partsProgress[k]).filter(
        (p): p is HsaPartProgress => Boolean(p && p.completed)
      ),
    [partsProgress]
  );

  const hasCompletedAtLeastOnePart = completedPartsList.length > 0;

  // Tổng hợp điểm trên Phiếu Báo Điểm HSA (Màn hình 3)
  const reportSummary = useMemo(() => {
    const activeElectiveKey: "english" | "history_geo" = partsProgress.history_geo?.completed
      ? "history_geo"
      : partsProgress.english?.completed
        ? "english"
        : selectedElective;

    const evaluatedKeys: HsaPartKey[] = ["quant", "qual", activeElectiveKey];
    let totalAchievedScore = 0;
    let totalMaxScore = 0;
    let totalCorrectQuestions = 0;
    let totalAttemptedQuestions = 0;

    evaluatedKeys.forEach((k) => {
      const prog = partsProgress[k];
      if (prog && prog.completed) {
        totalAchievedScore += Number(prog.score || 0);
        totalMaxScore += 50;
        totalCorrectQuestions += Number(prog.correctCount || 0);
        totalAttemptedQuestions += Number(prog.totalCount || 0);
      }
    });

    totalAchievedScore = Number(totalAchievedScore.toFixed(1));
    const accuracyPercent =
      totalAttemptedQuestions > 0
        ? Number(((totalCorrectQuestions / totalAttemptedQuestions) * 100).toFixed(1))
        : 0;

    let rankLabel = "Đạt yêu cầu";
    if (accuracyPercent >= 85) rankLabel = "Xuất sắc (Top 5% HSA)";
    else if (accuracyPercent >= 75) rankLabel = "Giỏi (Top 15% HSA)";
    else if (accuracyPercent >= 60) rankLabel = "Khá";
    else if (accuracyPercent >= 50) rankLabel = "Trung bình";
    else rankLabel = "Cần cố gắng thêm";

    return {
      totalAchievedScore,
      totalMaxScore: totalMaxScore || 50,
      totalCorrectQuestions,
      totalAttemptedQuestions,
      accuracyPercent,
      rankLabel,
      activeElectiveKey
    };
  }, [partsProgress, selectedElective]);

  // Gom nhóm câu hỏi ở Màn hình 2: Các câu hỏi liên tiếp có cùng group_id được gom chung vào 1 khối thẻ
  const groupedBlocksForActivePart = useMemo(() => {
    if (!activePart) return [];

    const filteredQuestions = activePart.questions.filter((q) => {
      if (!isReviewMode || reviewFilter === "all") return true;
      const userAns = currentAnswers[q.id];
      const answered = isQuestionAnswered(q, userAns);
      if (reviewFilter === "unanswered") return !answered;
      if (reviewFilter === "wrong") {
        return answered && !checkIsQuestionCorrect(q, userAns);
      }
      return true;
    });

    const blocks: {
      blockKey: string;
      isGroup: boolean;
      groupId?: string;
      groupPassage?: string;
      groupImages: string[];
      questions: NormalizedHsaQuestion[];
    }[] = [];

    filteredQuestions.forEach((q) => {
      if (q.groupId) {
        const lastBlock = blocks[blocks.length - 1];
        if (lastBlock && lastBlock.isGroup && lastBlock.groupId === q.groupId) {
          lastBlock.questions.push(q);
          if (!lastBlock.groupPassage && q.groupPassage) {
            lastBlock.groupPassage = q.groupPassage;
          }
          q.groupImages.forEach((img) => {
            if (!lastBlock.groupImages.includes(img)) {
              lastBlock.groupImages.push(img);
            }
          });
          return;
        }
        blocks.push({
          blockKey: `group-${q.groupId}-${q.localIndex}`,
          isGroup: true,
          groupId: q.groupId,
          groupPassage: q.groupPassage,
          groupImages: [...q.groupImages],
          questions: [q]
        });
      } else {
        blocks.push({
          blockKey: `single-${q.id}`,
          isGroup: false,
          groupImages: [],
          questions: [q]
        });
      }
    });

    return blocks;
  }, [activePart, isReviewMode, reviewFilter, currentAnswers]);

  const answeredCountInActivePart = useMemo(() => {
    if (!activePart) return 0;
    return activePart.questions.filter((q) => isQuestionAnswered(q, currentAnswers[q.id])).length;
  }, [activePart, currentAnswers]);

  const formattedCountdown = useMemo(() => {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    return `${String(mins).padStart(2, "0")} : ${String(secs).padStart(2, "0")}`;
  }, [remainingSeconds]);

  const scrollToQuestion = (questionId: string) => {
    const el = questionRefs.current[questionId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // ==========================================================================
  // MÀN HÌNH LOADING KHI ĐANG FETCH DỮ LIỆU ĐỀ THI TỪ SUPABASE
  // ==========================================================================
  if (isFetchingExam) {
    return (
      <div className="fixed inset-0 z-[200] bg-[#F8FAFC] flex flex-col items-center justify-center p-6 font-sans antialiased">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md w-full text-center space-y-3 shadow-xs">
          <Loader2 className="w-8 h-8 text-blue-700 animate-spin mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
            Đang tải dữ liệu ca thi ĐGNL HSA...
          </h3>
          <p className="text-xs text-slate-500">
            Hệ thống đang đồng bộ câu hỏi và tiến trình làm bài từ máy chủ khảo thí.
          </p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // MÀN HÌNH 1 — BẢNG ĐIỀU KHIỂN CA THI & LƯU TIẾN TRÌNH THEO PHẦN (HSA EXAM HUB)
  // ==========================================================================
  if (screen === "hub") {
    return (
      <div className="fixed inset-0 z-[200] bg-[#F8FAFC] flex flex-col overflow-hidden font-sans antialiased text-slate-800">
        {/* HEADER CHUẨN KHẢO THÍ */}
        <header className="h-16 px-4 sm:px-8 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onBackToDashboard}
            className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span>Thoát phòng thi</span>
          </button>

          <div className="text-center hidden md:block px-4 min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              KỲ THI ĐÁNH GIÁ NĂNG LỰC HỌC SINH TRUNG HỌC PHỔ THÔNG (HSA)
            </div>
            <h1 className="text-sm font-bold text-slate-900 truncate max-w-xl mx-auto">
              {quizTitle || loadedExam?.title || "Đề luyện thi ĐGNL HSA"}
            </h1>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 font-medium">Thí sinh: </span>
              <strong className="text-slate-900 font-bold">{studentName}</strong>
            </div>
            <span className="text-slate-300">|</span>
            <div>
              <span className="text-slate-500 font-medium">SBD: </span>
              <strong className="font-mono font-bold text-blue-700">{studentSbd}</strong>
            </div>
          </div>
        </header>

        {/* NỘI DUNG BẢNG ĐIỀU KHIỂN CA THI */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Tiêu đề đề thi & thông tin tổng quan */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 uppercase">
                  <Layers className="w-3.5 h-3.5 text-slate-600" />
                  <span>Bảng điều khiển Ca thi HSA</span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {quizTitle || loadedExam?.title || "Đề thi Đánh giá năng lực HSA"}
                </h2>
                <p className="text-xs text-slate-500">
                  Cấu trúc bài thi gồm 2 phần bắt buộc và 1 phần tự chọn. Điểm từng phần chấm theo thang 50 điểm (tổng 150 điểm).
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0 bg-[#F8FAFC] px-4 py-3 rounded-lg border border-slate-200">
                <div className="text-right">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase">
                    Tiến độ hoàn thành
                  </div>
                  <div className="text-base font-bold text-slate-900">
                    {completedPartsList.length} / {activeRequiredAndSelectedPartKeys.length || 3} phần thi
                  </div>
                </div>
              </div>
            </div>

            {/* CHỌN TỔ HỢP PHẦN 3 (TỰ CHỌN): LUÔN HIỂN THỊ 2 THẺ TỔ HỢP TRỰC QUAN */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Phần 3 (Tự chọn) — Chọn 1 trong 2 Tổ hợp bài thi
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Thí sinh tích chọn 1 trong 2 tổ hợp tự chọn bên dưới trước khi bắt đầu làm bài. Sau khi đã làm 1 tổ hợp, tổ hợp còn lại sẽ bị khóa.
                  </p>
                </div>
                {lockedElectiveKey && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold shrink-0">
                    <Lock className="w-3.5 h-3.5" />
                    Đã khóa đổi tổ hợp sau khi bắt đầu thi
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    {
                      key: "english" as const,
                      title: "Tổ hợp 1: Tiếng Anh",
                      meta: "50 câu — 60 phút — 50 điểm",
                      hasData: hasEnglishQuestions,
                      questionCount: partsMap.english?.questions.length || 50,
                      duration: partsMap.english?.durationMinutes || 60
                    },
                    {
                      key: "history_geo" as const,
                      title: "Tổ hợp 2: Khoa học (Lịch sử - Địa lý)",
                      meta: "50 câu — 60 phút — 50 điểm",
                      hasData: hasHistoryGeoQuestions,
                      questionCount: partsMap.history_geo?.questions.length || 50,
                      duration: partsMap.history_geo?.durationMinutes || 60
                    }
                  ] as const
                ).map((item) => {
                  const isSelected = selectedElective === item.key && item.hasData;
                  const isLockedByProgress =
                    lockedElectiveKey !== null && lockedElectiveKey !== item.key;
                  const isDisabled = !item.hasData || isLockedByProgress;
                  const itemProg = partsProgress[item.key];

                  return (
                    <button
                      key={item.key}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSelectElective(item.key)}
                      className={`p-4 rounded-xl border text-left flex items-start justify-between gap-3 transition ${
                        !item.hasData
                          ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                          : isSelected
                            ? "bg-blue-50/70 border-blue-700 text-slate-900"
                            : isLockedByProgress
                              ? "bg-slate-50 border-slate-200 text-slate-400 opacity-65 cursor-not-allowed"
                              : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 cursor-pointer"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? "border-blue-700 bg-white"
                              : "border-slate-400 bg-white"
                          }`}
                        >
                          {isSelected && <span className="w-2 h-2 rounded-full bg-blue-700" />}
                        </span>
                        <div className="space-y-1">
                          <div className="text-xs sm:text-sm font-bold">{item.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {item.hasData
                              ? `${item.questionCount} câu — ${item.duration} phút — 50 điểm`
                              : item.meta}
                          </div>
                          {itemProg?.completed && (
                            <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Đã hoàn thành: {itemProg.score}/50 điểm</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {!item.hasData ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-200/80 text-slate-600 text-[10px] font-bold">
                            Chưa mở trong đề này
                          </span>
                        ) : isLockedByProgress ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-bold">
                            <Lock className="w-3 h-3" />
                            <span>Đã khóa</span>
                          </span>
                        ) : isSelected ? (
                          <span className="inline-block px-2.5 py-0.5 rounded bg-blue-700 text-white text-[10px] font-bold uppercase">
                            Đang chọn
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600 text-[10px] font-semibold">
                            Chọn tổ hợp
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CẤU TRÚC 3 PHẦN THI CỦA THÍ SINH */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 px-1">
                Cấu trúc 3 phần thi của thí sinh
              </h3>

              <div className="space-y-3">
                {(
                  [
                    {
                      slotNumber: 1,
                      badge: "Phần 1 (Bắt buộc)",
                      partKey: "quant" as HsaPartKey,
                      displayTitle: "Toán học & Xử lý số liệu",
                      defaultDuration: 75
                    },
                    {
                      slotNumber: 2,
                      badge: "Phần 2 (Bắt buộc)",
                      partKey: "qual" as HsaPartKey,
                      displayTitle: "Ngôn ngữ - Văn học",
                      defaultDuration: 60
                    },
                    {
                      slotNumber: 3,
                      badge: "Phần 3 (Tự chọn)",
                      partKey: selectedElective as HsaPartKey,
                      displayTitle:
                        selectedElective === "english"
                          ? "Tổ hợp 1: Tiếng Anh"
                          : "Tổ hợp 2: Khoa học (Lịch sử - Địa lý)",
                      defaultDuration: 60
                    }
                  ] as const
                ).map((slot) => {
                  const partObj = partsMap[slot.partKey];
                  const hasData = Boolean(partObj && partObj.questions.length > 0);
                  const prog = partsProgress[slot.partKey];
                  const isCompleted = Boolean(prog?.completed);
                  const questionCount = partObj?.questions.length || 50;
                  const durationMinutes = partObj?.durationMinutes || slot.defaultDuration;

                  return (
                    <div
                      key={`${slot.slotNumber}-${slot.partKey}`}
                      className={`bg-white border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        hasData ? "border-slate-200" : "border-slate-200 bg-slate-50/60"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold uppercase">
                            {slot.badge}
                          </span>
                          <h4 className="text-sm sm:text-base font-bold text-slate-900">
                            {slot.displayTitle}
                          </h4>
                          {!hasData ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-200/70 text-slate-600 text-xs font-semibold">
                              Chưa mở trong đề này
                            </span>
                          ) : isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              Đã hoàn thành: {prog!.score} / 50 điểm
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold">
                              Chưa làm
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-500 flex-wrap">
                          <span>
                            Số lượng:{" "}
                            <strong className="text-slate-700">
                              {hasData ? `${questionCount} câu hỏi` : "50 câu hỏi"}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Thời gian:{" "}
                            <strong className="text-slate-700">{durationMinutes} phút</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Thang điểm: <strong className="text-slate-700">50 điểm</strong>
                          </span>
                          {isCompleted && (
                            <>
                              <span>•</span>
                              <span>
                                Số câu đúng:{" "}
                                <strong className="text-emerald-700">
                                  {prog!.correctCount}/{prog!.totalCount} câu
                                </strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!hasData ? (
                          <span className="px-4 py-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-400 text-xs font-bold cursor-not-allowed">
                            Chưa mở trong đề này
                          </span>
                        ) : isCompleted ? (
                          <button
                            type="button"
                            onClick={() => handleReviewPart(slot.partKey)}
                            className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Eye className="w-4 h-4 text-blue-700" />
                            <span>Xem lại đáp án phần này</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartPartExam(slot.partKey)}
                            className="px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Bắt đầu làm phần này</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CỤM NÚT HÀNH ĐỘNG DƯỚI CÙNG */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setConfirmResetModal(true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span>Làm lại toàn bộ đề từ đầu</span>
              </button>

              {hasCompletedAtLeastOnePart && (
                <button
                  type="button"
                  onClick={() => setScreen("report")}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <FileCheck2 className="w-4 h-4" />
                  <span>Kết thúc bài thi & Xuất Phiếu Điểm HSA</span>
                </button>
              )}
            </div>
          </div>
        </main>

        {/* MODAL XÁC NHẬN LÀM LẠI TOÀN BỘ TỪ ĐẦU */}
        {confirmResetModal && (
          <div className="fixed inset-0 z-[300] bg-slate-900/50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-lg">
              <h3 className="text-base font-bold text-slate-900">
                Làm lại toàn bộ đề thi từ đầu?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Toàn bộ tiến trình và điểm số các phần đã lưu hiện tại của đề thi này sẽ được đặt lại về trạng thái chưa làm để bạn bắt đầu ca thi mới.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmResetModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleResetAllProgress}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  Xác nhận làm lại từ đầu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================================================
  // MÀN HÌNH 3 — PHIẾU BÁO ĐIỂM HSA TINH GỌN (HSA SCORE REPORT)
  // ==========================================================================
  if (screen === "report") {
    const quantProg = partsProgress.quant;
    const qualProg = partsProgress.qual;
    const electiveKey = reportSummary.activeElectiveKey;
    const electiveProg = partsProgress[electiveKey];
    const electiveCfg = HSA_PARTS_CONFIG[electiveKey];

    return (
      <div className="fixed inset-0 z-[200] bg-[#F8FAFC] flex flex-col overflow-y-auto font-sans antialiased text-slate-800 p-4 sm:p-6 md:p-10">
        <div className="max-w-4xl w-full mx-auto my-auto bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          {/* DẢI TIÊU ĐỀ XANH LÁ ĐẬM TRÊN CÙNG */}
          <div className="bg-emerald-800 text-white px-6 py-5 border-b border-emerald-900 text-center space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-200">
              ĐẠI HỌC QUỐC GIA HÀ NỘI • HỆ THỐNG KHẢO THÍ TCT STUDY
            </div>
            <h1 className="text-base sm:text-xl font-bold uppercase tracking-wide">
              KẾT QUẢ BÀI THI ĐÁNH GIÁ NĂNG LỰC (HSA)
            </h1>
            <p className="text-xs sm:text-sm font-medium text-emerald-100">
              {quizTitle || loadedExam?.title || "Đề thi Đánh giá năng lực HSA"}
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* HÀNG 4 Ô KHỐI ĐIỂM CHUẨN HSA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Ô 1: Khối đỏ nổi bật bên trái - Tổng điểm */}
              <div className="bg-rose-700 text-white rounded-xl p-5 flex flex-col justify-between border border-rose-800">
                <div className="text-xs font-bold uppercase tracking-wider text-rose-100">
                  Tổng điểm
                </div>
                <div className="my-3">
                  <span className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                    {reportSummary.totalAchievedScore}
                  </span>
                  <span className="text-base font-bold text-rose-200 ml-1">
                    / {reportSummary.totalMaxScore}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-rose-100">
                  Tổng điểm {completedPartsList.length} phần đã hoàn thành
                </div>
              </div>

              {/* Ô 2: Khối xanh lá - Toán học & Xử lý số liệu */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-5 flex flex-col justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                  Toán học & Xử lý số liệu
                </div>
                <div className="my-3">
                  {quantProg?.completed ? (
                    <div>
                      <span className="text-2xl sm:text-3xl font-extrabold text-emerald-800">
                        {quantProg.score}
                      </span>
                      <span className="text-sm font-bold text-emerald-600 ml-1">/ 50</span>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-slate-400 uppercase">Chưa thi</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-600 font-medium">
                  {quantProg?.completed
                    ? `Đúng ${quantProg.correctCount}/${quantProg.totalCount} câu`
                    : "Phần 1 • Tư duy Định lượng"}
                </div>
              </div>

              {/* Ô 3: Khối xanh lá - Ngôn ngữ - Văn học */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-5 flex flex-col justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                  Ngôn ngữ - Văn học
                </div>
                <div className="my-3">
                  {qualProg?.completed ? (
                    <div>
                      <span className="text-2xl sm:text-3xl font-extrabold text-emerald-800">
                        {qualProg.score}
                      </span>
                      <span className="text-sm font-bold text-emerald-600 ml-1">/ 50</span>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-slate-400 uppercase">Chưa thi</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-600 font-medium">
                  {qualProg?.completed
                    ? `Đúng ${qualProg.correctCount}/${qualProg.totalCount} câu`
                    : "Phần 2 • Tư duy Định tính"}
                </div>
              </div>

              {/* Ô 4: Khối xám/xanh - Tên phần tự chọn đã thi */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  {electiveCfg.shortTitle}
                </div>
                <div className="my-3">
                  {electiveProg?.completed ? (
                    <div>
                      <span className="text-2xl sm:text-3xl font-extrabold text-blue-800">
                        {electiveProg.score}
                      </span>
                      <span className="text-sm font-bold text-slate-500 ml-1">/ 50</span>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-slate-400 uppercase">Chưa thi</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-600 font-medium">
                  {electiveProg?.completed
                    ? `Đúng ${electiveProg.correctCount}/${electiveProg.totalCount} câu`
                    : "Phần 3 • Tổ hợp tự chọn"}
                </div>
              </div>
            </div>

            {/* DÒNG THỐNG KÊ TỶ LỆ TRẢ LỜI ĐÚNG (%) & XẾP LOẠI */}
            <div className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="text-slate-600">Tỷ lệ trả lời chính xác:</span>
                <strong className="text-slate-900 font-bold">
                  {reportSummary.accuracyPercent}% ({reportSummary.totalCorrectQuestions}/
                  {reportSummary.totalAttemptedQuestions} câu)
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-600">Xếp loại năng lực:</span>
                <span className="px-2.5 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs">
                  {reportSummary.rankLabel}
                </span>
              </div>
            </div>

            {/* CỤM NÚT CHỨC NĂNG ĐẦY ĐỦ */}
            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const targetKey =
                      completedPartsList[0]?.partKey ||
                      activeRequiredAndSelectedPartKeys[0] ||
                      availablePartKeys[0] ||
                      "quant";
                    const savedAnswers = partsProgress[targetKey]?.answers || {};
                    setActivePartKey(targetKey);
                    setCurrentAnswers(savedAnswers);
                    setIsReviewMode(true);
                    setReviewFilter("all");
                    setScreen("room");
                  }}
                  className="px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Xem lại đáp án & Lời giải chi tiết</span>
                </button>

                <button
                  type="button"
                  onClick={() => setScreen("hub")}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                >
                  <Layers className="w-4 h-4 text-slate-600" />
                  <span>Bảng điều khiển ca thi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmResetModal(true)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-slate-600" />
                  <span>Làm lại bài thi</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onBackToDashboard}
                className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Về danh sách đề</span>
              </button>
            </div>
          </div>
        </div>

        {/* MODAL XÁC NHẬN LÀM LẠI BÀI THI */}
        {confirmResetModal && (
          <div className="fixed inset-0 z-[300] bg-slate-900/50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-lg">
              <h3 className="text-base font-bold text-slate-900">Làm lại toàn bộ bài thi?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hệ thống sẽ xóa kết quả tạm thời hiện tại để bạn bắt đầu làm lại các phần thi từ đầu.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmResetModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleResetAllProgress}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  Đồng ý làm lại
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================================================
  // MÀN HÌNH 2 — PHÒNG THI CHUẨN ĐHQGHN (CỘT TRÁI RỘNG THOÁNG + CỘT PHẢI 225PX)
  // ==========================================================================
  return (
    <div className="fixed inset-0 z-[200] bg-[#F8FAFC] flex flex-col overflow-hidden font-sans antialiased text-slate-900">
      {/* HEADER TỐI GIẢN CHUẨN PHẦN MỀM THI MÁY TÍNH ĐHQGHN */}
      <header className="h-13 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScreen(isReviewMode && initialReviewMode ? "report" : "hub")}
            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
            <span>Về bảng điều khiển ca thi</span>
          </button>

          {isReviewMode && (
            <button
              type="button"
              onClick={() => setScreen("report")}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition cursor-pointer"
            >
              Xem Phiếu Điểm HSA
            </button>
          )}
        </div>

        {/* TÊN PHẦN THI IN HOA CĂN GIỮA */}
        <div className="text-center px-2">
          <h1 className="text-xs sm:text-sm md:text-base font-extrabold text-slate-900 uppercase tracking-wider">
            {activePart?.upperTitle || HSA_PARTS_CONFIG[activePartKey].upperTitle}
          </h1>
        </div>

        {/* Chuyển nhanh giữa các phần khi ở chế độ Xem lại đáp án, hoặc hiển thị SBD */}
        <div className="flex items-center gap-2">
          {isReviewMode && availablePartKeys.length > 1 ? (
            <div className="hidden lg:flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              {availablePartKeys.map((pKey) => {
                const isCurr = activePartKey === pKey;
                const pSaved = partsProgress[pKey];
                return (
                  <button
                    key={pKey}
                    type="button"
                    onClick={() => {
                      setActivePartKey(pKey);
                      setCurrentAnswers(pSaved?.answers || {});
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                      isCurr
                        ? "bg-white text-blue-700 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {HSA_PARTS_CONFIG[pKey].shortTitle}
                    {pSaved?.completed ? ` (${pSaved.score}đ)` : ""}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
              <span>{studentName}</span>
              <span className="text-slate-300">•</span>
              <strong className="font-mono text-blue-700">{studentSbd}</strong>
            </div>
          )}
        </div>
      </header>

      {/* BODY 2 CỘT: CỘT TRÁI RỘNG THOÁNG (flex-1 min-w-0) + CỘT PHẢI NHỎ GỌN 225PX */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* CỘT TRÁI (flex-1 min-w-0 - VÙNG ĐỀ BÀI & CÂU HỎI RỘNG RÃI ~84% MÀN HÌNH) */}
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-4">
          {/* Thanh bộ lọc nhanh khi ở chế độ Xem lại đáp án (isReviewMode) */}
          {isReviewMode && (
            <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-700 uppercase">
                  Chế độ Xem lại đáp án:
                </span>
                {(
                  [
                    { key: "all", label: "Tất cả" },
                    { key: "wrong", label: "Câu sai" },
                    { key: "unanswered", label: "Câu bỏ trống" }
                  ] as const
                ).map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setReviewFilter(f.key)}
                    className={`px-3 py-1 rounded text-xs font-bold border transition cursor-pointer ${
                      reviewFilter === f.key
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {partsProgress[activePartKey]?.completed && (
                <div className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded">
                  Điểm phần này: {partsProgress[activePartKey]!.score} / 50 điểm (Đúng{" "}
                  {partsProgress[activePartKey]!.correctCount}/
                  {partsProgress[activePartKey]!.totalCount} câu)
                </div>
              )}
            </div>
          )}

          {/* Danh sách các khối câu hỏi (Hỗ trợ cả Câu hỏi chùm và Câu hỏi đơn lẻ) */}
          {groupedBlocksForActivePart.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg p-10 text-center text-xs font-semibold text-slate-500">
              Không có câu hỏi nào khớp với bộ lọc hiện tại.
            </div>
          ) : (
            groupedBlocksForActivePart.map((block) => {
              const firstQ = block.questions[0];
              const lastQ = block.questions[block.questions.length - 1];
              const hasGroupHeader =
                block.isGroup && (Boolean(block.groupPassage) || block.groupImages.length > 0);
              const hasGroupImages = block.groupImages.length > 0;

              return (
                <div
                  key={block.blockKey}
                  className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                >
                  {/* KHUNG DỮ KIỆN / NGỮ LIỆU CHUNG ĐẶT Ở ĐẦU KHỐI (NẾU LÀ CÂU HỎI CHÙM) */}
                  {hasGroupHeader && (
                    <div className="bg-slate-50/90 border-b border-slate-200 p-4 sm:p-5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded bg-emerald-800 text-white text-xs font-bold">
                          Dữ kiện câu hỏi chùm (Câu {firstQ.localIndex}
                          {lastQ.localIndex > firstQ.localIndex ? ` – Câu ${lastQ.localIndex}` : ""})
                        </span>
                      </div>

                      {hasGroupImages ? (
                        <div className="flex flex-col md:flex-row gap-4 items-start">
                          <div className="w-full md:w-[68%] max-h-80 overflow-y-auto pr-1">
                            <MathAndImageRenderer
                              content={block.groupPassage}
                              mediaMap={activePart?.mediaMap}
                              onOpenLightbox={(src) => setLightboxImageSrc(src)}
                            />
                          </div>
                          <div className="w-full md:w-[32%] flex flex-col items-center justify-center gap-2 bg-white p-2.5 rounded border border-slate-200">
                            {block.groupImages.map((imgSrc, iIdx) => (
                              <div key={iIdx} className="relative group text-center">
                                <img
                                  src={imgSrc}
                                  alt="Hình dữ kiện chung"
                                  onClick={() => setLightboxImageSrc(imgSrc)}
                                  className="max-h-[175px] w-auto mx-auto object-contain rounded cursor-zoom-in"
                                />
                                <button
                                  type="button"
                                  onClick={() => setLightboxImageSrc(imgSrc)}
                                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
                                >
                                  <ZoomIn className="w-3 h-3" /> Phóng to ảnh
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="max-h-80 overflow-y-auto pr-1">
                          <MathAndImageRenderer
                            content={block.groupPassage}
                            mediaMap={activePart?.mediaMap}
                            onOpenLightbox={(src) => setLightboxImageSrc(src)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* DANH SÁCH CÂU HỎI TRONG KHỐI */}
                  <div className="divide-y divide-slate-200">
                    {block.questions.map((q) => {
                      const userAns = currentAnswers[q.id] || "";
                      const isFlagged = flaggedQuestionIds.has(q.id);
                      const hasQuestionImage = q.images.length > 0;
                      const isAnswered = isQuestionAnswered(q, userAns);
                      const isCorrect = checkIsQuestionCorrect(q, userAns);

                      return (
                        <div
                          key={q.id}
                          ref={(el) => {
                            questionRefs.current[q.id] = el;
                          }}
                          className="p-4 sm:p-5 space-y-3"
                        >
                          {/* NỘI DUNG CÂU HỎI + ĐÁP ÁN: Chia 2 cột (8/4) nếu có hình riêng, 1 cột nếu không có hình */}
                          <div
                            className={
                              hasQuestionImage
                                ? "grid grid-cols-1 md:grid-cols-12 gap-4 items-start"
                                : "space-y-3"
                            }
                          >
                            <div
                              className={
                                hasQuestionImage ? "md:col-span-8 space-y-3" : "space-y-3"
                              }
                            >
                              {/* DÒNG MỞ ĐẦU: Nhãn Câu X nền xanh đậm chữ trắng nằm ngang hàng trực tiếp với nội dung câu hỏi + nút Gắn cờ góc phải */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0 font-sans antialiased text-[15px] leading-[1.7] text-slate-900">
                                  <span className="inline-block bg-emerald-800 text-white text-xs font-bold px-2 py-0.5 rounded mr-2.5 align-baseline select-none">
                                    Câu {q.localIndex}
                                  </span>

                                  {isReviewMode && (
                                    <span
                                      className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold border mr-2 align-baseline ${
                                        !isAnswered
                                          ? "bg-slate-100 text-slate-600 border-slate-300"
                                          : isCorrect
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                            : "bg-rose-50 text-rose-700 border-rose-300"
                                      }`}
                                    >
                                      {!isAnswered
                                        ? "Bỏ trống"
                                        : isCorrect
                                          ? "Đúng"
                                          : "Sai"}
                                    </span>
                                  )}

                                  <MathAndImageRenderer
                                    content={q.promptHtml}
                                    mediaMap={activePart?.mediaMap}
                                    inline={true}
                                    onOpenLightbox={(src) => setLightboxImageSrc(src)}
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleToggleFlag(q.id)}
                                  className={`shrink-0 px-2 py-1 rounded border text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                                    isFlagged
                                      ? "bg-amber-50 border-amber-300 text-amber-800"
                                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  }`}
                                  title="Đánh dấu câu phân vân"
                                >
                                  <Flag
                                    className={`w-3 h-3 ${
                                      isFlagged
                                        ? "fill-amber-400 text-amber-600"
                                        : "text-slate-400"
                                    }`}
                                  />
                                  <span className="hidden sm:inline">
                                    {isFlagged ? "Đã cờ" : "Gắn cờ"}
                                  </span>
                                </button>
                              </div>

                              {/* 1. TRẮC NGHIỆM 4 PHƯƠNG ÁN A, B, C, D XẾP 1 CỘT DỌC DUY NHẤT CHUẨN PHÒNG THI ĐHQGHN */}
                              {q.type === "multiple_choice" && (
                                <div className="flex flex-col space-y-2 pt-1 pl-1 sm:pl-2">
                                  {q.options.map((opt) => {
                                    const isSelected =
                                      userAns.toUpperCase() === opt.key.toUpperCase();
                                    const isOptCorrect =
                                      q.correctAnswer.toUpperCase() === opt.key.toUpperCase();

                                    let rowStyle = "hover:bg-slate-50/80 text-slate-900";
                                    let labelKeyStyle = "text-slate-700 font-semibold";
                                    let optionTextStyle = "text-slate-900";

                                    if (isReviewMode) {
                                      if (isOptCorrect) {
                                        rowStyle = "bg-emerald-50/80 rounded-md";
                                        labelKeyStyle = "text-emerald-800 font-bold";
                                        optionTextStyle = "text-emerald-950 font-medium";
                                      } else if (isSelected && !isOptCorrect) {
                                        rowStyle = "bg-rose-50/80 rounded-md";
                                        labelKeyStyle = "text-rose-700 font-bold";
                                        optionTextStyle = "text-rose-950 font-medium";
                                      }
                                    } else if (isSelected) {
                                      rowStyle = "bg-blue-50/50 rounded-md";
                                      labelKeyStyle = "text-blue-800 font-bold";
                                      optionTextStyle = "text-slate-950 font-medium";
                                    }

                                    return (
                                      <button
                                        key={opt.key}
                                        type="button"
                                        disabled={isReviewMode}
                                        onClick={() => handleSelectAnswer(q.id, opt.key)}
                                        className={`w-full py-1.5 px-2.5 text-left flex items-start gap-2.5 transition ${rowStyle} ${
                                          isReviewMode ? "cursor-default" : "cursor-pointer"
                                        }`}
                                      >
                                        {/* Ký hiệu (A), (B), (C), (D) */}
                                        <span
                                          className={`text-[14px] leading-[1.7] w-7 shrink-0 select-none ${labelKeyStyle}`}
                                        >
                                          ({opt.key})
                                        </span>

                                        {/* Nút tròn Radio ○ ở giữa */}
                                        <span className="mt-[5px] shrink-0 flex items-center justify-center">
                                          {isReviewMode ? (
                                            isOptCorrect ? (
                                              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                                                <Check className="w-3 h-3 stroke-[3]" />
                                              </span>
                                            ) : isSelected && !isOptCorrect ? (
                                              <span className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center">
                                                <X className="w-3 h-3 stroke-[3]" />
                                              </span>
                                            ) : (
                                              <span className="w-4 h-4 rounded-full border border-slate-400 bg-white block" />
                                            )
                                          ) : (
                                            <span
                                              className={`w-4 h-4 rounded-full border flex items-center justify-center transition ${
                                                isSelected
                                                  ? "border-2 border-blue-700 bg-white"
                                                  : "border-slate-400 bg-white"
                                              }`}
                                            >
                                              {isSelected && (
                                                <span className="w-2 h-2 rounded-full bg-blue-700 block" />
                                              )}
                                            </span>
                                          )}
                                        </span>

                                        {/* Nội dung phương án */}
                                        <div className={`flex-1 min-w-0 ${optionTextStyle}`}>
                                          <MathAndImageRenderer
                                            content={opt.textHtml}
                                            mediaMap={activePart?.mediaMap}
                                            inline={true}
                                            onOpenLightbox={(src) => setLightboxImageSrc(src)}
                                          />
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* 2. CÂU HỎI ĐIỀN KHUYẾT / TRẢ LỜI NGẮN */}
                              {q.type === "short_answer" && (
                                <div className="pt-1 pl-1 sm:pl-2 space-y-2">
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                                    <label className="text-[14px] font-semibold text-slate-800 shrink-0">
                                      Đáp án của thí sinh:
                                    </label>
                                    <input
                                      type="text"
                                      disabled={isReviewMode}
                                      value={userAns}
                                      onChange={(e) => handleSelectAnswer(q.id, e.target.value)}
                                      placeholder="Nhập kết quả (VD: 12.5 hoặc -3)..."
                                      className={`w-full max-w-xs px-3 py-1.5 rounded border text-[15px] font-semibold outline-none transition ${
                                        isReviewMode
                                          ? isCorrect
                                            ? "bg-emerald-50 border-emerald-500 text-emerald-900"
                                            : "bg-rose-50 border-rose-400 text-rose-900"
                                          : "bg-white border-slate-300 text-slate-900 focus:border-blue-700"
                                      }`}
                                    />
                                  </div>
                                  {isReviewMode && (
                                    <div className="text-xs font-bold text-emerald-700">
                                      Đáp án đúng:{" "}
                                      <span className="font-mono">{q.correctAnswer}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 3. CÂU HỎI ĐÚNG / SAI (NẾU CÓ TRONG ĐỀ) */}
                              {q.type === "true_false" && (
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                      <tr>
                                        <th className="py-2 px-3 font-bold">Mệnh đề</th>
                                        <th className="py-2 px-3 text-center font-bold w-16">
                                          Đúng
                                        </th>
                                        <th className="py-2 px-3 text-center font-bold w-16">
                                          Sai
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {q.options.map((opt, oIdx) => {
                                        const curChar = String(userAns || "----")[oIdx] || "-";
                                        return (
                                          <tr key={opt.key}>
                                            <td className="py-2 px-3">
                                              <span className="font-bold mr-1.5">{opt.key})</span>
                                              <MathAndImageRenderer
                                                content={opt.textHtml}
                                                mediaMap={activePart?.mediaMap}
                                                inline={true}
                                              />
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              <button
                                                type="button"
                                                disabled={isReviewMode}
                                                onClick={() =>
                                                  handleToggleTrueFalseSubOption(q.id, oIdx, "Đ")
                                                }
                                                className={`w-5 h-5 rounded-full border mx-auto flex items-center justify-center font-bold ${
                                                  curChar === "Đ"
                                                    ? "bg-blue-700 border-blue-700 text-white"
                                                    : "bg-white border-slate-400 text-transparent"
                                                }`}
                                              >
                                                <Check className="w-3 h-3" />
                                              </button>
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                              <button
                                                type="button"
                                                disabled={isReviewMode}
                                                onClick={() =>
                                                  handleToggleTrueFalseSubOption(q.id, oIdx, "S")
                                                }
                                                className={`w-5 h-5 rounded-full border mx-auto flex items-center justify-center font-bold ${
                                                  curChar === "S"
                                                    ? "bg-blue-700 border-blue-700 text-white"
                                                    : "bg-white border-slate-400 text-transparent"
                                                }`}
                                              >
                                                <X className="w-3 h-3" />
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* CỘT HÌNH ẢNH BÊN PHẢI (4 CỘT) KHI CÂU HỎI CÓ HÌNH */}
                            {hasQuestionImage && (
                              <div className="md:col-span-4 flex flex-col items-center justify-center gap-2 bg-[#F8FAFC] p-3 rounded-lg border border-slate-200">
                                {q.images.map((imgSrc, imgIdx) => (
                                  <div key={imgIdx} className="text-center">
                                    <img
                                      src={imgSrc}
                                      alt={`Hình câu ${q.localIndex}`}
                                      onClick={() => setLightboxImageSrc(imgSrc)}
                                      className="max-h-[175px] w-auto mx-auto object-contain rounded bg-white p-1 border border-slate-200 cursor-zoom-in"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setLightboxImageSrc(imgSrc)}
                                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
                                    >
                                      <ZoomIn className="w-3 h-3" /> Bấm để phóng to
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* LỜI GIẢI CHI TIẾT DƯỚI MỖI CÂU KHI Ở CHẾ ĐỘ XEM LẠI ĐÁP ÁN */}
                          {isReviewMode && (
                            <div className="mt-2.5 p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                                <span className="flex items-center gap-1.5 text-blue-800">
                                  <BookOpen className="w-3.5 h-3.5" />
                                  <span>Lời giải chi tiết</span>
                                </span>
                                <span>
                                  Đáp án đúng:{" "}
                                  <strong className="text-emerald-700">{q.correctAnswer}</strong>
                                  {isAnswered && (
                                    <span className="ml-2 text-slate-500">
                                      (Bạn chọn: <strong>{userAns}</strong>)
                                    </span>
                                  )}
                                </span>
                              </div>
                              {q.solutionHtml ? (
                                <div className="pt-1.5 border-t border-slate-200/80">
                                  <MathAndImageRenderer
                                    content={q.solutionHtml}
                                    mediaMap={activePart?.mediaMap}
                                    onOpenLightbox={(src) => setLightboxImageSrc(src)}
                                  />
                                </div>
                              ) : (
                                <p className="text-xs text-slate-500 italic">
                                  Đáp án chuẩn của hệ thống khảo thí là {q.correctAnswer}.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* CỘT PHẢI THU GỌN 225PX (w-full lg:w-[225px] shrink-0) */}
        <aside className="w-full lg:w-[225px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col max-h-[38vh] lg:max-h-none">
          {/* ĐỒNG HỒ ĐẾM NGƯỢC GỌN GÀNG & NÚT NỘP PHẦN THI */}
          <div className="p-3 border-b border-slate-200 space-y-2.5">
            {!isReviewMode ? (
              <>
                <div className="bg-[#F8FAFC] border border-slate-200 rounded-lg py-2 px-2.5 text-center">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>Thời gian còn lại</span>
                  </div>
                  <div
                    className={`text-xl font-mono font-bold tracking-wider mt-0.5 ${
                      remainingSeconds <= 300 ? "text-rose-600" : "text-slate-900"
                    }`}
                  >
                    {formattedCountdown}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSubmittingPart}
                  onClick={() => setConfirmSubmitModal(true)}
                  className="w-full py-2 px-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingPart ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang chấm...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Nộp phần thi này</span>
                    </>
                  )}
                </button>

                <div className="text-center text-[11px] font-semibold text-slate-600">
                  Đã chọn{" "}
                  <strong className="text-blue-700">
                    {answeredCountInActivePart}/{activePart?.questions.length || 0}
                  </strong>{" "}
                  câu
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg py-2 px-2.5 text-center">
                  <div className="text-[10px] font-bold uppercase text-emerald-800">
                    Kết quả phần thi
                  </div>
                  <div className="text-lg font-extrabold text-emerald-900 mt-0.5">
                    {partsProgress[activePartKey]?.score ?? 0} / 50 điểm
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setScreen("report")}
                  className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
                >
                  Phiếu Báo Điểm HSA
                </button>
              </div>
            )}
          </div>

          {/* MA TRẬN DANH SÁCH CÂU HỎI CHIA 5 CỘT Ô VUÔNG NHỎ GỌN (grid-cols-5 gap-1.5, h-7 text-[11px]) */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700">
                DANH SÁCH CÂU HỎI
              </span>
              <span className="text-[10px] font-semibold text-slate-500">
                {activePart?.questions.length || 0} câu
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {(activePart?.questions || []).map((q) => {
                const userAns = currentAnswers[q.id];
                const answered = isQuestionAnswered(q, userAns);
                const flagged = flaggedQuestionIds.has(q.id);
                const correct = checkIsQuestionCorrect(q, userAns);

                let btnClass =
                  "bg-white border-slate-200 text-slate-700 hover:border-blue-500 hover:bg-slate-50";
                if (isReviewMode) {
                  if (!answered) {
                    btnClass = "bg-slate-100 border-slate-300 text-slate-500";
                  } else if (correct) {
                    btnClass = "bg-emerald-600 border-emerald-600 text-white font-bold";
                  } else {
                    btnClass = "bg-rose-600 border-rose-600 text-white font-bold";
                  }
                } else if (answered) {
                  btnClass = "bg-blue-700 border-blue-700 text-white font-bold";
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => scrollToQuestion(q.id)}
                    className={`relative h-7 rounded border text-[11px] font-semibold flex items-center justify-center transition cursor-pointer select-none ${btnClass}`}
                  >
                    <span>{q.localIndex}</span>
                    {flagged && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 border border-white"
                        title="Câu đang gắn cờ phân vân"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Chú thích màu sắc ma trận gọn gàng */}
            <div className="pt-2.5 border-t border-slate-100 space-y-1 text-[10px] text-slate-600">
              {!isReviewMode ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-blue-700 inline-block" />
                      <span>Đã chọn</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-xs bg-white border border-slate-300 inline-block" />
                      <span>Chưa làm</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    <span>Gắn cờ phân vân</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                    <span>Câu đúng</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-xs bg-rose-600 inline-block" />
                    <span>Câu sai</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* MODAL XÁC NHẬN NỘP PHẦN THI HIỆN TẠI */}
      {confirmSubmitModal && (
        <div className="fixed inset-0 z-[300] bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-lg">
            <h3 className="text-base font-bold text-slate-900">
              Xác nhận nộp phần thi {activePart?.shortTitle}?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn đã hoàn thành{" "}
              <strong className="text-slate-900">
                {answeredCountInActivePart}/{activePart?.questions.length || 0} câu hỏi
              </strong>{" "}
              trong phần thi này. Sau khi nộp, hệ thống sẽ chấm điểm trực tiếp theo thang 50 điểm và lưu kết quả của phần này vào ca thi.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmSubmitModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Kiểm tra lại bài
              </button>
              <button
                type="button"
                onClick={handleSubmitCurrentPart}
                className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold cursor-pointer"
              >
                Nộp phần thi này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX PHÓNG TO HÌNH ẢNH */}
      {lightboxImageSrc && (
        <div
          onClick={() => setLightboxImageSrc(null)}
          className="fixed inset-0 z-[400] bg-slate-950/80 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white p-3 rounded-xl border border-slate-200 max-w-4xl max-h-[90vh] flex flex-col items-center cursor-default"
          >
            <button
              type="button"
              onClick={() => setLightboxImageSrc(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700 cursor-pointer"
              title="Đóng ảnh phóng to"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={lightboxImageSrc}
              alt="Phóng to hình minh họa"
              className="max-h-[82vh] max-w-full object-contain rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default HsaExamWorkspace;
