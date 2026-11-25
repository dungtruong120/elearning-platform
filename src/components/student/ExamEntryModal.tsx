"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  FileText,
  Camera,
  Printer,
  PenTool,
  X,
  ArrowRight,
  Clock,
  Layers
} from "lucide-react";
import {
  extractExamQuestionCounts,
  openPrintableDynamicAnswerSheet
} from "@/lib/omrEngine";

export interface ExamEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: any;
  isHomework?: boolean;
  studentSbd?: string;
  studentName?: string;
  onSelectWeb: () => void;
  onSelectPaperScan: () => void;
  onSelectDigitalSheet: () => void;
}

export function ExamEntryModal({
  isOpen,
  onClose,
  exam,
  isHomework = false,
  studentSbd = "000001",
  studentName = "",
  onSelectWeb,
  onSelectPaperScan,
  onSelectDigitalSheet
}: ExamEntryModalProps) {
  const [selectedBranch, setSelectedBranch] = useState<"main" | "paper_options">("main");

  useEffect(() => {
    if (isOpen) {
      setSelectedBranch("main");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !exam) return null;

  const counts = extractExamQuestionCounts(exam);
  const examTitle = exam.title || "Bài kiểm tra / Luyện đề";
  const durationMinutes = isHomework ? 0 : exam.duration_minutes || exam.duration || 45;

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[500] bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 font-sans text-left cursor-pointer"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl max-w-xl w-full border border-slate-200/90 overflow-hidden cursor-default"
        >
          {/* HEADER TỐI GIẢN: TÊN ĐỀ + THỜI GIAN + SỐ CÂU + NÚT ĐÓNG */}
          <div className="px-5 py-4 bg-white border-b border-slate-200/90 flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {examTitle}
              </h3>
              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  {durationMinutes > 0 ? `${durationMinutes} phút` : "Tự do"}
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  {counts.totalCount} câu
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
              title="Đóng (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* BODY CHỌN HÌNH THỨC LÀM BÀI */}
          <div className="p-5 bg-[#F1F5F9]">
            {selectedBranch === "main" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* THẺ 1: LÀM TRỰC TIẾP TRÊN WEB */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectWeb();
                  }}
                  className="group p-4 rounded-xl bg-white border border-slate-200/90 hover:border-[#1D4ED8] transition text-left flex flex-col justify-between gap-4 cursor-pointer"
                >
                  <div className="space-y-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#1D4ED8] border border-blue-200 flex items-center justify-center group-hover:bg-[#1D4ED8] group-hover:text-white transition-colors">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <h5 className="font-bold text-slate-900 text-sm group-hover:text-[#1D4ED8]">
                        Làm trực tiếp trên Web
                      </h5>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Chấm điểm tự động và xem lời giải ngay sau khi nộp.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#1D4ED8]">
                    <span>Bắt đầu ngay</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>

                {/* THẺ 2: LÀM TRÊN PHIẾU TRẮC NGHIỆM */}
                <button
                  type="button"
                  onClick={() => setSelectedBranch("paper_options")}
                  className="group p-4 rounded-xl bg-white border border-slate-200/90 hover:border-[#1D4ED8] transition text-left flex flex-col justify-between gap-4 cursor-pointer"
                >
                  <div className="space-y-2.5">
                    <div className="w-9 h-9 rounded-lg bg-[#F8FAFC] text-[#1D4ED8] border border-slate-200/90 flex items-center justify-center group-hover:bg-[#1D4ED8] group-hover:text-white group-hover:border-[#1D4ED8] transition-colors">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <h5 className="font-bold text-slate-900 text-sm group-hover:text-[#1D4ED8]">
                        Làm trên Phiếu Trắc Nghiệm
                      </h5>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Tải phiếu A4 tô chì chấm OMR hoặc tô phiếu trực tuyến.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#1D4ED8]">
                    <span>Chọn cách nộp phiếu</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              </div>
            ) : (
              /* NHÁNH CON: TẢI PHIẾU A4 / CHỤP ẢNH OMR / TÔ PHIẾU ONLINE */
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    Làm trên Phiếu Trắc Nghiệm
                  </h4>
                  <button
                    type="button"
                    onClick={() => setSelectedBranch("main")}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/90 text-xs font-semibold transition cursor-pointer"
                  >
                    ← Quay lại
                  </button>
                </div>

                {/* BƯỚC 1: TẢI / IN PHIẾU A4 */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Printer className="w-3.5 h-3.5 text-[#1D4ED8]" />
                      <span>Phiếu trả lời A4 ({counts.totalCount} câu)</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Tự động điền SBD: <strong className="text-slate-700">{studentSbd}</strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      openPrintableDynamicAnswerSheet({
                        ...exam,
                        examTitle,
                        studentSbd,
                        studentName,
                        ...counts
                      })
                    }
                    className="px-3.5 py-2 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Tải / In Phiếu A4
                  </button>
                </div>

                {/* 2 NHÁNH NỘP PHIẾU */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectPaperScan();
                    }}
                    className="group p-4 rounded-xl bg-white border border-slate-200/90 hover:border-[#1D4ED8] transition text-left flex flex-col justify-between gap-3 cursor-pointer"
                  >
                    <div className="space-y-2">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#1D4ED8] border border-blue-200 flex items-center justify-center group-hover:bg-[#1D4ED8] group-hover:text-white transition-colors">
                        <Camera className="w-4 h-4" />
                      </div>
                      <h5 className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-[#1D4ED8]">
                        Chụp / Tải ảnh phiếu đã tô
                      </h5>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Quét phiếu giấy tô chì bằng AI OMR và chấm điểm ngay.
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#1D4ED8]">
                      <span>Mở máy quét</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectDigitalSheet();
                    }}
                    className="group p-4 rounded-xl bg-white border border-slate-200/90 hover:border-[#1D4ED8] transition text-left flex flex-col justify-between gap-3 cursor-pointer"
                  >
                    <div className="space-y-2">
                      <div className="w-9 h-9 rounded-lg bg-[#F8FAFC] text-[#1D4ED8] border border-slate-200/90 flex items-center justify-center group-hover:bg-[#1D4ED8] group-hover:text-white group-hover:border-[#1D4ED8] transition-colors">
                        <PenTool className="w-4 h-4" />
                      </div>
                      <h5 className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-[#1D4ED8]">
                        Tô phiếu Online trên màn hình
                      </h5>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Tô trực tiếp trên phiếu trắc nghiệm ảo và nộp tự động.
                      </p>
                    </div>
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-[#1D4ED8]">
                      <span>Mở phiếu Online</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default ExamEntryModal;
