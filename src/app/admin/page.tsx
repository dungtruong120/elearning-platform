"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
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

      if (!error && data) {
        setRegisteredStudents(data);
        if (typeof window !== "undefined") {
          localStorage.setItem("edunexus_registered_students", JSON.stringify(data));
        }
      }
    } catch (err) {}
  }, []);

  // KHÔI PHỤC ĐẦY ĐỦ ĐIỂM SỐ CỦA HỌC SINH (MERGE 2 CHIỀU)
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

    const combined = [...localSaved, ...serverList];
    const map = new Map();

    combined.forEach((item: any) => {
      if (!item) return;
      const quizId = item.quizId || item.exam_id || item.quiz_id || item.test_id || "";
      const studentId = item.studentId || item.user_id || item.student_id || item.username || "";
      const studentName = item.studentName || item.student_name || item.user_name || item.full_name || item.username || "Học sinh";
      const examTitle = item.examTitle || item.quizTitle || item.title || "";
      const score = Number(item.score ?? item.points ?? 0);
      const createdAt = item.createdAt || item.created_at || new Date().toISOString();

      const normalized = {
        ...item,
        id: item.id || (String(quizId) + "_" + String(studentId) + "_" + String(createdAt)),
        quizId,
        studentId,
        studentName,
        examTitle,
        score,
        type: item.type || (item.isHomework ? "homework" : "practice"),
        timeSpent: item.timeSpent || item.duration_seconds || item.duration || "15 phút",
        createdAt,
        attemptNumber: item.attemptNumber || item.attempt_count || 1,
        feedback: item.feedback || item.comment || ""
      };

      const key = item.id || (String(quizId) + "_" + String(studentId) + "_" + String(createdAt));
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
      
      localExams.forEach((ex: any) => { if (ex?.id) examMap.set(ex.id, ex); });
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
      setViewResourcesModal((prev: any) => prev ? { ...prev, items: (prev.items || []).filter((i: any) => i?.id !== resId) } : null);
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

  const examsWithScoresData = useMemo(() => {
    let list = [...practiceExams];
    if (practiceCategoryFilter !== "Tất cả danh mục") {
      list = list.filter(ex => ex?.category === practiceCategoryFilter);
    }

    return list.map(ex => {
      const cleanExTitle = String(ex?.title || "").trim().toLowerCase();

      const attempts = (allAttempts || []).filter(a => {
        if (!a) return false;
        const matchId = (a.quizId === ex.id) || (a.exam_id === ex.id);
        const aTitle = String(a.examTitle || a.quizTitle || a.title || "").trim().toLowerCase();
        const matchTitle = cleanExTitle && aTitle && (aTitle === cleanExTitle || cleanExTitle.includes(aTitle) || aTitle.includes(cleanExTitle));
        return matchId || matchTitle;
      });

      const studentMap = new Map();
      attempts.forEach(att => {
        const key = att.studentId || att.studentName;
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
  }, [practiceExams, practiceCategoryFilter, allAttempts]);

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

  const handleSaveAzotaExam = async (examData: any) => {
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
        await supabase.from("practice_exams").upsert(newExam);
      } catch (err: any) {}

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
      <AnimatePresence>
        {successToast && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-5 right-5 z-[500] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" /> {successToast}
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
            await Promise.all([loadStorageData(), fetchSupabaseStudents()]);
            showToast("Đã đồng bộ toàn bộ dữ liệu tức thì!");
          }}
        />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-50/30">
          {activeTab === "lessons" && (
            <LessonsTab
              chapters={chapters}
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
              setTestExamRoom={setTestExamRoom}
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
