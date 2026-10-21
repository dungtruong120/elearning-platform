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
  Sparkles,
  CheckCircle2,
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
  const durationMinutes = isHomework ? 0 : (exam.duration_minutes || exam.duration || 45);

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[500] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 font-sans text-left cursor-pointer"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          transition={{ type: "spring", damping: 25, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden cursor-default"
        >
          {/* HEADER MODAL */}
          <div className="p-5 sm:px-7 sm:py-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-black uppercase tracking-widest">
                  {isHomework ? "BÀI TẬP VỀ NHÀ" : "PHÒNG THI ĐA PHƯƠNG THỨC"}
                </span>
                <span className="text-xs text-slate-300 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {durationMinutes > 0 ? `${durationMinutes} phút` : "Tự do làm bài"}
                </span>
                <span className="text-xs text-emerald-300 font-semibold flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  {counts.totalCount} câu hỏi
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-extrabold text-white truncate pt-0.5">
                {examTitle}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
              title="Đóng (ESC)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* BODY CHỌN HÌNH THỨC LÀM BÀI */}
          <div className="p-5 sm:p-7 space-y-5 bg-[#F8FAFC]">
            {selectedBranch === "main" ? (
              <>
                <div className="text-center space-y-1">
                  <h4 className="text-sm sm:text-base font-black text-slate-900">
                    Chọn hình thức làm bài của bạn
                  </h4>
                  <p className="text-xs text-slate-500">
                    Hệ thống hỗ trợ đồng thời cả làm trực tuyến trên Web và làm trên Phiếu trả lời trắc nghiệm Bộ GD&ĐT.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* OPTION 1: LÀM BÀI TRÊN WEB */}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectWeb();
                    }}
                    className="group p-5 rounded-2xl bg-white hover:bg-blue-50/60 border-2 border-slate-200 hover:border-[#1D4ED8] shadow-xs hover:shadow-md transition-all text-left flex flex-col justify-between gap-4 cursor-pointer"
                  >
                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1D4ED8] border border-blue-200 flex items-center justify-center group-hover:bg-[#1D4ED8] group-hover:text-white transition-colors shadow-2xs">
                        <Globe className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h5 className="font-extrabold text-slate-900 text-sm sm:text-[15px] group-hover:text-[#1D4ED8]">
                            🌐 Làm bài trên Web
                          </h5>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed mt-1">
                          Làm bài tương tác trực tiếp trên giao diện web, hiển thị từng câu hỏi, tự động tính giờ và nộp bài chấm điểm ngay.
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-extrabold text-[#1D4ED8]">
                      <span>Bắt đầu làm trên Web</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>

                  {/* OPTION 2: LÀM BÀI TRÊN PHIẾU TRẮC NGHIỆM */}
                  <button
                    type="button"
                    onClick={() => setSelectedBranch("paper_options")}
                    className="group p-5 rounded-2xl bg-white hover:bg-purple-50/60 border-2 border-purple-200 hover:border-purple-600 shadow-xs hover:shadow-md transition-all text-left flex flex-col justify-between gap-4 cursor-pointer relative overflow-hidden"
                  >
                    <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-purple-600 text-white text-[9px] font-black uppercase tracking-wider">
                      AI OMR 2026
                    </span>

                    <div className="space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors shadow-2xs">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h5 className="font-extrabold text-slate-900 text-sm sm:text-[15px] group-hover:text-purple-700">
                          📄 Làm trên Phiếu Trắc Nghiệm
                        </h5>
                        <p className="text-xs text-slate-500 leading-relaxed mt-1">
                          Tải phiếu A4 chuẩn Bộ GD&ĐT in ra tô chì rồi chụp ảnh quét điểm, hoặc tô trực tiếp lên mẫu phiếu ảo trên màn hình.
                        </p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-extrabold text-purple-700">
                      <span>Mở chế độ Phiếu trắc nghiệm</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                </div>
              </>
            ) : (
              /* NHÁNH CON KHI CHỌN LÀM TRÊN PHIẾU TRẮC NGHIỆM (NHÁNH 2A & 2B) */
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 block">
                      CHẾ ĐỘ PHIẾU TRẢ LỜI TRẮC NGHIỆM BỘ GD&ĐT
                    </span>
                    <h4 className="text-sm sm:text-base font-black text-slate-900">
                      Chọn cách thức nộp Phiếu trả lời
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedBranch("main")}
                    className="px-3 py-1.5 rounded-xl bg-slate-200/80 hover:bg-slate-300/80 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    ← Quay lại
                  </button>
                </div>

                {/* HƯỚNG DẪN TẢI PHIẾU IN A4 ĐỘNG */}
                <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                      <Printer className="w-4 h-4 text-emerald-600" />
                      <span>Bước 1: In phiếu trả lời A4 tương ứng với đề này</span>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      Phiếu được co giãn tự động theo đúng {counts.totalCount} câu của đề (SBD của bạn: <strong>{studentSbd}</strong>).
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
                        ...counts,
                      })
                    }
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> Tải / In Phiếu A4
                  </button>
                </div>

                {/* 2 NHÁNH LÀM BÀI PHIẾU */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* NHÁNH 2A: QUÉT ẢNH PHIẾU GIẤY BẰNG CAMERA */}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectPaperScan();
                    }}
                    className="group p-4 sm:p-5 rounded-2xl bg-white hover:bg-purple-50/70 border-2 border-purple-200 hover:border-purple-600 transition-all text-left flex flex-col justify-between gap-3 cursor-pointer shadow-2xs"
                  >
                    <div className="space-y-2.5">
                      <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <Camera className="w-5 h-5" />
                      </div>
                      <h5 className="font-extrabold text-slate-900 text-sm">
                        📷 Chụp / Tải ảnh phiếu đã tô
                      </h5>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Dùng Camera điện thoại/máy tính chụp lại tờ phiếu giấy đã tô chì. AI OMR tự căn góc và chấm điểm ngay lập tức.
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-black text-purple-700">
                      <span>Mở máy quét Camera</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </button>

                  {/* NHÁNH 2B: TÔ PHIẾU ONLINE TRỰC TIẾP TRÊN MÀN HÌNH */}
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectDigitalSheet();
                    }}
                    className="group p-4 sm:p-5 rounded-2xl bg-white hover:bg-indigo-50/70 border-2 border-indigo-200 hover:border-indigo-600 transition-all text-left flex flex-col justify-between gap-3 cursor-pointer shadow-2xs"
                  >
                    <div className="space-y-2.5">
                      <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <PenTool className="w-5 h-5" />
                      </div>
                      <h5 className="font-extrabold text-slate-900 text-sm">
                        📝 Tô phiếu Online trên màn hình
                      </h5>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Chưa có máy in? Mở tờ phiếu trắc nghiệm Bộ GD&ĐT ảo ngay trên Web, vừa xem đề vừa tô tròn và nộp chấm tự động.
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs font-black text-indigo-700">
                      <span>Mở Phiếu tô Online</span>
                      <ArrowRight className="w-4 h-4" />
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
