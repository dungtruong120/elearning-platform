"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
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
  X
} from "lucide-react";
import { supabase as defaultSupabaseClient } from "@/lib/supabaseClient";
import {
  deriveExamCode3Digits,
  extractExamQuestionCounts,
  formatStudentAutoSBD,
  openPrintableDynamicAnswerSheet
} from "@/lib/omrEngine";
import { AdminBulkOMRScannerModal } from "@/components/admin/paper/AdminBulkOMRScannerModal";

// DANH MỤC ĐẦY ĐỦ KHÔI PHỤC TẤT CẢ PHÂN LOẠI ĐỀ
export const PRACTICE_CATEGORIES = [
  "Tất cả danh mục",
  "Đề thi giữa kỳ",
  "Đề thi học kỳ",
  "Đề kiểm tra định kỳ",
  "Kho Luyện đề thực chiến / BTVN",
  "Đề thi thử THPT Quốc Gia",
  "Đề luyện thi ĐGNL (HSA/TSA)",
  "Đề tổng ôn chuyên đề",
  "Tự do"
];

function normalizeStr(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * CHUẨN HÓA UNICODE NFD BỎ DẤU TIẾNG VIỆT ĐỂ TÌM KIẾM MƯỢT MÀ
 * (Gõ "tang cuong so 2" hoặc "Tăng cường số 2" hoặc "giua ky" đều khớp 100%)
 */
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

/**
 * TRÍCH XUẤT THỜI GIAN TẠO ĐỀ (TỪ CREATED_AT HOẶC TIMESTAMP TRONG ID)
 * Đảm bảo đề mới tải lên luôn có giá trị lớn nhất để xếp lên đầu (index 0)
 */
function extractExamTimestampScore(exam: any): number {
  if (!exam) return 0;

  const rawTime =
    exam.created_at || exam.updated_at || exam.createdAt || exam.updatedAt;
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

/**
 * TỰ ĐỘNG NHẬN DIỆN DANH MỤC CHUẨN DỰA TRÊN TÊN ĐỀ & CATEGORY GỐC
 */
function resolveSmartCategory(exam: any, fallbackCategory?: string): string {
  const rawCat = String(exam?.category || fallbackCategory || "").trim();
  const titleSearch = normalizeVietnameseSearch(exam?.title || "");
  const catSearch = normalizeVietnameseSearch(rawCat);

  if (
    catSearch.includes("giua ky") ||
    catSearch.includes("giua ki") ||
    titleSearch.includes("giua ky") ||
    titleSearch.includes("giua ki") ||
    titleSearch.includes("gk1") ||
    titleSearch.includes("gk2")
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
    titleSearch.includes("hk1") ||
    titleSearch.includes("hk2")
  ) {
    return "Đề thi học kỳ";
  }

  if (
    catSearch.includes("btvn") ||
    catSearch.includes("bai tap") ||
    catSearch.includes("thuc chien") ||
    catSearch.includes("luyen de") ||
    exam?.isHomework ||
    exam?.is_homework ||
    titleSearch.includes("btvn") ||
    titleSearch.includes("tang cuong")
  ) {
    return "Kho Luyện đề thực chiến / BTVN";
  }

  if (
    catSearch.includes("dinh ky") ||
    catSearch.includes("kiem tra") ||
    titleSearch.includes("kiem tra")
  ) {
    return "Đề kiểm tra định kỳ";
  }

  if (
    catSearch.includes("hsa") ||
    catSearch.includes("tsa") ||
    catSearch.includes("dgnl") ||
    titleSearch.includes("hsa") ||
    titleSearch.includes("tsa") ||
    titleSearch.includes("dgnl")
  ) {
    return "Đề luyện thi ĐGNL (HSA/TSA)";
  }

  if (
    catSearch.includes("thpt") ||
    catSearch.includes("thi thu") ||
    titleSearch.includes("thi thu") ||
    titleSearch.includes("thpt")
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

  if (rawCat && PRACTICE_CATEGORIES.includes(rawCat)) {
    return rawCat;
  }

  return rawCat || "Tự do";
}

function safeSaveExamsToLocal(exams: any[]) {
  if (typeof window === "undefined" || !Array.isArray(exams) || exams.length === 0) return;
  try {
    localStorage.setItem("edunexus_practice_exams", JSON.stringify(exams));
  } catch {
    try {
      const slim = exams.map((ex: any) => ({
        id: ex?.id,
        title: ex?.title,
        category: ex?.category || "Tự do",
        duration_minutes: ex?.duration_minutes || 90,
        target_mode: ex?.target_mode || "all",
        allowRetake: ex?.allowRetake ?? true,
        allowViewFile: ex?.allowViewFile ?? true,
        driveUrl: ex?.driveUrl || "",
        solutionVideoUrl: ex?.solutionVideoUrl || "",
        data: ex?.data || ex?.sections || [],
        created_at: ex?.created_at || new Date().toISOString()
      }));
      localStorage.setItem("edunexus_practice_exams", JSON.stringify(slim));
    } catch {}
  }
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
  setAzotaScoreViewModal?: (modal: {
    isOpen: boolean;
    examTitle: string;
    attempts: any[];
  }) => void;
  onOpenExamEditor?: (exam: any) => void;
  onTestExam?: (exam: any) => void;
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
  setAzotaScoreViewModal,
  onOpenExamEditor,
  onTestExam,
  practiceCategoryFilter: propCategoryFilter = "Tất cả danh mục",
  setPracticeCategoryFilter: propSetCategoryFilter,
  practiceSyncStatus
}: PracticeTabProps) {
  const effectiveSupabase = propSupabase || defaultSupabaseClient;

  // STATE LỌC DANH MỤC & TÌM KIẾM ĐẢM BẢO PHẢN HỒI TỨC THÌ
  const [localCategoryFilter, setLocalCategoryFilter] = useState<string>(
    propCategoryFilter || "Tất cả danh mục"
  );
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  useEffect(() => {
    if (propCategoryFilter) {
      setLocalCategoryFilter(propCategoryFilter);
    }
  }, [propCategoryFilter]);

  const activeCategoryFilter = localCategoryFilter || "Tất cả danh mục";

  const handleSelectCategoryFilter = (newCategory: string) => {
    setLocalCategoryFilter(newCategory);
    if (typeof propSetCategoryFilter === "function") {
      propSetCategoryFilter(newCategory);
    }
  };

  // 1. NẠP TOÀN BỘ CACHE ĐỀ THI TỪ MỌI KEY TRONG LOCALSTORAGE
  const [internalExams, setInternalExams] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const merged: any[] = [];
      const seenIds = new Set<string>();
      const keys = [
        "edunexus_practice_exams",
        "edunexus_quizzes",
        "tct_practice_exams"
      ];
      for (const k of keys) {
        try {
          const raw = localStorage.getItem(k);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
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

  // Gộp non-destructive khi propPracticeExams thay đổi (Đề mới tải lên luôn được ưu tiên giữ timestamp mới nhất)
  useEffect(() => {
    if (Array.isArray(propPracticeExams) && propPracticeExams.length > 0) {
      setInternalExams((prev) => {
        const map = new Map<string, any>();
        prev.forEach((ex) => {
          if (ex?.id) map.set(String(ex.id), ex);
        });
        propPracticeExams.forEach((ex) => {
          if (ex?.id) {
            const prevItem = map.get(String(ex.id));
            map.set(String(ex.id), {
              ...prevItem,
              ...ex,
              created_at:
                ex.created_at || prevItem?.created_at || new Date().toISOString()
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

  // 2. HÀM SMART MERGE FETCHING: TRUY VẤN & SẮP XẾP ĐỀ MỚI NHẤT LÊN ĐẦU
  const fetchExamsAndStudentsSafely = useCallback(
    async (notifyUser: boolean = false) => {
      setIsSelfFetching(true);
      const collectedExamsMap = new Map<string, any>();
      let recoveredStudents: any[] = [];
      let recoveredAttempts: any[] = [];

      const addExamToCollector = (ex: any, defaultCategory?: string) => {
        if (!ex) return;
        const id = String(ex.id || ex.quiz_id || "").trim();
        if (!id) return;
        const existing = collectedExamsMap.get(id);
        collectedExamsMap.set(id, {
          ...existing,
          ...ex,
          id,
          category: resolveSmartCategory(ex, existing?.category || defaultCategory),
          created_at: ex.created_at || existing?.created_at || ex.updated_at || undefined
        });
      };

      internalExams.forEach((ex) => addExamToCollector(ex));

      // Bước 1: Gọi API `/api/admin/data`
      try {
        const res = await fetch("/api/admin/data", { cache: "no-store" });
        if (res.ok) {
          const apiData = await res.json();
          if (Array.isArray(apiData.practiceExams)) {
            apiData.practiceExams.forEach((ex: any) => addExamToCollector(ex));
          }
          if (Array.isArray(apiData.profiles) && apiData.profiles.length > 0) {
            recoveredStudents = apiData.profiles;
          }
          const combinedAtt = [
            ...(Array.isArray(apiData.examAttempts) ? apiData.examAttempts : []),
            ...(Array.isArray(apiData.quizResults) ? apiData.quizResults : [])
          ];
          if (combinedAtt.length > 0) {
            recoveredAttempts = combinedAtt;
          }
        }
      } catch (apiErr) {
        console.error("Supabase Error Details (API /api/admin/data):", apiErr);
      }

      // Bước 2: Truy vấn bảng `practice_exams` trên Supabase (Sắp xếp giảm dần theo created_at)
      if (effectiveSupabase) {
        try {
          const { data: sbExamsLight, error: lightErr } = await effectiveSupabase
            .from("practice_exams")
            .select(
              "id, title, category, duration_minutes, allowRetake, allowViewFile, driveUrl, solutionVideoUrl, data, created_at"
            )
            .order("created_at", { ascending: false });

          if (!lightErr && Array.isArray(sbExamsLight) && sbExamsLight.length > 0) {
            sbExamsLight.forEach((ex: any) => addExamToCollector(ex));
          } else {
            const { data: sbExamsMin, error: minErr } = await effectiveSupabase
              .from("practice_exams")
              .select("id, title, category, duration_minutes, data, created_at")
              .order("created_at", { ascending: false });

            if (!minErr && Array.isArray(sbExamsMin)) {
              sbExamsMin.forEach((ex: any) => addExamToCollector(ex));
            } else if (minErr) {
              console.error("Supabase Error Details (practice_exams minimal):", minErr);
            }
          }
        } catch (err) {
          console.error("Supabase Error Details (practice_exams exception):", err);
        }

        // Bước 3: Truy vấn bảng `courses` để lấy các đề Kiểm tra chương, Giữa kỳ, Học kỳ & BTVN
        try {
          const { data: courseRows, error: courseErr } = await effectiveSupabase
            .from("courses")
            .select("id, chapters")
            .limit(1);

          if (!courseErr && Array.isArray(courseRows) && courseRows.length > 0) {
            const loadedChaps = courseRows[0]?.chapters;
            if (Array.isArray(loadedChaps) && loadedChaps.length > 0) {
              setInternalChapters(loadedChaps);
              loadedChaps.forEach((chap: any) => {
                (chap?.lessons || []).forEach((les: any) => {
                  (les?.test_quizzes || []).forEach((tq: any) => {
                    if (tq && !tq.is_drive_file) {
                      addExamToCollector(
                        {
                          ...tq,
                          duration_minutes: tq.duration_minutes || 90
                        },
                        "Đề kiểm tra định kỳ"
                      );
                    }
                  });
                  (les?.homework_files || []).forEach((hw: any) => {
                    if (hw && !hw.is_drive_file) {
                      addExamToCollector(
                        {
                          ...hw,
                          isHomework: true,
                          duration_minutes: hw.duration_minutes || 45
                        },
                        "Kho Luyện đề thực chiến / BTVN"
                      );
                    }
                  });
                });
              });
            }
          }
        } catch (err) {
          console.error("Supabase Error Details (courses recovery):", err);
        }

        if (recoveredStudents.length === 0) {
          try {
            const { data: sbProfiles } = await effectiveSupabase
              .from("profiles")
              .select("*");
            if (Array.isArray(sbProfiles) && sbProfiles.length > 0) {
              recoveredStudents = sbProfiles.filter(
                (p: any) => p.role !== "admin" && p.role !== "teacher"
              );
            }
          } catch {}
        }

        if (recoveredAttempts.length === 0) {
          try {
            const { data: sbAtt } = await effectiveSupabase
              .from("exam_attempts")
              .select("*")
              .order("created_at", { ascending: false });
            if (Array.isArray(sbAtt) && sbAtt.length > 0) {
              recoveredAttempts = sbAtt;
            }
          } catch {}
        }
      }

      // Sắp xếp toàn bộ đề giảm dần theo thời gian tạo (Đề mới nhất lên đầu tiên)
      const finalMergedExams = Array.from(collectedExamsMap.values()).sort((a, b) => {
        const timeA = extractExamTimestampScore(a);
        const timeB = extractExamTimestampScore(b);
        return timeB - timeA;
      });

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
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(
              "edunexus_registered_students",
              JSON.stringify(recoveredStudents)
            );
          } catch {}
        }
      }

      if (recoveredAttempts.length > 0) {
        setInternalAttempts(recoveredAttempts);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem("edunexus_attempts", JSON.stringify(recoveredAttempts));
          } catch {}
        }
      }

      setIsSelfFetching(false);

      if (notifyUser && showToast) {
        showToast(
          `Đã đồng bộ & sắp xếp ${finalMergedExams.length} đề thi (Đề mới nhất ở đầu)!`,
          "success"
        );
      }
    },
    [effectiveSupabase, internalExams, savePracticeExams, showToast]
  );

  useEffect(() => {
    fetchExamsAndStudentsSafely(false);
  }, []);

  // 3. HỢP NHẤT TOÀN DIỆN & SẮP XẾP ĐỀ MỚI NHẤT LÊN ĐẦU (INDEX 0)
  const effectiveChapters = useMemo(() => {
    if (Array.isArray(propChapters) && propChapters.length > 0) return propChapters;
    return internalChapters;
  }, [propChapters, internalChapters]);

  const effectiveExams = useMemo(() => {
    const unifiedMap = new Map<string, any>();

    const pushExam = (ex: any, fallbackCategory?: string) => {
      if (!ex || ex.is_drive_file) return;
      const id = String(ex.id || ex.quiz_id || "").trim();
      if (!id || deletedExamIds.has(id)) return;

      const existing = unifiedMap.get(id);
      const resolvedCat = resolveSmartCategory(ex, existing?.category || fallbackCategory);

      unifiedMap.set(id, {
        ...existing,
        ...ex,
        id,
        title: String(ex.title || existing?.title || "Đề luyện thi"),
        category: resolvedCat,
        duration_minutes: Number(ex.duration_minutes || existing?.duration_minutes || 90),
        created_at:
          ex.created_at ||
          existing?.created_at ||
          ex.updated_at ||
          existing?.updated_at ||
          undefined
      });
    };

    // Nguồn 1: Đề từ propPracticeExams (Đề vừa mới tải lên nằm ở đầu propPracticeExams)
    (propPracticeExams || []).forEach((ex) => pushExam(ex));

    // Nguồn 2: Đề từ internalExams (Supabase + LocalStorage)
    (internalExams || []).forEach((ex) => pushExam(ex));

    // Nguồn 3: Toàn bộ Đề kiểm tra định kỳ, Giữa kỳ, Học kỳ & BTVN trong các Chương/Bài học
    (effectiveChapters || []).forEach((chap: any) => {
      (chap?.lessons || []).forEach((les: any) => {
        (les?.test_quizzes || []).forEach((tq: any) => {
          pushExam(tq, "Đề kiểm tra định kỳ");
        });
        (les?.homework_files || []).forEach((hw: any) => {
          pushExam(
            {
              ...hw,
              isHomework: true,
              duration_minutes: hw?.duration_minutes || 45
            },
            "Kho Luyện đề thực chiến / BTVN"
          );
        });
      });
    });

    // Nguồn 4: Khôi phục thêm các đề từ lịch sử nộp bài nếu chưa có
    const allAtt =
      Array.isArray(propAllAttempts) && propAllAttempts.length > 0
        ? propAllAttempts
        : internalAttempts;

    const existingTitlesNorm = new Set(
      Array.from(unifiedMap.values()).map((x) => normalizeStr(x.title))
    );

    (allAtt || []).forEach((att: any) => {
      if (!att) return;
      const qId = String(att.quizId || att.quiz_id || att.exam_id || "").trim();
      const qTitle = String(
        att.examTitle || att.exam_title || att.quizTitle || att.quiz_title || ""
      ).trim();
      if (!qId || !qTitle || deletedExamIds.has(qId)) return;

      if (!unifiedMap.has(qId) && !existingTitlesNorm.has(normalizeStr(qTitle))) {
        existingTitlesNorm.add(normalizeStr(qTitle));
        pushExam(
          {
            id: qId,
            title: qTitle,
            isHomework: Boolean(
              att.isHomework || att.is_homework || att.type === "homework"
            ),
            duration_minutes: 90,
            data: [],
            created_at: att.created_at || att.createdAt
          },
          "Kho Luyện đề thực chiến / BTVN"
        );
      }
    });

    // SẮP XẾP GIẢM DẦN THEO THỜI GIAN TẠO: ĐỀ MỚI UP LÊN LUÔN ĐỨNG ĐẦU TIÊN (INDEX 0)
    const sortedExams = Array.from(unifiedMap.values()).sort((a, b) => {
      const timeA = extractExamTimestampScore(a);
      const timeB = extractExamTimestampScore(b);
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return String(b.id || "").localeCompare(String(a.id || ""));
    });

    return sortedExams;
  }, [
    propPracticeExams,
    internalExams,
    effectiveChapters,
    propAllAttempts,
    internalAttempts,
    deletedExamIds
  ]);

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
      mode: "Online" | "Offline";
      modeKey: "online" | "offline";
    }[] = [];
    const seen = new Set<string>();

    (effectiveStudents || []).forEach((s: any) => {
      if (!s) return;
      const key = String(s.id || s.username || s.full_name || "").trim();
      if (!key || seen.has(key.toLowerCase())) return;
      seen.add(key.toLowerCase());
      const rawMode = String(
        s.learning_mode || s.study_mode || s.mode || "offline"
      ).toLowerCase();
      const isOnline = rawMode.includes("on");
      pool.push({
        id: String(s.id || key),
        username: String(s.username || ""),
        full_name: String(s.full_name || s.name || s.username || "Học sinh"),
        school: String(s.school || "THPT"),
        mode: isOnline ? "Online" : "Offline",
        modeKey: isOnline ? "online" : "offline"
      });
    });

    pool.sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));

    const directory = pool.map((stu, idx) => ({
      ...stu,
      stt: idx + 1,
      sbd: formatStudentAutoSBD(idx + 1)
    }));

    if (typeof window !== "undefined" && directory.length > 0) {
      try {
        localStorage.setItem("edunexus_sbd_directory", JSON.stringify(directory));
      } catch {}
    }

    return directory;
  }, [effectiveStudents]);

  // Hàm kiểm tra 1 đề có thuộc danh mục đang chọn hay không
  const doesExamMatchCategory = useCallback((exam: any, targetCategory: string): boolean => {
    if (!targetCategory || targetCategory === "Tất cả danh mục") return true;
    const rawCat = String(exam?.category || "").trim();
    const smartCat = resolveSmartCategory(exam, rawCat);

    if (rawCat === targetCategory || smartCat === targetCategory) return true;

    if (targetCategory === "Kho Luyện đề thực chiến / BTVN") {
      return (
        rawCat === "Bài tập về nhà (BTVN)" ||
        smartCat === "Bài tập về nhà (BTVN)" ||
        Boolean(exam?.isHomework || exam?.is_homework)
      );
    }

    return false;
  }, []);

  // Đếm chính xác số lượng đề của từng danh mục để hiển thị trong Dropdown
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

  // 4. LỌC KẾT HỢP (CATEGORY AND SEARCH KEYWORD) & ĐÁNH LẠI STT TỰ ĐỘNG
  const computedExamsWithScores = useMemo(() => {
    let list = Array.isArray(effectiveExams) ? [...effectiveExams] : [];

    // Điều kiện 1: Lọc theo Danh mục (Category)
    if (activeCategoryFilter && activeCategoryFilter !== "Tất cả danh mục") {
      list = list.filter((ex) => doesExamMatchCategory(ex, activeCategoryFilter));
    }

    // Điều kiện 2: Tìm kiếm thời gian thực theo Tên đề (không dấu NFD + có dấu NFC) hoặc Mã đề (3 chữ số)
    if (searchKeyword.trim()) {
      const kwRaw = normalizeStr(searchKeyword);
      const kwNoAccent = normalizeVietnameseSearch(searchKeyword);

      list = list.filter((ex) => {
        const titleRaw = normalizeStr(ex?.title);
        const titleNoAccent = normalizeVietnameseSearch(ex?.title);
        const catNoAccent = normalizeVietnameseSearch(ex?.category);
        const codeStr = deriveExamCode3Digits(ex).toLowerCase();
        const idStr = String(ex?.id || "").toLowerCase();

        return (
          titleNoAccent.includes(kwNoAccent) ||
          titleRaw.includes(kwRaw) ||
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
      const examCode = deriveExamCode3Digits(ex);

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
        const key = String(
          att.studentId || att.student_id || att.studentName || att.id
        )
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

      return {
        ...ex,
        displayStt: displayIndex + 1,
        examCode,
        totalQuestionsCount: counts.totalCount,
        part1Count: counts.part1Count,
        part2Count: counts.part2Count,
        part3Count: counts.part3Count,
        totalSubmissions: matchingAttempts.length,
        uniqueStudentCount: studentBestMap.size,
        avgScore: avgScore.toFixed(2),
        maxScore: maxScore.toFixed(2),
        attempts: matchingAttempts
      };
    });
  }, [
    effectiveExams,
    activeCategoryFilter,
    searchKeyword,
    effectiveAttempts,
    doesExamMatchCategory
  ]);

  const selectedSbdExamObj = useMemo(() => {
    if (!sbdSelectedExamId || sbdSelectedExamId === "none") return null;
    return effectiveExams.find((ex) => String(ex?.id) === sbdSelectedExamId) || null;
  }, [sbdSelectedExamId, effectiveExams]);

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

  return (
    <div className="space-y-4 max-w-6xl mx-auto text-left font-sans">
      {practiceSyncStatus && practiceSyncStatus.isSyncing && (
        <div className="bg-blue-50 border border-blue-300 p-3.5 rounded-xl flex items-center justify-between text-xs font-bold text-blue-900">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            <span>{practiceSyncStatus.message || "Đang đồng bộ đề thi lên đám mây..."}</span>
          </div>
          <span className="font-mono">{practiceSyncStatus.progress}%</span>
        </div>
      )}

      {/* 1. HEADER THỐNG KÊ & CỤM NÚT HÀNH ĐỘNG CHÍNH */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-[20px] font-bold text-slate-800 tracking-tight">
                Kho Luyện Đề Thực Chiến & Chấm Thi
              </h2>
              <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold">
                TỔNG SỐ ĐỀ: {effectiveExams.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Đề mới tải lên luôn được ưu tiên xếp ở vị trí đầu tiên. Hỗ trợ lọc danh mục và tìm kiếm theo tên/mã đề.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSelfFetching}
              onClick={() => fetchExamsAndStudentsSafely(true)}
              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-blue-600 ${
                  isSelfFetching ? "animate-spin" : ""
                }`}
              />
              <span>🔄 Đồng bộ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (effectiveExams.length > 0 && sbdSelectedExamId === "none") {
                  setSbdSelectedExamId(String(effectiveExams[0].id));
                }
                setShowSbdModal(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>📋 Bảng SBD Lớp ({sbdDirectoryList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setScannerTargetExam(computedExamsWithScores[0] || effectiveExams[0] || null);
                setIsScannerOpen(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>📷 Mở Camera Chấm bài</span>
            </button>

            <label className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer">
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

        {/* 2. THANH CHUYỂN TAB, DROPDOWN LỌC DANH MỤC & Ô TÌM KIẾM THỜI GIAN THỰC */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => setPracticeSubTab && setPracticeSubTab("manage")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                practiceSubTab === "manage"
                  ? "bg-white text-slate-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Danh sách Đề thi ({computedExamsWithScores.length}/{effectiveExams.length})
            </button>
            <button
              type="button"
              onClick={() => setPracticeSubTab && setPracticeSubTab("scores")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                practiceSubTab === "scores"
                  ? "bg-white text-slate-800 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Thống kê Điểm số & Lượt nộp
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bộ lọc Danh mục hiển thị kèm số lượng đề */}
            <select
              value={activeCategoryFilter}
              onChange={(e) => handleSelectCategoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 outline-none focus:border-blue-600 cursor-pointer"
            >
              {PRACTICE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat} ({categoryCountsMap[cat] ?? 0})
                </option>
              ))}
            </select>

            {/* Ô tìm kiếm thời gian thực theo Tên đề (không dấu/có dấu) & Mã đề */}
            <div className="relative min-w-[230px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm tên đề, mã đề (VD: 280, Giữa kỳ)..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-blue-600"
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
      </div>

      {/* 3. BẢNG DANH SÁCH ĐỀ LUYỆN THI (ĐÁNH LẠI STT TUẦN TỰ 1, 2, 3...) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {(propIsLoadingExams || isSelfFetching) && computedExamsWithScores.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-500">
              {uploadProgressText || "Đang tải danh sách đề thi..."}
            </p>
          </div>
        ) : computedExamsWithScores.length === 0 ? (
          <div className="py-14 text-center space-y-3 px-4">
            <FolderOpen className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-700">
                Không tìm thấy đề thi nào khớp với điều kiện lọc hiện tại
              </h4>
              <p className="text-xs text-slate-400">
                Danh mục: <strong>{activeCategoryFilter}</strong>
                {searchKeyword ? ` • Từ khóa: "${searchKeyword}"` : ""}
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              {(activeCategoryFilter !== "Tất cả danh mục" || searchKeyword.trim() !== "") && (
                <button
                  type="button"
                  onClick={() => {
                    handleSelectCategoryFilter("Tất cả danh mục");
                    setSearchKeyword("");
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Xóa bộ lọc & Xem tất cả ({effectiveExams.length} đề)
                </button>
              )}
              <button
                type="button"
                onClick={() => fetchExamsAndStudentsSafely(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Đồng bộ từ Supabase
              </button>
            </div>
          </div>
        ) : practiceSubTab === "manage" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 text-center w-12">STT</th>
                  <th className="py-3 px-4">Tên đề luyện thi & Cấu trúc</th>
                  <th className="py-3 px-3 text-center">Mã đề</th>
                  <th className="py-3 px-3">Danh mục</th>
                  <th className="py-3 px-3 text-center">Thời gian</th>
                  <th className="py-3 px-3 text-center">Lượt nộp</th>
                  <th className="py-3 px-4 text-right">Công cụ Khảo thí & OMR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {computedExamsWithScores.map((exam, idx) => (
                  <tr key={exam.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    {/* Cột STT luôn đánh số tuần tự 1, 2, 3... theo kết quả lọc */}
                    <td className="py-3.5 px-3 text-center font-semibold text-slate-400">
                      {idx + 1}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-800 text-xs sm:text-sm">
                          {exam.title}
                        </span>
                        {idx === 0 &&
                          activeCategoryFilter === "Tất cả danh mục" &&
                          !searchKeyword.trim() && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                              Mới nhất
                            </span>
                          )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px] text-slate-500">
                        <span>
                          {exam.totalQuestionsCount} câu (P1: {exam.part1Count} • P2:{" "}
                          {exam.part2Count} • P3: {exam.part3Count})
                        </span>
                        {exam.solutionVideoUrl && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                            Có Video chữa
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold text-xs">
                        {exam.examCode}
                      </span>
                    </td>

                    <td className="py-3.5 px-3">
                      <select
                        value={exam.category || "Tự do"}
                        onChange={(e) => handleLocalChangeCategory(exam.id, e.target.value)}
                        className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs font-medium text-slate-700 outline-none focus:border-blue-600 cursor-pointer"
                      >
                        {PRACTICE_CATEGORIES.filter((c) => c !== "Tất cả danh mục").map(
                          (cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          )
                        )}
                      </select>
                    </td>

                    <td className="py-3.5 px-3 text-center font-semibold text-slate-600">
                      {exam.duration_minutes || 90} phút
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
                        className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs cursor-pointer transition"
                      >
                        {exam.totalSubmissions} bài ({exam.uniqueStudentCount} HS)
                      </button>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            openPrintableDynamicAnswerSheet({
                              ...exam,
                              examTitle: exam.title,
                              examCode: exam.examCode
                            })
                          }
                          className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-blue-600" />
                          <span>Phiếu A4</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setScannerTargetExam(exam);
                            setIsScannerOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Chấm OMR</span>
                        </button>

                        {onOpenExamEditor && (
                          <button
                            type="button"
                            onClick={() => onOpenExamEditor(exam)}
                            className="p-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
                            title="Sửa câu hỏi & đáp án đề thi"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {setVideoModalExam && (
                          <button
                            type="button"
                            onClick={() => {
                              if (setSolutionVideoInput) {
                                setSolutionVideoInput(exam.solutionVideoUrl || "");
                              }
                              setVideoModalExam(exam);
                            }}
                            className="p-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
                            title="Gắn link Video chữa đề"
                          >
                            <Video className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {onTestExam && (
                          <button
                            type="button"
                            onClick={() => onTestExam(exam)}
                            className="p-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
                            title="Mở phòng thi thử"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeletePracticeExam(exam)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Xóa đề thi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
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
                  <tr key={exam.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-3 text-center font-semibold text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">{exam.title}</td>
                    <td className="py-3.5 px-3 text-center font-mono font-bold text-slate-700">
                      {exam.examCode}
                    </td>
                    <td className="py-3.5 px-3 text-center font-semibold text-slate-700">
                      {exam.uniqueStudentCount} học sinh ({exam.totalSubmissions} lượt)
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                        {exam.avgScore}đ
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className="px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
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
                          className="px-3 py-1.5 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold cursor-pointer"
                        >
                          📋 Phiếu điểm SBD lớp
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
                          className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
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
          className="fixed inset-0 z-[500] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] border border-slate-200 shadow-2xl flex flex-col overflow-hidden cursor-default"
          >
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-white space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-800">
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
                    className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> 🖨 In bảng SBD
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
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
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
                          ? "bg-white text-slate-800 shadow-2xs"
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
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="none">-- Chọn đề thi để hiện cột Điểm --</option>
                    {effectiveExams.map((ex: any) => (
                      <option key={ex.id} value={ex.id}>
                        [Mã {deriveExamCode3Digits(ex)}] {ex.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
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
                    <tr key={stu.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-400">
                        {stu.stt}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-mono font-bold text-xs">
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
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold text-xs">
                              {stu.examScore.toFixed(2)}đ
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono tracking-widest">
                              ..........
                            </span>
                          )
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
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
