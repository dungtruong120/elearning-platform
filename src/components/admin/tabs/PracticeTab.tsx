"use client";

import React from "react";
import { 
  Target, UploadCloud, ChevronDown, ToggleRight, ToggleLeft, 
  Link as LinkIcon, Video, BarChart2, FileSignature, Play, 
  Trash2, Filter, Eye, Loader2 
} from "lucide-react";
import { EXAM_CATEGORIES } from "@/types/admin";

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
  examsWithScoresData
}: PracticeTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto">
      {/* THANH TIẾN TRÌNH KHI BÓC TÁCH / UPLOAD FILE */}
      {uploadProgressText && (
        <div className="bg-blue-50 border-2 border-[#1D4ED8] p-4 rounded-2xl flex items-center gap-3 shadow-md">
          <Loader2 className="w-5 h-5 text-[#1D4ED8] animate-spin shrink-0" />
          <div className="text-xs font-bold text-[#1D4ED8]">
            {uploadProgressText}
          </div>
        </div>
      )}

      <div className="flex gap-2.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit">
        <button 
          type="button"
          onClick={() => setPracticeSubTab("manage")} 
          className={
            "px-5 py-2.5 rounded-[14px] text-[13px] font-bold transition-all duration-300 cursor-pointer " + 
            (practiceSubTab === "manage" ? "bg-[#1D4ED8] text-white shadow-sm" : "text-slate-500 hover:bg-slate-100/50")
          }
        >
          Kho Đề & Tải lên
        </button>
        <button 
          type="button"
          onClick={() => setPracticeSubTab("scores")} 
          className={
            "px-5 py-2.5 rounded-[14px] text-[13px] font-bold transition-all duration-300 cursor-pointer " + 
            (practiceSubTab === "scores" ? "bg-[#1D4ED8] text-white shadow-sm" : "text-slate-500 hover:bg-slate-100/50")
          }
        >
          Điểm & Xếp hạng Luyện đề
        </button>
      </div>

      {practiceSubTab === "manage" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex items-center gap-5 min-w-[200px]">
              <div className="w-12 h-12 bg-blue-50 text-[#1D4ED8] rounded-2xl flex items-center justify-center">
                <Target className="w-6 h-6"/>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Tổng số đề</p>
                {isLoadingExams ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Loader2 className="w-5 h-5 text-[#1D4ED8] animate-spin" />
                    <span className="text-xs text-slate-400 font-semibold">Đang tải...</span>
                  </div>
                ) : (
                  <p className="text-2xl font-black text-slate-900">{practiceExams.length}</p>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 px-6 py-3.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-[13px] font-bold rounded-2xl shadow-md transition-all cursor-pointer">
              <UploadCloud className="w-5 h-5" /> + Tải lên Đề thi mới (.docx / .pdf)
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

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-900 text-[15px]">Danh sách Kho Đề Thực Chiến</h3>
              <span className="text-xs text-slate-500 font-bold">* Click vào thẻ Phân Loại để chuyển đổi nhanh giữa các kỳ thi</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-white text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-4 px-5 font-bold w-1/4">Tiêu đề đề thi</th>
                    <th className="py-4 px-3 font-bold text-center">Phân loại (Loại đề)</th>
                    <th className="py-4 px-3 font-bold text-center">Phân hệ lớp</th>
                    <th className="py-4 px-3 font-bold text-center">Làm lại bài</th>
                    <th className="py-4 px-4 font-bold text-center">Quyền xem file</th>
                    <th className="py-4 px-4 font-bold text-center">Link đề Drive</th>
                    <th className="py-4 px-4 font-bold text-center text-amber-700">Video chữa bài</th>
                    <th className="py-4 px-5 font-bold text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50">
                  {isLoadingExams ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <Loader2 className="w-8 h-8 text-[#1D4ED8] animate-spin" />
                          <p className="text-xs font-bold text-slate-500">
                            Đang nạp nhanh danh mục kho đề thực chiến từ Supabase...
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : practiceExams.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-slate-400 font-semibold">
                        Chưa có đề thi nào trong kho. Vui lòng bấm nút "+ Tải lên Đề thi mới" ở trên.
                      </td>
                    </tr>
                  ) : (
                    practiceExams.map((ex, exIdx) => (
                      <tr key={ex?.id || exIdx} className="hover:bg-slate-50/50 transition-colors bg-white">
                        <td className="py-4 px-5 font-bold text-slate-800 truncate max-w-[220px]" title={ex?.title}>
                          {ex?.title || "Đề thi"}
                        </td>
                        <td className="py-4 px-3 text-center">
                          <div className="relative inline-block">
                            <select
                              value={ex?.category || "Luyện đề"}
                              onChange={(e) => handleChangeExamCategory(ex.id, e.target.value)}
                              className="appearance-none px-3 py-1.5 pr-6 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-black text-[11px] uppercase rounded-xl tracking-wider cursor-pointer outline-none transition"
                            >
                              {EXAM_CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                            <ChevronDown className="w-3 h-3 text-indigo-500 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </td>
                        <td className="py-4 px-3 text-center">
                          <button
                            type="button"
                            onClick={async () => {
                              const nextMode = ex.target_mode === "all" ? "online" : ex.target_mode === "online" ? "offline" : "all";
                              const newExams = practiceExams.map(e => e?.id === ex?.id ? { ...e, target_mode: nextMode } : e);
                              await savePracticeExams(newExams);
                              try {
                                await supabase.from("practice_exams").update({ target_mode: nextMode }).eq("id", ex.id);
                              } catch {}
                              showToast("Đã chuyển đề sang: " + (nextMode === "online" ? "Lớp Online" : nextMode === "offline" ? "Lớp Offline" : "Cả hai lớp"), "success");
                            }}
                            title="Click để chuyển phân hệ: Online -> Offline -> Cả hai"
                            className="cursor-pointer"
                          >
                            <span className={
                              "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border " +
                              (ex.target_mode === "online"
                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                : ex.target_mode === "offline"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-blue-50 text-[#1D4ED8] border-blue-200")
                            }>
                              {ex.target_mode === "online" ? "Online" : ex.target_mode === "offline" ? "Offline" : "Cả 2"}
                            </span>
                          </button>
                        </td>
                        <td className="py-4 px-3 text-center">
                          <button 
                            type="button"
                            onClick={async () => {
                              const newAllow = !(ex?.allowRetake ?? true);
                              const newExams = practiceExams.map(e => e?.id === ex?.id ? { ...e, allowRetake: newAllow } : e);
                              await savePracticeExams(newExams);
                              try {
                                await supabase.from("practice_exams").update({ allowRetake: newAllow }).eq("id", ex.id);
                              } catch {}
                              showToast("Đã thay đổi quyền làm lại.", "success");
                            }} 
                            className="cursor-pointer"
                          >
                            {(ex?.allowRetake ?? true) 
                              ? <ToggleRight className="w-8 h-8 text-emerald-500 mx-auto" /> 
                              : <ToggleLeft className="w-8 h-8 text-slate-300 mx-auto" />}
                          </button>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button 
                            type="button"
                            onClick={async () => {
                              const newAllow = !(ex?.allowViewFile ?? true);
                              const newExams = practiceExams.map(e => e?.id === ex?.id ? { ...e, allowViewFile: newAllow } : e);
                              await savePracticeExams(newExams);
                              try {
                                await supabase.from("practice_exams").update({ allowViewFile: newAllow }).eq("id", ex.id);
                              } catch {}
                              showToast("Đã cập nhật quyền xem file.", "success");
                            }} 
                            className="cursor-pointer"
                          >
                            {(ex?.allowViewFile ?? true) 
                              ? <ToggleRight className="w-8 h-8 text-[#1D4ED8] mx-auto" /> 
                              : <ToggleLeft className="w-8 h-8 text-slate-300 mx-auto" />}
                          </button>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button 
                            type="button"
                            onClick={async () => {
                              const url = prompt("Nhập link Google Drive mới:", ex?.driveUrl || "");
                              if (url !== null) {
                                const newExams = practiceExams.map(e => e?.id === ex?.id ? { ...e, driveUrl: url } : e);
                                await savePracticeExams(newExams);
                                try {
                                  await supabase.from("practice_exams").update({ driveUrl: url }).eq("id", ex.id);
                                } catch {}
                                showToast("Đã cập nhật link Drive.", "success");
                              }
                            }} 
                            className="text-[#1D4ED8] hover:underline flex items-center justify-center gap-1.5 font-semibold text-xs mx-auto cursor-pointer"
                          >
                            <LinkIcon className="w-3.5 h-3.5" /> {ex?.driveUrl ? "Sửa link" : "Thêm link"}
                          </button>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setVideoModalExam(ex);
                              setSolutionVideoInput(ex?.solutionVideoUrl || ex?.videoUrl || "");
                            }}
                            className={
                              "px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer " + 
                              ((ex?.solutionVideoUrl || ex?.videoUrl)
                                ? "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100" 
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200")
                            }
                          >
                            <Video className="w-3.5 h-3.5 text-amber-600" />
                            <span>{(ex?.solutionVideoUrl || ex?.videoUrl) ? "Đã có video" : "+ Gắn video"}</span>
                          </button>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const cleanExTitle = String(ex?.title || "").trim().toLowerCase();
                                const attemptsForExam = (allAttempts || []).filter(a => {
                                  if (!a) return false;
                                  const matchId = (a.quizId === ex.id) || (a.exam_id === ex.id);
                                  const aTitle = String(a.examTitle || a.quizTitle || a.title || "").trim().toLowerCase();
                                  const matchTitle = cleanExTitle && aTitle && (aTitle === cleanExTitle || cleanExTitle.includes(aTitle) || aTitle.includes(cleanExTitle));
                                  return matchId || matchTitle;
                                });

                                setAzotaScoreViewModal({
                                  isOpen: true,
                                  examTitle: ex.title,
                                  attempts: attemptsForExam
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
                              title="Sửa cấu trúc câu hỏi, lời giải & đáp án (Tải on-demand)"
                            >
                              <FileSignature className="w-4 h-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onTestExam(ex)}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              title="Làm thử để kiểm tra đề & KaTeX"
                            >
                              <Play className="w-3 h-3 fill-indigo-600" /> Test
                            </button>

                            <button 
                              type="button"
                              onClick={async () => { 
                                if (confirm("Xóa đề này khỏi kho?")) {
                                  const updated = practiceExams.filter(e => e?.id !== ex?.id);
                                  await savePracticeExams(updated);
                                  try {
                                    await supabase.from("practice_exams").delete().eq("id", ex.id);
                                    showToast("Đã xóa đề thi khỏi kho.", "success");
                                  } catch {}
                                } 
                              }} 
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4"/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {practiceSubTab === "scores" && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2.5">
              <Filter className="w-4 h-4 text-[#1D4ED8]"/> Bộ lọc danh mục đề thi
            </h3>
            <select 
              value={practiceCategoryFilter} 
              onChange={e => setPracticeCategoryFilter(e.target.value)} 
              className="px-5 py-3 text-[13px] font-bold text-[#1D4ED8] bg-blue-50/50 border border-blue-100 rounded-2xl focus:border-blue-500 outline-none transition cursor-pointer"
            >
              <option value="Tất cả danh mục">Tất cả danh mục</option>
              {EXAM_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-[15px]">
                  Danh Sách Đề Thi & Bảng Điểm Học Sinh ({practiceCategoryFilter})
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  * Bấm vào bất kỳ đề thi nào để mở toàn bộ học sinh đã làm đề thi đó.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-bold">{examsWithScoresData.length} đề thi</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-white text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-4 px-6 w-16 font-bold text-center">STT</th>
                    <th className="py-4 px-6 font-bold min-w-[240px]">Tên đề thi</th>
                    <th className="py-4 px-6 font-bold text-center">Phân loại</th>
                    <th className="py-4 px-6 font-bold text-center">Số HS làm bài</th>
                    <th className="py-4 px-6 font-bold text-center text-blue-700">Điểm TB cả lớp</th>
                    <th className="py-4 px-6 font-bold text-center text-emerald-700">Điểm cao nhất</th>
                    <th className="py-4 px-6 font-bold text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/50">
                  {examsWithScoresData.map((ex, i) => (
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
                      <td className="py-4 px-6 font-bold text-slate-400 text-center">{i + 1}</td>
                      <td className="py-4 px-6 font-bold text-slate-800 group-hover:text-[#1D4ED8] transition-colors">
                        <div>{ex.title}</div>
                        <span className="text-[10px] text-slate-400 font-normal">{ex.duration_minutes || 45} phút</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-black uppercase">
                          {ex.category || "Luyện đề"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center font-bold text-slate-700">
                        {ex.uniqueStudentCount} bạn ({ex.totalSubmissions} lượt)
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-100">
                          {ex.avgScore}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-black rounded-lg border border-emerald-100">
                          {ex.maxScore}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
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
                          className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-[#1D4ED8] hover:text-[#1D4ED8] text-slate-600 font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5"/> Xem điểm học sinh
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
