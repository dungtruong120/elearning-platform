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
  Clock
} from "lucide-react";

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

  // Bản đồ tra cứu metadata của mọi BTVN, Đề kiểm tra và Đề luyện thi
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
            title: hw.title || "BTVN"
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
            title: tq.title || "Đề kiểm tra"
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
        title: pe.title || "Đề luyện thi"
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

  // Kiểm tra 1 lượt nộp có thỏa mãn bộ lọc hiện tại không
  const isAttemptMatchingFilters = (classified: ReturnType<typeof classifyAttempt>): boolean => {
    // 1. Lọc theo loại bài
    if (examTypeFilter !== "all" && classified.kind !== examTypeFilter) {
      return false;
    }

    // 2. Lọc theo phạm vi
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

  // TÍNH TOÁN BẢNG ĐIỂM TỔNG HỢP & LỊCH SỬ CHI TIẾT TỪNG HỌC SINH
  const enrichedStudentRows = useMemo(() => {
    // Tạo danh sách học sinh nền từ analyticsData + effectiveStudents
    const studentMap = new Map<string, {
      id: string;
      name: string;
      username: string;
      school: string;
      mode: "online" | "offline";
      hwScores: number[];
      testScores: number[];
      pracScores: number[];
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

    // Phân bổ các lượt nộp bài vào đúng học sinh
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
      if (!isAttemptMatchingFilters(classified)) return;

      const stEntry = studentMap.get(targetStudentId)!;
      stEntry.detailedAttempts.push({
        id: att.id || `att-${ stEntry.detailedAttempts.length}`,
        ...classified,
      });

      if (classified.kind === "homework") {
        stEntry.hwScores.push(classified.score);
      } else if (classified.kind === "test") {
        stEntry.testScores.push(classified.score);
      } else {
        stEntry.pracScores.push(classified.score);
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
          // Tất cả loại bài
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

  // Học sinh đang được chọn để xem bảng chi tiết cá nhân
  const focusedStudent = useMemo(() => {
    if (selectedStudentId === "all") return null;
    return enrichedStudentRows.find((s) => s.id === selectedStudentId) || null;
  }, [selectedStudentId, enrichedStudentRows]);

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
        {/* HÀNG LỌC 1: LOẠI BÀI (TẤT CẢ | CHỈ BTVN | CHỈ ĐỀ KIỂM TRA | LUYỆN ĐỀ) + HÌNH THỨC HỌC */}
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

        {/* HÀNG LỌC 2: PHẠM VI (TOÀN KHÓA | THEO THÁNG & TUẦN | TỪNG CHƯƠNG | TỪNG BÀI) + TÌM HỌC SINH CỤ THỂ */}
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

            {/* KHI CHỌN THEO THÁNG & TUẦN */}
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

            {/* KHI CHỌN TỪNG CHƯƠNG / TỪNG BÀI */}
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

          {/* TÌM KIẾM & DROPDOWN CHỌN NHANH 1 HỌC SINH CỤ THỂ */}
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
                onChange={(e) => setSelectedStudentId(e.target.value)}
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

      {/* 2. PANEL CHI TIẾT LỊCH SỬ ĐIỂM CỦA RIÊNG 1 HỌC SINH (KHI CHỌN HỌC SINH CỤ THỂ) */}
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
                  {focusedStudent.school} • Tổng số lượt nộp khớp bộ lọc: <strong>{focusedStudent.detailedAttempts.length} bài</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-[9px] font-bold text-emerald-700 uppercase block">Đ.TB BTVN</span>
                <span className="text-xs font-black text-emerald-700">{focusedStudent.hwAvg}đ</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
                <span className="text-[9px] font-bold text-indigo-700 uppercase block">Đ.TB Kiểm tra</span>
                <span className="text-xs font-black text-indigo-700">{focusedStudent.testAvg}đ</span>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-center">
                <span className="text-[9px] font-bold text-[#1D4ED8] uppercase block">Đ.TB Luyện đề</span>
                <span className="text-xs font-black text-[#1D4ED8]">{focusedStudent.pracAvg}đ</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentId("all")}
                className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Đóng chi tiết
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
                  <th className="py-2.5 px-4 text-right">Điểm số</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {focusedStudent.detailedAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                      Học sinh chưa có bài nộp nào trong bộ lọc này.
                    </td>
                  </tr>
                ) : (
                  focusedStudent.detailedAttempts.map((item: any, idx: number) => (
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. BẢNG ĐIỂM & XẾP HẠNG TỔNG HỢP (PHÂN BIỆT RÕ BTVN XANH LÁ VÀ ĐỀ KIỂM TRA TÍM/XANH DƯƠNG) */}
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
                <th className="py-3 px-4 font-bold min-w-[180px]">Học sinh</th>
                <th className="py-3 px-3 font-bold text-center w-24">Phân hệ</th>
                <th className="py-3 px-3 font-bold text-center w-24">Lượt làm</th>
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
                  <th className="py-3 px-3 font-bold text-center text-blue-700 w-28">
                    Luyện đề (TB)
                  </th>
                )}
                <th className="py-3 px-4 font-bold text-center text-[#1D4ED8] w-28">Tổng kết</th>
                <th className="py-3 px-3 font-bold text-center w-24">Hồ sơ</th>
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

                  return (
                    <tr
                      key={st.id || idx}
                      onClick={() => setSelectedStudentId(isFocused ? "all" : st.id)}
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

                      {/* ĐIỂM BTVN (MÀU XANH LÁ) */}
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

                      {/* ĐIỂM ĐỀ KIỂM TRA (MÀU TÍM INDIGO) */}
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

                      {/* ĐIỂM LUYỆN ĐỀ THỰC CHIẾN (MÀU XANH DƯƠNG) */}
                      {(examTypeFilter === "all" || examTypeFilter === "practice") && (
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-black">
                            {Number(st.pracAvg || 0).toFixed(1)}
                          </span>
                        </td>
                      )}

                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-block px-3 py-1 bg-[#1D4ED8] text-white font-black rounded-lg shadow-2xs">
                          {Number(st.overallAvg || 0).toFixed(1)}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setSelectedStudentId(isFocused ? "all" : st.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition inline-flex items-center gap-1 cursor-pointer ${
                            isFocused
                              ? "bg-[#1D4ED8] text-white border-[#1D4ED8]"
                              : "bg-white text-slate-600 border-slate-200 hover:border-[#1D4ED8] hover:text-[#1D4ED8]"
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>{isFocused ? "Đang xem" : "Chi tiết"}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
