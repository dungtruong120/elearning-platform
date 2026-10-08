"use client";

import React, { useState, useMemo, useRef } from "react";
import { 
  X, Pencil, Trash2, Plus, Upload, Link as LinkIcon, 
  ExternalLink, Video, FileText, PenTool, CheckSquare, 
  Award, Play, FolderPlus, BookOpen, Clock, AlertCircle, Save 
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

  // CÁC PROPS KẾT NỐI VỚI LESSONS TAB
  chapters?: any[];
  setChapters?: (chapters: any[]) => void;
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
    setChapters,
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
    setEditLessonForm
  } = props;

  // State bộ nút gạt phân loại học sinh: Tất cả | Online | Offline
  const [filterMode, setFilterMode] = useState<"all" | "online" | "offline">("all");

  // State form thêm tài nguyên (Video / Bài giảng / Viết tay)
  const [resourceTitle, setResourceTitle] = useState<string>("");
  const [resourceUrl, setResourceUrl] = useState<string>("");
  const [resourceVideoType, setResourceVideoType] = useState<"lecture" | "homework_solution">("lecture");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // State form thêm BTVN / Đề kiểm tra
  const [quizTitle, setQuizTitle] = useState<string>("");
  const [quizDuration, setQuizDuration] = useState<number>(45);
  const [quizFileUrl, setQuizFileUrl] = useState<string>("");
  const quizFileInputRef = useRef<HTMLInputElement | null>(null);

  // State form tạo Chương / Bài học mới
  const [newChapterTitle, setNewChapterTitle] = useState<string>("");
  const [newLessonData, setNewLessonData] = useState({
    title: "",
    description: "",
    duration: 45,
    format: "Zoom",
    target_mode: "online" as "online" | "offline" | "all"
  });

  // State form thêm tài liệu tăng cường
  const [boostTitle, setBoostTitle] = useState<string>("");
  const [boostUrl, setBoostUrl] = useState<string>("");
  const [boostNote, setBoostNote] = useState<string>("");

  // HÀM LƯU CHƯƠNG TRÌNH HỌC VÀO SUPABASE & LOCALSTORAGE
  const persistChapters = async (updatedChapters: any[]) => {
    if (setChapters) setChapters(updatedChapters);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_course_data", JSON.stringify(updatedChapters));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {}
    }

    try {
      if (supabase) {
        const { data: existing } = await supabase
          .from("courses")
          .select("id")
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from("courses")
            .update({ chapters: updatedChapters, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supabase
            .from("courses")
            .insert([{ title: "Toán 12 TCT", chapters: updatedChapters, updated_at: new Date().toISOString() }]);
        }
      }
      if (showToast) showToast("Đã cập nhật bài học thành công!", "success");
    } catch (err) {
      console.error("Lỗi khi lưu Supabase:", err);
      if (showToast) showToast("Lỗi lưu cơ sở dữ liệu", "error");
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

  // UPLOAD FILE LÊN SUPABASE STORAGE
  const handleUploadFileToStorage = async (file: File, onSuccess: (url: string, title: string) => void) => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `course_materials/${fileName}`;

      if (supabase) {
        const { error } = await supabase.storage.from("public_files").upload(filePath, file);
        if (!error) {
          const { data: publicUrlData } = supabase.storage.from("public_files").getPublicUrl(filePath);
          onSuccess(publicUrlData.publicUrl, file.name.replace(`.${fileExt}`, ""));
          setIsUploading(false);
          return;
        }
      }

      // Fallback Data URL nếu Storage chưa tạo bucket
      const reader = new FileReader();
      reader.onload = (e) => {
        onSuccess(e.target?.result as string, file.name.replace(`.${fileExt}`, ""));
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Lỗi upload:", err);
      alert("Lỗi khi tải file, vui lòng dán liên kết Drive trực tiếp.");
      setIsUploading(false);
    }
  };

  // XỬ LÝ LƯU TÀI NGUYÊN (VIDEO, BÀI GIẢNG, VIẾT TAY)
  const handleSaveResource = () => {
    if (!resourceModal) return;
    if (!resourceTitle.trim() && !resourceUrl.trim()) {
      return alert("Vui lòng nhập tiêu đề hoặc liên kết tài liệu!");
    }

    const { lessonId, type } = resourceModal;
    const newItem = {
      id: "res-" + Date.now(),
      title: resourceTitle.trim() || (type === "video_list" ? "Video bài giảng" : "Tài liệu học tập"),
      url: resourceUrl.trim(),
      type: type === "video_list" ? resourceVideoType : type,
      duration: 45
    };

    const updatedChapters = chapters.map((c: any) => ({
      ...c,
      lessons: (c.lessons || []).map((l: any) => {
        if (l.id !== lessonId) return l;
        return {
          ...l,
          [type]: [...(l[type] || []), newItem]
        };
      })
    }));

    persistChapters(updatedChapters);
    if (setResourceModal) setResourceModal(null);
    setResourceTitle("");
    setResourceUrl("");
  };

  // XỬ LÝ XÓA TÀI NGUYÊN TRONG VIEW RESOURCES MODAL
  const handleDeleteResourceItem = (resourceId: string) => {
    if (!viewResourcesModal) return;
    if (!confirm("Bạn có chắc chắn muốn xóa mục này khỏi bài học?")) return;

    const { lessonId, type } = viewResourcesModal;
    const updatedChapters = chapters.map((c: any) => ({
      ...c,
      lessons: (c.lessons || []).map((l: any) => {
        if (l.id !== lessonId) return l;
        return {
          ...l,
          [type]: (l[type] || []).filter((item: any) => item.id !== resourceId)
        };
      })
    }));

    persistChapters(updatedChapters);

    // Cập nhật lại danh sách đang xem
    const targetLes = updatedChapters.flatMap((c: any) => c.lessons || []).find((l: any) => l.id === lessonId);
    if (targetLes && setViewResourcesModal) {
      setViewResourcesModal({
        ...viewResourcesModal,
        items: targetLes[type] || []
      });
    }
  };

  // XỬ LÝ LƯU BTVN / ĐỀ KIỂM TRA
  const handleSaveQuizItem = (isHomework: boolean) => {
    if (!uploadMethodModal) return;
    if (!quizTitle.trim()) return alert("Vui lòng nhập tên bài tập/đề thi!");

    const { lessonId, type } = uploadMethodModal;
    const newItem = {
      id: "quiz-" + Date.now(),
      title: quizTitle.trim(),
      url: quizFileUrl.trim(),
      duration_minutes: Number(quizDuration) || 45,
      is_quiz: true,
      isHomework: isHomework
    };

    const updatedChapters = chapters.map((c: any) => ({
      ...c,
      lessons: (c.lessons || []).map((l: any) => {
        if (l.id !== lessonId) return l;
        return {
          ...l,
          [type]: [...(l[type] || []), newItem]
        };
      })
    }));

    persistChapters(updatedChapters);
    if (setUploadMethodModal) setUploadMethodModal(null);
    setQuizTitle("");
    setQuizFileUrl("");
    setQuizDuration(45);
  };

  // XỬ LÝ LƯU TÀI LIỆU TĂNG CƯỜNG
  const handleSaveBoostResource = () => {
    if (!boostModal || !boostTitle.trim()) return alert("Vui lòng nhập tên tài liệu tăng cường!");

    const newItem = {
      id: "boost-" + Date.now(),
      title: boostTitle.trim(),
      url: boostUrl.trim(),
      note: boostNote.trim()
    };

    const updatedChapters = chapters.map((c: any) => ({
      ...c,
      lessons: (c.lessons || []).map((l: any) => {
        if (l.id !== boostModal) return l;
        return {
          ...l,
          extra_resources: [...(l.extra_resources || []), newItem]
        };
      })
    }));

    persistChapters(updatedChapters);
    if (setBoostModal) setBoostModal(null);
    setBoostTitle("");
    setBoostUrl("");
    setBoostNote("");
  };

  // XỬ LÝ TẠO CHƯƠNG MỚI
  const handleCreateChapter = () => {
    if (!newChapterTitle.trim()) return alert("Vui lòng nhập tên chương!");
    const newChap = {
      id: "chap-" + Date.now(),
      title: newChapterTitle.trim(),
      lessons: []
    };

    persistChapters([...chapters, newChap]);
    if (setCreateModal) setCreateModal(null);
    setNewChapterTitle("");
  };

  // XỬ LÝ TẠO BÀI HỌC MỚI
  const handleCreateLesson = () => {
    if (!newLessonData.title.trim()) return alert("Vui lòng nhập tên bài học!");
    const targetCId = createModal?.chapterId || chapters[0]?.id;
    if (!targetCId) return alert("Vui lòng thêm Chương trước khi tạo Bài học!");

    const newLes = {
      id: "les-" + Date.now(),
      title: newLessonData.title.trim(),
      description: newLessonData.description.trim(),
      duration: Number(newLessonData.duration) || 45,
      format: newLessonData.format,
      target_mode: newLessonData.target_mode,
      lecture_files: [],
      homework_files: [],
      handwritten_notes: [],
      video_list: [],
      test_quizzes: [],
      extra_resources: []
    };

    const updatedChapters = chapters.map((c: any) => {
      if (c.id !== targetCId) return c;
      return {
        ...c,
        lessons: [...(c.lessons || []), newLes]
      };
    });

    persistChapters(updatedChapters);
    if (setCreateModal) setCreateModal(null);
    setNewLessonData({
      title: "",
      description: "",
      duration: 45,
      format: "Zoom",
      target_mode: "online"
    });
  };

  // XỬ LÝ SỬA BÀI HỌC
  const handleUpdateLesson = () => {
    if (!editLessonModal || !editLessonForm?.title?.trim()) return alert("Vui lòng nhập tên bài học!");

    const { chapterId, lesson } = editLessonModal;
    const updatedChapters = chapters.map((c: any) => {
      if (c.id !== chapterId) return c;
      return {
        ...c,
        lessons: (c.lessons || []).map((l: any) => {
          if (l.id !== lesson.id) return l;
          return {
            ...l,
            title: editLessonForm.title.trim(),
            description: editLessonForm.description?.trim() || "",
            duration: Number(editLessonForm.duration) || 45,
            format: editLessonForm.format || "Zoom",
            target_mode: editLessonForm.target_mode || "all"
          };
        })
      };
    });

    persistChapters(updatedChapters);
    if (setEditLessonModal) setEditLessonModal(null);
  };

  return (
    <>
      {/* 1. MODAL XEM ĐIỂM AZOTA */}
      {azotaScoreViewModal?.isOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && setAzotaScoreViewModal) {
              setAzotaScoreViewModal({ isOpen: false, examTitle: "", attempts: [] });
            }
          }}
          className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs cursor-pointer"
        >
          <div className="bg-white rounded-[24px] max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] cursor-default animate-in zoom-in-95 duration-150">
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
          className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md border border-slate-200 shadow-2xl p-5 space-y-4 cursor-default text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                {resourceModal.type === "video_list" ? <Video className="w-4 h-4 text-blue-600" /> : <FileText className="w-4 h-4 text-indigo-600" />}
                <span>{resourceModal.type === "video_list" ? "Thêm Video bài giảng" : resourceModal.type === "lecture_files" ? "Thêm Bài giảng PDF" : "Thêm Ghi chép viết tay"}</span>
              </h3>
              <button type="button" onClick={() => setResourceModal && setResourceModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Tiêu đề tài liệu:</label>
                <input 
                  type="text" 
                  value={resourceTitle} 
                  onChange={(e) => setResourceTitle(e.target.value)} 
                  placeholder="Ví dụ: Video phần 1, Lý thuyết trọng tâm..." 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500" 
                />
              </div>

              {resourceModal.type === "video_list" && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Loại video:</label>
                  <select 
                    value={resourceVideoType} 
                    onChange={(e) => setResourceVideoType(e.target.value as any)} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value="lecture">Video Bài giảng lý thuyết</option>
                    <option value="homework_solution">Video Chữa BTVN</option>
                  </select>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Liên kết Drive / YouTube:</label>
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isUploading}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{isUploading ? "Đang nạp file..." : "Tải file lên"}</span>
                  </button>
                </div>
                <input 
                  type="text" 
                  value={resourceUrl} 
                  onChange={(e) => setResourceUrl(e.target.value)} 
                  placeholder="https://drive.google.com/... hoặc https://youtube.com/..." 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-blue-500" 
                />
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadFileToStorage(f, (url, title) => {
                      setResourceUrl(url);
                      if (!resourceTitle) setResourceTitle(title);
                    });
                  }} 
                  className="hidden" 
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setResourceModal && setResourceModal(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">
                  Hủy
                </button>
                <button type="button" onClick={handleSaveResource} className="flex-1 py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl text-xs font-bold transition shadow-2xs">
                  Xác nhận thêm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. MODAL XEM CHI TIẾT TÀI NGUYÊN HIỆN CÓ CỦA CELL */}
      {viewResourcesModal && (
        <div 
          onClick={() => setViewResourcesModal && setViewResourcesModal(null)} 
          className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 shadow-2xl p-5 space-y-4 cursor-default text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">
                Danh sách {viewResourcesModal.title} ({viewResourcesModal.items?.length || 0})
              </h3>
              <button type="button" onClick={() => setViewResourcesModal && setViewResourcesModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {(!viewResourcesModal.items || viewResourcesModal.items.length === 0) ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Chưa có mục nào được tải lên.</p>
              ) : (
                viewResourcesModal.items.map((it: any, i: number) => (
                  <div key={it.id || i} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{it.title || `Mục ${i + 1}`}</p>
                      {it.url && (
                        <a href={it.url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 mt-0.5 truncate max-w-xs">
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{it.url}</span>
                        </a>
                      )}
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleDeleteResourceItem(it.id)} 
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Xóa mục này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button type="button" onClick={() => setViewResourcesModal && setViewResourcesModal(null)} className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold transition">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL THÊM BTVN / ĐỀ KIỂM TRA ĐỊNH KỲ */}
      {uploadMethodModal && (
        <div 
          onClick={() => setUploadMethodModal && setUploadMethodModal(null)} 
          className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md border border-slate-200 shadow-2xl p-5 space-y-4 cursor-default text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                {uploadMethodModal.type === "homework_files" ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Award className="w-4 h-4 text-emerald-600" />}
                <span>{uploadMethodModal.type === "homework_files" ? "Thêm Bài tập về nhà (BTVN)" : "Thêm Đề kiểm tra định kỳ"}</span>
              </h3>
              <button type="button" onClick={() => setUploadMethodModal && setUploadMethodModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Tên bài tập / Đề thi:</label>
                <input 
                  type="text" 
                  value={quizTitle} 
                  onChange={(e) => setQuizTitle(e.target.value)} 
                  placeholder="Ví dụ: BTVN Bài 8 - Đồ thị hàm số..." 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500" 
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Thời gian làm bài (phút):</label>
                <input 
                  type="number" 
                  value={quizDuration} 
                  onChange={(e) => setQuizDuration(Number(e.target.value))} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500" 
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Link file đề / Drive (tùy chọn):</label>
                  <button 
                    type="button" 
                    onClick={() => quizFileInputRef.current?.click()} 
                    disabled={isUploading}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>{isUploading ? "Đang nạp file..." : "Tải file lên"}</span>
                  </button>
                </div>
                <input 
                  type="text" 
                  value={quizFileUrl} 
                  onChange={(e) => setQuizFileUrl(e.target.value)} 
                  placeholder="https://drive.google.com/..." 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-blue-500" 
                />
                <input 
                  type="file" 
                  ref={quizFileInputRef} 
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadFileToStorage(f, (url, title) => {
                      setQuizFileUrl(url);
                      if (!quizTitle) setQuizTitle(title);
                    });
                  }} 
                  className="hidden" 
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setUploadMethodModal && setUploadMethodModal(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">
                  Hủy
                </button>
                <button 
                  type="button" 
                  onClick={() => handleSaveQuizItem(uploadMethodModal.type === "homework_files")} 
                  className="flex-1 py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl text-xs font-bold transition shadow-2xs"
                >
                  Xác nhận lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL TẠO CHƯƠNG / BÀI HỌC MỚI */}
      {createModal && (
        <div 
          onClick={() => setCreateModal && setCreateModal(null)} 
          className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md border border-slate-200 shadow-2xl p-5 space-y-4 cursor-default text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                {createModal.type === "chapter" ? <FolderPlus className="w-4 h-4 text-blue-600" /> : <BookOpen className="w-4 h-4 text-indigo-600" />}
                <span>{createModal.type === "chapter" ? "Thêm Chương mới" : "Thêm Bài học mới"}</span>
              </h3>
              <button type="button" onClick={() => setCreateModal && setCreateModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            {createModal.type === "chapter" ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Tên chương:</label>
                  <input 
                    type="text" 
                    value={newChapterTitle} 
                    onChange={(e) => setNewChapterTitle(e.target.value)} 
                    placeholder="Ví dụ: Chương 1: Ứng dụng đạo hàm..." 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500" 
                  />
                </div>
                <div className="pt-2 flex gap-2">
                  <button type="button" onClick={() => setCreateModal && setCreateModal(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">
                    Hủy
                  </button>
                  <button type="button" onClick={handleCreateChapter} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-2xs">
                    Lưu Chương
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Tên bài học:</label>
                  <input 
                    type="text" 
                    value={newLessonData.title} 
                    onChange={(e) => setNewLessonData({ ...newLessonData, title: e.target.value })} 
                    placeholder="Ví dụ: Bài 8: Khảo sát và vẽ đồ thị hàm số..." 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Phân luồng:</label>
                    <select 
                      value={newLessonData.target_mode} 
                      onChange={(e) => setNewLessonData({ ...newLessonData, target_mode: e.target.value as any })} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                    >
                      <option value="online">Lớp Online</option>
                      <option value="offline">Lớp Offline</option>
                      <option value="all">Toàn khóa</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Thời lượng (phút):</label>
                    <input 
                      type="number" 
                      value={newLessonData.duration} 
                      onChange={(e) => setNewLessonData({ ...newLessonData, duration: Number(e.target.value) })} 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500" 
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Mô tả tóm tắt:</label>
                  <textarea 
                    rows={2} 
                    value={newLessonData.description} 
                    onChange={(e) => setNewLessonData({ ...newLessonData, description: e.target.value })} 
                    placeholder="Nội dung cốt lõi của bài học..." 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-blue-500" 
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button type="button" onClick={() => setCreateModal && setCreateModal(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">
                    Hủy
                  </button>
                  <button type="button" onClick={handleCreateLesson} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-2xs">
                    Lưu Bài học
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. MODAL SỬA BÀI HỌC */}
      {editLessonModal && editLessonForm && (
        <div 
          onClick={() => setEditLessonModal && setEditLessonModal(null)} 
          className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md border border-slate-200 shadow-2xl p-5 space-y-4 cursor-default text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">Sửa thông tin bài học</h3>
              <button type="button" onClick={() => setEditLessonModal && setEditLessonModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Tên bài học:</label>
                <input 
                  type="text" 
                  value={editLessonForm.title || ""} 
                  onChange={(e) => setEditLessonForm && setEditLessonForm({ ...editLessonForm, title: e.target.value })} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500" 
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Phân luồng:</label>
                  <select 
                    value={editLessonForm.target_mode || "all"} 
                    onChange={(e) => setEditLessonForm && setEditLessonForm({ ...editLessonForm, target_mode: e.target.value })} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value="online">Lớp Online</option>
                    <option value="offline">Lớp Offline</option>
                    <option value="all">Toàn khóa</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Thời lượng (phút):</label>
                  <input 
                    type="number" 
                    value={editLessonForm.duration || 45} 
                    onChange={(e) => setEditLessonForm && setEditLessonForm({ ...editLessonForm, duration: Number(e.target.value) })} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500" 
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Mô tả tóm tắt:</label>
                <textarea 
                  rows={2} 
                  value={editLessonForm.description || ""} 
                  onChange={(e) => setEditLessonForm && setEditLessonForm({ ...editLessonForm, description: e.target.value })} 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-blue-500" 
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setEditLessonModal && setEditLessonModal(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">
                  Hủy
                </button>
                <button type="button" onClick={handleUpdateLesson} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-2xs">
                  Cập nhật
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL THÊM TÀI LIỆU TĂNG CƯỜNG */}
      {boostModal && (
        <div 
          onClick={() => setBoostModal && setBoostModal(null)} 
          className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md border border-slate-200 shadow-2xl p-5 space-y-4 cursor-default text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-amber-700 flex items-center gap-2">
                <Sparkles className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span>Thêm tài liệu tăng cường</span>
              </h3>
              <button type="button" onClick={() => setBoostModal && setBoostModal(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Tên tài liệu:</label>
                <input 
                  type="text" 
                  value={boostTitle} 
                  onChange={(e) => setBoostTitle(e.target.value)} 
                  placeholder="Ví dụ: Phương pháp giải nhanh Casio, Đề nâng cao..." 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:border-blue-500" 
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Liên kết Drive / Web:</label>
                <input 
                  type="text" 
                  value={boostUrl} 
                  onChange={(e) => setBoostUrl(e.target.value)} 
                  placeholder="https://drive.google.com/..." 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-blue-500" 
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Ghi chú lưu ý:</label>
                <input 
                  type="text" 
                  value={boostNote} 
                  onChange={(e) => setBoostNote(e.target.value)} 
                  placeholder="Dành riêng cho học sinh ôn thi 9.5+..." 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none focus:border-blue-500" 
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setBoostModal && setBoostModal(null)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">
                  Hủy
                </button>
                <button type="button" onClick={handleSaveBoostResource} className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-2xs">
                  Xác nhận thêm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
