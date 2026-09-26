"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "@/components/student/Sidebar";
import { Header } from "@/components/student/Header";
import { ChapterAccordion } from "@/components/student/ChapterAccordion";
import { ProgressTrackingView } from "@/components/student/ProgressTrackingView";
import { StudentLeaderboardView } from "@/components/student/StudentLeaderboardView";
import ScheduleView from "@/components/student/ScheduleView";
import { ExamRoomView } from "@/components/student/ExamRoomView";
import { LessonWorkspaceView } from "@/components/student/LessonWorkspaceView";
import PracticeExamWorkspace from "@/components/student/PracticeExamWorkspace";
import { Profile } from "@/types";
import { 
  Target, BookOpen, Play, CheckCircle2, Award, Sparkles, Clock, 
  Calendar, Edit3, Check, Quote, Layers, FileText, X, ArrowLeft, 
  Bell, AlertTriangle, MessageSquare, ArrowRight, Library, BarChart3, 
  ListOrdered, Video, MapPin, Users, CheckSquare, Trash2, Plus
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

interface StudentOnlineDashboardProps {
  initialProfile?: Profile | null;
  onLogout?: () => void;
}

export default function StudentOnlineDashboard({ initialProfile, onLogout }: StudentOnlineDashboardProps) {
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

  useEffect(() => {
    if (initialProfile) {
      setProfile({ ...initialProfile, learning_mode: "online", study_mode: "online" });
    }
  }, [initialProfile]);

  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [chapters, setChapters] = useState<any[]>(DEFAULT_CHAPTERS);
  const [allAttempts, setAllAttempts] = useState<any[]>([]);
  const [practiceExams, setPracticeExams] = useState<any[]>([]);
  const [sysNotifications, setSysNotifications] = useState<any[]>([]);
  const [selectedPracticeCategory, setSelectedPracticeCategory] = useState("Tất cả đề");
  
  const [practiceSubTab, setPracticeSubTab] = useState<"list" | "history">("list");
  const [historyModalExamId, setHistoryModalExamId] = useState<string | null>(null);
  
  const [studyGoal, setStudyGoal] = useState<string>(() => { 
    return typeof window !== "undefined" ? localStorage.getItem("edunexus_study_goal") || "Chinh phục 9.5+ Toán & Kỳ thi ĐGNL/TSA" : ""; 
  });
  const [isEditingGoal, setIsEditingGoal] = useState<boolean>(false);
  const [tempGoal, setTempGoal] = useState<string>(studyGoal);
  const [dailyQuote, setDailyQuote] = useState<string>("");
  const [totalStudySeconds, setTotalStudySeconds] = useState<number>(0);
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

  // ĐỒNG BỘ DỮ LIỆU TỪ STORAGE HOẶC DÙNG DỮ LIỆU MẶC ĐỊNH
  const fetchAuthAndData = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        const savedChapters = localStorage.getItem("edunexus_course_data");
        if (savedChapters && savedChapters !== "undefined" && savedChapters !== "null") {
          const parsed = JSON.parse(savedChapters);
          setChapters(Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CHAPTERS);
        } else {
          setChapters(DEFAULT_CHAPTERS);
        }
      } catch (e) {
        setChapters(DEFAULT_CHAPTERS);
      }
      
      try {
        const savedAttempts = localStorage.getItem("edunexus_attempts");
        if (savedAttempts) setAllAttempts(JSON.parse(savedAttempts));
      } catch (e) {}

      try {
        const savedPractice = localStorage.getItem("edunexus_practice_exams");
        if (savedPractice) setPracticeExams(JSON.parse(savedPractice));
      } catch (e) {}

      try {
        const savedNotifs = localStorage.getItem("edunexus_system_notifications");
        if (savedNotifs) setSysNotifications(JSON.parse(savedNotifs));
      } catch (e) {}

      const studySecs = parseInt(localStorage.getItem("edunexus_study_time_" + (profile?.id || "default")) || "0", 10);
      setTotalStudySeconds(studySecs);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchAuthAndData();
    setDailyQuote(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);
    window.addEventListener("storage", fetchAuthAndData);
    const interval = setInterval(fetchAuthAndData, 5000);
    return () => { 
      window.removeEventListener("storage", fetchAuthAndData); 
      clearInterval(interval); 
    };
  }, [fetchAuthAndData]);

  const handleSaveGoal = () => { 
    setStudyGoal(tempGoal); 
    localStorage.setItem("edunexus_study_goal", tempGoal); 
    setIsEditingGoal(false); 
  };

  const formattedStudyTimeToday = useMemo(() => {
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

  const notificationsList = useMemo(() => {
    const combined: any[] = [];
    const myAttempts = allAttempts.filter(a => a.studentId === profile?.id);
    
    myAttempts.forEach(att => {
      const isPractice = att.type === "practice";
      combined.push({
        id: score-${att.attemptId}, 
        title: "Điểm kiểm tra mới", 
        desc: Bài "${att.quizTitle}" đạt kết quả: ${att.score}/10 điểm., 
        type: "success", 
        timestamp: new Date(att.submittedAt).getTime(), 
        dateStr: new Date(att.submittedAt).toLocaleString("vi-VN"), 
        actionType: isPractice ? "practice_score" : "course_score", 
        quizId: att.quizId
      });
    });
    
    practiceExams.forEach(ex => {
      const exTime = ex.createdAt ? new Date(ex.createdAt).getTime() : Date.now() - 86400000;
      combined.push({
        id: exam-${ex.id}, 
        title: "Đề thi thử mới cập nhật", 
        desc: Đề "${ex.title}" (${ex.category}) đã sẵn sàng luyện tập., 
        type: "info", 
        timestamp: exTime, 
        dateStr: "Mới cập nhật", 
        actionType: "new_practice"
      });
    });
    
    sysNotifications.forEach(sys => {
      combined.push({
        id: sys-${sys.id}, 
        title: sys.title, 
        desc: sys.content, 
        type: sys.type === "urgent" ? "warning" : "teacher", 
        timestamp: new Date(sys.createdAt).getTime(), 
        dateStr: new Date(sys.createdAt).toLocaleString("vi-VN"), 
        actionType: "system_modal"
      });
    });
    
    return combined.sort((a, b) => b.timestamp - a.timestamp);
  }, [allAttempts, practiceExams, sysNotifications, profile?.id]);

  const handleMarkAllAsRead = () => {
    const allIds = notificationsList.map(n => n.id);
    setReadNotifIds(allIds);
    localStorage.setItem(edunexus_read_notifs_${profile?.id}, JSON.stringify(allIds));
    window.dispatchEvent(new Event("readNotifsUpdated"));
  };

  const handleActionFromCenter = (item: any) => {
    if (!readNotifIds.includes(item.id)) {
      const newIds = [...readNotifIds, item.id];
      setReadNotifIds(newIds);
      localStorage.setItem(edunexus_read_notifs_${profile?.id}, JSON.stringify(newIds));
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
    const myPracticeAttempts = allAttempts.filter(a => a.studentId === profile?.id && a.type === "practice");
    const grouped: Record<string, any> = {};
    myPracticeAttempts.forEach(att => {
      if (!grouped[att.quizId]) {
        grouped[att.quizId] = {
          quizId: att.quizId,
          title: att.quizTitle,
          category: att.category || "Luyện đề",
          attempts: [],
          maxScore: 0,
          lastDate: 0
        };
      }
      grouped[att.quizId].attempts.push(att);
      grouped[att.quizId].maxScore = Math.max(grouped[att.quizId].maxScore, att.score);
      const attTime = new Date(att.submittedAt).getTime();
      if (attTime > grouped[att.quizId].lastDate) {
        grouped[att.quizId].lastDate = attTime;
      }
    });
    Object.values(grouped).forEach(group => {
      group.attempts.sort((a: any, b: any) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    });
    return Object.values(grouped).sort((a, b) => b.lastDate - a.lastDate);
  }, [allAttempts, profile?.id]);

  const formatCompletionTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return ${s} giây;
    return ${m}p ${s}s;
  };

  // LỌC BÀI HỌC DÀNH CHO HỌC SINH ONLINE (LẤY CÁC BÀI TARGET LÀ ONLINE HOẶC ALL HOẶC RỖNG)
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

  // Lịch học & Điểm danh Online
  const [onlineSessions, setOnlineSessions] = useState<any[]>([]);
  const [onlineAttRecords, setOnlineAttRecords] = useState<any[]>([]);
  const [onlineToast, setOnlineToast] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("edunexus_online_sessions");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setOnlineSessions(parsed);
      }
      const savedAtt = localStorage.getItem("edunexus_attendance");
      if (savedAtt) {
        const parsed = JSON.parse(savedAtt);
        if (Array.isArray(parsed)) setOnlineAttRecords(parsed);
      }
    } catch (e) {}
  }, []);

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

    if (sessIsoDate && sessIsoDate === isoStr) return true;
    if (sessDate && sessDate === dStr) return true;
    return false;
  };

  const liveOnlineSession = useMemo(() => {
    if (!onlineSessions || onlineSessions.length === 0) return null;
    const now = currentTime;
    const curMinutes = now.getHours() * 60 + now.getMinutes();

    return onlineSessions.find((s: any) => {
      const isTarget = s.target_mode === "online" || s.target_mode === "all" || s.audience === "online" || s.audience === "all";
      if (!isTarget) return false;
      if (!isSameDate(s.date, s.isoDate, now)) return false;
      const slot = parseTimeSlotMinutes(s.timeSlot);
      if (!slot) return false;
      return curMinutes <= slot.endMinutes;
    }) || null;
  }, [onlineSessions, currentTime]);

  const isOnlineSessionActive = useMemo(() => {
    if (!liveOnlineSession) return false;
    const slot = parseTimeSlotMinutes(liveOnlineSession.timeSlot);
    if (!slot) return true;
    const curMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    return curMinutes <= slot.endMinutes;
  }, [liveOnlineSession, currentTime]);

  const isOnlineLiveNow = useMemo(() => {
    if (!liveOnlineSession) return false;
    const slot = parseTimeSlotMinutes(liveOnlineSession.timeSlot);
    if (!slot) return false;
    const curMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    return curMinutes >= slot.startMinutes - 15 && curMinutes <= slot.endMinutes;
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
        attempts={allAttempts.filter(a => a.studentId === profile?.id && a.quizId === workspacePracticeExam.id)}
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
    <div className="h-screen w-full bg-[#F8FAFC] font-sans text-slate-800 flex overflow-hidden relative selection:bg-blue-500/20">
      <AnimatePresence>
        {onlineToast && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }} 
            className="fixed top-5 right-5 z-[500] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-bold text-xs sm:text-sm border border-emerald-400"
          >
            <CheckCircle2 className="w-5 h-5 text-white" /> {onlineToast}
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        className={"h-full shrink-0 transition-[width,opacity,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden hidden md:block z-40 " + (
          isSidebarOpen ? "w-64 opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-10"
        )}
        style={{ willChange: "width, transform" }}
      >
        <div className="w-64 h-full">
          <Sidebar user={profile!} activeTab={activeTab} setActiveTab={setActiveTab} onToggleSidebar={() => setIsSidebarOpen(false)} onLogout={onLogout} />
        </div>
      </div>
      
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <div className="shrink-0 w-full">
          <Header 
            user={profile!} isSidebarOpen={isSidebarOpen} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            activeTab={activeTab} setActiveTab={setActiveTab} searchQuery={searchQuery} onSearchChange={setSearchQuery}
            allAttempts={allAttempts} practiceExams={practiceExams} sysNotifications={sysNotifications}
          />
        </div>
        
        <main className="flex-1 p-4 sm:px-8 py-6 overflow-y-auto custom-scrollbar transition-all duration-300 ease-in-out w-full">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab} 
              initial={{ opacity: 0, y: 10, scale: 0.99 }} 
              animate={{ opacity: 1, y: 0, scale: 1 }} 
              exit={{ opacity: 0, y: -10, scale: 0.99 }} 
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="w-full"
            >
              {/* TAB OVERVIEW */}
              {activeTab === "overview" && (
                <div className="w-full max-w-7xl mx-auto space-y-6 text-left">
                  {liveOnlineSession && isOnlineSessionActive && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 sm:px-5 rounded-2xl bg-[#1D4ED8] text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-blue-600"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-white/20 text-white shrink-0">
                          <Video className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-[11px] font-black uppercase tracking-wider text-blue-100 flex items-center gap-1.5">
                            <span>{isOnlineLiveNow ? "ĐANG DIỄN RA BUỔI HỌC TRỰC TUYẾN" : "LỊCH HỌC TRỰC TUYẾN HÔM NAY"}</span>
                            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold">LIVE ZOOM</span>
                          </p>
                          <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                            {(liveOnlineSession.title || liveOnlineSession.subject) + " (" + liveOnlineSession.timeSlot + ")"}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {isAttendedTodayOnline ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-200 font-black text-xs border border-emerald-400/30">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                              <span>Đã điểm danh ✓</span>
                            </span>
                            <button
                              type="button"
                              onClick={handleOnlineJoinMeeting}
                              className="px-3.5 py-1.5 bg-white text-[#1D4ED8] hover:bg-blue-50 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span>Vào phòng học</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleOnlineJoinMeeting}
                            className="px-5 py-2 bg-white text-[#1D4ED8] hover:bg-blue-50 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-4 h-4 fill-[#1D4ED8]" />
                            <span>Vào học & Điểm danh</span>
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}

                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Chương trình 12</h2>
                    <span className="text-xs font-bold text-slate-500">
                      {onlineChapters.length} Chương chính khóa (Lớp Online TCT)
                    </span>
                  </div>

                  <div className="space-y-6">
                    {onlineChapters.map((chap, idx) => (
                      <div key={chap.id || idx} className="space-y-3">
                        <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                          <span className="text-[#1D4ED8] uppercase text-xs tracking-widest bg-blue-50 px-2 py-1 rounded-md border border-blue-100">Chương {idx + 1}</span> {chap.title}
                        </h3>
                        <div className="pl-4 space-y-2.5 border-l-2 border-slate-200/60 ml-4">
                          {(chap.lessons || []).map((les: any) => (
                            <div key={les.id} className="flex items-center gap-3 text-slate-700 hover:text-[#1D4ED8] transition-colors cursor-default">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                              <span className="font-medium text-[14px]">{les.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {onlineChapters.length === 0 && (
                      <div className="py-8 text-center text-slate-400 font-medium bg-white rounded-2xl border border-slate-200">
                        Chưa có chương trình học nào. Giáo viên sẽ cập nhật nội dung bài giảng sớm nhất.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB COURSES */}
              {activeTab === "courses" && (
                <div className="max-w-6xl mx-auto space-y-6 text-left justify-start">
                  <div className="bg-white rounded-[20px] p-5 border border-slate-200 shadow-sm flex flex-col gap-3.5 text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 bg-blue-50 text-[#1D4ED8] rounded-md text-[10px] font-extrabold uppercase tracking-widest border border-blue-100">
                        Hệ thống TCT (Lớp Online)
                      </span>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-bold border border-emerald-100"><Clock className="w-3.5 h-3.5" /> Thời gian học: {formattedStudyTimeToday}</div>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Xin chào, {profile?.full_name}!</h2>
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">MỤC TIÊU CÁ NHÂN:</span>
                        {!isEditingGoal && (<button onClick={() => { setTempGoal(studyGoal); setIsEditingGoal(true); }} className="text-[11px] font-bold text-[#1D4ED8] hover:underline flex items-center gap-1 cursor-pointer"><Edit3 className="w-3 h-3" /> Chỉnh sửa</button>)}
                      </div>
                      {isEditingGoal ? (
                        <div className="flex items-center gap-2 max-w-md">
                          <input type="text" value={tempGoal} onChange={e => setTempGoal(e.target.value)} className="flex-1 px-3 py-1.5 border border-blue-300 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 bg-white shadow-sm" placeholder="Nhập mục tiêu..."/>
                          <button onClick={handleSaveGoal} className="px-3 py-1.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1 cursor-pointer"><Check className="w-3.5 h-3.5" /> Lưu</button>
                        </div>
                      ) : (<p className="text-[13px] font-bold text-slate-700 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 inline-block">🎯 {studyGoal}</p>)}
                    </div>
                  </div>
                  
                  <div className="bg-[#1D4ED8] rounded-xl py-3 px-5 text-white shadow-sm flex items-center gap-3 text-left">
                    <Quote className="w-5 h-5 text-yellow-300 opacity-90 shrink-0" />
                    <p className="text-[13px] font-semibold text-white leading-snug">"{dailyQuote}"</p>
                  </div>
                  
                  <div className="pt-2 space-y-4 text-left justify-start">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Chương trình học chính khóa</h3>
                    </div>
                    <ChapterAccordion 
                      chapters={onlineChapters.filter(chap => chap.title.toLowerCase().includes(searchQuery.toLowerCase()) || chap.lessons?.some((l: any) => l.title.toLowerCase().includes(searchQuery.toLowerCase())))} 
                      pastAttempts={allAttempts.filter(a => a.studentId === profile?.id)} 
                      onOpenLesson={(les) => setSelectedLesson(les)} 
                      onStartExam={(qId, qTitle, isHomework, durationMinutes) => { 
                        setExamRoom({ id: qId, title: qTitle, duration: durationMinutes || 45, isHomework }); 
                      }} 
                    />
                  </div>
                </div>
              )}

              {/* TAB NOTIFICATIONS */}
              {activeTab === "notifications" && (
                <div className="w-full max-w-7xl mx-auto space-y-6 text-left">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-200/60">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setActiveTab("courses")} className="w-10 h-10 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-600 hover:text-[#1D4ED8] hover:border-[#1D4ED8] flex items-center justify-center transition-colors cursor-pointer"><ArrowLeft className="w-5 h-5" /></button>
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Trung tâm thông báo</h2>
                        <p className="text-sm text-slate-500 font-medium mt-0.5">Tin tức lớp học, kết quả thi & nhắc nhở từ giáo viên.</p>
                      </div>
                    </div>
                    <button onClick={handleMarkAllAsRead} className="px-5 py-2.5 bg-blue-50 text-[#1D4ED8] font-bold text-[13px] rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors shadow-sm cursor-pointer">Đánh dấu đã đọc</button>
                  </div>
                  <div className="space-y-4">
                    {notificationsList.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 font-medium bg-white rounded-3xl border border-slate-200 shadow-sm">Chưa có thông báo nào.</div>
                    ) : (
                      notificationsList.map(item => {
                        const isUnread = !readNotifIds.includes(item.id);
                        return (
                          <div key={item.id} onClick={() => handleActionFromCenter(item)} className={"p-5 rounded-3xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group cursor-pointer " + (isUnread ? "bg-blue-50/40 border-[#1D4ED8] shadow-sm" : "bg-white border-slate-200 hover:border-slate-300 shadow-sm")}> 
                            <div className="flex items-start gap-4">
                              <div className={"w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm " + (item.type === "warning" ? "bg-rose-50 text-rose-500 border border-rose-100" : item.type === "success" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : item.type === "teacher" ? "bg-indigo-50 text-indigo-500 border border-indigo-100" : "bg-blue-50 text-blue-500 border border-blue-100")}>
                                {item.type === "warning" && <AlertTriangle className="w-6 h-6" />}
                                {item.type === "success" && <CheckCircle2 className="w-6 h-6" />}
                                {item.type === "teacher" && <MessageSquare className="w-6 h-6" />}
                                {(item.type === "info" || !["warning","success","teacher"].includes(item.type)) && <Clock className="w-6 h-6" />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className={"text-[15px] tracking-tight " + (isUnread ? "font-black text-[#1D4ED8]" : "font-bold text-slate-800")}>{item.title}</h4>
                                  {isUnread && <span className="w-2.5 h-2.5 rounded-full bg-[#1D4ED8] shadow-sm"></span>}
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed mb-2">{item.desc}</p>
                                <span className="text-[11px] text-slate-400 font-bold">{item.dateStr}</span>
                              </div>
                            </div>
                            <div className="shrink-0 sm:self-center mt-2 sm:mt-0">
                              {item.actionType === "system_modal" ? (
                                <button onClick={(e) => { e.stopPropagation(); handleActionFromCenter(item); }} className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer bg-white text-slate-700 border border-slate-200 hover:bg-slate-50">Xem chi tiết</button>
                              ) : item.actionType === "course_score" ? (
                                <button onClick={(e) => { e.stopPropagation(); handleActionFromCenter(item); }} className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer bg-[#1D4ED8] text-white hover:bg-[#1E40AF]">Xem bài học <ArrowRight className="w-4 h-4" /></button>
                              ) : (
                                <button onClick={(e) => { e.stopPropagation(); handleActionFromCenter(item); }} className="px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer bg-[#1D4ED8] text-white hover:bg-[#1E40AF]">Xem tiến trình <ArrowRight className="w-4 h-4" /></button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB SCHEDULE */}
              {activeTab === "schedule" && (
                <div className="space-y-6 max-w-6xl mx-auto text-left">
                  <ScheduleView profile={profile} mode="online" />
                </div>
              )}

              {(activeTab === "progress" || activeTab === "assessments") && <ProgressTrackingView chapters={chapters} pastAttempts={allAttempts.filter(a => a.studentId === profile?.id)} onStartExam={(qId, qTitle, isHomework, durationMinutes) => { setExamRoom({ id: qId, title: qTitle, duration: durationMinutes || 45, isHomework }); }} />}
              {activeTab === "leaderboard" && <StudentLeaderboardView profile={profile!} chapters={chapters} allAttempts={allAttempts} allowedMode="online" />}
              
              {/* TAB PRACTICE */}
              {activeTab === "practice" && (
                <div className="max-w-6xl mx-auto space-y-5 text-left justify-start">
                  <div className="bg-white py-4 px-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 text-[#1D4ED8] rounded-xl flex items-center justify-center shadow-sm">
                        <Target className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                          Hệ thống Luyện đề Thực chiến (Lớp Online)
                        </h2>
                        <span className="inline-flex items-center gap-1 mt-1 text-[11px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-lg border border-emerald-100">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {practiceExams.length} đề thi khả dụng
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 shrink-0">
                      <button 
                        onClick={() => setPracticeSubTab("list")}
                        className={"px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer " + (practiceSubTab === "list" ? "bg-white text-[#1D4ED8] shadow-sm" : "text-slate-500 hover:text-slate-800")}
                      >
                        <Library className="w-4 h-4"/> Danh sách đề
                      </button>
                      <button 
                        onClick={() => setPracticeSubTab("history")}
                        className={"px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer " + (practiceSubTab === "history" ? "bg-white text-[#1D4ED8] shadow-sm" : "text-slate-500 hover:text-slate-800")}
                      >
                        <BarChart3 className="w-4 h-4"/> Điểm & Lịch sử
                      </button>
                    </div>
                  </div>

                  {practiceSubTab === "list" && (
                    <div className="space-y-5 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                        {["Tất cả đề", "ĐGNL HSA (ĐHQGHN)", "ĐGTD TSA (ĐHBK)", "Tốt Nghiệp THPT", "Giữa Kì 1", "Học Kì 1", "Giữa Kì 2", "Học Kì 2"].map(cat => (
                          <button 
                            key={cat}
                            onClick={() => setSelectedPracticeCategory(cat)}
                            className={"px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-sm cursor-pointer " + (
                              selectedPracticeCategory === cat 
                                ? "bg-[#1D4ED8] text-white border border-[#1D4ED8]" 
                                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(practiceExams || [])
                          .filter((e: any) => e.target_mode === "online" || e.target_mode === "all" || !e.target_mode)
                          .filter(e => selectedPracticeCategory === "Tất cả đề" || e.category === selectedPracticeCategory)
                          .filter(e => e.title.toLowerCase().includes(searchQuery.toLowerCase()))
                          .map(exam => {
                            const canViewFile = exam.allowViewFile !== false;
                            return (
                              <div key={exam.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-[#1D4ED8]/50 hover:shadow-md transition-all flex flex-col group">
                                <div className="flex justify-between items-start mb-3">
                                  <span className="text-[9px] font-black uppercase bg-blue-50 text-[#1D4ED8] px-2 py-0.5 rounded-md border border-blue-100">
                                    {exam.category}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md">
                                    <Clock className="w-3 h-3"/> {exam.duration_minutes}p
                                  </span>
                                </div>
                                <h3 className="text-sm font-bold text-slate-800 mb-1 leading-snug line-clamp-2 group-hover:text-[#1D4ED8] transition-colors">{exam.title}</h3>
                                <p className="text-[11px] text-slate-500 font-medium mb-5">Số câu hỏi: {exam.data?.reduce((acc: number, sec: any) => acc + (sec.questions?.length || 0), 0) || 0} câu</p>
                                
                                <div className="mt-auto flex flex-col gap-2">
                                  {canViewFile && (
                                    <button 
                                      onClick={() => {
                                        if (exam.driveUrl && exam.driveUrl.trim() !== "") window.open(exam.driveUrl, "_blank");
                                        else setPreviewExam(exam);
                                      }}
                                      className="w-full py-2 bg-white border border-[#1D4ED8] text-[#1D4ED8] hover:bg-blue-50 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <FileText className="w-3.5 h-3.5"/> Xem file đề
                                    </button>
                                  )}
                                  
                                  <button
                                    onClick={() => setWorkspacePracticeExam(exam)}
                                    className="w-full py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                  >
                                    <Video className="w-3.5 h-3.5 text-amber-600"/> Xem video chữa bài
                                  </button>

                                  <button 
                                    onClick={() => { setExamRoom({ id: exam.id, title: exam.title, duration: exam.duration_minutes, isHomework: false }); }}
                                    className="w-full py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    Vào thi ngay
                                  </button>
                                </div>
                              </div>
                            );
                        })}
                        {practiceExams.length === 0 && (
                          <div className="col-span-full py-10 text-center text-slate-400 text-sm font-medium">Không có đề thi nào trong danh mục này.</div>
                        )}
                      </div>
                    </div>
                  )}

                  {practiceSubTab === "history" && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-200">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[13px]">
                          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                            <tr>
                              <th className="py-3 px-5 font-bold w-1/3">Tên đề thi</th>
                              <th className="py-3 px-5 font-bold text-center">Số lần làm</th>
                              <th className="py-3 px-5 font-bold text-center">Điểm cao nhất</th>
                              <th className="py-3 px-5 font-bold text-center">Lần mới nhất</th>
                              <th className="py-3 px-5 font-bold text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-[13px]">
                            {practiceHistoryGrouped.length === 0 ? (
                              <tr><td colSpan={5} className="py-12 text-center text-slate-400 italic">Bạn chưa hoàn thành đề thi nào.</td></tr>
                            ) : (
                              practiceHistoryGrouped.map((grp: any) => (
                                <tr key={grp.quizId} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="py-3 px-5">
                                    <span className="font-bold text-slate-800 block line-clamp-1">{grp.title}</span>
                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase mt-1 inline-block">{grp.category}</span>
                                  </td>
                                  <td className="py-3 px-5 text-center">
                                    <span className="bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-lg text-xs">{grp.attempts.length} lần</span>
                                  </td>
                                  <td className="py-3 px-5 text-center">
                                    <span className="font-black text-[#1D4ED8] text-sm bg-blue-50 border border-blue-100 px-3 py-1 rounded-xl shadow-xs">
                                      {grp.maxScore.toFixed(1)} <span className="text-[10px] font-medium text-blue-700">điểm</span>
                                    </span>
                                  </td>
                                  <td className="py-3 px-5 text-center text-slate-500 text-xs font-medium">
                                    {new Date(grp.lastDate).toLocaleString("vi-VN")}
                                  </td>
                                  <td className="py-3 px-5 text-right">
                                    <button 
                                      onClick={() => setHistoryModalExamId(grp.quizId)}
                                      className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#1D4ED8] text-[#1D4ED8] hover:bg-blue-50 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                                    >
                                      <ListOrdered className="w-3.5 h-3.5" /> Chi tiết
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
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {historyModalExamId && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setHistoryModalExamId(null); }} 
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        >
          <div className="bg-white rounded-[28px] w-full max-w-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 cursor-default">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-[#1D4ED8]" /> Lịch sử làm bài
                </h3>
                <p className="text-xs text-[#1D4ED8] font-bold mt-1">{practiceHistoryGrouped.find((g:any) => g.quizId === historyModalExamId)?.title}</p>
              </div>
              <button onClick={() => setHistoryModalExamId(null)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <table className="w-full text-left text-[13px] border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-5 font-bold text-center">Lần làm</th>
                    <th className="py-3 px-5 font-bold">Thời gian nộp bài</th>
                    <th className="py-3 px-5 font-bold text-center">Hoàn thành trong</th>
                    <th className="py-3 px-5 font-bold text-center">Điểm số</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {practiceHistoryGrouped.find((g:any) => g.quizId === historyModalExamId)?.attempts.map((att: any, idx: number) => {
                    const isMax = att.score === practiceHistoryGrouped.find((g:any) => g.quizId === historyModalExamId)?.maxScore;
                    return (
                      <tr key={att.attemptId} className={"hover:bg-slate-50/50 transition-colors " + (isMax ? "bg-amber-50/30" : "")}>
                        <td className="py-3 px-5 text-center font-bold text-slate-700">Lần {idx + 1}</td>
                        <td className="py-3 px-5 text-slate-600 font-medium">{new Date(att.submittedAt).toLocaleString("vi-VN")}</td>
                        <td className="py-3 px-5 text-center text-slate-500">{formatCompletionTime(Number(att.completionTime) || 0)}</td>
                        <td className="py-3 px-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className={"font-black " + (isMax ? "text-amber-600 text-[15px]" : "text-[#1D4ED8]")}>{att.score.toFixed(1)}</span>
                            {isMax && <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md uppercase font-bold">Max</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/30">
              <button onClick={() => setHistoryModalExamId(null)} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-[13px] rounded-xl transition-colors cursor-pointer shadow-sm">
                Đóng lại
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedSysNotif && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedSysNotif(null); }} 
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        >
          <div className="bg-white rounded-[28px] w-full max-w-lg shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 cursor-default">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#1D4ED8]" /> Thông báo chi tiết
              </h3>
              <button onClick={() => setSelectedSysNotif(null)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6">
              <h4 className="text-lg font-black text-slate-900 mb-2 leading-snug">{selectedSysNotif.title}</h4>
              <div className="flex flex-wrap items-center gap-2 mb-5 text-xs font-semibold text-slate-500">
                <span className="bg-blue-50 text-[#1D4ED8] px-2 py-1 rounded-md border border-blue-100">Từ: Ban Giám Thị TCT</span>
                <span className="hidden sm:inline">•</span>
                <span>{selectedSysNotif.dateStr}</span>
              </div>
              <div className="text-[14px] text-slate-700 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {selectedSysNotif.desc}
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 flex justify-end bg-slate-50/30">
              <button onClick={() => setSelectedSysNotif(null)} className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-[13px] rounded-xl transition-colors cursor-pointer">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {previewExam && (
        <div 
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewExam(null); }} 
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        >
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden cursor-default">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#1D4ED8]" /> Xem trước: {previewExam.title}
              </h3>
              <button onClick={() => setPreviewExam(null)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
              {previewExam.data?.map((sec: any, sIdx: number) => (
                <div key={sIdx} className="mb-8">
                  {sec.section_title && <h4 className="font-bold text-[#1D4ED8] mb-4 bg-blue-50 px-3 py-1.5 rounded-lg inline-block text-sm">{sec.section_title}</h4>}
                  <div className="space-y-6">
                    {sec.questions?.map((q: any, qIdx: number) => (
                      <div key={qIdx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="font-bold text-slate-800 text-sm mb-3 flex items-start gap-2">
                          <span className="shrink-0 text-[#1D4ED8]">Câu {q.order_index}:</span> 
                          <span className="font-medium" dangerouslySetInnerHTML={{ __html: q.prompt_html }} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2 sm:pl-10">
                          {q.options?.map((opt: any, oIdx: number) => (
                            <div key={oIdx} className="text-[13px] text-slate-600 flex items-start gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                              <span className="font-bold text-slate-900">{opt.key}.</span> 
                              <span dangerouslySetInnerHTML={{ __html: opt.text_html }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
