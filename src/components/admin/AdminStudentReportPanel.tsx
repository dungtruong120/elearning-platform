"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  User, Award, Copy, Printer, Sparkles, PlusCircle, 
  UserCheck, Check, Eye, X, Plus, Trash2, BookOpen, 
  Download, ImageIcon, Search, ChevronRight, ShieldCheck,
  Filter, CheckSquare, Square, FileText, Layers, CheckCircle2
} from "lucide-react";

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
}

function normalizeText(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// HÀM VẼ KHUNG BO GÓC TRÊN HTML5 CANVAS (MODERN MINIMALIST CARD)
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

// HÀM PHÂN TÁCH ĐOẠN NHẬN XÉT THÀNH CÁC MỤC BULLET CHUYÊN NGHIỆP
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

export default function AdminStudentReportPanel({
  registeredStudents = [],
  allAttempts = [],
  chapters = [],
  practiceExams = [],
  attendanceRecords = []
}: Props) {
  const currentRealtimeMonth = useMemo(() => new Date().getMonth() + 1, []);

  const [reportMode, setReportMode] = useState<"auto" | "manual">("auto");
  const [showOfficialModal, setShowOfficialModal] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [renderedImageUrls, setRenderedImageUrls] = useState<{ page1: string | null; page2: string | null }>({
    page1: null,
    page2: null,
  });

  // Modal chọn đề thi đưa vào báo cáo
  const [showPracticePickerModal, setShowPracticePickerModal] = useState<boolean>(false);
  const [practiceMonthFilter, setPracticeMonthFilter] = useState<string>("all");

  const reportPage1Ref = useRef<HTMLDivElement>(null);
  const reportPage2Ref = useRef<HTMLDivElement>(null);

  // --- CHẾ ĐỘ TỰ ĐỘNG ---
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    registeredStudents[0]?.id || ""
  );
  const [searchStudent, setSearchStudent] = useState<string>("");
  const [reportMonth, setReportMonth] = useState<number>(currentRealtimeMonth);
  const [autoTeacherEvaluation, setAutoTeacherEvaluation] = useState<string>(
    "- Chuyên cần & Thái độ: Con đi học đầy đủ và luôn đúng giờ. Trong giờ học, con ngoan, tập trung và có tinh thần tự giác tốt.\n\n" +
    "- Khả năng tiếp thu: Con nắm được các dạng toán cơ bản và hiểu bài ổn định. Tuy nhiên, ở một số dạng bài mới hoặc nâng cao, con vẫn còn phản xạ hơi chậm.\n\n" +
    "- Nội quy lớp học: Em đã tiến hành thu điện thoại của con trong giờ học và đề nghị con nghiêm túc chấp hành nội quy này.\n\n" +
    "- Kết quả kiểm tra tháng: Con đã có nhiều tiến bộ, cần lưu ý cẩn thận hơn ở khâu biến đổi tính toán và trình bày để tránh mất điểm đáng tiếc.\n\n" +
    "- Định hướng giai đoạn tới: Gia đình cùng nhắc nhở con duy trì làm bài tập về nhà và luyện đề bấm giờ đều đặn. Thầy luôn sẵn sàng hỗ trợ giải đáp bất cứ khi nào con gặp khó khăn."
  );

  // Danh sách các đề luyện thi được chọn đưa vào báo cáo
  const [selectedPracticeExams, setSelectedPracticeExams] = useState<SelectedPracticeExamItem[]>([]);

  // --- CHẾ ĐỘ THỦ CÔNG ---
  const [manualForm, setManualForm] = useState({
    fullName: "Trương Ngọc Dũng",
    school: "THPT Lê Quý Đôn",
    grade: "Lớp 12",
    reportMonth: currentRealtimeMonth,
    evaluation: 
      "- Chuyên cần & Thái độ: Con đi học đầy đủ và luôn đúng giờ. Trong giờ học, con ngoan, tập trung và có tinh thần tự giác tốt.\n\n" +
      "- Khả năng tiếp thu: Con nắm được các dạng toán cơ bản và hiểu bài ổn định. Tuy nhiên, ở một số dạng bài mới hoặc nâng cao, con vẫn còn phản xạ hơi chậm.\n\n" +
      "- Nội quy lớp học: Em đã tiến hành thu điện thoại của con trong giờ học và đề nghị con nghiêm túc chấp hành nội quy này.\n\n" +
      "- Kết quả kiểm tra tháng: Con đã có nhiều tiến bộ, cần lưu ý cẩn thận hơn ở khâu biến đổi tính toán và trình bày để tránh mất điểm đáng tiếc.\n\n" +
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

  // Bản đồ tra cứu assigned_month và assigned_week từ Chapters và PracticeExams
  const quizAssignmentMap = useMemo(() => {
    const byId = new Map<string, { month?: number; week?: number; isHw?: boolean; isTest?: boolean; category?: string }>();
    const byTitle = new Map<string, { month?: number; week?: number; isHw?: boolean; isTest?: boolean; category?: string }>();

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
          const meta = { month: m, week: w, isHw: true, isTest: false };
          if (hw.id) byId.set(String(hw.id).trim().toLowerCase(), meta);
          if (hw.title) byTitle.set(normalizeText(hw.title), meta);
        });

        (les?.test_quizzes || []).forEach((tq: any) => {
          if (!tq) return;
          const m = tq.assigned_month ? Number(tq.assigned_month) : lesMonth;
          const w = tq.assigned_week ? Number(tq.assigned_week) : lesWeek;
          const meta = { month: m, week: w, isHw: false, isTest: true };
          if (tq.id) byId.set(String(tq.id).trim().toLowerCase(), meta);
          if (tq.title) byTitle.set(normalizeText(tq.title), meta);
        });
      });
    });

    (practiceExams || []).forEach((pe: any) => {
      if (!pe) return;
      const m = pe.assigned_month ? Number(pe.assigned_month) : undefined;
      const w = pe.assigned_week ? Number(pe.assigned_week) : undefined;
      const meta = { month: m, week: w, isHw: false, isTest: false, category: pe.category || "Luyện đề" };
      if (pe.id) byId.set(String(pe.id).trim().toLowerCase(), meta);
      if (pe.title) byTitle.set(normalizeText(pe.title), meta);
    });

    return { byId, byTitle };
  }, [chapters, practiceExams]);

  const resolveAttemptMonthAndWeek = (att: any): { month: number; week: number; category?: string } => {
    const qId = String(att?.quizId || att?.quiz_id || att?.exam_id || "").trim().toLowerCase();
    const qTitle = normalizeText(att?.examTitle || att?.quizTitle || att?.quiz_title || att?.title || "");

    const matchedMeta =
      (qId && quizAssignmentMap.byId.get(qId)) ||
      (qTitle && quizAssignmentMap.byTitle.get(qTitle)) ||
      null;

    const rawDate = att?.createdAt || att?.created_at || att?.submittedAt;
    const parsedDate = rawDate ? new Date(rawDate) : new Date();
    const validDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();

    const resolvedMonth =
      Number(att?.assigned_month) ||
      Number(matchedMeta?.month) ||
      validDate.getMonth() + 1;

    const dayOfMonth = validDate.getDate();
    const fallbackWeekFromDate = Math.min(5, Math.max(1, Math.ceil(dayOfMonth / 7)));

    const resolvedWeek =
      Number(att?.assigned_week) ||
      Number(matchedMeta?.week) ||
      fallbackWeekFromDate;

    return {
      month: resolvedMonth,
      week: Math.min(5, Math.max(1, resolvedWeek)),
      category: matchedMeta?.category || att?.category
    };
  };

  const filteredStudents = useMemo(() => {
    return registeredStudents.filter(s => 
      (s.full_name || "").toLowerCase().includes(searchStudent.toLowerCase()) ||
      (s.school || "").toLowerCase().includes(searchStudent.toLowerCase())
    );
  }, [registeredStudents, searchStudent]);

  const currentStudent = useMemo(() => {
    return registeredStudents.find(s => s.id === selectedStudentId) || registeredStudents[0] || null;
  }, [registeredStudents, selectedStudentId]);

  const studentAllAttempts = useMemo(() => {
    if (!currentStudent) return [];
    return allAttempts.filter(att => 
      String(att.studentId || att.student_id || "").trim() === String(currentStudent.id || "").trim() ||
      String(att.studentName || att.student_name || "").trim().toLowerCase() === String(currentStudent.full_name || "").trim().toLowerCase()
    );
  }, [allAttempts, currentStudent]);

  const studentPracticeAttempts = useMemo(() => {
    return studentAllAttempts.filter(a => {
      const qId = String(a?.quizId || a?.quiz_id || a?.exam_id || "").trim().toLowerCase();
      const qTitle = normalizeText(a?.examTitle || a?.quizTitle || a?.quiz_title || a?.title || "");
      const meta = (qId && quizAssignmentMap.byId.get(qId)) || (qTitle && quizAssignmentMap.byTitle.get(qTitle));

      if (meta?.isHw || meta?.isTest) return false;
      const isHw = a.type === "homework" || a.isHomework || a.is_homework;
      const isTest = a.type === "test";
      return !isHw && !isTest;
    });
  }, [studentAllAttempts, quizAssignmentMap]);

  // Tự động gán đề luyện thi đúng theo Tháng được chọn (Lọc trùng đề theo điểm cao nhất MAX)
  useEffect(() => {
    if (reportMode !== "auto") return;
    if (studentPracticeAttempts.length > 0) {
      const inSelectedMonth = studentPracticeAttempts.filter(a => {
        const { month } = resolveAttemptMonthAndWeek(a);
        return month === reportMonth;
      });

      const dedupByExamMap = new Map<string, any>();
      inSelectedMonth.forEach((a) => {
        const key = normalizeText(a.examTitle || a.quizTitle || a.quiz_title || a.title || a.quizId || a.id);
        const prev = dedupByExamMap.get(key);
        const curScore = Number(a.score ?? a.points ?? 0);
        const prevScore = prev ? Number(prev.score ?? prev.points ?? 0) : -1;
        if (!prev || curScore >= prevScore) {
          dedupByExamMap.set(key, a);
        }
      });

      const mapped: SelectedPracticeExamItem[] = Array.from(dedupByExamMap.values()).map((a, idx) => {
        const d = new Date(a.createdAt || a.created_at || Date.now());
        const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        const { month, category } = resolveAttemptMonthAndWeek(a);
        return {
          id: a.id || `prac-${idx}`,
          title: a.examTitle || a.quizTitle || a.quiz_title || a.title || "Đề luyện thi thực chiến",
          category: category || a.category || "Luyện đề",
          completedDate: dateStr,
          score: a.score ?? a.points ?? "0",
          durationText: a.timeSpent || a.time_spent || "",
          assignedMonth: month
        };
      });

      setSelectedPracticeExams(mapped);
    } else {
      setSelectedPracticeExams([]);
    }
  }, [currentStudent?.id, reportMonth, studentPracticeAttempts, reportMode]);

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

    const hwByWeekMax: { [key: number]: number | null } = { 1: null, 2: null, 3: null, 4: null, 5: null };
    const testByWeekMax: { [key: number]: number | null } = { 1: null, 2: null, 3: null, 4: null, 5: null };

    const monthHwScores: number[] = [];
    const monthTestScores: number[] = [];

    studentAllAttempts.forEach(att => {
      const qId = String(att?.quizId || att?.quiz_id || att?.exam_id || "").trim().toLowerCase();
      const qTitle = normalizeText(att?.examTitle || att?.quizTitle || att?.quiz_title || att?.title || "");
      const meta = (qId && quizAssignmentMap.byId.get(qId)) || (qTitle && quizAssignmentMap.byTitle.get(qTitle));

      const isHw = Boolean(meta?.isHw || att.type === "homework" || att.isHomework || att.is_homework);
      const isTest = Boolean(meta?.isTest || att.type === "test");

      if (!isHw && !isTest) return;

      const { month, week } = resolveAttemptMonthAndWeek(att);
      if (month !== reportMonth) return;

      const sc = Number(att.score ?? att.points ?? 0);
      if (isNaN(sc)) return;

      if (isHw) {
        monthHwScores.push(sc);
        if (hwByWeekMax[week] === null || sc > hwByWeekMax[week]!) {
          hwByWeekMax[week] = sc;
        }
      } else if (isTest) {
        monthTestScores.push(sc);
        if (testByWeekMax[week] === null || sc > testByWeekMax[week]!) {
          testByWeekMax[week] = sc;
        }
      }
    });

    const hwByWeek: { [key: number]: string } = { 1: "", 2: "", 3: "", 4: "", 5: "" };
    const testByWeek: { [key: number]: string } = { 1: "", 2: "", 3: "", 4: "", 5: "" };

    [1, 2, 3, 4, 5].forEach(w => {
      if (hwByWeekMax[w] !== null) {
        hwByWeek[w] = Number(hwByWeekMax[w]!.toFixed(2)).toString();
      }
      if (testByWeekMax[w] !== null) {
        testByWeek[w] = Number(testByWeekMax[w]!.toFixed(2)).toString();
      }
    });

    const validWeekHw = Object.values(hwByWeek).filter(Boolean).map(Number);
    const validWeekTest = Object.values(testByWeek).filter(Boolean).map(Number);

    const hwAvg = validWeekHw.length > 0
      ? (validWeekHw.reduce((a, b) => a + b, 0) / validWeekHw.length).toFixed(1)
      : "--";
    const testAvg = validWeekTest.length > 0
      ? (validWeekTest.reduce((a, b) => a + b, 0) / validWeekTest.length).toFixed(1)
      : "--";

    return {
      totalHwTest: validWeekHw.length + validWeekTest.length,
      hwAvg,
      testAvg,
      hwByWeek,
      testByWeek
    };
  }, [studentAllAttempts, currentStudent, reportMonth, quizAssignmentMap]);

  const practiceStats = useMemo(() => {
    const parseScore = (val: any) => Number(String(val ?? "").replace(",", ".").trim());
    const validScores = selectedPracticeExams
      .filter(item => String(item.score ?? "").trim() !== "" && String(item.score ?? "").trim() !== "--")
      .map(item => parseScore(item.score))
      .filter(sc => !isNaN(sc));

    const avg = validScores.length > 0 
      ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) 
      : "--";

    return {
      count: selectedPracticeExams.length,
      avg
    };
  }, [selectedPracticeExams]);

  const manualStats = useMemo(() => {
    const parseScore = (val: string) => Number(val.replace(",", ".").trim());
    const validHw = Object.values(manualHWScores).filter(val => val && val.trim() !== "" && !isNaN(parseScore(val))).map(parseScore);
    const validTest = Object.values(manualTestScores).filter(val => val && val.trim() !== "" && !isNaN(parseScore(val))).map(parseScore);

    const hwAvg = validHw.length > 0 ? (validHw.reduce((a, b) => a + b, 0) / validHw.length).toFixed(1) : "--";
    const testAvg = validTest.length > 0 ? (validTest.reduce((a, b) => a + b, 0) / validTest.length).toFixed(1) : "--";

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
  }, [reportMode, currentStudent, reportMonth, autoData, practiceStats, autoTeacherEvaluation, manualForm, manualStats, manualHWScores, manualTestScores, selectedPracticeExams]);

  const parsedEvalBullets = useMemo(
    () => parseEvaluationBullets(currentReport.evaluation),
    [currentReport.evaluation]
  );

  const hasWeek5Data = useMemo(() => {
    return Boolean(currentReport.hwScores[5] || currentReport.testScores[5]);
  }, [currentReport.hwScores, currentReport.testScores]);

  const needsSecondPage = useMemo(() => {
    const evalLines = (currentReport.evaluation || "").split("\n").length;
    return currentReport.practiceItems.length > 4 || evalLines > 8 || (currentReport.evaluation || "").length > 450;
  }, [currentReport.practiceItems.length, currentReport.evaluation]);

  const handleToggleSelectPracticeExam = (attOrExam: any) => {
    const targetId = String(attOrExam.id);
    const existing = selectedPracticeExams.find(item => item.id === targetId);
    if (existing) {
      setSelectedPracticeExams(prev => prev.filter(item => item.id !== targetId));
    } else {
      const rawDate = attOrExam.createdAt || attOrExam.created_at || Date.now();
      const d = new Date(rawDate);
      const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      const newItem: SelectedPracticeExamItem = {
        id: targetId,
        title: attOrExam.examTitle || attOrExam.quizTitle || attOrExam.quiz_title || attOrExam.title || "Đề luyện thi thực chiến",
        category: attOrExam.category || "Luyện đề",
        completedDate: dateStr,
        score: attOrExam.score !== undefined && attOrExam.score !== null ? attOrExam.score : (attOrExam.points ?? "8.0"),
        durationText: attOrExam.timeSpent || attOrExam.time_spent || ""
      };
      setSelectedPracticeExams(prev => [...prev, newItem]);
    }
  };

  const handleAddManualPracticeExam = () => {
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    const newItem: SelectedPracticeExamItem = {
      id: "manual-prac-" + Date.now(),
      title: `Đề thực chiến bổ sung #${selectedPracticeExams.length + 1}`,
      category: "Luyện đề",
      completedDate: dateStr,
      score: "8.5",
    };
    setSelectedPracticeExams(prev => [...prev, newItem]);
  };

  const handleUpdatePracticeExamItem = (id: string, field: keyof SelectedPracticeExamItem, value: any) => {
    setSelectedPracticeExams(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemovePracticeItem = (id: string) => {
    setSelectedPracticeExams(prev => prev.filter(item => item.id !== id));
  };

  // ============================================================================
  // HÀM VẼ CANVAS HIỆN ĐẠI (MODERN MINIMALIST EDUCATIONAL REPORT - RETINA 2X)
  // ============================================================================
  const renderCanvasPage = (pageMode: "single" | "page1" | "page2"): string | null => {
    const canvas = document.createElement("canvas");
    const scale = 2; // Độ phân giải Retina 2x siêu nét
    const logicalWidth = 880;
    const outerPad = 32;
    const innerPad = 28;
    const contentX = outerPad + innerPad;
    const contentWidth = logicalWidth - (outerPad + innerPad) * 2;
    const FONT_SANS = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    const testCanvas = document.createElement("canvas");
    const testCtx = testCanvas.getContext("2d");
    if (!testCtx) return null;

    // Tính toán các khối bullet cho phần Nhận xét của Giáo viên
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

    // 1. NỀN CANVAS TỔNG THỂ MÀU XÁM RẤT NHẠT (#F8FAFC) + THẺ TRẮNG BO GÓC NỔI BẬT
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

    // Thanh accent màu xanh đậm trên đỉnh phiếu
    drawRoundedRect(
      ctx,
      outerPad + 24,
      outerPad,
      logicalWidth - (outerPad + 24) * 2,
      4,
      2,
      "#1D4ED8"
    );

    // 2. HEADER HIỆN ĐẠI (MINIMALIST HEADER CARD)
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

    // Thanh chỉ báo bên trái Header
    drawRoundedRect(ctx, contentX, cursorY + 14, 4, headerH - 28, 2, "#1D4ED8");

    ctx.fillStyle = "#1D4ED8";
    ctx.font = "700 10.5px " + FONT_SANS;
    const subHeaderTitle =
      pageMode === "page2"
        ? "TRANG 2/2: NHẬN XÉT"
        : pageMode === "page1"
        ? "TRANG 1/2: TỔNG HỢP KẾT QUẢ HỌC TẬP"
        : "PHIẾU BÁO CÁO KẾT QUẢ HỌC TẬP ĐỊNH KỲ";
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

    // Badge Tháng bo tròn bên phải
    const badgeW = 136;
    const badgeH = 30;
    const badgeX = contentX + contentWidth - badgeW - 18;
    const badgeY = cursorY + 16;
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 10, "#1D4ED8");

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "700 11.5px " + FONT_SANS;
    ctx.textAlign = "center";
    ctx.fillText(currentReport.timeframeText.toUpperCase(), badgeX + badgeW / 2, badgeY + 19);

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

    // 3. NỘI DUNG TRANG 1 (HOẶC BẢN ĐƠN): 4 THẺ METRIC COMPACT + BẢNG TUẦN + BẢNG LUYỆN ĐỀ
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
        // Điểm nhấn thanh ngang mảnh trên thẻ
        drawRoundedRect(ctx, cx + 14, cursorY, 36, 3, 1.5, c.accent);

        ctx.fillStyle = c.labelColor;
        ctx.font = "700 10px " + FONT_SANS;
        ctx.fillText(c.label, cx + 16, cursorY + 25);

        ctx.fillStyle = c.valColor;
        ctx.font = "800 20px " + FONT_SANS;
        ctx.fillText(c.val, cx + 16, cursorY + 54);
      });

      cursorY += cardH + 26;

      // MỤC 1: BẢNG THEO DÕI ĐIỂM SỐ TUẦN (BO TRÒN, CĂN GIỮA CHUẨN XÁC)
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

      // Header bảng tuần
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

      // Dòng 1: BTVN
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

      // Đường kẻ mảnh phân cách 2 hàng
      ctx.strokeStyle = "#F1F5F9";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(contentX + 12, tblTop + 71);
      ctx.lineTo(contentX + contentWidth - 12, tblTop + 71);
      ctx.stroke();

      // Dòng 2: Kiểm tra định kỳ
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

      // MỤC 2: BẢNG ĐIỂM LUYỆN ĐỀ THỰC CHIẾN
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
      ctx.fillText("Kỳ thi / Phân loại", contentX + 465, pracTableTop + 22);
      ctx.fillText("Ngày hoàn thành", contentX + 610, pracTableTop + 22);
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
            item.title.length > 46 ? item.title.slice(0, 43) + "..." : item.title;
          ctx.fillText(cleanTitle, contentX + 64, rowTextY);

          // Badge Phân loại căn giữa
          const catText = (item.category || "Luyện đề").toUpperCase();
          ctx.font = "700 10px " + FONT_SANS;
          const catW = Math.max(76, ctx.measureText(catText).width + 20);
          drawRoundedRect(
            ctx,
            contentX + 465 - catW / 2,
            rowTextY - 14,
            catW,
            20,
            6,
            "#EFF6FF",
            "#BFDBFE",
            1
          );
          ctx.fillStyle = "#1D4ED8";
          ctx.textAlign = "center";
          ctx.fillText(catText, contentX + 465, rowTextY - 1);

          // Ngày hoàn thành
          ctx.fillStyle = "#475569";
          ctx.font = "500 12px " + FONT_SANS;
          ctx.fillText(item.completedDate, contentX + 610, rowTextY);

          // Badge Điểm số bên phải
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

    // 4. NỘI DUNG TRANG 2 (HOẶC BẢN ĐƠN): NHẬN XÉT CHI TIẾT DẠNG BULLET CARDS + WATERMARK + CHỮ KÝ
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

      // Watermark chìm chính giữa khung nhận xét
      ctx.save();
      ctx.fillStyle = "rgba(29, 78, 216, 0.035)";
      ctx.font = "900 44px " + FONT_SANS;
      ctx.textAlign = "center";
      ctx.fillText(
        "TCT  •  EDUNEXUS",
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

        // Vẽ icon Checkmark tròn màu xanh bên trái mỗi mục nhận xét
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

      cursorY = evalCardTop + totalEvalCardHeight + 22;


      ctx.fillStyle = "#64748B";
      ctx.font = "500 11.5px " + FONT_SANS;
      ctx.fillStyle = "#94A3B8";
      ctx.font = "400 11px " + FONT_SANS;

    } else if (pageMode === "page1") {
      // Footer nhỏ gọn cho Trang 1
      ctx.fillStyle = "#94A3B8";
      ctx.font = "500 11px " + FONT_SANS;
      ctx.fillText(
        "Trung tâm TCT-Tâm Chí Tài",
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
    downloadLink.download = `Bao_Cao_${cleanName}_${currentReport.timeframeText.replace("/", "")}${suffix}.png`;
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
    const m = currentReport.month;
    let practiceLines = "";
    if (currentReport.practiceItems.length > 0) {
      practiceLines = currentReport.practiceItems
        .map((p, idx) => `  ${idx + 1}. ${p.title} [${p.category}]: ${p.score}/10 (${p.completedDate})`)
        .join("\n");
    } else {
      practiceLines = "  (Chưa có đề thi nào)";
    }

    const week5HwPart = hasWeek5Data ? ` | [T5.${m}: ${currentReport.hwScores[5] || "--"}]` : "";
    const week5TestPart = hasWeek5Data ? ` | [T5.${m}: ${currentReport.testScores[5] || "--"}]` : "";

    const msg = 
      "[PHIẾU BÁO CÁO HỌC TẬP - DUNGTRUONG.TCT]\n" +
      "Kính gửi Phụ huynh em: " + currentReport.fullName + "\n" +
      "Trường: " + currentReport.school + " • " + currentReport.grade + "\n" +
      "Kỳ báo cáo: " + currentReport.timeframeText + "\n" +
      "------------------------------------\n" +
      "I. KẾT QUẢ ĐẠT ĐƯỢC:\n" +
      "- Tổng số bài nộp: " + currentReport.total + " bài\n" +
      "- Điểm trung bình BTVN: " + currentReport.hwAvg + " / 10\n" +
      "- Điểm trung bình Kiểm tra định kỳ: " + currentReport.testAvg + " / 10\n" +
      "- Điểm trung bình Luyện đề thực chiến: " + currentReport.practiceAvg + " / 10\n\n" +
      "* Chi tiết BTVN theo tuần:\n" +
      "  [T1." + m + ": " + (currentReport.hwScores[1] || "--") + "] | [T2." + m + ": " + (currentReport.hwScores[2] || "--") + "] | [T3." + m + ": " + (currentReport.hwScores[3] || "--") + "] | [T4." + m + ": " + (currentReport.hwScores[4] || "--") + "]" + week5HwPart + "\n\n" +
      "* Chi tiết Kiểm tra định kỳ theo tuần:\n" +
      "  [T1." + m + ": " + (currentReport.testScores[1] || "--") + "] | [T2." + m + ": " + (currentReport.testScores[2] || "--") + "] | [T3." + m + ": " + (currentReport.testScores[3] || "--") + "] | [T4." + m + ": " + (currentReport.testScores[4] || "--") + "]" + week5TestPart + "\n\n" +
      "* Danh sách Luyện đề thực chiến gửi phụ huynh:\n" +
      practiceLines + "\n\n" +
      "------------------------------------\n" +
      "II. NHẬN XÉT CỦA GIÁO VIÊN:\n" +
      currentReport.evaluation + "\n\n" +
      "Trân trọng gửi quý Phụ huynh!";

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
    return pickerSourceList.filter(a => {
      const { month } = resolveAttemptMonthAndWeek(a);
      return month === targetM;
    });
  }, [pickerSourceList, practiceMonthFilter, quizAssignmentMap]);

  return (
    <div className="space-y-5 max-w-6xl mx-auto text-left font-sans">
      {/* THANH ĐIỀU HƯỚNG CHÍNH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white/90 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setReportMode("auto")}
            className={"flex items-center gap-2 px-4 py-2 rounded-lg font-black text-xs transition cursor-pointer " + (
              reportMode === "auto"
                ? "bg-white text-[#1D4ED8] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <UserCheck className="w-4 h-4 text-blue-600" />
            <span>Theo dữ liệu hệ thống</span>
          </button>
          <button
            type="button"
            onClick={() => setReportMode("manual")}
            className={"flex items-center gap-2 px-4 py-2 rounded-lg font-black text-xs transition cursor-pointer " + (
              reportMode === "manual"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>Tự tạo đánh giá (Học sinh mới)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {copiedToast && (
            <span className="text-xs text-emerald-600 font-bold animate-in fade-in flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Đã sao chép!
            </span>
          )}
          <button
            type="button"
            onClick={handleCopyZalo}
            className="px-3.5 py-2 bg-white border border-slate-300 hover:border-blue-600 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-blue-600" /> Sao chép gửi Zalo
          </button>
          <button
            type="button"
            onClick={() => setShowOfficialModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
          >
            <Eye className="w-4 h-4" /> Xem bản chính thức (Để tải ảnh/in)
          </button>
        </div>
      </div>

      {/* CHẾ ĐỘ 1: THEO HỆ THỐNG */}
      {reportMode === "auto" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* CỘT DANH SÁCH HỌC SINH */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col h-[750px]">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#1D4ED8]" /> Danh sách học viên
              </h4>
              <span className="text-[11px] font-bold text-slate-400">{filteredStudents.length} bạn</span>
            </div>

            <div className="my-3 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchStudent}
                onChange={e => setSearchStudent(e.target.value)}
                placeholder="Tìm tên hoặc trường..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
              {filteredStudents.map(student => {
                const isSelected = student.id === currentStudent?.id;
                return (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={"p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between " + (
                      isSelected 
                        ? "bg-blue-50/90 border-[#1D4ED8] shadow-xs" 
                        : "bg-white border-slate-200/60 hover:bg-slate-50"
                    )}
                  >
                    <div className="min-w-0">
                      <span className={"font-black text-xs block truncate " + (isSelected ? "text-[#1D4ED8]" : "text-slate-800")}>
                        {student.full_name}
                      </span>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{student.school || "THPT"} • {student.grade || "Lớp 12"}</p>
                    </div>
                    <ChevronRight className={"w-4 h-4 " + (isSelected ? "text-[#1D4ED8]" : "text-slate-300")} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* CỘT NỘI DUNG BÁO CÁO CHI TIẾT */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            {currentStudent ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50/40 rounded-2xl border border-blue-200">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block">Đang xem báo cáo</span>
                    <h3 className="text-base font-black text-slate-900 mt-0.5">{currentStudent.full_name}</h3>
                    <p className="text-xs text-slate-500 font-semibold">{currentStudent.school || "THPT"} • {currentStudent.grade || "Lớp 12"}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-600">Tháng:</label>
                    <select
                      value={reportMonth}
                      onChange={e => setReportMonth(Number(e.target.value))}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-blue-700 outline-none cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                        <option key={m} value={m}>Tháng {m < 10 ? "0" + m : m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4 KHỐI ĐIỂM SỐ NỔI BẬT */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng bài nộp</span>
                    <span className="text-lg font-black text-slate-900 mt-1 block">{currentReport.total} bài</span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Đ.TB BTVN</span>
                    <span className="text-lg font-black text-emerald-700 mt-1 block">{autoData.hwAvg} / 10</span>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200 text-center">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Đ.TB Kiểm tra</span>
                    <span className="text-lg font-black text-indigo-700 mt-1 block">{autoData.testAvg} / 10</span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-center">
                    <span className="text-[10px] font-bold text-[#1D4ED8] uppercase tracking-wider block">Đ.TB Luyện đề</span>
                    <span className="text-lg font-black text-[#1D4ED8] mt-1 block">{practiceStats.avg} / 10</span>
                  </div>
                </div>

                {/* 1. BẢNG THEO DÕI ĐIỂM SỐ TUẦN */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[#1D4ED8]" /> 1. Bảng theo dõi điểm số theo tuần (BTVN & Kiểm tra định kỳ - Tháng {reportMonth})
                    </h4>
                  </div>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-center text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                          <th className="py-2.5 px-3 text-left w-48">Hạng mục điểm</th>
                          <th className="py-2.5 px-2">T1.{reportMonth}</th>
                          <th className="py-2.5 px-2">T2.{reportMonth}</th>
                          <th className="py-2.5 px-2">T3.{reportMonth}</th>
                          <th className="py-2.5 px-2">T4.{reportMonth}</th>
                          {hasWeek5Data && <th className="py-2.5 px-2">T5.{reportMonth}</th>}
                          <th className="py-2.5 px-3 text-right">Trung bình</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold bg-white">
                        <tr>
                          <td className="py-2.5 px-3 text-left font-bold text-slate-800">Bài tập về nhà (BTVN)</td>
                          <td className="py-2.5 px-2 text-emerald-700 font-black">{autoData.hwByWeek[1] || "--"}</td>
                          <td className="py-2.5 px-2 text-emerald-700 font-black">{autoData.hwByWeek[2] || "--"}</td>
                          <td className="py-2.5 px-2 text-emerald-700 font-black">{autoData.hwByWeek[3] || "--"}</td>
                          <td className="py-2.5 px-2 text-emerald-700 font-black">{autoData.hwByWeek[4] || "--"}</td>
                          {hasWeek5Data && <td className="py-2.5 px-2 text-emerald-700 font-black">{autoData.hwByWeek[5] || "--"}</td>}
                          <td className="py-2.5 px-3 text-right font-black text-emerald-700">{autoData.hwAvg}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 text-left font-bold text-slate-800">Kiểm tra định kỳ</td>
                          <td className="py-2.5 px-2 text-indigo-700 font-black">{autoData.testByWeek[1] || "--"}</td>
                          <td className="py-2.5 px-2 text-indigo-700 font-black">{autoData.testByWeek[2] || "--"}</td>
                          <td className="py-2.5 px-2 text-indigo-700 font-black">{autoData.testByWeek[3] || "--"}</td>
                          <td className="py-2.5 px-2 text-indigo-700 font-black">{autoData.testByWeek[4] || "--"}</td>
                          {hasWeek5Data && <td className="py-2.5 px-2 text-indigo-700 font-black">{autoData.testByWeek[5] || "--"}</td>}
                          <td className="py-2.5 px-3 text-right font-black text-indigo-700">{autoData.testAvg}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. BẢNG ĐỘNG: LUYỆN ĐỀ THỰC CHIẾN TÙY CHỌN */}
                <div className="space-y-2 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-black uppercase text-blue-900 tracking-wider flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-[#1D4ED8]" /> 2. Bảng điểm Luyện đề Thực chiến (Tùy chọn gửi Phụ huynh)
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddManualPracticeExam}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-black transition flex items-center gap-1 border border-emerald-200 cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm đề thủ công
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPracticePickerModal(true)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] rounded-xl text-xs font-black transition flex items-center gap-1 border border-blue-200 cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Chọn đề đưa vào báo cáo
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase">
                          <th className="py-2.5 px-3 text-center w-10">STT</th>
                          <th className="py-2.5 px-3 min-w-[180px]">Tên đề thi</th>
                          <th className="py-2.5 px-2 w-28">Phân loại</th>
                          <th className="py-2.5 px-2 text-center w-28">Ngày hoàn thành</th>
                          <th className="py-2.5 px-2 text-center w-28">Điểm số</th>
                          <th className="py-2.5 px-2 text-center w-12">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {selectedPracticeExams.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                              Chưa có đề luyện thi nào trong Tháng {reportMonth}. Bấm <strong>"+ Chọn đề đưa vào báo cáo"</strong> hoặc <strong>"+ Thêm đề thủ công"</strong>.
                            </td>
                          </tr>
                        ) : (
                          selectedPracticeExams.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={item.title}
                                  onChange={e => handleUpdatePracticeExamItem(item.id, "title", e.target.value)}
                                  className="w-full font-bold text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg px-2 py-1 outline-none transition"
                                />
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  value={item.category}
                                  onChange={e => handleUpdatePracticeExamItem(item.id, "category", e.target.value)}
                                  className="w-full px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 text-center outline-none"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="text"
                                  value={item.completedDate}
                                  onChange={e => handleUpdatePracticeExamItem(item.id, "completedDate", e.target.value)}
                                  className="w-24 text-center text-slate-600 font-medium bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg px-1.5 py-1 outline-none"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <div className="inline-flex items-center gap-1 bg-blue-50/80 px-2 py-0.5 rounded-lg border border-blue-200">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="10"
                                    value={item.score}
                                    onChange={e => handleUpdatePracticeExamItem(item.id, "score", e.target.value)}
                                    className="w-12 text-center font-black text-xs text-[#1D4ED8] bg-transparent outline-none"
                                  />
                                  <span className="text-[10px] font-bold text-slate-400">/10</span>
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePracticeItem(item.id)}
                                  className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                  title="Gỡ đề khỏi báo cáo"
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

                {/* 3. SOẠN NHẬN XÉT GỬI PHỤ HUYNH */}
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Nhận xét gửi Phụ huynh:
                  </label>
                  <textarea
                    rows={6}
                    value={autoTeacherEvaluation}
                    onChange={e => setAutoTeacherEvaluation(e.target.value)}
                    placeholder="Gõ lời nhận xét gửi phụ huynh..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 outline-none focus:border-blue-600 focus:bg-white resize-y custom-scrollbar leading-relaxed"
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
        /* CHẾ ĐỘ 2: TỰ TẠO ĐÁNH GIÁ (HỌC SINH MỚI) */
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-emerald-600" /> Điền thông tin đánh giá học viên mới
            </h4>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Bản soạn thảo điền trước (Cho phép sửa điểm trực tiếp)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold text-slate-700">
            <div>
              <label className="block mb-1">Họ và tên học sinh *</label>
              <input
                type="text"
                value={manualForm.fullName}
                onChange={e => setManualForm({ ...manualForm, fullName: e.target.value })}
                placeholder="VD: Trương Ngọc Dũng"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>
            <div>
              <label className="block mb-1">Trường học</label>
              <input
                type="text"
                value={manualForm.school}
                onChange={e => setManualForm({ ...manualForm, school: e.target.value })}
                placeholder="VD: THPT Lê Quý Đôn"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1">Khối lớp</label>
                <input
                  type="text"
                  value={manualForm.grade}
                  onChange={e => setManualForm({ ...manualForm, grade: e.target.value })}
                  placeholder="Lớp 12"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-600 focus:bg-white"
                />
              </div>
              <div>
                <label className="block mb-1">Tháng báo cáo</label>
                <select
                  value={manualForm.reportMonth}
                  onChange={e => setManualForm({ ...manualForm, reportMonth: Number(e.target.value) })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-600 cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                    <option key={m} value={m}>Tháng {m < 10 ? "0" + m : m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* BẢNG TUẦN THỦ CÔNG */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="font-black text-xs text-slate-800">
                1. Bảng điểm theo tuần (Nhập điểm hoặc để trống nếu chưa có)
              </span>
              <span className="text-[11px] text-slate-500 font-semibold">
                Đ.TB tính tự động: BTVN ({manualStats.hwAvg}) • KT ({manualStats.testAvg}) • Luyện đề ({practiceStats.avg})
              </span>
            </div>
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-2.5 px-3 text-left w-36">Loại bài</th>
                  <th className="py-2.5 px-2">T1.{manualForm.reportMonth}</th>
                  <th className="py-2.5 px-2">T2.{manualForm.reportMonth}</th>
                  <th className="py-2.5 px-2">T3.{manualForm.reportMonth}</th>
                  <th className="py-2.5 px-2">T4.{manualForm.reportMonth}</th>
                  <th className="py-2.5 px-2">T5.{manualForm.reportMonth}</th>
                  <th className="py-2.5 px-3 text-right">Đ.TB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                <tr>
                  <td className="py-2 px-3 text-left font-bold text-slate-800">BTVN</td>
                  {[1, 2, 3, 4, 5].map(w => (
                    <td key={w} className="py-1.5 px-2">
                      <input
                        type="text"
                        value={manualHWScores[w] || ""}
                        onChange={e => setManualHWScores({ ...manualHWScores, [w]: e.target.value })}
                        placeholder="--"
                        className="w-14 py-1 text-center font-black text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-black text-emerald-700">{manualStats.hwAvg}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-left font-bold text-slate-800">Kiểm tra định kỳ</td>
                  {[1, 2, 3, 4, 5].map(w => (
                    <td key={w} className="py-1.5 px-2">
                      <input
                        type="text"
                        value={manualTestScores[w] || ""}
                        onChange={e => setManualTestScores({ ...manualTestScores, [w]: e.target.value })}
                        placeholder="--"
                        className="w-14 py-1 text-center font-black text-indigo-700 bg-indigo-50 rounded-lg border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-black text-indigo-700">{manualStats.testAvg}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 2. BẢNG ĐỘNG LUYỆN ĐỀ */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-black uppercase text-blue-900 tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-[#1D4ED8]" /> 2. Bảng điểm Luyện đề Thực chiến (Tùy chọn)
                </h4>
                <span className="text-[11px] font-bold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  Đ.TB Luyện đề: {practiceStats.avg} / 10
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddManualPracticeExam}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-black transition flex items-center gap-1 border border-emerald-200 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm đề thủ công
                </button>
                <button
                  type="button"
                  onClick={() => setShowPracticePickerModal(true)}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] rounded-xl text-xs font-black transition flex items-center gap-1 border border-blue-200 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" /> Chọn đề đưa vào báo cáo
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase">
                    <th className="py-2.5 px-3 text-center w-10">STT</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Tên đề thi (Nhấn để sửa)</th>
                    <th className="py-2.5 px-2 w-32">Phân loại</th>
                    <th className="py-2.5 px-2 text-center w-32">Ngày hoàn thành</th>
                    <th className="py-2.5 px-2 text-center w-32">Điểm số (Nhập điểm)</th>
                    <th className="py-2.5 px-2 text-center w-14">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {selectedPracticeExams.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                        Chưa có đề luyện thi nào. Bấm <strong>"+ Thêm đề thủ công"</strong> hoặc <strong>"+ Chọn đề đưa vào báo cáo"</strong> để thêm.
                      </td>
                    </tr>
                  ) : (
                    selectedPracticeExams.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={item.title}
                            onChange={e => handleUpdatePracticeExamItem(item.id, "title", e.target.value)}
                            placeholder="Nhập tên đề thi..."
                            className="w-full font-bold text-slate-800 bg-slate-50/60 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg px-2.5 py-1.5 outline-none transition"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            value={item.category}
                            onChange={e => handleUpdatePracticeExamItem(item.id, "category", e.target.value)}
                            placeholder="Luyện đề"
                            className="w-full px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 text-center outline-none"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="text"
                            value={item.completedDate}
                            onChange={e => handleUpdatePracticeExamItem(item.id, "completedDate", e.target.value)}
                            placeholder="17/10/2026"
                            className="w-28 text-center text-slate-600 font-medium bg-slate-50/60 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg px-2 py-1.5 outline-none"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="inline-flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-300 focus-within:ring-2 focus-within:ring-blue-400/30">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              value={item.score}
                              onChange={e => handleUpdatePracticeExamItem(item.id, "score", e.target.value)}
                              className="w-12 text-center font-black text-sm text-[#1D4ED8] bg-transparent outline-none"
                            />
                            <span className="text-xs font-bold text-slate-400">/ 10</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemovePracticeItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Xóa đề này"
                          >
                            <Trash2 className="w-4 h-4" />
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
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Nhận xét của Giáo viên:
            </label>
            <textarea
              rows={6}
              value={manualForm.evaluation}
              onChange={e => setManualForm({ ...manualForm, evaluation: e.target.value })}
              placeholder="Nhập nội dung nhận xét chi tiết..."
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-emerald-600 focus:bg-white resize-y leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CHỌN ĐỀ THI ĐƯA VÀO BÁO CÁO */}
      {/* ========================================================================= */}
      {showPracticePickerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden text-left">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div>
                <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#1D4ED8]" /> Chọn đề Luyện thi thực chiến đưa vào Báo cáo
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Học sinh: <strong className="text-slate-800">{currentReport.fullName}</strong> • Đã chọn {selectedPracticeExams.length} đề
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPracticePickerModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-100/70 border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto shrink-0 custom-scrollbar">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 shrink-0 ml-1">
                <Filter className="w-3.5 h-3.5" /> Lọc tháng:
              </span>
              {[
                { val: "all", label: "Tất cả đề" },
                { val: "8", label: "Tháng 08" },
                { val: "9", label: "Tháng 09" },
                { val: "10", label: "Tháng 10" },
                { val: "11", label: "Tháng 11" },
                { val: "12", label: "Tháng 12" }
              ].map(item => (
                <button
                  key={item.val}
                  type="button"
                  onClick={() => setPracticeMonthFilter(item.val)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                    practiceMonthFilter === item.val
                      ? "bg-[#1D4ED8] text-white shadow-2xs"
                      : "bg-white text-slate-600 hover:bg-slate-200 border border-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {filteredModalPracticeAttempts.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  Không tìm thấy đề thi nào trong bộ lọc này. Bạn có thể bấm <strong>"+ Thêm đề thủ công"</strong> ở ngoài bảng.
                </div>
              ) : (
                filteredModalPracticeAttempts.map(att => {
                  const selectedItem = selectedPracticeExams.find(item => item.id === String(att.id));
                  const isSelected = Boolean(selectedItem);
                  const d = new Date(att.createdAt || att.created_at || Date.now());
                  const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
                  const title = att.examTitle || att.quizTitle || att.quiz_title || att.title || "Đề luyện thi thực chiến";
                  const displayScore = selectedItem ? selectedItem.score : (att.score ?? att.points ?? "8.0");

                  return (
                    <div
                      key={att.id}
                      onClick={() => handleToggleSelectPracticeExam(att)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                        isSelected 
                          ? "bg-blue-50/80 border-[#1D4ED8] shadow-2xs ring-1 ring-[#1D4ED8]/30" 
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-[#1D4ED8] shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 fill-blue-600 text-white" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h5 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {title}
                          </h5>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-semibold mt-0.5">
                            <span className="text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded font-black text-[9px] uppercase">
                              {att.category || "Luyện đề"}
                            </span>
                            <span>• Ngày nộp: {dateStr}</span>
                          </div>
                        </div>
                      </div>

                      <div
                        className="text-right shrink-0 ml-3 flex items-center gap-1.5"
                        onClick={e => e.stopPropagation()}
                      >
                        {isSelected ? (
                          <div className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-xl border border-blue-300 shadow-2xs">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              value={displayScore}
                              onChange={e => handleUpdatePracticeExamItem(String(att.id), "score", e.target.value)}
                              className="w-12 text-center font-black text-sm text-[#1D4ED8] outline-none"
                            />
                            <span className="text-xs font-bold text-slate-400">/ 10</span>
                          </div>
                        ) : (
                          <span className="font-black text-sm text-[#1D4ED8] bg-white px-2.5 py-1 rounded-xl border border-blue-200 shadow-2xs">
                            {displayScore} / 10
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
              <span className="text-xs font-bold text-slate-600">
                Đã chọn: <strong className="text-[#1D4ED8]">{selectedPracticeExams.length} đề</strong> đưa vào báo cáo
              </span>
              <button
                type="button"
                onClick={() => setShowPracticePickerModal(false)}
                className="px-5 py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl text-xs font-black shadow-sm transition cursor-pointer"
              >
                Xác nhận & Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL BẢN CHÍNH THỨC: REDESIGN MODERN MINIMALIST EDUCATIONAL REPORT */}
      {/* ========================================================================= */}
      {showOfficialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-5xl max-h-[96vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                  Phiếu báo cáo học tập (Modern Minimalist Design)
                </span>
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-md text-[10px] font-bold">
                  Retina 2x • 880px
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExportPNG("page1")}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải Trang 1 (.PNG)</span>
                </button>

                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExportPNG("page2")}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải Trang 2 (.PNG)</span>
                </button>

                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExportPNG("both")}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Tải cả 2 trang</span>
                </button>

                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExportPNG("single")}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Gộp 1 ảnh dài</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportPNG("preview")}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Xem ảnh PNG
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> In
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowOfficialModal(false);
                    setRenderedImageUrls({ page1: null, page2: null });
                  }}
                  className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-100/90 flex flex-col items-center gap-6">
              {/* =============================================================== */}
              {/* TRANG 1: TỔNG HỢP ĐIỂM SỐ & LUYỆN ĐỀ (MODERN MINIMALIST CARD) */}
              {/* =============================================================== */}
              <div
                ref={reportPage1Ref}
                className="w-full max-w-[860px] bg-white p-7 rounded-[24px] border border-slate-200/90 shadow-md space-y-5 text-slate-800 relative overflow-hidden"
              >
                <div className="absolute top-0 left-8 right-8 h-1 bg-[#1D4ED8] rounded-b-full" />

                {/* 1. HEADER COMPACT THANH LỊCH */}
                <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative pl-5">
                  <div className="w-1 bg-[#1D4ED8] rounded-full absolute left-1.5 top-3.5 bottom-3.5" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#1D4ED8] block">
                      Tâm Chí Tài EduNexus • Trang 1/2: Tổng hợp kết quả học tập
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight mt-0.5">
                      {currentReport.fullName}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {currentReport.school} &nbsp;•&nbsp; {currentReport.grade}
                    </p>
                  </div>

                  <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between gap-1.5">
                    <span className="px-3 py-1 bg-[#1D4ED8] text-white text-[11px] font-bold rounded-xl shadow-2xs uppercase tracking-wider">
                      {currentReport.timeframeText}
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      Đã hoàn thành: <strong className="text-[#1D4ED8] font-extrabold">{currentReport.total} bài</strong>
                    </span>
                  </div>
                </div>

                {/* 2. DẢI 4 THẺ ĐIỂM SỐ COMPACT VIỀN MỎNG PASTEL */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 relative overflow-hidden">
                    <div className="w-8 h-0.5 bg-slate-400 rounded-full mb-2" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tổng bài nộp</span>
                    <span className="text-lg font-extrabold text-slate-900 mt-0.5 block">{currentReport.total} bài</span>
                  </div>
                  <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 relative overflow-hidden">
                    <div className="w-8 h-0.5 bg-emerald-500 rounded-full mb-2" />
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Điểm TB BTVN</span>
                    <span className="text-lg font-extrabold text-emerald-800 mt-0.5 block">{currentReport.hwAvg} / 10</span>
                  </div>
                  <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-200/80 relative overflow-hidden">
                    <div className="w-8 h-0.5 bg-indigo-500 rounded-full mb-2" />
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Điểm TB Kiểm tra</span>
                    <span className="text-lg font-extrabold text-indigo-900 mt-0.5 block">{currentReport.testAvg} / 10</span>
                  </div>
                  <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-200/80 relative overflow-hidden">
                    <div className="w-8 h-0.5 bg-blue-600 rounded-full mb-2" />
                    <span className="text-[10px] font-bold text-[#1D4ED8] uppercase tracking-wider block">Điểm TB Luyện đề</span>
                    <span className="text-lg font-extrabold text-blue-950 mt-0.5 block">{currentReport.practiceAvg} / 10</span>
                  </div>
                </div>

                {/* 3. BẢNG ĐIỂM TUẦN CĂN GIỮA TINH TẾ */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#1D4ED8]" /> 1. Bảng theo dõi điểm số theo tuần (BTVN & Kiểm tra định kỳ)
                  </h4>

                  <div className="border border-slate-200/90 rounded-2xl overflow-hidden">
                    <table className="w-full text-center text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                          <th className="py-2.5 px-4 text-left w-52">Hạng mục đánh giá</th>
                          <th className="py-2.5 px-2">Tuần 1 (T1.{currentReport.month})</th>
                          <th className="py-2.5 px-2">Tuần 2 (T2.{currentReport.month})</th>
                          <th className="py-2.5 px-2">Tuần 3 (T3.{currentReport.month})</th>
                          <th className="py-2.5 px-2">Tuần 4 (T4.{currentReport.month})</th>
                          {hasWeek5Data && <th className="py-2.5 px-2">Tuần 5 (T5.{currentReport.month})</th>}
                          <th className="py-2.5 px-4 text-right">Trung bình</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        <tr>
                          <td className="py-3 px-4 text-left font-semibold text-slate-800">Bài tập về nhà (BTVN)</td>
                          {[1, 2, 3, 4, ...(hasWeek5Data ? [5] : [])].map((w) => (
                            <td key={w} className="py-3 px-2">
                              {currentReport.hwScores[w] ? (
                                <span className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                                  {currentReport.hwScores[w]}đ
                                </span>
                              ) : (
                                <span className="text-slate-400">--</span>
                              )}
                            </td>
                          ))}
                          <td className="py-3 px-4 text-right font-extrabold text-emerald-700">
                            {currentReport.hwAvg !== "--" ? `${currentReport.hwAvg} / 10` : "--"}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-3 px-4 text-left font-semibold text-slate-800">Kiểm tra định kỳ</td>
                          {[1, 2, 3, 4, ...(hasWeek5Data ? [5] : [])].map((w) => (
                            <td key={w} className="py-3 px-2">
                              {currentReport.testScores[w] ? (
                                <span className="inline-block px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
                                  {currentReport.testScores[w]}đ
                                </span>
                              ) : (
                                <span className="text-slate-400">--</span>
                              )}
                            </td>
                          ))}
                          <td className="py-3 px-4 text-right font-extrabold text-indigo-700">
                            {currentReport.testAvg !== "--" ? `${currentReport.testAvg} / 10` : "--"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. BẢNG ĐỘNG LUYỆN ĐỀ THỰC CHIẾN */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-[#1D4ED8]" /> 2. Bảng điểm Luyện đề Thực chiến ({currentReport.practiceItems.length} đề)
                  </h4>

                  <div className="border border-slate-200/90 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-blue-50/70 border-b border-blue-100 text-blue-900 font-bold text-[11px]">
                          <th className="py-2.5 px-3 text-center w-12">STT</th>
                          <th className="py-2.5 px-4">Tên đề thi thực chiến</th>
                          <th className="py-2.5 px-3 text-center">Kỳ thi / Phân loại</th>
                          <th className="py-2.5 px-3 text-center">Ngày hoàn thành</th>
                          <th className="py-2.5 px-4 text-right">Kết quả</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {currentReport.practiceItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                              Chưa có đề luyện thi nào được chọn trong kỳ báo cáo này.
                            </td>
                          </tr>
                        ) : (
                          currentReport.practiceItems.map((item, pIdx) => (
                            <tr key={item.id} className={pIdx % 2 === 1 ? "bg-slate-50/50" : "bg-white"}>
                              <td className="py-2.5 px-3 text-center font-semibold text-slate-400">
                                {String(pIdx + 1).padStart(2, "0")}
                              </td>
                              <td className="py-2.5 px-4 font-semibold text-slate-800">{item.title}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase bg-blue-50 text-[#1D4ED8] border border-blue-200">
                                  {item.category || "Luyện đề"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-500 font-medium">{item.completedDate}</td>
                              <td className="py-2.5 px-4 text-right">
                                <span className="inline-block px-2.5 py-0.5 rounded-md bg-rose-50 text-rose-600 border border-rose-200 font-extrabold">
                                  {item.score} / 10
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* =============================================================== */}
              {/* TRANG 2: NHẬN XÉT CHUYÊN MÔN & CHỮ KÝ (MODERN BULLET CARDS) */}
              {/* =============================================================== */}
              <div
                ref={reportPage2Ref}
                className="w-full max-w-[860px] bg-white p-7 rounded-[24px] border border-slate-200/90 shadow-md space-y-5 text-slate-800 relative overflow-hidden"
              >
                <div className="absolute top-0 left-8 right-8 h-1 bg-[#1D4ED8] rounded-b-full" />

                {/* Header rút gọn Trang 2 */}
                <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 flex items-center justify-between gap-3 relative pl-5">
                  <div className="w-1 bg-[#1D4ED8] rounded-full absolute left-1.5 top-3 bottom-3" />
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#1D4ED8] block">
                      Tâm Chí Tài EduNexus • Trang 2/2: Đánh giá chuyên môn & Định hướng
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                      {currentReport.fullName}
                    </h3>
                  </div>
                  <span className="px-3 py-1 bg-[#1D4ED8] text-white text-[11px] font-bold rounded-xl uppercase tracking-wider">
                    {currentReport.timeframeText}
                  </span>
                </div>

                {/* Khung nhận xét có Watermark chìm & Bullet Cards */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-bold uppercase text-slate-800 tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> 3. Nhận xét chi tiết & Định hướng từ Giáo viên phụ trách
                  </h4>

                  <div className="p-4 sm:p-5 bg-slate-50/70 rounded-2xl border border-slate-200/90 space-y-2.5 relative overflow-hidden">
                    <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center opacity-[0.035]">
                      <span className="text-4xl sm:text-5xl font-black tracking-widest text-[#1D4ED8]">
                        TCT • EDUNEXUS
                      </span>
                    </div>

                    {parsedEvalBullets.map((item, idx) => (
                      <div
                        key={idx}
                        className="relative z-10 p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-start gap-3"
                      >
                        <div className="w-5 h-5 rounded-full bg-blue-50 border border-blue-200 text-[#1D4ED8] flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <div className="text-[13px] leading-[1.65] text-slate-700 font-normal">
                          {item.title && (
                            <strong className="font-bold text-blue-950 mr-1.5">
                              {item.title}:
                            </strong>
                          )}
                          <span>{item.body}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Khối chữ ký điện tử & Xác nhận căn phải */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50/60 border border-slate-100">
                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <p className="font-semibold text-slate-600">
                      Hệ thống Quản lý Học tập & Luyện thi Toán TCT - EduNexus
                    </p>
                    <p className="text-slate-400">
                      Ngày xuất phiếu: {new Date().toLocaleDateString("vi-VN")} • Bản báo cáo xác thực điện tử
                    </p>
                  </div>

                  <div className="px-4 py-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-right shrink-0">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-blue-800 block">
                      Giáo viên phụ trách chuyên môn
                    </span>
                    <span className="text-sm font-extrabold text-[#1D4ED8] mt-0.5 block">
                      Thầy Trương Ngọc Dũng
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XEM TOÀN CẢNH ẢNH PNG */}
      {(renderedImageUrls.page1 || renderedImageUrls.page2) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in zoom-in-95 overflow-y-auto">
          <div className="relative max-w-4xl w-full max-h-[92vh] flex flex-col items-center gap-4 overflow-y-auto py-6 custom-scrollbar">
            <div className="sticky top-0 flex items-center gap-2 z-20 bg-slate-900/90 px-4 py-2 rounded-2xl border border-white/15 shadow-lg">
              {renderedImageUrls.page1 && (
                <a
                  href={renderedImageUrls.page1}
                  download={"Bao_Cao_" + currentReport.fullName.replace(/\s+/g, "_") + "_Trang_1.png"}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Tải Trang 1 (.PNG)
                </a>
              )}
              {renderedImageUrls.page2 && (
                <a
                  href={renderedImageUrls.page2}
                  download={"Bao_Cao_" + currentReport.fullName.replace(/\s+/g, "_") + "_Trang_2.png"}
                  className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Tải Trang 2 (.PNG)
                </a>
              )}
              <button
                type="button"
                onClick={() => setRenderedImageUrls({ page1: null, page2: null })}
                className="p-1.5 bg-white/10 hover:bg-rose-600 text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {renderedImageUrls.page1 && (
              <img 
                src={renderedImageUrls.page1} 
                alt="Phiếu báo cáo Trang 1" 
                className="rounded-2xl shadow-2xl max-w-full object-contain border border-white/20 bg-white" 
              />
            )}
            {renderedImageUrls.page2 && (
              <img 
                src={renderedImageUrls.page2} 
                alt="Phiếu báo cáo Trang 2" 
                className="rounded-2xl shadow-2xl max-w-full object-contain border border-white/20 bg-white" 
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
