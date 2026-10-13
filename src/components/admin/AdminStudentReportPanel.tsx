"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  User, Award, Copy, Printer, Sparkles, PlusCircle, 
  UserCheck, Check, Eye, X, Plus, Trash2, BookOpen, 
  Download, ImageIcon, Search, ChevronRight, ShieldCheck, Target,
  Filter, CheckSquare, Square
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
}

export default function AdminStudentReportPanel({
  registeredStudents = [],
  allAttempts = [],
  chapters = [],
  practiceExams = [],
  attendanceRecords = []
}: Props) {
  const [reportMode, setReportMode] = useState<"auto" | "manual">("auto");
  const [showOfficialModal, setShowOfficialModal] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [renderedImageUrl, setRenderedImageUrl] = useState<string | null>(null);

  // Modal chọn đề thi đưa vào báo cáo
  const [showPracticePickerModal, setShowPracticePickerModal] = useState<boolean>(false);
  const [practiceMonthFilter, setPracticeMonthFilter] = useState<string>("all");

  const reportCardRef = useRef<HTMLDivElement>(null);

  // --- CHẾ ĐỘ TỰ ĐỘNG ---
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    registeredStudents[0]?.id || ""
  );
  const [searchStudent, setSearchStudent] = useState<string>("");
  const [reportMonth, setReportMonth] = useState<number>(10);
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
    reportMonth: 10,
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
    4: ""
  });

  const [manualTestScores, setManualTestScores] = useState<{ [key: number]: string }>({
    1: "7.5",
    2: "8.0",
    3: "",
    4: ""
  });

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
      const isHw = a.type === "homework" || a.isHomework || a.is_homework;
      const isTest = a.type === "test";
      return !isHw && !isTest;
    });
  }, [studentAllAttempts]);

  // Tự động gán đề luyện thi mặc định khi chuyển học sinh hoặc chuyển tháng
  useEffect(() => {
    if (studentPracticeAttempts.length > 0) {
      // Ưu tiên các đề trong tháng được chọn, nếu không có thì lấy các đề gần nhất
      const inMonth = studentPracticeAttempts.filter(a => {
        const d = new Date(a.createdAt || a.created_at || Date.now());
        return d.getMonth() + 1 === reportMonth;
      });

      const sourceList = inMonth.length > 0 ? inMonth : studentPracticeAttempts.slice(0, 4);

      const mapped: SelectedPracticeExamItem[] = sourceList.map((a, idx) => {
        const d = new Date(a.createdAt || a.created_at || Date.now());
        const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        return {
          id: a.id || `prac-${idx}`,
          title: a.examTitle || a.quizTitle || a.quiz_title || a.title || "Đề luyện thi thực chiến",
          category: a.category || "Luyện đề",
          completedDate: dateStr,
          score: a.score ?? a.points ?? "--",
          durationText: a.timeSpent || a.time_spent || ""
        };
      });

      setSelectedPracticeExams(mapped);
    } else {
      setSelectedPracticeExams([]);
    }
  }, [currentStudent?.id, reportMonth, studentPracticeAttempts]);

  // Bóc tách điểm 4 tuần cho BTVN và Kiểm tra định kỳ
  const autoData = useMemo(() => {
    if (!currentStudent) {
      return { 
        totalHwTest: 0, 
        hwAvg: "--", 
        testAvg: "--", 
        hwByWeek: { 1: "", 2: "", 3: "", 4: "" }, 
        testByWeek: { 1: "", 2: "", 3: "", 4: "" }
      };
    }

    const hwAttempts = studentAllAttempts.filter(a => a.type === "homework" || a.isHomework || a.is_homework);
    const testAttempts = studentAllAttempts.filter(a => a.type === "test");

    const hwScores = hwAttempts.map(a => Number(a.score ?? a.points ?? 0));
    const testScores = testAttempts.map(a => Number(a.score ?? a.points ?? 0));

    const hwAvg = hwScores.length > 0 ? (hwScores.reduce((a, b) => a + b, 0) / hwScores.length).toFixed(1) : "--";
    const testAvg = testScores.length > 0 ? (testScores.reduce((a, b) => a + b, 0) / testScores.length).toFixed(1) : "--";

    const hwByWeek: { [key: number]: string } = { 1: "", 2: "", 3: "", 4: "" };
    hwAttempts.slice(0, 4).forEach((att, idx) => {
      const sc = att.score ?? att.points;
      hwByWeek[idx + 1] = sc !== undefined && sc !== null ? String(sc) : "";
    });

    const testByWeek: { [key: number]: string } = { 1: "", 2: "", 3: "", 4: "" };
    testAttempts.slice(0, 4).forEach((att, idx) => {
      const sc = att.score ?? att.points;
      testByWeek[idx + 1] = sc !== undefined && sc !== null ? String(sc) : "";
    });

    return {
      totalHwTest: hwAttempts.length + testAttempts.length,
      hwAvg,
      testAvg,
      hwByWeek,
      testByWeek
    };
  }, [studentAllAttempts, currentStudent]);

  // Điểm trung bình của các đề thi được chọn trong bảng động
  const practiceStats = useMemo(() => {
    const parseScore = (val: any) => Number(String(val).replace(",", "."));
    const validScores = selectedPracticeExams
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
    const parseScore = (val: string) => Number(val.replace(",", "."));
    const validHw = Object.values(manualHWScores).filter(val => val && !isNaN(parseScore(val))).map(parseScore);
    const validTest = Object.values(manualTestScores).filter(val => val && !isNaN(parseScore(val))).map(parseScore);

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

  // Toggle chọn đề từ Modal Picker
  const handleToggleSelectPracticeExam = (att: any) => {
    const existing = selectedPracticeExams.find(item => item.id === att.id);
    if (existing) {
      setSelectedPracticeExams(prev => prev.filter(item => item.id !== att.id));
    } else {
      const d = new Date(att.createdAt || att.created_at || Date.now());
      const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
      const newItem: SelectedPracticeExamItem = {
        id: att.id,
        title: att.examTitle || att.quizTitle || att.quiz_title || att.title || "Đề luyện thi thực chiến",
        category: att.category || "Luyện đề",
        completedDate: dateStr,
        score: att.score ?? att.points ?? "--",
        durationText: att.timeSpent || att.time_spent || ""
      };
      setSelectedPracticeExams(prev => [...prev, newItem]);
    }
  };

  const handleRemovePracticeItem = (id: string) => {
    setSelectedPracticeExams(prev => prev.filter(item => item.id !== id));
  };

  // HÀM VẼ CANVAS NATIVE GỒM BẢNG 4 TUẦN + BẢNG ĐỘNG CÁC ĐỀ LUYỆN THI
  const generateNativeCanvasImage = (): string | null => {
    const canvas = document.createElement("canvas");
    const width = 1200;
    const padding = 50;
    const contentWidth = width - padding * 2;

    const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

    const testCanvas = document.createElement("canvas");
    const testCtx = testCanvas.getContext("2d");
    if (!testCtx) return null;

    testCtx.font = "normal 18px " + FONT_FAMILY;

    const evalMaxWidth = contentWidth - 50;
    const paragraphs = (currentReport.evaluation || "Chưa có nhận xét.").split("\n");
    const wrappedLines: { text: string; isHeader: boolean }[] = [];

    paragraphs.forEach(para => {
      const trimmed = para.trim();
      if (!trimmed) {
        wrappedLines.push({ text: "", isHeader: false });
        return;
      }

      const isHeader = trimmed.startsWith("-") || trimmed.startsWith("1.") || trimmed.startsWith("2.") || trimmed.startsWith("3.");
      const words = trimmed.split(" ");
      let currentLine = "";

      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine ? currentLine + " " + words[i] : words[i];
        const testWidth = testCtx.measureText(testLine).width;

        if (testWidth > evalMaxWidth && currentLine) {
          wrappedLines.push({ text: currentLine, isHeader: isHeader && wrappedLines.length === 0 });
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        wrappedLines.push({ text: currentLine, isHeader: isHeader && wrappedLines.length === 0 });
      }
    });

    const boxH = Math.max(200, wrappedLines.length * 30 + 50);
    const practiceTableH = currentReport.practiceItems.length > 0 ? (currentReport.practiceItems.length * 38 + 50) : 60;
    const approxHeight = 720 + practiceTableH + boxH;

    canvas.width = width;
    canvas.height = approxHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Nền trắng tinh khiết
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, approxHeight);

    // Bo viền khung chính
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.strokeRect(15, 15, width - 30, approxHeight - 30);

    // 1. BANNER HEADER
    ctx.fillStyle = "#eff6ff";
    ctx.fillRect(padding, padding, contentWidth, 120);
    ctx.strokeStyle = "#bfdbfe";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(padding, padding, contentWidth, 120);

    ctx.fillStyle = "#1d4ed8";
    ctx.font = "bold 14px " + FONT_FAMILY;
    ctx.fillText("PHIẾU BÁO CÁO KẾT QUẢ HỌC TẬP", padding + 25, padding + 35);

    ctx.fillStyle = "#0f172a";
    ctx.font = "900 30px " + FONT_FAMILY;
    ctx.fillText(currentReport.fullName, padding + 25, padding + 75);

    ctx.fillStyle = "#475569";
    ctx.font = "600 16px " + FONT_FAMILY;
    ctx.fillText(currentReport.school + " • " + currentReport.grade, padding + 25, padding + 105);

    ctx.fillStyle = "#2563eb";
    ctx.fillRect(width - padding - 210, padding + 25, 185, 38);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 16px " + FONT_FAMILY;
    ctx.textAlign = "center";
    ctx.fillText(currentReport.timeframeText.toUpperCase(), width - padding - 210 + 92, padding + 50);

    ctx.fillStyle = "#334155";
    ctx.font = "bold 16px " + FONT_FAMILY;
    ctx.textAlign = "right";
    ctx.fillText("Đã hoàn thành: " + currentReport.total + " bài", width - padding - 25, padding + 95);
    ctx.textAlign = "left";

    // 2. BỐN KHỐI ĐIỂM SỐ CÂN ĐỐI
    const cardY = padding + 145;
    const cardW = (contentWidth - 45) / 4;
    const cardH = 100;

    // Khối 1: Tổng bài
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(padding, cardY, cardW, cardH);
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(padding, cardY, cardW, cardH);
    ctx.fillStyle = "#64748b";
    ctx.font = "bold 12px " + FONT_FAMILY;
    ctx.fillText("TỔNG BÀI NỘP", padding + 18, cardY + 30);
    ctx.fillStyle = "#0f172a";
    ctx.font = "900 28px " + FONT_FAMILY;
    ctx.fillText(currentReport.total + " bài", padding + 18, cardY + 72);

    // Khối 2: Đ.TB BTVN
    ctx.fillStyle = "#ecfdf5";
    ctx.fillRect(padding + cardW + 15, cardY, cardW, cardH);
    ctx.strokeStyle = "#a7f3d0";
    ctx.strokeRect(padding + cardW + 15, cardY, cardW, cardH);
    ctx.fillStyle = "#065f46";
    ctx.font = "bold 12px " + FONT_FAMILY;
    ctx.fillText("Đ.TB BTVN", padding + cardW + 33, cardY + 30);
    ctx.fillStyle = "#047857";
    ctx.font = "900 28px " + FONT_FAMILY;
    ctx.fillText(currentReport.hwAvg + " / 10", padding + cardW + 33, cardY + 72);

    // Khối 3: Đ.TB Kiểm tra
    ctx.fillStyle = "#eef2ff";
    ctx.fillRect(padding + (cardW + 15) * 2, cardY, cardW, cardH);
    ctx.strokeStyle = "#c7d2fe";
    ctx.strokeRect(padding + (cardW + 15) * 2, cardY, cardW, cardH);
    ctx.fillStyle = "#3730a3";
    ctx.font = "bold 12px " + FONT_FAMILY;
    ctx.fillText("Đ.TB KIỂM TRA", padding + (cardW + 15) * 2 + 18, cardY + 30);
    ctx.fillStyle = "#4338ca";
    ctx.font = "900 28px " + FONT_FAMILY;
    ctx.fillText(currentReport.testAvg + " / 10", padding + (cardW + 15) * 2 + 18, cardY + 72);

    // Khối 4: Đ.TB Luyện đề thực chiến
    ctx.fillStyle = "#eff6ff";
    ctx.fillRect(padding + (cardW + 15) * 3, cardY, cardW, cardH);
    ctx.strokeStyle = "#bfdbfe";
    ctx.strokeRect(padding + (cardW + 15) * 3, cardY, cardW, cardH);
    ctx.fillStyle = "#1e40af";
    ctx.font = "bold 12px " + FONT_FAMILY;
    ctx.fillText("Đ.TB LUYỆN ĐỀ", padding + (cardW + 15) * 3 + 18, cardY + 30);
    ctx.fillStyle = "#1d4ed8";
    ctx.font = "900 28px " + FONT_FAMILY;
    ctx.fillText(currentReport.practiceAvg + " / 10", padding + (cardW + 15) * 3 + 18, cardY + 72);

    // 3. BẢNG 4 TUẦN CHO BTVN VÀ KIỂM TRA ĐỊNH KỲ
    const tableY = cardY + 130;
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px " + FONT_FAMILY;
    ctx.fillText("1. BẢNG THEO DÕI ĐIỂM SỐ 4 TUẦN (BTVN & KIỂM TRA ĐỊNH KỲ)", padding, tableY);

    const tblTop = tableY + 15;
    const tblH = 120;
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(padding, tblTop, contentWidth, tblH);

    // Header table 4 tuần
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(padding, tblTop, contentWidth, 40);
    ctx.fillStyle = "#334155";
    ctx.font = "bold 15px " + FONT_FAMILY;
    ctx.fillText("Hạng mục điểm", padding + 20, tblTop + 26);
    ctx.fillText("T1." + currentReport.month, padding + 340, tblTop + 26);
    ctx.fillText("T2." + currentReport.month, padding + 490, tblTop + 26);
    ctx.fillText("T3." + currentReport.month, padding + 640, tblTop + 26);
    ctx.fillText("T4." + currentReport.month, padding + 790, tblTop + 26);
    ctx.fillText("Trung bình", padding + 940, tblTop + 26);

    // Hàng 1: BTVN
    ctx.fillStyle = "#0f172a";
    ctx.font = "600 15px " + FONT_FAMILY;
    ctx.fillText("Bài tập về nhà (BTVN)", padding + 20, tblTop + 68);
    ctx.fillStyle = "#047857";
    ctx.font = "bold 16px " + FONT_FAMILY;
    ctx.fillText(currentReport.hwScores[1] ? currentReport.hwScores[1] + " đ" : "--", padding + 340, tblTop + 68);
    ctx.fillText(currentReport.hwScores[2] ? currentReport.hwScores[2] + " đ" : "--", padding + 490, tblTop + 68);
    ctx.fillText(currentReport.hwScores[3] ? currentReport.hwScores[3] + " đ" : "--", padding + 640, tblTop + 68);
    ctx.fillText(currentReport.hwScores[4] ? currentReport.hwScores[4] + " đ" : "--", padding + 790, tblTop + 68);
    ctx.fillText(currentReport.hwAvg !== "--" ? currentReport.hwAvg + " / 10" : "--", padding + 940, tblTop + 68);

    // Kẻ ngang
    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(padding, tblTop + 80);
    ctx.lineTo(width - padding, tblTop + 80);
    ctx.stroke();

    // Hàng 2: Kiểm tra định kỳ
    ctx.fillStyle = "#0f172a";
    ctx.font = "600 15px " + FONT_FAMILY;
    ctx.fillText("Kiểm tra định kỳ", padding + 20, tblTop + 108);
    ctx.fillStyle = "#4338ca";
    ctx.font = "bold 16px " + FONT_FAMILY;
    ctx.fillText(currentReport.testScores[1] ? currentReport.testScores[1] + " đ" : "--", padding + 340, tblTop + 108);
    ctx.fillText(currentReport.testScores[2] ? currentReport.testScores[2] + " đ" : "--", padding + 490, tblTop + 108);
    ctx.fillText(currentReport.testScores[3] ? currentReport.testScores[3] + " đ" : "--", padding + 640, tblTop + 108);
    ctx.fillText(currentReport.testScores[4] ? currentReport.testScores[4] + " đ" : "--", padding + 790, tblTop + 108);
    ctx.fillText(currentReport.testAvg !== "--" ? currentReport.testAvg + " / 10" : "--", padding + 940, tblTop + 108);

    // 4. BẢNG ĐỘNG LUYỆN ĐỀ THỰC CHIẾN
    const pracSectionY = tblTop + tblH + 35;
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px " + FONT_FAMILY;
    ctx.fillText("2. BẢNG ĐIỂM LUYỆN ĐỀ THỰC CHIẾN (TÙY CHỌN GỬI PHỤ HUYNH)", padding, pracSectionY);

    const pracTableTop = pracSectionY + 15;
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(padding, pracTableTop, contentWidth, practiceTableH);

    ctx.fillStyle = "#eff6ff";
    ctx.fillRect(padding, pracTableTop, contentWidth, 40);
    ctx.fillStyle = "#1e40af";
    ctx.font = "bold 14px " + FONT_FAMILY;
    ctx.fillText("STT", padding + 15, pracTableTop + 25);
    ctx.fillText("Tên đề thi", padding + 65, pracTableTop + 25);
    ctx.fillText("Phân loại", padding + 580, pracTableTop + 25);
    ctx.fillText("Ngày nộp", padding + 790, pracTableTop + 25);
    ctx.fillText("Điểm số", padding + 960, pracTableTop + 25);

    let curPracY = pracTableTop + 40;
    if (currentReport.practiceItems.length === 0) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "normal 14px " + FONT_FAMILY;
      ctx.fillText("Chưa chọn đề luyện thi nào vào báo cáo tháng này.", padding + 20, curPracY + 25);
      curPracY += 35;
    } else {
      currentReport.practiceItems.forEach((item, pIdx) => {
        ctx.fillStyle = pIdx % 2 === 0 ? "#ffffff" : "#f8fafc";
        ctx.fillRect(padding, curPracY, contentWidth, 38);

        ctx.strokeStyle = "#f1f5f9";
        ctx.strokeRect(padding, curPracY, contentWidth, 38);

        ctx.fillStyle = "#64748b";
        ctx.font = "bold 14px " + FONT_FAMILY;
        ctx.fillText(String(pIdx + 1), padding + 18, curPracY + 24);

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 14px " + FONT_FAMILY;
        ctx.fillText(item.title, padding + 65, curPracY + 24);

        ctx.fillStyle = "#2563eb";
        ctx.font = "bold 13px " + FONT_FAMILY;
        ctx.fillText(item.category || "Luyện đề", padding + 580, curPracY + 24);

        ctx.fillStyle = "#475569";
        ctx.font = "normal 14px " + FONT_FAMILY;
        ctx.fillText(item.completedDate, padding + 790, curPracY + 24);

        ctx.fillStyle = "#1d4ed8";
        ctx.font = "bold 15px " + FONT_FAMILY;
        ctx.fillText(`${item.score} / 10`, padding + 960, curPracY + 24);

        curPracY += 38;
      });
    }

    // 5. NHẬN XÉT CHI TIẾT
    const evalY = pracTableTop + practiceTableH + 35;
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px " + FONT_FAMILY;
    ctx.fillText("3. NHẬN XÉT CHI TIẾT TỪ GIÁO VIÊN PHỤ TRÁCH", padding, evalY);

    const boxY = evalY + 15;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(padding, boxY, contentWidth, boxH);
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(padding, boxY, contentWidth, boxH);

    let curY = boxY + 36;
    wrappedLines.forEach(lineObj => {
      if (!lineObj.text) {
        curY += 14;
        return;
      }
      if (lineObj.isHeader) {
        ctx.font = "bold 16px " + FONT_FAMILY;
        ctx.fillStyle = "#0f172a";
      } else {
        ctx.font = "normal 16px " + FONT_FAMILY;
        ctx.fillStyle = "#334155";
      }
      ctx.fillText(lineObj.text, padding + 25, curY);
      curY += 28;
    });

    return canvas.toDataURL("image/png");
  };

  const handleExportPNG = (previewOnly = false) => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        const pngUrl = generateNativeCanvasImage();
        if (pngUrl) {
          setRenderedImageUrl(pngUrl);
          if (!previewOnly) {
            const cleanName = currentReport.fullName.replace(/\s+/g, "_") || "Bao_Cao";
            const downloadLink = document.createElement("a");
            downloadLink.download = "Bao_Cao_" + cleanName + "_" + currentReport.timeframeText.replace("/", "") + ".png";
            downloadLink.href = pngUrl;
            downloadLink.click();
          }
        }
      } catch (e) {
        console.error("Lỗi xuất ảnh:", e);
      } finally {
        setIsExporting(false);
      }
    }, 80);
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
      "* Chi tiết BTVN 4 tuần:\n" +
      "  [T1." + m + ": " + (currentReport.hwScores[1] || "--") + "] | [T2." + m + ": " + (currentReport.hwScores[2] || "--") + "] | [T3." + m + ": " + (currentReport.hwScores[3] || "--") + "] | [T4." + m + ": " + (currentReport.hwScores[4] || "--") + "]\n\n" +
      "* Chi tiết Kiểm tra định kỳ 4 tuần:\n" +
      "  [T1." + m + ": " + (currentReport.testScores[1] || "--") + "] | [T2." + m + ": " + (currentReport.testScores[2] || "--") + "] | [T3." + m + ": " + (currentReport.testScores[3] || "--") + "] | [T4." + m + ": " + (currentReport.testScores[4] || "--") + "]\n\n" +
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

  // Lọc danh sách đề thi trong Modal Picker theo tháng
  const filteredModalPracticeAttempts = useMemo(() => {
    if (practiceMonthFilter === "all") return studentPracticeAttempts;
    const targetM = Number(practiceMonthFilter);
    return studentPracticeAttempts.filter(a => {
      const d = new Date(a.createdAt || a.created_at || Date.now());
      return d.getMonth() + 1 === targetM;
    });
  }, [studentPracticeAttempts, practiceMonthFilter]);

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
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-blue-700 outline-none"
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

                {/* 1. BẢNG 4 TUẦN NGUYÊN BẢN (CHỈ DÀNH CHO BTVN VÀ KIỂM TRA ĐỊNH KỲ) */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#1D4ED8]" /> 1. Bảng theo dõi điểm số 4 tuần (BTVN & Kiểm tra định kỳ)
                  </h4>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-center text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                          <th className="py-2.5 px-3 text-left w-48">Hạng mục điểm</th>
                          <th className="py-2.5 px-2">T1.{reportMonth}</th>
                          <th className="py-2.5 px-2">T2.{reportMonth}</th>
                          <th className="py-2.5 px-2">T3.{reportMonth}</th>
                          <th className="py-2.5 px-2">T4.{reportMonth}</th>
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
                          <td className="py-2.5 px-3 text-right font-black text-emerald-700">{autoData.hwAvg}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 text-left font-bold text-slate-800">Kiểm tra định kỳ</td>
                          <td className="py-2.5 px-2 text-indigo-700 font-black">{autoData.testByWeek[1] || "--"}</td>
                          <td className="py-2.5 px-2 text-indigo-700 font-black">{autoData.testByWeek[2] || "--"}</td>
                          <td className="py-2.5 px-2 text-indigo-700 font-black">{autoData.testByWeek[3] || "--"}</td>
                          <td className="py-2.5 px-2 text-indigo-700 font-black">{autoData.testByWeek[4] || "--"}</td>
                          <td className="py-2.5 px-3 text-right font-black text-indigo-700">{autoData.testAvg}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2. BẢNG ĐỘNG TÁCH BIỆT: LUYỆN ĐỀ THỰC CHIẾN TÙY CHỌN */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-blue-900 tracking-wider flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-[#1D4ED8]" /> Bảng điểm Luyện đề Thực chiến (Tùy chọn gửi Phụ huynh)
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowPracticePickerModal(true)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] rounded-xl text-xs font-black transition flex items-center gap-1 border border-blue-200 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3.5 h-3.5" /> Chọn đề đưa vào báo cáo
                    </button>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase">
                          <th className="py-2.5 px-3 text-center w-12">STT</th>
                          <th className="py-2.5 px-4 min-w-[200px]">Tên đề thi</th>
                          <th className="py-2.5 px-3">Phân loại</th>
                          <th className="py-2.5 px-3 text-center">Ngày hoàn thành</th>
                          <th className="py-2.5 px-3 text-center">Điểm số</th>
                          <th className="py-2.5 px-3 text-center w-16">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {selectedPracticeExams.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                              Chưa có đề luyện thi nào được chọn. Bấm nút <strong>"+ Chọn đề đưa vào báo cáo"</strong> để thêm đề.
                            </td>
                          </tr>
                        ) : (
                          selectedPracticeExams.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-2.5 px-4 font-bold text-slate-800">{item.title}</td>
                              <td className="py-2.5 px-3">
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                                  {item.category || "Luyện đề"}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-500 font-medium">{item.completedDate}</td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="font-black text-sm text-[#1D4ED8] bg-blue-50/70 px-2.5 py-0.5 rounded-lg border border-blue-200">
                                  {item.score} / 10
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
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
        /* CHẾ ĐỘ 2: TỰ TẠO THỦ CÔNG */
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-emerald-600" /> Điền thông tin đánh giá học viên mới
            </h4>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Bản soạn thảo điền trước
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

          {/* BẢNG 4 TUẦN THỦ CÔNG (BTVN VÀ KIỂM TRA ĐỊNH KỲ) */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="font-black text-xs text-slate-800">
                1. Bảng điểm theo tuần (Nhập điểm hoặc để trống nếu chưa có)
              </span>
              <span className="text-[11px] text-slate-500 font-semibold">
                Đ.TB tính tự động: BTVN ({manualStats.hwAvg}) • KT ({manualStats.testAvg})
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
                  <th className="py-2.5 px-3 text-right">Đ.TB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                <tr>
                  <td className="py-2 px-3 text-left font-bold text-slate-800">BTVN</td>
                  {[1, 2, 3, 4].map(w => (
                    <td key={w} className="py-1.5 px-2">
                      <input
                        type="text"
                        value={manualHWScores[w] || ""}
                        onChange={e => setManualHWScores({ ...manualHWScores, [w]: e.target.value })}
                        placeholder="--"
                        className="w-14 py-1 text-center font-black text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 outline-none"
                      />
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-black text-emerald-700">{manualStats.hwAvg}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 text-left font-bold text-slate-800">Kiểm tra định kỳ</td>
                  {[1, 2, 3, 4].map(w => (
                    <td key={w} className="py-1.5 px-2">
                      <input
                        type="text"
                        value={manualTestScores[w] || ""}
                        onChange={e => setManualTestScores({ ...manualTestScores, [w]: e.target.value })}
                        placeholder="--"
                        className="w-14 py-1 text-center font-black text-indigo-700 bg-indigo-50 rounded-lg border border-indigo-200 outline-none"
                      />
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right font-black text-indigo-700">{manualStats.testAvg}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* BẢNG ĐỘNG LUYỆN ĐỀ (CHẾ ĐỘ THỦ CÔNG) */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-blue-900 tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-[#1D4ED8]" /> 2. Bảng điểm Luyện đề Thực chiến (Tùy chọn)
              </h4>
              <button
                type="button"
                onClick={() => setShowPracticePickerModal(true)}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] rounded-xl text-xs font-black transition flex items-center gap-1 border border-blue-200 cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" /> Chọn đề đưa vào báo cáo
              </button>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/40">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase">
                    <th className="py-2.5 px-3 text-center w-12">STT</th>
                    <th className="py-2.5 px-4 min-w-[200px]">Tên đề thi</th>
                    <th className="py-2.5 px-3">Phân loại</th>
                    <th className="py-2.5 px-3 text-center">Ngày hoàn thành</th>
                    <th className="py-2.5 px-3 text-center">Điểm số</th>
                    <th className="py-2.5 px-3 text-center w-16">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {selectedPracticeExams.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                        Chưa có đề luyện thi nào. Bấm <strong>"+ Chọn đề đưa vào báo cáo"</strong> để thêm.
                      </td>
                    </tr>
                  ) : (
                    selectedPracticeExams.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-800">{item.title}</td>
                        <td className="py-2.5 px-3">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                            {item.category || "Luyện đề"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-500 font-medium">{item.completedDate}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-black text-sm text-[#1D4ED8] bg-blue-50/70 px-2.5 py-0.5 rounded-lg border border-blue-200">
                            {item.score} / 10
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemovePracticeItem(item.id)}
                            className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
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
      {/* MODAL / DRAWER CHỌN ĐỀ THI ĐƯA VÀO BÁO CÁO */}
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

            {/* DANH SÁCH CÁC ĐỀ THI ĐÃ NỘP */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {filteredModalPracticeAttempts.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  Không tìm thấy bài làm nào trong bộ lọc này.
                </div>
              ) : (
                filteredModalPracticeAttempts.map(att => {
                  const isSelected = selectedPracticeExams.some(item => item.id === att.id);
                  const d = new Date(att.createdAt || att.created_at || Date.now());
                  const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
                  const title = att.examTitle || att.quizTitle || att.quiz_title || att.title || "Đề luyện thi thực chiến";
                  const score = att.score ?? att.points ?? "--";

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

                      <div className="text-right shrink-0 ml-3">
                        <span className="font-black text-sm text-[#1D4ED8] bg-white px-2.5 py-1 rounded-xl border border-blue-200 shadow-2xs">
                          {score} / 10
                        </span>
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
      {/* MODAL BẢN CHÍNH THỨC: XUẤT ẢNH PNG / IN ẤN CÓ CẢ BẢNG 4 TUẦN VÀ BẢNG ĐỘNG */}
      {/* ========================================================================= */}
      {showOfficialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-4xl max-h-[96vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-6 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                  Bản báo cáo chính thức gửi Quý Phụ huynh
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExportPNG(false)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting ? "Đang xuất..." : "Tải ảnh về máy (.PNG)"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPNG(true)}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Xem ảnh toàn cảnh
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> In / PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOfficialModal(false);
                    setRenderedImageUrl(null);
                  }}
                  className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar bg-slate-100 flex justify-center">
              <div 
                ref={reportCardRef}
                className="w-full max-w-3xl bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/90 shadow-sm space-y-4 text-slate-800"
              >
                {/* 1. HEADER */}
                <div className="p-4 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-white rounded-2xl border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#1D4ED8] block">
                      Phiếu báo cáo kết quả học tập
                    </span>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
                      {currentReport.fullName}
                    </h2>
                    <p className="text-xs text-slate-600 font-semibold mt-0.5">
                      {currentReport.school} • {currentReport.grade}
                    </p>
                  </div>

                  <div className="sm:text-right flex sm:flex-col items-center sm:items-end justify-between gap-1 border-t sm:border-t-0 pt-2 sm:pt-0 border-blue-200/60">
                    <span className="px-3 py-1 bg-blue-600 text-white text-[11px] font-black rounded-lg shadow-xs uppercase tracking-wider">
                      {currentReport.timeframeText}
                    </span>
                    <span className="text-xs font-black text-slate-700 mt-1 block">
                      Đã hoàn thành: <strong className="text-[#1D4ED8]">{currentReport.total} bài</strong>
                    </span>
                  </div>
                </div>

                {/* 2. 4 THẺ ĐIỂM SỐ NỔI BẬT */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tổng bài nộp</span>
                    <span className="text-xl font-black text-slate-900 mt-0.5 block">{currentReport.total} bài</span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Đ.TB BTVN</span>
                    <span className="text-xl font-black text-emerald-700 mt-0.5 block">{currentReport.hwAvg} / 10</span>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200 text-center">
                    <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Đ.TB Kiểm tra</span>
                    <span className="text-xl font-black text-indigo-700 mt-0.5 block">{currentReport.testAvg} / 10</span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200 text-center">
                    <span className="text-[10px] font-bold text-[#1D4ED8] uppercase tracking-wider block">Đ.TB Luyện đề</span>
                    <span className="text-xl font-black text-[#1D4ED8] mt-0.5 block">{currentReport.practiceAvg} / 10</span>
                  </div>
                </div>

                {/* 3. BẢNG ĐIỂM 4 TUẦN (BTVN & KIỂM TRA ĐỊNH KỲ) */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#1D4ED8]" /> 1. Bảng theo dõi điểm số 4 tuần (BTVN & Kiểm tra định kỳ)
                  </h4>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-center text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                          <th className="py-2.5 px-4 text-left w-48">Hạng mục</th>
                          <th className="py-2.5 px-3">T1.{currentReport.month}</th>
                          <th className="py-2.5 px-3">T2.{currentReport.month}</th>
                          <th className="py-2.5 px-3">T3.{currentReport.month}</th>
                          <th className="py-2.5 px-3">T4.{currentReport.month}</th>
                          <th className="py-2.5 px-4 text-right">Trung bình</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white font-semibold">
                        <tr>
                          <td className="py-2.5 px-4 text-left font-bold text-slate-800">Bài tập về nhà (BTVN)</td>
                          <td className="py-2.5 px-3 text-emerald-700 font-black">{currentReport.hwScores[1] ? (currentReport.hwScores[1] + " đ") : "--"}</td>
                          <td className="py-2.5 px-3 text-emerald-700 font-black">{currentReport.hwScores[2] ? (currentReport.hwScores[2] + " đ") : "--"}</td>
                          <td className="py-2.5 px-3 text-emerald-700 font-black">{currentReport.hwScores[3] ? (currentReport.hwScores[3] + " đ") : "--"}</td>
                          <td className="py-2.5 px-3 text-emerald-700 font-black">{currentReport.hwScores[4] ? (currentReport.hwScores[4] + " đ") : "--"}</td>
                          <td className="py-2.5 px-4 text-right font-black text-emerald-700">{currentReport.hwAvg !== "--" ? (currentReport.hwAvg + " / 10") : "--"}</td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-4 text-left font-bold text-slate-800">Kiểm tra định kỳ</td>
                          <td className="py-2.5 px-3 text-indigo-700 font-black">{currentReport.testScores[1] ? (currentReport.testScores[1] + " đ") : "--"}</td>
                          <td className="py-2.5 px-3 text-indigo-700 font-black">{currentReport.testScores[2] ? (currentReport.testScores[2] + " đ") : "--"}</td>
                          <td className="py-2.5 px-3 text-indigo-700 font-black">{currentReport.testScores[3] ? (currentReport.testScores[3] + " đ") : "--"}</td>
                          <td className="py-2.5 px-3 text-indigo-700 font-black">{currentReport.testScores[4] ? (currentReport.testScores[4] + " đ") : "--"}</td>
                          <td className="py-2.5 px-4 text-right font-black text-indigo-700">{currentReport.testAvg !== "--" ? (currentReport.testAvg + " / 10") : "--"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. BẢNG ĐỘNG LUYỆN ĐỀ THỰC CHIẾN GỬI PHỤ HUYNH */}
                <div className="space-y-1.5 pt-1">
                  <h4 className="text-xs font-black uppercase text-blue-900 tracking-wider flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-[#1D4ED8]" /> 2. Bảng điểm Luyện đề Thực chiến (Tùy chọn gửi Phụ huynh)
                  </h4>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-blue-50/70 border-b border-blue-200 text-blue-900 font-bold">
                          <th className="py-2 px-3 text-center w-12">STT</th>
                          <th className="py-2 px-4">Tên đề thi</th>
                          <th className="py-2 px-3">Phân loại</th>
                          <th className="py-2 px-3 text-center">Ngày nộp</th>
                          <th className="py-2 px-3 text-right">Điểm số</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white font-semibold">
                        {currentReport.practiceItems.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                              Chưa có đề luyện thi nào được chọn vào báo cáo.
                            </td>
                          </tr>
                        ) : (
                          currentReport.practiceItems.map((item, pIdx) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 text-center font-bold text-slate-400">{pIdx + 1}</td>
                              <td className="py-2 px-4 font-bold text-slate-800">{item.title}</td>
                              <td className="py-2 px-3">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                                  {item.category || "Luyện đề"}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center text-slate-500 font-medium">{item.completedDate}</td>
                              <td className="py-2 px-3 text-right font-black text-[#1D4ED8]">{item.score} / 10</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 5. NHẬN XÉT CHI TIẾT */}
                <div className="space-y-1.5 pt-1">
                  <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> 3. Nhận xét chi tiết từ Giáo viên phụ trách
                  </h4>
                  <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line font-medium break-words">
                    {currentReport.evaluation || "Chưa có nhận xét."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP XEM TOÀN CẢNH ẢNH */}
      {renderedImageUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in zoom-in-95">
          <div className="relative max-w-4xl max-h-[92vh] flex flex-col items-center">
            <div className="absolute top-3 right-3 flex items-center gap-2 z-10">
              <a
                href={renderedImageUrl}
                download={"Bao_Cao_" + currentReport.fullName.replace(/\s+/g, "_") + ".png"}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <Download className="w-4 h-4" /> Tải về máy (.PNG)
              </a>
              <button
                type="button"
                onClick={() => setRenderedImageUrl(null)}
                className="p-2 bg-black/60 hover:bg-black text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img 
              src={renderedImageUrl} 
              alt="Bản báo cáo học tập chính thức" 
              className="rounded-2xl shadow-2xl max-h-[85vh] object-contain border border-white/20 bg-white" 
            />
          </div>
        </div>
      )}
    </div>
  );
}
