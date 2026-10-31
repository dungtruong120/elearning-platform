"use client";

import React, { useState, useEffect, useCallback, useMemo, useTransition, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Cloud,
  X,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Camera
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
import PaperExamManagerTab from "@/components/admin/tabs/PaperExamManagerTab";
import AnalyticsTab from "@/components/admin/tabs/AnalyticsTab";
import NotificationsTab from "@/components/admin/tabs/NotificationsTab";
import StudentsTab from "@/components/admin/tabs/StudentsTab";
import OnlineScheduleTab from "@/components/admin/tabs/OnlineScheduleTab";
import AdminModals from "@/components/admin/modals/AdminModals";
import { AdminBulkOMRScannerModal } from "@/components/admin/paper/AdminBulkOMRScannerModal";

const AzotaExamConfigModal: any = dynamic(
  () => import("./AzotaExamConfigModal").then((mod: any) => mod.AzotaExamConfigModal || mod.default || mod),
  { ssr: false }
);

function normalizeText(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStudentProfile(raw: any): any {
  if (!raw) return raw;
  const rawMode = String(
    raw.learning_mode || raw.learningMode || raw.study_mode || raw.studyMode || "online"
  )
    .toLowerCase()
    .trim();
  const isOffline = rawMode === "offline" || rawMode.includes("off");

  return {
    ...raw,
    id: String(raw.id || raw.user_id || raw.studentId || `stu-${Date.now()}`),
    full_name: raw.full_name || raw.fullName || raw.studentName || raw.name || "Chưa cập nhật",
    email: raw.email || raw.user_email || raw.userEmail || "",
    phone: raw.phone || raw.phone_number || raw.phoneNumber || raw.tel || "",
    school: raw.school || raw.school_name || "THPT",
    grade: raw.grade || raw.class_name || "Lớp 12",
    learning_mode: isOffline ? "offline" : "online",
    study_mode: isOffline ? "offline" : "online",
    approval_status:
      raw.approval_status || raw.status || (raw.is_approved ? "approved" : "pending"),
    status: raw.status || raw.approval_status || (raw.is_approved ? "approved" : "pending"),
    is_approved:
      raw.approval_status === "approved" ||
      raw.status === "approved" ||
      Boolean(raw.is_approved),
    created_at: raw.created_at || raw.createdAt || new Date().toISOString(),
  };
}

function base64ToBlob(base64: string): Blob {
  const parts = base64.split(";base64,");
  const contentType = parts[0]?.split(":")[1] || "image/png";
  const cleanB64 = (parts[1] || "").replace(/[\r\n\s]+/g, "");
  const raw = window.atob(cleanB64);
  const uInt8Array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

async function compressBase64Emergency(
  base64Str: string,
  maxDim = 480,
  quality = 0.45
): Promise<string> {
  if (!base64Str || typeof base64Str !== "string" || !base64Str.startsWith("data:image")) {
    return base64Str;
  }
  const cleanB64 = base64Str.replace(/[\r\n\s]+/g, "");
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: string) => {
      if (!settled) {
        settled = true;
        resolve(val);
      }
    };
    const timer = setTimeout(() => finish(cleanB64.length > 40000 ? "" : cleanB64), 1500);
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        clearTimeout(timer);
        try {
          let w = img.width || 480;
          let h = img.height || 320;
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return finish(cleanB64.length > 40000 ? "" : cleanB64);
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const out = canvas.toDataURL("image/jpeg", quality);
          finish(out.length < cleanB64.length ? out : cleanB64);
        } catch {
          finish(cleanB64.length > 40000 ? "" : cleanB64);
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        finish(cleanB64.length > 40000 ? "" : cleanB64);
      };
      img.src = cleanB64;
    } catch {
      clearTimeout(timer);
      finish(cleanB64.length > 40000 ? "" : cleanB64);
    }
  });
}

async function uploadSingleImageToStorage(
  supabaseClient: any,
  base64Str: string,
  folder = "courses_media"
): Promise<string> {
  if (!base64Str || typeof base64Str !== "string" || !base64Str.startsWith("data:image")) {
    return base64Str;
  }
  try {
    const blob = base64ToBlob(base64Str);
    const ext = base64Str.includes("image/jpeg") ? "jpg" : "png";
    const safeFolder = String(folder || "courses_media").replace(/[^a-zA-Z0-9_/-]/g, "_");
    const filePath = `${safeFolder}/${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 6)}.${ext}`;
    const { error } = await supabaseClient.storage.from("exam-media").upload(filePath, blob, {
      contentType: blob.type || (ext === "jpg" ? "image/jpeg" : "image/png"),
      cacheControl: "31536000",
      upsert: true
    });
    if (error) {
      console.warn("Storage upload warn:", error);
      return await compressBase64Emergency(base64Str);
    }
    const { data } = supabaseClient.storage.from("exam-media").getPublicUrl(filePath);
    return data?.publicUrl || (await compressBase64Emergency(base64Str));
  } catch (err) {
    console.error("Lỗi upload ảnh:", err);
    return await compressBase64Emergency(base64Str);
  }
}

async function sanitizeAndUploadAllMediaRecursively(
  target: any,
  supabaseClient: any,
  urlMap: Map<string, string>,
  folder = "courses_media",
  onUploadedOne?: () => void
): Promise<any> {
  if (!target) return target;

  if (typeof target === "string") {
    if (target.startsWith("data:image")) {
      if (!urlMap.has(target)) {
        const url = await uploadSingleImageToStorage(supabaseClient, target, folder);
        urlMap.set(target, url);
        if (onUploadedOne) onUploadedOne();
      }
      return urlMap.get(target);
    }
    if (target.includes("data:image/")) {
      const regex = /data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\r\n]+/g;
      const matches = Array.from(new Set(target.match(regex) || []));
      let updatedString = target;
      for (const b64 of matches) {
        if (!urlMap.has(b64)) {
          const url = await uploadSingleImageToStorage(supabaseClient, b64, folder);
          urlMap.set(b64, url);
          if (onUploadedOne) onUploadedOne();
        }
        updatedString = updatedString.split(b64).join(urlMap.get(b64)!);
      }
      return updatedString;
    }
    return target;
  }

  if (Array.isArray(target)) {
    const newArr = [];
    for (const item of target) {
      newArr.push(
        await sanitizeAndUploadAllMediaRecursively(
          item,
          supabaseClient,
          urlMap,
          folder,
          onUploadedOne
        )
      );
    }
    return newArr;
  }

  if (typeof target === "object") {
    const newObj: Record<string, any> = {};
    for (const [k, v] of Object.entries(target)) {
      newObj[k] = await sanitizeAndUploadAllMediaRecursively(
        v,
        supabaseClient,
        urlMap,
        folder,
        onUploadedOne
      );
    }
    return newObj;
  }

  return target;
}

function safeSavePracticeExamsToStorage(examsList: any[]) {
  if (typeof window === "undefined" || !Array.isArray(examsList) || examsList.length === 0) {
    return;
  }
  try {
    localStorage.setItem("edunexus_practice_exams", JSON.stringify(examsList));
  } catch (e) {
    const lightweightExams = examsList.map((ex: any) => ({
      id: ex?.id,
      title: ex?.title,
      category: ex?.category,
      duration_minutes: ex?.duration_minutes,
      target_mode: ex?.target_mode,
      allowRetake: ex?.allowRetake,
      allowViewFile: ex?.allowViewFile,
      driveUrl: ex?.driveUrl,
      solutionVideoUrl: ex?.solutionVideoUrl,
      data: ex?.data || ex?.sections || [],
      created_at: ex?.created_at
    }));
    try {
      localStorage.setItem("edunexus_practice_exams", JSON.stringify(lightweightExams));
    } catch {}
  }
}

const VALID_ADMIN_TABS = [
  "lessons",
  "practice",
  "paper-exams",
  "analytics",
  "notifications",
  "students",
  "online_schedule",
  "reports"
];

