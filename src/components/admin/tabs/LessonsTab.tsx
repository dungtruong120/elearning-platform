"use client";

import React from "react";
import { 
  Layers, BookOpen, Video, FolderPlus, Plus, Edit3, Trash2 
} from "lucide-react";

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
  if (items && items.length > 0) {
    return (
      <button 
        type="button"
        onClick={onView} 
        title={"Xem danh sách (" + items.length + ")"} 
        className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-[#1D4ED8] text-[#1D4ED8] bg-blue-50 font-black text-xs hover:bg-[#1D4ED8] hover:text-white transition-all mx-auto cursor-pointer shadow-sm"
      >
        {items.length}
      </button>
    );
  }
  return (
    <button 
      type="button"
      onClick={onAdd} 
      title={"Thêm " + label} 
      className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-[#1D4ED8] hover:text-[#1D4ED8] hover:bg-blue-50 transition-all mx-auto cursor-pointer"
    >
      <Plus className="w-3.5 h-3.5" />
    </button>
  );
};

interface LessonsTabProps {
  chapters: any[];
  lessonModeTab: "all" | "offline" | "online";
  setLessonModeTab: (tab: "all" | "offline" | "online") => void;
  offlineLessonCount: number;
  onlineLessonCount: number;
  flattenedLessons: any[];
  setCreateModal: (modal: { type: "chapter" | "lesson"; chapterId?: string } | null) => void;
  setResourceModal: (modal: any) => void;
  setViewResourcesModal: (modal: any) => void;
  setUploadMethodModal: (modal: { lessonId: string; type: "homework_files" | "test_quizzes" } | null) => void;
  setBoostModal: (lessonId: string | null) => void;
  setEditLessonModal: (modal: { chapterId: string; lesson: any } | null) => void;
  setEditLessonForm: (form: any) => void;
  handleDeleteLesson: (chapterId: string, lessonId: string) => Promise<void>;
}

export default function LessonsTab({
  chapters,
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
  handleDeleteLesson
}: LessonsTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
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
            onClick={() => setCreateModal({ type: "chapter" })} 
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl shadow-sm transition cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-[#1D4ED8]" /> Thêm Chương
          </button>
          <button 
            type="button"
            onClick={() => {
              if (!chapters || chapters.length === 0) return alert("Vui lòng thêm Chương trước!");
              setCreateModal({ type: "lesson", chapterId: chapters[0].id });
            }} 
            className="flex items-center gap-2 px-5 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold rounded-2xl shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Thêm Bài học mới
          </button>
        </div>
      </div>

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
                    <td className="py-4 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.video_list} 
                        label="Video" 
                        onAdd={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "video_list" })} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "video_list", title: "Video", items: les.video_list })} 
                      />
                    </td>
                    <td className="py-4 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.lecture_files} 
                        label="Bài giảng" 
                        onAdd={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "lecture_files" })} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "lecture_files", title: "Bài giảng", items: les.lecture_files })} 
                      />
                    </td>
                    <td className="py-4 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.handwritten_notes} 
                        label="Viết tay" 
                        onAdd={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "handwritten_notes" })} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "handwritten_notes", title: "Viết tay", items: les.handwritten_notes })} 
                      />
                    </td>
                    <td className="py-4 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.homework_files} 
                        label="BTVN" 
                        onAdd={() => setUploadMethodModal({ lessonId: les.id, type: "homework_files" })} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "homework_files", title: "BTVN", items: les.homework_files })} 
                      />
                    </td>
                    <td className="py-4 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.test_quizzes} 
                        label="Đề KT" 
                        onAdd={() => setUploadMethodModal({ lessonId: les.id, type: "test_quizzes" })} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "test_quizzes", title: "Đề kiểm tra", items: les.test_quizzes })} 
                      />
                    </td>
                    <td className="py-4 px-3 border-r border-slate-100">
                      <MatrixCell 
                        items={les.extra_resources} 
                        label="Tăng cường" 
                        onAdd={() => setBoostModal(les.id)} 
                        onView={() => setViewResourcesModal({ lessonId: les.id, type: "extra_resources", title: "Tăng cường", items: les.extra_resources })} 
                      />
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          type="button"
                          onClick={() => { 
                            setEditLessonModal({ chapterId: les.chapterId, lesson: les }); 
                            setEditLessonForm({ 
                              title: les.title, 
                              description: les.description || "", 
                              duration: 45, 
                              format: "Zoom", 
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
                          onClick={() => handleDeleteLesson(les.chapterId, les.id)} 
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
    </div>
  );
}
