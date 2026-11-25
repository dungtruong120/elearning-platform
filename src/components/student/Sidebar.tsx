"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Calendar,
  Target,
  BarChart2,
  Trophy,
  LogOut,
  LayoutDashboard,
  Sparkles,
  Layers,
  MoreHorizontal,
  X
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
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

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

  const mobilePrimaryItems = [
    { key: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { key: "courses", label: "Bài học", icon: BookOpen },
    { key: "practice", label: "Luyện đề", icon: Target },
    { key: "hsa_courses", label: "Ôn HSA", icon: Layers },
    { key: "hsa_practice", label: "Thi HSA", icon: Sparkles }
  ];

  const mobileSecondaryItems = [
    { key: "schedule", label: "Lịch học", icon: Calendar },
    { key: "progress", label: "Tiến trình học tập", icon: BarChart2 },
    { key: "leaderboard", label: "Bảng xếp hạng", icon: Trophy }
  ];

  const isSecondaryTabActive = ["schedule", "progress", "leaderboard"].includes(activeTab);

  return (
    <>
      {/* 1. SIDEBAR DESKTOP */}
      <aside className="hidden md:flex w-60 bg-gradient-to-b from-[#1E40AF] to-[#1D4ED8] border-r border-blue-800/40 text-white flex-col shrink-0 p-4 h-screen select-none">
        <div className="flex items-center gap-3 px-2 mb-6 shrink-0">
          <div className="w-9 h-9 bg-white text-[#1E40AF] rounded-xl flex items-center justify-center font-black text-xs shadow-xs">
            TCT
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-[14.5px] text-white tracking-tight leading-none">
              TÂM CHÍ TÀI
            </h1>
            <p className="text-[10px] text-blue-200 font-semibold tracking-wider mt-1 uppercase">
              Cổng Học Tập
            </p>
          </div>
        </div>

        <nav className="space-y-4 flex-1 overflow-y-auto no-scrollbar pr-0.5">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-blue-200/75">
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
                          ? "bg-white text-[#1E40AF] font-bold shadow-xs"
                          : "text-blue-100/90 font-medium hover:bg-white/10 hover:text-white")
                      }
                    >
                      <Icon
                        className={
                          "w-4 h-4 shrink-0 " +
                          (isActive ? "text-[#1E40AF]" : "text-blue-200/80")
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

        <div className="mt-auto pt-3 border-t border-white/15 shrink-0 space-y-2">
          <div className="px-3 py-2.5 bg-white/10 rounded-xl border border-white/10">
            <p className="text-xs font-bold text-white truncate">
              {user?.full_name || "Học sinh"}
            </p>
            <p className="text-[11px] text-blue-200 font-medium mt-0.5">
              {user?.grade || "Lớp 12"}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-blue-100 hover:text-white hover:bg-rose-500/85 transition-all font-semibold text-xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* 2. BOTTOM NAVIGATION BAR CHO MOBILE (5 TAB CHÍNH + NÚT THÊM) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-xl border-t border-slate-200 px-1 pt-1.5 pb-2 flex items-center justify-between select-none">
        {mobilePrimaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setIsMobileMoreOpen(false);
                setActiveTab(item.key);
              }}
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

        <button
          type="button"
          onClick={() => setIsMobileMoreOpen((prev) => !prev)}
          className={
            "flex-1 flex flex-col items-center justify-center py-0.5 transition-all cursor-pointer " +
            (isSecondaryTabActive || isMobileMoreOpen
              ? "text-[#1D4ED8]"
              : "text-slate-400 hover:text-slate-600")
          }
        >
          <div
            className={
              "p-1 rounded-lg " +
              (isSecondaryTabActive || isMobileMoreOpen ? "bg-blue-50" : "")
            }
          >
            <MoreHorizontal className="w-4 h-4" />
          </div>
          <span
            className={
              "text-[9.5px] tracking-tight mt-0.5 leading-none " +
              (isSecondaryTabActive || isMobileMoreOpen ? "font-bold" : "font-medium")
            }
          >
            Thêm
          </span>
        </button>
      </nav>

      {/* 3. NGĂN KÉO "THÊM" TRÊN MOBILE (CHỨA LỊCH HỌC, TIẾN TRÌNH, XẾP HẠNG, ĐĂNG XUẤT) */}
      {isMobileMoreOpen && (
        <div
          onClick={() => setIsMobileMoreOpen(false)}
          className="md:hidden fixed inset-0 z-[95] bg-slate-900/40 backdrop-blur-2xs flex items-end pb-16"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white rounded-t-2xl border-t border-slate-200 p-4 space-y-3 shadow-xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  {user?.full_name || "Học sinh"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {user?.grade || "Lớp 12"} • Tiện ích mở rộng
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {mobileSecondaryItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.key);
                      setIsMobileMoreOpen(false);
                    }}
                    className={
                      "p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center transition cursor-pointer " +
                      (isActive
                        ? "bg-blue-50 border-blue-200 text-[#1D4ED8] font-bold"
                        : "bg-slate-50/70 border-slate-200/80 text-slate-700 font-semibold hover:bg-slate-100")
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[11px] leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsMobileMoreOpen(false);
                if (confirm("Bạn có chắc chắn muốn đăng xuất?")) {
                  onLogout?.();
                }
              }}
              className="w-full py-2.5 rounded-xl border border-rose-200 bg-rose-50/60 text-rose-600 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất tài khoản</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default Sidebar;
