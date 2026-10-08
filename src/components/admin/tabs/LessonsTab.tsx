"use client";

import React, { useState, useRef } from "react";
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
  Sparkles,
  CheckCircle2
} from "lucide-react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";

// Dynamic import AzotaExamConfigModal chuẩn Next.js (SSR: false)
const AzotaExamConfigModal = dynamic(
  () => import("@/app/admin/AzotaExamConfigModal").then((mod: any) => mod.AzotaExamConfigModal || mod.default || mod),
  { ssr: false }
);

export const MatrixCell = ({
  items,
  onAdd,
  onView,
  label
}: {
  items: any[];
  onAdd: () => void;
  onView: () => void;
  label: string;
}) => {
  const count = items && Array.isArray(items) ? items.length : 0;

  if (count > 0) {
    return (
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
  onUpdateChapters?: (newChapters: any[]) => void;
  lessonModeTab: "all" | "offline" | "online";
  setLessonModeTab: (tab: "all" | "offline" | "online") => void;
  offlineLessonCount: number;
  onlineLessonCount: number;
  flattenedLessons: any[];
  setCreateModal: (modal: { type: "chapter" | "lesson"; chapterId?: string } | null) => void;
  setResourceModal: (modal: any) => void;
  setViewResourcesModal: (modal: any) => void;
  setUploadMethodModal?: (modal: { lessonId: string; type: "homework_files" | "test_quizzes" } | null) => void;
  setBoostModal: (lessonId: string | null) => void;
  setEditLessonModal: (modal: { chapterId: string; lesson: any } | null) => void;
  setEditLessonForm: (form: any) => void;
  handleDeleteLesson: (chapterId: string, lessonId: string) => Promise<void>;
  saveToStorage?: (newChapters: any[]) => Promise<void>;
}

export default function LessonsTab({
  chapters,
  setChapters,
  onUpdateChapters,
  lessonModeTab,
  setLessonModeTab,
  offlineLessonCount,
  onlineLessonCount,
  flattenedLessons,
  setCreateModal,
  setResourceModal,
  setViewResourcesModal,
  setUploadMethodModal,
  setBoostModal,
  setEditLessonModal,
  setEditLessonForm,
  handleDeleteLesson,
  saveToStorage
}: LessonsTabProps) {
  // State quản lý việc upload và mở AzotaExamConfigModal cho BTVN & Đề KT
  const [internalUploadModal, setInternalUploadModal] = useState<{
    lessonId: string;
    lessonTitle: string;
    type: "homework_files" | "test_quizzes";
  } | null>(null);

  const [activeTestFile, setActiveTestFile] = useState<File | null>(null);
  const [activeUploadTarget, setActiveUploadTarget] = useState<{
    lessonId: string;
    type: "homework_files" | "test_quizzes";
  } | null>(null);

  // Modal dán link Google Drive thủ công cho BTVN / Đề kiểm tra
  const [driveModal, setDriveModal] = useState<{
    lessonId: string;
    type: "homework_files" | "test_quizzes";
  } | null>(null);
  const [driveTitle, setDriveTitle] = useState("");
  const [driveUrl, setDriveUrl] = useState("");

  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const docxInputRef = useRef<HTMLInputElement | null>(null);

  // HÀM LƯU TỔNG VÀO STATE CHA, SUPABASE VÀ LOCALSTORAGE
  const persistChaptersData = async (updatedChapters: any[]) => {
    // 1. Cập nhật state cha React tức thì để cell nhảy số tự động
    if (typeof setChapters === "function") {
      try {
        (setChapters as any)(updatedChapters);
      } catch (err) {
        console.error("Lỗi khi gọi setChapters:", err);
      }
    }

    if (typeof onUpdateChapters === "function") {
      try {
        onUpdateChapters(updatedChapters);
      } catch (err) {
        console.error("Lỗi khi gọi onUpdateChapters:", err);
      }
    }

    // 2. Gọi hàm lưu storage từ cha nếu có
    if (saveToStorage) {
      await saveToStorage(updatedChapters);
      return;
    }

    // 3. Đồng bộ xuống LocalStorage của trình duyệt
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_course_data", JSON.stringify(updatedChapters));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {}
    }

    // 4. Lưu trực tiếp vào database Supabase bảng courses
    try {
      const { data: existingRows } = await supabase.from("courses").select("id").limit(1);
      if (existingRows && existingRows.length > 0) {
        await supabase
          .from("courses")
          .update({ chapters: updatedChapters, updated_at: new Date().toISOString() })
          .eq("id", existingRows[0].id);
      } else {
        await supabase
          .from("courses")
          .insert([{ title: "Toán 12 TCT", chapters: updatedChapters, updated_at: new Date().toISOString() }]);
      }
    } catch (err) {
      console.error("Lỗi khi lưu Supabase từ LessonsTab:", err);
    }
  };

  // MỞ MENU CHỌN NẠP ĐỀ (WORD / PDF / DRIVE)
  const handleOpenUploadPicker = (lesson: any, type: "homework_files" | "test_quizzes") => {
    setInternalUploadModal({
      lessonId: lesson.id,
      lessonTitle: lesson.title || "Bài học",
      type: type
    });
  };

  // XỬ LÝ CHỌN FILE TỪ MÁY TÍNH
  const handleSelectFile = (file: File) => {
    if (!internalUploadModal) return;
    setActiveUploadTarget({
      lessonId: internalUploadModal.lessonId,
      type: internalUploadModal.type
    });
    setActiveTestFile(file);
    setInternalUploadModal(null);
  };

  // CALLBACK KHI AZOTA EXAM CONFIG MODAL BÓC TÁCH XONG VÀ BẤM LƯU & XUẤT BẢN
  const handleSaveExamFromAzota = async (payload: any) => {
    console.log("[LessonsTab] Nhận payload từ AzotaExamConfigModal:", payload);

    if (!activeUploadTarget) {
      console.error("[LessonsTab] Thiếu thông tin bài học mục tiêu.");
      setActiveTestFile(null);
      return;
    }

    const { lessonId, type } = activeUploadTarget;
    const isHw = type === "homework_files";

    const examData = payload?.examData || payload?.data || payload;
    const sections = payload?.sections || examData?.sections || payload?.data || [];
    const mediaMap = payload?.mediaMap || payload?.media_map || examData?.mediaMap || examData?.media_map || {};
    const title = payload?.title || examData?.title || activeTestFile?.name?.replace(/\.[^/.]+$/, "") || (isHw ? "Bài tập về nhà" : "Đề kiểm tra định kỳ");
    const duration = payload?.duration_minutes || examData?.duration_minutes || (isHw ? 0 : 45);

    const newQuizItem = {
      id: payload?.id || examData?.id || ("quiz-" + Date.now()),
      title: title,
      duration_minutes: duration,
      is_quiz: true,
      isHomework: isHw,
      data: sections,
      media_map: mediaMap,
      created_at: new Date().toISOString()
    };

    const updatedChapters = (chapters || []).map((chap: any) => ({
      ...chap,
      lessons: (chap.lessons || []).map((les: any) => {
        if (les.id !== lessonId) return les;
        return {
          ...les,
          [type]: [...(les[type] || []), newQuizItem]
        };
      })
    }));

    await persistChaptersData(updatedChapters);

    // Giải phóng state modal
    setActiveTestFile(null);
    setActiveUploadTarget(null);

    alert(`✅ Đã nạp thành công "${title}" vào bài học! Ô số đếm đã được cập nhật.`);
  };

  // LƯU LINK DRIVE THỦ CÔNG
  const handleSaveDriveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveModal || !driveTitle.trim() || !driveUrl.trim()) return;

    const { lessonId, type } = driveModal;
    const newItem = {
      id: "drive-" + Date.now(),
      title: driveTitle.trim(),
      url: driveUrl.trim(),
      is_quiz: false,
      is_drive_file: true
    };

    const updatedChapters = (chapters || []).map((chap: any) => ({
      ...chap,
      lessons: (chap.lessons || []).map((les: any) => {
        if (les.id !== lessonId) return les;
        return {
          ...les,
          [type]: [...(les[type] || []), newItem]
        };
      })
    }));

    await persistChaptersData(updatedChapters);
    setDriveModal(null);
    setDriveTitle("");
    setDriveUrl("");

    alert(`✅ Đã đính kèm file Drive "${newItem.title}" thành công!`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 text-left">
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

      {/* 1. THANH ĐIỀU HƯỚNG BỘ LỌC PHÂN LUỒNG & NÚT TẠO MỚI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-white/90 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setLessonModeTab("all")}
            className={
              "flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer " +
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
              "flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer " +
              (lessonModeTab === "offline"
                ? "bg-white text-emerald-700 shadow-sm border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900")
            }
          >
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <span>Bài học Offline ({offlineLessonCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setLessonModeTab("online")}
            className={
              "flex items-center gap-2 px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer " +
              (lessonModeTab === "online"
                ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                : "text-slate-600 hover:text-slate-900")
            }
          >
            <Video className="w-4 h-4 text-indigo-600" />
            <span>Bài học Online ({onlineLessonCount})</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
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

      {/* 2. BẢNG MATRIX NỘI DUNG BÀI HỌC CHUẨN NỀN XANH #1D4ED8 (ĐẦY ĐỦ 12 CỘT) */}
      <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[1100px] text-left border-collapse">
            <thead className="bg-[#1D4ED8] text-white text-[11px] font-black uppercase tracking-wider">
              <tr>
                <th className="py-4 px-4 text-center w-12 border-r border-blue-400/30">STT</th>
                <th className="py-4 px-5 border-r border-blue-400/30 min-w-[250px]">Nội dung bài học</th>
                <th className="py-4 px-4 border-r border-blue-400/30 text-center">Chương</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-24">Phân luồng</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-20">Hình thức</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-20">Video</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-20">Bài giảng</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-20">Viết tay</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-20">BTVN</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-20">Đề KT</th>
                <th className="py-4 px-3 border-r border-blue-400/30 text-center w-24">Tăng cường</th>
                <th className="py-4 px-4 text-center w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {flattenedLessons.map((les: any, idx: number) => {
                const lesTitle = les?.title || "Bài học";
                const isReview = lesTitle.toLowerCase().includes("ôn tập") || lesTitle.toLowerCase().includes("bài tập");
                return (
                  <tr key={les?.id || idx} className="hover:bg-slate-50/50 transition-colors bg-white">
                    <td className="py-4 px-4 text-center text-slate-500 font-bold text-xs border-r border-slate-100">{idx + 1}</td>
                    <td className="py-4 px-5 border-r border-slate-100">
                      {isReview && (
                        <span className="inline-block px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold uppercase rounded border border-amber-200 mb-1">
                          Ôn tập
                        </span>
                      )}
                      <h4 className="font-bold text-[#1D4ED8] text-[13px] uppercase leading-snug">{lesTitle}</h4>
                    </td>
                    <td className="py-4 px-4 text-center border-r border-slate-100 text-[11px] text-slate-500 font-semibold uppercase">
                      {les.chapterTitle}
                    </td>
                    <td className="py-4 px-3 text-center border-r border-slate-100">
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
                    <td className="py-4 px-3 text-center border-r border-slate-100 text-xs font-bold text-slate-600">
                      {les.format || "Zoom"}
                    </td>

                    {/* CỘT VIDEO */}
                    <td className="py-4 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.video_list} 
                        label="Video" 
                        onAdd={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "video_list" })} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "video_list", title: "Video", items: les.video_list })} 
                      />
                    </td>

                    {/* CỘT BÀI GIẢNG */}
                    <td className="py-4 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.lecture_files} 
                        label="Bài giảng" 
                        onAdd={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "lecture_files" })} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "lecture_files", title: "Bài giảng", items: les.lecture_files })} 
                      />
                    </td>

                    {/* CỘT VIẾT TAY */}
                    <td className="py-4 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.handwritten_notes} 
                        label="Viết tay" 
                        onAdd={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "handwritten_notes" })} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "handwritten_notes", title: "Viết tay", items: les.handwritten_notes })} 
                      />
                    </td>

                    {/* CỘT BTVN - BẬT MENU NẠP ĐỀ NỘI BỘ VÀ TỰ ĐỘNG TĂNG SỐ */}
                    <td className="py-4 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.homework_files} 
                        label="BTVN" 
                        onAdd={() => handleOpenUploadPicker(les, "homework_files")} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "homework_files", title: "BTVN", items: les.homework_files })} 
                      />
                    </td>

                    {/* CỘT ĐỀ KT - BẬT MENU NẠP ĐỀ NỘI BỘ VÀ TỰ ĐỘNG TĂNG SỐ */}
                    <td className="py-4 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.test_quizzes} 
                        label="Đề KT" 
                        onAdd={() => handleOpenUploadPicker(les, "test_quizzes")} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "test_quizzes", title: "Đề kiểm tra", items: les.test_quizzes })} 
                      />
                    </td>

                    {/* CỘT TĂNG CƯỜNG */}
                    <td className="py-4 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.extra_resources} 
                        label="Tăng cường" 
                        onAdd={() => setBoostModal(les.id)} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "extra_resources", title: "Tăng cường", items: les.extra_resources })} 
                      />
                    </td>

                    {/* THAO TÁC */}
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-2">
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
                              target_mode: les.target_mode || "all" 
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

      {/* 3. MODAL CHỌN PHƯƠNG THỨC NẠP ĐỀ THI (PDF / DOCX / DRIVE LINK) */}
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
            
            <div className="flex flex-col gap-3 mt-4">
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
                    AI Gemini Vision sẽ quét trang PDF, khôi phục 100% MathType, phân số, căn thức và toạ độ Oxyz mà không bị trượt byte.
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
                    Trích xuất trực tiếp câu hỏi, bảng đáp án, lời giải và thẻ ảnh đồ thị từ file Word gốc.
                  </div>
                </div>
              </div>
              
              {/* ĐÍNH KÈM LINK GOOGLE DRIVE */}
              <button 
                type="button"
                onClick={() => { 
                  setDriveModal({ lessonId: internalUploadModal.lessonId, type: internalUploadModal.type }); 
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
                    Dán link file PDF/Word để học sinh tải về hoặc tự làm thủ công (không chấm tự động).
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

      {/* 5. GỌI TRỰC TIẾP AZOTA EXAM CONFIG MODAL & NẠP SỐ LIỆU TỨC THÌ */}
      {activeTestFile && (
        <AzotaExamConfigModal 
          isOpen={true} 
          file={activeTestFile}
          mode="course" 
          onClose={() => {
            setActiveTestFile(null);
            setActiveUploadTarget(null);
          }} 
          onSave={handleSaveExamFromAzota}
          onSaveExam={handleSaveExamFromAzota}
          onSuccess={handleSaveExamFromAzota}
          onComplete={handleSaveExamFromAzota}
        />
      )}
    </div>
  );
}
