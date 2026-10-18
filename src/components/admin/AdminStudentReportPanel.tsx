"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  User, Award, Copy, Printer, Sparkles, PlusCircle, 
  UserCheck, Check, Eye, X, Plus, Trash2, BookOpen, 
  Download, ImageIcon, Search, ChevronRight, ShieldCheck,
  Filter, CheckSquare, Square, FileText, Layers
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
    "- Em đã tiến hành thu điện thoại của con trong giờ học và đề nghị con nghiêm túc chấp hành nội quy này.\n\n" +
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
      "- Em đã tiến hành thu điện thoại của con trong giờ học và đề nghị con nghiêm túc chấp hành nội quy này.\n\n" +
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

  // Bản đồ tra cứu assigned_month và assigned_week từ Chapters (Lessons -> BTVN / Đề KT) và PracticeExams
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

  // Hàm xác định chính xác Tháng và Tuần của một lượt nộp bài
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

  // Toàn bộ lịch sử làm bài của học sinh đang chọn
  const studentAllAttempts = useMemo(() => {
    if (!currentStudent) return [];
    return allAttempts.filter(att => 
      String(att.studentId || att.student_id || "").trim() === String(currentStudent.id || "").trim() ||
      String(att.studentName || att.student_name || "").trim().toLowerCase() === String(currentStudent.full_name || "").trim().toLowerCase()
    );
  }, [allAttempts, currentStudent]);

  // Danh sách các lượt nộp thuộc kho "Luyện đề thực chiến"
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

  // Tự động gán đề luyện thi đúng theo Tháng được chọn (KHÔNG lấy nhầm đề của tháng khác)
  useEffect(() => {
    if (reportMode !== "auto") return;
    if (studentPracticeAttempts.length > 0) {
      const inSelectedMonth = studentPracticeAttempts.filter(a => {
        const { month } = resolveAttemptMonthAndWeek(a);
        return month === reportMonth;
      });

      const mapped: SelectedPracticeExamItem[] = inSelectedMonth.map((a, idx) => {
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

  // Bóc tách điểm theo đúng Tháng (`reportMonth`) và đúng Tuần (`assigned_week` 1 -> 5) cho BTVN và Kiểm tra định kỳ
  // TUYỆT ĐỐI KHÔNG LẤY NHẦM ĐIỂM THÁNG 10 SANG HIỂN THỊ Ở THÁNG 11
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
      // CHỈ LẤY CÁC BÀI THUỘC ĐÚNG THÁNG ĐANG CHỌN (reportMonth)
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
      totalHwTest: monthHwScores.length + monthTestScores.length,
      hwAvg,
      testAvg,
      hwByWeek,
      testByWeek
    };
  }, [studentAllAttempts, currentStudent, reportMonth, quizAssignmentMap]);

  // Điểm trung bình của các đề thi được chọn trong bảng động
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

  // Tính điểm thủ công tự động
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

  // Tổng hợp thông tin báo cáo
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

  const hasWeek5Data = useMemo(() => {
    return Boolean(currentReport.hwScores[5] || currentReport.testScores[5]);
  }, [currentReport.hwScores, currentReport.testScores]);

  // Xác định xem có cần tách sang Trang 2 khi xuất ảnh PNG không (Khi > 4 đề hoặc nhận xét dài)
  const needsSecondPage = useMemo(() => {
    const evalLines = (currentReport.evaluation || "").split("\n").length;
    return currentReport.practiceItems.length > 4 || evalLines > 10 || (currentReport.evaluation || "").length > 650;
  }, [currentReport.practiceItems.length, currentReport.evaluation]);

  // Toggle chọn đề từ Modal Picker (Hỗ trợ cả danh sách lượt nộp của HS lẫn kho đề chung khi ở chế độ Tự tạo đánh giá)
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

  // Thêm 1 dòng đề thi thủ công (ngoài hệ thống)
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

  // Cập nhật trực tiếp thông tin / điểm số của từng đề luyện thi trong bảng
  const handleUpdatePracticeExamItem = (id: string, field: keyof SelectedPracticeExamItem, value: any) => {
    setSelectedPracticeExams(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemovePracticeItem = (id: string) => {
    setSelectedPracticeExams(prev => prev.filter(item => item.id !== id));
  };

  // HÀM VẼ CANVAS CHUẨN SẮC NÉT 860PX (HỖ TRỢ XUẤT ĐƠN TRANG HOẶC TỰ ĐỘNG TÁCH 2 TRANG PNG)
  const renderCanvasPage = (pageMode: "single" | "page1" | "page2"): string | null => {
    const canvas = document.createElement("canvas");
    const scale = 2; // Retina 2x sắc nét
    const logicalWidth = 860;
    const padding = 36;
    const contentWidth = logicalWidth - padding * 2;
    const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

    const testCanvas = document.createElement("canvas");
    const testCtx = testCanvas.getContext("2d");
    if (!testCtx) return null;

    // Bóc tách dòng cho phần nhận xét
    testCtx.font = "normal 13.5px " + FONT_FAMILY;
    const evalMaxWidth = contentWidth - 36;
    const paragraphs = (currentReport.evaluation || "Chưa có nhận xét.").split("\n");
    const wrappedLines: { text: string; isHeader: boolean }[] = [];

    paragraphs.forEach(para => {
      const trimmed = para.trim();
      if (!trimmed) {
        wrappedLines.push({ text: "", isHeader: false });
        return;
      }

      const isHeader = trimmed.startsWith("-") || trimmed.startsWith("1.") || trimmed.startsWith("2.") || trimmed.startsWith("3.") || trimmed.startsWith("+");
      const words = trimmed.split(" ");
      let currentLine = "";

      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine ? currentLine + " " + words[i] : words[i];
        const testWidth = testCtx.measureText(testLine).width;

        if (testWidth > evalMaxWidth && currentLine) {
          wrappedLines.push({ text: currentLine, isHeader });
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        wrappedLines.push({ text: currentLine, isHeader });
      }
    });

    const weekCols = hasWeek5Data ? [1, 2, 3, 4, 5] : [1, 2, 3, 4];
    const evalBoxH = Math.max(150, wrappedLines.length * 22 + 36);
    const pracRowH = 32;
    const pracTableH = currentReport.practiceItems.length > 0 ? currentReport.practiceItems.length * pracRowH + 36 : 52;

    let logicalHeight = 520 + pracTableH + evalBoxH;
    if (pageMode === "page1") {
      logicalHeight = 460 + pracTableH;
    } else if (pageMode === "page2") {
      logicalHeight = 250 + evalBoxH;
    }

    canvas.width = logicalWidth * scale;
    canvas.height = logicalHeight * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(scale, scale);

    // Nền trắng
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    // Viền ngoài
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(12, 12, logicalWidth - 24, logicalHeight - 24);

    // HEADER CHUNG
    const headerH = pageMode === "page2" ? 72 : 92;
    ctx.fillStyle = "#eff6ff";
    ctx.fillRect(padding, padding, contentWidth, headerH);
    ctx.strokeStyle = "#bfdbfe";
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, padding, contentWidth, headerH);

    ctx.fillStyle = "#1d4ed8";
    ctx.font = "bold 11px " + FONT_FAMILY;
    ctx.fillText(
      pageMode === "page2"
        ? "PHIẾU BÁO CÁO KẾT QUẢ HỌC TẬP (TRANG 2/2 - NHẬN XÉT GIÁO VIÊN)"
        : pageMode === "page1"
        ? "PHIẾU BÁO CÁO KẾT QUẢ HỌC TẬP (TRANG 1/2 - TỔNG HỢP ĐIỂM SỐ)"
        : "PHIẾU BÁO CÁO KẾT QUẢ HỌC TẬP",
      padding + 20,
      padding + 24
    );

    ctx.fillStyle = "#0f172a";
    ctx.font = "900 22px " + FONT_FAMILY;
    ctx.fillText(currentReport.fullName, padding + 20, padding + 54);

    if (pageMode !== "page2") {
      ctx.fillStyle = "#475569";
      ctx.font = "600 13px " + FONT_FAMILY;
      ctx.fillText(currentReport.school + " • " + currentReport.grade, padding + 20, padding + 76);
    }

    ctx.fillStyle = "#2563eb";
    ctx.fillRect(logicalWidth - padding - 150, padding + 16, 132, 28);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px " + FONT_FAMILY;
    ctx.textAlign = "center";
    ctx.fillText(currentReport.timeframeText.toUpperCase(), logicalWidth - padding - 150 + 66, padding + 34);

    if (pageMode !== "page2") {
      ctx.fillStyle = "#334155";
      ctx.font = "bold 12.5px " + FONT_FAMILY;
      ctx.textAlign = "right";
      ctx.fillText("Hoàn thành: " + currentReport.total + " bài", logicalWidth - padding - 18, padding + 72);
    }
    ctx.textAlign = "left";

    let cursorY = padding + headerH + 22;

    // NẾU LÀ SINGLE HOẶC TRANG 1: VẼ 4 THẺ TỔNG QUAN + BẢNG TUẦN + BẢNG LUYỆN ĐỀ
    if (pageMode === "single" || pageMode === "page1") {
      const cardW = (contentWidth - 36) / 4;
      const cardH = 74;

      const summaryCards = [
        { label: "TỔNG BÀI NỘP", val: currentReport.total + " bài", bg: "#f8fafc", border: "#e2e8f0", labelColor: "#64748b", valColor: "#0f172a" },
        { label: "Đ.TB BTVN", val: currentReport.hwAvg + " / 10", bg: "#ecfdf5", border: "#a7f3d0", labelColor: "#065f46", valColor: "#047857" },
        { label: "Đ.TB KIỂM TRA", val: currentReport.testAvg + " / 10", bg: "#eef2ff", border: "#c7d2fe", labelColor: "#3730a3", valColor: "#4338ca" },
        { label: "Đ.TB LUYỆN ĐỀ", val: currentReport.practiceAvg + " / 10", bg: "#eff6ff", border: "#bfdbfe", labelColor: "#1e40af", valColor: "#1d4ed8" },
      ];

      summaryCards.forEach((c, idx) => {
        const cx = padding + idx * (cardW + 12);
        ctx.fillStyle = c.bg;
        ctx.fillRect(cx, cursorY, cardW, cardH);
        ctx.strokeStyle = c.border;
        ctx.strokeRect(cx, cursorY, cardW, cardH);

        ctx.fillStyle = c.labelColor;
        ctx.font = "bold 10px " + FONT_FAMILY;
        ctx.fillText(c.label, cx + 14, cursorY + 24);

        ctx.fillStyle = c.valColor;
        ctx.font = "900 20px " + FONT_FAMILY;
        ctx.fillText(c.val, cx + 14, cursorY + 54);
      });

      cursorY += cardH + 26;

      // 1. BẢNG THEO DÕI ĐIỂM SỐ TUẦN
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 13px " + FONT_FAMILY;
      ctx.fillText(`1. BẢNG THEO DÕI ĐIỂM SỐ ${weekCols.length} TUẦN (BTVN & KIỂM TRA ĐỊNH KỲ)`, padding, cursorY);

      const tblTop = cursorY + 10;
      const tblH = 98;
      ctx.strokeStyle = "#cbd5e1";
      ctx.strokeRect(padding, tblTop, contentWidth, tblH);

      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(padding, tblTop, contentWidth, 32);
      ctx.fillStyle = "#334155";
      ctx.font = "bold 12px " + FONT_FAMILY;
      ctx.fillText("Hạng mục điểm", padding + 16, tblTop + 21);

      const weekColStart = padding + 230;
      const weekColStep = hasWeek5Data ? 92 : 115;

      weekCols.forEach((w, idx) => {
        ctx.fillText(`T${w}.${currentReport.month}`, weekColStart + idx * weekColStep, tblTop + 21);
      });
      ctx.fillText("Trung bình", logicalWidth - padding - 95, tblTop + 21);

      // Hàng BTVN
      ctx.fillStyle = "#0f172a";
      ctx.font = "600 12.5px " + FONT_FAMILY;
      ctx.fillText("Bài tập về nhà (BTVN)", padding + 16, tblTop + 54);
      ctx.fillStyle = "#047857";
      ctx.font = "bold 13px " + FONT_FAMILY;
      weekCols.forEach((w, idx) => {
        const sc = currentReport.hwScores[w];
        ctx.fillText(sc ? sc + " đ" : "--", weekColStart + idx * weekColStep, tblTop + 54);
      });
      ctx.fillText(currentReport.hwAvg !== "--" ? currentReport.hwAvg + " / 10" : "--", logicalWidth - padding - 95, tblTop + 54);

      ctx.strokeStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.moveTo(padding, tblTop + 65);
      ctx.lineTo(logicalWidth - padding, tblTop + 65);
      ctx.stroke();

      // Hàng Kiểm tra
      ctx.fillStyle = "#0f172a";
      ctx.font = "600 12.5px " + FONT_FAMILY;
      ctx.fillText("Kiểm tra định kỳ", padding + 16, tblTop + 86);
      ctx.fillStyle = "#4338ca";
      ctx.font = "bold 13px " + FONT_FAMILY;
      weekCols.forEach((w, idx) => {
        const sc = currentReport.testScores[w];
        ctx.fillText(sc ? sc + " đ" : "--", weekColStart + idx * weekColStep, tblTop + 86);
      });
      ctx.fillText(currentReport.testAvg !== "--" ? currentReport.testAvg + " / 10" : "--", logicalWidth - padding - 95, tblTop + 86);

      cursorY = tblTop + tblH + 26;

      // 2. BẢNG ĐIỂM LUYỆN ĐỀ THỰC CHIẾN
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 13px " + FONT_FAMILY;
      ctx.fillText("2. BẢNG ĐIỂM LUYỆN ĐỀ THỰC CHIẾN (TÙY CHỌN GỬI PHỤ HUYNH)", padding, cursorY);

      const pracTableTop = cursorY + 10;
      ctx.strokeStyle = "#cbd5e1";
      ctx.strokeRect(padding, pracTableTop, contentWidth, pracTableH);

      ctx.fillStyle = "#eff6ff";
      ctx.fillRect(padding, pracTableTop, contentWidth, 32);
      ctx.fillStyle = "#1e40af";
      ctx.font = "bold 12px " + FONT_FAMILY;
      ctx.fillText("STT", padding + 14, pracTableTop + 21);
      ctx.fillText("Tên đề thi", padding + 56, pracTableTop + 21);
      ctx.fillText("Phân loại", padding + 430, pracTableTop + 21);
      ctx.fillText("Ngày nộp", padding + 575, pracTableTop + 21);
      ctx.fillText("Điểm số", logicalWidth - padding - 85, pracTableTop + 21);

      let curPracY = pracTableTop + 32;
      if (currentReport.practiceItems.length === 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "normal 12px " + FONT_FAMILY;
        ctx.fillText("Chưa có đề luyện thi nào được chọn vào báo cáo tháng này.", padding + 16, curPracY + 20);
      } else {
        currentReport.practiceItems.forEach((item, pIdx) => {
          ctx.fillStyle = pIdx % 2 === 0 ? "#ffffff" : "#f8fafc";
          ctx.fillRect(padding, curPracY, contentWidth, pracRowH);

          ctx.strokeStyle = "#f1f5f9";
          ctx.strokeRect(padding, curPracY, contentWidth, pracRowH);

          ctx.fillStyle = "#64748b";
          ctx.font = "bold 12px " + FONT_FAMILY;
          ctx.fillText(String(pIdx + 1), padding + 16, curPracY + 21);

          ctx.fillStyle = "#0f172a";
          ctx.font = "bold 12.5px " + FONT_FAMILY;
          const cleanTitle = item.title.length > 48 ? item.title.slice(0, 45) + "..." : item.title;
          ctx.fillText(cleanTitle, padding + 56, curPracY + 21);

          ctx.fillStyle = "#2563eb";
          ctx.font = "bold 11.5px " + FONT_FAMILY;
          ctx.fillText(item.category || "Luyện đề", padding + 430, curPracY + 21);

          ctx.fillStyle = "#475569";
          ctx.font = "normal 12px " + FONT_FAMILY;
          ctx.fillText(item.completedDate, padding + 575, curPracY + 21);

          ctx.fillStyle = "#1d4ed8";
          ctx.font = "bold 13px " + FONT_FAMILY;
          ctx.fillText(`${item.score} / 10`, logicalWidth - padding - 85, curPracY + 21);

          curPracY += pracRowH;
        });
      }

      cursorY = pracTableTop + pracTableH + 26;
    }

    // NẾU LÀ SINGLE HOẶC TRANG 2: VẼ PHẦN NHẬN XÉT CHI TIẾT & CHỮ KÝ
    if (pageMode === "single" || pageMode === "page2") {
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 13px " + FONT_FAMILY;
      ctx.fillText("3. NHẬN XÉT CHI TIẾT TỪ GIÁO VIÊN PHỤ TRÁCH", padding, cursorY);

      const boxY = cursorY + 10;
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(padding, boxY, contentWidth, evalBoxH);
      ctx.strokeStyle = "#cbd5e1";
      ctx.strokeRect(padding, boxY, contentWidth, evalBoxH);

      let curY = boxY + 26;
      wrappedLines.forEach(lineObj => {
        if (!lineObj.text) {
          curY += 10;
          return;
        }
        if (lineObj.isHeader) {
          ctx.font = "bold 13px " + FONT_FAMILY;
          ctx.fillStyle = "#0f172a";
        } else {
          ctx.font = "normal 13px " + FONT_FAMILY;
          ctx.fillStyle = "#334155";
        }
        ctx.fillText(lineObj.text, padding + 18, curY);
        curY += 21;
      });

      // Chữ ký xác nhận ở góc phải dưới
      const footerY = boxY + evalBoxH + 24;
      if (footerY + 25 < logicalHeight) {
        ctx.fillStyle = "#64748b";
        ctx.font = "italic 11.5px " + FONT_FAMILY;
        ctx.fillText("Hệ thống Quản lý Học tập & Luyện thi Toán TCT - EduNexus", padding, footerY);

        ctx.fillStyle = "#1e40af";
        ctx.font = "bold 12px " + FONT_FAMILY;
        ctx.textAlign = "right";
        ctx.fillText("Giáo viên phụ trách: Trương Ngọc Dũng", logicalWidth - padding, footerY);
        ctx.textAlign = "left";
      }
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

  // Danh sách đề hiển thị trong Modal Picker:
  // Nếu ở chế độ Auto: lấy các lượt nộp của học sinh đang chọn; nếu ở chế độ Manual (học sinh mới): cho phép chọn từ cả kho practiceExams chung
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

                {/* 1. BẢNG THEO DÕI ĐIỂM SỐ TUẦN (CHUẨN XÁC THEO ASSIGNED_MONTH & ASSIGNED_WEEK) */}
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
        /* CHẾ ĐỘ 2: TỰ TẠO ĐÁNH GIÁ (HỌC SINH MỚI) - CHO PHÉP SỬA ĐIỂM TRỰC TIẾP & THÊM ĐỀ THỦ CÔNG */
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

          {/* BẢNG TUẦN THỦ CÔNG (HỖ TRỢ T1 -> T5) */}
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

          {/* 2. BẢNG ĐỘNG LUYỆN ĐỀ (CHO PHÉP NHẬP / SỬA ĐIỂM TÙY Ý & THÊM ĐỀ THỦ CÔNG) */}
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

            {/* THANH LỌC NHANH THEO THÁNG */}
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

            {/* DANH SÁCH CÁC ĐỀ THI */}
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
      {/* MODAL BẢN CHÍNH THỨC: CHUẨN 860PX + HỖ TRỢ TÁCH 2 TRANG ẢNH (.PNG) */}
      {/* ========================================================================= */}
      {showOfficialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-5xl max-h-[96vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                  Phiếu báo cáo chính thức (Chuẩn 860px)
                </span>
                {needsSecondPage && (
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded-md text-[10px] font-bold">
                    Tự động chia 2 trang
                  </span>
                )}
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

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-100 flex flex-col items-center gap-6">
              {/* TRANG 1: THÔNG TIN TỔNG QUAN + BẢNG ĐIỂM TUẦN + BẢNG LUYỆN ĐỀ */}
              <div
                ref={reportPage1Ref}
                className="w-full max-w-[860px] bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4 text-slate-800"
              >
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">
                  <span>Trang 1 / 2 • Tổng hợp Điểm số & Luyện đề</span>
                  <span>Chuẩn 860px</span>
                </div>

                {/* 1. HEADER COMPACT */}
                <div className="p-3.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white rounded-xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#1D4ED8] block">
                      Phiếu báo cáo kết quả học tập
                    </span>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight mt-0.5">
                      {currentReport.fullName}
                    </h2>
                    <p className="text-xs text-slate-600 font-semibold">
                      {currentReport.school} • {currentReport.grade}
                    </p>
                  </div>

                  <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between gap-1">
                    <span className="px-2.5 py-1 bg-blue-600 text-white text-[11px] font-black rounded-lg shadow-xs uppercase tracking-wider">
                      {currentReport.timeframeText}
                    </span>
                    <span className="text-xs font-bold text-slate-700 mt-0.5 block">
                      Đã hoàn thành: <strong className="text-[#1D4ED8]">{currentReport.total} bài</strong>
                    </span>
                  </div>
                </div>

                {/* 2. 4 THẺ ĐIỂM SỐ THU GỌN */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tổng bài nộp</span>
                    <span className="text-base font-black text-slate-900 mt-0.5 block">{currentReport.total} bài</span>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Đ.TB BTVN</span>
                    <span className="text-base font-black text-emerald-700 mt-0.5 block">{currentReport.hwAvg} / 10</span>
                  </div>
                  <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-200 text-center">
                    <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Đ.TB Kiểm tra</span>
                    <span className="text-base font-black text-indigo-700 mt-0.5 block">{currentReport.testAvg} / 10</span>
                  </div>
                  <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-200 text-center">
                    <span className="text-[10px] font-bold text-[#1D4ED8] uppercase tracking-wider block">Đ.TB Luyện đề</span>
                    <span className="text-base font-black text-[#1D4ED8] mt-0.5 block">{currentReport.practiceAvg} / 10</span>
                  </div>
                </div>

                {/* 3. BẢNG ĐIỂM TUẦN */}
                <div className="space-y-1">
                  <h4 className="text-[11px] font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#1D4ED8]" /> 1. Bảng theo dõi điểm số theo tuần (BTVN & Kiểm tra định kỳ)
                  </h4>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-center text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                          <th className="py-2 px-3 text-left w-44">Hạng mục</th>
                          <th className="py-2 px-2">T1.{currentReport.month}</th>
                          <th className="py-2 px-2">T2.{currentReport.month}</th>
                          <th className="py-2 px-2">T3.{currentReport.month}</th>
                          <th className="py-2 px-2">T4.{currentReport.month}</th>
                          {hasWeek5Data && <th className="py-2 px-2">T5.{currentReport.month}</th>}
                          <th className="py-2 px-3 text-right">Trung bình</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white font-semibold">
                        <tr>
                          <td className="py-2 px-3 text-left font-bold text-slate-800">Bài tập về nhà (BTVN)</td>
                          <td className="py-2 px-2 text-emerald-700 font-black">{currentReport.hwScores[1] ? (currentReport.hwScores[1] + " đ") : "--"}</td>
                          <td className="py-2 px-2 text-emerald-700 font-black">{currentReport.hwScores[2] ? (currentReport.hwScores[2] + " đ") : "--"}</td>
                          <td className="py-2 px-2 text-emerald-700 font-black">{currentReport.hwScores[3] ? (currentReport.hwScores[3] + " đ") : "--"}</td>
                          <td className="py-2 px-2 text-emerald-700 font-black">{currentReport.hwScores[4] ? (currentReport.hwScores[4] + " đ") : "--"}</td>
                          {hasWeek5Data && <td className="py-2 px-2 text-emerald-700 font-black">{currentReport.hwScores[5] ? (currentReport.hwScores[5] + " đ") : "--"}</td>}
                          <td className="py-2 px-3 text-right font-black text-emerald-700">{currentReport.hwAvg !== "--" ? (currentReport.hwAvg + " / 10") : "--"}</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-left font-bold text-slate-800">Kiểm tra định kỳ</td>
                          <td className="py-2 px-2 text-indigo-700 font-black">{currentReport.testScores[1] ? (currentReport.testScores[1] + " đ") : "--"}</td>
                          <td className="py-2 px-2 text-indigo-700 font-black">{currentReport.testScores[2] ? (currentReport.testScores[2] + " đ") : "--"}</td>
                          <td className="py-2 px-2 text-indigo-700 font-black">{currentReport.testScores[3] ? (currentReport.testScores[3] + " đ") : "--"}</td>
                          <td className="py-2 px-2 text-indigo-700 font-black">{currentReport.testScores[4] ? (currentReport.testScores[4] + " đ") : "--"}</td>
                          {hasWeek5Data && <td className="py-2 px-2 text-indigo-700 font-black">{currentReport.testScores[5] ? (currentReport.testScores[5] + " đ") : "--"}</td>}
                          <td className="py-2 px-3 text-right font-black text-indigo-700">{currentReport.testAvg !== "--" ? (currentReport.testAvg + " / 10") : "--"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. BẢNG ĐỘNG LUYỆN ĐỀ THỰC CHIẾN */}
                <div className="space-y-1 pt-0.5">
                  <h4 className="text-[11px] font-black uppercase text-blue-900 tracking-wider flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-[#1D4ED8]" /> 2. Bảng điểm Luyện đề Thực chiến ({currentReport.practiceItems.length} đề)
                  </h4>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-blue-50/70 border-b border-blue-200 text-blue-900 font-bold">
                          <th className="py-1.5 px-2.5 text-center w-10">STT</th>
                          <th className="py-1.5 px-3">Tên đề thi</th>
                          <th className="py-1.5 px-2.5">Phân loại</th>
                          <th className="py-1.5 px-2.5 text-center">Ngày nộp</th>
                          <th className="py-1.5 px-3 text-right">Điểm số</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white font-semibold">
                        {currentReport.practiceItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-3.5 text-center text-slate-400 italic">
                              Chưa có đề luyện thi nào được chọn vào báo cáo.
                            </td>
                          </tr>
                        ) : (
                          currentReport.practiceItems.map((item, pIdx) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="py-1.5 px-2.5 text-center font-bold text-slate-400">{pIdx + 1}</td>
                              <td className="py-1.5 px-3 font-bold text-slate-800">{item.title}</td>
                              <td className="py-1.5 px-2.5">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                                  {item.category || "Luyện đề"}
                                </span>
                              </td>
                              <td className="py-1.5 px-2.5 text-center text-slate-500 font-medium">{item.completedDate}</td>
                              <td className="py-1.5 px-3 text-right font-black text-[#1D4ED8]">{item.score} / 10</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* TRANG 2: NHẬN XÉT CHI TIẾT TỪ GIÁO VIÊN PHỤ TRÁCH & CHỮ KÝ */}
              <div
                ref={reportPage2Ref}
                className="w-full max-w-[860px] bg-white p-6 rounded-2xl border border-slate-200/90 shadow-sm space-y-4 text-slate-800"
              >
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">
                  <span>Trang 2 / 2 • Đánh giá chuyên môn & Định hướng học tập</span>
                  <span> Học sinh: {currentReport.fullName} ({currentReport.timeframeText})</span>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[11px] font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> 3. Nhận xét chi tiết từ Giáo viên phụ trách
                  </h4>
                  <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line font-medium break-words">
                    {currentReport.evaluation || "Chưa có nhận xét."}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="italic">Hệ thống Quản lý Học tập & Luyện thi Toán TCT - EduNexus</span>
                  <span className="font-bold text-[#1D4ED8]">Giáo viên phụ trách: Trương Ngọc Dũng</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XEM TOÀN CẢNH ẢNH PNG (1 HOẶC 2 TRANG) */}
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
