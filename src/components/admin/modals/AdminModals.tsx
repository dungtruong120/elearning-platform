"use client";

import React, { useState, useMemo } from "react";
import { X, Pencil, Trash2 } from "lucide-react";

interface AdminModalsProps {
  azotaScoreViewModal: {
    isOpen: boolean;
    examTitle: string;
    attempts: any[];
  };
  setAzotaScoreViewModal: (modal: any) => void;
  registeredStudents?: any[];
  supabase?: any;
  showToast?: (msg: string, type?: "success" | "error") => void;
  [key: string]: any;
}

export default function AdminModals(props: AdminModalsProps) {
  const {
    azotaScoreViewModal,
    setAzotaScoreViewModal,
    registeredStudents = [],
    supabase,
    showToast
  } = props;

  // State bộ nút gạt phân loại học sinh: Tất cả | Online | Offline
  const [filterMode, setFilterMode] = useState<"all" | "online" | "offline">("all");

  // 1. TẠO PROFILE MAP TRA CỨU DANH TÍNH VÀ PHÂN HỆ TOÀN DIỆN
  const profileMap = useMemo(() => {
    const map = new Map<string, any>();
    (registeredStudents || []).forEach((p: any) => {
      if (p?.id) map.set(String(p.id).trim().toLowerCase(), p);
      if (p?.full_name) map.set(String(p.full_name).trim().toLowerCase(), p);
      if (p?.username) map.set(String(p.username).trim().toLowerCase(), p);
      if (p?.email) {
        const emailPrefix = String(p.email).split("@")[0].trim().toLowerCase();
        map.set(emailPrefix, p);
      }
    });
    return map;
  }, [registeredStudents]);

  // 2. TRA CỨU DANH TÍNH VÀ ĐỐI SOÁT PHÂN HỆ CHO TỪNG BÀI NỘP
  const enhancedAttempts = useMemo(() => {
    return (azotaScoreViewModal.attempts || []).map((att: any) => {
      const stuId = String(att.studentId || att.student_id || att.user_id || "").trim().toLowerCase();
      const rawName = String(att.studentName || att.student_name || att.full_name || "").trim();

      // Tra cứu profile theo UUID id, tên đầy đủ hoặc username
      const matchedProfile = 
        profileMap.get(stuId) ||
        (rawName ? profileMap.get(rawName.toLowerCase()) : null);

      // Xác định tên hiển thị: Nếu là "Học sinh" hoặc để trống -> Lấy tên thật từ Profile
      let displayName = rawName;
      if (!displayName || displayName === "Học sinh") {
        displayName = matchedProfile?.full_name || matchedProfile?.username || att.username || "Học sinh";
      }

      // Xác định phân hệ: Ưu tiên đối soát từ Profile (dung22 -> offline, dung123 -> online)
      let isOffline = false;
      if (matchedProfile) {
        const mode = String(matchedProfile.learning_mode || matchedProfile.study_mode || "").toLowerCase();
        isOffline = mode === "offline";
      } else {
        const modeInAtt = String(att.learningMode || att.learning_mode || "").toLowerCase();
        isOffline = modeInAtt === "offline" || displayName.toLowerCase().includes("off") || displayName.toLowerCase().includes("dung22");
      }

      return {
        ...att,
        resolvedName: displayName,
        resolvedMode: isOffline ? "offline" : "online"
      };
    });
  }, [azotaScoreViewModal.attempts, profileMap]);

  // 3. LỌC THEO BỘ NÚT GẠT PHÂN LOẠI
  const filteredAttempts = useMemo(() => {
    if (filterMode === "all") return enhancedAttempts;
    return enhancedAttempts.filter((att: any) => att.resolvedMode === filterMode);
  }, [enhancedAttempts, filterMode]);

  // 4. HÀM XÓA VĨNH VIỄN LƯỢT LÀM BÀI KHỎI DATABASE VÀ GIAO DIỆN
  const handleDeleteAttempt = async (attemptId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn lượt làm bài này?")) return;

    try {
      if (supabase) {
        await Promise.allSettled([
          supabase.from("exam_attempts").delete().eq("id", attemptId),
          supabase.from("quiz_results").delete().eq("id", attemptId)
        ]);
      }

      // Xóa trong LocalStorage của máy Admin
      if (typeof window !== "undefined") {
        try {
          const rawLocal = localStorage.getItem("edunexus_attempts");
          if (rawLocal) {
            const list = JSON.parse(rawLocal);
            if (Array.isArray(list)) {
              const updated = list.filter((a: any) => a?.id !== attemptId);
              localStorage.setItem("edunexus_attempts", JSON.stringify(updated));
            }
          }
        } catch (e) {}
      }

      // Cập nhật State modal để biến mất ngay lập tức trước mắt Admin
      setAzotaScoreViewModal((prev: any) => ({
        ...prev,
        attempts: (prev.attempts || []).filter((a: any) => a?.id !== attemptId)
      }));

      if (showToast) {
        showToast("Đã xóa lượt làm bài thành công!", "success");
      }
    } catch (err) {
      console.error("Lỗi khi xóa lượt làm bài:", err);
      alert("Không thể xóa bản ghi, vui lòng thử lại!");
    }
  };

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
                    className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs hover:shadow-xs transition flex flex-col justify-between text-left relative group"
                  >
                    <div>
                      {/* PHẦN ĐẦU CARD: AVATAR TRÒN + TÊN HỌC SINH + BADGE + ĐIỂM ĐỎ + NÚT THÙNG RÁC */}
                      <div className="flex items-start gap-3.5 mb-4">
                        <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-xs text-slate-700 shrink-0 uppercase tracking-tighter">
                          {avatarText}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-extrabold text-sm text-slate-900 truncate max-w-[130px]">
                              {displayName}
                            </h4>
                            {/* BADGE PHÂN HỆ ĐÃ ĐƯỢC TRA CỨU CHUẨN XÁC */}
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

                        {/* NÚT THÙNG RÁC XÓA BÀI NỘP NHỎ GỌN TINH TẾ */}
                        <button
                          type="button"
                          onClick={() => handleDeleteAttempt(att.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Xóa vĩnh viễn lượt làm bài này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
                      <span className="text-slate-400 italic truncate max-w-[200px]">
                        {att.feedback || "Chưa có nhận xét"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const note = prompt("Nhập nhận xét cho học sinh:", att.feedback || "");
                          if (note !== null) {
                            att.feedback = note;
                            if (supabase) {
                              supabase
                                .from("exam_attempts")
                                .update({ feedback: note })
                                .eq("id", att.id)
                                .then(() => {
                                  if (showToast) showToast("Đã lưu nhận xét!", "success");
                                });
                            }
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
