"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  User,
  Award,
  Copy,
  Printer,
  Sparkles,
  PlusCircle,
  UserCheck,
  Check,
  Eye,
  X,
  Plus,
  Trash2,
  BookOpen,
  Download,
  ImageIcon,
  Search,
  ChevronRight,
  ShieldCheck,
  Filter,
  CheckSquare,
  Square,
  FileText,
  Layers,
  ZoomIn,
  ZoomOut,
  Calendar,
  FileSpreadsheet,
  Edit3,
  AlertTriangle
} from "lucide-react";
import {
  OMR_CANONICAL_WIDTH,
  OMR_CANONICAL_HEIGHT,
  formatStudentAutoSBD,
  deriveExamCode3Digits,
  gradeOMRSubmission
} from "@/lib/omrEngine";
import {
  DailyReportConfig,
  StudentDailyScoreData,
  WrongQuestionReviewItem
} from "@/types/report";
import {
  generateClassDailyReportHTML,
  openPrintOrDownloadClassReport
} from "@/lib/reportPdfGenerator";

interface Props {
  registeredStudents: any[];
  allAttempts: any[];
  chapters?: any[];
  practiceExams?: any[];
  attendanceRecords?: any[];
}

interface SelectedPracticeExamItem {
  id: string;
  title: string;
  category: string;
  completedDate: string;
  score: number | string;
  durationText?: string;
  assignedMonth?: number;
  submissionType?: "web" | "paper";
  paperScanUrl?: string | null;
  omrRawData?: any | null;
}

