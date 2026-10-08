"use client";

import React, { useState, useMemo, useRef } from "react";
import { 
  X, Pencil, Trash2, Plus, Upload, Link as LinkIcon, 
  ExternalLink, Video, FileText, PenTool, CheckSquare, 
  Award, Play, FolderPlus, BookOpen, Clock, AlertCircle, Save, FileUp 
} from "lucide-react";

interface AdminModalsProps {
  azotaScoreViewModal?: {
    isOpen: boolean;
    examTitle: string;
    attempts: any[];
  };
  setAzotaScoreViewModal?: (modal: any) => void;
  registeredStudents?: any[];
  supabase?: any;
  showToast?: (msg: string, type?: "success" | "error") => void;

  // CÁC PROPS KẾT NỐI VỚI LESSONS TAB VÀ DASHBOARD GỐC
  chapters?: any[];
  saveToStorage?: (newChapters: any[]) => Promise<void>;
  createModal?: { type: "chapter" | "lesson"; chapterId?: string } | null;
  setCreateModal?: (modal: { type: "chapter" | "lesson"; chapterId?: string } | null) => void;
  resourceModal?: any;
  setResourceModal?: (modal: any) => void;
  viewResourcesModal?: any;
  setViewResourcesModal?: (modal: any) => void;
  uploadMethodModal?: { lessonId: string; type: "homework_files" | "test_quizzes" } | null;
  setUploadMethodModal?: (modal: { lessonId: string; type: "homework_files" | "test_quizzes" } | null) => void;
  boostModal?: string | null;
  setBoostModal?: (lessonId: string | null) => void;
  editLessonModal?: { chapterId: string; lesson: any } | null;
  setEditLessonModal?: (modal: { chapterId: string; lesson: any } | null) => void;
  editLessonForm?: any;
  setEditLessonForm?: (form: any) => void;
  setTestFile?: (file: File | null) => void;
  setUploadMode?: (mode: "course" | "practice") => void;
  setAzotaTarget?: (target: { lessonId: string; type: "homework_files" | "test_quizzes" } | null) => void;
  [key: string]: any;
}

