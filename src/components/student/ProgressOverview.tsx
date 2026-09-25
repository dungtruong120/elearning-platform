"use client";

import React, { useState, useEffect } from "react";
import { Trophy, Timer } from "lucide-react";

interface ProgressOverviewProps {
  completedCount: number;
  totalCount: number;
  grade?: string;
}

export const ProgressOverview: React.FC<ProgressOverviewProps> = ({ 
  completedCount, 
  totalCount,
  grade = "Lớp 12",
}) => {
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const todayKey = `study_seconds_${new Date().toISOString().slice(0, 10)}`;
  const [studySeconds, setStudySeconds] = useState<number>(0);

  useEffect(() => {
    const saved = localStorage.getItem(todayKey);
    const initialSeconds = saved ? parseInt(saved, 10) : 0;
    setStudySeconds(initialSeconds);

    const interval = setInterval(() => {
      setStudySeconds((prev) => {
        const next = prev + 1;
        localStorage.setItem(todayKey, next.toString());
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [todayKey]);

  const formatStudyTime = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const cleanGrade = (grade || "12").toString().toLowerCase();
  let programTitle = "Toán 12 - Luyện Thi Quốc Gia 2026";
  let targetExam = "Tốt Nghiệp & ĐH 2026";

  if (cleanGrade.includes("10")) {
    programTitle = "Toán 10 - Nền Tảng Đại Số & Hình Học";
    targetExam = "Học kỳ & Nền tảng ĐGNL";
  } else if (cleanGrade.includes("11")) {
    programTitle = "Toán 11 - Giải Tích & Xác Suất Thống Kê";
    targetExam = "Đánh giá định kỳ & Ôn sớm THPT";
  } else if (cleanGrade.includes("12")) {
    programTitle = "Toán 12 - Luyện Thi Quốc Gia 2026";
    targetExam = "Tốt Nghiệp & ĐH 2026";
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4 mb-5 sm:mb-6 font-sans">
      
      {/* 1. KHỐI TIẾN ĐỘ CHÍNH */}
      <div className="md:col-span-2 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-600">
              Lộ trình học tập • {grade}
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
              {percentage}% Hoàn thành
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mb-1 tracking-tight leading-snug">
            {programTitle}
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 mb-3 tracking-tight">
            Đã hoàn thành {completedCount} trên tổng số {totalCount} bài học yêu cầu.
          </p>
        </div>
        
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
          <div 
            className="bg-blue-600 h-full rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${percentage}%` }}
          ></div>
        </div>
      </div>

      {/* 2. THẺ ĐẾM THỜI GIAN HỌC TRONG NGÀY */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-4 sm:p-5 rounded-2xl text-white shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-indigo-100 font-bold uppercase tracking-wider">
            <Timer className="w-3.5 h-3.5" />
            <span>Thời gian học hôm nay</span>
          </div>
          <p className="text-xl sm:text-2xl font-mono font-black mt-1 tracking-wider text-white">
            {formatStudyTime(studySeconds)}
          </p>
          <p className="text-[10px] sm:text-xs text-indigo-200 mt-0.5 flex items-center gap-1 tracking-tight">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block"></span>
            <span>Đang ghi nhận giờ học...</span>
          </p>
        </div>
        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
          <Timer className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-100" />
        </div>
      </div>

      {/* 3. THẺ TRẠNG THÁI & HẠN CHÓT */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 sm:p-5 rounded-2xl text-white shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[10px] sm:text-xs text-blue-200 font-medium uppercase tracking-wider">
            Mục tiêu: {targetExam}
          </p>
          <p className="text-lg sm:text-xl font-black mt-0.5 tracking-tight">Sẵn sàng nộp</p>
          <p className="text-[10px] sm:text-xs text-blue-100 mt-0.5 tracking-tight">
            Hạn chót BTVN: 23:59 CN
          </p>
        </div>
        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
          <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-amber-300" />
        </div>
      </div>

    </div>
  );
};