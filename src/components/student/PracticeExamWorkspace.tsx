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
  Eye,
  Camera,
  Download
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

interface ResolvedAttachmentItem {
  id: string;
  title: string;
  url: string;
  subtitle: string;
}

function resolveExamAttachments(exam: any): ResolvedAttachmentItem[] {
  const result: ResolvedAttachmentItem[] = [];
  const seenUrls = new Set<string>();

  const pushItem = (raw: any, fallbackTitle: string) => {
    if (!raw) return;
    const url = String(raw.url || "").trim();
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    result.push({
      id: String(raw.id || `doc-${result.length}`),
      title: String(raw.title || fallbackTitle).trim() || fallbackTitle,
      url,
      subtitle: /drive\.google\.com/i.test(url)
        ? "Tài liệu Google Drive"
        : /\.pdf(\?|$)/i.test(url)
          ? "Tài liệu PDF"
          : "Tài liệu đính kèm (PDF / Drive)"
    });
  };

  let rawAttachments: any = exam?.attachments;
  if (typeof rawAttachments === "string" && rawAttachments.trim().startsWith("[")) {
    try {
      rawAttachments = JSON.parse(rawAttachments);
    } catch {
      rawAttachments = [];
    }
  }
  if (Array.isArray(rawAttachments)) {
    rawAttachments.forEach((item: any, idx: number) =>
      pushItem(item, `Tài liệu đính kèm ${idx + 1}`)
    );
  }

  const rawDriveUrl = String(exam?.driveUrl || "").trim();
  if (rawDriveUrl) {
    if (rawDriveUrl.startsWith("[")) {
      try {
        const parsed = JSON.parse(rawDriveUrl);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any, idx: number) =>
            pushItem(item, `Tài liệu đính kèm ${idx + 1}`)
          );
        }
      } catch {}
    } else if (/^https?:\/\//i.test(rawDriveUrl)) {
      pushItem(
        {
          id: "legacy-drive",
          title: `File đề thi: ${exam?.title || "Tài liệu PDF / Drive"}`,
          url: rawDriveUrl
        },
        "File đề thi (PDF / Drive)"
      );
    }
  }

  return result;
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

  const markerSize = 28;
  [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft].forEach((pt) => {
    svgElements += `<rect x="${pt.x - markerSize / 2}" y="${pt.y - markerSize / 2}" width="${markerSize}" height="${markerSize}" fill="#000000" />`;
  });

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
        .btn-print { background: #1D4ED8; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; }
        .sheet-wrap { background: #fff; width: 210mm; max-width: 100%; margin-bottom: 24px; }
        svg { width: 100%; height: auto; display: block; }
        @media print {
          body { background: #fff; }
          .toolbar { display: none !important; }
          .sheet-wrap { width: 100%; margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <span><strong>Mẫu Phiếu Trả Lời Trắc Nghiệm A4 Chuẩn Bộ GD&ĐT</strong> (Tương thích 100% OMR Scanner)</span>
        <button class="btn-print" onclick="window.print()">In Phiếu / Lưu PDF (A4)</button>
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
  const [localAttempts, setLocalAttempts] = useState<any[]>(attempts);
  const [isPaperScanModalOpen, setIsPaperScanModalOpen] = useState<boolean>(false);
  const [paperReviewAttempt, setPaperReviewAttempt] = useState<ExamAttempt | null>(null);

  useEffect(() => {
    setLocalAttempts(attempts);
  }, [attempts]);

  const getSafeTimestamp = (att: any): number => {
    const raw = att?.submittedAt || att?.createdAt || att?.created_at;
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return isNaN(t) ? 0 : t;
  };

  const sortedAttempts = useMemo(() => {
    return [...localAttempts].sort((a, b) => getSafeTimestamp(b) - getSafeTimestamp(a));
  }, [localAttempts]);

  const maxScore = useMemo(() => {
    if (localAttempts.length === 0) return 0;
    return Math.max(...localAttempts.map((a) => Number(a?.score ?? a?.points ?? 0)));
  }, [localAttempts]);

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

  const handleTriggerReview = (att: any) => {
    if (!att) return;
    if (att.submission_type === "paper" || att.paper_scan_url || att.omr_raw_data) {
      setPaperReviewAttempt(att);
    } else {
      onReviewAttempt?.(att);
    }
  };

  const attachmentsList = useMemo(() => resolveExamAttachments(exam), [exam]);
  const videoUrl = exam.solutionVideoUrl || exam.videoUrl || "";
  const embedSrc = formatEmbedUrl(videoUrl);
  const canViewFile = exam.allowViewFile !== false;
  const durationMinutes = exam.duration_minutes || 90;

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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed inset-0 z-[100] bg-[#F1F5F9] font-sans antialiased text-slate-800 flex flex-col overflow-hidden text-left"
    >
      {/* 1. HEADER 3 CỘT CÂN ĐỐI & TIÊU ĐỀ ĐỀ THI NỔI BẬT Ở CHÍNH GIỮA */}
      <header className="h-16 bg-white border-b border-slate-200/90 flex items-center justify-between gap-3 px-4 sm:px-6 shrink-0 z-10">
        <div className="shrink-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200/90 bg-[#F8FAFC] hover:bg-white transition text-xs font-semibold text-slate-700 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Quay lại kho đề</span>
            <span className="sm:hidden">Quay lại</span>
          </button>
        </div>

        <div className="flex-1 text-center px-2 min-w-0">
          <h1
            className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate"
            title={exam.title}
          >
            {exam.title}
          </h1>
          <p className="text-[11px] text-slate-500 font-normal truncate mt-0.5">
            Kho Luyện đề • {exam.category || "Luyện đề"} • {durationMinutes} phút
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-2.5">
          <span className="text-xs font-semibold text-slate-700 hidden md:block max-w-[140px] truncate">
            {profile?.full_name || "Học sinh"}
          </span>
          <div className="w-8 h-8 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center text-xs font-bold">
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "U"}
          </div>
        </div>
      </header>

      {/* 2. KHU VỰC NỘI DUNG CHÍNH (8 CỘT TRÁI - 4 CỘT PHẢI) */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          {/* CỘT TRÁI (8 CỘT): VIDEO CHỮA ĐỀ TỐI GIẢN */}
          <div className="lg:col-span-8 space-y-4">
            {embedSrc ? (
              <div className="bg-slate-100/80 border border-slate-200/90 rounded-xl overflow-hidden aspect-video w-full">
                <iframe
                  src={embedSrc}
                  className="w-full h-full border-0"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  title={"Video chữa bài: " + exam.title}
                />
              </div>
            ) : (
              <div className="bg-slate-100/80 border border-slate-200/90 rounded-xl py-8 px-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5 text-[#1D4ED8]" />
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">
                    Chưa có video chữa chi tiết
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Giáo viên chưa cập nhật video chữa cho đề này. Bạn có thể tải tài liệu đính kèm
                    để tự luyện hoặc xem lại kết quả làm bài ở cột bên phải.
                  </p>
                </div>
              </div>
            )}

            <div className="bg-white p-5 rounded-xl border border-slate-200/90 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-lg bg-blue-50 text-[#1D4ED8] border border-blue-200">
                    {exam.category || "Luyện đề"}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{durationMinutes} phút làm bài</span>
                  </span>
                </div>

                {bestAttempt && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTriggerReview(bestAttempt);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-[#1D4ED8] hover:bg-blue-100/70 border border-blue-200 text-xs font-semibold transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Đối chiếu bài làm</span>
                  </button>
                )}
              </div>

              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {"Hướng dẫn chữa chi tiết: " + exam.title}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Theo dõi video chữa chi tiết để tổng hợp lại phương pháp giải các câu hỏi sai. Bạn
                có thể tải file đề về tự làm hoặc nộp phiếu giấy bằng tính năng Quét phiếu OMR.
              </p>
            </div>
          </div>

          {/* CỘT PHẢI (4 CỘT): 2 KHỐI MONOCHROME RÕ RÀNG */}
          <div className="lg:col-span-4 space-y-5">
            {/* KHỐI 1: TÀI LIỆU & ĐỀ TẢI VỀ (ƯU TIÊN ĐƯA LÊN TRÊN CÙNG) */}
            <div className="bg-white p-5 rounded-xl border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#1D4ED8]" />
                  <span>Tài liệu & Đề tải về</span>
                </h3>
                <span className="text-[11px] text-slate-500">
                  {attachmentsList.length > 0 ? `${attachmentsList.length} file` : "Mẫu in A4"}
                </span>
              </div>

              <div className="space-y-2">
                {attachmentsList.length > 0 ? (
                  attachmentsList.map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full p-3 bg-[#F8FAFC] hover:bg-white border border-slate-200/90 rounded-lg transition flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 truncate group-hover:text-[#1D4ED8] transition-colors">
                            {doc.title}
                          </div>
                          <div className="text-[11px] text-slate-500 font-normal truncate">
                            {doc.subtitle}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#1D4ED8] shrink-0 inline-flex items-center gap-1 group-hover:underline">
                        <span>Mở file</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </span>
                    </a>
                  ))
                ) : (
                  canViewFile && (
                    <button
                      type="button"
                      onClick={onViewFile}
                      className="w-full p-3 bg-[#F8FAFC] hover:bg-white border border-slate-200/90 rounded-lg transition flex items-center justify-between gap-3 group cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 truncate group-hover:text-[#1D4ED8] transition-colors">
                            {"File đề: " + exam.title}
                          </div>
                          <div className="text-[11px] text-slate-500 font-normal">
                            Xem nội dung đề trực tuyến
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-[#1D4ED8] shrink-0 inline-flex items-center gap-1 group-hover:underline">
                        <span>Mở file</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  )
                )}

                {/* Mẫu phiếu trả lời trắc nghiệm A4 chuẩn Bộ GD&ĐT */}
                <button
                  type="button"
                  onClick={() => openPrintableMOETAnswerSheet(exam.title)}
                  className="w-full p-3 bg-[#F8FAFC] hover:bg-white border border-slate-200/90 rounded-lg transition flex items-center justify-between gap-3 group cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Download className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate group-hover:text-[#1D4ED8] transition-colors">
                        Phiếu trả lời trắc nghiệm A4 chuẩn Bộ GD&ĐT
                      </div>
                      <div className="text-[11px] text-slate-500 font-normal">
                        Mẫu phiếu in tương thích quét chấm OMR
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#1D4ED8] shrink-0 group-hover:underline">
                    Tải phiếu
                  </span>
                </button>
              </div>
            </div>

            {/* KHỐI 2: LÀM BÀI TRỰC TUYẾN & KẾT QUẢ */}
            <div className="bg-white p-5 rounded-xl border border-slate-200/90 space-y-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#1D4ED8]" />
                  <span>Làm bài trực tuyến & Kết quả</span>
                </h3>
                <span className="text-[11px] text-slate-500">{localAttempts.length} lần thi</span>
              </div>

              {/* Thẻ điểm cao nhất tối giản */}
              <div className="flex items-center gap-3.5 bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/90">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1D4ED8] font-bold text-xl shrink-0">
                  {localAttempts.length > 0 ? maxScore.toFixed(1) : "--"}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900">
                    {localAttempts.length > 0 ? "Điểm cao nhất của bạn" : "Chưa có lượt thi nào"}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {"Thang điểm 10 • Thời gian " + durationMinutes + " phút"}
                  </p>
                </div>
              </div>

              {/* Cụm nút hành động chính / phụ */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onRetake}
                  className="w-full py-2.5 px-4 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Làm lại đề thi ngay</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPaperScanModalOpen(true)}
                  className="w-full py-2.5 px-4 bg-white hover:bg-[#F8FAFC] text-slate-700 border border-slate-200/90 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[#1D4ED8]" />
                  <span>Quét phiếu làm trên giấy</span>
                </button>

                {localAttempts.length > 0 && bestAttempt && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTriggerReview(bestAttempt);
                    }}
                    className="w-full py-2.5 px-4 bg-[#F8FAFC] hover:bg-blue-50/40 text-[#1D4ED8] border border-slate-200/90 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Eye className="w-4 h-4 text-[#1D4ED8]" />
                    <span>Xem lại bài làm của bạn</span>
                  </button>
                )}
              </div>

              {/* Danh sách lịch sử làm bài tối giản */}
              <div className="pt-3.5 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-[#1D4ED8]" />
                    <span>{"Lịch sử làm bài (" + localAttempts.length + ")"}</span>
                  </span>
                </div>

                {sortedAttempts.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-500">
                    Bạn chưa hoàn thành lượt thi nào cho đề này.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar pr-0.5">
                    {sortedAttempts.map((att, idx) => {
                      const attScore = Number(att?.score ?? att?.points ?? 0);
                      const isBest = attScore === maxScore && maxScore > 0;
                      const correctVal =
                        att?.correctAnswers ?? att?.correctCount ?? att?.correct_count;
                      const totalQVal = att?.totalQuestions ?? att?.total_questions;
                      const isPaperAttempt =
                        att?.submission_type === "paper" ||
                        Boolean(att?.paper_scan_url) ||
                        Boolean(att?.omr_raw_data);

                      return (
                        <div
                          key={"attempt-" + (att.id || att.attemptId || "item") + "-" + idx}
                          className="p-3 rounded-lg border border-slate-200/90 bg-[#F8FAFC] hover:bg-white transition flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-slate-800">
                                {"Lần " + (sortedAttempts.length - idx)}
                              </span>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200/90">
                                {isPaperAttempt ? "Giấy" : "Web"}
                              </span>
                              {isBest && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-[#1D4ED8] border border-blue-200">
                                  Cao nhất
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1 flex-wrap">
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
                              <span
                                className={
                                  "text-sm font-bold " +
                                  (isBest ? "text-[#1D4ED8]" : "text-slate-800")
                                }
                              >
                                {attScore.toFixed(1)}
                              </span>
                              <span className="text-[10px] text-slate-500 block font-normal">
                                điểm
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTriggerReview(att);
                              }}
                              className="text-[#1D4ED8] hover:bg-blue-50 px-2 py-1 rounded-lg transition text-xs font-semibold flex items-center gap-1 border border-slate-200/90 bg-white cursor-pointer"
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

          setLocalAttempts((prev) => [attemptRecord, ...prev]);
          setPaperReviewAttempt(attemptRecord);
        }}
      />
    </motion.div>
  );
}
