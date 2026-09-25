"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Award, Search, Sparkles, CheckCircle2 } from "lucide-react";
import { Profile, Chapter } from "@/types";

interface StudentLeaderboardViewProps {
  profile: Profile;
  chapters: Chapter[];
  allAttempts: any[];
  allowedMode?: "offline" | "online" | "all";
}

export function StudentLeaderboardView({ 
  profile, 
  chapters, 
  allAttempts, 
  allowedMode = "all" 
}: StudentLeaderboardViewProps) {
  const [filterMode, setFilterMode] = useState<"all" | "online" | "offline">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const isOfflineOnly = allowedMode === "offline";
  const isOnlineOnly = allowedMode === "online";

  const registeredStudents = useMemo(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_registered_students");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [
      { id: "stu-1", full_name: "Trương Ngọc Dũng", email: "dung.truong@gmail.com", school: "THPT Chuyên", grade: "Lớp 12", learning_mode: "offline", study_mode: "offline", approval_status: "approved" },
      { id: "stu-2", full_name: "Nguyễn Thị Hiền", email: "hien.nguyen@gmail.com", school: "THPT Kim Liên", grade: "Lớp 12", learning_mode: "online", study_mode: "online", approval_status: "approved" },
      { id: "stu-3", full_name: "Phạm Minh Đức", email: "duc.pham@gmail.com", school: "THPT Chu Văn An", grade: "Lớp 12", learning_mode: "online", study_mode: "online", approval_status: "approved" },
      { id: "stu-4", full_name: "Trần Mai Anh", email: "maianh.tran@gmail.com", school: "THPT Việt Đức", grade: "Lớp 11", learning_mode: "offline", study_mode: "offline", approval_status: "approved" },
      { id: "stu-5", full_name: "Trương Ngọc Quang", email: "quang.truong@gmail.com", school: "THPT Chuyên Hà Nội", grade: "Lớp 12", learning_mode: "online", study_mode: "online", approval_status: "approved" },
      { id: "stu-6", full_name: "Lê Hoàng Nam", email: "nam.le@gmail.com", school: "THPT Chuyên Sư Phạm", grade: "Lớp 12", learning_mode: "offline", study_mode: "offline", approval_status: "approved" },
      { id: "stu-7", full_name: "Vũ Phương Thảo", email: "thao.vu@gmail.com", school: "THPT Yên Hòa", grade: "Lớp 12", learning_mode: "offline", study_mode: "offline", approval_status: "approved" }
    ];
  }, []);

  const modeFilteredStudents = useMemo(() => {
    let list = registeredStudents;
    if (isOfflineOnly) {
      list = list.filter((s: any) => s.study_mode !== "online" && s.learning_mode !== "online");
    } else if (isOnlineOnly) {
      list = list.filter((s: any) => s.study_mode === "online" || s.learning_mode === "online");
    } else if (filterMode !== "all") {
      list = list.filter((s: any) => s.learning_mode === filterMode);
    }
    return list;
  }, [registeredStudents, isOfflineOnly, isOnlineOnly, filterMode]);

  const leaderboardData = useMemo(() => {
    return modeFilteredStudents
      .filter((stu: any) => {
        if (!searchQuery.trim()) return true;
        return (stu.full_name || "").toLowerCase().includes(searchQuery.toLowerCase());
      })
      .map((stu: any) => {
        const stuAttempts = (allAttempts || []).filter(a => a.studentId === stu.id);
        const hwAttempts = stuAttempts.filter(a => a.type === "homework");
        const testAttempts = stuAttempts.filter(a => a.type === "quiz" || a.type === "practice");

        const maxHW = hwAttempts.length > 0 ? Math.max(...hwAttempts.map(a => a.score || 0)) : (stu.learning_mode === "offline" ? 8.8 : 8.5);
        const maxTest = testAttempts.length > 0 ? Math.max(...testAttempts.map(a => a.score || 0)) : (stu.learning_mode === "offline" ? 9.2 : 9.0);
        const avgScore = Number(((maxHW + maxTest) / 2).toFixed(1));

        return {
          id: stu.id,
          name: stu.full_name,
          school: stu.school || "THPT",
          grade: stu.grade || "Lớp 12",
          mode: stu.learning_mode || "offline",
          attemptsCount: stuAttempts.length || (stu.id === "stu-1" ? 8 : stu.id === "stu-4" ? 6 : 5),
          maxHW,
          maxTest,
          overallScore: avgScore,
          isCurrentStudent: stu.id === profile?.id || stu.full_name === profile?.full_name
        };
      })
      .sort((a, b) => b.overallScore - a.overallScore);
  }, [modeFilteredStudents, searchQuery, allAttempts, profile]);

  return (
    <div className="space-y-4 max-w-5xl mx-auto font-sans text-left">
      {/* 1. HEADER LIQUID GLASS: ĐÃ ĐỔI THÀNH DUY NHẤT "BẢNG VINH DANH" THEO YÊU CẦU 2.d */}
      <motion.div 
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl backdrop-saturate-150 rounded-2xl p-4 border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-500/20">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 tracking-tight">
              Bảng vinh danh
            </h3>
          </div>
        </div>

        {/* BỘ LỌC KHI Ở CHẾ ĐỘ ALL */}
        {!isOfflineOnly && !isOnlineOnly && (
          <div className="flex items-center gap-1 p-1 bg-slate-100/80 backdrop-blur-md rounded-xl border border-slate-200/80 shrink-0">
            <button
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterMode === "all" ? "bg-white text-[#1D4ED8] shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Toàn bộ
            </button>
            <button
              onClick={() => setFilterMode("online")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterMode === "online" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Online
            </button>
            <button
              onClick={() => setFilterMode("offline")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                filterMode === "offline" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Offline
            </button>
          </div>
        )}
      </motion.div>

      {/* 2. SEARCH BAR & THỐNG KÊ GỌN GÀNG */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm tên học sinh..."
            className="w-full pl-9 pr-4 py-1.5 bg-white/70 backdrop-blur-xl border border-white/60 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-[#1D4ED8] focus:bg-white shadow-2xs transition-all"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{leaderboardData.length} học viên {isOfflineOnly ? "Offline" : isOnlineOnly ? "Online" : ""}</span>
        </div>
      </div>

      {/* 3. BẢNG BIỂU COMPACT (GIẢM PADDING & CHIỀU CAO DÒNG) */}
      <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl backdrop-saturate-150 rounded-2xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100/60 backdrop-blur-md border-b border-white/40 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-2.5 px-3 text-center w-14">Hạng</th>
                <th className="py-2.5 px-3 min-w-[150px]">Học sinh</th>
                <th className="py-2.5 px-2 text-center w-20">Phân hệ</th>
                <th className="py-2.5 px-2 text-center w-20">Lượt làm</th>
                <th className="py-2.5 px-2 text-center w-20">Đ.Max BTVN</th>
                <th className="py-2.5 px-2 text-center w-20">Đ.Max Đề KT</th>
                <th className="py-2.5 px-3 text-center w-24 text-[#1D4ED8]">Tổng điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {leaderboardData.map((st: any, idx: number) => {
                const rank = idx + 1;
                const isTop1 = rank === 1;
                const isTop2 = rank === 2;
                const isTop3 = rank === 3;

                return (
                  <tr 
                    key={st.id || idx}
                    className={`transition-all duration-150 ${
                      st.isCurrentStudent 
                        ? "bg-blue-50/80 font-bold border-l-4 border-l-[#1D4ED8]" 
                        : "hover:bg-white/80 bg-white/40"
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center font-black">
                      {isTop1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-amber-200 to-yellow-300 text-amber-900 border border-amber-400 text-xs font-black" title="Huy hiệu Vàng">
                          🥇
                        </span>
                      ) : isTop2 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-slate-800 border border-slate-400 text-xs font-black" title="Huy hiệu Bạc">
                          🥈
                        </span>
                      ) : isTop3 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-orange-200 to-amber-200 text-orange-900 border border-orange-400 text-xs font-black" title="Huy hiệu Đồng">
                          🥉
                        </span>
                      ) : (
                        <span className="text-slate-400 font-bold text-xs">{rank}</span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span>{st.name}</span>
                        {st.isCurrentStudent && (
                          <span className="px-1.5 py-0.2 rounded-md bg-[#1D4ED8] text-white text-[8px] font-black uppercase tracking-wider">
                            Bạn
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-normal block">{st.school}</span>
                    </td>

                    <td className="py-2.5 px-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                        st.mode === "online" 
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200" 
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}>
                        {st.mode === "online" ? "Online" : "Offline"}
                      </span>
                    </td>

                    <td className="py-2.5 px-2 text-center text-slate-600 font-medium">
                      {st.attemptsCount} lượt
                    </td>

                    <td className="py-2.5 px-2 text-center font-bold text-slate-700">
                      {st.maxHW.toFixed(1)}
                    </td>

                    <td className="py-2.5 px-2 text-center font-bold text-slate-700">
                      {st.maxTest.toFixed(1)}
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-lg bg-blue-50 text-[#1D4ED8] border border-blue-200 font-black text-xs">
                        {st.overallScore.toFixed(1)}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {leaderboardData.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                    Chưa có học viên nào trong bảng xếp hạng này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default StudentLeaderboardView;
