"use client";

import React, { useState, useRef, useMemo } from "react";
import {
  Layers,
  BookOpen,
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
  Filter,
  Lock,
  Unlock,
  Calculator,
  Compass,
  Sparkles,
  Zap,
  GraduationCap
} from "lucide-react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";

const AzotaExamConfigModal = dynamic<any>(
  () =>
    import("@/app/admin/AzotaExamConfigModal").then(
      (mod: any) => mod.AzotaExamConfigModal || mod.default || mod
    ),
  { ssr: false }
);

export type SubjectCategoryKey = "dai" | "hinh" | "tong_on" | "tang_cuong" | "hsa";

export const SUBJECT_CATEGORY_CONFIG: Record<
  SubjectCategoryKey,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
    activeTabClass: string;
    dotClass: string;
  }
> = {
  dai: {
    label: "Đại số & Giải tích",
    shortLabel: "Đại số",
    badgeClass: "bg-blue-50 text-[#1D4ED8] border-blue-200",
    activeTabClass: "bg-[#1D4ED8] text-white border-[#1D4ED8] shadow-xs",
    dotClass: "bg-[#1D4ED8]"
  },
  hinh: {
    label: "Hình học & Oxyz",
    shortLabel: "Hình học",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    activeTabClass: "bg-emerald-600 text-white border-emerald-600 shadow-xs",
    dotClass: "bg-emerald-600"
  },
  tong_on: {
    label: "Tổng ôn toàn diện",
    shortLabel: "Tổng ôn",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200",
    activeTabClass: "bg-purple-600 text-white border-purple-600 shadow-xs",
    dotClass: "bg-purple-600"
  },
  tang_cuong: {
    label: "Tăng cường & Bổ trợ",
    shortLabel: "Tăng cường",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    activeTabClass: "bg-amber-600 text-white border-amber-600 shadow-xs",
    dotClass: "bg-amber-500"
  },
  hsa: {
    label: "Tổng ôn ĐGNL HSA",
    shortLabel: "Tổng ôn HSA",
    badgeClass: "bg-slate-900 text-white border-slate-900",
    activeTabClass: "bg-slate-900 text-white border-slate-900 shadow-xs",
    dotClass: "bg-slate-900"
  }
};

