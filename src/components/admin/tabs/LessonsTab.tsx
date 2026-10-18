"use client";

import React, { useState, useRef, useMemo } from "react";
import { 
  Layers, 
  BookOpen, 
  Video, 
  FolderPlus, 
  Plus, 
  Edit3, 
  Trash2, 
  FileText, 
  FileUp, 
  Link as LinkIcon, 
  X, 
  CheckSquare, 
  Award,
  Calendar,
  Filter
} from "lucide-react";
import dynamic from "next/dynamic";

// Dynamic import AzotaExamConfigModal chuẩn Next.js (SSR: false)
const AzotaExamConfigModal = dynamic<any>(
  () => import("@/app/admin/AzotaExamConfigModal").then((mod: any) => mod.AzotaExamConfigModal || mod.default || mod),
  { ssr: false }
);

export const MatrixCell = ({
  items,
  onAdd,
  onView,
  label,
  subBadge
}: {
  items: any[];
  onAdd: () => void;
  onView: () => void;
  label: string;
  subBadge?: string;
}) => {
  const count = items && Array.isArray(items) ? items.length : 0;

  if (count > 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-0.5">
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }} 
          title={`Xem danh sách ${label} (${count})`} 
          className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-[#1D4ED8] text-[#1D4ED8] bg-blue-50 font-black text-xs hover:bg-[#1D4ED8] hover:text-white transition-all mx-auto cursor-pointer shadow-sm select-none"
        >
          {count}
        </button>
        {subBadge && (
          <span className="text-[9px] font-extrabold text-slate-400 tracking-tighter select-none">
            {subBadge}
          </span>
        )}
      </div>
    );
  }

  return (
    <button 
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
      }} 
      title={`Thêm ${label}`} 
      className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-[#1D4ED8] hover:text-[#1D4ED8] hover:bg-blue-50 transition-all mx-auto cursor-pointer select-none"
    >
      <Plus className="w-3.5 h-3.5" />
    </button>
  );
};

interface LessonsTabProps {
  chapters: any[];
  setChapters?: React.Dispatch<React.SetStateAction<any[]>> | ((newChapters: any[]) => void);
  onUpdateChapters?: (newChapters: any[], taskName?: string) => Promise<any> | void;
  saveToStorage?: (newChapters: any[], taskName?: string) => Promise<any> | void;
  lessonModeTab: "all" | "offline" | "online";
  setLessonModeTab: (tab: "all" | "offline" | "online") => void;
  offlineLessonCount?: number;
  onlineLessonCount?: number;
  flattenedLessons?: any[];
  setCreateModal: (modal: { type: "chapter" | "lesson"; chapterId?: string } | null) => void;
  setResourceModal: (modal: any) => void;
  setViewResourcesModal: (modal: any) => void;
  setUploadMethodModal?: (modal: { lessonId: string; type: "homework_files" | "test_quizzes" } | null) => void;
  setBoostModal: (lessonId: string | null) => void;
  setEditLessonModal: (modal: { chapterId: string; lesson: any } | null) => void;
  setEditLessonForm: (form: any) => void;
  handleDeleteLesson: (chapterId: string, lessonId: string) => Promise<void> | void;
  syncStatus?: {
    isSyncing: boolean;
    progress: number;
    message: string;
    type: "idle" | "loading" | "success" | "error";
  };
  [key: string]: any;
}

