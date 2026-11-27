"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  FileUp,
  Search,
  Video,
  Trash2,
  Edit3,
  Play,
  Eye,
  Loader2,
  FolderOpen,
  Users,
  Printer,
  Camera,
  RefreshCw,
  X,
  FilePlus2,
  FileText
} from "lucide-react";
import { supabase as defaultSupabaseClient } from "@/lib/supabaseClient";
import {
  deriveExamCode3Digits,
  extractExamQuestionCounts,
  openPrintableDynamicAnswerSheet
} from "@/lib/omrEngine";
import { AdminBulkOMRScannerModal } from "@/components/admin/paper/AdminBulkOMRScannerModal";
import { AzotaExamConfigModal } from "@/app/admin/AzotaExamConfigModal";

export const PRACTICE_CATEGORIES = [
  "Tất cả danh mục",
  "Đề thi thử THPT Quốc Gia",
  "Đề luyện thi ĐGNL (HSA/TSA)",
  "Đề thi giữa kỳ",
  "Đề thi học kỳ",
  "Đề tổng ôn chuyên đề",
  "Tự do"
];

type ExamSourceTab = "practice" | "homework" | "test";

interface ExamAttachmentItem {
  id: string;
  title: string;
  url: string;
}

function parseExamAttachments(exam: any): ExamAttachmentItem[] {
  const result: ExamAttachmentItem[] = [];
  const seenUrls = new Set<string>();

  const pushItem = (raw: any, fallbackTitle: string) => {
    if (!raw) return;
    const url = String(raw.url || "").trim();
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    result.push({
      id: String(raw.id || `att-${Date.now()}-${result.length}`),
      title: String(raw.title || fallbackTitle).trim() || fallbackTitle,
      url
    });
  };

  let rawAttachments: any = exam?.attachments;
  if (typeof rawAttachments === "string" && rawAttachments.trim().startsWith("[")) {
    try {
      rawAttachments = JSON.parse(rawAttachments);
    } catch {
      rawAttachments = [];
    }
  }
  if (Array.isArray(rawAttachments)) {
    rawAttachments.forEach((item: any, idx: number) =>
      pushItem(item, `Tài liệu đính kèm ${idx + 1}`)
    );
  }

  const rawDriveUrl = String(exam?.driveUrl || "").trim();
  if (rawDriveUrl) {
    if (rawDriveUrl.startsWith("[")) {
      try {
        const parsed = JSON.parse(rawDriveUrl);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any, idx: number) =>
            pushItem(item, `Tài liệu đính kèm ${idx + 1}`)
          );
        }
      } catch {}
    } else if (/^https?:\/\//i.test(rawDriveUrl)) {
      pushItem(
        { id: "legacy-drive", title: "File đề thi (PDF / Drive)", url: rawDriveUrl },
        "File đề thi (PDF / Drive)"
      );
    }
  }

  return result.slice(0, 3);
}

