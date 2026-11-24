"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/student/Sidebar";
import { Header } from "@/components/student/Header";
import { StudentLeaderboardView } from "@/components/student/StudentLeaderboardView";
import ScheduleView from "@/components/student/ScheduleView";
import { ExamRoomView } from "@/components/student/ExamRoomView";
import HsaExamWorkspace from "@/components/student/HsaExamWorkspace";
import { LessonWorkspaceView } from "@/components/student/LessonWorkspaceView";
import PracticeExamWorkspace from "@/components/student/PracticeExamWorkspace";
import { ExamEntryModal } from "@/components/student/ExamEntryModal";
import { DigitalAnswerSheetView } from "@/components/student/paper/DigitalAnswerSheetView";
import { PaperScanModal } from "@/components/student/paper/PaperScanModal";
import { PaperReviewView } from "@/components/student/paper/PaperReviewView";
import { Profile, ExamAttempt } from "@/types";
import { supabase } from "@/lib/supabaseClient";
import { useAutoSyncAttempts } from "@/hooks/useAutoSyncAttempts";
import {
  Target,
  BookOpen,
  CheckCircle2,
  Clock,
  Edit3,
  Check,
  Layers,
  FileText,
  X,
  ArrowRight,
  Library,
  BarChart3,
  ListOrdered,
  ChevronDown,
  ChevronUp,
  Eye,
  Lock,
  GraduationCap
} from "lucide-react";

const SafePaperScanModal = PaperScanModal as React.ComponentType<any>;

export type SubjectCategoryKey = "dai" | "hinh" | "tong_on" | "tang_cuong" | "hsa";

export const SUBJECT_CATEGORY_CONFIG: Record<
  SubjectCategoryKey,
  {
    label: string;
    shortLabel: string;
  }
> = {
  dai: {
    label: "Đại số & Giải tích",
    shortLabel: "Đại số"
  },
  hinh: {
    label: "Hình học & Oxyz",
    shortLabel: "Hình học"
  },
  tong_on: {
    label: "Tổng ôn toàn diện",
    shortLabel: "Tổng ôn"
  },
  tang_cuong: {
    label: "Tăng cường & Bổ trợ",
    shortLabel: "Tăng cường"
  },
  hsa: {
    label: "Tổng ôn ĐGNL HSA",
    shortLabel: "HSA"
  }
};

export function normalizeSubjectCategory(
  rawCat?: string | null,
  fallbackTitle?: string
): SubjectCategoryKey {
  const clean = String(rawCat || "").trim().toLowerCase();
  if (clean === "hsa" || clean.includes("hsa") || clean.includes("dgnl")) return "hsa";
  if (clean === "dai" || clean === "algebra" || clean === "dai_so") return "dai";
  if (clean === "hinh" || clean === "geometry" || clean === "hinh_hoc") return "hinh";
  if (clean === "tong_on" || clean === "review" || clean === "tongon") return "tong_on";
  if (clean === "tang_cuong" || clean === "boost" || clean === "tangcuong") return "tang_cuong";

  const titleLower = String(fallbackTitle || "").toLowerCase();
  if (/\bhsa\b/.test(titleLower) || titleLower.includes("đgnl")) {
    return "hsa";
  }
  if (
    titleLower.includes("hình học") ||
    titleLower.includes("hình-") ||
    titleLower.includes("oxyz") ||
    titleLower.includes("khối đa diện") ||
    titleLower.includes("mặt cầu") ||
    titleLower.includes("mặt phẳng") ||
    titleLower.includes("đường thẳng") ||
    titleLower.includes("vectơ") ||
    titleLower.includes("vector") ||
    titleLower.includes("góc") ||
    titleLower.includes("khoảng cách")
  ) {
    return "hinh";
  }
  if (titleLower.includes("tổng ôn") || titleLower.includes("luyện đề")) {
    return "tong_on";
  }
  if (titleLower.includes("tăng cường") || titleLower.includes("bổ trợ")) {
    return "tang_cuong";
  }
  return "dai";
}

function classifyHsaCourseDomain(title?: string, chapTitle?: string): "quant" | "qual" | "elective" {
  const txt = `${title || ""} ${chapTitle || ""}`.toLowerCase();
  if (
    txt.includes("định tính") ||
    txt.includes("ngôn ngữ") ||
    txt.includes("văn học") ||
    txt.includes("ngữ văn")
  ) {
    return "qual";
  }
  if (
    txt.includes("tiếng anh") ||
    txt.includes("english") ||
    txt.includes("khoa học") ||
    txt.includes("lịch sử") ||
    txt.includes("địa lý") ||
    txt.includes("vật lý") ||
    txt.includes("hóa học") ||
    txt.includes("sinh học")
  ) {
    return "elective";
  }
  return "quant";
}

/**
 * NHẬN DIỆN CHÍNH XÁC ĐỀ THI ĐÁNH GIÁ NĂNG LỰC HSA (ĐHQGHN)
 */
function isHsaExamItem(exam?: any, attempt?: any): boolean {
  if (!exam && !attempt) return false;

  const rawFormat = String(exam?.exam_format || attempt?.exam_format || "").trim().toLowerCase();
  if (rawFormat === "thpt") return false;
  if (
    exam?.isHsa === true ||
    rawFormat === "hsa" ||
    attempt?.submission_type === "web_hsa" ||
    attempt?.answers?.__hsa_meta?.examFormat === "hsa"
  ) {
    return true;
  }

  const catStr = String(exam?.category || attempt?.category || "").toUpperCase();
  const titleStr = String(
    exam?.title ||
      attempt?.examTitle ||
      attempt?.exam_title ||
      attempt?.quizTitle ||
      attempt?.quiz_title ||
      ""
  ).toUpperCase();

  if (
    catStr.includes("ĐGNL HSA") ||
    catStr.includes("HSA") ||
    titleStr.includes("ĐGNL HSA") ||
    /\bHSA\b/.test(titleStr)
  ) {
    return true;
  }

  const rawSecs = Array.isArray(exam?.data)
    ? exam.data
    : Array.isArray(exam?.sections)
      ? exam.sections
      : [];

  if (
    rawSecs.some((s: any) => {
      const k = String(s?.part_key || s?.key || "").trim().toLowerCase();
      return k === "quant" || k === "qual" || k === "english" || k === "history_geo";
    })
  ) {
    return true;
  }

  return false;
}

function getHsaDisplayMeta(exam: any): {
  isHsa: boolean;
  partsCount: number;
  maxPoints: number;
  badgeLabel: string;
} {
  const isHsa = isHsaExamItem(exam);
  if (!isHsa) {
    return { isHsa: false, partsCount: 0, maxPoints: 10, badgeLabel: "" };
  }

  const rawSecs = Array.isArray(exam?.data)
    ? exam.data
    : Array.isArray(exam?.sections)
      ? exam.sections
      : [];

  const detectedKeys = new Set<string>();
  rawSecs.forEach((s: any) => {
    const k = String(s?.part_key || s?.key || "").trim().toLowerCase();
    if (k === "quant" || k === "qual" || k === "english" || k === "history_geo") {
      detectedKeys.add(k);
    }
  });

  let partsCount = 0;
  if (typeof exam?.hsa_parts_count === "number" && exam.hsa_parts_count > 0) {
    partsCount = Math.min(4, Math.max(1, exam.hsa_parts_count));
  } else if (detectedKeys.size > 0) {
    partsCount = Math.min(4, detectedKeys.size);
  } else if (rawSecs.length > 0) {
    partsCount = Math.min(4, Math.max(1, rawSecs.length));
  }

  const badgeLabel =
    partsCount > 0
      ? `ĐGNL HSA • ${partsCount} phần • Thang ${Math.min(150, partsCount * 50)}đ`
      : "ĐGNL HSA (ĐHQGHN) • Thang 150đ";

  return {
    isHsa: true,
    partsCount: partsCount || 3,
    maxPoints: partsCount > 0 ? Math.min(150, partsCount * 50) : 150,
    badgeLabel
  };
}

const DEFAULT_CHAPTERS = [
  {
    id: "chap-1",
    title: "Chương 1: Ứng dụng đạo hàm để khảo sát hàm số",
    category: "dai",
    lessons: [
      {
        id: "les-1",
        title: "Bài 1: Tính đơn điệu của hàm số",
        description: "",
        duration: 45,
        format: "Zoom",
        target_mode: "all",
        category: "dai",
        lecture_files: [],
        homework_files: [],
        handwritten_notes: [],
        video_list: [],
        test_quizzes: [],
        extra_resources: []
      }
    ]
  }
];

const VALID_TABS = [
  "overview",
  "courses",
  "practice",
  "hsa_courses",
  "hsa_practice",
  "schedule",
  "progress",
  "assessments",
  "leaderboard",
  "notifications"
];

