"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Printer,
  Camera,
  Users,
  Search,
  Eye,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  Save,
  ZoomIn,
  ZoomOut,
  Loader2,
  RefreshCw,
  UserPlus,
  Calendar,
  Clock
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  extractExamQuestionCounts,
  deriveExamCode3Digits,
  formatStudentAutoSBD,
  generatePrintableAnswerSheetPagesSVG,
  openPrintableDynamicAnswerSheet,
  scanOMRSheetFromCanvas,
  gradeOMRSubmission,
  OMR_CANONICAL_WIDTH,
  OMR_CANONICAL_HEIGHT
} from "@/lib/omrEngine";

export type AttendanceStatusType = "present" | "makeup_done" | "absent_need_makeup";

export interface MakeupSessionItem {
  date: string; // VD: "Thứ 5 (05/11)" hoặc "2026-11-05"
  shift: string; // VD: "Sáng 1 (08:00 - 09:30)"
  type: "makeup" | "support"; // 'makeup': Học bù bài vắng | 'support': Bổ trợ tăng cường
  note?: string;
}

export const SUPPORT_SHIFT_OPTIONS = [
  { id: "sang_1", label: "Sáng 1 (08:00 - 09:30)", group: "Ca Sáng" },
  { id: "sang_2", label: "Sáng 2 (09:30 - 11:00)", group: "Ca Sáng" },
  { id: "chieu_1", label: "Chiều 1 (14:30 - 16:00)", group: "Ca Chiều" },
  { id: "chieu_2", label: "Chiều 2 (16:00 - 17:30)", group: "Ca Chiều" },
  { id: "toi_1", label: "Tối 1 (18:00 - 19:30)", group: "Ca Tối" },
  { id: "toi_2", label: "Tối 2 (19:30 - 21:00)", group: "Ca Tối" },
  { id: "dem_online", label: "Đêm Online (22:00 - 23:00)", group: "Ca Đêm (Online)" }
] as const;

export interface StudentRecordWithSBD {
  id: string;
  sbd: string; // Cố định vĩnh viễn 6 chữ số: "000001", "000002"...
  username: string;
  full_name: string;
  school: string;
  grade?: string;
  mode: "Online" | "Offline";
  modeKey: "online" | "offline";
  attendanceStatus: AttendanceStatusType;
  makeupSessions: MakeupSessionItem[];
}

export interface PaperExamManagerTabProps {
  chapters?: any[];
  practiceExams?: any[];
  registeredStudents?: any[];
  allAttempts?: any[];
  setAllAttempts?: React.Dispatch<React.SetStateAction<any[]>> | ((attempts: any[]) => void);
  onOpenBulkScannerModal?: (selectedQuiz?: any) => void;
  showToast?: (msg: string, type?: "success" | "error") => void;
}

interface UnifiedQuizSourceItem {
  id: string;
  title: string;
  sourceType: "homework" | "test" | "practice";
  sourceLabel: string;
  chapterId?: string;
  chapterTitle?: string;
  lessonId?: string;
  lessonTitle?: string;
  assignedMonth?: number;
  assignedWeek?: number;
  examCode: string;
  part1Count: number;
  part2Count: number;
  part3Count: number;
  totalQuestions: number;
  rawQuizObj: any;
}

const PERMANENT_SBD_MAP_KEY = "edunexus_permanent_sbd_registry";
const HIGHEST_SBD_COUNTER_KEY = "edunexus_highest_allocated_sbd";
const STUDENT_ATTENDANCE_MAKEUP_KEY = "edunexus_student_attendance_makeup_state";

