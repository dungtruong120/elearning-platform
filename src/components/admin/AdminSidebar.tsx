"use client";

import React from "react";
import { 
  BookOpen, Target, BarChart2, Bell, UserCheck, 
  Calendar, FileCheck, LogOut 
} from "lucide-react";
import { AdminTab } from "@/types/admin";

interface AdminSidebarProps {
  activeTab: AdminTab;
  onSwitchTab: (tab: AdminTab) => void;
  onLogout: () => void;
}

export default function AdminSidebar({
  activeTab,
  onSwitchTab,
  onLogout
}: AdminSidebarProps) {
  const navItems = [
    { key: "lessons" as AdminTab, label: "Nội dung bài học", icon: BookOpen },
    { key: "practice" as AdminTab, label: "Hệ thống Luyện đề", icon: Target },
    { key: "analytics" as AdminTab, label: "Điểm số & Xếp hạng", icon: BarChart2 },
    { key: "notifications" as AdminTab, label: "Quản lý Thông báo", icon: Bell },
    { key: "students" as AdminTab, label: "Quản lý Học viên & Duyệt", icon: UserCheck },
    { key: "online_schedule" as AdminTab, label: "Lịch học & Điểm danh Online", icon: Calendar },
    { key: "reports" as AdminTab, label: "Báo cáo Phụ huynh", icon: FileCheck }
  ];

  return (
    <aside className="w-64 bg-[#1E40AF] border-r border-[#1E40AF] text-white/90 flex flex-col shrink-0 p-5 shadow-[4px_0_24px_rgba(15,23,42,0.05)] h-screen">
      <div className="flex items-center gap-3 mb-6 shrink-0"> 
        <div className="w-10 h-10 bg-white text-[#1E40AF] rounded-[14px] flex items-center justify-center font-black text-sm shadow-md">
          TCT
        </div>
        <div className="overflow-hidden">
          <h1 className="font-extrabold text-[15px] text-white tracking-tight leading-none">
            TÂM CHÍ TÀI
          </h1>
          <p className="text-[9px] text-blue-200 font-bold tracking-widest mt-1 uppercase">
            Admin Panel
          </p>
        </div>
      </div>

      <nav className="space-y-1.5 flex-1 overflow-y-auto no-scrollbar">
        {navItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSwitchTab(tab.key)}
              className={
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[13px] font-bold transition-all duration-200 cursor-pointer " +
                (isActive 
                  ? "bg-white text-[#1E40AF] shadow-sm font-black" 
                  : "text-blue-100 hover:bg-white/10")
              }
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
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-rose-600/90 text-blue-100 hover:text-white border border-white/10 hover:border-rose-500/50 transition-all duration-200 font-bold text-xs shadow-xs cursor-pointer group"
        >
          <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform shrink-0" />
          <span>Đăng xuất Admin</span>
        </button>
      </div>
    </aside>
  );
}