export default function LessonsTab({
  chapters,
  setChapters,
  onUpdateChapters,
  saveToStorage,
  lessonModeTab,
  setLessonModeTab,
  setCreateModal,
  setResourceModal,
  setViewResourcesModal,
  setBoostModal,
  setEditLessonModal,
  setEditLessonForm,
  handleDeleteLesson,
  syncStatus,
  ...restProps
}: LessonsTabProps) {
  // THÁNG VÀ TUẦN HIỆN TẠI THEO THỜI GIAN THỰC (REALTIME DEFAULT)
  const currentRealtimeMonth = useMemo(() => new Date().getMonth() + 1, []);
  const currentRealtimeWeek = useMemo(() => Math.min(5, Math.max(1, Math.ceil(new Date().getDate() / 7))), []);

  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>("all");

  // 1. TỰ ĐỘNG TÍNH TOÁN AN TOÀN NỘI BỘ SỐ LƯỢNG BÀI HỌC ONLINE / OFFLINE
  const safeOfflineCount = useMemo(() => {
    if (!chapters || !Array.isArray(chapters)) return 0;
    return chapters.reduce((total: number, chap: any) => {
      return total + (chap?.lessons || []).filter((l: any) => l?.target_mode === "offline" || l?.target_mode === "all" || !l?.target_mode).length;
    }, 0);
  }, [chapters]);

  const safeOnlineCount = useMemo(() => {
    if (!chapters || !Array.isArray(chapters)) return 0;
    return chapters.reduce((total: number, chap: any) => {
      return total + (chap?.lessons || []).filter((l: any) => l?.target_mode === "online" || l?.target_mode === "all" || (!l?.target_mode && l?.format === "Zoom")).length;
    }, 0);
  }, [chapters]);

  // 2. TỰ ĐỘNG TÍNH TOÁN DANH SÁCH BÀI HỌC PHẲNG (FLATTENED LESSONS) NỘI BỘ
  const computedFlattenedLessons = useMemo(() => {
    if (!chapters || !Array.isArray(chapters)) return [];
    const list: any[] = [];
    chapters.forEach((chap: any) => {
      (chap?.lessons || []).forEach((les: any) => {
        if (lessonModeTab === "offline" && les?.target_mode !== "offline" && les?.target_mode !== "all") {
          return;
        }
        if (lessonModeTab === "online" && les?.target_mode !== "online" && les?.target_mode !== "all") {
          return;
        }
        const lesMonth = Number(les?.assigned_month) || currentRealtimeMonth;
        const lesWeek = Number(les?.assigned_week) || 1;

        if (selectedMonthFilter !== "all" && lesMonth !== Number(selectedMonthFilter)) {
          return;
        }

        list.push({
          ...les,
          assigned_month: lesMonth,
          assigned_week: lesWeek,
          chapterId: chap?.id || "chap-default",
          chapterTitle: (chap?.title || "").split(":")[0] || chap?.title || "Chương"
        });
      });
    });
    return list;
  }, [chapters, lessonModeTab, selectedMonthFilter, currentRealtimeMonth]);

  const flattenedLessons = restProps.flattenedLessons || computedFlattenedLessons;

  // Modal trung gian chọn loại file nạp (PDF / DOCX / DRIVE) kèm chọn Tuần & Tháng
  const [internalUploadModal, setInternalUploadModal] = useState<{
    lessonId: string;
    lessonTitle: string;
    type: "homework_files" | "test_quizzes";
    assignedMonth: number;
    assignedWeek: number;
  } | null>(null);

  const [activeTestFile, setActiveTestFile] = useState<File | null>(null);
  
  // DÙNG REF ĐỂ LƯU TARGET NẠP (BAO GỒM ASSIGNED_MONTH & ASSIGNED_WEEK) TRÁNH BỊ MẤT KHI MODAL UNMOUNT
  const uploadTargetRef = useRef<{
    lessonId: string;
    type: "homework_files" | "test_quizzes";
    assignedMonth: number;
    assignedWeek: number;
  } | null>(null);

  const [activeUploadTarget, setActiveUploadTarget] = useState<{
    lessonId: string;
    type: "homework_files" | "test_quizzes";
    assignedMonth: number;
    assignedWeek: number;
  } | null>(null);

  // Modal dán link Google Drive thủ công
  const [driveModal, setDriveModal] = useState<{
    lessonId: string;
    type: "homework_files" | "test_quizzes";
    assignedMonth: number;
    assignedWeek: number;
  } | null>(null);
  const [driveTitle, setDriveTitle] = useState("");
  const [driveUrl, setDriveUrl] = useState("");

  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const docxInputRef = useRef<HTMLInputElement | null>(null);

  // HÀM ĐẨY THAY ĐỔI LÊN CẤP CHA TỨC THÌ (OPTIMISTIC DISPATCH - 0MS)
  const dispatchOptimisticUpdate = (newChapters: any[], taskLabel: string = "bài tập") => {
    if (typeof onUpdateChapters === "function") {
      onUpdateChapters(newChapters, taskLabel);
    } else if (typeof saveToStorage === "function") {
      saveToStorage(newChapters, taskLabel);
    } else if (typeof setChapters === "function") {
      setChapters(newChapters);
    }
  };

  // HÀM ĐỔI NHANH TUẦN / THÁNG CỦA BÀI HỌC NGAY TRÊN BẢNG VÀ ĐỒNG BỘ XUỐNG BTVN & ĐỀ KIỂM TRA
  const handleQuickChangeLessonSchedule = (
    chapterId: string,
    lessonId: string,
    newMonth: number,
    newWeek: number
  ) => {
    const updatedChapters = (chapters || []).map((chap: any) => {
      if (chap?.id !== chapterId) return chap;
      return {
        ...chap,
        lessons: (chap?.lessons || []).map((les: any) => {
          if (les?.id !== lessonId) return les;
          const updatedHw = Array.isArray(les.homework_files)
            ? les.homework_files.map((hw: any) => ({
                ...hw,
                assigned_month: newMonth,
                assigned_week: newWeek,
              }))
            : [];
          const updatedTests = Array.isArray(les.test_quizzes)
            ? les.test_quizzes.map((tq: any) => ({
                ...tq,
                assigned_month: newMonth,
                assigned_week: newWeek,
              }))
            : [];
          return {
            ...les,
            assigned_month: newMonth,
            assigned_week: newWeek,
            homework_files: updatedHw,
            test_quizzes: updatedTests,
          };
        }),
      };
    });

    dispatchOptimisticUpdate(updatedChapters, `lịch bài học T${newWeek}.Th${newMonth}`);
  };

  // MỞ MENU CHỌN NẠP ĐỀ (MẶC ĐỊNH LẤY THÁNG & TUẦN CỦA BÀI HỌC HOẶC THÁNG/TUẦN HIỆN TẠI REALTIME)
  const handleOpenUploadPicker = (lesson: any, type: "homework_files" | "test_quizzes") => {
    const defaultM = Number(lesson?.assigned_month) || currentRealtimeMonth;
    const defaultW = Number(lesson?.assigned_week) || currentRealtimeWeek;

    const targetObj = {
      lessonId: lesson.id,
      lessonTitle: lesson.title || "Bài học",
      type: type,
      assignedMonth: defaultM,
      assignedWeek: defaultW,
    };
    uploadTargetRef.current = {
      lessonId: lesson.id,
      type,
      assignedMonth: defaultM,
      assignedWeek: defaultW,
    };
    setInternalUploadModal(targetObj);
  };

  // CHỌN FILE VÀ MỞ AZOTA MODAL NGAY
  const handleSelectFile = (file: File) => {
    if (!internalUploadModal) return;
    const targetObj = {
      lessonId: internalUploadModal.lessonId,
      type: internalUploadModal.type,
      assignedMonth: internalUploadModal.assignedMonth || currentRealtimeMonth,
      assignedWeek: internalUploadModal.assignedWeek || currentRealtimeWeek,
    };
    uploadTargetRef.current = targetObj;
    setActiveUploadTarget(targetObj);
    setActiveTestFile(file);
    setInternalUploadModal(null);
  };

  // CALLBACK KHI AZOTA CONFIG HOÀN TẤT BÓC TÁCH VÀ XUẤT BẢN ĐỀ (ĐÍNH KÈM ASSIGNED_MONTH & ASSIGNED_WEEK)
  const handleSaveExamFromAzota = (payload: any) => {
    const currentTarget = activeUploadTarget || uploadTargetRef.current;
    if (!currentTarget) {
      setActiveTestFile(null);
      return;
    }

    const { lessonId, type, assignedMonth, assignedWeek } = currentTarget;
    const isHw = type === "homework_files";

    const examData = payload?.examData || payload?.data || payload;
    const rawSections = payload?.sections || examData?.sections || payload?.data || [];
    const incomingMediaMap = payload?.mediaMap || payload?.media_map || examData?.mediaMap || examData?.media_map || {};

    const defaultTitle = isHw ? "Bài tập về nhà (BTVN)" : "Đề kiểm tra định kỳ";
    const title = payload?.title || examData?.title || activeTestFile?.name?.replace(/\.[^/.]+$/, "") || defaultTitle;
    
    const duration = isHw ? 0 : (payload?.duration_minutes || examData?.duration_minutes || 45);
    const quizId = payload?.id || examData?.id || ("quiz-" + Date.now());

    const finalMonth = Number(payload?.assigned_month || examData?.assigned_month || assignedMonth || currentRealtimeMonth);
    const finalWeek = Number(payload?.assigned_week || examData?.assigned_week || assignedWeek || currentRealtimeWeek);

    // 1. ĐÓNG MODAL NGAY LẬP TỨC (< 30MS)
    setActiveTestFile(null);
    setActiveUploadTarget(null);
    uploadTargetRef.current = null;

    // 2. CẤU TRÚC ĐỐI TƯỢNG BÀI THI/BTVN CHUẨN XÁC (GẮN ASSIGNED_MONTH & ASSIGNED_WEEK)
    const newQuizItem = {
      id: quizId,
      title: title,
      duration_minutes: duration,
      is_quiz: true,
      isHomework: isHw,
      assigned_month: finalMonth,
      assigned_week: finalWeek,
      data: rawSections,
      sections: rawSections,
      media_map: incomingMediaMap,
      mediaMap: incomingMediaMap,
      created_at: new Date().toISOString()
    };

    // 3. CẬP NHẬT VÀO BÀI HỌC (ĐỒNG BỘ LUÔN ASSIGNED_MONTH & ASSIGNED_WEEK CHO BÀI HỌC ĐÓ)
    const updatedChapters = (chapters || []).map((chap: any) => ({
      ...chap,
      lessons: (chap?.lessons || []).map((les: any) => {
        if (les.id !== lessonId) return les;
        const currentList = Array.isArray(les[type]) ? les[type] : [];
        return {
          ...les,
          assigned_month: les.assigned_month || finalMonth,
          assigned_week: les.assigned_week || finalWeek,
          [type]: [...currentList, newQuizItem]
        };
      })
    }));

    dispatchOptimisticUpdate(updatedChapters, isHw ? "bài tập về nhà" : "đề kiểm tra");
  };

  // LƯU LINK DRIVE THỦ CÔNG (CÓ ĐÍNH KÈM ASSIGNED_MONTH & ASSIGNED_WEEK)
  const handleSaveDriveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveModal || !driveTitle.trim() || !driveUrl.trim()) return;

    const { lessonId, type, assignedMonth, assignedWeek } = driveModal;
    const isHw = type === "homework_files";
    const newItem = {
      id: "drive-" + Date.now(),
      title: driveTitle.trim(),
      url: driveUrl.trim(),
      is_quiz: false,
      isHomework: isHw,
      is_drive_file: true,
      assigned_month: assignedMonth || currentRealtimeMonth,
      assigned_week: assignedWeek || currentRealtimeWeek,
      created_at: new Date().toISOString()
    };

    setDriveModal(null);
    setDriveTitle("");
    setDriveUrl("");

    const updatedChapters = (chapters || []).map((chap: any) => ({
      ...chap,
      lessons: (chap?.lessons || []).map((les: any) => {
        if (les.id !== lessonId) return les;
        const currentList = Array.isArray(les[type]) ? les[type] : [];
        return {
          ...les,
          assigned_month: les.assigned_month || assignedMonth || currentRealtimeMonth,
          assigned_week: les.assigned_week || assignedWeek || currentRealtimeWeek,
          [type]: [...currentList, newItem]
        };
      })
    }));

    dispatchOptimisticUpdate(updatedChapters, isHw ? "file Drive BTVN" : "file Drive đề thi");
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300 text-left relative font-sans">
      {/* INPUT FILE ẨN PHỤC VỤ UPLOAD WORD & PDF */}
      <input 
        type="file" 
        ref={pdfInputRef} 
        accept=".pdf" 
        className="hidden" 
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleSelectFile(f);
          e.target.value = "";
        }}
      />
      <input 
        type="file" 
        ref={docxInputRef} 
        accept=".docx" 
        className="hidden" 
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleSelectFile(f);
          e.target.value = "";
        }}
      />

      {/* 1. THANH ĐIỀU HƯỚNG BỘ LỌC PHÂN LUỒNG + LỌC THÁNG + NÚT TẠO MỚI */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setLessonModeTab("all")}
              className={
                "flex items-center gap-2 px-3.5 py-2 rounded-xl font-extrabold text-xs transition-all cursor-pointer " +
                (lessonModeTab === "all"
                  ? "bg-white text-[#1D4ED8] shadow-sm border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Tất cả bài học</span>
            </button>
            <button
              type="button"
              onClick={() => setLessonModeTab("offline")}
              className={
                "flex items-center gap-2 px-3.5 py-2 rounded-xl font-extrabold text-xs transition-all cursor-pointer " +
                (lessonModeTab === "offline"
                  ? "bg-white text-emerald-700 shadow-sm border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span>Bài học Offline ({safeOfflineCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setLessonModeTab("online")}
              className={
                "flex items-center gap-2 px-3.5 py-2 rounded-xl font-extrabold text-xs transition-all cursor-pointer " +
                (lessonModeTab === "online"
                  ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900")
              }
            >
              <Video className="w-4 h-4 text-indigo-600" />
              <span>Bài học Online ({safeOnlineCount})</span>
            </button>
          </div>

          {/* BỘ LỌC NHANH THEO THÁNG */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/70 rounded-2xl border border-blue-200/70">
            <Filter className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <span className="text-[11px] font-bold text-slate-600">Tháng:</span>
            <select
              value={selectedMonthFilter}
              onChange={(e) => setSelectedMonthFilter(e.target.value)}
              className="bg-transparent text-xs font-black text-[#1D4ED8] outline-none cursor-pointer"
            >
              <option value="all">Tất cả tháng</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={String(m)}>
                  Tháng {m < 10 ? "0" + m : m} {m === currentRealtimeMonth ? "(Hiện tại)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setCreateModal({ type: "chapter" });
            }} 
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl shadow-sm transition cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-[#1D4ED8]" /> Thêm Chương
          </button>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!chapters || chapters.length === 0) return alert("Vui lòng thêm Chương trước!");
              setCreateModal({ type: "lesson", chapterId: chapters[0].id });
            }} 
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold rounded-2xl shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Thêm Bài học mới
          </button>
        </div>
      </div>

      {/* 2. BẢNG MATRIX NỘI DUNG BÀI HỌC CHUẨN NỀN XANH #1D4ED8 (KÈM CỘT TUẦN / THÁNG TRỰC QUAN) */}
      <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[1180px] text-left border-collapse">
            <thead className="bg-[#1D4ED8] text-white text-[11px] font-black uppercase tracking-wider">
              <tr>
                <th className="py-4 px-3 text-center w-12 border-r border-blue-400/30">STT</th>
                <th className="py-4 px-4 border-r border-blue-400/30 min-w-[230px]">Nội dung bài học</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-36">Tuần / Tháng</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center">Chương</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-24">Phân luồng</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-20">Hình thức</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-18">Video</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-18">Bài giảng</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-18">Viết tay</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-20">BTVN</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-20">Đề KT</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-22">Tăng cường</th>
                <th className="py-4 px-3 text-center w-22">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {flattenedLessons.map((les: any, idx: number) => {
                const lesTitle = les?.title || "Bài học";
                const isReview = lesTitle.toLowerCase().includes("ôn tập") || lesTitle.toLowerCase().includes("bài tập");
                const lesMonth = Number(les?.assigned_month) || currentRealtimeMonth;
                const lesWeek = Number(les?.assigned_week) || 1;
                const scheduleTag = `T${lesWeek}.Th${lesMonth}`;

                return (
                  <tr key={les?.id || idx} className="hover:bg-slate-50/50 transition-colors bg-white">
                    <td className="py-3.5 px-3 text-center text-slate-500 font-bold text-xs border-r border-slate-100">{idx + 1}</td>
                    <td className="py-3.5 px-4 border-r border-slate-100">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {isReview && (
                          <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold uppercase rounded border border-amber-200">
                            Ôn tập
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-[#1D4ED8] text-[10px] font-extrabold rounded-md border border-blue-200">
                          <Calendar className="w-2.5 h-2.5" />
                          Tuần {lesWeek} - Tháng {lesMonth < 10 ? "0" + lesMonth : lesMonth}
                        </span>
                      </div>
                      <h4 className="font-bold text-[#1D4ED8] text-[13px] uppercase leading-snug">{lesTitle}</h4>
                    </td>

                    {/* CỘT CHỌN NHANH TUẦN & THÁNG REALTIME */}
                    <td className="py-3.5 px-3 text-center border-r border-slate-100">
                      <div className="flex items-center justify-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/90">
                        <select
                          value={lesWeek}
                          onChange={(e) =>
                            handleQuickChangeLessonSchedule(
                              les.chapterId,
                              les.id,
                              lesMonth,
                              Number(e.target.value)
                            )
                          }
                          title="Chọn Tuần trong tháng cho bài học"
                          className="bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-[11px] font-black text-emerald-700 outline-none focus:border-[#1D4ED8] cursor-pointer"
                        >
                          {[1, 2, 3, 4, 5].map((w) => (
                            <option key={w} value={w}>
                              Tuần {w}
                            </option>
                          ))}
                        </select>
                        <select
                          value={lesMonth}
                          onChange={(e) =>
                            handleQuickChangeLessonSchedule(
                              les.chapterId,
                              les.id,
                              Number(e.target.value),
                              lesWeek
                            )
                          }
                          title="Chọn Tháng báo cáo cho bài học"
                          className="bg-white border border-slate-200 rounded-lg px-1.5 py-1 text-[11px] font-black text-[#1D4ED8] outline-none focus:border-[#1D4ED8] cursor-pointer"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                            <option key={m} value={m}>
                              Th.{m < 10 ? "0" + m : m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center border-r border-slate-100 text-[11px] text-slate-500 font-semibold uppercase">
                      {les.chapterTitle}
                    </td>
                    <td className="py-3.5 px-3 text-center border-r border-slate-100">
                      <span className={
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider " +
                        (les.target_mode === "online"
                          ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                          : les.target_mode === "offline"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-blue-100 text-[#1D4ED8] border border-blue-200")
                      }>
                        {les.target_mode === "online" ? "Online" : les.target_mode === "offline" ? "Offline" : "Cả 2"}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center border-r border-slate-100 text-xs font-bold text-slate-600">
                      {les.format || "Zoom"}
                    </td>

                    {/* CỘT VIDEO */}
                    <td className="py-3.5 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.video_list} 
                        label="Video" 
                        onAdd={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "video_list" })} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "video_list", title: "Video", items: les.video_list })} 
                      />
                    </td>

                    {/* CỘT BÀI GIẢNG */}
                    <td className="py-3.5 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.lecture_files} 
                        label="Bài giảng" 
                        onAdd={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "lecture_files" })} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "lecture_files", title: "Bài giảng", items: les.lecture_files })} 
                      />
                    </td>

                    {/* CỘT VIẾT TAY */}
                    <td className="py-3.5 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.handwritten_notes} 
                        label="Viết tay" 
                        onAdd={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "handwritten_notes" })} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "handwritten_notes", title: "Viết tay", items: les.handwritten_notes })} 
                      />
                    </td>

                    {/* CỘT BTVN - HIỂN THỊ TAG TUẦN/THÁNG */}
                    <td className="py-3.5 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.homework_files} 
                        label="BTVN"
                        subBadge={scheduleTag}
                        onAdd={() => handleOpenUploadPicker(les, "homework_files")} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "homework_files", title: "BTVN", items: les.homework_files })} 
                      />
                    </td>

                    {/* CỘT ĐỀ KT - HIỂN THỊ TAG TUẦN/THÁNG */}
                    <td className="py-3.5 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.test_quizzes} 
                        label="Đề KT"
                        subBadge={scheduleTag}
                        onAdd={() => handleOpenUploadPicker(les, "test_quizzes")} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "test_quizzes", title: "Đề kiểm tra", items: les.test_quizzes })} 
                      />
                    </td>

                    {/* CỘT TĂNG CƯỜNG */}
                    <td className="py-3.5 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.extra_resources} 
                        label="Tăng cường" 
                        onAdd={() => setBoostModal(les.id)} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "extra_resources", title: "Tăng cường", items: les.extra_resources })} 
                      />
                    </td>

                    {/* THAO TÁC */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button 
                          type="button"
                          onClick={(e) => { 
                            e.stopPropagation();
                            setEditLessonModal({ chapterId: les.chapterId, lesson: les }); 
                            setEditLessonForm({ 
                              title: les.title, 
                              description: les.description || "", 
                              duration: les.duration || 45, 
                              format: les.format || "Zoom", 
                              target_mode: les.target_mode || "all",
                              assigned_month: lesMonth,
                              assigned_week: lesWeek
                            }); 
                          }} 
                          className="p-1.5 text-slate-400 hover:text-[#1D4ED8] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" 
                          title="Sửa bài học"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteLesson(les.chapterId, les.id);
                          }} 
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer" 
                          title="Xóa bài học"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. MODAL CHỌN PHƯƠNG THỨC NẠP ĐỀ THI / BTVN (CÓ CHỌN TUẦN & THÁNG REALTIME) */}
      {internalUploadModal && (
        <div 
          onClick={() => setInternalUploadModal(null)} 
          className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-white rounded-[28px] p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-150 cursor-default text-left"
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  {internalUploadModal.type === 'homework_files' ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Award className="w-5 h-5 text-emerald-600" />}
                  <span>Thêm {internalUploadModal.type === 'homework_files' ? 'Bài tập về nhà (BTVN)' : 'Đề Kiểm Tra'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bài học: <strong className="text-blue-700">{internalUploadModal.lessonTitle}</strong>
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setInternalUploadModal(null)} 
                className="text-slate-400 hover:text-rose-500 cursor-pointer p-1"
              >
                <X className="w-5 h-5"/>
              </button>
            </div>

            {/* CHỌN THÁNG & TUẦN CHO BTVN / ĐỀ KIỂM TRA TRƯỚC KHI TẢI LÊN */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200/80 mb-4">
              <div>
                <label className="block text-[11px] font-extrabold text-[#1D4ED8] mb-1">
                  Gắn vào Tháng báo cáo *
                </label>
                <select
                  value={internalUploadModal.assignedMonth}
                  onChange={(e) => {
                    const m = Number(e.target.value);
                    setInternalUploadModal((prev) => (prev ? { ...prev, assignedMonth: m } : null));
                    if (uploadTargetRef.current) uploadTargetRef.current.assignedMonth = m;
                  }}
                  className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:border-[#1D4ED8] cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>
                      Tháng {m < 10 ? "0" + m : m} {m === currentRealtimeMonth ? "(Hiện tại)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-[#1D4ED8] mb-1">
                  Gắn vào Tuần trong tháng *
                </label>
                <select
                  value={internalUploadModal.assignedWeek}
                  onChange={(e) => {
                    const w = Number(e.target.value);
                    setInternalUploadModal((prev) => (prev ? { ...prev, assignedWeek: w } : null));
                    if (uploadTargetRef.current) uploadTargetRef.current.assignedWeek = w;
                  }}
                  className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-black text-emerald-700 outline-none focus:border-[#1D4ED8] cursor-pointer"
                >
                  {[1, 2, 3, 4, 5].map((w) => (
                    <option key={w} value={w}>
                      Tuần {w} (Cột T{w}.{internalUploadModal.assignedMonth})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              {/* TẢI LÊN FILE PDF */}
              <div 
                onClick={() => pdfInputRef.current?.click()}
                className="p-4 border-2 border-indigo-200 bg-indigo-50/50 rounded-2xl hover:bg-indigo-100/60 transition cursor-pointer flex items-start gap-4 group shadow-2xs"
              >
                <div className="p-3 bg-white text-indigo-600 rounded-xl shadow-xs group-hover:scale-105 transition-transform shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-indigo-950 text-[14px]">Tải lên file PDF (.pdf)</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-black text-[9px] uppercase tracking-wider">Khuyên Dùng</span>
                  </div>
                  <div className="text-xs text-indigo-800/80 mt-1 leading-relaxed">
                    AI Gemini quét câu hỏi và bảng đáp án chuẩn, phân đoạn trực quan.
                  </div>
                </div>
              </div>

              {/* TẢI LÊN FILE WORD (.DOCX) */}
              <div 
                onClick={() => docxInputRef.current?.click()}
                className="p-4 border border-blue-200 bg-blue-50/40 rounded-2xl hover:bg-blue-100/50 transition cursor-pointer flex items-start gap-4 group shadow-2xs"
              >
                <div className="p-3 bg-white text-blue-600 rounded-xl shadow-xs group-hover:scale-105 transition-transform shrink-0">
                  <FileUp className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-blue-950 text-[14px]">Tải lên file Word (.docx)</div>
                  <div className="text-xs text-blue-800/80 mt-1 leading-relaxed">
                    Bóc tách tự động các câu hỏi trắc nghiệm, đúng sai và điền đáp số.
                  </div>
                </div>
              </div>
              
              {/* ĐÍNH KÈM LINK GOOGLE DRIVE */}
              <button 
                type="button"
                onClick={() => { 
                  setDriveModal({
                    lessonId: internalUploadModal.lessonId,
                    type: internalUploadModal.type,
                    assignedMonth: internalUploadModal.assignedMonth,
                    assignedWeek: internalUploadModal.assignedWeek,
                  }); 
                  setInternalUploadModal(null); 
                }} 
                className="p-4 border border-emerald-200 bg-emerald-50/40 rounded-2xl hover:bg-emerald-100/50 transition cursor-pointer flex items-start gap-4 text-left group shadow-2xs"
              >
                <div className="p-3 bg-white text-emerald-600 rounded-xl shadow-xs group-hover:scale-105 transition-transform shrink-0">
                  <LinkIcon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-emerald-950 text-[14px]">Đính kèm Link Google Drive</div>
                  <div className="text-xs text-emerald-800/80 mt-1 leading-relaxed">
                    Dán link chia sẻ file tài liệu để học sinh tự tải về học tập.
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL NHẬP LINK DRIVE THỦ CÔNG */}
      {driveModal && (
        <div 
          onClick={() => setDriveModal(null)} 
          className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 cursor-pointer"
        >
          <form 
            onClick={(e) => e.stopPropagation()} 
            onSubmit={handleSaveDriveLink} 
            className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-150 cursor-default text-left"
          >
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-emerald-700 text-[15px] flex items-center gap-2">
                <LinkIcon className="w-5 h-5" /> Đính kèm Link Google Drive
              </h3>
              <button type="button" onClick={() => setDriveModal(null)} className="text-slate-400 hover:text-rose-500 cursor-pointer">
                <X className="w-5 h-5"/>
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
                <div>
                  <label className="block text-[11px] font-bold text-emerald-800 mb-1">Tháng *</label>
                  <select
                    value={driveModal.assignedMonth}
                    onChange={(e) =>
                      setDriveModal((prev) => (prev ? { ...prev, assignedMonth: Number(e.target.value) } : null))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                      <option key={m} value={m}>Tháng {m < 10 ? "0" + m : m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-800 mb-1">Tuần *</label>
                  <select
                    value={driveModal.assignedWeek}
                    onChange={(e) =>
                      setDriveModal((prev) => (prev ? { ...prev, assignedWeek: Number(e.target.value) } : null))
                    }
                    className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-800 outline-none"
                  >
                    {[1, 2, 3, 4, 5].map((w) => (
                      <option key={w} value={w}>Tuần {w}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tiêu đề hiển thị *</label>
                <input 
                  required 
                  type="text" 
                  value={driveTitle} 
                  onChange={e => setDriveTitle(e.target.value)} 
                  placeholder="VD: Phiếu bài tập tự luyện số 1..."
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:border-emerald-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Link Google Drive (Chia sẻ công khai) *</label>
                <input 
                  required 
                  type="url" 
                  placeholder="https://drive.google.com/..." 
                  value={driveUrl} 
                  onChange={e => setDriveUrl(e.target.value)} 
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-medium focus:border-emerald-500 outline-none" 
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-5 mt-5 border-t border-slate-100">
              <button type="button" onClick={() => setDriveModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">
                Hủy
              </button>
              <button type="submit" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer">
                Lưu file Drive
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. GỌI TRỰC TIẾP AZOTA EXAM CONFIG MODAL (NON-BLOCKING CALLBACK) */}
      {activeTestFile && (
        <AzotaExamConfigModal 
          isOpen={Boolean(activeTestFile)} 
          file={activeTestFile}
          mode="course" 
          onClose={() => {
            setActiveTestFile(null);
            setActiveUploadTarget(null);
          }} 
          onSave={(examData: any) => {
            handleSaveExamFromAzota(examData);
            setActiveTestFile(null);
            setActiveUploadTarget(null);
          }}
        />
      )}
    </div>
  );
}
