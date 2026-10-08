"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Edit3, UserCheck, FileText, FileUp, Link as LinkIcon, 
  Zap, Video 
} from "lucide-react";
import dynamic from "next/dynamic";
import { STANDARD_SHIFTS } from "@/types";

const AzotaExamConfigModal = dynamic(
  () => import("@/app/admin/AzotaExamConfigModal").then((mod: any) => mod.AzotaExamConfigModal || mod.default || mod),
  { ssr: false }
);

const ExamRoomView = dynamic(
  () => import("@/components/student/ExamRoomView").then((mod: any) => mod.ExamRoomView || mod.default || mod),
  { ssr: false }
);

interface AdminModalsProps {
  azotaScoreViewModal: any;
  setAzotaScoreViewModal: (m: any) => void;
  supabase: any;
  showToast: (msg: string) => void;
  isAddStudentModalOpen: boolean;
  setIsAddStudentModalOpen: (open: boolean) => void;
  quickStudentForm: any;
  setQuickStudentForm: (f: any) => void;
  handleAddQuickStudentSubmit: (e: React.FormEvent) => Promise<void>;
  viewResourcesModal: any;
  setViewResourcesModal: (m: any) => void;
  setEditResourceModal: (m: any) => void;
  setEditResourceForm: (f: any) => void;
  handleDeleteResource: (lessonId: string, type: string, id: string) => Promise<void>;
  setUploadMethodModal: (m: any) => void;
  setBoostModal: (id: string | null) => void;
  setResourceModal: (m: any) => void;
  editResourceModal: any;
  editResourceForm: any;
  handleEditResourceSubmit: (e: React.FormEvent) => Promise<void>;
  createModal: any;
  setCreateModal: (m: any) => void;
  chapters: any[];
  newItemTitle: string;
  setNewItemTitle: (t: string) => void;
  newItemTargetMode: "online" | "offline" | "all";
  setNewItemTargetMode: (m: "online" | "offline" | "all") => void;
  newItemFormat: string;
  setNewItemFormat: (f: string) => void;
  newItemDescription: string;
  setNewItemDescription: (d: string) => void;
  handleCreateNewItem: (e: React.FormEvent) => Promise<void>;
  testFile: File | null;
  editingExamData: any;
  uploadMode: "course" | "practice";
  setTestFile: (f: File | null) => void;
  setEditingExamData: (d: any) => void;
  onSaveAzotaExam: (examData: any) => Promise<void>;
  uploadMethodModal: any;
  setDriveLinkModal: (m: any) => void;
  setAzotaTarget: (t: any) => void;
  setUploadMode: (m: "course" | "practice") => void;
  driveLinkModal: any;
  driveLinkForm: any;
  setDriveLinkForm: (f: any) => void;
  handleAddDriveFile: (e: React.FormEvent) => Promise<void>;
  resourceModal: any;
  resTitle: string;
  setResTitle: (t: string) => void;
  vidType: "lecture" | "homework_solution";
  setVidType: (t: "lecture" | "homework_solution") => void;
  resUrl: string;
  setResUrl: (u: string) => void;
  handleAddResource: (e: React.FormEvent) => Promise<void>;
  editLessonModal: any;
  setEditLessonModal: (m: any) => void;
  editLessonForm: any;
  setEditLessonForm: (f: any) => void;
  handleEditLessonSubmit: (e: React.FormEvent) => Promise<void>;
  isAddDateModalOpen: boolean;
  setIsAddDateModalOpen: (open: boolean) => void;
  handleAddNewAttendanceDate: (e: React.FormEvent) => Promise<void>;
  newDateInput: string;
  setNewDateInput: (d: string) => void;
  newDateShift: string;
  setNewDateShift: (s: string) => void;
  newDateTimeSlot: string;
  setNewDateTimeSlot: (t: string) => void;
  newDateAudience: "online" | "offline" | "all";
  setNewDateAudience: (a: "online" | "offline" | "all") => void;
  newDateTitle: string;
  setNewDateTitle: (t: string) => void;
  boostModal: string | null;
  boostForm: any;
  setBoostForm: (f: any) => void;
  handleAddBoost: (e: React.FormEvent) => Promise<void>;
  videoModalExam: any;
  setVideoModalExam: (e: any) => void;
  solutionVideoInput: string;
  setSolutionVideoInput: (v: string) => void;
  handleSaveSolutionVideo: (e: React.FormEvent) => Promise<void>;
  testExamRoom: any;
  setTestExamRoom: (r: any) => void;
}