function AdminDashboardContent() {
  const [mounted, setMounted] = useState(false);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState<boolean>(false);

  const deletedAttemptIdsRef = useRef<Set<string>>(new Set());
  // Khóa chống gọi trùng lặp đồng thời (In-Flight Lock & Cooldown Throttle) tiết kiệm Egress
  const isSyncingGlobalRef = useRef<boolean>(false);
  const lastGlobalSyncTimeRef = useRef<number>(0);

  const loadDeletedBlacklistFromStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const fromLocal = JSON.parse(localStorage.getItem("edunexus_deleted_attempt_ids") || "[]");
      const fromSession = JSON.parse(
        sessionStorage.getItem("edunexus_deleted_attempt_ids") || "[]"
      );
      if (Array.isArray(fromLocal)) {
        fromLocal.forEach((id: string) => id && deletedAttemptIdsRef.current.add(String(id)));
      }
      if (Array.isArray(fromSession)) {
        fromSession.forEach((id: string) => id && deletedAttemptIdsRef.current.add(String(id)));
      }
    } catch (e) {}
  }, []);

  const isAttemptBlacklisted = useCallback((att: any): boolean => {
    if (!att) return true;
    const rawId = String(att.id || "").trim();
    const quizId = String(att.quizId || att.quiz_id || att.exam_id || "").trim();
    const studentId = String(att.studentId || att.student_id || att.user_id || "").trim();
    const createdAt = String(att.createdAt || att.created_at || "").trim();
    const syntheticId = `${quizId}_${studentId}_${createdAt}`;
    const stuTimeKey = createdAt && studentId ? `${studentId}_${createdAt}` : "";

    if (rawId && deletedAttemptIdsRef.current.has(rawId)) return true;
    if (syntheticId && deletedAttemptIdsRef.current.has(syntheticId)) return true;
    if (stuTimeKey && deletedAttemptIdsRef.current.has(stuTimeKey)) return true;
    return false;
  }, []);

  const [activeTab, setActiveTab] = useState<AdminTab | "paper-exams" | string>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "").trim();
      if (VALID_ADMIN_TABS.includes(hash)) return hash;
    }
    return "lessons";
  });

  const [lessonModeTab, setLessonModeTab] = useState<"all" | "offline" | "online">("all");
  const [practiceSubTab, setPracticeSubTab] = useState<"manage" | "scores">("manage");

  const [bulkOmrScannerQuiz, setBulkOmrScannerQuiz] = useState<any | null>(null);
  const [isBulkOmrScannerOpen, setIsBulkOmrScannerOpen] = useState<boolean>(false);

  const [chapters, setChapters] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_course_data");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return INITIAL_CHAPTERS || [];
  });

  const [practiceExams, setPracticeExams] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_practice_exams");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
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
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map(normalizeStudentProfile);
          }
        }
        const savedSbd = localStorage.getItem("edunexus_sbd_directory");
        if (savedSbd) {
          const parsedSbd = JSON.parse(savedSbd);
          if (Array.isArray(parsedSbd) && parsedSbd.length > 0) {
            return parsedSbd.map(normalizeStudentProfile);
          }
        }
      } catch (e) {}
    }
    return [];
  });

  const [allAttempts, setAllAttempts] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const delLocal = JSON.parse(localStorage.getItem("edunexus_deleted_attempt_ids") || "[]");
        const delSession = JSON.parse(
          sessionStorage.getItem("edunexus_deleted_attempt_ids") || "[]"
        );
        const delSet = new Set<string>([
          ...(Array.isArray(delLocal) ? delLocal : []),
          ...(Array.isArray(delSession) ? delSession : []),
        ]);
        const saved = localStorage.getItem("edunexus_attempts");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter((a: any) => {
              const id = String(a?.id || `${a?.quizId}_${a?.studentId}_${a?.createdAt}`);
              return !delSet.has(id);
            });
          }
        }
      } catch (e) {}
    }
    return [];
  });

  const [isLoadingExams, setIsLoadingExams] = useState<boolean>(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState<boolean>(false);
  const [uploadProgressText, setUploadProgressText] = useState<string | null>(null);

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
    "24/8",
    "26/8",
    "07/09",
    "09/09",
    "14/09",
    "16/09",
    "21/09",
    "24/09",
  ]);

  const [toastNotification, setToastNotification] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [isCreatingItem, setIsCreatingItem] = useState(false);

  const [uploadMode, setUploadMode] = useState<"course" | "practice">("course");
  const [practiceCategoryFilter, setPracticeCategoryFilter] = useState("Tất cả danh mục");
  const [rankingScope, setRankingScope] = useState<"lesson" | "chapter" | "course">("course");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("all");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("all");
  const [notifTitle, setNotifTitle] = useState("");
  const [notifContent, setNotifContent] = useState("");
  const [notifType, setNotifType] = useState<"teacher" | "urgent" | "exam">("teacher");

  const [studentFilter, setStudentFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [studentSearch, setStudentSearch] = useState("");

  const [attendanceSearchText, setAttendanceSearchText] = useState<string>("");
  const [attendanceFilterMode, setAttendanceFilterMode] = useState<"all" | "online" | "offline">(
    "all"
  );
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
  const [azotaTarget, setAzotaTarget] = useState<{
    lessonId: string;
    type: "homework_files" | "test_quizzes";
  } | null>(null);
  const [resourceModal, setResourceModal] = useState<any>(null);
  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [vidType, setVidType] = useState<"lecture" | "homework_solution">("lecture");

  const [createModal, setCreateModal] = useState<{
    type: "chapter" | "lesson";
    chapterId?: string;
  } | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemFormat, setNewItemFormat] = useState("Zoom");
  const [newItemTargetMode, setNewItemTargetMode] = useState<"online" | "offline" | "all">("all");

  const [editLessonModal, setEditLessonModal] = useState<{
    chapterId: string;
    lesson: any;
  } | null>(null);
  const [editLessonForm, setEditLessonForm] = useState({
    title: "",
    description: "",
    duration: 45,
    format: "Zoom",
    target_mode: "all" as "online" | "offline" | "all"
  });
  const [boostModal, setBoostModal] = useState<string | null>(null);
  const [boostForm, setBoostForm] = useState({ title: "", type: "video", url: "", note: "" });
  const [uploadMethodModal, setUploadMethodModal] = useState<{
    lessonId: string;
    type: "homework_files" | "test_quizzes";
  } | null>(null);
  const [driveLinkModal, setDriveLinkModal] = useState<{
    lessonId: string;
    type: "homework_files" | "test_quizzes";
  } | null>(null);
  const [driveLinkForm, setDriveLinkForm] = useState({ title: "", url: "" });

  const [viewResourcesModal, setViewResourcesModal] = useState<{
    lessonId: string;
    type: string;
    title: string;
    items: any[];
  } | null>(null);
  const [editResourceModal, setEditResourceModal] = useState<{
    lessonId: string;
    type: string;
    item: any;
  } | null>(null);
  const [editResourceForm, setEditResourceForm] = useState({
    title: "",
    url: "",
    type: "lecture"
  });

  const [videoModalExam, setVideoModalExam] = useState<any | null>(null);
  const [solutionVideoInput, setSolutionVideoInput] = useState("");
  const [testExamRoom, setTestExamRoom] = useState<any | null>(null);

  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [quickStudentForm, setQuickStudentForm] = useState({
    lastName: "",
    firstName: "",
    status: "approved" as "approved" | "rejected",
  });

  const [analyticsModeFilter, setAnalyticsModeFilter] = useState<"all" | "online" | "offline">(
    "all"
  );

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

  const handleSwitchTab = useCallback((newTab: AdminTab | "paper-exams" | string) => {
    setActiveTab(newTab);
    setIsMobileSidebarOpen(false);
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

  const handleAttemptDeleted = useCallback(
    (deletedAttemptOrId: any) => {
      const deletedAttemptId =
        typeof deletedAttemptOrId === "string"
          ? deletedAttemptOrId
          : String(
              deletedAttemptOrId?.id ||
                `${deletedAttemptOrId?.quizId || deletedAttemptOrId?.quiz_id || ""}_${
                  deletedAttemptOrId?.studentId || deletedAttemptOrId?.student_id || ""
                }_${deletedAttemptOrId?.createdAt || deletedAttemptOrId?.created_at || ""}`
            );

      const quizId =
        typeof deletedAttemptOrId === "object"
          ? String(
              deletedAttemptOrId?.quizId ||
                deletedAttemptOrId?.quiz_id ||
                deletedAttemptOrId?.exam_id ||
                ""
            )
          : "";
      const studentId =
        typeof deletedAttemptOrId === "object"
          ? String(
              deletedAttemptOrId?.studentId ||
                deletedAttemptOrId?.student_id ||
                deletedAttemptOrId?.user_id ||
                ""
            )
          : "";
      const createdAt =
        typeof deletedAttemptOrId === "object"
          ? String(deletedAttemptOrId?.createdAt || deletedAttemptOrId?.created_at || "")
          : "";

      const keysToBlock = [
        deletedAttemptId,
        quizId && studentId && createdAt ? `${quizId}_${studentId}_${createdAt}` : "",
        studentId && createdAt ? `${studentId}_${createdAt}` : "",
      ].filter(Boolean);

      keysToBlock.forEach((k) => deletedAttemptIdsRef.current.add(k));

      if (typeof window !== "undefined") {
        try {
          const currentSession = JSON.parse(
            sessionStorage.getItem("edunexus_deleted_attempt_ids") || "[]"
          );
          const currentLocal = JSON.parse(
            localStorage.getItem("edunexus_deleted_attempt_ids") || "[]"
          );
          const merged = Array.from(
            new Set([
              ...(Array.isArray(currentSession) ? currentSession : []),
              ...(Array.isArray(currentLocal) ? currentLocal : []),
              ...keysToBlock,
            ])
          );
          sessionStorage.setItem("edunexus_deleted_attempt_ids", JSON.stringify(merged));
          localStorage.setItem("edunexus_deleted_attempt_ids", JSON.stringify(merged));
        } catch (e) {}
      }

      setAllAttempts((prev: any[]) => {
        const updated = (prev || []).filter((item: any) => {
          if (!item) return false;
          const itemId = String(
            item.id ||
              `${item.quizId || item.quiz_id}_${item.studentId || item.student_id}_${
                item.createdAt || item.created_at
              }`
          );
          if (itemId === deletedAttemptId) return false;
          if (isAttemptBlacklisted(item)) return false;
          return true;
        });
        if (typeof window !== "undefined" && updated.length > 0) {
          try {
            localStorage.setItem("edunexus_attempts", JSON.stringify(updated));
          } catch (e) {}
        }
        return updated;
      });
    },
    [isAttemptBlacklisted]
  );

  const syncCoursesToSupabase = useCallback(
    (coursesData: any[], taskName: string = "bài học"): Promise<boolean> => {
      latestChaptersRef.current = coursesData;

      startTransition(() => {
        setChapters(coursesData);
      });

      setSyncStatus({
        isSyncing: true,
        progress: 30,
        message: `Đang bóc tách & tải ảnh ${taskName} lên Storage... [30%]`,
        type: "loading",
      });

      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = setTimeout(async () => {
        try {
          const mediaUrlMap = new Map<string, string>();
          let uploadedCount = 0;

          const cleanCoursesData = await sanitizeAndUploadAllMediaRecursively(
            latestChaptersRef.current,
            supabase,
            mediaUrlMap,
            "courses_media",
            () => {
              uploadedCount++;
              const prog = Math.min(72, 30 + uploadedCount * 2);
              setSyncStatus({
                isSyncing: true,
                progress: prog,
                message: `Đang tải ảnh #${uploadedCount} của ${taskName} lên Storage... [${prog}%]`,
                type: "loading",
              });
            }
          );

          latestChaptersRef.current = cleanCoursesData;
          startTransition(() => {
            setChapters(cleanCoursesData);
          });

          setSyncStatus((prev) => ({
            ...prev,
            progress: 80,
            message: `Đang lưu ${taskName} lên đám mây Supabase... [80%]`,
          }));

          const nowIso = new Date().toISOString();
          const { error: sbErr } = await supabase.from("courses").upsert({
            id: "11111111-1111-1111-1111-111111111111",
            title: "Toán 12 TCT",
            chapters: cleanCoursesData,
            updated_at: nowIso
          });

          if (sbErr) {
            console.error("Supabase Error Details (courses upsert):", sbErr);
            const { data: existingRows } = await supabase.from("courses").select("id").limit(1);
            const targetId =
              existingRows && existingRows.length > 0
                ? existingRows[0].id
                : "11111111-1111-1111-1111-111111111111";

            const { error: fallbackErr } = await supabase
              .from("courses")
              .update({ chapters: cleanCoursesData, updated_at: nowIso })
              .eq("id", targetId);

            if (fallbackErr) {
              console.error("Supabase Error Details (courses update):", fallbackErr);
              throw fallbackErr;
            }
          }

          try {
            localStorage.setItem("edunexus_course_data", JSON.stringify(cleanCoursesData));
            window.dispatchEvent(new Event("storage"));
          } catch (lsErr) {
            console.warn("LocalStorage đầy:", lsErr);
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
            message: "✕ Lỗi kết nối đám mây, đã giữ an toàn trong bộ nhớ cục bộ.",
            type: "error",
          });
          showToast("Lỗi đồng bộ Supabase: " + (err?.message || "Kiểm tra lại kết nối"), "error");
        }
      }, 250);

      return Promise.resolve(true);
    },
    [showToast]
  );

  const handleRetrySync = () => {
    if (latestChaptersRef.current) {
      syncCoursesToSupabase(latestChaptersRef.current, "bài học");
    }
  };

  // HÀM TẢI ĐỀ LUYỆN THI SIÊU NHẸ (BỎ QUA CỘT MEDIA_MAP NẶNG HÀNG CHỤC MB)
  const fetchPracticeExams = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("practice_exams")
        .select(
          "id, title, category, duration_minutes, allowRetake, allowViewFile, driveUrl, solutionVideoUrl, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.error("Supabase Error Details (practice_exams):", error);
        return null;
      }

      if (Array.isArray(data) && data.length > 0) {
        setPracticeExams(data);
        safeSavePracticeExamsToStorage(data);
        return data;
      }
    } catch (e) {
      console.error("Ngoại lệ fetchPracticeExams:", e);
    }
    return null;
  }, []);

  /**
   * HÀM NẠP BÀI THI TỐI ƯU HÓA BĂNG THÔNG EGRESS (TUYỆT ĐỐI KHÔNG SELECT * HOẶC TẢI ẢNH BASE64 NẶNG)
   */
  const fetchAllAttempts = useCallback(async (): Promise<any[]> => {
    try {
      // Ưu tiên truy vấn có chọn lọc cột nhẹ và giới hạn 200 bản ghi mới nhất
      const { data, error } = await supabase
        .from("exam_attempts")
        .select(`
          id,
          exam_id,
          quiz_id,
          student_id,
          student_name,
          exam_title,
          score,
          total_questions,
          correct_answers_count,
          correct_count,
          submission_type,
          is_homework,
          type,
          assigned_month,
          assigned_week,
          created_at,
          updated_at
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!error && Array.isArray(data)) {
        return data;
      }

      if (error) {
        console.warn("Fallback select tối giản exam_attempts do thiếu cột phụ:", error.message);
      }

      // Fallback 2: Chỉ select đúng 9 cột chuẩn bắt buộc (0% nguy cơ kéo cột ảnh nặng)
      const { data: minData, error: minErr } = await supabase
        .from("exam_attempts")
        .select(`
          id,
          exam_id,
          student_id,
          score,
          total_questions,
          correct_answers_count,
          submission_type,
          created_at,
          updated_at
        `)
        .order("created_at", { ascending: false })
        .limit(200);

      if (minErr) {
        console.error("Supabase Error Details (fetchAllAttempts minimal):", minErr);
        return [];
      }

      return Array.isArray(minData) ? minData : [];
    } catch (err) {
      console.error("Ngoại lệ khi gọi fetchAllAttempts:", err);
      return [];
    }
  }, []);

  /**
   * ĐỒNG BỘ DỮ LIỆU TỔNG HỢP SIÊU NHẸ (CHỐNG TRÙNG LẶP & CẮT GIẢM 98% EGRESS)
   */
  const syncAdminGlobalData = useCallback(
    async (forceSync: boolean = false) => {
      const now = Date.now();
      if (isSyncingGlobalRef.current) return;
      if (!forceSync && now - lastGlobalSyncTimeRef.current < 3000) return;

      isSyncingGlobalRef.current = true;
      lastGlobalSyncTimeRef.current = now;

      setIsLoadingAnalytics(true);
      setIsLoadingExams(true);

      loadDeletedBlacklistFromStorage();

      try {
        let serverProfiles: any[] = [];
        let serverExams: any[] = [];
        let serverAttempts: any[] = [];

        // 1. Thực hiện song song 3 truy vấn chọn lọc cột siêu nhẹ trực tiếp lên Supabase (Không gọi /api/admin/data mặc định để tránh SELECT *)
        const [profRes, examRes, attData] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "id, full_name, username, email, phone, school, grade, role, learning_mode, study_mode, approval_status, is_approved, created_at"
            )
            .limit(200),
          supabase
            .from("practice_exams")
            .select(
              "id, title, category, duration_minutes, allowRetake, allowViewFile, driveUrl, solutionVideoUrl, created_at"
            )
            .order("created_at", { ascending: false })
            .limit(100),
          fetchAllAttempts()
        ]);

        if (!profRes.error && Array.isArray(profRes.data) && profRes.data.length > 0) {
          serverProfiles = profRes.data
            .filter((p: any) => p.role !== "admin" && p.role !== "teacher")
            .map(normalizeStudentProfile);
        } else if (profRes.error) {
          console.error("Supabase Error Details (profiles light):", profRes.error);
        }

        if (!examRes.error && Array.isArray(examRes.data) && examRes.data.length > 0) {
          serverExams = examRes.data;
        } else if (examRes.error) {
          console.error("Supabase Error Details (practice_exams light):", examRes.error);
        }

        if (Array.isArray(attData) && attData.length > 0) {
          serverAttempts = attData;
        }

        // Chỉ fallback gọi /api/admin/data khi cả 3 truy vấn trực tiếp đều rỗng hoàn toàn (ví dụ bị chặn RLS)
        if (
          serverProfiles.length === 0 &&
          serverExams.length === 0 &&
          serverAttempts.length === 0
        ) {
          try {
            const res = await fetch("/api/admin/data", { cache: "no-store" });
            if (res.ok) {
              const apiData = await res.json();
              if (apiData && apiData.success) {
                if (Array.isArray(apiData.profiles) && apiData.profiles.length > 0) {
                  serverProfiles = apiData.profiles.map(normalizeStudentProfile);
                }
                if (Array.isArray(apiData.practiceExams) && apiData.practiceExams.length > 0) {
                  serverExams = apiData.practiceExams;
                }
                const combined = [
                  ...(Array.isArray(apiData.examAttempts) ? apiData.examAttempts : []),
                  ...(Array.isArray(apiData.quizResults) ? apiData.quizResults : [])
                ];
                if (combined.length > 0) {
                  serverAttempts = combined.slice(0, 200);
                }
              }
            }
          } catch (apiErr) {
            console.error("Lỗi gọi fallback /api/admin/data:", apiErr);
          }
        }

        if (serverProfiles.length > 0) {
          setRegisteredStudents(serverProfiles);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(
                "edunexus_registered_students",
                JSON.stringify(serverProfiles)
              );
            } catch (e) {}
          }
        }

        if (serverExams.length > 0) {
          setPracticeExams(serverExams);
          safeSavePracticeExamsToStorage(serverExams);
        }

        // Tạo bảng tra cứu tên đề thi nhanh từ chapters & serverExams
        const quizTitleLookup = new Map<string, { title: string; isHomework: boolean }>();
        (serverExams.length > 0 ? serverExams : practiceExams).forEach((pe: any) => {
          if (pe?.id) {
            quizTitleLookup.set(String(pe.id).trim(), {
              title: String(pe.title || "Đề luyện thi"),
              isHomework: false
            });
          }
        });
        (latestChaptersRef.current || []).forEach((chap: any) => {
          (chap?.lessons || []).forEach((les: any) => {
            (les?.homework_files || []).forEach((hw: any) => {
              if (hw?.id) {
                quizTitleLookup.set(String(hw.id).trim(), {
                  title: String(hw.title || "Bài tập về nhà"),
                  isHomework: true
                });
              }
            });
            (les?.test_quizzes || []).forEach((tq: any) => {
              if (tq?.id) {
                quizTitleLookup.set(String(tq.id).trim(), {
                  title: String(tq.title || "Bài kiểm tra"),
                  isHomework: false
                });
              }
            });
          });
        });

        const map = new Map<string, any>();

        // Giữ nguyên dữ liệu chi tiết đã lưu ở localStorage (bao gồm ảnh OMR nếu có)
        if (typeof window !== "undefined") {
          try {
            const localSaved = JSON.parse(localStorage.getItem("edunexus_attempts") || "[]");
            if (Array.isArray(localSaved)) {
              localSaved.forEach((loc: any) => {
                if (loc && !isAttemptBlacklisted(loc)) {
                  const k = String(loc.id || `${loc.quizId}_${loc.studentId}_${loc.createdAt}`);
                  map.set(k, loc);
                }
              });
            }
          } catch {}
        }

        serverAttempts.forEach((item: any) => {
          if (!item) return;
          const quizId = String(item.exam_id || item.quiz_id || item.quizId || "").trim();
          const studentId = String(item.student_id || item.studentId || item.user_id || "").trim();
          const matchedProfile = serverProfiles.find((p: any) => p.id === studentId);
          const matchedQuizMeta = quizTitleLookup.get(quizId);

          const studentName =
            matchedProfile?.full_name ||
            item.student_name ||
            item.studentName ||
            item.full_name ||
            "Học sinh";

          const examTitle = String(
            item.exam_title ||
              item.examTitle ||
              item.quiz_title ||
              item.quizTitle ||
              matchedQuizMeta?.title ||
              "Bài thi"
          ).trim();

          const score = Number(item.score ?? item.points ?? 0);
          const correctCount = Number(
            item.correct_answers_count ?? item.correct_count ?? item.correctCount ?? 0
          );
          const totalQuestions = Number(item.total_questions ?? item.totalQuestions ?? 0);
          const createdAt = item.created_at || item.createdAt || new Date().toISOString();
          const uniqueId = String(item.id || `${quizId}_${studentId}_${createdAt}`);

          const existingLocal = map.get(uniqueId);
          const isPaperRow =
            item.submission_type === "paper" ||
            existingLocal?.submission_type === "paper" ||
            String(uniqueId).startsWith("paper_") ||
            String(uniqueId).startsWith("att-paper-");

          const isHw = Boolean(
            item.is_homework ??
              item.isHomework ??
              existingLocal?.is_homework ??
              matchedQuizMeta?.isHomework ??
              item.type === "homework"
          );

          const normalized = {
            ...existingLocal,
            ...item,
            id: uniqueId,
            quizId,
            quiz_id: quizId,
            exam_id: quizId,
            studentId,
            student_id: studentId,
            studentName,
            student_name: studentName,
            examTitle,
            exam_title: examTitle,
            score,
            points: score,
            correctCount,
            correct_count: correctCount,
            correct_answers_count: correctCount,
            totalQuestions,
            total_questions: totalQuestions,
            is_homework: isHw,
            isHomework: isHw,
            submission_type: isPaperRow ? "paper" : item.submission_type || "web",
            // Giữ lại ảnh phiếu và dữ liệu OMR đã có sẵn trong localStorage mà không cần tải lại từ Supabase
            paper_scan_url:
              item.scanned_image_url ||
              item.paper_scan_url ||
              existingLocal?.paper_scan_url ||
              existingLocal?.scanned_image_url ||
              null,
            omr_raw_data: item.omr_raw_data || existingLocal?.omr_raw_data || null,
            answers: item.answers || existingLocal?.answers || undefined,
            type: item.type || (isHw ? "homework" : "practice"),
            timeSpent:
              item.time_spent ||
              item.timeSpent ||
              (isPaperRow ? "Làm trên giấy" : "15 phút"),
            createdAt,
            created_at: createdAt,
            feedback: item.feedback || existingLocal?.feedback || "",
          };

          if (!isAttemptBlacklisted(normalized)) {
            map.set(normalized.id, normalized);
          }
        });

        const validAttempts = Array.from(map.values()).filter((att: any) => {
          const id = String(att.id || `${att.quizId}_${att.studentId}_${att.createdAt}`);
          return !deletedAttemptIdsRef.current.has(id) && !isAttemptBlacklisted(att);
        });

        if (validAttempts.length > 0) {
          setAllAttempts(validAttempts);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("edunexus_attempts", JSON.stringify(validAttempts));
            } catch (e) {}
          }
        }
      } catch (err) {
        console.error("Supabase Error Details (syncAdminGlobalData):", err);
      } finally {
        isSyncingGlobalRef.current = false;
        setIsLoadingAnalytics(false);
        setIsLoadingExams(false);
      }
    },
    [
      fetchAllAttempts,
      isAttemptBlacklisted,
      loadDeletedBlacklistFromStorage,
      practiceExams
    ]
  );

  // TỰ ĐỘNG TẢI RIÊNG CHI TIẾT CÂU TRẢ LỜI THEO ID KHI GIÁO VIÊN BẤM XEM CHI TIẾT BẢNG ĐIỂM ĐỀ THI
  useEffect(() => {
    if (!azotaScoreViewModal.isOpen || azotaScoreViewModal.attempts.length === 0) return;

    const missingDetailIds = azotaScoreViewModal.attempts
      .filter((a: any) => a?.id && !a.answers && !a.userAnswers && !a.omr_raw_data)
      .map((a: any) => String(a.id))
      .slice(0, 50);

    if (missingDetailIds.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("exam_attempts")
          .select("id, answers, scanned_image_url")
          .in("id", missingDetailIds);

        if (cancelled || error || !Array.isArray(data) || data.length === 0) return;

        const detailMap = new Map<string, any>();
        data.forEach((row: any) => {
          if (row?.id) detailMap.set(String(row.id), row);
        });

        setAzotaScoreViewModal((prev) => ({
          ...prev,
          attempts: prev.attempts.map((att: any) => {
            const d = detailMap.get(String(att?.id));
            if (!d) return att;
            return {
              ...att,
              answers: d.answers || att.answers,
              userAnswers: d.answers || att.userAnswers,
              paper_scan_url: d.scanned_image_url || att.paper_scan_url
            };
          })
        }));
      } catch (err) {
        console.warn("Lỗi tải chi tiết bài thi theo ID:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [azotaScoreViewModal.isOpen]);

  const handleAddQuickStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickStudentForm.firstName.trim()) {
      alert("Vui lòng nhập Tên học sinh!");
      return;
    }

    const full_name = (
      quickStudentForm.lastName.trim() +
      " " +
      quickStudentForm.firstName.trim()
    ).trim();
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

  const loadStorageData = useCallback(
    async (forceSync: boolean = false) => {
      loadDeletedBlacklistFromStorage();

      try {
        const [courseRes, sessRes, notifRes] = await Promise.allSettled([
          supabase.from("courses").select("id, title, chapters, updated_at").limit(1),
          supabase
            .from("sessions")
            .select(
              "id, title, date, isoDate, shiftId, shiftName, timeSlot, meetingUrl, audience, target_mode, room, created_at"
            )
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("system_notifications")
            .select("id, title, content, type, createdAt, created_at")
            .order("created_at", { ascending: false })
            .limit(50),
        ]);

        if (courseRes.status === "fulfilled") {
          if (courseRes.value.error) {
            console.error("Supabase Error Details (courses):", courseRes.value.error);
          } else if (Array.isArray(courseRes.value.data) && courseRes.value.data.length > 0) {
            const row = courseRes.value.data[0];
            const loadedChapters = row.chapters || (row as any).data;
            if (Array.isArray(loadedChapters) && loadedChapters.length > 0) {
              setChapters(loadedChapters);
              if (typeof window !== "undefined") {
                try {
                  localStorage.setItem("edunexus_course_data", JSON.stringify(loadedChapters));
                } catch {}
              }
            }
          }
        }

        if (
          sessRes.status === "fulfilled" &&
          Array.isArray(sessRes.value.data) &&
          sessRes.value.data.length > 0
        ) {
          setOnlineSessions(sessRes.value.data);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(
                "edunexus_online_sessions",
                JSON.stringify(sessRes.value.data)
              );
            } catch (e) {}
          }
          const datesFromSessions = Array.from(
            new Set(sessRes.value.data.map((s: any) => s.date).filter(Boolean))
          );
          if (datesFromSessions.length > 0) setSessionDates(datesFromSessions as string[]);
        }

        if (
          notifRes.status === "fulfilled" &&
          Array.isArray(notifRes.value.data) &&
          notifRes.value.data.length > 0
        ) {
          setSysNotifications(notifRes.value.data);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(
                "edunexus_system_notifications",
                JSON.stringify(notifRes.value.data)
              );
            } catch (e) {}
          }
        }
      } catch (e) {
        console.error("Supabase Error Details (loadStorageData):", e);
      }

      await syncAdminGlobalData(forceSync);

      try {
        const savedAtt = localStorage.getItem("edunexus_attendance");
        if (savedAtt) setAttendanceRecords(JSON.parse(savedAtt));
      } catch (e) {}
    },
    [loadDeletedBlacklistFromStorage, syncAdminGlobalData]
  );

  // Chỉ chạy 1 lần duy nhất khi mount (Tránh re-run nhiều lần khi state thay đổi)
  const initialLoadDoneRef = useRef<boolean>(false);

  useEffect(() => {
    setMounted(true);
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      loadDeletedBlacklistFromStorage();
      loadStorageData(true);
    }

    const handlePopState = () => {
      if (typeof window !== "undefined") {
        const hash = window.location.hash.replace("#", "").trim();
        if (VALID_ADMIN_TABS.includes(hash)) {
          setActiveTab(hash);
        } else {
          setActiveTab("lessons");
        }
      }
    };

    const handleStorageEvent = () => {
      try {
        const savedAtt = localStorage.getItem("edunexus_attempts");
        if (savedAtt) {
          const parsed = JSON.parse(savedAtt);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAllAttempts(parsed.filter((a: any) => !isAttemptBlacklisted(a)));
          }
        }
      } catch {}
    };

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("storage", handleStorageEvent);

    const channel = supabase
      .channel("admin-realtime-global-sync")
      .on("broadcast", { event: "new_attempt" }, () => {
        syncAdminGlobalData(false);
        showToast("Đã có lượt nộp bài mới! Đang cập nhật...", "success");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_attempts" }, () =>
        syncAdminGlobalData(false)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () =>
        syncAdminGlobalData(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("storage", handleStorageEvent);
    };
  }, [
    loadDeletedBlacklistFromStorage,
    loadStorageData,
    syncAdminGlobalData,
    showToast,
    isAttemptBlacklisted
  ]);

  const savePracticeExams = async (newExams: any[]) => {
    if (!Array.isArray(newExams)) return;
    setPracticeExams(newExams);
    if (newExams.length > 0) {
      safeSavePracticeExamsToStorage(newExams);
    }
  };

  const handleChangeExamCategory = async (examId: string, newCategory: string) => {
    const updated = practiceExams.map((ex) =>
      ex.id === examId ? { ...ex, category: newCategory } : ex
    );
    await savePracticeExams(updated);
    try {
      await supabase.from("practice_exams").update({ category: newCategory }).eq("id", examId);
      showToast("Đã chuyển đề sang danh mục: " + newCategory, "success");
    } catch (e: any) {}
  };

  const handleRecalculateExamScores = async (examId: string, updatedSections: any[]) => {
    const answerKeyMap: Record<string, string> = {};
    let totalQuestions = 0;

    (updatedSections || []).forEach((sec) => {
      (sec.questions || []).forEach((q: any) => {
        totalQuestions++;
        const qId = q.id || "q_" + totalQuestions;
        answerKeyMap[qId] = String(q.correctAnswer || q.answer || "")
          .trim()
          .toUpperCase();
      });
    });

    if (totalQuestions === 0) return;

    const targetAttempts = (allAttempts || []).filter(
      (a) => a.quizId === examId || a.quiz_id === examId
    );
    if (targetAttempts.length === 0) return;

    const updatedList = [...allAttempts];

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
    showToast("Đã tự động chấm lại điểm cho " + targetAttempts.length + " lượt thi!", "success");
  };

  const handleOpenExamEditor = async (exam: any) => {
    try {
      showToast("Đang tải dữ liệu câu hỏi của đề thi...", "success");
      const { data, error } = await supabase
        .from("practice_exams")
        .select("*")
        .eq("id", exam.id)
        .limit(1);

      const fullExam =
        !error && Array.isArray(data) && data.length > 0 ? { ...exam, ...data[0] } : exam;
      setEditingExamData(fullExam);
      setUploadMode("practice");
      setTestFile(
        new File(["dummy"], String(fullExam?.title || "de_thi") + ".docx", {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        })
      );
    } catch (err) {
      setEditingExamData(exam);
      setUploadMode("practice");
      setTestFile(
        new File(["dummy"], String(exam?.title || "de_thi") + ".docx", {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        })
      );
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
      newChapters = newChapters.map((chap) =>
        chap?.id === createModal.chapterId
          ? {
              ...chap,
              lessons: [
                ...(chap.lessons || []),
                {
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
                },
              ],
            }
          : chap
      );
    }

    syncCoursesToSupabase(newChapters, createModal.type === "chapter" ? "chương" : "bài học");
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
    const newChapters = (chapters || []).map((chap) =>
      chap?.id === editLessonModal.chapterId
        ? {
            ...chap,
            lessons: (chap?.lessons || []).map((les: any) =>
              les?.id === editLessonModal.lesson.id ? { ...les, ...editLessonForm } : les
            ),
          }
        : chap
    );
    syncCoursesToSupabase(newChapters, "bài học");
    setEditLessonModal(null);
    showToast("Đã cập nhật thông tin bài học!", "success");
  };

  const handleDeleteLesson = async (chapterId: string, lessonId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa bài học này?")) return;
    const newChapters = (chapters || []).map((chap) => {
      if (chap?.id === chapterId) {
        return {
          ...chap,
          lessons: (chap?.lessons || []).filter((l: any) => l?.id !== lessonId)
        };
      }
      return chap;
    });
    syncCoursesToSupabase(newChapters, "bài học");
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
    const newChapters = (chapters || []).map((chap) => ({
      ...chap,
      lessons: (chap?.lessons || []).map((les: any) => {
        if (les?.id === resourceModal.lessonId) {
          return {
            ...les,
            [resourceModal.type]: [...(les[resourceModal.type] || []), newResource]
          };
        }
        return les;
      }),
    }));
    syncCoursesToSupabase(newChapters, "tài nguyên");
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
    const newChapters = (chapters || []).map((chap) => ({
      ...chap,
      lessons: (chap?.lessons || []).map((les: any) => {
        if (les?.id === boostModal) {
          return { ...les, extra_resources: [...(les.extra_resources || []), newBoost] };
        }
        return les;
      }),
    }));
    syncCoursesToSupabase(newChapters, "tài liệu tăng cường");
    setBoostModal(null);
    setBoostForm({ title: "", type: "video", url: "", note: "" });
    showToast("Đã thêm tài liệu tăng cường!", "success");
  };

  const handleAddDriveFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveLinkModal || !driveLinkForm.title.trim() || !driveLinkForm.url.trim()) return;
    const newItem = {
      id: "drive-" + Date.now(),
      title: driveLinkForm.title,
      url: driveLinkForm.url,
      is_quiz: false,
      is_drive_file: true
    };
    const newChapters = (chapters || []).map((chap) => ({
      ...chap,
      lessons: (chap?.lessons || []).map((les: any) => {
        if (les?.id === driveLinkModal.lessonId) {
          return {
            ...les,
            [driveLinkModal.type]: [...(les[driveLinkModal.type] || []), newItem]
          };
        }
        return les;
      }),
    }));
    syncCoursesToSupabase(newChapters, "file Google Drive");
    setDriveLinkModal(null);
    setDriveLinkForm({ title: "", url: "" });
    showToast("Đã đính kèm file Drive!", "success");
  };

  const handleDeleteResource = async (lessonId: string, resType: string, resId: string) => {
    if (!confirm("Xác nhận xóa tài nguyên này?")) return;

    if (
      viewResourcesModal &&
      viewResourcesModal.lessonId === lessonId &&
      viewResourcesModal.type === resType
    ) {
      setViewResourcesModal((prev: any) =>
        prev ? { ...prev, items: (prev.items || []).filter((i: any) => i?.id !== resId) } : null
      );
    }

    const newChapters = (chapters || []).map((chap) => ({
      ...chap,
      lessons: (chap?.lessons || []).map((les: any) =>
        les?.id === lessonId
          ? { ...les, [resType]: (les[resType] || []).filter((r: any) => r?.id !== resId) }
          : les
      ),
    }));

    syncCoursesToSupabase(newChapters, "tài nguyên");
    showToast("Đã xóa tài nguyên!", "success");
  };

  const handleEditResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editResourceModal || !editResourceForm.title.trim()) return;
    const newChapters = (chapters || []).map((chap) => ({
      ...chap,
      lessons: (chap?.lessons || []).map((les: any) => {
        if (les?.id === editResourceModal.lessonId) {
          return {
            ...les,
            [editResourceModal.type]: (les[editResourceModal.type] || []).map((r: any) =>
              r?.id === editResourceModal.item.id
                ? {
                    ...r,
                    title: editResourceForm.title,
                    url: editResourceForm.url || r.url,
                    type:
                      editResourceModal.type === "video_list" ? editResourceForm.type : r.type,
                  }
                : r
            )
          };
        }
        return les;
      }),
    }));
    syncCoursesToSupabase(newChapters, "tài liệu");
    setEditResourceModal(null);
    showToast("Đã cập nhật thông tin tài liệu!", "success");
  };

  const handleUpdateStudentStatus = async (
    studentId: string,
    status: "approved" | "rejected"
  ) => {
    const isApproved = status === "approved";

    setRegisteredStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? {
              ...s,
              approval_status: status,
              status: status,
              is_approved: isApproved,
            }
          : s
      )
    );

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_registered_students");
        if (saved) {
          const list = JSON.parse(saved);
          const updated = list.map((s: any) =>
            s.id === studentId
              ? {
                  ...s,
                  approval_status: status,
                  status: status,
                  is_approved: isApproved,
                }
              : s
          );
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

  const handleDeleteStudent = async (studentId: string) => {
    if (!confirm("Xác nhận xóa học sinh này khỏi hệ thống vĩnh viễn?")) return;

    setRegisteredStudents((prev) => prev.filter((s) => s.id !== studentId));

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
      try {
        await supabase.from("profiles").delete().eq("id", studentId);
      } catch {}
    }
  };

  const handleDeleteSession = async (sessionId: string, sessionTitle: string) => {
    if (!confirm('Bạn có chắc chắn muốn XÓA ca học "' + sessionTitle + '" khỏi hệ thống?')) {
      return;
    }
    try {
      await supabase.from("sessions").delete().eq("id", sessionId);
    } catch (err: any) {}

    const updatedSessions = onlineSessions.filter((s) => s.id !== sessionId);
    setOnlineSessions(updatedSessions);
    showToast('Đã xóa ca học "' + sessionTitle + '" thành công!', "success");
  };

  const handleDeleteAttendanceDate = async (dateToDelete: string) => {
    if (
      !confirm(
        'Bạn có chắc chắn muốn xóa cột ngày học "' + dateToDelete + '" khỏi bảng điểm danh?'
      )
    ) {
      return;
    }
    const updatedDates = sessionDates.filter((d) => d !== dateToDelete);
    setSessionDates(updatedDates);

    const updatedAtt = attendanceRecords.filter((a) => a.sessionDate !== dateToDelete);
    setAttendanceRecords(updatedAtt);

    const updatedSessions = onlineSessions.filter((s) => s.date !== dateToDelete);
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
      const shiftObj = STANDARD_SHIFTS.find((s) => s.id === newDateShift);
      if (shiftObj) {
        shiftTitle = shiftObj.name;
        finalTimeSlot = shiftObj.timeSlot;
      }
    }

    const nowIso = new Date().toISOString();
    const newSessionMeta: any = {
      id: "sess-" + Date.now(),
      title: newDateTitle.trim() || "Buổi học ngày " + displayDate,
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
    showToast(
      "Đã thêm ngày học " + displayDate + " (" + finalTimeSlot + ") thành công!",
      "success"
    );
  };

  const handleCreateOnlineSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionForm.title.trim() || !newSessionForm.meetingUrl.trim()) {
      return alert("Vui lòng nhập đầy đủ tiêu đề và link phòng học!");
    }
    const guideImgs = newSessionForm.guideImagesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
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
      guideImages:
        guideImgs.length > 0
          ? guideImgs
          : [
              "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80"
            ],
      created_at: nowIso,
      createdAt: nowIso,
    };

    const updatedSessions = [newSession, ...onlineSessions];
    setOnlineSessions(updatedSessions);

    if (!sessionDates.includes(dispDate)) {
      setSessionDates([...sessionDates, dispDate]);
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
    showToast(
      "Đã phát link buổi học (" + dispDate + " • " + finalTimeSlot + ") lên hệ thống thành công!",
      "success"
    );
  };

  const handleToggleAttendance = (
    studentId: string,
    studentName: string,
    sessionDate: string
  ) => {
    const existing = attendanceRecords.find(
      (a) => a.studentId === studentId && a.sessionDate === sessionDate
    );
    let updated: any[];
    if (existing && existing.status === "present") {
      updated = attendanceRecords.filter(
        (a) => !(a.studentId === studentId && a.sessionDate === sessionDate)
      );
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
      updated = [
        ...attendanceRecords.filter(
          (a) => !(a.studentId === studentId && a.sessionDate === sessionDate)
        ),
        newRec
      ];
      showToast("Đã tích có mặt cho " + studentName + " ngày " + sessionDate + "!", "success");
    }
    setAttendanceRecords(updated);
  };

  const handleSaveSolutionVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoModalExam) return;
    const newExams = (practiceExams || []).map((ex) =>
      ex?.id === videoModalExam.id
        ? { ...ex, solutionVideoUrl: solutionVideoInput.trim() }
        : ex
    );
    await savePracticeExams(newExams);
    try {
      await supabase
        .from("practice_exams")
        .update({ solutionVideoUrl: solutionVideoInput.trim() })
        .eq("id", videoModalExam.id);
    } catch {}
    setVideoModalExam(null);
    setSolutionVideoInput("");
    showToast("Đã lưu Video chữa bài thành công!", "success");
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifContent.trim()) return;
    const newNotif = {
      id: "sys-" + Date.now(),
      title: notifTitle,
      content: notifContent,
      type: notifType,
      createdAt: new Date().toISOString()
    };
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
    const updated = (sysNotifications || []).filter((n) => n?.id !== id);
    setSysNotifications(updated);
    try {
      await supabase.from("system_notifications").delete().eq("id", id);
    } catch {}
  };

  const effectiveStudentsWithRecovery = useMemo(() => {
    if (Array.isArray(registeredStudents) && registeredStudents.length > 0) {
      return registeredStudents;
    }
    const recoveredMap = new Map<string, any>();
    (allAttempts || []).forEach((att: any) => {
      if (!att) return;
      const sId = String(att.studentId || att.student_id || att.user_id || "").trim();
      const sName = String(att.studentName || att.student_name || att.full_name || "").trim();
      if (sId && sName && !recoveredMap.has(sId)) {
        recoveredMap.set(
          sId,
          normalizeStudentProfile({
            id: sId,
            full_name: sName,
            school: att.school || "THPT",
            learning_mode: "offline",
            approval_status: "approved"
          })
        );
      }
    });
    return Array.from(recoveredMap.values());
  }, [registeredStudents, allAttempts]);

  const analyticsData = useMemo(() => {
    const profileMap = new Map<string, any>();
    (effectiveStudentsWithRecovery || []).forEach((s) => {
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
    (effectiveStudentsWithRecovery || []).forEach((s) => {
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

    (allAttempts || []).forEach((att) => {
      if (!att || isAttemptBlacklisted(att)) return;

      const attQuizId = String(att.quizId || att.quiz_id || att.exam_id || "")
        .trim()
        .toLowerCase();
      const attTitle = normalizeText(att.examTitle || att.quizTitle || att.title || "");

      let isScopeMatched = true;
      let matchedAsHw = false;
      let matchedAsTest = false;

      if (rankingScope !== "course") {
        const matchHw =
          (attQuizId && validHwIds.has(attQuizId)) ||
          (attTitle && validTitles.has(attTitle));
        const matchTest =
          (attQuizId && validTestIds.has(attQuizId)) ||
          (attTitle && validTitles.has(attTitle));

        if (!matchHw && !matchTest) {
          isScopeMatched = false;
        } else {
          matchedAsHw = matchHw;
          matchedAsTest = matchTest;
        }
      }

      if (!isScopeMatched) return;

      const attStuId = String(att.studentId || att.student_id || att.user_id || "")
        .trim()
        .toLowerCase();
      const rawAttName = String(
        att.studentName || att.student_name || att.full_name || ""
      ).trim();

      const matchedProfile =
        profileMap.get(attStuId) ||
        (rawAttName ? profileMap.get(rawAttName.toLowerCase()) : null);

      const targetId = matchedProfile ? matchedProfile.id : attStuId;
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
            const hwAvg =
              st.hwScores.reduce((a: number, b: number) => a + b, 0) / st.hwScores.length;
            const testAvg =
              st.testScores.reduce((a: number, b: number) => a + b, 0) / st.testScores.length;
            overallAvg = (hwAvg + testAvg) / 2;
          } else if (allScores.length > 0) {
            overallAvg =
              allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length;
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
    effectiveStudentsWithRecovery,
    analyticsModeFilter,
    rankingScope,
    selectedChapterId,
    selectedLessonId,
    chapters,
    isAttemptBlacklisted,
  ]);

  const getVietnameseLastName = (fullName: string): string => {
    if (!fullName) return "";
    const parts = fullName.trim().split(/\s+/);
    return parts[parts.length - 1] || "";
  };

  const sortedAndFilteredStudents = useMemo(() => {
    let list = Array.isArray(effectiveStudentsWithRecovery)
      ? [...effectiveStudentsWithRecovery]
      : [];

    if (attendanceSearchText.trim()) {
      const q = attendanceSearchText.toLowerCase();
      list = list.filter(
        (s) =>
          (s.full_name || "").toLowerCase().includes(q) ||
          (s.email || "").toLowerCase().includes(q)
      );
    }

    if (attendanceFilterMode !== "all") {
      list = list.filter(
        (s) =>
          s.learning_mode === attendanceFilterMode || s.study_mode === attendanceFilterMode
      );
    }

    if (attendanceSortAZ) {
      list.sort((a, b) => {
        const lastA = getVietnameseLastName(a.full_name);
        const lastB = getVietnameseLastName(b.full_name);
        const cmp = lastA.localeCompare(lastB, "vi", { sensitivity: "base" });
        if (cmp !== 0) return cmp;
        return (a.full_name || "").localeCompare(b.full_name || "", "vi", {
          sensitivity: "base"
        });
      });
    }

    return list;
  }, [
    effectiveStudentsWithRecovery,
    attendanceSearchText,
    attendanceFilterMode,
    attendanceSortAZ
  ]);

  const examsWithScoresData = useMemo(() => {
    let list = Array.isArray(practiceExams) ? [...practiceExams] : [];
    if (practiceCategoryFilter !== "Tất cả danh mục") {
      list = list.filter((ex) => ex?.category === practiceCategoryFilter);
    }

    return list.map((ex) => {
      const exId = String(ex?.id || "").trim();
      const exTitleNorm = normalizeText(ex?.title);

      const attempts = (allAttempts || []).filter((a) => {
        if (!a || isAttemptBlacklisted(a)) return false;
        const aQuizId = String(a.quizId || a.quiz_id || a.exam_id || "").trim();
        const aTitleNorm = normalizeText(a.examTitle || a.exam_title || a.title);
        return (
          (aQuizId && exId && aQuizId === exId) ||
          (exTitleNorm && aTitleNorm && exTitleNorm === aTitleNorm)
        );
      });

      const studentMap = new Map();
      attempts.forEach((att) => {
        const key = att.studentId || att.student_id || att.studentName;
        const prev = studentMap.get(key);
        if (!prev || Number(att.score || 0) > Number(prev.score || 0)) {
          studentMap.set(key, att);
        }
      });

      const scores = attempts.map((a) => Number(a.score || 0));
      const avgScore =
        scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
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
  }, [practiceExams, practiceCategoryFilter, allAttempts, isAttemptBlacklisted]);

  const handleSaveAzotaExam = async (examData: any) => {
    if (uploadMode === "practice") {
      const examId = editingExamData ? editingExamData.id : "prac-" + Date.now();
      const title = examData.title || "Đề luyện thi mới";
      const category = examData.category || "Tự do";
      const duration = Number(examData.duration_minutes) || 45;
      const targetMode = examData.target_mode || (editingExamData?.target_mode ?? "all");
      const allowRetake = editingExamData ? editingExamData.allowRetake ?? true : true;
      const allowViewFile = editingExamData ? editingExamData.allowViewFile ?? true : true;
      const driveUrl = examData.driveUrl || (editingExamData?.driveUrl ?? "");
      const solutionVideoUrl =
        examData.solutionVideoUrl || (editingExamData?.solutionVideoUrl ?? "");
      const rawSections = examData.sections || examData.data || [];
      const incomingMediaMap =
        examData.mediaMap ||
        examData.media_map ||
        editingExamData?.media_map ||
        editingExamData?.mediaMap ||
        {};

      try {
        setPracticeSyncStatus({
          isSyncing: true,
          progress: 35,
          message: "Đang tải toàn bộ ảnh lên Storage đám mây...",
          type: "loading"
        });

        const urlMap = new Map<string, string>();
        let uploadedCount = 0;

        const cleanedMediaMap = await sanitizeAndUploadAllMediaRecursively(
          incomingMediaMap,
          supabase,
          urlMap,
          examId,
          () => {
            uploadedCount++;
            setPracticeSyncStatus({
              isSyncing: true,
              progress: Math.min(75, 35 + uploadedCount * 2),
              message: `Đang tải ảnh #${uploadedCount} lên Storage...`,
              type: "loading"
            });
          }
        );

        const sanitizedSections = await sanitizeAndUploadAllMediaRecursively(
          rawSections,
          supabase,
          urlMap,
          examId,
          () => {
            uploadedCount++;
            setPracticeSyncStatus({
              isSyncing: true,
              progress: Math.min(78, 35 + uploadedCount * 2),
              message: `Đang tải ảnh #${uploadedCount} lên Storage...`,
              type: "loading"
            });
          }
        );

        const nowIso = new Date().toISOString();
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
          data: sanitizedSections,
          sections: sanitizedSections,
          media_map: cleanedMediaMap,
          mediaMap: cleanedMediaMap,
          created_at: editingExamData?.created_at || nowIso,
          updated_at: nowIso
        };

        const dbExamRow = {
          id: examId,
          title: title,
          category: category,
          duration_minutes: duration,
          allowRetake: allowRetake ?? true,
          allowViewFile: allowViewFile ?? true,
          driveUrl: driveUrl || "",
          solutionVideoUrl: solutionVideoUrl || "",
          data: sanitizedSections,
          media_map: cleanedMediaMap,
          created_at: payloadExam.created_at
        };

        setPracticeSyncStatus({
          isSyncing: true,
          progress: 85,
          message: "Đang lưu cấu trúc đề thi vào cơ sở dữ liệu...",
          type: "loading"
        });

        let saved = false;
        if (supabase) {
          const { error: sbErr } = await supabase.from("practice_exams").upsert(payloadExam);
          if (!sbErr) {
            saved = true;
          } else {
            const { error: sbRetryErr } = await supabase.from("practice_exams").upsert(dbExamRow);
            if (!sbRetryErr) {
              saved = true;
            }
          }
        }

        if (!saved) {
          const res = await fetch("/api/admin/data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "save_practice_exam", examData: payloadExam })
          });
          if (res.ok) saved = true;
        }

        const updatedList = editingExamData
          ? (practiceExams || []).map((ex: any) => (ex.id === examId ? payloadExam : ex))
          : [payloadExam, ...(practiceExams || [])];
        setPracticeExams(updatedList);
        safeSavePracticeExamsToStorage(updatedList);

        if (editingExamData) {
          handleRecalculateExamScores(examId, sanitizedSections);
        }

        setPracticeSyncStatus({
          isSyncing: false,
          progress: 100,
          message: "✓ Đã lưu đề thi thành công!",
          type: "success"
        });
        showToast("Đã lưu đề thi thành công!", "success");

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
      if (!azotaTarget) return;
      const isHw = azotaTarget.type === "homework_files";
      const targetLessonId = azotaTarget.lessonId;
      const targetType = azotaTarget.type;

      setTestFile(null);
      setEditingExamData(null);
      setAzotaTarget(null);

      const newExam = {
        id: "exam-" + Date.now(),
        title: examData.title || (isHw ? "Bài BTVN" : "Kiểm tra"),
        isHomework: isHw,
        duration_minutes: isHw ? 0 : examData.duration_minutes || 45,
        is_quiz: true,
        data: examData.sections || examData.data || [],
        sections: examData.sections || examData.data || [],
        mediaMap: examData.mediaMap || examData.media_map || {},
        media_map: examData.mediaMap || examData.media_map || {},
        created_at: new Date().toISOString()
      };

      const newChapters = (latestChaptersRef.current || []).map((chap) => ({
        ...chap,
        lessons: (chap?.lessons || []).map((les: any) => {
          if (les?.id === targetLessonId) {
            return { ...les, [targetType]: [newExam, ...(les[targetType] || [])] };
          }
          return les;
        })
      }));

      await syncCoursesToSupabase(newChapters, isHw ? "bài tập về nhà" : "đề kiểm tra");
      showToast("Đã nạp đề vào bài học thành công!", "success");
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex bg-[#F8FAFC] font-sans text-slate-800 relative">
        <aside className="hidden lg:flex w-64 bg-[#1E40AF] border-r border-[#1E40AF] text-white/90 flex-col shrink-0 p-5">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white text-[#1E40AF] rounded-[14px] flex items-center justify-center font-black text-sm shadow-md">
              TCT
            </div>
            <div>
              <h1 className="font-extrabold text-[15px] text-white tracking-tight leading-none">
                TÂM CHÍ TÀI
              </h1>
              <p className="text-[9px] text-blue-200 font-bold tracking-widest mt-1 uppercase">
                Admin Panel
              </p>
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
    <div className="min-h-screen w-full flex bg-[#F8FAFC] font-sans text-slate-800 relative selection:bg-blue-500/20 overflow-x-hidden">
      <AnimatePresence>
        {toastNotification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={
              "fixed top-5 right-5 z-[500] px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-bold text-sm text-white " +
              (toastNotification.type === "success" ? "bg-emerald-600" : "bg-rose-600")
            }
          >
            {toastNotification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertCircle className="w-5 h-5" />
            )}
            {toastNotification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {!isDesktopSidebarCollapsed && (
        <div className="hidden lg:block shrink-0">
          <AdminSidebar
            activeTab={activeTab as any}
            onSwitchTab={handleSwitchTab}
            onLogout={handleAdminLogout}
          />
        </div>
      )}

      <AnimatePresence>
        {isMobileSidebarOpen && (
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 z-[480] bg-slate-950/60 backdrop-blur-xs lg:hidden flex"
          >
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
              className="relative h-full flex"
            >
              <AdminSidebar
                activeTab={activeTab as any}
                onSwitchTab={handleSwitchTab}
                onLogout={handleAdminLogout}
              />
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(false)}
                className="absolute top-3 right-3 p-2 rounded-xl bg-blue-900/80 text-white hover:bg-rose-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col min-w-0 w-full min-h-screen lg:h-screen overflow-hidden">
        <div className="bg-white border-b border-slate-200 px-3 sm:px-5 py-2 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 cursor-pointer flex items-center gap-1.5 text-xs font-extrabold"
            >
              <Menu className="w-4 h-4 text-[#1D4ED8]" />
              <span>Menu</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDesktopSidebarCollapsed((prev) => !prev)}
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
            >
              {isDesktopSidebarCollapsed ? (
                <>
                  <PanelLeftOpen className="w-4 h-4 text-[#1D4ED8]" />
                  <span>Mở Menu</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4 text-slate-500" />
                  <span>Thu gọn Menu</span>
                </>
              )}
            </button>

            <span className="text-xs font-black text-slate-800 sm:hidden truncate">
              Tâm Chí Tài (TCT) Admin
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("paper-exams");
                setIsBulkOmrScannerOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>📷 Camera Chấm OMR</span>
            </button>
          </div>
        </div>

        <AdminHeader
          activeTab={activeTab as any}
          onSyncData={async () => {
            await loadStorageData(true);
            showToast("Đã đồng bộ dữ liệu tối ưu từ Server!", "success");
          }}
        />

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 custom-scrollbar bg-slate-50/30">
          {activeTab === "lessons" && (
            <div className="space-y-4">
              {!syncStatus.isSyncing && syncStatus.type === "idle" && (
                <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs text-slate-500 shadow-2xs">
                  <div className="flex items-center gap-2 font-medium">
                    <Cloud className="w-4 h-4 text-slate-400" />
                    <span>Hệ thống sẵn sàng: Chế độ tiết kiệm băng thông Egress đang bật</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-bold text-emerald-600 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Máy chủ hoạt động</span>
                  </div>
                </div>
              )}

              {syncStatus.isSyncing && syncStatus.type === "loading" && (
                <div className="bg-blue-50/90 border-2 border-blue-400 p-3.5 rounded-2xl shadow-sm flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      <span>
                        {syncStatus.message ||
                          `Đang xử lý & đăng tải dữ liệu: [ ${syncStatus.progress}% ]`}
                      </span>
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
                <div className="bg-emerald-50 border-2 border-emerald-400 p-3 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-900 shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      {syncStatus.message || "✓ Đã đăng tải và đồng bộ thành công! (100%)"}
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-300">
                    Hoàn tất
                  </span>
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
                onUpdateChapters={syncCoursesToSupabase}
                saveToStorage={syncCoursesToSupabase}
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
              registeredStudents={effectiveStudentsWithRecovery || []}
              chapters={chapters || []}
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

          {activeTab === "paper-exams" && (
            <PaperExamManagerTab
              chapters={chapters || []}
              practiceExams={practiceExams || []}
              registeredStudents={effectiveStudentsWithRecovery || []}
              allAttempts={allAttempts || []}
              setAllAttempts={setAllAttempts}
              showToast={showToast}
              onOpenBulkScannerModal={(selectedQuiz) => {
                setBulkOmrScannerQuiz(selectedQuiz || null);
                setIsBulkOmrScannerOpen(true);
              }}
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
              allAttempts={allAttempts || []}
              registeredStudents={effectiveStudentsWithRecovery || []}
              practiceExams={practiceExams || []}
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
              registeredStudents={effectiveStudentsWithRecovery || []}
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
              registeredStudents={effectiveStudentsWithRecovery || []}
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
            <AdminStudentReportPanel
              registeredStudents={effectiveStudentsWithRecovery || []}
              allAttempts={allAttempts || []}
              chapters={chapters || []}
              practiceExams={practiceExams || []}
              attendanceRecords={attendanceRecords || []}
            />
          )}
        </div>
      </main>

      <AdminBulkOMRScannerModal
        isOpen={isBulkOmrScannerOpen}
        onClose={() => setIsBulkOmrScannerOpen(false)}
        initialSelectedQuiz={bulkOmrScannerQuiz}
        chapters={chapters || []}
        practiceExams={practiceExams || []}
        registeredStudents={effectiveStudentsWithRecovery || []}
        showToast={showToast}
        onSavedSuccess={() => syncAdminGlobalData(true)}
        onSavedBatchAttempts={(newAttempts) => {
          setAllAttempts((prev: any[]) => {
            const newIds = new Set(newAttempts.map((x: any) => String(x?.id)));
            const filteredPrev = (prev || []).filter(
              (item: any) => !newIds.has(String(item?.id))
            );
            const merged = [...newAttempts, ...filteredPrev];
            if (typeof window !== "undefined") {
              try {
                localStorage.setItem("edunexus_attempts", JSON.stringify(merged));
                window.dispatchEvent(new Event("storage"));
              } catch {}
            }
            return merged;
          });
        }}
      />

      <AdminModals
        azotaScoreViewModal={azotaScoreViewModal}
        setAzotaScoreViewModal={setAzotaScoreViewModal}
        registeredStudents={effectiveStudentsWithRecovery || []}
        practiceExams={practiceExams || []}
        allAttempts={allAttempts || []}
        setAllAttempts={setAllAttempts}
        onDeleteAttemptPermanent={handleAttemptDeleted}
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
        onUpdateChapters={syncCoursesToSupabase}
        saveToStorage={syncCoursesToSupabase}
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

class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
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
            <h2 className="text-xl font-extrabold text-slate-900 mb-2">
              Đã phát hiện lỗi trong bảng điều khiển
            </h2>
            <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-4 font-mono text-xs text-rose-800 overflow-x-auto whitespace-pre-wrap max-h-60 custom-scrollbar mb-6">
              {this.state.error?.toString() || "Lỗi không xác định"}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Tải lại trang ngay
            </button>
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