function normalizeStr(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

interface StudentOfflineDashboardProps {
  initialProfile?: Profile | null;
  onLogout?: () => void;
}

function StudentOfflineDashboard({ initialProfile, onLogout }: StudentOfflineDashboardProps) {
  const [profile, setProfile] = useState<Profile | null>(() => {
    if (initialProfile) {
      return { ...initialProfile, learning_mode: "offline", study_mode: "offline" };
    }
    if (typeof window !== "undefined") {
      try {
        const saved =
          localStorage.getItem("tct_current_user") ||
          localStorage.getItem("edunexus_current_user");
        if (saved) {
          return { ...JSON.parse(saved), learning_mode: "offline", study_mode: "offline" };
        }
      } catch {}
    }
    return null;
  });

  useAutoSyncAttempts(profile);

  useEffect(() => {
    if (initialProfile) {
      setProfile({ ...initialProfile, learning_mode: "offline", study_mode: "offline" });
    }
  }, [initialProfile]);

  const studentAutoSbd = useMemo(() => {
    const raw = profile?.student_code || profile?.sbd;
    if (raw && !String(raw).includes("HS-")) {
      const clean = String(raw).replace(/\D/g, "");
      if (clean) return clean.padStart(6, "0").slice(-6);
    }
    return "000001";
  }, [profile]);

  const [selectedLesson, setSelectedLesson] = useState<any | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("tct_active_lesson");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return null;
  });

  // Tự động đồng bộ lại danh sách BTVN mới nhất từ Supabase mỗi khi học sinh F5 ngay trong bài học
  useEffect(() => {
    if (!selectedLesson?.id) return;
    let isCancelled = false;
    const targetLessonId = selectedLesson.id;

    (async () => {
      try {
        const { data } = await supabase
          .from("homeworks")
          .select("id, lesson_id, title, duration_minutes, is_quiz")
          .eq("lesson_id", targetLessonId);

        if (isCancelled || !Array.isArray(data)) return;
        setSelectedLesson((prev: any) => {
          if (!prev || prev.id !== targetLessonId) return prev;
          const refreshed = { ...prev, homework_files: data };
          try {
            sessionStorage.setItem("tct_active_lesson", JSON.stringify(refreshed));
          } catch {}
          return refreshed;
        });
      } catch {}
    })();

    return () => {
      isCancelled = true;
    };
  }, [selectedLesson?.id]);

  const [examRoom, setExamRoom] = useState<any | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("tct_active_exam_room");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return null;
  });

  const [activeTab, setActiveTabState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "").trim();
      if (VALID_TABS.includes(hash)) return hash;
    }
    return "overview";
  });

  const [isTabChanging, setIsTabChanging] = useState<boolean>(false);

  const setActiveTab = useCallback(
    (newTab: string) => {
      if (newTab === activeTab) return;
      setIsTabChanging(true);
      setActiveTabState(newTab);
      if (typeof window !== "undefined") {
        window.history.pushState({ tab: newTab }, "", "#" + newTab);
      }
      setTimeout(() => {
        setIsTabChanging(false);
      }, 200);
    },
    [activeTab]
  );

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Lọc phân môn THPT ('all' | 'dai' | 'hinh' | 'tong_on' | 'tang_cuong')
  const [selectedSubjectCategory, setSelectedSubjectCategory] = useState<
    "all" | "dai" | "hinh" | "tong_on" | "tang_cuong"
  >("all");
  // Lọc mảng kiến thức HSA ('all' | 'quant' | 'qual' | 'elective')
  const [selectedHsaDomain, setSelectedHsaDomain] = useState<
    "all" | "quant" | "qual" | "elective"
  >("all");

  const [chapters, setChapters] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_course_data");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return DEFAULT_CHAPTERS;
  });

  const [allAttempts, setAllAttempts] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_attempts");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [practiceExams, setPracticeExams] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_practice_exams");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [isLoadingExams, setIsLoadingExams] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("edunexus_practice_exams");
      return !saved;
    }
    return true;
  });

  const [sysNotifications, setSysNotifications] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_system_notifications");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const [selectedPracticeCategory, setSelectedPracticeCategory] = useState("Tất cả đề");
  const [practiceSubTab, setPracticeSubTab] = useState<"list" | "history">("list");
  const [hsaPracticeSubTab, setHsaPracticeSubTab] = useState<"list" | "history">("list");
  const [historyModalExamId, setHistoryModalExamId] = useState<string | null>(null);

  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});
  const toggleChapterCollapse = (chapId: string) => {
    setCollapsedChapters((prev) => ({ ...prev, [chapId]: !prev[chapId] }));
  };

  const [studyGoal, setStudyGoal] = useState<string>(() => {
    return typeof window !== "undefined"
      ? localStorage.getItem("edunexus_study_goal") || "Chinh phục 9.5+ Toán & Kỳ thi ĐGNL HSA"
      : "";
  });
  const [isEditingGoal, setIsEditingGoal] = useState<boolean>(false);
  const [tempGoal, setTempGoal] = useState<string>(studyGoal);
  const [totalStudySeconds, setTotalStudySeconds] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return parseInt(
        localStorage.getItem("edunexus_study_time_" + (initialProfile?.id || "default")) || "0",
        10
      );
    }
    return 0;
  });

  const [previewExam, setPreviewExam] = useState<any | null>(null);
  const [selectedSysNotif, setSelectedSysNotif] = useState<any | null>(null);
  const [workspacePracticeExam, setWorkspacePracticeExam] = useState<any | null>(null);

  const [entryModalState, setEntryModalState] = useState<{
    isOpen: boolean;
    exam: any | null;
    isHomework: boolean;
  }>({
    isOpen: false,
    exam: null,
    isHomework: false
  });

  const [activeDigitalSheetExam, setActiveDigitalSheetExam] = useState<{
    exam: any;
    isHomework: boolean;
  } | null>(null);
  const [activePaperScanState, setActivePaperScanState] = useState<{
    exam: any;
    isHomework: boolean;
  } | null>(null);
  const [paperReviewAttemptState, setPaperReviewAttemptState] = useState<{
    attempt: ExamAttempt;
    exam: any;
  } | null>(null);

  const [reviewAttemptData, setReviewAttemptData] = useState<{ exam: any; attempt: any } | null>(
    null
  );
  const [offlineToast, setOfflineToast] = useState<string>("");

  // Hàm nạp đầy đủ câu hỏi (`data`) của đề từ Supabase khi học sinh mở phòng thi HSA hoặc xem lại bài HSA
  const ensurePracticeExamQuestionsLoaded = useCallback(async (examObj: any): Promise<any> => {
    if (!examObj || !examObj.id) return examObj;
    const hasLoaded =
      (Array.isArray(examObj.data) && examObj.data.length > 0) ||
      (Array.isArray(examObj.sections) && examObj.sections.length > 0);
    if (hasLoaded) return examObj;

    try {
      const { data: row } = await supabase
        .from("practice_exams")
        .select("id, title, category, duration_minutes, data, driveUrl")
        .eq("id", examObj.id)
        .maybeSingle();

      if (row) {
        const enriched = {
          ...examObj,
          ...row,
          data: row.data || examObj.data || [],
          sections: row.data || examObj.sections || []
        };
        setPracticeExams((prev) =>
          prev.map((item) => (String(item?.id) === String(examObj.id) ? enriched : item))
        );
        return enriched;
      }
    } catch (err) {
      console.warn("Không thể tải chi tiết đề thi:", err);
    }
    return examObj;
  }, []);

  // ĐỒNG BỘ NỀN TỪ SUPABASE
  const fetchAuthAndData = useCallback(async () => {
    if (profile?.id) {
      try {
        const { data: freshProfile } = await supabase
          .from("profiles")
          .select(
            "id, student_code, full_name, email, phone, school, grade, role, learning_mode, status, approval_status, is_approved"
          )
          .eq("id", profile.id)
          .maybeSingle();

        if (freshProfile) {
          const isLocked =
            freshProfile.status === "rejected" ||
            freshProfile.status === "locked" ||
            freshProfile.approval_status === "rejected" ||
            freshProfile.is_approved === false;

          if (isLocked) {
            localStorage.removeItem("tct_current_user");
            localStorage.removeItem("edunexus_current_user");
            sessionStorage.clear();
            alert(
              "⚠️ Quyền truy cập của bạn đã bị khóa bởi Ban quản trị. Vui lòng liên hệ trung tâm để được hỗ trợ!"
            );
            if (onLogout) {
              onLogout();
            } else {
              window.location.href = "/";
            }
            return;
          }

          const cleanCode = freshProfile.student_code
            ? String(freshProfile.student_code).replace(/\D/g, "").padStart(6, "0").slice(-6)
            : "";

          setProfile((prev: any) => {
            const updated = {
              ...prev,
              ...freshProfile,
              student_code: cleanCode || prev?.student_code || "000001",
              sbd: cleanCode || prev?.sbd || "000001"
            };
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("tct_current_user", JSON.stringify(updated));
                localStorage.setItem("edunexus_current_user", JSON.stringify(updated));
              } catch {}
            }
            return updated;
          });
        }
      } catch (e) {
        console.warn("Lỗi làm mới profile:", e);
      }
    }

    // 1. TẢI TOÀN BỘ CHƯƠNG, BÀI HỌC & BTVN TỪ SUPABASE
    try {
      const { data: dbChapters } = await supabase
        .from("chapters")
        .select("*")
        .order("created_at", { ascending: true });

      let dbLessons: any[] | null = null;
      const { data: lessonsWithCat, error: lesCatErr } = await supabase
        .from("lessons")
        .select(
          "id, chapter_id, title, target_mode, category, created_at, assigned_month, assigned_week, is_locked, study_date, test_quizzes"
        )
        .order("created_at", { ascending: false });

      if (!lesCatErr && lessonsWithCat) {
        dbLessons = lessonsWithCat;
      } else {
        const { data: lessonsFallback } = await supabase
          .from("lessons")
          .select(
            "id, chapter_id, title, target_mode, created_at, assigned_month, assigned_week, is_locked, study_date, test_quizzes"
          )
          .order("created_at", { ascending: false });
        dbLessons = lessonsFallback;
      }

      const { data: dbHomeworks } = await supabase
        .from("homeworks")
        .select("id, lesson_id, title, duration_minutes, is_quiz");

      if (dbChapters && Array.isArray(dbChapters) && dbChapters.length > 0) {
        const localCatMap = new Map<string, string>();
        if (typeof window !== "undefined") {
          try {
            const rawSaved = localStorage.getItem("edunexus_course_data");
            if (rawSaved) {
              const parsedSaved = JSON.parse(rawSaved);
              if (Array.isArray(parsedSaved)) {
                parsedSaved.forEach((c: any) => {
                  if (c?.id && (c?.category || c?.subject_category)) {
                    localCatMap.set(String(c.id), c.category || c.subject_category);
                  }
                  (c?.lessons || []).forEach((l: any) => {
                    if (l?.id && (l?.category || l?.subject_category)) {
                      localCatMap.set(String(l.id), l.category || l.subject_category);
                    }
                  });
                });
              }
            }
          } catch {}
        }

        const formattedChapters = dbChapters.map((chap: any) => {
          const chapCat = normalizeSubjectCategory(
            chap?.category || chap?.subject_category || localCatMap.get(String(chap.id)),
            chap?.title
          );
          return {
            ...chap,
            category: chapCat,
            subject_category: chapCat,
            lessons: (dbLessons || [])
              .filter((les: any) => les.chapter_id === chap.id)
              .map((les: any) => {
                const lesCat = normalizeSubjectCategory(
                  les?.category ||
                    les?.subject_category ||
                    localCatMap.get(String(les.id)) ||
                    chap?.category ||
                    chap?.subject_category,
                  les?.title || chap?.title
                );
                return {
                  ...les,
                  category: lesCat,
                  subject_category: lesCat,
                  test_quizzes: Array.isArray(les.test_quizzes) ? les.test_quizzes : [],
                  homework_files: (dbHomeworks || []).filter((hw: any) => hw.lesson_id === les.id)
                };
              })
          };
        });

        setChapters(formattedChapters);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("edunexus_course_data", JSON.stringify(formattedChapters));
          } catch {}
        }
      }
    } catch (e) {
      console.error("Lỗi tải chương trình học & BTVN:", e);
    }

    // 2. TẢI DANH SÁCH ĐỀ LUYỆN THI SIÊU NHẸ (BỎ CỘT data ĐỂ KHÔNG TỐN EGRESS)
    try {
      setIsLoadingExams(true);
      let dbExams: any[] | null = null;
      const { data: examsWithMeta, error: metaErr } = await supabase
        .from("practice_exams")
        .select(
          "id, title, category, exam_format, hsa_parts_count, duration_minutes, created_at, target_mode, allowViewFile, driveUrl"
        )
        .order("created_at", { ascending: false });

      if (!metaErr && Array.isArray(examsWithMeta)) {
        dbExams = examsWithMeta;
      } else {
        const { data: examsFallback } = await supabase
          .from("practice_exams")
          .select(
            "id, title, category, duration_minutes, created_at, target_mode, allowViewFile, driveUrl"
          )
          .order("created_at", { ascending: false });
        dbExams = examsFallback;
      }

      if (dbExams && Array.isArray(dbExams)) {
        setPracticeExams((prev) => {
          const prevMap = new Map<string, any>();
          prev.forEach((p) => {
            if (p?.id) prevMap.set(String(p.id), p);
          });
          return dbExams!.map((ex: any) => {
            const cached = prevMap.get(String(ex.id));
            return {
              ...cached,
              ...ex,
              data: ex.data || cached?.data,
              sections: ex.data || ex.sections || cached?.sections
            };
          });
        });
        if (typeof window !== "undefined") {
          try {
            const slimForCache = dbExams.map((ex: any) => ({
              id: ex.id,
              title: ex.title,
              category: ex.category,
              exam_format: ex.exam_format,
              hsa_parts_count: ex.hsa_parts_count,
              duration_minutes: ex.duration_minutes,
              created_at: ex.created_at,
              target_mode: ex.target_mode,
              allowViewFile: ex.allowViewFile,
              driveUrl: ex.driveUrl
            }));
            localStorage.setItem("edunexus_practice_exams", JSON.stringify(slimForCache));
          } catch {}
        }
      }
    } catch {
    } finally {
      setIsLoadingExams(false);
    }

    try {
      const { data: dbNotifs } = await supabase
        .from("system_notifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (dbNotifs && Array.isArray(dbNotifs)) {
        setSysNotifications(dbNotifs);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("edunexus_system_notifications", JSON.stringify(dbNotifs));
          } catch {}
        }
      }
    } catch {}

    // Đồng bộ lịch sử thi
    const mergedAttempts: any[] = [];
    if (typeof window !== "undefined") {
      try {
        const savedAttempts = localStorage.getItem("edunexus_attempts");
        if (savedAttempts) {
          const parsed = JSON.parse(savedAttempts);
          if (Array.isArray(parsed)) mergedAttempts.push(...parsed);
        }
      } catch {}
    }

    try {
      const { data: cloudAttempts } = await supabase
        .from("exam_attempts")
        .select(
          "id, quiz_id, exam_id, quiz_title, exam_title, student_id, student_name, full_name, score, points, created_at, is_homework, type, submission_type"
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (cloudAttempts && Array.isArray(cloudAttempts)) {
        const seenIds = new Set(mergedAttempts.map((a: any) => String(a?.id || "")));
        cloudAttempts.forEach((ca: any) => {
          const cid = String(ca?.id || "");
          if (cid && !seenIds.has(cid)) {
            seenIds.add(cid);
            mergedAttempts.push(ca);
          }
        });
      }
    } catch {}

    if (mergedAttempts.length > 0) {
      setAllAttempts(mergedAttempts);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("edunexus_attempts", JSON.stringify(mergedAttempts));
        } catch {}
      }
    }

    if (typeof window !== "undefined") {
      const studySecs = parseInt(
        localStorage.getItem("edunexus_study_time_" + (profile?.id || "default")) || "0",
        10
      );
      setTotalStudySeconds(studySecs);
    }
  }, [profile?.id, onLogout]);

  useEffect(() => {
    fetchAuthAndData();

    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const hash = window.location.hash.replace("#", "").trim();
        if (VALID_TABS.includes(hash)) {
          setActiveTabState(hash);
        } else {
          setActiveTabState("overview");
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("storage", fetchAuthAndData);

    const channelCourses = supabase
      .channel("student-offline-global-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "lessons" }, () =>
        fetchAuthAndData()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "chapters" }, () =>
        fetchAuthAndData()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "homeworks" }, () => {
        fetchAuthAndData();
        setSelectedLesson((prev: any) => {
          if (!prev?.id) return prev;
          const targetId = prev.id;
          (async () => {
            try {
              const { data } = await supabase
                .from("homeworks")
                .select("id, lesson_id, title, duration_minutes, is_quiz")
                .eq("lesson_id", targetId);
              if (Array.isArray(data)) {
                setSelectedLesson((cur: any) => {
                  if (!cur || cur.id !== targetId) return cur;
                  const refreshed = { ...cur, homework_files: data };
                  try {
                    sessionStorage.setItem("tct_active_lesson", JSON.stringify(refreshed));
                  } catch {}
                  return refreshed;
                });
              }
            } catch {}
          })();
          return prev;
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "practice_exams" }, () =>
        fetchAuthAndData()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "system_notifications" }, () =>
        fetchAuthAndData()
      )
      .subscribe();

    const channelSecurity = supabase
      .channel(`security-guard-${profile?.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${profile?.id}`
        },
        (payload: any) => {
          const updated = payload.new;
          const isLocked =
            updated?.status === "rejected" ||
            updated?.status === "locked" ||
            updated?.approval_status === "rejected" ||
            updated?.is_approved === false;

          if (isLocked) {
            localStorage.removeItem("tct_current_user");
            localStorage.removeItem("edunexus_current_user");
            sessionStorage.clear();
            alert("🔒 Tài khoản của bạn vừa bị tạm khóa bởi Ban quản trị.");
            if (onLogout) {
              onLogout();
            } else {
              window.location.href = "/";
            }
          }
        }
      )
      .subscribe();

    const channelBroadcastSecurity = supabase
      .channel("system-security-channel")
      .on("broadcast", { event: "force_kick_student" }, (payload: any) => {
        if (payload?.payload?.studentId && payload.payload.studentId === profile?.id) {
          localStorage.removeItem("tct_current_user");
          localStorage.removeItem("edunexus_current_user");
          sessionStorage.clear();
          alert("🔒 Tài khoản của bạn vừa bị tạm khóa bởi Ban quản trị.");
          if (onLogout) {
            onLogout();
          } else {
            window.location.href = "/";
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelCourses);
      supabase.removeChannel(channelSecurity);
      supabase.removeChannel(channelBroadcastSecurity);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("storage", fetchAuthAndData);
    };
  }, [fetchAuthAndData, profile?.id, onLogout]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setHistoryModalExamId(null);
        setSelectedSysNotif(null);
        setPreviewExam(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSaveGoal = () => {
    setStudyGoal(tempGoal);
    localStorage.setItem("edunexus_study_goal", tempGoal);
    setIsEditingGoal(false);
  };

  const formattedStudyTimeToday = useMemo(() => {
    const mins = Math.floor(totalStudySeconds / 60);
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    if (hrs > 0) return hrs + "h " + remainMins + "p";
    return mins + " phút";
  }, [totalStudySeconds]);

  const findLessonByQuizId = (qId: string) => {
    for (const chap of chapters) {
      for (const les of chap.lessons || []) {
        const hasTest = les.test_quizzes?.some((q: any) => q.id === qId);
        const hasHW = les.homework_files?.some((q: any) => q.id === qId);
        if (hasTest || hasHW) return les;
      }
    }
    return null;
  };

  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  const syncReadNotifs = useCallback(() => {
    const savedReads = localStorage.getItem(
      "edunexus_read_notifs_" + (profile?.id || "default")
    );
    if (savedReads) setReadNotifIds(JSON.parse(savedReads));
  }, [profile?.id]);

  useEffect(() => {
    syncReadNotifs();
    window.addEventListener("readNotifsUpdated", syncReadNotifs);
    return () => window.removeEventListener("readNotifsUpdated", syncReadNotifs);
  }, [syncReadNotifs]);

  const myAttempts = useMemo(() => {
    if (!profile) return [];
    const pId = String(profile.id || "").trim().toLowerCase();
    const pUser = String(profile.username || "").trim().toLowerCase();
    const pName = normalizeStr(profile.full_name || "");
    const pEmailPrefix = profile.email
      ? String(profile.email).split("@")[0].trim().toLowerCase()
      : "";

    return (allAttempts || []).filter((a) => {
      if (!a) return false;
      const attStuId = String(a.studentId || a.student_id || a.user_id || "")
        .trim()
        .toLowerCase();
      const attName = normalizeStr(
        a.studentName || a.student_name || a.full_name || a.username || ""
      );
      const attUser = String(a.username || "").trim().toLowerCase();

      if (pId && (attStuId === pId || attStuId.includes(pId))) return true;
      if (pUser && (attStuId === pUser || attUser === pUser || attName.includes(pUser)))
        return true;
      if (pEmailPrefix && (attStuId.includes(pEmailPrefix) || attUser.includes(pEmailPrefix)))
        return true;
      if (
        pName &&
        attName &&
        (attName === pName || attName.includes(pName) || pName.includes(attName))
      )
        return true;
      return false;
    });
  }, [allAttempts, profile]);

  const notificationsList = useMemo(() => {
    const combined: any[] = [];

    myAttempts.forEach((att) => {
      const isPractice = att.type === "practice";
      combined.push({
        id: "score-" + (att.id || att.attemptId || Math.random()),
        title: "Điểm kiểm tra mới",
        desc:
          'Bài "' +
          (att.quizTitle || att.examTitle || "Đề thi") +
          '" đạt kết quả: ' +
          att.score +
          " điểm.",
        type: "success",
        timestamp: new Date(
          att.createdAt || att.created_at || att.submittedAt || Date.now()
        ).getTime(),
        dateStr: new Date(
          att.createdAt || att.created_at || att.submittedAt || Date.now()
        ).toLocaleString("vi-VN"),
        actionType: isPractice ? "practice_score" : "course_score",
        quizId: att.quizId || att.quiz_id
      });
    });

    practiceExams.forEach((ex) => {
      const exTime =
        ex.createdAt || ex.created_at
          ? new Date(ex.createdAt || ex.created_at).getTime()
          : Date.now() - 86400000;
      combined.push({
        id: "exam-" + ex.id,
        title: "Đề thi thử mới cập nhật",
        desc: 'Đề "' + ex.title + '" (' + ex.category + ") đã sẵn sàng luyện tập.",
        type: "info",
        timestamp: exTime,
        dateStr: "Mới cập nhật",
        actionType: isHsaExamItem(ex) ? "new_hsa_practice" : "new_practice"
      });
    });

    sysNotifications.forEach((sys) => {
      combined.push({
        id: "sys-" + sys.id,
        title: sys.title,
        desc: sys.content,
        type: sys.type === "urgent" ? "warning" : "teacher",
        timestamp: new Date(sys.createdAt || sys.created_at || Date.now()).getTime(),
        dateStr: new Date(sys.createdAt || sys.created_at || Date.now()).toLocaleString("vi-VN"),
        actionType: "system_modal"
      });
    });

    return combined.sort((a, b) => b.timestamp - a.timestamp);
  }, [myAttempts, practiceExams, sysNotifications]);

  const handleMarkAllAsRead = () => {
    const allIds = notificationsList.map((n) => n.id);
    setReadNotifIds(allIds);
    localStorage.setItem("edunexus_read_notifs_" + (profile?.id || ""), JSON.stringify(allIds));
    window.dispatchEvent(new Event("readNotifsUpdated"));
  };

  const handleActionFromCenter = (item: any) => {
    if (!readNotifIds.includes(item.id)) {
      const newIds = [...readNotifIds, item.id];
      setReadNotifIds(newIds);
      localStorage.setItem("edunexus_read_notifs_" + (profile?.id || ""), JSON.stringify(newIds));
      window.dispatchEvent(new Event("readNotifsUpdated"));
    }
    if (item.actionType === "system_modal") {
      setSelectedSysNotif(item);
    } else if (item.actionType === "course_score") {
      setActiveTab("courses");
      if (item.quizId) {
        const foundLesson = findLessonByQuizId(item.quizId);
        if (foundLesson) setSelectedLesson(foundLesson);
      }
    } else if (item.actionType === "new_hsa_practice") {
      setActiveTab("hsa_practice");
      setHsaPracticeSubTab("list");
    } else if (item.actionType === "practice_score" || item.actionType === "new_practice") {
      setActiveTab("practice");
      setPracticeSubTab("history");
    }
  };

  // LỊCH SỬ LÀM ĐỀ PHÂN TÁCH 2 NHÓM: THPT & ĐGNL HSA
  const { thptHistoryGrouped, hsaHistoryGrouped, allPracticeHistoryGrouped } = useMemo(() => {
    const myPracticeAttempts = myAttempts.filter(
      (a) => a.type === "practice" || (!a.is_homework && !a.isHomework)
    );
    const grouped: Record<string, any> = {};
    myPracticeAttempts.forEach((att) => {
      const qKey = att.quizId || att.quiz_id || att.exam_id;
      if (!qKey) return;
      if (!grouped[qKey]) {
        const matchedExam = practiceExams.find((pe: any) => String(pe?.id) === String(qKey));
        grouped[qKey] = {
          quizId: qKey,
          title:
            att.quizTitle ||
            att.examTitle ||
            att.quiz_title ||
            att.exam_title ||
            matchedExam?.title ||
            "Đề thi",
          category: att.category || matchedExam?.category || "Luyện đề",
          isHsa: isHsaExamItem(matchedExam, att),
          attempts: [],
          maxScore: 0,
          lastDate: 0
        };
      }
      grouped[qKey].attempts.push(att);
      grouped[qKey].maxScore = Math.max(
        grouped[qKey].maxScore,
        Number(att.score ?? att.points ?? 0)
      );
      const attTime = new Date(
        att.createdAt || att.created_at || att.submittedAt || Date.now()
      ).getTime();
      if (attTime > grouped[qKey].lastDate) {
        grouped[qKey].lastDate = attTime;
      }
    });
    Object.values(grouped).forEach((group) => {
      group.attempts.sort(
        (a: any, b: any) =>
          new Date(a.createdAt || a.created_at || a.submittedAt).getTime() -
          new Date(b.createdAt || b.created_at || b.submittedAt).getTime()
      );
    });
    const allList = Object.values(grouped).sort((a, b) => b.lastDate - a.lastDate);
    return {
      allPracticeHistoryGrouped: allList,
      thptHistoryGrouped: allList.filter((g) => !g.isHsa),
      hsaHistoryGrouped: allList.filter((g) => g.isHsa)
    };
  }, [myAttempts, practiceExams]);

  // CHUẨN HÓA TOÀN BỘ CHƯƠNG & BÀI HỌC
  const allNormalizedChapters = useMemo(() => {
    const extractChapterNum = (title: string): number => {
      const match = String(title || "").match(/ch[uư][oơ]ng\s*(\d+)/i);
      return match ? parseInt(match[1], 10) : 0;
    };

    const extractLessonNum = (title: string): number => {
      const match = String(title || "").match(/(?:b[aà]i|bu[ổo]i)\s*(\d+)/i);
      return match ? parseInt(match[1], 10) : 0;
    };

    const parseDateStrToTimestamp = (dateStr?: string): number => {
      if (!dateStr || !dateStr.includes("/")) return 0;
      const parts = dateStr.trim().split("/");
      if (parts.length === 3) {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const y = parseInt(parts[2], 10);
        return new Date(y, m, d).getTime();
      }
      return 0;
    };

    const getLessonTimestamp = (les: any): number => {
      if (les?.created_at) {
        const t = new Date(les.created_at).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      const match = String(les?.id || "").match(/\d{10,}/);
      return match ? parseInt(match[0], 10) : 0;
    };

    return (chapters || [])
      .map((chap: any) => {
        const chapCat = normalizeSubjectCategory(
          chap?.category || chap?.subject_category || chap?.subject_type,
          chap?.title
        );

        return {
          ...chap,
          category: chapCat,
          subject_category: chapCat,
          lessons: (chap.lessons || [])
            .filter(
              (les: any) =>
                !les?.target_mode || les?.target_mode === "offline" || les?.target_mode === "all"
            )
            .map((les: any) => {
              const resolvedLesCat = normalizeSubjectCategory(
                les?.category ||
                  les?.subject_category ||
                  les?.subject_type ||
                  chap?.category ||
                  chap?.subject_category ||
                  chap?.subject_type,
                les?.title || chap?.title
              );
              return {
                ...les,
                category: resolvedLesCat,
                subject_category: resolvedLesCat
              };
            })
            .sort((a: any, b: any) => {
              const dateA = parseDateStrToTimestamp(a?.study_date);
              const dateB = parseDateStrToTimestamp(b?.study_date);
              if (dateA && dateB && dateA !== dateB) return dateB - dateA;

              const mA = Number(a?.assigned_month) || 10;
              const mB = Number(b?.assigned_month) || 10;
              if (mA !== mB) return mB - mA;

              const wA = Number(a?.assigned_week) || 1;
              const wB = Number(b?.assigned_week) || 1;
              if (wA !== wB) return wB - wA;

              const numA = extractLessonNum(a?.title);
              const numB = extractLessonNum(b?.title);
              if (numA && numB && numA !== numB) return numB - numA;

              return getLessonTimestamp(b) - getLessonTimestamp(a);
            })
        };
      })
      .sort((chapA: any, chapB: any) => {
        const cNumA = extractChapterNum(chapA?.title);
        const cNumB = extractChapterNum(chapB?.title);
        if (cNumA !== cNumB) return cNumB - cNumA;

        const cTimeA = chapA?.created_at ? new Date(chapA.created_at).getTime() : 0;
        const cTimeB = chapB?.created_at ? new Date(chapB.created_at).getTime() : 0;
        return cTimeB - cTimeA;
      })
      .filter((chap: any) => chap.lessons && chap.lessons.length > 0);
  }, [chapters]);

  // PHÂN TÁCH 2 NHÓM CHƯƠNG/BÀI HỌC: THPT (category !== "hsa") & TỔNG ÔN HSA (category === "hsa")
  const thptChapters = useMemo(() => {
    return allNormalizedChapters
      .map((chap: any) => ({
        ...chap,
        lessons: (chap.lessons || []).filter((les: any) => les.category !== "hsa")
      }))
      .filter((chap: any) => chap.lessons.length > 0);
  }, [allNormalizedChapters]);

  const hsaChapters = useMemo(() => {
    return allNormalizedChapters
      .map((chap: any) => ({
        ...chap,
        lessons: (chap.lessons || []).filter((les: any) => les.category === "hsa")
      }))
      .filter((chap: any) => chap.lessons.length > 0);
  }, [allNormalizedChapters]);

  // PHÂN TÁCH 2 NHÓM ĐỀ THI: ĐỀ THPT (!isHsaExamItem) & ĐỀ ĐGNL HSA (isHsaExamItem)
  const thptPracticeExams = useMemo(() => {
    return (practiceExams || []).filter((e: any) => {
      const tMode = (e?.target_mode || "all").toLowerCase();
      return (tMode === "offline" || tMode === "all") && !isHsaExamItem(e);
    });
  }, [practiceExams]);

  const hsaPracticeExams = useMemo(() => {
    return (practiceExams || []).filter((e: any) => {
      const tMode = (e?.target_mode || "all").toLowerCase();
      return (tMode === "offline" || tMode === "all") && isHsaExamItem(e);
    });
  }, [practiceExams]);

  // ĐẾM SỐ BÀI HỌC THPT THEO 4 PHÂN MÔN
  const thptCategoryCounts = useMemo(() => {
    const counts = { all: 0, dai: 0, hinh: 0, tong_on: 0, tang_cuong: 0 };
    const q = searchQuery.trim().toLowerCase();
    thptChapters.forEach((chap: any) => {
      (chap.lessons || []).forEach((les: any) => {
        if (
          q &&
          !String(les?.title || "").toLowerCase().includes(q) &&
          !String(chap?.title || "").toLowerCase().includes(q)
        ) {
          return;
        }
        const cat = les.category as "dai" | "hinh" | "tong_on" | "tang_cuong";
        counts.all += 1;
        if (cat in counts) counts[cat] += 1;
      });
    });
    return counts;
  }, [thptChapters, searchQuery]);

  // DANH SÁCH CHƯƠNG/BÀI THPT ĐÃ LỌC
  const filteredThptChapters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return thptChapters
      .map((chap: any, idx: number) => {
        const matchingLessons = (chap.lessons || []).filter((les: any) => {
          if (selectedSubjectCategory !== "all" && les.category !== selectedSubjectCategory) {
            return false;
          }
          if (q) {
            const matchLes = String(les?.title || "").toLowerCase().includes(q);
            const matchChap = String(chap?.title || "").toLowerCase().includes(q);
            if (!matchLes && !matchChap) return false;
          }
          return true;
        });
        return {
          ...chap,
          originalChapNumber: idx + 1,
          lessons: matchingLessons
        };
      })
      .filter((chap: any) => chap.lessons.length > 0);
  }, [thptChapters, selectedSubjectCategory, searchQuery]);

  // DANH SÁCH CHUYÊN ĐỀ TỔNG ÔN HSA ĐÃ LỌC THEO MẢNG KIẾN THỨC
  const filteredHsaChapters = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return hsaChapters
      .map((chap: any, idx: number) => {
        const matchingLessons = (chap.lessons || []).filter((les: any) => {
          if (selectedHsaDomain !== "all") {
            const dom = classifyHsaCourseDomain(les?.title, chap?.title);
            if (dom !== selectedHsaDomain) return false;
          }
          if (q) {
            const matchLes = String(les?.title || "").toLowerCase().includes(q);
            const matchChap = String(chap?.title || "").toLowerCase().includes(q);
            if (!matchLes && !matchChap) return false;
          }
          return true;
        });
        return {
          ...chap,
          originalChapNumber: idx + 1,
          lessons: matchingLessons
        };
      })
      .filter((chap: any) => chap.lessons.length > 0);
  }, [hsaChapters, selectedHsaDomain, searchQuery]);

  const hsaLessonsTotalCount = useMemo(
    () => hsaChapters.reduce((sum, c) => sum + (c.lessons?.length || 0), 0),
    [hsaChapters]
  );

  const getLessonCompletionStatus = useCallback(
    (lesson: any) => {
      const hwIds = (lesson.homework_files || [])
        .map((h: any) => String(h.id || "").trim().toLowerCase())
        .filter(Boolean);
      const testIds = (lesson.test_quizzes || [])
        .map((t: any) => String(t.id || "").trim().toLowerCase())
        .filter(Boolean);
      const targetIds = [...hwIds, ...testIds];

      if (targetIds.length === 0) return "in_progress";

      const doneCount = targetIds.filter((id) =>
        myAttempts.some((a) => {
          const aId = String(a.quizId || a.quiz_id || "").trim().toLowerCase();
          return aId === id;
        })
      ).length;

      if (doneCount === targetIds.length) return "completed";
      if (doneCount > 0) return "in_progress";
      return "not_started";
    },
    [myAttempts]
  );

  const findAttemptForLesson = useCallback(
    (quiz: any, lessonTitle: string, isHomeworkCheck: boolean) => {
      const qId = quiz?.id ? String(quiz.id).trim().toLowerCase() : "";
      const qTitle = quiz?.title ? normalizeStr(quiz.title) : "";
      const lesTitle = normalizeStr(lessonTitle);

      const matchLessonNum = lesTitle.match(/b[aà]i\s*(\d+)/i);
      const lessonNumKey = matchLessonNum ? `bài ${matchLessonNum[1]}` : "";

      return (
        (myAttempts || []).find((a) => {
          const aQuizId = String(a.quizId || a.quiz_id || a.exam_id || "")
            .trim()
            .toLowerCase();
          const aTitle = normalizeStr(a.quizTitle || a.examTitle || a.title || "");
          const isHw = Boolean(a.isHomework || a.is_homework || a.type === "homework");

          if (isHomeworkCheck && !isHw) return false;
          if (!isHomeworkCheck && isHw) return false;

          if (qId && aQuizId && aQuizId === qId) return true;

          const cleanQId = qId.replace(/^(exam-|prac-)/, "");
          const cleanAId = aQuizId.replace(/^(exam-|prac-)/, "");
          if (cleanQId && cleanAId && cleanQId === cleanAId) return true;

          if (
            qTitle &&
            aTitle &&
            (aTitle === qTitle || aTitle.includes(qTitle) || qTitle.includes(aTitle))
          )
            return true;
          if (lesTitle && aTitle && (aTitle.includes(lesTitle) || lesTitle.includes(aTitle)))
            return true;
          if (lessonNumKey && aTitle.includes(lessonNumKey)) return true;

          return false;
        }) || null
      );
    },
    [myAttempts]
  );

  const progressStats = useMemo(() => {
    let totalHw = 0;
    let submittedHw = 0;
    let totalTest = 0;
    let completedTest = 0;

    thptChapters.forEach((chap: any) => {
      (chap.lessons || []).forEach((les: any) => {
        (les.homework_files || []).forEach((hw: any) => {
          totalHw++;
          const att = findAttemptForLesson(hw, les.title, true);
          if (att) submittedHw++;
        });
        (les.test_quizzes || []).forEach((tq: any) => {
          totalTest++;
          const att = findAttemptForLesson(tq, les.title, false);
          if (att) completedTest++;
        });
      });
    });

    const totalTasks = totalHw + totalTest;
    const completedTasks = submittedHw + completedTest;
    const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalHw,
      submittedHw,
      totalTest,
      completedTest,
      totalTasks,
      completedTasks,
      percent
    };
  }, [thptChapters, findAttemptForLesson]);

  // TỰ ĐỘNG LỌC TỐI ĐA 5 NHIỆM VỤ (BTVN / KIỂM TRA) MỚI NHẤT CHƯA NỘP TỪ CẢ THPT & HSA CHO TAB OVERVIEW
  const pendingTasksList = useMemo(() => {
    const tasks: {
      key: string;
      lesson: any;
      taskTitle: string;
      lessonTitle: string;
      kindLabel: "BTVN" | "Kiểm tra";
      trackLabel: "THPT" | "HSA";
      metaText: string;
    }[] = [];

    allNormalizedChapters.forEach((chap: any) => {
      (chap.lessons || []).forEach((les: any) => {
        if (les?.is_locked) return;
        const trackLabel = les.category === "hsa" ? "HSA" : "THPT";
        const studyDate = les.study_date ? String(les.study_date).trim() : "";
        const lesMonth = Number(les.assigned_month) || 10;
        const lesWeek = Number(les.assigned_week) || 1;
        const metaText = studyDate
          ? `${studyDate} • Tuần ${lesWeek}`
          : `Tuần ${lesWeek} • Tháng ${lesMonth < 10 ? "0" + lesMonth : lesMonth}`;

        (les.homework_files || []).forEach((hw: any) => {
          if (!hw) return;
          const att = findAttemptForLesson(hw, les.title, true);
          if (!att) {
            tasks.push({
              key: `hw-${les.id}-${hw.id}`,
              lesson: les,
              taskTitle: hw.title || "Bài tập về nhà",
              lessonTitle: les.title,
              kindLabel: "BTVN",
              trackLabel,
              metaText
            });
          }
        });

        (les.test_quizzes || []).forEach((tq: any) => {
          if (!tq) return;
          const att = findAttemptForLesson(tq, les.title, false);
          if (!att) {
            tasks.push({
              key: `tq-${les.id}-${tq.id}`,
              lesson: les,
              taskTitle: tq.title || "Bài kiểm tra",
              lessonTitle: les.title,
              kindLabel: "Kiểm tra",
              trackLabel,
              metaText
            });
          }
        });
      });
    });

    return tasks.slice(0, 5);
  }, [allNormalizedChapters, findAttemptForLesson]);

  const currentWorkspaceAttempts = useMemo(() => {
    if (!workspacePracticeExam) return [];
    const targetId = String(workspacePracticeExam.id || "").trim().toLowerCase();
    const targetTitle = normalizeStr(workspacePracticeExam.title || "");
    return myAttempts.filter((a) => {
      const aId = String(a.quizId || a.quiz_id || a.exam_id || "").trim().toLowerCase();
      const aTitle = normalizeStr(a.quizTitle || a.examTitle || a.title || "");
      return (targetId && aId === targetId) || (targetTitle && aTitle === targetTitle);
    });
  }, [workspacePracticeExam, myAttempts]);

  // Nạp chi tiết câu hỏi của đúng đề được chọn rồi mở phòng thi HSA hoặc ExamEntryModal
  const handleTriggerExamEntryModal = useCallback(
    async (examObj: any, isHomeworkFlag: boolean = false) => {
      const fullExam = !isHomeworkFlag
        ? await ensurePracticeExamQuestionsLoaded(examObj)
        : examObj;

      if (!isHomeworkFlag && isHsaExamItem(fullExam)) {
        const payload = {
          ...fullExam,
          id: fullExam.id,
          title: fullExam.title || "Đề thi ĐGNL HSA",
          duration: fullExam.duration_minutes || fullExam.duration || 75,
          isHomework: false,
          isHsa: true,
          exam_format: "hsa"
        };
        setExamRoom(payload);
        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem("tct_active_exam_room", JSON.stringify(payload));
          } catch {}
        }
        return;
      }

      setEntryModalState({
        isOpen: true,
        exam: fullExam,
        isHomework: isHomeworkFlag
      });
    },
    [ensurePracticeExamQuestionsLoaded]
  );

  // Mở chế độ Xem lại bài làm (Tự động nạp câu hỏi + đáp án đã chọn từ Supabase nếu là đề HSA)
  const handleOpenReviewAttempt = useCallback(
    async (examObj: any, attemptObj: any) => {
      let resolvedExam = examObj;
      let resolvedAttempt = attemptObj;

      if (isHsaExamItem(examObj, attemptObj)) {
        resolvedExam = await ensurePracticeExamQuestionsLoaded(examObj);

        if (!resolvedAttempt?.answers && resolvedAttempt?.id) {
          try {
            const { data: attRow } = await supabase
              .from("exam_attempts")
              .select("id, answers, score")
              .eq("id", resolvedAttempt.id)
              .maybeSingle();
            if (attRow) {
              resolvedAttempt = { ...resolvedAttempt, ...attRow };
            }
          } catch {}
        }
      }

      setReviewAttemptData({
        exam: resolvedExam,
        attempt: resolvedAttempt
      });
    },
    [ensurePracticeExamQuestionsLoaded]
  );

  const handleDashboardPaperScanCompleted = useCallback(
    (attemptRecord: ExamAttempt) => {
      const scannedExam = activePaperScanState?.exam;
      setActivePaperScanState(null);
      fetchAuthAndData();
      if (attemptRecord && scannedExam) {
        setPaperReviewAttemptState({
          attempt: attemptRecord,
          exam: scannedExam
        });
      }
    },
    [activePaperScanState, fetchAuthAndData]
  );

  const handleOpenLesson = async (les: any) => {
    if (les?.is_locked) {
      setOfflineToast("🔒 Bài học chưa diễn ra, tài liệu và BTVN sẽ mở sau buổi học!");
      setTimeout(() => setOfflineToast(""), 3500);
      return;
    }

    try {
      const { data: lessonData } = await supabase
        .from("lessons")
        .select("lecture_files, handwritten_notes, test_quizzes, extra_resources, description")
        .eq("id", les.id)
        .maybeSingle();

      const { data: hwData } = await supabase
        .from("homeworks")
        .select("id, lesson_id, title, duration_minutes, is_quiz")
        .eq("lesson_id", les.id);

      const fullLesson = {
        ...les,
        ...(lessonData || {}),
        homework_files: hwData || []
      };

      setSelectedLesson(fullLesson);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("tct_active_lesson", JSON.stringify(fullLesson));
      }
    } catch (err) {
      console.error("Lỗi tải bài học:", err);
      setSelectedLesson(les);
    }
  };

  // RENDER THANH LỌC 4 PHÂN MÔN THPT TỐI GIẢN
  const renderThptCategoryFilterBar = () => (
    <div className="bg-white rounded-xl p-2.5 sm:px-3.5 border border-slate-200/90 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
      {(
        [
          { id: "all", label: "Tất cả", count: thptCategoryCounts.all },
          { id: "dai", label: "Đại số", count: thptCategoryCounts.dai },
          { id: "hinh", label: "Hình học", count: thptCategoryCounts.hinh },
          { id: "tong_on", label: "Tổng ôn", count: thptCategoryCounts.tong_on },
          { id: "tang_cuong", label: "Tăng cường", count: thptCategoryCounts.tang_cuong }
        ] as const
      ).map((tab) => {
        const isActive = selectedSubjectCategory === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSelectedSubjectCategory(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              isActive
                ? "bg-[#1D4ED8] text-white"
                : "bg-white text-slate-600 hover:bg-[#F8FAFC] border border-slate-200/90"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );

  // RENDER BẢNG LỊCH SỬ THI DÙNG CHUNG CHO THPT & HSA
  const renderPracticeHistoryTable = (historyList: any[], emptyMsg: string) => (
    <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="bg-[#F8FAFC] text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200/90">
            <tr>
              <th className="py-2.5 px-4 font-semibold">Tên đề thi</th>
              <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">Lượt làm</th>
              <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">
                Điểm cao nhất
              </th>
              <th className="py-2.5 px-3 font-semibold text-center whitespace-nowrap">Lần cuối</th>
              <th className="py-2.5 px-4 font-semibold text-right whitespace-nowrap">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {historyList.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-400 italic">
                  {emptyMsg}
                </td>
              </tr>
            ) : (
              historyList.map((grp: any) => (
                <tr key={grp.quizId} className="hover:bg-[#F8FAFC] transition">
                  <td className="py-3 px-4 min-w-[160px] max-w-xs">
                    <span className="font-semibold text-slate-800 block truncate">{grp.title}</span>
                    <span className="text-[11px] text-slate-400">{grp.category}</span>
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-xs">
                      {grp.attempts.length} lần
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center whitespace-nowrap">
                    <span className="font-bold text-[#1D4ED8] bg-blue-50 px-2.5 py-0.5 rounded text-xs border border-blue-200">
                      {grp.maxScore.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center text-slate-500 text-xs whitespace-nowrap">
                    {new Date(grp.lastDate).toLocaleDateString("vi-VN")}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => setHistoryModalExamId(grp.quizId)}
                      className="px-3 py-1 text-[#1D4ED8] hover:bg-blue-50 rounded-md text-xs font-semibold transition cursor-pointer"
                    >
                      Xem lại
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (paperReviewAttemptState) {
    return (
      <PaperReviewView
        attempt={paperReviewAttemptState.attempt}
        exam={paperReviewAttemptState.exam}
        profile={profile!}
        onBack={() => {
          setPaperReviewAttemptState(null);
          fetchAuthAndData();
        }}
      />
    );
  }

  if (activeDigitalSheetExam) {
    return (
      <DigitalAnswerSheetView
        exam={activeDigitalSheetExam.exam}
        profile={profile!}
        isHomework={activeDigitalSheetExam.isHomework}
        onBack={() => {
          setActiveDigitalSheetExam(null);
          fetchAuthAndData();
        }}
        onSubmitted={(attemptRecord) => {
          const submittedEx = activeDigitalSheetExam.exam;
          setActiveDigitalSheetExam(null);
          fetchAuthAndData();
          setPaperReviewAttemptState({
            attempt: attemptRecord,
            exam: submittedEx
          });
        }}
      />
    );
  }

  if (reviewAttemptData) {
    const isPaperOrDigital =
      reviewAttemptData.attempt?.submission_type === "paper" ||
      reviewAttemptData.attempt?.submission_type === "digital_sheet" ||
      Boolean(reviewAttemptData.attempt?.paper_scan_url);

    if (isPaperOrDigital) {
      return (
        <PaperReviewView
          attempt={reviewAttemptData.attempt}
          exam={reviewAttemptData.exam}
          profile={profile!}
          onBack={() => setReviewAttemptData(null)}
        />
      );
    }

    if (isHsaExamItem(reviewAttemptData.exam, reviewAttemptData.attempt)) {
      return (
        <HsaExamWorkspace
          key={
            "hsa-review-workspace-" +
            (reviewAttemptData.attempt?.id || reviewAttemptData.exam?.id || Date.now())
          }
          quizId={reviewAttemptData.exam.id}
          quizTitle={reviewAttemptData.exam.title}
          examData={reviewAttemptData.exam}
          profile={profile!}
          initialReviewMode={true}
          reviewAttempt={reviewAttemptData.attempt}
          onBackToDashboard={() => {
            setReviewAttemptData(null);
          }}
        />
      );
    }

    return (
      <ExamRoomView
        key={
          "review-room-" +
          (reviewAttemptData.attempt?.id || reviewAttemptData.exam?.id || Date.now())
        }
        quizId={reviewAttemptData.exam.id}
        quizTitle={reviewAttemptData.exam.title}
        durationMinutes={reviewAttemptData.exam.duration_minutes || 45}
        profile={profile!}
        isHomework={false}
        isReviewMode={true}
        reviewAttempt={reviewAttemptData.attempt}
        onBackToDashboard={() => {
          setReviewAttemptData(null);
        }}
      />
    );
  }

  if (examRoom) {
    if (!examRoom.isHomework && isHsaExamItem(examRoom)) {
      return (
        <HsaExamWorkspace
          key={"active-hsa-workspace-" + examRoom.id}
          quizId={examRoom.id}
          quizTitle={examRoom.title}
          examData={examRoom}
          profile={profile!}
          initialReviewMode={false}
          onBackToDashboard={() => {
            setExamRoom(null);
            if (typeof window !== "undefined") {
              sessionStorage.removeItem("tct_active_exam_room");
            }
            fetchAuthAndData();
          }}
        />
      );
    }

    return (
      <ExamRoomView
        key={"active-exam-" + examRoom.id}
        quizId={examRoom.id}
        quizTitle={examRoom.title}
        durationMinutes={examRoom.duration || 45}
        profile={profile!}
        isHomework={Boolean(examRoom.isHomework)}
        isReviewMode={false}
        onBackToDashboard={() => {
          setExamRoom(null);
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("tct_active_exam_room");
          }
          fetchAuthAndData();
        }}
      />
    );
  }

  if (selectedLesson) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={"lesson-workspace-" + selectedLesson.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed inset-0 z-[100]"
        >
          <LessonWorkspaceView
            lesson={selectedLesson}
            profile={profile}
            onBackToCatalog={() => {
              setSelectedLesson(null);
              if (typeof window !== "undefined") {
                sessionStorage.removeItem("tct_active_lesson");
              }
              fetchAuthAndData();
            }}
            onStartQuiz={async (
              qId: string,
              qTitle: string,
              isHomework: boolean,
              durationMinutes?: number,
              incomingExam?: any
            ) => {
              let targetExam: any = incomingExam;

              const ensureArray = (val: any) => {
                if (!val) return [];
                if (Array.isArray(val)) return val;
                if (typeof val === "string") {
                  try {
                    const parsed = JSON.parse(val);
                    if (Array.isArray(parsed)) return parsed;
                    if (parsed && typeof parsed === "object") {
                      if (Array.isArray(parsed.sections)) return parsed.sections;
                      if (Array.isArray(parsed.data)) return parsed.data;
                      if (Array.isArray(parsed.questions)) return parsed.questions;
                    }
                  } catch {}
                }
                if (typeof val === "object") {
                  if (Array.isArray(val.sections)) return val.sections;
                  if (Array.isArray(val.data)) return val.data;
                  if (Array.isArray(val.questions)) return val.questions;
                }
                return [];
              };

              const hasQuestions = (ex: any) => {
                if (!ex) return false;
                return (
                  ensureArray(ex.data).length > 0 ||
                  ensureArray(ex.sections).length > 0 ||
                  ensureArray(ex.questions).length > 0
                );
              };

              if (
                !hasQuestions(targetExam) &&
                isHomework &&
                Array.isArray(selectedLesson?.homework_files)
              ) {
                const found = selectedLesson.homework_files.find(
                  (h: any) => h.id === qId || h.title === qTitle
                );
                if (hasQuestions(found)) targetExam = found;
              }

              if (!hasQuestions(targetExam) && isHomework) {
                try {
                  const { data: dbHw } = await supabase
                    .from("homeworks")
                    .select("id, title, data, media_map, duration_minutes")
                    .eq("id", qId)
                    .maybeSingle();

                  if (dbHw && hasQuestions(dbHw)) {
                    targetExam = dbHw;
                  } else if (!dbHw && qTitle) {
                    const { data: dbHwTitle } = await supabase
                      .from("homeworks")
                      .select("id, title, data, sections, media_map, duration_minutes")
                      .ilike("title", qTitle)
                      .limit(1)
                      .maybeSingle();
                    if (dbHwTitle && hasQuestions(dbHwTitle)) {
                      targetExam = dbHwTitle;
                    }
                  }
                } catch {}
              }

              if (!hasQuestions(targetExam)) {
                try {
                  const { data: dbExam } = await supabase
                    .from("practice_exams")
                    .select("id, title, data, duration_minutes")
                    .eq("id", qId)
                    .maybeSingle();
                  if (dbExam && hasQuestions(dbExam)) {
                    targetExam = dbExam;
                  }
                } catch {}
              }

              const rawSections =
                ensureArray(targetExam?.sections).length > 0
                  ? ensureArray(targetExam?.sections)
                  : ensureArray(targetExam?.data);

              let extractedQuestions = ensureArray(targetExam?.questions);
              if (extractedQuestions.length === 0 && Array.isArray(rawSections)) {
                if (
                  rawSections.length > 0 &&
                  (rawSections[0]?.prompt || rawSections[0]?.question || rawSections[0]?.options)
                ) {
                  extractedQuestions = rawSections;
                } else {
                  rawSections.forEach((sec: any) => {
                    if (Array.isArray(sec.questions)) {
                      extractedQuestions.push(...sec.questions);
                    }
                  });
                }
              }

              const examRoomPayload = {
                id: qId,
                title: qTitle,
                duration: isHomework ? 0 : durationMinutes || 45,
                isHomework,
                ...(targetExam || {}),
                data: rawSections,
                sections: rawSections,
                questions: extractedQuestions.length > 0 ? extractedQuestions : undefined
              };

              setExamRoom(examRoomPayload);
              if (typeof window !== "undefined") {
                sessionStorage.setItem("tct_active_exam_room", JSON.stringify(examRoomPayload));
                sessionStorage.setItem("edunexus_active_exam", JSON.stringify(examRoomPayload));
                try {
                  const qList = JSON.parse(localStorage.getItem("edunexus_quizzes") || "[]");
                  localStorage.setItem(
                    "edunexus_quizzes",
                    JSON.stringify([...qList.filter((x: any) => x.id !== qId), examRoomPayload])
                  );

                  const pList = JSON.parse(localStorage.getItem("edunexus_practice_exams") || "[]");
                  localStorage.setItem(
                    "edunexus_practice_exams",
                    JSON.stringify([...pList.filter((x: any) => x.id !== qId), examRoomPayload])
                  );
                } catch {}
              }
            }}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  if (workspacePracticeExam) {
    return (
      <AnimatePresence mode="wait">
        <PracticeExamWorkspace
          key={"practice-workspace-" + workspacePracticeExam.id}
          exam={workspacePracticeExam}
          profile={profile!}
          attempts={currentWorkspaceAttempts}
          onBack={() => setWorkspacePracticeExam(null)}
          onRetake={() => {
            const exam = workspacePracticeExam;
            setWorkspacePracticeExam(null);
            handleTriggerExamEntryModal(exam, false);
          }}
          onViewFile={() => setPreviewExam(workspacePracticeExam)}
          onReviewAttempt={(att) => {
            handleOpenReviewAttempt(workspacePracticeExam, att);
          }}
        />
      </AnimatePresence>
    );
  }

  return (
    <div className="h-screen w-full bg-[#F8FAFC] antialiased text-slate-800 tracking-normal leading-relaxed flex overflow-hidden relative selection:bg-blue-500/20">
      <AnimatePresence>
        {offlineToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 sm:top-5 left-3 right-3 sm:left-auto sm:right-5 z-[500] max-w-[calc(100vw-1.5rem)] sm:max-w-md bg-slate-900 text-white px-4 py-2.5 rounded-xl border border-slate-700 flex items-center gap-2 font-semibold text-xs sm:text-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="leading-snug">{offlineToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={
          "h-full shrink-0 transition-[width,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden hidden md:block z-40 " +
          (isSidebarOpen ? "w-60 opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-10")
        }
        style={{ willChange: "width, transform" }}
      >
        <div className="w-60 h-full">
          <Sidebar
            user={profile!}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onToggleSidebar={() => setIsSidebarOpen(false)}
            onLogout={onLogout}
          />
        </div>
      </div>

      <div className="md:hidden">
        <Sidebar
          user={profile!}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onToggleSidebar={() => {}}
          onLogout={onLogout}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <div className="shrink-0 w-full">
          <Header
            user={profile!}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            allAttempts={allAttempts}
            practiceExams={practiceExams}
            sysNotifications={sysNotifications}
          />
        </div>

        <main className="flex-1 p-3 sm:p-4 md:px-6 md:py-5 pb-20 md:pb-6 overflow-y-auto overflow-x-hidden custom-scrollbar transition-all duration-300 ease-in-out w-full">
          {isTabChanging ? (
            <div className="max-w-5xl mx-auto space-y-4 animate-pulse">
              <div className="h-14 bg-slate-200/70 rounded-xl w-full" />
              <div className="h-32 bg-slate-200/60 rounded-xl w-full" />
              <div className="space-y-2.5">
                <div className="h-12 bg-slate-200/50 rounded-xl w-full" />
                <div className="h-12 bg-slate-200/50 rounded-xl w-full" />
              </div>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16, ease: "easeInOut" }}
                className="w-full"
              >
                {/* ================================================================= */}
                {/* TAB 1: `overview` (TỔNG QUAN — 3 KHỐI TINH GỌN "HÔM NAY CẦN LÀM GÌ?") */}
                {/* ================================================================= */}
                {activeTab === "overview" && (
                  <div className="w-full max-w-5xl mx-auto space-y-4 text-left">
                    {/* KHỐI 1: THANH CHÀO MỪNG 1 DÒNG GỌN GÀNG */}
                    <div className="bg-white rounded-xl p-4 border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
                        <span className="text-sm font-bold text-slate-900">
                          {profile?.full_name || "Học sinh"}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs font-mono font-semibold text-[#1D4ED8]">
                          SBD {studentAutoSbd}
                        </span>
                        <span className="hidden sm:inline text-slate-300">•</span>
                        {isEditingGoal ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={tempGoal}
                              onChange={(e) => setTempGoal(e.target.value)}
                              className="w-56 px-2.5 py-1 border border-[#1D4ED8] rounded-lg text-xs font-medium text-slate-800 outline-none bg-white"
                            />
                            <button
                              type="button"
                              onClick={handleSaveGoal}
                              className="px-2.5 py-1 bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold cursor-pointer"
                            >
                              Lưu
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs text-slate-600 truncate max-w-md">
                              Mục tiêu: <strong className="text-slate-800">{studyGoal}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setTempGoal(studyGoal);
                                setIsEditingGoal(true);
                              }}
                              className="p-1 text-slate-400 hover:text-[#1D4ED8] cursor-pointer"
                              title="Sửa mục tiêu học tập"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 shrink-0">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Hôm nay: {formattedStudyTimeToday}</span>
                      </div>
                    </div>

                    {/* KHỐI 2: NHIỆM VỤ CHƯA HOÀN THÀNH (VIỆC CẦN LÀM NGAY - TỐI ĐA 5 BÀI) */}
                    <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-200/90 bg-[#F8FAFC] flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          Việc cần làm ngay ({pendingTasksList.length})
                        </h3>
                        <button
                          type="button"
                          onClick={() => setActiveTab("progress")}
                          className="text-xs font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                        >
                          Xem toàn bộ tiến độ →
                        </button>
                      </div>

                      {pendingTasksList.length === 0 ? (
                        <div className="p-6 text-center space-y-1">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                          <p className="text-xs font-semibold text-slate-700">
                            Bạn đã hoàn thành toàn bộ bài tập hiện có.
                          </p>
                          <p className="text-xs text-slate-400">
                            Hãy chọn 1 đề thi thử THPT hoặc ĐGNL HSA để rèn luyện thêm.
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {pendingTasksList.map((task) => (
                            <div
                              key={task.key}
                              onClick={() => handleOpenLesson(task.lesson)}
                              className="px-4 py-3 hover:bg-[#F8FAFC] transition flex items-center justify-between gap-3 cursor-pointer group"
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-[#1D4ED8] border border-blue-200 shrink-0">
                                    {task.trackLabel} • {task.kindLabel}
                                  </span>
                                  <span className="text-sm font-semibold text-slate-900 truncate group-hover:text-[#1D4ED8]">
                                    {task.taskTitle}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                  {task.lessonTitle} • {task.metaText}
                                </div>
                              </div>

                              <span className="text-xs font-semibold text-[#1D4ED8] flex items-center gap-1 shrink-0">
                                <span>Làm ngay</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* KHỐI 3: 2 THẺ ĐIỀU HƯỚNG NHANH (LỘ TRÌNH SONG SONG THPT & ĐGNL HSA) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Thẻ 1: Ôn thi THPT */}
                      <div className="bg-white rounded-xl border border-slate-200/90 p-5 flex flex-col justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-[#1D4ED8] flex items-center justify-center">
                                <BookOpen className="w-4 h-4" />
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-slate-900">
                                  Ôn thi THPT (Bài học & Luyện đề)
                                </h3>
                                <p className="text-xs text-slate-500">
                                  {thptChapters.length} chương • {thptPracticeExams.length} đề luyện
                                </p>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-[#1D4ED8]">
                              {progressStats.percent}%
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#1D4ED8] rounded-full transition-all duration-300"
                                style={{ width: `${progressStats.percent}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-slate-500">
                              Hoàn thành {progressStats.completedTasks}/{progressStats.totalTasks}{" "}
                              nhiệm vụ BTVN & Kiểm tra
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setActiveTab("courses")}
                            className="flex-1 py-2 px-3 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-semibold transition cursor-pointer"
                          >
                            Bài học THPT →
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab("practice")}
                            className="py-2 px-3 rounded-lg bg-white hover:bg-[#F8FAFC] text-slate-700 border border-slate-200/90 text-xs font-semibold transition cursor-pointer"
                          >
                            Luyện đề THPT
                          </button>
                        </div>
                      </div>

                      {/* Thẻ 2: Luyện thi ĐGNL HSA */}
                      <div className="bg-white rounded-xl border border-slate-200/90 p-5 flex flex-col justify-between gap-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-lg bg-[#F8FAFC] border border-slate-200/90 text-[#1D4ED8] flex items-center justify-center">
                                <GraduationCap className="w-4 h-4" />
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-slate-900">
                                  Luyện thi ĐGNL HSA (ĐHQGHN)
                                </h3>
                                <p className="text-xs text-slate-500">
                                  {hsaLessonsTotalCount} chuyên đề tổng ôn •{" "}
                                  {hsaPracticeExams.length} đề thi chuẩn HSA
                                </p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1D4ED8] border border-blue-200 text-[11px] font-bold">
                              150đ
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 leading-relaxed">
                            Phòng thi mô phỏng chuẩn ĐHQGHN (2 phần bắt buộc + 1 phần tự chọn), lưu
                            tiến trình theo từng phần thi.
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setActiveTab("hsa_practice")}
                            className="flex-1 py-2 px-3 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-semibold transition cursor-pointer"
                          >
                            Phòng luyện HSA →
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab("hsa_courses")}
                            className="py-2 px-3 rounded-lg bg-white hover:bg-[#F8FAFC] text-slate-700 border border-slate-200/90 text-xs font-semibold transition cursor-pointer"
                          >
                            Tổng ôn HSA
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ================================================================= */}
                {/* TAB 2: `courses` (BÀI HỌC & KIỂM TRA THPT — TỐI GIẢN, DỄ QUÉT)     */}
                {/* ================================================================= */}
                {activeTab === "courses" && (
                  <div className="max-w-5xl mx-auto space-y-4 text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          Bài học & Kiểm tra THPT
                        </h2>
                        <p className="text-xs text-slate-500">
                          Toàn bộ chương trình học từ đầu năm đến hiện tại để bạn ôn tập và xem lại
                          dễ dàng.
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        {thptCategoryCounts.all} bài học
                      </span>
                    </div>

                    {renderThptCategoryFilterBar()}

                    <div className="space-y-3.5">
                      {filteredThptChapters.length === 0 ? (
                        <div className="bg-white p-8 rounded-xl border border-slate-200/90 text-center text-slate-400 text-xs">
                          Chưa có bài học THPT nào phù hợp với bộ lọc hiện tại.
                        </div>
                      ) : (
                        filteredThptChapters.map((chap: any, idx: number) => {
                          const isCollapsed = Boolean(collapsedChapters[chap.id]);
                          const lessonCount = chap.lessons?.length || 0;

                          return (
                            <div
                              key={chap.id || idx}
                              className="bg-white rounded-xl border border-slate-200/90 overflow-hidden"
                            >
                              <button
                                type="button"
                                onClick={() => toggleChapterCollapse(chap.id)}
                                className="w-full px-4 py-3 bg-[#F8FAFC] hover:bg-slate-100/70 border-b border-slate-200/90 flex items-center justify-between gap-2 text-left transition cursor-pointer"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[11px] font-bold text-[#1D4ED8] shrink-0">
                                    Chương {chap.originalChapNumber || idx + 1}
                                  </span>
                                  <span className="text-slate-300">•</span>
                                  <h3 className="font-semibold text-slate-900 text-sm truncate">
                                    {chap.title}
                                  </h3>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-xs text-slate-500">
                                    {lessonCount} bài
                                  </span>
                                  {isCollapsed ? (
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                  ) : (
                                    <ChevronUp className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>
                              </button>

                              {!isCollapsed && (
                                <div className="divide-y divide-slate-100">
                                  {(chap.lessons || []).map((les: any, lIdx: number) => {
                                    const status = getLessonCompletionStatus(les);
                                    const docCount =
                                      (les.lecture_files?.length || 0) +
                                      (les.homework_files?.length || 0);
                                    const isLocked = Boolean(les.is_locked);
                                    const lesMonth = Number(les.assigned_month) || 10;
                                    const lesWeek = Number(les.assigned_week) || 1;
                                    const studyDate = les.study_date
                                      ? String(les.study_date).trim()
                                      : `Tháng ${lesMonth < 10 ? "0" + lesMonth : lesMonth}`;

                                    return (
                                      <div
                                        key={les.id || lIdx}
                                        className={`px-4 py-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                          isLocked ? "bg-[#F8FAFC] opacity-75" : "hover:bg-[#F8FAFC]"
                                        }`}
                                      >
                                        <div className="min-w-0 space-y-1 flex-1">
                                          <h4
                                            className={`text-sm font-semibold break-words ${
                                              isLocked
                                                ? "text-slate-500"
                                                : "text-slate-900"
                                            }`}
                                          >
                                            {les.title}
                                          </h4>
                                          <p className="text-xs text-slate-500">
                                            {studyDate} • Tuần {lesWeek} • {docCount} tài liệu &
                                            BTVN
                                          </p>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                          {isLocked ? (
                                            <span className="text-xs font-medium text-slate-500">
                                              Chưa mở
                                            </span>
                                          ) : status === "completed" ? (
                                            <span className="text-xs font-semibold text-emerald-700">
                                              Hoàn thành ✓
                                            </span>
                                          ) : status === "in_progress" ? (
                                            <span className="text-xs font-medium text-[#1D4ED8]">
                                              Đang học
                                            </span>
                                          ) : (
                                            <span className="text-xs font-medium text-slate-400">
                                              Chưa học
                                            </span>
                                          )}

                                          <button
                                            type="button"
                                            onClick={() => handleOpenLesson(les)}
                                            className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                                              isLocked
                                                ? "bg-slate-200 text-slate-600"
                                                : "bg-[#1D4ED8] hover:bg-blue-800 text-white"
                                            }`}
                                          >
                                            {isLocked ? (
                                              <>
                                                <Lock className="w-3.5 h-3.5" />
                                                <span>Khóa</span>
                                              </>
                                            ) : (
                                              <>
                                                <span>Vào học</span>
                                                <ArrowRight className="w-3.5 h-3.5" />
                                              </>
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* ================================================================= */}
                {/* TAB 3: `practice` (LUYỆN ĐỀ THPT — CHỈ ĐỀ THPT, THẺ TỐI GIẢN)      */}
                {/* ================================================================= */}
                {activeTab === "practice" && (
                  <div className="max-w-6xl mx-auto space-y-4 text-left">
                    <div className="bg-white p-4 rounded-xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">Luyện đề THPT</h2>
                        <p className="text-xs text-slate-500">
                          {isLoadingExams
                            ? "Đang tải danh sách đề thi..."
                            : `${thptPracticeExams.length} đề thi THPT & ĐGTD sẵn sàng • SBD: ${studentAutoSbd}`}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:flex bg-[#F8FAFC] p-1 rounded-lg border border-slate-200/90 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPracticeSubTab("list")}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            practiceSubTab === "list"
                              ? "bg-[#1D4ED8] text-white"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <Library className="w-3.5 h-3.5" /> Danh sách đề
                        </button>
                        <button
                          type="button"
                          onClick={() => setPracticeSubTab("history")}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            practiceSubTab === "history"
                              ? "bg-[#1D4ED8] text-white"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <BarChart3 className="w-3.5 h-3.5" /> Lịch sử làm bài
                        </button>
                      </div>
                    </div>

                    {practiceSubTab === "list" && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                          {[
                            "Tất cả đề",
                            "Tốt Nghiệp THPT",
                            "Giữa Kì 1",
                            "Học Kì 1",
                            "Giữa Kì 2",
                            "Học Kì 2",
                            "ĐGTD TSA (ĐHBK)"
                          ].map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedPracticeCategory(cat)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition cursor-pointer ${
                                selectedPracticeCategory === cat
                                  ? "bg-[#1D4ED8] text-white"
                                  : "bg-white text-slate-600 border border-slate-200/90 hover:bg-[#F8FAFC]"
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>

                        {isLoadingExams ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                              <div
                                key={i}
                                className="p-4 rounded-xl border border-slate-200/90 bg-white space-y-3 animate-pulse"
                              >
                                <div className="h-4 w-24 bg-slate-200 rounded" />
                                <div className="h-4 w-3/4 bg-slate-200 rounded" />
                                <div className="h-9 w-full bg-slate-100 rounded-lg" />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {thptPracticeExams
                              .filter((e) =>
                                selectedPracticeCategory === "Tất cả đề"
                                  ? true
                                  : e.category === selectedPracticeCategory
                              )
                              .filter((e) =>
                                String(e.title || "")
                                  .toLowerCase()
                                  .includes(searchQuery.toLowerCase())
                              )
                              .map((exam) => {
                                const qCount =
                                  exam.data?.reduce(
                                    (acc: number, sec: any) => acc + (sec.questions?.length || 0),
                                    0
                                  ) || 0;

                                return (
                                  <div
                                    key={exam.id}
                                    className="bg-white border border-slate-200/90 rounded-xl p-4 hover:border-slate-300 transition flex flex-col justify-between gap-4"
                                  >
                                    <div className="space-y-1.5">
                                      <p className="text-[11px] font-medium text-slate-500">
                                        {exam.category || "Luyện đề THPT"} •{" "}
                                        {exam.duration_minutes || 45} phút
                                        {qCount > 0 ? ` • ${qCount} câu` : ""}
                                      </p>
                                      <h3 className="text-sm font-bold text-slate-900 line-clamp-2">
                                        {exam.title}
                                      </h3>
                                    </div>

                                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setWorkspacePracticeExam(exam)}
                                        className="px-3 py-2 bg-white hover:bg-[#F8FAFC] text-slate-700 rounded-lg border border-slate-200/90 text-xs font-semibold transition cursor-pointer shrink-0"
                                      >
                                        Tài liệu & Chữa đề
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleTriggerExamEntryModal(exam, false)}
                                        className="flex-1 py-2 px-3 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                                      >
                                        <span>Vào thi</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    )}

                    {practiceSubTab === "history" &&
                      renderPracticeHistoryTable(
                        thptHistoryGrouped,
                        "Bạn chưa hoàn thành đề luyện THPT nào."
                      )}
                  </div>
                )}

                {/* ================================================================= */}
                {/* TAB 4: `hsa_courses` (TỔNG ÔN HSA — TAB MỚI TÁCH RIÊNG)            */}
                {/* ================================================================= */}
                {activeTab === "hsa_courses" && (
                  <div className="max-w-5xl mx-auto space-y-4 text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          Tổng ôn ĐGNL HSA (ĐHQGHN)
                        </h2>
                        <p className="text-xs text-slate-500">
                          Hệ thống chuyên đề, video bài giảng và bài tập luyện thi Đánh giá năng lực.
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">
                        {hsaLessonsTotalCount} chuyên đề
                      </span>
                    </div>

                    {/* Bộ lọc nhanh theo mảng kiến thức HSA */}
                    <div className="bg-white rounded-xl p-2.5 sm:px-3.5 border border-slate-200/90 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                      {(
                        [
                          { id: "all", label: "Tất cả" },
                          { id: "quant", label: "Tư duy Định lượng" },
                          { id: "qual", label: "Tư duy Định tính" },
                          { id: "elective", label: "Tiếng Anh & Khoa học" }
                        ] as const
                      ).map((dom) => (
                        <button
                          key={dom.id}
                          type="button"
                          onClick={() => setSelectedHsaDomain(dom.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                            selectedHsaDomain === dom.id
                              ? "bg-[#1D4ED8] text-white"
                              : "bg-white text-slate-600 hover:bg-[#F8FAFC] border border-slate-200/90"
                          }`}
                        >
                          {dom.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3.5">
                      {filteredHsaChapters.length === 0 ? (
                        <div className="bg-white p-10 rounded-xl border border-slate-200/90 text-center space-y-1.5">
                          <p className="text-sm font-semibold text-slate-700">
                            Chưa có chuyên đề Tổng ôn HSA trong mục này
                          </p>
                          <p className="text-xs text-slate-400">
                            Các buổi học và tài liệu phân môn HSA sẽ tự động hiển thị tại đây khi
                            giáo viên cập nhật.
                          </p>
                        </div>
                      ) : (
                        filteredHsaChapters.map((chap: any, idx: number) => (
                          <div
                            key={chap.id || idx}
                            className="bg-white rounded-xl border border-slate-200/90 overflow-hidden"
                          >
                            <div className="px-4 py-3 bg-[#F8FAFC] border-b border-slate-200/90 flex items-center justify-between gap-2">
                              <h3 className="font-semibold text-slate-900 text-sm truncate">
                                {chap.title}
                              </h3>
                              <span className="text-xs text-slate-500 shrink-0">
                                {chap.lessons.length} buổi học
                              </span>
                            </div>

                            <div className="divide-y divide-slate-100">
                              {chap.lessons.map((les: any, lIdx: number) => {
                                const status = getLessonCompletionStatus(les);
                                const docCount =
                                  (les.lecture_files?.length || 0) +
                                  (les.homework_files?.length || 0);
                                const isLocked = Boolean(les.is_locked);
                                const lesMonth = Number(les.assigned_month) || 10;
                                const lesWeek = Number(les.assigned_week) || 1;
                                const studyDate = les.study_date
                                  ? String(les.study_date).trim()
                                  : `Tháng ${lesMonth < 10 ? "0" + lesMonth : lesMonth}`;

                                return (
                                  <div
                                    key={les.id || lIdx}
                                    className="px-4 py-3.5 hover:bg-[#F8FAFC] transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                  >
                                    <div className="min-w-0 space-y-1 flex-1">
                                      <h4 className="text-sm font-semibold text-slate-900 break-words">
                                        {les.title}
                                      </h4>
                                      <p className="text-xs text-slate-500">
                                        {studyDate} • Tuần {lesWeek} • {docCount} tài liệu & BTVN
                                        HSA
                                      </p>
                                    </div>

                                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                      {status === "completed" ? (
                                        <span className="text-xs font-semibold text-emerald-700">
                                          Hoàn thành ✓
                                        </span>
                                      ) : status === "in_progress" ? (
                                        <span className="text-xs font-medium text-[#1D4ED8]">
                                          Đang học
                                        </span>
                                      ) : (
                                        <span className="text-xs font-medium text-slate-400">
                                          Chưa học
                                        </span>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => handleOpenLesson(les)}
                                        className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                                          isLocked
                                            ? "bg-slate-200 text-slate-600"
                                            : "bg-[#1D4ED8] hover:bg-blue-800 text-white"
                                        }`}
                                      >
                                        <span>{isLocked ? "Chưa mở" : "Vào học"}</span>
                                        {!isLocked && <ArrowRight className="w-3.5 h-3.5" />}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* ================================================================= */}
                {/* TAB 5: `hsa_practice` (PHÒNG LUYỆN HSA — TAB MỚI TÁCH RIÊNG)       */}
                {/* ================================================================= */}
                {activeTab === "hsa_practice" && (
                  <div className="max-w-6xl mx-auto space-y-4 text-left">
                    <div className="bg-white p-4 rounded-xl border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          Phòng luyện thi ĐGNL HSA (ĐHQGHN)
                        </h2>
                        <p className="text-xs text-slate-500">
                          {isLoadingExams
                            ? "Đang tải bộ đề HSA..."
                            : `${hsaPracticeExams.length} đề thi chuẩn ĐHQGHN (Thang 150 điểm) • SBD: ${studentAutoSbd}`}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:flex bg-[#F8FAFC] p-1 rounded-lg border border-slate-200/90 shrink-0">
                        <button
                          type="button"
                          onClick={() => setHsaPracticeSubTab("list")}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            hsaPracticeSubTab === "list"
                              ? "bg-[#1D4ED8] text-white"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <Library className="w-3.5 h-3.5" /> Danh sách đề HSA
                        </button>
                        <button
                          type="button"
                          onClick={() => setHsaPracticeSubTab("history")}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                            hsaPracticeSubTab === "history"
                              ? "bg-[#1D4ED8] text-white"
                              : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          <BarChart3 className="w-3.5 h-3.5" /> Lịch sử thi HSA
                        </button>
                      </div>
                    </div>

                    {hsaPracticeSubTab === "list" && (
                      <>
                        {isLoadingExams ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="p-4 rounded-xl border border-slate-200/90 bg-white space-y-3 animate-pulse"
                              >
                                <div className="h-4 w-32 bg-slate-200 rounded" />
                                <div className="h-4 w-3/4 bg-slate-200 rounded" />
                                <div className="h-9 w-full bg-slate-100 rounded-lg" />
                              </div>
                            ))}
                          </div>
                        ) : hsaPracticeExams.length === 0 ? (
                          <div className="bg-white p-10 rounded-xl border border-slate-200/90 text-center space-y-1.5">
                            <p className="text-sm font-semibold text-slate-700">
                              Chưa có đề thi ĐGNL HSA nào được mở
                            </p>
                            <p className="text-xs text-slate-400">
                              Các đề thi thử chuẩn ĐHQGHN sẽ hiển thị tại đây ngay khi giáo viên
                              xuất bản.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {hsaPracticeExams
                              .filter((e) =>
                                String(e.title || "")
                                  .toLowerCase()
                                  .includes(searchQuery.toLowerCase())
                              )
                              .map((exam) => {
                                const hsaMeta = getHsaDisplayMeta(exam);
                                return (
                                  <div
                                    key={exam.id}
                                    className="bg-white border border-slate-200/90 rounded-xl p-4 hover:border-slate-300 transition flex flex-col justify-between gap-4"
                                  >
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-semibold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 truncate">
                                          {hsaMeta.badgeLabel}
                                        </span>
                                        <span className="text-[11px] text-slate-500 shrink-0">
                                          {exam.duration_minutes || 195}p
                                        </span>
                                      </div>
                                      <h3 className="text-sm font-bold text-slate-900 line-clamp-2">
                                        {exam.title}
                                      </h3>
                                      <p className="text-xs text-slate-500">
                                        2 phần bắt buộc + 1 phần tự chọn • Lưu tiến trình theo từng
                                        phần
                                      </p>
                                    </div>

                                    <div className="pt-3 border-t border-slate-100">
                                      <button
                                        type="button"
                                        onClick={() => handleTriggerExamEntryModal(exam, false)}
                                        className="w-full py-2.5 px-4 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                                      >
                                        <span>Vào phòng thi HSA</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </>
                    )}

                    {hsaPracticeSubTab === "history" &&
                      renderPracticeHistoryTable(
                        hsaHistoryGrouped,
                        "Bạn chưa hoàn thành đề thi ĐGNL HSA nào."
                      )}
                  </div>
                )}

                {activeTab === "schedule" && (
                  <div className="space-y-4 max-w-5xl mx-auto text-left">
                    <ScheduleView profile={profile} mode="offline" />
                  </div>
                )}

                {/* TAB `progress` & `assessments` (TIẾN ĐỘ & ĐÁNH GIÁ) */}
                {(activeTab === "progress" || activeTab === "assessments") && (
                  <div className="max-w-5xl mx-auto space-y-4 text-left">
                    <div className="bg-white rounded-xl p-4 border border-slate-200/90 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Tiến độ nhiệm vụ học tập
                          </h3>
                          <p className="text-xs text-slate-500">
                            Bạn đã hoàn thành{" "}
                            <span className="font-bold text-[#1D4ED8]">
                              {progressStats.completedTasks}/{progressStats.totalTasks}
                            </span>{" "}
                            nhiệm vụ.
                          </p>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <div className="px-3 py-1.5 bg-[#F8FAFC] border border-slate-200/90 rounded-lg">
                            BTVN:{" "}
                            <strong className="text-slate-900">
                              {progressStats.submittedHw}/{progressStats.totalHw}
                            </strong>
                          </div>
                          <div className="px-3 py-1.5 bg-[#F8FAFC] border border-slate-200/90 rounded-lg">
                            Kiểm tra:{" "}
                            <strong className="text-slate-900">
                              {progressStats.completedTest}/{progressStats.totalTest}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1D4ED8] rounded-full transition-all duration-300"
                            style={{ width: `${progressStats.percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-400">
                          <span>Tiến độ chung</span>
                          <span className="font-bold text-[#1D4ED8]">
                            {progressStats.percent}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {renderThptCategoryFilterBar()}

                    <div className="space-y-3.5">
                      {filteredThptChapters.map((chap: any, cIdx: number) => (
                        <div
                          key={chap.id || cIdx}
                          className="bg-white rounded-xl border border-slate-200/90 overflow-hidden"
                        >
                          <div className="px-4 py-3 bg-[#F8FAFC] border-b border-slate-200/90 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                            <h4 className="font-semibold text-slate-900 text-xs sm:text-sm break-words">
                              {chap.title}
                            </h4>
                          </div>

                          <div className="divide-y divide-slate-100">
                            {(chap.lessons || []).map((les: any, lIdx: number) => {
                              const hwList = les.homework_files || [];
                              const testList = les.test_quizzes || [];
                              const hwAttempt = findAttemptForLesson(hwList[0], les.title, true);
                              const testAttempt = findAttemptForLesson(
                                testList[0],
                                les.title,
                                false
                              );

                              return (
                                <div
                                  key={les.id || lIdx}
                                  className="py-3 px-4 hover:bg-[#F8FAFC] transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                                >
                                  <span className="text-sm font-medium text-slate-800 break-words flex-1">
                                    {les.title}
                                  </span>

                                  <div className="flex items-center gap-3 shrink-0 text-xs">
                                    {hwList.length > 0 ? (
                                      hwAttempt ? (
                                        <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                                          BTVN: {Number(hwAttempt.score ?? hwAttempt.points ?? 0).toFixed(1)}đ
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-1 rounded-md bg-[#F8FAFC] text-slate-500 border border-slate-200/90">
                                          Chưa nộp BTVN
                                        </span>
                                      )
                                    ) : null}

                                    {testList.length > 0 ? (
                                      testAttempt ? (
                                        <span className="px-2.5 py-1 rounded-md bg-blue-50 text-[#1D4ED8] border border-blue-200 font-semibold">
                                          KT: {Number(testAttempt.score ?? testAttempt.points ?? 0).toFixed(1)}đ
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-1 rounded-md bg-[#F8FAFC] text-slate-500 border border-slate-200/90">
                                          Chưa thi KT
                                        </span>
                                      )
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "leaderboard" && (
                  <div className="max-w-5xl mx-auto text-left">
                    <StudentLeaderboardView
                      profile={profile!}
                      chapters={chapters}
                      allAttempts={allAttempts}
                      allowedMode="offline"
                    />
                  </div>
                )}

                {/* TAB `notifications` (TRUNG TÂM THÔNG BÁO) */}
                {activeTab === "notifications" && (
                  <div className="w-full max-w-5xl mx-auto space-y-3.5 text-left">
                    <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200/90">
                      <h2 className="text-sm sm:text-base font-bold text-slate-900">
                        Trung tâm thông báo
                      </h2>
                      <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        className="px-3 py-1.5 bg-blue-50 text-[#1D4ED8] font-semibold text-xs rounded-lg hover:bg-blue-100 transition cursor-pointer shrink-0"
                      >
                        Đã đọc tất cả
                      </button>
                    </div>
                    <div className="space-y-2">
                      {notificationsList.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200/90">
                          Chưa có thông báo nào.
                        </div>
                      ) : (
                        notificationsList.map((item) => {
                          const isUnread = !readNotifIds.includes(item.id);
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleActionFromCenter(item)}
                              className={
                                "p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer " +
                                (isUnread
                                  ? "bg-blue-50/30 border-[#1D4ED8]/40"
                                  : "bg-white border-slate-200/90 hover:border-slate-300")
                              }
                            >
                              <div className="flex items-start sm:items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-[#F8FAFC] text-[#1D4ED8] flex items-center justify-center shrink-0 border border-slate-200/90">
                                  <Clock className="w-4 h-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4
                                    className={
                                      "text-xs truncate " +
                                      (isUnread
                                        ? "font-bold text-[#1D4ED8]"
                                        : "font-semibold text-slate-800")
                                    }
                                  >
                                    {item.title}
                                  </h4>
                                  <p className="text-xs text-slate-500 line-clamp-2 sm:truncate">
                                    {item.desc}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[11px] text-slate-400 shrink-0 font-medium pl-11 sm:pl-0">
                                {item.dateStr}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* MODAL LỊCH SỬ LÀM BÀI */}
      {historyModalExamId && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistoryModalExamId(null);
          }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
        >
          <div className="bg-white rounded-xl w-full max-w-2xl border border-slate-200/90 flex flex-col overflow-hidden cursor-default">
            <div className="p-4 border-b border-slate-200/90 flex justify-between items-center bg-[#F8FAFC]">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <ListOrdered className="w-4 h-4 text-[#1D4ED8] shrink-0" /> Lịch sử làm bài
              </h3>
              <button
                type="button"
                onClick={() => setHistoryModalExamId(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto overflow-x-auto max-h-[60vh] custom-scrollbar">
              <table className="w-full min-w-[440px] text-left text-xs border border-slate-200/90 rounded-lg overflow-hidden">
                <thead className="bg-[#F8FAFC] text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200/90">
                  <tr>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Lần</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Thời gian nộp</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Hình thức</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Điểm số</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Xem bài</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {allPracticeHistoryGrouped
                    .find((g: any) => g.quizId === historyModalExamId)
                    ?.attempts.map((att: any, idx: number) => {
                      const grpObj = allPracticeHistoryGrouped.find(
                        (g: any) => g.quizId === historyModalExamId
                      );
                      const isMax = Number(att.score ?? att.points ?? 0) === grpObj?.maxScore;
                      const isDigitalSheet =
                        att.submission_type === "digital_sheet" ||
                        String(att.id || "").includes("att-paper-onl") ||
                        String(att.time_spent || att.timeSpent || "").includes("Phiếu Onl");
                      const isPaperScan =
                        !isDigitalSheet &&
                        (att.submission_type === "paper" || Boolean(att.paper_scan_url));

                      return (
                        <tr
                          key={idx}
                          className={"hover:bg-[#F8FAFC] " + (isMax ? "bg-blue-50/30" : "")}
                        >
                          <td className="py-2.5 px-3 text-center font-semibold text-slate-700 whitespace-nowrap">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            {new Date(
                              att.createdAt || att.created_at || att.submittedAt
                            ).toLocaleString("vi-VN")}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-[#F8FAFC] text-slate-700 border border-slate-200/90 text-[10px] font-semibold">
                              {isDigitalSheet
                                ? "Phiếu Onl"
                                : isPaperScan
                                  ? "Giấy (OMR)"
                                  : "Web"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <span className="font-bold text-[#1D4ED8]">
                              {Number(att.score ?? att.points ?? 0).toFixed(1)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={async () => {
                                const targetExam = practiceExams.find(
                                  (pe: any) => pe.id === historyModalExamId
                                ) || {
                                  id: historyModalExamId,
                                  title: grpObj?.title || "Đề thi",
                                  category: grpObj?.category || "Luyện đề",
                                  duration_minutes: 45
                                };
                                setHistoryModalExamId(null);
                                await handleOpenReviewAttempt(targetExam, att);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-[#1D4ED8] hover:bg-blue-100 font-semibold text-xs transition cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" /> Xem lại
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THÔNG BÁO HỆ THỐNG */}
      {selectedSysNotif && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSysNotif(null);
          }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
        >
          <div className="bg-white rounded-xl w-full max-w-md border border-slate-200/90 p-5 cursor-default">
            <h4 className="text-sm font-bold text-slate-900 mb-2 break-words">
              {selectedSysNotif.title}
            </h4>
            <div className="text-xs text-slate-600 leading-relaxed bg-[#F8FAFC] p-3.5 rounded-lg mb-4 border border-slate-200/90 max-h-[55vh] overflow-y-auto break-words">
              {selectedSysNotif.desc}
            </div>
            <button
              type="button"
              onClick={() => setSelectedSysNotif(null)}
              className="w-full py-2.5 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* MODAL XEM TRƯỚC ĐỀ THI */}
      {previewExam && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewExam(null);
          }}
          className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
        >
          <div className="bg-white rounded-xl w-full max-w-3xl border border-slate-200/90 flex flex-col max-h-[85vh] overflow-hidden cursor-default">
            <div className="p-4 border-b border-slate-200/90 flex justify-between items-center gap-2 bg-[#F8FAFC]">
              <h3 className="font-bold text-slate-900 text-sm truncate">
                Xem trước: {previewExam.title}
              </h3>
              <button
                type="button"
                onClick={() => setPreviewExam(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar space-y-3.5">
              {previewExam.data?.map((sec: any, sIdx: number) => (
                <div key={sIdx} className="space-y-2">
                  <h4 className="text-xs font-semibold text-[#1D4ED8] bg-blue-50 px-2.5 py-1 rounded inline-block">
                    {sec.section_title || "Phần câu hỏi"}
                  </h4>
                  {(sec.questions || []).map((q: any, qIdx: number) => (
                    <div
                      key={qIdx}
                      className="p-3.5 bg-[#F8FAFC] rounded-xl border border-slate-200/90 text-xs space-y-1.5 overflow-x-auto"
                    >
                      <div
                        className="font-medium break-words"
                        dangerouslySetInnerHTML={{ __html: q.prompt_html || q.prompt }}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {(q.options || []).map((opt: any, oIdx: number) => (
                          <div
                            key={oIdx}
                            className="p-2 bg-white rounded border border-slate-200/90 text-slate-700 break-words overflow-x-auto"
                          >
                            <span className="font-semibold text-[#1D4ED8] mr-1">{opt.key}.</span>
                            <span dangerouslySetInnerHTML={{ __html: opt.text_html || opt.text }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ExamEntryModal
        isOpen={entryModalState.isOpen}
        onClose={() =>
          setEntryModalState((prev) => ({
            ...prev,
            isOpen: false
          }))
        }
        exam={entryModalState.exam}
        isHomework={entryModalState.isHomework}
        studentSbd={studentAutoSbd}
        studentName={profile?.full_name || "Học sinh"}
        onSelectWeb={() => {
          const ex = entryModalState.exam;
          if (!ex) return;
          const payload = {
            id: ex.id,
            title: ex.title || "Đề thi",
            duration: ex.duration_minutes || ex.duration || 45,
            isHomework: entryModalState.isHomework,
            ...ex
          };
          setExamRoom(payload);
          if (typeof window !== "undefined") {
            sessionStorage.setItem("tct_active_exam_room", JSON.stringify(payload));
          }
        }}
        onSelectPaperScan={() => {
          const ex = entryModalState.exam;
          if (!ex) return;
          setActivePaperScanState({
            exam: ex,
            isHomework: entryModalState.isHomework
          });
        }}
        onSelectDigitalSheet={() => {
          const ex = entryModalState.exam;
          if (!ex) return;
          setActiveDigitalSheetExam({
            exam: ex,
            isHomework: entryModalState.isHomework
          });
        }}
      />

      {activePaperScanState && (
        <SafePaperScanModal
          isOpen={Boolean(activePaperScanState)}
          onClose={() => setActivePaperScanState(null)}
          exam={activePaperScanState.exam}
          profile={profile!}
          isHomework={activePaperScanState.isHomework}
          onSubmitted={handleDashboardPaperScanCompleted}
          onScanSuccess={handleDashboardPaperScanCompleted}
          onComplete={handleDashboardPaperScanCompleted}
        />
      )}
    </div>
  );
}

export default StudentOfflineDashboard;