function normalizeText(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor?: string,
  strokeColor?: string,
  lineWidth: number = 1
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function parseEvaluationBullets(rawEval: string): { title: string; body: string }[] {
  if (!rawEval || !rawEval.trim()) {
    return [{ title: "Nhận xét chung", body: "Chưa có nhận xét chi tiết cho kỳ báo cáo này." }];
  }
  const paragraphs = rawEval
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs.map((p) => {
    const cleaned = p.replace(/^[-•+*]\s*/, "").trim();
    const colonIdx = cleaned.indexOf(":");
    if (colonIdx > 0 && colonIdx < 45) {
      return {
        title: cleaned.slice(0, colonIdx).trim(),
        body: cleaned.slice(colonIdx + 1).trim(),
      };
    }
    return {
      title: "",
      body: cleaned,
    };
  });
}

function formatCategoryWithSubmissionMode(
  category?: string,
  submissionType?: "web" | "paper"
): string {
  const baseCat = (category || "Luyện đề").trim();
  if (/trên\s*giấy|trực\s*tuyến/i.test(baseCat)) {
    return baseCat;
  }
  return submissionType === "paper"
    ? `${baseCat} (Trên giấy)`
    : `${baseCat} (Trực tuyến)`;
}

export default function AdminStudentReportPanel({
  registeredStudents = [],
  allAttempts = [],
  chapters = [],
  practiceExams = [],
  attendanceRecords = []
}: Props) {
  const currentRealtimeMonth = useMemo(() => new Date().getMonth() + 1, []);
  const todayFormatted = useMemo(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}/${d.getFullYear()}`;
  }, []);

  // CHẾ ĐỘ BÁO CÁO: 'daily' (Báo cáo theo Ngày/Buổi học) | 'monthly' (Tổng kết Tháng) | 'manual' (Tự tạo HS mới)
  const [reportViewType, setReportViewType] = useState<"daily" | "monthly" | "manual">("daily");
  const reportMode = reportViewType === "manual" ? "manual" : "auto";

  // STATE DÀNH RIÊNG CHO CHẾ ĐỘ BÁO CÁO NGÀY / BUỔI HỌC
  const [dailyMonth, setDailyMonth] = useState<number>(currentRealtimeMonth);
  const [dailyWeek, setDailyWeek] = useState<number>(3);
  const [customDateStr, setCustomDateStr] = useState<string>(todayFormatted);
  const [overrideTopicTitle, setOverrideTopicTitle] = useState<string>("");
  const [selectedDailyPracticeId, setSelectedDailyPracticeId] = useState<string>("auto");
  const [dailyStudentFilterMode, setDailyStudentFilterMode] = useState<
    "all" | "offline" | "online"
  >("all");
  const [includeCoverSummaryPage, setIncludeCoverSummaryPage] = useState<boolean>(true);

  // Ghi nhận chỉnh sửa thủ công điểm số / nhận xét / chuyên cần ngày của từng học viên
  const [dailyStudentOverrides, setDailyStudentOverrides] = useState<
    Record<
      string,
      {
        homeworkScore?: string;
        dailyTestScore?: string;
        practiceScore?: string;
        teacherComment?: string;
        attendance?: "present" | "late" | "absent";
        homeworkStatus?: "completed" | "missing" | "late";
      }
    >
  >({});

  const [showOfficialModal, setShowOfficialModal] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [renderedImageUrls, setRenderedImageUrls] = useState<{
    page1: string | null;
    page2: string | null;
  }>({
    page1: null,
    page2: null,
  });

  const [showPracticePickerModal, setShowPracticePickerModal] = useState<boolean>(false);
  const [practiceMonthFilter, setPracticeMonthFilter] = useState<string>("all");
  const [previewPaperItem, setPreviewPaperItem] = useState<SelectedPracticeExamItem | null>(null);
  const [paperZoom, setPaperZoom] = useState<number>(1);

  const reportPage1Ref = useRef<HTMLDivElement>(null);
  const reportPage2Ref = useRef<HTMLDivElement>(null);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    registeredStudents[0]?.id || ""
  );
  const [searchStudent, setSearchStudent] = useState<string>("");
  const [reportMonth, setReportMonth] = useState<number>(currentRealtimeMonth);
  const [autoTeacherEvaluation, setAutoTeacherEvaluation] = useState<string>(
    "- Chuyên cần & Thái độ: Con đi học đầy đủ và luôn đúng giờ. Trong giờ học, con ngoan, tập trung và có tinh thần tự giác tốt.\n\n" +
      "- Khả năng tiếp thu: Con nắm được các dạng toán cơ bản và hiểu bài ổn định. Tuy nhiên, ở một số dạng bài mới hoặc nâng cao, con vẫn còn phản xạ hơi chậm.\n\n" +
      "- Nội quy lớp học: Em đã tiến hành thu điện thoại của con trong giờ học và đề nghị con nghiêm túc chấp hành nội quy này.\n\n" +
      "- Kết quả kiểm tra: Con đã có nhiều tiến bộ, cần lưu ý cẩn thận hơn ở khâu biến đổi tính toán và trình bày để tránh mất điểm đáng tiếc.\n\n" +
      "- Định hướng giai đoạn tới: Gia đình cùng nhắc nhở con duy trì làm bài tập về nhà và luyện đề bấm giờ đều đặn. Thầy luôn sẵn sàng hỗ trợ giải đáp bất cứ khi nào con gặp khó khăn."
  );

  const [selectedPracticeExams, setSelectedPracticeExams] = useState<SelectedPracticeExamItem[]>(
    []
  );

  const [manualForm, setManualForm] = useState({
    fullName: "Trương Ngọc Dũng",
    school: "THPT Lê Quý Đôn",
    grade: "Lớp 12",
    reportMonth: currentRealtimeMonth,
    evaluation:
      "- Chuyên cần & Thái độ: Con đi học đầy đủ và luôn đúng giờ. Trong giờ học, con ngoan, tập trung và có tinh thần tự giác tốt.\n\n" +
      "- Khả năng tiếp thu: Con nắm được các dạng toán cơ bản và hiểu bài ổn định. Tuy nhiên, ở một số dạng bài mới hoặc nâng cao, con vẫn còn phản xạ hơi chậm.\n\n" +
      "- Nội quy lớp học: Em đã tiến hành thu điện thoại của con trong giờ học và đề nghị con nghiêm túc chấp hành nội quy này.\n\n" +
      "- Kết quả kiểm tra: Con đã có nhiều tiến bộ, cần lưu ý cẩn thận hơn ở khâu biến đổi tính toán và trình bày để tránh mất điểm đáng tiếc.\n\n" +
      "- Định hướng giai đoạn tới: Gia đình cùng nhắc nhở con duy trì làm bài tập về nhà và luyện đề bấm giờ đều đặn. Thầy luôn sẵn sàng hỗ trợ giải đáp bất cứ khi nào con gặp khó khăn."
  });

  const [manualHWScores, setManualHWScores] = useState<{ [key: number]: string }>({
    1: "8.5",
    2: "9.0",
    3: "8.0",
    4: "",
    5: ""
  });

  const [manualTestScores, setManualTestScores] = useState<{ [key: number]: string }>({
    1: "7.5",
    2: "8.0",
    3: "",
    4: "",
    5: ""
  });

  // 1. DANH MỤC SBD CỐ ĐỊNH CỦA CẢ LỚP (ĐẢM BẢO ĐỒNG BỘ 100% VỚI BẢNG SBD LỚP)
  const sbdDirectoryMap = useMemo(() => {
    const sorted = [...(registeredStudents || [])].filter(Boolean);
    sorted.sort((a, b) =>
      String(a.full_name || a.name || "").localeCompare(
        String(b.full_name || b.name || ""),
        "vi"
      )
    );
    const map = new Map<string, { sbd: string; stt: number; mode: "Online" | "Offline" }>();
    sorted.forEach((stu, idx) => {
      const id = String(stu.id || "").trim();
      const rawMode = String(stu.learning_mode || stu.study_mode || "offline").toLowerCase();
      map.set(id, {
        stt: idx + 1,
        sbd: stu.sbd ? String(stu.sbd).padStart(6, "0").slice(-6) : formatStudentAutoSBD(idx + 1),
        mode: rawMode.includes("on") ? "Online" : "Offline"
      });
    });
    return map;
  }, [registeredStudents]);

  // 2. TỰ ĐỘNG ĐỒNG BỘ TÊN BÀI HỌC & DANH SÁCH BÀI TẬP / KIỂM TRA TỪ `#lessons` THEO TUẦN & THÁNG
  const matchedLessonsForDaily = useMemo(() => {
    const matched: {
      lessonId: string;
      lessonTitle: string;
      chapterTitle: string;
      hwIds: Set<string>;
      hwTitles: Set<string>;
      testIds: Set<string>;
      testTitles: Set<string>;
      rawQuizzesMap: Map<string, any>;
    }[] = [];

    (chapters || []).forEach((chap: any) => {
      const cMonth = chap?.assigned_month ? Number(chap.assigned_month) : undefined;
      const cWeek = chap?.assigned_week ? Number(chap.assigned_week) : undefined;

      (chap?.lessons || []).forEach((les: any) => {
        if (!les) return;
        const lMonth = Number(les.assigned_month || cMonth || 10);
        const lWeek = Number(les.assigned_week || cWeek || 1);

        if (lMonth === dailyMonth && lWeek === dailyWeek) {
          const hwIds = new Set<string>();
          const hwTitles = new Set<string>();
          const testIds = new Set<string>();
          const testTitles = new Set<string>();
          const rawQuizzesMap = new Map<string, any>();

          (les.homework_files || []).forEach((hw: any) => {
            if (!hw) return;
            if (hw.id) {
              hwIds.add(String(hw.id).trim().toLowerCase());
              rawQuizzesMap.set(String(hw.id).trim().toLowerCase(), hw);
            }
            if (hw.title) {
              hwTitles.add(normalizeText(hw.title));
              rawQuizzesMap.set(normalizeText(hw.title), hw);
            }
          });

          (les.test_quizzes || []).forEach((tq: any) => {
            if (!tq) return;
            if (tq.id) {
              testIds.add(String(tq.id).trim().toLowerCase());
              rawQuizzesMap.set(String(tq.id).trim().toLowerCase(), tq);
            }
            if (tq.title) {
              testTitles.add(normalizeText(tq.title));
              rawQuizzesMap.set(normalizeText(tq.title), tq);
            }
          });

          matched.push({
            lessonId: String(les.id || ""),
            lessonTitle: String(les.title || "Bài học"),
            chapterTitle: String(chap?.title || ""),
            hwIds,
            hwTitles,
            testIds,
            testTitles,
            rawQuizzesMap
          });
        }
      });
    });

    return matched;
  }, [chapters, dailyMonth, dailyWeek]);

  // Tên chuyên đề tự động lấy từ #lessons khi chọn Tuần & Tháng
  const autoSyncedTopicTitle = useMemo(() => {
    if (matchedLessonsForDaily.length > 0) {
      return matchedLessonsForDaily.map((m) => m.lessonTitle).join(" • ");
    }
    // Fallback lấy bài học đầu tiên có trong chương trình nếu tuần đó chưa gắn nhãn
    for (const chap of chapters || []) {
      if (Array.isArray(chap?.lessons) && chap.lessons.length > 0) {
        return String(chap.lessons[0].title || "Chuyên đề Toán Tư Duy TCT");
      }
    }
    return `Chuyên đề Toán 12 — Tuần ${dailyWeek} Tháng ${dailyMonth}`;
  }, [matchedLessonsForDaily, chapters, dailyWeek, dailyMonth]);

  // Reset override khi đổi Tuần / Tháng để hiện đúng bài học mới đồng bộ
  useEffect(() => {
    setOverrideTopicTitle("");
  }, [dailyMonth, dailyWeek]);

  // Bản đồ tra cứu assigned_month và assigned_week chung
  const quizAssignmentMap = useMemo(() => {
    const byId = new Map<
      string,
      { month?: number; week?: number; isHw?: boolean; isTest?: boolean; category?: string; rawObj?: any }
    >();
    const byTitle = new Map<
      string,
      { month?: number; week?: number; isHw?: boolean; isTest?: boolean; category?: string; rawObj?: any }
    >();

    (chapters || []).forEach((chap: any) => {
      const chapMonth = chap?.assigned_month ? Number(chap.assigned_month) : undefined;
      const chapWeek = chap?.assigned_week ? Number(chap.assigned_week) : undefined;

      (chap?.lessons || []).forEach((les: any) => {
        const lesMonth = les?.assigned_month ? Number(les.assigned_month) : chapMonth;
        const lesWeek = les?.assigned_week ? Number(les.assigned_week) : chapWeek;

        (les?.homework_files || []).forEach((hw: any) => {
          if (!hw) return;
          const m = hw.assigned_month ? Number(hw.assigned_month) : lesMonth;
          const w = hw.assigned_week ? Number(hw.assigned_week) : lesWeek;
          const meta = { month: m, week: w, isHw: true, isTest: false, rawObj: hw };
          if (hw.id) byId.set(String(hw.id).trim().toLowerCase(), meta);
          if (hw.title) byTitle.set(normalizeText(hw.title), meta);
        });

        (les?.test_quizzes || []).forEach((tq: any) => {
          if (!tq) return;
          const m = tq.assigned_month ? Number(tq.assigned_month) : lesMonth;
          const w = tq.assigned_week ? Number(tq.assigned_week) : lesWeek;
          const meta = { month: m, week: w, isHw: false, isTest: true, rawObj: tq };
          if (tq.id) byId.set(String(tq.id).trim().toLowerCase(), meta);
          if (tq.title) byTitle.set(normalizeText(tq.title), meta);
        });
      });
    });

    (practiceExams || []).forEach((pe: any) => {
      if (!pe) return;
      const m = pe.assigned_month ? Number(pe.assigned_month) : undefined;
      const w = pe.assigned_week ? Number(pe.assigned_week) : undefined;
      const meta = {
        month: m,
        week: w,
        isHw: false,
        isTest: false,
        category: pe.category || "Luyện đề",
        rawObj: pe
      };
      if (pe.id) byId.set(String(pe.id).trim().toLowerCase(), meta);
      if (pe.title) byTitle.set(normalizeText(pe.title), meta);
    });

    return { byId, byTitle };
  }, [chapters, practiceExams]);

  const resolveAttemptMonthAndWeek = useCallback(
    (att: any): { month: number; week: number; category?: string; rawQuizObj?: any } => {
      const qId = String(att?.quizId || att?.quiz_id || att?.exam_id || "").trim().toLowerCase();
      const qTitle = normalizeText(
        att?.examTitle || att?.quizTitle || att?.quiz_title || att?.title || ""
      );

      const matchedMeta =
        (qId && quizAssignmentMap.byId.get(qId)) ||
        (qTitle && quizAssignmentMap.byTitle.get(qTitle)) ||
        null;

      const rawDate = att?.createdAt || att?.created_at || att?.submittedAt;
      const parsedDate = rawDate ? new Date(rawDate) : new Date();
      const validDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();

      const resolvedMonth =
        Number(att?.assigned_month) || Number(matchedMeta?.month) || validDate.getMonth() + 1;

      const dayOfMonth = validDate.getDate();
      const fallbackWeekFromDate = Math.min(5, Math.max(1, Math.ceil(dayOfMonth / 7)));

      const resolvedWeek =
        Number(att?.assigned_week) || Number(matchedMeta?.week) || fallbackWeekFromDate;

      return {
        month: resolvedMonth,
        week: Math.min(5, Math.max(1, resolvedWeek)),
        category: matchedMeta?.category || att?.category,
        rawQuizObj: matchedMeta?.rawObj
      };
    },
    [quizAssignmentMap]
  );

  // 3. TÍNH TOÁN DỮ LIỆU BÁO CÁO NGÀY (DAILY REPORT ENGINE) CHO TOÀN BỘ HỌC SINH TRONG LỚP
  const computeStudentDailyScoreRecord = useCallback(
    (student: any): StudentDailyScoreData => {
      const stuId = String(student?.id || "").trim();
      const stuName = String(student?.full_name || student?.name || "Học sinh").trim();
      const dirInfo = sbdDirectoryMap.get(stuId);
      const sbd = dirInfo?.sbd || formatStudentAutoSBD(1);
      const learningMode: "Online" | "Offline" = dirInfo?.mode || "Offline";

      const stuAttempts = (allAttempts || []).filter((att: any) => {
        if (!att) return false;
        const aStuId = String(att.studentId || att.student_id || att.user_id || "").trim();
        const aStuName = normalizeText(att.studentName || att.student_name || att.full_name || "");
        const aSbd = String(
          att.omr_raw_data?.detected_sbd ||
            att.answers?.__paper_omr_meta?.detected_sbd ||
            ""
        ).trim();
        return (
          (stuId && aStuId === stuId) ||
          (stuName && aStuName === normalizeText(stuName)) ||
          (sbd && aSbd === sbd)
        );
      });

      let bestHwAttempt: any = null;
      let bestDailyTestAttempt: any = null;
      let bestPracticeAttempt: any = null;

      stuAttempts.forEach((att: any) => {
        const qId = String(att.quizId || att.quiz_id || att.exam_id || "").trim().toLowerCase();
        const qTitle = normalizeText(
          att.examTitle || att.quizTitle || att.quiz_title || att.title || ""
        );
        const meta =
          (qId && quizAssignmentMap.byId.get(qId)) ||
          (qTitle && quizAssignmentMap.byTitle.get(qTitle));

        const { month, week } = resolveAttemptMonthAndWeek(att);
        const isHw = Boolean(
          meta?.isHw || att.type === "homework" || att.isHomework || att.is_homework
        );
        const isPaper =
          att.submission_type === "paper" ||
          Boolean(att.scanned_image_url) ||
          Boolean(att.paper_scan_url) ||
          Boolean(att.omr_raw_data) ||
          Boolean(att.answers?.__paper_omr_meta);

        const isTest = Boolean(meta?.isTest || att.type === "test" || (isPaper && !isHw));

        const belongsToMatchedLessonHw = matchedLessonsForDaily.some(
          (m) => (qId && m.hwIds.has(qId)) || (qTitle && m.hwTitles.has(qTitle))
        );
        const belongsToMatchedLessonTest = matchedLessonsForDaily.some(
          (m) => (qId && m.testIds.has(qId)) || (qTitle && m.testTitles.has(qTitle))
        );

        const sc = Number(att.score ?? att.points ?? 0);

        // 1. Khớp BTVN của Tuần/Tháng đang chọn
        if (isHw && (belongsToMatchedLessonHw || (month === dailyMonth && week === dailyWeek))) {
          if (!bestHwAttempt || sc >= Number(bestHwAttempt.score ?? bestHwAttempt.points ?? 0)) {
            bestHwAttempt = att;
          }
        }

        // 2. Khớp Bài Kiểm Tra tại lớp trong Ngày/Tuần đang chọn
        if (
          isTest &&
          (belongsToMatchedLessonTest || (month === dailyMonth && week === dailyWeek))
        ) {
          if (
            !bestDailyTestAttempt ||
            sc >= Number(bestDailyTestAttempt.score ?? bestDailyTestAttempt.points ?? 0)
          ) {
            bestDailyTestAttempt = att;
          }
        }

        // 3. Khớp Đề Luyện Thi Thực Chiến trong Tháng
        if (!isHw) {
          if (selectedDailyPracticeId !== "auto") {
            if (qId === selectedDailyPracticeId.toLowerCase()) {
              if (
                !bestPracticeAttempt ||
                sc >= Number(bestPracticeAttempt.score ?? bestPracticeAttempt.points ?? 0)
              ) {
                bestPracticeAttempt = att;
              }
            }
          } else if (month === dailyMonth) {
            if (
              !bestPracticeAttempt ||
              sc >= Number(bestPracticeAttempt.score ?? bestPracticeAttempt.points ?? 0)
            ) {
              bestPracticeAttempt = att;
            }
          }
        }
      });

      // Nếu trong tuần chưa có bài Test riêng mà học sinh có nộp 1 bài chấm giấy OMR trong tháng, ưu tiên lấy làm bài Test đối soát
      if (!bestDailyTestAttempt) {
        const anyPaperInMonth = stuAttempts.find((att: any) => {
          const { month } = resolveAttemptMonthAndWeek(att);
          const isPaper =
            att.submission_type === "paper" ||
            Boolean(att.scanned_image_url) ||
            Boolean(att.paper_scan_url) ||
            Boolean(att.omr_raw_data) ||
            Boolean(att.answers?.__paper_omr_meta);
          return isPaper && month === dailyMonth;
        });
        if (anyPaperInMonth) {
          bestDailyTestAttempt = anyPaperInMonth;
        }
      }

      const ov = dailyStudentOverrides[stuId] || {};

      const hwScore =
        ov.homeworkScore !== undefined && ov.homeworkScore !== ""
          ? Number(ov.homeworkScore)
          : bestHwAttempt
          ? Number(bestHwAttempt.score ?? bestHwAttempt.points ?? 0)
          : null;

      const testScore =
        ov.dailyTestScore !== undefined && ov.dailyTestScore !== ""
          ? Number(ov.dailyTestScore)
          : bestDailyTestAttempt
          ? Number(bestDailyTestAttempt.score ?? bestDailyTestAttempt.points ?? 0)
          : null;

      const pracScore =
        ov.practiceScore !== undefined && ov.practiceScore !== ""
          ? Number(ov.practiceScore)
          : bestPracticeAttempt
          ? Number(bestPracticeAttempt.score ?? bestPracticeAttempt.points ?? 0)
          : null;

      // Kiểm tra và trích xuất dữ liệu Phụ bản OMR (Nếu bài Test hoặc BTVN được chấm qua phiếu giấy OMR)
      const paperSourceAtt =
        (bestDailyTestAttempt &&
        (bestDailyTestAttempt.submission_type === "paper" ||
          bestDailyTestAttempt.scanned_image_url ||
          bestDailyTestAttempt.paper_scan_url ||
          bestDailyTestAttempt.omr_raw_data ||
          bestDailyTestAttempt.answers?.__paper_omr_meta)
          ? bestDailyTestAttempt
          : null) ||
        (bestPracticeAttempt &&
        (bestPracticeAttempt.submission_type === "paper" ||
          bestPracticeAttempt.scanned_image_url ||
          bestPracticeAttempt.paper_scan_url ||
          bestPracticeAttempt.omr_raw_data ||
          bestPracticeAttempt.answers?.__paper_omr_meta)
          ? bestPracticeAttempt
          : null);

      let hasPaperOMR = false;
      let scannedPaperImageUrl: string | undefined = undefined;
      let bubbleCoordinates: any[] = [];
      let wrongQuestionsList: WrongQuestionReviewItem[] = [];
      let part1ScoreStr: string | undefined = undefined;
      let part2ScoreStr: string | undefined = undefined;
      let part3ScoreStr: string | undefined = undefined;
      let paperExamTitle: string | undefined = undefined;
      let paperExamCode: string | undefined = undefined;

      if (paperSourceAtt) {
        const meta =
          paperSourceAtt.answers?.__paper_omr_meta ||
          paperSourceAtt.user_answers?.__paper_omr_meta ||
          {};
        scannedPaperImageUrl =
          paperSourceAtt.scanned_image_url ||
          paperSourceAtt.paper_scan_url ||
          meta.scanned_image_url ||
          paperSourceAtt.omr_raw_data?.warped_image_data_url ||
          undefined;

        if (scannedPaperImageUrl) {
          hasPaperOMR = true;
          bubbleCoordinates =
            paperSourceAtt.omr_raw_data?.bubble_coordinates ||
            meta.bubble_coordinates ||
            [];
          paperExamTitle =
            paperSourceAtt.exam_title ||
            paperSourceAtt.examTitle ||
            meta.exam_title ||
            autoSyncedTopicTitle;
          paperExamCode =
            paperSourceAtt.omr_raw_data?.detected_exam_code ||
            meta.detected_exam_code ||
            "101";

          // Chấm lại chi tiết từng câu với đề gốc (nếu tìm thấy đề gốc) để lấy danh sách câu sai & điểm Phần I, II, III
          const { rawQuizObj } = resolveAttemptMonthAndWeek(paperSourceAtt);
          if (rawQuizObj && paperSourceAtt.omr_raw_data) {
            try {
              const regraded = gradeOMRSubmission(paperSourceAtt.omr_raw_data, rawQuizObj);
              part1ScoreStr = `${regraded.part1Score.toFixed(2)} điểm`;
              part2ScoreStr = `${regraded.part2Score.toFixed(2)} điểm`;
              part3ScoreStr = `${regraded.part3Score.toFixed(2)} điểm`;
              bubbleCoordinates = regraded.updatedOmrData.bubble_coordinates || bubbleCoordinates;

              wrongQuestionsList = (regraded.questionDetails || [])
                .filter((qd) => qd.status !== "correct")
                .map((qd) => ({
                  questionNumber: qd.questionOrder,
                  part: `Phần ${qd.part === 1 ? "I" : qd.part === 2 ? "II" : "III"}`,
                  studentAnswer: qd.studentAnswerDisplay || "Bỏ trống",
                  correctAnswer: qd.correctAnswerDisplay || ""
                }));
            } catch {}
          }
        }
      }

      const defaultComment =
        testScore !== null && testScore >= 8
          ? `Em ${stuName} nắm vững kiến thức chuyên đề "${
              overrideTopicTitle || autoSyncedTopicTitle
            }", tốc độ phản xạ trắc nghiệm tốt (${testScore}đ). Cần tiếp tục duy trì phong độ và rèn thêm các câu vận dụng cao.`
          : testScore !== null
          ? `Em ${stuName} đã nắm được các dạng cơ bản của bài "${
              overrideTopicTitle || autoSyncedTopicTitle
            }" (đạt ${testScore}đ), tuy nhiên cần đọc kỹ đề và rà soát lại các câu sai trong bảng đối chiếu đính kèm để tránh mất điểm đáng tiếc.`
          : `Em ${stuName} tham gia học tập nghiêm túc chuyên đề "${
              overrideTopicTitle || autoSyncedTopicTitle
            }". Gia đình nhắc nhở con hoàn thành đầy đủ bài tập về nhà và ôn kỹ các công thức trọng tâm của buổi học.`;

      return {
        studentId: stuId,
        studentName: stuName,
        sbd,
        grade: student?.grade || "Lớp 12",
        school: student?.school || "THPT",
        learningMode,
        homeworkScore: hwScore,
        homeworkCorrect: bestHwAttempt
          ? Number(bestHwAttempt.correct_count ?? bestHwAttempt.correctCount ?? 0) || null
          : null,
        homeworkTotal: bestHwAttempt
          ? Number(bestHwAttempt.total_questions ?? bestHwAttempt.totalQuestions ?? 0) || null
          : null,
        dailyTestScore: testScore,
        dailyTestCorrect: bestDailyTestAttempt
          ? Number(
              bestDailyTestAttempt.correct_answers_count ??
                bestDailyTestAttempt.correct_count ??
                bestDailyTestAttempt.correctCount ??
                0
            ) || null
          : null,
        dailyTestTotal: bestDailyTestAttempt
          ? Number(
              bestDailyTestAttempt.total_questions ?? bestDailyTestAttempt.totalQuestions ?? 0
            ) || null
          : null,
        practiceScore: pracScore,
        practiceExamTitle:
          bestPracticeAttempt?.exam_title ||
          bestPracticeAttempt?.examTitle ||
          `Đề thực chiến Tháng ${dailyMonth}`,
        part1Score: part1ScoreStr,
        part2Score: part2ScoreStr,
        part3Score: part3ScoreStr,
        teacherComment: ov.teacherComment !== undefined ? ov.teacherComment : defaultComment,
        attendance: ov.attendance || "present",
        homeworkStatus:
          ov.homeworkStatus || (hwScore !== null ? "completed" : "missing"),
        hasPaperOMR,
        paperExamTitle,
        paperExamCode,
        scannedPaperImageUrl,
        canonicalWidth: OMR_CANONICAL_WIDTH,
        canonicalHeight: OMR_CANONICAL_HEIGHT,
        bubbleCoordinates,
        wrongQuestionsList
      };
    },
    [
      sbdDirectoryMap,
      allAttempts,
      quizAssignmentMap,
      resolveAttemptMonthAndWeek,
      matchedLessonsForDaily,
      dailyMonth,
      dailyWeek,
      selectedDailyPracticeId,
      dailyStudentOverrides,
      overrideTopicTitle,
      autoSyncedTopicTitle
    ]
  );

  // Danh sách học sinh lọc theo tìm kiếm & phân hệ
  const filteredStudents = useMemo(() => {
    return (registeredStudents || []).filter((s) => {
      const matchSearch =
        (s.full_name || "").toLowerCase().includes(searchStudent.toLowerCase()) ||
        (s.school || "").toLowerCase().includes(searchStudent.toLowerCase());
      if (!matchSearch) return false;

      if (reportViewType === "daily" && dailyStudentFilterMode !== "all") {
        const rawMode = String(s.learning_mode || s.study_mode || "offline").toLowerCase();
        const isOnline = rawMode.includes("on");
        if (dailyStudentFilterMode === "online" && !isOnline) return false;
        if (dailyStudentFilterMode === "offline" && isOnline) return false;
      }
      return true;
    });
  }, [registeredStudents, searchStudent, reportViewType, dailyStudentFilterMode]);

  const currentStudent = useMemo(() => {
    return (
      filteredStudents.find((s) => s.id === selectedStudentId) ||
      filteredStudents[0] ||
      registeredStudents[0] ||
      null
    );
  }, [filteredStudents, registeredStudents, selectedStudentId]);

  const currentStudentDailyData = useMemo(() => {
    if (!currentStudent) return null;
    return computeStudentDailyScoreRecord(currentStudent);
  }, [currentStudent, computeStudentDailyScoreRecord]);

  // HÀM XUẤT PDF MULTI-PAGE CHO CẢ LỚP (HOẶC 1 HỌC SINH ĐANG CHỌN)
  const handleExportClassDailyPDF = (onlyCurrentStudent: boolean = false) => {
    const targetStudents = onlyCurrentStudent
      ? currentStudent
        ? [currentStudent]
        : []
      : filteredStudents;

    if (targetStudents.length === 0) {
      alert("Không có học sinh nào trong danh sách để xuất báo cáo!");
      return;
    }

    const studentsScoreData = targetStudents.map((stu) =>
      computeStudentDailyScoreRecord(stu)
    );

    const config: DailyReportConfig = {
      reportMode: "daily",
      selectedMonth: dailyMonth,
      selectedWeek: dailyWeek,
      customDateStr: customDateStr.trim() || todayFormatted,
      topicTitle: autoSyncedTopicTitle,
      overrideTopicTitle: overrideTopicTitle.trim() || undefined,
      includeCoverSummaryPage: !onlyCurrentStudent && includeCoverSummaryPage
    };

    const htmlDoc = generateClassDailyReportHTML(config, studentsScoreData);
    openPrintOrDownloadClassReport(htmlDoc);
  };

  // SAO CHÉP NỘI DUNG BÁO CÁO NGÀY GỬI ZALO PHỤ HUYNH (BRANDING TCT 100%)
  const handleCopyDailyZalo = () => {
    if (!currentStudentDailyData) return;
    const d = currentStudentDailyData;
    const topic = (overrideTopicTitle && overrideTopicTitle.trim()) || autoSyncedTopicTitle;

    const msg =
      `[TRUNG TÂM TOÁN TÂM CHÍ TÀI - TCT]\n` +
      `📋 BÁO CÁO KẾT QUẢ BUỔI HỌC NGÀY ${customDateStr}\n` +
      `• Học sinh: ${d.studentName} (SBD: ${d.sbd})\n` +
      `• Trường: ${d.school} • Phân hệ: ${d.learningMode}\n` +
      `• Chuyên đề: ${topic}\n` +
      `------------------------------------\n` +
      `I. KẾT QUẢ ĐIỂM SỐ TRONG NGÀY:\n` +
      `1. Bài tập về nhà (BTVN): ${
        d.homeworkScore !== null ? `${d.homeworkScore}/10` : "Chưa nộp"
      }\n` +
      `2. Bài Kiểm tra tại lớp: ${
        d.dailyTestScore !== null ? `${d.dailyTestScore}/10` : "Chưa kiểm tra"
      }${d.hasPaperOMR ? " (Đã chấm phiếu OMR)" : ""}\n` +
      `3. Đề thực chiến tháng: ${
        d.practiceScore !== null ? `${d.practiceScore}/10` : "--"
      }\n` +
      `------------------------------------\n` +
      `II. NHẬN XÉT CỦA GIÁO VIÊN:\n` +
      `"${d.teacherComment}"\n\n` +
      `📞 Hotline TCT: 0972 26 16 16 • Đ/c: Số 10 Tạ Quang Bửu, Bách Khoa, Hà Nội.`;

    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(msg);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  // --- CÁC LOGIC DÀNH CHO BÁO CÁO THÁNG HIỆN CÓ ---
  const studentAllAttempts = useMemo(() => {
    if (!currentStudent) return [];
    return allAttempts.filter(
      (att) =>
        String(att.studentId || att.student_id || "").trim() ===
          String(currentStudent.id || "").trim() ||
        String(att.studentName || att.student_name || "")
          .trim()
          .toLowerCase() ===
          String(currentStudent.full_name || "")
            .trim()
            .toLowerCase()
    );
  }, [allAttempts, currentStudent]);

  const studentPracticeAttempts = useMemo(() => {
    return studentAllAttempts.filter((a) => {
      const qId = String(a?.quizId || a?.quiz_id || a?.exam_id || "").trim().toLowerCase();
      const qTitle = normalizeText(
        a?.examTitle || a?.quizTitle || a?.quiz_title || a?.title || ""
      );
      const meta =
        (qId && quizAssignmentMap.byId.get(qId)) ||
        (qTitle && quizAssignmentMap.byTitle.get(qTitle));

      if (meta?.isHw || meta?.isTest) return false;
      const isHw = a.type === "homework" || a.isHomework || a.is_homework;
      const isTest = a.type === "test";
      return !isHw && !isTest;
    });
  }, [studentAllAttempts, quizAssignmentMap]);

  useEffect(() => {
    if (reportMode !== "auto") return;
    if (studentPracticeAttempts.length > 0) {
      const inSelectedMonth = studentPracticeAttempts.filter((a) => {
        const { month } = resolveAttemptMonthAndWeek(a);
        return month === reportMonth;
      });

      const dedupByExamMap = new Map<string, any>();
      inSelectedMonth.forEach((a) => {
        const key = normalizeText(
          a.examTitle || a.quizTitle || a.quiz_title || a.title || a.quizId || a.id
        );
        const prev = dedupByExamMap.get(key);
        const curScore = Number(a.score ?? a.points ?? 0);
        const prevScore = prev ? Number(prev.score ?? prev.points ?? 0) : -1;
        if (!prev || curScore >= prevScore) {
          dedupByExamMap.set(key, a);
        }
      });

      const mapped: SelectedPracticeExamItem[] = Array.from(dedupByExamMap.values()).map(
        (a, idx) => {
          const d = new Date(a.createdAt || a.created_at || Date.now());
          const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(
            d.getMonth() + 1
          ).padStart(2, "0")}/${d.getFullYear()}`;
          const { month, category } = resolveAttemptMonthAndWeek(a);
          const isPaper =
            a?.submission_type === "paper" ||
            Boolean(a?.paper_scan_url) ||
            Boolean(a?.omr_raw_data);

          return {
            id: a.id || `prac-${idx}`,
            title:
              a.examTitle ||
              a.quizTitle ||
              a.quiz_title ||
              a.title ||
              "Đề luyện thi thực chiến",
            category: category || a.category || "Luyện đề",
            completedDate: dateStr,
            score: a.score ?? a.points ?? "0",
            durationText: a.timeSpent || a.time_spent || "",
            assignedMonth: month,
            submissionType: isPaper ? "paper" : "web",
            paperScanUrl:
              a.paper_scan_url || a.omr_raw_data?.warped_image_data_url || null,
            omrRawData: a.omr_raw_data || null,
          };
        }
      );

      setSelectedPracticeExams(mapped);
    } else {
      setSelectedPracticeExams([]);
    }
  }, [currentStudent?.id, reportMonth, studentPracticeAttempts, reportMode, resolveAttemptMonthAndWeek]);

  const autoData = useMemo(() => {
    const emptyWeeks: { [key: number]: string } = { 1: "", 2: "", 3: "", 4: "", 5: "" };
    if (!currentStudent) {
      return {
        totalHwTest: 0,
        hwAvg: "--",
        testAvg: "--",
        hwByWeek: { ...emptyWeeks },
        testByWeek: { ...emptyWeeks }
      };
    }

    const hwByWeekMax: { [key: number]: number | null } = {
      1: null,
      2: null,
      3: null,
      4: null,
      5: null
    };
    const testByWeekMax: { [key: number]: number | null } = {
      1: null,
      2: null,
      3: null,
      4: null,
      5: null
    };

    studentAllAttempts.forEach((att) => {
      const qId = String(att?.quizId || att?.quiz_id || att?.exam_id || "")
        .trim()
        .toLowerCase();
      const qTitle = normalizeText(
        att?.examTitle || att?.quizTitle || att?.quiz_title || att?.title || ""
      );
      const meta =
        (qId && quizAssignmentMap.byId.get(qId)) ||
        (qTitle && quizAssignmentMap.byTitle.get(qTitle));

      const isHw = Boolean(
        meta?.isHw || att.type === "homework" || att.isHomework || att.is_homework
      );
      const isTest = Boolean(meta?.isTest || att.type === "test");

      if (!isHw && !isTest) return;

      const { month, week } = resolveAttemptMonthAndWeek(att);
      if (month !== reportMonth) return;

      const sc = Number(att.score ?? att.points ?? 0);
      if (isNaN(sc)) return;

      if (isHw) {
        if (hwByWeekMax[week] === null || sc > hwByWeekMax[week]!) {
          hwByWeekMax[week] = sc;
        }
      } else if (isTest) {
        if (testByWeekMax[week] === null || sc > testByWeekMax[week]!) {
          testByWeekMax[week] = sc;
        }
      }
    });

    const hwByWeek: { [key: number]: string } = { 1: "", 2: "", 3: "", 4: "", 5: "" };
    const testByWeek: { [key: number]: string } = { 1: "", 2: "", 3: "", 4: "", 5: "" };

    [1, 2, 3, 4, 5].forEach((w) => {
      if (hwByWeekMax[w] !== null) {
        hwByWeek[w] = Number(hwByWeekMax[w]!.toFixed(2)).toString();
      }
      if (testByWeekMax[w] !== null) {
        testByWeek[w] = Number(testByWeekMax[w]!.toFixed(2)).toString();
      }
    });

    const validWeekHw = Object.values(hwByWeek).filter(Boolean).map(Number);
    const validWeekTest = Object.values(testByWeek).filter(Boolean).map(Number);

    const hwAvg =
      validWeekHw.length > 0
        ? (validWeekHw.reduce((a, b) => a + b, 0) / validWeekHw.length).toFixed(1)
        : "--";
    const testAvg =
      validWeekTest.length > 0
        ? (validWeekTest.reduce((a, b) => a + b, 0) / validWeekTest.length).toFixed(1)
        : "--";

    return {
      totalHwTest: validWeekHw.length + validWeekTest.length,
      hwAvg,
      testAvg,
      hwByWeek,
      testByWeek
    };
  }, [studentAllAttempts, currentStudent, reportMonth, quizAssignmentMap, resolveAttemptMonthAndWeek]);

  const practiceStats = useMemo(() => {
    const parseScore = (val: any) => Number(String(val ?? "").replace(",", ".").trim());
    const validScores = selectedPracticeExams
      .filter(
        (item) =>
          String(item.score ?? "").trim() !== "" && String(item.score ?? "").trim() !== "--"
      )
      .map((item) => parseScore(item.score))
      .filter((sc) => !isNaN(sc));

    const avg =
      validScores.length > 0
        ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)
        : "--";

    return {
      count: selectedPracticeExams.length,
      avg
    };
  }, [selectedPracticeExams]);

  const manualStats = useMemo(() => {
    const parseScore = (val: string) => Number(val.replace(",", ".").trim());
    const validHw = Object.values(manualHWScores)
      .filter((val) => val && val.trim() !== "" && !isNaN(parseScore(val)))
      .map(parseScore);
    const validTest = Object.values(manualTestScores)
      .filter((val) => val && val.trim() !== "" && !isNaN(parseScore(val)))
      .map(parseScore);

    const hwAvg =
      validHw.length > 0
        ? (validHw.reduce((a, b) => a + b, 0) / validHw.length).toFixed(1)
        : "--";
    const testAvg =
      validTest.length > 0
        ? (validTest.reduce((a, b) => a + b, 0) / validTest.length).toFixed(1)
        : "--";

    return {
      totalHwTest: validHw.length + validTest.length,
      hwAvg,
      testAvg
    };
  }, [manualHWScores, manualTestScores]);

  const currentReport = useMemo(() => {
    if (reportMode === "auto") {
      const month = reportMonth;
      const totalOverall = autoData.totalHwTest + practiceStats.count;
      return {
        fullName: currentStudent?.full_name || "Chưa nhập họ tên",
        school: currentStudent?.school || "THPT",
        grade: currentStudent?.grade || "Lớp 12",
        month,
        timeframeText: "Tháng " + (month < 10 ? "0" + month : month) + "/2026",
        total: totalOverall,
        hwAvg: autoData.hwAvg,
        testAvg: autoData.testAvg,
        practiceAvg: practiceStats.avg,
        evaluation: autoTeacherEvaluation,
        hwScores: autoData.hwByWeek,
        testScores: autoData.testByWeek,
        practiceItems: selectedPracticeExams
      };
    } else {
      const month = manualForm.reportMonth;
      const totalOverall = manualStats.totalHwTest + practiceStats.count;
      return {
        fullName: manualForm.fullName.trim() || "Chưa nhập họ tên",
        school: manualForm.school.trim() || "THPT",
        grade: manualForm.grade,
        month,
        timeframeText: "Tháng " + (month < 10 ? "0" + month : month) + "/2026",
        total: totalOverall,
        hwAvg: manualStats.hwAvg,
        testAvg: manualStats.testAvg,
        practiceAvg: practiceStats.avg,
        evaluation: manualForm.evaluation,
        hwScores: manualHWScores,
        testScores: manualTestScores,
        practiceItems: selectedPracticeExams
      };
    }
  }, [
    reportMode,
    currentStudent,
    reportMonth,
    autoData,
    practiceStats,
    autoTeacherEvaluation,
    manualForm,
    manualStats,
    manualHWScores,
    manualTestScores,
    selectedPracticeExams
  ]);

  const parsedEvalBullets = useMemo(
    () => parseEvaluationBullets(currentReport.evaluation),
    [currentReport.evaluation]
  );

  const hasWeek5Data = useMemo(() => {
    return Boolean(currentReport.hwScores[5] || currentReport.testScores[5]);
  }, [currentReport.hwScores, currentReport.testScores]);

  const needsSecondPage = useMemo(() => {
    const evalLines = (currentReport.evaluation || "").split("\n").length;
    return (
      currentReport.practiceItems.length > 4 ||
      evalLines > 8 ||
      (currentReport.evaluation || "").length > 450
    );
  }, [currentReport.practiceItems.length, currentReport.evaluation]);

  const handleToggleSelectPracticeExam = (attOrExam: any) => {
    const targetId = String(attOrExam.id);
    const existing = selectedPracticeExams.find((item) => item.id === targetId);
    if (existing) {
      setSelectedPracticeExams((prev) => prev.filter((item) => item.id !== targetId));
    } else {
      const rawDate = attOrExam.createdAt || attOrExam.created_at || Date.now();
      const d = new Date(rawDate);
      const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1
      ).padStart(2, "0")}/${d.getFullYear()}`;
      const isPaper =
        attOrExam?.submission_type === "paper" ||
        Boolean(attOrExam?.paper_scan_url) ||
        Boolean(attOrExam?.omr_raw_data);

      const newItem: SelectedPracticeExamItem = {
        id: targetId,
        title:
          attOrExam.examTitle ||
          attOrExam.quizTitle ||
          attOrExam.quiz_title ||
          attOrExam.title ||
          "Đề luyện thi thực chiến",
        category: attOrExam.category || "Luyện đề",
        completedDate: dateStr,
        score:
          attOrExam.score !== undefined && attOrExam.score !== null
            ? attOrExam.score
            : attOrExam.points ?? "8.0",
        durationText: attOrExam.timeSpent || attOrExam.time_spent || "",
        submissionType: isPaper ? "paper" : "web",
        paperScanUrl:
          attOrExam.paper_scan_url || attOrExam.omr_raw_data?.warped_image_data_url || null,
        omrRawData: attOrExam.omr_raw_data || null,
      };
      setSelectedPracticeExams((prev) => [...prev, newItem]);
    }
  };

  const handleAddManualPracticeExam = () => {
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(
      now.getMonth() + 1
    ).padStart(2, "0")}/${now.getFullYear()}`;
    const newItem: SelectedPracticeExamItem = {
      id: "manual-prac-" + Date.now(),
      title: `Đề thực chiến bổ sung #${selectedPracticeExams.length + 1}`,
      category: "Luyện đề",
      completedDate: dateStr,
      score: "8.5",
      submissionType: "paper",
    };
    setSelectedPracticeExams((prev) => [...prev, newItem]);
  };

  const handleUpdatePracticeExamItem = (
    id: string,
    field: keyof SelectedPracticeExamItem,
    value: any
  ) => {
    setSelectedPracticeExams((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemovePracticeItem = (id: string) => {
    setSelectedPracticeExams((prev) => prev.filter((item) => item.id !== id));
  };

  // RENDER CANVAS BÁO CÁO THÁNG (ĐỒNG BỘ THƯƠNG HIỆU TÂM CHÍ TÀI 100%)
  const renderCanvasPage = (pageMode: "single" | "page1" | "page2"): string | null => {
    const canvas = document.createElement("canvas");
    const scale = 2;
    const logicalWidth = 880;
    const outerPad = 32;
    const innerPad = 28;
    const contentX = outerPad + innerPad;
    const contentWidth = logicalWidth - (outerPad + innerPad) * 2;
    const FONT_SANS =
      'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    const testCanvas = document.createElement("canvas");
    const testCtx = testCanvas.getContext("2d");
    if (!testCtx) return null;

    const bulletTextMaxWidth = contentWidth - 68;
    const renderedBullets: { title: string; lines: string[]; blockHeight: number }[] = [];

    parsedEvalBullets.forEach((b) => {
      testCtx.font = "400 13.5px " + FONT_SANS;
      const fullWords = b.body.split(/\s+/);
      const lines: string[] = [];
      let curLine = "";

      for (let i = 0; i < fullWords.length; i++) {
        const candidate = curLine ? curLine + " " + fullWords[i] : fullWords[i];
        if (testCtx.measureText(candidate).width > bulletTextMaxWidth && curLine) {
          lines.push(curLine);
          curLine = fullWords[i];
        } else {
          curLine = candidate;
        }
      }
      if (curLine) lines.push(curLine);

      const titleH = b.title ? 20 : 0;
      const bodyH = Math.max(1, lines.length) * 21;
      const blockHeight = titleH + bodyH + 20;
      renderedBullets.push({ title: b.title, lines, blockHeight });
    });

    const totalEvalCardHeight =
      renderedBullets.reduce((acc, item) => acc + item.blockHeight + 10, 0) + 32;

    const weekCols = hasWeek5Data ? [1, 2, 3, 4, 5] : [1, 2, 3, 4];
    const pracRowH = 38;
    const pracTableH =
      currentReport.practiceItems.length > 0
        ? currentReport.practiceItems.length * pracRowH + 42
        : 68;

    let logicalHeight = 560 + pracTableH + totalEvalCardHeight + 130;
    if (pageMode === "page1") {
      logicalHeight = 490 + pracTableH + 75;
    } else if (pageMode === "page2") {
      logicalHeight = 220 + totalEvalCardHeight + 135;
    }

    canvas.width = logicalWidth * scale;
    canvas.height = logicalHeight * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(scale, scale);

    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    drawRoundedRect(
      ctx,
      outerPad,
      outerPad,
      logicalWidth - outerPad * 2,
      logicalHeight - outerPad * 2,
      20,
      "#FFFFFF",
      "#E2E8F0",
      1.5
    );

    drawRoundedRect(
      ctx,
      outerPad + 24,
      outerPad,
      logicalWidth - (outerPad + 24) * 2,
      4,
      2,
      "#1D4ED8"
    );

    let cursorY = outerPad + 24;
    const headerH = pageMode === "page2" ? 78 : 96;

    drawRoundedRect(
      ctx,
      contentX,
      cursorY,
      contentWidth,
      headerH,
      16,
      "#F8FAFC",
      "#E2E8F0",
      1
    );

    drawRoundedRect(ctx, contentX, cursorY + 14, 4, headerH - 28, 2, "#1D4ED8");

    ctx.fillStyle = "#1D4ED8";
    ctx.font = "700 10.5px " + FONT_SANS;
    const subHeaderTitle =
      pageMode === "page2"
        ? "TRUNG TÂM TOÁN TÂM CHÍ TÀI • TRANG 2/2: NHẬN XÉT"
        : pageMode === "page1"
        ? "TRUNG TÂM TOÁN TÂM CHÍ TÀI • TRANG 1/2: KẾT QUẢ HỌC TẬP"
        : "TRUNG TÂM TOÁN TÂM CHÍ TÀI • PHIẾU BÁO CÁO KẾT QUẢ ĐỊNH KỲ";
    ctx.fillText(subHeaderTitle, contentX + 20, cursorY + 25);

    ctx.fillStyle = "#0F172A";
    ctx.font = "800 22px " + FONT_SANS;
    ctx.fillText(currentReport.fullName, contentX + 20, cursorY + 54);

    if (pageMode !== "page2") {
      ctx.fillStyle = "#64748B";
      ctx.font = "500 12.5px " + FONT_SANS;
      ctx.fillText(
        `${currentReport.school}   •   ${currentReport.grade}`,
        contentX + 20,
        cursorY + 76
      );
    }

    const badgeW = 136;
    const badgeH = 30;
    const badgeX = contentX + contentWidth - badgeW - 18;
    const badgeY = cursorY + 16;
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 10, "#1D4ED8");

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 11.5px " + FONT_SANS;
    ctx.textAlign = "center";
    ctx.fillText(
      currentReport.timeframeText.toUpperCase(),
      badgeX + badgeW / 2,
      badgeY + 19
    );

    if (pageMode !== "page2") {
      ctx.fillStyle = "#475569";
      ctx.font = "600 12px " + FONT_SANS;
      ctx.textAlign = "right";
      ctx.fillText(
        `Đã hoàn thành: ${currentReport.total} bài`,
        contentX + contentWidth - 18,
        cursorY + 74
      );
    }
    ctx.textAlign = "left";

    cursorY += headerH + 22;

    if (pageMode === "single" || pageMode === "page1") {
      const gap = 14;
      const cardW = (contentWidth - gap * 3) / 4;
      const cardH = 76;

      const summaryCards = [
        {
          label: "TỔNG BÀI NỘP",
          val: `${currentReport.total} bài`,
          bg: "#F8FAFC",
          border: "#E2E8F0",
          accent: "#64748B",
          labelColor: "#64748B",
          valColor: "#0F172A",
        },
        {
          label: "ĐIỂM TB BTVN",
          val: `${currentReport.hwAvg} / 10`,
          bg: "#F0FDF4",
          border: "#BBF7D0",
          accent: "#10B981",
          labelColor: "#047857",
          valColor: "#065F46",
        },
        {
          label: "ĐIỂM TB KIỂM TRA",
          val: `${currentReport.testAvg} / 10`,
          bg: "#EEF2FF",
          border: "#C7D2FE",
          accent: "#6366F1",
          labelColor: "#4338CA",
          valColor: "#312E81",
        },
        {
          label: "ĐIỂM TB LUYỆN ĐỀ",
          val: `${currentReport.practiceAvg} / 10`,
          bg: "#EFF6FF",
          border: "#BFDBFE",
          accent: "#2563EB",
          labelColor: "#1D4ED8",
          valColor: "#1E3A8A",
        },
      ];

      summaryCards.forEach((c, idx) => {
        const cx = contentX + idx * (cardW + gap);
        drawRoundedRect(ctx, cx, cursorY, cardW, cardH, 14, c.bg, c.border, 1);
        drawRoundedRect(ctx, cx + 14, cursorY, 36, 3, 1.5, c.accent);

        ctx.fillStyle = c.labelColor;
        ctx.font = "700 10px " + FONT_SANS;
        ctx.fillText(c.label, cx + 16, cursorY + 25);

        ctx.fillStyle = c.valColor;
        ctx.font = "800 20px " + FONT_SANS;
        ctx.fillText(c.val, cx + 16, cursorY + 54);
      });

      cursorY += cardH + 26;

      ctx.fillStyle = "#0F172A";
      ctx.font = "700 12.5px " + FONT_SANS;
      ctx.fillText(
        `1. BẢNG THEO DÕI ĐIỂM SỐ ${weekCols.length} TUẦN (BTVN & KIỂM TRA ĐỊNH KỲ)`,
        contentX,
        cursorY
      );

      const tblTop = cursorY + 10;
      const tblH = 108;
      drawRoundedRect(ctx, contentX, tblTop, contentWidth, tblH, 14, "#FFFFFF", "#E2E8F0", 1);

      drawRoundedRect(ctx, contentX, tblTop, contentWidth, 34, 14, "#F1F5F9");
      ctx.fillStyle = "#F1F5F9";
      ctx.fillRect(contentX, tblTop + 20, contentWidth, 14);

      ctx.fillStyle = "#475569";
      ctx.font = "700 11.5px " + FONT_SANS;
      ctx.fillText("Hạng mục đánh giá", contentX + 18, tblTop + 22);

      const weekZoneStart = contentX + 240;
      const weekZoneEnd = contentX + contentWidth - 115;
      const weekStep = (weekZoneEnd - weekZoneStart) / weekCols.length;

      ctx.textAlign = "center";
      weekCols.forEach((w, idx) => {
        const colCenterX = weekZoneStart + idx * weekStep + weekStep / 2;
        ctx.fillText(`Tuần ${w} (T${w}.${currentReport.month})`, colCenterX, tblTop + 22);
      });

      ctx.textAlign = "right";
      ctx.fillText("Trung bình", contentX + contentWidth - 18, tblTop + 22);
      ctx.textAlign = "left";

      const row1Y = tblTop + 58;
      ctx.fillStyle = "#1E293B";
      ctx.font = "600 12.5px " + FONT_SANS;
      ctx.fillText("Bài tập về nhà (BTVN)", contentX + 18, row1Y);

      ctx.textAlign = "center";
      weekCols.forEach((w, idx) => {
        const colCenterX = weekZoneStart + idx * weekStep + weekStep / 2;
        const sc = currentReport.hwScores[w];
        if (sc) {
          drawRoundedRect(ctx, colCenterX - 26, row1Y - 15, 52, 22, 6, "#ECFDF5", "#A7F3D0", 1);
          ctx.fillStyle = "#047857";
          ctx.font = "700 12px " + FONT_SANS;
          ctx.fillText(`${sc}đ`, colCenterX, row1Y);
        } else {
          ctx.fillStyle = "#94A3B8";
          ctx.font = "500 12px " + FONT_SANS;
          ctx.fillText("--", colCenterX, row1Y);
        }
      });

      ctx.textAlign = "right";
      ctx.fillStyle = "#047857";
      ctx.font = "800 13px " + FONT_SANS;
      ctx.fillText(
        currentReport.hwAvg !== "--" ? `${currentReport.hwAvg} / 10` : "--",
        contentX + contentWidth - 18,
        row1Y
      );
      ctx.textAlign = "left";

      ctx.strokeStyle = "#F1F5F9";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(contentX + 12, tblTop + 71);
      ctx.lineTo(contentX + contentWidth - 12, tblTop + 71);
      ctx.stroke();

      const row2Y = tblTop + 94;
      ctx.fillStyle = "#1E293B";
      ctx.font = "600 12.5px " + FONT_SANS;
      ctx.fillText("Kiểm tra định kỳ", contentX + 18, row2Y);

      ctx.textAlign = "center";
      weekCols.forEach((w, idx) => {
        const colCenterX = weekZoneStart + idx * weekStep + weekStep / 2;
        const sc = currentReport.testScores[w];
        if (sc) {
          drawRoundedRect(ctx, colCenterX - 26, row2Y - 15, 52, 22, 6, "#EEF2FF", "#C7D2FE", 1);
          ctx.fillStyle = "#4338CA";
          ctx.font = "700 12px " + FONT_SANS;
          ctx.fillText(`${sc}đ`, colCenterX, row2Y);
        } else {
          ctx.fillStyle = "#94A3B8";
          ctx.font = "500 12px " + FONT_SANS;
          ctx.fillText("--", colCenterX, row2Y);
        }
      });

      ctx.textAlign = "right";
      ctx.fillStyle = "#4338CA";
      ctx.font = "800 13px " + FONT_SANS;
      ctx.fillText(
        currentReport.testAvg !== "--" ? `${currentReport.testAvg} / 10` : "--",
        contentX + contentWidth - 18,
        row2Y
      );
      ctx.textAlign = "left";

      cursorY = tblTop + tblH + 26;

      ctx.fillStyle = "#0F172A";
      ctx.font = "700 12.5px " + FONT_SANS;
      ctx.fillText(
        `2. BẢNG ĐIỂM LUYỆN ĐỀ THỰC CHIẾN (${currentReport.practiceItems.length} ĐỀ)`,
        contentX,
        cursorY
      );

      const pracTableTop = cursorY + 10;
      drawRoundedRect(
        ctx,
        contentX,
        pracTableTop,
        contentWidth,
        pracTableH,
        14,
        "#FFFFFF",
        "#E2E8F0",
        1
      );

      drawRoundedRect(ctx, contentX, pracTableTop, contentWidth, 34, 14, "#EFF6FF");
      ctx.fillStyle = "#EFF6FF";
      ctx.fillRect(contentX, pracTableTop + 20, contentWidth, 14);

      ctx.fillStyle = "#1E40AF";
      ctx.font = "700 11.5px " + FONT_SANS;
      ctx.fillText("STT", contentX + 18, pracTableTop + 22);
      ctx.fillText("Tên đề thi thực chiến", contentX + 64, pracTableTop + 22);
      ctx.textAlign = "center";
      ctx.fillText("Phân loại / Hình thức", contentX + 455, pracTableTop + 22);
      ctx.fillText("Ngày hoàn thành", contentX + 615, pracTableTop + 22);
      ctx.textAlign = "right";
      ctx.fillText("Kết quả", contentX + contentWidth - 18, pracTableTop + 22);
      ctx.textAlign = "left";

      let curPracY = pracTableTop + 34;
      if (currentReport.practiceItems.length === 0) {
        ctx.fillStyle = "#94A3B8";
        ctx.font = "500 12px " + FONT_SANS;
        ctx.fillText(
          "Chưa có đề luyện thi nào được chọn trong kỳ báo cáo này.",
          contentX + 18,
          curPracY + 22
        );
      } else {
        currentReport.practiceItems.forEach((item, pIdx) => {
          if (pIdx % 2 === 1) {
            ctx.fillStyle = "#F8FAFC";
            ctx.fillRect(contentX + 2, curPracY, contentWidth - 4, pracRowH);
          }

          if (pIdx > 0) {
            ctx.strokeStyle = "#F1F5F9";
            ctx.beginPath();
            ctx.moveTo(contentX + 12, curPracY);
            ctx.lineTo(contentX + contentWidth - 12, curPracY);
            ctx.stroke();
          }

          const rowTextY = curPracY + 24;

          ctx.fillStyle = "#64748B";
          ctx.font = "600 12px " + FONT_SANS;
          ctx.fillText(String(pIdx + 1).padStart(2, "0"), contentX + 18, rowTextY);

          ctx.fillStyle = "#0F172A";
          ctx.font = "600 12.5px " + FONT_SANS;
          const cleanTitle =
            item.title.length > 42 ? item.title.slice(0, 39) + "..." : item.title;
          ctx.fillText(cleanTitle, contentX + 64, rowTextY);

          const isPaper = item.submissionType === "paper";
          const catText = formatCategoryWithSubmissionMode(item.category, item.submissionType);
          ctx.font = "700 9.5px " + FONT_SANS;
          const catW = Math.max(110, ctx.measureText(catText).width + 18);
          drawRoundedRect(
            ctx,
            contentX + 455 - catW / 2,
            rowTextY - 14,
            catW,
            20,
            6,
            isPaper ? "#F3E8FF" : "#EFF6FF",
            isPaper ? "#D8B4FE" : "#BFDBFE",
            1
          );
          ctx.fillStyle = isPaper ? "#6B21A8" : "#1D4ED8";
          ctx.textAlign = "center";
          ctx.fillText(catText, contentX + 455, rowTextY - 1);

          ctx.fillStyle = "#475569";
          ctx.font = "500 12px " + FONT_SANS;
          ctx.fillText(item.completedDate, contentX + 615, rowTextY);

          const scoreBadgeW = 68;
          const scoreBadgeX = contentX + contentWidth - scoreBadgeW - 16;
          drawRoundedRect(
            ctx,
            scoreBadgeX,
            rowTextY - 15,
            scoreBadgeW,
            22,
            7,
            "#FEF2F2",
            "#FECACA",
            1
          );
          ctx.fillStyle = "#E11D48";
          ctx.font = "800 12px " + FONT_SANS;
          ctx.fillText(`${item.score} / 10`, scoreBadgeX + scoreBadgeW / 2, rowTextY);

          ctx.textAlign = "left";
          curPracY += pracRowH;
        });
      }

      cursorY = pracTableTop + pracTableH + 24;
    }

    if (pageMode === "single" || pageMode === "page2") {
      ctx.fillStyle = "#0F172A";
      ctx.font = "700 12.5px " + FONT_SANS;
      ctx.fillText("3. NHẬN XÉT CHI TIẾT & ĐỊNH HƯỚNG TỪ GIÁO VIÊN PHỤ TRÁCH", contentX, cursorY);

      const evalCardTop = cursorY + 10;
      drawRoundedRect(
        ctx,
        contentX,
        evalCardTop,
        contentWidth,
        totalEvalCardHeight,
        16,
        "#F8FAFC",
        "#E2E8F0",
        1
      );

      ctx.save();
      ctx.fillStyle = "rgba(29, 78, 216, 0.035)";
      ctx.font = "900 44px " + FONT_SANS;
      ctx.textAlign = "center";
      ctx.fillText(
        "TCT  •  TÂM CHÍ TÀI",
        contentX + contentWidth / 2,
        evalCardTop + totalEvalCardHeight / 2 + 12
      );
      ctx.restore();

      let curBulletY = evalCardTop + 16;
      renderedBullets.forEach((bItem) => {
        drawRoundedRect(
          ctx,
          contentX + 16,
          curBulletY,
          contentWidth - 32,
          bItem.blockHeight,
          12,
          "#FFFFFF",
          "#E2E8F0",
          1
        );

        const iconCenterX = contentX + 36;
        const iconCenterY = curBulletY + 21;
        ctx.beginPath();
        ctx.arc(iconCenterX, iconCenterY, 9, 0, Math.PI * 2);
        ctx.fillStyle = "#EFF6FF";
        ctx.fill();
        ctx.strokeStyle = "#BFDBFE";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "#1D4ED8";
        ctx.font = "800 10px " + FONT_SANS;
        ctx.textAlign = "center";
        ctx.fillText("✓", iconCenterX, iconCenterY + 3.5);
        ctx.textAlign = "left";

        let textY = curBulletY + 22;
        if (bItem.title) {
          ctx.fillStyle = "#1E3A8A";
          ctx.font = "700 13px " + FONT_SANS;
          ctx.fillText(bItem.title + ":", contentX + 54, textY);
          textY += 20;
        }

        ctx.fillStyle = "#334155";
        ctx.font = "400 13.5px " + FONT_SANS;
        bItem.lines.forEach((lineStr) => {
          ctx.fillText(lineStr, contentX + 54, textY);
          textY += 21;
        });

        curBulletY += bItem.blockHeight + 10;
      });
    } else if (pageMode === "page1") {
      ctx.fillStyle = "#94A3B8";
      ctx.font = "500 11px " + FONT_SANS;
      ctx.fillText(
        "Trung tâm Toán Tâm Chí Tài (TCT) • Hotline: 0972 26 16 16",
        contentX,
        logicalHeight - outerPad - 18
      );
      ctx.textAlign = "right";
      ctx.fillStyle = "#1D4ED8";
      ctx.font = "700 11px " + FONT_SANS;
      ctx.fillText(
        "Trang 1/2  •  Xem tiếp nhận xét chi tiết ở Trang 2 →",
        contentX + contentWidth,
        logicalHeight - outerPad - 18
      );
      ctx.textAlign = "left";
    }

    return canvas.toDataURL("image/png");
  };

  const triggerDownloadUrl = (dataUrl: string, suffix: string) => {
    const cleanName = currentReport.fullName.replace(/\s+/g, "_") || "Bao_Cao";
    const downloadLink = document.createElement("a");
    downloadLink.download = `Bao_Cao_TCT_${cleanName}_${currentReport.timeframeText.replace(
      "/",
      ""
    )}${suffix}.png`;
    downloadLink.href = dataUrl;
    downloadLink.click();
  };

  const handleExportPNG = (mode: "single" | "page1" | "page2" | "both" | "preview") => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        if (mode === "preview") {
          if (needsSecondPage) {
            const p1 = renderCanvasPage("page1");
            const p2 = renderCanvasPage("page2");
            setRenderedImageUrls({ page1: p1, page2: p2 });
          } else {
            const single = renderCanvasPage("single");
            setRenderedImageUrls({ page1: single, page2: null });
          }
        } else if (mode === "single") {
          const url = renderCanvasPage("single");
          if (url) triggerDownloadUrl(url, "");
        } else if (mode === "page1") {
          const url = renderCanvasPage("page1");
          if (url) triggerDownloadUrl(url, "_Trang_1");
        } else if (mode === "page2") {
          const url = renderCanvasPage("page2");
          if (url) triggerDownloadUrl(url, "_Trang_2");
        } else if (mode === "both") {
          const p1 = renderCanvasPage("page1");
          const p2 = renderCanvasPage("page2");
          if (p1) triggerDownloadUrl(p1, "_Trang_1");
          if (p2) {
            setTimeout(() => triggerDownloadUrl(p2, "_Trang_2"), 350);
          }
        }
      } catch (e) {
        console.error("Lỗi xuất ảnh:", e);
      } finally {
        setIsExporting(false);
      }
    }, 60);
  };

  const handleCopyZalo = () => {
    if (reportViewType === "daily") {
      handleCopyDailyZalo();
      return;
    }

    const m = currentReport.month;
    let practiceLines = "";
    if (currentReport.practiceItems.length > 0) {
      practiceLines = currentReport.practiceItems
        .map(
          (p, idx) =>
            `  ${idx + 1}. ${p.title} [${formatCategoryWithSubmissionMode(
              p.category,
              p.submissionType
            )}]: ${p.score}/10 (${p.completedDate})`
        )
        .join("\n");
    } else {
      practiceLines = "  (Chưa có đề thi nào)";
    }

    const week5HwPart = hasWeek5Data
      ? ` | [T5.${m}: ${currentReport.hwScores[5] || "--"}]`
      : "";
    const week5TestPart = hasWeek5Data
      ? ` | [T5.${m}: ${currentReport.testScores[5] || "--"}]`
      : "";

    const msg =
      "[PHIẾU BÁO CÁO HỌC TẬP - TRUNG TÂM TOÁN TÂM CHÍ TÀI (TCT)]\n" +
      "Kính gửi Phụ huynh em: " +
      currentReport.fullName +
      "\n" +
      "Trường: " +
      currentReport.school +
      " • " +
      currentReport.grade +
      "\n" +
      "Kỳ báo cáo: " +
      currentReport.timeframeText +
      "\n" +
      "------------------------------------\n" +
      "I. KẾT QUẢ ĐẠT ĐƯỢC:\n" +
      "- Tổng số bài nộp: " +
      currentReport.total +
      " bài\n" +
      "- Điểm trung bình BTVN: " +
      currentReport.hwAvg +
      " / 10\n" +
      "- Điểm trung bình Kiểm tra định kỳ: " +
      currentReport.testAvg +
      " / 10\n" +
      "- Điểm trung bình Luyện đề thực chiến: " +
      currentReport.practiceAvg +
      " / 10\n\n" +
      "* Chi tiết BTVN theo tuần:\n" +
      "  [T1." +
      m +
      ": " +
      (currentReport.hwScores[1] || "--") +
      "] | [T2." +
      m +
      ": " +
      (currentReport.hwScores[2] || "--") +
      "] | [T3." +
      m +
      ": " +
      (currentReport.hwScores[3] || "--") +
      "] | [T4." +
      m +
      ": " +
      (currentReport.hwScores[4] || "--") +
      "]" +
      week5HwPart +
      "\n\n" +
      "* Chi tiết Kiểm tra định kỳ theo tuần:\n" +
      "  [T1." +
      m +
      ": " +
      (currentReport.testScores[1] || "--") +
      "] | [T2." +
      m +
      ": " +
      (currentReport.testScores[2] || "--") +
      "] | [T3." +
      m +
      ": " +
      (currentReport.testScores[3] || "--") +
      "] | [T4." +
      m +
      ": " +
      (currentReport.testScores[4] || "--") +
      "]" +
      week5TestPart +
      "\n\n" +
      "* Danh sách Luyện đề thực chiến gửi phụ huynh:\n" +
      practiceLines +
      "\n\n" +
      "------------------------------------\n" +
      "II. NHẬN XÉT CỦA GIÁO VIÊN:\n" +
      currentReport.evaluation +
      "\n\n" +
      "📞 Hotline TCT: 0972 26 16 16 • Đ/c: Số 10 Tạ Quang Bửu, Bách Khoa, Hà Nội.";

    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(msg);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  const pickerSourceList = useMemo(() => {
    if (reportMode === "auto") {
      return studentPracticeAttempts;
    }
    if (studentPracticeAttempts.length > 0) {
      return studentPracticeAttempts;
    }
    return (practiceExams || []).map((pe: any) => ({
      id: pe.id,
      title: pe.title,
      category: pe.category || "Luyện đề",
      createdAt: pe.created_at || new Date().toISOString(),
      assigned_month: pe.assigned_month,
      score: "8.0"
    }));
  }, [reportMode, studentPracticeAttempts, practiceExams]);

  const filteredModalPracticeAttempts = useMemo(() => {
    if (practiceMonthFilter === "all") return pickerSourceList;
    const targetM = Number(practiceMonthFilter);
    return pickerSourceList.filter((a) => {
      const { month } = resolveAttemptMonthAndWeek(a);
      return month === targetM;
    });
  }, [pickerSourceList, practiceMonthFilter, resolveAttemptMonthAndWeek]);

  return (
    <div className="space-y-5 max-w-6xl mx-auto text-left font-sans">
      {/* 1. THANH CHUYỂN CHẾ ĐỘ BÁO CÁO (NGÀY / THÁNG / TỰ TẠO) & NÚT XUẤT PDF CẢ LỚP */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 w-fit">
          <button
            type="button"
            onClick={() => setReportViewType("daily")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-extrabold text-xs transition cursor-pointer ${
              reportViewType === "daily"
                ? "bg-[#003399] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>📅 Báo cáo theo Ngày / Buổi học</span>
          </button>

          <button
            type="button"
            onClick={() => setReportViewType("monthly")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-extrabold text-xs transition cursor-pointer ${
              reportViewType === "monthly"
                ? "bg-white text-[#1D4ED8] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <UserCheck className="w-4 h-4 text-blue-600" />
            <span>📊 Báo cáo Tổng kết Tháng</span>
          </button>

          <button
            type="button"
            onClick={() => setReportViewType("manual")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-extrabold text-xs transition cursor-pointer ${
              reportViewType === "manual"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>Tự tạo đánh giá (HS mới)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {copiedToast && (
            <span className="text-xs text-emerald-600 font-bold animate-in fade-in flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Đã sao chép!
            </span>
          )}

          <button
            type="button"
            onClick={handleCopyZalo}
            className="px-3 py-2 bg-white border border-slate-300 hover:border-blue-600 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-blue-600" /> Sao chép gửi Zalo
          </button>

          {reportViewType === "daily" ? (
            <>
              <button
                type="button"
                onClick={() => handleExportClassDailyPDF(true)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" /> Xem / In cá nhân
              </button>

              <button
                type="button"
                onClick={() => handleExportClassDailyPDF(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>📑 Xuất PDF Báo Cáo Cả Lớp ({filteredStudents.length} HS)</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowOfficialModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4" /> Xem bản chính thức (Để tải ảnh/in)
            </button>
          )}
        </div>
      </div>

      {/* 2. THANH CẤU HÌNH NHANH CHO CHẾ ĐỘ "BÁO CÁO THEO NGÀY / BUỔI HỌC" */}
      {reportViewType === "daily" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3.5 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Chọn Tháng */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Tháng học:
              </label>
              <select
                value={dailyMonth}
                onChange={(e) => setDailyMonth(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-[#003399] outline-none focus:border-blue-600 cursor-pointer"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    Tháng {m < 10 ? "0" + m : m}
                  </option>
                ))}
              </select>
            </div>

            {/* Chọn Tuần */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Tuần trong tháng:
              </label>
              <select
                value={dailyWeek}
                onChange={(e) => setDailyWeek(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-[#003399] outline-none focus:border-blue-600 cursor-pointer"
              >
                {[1, 2, 3, 4, 5].map((w) => (
                  <option key={w} value={w}>
                    Tuần {w} - Tháng {dailyMonth}
                  </option>
                ))}
              </select>
            </div>

            {/* Nhập Ngày học thực tế */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Ngày học (in lên phiếu):
              </label>
              <input
                type="text"
                value={customDateStr}
                onChange={(e) => setCustomDateStr(e.target.value)}
                placeholder="VD: 28/10/2026"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
              />
            </div>

            {/* Tên bài học đồng bộ tự động từ #lessons */}
            <div className="md:col-span-6">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                  <span>Tên chuyên đề buổi học (Tự động đồng bộ từ #lessons):</span>
                </label>
                {overrideTopicTitle && (
                  <button
                    type="button"
                    onClick={() => setOverrideTopicTitle("")}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Khôi phục theo bài học gốc
                  </button>
                )}
              </div>
              <input
                type="text"
                value={overrideTopicTitle !== "" ? overrideTopicTitle : autoSyncedTopicTitle}
                onChange={(e) => setOverrideTopicTitle(e.target.value)}
                placeholder="Tên bài học trong ngày..."
                className="w-full px-3.5 py-2 rounded-xl bg-amber-50/70 border border-amber-300 text-xs font-extrabold text-slate-900 outline-none focus:border-amber-600 focus:bg-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-500">Lọc danh sách xuất PDF:</span>
              {[
                { key: "all", label: `Tất cả (${registeredStudents.length})` },
                { key: "offline", label: "Học sinh Offline" },
                { key: "online", label: "Học sinh Online" }
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setDailyStudentFilterMode(t.key as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    dailyStudentFilterMode === t.key
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}

              <label className="inline-flex items-center gap-1.5 ml-2 font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCoverSummaryPage}
                  onChange={(e) => setIncludeCoverSummaryPage(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Kèm trang bìa tổng hợp điểm cả lớp</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500">Đề thực chiến tháng:</span>
              <select
                value={selectedDailyPracticeId}
                onChange={(e) => setSelectedDailyPracticeId(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[240px]"
              >
                <option value="auto">Tự động lấy điểm đề cao nhất Tháng {dailyMonth}</option>
                {(practiceExams || []).map((pe: any) => (
                  <option key={pe.id} value={String(pe.id)}>
                    {pe.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 3. GIAO DIỆN CHÍNH: DANH SÁCH HỌC VIÊN BÊN TRÁI + CHI TIẾT BÁO CÁO BÊN PHẢI */}
      {reportMode === "auto" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* CỘT TRÁI: DANH SÁCH HỌC SINH */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col h-[720px]">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#003399]" /> Danh sách học viên
              </h4>
              <span className="text-[11px] font-bold text-slate-400">
                {filteredStudents.length} bạn
              </span>
            </div>

            <div className="my-3 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="Tìm tên hoặc trường..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
              {filteredStudents.map((student) => {
                const isSelected = student.id === currentStudent?.id;
                const dirInfo = sbdDirectoryMap.get(String(student.id || "").trim());
                return (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={
                      "p-3 rounded-xl border transition cursor-pointer flex items-center justify-between " +
                      (isSelected
                        ? "bg-blue-50/90 border-[#003399] shadow-2xs"
                        : "bg-white border-slate-200/60 hover:bg-slate-50")
                    }
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono font-bold text-[10px] border border-slate-200">
                          {dirInfo?.sbd || "000001"}
                        </span>
                        <span
                          className={
                            "font-bold text-xs block truncate " +
                            (isSelected ? "text-[#003399]" : "text-slate-800")
                          }
                        >
                          {student.full_name}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {student.school || "THPT"} • {dirInfo?.mode || "Offline"}
                      </p>
                    </div>
                    <ChevronRight
                      className={
                        "w-4 h-4 " + (isSelected ? "text-[#003399]" : "text-slate-300")
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* CỘT PHẢI: HIỂN THỊ THEO CHẾ ĐỘ NGÀY HOẶC CHẾ ĐỘ THÁNG */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-5">
            {reportViewType === "daily" && currentStudentDailyData ? (
              /* ================= NHÁNH 1: BÁO CÁO THEO NGÀY / BUỔI HỌC (BRANDING TCT 100%) ================= */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#003399] text-white font-bold text-[10px] uppercase">
                        TÂM CHÍ TÀI (TCT)
                      </span>
                      <span className="font-mono font-bold text-xs text-blue-700">
                        SBD: {currentStudentDailyData.sbd}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">
                        • Học sinh {currentStudentDailyData.learningMode}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                      {currentStudentDailyData.studentName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {currentStudentDailyData.school} • Ngày báo cáo:{" "}
                      <strong className="text-slate-800">{customDateStr}</strong> (Tuần{" "}
                      {dailyWeek} - Tháng {dailyMonth})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentStudentDailyData.hasPaperOMR && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Đã đính kèm Phiếu OMR
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleExportClassDailyPDF(true)}
                      className="px-3.5 py-2 rounded-xl bg-[#003399] hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> In phiếu của bạn này
                    </button>
                  </div>
                </div>

                {/* Khối chuyên đề buổi học */}
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
                  <span className="text-[10px] font-bold uppercase text-amber-800 block">
                    NỘI DUNG CHUYÊN ĐỀ BUỔI HỌC:
                  </span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    📘 {overrideTopicTitle || autoSyncedTopicTitle}
                  </div>
                </div>

                {/* 3 Cột Điểm số trong ngày (Cho phép gõ sửa nhanh nếu cần) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                    <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                      1. ĐIỂM BÀI TẬP VỀ NHÀ
                    </span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={
                          currentStudentDailyData.homeworkScore !== null
                            ? currentStudentDailyData.homeworkScore
                            : ""
                        }
                        placeholder="Chưa nộp"
                        onChange={(e) =>
                          setDailyStudentOverrides((prev) => ({
                            ...prev,
                            [currentStudentDailyData.studentId]: {
                              ...(prev[currentStudentDailyData.studentId] || {}),
                              homeworkScore: e.target.value
                            }
                          }))
                        }
                        className="w-24 px-2.5 py-1 rounded-lg bg-white border border-emerald-300 font-bold text-sm text-emerald-900 outline-none"
                      />
                      <span className="text-xs font-bold text-emerald-700">/ 10</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
                    <span className="text-[10px] font-bold uppercase text-blue-800 block">
                      2. ĐIỂM TEST TẠI LỚP (OMR/WEB)
                    </span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={
                          currentStudentDailyData.dailyTestScore !== null
                            ? currentStudentDailyData.dailyTestScore
                            : ""
                        }
                        placeholder="Chưa thi"
                        onChange={(e) =>
                          setDailyStudentOverrides((prev) => ({
                            ...prev,
                            [currentStudentDailyData.studentId]: {
                              ...(prev[currentStudentDailyData.studentId] || {}),
                              dailyTestScore: e.target.value
                            }
                          }))
                        }
                        className="w-24 px-2.5 py-1 rounded-lg bg-white border border-blue-300 font-bold text-sm text-blue-900 outline-none"
                      />
                      <span className="text-xs font-bold text-blue-700">/ 10</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200">
                    <span className="text-[10px] font-bold uppercase text-orange-800 block">
                      3. ĐIỂM ĐỀ THỰC CHIẾN THÁNG
                    </span>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={
                          currentStudentDailyData.practiceScore !== null
                            ? currentStudentDailyData.practiceScore
                            : ""
                        }
                        placeholder="Chưa có"
                        onChange={(e) =>
                          setDailyStudentOverrides((prev) => ({
                            ...prev,
                            [currentStudentDailyData.studentId]: {
                              ...(prev[currentStudentDailyData.studentId] || {}),
                              practiceScore: e.target.value
                            }
                          }))
                        }
                        className="w-24 px-2.5 py-1 rounded-lg bg-white border border-orange-300 font-bold text-sm text-orange-900 outline-none"
                      />
                      <span className="text-xs font-bold text-orange-700">/ 10</span>
                    </div>
                  </div>
                </div>

                {/* Chuyên cần & Trạng thái BTVN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-700">Chuyên cần buổi học:</span>
                    <select
                      value={currentStudentDailyData.attendance}
                      onChange={(e) =>
                        setDailyStudentOverrides((prev) => ({
                          ...prev,
                          [currentStudentDailyData.studentId]: {
                            ...(prev[currentStudentDailyData.studentId] || {}),
                            attendance: e.target.value as any
                          }
                        }))
                      }
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 font-bold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="present">✓ Có mặt đúng giờ</option>
                      <option value="late">⚠️ Đi học muộn</option>
                      <option value="absent">✕ Nghỉ học</option>
                    </select>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-700">Ý thức làm BTVN:</span>
                    <select
                      value={currentStudentDailyData.homeworkStatus}
                      onChange={(e) =>
                        setDailyStudentOverrides((prev) => ({
                          ...prev,
                          [currentStudentDailyData.studentId]: {
                            ...(prev[currentStudentDailyData.studentId] || {}),
                            homeworkStatus: e.target.value as any
                          }
                        }))
                      }
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 font-bold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="completed">✓ Hoàn thành đầy đủ</option>
                      <option value="late">⚠️ Nộp muộn</option>
                      <option value="missing">✕ Chưa hoàn thành</option>
                    </select>
                  </div>
                </div>

                {/* Nhận xét của Giáo viên trong ngày */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nhận xét của Giáo viên trong buổi học:
                  </label>
                  <textarea
                    rows={3}
                    value={currentStudentDailyData.teacherComment}
                    onChange={(e) =>
                      setDailyStudentOverrides((prev) => ({
                        ...prev,
                        [currentStudentDailyData.studentId]: {
                          ...(prev[currentStudentDailyData.studentId] || {}),
                          teacherComment: e.target.value
                        }
                      }))
                    }
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                {/* Xem trước Phụ bản Phiếu chấm OMR ngay tại chỗ (Nếu học sinh làm bài giấy) */}
                {currentStudentDailyData.hasPaperOMR &&
                  currentStudentDailyData.scannedPaperImageUrl && (
                    <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-emerald-400 block">
                            ✓ ĐÃ TỰ ĐỘNG TÍCH HỢP TRANG 2 (PHỤ BẢN ĐỐI SOÁT PHIẾU OMR)
                          </span>
                          <h4 className="text-xs font-bold text-white">
                            Bài thi: {currentStudentDailyData.paperExamTitle} (Mã đề:{" "}
                            {currentStudentDailyData.paperExamCode}) — Sai:{" "}
                            {currentStudentDailyData.wrongQuestionsList?.length || 0} câu
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPaperZoom(1);
                            setPreviewPaperItem({
                              id: "daily-omr",
                              title: currentStudentDailyData.paperExamTitle || "Bài thi OMR",
                              category: "Kiểm tra",
                              completedDate: customDateStr,
                              score: currentStudentDailyData.dailyTestScore ?? 0,
                              submissionType: "paper",
                              paperScanUrl: currentStudentDailyData.scannedPaperImageUrl,
                              omrRawData: {
                                canonical_width: OMR_CANONICAL_WIDTH,
                                canonical_height: OMR_CANONICAL_HEIGHT,
                                bubble_coordinates: currentStudentDailyData.bubbleCoordinates
                              }
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Phóng to xem phiếu OMR
                        </button>
                      </div>

                      {currentStudentDailyData.wrongQuestionsList &&
                        currentStudentDailyData.wrongQuestionsList.length > 0 && (
                          <div className="text-xs space-y-1">
                            <span className="text-[11px] font-semibold text-amber-300 block">
                              Các câu con làm sai / bỏ trống sẽ được in kèm sang Trang 2 của PDF:
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {currentStudentDailyData.wrongQuestionsList.map((w, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px]"
                                >
                                  <strong className="text-rose-400">
                                    Câu {w.questionNumber}:
                                  </strong>{" "}
                                  Chọn {w.studentAnswer} (ĐA: {w.correctAnswer})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  )}
              </div>
            ) : currentStudent ? (
              /* ================= NHÁNH 2: BÁO CÁO TỔNG KẾT THÁNG ================= */
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                      Đang xem báo cáo tổng kết tháng
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">
                      {currentStudent.full_name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {currentStudent.school || "THPT"} • {currentStudent.grade || "Lớp 12"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-600">Tháng:</label>
                    <select
                      value={reportMonth}
                      onChange={(e) => setReportMonth(Number(e.target.value))}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-blue-700 outline-none cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                        <option key={m} value={m}>
                          Tháng {m < 10 ? "0" + m : m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Tổng bài nộp
                    </span>
                    <span className="text-lg font-bold text-slate-900 mt-1 block">
                      {currentReport.total} bài
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">
                      Đ.TB BTVN
                    </span>
                    <span className="text-lg font-bold text-emerald-700 mt-1 block">
                      {autoData.hwAvg} / 10
                    </span>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-center">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase block">
                      Đ.TB Kiểm tra
                    </span>
                    <span className="text-lg font-bold text-indigo-700 mt-1 block">
                      {autoData.testAvg} / 10
                    </span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-center">
                    <span className="text-[10px] font-bold text-[#1D4ED8] uppercase block">
                      Đ.TB Luyện đề
                    </span>
                    <span className="text-lg font-bold text-[#1D4ED8] mt-1 block">
                      {practiceStats.avg} / 10
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase text-slate-800 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#1D4ED8]" /> 1. Bảng theo dõi điểm
                    số theo tuần (Tháng {reportMonth})
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-center text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                          <th className="py-2.5 px-3 text-left w-48">Hạng mục điểm</th>
                          <th className="py-2.5 px-2">T1.{reportMonth}</th>
                          <th className="py-2.5 px-2">T2.{reportMonth}</th>
                          <th className="py-2.5 px-2">T3.{reportMonth}</th>
                          <th className="py-2.5 px-2">T4.{reportMonth}</th>
                          {hasWeek5Data && (
                            <th className="py-2.5 px-2">T5.{reportMonth}</th>
                          )}
                          <th className="py-2.5 px-3 text-right">Trung bình</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold bg-white">
                        <tr>
                          <td className="py-2.5 px-3 text-left font-bold text-slate-800">
                            Bài tập về nhà (BTVN)
                          </td>
                          <td className="py-2.5 px-2 text-emerald-700 font-bold">
                            {autoData.hwByWeek[1] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-emerald-700 font-bold">
                            {autoData.hwByWeek[2] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-emerald-700 font-bold">
                            {autoData.hwByWeek[3] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-emerald-700 font-bold">
                            {autoData.hwByWeek[4] || "--"}
                          </td>
                          {hasWeek5Data && (
                            <td className="py-2.5 px-2 text-emerald-700 font-bold">
                              {autoData.hwByWeek[5] || "--"}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            {autoData.hwAvg}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 text-left font-bold text-slate-800">
                            Kiểm tra định kỳ
                          </td>
                          <td className="py-2.5 px-2 text-indigo-700 font-bold">
                            {autoData.testByWeek[1] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-indigo-700 font-bold">
                            {autoData.testByWeek[2] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-indigo-700 font-bold">
                            {autoData.testByWeek[3] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-indigo-700 font-bold">
                            {autoData.testByWeek[4] || "--"}
                          </td>
                          {hasWeek5Data && (
                            <td className="py-2.5 px-2 text-indigo-700 font-bold">
                              {autoData.testByWeek[5] || "--"}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                            {autoData.testAvg}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase text-slate-800 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-[#1D4ED8]" /> 2. Bảng điểm Luyện đề Thực
                      chiến
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddManualPracticeExam}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-emerald-200 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm đề thủ công
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPracticePickerModal(true)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] rounded-lg text-xs font-bold transition flex items-center gap-1 border border-blue-200 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Chọn đề đưa vào báo cáo
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase">
                          <th className="py-2.5 px-3 text-center w-10">STT</th>
                          <th className="py-2.5 px-3 min-w-[160px]">Tên đề thi</th>
                          <th className="py-2.5 px-2 w-24">Phân loại</th>
                          <th className="py-2.5 px-2 text-center w-28">Hình thức</th>
                          <th className="py-2.5 px-2 text-center w-24">Ngày nộp</th>
                          <th className="py-2.5 px-2 text-center w-24">Điểm số</th>
                          <th className="py-2.5 px-2 text-center w-14">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {selectedPracticeExams.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                              Chưa có đề luyện thi nào trong Tháng {reportMonth}.
                            </td>
                          </tr>
                        ) : (
                          selectedPracticeExams.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/70">
                              <td className="py-2 px-3 text-center font-bold text-slate-400">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={item.title}
                                  onChange={(e) =>
                                    handleUpdatePracticeExamItem(
                                      item.id,
                                      "title",
                                      e.target.value
                                    )
                                  }
                                  className="w-full font-bold text-slate-800 bg-transparent rounded px-2 py-1 outline-none"
                                />
                                {item.paperScanUrl && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPaperZoom(1);
                                      setPreviewPaperItem(item);
                                    }}
                                    className="mt-0.5 ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:underline cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" /> Xem phiếu thi gốc
                                  </button>
                                )}
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  value={item.category}
                                  onChange={(e) =>
                                    handleUpdatePracticeExamItem(
                                      item.id,
                                      "category",
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-2 py-1 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200 text-center outline-none"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <select
                                  value={item.submissionType || "web"}
                                  onChange={(e) =>
                                    handleUpdatePracticeExamItem(
                                      item.id,
                                      "submissionType",
                                      e.target.value as "web" | "paper"
                                    )
                                  }
                                  className="px-2 py-1 rounded text-[10px] font-bold border border-slate-200 bg-slate-50 outline-none cursor-pointer"
                                >
                                  <option value="web">Trực tuyến</option>
                                  <option value="paper">Trên giấy</option>
                                </select>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="text"
                                  value={item.completedDate}
                                  onChange={(e) =>
                                    handleUpdatePracticeExamItem(
                                      item.id,
                                      "completedDate",
                                      e.target.value
                                    )
                                  }
                                  className="w-20 text-center text-slate-600 font-medium bg-transparent outline-none"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="10"
                                  value={item.score}
                                  onChange={(e) =>
                                    handleUpdatePracticeExamItem(
                                      item.id,
                                      "score",
                                      e.target.value
                                    )
                                  }
                                  className="w-14 text-center font-bold text-xs text-blue-700 bg-blue-50 rounded border border-blue-200 py-0.5 outline-none"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePracticeItem(item.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nhận xét gửi Phụ huynh:
                  </label>
                  <textarea
                    rows={5}
                    value={autoTeacherEvaluation}
                    onChange={(e) => setAutoTeacherEvaluation(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
              </>
            ) : (
              <div className="py-24 text-center text-slate-400 font-bold text-xs">
                Vui lòng chọn học sinh ở danh sách bên trái.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* CHẾ ĐỘ 3: TỰ TẠO ĐÁNH GIÁ HỌC SINH MỚI */
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
          <h4 className="font-bold text-slate-800 text-sm">
            Điền thông tin đánh giá học viên mới (Tâm Chí Tài TCT)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold text-slate-700">
            <div>
              <label className="block mb-1">Họ và tên học sinh *</label>
              <input
                type="text"
                value={manualForm.fullName}
                onChange={(e) => setManualForm({ ...manualForm, fullName: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
              />
            </div>
            <div>
              <label className="block mb-1">Trường học</label>
              <input
                type="text"
                value={manualForm.school}
                onChange={(e) => setManualForm({ ...manualForm, school: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1">Khối lớp</label>
                <input
                  type="text"
                  value={manualForm.grade}
                  onChange={(e) => setManualForm({ ...manualForm, grade: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block mb-1">Tháng báo cáo</label>
                <select
                  value={manualForm.reportMonth}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, reportMonth: Number(e.target.value) })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>
                      Tháng {m < 10 ? "0" + m : m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nhận xét của Giáo viên:
            </label>
            <textarea
              rows={5}
              value={manualForm.evaluation}
              onChange={(e) => setManualForm({ ...manualForm, evaluation: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none"
            />
          </div>
        </div>
      )}

      {/* MODAL CHỌN ĐỀ THI ĐƯA VÀO BÁO CÁO THÁNG */}
      {showPracticePickerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden text-left">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">
                Chọn đề Luyện thi thực chiến đưa vào Báo cáo
              </h3>
              <button
                type="button"
                onClick={() => setShowPracticePickerModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {filteredModalPracticeAttempts.map((att) => {
                const selectedItem = selectedPracticeExams.find(
                  (item) => item.id === String(att.id)
                );
                const isSelected = Boolean(selectedItem);
                const title =
                  att.examTitle ||
                  att.quizTitle ||
                  att.quiz_title ||
                  att.title ||
                  "Đề luyện thi thực chiến";
                const displayScore = selectedItem
                  ? selectedItem.score
                  : att.score ?? att.points ?? "8.0";

                return (
                  <div
                    key={att.id}
                    onClick={() => handleToggleSelectPracticeExam(att)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-blue-50 border-blue-600"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <span className="font-bold text-xs text-slate-800 truncate">
                        {title}
                      </span>
                    </div>
                    <span className="font-bold text-xs text-blue-700">
                      {displayScore} / 10
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM TRƯỚC BẢN IN BÁO CÁO THÁNG (BRANDING TÂM CHÍ TÀI TCT) */}
      {showOfficialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white w-full max-w-5xl max-h-[96vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold uppercase text-slate-200">
                  Phiếu Báo Cáo Học Tập Tâm Chí Tài (TCT)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExportPNG("page1")}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Tải Trang 1 (.PNG)
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExportPNG("page2")}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Tải Trang 2 (.PNG)
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExportPNG("single")}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" /> Gộp 1 ảnh dài
                </button>
                <button
                  type="button"
                  onClick={() => setShowOfficialModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex flex-col items-center gap-6 custom-scrollbar">
              <div
                ref={reportPage1Ref}
                className="w-full max-w-[840px] bg-white p-7 rounded-2xl border border-slate-200 shadow-sm space-y-5"
              >
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#003399] block">
                      TRUNG TÂM TOÁN TÂM CHÍ TÀI (TCT) • CHUYÊN TOÁN TƯ DUY - TRẮC NGHIỆM TIA CHỚP
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900 mt-0.5">
                      {currentReport.fullName}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {currentReport.school} • {currentReport.grade}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-[#003399] text-white text-xs font-bold rounded-lg">
                    {currentReport.timeframeText}
                  </span>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-slate-800">
                    Nhận xét của Giáo viên phụ trách:
                  </h4>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    {parsedEvalBullets.map((item, idx) => (
                      <div key={idx} className="text-xs text-slate-700 leading-relaxed">
                        {item.title && (
                          <strong className="text-slate-900 mr-1">{item.title}:</strong>
                        )}
                        <span>{item.body}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM PHIẾU THI GỐC OMR */}
      {previewPaperItem && (
        <div
          onClick={() => setPreviewPaperItem(null)}
          className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[92vh] border border-slate-700 shadow-2xl flex flex-col overflow-hidden cursor-default"
          >
            <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white">
              <div>
                <h4 className="text-sm font-bold text-white">
                  {previewPaperItem.title} — Điểm: {previewPaperItem.score}/10
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPaperZoom((z) => Math.max(0.8, Number((z - 0.25).toFixed(2))))
                  }
                  className="p-1.5 rounded bg-slate-800 text-slate-200 cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-300">
                  {Math.round(paperZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPaperZoom((z) => Math.min(2.2, Number((z + 0.25).toFixed(2))))
                  }
                  className="p-1.5 rounded bg-slate-800 text-slate-200 cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPaperItem(null)}
                  className="p-1.5 rounded bg-slate-800 hover:bg-rose-600 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5 custom-scrollbar flex items-start justify-center bg-slate-900">
              {previewPaperItem.paperScanUrl && (
                <div
                  style={{
                    width: `${Math.round(520 * paperZoom)}px`,
                    aspectRatio: `${OMR_CANONICAL_WIDTH} / ${OMR_CANONICAL_HEIGHT}`
                  }}
                  className="relative rounded-lg overflow-hidden border border-slate-700 bg-white shadow-2xl shrink-0"
                >
                  <img
                    src={previewPaperItem.paperScanUrl}
                    alt="Phiếu thi gốc"
                    className="w-full h-full object-fill block"
                  />
                  {previewPaperItem.omrRawData?.bubble_coordinates && (
                    <svg
                      viewBox={`0 0 ${OMR_CANONICAL_WIDTH} ${OMR_CANONICAL_HEIGHT}`}
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    >
                      {previewPaperItem.omrRawData.bubble_coordinates
                        .filter((b: any) => b.status !== "unfilled")
                        .map((b: any) => {
                          const strokeColor =
                            b.status === "correct"
                              ? "#10B981"
                              : b.status === "wrong"
                              ? "#EF4444"
                              : b.status === "expected_missed"
                              ? "#F59E0B"
                              : "#2563EB";
                          return (
                            <circle
                              key={b.id}
                              cx={b.x}
                              cy={b.y}
                              r={(b.r || 9) + 2.5}
                              fill={
                                b.status === "correct"
                                  ? "rgba(16,185,129,0.22)"
                                  : b.status === "wrong"
                                  ? "rgba(239,68,68,0.22)"
                                  : "none"
                              }
                              stroke={strokeColor}
                              strokeWidth={2.2}
                              strokeDasharray={
                                b.status === "expected_missed" ? "4 2" : undefined
                              }
                            />
                          );
                        })}
                    </svg>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
