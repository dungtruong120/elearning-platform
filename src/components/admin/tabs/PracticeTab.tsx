"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Plus,
  FileUp,
  Search,
  Video,
  Trash2,
  Edit3,
  Play,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderOpen,
  Award,
  Users,
  Printer,
  Camera,
  RefreshCw,
  FileText,
  ExternalLink,
  X,
  BarChart3
} from "lucide-react";
import { supabase as defaultSupabaseClient } from "@/lib/supabaseClient";
import {
  deriveExamCode3Digits,
  extractExamQuestionCounts,
  formatStudentAutoSBD,
  openPrintableDynamicAnswerSheet
} from "@/lib/omrEngine";
import { AdminBulkOMRScannerModal } from "@/components/admin/paper/AdminBulkOMRScannerModal";

const PRACTICE_CATEGORIES = [
  "Tất cả danh mục",
  "Đề thi thử THPT Quốc Gia",
  "Đề kiểm tra định kỳ",
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
  chapters = [],
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
  practiceCategoryFilter = "Tất cả danh mục",
  setPracticeCategoryFilter,
  practiceSyncStatus
}: PracticeTabProps) {
  // 1. ĐẢM BẢO SUPABASE CLIENT LUÔN TỒN TẠI (FALLBACK NỘI BỘ AN TOÀN)
  const effectiveSupabase = propSupabase || defaultSupabaseClient;

  // 2. STATE BACKUP NỘI BỘ CHỐNG MẤT DỮ LIỆU KHI PROPS BỊ RỖNG (0 ĐỀ / 0 HỌC SINH)
  const [internalExams, setInternalExams] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("edunexus_practice_exams");
        if (cached) {
          const parsed = JSON.parse(cached);
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

  const [isSelfFetching, setIsSelfFetching] = useState<boolean>(false);
  const [searchKeyword, setSearchKeyword] = useState<string>("");

  // STATE CHO MODAL BẢNG SBD LỚP & CAMERA CHẤM OMR NGAY TẠI KHO LUYỆN ĐỀ
  const [showSbdModal, setShowSbdModal] = useState<boolean>(false);
  const [sbdModeFilter, setSbdModeFilter] = useState<"all" | "offline" | "online">("all");
  const [sbdSelectedExamId, setSbdSelectedExamId] = useState<string>("none");
  const [scannerTargetExam, setScannerTargetExam] = useState<any | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  // Đồng bộ từ props nếu props có dữ liệu thực (> 0 phần tử)
  useEffect(() => {
    if (Array.isArray(propPracticeExams) && propPracticeExams.length > 0) {
      setInternalExams(propPracticeExams);
      safeSaveExamsToLocal(propPracticeExams);
    }
  }, [propPracticeExams]);

  useEffect(() => {
    if (Array.isArray(propRegisteredStudents) && propRegisteredStudents.length > 0) {
      setInternalStudents(propRegisteredStudents);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            "edunexus_registered_students",
            JSON.stringify(propRegisteredStudents)
          );
        } catch {}
      }
    }
  }, [propRegisteredStudents]);

  useEffect(() => {
    if (Array.isArray(propAllAttempts) && propAllAttempts.length > 0) {
      setInternalAttempts(propAllAttempts);
    }
  }, [propAllAttempts]);

  // 3. HÀM TỰ ĐỘNG KHÔI PHỤC DỮ LIỆU TỪ SUPABASE & API SERVER (KHÔNG BAO GIỜ SET VỀ RỖNG NẾU LỖI)
  const fetchExamsAndStudentsSafely = useCallback(
    async (notifyUser: boolean = false) => {
      setIsSelfFetching(true);
      let recoveredExams: any[] = [];
      let recoveredStudents: any[] = [];
      let recoveredAttempts: any[] = [];

      // Bước 1: Gọi API tổng hợp `/api/admin/data` (Sử dụng Service Role vượt mọi lỗi chặn RLS)
      try {
        const res = await fetch("/api/admin/data", { cache: "no-store" });
        if (res.ok) {
          const apiData = await res.json();
          if (Array.isArray(apiData.practiceExams) && apiData.practiceExams.length > 0) {
            recoveredExams = apiData.practiceExams;
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
        console.error("Lỗi fetch API /api/admin/data trong PracticeTab:", apiErr);
      }

      // Bước 2: Nếu API chưa trả về đủ, truy vấn trực tiếp bằng Supabase Client với log chi tiết
      if (effectiveSupabase) {
        if (recoveredExams.length === 0) {
          try {
            const { data: sbExams, error: examErr } = await effectiveSupabase
              .from("practice_exams")
              .select("*")
              .order("created_at", { ascending: false });

            if (examErr) {
              console.error("Lỗi fetch practice_exams từ Supabase:", examErr);
            } else if (Array.isArray(sbExams) && sbExams.length > 0) {
              recoveredExams = sbExams;
            }
          } catch (err) {
            console.error("Ngoại lệ khi query bảng practice_exams:", err);
          }
        }

        if (recoveredStudents.length === 0) {
          try {
            const { data: sbProfiles, error: profErr } = await effectiveSupabase
              .from("profiles")
              .select("*")
              .order("created_at", { ascending: false });

            if (profErr) {
              console.error("Lỗi fetch profiles từ Supabase:", profErr);
            } else if (Array.isArray(sbProfiles) && sbProfiles.length > 0) {
              recoveredStudents = sbProfiles.filter(
                (p: any) => p.role !== "admin" && p.role !== "teacher"
              );
            }
          } catch (err) {
            console.error("Ngoại lệ khi query bảng profiles:", err);
          }
        }

        if (recoveredAttempts.length === 0) {
          try {
            const { data: sbAtt, error: attErr } = await effectiveSupabase
              .from("exam_attempts")
              .select("*")
              .order("created_at", { ascending: false });

            if (attErr) {
              console.error("Lỗi fetch exam_attempts từ Supabase:", attErr);
            } else if (Array.isArray(sbAtt) && sbAtt.length > 0) {
              recoveredAttempts = sbAtt;
            }
          } catch (err) {
            console.error("Ngoại lệ khi query bảng exam_attempts:", err);
          }
        }
      }

      // Bước 3: Chỉ cập nhật State & parent khi có dữ liệu thật (> 0), tuyệt đối KHÔNG ghi đè mảng rỗng!
      if (recoveredExams.length > 0) {
        setInternalExams(recoveredExams);
        safeSaveExamsToLocal(recoveredExams);
        if (typeof savePracticeExams === "function") {
          try {
            savePracticeExams(recoveredExams);
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
          `Đã khôi phục & đồng bộ ${
            recoveredExams.length || internalExams.length
          } đề luyện thi và ${
            recoveredStudents.length || internalStudents.length
          } học sinh!`,
          "success"
        );
      }
    },
    [effectiveSupabase, savePracticeExams, showToast, internalExams.length, internalStudents.length]
  );

  // Tự động kích hoạt khôi phục ngay khi mở PracticeTab nếu danh sách đang bị trống
  useEffect(() => {
    if (
      (propPracticeExams.length === 0 && internalExams.length === 0) ||
      (propRegisteredStudents.length === 0 && internalStudents.length === 0)
    ) {
      fetchExamsAndStudentsSafely(false);
    } else {
      // Vẫn đồng bộ ngầm để lấy dữ liệu mới nhất từ Supabase mà không xóa cache cũ
      fetchExamsAndStudentsSafely(false);
    }
  }, []);

  // Dữ liệu đề thi, học sinh và lượt làm bài hiệu lực (Ưu tiên mảng nào có dữ liệu > 0)
  const effectiveExams = useMemo(() => {
    if (Array.isArray(propPracticeExams) && propPracticeExams.length > 0) {
      return propPracticeExams;
    }
    return internalExams;
  }, [propPracticeExams, internalExams]);

  const effectiveStudents = useMemo(() => {
    if (Array.isArray(propRegisteredStudents) && propRegisteredStudents.length > 0) {
      return propRegisteredStudents;
    }
    return internalStudents;
  }, [propRegisteredStudents, internalStudents]);

  const effectiveAttempts = useMemo(() => {
    if (Array.isArray(propAllAttempts) && propAllAttempts.length > 0) {
      return propAllAttempts;
    }
    return internalAttempts;
  }, [propAllAttempts, internalAttempts]);

  // 4. DANH MỤC BẢNG SBD LỚP CỐ ĐỊNH (KHÔI PHỤC ĐỦ 23 HỌC SINH)
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

  // 5. TÍNH TOÁN DANH SÁCH ĐỀ KÈM THỐNG KÊ ĐIỂM SỐ
  const computedExamsWithScores = useMemo(() => {
    let list = Array.isArray(effectiveExams) ? [...effectiveExams] : [];
    if (practiceCategoryFilter && practiceCategoryFilter !== "Tất cả danh mục") {
      list = list.filter((ex) => (ex?.category || "Tự do") === practiceCategoryFilter);
    }

    if (searchKeyword.trim()) {
      const kw = normalizeStr(searchKeyword);
      list = list.filter(
        (ex) =>
          normalizeStr(ex?.title).includes(kw) ||
          normalizeStr(ex?.category).includes(kw) ||
          deriveExamCode3Digits(ex).includes(kw)
      );
    }

    return list.map((ex) => {
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
  }, [effectiveExams, practiceCategoryFilter, searchKeyword, effectiveAttempts]);

  // Điểm của từng học sinh trong Modal Bảng SBD theo đề đã chọn
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

  // IN BẢNG SBD RA GIẤY A4 (ẨN HOÀN TOÀN CỘT PHÂN HỆ ONLINE/OFFLINE)
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

  // XÓA 1 ĐỀ LUYỆN THI
  const handleDeletePracticeExam = async (exam: any) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa đề thi "${exam.title}"?`)) return;
    const updated = effectiveExams.filter((ex) => String(ex?.id) !== String(exam.id));
    setInternalExams(updated);
    safeSaveExamsToLocal(updated);
    if (typeof savePracticeExams === "function") {
      await savePracticeExams(updated);
    }
    if (effectiveSupabase) {
      try {
        await effectiveSupabase.from("practice_exams").delete().eq("id", exam.id);
      } catch (err) {
        console.error("Lỗi xóa đề trên Supabase:", err);
      }
    }
    if (showToast) {
      showToast(`Đã xóa đề "${exam.title}" thành công!`, "success");
    }
  };

  // BẬT/TẮT CHO PHÉP THI LẠI HOẶC XEM FILE ĐỀ
  const handleToggleExamFlag = async (
    exam: any,
    field: "allowRetake" | "allowViewFile"
  ) => {
    const nextVal = !(exam[field] ?? true);
    const updated = effectiveExams.map((ex) =>
      String(ex?.id) === String(exam.id) ? { ...ex, [field]: nextVal } : ex
    );
    setInternalExams(updated);
    safeSaveExamsToLocal(updated);
    if (typeof savePracticeExams === "function") {
      await savePracticeExams(updated);
    }
    if (effectiveSupabase) {
      try {
        await effectiveSupabase
          .from("practice_exams")
          .update({ [field]: nextVal })
          .eq("id", exam.id);
      } catch {}
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto text-left font-sans">
      {/* THANH TRẠNG THÁI ĐỒNG BỘ KHO LUYỆN ĐỀ */}
      {practiceSyncStatus && practiceSyncStatus.isSyncing && (
        <div className="bg-blue-50 border border-blue-300 p-3.5 rounded-xl flex items-center justify-between text-xs font-bold text-blue-900">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            <span>{practiceSyncStatus.message || "Đang đồng bộ đề thi lên đám mây..."}</span>
          </div>
          <span className="font-mono">{practiceSyncStatus.progress}%</span>
        </div>
      )}

      {/* 1. HEADER THỐNG KÊ & CỤM NÚT HÀNH ĐỘNG CHÍNH (CLEAN MINIMALIST UI) */}
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
              Tải đề Word/PDF cấu hình Azota, xuất phiếu tô trắc nghiệm A4 chuẩn Bộ GD&ĐT và chấm tự động qua Camera.
            </p>
          </div>

          {/* CỤM NÚT CÔNG CỤ */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isSelfFetching}
              onClick={() => fetchExamsAndStudentsSafely(true)}
              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              title="Khôi phục & Đồng bộ đề thi, học sinh từ Supabase"
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
                setScannerTargetExam(effectiveExams[0] || null);
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

        {/* 2. THANH CHUYỂN CHẾ ĐỘ (QUẢN LÝ ĐỀ | BẢNG ĐIỂM) & LỌC DANH MỤC */}
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
              Danh sách Đề thi ({effectiveExams.length})
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
            <select
              value={practiceCategoryFilter}
              onChange={(e) =>
                setPracticeCategoryFilter && setPracticeCategoryFilter(e.target.value)
              }
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 outline-none focus:border-blue-600 cursor-pointer"
            >
              {PRACTICE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <div className="relative min-w-[210px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm tên đề, mã đề..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-blue-600"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => setSearchKeyword("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. DANH SÁCH ĐỀ LUYỆN THI HOẶC BẢNG THỐNG KÊ ĐIỂM */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {(propIsLoadingExams || isSelfFetching) && computedExamsWithScores.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
            <p className="text-xs font-semibold text-slate-500">
              {uploadProgressText || "Đang tải danh sách đề thi từ đám mây..."}
            </p>
          </div>
        ) : computedExamsWithScores.length === 0 ? (
          <div className="py-14 text-center space-y-3 px-4">
            <FolderOpen className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-700">
                Chưa có đề thi nào trong bộ lọc hiện tại
              </h4>
              <p className="text-xs text-slate-400">
                Bấm nút <strong>"🔄 Đồng bộ"</strong> để tải lại từ máy chủ hoặc bấm{" "}
                <strong>"+ Tải Đề Mới (Word/PDF)"</strong> để thêm đề.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchExamsAndStudentsSafely(true)}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Khôi phục dữ liệu từ Supabase
            </button>
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
                    <td className="py-3.5 px-3 text-center font-semibold text-slate-400">
                      {idx + 1}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800 text-xs sm:text-sm">
                        {exam.title}
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
                        onChange={(e) =>
                          handleChangeExamCategory &&
                          handleChangeExamCategory(exam.id, e.target.value)
                        }
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
                        {/* Nút In Phiếu A4 chuẩn Bộ GD&ĐT của riêng đề này */}
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
                          title="In phiếu trả lời A4 chuẩn Bộ GD&ĐT cho đề này"
                        >
                          <Printer className="w-3.5 h-3.5 text-blue-600" />
                          <span>Phiếu A4</span>
                        </button>

                        {/* Nút Mở Camera Chấm OMR cho đề này */}
                        <button
                          type="button"
                          onClick={() => {
                            setScannerTargetExam(exam);
                            setIsScannerOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                          title="Chấm phiếu trả lời bằng Camera cho đề này"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>Chấm OMR</span>
                        </button>

                        {/* Nút Chỉnh sửa Đáp án / Câu hỏi */}
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

                        {/* Nút Gắn Video Chữa Đề */}
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

                        {/* Nút Thi thử (Test Admin) */}
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

                        {/* Nút Xóa đề */}
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
          /* TAB PHỤ 2: THỐNG KÊ ĐIỂM SỐ & LƯỢT NỘP CỦA TỪNG ĐỀ */
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

      {/* MODAL BẢNG SBD LỚP & PHIẾU GHI ĐIỂM (LỌC ONLINE/OFFLINE & ẨN CỘT PHÂN HỆ KHI IN) */}
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

      {/* MODAL CAMERA CHẤM OMR TRỰC TIẾP TẠI TAB KHO LUYỆN ĐỀ */}
      <AdminBulkOMRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        initialSelectedQuiz={scannerTargetExam}
        chapters={chapters}
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
