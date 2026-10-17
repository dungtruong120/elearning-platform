"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { 
  X, Pencil, Trash2, Plus, Upload, Link as LinkIcon, 
  ExternalLink, Video, FileText, PenTool, CheckSquare, 
  Award, Play, FolderPlus, BookOpen, Clock, AlertCircle, 
  Save, FileUp, Edit3, UploadCloud, CheckCircle2, FileSignature, 
  Sparkles, RefreshCw, Loader2, Zap, Eye, RotateCcw, Calendar,
  Check, HelpCircle, UserPlus
} from "lucide-react";
import dynamic from "next/dynamic";
import katex from "katex";
import { STANDARD_SHIFTS } from "@/types";

// DYNAMIC IMPORT MODAL TRÍCH XUẤT ĐỀ THI WORD & MATHTYPE
const AzotaExamConfigModal: any = dynamic<any>(
  () => import("@/app/admin/AzotaExamConfigModal").then((mod: any) => mod.AzotaExamConfigModal || mod.default || mod),
  { ssr: false }
);

function cleanResourceMediaPayload(item: any): any {
  if (!item || typeof item !== "object") return item;
  return { ...item };
}

function normalizeText(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// HÀM GIẢI MÃ ĐƯỜNG DẪN ẢNH TRONG ĐỀ THI (TỪ MEDIAMAP HOẶC URL STORAGE)
function resolveSubmissionImageSrc(rawKey: string, mediaMap: Record<string, any> = {}): string {
  if (!rawKey) return "";
  const trimmed = String(rawKey || "").trim();
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }
  if (!mediaMap || typeof mediaMap !== "object") return "";
  const cleanKey = trimmed.replace(/^\$+|\$+$/g, "").trim();
  if (mediaMap[cleanKey]) return String(mediaMap[cleanKey]);
  if (mediaMap[`$${cleanKey}$`]) return String(mediaMap[`$${cleanKey}$`]);
  for (const [k, v] of Object.entries(mediaMap)) {
    if (!v) continue;
    const cleanK = k.replace(/^\$+|\$+$/g, "").trim().toLowerCase();
    if (cleanK === cleanKey.toLowerCase()) return String(v);
  }
  return "";
}

