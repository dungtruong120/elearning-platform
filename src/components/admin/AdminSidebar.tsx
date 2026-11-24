"use client";

import React from "react";
import {
  BookOpen,
  Target,
  BarChart2,
  Bell,
  UserCheck,
  Calendar,
  FileCheck,
  LogOut,
  ScanLine
} from "lucide-react";
import { AdminTab } from "@/types/admin";

interface AdminSidebarProps {
  activeTab: AdminTab | "paper-exams" | string;
  onSwitchTab: (tab: any) => void;
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
    { key: "paper-exams" as any, label: "Chấm thi & Bài giấy", icon: ScanLine },
    { key: "analytics" as AdminTab, label: "Điểm số & Xếp hạng", icon: BarChart2 },
    { key: "notifications" as AdminTab, label: "Quản lý Thông báo", icon: Bell },
    { key: "students" as AdminTab, label: "Quản lý Học viên", icon: UserCheck },
    { key: "online_schedule" as AdminTab, label: "Lịch học & Ca học", icon: Calendar },
    { key: "reports" as AdminTab, label: "Báo cáo Phụ huynh", icon: FileCheck }
  ];

  return (
    <aside className="w-60 bg-white border-r border-slate-200/90 text-slate-700 flex flex-col shrink-0 p-4 h-screen select-none">
      <div className="flex items-center gap-3 px-2 mb-6 shrink-0">
        <div className="w-9 h-9 bg-[#1D4ED8] text-white rounded-xl flex items-center justify-center font-black text-xs shadow-2xs">
          TCT
        </div>
        <div className="overflow-hidden">
          <h1 className="font-bold text-[14.5px] text-slate-900 tracking-tight leading-none">
            TÂM CHÍ TÀI
          </h1>
          <p className="text-[10px] text-slate-400 font-semibold tracking-wider mt-1 uppercase">
            Quản trị viên
          </p>
        </div>
      </div>

      <nav className="space-y-1 flex-1 overflow-y-auto no-scrollbar">
        {navItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSwitchTab(tab.key)}
              className={
                "w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-[13px] transition-all duration-150 cursor-pointer " +
                (isActive
                  ? "bg-blue-50 text-[#1D4ED8] font-bold"
                  : "text-slate-600 font-medium hover:bg-slate-50 hover:text-slate-900")
              }
            >
              <Icon
                className={
                  "w-4 h-4 shrink-0 " +
                  (isActive ? "text-[#1D4ED8]" : "text-slate-400")
                }
              />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-3 border-t border-slate-100 shrink-0">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50/70 transition-all font-semibold text-xs cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span>Đăng xuất Admin</span>
        </button>
      </div>
    </aside>
  );
}
