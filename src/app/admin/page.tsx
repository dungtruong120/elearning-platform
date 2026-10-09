"use client";

import React, { useState, useEffect, useCallback, useMemo, useTransition, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { STANDARD_SHIFTS } from "@/types";
import { AdminTab, INITIAL_CHAPTERS } from "@/types/admin";
import AdminStudentReportPanel from "@/components/admin/AdminStudentReportPanel";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import LessonsTab from "@/components/admin/tabs/LessonsTab";
import PracticeTab from "@/components/admin/tabs/PracticeTab";
import AnalyticsTab from "@/components/admin/tabs/AnalyticsTab";
import NotificationsTab from "@/components/admin/tabs/NotificationsTab";
import StudentsTab from "@/components/admin/tabs/StudentsTab";
import OnlineScheduleTab from "@/components/admin/tabs/OnlineScheduleTab";
import AdminModals from "@/components/admin/modals/AdminModals";

// HÀM CHUẨN HÓA TIÊU ĐỀ KHÔNG BỊ LỖI FONT TIẾNG VIỆT
function normalizeText(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function AdminDashboardContent() {
  const [mounted, setMounted] = useState(false);

  // 1. ĐỌC TAB TỪ URL HASH
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "") as AdminTab;
      const validTabs: AdminTab[] = ["lessons", "analytics", "practice", "notifications", "students", "online_schedule", "reports"];
      if (validTabs.includes(hash)) return hash;
    }
    return "lessons";
  });

  const [lessonModeTab, setLessonModeTab] = useState<"all" | "offline" | "online">("all");
  const [practiceSubTab, setPracticeSubTab] = useState<"manage" | "scores">("manage");

  // 2. KHỞI TẠO STATE TỪ LOCALSTORAGE TRÁNH MẤT TRẮNG DỮ LIỆU
  const [chapters, setChapters] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_course_data");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_CHAPTERS;
  });

  const [practiceExams, setPracticeExams] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_practice_exams");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [registeredStudents, setRegisteredStudents] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_registered_students");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });

  const [allAttempts, setAllAttempts] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_attempts");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });

  const [isLoadingExams, setIsLoadingExams] = useState<boolean>(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState<boolean>(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);

  // 3. STATE TIẾN TRÌNH TRUNG TÂM (FLOATING SYNC STATUS BAR)
  const [syncStatus, setSyncStatus] = useState<{
    isSyncing: boolean;
    progress: number;
    message: string;
    type: "idle" | "loading" | "success" | "error";
  }>({
    isSyncing: false,
    progress: 0,
    message: "",
    type: "idle"
  });

  const [isPending, startTransition] = useTransition();

  // REFS QUẢN LÝ DEBOUNCE QUEUE VÀ SNAPSHOT DỮ LIỆU MỚI NHẤT
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestChaptersRef = useRef<any[]>(chapters);
  latestChaptersRef.current = chapters;

  const [onlineSessions, setOnlineSessions] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_online_sessions");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [sysNotifications, setSysNotifications] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_system_notifications");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [attendanceRecords, setAttendanceRecords] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_attendance");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [sessionDates, setSessionDates] = useState<string[]>([
    "24/8", "26/8", "07/09", "09/09", "14/09", "16/09", "21/09", "24/09"
  ]);

  const [toastNotification, setToastNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isCreatingItem, setIsCreatingItem] = useState(false);

  const [uploadMode, setUploadMode] = useState<"course" | "practice">("course");
  const [practiceCategoryFilter, setPracticeCategoryFilter] = useState("Tất cả danh mục");
  const [rankingScope, setRankingScope] = useState<"lesson" | "chapter" | "course">("course");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("all");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("all");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifContent, setNotifContent] = useState("");
  const [notifType, setNotifType] = useState<"teacher" | "urgent" | "exam">("teacher");

  const [studentFilter, setStudentFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [studentSearch, setStudentSearch] = useState("");

  const [attendanceSearchText, setAttendanceSearchText] = useState<string>("");
  const [attendanceFilterMode, setAttendanceFilterMode] = useState<"all" | "online" | "offline">("all");
  const [attendanceSortAZ, setAttendanceSortAZ] = useState<boolean>(false);

  const [isAddDateModalOpen, setIsAddDateModalOpen] = useState<boolean>(false);
  const [newDateInput, setNewDateInput] = useState<string>("2026-09-24");
  const [newDateShift, setNewDateShift] = useState<string>("custom");
  const [newDateTimeSlot, setNewDateTimeSlot] = useState<string>("19:30 - 21:00");
  const [newDateAudience, setNewDateAudience] = useState<"all" | "online" | "offline">("all");
  const [newDateTitle, setNewDateTitle] = useState<string>("");

  const [newSessionForm, setNewSessionForm] = useState({
    title: "",
    isoDate: "2026-09-24",
    displayDate: "24/09",
    shiftId: "custom",
    shiftName: "Ca học",
    timeSlot: "19:30 - 21:00",
    meetingUrl: "",
    guideImagesText: "",
    audience: "all" as "online" | "offline" | "all"
  });

  const [testFile, setTestFile] = useState<File | null>(null);
  const [editingExamData, setEditingExamData] = useState<any | null>(null);
  const [azotaTarget, setAzotaTarget] = useState<{ lessonId: string; type: "homework_files" | "test_quizzes" } | null>(null);
  const [resourceModal, setResourceModal] = useState<any>(null);
  const [resTitle, setResTitle] = useState(""); 
  const [resUrl, setResUrl] = useState(""); 
  const [vidType, setVidType] = useState<"lecture" | "homework_solution">("lecture");

  const [createModal, setCreateModal] = useState<{ type: "chapter" | "lesson"; chapterId?: string } | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemFormat, setNewItemFormat] = useState("Zoom");
  const [newItemTargetMode, setNewItemTargetMode] = useState<"online" | "offline" | "all">("all");

  const [editLessonModal, setEditLessonModal] = useState<{ chapterId: string; lesson: any } | null>(null);
  const [editLessonForm, setEditLessonForm] = useState({ title: "", description: "", duration: 45, format: "Zoom", target_mode: "all" as "online" | "offline" | "all" });
  const [boostModal, setBoostModal] = useState<string | null>(null);
  const [boostForm, setBoostForm] = useState({ title: "", type: "video", url: "", note: "" });
  const [uploadMethodModal, setUploadMethodModal] = useState<{ lessonId: string; type: "homework_files" | "test_quizzes" } | null>(null);
  const [driveLinkModal, setDriveLinkModal] = useState<{ lessonId: string; type: "homework_files" | "test_quizzes" } | null>(null);
  const [driveLinkForm, setDriveLinkForm] = useState({ title: "", url: "" });

  const [viewResourcesModal, setViewResourcesModal] = useState<{ lessonId: string; type: string; title: string; items: any[] } | null>(null);
  const [editResourceModal, setEditResourceModal] = useState<{ lessonId: string; type: string; item: any } | null>(null);
  const [editResourceForm, setEditResourceForm] = useState({ title: "", url: "", type: "lecture" });

  const [videoModalExam, setVideoModalExam] = useState<any | null>(null);
  const [solutionVideoInput, setSolutionVideoInput] = useState("");
  const [testExamRoom, setTestExamRoom] = useState<any | null>(null);

  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [quickStudentForm, setQuickStudentForm] = useState({
    lastName: "",
    firstName: "",
    status: "approved" as "approved" | "rejected"
  });

  const [analyticsModeFilter, setAnalyticsModeFilter] = useState<"all" | "online" | "offline">("all");

  const [azotaScoreViewModal, setAzotaScoreViewModal] = useState<{
    isOpen: boolean;
    examTitle: string;
    attempts: any[];
  }>({
    isOpen: false,
    examTitle: "",
    attempts: []
  });

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => { 
    setToastNotification({ message: msg, type }); 
    setTimeout(() => setToastNotification(null), 3500); 
  }, []);

  const handleSwitchTab = useCallback((newTab: AdminTab) => {
    setActiveTab(newTab);
    if (typeof window !== "undefined") {
      window.history.pushState({ tab: newTab }, "", "#" + newTab);
    }
  }, []);

  const handleAdminLogout = () => {
    if (typeof window !== "undefined") {
      try {
        supabase.auth.signOut();
      } catch {}
      localStorage.removeItem("tct_current_user");
      localStorage.removeItem("edunexus_current_user");
      localStorage.removeItem("edunexus_user_session");
      window.location.href = "/";
    }
  };

  // 4. HÀM CẬP NHẬT TỨC THÌ (OPTIMISTIC UPDATE PIPELINE KÈM QUEUE DEBOUNCE VÀ RETRY)
  const handleOptimisticUpdateChapters = useCallback((newChapters: any[]): Promise<boolean> => {
    latestChaptersRef.current = newChapters;

    // Bước 1: Phản hồi UI tức thì (< 30ms) cho React Virtual DOM
    startTransition(() => {
      setChapters(newChapters);
    });

    // Bước 2: Tách lưu localStorage qua setTimeout 0 để không chặn Main Thread
    setTimeout(() => {
      try {
        localStorage.setItem("edunexus_course_data", JSON.stringify(newChapters));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {
        console.warn("Lỗi ghi LocalStorage:", e);
      }
    }, 0);

    // Bước 3: Kích hoạt thanh % tiến trình nổi trên đỉnh màn hình
    setSyncStatus({
      isSyncing: true,
      progress: 25,
      message: "Đang lưu dữ liệu lên máy chủ... [25%]",
      type: "loading"
    });

    // Bước 4: Hủy timer cũ, debounce ~300ms tránh race condition ghi đè
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      const dataToSync = latestChaptersRef.current;

      setSyncStatus(prev => ({
        ...prev,
        progress: 65,
        message: "Đang đẩy dữ liệu lên máy chủ... [65%]"
      }));

      try {
        const { data: existingRows, error: checkError } = await supabase.from("courses").select("id").limit(1);
        if (checkError) throw new Error(checkError.message);

        if (existingRows && existingRows.length > 0) {
          const { error: updateError } = await supabase
            .from("courses")
            .update({ chapters: dataToSync, updated_at: new Date().toISOString() })
            .eq("id", existingRows[0].id);

          if (updateError) throw new Error(updateError.message);
        } else {
          const { error: insertError } = await supabase
            .from("courses")
            .insert([{ title: "Toán 12 TCT", chapters: dataToSync, updated_at: new Date().toISOString() }]);

          if (insertError) throw new Error(insertError.message);
        }

        // ĐỒNG BỘ THÀNH CÔNG 100%
        setSyncStatus({
          isSyncing: true,
          progress: 100,
          message: "✓ Đã đồng bộ thành công! (100%)",
          type: "success"
        });

        setTimeout(() => {
          setSyncStatus(prev => ({ ...prev, isSyncing: false, type: "idle" }));
        }, 1200);

      } catch (err: any) {
        console.error("Lỗi đồng bộ Supabase courses:", err);
        // KÍCH HOẠT CHẾ ĐỘ ERROR RETRY
        setSyncStatus({
          isSyncing: true,
          progress: 100,
          message: "✕ Lỗi kết nối đám mây, đang thử lại...",
          type: "error"
        });
        showToast("Lỗi lưu Supabase: " + (err?.message || "Mất kết nối mạng"), "error");
      }
    }, 300);

    return Promise.resolve(true);
  }, [showToast]);

  const saveToStorage = handleOptimisticUpdateChapters;

  // HÀM BẤM THỬ LẠI KHI BỊ LỖI MẠNG
  const handleRetrySync = () => {
    if (latestChaptersRef.current) {
      handleOptimisticUpdateChapters(latestChaptersRef.current);
    }
  };

  // NẠP DỮ LIỆU QUA API SERVER ĐỒNG THỜI BẢO VỆ FALLBACK CHỐNG XÓA TRẮNG
  const syncAdminGlobalData = useCallback(async () => {
    setIsLoadingAnalytics(true);
    setIsLoadingExams(true);

    try {
      const res = await fetch("/api/admin/data", { cache: "no-store" });
      const apiData = await res.json();

      if (res.ok && apiData.success) {
        if (Array.isArray(apiData.profiles) && apiData.profiles.length > 0) {
          setRegisteredStudents(apiData.profiles);
          if (typeof window !== "undefined") {
            localStorage.setItem("edunexus_registered_students", JSON.stringify(apiData.profiles));
          }
        }

        if (Array.isArray(apiData.practiceExams) && apiData.practiceExams.length > 0) {
          setPracticeExams(apiData.practiceExams);
          if (typeof window !== "undefined") {
            localStorage.setItem("edunexus_practice_exams", JSON.stringify(apiData.practiceExams));
          }
        }

        const map = new Map();

        if (typeof window !== "undefined") {
          try {
            const rawLocal = localStorage.getItem("edunexus_attempts");
            if (rawLocal) {
              const localParsed = JSON.parse(rawLocal);
              if (Array.isArray(localParsed)) {
                localParsed.forEach((locItem: any) => {
                  if (locItem?.id) map.set(locItem.id, locItem);
                });
              }
            }
          } catch (e) {}
        }

        (apiData.examAttempts || []).forEach((item: any) => {
          if (!item) return;
          const quizId = String(item.quiz_id || item.exam_id || "").trim();
          const studentId = String(item.student_id || item.user_id || "").trim();
          
          const matchedProfile = (apiData.profiles || []).find((p: any) => p.id === studentId);
          const studentName = matchedProfile?.full_name || item.student_name || item.full_name || item.user_name || "Học sinh";
          const examTitle = String(item.exam_title || item.quiz_title || "").trim();
          const score = Number(item.score ?? item.points ?? 0);
          const createdAt = item.created_at || new Date().toISOString();

          const normalized = {
            ...item,
            id: String(item.id || `${quizId}_${studentId}_${createdAt}`),
            quizId,
            quiz_id: quizId,
            studentId,
            student_id: studentId,
            studentName,
            student_name: studentName,
            examTitle,
            exam_title: examTitle,
            score,
            points: score,
            type: item.type || (item.is_homework ? "homework" : "practice"),
            timeSpent: item.time_spent || (item.duration_seconds ? `${Math.floor(item.duration_seconds / 60)}p` : "15 phút"),
            createdAt,
            created_at: createdAt,
            feedback: item.feedback || ""
          };

          map.set(normalized.id, normalized);
        });

        (apiData.quizResults || []).forEach((item: any) => {
          if (!item) return;
          const recordId = String(item.id);
          if (!map.has(recordId)) {
            const quizId = String(item.quiz_id || "").trim();
            const studentId = String(item.student_id || "").trim();
            const score = Number(item.score || 0);
            const createdAt = item.created_at || new Date().toISOString();

            map.set(recordId, {
              id: recordId,
              quizId,
              quiz_id: quizId,
              studentId,
              student_id: studentId,
              studentName: "Học sinh",
              student_name: "Học sinh",
              examTitle: "",
              exam_title: "",
              score,
              points: score,
              type: "practice",
              timeSpent: "15 phút",
              createdAt,
              created_at: createdAt,
              feedback: ""
            });
          }
        });

        const finalAttempts = Array.from(map.values());
        if (finalAttempts.length > 0) {
          setAllAttempts(finalAttempts);
          if (typeof window !== "undefined") {
            localStorage.setItem("edunexus_attempts", JSON.stringify(finalAttempts));
          }
        }
      }
    } catch (err) {
      console.warn("Lỗi syncAdminGlobalData:", err);
    } finally {
      setIsLoadingAnalytics(false);
      setIsLoadingExams(false);
    }
  }, []);

  const handleAddQuickStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickStudentForm.firstName.trim()) {
      alert("Vui lòng nhập Tên học sinh!");
      return;
    }

    const full_name = (quickStudentForm.lastName.trim() + " " + quickStudentForm.firstName.trim()).trim();
    const newStudent = {
      id: "stu-" + Date.now(),
      full_name,
      email: "hocsinh_" + Date.now() + "@dungtruong.tct",
      phone: "",
      school: "Chưa cập nhật",
      grade: "Lớp 12",
      role: "student",
      learning_mode: "online",
      study_mode: "online",
      approval_status: quickStudentForm.status,
      created_at: new Date().toISOString()
    };

    try {
      await supabase.from("profiles").insert([newStudent]);
    } catch {}

    const updated = [newStudent, ...registeredStudents];
    setRegisteredStudents(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("edunexus_registered_students", JSON.stringify(updated));
    }
    setIsAddStudentModalOpen(false);
    setQuickStudentForm({ lastName: "", firstName: "", status: "approved" });
    showToast("Đã thêm học sinh " + full_name + " thành công!", "success");
  };

  const loadStorageData = useCallback(async () => {
    try {
      const [courseRes, sessRes, notifRes] = await Promise.allSettled([
        supabase.from("courses").select("*").limit(1).maybeSingle(),
        supabase.from("sessions").select("*").order("created_at", { ascending: false }),
        supabase.from("system_notifications").select("*").order("created_at", { ascending: false })
      ]);

      if (courseRes.status === "fulfilled" && courseRes.value.data?.chapters) {
        setChapters(courseRes.value.data.chapters);
        if (typeof window !== "undefined") {
          localStorage.setItem("edunexus_course_data", JSON.stringify(courseRes.value.data.chapters));
        }
      }

      if (sessRes.status === "fulfilled" && sessRes.value.data) {
        setOnlineSessions(sessRes.value.data);
        if (typeof window !== "undefined") {
          localStorage.setItem("edunexus_online_sessions", JSON.stringify(sessRes.value.data));
        }
        const datesFromSessions = Array.from(new Set(sessRes.value.data.map((s: any) => s.date).filter(Boolean)));
        if (datesFromSessions.length > 0) setSessionDates(datesFromSessions as string[]);
      }

      if (notifRes.status === "fulfilled" && notifRes.value.data) {
        setSysNotifications(notifRes.value.data);
        if (typeof window !== "undefined") {
          localStorage.setItem("edunexus_system_notifications", JSON.stringify(notifRes.value.data));
        }
      }
    } catch (e) {}

    await syncAdminGlobalData();

    try {
      const savedAtt = localStorage.getItem("edunexus_attendance");
      if (savedAtt) setAttendanceRecords(JSON.parse(savedAtt));
    } catch (e) {}
  }, [syncAdminGlobalData]);

  useEffect(() => {
    setMounted(true);
    loadStorageData();

    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const hash = window.location.hash.replace("#", "") as AdminTab;
        const validTabs: AdminTab[] = ["lessons", "analytics", "practice", "notifications", "students", "online_schedule", "reports"];
        if (validTabs.includes(hash)) {
          setActiveTab(hash);
        } else {
          setActiveTab("lessons");
        }
      }
    };

    window.addEventListener("popstate", handlePopState);

    const channel = supabase
      .channel("admin-realtime-global-sync")
      .on("broadcast", { event: "new_attempt" }, () => {
        syncAdminGlobalData();
        showToast("Đã có lượt nộp bài mới từ học sinh! Đang cập nhật...", "success");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_attempts" }, () => syncAdminGlobalData())
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_results" }, () => syncAdminGlobalData())
      .on("postgres_changes", { event: "*", schema: "public", table: "practice_exams" }, () => loadStorageData())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => syncAdminGlobalData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [loadStorageData, syncAdminGlobalData, showToast]);

  const savePracticeExams = async (newExams: any[]) => {
    setPracticeExams(newExams);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_practice_exams", JSON.stringify(newExams));
      } catch (e) {}
    }
  };

  const handleChangeExamCategory = async (examId: string, newCategory: string) => {
    const updated = practiceExams.map(ex => ex.id === examId ? { ...ex, category: newCategory } : ex);
    await savePracticeExams(updated);
    try {
      await supabase.from("practice_exams").update({ category: newCategory }).eq("id", examId);
      showToast("Đã chuyển đề sang danh mục: " + newCategory, "success");
    } catch (e: any) {}
  };

  const handleRecalculateExamScores = async (examId: string, updatedSections: any[]) => {
    const answerKeyMap: Record<string, string> = {};
    let totalQuestions = 0;

    (updatedSections || []).forEach(sec => {
      (sec.questions || []).forEach((q: any) => {
        totalQuestions++;
        const qId = q.id || ("q_" + totalQuestions);
        answerKeyMap[qId] = String(q.correctAnswer || q.answer || "").trim().toUpperCase();
      });
    });

    if (totalQuestions === 0) return;

    const targetAttempts = (allAttempts || []).filter(a => a.quizId === examId || a.quiz_id === examId);
    if (targetAttempts.length === 0) return;

    let updatedList = [...allAttempts];

    for (const att of targetAttempts) {
      const studentAnswers = att.userAnswers || att.answers || {};
      let correctCount = 0;

      Object.entries(studentAnswers).forEach(([qId, stuAns]) => {
        const correct = answerKeyMap[qId];
        if (correct && String(stuAns).trim().toUpperCase() === correct) {
          correctCount++;
        }
      });

      const newScore = Number(((correctCount / totalQuestions) * 10).toFixed(2));
      att.score = newScore;
      att.correctCount = correctCount;
      att.totalQuestions = totalQuestions;

      try {
        await supabase
          .from("exam_attempts")
          .update({ score: newScore, updated_at: new Date().toISOString() })
          .eq("id", att.id);
      } catch (e) {}
    }

    setAllAttempts(updatedList);
    showToast("Hệ thống đã tự động chấm lại điểm cho " + targetAttempts.length + " lượt thi của học sinh!", "success");
  };

  const handleOpenExamEditor = async (exam: any) => {
    try {
      showToast("Đang tải dữ liệu câu hỏi của đề thi...", "success");
      const { data, error } = await supabase
        .from("practice_exams")
        .select("id, title, category, duration_minutes, data, media_map, driveUrl, solutionVideoUrl, allowRetake, allowViewFile, created_at")
        .eq("id", exam.id)
        .maybeSingle();

      const fullExam = (!error && data) ? { ...exam, ...data } : exam;
      setEditingExamData(fullExam);
      setUploadMode("practice");
      setTestFile(new File(["dummy"], String(fullExam?.title || "de_thi") + ".docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    } catch (err) {
      setEditingExamData(exam);
      setUploadMode("practice");
      setTestFile(new File(["dummy"], String(exam?.title || "de_thi") + ".docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
    }
  };

  const handleTestExam = async (exam: any) => {
    setTestExamRoom({
      id: exam.id,
      title: "[TEST ADMIN] " + exam.title,
      duration: exam.duration_minutes || 45,
      isHomework: false
    });
  };

  const handleCreateNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim() || !createModal) return;
    
    setIsCreatingItem(true);
    let newChapters = [...(chapters || [])];

    if (createModal.type === "chapter") {
      newChapters.push({ 
        id: "chap-" + Date.now(), 
        title: newItemTitle.trim(), 
        target_mode: newItemTargetMode, 
        lessons: [] 
      });
    } else if (createModal.type === "lesson" && createModal.chapterId) {
      newChapters = newChapters.map(chap => chap?.id === createModal.chapterId ? {
        ...chap, 
        lessons: [...(chap.lessons || []), {
          id: "les-" + Date.now(), 
          title: newItemTitle.trim(), 
          description: newItemDescription.trim(), 
          duration: 45, 
          format: newItemFormat || "Zoom", 
          target_mode: newItemTargetMode,
          lecture_files: [], 
          homework_files: [], 
          handwritten_notes: [], 
          video_list: [], 
          test_quizzes: [], 
          extra_resources: []
        }]
      } : chap);
    }

    handleOptimisticUpdateChapters(newChapters);
    setIsCreatingItem(false);

    const itemLabel = createModal.type === "chapter" ? "chương" : "bài học";
    setCreateModal(null); 
    setNewItemTitle(""); 
    setNewItemDescription(""); 
    setNewItemFormat("Zoom");
    setNewItemTargetMode("all");
    showToast("Đã thêm " + itemLabel + " mới thành công!", "success");
  };

  const handleEditLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLessonModal || !editLessonForm.title.trim()) return;
    const newChapters = (chapters || []).map(chap => chap?.id === editLessonModal.chapterId ? {
      ...chap, lessons: (chap?.lessons || []).map((les: any) => les?.id === editLessonModal.lesson.id ? { ...les, ...editLessonForm } : les)
    } : chap);
    handleOptimisticUpdateChapters(newChapters); 
    setEditLessonModal(null); 
    showToast("Đã cập nhật thông tin bài học!", "success");
  };

  const handleDeleteLesson = async (chapterId: string, lessonId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa bài học này?")) return;
    const newChapters = (chapters || []).map(chap => {
      if (chap?.id === chapterId) { 
        return { ...chap, lessons: (chap?.lessons || []).filter((l: any) => l?.id !== lessonId) }; 
      }
      return chap;
    });
    handleOptimisticUpdateChapters(newChapters); 
    showToast("Đã xóa bài học!", "success");
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resUrl.trim() || !resourceModal) return;
    const newResource = { 
      id: "res-" + Date.now(), 
      title: resTitle.trim(), 
      url: resUrl.trim(), 
      type: resourceModal.type === "video_list" ? vidType : undefined 
    };
    const newChapters = (chapters || []).map(chap => ({ 
      ...chap, 
      lessons: (chap?.lessons || []).map((les: any) => { 
        if (les?.id === resourceModal.lessonId) { 
          return { ...les, [resourceModal.type]: [...(les[resourceModal.type] || []), newResource] }; 
        } 
        return les; 
      }) 
    }));
    handleOptimisticUpdateChapters(newChapters); 
    setResTitle(""); 
    setResUrl(""); 
    setVidType("lecture");
    setResourceModal(null); 
    showToast("Đã thêm tài nguyên thành công!", "success");
  };

  const handleAddBoost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boostModal || !boostForm.title.trim() || !boostForm.url.trim()) return;
    const newBoost = { id: "boost-" + Date.now(), ...boostForm };
    const newChapters = (chapters || []).map(chap => ({ 
      ...chap, 
      lessons: (chap?.lessons || []).map((les: any) => { 
        if (les?.id === boostModal) { 
          return { ...les, extra_resources: [...(les.extra_resources || []), newBoost] }; 
        } 
        return les; 
      }) 
    }));
    handleOptimisticUpdateChapters(newChapters); 
    setBoostModal(null); 
    setBoostForm({ title: "", type: "video", url: "", note: "" }); 
    showToast("Đã thêm tài liệu tăng cường!", "success");
  };

  const handleAddDriveFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveLinkModal || !driveLinkForm.title.trim() || !driveLinkForm.url.trim()) return;
    const newItem = { id: "drive-" + Date.now(), title: driveLinkForm.title, url: driveLinkForm.url, is_quiz: false, is_drive_file: true };
    const newChapters = (chapters || []).map(chap => ({ 
      ...chap, 
      lessons: (chap?.lessons || []).map((les: any) => { 
        if (les?.id === driveLinkModal.lessonId) { 
          return { ...les, [driveLinkModal.type]: [...(les[driveLinkModal.type] || []), newItem] }; 
        } 
        return les; 
      }) 
    }));
    handleOptimisticUpdateChapters(newChapters); 
    setDriveLinkModal(null); 
    setDriveLinkForm({ title: "", url: "" }); 
    showToast("Đã đính kèm file Drive!", "success");
  };

  const handleDeleteResource = async (lessonId: string, resType: string, resId: string) => {
    if (!confirm("Xác nhận xóa tài nguyên này?")) return;
    
    // Cập nhật Optimistic view modal ngay lập tức
    if (viewResourcesModal && viewResourcesModal.lessonId === lessonId && viewResourcesModal.type === resType) {
      setViewResourcesModal((prev: any) => prev ? { ...prev, items: (prev.items || []).filter((i: any) => i?.id !== resId) } : null);
    }

    const newChapters = (chapters || []).map(chap => ({ 
      ...chap, 
      lessons: (chap?.lessons || []).map((les: any) => les?.id === lessonId ? { ...les, [resType]: (les[resType] || []).filter((r: any) => r?.id !== resId) } : les) 
    }));
    
    handleOptimisticUpdateChapters(newChapters);
    showToast("Đã xóa tài nguyên!", "success");
  };

  const handleEditResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editResourceModal || !editResourceForm.title.trim()) return;
    const newChapters = (chapters || []).map(chap => ({ 
      ...chap, 
      lessons: (chap?.lessons || []).map((les: any) => { 
        if (les?.id === editResourceModal.lessonId) { 
          return { ...les, [editResourceModal.type]: (les[editResourceModal.type] || []).map((r: any) => 
            r?.id === editResourceModal.item.id ? { 
              ...r, 
              title: editResourceForm.title, 
              url: editResourceForm.url || r.url,
              type: editResourceModal.type === "video_list" ? editResourceForm.type : r.type
            } : r 
          )}; 
        } 
        return les; 
      }) 
    }));
    handleOptimisticUpdateChapters(newChapters);
    setEditResourceModal(null); 
    showToast("Đã cập nhật thông tin tài liệu!", "success");
  };

  const handleUpdateStudentStatus = async (studentId: string, status: "approved" | "rejected") => {
    try {
      await supabase.from("profiles").update({ approval_status: status }).eq("id", studentId);
    } catch {}
    const updated = registeredStudents.map(s => s.id === studentId ? { ...s, approval_status: status } : s);
    setRegisteredStudents(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("edunexus_registered_students", JSON.stringify(updated));
    }
    showToast("Đã " + (status === "approved" ? "duyệt" : "từ chối/khóa") + " học sinh thành công!", "success");
  };

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm("Xác nhận xóa học sinh này khỏi hệ thống vĩnh viễn?")) return;
    try {
      await supabase.from("profiles").delete().eq("id", studentId);
    } catch {}
    const updated = registeredStudents.filter(s => s.id !== studentId);
    setRegisteredStudents(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("edunexus_registered_students", JSON.stringify(updated));
    }
    showToast("Đã xóa học sinh khỏi cơ sở dữ liệu.", "success");
  };

  const handleDeleteSession = async (sessionId: string, sessionTitle: string) => {
    if (!confirm("Bạn có chắc chắn muốn XÓA ca học \"" + sessionTitle + "\" khỏi hệ thống?")) return;

    try {
      await supabase.from("sessions").delete().eq("id", sessionId);
    } catch (err: any) {}

    const updatedSessions = onlineSessions.filter(s => s.id !== sessionId);
    setOnlineSessions(updatedSessions);
    showToast("Đã xóa ca học \"" + sessionTitle + "\" thành công!", "success");
  };

  const handleDeleteAttendanceDate = async (dateToDelete: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa cột ngày học \"" + dateToDelete + "\" khỏi bảng điểm danh?")) return;
    const updatedDates = sessionDates.filter(d => d !== dateToDelete);
    setSessionDates(updatedDates);
      
    const updatedAtt = attendanceRecords.filter(a => a.sessionDate !== dateToDelete);
    setAttendanceRecords(updatedAtt);

    const updatedSessions = onlineSessions.filter(s => s.date !== dateToDelete);
    setOnlineSessions(updatedSessions);

    try {
      await supabase.from("sessions").delete().eq("date", dateToDelete);
    } catch {}
    showToast("Đã xóa ngày học " + dateToDelete + " thành công!", "success");
  };

  const handleAddNewAttendanceDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDateInput) return;
    const parts = newDateInput.split("-");
    const displayDate = parts.length === 3 ? parts[2] + "/" + parts[1] : newDateInput;

    if (sessionDates.includes(displayDate)) {
      return alert("Ngày học " + displayDate + " đã tồn tại trong danh sách!");
    }

    const updatedDates = [...sessionDates, displayDate];
    setSessionDates(updatedDates);

    let shiftTitle = "Ca học";
    let finalTimeSlot = newDateTimeSlot.trim() || "19:30 - 21:00";

    if (newDateShift !== "custom") {
      const shiftObj = STANDARD_SHIFTS.find(s => s.id === newDateShift);
      if (shiftObj) {
        shiftTitle = shiftObj.name;
        finalTimeSlot = shiftObj.timeSlot;
      }
    }

    const nowIso = new Date().toISOString();
    const newSessionMeta: any = {
      id: "sess-" + Date.now(),
      title: newDateTitle.trim() || ("Buổi học ngày " + displayDate),
      date: displayDate,
      isoDate: newDateInput,
      shiftId: newDateShift,
      shiftName: shiftTitle,
      timeSlot: finalTimeSlot,
      target_mode: newDateAudience,
      audience: newDateAudience,
      room: newDateAudience === "offline" ? "P.201 TCT" : "Zoom / Meet",
      meetingUrl: newDateAudience !== "offline" ? "https://zoom.us/j/1234567890" : "",
      created_at: nowIso,
      createdAt: nowIso
    };
    const updatedSessions = [newSessionMeta, ...onlineSessions];
    setOnlineSessions(updatedSessions);

    await supabase.from("sessions").insert([newSessionMeta]);
    setIsAddDateModalOpen(false);
    setNewDateTitle("");
    showToast("Đã thêm ngày học " + displayDate + " (" + finalTimeSlot + ") thành công!", "success");
  };

  const handleCreateOnlineSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionForm.title.trim() || !newSessionForm.meetingUrl.trim()) {
      return alert("Vui lòng nhập đầy đủ tiêu đề và link phòng học!");
    }
    const guideImgs = newSessionForm.guideImagesText.split("\n").map(s => s.trim()).filter(Boolean);
    const dispDate = newSessionForm.displayDate.trim() || "24/09";
    const finalTimeSlot = newSessionForm.timeSlot.trim() || "19:30 - 21:00";
    const nowIso = new Date().toISOString();

    const newSession: any = {
      id: "sess-" + Date.now(),
      title: newSessionForm.title.trim(),
      date: dispDate,
      isoDate: newSessionForm.isoDate,
      shiftId: newSessionForm.shiftId,
      shiftName: newSessionForm.shiftName || "Ca học",
      timeSlot: finalTimeSlot,
      meetingUrl: newSessionForm.meetingUrl.trim(),
      audience: newSessionForm.audience,
      target_mode: newSessionForm.audience,
      room: newSessionForm.audience === "offline" ? "P.201 TCT" : "Zoom / Google Meet",
      guideImages: guideImgs.length > 0 ? guideImgs : ["https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80"],
      created_at: nowIso,
      createdAt: nowIso
    };

    const updatedSessions = [newSession, ...onlineSessions];
    setOnlineSessions(updatedSessions);

    let updatedDates = sessionDates;
    if (!sessionDates.includes(dispDate)) {
      updatedDates = [...sessionDates, dispDate];
      setSessionDates(updatedDates);
    }

    await supabase.from("sessions").insert([newSession]);

    setNewSessionForm({ 
      title: "", 
      isoDate: newSessionForm.isoDate, 
      displayDate: newSessionForm.displayDate, 
      shiftId: "custom", 
      shiftName: "Ca học", 
      timeSlot: "19:30 - 21:00", 
      meetingUrl: "", 
      guideImagesText: "", 
      audience: "all" 
    });
    showToast("Đã phát link buổi học (" + dispDate + " • " + finalTimeSlot + ") lên hệ thống thành công!", "success");
  };

  const handleToggleAttendance = (studentId: string, studentName: string, sessionDate: string) => {
    const existing = attendanceRecords.find(a => a.studentId === studentId && a.sessionDate === sessionDate);
    let updated: any[];
    if (existing && existing.status === "present") {
      updated = attendanceRecords.filter(a => !(a.studentId === studentId && a.sessionDate === sessionDate));
      showToast("Đã hủy điểm danh của " + studentName + " ngày " + sessionDate, "success");
    } else {
      const newRec = {
        id: "att-" + Date.now(),
        studentId,
        studentName,
        sessionDate,
        status: "present",
        attendedAt: new Date().toISOString()
      };
      updated = [...attendanceRecords.filter(a => !(a.studentId === studentId && a.sessionDate === sessionDate)), newRec];
      showToast("Đã tích có mặt cho " + studentName + " ngày " + sessionDate + "!", "success");
    }
    setAttendanceRecords(updated);
  };

  const handleSaveSolutionVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoModalExam) return;
    const newExams = (practiceExams || []).map(ex => 
      ex?.id === videoModalExam.id ? { ...ex, solutionVideoUrl: solutionVideoInput.trim() } : ex
    );
    await savePracticeExams(newExams);
    try {
      await supabase.from("practice_exams").update({ solutionVideoUrl: solutionVideoInput.trim() }).eq("id", videoModalExam.id);
    } catch {}
    setVideoModalExam(null);
    setSolutionVideoInput("");
    showToast("Đã lưu Video chữa bài thành công!", "success");
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifContent.trim()) return;
    const newNotif = { id: "sys-" + Date.now(), title: notifTitle, content: notifContent, type: notifType, createdAt: new Date().toISOString() };
    const updated = [newNotif, ...(sysNotifications || [])];
    setSysNotifications(updated); 
    
    try {
      await supabase.from("system_notifications").insert([newNotif]);
    } catch (err) {}

    setNotifTitle(""); 
    setNotifContent(""); 
    showToast("Đã phát thông báo thành công!", "success");
  };

  const handleDeleteNotification = async (id: string) => {
    if (!confirm("Thu hồi thông báo này?")) return;
    const updated = (sysNotifications || []).filter(n => n?.id !== id);
    setSysNotifications(updated); 
    try {
      await supabase.from("system_notifications").delete().eq("id", id);
    } catch {}
  };

  const handleSaveAzotaExam = async (examData: any) => {
    try {
      if (uploadMode === "practice") {
        setUploadProgressText("Đang bóc tách dữ liệu câu hỏi và lưu vào kho đề...");
        const examId = editingExamData ? editingExamData.id : ("prac-" + Date.now());
        const newExam = { 
          id: examId, 
          title: examData.title, 
          category: examData.category || "Tự do", 
          duration_minutes: examData.duration_minutes || 45, 
          allowRetake: editingExamData ? (editingExamData.allowRetake ?? true) : true, 
          allowViewFile: editingExamData ? (editingExamData.allowViewFile ?? true) : true, 
          driveUrl: examData.driveUrl || (editingExamData?.driveUrl ?? ""), 
          solutionVideoUrl: examData.solutionVideoUrl || (editingExamData?.solutionVideoUrl ?? ""), 
          data: examData.sections, 
          media_map: examData.mediaMap || {},
          created_at: editingExamData ? editingExamData.created_at : new Date().toISOString()
        };

        const { error: upsertErr } = await supabase.from("practice_exams").upsert(newExam);
        if (upsertErr) throw new Error(upsertErr.message);

        let updatedExams: any[];
        if (editingExamData) {
          updatedExams = practiceExams.map(ex => ex.id === examId ? newExam : ex);
        } else {
          updatedExams = [newExam, ...(practiceExams || [])];
        }

        await savePracticeExams(updatedExams);

        if (editingExamData) {
          setUploadProgressText("Đang tự động chấm lại điểm cho các lượt thi học sinh...");
          await handleRecalculateExamScores(examId, examData.sections);
          showToast("Đã cập nhật đề thi và tính lại điểm chuẩn xác cho học sinh!", "success");
        } else {
          showToast("Đã thêm vào kho Luyện đề: " + examData.category, "success");
        }
      } else {
        if (!azotaTarget) return;
        setUploadProgressText("Đang nạp đề kiểm tra/BTVN vào bài học...");
        const isHw = azotaTarget.type === "homework_files";
        const newExam = { 
          id: "exam-" + Date.now(), 
          title: examData.title || (isHw ? "Bài BTVN" : "Kiểm tra"), 
          isHomework: isHw, 
          duration_minutes: isHw ? 0 : (examData.duration_minutes || 45), 
          is_quiz: true, 
          data: examData.sections, 
          mediaMap: examData.mediaMap 
        };
        const newChapters = (chapters || []).map(chap => ({ 
          ...chap, 
          lessons: (chap?.lessons || []).map((les: any) => { 
            if (les?.id === azotaTarget.lessonId) { 
              return { ...les, [azotaTarget.type]: [...(les[azotaTarget.type] || []), newExam] }; 
            } 
            return les; 
          }) 
        }));

        handleOptimisticUpdateChapters(newChapters);
        showToast("Đã tải đề thi trắc nghiệm vào bài học!", "success");
      }
    } catch (err: any) {
      console.error("Lỗi lưu đề thi:", err);
      showToast("Lỗi lưu đề thi: " + (err?.message || "Không xác định"), "error");
    } finally {
      setUploadProgressText(null);
      setTestFile(null); 
      setEditingExamData(null);
      setAzotaTarget(null);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex bg-[#F8FAFC] font-sans text-slate-800 relative">
        <aside className="w-64 bg-[#1E40AF] border-r border-[#1E40AF] text-white/90 flex flex-col shrink-0 p-5">
          <div className="flex items-center gap-3 mb-8"> 
            <div className="w-10 h-10 bg-white text-[#1E40AF] rounded-[14px] flex items-center justify-center font-black text-sm shadow-md">TCT</div>
            <div>
              <h1 className="font-extrabold text-[15px] text-white tracking-tight leading-none">TÂM CHÍ TÀI</h1>
              <p className="text-[9px] text-blue-200 font-bold tracking-widest mt-1 uppercase">Admin Panel</p>
            </div>
          </div>
        </aside>
        <main className="flex-1 flex items-center justify-center bg-slate-50/50">
          <div className="flex items-center gap-3 text-slate-600 font-bold text-sm bg-white px-6 py-4 rounded-2xl shadow-sm border border-slate-200/80">
            <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin"></div>
            Đang khởi tạo hệ thống quản trị...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] font-sans text-slate-800 relative selection:bg-blue-500/20">
      {/* 5. WIDGET THANH TIẾN TRÌNH % ĐỒNG BỘ NỔI TRÊN ĐỈNH TRANG ADMIN (FLOATING SYNC STATUS BAR Ở TẦNG CAO NHẤT Z-[9999]) */}
      {syncStatus.isSyncing && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-300 ${
          syncStatus.type === "error" ? "pointer-events-auto" : "pointer-events-none"
        }`}>
          <div className={`px-5 py-2.5 rounded-full shadow-2xl border flex items-center gap-3.5 min-w-[340px] max-w-lg backdrop-blur-md animate-in fade-in slide-in-from-top-3 duration-200 ${
            syncStatus.type === "error" 
              ? "bg-rose-50/95 border-rose-300 text-rose-900" 
              : syncStatus.type === "success"
              ? "bg-emerald-50/95 border-emerald-300 text-emerald-900"
              : "bg-white/95 border-blue-200/90 text-slate-700"
          }`}>
            {syncStatus.type === "loading" && (
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
            )}
            {syncStatus.type === "success" && (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            {syncStatus.type === "error" && (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center text-[11px] font-black mb-1">
                <span className="truncate">{syncStatus.message}</span>
                {syncStatus.type === "error" && (
                  <button 
                    type="button"
                    onClick={handleRetrySync}
                    className="ml-2 px-2.5 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Thử lại
                  </button>
                )}
              </div>
              <div className="w-full h-1.5 bg-slate-200/60 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    syncStatus.type === "error"
                      ? "bg-rose-500"
                      : syncStatus.type === "success"
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-blue-500 to-indigo-600"
                  }`}
                  style={{ width: `${syncStatus.progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {toastNotification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }} 
            className={"fixed top-5 right-5 z-[500] px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-bold text-sm text-white " + (
              toastNotification.type === "success" ? "bg-emerald-600" : "bg-rose-600"
            )}
          >
            {toastNotification.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {toastNotification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <AdminSidebar
        activeTab={activeTab}
        onSwitchTab={handleSwitchTab}
        onLogout={handleAdminLogout}
      />

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <AdminHeader
          activeTab={activeTab}
          onSyncData={async () => {
            await loadStorageData();
            showToast("Đã đồng bộ toàn bộ dữ liệu tức thì từ Server!", "success");
          }}
        />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-50/30">
          {activeTab === "lessons" && (
            <LessonsTab
              chapters={chapters}
              setChapters={setChapters}
              onUpdateChapters={handleOptimisticUpdateChapters}
              saveToStorage={saveToStorage}
              lessonModeTab={lessonModeTab}
              setLessonModeTab={setLessonModeTab}
              offlineLessonCount={offlineLessonCount}
              onlineLessonCount={onlineLessonCount}
              flattenedLessons={flattenedLessons}
              setCreateModal={setCreateModal}
              setResourceModal={setResourceModal}
              setViewResourcesModal={setViewResourcesModal}
              setUploadMethodModal={setUploadMethodModal}
              setBoostModal={setBoostModal}
              setEditLessonModal={setEditLessonModal}
              setEditLessonForm={setEditLessonForm}
              handleDeleteLesson={handleDeleteLesson}
            />
          )}

          {activeTab === "practice" && (
            <PracticeTab
              practiceSubTab={practiceSubTab}
              setPracticeSubTab={setPracticeSubTab}
              practiceExams={practiceExams}
              allAttempts={allAttempts}
              isLoadingExams={isLoadingExams}
              uploadProgressText={uploadProgressText}
              setTestFile={setTestFile}
              setUploadMode={setUploadMode}
              setEditingExamData={setEditingExamData}
              handleChangeExamCategory={handleChangeExamCategory}
              savePracticeExams={savePracticeExams}
              supabase={supabase}
              showToast={showToast}
              setVideoModalExam={setVideoModalExam}
              setSolutionVideoInput={setSolutionVideoInput}
              setAzotaScoreViewModal={setAzotaScoreViewModal}
              onOpenExamEditor={handleOpenExamEditor}
              onTestExam={handleTestExam}
              practiceCategoryFilter={practiceCategoryFilter}
              setPracticeCategoryFilter={setPracticeCategoryFilter}
              examsWithScoresData={examsWithScoresData}
            />
          )}

          {activeTab === "analytics" && (
            <AnalyticsTab
              analyticsData={analyticsData}
              analyticsModeFilter={analyticsModeFilter}
              setAnalyticsModeFilter={setAnalyticsModeFilter}
              rankingScope={rankingScope}
              setRankingScope={setRankingScope}
              selectedChapterId={selectedChapterId}
              setSelectedChapterId={setSelectedChapterId}
              selectedLessonId={selectedLessonId}
              setSelectedLessonId={setSelectedLessonId}
              chapters={chapters}
              isLoadingAnalytics={isLoadingAnalytics}
            />
          )}

          {activeTab === "notifications" && (
            <NotificationsTab
              notifTitle={notifTitle}
              setNotifTitle={setNotifTitle}
              notifContent={notifContent}
              setNotifContent={setNotifContent}
              notifType={notifType}
              setNotifType={setNotifType}
              sysNotifications={sysNotifications}
              handleSendNotification={handleSendNotification}
              handleDeleteNotification={handleDeleteNotification}
            />
          )}

          {activeTab === "students" && (
            <StudentsTab
              registeredStudents={registeredStudents}
              studentFilter={studentFilter}
              setStudentFilter={setStudentFilter}
              studentSearch={studentSearch}
              setStudentSearch={setStudentSearch}
              handleUpdateStudentStatus={handleUpdateStudentStatus}
              handleDeleteStudent={handleDeleteStudent}
            />
          )}

          {activeTab === "online_schedule" && (
            <OnlineScheduleTab
              newSessionForm={newSessionForm}
              setNewSessionForm={setNewSessionForm}
              handleCreateOnlineSession={handleCreateOnlineSession}
              onlineSessions={onlineSessions}
              handleDeleteSession={handleDeleteSession}
              setIsAddDateModalOpen={setIsAddDateModalOpen}
              setIsAddStudentModalOpen={setIsAddStudentModalOpen}
              attendanceSearchText={attendanceSearchText}
              setAttendanceSearchText={setAttendanceSearchText}
              attendanceFilterMode={attendanceFilterMode}
              setAttendanceFilterMode={setAttendanceFilterMode}
              registeredStudents={registeredStudents}
              attendanceSortAZ={attendanceSortAZ}
              setAttendanceSortAZ={setAttendanceSortAZ}
              sessionDates={sessionDates}
              handleDeleteAttendanceDate={handleDeleteAttendanceDate}
              sortedAndFilteredStudents={sortedAndFilteredStudents}
              attendanceRecords={attendanceRecords}
              handleToggleAttendance={handleToggleAttendance}
            />
          )}

          {activeTab === "reports" && (
            <motion.div
              key="reports"
              initial={{ opacity: 0, y: 10, scale: 0.99, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, scale: 0.99, filter: "blur(4px)" }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <AdminStudentReportPanel 
                registeredStudents={registeredStudents}
                allAttempts={allAttempts}
                chapters={chapters}
                practiceExams={practiceExams}
                attendanceRecords={attendanceRecords}
              />
            </motion.div>
          )}
        </div>
      </main>

      <AdminModals
        azotaScoreViewModal={azotaScoreViewModal}
        setAzotaScoreViewModal={setAzotaScoreViewModal}
        registeredStudents={registeredStudents}
        supabase={supabase}
        showToast={showToast}
        isAddStudentModalOpen={isAddStudentModalOpen}
        setIsAddStudentModalOpen={setIsAddStudentModalOpen}
        quickStudentForm={quickStudentForm}
        setQuickStudentForm={setQuickStudentForm}
        handleAddQuickStudentSubmit={handleAddQuickStudentSubmit}
        viewResourcesModal={viewResourcesModal}
        setViewResourcesModal={setViewResourcesModal}
        setEditResourceModal={setEditResourceModal}
        setEditResourceForm={setEditResourceForm}
        handleDeleteResource={handleDeleteResource}
        setUploadMethodModal={setUploadMethodModal}
        setBoostModal={setBoostModal}
        setResourceModal={setResourceModal}
        editResourceModal={editResourceModal}
        editResourceForm={editResourceForm}
        handleEditResourceSubmit={handleEditResourceSubmit}
        createModal={createModal}
        setCreateModal={setCreateModal}
        chapters={chapters}
        newItemTitle={newItemTitle}
        setNewItemTitle={setNewItemTitle}
        newItemTargetMode={newItemTargetMode}
        setNewItemTargetMode={setNewItemTargetMode}
        newItemFormat={newItemFormat}
        setNewItemFormat={setNewItemFormat}
        newItemDescription={newItemDescription}
        setNewItemDescription={setNewItemDescription}
        handleCreateNewItem={handleCreateNewItem}
        isCreatingItem={isCreatingItem}
        testFile={testFile}
        editingExamData={editingExamData}
        uploadMode={uploadMode}
        setTestFile={setTestFile}
        setEditingExamData={setEditingExamData}
        onSaveAzotaExam={handleSaveAzotaExam}
        uploadMethodModal={uploadMethodModal}
        setDriveLinkModal={setDriveLinkModal}
        setAzotaTarget={setAzotaTarget}
        setUploadMode={setUploadMode}
        driveLinkModal={driveLinkModal}
        driveLinkForm={driveLinkForm}
        setDriveLinkForm={setDriveLinkForm}
        handleAddDriveFile={handleAddDriveFile}
        resourceModal={resourceModal}
        resTitle={resTitle}
        setResTitle={setResTitle}
        vidType={vidType}
        setVidType={setVidType}
        resUrl={resUrl}
        setResUrl={setResUrl}
        handleAddResource={handleAddResource}
        editLessonModal={editLessonModal}
        setEditLessonModal={setEditLessonModal}
        editLessonForm={editLessonForm}
        setEditLessonForm={setEditLessonForm}
        handleEditLessonSubmit={handleEditLessonSubmit}
        isAddDateModalOpen={isAddDateModalOpen}
        setIsAddDateModalOpen={setIsAddDateModalOpen}
        handleAddNewAttendanceDate={handleAddNewAttendanceDate}
        newDateInput={newDateInput}
        setNewDateInput={setNewDateInput}
        newDateShift={newDateShift}
        setNewDateShift={setNewDateShift}
        newDateTimeSlot={newDateTimeSlot}
        setNewDateTimeSlot={setNewDateTimeSlot}
        newDateAudience={newDateAudience}
        setNewDateAudience={setNewDateAudience}
        newDateTitle={newDateTitle}
        setNewDateTitle={setNewDateTitle}
        boostModal={boostModal}
        boostForm={boostForm}
        setBoostForm={setBoostForm}
        handleAddBoost={handleAddBoost}
        videoModalExam={videoModalExam}
        setVideoModalExam={setVideoModalExam}
        solutionVideoInput={solutionVideoInput}
        setSolutionVideoInput={setSolutionVideoInput}
        handleSaveSolutionVideo={handleSaveSolutionVideo}
        testExamRoom={testExamRoom}
        setTestExamRoom={setTestExamRoom}
      />
    </div>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AdminErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Lỗi giao diện Admin:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-12 flex flex-col items-center justify-center font-sans">
          <div className="bg-white border border-rose-200 rounded-3xl p-8 max-w-2xl w-full shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-black text-xl mb-4">
              !
            </div>
            <h2 className="text-xl font-extrabold text-slate-900 mb-2">Đã phát hiện lỗi trong bảng điều khiển</h2>
            <p className="text-xs text-slate-500 mb-4">
              Hệ thống Error Boundary đã ngăn chặn trang bị trắng màn hình. Bạn có thể xem chi tiết lỗi dưới đây hoặc xóa cache dữ liệu bị xung đột:
            </p>
            <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-4 font-mono text-xs text-rose-800 overflow-x-auto whitespace-pre-wrap max-h-60 custom-scrollbar mb-6">
              {this.state.error?.toString() || "Lỗi không xác định"}
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem("edunexus_course_data");
                    localStorage.removeItem("edunexus_practice_exams");
                    localStorage.removeItem("edunexus_attempts");
                  } catch (e) {}
                  window.location.reload();
                }}
                className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition shadow-sm cursor-pointer"
              >
                Reset dữ liệu LocalStorage & Tải lại
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Tải lại trang ngay
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AdminDashboard() {
  return (
    <AdminErrorBoundary>
      <AdminDashboardContent />
    </AdminErrorBoundary>
  );
}
