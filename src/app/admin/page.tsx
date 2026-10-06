"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScheduleView from "@/components/student/ScheduleView";
import AdminStudentReportPanel from "@/components/admin/AdminStudentReportPanel";
import { STANDARD_SHIFTS, TargetAudience, TargetMode, OnlineSession } from "@/types";
import { supabase } from "@/lib/supabaseClient";
import { 
  BookOpen, Trophy, Plus, FileText, Video, PenTool, ClipboardCheck, 
  Trash2, Link as LinkIcon, X, FileUp, FileSignature, FolderPlus, 
  GraduationCap, CheckCircle2, BarChart2, List, Medal, Search, 
  Filter, Clock, Target, UploadCloud, ToggleLeft, 
  ToggleRight, Eye, Star, Edit3, Bell, Send, Zap, ExternalLink, Play,
  Users, UserCheck, Calendar, Globe, Check, Image as ImageIcon, Sparkles,
  ArrowUpDown, CalendarDays, Layers, FileCheck, LogOut,
  Lock, Unlock, ChevronDown, RefreshCw, MessageSquare
} from "lucide-react";
import dynamic from "next/dynamic";

const AzotaExamConfigModal = dynamic(
  () => import("./AzotaExamConfigModal").then((mod: any) => mod.AzotaExamConfigModal || mod.default || mod),
  { ssr: false }
);

const ExamRoomView = dynamic(
  () => import("@/components/student/ExamRoomView").then((mod: any) => mod.ExamRoomView || mod.default || mod),
  { ssr: false }
);

const EXAM_CATEGORIES = [
  "ĐGNL HSA (ĐHQGHN)",
  "ĐGTD TSA (ĐHBK)",
  "Tốt Nghiệp THPT",
  "Giữa Kì 1",
  "Học Kì 1",
  "Giữa Kì 2",
  "Học Kì 2",
  "Luyện đề"
];

// Hàm chuẩn hóa chuỗi không dấu để so khớp tiêu đề đề thi chính xác 100%
const normalizeTitle = (str: any) => {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
};

