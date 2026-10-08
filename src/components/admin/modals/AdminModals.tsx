"use client";

import React, { useState, useMemo } from "react";
import { X, Pencil } from "lucide-react";

interface AdminModalsProps {
  azotaScoreViewModal: {
    isOpen: boolean;
    examTitle: string;
    attempts: any[];
  };
  setAzotaScoreViewModal: (modal: any) => void;
  registeredStudents?: any[];
  [key: string]: any;
}

export default function AdminModals(props: AdminModalsProps) {
  const {
    azotaScoreViewModal,
    setAzotaScoreViewModal,
    registeredStudents = []
  } = props;

  // State bộ nút gạt phân loại học sinh: Tất cả | Online | Offline
  const [filterMode, setFilterMode] = useState<"all" | "online" | "offline">("all");

  // Tra cứu thông tin học sinh và gắn nhãn phân hệ
  const enhancedAttempts = useMemo(() => {
    return (azotaScoreViewModal.attempts || []).map((att: any) => {
      const stuId = String(att.studentId || att.student_id || att.user_id || "").trim();

      // Tra cứu profile trong registeredStudents theo id hoặc email
      const matchedProfile = (registeredStudents || []).find((p: any) => 
        p.id === stuId ||
        (p.email && stuId && p.email.toLowerCase().includes(stuId.toLowerCase()))
      );

      // Xác định tên hiển thị: Nếu tên là "Học sinh" hoặc rỗng thì lấy từ profile
      let displayName = att.studentName || att.student_name || att.full_name;
      if (!displayName || displayName === "Học sinh") {
        displayName = matchedProfile?.full_name || matchedProfile?.username || att.username || "Học sinh";
      }

      // Xác định phân hệ: Offline hoặc Online
      const isOffline = 
        matchedProfile?.learning_mode === "offline" ||
        matchedProfile?.study_mode === "offline" ||
        att.learningMode === "offline" ||
        att.learning_mode === "offline" ||
        displayName.toLowerCase().includes("off");

      const learningMode = isOffline ? "offline" : "online";

      return {
        ...att,
        resolvedName: displayName,
        resolvedMode: learningMode
      };
    });
  }, [azotaScoreViewModal.attempts, registeredStudents]);

  // Lọc theo bộ nút gạt
  const filteredAttempts = useMemo(() => {
    if (filterMode === "all") return enhancedAttempts;
    return enhancedAttempts.filter((att: any) => att.resolvedMode === filterMode);
  }, [enhancedAttempts, filterMode]);

  if (!azotaScoreViewModal.isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setAzotaScoreViewModal({ isOpen: false, examTitle: "", attempts: [] });
        }
      }}
      className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
    >
      <div className="bg-white rounded-[28px] max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh] cursor-default animate-in zoom-in-95 duration-150">
        
        {/* HEADER MODAL AZOTA GỐC */}
        <div className="p-6 md:p-8 pb-4 border-b border-slate-100 flex items-start justify-between relative">
          <div>
            <span className="px-3 py-1 bg-blue-50 text-[#1D4ED8] rounded-lg text-[10px] font-black uppercase tracking-wider border border-blue-100">
              GIAO DIỆN CHẤM THI & QUẢN LÝ ĐIỂM AZOTA
            </span>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 mt-2 tracking-tight">
              {azotaScoreViewModal.examTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setAzotaScoreViewModal({ isOpen: false, examTitle: "", attempts: [] })}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SUBHEADER: TIÊU ĐỀ + BỘ NÚT GẠT PHÂN LOẠI TINH TẾ */}
        <div className="px-6 md:px-8 py-3.5 bg-slate-50/60 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800">
              Danh sách lượt nộp bài ({filteredAttempts.length} lượt)
            </span>
            <span className="text-[11px] text-slate-400 italic hidden sm:inline">
              * Click vào biểu tượng cây bút để sửa nhận xét học sinh
            </span>
          </div>

          {/* BỘ NÚT GẠT (SEGMENTED CONTROL): TẤT CẢ | ONLINE | OFFLINE */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterMode === "all"
                  ? "bg-[#1D4ED8] text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Tất cả ({enhancedAttempts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("online")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterMode === "online"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Online ({enhancedAttempts.filter((a: any) => a.resolvedMode === "online").length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("offline")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterMode === "offline"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Offline ({enhancedAttempts.filter((a: any) => a.resolvedMode === "offline").length})
            </button>
          </div>
        </div>

        {/* NỘI DUNG LƯỚI CARD BÀI THI NGUYÊN BẢN */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 bg-white">
          {filteredAttempts.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs font-bold italic">
              Chưa có lượt nộp bài nào trong phân hệ này.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {filteredAttempts.map((att: any, idx: number) => {
                const displayName = att.resolvedName;
                const isOffline = att.resolvedMode === "offline";
                const scoreVal = Number(att.score ?? att.points ?? 0);

                // Lấy 2 chữ cái đầu để làm avatar tròn HS
                const avatarText = displayName
                  ? displayName.trim().substring(0, 2).toUpperCase()
                  : "HS";

                // Format thời gian nộp
                const submitDate = att.createdAt || att.created_at || att.submittedAt;
                const formattedDate = submitDate
                  ? new Date(submitDate).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric"
                    })
                  : "08/10/2026";
                const formattedTime = submitDate
                  ? new Date(submitDate).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit"
                    })
                  : "10:40";

                return (
                  <div
                    key={att.id || idx}
                    className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs hover:shadow-xs transition flex flex-col justify-between text-left"
                  >
                    <div>
                      {/* PHẦN ĐẦU CARD: AVATAR TRÒN + TÊN HỌC SINH + BADGE + ĐIỂM ĐỎ */}
                      <div className="flex items-start gap-3.5 mb-4">
                        <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-xs text-slate-700 shrink-0 uppercase tracking-tighter">
                          {avatarText}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-extrabold text-sm text-slate-900 truncate">
                              {displayName}
                            </h4>
                            {/* BADGE PHÂN HỆ NHỎ GỌN */}
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                                isOffline
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-indigo-50 text-indigo-700 border-indigo-200"
                              }`}
                            >
                              {isOffline ? "OFFLINE" : "ONLINE"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-black text-rose-600 mt-0.5">
                            <span>Điểm: {scoreVal.toFixed(2)}</span>
                            <span className="text-slate-400 font-normal text-[11px]">
                              (Lần thi: {att.attemptIndex || 1})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* CHI TIẾT THỜI GIAN LÀM BÀI & THỜI GIAN NỘP BÀI GỐC */}
                      <div className="space-y-1.5 text-xs text-slate-500 font-semibold pt-1">
                        <div className="flex items-center justify-between">
                          <span>Thời gian làm bài:</span>
                          <span className="text-slate-800 font-bold">
                            {att.timeSpent || att.time_spent || "15 phút"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Thời gian nộp bài:</span>
                          <span className="text-slate-800 font-black">
                            {formattedTime} {formattedDate}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* DÒNG NHẬN XÉT VÀ ICON CÂY BÚT NGUYÊN BẢN */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-400 italic">
                        {att.feedback || "Chưa có nhận xét"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const note = prompt("Nhập nhận xét cho học sinh:", att.feedback || "");
                          if (note !== null) {
                            att.feedback = note;
                          }
                        }}
                        className="p-1 text-[#1D4ED8] hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        title="Sửa nhận xét"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