function normalizeStr(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVietnameseSearch(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isCourseHomeworkOrPeriodicTest(exam: any): boolean {
  if (!exam) return true;
  if (exam.isHomework === true || exam.is_homework === true) return true;

  const idStr = String(exam.id || exam.quiz_id || "").trim().toLowerCase();
  if (idStr.startsWith("hw-")) return true;

  const catLower = normalizeStr(exam.category);
  const catNoAccent = normalizeVietnameseSearch(exam.category);
  if (
    catLower.includes("bài tập về nhà") ||
    catLower.includes("btvn") ||
    catLower.includes("đề kiểm tra định kỳ") ||
    catLower.includes("kiểm tra định kỳ") ||
    catNoAccent.includes("bai tap ve nha") ||
    catNoAccent.includes("kiem tra dinh ky")
  ) {
    return true;
  }

  return false;
}

function extractExamTimestampScore(exam: any): number {
  if (!exam) return 0;

  const rawTime = exam.created_at || exam.updated_at || exam.createdAt || exam.updatedAt;
  if (rawTime) {
    const parsedTime = new Date(rawTime).getTime();
    if (!isNaN(parsedTime) && parsedTime > 0) {
      return parsedTime;
    }
  }

  const idStr = String(exam.id || exam.quiz_id || "");
  const tsMatch = idStr.match(/(\d{10,14})/);
  if (tsMatch && tsMatch[1]) {
    const num = Number(tsMatch[1]);
    if (!isNaN(num) && num > 0) return num;
  }

  const anyNumMatch = idStr.match(/(\d+)/);
  if (anyNumMatch && anyNumMatch[1]) {
    return Number(anyNumMatch[1]) || 0;
  }

  return 0;
}

function resolveSmartCategory(exam: any, fallbackCategory?: string): string {
  const rawCat = String(exam?.category || fallbackCategory || "").trim();
  const rawFormat = String(exam?.exam_format || "").trim().toLowerCase();
  const titleSearch = normalizeVietnameseSearch(exam?.title || "");
  const catSearch = normalizeVietnameseSearch(rawCat);

  if (rawFormat === "hsa" || /\b(hsa|tsa|dgnl)\b/i.test(catSearch)) {
    return "Đề luyện thi ĐGNL (HSA/TSA)";
  }

  if (
    rawCat &&
    PRACTICE_CATEGORIES.includes(rawCat) &&
    rawCat !== "Tất cả danh mục" &&
    rawCat !== "Tự do"
  ) {
    return rawCat;
  }

  if (
    catSearch.includes("giua ky") ||
    catSearch.includes("giua ki") ||
    titleSearch.includes("giua ky") ||
    titleSearch.includes("giua ki") ||
    /\b(gk1|gk2)\b/i.test(titleSearch)
  ) {
    return "Đề thi giữa kỳ";
  }

  if (
    catSearch.includes("hoc ky") ||
    catSearch.includes("hoc ki") ||
    catSearch.includes("cuoi ky") ||
    catSearch.includes("cuoi ki") ||
    titleSearch.includes("hoc ky") ||
    titleSearch.includes("hoc ki") ||
    titleSearch.includes("cuoi ky") ||
    titleSearch.includes("cuoi ki") ||
    /\b(hk1|hk2)\b/i.test(titleSearch)
  ) {
    return "Đề thi học kỳ";
  }

  if (/\b(hsa|tsa|dgnl)\b/i.test(titleSearch)) {
    return "Đề luyện thi ĐGNL (HSA/TSA)";
  }

  if (
    catSearch.includes("thpt") ||
    catSearch.includes("thi thu") ||
    titleSearch.includes("thi thu") ||
    /\bthpt\b/i.test(titleSearch)
  ) {
    return "Đề thi thử THPT Quốc Gia";
  }

  if (
    catSearch.includes("tong on") ||
    catSearch.includes("chuyen de") ||
    titleSearch.includes("tong on")
  ) {
    return "Đề tổng ôn chuyên đề";
  }

  return PRACTICE_CATEGORIES.includes(rawCat) && rawCat !== "Tất cả danh mục" ? rawCat : "Tự do";
}

function detectHsaExamInfo(exam: any, resolvedTotalQuestions: number): {
  isHsa: boolean;
  partsCount: number;
  maxPoints: number;
  partShortNames: string[];
  badgeText: string;
} {
  if (exam?.sourceType === "homework" || exam?.sourceType === "test") {
    return {
      isHsa: false,
      partsCount: 0,
      maxPoints: 10,
      partShortNames: [],
      badgeText: ""
    };
  }

  const rawFormat = String(exam?.exam_format || "").trim().toLowerCase();
  const rawCat = String(exam?.category || "").trim();
  const rawTitle = String(exam?.title || "").trim();

  if (rawFormat === "thpt") {
    return {
      isHsa: false,
      partsCount: 0,
      maxPoints: 10,
      partShortNames: [],
      badgeText: ""
    };
  }

  const rawSecs = Array.isArray(exam?.data)
    ? exam.data
    : Array.isArray(exam?.sections)
      ? exam.sections
      : [];

  const hasHsaSectionKey = rawSecs.some((s: any) => {
    const k = String(s?.part_key || s?.key || "").toLowerCase();
    return (
      k === "quant" ||
      k === "qual" ||
      k === "english" ||
      k === "history_geo" ||
      Number(s?.max_points || s?.maxScore) === 50
    );
  });

  const isHsa =
    rawFormat === "hsa" ||
    /\b(hsa|đgnl|dgnl)\b/i.test(rawCat) ||
    /\bhsa\b/i.test(rawTitle) ||
    hasHsaSectionKey;

  if (!isHsa) {
    return {
      isHsa: false,
      partsCount: 0,
      maxPoints: 10,
      partShortNames: [],
      badgeText: ""
    };
  }

  const detectedKeys = new Set<string>();
  const partShortNames: string[] = [];

  if (rawSecs.length > 0) {
    rawSecs.forEach((s: any) => {
      const k = String(s?.part_key || s?.key || "").toLowerCase();
      if (k === "quant") {
        detectedKeys.add("quant");
        partShortNames.push("Định lượng");
      } else if (k === "qual") {
        detectedKeys.add("qual");
        partShortNames.push("Định tính");
      } else if (k === "english") {
        detectedKeys.add("english");
        partShortNames.push("Tiếng Anh");
      } else if (k === "history_geo") {
        detectedKeys.add("history_geo");
        partShortNames.push("Sử - Địa");
      } else if (s?.shortTitle || s?.title) {
        partShortNames.push(String(s.shortTitle || s.title));
      }
    });
  }

  let partsCount = 1;
  if (typeof exam?.hsa_parts_count === "number" && exam.hsa_parts_count > 0) {
    partsCount = Math.min(4, Math.max(1, exam.hsa_parts_count));
  } else if (detectedKeys.size > 0) {
    partsCount = Math.min(4, detectedKeys.size);
  } else if (rawSecs.length > 0) {
    partsCount = Math.min(4, Math.max(1, rawSecs.length));
  } else if (resolvedTotalQuestions >= 180) {
    partsCount = 4;
  } else if (resolvedTotalQuestions >= 115) {
    partsCount = 3;
  } else if (resolvedTotalQuestions >= 65) {
    partsCount = 2;
  } else {
    partsCount = 1;
  }

  const hasAllFour =
    partsCount >= 4 ||
    (detectedKeys.has("quant") &&
      detectedKeys.has("qual") &&
      detectedKeys.has("english") &&
      detectedKeys.has("history_geo"));

  const badgeText = hasAllFour
    ? "HSA • Đủ 2 bắt buộc + 2 tự chọn (Anh / Sử-Địa)"
    : `HSA • Đã up ${partsCount}/4 phần`;

  return {
    isHsa: true,
    partsCount,
    maxPoints: Math.min(150, partsCount * 50),
    partShortNames,
    badgeText
  };
}

function safeSaveExamsToLocal(exams: any[]) {
  if (typeof window === "undefined" || !Array.isArray(exams) || exams.length === 0) return;
  try {
    const slim = exams
      .filter((ex: any) => !isCourseHomeworkOrPeriodicTest(ex))
      .map((ex: any) => ({
        id: ex?.id,
        title: ex?.title,
        exam_code: ex?.exam_code,
        category: ex?.category || "Tự do",
        exam_format: ex?.exam_format,
        hsa_parts_count: ex?.hsa_parts_count,
        total_points: ex?.total_points,
        duration_minutes: ex?.duration_minutes || 90,
        total_questions: ex?.total_questions,
        target_mode: ex?.target_mode || "all",
        allowRetake: ex?.allowRetake ?? true,
        allowViewFile: ex?.allowViewFile ?? true,
        driveUrl: ex?.driveUrl || "",
        attachments: parseExamAttachments(ex),
        solutionVideoUrl: ex?.solutionVideoUrl || "",
        data: ex?.data || ex?.sections || undefined,
        created_at: ex?.created_at || new Date().toISOString()
      }));
    localStorage.setItem("edunexus_practice_exams", JSON.stringify(slim));
  } catch {}
}

export interface PracticeTabProps {
  practiceSubTab?: "manage" | "scores";
  setPracticeSubTab?: (tab: "manage" | "scores") => void;
  practiceExams?: any[];
  allAttempts?: any[];
  registeredStudents?: any[];
  chapters?: any[];
  isLoadingExams?: boolean;
  uploadProgressText?: string | null;
  setTestFile?: (file: File | null) => void;
  setUploadMode?: (mode: "course" | "practice") => void;
  setEditingExamData?: (data: any | null) => void;
  handleChangeExamCategory?: (examId: string, newCategory: string) => void;
  savePracticeExams?: (newExams: any[]) => Promise<void> | void;
  supabase?: any;
  showToast?: (msg: string, type?: "success" | "error") => void;
  setVideoModalExam?: (exam: any | null) => void;
  setSolutionVideoInput?: (val: string) => void;
  setAttachmentsModalExam?: (exam: any | null) => void;
  setAzotaScoreViewModal?: (modal: {
    isOpen: boolean;
    examTitle: string;
    attempts: any[];
  }) => void;
  onOpenExamEditor?: (exam: any) => void;
  onTestExam?: (exam: any) => void;
  onAppendHsaPart?: (exam: any, file: File) => void;
  practiceCategoryFilter?: string;
  setPracticeCategoryFilter?: (cat: string) => void;
  examsWithScoresData?: any[];
  practiceSyncStatus?: {
    isSyncing: boolean;
    progress: number;
    message: string;
    type: "idle" | "loading" | "success" | "error";
  };
}

export default function PracticeTab({
  practiceSubTab = "manage",
  setPracticeSubTab,
  practiceExams: propPracticeExams = [],
  allAttempts: propAllAttempts = [],
  registeredStudents: propRegisteredStudents = [],
  chapters: propChapters = [],
  isLoadingExams: propIsLoadingExams = false,
  uploadProgressText = null,
  setTestFile,
  setUploadMode,
  setEditingExamData,
  handleChangeExamCategory,
  savePracticeExams,
  supabase: propSupabase,
  showToast,
  setVideoModalExam,
  setSolutionVideoInput,
  setAttachmentsModalExam,
  setAzotaScoreViewModal,
  onOpenExamEditor,
  onTestExam,
  onAppendHsaPart,
  practiceCategoryFilter: propCategoryFilter = "Tất cả danh mục",
  setPracticeCategoryFilter: propSetCategoryFilter,
  practiceSyncStatus
}: PracticeTabProps) {
  const effectiveSupabase = propSupabase || defaultSupabaseClient;

  // BỘ LỌC NGUỒN ĐỀ: Mặc định chỉ hiển thị Kho Đề luyện thi (`practice_exams`)
  const [examSourceTab, setExamSourceTab] = useState<ExamSourceTab>("practice");

  const [localCategoryFilter, setLocalCategoryFilter] = useState<string>(() =>
    PRACTICE_CATEGORIES.includes(propCategoryFilter) ? propCategoryFilter : "Tất cả danh mục"
  );
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [loadingSingleExamId, setLoadingSingleExamId] = useState<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  const [hsaAppendModalState, setHsaAppendModalState] = useState<{
    isOpen: boolean;
    targetExam: any | null;
    file: File | null;
  }>({
    isOpen: false,
    targetExam: null,
    file: null
  });

  useEffect(() => {
    if (propCategoryFilter && PRACTICE_CATEGORIES.includes(propCategoryFilter)) {
      setLocalCategoryFilter(propCategoryFilter);
    } else if (propCategoryFilter && !PRACTICE_CATEGORIES.includes(propCategoryFilter)) {
      setLocalCategoryFilter("Tất cả danh mục");
    }
  }, [propCategoryFilter]);

  const activeCategoryFilter = PRACTICE_CATEGORIES.includes(localCategoryFilter)
    ? localCategoryFilter
    : "Tất cả danh mục";

  const handleSelectCategoryFilter = (newCategory: string) => {
    const safeCat = PRACTICE_CATEGORIES.includes(newCategory) ? newCategory : "Tất cả danh mục";
    setLocalCategoryFilter(safeCat);
    if (typeof propSetCategoryFilter === "function") {
      propSetCategoryFilter(safeCat);
    }
  };

  const [internalExams, setInternalExams] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const merged: any[] = [];
      const seenIds = new Set<string>();
      const keys = ["edunexus_practice_exams", "edunexus_quizzes", "tct_practice_exams"];
      for (const k of keys) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
              if (isCourseHomeworkOrPeriodicTest(item)) return;
              const id = String(item?.id || "").trim();
              if (id && !seenIds.has(id)) {
                seenIds.add(id);
                merged.push(item);
              }
            });
          }
        } catch {}
      }
      return merged;
    }
    return [];
  });

  const [internalChapters, setInternalChapters] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("edunexus_course_data");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });

  const [internalStudents, setInternalStudents] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cachedStu = localStorage.getItem("edunexus_registered_students");
        if (cachedStu) {
          const parsed = JSON.parse(cachedStu);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
        const cachedSbd = localStorage.getItem("edunexus_sbd_directory");
        if (cachedSbd) {
          const parsedSbd = JSON.parse(cachedSbd);
          if (Array.isArray(parsedSbd) && parsedSbd.length > 0) return parsedSbd;
        }
      } catch {}
    }
    return [];
  });

  const [internalAttempts, setInternalAttempts] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cachedAtt = localStorage.getItem("edunexus_attempts");
        if (cachedAtt) {
          const parsed = JSON.parse(cachedAtt);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });

  const [deletedExamIds, setDeletedExamIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("edunexus_deleted_exam_ids");
        if (raw) return new Set(JSON.parse(raw));
      } catch {}
    }
    return new Set();
  });

  const [isSelfFetching, setIsSelfFetching] = useState<boolean>(false);

  const [showSbdModal, setShowSbdModal] = useState<boolean>(false);
  const [sbdModeFilter, setSbdModeFilter] = useState<"all" | "offline" | "online">("all");
  const [sbdSelectedExamId, setSbdSelectedExamId] = useState<string>("none");
  const [scannerTargetExam, setScannerTargetExam] = useState<any | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (Array.isArray(propPracticeExams) && propPracticeExams.length > 0) {
      setInternalExams((prev) => {
        const map = new Map<string, any>();
        prev.forEach((ex) => {
          if (ex?.id && !isCourseHomeworkOrPeriodicTest(ex)) map.set(String(ex.id), ex);
        });
        propPracticeExams.forEach((ex) => {
          if (ex?.id && !isCourseHomeworkOrPeriodicTest(ex)) {
            const existing = map.get(String(ex.id));
            map.set(String(ex.id), {
              ...existing,
              ...ex,
              data: ex.data || existing?.data,
              sections: ex.sections || existing?.sections
            });
          }
        });
        const merged = Array.from(map.values()).sort(
          (a, b) => extractExamTimestampScore(b) - extractExamTimestampScore(a)
        );
        safeSaveExamsToLocal(merged);
        return merged;
      });
    }
  }, [propPracticeExams]);

  useEffect(() => {
    if (Array.isArray(propChapters) && propChapters.length > 0) {
      setInternalChapters(propChapters);
    }
  }, [propChapters]);

  useEffect(() => {
    if (Array.isArray(propRegisteredStudents) && propRegisteredStudents.length > 0) {
      setInternalStudents(propRegisteredStudents);
    }
  }, [propRegisteredStudents]);

  useEffect(() => {
    if (Array.isArray(propAllAttempts) && propAllAttempts.length > 0) {
      setInternalAttempts(propAllAttempts);
    }
  }, [propAllAttempts]);

  /**
   * HÀM NẠP DANH SÁCH ĐỀ SIÊU NHẸ (< 15 KB):
   * TUYỆT ĐỐI KHÔNG SELECT CỘT `data`, `questions`, `content`, `media_map`!
   */
  const fetchExamsAndStudentsSafely = useCallback(
    async (notifyUser: boolean = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setIsSelfFetching(true);

      const collectedExamsMap = new Map<string, any>();
      let recoveredStudents: any[] = [];
      let recoveredAttempts: any[] = [];

      const addExamToCollector = (ex: any, defaultCategory?: string) => {
        if (!ex || isCourseHomeworkOrPeriodicTest(ex)) return;
        const id = String(ex.id || ex.quiz_id || "").trim();
        if (!id) return;
        const existing = collectedExamsMap.get(id);
        collectedExamsMap.set(id, {
          ...existing,
          ...ex,
          id,
          category: resolveSmartCategory(ex, existing?.category || defaultCategory),
          data: ex.data || existing?.data,
          sections: ex.sections || existing?.sections
        });
      };

      internalExams.forEach((ex) => addExamToCollector(ex));

      if (effectiveSupabase) {
        try {
          const { data: sbExamsWithAttach, error: attachErr } = await effectiveSupabase
            .from("practice_exams")
            .select(`
              id,
              title,
              exam_code,
              category,
              exam_format,
              hsa_parts_count,
              duration_minutes,
              total_questions,
              allowRetake,
              allowViewFile,
              driveUrl,
              attachments,
              solutionVideoUrl,
              created_at,
              updated_at
            `)
            .order("created_at", { ascending: false });

          if (!attachErr && Array.isArray(sbExamsWithAttach)) {
            sbExamsWithAttach.forEach((ex: any) => addExamToCollector(ex));
          } else {
            const { data: sbExamsLight, error: lightErr } = await effectiveSupabase
              .from("practice_exams")
              .select(`
                id,
                title,
                exam_code,
                category,
                duration_minutes,
                total_questions,
                allowRetake,
                allowViewFile,
                driveUrl,
                solutionVideoUrl,
                created_at,
                updated_at
              `)
              .order("created_at", { ascending: false });

            if (!lightErr && Array.isArray(sbExamsLight)) {
              sbExamsLight.forEach((ex: any) => addExamToCollector(ex));
            } else {
              const { data: sbExamsMin, error: minErr } = await effectiveSupabase
                .from("practice_exams")
                .select(
                  "id, title, category, duration_minutes, allowRetake, allowViewFile, driveUrl, solutionVideoUrl, created_at"
                )
                .order("created_at", { ascending: false });

              if (!minErr && Array.isArray(sbExamsMin)) {
                sbExamsMin.forEach((ex: any) => addExamToCollector(ex));
              } else {
                const { data: sbExamsCore, error: coreErr } = await effectiveSupabase
                  .from("practice_exams")
                  .select("id, title, category, duration_minutes, created_at")
                  .order("created_at", { ascending: false });

                if (!coreErr && Array.isArray(sbExamsCore)) {
                  sbExamsCore.forEach((ex: any) => addExamToCollector(ex));
                } else if (coreErr) {
                  console.error("Supabase Error Details (practice_exams core):", coreErr);
                }
              }
            }
          }
        } catch (err) {
          console.error("Supabase Error Details (practice_exams exception):", err);
        }

        if (propChapters.length === 0 && internalChapters.length === 0) {
          try {
            const { data: courseRows, error: courseErr } = await effectiveSupabase
              .from("courses")
              .select("id, chapters")
              .limit(1);

            if (!courseErr && Array.isArray(courseRows) && courseRows.length > 0) {
              const loadedChaps = courseRows[0]?.chapters;
              if (Array.isArray(loadedChaps) && loadedChaps.length > 0) {
                setInternalChapters(loadedChaps);
              }
            }
          } catch {}
        }

        if (propRegisteredStudents.length === 0 && internalStudents.length === 0) {
          try {
            const { data: sbProfiles } = await effectiveSupabase
              .from("profiles")
              .select(
                "id, student_code, full_name, username, school, grade, role, learning_mode, study_mode"
              )
              .limit(200);
            if (Array.isArray(sbProfiles) && sbProfiles.length > 0) {
              recoveredStudents = sbProfiles.filter(
                (p: any) => p.role !== "admin" && p.role !== "teacher"
              );
            }
          } catch {}
        }

        if (propAllAttempts.length === 0 && internalAttempts.length === 0) {
          try {
            const { data: sbAtt } = await effectiveSupabase
              .from("exam_attempts")
              .select(
                "id, exam_id, quiz_id, student_id, student_name, exam_title, score, total_questions, correct_answers_count, submission_type, created_at"
              )
              .order("created_at", { ascending: false })
              .limit(200);
            if (Array.isArray(sbAtt) && sbAtt.length > 0) {
              recoveredAttempts = sbAtt;
            }
          } catch {}
        }
      }

      const finalMergedExams = Array.from(collectedExamsMap.values()).sort(
        (a, b) => extractExamTimestampScore(b) - extractExamTimestampScore(a)
      );

      if (finalMergedExams.length > 0) {
        setInternalExams(finalMergedExams);
        safeSaveExamsToLocal(finalMergedExams);
        if (typeof savePracticeExams === "function") {
          try {
            savePracticeExams(finalMergedExams);
          } catch {}
        }
      }

      if (recoveredStudents.length > 0) {
        setInternalStudents(recoveredStudents);
      }

      if (recoveredAttempts.length > 0) {
        setInternalAttempts(recoveredAttempts);
      }

      isFetchingRef.current = false;
      setIsSelfFetching(false);

      if (notifyUser && showToast) {
        showToast(
          `Đã đồng bộ siêu tốc ${finalMergedExams.length} đề luyện thi (Tiết kiệm 99% băng thông Egress)!`,
          "success"
        );
      }
    },
    [
      effectiveSupabase,
      internalExams,
      propChapters.length,
      internalChapters.length,
      propRegisteredStudents.length,
      internalStudents.length,
      propAllAttempts.length,
      internalAttempts.length,
      savePracticeExams,
      showToast
    ]
  );

  useEffect(() => {
    if (propPracticeExams.length === 0) {
      fetchExamsAndStudentsSafely(false);
    }
  }, []);

  /**
   * LAZY-LOAD ON-DEMAND: CHỈ TẢI NỘI DUNG CÂU HỎI CHI TIẾT (`data`, `media_map`) CỦA ĐÚNG 1 BẢN GHI THEO ID!
   * Hỗ trợ đầy đủ cả 3 nguồn: `practice_exams`, `homeworks` (BTVN buổi học) và `lessons.test_quizzes` (Đề kiểm tra).
   */
  const ensureFullExamDataLoaded = useCallback(
    async (exam: any): Promise<any> => {
      if (!exam || !exam.id) return exam;

      const hasQuestionsLoaded =
        (Array.isArray(exam.data) && exam.data.length > 0) ||
        (Array.isArray(exam.sections) && exam.sections.length > 0) ||
        (Array.isArray(exam.questions) && exam.questions.length > 0);

      if (hasQuestionsLoaded || !effectiveSupabase) {
        return exam;
      }

      const targetId = String(exam.id).trim();
      const sourceType: ExamSourceTab =
        exam.sourceType || (exam.isHomework || exam.is_homework ? "homework" : "practice");

      setLoadingSingleExamId(targetId);
      try {
        // 1. NGUỒN BTVN BUỔI HỌC -> tải từ bảng `homeworks` theo ID (fallback `lessons.homework_files`)
        if (sourceType === "homework") {
          const { data: hwFull, error: hwErr } = await effectiveSupabase
            .from("homeworks")
            .select("id, lesson_id, title, data, sections, media_map, duration_minutes")
            .eq("id", targetId)
            .maybeSingle();

          let resolvedHw = !hwErr && hwFull ? hwFull : null;

          if (!resolvedHw) {
            const { data: hwMin, error: hwMinErr } = await effectiveSupabase
              .from("homeworks")
              .select("id, title, data, duration_minutes")
              .eq("id", targetId)
              .maybeSingle();
            if (!hwMinErr && hwMin) {
              resolvedHw = hwMin;
            }
          }

          if (!resolvedHw && exam.lessonId) {
            const { data: lesRow } = await effectiveSupabase
              .from("lessons")
              .select("id, homework_files")
              .eq("id", String(exam.lessonId))
              .maybeSingle();
            if (Array.isArray(lesRow?.homework_files)) {
              const found = lesRow.homework_files.find(
                (item: any) => String(item?.id || "").trim() === targetId
              );
              if (found) resolvedHw = found;
            }
          }

          if (resolvedHw) {
            const resolvedData = resolvedHw.data || resolvedHw.sections || exam.data || [];
            return {
              ...exam,
              ...resolvedHw,
              data: resolvedData,
              sections: resolvedData,
              media_map: resolvedHw.media_map || resolvedHw.mediaMap || exam.media_map || {}
            };
          }
          return exam;
        }

        // 2. NGUỒN ĐỀ KIỂM TRA (TEST) -> tải từ `lessons.test_quizzes` theo `lessonId` (fallback `homeworks` / `curriculum_data`)
        if (sourceType === "test") {
          let resolvedTest: any = null;

          if (exam.lessonId) {
            const { data: lesRow } = await effectiveSupabase
              .from("lessons")
              .select("id, test_quizzes")
              .eq("id", String(exam.lessonId))
              .maybeSingle();
            if (Array.isArray(lesRow?.test_quizzes)) {
              const found = lesRow.test_quizzes.find(
                (item: any) => String(item?.id || "").trim() === targetId
              );
              if (found) resolvedTest = found;
            }
          }

          if (!resolvedTest) {
            const { data: hwFallback } = await effectiveSupabase
              .from("homeworks")
              .select("id, title, data, media_map, duration_minutes")
              .eq("id", targetId)
              .maybeSingle();
            if (hwFallback) resolvedTest = hwFallback;
          }

          if (!resolvedTest) {
            const { data: currRow } = await effectiveSupabase
              .from("curriculum_data")
              .select("chapters")
              .eq("id", "main_curriculum")
              .maybeSingle();
            if (Array.isArray(currRow?.chapters)) {
              for (const chap of currRow.chapters) {
                for (const les of chap?.lessons || []) {
                  const found = (les?.test_quizzes || []).find(
                    (item: any) => String(item?.id || "").trim() === targetId
                  );
                  if (found) {
                    resolvedTest = found;
                    break;
                  }
                }
                if (resolvedTest) break;
              }
            }
          }

          if (resolvedTest) {
            const resolvedData = resolvedTest.data || resolvedTest.sections || exam.data || [];
            return {
              ...exam,
              ...resolvedTest,
              data: resolvedData,
              sections: resolvedData,
              media_map: resolvedTest.media_map || resolvedTest.mediaMap || exam.media_map || {}
            };
          }
          return exam;
        }

        // 3. NGUỒN ĐỀ LUYỆN THI (`practice_exams`)
        const { data: fullRow, error } = await effectiveSupabase
          .from("practice_exams")
          .select(
            "id, title, category, exam_format, duration_minutes, data, media_map, driveUrl, solutionVideoUrl"
          )
          .eq("id", targetId)
          .single();

        let resolvedRow = !error && fullRow ? fullRow : null;

        if (!resolvedRow) {
          const { data: fallbackRow, error: fbErr } = await effectiveSupabase
            .from("practice_exams")
            .select("id, title, category, duration_minutes, data, driveUrl, solutionVideoUrl")
            .eq("id", targetId)
            .single();
          if (!fbErr && fallbackRow) {
            resolvedRow = fallbackRow;
          }
        }

        if (resolvedRow) {
          const enrichedExam = {
            ...exam,
            ...resolvedRow,
            data: resolvedRow.data || exam.data || [],
            sections: resolvedRow.data || exam.sections || []
          };

          setInternalExams((prev) =>
            prev.map((item) => (String(item?.id) === targetId ? enrichedExam : item))
          );

          return enrichedExam;
        }
      } catch (err) {
        console.error("Lỗi tải chi tiết đề thi theo ID:", err);
      } finally {
        setLoadingSingleExamId(null);
      }

      return exam;
    },
    [effectiveSupabase]
  );

  const effectiveChapters = useMemo(() => {
    if (Array.isArray(propChapters) && propChapters.length > 0) return propChapters;
    return internalChapters;
  }, [propChapters, internalChapters]);

  // NGUỒN 1 (MẶC ĐỊNH): KHO ĐỀ LUYỆN THI (`practice_exams`)
  const effectiveExams = useMemo(() => {
    const unifiedMap = new Map<string, any>();

    const pushExam = (ex: any, fallbackCategory?: string) => {
      if (!ex || ex.is_drive_file) return;
      if (isCourseHomeworkOrPeriodicTest(ex)) return;

      const id = String(ex.id || ex.quiz_id || "").trim();
      if (!id || deletedExamIds.has(id)) return;

      const existing = unifiedMap.get(id);
      const resolvedCat = resolveSmartCategory(ex, existing?.category || fallbackCategory);

      unifiedMap.set(id, {
        ...existing,
        ...ex,
        id,
        sourceType: "practice" as ExamSourceTab,
        title: String(ex.title || existing?.title || "Đề luyện thi"),
        category: resolvedCat,
        duration_minutes: Number(ex.duration_minutes || existing?.duration_minutes || 90),
        data: ex.data || existing?.data,
        sections: ex.sections || existing?.sections,
        attachments: ex.attachments || existing?.attachments,
        created_at:
          ex.created_at ||
          existing?.created_at ||
          ex.updated_at ||
          existing?.updated_at ||
          undefined
      });
    };

    (propPracticeExams || []).forEach((ex) => pushExam(ex));
    (internalExams || []).forEach((ex) => pushExam(ex));

    return Array.from(unifiedMap.values()).sort((a, b) => {
      const timeA = extractExamTimestampScore(a);
      const timeB = extractExamTimestampScore(b);
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return String(b.id || "").localeCompare(String(a.id || ""));
    });
  }, [propPracticeExams, internalExams, deletedExamIds]);

  // NGUỒN 2: BÀI TẬP VỀ NHÀ (BTVN) TRẮC NGHIỆM CỦA CÁC BUỔI HỌC (CHỈ ĐỌC TỪ `effectiveChapters`)
  const courseHomeworkExams = useMemo(() => {
    const list: any[] = [];
    const seenIds = new Set<string>();

    (effectiveChapters || []).forEach((chap: any) => {
      const chapTitle = String(chap?.title || "Chương học");
      (chap?.lessons || []).forEach((les: any) => {
        const lesTitle = String(les?.title || "Bài học");
        const lesId = String(les?.id || "");
        (les?.homework_files || []).forEach((hw: any) => {
          if (!hw || hw.is_drive_file === true || hw.is_quiz === false) return;
          const id = String(hw.id || "").trim();
          if (!id || seenIds.has(id)) return;
          seenIds.add(id);

          list.push({
            ...hw,
            id,
            sourceType: "homework" as ExamSourceTab,
            isHomework: true,
            lessonId: lesId,
            lessonTitle: lesTitle,
            chapterTitle: chapTitle,
            title: String(hw.title || "Bài tập về nhà"),
            category: "BTVN buổi học",
            duration_minutes: Number(hw.duration_minutes) || 0,
            created_at: hw.created_at || hw.updated_at || les?.created_at
          });
        });
      });
    });

    return list.sort((a, b) => extractExamTimestampScore(b) - extractExamTimestampScore(a));
  }, [effectiveChapters]);

  // NGUỒN 3: ĐỀ KIỂM TRA ĐỊNH KỲ (TEST) CỦA CÁC BUỔI HỌC (CHỈ ĐỌC TỪ `effectiveChapters`)
  const courseTestExams = useMemo(() => {
    const list: any[] = [];
    const seenIds = new Set<string>();

    (effectiveChapters || []).forEach((chap: any) => {
      const chapTitle = String(chap?.title || "Chương học");
      (chap?.lessons || []).forEach((les: any) => {
        const lesTitle = String(les?.title || "Bài học");
        const lesId = String(les?.id || "");
        (les?.test_quizzes || []).forEach((tq: any) => {
          if (!tq || tq.is_drive_file === true || tq.is_quiz === false) return;
          const id = String(tq.id || "").trim();
          if (!id || seenIds.has(id)) return;
          seenIds.add(id);

          list.push({
            ...tq,
            id,
            sourceType: "test" as ExamSourceTab,
            isHomework: false,
            lessonId: lesId,
            lessonTitle: lesTitle,
            chapterTitle: chapTitle,
            title: String(tq.title || "Đề kiểm tra định kỳ"),
            category: "Đề kiểm tra (Test)",
            duration_minutes: Number(tq.duration_minutes) || 45,
            created_at: tq.created_at || tq.updated_at || les?.created_at
          });
        });
      });
    });

    return list.sort((a, b) => extractExamTimestampScore(b) - extractExamTimestampScore(a));
  }, [effectiveChapters]);

  const activeSourceExams = useMemo(() => {
    if (examSourceTab === "homework") return courseHomeworkExams;
    if (examSourceTab === "test") return courseTestExams;
    return effectiveExams;
  }, [examSourceTab, effectiveExams, courseHomeworkExams, courseTestExams]);

  const effectiveAttempts = useMemo(() => {
    if (Array.isArray(propAllAttempts) && propAllAttempts.length > 0) {
      return propAllAttempts;
    }
    return internalAttempts;
  }, [propAllAttempts, internalAttempts]);

  const effectiveStudents = useMemo(() => {
    if (Array.isArray(propRegisteredStudents) && propRegisteredStudents.length > 0) {
      return propRegisteredStudents;
    }
    if (internalStudents.length > 0) {
      return internalStudents;
    }
    const fromAttemptsMap = new Map<string, any>();
    (effectiveAttempts || []).forEach((att: any) => {
      if (!att) return;
      const sId = String(att.studentId || att.student_id || att.user_id || "").trim();
      const sName = String(att.studentName || att.student_name || att.full_name || "").trim();
      if (sId && sName && !fromAttemptsMap.has(sId)) {
        fromAttemptsMap.set(sId, {
          id: sId,
          full_name: sName,
          school: att.school || "THPT",
          learning_mode: "offline"
        });
      }
    });
    return Array.from(fromAttemptsMap.values());
  }, [propRegisteredStudents, internalStudents, effectiveAttempts]);

  const sbdDirectoryList = useMemo(() => {
    const pool: {
      id: string;
      username: string;
      full_name: string;
      school: string;
      student_code: string;
      mode: "Online" | "Offline";
      modeKey: "online" | "offline";
    }[] = [];
    const seen = new Set<string>();

    (effectiveStudents || []).forEach((s: any) => {
      if (!s) return;
      const key = String(s.id || s.username || s.full_name || "").trim();
      if (!key || seen.has(key.toLowerCase())) return;
      seen.add(key.toLowerCase());

      const rawMode = String(s.learning_mode || s.study_mode || s.mode || "offline").toLowerCase();
      const isOnline = rawMode.includes("on");

      const rawCode = s.student_code || s.studentCode || s.sbd || "";
      const cleanCode = rawCode
        ? String(rawCode).replace(/\D/g, "").padStart(6, "0").slice(-6)
        : "";

      pool.push({
        id: String(s.id || key),
        username: String(s.username || ""),
        full_name: String(s.full_name || s.name || s.username || "Học sinh"),
        school: String(s.school || "THPT"),
        student_code: cleanCode,
        mode: isOnline ? "Online" : "Offline",
        modeKey: isOnline ? "online" : "offline"
      });
    });

    pool.sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));

    const directory = pool.map((stu, idx) => {
      const finalSbd = stu.student_code || String(idx + 1).padStart(6, "0");
      return {
        ...stu,
        stt: idx + 1,
        sbd: finalSbd
      };
    });

    if (typeof window !== "undefined" && directory.length > 0) {
      try {
        localStorage.setItem("edunexus_sbd_directory", JSON.stringify(directory));
      } catch {}
    }

    return directory;
  }, [effectiveStudents]);

  const doesExamMatchCategory = useCallback((exam: any, targetCategory: string): boolean => {
    if (!targetCategory || targetCategory === "Tất cả danh mục") return true;
    const rawCat = String(exam?.category || "").trim();
    const smartCat = resolveSmartCategory(exam, rawCat);
    return rawCat === targetCategory || smartCat === targetCategory;
  }, []);

  const categoryCountsMap = useMemo(() => {
    const counts: Record<string, number> = {
      "Tất cả danh mục": effectiveExams.length
    };
    PRACTICE_CATEGORIES.forEach((cat) => {
      if (cat !== "Tất cả danh mục") {
        counts[cat] = effectiveExams.filter((ex) => doesExamMatchCategory(ex, cat)).length;
      }
    });
    return counts;
  }, [effectiveExams, doesExamMatchCategory]);

  const computedExamsWithScores = useMemo(() => {
    let list = Array.isArray(activeSourceExams) ? [...activeSourceExams] : [];

    if (
      examSourceTab === "practice" &&
      activeCategoryFilter &&
      activeCategoryFilter !== "Tất cả danh mục"
    ) {
      list = list.filter((ex) => doesExamMatchCategory(ex, activeCategoryFilter));
    }

    if (searchKeyword.trim()) {
      const kwRaw = normalizeStr(searchKeyword);
      const kwNoAccent = normalizeVietnameseSearch(searchKeyword);

      list = list.filter((ex) => {
        const titleRaw = normalizeStr(ex?.title);
        const titleNoAccent = normalizeVietnameseSearch(ex?.title);
        const catNoAccent = normalizeVietnameseSearch(ex?.category);
        const lessonNoAccent = normalizeVietnameseSearch(ex?.lessonTitle);
        const chapterNoAccent = normalizeVietnameseSearch(ex?.chapterTitle);
        const codeStr = String(ex?.exam_code || deriveExamCode3Digits(ex)).toLowerCase();
        const idStr = String(ex?.id || "").toLowerCase();

        return (
          titleNoAccent.includes(kwNoAccent) ||
          titleRaw.includes(kwRaw) ||
          lessonNoAccent.includes(kwNoAccent) ||
          chapterNoAccent.includes(kwNoAccent) ||
          codeStr.includes(kwNoAccent) ||
          catNoAccent.includes(kwNoAccent) ||
          idStr.includes(kwNoAccent)
        );
      });
    }

    return list.map((ex, displayIndex) => {
      const exId = String(ex?.id || "").trim().toLowerCase();
      const exTitleNorm = normalizeStr(ex?.title);
      const counts = extractExamQuestionCounts(ex);
      const examCode = ex?.exam_code
        ? String(ex.exam_code).padStart(3, "0").slice(-3)
        : deriveExamCode3Digits(ex);

      const matchingAttempts = (effectiveAttempts || []).filter((a: any) => {
        if (!a) return false;
        const aQuizId = String(a.quizId || a.quiz_id || a.exam_id || "")
          .trim()
          .toLowerCase();
        const aTitleNorm = normalizeStr(
          a.examTitle || a.exam_title || a.quizTitle || a.quiz_title || a.title
        );
        return (
          (exId && aQuizId === exId) ||
          (exTitleNorm && aTitleNorm && exTitleNorm === aTitleNorm)
        );
      });

      const studentBestMap = new Map<string, any>();
      matchingAttempts.forEach((att: any) => {
        const key = String(att.studentId || att.student_id || att.studentName || att.id)
          .trim()
          .toLowerCase();
        const prev = studentBestMap.get(key);
        if (!prev || Number(att.score ?? 0) > Number(prev.score ?? 0)) {
          studentBestMap.set(key, att);
        }
      });

      const scores = matchingAttempts.map((a: any) => Number(a.score ?? a.points ?? 0));
      const avgScore =
        scores.length > 0 ? scores.reduce((sum, v) => sum + v, 0) / scores.length : 0;
      const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

      const attemptMaxTotalQ = matchingAttempts.reduce(
        (maxQ: number, a: any) =>
          Math.max(maxQ, Number(a?.total_questions || a?.totalQuestions || 0)),
        0
      );

      const resolvedTotalQuestions =
        Number(ex?.total_questions) || attemptMaxTotalQ || counts.totalCount || 22;

      const hsaInfo = detectHsaExamInfo(ex, resolvedTotalQuestions);
      const parsedAttachments = parseExamAttachments(ex);

      return {
        ...ex,
        displayStt: displayIndex + 1,
        examCode,
        totalQuestionsCount: resolvedTotalQuestions,
        part1Count: counts.part1Count,
        part2Count: counts.part2Count,
        part3Count: counts.part3Count,
        isHsaExam: hsaInfo.isHsa,
        hsaPartsCount: hsaInfo.partsCount,
        hsaMaxPoints: hsaInfo.maxPoints,
        hsaPartShortNames: hsaInfo.partShortNames,
        hsaBadgeText: hsaInfo.badgeText,
        attachmentsCount: parsedAttachments.length,
        totalSubmissions: matchingAttempts.length,
        uniqueStudentCount: studentBestMap.size,
        avgScore: avgScore.toFixed(2),
        maxScore: maxScore.toFixed(2),
        attempts: matchingAttempts
      };
    });
  }, [
    activeSourceExams,
    examSourceTab,
    activeCategoryFilter,
    searchKeyword,
    effectiveAttempts,
    doesExamMatchCategory
  ]);

  const allSelectableExamsForSbd = useMemo(
    () => [...effectiveExams, ...courseHomeworkExams, ...courseTestExams],
    [effectiveExams, courseHomeworkExams, courseTestExams]
  );

  const selectedSbdExamObj = useMemo(() => {
    if (!sbdSelectedExamId || sbdSelectedExamId === "none") return null;
    return allSelectableExamsForSbd.find((ex) => String(ex?.id) === sbdSelectedExamId) || null;
  }, [sbdSelectedExamId, allSelectableExamsForSbd]);

  const filteredSbdStudentsForModal = useMemo(() => {
    const scoreMap = new Map<string, number>();
    if (selectedSbdExamObj) {
      const targetId = String(selectedSbdExamObj.id || "").trim().toLowerCase();
      const targetTitle = normalizeStr(selectedSbdExamObj.title);

      (effectiveAttempts || []).forEach((att: any) => {
        if (!att) return;
        const aId = String(att.quizId || att.quiz_id || att.exam_id || "")
          .trim()
          .toLowerCase();
        const aTitle = normalizeStr(
          att.examTitle || att.exam_title || att.quizTitle || att.title || ""
        );
        if ((targetId && aId === targetId) || (targetTitle && aTitle === targetTitle)) {
          const sc = Number(att.score ?? att.points ?? 0);
          const stuId = String(att.studentId || att.student_id || "").trim().toLowerCase();
          const stuName = normalizeStr(att.studentName || att.student_name || "");
          const stuSbd = String(
            att.omr_raw_data?.detected_sbd ||
              att.answers?.__paper_omr_meta?.detected_sbd ||
              ""
          ).trim();

          if (stuId) {
            const p = scoreMap.get(`id:${stuId}`);
            if (p === undefined || sc > p) scoreMap.set(`id:${stuId}`, sc);
          }
          if (stuName) {
            const p = scoreMap.get(`name:${stuName}`);
            if (p === undefined || sc > p) scoreMap.set(`name:${stuName}`, sc);
          }
          if (stuSbd) {
            const p = scoreMap.get(`sbd:${stuSbd}`);
            if (p === undefined || sc > p) scoreMap.set(`sbd:${stuSbd}`, sc);
          }
        }
      });
    }

    return sbdDirectoryList
      .filter((s) => (sbdModeFilter === "all" ? true : s.modeKey === sbdModeFilter))
      .map((s) => {
        const byId = scoreMap.get(`id:${s.id.trim().toLowerCase()}`);
        const bySbd = scoreMap.get(`sbd:${s.sbd}`);
        const byName = scoreMap.get(`name:${normalizeStr(s.full_name)}`);
        const resolvedScore =
          byId !== undefined ? byId : bySbd !== undefined ? bySbd : byName;
        return {
          ...s,
          examScore: resolvedScore
        };
      });
  }, [sbdDirectoryList, sbdModeFilter, selectedSbdExamObj, effectiveAttempts]);

  const handlePrintSbdTable = () => {
    if (typeof window === "undefined") return;
    const win = window.open("", "_blank");
    if (!win) return;

    const headerTitle = selectedSbdExamObj
      ? `BẢNG ĐIỂM & SỐ BÁO DANH: ${String(selectedSbdExamObj.title).toUpperCase()}`
      : "BẢNG TRA CỨU SỐ BÁO DANH (SBD) HỌC VIÊN — TÂM CHÍ TÀI EDUNEXUS";

    const rowsHtml = filteredSbdStudentsForModal
      .map((stu) => {
        const scoreDisplay =
          stu.examScore !== undefined
            ? `<strong style="color:#0f172a; font-size:14px;">${stu.examScore.toFixed(2)}đ</strong>`
            : `<span style="color:#94a3b8; letter-spacing:2px;">....................</span>`;

        return `
          <tr>
            <td style="text-align:center; font-weight:bold;">${stu.stt}</td>
            <td style="text-align:center; font-weight:bold; color:#1D4ED8; font-size:15px; font-family:monospace; letter-spacing:1px;">${stu.sbd}</td>
            <td style="font-weight:bold;">${stu.full_name}</td>
            <td>${stu.school}</td>
            <td style="text-align:center;">${scoreDisplay}</td>
          </tr>
        `;
      })
      .join("");

    win.document.open();
    win.document.write(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8" />
        <title>${headerTitle}</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { font-family: 'Times New Roman', Times, serif; padding: 12px; color: #0f172a; }
          h2 { margin: 0 0 6px 0; color: #1e3a8a; text-transform: uppercase; font-size: 18px; text-align: center; }
          p { margin: 0 0 14px 0; font-size: 13px; color: #475569; text-align: center; font-style: italic; }
          table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
          th, td { border: 1px solid #94a3b8; padding: 8px 12px; text-align: left; }
          th { background: #f8fafc; color: #1e293b; text-transform: uppercase; font-size: 11.5px; }
          tr:nth-child(even) { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h2>${headerTitle}</h2>
        <p>Học sinh tra cứu đúng 6 chữ số SBD theo STT của mình để tô vào mục 7 trên Phiếu trả lời trắc nghiệm A4.</p>
        <table>
          <thead>
            <tr>
              <th style="width:50px; text-align:center;">STT</th>
              <th style="width:140px; text-align:center;">SỐ BÁO DANH (6 SỐ)</th>
              <th>Họ và tên học sinh</th>
              <th>Trường THPT</th>
              <th style="width:130px; text-align:center;">${selectedSbdExamObj ? "ĐIỂM SỐ" : "GHI CHÚ / ĐIỂM"}</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  const handleLocalChangeCategory = async (examId: string, newCat: string) => {
    setInternalExams((prev) => {
      const exists = prev.some((x) => String(x?.id) === String(examId));
      const baseList = exists ? prev : effectiveExams;
      const updated = baseList.map((ex) =>
        String(ex?.id) === String(examId) ? { ...ex, category: newCat } : ex
      );
      safeSaveExamsToLocal(updated);
      return updated;
    });

    if (handleChangeExamCategory) {
      handleChangeExamCategory(examId, newCat);
    } else if (effectiveSupabase) {
      try {
        await effectiveSupabase
          .from("practice_exams")
          .update({ category: newCat })
          .eq("id", examId);
      } catch {}
    }
  };

  const handleTriggerAppendHsaPart = async (exam: any, file: File) => {
    const fullExam = await ensureFullExamDataLoaded(exam);

    if (typeof onAppendHsaPart === "function") {
      onAppendHsaPart(fullExam, file);
      return;
    }

    setHsaAppendModalState({
      isOpen: true,
      targetExam: fullExam,
      file
    });
  };

  const handleSaveAppendedHsaExam = async (updatedExamPayload: any) => {
    const targetId = String(updatedExamPayload.id);

    const updatedList = effectiveExams.map((ex) =>
      String(ex?.id) === targetId ? { ...ex, ...updatedExamPayload } : ex
    );

    setInternalExams(updatedList);
    safeSaveExamsToLocal(updatedList);

    if (typeof savePracticeExams === "function") {
      try {
        await savePracticeExams(updatedList);
      } catch {}
    }

    if (effectiveSupabase) {
      try {
        await effectiveSupabase.from("practice_exams").upsert({
          id: updatedExamPayload.id,
          title: updatedExamPayload.title,
          category: updatedExamPayload.category || "Đề luyện thi ĐGNL (HSA/TSA)",
          duration_minutes: updatedExamPayload.duration_minutes,
          total_questions: updatedExamPayload.total_questions,
          data: updatedExamPayload.sections || updatedExamPayload.data,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.error("Lỗi cập nhật đề HSA lên Supabase:", err);
      }
    }

    if (showToast) {
      showToast(
        `Đã ghép thêm phần thi cho đề "${updatedExamPayload.title}" (${updatedExamPayload.sections?.length || 1}/4 phần)!`,
        "success"
      );
    }
  };

  const handleDeletePracticeExam = async (exam: any) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa đề thi "${exam.title}"?`)) return;
    const targetId = String(exam.id);

    const nextDeleted = new Set(deletedExamIds);
    nextDeleted.add(targetId);
    setDeletedExamIds(nextDeleted);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "edunexus_deleted_exam_ids",
          JSON.stringify(Array.from(nextDeleted))
        );
      } catch {}
    }

    const updated = effectiveExams.filter((ex) => String(ex?.id) !== targetId);
    setInternalExams(updated);
    safeSaveExamsToLocal(updated);
    if (typeof savePracticeExams === "function") {
      await savePracticeExams(updated);
    }
    if (effectiveSupabase) {
      try {
        await effectiveSupabase.from("practice_exams").delete().eq("id", exam.id);
      } catch (err) {
        console.error("Supabase Error Details (delete practice_exam):", err);
      }
    }
    if (showToast) {
      showToast(`Đã xóa đề "${exam.title}" thành công!`, "success");
    }
  };

  const activeSourceLabel =
    examSourceTab === "homework"
      ? "BTVN BUỔI HỌC"
      : examSourceTab === "test"
        ? "ĐỀ KIỂM TRA (TEST)"
        : "TỔNG SỐ ĐỀ LUYỆN THI";

  return (
    <div className="space-y-4 max-w-6xl mx-auto text-left font-sans">
      {practiceSyncStatus && practiceSyncStatus.isSyncing && (
        <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-xl flex items-center justify-between text-xs font-bold text-[#1D4ED8]">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-[#1D4ED8] animate-spin" />
            <span>{practiceSyncStatus.message || "Đang đồng bộ đề thi lên đám mây..."}</span>
          </div>
          <span className="font-mono">{practiceSyncStatus.progress}%</span>
        </div>
      )}

      {/* 1. HEADER THỐNG KÊ & CỤM NÚT HÀNH ĐỘNG CHÍNH */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-[20px] font-bold text-slate-900 tracking-tight">
                Kho Luyện Đề Thực Chiến & Chấm Thi
              </h2>
              <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-[#1D4ED8] border border-blue-200 text-xs font-bold">
                {activeSourceLabel}: {activeSourceExams.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Mặc định hiển thị Kho Đề luyện thi. Bạn có thể chuyển nhanh sang BTVN buổi học hoặc
              Đề kiểm tra để in phiếu A4, xem đề và thống kê điểm.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSelfFetching}
              onClick={() => fetchExamsAndStudentsSafely(true)}
              className="px-3 py-2 rounded-lg bg-[#F8FAFC] hover:bg-slate-100 text-slate-700 border border-slate-200/90 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#1D4ED8] ${isSelfFetching ? "animate-spin" : ""}`}
              />
              <span>Đồng bộ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeSourceExams.length > 0 && sbdSelectedExamId === "none") {
                  setSbdSelectedExamId(String(activeSourceExams[0].id));
                }
                setShowSbdModal(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-[#F8FAFC] text-slate-700 border border-slate-200/90 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Bảng SBD Lớp ({sbdDirectoryList.length})</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                const firstTarget = computedExamsWithScores[0] || activeSourceExams[0] || null;
                const fullTarget = firstTarget
                  ? await ensureFullExamDataLoaded(firstTarget)
                  : null;
                setScannerTargetExam(fullTarget);
                setIsScannerOpen(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-[#F8FAFC] text-slate-800 border border-slate-200/90 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-[#1D4ED8]" />
              <span>Mở Camera Chấm bài</span>
            </button>

            <label className="px-3.5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
              <FileUp className="w-3.5 h-3.5" />
              <span>+ Tải Đề Mới (Word/PDF)</span>
              <input
                type="file"
                accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (setUploadMode) setUploadMode("practice");
                    if (setEditingExamData) setEditingExamData(null);
                    if (setTestFile) setTestFile(file);
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {/* 2. THANH CHỌN NGUỒN ĐỀ (SEGMENTED CONTROL TỐI GIẢN) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 bg-[#F1F5F9] p-1 rounded-lg w-fit border border-slate-200/80">
            <button
              type="button"
              onClick={() => setExamSourceTab("practice")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                examSourceTab === "practice"
                  ? "bg-white text-[#1D4ED8] border border-slate-200/90"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Đề luyện thi ({effectiveExams.length})
            </button>
            <button
              type="button"
              onClick={() => setExamSourceTab("homework")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                examSourceTab === "homework"
                  ? "bg-white text-[#1D4ED8] border border-slate-200/90"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              BTVN buổi học ({courseHomeworkExams.length})
            </button>
            <button
              type="button"
              onClick={() => setExamSourceTab("test")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                examSourceTab === "test"
                  ? "bg-white text-[#1D4ED8] border border-slate-200/90"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Đề kiểm tra (Test) ({courseTestExams.length})
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-[#F1F5F9] p-1 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setPracticeSubTab && setPracticeSubTab("manage")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                practiceSubTab === "manage"
                  ? "bg-white text-slate-900 border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Danh sách ({computedExamsWithScores.length}/{activeSourceExams.length})
            </button>
            <button
              type="button"
              onClick={() => setPracticeSubTab && setPracticeSubTab("scores")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                practiceSubTab === "scores"
                  ? "bg-white text-slate-900 border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Thống kê Điểm số & Lượt nộp
            </button>
          </div>
        </div>

        {/* 3. DROPDOWN LỌC DANH MỤC (CHO ĐỀ LUYỆN THI) & Ô TÌM KIẾM */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {examSourceTab === "practice" ? (
              <select
                value={activeCategoryFilter}
                onChange={(e) => handleSelectCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 outline-none focus:border-[#1D4ED8] cursor-pointer"
              >
                {PRACTICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat} ({categoryCountsMap[cat] ?? 0})
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-slate-500 font-medium">
                Đang xem{" "}
                <strong className="text-slate-800">
                  {examSourceTab === "homework"
                    ? "BTVN trắc nghiệm từ các buổi học"
                    : "Đề kiểm tra định kỳ từ các buổi học"}
                </strong>{" "}
                (chỉ đọc, không ghi đè dữ liệu gốc của bài học).
              </span>
            )}
          </div>

          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder={
                examSourceTab === "practice"
                  ? "Tìm tên đề, mã đề (VD: 280, Giữa kỳ)..."
                  : "Tìm tên đề, bài học, chương..."
              }
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200/90 rounded-lg text-xs font-medium outline-none focus:border-[#1D4ED8]"
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Xóa từ khóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. BẢNG DANH SÁCH ĐỀ THI / BTVN / TEST */}
      <div className="bg-white border border-slate-200/90 rounded-xl overflow-hidden">
        {(propIsLoadingExams || isSelfFetching) && computedExamsWithScores.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#1D4ED8] mx-auto" />
            <p className="text-xs font-semibold text-slate-500">
              {uploadProgressText || "Đang tải danh sách đề thi..."}
            </p>
          </div>
        ) : computedExamsWithScores.length === 0 ? (
          <div className="py-14 text-center space-y-3 px-4">
            <FolderOpen className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-700">
                Không tìm thấy đề nào khớp với điều kiện lọc hiện tại
              </h4>
              <p className="text-xs text-slate-400">
                Nguồn:{" "}
                <strong>
                  {examSourceTab === "homework"
                    ? "BTVN buổi học"
                    : examSourceTab === "test"
                      ? "Đề kiểm tra (Test)"
                      : activeCategoryFilter}
                </strong>
                {searchKeyword ? ` • Từ khóa: "${searchKeyword}"` : ""}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              {((examSourceTab === "practice" && activeCategoryFilter !== "Tất cả danh mục") ||
                searchKeyword.trim() !== "") && (
                <button
                  type="button"
                  onClick={() => {
                    handleSelectCategoryFilter("Tất cả danh mục");
                    setSearchKeyword("");
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Xóa bộ lọc & Xem tất cả ({activeSourceExams.length} đề)
                </button>
              )}
              <button
                type="button"
                onClick={() => fetchExamsAndStudentsSafely(true)}
                className="px-4 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Đồng bộ từ Supabase
              </button>
            </div>
          </div>
        ) : practiceSubTab === "manage" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8FAFC] text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/90">
                <tr>
                  <th className="py-3 px-3 text-center w-12">STT</th>
                  <th className="py-3 px-4">
                    {examSourceTab === "homework"
                      ? "Tên BTVN & Buổi học"
                      : examSourceTab === "test"
                        ? "Tên Đề kiểm tra & Buổi học"
                        : "Tên đề luyện thi & Cấu trúc"}
                  </th>
                  <th className="py-3 px-3 text-center">Mã đề</th>
                  <th className="py-3 px-3">
                    {examSourceTab === "practice" ? "Danh mục" : "Phân loại"}
                  </th>
                  <th className="py-3 px-3 text-center">Thời gian</th>
                  <th className="py-3 px-3 text-center">Lượt nộp</th>
                  <th className="py-3 px-4 text-right">Công cụ Khảo thí & OMR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {computedExamsWithScores.map((exam, idx) => {
                  const isRowLoadingDetail = loadingSingleExamId === String(exam.id);
                  const isPracticeSource = exam.sourceType === "practice" || !exam.sourceType;
                  return (
                    <tr key={exam.id || idx} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="py-3.5 px-3 text-center font-semibold text-slate-400">
                        {idx + 1}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-800 text-xs sm:text-sm">
                            {exam.title}
                          </span>
                          {isPracticeSource && exam.isHsaExam && (
                            <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold tracking-wide">
                              {exam.hsaBadgeText}
                            </span>
                          )}
                          {isPracticeSource &&
                            idx === 0 &&
                            activeCategoryFilter === "Tất cả danh mục" &&
                            !searchKeyword.trim() && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#1D4ED8] border border-blue-200 text-[10px] font-bold">
                                Mới nhất
                              </span>
                            )}
                        </div>

                        {!isPracticeSource && (exam.lessonTitle || exam.chapterTitle) && (
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate max-w-md">
                            {exam.lessonTitle ? `Bài học: ${exam.lessonTitle}` : ""}
                            {exam.lessonTitle && exam.chapterTitle ? " • " : ""}
                            {exam.chapterTitle || ""}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-slate-500">
                          <span>
                            {exam.totalQuestionsCount} câu
                            {isPracticeSource && exam.isHsaExam
                              ? exam.hsaPartShortNames.length > 0
                                ? ` (${exam.hsaPartShortNames.join(" • ")})`
                                : ""
                              : Array.isArray(exam.data) && exam.data.length > 0
                                ? ` (P1: ${exam.part1Count} • P2: ${exam.part2Count} • P3: ${exam.part3Count})`
                                : ""}
                          </span>
                          {isPracticeSource && exam.solutionVideoUrl && (
                            <span className="px-1.5 py-0.2 rounded bg-blue-50 text-[#1D4ED8] border border-blue-200 text-[10px] font-semibold">
                              Có Video chữa
                            </span>
                          )}
                          {isPracticeSource && exam.attachmentsCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-[#F8FAFC] text-slate-700 border border-slate-200 text-[10px] font-semibold">
                              {exam.attachmentsCount} tài liệu
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-[#F8FAFC] text-slate-800 border border-slate-200/90 font-mono font-bold text-xs">
                          {exam.examCode}
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        {isPracticeSource ? (
                          <select
                            value={
                              PRACTICE_CATEGORIES.includes(exam.category) &&
                              exam.category !== "Tất cả danh mục"
                                ? exam.category
                                : "Tự do"
                            }
                            onChange={(e) => handleLocalChangeCategory(exam.id, e.target.value)}
                            className="px-2.5 py-1 rounded-md bg-white border border-slate-200/90 text-xs font-medium text-slate-700 outline-none focus:border-[#1D4ED8] cursor-pointer"
                          >
                            {PRACTICE_CATEGORIES.filter((c) => c !== "Tất cả danh mục").map(
                              (cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              )
                            )}
                          </select>
                        ) : (
                          <span className="px-2.5 py-1 rounded-md bg-[#F8FAFC] text-slate-700 border border-slate-200/90 text-[11px] font-semibold inline-block">
                            {exam.sourceType === "homework" ? "BTVN buổi học" : "Đề kiểm tra"}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-center font-semibold text-slate-600">
                        {exam.sourceType === "homework" && !exam.duration_minutes
                          ? "Tự do"
                          : `${exam.duration_minutes || 45} phút`}
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setAzotaScoreViewModal &&
                            setAzotaScoreViewModal({
                              isOpen: true,
                              examTitle: exam.title,
                              attempts: exam.attempts || []
                            })
                          }
                          className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] border border-blue-200 font-bold text-xs cursor-pointer transition"
                        >
                          {exam.totalSubmissions} bài ({exam.uniqueStudentCount} HS)
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                          {isPracticeSource && exam.isHsaExam && exam.hsaPartsCount < 4 && (
                            <label
                              className={`px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] border border-blue-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition ${
                                isRowLoadingDetail ? "opacity-50 pointer-events-none" : ""
                              }`}
                              title="Tải thêm file Word phần thi tiếp theo để ghép vào đề HSA này"
                            >
                              <FilePlus2 className="w-3.5 h-3.5 text-[#1D4ED8]" />
                              <span>+ Ghép phần HSA</span>
                              <input
                                type="file"
                                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = "";
                                  if (file) {
                                    handleTriggerAppendHsaPart(exam, file);
                                  }
                                }}
                              />
                            </label>
                          )}

                          <button
                            type="button"
                            disabled={isRowLoadingDetail}
                            onClick={async () => {
                              const fullExam = await ensureFullExamDataLoaded(exam);
                              openPrintableDynamicAnswerSheet({
                                ...fullExam,
                                examTitle: fullExam.title,
                                examCode: exam.examCode
                              });
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#F8FAFC] text-slate-700 border border-slate-200/90 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            {isRowLoadingDetail ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1D4ED8]" />
                            ) : (
                              <Printer className="w-3.5 h-3.5 text-[#1D4ED8]" />
                            )}
                            <span>Phiếu A4</span>
                          </button>

                          <button
                            type="button"
                            disabled={isRowLoadingDetail}
                            onClick={async () => {
                              const fullExam = await ensureFullExamDataLoaded(exam);
                              setScannerTargetExam(fullExam);
                              setIsScannerOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>Chấm OMR</span>
                          </button>

                          {isPracticeSource && setAttachmentsModalExam && (
                            <button
                              type="button"
                              onClick={() => setAttachmentsModalExam(exam)}
                              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition ${
                                exam.attachmentsCount > 0
                                  ? "bg-blue-50 hover:bg-blue-100/80 text-[#1D4ED8] border-blue-200"
                                  : "bg-white hover:bg-[#F8FAFC] text-slate-700 border-slate-200/90"
                              }`}
                              title="Quản lý tài liệu đính kèm (tối đa 3 file PDF / Google Drive)"
                            >
                              <FileText className="w-3.5 h-3.5 text-[#1D4ED8]" />
                              <span>Tài liệu ({exam.attachmentsCount}/3)</span>
                            </button>
                          )}

                          {onOpenExamEditor && (
                            <button
                              type="button"
                              disabled={isRowLoadingDetail}
                              onClick={async () => {
                                const fullExam = await ensureFullExamDataLoaded(exam);
                                onOpenExamEditor(fullExam);
                              }}
                              className="p-1.5 rounded-lg bg-white hover:bg-[#F8FAFC] text-slate-600 border border-slate-200/90 cursor-pointer"
                              title={
                                isPracticeSource
                                  ? "Sửa câu hỏi & đáp án đề thi"
                                  : "Xem / kiểm tra nội dung câu hỏi"
                              }
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isPracticeSource && setVideoModalExam && (
                            <button
                              type="button"
                              onClick={() => {
                                if (setSolutionVideoInput) {
                                  setSolutionVideoInput(exam.solutionVideoUrl || "");
                                }
                                setVideoModalExam(exam);
                              }}
                              className={`p-1.5 rounded-lg border cursor-pointer transition ${
                                exam.solutionVideoUrl
                                  ? "bg-blue-50 hover:bg-blue-100/80 text-[#1D4ED8] border-blue-200"
                                  : "bg-white hover:bg-[#F8FAFC] text-slate-600 border-slate-200/90"
                              }`}
                              title="Gắn link Video chữa đề"
                            >
                              <Video className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {onTestExam && (
                            <button
                              type="button"
                              disabled={isRowLoadingDetail}
                              onClick={async () => {
                                const fullExam = await ensureFullExamDataLoaded(exam);
                                onTestExam(fullExam);
                              }}
                              className="p-1.5 rounded-lg bg-white hover:bg-[#F8FAFC] text-slate-600 border border-slate-200/90 cursor-pointer"
                              title="Mở phòng thi thử"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isPracticeSource && (
                            <button
                              type="button"
                              onClick={() => handleDeletePracticeExam(exam)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Xóa đề thi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#F8FAFC] text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200/90">
                <tr>
                  <th className="py-3 px-3 text-center w-12">STT</th>
                  <th className="py-3 px-4">Tên đề thi</th>
                  <th className="py-3 px-3 text-center">Mã đề</th>
                  <th className="py-3 px-3 text-center">Số học sinh dự thi</th>
                  <th className="py-3 px-3 text-center">Điểm trung bình</th>
                  <th className="py-3 px-3 text-center">Điểm cao nhất</th>
                  <th className="py-3 px-4 text-right">Chi tiết bảng điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {computedExamsWithScores.map((exam, idx) => (
                  <tr key={exam.id || idx} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="py-3.5 px-3 text-center font-semibold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{exam.title}</span>
                        {exam.isHsaExam && (
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">
                            {exam.hsaBadgeText}
                          </span>
                        )}
                      </div>
                      {(exam.lessonTitle || exam.chapterTitle) && (
                        <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                          {exam.lessonTitle ? `Bài học: ${exam.lessonTitle}` : ""}
                          {exam.lessonTitle && exam.chapterTitle ? " • " : ""}
                          {exam.chapterTitle || ""}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-700">
                      {exam.examCode}
                    </td>
                    <td className="py-3.5 px-3 text-center font-semibold text-slate-700">
                      {exam.uniqueStudentCount} học sinh ({exam.totalSubmissions} lượt)
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2.5 py-0.5 rounded bg-blue-50 text-[#1D4ED8] border border-blue-200 font-bold">
                        {exam.avgScore}đ
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2.5 py-0.5 rounded bg-[#F8FAFC] text-slate-800 border border-slate-200/90 font-bold">
                        {exam.maxScore}đ
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSbdSelectedExamId(String(exam.id));
                            setShowSbdModal(true);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white hover:bg-[#F8FAFC] text-slate-700 border border-slate-200/90 text-[11px] font-semibold cursor-pointer"
                        >
                          Phiếu điểm SBD lớp
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setAzotaScoreViewModal &&
                            setAzotaScoreViewModal({
                              isOpen: true,
                              examTitle: exam.title,
                              attempts: exam.attempts || []
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Xem chi tiết bài nộp</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL BẢNG SBD LỚP & PHIẾU GHI ĐIỂM */}
      {showSbdModal && (
        <div
          onClick={() => setShowSbdModal(false)}
          className="fixed inset-0 z-[500] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] border border-slate-200/90 shadow-xs flex flex-col overflow-hidden cursor-default"
          >
            <div className="p-4 sm:p-5 border-b border-slate-200/90 bg-white space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Bảng SBD Học Viên & Phiếu Ghi Điểm ({filteredSbdStudentsForModal.length} bạn)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Khi bấm In bảng SBD, cột Phân hệ tự động được ẩn để in danh sách chuẩn.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrintSbdTable}
                    className="px-3.5 py-2 rounded-lg bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> In bảng SBD
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSbdModal(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-1 bg-[#F1F5F9] p-1 rounded-lg w-fit">
                  {[
                    { key: "all", label: `Tất cả (${sbdDirectoryList.length})` },
                    {
                      key: "offline",
                      label: `Học sinh Offline (${
                        sbdDirectoryList.filter((x) => x.modeKey === "offline").length
                      })`
                    },
                    {
                      key: "online",
                      label: `Học sinh Online (${
                        sbdDirectoryList.filter((x) => x.modeKey === "online").length
                      })`
                    }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSbdModeFilter(tab.key as any)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                        sbdModeFilter === tab.key
                          ? "bg-white text-slate-900 border border-slate-200/80"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 flex-1 sm:max-w-[300px]">
                  <select
                    value={sbdSelectedExamId}
                    onChange={(e) => setSbdSelectedExamId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200/90 text-xs font-medium text-slate-800 outline-none focus:border-[#1D4ED8] cursor-pointer"
                  >
                    <option value="none">-- Chọn đề thi để hiện cột Điểm --</option>
                    {allSelectableExamsForSbd.map((ex: any) => (
                      <option key={ex.id} value={ex.id}>
                        [Mã {deriveExamCode3Digits(ex)}] {ex.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <table className="w-full text-left text-xs border border-slate-200/90 rounded-lg overflow-hidden">
                <thead className="bg-[#F8FAFC] text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200/90">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-14">STT</th>
                    <th className="py-2.5 px-3 text-center w-32">SBD (6 chữ số)</th>
                    <th className="py-2.5 px-4">Họ và tên học sinh</th>
                    <th className="py-2.5 px-3">Trường</th>
                    <th className="py-2.5 px-3 text-center w-36">
                      {selectedSbdExamObj ? "Điểm bài thi" : "Phân hệ"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSbdStudentsForModal.map((stu) => (
                    <tr key={stu.id} className="hover:bg-[#F8FAFC]">
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-400">
                        {stu.stt}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-[#F8FAFC] text-slate-800 border border-slate-200/90 font-mono font-bold text-xs">
                          {stu.sbd}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">
                        {stu.full_name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{stu.school}</td>
                      <td className="py-2.5 px-3 text-center">
                        {selectedSbdExamObj ? (
                          stu.examScore !== undefined ? (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1D4ED8] border border-blue-200 font-bold text-xs">
                              {stu.examScore.toFixed(2)}đ
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono tracking-widest">
                              ..........
                            </span>
                          )
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#F8FAFC] text-slate-600 border border-slate-200/90">
                            {stu.mode}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GHÉP THÊM PHẦN THI HSA TRỰC TIẾP TRONG BẢNG */}
      {hsaAppendModalState.isOpen && (
        <AzotaExamConfigModal
          isOpen={hsaAppendModalState.isOpen}
          file={hsaAppendModalState.file}
          mode="practice"
          appendToExam={hsaAppendModalState.targetExam}
          initialData={hsaAppendModalState.targetExam}
          onClose={() =>
            setHsaAppendModalState({ isOpen: false, targetExam: null, file: null })
          }
          onSave={handleSaveAppendedHsaExam}
        />
      )}

      {/* MODAL CAMERA CHẤM OMR */}
      <AdminBulkOMRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        initialSelectedQuiz={scannerTargetExam}
        chapters={effectiveChapters}
        practiceExams={effectiveExams}
        registeredStudents={effectiveStudents}
        supabase={effectiveSupabase}
        showToast={showToast}
        onSavedSuccess={() => fetchExamsAndStudentsSafely(false)}
        onSavedBatchAttempts={(newAttempts) => {
          setInternalAttempts((prev) => [...newAttempts, ...prev]);
        }}
      />
    </div>
  );
}
