"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar as CalendarIcon, Clock, Video, CheckCircle2, 
  MapPin, ChevronLeft, ChevronRight, CalendarDays, 
  Plus, Trash2, X
} from "lucide-react";
import { Profile, OnlineSession, AttendanceRecord, STANDARD_SHIFTS } from "@/types";

interface ScheduleViewProps {
  profile?: Profile | null;
  mode?: "online" | "offline" | "all";
  isAdmin?: boolean;
}

export function parseTimeSlotMinutes(timeSlot?: string): { startMinutes: number; endMinutes: number } | null {
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
}

export function isSameDate(sessDate?: string, sessIsoDate?: string, targetDate: Date = new Date()): boolean {
  const d = String(targetDate.getDate()).padStart(2, "0");
  const m = String(targetDate.getMonth() + 1).padStart(2, "0");
  const y = String(targetDate.getFullYear());
  const dStr = d + "/" + m;
  const isoStr = y + "-" + m + "-" + d;
  if (sessIsoDate && sessIsoDate === isoStr) return true;
  if (sessDate && sessDate === dStr) return true;
  return false;
}

export default function ScheduleView({ profile, mode, isAdmin = false }: ScheduleViewProps) {
  const [viewType, setViewType] = useState<"week" | "month">("week");
  const [sessions, setSessions] = useState<OnlineSession[]>([]);
  const [personalSchedules, setPersonalSchedules] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [successToast, setSuccessToast] = useState<string>("");
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  const [isAddPersonalModalOpen, setIsAddPersonalModalOpen] = useState<boolean>(false);
  const [personalForm, setPersonalForm] = useState({
    subject: "",
    dayOfWeek: "Thứ 2",
    shiftId: "ca-1",
    timeSlot: "08:00 - 09:30",
    mode: "offline" as "online" | "offline" | "self",
    room: "",
    teacher: ""
  });

  const studentMode = mode || profile?.learning_mode || "online";
  const isOnlineStudent = studentMode === "online";

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const loadScheduleData = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const savedSessions = localStorage.getItem("edunexus_online_sessions");
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
        } else {
          setSessions(getDefaultSessions());
        }
      } else {
        const defaults = getDefaultSessions();
        setSessions(defaults);
        localStorage.setItem("edunexus_online_sessions", JSON.stringify(defaults));
      }
    } catch {
      setSessions(getDefaultSessions());
    }

    try {
      const savedPersonal = localStorage.getItem("edunexus_personal_schedules");
      if (savedPersonal) {
        const parsed = JSON.parse(savedPersonal);
        if (Array.isArray(parsed)) setPersonalSchedules(parsed);
      }
    } catch {}

    try {
      const savedAtt = localStorage.getItem("edunexus_attendance");
      if (savedAtt) {
        const parsed = JSON.parse(savedAtt);
        if (Array.isArray(parsed)) setAttendanceRecords(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadScheduleData();
    window.addEventListener("storage", loadScheduleData);
    return () => window.removeEventListener("storage", loadScheduleData);
  }, [loadScheduleData]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(""), 3500);
  };

  function getDefaultSessions(): OnlineSession[] {
    return [
      {
        id: "sess-t3",
        title: "Đạo hàm & Khảo sát hàm số 12: Cực trị nâng cao",
        subject: "Giải tích 12",
        dayOfWeek: "Thứ 3",
        date: "22/09",
        isoDate: "2026-09-22",
        shiftId: "ca-5",
        shiftName: "Ca 5",
        timeSlot: "18:00 - 19:30",
        room: "P.201 TCT",
        teacherName: "Thầy Nam",
        target_mode: "offline",
        audience: "all",
        createdAt: "2026-09-20T10:00:00Z"
      },
      {
        id: "sess-t5-today",
        title: "Chuyên đề: Tích phân & Kỹ thuật Casio",
        subject: "Toán 12 - Tích phân",
        dayOfWeek: "Thứ 5",
        date: "24/09",
        isoDate: "2026-09-24",
        shiftId: "ca-3",
        shiftName: "Ca 3",
        timeSlot: "14:30 - 16:00",
        meetingUrl: "https://zoom.us/j/1234567890",
        room: "Zoom Meeting",
        teacherName: "Thầy Nam",
        target_mode: "online",
        audience: "all",
        createdAt: "2026-09-24T08:00:00Z"
      },
      {
        id: "sess-t5-ca6",
        title: "Luyện đề thi thử Toán THPT Quốc Gia",
        subject: "Toán 12 - Luyện đề",
        dayOfWeek: "Thứ 5",
        date: "24/09",
        isoDate: "2026-09-24",
        shiftId: "ca-6",
        shiftName: "Ca 6",
        timeSlot: "19:30 - 21:00",
        meetingUrl: "https://zoom.us/j/1234567890",
        room: "Zoom Meeting",
        teacherName: "Thầy Nam",
        target_mode: "online",
        audience: "all",
        createdAt: "2026-09-24T08:00:00Z"
      },
      {
        id: "sess-t7",
        title: "Hình học không gian & Phương pháp tọa độ Oxyz",
        subject: "Hình học Oxyz",
        dayOfWeek: "Thứ 7",
        date: "26/09",
        isoDate: "2026-09-26",
        shiftId: "ca-5",
        shiftName: "Ca 5",
        timeSlot: "18:00 - 19:30",
        room: "P.201 TCT",
        teacherName: "Thầy Giang",
        target_mode: "offline",
        audience: "offline",
        createdAt: "2026-09-20T10:00:00Z"
      }
    ];
  }

  const filteredSessions = useMemo(() => {
    if (isAdmin) return sessions;
    return sessions.filter(sess => {
      const modeMatch = sess.target_mode === "all" || !sess.target_mode || sess.target_mode === studentMode;
      const audMatch = sess.audience === "all" || !sess.audience || sess.audience === studentMode;
      return modeMatch || audMatch;
    });
  }, [sessions, studentMode, isAdmin]);

  const getSessionStatus = useCallback(
    (sess: OnlineSession, dayDate: Date): "past" | "live" | "upcoming" => {
      const now = currentTime;
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfDay = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()).getTime();

      if (startOfDay < startOfToday) return "past";
      if (startOfDay > startOfToday) return "upcoming";

      const slot = parseTimeSlotMinutes(sess.timeSlot);
      if (!slot) return "upcoming";

      const curMinutes = now.getHours() * 60 + now.getMinutes();

      if (curMinutes > slot.endMinutes) {
        return "past";
      }

      if (curMinutes >= slot.startMinutes - 15 && curMinutes <= slot.endMinutes) {
        return "live";
      }

      return "upcoming";
    },
    [currentTime]
  );

  const activeLiveBannerSession = useMemo(() => {
    if (isAdmin) return null;
    const now = currentTime;
    return filteredSessions.find(sess => {
      if (!isSameDate(sess.date, sess.isoDate, now)) return false;
      const slot = parseTimeSlotMinutes(sess.timeSlot);
      if (!slot) return false;
      const curMinutes = now.getHours() * 60 + now.getMinutes();
      return curMinutes >= slot.startMinutes - 15 && curMinutes <= slot.endMinutes;
    });
  }, [filteredSessions, currentTime, isAdmin]);

  const isAttended = (sess: OnlineSession) => {
    if (!profile) return false;
    return attendanceRecords.some(
      a =>
        a.studentId === profile.id &&
        ((a as any).sessionId === sess.id || a.sessionDate === sess.date) &&
        (a.status === "present" || a.status === "auto_present")
    );
  };

  const handleCheckIn = (sess: OnlineSession) => {
    if (!profile) return;
    const now = new Date();
    const timeStr = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    const dateStr = sess.date || "24/09";

    const newRecord: AttendanceRecord = {
      id: "att-" + Date.now(),
      studentId: profile.id,
      studentName: profile.full_name,
      sessionDate: dateStr,
      status: "present",
      mode: isOnlineStudent ? "online_auto" : "offline_self",
      attendedAt: now.toISOString(),
      note: isOnlineStudent ? ("Điểm danh Online lúc " + timeStr) : ("Điểm danh Offline lúc " + timeStr)
    };

    const updated = [
      ...attendanceRecords.filter(a => !(a.studentId === profile.id && a.sessionDate === dateStr)),
      newRecord
    ];
    setAttendanceRecords(updated);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_attendance", JSON.stringify(updated));
        localStorage.setItem("tct_attendance_records", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {
        console.error("Lỗi lưu điểm danh:", e);
      }
    }

    if (isOnlineStudent && sess.meetingUrl) {
      showToast("Điểm danh thành công lúc " + timeStr + "! Đang mở lớp học...");
      window.open(sess.meetingUrl, "_blank");
    } else {
      showToast("Điểm danh thành công! Đã ghi nhận lúc " + timeStr + ".");
    }
  };

  const handleRejoin = (sess: OnlineSession) => {
    if (sess.meetingUrl) {
      showToast("Đang kết nối lại lớp học...");
      window.open(sess.meetingUrl, "_blank");
    }
  };

  const handleAddPersonalSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalForm.subject.trim()) return alert("Vui lòng nhập tên môn học!");

    const shiftObj = STANDARD_SHIFTS.find(s => s.id === personalForm.shiftId) || STANDARD_SHIFTS[0];
    const newPersonal = {
      id: "pers-" + Date.now(),
      subject: personalForm.subject.trim(),
      title: personalForm.subject.trim(),
      dayOfWeek: personalForm.dayOfWeek,
      shiftId: shiftObj.id,
      shiftName: shiftObj.name,
      timeSlot: shiftObj.timeSlot,
      target_mode: personalForm.mode,
      room: personalForm.room.trim() || (personalForm.mode === "online" ? "Online" : "TCT"),
      teacherName: personalForm.teacher.trim() || "Tự học",
      isPersonal: true,
      createdAt: new Date().toISOString()
    };

    const updated = [...personalSchedules, newPersonal];
    setPersonalSchedules(updated);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_personal_schedules", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      } catch {}
    }

    setIsAddPersonalModalOpen(false);
    setPersonalForm({
      subject: "",
      dayOfWeek: "Thứ 2",
      shiftId: "ca-1",
      timeSlot: "08:00 - 09:30",
      mode: "offline",
      room: "",
      teacher: ""
    });
    showToast("Đã thêm môn \"" + newPersonal.subject + "\" vào " + newPersonal.dayOfWeek + "!");
  };

  const handleDeletePersonalSchedule = (id: string, name: string) => {
    if (!confirm("Bạn có chắc muốn xóa môn \"" + name + "\" khỏi lịch cá nhân?")) return;
    const updated = personalSchedules.filter(p => p.id !== id);
    setPersonalSchedules(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_personal_schedules", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      } catch {}
    }
    showToast("Đã xóa môn \"" + name + "\".");
  };

  const weekDays = useMemo(() => {
    const baseMonday = new Date(2026, 8, 21);
    baseMonday.setDate(baseMonday.getDate() + weekOffset * 7);

    const days: any[] = [];
    const dayLabels = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"];

    for (let i = 0; i < 7; i++) {
      const d = new Date(baseMonday);
      d.setDate(baseMonday.getDate() + i);
      const dayNum = String(d.getDate()).padStart(2, "0");
      const monthNum = String(d.getMonth() + 1).padStart(2, "0");
      const dateStr = dayNum + "/" + monthNum;
      const isoStr = d.getFullYear() + "-" + monthNum + "-" + dayNum;
      const isToday = isSameDate(dateStr, isoStr, currentTime);

      const dayCenterSessions = filteredSessions.filter(
        s => s.date === dateStr || s.isoDate === isoStr || (s.dayOfWeek === dayLabels[i] && weekOffset === 0)
      );
      const dayPersonalSessions = personalSchedules.filter(p => p.dayOfWeek === dayLabels[i]);

      days.push({
        label: dayLabels[i],
        dateStr,
        isoStr,
        fullDate: d,
        isToday,
        sessions: [...dayCenterSessions, ...dayPersonalSessions]
      });
    }
    return days;
  }, [weekOffset, filteredSessions, personalSchedules, currentTime]);

  const monthDays = useMemo(() => {
    const now = currentTime;
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const totalDays = new Date(year, month + 1, 0).getDate();
    const dayLabels = ["Chủ Nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

    const cells: any[] = [];
    for (let i = 0; i < offset; i++) {
      cells.push({ empty: true, key: "empty-" + i });
    }
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      const dayNum = String(day).padStart(2, "0");
      const monthNum = String(month + 1).padStart(2, "0");
      const dateStr = dayNum + "/" + monthNum;
      const isoStr = year + "-" + monthNum + "-" + dayNum;
      const isToday = isSameDate(dateStr, isoStr, now);
      const dayOfWeekLabel = dayLabels[d.getDay()];

      const centerMatch = filteredSessions.filter(s => s.date === dateStr || s.isoDate === isoStr);
      const personalMatch = personalSchedules.filter(p => p.dayOfWeek === dayOfWeekLabel);

      cells.push({
        empty: false,
        day,
        dateStr,
        isoStr,
        dayOfWeekLabel,
        isToday,
        sessions: [...centerMatch, ...personalMatch],
        key: "day-" + day
      });
    }
    return cells;
  }, [currentTime, filteredSessions, personalSchedules]);

  return (
    <div className="w-full space-y-4 max-w-6xl mx-auto font-sans text-left">
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-5 right-5 z-[500] bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2.5 font-bold text-xs sm:text-sm border border-emerald-500"
          >
            <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. BANNER LIVE */}
      {activeLiveBannerSession && (
        <div className="p-4 rounded-2xl bg-blue-600 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-blue-500">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <div className="min-w-0 text-left">
              <p className="text-[11px] font-black uppercase tracking-wider text-blue-100 flex items-center gap-1.5">
                <span>LỊCH HỌC TRỰC TUYẾN LIVE</span>
                <span className="px-1.5 py-0.2 rounded-md bg-rose-600 text-white text-[9px] font-bold">ĐANG DIỄN RA</span>
              </p>
              <p className="text-xs sm:text-sm font-extrabold text-white truncate">
                {activeLiveBannerSession.subject || activeLiveBannerSession.title} ({activeLiveBannerSession.timeSlot})
                <span className="text-blue-200 text-xs font-medium ml-2">
                  {"• " + (activeLiveBannerSession.room || "Zoom / Google Meet")}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAttended(activeLiveBannerSession) ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-100 text-xs font-bold border border-emerald-400/40">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" /> Đã điểm danh
                </span>
                {isOnlineStudent && activeLiveBannerSession.meetingUrl && (
                  <button
                    type="button"
                    onClick={() => handleRejoin(activeLiveBannerSession)}
                    className="relative z-20 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Vào lại lớp học</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleCheckIn(activeLiveBannerSession)}
                className="relative z-20 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Vào phòng học & Điểm danh</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. THANH TIÊU ĐỀ LỊCH HỌC */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-[#1D4ED8]">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              Thời khóa biểu & Lịch học TCT
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Đồng bộ đa chiều lịch học trực tuyến & lớp học tại trung tâm
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isAdmin && (
            <button
              type="button"
              onClick={() => setIsAddPersonalModalOpen(true)}
              className="relative z-20 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#1D4ED8]" />
              <span>+ Thêm môn cá nhân</span>
            </button>
          )}

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewType("week")}
              className={"relative z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer " + (
                viewType === "week"
                  ? "bg-white text-[#1D4ED8] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <CalendarIcon className="w-3.5 h-3.5" /> Lịch tuần
            </button>
            <button
              type="button"
              onClick={() => setViewType("month")}
              className={"relative z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer " + (
                viewType === "month"
                  ? "bg-white text-[#1D4ED8] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" /> Lịch tháng
            </button>
          </div>
        </div>
      </div>

      {/* 3. LƯỚI LỊCH TUẦN */}
      {viewType === "week" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setWeekOffset(prev => prev - 1)}
                className="relative z-20 p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className="relative z-20 px-3 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Tuần hiện tại
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset(prev => prev + 1)}
                className="relative z-20 p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 transition cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {weekDays[0].dateStr + "/2026 — " + weekDays[6].dateStr + "/2026"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {weekDays.map((day: any, idx: number) => (
              <div
                key={idx}
                className={"p-3 rounded-2xl border transition-all flex flex-col min-h-[220px] " + (
                  day.isToday
                    ? "bg-blue-50/50 border-blue-300 shadow-xs ring-1 ring-blue-300"
                    : "bg-white border-slate-200 hover:border-slate-300"
                )}
              >
                <div className="pb-2 mb-2 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 uppercase block">{day.label}</span>
                    <span className="text-[11px] font-semibold text-slate-400">{day.dateStr}</span>
                  </div>
                  {day.isToday && (
                    <span className="px-1.5 py-0.5 rounded-md bg-[#1D4ED8] text-white text-[9px] font-black uppercase">
                      Hôm nay
                    </span>
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  {day.sessions.length > 0 ? (
                    day.sessions.map((sess: any, sIdx: number) => {
                      const isPersonal = Boolean(sess.isPersonal);
                      const isAtt = isAttended(sess);
                      const isOnline = sess.target_mode === "online";
                      const status = getSessionStatus(sess, day.fullDate);
                      const isPast = status === "past";
                      const isLive = status === "live";

                      return (
                        <div
                          key={sess.id || sIdx}
                          className={"p-2.5 rounded-xl border transition-all space-y-1.5 text-left relative " + (
                            isPersonal
                              ? "bg-purple-50/50 border-purple-200"
                              : "bg-white border-slate-200 shadow-xs"
                          )}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#1D4ED8] font-bold text-[9px] uppercase border border-blue-200">
                              {sess.shiftName || "Ca"}
                            </span>
                            <div className="flex items-center gap-1">
                              <span
                                className={"px-1.5 py-0.5 rounded font-bold text-[8px] uppercase " + (
                                  isPersonal
                                    ? "bg-purple-100 text-purple-700"
                                    : isOnline
                                    ? "bg-indigo-100 text-indigo-700"
                                    : "bg-emerald-100 text-emerald-700"
                                )}
                              >
                                {isPersonal ? "Cá nhân" : isOnline ? "Online" : "Offline"}
                              </span>

                              {isPersonal && (
                                <button
                                  type="button"
                                  onClick={() => handleDeletePersonalSchedule(sess.id, sess.subject || sess.title)}
                                  className="relative z-20 text-slate-400 hover:text-rose-600 transition p-0.5 cursor-pointer"
                                  title="Xóa môn"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">
                            {sess.subject || sess.title}
                          </p>

                          <div className="text-[10px] text-slate-500 font-medium space-y-0.5">
                            <div className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span>{sess.timeSlot}</span>
                            </div>
                            <div className="flex items-center gap-1 truncate">
                              {isOnline ? (
                                <>
                                  <Video className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                                  <span>{sess.room || "Zoom"}</span>
                                </>
                              ) : (
                                <>
                                  <MapPin className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                                  <span>{sess.room || "P.201 TCT"}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {!isAdmin && !isPersonal && (
                            <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                              {isAtt ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Đã điểm danh
                                </span>
                              ) : isPast ? (
                                <span className="w-full text-center py-1 bg-slate-100 text-slate-400 rounded-md font-semibold border border-slate-200 select-none cursor-not-allowed">
                                  Đã kết thúc
                                </span>
                              ) : isLive ? (
                                <button
                                  type="button"
                                  onClick={() => handleCheckIn(sess)}
                                  className="relative z-20 w-full py-1 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold rounded-md transition text-center cursor-pointer shadow-xs"
                                >
                                  {isOnline ? "Vào học ngay" : "Điểm danh"}
                                </button>
                              ) : (
                                <span className="text-slate-400 italic">Chưa diễn ra</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="h-full flex items-center justify-center p-3 text-center">
                      <span className="text-xs text-slate-300 italic">Không có ca học</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. LƯỚI LỊCH THÁNG */}
      {viewType === "month" && (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-[#1D4ED8]" />
              <span>{"Tháng " + (currentTime.getMonth() + 1) + ", Năm " + currentTime.getFullYear()}</span>
            </h4>
            <span className="text-[11px] font-bold text-slate-500">Khung đào tạo & Môn học cá nhân</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Thứ 2</span>
            <span>Thứ 3</span>
            <span>Thứ 4</span>
            <span>Thứ 5</span>
            <span>Thứ 6</span>
            <span>Thứ 7</span>
            <span>Chủ Nhật</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {monthDays.map((cell: any) => {
              if (cell.empty) {
                return <div key={cell.key} className="h-16 rounded-xl bg-slate-50/40 border border-transparent" />;
              }

              return (
                <div
                  key={cell.key}
                  className={"min-h-[75px] p-2 rounded-xl border transition-all flex flex-col justify-between " + (
                    cell.isToday
                      ? "bg-blue-50/70 border-blue-400 shadow-2xs ring-1 ring-blue-500/20"
                      : cell.sessions && cell.sessions.length > 0
                      ? "bg-slate-50/50 border-slate-200 hover:border-[#1D4ED8]/40"
                      : "bg-white border-slate-100"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={"text-[11px] font-bold " + (cell.isToday ? "text-[#1D4ED8] font-black" : "text-slate-700")}>
                      {cell.day}
                    </span>
                    {cell.isToday && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                  </div>

                  <div className="space-y-1 my-1">
                    {(cell.sessions || []).slice(0, 2).map((s: any, sIdx: number) => {
                      const isPersonal = Boolean(s.isPersonal);
                      const isOnline = s.target_mode === "online";
                      return (
                        <div
                          key={s.id || sIdx}
                          title={(s.shiftName || "Ca") + ": " + (s.subject || s.title) + " (" + s.timeSlot + ")"}
                          className={"px-1 py-0.5 rounded text-[8px] font-bold truncate " + (
                            isPersonal
                              ? "bg-purple-100 text-purple-800 border border-purple-200"
                              : isOnline
                              ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                              : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          )}
                        >
                          {(s.shiftName || "Ca") + ": " + (s.subject || s.title)}
                        </div>
                      );
                    })}
                    {(cell.sessions || []).length > 2 && (
                      <span className="text-[8px] font-bold text-slate-400 block text-right">
                        {"+" + ((cell.sessions || []).length - 2) + " môn"}
                      </span>
                    )}
                  </div>

                  <div className="text-[8px] text-slate-400 text-right">
                    {((cell as any).sessions && (cell as any).sessions.length > 0) ? (
                      <span>{(cell as any).sessions.length} môn</span>
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. KHUNG GIỜ 7 CA HỌC CHUẨN */}
      <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 shadow-2xs space-y-2">
        <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#1D4ED8]" />
          <span>7 Khung giờ ca học chuẩn xác định trước tại TCT</span>
        </h5>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
          {STANDARD_SHIFTS.map(sh => (
            <div key={sh.id} className="p-1.5 rounded-lg bg-white border border-slate-200 text-center space-y-0.5">
              <span className="text-[10px] font-black text-[#1D4ED8] block uppercase">{sh.name}</span>
              <span className="text-[10px] font-bold text-slate-600 block">{sh.timeSlot}</span>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL THÊM MÔN HỌC CÁ NHÂN */}
      {isAddPersonalModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleAddPersonalSchedule}
            className="bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 space-y-5 my-auto text-left border border-slate-100"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#1D4ED8]" /> Thêm môn học cá nhân
              </h4>
              <button
                type="button"
                onClick={() => setIsAddPersonalModalOpen(false)}
                className="text-slate-400 hover:text-rose-500 cursor-pointer p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tên môn học / Chuyên đề *</label>
              <input
                required
                type="text"
                value={personalForm.subject}
                onChange={e => setPersonalForm({ ...personalForm, subject: e.target.value })}
                placeholder="VD: Hóa học 12, Tiếng Anh, Luyện TSA..."
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#1D4ED8] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Thứ trong tuần *</label>
                <select
                  value={personalForm.dayOfWeek}
                  onChange={e => setPersonalForm({ ...personalForm, dayOfWeek: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#1D4ED8] outline-none bg-white cursor-pointer"
                >
                  {["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ Nhật"].map(dow => (
                    <option key={dow} value={dow}>{dow}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ca học chuẩn *</label>
                <select
                  value={personalForm.shiftId}
                  onChange={e => {
                    const sh = STANDARD_SHIFTS.find(s => s.id === e.target.value);
                    setPersonalForm({
                      ...personalForm,
                      shiftId: e.target.value,
                      timeSlot: sh?.timeSlot || "08:00 - 09:30"
                    });
                  }}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#1D4ED8] outline-none bg-white cursor-pointer"
                >
                  {STANDARD_SHIFTS.map(sh => (
                    <option key={sh.id} value={sh.id}>{sh.name + " (" + sh.timeSlot + ")"}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hình thức học</label>
                <select
                  value={personalForm.mode}
                  onChange={e => setPersonalForm({ ...personalForm, mode: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#1D4ED8] outline-none bg-white cursor-pointer"
                >
                  <option value="offline">Trực tiếp (Offline)</option>
                  <option value="online">Trực tuyến (Online)</option>
                  <option value="self">Tự học</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phòng học / Link</label>
                <input
                  type="text"
                  value={personalForm.room}
                  onChange={e => setPersonalForm({ ...personalForm, room: e.target.value })}
                  placeholder="VD: P.201, Zoom..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#1D4ED8] outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddPersonalModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer"
              >
                Lưu môn học
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}