function normalizeStr(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseSbdNumber(sbdRaw: any): number {
  if (!sbdRaw) return 0;
  const digits = String(sbdRaw).replace(/\D/g, "");
  if (!digits) return 0;
  const num = parseInt(digits, 10);
  return isNaN(num) ? 0 : num;
}

function format6DigitSBD(num: number): string {
  return String(Math.max(1, num)).padStart(6, "0").slice(-6);
}

/**
 * ĐỒNG BỘ VÀ CẤP PHÁT SBD VĨNH VIỄN (TUYỆT ĐỐI KHÔNG DÙNG INDEX + 1 KHI ĐÃ CÓ SBD)
 * - Học sinh đã có `sbd` hoặc đã lưu trong Registry sẽ giữ nguyên SBD suốt đời.
 * - Học sinh mới thêm sẽ nhận `MAX(sbd) + 1`.
 * - Khi xóa học sinh ở giữa, `HIGHEST_SBD_COUNTER_KEY` vẫn giữ mốc cao nhất để không cấp trùng lại mã đã xóa.
 */
export function ensurePermanentStudentSBDList(rawStudents: any[]): any[] {
  let savedRegistry: Record<string, string> = {};
  let highestAllocated = 0;

  if (typeof window !== "undefined") {
    try {
      savedRegistry = JSON.parse(localStorage.getItem(PERMANENT_SBD_MAP_KEY) || "{}");
    } catch {}
    try {
      highestAllocated = parseInt(localStorage.getItem(HIGHEST_SBD_COUNTER_KEY) || "0", 10) || 0;
    } catch {}
  }

  // Quét tìm MAX(sbd) hiện có trong cả Registry lẫn mảng học sinh truyền vào
  Object.values(savedRegistry).forEach((sbdVal) => {
    const n = parseSbdNumber(sbdVal);
    if (n > highestAllocated) highestAllocated = n;
  });

  (rawStudents || []).forEach((s) => {
    if (!s) return;
    const stuId = String(s.id || "").trim();
    const explicitSbdNum = parseSbdNumber(s.sbd);
    if (explicitSbdNum > 0) {
      const formatted = format6DigitSBD(explicitSbdNum);
      if (stuId) savedRegistry[stuId] = formatted;
      if (explicitSbdNum > highestAllocated) highestAllocated = explicitSbdNum;
    }
  });

  let registryChanged = false;

  // Với các học sinh chưa có SBD trong dữ liệu gốc, kiểm tra trong Registry trước; nếu chưa có mới cấp MAX(sbd) + 1
  const enriched = (rawStudents || []).filter(Boolean).map((s) => {
    const stuId = String(s.id || "").trim();
    const existingExplicit = parseSbdNumber(s.sbd);

    if (existingExplicit > 0) {
      const fixedSbd = format6DigitSBD(existingExplicit);
      if (stuId && savedRegistry[stuId] !== fixedSbd) {
        savedRegistry[stuId] = fixedSbd;
        registryChanged = true;
      }
      return { ...s, sbd: fixedSbd };
    }

    if (stuId && savedRegistry[stuId]) {
      return { ...s, sbd: savedRegistry[stuId] };
    }

    highestAllocated += 1;
    const newlyAssignedSbd = format6DigitSBD(highestAllocated);
    if (stuId) {
      savedRegistry[stuId] = newlyAssignedSbd;
    }
    registryChanged = true;
    return { ...s, sbd: newlyAssignedSbd };
  });

  if (typeof window !== "undefined" && (registryChanged || highestAllocated > 0)) {
    try {
      localStorage.setItem(PERMANENT_SBD_MAP_KEY, JSON.stringify(savedRegistry));
      localStorage.setItem(HIGHEST_SBD_COUNTER_KEY, String(highestAllocated));
    } catch {}
  }

  return enriched;
}

export default function PaperExamManagerTab({
  chapters = [],
  practiceExams = [],
  registeredStudents = [],
  allAttempts: propAttempts = [],
  setAllAttempts,
  onOpenBulkScannerModal,
  showToast
}: PaperExamManagerTabProps) {
  const [sourceFilter, setSourceFilter] = useState<"all" | "homework" | "test" | "practice">("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("all");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("all");
  const [selectedQuizId, setSelectedQuizId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [showSheetPreviewModal, setShowSheetPreviewModal] = useState<boolean>(false);
  const [showSbdDirectoryModal, setShowSbdDirectoryModal] = useState<boolean>(false);
  const [showInternalBulkScanner, setShowInternalBulkScanner] = useState<boolean>(false);

  const [sbdModalModeFilter, setSbdModalModeFilter] = useState<"all" | "offline" | "online">("all");
  const [sbdModalSelectedQuizId, setSbdModalSelectedQuizId] = useState<string>("none");

  // STATE QUẢN LÝ THÊM HỌC SINH MỚI & XẾP LỊCH HỌC BÙ / BỔ TRỢ TRONG BẢNG SBD
  const [newStuNameInput, setNewStuNameInput] = useState<string>("");
  const [newStuSchoolInput, setNewStuSchoolInput] = useState<string>("");
  const [newStuModeInput, setNewStuModeInput] = useState<"offline" | "online">("offline");
  const [activeMakeupScheduleStudentId, setActiveMakeupScheduleStudentId] = useState<string | null>(
    null
  );
  const [scheduleDateInput, setScheduleDateInput] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}/${d.getFullYear()}`;
  });
  const [scheduleTypeInput, setScheduleTypeInput] = useState<"makeup" | "support">("makeup");
  const [scheduleNoteInput, setScheduleNoteInput] = useState<string>("");

  const [inspectingAttempt, setInspectingAttempt] = useState<any | null>(null);
  const [editScoreInput, setEditScoreInput] = useState<string>("");
  const [isSavingScore, setIsSavingScore] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(1);

  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchProgressText, setBatchProgressText] = useState<string>("");
  const [isSyncingFromSupabase, setIsSyncingFromSupabase] = useState<boolean>(false);
  const batchFileInputRef = useRef<HTMLInputElement | null>(null);

  const [localAttempts, setLocalAttempts] = useState<any[]>([]);
  const [localStudents, setLocalStudents] = useState<any[]>([]);
  const [supabasePaperAttempts, setSupabasePaperAttempts] = useState<any[]>([]);

  // STATE LƯU TRẠNG THÁI ĐIỂM DANH & DANH SÁCH CA HỌC BÙ / BỔ TRỢ CỦA TỪNG HỌC SINH
  const [studentAttendanceMap, setStudentAttendanceMap] = useState<
    Record<
      string,
      {
        attendanceStatus: AttendanceStatusType;
        makeupSessions: MakeupSessionItem[];
      }
    >
  >(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(STUDENT_ATTENDANCE_MAKEUP_KEY);
        if (raw) return JSON.parse(raw);
      } catch {}
    }
    return {};
  });

  const persistAttendanceMap = useCallback(
    (
      nextMap: Record<
        string,
        {
          attendanceStatus: AttendanceStatusType;
          makeupSessions: MakeupSessionItem[];
        }
      >
    ) => {
      setStudentAttendanceMap(nextMap);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(STUDENT_ATTENDANCE_MAKEUP_KEY, JSON.stringify(nextMap));
          window.dispatchEvent(new Event("storage"));
        } catch {}
      }
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedAtt = localStorage.getItem("edunexus_attempts");
      const delIds = new Set<string>(
        JSON.parse(localStorage.getItem("edunexus_deleted_attempt_ids") || "[]")
      );
      if (savedAtt) {
        const parsed = JSON.parse(savedAtt);
        if (Array.isArray(parsed)) {
          setLocalAttempts(parsed.filter((a: any) => !delIds.has(String(a?.id || ""))));
        }
      }
    } catch {}

    try {
      const savedStu = localStorage.getItem("edunexus_registered_students");
      if (savedStu) {
        const parsedStu = JSON.parse(savedStu);
        if (Array.isArray(parsedStu) && parsedStu.length > 0) {
          setLocalStudents(ensurePermanentStudentSBDList(parsedStu));
          return;
        }
      }
    } catch {}

    if (Array.isArray(registeredStudents) && registeredStudents.length > 0) {
      setLocalStudents(ensurePermanentStudentSBDList(registeredStudents));
    }
  }, [propAttempts, registeredStudents]);

  const effectiveStudents = useMemo(() => {
    const sourceList =
      localStudents.length > 0
        ? localStudents
        : Array.isArray(registeredStudents)
        ? registeredStudents
        : [];
    return ensurePermanentStudentSBDList(sourceList);
  }, [localStudents, registeredStudents]);

  /**
   * 1. DANH MỤC HỌC VIÊN KÈM SBD CỐ ĐỊNH VĨNH VIỄN & TRẠNG THÁI HỌC BÙ / BỔ TRỢ
   * Tuyệt đối KHÔNG dùng `idx + 1` để gán SBD! SBD lấy cố định từ `stu.sbd`.
   */
  const sbdDirectoryList = useMemo<StudentRecordWithSBD[]>(() => {
    const pool: StudentRecordWithSBD[] = [];
    const seen = new Set<string>();

    (effectiveStudents || []).forEach((s: any) => {
      if (!s) return;
      const key = String(s.id || s.username || s.full_name || "").trim();
      if (!key || seen.has(key.toLowerCase())) return;
      seen.add(key.toLowerCase());

      const stuId = String(s.id || key);
      const rawMode = String(s.learning_mode || s.study_mode || "offline").toLowerCase();
      const isOnline = rawMode.includes("on");
      const attRecord = studentAttendanceMap[stuId];

      pool.push({
        id: stuId,
        sbd: format6DigitSBD(parseSbdNumber(s.sbd) || 1),
        username: String(s.username || ""),
        full_name: String(s.full_name || s.name || s.username || "Học sinh"),
        school: String(s.school || "THPT"),
        grade: String(s.grade || "Lớp 12"),
        mode: isOnline ? "Online" : "Offline",
        modeKey: isOnline ? "online" : "offline",
        attendanceStatus:
          attRecord?.attendanceStatus ||
          (s.attendanceStatus as AttendanceStatusType) ||
          "present",
        makeupSessions: Array.isArray(attRecord?.makeupSessions)
          ? attRecord.makeupSessions
          : Array.isArray(s.makeupSessions)
          ? s.makeupSessions
          : []
      });
    });

    // Sắp xếp theo SBD tăng dần để cố định vị trí và không bao giờ nhảy SBD
    pool.sort((a, b) => parseSbdNumber(a.sbd) - parseSbdNumber(b.sbd));

    if (typeof window !== "undefined" && pool.length > 0) {
      try {
        localStorage.setItem("edunexus_sbd_directory", JSON.stringify(pool));
      } catch {}
    }

    return pool;
  }, [effectiveStudents, studentAttendanceMap]);

  const sbdToStudentMap = useMemo(() => {
    const map = new Map<string, StudentRecordWithSBD>();
    sbdDirectoryList.forEach((item) => {
      map.set(item.sbd, item);
      map.set(String(parseSbdNumber(item.sbd)), item);
      map.set(item.id.trim().toLowerCase(), item);
    });
    return map;
  }, [sbdDirectoryList]);

  /**
   * 2. CÁC HÀM XỬ LÝ NGHIỆP VỤ: THÊM HỌC SINH (MAX(SBD)+1), XÓA HỌC SINH (GIỮ NGUYÊN SBD),
   *    CẬP NHẬT ĐIỂM DANH & CHỌN CA HỌC BÙ / BỔ TRỢ
   */
  const addStudent = useCallback(
    async (fullName: string, school: string = "THPT", mode: "offline" | "online" = "offline") => {
      const cleanName = fullName.trim();
      if (!cleanName) {
        if (showToast) showToast("Vui lòng nhập họ và tên học sinh!", "error");
        return null;
      }

      // Tìm MAX(sbd) từ toàn bộ học sinh hiện tại + bộ đếm lịch sử để cộng thêm 1
      let maxSbdNum = 0;
      if (typeof window !== "undefined") {
        try {
          const savedMax = parseInt(localStorage.getItem(HIGHEST_SBD_COUNTER_KEY) || "0", 10);
          if (!isNaN(savedMax) && savedMax > maxSbdNum) maxSbdNum = savedMax;

          const regMap = JSON.parse(localStorage.getItem(PERMANENT_SBD_MAP_KEY) || "{}");
          Object.values(regMap).forEach((val) => {
            const n = parseSbdNumber(val);
            if (n > maxSbdNum) maxSbdNum = n;
          });
        } catch {}
      }

      effectiveStudents.forEach((stu: any) => {
        const n = parseSbdNumber(stu?.sbd);
        if (n > maxSbdNum) maxSbdNum = n;
      });

      const nextSbdNumber = maxSbdNum + 1;
      const newSbdCode = format6DigitSBD(nextSbdNumber);
      const newStudentId = `stu-${Date.now()}`;

      const newStudentObj = {
        id: newStudentId,
        sbd: newSbdCode,
        full_name: cleanName,
        school: school.trim() || "THPT",
        grade: "Lớp 12",
        learning_mode: mode,
        study_mode: mode,
        approval_status: "approved",
        status: "approved",
        is_approved: true,
        attendanceStatus: "present" as AttendanceStatusType,
        makeupSessions: [] as MakeupSessionItem[],
        created_at: new Date().toISOString()
      };

      const updatedStudents = [...effectiveStudents, newStudentObj];
      setLocalStudents(updatedStudents);

      if (typeof window !== "undefined") {
        try {
          const regMap = JSON.parse(localStorage.getItem(PERMANENT_SBD_MAP_KEY) || "{}");
          regMap[newStudentId] = newSbdCode;
          localStorage.setItem(PERMANENT_SBD_MAP_KEY, JSON.stringify(regMap));
          localStorage.setItem(HIGHEST_SBD_COUNTER_KEY, String(nextSbdNumber));
          localStorage.setItem("edunexus_registered_students", JSON.stringify(updatedStudents));
          window.dispatchEvent(new Event("storage"));
        } catch {}
      }

      try {
        await supabase.from("profiles").upsert({
          id: newStudentId,
          full_name: cleanName,
          school: newStudentObj.school,
          grade: "Lớp 12",
          role: "student",
          learning_mode: mode,
          approval_status: "approved",
          created_at: newStudentObj.created_at
        });
      } catch {}

      if (showToast) {
        showToast(`Đã thêm học sinh ${cleanName} với SBD cố định: ${newSbdCode}`, "success");
      }
      return newStudentObj;
    },
    [effectiveStudents, showToast]
  );

  const deleteStudent = useCallback(
    async (studentId: string) => {
      const targetStu = effectiveStudents.find((s: any) => String(s?.id) === String(studentId));
      if (!targetStu) return;

      if (
        !confirm(
          `Xác nhận xóa học viên "${targetStu.full_name}" (SBD: ${targetStu.sbd})? SBD của toàn bộ các học viên còn lại sẽ được giữ nguyên tuyệt đối.`
        )
      ) {
        return;
      }

      // Chỉ lọc bỏ học sinh bị xóa, tuyệt đối KHÔNG đánh số lại SBD của các học sinh còn lại
      const remainingStudents = effectiveStudents.filter(
        (s: any) => String(s?.id) !== String(studentId)
      );
      setLocalStudents(remainingStudents);

      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            "edunexus_registered_students",
            JSON.stringify(remainingStudents)
          );
          localStorage.setItem("edunexus_sbd_directory", JSON.stringify(remainingStudents));
          window.dispatchEvent(new Event("storage"));
        } catch {}
      }

      try {
        await supabase.from("profiles").delete().eq("id", studentId);
      } catch {}

      if (showToast) {
        showToast(
          `Đã xóa học viên ${targetStu.full_name}. Toàn bộ SBD còn lại được giữ nguyên!`,
          "success"
        );
      }
    },
    [effectiveStudents, showToast]
  );

  const updateAttendance = useCallback(
    (studentId: string, status: AttendanceStatusType) => {
      const currentEntry = studentAttendanceMap[studentId] || {
        attendanceStatus: "present",
        makeupSessions: []
      };
      const nextMap = {
        ...studentAttendanceMap,
        [studentId]: {
          ...currentEntry,
          attendanceStatus: status
        }
      };
      persistAttendanceMap(nextMap);

      if (status === "absent_need_makeup") {
        setActiveMakeupScheduleStudentId(studentId);
      }
    },
    [studentAttendanceMap, persistAttendanceMap]
  );

  const toggleMakeupShift = useCallback(
    (
      studentId: string,
      dateStr: string,
      shiftLabel: string,
      sessionType: "makeup" | "support" = "makeup",
      noteStr?: string
    ) => {
      const cleanDate = dateStr.trim() || "Chưa chọn ngày";
      const currentEntry = studentAttendanceMap[studentId] || {
        attendanceStatus: "absent_need_makeup",
        makeupSessions: []
      };
      const existingList = Array.isArray(currentEntry.makeupSessions)
        ? [...currentEntry.makeupSessions]
        : [];

      const existingIdx = existingList.findIndex(
        (item) => item.date === cleanDate && item.shift === shiftLabel
      );

      let updatedSessions: MakeupSessionItem[];
      if (existingIdx >= 0) {
        updatedSessions = existingList.filter((_, idx) => idx !== existingIdx);
      } else {
        updatedSessions = [
          ...existingList,
          {
            date: cleanDate,
            shift: shiftLabel,
            type: sessionType,
            note: noteStr?.trim() || undefined
          }
        ];
      }

      const nextMap = {
        ...studentAttendanceMap,
        [studentId]: {
          ...currentEntry,
          makeupSessions: updatedSessions
        }
      };
      persistAttendanceMap(nextMap);
    },
    [studentAttendanceMap, persistAttendanceMap]
  );

  // 3. HÀM NẠP DỮ LIỆU BÀI THI GIẤY TỪ SUPABASE
  const fetchPaperSubmissions = useCallback(
    async (showNotification: boolean = false) => {
      setIsSyncingFromSupabase(true);
      try {
        const delIds =
          typeof window !== "undefined"
            ? new Set<string>(
                JSON.parse(localStorage.getItem("edunexus_deleted_attempt_ids") || "[]")
              )
            : new Set<string>();

        const collected: any[] = [];

        const { data: sbAttempts, error: sbErr } = await supabase
          .from("exam_attempts")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);

        if (!sbErr && Array.isArray(sbAttempts)) {
          collected.push(...sbAttempts);
        }

        const paperMap = new Map<string, any>();

        collected.forEach((row: any) => {
          if (!row) return;
          const meta = row.answers?.__paper_omr_meta || row.user_answers?.__paper_omr_meta || null;
          const isPaperRow =
            row.submission_type === "paper" ||
            row.submission_type === "digital_sheet" ||
            Boolean(row.scanned_image_url) ||
            Boolean(row.paper_scan_url) ||
            Boolean(row.omr_raw_data) ||
            Boolean(meta) ||
            String(row.id || "").startsWith("paper_") ||
            String(row.id || "").startsWith("att-paper-");

          if (!isPaperRow) return;

          const quizId = String(row.exam_id || row.quiz_id || row.quizId || "").trim();
          const studentId = String(row.student_id || row.studentId || row.user_id || "").trim();
          const uniqueKey = String(row.id || `paper_${quizId}_${studentId}`);
          if (delIds.has(uniqueKey)) return;

          const matchedStu = sbdToStudentMap.get(studentId.toLowerCase());
          const normalizedRow = {
            ...row,
            id: uniqueKey,
            quiz_id: quizId,
            quizId: quizId,
            exam_id: quizId,
            student_id: studentId,
            studentId: studentId,
            student_name:
              row.student_name ||
              row.studentName ||
              meta?.student_name ||
              matchedStu?.full_name ||
              "Học sinh",
            studentName:
              row.student_name ||
              row.studentName ||
              meta?.student_name ||
              matchedStu?.full_name ||
              "Học sinh",
            exam_title: row.exam_title || row.examTitle || row.quiz_title || meta?.exam_title || "",
            examTitle: row.exam_title || row.examTitle || row.quiz_title || meta?.exam_title || "",
            score: Number(row.score ?? row.points ?? 0),
            points: Number(row.score ?? row.points ?? 0),
            correct_count: Number(
              row.correct_answers_count ?? row.correct_count ?? row.correctCount ?? 0
            ),
            correctCount: Number(
              row.correct_answers_count ?? row.correct_count ?? row.correctCount ?? 0
            ),
            total_questions: Number(row.total_questions ?? row.totalQuestions ?? 0),
            totalQuestions: Number(row.total_questions ?? row.totalQuestions ?? 0),
            submission_type: "paper",
            paper_scan_url:
              row.scanned_image_url ||
              row.paper_scan_url ||
              meta?.scanned_image_url ||
              row.omr_raw_data?.warped_image_data_url ||
              "",
            omr_raw_data: row.omr_raw_data || {
              detected_sbd: meta?.detected_sbd || matchedStu?.sbd || "",
              detected_exam_code: meta?.detected_exam_code || "",
              flagged_questions: meta?.flagged_questions || [],
              bubble_coordinates: meta?.bubble_coordinates || [],
              confidence: meta?.confidence || 98
            },
            created_at: row.created_at || row.createdAt || new Date().toISOString(),
            createdAt: row.created_at || row.createdAt || new Date().toISOString()
          };

          paperMap.set(uniqueKey, normalizedRow);
        });

        const freshPaperList = Array.from(paperMap.values());
        setSupabasePaperAttempts(freshPaperList);

        if (freshPaperList.length > 0) {
          const freshIds = new Set(freshPaperList.map((x) => String(x.id)));
          const mergedGlobal = [
            ...freshPaperList,
            ...(Array.isArray(propAttempts) && propAttempts.length > 0
              ? propAttempts
              : localAttempts
            ).filter((a: any) => !freshIds.has(String(a?.id)))
          ];

          setLocalAttempts(mergedGlobal);
          if (typeof setAllAttempts === "function") {
            (setAllAttempts as any)(mergedGlobal);
          }
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("edunexus_attempts", JSON.stringify(mergedGlobal));
            } catch {}
          }
        }

        if (showNotification && showToast) {
          showToast(
            `Đã đồng bộ ${freshPaperList.length} bài thi giấy mới nhất từ Supabase!`,
            "success"
          );
        }
      } catch (err) {
        console.warn("Lỗi fetchPaperSubmissions:", err);
      } finally {
        setIsSyncingFromSupabase(false);
      }
    },
    [sbdToStudentMap, propAttempts, localAttempts, setAllAttempts, showToast]
  );

  useEffect(() => {
    fetchPaperSubmissions(false);

    const channel = supabase
      .channel("paper-exams-realtime-sync")
      .on("broadcast", { event: "new_attempt" }, () => {
        fetchPaperSubmissions(false);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "exam_attempts" }, () => {
        fetchPaperSubmissions(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPaperSubmissions]);

  const effectiveAttempts = useMemo(() => {
    const map = new Map<string, any>();
    (Array.isArray(propAttempts) && propAttempts.length > 0 ? propAttempts : localAttempts).forEach(
      (a: any) => {
        if (a && a.id) map.set(String(a.id), a);
      }
    );
    supabasePaperAttempts.forEach((a: any) => {
      if (a && a.id) map.set(String(a.id), a);
    });
    return Array.from(map.values());
  }, [propAttempts, localAttempts, supabasePaperAttempts]);

  const allUnifiedQuizzes = useMemo<UnifiedQuizSourceItem[]>(() => {
    const list: UnifiedQuizSourceItem[] = [];

    (chapters || []).forEach((chap: any) => {
      const cId = String(chap?.id || "");
      const cTitle = String(chap?.title || "Chương");

      (chap?.lessons || []).forEach((les: any) => {
        const lId = String(les?.id || "");
        const lTitle = String(les?.title || "Bài học");
        const lMonth = Number(les?.assigned_month) || 10;
        const lWeek = Number(les?.assigned_week) || 1;

        (les?.homework_files || []).forEach((hw: any) => {
          if (!hw || hw.is_drive_file) return;
          const counts = extractExamQuestionCounts(hw);
          list.push({
            id: String(hw.id),
            title: String(hw.title || "Bài tập về nhà"),
            sourceType: "homework",
            sourceLabel: "BTVN",
            chapterId: cId,
            chapterTitle: cTitle,
            lessonId: lId,
            lessonTitle: lTitle,
            assignedMonth: Number(hw.assigned_month) || lMonth,
            assignedWeek: Number(hw.assigned_week) || lWeek,
            examCode: deriveExamCode3Digits(hw),
            part1Count: counts.part1Count,
            part2Count: counts.part2Count,
            part3Count: counts.part3Count,
            totalQuestions: counts.totalCount,
            rawQuizObj: hw
          });
        });

        (les?.test_quizzes || []).forEach((tq: any) => {
          if (!tq || tq.is_drive_file) return;
          const counts = extractExamQuestionCounts(tq);
          list.push({
            id: String(tq.id),
            title: String(tq.title || "Đề kiểm tra định kỳ"),
            sourceType: "test",
            sourceLabel: "Đề KT",
            chapterId: cId,
            chapterTitle: cTitle,
            lessonId: lId,
            lessonTitle: lTitle,
            assignedMonth: Number(tq.assigned_month) || lMonth,
            assignedWeek: Number(tq.assigned_week) || lWeek,
            examCode: deriveExamCode3Digits(tq),
            part1Count: counts.part1Count,
            part2Count: counts.part2Count,
            part3Count: counts.part3Count,
            totalQuestions: counts.totalCount,
            rawQuizObj: tq
          });
        });
      });
    });

    (practiceExams || []).forEach((pe: any) => {
      if (!pe) return;
      const counts = extractExamQuestionCounts(pe);
      list.push({
        id: String(pe.id),
        title: String(pe.title || "Đề luyện thi"),
        sourceType: "practice",
        sourceLabel: pe.category || "Luyện đề",
        assignedMonth: Number(pe.assigned_month) || undefined,
        assignedWeek: Number(pe.assigned_week) || undefined,
        examCode: deriveExamCode3Digits(pe),
        part1Count: counts.part1Count,
        part2Count: counts.part2Count,
        part3Count: counts.part3Count,
        totalQuestions: counts.totalCount,
        rawQuizObj: pe
      });
    });

    return list;
  }, [chapters, practiceExams]);

  const lessonsInSelectedChapter = useMemo(() => {
    if (selectedChapterId === "all") return [];
    const found = (chapters || []).find((c: any) => String(c?.id) === selectedChapterId);
    return found?.lessons || [];
  }, [chapters, selectedChapterId]);

  const filteredQuizzes = useMemo(() => {
    return allUnifiedQuizzes.filter((q) => {
      if (sourceFilter !== "all" && q.sourceType !== sourceFilter) return false;
      if (monthFilter !== "all" && q.assignedMonth && q.assignedMonth !== Number(monthFilter)) {
        return false;
      }
      if (selectedChapterId !== "all" && q.chapterId !== selectedChapterId) return false;
      if (selectedLessonId !== "all" && q.lessonId !== selectedLessonId) return false;
      return true;
    });
  }, [allUnifiedQuizzes, sourceFilter, monthFilter, selectedChapterId, selectedLessonId]);

  const activeSelectedQuiz = useMemo<UnifiedQuizSourceItem | null>(() => {
    if (selectedQuizId !== "all") {
      const exact = allUnifiedQuizzes.find((q) => q.id === selectedQuizId);
      if (exact) return exact;
    }
    return filteredQuizzes[0] || allUnifiedQuizzes[0] || null;
  }, [selectedQuizId, filteredQuizzes, allUnifiedQuizzes]);

  const sbdModalSelectedQuizObj = useMemo<UnifiedQuizSourceItem | null>(() => {
    if (!sbdModalSelectedQuizId || sbdModalSelectedQuizId === "none") return null;
    return allUnifiedQuizzes.find((q) => q.id === sbdModalSelectedQuizId) || null;
  }, [sbdModalSelectedQuizId, allUnifiedQuizzes]);

  const sbdStudentScoreMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!sbdModalSelectedQuizObj) return map;

    const targetIdNorm = sbdModalSelectedQuizObj.id.trim().toLowerCase();
    const targetTitleNorm = normalizeStr(sbdModalSelectedQuizObj.title);

    (effectiveAttempts || []).forEach((att: any) => {
      if (!att) return;
      const attQuizId = String(att.quizId || att.quiz_id || att.exam_id || "").trim().toLowerCase();
      const attQuizTitle = normalizeStr(
        att.examTitle || att.quizTitle || att.quiz_title || att.title || ""
      );

      const isQuizMatch =
        (targetIdNorm && attQuizId === targetIdNorm) ||
        (targetTitleNorm && attQuizTitle === targetTitleNorm);
      if (!isQuizMatch) return;

      const sc = Number(att.score ?? att.points ?? 0);
      if (isNaN(sc)) return;

      const stuId = String(att.studentId || att.student_id || att.user_id || "").trim().toLowerCase();
      const stuName = normalizeStr(att.studentName || att.student_name || att.full_name || "");
      const stuSbd = String(att.omr_raw_data?.detected_sbd || "").trim();

      if (stuId) {
        const prev = map.get(`id:${stuId}`);
        if (prev === undefined || sc > prev) map.set(`id:${stuId}`, sc);
      }
      if (stuName) {
        const prev = map.get(`name:${stuName}`);
        if (prev === undefined || sc > prev) map.set(`name:${stuName}`, sc);
      }
      if (stuSbd && stuSbd !== "Chưa tô") {
        const prev = map.get(`sbd:${stuSbd}`);
        if (prev === undefined || sc > prev) map.set(`sbd:${stuSbd}`, sc);
      }
    });

    return map;
  }, [sbdModalSelectedQuizObj, effectiveAttempts]);

  const filteredSbdDirectoryForModal = useMemo(() => {
    return sbdDirectoryList
      .filter((stu) => {
        if (sbdModalModeFilter === "all") return true;
        return stu.modeKey === sbdModalModeFilter;
      })
      .map((stu, idx) => {
        const scoreById = sbdStudentScoreMap.get(`id:${stu.id.trim().toLowerCase()}`);
        const scoreByName = sbdStudentScoreMap.get(`name:${normalizeStr(stu.full_name)}`);
        const scoreBySbd = sbdStudentScoreMap.get(`sbd:${stu.sbd}`);
        const resolvedScore =
          scoreById !== undefined
            ? scoreById
            : scoreBySbd !== undefined
            ? scoreBySbd
            : scoreByName;

        return {
          ...stu,
          displayOrder: idx + 1,
          examScore: resolvedScore
        };
      });
  }, [sbdDirectoryList, sbdModalModeFilter, sbdStudentScoreMap]);

  const paperSubmissionsList = useMemo(() => {
    const quizMapById = new Map<string, UnifiedQuizSourceItem>();
    const quizMapByTitle = new Map<string, UnifiedQuizSourceItem>();
    allUnifiedQuizzes.forEach((q) => {
      quizMapById.set(q.id.trim().toLowerCase(), q);
      quizMapByTitle.set(normalizeStr(q.title), q);
    });

    return (effectiveAttempts || [])
      .filter((att: any) => {
        if (!att) return false;
        const meta = att.answers?.__paper_omr_meta || att.user_answers?.__paper_omr_meta;
        const isPaper =
          att.submission_type === "paper" ||
          att.submission_type === "digital_sheet" ||
          Boolean(att.scanned_image_url) ||
          Boolean(att.paper_scan_url) ||
          Boolean(att.omr_raw_data) ||
          Boolean(meta);
        return isPaper;
      })
      .map((att: any) => {
        const meta = att.answers?.__paper_omr_meta || att.user_answers?.__paper_omr_meta || {};
        const qId = String(att.quizId || att.quiz_id || att.exam_id || "").trim().toLowerCase();
        const qTitle = normalizeStr(
          att.examTitle || att.quizTitle || att.quiz_title || att.title || meta.exam_title || ""
        );
        const matchedQuiz =
          (qId && quizMapById.get(qId)) ||
          (qTitle && quizMapByTitle.get(qTitle)) ||
          null;

        const sourceType: "homework" | "test" | "practice" = matchedQuiz
          ? matchedQuiz.sourceType
          : meta.source_type ||
            (att.isHomework || att.is_homework || att.type === "homework"
              ? "homework"
              : att.type === "test"
              ? "test"
              : "practice");

        const rawDate = att.createdAt || att.created_at || att.submittedAt;
        const validDate = rawDate ? new Date(rawDate) : new Date();
        const month =
          Number(att.assigned_month) || matchedQuiz?.assignedMonth || validDate.getMonth() + 1;

        const stuIdStr = String(att.studentId || att.student_id || "").trim();
        const matchedStu = sbdToStudentMap.get(stuIdStr.toLowerCase());

        const detectedSbd =
          att.omr_raw_data?.detected_sbd ||
          meta.detected_sbd ||
          matchedStu?.sbd ||
          formatStudentAutoSBD(stuIdStr || 1);

        const detectedCode =
          att.omr_raw_data?.detected_exam_code ||
          meta.detected_exam_code ||
          matchedQuiz?.examCode ||
          "101";

        const flaggedList: number[] = Array.isArray(att.flagged_questions)
          ? att.flagged_questions
          : Array.isArray(att.omr_raw_data?.flagged_questions)
          ? att.omr_raw_data.flagged_questions
          : Array.isArray(meta.flagged_questions)
          ? meta.flagged_questions
          : [];

        return {
          ...att,
          resolvedQuiz: matchedQuiz,
          sourceType,
          sourceLabel:
            sourceType === "homework"
              ? "BTVN"
              : sourceType === "test"
              ? "Đề KT"
              : "Luyện đề",
          chapterId: matchedQuiz?.chapterId || "",
          lessonId: matchedQuiz?.lessonId || "",
          month,
          detectedSbd,
          detectedCode,
          flaggedList,
          paperScanUrl:
            att.scanned_image_url ||
            att.paper_scan_url ||
            meta.scanned_image_url ||
            att.omr_raw_data?.warped_image_data_url ||
            "",
          studentDisplayName:
            matchedStu?.full_name ||
            att.studentName ||
            att.student_name ||
            meta.student_name ||
            "Học sinh",
          examDisplayTitle:
            matchedQuiz?.title ||
            att.examTitle ||
            att.quizTitle ||
            meta.exam_title ||
            "Bài thi giấy",
          scoreVal: Number(att.score ?? att.points ?? 0),
          correctVal: Number(
            att.correct_answers_count ?? att.correctCount ?? att.correct_count ?? 0
          ),
          totalQVal: Number(
            att.totalQuestions ?? att.total_questions ?? matchedQuiz?.totalQuestions ?? 0
          ),
          dateFormatted: validDate.toLocaleString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          })
        };
      })
      .filter((item) => {
        if (sourceFilter !== "all" && item.sourceType !== sourceFilter) return false;
        if (monthFilter !== "all" && item.month !== Number(monthFilter)) return false;
        if (selectedChapterId !== "all" && item.chapterId !== selectedChapterId) return false;
        if (selectedLessonId !== "all" && item.lessonId !== selectedLessonId) return false;
        if (
          selectedQuizId !== "all" &&
          String(item.quizId || item.quiz_id || item.exam_id || "") !== selectedQuizId
        ) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = normalizeStr(searchQuery);
          const matchName = normalizeStr(item.studentDisplayName).includes(q);
          const matchExam = normalizeStr(item.examDisplayTitle).includes(q);
          const matchSbd = normalizeStr(item.detectedSbd).includes(q);
          if (!matchName && !matchExam && !matchSbd) return false;
        }
        return true;
      });
  }, [
    effectiveAttempts,
    allUnifiedQuizzes,
    sbdToStudentMap,
    sourceFilter,
    monthFilter,
    selectedChapterId,
    selectedLessonId,
    selectedQuizId,
    searchQuery
  ]);

  const handlePrintSbdDirectory = () => {
    if (typeof window === "undefined") return;
    const win = window.open("", "_blank");
    if (!win) return;

    const examHeaderTitle = sbdModalSelectedQuizObj
      ? `BẢNG ĐIỂM & SỐ BÁO DANH: ${sbdModalSelectedQuizObj.title.toUpperCase()} (MÃ ĐỀ ${sbdModalSelectedQuizObj.examCode})`
      : "BẢNG TRA CỨU SỐ BÁO DANH (SBD) CỐ ĐỊNH — TÂM CHÍ TÀI (TCT)";

    const lastColumnHeader = sbdModalSelectedQuizObj ? "ĐIỂM SỐ" : "TRẠNG THÁI / LỊCH BÙ";

    const rowsHtml = filteredSbdDirectoryForModal
      .map((stu) => {
        const attText =
          stu.attendanceStatus === "present"
            ? "✓ Có mặt"
            : stu.attendanceStatus === "makeup_done"
            ? "Nghỉ (Đã học bù)"
            : stu.makeupSessions.length > 0
            ? `Hẹn bù: ${stu.makeupSessions.map((m) => `${m.shift} (${m.date})`).join(", ")}`
            : "Vắng (Chưa xếp lịch)";

        const lastColContent = sbdModalSelectedQuizObj
          ? stu.examScore !== undefined
            ? `<strong style="color:#0f172a; font-size:14px;">${stu.examScore.toFixed(2)}đ</strong>`
            : `<span style="color:#94a3b8; letter-spacing:2px;">....................</span>`
          : `<span style="font-size:12px;">${attText}</span>`;

        return `
          <tr>
            <td style="text-align:center; font-weight:bold;">${stu.displayOrder}</td>
            <td style="text-align:center; font-weight:bold; color:#1D4ED8; font-size:15px; letter-spacing:1px; font-family:monospace;">${stu.sbd}</td>
            <td style="font-weight:bold;">${stu.full_name}</td>
            <td>${stu.school}</td>
            <td style="text-align:center;">${lastColContent}</td>
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
        <title>${examHeaderTitle}</title>
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
        <h2>${examHeaderTitle}</h2>
        <p>Mỗi học sinh có một mã SBD 6 chữ số cố định vĩnh viễn để tô vào mục 7 trên Phiếu trả lời trắc nghiệm A4.</p>
        <table>
          <thead>
            <tr>
              <th style="width:48px; text-align:center;">STT</th>
              <th style="width:135px; text-align:center;">SỐ BÁO DANH (6 SỐ)</th>
              <th>Họ và tên học sinh</th>
              <th>Trường THPT</th>
              <th style="width:180px; text-align:center;">${lastColumnHeader}</th>
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

  const handleBatchFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeSelectedQuiz) return;

    setIsBatchProcessing(true);
    const fileArray = Array.from(files);
    const newlyGraded: any[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setBatchProgressText(
        `Đang quét & chấm phiếu ${i + 1}/${fileArray.length}: ${file.name}...`
      );

      try {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(String(ev.target?.result || ""));
          reader.readAsDataURL(file);
        });

        const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = dataUrl;
        });

        const canvas = document.createElement("canvas");
        canvas.width = imgEl.naturalWidth || imgEl.width || OMR_CANONICAL_WIDTH;
        canvas.height = imgEl.naturalHeight || imgEl.height || OMR_CANONICAL_HEIGHT;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.drawImage(imgEl, 0, 0);

        const omrRaw = scanOMRSheetFromCanvas(canvas, activeSelectedQuiz.rawQuizObj);
        const graded = gradeOMRSubmission(omrRaw, activeSelectedQuiz.rawQuizObj);

        const matchedStudent =
          sbdToStudentMap.get(omrRaw.detected_sbd) ||
          sbdToStudentMap.get(String(parseInt(omrRaw.detected_sbd, 10))) ||
          null;

        const studentId = matchedStudent?.id || `sbd_${omrRaw.detected_sbd}`;
        const studentName =
          matchedStudent?.full_name || `Thí sinh SBD ${omrRaw.detected_sbd}`;
        const nowIso = new Date().toISOString();
        const attemptId = `paper_${activeSelectedQuiz.id}_${studentId}`;

        const enrichedAnswers = {
          ...(graded.normalizedAnswers || {}),
          __paper_omr_meta: {
            submission_type: "paper",
            detected_sbd: omrRaw.detected_sbd,
            detected_exam_code: omrRaw.detected_exam_code,
            student_name: studentName,
            school: matchedStudent?.school || "THPT",
            exam_title: activeSelectedQuiz.title,
            source_type: activeSelectedQuiz.sourceType,
            scanned_image_url: graded.updatedOmrData.warped_image_data_url || dataUrl,
            flagged_questions: graded.updatedOmrData.flagged_questions
          }
        };

        await supabase.from("exam_attempts").upsert(
          {
            exam_id: activeSelectedQuiz.id,
            student_id: studentId,
            score: graded.score,
            total_questions: graded.totalQuestions,
            correct_answers_count: graded.correctCount,
            answers: enrichedAnswers,
            submission_type: "paper",
            scanned_image_url: graded.updatedOmrData.warped_image_data_url || null,
            created_at: nowIso,
            updated_at: nowIso
          },
          { onConflict: "exam_id, student_id" }
        );

        const attemptRecord: any = {
          id: attemptId,
          quiz_id: activeSelectedQuiz.id,
          quizId: activeSelectedQuiz.id,
          exam_id: activeSelectedQuiz.id,
          quiz_title: activeSelectedQuiz.title,
          quizTitle: activeSelectedQuiz.title,
          exam_title: activeSelectedQuiz.title,
          examTitle: activeSelectedQuiz.title,
          student_id: studentId,
          studentId: studentId,
          user_id: studentId,
          student_name: studentName,
          studentName: studentName,
          full_name: studentName,
          school: matchedStudent?.school || "THPT",
          score: graded.score,
          points: graded.score,
          total_questions: graded.totalQuestions,
          totalQuestions: graded.totalQuestions,
          correct_count: graded.correctCount,
          correctCount: graded.correctCount,
          time_spent: "Làm trên giấy",
          timeSpent: "Làm trên giấy",
          is_homework: activeSelectedQuiz.sourceType === "homework",
          isHomework: activeSelectedQuiz.sourceType === "homework",
          type: activeSelectedQuiz.sourceType,
          submission_type: "paper",
          paper_scan_url: graded.updatedOmrData.warped_image_data_url || dataUrl,
          omr_raw_data: graded.updatedOmrData,
          recognition_confidence: graded.updatedOmrData.confidence,
          flagged_questions: graded.updatedOmrData.flagged_questions,
          answers: enrichedAnswers,
          created_at: nowIso,
          createdAt: nowIso
        };

        newlyGraded.push(attemptRecord);
      } catch (err) {
        console.error("Lỗi chấm ảnh:", file.name, err);
      }
    }

    if (newlyGraded.length > 0) {
      await fetchPaperSubmissions(false);
      if (showToast) {
        showToast(`Đã chấm và đồng bộ ${newlyGraded.length} phiếu trả lời!`, "success");
      }
    }

    setIsBatchProcessing(false);
    setBatchProgressText("");
    e.target.value = "";
  };

  const handleSaveInspectScore = async () => {
    if (!inspectingAttempt || isSavingScore) return;
    const newScore = Number(String(editScoreInput).replace(",", "."));
    if (isNaN(newScore) || newScore < 0 || newScore > 10) {
      alert("Vui lòng nhập điểm hợp lệ từ 0 đến 10!");
      return;
    }

    setIsSavingScore(true);
    const targetId = String(inspectingAttempt.id || "");

    const updatedList = effectiveAttempts.map((a: any) =>
      String(a?.id || "") === targetId ? { ...a, score: newScore, points: newScore } : a
    );

    if (typeof setAllAttempts === "function") {
      (setAllAttempts as any)(updatedList);
    }
    setLocalAttempts(updatedList);
    setSupabasePaperAttempts((prev) =>
      prev.map((a: any) =>
        String(a?.id || "") === targetId ? { ...a, score: newScore, points: newScore } : a
      )
    );
    setInspectingAttempt((prev: any) =>
      prev ? { ...prev, score: newScore, scoreVal: newScore } : null
    );

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_attempts", JSON.stringify(updatedList));
        window.dispatchEvent(new Event("storage"));
      } catch {}
    }

    try {
      await Promise.allSettled([
        supabase
          .from("exam_attempts")
          .update({ score: newScore, updated_at: new Date().toISOString() })
          .eq("id", targetId),
        supabase
          .from("exam_attempts")
          .update({ score: newScore, updated_at: new Date().toISOString() })
          .eq("exam_id", inspectingAttempt.exam_id || inspectingAttempt.quiz_id)
          .eq("student_id", inspectingAttempt.student_id || inspectingAttempt.studentId),
        supabase
          .from("quiz_results")
          .update({ score: newScore })
          .eq("id", targetId)
      ]);
    } catch {}

    setIsSavingScore(false);
    if (showToast) {
      showToast("Đã cập nhật điểm số bài thi giấy!", "success");
    }
  };

  const handleDeletePaperAttempt = async (att: any) => {
    if (!confirm(`Xác nhận xóa bài nộp trên giấy của ${att.studentDisplayName}?`)) return;
    const targetId = String(att.id || "");
    const updated = effectiveAttempts.filter((a: any) => String(a?.id || "") !== targetId);

    if (typeof setAllAttempts === "function") {
      (setAllAttempts as any)(updated);
    }
    setLocalAttempts(updated);
    setSupabasePaperAttempts((prev) => prev.filter((a: any) => String(a?.id || "") !== targetId));

    if (typeof window !== "undefined") {
      try {
        const delIds = JSON.parse(localStorage.getItem("edunexus_deleted_attempt_ids") || "[]");
        localStorage.setItem(
          "edunexus_deleted_attempt_ids",
          JSON.stringify(Array.from(new Set([...delIds, targetId])))
        );
        localStorage.setItem("edunexus_attempts", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      } catch {}
    }

    try {
      await Promise.allSettled([
        supabase.from("exam_attempts").delete().eq("id", targetId),
        supabase
          .from("exam_attempts")
          .delete()
          .eq("exam_id", att.exam_id || att.quiz_id)
          .eq("student_id", att.student_id || att.studentId),
        supabase.from("quiz_results").delete().eq("id", targetId)
      ]);
    } catch {}
  };

  const previewSvgPages = useMemo(() => {
    if (!showSheetPreviewModal || !activeSelectedQuiz) return [];
    return generatePrintableAnswerSheetPagesSVG({
      ...activeSelectedQuiz.rawQuizObj,
      examTitle: activeSelectedQuiz.title,
      examCode: activeSelectedQuiz.examCode
    });
  }, [showSheetPreviewModal, activeSelectedQuiz]);

  const activeSchedulingStudent = useMemo(() => {
    if (!activeMakeupScheduleStudentId) return null;
    return sbdDirectoryList.find((s) => s.id === activeMakeupScheduleStudentId) || null;
  }, [activeMakeupScheduleStudentId, sbdDirectoryList]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto text-left font-sans">
      {/* 1. HEADER & BỘ LỌC TỐI GIẢN */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-4 space-y-3.5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">
              Quản lý & Chấm thi Phiếu giấy (OMR)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Số báo danh (SBD) được khóa cố định vĩnh viễn theo từng học viên (MAX + 1).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (activeSelectedQuiz && sbdModalSelectedQuizId === "none") {
                  setSbdModalSelectedQuizId(activeSelectedQuiz.id);
                }
                setShowSbdDirectoryModal(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span>📋 Bảng SBD Cố Định & Điểm Danh ({sbdDirectoryList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSheetPreviewModal(true)}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>📄 Xuất phiếu in</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (typeof onOpenBulkScannerModal === "function") {
                  onOpenBulkScannerModal(activeSelectedQuiz?.rawQuizObj || activeSelectedQuiz);
                } else {
                  setShowInternalBulkScanner(true);
                }
              }}
              className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>📷 Mở Camera Chấm bài</span>
            </button>
          </div>
        </div>

        {/* 2. THANH LỌC BÀI THI */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: "all", label: "Tất cả" },
                { key: "homework", label: "BTVN" },
                { key: "test", label: "Đề KT" },
                { key: "practice", label: "Luyện đề" }
              ].map((item) => {
                const active = sourceFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSourceFilter(item.key as any);
                      setSelectedQuizId("all");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      active
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Tháng:</span>
              <select
                value={monthFilter}
                onChange={(e) => {
                  setMonthFilter(e.target.value);
                  setSelectedQuizId("all");
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="all">Tất cả tháng</option>
                {[8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7].map((m) => (
                  <option key={m} value={String(m)}>
                    Tháng {m < 10 ? "0" + m : m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            {sourceFilter !== "practice" && (
              <>
                <div className="md:col-span-3">
                  <select
                    value={selectedChapterId}
                    onChange={(e) => {
                      setSelectedChapterId(e.target.value);
                      setSelectedLessonId("all");
                      setSelectedQuizId("all");
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="all">Tất cả Chương học</option>
                    {(chapters || []).map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <select
                    value={selectedLessonId}
                    onChange={(e) => {
                      setSelectedLessonId(e.target.value);
                      setSelectedQuizId("all");
                    }}
                    disabled={selectedChapterId === "all"}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 outline-none focus:border-blue-600 disabled:opacity-50 cursor-pointer"
                  >
                    <option value="all">Tất cả Bài học</option>
                    {lessonsInSelectedChapter.map((l: any) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className={sourceFilter === "practice" ? "md:col-span-12" : "md:col-span-6"}>
              <select
                value={activeSelectedQuiz?.id || "all"}
                onChange={(e) => setSelectedQuizId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 outline-none focus:border-blue-600 cursor-pointer"
              >
                {filteredQuizzes.length === 0 ? (
                  <option value="all">Không có bài thi nào trong bộ lọc này</option>
                ) : (
                  filteredQuizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      [{q.sourceLabel} • Mã đề {q.examCode}] {q.title} ({q.totalQuestions} câu)
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BẢNG DANH SÁCH BÀI THI GIẤY ĐÃ CHẤM */}
      <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h3 className="font-bold text-slate-800 text-sm">
              Danh sách Bài thi trên Giấy đã chấm ({paperSubmissionsList.length} bài)
            </h3>
            <button
              type="button"
              disabled={isSyncingFromSupabase}
              onClick={() => fetchPaperSubmissions(true)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-blue-600 ${
                  isSyncingFromSupabase ? "animate-spin" : ""
                }`}
              />
              <span>🔄 Đồng bộ</span>
            </button>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm học sinh, SBD, tên đề..."
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-blue-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 text-center w-12">STT</th>
                <th className="py-3 px-4">Học sinh</th>
                <th className="py-3 px-3 text-center">SBD Cố định</th>
                <th className="py-3 px-4">Tên bài thi & Nguồn</th>
                <th className="py-3 px-3 text-center">Mã đề</th>
                <th className="py-3 px-3 text-center">Câu đúng</th>
                <th className="py-3 px-3 text-center">Điểm số</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paperSubmissionsList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Chưa có bài làm trên giấy nào. Hãy bấm <strong>"📷 Mở Camera Chấm bài"</strong> hoặc <strong>"🔄 Đồng bộ"</strong>.
                  </td>
                </tr>
              ) : (
                paperSubmissionsList.map((item, idx) => {
                  const hasWarning = item.flaggedList && item.flaggedList.length > 0;
                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 text-center font-semibold text-slate-400">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        <div>{item.studentDisplayName}</div>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {item.dateFormatted}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-mono font-bold text-[11px] border border-blue-200">
                          {item.detectedSbd}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{item.examDisplayTitle}</div>
                        <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                          {item.sourceLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {item.detectedCode}
                      </td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-700">
                        {item.correctVal}/{item.totalQVal || "--"}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold text-xs">
                          {item.scoreVal.toFixed(2)}đ
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {hasWarning ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold"
                            title={`Câu nghi ngờ: ${item.flaggedList.join(", ")}`}
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Kiểm tra ({item.flaggedList.length})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Hợp lệ
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setZoomScale(1);
                              setEditScoreInput(item.scoreVal.toFixed(2));
                              setInspectingAttempt(item);
                            }}
                            className="px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>Xem & Sửa</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePaperAttempt(item)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Xóa bài nộp này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* MODAL 1: XEM TRƯỚC & IN PHIẾU TRẢ LỜI A4 */}
      {showSheetPreviewModal && activeSelectedQuiz && (
        <div
          onClick={() => setShowSheetPreviewModal(false)}
          className="fixed inset-0 z-[500] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[94vh] border border-slate-200 shadow-2xl flex flex-col overflow-hidden cursor-default"
          >
            <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-white">
                  {activeSelectedQuiz.title} — Mã đề: {activeSelectedQuiz.examCode} ({activeSelectedQuiz.totalQuestions} câu)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openPrintableDynamicAnswerSheet({
                      ...activeSelectedQuiz.rawQuizObj,
                      examTitle: activeSelectedQuiz.title,
                      examCode: activeSelectedQuiz.examCode
                    })
                  }
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> In / Lưu PDF A4
                </button>
                <button
                  type="button"
                  onClick={() => setShowSheetPreviewModal(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100 space-y-6 custom-scrollbar flex flex-col items-center">
              {previewSvgPages.map((svgMarkup, idx) => (
                <div
                  key={idx}
                  className="w-full max-w-[760px] bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden"
                >
                  <div className="px-4 py-1.5 bg-slate-800 text-slate-200 text-[11px] font-semibold flex justify-between">
                    <span>Trang {idx + 1} / {previewSvgPages.length}</span>
                    <span>Khổ chuẩn A4</span>
                  </div>
                  <div
                    className="w-full"
                    dangerouslySetInnerHTML={{ __html: svgMarkup }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: BẢNG SBD CỐ ĐỊNH VĨNH VIỄN, THÊM/XÓA HS & ĐIỂM DANH HỌC BÙ / BỔ TRỢ */}
      {showSbdDirectoryModal && (
        <div
          onClick={() => setShowSbdDirectoryModal(false)}
          className="fixed inset-0 z-[500] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] border border-slate-200 shadow-2xl flex flex-col overflow-hidden cursor-default"
          >
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-white space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Bảng SBD Học Viên Cố Định & Quản Lý Học Bù ({filteredSbdDirectoryForModal.length} bạn)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    SBD gắn cố định vĩnh viễn theo từng học viên (MAX + 1). Xóa học viên ở giữa không làm thay đổi SBD của các bạn còn lại.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrintSbdDirectory}
                    className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> In bảng SBD
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSbdDirectoryModal(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Thanh thêm nhanh học sinh mới với SBD = MAX(sbd) + 1 */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <UserPlus className="w-3.5 h-3.5 text-blue-600" /> Thêm HS mới (Cấp SBD tự động MAX+1):
                </span>
                <input
                  type="text"
                  value={newStuNameInput}
                  onChange={(e) => setNewStuNameInput(e.target.value)}
                  placeholder="Họ và tên học sinh..."
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold outline-none focus:border-blue-600 min-w-[180px]"
                />
                <input
                  type="text"
                  value={newStuSchoolInput}
                  onChange={(e) => setNewStuSchoolInput(e.target.value)}
                  placeholder="Trường THPT..."
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium outline-none focus:border-blue-600 min-w-[150px]"
                />
                <select
                  value={newStuModeInput}
                  onChange={(e) => setNewStuModeInput(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="offline">Offline</option>
                  <option value="online">Online</option>
                </select>
                <button
                  type="button"
                  onClick={async () => {
                    const created = await addStudent(
                      newStuNameInput,
                      newStuSchoolInput,
                      newStuModeInput
                    );
                    if (created) {
                      setNewStuNameInput("");
                      setNewStuSchoolInput("");
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  + Cấp SBD Mới
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                  {[
                    { key: "all", label: `Tất cả (${sbdDirectoryList.length})` },
                    {
                      key: "offline",
                      label: `Offline (${sbdDirectoryList.filter((x) => x.modeKey === "offline").length})`
                    },
                    {
                      key: "online",
                      label: `Online (${sbdDirectoryList.filter((x) => x.modeKey === "online").length})`
                    }
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSbdModalModeFilter(tab.key as any)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                        sbdModalModeFilter === tab.key
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
                    value={sbdModalSelectedQuizId}
                    onChange={(e) => setSbdModalSelectedQuizId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="none">-- Chọn bài thi để hiện cột Điểm --</option>
                    {allUnifiedQuizzes.map((q) => (
                      <option key={q.id} value={q.id}>
                        [{q.sourceLabel}] {q.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
              {/* Khung xếp lịch Học bù / Bổ trợ đa ca khi bấm vào học sinh vắng */}
              {activeSchedulingStudent && (
                <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-amber-800 block">
                        ĐANG XẾP LỊCH HỌC BÙ / BỔ TRỢ TĂNG CƯỜNG
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">
                        Học sinh: {activeSchedulingStudent.full_name} (SBD:{" "}
                        {activeSchedulingStudent.sbd})
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveMakeupScheduleStudentId(null)}
                      className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      Đóng bảng xếp lịch
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Thứ / Ngày học bù - bổ trợ:
                      </label>
                      <input
                        type="text"
                        value={scheduleDateInput}
                        onChange={(e) => setScheduleDateInput(e.target.value)}
                        placeholder="VD: Thứ 5 (05/11)"
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-semibold text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Phân loại mục đích:
                      </label>
                      <select
                        value={scheduleTypeInput}
                        onChange={(e) =>
                          setScheduleTypeInput(e.target.value as "makeup" | "support")
                        }
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-bold text-slate-800 outline-none cursor-pointer"
                      >
                        <option value="makeup">🟠 Học bù bài vắng</option>
                        <option value="support">🔵 Bổ trợ tăng cường / Online đêm</option>
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-slate-700 block mb-1">
                        Ghi chú thêm (nếu có):
                      </label>
                      <input
                        type="text"
                        value={scheduleNoteInput}
                        onChange={(e) => setScheduleNoteInput(e.target.value)}
                        placeholder="VD: Ôn kỹ phần Nguyên hàm..."
                        className="w-full px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-medium text-slate-800 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-slate-700 block mb-1.5">
                      Tích chọn 1 hoặc nhiều ca học (có thể chọn 2–3 ca liên tiếp):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {SUPPORT_SHIFT_OPTIONS.map((shiftOpt) => {
                        const isPicked = activeSchedulingStudent.makeupSessions.some(
                          (m) =>
                            m.date === (scheduleDateInput.trim() || "Chưa chọn ngày") &&
                            m.shift === shiftOpt.label
                        );
                        return (
                          <button
                            key={shiftOpt.id}
                            type="button"
                            onClick={() =>
                              toggleMakeupShift(
                                activeSchedulingStudent.id,
                                scheduleDateInput,
                                shiftOpt.label,
                                scheduleTypeInput,
                                scheduleNoteInput
                              )
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                              isPicked
                                ? scheduleTypeInput === "makeup"
                                  ? "bg-orange-600 text-white border-orange-700"
                                  : "bg-blue-600 text-white border-blue-700"
                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                            }`}
                          >
                            {isPicked ? "☑ " : "☐ "}
                            {shiftOpt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">STT</th>
                    <th className="py-2.5 px-3 text-center w-28">SBD Cố Định</th>
                    <th className="py-2.5 px-3">Họ và tên học sinh</th>
                    <th className="py-2.5 px-3">Điểm danh & Học bù</th>
                    <th className="py-2.5 px-3 text-center w-28">
                      {sbdModalSelectedQuizObj ? "Điểm thi" : "Phân hệ"}
                    </th>
                    <th className="py-2.5 px-3 text-center w-16">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSbdDirectoryForModal.map((stu) => (
                    <tr key={stu.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-400">
                        {stu.displayOrder}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono font-bold text-xs">
                          {stu.sbd}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{stu.full_name}</div>
                        <div className="text-[10px] text-slate-400">{stu.school}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <select
                            value={stu.attendanceStatus}
                            onChange={(e) =>
                              updateAttendance(stu.id, e.target.value as AttendanceStatusType)
                            }
                            className={`px-2 py-1 rounded-md text-[11px] font-bold border outline-none cursor-pointer ${
                              stu.attendanceStatus === "present"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : stu.attendanceStatus === "makeup_done"
                                ? "bg-blue-50 text-blue-800 border-blue-200"
                                : "bg-rose-50 text-rose-800 border-rose-200"
                            }`}
                          >
                            <option value="present">✓ Có mặt đúng giờ</option>
                            <option value="makeup_done">✓ Nghỉ (Đã học bù)</option>
                            <option value="absent_need_makeup">⚠️ Nghỉ (Chưa bù)</option>
                          </select>

                          <button
                            type="button"
                            onClick={() =>
                              setActiveMakeupScheduleStudentId(
                                activeMakeupScheduleStudentId === stu.id ? null : stu.id
                              )
                            }
                            className="px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Calendar className="w-3 h-3" />
                            <span>
                              {stu.makeupSessions.length > 0
                                ? `Lịch bù (${stu.makeupSessions.length} ca)`
                                : "+ Xếp lịch"}
                            </span>
                          </button>
                        </div>

                        {stu.makeupSessions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {stu.makeupSessions.map((m, mIdx) => (
                              <span
                                key={mIdx}
                                className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${
                                  m.type === "makeup"
                                    ? "bg-orange-50 text-orange-800 border-orange-200"
                                    : "bg-blue-50 text-blue-800 border-blue-200"
                                }`}
                              >
                                {m.date}: {m.shift}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {sbdModalSelectedQuizObj ? (
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
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => deleteStudent(stu.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                          title="Xóa học viên (Không làm đổi SBD của các bạn còn lại)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* MODAL 3: CHẤM BÀI THI GIẤY NỘI BỘ DỰ PHÒNG */}
      {showInternalBulkScanner && (
        <div
          onClick={() => setShowInternalBulkScanner(false)}
          className="fixed inset-0 z-[500] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-xl w-full p-6 border border-slate-200 shadow-2xl space-y-4 cursor-default"
          >
            <input
              ref={batchFileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={handleBatchFilesUpload}
            />

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                Chấm phiếu bài: {activeSelectedQuiz?.title || "Chưa chọn bài"}
              </h3>
              <button
                type="button"
                onClick={() => setShowInternalBulkScanner(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              onClick={() => !isBatchProcessing && batchFileInputRef.current?.click()}
              className="p-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 transition text-center space-y-2 cursor-pointer"
            >
              {isBatchProcessing ? (
                <div className="space-y-2 py-4">
                  <Loader2 className="w-7 h-7 animate-spin text-blue-600 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">{batchProgressText}</p>
                </div>
              ) : (
                <>
                  <Camera className="w-8 h-8 text-slate-500 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800">
                    Bấm để mở Camera hoặc chọn ảnh phiếu trả lời
                  </h4>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: XEM PHIẾU ĐÃ CHẤM & SỬA ĐIỂM */}
      {inspectingAttempt && (
        <div
          onClick={() => setInspectingAttempt(null)}
          className="fixed inset-0 z-[550] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[94vh] border border-slate-700 shadow-2xl flex flex-col overflow-hidden cursor-default"
          >
            <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white">
              <div>
                <span className="text-xs text-slate-400 font-medium block">
                  SBD: {inspectingAttempt.detectedSbd} • Mã đề: {inspectingAttempt.detectedCode}
                </span>
                <h4 className="text-sm font-bold text-white mt-0.5">
                  {inspectingAttempt.studentDisplayName} — {inspectingAttempt.examDisplayTitle}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                  <span className="text-xs font-medium text-slate-300">Điểm:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={editScoreInput}
                    onChange={(e) => setEditScoreInput(e.target.value)}
                    className="w-14 bg-slate-950 text-white font-bold text-xs text-center py-1 rounded border border-slate-600 outline-none focus:border-blue-400"
                  />
                  <button
                    type="button"
                    disabled={isSavingScore}
                    onClick={handleSaveInspectScore}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Lưu
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.max(0.8, Number((z - 0.25).toFixed(2))))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.min(2.2, Number((z + 0.25).toFixed(2))))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingAttempt(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5 custom-scrollbar flex items-start justify-center bg-slate-900">
              {inspectingAttempt.paperScanUrl ? (
                <div
                  style={{
                    width: `${Math.round(560 * zoomScale)}px`,
                    aspectRatio: `${OMR_CANONICAL_WIDTH} / ${OMR_CANONICAL_HEIGHT}`,
                    transition: "width 0.18s ease-out"
                  }}
                  className="relative rounded-lg overflow-hidden border border-slate-700 bg-white shadow-2xl shrink-0"
                >
                  <img
                    src={inspectingAttempt.paperScanUrl}
                    alt="Phiếu thi gốc của học sinh"
                    className="w-full h-full object-fill block"
                  />
                  {inspectingAttempt.omr_raw_data?.bubble_coordinates && (
                    <svg
                      viewBox={`0 0 ${
                        inspectingAttempt.omr_raw_data.canonical_width || OMR_CANONICAL_WIDTH
                      } ${
                        inspectingAttempt.omr_raw_data.canonical_height || OMR_CANONICAL_HEIGHT
                      }`}
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    >
                      {inspectingAttempt.omr_raw_data.bubble_coordinates
                        .filter((b: any) => b.status !== "unfilled")
                        .map((b: any) => {
                          const strokeColor =
                            b.status === "correct"
                              ? "#10B981"
                              : b.status === "wrong"
                              ? "#EF4444"
                              : b.status === "expected_missed"
                              ? "#3B82F6"
                              : "#F59E0B";

                          return (
                            <circle
                              key={b.id}
                              cx={b.x}
                              cy={b.y}
                              r={b.r + 2.5}
                              fill={
                                b.status === "correct"
                                  ? "rgba(16,185,129,0.22)"
                                  : b.status === "wrong"
                                  ? "rgba(239,68,68,0.22)"
                                  : "none"
                              }
                              stroke={strokeColor}
                              strokeWidth={2}
                              strokeDasharray={
                                b.status === "expected_missed" ? "4 2" : undefined
                              }
                            />
                          );
                        })}
                    </svg>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Không tìm thấy ảnh quét của lượt nộp này.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