// COMPONENT HIỂN THỊ NỘI DUNG CÂU HỎI / ĐÁP ÁN / LỜI GIẢI (HỖ TRỢ KATEX + TOKEN ẢNH + HTML)
function SubmissionRichContent({
  content,
  mediaMap = {},
  className = "",
}: {
  content?: string;
  mediaMap?: Record<string, any>;
  className?: string;
}) {
  const renderedHtml = useMemo(() => {
    if (!content) return "";
    let str = String(content);

    // 1. Thay thế token ảnh [img:key] hoặc [img:$img_1$]
    str = str.replace(/\[img:([^\]]+)\]/gi, (_, rawKey) => {
      const src = resolveSubmissionImageSrc(rawKey, mediaMap);
      if (!src) {
        return `<span class="inline-flex items-center px-2 py-0.5 text-[11px] bg-slate-100 text-slate-500 rounded border border-slate-200">[Hình: ${rawKey}]</span>`;
      }
      return `<div class="my-2 flex justify-center"><img src="${src}" alt="Hình minh họa" class="max-h-64 max-w-full rounded-xl border border-slate-200 object-contain bg-white p-1 shadow-2xs" /></div>`;
    });

    // 2. Render công thức toán học $$...$$ (Display Mode)
    str = str.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return `$$${tex}$$`;
      }
    });

    // 3. Render công thức toán học $...$ (Inline Mode)
    str = str.replace(/\$([^$\n]+?)\$/g, (fullMatch, tex) => {
      const cleaned = tex.trim();
      if (/^img_\d+$/i.test(cleaned) && mediaMap[cleaned]) {
        const src = resolveSubmissionImageSrc(cleaned, mediaMap);
        return `<div class="my-2 flex justify-center"><img src="${src}" alt="Hình minh họa" class="max-h-64 max-w-full rounded-xl border border-slate-200 object-contain bg-white p-1 shadow-2xs" /></div>`;
      }
      try {
        return katex.renderToString(cleaned, { displayMode: false, throwOnError: false });
      } catch {
        return fullMatch;
      }
    });

    // 4. Chuyển đổi xuống dòng nếu chuỗi chưa phải HTML phức tạp
    if (!/<(p|div|table|ul|ol|br|img)/i.test(str)) {
      str = str.replace(/\n/g, "<br/>");
    }

    return str;
  }, [content, mediaMap]);

  if (!content) return null;
  return (
    <div
      className={`leading-relaxed break-words ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}

interface DeletionItemState {
  step: "confirm" | "deleting" | "deleted";
  progress: number;
  countdown: number;
  studentName: string;
  attemptObj: any;
}

interface AdminModalsProps {
  azotaScoreViewModal?: {
    isOpen: boolean;
    examTitle: string;
    attempts: any[];
    examId?: string;
  };
  setAzotaScoreViewModal?: (modal: any) => void;
  registeredStudents?: any[];
  supabase?: any;
  showToast?: (msg: string, type?: "success" | "error") => void;

  // CÁC PROPS KẾT NỐI VỚI LESSONS TAB VÀ DASHBOARD GỐC
  chapters?: any[];
  setChapters?: (chapters: any[]) => void;
  onUpdateChapters?: (newChapters: any[], taskName?: string) => Promise<any> | void;
  saveToStorage?: (newChapters: any[], taskName?: string) => Promise<any> | void;
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
  testFile?: File | null;
  setTestFile?: (file: File | null) => void;
  uploadMode?: "course" | "practice";
  setUploadMode?: (mode: "course" | "practice") => void;
  azotaTarget?: { lessonId: string; type: "homework_files" | "test_quizzes" } | null;
  setAzotaTarget?: (target: { lessonId: string; type: "homework_files" | "test_quizzes" } | null) => void;
  editingExamData?: any | null;
  setEditingExamData?: (data: any | null) => void;
  onSaveAzotaExam?: (examData: any) => void;
  practiceExams?: any[];
  savePracticeExams?: (exams: any[]) => Promise<void>;
  handleRecalculateExamScores?: (examId: string, sections: any[]) => Promise<void>;
  allAttempts?: any[];
  setAllAttempts?: any;
  onDeleteAttemptPermanent?: (attempt: any) => Promise<void> | void;
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
    onUpdateChapters,
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
    testFile = null,
    setTestFile,
    uploadMode = "course",
    setUploadMode,
    azotaTarget = null,
    setAzotaTarget,
    editingExamData = null,
    setEditingExamData,
    onSaveAzotaExam,
    practiceExams = [],
    savePracticeExams,
    handleRecalculateExamScores,
    allAttempts = [],
    setAllAttempts,
    onDeleteAttemptPermanent,
  } = props;

  const [filterMode, setFilterMode] = useState<"all" | "online" | "offline">("all");

  const [resTitle, setResTitle] = useState<string>("");
  const [resUrl, setResUrl] = useState<string>("");
  const [vidType, setVidType] = useState<"lecture" | "homework_solution">("lecture");

  const [newItemTitle, setNewItemTitle] = useState<string>("");
  const [newItemDescription, setNewItemDescription] = useState<string>("");
  const [newItemFormat, setNewItemFormat] = useState<string>("Zoom");
  const [newItemTargetMode, setNewItemTargetMode] = useState<"online" | "offline" | "all">("all");

  const [boostForm, setBoostForm] = useState({ title: "", type: "video", url: "", note: "" });

  const [driveLinkModal, setDriveLinkModal] = useState<{ lessonId: string; type: "homework_files" | "test_quizzes" } | null>(null);
  const [driveLinkForm, setDriveLinkForm] = useState({ title: "", url: "" });

  const [editResourceModal, setEditResourceModal] = useState<{ lessonId: string; type: string; item: any } | null>(null);
  const [editResourceForm, setEditResourceForm] = useState({ title: "", url: "", type: "lecture" });

  // STATE QUẢN LÝ LUỒNG XÓA AN TOÀN 3 BƯỚC (CONFIRM -> DELETING PROGRESS -> DELETED UNDO 6S)
  const [deletionStateMap, setDeletionStateMap] = useState<Record<string, DeletionItemState>>({});
  const deletionTimersRef = useRef<Record<string, { progressInterval?: any; countdownInterval?: any; commitTimeout?: any }>>({});

  // STATE QUẢN LÝ MODAL XEM BÀI LÀM CHI TIẾT CỦA HỌC SINH
  const [viewingSubmission, setViewingSubmission] = useState<{
    attempt: any;
    examObj: any | null;
    isLoadingExam: boolean;
  } | null>(null);

  // Dọn dẹp timers khi unmount
  useEffect(() => {
    return () => {
      Object.values(deletionTimersRef.current).forEach((t) => {
        if (t.progressInterval) clearInterval(t.progressInterval);
        if (t.countdownInterval) clearInterval(t.countdownInterval);
        if (t.commitTimeout) clearTimeout(t.commitTimeout);
      });
    };
  }, []);

  const clearTimersForAttempt = (attemptId: string) => {
    const t = deletionTimersRef.current[attemptId];
    if (t) {
      if (t.progressInterval) clearInterval(t.progressInterval);
      if (t.countdownInterval) clearInterval(t.countdownInterval);
      if (t.commitTimeout) clearTimeout(t.commitTimeout);
      delete deletionTimersRef.current[attemptId];
    }
  };

  const dispatchOptimisticUpdate = (newChapters: any[]) => {
    if (typeof onUpdateChapters === "function") {
      onUpdateChapters(newChapters);
    } else if (typeof saveToStorage === "function") {
      saveToStorage(newChapters);
    } else if (typeof setChapters === "function") {
      setChapters(newChapters);
    }

    setTimeout(() => {
      try {
        localStorage.setItem("edunexus_course_data", JSON.stringify(newChapters));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {}
    }, 0);
  };

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
        displayName = "dung123";
      }

      let isOffline = false;
      if (matchedProfile) {
        const pMode = String(matchedProfile.learning_mode || matchedProfile.study_mode || "").toLowerCase();
        isOffline = pMode === "offline";
      } else {
        const attMode = String(att.learningMode || att.learning_mode || "").toLowerCase();
        isOffline = attMode === "offline" || displayName.toLowerCase().includes("off");
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
        resolvedAvatar: avatarInitials,
      };
    });
  }, [azotaScoreViewModal.attempts, profileMap]);

  const filteredAttempts = useMemo(() => {
    if (filterMode === "all") return enhancedAttempts;
    return enhancedAttempts.filter((att: any) => att.resolvedMode === filterMode);
  }, [enhancedAttempts, filterMode]);

  // THỰC THI XÓA VĨNH VIỄN SAU KHI HẾT 6 GIÂY HOÀN TÁC
  const commitPermanentDeleteAttempt = async (att: any) => {
    const attemptId = String(att?.id || "");
    const studentId = String(att?.studentId || att?.student_id || att?.user_id || "");
    const quizId = String(att?.quizId || att?.quiz_id || att?.exam_id || "");
    const examTitle = String(att?.examTitle || att?.exam_title || azotaScoreViewModal?.examTitle || "");
    const createdAt = att?.createdAt || att?.created_at || "";

    clearTimersForAttempt(attemptId);

    // 1. Lưu ID đã xóa vào danh sách chặn Re-hydration
    if (typeof window !== "undefined") {
      try {
        const rawDeleted = localStorage.getItem("edunexus_deleted_attempt_ids");
        const deletedList: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
        const keysToBlock = [
          attemptId,
          `${quizId}_${studentId}_${createdAt}`,
          createdAt ? `${studentId}_${createdAt}` : "",
        ].filter(Boolean);

        const mergedDeleted = Array.from(new Set([...deletedList, ...keysToBlock]));
        localStorage.setItem("edunexus_deleted_attempt_ids", JSON.stringify(mergedDeleted));
        sessionStorage.setItem("edunexus_deleted_attempt_ids", JSON.stringify(mergedDeleted));
      } catch (e) {}
    }

    // 2. Xóa khỏi state của Modal hiện tại
    if (setAzotaScoreViewModal) {
      setAzotaScoreViewModal((prev: any) => ({
        ...prev,
        attempts: (prev.attempts || []).filter((a: any) => {
          if (String(a?.id || "") === attemptId) return false;
          if (createdAt && studentId && (a?.createdAt === createdAt || a?.created_at === createdAt) && (a?.studentId === studentId || a?.student_id === studentId)) {
            return false;
          }
          return true;
        }),
      }));
    }

    // 3. Xóa khỏi state gốc allAttempts của page.tsx và cập nhật localStorage
    if (typeof setAllAttempts === "function") {
      (setAllAttempts as any)((prev: any) => {
        const updated = (prev || []).filter((a: any) => {
          if (String(a?.id || "") === attemptId) return false;
          if (createdAt && studentId && (a?.createdAt === createdAt || a?.created_at === createdAt) && (a?.studentId === studentId || a?.student_id === studentId)) {
            return false;
          }
          return true;
        });
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("edunexus_attempts", JSON.stringify(updated));
          } catch (e) {}
        }
        return updated;
      });
    } else if (typeof window !== "undefined") {
      try {
        const rawLocal = localStorage.getItem("edunexus_attempts");
        if (rawLocal) {
          const parsed = JSON.parse(rawLocal);
          if (Array.isArray(parsed)) {
            const updated = parsed.filter((a: any) => String(a?.id || "") !== attemptId);
            localStorage.setItem("edunexus_attempts", JSON.stringify(updated));
          }
        }
      } catch (e) {}
    }

    if (typeof onDeleteAttemptPermanent === "function") {
      onDeleteAttemptPermanent(att);
    }

    // Xóa trạng thái tạm khỏi deletionStateMap
    setDeletionStateMap((prev) => {
      const next = { ...prev };
      delete next[attemptId];
      return next;
    });

    // 4. Gọi API Backend xóa Supabase
    try {
      await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_attempt",
          attemptId,
          studentId,
          quizId,
          examTitle,
          createdAt,
        }),
      });

      if (supabase) {
        const tasks: Promise<any>[] = [
          Promise.resolve(supabase.from("exam_attempts").delete().eq("id", attemptId)),
          Promise.resolve(supabase.from("quiz_results").delete().eq("id", attemptId)),
          Promise.resolve(supabase.from("exam_submissions").delete().eq("id", attemptId)),
        ];
        if (createdAt && studentId) {
          tasks.push(
            Promise.resolve(supabase.from("exam_attempts").delete().eq("created_at", createdAt).eq("student_id", studentId)),
            Promise.resolve(supabase.from("quiz_results").delete().eq("created_at", createdAt).eq("student_id", studentId))
          );
        }
        await Promise.allSettled(tasks);
      }

      if (showToast) {
        showToast(`Đã xóa vĩnh viễn bài thi của ${att.resolvedName || "học sinh"}!`, "success");
      }
    } catch (err) {
      console.error("Lỗi khi xóa vĩnh viễn lượt làm bài:", err);
    }
  };

  // BƯỚC 1: MỞ POPOVER XÁC NHẬN XÓA
  const handleAskDeleteAttempt = (att: any) => {
    const attemptId = String(att?.id || "");
    if (!attemptId) return;
    clearTimersForAttempt(attemptId);
    setDeletionStateMap((prev) => ({
      ...prev,
      [attemptId]: {
        step: "confirm",
        progress: 0,
        countdown: 6,
        studentName: att.resolvedName || "Học sinh",
        attemptObj: att,
      },
    }));
  };

  // HỦY POPOVER XÁC NHẬN
  const handleCancelDeleteConfirm = (attemptId: string) => {
    clearTimersForAttempt(attemptId);
    setDeletionStateMap((prev) => {
      const next = { ...prev };
      delete next[attemptId];
      return next;
    });
  };

  // BƯỚC 2: TIẾN TRÌNH XÓA
  const handleConfirmStartDelete = (att: any) => {
    const attemptId = String(att?.id || "");
    if (!attemptId) return;
    clearTimersForAttempt(attemptId);

    setDeletionStateMap((prev) => ({
      ...prev,
      [attemptId]: {
        step: "deleting",
        progress: 12,
        countdown: 6,
        studentName: att.resolvedName || "Học sinh",
        attemptObj: att,
      },
    }));

    let currentProg = 12;
    const progressInterval = setInterval(() => {
      currentProg += 18;
      if (currentProg >= 100) {
        clearInterval(progressInterval);
        setDeletionStateMap((prev) => ({
          ...prev,
          [attemptId]: {
            step: "deleted",
            progress: 100,
            countdown: 6,
            studentName: att.resolvedName || "Học sinh",
            attemptObj: att,
          },
        }));

        let secondsLeft = 6;
        const countdownInterval = setInterval(() => {
          secondsLeft -= 1;
          if (secondsLeft > 0) {
            setDeletionStateMap((prev) => {
              if (!prev[attemptId]) return prev;
              return {
                ...prev,
                [attemptId]: {
                  ...prev[attemptId],
                  countdown: secondsLeft,
                },
              };
            });
          } else {
            clearInterval(countdownInterval);
          }
        }, 1000);

        const commitTimeout = setTimeout(() => {
          clearInterval(countdownInterval);
          commitPermanentDeleteAttempt(att);
        }, 6000);

        deletionTimersRef.current[attemptId] = {
          countdownInterval,
          commitTimeout,
        };
      } else {
        setDeletionStateMap((prev) => {
          if (!prev[attemptId]) return prev;
          return {
            ...prev,
            [attemptId]: {
              ...prev[attemptId],
              progress: Math.min(95, currentProg),
            },
          };
        });
      }
    }, 220);

    deletionTimersRef.current[attemptId] = { progressInterval };
  };

  // BƯỚC 3: HOÀN TÁC
  const handleUndoDeleteAttempt = (attemptId: string) => {
    clearTimersForAttempt(attemptId);
    setDeletionStateMap((prev) => {
      const next = { ...prev };
      delete next[attemptId];
      return next;
    });
    if (showToast) {
      showToast("Đã hoàn tác! Bài thi của học sinh được giữ nguyên.", "success");
    }
  };

  // MỞ MODAL XEM CHI TIẾT BÀI LÀM CỦA HỌC SINH
  const handleOpenSubmissionDetail = async (att: any) => {
    const attQuizId = String(att.quizId || att.quiz_id || att.exam_id || "").trim();
    const attTitleNorm = normalizeText(att.examTitle || att.exam_title || azotaScoreViewModal.examTitle);

    let foundExam = (practiceExams || []).find((ex: any) => {
      if (!ex) return false;
      const exId = String(ex.id || "").trim();
      const exTitleNorm = normalizeText(ex.title);
      return (attQuizId && exId && attQuizId === exId) || (attTitleNorm && exTitleNorm && attTitleNorm === exTitleNorm);
    });

    if (!foundExam && Array.isArray(chapters)) {
      for (const chap of chapters) {
        for (const les of chap?.lessons || []) {
          const allQuizzes = [...(les?.homework_files || []), ...(les?.test_quizzes || [])];
          const matched = allQuizzes.find((q: any) => {
            const qId = String(q?.id || "").trim();
            const qTitleNorm = normalizeText(q?.title);
            return (attQuizId && qId && attQuizId === qId) || (attTitleNorm && qTitleNorm && attTitleNorm === qTitleNorm);
          });
          if (matched) {
            foundExam = matched;
            break;
          }
        }
        if (foundExam) break;
      }
    }

    const hasQuestionsLoaded =
      foundExam &&
      ((Array.isArray(foundExam.data) && foundExam.data.length > 0) ||
        (Array.isArray(foundExam.sections) && foundExam.sections.length > 0));

    if (hasQuestionsLoaded) {
      setViewingSubmission({
        attempt: att,
        examObj: foundExam,
        isLoadingExam: false,
      });
      return;
    }

    setViewingSubmission({
      attempt: att,
      examObj: foundExam || null,
      isLoadingExam: true,
    });

    try {
      if (supabase) {
        let query = supabase.from("practice_exams").select("*");
        if (attQuizId) {
          query = query.eq("id", attQuizId);
        } else if (azotaScoreViewModal.examTitle) {
          query = query.eq("title", azotaScoreViewModal.examTitle);
        }
        const { data } = await query.limit(1).maybeSingle();
        if (data) {
          setViewingSubmission({
            attempt: att,
            examObj: data,
            isLoadingExam: false,
          });
          return;
        }
      }
    } catch (e) {}

    setViewingSubmission((prev) => (prev ? { ...prev, isLoadingExam: false } : null));
  };

  // TÍNH TOÁN DỮ LIỆU ĐỐI CHIẾU CÂU HỎI
  const submissionReviewData = useMemo(() => {
    if (!viewingSubmission) return null;
    const { attempt, examObj } = viewingSubmission;
    const rawUserAnswers =
      attempt?.userAnswers ||
      attempt?.user_answers ||
      attempt?.answers ||
      attempt?.student_answers ||
      attempt?.selected_answers ||
      attempt?.detail ||
      {};

    const sections =
      examObj?.data ||
      examObj?.sections ||
      attempt?.exam_data ||
      attempt?.sections ||
      [];

    const mediaMap =
      examObj?.media_map ||
      examObj?.mediaMap ||
      attempt?.media_map ||
      attempt?.mediaMap ||
      {};

    const questionsList: any[] = [];
    let globalOrder = 0;

    if (Array.isArray(sections)) {
      sections.forEach((sec: any, secIdx: number) => {
        const secQuestions = Array.isArray(sec?.questions) ? sec.questions : [];
        secQuestions.forEach((q: any, qIdx: number) => {
          globalOrder++;
          const qId = String(q?.id || `q_${globalOrder}`);
          const qType = q?.type || sec?.section_type || "multiple_choice";

          let stuAns =
            rawUserAnswers[qId] ??
            rawUserAnswers[String(q?.order_index)] ??
            rawUserAnswers[String(globalOrder)] ??
            rawUserAnswers[`q_${globalOrder}`] ??
            rawUserAnswers[`${secIdx}_${qIdx}`] ??
            undefined;

          const correctRaw = String(q?.correct_answer ?? q?.correctAnswer ?? q?.answer ?? "").trim();

          let status: "correct" | "wrong" | "skipped" = "skipped";
          let stuDisplay = "";
          let correctDisplay = correctRaw;

          if (qType === "true_false") {
            const options = Array.isArray(q?.options) ? q.options : [];
            const expectedMap: Record<string, boolean> = {};
            options.forEach((opt: any, i: number) => {
              const k = String(opt?.key || ["a", "b", "c", "d"][i] || i).toLowerCase().replace(/[^a-d]/g, "");
              if (typeof opt?.is_true_false_ans === "boolean") {
                expectedMap[k] = opt.is_true_false_ans;
              }
            });
            if (Object.keys(expectedMap).length === 0 && correctRaw) {
              const parts = correctRaw.split(/[,;-]+/).map((s) => s.trim().toUpperCase());
              ["a", "b", "c", "d"].forEach((k, i) => {
                if (parts[i]) {
                  expectedMap[k] = parts[i].startsWith("Đ") || parts[i] === "T" || parts[i] === "TRUE";
                }
              });
            }

            let stuTfObj: Record<string, any> = {};
            if (stuAns && typeof stuAns === "object") {
              stuTfObj = stuAns;
            } else if (typeof stuAns === "string" && stuAns.trim()) {
              try {
                stuTfObj = JSON.parse(stuAns);
              } catch {
                const parts = stuAns.split(/[,;-]+/).map((s) => s.trim());
                ["a", "b", "c", "d"].forEach((k, i) => {
                  if (parts[i] !== undefined) stuTfObj[k] = parts[i];
                });
              }
            }

            const answeredKeys = Object.keys(stuTfObj).filter(
              (k) => stuTfObj[k] !== undefined && stuTfObj[k] !== null && stuTfObj[k] !== ""
            );

            if (answeredKeys.length === 0) {
              status = "skipped";
              stuDisplay = "Chưa làm";
            } else {
              let allMatch = true;
              const stuParts: string[] = [];
              ["a", "b", "c", "d"].forEach((k) => {
                const rawVal = stuTfObj[k] ?? stuTfObj[k.toUpperCase()];
                const isStuTrue =
                  rawVal === true ||
                  String(rawVal).toUpperCase() === "Đ" ||
                  String(rawVal).toUpperCase() === "T" ||
                  String(rawVal).toUpperCase() === "TRUE";
                const hasStuVal = rawVal !== undefined && rawVal !== null && rawVal !== "";
                stuParts.push(`${k}) ${hasStuVal ? (isStuTrue ? "Đ" : "S") : "_"}`);
                if (expectedMap[k] !== undefined) {
                  if (!hasStuVal || isStuTrue !== expectedMap[k]) {
                    allMatch = false;
                  }
                }
              });
              stuDisplay = stuParts.join(" • ");
              status = allMatch ? "correct" : "wrong";
            }

            const corrParts: string[] = [];
            ["a", "b", "c", "d"].forEach((k) => {
              if (expectedMap[k] !== undefined) {
                corrParts.push(`${k}) ${expectedMap[k] ? "Đ" : "S"}`);
              }
            });
            if (corrParts.length > 0) {
              correctDisplay = corrParts.join(" • ");
            }
          } else if (qType === "short_answer") {
            const stuStr = stuAns !== undefined && stuAns !== null ? String(stuAns).trim() : "";
            stuDisplay = stuStr || "Bỏ trống";
            if (!stuStr) {
              status = "skipped";
            } else {
              const normStu = stuStr.replace(/\s+/g, "").replace(/,/g, ".").toLowerCase();
              const normCorr = correctRaw.replace(/\s+/g, "").replace(/,/g, ".").toLowerCase();
              status = normStu === normCorr ? "correct" : "wrong";
            }
          } else {
            const stuStr = stuAns !== undefined && stuAns !== null ? String(stuAns).trim().toUpperCase() : "";
            const corrStr = correctRaw.toUpperCase();
            stuDisplay = stuStr || "Bỏ trống";
            correctDisplay = corrStr || "Chưa cấu hình";
            if (!stuStr) {
              status = "skipped";
            } else {
              status = stuStr === corrStr ? "correct" : "wrong";
            }
          }

          questionsList.push({
            ...q,
            qId,
            globalOrder,
            sectionTitle: sec?.section_title || "",
            qType,
            stuAns,
            stuDisplay,
            correctDisplay,
            status,
          });
        });
      });
    }

    const correctCount = questionsList.filter((q) => q.status === "correct").length;
    const wrongCount = questionsList.filter((q) => q.status === "wrong").length;
    const skippedCount = questionsList.filter((q) => q.status === "skipped").length;

    return {
      questionsList,
      mediaMap,
      rawUserAnswers,
      correctCount,
      wrongCount,
      skippedCount,
      totalCount: questionsList.length,
    };
  }, [viewingSubmission]);

  const handleAddResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resTitle.trim() || !resUrl.trim() || !resourceModal) return;

    const newResource = cleanResourceMediaPayload({ 
      id: "res-" + Date.now(), 
      title: resTitle.trim(), 
      url: resUrl.trim(), 
      type: resourceModal.type === "video_list" ? vidType : undefined 
    });

    const newChapters = (chapters || []).map((chap: any) => ({ 
      ...chap, 
      lessons: (chap?.lessons || []).map((les: any) => { 
        if (les?.id === resourceModal.lessonId) { 
          return { ...les, [resourceModal.type]: [...(les[resourceModal.type] || []), newResource] }; 
        } 
        return les; 
      }) 
    }));

    setResTitle(""); 
    setResUrl(""); 
    setVidType("lecture");
    if (setResourceModal) setResourceModal(null); 

    dispatchOptimisticUpdate(newChapters); 
  };

  const handleDeleteResource = (lessonId: string, resType: string, resId: string) => {
    if (!confirm("Xác nhận xóa tài nguyên này?")) return;

    if (viewResourcesModal && setViewResourcesModal) {
      setViewResourcesModal((prev: any) => prev ? {
        ...prev,
        items: (prev.items || []).filter((i: any) => i?.id !== resId)
      } : null);
    }

    const newChapters = (chapters || []).map((chap: any) => ({ 
      ...chap, 
      lessons: (chap?.lessons || []).map((les: any) => les?.id === lessonId ? { 
        ...les, 
        [resType]: (les[resType] || []).filter((r: any) => r?.id !== resId) 
      } : les) 
    }));

    dispatchOptimisticUpdate(newChapters);
  };

  const handleEditResourceSubmit = (e: React.FormEvent) => {
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
                title: editResourceForm.title.trim(), 
                url: editResourceForm.url?.trim() || r.url,
                type: editResourceModal.type === "video_list" ? editResourceForm.type : r.type
              } : r 
            )
          }; 
        } 
        return les; 
      }) 
    }));

    if (viewResourcesModal && setViewResourcesModal) {
      setViewResourcesModal((prev: any) => prev ? {
        ...prev,
        items: (prev.items || []).map((i: any) => i?.id === editResourceModal.item.id ? { 
          ...i, 
          title: editResourceForm.title.trim(), 
          url: editResourceForm.url?.trim() || i.url,
          type: editResourceModal.type === "video_list" ? editResourceForm.type : i.type
        } : i)
      } : null);
    }

    setEditResourceModal(null); 
    dispatchOptimisticUpdate(newChapters);
  };

  const handleAddDriveFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveLinkModal || !driveLinkForm.title.trim() || !driveLinkForm.url.trim()) return;

    const newItem = { 
      id: "drive-" + Date.now(), 
      title: driveLinkForm.title.trim(), 
      url: driveLinkForm.url.trim(), 
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

    setDriveLinkModal(null); 
    setDriveLinkForm({ title: "", url: "" }); 
    dispatchOptimisticUpdate(newChapters); 
  };

  const handleAddBoost = (e: React.FormEvent) => {
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

    if (setBoostModal) setBoostModal(null); 
    setBoostForm({ title: "", type: "video", url: "", note: "" }); 
    dispatchOptimisticUpdate(newChapters); 
  };

  const handleCreateNewItem = (e: React.FormEvent) => {
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

    if (setCreateModal) setCreateModal(null); 
    setNewItemTitle(""); 
    setNewItemDescription(""); 
    setNewItemFormat("Zoom");
    setNewItemTargetMode("all");
    dispatchOptimisticUpdate(newChapters); 
  };

  const handleEditLessonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLessonModal || !editLessonForm.title.trim()) return;

    const newChapters = (chapters || []).map((chap: any) => chap?.id === editLessonModal.chapterId ? {
      ...chap, lessons: (chap?.lessons || []).map((les: any) => les?.id === editLessonModal.lesson.id ? { ...les, ...editLessonForm } : les)
    } : chap);

    if (setEditLessonModal) setEditLessonModal(null); 
    dispatchOptimisticUpdate(newChapters); 
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
          className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs cursor-pointer font-sans"
        >
          <div className="bg-white rounded-[24px] max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] cursor-default animate-in zoom-in-95 duration-150 text-left">
            <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-100 flex items-start justify-between relative bg-white">
              <div>
                <span className="px-2.5 py-0.5 bg-blue-50 text-[#1D4ED8] rounded-md text-[10px] font-bold uppercase tracking-wider border border-blue-100">
                  GIAO DIỆN CHẤM THI & QUẢN LÝ ĐIỂM AZOTA
                </span>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1 tracking-tight">
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

            <div className="px-4 sm:px-6 py-2.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
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

            <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
              {filteredAttempts.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs font-semibold italic">
                  Chưa có lượt nộp bài nào trong phân hệ này.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {filteredAttempts.map((att: any, idx: number) => {
                    const attemptId = String(att.id || `att_${idx}`);
                    const delState = deletionStateMap[attemptId];
                    const displayName = att.resolvedName;
                    const isOffline = att.resolvedMode === "offline";
                    const avatarText = att.resolvedAvatar;
                    const scoreVal = Number(att.score ?? att.points ?? 0);
                    const submitDate = att.createdAt || att.created_at || att.submittedAt;
                    const formattedDate = submitDate
                      ? new Date(submitDate).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })
                      : "08/10/26";
                    const formattedTime = submitDate
                      ? new Date(submitDate).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
                      : "10:40";

                    if (delState?.step === "deleted") {
                      return (
                        <div
                          key={attemptId}
                          className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-2.5 rounded-xl flex items-center justify-between gap-2 shadow-2xs animate-in fade-in duration-150"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="font-semibold truncate">
                              ✓ Đã xóa bài của <strong>{displayName}</strong> — Chờ hoàn tất...
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUndoDeleteAttempt(attemptId)}
                            className="px-2.5 py-1 bg-white hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 rounded-lg font-bold text-[11px] transition flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Hoàn tác ({delState.countdown}s)</span>
                          </button>
                        </div>
                      );
                    }

                    if (delState?.step === "deleting") {
                      return (
                        <div
                          key={attemptId}
                          className="p-3 rounded-xl border border-rose-200 bg-rose-50/60 flex flex-col justify-center gap-2 shadow-2xs animate-in fade-in duration-150"
                        >
                          <div className="flex items-center justify-between text-xs font-bold text-rose-800">
                            <span className="flex items-center gap-1.5 truncate">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600 shrink-0" />
                              Đang xóa bài thi của {displayName}...
                            </span>
                            <span className="font-mono text-[11px]">{delState.progress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-rose-200/70 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-rose-600 transition-all duration-200 rounded-full"
                              style={{ width: `${delState.progress}%` }}
                            />
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={attemptId}
                        className="relative p-3 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow hover:border-slate-300 transition-all flex flex-col justify-between text-left gap-2"
                      >
                        {delState?.step === "confirm" && (
                          <div className="absolute top-2 right-2 z-20 bg-white border border-rose-200 shadow-lg rounded-xl p-2.5 flex items-center gap-2 animate-in zoom-in-95 duration-100">
                            <span className="text-[11px] font-bold text-slate-800 whitespace-nowrap">
                              Xóa bài thi này?
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCancelDeleteConfirm(attemptId)}
                              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] transition cursor-pointer"
                            >
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmStartDelete(att)}
                              className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition cursor-pointer shadow-2xs"
                            >
                              Xóa
                            </button>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0 uppercase">
                              {avatarText}
                            </div>
                            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                              <h4
                                className="font-semibold text-xs text-slate-800 truncate max-w-[120px]"
                                title={displayName}
                              >
                                {displayName}
                              </h4>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 font-bold tracking-wider rounded uppercase border ${
                                  isOffline
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                }`}
                              >
                                {isOffline ? "OFFLINE" : "ONLINE"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                              {scoreVal.toFixed(2)}đ
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAskDeleteAttempt(att)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title="Xóa lượt làm bài này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap py-1 border-y border-slate-100">
                          <span className="inline-flex items-center gap-1">
                            <span>⏱</span>
                            <strong className="text-slate-700 font-semibold">
                              {att.timeSpent || att.time_spent || "15 phút"}
                            </strong>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="inline-flex items-center gap-1">
                            <span>📅</span>
                            <strong className="text-slate-700 font-semibold">
                              {formattedTime} {formattedDate}
                            </strong>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="font-semibold text-slate-600">
                            Lần {att.attemptIndex || 1}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <div className="flex items-center gap-1 min-w-0 flex-1">
                            <span
                              className="text-[11px] text-slate-400 italic truncate"
                              title={att.feedback || "Chưa có nhận xét"}
                            >
                              {att.feedback || "Chưa có nhận xét"}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                const note = prompt("Nhập nhận xét cho học sinh:", att.feedback || "");
                                if (note !== null) {
                                  att.feedback = note;
                                  if (setAzotaScoreViewModal) {
                                    setAzotaScoreViewModal((prev: any) => ({
                                      ...prev,
                                      attempts: (prev.attempts || []).map((a: any) =>
                                        a?.id === att.id ? { ...a, feedback: note } : a
                                      ),
                                    }));
                                  }
                                  try {
                                    await fetch("/api/admin/data", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        action: "update_attempt_feedback",
                                        attemptId: att.id,
                                        feedback: note,
                                      }),
                                    });
                                  } catch (e) {}
                                  if (showToast) showToast("Đã lưu nhận xét!", "success");
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-[#1D4ED8] hover:bg-blue-50 rounded transition cursor-pointer shrink-0"
                              title="Sửa nhận xét"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenSubmissionDetail(att)}
                            className="bg-blue-50 text-[#1D4ED8] hover:bg-[#1D4ED8] hover:text-white transition-all text-xs font-medium px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0 cursor-pointer border border-blue-200/70"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem bài làm</span>
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

      {/* 1B. MODAL CON: XEM BÀI LÀM CHI TIẾT */}
      {viewingSubmission && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingSubmission(null);
          }}
          className="fixed inset-0 z-[550] flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs cursor-pointer font-sans"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-[24px] max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] cursor-default animate-in zoom-in-95 duration-150 text-left"
          >
            <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-[10px] font-extrabold uppercase tracking-wider">
                    CHI TIẾT BÀI LÀM HỌC SINH
                  </span>
                  <span className="text-xs font-bold text-slate-500 truncate">
                    • {azotaScoreViewModal.examTitle}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 mt-1 flex items-center gap-2 flex-wrap">
                  <span>{viewingSubmission.attempt.resolvedName || "Học sinh"}</span>
                  <span className="text-sm font-black text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-lg">
                    Điểm: {Number(viewingSubmission.attempt.score ?? viewingSubmission.attempt.points ?? 0).toFixed(2)}
                  </span>
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setViewingSubmission(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  ✓ Đúng: {submissionReviewData?.correctCount ?? 0} câu
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                  ✕ Sai: {submissionReviewData?.wrongCount ?? 0} câu
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 font-bold">
                  ○ Chưa làm: {submissionReviewData?.skippedCount ?? 0} câu
                </span>
              </div>
              <div className="text-slate-500 font-semibold flex items-center gap-3">
                <span>⏱ Thời gian làm: {viewingSubmission.attempt.timeSpent || viewingSubmission.attempt.time_spent || "15 phút"}</span>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4 bg-slate-50/40">
              {viewingSubmission.isLoadingExam ? (
                <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs font-bold">
                  <Loader2 className="w-6 h-6 animate-spin text-[#1D4ED8]" />
                  <span>Đang tải cấu trúc đề thi và bài làm chi tiết...</span>
                </div>
              ) : !submissionReviewData || submissionReviewData.questionsList.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
                  <p className="text-xs font-bold text-slate-700">
                    Bảng đáp án học sinh đã chọn (Đề thi gốc chưa có dữ liệu câu hỏi chi tiết):
                  </p>
                  {Object.keys(submissionReviewData?.rawUserAnswers || {}).length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      Lượt nộp bài này chỉ lưu điểm tổng kết ({Number(viewingSubmission.attempt.score ?? 0).toFixed(2)} điểm), không có dữ liệu chi tiết từng câu.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {Object.entries(submissionReviewData?.rawUserAnswers || {}).map(([k, v], i) => (
                        <div
                          key={k || i}
                          className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs"
                        >
                          <span className="font-bold text-slate-500">Câu {i + 1}:</span>
                          <span className="font-black text-[#1D4ED8]">
                            {typeof v === "object" ? JSON.stringify(v) : String(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                submissionReviewData.questionsList.map((q: any, index: number) => {
                  const isCorrect = q.status === "correct";
                  const isWrong = q.status === "wrong";
                  const mediaMap = submissionReviewData.mediaMap;

                  return (
                    <div
                      key={q.qId || index}
                      className={`p-4 rounded-2xl border bg-white shadow-2xs transition ${
                        isCorrect
                          ? "border-emerald-200"
                          : isWrong
                          ? "border-rose-200"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-[#1D4ED8] font-black text-xs border border-blue-200">
                            {q.original_label || `Câu ${q.globalOrder}`}
                          </span>
                          {q.sectionTitle && (
                            <span className="text-[11px] font-semibold text-slate-400 truncate max-w-[240px]">
                              {q.sectionTitle}
                            </span>
                          )}
                        </div>

                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase border ${
                            isCorrect
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : isWrong
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {isCorrect ? "✓ Chính xác" : isWrong ? "✕ Chọn sai" : "○ Bỏ trống"}
                        </span>
                      </div>

                      <SubmissionRichContent
                        content={q.prompt_html || q.prompt || q.text || ""}
                        mediaMap={mediaMap}
                        className="text-xs sm:text-[13px] text-slate-800 font-medium mb-3"
                      />

                      {q.image && (
                        <div className="my-2 flex justify-center">
                          <img
                            src={resolveSubmissionImageSrc(q.image, mediaMap)}
                            alt="Hình câu hỏi"
                            className="max-h-60 rounded-xl border border-slate-200 object-contain bg-white p-1"
                          />
                        </div>
                      )}

                      {q.qType === "multiple_choice" && Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2.5">
                          {q.options.map((opt: any, oIdx: number) => {
                            const optKey = String(opt?.key || ["A", "B", "C", "D"][oIdx] || "").trim().toUpperCase();
                            const stuPicked = String(q.stuAns || "").trim().toUpperCase() === optKey;
                            const isRightOpt = String(q.correctDisplay || "").trim().toUpperCase() === optKey;

                            let boxStyle = "border-slate-200 bg-slate-50/60 text-slate-700";
                            if (isRightOpt) {
                              boxStyle = "border-emerald-400 bg-emerald-50/90 text-emerald-900 font-bold ring-1 ring-emerald-400/30";
                            } else if (stuPicked && !isRightOpt) {
                              boxStyle = "border-rose-400 bg-rose-50/90 text-rose-900 font-bold ring-1 ring-rose-400/30";
                            }

                            return (
                              <div
                                key={optKey || oIdx}
                                className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${boxStyle}`}
                              >
                                <span
                                  className={`w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black shrink-0 ${
                                    isRightOpt
                                      ? "bg-emerald-600 text-white"
                                      : stuPicked
                                      ? "bg-rose-600 text-white"
                                      : "bg-white border border-slate-300 text-slate-600"
                                  }`}
                                >
                                  {optKey}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <SubmissionRichContent
                                    content={opt?.text_html || opt?.text || ""}
                                    mediaMap={mediaMap}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {q.qType === "true_false" && Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="space-y-1.5 my-2.5">
                          {q.options.map((opt: any, oIdx: number) => {
                            const optKey = String(opt?.key || ["a", "b", "c", "d"][oIdx] || "").trim();
                            return (
                              <div
                                key={optKey || oIdx}
                                className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs flex items-start justify-between gap-3"
                              >
                                <div className="flex items-start gap-2 min-w-0">
                                  <span className="font-black text-slate-700 shrink-0">{optKey})</span>
                                  <SubmissionRichContent
                                    content={opt?.text_html || opt?.text || ""}
                                    mediaMap={mediaMap}
                                  />
                                </div>
                                {typeof opt?.is_true_false_ans === "boolean" && (
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-black shrink-0 ${
                                      opt.is_true_false_ans
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    Đáp án: {opt.is_true_false_ans ? "Đúng" : "Sai"}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-slate-500 font-medium">Học sinh chọn:</span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-extrabold border ${
                              isCorrect
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                : isWrong
                                ? "bg-rose-50 text-rose-700 border-rose-300"
                                : "bg-slate-100 text-slate-600 border-slate-300"
                            }`}
                          >
                            {q.stuDisplay}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-medium">Đáp án đúng:</span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-extrabold">
                            {q.correctDisplay}
                          </span>
                        </div>
                      </div>

                      {(q.solution_html || q.explanation) && (
                        <div className="mt-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-slate-700">
                          <div className="font-extrabold text-amber-800 mb-1 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                            <span>Lời giải chi tiết:</span>
                          </div>
                          <SubmissionRichContent
                            content={q.solution_html || q.explanation}
                            mediaMap={mediaMap}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. MODAL THÊM TÀI NGUYÊN */}
      {resourceModal && (
        <div 
          onClick={() => setResourceModal && setResourceModal(null)} 
          className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm cursor-pointer font-sans"
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
                    className="w-full border border-slate-300 p-2.5 rounded-xl text-sm font-bold text-slate-800 bg-white cursor-pointer"
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

      {/* 3. MODAL XEM CHI TIẾT TÀI NGUYÊN */}
      {viewResourcesModal && (
        <div 
          onClick={() => setViewResourcesModal && setViewResourcesModal(null)}
          className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm cursor-pointer font-sans"
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
                        }} className="p-2 text-slate-300 hover:text-[#1D4ED8] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer shrink-0" title="Chỉnh sửa">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteResource(viewResourcesModal.lessonId, viewResourcesModal.type, item.id)} 
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Xóa ngay lập tức"
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
                onClick={() => {
                  const currentType = viewResourcesModal.type;
                  const currentLessonId = viewResourcesModal.lessonId;
                  if (setViewResourcesModal) setViewResourcesModal(null);

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

      {/* 4. MODAL SỬA TÀI NGUYÊN */}
      {editResourceModal && (
        <div 
          onClick={() => setEditResourceModal(null)} 
          className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm cursor-pointer font-sans"
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
          className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 cursor-pointer font-sans"
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
          className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 cursor-pointer font-sans"
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

      {/* 7. MODAL THÊM TÀI LIỆU TĂNG CƯỜNG */}
      {boostModal && (
        <div 
          onClick={() => setBoostModal && setBoostModal(null)} 
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm cursor-pointer font-sans"
        >
          <form onClick={(e) => e.stopPropagation()} onSubmit={handleAddBoost} className="bg-white rounded-[24px] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 cursor-default text-left">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-amber-600 text-[15px] flex items-center gap-2"><Zap className="w-5 h-5 fill-amber-500" /> Thêm tài liệu tăng cường</h3>
              <button type="button" onClick={() => setBoostModal(null)} className="text-slate-400 hover:text-rose-500 cursor-pointer"><X className="w-5 h-5"/></button>
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
              <button type="button" onClick={() => setBoostModal(null)} className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer">Hủy</button>
              <button type="submit" className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs shadow-sm cursor-pointer">Lưu tăng cường</button>
            </div>
          </form>
        </div>
      )}

      {/* 8. MODAL THÊM CHƯƠNG / BÀI HỌC MỚI */}
      {createModal && (
        <div 
          onClick={() => setCreateModal && setCreateModal(null)} 
          className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-xl cursor-pointer font-sans"
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

      {/* 9. MODAL CHỈNH SỬA BÀI HỌC */}
      {editLessonModal && editLessonForm && (
        <div 
          onClick={() => setEditLessonModal && setEditLessonModal(null)} 
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm cursor-pointer font-sans"
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
                  <select value={editLessonForm.format} onChange={e => setEditLessonForm({...editLessonForm, format: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none bg-white cursor-pointer">
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

      {/* 10. MODAL TRÍCH XUẤT ĐỀ THI AZOTA */}
      {testFile && (
        <AzotaExamConfigModal 
          isOpen={Boolean(testFile)} 
          file={testFile}
          initialData={editingExamData ? {
            title: editingExamData.title,
            category: editingExamData.category,
            duration_minutes: editingExamData.duration_minutes,
            sections: editingExamData.data || editingExamData.sections,
            mediaMap: editingExamData.media_map || editingExamData.mediaMap
          } : undefined}
          mode={uploadMode || "course"} 
          onClose={() => { 
            if (setTestFile) setTestFile(null); 
            if (setEditingExamData) setEditingExamData(null); 
            if (setAzotaTarget) setAzotaTarget(null);
          }} 
          onSave={(examData: any) => {
            if (typeof onSaveAzotaExam === "function") {
              onSaveAzotaExam(examData);
            }
            if (setTestFile) setTestFile(null); 
            if (setEditingExamData) setEditingExamData(null); 
            if (setAzotaTarget) setAzotaTarget(null);
          }}
        />
      )}
    </>
  );
}
