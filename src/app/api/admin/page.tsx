"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, BookOpen, Users, Award, Trophy, 
  Plus, FileText, Video, PenTool, ClipboardCheck, 
  Trash2, LinkIcon, X, FileUp, FileSignature, FolderPlus, GraduationCap
} from "lucide-react";
import { AzotaExamConfigModal } from "./AzotaExamConfigModal";

const INITIAL_CHAPTERS = [
  {
    id: "chap-1",
    title: "Chương 1: Ứng dụng đạo hàm để khảo sát hàm số",
    lessons: [
      {
        id: "les-1",
        title: "Bài 1: Tính đơn điệu của hàm số",
        lecture_files: [], homework_files: [], handwritten_notes: [], video_list: [], test_quizzes: [], extra_resources: []
      }
    ]
  }
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("lessons");
  const [chapters, setChapters] = useState<any[]>([]);

  useEffect(() => {
    const savedData = localStorage.getItem("edunexus_course_data");
    if (savedData) {
      setChapters(JSON.parse(savedData));
    } else {
      setChapters(INITIAL_CHAPTERS);
      localStorage.setItem("edunexus_course_data", JSON.stringify(INITIAL_CHAPTERS));
    }
  }, []);

  const saveToStorage = (newChapters: any[]) => {
    setChapters(newChapters);
    localStorage.setItem("edunexus_course_data", JSON.stringify(newChapters));
    window.dispatchEvent(new Event("storage"));
  };

  const [testFile, setTestFile] = useState<File | null>(null);
  const [azotaTarget, setAzotaTarget] = useState<{ lessonId: string, type: "homework_files" | "test_quizzes" } | null>(null);

  const [resourceModal, setResourceModal] = useState<{
    isOpen: boolean; lessonId: string; lessonTitle: string; 
    type: "lecture_files" | "homework_files" | "handwritten_notes" | "video_list" | "extra_resources" | "test_quizzes";
  } | null>(null);

  const [resTitle, setResTitle] = useState("");
  const [resUrl, setResUrl] = useState("");
  const [vidType, setVidType] = useState("lecture");

  const [createModal, setCreateModal] = useState<{ type: "chapter" | "lesson"; chapterId?: string } | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");

  const handleWordUpload = (e: React.ChangeEvent<HTMLInputElement>, lessonId: string, targetType: "homework_files" | "test_quizzes") => {
    if (e.target.files?.[0]) {
      setTestFile(e.target.files[0]);
      setAzotaTarget({ lessonId, type: targetType });
      setResourceModal(null);
    }
  };

  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resUrl.trim() || !resourceModal) return;
    const newResource = { id: `res-${Date.now()}`, title: resTitle, url: resUrl, type: resourceModal.type === "video_list" ? vidType : undefined };
    const newChapters = chapters.map(chap => ({
      ...chap,
      lessons: chap.lessons.map((les: any) => {
        if (les.id === resourceModal.lessonId) {
          const currentList = les[resourceModal.type] || [];
          return { ...les, [resourceModal.type]: [...currentList, newResource] };
        }
        return les;
      })
    }));
    saveToStorage(newChapters);
    setResTitle(""); setResUrl("");
    alert("Đã lưu tài nguyên lên hệ thống thành công!");
  };

  const handleDeleteResource = (lessonId: string, resType: string, resId: string) => {
    if(!confirm("Bạn có chắc chắn muốn xóa?")) return;
    const newChapters = chapters.map(chap => ({
      ...chap,
      lessons: chap.lessons.map((les: any) => les.id === lessonId ? { ...les, [resType]: les[resType].filter((r: any) => r.id !== resId) } : les)
    }));
    saveToStorage(newChapters);
  };

  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim() || !createModal) return;
    let newChapters = [...chapters];
    if (createModal.type === "chapter") {
      newChapters.push({ id: `chap-${Date.now()}`, title: newItemTitle, lessons: [] });
    } else if (createModal.type === "lesson" && createModal.chapterId) {
      newChapters = newChapters.map(chap => chap.id === createModal.chapterId ? {
        ...chap, lessons: [...chap.lessons, {
          id: `les-${Date.now()}`, title: newItemTitle,
          lecture_files: [], homework_files: [], handwritten_notes: [], video_list: [], test_quizzes: [], extra_resources: []
        }]
      } : chap);
    }
    saveToStorage(newChapters);
    setCreateModal(null);
    setNewItemTitle("");
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans text-slate-800">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 hidden md:flex flex-col shrink-0 p-4">
        <h1 className="font-extrabold text-white text-lg mb-6 flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-500"/> Admin Panel</h1>
        <nav className="space-y-2 flex-1">
           <button className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 text-white shadow-md">
             <BookOpen className="w-4 h-4" /> Nội dung bài học
           </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 shadow-xs shrink-0 justify-between">
          <h2 className="font-bold text-slate-800">Quản lý nội dung bài học</h2>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-xs font-semibold text-slate-600"><GraduationCap className="w-4 h-4" /> Ban Giáo Vụ</div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8">
            <div className="space-y-6">
              <div className="flex items-center justify-end">
                <button onClick={() => setCreateModal({ type: "chapter" })} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition">
                  <FolderPlus className="w-4 h-4" /> Thêm Chương mới
                </button>
              </div>

              {chapters.map((chap) => (
                <div key={chap.id} className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
                  <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-sm">{chap.title}</h3>
                    <button onClick={() => setCreateModal({ type: "lesson", chapterId: chap.id })} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100 transition shadow-2xs">
                      <Plus className="w-3 h-3" /> Thêm bài học
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 p-4 space-y-4">
                    {chap.lessons.length === 0 ? (
                       <div className="text-center py-4 text-xs text-slate-400 italic">Chưa có bài học nào trong chương này.</div>
                    ) : chap.lessons.map((les: any) => (
                      <div key={les.id} className="flex flex-col xl:flex-row xl:items-center gap-4">
                        <div className="xl:w-1/3"><h4 className="font-bold text-slate-900 text-[13px]">{les.title}</h4></div>
                        
                        <div className="flex flex-wrap items-center gap-2.5">
                          <button onClick={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "lecture_files" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-blue-200 text-blue-600 hover:bg-blue-50">
                            <FileText className="w-3.5 h-3.5"/> File bài học <Plus className="w-3 h-3"/>
                          </button>
                          
                          <button onClick={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "homework_files" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                            <BookOpen className="w-3.5 h-3.5"/> BTVN <Plus className="w-3 h-3"/>
                          </button>

                          <button onClick={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "handwritten_notes" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-purple-200 text-purple-600 hover:bg-purple-50">
                            <PenTool className="w-3.5 h-3.5"/> BVT <Plus className="w-3 h-3"/>
                          </button>

                          <button onClick={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "video_list" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-rose-200 text-rose-600 hover:bg-rose-50">
                            <Video className="w-3.5 h-3.5"/> Video <Plus className="w-3 h-3"/>
                          </button>

                          <button onClick={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "test_quizzes" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition cursor-pointer">
                            <ClipboardCheck className="w-3.5 h-3.5" /> Test <Plus className="w-3 h-3"/>
                          </button>

                          <button onClick={() => setResourceModal({ isOpen: true, lessonId: les.id, lessonTitle: les.title, type: "extra_resources" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-300 text-slate-600 hover:bg-slate-100">
                            <LinkIcon className="w-3.5 h-3.5"/> Tài liệu khác <Plus className="w-3 h-3"/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
        </div>
      </main>

      {/* MODAL THÊM CHƯƠNG/BÀI HỌC */}
      {createModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form onSubmit={handleCreateNewItem} className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-bold text-slate-800 mb-4">{createModal.type === "chapter" ? "Thêm Chương Mới" : "Thêm Bài Học Mới"}</h3>
            <input autoFocus required type="text" value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} placeholder={createModal.type === "chapter" ? "Tên chương..." : "Tên bài học..."} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-4 outline-none focus:border-blue-500" />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setCreateModal(null)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700">Hủy</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold">Thêm</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL UPLOAD TÀI NGUYÊN */}
      {resourceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-900 uppercase text-sm">Quản lý Tài nguyên</h3>
                <p className="text-xs text-blue-600 font-semibold mt-1">{resourceModal.lessonTitle}</p>
              </div>
              <button onClick={() => setResourceModal(null)} className="text-slate-400 hover:text-slate-800 transition p-1"><X className="w-6 h-6"/></button>
            </div>
            
            <div className="p-6 bg-slate-50/50 space-y-6">
              {(resourceModal.type === "homework_files" || resourceModal.type === "test_quizzes") && (
                <div className="p-5 bg-[#F5F3FF] border border-[#DDD6FE] rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-[#4C1D95] font-bold text-sm">
                    <FileSignature className="w-5 h-5"/> 1. Tạo {resourceModal.type === "homework_files" ? "BTVN" : "Đề Test"} điền đáp án trên Web
                  </div>
                  <p className="text-xs text-[#6D28D9]">Học sinh sẽ làm bài trực tiếp trên hệ thống. {resourceModal.type === "homework_files" && "Không bị giới hạn thời gian."}</p>
                  <label className="w-full py-3 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm">
                    <FileUp className="w-4 h-4" /> Chọn file Word (.docx)
                    <input type="file" accept=".docx" className="hidden" onChange={(e) => handleWordUpload(e, resourceModal.lessonId, resourceModal.type)} />
                  </label>
                </div>
              )}

              <form onSubmit={handleAddResource} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
                <div className="text-sm font-bold text-slate-800 mb-1">+ Thêm mới file/link</div>
                <input required type="text" value={resTitle} onChange={e => setResTitle(e.target.value)} placeholder="Tên hiển thị (VD: File Bài tập mẫu)" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition" />
                <input required type="text" value={resUrl} onChange={e => setResUrl(e.target.value)} placeholder="Link (Drive, Youtube...)" className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition" />
                
                {resourceModal.type === "video_list" && (
                  <select value={vidType} onChange={e => setVidType(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 bg-white">
                    <option value="lecture">Video Bài Giảng</option>
                    <option value="correction">Video Chữa Bài (Khóa cho đến khi nộp BTVN)</option>
                  </select>
                )}
                <div className="pt-2">
                  <button type="submit" className="w-full py-3 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm transition">Lưu lên hệ thống</button>
                </div>
              </form>

              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Danh sách đã tải lên</div>
                <div className="max-h-40 overflow-y-auto space-y-2.5 pr-1">
                  {chapters.map(c => c.lessons.find((l: any) => l.id === resourceModal.lessonId)?.[resourceModal.type]?.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between p-3.5 border border-slate-200 rounded-xl bg-white shadow-xs">
                      <span className="text-xs font-semibold text-slate-700 truncate pr-2">{item.title} {item.is_quiz && <span className="text-indigo-600 ml-1">[Form Điền Web]</span>}</span>
                      <button type="button" onClick={() => handleDeleteResource(resourceModal.lessonId, resourceModal.type, item.id)} className="text-rose-500 hover:text-rose-700 bg-rose-50 p-2 rounded-lg transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AZOTA MODAL - ĐÃ SỬA LỖI LƯU TRỮ VÀ THÊM THÔNG BÁO THÀNH CÔNG */}
      {testFile && azotaTarget && (
        <AzotaExamConfigModal 
          isOpen={true} 
          file={testFile} 
          onClose={() => { setTestFile(null); setAzotaTarget(null); }} 
          onPublish={(examData) => {
            const isHw = azotaTarget.type === "homework_files";
            const newExam = {
              id: `exam-${Date.now()}`,
              title: examData.title || (isHw ? "Bài BTVN trực tuyến" : "Bài kiểm tra định kỳ"),
              isHomework: isHw,
              duration_minutes: isHw ? 0 : (examData.duration_minutes || 45),
              is_quiz: true,
              data: examData.sections // Dữ liệu câu hỏi thực tế bóc tách từ Word
            };

            const newChapters = chapters.map(chap => ({
              ...chap,
              lessons: chap.lessons.map((les: any) => {
                if (les.id === azotaTarget.lessonId) {
                  const currentList = les[azotaTarget.type] || [];
                  return { ...les, [azotaTarget.type]: [...currentList, newExam] };
                }
                return les;
              })
            }));

            saveToStorage(newChapters);
            setTestFile(null); 
            setAzotaTarget(null);
            alert("✅ Đã xuất bản và lưu đề thi thành công lên hệ thống! Học sinh có thể vào làm bài ngay.");
          }}
        />
      )}
    </div>
  );
}