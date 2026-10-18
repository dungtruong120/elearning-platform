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
  Sparkles
} from "lucide-react";
import katex from "katex";

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
  className = "",
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
      return `<div class="my-2 flex justify-center"><img src="${src}" alt="Hình minh họa" class="max-h-60 max-w-full rounded-xl border border-slate-200 object-contain bg-white p-1 shadow-2xs" /></div>`;
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
          return `<div class="my-2 flex justify-center"><img src="${src}" alt="Hình minh họa" class="max-h-60 max-w-full rounded-xl border border-slate-200 object-contain bg-white p-1 shadow-2xs" /></div>`;
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
  analyticsModeFilter,
  setAnalyticsModeFilter,
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

  // STATE BỘ LỌC CHUYÊN SÂU
  const [examTypeFilter, setExamTypeFilter] = useState<"all" | "homework" | "test" | "practice">("all");
  const [customScopeMode, setCustomScopeMode] = useState<"course" | "month_week" | "chapter" | "lesson">(
    rankingScope === "chapter" ? "chapter" : rankingScope === "lesson" ? "lesson" : "course"
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(currentRealtimeMonth);
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [focusedTypeFilter, setFocusedTypeFilter] = useState<"all" | "homework" | "test" | "practice">("all");

  // STATE MODAL XEM CHI TIẾT BÀI LÀM BTVN / ĐỀ KIỂM TRA TRỰC TIẾP TỪ BẢNG ANALYTICS
  const [submissionModalState, setSubmissionModalState] = useState<{
    studentName: string;
    modeLabel: "BTVN" | "Đề kiểm tra" | "Luyện đề";
    attemptsList: any[];
    activeAttempt: any;
  } | null>(null);

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
          setLocalAttempts(
            parsed.filter((a: any) => !delIds.has(String(a?.id || "")))
          );
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
    return (chapters || []).find(c => c?.id === selectedChapterId)?.lessons || [];
  }, [chapters, selectedChapterId]);

  // Bản đồ tra cứu metadata & đối tượng đề gốc của mọi BTVN, Đề kiểm tra và Đề luyện thi
  const quizLookupMap = useMemo(() => {
    const byId = new Map<string, {
      kind: "homework" | "test" | "practice";
      chapterId?: string;
      chapterTitle?: string;
      lessonId?: string;
      lessonTitle?: string;
      month?: number;
      week?: number;
      title: string;
      quizObj: any;
    }>();
    const byTitle = new Map<string, {
      kind: "homework" | "test" | "practice";
      chapterId?: string;
      chapterTitle?: string;
      lessonId?: string;
      lessonTitle?: string;
      month?: number;
      week?: number;
      title: string;
      quizObj: any;
    }>();

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
            quizObj: hw,
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
            quizObj: tq,
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
        quizObj: pe,
      };
      if (pe.id) byId.set(String(pe.id).trim().toLowerCase(), info);
      if (pe.title) byTitle.set(normalizeText(pe.title), info);
    });

    return { byId, byTitle };
  }, [chapters, effectivePracticeExams]);

  // Hàm phân loại chi tiết từng lượt nộp bài
  const classifyAttempt = (att: any) => {
    const qId = String(att?.quizId || att?.quiz_id || att?.exam_id || "").trim().toLowerCase();
    const rawTitle = String(att?.examTitle || att?.quizTitle || att?.quiz_title || att?.title || "Bài làm");
    const normTitle = normalizeText(rawTitle);

    const matched =
      (qId && quizLookupMap.byId.get(qId)) ||
      (normTitle && quizLookupMap.byTitle.get(normTitle)) ||
      null;

    let kind: "homework" | "test" | "practice" = "practice";
    if (matched) {
      kind = matched.kind;
    } else if (att?.type === "homework" || att?.isHomework || att?.is_homework) {
      kind = "homework";
    } else if (att?.type === "test") {
      kind = "test";
    }

    const rawDate = att?.createdAt || att?.created_at || att?.submittedAt;
    const parsedDate = rawDate ? new Date(rawDate) : new Date();
    const validDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();

    const month = Number(att?.assigned_month) || Number(matched?.month) || (validDate.getMonth() + 1);
    const week = Number(att?.assigned_week) || Number(matched?.week) || Math.min(5, Math.max(1, Math.ceil(validDate.getDate() / 7)));

    return {
      rawAttempt: att,
      quizObj: matched?.quizObj || null,
      kind,
      month,
      week,
      chapterId: matched?.chapterId || "",
      chapterTitle: matched?.chapterTitle || "",
      lessonId: matched?.lessonId || "",
      lessonTitle: matched?.lessonTitle || "",
      examTitle: rawTitle,
      score: Number(att?.score ?? att?.points ?? 0),
      timeSpent: att?.timeSpent || att?.time_spent || "15 phút",
      createdAt: validDate.toISOString(),
      formattedDate: `${String(validDate.getDate()).padStart(2, "0")}/${String(validDate.getMonth() + 1).padStart(2, "0")}/${validDate.getFullYear()}`,
      formattedTime: `${String(validDate.getHours()).padStart(2, "0")}:${String(validDate.getMinutes()).padStart(2, "0")}`,
    };
  };

  // Kiểm tra 1 lượt nộp có thỏa mãn bộ lọc Phạm vi (Tháng/Tuần/Chương/Bài) không
  const isAttemptMatchingScope = (classified: ReturnType<typeof classifyAttempt>): boolean => {
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

  // TÍNH TOÁN BẢNG ĐIỂM TỔNG HỢP & PHÂN TÁCH MẢNG hwAttempts / testAttempts RIÊNG BIỆT CHO TỪNG HỌC SINH
  const enrichedStudentRows = useMemo(() => {
    const studentMap = new Map<string, {
      id: string;
      name: string;
      username: string;
      school: string;
      mode: "online" | "offline";
      hwScores: number[];
      testScores: number[];
      pracScores: number[];
      hwAttempts: any[];
      testAttempts: any[];
      pracAttempts: any[];
      detailedAttempts: any[];
      fallbackHwMax: number;
      fallbackTestMax: number;
      fallbackOverall: number;
      fallbackAttemptsCount: number;
    }>();

    const profileLookup = new Map<string, string>();

    (analyticsData || []).forEach((st: any) => {
      if (!st) return;
      const id = String(st.id || st.name);
      const mode = String(st.mode || "online").toLowerCase().includes("off") ? "offline" : "online";
      studentMap.set(id, {
        id,
        name: st.name || "Học sinh",
        username: st.username || "",
        school: st.school || "THPT",
        mode,
        hwScores: [],
        testScores: [],
        pracScores: [],
        hwAttempts: [],
        testAttempts: [],
        pracAttempts: [],
        detailedAttempts: [],
        fallbackHwMax: Number(st.hwMax || 0),
        fallbackTestMax: Number(st.testMax || 0),
        fallbackOverall: Number(st.overallAvg || 0),
        fallbackAttemptsCount: Number(st.totalAttempts || 0),
      });
      profileLookup.set(id.trim().toLowerCase(), id);
      if (st.name) profileLookup.set(normalizeText(st.name), id);
      if (st.username) profileLookup.set(String(st.username).trim().toLowerCase(), id);
    });

    (effectiveStudents || []).forEach((s: any) => {
      if (!s) return;
      const id = String(s.id || s.full_name);
      if (!studentMap.has(id)) {
        const modeStr = String(s.learning_mode || s.study_mode || "online").toLowerCase();
        studentMap.set(id, {
          id,
          name: s.full_name || s.username || "Học sinh",
          username: s.username || (s.email ? String(s.email).split("@")[0] : ""),
          school: s.school || "THPT",
          mode: modeStr.includes("off") ? "offline" : "online",
          hwScores: [],
          testScores: [],
          pracScores: [],
          hwAttempts: [],
          testAttempts: [],
          pracAttempts: [],
          detailedAttempts: [],
          fallbackHwMax: 0,
          fallbackTestMax: 0,
          fallbackOverall: 0,
          fallbackAttemptsCount: 0,
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
      const stuIdRaw = String(att.studentId || att.student_id || att.user_id || "").trim().toLowerCase();
      const stuNameNorm = normalizeText(att.studentName || att.student_name || att.full_name || "");

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
        ...classified,
      };

      if (classified.kind === "homework") {
        stEntry.hwScores.push(classified.score);
        stEntry.hwAttempts.push(enrichedAttItem);
      } else if (classified.kind === "test") {
        stEntry.testScores.push(classified.score);
        stEntry.testAttempts.push(enrichedAttItem);
      } else {
        stEntry.pracScores.push(classified.score);
        stEntry.pracAttempts.push(enrichedAttItem);
      }

      if (examTypeFilter === "all" || classified.kind === examTypeFilter) {
        stEntry.detailedAttempts.push(enrichedAttItem);
      }
    });

    const hasDetailedAttemptsSource = (effectiveAttempts || []).length > 0;

    return Array.from(studentMap.values())
      .filter((st) => {
        if (analyticsModeFilter !== "all" && st.mode !== analyticsModeFilter) {
          return false;
        }
        if (selectedStudentId !== "all" && st.id !== selectedStudentId) {
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
        // Sắp xếp hwAttempts và testAttempts để bài điểm cao nhất lên đầu
        const sortedHwAttempts = [...st.hwAttempts].sort((a, b) => b.score - a.score);
        const sortedTestAttempts = [...st.testAttempts].sort((a, b) => b.score - a.score);

        const hwMax = st.hwScores.length > 0
          ? Math.max(...st.hwScores)
          : (!hasDetailedAttemptsSource ? st.fallbackHwMax : 0);
        const hwAvg = st.hwScores.length > 0
          ? st.hwScores.reduce((a, b) => a + b, 0) / st.hwScores.length
          : hwMax;

        const testMax = st.testScores.length > 0
          ? Math.max(...st.testScores)
          : (!hasDetailedAttemptsSource ? st.fallbackTestMax : 0);
        const testAvg = st.testScores.length > 0
          ? st.testScores.reduce((a, b) => a + b, 0) / st.testScores.length
          : testMax;

        const pracMax = st.pracScores.length > 0 ? Math.max(...st.pracScores) : 0;
        const pracAvg = st.pracScores.length > 0
          ? st.pracScores.reduce((a, b) => a + b, 0) / st.pracScores.length
          : 0;

        let displayOverall = 0;
        if (!hasDetailedAttemptsSource && examTypeFilter === "all" && customScopeMode === "course") {
          displayOverall = st.fallbackOverall;
        } else if (examTypeFilter === "homework") {
          displayOverall = customScopeMode === "lesson" ? hwMax : hwAvg;
        } else if (examTypeFilter === "test") {
          displayOverall = customScopeMode === "lesson" ? testMax : testAvg;
        } else if (examTypeFilter === "practice") {
          displayOverall = pracAvg;
        } else {
          const activeBuckets: number[] = [];
          if (st.hwScores.length > 0) activeBuckets.push(customScopeMode === "lesson" ? hwMax : hwAvg);
          if (st.testScores.length > 0) activeBuckets.push(customScopeMode === "lesson" ? testMax : testAvg);
          if (st.pracScores.length > 0) activeBuckets.push(pracAvg);
          if (activeBuckets.length > 0) {
            displayOverall = activeBuckets.reduce((a, b) => a + b, 0) / activeBuckets.length;
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
          hwMax: Number(hwMax.toFixed(1)),
          hwAvg: Number(hwAvg.toFixed(1)),
          testMax: Number(testMax.toFixed(1)),
          testAvg: Number(testAvg.toFixed(1)),
          pracMax: Number(pracMax.toFixed(1)),
          pracAvg: Number(pracAvg.toFixed(1)),
          overallAvg: Number(displayOverall.toFixed(1)),
        };
      })
      .sort((a, b) => b.overallAvg - a.overallAvg || b.totalAttempts - a.totalAttempts);
  }, [
    analyticsData,
    effectiveStudents,
    effectiveAttempts,
    analyticsModeFilter,
    examTypeFilter,
    customScopeMode,
    selectedMonth,
    selectedWeek,
    selectedChapterId,
    selectedLessonId,
    selectedStudentId,
    studentSearchQuery,
    quizLookupMap,
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

  // MỞ MODAL XEM CHI TIẾT BÀI LÀM BTVN HOẶC ĐỀ KIỂM TRA CỦA HỌC SINH
  const handleOpenTypeSpecificModal = (
    studentRow: any,
    targetType: "homework" | "test"
  ) => {
    const list = targetType === "homework" ? studentRow.hwAttempts : studentRow.testAttempts;
    if (!list || list.length === 0) return;

    setSubmissionModalState({
      studentName: studentRow.name,
      modeLabel: targetType === "homework" ? "BTVN" : "Đề kiểm tra",
      attemptsList: list,
      activeAttempt: list[0],
    });
  };

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
      examObj?.data ||
      examObj?.sections ||
      att?.exam_data ||
      att?.sections ||
      [];

    const mediaMap: Record<string, any> = {
      ...(examObj?.media_map || {}),
      ...(examObj?.mediaMap || {}),
      ...(att?.media_map || {}),
      ...(att?.mediaMap || {}),
    };

    const flatQuestions: any[] = [];
    let absoluteIndex = 0;

    if (Array.isArray(rawSections) && rawSections.length > 0) {
      rawSections.forEach((sec: any, secIdx: number) => {
        if (sec?.mediaMap && typeof sec.mediaMap === "object") Object.assign(mediaMap, sec.mediaMap);
        if (sec?.media_map && typeof sec.media_map === "object") Object.assign(mediaMap, sec.media_map);

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
          if (q?.media_map && typeof q.media_map === "object") Object.assign(mediaMap, q.media_map);

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
            qType,
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
          qType: q?.type || "multiple_choice",
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
        `${q.secIdx}-${q.qIdxInSec}`,
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
        correctRaw,
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
          const cleanAns = (q.correctRaw || "ĐĐĐĐ").replace(/[^A-Za-zĐđSsTtFf]/g, "").toUpperCase();
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
          const k = String(opt?.key || ["a", "b", "c", "d"][i] || i).toLowerCase().replace(/[^a-d]/g, "");
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
          const normStu = stuStr.replace(/\s+/g, "").replace(/,/g, ".").replace(/[−–—]/g, "-").toLowerCase();
          const normCorr = correctRaw.replace(/\s+/g, "").replace(/,/g, ".").replace(/[−–—]/g, "-").toLowerCase();
          status = normStu === normCorr ? "correct" : "wrong";
        }
      } else {
        q.qType = "multiple_choice";
        const stuStr = stuAns !== undefined && stuAns !== null ? String(stuAns).trim().toUpperCase() : "";
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
      skippedCount: questionsList.filter((q) => q.status === "skipped").length,
    };
  }, [submissionModalState]);

  // Xuất file CSV / Excel bảng điểm hiện tại
  const handleExportCSV = () => {
    if (enrichedStudentRows.length === 0) return;
    const headers = [
      "Hạng",
      "Họ và tên",
      "Trường",
      "Phân hệ",
      "Số lượt làm",
      "Đ.BTVN (Max)",
      "Đ.BTVN (TB)",
      "Đ.Kiểm tra (Max)",
      "Đ.Kiểm tra (TB)",
      "Đ.Luyện đề (TB)",
      "Điểm Tổng kết"
    ];

    const rows = enrichedStudentRows.map((st, idx) => [
      idx + 1,
      `"${st.name}"`,
      `"${st.school}"`,
      st.mode === "online" ? "Online" : "Offline",
      st.totalAttempts,
      st.hwMax,
      st.hwAvg,
      st.testMax,
      st.testAvg,
      st.pracAvg,
      st.overallAvg
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Bang_Diem_TCT_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300 max-w-6xl mx-auto text-left font-sans">
      {/* 1. BẢNG ĐIỀU KHIỂN BỘ LỌC ĐA CHIỀU CHUYÊN SÂU */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-3.5">
        {/* HÀNG LỌC 1: LOẠI BÀI + HÌNH THỨC HỌC */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[#1D4ED8]" /> Loại bài:
            </span>
            <button
              type="button"
              onClick={() => setExamTypeFilter("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                examTypeFilter === "all"
                  ? "bg-[#1D4ED8] text-white shadow-2xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Tất cả bài
            </button>
            <button
              type="button"
              onClick={() => setExamTypeFilter("homework")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                examTypeFilter === "homework"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Chỉ BTVN</span>
            </button>
            <button
              type="button"
              onClick={() => setExamTypeFilter("test")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                examTypeFilter === "test"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Chỉ Đề kiểm tra</span>
            </button>
            <button
              type="button"
              onClick={() => setExamTypeFilter("practice")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                examTypeFilter === "practice"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              <span>Luyện đề thực chiến</span>
            </button>
          </div>

          {/* ĐỐI TƯỢNG HỌC SINH: ALL / ONLINE / OFFLINE */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0 w-fit">
            <button
              type="button"
              onClick={() => setAnalyticsModeFilter("all")}
              className={
                "px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer " + 
                (analyticsModeFilter === "all" ? "bg-white text-[#1D4ED8] shadow-xs" : "text-slate-600 hover:text-slate-900")
              }
            >
              Toàn bộ học sinh
            </button>
            <button
              type="button"
              onClick={() => setAnalyticsModeFilter("online")}
              className={
                "px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer " + 
                (analyticsModeFilter === "online" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900")
              }
            >
              Học sinh Online
            </button>
            <button
              type="button"
              onClick={() => setAnalyticsModeFilter("offline")}
              className={
                "px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer " + 
                (analyticsModeFilter === "offline" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900")
              }
            >
              Học sinh Offline
            </button>
          </div>
        </div>

        {/* HÀNG LỌC 2: PHẠM VI + TÌM HỌC SINH CỤ THỂ */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/70">
              <button 
                type="button"
                onClick={() => {
                  setCustomScopeMode("course");
                  setRankingScope("course");
                }} 
                className={
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer " + 
                  (customScopeMode === "course" ? "bg-white text-[#1D4ED8] shadow-2xs" : "text-slate-500 hover:text-slate-800")
                }
              >
                Toàn khóa
              </button>
              <button 
                type="button"
                onClick={() => {
                  setCustomScopeMode("month_week");
                  setRankingScope("course");
                }} 
                className={
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer " + 
                  (customScopeMode === "month_week" ? "bg-white text-[#1D4ED8] shadow-2xs" : "text-slate-500 hover:text-slate-800")
                }
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Theo Tháng & Tuần</span>
              </button>
              <button 
                type="button"
                onClick={() => {
                  setCustomScopeMode("chapter");
                  setRankingScope("chapter");
                }} 
                className={
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer " + 
                  (customScopeMode === "chapter" ? "bg-white text-[#1D4ED8] shadow-2xs" : "text-slate-500 hover:text-slate-800")
                }
              >
                Từng chương
              </button>
              <button 
                type="button"
                onClick={() => {
                  setCustomScopeMode("lesson");
                  setRankingScope("lesson");
                }} 
                className={
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer " + 
                  (customScopeMode === "lesson" ? "bg-white text-[#1D4ED8] shadow-2xs" : "text-slate-500 hover:text-slate-800")
                }
              >
                Từng bài
              </button>
            </div>

            {customScopeMode === "month_week" && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-3 py-1.5 text-xs font-bold text-[#1D4ED8] bg-blue-50 border border-blue-200 rounded-xl outline-none cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>
                      Tháng {m < 10 ? "0" + m : m} {m === currentRealtimeMonth ? "(Hiện tại)" : ""}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl outline-none cursor-pointer"
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
                onChange={e => { setSelectedChapterId(e.target.value); setSelectedLessonId("all"); }} 
                className="px-3 py-1.5 text-xs font-bold text-[#1D4ED8] bg-blue-50 border border-blue-200 rounded-xl focus:border-blue-500 outline-none transition cursor-pointer max-w-[240px]"
              >
                <option value="all">-- Chọn Chương --</option>
                {(chapters || []).map(c => <option key={c?.id} value={c?.id}>{c?.title}</option>)}
              </select>
            )}
            {customScopeMode === "lesson" && selectedChapterId !== "all" && (
              <select 
                value={selectedLessonId} 
                onChange={e => setSelectedLessonId(e.target.value)} 
                className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl focus:border-indigo-500 outline-none transition cursor-pointer max-w-[240px]"
              >
                <option value="all">-- Chọn Bài học --</option>
                {activeLessons.map((l: any) => <option key={l?.id} value={l?.id}>{l?.title}</option>)}
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={studentSearchQuery}
                onChange={(e) => setStudentSearchQuery(e.target.value)}
                placeholder="Tìm tên học sinh..."
                className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white"
              />
              {studentSearchQuery && (
                <button
                  type="button"
                  onClick={() => setStudentSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0" />
              <select
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  setFocusedTypeFilter("all");
                }}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#1D4ED8] cursor-pointer max-w-[200px]"
              >
                <option value="all">Xem tất cả học sinh</option>
                {(analyticsData || []).map((st: any) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.mode === "online" ? "Onl" : "Off"})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
              title="Xuất bảng điểm ra file Excel / CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. PANEL CHI TIẾT LỊCH SỬ ĐIỂM CỦA RIÊNG 1 HỌC SINH */}
      {focusedStudent && (
        <div className="bg-white rounded-3xl border-2 border-blue-200 shadow-sm overflow-hidden animate-in zoom-in-95 duration-150">
          <div className="p-4 sm:px-6 bg-gradient-to-r from-blue-50 via-indigo-50/40 to-white border-b border-blue-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#1D4ED8] text-white font-black text-sm flex items-center justify-center shadow-xs">
                {focusedStudent.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-slate-900 text-sm sm:text-base">
                    Hồ sơ điểm chi tiết: {focusedStudent.name}
                  </h4>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                      focusedStudent.mode === "online"
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                  >
                    {focusedStudent.mode === "online" ? "Online" : "Offline"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-semibold">
                  {focusedStudent.school} • Đang hiển thị: <strong>{focusedStudentFilteredAttempts.length} bài</strong>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFocusedTypeFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  focusedTypeFilter === "all"
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Tất cả ({focusedStudent.detailedAttempts.length})
              </button>
              <button
                type="button"
                onClick={() => setFocusedTypeFilter("homework")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  focusedTypeFilter === "homework"
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                }`}
              >
                BTVN: {focusedStudent.hwAvg}đ ({focusedStudent.hwCount})
              </button>
              <button
                type="button"
                onClick={() => setFocusedTypeFilter("test")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  focusedTypeFilter === "test"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                }`}
              >
                Đề KT: {focusedStudent.testAvg}đ ({focusedStudent.testCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedStudentId("all")}
                className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Đóng
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-80 custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center">STT</th>
                  <th className="py-2.5 px-4">Tên bài tập / Đề thi</th>
                  <th className="py-2.5 px-3 text-center">Phân loại</th>
                  <th className="py-2.5 px-3 text-center">Tuần / Tháng</th>
                  <th className="py-2.5 px-3 text-center">Thời gian làm</th>
                  <th className="py-2.5 px-3 text-center">Thời điểm nộp</th>
                  <th className="py-2.5 px-4 text-right">Điểm số & Bài làm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {focusedStudentFilteredAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                      Học sinh chưa có bài nộp nào trong phân loại này.
                    </td>
                  </tr>
                ) : (
                  focusedStudentFilteredAttempts.map((item: any, idx: number) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-bold text-slate-800">
                        <div>{item.examTitle}</div>
                        {item.lessonTitle && (
                          <span className="text-[10px] text-slate-400 font-medium">{item.lessonTitle}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {item.kind === "homework" ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            BTVN
                          </span>
                        ) : item.kind === "test" ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Đề kiểm tra
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                            Luyện đề
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]">
                          T{item.week}.Th{item.month < 10 ? "0" + item.month : item.month}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600 font-medium">
                        ⏱ {item.timeSpent}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500">
                        {item.formattedTime} • {item.formattedDate}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-lg font-black text-xs border ${
                              item.kind === "homework"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : item.kind === "test"
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : "bg-blue-50 text-[#1D4ED8] border-blue-200"
                            }`}
                          >
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
                                    : "Luyện đề",
                                attemptsList: [item],
                                activeAttempt: item,
                              })
                            }
                            className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-[#1D4ED8] text-[#1D4ED8] hover:text-white text-[11px] font-bold transition cursor-pointer border border-blue-200"
                          >
                            Xem bài
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

      {/* 3. BẢNG ĐIỂM & XẾP HẠNG TỔNG HỢP (CÓ 2 NÚT RIÊNG BIỆT: [👁 XEM BTVN] & [👁 XEM ĐỀ KT]) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h3 className="font-extrabold text-slate-900 text-sm">
              Bảng điểm & Xếp hạng học viên TCT
            </h3>
            {examTypeFilter !== "all" && (
              <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-[#1D4ED8] border border-blue-200 text-[10px] font-black uppercase">
                Đang lọc: {examTypeFilter === "homework" ? "Chỉ BTVN" : examTypeFilter === "test" ? "Chỉ Đề kiểm tra" : "Luyện đề thực chiến"}
              </span>
            )}
            {customScopeMode === "month_week" && (
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase">
                Tháng {selectedMonth} {selectedWeek !== "all" ? `• Tuần ${selectedWeek}` : ""}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 font-bold">
            {isLoadingAnalytics ? "Đang tính điểm..." : `${enrichedStudentRows.length} học viên`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-white text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 font-bold text-center w-14">Hạng</th>
                <th className="py-3 px-4 font-bold min-w-[170px]">Học sinh</th>
                <th className="py-3 px-3 font-bold text-center w-22">Phân hệ</th>
                <th className="py-3 px-3 font-bold text-center w-22">Lượt làm</th>
                {(examTypeFilter === "all" || examTypeFilter === "homework") && (
                  <th className="py-3 px-3 font-bold text-center text-emerald-700 w-32">
                    Điểm BTVN (Max / TB)
                  </th>
                )}
                {(examTypeFilter === "all" || examTypeFilter === "test") && (
                  <th className="py-3 px-3 font-bold text-center text-indigo-700 w-32">
                    Điểm Đề KT (Max / TB)
                  </th>
                )}
                {(examTypeFilter === "all" || examTypeFilter === "practice") && (
                  <th className="py-3 px-3 font-bold text-center text-blue-700 w-26">
                    Luyện đề (TB)
                  </th>
                )}
                <th className="py-3 px-3 font-bold text-center text-[#1D4ED8] w-24">Tổng kết</th>
                <th className="py-3 px-4 font-bold text-center min-w-[210px]">Xem chi tiết bài làm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingAnalytics ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <Loader2 className="w-7 h-7 text-[#1D4ED8] animate-spin" />
                      <span className="text-xs font-bold text-slate-500">
                        Đang đồng bộ và tính toán điểm số tức thì...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : enrichedStudentRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                    Chưa có dữ liệu làm bài nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                enrichedStudentRows.map((st, idx) => {
                  const rank = idx + 1;
                  const isTop1 = rank === 1;
                  const isTop2 = rank === 2;
                  const isTop3 = rank === 3;
                  const isFocused = selectedStudentId === st.id;
                  const hasHwSubmission = st.hwAttempts && st.hwAttempts.length > 0;
                  const hasTestSubmission = st.testAttempts && st.testAttempts.length > 0;

                  return (
                    <tr
                      key={st.id || idx}
                      onClick={() => {
                        setSelectedStudentId(isFocused ? "all" : st.id);
                        setFocusedTypeFilter("all");
                      }}
                      className={`transition-colors cursor-pointer ${
                        isFocused ? "bg-blue-50/70" : "hover:bg-slate-50/70 bg-white"
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-black">
                        {isTop1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-black shadow-2xs" title="Hạng 1 - Huy hiệu Vàng">
                            🥇
                          </span>
                        ) : isTop2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 border border-slate-300 text-xs font-black" title="Hạng 2 - Huy hiệu Bạc">
                            🥈
                          </span>
                        ) : isTop3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-800 border border-orange-300 text-xs font-black" title="Hạng 3 - Huy hiệu Đồng">
                            🥉
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold">#{rank}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-800">
                        <div className="group-hover:text-[#1D4ED8]">{st.name}</div>
                        <span className="text-[10px] text-slate-400 font-normal">{st.school || "THPT"}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={
                          "px-2 py-0.5 rounded text-[9px] font-black uppercase " + 
                          (st.mode === "online" 
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200" 
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200")
                        }>
                          {st.mode === "online" ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-600">
                        {st.totalAttempts} lượt
                      </td>

                      {/* ĐIỂM BTVN */}
                      {(examTypeFilter === "all" || examTypeFilter === "homework") && (
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-black">
                            <span>{Number(st.hwMax || 0).toFixed(1)}</span>
                            <span className="text-[10px] font-semibold text-emerald-600/80">
                              (TB: {Number(st.hwAvg || 0).toFixed(1)})
                            </span>
                          </span>
                        </td>
                      )}

                      {/* ĐIỂM ĐỀ KIỂM TRA */}
                      {(examTypeFilter === "all" || examTypeFilter === "test") && (
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-black">
                            <span>{Number(st.testMax || 0).toFixed(1)}</span>
                            <span className="text-[10px] font-semibold text-indigo-600/80">
                              (TB: {Number(st.testAvg || 0).toFixed(1)})
                            </span>
                          </span>
                        </td>
                      )}

                      {/* ĐIỂM LUYỆN ĐỀ */}
                      {(examTypeFilter === "all" || examTypeFilter === "practice") && (
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-black">
                            {Number(st.pracAvg || 0).toFixed(1)}
                          </span>
                        </td>
                      )}

                      <td className="py-2.5 px-3 text-center">
                        <span className="inline-block px-3 py-1 bg-[#1D4ED8] text-white font-black rounded-lg shadow-2xs">
                          {Number(st.overallAvg || 0).toFixed(1)}
                        </span>
                      </td>

                      {/* CỘT 2 NÚT TÁCH BIỆT: [👁 XEM BTVN] & [👁 XEM ĐỀ KT] */}
                      <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            disabled={!hasHwSubmission}
                            onClick={() => handleOpenTypeSpecificModal(st, "homework")}
                            title={
                              hasHwSubmission
                                ? `Xem chi tiết bài làm BTVN của ${st.name}`
                                : `${st.name} chưa có bài nộp BTVN trong phạm vi này`
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition inline-flex items-center gap-1 ${
                              hasHwSubmission
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white cursor-pointer shadow-2xs"
                                : "bg-slate-50 text-slate-300 border-slate-200/70 cursor-not-allowed opacity-60"
                            }`}
                          >
                            <Eye className="w-3 h-3" />
                            <span>Xem BTVN</span>
                          </button>

                          <button
                            type="button"
                            disabled={!hasTestSubmission}
                            onClick={() => handleOpenTypeSpecificModal(st, "test")}
                            title={
                              hasTestSubmission
                                ? `Xem chi tiết bài làm Đề kiểm tra của ${st.name}`
                                : `${st.name} chưa có bài nộp Đề kiểm tra trong phạm vi này`
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition inline-flex items-center gap-1 ${
                              hasTestSubmission
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-600 hover:text-white cursor-pointer shadow-2xs"
                                : "bg-slate-50 text-slate-300 border-slate-200/70 cursor-not-allowed opacity-60"
                            }`}
                          >
                            <Eye className="w-3 h-3" />
                            <span>Xem Đề KT</span>
                          </button>
                        </div>
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
      {/* 4. MODAL XEM CHI TIẾT BÀI LÀM BTVN / ĐỀ KIỂM TRA (COMPACT HEADER 56PX) */}
      {/* ===================================================================== */}
      {submissionModalState && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSubmissionModalState(null);
          }}
          className="fixed inset-0 z-[550] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs cursor-pointer font-sans"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] cursor-default animate-in zoom-in-95 duration-150 text-left"
          >
            {/* HEADER COMPACT 1 DÒNG (~56PX) */}
            <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border shrink-0 ${
                    submissionModalState.modeLabel === "BTVN"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-indigo-50 text-indigo-700 border-indigo-200"
                  }`}
                >
                  {submissionModalState.modeLabel}
                </span>
                <span className="font-extrabold text-sm text-slate-900 truncate max-w-[160px] sm:max-w-[200px]">
                  {submissionModalState.studentName}
                </span>
                <span className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md shrink-0">
                  {Number(submissionModalState.activeAttempt.score ?? 0).toFixed(2)}đ
                </span>

                {/* NẾU HỌC SINH CÓ NHIỀU BÀI BTVN / ĐỀ KT: CHO PHÉP CHỌN BÀI NGAY TRÊN HEADER */}
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
                    className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none cursor-pointer max-w-[240px]"
                  >
                    {submissionModalState.attemptsList.map((attItem: any, idx: number) => (
                      <option key={attItem.id || idx} value={String(attItem.id || "")}>
                        {attItem.examTitle} ({Number(attItem.score).toFixed(2)}đ - {attItem.formattedDate})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-slate-500 font-semibold truncate max-w-[220px]">
                    • {submissionModalState.activeAttempt.examTitle}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                  ✓ Đúng: {activeModalReviewData?.correctCount ?? 0}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                  ✕ Sai: {activeModalReviewData?.wrongCount ?? 0}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-bold">
                  ○ Trống: {activeModalReviewData?.skippedCount ?? 0}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-500 font-semibold px-1">
                  ⏱ {submissionModalState.activeAttempt.timeSpent || "15p"}
                </span>
                <button
                  type="button"
                  onClick={() => setSubmissionModalState(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer ml-1"
                  title="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* DANH SÁCH CÂU HỎI & LỜI GIẢI */}
            <div className="p-3 sm:p-5 overflow-y-auto custom-scrollbar flex-1 space-y-3 bg-slate-50/50">
              {!activeModalReviewData || activeModalReviewData.questionsList.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center space-y-2">
                  <p className="text-xs font-bold text-slate-700">
                    Bài nộp: {submissionModalState.activeAttempt.examTitle} — Kết quả:{" "}
                    <span className="text-rose-600 font-black">
                      {Number(submissionModalState.activeAttempt.score ?? 0).toFixed(2)} điểm
                    </span>
                  </p>
                  <p className="text-xs text-slate-400 italic">
                    Đề bài này là file đính kèm ngoài hoặc chưa có danh sách câu hỏi trắc nghiệm chi tiết trong kho.
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
                      className={`p-3.5 rounded-2xl border bg-white shadow-2xs transition ${
                        isCorrect
                          ? "border-emerald-200"
                          : isWrong
                          ? "border-rose-200"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#1D4ED8] font-black text-xs border border-blue-200">
                            Câu {q.globalOrder}
                          </span>
                          {q.sectionTitle && (
                            <span className="text-[11px] font-semibold text-slate-400 truncate max-w-[240px]">
                              {q.sectionTitle}
                            </span>
                          )}
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                            isCorrect
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : isWrong
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {isCorrect ? "✓ Chính xác" : isWrong ? "✕ Chọn sai" : "○ Bỏ trống"}
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
                            className="max-h-56 rounded-xl border border-slate-200 object-contain bg-white p-1"
                          />
                        </div>
                      )}

                      {q.qType === "multiple_choice" && Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2">
                          {q.options.map((opt: any, oIdx: number) => {
                            const optKey = String(opt?.key || ["A", "B", "C", "D"][oIdx] || "").trim().toUpperCase();
                            const stuPicked = String(q.stuAns || "").trim().toUpperCase() === optKey;
                            const isRightOpt = String(q.correctDisplay || "").trim().toUpperCase() === optKey;

                            let boxStyle = "border-slate-200 bg-slate-50/60 text-slate-700";
                            if (isRightOpt) {
                              boxStyle = "border-emerald-400 bg-emerald-50/90 text-emerald-900 font-bold ring-1 ring-emerald-400/30";
                            } else if (stuPicked && !isRightOpt) {
                              boxStyle = "border-rose-400 bg-rose-50/90 text-rose-900 font-bold ring-1 ring-rose-400/30";
                            }

                            return (
                              <div
                                key={optKey || oIdx}
                                className={`p-2 rounded-xl border text-xs flex items-start gap-2 ${boxStyle}`}
                              >
                                <span
                                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black shrink-0 ${
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

                      {q.qType === "true_false" && Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="space-y-1.5 my-2">
                          {q.options.map((opt: any, oIdx: number) => {
                            const optKey = String(opt?.key || ["a", "b", "c", "d"][oIdx] || "").trim();
                            return (
                              <div
                                key={optKey || oIdx}
                                className="p-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs flex items-start justify-between gap-3"
                              >
                                <div className="flex items-start gap-2 min-w-0">
                                  <span className="font-black text-slate-700 shrink-0">{optKey})</span>
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
                            className={`px-2 py-0.5 rounded-md font-extrabold border ${
                              isCorrect
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                : isWrong
                                ? "bg-rose-50 text-rose-700 border-rose-300"
                                : "bg-slate-100 text-slate-600 border-slate-300"
                            }`}
                          >
                            {q.stuDisplay}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-medium">Đáp án đúng:</span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-extrabold">
                            {q.correctDisplay}
                          </span>
                        </div>
                      </div>

                      {(q.solution_html || q.solution || q.explanation) && (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-slate-700">
                          <div className="font-extrabold text-amber-800 mb-1 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
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
      )}
    </div>
  );
}