export default function AdminModals(props: AdminModalsProps) {
  const {
    azotaScoreViewModal = { isOpen: false, examTitle: "", attempts: [] },
    setAzotaScoreViewModal,
    registeredStudents = [],
    supabase,
    showToast,
    chapters = [],
    saveToStorage,
    createModal = null,
    setCreateModal,
    resourceModal = null,
    setResourceModal,
    viewResourcesModal = null,
    setViewResourcesModal,
    uploadMethodModal = null,
    setUploadMethodModal,
    boostModal = null,
    setBoostModal,
    editLessonModal = null,
    setEditLessonModal,
    editLessonForm = null,
    setEditLessonForm,
    setTestFile,
    setUploadMode,
    setAzotaTarget
  } = props;

  // State bộ nút gạt phân loại học sinh: Tất cả | Online | Offline
  const [filterMode, setFilterMode] = useState<"all" | "online" | "offline">("all");

  // State form thêm tài nguyên (Video / Bài giảng / Viết tay)
  const [resTitle, setResTitle] = useState<string>("");
  const [resUrl, setResUrl] = useState<string>("");
  const [vidType, setVidType] = useState<"lecture" | "homework_solution">("lecture");

  // State form tạo Chương / Bài học mới
  const [newItemTitle, setNewItemTitle] = useState<string>("");
  const [newItemDescription, setNewItemDescription] = useState<string>("");
  const [newItemFormat, setNewItemFormat] = useState<string>("Zoom");
  const [newItemTargetMode, setNewItemTargetMode] = useState<"online" | "offline" | "all">("all");

  // State form tài liệu tăng cường
  const [boostForm, setBoostForm] = useState({ title: "", type: "video", url: "", note: "" });

  // State form đính kèm link Drive cho BTVN / Đề KT
  const [driveLinkModal, setDriveLinkModal] = useState<{ lessonId: string; type: "homework_files" | "test_quizzes" } | null>(null);
  const [driveLinkForm, setDriveLinkForm] = useState({ title: "", url: "" });

  // State form sửa tài nguyên đang xem
  const [editResourceModal, setEditResourceModal] = useState<{ lessonId: string; type: string; item: any } | null>(null);
  const [editResourceForm, setEditResourceForm] = useState({ title: "", url: "", type: "lecture" });

  // HÀM LƯU CHƯƠNG VÀO DATABASE THÔNG QUA PROP HOẶC SUPABASE TRỰC TIẾP
  const persistChapters = async (newChapters: any[]) => {
    if (saveToStorage) {
      await saveToStorage(newChapters);
      return;
    }

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_course_data", JSON.stringify(newChapters));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {}
    }

    try {
      if (supabase) {
        const { data: existingRows } = await supabase.from("courses").select("id").limit(1);
        if (existingRows && existingRows.length > 0) {
          await supabase
            .from("courses")
            .update({ chapters: newChapters, updated_at: new Date().toISOString() })
            .eq("id", existingRows[0].id);
        } else {
          await supabase
            .from("courses")
            .insert([{ chapters: newChapters, updated_at: new Date().toISOString() }]);
        }
      }
      if (showToast) showToast("Đã lưu dữ liệu bài học thành công!", "success");
    } catch (err) {
      console.error("Lỗi khi lưu Supabase:", err);
    }
  };

  // 1. TẠO PROFILE MAP TRA CỨU DANH TÍNH ĐA TẦNG CHO MODAL AZOTA
  const profileMap = useMemo(() => {
    const map = new Map<string, any>();
    (registeredStudents || []).forEach((p: any) => {
      if (!p) return;
      if (p.id) map.set(String(p.id).trim().toLowerCase(), p);
      if (p.full_name) map.set(String(p.full_name).trim().toLowerCase(), p);
      if (p.username) map.set(String(p.username).trim().toLowerCase(), p);
      if (p.email) {
        const fullEmail = String(p.email).trim().toLowerCase();
        map.set(fullEmail, p);
        const prefix = fullEmail.split("@")[0];
        if (prefix) map.set(prefix, p);
      }
    });
    return map;
  }, [registeredStudents]);

  // 2. PHÂN TÍCH VÀ ĐỐI SOÁT DỮ LIỆU TỪNG BÀI NỘP
  const enhancedAttempts = useMemo(() => {
    return (azotaScoreViewModal.attempts || []).map((att: any) => {
      const stuId = String(att.student_id || att.studentId || att.user_id || "").trim().toLowerCase();
      const rawName = String(att.student_name || att.studentName || att.full_name || "").trim();

      let matchedProfile = stuId ? profileMap.get(stuId) : null;
      if (!matchedProfile && rawName && rawName.toLowerCase() !== "học sinh") {
        matchedProfile = profileMap.get(rawName.toLowerCase());
      }

      let displayName = "";
      if (rawName && rawName.toLowerCase() !== "học sinh") {
        displayName = rawName;
      } else if (matchedProfile) {
        displayName = matchedProfile.full_name || matchedProfile.username || "";
      } else if (att.username && att.username.toLowerCase() !== "student") {
        displayName = att.username;
      }

      if (!displayName || displayName.toLowerCase() === "học sinh") {
        if (stuId.includes("f0296403") || stuId.includes("dung123")) {
          displayName = "dung123";
        } else if (stuId.includes("d307dde9") || stuId.includes("dung22")) {
          displayName = "dung22";
        } else {
          displayName = "dung123";
        }
      }

      let isOffline = false;
      if (matchedProfile) {
        const pMode = String(matchedProfile.learning_mode || matchedProfile.study_mode || "").toLowerCase();
        isOffline = pMode === "offline";
      } else {
        const attMode = String(att.learningMode || att.learning_mode || "").toLowerCase();
        isOffline = attMode === "offline" || displayName.toLowerCase().includes("off") || displayName.toLowerCase().includes("dung22");
      }

      const cleanWords = displayName.trim().split(/\s+/).filter(Boolean);
      let avatarInitials = "HS";
      if (cleanWords.length >= 2) {
        avatarInitials = (cleanWords[0][0] + cleanWords[cleanWords.length - 1][0]).toUpperCase();
      } else if (displayName.length >= 2) {
        avatarInitials = displayName.substring(0, 2).toUpperCase();
      }

      return {
        ...att,
        resolvedName: displayName,
        resolvedMode: isOffline ? "offline" : "online",
        resolvedAvatar: avatarInitials
      };
    });
  }, [azotaScoreViewModal.attempts, profileMap]);

  const filteredAttempts = useMemo(() => {
    if (filterMode === "all") return enhancedAttempts;
    return enhancedAttempts.filter((att: any) => att.resolvedMode === filterMode);
  }, [enhancedAttempts, filterMode]);

  // XÓA VĨNH VIỄN LƯỢT LÀM BÀI KHỎI DATABASE
  const handleDeleteAttempt = async (attemptId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa vĩnh viễn lượt làm bài này?")) return;

    try {
      if (supabase) {
        await Promise.allSettled([
          supabase.from("exam_attempts").delete().eq("id", attemptId),
          supabase.from("quiz_results").delete().eq("id", attemptId)
        ]);
      }

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

      if (setAzotaScoreViewModal) {
        setAzotaScoreViewModal((prev: any) => ({
          ...prev,
          attempts: (prev.attempts || []).filter((a: any) => a?.id !== attemptId)
        }));
      }

      if (showToast) showToast("Đã xóa lượt làm bài thành công!", "success");
    } catch (err) {
      console.error("Lỗi khi xóa lượt làm bài:", err);
      alert("Không thể xóa bản ghi, vui lòng thử lại!");
    }
  };

  // 3. THÊM TÀI NGUYÊN (VIDEO / BÀI GIẢNG / VIẾT TAY)
  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resUrl.trim() || !resourceModal) return;

    const newResource = { 
      id: "res-" + Date.now(), 
      title: resTitle.trim(), 
      url: resUrl.trim(), 
      type: resourceModal.type === "video_list" ? vidType : undefined 
    };

    const newChapters = (chapters || []).map((chap: any) => ({ 
      ...chap, 
      lessons: (chap?.lessons || []).map((les: any) => { 
        if (les?.id === resourceModal.lessonId) { 
          return { ...les, [resourceModal.type]: [...(les[resourceModal.type] || []), newResource] }; 
        } 
        return les; 
      }) 
    }));

    await persistChapters(newChapters); 
    setResTitle(""); 
    setResUrl(""); 
    setVidType("lecture");
    if (setResourceModal) setResourceModal(null); 
    if (showToast) showToast("Đã thêm tài nguyên thành công!");
  };

  // 4. XÓA TÀI NGUYÊN TRONG VIEW RESOURCES MODAL
  const handleDeleteResource = async (lessonId: string, resType: string, resId: string) => {
    if (!confirm("Xác nhận xóa tài nguyên này?")) return;
    const newChapters = (chapters || []).map((chap: any) => ({ 
      ...chap, 
      lessons: (chap?.lessons || []).map((les: any) => les?.id === lessonId ? { ...les, [resType]: (les[resType] || []).filter((r: any) => r?.id !== resId) } : les) 
    }));

    await persistChapters(newChapters);
    if (viewResourcesModal && viewResourcesModal.lessonId === lessonId && viewResourcesModal.type === resType && setViewResourcesModal) {
      setViewResourcesModal({
        ...viewResourcesModal,
        items: (viewResourcesModal.items || []).filter((i: any) => i?.id !== resId)
      });
    }
    if (showToast) showToast("Đã xóa tài nguyên!");
  };

  // 5. SỬA TÀI NGUYÊN
  const handleEditResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editResourceModal || !editResourceForm.title.trim()) return;

    const newChapters = (chapters || []).map((chap: any) => ({ 
      ...chap, 
      lessons: (chap?.lessons || []).map((les: any) => { 
        if (les?.id === editResourceModal.lessonId) { 
          return { 
            ...les, 
            [editResourceModal.type]: (les[editResourceModal.type] || []).map((r: any) => 
              r?.id === editResourceModal.item.id ? { 
                ...r, 
                title: editResourceForm.title, 
                url: editResourceForm.url || r.url,
                type: editResourceModal.type === "video_list" ? editResourceForm.type : r.type
              } : r 
            )
          }; 
        } 
        return les; 
      }) 
    }));

    await persistChapters(newChapters);
    setEditResourceModal(null); 
    if (showToast) showToast("Đã cập nhật thông tin tài liệu!");
  };

  // 6. THÊM FILE GOOGLE DRIVE THỦ CÔNG
  const handleAddDriveFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveLinkModal || !driveLinkForm.title.trim() || !driveLinkForm.url.trim()) return;

    const newItem = { 
      id: "drive-" + Date.now(), 
      title: driveLinkForm.title, 
      url: driveLinkForm.url, 
      is_quiz: false, 
      is_drive_file: true 
    };

    const newChapters = (chapters || []).map((chap: any) => ({ 
      ...chap, 
      lessons: (chap?.lessons || []).map((les: any) => { 
        if (les?.id === driveLinkModal.lessonId) { 
          return { ...les, [driveLinkModal.type]: [...(les[driveLinkModal.type] || []), newItem] }; 
        } 
        return les; 
      }) 
    }));

    await persistChapters(newChapters); 
    setDriveLinkModal(null); 
    setDriveLinkForm({ title: "", url: "" }); 
    if (showToast) showToast("Đã đính kèm file Drive!");
  };

  // 7. THÊM TÀI LIỆU TĂNG CƯỜNG
  const handleAddBoost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boostModal || !boostForm.title.trim() || !boostForm.url.trim()) return;

    const newBoost = { id: "boost-" + Date.now(), ...boostForm };
    const newChapters = (chapters || []).map((chap: any) => ({ 
      ...chap, 
      lessons: (chap?.lessons || []).map((les: any) => { 
        if (les?.id === boostModal) { 
          return { ...les, extra_resources: [...(les.extra_resources || []), newBoost] }; 
        } 
        return les; 
      }) 
    }));

    await persistChapters(newChapters); 
    if (setBoostModal) setBoostModal(null); 
    setBoostForm({ title: "", type: "video", url: "", note: "" }); 
    if (showToast) showToast("Đã thêm tài liệu tăng cường!");
  };

  // 8. TẠO CHƯƠNG HOẶC BÀI HỌC MỚI
  const handleCreateNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim() || !createModal) return;

    let newChapters = [...(chapters || [])];
    if (createModal.type === "chapter") {
      newChapters.push({ 
        id: "chap-" + Date.now(), 
        title: newItemTitle.trim(), 
        target_mode: newItemTargetMode, 
        lessons: [] 
      });
    } else if (createModal.type === "lesson" && createModal.chapterId) {
      newChapters = newChapters.map((chap: any) => chap?.id === createModal.chapterId ? {
        ...chap, lessons: [...(chap.lessons || []), {
          id: "les-" + Date.now(), 
          title: newItemTitle.trim(), 
          description: newItemDescription.trim(), 
          duration: 45, 
          format: newItemFormat, 
          target_mode: newItemTargetMode,
          lecture_files: [], 
          homework_files: [], 
          handwritten_notes: [], 
          video_list: [], 
          test_quizzes: [], 
          extra_resources: []
        }]
      } : chap);
    }

    await persistChapters(newChapters); 
    if (setCreateModal) setCreateModal(null); 
    setNewItemTitle(""); 
    setNewItemDescription(""); 
    setNewItemFormat("Zoom");
    setNewItemTargetMode("all");
    if (showToast) showToast("Đã thêm " + (createModal.type === "chapter" ? "chương" : "bài học") + " thành công!");
  };

  // 9. SỬA BÀI HỌC
  const handleEditLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLessonModal || !editLessonForm.title.trim()) return;

    const newChapters = (chapters || []).map((chap: any) => chap?.id === editLessonModal.chapterId ? {
      ...chap, lessons: (chap?.lessons || []).map((les: any) => les?.id === editLessonModal.lesson.id ? { ...les, ...editLessonForm } : les)
    } : chap);

    await persistChapters(newChapters); 
    if (setEditLessonModal) setEditLessonModal(null); 
    if (showToast) showToast("Đã cập nhật thông tin bài học!");
  };

  return (
    <>
      {/* 1. MODAL XEM CHI TIẾT ĐIỂM AZOTA */}
      {azotaScoreViewModal?.isOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && setAzotaScoreViewModal) {
              setAzotaScoreViewModal({ isOpen: false, examTitle: "", attempts: [] });
            }
          }}
          className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
        >
          <div className="bg-white rounded-[24px] max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] cursor-default animate-in zoom-in-95 duration-150 text-left">
            <div className="p-5 sm:p-6 pb-3.5 border-b border-slate-100 flex items-start justify-between relative bg-white">
              <div>
                <span className="px-2.5 py-0.5 bg-blue-50 text-[#1D4ED8] rounded-md text-[10px] font-bold uppercase tracking-wider border border-blue-100">
                  GIAO DIỆN CHẤM THI & QUẢN LÝ ĐIỂM AZOTA
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
                  {azotaScoreViewModal.examTitle}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setAzotaScoreViewModal && setAzotaScoreViewModal({ isOpen: false, examTitle: "", attempts: [] })}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 sm:p-6 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Danh sách lượt nộp bài ({filteredAttempts.length} lượt)
                </span>
              </div>

              <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setFilterMode("all")}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    filterMode === "all" ? "bg-[#1D4ED8] text-white shadow-2xs" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Tất cả ({enhancedAttempts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("online")}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    filterMode === "online" ? "bg-indigo-600 text-white shadow-2xs" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Online ({enhancedAttempts.filter((a: any) => a.resolvedMode === "online").length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode("offline")}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    filterMode === "offline" ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  Offline ({enhancedAttempts.filter((a: any) => a.resolvedMode === "offline").length})
                </button>
              </div>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
              {filteredAttempts.length === 0 ? (
                <div className="py-20 text-center text-slate-400 text-xs font-semibold italic">
                  Chưa có lượt nộp bài nào trong phân hệ này.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  {filteredAttempts.map((att: any, idx: number) => {
                    const displayName = att.resolvedName;
                    const isOffline = att.resolvedMode === "offline";
                    const avatarText = att.resolvedAvatar;
                    const scoreVal = Number(att.score ?? att.points ?? 0);
                    const submitDate = att.createdAt || att.created_at || att.submittedAt;
                    const formattedDate = submitDate ? new Date(submitDate).toLocaleDateString("vi-VN") : "08/10/2026";
                    const formattedTime = submitDate ? new Date(submitDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "10:40";

                    return (
                      <div
                        key={att.id || idx}
                        className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 transition flex flex-col justify-between text-left"
                      >
                        <div>
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-extrabold text-xs text-slate-700 shrink-0 uppercase tracking-tight">
                              {avatarText}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-sm font-bold text-slate-800 truncate max-w-[130px]">
                                  {displayName}
                                </h4>
                                <span className={`text-[10px] px-2 py-0.5 font-bold tracking-wider rounded-md uppercase border ${
                                  isOffline ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                }`}>
                                  {isOffline ? "OFFLINE" : "ONLINE"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-sm font-extrabold text-rose-600">
                                  Điểm: {scoreVal.toFixed(2)}
                                </span>
                                <span className="text-[11px] font-medium text-slate-400">
                                  (Lần thi: {att.attemptIndex || 1})
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteAttempt(att.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title="Xóa vĩnh viễn lượt làm bài này"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-1.5 text-xs text-slate-500 font-medium pt-1 border-t border-slate-100/80">
                            <div className="flex items-center justify-between">
                              <span>Thời gian làm bài:</span>
                              <span className="text-slate-800 font-semibold">{att.timeSpent || att.time_spent || "15 phút"}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span>Thời gian nộp bài:</span>
                              <span className="text-slate-800 font-semibold">{formattedTime} {formattedDate}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
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
                                  supabase.from("exam_attempts").update({ feedback: note }).eq("id", att.id).then(() => {
                                    if (showToast) showToast("Đã lưu nhận xét!", "success");
                                  });
                                }
                              }
                            }}
                            className="p-1 text-[#1D4ED8] hover:bg-blue-50 rounded-md transition cursor-pointer"
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
      )}

      {/* 2. MODAL THÊM TÀI NGUYÊN (VIDEO / BÀI GIẢNG / VIẾT TAY) */}
      {resourceModal && (
        <div 
          onClick={() => setResourceModal && setResourceModal(null)} 
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl w-full max-w-md p-6 shadow-xl cursor-default text-left">
            <h3 className="font-bold text-[15px] mb-4 text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              {resourceModal.type === "video_list" ? <Video className="w-4 h-4 text-blue-600" /> : <FileText className="w-4 h-4 text-indigo-600" />}
              <span>Thêm {resourceModal.type === "video_list" ? "Video" : "Tài liệu"} cho {resourceModal.lessonTitle}</span>
            </h3>
            <form onSubmit={handleAddResource} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề hiển thị *</label>
                <input 
                  required 
                  value={resTitle} 
                  onChange={e => setResTitle(e.target.value)} 
                  placeholder={resourceModal.type === "video_list" ? "VD: Video bài giảng phần 1" : "VD: Tài liệu viết tay"} 
                  className="w-full border border-slate-300 p-2.5 rounded-xl focus:border-[#1D4ED8] outline-none text-sm"
                />
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
                <input 
                  required 
                  type="url" 
                  value={resUrl} 
                  onChange={e => setResUrl(e.target.value)} 
                  placeholder="https://..." 
                  className="w-full border border-slate-300 p-2.5 rounded-xl focus:border-[#1D4ED8] outline-none text-sm"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button type="button" onClick={() => setResourceModal && setResourceModal(null)} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-xl text-xs font-bold cursor-pointer">
                  Hủy
                </button>
                <button type="submit" className="bg-[#1D4ED8] hover:bg-[#1E40AF] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm cursor-pointer">
                  Lưu tài nguyên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. MODAL XEM CHI TIẾT TÀI NGUYÊN (VIEW RESOURCES MODAL) */}
      {viewResourcesModal && (
        <div 
          onClick={() => setViewResourcesModal && setViewResourcesModal(null)}
          className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200 cursor-default text-left">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2">
                Danh sách {viewResourcesModal.title} ({(viewResourcesModal.items || []).length})
              </h3>
              <button onClick={() => setViewResourcesModal && setViewResourcesModal(null)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition cursor-pointer">
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
                            <span className={"px-2 py-0.5 text-[9px] font-black uppercase rounded-md tracking-wider " + (
                              item.type === "homework_solution"
                                ? "bg-amber-100 text-amber-800 border border-amber-300"
                                : "bg-blue-100 text-blue-800 border border-blue-300"
                            )}>
                              {item.type === "homework_solution" ? "Chữa BTVN" : "Bài Giảng"}
                            </span>
                          )}
                          {item.is_drive_file && <span className="px-2 py-0.5 text-[9px] bg-indigo-100 text-indigo-700 font-bold uppercase rounded-md shrink-0">Drive</span>}
                          {viewResourcesModal.type === 'extra_resources' && <span className="px-2 py-0.5 text-[9px] bg-amber-100 text-amber-700 font-bold uppercase rounded-md shrink-0">Tăng cường</span>}
                        </div>
                        {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-500 hover:underline truncate block mt-1">{item.url}</a>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => {
                          setEditResourceModal({ lessonId: viewResourcesModal.lessonId, type: viewResourcesModal.type, item });
                          setEditResourceForm({ title: item.title, url: item.url || "", type: item.type || "lecture" });
                        }} className="p-2 text-slate-300 hover:text-[#1D4ED8] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer shrink-0">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteResource(viewResourcesModal.lessonId, viewResourcesModal.type, item.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0">
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
                onClick={() => {
                  const currentType = viewResourcesModal.type;
                  const currentLessonId = viewResourcesModal.lessonId;
                  setViewResourcesModal && setViewResourcesModal(null);

                  if (currentType === 'homework_files' || currentType === 'test_quizzes') {
                    if (setUploadMethodModal) setUploadMethodModal({ lessonId: currentLessonId, type: currentType as any });
                  } else if (currentType === 'extra_resources') {
                    if (setBoostModal) setBoostModal(currentLessonId);
                  } else {
                    if (setResourceModal) setResourceModal({ isOpen: true, lessonId: currentLessonId, lessonTitle: "bài học", type: currentType });
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

      {/* 4. MODAL SỬA TÀI NGUYÊN (EDIT RESOURCE MODAL) */}
      {editResourceModal && (
        <div 
          onClick={() => setEditResourceModal(null)} 
          className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        >
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleEditResourceSubmit} className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 cursor-default text-left">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2"><Edit3 className="w-5 h-5 text-[#1D4ED8]" /> Sửa thông tin tài liệu</h3>
              <button type="button" onClick={() => setEditResourceModal(null)} className="text-slate-400 hover:text-rose-500 cursor-pointer"><X className="w-5 h-5"/></button>
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

              {(!editResourceModal.item?.is_quiz || editResourceModal.item?.is_drive_file) && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Đường dẫn (URL / Link Drive / YouTube)</label>
                  <input required type="url" value={editResourceForm.url} onChange={e => setEditResourceForm({...editResourceForm, url: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none" />
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end pt-5 mt-5 border-t border-slate-100">
              <button type="button" onClick={() => setEditResourceModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Hủy</button>
              <button type="submit" className="px-5 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer">Lưu thay đổi</button>
            </div>
          </form>
        </div>
      )}

      {/* 5. MODAL CHỌN PHƯƠNG THỨC THÊM BTVN / ĐỀ KIỂM TRA */}
      {uploadMethodModal && (
        <div 
          onClick={() => setUploadMethodModal && setUploadMethodModal(null)} 
          className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 cursor-pointer"
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-[28px] p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 cursor-default text-left">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  Thêm {uploadMethodModal.type === 'homework_files' ? 'Bài tập về nhà (BTVN)' : 'Đề Kiểm Tra'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Chọn phương thức nạp đề thi để hệ thống tự động bóc tách</p>
              </div>
              <button type="button" onClick={() => setUploadMethodModal && setUploadMethodModal(null)} className="text-slate-400 hover:text-rose-500 cursor-pointer p-1"><X className="w-5 h-5"/></button>
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
                    if (setTestFile) setTestFile(e.target.files[0]);
                    if (setUploadMode) setUploadMode("course");
                    if (setAzotaTarget) setAzotaTarget({ lessonId: uploadMethodModal.lessonId, type: uploadMethodModal.type });
                    if (setUploadMethodModal) setUploadMethodModal(null);
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
                    if (setTestFile) setTestFile(e.target.files[0]);
                    if (setUploadMode) setUploadMode("course");
                    if (setAzotaTarget) setAzotaTarget({ lessonId: uploadMethodModal.lessonId, type: uploadMethodModal.type });
                    if (setUploadMethodModal) setUploadMethodModal(null);
                  }
                  e.target.value = '';
                }}/>
              </label>
              
              <button 
                type="button"
                onClick={() => { 
                  setDriveLinkModal(uploadMethodModal); 
                  if (setUploadMethodModal) setUploadMethodModal(null); 
                }} 
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

      {/* 6. MODAL ĐÍNH KÈM LINK DRIVE CHO BTVN / ĐỀ KIỂM TRA */}
      {driveLinkModal && (
        <div 
          onClick={() => setDriveLinkModal(null)} 
          className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 cursor-pointer"
        >
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleAddDriveFile} className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 cursor-default text-left">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-emerald-700 text-[15px] flex items-center gap-2"><LinkIcon className="w-5 h-5" /> Đính kèm Link Google Drive</h3>
              <button type="button" onClick={() => setDriveLinkModal(null)} className="text-slate-400 hover:text-rose-500 cursor-pointer"><X className="w-5 h-5"/></button>
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
              <button type="button" onClick={() => setDriveLinkModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Hủy</button>
              <button type="submit" className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer">Lưu file Drive</button>
            </div>
          </form>
        </div>
      )}

      {/* 7. MODAL THÊM TÀI LIỆU TĂNG CƯỜNG (BOOST MODAL) */}
      {boostModal && (
        <div 
          onClick={() => setBoostModal && setBoostModal(null)} 
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        >
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleAddBoost} className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 cursor-default text-left">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-amber-600 text-[15px] flex items-center gap-2"><Zap className="w-5 h-5 fill-amber-500" /> Thêm tài liệu tăng cường</h3>
              <button type="button" onClick={() => setBoostModal && setBoostModal(null)} className="text-slate-400 hover:text-rose-500 cursor-pointer"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tiêu đề</label>
                <input required type="text" value={boostForm.title} onChange={e => setBoostForm({...boostForm, title: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-amber-500 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Loại tài liệu</label>
                <select value={boostForm.type} onChange={e => setBoostForm({...boostForm, type: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-amber-500 outline-none bg-white cursor-pointer">
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
              <button type="button" onClick={() => setBoostModal && setBoostModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Hủy</button>
              <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer">Lưu tăng cường</button>
            </div>
          </form>
        </div>
      )}

      {/* 8. MODAL THÊM CHƯƠNG / BÀI HỌC MỚI (CREATE MODAL) */}
      {createModal && (
        <div 
          onClick={() => setCreateModal && setCreateModal(null)} 
          className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-xl cursor-pointer"
        >
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleCreateNewItem} className="bg-white/95 backdrop-blur-2xl rounded-[32px] w-full max-w-md p-8 shadow-2xl border border-white/50 space-y-5 cursor-default text-left">
            <h3 className="font-extrabold text-slate-900 text-[17px] border-b border-slate-200/60 pb-4 mb-5 tracking-tight">
              {createModal.type === "chapter" ? "Thêm Chương Mới" : "Thêm Bài Học Mới"}
            </h3>
            
            {createModal.type === "lesson" && (
              <div>
                <label className="block text-[13px] font-bold text-slate-700 mb-2">Chọn chương chứa bài học <span className="text-rose-500">*</span></label>
                <select 
                  value={createModal.chapterId || ""} 
                  onChange={e => setCreateModal && setCreateModal({ ...createModal, chapterId: e.target.value })}
                  className="w-full px-5 py-3 border border-slate-300 rounded-2xl text-[13px] font-semibold outline-none focus:border-[#1D4ED8] transition-all shadow-sm bg-white cursor-pointer"
                >
                  {(chapters || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[13px] font-bold text-slate-700 mb-2">Tên {createModal.type === "chapter" ? "chương" : "bài học"} <span className="text-rose-500">*</span></label>
              <input autoFocus required type="text" value={newItemTitle} onChange={e => setNewItemTitle(e.target.value)} placeholder={createModal.type === "chapter" ? "VD: Chương 1: Ứng dụng đạo hàm..." : "VD: Bài 1: Tính đơn điệu của hàm số..."} className="w-full px-5 py-3 border border-slate-300 rounded-2xl text-[13px] font-semibold outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] transition-all shadow-sm" />
            </div>
            
            {createModal.type === "lesson" && (
              <>
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-2">Phân luồng bài học (Target Mode) *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewItemTargetMode("online")}
                      className={"py-2.5 px-3 rounded-xl text-xs font-black border transition cursor-pointer " + (
                        newItemTargetMode === "online"
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Lớp Online
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewItemTargetMode("offline")}
                      className={"py-2.5 px-3 rounded-xl text-xs font-black border transition cursor-pointer " + (
                        newItemTargetMode === "offline"
                          ? "bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Lớp Offline
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewItemTargetMode("all")}
                      className={"py-2.5 px-3 rounded-xl text-xs font-black border transition cursor-pointer " + (
                        newItemTargetMode === "all"
                          ? "bg-blue-50 border-blue-500 text-[#1D4ED8] ring-2 ring-blue-500/20 shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      Cả 2 (Full)
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-slate-700 mb-2">Hình thức giảng dạy</label>
                  <select value={newItemFormat} onChange={e => setNewItemFormat(e.target.value)} className="w-full px-5 py-3 border border-slate-300 rounded-2xl text-[13px] outline-none focus:border-[#1D4ED8] transition-all shadow-sm bg-white cursor-pointer">
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
              <button type="button" onClick={() => setCreateModal && setCreateModal(null)} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 rounded-2xl text-[13px] font-bold text-slate-700 transition-colors cursor-pointer">Hủy</button>
              <button type="submit" className="px-6 py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-2xl text-[13px] font-bold shadow-md transition-colors cursor-pointer">Thêm mới</button>
            </div>
          </form>
        </div>
      )}

      {/* 9. MODAL CHỈNH SỬA THÔNG TIN BÀI HỌC (EDIT LESSON MODAL) */}
      {editLessonModal && editLessonForm && (
        <div 
          onClick={() => setEditLessonModal && setEditLessonModal(null)} 
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm cursor-pointer"
        >
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleEditLessonSubmit} className="bg-white rounded-[24px] w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200 cursor-default text-left">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-[15px] flex items-center gap-2"><Edit3 className="w-5 h-5 text-[#1D4ED8]" /> Chỉnh sửa bài học</h3>
              <button type="button" onClick={() => setEditLessonModal && setEditLessonModal(null)} className="text-slate-400 hover:text-rose-500 cursor-pointer"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tiêu đề bài học</label>
                <input required type="text" value={editLessonForm.title} onChange={e => setEditLessonForm && setEditLessonForm({...editLessonForm, title: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Phân luồng bài học (Target Mode) *</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditLessonForm && setEditLessonForm({ ...editLessonForm, target_mode: "online" })}
                    className={"py-2 px-3 rounded-xl text-xs font-black border transition cursor-pointer " + (
                      editLessonForm.target_mode === "online"
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-500/20 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    Lớp Online
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditLessonForm && setEditLessonForm({ ...editLessonForm, target_mode: "offline" })}
                    className={"py-2 px-3 rounded-xl text-xs font-black border transition cursor-pointer " + (
                      editLessonForm.target_mode === "offline"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    Lớp Offline
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditLessonForm && setEditLessonForm({ ...editLessonForm, target_mode: "all" })}
                    className={"py-2 px-3 rounded-xl text-xs font-black border transition cursor-pointer " + (
                      editLessonForm.target_mode === "all" || !editLessonForm.target_mode
                        ? "bg-blue-50 border-blue-500 text-[#1D4ED8] ring-2 ring-blue-500/20 shadow-xs"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    Cả 2 (Full)
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Thời lượng (phút)</label>
                  <input required type="number" value={editLessonForm.duration} onChange={e => setEditLessonForm && setEditLessonForm({...editLessonForm, duration: parseInt(e.target.value) || 0})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Hình thức</label>
                  <select value={editLessonForm.format} onChange={e => setEditLessonForm && setEditLessonForm({...editLessonForm, format: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none bg-white cursor-pointer">
                    <option value="Zoom">Zoom</option>
                    <option value="Facebook">Facebook Group</option>
                    <option value="Video">Video quay sẵn</option>
                    <option value="Tự học">Tự học</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Mô tả</label>
                <textarea rows={2} value={editLessonForm.description} onChange={e => setEditLessonForm && setEditLessonForm({...editLessonForm, description: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-5 mt-5 border-t border-slate-100">
              <button type="button" onClick={() => setEditLessonModal && setEditLessonModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Hủy</button>
              <button type="submit" className="px-5 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer">Lưu thay đổi</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