export default function AdminModals({
  azotaScoreViewModal,
  setAzotaScoreViewModal,
  supabase,
  showToast,
  isAddStudentModalOpen,
  setIsAddStudentModalOpen,
  quickStudentForm,
  setQuickStudentForm,
  handleAddQuickStudentSubmit,
  viewResourcesModal,
  setViewResourcesModal,
  setEditResourceModal,
  setEditResourceForm,
  handleDeleteResource,
  setUploadMethodModal,
  setBoostModal,
  setResourceModal,
  editResourceModal,
  editResourceForm,
  handleEditResourceSubmit,
  createModal,
  setCreateModal,
  chapters,
  newItemTitle,
  setNewItemTitle,
  newItemTargetMode,
  setNewItemTargetMode,
  newItemFormat,
  setNewItemFormat,
  newItemDescription,
  setNewItemDescription,
  handleCreateNewItem,
  testFile,
  editingExamData,
  uploadMode,
  setTestFile,
  setEditingExamData,
  onSaveAzotaExam,
  uploadMethodModal,
  setDriveLinkModal,
  setAzotaTarget,
  setUploadMode,
  driveLinkModal,
  driveLinkForm,
  setDriveLinkForm,
  handleAddDriveFile,
  resourceModal,
  resTitle,
  setResTitle,
  vidType,
  setVidType,
  resUrl,
  setResUrl,
  handleAddResource,
  editLessonModal,
  setEditLessonModal,
  editLessonForm,
  setEditLessonForm,
  handleEditLessonSubmit,
  isAddDateModalOpen,
  setIsAddDateModalOpen,
  handleAddNewAttendanceDate,
  newDateInput,
  setNewDateInput,
  newDateShift,
  setNewDateShift,
  newDateTimeSlot,
  setNewDateTimeSlot,
  newDateAudience,
  setNewDateAudience,
  newDateTitle,
  setNewDateTitle,
  boostModal,
  boostForm,
  setBoostForm,
  handleAddBoost,
  videoModalExam,
  setVideoModalExam,
  solutionVideoInput,
  setSolutionVideoInput,
  handleSaveSolutionVideo,
  testExamRoom,
  setTestExamRoom
}: AdminModalsProps) {
  return (
    <>
      {/* 1. AZOTA SCORE VIEW MODAL */}
      <AnimatePresence>
        {azotaScoreViewModal.isOpen && (
          <div className="fixed inset-0 z-[800] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
                <div>
                  <span className="px-3 py-1 bg-blue-100 text-[#1D4ED8] rounded-full text-xs font-black uppercase tracking-wider">
                    Giao diện Chấm thi & Quản lý Điểm Azota
                  </span>
                  <h3 className="font-black text-slate-900 text-lg mt-1.5 flex items-center gap-2">
                    {azotaScoreViewModal.examTitle}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAzotaScoreViewModal({ isOpen: false, examTitle: "", attempts: [] })}
                  className="p-2 text-slate-400 hover:text-rose-500 rounded-xl hover:bg-rose-50 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/40">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-slate-500">
                    Danh sách lượt nộp bài ({azotaScoreViewModal.attempts.length} lượt)
                  </span>
                  <span className="text-[11px] text-slate-400 italic">
                    * Click vào biểu tượng cây bút để sửa nhận xét học sinh
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {azotaScoreViewModal.attempts.map((att: any, idx: number) => {
                    const fullName = att.studentName || att.full_name || "Học sinh";
                    const words = fullName.trim().split(/\s+/);
                    const initials = words.length > 1 
                      ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
                      : fullName.slice(0, 2).toUpperCase();

                    const scoreNum = Number(att.score ?? 0);
                    const isPassed = scoreNum >= 5;

                    return (
                      <div
                        key={att.id || idx}
                        className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:shadow-md transition flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-11 h-11 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-black text-sm shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-extrabold text-slate-900 text-[14px] truncate leading-tight">
                                {fullName}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={"text-xs font-black " + (isPassed ? "text-emerald-700" : "text-rose-600")}>
                                  Điểm: {scoreNum.toFixed(2)}
                                </span>
                                <span className="text-[11px] text-slate-400 font-semibold">
                                  (Lần thi: {att.attemptNumber || 1})
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5 text-xs text-slate-500 pt-2 border-t border-slate-100">
                            <div className="flex justify-between items-center">
                              <span>Thời gian làm bài:</span>
                              <span className="font-bold text-slate-700">{att.timeSpent || "15 phút"}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Thời gian nộp bài:</span>
                              <span className="font-bold text-slate-700">
                                {new Date(att.createdAt || Date.now()).toLocaleDateString("vi-VN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric"
                                })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-500 italic truncate max-w-[170px]">
                            {att.feedback ? ("“" + att.feedback + "”") : "Chưa có nhận xét"}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              const newCmt = prompt("Nhập nhận xét / lời khen cho học sinh:", att.feedback || "");
                              if (newCmt !== null) {
                                att.feedback = newCmt;
                                try {
                                  await supabase.from("exam_attempts").update({ feedback: newCmt }).eq("id", att.id);
                                } catch {}
                                showToast("Đã lưu nhận xét học sinh!");
                              }
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Thêm/sửa nhận xét"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {azotaScoreViewModal.attempts.length === 0 && (
                    <div className="col-span-full py-16 text-center text-slate-400 font-medium">
                      Chưa có lượt nộp bài nào của học sinh cho đề thi này.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. ADD STUDENT MODAL */}
      <AnimatePresence>
        {isAddStudentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-[#1D4ED8]" />
                  Thêm Học Sinh Vào Bảng Điểm Danh
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddQuickStudentSubmit} className="space-y-4 text-left">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Họ đệm</label>
                    <input
                      type="text"
                      value={quickStudentForm.lastName}
                      onChange={e => setQuickStudentForm({ ...quickStudentForm, lastName: e.target.value })}
                      placeholder="VD: Trương Ngọc"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Tên *</label>
                    <input
                      required
                      type="text"
                      value={quickStudentForm.firstName}
                      onChange={e => setQuickStudentForm({ ...quickStudentForm, firstName: e.target.value })}
                      placeholder="VD: Dũng"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-blue-700 outline-none focus:border-blue-600 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái tham gia</label>
                  <select
                    value={quickStudentForm.status}
                    onChange={e => setQuickStudentForm({ ...quickStudentForm, status: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="approved">Học (Đang theo học)</option>
                    <option value="rejected">Nghỉ (Đã tạm nghỉ)</option>
                  </select>
                </div>

                <div className="p-3 bg-blue-50/60 rounded-xl text-[11px] text-blue-700">
                  Học sinh được thêm sẽ lưu trực tiếp vào cơ sở dữ liệu Supabase và xuất hiện ngay lập tức trên Bảng điểm danh.
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddStudentModalOpen(false)}
                    className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    Thêm ngay
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. VIEW RESOURCES MODAL */}
      {viewResourcesModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2">
                Danh sách {viewResourcesModal.title} ({(viewResourcesModal.items || []).length})
              </h3>
              <button 
                type="button"
                onClick={() => setViewResourcesModal(null)} 
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5"/>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
              {(!viewResourcesModal.items || viewResourcesModal.items.length === 0) ? (
                <p className="text-center text-slate-400 text-sm py-4">Chưa có tài nguyên nào.</p>
              ) : (
                viewResourcesModal.items.map((item: any) => (
                  <div key={item.id} className="flex flex-col gap-2 p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-[#1D4ED8]/50 transition-colors group">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold text-slate-800 text-[13px] truncate">{item.title}</h4>
                          {viewResourcesModal.type === "video_list" && (
                            <span className={
                              "px-2 py-0.5 text-[9px] font-black uppercase rounded-md tracking-wider " + 
                              (item.type === "homework_solution"
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-blue-100 text-blue-800 border border-blue-300")
                            }>
                              {item.type === "homework_solution" ? "Chữa BTVN" : "Bài Giảng"}
                            </span>
                          )}
                          {item.is_drive_file && <span className="px-2 py-0.5 text-[9px] bg-indigo-100 text-indigo-700 font-bold uppercase rounded-md shrink-0">Drive</span>}
                          {viewResourcesModal.type === 'extra_resources' && <span className="px-2 py-0.5 text-[9px] bg-amber-100 text-amber-700 font-bold uppercase rounded-md shrink-0">Tăng cường</span>}
                        </div>
                        {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:underline truncate block mt-1">{item.url}</a>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          type="button"
                          onClick={() => {
                            setEditResourceModal({ lessonId: viewResourcesModal.lessonId, type: viewResourcesModal.type, item });
                            setEditResourceForm({ title: item.title, url: item.url || "", type: item.type || "lecture" });
                          }} 
                          className="p-2 text-slate-300 hover:text-[#1D4ED8] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteResource(viewResourcesModal.lessonId, viewResourcesModal.type, item.id)} 
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <button 
                type="button"
                onClick={() => {
                  setViewResourcesModal(null);
                  if (viewResourcesModal.type === 'homework_files' || viewResourcesModal.type === 'test_quizzes') {
                    setUploadMethodModal({ lessonId: viewResourcesModal.lessonId, type: viewResourcesModal.type as any });
                  } else if (viewResourcesModal.type === 'extra_resources') {
                    setBoostModal(viewResourcesModal.lessonId);
                  } else {
                    setResourceModal({ isOpen: true, lessonId: viewResourcesModal.lessonId, lessonTitle: "bài học", type: viewResourcesModal.type });
                  }
                }}
                className="w-full py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-[13px] font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Thêm tài liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. EDIT RESOURCE MODAL */}
      {editResourceModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleEditResourceSubmit} className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#1D4ED8]" /> Sửa thông tin tài liệu
              </h3>
              <button type="button" onClick={() => setEditResourceModal(null)} className="text-slate-400 hover:text-rose-500"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tiêu đề tài liệu</label>
                <input required type="text" value={editResourceForm.title} onChange={e => setEditResourceForm({...editResourceForm, title: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none" />
              </div>
              
              {editResourceModal.type === "video_list" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Phân loại Video *</label>
                  <select
                    value={editResourceForm.type}
                    onChange={e => setEditResourceForm({ ...editResourceForm, type: e.target.value as any })}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-bold text-slate-800 outline-none focus:border-[#1D4ED8] bg-white cursor-pointer"
                  >
                    <option value="lecture">Video Bài Giảng (Lý thuyết)</option>
                    <option value="homework_solution">Video Chữa BTVN (Chi tiết)</option>
                  </select>
                </div>
              )}

              {(!editResourceModal.item.is_quiz || editResourceModal.item.is_drive_file) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Đường dẫn (URL / Link Drive / YouTube)</label>
                  <input required type="url" value={editResourceForm.url} onChange={e => setEditResourceForm({...editResourceForm, url: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none" />
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end pt-5 mt-5 border-t border-slate-100">
              <button type="button" onClick={() => setEditResourceModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">Hủy</button>
              <button type="submit" className="px-5 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold rounded-xl text-xs shadow-sm">Lưu thay đổi</button>
            </div>
          </form>
        </div>
      )}

      {/* 5. CREATE ITEM (CHAPTER/LESSON) MODAL */}
      {createModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-xl">
          <form onSubmit={handleCreateNewItem} className="bg-white/90 backdrop-blur-2xl rounded-[32px] w-full max-w-md p-8 shadow-2xl border border-white/50 space-y-5">
            <h3 className="font-extrabold text-slate-900 text-[17px] border-b border-slate-200/60 pb-4 mb-5 tracking-tight">
              {createModal.type === "chapter" ? "Thêm Chương Mới" : "Thêm Bài Học Mới"}
            </h3>
            
            {createModal.type === "lesson" && (
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-2">Chọn chương chứa bài học <span className="text-rose-500">*</span></label>
                <select 
                  value={createModal.chapterId || ""} 
                  onChange={e => setCreateModal({ ...createModal, chapterId: e.target.value })}
                  className="w-full px-5 py-3 border border-slate-300 rounded-2xl text-[13px] font-semibold outline-none focus:border-[#1D4ED8] transition-all shadow-sm bg-white cursor-pointer"
                >
                  {(chapters || []).map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[13px] font-bold text-slate-700 mb-2">Tên {createModal.type === "chapter" ? "chương" : "bài học"} <span className="text-rose-500">*</span></label>
              <input autoFocus required type="text" value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} placeholder={createModal.type === "chapter" ? "VD: Chương 1..." : "VD: Bài 1..."} className="w-full px-5 py-3 border border-slate-300 rounded-2xl text-[13px] font-semibold outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-all shadow-sm" />
            </div>
            
            {createModal.type === "lesson" && (
              <>
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-2">Phân luồng bài học (Target Mode) *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewItemTargetMode("online")}
                      className={
                        "py-2.5 px-3 rounded-xl text-xs font-black border transition " + 
                        (newItemTargetMode === "online"
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100")
                      }
                    >
                      Lớp Online
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewItemTargetMode("offline")}
                      className={
                        "py-2.5 px-3 rounded-xl text-xs font-black border transition " + 
                        (newItemTargetMode === "offline"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100")
                      }
                    >
                      Lớp Offline
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewItemTargetMode("all")}
                      className={
                        "py-2.5 px-3 rounded-xl text-xs font-black border transition " + 
                        (newItemTargetMode === "all"
                          ? "bg-blue-50 border-blue-500 text-[#1D4ED8] ring-2 ring-blue-500/20 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100")
                      }
                    >
                      Cả 2 (Full)
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-2">Hình thức giảng dạy</label>
                  <select value={newItemFormat} onChange={e => setNewItemFormat(e.target.value)} className="w-full px-5 py-3 border border-slate-300 rounded-2xl text-[13px] outline-none focus:border-[#1D4ED8] transition-all shadow-sm bg-white">
                    <option value="Zoom">Zoom / Google Meet</option>
                    <option value="Video">Video quay sẵn</option>
                    <option value="Facebook">Facebook Group</option>
                    <option value="Tự học">Tự học</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-2">Mô tả bài học</label>
                  <textarea rows={3} value={newItemDescription} onChange={e => setNewItemDescription(e.target.value)} placeholder="Nội dung hướng dẫn học..." className="w-full px-5 py-3 border border-slate-300 rounded-2xl text-[13px] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-all shadow-sm resize-none" />
                </div>
              </>
            )}
            <div className="flex gap-3 justify-end pt-4">
              <button type="button" onClick={() => setCreateModal(null)} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-[13px] font-bold text-slate-700 transition-colors cursor-pointer">Hủy</button>
              <button type="submit" className="px-6 py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-2xl text-[13px] font-bold shadow-md transition-colors cursor-pointer">Thêm mới</button>
            </div>
          </form>
        </div>
      )}

      {/* 6. AZOTA EXAM CONFIG MODAL */}
      {testFile && (
        <AzotaExamConfigModal 
          isOpen={true} 
          file={testFile}
          initialData={editingExamData ? {
            title: editingExamData.title,
            category: editingExamData.category,
            duration_minutes: editingExamData.duration_minutes,
            sections: editingExamData.data,
            mediaMap: editingExamData.media_map
          } : undefined}
          mode={uploadMode} 
          onClose={() => { setTestFile(null); setEditingExamData(null); }} 
          onSave={onSaveAzotaExam}
        />
      )}

      {/* 7. UPLOAD METHOD MODAL */}
      {uploadMethodModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[28px] p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  Thêm {uploadMethodModal.type === 'homework_files' ? 'Bài tập về nhà (BTVN)' : 'Đề Kiểm Tra'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Chọn phương thức nạp đề thi để hệ thống tự động bóc tách</p>
              </div>
              <button type="button" onClick={() => setUploadMethodModal(null)} className="text-slate-400 hover:text-rose-500 cursor-pointer p-1"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex flex-col gap-3 mt-4">
              <label className="relative p-4 border-2 border-indigo-200 bg-indigo-50/50 rounded-2xl hover:bg-indigo-100/60 transition cursor-pointer flex items-start gap-4 group shadow-2xs">
                <div className="p-3 bg-white text-indigo-600 rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-indigo-950 text-[14px]">Tải lên file PDF (.pdf)</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-black text-[9px] uppercase tracking-wider">Khuyên Dùng</span>
                  </div>
                  <div className="text-xs text-indigo-800/80 mt-1 leading-relaxed">
                    AI Gemini Vision sẽ quét trang PDF trực tiếp, khôi phục 100% MathType, phân số, căn thức và toạ độ Oxyz mà không bị trượt byte.
                  </div>
                </div>
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setTestFile(e.target.files[0]);
                    setUploadMode("course");
                    setAzotaTarget({ lessonId: uploadMethodModal.lessonId, type: uploadMethodModal.type });
                    setUploadMethodModal(null);
                  }
                  e.target.value = '';
                }}/>
              </label>

              <label className="relative p-4 border border-blue-200 bg-blue-50/40 rounded-2xl hover:bg-blue-100/50 transition cursor-pointer flex items-start gap-4 group shadow-2xs">
                <div className="p-3 bg-white text-blue-600 rounded-xl shadow-xs group-hover:scale-105 transition-transform">
                  <FileUp className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="font-extrabold text-blue-950 text-[14px]">Tải lên file Word (.docx)</div>
                  <div className="text-xs text-blue-800/80 mt-1 leading-relaxed">
                    Hệ thống sẽ trích xuất nhanh cấu trúc văn bản và thẻ ảnh đồ thị từ file Word gốc.
                  </div>
                </div>
                <input type="file" accept=".docx" className="hidden" onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setTestFile(e.target.files[0]);
                    setUploadMode("course");
                    setAzotaTarget({ lessonId: uploadMethodModal.lessonId, type: uploadMethodModal.type });
                    setUploadMethodModal(null);
                  }
                  e.target.value = '';
                }}/>
              </label>
              
              <button 
                type="button"
                onClick={() => { setDriveLinkModal(uploadMethodModal); setUploadMethodModal(null); }} 
                className="p-4 border border-emerald-200 bg-emerald-50/40 rounded-2xl hover:bg-emerald-100/50 transition cursor-pointer flex items-start gap-4 text-left group shadow-2xs"
              >
                <div className="p-3 bg-white text-emerald-600 rounded-xl shadow-xs group-hover:scale-105 transition-transform">
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

      {/* 8. DRIVE LINK MODAL */}
      {driveLinkModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <form onSubmit={handleAddDriveFile} className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-emerald-700 text-[15px] flex items-center gap-2"><LinkIcon className="w-5 h-5" /> Đính kèm Link Google Drive</h3>
              <button type="button" onClick={() => setDriveLinkModal(null)} className="text-slate-400 hover:text-rose-500"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tiêu đề (VD: File đề luyện tập 1)</label>
                <input required type="text" value={driveLinkForm.title} onChange={e => setDriveLinkForm({...driveLinkForm, title: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-emerald-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Link Google Drive (Chia sẻ công khai)</label>
                <input required type="url" placeholder="https://drive.google.com/..." value={driveLinkForm.url} onChange={e => setDriveLinkForm({...driveLinkForm, url: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-emerald-500 outline-none" />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-5 mt-5 border-t border-slate-100">
              <button type="button" onClick={() => setDriveLinkModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">Hủy</button>
              <button type="submit" className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-sm">Lưu file Drive</button>
            </div>
          </form>
        </div>
      )}

      {/* 9. RESOURCE MODAL */}
      {resourceModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-xl">
            <h3 className="font-bold text-[15px] mb-4 text-slate-800 border-b border-slate-100 pb-3">
              Thêm {resourceModal.type === 'video_list' ? 'Video' : 'Tài liệu'} cho {resourceModal.lessonTitle}
            </h3>
            <form onSubmit={handleAddResource} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề hiển thị *</label>
                <input required value={resTitle} onChange={e=>setResTitle(e.target.value)} placeholder={resourceModal.type === 'video_list' ? "VD: Video bài giảng phần 1" : "VD: Tài liệu viết tay"} className="w-full border border-slate-300 p-2.5 rounded-xl focus:border-[#1D4ED8] outline-none text-sm"/>
              </div>

              {resourceModal.type === "video_list" && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phân loại Video *</label>
                  <select
                    value={vidType}
                    onChange={e => setVidType(e.target.value as any)}
                    className="w-full border border-slate-300 p-2.5 rounded-xl focus:border-[#1D4ED8] outline-none text-sm font-bold text-slate-800 bg-white cursor-pointer"
                  >
                    <option value="lecture">Video Bài Giảng (Lý thuyết)</option>
                    <option value="homework_solution">Video Chữa BTVN (Chi tiết)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Link (URL YouTube / Google Drive) *</label>
                <input required type="url" value={resUrl} onChange={e=>setResUrl(e.target.value)} placeholder="https://..." className="w-full border border-slate-300 p-2.5 rounded-xl focus:border-[#1D4ED8] outline-none text-sm"/>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={()=>setResourceModal(null)} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-xl text-xs font-bold cursor-pointer">Hủy</button>
                <button type="submit" className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm cursor-pointer">Lưu tài nguyên</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. EDIT LESSON MODAL */}
      {editLessonModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleEditLessonSubmit} className="bg-white rounded-[24px] w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2"><Edit3 className="w-5 h-5 text-[#1D4ED8]" /> Chỉnh sửa bài học</h3>
              <button type="button" onClick={() => setEditLessonModal(null)} className="text-slate-400 hover:text-rose-500"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tiêu đề bài học</label>
                <input required type="text" value={editLessonForm.title} onChange={e => setEditLessonForm({...editLessonForm, title: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Phân luồng bài học (Target Mode) *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditLessonForm({ ...editLessonForm, target_mode: "online" })}
                    className={
                      "py-2 px-3 rounded-xl text-xs font-black border transition " + 
                      (editLessonForm.target_mode === "online"
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100")
                    }
                  >
                    Lớp Online
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditLessonForm({ ...editLessonForm, target_mode: "offline" })}
                    className={
                      "py-2 px-3 rounded-xl text-xs font-black border transition " + 
                      (editLessonForm.target_mode === "offline"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100")
                    }
                  >
                    Lớp Offline
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditLessonForm({ ...editLessonForm, target_mode: "all" })}
                    className={
                      "py-2 px-3 rounded-xl text-xs font-black border transition " + 
                      (editLessonForm.target_mode === "all" || !editLessonForm.target_mode
                        ? "bg-blue-50 border-blue-500 text-[#1D4ED8] ring-2 ring-blue-500/20 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100")
                    }
                  >
                    Cả 2 (Full)
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Thời lượng (phút)</label>
                  <input required type="number" value={editLessonForm.duration} onChange={e => setEditLessonForm({...editLessonForm, duration: parseInt(e.target.value) || 0})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Hình thức</label>
                  <select value={editLessonForm.format} onChange={e => setEditLessonForm({...editLessonForm, format: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none bg-white">
                    <option value="Zoom">Zoom</option>
                    <option value="Facebook">Facebook Group</option>
                    <option value="Video">Video quay sẵn</option>
                    <option value="Tự học">Tự học</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Mô tả</label>
                <textarea rows={2} value={editLessonForm.description} onChange={e => setEditLessonForm({...editLessonForm, description: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-5 mt-5 border-t border-slate-100">
              <button type="button" onClick={() => setEditLessonModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">Hủy</button>
              <button type="submit" className="px-5 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold rounded-xl text-xs shadow-sm">Lưu thay đổi</button>
            </div>
          </form>
        </div>
      )}

      {/* 11. ADD ATTENDANCE DATE MODAL */}
      {isAddDateModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleAddNewAttendanceDate} className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#1D4ED8]" /> Thêm ngày học & Cột điểm danh mới
              </h3>
              <button type="button" onClick={() => setIsAddDateModalOpen(false)} className="text-slate-400 hover:text-rose-500"><X className="w-5 h-5"/></button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Chọn ngày học *</label>
              <input 
                type="date" 
                required 
                value={newDateInput} 
                onChange={e => setNewDateInput(e.target.value)} 
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#1D4ED8] outline-none" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Khung giờ ca học *</label>
              <div className="space-y-1.5">
                <select 
                  value={newDateShift} 
                  onChange={e => {
                    const shId = e.target.value;
                    setNewDateShift(shId);
                    if (shId !== "custom") {
                      const sh = STANDARD_SHIFTS.find(s => s.id === shId);
                      if (sh) setNewDateTimeSlot(sh.timeSlot);
                    }
                  }} 
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#1D4ED8] outline-none bg-white cursor-pointer" 
                >
                  <option value="custom">-- Khung giờ tùy chỉnh (Tự do nhập bên dưới) --</option>
                  {STANDARD_SHIFTS.map(sh => (
                    <option key={sh.id} value={sh.id}>{sh.name} ({sh.timeSlot})</option>
                  ))}
                </select>
                <input 
                  type="text" 
                  required 
                  value={newDateTimeSlot} 
                  onChange={e => setNewDateTimeSlot(e.target.value)} 
                  placeholder="VD: 21:30 - 23:00 hoặc 08:15 - 09:45" 
                  className="w-full px-3 py-2 border border-blue-200 rounded-xl text-xs font-black text-[#1D4ED8] outline-none focus:border-[#1D4ED8]" 
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Đối tượng áp dụng *</label>
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setNewDateAudience("online")} className={"py-2 text-xs font-bold rounded-xl border " + (newDateAudience === "online" ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-600")}>Lớp Online</button>
                <button type="button" onClick={() => setNewDateAudience("offline")} className={"py-2 text-xs font-bold rounded-xl border " + (newDateAudience === "offline" ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "bg-slate-50 border-slate-200 text-slate-600")}>Lớp Offline</button>
                <button type="button" onClick={() => setNewDateAudience("all")} className={"py-2 text-xs font-bold rounded-xl border " + (newDateAudience === "all" ? "bg-blue-50 border-blue-500 text-[#1D4ED8]" : "bg-slate-50 border-slate-200 text-slate-600")}>Cả hai</button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề buổi học (Tùy chọn)</label>
              <input 
                type="text" 
                value={newDateTitle} 
                onChange={e => setNewDateTitle(e.target.value)} 
                placeholder="VD: Chuyên đề Đại số & Giải tích 12" 
                className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#1D4ED8] outline-none" 
              />
            </div>
            <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setIsAddDateModalOpen(false)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">Hủy</button>
              <button type="submit" className="px-5 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold rounded-xl text-xs shadow-sm">Tạo cột điểm danh</button>
            </div>
          </form>
        </div>
      )}

      {/* 12. BOOST MODAL */}
      {boostModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleAddBoost} className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-amber-600 text-[15px] flex items-center gap-2"><Zap className="w-5 h-5 fill-amber-500" /> Thêm tài liệu tăng cường</h3>
              <button type="button" onClick={() => setBoostModal(null)} className="text-slate-400 hover:text-rose-500"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tiêu đề</label>
                <input required type="text" value={boostForm.title} onChange={e => setBoostForm({...boostForm, title: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-amber-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Loại tài liệu</label>
                <select value={boostForm.type} onChange={e => setBoostForm({...boostForm, type: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-amber-500 outline-none bg-white">
                  <option value="video">Video bài giảng (YouTube/Drive)</option>
                  <option value="document">Tài liệu / File đề PDF (Drive)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Link / URL truy cập</label>
                <input required type="url" placeholder="https://..." value={boostForm.url} onChange={e => setBoostForm({...boostForm, url: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-amber-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Ghi chú (Tùy chọn)</label>
                <textarea rows={2} value={boostForm.note} onChange={e => setBoostForm({...boostForm, note: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-amber-500 outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-5 mt-5 border-t border-slate-100">
              <button type="button" onClick={() => setBoostModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">Hủy</button>
              <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs shadow-sm">Lưu tăng cường</button>
            </div>
          </form>
        </div>
      )}

      {/* 13. VIDEO SOLUTION MODAL */}
      {videoModalExam && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleSaveSolutionVideo} className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2">
                <Video className="w-5 h-5 text-amber-500" /> Gắn Video chữa bài
              </h3>
              <button type="button" onClick={() => setVideoModalExam(null)} className="text-slate-400 hover:text-rose-500">
                <X className="w-5 h-5"/>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-[#1D4ED8] mb-2">{videoModalExam.title}</p>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Link Video YouTube hoặc Google Drive
                </label>
                <input
                  required
                  type="url"
                  placeholder="https://youtu.be/... hoặc https://drive.google.com/..."
                  value={solutionVideoInput}
                  onChange={e => setSolutionVideoInput(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-amber-500 outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                  * Học sinh sẽ xem được video hướng dẫn giải chi tiết này trong mục Luyện đề.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-5 mt-5 border-t border-slate-100">
              <button type="button" onClick={() => setVideoModalExam(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs">
                Hủy
              </button>
              <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs shadow-sm">
                Lưu video
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 14. TEST EXAM ROOM MODAL */}
      {testExamRoom && (
        <div className="fixed inset-0 z-[700] bg-white">
          <div className="h-10 bg-indigo-900 text-white flex items-center justify-between px-6 text-xs font-bold">
            <span>CHẾ ĐỘ TEST ĐỀ DÀNH CHO GIÁO VIÊN / ADMIN (Không ghi nhận điểm vào bảng xếp hạng chung)</span>
            <button 
              type="button"
              onClick={() => setTestExamRoom(null)} 
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white cursor-pointer"
            >
              Thoát Test ✕
            </button>
          </div>
          <div className="h-[calc(100vh-40px)]">
            <ExamRoomView
              quizId={testExamRoom.id}
              quizTitle={testExamRoom.title}
              durationMinutes={testExamRoom.duration}
              profile={{ id: "admin-test", full_name: "Giáo viên (Test)", role: "admin", school: "Admin", grade: "12" }}
              isHomework={false}
              onBackToDashboard={() => setTestExamRoom(null)}
            />
          </div>
        </div>
      )}
    </>
  );
}
