"use client";

import React from "react";
import { 
  BookOpen, Calendar, Target, BarChart2, Trophy, LogOut, LayoutDashboard 
} from "lucide-react";
import { Profile } from "@/types";

interface SidebarProps {
  user: Profile;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onToggleSidebar?: () => void;
  onLogout?: () => void;
}

export function Sidebar({ user, activeTab, setActiveTab, onToggleSidebar, onLogout }: SidebarProps) {
  const menuItems = [
    { key: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { key: "courses", label: "Bài học", icon: BookOpen },
    { key: "schedule", label: "Lịch học", icon: Calendar },
    { key: "practice", label: "Luyện đề", icon: Target },
    { key: "progress", label: "Tiến trình", icon: BarChart2 },
    { key: "leaderboard", label: "Xếp hạng", icon: Trophy }
  ];

  return (
    <>
      {/* 1. SIDEBAR DÀNH CHO LAPTOP & DESKTOP (md:flex) */}
      <aside className="hidden md:flex w-64 bg-[#1E40AF] text-white/90 flex-col shrink-0 p-5 h-screen shadow-lg select-none">
        <div className="flex items-center gap-3 mb-8 shrink-0">
          <div className="w-10 h-10 bg-white text-[#1E40AF] rounded-[14px] flex items-center justify-center font-black text-sm shadow-md">
            TCT
          </div>
          <div>
            <h1 className="font-extrabold text-[15px] text-white tracking-tight leading-none">TÂM CHÍ TÀI</h1>
            <p className="text-[9px] text-blue-200 font-bold tracking-widest mt-1 uppercase">Học Trực Tuyến</p>
          </div>
        </div>

        <nav className="space-y-1.5 flex-1 overflow-y-auto no-scrollbar">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={"w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[13px] font-bold transition-all duration-200 cursor-pointer " + (
                  isActive 
                    ? "bg-white text-[#1E40AF] shadow-sm font-black" 
                    : "text-blue-100 hover:bg-white/10"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-blue-400/20 shrink-0 space-y-3">
          <div className="px-3.5 py-2.5 bg-white/10 rounded-2xl">
            <p className="text-xs font-bold text-white truncate">{user?.full_name || "Học sinh"}</p>
            <p className="text-[10px] text-blue-200 font-semibold">{user?.grade || "Lớp 12"} • {user?.learning_mode === "online" ? "Online" : "Offline"}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-white/10 hover:bg-rose-600/90 text-blue-100 hover:text-white border border-white/10 transition-all font-bold text-xs cursor-pointer group"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform shrink-0" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* 2. BOTTOM NAVIGATION BAR CỐ ĐỊNH Ở ĐÁY CHO MOBILE VÀ IPAD (md:hidden) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white/95 backdrop-blur-2xl border-t border-slate-200/90 shadow-[0_-4px_24px_rgba(15,23,42,0.08)] px-1 pt-1 pb-2 flex items-center justify-between select-none">
        {menuItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTab(item.key)}
              className={"flex-1 flex flex-col items-center justify-center py-1 transition-all cursor-pointer " + (
                isActive 
                  ? "text-[#1D4ED8]" 
                  : "text-slate-400 hover:text-slate-600 active:scale-95"
              )}
            >
              <div className={"p-1 rounded-xl transition-all " + (isActive ? "bg-blue-50" : "")}>
                <Icon className={"w-4.5 h-4.5 transition-transform " + (isActive ? "scale-110 text-[#1D4ED8]" : "")} />
              </div>
              <span className={"text-[9px] tracking-tight mt-0.5 leading-none " + (isActive ? "font-black" : "font-semibold")}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Nút Đăng xuất tiện lợi ngay trên thanh mobile */}
        <button
          type="button"
          onClick={() => {
            if (confirm("Bạn có chắc chắn muốn đăng xuất?")) {
              onLogout?.();
            }
          }}
          className="flex-1 flex flex-col items-center justify-center py-1 text-rose-500 hover:text-rose-600 active:scale-95 transition-all cursor-pointer"
          title="Đăng xuất"
        >
          <div className="p-1 rounded-xl hover:bg-rose-50">
            <LogOut className="w-4.5 h-4.5" />
          </div>
          <span className="text-[9px] font-bold tracking-tight mt-0.5 leading-none">
            Thoát
          </span>
        </button>
      </nav>
    </>
  );
}

export default Sidebar;
