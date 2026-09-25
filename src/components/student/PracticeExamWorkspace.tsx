"use client";

import React, { useMemo } from "react";
import { 
  ArrowLeft, 
  Trophy, 
  Clock, 
  FileText, 
  Video, 
  ExternalLink, 
  History, 
  Play, 
  ChevronRight 
} from "lucide-react";
import { Profile } from "@/types";
import { formatEmbedUrl } from "@/lib/utils";

interface PracticeExamWorkspaceProps {
  exam: any;
  profile: Profile;
  attempts: any[];
  onBack: () => void;
  onRetake: () => void;
  onViewFile: () => void;
}

export default function PracticeExamWorkspace({
  exam,
  profile,
  attempts = [],
  onBack,
  onRetake,
  onViewFile
}: PracticeExamWorkspaceProps) {
  // Sắp xếp lịch sử thi: Lần nộp mới nhất nằm trên đầu
  const sortedAttempts = useMemo(() => {
    return [...attempts].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }, [attempts]);

  // Lấy điểm số cao nhất trong tất cả các lần thi của đề này
  const maxScore = useMemo(() => {
    if (attempts.length === 0) return 0;
    return Math.max(...attempts.map(a => Number(a.score) || 0));
  }, [attempts]);

  // Định dạng thời gian hoàn thành (phút, giây)
  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec) || sec <= 0) return "0s";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return s + "s";
    return m + "p " + s + "s";
  };

  const videoUrl = exam.solutionVideoUrl || exam.videoUrl || "";
  const embedSrc = formatEmbedUrl(videoUrl);
  const canViewFile = exam.allowViewFile !== false;

  return (
    <div className="fixed inset-0 z-[100] bg-[#F8FAFC] font-sans text-slate-800 flex flex-col overflow-hidden text-left">
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
                    Giáo viên chưa cập nhật video hướng dẫn giải chi tiết cho đề thi này. Bạn có thể xem file đính kèm (nếu có) hoặc làm bài thi ở khung bên phải.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-blue-50 text-[#1D4ED8] border border-blue-100">
                  {exam.category || "Luyện đề"}
                </span>
                <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> {exam.duration_minutes} phút làm bài
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {"Hướng dẫn chữa chi tiết: " + exam.title}
              </h1>
              <p className="text-xs text-slate-500 leading-relaxed font-normal">
                Hãy theo dõi video chữa bài chi tiết để rút kinh nghiệm các câu hỏi sai. Nếu muốn luyện tập lại, bạn có thể xem file đính kèm hoặc bấm vào thi trực tiếp.
              </p>
            </div>
          </div>

          {/* CỘT PHẢI (4 CỘT): ĐIỂM SỐ, LỊCH SỬ THI & FILE ĐỀ */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* KHỐI 1: TỔNG QUAN ĐIỂM CAO NHẤT */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" /> Kết quả cao nhất
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {attempts.length} lần thi
                </span>
              </div>

              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 font-black text-2xl shrink-0 shadow-inner">
                  {maxScore > 0 ? maxScore.toFixed(1) : "--"}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {maxScore > 0 ? "Điểm kỷ lục của bạn" : "Chưa có lượt thi nào"}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {"Thang điểm 10 • Thời gian " + exam.duration_minutes + " phút"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onRetake}
                className="w-full py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-white" /> Làm lại đề thi ngay
              </button>
            </div>

            {/* KHỐI 2: CHI TIẾT LỊCH SỬ CÁC LẦN LÀM (KHÔNG BỊ LỖI TRÙNG LẶP KEY) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <History className="w-4 h-4 text-blue-500" /> {"Lịch sử làm bài (" + attempts.length + ")"}
                </h3>
              </div>

              {sortedAttempts.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 font-medium">
                  Bạn chưa hoàn thành lượt thi nào cho đề này.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1">
                  {sortedAttempts.map((att, idx) => {
                    const isBest = Number(att.score) === maxScore && maxScore > 0;
                    return (
                      <div
                        key={"attempt-" + (att.attemptId || "item") + "-" + idx}
                        className={"p-3 rounded-xl border transition-colors flex items-center justify-between " + (
                          isBest ? "bg-amber-50/50 border-amber-200" : "bg-slate-50/60 border-slate-100"
                        )}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800">
                              {"Lần " + (sortedAttempts.length - idx)}
                            </span>
                            {isBest && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-200 text-amber-900">
                                Cao nhất
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1 font-medium">
                            <span>{new Date(att.submittedAt).toLocaleDateString("vi-VN")}</span>
                            <span>•</span>
                            <span>{formatTime(Number(att.completionTime) || 0)}</span>
                            {att.correctAnswers !== undefined && (
                              <>
                                <span>•</span>
                                <span>{att.correctAnswers + "/" + att.totalQuestions + " câu"}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={"text-sm font-black " + (isBest ? "text-amber-600" : "text-[#1D4ED8]")}>
                            {Number(att.score).toFixed(1)}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-normal">điểm</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* KHỐI 3: TÀI LIỆU FILE ĐỀ THI */}
            {canViewFile && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
                <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                  <FileText className="w-4 h-4 text-emerald-500" /> Tài liệu đính kèm
                </h3>

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
              </div>
            )}

          </div>

        </div>
      </main>
    </div>
  );
}