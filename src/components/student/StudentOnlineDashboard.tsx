"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/student/Sidebar";
import { Header } from "@/components/student/Header";
import { StudentLeaderboardView } from "@/components/student/StudentLeaderboardView";
import ScheduleView from "@/components/student/ScheduleView";
import { ExamRoomView } from "@/components/student/ExamRoomView";
import { LessonWorkspaceView } from "@/components/student/LessonWorkspaceView";
import PracticeExamWorkspace from "@/components/student/PracticeExamWorkspace";
import { Profile } from "@/types";
import { supabase } from "@/lib/supabaseClient";
import { useAutoSyncAttempts } from "@/hooks/useAutoSyncAttempts";
import { 
  Target, BookOpen, Play, CheckCircle2, Award, Sparkles, Clock, 
  Calendar, Edit3, Check, Quote, Layers, FileText, X, ArrowLeft, 
  Bell, AlertTriangle, MessageSquare, ArrowRight, Library, BarChart3, 
  ListOrdered, Video, MapPin, Users, CheckSquare, Trash2, Plus,
  ChevronDown, ChevronUp, BookMarked, HelpCircle
} from "lucide-react";

const MOTIVATIONAL_QUOTES = [
  "Học tập không phải là con đường duy nhất để thành công, nhưng là con đường ngắn nhất để chinh phục tri thức.",
  "Thành công lớn nhất không phải là không bao giờ vấp ngã, mà là đứng dậy sau mỗi lần vấp ngã.",
  "Kiên trì mỗi ngày một chút, đỉnh cao thủ khoa kỳ thi Tốt nghiệp THPT và ĐGNL sẽ thuộc về bạn.",
  "Toán học và tư duy logic là chìa khóa mở ra cánh cửa tương lai rộng mở."
];

