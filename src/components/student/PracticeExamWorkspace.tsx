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
  Download,
  Lock
} from "lucide-react";
import { Profile, ExamAttempt } from "@/types";
import { formatEmbedUrl } from "@/lib/utils";
import { PaperScanModal } from "@/components/student/paper/PaperScanModal";
import { PaperReviewView } from "@/components/student/paper/PaperReviewView";
import { openPrintableDynamicAnswerSheet, formatStudentAutoSBD } from "@/lib/omrEngine";

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

function isAnswerKeyAttachment(title: string): boolean {
  if (!title) return false;
  const lower = String(title).normalize("NFC").toLowerCase();
  const noAccent = lower
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d");

  return (
    lower.includes("đáp án") ||
    lower.includes("lời giải") ||
    noAccent.includes("dap an") ||
    noAccent.includes("loi giai")
  );
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
  const hasCompletedAtLeastOnce = localAttempts.length > 0;
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
            {/* KHỐI 1: TÀI LIỆU & ĐỀ TẢI VỀ */}
            <div className="bg-white p-5 rounded-xl border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#1D4ED8]" />
                  <span>Tài liệu &amp; Đề tải về</span>
                </h3>
                <span className="text-[11px] text-slate-500">
                  {attachmentsList.length > 0 ? `${attachmentsList.length} file` : "Mẫu in A4"}
                </span>
              </div>

              <div className="space-y-2">
                {attachmentsList.length > 0 ? (
                  attachmentsList.map((doc) => {
                    const isAnswerKeyFile = isAnswerKeyAttachment(doc.title);

                    if (isAnswerKeyFile && !hasCompletedAtLeastOnce) {
                      return (
                        <div
                          key={doc.id}
                          className="w-full p-3 bg-[#F8FAFC] border border-slate-200/90 rounded-lg opacity-85 flex items-center justify-between gap-3 select-none"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-500 truncate">
                                {doc.title}
                              </div>
                              <div className="text-[11px] text-slate-400 font-normal">
                                Hoàn thành ít nhất 1 lượt làm bài để mở khóa đáp án
                              </div>
                            </div>
                          </div>
                          <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                            Đang khóa
                          </span>
                        </div>
                      );
                    }

                    return (
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
                    );
                  })
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

                {/* Tải phiếu trả lời trắc nghiệm A4 động chuẩn hệ thống OMR */}
                <button
                  type="button"
                  onClick={() =>
                    openPrintableDynamicAnswerSheet({
                      ...exam,
                      examTitle: exam.title,
                      studentSbd: formatStudentAutoSBD(profile),
                      studentName: profile?.full_name || ""
                    })
                  }
                  className="w-full p-3 bg-[#F8FAFC] hover:bg-white border border-slate-200/90 rounded-lg transition flex items-center justify-between gap-3 group cursor-pointer text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Download className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 truncate group-hover:text-[#1D4ED8] transition-colors">
                        Phiếu trả lời trắc nghiệm A4 chuẩn Bộ GD&amp;ĐT
                      </div>
                      <div className="text-[11px] text-slate-500 font-normal">
                        Mẫu phiếu in tự động điền SBD tương thích quét OMR
                      </div>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#1D4ED8] shrink-0 group-hover:underline">
                    Tải phiếu
                  </span>
                </button>
              </div>
            </div>

            {/* KHỐI 2: KẾT QUẢ & LỊCH SỬ LÀM BÀI */}
            <div className="bg-white p-5 rounded-xl border border-slate-200/90 space-y-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#1D4ED8]" />
                  <span>Kết quả &amp; Lịch sử làm bài</span>
                </h3>
                <span className="text-[11px] text-slate-500">{localAttempts.length} lần thi</span>
              </div>

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
