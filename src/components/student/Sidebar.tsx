"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  LayoutGrid, BookOpen, Calendar, Target, 
  TrendingUp, Trophy, LogOut, PanelLeftClose 
} from "lucide-react";
import { Profile } from "@/types";

interface SidebarProps {
  user: Profile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onToggleSidebar?: () => void;
  onLogout?: () => void;
  hasLiveMeeting?: boolean;
}

export function Sidebar({ 
  user, 
  activeTab, 
  setActiveTab, 
  onToggleSidebar,
  onLogout,
  hasLiveMeeting = false
}: SidebarProps) {
  const [unattendedLiveCount, setUnattendedLiveCount] = useState<number>(0);
  const isOnlineStudent = user?.study_mode === "online" || user?.learning_mode === "online";

  const checkLiveAttendance = useCallback(() => {
    if (!user || !isOnlineStudent || typeof window === "undefined") {
      setUnattendedLiveCount(0);
      return;
    }
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const savedSessions = localStorage.getItem("tct_schedule_sessions") || localStorage.getItem("edunexus_online_sessions");
      if (!savedSessions) {
        setUnattendedLiveCount(0);
        return;
      }

      const sessions = JSON.parse(savedSessions);
      const activeSessions = Array.isArray(sessions) 
        ? sessions.filter((s: any) => (s.meet_link || s.zoom_link || s.meetingUrl) && (!s.date || s.date === todayStr || s.isoDate === todayStr))
        : [];

      const savedAtt = localStorage.getItem("tct_attendance_records") || localStorage.getItem("edunexus_attendance");
      const records = savedAtt ? JSON.parse(savedAtt) : [];

      const unattended = activeSessions.filter((s: any) => {
        return !records.some((r: any) => 
          (r.sessionId === s.id || r.sessionDate === s.date) && 
          (r.studentId === user.id || r.studentName === user.full_name) && 
          r.status === "present"
        );
      });

      setUnattendedLiveCount(unattended.length);
    } catch {
      setUnattendedLiveCount(0);
    }
  }, [user, isOnlineStudent]);

  useEffect(() => {
    checkLiveAttendance();
    window.addEventListener("storage", checkLiveAttendance);
    window.addEventListener("attendance_updated", checkLiveAttendance);
    const interval = setInterval(checkLiveAttendance, 5000);
    return () => {
      window.removeEventListener("storage", checkLiveAttendance);
      window.removeEventListener("attendance_updated", checkLiveAttendance);
      clearInterval(interval);
    };
  }, [checkLiveAttendance]);

  const navItems = [
    { id: "overview", label: "Tổng quan", icon: LayoutGrid },
    { id: "courses", label: "Nội dung bài học", icon: BookOpen },
    {
      id: "schedule",
      label: "Lịch học",
      icon: Calendar,
      badge: hasLiveMeeting || unattendedLiveCount > 0 ? (
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[9px] font-black">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
          </span>
          <span>LIVE</span>
        </span>
      ) : (
        <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[9px] font-bold">
          MỚI
        </span>
      )
    },
    {
      id: "practice",
      label: "Luyện đề",
      icon: Target,
      badge: (
        <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[9px] font-bold">
          KHO ĐỀ
        </span>
      )
    },
    { id: "progress", label: "Tiến trình", icon: TrendingUp },
    { id: "leaderboard", label: "Xếp hạng", icon: Trophy }
  ];

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
      return;
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("tct_current_user");
        localStorage.removeItem("edunexus_current_user");
        localStorage.removeItem("edunexus_user_session");
        window.location.href = "/";
      } catch {
        window.location.href = "/";
      }
    }
  };

  const initialLetter = user?.full_name ? user.full_name.trim().charAt(0).toUpperCase() : "T";

  return (
    <aside className="w-60 h-full bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl backdrop-saturate-150 border-r border-white/60 dark:border-white/10 flex flex-col justify-between select-none font-sans text-left transition-all">
      {/* 1. LOGO BRAND TCT (Chỉ giữ duy nhất hình vuông bo góc, đã xóa chữ thừa) */}
      <div>
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100/60 dark:border-slate-800/60">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#1D4ED8] to-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-md shadow-blue-600/20">
            TCT
          </div>

          {/* Nút thu gọn / đóng Sidebar */}
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 transition cursor-pointer"
              title="Đóng sidebar để chuyển sang thanh ngang"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 2. MENU ĐIỀU HƯỚNG DỌC */}
        <nav className="p-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isActive 
                    ? "bg-[#1D4ED8] text-white shadow-md shadow-blue-600/20 font-extrabold" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 3. PROFILE VÀ NÚT ĐĂNG XUẤT */}
      <div className="p-3.5 border-t border-slate-100/60 dark:border-slate-800/60 space-y-2">
        <div className="flex items-center gap-2.5 p-2 bg-slate-50/80 rounded-xl border border-slate-100">
          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0">
            {initialLetter}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-xs text-slate-900 truncate">
              {user?.full_name || "Học sinh"}
            </h4>
            <p className="text-[10px] text-slate-400 truncate">
              {(user?.grade || "Lớp 12") + " • " + (user?.school || "THPT")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full py-1.5 px-3 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/60 text-rose-600 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;