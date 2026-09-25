"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  BookOpen, 
  Target, 
  FileQuestion, 
  FileCheck2, 
  LogOut, 
  X,
  School,
  GraduationCap
} from "lucide-react";
import { Profile } from "@/types";

interface MobileBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: Profile;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  user,
}) => {
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);

  const navItems = [
    { id: "courses", label: "Khóa học", icon: BookOpen },
    { id: "practice", label: "Luyện đề", icon: Target, badge: true },
    { id: "assessments", label: "Kiểm tra", icon: FileQuestion },
    { id: "assignments", label: "Lịch sử", icon: FileCheck2 },
  ];

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/90 backdrop-blur-md border-t border-slate-200 shadow-lg px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] font-sans">
        <div className="grid grid-cols-5 items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all relative ${
                  isActive ? "text-blue-600 font-bold" : "text-slate-400 hover:text-slate-600 font-medium"
                }`}
              >
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform ${isActive ? "scale-110" : ""}`} />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white"></span>
                  )}
                </div>
                <span className="text-[10px] mt-1 tracking-tight truncate max-w-[60px]">
                  {item.label}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowProfileDrawer(true)}
            className="flex flex-col items-center justify-center py-1 text-slate-400 hover:text-slate-600 font-medium transition"
          >
            <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold border border-blue-200">
              {user.full_name ? user.full_name.slice(0, 1).toUpperCase() : "U"}
            </div>
            <span className="text-[10px] mt-1 tracking-tight truncate max-w-[60px]">
              Cá nhân
            </span>
          </button>
        </div>
      </nav>

      {/* Drawer hồ sơ học sinh */}
      <AnimatePresence>
        {showProfileDrawer && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end font-serif md:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfileDrawer(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              className="relative bg-white rounded-t-3xl p-6 shadow-2xl border-t border-slate-200 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 font-sans">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-blue-600" />
                  <h4 className="text-sm font-bold text-slate-900">Hồ Sơ Học Sinh</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfileDrawer(false)}
                  className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center text-base font-bold shadow-md shadow-blue-500/20 font-sans">
                  {user.full_name ? user.full_name.slice(0, 2).toUpperCase() : "TS"}
                </div>
                <div className="overflow-hidden">
                  <h3 className="text-base font-bold text-slate-900 truncate">{user.full_name}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 font-sans truncate">
                    <School className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{user.school}</span>
                  </p>
                  <span className="inline-block text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md mt-1.5 border border-blue-200 font-sans">
                    {user.grade}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowProfileDrawer(false);
                  alert("Đã đăng xuất tài khoản!");
                }}
                className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-sans font-bold flex items-center justify-center gap-2 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Đăng xuất tài khoản</span>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};