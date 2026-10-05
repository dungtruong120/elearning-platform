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
    return "lessons";
  });

  const [lessonModeTab, setLessonModeTab] = useState<"all" | "offline" | "online">("all");
  const [practiceSubTab, setPracticeSubTab] = useState<"manage" | "scores">("manage");

  // 2. KHỞI TẠO TỨC THÌ TỪ LOCALSTORAGE TRÁNH TRỄ KHI VÀO TRANG
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
  const [practiceStudentDetailModal, setPracticeStudentDetailModal] = useState<string | null>(null);
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

  // NẠP DANH SÁCH HỌC SINH TỪ SUPABASE
  const fetchSupabaseStudents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("role", "admin")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setRegisteredStudents(data);
        if (typeof window !== "undefined") {
          localStorage.setItem("edunexus_registered_students", JSON.stringify(data));
        }
      }
    } catch (err) {}
  }, []);

  // NẠP ĐIỂM SỐ VÀ LẦN THI TRỰC TIẾP TỪ SUPABASE
  const fetchSupabaseAttempts = useCallback(async () => {
    let combinedAttempts: any[] = [];
    try {
      const { data: exAttempts } = await supabase
        .from("exam_attempts")
        .select("*")
        .order("created_at", { ascending: false });
      if (exAttempts && Array.isArray(exAttempts)) {
        combinedAttempts = [...combinedAttempts, ...exAttempts];
      }
    } catch (e) {}

    try {
      const { data: genAttempts } = await supabase
        .from("attempts")
        .select("*")
        .order("created_at", { ascending: false });
      if (genAttempts && Array.isArray(genAttempts)) {
        combinedAttempts = [...combinedAttempts, ...genAttempts];
      }
    } catch (e) {}

    try {
      const { data: qAttempts } = await supabase
        .from("quiz_attempts")
        .select("*")
        .order("created_at", { ascending: false });
      if (qAttempts && Array.isArray(qAttempts)) {
        combinedAttempts = [...combinedAttempts, ...qAttempts];
      }
    } catch (e) {}

    if (combinedAttempts.length > 0) {
      const map = new Map();
      combinedAttempts.forEach(item => {
        const normalized = {
          ...item,
          quizId: item.quizId || item.exam_id || item.quiz_id || item.test_id,
          studentId: item.studentId || item.user_id || item.student_id,
          studentName: item.studentName || item.student_name || item.user_name || item.full_name || "Học sinh",
          score: Number(item.score ?? item.points ?? 0),
          type: item.type || (item.isHomework ? "homework" : "practice"),
          timeSpent: item.timeSpent || item.duration_seconds || item.duration || "15 phút",
          createdAt: item.createdAt || item.created_at || new Date().toISOString(),
          attemptNumber: item.attemptNumber || item.attempt_count || 1,
          feedback: item.feedback || item.comment || ""
        };
        const uniqueKey = item.id ? String(item.id) : (String(normalized.quizId) + "" + String(normalized.studentId) + "" + String(normalized.createdAt));
        map.set(uniqueKey, normalized);
      });
      const finalAttempts = Array.from(map.values());
      setAllAttempts(finalAttempts);
      if (typeof window !== "undefined") {
        localStorage.setItem("edunexus_attempts", JSON.stringify(finalAttempts));
      }
    } else {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("edunexus_attempts");
        if (saved) {
          try { setAllAttempts(JSON.parse(saved)); } catch (e) {}
        }
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

  // ĐỒNG BỘ NỀN TỪ SUPABASE
  const loadStorageData = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      const { data: courseRow } = await supabase
        .from("courses")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (courseRow && courseRow.chapters && Array.isArray(courseRow.chapters)) {
        setChapters(courseRow.chapters);
        localStorage.setItem("edunexus_course_data", JSON.stringify(courseRow.chapters));
      }
    } catch (e) {}

    try {
      const { data: dbExams } = await supabase
        .from("practice_exams")
        .select("*")
        .order("created_at", { ascending: false });

      if (dbExams && Array.isArray(dbExams)) {
        setPracticeExams(dbExams);
        localStorage.setItem("edunexus_practice_exams", JSON.stringify(dbExams));
      }
    } catch (e) {}

    try {
      const { data: dbSessions } = await supabase
        .from("sessions")
        .select("*")
        .order("created_at", { ascending: false });

      if (dbSessions && Array.isArray(dbSessions) && dbSessions.length > 0) {
        setOnlineSessions(dbSessions);
        localStorage.setItem("edunexus_online_sessions", JSON.stringify(dbSessions));
        const datesFromSessions = Array.from(new Set(dbSessions.map((s: any) => s.date).filter(Boolean)));
        if (datesFromSessions.length > 0) setSessionDates(datesFromSessions as string[]);
      }
    } catch (e) {}

    try {
      const { data: dbNotifs } = await supabase
        .from("system_notifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (dbNotifs && Array.isArray(dbNotifs)) {
        setSysNotifications(dbNotifs);
        localStorage.setItem("edunexus_system_notifications", JSON.stringify(dbNotifs));
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
          setActiveTab("lessons");
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("storage", loadStorageData);

    const channel = supabase
      .channel("admin-realtime-global-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => loadStorageData())
      .on("postgres_changes", { event: "*", schema: "public", table: "practice_exams" }, () => loadStorageData())
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => loadStorageData())
      .on("postgres_changes", { event: "*", schema: "public", table: "system_notifications" }, () => loadStorageData())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchSupabaseStudents())
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_attempts" }, () => fetchSupabaseAttempts())
      .on("postgres_changes", { event: "*", schema: "public", table: "attempts" }, () => fetchSupabaseAttempts())
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
        const { error } = await supabase
          .from("courses")
          .update({ chapters: newChapters, updated_at: new Date().toISOString() })
          .eq("id", existingRows[0].id);
        if (error) alert("Lỗi lưu bài học lên Supabase: " + error.message);
      } else {
        const { error } = await supabase
          .from("courses")
          .insert([{ chapters: newChapters, updated_at: new Date().toISOString() }]);
        if (error) alert("Lỗi chèn bài học lên Supabase: " + error.message);
      }
    } catch (err: any) {
      console.error("Lỗi khi lưu Supabase courses:", err);
    }
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

  // CẬP NHẬT TRỰC TIẾP LOẠI ĐỀ (DANH MỤC)
  const handleChangeExamCategory = async (examId: string, newCategory: string) => {
    const updated = practiceExams.map(ex => ex.id === examId ? { ...ex, category: newCategory } : ex);
    await savePracticeExams(updated);
    try {
      await supabase.from("practice_exams").update({ category: newCategory }).eq("id", examId);
      showToast("Đã chuyển đề sang danh mục: " + newCategory);
    } catch (e: any) {
      alert("Lỗi cập nhật danh mục: " + e.message);
    }
  };

  // HÀM TÍNH TOÁN LẠI ĐIỂM SỐ KHI GIÁO VIÊN SỬA ĐỀ/ĐÁP ÁN
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

  const quizMap = useMemo(() => {
    const map: Record<string, { chapterId: string; lessonId: string; type: string }> = {};
    (chapters || []).forEach(ch => { 
      (ch?.lessons || []).forEach((ls: any) => { 
        (ls?.test_quizzes || []).forEach((q: any) => { 
          if (q?.id) map[q.id] = { chapterId: ch?.id, lessonId: ls?.id, type: "test" }; 
        }); 
        (ls?.homework_files || []).forEach((q: any) => { 
          if (q?.is_quiz && q?.id) map[q.id] = { chapterId: ch?.id, lessonId: ls?.id, type: "homework" }; 
        }); 
      }); 
    }); 
    return map;
  }, [chapters]);

  const activeLessons = useMemo(() => {
    if (selectedChapterId === "all") return (chapters || []).flatMap(ch => ch?.lessons || []);
    return (chapters || []).find(ch => ch?.id === selectedChapterId)?.lessons || [];
  }, [chapters, selectedChapterId]);

  // PHÂN TÍCH ĐIỂM SỐ BTVN & BÀI KIỂM TRA ĐỊNH KỲ
  const analyticsData = useMemo(() => {
    const stats: Record<string, any> = {};

    (registeredStudents || []).forEach(s => {
      stats[s.id] = {
        id: s.id,
        name: s.full_name || "Học sinh",
        school: s.school || "THPT",
        mode: s.learning_mode || s.study_mode || "online",
        totalAttempts: 0,
        hwMaxScores: {},
        testMaxScores: {}
      };
    });

    const filteredAttempts = (allAttempts || []).filter(att => {
      if (!att || !att.quizId) return false;
      const qInfo = quizMap[att.quizId];
      if (!qInfo) return true;
      if (rankingScope === "course") return true;
      if (rankingScope === "chapter") return qInfo.chapterId === selectedChapterId;
      if (rankingScope === "lesson") return qInfo.lessonId === selectedLessonId;
      return true;
    });

    filteredAttempts.forEach(att => {
      if (!att?.studentId) return;
      if (!stats[att.studentId]) { 
        stats[att.studentId] = { 
          id: att.studentId, 
          name: att.studentName || "Học sinh", 
          school: "THPT",
          mode: "online",
          totalAttempts: 0, 
          hwMaxScores: {}, 
          testMaxScores: {} 
        }; 
      }
      const st = stats[att.studentId];
      st.totalAttempts++;
      const sc = Number(att.score) || 0;
      if (att.type === "homework" || att.isHomework) {
        st.hwMaxScores[att.quizId] = Math.max(st.hwMaxScores[att.quizId] || 0, sc);
      } else {
        st.testMaxScores[att.quizId] = Math.max(st.testMaxScores[att.quizId] || 0, sc);
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
  }, [allAttempts, rankingScope, selectedChapterId, selectedLessonId, registeredStudents, quizMap, analyticsModeFilter]);

  // PHÂN TÍCH ĐIỂM SỐ LUYỆN ĐỀ THỰC CHIẾN
  const practiceAnalyticsData = useMemo(() => {
    const stats: Record<string, any> = {};

    let filteredAttempts = (allAttempts || []).filter(a => a && (a.type === "practice" || !a.isHomework));
    if (practiceCategoryFilter !== "Tất cả danh mục") {
      filteredAttempts = filteredAttempts.filter(a => {
        const exMeta = practiceExams.find(e => e.id === a.quizId);
        return (a?.category === practiceCategoryFilter) || (exMeta?.category === practiceCategoryFilter);
      });
    }

    filteredAttempts.forEach(att => {
      if (!att?.studentId) return;
      if (!stats[att.studentId]) { 
        stats[att.studentId] = { 
          id: att.studentId, 
          name: att.studentName || "Học sinh", 
          totalAttempts: 0, 
          maxScoresPerQuiz: {},
          attemptsList: []
        }; 
      }
      const st = stats[att.studentId];
      st.totalAttempts++;
      st.attemptsList.push(att);
      st.maxScoresPerQuiz[att.quizId] = Math.max(st.maxScoresPerQuiz[att.quizId] || 0, Number(att.score) || 0);
    });

    return Object.values(stats).map((st: any) => {
      const maxScores = Object.values(st.maxScoresPerQuiz) as number[];
      const overallAvg = maxScores.length > 0 ? (maxScores.reduce((a, b) => a + b, 0) / maxScores.length) : 0;
      return { ...st, overallAvg, completedExams: maxScores.length };
    }).sort((a: any, b: any) => Number(b.overallAvg || 0) - Number(a.overallAvg || 0));
  }, [allAttempts, practiceCategoryFilter, practiceExams]);

  const offlineLessonCount = useMemo(() => {
    return (chapters || [])
      .reduce((acc, chap) => {
        if (chap?.target_mode === "online") return acc;
        return acc + (chap?.lessons || []).filter((l: any) => l?.target_mode !== "online").length;
      }, 0);
  }, [chapters]);

  const onlineLessonCount = useMemo(() => {
    return (chapters || [])
      .reduce((acc, chap) => {
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

  const getVietnameseLastName = (fullName: string): string => {
    if (!fullName) return "";
    const parts = fullName.trim().split(/\s+/);
    return parts[parts.length - 1] || "";
  };

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
        const lastA = getVietnameseLastName(a.full_name);
        const lastB = getVietnameseLastName(b.full_name);
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
      <AnimatePresence>
        {successToast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-5 right-5 z-[500] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" /> {successToast}
          </motion.div>
        )}
      </AnimatePresence>

      <aside className="w-64 bg-[#1E40AF] border-r border-[#1E40AF] text-white/90 flex flex-col shrink-0 p-5 shadow-[4px_0_24px_rgba(15,23,42,0.05)] h-screen">
        <div className="flex items-center gap-3 mb-6 shrink-0"> 
          <div className="w-10 h-10 bg-white text-[#1E40AF] rounded-[14px] flex items-center justify-center font-black text-sm shadow-md">TCT</div>
          <div className="overflow-hidden">
            <h1 className="font-extrabold text-[15px] text-white tracking-tight leading-none">TÂM CHÍ TÀI</h1>
            <p className="text-[9px] text-blue-200 font-bold tracking-widest mt-1 uppercase">Admin Panel</p>
          </div>
        </div>

        <nav className="space-y-1.5 flex-1 overflow-y-auto no-scrollbar">
          {[
            { key: "lessons", label: "Nội dung bài học", icon: BookOpen },
            { key: "practice", label: "Hệ thống Luyện đề", icon: Target },
            { key: "analytics", label: "Điểm số & Xếp hạng", icon: BarChart2 },
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
                className={"w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[13px] font-bold transition-all duration-200 cursor-pointer " + (
                  isActive 
                    ? "bg-white text-[#1E40AF] shadow-sm font-black" 
                    : "text-blue-100 hover:bg-white/10"
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-rose-600/90 text-blue-100 hover:text-white border border-white/10 hover:border-rose-500/50 transition-all duration-200 font-bold text-xs shadow-xs cursor-pointer group"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform shrink-0" />
            <span>Đăng xuất Admin</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-[64px] bg-white/80 backdrop-blur-2xl border-b border-slate-200/60 flex items-center px-8 shadow-sm shrink-0 justify-between sticky top-0 z-10">
          <h2 className="font-extrabold text-slate-900 tracking-tight text-[15px]">
            {activeTab === "lessons" ? "Quản lý nội dung bài học" : activeTab === "practice" ? "Quản trị Kho Luyện đề" : activeTab === "analytics" ? "Tổng hợp điểm & Xếp hạng" : activeTab === "notifications" ? "Phát Thông Báo Học Sinh" : activeTab === "students" ? "Quản lý Học viên & Duyệt Tài khoản" : activeTab === "reports" ? "Sổ Nhận Xét & Báo Cáo Phụ Huynh" : "Lịch học & Điểm danh Online"}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                loadStorageData();
                fetchSupabaseStudents();
                showToast("Đã đồng bộ dữ liệu mới nhất từ Supabase!");
              }}
              title="Làm mới dữ liệu từ Supabase"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] rounded-xl text-xs font-bold transition cursor-pointer border border-blue-200"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Đồng bộ
            </button>
            <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-semibold text-slate-600">
              <GraduationCap className="w-4 h-4" /> Ban Giám Khảo
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-50/30">
          {activeTab === "lessons" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-sm">
                <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => setLessonModeTab("all")}
                    className={"flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer " + (
                      lessonModeTab === "all"
                        ? "bg-white text-[#1D4ED8] shadow-sm border border-slate-200/60"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Tất cả bài học</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLessonModeTab("offline")}
                    className={"flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer " + (
                      lessonModeTab === "offline"
                        ? "bg-white text-emerald-700 shadow-sm border border-slate-200/60"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>Bài học Offline ({offlineLessonCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLessonModeTab("online")}
                    className={"flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer " + (
                      lessonModeTab === "online"
                        ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                        : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    <Video className="w-4 h-4 text-indigo-600" />
                    <span>Bài học Online ({onlineLessonCount})</span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => setCreateModal({ type: "chapter" })} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl shadow-sm transition cursor-pointer">
                    <FolderPlus className="w-4 h-4 text-[#1D4ED8]" /> Thêm Chương
                  </button>
                  <button onClick={() => {
                    if (!chapters || chapters.length === 0) return alert("Vui lòng thêm Chương trước!");
                    setCreateModal({ type: "lesson", chapterId: chapters[0].id });
                  }} className="flex items-center gap-2 px-5 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold rounded-2xl shadow-sm transition cursor-pointer">
                    <Plus className="w-4 h-4" /> Thêm Bài học mới
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm overflow-hidden w-full">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full min-w-[1100px] text-left border-collapse">
                    <thead className="bg-[#1D4ED8] text-white text-[11px] font-black uppercase tracking-wider">
                      <tr>
                        <th className="py-4 px-4 text-center w-12 border-r border-blue-400/30">STT</th>
                        <th className="py-4 px-5 border-r border-blue-400/30 min-w-[250px]">Nội dung bài học</th>
                        <th className="py-4 px-4 border-r border-blue-400/30 text-center">Chương</th>
                        <th className="py-4 px-3 border-r border-blue-400/30 text-center w-24">Phân luồng</th>
                        <th className="py-4 px-3 border-r border-blue-400/30 text-center w-20">Hình thức</th>
                        <th className="py-4 px-3 border-r border-blue-400/30 text-center w-20">Video</th>
                        <th className="py-4 px-3 border-r border-blue-400/30 text-center w-20">Bài giảng</th>
                        <th className="py-4 px-3 border-r border-blue-400/30 text-center w-20">Viết tay</th>
                        <th className="py-4 px-3 border-r border-blue-400/30 text-center w-20">BTVN</th>
                        <th className="py-4 px-3 border-r border-blue-400/30 text-center w-20">Đề KT</th>
                        <th className="py-4 px-3 border-r border-blue-400/30 text-center w-24">Tăng cường</th>
                        <th className="py-4 px-4 text-center w-24">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/80">
                      {flattenedLessons.map((les: any, idx: number) => {
                        const lesTitle = les?.title || "Bài học";
                        const isReview = lesTitle.toLowerCase().includes("ôn tập") || lesTitle.toLowerCase().includes("bài tập");
                        return (
                          <tr key={les?.id || idx} className="hover:bg-slate-50/50 transition-colors bg-white">
                            <td className="py-4 px-4 text-center text-slate-500 font-bold text-xs border-r border-slate-100">{idx + 1}</td>
                            <td className="py-4 px-5 border-r border-slate-100">
                              {isReview && <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold uppercase rounded border border-amber-200 mb-1">Ôn tập</span>}
                              <h4 className="font-bold text-[#1D4ED8] text-[13px] uppercase leading-snug">{lesTitle}</h4>
                            </td>
                            <td className="py-4 px-4 text-center border-r border-slate-100 text-[11px] text-slate-500 font-semibold uppercase">{les.chapterTitle}</td>
                            <td className="py-4 px-3 text-center border-r border-slate-100">
                              <span className={"inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider " + (
                                les.target_mode === "online"
                                  ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                                  : les.target_mode === "offline"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-blue-100 text-[#1D4ED8] border border-blue-200"
                              )}>
                                {les.target_mode === "online" ? "Online" : les.target_mode === "offline" ? "Offline" : "Cả 2"}
                              </span>
                            </td>
                            <td className="py-4 px-3 text-center border-r border-slate-100 text-xs font-bold text-slate-600">{les.format || "Zoom"}</td>
                            <td className="py-4 px-3 border-r border-slate-100">
                              <MatrixCell items={les.video_list} label="Video" onAdd={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "video_list" })} onView={() => setViewResourcesModal({ lessonId: les.id, type: "video_list", title: "Video", items: les.video_list })} />
                            </td>
                            <td className="py-4 px-3 border-r border-slate-100">
                              <MatrixCell items={les.lecture_files} label="Bài giảng" onAdd={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "lecture_files" })} onView={() => setViewResourcesModal({ lessonId: les.id, type: "lecture_files", title: "Bài giảng", items: les.lecture_files })} />
                            </td>
                            <td className="py-4 px-3 border-r border-slate-100">
                              <MatrixCell items={les.handwritten_notes} label="Viết tay" onAdd={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "handwritten_notes" })} onView={() => setViewResourcesModal({ lessonId: les.id, type: "handwritten_notes", title: "Viết tay", items: les.handwritten_notes })} />
                            </td>
                            <td className="py-4 px-3 border-r border-slate-100">
                              <MatrixCell items={les.homework_files} label="BTVN" onAdd={() => setUploadMethodModal({ lessonId: les.id, type: "homework_files" })} onView={() => setViewResourcesModal({ lessonId: les.id, type: "homework_files", title: "BTVN", items: les.homework_files })} />
                            </td>
                            <td className="py-4 px-3 border-r border-slate-100">
                              <MatrixCell items={les.test_quizzes} label="Đề KT" onAdd={() => setUploadMethodModal({ lessonId: les.id, type: "test_quizzes" })} onView={() => setViewResourcesModal({ lessonId: les.id, type: "test_quizzes", title: "Đề kiểm tra", items: les.test_quizzes })} />
                            </td>
                            <td className="py-4 px-3 border-r border-slate-100">
                              <MatrixCell items={les.extra_resources} label="Tăng cường" onAdd={() => setBoostModal(les.id)} onView={() => setViewResourcesModal({ lessonId: les.id, type: "extra_resources", title: "Tăng cường", items: les.extra_resources })} />
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => { setEditLessonModal({chapterId: les.chapterId, lesson: les}); setEditLessonForm({ title: les.title, description: les.description || "", duration: 45, format: "Zoom", target_mode: les.target_mode || "all" }); }} className="p-1.5 text-slate-400 hover:text-[#1D4ED8] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="Sửa bài học"><Edit3 className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteLesson(les.chapterId, les.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" title="Xóa bài học"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {flattenedLessons.length === 0 && (
                        <tr><td colSpan={12} className="py-12 text-center text-slate-400 font-medium">Chưa có bài học nào. Hãy bấm "Thêm Bài học".</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "practice" && (
            <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
              <div className="flex gap-2.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit">
                <button onClick={() => setPracticeSubTab("manage")} className={"px-5 py-2.5 rounded-[14px] text-[13px] font-bold transition-all duration-300 cursor-pointer " + (practiceSubTab === "manage" ? "bg-[#1D4ED8] text-white shadow-sm" : "text-slate-500 hover:bg-slate-100/50")}>Kho Đề & Tải lên</button>
                <button onClick={() => setPracticeSubTab("scores")} className={"px-5 py-2.5 rounded-[14px] text-[13px] font-bold transition-all duration-300 cursor-pointer " + (practiceSubTab === "scores" ? "bg-[#1D4ED8] text-white shadow-sm" : "text-slate-500 hover:bg-slate-100/50")}>Điểm & Xếp hạng Luyện đề</button>
              </div>

              {practiceSubTab === "manage" && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-5 min-w-[200px]">
                      <div className="w-12 h-12 bg-blue-50 text-[#1D4ED8] rounded-2xl flex items-center justify-center"><Target className="w-6 h-6"/></div>
                      <div>
                        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Tổng số đề</p>
                        <p className="text-2xl font-black text-slate-900">{(practiceExams || []).length}</p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 px-6 py-3.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-[13px] font-bold rounded-2xl shadow-md transition-all cursor-pointer">
                      <UploadCloud className="w-5 h-5" /> + Tải lên Đề thi mới (.docx / .pdf)
                      <input type="file" accept=".docx,.pdf" className="hidden" onChange={(e) => {
                        if (e.target.files?.[0]) { setTestFile(e.target.files[0]); setUploadMode("practice"); setEditingExamData(null); }
                        e.target.value = "";
                      }} />
                    </label>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                      <h3 className="font-extrabold text-slate-900 text-[15px]">Danh sách Kho Đề Thực Chiến</h3>
                      <span className="text-xs text-slate-500 font-bold">* Click vào thẻ Phân Loại để chuyển đổi nhanh giữa các kỳ thi</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead className="bg-white text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                          <tr>
                            <th className="py-4 px-5 font-bold w-1/4">Tiêu đề đề thi</th>
                            <th className="py-4 px-3 font-bold text-center">Phân loại (Loại đề)</th>
                            <th className="py-4 px-3 font-bold text-center">Phân hệ lớp</th>
                            <th className="py-4 px-3 font-bold text-center">Làm lại bài</th>
                            <th className="py-4 px-4 font-bold text-center">Quyền xem file</th>
                            <th className="py-4 px-4 font-bold text-center">Link đề Drive</th>
                            <th className="py-4 px-4 font-bold text-center text-amber-700">Video chữa bài</th>
                            <th className="py-4 px-5 font-bold text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50">
                          {(practiceExams || []).map((ex, exIdx) => (
                            <tr key={ex?.id || exIdx} className="hover:bg-slate-50/50 transition-colors bg-white">
                              <td className="py-4 px-5 font-bold text-slate-800 truncate max-w-[220px]" title={ex?.title}>
                                {ex?.title || "Đề thi"}
                              </td>
                              {/* SỬA LOẠI ĐỀ TRỰC TIẾP */}
                              <td className="py-4 px-3 text-center">
                                <div className="relative inline-block">
                                  <select
                                    value={ex?.category || "Luyện đề"}
                                    onChange={(e) => handleChangeExamCategory(ex.id, e.target.value)}
                                    className="appearance-none px-3 py-1.5 pr-6 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-black text-[11px] uppercase rounded-xl tracking-wider cursor-pointer outline-none transition"
                                  >
                                    {EXAM_CATEGORIES.map(cat => (
                                      <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                  </select>
                                  <ChevronDown className="w-3 h-3 text-indigo-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                              </td>
                              <td className="py-4 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const nextMode = ex.target_mode === "all" ? "online" : ex.target_mode === "online" ? "offline" : "all";
                                    const newExams = practiceExams.map(e => e?.id === ex?.id ? { ...e, target_mode: nextMode } : e);
                                    await savePracticeExams(newExams);
                                    try {
                                      await supabase.from("practice_exams").update({ target_mode: nextMode }).eq("id", ex.id);
                                    } catch {}
                                    showToast("Đã chuyển đề sang: " + (nextMode === "online" ? "Lớp Online" : nextMode === "offline" ? "Lớp Offline" : "Cả hai lớp"));
                                  }}
                                  title="Click để chuyển phân hệ: Online -> Offline -> Cả hai"
                                  className="cursor-pointer"
                                >
                                  <span className={"px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border " + (
                                    ex.target_mode === "online"
                                      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                      : ex.target_mode === "offline"
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                      : "bg-blue-50 text-[#1D4ED8] border-blue-200"
                                  )}>
                                    {ex.target_mode === "online" ? "Online" : ex.target_mode === "offline" ? "Offline" : "Cả 2"}
                                  </span>
                                </button>
                              </td>
                              <td className="py-4 px-3 text-center">
                                <button onClick={async () => {
                                  const newAllow = !(ex?.allowRetake ?? true);
                                  const newExams = practiceExams.map(e => e?.id === ex?.id ? { ...e, allowRetake: newAllow } : e);
                                  await savePracticeExams(newExams);
                                  try {
                                    await supabase.from("practice_exams").update({ allowRetake: newAllow }).eq("id", ex.id);
                                  } catch {}
                                  showToast("Đã thay đổi quyền làm lại.");
                                }} className="cursor-pointer">
                                  {(ex?.allowRetake ?? true) ? <ToggleRight className="w-8 h-8 text-emerald-500 mx-auto" /> : <ToggleLeft className="w-8 h-8 text-slate-300 mx-auto" />}
                                </button>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <button onClick={async () => {
                                  const newAllow = !(ex?.allowViewFile ?? true);
                                  const newExams = practiceExams.map(e => e?.id === ex?.id ? { ...e, allowViewFile: newAllow } : e);
                                  await savePracticeExams(newExams);
                                  try {
                                    await supabase.from("practice_exams").update({ allowViewFile: newAllow }).eq("id", ex.id);
                                  } catch {}
                                  showToast("Đã cập nhật quyền xem file.");
                                }} className="cursor-pointer">
                                  {(ex?.allowViewFile ?? true) ? <ToggleRight className="w-8 h-8 text-[#1D4ED8] mx-auto" /> : <ToggleLeft className="w-8 h-8 text-slate-300 mx-auto" />}
                                </button>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <button onClick={async () => {
                                  const url = prompt("Nhập link Google Drive mới:", ex?.driveUrl || "");
                                  if (url !== null) {
                                    const newExams = practiceExams.map(e => e?.id === ex?.id ? { ...e, driveUrl: url } : e);
                                    await savePracticeExams(newExams);
                                    try {
                                      await supabase.from("practice_exams").update({ driveUrl: url }).eq("id", ex.id);
                                    } catch {}
                                    showToast("Đã cập nhật link Drive.");
                                  }
                                }} className="text-[#1D4ED8] hover:underline flex items-center justify-center gap-1.5 font-semibold text-xs mx-auto cursor-pointer">
                                  <LinkIcon className="w-3.5 h-3.5" /> {ex?.driveUrl ? "Sửa link" : "Thêm link"}
                                </button>
                              </td>
                              <td className="py-4 px-4 text-center">
                                <button
                                  onClick={() => {
                                    setVideoModalExam(ex);
                                    setSolutionVideoInput(ex?.solutionVideoUrl || ex?.videoUrl || "");
                                  }}
                                  className={"px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer " + (
                                    (ex?.solutionVideoUrl || ex?.videoUrl)
                                      ? "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100" 
                                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                  )}
                                >
                                  <Video className="w-3.5 h-3.5 text-amber-600" />
                                  <span>{(ex?.solutionVideoUrl || ex?.videoUrl) ? "Đã có video" : "+ Gắn video"}</span>
                                </button>
                              </td>
                              <td className="py-4 px-5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* XEM BẢNG ĐIỂM AZOTA CỦA RIÊNG ĐỀ NÀY */}
                                  <button
                                    onClick={() => {
                                      const attemptsForExam = (allAttempts || []).filter(a => a.quizId === ex.id);
                                      setAzotaScoreViewModal({
                                        isOpen: true,
                                        examTitle: ex.title,
                                        attempts: attemptsForExam
                                      });
                                    }}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                                    title="Xem bảng điểm học sinh làm đề này kiểu Azota"
                                  >
                                    <BarChart2 className="w-4 h-4" />
                                  </button>

                                  {/* SỬA ĐỀ & ĐÁP ÁN (VÀO LẠI GIAO DIỆN TRÍCH WORD) */}
                                  <button
                                    onClick={() => {
                                      setEditingExamData(ex);
                                      setUploadMode("practice");
                                      setTestFile(new File(["dummy"], ${ex.title}.docx, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
                                    }}
                                    className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-xl transition cursor-pointer"
                                    title="Sửa cấu trúc câu hỏi, lời giải & đáp án"
                                  >
                                    <FileSignature className="w-4 h-4" />
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
                                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                    title="Làm thử để kiểm tra đề & KaTeX"
                                  >
                                    <Play className="w-3 h-3 fill-indigo-600" /> Test
                                  </button>
                                  <button onClick={async () => { 
                                    if (confirm("Xóa đề này khỏi kho?")) {
                                      const updated = practiceExams.filter(e => e?.id !== ex?.id);
                                      await savePracticeExams(updated);
                                      try {
                                        await supabase.from("practice_exams").delete().eq("id", ex.id);
                                      } catch {}
                                    } 
                                  }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer">
                                    <Trash2 className="w-4 h-4"/>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {(!practiceExams || practiceExams.length === 0) && <tr><td colSpan={8} className="py-10 text-center text-slate-400 italic">Kho đề trống. Vui lòng tải lên đề thi mới.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {practiceSubTab === "scores" && (
                <div className="space-y-6">
                  <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2.5"><Filter className="w-4 h-4 text-[#1D4ED8]"/> Bộ lọc danh mục đề thi</h3>
                    <select value={practiceCategoryFilter} onChange={e => setPracticeCategoryFilter(e.target.value)} className="px-5 py-3 text-[13px] font-bold text-[#1D4ED8] bg-blue-50/50 border border-blue-100 rounded-2xl focus:border-blue-500 outline-none transition cursor-pointer">
                      <option value="Tất cả danh mục">Tất cả danh mục</option>
                      {EXAM_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                      <h3 className="font-extrabold text-slate-900 text-[15px]">Bảng Xếp Hạng Điểm Luyện Đề ({practiceCategoryFilter})</h3>
                      <span className="text-xs text-slate-500 font-bold">{practiceAnalyticsData.length} học sinh có bài nộp</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[13px]">
                        <thead className="bg-white text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                          <tr>
                            <th className="py-4 px-6 w-16 font-bold text-center">Top</th>
                            <th className="py-4 px-6 font-bold">Học sinh</th>
                            <th className="py-4 px-6 font-bold text-center">Tổng lượt nộp</th>
                            <th className="py-4 px-6 font-bold text-center">Số đề làm</th>
                            <th className="py-4 px-6 font-bold text-center text-emerald-700">Điểm TB (Max)</th>
                            <th className="py-4 px-6 font-bold text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/50">
                          {practiceAnalyticsData.map((st, i) => (
                            <tr key={st?.id || i} className="hover:bg-slate-50/50 transition-colors bg-white">
                              <td className="py-4 px-6 font-bold text-slate-500 text-center">{i === 0 ? <Medal className="w-5 h-5 text-yellow-500 mx-auto"/> : i === 1 ? <Medal className="w-5 h-5 text-slate-400 mx-auto"/> : i === 2 ? <Medal className="w-5 h-5 text-amber-600 mx-auto"/> : i + 1}</td>
                              <td className="py-4 px-6 font-bold text-slate-800">{st.name}</td>
                              <td className="py-4 px-6 text-center font-medium">{st.totalAttempts}</td>
                              <td className="py-4 px-6 text-center font-bold text-slate-600">{st.completedExams}</td>
                              <td className="py-4 px-6 text-center"><span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-black rounded-xl border border-emerald-100">{Number(st.overallAvg || 0).toFixed(1)}</span></td>
                              <td className="py-4 px-6 text-right">
                                <button
                                  onClick={() => {
                                    setAzotaScoreViewModal({
                                      isOpen: true,
                                      examTitle: "Tất cả bài làm của học sinh: " + st.name,
                                      attempts: st.attemptsList || []
                                    });
                                  }}
                                  className="px-4 py-2 bg-white border border-slate-200 hover:border-[#1D4ED8] hover:text-[#1D4ED8] text-slate-600 font-bold text-[11px] rounded-xl shadow-sm transition flex items-center justify-end gap-1.5 ml-auto cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5"/> Chi tiết Azota
                                </button>
                              </td>
                            </tr>
                          ))}
                          {practiceAnalyticsData.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-slate-400 italic">Chưa có dữ liệu bài làm cho kỳ thi này. Dữ liệu đang được đồng bộ trực tiếp từ Supabase.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto text-left">
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0">
                  <button
                    onClick={() => setAnalyticsModeFilter("all")}
                    className={"px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer " + (
                      analyticsModeFilter === "all" ? "bg-white text-[#1D4ED8] shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Toàn bộ học sinh
                  </button>
                  <button
                    onClick={() => setAnalyticsModeFilter("online")}
                    className={"px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer " + (
                      analyticsModeFilter === "online" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Học sinh Online
                  </button>
                  <button
                    onClick={() => setAnalyticsModeFilter("offline")}
                    className={"px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer " + (
                      analyticsModeFilter === "offline" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    Học sinh Offline
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setRankingScope("course")} className={"px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer " + (rankingScope === "course" ? "bg-white text-[#1D4ED8] shadow-2xs" : "text-slate-500 hover:text-slate-800")}>Toàn khóa</button>
                    <button onClick={() => setRankingScope("chapter")} className={"px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer " + (rankingScope === "chapter" ? "bg-white text-[#1D4ED8] shadow-2xs" : "text-slate-500 hover:text-slate-800")}>Từng chương</button>
                    <button onClick={() => setRankingScope("lesson")} className={"px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer " + (rankingScope === "lesson" ? "bg-white text-[#1D4ED8] shadow-2xs" : "text-slate-500 hover:text-slate-800")}>Từng bài</button>
                  </div>
                  
                  {(rankingScope === "chapter" || rankingScope === "lesson") && (
                    <select value={selectedChapterId} onChange={e => { setSelectedChapterId(e.target.value); setSelectedLessonId("all"); }} className="px-3 py-1.5 text-xs font-bold text-[#1D4ED8] bg-blue-50 border border-blue-200 rounded-xl focus:border-blue-500 outline-none transition cursor-pointer">
                      <option value="all" disabled>-- Chọn Chương --</option>
                      {(chapters || []).map(c => <option key={c?.id} value={c?.id}>{c?.title}</option>)}
                    </select>
                  )}
                  {rankingScope === "lesson" && selectedChapterId !== "all" && (
                    <select value={selectedLessonId} onChange={e => setSelectedLessonId(e.target.value)} className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl focus:border-indigo-500 outline-none transition cursor-pointer">
                      <option value="all" disabled>-- Chọn Bài học --</option>
                      {activeLessons.map((l: any) => <option key={l?.id} value={l?.id}>{l?.title}</option>)}
                    </select>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" /> Bảng điểm & Xếp hạng học viên TCT
                  </h3>
                  <span className="text-xs text-slate-500 font-bold">{analyticsData.length} học viên</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-white text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3 font-bold text-center w-14">Hạng</th>
                        <th className="py-3 px-4 font-bold min-w-[160px]">Học sinh</th>
                        <th className="py-3 px-3 font-bold text-center w-24">Phân hệ</th>
                        <th className="py-3 px-3 font-bold text-center w-24">Lượt làm</th>
                        <th className="py-3 px-3 font-bold text-center w-24">Đ.Max BTVN</th>
                        <th className="py-3 px-3 font-bold text-center w-24">Đ.Max KT</th>
                        <th className="py-3 px-4 font-bold text-center text-[#1D4ED8] w-28">Tổng kết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analyticsData.map((st, idx) => {
                        const rank = idx + 1;
                        const isTop1 = rank === 1;
                        const isTop2 = rank === 2;
                        const isTop3 = rank === 3;

                        return (
                          <tr key={st.id || idx} className="hover:bg-slate-50/60 transition-colors bg-white">
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
                              <div>{st.name}</div>
                              <span className="text-[10px] text-slate-400 font-normal">{st.school || "THPT"}</span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className={"px-2 py-0.5 rounded text-[9px] font-black uppercase " + (
                                st.mode === "online" 
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200" 
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              )}>
                                {st.mode === "online" ? "Online" : "Offline"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center font-medium text-slate-600">{st.totalAttempts} lượt</td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-600">{Number(st.hwAvg || 0).toFixed(1)}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-600">{Number(st.testAvg || 0).toFixed(1)}</td>
                            <td className="py-2.5 px-4 text-center">
                              <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 font-black rounded-lg border border-emerald-200">
                                {Number(st.overallAvg || 0).toFixed(1)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {analyticsData.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-slate-400 italic">Chưa có dữ liệu bài làm cho tùy chọn này.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300">
              <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col h-fit">
                <h3 className="font-extrabold text-slate-900 text-[15px] mb-5 flex items-center gap-2"><Send className="w-4 h-4 text-[#1D4ED8]" /> Soạn thông báo mới</h3>
                <form onSubmit={handleSendNotification} className="space-y-4">
                  <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Tiêu đề thông báo</label><input type="text" value={notifTitle} onChange={e => setNotifTitle(e.target.value)} required placeholder="VD: Lịch học tuần này..." className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] outline-none" /></div>
                  <div><label className="block text-xs font-bold text-slate-700 mb-1.5">Nội dung chi tiết</label><textarea rows={4} value={notifContent} onChange={e => setNotifContent(e.target.value)} required placeholder="Nội dung gửi cho học sinh..." className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] outline-none resize-none custom-scrollbar" /></div>
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
                  {(!sysNotifications || sysNotifications.length === 0) ? <div className="py-10 text-center text-slate-400 text-sm font-medium italic">Chưa có thông báo nào được phát đi.</div> : sysNotifications.map(notif => (
                    <div key={notif.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl relative group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 mb-1.5"><span className={"px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest " + (notif.type === 'urgent' ? 'bg-rose-100 text-rose-700' : notif.type === 'exam' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-[#1D4ED8]')}>{notif.type}</span><span className="text-[10px] text-slate-400 font-medium">{new Date(notif.createdAt).toLocaleString('vi-VN')}</span></div>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white/90 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tổng học viên</span>
                  <span className="text-2xl font-black text-slate-900 mt-1 block">{registeredStudents.length}</span>
                </div>
                <div className="bg-white/90 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider block">Học sinh Online</span>
                  <span className="text-2xl font-black text-[#1D4ED8] mt-1 block">
                    {registeredStudents.filter(s => s.learning_mode === "online" || s.study_mode === "online").length}
                  </span>
                </div>
                <div className="bg-white/90 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 shadow-xs">
                  <span className="text-[11px] font-bold text-purple-500 uppercase tracking-wider block">Học sinh Offline</span>
                  <span className="text-2xl font-black text-purple-700 mt-1 block">
                    {registeredStudents.filter(s => s.learning_mode === "offline" || s.study_mode === "offline").length}
                  </span>
                </div>
                <div className="bg-white/90 backdrop-blur-xl p-5 rounded-3xl border border-amber-200 shadow-xs bg-amber-50/40">
                  <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Chờ xét duyệt</span>
                  <span className="text-2xl font-black text-amber-600 mt-1 block">
                    {registeredStudents.filter(s => s.approval_status === "pending").length}
                  </span>
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-xl p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "all", label: "Tất cả" },
                    { key: "pending", label: "Chờ duyệt" },
                    { key: "approved", label: "Đã duyệt" },
                    { key: "rejected", label: "Bị khóa / Từ chối" }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setStudentFilter(tab.key as any)}
                      className={"px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer " + (
                        studentFilter === tab.key
                          ? "bg-[#1D4ED8] text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    placeholder="Tìm tên, email, trường..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] transition"
                  />
                </div>
              </div>

              <div className="bg-white/90 backdrop-blur-2xl rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#1D4ED8] text-white text-[11px] uppercase tracking-wider font-black">
                      <tr>
                        <th className="py-4 px-4 text-center w-12">STT</th>
                        <th className="py-4 px-5">Họ và tên</th>
                        <th className="py-4 px-5">Liên hệ</th>
                        <th className="py-4 px-4">Trường & Khối</th>
                        <th className="py-4 px-4 text-center">Hình thức</th>
                        <th className="py-4 px-4 text-center">Trạng thái</th>
                        <th className="py-4 px-5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {registeredStudents
                        .filter(s => studentFilter === "all" || s.approval_status === studentFilter)
                        .filter(s => {
                          const q = studentSearch.toLowerCase();
                          return s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.school?.toLowerCase().includes(q);
                        })
                        .map((student, idx) => {
                          const isPending = student.approval_status === "pending";
                          const isApproved = student.approval_status === "approved";
                          return (
                            <tr key={student.id || idx} className="hover:bg-slate-50/60 transition-colors bg-white/70">
                              <td className="py-4 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-4 px-5 font-bold text-slate-800">
                                <div>{student.full_name}</div>
                                <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                                  ĐK: {new Date(student.created_at || Date.now()).toLocaleDateString("vi-VN")}
                                </div>
                              </td>
                              <td className="py-4 px-5">
                                <div className="font-semibold text-slate-700">{student.email}</div>
                                <div className="text-[10px] text-slate-400">{student.phone || "--"}</div>
                              </td>
                              <td className="py-4 px-4">
                                <div className="font-medium text-slate-800">{student.school}</div>
                                <div className="text-[10px] text-blue-600 font-bold">{student.grade}</div>
                              </td>
                              <td className="py-4 px-4 text-center">
                                {student.learning_mode === "online" || student.study_mode === "online" ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-[#1D4ED8] font-bold text-[10px] uppercase rounded-lg border border-blue-100">
                                    <Globe className="w-3 h-3" /> Online
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 font-bold text-[10px] uppercase rounded-lg border border-purple-100">
                                    <Users className="w-3 h-3" /> Offline
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-4 text-center">
                                {isPending ? (
                                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-extrabold text-[10px] uppercase rounded-lg border border-amber-200 animate-pulse">
                                    Chờ duyệt
                                  </span>
                                ) : isApproved ? (
                                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-[10px] uppercase rounded-lg border border-emerald-200">
                                    Đã duyệt
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 bg-rose-50 text-rose-700 font-extrabold text-[10px] uppercase rounded-lg border border-rose-200">
                                    Đã khóa
                                  </span>
                                )}
                              </td>
                              <td className="py-4 px-5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isPending && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateStudentStatus(student.id, "approved")}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                                    >
                                      <Check className="w-3.5 h-3.5" /> Duyệt
                                    </button>
                                  )}
                                  {isApproved && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateStudentStatus(student.id, "rejected")}
                                      className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl text-[11px] font-bold transition cursor-pointer"
                                      title="Khóa quyền vào học"
                                    >
                                      Khóa
                                    </button>
                                  )}
                                  {!isApproved && !isPending && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateStudentStatus(student.id, "approved")}
                                      className="px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-[#1D4ED8] rounded-xl text-[11px] font-bold transition cursor-pointer"
                                      title="Mở khóa lại"
                                    >
                                      Mở lại
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteStudent(student.id)}
                                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                    title="Xóa học sinh vĩnh viễn"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      {registeredStudents.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                            Chưa có học sinh nào đăng ký trên hệ thống.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "online_schedule" && (
            <div className="space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto text-left">
              <div className="bg-white/90 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-100 text-[#1D4ED8]">
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        Link học Online
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Phát link phòng học trực tuyến Zoom / Google Meet & tự do tùy chỉnh khung giờ học
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1D4ED8] text-xs font-bold">
                    Zoom / Google Meet
                  </span>
                </div>

                <form onSubmit={handleCreateOnlineSession} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề buổi học *</label>
                      <input
                        required
                        type="text"
                        value={newSessionForm.title}
                        onChange={e => setNewSessionForm({ ...newSessionForm, title: e.target.value })}
                        placeholder="VD: Chuyên đề 3: Tích phân & Ứng dụng thực tế"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Ngày học (Cột điểm danh) *</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          required
                          value={newSessionForm.isoDate}
                          onChange={e => {
                            const val = e.target.value;
                            const parts = val.split("-");
                            const disp = parts.length === 3 ? parts[2] + "/" + parts[1] : val;
                            setNewSessionForm({ ...newSessionForm, isoDate: val, displayDate: disp });
                          }}
                          className="w-1/2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
                        />
                        <input
                          type="text"
                          required
                          value={newSessionForm.displayDate}
                          onChange={e => setNewSessionForm({ ...newSessionForm, displayDate: e.target.value })}
                          placeholder="24/09"
                          title="Tên cột hiển thị trên bảng điểm danh"
                          className="w-1/2 px-3 py-2.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs font-black text-[#1D4ED8] outline-none focus:border-[#1D4ED8] focus:bg-white transition text-center"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Khung giờ ca học (Tùy chỉnh tự do) *</label>
                      <div className="space-y-1.5">
                        <select
                          value={newSessionForm.shiftId}
                          onChange={e => {
                            const shId = e.target.value;
                            if (shId === "custom") {
                              setNewSessionForm({ ...newSessionForm, shiftId: "custom", shiftName: "Ca học" });
                            } else {
                              const sh = STANDARD_SHIFTS.find(s => s.id === shId);
                              if (sh) {
                                setNewSessionForm({ ...newSessionForm, shiftId: shId, shiftName: sh.name, timeSlot: sh.timeSlot });
                              }
                            }
                          }}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition cursor-pointer"
                        >
                          <option value="custom">-- Tự nhập giờ tùy ý (Ví dụ: 21:30 - 23:00) --</option>
                          {STANDARD_SHIFTS.map(sh => (
                            <option key={sh.id} value={sh.id}>{sh.name} ({sh.timeSlot})</option>
                          ))}
                        </select>
                        <input
                          required
                          type="text"
                          value={newSessionForm.timeSlot}
                          onChange={e => setNewSessionForm({ ...newSessionForm, timeSlot: e.target.value })}
                          placeholder="21:30 - 23:00"
                          className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-black text-[#1D4ED8] outline-none focus:border-[#1D4ED8] transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Đối tượng nhận link *</label>
                      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                        <button
                          type="button"
                          onClick={() => setNewSessionForm({ ...newSessionForm, audience: "online" })}
                          className={"py-1.5 rounded-lg text-[11px] font-black transition " + (
                            newSessionForm.audience === "online"
                              ? "bg-white text-indigo-700 shadow-sm"
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          Lớp Online
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewSessionForm({ ...newSessionForm, audience: "offline" })}
                          className={"py-1.5 rounded-lg text-[11px] font-black transition " + (
                            newSessionForm.audience === "offline"
                              ? "bg-white text-emerald-700 shadow-sm"
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          Lớp Offline
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewSessionForm({ ...newSessionForm, audience: "all" })}
                          className={"py-1.5 rounded-lg text-[11px] font-black transition " + (
                            newSessionForm.audience === "all"
                              ? "bg-white text-[#1D4ED8] shadow-sm"
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          Cả hai
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Link phòng học (Zoom/Meet URL) *</label>
                      <input
                        required
                        type="url"
                        value={newSessionForm.meetingUrl}
                        onChange={e => setNewSessionForm({ ...newSessionForm, meetingUrl: e.target.value })}
                        placeholder="https://zoom.us/j/... hoặc https://meet.google.com/..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Danh sách Link Ảnh Hướng dẫn vào lớp (Mỗi link 1 dòng)
                    </label>
                    <textarea
                      rows={2}
                      value={newSessionForm.guideImagesText}
                      onChange={e => setNewSessionForm({ ...newSessionForm, guideImagesText: e.target.value })}
                      placeholder="https://example.com/huong-dan-zoom-1.png&#10;https://example.com/huong-dan-zoom-2.png"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition resize-none"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" /> Phát Link Buổi Học
                    </button>
                  </div>
                </form>
              </div>

              {onlineSessions.length > 0 && (
                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      <span>Danh sách các ca học đã phát ({onlineSessions.length} ca)</span>
                    </h4>
                    <span className="text-[11px] text-slate-400 font-semibold">
                      * Nhấn vào biểu tượng thùng rác để xóa ca học nếu phát nhầm
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {onlineSessions.map((sess: any) => {
                      const tMode = (sess.target_mode || sess.audience || "all").toLowerCase();
                      const isAll = tMode === "all";
                      const isOnline = tMode === "online";

                      return (
                        <div key={sess.id} className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col justify-between gap-3 group">
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className="text-xs font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                                {sess.date || "Ca học"}
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className={"px-2 py-0.5 rounded text-[9px] font-black uppercase " + (
                                  isAll 
                                    ? "bg-blue-100 text-[#1D4ED8] border border-blue-200" 
                                    : isOnline 
                                    ? "bg-indigo-100 text-indigo-700 border border-indigo-200" 
                                    : "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                )}>
                                  {isAll ? "Cả 2" : isOnline ? "Online" : "Offline"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSession(sess.id, sess.title)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Xóa ca học này khỏi hệ thống"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            <h5 className="font-bold text-xs text-slate-800 line-clamp-1 leading-snug">
                              {sess.title}
                            </h5>
                            <p className="text-[11px] text-slate-500 font-semibold mt-1 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" /> {sess.timeSlot}
                            </p>
                          </div>

                          {sess.meetingUrl && (
                            <a 
                              href={sess.meetingUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-[10px] text-blue-600 font-bold hover:underline truncate block"
                            >
                              🔗 {sess.meetingUrl}
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                <div className="p-5 bg-gradient-to-r from-slate-50 to-blue-50/40 border-b border-slate-200 flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                          BẢNG ĐIỂM DANH TRỰC TUYẾN (GOOGLE SHEETS SPREADSHEET GRID)
                        </h3>
                        <button
                          type="button"
                          onClick={() => setIsAddDateModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-sm transition-all cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5" /> + Thêm ngày học
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddStudentModalOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-sm transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Thêm học sinh
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        • Tự động tích dấu <strong className="text-emerald-600 font-bold">✓</strong> khi học sinh bấm 'Vào học ngay' • Click ô để điểm danh Có mặt / Vắng • Buổi Online chỉ tính chuyên cần cho học sinh Online.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-bold text-slate-600 shrink-0">
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-emerald-500 rounded-xs" /> = Có mặt</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-slate-300 rounded-xs" /> = Vắng</span>
                      <span className="flex items-center gap-1"><span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded border" /> = Miễn</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/70">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={attendanceSearchText}
                          onChange={e => setAttendanceSearchText(e.target.value)}
                          placeholder="Tìm nhanh theo tên học sinh..."
                          className="pl-8 pr-4 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#1D4ED8] w-56 transition"
                        />
                      </div>

                      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setAttendanceFilterMode("all")}
                          className={"px-3 py-1 rounded-lg text-xs font-bold transition " + (
                            attendanceFilterMode === "all" ? "bg-white text-[#1D4ED8] shadow-xs" : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          Tất cả ({registeredStudents.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttendanceFilterMode("online")}
                          className={"px-3 py-1 rounded-lg text-xs font-bold transition " + (
                            attendanceFilterMode === "online" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          Lớp Online ({registeredStudents.filter(s => s.learning_mode === "online" || s.study_mode === "online").length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttendanceFilterMode("offline")}
                          className={"px-3 py-1 rounded-lg text-xs font-bold transition " + (
                            attendanceFilterMode === "offline" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          Lớp Offline ({registeredStudents.filter(s => s.learning_mode === "offline" || s.study_mode === "offline").length})
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAttendanceSortAZ(prev => !prev)}
                      className={"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition cursor-pointer " + (
                        attendanceSortAZ
                          ? "bg-blue-50 border-blue-400 text-[#1D4ED8] shadow-2xs"
                          : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span>Sắp xếp: {attendanceSortAZ ? "Tên (A → Z) ✓" : "Mặc định"}</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[550px] custom-scrollbar">
                  <table className="w-full text-center text-xs border-collapse select-none">
                    <thead>
                      <tr className="bg-slate-100/90 text-slate-700 font-black text-[11px] uppercase tracking-wider sticky top-0 z-20 border-b border-slate-300">
                        <th className="py-3.5 px-3 border-r border-slate-300 bg-slate-200/80 w-24">Trạng thái</th>
                        <th className="py-3.5 px-2 border-r border-slate-300 bg-slate-200/80 w-12">STT</th>
                        <th className="py-3.5 px-4 border-r border-slate-300 bg-slate-200/80 text-left min-w-[140px]">Họ đệm</th>
                        <th className="py-3.5 px-3 border-r border-slate-300 bg-slate-200/80 text-left min-w-[90px]">Tên</th>
                        <th className="py-3.5 px-2 border-r border-slate-300 bg-slate-200/80 text-center w-20">Lớp</th>

                        {sessionDates.map(dateCol => {
                          const sessMeta = onlineSessions.find(s => s.date === dateCol);
                          const aud = sessMeta?.audience || "all";
                          return (
                            <th key={dateCol} className="py-2.5 px-2 border-r border-slate-300 bg-blue-100/70 text-[#1D4ED8] min-w-[75px] relative group">
                              <div className="flex items-center justify-between gap-1 px-1">
                                <span className="font-black text-xs">{dateCol}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAttendanceDate(dateCol);
                                  }}
                                  title={"Xóa cột ngày " + dateCol}
                                  className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 transition p-0.5 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <span className={"inline-block px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase " + (
                                aud === "online" ? "bg-indigo-200 text-indigo-800" : aud === "offline" ? "bg-emerald-200 text-emerald-800" : "bg-blue-200 text-blue-900"
                              )}>
                                {aud === "online" ? "On" : aud === "offline" ? "Off" : "Full"}
                              </span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {sortedAndFilteredStudents.map((stu, sIdx) => {
                        const nameParts = (stu.full_name || "").trim().split(" ");
                        const firstName = nameParts.pop() || "";
                        const lastName = nameParts.join(" ");

                        return (
                          <tr key={stu.id || sIdx} className="hover:bg-blue-50/30 transition-colors bg-white">
                            <td className="py-2.5 px-3 border-r border-slate-200 font-bold">
                              <span className={"inline-block px-2 py-1 rounded-md text-[10px] uppercase font-black tracking-wider " + (
                                stu.approval_status === "approved" 
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                                  : "bg-rose-100 text-rose-800 border border-rose-200"
                              )}>
                                {stu.approval_status === "approved" ? "Học" : "Nghỉ"}
                              </span>
                            </td>

                            <td className="py-2.5 px-2 border-r border-slate-200 text-slate-400 font-bold">
                              {sIdx + 1}
                            </td>

                            <td className="py-2.5 px-4 border-r border-slate-200 text-left font-semibold text-slate-800">
                              {lastName}
                            </td>

                            <td className="py-2.5 px-3 border-r border-slate-200 text-left font-extrabold text-[#1D4ED8]">
                              {firstName}
                            </td>

                            <td className="py-2.5 px-2 border-r border-slate-200 text-center">
                              <span className={"px-1.5 py-0.5 rounded text-[9px] font-black uppercase " + (
                                stu.learning_mode === "online" || stu.study_mode === "online" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              )}>
                                {stu.learning_mode === "online" || stu.study_mode === "online" ? "Online" : "Offline"}
                              </span>
                            </td>

                            {sessionDates.map(dateCol => {
                              const sessMeta = onlineSessions.find(s => s.date === dateCol);
                              const aud = sessMeta?.audience || "all";
                              const isOnlineStu = stu.learning_mode === "online" || stu.study_mode === "online";
                              
                              const isExempt = (aud === "online" && !isOnlineStu) ||
                                               (aud === "offline" && isOnlineStu);

                              const attRecord = attendanceRecords.find(
                                a => a.studentId === stu.id && a.sessionDate === dateCol && (a.status === "present" || a.status === "auto_present")
                              );
                              const isAttended = Boolean(attRecord);

                              if (isExempt) {
                                return (
                                  <td
                                    key={dateCol}
                                    title={"Miễn điểm danh: Buổi học này chỉ áp dụng cho lớp " + (aud === "online" ? "Online" : "Offline")}
                                    className="py-2.5 px-2 border-r border-slate-200 bg-slate-50/40 text-slate-300 font-medium text-[11px] italic"
                                  >
                                    Miễn
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={dateCol}
                                  onClick={() => handleToggleAttendance(stu.id, stu.full_name, dateCol)}
                                  title={"Click để bật/tắt điểm danh " + stu.full_name + " (" + dateCol + ")"}
                                  className={"py-2.5 px-2 border-r border-slate-200 font-black text-sm cursor-pointer transition-colors " + (
                                    isAttended
                                      ? "bg-emerald-50/80 text-emerald-600 hover:bg-emerald-100"
                                      : "text-slate-300 hover:bg-slate-100/70"
                                  )}
                                >
                                  {isAttended ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 shadow-2xs">
                                      ✓
                                    </span>
                                  ) : (
                                    <span>-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      {sortedAndFilteredStudents.length === 0 && (
                        <tr>
                          <td colSpan={sessionDates.length + 5} className="py-10 text-center text-slate-400 italic">
                            Không tìm thấy học sinh nào phù hợp với điều kiện lọc.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2">
                <ScheduleView profile={null} mode="all" isAdmin={true} />
              </div>
            </div>
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

      {/* MODAL XEM CHI TIẾT ĐIỂM KIỂU AZOTA */}
      <AnimatePresence>
        {azotaScoreViewModal.isOpen && (
          <div className="fixed inset-0 z-[800] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
                <div>
                  <span className="px-3 py-1 bg-blue-100 text-[#1D4ED8] rounded-full text-xs font-black uppercase tracking-wider">
                    Giao diện Chấm thi & Quản lý Điểm Azota
                  </span>
                  <h3 className="font-black text-slate-900 text-lg mt-1.5 flex items-center gap-2">
                    {azotaScoreViewModal.examTitle}
                  </h3>
                </div>
                <button
                  onClick={() => setAzotaScoreViewModal({ isOpen: false, examTitle: "", attempts: [] })}
                  className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/40">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-500">
                    Danh sách lượt nộp bài ({azotaScoreViewModal.attempts.length} lượt)
                  </span>
                  <span className="text-[11px] text-slate-400 italic">
                    * Click vào biểu tượng cây bút để sửa nhận xét học sinh
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {azotaScoreViewModal.attempts.map((att: any, idx: number) => {
                    const fullName = att.studentName || att.full_name || "Học sinh";
                    const words = fullName.trim().split(/\s+/);
                    const initials = words.length > 1 
                      ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
                      : fullName.slice(0, 2).toUpperCase();

                    const scoreNum = Number(att.score ?? 0);
                    const isPassed = scoreNum >= 5;

                    return (
                      <div
                        key={att.id || idx}
                        className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:shadow-md transition flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-black text-sm shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-extrabold text-slate-900 text-[14px] truncate leading-tight">
                                {fullName}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={"text-xs font-black " + (isPassed ? "text-emerald-700" : "text-rose-600")}>
                                  Điểm: {scoreNum.toFixed(2)}
                                </span>
                                <span className="text-[11px] text-slate-400 font-semibold">
                                  (Lần thi: {att.attemptNumber || 1})
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5 text-xs text-slate-500 pt-2 border-t border-slate-100">
                            <div className="flex justify-between items-center">
                              <span>Thời gian làm bài:</span>
                              <span className="font-bold text-slate-700">{att.timeSpent || "15 phút"}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Thời gian nộp bài:</span>
                              <span className="font-bold text-slate-700">
                                {new Date(att.createdAt || Date.now()).toLocaleDateString("vi-VN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric"
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-500 italic truncate max-w-[170px]">
                            {att.feedback ? ("“" + att.feedback + "”") : "Chưa có nhận xét"}
                          </span>
                          <button
                            onClick={async () => {
                              const newCmt = prompt("Nhập nhận xét / lời khen cho học sinh:", att.feedback || "");
                              if (newCmt !== null) {
                                att.feedback = newCmt;
                                try {
                                  await supabase.from("exam_attempts").update({ feedback: newCmt }).eq("id", att.id);
                                } catch {}
                                showToast("Đã lưu nhận xét học sinh!");
                              }
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Thêm/sửa nhận xét"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {azotaScoreViewModal.attempts.length === 0 && (
                    <div className="col-span-full py-16 text-center text-slate-400 font-medium">
                      Chưa có lượt nộp bài nào của học sinh cho đề thi này.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAddStudentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#1D4ED8]" />
                  Thêm Học Sinh Vào Bảng Điểm Danh
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddQuickStudentSubmit} className="space-y-4 text-left">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Họ đệm</label>
                    <input
                      type="text"
                      value={quickStudentForm.lastName}
                      onChange={e => setQuickStudentForm({ ...quickStudentForm, lastName: e.target.value })}
                      placeholder="VD: Trương Ngọc"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tên *</label>
                    <input
                      required
                      type="text"
                      value={quickStudentForm.firstName}
                      onChange={e => setQuickStudentForm({ ...quickStudentForm, firstName: e.target.value })}
                      placeholder="VD: Dũng"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-blue-700 outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái tham gia</label>
                  <select
                    value={quickStudentForm.status}
                    onChange={e => setQuickStudentForm({ ...quickStudentForm, status: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="approved">Học (Đang theo học)</option>
                    <option value="rejected">Nghỉ (Đã tạm nghỉ)</option>
                  </select>
                </div>

                <div className="p-3 bg-blue-50/60 rounded-xl text-[11px] text-blue-700">
                  Học sinh được thêm sẽ lưu trực tiếp vào cơ sở dữ liệu Supabase và xuất hiện ngay lập tức trên Bảng điểm danh.
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddStudentModalOpen(false)}
                    className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    Thêm ngay
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {viewResourcesModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2">
                Danh sách {viewResourcesModal.title} ({(viewResourcesModal.items || []).length})
              </h3>
              <button onClick={() => setViewResourcesModal(null)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
              {(!viewResourcesModal.items || viewResourcesModal.items.length === 0) ? (
                <p className="text-center text-slate-400 text-sm py-4">Chưa có tài nguyên nào.</p>
              ) : (
                viewResourcesModal.items.map((item: any) => (
                  <div key={item.id} className="flex flex-col gap-2 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-[#1D4ED8]/50 transition-colors group">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-slate-800 text-[13px] truncate">{item.title}</h4>
                          {viewResourcesModal.type === "video_list" && (
                            <span className={"px-2 py-0.5 text-[9px] font-black uppercase rounded-md tracking-wider " + (
                              item.type === "homework_solution"
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-blue-100 text-blue-800 border border-blue-300"
                            )}>
                              {item.type === "homework_solution" ? "Chữa BTVN" : "Bài Giảng"}
                            </span>
                          )}
                          {item.is_drive_file && <span className="px-2 py-0.5 text-[9px] bg-indigo-100 text-indigo-700 font-bold uppercase rounded-md shrink-0">Drive</span>}
                          {viewResourcesModal.type === 'extra_resources' && <span className="px-2 py-0.5 text-[9px] bg-amber-100 text-amber-700 font-bold uppercase rounded-md shrink-0">Tăng cường</span>}
                        </div>
                        {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:underline truncate block mt-1">{item.url}</a>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => {
                          setEditResourceModal({ lessonId: viewResourcesModal.lessonId, type: viewResourcesModal.type, item });
                          setEditResourceForm({ title: item.title, url: item.url || "", type: item.type || "lecture" });
                        }} className="p-2 text-slate-300 hover:text-[#1D4ED8] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer shrink-0">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteResource(viewResourcesModal.lessonId, viewResourcesModal.type, item.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <button 
                onClick={() => {
                  setViewResourcesModal(null);
                  if (viewResourcesModal.type === 'homework_files' || viewResourcesModal.type === 'test_quizzes') {
                    setUploadMethodModal({ lessonId: viewResourcesModal.lessonId, type: viewResourcesModal.type as any });
                  } else if (viewResourcesModal.type === 'extra_resources') {
                    setBoostModal(viewResourcesModal.lessonId);
                  } else {
                    setResourceModal({ isOpen: true, lessonId: viewResourcesModal.lessonId, lessonTitle: "bài học", type: viewResourcesModal.type });
                  }
                }}
                className="w-full py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-[13px] font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Thêm tài liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {editResourceModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleEditResourceSubmit} className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2"><Edit3 className="w-5 h-5 text-[#1D4ED8]" /> Sửa thông tin tài liệu</h3>
              <button type="button" onClick={() => setEditResourceModal(null)} className="text-slate-400 hover:text-rose-500"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tiêu đề tài liệu</label>
                <input required type="text" value={editResourceForm.title} onChange={e => setEditResourceForm({...editResourceForm, title: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none" />
              </div>
              
              {editResourceModal.type === "video_list" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Phân loại Video *</label>
                  <select
                    value={editResourceForm.type}
                    onChange={e => setEditResourceForm({ ...editResourceForm, type: e.target.value as any })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#1D4ED8] bg-white cursor-pointer"
                  >
                    <option value="lecture">Video Bài Giảng (Lý thuyết)</option>
                    <option value="homework_solution">Video Chữa BTVN (Chi tiết)</option>
                  </select>
                </div>
              )}

              {(!editResourceModal.item.is_quiz || editResourceModal.item.is_drive_file) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Đường dẫn (URL / Link Drive / YouTube)</label>
                  <input required type="url" value={editResourceForm.url} onChange={e => setEditResourceForm({...editResourceForm, url: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none" />
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end pt-5 mt-5 border-t border-slate-100">
              <button type="button" onClick={() => setEditResourceModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">Hủy</button>
              <button type="submit" className="px-5 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold rounded-xl text-xs shadow-sm">Lưu thay đổi</button>
            </div>
          </form>
        </div>
      )}

      {createModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-xl">
          <form onSubmit={handleCreateNewItem} className="bg-white/90 backdrop-blur-2xl rounded-[32px] w-full max-w-md p-8 shadow-2xl border border-white/50 space-y-5">
            <h3 className="font-extrabold text-slate-900 text-[17px] border-b border-slate-200/60 pb-4 mb-5 tracking-tight">
              {createModal.type === "chapter" ? "Thêm Chương Mới" : "Thêm Bài Học Mới"}
            </h3>
            
            {createModal.type === "lesson" && (
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-2">Chọn chương chứa bài học <span className="text-rose-500">*</span></label>
                <select 
                  value={createModal.chapterId || ""} 
                  onChange={e => setCreateModal({ ...createModal, chapterId: e.target.value })}
                  className="w-full px-5 py-3 border border-slate-300 rounded-2xl text-[13px] font-semibold outline-none focus:border-[#1D4ED8] transition-all shadow-sm bg-white cursor-pointer"
                >
                  {(chapters || []).map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[13px] font-bold text-slate-700 mb-2">Tên {createModal.type === "chapter" ? "chương" : "bài học"} <span className="text-rose-500">*</span></label>
              <input autoFocus required type="text" value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} placeholder={createModal.type === "chapter" ? "VD: Chương 1..." : "VD: Bài 1..."} className="w-full px-5 py-3 border border-slate-300 rounded-2xl text-[13px] font-semibold outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-all shadow-sm" />
            </div>
            
            {createModal.type === "lesson" && (
              <>
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-2">Phân luồng bài học (Target Mode) *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewItemTargetMode("online")}
                      className={"py-2.5 px-3 rounded-xl text-xs font-black border transition " + (
                        newItemTargetMode === "online"
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Lớp Online
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewItemTargetMode("offline")}
                      className={"py-2.5 px-3 rounded-xl text-xs font-black border transition " + (
                        newItemTargetMode === "offline"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Lớp Offline
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewItemTargetMode("all")}
                      className={"py-2.5 px-3 rounded-xl text-xs font-black border transition " + (
                        newItemTargetMode === "all"
                          ? "bg-blue-50 border-blue-500 text-[#1D4ED8] ring-2 ring-blue-500/20 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Cả 2 (Full)
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-2">Hình thức giảng dạy</label>
                  <select value={newItemFormat} onChange={e => setNewItemFormat(e.target.value)} className="w-full px-5 py-3 border border-slate-300 rounded-2xl text-[13px] outline-none focus:border-[#1D4ED8] transition-all shadow-sm bg-white">
                    <option value="Zoom">Zoom / Google Meet</option>
                    <option value="Video">Video quay sẵn</option>
                    <option value="Facebook">Facebook Group</option>
                    <option value="Tự học">Tự học</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-2">Mô tả bài học</label>
                  <textarea rows={3} value={newItemDescription} onChange={e => setNewItemDescription(e.target.value)} placeholder="Nội dung hướng dẫn học..." className="w-full px-5 py-3 border border-slate-300 rounded-2xl text-[13px] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-all shadow-sm resize-none" />
                </div>
              </>
            )}
            <div className="flex gap-3 justify-end pt-4">
              <button type="button" onClick={() => setCreateModal(null)} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-[13px] font-bold text-slate-700 transition-colors cursor-pointer">Hủy</button>
              <button type="submit" className="px-6 py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-2xl text-[13px] font-bold shadow-md transition-colors cursor-pointer">Thêm mới</button>
            </div>
          </form>
        </div>
      )}

      {/* AZOTA EXAM CONFIG MODAL */}
      {testFile && (
        <AzotaExamConfigModal 
          isOpen={true} 
          file={testFile}
          initialData={editingExamData ? {
            title: editingExamData.title,
            category: editingExamData.category,
            duration_minutes: editingExamData.duration_minutes,
            sections: editingExamData.data,
            mediaMap: editingExamData.media_map
          } : undefined}
          mode={uploadMode} 
          onClose={() => { setTestFile(null); setEditingExamData(null); }} 
          onSave={async (examData: any) => {
            if (uploadMode === "practice") {
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

              let updatedExams: any[];
              if (editingExamData) {
                updatedExams = practiceExams.map(ex => ex.id === examId ? newExam : ex);
              } else {
                updatedExams = [newExam, ...(practiceExams || [])];
              }

              await savePracticeExams(updatedExams);

              try {
                const { error } = await supabase.from("practice_exams").upsert(newExam);
                if (error) alert("Lỗi lưu đề thi lên Supabase: " + error.message);
              } catch (err: any) {
                console.warn("Lỗi lưu đề thi lên Supabase:", err);
              }

              if (editingExamData) {
                await handleRecalculateExamScores(examId, examData.sections);
                showToast("Đã cập nhật đề thi và tính lại điểm chuẩn xác cho học sinh!");
              } else {
                showToast("Đã thêm vào kho Luyện đề: " + examData.category);
              }
            } else {
              if (!azotaTarget) return;
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

              await saveToStorage(newChapters); 
              showToast("Đã tải đề thi trắc nghiệm vào bài học!");
            }
            setTestFile(null); 
            setEditingExamData(null);
            setAzotaTarget(null);
          }}
        />
      )}

      {uploadMethodModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[28px] p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  Thêm {uploadMethodModal.type === 'homework_files' ? 'Bài tập về nhà (BTVN)' : 'Đề Kiểm Tra'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Chọn phương thức nạp đề thi để hệ thống tự động bóc tách</p>
              </div>
              <button type="button" onClick={() => setUploadMethodModal(null)} className="text-slate-400 hover:text-rose-500 cursor-pointer p-1"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex flex-col gap-3 mt-4">
              <label className="relative p-4 border-2 border-indigo-200 bg-indigo-50/50 rounded-2xl hover:bg-indigo-100/60 transition cursor-pointer flex items-start gap-4 group shadow-2xs">
                <div className="p-3 bg-white text-indigo-600 rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-indigo-950 text-[14px]">Tải lên file PDF (.pdf)</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-black text-[9px] uppercase tracking-wider">Khuyên Dùng</span>
                  </div>
                  <div className="text-xs text-indigo-800/80 mt-1 leading-relaxed">
                    AI Gemini Vision sẽ quét trang PDF trực tiếp, khôi phục 100% MathType, phân số, căn thức và toạ độ Oxyz mà không bị trượt byte.
                  </div>
                </div>
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setTestFile(e.target.files[0]);
                    setUploadMode("course");
                    setAzotaTarget({ lessonId: uploadMethodModal.lessonId, type: uploadMethodModal.type });
                    setUploadMethodModal(null);
                  }
                  e.target.value = '';
                }}/>
              </label>

              <label className="relative p-4 border border-blue-200 bg-blue-50/40 rounded-2xl hover:bg-blue-100/50 transition cursor-pointer flex items-start gap-4 group shadow-2xs">
                <div className="p-3 bg-white text-blue-600 rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                  <FileUp className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-blue-950 text-[14px]">Tải lên file Word (.docx)</div>
                  <div className="text-xs text-blue-800/80 mt-1 leading-relaxed">
                    Hệ thống sẽ trích xuất nhanh cấu trúc văn bản và thẻ ảnh đồ thị từ file Word gốc.
                  </div>
                </div>
                <input type="file" accept=".docx" className="hidden" onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setTestFile(e.target.files[0]);
                    setUploadMode("course");
                    setAzotaTarget({ lessonId: uploadMethodModal.lessonId, type: uploadMethodModal.type });
                    setUploadMethodModal(null);
                  }
                  e.target.value = '';
                }}/>
              </label>
              
              <button onClick={() => { setDriveLinkModal(uploadMethodModal); setUploadMethodModal(null); }} className="p-4 border border-emerald-200 bg-emerald-50/40 rounded-2xl hover:bg-emerald-100/50 transition cursor-pointer flex items-start gap-4 text-left group shadow-2xs">
                <div className="p-3 bg-white text-emerald-600 rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                  <LinkIcon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-emerald-950 text-[14px]">Đính kèm Link Google Drive</div>
                  <div className="text-xs text-emerald-800/80 mt-1 leading-relaxed">
                    Dán link file PDF/Word để học sinh tải về hoặc tự làm thủ công (không chấm tự động).
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {driveLinkModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <form onSubmit={handleAddDriveFile} className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-emerald-700 text-[15px] flex items-center gap-2"><LinkIcon className="w-5 h-5" /> Đính kèm Link Google Drive</h3>
              <button type="button" onClick={() => setDriveLinkModal(null)} className="text-slate-400 hover:text-rose-500"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tiêu đề (VD: File đề luyện tập 1)</label>
                <input required type="text" value={driveLinkForm.title} onChange={e => setDriveLinkForm({...driveLinkForm, title: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Link Google Drive (Chia sẻ công khai)</label>
                <input required type="url" placeholder="https://drive.google.com/..." value={driveLinkForm.url} onChange={e => setDriveLinkForm({...driveLinkForm, url: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-emerald-500 outline-none" />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-5 mt-5 border-t border-slate-100">
              <button type="button" onClick={() => setDriveLinkModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">Hủy</button>
              <button type="submit" className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-sm">Lưu file Drive</button>
            </div>
          </form>
        </div>
      )}

      {resourceModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-xl">
            <h3 className="font-bold text-[15px] mb-4 text-slate-800 border-b border-slate-100 pb-3">
              Thêm {resourceModal.type === 'video_list' ? 'Video' : 'Tài liệu'} cho {resourceModal.lessonTitle}
            </h3>
            <form onSubmit={handleAddResource} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề hiển thị *</label>
                <input required value={resTitle} onChange={e=>setResTitle(e.target.value)} placeholder={resourceModal.type === 'video_list' ? "VD: Video bài giảng phần 1" : "VD: Tài liệu viết tay"} className="w-full border border-slate-300 p-2.5 rounded-xl focus:border-[#1D4ED8] outline-none text-sm"/>
              </div>

              {resourceModal.type === "video_list" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phân loại Video *</label>
                  <select
                    value={vidType}
                    onChange={e => setVidType(e.target.value as any)}
                    className="w-full border border-slate-300 p-2.5 rounded-xl focus:border-[#1D4ED8] outline-none text-sm font-bold text-slate-800 bg-white cursor-pointer"
                  >
                    <option value="lecture">Video Bài Giảng (Lý thuyết)</option>
                    <option value="homework_solution">Video Chữa BTVN (Chi tiết)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Link (URL YouTube / Google Drive) *</label>
                <input required type="url" value={resUrl} onChange={e=>setResUrl(e.target.value)} placeholder="https://..." className="w-full border border-slate-300 p-2.5 rounded-xl focus:border-[#1D4ED8] outline-none text-sm"/>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={()=>setResourceModal(null)} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-xl text-xs font-bold cursor-pointer">Hủy</button>
                <button type="submit" className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm cursor-pointer">Lưu tài nguyên</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editLessonModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleEditLessonSubmit} className="bg-white rounded-[24px] w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2"><Edit3 className="w-5 h-5 text-[#1D4ED8]" /> Chỉnh sửa bài học</h3>
              <button type="button" onClick={() => setEditLessonModal(null)} className="text-slate-400 hover:text-rose-500"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tiêu đề bài học</label>
                <input required type="text" value={editLessonForm.title} onChange={e => setEditLessonForm({...editLessonForm, title: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Phân luồng bài học (Target Mode) *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditLessonForm({ ...editLessonForm, target_mode: "online" })}
                    className={"py-2 px-3 rounded-xl text-xs font-black border transition " + (
                      editLessonForm.target_mode === "online"
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    Lớp Online
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditLessonForm({ ...editLessonForm, target_mode: "offline" })}
                    className={"py-2 px-3 rounded-xl text-xs font-black border transition " + (
                      editLessonForm.target_mode === "offline"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    Lớp Offline
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditLessonForm({ ...editLessonForm, target_mode: "all" })}
                    className={"py-2 px-3 rounded-xl text-xs font-black border transition " + (
                      editLessonForm.target_mode === "all" || !editLessonForm.target_mode
                        ? "bg-blue-50 border-blue-500 text-[#1D4ED8] ring-2 ring-blue-500/20 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    Cả 2 (Full)
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Thời lượng (phút)</label>
                  <input required type="number" value={editLessonForm.duration} onChange={e => setEditLessonForm({...editLessonForm, duration: parseInt(e.target.value) || 0})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Hình thức</label>
                  <select value={editLessonForm.format} onChange={e => setEditLessonForm({...editLessonForm, format: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none bg-white">
                    <option value="Zoom">Zoom</option>
                    <option value="Facebook">Facebook Group</option>
                    <option value="Video">Video quay sẵn</option>
                    <option value="Tự học">Tự học</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Mô tả</label>
                <textarea rows={2} value={editLessonForm.description} onChange={e => setEditLessonForm({...editLessonForm, description: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-5 mt-5 border-t border-slate-100">
              <button type="button" onClick={() => setEditLessonModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">Hủy</button>
              <button type="submit" className="px-5 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold rounded-xl text-xs shadow-sm">Lưu thay đổi</button>
            </div>
          </form>
        </div>
      )}

      {isAddDateModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleAddNewAttendanceDate} className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#1D4ED8]" /> Thêm ngày học & Cột điểm danh mới
              </h3>
              <button type="button" onClick={() => setIsAddDateModalOpen(false)} className="text-slate-400 hover:text-rose-500"><X className="w-5 h-5"/></button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Chọn ngày học *</label>
              <input 
                type="date" 
                required 
                value={newDateInput} 
                onChange={e => setNewDateInput(e.target.value)} 
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#1D4ED8] outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Khung giờ ca học *</label>
              <div className="space-y-1.5">
                <select 
                  value={newDateShift} 
                  onChange={e => {
                    const shId = e.target.value;
                    setNewDateShift(shId);
                    if (shId !== "custom") {
                      const sh = STANDARD_SHIFTS.find(s => s.id === shId);
                      if (sh) setNewDateTimeSlot(sh.timeSlot);
                    }
                  }} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#1D4ED8] outline-none bg-white cursor-pointer" 
                >
                  <option value="custom">-- Khung giờ tùy chỉnh (Tự do nhập bên dưới) --</option>
                  {STANDARD_SHIFTS.map(sh => (
                    <option key={sh.id} value={sh.id}>{sh.name} ({sh.timeSlot})</option>
                  ))}
                </select>
                <input 
                  type="text" 
                  required 
                  value={newDateTimeSlot} 
                  onChange={e => setNewDateTimeSlot(e.target.value)} 
                  placeholder="VD: 21:30 - 23:00 hoặc 08:15 - 09:45" 
                  className="w-full px-3 py-2 border border-blue-200 rounded-xl text-xs font-black text-[#1D4ED8] outline-none focus:border-[#1D4ED8]" 
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Đối tượng áp dụng *</label>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setNewDateAudience("online")} className={"py-2 text-xs font-bold rounded-xl border " + (newDateAudience === "online" ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-600")}>Lớp Online</button>
                <button type="button" onClick={() => setNewDateAudience("offline")} className={"py-2 text-xs font-bold rounded-xl border " + (newDateAudience === "offline" ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-600")}>Lớp Offline</button>
                <button type="button" onClick={() => setNewDateAudience("all")} className={"py-2 text-xs font-bold rounded-xl border " + (newDateAudience === "all" ? "bg-blue-50 border-blue-500 text-[#1D4ED8]" : "bg-slate-50 border-slate-200 text-slate-600")}>Cả hai</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề buổi học (Tùy chọn)</label>
              <input 
                type="text" 
                value={newDateTitle} 
                onChange={e => setNewDateTitle(e.target.value)} 
                placeholder="VD: Chuyên đề Đại số & Giải tích 12" 
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#1D4ED8] outline-none" 
              />
            </div>
            <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setIsAddDateModalOpen(false)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">Hủy</button>
              <button type="submit" className="px-5 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold rounded-xl text-xs shadow-sm">Tạo cột điểm danh</button>
            </div>
          </form>
        </div>
      )}

      {boostModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleAddBoost} className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-amber-600 text-[15px] flex items-center gap-2"><Zap className="w-5 h-5 fill-amber-500" /> Thêm tài liệu tăng cường</h3>
              <button type="button" onClick={() => setBoostModal(null)} className="text-slate-400 hover:text-rose-500"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tiêu đề</label>
                <input required type="text" value={boostForm.title} onChange={e => setBoostForm({...boostForm, title: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-amber-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Loại tài liệu</label>
                <select value={boostForm.type} onChange={e => setBoostForm({...boostForm, type: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-amber-500 outline-none bg-white">
                  <option value="video">Video bài giảng (YouTube/Drive)</option>
                  <option value="document">Tài liệu / File đề PDF (Drive)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Link / URL truy cập</label>
                <input required type="url" placeholder="https://..." value={boostForm.url} onChange={e => setBoostForm({...boostForm, url: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-amber-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Ghi chú (Tùy chọn)</label>
                <textarea rows={2} value={boostForm.note} onChange={e => setBoostForm({...boostForm, note: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-amber-500 outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-5 mt-5 border-t border-slate-100">
              <button type="button" onClick={() => setBoostModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">Hủy</button>
              <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs shadow-sm">Lưu tăng cường</button>
            </div>
          </form>
        </div>
      )}

      {videoModalExam && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleSaveSolutionVideo} className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2">
                <Video className="w-5 h-5 text-amber-500" /> Gắn Video chữa bài
              </h3>
              <button type="button" onClick={() => setVideoModalExam(null)} className="text-slate-400 hover:text-rose-500">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-[#1D4ED8] mb-2">{videoModalExam.title}</p>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Link Video YouTube hoặc Google Drive
                </label>
                <input
                  required
                  type="url"
                  placeholder="https://youtu.be/... hoặc https://drive.google.com/..."
                  value={solutionVideoInput}
                  onChange={e => setSolutionVideoInput(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-amber-500 outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  * Học sinh sẽ xem được video hướng dẫn giải chi tiết này trong mục Luyện đề.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-5 mt-5 border-t border-slate-100">
              <button type="button" onClick={() => setVideoModalExam(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">
                Hủy
              </button>
              <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs shadow-sm">
                Lưu video
              </button>
            </div>
          </form>
        </div>
      )}

      {testExamRoom && (
        <div className="fixed inset-0 z-[700] bg-white">
          <div className="h-10 bg-indigo-900 text-white flex items-center justify-between px-6 text-xs font-bold">
            <span>CHẾ ĐỘ TEST ĐỀ DÀNH CHO GIÁO VIÊN / ADMIN (Không ghi nhận điểm vào bảng xếp hạng chung)</span>
            <button 
              onClick={() => setTestExamRoom(null)} 
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white cursor-pointer"
            >
              Thoát Test ✕
            </button>
          </div>
          <div className="h-[calc(100vh-40px)]">
            <ExamRoomView
              quizId={testExamRoom.id}
              quizTitle={testExamRoom.title}
              durationMinutes={testExamRoom.duration}
              profile={{ id: "admin-test", full_name: "Giáo viên (Test)", role: "admin", school: "Admin", grade: "12" }}
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