const DEFAULT_CHAPTERS = [
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

const VALID_TABS = ["overview", "courses", "practice", "schedule", "progress", "assessments", "leaderboard", "notifications"];

function normalizeStr(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

interface StudentOnlineDashboardProps {
  initialProfile?: Profile | null;
  onLogout?: () => void;
}

function StudentOnlineDashboard({ initialProfile, onLogout }: StudentOnlineDashboardProps) {
  const [profile, setProfile] = useState<Profile | null>(() => {
    if (initialProfile) return { ...initialProfile, learning_mode: "online", study_mode: "online" };
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("tct_current_user") || localStorage.getItem("edunexus_current_user");
        if (saved) return { ...JSON.parse(saved), learning_mode: "online", study_mode: "online" };
      } catch (e) {}
    }
    return null;
  });

  // TÍCH HỢP HOOK ĐỒNG BỘ NGẦM LỊCH SỬ THI KHÔNG GÂY LAG
  useAutoSyncAttempts(profile);

  useEffect(() => {
    if (initialProfile) {
      setProfile({ ...initialProfile, learning_mode: "online", study_mode: "online" });
    }
  }, [initialProfile]);

  // 1. ĐỒNG BỘ TAB TỪ URL HASH & HIỆU ỨNG LOADING CHUYỂN TAB
  const [activeTab, setActiveTabState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "").trim();
      if (VALID_TABS.includes(hash)) return hash;
    }
    return "overview";
  });

  const [isTabChanging, setIsTabChanging] = useState<boolean>(false);

  const setActiveTab = useCallback((newTab: string) => {
    if (newTab === activeTab) return;
    setIsTabChanging(true);
    setActiveTabState(newTab);
    if (typeof window !== "undefined") {
      window.history.pushState({ tab: newTab }, "", "#" + newTab);
    }
    setTimeout(() => {
      setIsTabChanging(false);
    }, 280);
  }, [activeTab]);

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // 2. KHỞI TẠO TỨC THÌ TỪ LOCALSTORAGE TRÁNH GIẬT TRANG
  const [chapters, setChapters] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_course_data");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_CHAPTERS;
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

  const [practiceExams, setPracticeExams] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_practice_exams");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
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
      } catch (e) {}
    }
    return [];
  });

  const [selectedPracticeCategory, setSelectedPracticeCategory] = useState("Tất cả đề");
  const [practiceSubTab, setPracticeSubTab] = useState<"list" | "history">("list");
  const [historyModalExamId, setHistoryModalExamId] = useState<string | null>(null);

  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});
  const toggleChapterCollapse = (chapId: string) => {
    setCollapsedChapters(prev => ({ ...prev, [chapId]: !prev[chapId] }));
  };

  const [studyGoal, setStudyGoal] = useState<string>(() => { 
    return typeof window !== "undefined" ? localStorage.getItem("edunexus_study_goal") || "Chinh phục 9.5+ Toán & Kỳ thi ĐGNL/TSA" : ""; 
  });
  const [isEditingGoal, setIsEditingGoal] = useState<boolean>(false);
  const [tempGoal, setTempGoal] = useState<string>(studyGoal);
  const [dailyQuote, setDailyQuote] = useState<string>("");
  const [totalStudySeconds, setTotalStudySeconds] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return parseInt(localStorage.getItem("edunexus_study_time_" + (initialProfile?.id || "default")) || "0", 10);
    }
    return 0;
  });
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const [examRoom, setExamRoom] = useState<{ id: string; title: string; duration: number; isHomework: boolean } | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<any | null>(null);
  const [previewExam, setPreviewExam] = useState<any | null>(null); 
  const [selectedSysNotif, setSelectedSysNotif] = useState<any | null>(null);
  const [workspacePracticeExam, setWorkspacePracticeExam] = useState<any | null>(null);

  // 3. ĐỒNG BỘ NỀN TỪ SUPABASE
  const fetchAuthAndData = useCallback(async () => {
    try {
      const { data: courseRow } = await supabase
        .from("courses")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (courseRow && courseRow.chapters && Array.isArray(courseRow.chapters) && courseRow.chapters.length > 0) {
        setChapters(courseRow.chapters);
        if (typeof window !== "undefined") {
          localStorage.setItem("edunexus_course_data", JSON.stringify(courseRow.chapters));
        }
      }
    } catch (e) {}

    try {
      setIsLoadingExams(true);
      const { data: dbExams } = await supabase
        .from("practice_exams")
        .select("*")
        .order("created_at", { ascending: false });

      if (dbExams && Array.isArray(dbExams)) {
        setPracticeExams(dbExams);
        if (typeof window !== "undefined") {
          localStorage.setItem("edunexus_practice_exams", JSON.stringify(dbExams));
        }
      }
    } catch (e) {} finally {
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
          localStorage.setItem("edunexus_system_notifications", JSON.stringify(dbNotifs));
        }
      }
    } catch (e) {}

    if (typeof window !== "undefined") {
      try {
        const savedAttempts = localStorage.getItem("edunexus_attempts");
        if (savedAttempts) setAllAttempts(JSON.parse(savedAttempts));
      } catch (e) {}

      const studySecs = parseInt(localStorage.getItem("edunexus_study_time_" + (profile?.id || "default")) || "0", 10);
      setTotalStudySeconds(studySecs);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchAuthAndData();
    setDailyQuote(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);

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

    const channel = supabase
      .channel("student-online-global-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "courses" }, () => fetchAuthAndData())
      .on("postgres_changes", { event: "*", schema: "public", table: "practice_exams" }, () => fetchAuthAndData())
      .on("postgres_changes", { event: "*", schema: "public", table: "system_notifications" }, () => fetchAuthAndData())
      .subscribe();

    return () => { 
      supabase.removeChannel(channel);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("storage", fetchAuthAndData); 
    };
  }, [fetchAuthAndData]);

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
    const savedReads = localStorage.getItem("edunexus_read_notifs_" + (profile?.id || "default"));
    if (savedReads) setReadNotifIds(JSON.parse(savedReads));
  }, [profile?.id]);

  useEffect(() => {
    syncReadNotifs();
    window.addEventListener("readNotifsUpdated", syncReadNotifs);
    return () => window.removeEventListener("readNotifsUpdated", syncReadNotifs);
  }, [syncReadNotifs]);

  // 4. LỌC TOÀN BỘ BÀI NỘP CỦA HỌC SINH HIỆN TẠI (CHẤP NHẬN UUID, USERNAME, EMAIL PREFIX, TÊN HIỂN THỊ)
  const myAttempts = useMemo(() => {
    if (!profile) return [];
    const pId = String(profile.id || "").trim().toLowerCase();
    const pUser = String(profile.username || "").trim().toLowerCase();
    const pName = normalizeStr(profile.full_name || "");
    const pEmailPrefix = profile.email ? String(profile.email).split("@")[0].trim().toLowerCase() : "";

    return (allAttempts || []).filter(a => {
      if (!a) return false;
      const attStuId = String(a.studentId || a.student_id || a.user_id || "").trim().toLowerCase();
      const attName = normalizeStr(a.studentName || a.student_name || a.full_name || a.username || "");
      const attUser = String(a.username || "").trim().toLowerCase();

      if (pId && (attStuId === pId || attStuId.includes(pId))) return true;
      if (pUser && (attStuId === pUser || attUser === pUser || attName.includes(pUser))) return true;
      if (pEmailPrefix && (attStuId.includes(pEmailPrefix) || attUser.includes(pEmailPrefix))) return true;
      if (pName && attName && (attName === pName || attName.includes(pName) || pName.includes(attName))) return true;
      return false;
    });
  }, [allAttempts, profile]);

  const notificationsList = useMemo(() => {
    const combined: any[] = [];
    
    myAttempts.forEach(att => {
      const isPractice = att.type === "practice";
      combined.push({
        id: "score-" + (att.id || att.attemptId || Math.random()), 
        title: "Điểm kiểm tra mới", 
        desc: 'Bài "' + (att.quizTitle || att.examTitle || "Đề thi") + '" đạt kết quả: ' + att.score + '/10 điểm.', 
        type: "success", 
        timestamp: new Date(att.createdAt || att.created_at || att.submittedAt || Date.now()).getTime(), 
        dateStr: new Date(att.createdAt || att.created_at || att.submittedAt || Date.now()).toLocaleString("vi-VN"), 
        actionType: isPractice ? "practice_score" : "course_score", 
        quizId: att.quizId || att.quiz_id
      });
    });
    
    practiceExams.forEach(ex => {
      const exTime = ex.createdAt || ex.created_at ? new Date(ex.createdAt || ex.created_at).getTime() : Date.now() - 86400000;
      combined.push({
        id: "exam-" + ex.id, 
        title: "Đề thi thử mới cập nhật", 
        desc: 'Đề "' + ex.title + '" (' + ex.category + ') đã sẵn sàng luyện tập.', 
        type: "info", 
        timestamp: exTime, 
        dateStr: "Mới cập nhật", 
        actionType: "new_practice"
      });
    });
    
    sysNotifications.forEach(sys => {
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
    const allIds = notificationsList.map(n => n.id);
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
    } else if (item.actionType === "practice_score" || item.actionType === "new_practice") {
      setActiveTab("practice"); 
      setPracticeSubTab("history");
    }
  };

  const practiceHistoryGrouped = useMemo(() => {
    const myPracticeAttempts = myAttempts.filter(a => a.type === "practice" || (!a.is_homework && !a.isHomework));
    const grouped: Record<string, any> = {};
    myPracticeAttempts.forEach(att => {
      const qKey = att.quizId || att.quiz_id || att.exam_id;
      if (!qKey) return;
      if (!grouped[qKey]) {
        grouped[qKey] = {
          quizId: qKey,
          title: att.quizTitle || att.examTitle || "Đề thi",
          category: att.category || "Luyện đề",
          attempts: [],
          maxScore: 0,
          lastDate: 0
        };
      }
      grouped[qKey].attempts.push(att);
      grouped[qKey].maxScore = Math.max(grouped[qKey].maxScore, Number(att.score ?? att.points ?? 0));
      const attTime = new Date(att.createdAt || att.created_at || att.submittedAt || Date.now()).getTime();
      if (attTime > grouped[qKey].lastDate) {
        grouped[qKey].lastDate = attTime;
      }
    });
    Object.values(grouped).forEach(group => {
      group.attempts.sort((a: any, b: any) => new Date(a.createdAt || a.created_at || a.submittedAt).getTime() - new Date(b.createdAt || b.created_at || b.submittedAt).getTime());
    });
    return Object.values(grouped).sort((a, b) => b.lastDate - a.lastDate);
  }, [myAttempts]);

  const formatCompletionTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return s + " giây";
    return m + "p " + s + "s";
  };

  const onlineChapters = useMemo(() => {
    return (chapters || [])
      .map((chap: any) => ({
        ...chap,
        lessons: (chap.lessons || []).filter((les: any) => 
          !les?.target_mode || les?.target_mode === "online" || les?.target_mode === "all"
        )
      }))
      .filter((chap: any) => chap.lessons && chap.lessons.length > 0);
  }, [chapters]);

  const [onlineSessions, setOnlineSessions] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_online_sessions");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });
  const [onlineAttRecords, setOnlineAttRecords] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_attendance");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });
  const [onlineToast, setOnlineToast] = useState<string>("");

  const loadSessionsData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        setOnlineSessions(data);
        if (typeof window !== "undefined") {
          localStorage.setItem("edunexus_online_sessions", JSON.stringify(data));
        }
      }
    } catch {}

    if (typeof window !== "undefined") {
      try {
        const savedAtt = localStorage.getItem("edunexus_attendance");
        if (savedAtt) {
          const parsed = JSON.parse(savedAtt);
          if (Array.isArray(parsed)) setOnlineAttRecords(parsed);
        }
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    loadSessionsData();

    const channel = supabase
      .channel("realtime-student-online-sessions")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, () => {
        loadSessionsData();
      })
      .subscribe();

    window.addEventListener("storage", loadSessionsData);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("storage", loadSessionsData);
    };
  }, [loadSessionsData]);

  const parseTimeSlotMinutes = (timeSlot?: string): { startMinutes: number; endMinutes: number } | null => {
    if (!timeSlot || !timeSlot.includes("-")) return null;
    const parts = timeSlot.split("-").map(s => s.trim());
    if (parts.length < 2) return null;

    const parsePart = (str: string) => {
      const m = str.match(/(\d{1,2})[:h](\d{2})/i) || str.match(/(\d{1,2})/);
      if (!m) return null;
      const h = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      return h * 60 + min;
    };

    const start = parsePart(parts[0]);
    const end = parsePart(parts[1]);
    if (start === null || end === null) return null;
    return { startMinutes: start, endMinutes: end };
  };

  const isSameDate = (sessDate?: string, sessIsoDate?: string, targetDate: Date = new Date()): boolean => {
    const d = String(targetDate.getDate()).padStart(2, "0");
    const m = String(targetDate.getMonth() + 1).padStart(2, "0");
    const y = targetDate.getFullYear();
    const dStr = d + "/" + m;
    const isoStr = y + "-" + m + "-" + d;

    if (sessIsoDate && (sessIsoDate === isoStr || sessIsoDate.includes(isoStr))) return true;
    if (sessDate && (sessDate === dStr || sessDate.includes(dStr))) return true;
    return false;
  };

  const liveOnlineSession = useMemo(() => {
    if (!onlineSessions || onlineSessions.length === 0) return null;
    const now = currentTime;
    const curMinutes = now.getHours() * 60 + now.getMinutes();

    return onlineSessions.find((s: any) => {
      const tMode = (s.target_mode || s.audience || "all").toLowerCase();
      const isTarget = tMode === "online" || tMode === "all" || (s.meetingUrl && s.meetingUrl.trim() !== "");
      if (!isTarget) return false;
      if (!isSameDate(s.date, s.isoDate, now)) return false;
      const slot = parseTimeSlotMinutes(s.timeSlot);
      if (!slot) return false;
      return curMinutes >= slot.startMinutes - 15 && curMinutes <= slot.endMinutes;
    }) || null;
  }, [onlineSessions, currentTime]);

  const isOnlineLiveNow = useMemo(() => {
    if (!liveOnlineSession) return false;
    const slot = parseTimeSlotMinutes(liveOnlineSession.timeSlot);
    if (!slot) return false;
    const curMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    return curMinutes >= slot.startMinutes && curMinutes <= slot.endMinutes;
  }, [liveOnlineSession, currentTime]);

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

  const isAttendedTodayOnline = useMemo(() => {
    if (!profile || !liveOnlineSession) return false;
    const now = currentTime;
    return onlineAttRecords.some((a: any) => 
      a.studentId === profile.id && 
      (a.sessionId === liveOnlineSession.id || isSameDate(a.sessionDate, undefined, now)) && 
      (a.status === "present" || a.status === "auto_present")
    );
  }, [profile, liveOnlineSession, onlineAttRecords, currentTime]);

  const handleOnlineJoinMeeting = () => {
    if (!profile || !liveOnlineSession) return;
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    const dateStr = liveOnlineSession.date || (String(now.getDate()).padStart(2, "0") + "/" + String(now.getMonth() + 1).padStart(2, "0"));

    const newRecord = {
      id: "att-online-" + Date.now(),
      studentId: profile.id,
      studentName: profile.full_name,
      sessionDate: dateStr,
      status: "present",
      mode: "online_self",
      attendedAt: now.toISOString(),
      note: "Học sinh tham gia lớp học trực tuyến lúc " + timeStr
    };

    const updated = [
      ...onlineAttRecords.filter((a: any) => !(a.studentId === profile.id && (a.sessionDate === dateStr || isSameDate(a.sessionDate, undefined, now)))),
      newRecord
    ];
    setOnlineAttRecords(updated);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_attendance", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {}
    }

    if (liveOnlineSession.meetingUrl) {
      window.open(liveOnlineSession.meetingUrl, "_blank");
    }

    setOnlineToast("Đã tham gia phòng học và điểm danh lúc " + timeStr + "!");
    setTimeout(() => setOnlineToast(""), 4000);
  };

  // KIỂM TRA TRẠNG THÁI HOÀN THÀNH CỦA BÀI HỌC DỰA TRÊN LƯỢT LÀM BÀI
  const getLessonCompletionStatus = useCallback((lesson: any) => {
    const hwIds = (lesson.homework_files || []).map((h: any) => String(h.id || "").trim().toLowerCase()).filter(Boolean);
    const testIds = (lesson.test_quizzes || []).map((t: any) => String(t.id || "").trim().toLowerCase()).filter(Boolean);
    const targetIds = [...hwIds, ...testIds];

    if (targetIds.length === 0) return "in_progress";

    const doneCount = targetIds.filter(id => 
      myAttempts.some(a => {
        const aId = String(a.quizId || a.quiz_id || "").trim().toLowerCase();
        return aId === id;
      })
    ).length;

    if (doneCount === targetIds.length) return "completed";
    if (doneCount > 0) return "in_progress";
    return "not_started";
  }, [myAttempts]);

  // HÀM TRA CỨU BÀI LÀM ĐA TẦNG CHO BTVN VÀ BÀI KIỂM TRA (GIẢI QUYẾT TRIỆT ĐỂ LỖI TIẾN TRÌNH)
  const findAttemptForLesson = useCallback((quiz: any, lessonTitle: string, isHomeworkCheck: boolean) => {
    const qId = quiz?.id ? String(quiz.id).trim().toLowerCase() : "";
    const qTitle = quiz?.title ? normalizeStr(quiz.title) : "";
    const lesTitle = normalizeStr(lessonTitle);

    // Lấy số thứ tự bài học từ lessonTitle (ví dụ: "bài 8", "bai 8", "bài 4")
    const matchLessonNum = lesTitle.match(/b[aà]i\s*(\d+)/i);
    const lessonNumKey = matchLessonNum ? `bài ${matchLessonNum[1]}` : "";

    return (myAttempts || []).find(a => {
      const aQuizId = String(a.quizId || a.quiz_id || a.exam_id || "").trim().toLowerCase();
      const aTitle = normalizeStr(a.quizTitle || a.examTitle || a.title || "");
      const isHw = Boolean(a.isHomework || a.is_homework || a.type === "homework");

      // Khớp đúng phân loại BTVN hoặc Bài kiểm tra
      if (isHomeworkCheck && !isHw) return false;
      if (!isHomeworkCheck && isHw) return false;

      // 1. So khớp ID trực tiếp
      if (qId && aQuizId && aQuizId === qId) return true;

      // 2. So khớp ID không phân biệt tiền tố (exam-, prac-)
      const cleanQId = qId.replace(/^(exam-|prac-)/, "");
      const cleanAId = aQuizId.replace(/^(exam-|prac-)/, "");
      if (cleanQId && cleanAId && cleanQId === cleanAId) return true;

      // 3. So khớp theo tiêu đề bài tập
      if (qTitle && aTitle && (aTitle === qTitle || aTitle.includes(qTitle) || qTitle.includes(aTitle))) return true;

      // 4. So khớp theo tiêu đề bài học đầy đủ
      if (lesTitle && aTitle && (aTitle.includes(lesTitle) || lesTitle.includes(aTitle))) return true;

      // 5. So khớp theo số hiệu bài (ví dụ: đề nộp có chứa "bài 8" và bài học là "Đại-Bài 8: Đồ thị hàm số")
      if (lessonNumKey && aTitle.includes(lessonNumKey)) return true;

      return false;
    }) || null;
  }, [myAttempts]);

  // DỮ LIỆU TÍNH TOÁN TIẾN ĐỘ HỌC TẬP TAB #PROGRESS
  const progressStats = useMemo(() => {
    let totalHw = 0;
    let submittedHw = 0;
    let totalTest = 0;
    let completedTest = 0;

    onlineChapters.forEach((chap: any) => {
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

    return { totalHw, submittedHw, totalTest, completedTest, totalTasks, completedTasks, percent };
  }, [onlineChapters, findAttemptForLesson]);

  if (examRoom) {
    return (
      <ExamRoomView 
        quizId={examRoom.id} 
        quizTitle={examRoom.title} 
        durationMinutes={examRoom.duration} 
        profile={profile!} 
        isHomework={examRoom.isHomework} 
        onBackToDashboard={() => { 
          setExamRoom(null); 
          fetchAuthAndData(); 
        }} 
      />
    );
  }

  if (selectedLesson) {
    return (
      <LessonWorkspaceView 
        lesson={selectedLesson} 
        profile={profile} 
        onBackToCatalog={() => setSelectedLesson(null)} 
        onStartQuiz={(qId, qTitle, isHomework, durationMinutes) => { 
          setExamRoom({ id: qId, title: qTitle, duration: durationMinutes || 45, isHomework }); 
        }} 
      />
    );
  }

  if (workspacePracticeExam) {
    return (
      <PracticeExamWorkspace
        exam={workspacePracticeExam}
        profile={profile!}
        attempts={allAttempts.filter(a => a.studentId === profile?.id && (a.quizId === workspacePracticeExam.id || a.quiz_id === workspacePracticeExam.id))}
        onBack={() => setWorkspacePracticeExam(null)}
        onRetake={() => {
          const exam = workspacePracticeExam;
          setWorkspacePracticeExam(null);
          setExamRoom({ id: exam.id, title: exam.title, duration: exam.duration_minutes, isHomework: false });
        }}
        onViewFile={() => setPreviewExam(workspacePracticeExam)}
      />
    );
  }

  return (
    <div className="h-screen w-full bg-[#F8FAFC] antialiased text-slate-800 tracking-normal leading-relaxed flex overflow-hidden relative selection:bg-blue-500/20">
      <AnimatePresence>
        {onlineToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }} 
            className="fixed top-5 right-5 z-[500] bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 font-semibold text-xs sm:text-sm border border-emerald-400"
          >
            <CheckCircle2 className="w-4 h-4 text-white" /> {onlineToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* SIDEBAR BÊN TRÁI TINH TẾ */}
      <div 
        className={"h-full shrink-0 transition-[width,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden hidden md:block z-40 " + (
          isSidebarOpen ? "w-60 opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-10"
        )}
        style={{ willChange: "width, transform" }}
      >
        <div className="w-60 h-full">
          <Sidebar user={profile!} activeTab={activeTab} setActiveTab={setActiveTab} onToggleSidebar={() => setIsSidebarOpen(false)} onLogout={onLogout} />
        </div>
      </div>

      <div className="md:hidden">
        <Sidebar user={profile!} activeTab={activeTab} setActiveTab={setActiveTab} onToggleSidebar={() => {}} onLogout={onLogout} />
      </div>
      
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <div className="shrink-0 w-full">
          <Header 
            user={profile!} isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            activeTab={activeTab} setActiveTab={setActiveTab} searchQuery={searchQuery} onSearchChange={setSearchQuery}
            allAttempts={allAttempts} practiceExams={practiceExams} sysNotifications={sysNotifications}
          />
        </div>
        
        <main className="flex-1 p-3.5 sm:px-6 py-4 pb-20 md:pb-6 overflow-y-auto custom-scrollbar transition-all duration-300 ease-in-out w-full">
          {/* HIỆU ỨNG SKELETON LOADING KHI CHUYỂN TAB MƯỢT MÀ */}
          {isTabChanging ? (
            <div className="max-w-5xl mx-auto space-y-4 animate-pulse">
              <div className="h-14 bg-slate-200/70 rounded-xl w-full" />
              <div className="h-32 bg-slate-200/60 rounded-xl w-full" />
              <div className="space-y-2.5">
                <div className="h-12 bg-slate-200/50 rounded-xl w-full" />
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
                {/* TAB 1: TỔNG QUAN (#OVERVIEW) */}
                {activeTab === "overview" && (
                  <div className="w-full max-w-5xl mx-auto space-y-4 text-left">
                    {/* BANNER CA HỌC TRỰC TUYẾN LIVE ZOOM */}
                    {liveOnlineSession && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3.5 sm:px-4.5 rounded-xl bg-blue-600 text-white shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-blue-500"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 rounded-lg bg-white/20 text-white shrink-0">
                            <Video className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 text-left">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-100 flex items-center gap-1.5">
                              <span>{isOnlineLiveNow ? "BUỔI HỌC ĐANG DIỄN RA" : "SẮP BẮT ĐẦU BUỔI HỌC (TRƯỚC 15 PHÚT)"}</span>
                              <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-white text-[9px] font-semibold">LIVE</span>
                            </p>
                            <p className="text-xs sm:text-sm font-semibold text-white truncate">
                              {(liveOnlineSession.title || liveOnlineSession.subject) + " (" + liveOnlineSession.timeSlot + ")"}
                            </p>
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {isAttendedTodayOnline ? (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-100 font-semibold text-xs border border-emerald-400/30">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                                <span>Đã điểm danh ✓</span>
                              </span>
                              <button
                                type="button"
                                onClick={handleOnlineJoinMeeting}
                                className="px-3.5 py-1.5 bg-white text-blue-700 hover:bg-blue-50 font-semibold text-xs rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>Vào học</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={handleOnlineJoinMeeting}
                              className="px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 font-semibold text-xs rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5 fill-blue-700" />
                              <span>Vào học & Điểm danh</span>
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* THANH CHÀO MỪNG SLIM WELCOME BAR TINH GỌN */}
                    <div className="bg-white rounded-xl p-3.5 sm:px-4.5 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-[13.5px] font-semibold text-slate-800">
                          Chào <span className="text-blue-700">{profile?.full_name || "Học sinh"}</span>!
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1.5">
                          🎯 <span className="font-medium text-slate-700">{studyGoal}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5 text-xs text-slate-500">
                        <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-100">
                          {onlineChapters.length} Chương
                        </span>
                        <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" /> {formattedStudyTimeToday}
                        </span>
                      </div>
                    </div>

                    {/* DANH SÁCH BÀI HỌC CỘT DỌC ĐẦY ĐẶN, THOÁNG MẮT */}
                    <div className="space-y-3.5">
                      {onlineChapters.map((chap, idx) => (
                        <div key={chap.id || idx} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <h3 className="font-semibold text-slate-900 text-sm sm:text-[14.5px] flex items-center gap-2.5">
                              <span className="text-blue-700 font-semibold uppercase text-[10px] tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                Chương {idx + 1}
                              </span>
                              <span>{chap.title}</span>
                            </h3>
                            <span className="text-xs font-semibold text-slate-400">
                              {chap.lessons?.length || 0} bài học
                            </span>
                          </div>

                          <div className="flex flex-col space-y-2 pt-1">
                            {(chap.lessons || []).map((les: any) => (
                              <div 
                                key={les.id} 
                                onClick={() => setSelectedLesson(les)}
                                className="py-3 px-3.5 sm:px-4 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all flex items-center justify-between gap-3 cursor-pointer group"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                                  <span className="text-[13.5px] sm:text-sm font-medium text-slate-700 truncate group-hover:text-blue-700">
                                    {les.title}
                                  </span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 shrink-0 transition-transform group-hover:translate-x-0.5" />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 2: BÀI HỌC (#COURSES) */}
                {activeTab === "courses" && (
                  <div className="max-w-5xl mx-auto space-y-4 text-left">
                    <div className="bg-white rounded-xl p-3.5 sm:px-4.5 border border-slate-200/80 shadow-2xs space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-semibold uppercase tracking-wider border border-blue-100">
                            Lớp Online TCT
                          </span>
                          <span className="text-xs sm:text-[13px] font-semibold text-slate-800">
                            Học viên: <span className="text-blue-700">{profile?.full_name || "Học sinh"}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isEditingGoal ? (
                            <div className="flex items-center gap-1.5">
                              <input 
                                type="text" 
                                value={tempGoal} 
                                onChange={e => setTempGoal(e.target.value)} 
                                className="px-2.5 py-1 border border-blue-300 rounded text-xs font-semibold text-slate-800 focus:outline-none" 
                              />
                              <button 
                                onClick={handleSaveGoal} 
                                className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-semibold cursor-pointer"
                              >
                                Lưu
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-600 font-medium">🎯 {studyGoal}</span>
                              <button 
                                onClick={() => { setTempGoal(studyGoal); setIsEditingGoal(true); }}
                                className="text-slate-400 hover:text-blue-600 p-0.5 cursor-pointer" 
                                title="Sửa mục tiêu"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 italic border-t border-slate-100 pt-2 flex items-center gap-1.5">
                        <Quote className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>"{dailyQuote}"</span>
                      </p>
                    </div>

                    <div className="space-y-3.5 pt-1">
                      {onlineChapters.map((chap, idx) => {
                        const isCollapsed = Boolean(collapsedChapters[chap.id]);
                        const lessonCount = chap.lessons?.length || 0;

                        return (
                          <div key={chap.id || idx} className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                            <button
                              type="button"
                              onClick={() => toggleChapterCollapse(chap.id)}
                              className="w-full px-4.5 py-3.5 bg-slate-50/70 hover:bg-slate-50 border-b border-slate-100 flex items-center justify-between text-left transition cursor-pointer"
                            >
                              <div className="flex items-center gap-2.5">
                                <span className="text-blue-700 font-semibold uppercase text-[10px] tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                  Chương {idx + 1}
                                </span>
                                <h3 className="font-semibold text-slate-900 text-[13.5px] sm:text-sm">
                                  {chap.title}
                                </h3>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-400">
                                  {lessonCount} bài học
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
                                  const docCount = (les.lecture_files?.length || 0) + (les.homework_files?.length || 0);

                                  return (
                                    <div 
                                      key={les.id || lIdx}
                                      className="p-3.5 sm:p-4 hover:bg-slate-50/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
                                    >
                                      <div className="min-w-0 space-y-1.5">
                                        <div className="flex items-center gap-2">
                                          <h4 className="text-[14.5px] sm:text-[15.5px] font-semibold text-slate-800 truncate">
                                            {les.title}
                                          </h4>

                                          {status === "completed" ? (
                                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200 shrink-0 flex items-center gap-1">
                                              <Check className="w-2.5 h-2.5 stroke-[3]" /> Đã hoàn thành
                                            </span>
                                          ) : status === "in_progress" ? (
                                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200 shrink-0">
                                              Đang học
                                            </span>
                                          ) : (
                                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-medium shrink-0">
                                              Chưa học
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-3 text-xs text-slate-500 font-normal">
                                          <span className="flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-slate-400" /> {les.duration || 45} phút
                                          </span>
                                          <span>•</span>
                                          <span className="flex items-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5 text-slate-400" /> {docCount} tài liệu & BTVN
                                          </span>
                                        </div>
                                      </div>

                                      <div className="shrink-0 flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setSelectedLesson(les)}
                                          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-xs sm:text-[13px] shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
                                        >
                                          <span>Vào học</span>
                                          <ArrowRight className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB 3: LUYỆN ĐỀ (#PRACTICE) - TÍCH HỢP SKELETON UI */}
                {activeTab === "practice" && (
                  <div className="max-w-6xl mx-auto space-y-4 text-left">
                    <div className="bg-white py-3.5 px-4.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center shrink-0 border border-blue-100">
                          <Target className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h2 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">
                            Luyện đề
                          </h2>
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            {isLoadingExams ? "Đang tải đề thi..." : `${practiceExams.length} đề thi sẵn sàng`}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                        <button 
                          onClick={() => setPracticeSubTab("list")}
                          className={"px-3.5 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer " + (practiceSubTab === "list" ? "bg-white text-blue-700 shadow-2xs" : "text-slate-500 hover:text-slate-800")}
                        >
                          <Library className="w-3.5 h-3.5"/> Danh sách đề
                        </button>
                        <button 
                          onClick={() => setPracticeSubTab("history")}
                          className={"px-3.5 py-1.5 rounded-md text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer " + (practiceSubTab === "history" ? "bg-white text-blue-700 shadow-2xs" : "text-slate-500 hover:text-slate-800")}
                        >
                          <BarChart3 className="w-3.5 h-3.5"/> Lịch sử làm bài
                        </button>
                      </div>
                    </div>

                    {practiceSubTab === "list" && (
                      <div className="space-y-3.5">
                        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                          {["Tất cả đề", "ĐGNL HSA (ĐHQGHN)", "ĐGTD TSA (ĐHBK)", "Tốt Nghiệp THPT", "Giữa Kì 1", "Học Kì 1", "Giữa Kì 2", "Học Kì 2"].map(cat => (
                            <button 
                              key={cat}
                              onClick={() => setSelectedPracticeCategory(cat)}
                              className={"px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer " + (
                                selectedPracticeCategory === cat 
                                  ? "bg-blue-600 text-white shadow-2xs" 
                                  : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50"
                              )}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>

                        {/* HIỂN THỊ SKELETON LOADING KHI ĐANG FETCH ĐỀ */}
                        {isLoadingExams ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                              <div key={i} className="p-4 rounded-xl border border-slate-200/80 bg-white space-y-3 animate-pulse">
                                <div className="flex justify-between items-center">
                                  <div className="h-4 w-16 bg-slate-200 rounded-md" />
                                  <div className="h-3.5 w-12 bg-slate-100 rounded" />
                                </div>
                                <div className="h-4 w-3/4 bg-slate-200 rounded" />
                                <div className="h-3 w-1/3 bg-slate-100 rounded" />
                                <div className="pt-2 flex gap-2">
                                  <div className="h-8 w-1/4 bg-slate-100 rounded-lg" />
                                  <div className="h-8 flex-1 bg-slate-200 rounded-lg" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {(practiceExams || [])
                              .filter((e: any) => {
                                const tMode = (e.target_mode || "all").toLowerCase();
                                return tMode === "online" || tMode === "all";
                              })
                              .filter(e => selectedPracticeCategory === "Tất cả đề" || e.category === selectedPracticeCategory)
                              .filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()))
                              .map(exam => {
                                const canViewFile = exam.allowViewFile !== false;
                                const qCount = exam.data?.reduce((acc: number, sec: any) => acc + (sec.questions?.length || 0), 0) || 0;

                                return (
                                  <div key={exam.id} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs hover:border-blue-300 transition flex flex-col justify-between group">
                                    <div>
                                      <div className="flex justify-between items-center mb-2.5">
                                        <span className="text-[10px] font-semibold uppercase bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">
                                          {exam.category}
                                        </span>
                                        <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                                          <Clock className="w-3.5 h-3.5"/> {exam.duration_minutes}p
                                        </span>
                                      </div>
                                      <h3 className="text-sm font-semibold text-slate-800 line-clamp-1 group-hover:text-blue-700 transition">
                                        {exam.title}
                                      </h3>
                                      <p className="text-xs text-slate-400 font-normal mb-3.5">
                                        Số câu: {qCount} câu
                                      </p>
                                    </div>
                                    
                                    <div className="pt-2.5 border-t border-slate-100 flex items-center gap-2">
                                      {canViewFile && (
                                        <button 
                                          onClick={() => {
                                            if (exam.driveUrl && exam.driveUrl.trim() !== "") window.open(exam.driveUrl, "_blank");
                                            else setPreviewExam(exam);
                                          }}
                                          className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200 text-xs font-semibold transition"
                                          title="Xem file đề"
                                        >
                                          <FileText className="w-4 h-4"/>
                                        </button>
                                      )}
                                      
                                      <button
                                        onClick={() => setWorkspacePracticeExam(exam)}
                                        className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200 text-xs font-semibold transition"
                                        title="Video chữa bài"
                                      >
                                        <Video className="w-4 h-4"/>
                                      </button>

                                      <button 
                                        onClick={() => { setExamRoom({ id: exam.id, title: exam.title, duration: exam.duration_minutes, isHomework: false }); }}
                                        className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition flex items-center justify-center gap-1 cursor-pointer"
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

                    {practiceSubTab === "history" && (
                      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-4 font-semibold">Tên đề thi</th>
                                <th className="py-2.5 px-3 font-semibold text-center">Lượt làm</th>
                                <th className="py-2.5 px-3 font-semibold text-center">Điểm cao nhất</th>
                                <th className="py-2.5 px-3 font-semibold text-center">Lần cuối</th>
                                <th className="py-2.5 px-3 font-semibold text-right">Chi tiết</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {practiceHistoryGrouped.length === 0 ? (
                                <tr><td colSpan={5} className="py-8 text-center text-slate-400 italic">Bạn chưa hoàn thành đề thi nào.</td></tr>
                              ) : (
                                practiceHistoryGrouped.map((grp: any) => (
                                  <tr key={grp.quizId} className="hover:bg-slate-50/50 transition">
                                    <td className="py-2.5 px-4">
                                      <span className="font-semibold text-slate-800 block truncate max-w-xs">{grp.title}</span>
                                      <span className="text-[10px] font-semibold text-slate-400 uppercase">{grp.category}</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <span className="bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded text-xs">{grp.attempts.length} lần</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-100">
                                        {grp.maxScore.toFixed(1)}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-center text-slate-400 text-xs">
                                      {new Date(grp.lastDate).toLocaleDateString("vi-VN")}
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                      <button 
                                        onClick={() => setHistoryModalExamId(grp.quizId)}
                                        className="px-3 py-1 text-blue-700 hover:bg-blue-50 rounded text-xs font-semibold transition cursor-pointer"
                                      >
                                        Xem
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: LỊCH HỌC (#SCHEDULE) */}
                {activeTab === "schedule" && (
                  <div className="space-y-4 max-w-5xl mx-auto text-left">
                    <ScheduleView profile={profile} mode="online" />
                  </div>
                )}

                {/* TAB 5: TIẾN TRÌNH (#PROGRESS) - SO KHỚP CHUẨN XÁC MYATTEMPTS */}
                {(activeTab === "progress" || activeTab === "assessments") && (
                  <div className="max-w-5xl mx-auto space-y-4 text-left">
                    {/* KHỐI TỔNG QUAN TIẾN ĐỘ NGANG */}
                    <div className="bg-white rounded-xl p-4 sm:p-4.5 border border-slate-200/80 shadow-2xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                            Tiến độ nhiệm vụ học tập
                          </h3>
                          <p className="text-xs text-slate-500 font-medium">
                            Bạn đã hoàn thành <span className="font-semibold text-blue-700">{progressStats.completedTasks}/{progressStats.totalTasks}</span> nhiệm vụ.
                          </p>
                        </div>

                        {/* 2 BADGE BTVN VÀ KIỂM TRA NẰM NGANG GỌN GÀNG */}
                        <div className="flex items-center gap-2.5 text-xs">
                          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200/70 rounded-lg flex items-center gap-1.5">
                            <span className="text-[11px] uppercase font-semibold text-slate-400">BTVN:</span>
                            <span className="font-semibold text-slate-800">
                              {progressStats.submittedHw}/{progressStats.totalHw} đã nộp
                            </span>
                          </div>

                          <div className="px-3 py-1.5 bg-slate-50 border border-slate-200/70 rounded-lg flex items-center gap-1.5">
                            <span className="text-[11px] uppercase font-semibold text-slate-400">Kiểm tra:</span>
                            <span className="font-semibold text-slate-800">
                              {progressStats.completedTest}/{progressStats.totalTest} hoàn thành
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* THANH PROGRESS BAR MẢNH */}
                      <div className="space-y-1.5">
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                          <div 
                            className="h-full bg-blue-600 rounded-full transition-all duration-300"
                            style={{ width: `${progressStats.percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-400">
                          <span>Bắt đầu</span>
                          <span className="font-semibold text-blue-700">{progressStats.percent}%</span>
                        </div>
                      </div>
                    </div>

                    {/* DANH SÁCH BÀI HỌC DẠNG HÀNG COMPACT ROW (BÁO CÁO TRẠNG THÁI TĨNH 3 CỘT) */}
                    <div className="space-y-3.5">
                      {onlineChapters.map((chap, cIdx) => (
                        <div key={chap.id || cIdx} className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
                          <div className="px-4.5 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-blue-700" />
                            <h4 className="font-semibold text-slate-800 text-xs sm:text-[13px]">
                              {chap.title}
                            </h4>
                          </div>

                          <div className="divide-y divide-slate-100">
                            {(chap.lessons || []).map((les: any, lIdx: number) => {
                              const hwList = les.homework_files || [];
                              const testList = les.test_quizzes || [];

                              const hw = hwList[0];
                              const testQuiz = testList[0];

                              // Tra cứu đối soát bài nộp chuẩn xác từ myAttempts
                              const hwAttempt = findAttemptForLesson(hw, les.title, true);
                              const testAttempt = findAttemptForLesson(testQuiz, les.title, false);

                              return (
                                <div 
                                  key={les.id || lIdx} 
                                  className="py-2.5 px-4 sm:px-4.5 hover:bg-slate-50/60 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
                                >
                                  {/* CỘT 1: TÊN BÀI HỌC */}
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                                    <span className="text-sm font-semibold text-slate-800 truncate">
                                      {les.title}
                                    </span>
                                  </div>

                                  {/* CỤM CỘT 2 (BTVN) VÀ CỘT 3 (BÀI KIỂM TRA) - TRẠNG THÁI TĨNH THUẦN TÚY */}
                                  <div className="flex items-center gap-4 sm:gap-6 shrink-0 text-xs">
                                    {/* CỘT 2: BÀI TẬP VỀ NHÀ */}
                                    <div className="flex items-center gap-1.5 w-36 sm:w-44 justify-end">
                                      {hwList.length > 0 ? (
                                        hwAttempt ? (
                                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-xs flex items-center gap-1">
                                            <Check className="w-3 h-3 stroke-[3]" /> Đã nộp ({Number(hwAttempt.score ?? hwAttempt.points ?? 0).toFixed(1)}đ)
                                          </span>
                                        ) : (
                                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 font-medium text-xs border border-slate-200">
                                            Chưa làm
                                          </span>
                                        )
                                      ) : (
                                        <span className="text-slate-400 text-xs italic">Không có BTVN</span>
                                      )}
                                    </div>

                                    {/* CỘT 3: BÀI KIỂM TRA ĐỊNH KỲ */}
                                    <div className="flex items-center gap-1.5 w-36 sm:w-44 justify-end">
                                      {testList.length > 0 ? (
                                        testAttempt ? (
                                          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-xs flex items-center gap-1">
                                            <Check className="w-3 h-3 stroke-[3]" /> Đã thi ({Number(testAttempt.score ?? testAttempt.points ?? 0).toFixed(1)}đ)
                                          </span>
                                        ) : (
                                          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 font-medium text-xs border border-slate-200">
                                            Chưa thi
                                          </span>
                                        )
                                      ) : (
                                        <span className="text-slate-400 text-xs italic">Không có bài KT</span>
                                      )}
                                    </div>
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

                {/* TAB 6: XẾP HẠNG (#LEADERBOARD) */}
                {activeTab === "leaderboard" && (
                  <div className="max-w-5xl mx-auto text-left">
                    <StudentLeaderboardView profile={profile!} chapters={chapters} allAttempts={allAttempts} allowedMode="online" />
                  </div>
                )}

                {/* TAB 7: THÔNG BÁO (#NOTIFICATIONS) */}
                {activeTab === "notifications" && (
                  <div className="w-full max-w-5xl mx-auto space-y-3.5 text-left">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/60">
                      <h2 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">Trung tâm thông báo</h2>
                      <button onClick={handleMarkAllAsRead} className="px-3.5 py-1.5 bg-blue-50 text-blue-700 font-semibold text-xs rounded-lg hover:bg-blue-100 transition cursor-pointer">
                        Đã đọc tất cả
                      </button>
                    </div>
                    <div className="space-y-2">
                      {notificationsList.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">Chưa có thông báo nào.</div>
                      ) : (
                        notificationsList.map(item => {
                          const isUnread = !readNotifIds.includes(item.id);
                          return (
                            <div 
                              key={item.id} 
                              onClick={() => handleActionFromCenter(item)} 
                              className={"p-3.5 rounded-xl border transition flex items-center justify-between gap-3 cursor-pointer " + (isUnread ? "bg-blue-50/30 border-blue-300" : "bg-white border-slate-200 hover:border-slate-300")}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                                  <Clock className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className={"text-xs truncate " + (isUnread ? "font-semibold text-blue-800" : "font-semibold text-slate-800")}>{item.title}</h4>
                                  <p className="text-xs text-slate-500 truncate">{item.desc}</p>
                                </div>
                              </div>
                              <span className="text-xs text-slate-400 shrink-0 font-medium">{item.dateStr}</span>
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

      {/* MODAL LỊCH SỬ CHI TIẾT */}
      {historyModalExamId && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setHistoryModalExamId(null); }} 
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
        >
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden cursor-default animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                <ListOrdered className="w-4 h-4 text-blue-700" /> Lịch sử làm bài
              </h3>
              <button onClick={() => setHistoryModalExamId(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[50vh] custom-scrollbar">
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3.5 text-center">Lần</th>
                    <th className="py-2.5 px-3.5">Thời gian nộp</th>
                    <th className="py-2.5 px-3.5 text-center">Thời lượng</th>
                    <th className="py-2.5 px-3.5 text-center">Điểm số</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {practiceHistoryGrouped.find((g: any) => g.quizId === historyModalExamId)?.attempts.map((att: any, idx: number) => {
                    const isMax = att.score === practiceHistoryGrouped.find((g: any) => g.quizId === historyModalExamId)?.maxScore;
                    return (
                      <tr key={idx} className={"hover:bg-slate-50/50 " + (isMax ? "bg-amber-50/30" : "")}>
                        <td className="py-2.5 px-3.5 text-center font-semibold text-slate-700">{idx + 1}</td>
                        <td className="py-2.5 px-3.5 text-slate-600">{new Date(att.createdAt || att.created_at || att.submittedAt).toLocaleString("vi-VN")}</td>
                        <td className="py-2.5 px-3.5 text-center text-slate-500">{formatCompletionTime(Number(att.durationSeconds || att.completionTime) || 0)}</td>
                        <td className="py-2.5 px-3.5 text-center">
                          <span className={"font-semibold " + (isMax ? "text-amber-600" : "text-blue-700")}>{Number(att.score ?? att.points ?? 0).toFixed(1)}</span>
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

      {/* MODAL THÔNG BÁO CHI TIẾT */}
      {selectedSysNotif && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedSysNotif(null); }} 
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
        >
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 p-5 cursor-default">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">{selectedSysNotif.title}</h4>
            <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl mb-4 border border-slate-100">
              {selectedSysNotif.desc}
            </div>
            <button onClick={() => setSelectedSysNotif(null)} className="w-full py-2.5 bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer">
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* MODAL XEM TRƯỚC FILE ĐỀ */}
      {previewExam && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewExam(null); }} 
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
        >
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[80vh] overflow-hidden cursor-default">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-slate-900 text-xs sm:text-sm">Xem trước: {previewExam.title}</h3>
              <button onClick={() => setPreviewExam(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar space-y-3.5">
              {previewExam.data?.map((sec: any, sIdx: number) => (
                <div key={sIdx} className="space-y-2">
                  <h4 className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded inline-block">{sec.section_title || "Phần câu hỏi"}</h4>
                  {(sec.questions || []).map((q: any, qIdx: number) => (
                    <div key={qIdx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                      <div className="font-medium" dangerouslySetInnerHTML={{ __html: q.prompt_html || q.prompt }} />
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {(q.options || []).map((opt: any, oIdx: number) => (
                          <div key={oIdx} className="p-2 bg-white rounded border border-slate-200 text-slate-700">
                            <span className="font-semibold text-blue-700 mr-1">{opt.key}.</span>
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
    </div>
  );
}

export default StudentOnlineDashboard;
