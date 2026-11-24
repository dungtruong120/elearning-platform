"use client";

import React from "react";
import {
  BookOpen,
  Calendar,
  Target,
  BarChart2,
  Trophy,
  LogOut,
  LayoutDashboard,
  Sparkles,
  Layers
} from "lucide-react";
import { Profile } from "@/types";

interface SidebarProps {
  user: Profile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onToggleSidebar?: () => void;
  onLogout?: () => void;
}

export function Sidebar({
  user,
  activeTab,
  setActiveTab,
  onLogout
}: SidebarProps) {
  const navGroups = [
    {
      title: "Chung",
      items: [
        { key: "overview", label: "Tổng quan", icon: LayoutDashboard },
        { key: "schedule", label: "Lịch học", icon: Calendar }
      ]
    },
    {
      title: "Ôn thi THPT",
      items: [
        { key: "courses", label: "Bài học & Kiểm tra", icon: BookOpen },
        { key: "practice", label: "Luyện đề THPT", icon: Target }
      ]
    },
    {
      title: "Luyện thi ĐGNL HSA",
      items: [
        { key: "hsa_courses", label: "Tổng ôn HSA", icon: Layers },
        { key: "hsa_practice", label: "Phòng luyện HSA", icon: Sparkles }
      ]
    },
    {
      title: "Theo dõi",
      items: [
        { key: "progress", label: "Tiến trình", icon: BarChart2 },
        { key: "leaderboard", label: "Xếp hạng", icon: Trophy }
      ]
    }
  ];

  const mobileBottomItems = [
    { key: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { key: "courses", label: "Bài học", icon: BookOpen },
    { key: "practice", label: "Luyện đề", icon: Target },
    { key: "hsa_courses", label: "Tổng ôn HSA", icon: Layers },
    { key: "hsa_practice", label: "Thi HSA", icon: Sparkles }
  ];

  return (
    <>
      {/* 1. SIDEBAR DESKTOP: Tông Slate Navy dịu mắt, phân tách rõ ràng với nền nội dung */}
      <aside className="hidden md:flex w-60 bg-[#0F172A] border-r border-slate-800 text-slate-300 flex-col shrink-0 p-4 h-screen select-none">
        <div className="flex items-center gap-3 px-2 mb-6 shrink-0">
          <div className="w-9 h-9 bg-[#2563EB] text-white rounded-xl flex items-center justify-center font-black text-xs shadow-sm">
            TCT
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-[14.5px] text-white tracking-tight leading-none">
              TÂM CHÍ TÀI
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider mt-1 uppercase">
              Cổng Học Tập
            </p>
          </div>
        </div>

        <nav className="space-y-4 flex-1 overflow-y-auto no-scrollbar pr-0.5">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveTab(item.key)}
                      className={
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-all duration-150 cursor-pointer " +
                        (isActive
                          ? "bg-[#2563EB] text-white font-semibold shadow-xs"
                          : "text-slate-300 font-medium hover:bg-slate-800/80 hover:text-white")
                      }
                    >
                      <Icon
                        className={
                          "w-4 h-4 shrink-0 " +
                          (isActive ? "text-white" : "text-slate-400")
                        }
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto pt-3 border-t border-slate-800 shrink-0 space-y-2">
          <div className="px-3 py-2.5 bg-slate-800/70 rounded-xl border border-slate-700/70">
            <p className="text-xs font-bold text-white truncate">
              {user?.full_name || "Học sinh"}
            </p>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              {user?.grade || "Lớp 12"}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-all font-semibold text-xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* 2. BOTTOM NAVIGATION BAR CHO MOBILE */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-xl border-t border-slate-200 px-1 pt-1.5 pb-2 flex items-center justify-between select-none">
        {mobileBottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={
                "flex-1 flex flex-col items-center justify-center py-0.5 transition-all cursor-pointer " +
                (isActive ? "text-[#1D4ED8]" : "text-slate-400 hover:text-slate-600")
              }
            >
              <div className={"p-1 rounded-lg " + (isActive ? "bg-blue-50" : "")}>
                <Icon className="w-4 h-4" />
              </div>
              <span
                className={
                  "text-[9.5px] tracking-tight mt-0.5 leading-none " +
                  (isActive ? "font-bold" : "font-medium")
                }
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}

export default Sidebar;
