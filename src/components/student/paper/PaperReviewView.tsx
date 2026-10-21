"use client";

import React, { useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Printer,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  FileText,
  Award,
  Eye
} from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { ExamAttempt, OMRBubbleCoordinate, Profile } from "@/types";
import {
  OMR_CANONICAL_WIDTH,
  OMR_CANONICAL_HEIGHT,
  gradeOMRSubmission
} from "@/lib/omrEngine";

export interface PaperReviewViewProps {
  attempt: ExamAttempt;
  exam: any;
  profile?: Profile | null;
  onBack: () => void;
}

function sanitizeLatexForPaperReview(tex: string): string {
  if (!tex) return "";
  return String(tex)
    .replace(/\\in\s+fty/gi, "\\infty")
    .replace(/\\inftyminus/gi, "\\infty -")
    .replace(/\\inftyplus/gi, "\\infty +")
    .replace(
      /(\\infty|\\cup|\\cap|\\notin|\\subseteq|\\subset(?![a-zA-Z])|\\in(?![a-zA-Z])|\\forall|\\exists|\\rightarrow|\\Rightarrow|\\Leftrightarrow)([a-zA-Z])/g,
      "$1 $2"
    );
}

function PaperMathContent({ content }: { content?: string }) {
  const html = useMemo(() => {
    if (!content) return "";
    let str = sanitizeLatexForPaperReview(String(content));
    str = str.replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => "$$" + m + "$$");
    str = str.replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => "$" + m + "$");

    str = str.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return `$$${tex}$$`;
      }
    });

    str = str.replace(/\$([^$\n]+?)\$/g, (m, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return m;
      }
    });

    if (!/<(p|div|table|ul|ol|br|img)/i.test(str)) {
      str = str.replace(/\n/g, "<br/>");
    }
    return str;
  }, [content]);

  if (!content) return null;
  return (
    <div
      className="leading-relaxed break-words text-xs sm:text-[13px] text-slate-800"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function PaperReviewView({
  attempt,
  exam,
  profile,
  onBack
}: PaperReviewViewProps) {
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [focusedQuestionOrder, setFocusedQuestionOrder] = useState<number | null>(null);
  const [partFilter, setPartFilter] = useState<"all" | 1 | 2 | 3>("all");

  const imageContainerRef = useRef<HTMLDivElement | null>(null);

  // Tái tính toán hoặc lấy dữ liệu OMR + kết quả chấm chi tiết
  const reviewSummary = useMemo(() => {
    const omrRaw = attempt?.omr_raw_data;
    if (omrRaw && exam) {
      return gradeOMRSubmission(omrRaw, exam);
    }
    return null;
  }, [attempt, exam]);

  // Trích xuất danh sách câu hỏi đầy đủ (bao gồm cả prompt và lời giải từ đề gốc)
  const enrichedQuestions = useMemo(() => {
    const rawSections =
      exam?.data || exam?.sections || (Array.isArray(exam?.questions) ? [{ questions: exam.questions }] : []);

    const flatExamQuestions: any[] = [];
    if (Array.isArray(rawSections)) {
      rawSections.forEach((sec: any) => {
        (sec?.questions || []).forEach((q: any) => {
          flatExamQuestions.push({
            ...q,
            sectionTitle: sec?.section_title || ""
          });
        });
      });
    }

    const details = reviewSummary?.questionDetails || [];
    return details.map((d, idx) => {
      const matchedQ = flatExamQuestions[idx] || {};
      return {
        ...d,
        prompt: matchedQ.prompt_html || matchedQ.prompt || matchedQ.text || `Câu hỏi số ${d.questionOrder}`,
        explanation:
          matchedQ.solution_html ||
          matchedQ.solution ||
          matchedQ.explanation ||
          "Đang cập nhật lời giải chi tiết.",
        options: Array.isArray(matchedQ.options) ? matchedQ.options : []
      };
    });
  }, [exam, reviewSummary]);

  const filteredQuestions = useMemo(() => {
    if (partFilter === "all") return enrichedQuestions;
    return enrichedQuestions.filter((q) => q.part === partFilter);
  }, [enrichedQuestions, partFilter]);

  const omrData = reviewSummary?.updatedOmrData || attempt?.omr_raw_data || null;
  const scanImageUrl =
    attempt?.paper_scan_url ||
    omrData?.warped_image_data_url ||
    "";

  const detectedSbd = omrData?.detected_sbd || "Chưa tô";
  const detectedCode = omrData?.detected_exam_code || "101";

  // Click vào 1 câu hỏi bên phải -> tự động phóng to và cuộn tới đúng vùng ô tô bên trái
  const handleFocusQuestionOnSheet = (questionOrder: number, part: 1 | 2 | 3) => {
    setFocusedQuestionOrder(questionOrder);
    setZoomScale(1.65);

    if (!omrData || !imageContainerRef.current) return;
    let localNum = questionOrder;
    let targetSection: "part1" | "part2" | "part3" = "part1";
    if (part === 2) {
      targetSection = "part2";
      localNum = questionOrder - 40;
    } else if (part === 3) {
      targetSection = "part3";
      localNum = questionOrder - 48;
    }

    const targetBubble = omrData.bubble_coordinates.find(
      (b) => b.section === targetSection && b.questionNumber === localNum
    );

    if (targetBubble && imageContainerRef.current) {
      const container = imageContainerRef.current;
      const relY = targetBubble.y / (omrData.canonical_height || OMR_CANONICAL_HEIGHT);
      const relX = targetBubble.x / (omrData.canonical_width || OMR_CANONICAL_WIDTH);

      setTimeout(() => {
        container.scrollTo({
          top: Math.max(0, container.scrollHeight * relY - container.clientHeight / 2),
          left: Math.max(0, container.scrollWidth * relX - container.clientWidth / 2),
          behavior: "smooth"
        });
      }, 60);
    }
  };

  // Tải ảnh phiếu bài làm đã chấm (vẽ đè bounding box xanh/đỏ trực tiếp lên ảnh xuất ra)
  const handleDownloadAnnotatedSheet = () => {
    if (!scanImageUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = OMR_CANONICAL_WIDTH;
      canvas.height = OMR_CANONICAL_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, OMR_CANONICAL_WIDTH, OMR_CANONICAL_HEIGHT);

      (omrData?.bubble_coordinates || []).forEach((b: OMRBubbleCoordinate) => {
        if (b.status === "unfilled") return;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2);
        ctx.lineWidth = 2.5;

        if (b.status === "correct") {
          ctx.strokeStyle = "#10B981";
          ctx.fillStyle = "rgba(16, 185, 129, 0.22)";
          ctx.fill();
          ctx.stroke();
        } else if (b.status === "wrong") {
          ctx.strokeStyle = "#EF4444";
          ctx.fillStyle = "rgba(239, 68, 68, 0.22)";
          ctx.fill();
          ctx.stroke();
        } else if (b.status === "expected_missed") {
          ctx.setLineDash([4, 3]);
          ctx.strokeStyle = "#3B82F6";
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (b.status === "ambiguous") {
          ctx.strokeStyle = "#F59E0B";
          ctx.stroke();
        }
      });

      // Vẽ tem điểm số góc trên
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.fillRect(48, 95, 220, 68);
      ctx.strokeStyle = "#E11D48";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(48, 95, 220, 68);

      ctx.fillStyle = "#E11D48";
      ctx.font = "900 28px sans-serif";
      ctx.fillText(`ĐIỂM: ${Number(attempt.score ?? 0).toFixed(2)}`, 64, 140);

      const link = document.createElement("a");
      link.download = `Phieu_Cham_${(attempt.studentName || "HocSinh").replace(/\s+/g, "_")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = scanImageUrl;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[150] bg-[#F8FAFC] flex flex-col overflow-hidden font-sans text-left text-slate-800"
    >
      {/* 1. HEADER COMPACT */}
      <header className="h-15 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 shadow-2xs z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#1D4ED8] border border-blue-200 text-[10px] font-black uppercase">
                📄 Bài làm trên giấy
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                Mã đề: {detectedCode}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                SBD: {detectedSbd}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate mt-0.5">
              {exam?.title || attempt?.examTitle || "Chi tiết bài chấm OMR"}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadAnnotatedSheet}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tải ảnh bài chấm</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">In bài chấm</span>
          </button>
        </div>
      </header>

      {/* 2. LAYOUT CHIA 2 CỘT: CỘT TRÁI (ẢNH SCAN + BOUNDING BOX) & CỘT PHẢI (BẢNG ĐIỂM & LỜI GIẢI) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
        {/* CỘT TRÁI (6 CỘT): ẢNH PHIẾU BÀI LÀM GỐC KÈM BOUNDING BOX XANH / ĐỎ */}
        <div className="lg:col-span-6 border-r border-slate-200 bg-slate-900 flex flex-col min-h-0 relative">
          {/* THANH CÔNG CỤ ZOOM & CHÚ THÍCH MÀU */}
          <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 shrink-0">
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] inline-block" /> Tô đúng
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] inline-block" /> Tô sai
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-[#3B82F6] inline-block" /> Đáp án đúng
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] inline-block" /> Nghi ngờ
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoomScale((z) => Math.max(0.8, Number((z - 0.25).toFixed(2))))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1.5">{Math.round(zoomScale * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoomScale((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white cursor-pointer"
                title="Phóng to"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoomScale(1);
                  setFocusedQuestionOrder(null);
                }}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200 cursor-pointer"
              >
                100%
              </button>
            </div>
          </div>

          {/* KHUNG CUỘN ẢNH PHIẾU & SVG BOUNDING BOX */}
          <div
            ref={imageContainerRef}
            className="flex-1 overflow-auto p-4 custom-scrollbar flex items-start justify-center"
          >
            {scanImageUrl ? (
              <div
                style={{
                  width: `${Math.round(560 * zoomScale)}px`,
                  transition: "width 0.2s ease-out"
                }}
                className="relative rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-white shrink-0"
              >
                <img
                  src={scanImageUrl}
                  alt="Ảnh bài làm trên giấy"
                  className="w-full h-auto block select-none"
                />

                {omrData && (
                  <svg
                    viewBox={`0 0 ${omrData.canonical_width || OMR_CANONICAL_WIDTH} ${
                      omrData.canonical_height || OMR_CANONICAL_HEIGHT
                    }`}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  >
                    {omrData.bubble_coordinates
                      .filter((b) => b.status !== "unfilled")
                      .map((b) => {
                        let globalOrderOfBubble = b.questionNumber || 0;
                        if (b.section === "part2") globalOrderOfBubble = 40 + (b.questionNumber || 0);
                        if (b.section === "part3") globalOrderOfBubble = 48 + (b.questionNumber || 0);

                        const isFocused = focusedQuestionOrder === globalOrderOfBubble;

                        const strokeColor =
                          b.status === "correct"
                            ? "#10B981"
                            : b.status === "wrong"
                            ? "#EF4444"
                            : b.status === "expected_missed"
                            ? "#3B82F6"
                            : b.status === "ambiguous"
                            ? "#F59E0B"
                            : "#6366F1";

                        return (
                          <g key={b.id}>
                            {isFocused && (
                              <circle
                                cx={b.x}
                                cy={b.y}
                                r={b.r + 9}
                                fill="none"
                                stroke="#FACC15"
                                strokeWidth={3}
                              />
                            )}
                            <circle
                              cx={b.x}
                              cy={b.y}
                              r={b.r + 2.5}
                              fill={
                                b.status === "correct"
                                  ? "rgba(16, 185, 129, 0.24)"
                                  : b.status === "wrong"
                                  ? "rgba(239, 68, 68, 0.24)"
                                  : b.status === "ambiguous"
                                  ? "rgba(245, 158, 11, 0.24)"
                                  : "none"
                              }
                              stroke={strokeColor}
                              strokeWidth={2}
                              strokeDasharray={b.status === "expected_missed" ? "4 2" : undefined}
                            />
                          </g>
                        );
                      })}
                  </svg>
                )}
              </div>
            ) : (
              <div className="my-auto text-center text-slate-400 text-xs p-8">
                Không tìm thấy ảnh quét của lượt nộp này.
              </div>
            )}
          </div>
        </div>

        {/* CỘT PHẢI (6 CỘT): BẢNG ĐIỂM TỪNG PHẦN & LỜI GIẢI CHI TIẾT */}
        <div className="lg:col-span-6 flex flex-col min-h-0 bg-[#F8FAFC]">
          {/* KHỐI TỔNG HỢP ĐIỂM SỐ */}
          <div className="p-4 sm:p-5 bg-white border-b border-slate-200 space-y-3 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex flex-col items-center justify-center shadow-sm">
                  <span className="text-[9px] font-bold uppercase opacity-80">ĐIỂM SỐ</span>
                  <span className="text-xl font-black leading-none mt-0.5">
                    {Number(reviewSummary?.score ?? attempt.score ?? 0).toFixed(2)}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">
                    {attempt.studentName || profile?.full_name || "Học sinh"}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Đúng {reviewSummary?.correctCount ?? attempt.correctCount ?? 0} câu • Sai{" "}
                    {reviewSummary?.wrongCount ?? 0} câu • Trống {reviewSummary?.skippedCount ?? 0} câu
                  </p>
                </div>
              </div>

              {reviewSummary && (
                <div className="flex items-center gap-2 text-xs">
                  <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Phần I</span>
                    <span className="font-black text-slate-800">{reviewSummary.part1Score}đ</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Phần II</span>
                    <span className="font-black text-slate-800">{reviewSummary.part2Score}đ</span>
                  </div>
                  <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Phần III</span>
                    <span className="font-black text-slate-800">{reviewSummary.part3Score}đ</span>
                  </div>
                </div>
              )}
            </div>

            {/* BỘ LỌC PHẦN THI */}
            <div className="flex items-center gap-1.5 pt-1">
              {[
                { val: "all", label: `Tất cả (${enrichedQuestions.length})` },
                { val: 1, label: "Phần I: Trắc nghiệm" },
                { val: 2, label: "Phần II: Đúng / Sai" },
                { val: 3, label: "Phần III: Trả lời ngắn" }
              ].map((tab) => (
                <button
                  key={String(tab.val)}
                  type="button"
                  onClick={() => setPartFilter(tab.val as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    partFilter === tab.val
                      ? "bg-[#1D4ED8] text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* DANH SÁCH ĐỐI CHIẾU TỪNG CÂU & LỜI GIẢI KATEX */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar">
            {filteredQuestions.map((q) => {
              const isCorrect = q.status === "correct";
              const isWrong = q.status === "wrong" || q.status === "partial";
              const isFocused = focusedQuestionOrder === q.questionOrder;

              return (
                <div
                  key={q.questionOrder}
                  onClick={() => handleFocusQuestionOnSheet(q.questionOrder, q.part)}
                  className={`p-4 rounded-2xl border bg-white shadow-2xs transition cursor-pointer ${
                    isFocused
                      ? "ring-2 ring-[#1D4ED8] border-[#1D4ED8]"
                      : isCorrect
                      ? "border-emerald-200 hover:border-emerald-300"
                      : isWrong
                      ? "border-rose-200 hover:border-rose-300"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-[#1D4ED8] font-black text-xs border border-blue-200">
                        Câu {q.questionOrder}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">
                        Phần {q.part} • Định vị ô tô trên phiếu
                      </span>
                      {q.isFlagged && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Tô mờ/Tẩy xóa
                        </span>
                      )}
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                        isCorrect
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : q.status === "partial"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : isWrong
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {isCorrect
                        ? `✓ Chính xác (+${q.pointsEarned}đ)`
                        : q.status === "partial"
                        ? `Đúng một phần (+${q.pointsEarned}đ)`
                        : isWrong
                        ? "✕ Tô sai (0đ)"
                        : "○ Bỏ trống"}
                    </span>
                  </div>

                  <PaperMathContent content={q.prompt} />

                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-medium">Nhận diện trên giấy:</span>
                      <span
                        className={`px-2 py-0.5 rounded-md font-extrabold border ${
                          isCorrect
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : isWrong
                            ? "bg-rose-50 text-rose-700 border-rose-300"
                            : "bg-slate-100 text-slate-600 border-slate-300"
                        }`}
                      >
                        {q.studentAnswerDisplay}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-medium">Đáp án chuẩn:</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-extrabold">
                        {q.correctAnswerDisplay}
                      </span>
                    </div>
                  </div>

                  {q.explanation && (
                    <div className="mt-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1">
                      <div className="text-[11px] font-extrabold text-amber-800 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Lời giải chi tiết:
                      </div>
                      <PaperMathContent content={q.explanation} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default PaperReviewView;
