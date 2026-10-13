"use client";

import React, { useState, useEffect, useCallback, useMemo, useTransition, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckCircle2, AlertCircle, Loader2, RefreshCw, Cloud, Check,
  LayoutDashboard, BookOpen, Users, Award, Trophy, 
  Plus, FileText, Video, PenTool, ClipboardCheck, 
  Trash2, LinkIcon, X, FileUp, FileSignature, FolderPlus, GraduationCap
} from "lucide-react";
import dynamic from "next/dynamic";
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

// DYNAMIC IMPORT AZOTA MODAL
const AzotaExamConfigModal: any = dynamic(
  () => import("./AzotaExamConfigModal").then((mod: any) => mod.AzotaExamConfigModal || mod.default || mod),
  { ssr: false }
);

// HÀM CHUẨN HÓA TIÊU ĐỀ KHÔNG BỊ LỖI FONT TIẾNG VIỆT
function normalizeText(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// BẢO TOÀN NGUYÊN VẸN MEDIAMAP VÀ DATA/SECTIONS
function sanitizeChaptersPayload(chaptersData: any[]): any[] {
  if (!Array.isArray(chaptersData)) return [];
  return chaptersData;
}

// HÀM CHUẨN HÓA PROFILE HỌC VIÊN CHỐNG NULL VÀ CHỐNG NHẢY SAI HÌNH THỨC
function normalizeStudentProfile(raw: any): any {
  if (!raw) return raw;
  const rawMode = String(raw.learning_mode || raw.learningMode || raw.study_mode || raw.studyMode || "online").toLowerCase().trim();
  const isOffline = rawMode === "offline" || rawMode.includes("off");

  return {
    ...raw,
    id: String(raw.id || raw.user_id || `stu-${Date.now()}`),
    full_name: raw.full_name || raw.fullName || raw.name || "Chưa cập nhật",
    email: raw.email || raw.user_email || raw.userEmail || "",
    phone: raw.phone || raw.phone_number || raw.phoneNumber || raw.tel || "",
    school: raw.school || raw.school_name || "THPT",
    grade: raw.grade || raw.class_name || "Lớp 12",
    learning_mode: isOffline ? "offline" : "online",
    study_mode: isOffline ? "offline" : "online",
    approval_status: raw.approval_status || raw.status || (raw.is_approved ? "approved" : "pending"),
    status: raw.status || raw.approval_status || (raw.is_approved ? "approved" : "pending"),
    is_approved: raw.approval_status === "approved" || raw.status === "approved" || Boolean(raw.is_approved),
    created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
  };
}

// HÀM LƯU LOCALSTORAGE AN TOÀN CHỐNG LỖI QUOTA EXCEEDED
function safeSavePracticeExamsToStorage(examsList: any[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("edunexus_practice_exams", JSON.stringify(examsList));
  } catch (e) {
    console.warn("LocalStorage đầy dung lượng, chuyển sang lưu metadata tóm tắt.");
    const lightweightExams = (examsList || []).map((ex: any) => ({
      id: ex?.id,
      title: ex?.title,
      category: ex?.category,
      duration_minutes: ex?.duration_minutes,
      target_mode: ex?.target_mode,
      allowRetake: ex?.allowRetake,
      allowViewFile: ex?.allowViewFile,
      driveUrl: ex?.driveUrl,
      solutionVideoUrl: ex?.solutionVideoUrl,
      created_at: ex?.created_at
    }));
    try {
      localStorage.setItem("edunexus_practice_exams", JSON.stringify(lightweightExams));
    } catch (err) {
      try {
        localStorage.removeItem("edunexus_practice_exams");
        localStorage.setItem("edunexus_practice_exams", JSON.stringify(lightweightExams));
      } catch {}
    }
  }
}

// HÀM NÉN ẢNH CANVAS XUỐNG MAXWIDTH 800PX, QUALITY 0.7 (30-50KB/ẢNH)
async function compressBase64(base64: string): Promise<string> {
  if (!base64 || typeof base64 !== "string" || !base64.startsWith("data:image")) return base64;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      const maxW = 800;
      if (w > maxW) {
        h = Math.round((h * maxW) / w);
        w = maxW;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(base64);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

// HÀM NÉN ĐỒNG BỘ QUA TỪNG ẢNH TRONG MEDIAMAP
async function optimizeExamMediaMap(mediaMap: Record<string, any>): Promise<Record<string, any>> {
  if (!mediaMap || typeof mediaMap !== "object") return {};
  const optimized: Record<string, any> = {};
  for (const [key, val] of Object.entries(mediaMap)) {
    if (typeof val === "string" && val.startsWith("data:image")) {
      optimized[key] = await compressBase64(val);
    } else {
      optimized[key] = val;
    }
  }
  return optimized;
}

// HÀM QUÉT VÀ NÉN MỌI ẢNH BASE64 NHÚNG TRỰC TIẾP TRONG CÂU HỎI / HTML CỦA SECTIONS
async function optimizeExamSectionsDeep(sections: any[]): Promise<any[]> {
  if (!Array.isArray(sections)) return [];
  const cache = new Map<string, string>();

  async function compressStringWithInlineImages(str: string): Promise<string> {
    if (!str || typeof str !== "string" || !str.includes("data:image/")) return str;
    if (str.startsWith("data:image/") && !str.includes(" ") && !str.includes('"') && !str.includes(">")) {
      if (cache.has(str)) return cache.get(str)!;
      const comp = await compressBase64(str);
      cache.set(str, comp);
      return comp;
    }
    const regex = /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/g;
    const matches = str.match(regex);
    if (!matches || matches.length === 0) return str;
    let updated = str;
    for (const m of Array.from(new Set(matches))) {
      let comp = cache.get(m);
      if (!comp) {
        comp = await compressBase64(m);
        cache.set(m, comp);
      }
      updated = updated.split(m).join(comp);
    }
    return updated;
  }

  async function walkNode(node: any): Promise<any> {
    if (!node) return node;
    if (typeof node === "string") {
      return await compressStringWithInlineImages(node);
    }
    if (Array.isArray(node)) {
      const arr = [];
      for (const item of node) {
        arr.push(await walkNode(item));
      }
      return arr;
    }
    if (typeof node === "object") {
      const obj: Record<string, any> = {};
      for (const [k, v] of Object.entries(node)) {
        obj[k] = await walkNode(v);
      }
      return obj;
    }
    return node;
  }

  return await walkNode(sections);
}

function AdminDashboardContent() {
  const [mounted, setMounted] = useState(false);

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

  const [chapters, setChapters] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_course_data");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return INITIAL_CHAPTERS || [];
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
          if (Array.isArray(parsed)) return parsed.map(normalizeStudentProfile);
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

  // TIẾN TRÌNH ĐỒNG BỘ CHO BÀI HỌC
  const [syncStatus, setSyncStatus] = useState<{
    isSyncing: boolean;
    progress: number;
    message: string;
    type: "idle" | "loading" | "success" | "error";
  }>({
    isSyncing: false,
    progress: 0,
    message: "",
    type: "idle",
  });

  // TIẾN TRÌNH ĐỒNG BỘ CHO KHO LUYỆN ĐỀ
  const [practiceSyncStatus, setPracticeSyncStatus] = useState<{
    isSyncing: boolean;
    progress: number;
    message: string;
    type: "idle" | "loading" | "success" | "error";
  }>({
    isSyncing: false,
    progress: 0,
    message: "",
    type: "idle",
  });

  const [isPending, startTransition] = useTransition();

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
    "24/8", "26/8", "07/09", "09/09", "14/09", "16/09", "21/09", "24/09",
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
    audience: "all" as "online" | "offline" | "all",
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
    status: "approved" as "approved" | "rejected",
  });

  const [analyticsModeFilter, setAnalyticsModeFilter] = useState<"all" | "online" | "offline">("all");

  const [azotaScoreViewModal, setAzotaScoreViewModal] = useState<{
    isOpen: boolean;
    examTitle: string;
    attempts: any[];
  }>({
    isOpen: false,
    examTitle: "",
    attempts: [],
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

  const notifyAndSync = useCallback((newChapters: any[], taskName: string = "bài học"): Promise<boolean> => {
    latestChaptersRef.current = newChapters;

    startTransition(() => {
      setChapters(newChapters);
    });

    try {
      localStorage.setItem("edunexus_course_data", JSON.stringify(newChapters));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      console.warn("Lỗi ghi LocalStorage:", e);
    }

    setSyncStatus({
      isSyncing: true,
      progress: 30,
      message: `Đang lưu và nén ${taskName}... [30%]`,
      type: "loading",
    });

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      const sanitized = sanitizeChaptersPayload(latestChaptersRef.current);

      setSyncStatus(prev => ({
        ...prev,
        progress: 75,
        message: `Đang đẩy ${taskName} lên đám mây... [75%]`,
      }));

      try {
        const { data: existingRows, error: checkError } = await supabase.from("courses").select("id").limit(1);
        if (checkError) throw new Error(checkError.message);

        if (existingRows && existingRows.length > 0) {
          const { error: updateError } = await supabase
            .from("courses")
            .update({ chapters: sanitized, updated_at: new Date().toISOString() })
            .eq("id", existingRows[0].id);

          if (updateError) throw new Error(updateError.message);
        } else {
          const { error: insertError } = await supabase
            .from("courses")
            .insert([{ title: "Toán 12 TCT", chapters: sanitized, updated_at: new Date().toISOString() }]);

          if (insertError) throw new Error(insertError.message);
        }

        setSyncStatus({
          isSyncing: true,
          progress: 100,
          message: `✓ Đã lưu thành công! (100%)`,
          type: "success",
        });

        setTimeout(() => {
          setSyncStatus({ isSyncing: false, progress: 0, message: "", type: "idle" });
        }, 1500);

      } catch (err: any) {
        console.error("Lỗi sync Supabase courses:", err);
        setSyncStatus({
          isSyncing: true,
          progress: 100,
          message: "✕ Lỗi kết nối đám mây, đang lưu cục bộ.",
          type: "error",
        });
        showToast("Lỗi đồng bộ Supabase: " + (err?.message || "Mất kết nối mạng"), "error");
      }
    }, 300);

    return Promise.resolve(true);
  }, [showToast]);

  const handleOptimisticUpdateChapters = notifyAndSync;
  const saveToStorage = notifyAndSync;

  const handleRetrySync = () => {
    if (latestChaptersRef.current) {
      notifyAndSync(latestChaptersRef.current, "bài học");
    }
  };

  // HÀM TẢI DANH SÁCH ĐỀ THI TỪ SUPABASE (CÓ BỌC CHỐNG TRÀN QUOTA LOCALSTORAGE)
  const fetchPracticeExams = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("practice_exams")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        setPracticeExams(data);
        safeSavePracticeExamsToStorage(data);
        return data;
      }
    } catch (e) {
      console.warn("Lỗi fetchPracticeExams:", e);
    }
    return null;
  }, []);

  // NẠP DỮ LIỆU TỪ SERVER: BỌC TRY-CATCH QUOTA CHO LOCALSTORAGE ĐỂ KHÔNG BỊ VĂNG LỖI
  const syncAdminGlobalData = useCallback(async () => {
    setIsLoadingAnalytics(true);
    setIsLoadingExams(true);

    try {
      const res = await fetch("/api/admin/data", { cache: "no-store" });
      const apiData = await res.json();

      if (res.ok && apiData.success) {
        const serverProfiles = Array.isArray(apiData.profiles) 
          ? apiData.profiles.map(normalizeStudentProfile) 
          : [];

        setRegisteredStudents(serverProfiles);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("edunexus_registered_students", JSON.stringify(serverProfiles));
          } catch (e) {}
        }

        if (Array.isArray(apiData.practiceExams)) {
          const examsList = apiData.practiceExams;
          setPracticeExams(examsList);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("edunexus_practice_exams", JSON.stringify(examsList));
            } catch (e) {
              console.warn("LocalStorage đầy dung lượng, chuyển sang lưu metadata tóm tắt.");
              const lightweightExams = (examsList || []).map((ex: any) => ({
                id: ex.id,
                title: ex.title,
                category: ex.category,
                duration_minutes: ex.duration_minutes,
                created_at: ex.created_at
              }));
              try {
                localStorage.setItem("edunexus_practice_exams", JSON.stringify(lightweightExams));
              } catch (err) {}
            }
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
            feedback: item.feedback || "",
          };

          map.set(normalized.id, normalized);
        });

        const finalAttempts = Array.from(map.values());
        if (finalAttempts.length > 0) {
          setAllAttempts(finalAttempts);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("edunexus_attempts", JSON.stringify(finalAttempts));
            } catch (e) {}
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
    const newStudent = normalizeStudentProfile({
      id: "stu-" + Date.now(),
      full_name,
      email: "hocsinh_" + Date.now() + "@dungtruong.tct",
      phone: "",
      school: "Chưa cập nhật",
      grade: "Lớp 12",
      role: "student",
      learning_mode: "offline",
      study_mode: "offline",
      approval_status: quickStudentForm.status,
      created_at: new Date().toISOString(),
    });

    try {
      await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register_profile",
          profileData: {
            id: newStudent.id,
            fullName: newStudent.full_name,
            email: newStudent.email,
            phone: newStudent.phone,
            school: newStudent.school,
            grade: newStudent.grade,
            learningMode: newStudent.learning_mode,
          },
        }),
      });
    } catch {}

    const updated = [newStudent, ...registeredStudents];
    setRegisteredStudents(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_registered_students", JSON.stringify(updated));
      } catch (e) {}
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
        supabase.from("system_notifications").select("*").order("created_at", { ascending: false }),
      ]);

      if (courseRes.status === "fulfilled" && courseRes.value.data?.chapters) {
        setChapters(courseRes.value.data.chapters);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("edunexus_course_data", JSON.stringify(courseRes.value.data.chapters));
          } catch (e) {}
        }
      }

      if (sessRes.status === "fulfilled" && sessRes.value.data) {
        setOnlineSessions(sessRes.value.data);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("edunexus_online_sessions", JSON.stringify(sessRes.value.data));
          } catch (e) {}
        }
        const datesFromSessions = Array.from(new Set(sessRes.value.data.map((s: any) => s.date).filter(Boolean)));
        if (datesFromSessions.length > 0) setSessionDates(datesFromSessions as string[]);
      }

      if (notifRes.status === "fulfilled" && notifRes.value.data) {
        setSysNotifications(notifRes.value.data);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("edunexus_system_notifications", JSON.stringify(notifRes.value.data));
          } catch (e) {}
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
    safeSavePracticeExamsToStorage(newExams);
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
      isHomework: false,
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
        lessons: [], 
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
          extra_resources: [],
        }],
      } : chap);
    }

    notifyAndSync(newChapters, createModal.type === "chapter" ? "chương" : "bài học");
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
      ...chap, lessons: (chap?.lessons || []).map((les: any) => les?.id === editLessonModal.lesson.id ? { ...les, ...editLessonForm } : les),
    } : chap);
    notifyAndSync(newChapters, "bài học"); 
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
    notifyAndSync(newChapters, "bài học"); 
    showToast("Đã xóa bài học!", "success");
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resUrl.trim() || !resourceModal) return;
    const newResource = { 
      id: "res-" + Date.now(), 
      title: resTitle.trim(), 
      url: resUrl.trim(), 
      type: resourceModal.type === "video_list" ? vidType : undefined, 
    };
    const newChapters = (chapters || []).map(chap => ({ 
      ...chap, 
      lessons: (chap?.lessons || []).map((les: any) => { 
        if (les?.id === resourceModal.lessonId) { 
          return { ...les, [resourceModal.type]: [...(les[resourceModal.type] || []), newResource] }; 
        } 
        return les; 
      }), 
    }));
    notifyAndSync(newChapters, "tài nguyên"); 
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
      }), 
    }));
    notifyAndSync(newChapters, "tài liệu tăng cường"); 
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
      }), 
    }));
    notifyAndSync(newChapters, "file Google Drive"); 
    setDriveLinkModal(null); 
    setDriveLinkForm({ title: "", url: "" }); 
    showToast("Đã đính kèm file Drive!", "success");
  };

  const handleDeleteResource = async (lessonId: string, resType: string, resId: string) => {
    if (!confirm("Xác nhận xóa tài nguyên này?")) return;
    
    if (viewResourcesModal && viewResourcesModal.lessonId === lessonId && viewResourcesModal.type === resType) {
      setViewResourcesModal((prev: any) => prev ? { ...prev, items: (prev.items || []).filter((i: any) => i?.id !== resId) } : null);
    }

    const newChapters = (chapters || []).map(chap => ({ 
      ...chap, 
      lessons: (chap?.lessons || []).map((les: any) => les?.id === lessonId ? { ...les, [resType]: (les[resType] || []).filter((r: any) => r?.id !== resId) } : les), 
    }));
    
    notifyAndSync(newChapters, "tài nguyên");
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
              type: editResourceModal.type === "video_list" ? editResourceForm.type : r.type,
            } : r 
          )}; 
        } 
        return les; 
      }), 
    }));
    notifyAndSync(newChapters, "tài liệu");
    setEditResourceModal(null); 
    showToast("Đã cập nhật thông tin tài liệu!", "success");
  };

  // HÀM DUYỆT HỌC VIÊN: CẬP NHẬT UI NGAY (0MS) + GỬI REQUEST POST LÊN API BACKEND
  const handleUpdateStudentStatus = async (studentId: string, status: "approved" | "rejected") => {
    const isApproved = status === "approved";

    setRegisteredStudents(prev =>
      prev.map(s => (s.id === studentId ? {
        ...s,
        approval_status: status,
        status: status,
        is_approved: isApproved,
      } : s))
    );

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_registered_students");
        if (saved) {
          const list = JSON.parse(saved);
          const updated = list.map((s: any) => (s.id === studentId ? {
            ...s,
            approval_status: status,
            status: status,
            is_approved: isApproved,
          } : s));
          localStorage.setItem("edunexus_registered_students", JSON.stringify(updated));
        }
      } catch (e) {}
    }

    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_status", studentId, status }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "Lỗi cập nhật từ API");
      }
      showToast("Đã " + (isApproved ? "duyệt" : "khóa") + " học sinh thành công!", "success");
    } catch (err: any) {
      showToast("Lỗi cập nhật lên cơ sở dữ liệu: " + err.message, "error");
    }
  };

  // HÀM XÓA HỌC SINH: CẬP NHẬT UI NGAY + GỌI API BACKEND XÓA VĨNH VIỄN
  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm("Xác nhận xóa học sinh này khỏi hệ thống vĩnh viễn?")) return;

    setRegisteredStudents(prev => prev.filter(s => s.id !== studentId));

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_registered_students");
        if (saved) {
          const list = JSON.parse(saved);
          const updated = list.filter((s: any) => s.id !== studentId);
          localStorage.setItem("edunexus_registered_students", JSON.stringify(updated));
        }
      } catch (e) {}
    }
    showToast("Đã xóa học sinh khỏi cơ sở dữ liệu.", "success");

    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_student", studentId }),
      });
      if (!res.ok) {
        await supabase.from("profiles").delete().eq("id", studentId);
      }
    } catch (err) {
      console.warn("Lỗi đồng bộ xóa học sinh:", err);
      try {
        await supabase.from("profiles").delete().eq("id", studentId);
      } catch {}
    }
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
      createdAt: nowIso,
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
      createdAt: nowIso,
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
      audience: "all", 
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
        attendedAt: new Date().toISOString(),
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

  const analyticsData = useMemo(() => {
    const profileMap = new Map<string, any>();
    (registeredStudents || []).forEach(s => {
      if (!s) return;
      if (s.id) profileMap.set(String(s.id).trim().toLowerCase(), s);
      if (s.full_name) profileMap.set(String(s.full_name).trim().toLowerCase(), s);
      if (s.username) profileMap.set(String(s.username).trim().toLowerCase(), s);
      if (s.email) {
        profileMap.set(String(s.email).trim().toLowerCase(), s);
        const prefix = String(s.email).split("@")[0].trim().toLowerCase();
        if (prefix) profileMap.set(prefix, s);
      }
    });

    const validHwIds = new Set<string>();
    const validTestIds = new Set<string>();
    const validTitles = new Set<string>();

    if (rankingScope === "chapter" && selectedChapterId !== "all") {
      const targetChap = (chapters || []).find((c: any) => c.id === selectedChapterId);
      if (targetChap) {
        (targetChap.lessons || []).forEach((les: any) => {
          (les.homework_files || []).forEach((hw: any) => {
            if (hw.id) validHwIds.add(String(hw.id).trim().toLowerCase());
            if (hw.title) validTitles.add(normalizeText(hw.title));
          });
          (les.test_quizzes || []).forEach((tq: any) => {
            if (tq.id) validTestIds.add(String(tq.id).trim().toLowerCase());
            if (tq.title) validTitles.add(normalizeText(tq.title));
          });
        });
      }
    } else if (rankingScope === "lesson" && selectedLessonId !== "all") {
      let targetLesson: any = null;
      for (const chap of chapters || []) {
        const found = (chap.lessons || []).find((l: any) => l.id === selectedLessonId);
        if (found) {
          targetLesson = found;
          break;
        }
      }
      if (targetLesson) {
        (targetLesson.homework_files || []).forEach((hw: any) => {
          if (hw.id) validHwIds.add(String(hw.id).trim().toLowerCase());
          if (hw.title) validTitles.add(normalizeText(hw.title));
        });
        (targetLesson.test_quizzes || []).forEach((tq: any) => {
          if (tq.id) validTestIds.add(String(tq.id).trim().toLowerCase());
          if (tq.title) validTitles.add(normalizeText(tq.title));
        });
      }
    }

    const stats: Record<string, any> = {};
    (registeredStudents || []).forEach(s => {
      stats[s.id] = {
        id: s.id,
        name: s.full_name || s.username || "Học sinh",
        username: s.username || (s.email ? s.email.split("@")[0] : ""),
        school: s.school || "THPT",
        mode: s.learning_mode || s.study_mode || "online",
        totalAttempts: 0,
        hwMax: 0,
        testMax: 0,
        hwScores: [] as number[],
        testScores: [] as number[],
      };
    });

    (allAttempts || []).forEach(att => {
      if (!att) return;

      const attQuizId = String(att.quizId || att.quiz_id || att.exam_id || "").trim().toLowerCase();
      const attTitle = normalizeText(att.examTitle || att.quizTitle || att.title || "");

      let isScopeMatched = true;
      let matchedAsHw = false;
      let matchedAsTest = false;

      if (rankingScope !== "course") {
        const matchHw = (attQuizId && validHwIds.has(attQuizId)) || (attTitle && validTitles.has(attTitle));
        const matchTest = (attQuizId && validTestIds.has(attQuizId)) || (attTitle && validTitles.has(attTitle));

        if (!matchHw && !matchTest) {
          isScopeMatched = false;
        } else {
          matchedAsHw = matchHw;
          matchedAsTest = matchTest;
        }
      }

      if (!isScopeMatched) return;

      const attStuId = String(att.studentId || att.student_id || att.user_id || "").trim().toLowerCase();
      const rawAttName = String(att.studentName || att.student_name || att.full_name || "").trim();

      const matchedProfile =
        profileMap.get(attStuId) ||
        (rawAttName ? profileMap.get(rawAttName.toLowerCase()) : null);

      let targetId = matchedProfile ? matchedProfile.id : attStuId;
      if (!targetId || !stats[targetId]) return;

      const st = stats[targetId];
      const sc = Number(att.score ?? att.points ?? 0);
      st.totalAttempts++;

      const isHomeworkType =
        matchedAsHw ||
        (!matchedAsTest && (att.type === "homework" || att.is_homework || att.isHomework));

      if (isHomeworkType) {
        st.hwScores.push(sc);
        st.hwMax = Math.max(st.hwMax, sc);
      } else {
        st.testScores.push(sc);
        st.testMax = Math.max(st.testMax, sc);
      }
    });

    return Object.values(stats)
      .filter((st: any) => {
        if (analyticsModeFilter === "all") return true;
        return st.mode === analyticsModeFilter;
      })
      .map((st: any) => {
        let overallAvg = 0;
        const allScores = [...st.hwScores, ...st.testScores];

        if (rankingScope === "lesson") {
          if (st.hwScores.length > 0 && st.testScores.length > 0) {
            overallAvg = (st.hwMax + st.testMax) / 2;
          } else if (st.hwScores.length > 0) {
            overallAvg = st.hwMax;
          } else if (st.testScores.length > 0) {
            overallAvg = st.testMax;
          }
        } else {
          if (st.hwScores.length > 0 && st.testScores.length > 0) {
            const hwAvg = st.hwScores.reduce((a: number, b: number) => a + b, 0) / st.hwScores.length;
            const testAvg = st.testScores.reduce((a: number, b: number) => a + b, 0) / st.testScores.length;
            overallAvg = (hwAvg + testAvg) / 2;
          } else if (allScores.length > 0) {
            overallAvg = allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length;
          }
        }

        return {
          ...st,
          hwMax: Number(st.hwMax.toFixed(1)),
          testMax: Number(st.testMax.toFixed(1)),
          overallAvg: Number(overallAvg.toFixed(1)),
        };
      })
      .sort((a: any, b: any) => b.overallAvg - a.overallAvg || b.totalAttempts - a.totalAttempts);
  }, [
    allAttempts,
    registeredStudents,
    analyticsModeFilter,
    rankingScope,
    selectedChapterId,
    selectedLessonId,
    chapters,
  ]);

  const getVietnameseLastName = (fullName: string): string => {
    if (!fullName) return "";
    const parts = fullName.trim().split(/\s+/);
    return parts[parts.length - 1] || "";
  };

  const sortedAndFilteredStudents = useMemo(() => {
    let list = Array.isArray(registeredStudents) ? [...registeredStudents] : [];

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

  const examsWithScoresData = useMemo(() => {
    let list = Array.isArray(practiceExams) ? [...practiceExams] : [];
    if (practiceCategoryFilter !== "Tất cả danh mục") {
      list = list.filter(ex => ex?.category === practiceCategoryFilter);
    }

    return list.map(ex => {
      const exId = String(ex?.id || "").trim();
      const exTitleNorm = normalizeText(ex?.title);

      const attempts = (allAttempts || []).filter(a => {
        if (!a) return false;
        const aQuizId = String(a.quizId || a.quiz_id || a.exam_id || "").trim();
        const aTitleNorm = normalizeText(a.examTitle || a.exam_title || a.title);
        return (aQuizId && exId && aQuizId === exId) || (exTitleNorm && aTitleNorm && exTitleNorm === aTitleNorm);
      });

      const studentMap = new Map();
      attempts.forEach(att => {
        const key = att.studentId || att.student_id || att.studentName;
        const prev = studentMap.get(key);
        if (!prev || Number(att.score || 0) > Number(prev.score || 0)) {
          studentMap.set(key, att);
        }
      });

      const scores = attempts.map(a => Number(a.score || 0));
      const avgScore = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

      return {
        ...ex,
        totalSubmissions: attempts.length,
        uniqueStudentCount: studentMap.size,
        avgScore: avgScore.toFixed(2),
        maxScore: maxScore.toFixed(2),
        attempts,
      };
    });
  }, [practiceExams, practiceCategoryFilter, allAttempts]);

  // HÀM LƯU ĐỀ THI: NÉN ĐỒNG BỘ MAXWIDTH 800PX + LƯU ĐƠN LẺ SUPABASE & FALLBACK API + CHỐNG QUOTA EXCEEDED
  const handleSaveAzotaExam = async (examData: any) => {
    const currentUploadMode = uploadMode;
    const currentEditingExam = editingExamData;
    const currentAzotaTarget = azotaTarget;

    if (currentUploadMode === "practice") {
      const examId = currentEditingExam ? currentEditingExam.id : ("prac-" + Date.now());
      const title = examData.title || "Đề luyện thi mới";
      const category = examData.category || "Tự do";
      const duration = Number(examData.duration_minutes) || 45;
      const targetMode = examData.target_mode || (currentEditingExam?.target_mode ?? "all");
      const allowRetake = currentEditingExam ? (currentEditingExam.allowRetake ?? true) : true;
      const allowViewFile = currentEditingExam ? (currentEditingExam.allowViewFile ?? true) : true;
      const driveUrl = examData.driveUrl || (currentEditingExam?.driveUrl ?? "");
      const solutionVideoUrl = examData.solutionVideoUrl || (currentEditingExam?.solutionVideoUrl ?? "");
      const rawSections = examData.sections || examData.data || [];
      const incomingMediaMap = examData.mediaMap || examData.media_map || {};
      const createdAt = currentEditingExam?.created_at || new Date().toISOString();

      try {
        // BƯỚC 1: Nén đồng bộ toàn bộ ảnh Base64 trong media_map và trong sections (< 500KB)
        setPracticeSyncStatus({
          isSyncing: true,
          progress: 40,
          message: "Đang tối ưu dung lượng đề thi...",
          type: "loading"
        });

        const optimizedMedia = await optimizeExamMediaMap(incomingMediaMap);
        const optimizedSections = await optimizeExamSectionsDeep(rawSections);

        const payloadExam = {
          id: examId,
          title: title,
          category: category,
          duration_minutes: duration,
          target_mode: targetMode || "all",
          allowRetake: allowRetake ?? true,
          allowViewFile: allowViewFile ?? true,
          driveUrl: driveUrl || "",
          solutionVideoUrl: solutionVideoUrl || "",
          data: optimizedSections,
          sections: optimizedSections,
          media_map: optimizedMedia,
          mediaMap: optimizedMedia,
          created_at: createdAt
        };

        // Bản ghi chuẩn 11 cột cho bảng practice_exams (chỉ gửi duy nhất 1 đề, không nhân đôi dữ liệu)
        const singleExamDbRecord = {
          id: examId,
          title: title,
          category: category,
          duration_minutes: duration,
          allowRetake: allowRetake ?? true,
          allowViewFile: allowViewFile ?? true,
          driveUrl: driveUrl || "",
          solutionVideoUrl: solutionVideoUrl || "",
          data: optimizedSections,
          media_map: optimizedMedia,
          created_at: createdAt
        };

        setPracticeSyncStatus({
          isSyncing: true,
          progress: 70,
          message: "Đang lưu đề lên máy chủ Supabase...",
          type: "loading"
        });

        // BƯỚC 2: Lưu thực chất vào Supabase (Chỉ gửi duy nhất 1 đề hiện tại)
        let saveSuccess = false;

        // Tầng 1: Thử dùng Supabase Client trực tiếp (bỏ qua Vercel Gateway)
        if (supabase) {
          const { error: sbError } = await supabase
            .from("practice_exams")
            .upsert(singleExamDbRecord);
          if (!sbError) {
            saveSuccess = true;
          } else {
            console.warn("Lưu qua Supabase Client thất bại, chuyển sang API Route:", sbError);
          }
        }

        // Tầng 2: Nếu chưa thành công, fallback sang Backend API Route với payload đã nén nhẹ
        if (!saveSuccess) {
          const res = await fetch("/api/admin/data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "save_practice_exam", examData: singleExamDbRecord })
          });
          if (res.ok) {
            saveSuccess = true;
          }
        }

        if (!saveSuccess) {
          throw new Error("Không thể ghi dữ liệu đề thi vào Supabase!");
        }

        if (currentEditingExam) {
          handleRecalculateExamScores(examId, optimizedSections);
        }

        // BƯỚC 3: Đồng bộ lại danh sách và cập nhật UI + LocalStorage an toàn
        const refreshed = await fetchPracticeExams();
        if (!refreshed) {
          const updatedList = currentEditingExam
            ? (practiceExams || []).map((ex: any) => ex.id === examId ? payloadExam : ex)
            : [payloadExam, ...(practiceExams || [])];
          setPracticeExams(updatedList);
          safeSavePracticeExamsToStorage(updatedList);
        }

        setPracticeSyncStatus({
          isSyncing: false,
          progress: 100,
          message: "✓ Đã lưu vĩnh viễn lên đám mây!",
          type: "success"
        });
        showToast("Đã lưu đề thi vào hệ thống thành công!", "success");

        // Đóng modal
        setTestFile(null);
        setEditingExamData(null);
        setAzotaTarget(null);

        setTimeout(() => {
          setPracticeSyncStatus({ isSyncing: false, progress: 0, message: "", type: "idle" });
        }, 2000);

      } catch (err: any) {
        console.error("Lỗi lưu đề thi:", err);
        setPracticeSyncStatus({
          isSyncing: false,
          progress: 0,
          message: "Lỗi lưu đám mây: " + err.message,
          type: "error"
        });
        showToast("Lỗi khi lưu đề thi: " + err.message, "error");
      }

    } else {
      if (!currentAzotaTarget) return;
      const isHw = currentAzotaTarget.type === "homework_files";
      const targetLessonId = currentAzotaTarget.lessonId;
      const targetType = currentAzotaTarget.type;

      setTestFile(null); 
      setEditingExamData(null); 
      setAzotaTarget(null);

      try {
        const rawMedia = examData.mediaMap || examData.media_map || {};
        const rawSections = examData.sections || examData.data || [];
        const optimizedMedia = await optimizeExamMediaMap(rawMedia);
        const optimizedSections = await optimizeExamSectionsDeep(rawSections);

        const newExam = { 
          id: "exam-" + Date.now(), 
          title: examData.title || (isHw ? "Bài BTVN" : "Kiểm tra"), 
          isHomework: isHw, 
          duration_minutes: isHw ? 0 : (examData.duration_minutes || 45), 
          is_quiz: true, 
          data: optimizedSections, 
          sections: optimizedSections, 
          mediaMap: optimizedMedia, 
          media_map: optimizedMedia 
        };

        const newChapters = (latestChaptersRef.current || []).map(chap => ({ 
          ...chap, 
          lessons: (chap?.lessons || []).map((les: any) => { 
            if (les?.id === targetLessonId) { 
              return { ...les, [targetType]: [...(les[targetType] || []), newExam] }; 
            } 
            return les; 
          }) 
        }));

        notifyAndSync(newChapters, isHw ? "bài tập về nhà" : "đề kiểm tra");
        showToast("Đã nạp đề vào bài học thành công!", "success");
      } catch (err: any) {
        showToast("Lỗi khi nạp đề vào bài học: " + err.message, "error");
      }
    }
  };

  const SafeAzotaModal = AzotaExamConfigModal as React.ComponentType<any>;

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
            <div className="space-y-4">
              {!syncStatus.isSyncing && syncStatus.type === "idle" && (
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs text-slate-500 shadow-2xs">
                  <div className="flex items-center gap-2 font-medium">
                    <Cloud className="w-4 h-4 text-slate-400" />
                    <span>Hệ thống sẵn sàng: Chưa có tệp nào đang tải lên</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-emerald-600 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Máy chủ hoạt động</span>
                  </div>
                </div>
              )}

              {syncStatus.isSyncing && syncStatus.type === "loading" && (
                <div className="bg-blue-50/90 border-2 border-blue-400 p-3.5 rounded-2xl shadow-sm flex flex-col gap-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      <span>{syncStatus.message || `Đang xử lý & đăng tải dữ liệu: [ ${syncStatus.progress}% ]`}</span>
                    </div>
                    <span className="font-mono text-blue-700">{syncStatus.progress}%</span>
                  </div>
                  <div className="w-full bg-blue-200/60 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-300 rounded-full" 
                      style={{ width: `${syncStatus.progress}%` }} 
                    />
                  </div>
                </div>
              )}

              {syncStatus.type === "success" && (
                <div className="bg-emerald-50 border-2 border-emerald-400 p-3 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-900 animate-in fade-in duration-200 shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{syncStatus.message || "✓ Đã đăng tải và đồng bộ thành công! (100%)"}</span>
                  </div>
                  <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-300">Hoàn tất</span>
                </div>
              )}

              {syncStatus.type === "error" && (
                <div className="bg-rose-50 border-2 border-rose-400 p-3 rounded-2xl flex items-center justify-between text-xs font-bold text-rose-900 shadow-xs">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>{syncStatus.message || "✕ Lỗi kết nối đám mây khi lưu bài học!"}</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleRetrySync} 
                    className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Thử lại
                  </button>
                </div>
              )}

              <LessonsTab
                chapters={chapters}
                setChapters={setChapters}
                onUpdateChapters={notifyAndSync}
                saveToStorage={notifyAndSync}
                lessonModeTab={lessonModeTab}
                setLessonModeTab={setLessonModeTab}
                setCreateModal={setCreateModal}
                setResourceModal={setResourceModal}
                setViewResourcesModal={setViewResourcesModal}
                setUploadMethodModal={setUploadMethodModal}
                setBoostModal={setBoostModal}
                setEditLessonModal={setEditLessonModal}
                setEditLessonForm={setEditLessonForm}
                handleDeleteLesson={handleDeleteLesson}
              />
            </div>
          )}

          {activeTab === "practice" && (
            <PracticeTab
              practiceSubTab={practiceSubTab}
              setPracticeSubTab={setPracticeSubTab}
              practiceExams={practiceExams || []}
              allAttempts={allAttempts || []}
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
              examsWithScoresData={examsWithScoresData || []}
              practiceSyncStatus={practiceSyncStatus}
            />
          )}

          {activeTab === "analytics" && (
            <AnalyticsTab
              analyticsData={analyticsData || []}
              analyticsModeFilter={analyticsModeFilter}
              setAnalyticsModeFilter={setAnalyticsModeFilter}
              rankingScope={rankingScope}
              setRankingScope={setRankingScope}
              selectedChapterId={selectedChapterId}
              setSelectedChapterId={setSelectedChapterId}
              selectedLessonId={selectedLessonId}
              setSelectedLessonId={setSelectedLessonId}
              chapters={chapters || []}
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
              sysNotifications={sysNotifications || []}
              handleSendNotification={handleSendNotification}
              handleDeleteNotification={handleDeleteNotification}
            />
          )}

          {activeTab === "students" && (
            <StudentsTab
              registeredStudents={registeredStudents || []}
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
              onlineSessions={onlineSessions || []}
              handleDeleteSession={handleDeleteSession}
              setIsAddDateModalOpen={setIsAddDateModalOpen}
              setIsAddStudentModalOpen={setIsAddStudentModalOpen}
              attendanceSearchText={attendanceSearchText}
              setAttendanceSearchText={setAttendanceSearchText}
              attendanceFilterMode={attendanceFilterMode}
              setAttendanceFilterMode={setAttendanceFilterMode}
              registeredStudents={registeredStudents || []}
              attendanceSortAZ={attendanceSortAZ}
              setAttendanceSortAZ={setAttendanceSortAZ}
              sessionDates={sessionDates || []}
              handleDeleteAttendanceDate={handleDeleteAttendanceDate}
              sortedAndFilteredStudents={sortedAndFilteredStudents || []}
              attendanceRecords={attendanceRecords || []}
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
                registeredStudents={registeredStudents || []}
                allAttempts={allAttempts || []}
                chapters={chapters || []}
                practiceExams={practiceExams || []}
                attendanceRecords={attendanceRecords || []}
              />
            </motion.div>
          )}
        </div>
      </main>

      <AdminModals
        azotaScoreViewModal={azotaScoreViewModal}
        setAzotaScoreViewModal={setAzotaScoreViewModal}
        registeredStudents={registeredStudents || []}
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
        chapters={chapters || []}
        setChapters={setChapters}
        onUpdateChapters={notifyAndSync}
        saveToStorage={notifyAndSync}
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
                    localStorage.removeItem("edunexus_registered_students");
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
