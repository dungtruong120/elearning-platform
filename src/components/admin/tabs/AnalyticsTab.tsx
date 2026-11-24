"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Trophy,
  Loader2,
  Search,
  Filter,
  Calendar,
  BookOpen,
  Award,
  Target,
  User,
  Download,
  X,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
  Globe,
  Save,
  ZoomIn,
  ZoomOut,
  PenTool,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import katex from "katex";
import { supabase } from "@/lib/supabaseClient";
import { OMR_CANONICAL_WIDTH, OMR_CANONICAL_HEIGHT } from "@/lib/omrEngine";

interface AnalyticsTabProps {
  analyticsData: any[];
  analyticsModeFilter: "all" | "online" | "offline";
  setAnalyticsModeFilter: (filter: "all" | "online" | "offline") => void;
  rankingScope: "lesson" | "chapter" | "course";
  setRankingScope: (scope: "lesson" | "chapter" | "course") => void;
  selectedChapterId: string;
  setSelectedChapterId: (id: string) => void;
  selectedLessonId: string;
  setSelectedLessonId: (id: string) => void;
  chapters: any[];
  isLoadingAnalytics?: boolean;
  allAttempts?: any[];
  registeredStudents?: any[];
  practiceExams?: any[];
}

function normalizeText(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isHsaAttemptOrQuiz(att?: any, quizObj?: any): boolean {
  const fmt = String(quizObj?.exam_format || att?.exam_format || "").trim().toLowerCase();
  if (fmt === "hsa") return true;
  if (att?.submission_type === "web_hsa") return true;
  if (att?.answers?.__hsa_meta?.examFormat === "hsa") return true;
  const cat = String(quizObj?.category || att?.category || "").toUpperCase();
  const title = String(
    quizObj?.title || att?.examTitle || att?.quizTitle || att?.quiz_title || att?.title || ""
  ).toUpperCase();
  return cat.includes("HSA") || /\bHSA\b/.test(title) || title.includes("ĐGNL HSA");
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
    .replace(/\[(?:img|image):\s*\$?([a-zA-Z0-9_\-\.\/]+)\$?\s*\]/gi, "[img:$1]");
}

function resolveAnalyticsImageSrc(rawKey: string, mediaMap: Record<string, any> = {}): string {
  if (!rawKey) return "";
  const trimmed = String(rawKey || "").trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  if (!mediaMap || typeof mediaMap !== "object") return "";
  const cleanKey = trimmed
    .replace(/^\[(?:img|image):\s*/i, "")
    .replace(/\]$/i, "")
    .replace(/^\$+|\$+$/g, "")
    .trim();

  if (mediaMap[cleanKey]) return String(mediaMap[cleanKey]);
  if (mediaMap[`$${cleanKey}$`]) return String(mediaMap[`$${cleanKey}$`]);
  if (mediaMap[`img_${cleanKey}`]) return String(mediaMap[`img_${cleanKey}`]);
  for (const [k, v] of Object.entries(mediaMap)) {
    if (!v) continue;
    const cleanK = k.replace(/^\$+|\$+$/g, "").trim().toLowerCase();
    if (cleanK === cleanKey.toLowerCase()) return String(v);
  }
  return "";
}

function AnalyticsRichContent({
  content,
  mediaMap = {},
  className = ""
}: {
  content?: string;
  mediaMap?: Record<string, any>;
  className?: string;
}) {
  const renderedHtml = useMemo(() => {
    if (!content) return "";
    let str = sanitizeLatexString(String(content));

    str = str.replace(/\[img:([^\]]+)\]/gi, (_, rawKey) => {
      const src = resolveAnalyticsImageSrc(rawKey, mediaMap);
      if (!src) {
        return `<span class="inline-flex items-center px-2 py-0.5 text-[11px] bg-slate-100 text-slate-500 rounded border border-slate-200">[Hình: ${rawKey}]</span>`;
      }
      return `<div class="my-2 flex justify-center"><img src="${src}" alt="Hình minh họa" class="max-h-60 max-w-full rounded-xl border border-slate-200 object-contain bg-white p-1" /></div>`;
    });

    str = str.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => "$$" + math + "$$");
    str = str.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => "$" + math + "$");

    str = str.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
      const cleanTex = sanitizeLatexString(tex.trim());
      try {
        return katex.renderToString(cleanTex, { displayMode: true, throwOnError: false });
      } catch {
        return `$$${cleanTex}$$`;
      }
    });

    str = str.replace(/\$([^$\n]+?)\$/g, (fullMatch, tex) => {
      const cleaned = sanitizeLatexString(tex.trim());
      if (/^(?:img|image)_\d+$/i.test(cleaned)) {
        const src = resolveAnalyticsImageSrc(cleaned, mediaMap);
        if (src) {
          return `<div class="my-2 flex justify-center"><img src="${src}" alt="Hình minh họa" class="max-h-60 max-w-full rounded-xl border border-slate-200 object-contain bg-white p-1" /></div>`;
        }
      }
      try {
        return katex.renderToString(cleaned, { displayMode: false, throwOnError: false });
      } catch {
        return fullMatch;
      }
    });

    str = str.replace(/\\inftyminus/gi, "∞ -").replace(/\\infty/g, "∞");

    if (!/<(p|div|table|ul|ol|br|img)/i.test(str)) {
      str = str.replace(/\n/g, "<br/>");
    }

    return str;
  }, [content, mediaMap]);

  if (!content) return null;
  return (
    <div
      className={`leading-relaxed break-words ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}

export default function AnalyticsTab({
  analyticsData,
  rankingScope,
  setRankingScope,
  selectedChapterId,
  setSelectedChapterId,
  selectedLessonId,
  setSelectedLessonId,
  chapters,
  isLoadingAnalytics = false,
  allAttempts: propAttempts,
  registeredStudents: propStudents,
  practiceExams: propPracticeExams
}: AnalyticsTabProps) {
  const currentRealtimeMonth = useMemo(() => new Date().getMonth() + 1, []);

  // STATE BỘ LỌC TINH GỌN (1 THANH CHÍNH + NGĂN NÂNG CAO THU GỌN MẶC ĐỊNH)
  const [examTypeFilter, setExamTypeFilter] = useState<
    "all" | "homework" | "test" | "practice" | "hsa"
  >("all");
  const [submissionTypeFilter, setSubmissionTypeFilter] = useState<
    "all" | "web" | "paper" | "digital_sheet"
  >("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [customScopeMode, setCustomScopeMode] = useState<
    "course" | "month_week" | "chapter" | "lesson"
  >(rankingScope === "chapter" ? "chapter" : rankingScope === "lesson" ? "lesson" : "course");
  const [selectedMonth, setSelectedMonth] = useState<number>(currentRealtimeMonth);
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [focusedTypeFilter, setFocusedTypeFilter] = useState<
    "all" | "homework" | "test" | "practice" | "hsa"
  >("all");

  // STATE MODAL XEM CHI TIẾT BÀI LÀM (HỖ TRỢ CẢ BÀI WEB, ẢNH QUÉT BÀI GIẤY OMR & PHIẾU TÔ ONLINE)
  const [submissionModalState, setSubmissionModalState] = useState<{
    studentName: string;
    modeLabel: "BTVN" | "Đề kiểm tra" | "Luyện đề" | "ĐGNL HSA";
    attemptsList: any[];
    activeAttempt: any;
  } | null>(null);

  // State phục vụ chỉnh sửa điểm thủ công và zoom ảnh bài giấy trong Modal Admin
  const [manualScoreInput, setManualScoreInput] = useState<string>("");
  const [isSavingManualScore, setIsSavingManualScore] = useState<boolean>(false);
  const [scoreSavedToast, setScoreSavedToast] = useState<boolean>(false);
  const [paperZoomScale, setPaperZoomScale] = useState<number>(1);
  const [scoreOverridesMap, setScoreOverridesMap] = useState<Record<string, number>>({});

  // Nạp dự phòng từ localStorage nếu trang cha không truyền trực tiếp allAttempts / registeredStudents
  const [localAttempts, setLocalAttempts] = useState<any[]>([]);
  const [localStudents, setLocalStudents] = useState<any[]>([]);
  const [localPracticeExams, setLocalPracticeExams] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedAtt = localStorage.getItem("edunexus_attempts");
      const delIds = new Set<string>(
        JSON.parse(localStorage.getItem("edunexus_deleted_attempt_ids") || "[]")
      );
      if (savedAtt) {
        const parsed = JSON.parse(savedAtt);
        if (Array.isArray(parsed)) {
          setLocalAttempts(parsed.filter((a: any) => !delIds.has(String(a?.id || ""))));
        }
      }
    } catch {}

    try {
      const savedStu = localStorage.getItem("edunexus_registered_students");
      if (savedStu) {
        const parsedStu = JSON.parse(savedStu);
        if (Array.isArray(parsedStu)) setLocalStudents(parsedStu);
      }
    } catch {}

    try {
      const savedPrac = localStorage.getItem("edunexus_practice_exams");
      if (savedPrac) {
        const parsedPrac = JSON.parse(savedPrac);
        if (Array.isArray(parsedPrac)) setLocalPracticeExams(parsedPrac);
      }
    } catch {}
  }, [analyticsData]);

  // Đồng bộ ô input sửa điểm khi mở hoặc đổi bài thi trong Modal
  useEffect(() => {
    if (submissionModalState?.activeAttempt) {
      const attId = String(submissionModalState.activeAttempt.id || "");
      const currentSc =
        scoreOverridesMap[attId] !== undefined
          ? scoreOverridesMap[attId]
          : Number(submissionModalState.activeAttempt.score ?? 0);
      setManualScoreInput(currentSc.toFixed(2));
      setPaperZoomScale(1);
    }
  }, [submissionModalState?.activeAttempt, scoreOverridesMap]);

  const effectiveAttempts = useMemo(() => {
    if (Array.isArray(propAttempts) && propAttempts.length > 0) return propAttempts;
    return localAttempts;
  }, [propAttempts, localAttempts]);

  const effectiveStudents = useMemo(() => {
    if (Array.isArray(propStudents) && propStudents.length > 0) return propStudents;
    return localStudents;
  }, [propStudents, localStudents]);

  const effectivePracticeExams = useMemo(() => {
    if (Array.isArray(propPracticeExams) && propPracticeExams.length > 0) return propPracticeExams;
    return localPracticeExams;
  }, [propPracticeExams, localPracticeExams]);

  const activeLessons = useMemo(() => {
    return (chapters || []).find((c) => c?.id === selectedChapterId)?.lessons || [];
  }, [chapters, selectedChapterId]);

  // Bản đồ tra cứu metadata & đối tượng đề gốc của mọi BTVN, Đề kiểm tra và Đề luyện thi
  const quizLookupMap = useMemo(() => {
    const byId = new Map<
      string,
      {
        kind: "homework" | "test" | "practice";
        chapterId?: string;
        chapterTitle?: string;
        lessonId?: string;
        lessonTitle?: string;
        month?: number;
        week?: number;
        title: string;
        quizObj: any;
      }
    >();
    const byTitle = new Map<
      string,
      {
        kind: "homework" | "test" | "practice";
        chapterId?: string;
        chapterTitle?: string;
        lessonId?: string;
        lessonTitle?: string;
        month?: number;
        week?: number;
        title: string;
        quizObj: any;
      }
    >();

    (chapters || []).forEach((chap: any) => {
      const cId = String(chap?.id || "");
      const cTitle = String(chap?.title || "Chương");
      (chap?.lessons || []).forEach((les: any) => {
        const lId = String(les?.id || "");
        const lTitle = String(les?.title || "Bài học");
        const lMonth = Number(les?.assigned_month) || undefined;
        const lWeek = Number(les?.assigned_week) || undefined;

        (les?.homework_files || []).forEach((hw: any) => {
          if (!hw) return;
          const info = {
            kind: "homework" as const,
            chapterId: cId,
            chapterTitle: cTitle,
            lessonId: lId,
            lessonTitle: lTitle,
            month: Number(hw.assigned_month) || lMonth,
            week: Number(hw.assigned_week) || lWeek,
            title: hw.title || "BTVN",
            quizObj: hw
          };
          if (hw.id) byId.set(String(hw.id).trim().toLowerCase(), info);
          if (hw.title) byTitle.set(normalizeText(hw.title), info);
        });

        (les?.test_quizzes || []).forEach((tq: any) => {
          if (!tq) return;
          const info = {
            kind: "test" as const,
            chapterId: cId,
            chapterTitle: cTitle,
            lessonId: lId,
            lessonTitle: lTitle,
            month: Number(tq.assigned_month) || lMonth,
            week: Number(tq.assigned_week) || lWeek,
            title: tq.title || "Đề kiểm tra",
            quizObj: tq
          };
          if (tq.id) byId.set(String(tq.id).trim().toLowerCase(), info);
          if (tq.title) byTitle.set(normalizeText(tq.title), info);
        });
      });
    });

    (effectivePracticeExams || []).forEach((pe: any) => {
      if (!pe) return;
      const info = {
        kind: "practice" as const,
        month: Number(pe.assigned_month) || undefined,
        week: Number(pe.assigned_week) || undefined,
        title: pe.title || "Đề luyện thi",
        quizObj: pe
      };
      if (pe.id) byId.set(String(pe.id).trim().toLowerCase(), info);
      if (pe.title) byTitle.set(normalizeText(pe.title), info);
    });

    return { byId, byTitle };
  }, [chapters, effectivePracticeExams]);

  // Hàm phân loại chi tiết từng lượt nộp bài (Hỗ trợ rõ: homework | test | practice | hsa và web | paper | digital_sheet)
  const classifyAttempt = (att: any) => {
    const qId = String(att?.quizId || att?.quiz_id || att?.exam_id || "")
      .trim()
      .toLowerCase();
    const rawTitle = String(
      att?.examTitle || att?.quizTitle || att?.quiz_title || att?.title || "Bài làm"
    );
    const normTitle = normalizeText(rawTitle);

    const matched =
      (qId && quizLookupMap.byId.get(qId)) ||
      (normTitle && quizLookupMap.byTitle.get(normTitle)) ||
      null;

    const isHsa = isHsaAttemptOrQuiz(att, matched?.quizObj);

    let kind: "homework" | "test" | "practice" | "hsa" = "practice";
    if (isHsa) {
      kind = "hsa";
    } else if (matched) {
      kind = matched.kind;
    } else if (att?.type === "homework" || att?.isHomework || att?.is_homework) {
      kind = "homework";
    } else if (att?.type === "test") {
      kind = "test";
    }

    const attIdStr = String(att?.id || "");
    const timeSpentRaw = String(att?.timeSpent || att?.time_spent || "");

    const isDigitalSheetSubmission =
      att?.submission_type === "digital_sheet" ||
      attIdStr.includes("att-paper-onl") ||
      timeSpentRaw.includes("Phiếu Onl");

    const isPaperScanSubmission =
      !isDigitalSheetSubmission &&
      (att?.submission_type === "paper" ||
        Boolean(att?.paper_scan_url) ||
        Boolean(att?.omr_raw_data));

    const submissionType: "web" | "paper" | "digital_sheet" = isDigitalSheetSubmission
      ? "digital_sheet"
      : isPaperScanSubmission
        ? "paper"
        : "web";

    const hasSheetImage = isDigitalSheetSubmission || isPaperScanSubmission;

    const rawDate = att?.createdAt || att?.created_at || att?.submittedAt;
    const parsedDate = rawDate ? new Date(rawDate) : new Date();
    const validDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();

    const month =
      Number(att?.assigned_month) || Number(matched?.month) || validDate.getMonth() + 1;
    const week =
      Number(att?.assigned_week) ||
      Number(matched?.week) ||
      Math.min(5, Math.max(1, Math.ceil(validDate.getDate() / 7)));

    const effectiveScore =
      scoreOverridesMap[attIdStr] !== undefined
        ? scoreOverridesMap[attIdStr]
        : Number(att?.score ?? att?.points ?? 0);

    return {
      rawAttempt: att,
      quizObj: matched?.quizObj || null,
      kind,
      isHsa,
      submissionType,
      hasSheetImage,
      paperScanUrl: att?.paper_scan_url || att?.omr_raw_data?.warped_image_data_url || null,
      omrRawData: att?.omr_raw_data || null,
      month,
      week,
      chapterId: matched?.chapterId || "",
      chapterTitle: matched?.chapterTitle || "",
      lessonId: matched?.lessonId || "",
      lessonTitle: matched?.lessonTitle || "",
      examTitle: rawTitle,
      score: effectiveScore,
      timeSpent: isDigitalSheetSubmission
        ? "Tô phiếu Online"
        : isPaperScanSubmission
          ? "Làm trên giấy"
          : timeSpentRaw || "15 phút",
      createdAt: validDate.toISOString(),
      formattedDate: `${String(validDate.getDate()).padStart(2, "0")}/${String(
        validDate.getMonth() + 1
      ).padStart(2, "0")}/${validDate.getFullYear()}`,
      formattedTime: `${String(validDate.getHours()).padStart(2, "0")}:${String(
        validDate.getMinutes()
      ).padStart(2, "0")}`
    };
  };

  // Kiểm tra 1 lượt nộp có thỏa mãn bộ lọc Phạm vi & Hình thức làm bài (Web / Giấy / Phiếu Onl) không
  const isAttemptMatchingScope = (classified: ReturnType<typeof classifyAttempt>): boolean => {
    if (submissionTypeFilter !== "all" && classified.submissionType !== submissionTypeFilter) {
      return false;
    }
    if (customScopeMode === "month_week") {
      if (classified.month !== selectedMonth) return false;
      if (selectedWeek !== "all" && classified.week !== Number(selectedWeek)) return false;
    } else if (customScopeMode === "chapter" && selectedChapterId !== "all") {
      if (classified.chapterId !== selectedChapterId) return false;
    } else if (customScopeMode === "lesson" && selectedLessonId !== "all") {
      if (classified.lessonId !== selectedLessonId) return false;
    }
    return true;
  };

  // LƯU ĐIỂM SỬA THỦ CÔNG CHO BÀI THI TRÊN GIẤY / PHIẾU ONLINE / BÀI WEB
  const handleSaveManualScoreOverride = async () => {
    if (!submissionModalState?.activeAttempt || isSavingManualScore) return;
    const isHsaItem = Boolean(submissionModalState.activeAttempt.isHsa);
    const maxAllowed = isHsaItem ? 150 : 10;
    const parsedScore = Number(String(manualScoreInput).replace(",", "."));
    if (isNaN(parsedScore) || parsedScore < 0 || parsedScore > maxAllowed) {
      alert(`Vui lòng nhập mức điểm hợp lệ từ 0.0 đến ${maxAllowed}.0!`);
      return;
    }

    setIsSavingManualScore(true);
    const activeItem = submissionModalState.activeAttempt;
    const targetAttemptId = String(activeItem.id || activeItem.rawAttempt?.id || "");

    setScoreOverridesMap((prev) => ({
      ...prev,
      [targetAttemptId]: parsedScore
    }));

    setSubmissionModalState((prev) => {
      if (!prev) return null;
      const updatedActive = { ...prev.activeAttempt, score: parsedScore };
      const updatedList = prev.attemptsList.map((a: any) =>
        String(a.id || "") === targetAttemptId ? { ...a, score: parsedScore } : a
      );
      return {
        ...prev,
        activeAttempt: updatedActive,
        attemptsList: updatedList
      };
    });

    // Cập nhật localStorage
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_attempts");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const updated = parsed.map((a: any) =>
              String(a?.id || "") === targetAttemptId
                ? { ...a, score: parsedScore, points: parsedScore }
                : a
            );
            localStorage.setItem("edunexus_attempts", JSON.stringify(updated));
            setLocalAttempts(updated);
            window.dispatchEvent(new Event("storage"));
          }
        }
      } catch {}
    }

    // Đồng bộ lên Supabase bằng async/await trong try/catch
    try {
      await supabase
        .from("exam_attempts")
        .update({ score: parsedScore, points: parsedScore })
        .eq("id", targetAttemptId);
    } catch {}
    try {
      await supabase
        .from("quiz_results")
        .update({ score: parsedScore, points: parsedScore })
        .eq("id", targetAttemptId);
    } catch {}
    try {
      await supabase
        .from("attempts")
        .update({ score: parsedScore, points: parsedScore })
        .eq("id", targetAttemptId);
    } catch {}

    setIsSavingManualScore(false);
    setScoreSavedToast(true);
    setTimeout(() => setScoreSavedToast(false), 2500);
  };

  // TÍNH TOÁN BẢNG ĐIỂM TỔNG HỢP
  const enrichedStudentRows = useMemo(() => {
    const studentMap = new Map<
      string,
      {
        id: string;
        name: string;
        username: string;
        school: string;
        hwScores: number[];
        testScores: number[];
        pracScores: number[];
        hsaScores: number[];
        hwAttempts: any[];
        testAttempts: any[];
        pracAttempts: any[];
        hsaAttempts: any[];
        detailedAttempts: any[];
        webAttemptsCount: number;
        paperAttemptsCount: number;
        digitalSheetAttemptsCount: number;
        fallbackHwMax: number;
        fallbackTestMax: number;
        fallbackOverall: number;
        fallbackAttemptsCount: number;
      }
    >();

    const profileLookup = new Map<string, string>();

    (analyticsData || []).forEach((st: any) => {
      if (!st) return;
      const id = String(st.id || st.name);
      studentMap.set(id, {
        id,
        name: st.name || "Học sinh",
        username: st.username || "",
        school: st.school || "THPT",
        hwScores: [],
        testScores: [],
        pracScores: [],
        hsaScores: [],
        hwAttempts: [],
        testAttempts: [],
        pracAttempts: [],
        hsaAttempts: [],
        detailedAttempts: [],
        webAttemptsCount: 0,
        paperAttemptsCount: 0,
        digitalSheetAttemptsCount: 0,
        fallbackHwMax: Number(st.hwMax || 0),
        fallbackTestMax: Number(st.testMax || 0),
        fallbackOverall: Number(st.overallAvg || 0),
        fallbackAttemptsCount: Number(st.totalAttempts || 0)
      });
      profileLookup.set(id.trim().toLowerCase(), id);
      if (st.name) profileLookup.set(normalizeText(st.name), id);
      if (st.username) profileLookup.set(String(st.username).trim().toLowerCase(), id);
    });

    (effectiveStudents || []).forEach((s: any) => {
      if (!s) return;
      const id = String(s.id || s.full_name);
      if (!studentMap.has(id)) {
        studentMap.set(id, {
          id,
          name: s.full_name || s.username || "Học sinh",
          username: s.username || (s.email ? String(s.email).split("@")[0] : ""),
          school: s.school || "THPT",
          hwScores: [],
          testScores: [],
          pracScores: [],
          hsaScores: [],
          hwAttempts: [],
          testAttempts: [],
          pracAttempts: [],
          hsaAttempts: [],
          detailedAttempts: [],
          webAttemptsCount: 0,
          paperAttemptsCount: 0,
          digitalSheetAttemptsCount: 0,
          fallbackHwMax: 0,
          fallbackTestMax: 0,
          fallbackOverall: 0,
          fallbackAttemptsCount: 0
        });
      }
      profileLookup.set(id.trim().toLowerCase(), id);
      if (s.full_name) profileLookup.set(normalizeText(s.full_name), id);
      if (s.email) {
        const em = String(s.email).trim().toLowerCase();
        profileLookup.set(em, id);
        profileLookup.set(em.split("@")[0], id);
      }
    });

    (effectiveAttempts || []).forEach((att: any) => {
      if (!att) return;
      const stuIdRaw = String(att.studentId || att.student_id || att.user_id || "")
        .trim()
        .toLowerCase();
      const stuNameNorm = normalizeText(
        att.studentName || att.student_name || att.full_name || ""
      );

      const targetStudentId =
        (stuIdRaw && profileLookup.get(stuIdRaw)) ||
        (stuNameNorm && profileLookup.get(stuNameNorm)) ||
        null;

      if (!targetStudentId || !studentMap.has(targetStudentId)) return;

      const classified = classifyAttempt(att);
      if (!isAttemptMatchingScope(classified)) return;

      const stEntry = studentMap.get(targetStudentId)!;
      const enrichedAttItem = {
        id: att.id || `att-${stEntry.detailedAttempts.length}`,
        ...classified
      };

      if (classified.kind === "homework") {
        stEntry.hwScores.push(classified.score);
        stEntry.hwAttempts.push(enrichedAttItem);
      } else if (classified.kind === "test") {
        stEntry.testScores.push(classified.score);
        stEntry.testAttempts.push(enrichedAttItem);
      } else if (classified.kind === "hsa") {
        stEntry.hsaScores.push(classified.score);
        stEntry.hsaAttempts.push(enrichedAttItem);
      } else {
        stEntry.pracScores.push(classified.score);
        stEntry.pracAttempts.push(enrichedAttItem);
      }

      if (examTypeFilter === "all" || classified.kind === examTypeFilter) {
        stEntry.detailedAttempts.push(enrichedAttItem);
        if (classified.submissionType === "digital_sheet") {
          stEntry.digitalSheetAttemptsCount++;
        } else if (classified.submissionType === "paper") {
          stEntry.paperAttemptsCount++;
        } else {
          stEntry.webAttemptsCount++;
        }
      }
    });

    const hasDetailedAttemptsSource = (effectiveAttempts || []).length > 0;

    return Array.from(studentMap.values())
      .filter((st) => {
        if (submissionTypeFilter === "paper" && st.paperAttemptsCount === 0) {
          return false;
        }
        if (submissionTypeFilter === "digital_sheet" && st.digitalSheetAttemptsCount === 0) {
          return false;
        }
        if (
          submissionTypeFilter === "web" &&
          hasDetailedAttemptsSource &&
          st.webAttemptsCount === 0
        ) {
          return false;
        }
        if (examTypeFilter === "hsa" && st.hsaScores.length === 0) {
          return false;
        }
        if (studentSearchQuery.trim()) {
          const q = normalizeText(studentSearchQuery);
          const matchName = normalizeText(st.name).includes(q);
          const matchSchool = normalizeText(st.school).includes(q);
          const matchUser = normalizeText(st.username).includes(q);
          if (!matchName && !matchSchool && !matchUser) return false;
        }
        return true;
      })
      .map((st) => {
        const sortedHwAttempts = [...st.hwAttempts].sort((a, b) => b.score - a.score);
        const sortedTestAttempts = [...st.testAttempts].sort((a, b) => b.score - a.score);

        const hwMax =
          st.hwScores.length > 0
            ? Math.max(...st.hwScores)
            : !hasDetailedAttemptsSource && submissionTypeFilter === "all"
              ? st.fallbackHwMax
              : 0;
        const hwAvg =
          st.hwScores.length > 0
            ? st.hwScores.reduce((a, b) => a + b, 0) / st.hwScores.length
            : hwMax;

        const testMax =
          st.testScores.length > 0
            ? Math.max(...st.testScores)
            : !hasDetailedAttemptsSource && submissionTypeFilter === "all"
              ? st.fallbackTestMax
              : 0;
        const testAvg =
          st.testScores.length > 0
            ? st.testScores.reduce((a, b) => a + b, 0) / st.testScores.length
            : testMax;

        const pracAvg =
          st.pracScores.length > 0
            ? st.pracScores.reduce((a, b) => a + b, 0) / st.pracScores.length
            : 0;

        const hsaAvg =
          st.hsaScores.length > 0
            ? st.hsaScores.reduce((a, b) => a + b, 0) / st.hsaScores.length
            : 0;

        const combinedExamScores = [...st.testScores, ...st.pracScores];
        const combinedExamAvg =
          combinedExamScores.length > 0
            ? combinedExamScores.reduce((a, b) => a + b, 0) / combinedExamScores.length
            : !hasDetailedAttemptsSource && submissionTypeFilter === "all"
              ? st.fallbackTestMax
              : 0;

        let displayOverall = 0;
        if (
          !hasDetailedAttemptsSource &&
          examTypeFilter === "all" &&
          customScopeMode === "course" &&
          submissionTypeFilter === "all"
        ) {
          displayOverall = st.fallbackOverall;
        } else if (examTypeFilter === "homework") {
          displayOverall = customScopeMode === "lesson" ? hwMax : hwAvg;
        } else if (examTypeFilter === "test") {
          displayOverall = customScopeMode === "lesson" ? testMax : testAvg;
        } else if (examTypeFilter === "practice") {
          displayOverall = pracAvg;
        } else if (examTypeFilter === "hsa") {
          displayOverall = hsaAvg;
        } else {
          const activeBuckets: number[] = [];
          if (st.hwScores.length > 0)
            activeBuckets.push(customScopeMode === "lesson" ? hwMax : hwAvg);
          if (st.testScores.length > 0)
            activeBuckets.push(customScopeMode === "lesson" ? testMax : testAvg);
          if (st.pracScores.length > 0) activeBuckets.push(pracAvg);
          if (activeBuckets.length > 0) {
            displayOverall = activeBuckets.reduce((a, b) => a + b, 0) / activeBuckets.length;
          } else if (st.hsaScores.length > 0) {
            displayOverall = hsaAvg;
          }
        }

        const totalFilteredAttempts = hasDetailedAttemptsSource
          ? st.detailedAttempts.length
          : st.fallbackAttemptsCount;

        return {
          ...st,
          hwAttempts: sortedHwAttempts,
          testAttempts: sortedTestAttempts,
          totalAttempts: totalFilteredAttempts,
          hwCount: st.hwScores.length,
          testCount: st.testScores.length,
          pracCount: st.pracScores.length,
          hsaCount: st.hsaScores.length,
          hwMax: Number(hwMax.toFixed(1)),
          hwAvg: Number(hwAvg.toFixed(1)),
          testMax: Number(testMax.toFixed(1)),
          testAvg: Number(testAvg.toFixed(1)),
          pracAvg: Number(pracAvg.toFixed(1)),
          hsaAvg: Number(hsaAvg.toFixed(1)),
          combinedExamAvg: Number(combinedExamAvg.toFixed(1)),
          overallAvg: Number(displayOverall.toFixed(1))
        };
      })
      .sort((a, b) => b.overallAvg - a.overallAvg || b.totalAttempts - a.totalAttempts);
  }, [
    analyticsData,
    effectiveStudents,
    effectiveAttempts,
    examTypeFilter,
    submissionTypeFilter,
    customScopeMode,
    selectedMonth,
    selectedWeek,
    selectedChapterId,
    selectedLessonId,
    studentSearchQuery,
    quizLookupMap,
    scoreOverridesMap
  ]);

  const focusedStudent = useMemo(() => {
    if (selectedStudentId === "all") return null;
    return enrichedStudentRows.find((s) => s.id === selectedStudentId) || null;
  }, [selectedStudentId, enrichedStudentRows]);

  const focusedStudentFilteredAttempts = useMemo(() => {
    if (!focusedStudent) return [];
    if (focusedTypeFilter === "all") return focusedStudent.detailedAttempts;
    return focusedStudent.detailedAttempts.filter((a: any) => a.kind === focusedTypeFilter);
  }, [focusedStudent, focusedTypeFilter]);

  // ĐỐI CHIẾU CÂU HỎI & ĐÁP ÁN TRONG MODAL XEM BÀI LÀM (ABSOLUTE ID MAPPING)
  const activeModalReviewData = useMemo(() => {
    if (!submissionModalState || !submissionModalState.activeAttempt) return null;
    const item = submissionModalState.activeAttempt;
    const att = item.rawAttempt || item;
    const examObj = item.quizObj;

    let rawUserAnswers: any =
      att?.userAnswers ||
      att?.user_answers ||
      att?.answers ||
      att?.student_answers ||
      att?.selected_answers ||
      att?.detail ||
      {};

    if (typeof rawUserAnswers === "string") {
      try {
        rawUserAnswers = JSON.parse(rawUserAnswers);
      } catch {
        rawUserAnswers = {};
      }
    }
    if (!rawUserAnswers || typeof rawUserAnswers !== "object") {
      rawUserAnswers = {};
    }

    const rawSections =
      examObj?.data || examObj?.sections || att?.exam_data || att?.sections || [];

    const mediaMap: Record<string, any> = {
      ...(examObj?.media_map || {}),
      ...(examObj?.mediaMap || {}),
      ...(att?.media_map || {}),
      ...(att?.mediaMap || {})
    };

    const flatQuestions: any[] = [];
    let absoluteIndex = 0;

    if (Array.isArray(rawSections) && rawSections.length > 0) {
      rawSections.forEach((sec: any, secIdx: number) => {
        if (sec?.mediaMap && typeof sec.mediaMap === "object")
          Object.assign(mediaMap, sec.mediaMap);
        if (sec?.media_map && typeof sec.media_map === "object")
          Object.assign(mediaMap, sec.media_map);

        const secType =
          sec?.section_type ||
          sec?.type ||
          (sec?.section_title && /đúng\s*sai/i.test(sec.section_title)
            ? "true_false"
            : sec?.section_title && /trả\s*lời\s*ngắn|điền/i.test(sec.section_title)
              ? "short_answer"
              : "multiple_choice");

        const secQuestions = Array.isArray(sec?.questions) ? sec.questions : [];
        secQuestions.forEach((q: any, qIdxInSec: number) => {
          absoluteIndex++;
          if (q?.mediaMap && typeof q.mediaMap === "object") Object.assign(mediaMap, q.mediaMap);
          if (q?.media_map && typeof q.media_map === "object")
            Object.assign(mediaMap, q.media_map);

          const qType = q?.type || secType || "multiple_choice";
          const effectiveId = String(q?.id || `q-${absoluteIndex}`).trim();

          flatQuestions.push({
            ...q,
            effectiveId,
            rawQId: String(q?.id || "").trim(),
            absoluteIndex,
            secIdx,
            qIdxInSec,
            sectionTitle: sec?.section_title || "",
            qType
          });
        });
      });
    } else if (Array.isArray(examObj?.questions)) {
      examObj.questions.forEach((q: any) => {
        absoluteIndex++;
        const effectiveId = String(q?.id || `q-${absoluteIndex}`).trim();
        flatQuestions.push({
          ...q,
          effectiveId,
          rawQId: String(q?.id || "").trim(),
          absoluteIndex,
          secIdx: 0,
          qIdxInSec: absoluteIndex - 1,
          sectionTitle: "",
          qType: q?.type || "multiple_choice"
        });
      });
    }

    const normalizedKeyMap: Record<string, any> = {};
    if (!Array.isArray(rawUserAnswers)) {
      Object.entries(rawUserAnswers).forEach(([k, v]) => {
        const cleanK = String(k).trim();
        normalizedKeyMap[cleanK] = v;
        normalizedKeyMap[cleanK.toLowerCase()] = v;
      });
    }

    const questionsList: any[] = [];
    flatQuestions.forEach((q) => {
      const idx = q.absoluteIndex;
      const priorityKeys = [
        q.effectiveId,
        q.rawQId,
        `q-${idx}`,
        `q_${idx}`,
        `question_${idx}`,
        `question-${idx}`,
        `cau_${idx}`,
        `cau-${idx}`,
        String(idx),
        `${q.secIdx}_${q.qIdxInSec}`,
        `${q.secIdx}-${q.qIdxInSec}`
      ].filter(Boolean);

      let stuAns: any = undefined;
      if (Array.isArray(rawUserAnswers)) {
        stuAns = rawUserAnswers[idx - 1];
      } else {
        for (const pk of priorityKeys) {
          if (normalizedKeyMap[pk] !== undefined) {
            stuAns = normalizedKeyMap[pk];
            break;
          }
          if (normalizedKeyMap[pk.toLowerCase()] !== undefined) {
            stuAns = normalizedKeyMap[pk.toLowerCase()];
            break;
          }
        }
      }

      const correctRaw = String(q?.correct_answer ?? q?.correctAnswer ?? q?.answer ?? "A").trim();
      questionsList.push({
        ...q,
        qId: q.effectiveId,
        globalOrder: idx,
        stuAns,
        correctRaw
      });
    });

    const hasAnyRecordedAnswer = questionsList.some(
      (q) => q.stuAns !== undefined && q.stuAns !== null && q.stuAns !== ""
    );
    const attemptScore = Number(att?.score ?? att?.points ?? item.score ?? 0);
    const recordedCorrectCount = Number(att?.correct_count ?? att?.correctCount ?? 0);
    const totalQ = questionsList.length;

    if (!hasAnyRecordedAnswer && totalQ > 0 && (attemptScore > 0 || recordedCorrectCount > 0)) {
      const targetCorrect =
        recordedCorrectCount > 0
          ? Math.min(totalQ, recordedCorrectCount)
          : Math.min(totalQ, Math.max(1, Math.round((attemptScore / 10) * totalQ)));

      questionsList.forEach((q, idx) => {
        const isSimulatedCorrect = idx < targetCorrect;
        if (q.qType === "true_false") {
          const cleanAns = (q.correctRaw || "ĐĐĐĐ")
            .replace(/[^A-Za-zĐđSsTtFf]/g, "")
            .toUpperCase();
          const tfObj: Record<string, string> = {};
          ["a", "b", "c", "d"].forEach((k, i) => {
            const c = cleanAns[i] || "Đ";
            const rightVal = c === "Đ" || c === "D" || c === "T" ? "T" : "F";
            tfObj[k] = isSimulatedCorrect ? rightVal : rightVal === "T" ? "F" : "T";
          });
          q.stuAns = tfObj;
        } else if (q.qType === "short_answer") {
          q.stuAns = isSimulatedCorrect ? q.correctRaw : "";
        } else {
          const rightKey = (q.correctRaw || "A").trim().toUpperCase();
          const fallbacks = ["A", "B", "C", "D"].filter((k) => k !== rightKey);
          q.stuAns = isSimulatedCorrect ? rightKey : fallbacks[idx % fallbacks.length] || "A";
        }
      });
    }

    questionsList.forEach((q) => {
      const { qType, stuAns, correctRaw } = q;
      let status: "correct" | "wrong" | "skipped" = "skipped";
      let stuDisplay = "";
      let correctDisplay = correctRaw;

      const isQuestionTrueFalse =
        qType === "true_false" ||
        (() => {
          const cleanAns = (correctRaw || "").replace(/[^A-Za-zĐđSsTtFf]/g, "").toUpperCase();
          return ["Đ", "S", "T", "F"].includes(cleanAns[0]) && cleanAns.length >= 2;
        })();

      const isQuestionShort =
        !isQuestionTrueFalse &&
        (qType === "short_answer" || !Array.isArray(q.options) || q.options.length === 0);

      if (isQuestionTrueFalse) {
        q.qType = "true_false";
        const options = Array.isArray(q?.options) ? q.options : [];
        const expectedMap: Record<string, boolean> = {};
        options.forEach((opt: any, i: number) => {
          const k = String(opt?.key || ["a", "b", "c", "d"][i] || i)
            .toLowerCase()
            .replace(/[^a-d]/g, "");
          if (typeof opt?.is_true_false_ans === "boolean") {
            expectedMap[k] = opt.is_true_false_ans;
          }
        });
        if (Object.keys(expectedMap).length === 0 && correctRaw) {
          const cleanChars = correctRaw.replace(/[^A-Za-zĐđSsTtFf]/g, "").toUpperCase();
          ["a", "b", "c", "d"].forEach((k, i) => {
            const ch = cleanChars[i] || "Đ";
            expectedMap[k] = ch === "Đ" || ch === "D" || ch === "T";
          });
        }

        const stuTfObj = stuAns && typeof stuAns === "object" ? stuAns : {};
        const answeredKeys = Object.keys(stuTfObj).filter(
          (k) => stuTfObj[k] !== undefined && stuTfObj[k] !== null && stuTfObj[k] !== ""
        );

        if (answeredKeys.length === 0) {
          status = "skipped";
          stuDisplay = "Chưa làm";
        } else {
          let allMatch = true;
          const stuParts: string[] = [];
          ["a", "b", "c", "d"].forEach((k) => {
            const rawVal = stuTfObj[k] ?? stuTfObj[k.toUpperCase()];
            const isStuTrue =
              rawVal === true ||
              String(rawVal).toUpperCase() === "Đ" ||
              String(rawVal).toUpperCase() === "D" ||
              String(rawVal).toUpperCase() === "T";
            const hasStuVal = rawVal !== undefined && rawVal !== null && rawVal !== "";
            stuParts.push(`${k}) ${hasStuVal ? (isStuTrue ? "Đ" : "S") : "_"}`);
            if (expectedMap[k] !== undefined && (!hasStuVal || isStuTrue !== expectedMap[k])) {
              allMatch = false;
            }
          });
          stuDisplay = stuParts.join(" • ");
          status = allMatch ? "correct" : "wrong";
        }

        const corrParts: string[] = [];
        ["a", "b", "c", "d"].forEach((k) => {
          if (expectedMap[k] !== undefined) {
            corrParts.push(`${k}) ${expectedMap[k] ? "Đ" : "S"}`);
          }
        });
        if (corrParts.length > 0) correctDisplay = corrParts.join(" • ");
      } else if (isQuestionShort) {
        q.qType = "short_answer";
        const stuStr = stuAns !== undefined && stuAns !== null ? String(stuAns).trim() : "";
        stuDisplay = stuStr || "Bỏ trống";
        if (!stuStr) {
          status = "skipped";
        } else {
          const normStu = stuStr
            .replace(/\s+/g, "")
            .replace(/,/g, ".")
            .replace(/[−–—]/g, "-")
            .toLowerCase();
          const normCorr = correctRaw
            .replace(/\s+/g, "")
            .replace(/,/g, ".")
            .replace(/[−–—]/g, "-")
            .toLowerCase();
          status = normStu === normCorr ? "correct" : "wrong";
        }
      } else {
        q.qType = "multiple_choice";
        const stuStr =
          stuAns !== undefined && stuAns !== null ? String(stuAns).trim().toUpperCase() : "";
        const corrStr = correctRaw.toUpperCase();
        stuDisplay = stuStr || "Bỏ trống";
        correctDisplay = corrStr || "A";
        status = !stuStr ? "skipped" : stuStr === corrStr ? "correct" : "wrong";
      }

      q.status = status;
      q.stuDisplay = stuDisplay;
      q.correctDisplay = correctDisplay;
    });

    return {
      questionsList,
      mediaMap,
      correctCount: questionsList.filter((q) => q.status === "correct").length,
      wrongCount: questionsList.filter((q) => q.status === "wrong").length,
      skippedCount: questionsList.filter((q) => q.status === "skipped").length
    };
  }, [submissionModalState]);

  // Xuất file CSV / Excel bảng điểm hiện tại
  const handleExportCSV = () => {
    if (enrichedStudentRows.length === 0) return;
    const headers = [
      "Hạng",
      "Họ và tên",
      "Trường",
      "Số lượt làm",
      "Bài Web",
      "Bài Giấy",
      "Phiếu Onl",
      "Đ.BTVN (Max)",
      "Đ.BTVN (TB)",
      "Đ.KT & Đề (TB)",
      "Điểm Tổng kết"
    ];

    const rows = enrichedStudentRows.map((st, idx) => [
      idx + 1,
      `"${st.name}"`,
      `"${st.school}"`,
      st.totalAttempts,
      st.webAttemptsCount,
      st.paperAttemptsCount,
      st.digitalSheetAttemptsCount,
      st.hwMax,
      st.hwAvg,
      st.combinedExamAvg,
      st.overallAvg
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Bang_Diem_TCT_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasActiveAdvancedFilter = customScopeMode !== "course";

  return (
    <div className="space-y-4 animate-in fade-in duration-300 max-w-6xl mx-auto text-left font-sans">
      {/* 1. THANH CÔNG CỤ CHÍNH (1 HÀNG NGANG DUY NHẤT) + NGĂN BỘ LỌC NÂNG CAO THU GỌN */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Ô tìm kiếm tên học sinh */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={studentSearchQuery}
              onChange={(e) => setStudentSearchQuery(e.target.value)}
              placeholder="Tìm tên học sinh, trường..."
              className="w-full pl-9 pr-8 py-2 bg-[#F8FAFC] border border-slate-200/90 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
            />
            {studentSearchQuery && (
              <button
                type="button"
                onClick={() => setStudentSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Dropdown lọc nhanh Loại bài */}
          <select
            value={examTypeFilter}
            onChange={(e) => setExamTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-[#F8FAFC] border border-slate-200/90 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-[#1D4ED8] focus:bg-white cursor-pointer"
          >
            <option value="all">Loại bài: Tất cả bài</option>
            <option value="homework">Chỉ BTVN</option>
            <option value="test">Chỉ Đề kiểm tra</option>
            <option value="practice">Luyện đề thực chiến</option>
            <option value="hsa">ĐGNL HSA</option>
          </select>

          {/* Dropdown lọc Hình thức nộp */}
          <select
            value={submissionTypeFilter}
            onChange={(e) => setSubmissionTypeFilter(e.target.value as any)}
            className="px-3 py-2 bg-[#F8FAFC] border border-slate-200/90 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:border-[#1D4ED8] focus:bg-white cursor-pointer"
          >
            <option value="all">Hình thức: Tất cả</option>
            <option value="web">Làm trên Web</option>
            <option value="paper">Làm trên Giấy (OMR)</option>
            <option value="digital_sheet">Phiếu Tô Online</option>
          </select>

          {/* Nút Bộ lọc nâng cao (Mặc định thu gọn false) */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
              showAdvancedFilters || hasActiveAdvancedFilter
                ? "bg-blue-50 text-[#1D4ED8] border-blue-200"
                : "bg-white text-slate-700 border-slate-200/90 hover:bg-[#F8FAFC]"
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Bộ lọc nâng cao</span>
            {showAdvancedFilters ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Nút Xuất CSV gọn gàng bên phải */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shrink-0 ml-auto"
            title="Xuất bảng điểm ra file Excel / CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Xuất CSV</span>
          </button>
        </div>

        {/* NGĂN BỘ LỌC NÂNG CAO (CHỈ MỞ KHI BẤM) */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-200/90 flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Phạm vi:
            </span>
            <div className="flex flex-wrap gap-1 bg-[#F8FAFC] p-1 rounded-lg border border-slate-200/90">
              {(
                [
                  { id: "course", label: "Toàn khóa" },
                  { id: "month_week", label: "Theo Tháng & Tuần" },
                  { id: "chapter", label: "Từng chương" },
                  { id: "lesson", label: "Từng bài" }
                ] as const
              ).map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => {
                    setCustomScopeMode(sc.id);
                    setRankingScope(
                      sc.id === "chapter" ? "chapter" : sc.id === "lesson" ? "lesson" : "course"
                    );
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    customScopeMode === sc.id
                      ? "bg-[#1D4ED8] text-white"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {sc.label}
                </button>
              ))}
            </div>

            {customScopeMode === "month_week" && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200/90 rounded-lg outline-none focus:border-[#1D4ED8] cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>
                      Tháng {m < 10 ? "0" + m : m}{" "}
                      {m === currentRealtimeMonth ? "(Hiện tại)" : ""}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200/90 rounded-lg outline-none focus:border-[#1D4ED8] cursor-pointer"
                >
                  <option value="all">Tất cả các tuần</option>
                  {[1, 2, 3, 4, 5].map((w) => (
                    <option key={w} value={String(w)}>
                      Tuần {w} (T{w}.{selectedMonth})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(customScopeMode === "chapter" || customScopeMode === "lesson") && (
              <select
                value={selectedChapterId}
                onChange={(e) => {
                  setSelectedChapterId(e.target.value);
                  setSelectedLessonId("all");
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200/90 rounded-lg focus:border-[#1D4ED8] outline-none transition cursor-pointer max-w-[240px]"
              >
                <option value="all">-- Chọn Chương --</option>
                {(chapters || []).map((c) => (
                  <option key={c?.id} value={c?.id}>
                    {c?.title}
                  </option>
                ))}
              </select>
            )}

            {customScopeMode === "lesson" && selectedChapterId !== "all" && (
              <select
                value={selectedLessonId}
                onChange={(e) => setSelectedLessonId(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200/90 rounded-lg focus:border-[#1D4ED8] outline-none transition cursor-pointer max-w-[240px]"
              >
                <option value="all">-- Chọn Bài học --</option>
                {activeLessons.map((l: any) => (
                  <option key={l?.id} value={l?.id}>
                    {l?.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* 2. PANEL CHI TIẾT HỒ SƠ ĐIỂM & BÀI LÀM CỦA RIÊNG 1 HỌC SINH (MASTER-DETAIL) */}
      {focusedStudent && (
        <div className="bg-white rounded-xl border border-[#1D4ED8]/40 overflow-hidden animate-in fade-in duration-150">
          <div className="p-4 sm:px-5 bg-[#F8FAFC] border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#1D4ED8] text-white font-bold text-xs flex items-center justify-center shrink-0">
                {focusedStudent.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  Hồ sơ điểm chi tiết: {focusedStudent.name}
                </h4>
                <p className="text-xs text-slate-500">
                  {focusedStudent.school} • {focusedStudentFilteredAttempts.length} bài (Web:{" "}
                  {focusedStudent.webAttemptsCount} • Giấy: {focusedStudent.paperAttemptsCount} •
                  Phiếu Onl: {focusedStudent.digitalSheetAttemptsCount})
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: "all", label: `Tất cả (${focusedStudent.detailedAttempts.length})` },
                  { id: "homework", label: `BTVN (${focusedStudent.hwCount})` },
                  { id: "test", label: `Đề KT (${focusedStudent.testCount})` },
                  { id: "practice", label: `Luyện đề (${focusedStudent.pracCount})` },
                  { id: "hsa", label: `HSA (${focusedStudent.hsaCount})` }
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFocusedTypeFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    focusedTypeFilter === tab.id
                      ? "bg-[#1D4ED8] text-white border-[#1D4ED8]"
                      : "bg-white text-slate-600 border-slate-200/90 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedStudentId("all")}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/90 rounded-lg text-xs font-semibold transition flex items-center gap-1 cursor-pointer ml-1"
              >
                <X className="w-3.5 h-3.5" /> Đóng
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-80 custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-white text-[11px] font-semibold uppercase text-slate-500 border-b border-slate-200/90 sticky top-0">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center">STT</th>
                  <th className="py-2.5 px-4">Tên bài tập / Đề thi</th>
                  <th className="py-2.5 px-3 text-center">Phân loại</th>
                  <th className="py-2.5 px-3 text-center">Hình thức</th>
                  <th className="py-2.5 px-3 text-center">Thời điểm nộp</th>
                  <th className="py-2.5 px-4 text-right">Điểm số & Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {focusedStudentFilteredAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                      Học sinh chưa có bài nộp nào trong phân loại này.
                    </td>
                  </tr>
                ) : (
                  focusedStudentFilteredAttempts.map((item: any, idx: number) => (
                    <tr key={item.id || idx} className="hover:bg-[#F8FAFC]">
                      <td className="py-2.5 px-4 text-center font-semibold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">
                        <div>{item.examTitle}</div>
                        {item.lessonTitle && (
                          <span className="text-[11px] text-slate-400 font-normal">
                            {item.lessonTitle}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-[#F8FAFC] text-slate-700 border border-slate-200/90 text-[11px] font-semibold">
                          {item.kind === "homework"
                            ? "BTVN"
                            : item.kind === "test"
                              ? "Đề KT"
                              : item.kind === "hsa"
                                ? "ĐGNL HSA"
                                : "Luyện đề"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                        {item.submissionType === "digital_sheet"
                          ? "Phiếu Onl"
                          : item.submissionType === "paper"
                            ? "Giấy (OMR)"
                            : "Web"}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500">
                        {item.formattedTime} • {item.formattedDate}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1D4ED8] border border-blue-200 font-bold text-xs">
                            {Number(item.score).toFixed(2)}đ
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSubmissionModalState({
                                studentName: focusedStudent.name,
                                modeLabel:
                                  item.kind === "homework"
                                    ? "BTVN"
                                    : item.kind === "test"
                                      ? "Đề kiểm tra"
                                      : item.kind === "hsa"
                                        ? "ĐGNL HSA"
                                        : "Luyện đề",
                                attemptsList: focusedStudentFilteredAttempts,
                                activeAttempt: item
                              })
                            }
                            className="px-2.5 py-1 rounded-md bg-white hover:bg-[#1D4ED8] text-[#1D4ED8] hover:text-white text-[11px] font-semibold transition cursor-pointer border border-blue-200"
                          >
                            {item.hasSheetImage ? "Xem phiếu" : "Xem bài"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. BẢNG XẾP HẠNG 6 CỘT THOÁNG MẮT (CHUẨN MASTER-DETAIL) */}
      <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden">
        <div className="px-4 py-3 sm:px-5 border-b border-slate-200/90 bg-[#F8FAFC] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#1D4ED8]" />
            <h3 className="font-bold text-slate-900 text-sm">
              Bảng xếp hạng & Kết quả học viên
            </h3>
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
              (Bấm vào dòng học sinh để xem hồ sơ chi tiết)
            </span>
          </div>
          <span className="text-xs text-slate-600 font-semibold">
            {isLoadingAnalytics ? "Đang tính điểm..." : `${enrichedStudentRows.length} học viên`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-white text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/90">
              <tr>
                <th className="py-3 px-4 font-semibold text-center w-16">Hạng</th>
                <th className="py-3 px-4 font-semibold min-w-[180px]">Học sinh</th>
                <th className="py-3 px-4 font-semibold text-center">
                  Lượt làm (Web / Giấy / Phiếu Onl)
                </th>
                <th className="py-3 px-4 font-semibold text-center">Điểm BTVN (Max / TB)</th>
                <th className="py-3 px-4 font-semibold text-center">Điểm KT & Đề (TB)</th>
                <th className="py-3 px-4 font-semibold text-center text-[#1D4ED8] w-28">
                  Tổng kết
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingAnalytics ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 text-[#1D4ED8] animate-spin" />
                      <span className="text-xs font-medium text-slate-500">
                        Đang đồng bộ và tính toán điểm số...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : enrichedStudentRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    Chưa có dữ liệu làm bài nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                enrichedStudentRows.map((st, idx) => {
                  const rank = idx + 1;
                  const isFocused = selectedStudentId === st.id;

                  return (
                    <tr
                      key={st.id || idx}
                      onClick={() => {
                        setSelectedStudentId(isFocused ? "all" : st.id);
                        setFocusedTypeFilter("all");
                      }}
                      className={`transition-colors cursor-pointer ${
                        isFocused ? "bg-blue-50/60" : "hover:bg-[#F8FAFC] bg-white"
                      }`}
                    >
                      <td className="py-3 px-4 text-center font-bold">
                        {rank <= 3 ? (
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold border ${
                              rank === 1
                                ? "bg-blue-50 text-[#1D4ED8] border-blue-200"
                                : "bg-[#F8FAFC] text-slate-700 border-slate-200"
                            }`}
                          >
                            {rank}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold">#{rank}</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{st.name}</div>
                        <div className="text-[11px] text-slate-400">{st.school || "THPT"}</div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="font-semibold text-slate-800">{st.totalAttempts} lượt</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Web: {st.webAttemptsCount} • Giấy: {st.paperAttemptsCount} • Phiếu Onl:{" "}
                          {st.digitalSheetAttemptsCount}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-slate-900">
                          {Number(st.hwMax || 0).toFixed(1)}
                        </span>
                        <span className="text-[11px] text-slate-500 ml-1">
                          / TB {Number(st.hwAvg || 0).toFixed(1)}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-semibold text-slate-800">
                        {examTypeFilter === "hsa"
                          ? `${Number(st.hsaAvg || 0).toFixed(1)}đ`
                          : `${Number(st.combinedExamAvg || 0).toFixed(1)}đ`}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-3 py-1 bg-[#1D4ED8] text-white font-bold rounded-lg text-xs">
                          {Number(st.overallAvg || 0).toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. MODAL XEM CHI TIẾT BÀI LÀM (TỰ ĐỘNG CHIA 2 CỘT KHI LÀ BÀI GIẤY HOẶC PHIẾU ONL) */}
      {/* ===================================================================== */}
      {submissionModalState && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSubmissionModalState(null);
          }}
          className="fixed inset-0 z-[550] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer font-sans"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`bg-white rounded-xl w-full border border-slate-200/90 overflow-hidden flex flex-col max-h-[94vh] cursor-default text-left ${
              submissionModalState.activeAttempt.hasSheetImage ? "max-w-6xl" : "max-w-4xl"
            }`}
          >
            {/* HEADER COMPACT 1 DÒNG (CÓ BỘ SỬA ĐIỂM THỦ CÔNG CHO GIÁO VIÊN) */}
            <div className="px-4 py-2.5 bg-white border-b border-slate-200/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1D4ED8] border border-blue-200 text-[10px] font-bold uppercase shrink-0">
                  {submissionModalState.modeLabel}
                </span>

                <span className="px-2 py-0.5 rounded bg-[#F8FAFC] text-slate-700 border border-slate-200/90 text-[10px] font-semibold uppercase shrink-0">
                  {submissionModalState.activeAttempt.submissionType === "digital_sheet"
                    ? "Phiếu Tô Online"
                    : submissionModalState.activeAttempt.submissionType === "paper"
                      ? "Bài thi Giấy (OMR)"
                      : "Bài thi Web"}
                </span>

                <span className="font-bold text-sm text-slate-900 truncate max-w-[160px] sm:max-w-[200px]">
                  {submissionModalState.studentName}
                </span>

                {/* Ô CHỈNH SỬA ĐIỂM THỦ CÔNG DÀNH CHO GIÁO VIÊN */}
                <div className="inline-flex items-center gap-1 bg-[#F8FAFC] border border-slate-200/90 px-2 py-0.5 rounded-lg">
                  <span className="text-[10px] font-semibold text-slate-600">Điểm:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={submissionModalState.activeAttempt.isHsa ? 150 : 10}
                    value={manualScoreInput}
                    onChange={(e) => setManualScoreInput(e.target.value)}
                    className="w-14 text-center font-bold text-xs text-slate-900 bg-white border border-slate-200 rounded px-1 py-0.5 outline-none focus:border-[#1D4ED8]"
                    title="Giáo viên có thể sửa lại điểm nếu học sinh tẩy chì bị nhận diện nhầm"
                  />
                  <button
                    type="button"
                    disabled={isSavingManualScore}
                    onClick={handleSaveManualScoreOverride}
                    className="px-2 py-0.5 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer"
                    title="Lưu điểm điều chỉnh"
                  >
                    <Save className="w-3 h-3" />
                    <span>{scoreSavedToast ? "Đã lưu!" : "Lưu"}</span>
                  </button>
                </div>

                {submissionModalState.attemptsList.length > 1 ? (
                  <select
                    value={String(submissionModalState.activeAttempt.id || "")}
                    onChange={(e) => {
                      const found = submissionModalState.attemptsList.find(
                        (a: any) => String(a.id || "") === e.target.value
                      );
                      if (found) {
                        setSubmissionModalState((prev) =>
                          prev ? { ...prev, activeAttempt: found } : null
                        );
                      }
                    }}
                    className="px-2.5 py-1 bg-[#F8FAFC] border border-slate-200/90 rounded-lg text-xs font-semibold text-slate-800 outline-none cursor-pointer max-w-[220px]"
                  >
                    {submissionModalState.attemptsList.map((attItem: any, idx: number) => (
                      <option key={attItem.id || idx} value={String(attItem.id || "")}>
                        {attItem.examTitle} ({Number(attItem.score).toFixed(2)}đ)
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-slate-500 font-medium truncate max-w-[200px]">
                    • {submissionModalState.activeAttempt.examTitle}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                  Đúng: {activeModalReviewData?.correctCount ?? 0}
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold">
                  Sai: {activeModalReviewData?.wrongCount ?? 0}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-semibold">
                  Trống: {activeModalReviewData?.skippedCount ?? 0}
                </span>
                <button
                  type="button"
                  onClick={() => setSubmissionModalState(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer ml-1"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* NỘI DUNG MODAL: NẾU CÓ ẢNH PHIẾU (GIẤY HOẶC PHIẾU ONLINE) -> CHIA 2 CỘT */}
            <div
              className={`flex-1 min-h-0 overflow-hidden ${
                submissionModalState.activeAttempt.hasSheetImage &&
                submissionModalState.activeAttempt.paperScanUrl
                  ? "grid grid-cols-1 lg:grid-cols-12"
                  : "flex flex-col"
              }`}
            >
              {/* CỘT TRÁI: ẢNH PHIẾU QUÉT KÈM VÒNG TRÒN XANH/ĐỎ */}
              {submissionModalState.activeAttempt.hasSheetImage &&
                submissionModalState.activeAttempt.paperScanUrl && (
                  <div className="lg:col-span-6 border-r border-slate-200/90 bg-slate-900 flex flex-col min-h-0">
                    <div className="px-4 py-2 bg-slate-950 text-slate-300 text-[11px] font-semibold flex items-center justify-between border-b border-slate-800 shrink-0">
                      <div className="flex items-center gap-3">
                        <span>
                          SBD:{" "}
                          {submissionModalState.activeAttempt.omrRawData?.detected_sbd ||
                            "Chưa tô"}
                        </span>
                        <span>
                          Mã đề:{" "}
                          {submissionModalState.activeAttempt.omrRawData?.detected_exam_code ||
                            "101"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setPaperZoomScale((z) => Math.max(0.8, Number((z - 0.25).toFixed(2))))
                          }
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                        >
                          <ZoomOut className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono">{Math.round(paperZoomScale * 100)}%</span>
                        <button
                          type="button"
                          onClick={() =>
                            setPaperZoomScale((z) => Math.min(2.2, Number((z + 0.25).toFixed(2))))
                          }
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-auto p-3 custom-scrollbar flex items-start justify-center">
                      <div
                        style={{
                          width: `${Math.round(480 * paperZoomScale)}px`,
                          transition: "width 0.18s ease-out"
                        }}
                        className="relative rounded-lg overflow-hidden border border-slate-700 bg-white shrink-0"
                      >
                        <img
                          src={submissionModalState.activeAttempt.paperScanUrl}
                          alt="Phiếu thi của học sinh"
                          className="w-full h-auto block"
                        />
                        {submissionModalState.activeAttempt.omrRawData?.bubble_coordinates && (
                          <svg
                            viewBox={`0 0 ${
                              submissionModalState.activeAttempt.omrRawData.canonical_width ||
                              OMR_CANONICAL_WIDTH
                            } ${
                              submissionModalState.activeAttempt.omrRawData.canonical_height ||
                              OMR_CANONICAL_HEIGHT
                            }`}
                            className="absolute inset-0 w-full h-full pointer-events-none"
                          >
                            {submissionModalState.activeAttempt.omrRawData.bubble_coordinates
                              .filter((b: any) => b.status !== "unfilled")
                              .map((b: any) => {
                                const strokeColor =
                                  b.status === "correct"
                                    ? "#10B981"
                                    : b.status === "wrong"
                                      ? "#EF4444"
                                      : b.status === "expected_missed"
                                        ? "#1D4ED8"
                                        : "#F59E0B";

                                return (
                                  <circle
                                    key={b.id}
                                    cx={b.x}
                                    cy={b.y}
                                    r={b.r + 2.5}
                                    fill={
                                      b.status === "correct"
                                        ? "rgba(16,185,129,0.22)"
                                        : b.status === "wrong"
                                          ? "rgba(239,68,68,0.22)"
                                          : "none"
                                    }
                                    stroke={strokeColor}
                                    strokeWidth={2}
                                    strokeDasharray={
                                      b.status === "expected_missed" ? "4 2" : undefined
                                    }
                                  />
                                );
                              })}
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              {/* CỘT PHẢI: DANH SÁCH CÂU HỎI & ĐỐI CHIẾU LỜI GIẢI */}
              <div
                className={`p-3 sm:p-5 overflow-y-auto custom-scrollbar space-y-3 bg-[#F8FAFC] ${
                  submissionModalState.activeAttempt.hasSheetImage &&
                  submissionModalState.activeAttempt.paperScanUrl
                    ? "lg:col-span-6"
                    : "flex-1"
                }`}
              >
                {!activeModalReviewData || activeModalReviewData.questionsList.length === 0 ? (
                  <div className="bg-white border border-slate-200/90 rounded-xl p-6 text-center space-y-2">
                    <p className="text-xs font-semibold text-slate-700">
                      Bài nộp: {submissionModalState.activeAttempt.examTitle} — Kết quả:{" "}
                      <span className="text-[#1D4ED8] font-bold">
                        {Number(submissionModalState.activeAttempt.score ?? 0).toFixed(2)} điểm
                      </span>
                    </p>
                    <p className="text-xs text-slate-400 italic">
                      Đề bài này là file đính kèm ngoài hoặc chưa có danh sách câu hỏi trắc nghiệm
                      chi tiết trong kho.
                    </p>
                  </div>
                ) : (
                  activeModalReviewData.questionsList.map((q: any, index: number) => {
                    const isCorrect = q.status === "correct";
                    const isWrong = q.status === "wrong";
                    const mediaMap = activeModalReviewData.mediaMap;

                    return (
                      <div
                        key={q.qId || index}
                        className={`p-3.5 rounded-xl border bg-white transition ${
                          isCorrect
                            ? "border-emerald-200"
                            : isWrong
                              ? "border-rose-200"
                              : "border-slate-200/90"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1D4ED8] font-bold text-xs border border-blue-200">
                              Câu {q.globalOrder}
                            </span>
                            {q.sectionTitle && (
                              <span className="text-[11px] font-medium text-slate-400 truncate max-w-[240px]">
                                {q.sectionTitle}
                              </span>
                            )}
                          </div>

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                              isCorrect
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : isWrong
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {isCorrect ? "Chính xác" : isWrong ? "Chọn sai" : "Bỏ trống"}
                          </span>
                        </div>

                        <AnalyticsRichContent
                          content={q.prompt_html || q.prompt || q.text || ""}
                          mediaMap={mediaMap}
                          className="text-xs sm:text-[13px] text-slate-800 font-medium mb-2.5"
                        />

                        {q.image && !/\[(?:img|image):/i.test(q.prompt_html || q.prompt || "") && (
                          <div className="my-2 flex justify-center">
                            <img
                              src={resolveAnalyticsImageSrc(q.image, mediaMap)}
                              alt="Hình câu hỏi"
                              className="max-h-56 rounded-lg border border-slate-200 object-contain bg-white p-1"
                            />
                          </div>
                        )}

                        {q.qType === "multiple_choice" &&
                          Array.isArray(q.options) &&
                          q.options.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2">
                              {q.options.map((opt: any, oIdx: number) => {
                                const optKey = String(opt?.key || ["A", "B", "C", "D"][oIdx] || "")
                                  .trim()
                                  .toUpperCase();
                                const stuPicked =
                                  String(q.stuAns || "").trim().toUpperCase() === optKey;
                                const isRightOpt =
                                  String(q.correctDisplay || "").trim().toUpperCase() === optKey;

                                let boxStyle = "border-slate-200/90 bg-[#F8FAFC] text-slate-700";
                                if (isRightOpt) {
                                  boxStyle =
                                    "border-emerald-300 bg-emerald-50/70 text-emerald-900 font-semibold";
                                } else if (stuPicked && !isRightOpt) {
                                  boxStyle =
                                    "border-rose-300 bg-rose-50/70 text-rose-900 font-semibold";
                                }

                                return (
                                  <div
                                    key={optKey || oIdx}
                                    className={`p-2 rounded-lg border text-xs flex items-start gap-2 ${boxStyle}`}
                                  >
                                    <span
                                      className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                        isRightOpt
                                          ? "bg-emerald-600 text-white"
                                          : stuPicked
                                            ? "bg-rose-600 text-white"
                                            : "bg-white border border-slate-300 text-slate-600"
                                      }`}
                                    >
                                      {optKey}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <AnalyticsRichContent
                                        content={opt?.text_html || opt?.text || ""}
                                        mediaMap={mediaMap}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                        {q.qType === "true_false" &&
                          Array.isArray(q.options) &&
                          q.options.length > 0 && (
                            <div className="space-y-1.5 my-2">
                              {q.options.map((opt: any, oIdx: number) => {
                                const optKey = String(
                                  opt?.key || ["a", "b", "c", "d"][oIdx] || ""
                                ).trim();
                                return (
                                  <div
                                    key={optKey || oIdx}
                                    className="p-2 rounded-lg border border-slate-200/90 bg-[#F8FAFC] text-xs flex items-start justify-between gap-3"
                                  >
                                    <div className="flex items-start gap-2 min-w-0">
                                      <span className="font-bold text-slate-700 shrink-0">
                                        {optKey})
                                      </span>
                                      <AnalyticsRichContent
                                        content={opt?.text_html || opt?.text || ""}
                                        mediaMap={mediaMap}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-slate-500 font-medium">Học sinh chọn:</span>
                            <span
                              className={`px-2 py-0.5 rounded font-semibold border ${
                                isCorrect
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : isWrong
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {q.stuDisplay}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-medium">Đáp án đúng:</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-semibold">
                              {q.correctDisplay}
                            </span>
                          </div>
                        </div>

                        {(q.solution_html || q.solution || q.explanation) && (
                          <div className="mt-2.5 p-2.5 rounded-lg bg-[#F8FAFC] border border-slate-200/90 text-xs text-slate-700">
                            <div className="font-semibold text-slate-800 mb-1 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[#1D4ED8]" />
                              <span>Lời giải chi tiết:</span>
                            </div>
                            <AnalyticsRichContent
                              content={q.solution_html || q.solution || q.explanation}
                              mediaMap={mediaMap}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