const MatrixCell = ({ items, onAdd, onView, label }: { items: any[]; onAdd: () => void; onView: () => void; label: string }) => {
  if (items && items.length > 0) {
    return (
      <button 
        onClick={onView} 
        title={"Xem danh sách (" + items.length + ")"} 
        className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-[#1D4ED8] text-[#1D4ED8] bg-blue-50 font-black text-xs hover:bg-[#1D4ED8] hover:text-white transition-all mx-auto cursor-pointer shadow-sm"
      >
        {items.length}
      </button>
    );
  }
  return (
    <button 
      onClick={onAdd} 
      title={"Thêm " + label} 
      className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-[#1D4ED8] hover:text-[#1D4ED8] hover:bg-blue-50 transition-all mx-auto cursor-pointer"
    >
      <Plus className="w-3.5 h-3.5" />
    </button>
  );
};

const INITIAL_CHAPTERS = [
  { 
    id: "chap-1", 
    title: "Chương 1: Ứng dụng đạo hàm để khảo sát hàm số", 
    lessons: [
      { 
        id: "les-1", 
        title: "Bài 1: Tính đơn điệu của hàm số", 
        description: "", 
        duration: 45, 
        format: "Zoom", 
        target_mode: "all",
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

type AdminTab = "lessons" | "analytics" | "practice" | "notifications" | "students" | "online_schedule" | "reports";

function AdminDashboardContent() {
  const [mounted, setMounted] = useState(false);

  // 1. ĐỌC TAB TỪ URL HASH
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "") as AdminTab;
      const validTabs: AdminTab[] = ["lessons", "analytics", "practice", "notifications", "students", "online_schedule", "reports"];
      if (validTabs.includes(hash)) return hash;
    }
    return "practice";
  });

  const [lessonModeTab, setLessonModeTab] = useState<"all" | "offline" | "online">("all");
  const [practiceSubTab, setPracticeSubTab] = useState<"manage" | "scores">("manage");

  // 2. KHỞI TẠO TỨC THÌ TỪ LOCALSTORAGE TRÁNH MẤT DỮ LIỆU
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

  const [allAttempts, setAllAttempts] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_attempts");
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

  const [successToast, setSuccessToast] = useState("");
  const [uploadMode, setUploadMode] = useState<"course" | "practice">("course");
  const [practiceCategoryFilter, setPracticeCategoryFilter] = useState("Tất cả danh mục");
  const [rankingScope, setRankingScope] = useState<"lesson" | "chapter" | "course">("course");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("all");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("all");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifContent, setNotifContent] = useState("");
  const [notifType, setNotifType] = useState<"teacher" | "urgent" | "exam">("teacher");

  const [registeredStudents, setRegisteredStudents] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_registered_students");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

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

  const showToast = (msg: string) => { 
    setSuccessToast(msg); 
    setTimeout(() => setSuccessToast(""), 3000); 
  };

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

  const fetchSupabaseStudents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("role", "admin")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        setRegisteredStudents(data);
        if (typeof window !== "undefined") {
          localStorage.setItem("edunexus_registered_students", JSON.stringify(data));
        }
      }
    } catch (err) {}
  }, []);

  // 1. KHÔI PHỤC TOÀN BỘ ĐIỂM SỐ - HỢP NHẤT KHÔNG GHI ĐÈ XÓA MẤT DỮ LIỆU CŨ
  const fetchSupabaseAttempts = useCallback(async () => {
    let localSaved: any[] = [];
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("edunexus_attempts");
        if (raw) localSaved = JSON.parse(raw);
      } catch (e) {}
    }

    const [res1, res2, res3] = await Promise.allSettled([
      supabase.from("exam_attempts").select("*").order("created_at", { ascending: false }),
      supabase.from("attempts").select("*").order("created_at", { ascending: false }),
      supabase.from("quiz_attempts").select("*").order("created_at", { ascending: false })
    ]);

    let serverList: any[] = [];
    if (res1.status === "fulfilled" && res1.value.data) serverList.push(...res1.value.data);
    if (res2.status === "fulfilled" && res2.value.data) serverList.push(...res2.value.data);
    if (res3.status === "fulfilled" && res3.value.data) serverList.push(...res3.value.data);

    // Gộp tất cả dữ liệu từ LocalStorage và Server, chuẩn hóa khóa định danh
    const combined = [...localSaved, ...serverList];
    const map = new Map();

    combined.forEach((item: any) => {
      if (!item) return;
      const quizId = item.quizId || item.exam_id || item.quiz_id || item.test_id || "";
      const studentId = item.studentId || item.user_id || item.student_id || item.username || "";
      const studentName = item.studentName || item.student_name || item.user_name || item.full_name || item.username || "Học sinh";
      const examTitle = item.examTitle || item.quizTitle || item.title || item.exam_title || item.name || "";
      const score = Number(item.score ?? item.points ?? 0);
      const createdAt = item.createdAt || item.created_at || new Date().toISOString();

      const normalized = {
        ...item,
        id: item.id || (String(quizId) + "" + String(studentId) + "" + String(createdAt)),
        quizId,
        studentId,
        studentName,
        examTitle,
        score,
        type: item.type || (item.isHomework ? "homework" : "practice"),
        timeSpent: item.timeSpent || item.time_spent || item.duration_seconds || "15 phút",
        createdAt,
        attemptNumber: item.attemptNumber || item.attempt_count || 1,
        feedback: item.feedback || item.comment || ""
      };

      // Đảm bảo không trùng lặp và không làm mất lượt nộp
      const key = item.id || (String(quizId) + "" + String(studentId) + "" + String(score) + "_" + String(createdAt));
      map.set(key, normalized);
    });

    const finalAttempts = Array.from(map.values());
    if (finalAttempts.length > 0) {
      setAllAttempts(finalAttempts);
      if (typeof window !== "undefined") {
        localStorage.setItem("edunexus_attempts", JSON.stringify(finalAttempts));
      }
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
    showToast("Đã thêm học sinh " + full_name + " thành công!");
  };

  // 2. NẠP VÀ BẢO TỒN DỮ LIỆU ĐỀ THI KHÔNG LÀM MẤT CÁC ĐỀ CŨ
  const loadStorageData = useCallback(async () => {
    if (typeof window === "undefined") return;

    let localExams: any[] = [];
    try {
      const rawExams = localStorage.getItem("edunexus_practice_exams");
      if (rawExams) localExams = JSON.parse(rawExams);
    } catch (e) {}

    try {
      const [courseRes, examRes, sessRes, notifRes] = await Promise.allSettled([
        supabase.from("courses").select("*").limit(1).maybeSingle(),
        supabase.from("practice_exams").select("*").order("created_at", { ascending: false }),
        supabase.from("sessions").select("*").order("created_at", { ascending: false }),
        supabase.from("system_notifications").select("*").order("created_at", { ascending: false })
      ]);

      if (courseRes.status === "fulfilled" && courseRes.value.data?.chapters) {
        setChapters(courseRes.value.data.chapters);
        localStorage.setItem("edunexus_course_data", JSON.stringify(courseRes.value.data.chapters));
      }

      const serverExams = (examRes.status === "fulfilled" && examRes.value.data) ? examRes.value.data : [];
      const examMap = new Map();
      
      // Giữ nguyên toàn bộ đề local đã có từ trước
      localExams.forEach((ex: any) => { if (ex?.id) examMap.set(ex.id, ex); });
      // Thêm đề từ server nếu có
      serverExams.forEach((ex: any) => { if (ex?.id) examMap.set(ex.id, ex); });

      const mergedExams = Array.from(examMap.values());
      if (mergedExams.length > 0) {
        setPracticeExams(mergedExams);
        localStorage.setItem("edunexus_practice_exams", JSON.stringify(mergedExams));
      }

      if (sessRes.status === "fulfilled" && sessRes.value.data) {
        setOnlineSessions(sessRes.value.data);
        localStorage.setItem("edunexus_online_sessions", JSON.stringify(sessRes.value.data));
        const datesFromSessions = Array.from(new Set(sessRes.value.data.map((s: any) => s.date).filter(Boolean)));
        if (datesFromSessions.length > 0) setSessionDates(datesFromSessions as string[]);
      }

      if (notifRes.status === "fulfilled" && notifRes.value.data) {
        setSysNotifications(notifRes.value.data);
        localStorage.setItem("edunexus_system_notifications", JSON.stringify(notifRes.value.data));
      }
    } catch (e) {}

    await fetchSupabaseAttempts();

    try {
      const savedAtt = localStorage.getItem("edunexus_attendance");
      if (savedAtt) setAttendanceRecords(JSON.parse(savedAtt));
    } catch (e) {}
  }, [fetchSupabaseAttempts]);

  useEffect(() => {
    setMounted(true);
    loadStorageData();
    fetchSupabaseStudents();

    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const hash = window.location.hash.replace("#", "") as AdminTab;
        const validTabs: AdminTab[] = ["lessons", "analytics", "practice", "notifications", "students", "online_schedule", "reports"];
        if (validTabs.includes(hash)) {
          setActiveTab(hash);
        } else {
          setActiveTab("practice");
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("storage", loadStorageData);

    const channel = supabase
      .channel("admin-realtime-global-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => loadStorageData())
      .on("postgres_changes", { event: "*", schema: "public", table: "practice_exams" }, () => loadStorageData())
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_attempts" }, () => fetchSupabaseAttempts())
      .on("postgres_changes", { event: "*", schema: "public", table: "attempts" }, () => fetchSupabaseAttempts())
      .on("postgres_changes", { event: "*", schema: "public", table: "quiz_attempts" }, () => fetchSupabaseAttempts())
      .on("broadcast", { event: "new_attempt" }, (payload: any) => {
        if (payload?.payload) {
          setAllAttempts(prev => [payload.payload, ...prev]);
          showToast("Học sinh " + (payload.payload.studentName || "") + " vừa nộp bài thi!");
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("storage", loadStorageData);
    };
  }, [loadStorageData, fetchSupabaseStudents, fetchSupabaseAttempts]);

  const saveToStorage = async (newChapters: any[]) => {
    setChapters(newChapters);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_course_data", JSON.stringify(newChapters));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {}
    }

    try {
      const { data: existingRows } = await supabase.from("courses").select("id").limit(1);
      if (existingRows && existingRows.length > 0) {
        await supabase
          .from("courses")
          .update({ chapters: newChapters, updated_at: new Date().toISOString() })
          .eq("id", existingRows[0].id);
      } else {
        await supabase
          .from("courses")
          .insert([{ chapters: newChapters, updated_at: new Date().toISOString() }]);
      }
    } catch (err: any) {}
  };

  const savePracticeExams = async (newExams: any[]) => {
    setPracticeExams(newExams);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_practice_exams", JSON.stringify(newExams));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {}
    }
  };

  const handleChangeExamCategory = async (examId: string, newCategory: string) => {
    const updated = practiceExams.map(ex => ex.id === examId ? { ...ex, category: newCategory } : ex);
    await savePracticeExams(updated);
    try {
      await supabase.from("practice_exams").update({ category: newCategory }).eq("id", examId);
      showToast("Đã chuyển đề sang danh mục: " + newCategory);
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

    const targetAttempts = (allAttempts || []).filter(a => a.quizId === examId);
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
    if (typeof window !== "undefined") {
      localStorage.setItem("edunexus_attempts", JSON.stringify(updatedList));
    }
    showToast("Hệ thống đã tự động chấm lại điểm cho " + targetAttempts.length + " lượt thi của học sinh!");
  };

  const handleCreateNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim() || !createModal) return;
    let newChapters = [...(chapters || [])];
    if (createModal.type === "chapter") {
      newChapters.push({ id: "chap-" + Date.now(), title: newItemTitle, target_mode: newItemTargetMode, lessons: [] });
    } else if (createModal.type === "lesson" && createModal.chapterId) {
      newChapters = newChapters.map(chap => chap?.id === createModal.chapterId ? {
        ...chap, lessons: [...(chap.lessons || []), {
          id: "les-" + Date.now(), title: newItemTitle, description: newItemDescription, duration: 45, format: "Zoom", target_mode: newItemTargetMode,
          lecture_files: [], homework_files: [], handwritten_notes: [], video_list: [], test_quizzes: [], extra_resources: []
        }]
      } : chap);
    }
    await saveToStorage(newChapters); 
    setCreateModal(null); 
    setNewItemTitle(""); 
    setNewItemDescription(""); 
    setNewItemFormat("Zoom");
    setNewItemTargetMode("all");
    showToast("Đã thêm " + (createModal.type === "chapter" ? "chương" : "bài học") + " thành công!");
  };

  const handleEditLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLessonModal || !editLessonForm.title.trim()) return;
    const newChapters = (chapters || []).map(chap => chap?.id === editLessonModal.chapterId ? {
      ...chap, lessons: (chap?.lessons || []).map((les: any) => les?.id === editLessonModal.lesson.id ? { ...les, ...editLessonForm } : les)
    } : chap);
    await saveToStorage(newChapters); 
    setEditLessonModal(null); 
    showToast("Đã cập nhật thông tin bài học!");
  };

  const handleDeleteLesson = async (chapterId: string, lessonId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa bài học này?")) return;
    const newChapters = (chapters || []).map(chap => {
      if (chap?.id === chapterId) { 
        return { ...chap, lessons: (chap?.lessons || []).filter((l: any) => l?.id !== lessonId) }; 
      }
      return chap;
    });
    await saveToStorage(newChapters); 
    showToast("Đã xóa bài học!");
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
    await saveToStorage(newChapters); 
    setResTitle(""); 
    setResUrl(""); 
    setVidType("lecture");
    setResourceModal(null); 
    showToast("Đã thêm tài nguyên thành công!");
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
    await saveToStorage(newChapters); 
    setBoostModal(null); 
    setBoostForm({ title: "", type: "video", url: "", note: "" }); 
    showToast("Đã thêm tài liệu tăng cường!");
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
    await saveToStorage(newChapters); 
    setDriveLinkModal(null); 
    setDriveLinkForm({ title: "", url: "" }); 
    showToast("Đã đính kèm file Drive!");
  };

  const handleDeleteResource = async (lessonId: string, resType: string, resId: string) => {
    if (!confirm("Xác nhận xóa tài nguyên này?")) return;
    const newChapters = (chapters || []).map(chap => ({ 
      ...chap, 
      lessons: (chap?.lessons || []).map((les: any) => les?.id === lessonId ? { ...les, [resType]: (les[resType] || []).filter((r: any) => r?.id !== resId) } : les) 
    }));
    await saveToStorage(newChapters);
    if (viewResourcesModal && viewResourcesModal.lessonId === lessonId && viewResourcesModal.type === resType) {
      setViewResourcesModal(prev => prev ? { ...prev, items: (prev.items || []).filter(i => i?.id !== resId) } : null);
    }
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
    await saveToStorage(newChapters);
    setEditResourceModal(null); 
    showToast("Đã cập nhật thông tin tài liệu!");
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
    showToast("Đã " + (status === "approved" ? "duyệt" : "từ chối/khóa") + " học sinh thành công!");
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
    showToast("Đã xóa học sinh khỏi cơ sở dữ liệu.");
  };

  const handleDeleteSession = async (sessionId: string, sessionTitle: string) => {
    if (!confirm("Bạn có chắc chắn muốn XÓA ca học \"" + sessionTitle + "\" khỏi hệ thống?")) return;

    try {
      await supabase.from("sessions").delete().eq("id", sessionId);
    } catch (err: any) {}

    const updatedSessions = onlineSessions.filter(s => s.id !== sessionId);
    setOnlineSessions(updatedSessions);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_online_sessions", JSON.stringify(updatedSessions));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {}
    }
    showToast("Đã xóa ca học \"" + sessionTitle + "\" thành công!");
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

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_attendance_dates", JSON.stringify(updatedDates));
        localStorage.setItem("edunexus_attendance", JSON.stringify(updatedAtt));
        localStorage.setItem("edunexus_online_sessions", JSON.stringify(updatedSessions));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {}
    }
    showToast("Đã xóa ngày học " + dateToDelete + " thành công!");
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

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_attendance_dates", JSON.stringify(updatedDates));
        localStorage.setItem("edunexus_online_sessions", JSON.stringify(updatedSessions));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {}
    }
    setIsAddDateModalOpen(false);
    setNewDateTitle("");
    showToast("Đã thêm ngày học " + displayDate + " (" + finalTimeSlot + ") thành công!");
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

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_online_sessions", JSON.stringify(updatedSessions));
        localStorage.setItem("edunexus_attendance_dates", JSON.stringify(updatedDates));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {}
    }

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
    showToast("Đã phát link buổi học (" + dispDate + " • " + finalTimeSlot + ") lên hệ thống thành công!");
  };

  const handleToggleAttendance = (studentId: string, studentName: string, sessionDate: string) => {
    const existing = attendanceRecords.find(a => a.studentId === studentId && a.sessionDate === sessionDate);
    let updated: any[];
    if (existing && existing.status === "present") {
      updated = attendanceRecords.filter(a => !(a.studentId === studentId && a.sessionDate === sessionDate));
      showToast("Đã hủy điểm danh của " + studentName + " ngày " + sessionDate);
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
      showToast("Đã tích có mặt cho " + studentName + " ngày " + sessionDate + "!");
    }
    setAttendanceRecords(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_attendance", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {}
    }
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
    showToast("Đã lưu Video chữa bài thành công!");
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

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_system_notifications", JSON.stringify(updated)); 
        window.dispatchEvent(new Event("storage"));
      } catch (err) {}
    }
    setNotifTitle(""); 
    setNotifContent(""); 
    showToast("Đã phát thông báo thành công!");
  };

  const handleDeleteNotification = async (id: string) => {
    if (!confirm("Thu hồi thông báo này?")) return;
    const updated = (sysNotifications || []).filter(n => n?.id !== id);
    setSysNotifications(updated); 
    try {
      await supabase.from("system_notifications").delete().eq("id", id);
    } catch {}
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_system_notifications", JSON.stringify(updated)); 
        window.dispatchEvent(new Event("storage"));
      } catch (err) {}
    }
  };

  // 3. TỔNG HỢP DANH SÁCH ĐỀ THI: KẾT HỢP TẤT CẢ NGUỒN ĐỂ KHÔNG BAO GIỜ BỊ 0 ĐỀ
  const allConsolidatedPracticeExams = useMemo(() => {
    const list: any[] = [...(practiceExams || [])];
    const existingTitles = new Set(list.map(e => normalizeTitle(e.title)));

    // Quét thêm từ các chương bài học nếu bảng practice_exams thiếu
    (chapters || []).forEach(ch => {
      (ch?.lessons || []).forEach((ls: any) => {
        (ls?.test_quizzes || []).forEach((q: any) => {
          const normTitle = normalizeTitle(q?.title);
          if (normTitle && !existingTitles.has(normTitle)) {
            existingTitles.add(normTitle);
            list.push({
              id: q.id || ("quiz-" + normTitle),
              title: q.title || "Đề thi",
              category: q.category || "Luyện đề",
              duration_minutes: q.duration_minutes || 45,
              allowRetake: true,
              allowViewFile: true,
              target_mode: ls.target_mode || "all"
            });
          }
        });
      });
    });

    return list;
  }, [practiceExams, chapters]);

  const activeLessons = useMemo(() => {
    if (selectedChapterId === "all") return (chapters || []).flatMap(ch => ch?.lessons || []);
    return (chapters || []).find(ch => ch?.id === selectedChapterId)?.lessons || [];
  }, [chapters, selectedChapterId]);

  const offlineLessonCount = useMemo(() => {
    return (chapters || []).reduce((acc, chap) => {
      if (chap?.target_mode === "online") return acc;
      return acc + (chap?.lessons || []).filter((l: any) => l?.target_mode !== "online").length;
    }, 0);
  }, [chapters]);

  const onlineLessonCount = useMemo(() => {
    return (chapters || []).reduce((acc, chap) => {
      if (chap?.target_mode === "offline") return acc;
      return acc + (chap?.lessons || []).filter((l: any) => l?.target_mode === "online" || l?.target_mode === "all" || (!l?.target_mode && l?.format === "Zoom")).length;
    }, 0);
  }, [chapters]);

  const flattenedLessons = useMemo(() => {
    let index = 1;
    return (chapters || [])
      .filter(chap => lessonModeTab === "all" || !chap?.target_mode || chap?.target_mode === lessonModeTab || chap?.target_mode === "all")
      .flatMap(chap => 
        (chap?.lessons || [])
          .filter((les: any) => lessonModeTab === "all" || !les?.target_mode || les?.target_mode === lessonModeTab || les?.target_mode === "all")
          .map((les: any) => ({
            ...les,
            chapterId: chap?.id || "chap-default",
            chapterTitle: (chap?.title || "").split(":")[0] || chap?.title || "Chương",
            index: index++
          }))
      );
  }, [chapters, lessonModeTab]);

  // 4. BẢNG XẾP HẠNG HỌC VIÊN: SO KHỚP CHÍNH XÁC TẤT CẢ TÀI KHOẢN (KỂ CẢ dung123)
  const analyticsData = useMemo(() => {
    const stats: Record<string, any> = {};

    (registeredStudents || []).forEach(s => {
      stats[s.id] = {
        id: s.id,
        name: s.full_name || s.username || "Học sinh",
        username: s.username || (s.email ? s.email.split("@")[0] : ""),
        school: s.school || "THPT",
        mode: s.learning_mode || s.study_mode || "online",
        totalAttempts: 0,
        hwMaxScores: {},
        testMaxScores: {}
      };
    });

    (allAttempts || []).forEach(att => {
      if (!att) return;
      const attStuId = String(att.studentId || att.user_id || "");
      const attStuName = String(att.studentName || att.user_name || "").toLowerCase().trim();

      let matchedProfile = (registeredStudents || []).find(s => 
        s.id === attStuId ||
        (s.username && s.username.toLowerCase() === attStuId.toLowerCase()) ||
        (s.email && s.email.toLowerCase().includes(attStuId.toLowerCase())) ||
        (s.full_name && s.full_name.toLowerCase().trim() === attStuName) ||
        (s.username && s.username.toLowerCase().trim() === attStuName)
      );

      const targetId = matchedProfile ? matchedProfile.id : (attStuId || attStuName);
      if (!targetId) return;

      if (!stats[targetId]) {
        stats[targetId] = {
          id: targetId,
          name: att.studentName || attStuName || "Học sinh",
          username: attStuId,
          school: "THPT",
          mode: "online",
          totalAttempts: 0,
          hwMaxScores: {},
          testMaxScores: {}
        };
      }

      const st = stats[targetId];
      st.totalAttempts++;
      const sc = Number(att.score ?? att.points ?? 0);
      const qKey = att.quizId || att.exam_id || att.examTitle || "quiz";

      if (att.type === "homework" || att.isHomework) {
        st.hwMaxScores[qKey] = Math.max(st.hwMaxScores[qKey] || 0, sc);
      } else {
        st.testMaxScores[qKey] = Math.max(st.testMaxScores[qKey] || 0, sc);
      }
    });

    return Object.values(stats)
      .filter((st: any) => {
        if (analyticsModeFilter === "all") return true;
        return st.mode === analyticsModeFilter;
      })
      .map((st: any) => {
        const hwVals = Object.values(st.hwMaxScores) as number[];
        const testVals = Object.values(st.testMaxScores) as number[];
        const hwAvg = hwVals.length > 0 ? (hwVals.reduce((a, b) => a + b, 0) / hwVals.length) : 0;
        const testAvg = testVals.length > 0 ? (testVals.reduce((a, b) => a + b, 0) / testVals.length) : 0;
        const allVals = [...hwVals, ...testVals];
        const overallAvg = allVals.length > 0 ? (allVals.reduce((a, b) => a + b, 0) / allVals.length) : 0;
        return { ...st, hwAvg, testAvg, overallAvg, completedExams: allVals.length };
      })
      .sort((a: any, b: any) => Number(b.overallAvg || 0) - Number(a.overallAvg || 0));
  }, [allAttempts, registeredStudents, analyticsModeFilter]);

  // 5. BẢNG THEO DÕI ĐỀ THI & LƯỢT NỘP (SO KHỚP TIÊU ĐỀ KHÔNG DẤU)
  const examsWithScoresData = useMemo(() => {
    let list = [...allConsolidatedPracticeExams];
    if (practiceCategoryFilter !== "Tất cả danh mục") {
      list = list.filter(ex => ex?.category === practiceCategoryFilter);
    }

    return list.map(ex => {
      const cleanExTitle = normalizeTitle(ex?.title);

      const attempts = (allAttempts || []).filter(a => {
        if (!a) return false;
        const matchId = (a.quizId === ex.id) || (a.exam_id === ex.id) || (a.quiz_id === ex.id);
        const aTitle = normalizeTitle(a.examTitle || a.quizTitle || a.title || a.exam_title || a.name);
        const matchTitle = cleanExTitle && aTitle && (
          aTitle === cleanExTitle || 
          cleanExTitle.includes(aTitle) || 
          aTitle.includes(cleanExTitle)
        );
        return matchId || matchTitle;
      });

      const studentMap = new Map();
      attempts.forEach(att => {
        const key = att.studentId || att.username || att.studentName;
        const prev = studentMap.get(key);
        if (!prev || Number(att.score || 0) > Number(prev.score || 0)) {
          studentMap.set(key, att);
        }
      });

      const uniqueStudentAttempts = Array.from(studentMap.values());
      const scores = uniqueStudentAttempts.map(a => Number(a.score || 0));
      const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

      return {
        ...ex,
        totalSubmissions: attempts.length,
        uniqueStudentCount: uniqueStudentAttempts.length,
        avgScore: avgScore.toFixed(2),
        maxScore: maxScore.toFixed(2),
        attempts
      };
    });
  }, [allConsolidatedPracticeExams, practiceCategoryFilter, allAttempts]);

  const sortedAndFilteredStudents = useMemo(() => {
    let list = [...registeredStudents];
    if (attendanceSearchText.trim()) {
      const q = attendanceSearchText.toLowerCase();
      list = list.filter(s => (s.full_name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q));
    }
    if (attendanceFilterMode !== "all") {
      list = list.filter(s => s.learning_mode === attendanceFilterMode || s.study_mode === attendanceFilterMode);
    }
    if (attendanceSortAZ) {
      list.sort((a, b) => {
        const getLastName = (name: string) => {
          const parts = (name || "").trim().split(/\s+/);
          return parts[parts.length - 1] || "";
        };
        const lastA = getLastName(a.full_name);
        const lastB = getLastName(b.full_name);
        const cmp = lastA.localeCompare(lastB, "vi", { sensitivity: "base" });
        if (cmp !== 0) return cmp;
        return (a.full_name || "").localeCompare(b.full_name || "", "vi", { sensitivity: "base" });
      });
    }
    return list;
  }, [registeredStudents, attendanceSearchText, attendanceFilterMode, attendanceSortAZ]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex bg-[#F8FAFC] font-sans text-slate-800 relative">
        <aside className="w-64 bg-[#1E40AF] text-white/90 p-5 flex flex-col shrink-0">
          <div className="flex items-center gap-3 mb-8"> 
            <div className="w-10 h-10 bg-white text-[#1E40AF] rounded-2xl flex items-center justify-center font-black">TCT</div>
            <div>
              <h1 className="font-extrabold text-sm text-white">TÂM CHÍ TÀI</h1>
              <p className="text-[9px] text-blue-200 font-bold uppercase mt-0.5">Admin Panel</p>
            </div>
          </div>
        </aside>
        <main className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-3 text-slate-600 font-bold text-xs bg-white px-5 py-3 rounded-2xl border border-slate-200">
            <div className="w-4 h-4 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin"></div>
            Đang tải dữ liệu quản trị...
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] font-sans text-slate-800 relative selection:bg-blue-500/20">
      <AnimatePresence>
        {successToast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-5 right-5 z-[500] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-bold text-xs">
            <CheckCircle2 className="w-4 h-4" /> {successToast}
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="w-64 bg-[#1E40AF] border-r border-[#1E40AF] text-white/90 flex flex-col shrink-0 p-5 shadow-sm h-screen">
        <div className="flex items-center gap-3 mb-6 shrink-0"> 
          <div className="w-10 h-10 bg-white text-[#1E40AF] rounded-2xl flex items-center justify-center font-black text-sm">TCT</div>
          <div>
            <h1 className="font-extrabold text-sm text-white leading-tight">TÂM CHÍ TÀI</h1>
            <p className="text-[9px] text-blue-200 font-bold uppercase mt-0.5">Admin Panel</p>
          </div>
        </div>

        <nav className="space-y-1.5 flex-1 overflow-y-auto custom-scrollbar">
          {[
            { key: "practice", label: "Hệ thống Luyện đề", icon: Target },
            { key: "analytics", label: "Điểm số & Xếp hạng", icon: BarChart2 },
            { key: "lessons", label: "Nội dung bài học", icon: BookOpen },
            { key: "notifications", label: "Quản lý Thông báo", icon: Bell },
            { key: "students", label: "Quản lý Học viên & Duyệt", icon: UserCheck },
            { key: "online_schedule", label: "Lịch học & Điểm danh Online", icon: Calendar },
            { key: "reports", label: "Báo cáo Phụ huynh", icon: FileCheck }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleSwitchTab(tab.key as any)}
                className={"w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer " + (
                  isActive ? "bg-white text-[#1E40AF] shadow-xs font-black" : "text-blue-100 hover:bg-white/10"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-blue-400/20 shrink-0">
          <button
            type="button"
            onClick={handleAdminLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-rose-600 text-blue-100 hover:text-white transition font-bold text-xs cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Đăng xuất Admin</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200/80 flex items-center px-8 shadow-2xs shrink-0 justify-between sticky top-0 z-10">
          <h2 className="font-extrabold text-slate-900 text-sm">
            {activeTab === "practice" ? "Quản trị Kho Luyện đề & Bảng Điểm" : activeTab === "analytics" ? "Tổng hợp Điểm & Xếp hạng" : activeTab === "lessons" ? "Nội dung bài học" : activeTab === "notifications" ? "Phát Thông Báo" : activeTab === "students" ? "Quản lý Học viên" : activeTab === "reports" ? "Báo cáo Phụ huynh" : "Lịch học & Điểm danh Online"}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                await Promise.all([loadStorageData(), fetchSupabaseStudents(), fetchSupabaseAttempts()]);
                showToast("Đã đồng bộ toàn bộ đề và điểm số tức thì!");
              }}
              title="Làm mới dữ liệu từ Supabase"
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] rounded-xl text-xs font-bold transition cursor-pointer border border-blue-200 shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Đồng bộ dữ liệu
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600">
              <GraduationCap className="w-4 h-4 text-blue-600" /> Ban Giám Khảo
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-50/30">
          {activeTab === "practice" && (
            <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
              <div className="flex gap-2.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs w-fit">
                <button onClick={() => setPracticeSubTab("manage")} className={"px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer " + (practiceSubTab === "manage" ? "bg-[#1D4ED8] text-white shadow-xs font-black" : "text-slate-500 hover:bg-slate-50")}>Kho Đề & Tải lên</button>
                <button onClick={() => setPracticeSubTab("scores")} className={"px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer " + (practiceSubTab === "scores" ? "bg-[#1D4ED8] text-white shadow-xs font-black" : "text-slate-500 hover:bg-slate-50")}>Điểm & Xếp hạng Luyện đề</button>
              </div>

              {practiceSubTab === "manage" && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs flex items-center gap-4 min-w-[200px]">
                      <div className="w-12 h-12 bg-blue-50 text-[#1D4ED8] rounded-2xl flex items-center justify-center"><Target className="w-6 h-6"/></div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Tổng số đề</p>
                        <p className="text-2xl font-black text-slate-900">{allConsolidatedPracticeExams.length}</p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 px-5 py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold rounded-2xl shadow-sm transition cursor-pointer">
                      <UploadCloud className="w-5 h-5" /> + Tải lên Đề thi mới (.docx / .pdf)
                      <input type="file" accept=".docx,.pdf" className="hidden" onChange={(e) => {
                        if (e.target.files?.[0]) { setTestFile(e.target.files[0]); setUploadMode("practice"); setEditingExamData(null); }
                        e.target.value = "";
                      }} />
                    </label>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">Danh sách Kho Đề Thực Chiến ({allConsolidatedPracticeExams.length} đề)</h3>
                      <span className="text-[11px] text-slate-400 font-semibold">* Click vào phân loại để đổi nhanh danh mục</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-white text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 font-bold">
                          <tr>
                            <th className="py-3.5 px-5 w-1/4">Tiêu đề đề thi</th>
                            <th className="py-3.5 px-3 text-center">Phân loại</th>
                            <th className="py-3.5 px-3 text-center">Phân hệ lớp</th>
                            <th className="py-3.5 px-3 text-center">Làm lại bài</th>
                            <th className="py-3.5 px-4 text-center">Quyền xem file</th>
                            <th className="py-3.5 px-4 text-center">Link đề Drive</th>
                            <th className="py-3.5 px-4 text-center text-amber-700">Video chữa</th>
                            <th className="py-3.5 px-5 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/60 font-semibold">
                          {allConsolidatedPracticeExams.map((ex, exIdx) => (
                            <tr key={ex?.id || exIdx} className="hover:bg-slate-50/50 transition-colors bg-white">
                              <td className="py-3.5 px-5 font-bold text-slate-800 truncate max-w-[220px]" title={ex?.title}>
                                {ex?.title || "Đề thi"}
                              </td>
                              <td className="py-3.5 px-3 text-center">
                                <div className="relative inline-block">
                                  <select
                                    value={ex?.category || "Luyện đề"}
                                    onChange={(e) => handleChangeExamCategory(ex.id, e.target.value)}
                                    className="appearance-none px-2.5 py-1 pr-6 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-black text-[10px] uppercase rounded-lg tracking-wider cursor-pointer outline-none transition"
                                  >
                                    {EXAM_CATEGORIES.map(cat => (
                                      <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                  </select>
                                  <ChevronDown className="w-3 h-3 text-indigo-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                              </td>
                              <td className="py-3.5 px-3 text-center">
                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border bg-blue-50 text-[#1D4ED8] border-blue-200">
                                  {ex.target_mode === "online" ? "Online" : ex.target_mode === "offline" ? "Offline" : "Cả 2"}
                                </span>
                              </td>
                              <td className="py-3.5 px-3 text-center">
                                <button onClick={async () => {
                                  const newAllow = !(ex?.allowRetake ?? true);
                                  const newExams = practiceExams.map(e => e?.id === ex?.id ? { ...e, allowRetake: newAllow } : e);
                                  await savePracticeExams(newExams);
                                  try { await supabase.from("practice_exams").update({ allowRetake: newAllow }).eq("id", ex.id); } catch {}
                                  showToast("Đã thay đổi quyền làm lại.");
                                }} className="cursor-pointer">
                                  {(ex?.allowRetake ?? true) ? <ToggleRight className="w-7 h-7 text-emerald-500 mx-auto" /> : <ToggleLeft className="w-7 h-7 text-slate-300 mx-auto" />}
                                </button>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <button onClick={async () => {
                                  const newAllow = !(ex?.allowViewFile ?? true);
                                  const newExams = practiceExams.map(e => e?.id === ex?.id ? { ...e, allowViewFile: newAllow } : e);
                                  await savePracticeExams(newExams);
                                  try { await supabase.from("practice_exams").update({ allowViewFile: newAllow }).eq("id", ex.id); } catch {}
                                  showToast("Đã cập nhật quyền xem file.");
                                }} className="cursor-pointer">
                                  {(ex?.allowViewFile ?? true) ? <ToggleRight className="w-7 h-7 text-[#1D4ED8] mx-auto" /> : <ToggleLeft className="w-7 h-7 text-slate-300 mx-auto" />}
                                </button>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <button onClick={async () => {
                                  const url = prompt("Nhập link Google Drive mới:", ex?.driveUrl || "");
                                  if (url !== null) {
                                    const newExams = practiceExams.map(e => e?.id === ex?.id ? { ...e, driveUrl: url } : e);
                                    await savePracticeExams(newExams);
                                    try { await supabase.from("practice_exams").update({ driveUrl: url }).eq("id", ex.id); } catch {}
                                    showToast("Đã cập nhật link Drive.");
                                  }
                                }} className="text-[#1D4ED8] hover:underline flex items-center justify-center gap-1 font-semibold text-[11px] mx-auto cursor-pointer">
                                  <LinkIcon className="w-3 h-3" /> {ex?.driveUrl ? "Sửa link" : "Thêm link"}
                                </button>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  onClick={() => {
                                    setVideoModalExam(ex);
                                    setSolutionVideoInput(ex?.solutionVideoUrl || ex?.videoUrl || "");
                                  }}
                                  className={"px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer " + (
                                    (ex?.solutionVideoUrl || ex?.videoUrl)
                                      ? "bg-amber-50 text-amber-800 border border-amber-200" 
                                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                  )}
                                >
                                  <Video className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{(ex?.solutionVideoUrl || ex?.videoUrl) ? "Đã có video" : "+ Gắn video"}</span>
                                </button>
                              </td>
                              <td className="py-3.5 px-5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      const cleanExTitle = normalizeTitle(ex?.title);
                                      const attemptsForExam = (allAttempts || []).filter(a => {
                                        if (!a) return false;
                                        const matchId = (a.quizId === ex.id) || (a.exam_id === ex.id) || (a.quiz_id === ex.id);
                                        const aTitle = normalizeTitle(a.examTitle || a.quizTitle || a.title || a.exam_title || a.name);
                                        const matchTitle = cleanExTitle && aTitle && (
                                          aTitle === cleanExTitle || 
                                          cleanExTitle.includes(aTitle) || 
                                          aTitle.includes(cleanExTitle)
                                        );
                                        return matchId || matchTitle;
                                      });

                                      setAzotaScoreViewModal({
                                        isOpen: true,
                                        examTitle: ex.title,
                                        attempts: attemptsForExam
                                      });
                                    }}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                                    title="Xem bảng điểm học sinh làm đề này"
                                  >
                                    <BarChart2 className="w-4 h-4" />
                                  </button>

                                  <button
                                    onClick={() => {
                                      setTestExamRoom({
                                        id: ex.id,
                                        title: "[TEST ADMIN] " + ex.title,
                                        duration: ex.duration_minutes || 45,
                                        isHomework: false
                                      });
                                    }}
                                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                                    title="Làm thử bài thi"
                                  >
                                    <Play className="w-3 h-3 fill-indigo-600" /> Test
                                  </button>
                                  <button onClick={async () => { 
                                    if (confirm("Xóa đề này khỏi kho?")) {
                                      const updated = practiceExams.filter(e => e?.id !== ex?.id);
                                      await savePracticeExams(updated);
                                      try { await supabase.from("practice_exams").delete().eq("id", ex.id); } catch {}
                                    } 
                                  }} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer">
                                    <Trash2 className="w-4 h-4"/>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {practiceSubTab === "scores" && (
                <div className="space-y-5">
                  <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-2">
                      <Filter className="w-4 h-4 text-[#1D4ED8]"/> Bộ lọc danh mục đề thi
                    </h3>
                    <select 
                      value={practiceCategoryFilter} 
                      onChange={e => setPracticeCategoryFilter(e.target.value)} 
                      className="px-4 py-2 text-xs font-bold text-[#1D4ED8] bg-blue-50 border border-blue-100 rounded-xl outline-none cursor-pointer"
                    >
                      <option value="Tất cả danh mục">Tất cả danh mục</option>
                      {EXAM_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                          Danh Sách Đề Thi & Bảng Điểm Học Sinh ({practiceCategoryFilter})
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          * Bấm vào bất kỳ đề thi nào để mở toàn bộ học sinh đã nộp bài đề thi đó.
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 font-bold">{examsWithScoresData.length} đề thi</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-white text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 font-bold">
                          <tr>
                            <th className="py-3.5 px-5 w-14 text-center">STT</th>
                            <th className="py-3.5 px-5 min-w-[240px]">Tên đề thi</th>
                            <th className="py-3.5 px-5 text-center">Phân loại</th>
                            <th className="py-3.5 px-5 text-center">Số HS làm bài</th>
                            <th className="py-3.5 px-5 text-center text-blue-700">Điểm TB cả lớp</th>
                            <th className="py-3.5 px-5 text-center text-emerald-700">Điểm cao nhất</th>
                            <th className="py-3.5 px-5 text-right">Chi tiết</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/60 font-semibold">
                          {examsWithScoresData.map((ex, i) => (
                            <tr 
                              key={ex.id || i} 
                              onClick={() => {
                                const cleanExTitle = normalizeTitle(ex?.title);
                                const attemptsForExam = (allAttempts || []).filter(a => {
                                  if (!a) return false;
                                  const matchId = (a.quizId === ex.id) || (a.exam_id === ex.id) || (a.quiz_id === ex.id);
                                  const aTitle = normalizeTitle(a.examTitle || a.quizTitle || a.title || a.exam_title || a.name);
                                  const matchTitle = cleanExTitle && aTitle && (
                                    aTitle === cleanExTitle || 
                                    cleanExTitle.includes(aTitle) || 
                                    aTitle.includes(cleanExTitle)
                                  );
                                  return matchId || matchTitle;
                                });

                                setAzotaScoreViewModal({
                                  isOpen: true,
                                  examTitle: ex.title,
                                  attempts: attemptsForExam
                                });
                              }}
                              className="hover:bg-blue-50/30 transition-colors bg-white cursor-pointer group"
                            >
                              <td className="py-3.5 px-5 font-bold text-slate-400 text-center">{i + 1}</td>
                              <td className="py-3.5 px-5 font-bold text-slate-800 group-hover:text-[#1D4ED8] transition-colors">
                                <div>{ex.title}</div>
                                <span className="text-[10px] text-slate-400 font-normal">{ex.duration_minutes || 45} phút</span>
                              </td>
                              <td className="py-3.5 px-5 text-center">
                                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-black uppercase">
                                  {ex.category || "Luyện đề"}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 text-center font-bold text-slate-700">
                                {ex.uniqueStudentCount} bạn ({ex.totalSubmissions} lượt)
                              </td>
                              <td className="py-3.5 px-5 text-center">
                                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-100">
                                  {ex.avgScore}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 text-center">
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-black rounded-lg border border-emerald-100">
                                  {ex.maxScore}
                                </span>
                              </td>
                              <td className="py-3.5 px-5 text-right">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const cleanExTitle = normalizeTitle(ex?.title);
                                    const attemptsForExam = (allAttempts || []).filter(a => {
                                      if (!a) return false;
                                      const matchId = (a.quizId === ex.id) || (a.exam_id === ex.id) || (a.quiz_id === ex.id);
                                      const aTitle = normalizeTitle(a.examTitle || a.quizTitle || a.title || a.exam_title || a.name);
                                      const matchTitle = cleanExTitle && aTitle && (
                                        aTitle === cleanExTitle || 
                                        cleanExTitle.includes(aTitle) || 
                                        aTitle.includes(cleanExTitle)
                                      );
                                      return matchId || matchTitle;
                                    });

                                    setAzotaScoreViewModal({
                                      isOpen: true,
                                      examTitle: ex.title,
                                      attempts: attemptsForExam
                                    });
                                  }}
                                  className="px-3 py-1 bg-white border border-slate-200 hover:border-[#1D4ED8] hover:text-[#1D4ED8] text-slate-600 font-bold text-xs rounded-xl shadow-2xs transition inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5"/> Xem điểm
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col h-fit">
                <h3 className="font-extrabold text-slate-900 text-[15px] mb-5 flex items-center gap-2"><Send className="w-4 h-4 text-[#1D4ED8]" /> Soạn thông báo mới</h3>
                <form onSubmit={handleSendNotification} className="space-y-4">
                  <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Tiêu đề thông báo</label><input type="text" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} required placeholder="VD: Lịch học tuần này..." className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none" /></div>
                  <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Nội dung chi tiết</label><textarea rows={4} value={notifContent} onChange={e => setNotifContent(e.target.value)} required placeholder="Nội dung gửi cho học sinh..." className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none resize-none custom-scrollbar" /></div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Phân loại</label>
                    <select value={notifType} onChange={e => setNotifType(e.target.value as any)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none bg-white">
                      <option value="teacher">Giáo viên</option><option value="urgent">Khẩn cấp / Hạn chót</option><option value="exam">Nhắc nhở bài kiểm tra</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full mt-4 py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-[13px] rounded-2xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"><Send className="w-4 h-4" /> Gửi thông báo tới toàn bộ học sinh</button>
                </form>
              </div>
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col h-[calc(100vh-150px)]">
                <h3 className="font-extrabold text-slate-900 text-[15px] mb-5 flex items-center gap-2 shrink-0"><List className="w-4 h-4 text-[#1D4ED8]" /> Lịch sử gửi ({(sysNotifications || []).length})</h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                  {sysNotifications.map(notif => (
                    <div key={notif.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl relative group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 mb-1.5"><span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-blue-100 text-[#1D4ED8]">{notif.type}</span><span className="text-[10px] text-slate-400 font-medium">{new Date(notif.createdAt).toLocaleString('vi-VN')}</span></div>
                        <button onClick={() => handleDeleteNotification(notif.id)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <h4 className="font-bold text-slate-800 text-[13px]">{notif.title}</h4><p className="text-xs text-slate-500 mt-1 line-clamp-2">{notif.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "students" && (
            <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto text-left">
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1D4ED8] text-white text-[11px] uppercase tracking-wider font-black">
                      <tr>
                        <th className="py-4 px-4 text-center w-12">STT</th>
                        <th className="py-4 px-5">Họ và tên</th>
                        <th className="py-4 px-5">Liên hệ</th>
                        <th className="py-4 px-4">Trường & Khối</th>
                        <th className="py-4 px-4 text-center">Trạng thái</th>
                        <th className="py-4 px-5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {registeredStudents.map((student, idx) => (
                        <tr key={student.id || idx} className="hover:bg-slate-50/60 transition-colors bg-white/70">
                          <td className="py-4 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-4 px-5 font-bold text-slate-800"><div>{student.full_name}</div></td>
                          <td className="py-4 px-5"><div className="font-semibold text-slate-700">{student.email}</div></td>
                          <td className="py-4 px-4"><div className="font-medium text-slate-800">{student.school}</div><div className="text-[10px] text-blue-600 font-bold">{student.grade}</div></td>
                          <td className="py-4 px-4 text-center"><span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-[10px] uppercase rounded-lg border border-emerald-200">{student.approval_status === "approved" ? "Đã duyệt" : "Chờ duyệt"}</span></td>
                          <td className="py-4 px-5 text-right"><button onClick={() => handleDeleteStudent(student.id)} className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "online_schedule" && (
            <div className="space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto text-left">
              <div className="pt-2"><ScheduleView profile={null} mode="all" isAdmin={true} /></div>
            </div>
          )}

          {activeTab === "reports" && (
            <motion.div key="reports" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <AdminStudentReportPanel 
                registeredStudents={registeredStudents}
                allAttempts={allAttempts}
                chapters={chapters}
                practiceExams={allConsolidatedPracticeExams}
                attendanceRecords={attendanceRecords}
              />
            </motion.div>
          )}
        </div>
      </main>

      {/* MODAL XEM CHI TIẾT ĐIỂM HỌC SINH TỪNG ĐỀ (KIỂU AZOTA) */}
      <AnimatePresence>
        {azotaScoreViewModal.isOpen && (
          <div className="fixed inset-0 z-[800] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden text-left">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
                <div>
                  <span className="px-2.5 py-1 bg-blue-100 text-[#1D4ED8] rounded-full text-[10px] font-black uppercase tracking-wider">Bảng Điểm Làm Bài Thi</span>
                  <h3 className="font-black text-slate-900 text-base mt-1 flex items-center gap-2">{azotaScoreViewModal.examTitle}</h3>
                </div>
                <button onClick={() => setAzotaScoreViewModal({ isOpen: false, examTitle: "", attempts: [] })} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-xl cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {azotaScoreViewModal.attempts.map((att: any, idx: number) => {
                    const fullName = att.studentName || att.full_name || att.username || "Học sinh";
                    const scoreNum = Number(att.score ?? att.points ?? 0);
                    return (
                      <div key={att.id || idx} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col justify-between">
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-[13px] leading-tight truncate">{fullName}</h4>
                          <span className="text-xs font-black text-emerald-700 block mt-1">Điểm: {scoreNum.toFixed(1)} / 10</span>
                          <span className="text-[10px] text-slate-400 mt-1 block">Nộp lúc: {new Date(att.createdAt || att.created_at || Date.now()).toLocaleString("vi-VN")}</span>
                        </div>
                      </div>
                    );
                  })}
                  {azotaScoreViewModal.attempts.length === 0 && (
                    <div className="col-span-full py-16 text-center text-slate-400 font-medium text-xs">Chưa có lượt nộp bài nào của học sinh cho đề thi này.</div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL CONFIG ĐỀ THI AZOTA */}
      {testFile && (
        <AzotaExamConfigModal 
          isOpen={true} 
          file={testFile}
          mode={uploadMode} 
          onClose={() => { setTestFile(null); setEditingExamData(null); }} 
          onSave={async (examData: any) => {
            const newExam = { 
              id: "prac-" + Date.now(), 
              title: examData.title, 
              category: examData.category || "Giữa Kì 1", 
              duration_minutes: examData.duration_minutes || 45, 
              allowRetake: true, 
              allowViewFile: true, 
              data: examData.sections, 
              created_at: new Date().toISOString()
            };
            const updated = [newExam, ...practiceExams];
            await savePracticeExams(updated);
            try { await supabase.from("practice_exams").upsert(newExam); } catch (e) {}
            setTestFile(null);
            showToast("Đã thêm đề vào kho luyện đề!");
          }}
        />
      )}

      {testExamRoom && (
        <div className="fixed inset-0 z-[700] bg-white">
          <div className="h-10 bg-indigo-900 text-white flex items-center justify-between px-6 text-xs font-bold">
            <span>CHẾ ĐỘ TEST ĐỀ DÀNH CHO ADMIN</span>
            <button onClick={() => setTestExamRoom(null)} className="px-3 py-1 bg-white/20 rounded-lg text-white cursor-pointer">Thoát Test ✕</button>
          </div>
          <div className="h-[calc(100vh-40px)]">
            <ExamRoomView
              quizId={testExamRoom.id}
              quizTitle={testExamRoom.title}
              durationMinutes={testExamRoom.duration}
              profile={{ id: "admin-test", full_name: "Giáo viên", role: "admin" }}
              isHomework={false}
              onBackToDashboard={() => setTestExamRoom(null)}
            />
          </div>
        </div>
      )}
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
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center font-sans">
          <div className="bg-white border border-rose-200 rounded-3xl p-8 max-w-2xl w-full shadow-2xl">
            <h2 className="text-xl font-extrabold text-slate-900 mb-2">Đã phát hiện lỗi trong bảng điều khiển</h2>
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 font-mono text-xs text-rose-800 mb-6">{this.state.error?.toString()}</div>
            <button onClick={() => window.location.reload()} className="px-5 py-3 bg-blue-600 text-white font-bold rounded-xl text-xs cursor-pointer">Tải lại trang ngay</button>
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
