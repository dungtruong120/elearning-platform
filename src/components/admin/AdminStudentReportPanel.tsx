"use client";

import React, { useState, useMemo, useRef } from "react";
import { 
  User, Award, Copy, Printer, Sparkles, PlusCircle, 
  UserCheck, Check, Eye, X, Plus, Trash2, BookOpen, 
  Download, ImageIcon, Search, ChevronRight, ShieldCheck
} from "lucide-react";

interface Props {
  registeredStudents: any[];
  allAttempts: any[];
  chapters?: any[];
  practiceExams?: any[];
  attendanceRecords?: any[];
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

  const reportCardRef = useRef<HTMLDivElement>(null);

  // --- CHẾ ĐỘ TỰ ĐỘNG ---
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    registeredStudents[0]?.id || ""
  );
  const [searchStudent, setSearchStudent] = useState<string>("");
  const [reportMonth, setReportMonth] = useState<number>(9);
  const [autoTeacherEvaluation, setAutoTeacherEvaluation] = useState<string>(
    "- Chuyên cần & Thái độ: Con đi học đầy đủ và luôn đúng giờ. Trong giờ học, con ngoan, tập trung và có tinh thần tự giác tốt.\n\n" +
    "- Khả năng tiếp thu: Con nắm được các dạng toán cơ bản và hiểu bài ổn định. Tuy nhiên, ở một số dạng bài mới hoặc nâng cao, con vẫn còn phản xạ hơi chậm.\n\n" +
    "- Em đã tiến hành thu điện thoại của con trong giờ học và đề nghị con nghiêm túc chấp hành nội quy này.\n\n" +
    "- Kết quả kiểm tra tháng: Đạt 7,5/10. Con đã có tiến bộ, nhưng điểm số bị trừ ở các lỗi tính toán chưa cẩn thận và phần trình bày bài giải.\n\n" +
    "- Định hướng giai đoạn tới: Sắp tới kỳ thi giữa học kì 1, em mong gia đình cùng nhắc nhở con chăm chỉ làm đầy đủ bài tập về nhà hơn. Em cũng đã dặn con phần nào chưa hiểu hoặc gặp bài khó thì chủ động nhắn hỏi em ngay để được bổ trợ, giúp con tự tin và đạt kết quả tốt nhất trong bài thi sắp tới"
  );

  // --- CHẾ ĐỘ THỦ CÔNG ---
  const [manualForm, setManualForm] = useState({
    fullName: "Vương Ngọc Bảo Trung",
    school: "THPT Đống Đa",
    grade: "Lớp 12",
    reportMonth: 9,
    evaluation: 
      "- Chuyên cần & Thái độ: Con đi học đầy đủ và luôn đúng giờ. Trong giờ học, con ngoan, tập trung và có tinh thần tự giác tốt.\n\n" +
      "- Khả năng tiếp thu: Con nắm được các dạng toán cơ bản và hiểu bài ổn định. Tuy nhiên, ở một số dạng bài mới hoặc nâng cao, con vẫn còn phản xạ hơi chậm.\n\n" +
      "- Em đã tiến hành thu điện thoại của con trong giờ học và đề nghị con nghiêm túc chấp hành nội quy này.\n\n" +
      "- Kết quả kiểm tra tháng: Đạt 7,5/10. Con đã có tiến bộ, nhưng điểm số bị trừ ở các lỗi tính toán chưa cẩn thận và phần trình bày bài giải.\n\n" +
      "- Định hướng giai đoạn tới: Sắp tới kỳ thi giữa học kì 1, em mong gia đình cùng nhắc nhở con chăm chỉ làm đầy đủ bài tập về nhà hơn. Em cũng đã dặn con phần nào chưa hiểu hoặc gặp bài khó thì chủ động nhắn hỏi em ngay để được bổ trợ, giúp con tự tin và đạt kết quả tốt nhất trong bài thi sắp tới"
  });

  const [manualHWScores, setManualHWScores] = useState<{ [key: number]: string }>({
    1: "8",
    2: "8,5",
    3: "7,5",
    4: ""
  });

  const [manualTestScores, setManualTestScores] = useState<{ [key: number]: string }>({
    1: "7",
    2: "7,5",
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

  // Bóc tách điểm tự động
  const autoData = useMemo(() => {
    if (!currentStudent) {
      return { total: 0, hwAvg: "--", testAvg: "--", hwByWeek: { 1: "", 2: "", 3: "", 4: "" }, testByWeek: { 1: "", 2: "", 3: "", 4: "" } };
    }

    const studentAttempts = allAttempts.filter(att => att.studentId === currentStudent.id);
    const hwAttempts = studentAttempts.filter(a => a.type === "homework");
    const testAttempts = studentAttempts.filter(a => a.type !== "homework");

    const hwScores = hwAttempts.map(a => Number(a.score) || 0);
    const testScores = testAttempts.map(a => Number(a.score) || 0);

    const hwAvg = hwScores.length > 0 ? (hwScores.reduce((a, b) => a + b, 0) / hwScores.length).toFixed(1) : "--";
    const testAvg = testScores.length > 0 ? (testScores.reduce((a, b) => a + b, 0) / testScores.length).toFixed(1) : "--";

    const hwByWeek: { [key: number]: string } = { 1: "", 2: "", 3: "", 4: "" };
    hwAttempts.slice(0, 4).forEach((att, idx) => {
      hwByWeek[idx + 1] = att.score !== undefined && att.score !== null ? String(att.score) : "";
    });

    const testByWeek: { [key: number]: string } = { 1: "", 2: "", 3: "", 4: "" };
    testAttempts.slice(0, 4).forEach((att, idx) => {
      testByWeek[idx + 1] = att.score !== undefined && att.score !== null ? String(att.score) : "";
    });

    return {
      total: studentAttempts.length,
      hwAvg,
      testAvg,
      hwByWeek,
      testByWeek
    };
  }, [allAttempts, currentStudent]);

  // Tính điểm thủ công tự động
  const manualStats = useMemo(() => {
    const parseScore = (val: string) => Number(val.replace(",", "."));
    const validHw = Object.values(manualHWScores).filter(val => val && !isNaN(parseScore(val))).map(parseScore);
    const validTest = Object.values(manualTestScores).filter(val => val && !isNaN(parseScore(val))).map(parseScore);

    const hwAvg = validHw.length > 0 ? (validHw.reduce((a, b) => a + b, 0) / validHw.length).toFixed(1) : "--";
    const testAvg = validTest.length > 0 ? (validTest.reduce((a, b) => a + b, 0) / validTest.length).toFixed(1) : "--";

    return {
      total: validHw.length + validTest.length,
      hwAvg,
      testAvg
    };
  }, [manualHWScores, manualTestScores]);

  // Tổng hợp thông tin báo cáo
  const currentReport = useMemo(() => {
    if (reportMode === "auto") {
      const month = reportMonth;
      return {
        fullName: currentStudent?.full_name || "Chưa nhập họ tên",
        school: currentStudent?.school || "THPT",
        grade: currentStudent?.grade || "Lớp 12",
        month,
        timeframeText: "Tháng " + (month < 10 ? "0" + month : month) + "/2026",
        total: autoData.total,
        hwAvg: autoData.hwAvg,
        testAvg: autoData.testAvg,
        evaluation: autoTeacherEvaluation,
        hwScores: autoData.hwByWeek,
        testScores: autoData.testByWeek
      };
    } else {
      const month = manualForm.reportMonth;
      return {
        fullName: manualForm.fullName.trim() || "Chưa nhập họ tên",
        school: manualForm.school.trim() || "THPT",
        grade: manualForm.grade,
        month,
        timeframeText: "Tháng " + (month < 10 ? "0" + month : month) + "/2026",
        total: manualStats.total,
        hwAvg: manualStats.hwAvg,
        testAvg: manualStats.testAvg,
        evaluation: manualForm.evaluation,
        hwScores: manualHWScores,
        testScores: manualTestScores
      };
    }
  }, [reportMode, currentStudent, reportMonth, autoData, autoTeacherEvaluation, manualForm, manualStats, manualHWScores, manualTestScores]);

  // HÀM VẼ CANVAS NATIVE VỚI THUẬT TOÁN TỰ ĐỘNG XUỐNG DÒNG (WORD-WRAP) & FONT CHỮ CHUẨN
  const generateNativeCanvasImage = (): string | null => {
    const canvas = document.createElement("canvas");
    const width = 1200;
    const padding = 50;
    const contentWidth = width - padding * 2;

    // Font chuẩn Apple/Google hiện đại
    const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

    // Tạo canvas tạm để đo đạc chiều dài văn bản ngắt dòng
    const testCanvas = document.createElement("canvas");
    const testCtx = testCanvas.getContext("2d");
    if (!testCtx) return null;

    testCtx.font = "normal 18px " + FONT_FAMILY;

    // Thuật toán tách dòng (Word-Wrap) cho đoạn nhận xét
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

    const boxH = Math.max(220, wrappedLines.length * 30 + 50);
    const approxHeight = 650 + boxH;

    canvas.width = width;
    canvas.height = approxHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Nền trắng tinh khiết
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, approxHeight);

    // Bo viền khung chính thẩm mỹ
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

    // Tag Tháng bên phải
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

    // 2. BA KHỐI ĐIỂM SỐ
    const cardY = padding + 145;
    const cardW = (contentWidth - 40) / 3;
    const cardH = 105;

    // Khối 1: Tổng bài
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(padding, cardY, cardW, cardH);
    ctx.strokeStyle = "#e2e8f0";
    ctx.strokeRect(padding, cardY, cardW, cardH);
    ctx.fillStyle = "#64748b";
    ctx.font = "bold 13px " + FONT_FAMILY;
    ctx.fillText("TỔNG BÀI ĐÃ NỘP", padding + 25, cardY + 32);
    ctx.fillStyle = "#0f172a";
    ctx.font = "900 32px " + FONT_FAMILY;
    ctx.fillText(currentReport.total + " bài", padding + 25, cardY + 78);

    // Khối 2: Đ.TB BTVN
    ctx.fillStyle = "#ecfdf5";
    ctx.fillRect(padding + cardW + 20, cardY, cardW, cardH);
    ctx.strokeStyle = "#a7f3d0";
    ctx.strokeRect(padding + cardW + 20, cardY, cardW, cardH);
    ctx.fillStyle = "#065f46";
    ctx.font = "bold 13px " + FONT_FAMILY;
    ctx.fillText("Đ.TB BÀI TẬP VỀ NHÀ", padding + cardW + 45, cardY + 32);
    ctx.fillStyle = "#047857";
    ctx.font = "900 32px " + FONT_FAMILY;
    ctx.fillText(currentReport.hwAvg + " / 10", padding + cardW + 45, cardY + 78);

    // Khối 3: Đ.TB Kiểm tra
    ctx.fillStyle = "#eef2ff";
    ctx.fillRect(padding + (cardW + 20) * 2, cardY, cardW, cardH);
    ctx.strokeStyle = "#c7d2fe";
    ctx.strokeRect(padding + (cardW + 20) * 2, cardY, cardW, cardH);
    ctx.fillStyle = "#3730a3";
    ctx.font = "bold 13px " + FONT_FAMILY;
    ctx.fillText("Đ.TB KIỂM TRA ĐỊNH KỲ", padding + (cardW + 20) * 2 + 25, cardY + 32);
    ctx.fillStyle = "#4338ca";
    ctx.font = "900 32px " + FONT_FAMILY;
    ctx.fillText(currentReport.testAvg + " / 10", padding + (cardW + 20) * 2 + 25, cardY + 78);

    // 3. BẢNG ĐIỂM THEO TUẦN
    const tableY = cardY + 140;
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px " + FONT_FAMILY;
    ctx.fillText("1. BẢNG THEO DÕI ĐIỂM SỐ THEO TỪNG TUẦN", padding, tableY);

    const tblTop = tableY + 15;
    const tblH = 125;
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(padding, tblTop, contentWidth, tblH);

    // Header table
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(padding, tblTop, contentWidth, 42);
    ctx.fillStyle = "#334155";
    ctx.font = "bold 15px " + FONT_FAMILY;
    ctx.fillText("Hạng mục", padding + 20, tblTop + 27);
    ctx.fillText("T1." + currentReport.month, padding + 340, tblTop + 27);
    ctx.fillText("T2." + currentReport.month, padding + 490, tblTop + 27);
    ctx.fillText("T3." + currentReport.month, padding + 640, tblTop + 27);
    ctx.fillText("T4." + currentReport.month, padding + 790, tblTop + 27);
    ctx.fillText("Điểm trung bình", padding + 940, tblTop + 27);

    // Hàng BTVN
    ctx.fillStyle = "#0f172a";
    ctx.font = "600 15px " + FONT_FAMILY;
    ctx.fillText("Bài tập về nhà (BTVN)", padding + 20, tblTop + 70);
    ctx.fillStyle = "#047857";
    ctx.font = "bold 16px " + FONT_FAMILY;
    ctx.fillText(currentReport.hwScores[1] ? currentReport.hwScores[1] + " đ" : "--", padding + 340, tblTop + 70);
    ctx.fillText(currentReport.hwScores[2] ? currentReport.hwScores[2] + " đ" : "--", padding + 490, tblTop + 70);
    ctx.fillText(currentReport.hwScores[3] ? currentReport.hwScores[3] + " đ" : "--", padding + 640, tblTop + 70);
    ctx.fillText(currentReport.hwScores[4] ? currentReport.hwScores[4] + " đ" : "--", padding + 790, tblTop + 70);
    ctx.fillText(currentReport.hwAvg !== "--" ? currentReport.hwAvg + " / 10" : "--", padding + 940, tblTop + 70);

    // Kẻ ngang
    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(padding, tblTop + 84);
    ctx.lineTo(width - padding, tblTop + 84);
    ctx.stroke();

    // Hàng Kiểm tra
    ctx.fillStyle = "#0f172a";
    ctx.font = "600 15px " + FONT_FAMILY;
    ctx.fillText("Kiểm tra định kỳ", padding + 20, tblTop + 112);
    ctx.fillStyle = "#4338ca";
    ctx.font = "bold 16px " + FONT_FAMILY;
    ctx.fillText(currentReport.testScores[1] ? currentReport.testScores[1] + " đ" : "--", padding + 340, tblTop + 112);
    ctx.fillText(currentReport.testScores[2] ? currentReport.testScores[2] + " đ" : "--", padding + 490, tblTop + 112);
    ctx.fillText(currentReport.testScores[3] ? currentReport.testScores[3] + " đ" : "--", padding + 640, tblTop + 112);
    ctx.fillText(currentReport.testScores[4] ? currentReport.testScores[4] + " đ" : "--", padding + 790, tblTop + 112);
    ctx.fillText(currentReport.testAvg !== "--" ? currentReport.testAvg + " / 10" : "--", padding + 940, tblTop + 112);

    // 4. NHẬN XÉT CHI TIẾT (ĐÃ NGẮT DÒNG KHÔNG TRÀN CHỮ)
    const evalY = tblTop + tblH + 40;
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 16px " + FONT_FAMILY;
    ctx.fillText("2. NHẬN XÉT CHI TIẾT TỪ GIÁO VIÊN PHỤ TRÁCH", padding, evalY);

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
            downloadLink.download = "Bao_Cao_" + cleanName + "" + currentReport.timeframeText.replace("/", "") + ".png";
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
    const msg = 
      "[PHIẾU BÁO CÁO HỌC TẬP - DUNGTRUONG.TCT]\n" +
      "Kính gửi Phụ huynh em: " + currentReport.fullName + "\n" +
      "Trường: " + currentReport.school + " • " + currentReport.grade + "\n" +
      "Kỳ báo cáo: " + currentReport.timeframeText + "\n" +
      "------------------------------------\n" +
      "I. KẾT QUẢ ĐẠT ĐƯỢC:\n" +
      "- Tổng số bài đã nộp: " + currentReport.total + " bài\n" +
      "- Điểm trung bình BTVN: " + currentReport.hwAvg + " / 10\n" +
      "- Điểm trung bình Kiểm tra: " + currentReport.testAvg + " / 10\n\n" +
      "* Chi tiết điểm theo tuần:\n" +
      "  + Điểm BTVN: [T1." + m + ": " + (currentReport.hwScores[1] || "--") + "] | [T2." + m + ": " + (currentReport.hwScores[2] || "--") + "] | [T3." + m + ": " + (currentReport.hwScores[3] || "--") + "] | [T4." + m + ": " + (currentReport.hwScores[4] || "--") + "]\n" +
      "  + Điểm Kiểm tra: [T1." + m + ": " + (currentReport.testScores[1] || "--") + "] | [T2." + m + ": " + (currentReport.testScores[2] || "--") + "] | [T3." + m + ": " + (currentReport.testScores[3] || "--") + "] | [T4." + m + ": " + (currentReport.testScores[4] || "--") + "]\n\n" +
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
          <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col h-[680px]">
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

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tổng bài nộp</span>
                    <span className="text-lg font-black text-slate-900 mt-1 block">{autoData.total} bài</span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Đ.TB BTVN</span>
                    <span className="text-lg font-black text-emerald-700 mt-1 block">{autoData.hwAvg} / 10</span>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200 text-center">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Đ.TB Kiểm tra</span>
                    <span className="text-lg font-black text-indigo-700 mt-1 block">{autoData.testAvg} / 10</span>
                  </div>
                </div>

                {/* BẢNG ĐIỂM NGANG THEO TUẦN */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-center text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                        <th className="py-2.5 px-3 text-left w-36">Hạng mục điểm</th>
                        <th className="py-2.5 px-2">T1.{reportMonth}</th>
                        <th className="py-2.5 px-2">T2.{reportMonth}</th>
                        <th className="py-2.5 px-2">T3.{reportMonth}</th>
                        <th className="py-2.5 px-2">T4.{reportMonth}</th>
                        <th className="py-2.5 px-3 text-right">Trung bình</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold">
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
                placeholder="VD: Vương Ngọc Bảo Trung"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>
            <div>
              <label className="block mb-1">Trường học</label>
              <input
                type="text"
                value={manualForm.school}
                onChange={e => setManualForm({ ...manualForm, school: e.target.value })}
                placeholder="VD: THPT Đống Đa"
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

          {/* BẢNG ĐIỂM NGANG TỪNG TUẦN */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <span className="font-black text-xs text-slate-800">
                Bảng điểm theo tuần (Nhập điểm hoặc để trống nếu chưa có)
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
                  <td className="py-2 px-3 text-left font-bold text-slate-800">Kiểm tra</td>
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

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Nhận xét của Giáo viên (Hỗ trợ viết dài nhiều đoạn):
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
      {/* MODAL BẢN CHÍNH THỨC: XUẤT ẢNH PNG NATIVE 2X RETINA SẠCH 100% */}
      {/* ========================================================================= */}
      {showOfficialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-4xl max-h-[96vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            {/* Thanh công cụ ngoài */}
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
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> Xem ảnh toàn cảnh
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
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

            {/* KHUNG NỘI DUNG DUY NHẤT ĐƯỢC CHỤP RA ẢNH */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar bg-slate-100 flex justify-center">
              <div 
                ref={reportCardRef}
                className="w-full max-w-3xl bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/90 shadow-sm space-y-4 text-slate-800"
              >
                {/* 1. HEADER: TÊN HS, TRƯỜNG, TỔNG BÀI NỘP VÀ KỲ BÁO CÁO */}
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

                {/* 2. BA THẺ ĐIỂM SỐ NỔI BẬT */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tổng bài đã nộp</span>
                    <span className="text-xl font-black text-slate-900 mt-0.5 block">{currentReport.total} bài</span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Đ.TB Bài tập về nhà</span>
                    <span className="text-xl font-black text-emerald-700 mt-0.5 block">{currentReport.hwAvg} / 10</span>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200 text-center">
                    <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">Đ.TB Kiểm tra định kỳ</span>
                    <span className="text-xl font-black text-indigo-700 mt-0.5 block">{currentReport.testAvg} / 10</span>
                  </div>
                </div>

                {/* 3. BẢNG ĐIỂM THEO TỪNG TUẦN (T1.9, T2.9, T3.9, T4.9) */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#1D4ED8]" /> 1. Bảng theo dõi điểm số theo từng tuần
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
                          <th className="py-2.5 px-4 text-right">Điểm trung bình</th>
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

                {/* 4. NHẬN XÉT CHI TIẾT */}
                <div className="space-y-1.5 pt-1">
                  <h4 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> 2. Nhận xét chi tiết từ Giáo viên phụ trách
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

      {/* POPUP XEM TOÀN CẢNH ẢNH (LIGHTBOX) */}
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