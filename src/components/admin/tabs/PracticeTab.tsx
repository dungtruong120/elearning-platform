"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Target,
  UploadCloud,
  ChevronDown,
  ToggleRight,
  ToggleLeft,
  Link as LinkIcon,
  Video,
  BarChart2,
  FileSignature,
  Play,
  Trash2,
  Filter,
  Eye,
  Loader2,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Printer,
  Camera,
  Users,
  X
} from "lucide-react";
import { EXAM_CATEGORIES } from "@/types/admin";
import {
  openPrintableDynamicAnswerSheet,
  formatStudentAutoSBD,
  extractExamQuestionCounts,
  buildDynamicOMRBlueprint,
  deriveExamCode3Digits
} from "@/lib/omrEngine";
import {
  AdminBulkOMRScannerModal,
  StudentSBDRecord
} from "@/components/admin/paper/AdminBulkOMRScannerModal";

interface PracticeTabProps {
  practiceSubTab: "manage" | "scores";
  setPracticeSubTab: (tab: "manage" | "scores") => void;
  practiceExams: any[];
  allAttempts: any[];
  isLoadingExams?: boolean;
  uploadProgressText?: string | null;
  setTestFile: (file: File | null) => void;
  setUploadMode: (mode: "course" | "practice") => void;
  setEditingExamData: (data: any) => void;
  handleChangeExamCategory: (examId: string, newCategory: string) => Promise<void>;
  savePracticeExams: (newExams: any[]) => Promise<void>;
  supabase: any;
  showToast: (msg: string, type?: "success" | "error") => void;
  setVideoModalExam: (exam: any) => void;
  setSolutionVideoInput: (input: string) => void;
  setAzotaScoreViewModal: (modal: any) => void;
  onOpenExamEditor: (exam: any) => Promise<void>;
  onTestExam: (exam: any) => Promise<void>;
  practiceCategoryFilter: string;
  setPracticeCategoryFilter: (cat: string) => void;
  examsWithScoresData: any[];
  practiceSyncStatus?: {
    isSyncing: boolean;
    progress: number;
    message: string;
    type: "idle" | "loading" | "success" | "error";
  };
}

