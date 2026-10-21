"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  ArrowLeft, 
  Trophy, 
  Clock, 
  FileText, 
  Video, 
  ExternalLink, 
  History, 
  Play, 
  ChevronRight,
  Eye,
  Camera,
  Download,
  Globe
} from "lucide-react";
import { Profile, ExamAttempt } from "@/types";
import { formatEmbedUrl } from "@/lib/utils";
import { PaperScanModal } from "@/components/student/paper/PaperScanModal";
import { PaperReviewView } from "@/components/student/paper/PaperReviewView";
import {
  MOET_2025_OMR_BLUEPRINT,
  OMR_CANONICAL_WIDTH,
  OMR_CANONICAL_HEIGHT,
  CANONICAL_CORNER_TARGETS
} from "@/lib/omrEngine";

interface PracticeExamWorkspaceProps {
  exam: any;
  profile: Profile;
  attempts: any[];
  onBack: () => void;
  onRetake: () => void;
  onViewFile: () => void;
  onReviewAttempt?: (attempt: any) => void;
}

// HÀM TỰ ĐỘNG VẼ VÀ MỞ TRANG IN MẪU PHIẾU TRẢ LỜI TRẮC NGHIỆM A4 CHUẨN BỘ GD&ĐT (KHỚP 100% TỌA ĐỘ OMR)
function openPrintableMOETAnswerSheet(examTitle?: string) {
  if (typeof window === "undefined") return;
  const printWin = window.open("", "_blank");
  if (!printWin) {
    window.open("/templates/phieu_tra_loi_trac_nghiem_tct_a4.pdf", "_blank");
    return;
  }

  const bp = MOET_2025_OMR_BLUEPRINT;
  const W = OMR_CANONICAL_WIDTH;
  const H = OMR_CANONICAL_HEIGHT;
  const corners = CANONICAL_CORNER_TARGETS;

  let svgElements = "";

  // 1. Vẽ 4 khối vuông đen định vị ở 4 góc phiếu (Corner Alignment Markers)
  const markerSize = 28;
  [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft].forEach((pt) => {
    svgElements += `<rect x="${pt.x - markerSize / 2}" y="${pt.y - markerSize / 2}" width="${markerSize}" height="${markerSize}" fill="#000000" />`;
  });

  // 2. Vẽ Tiêu đề & Khung thông tin thí sinh
  svgElements += `
    <text x="410" y="95" font-family="Arial, sans-serif" font-size="24" font-weight="bold" text-anchor="middle" fill="#000">PHIẾU TRẢ LỜI TRẮC NGHIỆM</text>
    <text x="410" y="124" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#1D4ED8">${(examTitle || "KỲ THI THPT & ĐÁNH GIÁ NĂNG LỰC - TÂM CHÍ TÀI EDUNEXUS").replace(/[<>&"]/g, "")}</text>
    <rect x="65" y="150" width="710" height="335" fill="none" stroke="#334155" stroke-width="1.5" rx="6" />
    <line x1="255" y1="150" x2="255" y2="485" stroke="#334155" stroke-width="1.2" />
    <line x1="65" y1="315" x2="255" y2="315" stroke="#334155" stroke-width="1.2" />
    <text x="160" y="178" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#334155">Họ tên, chữ ký Giám thị 1</text>
    <text x="160" y="342" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#334155">Họ tên, chữ ký Giám thị 2</text>
    <text x="275" y="185" font-family="Arial, sans-serif" font-size="13" fill="#0f172a">1. Hội đồng thi: ..........................................................................</text>
    <text x="275" y="225" font-family="Arial, sans-serif" font-size="13" fill="#0f172a">2. Điểm thi: .................................................................................</text>
    <text x="275" y="265" font-family="Arial, sans-serif" font-size="13" fill="#0f172a">3. Phòng thi số: ..........................................................................</text>
    <text x="275" y="305" font-family="Arial, sans-serif" font-size="13" fill="#0f172a">4. Họ và tên thí sinh: ..................................................................</text>
    <text x="275" y="345" font-family="Arial, sans-serif" font-size="13" fill="#0f172a">5. Ngày sinh: ........../........../20.......  (Nam / Nữ)</text>
    <text x="275" y="385" font-family="Arial, sans-serif" font-size="13" fill="#0f172a">6. Chữ ký của thí sinh: ..............................................................</text>
    <text x="410" y="516" font-family="Arial, sans-serif" font-size="12" font-style="italic" font-weight="bold" text-anchor="middle" fill="#0f172a">Chú ý: Thí sinh giữ phiếu phẳng, tô kín ô tròn bằng bút chì đen và chụp rõ đủ 4 ô vuông đen ở 4 góc phiếu.</text>
  `;

  // 3. Vẽ Khung 7. Số báo danh & 8. Mã đề thi
  svgElements += `
    <text x="${bp.sbd.startX + 70}" y="146" font-family="Arial, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#000">7. Số báo danh</text>
    <rect x="${bp.sbd.startX - 18}" y="156" width="${bp.sbd.cols * bp.sbd.colStep + 8}" height="34" fill="none" stroke="#334155" stroke-width="1.2" />
    <rect x="${bp.sbd.startX - 18}" y="202" width="${bp.sbd.cols * bp.sbd.colStep + 8}" height="${10 * bp.sbd.rowStep + 14}" fill="none" stroke="#334155" stroke-width="1.2" />
  `;
  for (let c = 0; c < bp.sbd.cols; c++) {
    const cx = bp.sbd.startX + c * bp.sbd.colStep;
    for (let d = 0; d <= 9; d++) {
      const cy = bp.sbd.startY + d * bp.sbd.rowStep;
      svgElements += `
        <circle cx="${cx}" cy="${cy}" r="${bp.sbd.radius}" fill="none" stroke="#475569" stroke-width="1.1" />
        <text x="${cx}" y="${cy + 3.5}" font-family="Arial, sans-serif" font-size="9.5" text-anchor="middle" fill="#475569">${d}</text>
      `;
    }
  }

  svgElements += `
    <text x="${bp.examCode.startX + 28}" y="146" font-family="Arial, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#000">8. Mã đề thi</text>
    <rect x="${bp.examCode.startX - 18}" y="156" width="${bp.examCode.cols * bp.examCode.colStep + 8}" height="34" fill="none" stroke="#334155" stroke-width="1.2" />
    <rect x="${bp.examCode.startX - 18}" y="202" width="${bp.examCode.cols * bp.examCode.colStep + 8}" height="${10 * bp.examCode.rowStep + 14}" fill="none" stroke="#334155" stroke-width="1.2" />
  `;
  for (let c = 0; c < bp.examCode.cols; c++) {
    const cx = bp.examCode.startX + c * bp.examCode.colStep;
    for (let d = 0; d <= 9; d++) {
      const cy = bp.examCode.startY + d * bp.examCode.rowStep;
      svgElements += `
        <circle cx="${cx}" cy="${cy}" r="${bp.examCode.radius}" fill="none" stroke="#475569" stroke-width="1.1" />
        <text x="${cx}" y="${cy + 3.5}" font-family="Arial, sans-serif" font-size="9.5" text-anchor="middle" fill="#475569">${d}</text>
      `;
    }
  }

  // 4. Vẽ PHẦN I: 40 câu trắc nghiệm (A, B, C, D)
  svgElements += `
    <rect x="30" y="544" width="18" height="18" fill="#000" />
    <text x="65" y="559" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#000">PHẦN I (40 câu trắc nghiệm nhiều phương án lựa chọn)</text>
  `;
  const opts = ["A", "B", "C", "D"];
  bp.part1.blocks.forEach((b) => {
    const boxLeft = b.startX - 48;
    svgElements += `<rect x="${boxLeft}" y="572" width="232" height="352" fill="none" stroke="#334155" stroke-width="1.3" rx="4" />`;
    opts.forEach((k, idx) => {
      const ox = b.startX + idx * b.optionStepX;
      svgElements += `<text x="${ox}" y="594" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#0f172a">${k}</text>`;
    });

    for (let q = b.startQuestion; q <= b.endQuestion; q++) {
      const rIdx = q - b.startQuestion;
      const cy = b.startY + rIdx * b.rowStepY;
      svgElements += `<text x="${b.startX - 28}" y="${cy + 4}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#0f172a">${q}</text>`;
      opts.forEach((_, idx) => {
        const cx = b.startX + idx * b.optionStepX;
        svgElements += `<circle cx="${cx}" cy="${cy}" r="${b.radius}" fill="none" stroke="#334155" stroke-width="1.2" />`;
      });
    }
  });

  // 5. Vẽ PHẦN II: 8 câu Đúng / Sai
  svgElements += `
    <rect x="30" y="956" width="18" height="18" fill="#000" />
    <text x="65" y="971" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#000">PHẦN II (8 câu trắc nghiệm Đúng / Sai)</text>
  `;
  const subLabels = ["a)", "b)", "c)", "d)"];
  bp.part2.blocks.forEach((b) => {
    const q = b.questionNumber;
    const boxLeft = b.trueX - 42;
    svgElements += `
      <rect x="${boxLeft}" y="988" width="108" height="195" fill="none" stroke="#334155" stroke-width="1.3" rx="4" />
      <text x="${(b.trueX + b.falseX) / 2}" y="1012" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#000">Câu ${q}</text>
      <text x="${b.trueX}" y="1034" font-family="Arial, sans-serif" font-size="10.5" font-weight="bold" text-anchor="middle" fill="#334155">Đúng</text>
      <text x="${b.falseX}" y="1034" font-family="Arial, sans-serif" font-size="10.5" font-weight="bold" text-anchor="middle" fill="#334155">Sai</text>
    `;
    subLabels.forEach((lbl, idx) => {
      const cy = b.startY + idx * b.rowStepY;
      svgElements += `
        <text x="${b.trueX - 24}" y="${cy + 4}" font-family="Arial, sans-serif" font-size="11.5" font-weight="bold" text-anchor="middle" fill="#0f172a">${lbl}</text>
        <circle cx="${b.trueX}" cy="${cy}" r="${b.radius}" fill="none" stroke="#334155" stroke-width="1.2" />
        <circle cx="${b.falseX}" cy="${cy}" r="${b.radius}" fill="none" stroke="#334155" stroke-width="1.2" />
      `;
    });
  });

  // 6. Vẽ PHẦN III: 6 câu Trả lời ngắn
  svgElements += `
    <rect x="30" y="1208" width="18" height="18" fill="#000" />
    <text x="65" y="1223" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#000">PHẦN III (6 câu trả lời ngắn - Điền đáp số)</text>
  `;
  bp.part3.blocks.forEach((b) => {
    const q = b.questionNumber;
    const boxLeft = b.startX - 36;
    svgElements += `
      <rect x="${boxLeft}" y="1236" width="152" height="390" fill="none" stroke="#334155" stroke-width="1.3" rx="4" />
      <text x="${b.startX + 40}" y="1260" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#000">Câu ${q}</text>
      <text x="${b.startX - 20}" y="${b.minusY + 4}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#000">-</text>
      <circle cx="${b.startX}" cy="${b.minusY}" r="${b.radius}" fill="none" stroke="#334155" stroke-width="1.2" />
      <text x="${b.startX - 20}" y="${b.commaY + 4}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#000">,</text>
      <circle cx="${b.startX + b.colStepX}" cy="${b.commaY}" r="${b.radius}" fill="none" stroke="#334155" stroke-width="1.2" />
      <circle cx="${b.startX + 2 * b.colStepX}" cy="${b.commaY}" r="${b.radius}" fill="none" stroke="#334155" stroke-width="1.2" />
    `;
    for (let d = 0; d <= 9; d++) {
      const cy = b.digit0Y + d * b.rowStepY;
      svgElements += `<text x="${b.startX - 20}" y="${cy + 4}" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#0f172a">${d}</text>`;
      for (let c = 0; c < 4; c++) {
        const cx = b.startX + c * b.colStepX;
        svgElements += `<circle cx="${cx}" cy="${cy}" r="${b.radius}" fill="none" stroke="#334155" stroke-width="1.1" />`;
      }
    }
  });

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8" />
      <title>Phiếu Trả Lời Trắc Nghiệm Chuẩn Bộ GD&ĐT - ${examTitle || "EduNexus"}</title>
      <style>
        @page { size: A4 portrait; margin: 6mm; }
        body { margin: 0; padding: 0; background: #f1f5f9; font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; }
        .toolbar { width: 100%; max-width: 820px; margin: 12px auto; padding: 10px 18px; background: #0f172a; color: #fff; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box; }
        .btn-print { background: #2563eb; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; }
        .sheet-wrap { background: #fff; width: 210mm; max-width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.12); margin-bottom: 24px; }
        svg { width: 100%; height: auto; display: block; }
        @media print {
          body { background: #fff; }
          .toolbar { display: none !important; }
          .sheet-wrap { box-shadow: none; width: 100%; margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <span><strong>Mẫu Phiếu Trả Lời Trắc Nghiệm A4 Chuẩn Bộ GD&ĐT</strong> (Tương thích 100% OMR Scanner)</span>
        <button class="btn-print" onclick="window.print()">🖨 In Phiếu / Lưu PDF (A4)</button>
      </div>
      <div class="sheet-wrap">
        <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${W}" height="${H}" fill="#ffffff" />
          ${svgElements}
        </svg>
      </div>
    </body>
    </html>
  `;

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}

export default function PracticeExamWorkspace({
  exam,
  profile,
  attempts = [],
  onBack,
  onRetake,
  onViewFile,
  onReviewAttempt
}: PracticeExamWorkspaceProps) {
  // State nội bộ quản lý danh sách attempts (cập nhật tức thì ngay khi học sinh quét phiếu xong)
  const [localAttempts, setLocalAttempts] = useState<any[]>(attempts);
  const [isPaperScanModalOpen, setIsPaperScanModalOpen] = useState<boolean>(false);
  const [paperReviewAttempt, setPaperReviewAttempt] = useState<ExamAttempt | null>(null);

  useEffect(() => {
    setLocalAttempts(attempts);
  }, [attempts]);

  // Hàm lấy timestamp an toàn tránh lỗi Invalid Date
  const getSafeTimestamp = (att: any): number => {
    const raw = att?.submittedAt || att?.createdAt || att?.created_at;
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return isNaN(t) ? 0 : t;
  };

  // Sắp xếp lịch sử thi: Lần nộp mới nhất nằm trên đầu
  const sortedAttempts = useMemo(() => {
    return [...localAttempts].sort((a, b) => getSafeTimestamp(b) - getSafeTimestamp(a));
  }, [localAttempts]);

  // Lấy điểm số cao nhất trong tất cả các lần thi của đề này
  const maxScore = useMemo(() => {
    if (localAttempts.length === 0) return 0;
    return Math.max(...localAttempts.map(a => Number(a?.score ?? a?.points ?? 0)));
  }, [localAttempts]);

  // Tìm lần thi đạt điểm cao nhất (bestAttempt) để mở khi bấm nút [Xem lại bài làm]
  const bestAttempt = useMemo(() => {
    if (sortedAttempts.length === 0) return null;
    let best = sortedAttempts[0];
    for (const att of sortedAttempts) {
      const sc = Number(att?.score ?? att?.points ?? 0);
      const bestSc = Number(best?.score ?? best?.points ?? 0);
      if (sc > bestSc) {
        best = att;
      }
    }
    return best;
  }, [sortedAttempts]);

  // Định dạng thời gian hoàn thành (phút, giây) hỗ trợ cả số giây lẫn chuỗi timeSpent
  const formatAttemptDuration = (att: any) => {
    if (att?.submission_type === "paper") return "Trên giấy";
    const sec = Number(att?.completionTime || att?.durationSeconds || att?.duration_seconds || 0);
    if (sec && !isNaN(sec) && sec > 0) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      if (m === 0) return s + "s";
      return m + "p " + s + "s";
    }
    if (att?.timeSpent || att?.time_spent) {
      return String(att.timeSpent || att.time_spent);
    }
    return "15p";
  };

  const formatAttemptDate = (att: any) => {
    const ts = getSafeTimestamp(att);
    if (!ts) return "Mới nộp";
    return new Date(ts).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  // Xử lý mở xem lại bài: Nếu là bài giấy -> mở PaperReviewView; nếu là bài web -> gọi onReviewAttempt
  const handleTriggerReview = (att: any) => {
    if (!att) return;
    if (att.submission_type === "paper" || att.paper_scan_url || att.omr_raw_data) {
      setPaperReviewAttempt(att);
    } else {
      onReviewAttempt?.(att);
    }
  };

  const videoUrl = exam.solutionVideoUrl || exam.videoUrl || "";
  const embedSrc = formatEmbedUrl(videoUrl);
  const canViewFile = exam.allowViewFile !== false;

  // Nếu đang mở màn hình xem lại bài chấm trên giấy (PaperReviewView)
  if (paperReviewAttempt) {
    return (
      <PaperReviewView
        attempt={paperReviewAttempt}
        exam={exam}
        profile={profile}
        onBack={() => setPaperReviewAttempt(null)}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.99 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="fixed inset-0 z-[100] bg-[#F8FAFC] font-sans text-slate-800 flex flex-col overflow-hidden text-left"
    >
      {/* 1. THANH HEADER ĐIỀU HƯỚNG */}
      <header className="h-[64px] bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 z-10 shadow-xs">
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" /> Quay lại kho đề
          </button>

          <div className="hidden md:flex items-center gap-2 text-[13px] font-medium text-slate-400">
            <span onClick={onBack} className="hover:text-slate-700 cursor-pointer transition-colors">
              Kho Luyện đề
            </span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[#1D4ED8] font-bold">{exam.category || "Luyện đề"}</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-900 font-bold truncate max-w-[200px] lg:max-w-[400px]">
              {exam.title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-700 hidden sm:block">
            {profile?.full_name || "Học sinh"}
          </span>
          <div className="w-9 h-9 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center text-sm font-black shadow-md border-2 border-white">
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "U"}
          </div>
        </div>
      </header>

      {/* 2. KHU VỰC NỘI DUNG CHÍNH (CHIA 2 CỘT 8 - 4) */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* CỘT TRÁI (8 CỘT): TRÌNH PHÁT VIDEO CHỮA ĐỀ */}
          <div className="lg:col-span-8 space-y-5">
            <div className="bg-[#0F172A] rounded-2xl overflow-hidden shadow-xs border border-slate-200 aspect-video w-full relative flex items-center justify-center">
              {embedSrc ? (
                <iframe
                  src={embedSrc}
                  className="w-full h-full border-0"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  title={"Video chữa bài: " + exam.title}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-3">
                    <Video className="w-8 h-8 text-slate-500" />
                  </div>
                  <h3 className="font-bold text-base text-white">Chưa có video chữa chi tiết</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Giáo viên chưa cập nhật video hướng dẫn giải chi tiết cho đề thi này. Bạn có thể xem file đính kèm (nếu có) hoặc xem lại bài làm của mình ở khung bên phải.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-blue-50 text-[#1D4ED8] border border-blue-100">
                    {exam.category || "Luyện đề"}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> {exam.duration_minutes} phút làm bài
                  </span>
                </div>

                {bestAttempt && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTriggerReview(bestAttempt);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Đối chiếu bài làm với Video</span>
                  </button>
                )}
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {"Hướng dẫn chữa chi tiết: " + exam.title}
              </h1>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                Hãy theo dõi video chữa bài chi tiết để rút kinh nghiệm các câu hỏi sai. Bạn có thể bấm nút <strong>Xem lại bài làm của bạn</strong> hoặc <strong>Quét phiếu làm trên giấy</strong> ở khung bên phải.
              </p>
            </div>
          </div>

          {/* CỘT PHẢI (4 CỘT): ĐIỂM SỐ, NÚT QUÉT PHIẾU GIẤY, LỊCH SỬ THI & FILE ĐỀ */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* KHỐI 1: TỔNG QUAN ĐIỂM CAO NHẤT + NÚT QUÉT PHIẾU LÀM TRÊN GIẤY */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" /> Kết quả cao nhất
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {localAttempts.length} lần thi
                </span>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-black text-2xl shrink-0 shadow-inner">
                  {localAttempts.length > 0 ? maxScore.toFixed(1) : "--"}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {localAttempts.length > 0 ? "Điểm kỷ lục của bạn" : "Chưa có lượt thi nào"}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {"Thang điểm 10 • Thời gian " + exam.duration_minutes + " phút"}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={onRetake}
                  className="w-full py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" /> Làm lại đề thi ngay
                </button>

                {/* NÚT MỚI: QUÉT PHIẾU TRẢ LỜI LÀM TRÊN GIẤY BẰNG CAMERA / AI OMR */}
                <button
                  type="button"
                  onClick={() => setIsPaperScanModalOpen(true)}
                  className="bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl py-2.5 px-4 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer w-full transition-all shadow-2xs"
                >
                  <Camera className="w-4 h-4 text-purple-600" />
                  <span>📷 Quét phiếu làm trên giấy</span>
                </button>

                {localAttempts.length > 0 && bestAttempt && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTriggerReview(bestAttempt);
                    }}
                    className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-all font-semibold rounded-xl text-xs py-2.5 px-4 flex items-center justify-center gap-2 w-full cursor-pointer shadow-2xs"
                  >
                    <Eye className="w-4 h-4 text-blue-600" />
                    <span>Xem lại bài làm của bạn</span>
                  </button>
                )}
              </div>
            </div>

            {/* KHỐI 2: CHI TIẾT LỊCH SỬ CÁC LẦN LÀM (PHÂN BIỆT RÕ [🌐 WEB] VS [📄 GIẤY]) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <History className="w-4 h-4 text-blue-500" /> {"Lịch sử làm bài (" + localAttempts.length + ")"}
                </h3>
              </div>

              {sortedAttempts.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 font-medium">
                  Bạn chưa hoàn thành lượt thi nào cho đề này.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                  {sortedAttempts.map((att, idx) => {
                    const attScore = Number(att?.score ?? att?.points ?? 0);
                    const isBest = attScore === maxScore && maxScore > 0;
                    const correctVal = att?.correctAnswers ?? att?.correctCount ?? att?.correct_count;
                    const totalQVal = att?.totalQuestions ?? att?.total_questions;
                    const isPaperAttempt =
                      att?.submission_type === "paper" ||
                      Boolean(att?.paper_scan_url) ||
                      Boolean(att?.omr_raw_data);

                    return (
                      <div
                        key={"attempt-" + (att.id || att.attemptId || "item") + "-" + idx}
                        className={"p-3 rounded-xl border transition-colors flex items-center justify-between gap-2 " + (
                          isBest ? "bg-amber-50/50 border-amber-200" : "bg-slate-50/60 border-slate-100"
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-800">
                              {"Lần " + (sortedAttempts.length - idx)}
                            </span>

                            {/* BADGE PHÂN BIỆT HÌNH THỨC LÀM BÀI: [📄 GIẤY] VS [🌐 WEB] */}
                            {isPaperAttempt ? (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                                📄 Giấy
                              </span>
                            ) : (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                🌐 Web
                              </span>
                            )}

                            {isBest && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                                Cao nhất
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1 font-medium flex-wrap">
                            <span>{formatAttemptDate(att)}</span>
                            <span>•</span>
                            <span>{formatAttemptDuration(att)}</span>
                            {correctVal !== undefined && totalQVal !== undefined && (
                              <>
                                <span>•</span>
                                <span>{correctVal + "/" + totalQVal + " câu"}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <span className={"text-sm font-black " + (isBest ? "text-amber-600" : "text-[#1D4ED8]")}>
                              {attScore.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-normal">điểm</span>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTriggerReview(att);
                            }}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded-lg transition text-xs font-semibold flex items-center gap-1 border border-blue-200/70 bg-white shadow-2xs cursor-pointer"
                            title={
                              isPaperAttempt
                                ? "Xem ảnh chấm bài trên giấy"
                                : "Xem lại bài làm trực tuyến"
                            }
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* KHỐI 3: TÀI LIỆU FILE ĐỀ THI & NÚT TẢI MẪU PHIẾU TRẢ LỜI A4 BỘ GD&ĐT */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                <FileText className="w-4 h-4 text-emerald-500" /> Tài liệu & Mẫu phiếu in
              </h3>

              {canViewFile && (
                <button
                  type="button"
                  onClick={() => {
                    if (exam.driveUrl && exam.driveUrl.trim() !== "") {
                      window.open(exam.driveUrl, "_blank");
                    } else {
                      onViewFile();
                    }
                  }}
                  className="w-full p-3 bg-blue-50/50 hover:bg-blue-100/50 border border-blue-200 text-blue-700 rounded-xl transition flex items-center justify-between group cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className="text-[9px] font-black text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">
                      {exam.driveUrl ? "DRIVE" : "DOCS"}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-700">
                      {"File đề: " + exam.title}
                    </span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-blue-500 shrink-0 group-hover:scale-110 transition-transform" />
                </button>
              )}

              {/* NÚT TẢI MẪU PHIẾU TRẢ LỜI TRẮC NGHIỆM A4 CHUẨN BỘ GD&ĐT */}
              <button
                type="button"
                onClick={() => openPrintableMOETAnswerSheet(exam.title)}
                className="w-full p-3 bg-emerald-50/60 hover:bg-emerald-100/60 border border-emerald-200 text-emerald-800 rounded-xl transition flex items-center justify-between group cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                    PDF A4
                  </span>
                  <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-emerald-800">
                    📄 Tải phiếu trả lời trắc nghiệm A4 chuẩn Bộ GD&ĐT
                  </span>
                </div>
                <Download className="w-4 h-4 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
              </button>
            </div>

          </div>

        </div>
      </main>

      {/* MODAL CAMERA QUÉT PHIẾU BÀI LÀM TRÊN GIẤY */}
      <PaperScanModal
        isOpen={isPaperScanModalOpen}
        onClose={() => setIsPaperScanModalOpen(false)}
        exam={exam}
        profile={profile}
        isHomework={false}
        onScanComplete={async (attemptRecord) => {
          setIsPaperScanModalOpen(false);

          // Gửi đồng bộ thêm lên API Route /api/student/scan-paper để lưu Storage + DB
          try {
            const res = await fetch("/api/student/scan-paper", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                attemptId: attemptRecord.id,
                examId: exam.id,
                examTitle: exam.title,
                studentId: profile?.id || profile?.username || "student",
                studentName: profile?.full_name || profile?.username || "Học sinh",
                school: profile?.school || "THPT",
                score: attemptRecord.score,
                totalQuestions: attemptRecord.totalQuestions,
                correctCount: attemptRecord.correctCount,
                answers: attemptRecord.answers,
                omrData: attemptRecord.omr_raw_data,
                imageBase64: attemptRecord.paper_scan_url
              })
            });

            if (res.ok) {
              const data = await res.json();
              if (data?.paperScanUrl) {
                attemptRecord.paper_scan_url = data.paperScanUrl;
              }
            }
          } catch {}

          // Cập nhật danh sách attempts tại chỗ và mở ngay màn hình PaperReviewView
          setLocalAttempts((prev) => [attemptRecord, ...prev]);
          setPaperReviewAttempt(attemptRecord);
        }}
      />
    </motion.div>
  );
}
