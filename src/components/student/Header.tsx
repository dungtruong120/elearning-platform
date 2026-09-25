"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, Bell, PanelLeft, X, CheckCheck, 
  Award, FileText, Calendar, Sparkles, MessageSquare 
} from "lucide-react";
import { Profile } from "@/types";

interface HeaderProps {
  user: Profile;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  allAttempts?: any[];
  practiceExams?: any[];
  sysNotifications?: any[];
}

export function Header({
  user,
  isSidebarOpen = true,
  onToggleSidebar,
  activeTab = "overview",
  setActiveTab,
  searchQuery = "",
  onSearchChange,
  allAttempts = [],
  practiceExams = [],
  sysNotifications = []
}: HeaderProps) {
  const [showNotifPopup, setShowNotifPopup] = useState<boolean>(false);
  const [markedRead, setMarkedRead] = useState<boolean>(false);

  // Hook useRef bắt sự kiện click outside để đóng popup thông báo (YÊU CẦU 3)
  const popoverRef = useRef<HTMLDivElement>(null);
  const bellButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showNotifPopup) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        bellButtonRef.current &&
        !bellButtonRef.current.contains(target)
      ) {
        setShowNotifPopup(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showNotifPopup]);

  // 1. TỔNG HỢP DANH SÁCH THÔNG BÁO ĐẦY ĐỦ
  const fullNotificationList = useMemo(() => {
    const list: any[] = [];

    // Điểm số bài tập / bài thi mới nhất của học sinh
    (allAttempts || [])
      .filter((a: any) => a.studentId === user?.id || !a.studentId)
      .slice(0, 3)
      .forEach((att: any, idx: number) => {
        const scoreVal = typeof att.score === "number" ? att.score.toFixed(1) : "0.0";
        const correctVal = att.correctCount || 0;
        const totalVal = att.totalQuestions || 10;
        list.push({
          id: "score-" + (att.attemptId || idx),
          type: "score",
          title: "Kết quả: " + (att.quizTitle || "Bài kiểm tra"),
          content: "Bạn đạt " + scoreVal + "/10 điểm (" + correctVal + "/" + totalVal + " câu đúng). Nhấn để xem lại bảng xếp hạng.",
          time: att.submittedAt 
            ? new Date(att.submittedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) 
            : "Vừa xong",
          targetTab: "progress"
        });
      });

    // Đề luyện thi mới được cập nhật
    (practiceExams || []).slice(0, 2).forEach((ex: any, idx: number) => {
      const durationVal = ex.duration_minutes || 45;
      list.push({
        id: "exam-" + (ex.id || idx),
        type: "exam",
        title: "Đề thi mới: " + (ex.title || "Luyện đề"),
        content: "Đề thi chuyên đề " + (ex.category || "Luyện đề") + " đã mở. Thời gian làm bài " + durationVal + " phút.",
        time: "Hôm nay",
        targetTab: "practice"
      });
    });

    // Thông báo từ giáo viên / hệ thống
    (sysNotifications || []).forEach((n: any) => {
      list.push({
        id: n.id,
        type: n.type || "teacher",
        title: n.title,
        content: n.content,
        time: n.createdAt 
          ? new Date(n.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) 
          : "Gần đây",
        targetTab: "notifications"
      });
    });

    // Mặc định lời nhắc nếu chưa có
    if (list.length === 0) {
      list.push({
        id: "default-welcome",
        type: "teacher",
        title: "Chào mừng bạn đến với dungtruong.tct",
        content: "Chúc bạn có những buổi học bổ ích và đạt thành tích cao trong các kỳ thi sắp tới.",
        time: "Hôm nay",
        targetTab: "overview"
      });
    }

    return list;
  }, [allAttempts, practiceExams, sysNotifications, user?.id]);

  const unreadCount = markedRead ? 0 : fullNotificationList.length;

  const handleMarkAllRead = () => {
    setMarkedRead(true);
  };

  const handleViewAllCenter = () => {
    setShowNotifPopup(false);
    if (setActiveTab) setActiveTab("notifications");
  };

  return (
    <header className="h-16 px-4 sm:px-6 bg-white border-b border-slate-200 shadow-xs flex items-center justify-between gap-3 sticky top-0 z-30 transition-all font-sans text-left">
      {/* 1. LỜI CHÀO GỌN GÀNG (FLAT MODERN SẮC NÉT - YÊU CẦU 2) */}
      <div className="flex items-center gap-3 shrink-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition cursor-pointer"
            title="Đóng / mở menu"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}
        <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
          Chào, {user?.full_name || "Trương Ngọc Quang"}!
        </h1>
      </div>

      {/* 2. THANH MENU CAPSULE KHI ĐÓNG SIDEBAR (FLAT CLEAN) */}
      {!isSidebarOpen && (
        <div className="hidden lg:flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 shrink-0">
          {[
            { id: "overview", label: "Tổng quan" },
            { id: "courses", label: "Bài học" },
            { id: "schedule", label: "Lịch học" },
            { id: "practice", label: "Luyện đề" },
            { id: "progress", label: "Tiến trình" },
            { id: "leaderboard", label: "Vinh danh" }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab && setActiveTab(tab.id)}
              className={"px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer " + (
                activeTab === tab.id
                  ? "bg-[#1D4ED8] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* 3. THANH TÌM KIẾM TINH GỌN */}
      <div className="flex-1 max-w-xs sm:max-w-sm mx-1 sm:mx-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange && onSearchChange(e.target.value)}
            placeholder="Tìm bài học, đề thi..."
            className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-[#1D4ED8] focus:bg-white focus:ring-1 focus:ring-[#1D4ED8] transition"
          />
        </div>
      </div>

      {/* 4. KHỐI LỚP & CHUÔNG THÔNG BÁO CHUẨN w-5 h-5 */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 relative">
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>{user?.grade || "Lớp 12"}</span>
        </div>

        {/* NÚT CHUÔNG THÔNG BÁO VỚI BADGE SỐ LƯỢNG NỔI BẬT */}
        <button
          ref={bellButtonRef}
          type="button"
          onClick={() => setShowNotifPopup(!showNotifPopup)}
          className="relative p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition cursor-pointer"
          title="Thông báo hệ thống"
        >
          <Bell className="w-5 h-5 text-slate-700" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-rose-500 text-white text-[11px] font-black rounded-full flex items-center justify-center shadow-xs">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* 5. POPUP THÔNG BÁO ĐẦY ĐỦ CÓ CLICK OUTSIDE TO CLOSE (YÊU CẦU 3) */}
        <AnimatePresence>
          {showNotifPopup && (
            <>
              {/* Lớp nền trong suốt bắt click outside toàn màn hình */}
              <div 
                className="fixed inset-0 z-40 bg-transparent cursor-default"
                onClick={() => setShowNotifPopup(false)}
              ></div>

              <motion.div
                ref={popoverRef}
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                onClick={e => e.stopPropagation()}
                className="absolute right-0 top-14 w-80 sm:w-96 bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-3.5 z-50 text-left cursor-default"
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black tracking-tight text-slate-900">Thông báo</span>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-black">
                        {unreadCount} mới
                      </span>
                    )}
                  </div>
                  <button 
                    type="button"
                    onClick={() => setShowNotifPopup(false)} 
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
                    title="Đóng"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* DANH SÁCH THÔNG BÁO TỔNG HỢP */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {fullNotificationList.map((item: any) => {
                    const isScore = item.type === "score";
                    const isExam = item.type === "exam";

                    let cardClass = "p-3 rounded-xl border transition cursor-pointer ";
                    if (isScore) {
                      cardClass += "bg-blue-50/70 hover:bg-blue-100/70 border-blue-200";
                    } else if (isExam) {
                      cardClass += "bg-purple-50/70 hover:bg-purple-100/70 border-purple-200";
                    } else {
                      cardClass += "bg-slate-50 hover:bg-slate-100 border-slate-200";
                    }

                    return (
                      <div 
                        key={item.id} 
                        onClick={() => {
                          setShowNotifPopup(false);
                          if (setActiveTab && item.targetTab) setActiveTab(item.targetTab);
                        }}
                        className={cardClass}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            {isScore ? (
                              <Award className="w-3.5 h-3.5 text-[#1D4ED8]" />
                            ) : isExam ? (
                              <FileText className="w-3.5 h-3.5 text-purple-600" />
                            ) : (
                              <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span className="text-xs font-black text-slate-800 line-clamp-1">{item.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium shrink-0">{item.time}</span>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed line-clamp-2">
                          {item.content}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* 2 NÚT HÀNH ĐỘNG Ở CHÂN POPUP */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Đánh dấu đã đọc tất cả</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleViewAllCenter}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] text-xs font-bold transition cursor-pointer"
                  >
                    Xem tất cả
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

export default Header;