export function normalizeSubjectCategory(
  rawCat?: string | null,
  fallbackTitle?: string
): SubjectCategoryKey {
  const clean = String(rawCat || "").trim().toLowerCase();
  if (clean === "hsa" || clean === "dgnl_hsa" || clean === "tong_on_hsa") return "hsa";
  if (clean === "dai" || clean === "algebra" || clean === "dai_so") return "dai";
  if (clean === "hinh" || clean === "geometry" || clean === "hinh_hoc") return "hinh";
  if (clean === "tong_on" || clean === "review" || clean === "tongon") return "tong_on";
  if (clean === "tang_cuong" || clean === "boost" || clean === "tangcuong") return "tang_cuong";

  const titleLower = String(fallbackTitle || "").toLowerCase();
  if (/\bhsa\b|đgnl|dgnl|định lượng|định tính/i.test(titleLower)) {
    return "hsa";
  }
  if (
    titleLower.includes("hình học") ||
    titleLower.includes("oxyz") ||
    titleLower.includes("khối đa diện") ||
    titleLower.includes("mặt cầu") ||
    titleLower.includes("mặt phẳng") ||
    titleLower.includes("đường thẳng") ||
    titleLower.includes("vectơ") ||
    titleLower.includes("vector") ||
    titleLower.includes("góc") ||
    titleLower.includes("khoảng cách")
  ) {
    return "hinh";
  }
  if (titleLower.includes("tổng ôn") || titleLower.includes("luyện đề")) {
    return "tong_on";
  }
  if (titleLower.includes("tăng cường") || titleLower.includes("bổ trợ")) {
    return "tang_cuong";
  }
  return "dai";
}

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
          className="w-8 h-8 flex items-center justify-center rounded-lg border-2 border-[#1D4ED8] text-[#1D4ED8] bg-blue-50 font-black text-xs hover:bg-[#1D4ED8] hover:text-white transition-all mx-auto cursor-pointer select-none"
        >
          {count}
        </button>
        {subBadge && (
          <span className="text-[9px] font-bold text-slate-400 tracking-tighter select-none">
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
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-[#1D4ED8] hover:text-[#1D4ED8] hover:bg-blue-50 transition-all mx-auto cursor-pointer select-none"
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
  setUploadMethodModal?: (
    modal: { lessonId: string; type: "homework_files" | "test_quizzes" } | null
  ) => void;
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

function formatDateToInput(dStr: string): string {
  if (!dStr) return "";
  if (dStr.includes("-")) return dStr;
  const parts = dStr.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return "";
}

function formatInputToDisplay(isoStr: string): string {
  if (!isoStr) return "";
  const parts = isoStr.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return isoStr;
}

export default function LessonsTab({
  chapters,
  setChapters,
  onUpdateChapters,
  saveToStorage,
  setCreateModal,
  setResourceModal,
  setViewResourcesModal,
  setBoostModal,
  setEditLessonModal,
  setEditLessonForm,
  handleDeleteLesson
}: LessonsTabProps) {
  const currentRealtimeMonth = useMemo(() => new Date().getMonth() + 1, []);
  const currentRealtimeWeek = useMemo(
    () => Math.min(5, Math.max(1, Math.ceil(new Date().getDate() / 7))),
    []
  );

  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>("all");
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<"all" | SubjectCategoryKey>(
    "all"
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<"all" | SubjectCategoryKey, number> = {
      all: 0,
      dai: 0,
      hinh: 0,
      tong_on: 0,
      tang_cuong: 0,
      hsa: 0
    };

    if (!chapters || !Array.isArray(chapters)) return counts;

    chapters.forEach((chap: any) => {
      const chapCat = chap?.category || chap?.subject_category || chap?.subject_type;
      (chap?.lessons || []).forEach((les: any) => {
        const lesMonth = Number(les?.assigned_month) > 0 ? Number(les.assigned_month) : 10;
        if (selectedMonthFilter !== "all" && lesMonth !== Number(selectedMonthFilter)) {
          return;
        }

        const rawCat = les?.category || les?.subject_category || les?.subject_type || chapCat;
        const resolvedCat = normalizeSubjectCategory(rawCat, les?.title || chap?.title);

        counts.all += 1;
        counts[resolvedCat] += 1;
      });
    });

    return counts;
  }, [chapters, selectedMonthFilter]);

  const computedFlattenedLessons = useMemo(() => {
    if (!chapters || !Array.isArray(chapters)) return [];
    const list: any[] = [];
    let runningOriginalIndex = 0;

    chapters.forEach((chap: any) => {
      const chapCat = normalizeSubjectCategory(
        chap?.category || chap?.subject_category || chap?.subject_type,
        chap?.title
      );

      (chap?.lessons || []).forEach((les: any) => {
        runningOriginalIndex++;

        const lesMonth = Number(les?.assigned_month) > 0 ? Number(les.assigned_month) : 10;
        const lesWeek = Number(les?.assigned_week) > 0 ? Number(les.assigned_week) : 1;

        if (selectedMonthFilter !== "all" && lesMonth !== Number(selectedMonthFilter)) {
          return;
        }

        const rawLesCat =
          les?.category ||
          les?.subject_category ||
          les?.subject_type ||
          chap?.category ||
          chap?.subject_category ||
          chap?.subject_type;
        const resolvedCategory = normalizeSubjectCategory(rawLesCat, les?.title || chap?.title);

        if (selectedCategoryTab !== "all" && resolvedCategory !== selectedCategoryTab) {
          return;
        }

        const createdAtTime = les?.created_at ? new Date(les.created_at).getTime() : 0;

        list.push({
          ...les,
          category: resolvedCategory,
          subject_category: resolvedCategory,
          chapterCategory: chapCat,
          assigned_month: lesMonth,
          assigned_week: lesWeek,
          originalIndex: runningOriginalIndex,
          createdAtTime,
          chapterId: chap?.id || "chap-default",
          chapterTitle: (chap?.title || "").split(":")[0] || chap?.title || "Chương",
          chapterFullTitle: chap?.title || "Chương"
        });
      });
    });

    list.sort((a, b) => {
      if (b.assigned_month !== a.assigned_month) {
        return b.assigned_month - a.assigned_month;
      }
      if (b.assigned_week !== a.assigned_week) {
        return b.assigned_week - a.assigned_week;
      }
      if (b.createdAtTime && a.createdAtTime && b.createdAtTime !== a.createdAtTime) {
        return b.createdAtTime - a.createdAtTime;
      }
      return b.originalIndex - a.originalIndex;
    });

    return list;
  }, [chapters, selectedMonthFilter, selectedCategoryTab]);

  const flattenedLessons = computedFlattenedLessons;

  const [internalUploadModal, setInternalUploadModal] = useState<{
    lessonId: string;
    lessonTitle: string;
    type: "homework_files" | "test_quizzes";
    assignedMonth: number;
    assignedWeek: number;
  } | null>(null);

  const [activeTestFile, setActiveTestFile] = useState<File | null>(null);

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

  const [driveModal, setDriveModal] = useState<{
    lessonId: string;
    type: "homework_files" | "test_quizzes";
    assignedMonth: number;
    assignedWeek: number;
  } | null>(null);
  const [driveTitle, setDriveTitle] = useState("");
  const [driveUrl, setDriveUrl] = useState("");

  const [editChapterModal, setEditChapterModal] = useState<{
    id: string;
    title: string;
    target_mode: "online" | "offline" | "all";
    category: SubjectCategoryKey;
  } | null>(null);

  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const docxInputRef = useRef<HTMLInputElement | null>(null);

  const dispatchOptimisticUpdate = (newChapters: any[], taskLabel: string = "bài tập") => {
    if (typeof onUpdateChapters === "function") {
      onUpdateChapters(newChapters, taskLabel);
    } else if (typeof saveToStorage === "function") {
      saveToStorage(newChapters, taskLabel);
    } else if (typeof setChapters === "function") {
      setChapters(newChapters);
    }
  };

  const handleQuickChangeLessonCategory = async (
    chapterId: string,
    lessonId: string,
    newCategory: SubjectCategoryKey
  ) => {
    const updatedChapters = (chapters || []).map((chap: any) => {
      if (chap?.id !== chapterId) return chap;
      return {
        ...chap,
        lessons: (chap?.lessons || []).map((les: any) => {
          if (les?.id !== lessonId) return les;
          return {
            ...les,
            category: newCategory,
            subject_category: newCategory
          };
        })
      };
    });

    if (typeof setChapters === "function") setChapters(updatedChapters);

    try {
      await supabase
        .from("lessons")
        .update({ category: newCategory })
        .eq("id", lessonId);
    } catch (err) {
      console.error("Lỗi cập nhật phân môn lên Supabase:", err);
    }

    const catLabel = SUBJECT_CATEGORY_CONFIG[newCategory]?.shortLabel || newCategory;
    if (typeof onUpdateChapters === "function") {
      await onUpdateChapters(updatedChapters, `phân môn ${catLabel}`);
    } else if (typeof saveToStorage === "function") {
      await saveToStorage(updatedChapters, `phân môn ${catLabel}`);
    }
  };

  const handleSaveEditChapter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editChapterModal || !editChapterModal.title.trim()) return;

    const targetId = editChapterModal.id;
    const targetTitle = editChapterModal.title.trim();
    const targetMode = editChapterModal.target_mode;
    const targetCategory = editChapterModal.category;

    const updatedChapters = (chapters || []).map((chap: any) => {
      if (chap?.id !== targetId) return chap;
      return {
        ...chap,
        title: targetTitle,
        target_mode: targetMode,
        category: targetCategory,
        subject_category: targetCategory
      };
    });

    setEditChapterModal(null);
    if (typeof setChapters === "function") setChapters(updatedChapters);

    try {
      await supabase
        .from("chapters")
        .update({
          title: targetTitle,
          target_mode: targetMode,
          category: targetCategory
        })
        .eq("id", targetId);
    } catch (err) {
      console.error("Lỗi cập nhật chương lên Supabase:", err);
    }

    dispatchOptimisticUpdate(updatedChapters, "cập nhật chương");
  };

  const handleToggleLockLesson = async (
    chapterId: string,
    lessonId: string,
    currentLockState: boolean
  ) => {
    const nextLock = !currentLockState;

    const updatedChapters = (chapters || []).map((chap: any) => {
      if (chap?.id !== chapterId) return chap;
      return {
        ...chap,
        lessons: (chap?.lessons || []).map((les: any) => {
          if (les?.id !== lessonId) return les;
          return { ...les, is_locked: nextLock };
        })
      };
    });
    if (typeof setChapters === "function") setChapters(updatedChapters);

    try {
      await supabase
        .from("lessons")
        .update({ is_locked: nextLock })
        .eq("id", lessonId);
    } catch {}

    if (typeof onUpdateChapters === "function") {
      await onUpdateChapters(updatedChapters, nextLock ? "Khóa bài học" : "Mở bài học");
    } else if (typeof saveToStorage === "function") {
      await saveToStorage(updatedChapters, nextLock ? "Khóa bài học" : "Mở bài học");
    }
  };

  const handleChangeStudyDate = async (
    chapterId: string,
    lessonId: string,
    newDateStr: string
  ) => {
    const cleanDate = newDateStr.trim();

    const updatedChapters = (chapters || []).map((chap: any) => {
      if (chap?.id !== chapterId) return chap;
      return {
        ...chap,
        lessons: (chap?.lessons || []).map((les: any) => {
          if (les?.id !== lessonId) return les;
          return { ...les, study_date: cleanDate };
        })
      };
    });
    if (typeof setChapters === "function") setChapters(updatedChapters);

    try {
      await supabase
        .from("lessons")
        .update({ study_date: cleanDate })
        .eq("id", lessonId);
    } catch {}

    if (typeof onUpdateChapters === "function") {
      await onUpdateChapters(updatedChapters, `ngày học ${cleanDate}`);
    } else if (typeof saveToStorage === "function") {
      await saveToStorage(updatedChapters, `ngày học ${cleanDate}`);
    }
  };

  const handleQuickChangeLessonSchedule = async (
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
                assigned_month: Number(newMonth),
                assigned_week: Number(newWeek)
              }))
            : [];
          const updatedTests = Array.isArray(les.test_quizzes)
            ? les.test_quizzes.map((tq: any) => ({
                ...tq,
                assigned_month: Number(newMonth),
                assigned_week: Number(newWeek)
              }))
            : [];
          return {
            ...les,
            assigned_month: Number(newMonth),
            assigned_week: Number(newWeek),
            homework_files: updatedHw,
            test_quizzes: updatedTests
          };
        })
      };
    });

    if (typeof setChapters === "function") setChapters(updatedChapters);

    try {
      await supabase
        .from("lessons")
        .update({
          assigned_month: Number(newMonth),
          assigned_week: Number(newWeek)
        })
        .eq("id", lessonId);
    } catch {}

    if (typeof onUpdateChapters === "function") {
      await onUpdateChapters(updatedChapters, `lịch học Th.${newMonth} Tuần ${newWeek}`);
    } else if (typeof saveToStorage === "function") {
      await saveToStorage(updatedChapters, `lịch học Th.${newMonth} Tuần ${newWeek}`);
    }
  };

  const handleOpenUploadPicker = (lesson: any, type: "homework_files" | "test_quizzes") => {
    const defaultM = Number(lesson?.assigned_month) || currentRealtimeMonth;
    const defaultW = Number(lesson?.assigned_week) || currentRealtimeWeek;

    const targetObj = {
      lessonId: lesson.id,
      lessonTitle: lesson.title || "Bài học",
      type,
      assignedMonth: defaultM,
      assignedWeek: defaultW
    };
    uploadTargetRef.current = {
      lessonId: lesson.id,
      type,
      assignedMonth: defaultM,
      assignedWeek: defaultW
    };
    setInternalUploadModal(targetObj);
  };

  const handleSelectFile = (file: File) => {
    if (!internalUploadModal) return;
    const targetObj = {
      lessonId: internalUploadModal.lessonId,
      type: internalUploadModal.type,
      assignedMonth: internalUploadModal.assignedMonth || currentRealtimeMonth,
      assignedWeek: internalUploadModal.assignedWeek || currentRealtimeWeek
    };
    uploadTargetRef.current = targetObj;
    setActiveUploadTarget(targetObj);
    setActiveTestFile(file);
    setInternalUploadModal(null);
  };

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
    const incomingMediaMap =
      payload?.mediaMap ||
      payload?.media_map ||
      examData?.mediaMap ||
      examData?.media_map ||
      {};

    const defaultTitle = isHw ? "Bài tập về nhà (BTVN)" : "Đề kiểm tra định kỳ";
    const title =
      payload?.title ||
      examData?.title ||
      activeTestFile?.name?.replace(/\.[^/.]+$/, "") ||
      defaultTitle;

    const duration = isHw
      ? 0
      : payload?.duration_minutes || examData?.duration_minutes || 45;
    const quizId = payload?.id || examData?.id || "quiz-" + Date.now();

    const finalMonth = Number(
      payload?.assigned_month ||
        examData?.assigned_month ||
        assignedMonth ||
        currentRealtimeMonth
    );
    const finalWeek = Number(
      payload?.assigned_week ||
        examData?.assigned_week ||
        assignedWeek ||
        currentRealtimeWeek
    );

    setActiveTestFile(null);
    setActiveUploadTarget(null);
    uploadTargetRef.current = null;

    const newQuizItem = {
      id: quizId,
      title,
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

    dispatchOptimisticUpdate(
      updatedChapters,
      isHw ? "bài tập về nhà" : "đề kiểm tra"
    );
  };

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
          assigned_month:
            les.assigned_month || assignedMonth || currentRealtimeMonth,
          assigned_week:
            les.assigned_week || assignedWeek || currentRealtimeWeek,
          [type]: [...currentList, newItem]
        };
      })
    }));

    dispatchOptimisticUpdate(
      updatedChapters,
      isHw ? "file Drive BTVN" : "file Drive đề thi"
    );
  };

  return (
    <div className="space-y-4 text-left relative font-sans">
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

      {/* 1. THANH ĐIỀU HƯỚNG BỘ LỌC TỐI GIẢN */}
      <div className="flex flex-col gap-3 p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Bộ lọc 5 phân môn: Đại số | Hình học | Tổng ôn | Tăng cường | Tổng ôn HSA */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedCategoryTab("all")}
                className={
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer " +
                  (selectedCategoryTab === "all"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100")
                }
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Tất cả ({categoryCounts.all})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategoryTab("dai")}
                className={
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer " +
                  (selectedCategoryTab === "dai"
                    ? SUBJECT_CATEGORY_CONFIG.dai.activeTabClass
                    : "bg-blue-50/60 text-[#1D4ED8] border-blue-200/80 hover:bg-blue-100/70")
                }
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Đại số ({categoryCounts.dai})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategoryTab("hinh")}
                className={
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer " +
                  (selectedCategoryTab === "hinh"
                    ? SUBJECT_CATEGORY_CONFIG.hinh.activeTabClass
                    : "bg-emerald-50/60 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100/70")
                }
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Hình học ({categoryCounts.hinh})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategoryTab("tong_on")}
                className={
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer " +
                  (selectedCategoryTab === "tong_on"
                    ? SUBJECT_CATEGORY_CONFIG.tong_on.activeTabClass
                    : "bg-purple-50/60 text-purple-700 border-purple-200/80 hover:bg-purple-100/70")
                }
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tổng ôn ({categoryCounts.tong_on})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategoryTab("tang_cuong")}
                className={
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer " +
                  (selectedCategoryTab === "tang_cuong"
                    ? SUBJECT_CATEGORY_CONFIG.tang_cuong.activeTabClass
                    : "bg-amber-50/60 text-amber-700 border-amber-200/80 hover:bg-amber-100/70")
                }
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Tăng cường ({categoryCounts.tang_cuong})</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCategoryTab("hsa")}
                className={
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer " +
                  (selectedCategoryTab === "hsa"
                    ? SUBJECT_CATEGORY_CONFIG.hsa.activeTabClass
                    : "bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200")
                }
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Tổng ôn HSA ({categoryCounts.hsa})</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedMonthFilter}
                onChange={(e) => setSelectedMonthFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">Tất cả tháng</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={String(m)}>
                    Tháng {m < 10 ? "0" + m : m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCreateModal({ type: "chapter" });
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-[#1D4ED8]" /> Thêm Chương
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!chapters || chapters.length === 0)
                  return alert("Vui lòng thêm Chương trước!");
                setCreateModal({ type: "lesson", chapterId: chapters[0].id });
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Thêm Bài học
            </button>
          </div>
        </div>

        {/* DANH SÁCH CHƯƠNG HIỆN CÓ KÈM NHÃN PHÂN MÔN & NÚT SỬA NHANH CHƯƠNG */}
        {Array.isArray(chapters) && chapters.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pt-2.5 border-t border-slate-100">
            <span className="text-[10px] font-bold uppercase text-slate-400 mr-1 shrink-0">
              Chương:
            </span>
            {chapters.map((chap: any) => {
              const cCat = normalizeSubjectCategory(
                chap?.category || chap?.subject_category || chap?.subject_type,
                chap?.title
              );
              const cCfg = SUBJECT_CATEGORY_CONFIG[cCat];
              const shortChapName = (chap?.title || "Chương").split(":")[0];
              return (
                <button
                  key={chap.id}
                  type="button"
                  onClick={() =>
                    setEditChapterModal({
                      id: chap.id,
                      title: chap.title || "",
                      target_mode: chap.target_mode || "all",
                      category: cCat
                    })
                  }
                  title={`Nhấn để sửa "${chap.title}" (${cCfg.label})`}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition hover:opacity-85 cursor-pointer shrink-0 ${cCfg.badgeClass}`}
                >
                  <span className="truncate max-w-[110px]">{shortChapName}</span>
                  <span className="opacity-75">• {cCfg.shortLabel}</span>
                  <Edit3 className="w-2.5 h-2.5 opacity-70" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. BẢNG MATRIX NỘI DUNG BÀI HỌC */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden w-full">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[1080px] text-left border-collapse">
            <thead className="bg-slate-50 text-slate-600 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-3 text-center w-12">STT</th>
                <th className="py-3.5 px-3 text-center w-14">Khóa</th>
                <th className="py-3.5 px-4 min-w-[240px]">Nội dung bài học</th>
                <th className="py-3.5 px-3 text-center w-40">Tuần / Tháng / Ngày</th>
                <th className="py-3.5 px-3 text-center w-36">Chương & Phân môn</th>
                <th className="py-3.5 px-3 text-center w-18">Video</th>
                <th className="py-3.5 px-3 text-center w-18">Bài giảng</th>
                <th className="py-3.5 px-3 text-center w-18">Viết tay</th>
                <th className="py-3.5 px-3 text-center w-20">BTVN</th>
                <th className="py-3.5 px-3 text-center w-20">Đề KT</th>
                <th className="py-3.5 px-3 text-center w-22">Tăng cường</th>
                <th className="py-3.5 px-3 text-center w-20">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {flattenedLessons.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="py-12 text-center text-slate-400 text-xs font-semibold italic"
                  >
                    Không tìm thấy bài học nào khớp với bộ lọc phân môn hiện tại.
                  </td>
                </tr>
              ) : (
                flattenedLessons.map((les: any, idx: number) => {
                  const lesTitle = les?.title || "Bài học";
                  const lesMonth =
                    Number(les?.assigned_month) > 0 ? Number(les.assigned_month) : 10;
                  const lesWeek =
                    Number(les?.assigned_week) > 0 ? Number(les.assigned_week) : 1;
                  const scheduleTag = `T${lesWeek}.Th${lesMonth}`;
                  const isLocked = Boolean(les?.is_locked);
                  const studyDate = les?.study_date || "";

                  const lesCategory: SubjectCategoryKey = normalizeSubjectCategory(
                    les?.category || les?.subject_category,
                    lesTitle
                  );
                  const catConfig = SUBJECT_CATEGORY_CONFIG[lesCategory];

                  return (
                    <tr
                      key={les?.id || idx}
                      className={`transition-colors ${
                        isLocked ? "bg-slate-50/80" : "hover:bg-slate-50/60 bg-white"
                      }`}
                    >
                      <td className="py-3 px-3 text-center text-slate-400 font-bold text-xs">
                        {idx + 1}
                      </td>

                      {/* Khóa/Mở */}
                      <td className="py-3 px-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleLockLesson(les.chapterId, les.id, isLocked)
                          }
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            isLocked
                              ? "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                              : "bg-white text-slate-400 border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          {isLocked ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </td>

                      {/* Tên bài học + Nhãn Phân môn */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded border ${catConfig.badgeClass}`}
                          >
                            {catConfig.shortLabel}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500">
                            Tuần {lesWeek} - Th.{lesMonth < 10 ? "0" + lesMonth : lesMonth}
                          </span>
                          {studyDate && (
                            <span className="text-[11px] font-semibold text-blue-700">
                              • {studyDate}
                            </span>
                          )}
                          {isLocked && (
                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 text-[10px] font-bold rounded border border-rose-200">
                              Đang khóa
                            </span>
                          )}
                        </div>
                        <h4
                          className={`font-bold text-[13.5px] leading-snug ${
                            isLocked ? "text-slate-500 line-through" : "text-slate-900"
                          }`}
                        >
                          {lesTitle}
                        </h4>
                      </td>

                      {/* Cột Tuần / Tháng / Ngày */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center justify-center gap-1 w-full">
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
                              className="bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-[11px] font-bold text-slate-700 outline-none focus:border-[#1D4ED8] cursor-pointer"
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
                              className="bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 text-[11px] font-bold text-[#1D4ED8] outline-none focus:border-[#1D4ED8] cursor-pointer"
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                                <option key={m} value={m}>
                                  Th.{m < 10 ? "0" + m : m}
                                </option>
                              ))}
                            </select>
                          </div>

                          <input
                            type="date"
                            value={formatDateToInput(studyDate)}
                            onChange={async (e) => {
                              const displayVal = formatInputToDisplay(e.target.value);
                              const updated = (chapters || []).map((c: any) => ({
                                ...c,
                                lessons: (c.lessons || []).map((l: any) =>
                                  l.id === les.id ? { ...l, study_date: displayVal } : l
                                )
                              }));
                              if (typeof setChapters === "function") setChapters(updated);
                              await handleChangeStudyDate(les.chapterId, les.id, displayVal);
                            }}
                            className="w-full text-center text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-[#1D4ED8] cursor-pointer"
                          />
                        </div>
                      </td>

                      {/* Cột Chương & Đổi nhanh Phân môn */}
                      <td className="py-3 px-2.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const foundChap = (chapters || []).find(
                                (c: any) => c.id === les.chapterId
                              );
                              if (foundChap) {
                                setEditChapterModal({
                                  id: foundChap.id,
                                  title: foundChap.title || "",
                                  target_mode: foundChap.target_mode || "all",
                                  category: normalizeSubjectCategory(
                                    foundChap.category || foundChap.subject_category,
                                    foundChap.title
                                  )
                                });
                              }
                            }}
                            title={`Bấm để sửa ${les.chapterFullTitle}`}
                            className="text-[11px] text-slate-600 hover:text-[#1D4ED8] font-bold inline-flex items-center gap-1 cursor-pointer transition"
                          >
                            <span>{les.chapterTitle}</span>
                            <Edit3 className="w-2.5 h-2.5 opacity-60" />
                          </button>

                          <select
                            value={lesCategory}
                            onChange={(e) =>
                              handleQuickChangeLessonCategory(
                                les.chapterId,
                                les.id,
                                e.target.value as SubjectCategoryKey
                              )
                            }
                            title="Đổi nhanh phân môn bài học"
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border outline-none cursor-pointer transition ${catConfig.badgeClass}`}
                          >
                            <option value="dai">Đại số</option>
                            <option value="hinh">Hình học</option>
                            <option value="tong_on">Tổng ôn</option>
                            <option value="tang_cuong">Tăng cường</option>
                            <option value="hsa">Tổng ôn HSA</option>
                          </select>
                        </div>
                      </td>

                      <td className="py-3 px-2">
                        <MatrixCell
                          items={les.video_list}
                          label="Video"
                          onAdd={() =>
                            setResourceModal({
                              isOpen: true,
                              lessonId: les.id,
                              lessonTitle: les.title,
                              type: "video_list"
                            })
                          }
                          onView={() =>
                            setViewResourcesModal({
                              lessonId: les.id,
                              type: "video_list",
                              title: "Video",
                              items: les.video_list
                            })
                          }
                        />
                      </td>

                      <td className="py-3 px-2">
                        <MatrixCell
                          items={les.lecture_files}
                          label="Bài giảng"
                          onAdd={() =>
                            setResourceModal({
                              isOpen: true,
                              lessonId: les.id,
                              lessonTitle: les.title,
                              type: "lecture_files"
                            })
                          }
                          onView={() =>
                            setViewResourcesModal({
                              lessonId: les.id,
                              type: "lecture_files",
                              title: "Bài giảng",
                              items: les.lecture_files
                            })
                          }
                        />
                      </td>

                      <td className="py-3 px-2">
                        <MatrixCell
                          items={les.handwritten_notes}
                          label="Viết tay"
                          onAdd={() =>
                            setResourceModal({
                              isOpen: true,
                              lessonId: les.id,
                              lessonTitle: les.title,
                              type: "handwritten_notes"
                            })
                          }
                          onView={() =>
                            setViewResourcesModal({
                              lessonId: les.id,
                              type: "handwritten_notes",
                              title: "Viết tay",
                              items: les.handwritten_notes
                            })
                          }
                        />
                      </td>

                      <td className="py-3 px-2">
                        <MatrixCell
                          items={les.homework_files}
                          label="BTVN"
                          subBadge={scheduleTag}
                          onAdd={() => handleOpenUploadPicker(les, "homework_files")}
                          onView={() =>
                            setViewResourcesModal({
                              lessonId: les.id,
                              type: "homework_files",
                              title: "BTVN",
                              items: les.homework_files
                            })
                          }
                        />
                      </td>

                      <td className="py-3 px-2">
                        <MatrixCell
                          items={les.test_quizzes}
                          label="Đề KT"
                          subBadge={scheduleTag}
                          onAdd={() => handleOpenUploadPicker(les, "test_quizzes")}
                          onView={() =>
                            setViewResourcesModal({
                              lessonId: les.id,
                              type: "test_quizzes",
                              title: "Đề kiểm tra",
                              items: les.test_quizzes
                            })
                          }
                        />
                      </td>

                      <td className="py-3 px-2">
                        <MatrixCell
                          items={les.extra_resources}
                          label="Tăng cường"
                          onAdd={() => setBoostModal(les.id)}
                          onView={() =>
                            setViewResourcesModal({
                              lessonId: les.id,
                              type: "extra_resources",
                              title: "Tăng cường",
                              items: les.extra_resources
                            })
                          }
                        />
                      </td>

                      <td className="py-3 px-2">
                        <div className="flex items-center justify-center gap-1">
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
                                category: lesCategory,
                                subject_category: lesCategory,
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2B. MODAL SỬA NHANH CHƯƠNG (TÊN CHƯƠNG + PHÂN MÔN) */}
      {editChapterModal && (
        <div
          onClick={() => setEditChapterModal(null)}
          className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 cursor-pointer"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveEditChapter}
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl cursor-default text-left space-y-4 border border-slate-200"
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#1D4ED8]" /> Chỉnh sửa Chương
              </h3>
              <button
                type="button"
                onClick={() => setEditChapterModal(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Tên chương *
              </label>
              <input
                required
                type="text"
                value={editChapterModal.title}
                onChange={(e) =>
                  setEditChapterModal({ ...editChapterModal, title: e.target.value })
                }
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:border-[#1D4ED8]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Phân môn / Lộ trình *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { key: "dai", label: "Đại số (THPT)" },
                    { key: "hinh", label: "Hình học (THPT)" },
                    { key: "tong_on", label: "Tổng ôn (THPT)" },
                    { key: "tang_cuong", label: "Tăng cường (THPT)" },
                    { key: "hsa", label: "Tổng ôn ĐGNL HSA" }
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() =>
                      setEditChapterModal({ ...editChapterModal, category: opt.key })
                    }
                    className={
                      "py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer text-left " +
                      (editChapterModal.category === opt.key
                        ? "bg-blue-50 border-[#1D4ED8] text-[#1D4ED8]"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100")
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditChapterModal(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Lưu thay đổi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3. MODAL CHỌN PHƯƠNG THỨC NẠP ĐỀ THI / BTVN */}
      {internalUploadModal && (
        <div
          onClick={() => setInternalUploadModal(null)}
          className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl cursor-default text-left border border-slate-200"
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  {internalUploadModal.type === "homework_files" ? (
                    <CheckSquare className="w-5 h-5 text-blue-600" />
                  ) : (
                    <Award className="w-5 h-5 text-emerald-600" />
                  )}
                  <span>
                    Thêm{" "}
                    {internalUploadModal.type === "homework_files"
                      ? "Bài tập về nhà (BTVN)"
                      : "Đề Kiểm Tra"}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bài học: <strong className="text-blue-700">{internalUploadModal.lessonTitle}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInternalUploadModal(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 mb-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Gắn vào Tháng *
                </label>
                <select
                  value={internalUploadModal.assignedMonth}
                  onChange={(e) => {
                    const m = Number(e.target.value);
                    setInternalUploadModal((prev) =>
                      prev ? { ...prev, assignedMonth: m } : null
                    );
                    if (uploadTargetRef.current) uploadTargetRef.current.assignedMonth = m;
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-[#1D4ED8] cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>
                      Tháng {m < 10 ? "0" + m : m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Gắn vào Tuần *
                </label>
                <select
                  value={internalUploadModal.assignedWeek}
                  onChange={(e) => {
                    const w = Number(e.target.value);
                    setInternalUploadModal((prev) =>
                      prev ? { ...prev, assignedWeek: w } : null
                    );
                    if (uploadTargetRef.current) uploadTargetRef.current.assignedWeek = w;
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-[#1D4ED8] cursor-pointer"
                >
                  {[1, 2, 3, 4, 5].map((w) => (
                    <option key={w} value={w}>
                      Tuần {w}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <div
                onClick={() => docxInputRef.current?.click()}
                className="p-4 border border-slate-200 bg-white rounded-xl hover:border-blue-400 hover:bg-blue-50/30 transition cursor-pointer flex items-start gap-3.5"
              >
                <div className="p-2.5 bg-blue-50 text-[#1D4ED8] rounded-lg shrink-0">
                  <FileUp className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-900 text-sm">
                    Tải lên file Word (.docx)
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Bóc tách tự động câu hỏi trắc nghiệm, đúng sai, điền đáp số và hình ảnh.
                  </div>
                </div>
              </div>

              <div
                onClick={() => pdfInputRef.current?.click()}
                className="p-4 border border-slate-200 bg-white rounded-xl hover:border-blue-400 hover:bg-blue-50/30 transition cursor-pointer flex items-start gap-3.5"
              >
                <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-900 text-sm">Tải lên file PDF (.pdf)</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Quét câu hỏi và bảng đáp án từ file PDF.
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDriveModal({
                    lessonId: internalUploadModal.lessonId,
                    type: internalUploadModal.type,
                    assignedMonth: internalUploadModal.assignedMonth,
                    assignedWeek: internalUploadModal.assignedWeek
                  });
                  setInternalUploadModal(null);
                }}
                className="p-4 border border-slate-200 bg-white rounded-xl hover:border-blue-400 hover:bg-blue-50/30 transition cursor-pointer flex items-start gap-3.5 text-left"
              >
                <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg shrink-0">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-900 text-sm">
                    Đính kèm Link Google Drive
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Dán link chia sẻ tài liệu PDF/Word từ Drive.
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
          className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 cursor-pointer"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveDriveLink}
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl cursor-default text-left border border-slate-200"
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-[#1D4ED8]" /> Đính kèm Link Google Drive
              </h3>
              <button
                type="button"
                onClick={() => setDriveModal(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tiêu đề hiển thị *
                </label>
                <input
                  required
                  type="text"
                  value={driveTitle}
                  onChange={(e) => setDriveTitle(e.target.value)}
                  placeholder="VD: Phiếu bài tập tự luyện số 1..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:border-[#1D4ED8] outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Link Google Drive *
                </label>
                <input
                  required
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-xs font-medium focus:border-[#1D4ED8] outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-5 mt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDriveModal(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Lưu file Drive
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. AZOTA EXAM CONFIG MODAL */}
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
