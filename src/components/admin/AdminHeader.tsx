"use client";

import React from "react";
import { RefreshCw, GraduationCap } from "lucide-react";
import { AdminTab } from "@/types/admin";

interface AdminHeaderProps {
  activeTab: AdminTab;
  onSyncData: () => Promise<void>;
}

export default function AdminHeader({ activeTab, onSyncData }: AdminHeaderProps) {
  const getHeaderTitle = () => {
    switch (activeTab) {
      case "lessons":
        return "Quản lý nội dung bài học";
      case "practice":
        return "Quản trị Kho Luyện đề";
      case "analytics":
        return "Tổng hợp điểm & Xếp hạng";
      case "notifications":
        return "Phát Thông Báo Học Sinh";
      case "students":
        return "Quản lý Học viên & Duyệt Tài khoản";
      case "reports":
        return "Sổ Nhận Xét & Báo Cáo Phụ Huynh";
      case "online_schedule":
      default:
        return "Lịch học & Điểm danh Online";
    }
  };

  return (
    <header className="h-[64px] bg-white/80 backdrop-blur-2xl border-b border-slate-200/60 flex items-center px-8 shadow-sm shrink-0 justify-between sticky top-0 z-10">
      <h2 className="font-extrabold text-slate-900 tracking-tight text-[15px]">
        {getHeaderTitle()}
      </h2>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSyncData}
          title="Làm mới dữ liệu từ Supabase"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] rounded-xl text-xs font-bold transition cursor-pointer border border-blue-200"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Đồng bộ
        </button>
        <div className="flex items-center gap-2.5 px-4 py-2 bg-slate-50 border border-slate-200/60 rounded-xl text-xs font-semibold text-slate-600">
          <GraduationCap className="w-4 h-4" /> Ban Giám Khảo
        </div>
      </div>
    </header>
  );
}