export default function PracticeTab({
  practiceSubTab,
  setPracticeSubTab,
  practiceExams,
  allAttempts,
  isLoadingExams = false,
  uploadProgressText = null,
  setTestFile,
  setUploadMode,
  setEditingExamData,
  handleChangeExamCategory,
  savePracticeExams,
  supabase,
  showToast,
  setVideoModalExam,
  setSolutionVideoInput,
  setAzotaScoreViewModal,
  onOpenExamEditor,
  onTestExam,
  practiceCategoryFilter,
  setPracticeCategoryFilter,
  examsWithScoresData,
  practiceSyncStatus
}: PracticeTabProps) {
  const currentRealtimeMonth = useMemo(() => new Date().getMonth() + 1, []);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>("all");

  // State phục vụ Chấm bài thi giấy hàng loạt (AdminBulkOMRScannerModal)
  const [isBulkScannerOpen, setIsBulkScannerOpen] = useState<boolean>(false);
  const [bulkScannerDefaultExam, setBulkScannerDefaultExam] = useState<any | null>(null);

  // State phục vụ Modal Xuất Phiếu Trả Lời A4 Động & Bảng SBD Học Sinh
  const [isExportSheetModalOpen, setIsExportSheetModalOpen] = useState<boolean>(false);
  const [selectedExamForSheetId, setSelectedExamForSheetId] = useState<string>("");
  const [isSbdDirectoryModalOpen, setIsSbdDirectoryModalOpen] = useState<boolean>(false);
  const [studentsDirectory, setStudentsDirectory] = useState<StudentSBDRecord[]>([]);

  // Tự động nạp danh sách học sinh, cấp SBD theo STT (000001, 000002...) và lưu đồng bộ vào localStorage
  useEffect(() => {
    const loadStudentsForSBD = async () => {
      const mergedMap = new Map<
        string,
        { id: string; username: string; full_name: string; school?: string; grade?: string }
      >();

      // 1. Lấy từ Supabase bảng profiles nếu có
      if (supabase) {
        try {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, username, full_name, role, school, grade")
            .neq("role", "admin");
          if (Array.isArray(profs)) {
            profs.forEach((p: any) => {
              const key = String(p.id || p.username || "").trim();
              if (key) {
                mergedMap.set(key, {
                  id: key,
                  username: p.username || key,
                  full_name: p.full_name || p.username || "Học sinh",
                  school: p.school || "THPT",
                  grade: p.grade || "Lớp 12"
                });
              }
            });
          }
        } catch {}
      }

      // 2. Lấy thêm từ edunexus_registered_students trong localStorage nếu có
      if (typeof window !== "undefined") {
        try {
          const regRaw = localStorage.getItem("edunexus_registered_students");
          if (regRaw) {
            const regList = JSON.parse(regRaw);
            if (Array.isArray(regList)) {
              regList.forEach((p: any) => {
                const key = String(p.id || p.username || "").trim();
                if (key && !mergedMap.has(key)) {
                  mergedMap.set(key, {
                    id: key,
                    username: p.username || key,
                    full_name: p.full_name || p.name || p.username || "Học sinh",
                    school: p.school || "THPT",
                    grade: p.grade || "Lớp 12"
                  });
                }
              });
            }
          }
        } catch {}
      }

      // 3. Bổ sung từ danh sách lịch sử làm bài (allAttempts) để không bỏ sót học sinh nào
      if (Array.isArray(allAttempts)) {
        allAttempts.forEach((att: any) => {
          const key = String(att.student_id || att.studentId || att.user_id || "").trim();
          const name = String(
            att.student_name || att.studentName || att.full_name || ""
          ).trim();
          if (key && name && !mergedMap.has(key)) {
            mergedMap.set(key, {
              id: key,
              username: att.username || key,
              full_name: name,
              school: att.school || "THPT",
              grade: "Lớp 12"
            });
          }
        });
      }

      const sortedList = Array.from(mergedMap.values()).sort((a, b) =>
        a.full_name.localeCompare(b.full_name, "vi")
      );

      const withSbd: StudentSBDRecord[] = sortedList.map((stu, idx) => ({
        stt: idx + 1,
        sbd: formatStudentAutoSBD(idx + 1),
        id: stu.id,
        username: stu.username,
        full_name: stu.full_name,
        school: stu.school,
        grade: stu.grade
      }));

      setStudentsDirectory(withSbd);

      // Lưu danh mục SBD chuẩn vào localStorage để mọi giao diện Học sinh lấy đúng SBD 100%
      if (typeof window !== "undefined" && withSbd.length > 0) {
        try {
          localStorage.setItem("edunexus_sbd_directory", JSON.stringify(withSbd));
        } catch {}
      }
    };

    loadStudentsForSBD();
  }, [supabase, allAttempts]);

  // Hàm in danh sách Số Báo Danh (SBD) của cả lớp ra giấy A4
  const handlePrintClassSBDTable = () => {
    if (typeof window === "undefined") return;
    const win = window.open("", "_blank");
    if (!win) return;

    const rowsHtml = studentsDirectory
      .map(
        (st) => `
        <tr>
          <td style="text-align:center; font-weight:bold;">${st.stt}</td>
          <td style="text-align:center; font-family:monospace; font-size:14px; font-weight:bold; color:#1d4ed8;">${st.sbd}</td>
          <td style="font-weight:bold;">${st.full_name}</td>
          <td>${st.school || "THPT"}</td>
          <td></td>
        </tr>
      `
      )
      .join("");

    win.document.open();
    win.document.write(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8" />
        <title>Danh sách Số Báo Danh (SBD) Lớp Học</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
          h2 { text-align: center; margin-bottom: 4px; text-transform: uppercase; }
          p { text-align: center; margin-top: 0; font-size: 13px; color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; }
          th { background: #f1f5f9; text-transform: uppercase; font-size: 11px; }
        </style>
      </head>
      <body>
        <h2>DANH SÁCH SỐ BÁO DANH (SBD) THI TRÊN GIẤY</h2>
        <p>Học sinh tra cứu đúng Số Báo Danh (6 chữ số) theo STT của mình để tô vào Phiếu trả lời trắc nghiệm</p>
        <table>
          <thead>
            <tr>
              <th style="width:50px;">STT</th>
              <th style="width:140px;">SỐ BÁO DANH (6 SỐ)</th>
              <th>HỌ VÀ TÊN HỌC SINH</th>
              <th>TRƯỜNG / LỚP</th>
              <th style="width:140px;">CHỮ KÝ THÍ SINH</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="5" style="text-align:center;">Chưa có học sinh</td></tr>'}
          </tbody>
        </table>
        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  // Hàm xác định tháng của đề thi (ưu tiên assigned_month, nếu chưa có thì suy từ created_at hoặc tháng hiện tại)
  const resolveExamMonth = (ex: any): number => {
    if (ex?.assigned_month && !isNaN(Number(ex.assigned_month))) {
      const m = Number(ex.assigned_month);
      if (m >= 1 && m <= 12) return m;
    }
    const rawDate = ex?.created_at || ex?.createdAt;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        return d.getMonth() + 1;
      }
    }
    return currentRealtimeMonth;
  };

  // Đổi nhanh Tháng của đề thi ngay trên bảng
  const handleChangeExamMonth = async (examId: string, newMonth: number) => {
    const updated = (practiceExams || []).map((ex: any) =>
      ex?.id === examId ? { ...ex, assigned_month: newMonth } : ex
    );
    await savePracticeExams(updated);

    try {
      if (supabase) {
        const { error } = await supabase
          .from("practice_exams")
          .update({ assigned_month: newMonth })
          .eq("id", examId);

        if (error) {
          const targetExam = updated.find((e: any) => e?.id === examId);
          if (targetExam) {
            await fetch("/api/admin/data", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "save_practice_exam",
                examData: targetExam
              })
            });
          }
        }
      }
    } catch (e) {}

    showToast(`Đã chuyển đề sang Tháng ${newMonth < 10 ? "0" + newMonth : newMonth}!`, "success");
  };

  // Danh sách đề ở sub-tab Quản lý đã lọc theo Tháng
  const filteredManageExams = useMemo(() => {
    const list = Array.isArray(practiceExams) ? practiceExams : [];
    if (selectedMonthFilter === "all") return list;
    const targetM = Number(selectedMonthFilter);
    return list.filter((ex: any) => resolveExamMonth(ex) === targetM);
  }, [practiceExams, selectedMonthFilter]);

  // Danh sách đề ở sub-tab Điểm & Xếp hạng đã lọc theo Tháng
  const filteredScoresExams = useMemo(() => {
    const list = Array.isArray(examsWithScoresData) ? examsWithScoresData : [];
    if (selectedMonthFilter === "all") return list;
    const targetM = Number(selectedMonthFilter);
    return list.filter((ex: any) => resolveExamMonth(ex) === targetM);
  }, [examsWithScoresData, selectedMonthFilter]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300 max-w-6xl mx-auto text-left font-sans">
      {/* 1. KHỐI THANH TIẾN TRÌNH ĐỒNG BỘ ĐỀ THI (THEO DÕI REALTIME TIẾN TRÌNH UPLOAD) */}
      {(!practiceSyncStatus ||
        (!practiceSyncStatus.isSyncing && practiceSyncStatus.type === "idle")) && (
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs text-slate-500 shadow-2xs">
          <div className="flex items-center gap-2 font-medium">
            <Cloud className="w-4 h-4 text-slate-400" />
            <span>Hệ thống sẵn sàng: Chưa có đề thi nào đang tải lên</span>
          </div>
          <div className="flex items-center gap-1.5 font-bold text-emerald-600 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Máy chủ hoạt động</span>
          </div>
        </div>
      )}

      {practiceSyncStatus?.isSyncing && practiceSyncStatus.type === "loading" && (
        <div className="bg-blue-50/90 border-2 border-blue-400 p-3.5 rounded-2xl shadow-sm flex flex-col gap-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs font-bold text-blue-900">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span>
                {practiceSyncStatus.message ||
                  `Đang xử lý & đăng tải đề thi: [ ${practiceSyncStatus.progress}% ]`}
              </span>
            </div>
            <span className="font-mono text-blue-700">{practiceSyncStatus.progress}%</span>
          </div>
          <div className="w-full bg-blue-200/60 h-2 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-300 rounded-full"
              style={{ width: `${practiceSyncStatus.progress}%` }}
            />
          </div>
        </div>
      )}

      {practiceSyncStatus?.type === "success" && (
        <div className="bg-emerald-50 border-2 border-emerald-400 p-3 rounded-2xl flex items-center justify-between text-xs font-bold text-emerald-900 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              {practiceSyncStatus.message || "✓ Đã nạp và đồng bộ đề thi thành công! (100%)"}
            </span>
          </div>
          <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-300">
            Hoàn tất
          </span>
        </div>
      )}

      {practiceSyncStatus?.type === "error" && (
        <div className="bg-rose-50 border-2 border-rose-400 p-3 rounded-2xl flex items-center justify-between text-xs font-bold text-rose-900 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{practiceSyncStatus.message || "✕ Lỗi kết nối đám mây khi lưu đề thi!"}</span>
          </div>
        </div>
      )}

      {/* THANH THÔNG BÁO UPLOAD PHỤ (NẾU CÓ TRUYỀN TỪ PROPS) */}
      {uploadProgressText && (
        <div className="bg-blue-50 border-2 border-[#1D4ED8] p-3.5 rounded-2xl flex items-center gap-3 shadow-xs">
          <Loader2 className="w-4 h-4 text-[#1D4ED8] animate-spin shrink-0" />
          <div className="text-xs font-bold text-[#1D4ED8]">{uploadProgressText}</div>
        </div>
      )}

      {/* 2. CỤM NÚT CHUYỂN TAB CON & THANH LỌC NHANH THEO THÁNG */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs w-fit">
          <button
            type="button"
            onClick={() => setPracticeSubTab("manage")}
            className={
              "px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer " +
              (practiceSubTab === "manage"
                ? "bg-[#1D4ED8] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100")
            }
          >
            Kho Đề & Tải lên
          </button>
          <button
            type="button"
            onClick={() => setPracticeSubTab("scores")}
            className={
              "px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer " +
              (practiceSubTab === "scores"
                ? "bg-[#1D4ED8] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100")
            }
          >
            Điểm & Xếp hạng Luyện đề
          </button>
        </div>

        {/* THANH LỌC ĐỀ THEO THÁNG */}
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs overflow-x-auto custom-scrollbar">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 px-2 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-[#1D4ED8]" /> Tháng:
          </span>
          {[
            { val: "all", label: "Tất cả" },
            { val: "8", label: "Tháng 8" },
            { val: "9", label: "Tháng 9" },
            { val: "10", label: "Tháng 10" },
            { val: "11", label: "Tháng 11" },
            { val: "12", label: "Tháng 12" }
          ].map((item) => (
            <button
              key={item.val}
              type="button"
              onClick={() => setSelectedMonthFilter(item.val)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                selectedMonthFilter === item.val
                  ? "bg-[#1D4ED8] text-white shadow-2xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </button>
          ))}
          <select
            value={selectedMonthFilter}
            onChange={(e) => setSelectedMonthFilter(e.target.value)}
            className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer shrink-0"
            title="Chọn tháng khác (Tháng 1 -> 12)"
          >
            <option value="all">12 Tháng</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <option key={m} value={String(m)}>
                Tháng {m < 10 ? "0" + m : m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. NỘI DUNG SUBTAB 1: QUẢN LÝ KHO ĐỀ */}
      {practiceSubTab === "manage" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex items-center gap-4 min-w-[200px]">
              <div className="w-12 h-12 bg-blue-50 text-[#1D4ED8] rounded-2xl flex items-center justify-center">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  {selectedMonthFilter === "all"
                    ? "Tổng số đề"
                    : `Số đề Tháng ${selectedMonthFilter}`}
                </p>
                {isLoadingExams ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <Loader2 className="w-4 h-4 text-[#1D4ED8] animate-spin" />
                    <span className="text-xs text-slate-400 font-semibold">Đang tải...</span>
                  </div>
                ) : (
                  <p className="text-2xl font-black text-slate-900 mt-0.5">
                    {filteredManageExams.length}
                  </p>
                )}
              </div>
            </div>

            {/* CỤM CÔNG CỤ THI TRÊN GIẤY, SBD, CHẤM BÀI HÀNG LOẠT & TẢI ĐỀ MỚI */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsSbdDirectoryModalOpen(true)}
                className="flex items-center gap-2 px-4 py-3.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-extrabold rounded-2xl shadow-2xs transition cursor-pointer"
                title="Xem và in bảng Số Báo Danh (SBD) tự động theo STT học sinh"
              >
                <Users className="w-4 h-4 text-[#1D4ED8]" />
                <span>📋 Bảng SBD Lớp ({studentsDirectory.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (practiceExams && practiceExams.length > 0 && !selectedExamForSheetId) {
                    setSelectedExamForSheetId(String(practiceExams[0].id));
                  }
                  setIsExportSheetModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-2xl shadow-sm transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>📄 Xuất phiếu in theo đề</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBulkScannerDefaultExam(practiceExams?.[0] || null);
                  setIsBulkScannerOpen(true);
                }}
                className="flex items-center gap-2 px-5 py-3.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold rounded-2xl shadow-md transition cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>📷 Chấm bài thi giấy cả lớp</span>
              </button>

              <label className="flex items-center gap-2 px-5 py-3.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold rounded-2xl shadow-md transition-all cursor-pointer">
                <UploadCloud className="w-4 h-4" /> + Tải lên Đề thi mới (.docx / .pdf)
                <input
                  type="file"
                  accept=".docx,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setTestFile(e.target.files[0]);
                      setUploadMode("practice");
                      setEditingExamData(null);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap justify-between items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-[14px]">
                Danh sách Kho Đề Thực Chiến{" "}
                {selectedMonthFilter !== "all" ? `(Tháng ${selectedMonthFilter})` : ""}
              </h3>
              <span className="text-xs text-slate-400 font-semibold">
                * Click vào thẻ Phân Loại, Tháng hoặc nút In phiếu A4 / Chấm giấy từng đề
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-5 font-bold w-1/4">Tiêu đề đề thi</th>
                    <th className="py-3.5 px-3 font-bold text-center">Phân loại (Loại đề)</th>
                    <th className="py-3.5 px-3 font-bold text-center">Tháng</th>
                    <th className="py-3.5 px-3 font-bold text-center">Phân hệ lớp</th>
                    <th className="py-3.5 px-3 font-bold text-center">Làm lại bài</th>
                    <th className="py-3.5 px-4 font-bold text-center">Quyền xem file</th>
                    <th className="py-3.5 px-4 font-bold text-center">Link đề Drive</th>
                    <th className="py-3.5 px-4 font-bold text-center text-amber-700">
                      Video chữa bài
                    </th>
                    <th className="py-3.5 px-5 font-bold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60">
                  {isLoadingExams ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Loader2 className="w-8 h-8 text-[#1D4ED8] animate-spin" />
                          <p className="text-xs font-bold text-slate-500">
                            Đang nạp danh mục kho đề thực chiến từ Supabase...
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredManageExams.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-slate-400 font-semibold">
                        Chưa có đề thi nào trong bộ lọc này. Vui lòng bấm nút &quot;+ Tải lên Đề thi
                        mới&quot; ở trên hoặc chọn &quot;Tất cả&quot; tháng.
                      </td>
                    </tr>
                  ) : (
                    filteredManageExams.map((ex, exIdx) => {
                      const examMonth = resolveExamMonth(ex);
                      const qCounts = extractExamQuestionCounts(ex);
                      const exCode = deriveExamCode3Digits(ex);
                      return (
                        <tr
                          key={ex?.id || exIdx}
                          className="hover:bg-slate-50/50 transition-colors bg-white"
                        >
                          <td
                            className="py-3.5 px-5 font-bold text-slate-800 max-w-[230px]"
                            title={ex?.title}
                          >
                            <div className="truncate">{ex?.title || "Đề thi"}</div>
                            <span className="text-[10px] text-slate-400 font-semibold">
                              Mã đề: {exCode} • {qCounts.totalCount} câu
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <div className="relative inline-block">
                              <select
                                value={ex?.category || "Luyện đề"}
                                onChange={(e) => handleChangeExamCategory(ex.id, e.target.value)}
                                className="appearance-none px-3 py-1.5 pr-6 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-black text-[10px] uppercase rounded-xl tracking-wider cursor-pointer outline-none transition"
                              >
                                {EXAM_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3 h-3 text-indigo-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </td>

                          {/* CỘT DROPDOWN CHỌN NHANH THÁNG (THÁNG 1 -> 12) */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="relative inline-block">
                              <select
                                value={examMonth}
                                onChange={(e) =>
                                  handleChangeExamMonth(ex.id, Number(e.target.value))
                                }
                                className="appearance-none px-2.5 py-1.5 pr-6 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-black text-[10px] uppercase rounded-xl tracking-wider cursor-pointer outline-none transition"
                                title="Chọn tháng cho đề thi này"
                              >
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                                  <option key={m} value={m}>
                                    Tháng {m < 10 ? "0" + m : m}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-3 h-3 text-emerald-600 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={async () => {
                                const nextMode =
                                  ex.target_mode === "all"
                                    ? "online"
                                    : ex.target_mode === "online"
                                    ? "offline"
                                    : "all";
                                const newExams = practiceExams.map((e) =>
                                  e?.id === ex?.id ? { ...e, target_mode: nextMode } : e
                                );
                                await savePracticeExams(newExams);
                                try {
                                  await supabase
                                    .from("practice_exams")
                                    .update({ target_mode: nextMode })
                                    .eq("id", ex.id);
                                } catch {}
                                showToast(
                                  "Đã chuyển đề sang: " +
                                    (nextMode === "online"
                                      ? "Lớp Online"
                                      : nextMode === "offline"
                                      ? "Lớp Offline"
                                      : "Cả hai lớp"),
                                  "success"
                                );
                              }}
                              title="Click để chuyển phân hệ: Online -> Offline -> Cả hai"
                              className="cursor-pointer"
                            >
                              <span
                                className={
                                  "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border " +
                                  (ex.target_mode === "online"
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                    : ex.target_mode === "offline"
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-blue-50 text-[#1D4ED8] border-blue-200")
                                }
                              >
                                {ex.target_mode === "online"
                                  ? "Online"
                                  : ex.target_mode === "offline"
                                  ? "Offline"
                                  : "Cả 2"}
                              </span>
                            </button>
                          </td>
                          <td className="py-3.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={async () => {
                                const newAllow = !(ex?.allowRetake ?? true);
                                const newExams = practiceExams.map((e) =>
                                  e?.id === ex?.id ? { ...e, allowRetake: newAllow } : e
                                );
                                await savePracticeExams(newExams);
                                try {
                                  await supabase
                                    .from("practice_exams")
                                    .update({ allowRetake: newAllow })
                                    .eq("id", ex.id);
                                } catch {}
                                showToast("Đã thay đổi quyền làm lại.", "success");
                              }}
                              className="cursor-pointer"
                            >
                              {ex?.allowRetake ?? true ? (
                                <ToggleRight className="w-7 h-7 text-emerald-500 mx-auto" />
                              ) : (
                                <ToggleLeft className="w-7 h-7 text-slate-300 mx-auto" />
                              )}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={async () => {
                                const newAllow = !(ex?.allowViewFile ?? true);
                                const newExams = practiceExams.map((e) =>
                                  e?.id === ex?.id ? { ...e, allowViewFile: newAllow } : e
                                );
                                await savePracticeExams(newExams);
                                try {
                                  await supabase
                                    .from("practice_exams")
                                    .update({ allowViewFile: newAllow })
                                    .eq("id", ex.id);
                                } catch {}
                                showToast("Đã cập nhật quyền xem file.", "success");
                              }}
                              className="cursor-pointer"
                            >
                              {ex?.allowViewFile ?? true ? (
                                <ToggleRight className="w-7 h-7 text-[#1D4ED8] mx-auto" />
                              ) : (
                                <ToggleLeft className="w-7 h-7 text-slate-300 mx-auto" />
                              )}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={async () => {
                                const url = prompt("Nhập link Google Drive mới:", ex?.driveUrl || "");
                                if (url !== null) {
                                  const newExams = practiceExams.map((e) =>
                                    e?.id === ex?.id ? { ...e, driveUrl: url } : e
                                  );
                                  await savePracticeExams(newExams);
                                  try {
                                    await supabase
                                      .from("practice_exams")
                                      .update({ driveUrl: url })
                                      .eq("id", ex.id);
                                  } catch {}
                                  showToast("Đã cập nhật link Drive.", "success");
                                }
                              }}
                              className="text-[#1D4ED8] hover:underline flex items-center justify-center gap-1.5 font-semibold text-xs mx-auto cursor-pointer"
                            >
                              <LinkIcon className="w-3.5 h-3.5" />{" "}
                              {ex?.driveUrl ? "Sửa link" : "Thêm link"}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setVideoModalExam(ex);
                                setSolutionVideoInput(ex?.solutionVideoUrl || ex?.videoUrl || "");
                              }}
                              className={
                                "px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer " +
                                (ex?.solutionVideoUrl || ex?.videoUrl
                                  ? "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                              }
                            >
                              <Video className="w-3.5 h-3.5 text-amber-600" />
                              <span>
                                {ex?.solutionVideoUrl || ex?.videoUrl
                                  ? "Đã có video"
                                  : "+ Gắn video"}
                              </span>
                            </button>
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* NÚT IN PHIẾU TRẢ LỜI A4 ĐỘNG CHO RIÊNG ĐỀ NÀY */}
                              <button
                                type="button"
                                onClick={() => openPrintableDynamicAnswerSheet(ex)}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
                                title="In phiếu trả lời trắc nghiệm A4 tự co giãn theo số câu của đề này"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* NÚT CHẤM BÀI THI GIẤY HÀNG LOẠT CHO ĐỀ NÀY */}
                              <button
                                type="button"
                                onClick={() => {
                                  setBulkScannerDefaultExam(ex);
                                  setIsBulkScannerOpen(true);
                                }}
                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-xl transition cursor-pointer"
                                title="Chấm bài thi giấy cả lớp cho đề này"
                              >
                                <Camera className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setAzotaScoreViewModal({
                                    isOpen: true,
                                    examTitle: ex.title,
                                    attempts: ex.attempts || []
                                  });
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                                title="Xem bảng điểm học sinh làm đề này kiểu Azota"
                              >
                                <BarChart2 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => onOpenExamEditor(ex)}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-xl transition cursor-pointer"
                                title="Sửa cấu trúc câu hỏi, lời giải & đáp án"
                              >
                                <FileSignature className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => onTestExam(ex)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                title="Làm thử để kiểm tra đề & KaTeX"
                              >
                                <Play className="w-3 h-3 fill-indigo-600" /> Test
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  if (confirm("Xóa đề này khỏi kho?")) {
                                    const updated = practiceExams.filter((e) => e?.id !== ex?.id);
                                    await savePracticeExams(updated);
                                    try {
                                      await supabase
                                        .from("practice_exams")
                                        .delete()
                                        .eq("id", ex.id);
                                      showToast("Đã xóa đề thi khỏi kho.", "success");
                                    } catch {}
                                  }
                                }}
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. NỘI DUNG SUBTAB 2: ĐIỂM & XẾP HẠNG LUYỆN ĐỀ */}
      {practiceSubTab === "scores" && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-extrabold text-slate-900 text-[14px] flex items-center gap-2.5">
              <Filter className="w-4 h-4 text-[#1D4ED8]" /> Bộ lọc danh mục đề thi
            </h3>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setBulkScannerDefaultExam(practiceExams?.[0] || null);
                  setIsBulkScannerOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Camera className="w-3.5 h-3.5" /> + Chấm bài giấy cả lớp
              </button>

              <select
                value={practiceCategoryFilter}
                onChange={(e) => setPracticeCategoryFilter(e.target.value)}
                className="px-4 py-2.5 text-xs font-bold text-[#1D4ED8] bg-blue-50/50 border border-blue-100 rounded-xl focus:border-blue-500 outline-none transition cursor-pointer"
              >
                <option value="Tất cả danh mục">Tất cả danh mục</option>
                {EXAM_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-[14px]">
                  Danh Sách Đề Thi & Bảng Điểm Học Sinh ({practiceCategoryFilter}
                  {selectedMonthFilter !== "all" ? ` • Tháng ${selectedMonthFilter}` : ""})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  * Bấm vào bất kỳ đề thi nào để mở toàn bộ học sinh đã làm đề thi đó (bao gồm cả
                  Web & Thi giấy).
                </p>
              </div>
              <span className="text-xs text-slate-500 font-bold">
                {filteredScoresExams.length} đề thi
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-5 w-14 font-bold text-center">STT</th>
                    <th className="py-3.5 px-5 font-bold min-w-[240px]">Tên đề thi</th>
                    <th className="py-3.5 px-3 font-bold text-center">Tháng</th>
                    <th className="py-3.5 px-4 font-bold text-center">Phân loại</th>
                    <th className="py-3.5 px-4 font-bold text-center">Số HS làm bài</th>
                    <th className="py-3.5 px-4 font-bold text-center text-blue-700">
                      Điểm TB cả lớp
                    </th>
                    <th className="py-3.5 px-4 font-bold text-center text-emerald-700">
                      Điểm cao nhất
                    </th>
                    <th className="py-3.5 px-5 font-bold text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60">
                  {filteredScoresExams.map((ex, i) => {
                    const examMonth = resolveExamMonth(ex);
                    return (
                      <tr
                        key={ex.id || i}
                        onClick={() => {
                          setAzotaScoreViewModal({
                            isOpen: true,
                            examTitle: ex.title,
                            attempts: ex.attempts || []
                          });
                        }}
                        className="hover:bg-blue-50/40 transition-colors bg-white cursor-pointer group"
                      >
                        <td className="py-3.5 px-5 font-bold text-slate-400 text-center">
                          {i + 1}
                        </td>
                        <td className="py-3.5 px-5 font-bold text-slate-800 group-hover:text-[#1D4ED8] transition-colors">
                          <div>{ex.title}</div>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {ex.duration_minutes || 45} phút
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-black uppercase">
                            Tháng {examMonth < 10 ? "0" + examMonth : examMonth}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-black uppercase">
                            {ex.category || "Luyện đề"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                          {ex.uniqueStudentCount} bạn ({ex.totalSubmissions} lượt)
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-md border border-blue-100">
                            {ex.avgScore}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-black rounded-md border border-emerald-100">
                            {ex.maxScore}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAzotaScoreViewModal({
                                isOpen: true,
                                examTitle: ex.title,
                                attempts: ex.attempts || []
                              });
                            }}
                            className="px-3 py-1 bg-white border border-slate-200 hover:border-[#1D4ED8] hover:text-[#1D4ED8] text-slate-600 font-bold text-xs rounded-xl shadow-2xs transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> Xem điểm
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL XUẤT PHIẾU TRẢ LỜI A4 ĐỘNG THEO ĐỀ */}
      {isExportSheetModalOpen && (
        <div
          onClick={() => setIsExportSheetModalOpen(false)}
          className="fixed inset-0 z-[520] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 cursor-default"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    Xuất Phiếu Trả Lời A4 Động Theo Cấu Trúc Đề
                  </h4>
                  <p className="text-xs text-slate-500">
                    Tự động co giãn & sang trang thứ 2 nếu đề trên 40 câu (VD: 100+ câu)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportSheetModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 block">
                Chọn đề thi cần xuất phiếu trả lời A4:
              </label>
              <select
                value={selectedExamForSheetId}
                onChange={(e) => setSelectedExamForSheetId(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none focus:border-[#1D4ED8]"
              >
                {(practiceExams || []).map((ex) => {
                  const counts = extractExamQuestionCounts(ex);
                  const bp = buildDynamicOMRBlueprint(ex);
                  return (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} — ({counts.totalCount} câu • {bp.totalPages || 1} trang A4)
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsExportSheetModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  const found = (practiceExams || []).find(
                    (e) => String(e.id) === String(selectedExamForSheetId)
                  );
                  openPrintableDynamicAnswerSheet(found || practiceExams?.[0]);
                  setIsExportSheetModalOpen(false);
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Mở bản in Phiếu A4
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL BẢNG TRA CỨU & IN SỐ BÁO DANH (SBD) HỌC SINH THEO STT */}
      {isSbdDirectoryModalOpen && (
        <div
          onClick={() => setIsSbdDirectoryModalOpen(false)}
          className="fixed inset-0 z-[520] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden cursor-default"
          >
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-base font-extrabold text-slate-900">
                  Bảng Cấp Số Báo Danh (SBD) Tự Động Theo STT Lớp
                </h4>
                <p className="text-xs text-slate-500">
                  Học sinh dùng mã SBD 6 chữ số này để tô vào mục 7. Số báo danh trên phiếu thi giấy
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintClassSBDTable}
                  className="px-3.5 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> In bảng SBD
                </button>
                <button
                  type="button"
                  onClick={() => setIsSbdDirectoryModalOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-14">STT</th>
                    <th className="py-2.5 px-4 text-center">Số Báo Danh (6 số)</th>
                    <th className="py-2.5 px-4">Họ và tên học sinh</th>
                    <th className="py-2.5 px-4">Trường / Khối</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentsDirectory.map((st) => (
                    <tr key={st.id} className="hover:bg-blue-50/40">
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">{st.stt}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#1D4ED8] border border-blue-200 font-mono font-black">
                          {st.sbd}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">{st.full_name}</td>
                      <td className="py-2.5 px-4 text-slate-500">{st.school || "THPT"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL CHẤM BÀI THI GIẤY HÀNG LOẠT (ADMIN BULK OMR SCANNER) */}
      <AdminBulkOMRScannerModal
        isOpen={isBulkScannerOpen}
        onClose={() => setIsBulkScannerOpen(false)}
        practiceExams={practiceExams}
        defaultSelectedExam={bulkScannerDefaultExam}
        studentsList={studentsDirectory}
        supabase={supabase}
        showToast={showToast}
      />
    </div>
  );
}
