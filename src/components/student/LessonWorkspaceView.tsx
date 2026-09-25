"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Video, 
  PenTool, 
  FileText, 
  BookOpen, 
  Clock, 
  CheckCircle2, 
  Play, 
  ExternalLink, 
  ChevronRight, 
  Download, 
  Layers, 
  Zap, 
  FileUp, 
  Sparkles,
  HelpCircle,
  Award
} from "lucide-react";
import { Profile } from "@/types";

interface LessonWorkspaceViewProps {
  lesson: any;
  profile?: Profile | null;
  onBackToCatalog: () => void;
  onStartQuiz: (quizId: string, quizTitle: string, isHomework: boolean, durationMinutes?: number) => void;
}

/**
 * Hàm chuẩn hóa link video YouTube hoặc Google Drive sang URL nhúng iframe an toàn
 */
function getEmbedVideoUrl(url: string): string {
  if (!url) return "";
  try {
    const trimmed = url.trim();
    // YouTube Watch URL
    if (trimmed.includes("youtube.com/watch?v=")) {
      const videoId = trimmed.split("v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    // YouTube Short URL
    if (trimmed.includes("youtu.be/")) {
      const videoId = trimmed.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    // YouTube Embed URL
    if (trimmed.includes("youtube.com/embed/")) {
      return trimmed;
    }
    // Google Drive URL
    if (trimmed.includes("drive.google.com/file/d/")) {
      const parts = trimmed.split("/file/d/")[1]?.split("/")[0];
      return `https://drive.google.com/file/d/${parts}/preview`;
    }
    return trimmed;
  } catch (e) {
    return url;
  }
}

export function LessonWorkspaceView({
  lesson,
  profile,
  onBackToCatalog,
  onStartQuiz
}: LessonWorkspaceViewProps) {
  // Tab video hiện tại: 'lecture' (Bài giảng) hoặc 'homework_solution' (Chữa BTVN)
  const [videoTab, setVideoTab] = useState<"lecture" | "homework_solution">("lecture");

  // Phân loại danh sách video bài học
  const allVideos: any[] = useMemo(() => lesson?.video_list || [], [lesson?.video_list]);

  // 1. Video bài giảng lý thuyết (type === 'lecture' hoặc chưa gắn type)
  const lectureVideos = useMemo(() => {
    return allVideos.filter(v => !v.type || v.type === "lecture");
  }, [allVideos]);

  // 2. Video chữa chi tiết BTVN (type === 'homework_solution')
  const homeworkSolutionVideos = useMemo(() => {
    return allVideos.filter(v => v.type === "homework_solution");
  }, [allVideos]);

  // Danh sách video thuộc tab đang chọn
  const activeTabVideos = useMemo(() => {
    return videoTab === "lecture" ? lectureVideos : homeworkSolutionVideos;
  }, [videoTab, lectureVideos, homeworkSolutionVideos]);

  // Video đang được chọn để phát trong tab hiện tại
  const [selectedLectureIdx, setSelectedLectureIdx] = useState<number>(0);
  const [selectedSolutionIdx, setSelectedSolutionIdx] = useState<number>(0);

  const currentPlayingVideo = useMemo(() => {
    if (videoTab === "lecture") {
      return lectureVideos[selectedLectureIdx] || lectureVideos[0] || null;
    } else {
      return homeworkSolutionVideos[selectedSolutionIdx] || homeworkSolutionVideos[0] || null;
    }
  }, [videoTab, lectureVideos, selectedLectureIdx, homeworkSolutionVideos, selectedSolutionIdx]);

  const currentEmbedUrl = useMemo(() => {
    return currentPlayingVideo ? getEmbedVideoUrl(currentPlayingVideo.url) : "";
  }, [currentPlayingVideo]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#F8FAFC] font-sans text-slate-800 flex flex-col overflow-hidden">
      {/* 1. THANH ĐIỀU HƯỚNG HEADER */}
      <header className="h-[64px] bg-white/90 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-8 shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <button
            type="button"
            onClick={onBackToCatalog}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white/80 hover:bg-slate-100 transition-all text-xs font-bold text-slate-700 shadow-2xs cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" /> Quay lại
          </button>

          <div className="hidden md:flex items-center gap-2 text-[13px] font-medium text-slate-400 truncate">
            <span onClick={onBackToCatalog} className="hover:text-slate-700 cursor-pointer transition-colors shrink-0">
              Chương trình học
            </span>
            <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[#1D4ED8] font-bold truncate">
              {lesson?.title || "Chi tiết bài học"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-slate-800">{profile?.full_name || "Học sinh"}</p>
            <p className="text-[10px] font-bold text-blue-600 uppercase">{profile?.grade || "Lớp 12"}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center text-sm font-black shadow-md border-2 border-white">
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "T"}
          </div>
        </div>
      </header>

      {/* 2. KHÔNG GIAN HỌC TẬP CHÍNH (2 CỘT: TRÁI 8 - PHẢI 4) */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* CỘT TRÁI (8 CỘT): PHÂN HỆ VIDEO BÀI GIẢNG & VIDEO CHỮA BTVN */}
          <div className="lg:col-span-8 space-y-5 text-left">
            
            {/* THANH TAB PHÂN ĐỊNH RÕ RÀNG 2 LOẠI VIDEO */}
            <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVideoTab("lecture")}
                className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                  videoTab === "lecture"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Video Bài Giảng Lý Thuyết</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  videoTab === "lecture" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
                }`}>
                  {lectureVideos.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setVideoTab("homework_solution")}
                className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2.5 cursor-pointer ${
                  videoTab === "homework_solution"
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <PenTool className="w-4 h-4" />
                <span>Video Chữa Chi Tiết BTVN</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  videoTab === "homework_solution" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
                }`}>
                  {homeworkSolutionVideos.length}
                </span>
              </button>
            </div>

            {/* KHUNG PHÁT VIDEO TỈ LỆ CHUẨN 16:9 */}
            <div className="bg-[#0F172A] rounded-2xl overflow-hidden shadow-lg border border-slate-200/80 aspect-video w-full relative flex items-center justify-center">
              {currentEmbedUrl ? (
                <iframe
                  src={currentEmbedUrl}
                  className="w-full h-full border-0"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  title={currentPlayingVideo?.title || "Video bài học"}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 ${
                    videoTab === "lecture" ? "bg-blue-950/80 text-blue-400" : "bg-amber-950/80 text-amber-400"
                  }`}>
                    {videoTab === "lecture" ? <Video className="w-8 h-8" /> : <PenTool className="w-8 h-8" />}
                  </div>
                  <h3 className="font-bold text-base text-white">
                    {videoTab === "lecture" 
                      ? "Chưa có video bài giảng lý thuyết" 
                      : "Chưa có video chữa chi tiết bài tập về nhà"
                    }
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    {videoTab === "lecture"
                      ? "Thầy cô đang chuẩn bị nội dung bài giảng video cho bài học này. Em vui lòng xem tài liệu hoặc tham gia buổi học trực tuyến."
                      : "Video giải chi tiết BTVN sẽ được cập nhật sau khi hoàn thành buổi học hoặc hạn nộp bài tập."
                    }
                  </p>
                </div>
              )}
            </div>

            {/* DANH SÁCH CÁC PHẦN VIDEO NẾU CÓ NHIỀU HƠN 1 VIDEO TRONG TAB */}
            {activeTabVideos.length > 1 && (
              <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> Danh sách các phần video ({activeTabVideos.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeTabVideos.map((vid, idx) => {
                    const isSelected = (videoTab === "lecture" ? selectedLectureIdx : selectedSolutionIdx) === idx;
                    return (
                      <button
                        key={vid.id || idx}
                        type="button"
                        onClick={() => {
                          if (videoTab === "lecture") setSelectedLectureIdx(idx);
                          else setSelectedSolutionIdx(idx);
                        }}
                        className={`p-3 rounded-xl border text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? videoTab === "lecture"
                              ? "bg-blue-50/80 border-[#1D4ED8] text-[#1D4ED8] ring-2 ring-blue-500/20"
                              : "bg-amber-50/80 border-amber-500 text-amber-800 ring-2 ring-amber-500/20"
                            : "bg-slate-50/60 border-slate-100 hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Play className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "fill-current" : "text-slate-400"}`} />
                          <span className="text-xs font-bold truncate">
                            {vid.title || `Phần ${idx + 1}`}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-white/80 shadow-2xs shrink-0">
                            Đang phát
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* THÔNG TIN CHI TIẾT BÀI HỌC HIỆN TẠI */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-blue-50 text-[#1D4ED8] border border-blue-100 text-[10px] font-black uppercase tracking-wider">
                    {lesson?.format || "Zoom"}
                  </span>
                  {lesson?.target_mode && (
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      lesson.target_mode === "online"
                        ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                        : lesson.target_mode === "offline"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}>
                      {lesson.target_mode === "online" ? "Lớp Online" : lesson.target_mode === "offline" ? "Lớp Offline" : "Toàn khóa"}
                    </span>
                  )}
                  <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> {lesson?.duration || 45} phút
                  </span>
                </div>

                {currentPlayingVideo?.url && (
                  <a
                    href={currentPlayingVideo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    <span>Mở link gốc</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                {lesson?.title}
              </h1>

              {lesson?.description ? (
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal whitespace-pre-wrap">
                  {lesson.description}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Bài học thuộc chuyên đề trọng tâm ôn thi Tốt nghiệp THPT và Đánh giá Năng lực TCT.
                </p>
              )}
            </div>
          </div>

          {/* CỘT PHẢI (4 CỘT): TÀI LIỆU, VIẾT TAY, BÀI TẬP VỀ NHÀ & ĐỀ KIỂM TRA */}
          <div className="lg:col-span-4 space-y-5 text-left">

            {/* KHỐI 1: BÀI TẬP VỀ NHÀ (BTVN) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-[#1D4ED8]" /> Bài tập về nhà (BTVN)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-[#1D4ED8]">
                  {(lesson?.homework_files || []).length}
                </span>
              </div>

              {(!lesson?.homework_files || lesson.homework_files.length === 0) ? (
                <p className="text-center text-slate-400 text-xs py-4 font-medium">
                  Chưa có bài tập về nhà cho bài học này.
                </p>
              ) : (
                <div className="space-y-2">
                  {lesson.homework_files.map((hw: any, idx: number) => {
                    const isQuiz = hw.is_quiz !== false;
                    return (
                      <div
                        key={hw.id || idx}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-[#1D4ED8]/60 transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-bold text-xs text-slate-900 line-clamp-1">
                            {hw.title || `BTVN Phần ${idx + 1}`}
                          </h4>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-blue-100 text-blue-800 shrink-0">
                            {isQuiz ? "Trắc nghiệm" : "Tài liệu"}
                          </span>
                        </div>

                        {isQuiz ? (
                          <button
                            type="button"
                            onClick={() => onStartQuiz(hw.id, hw.title || "Bài tập về nhà", true, hw.duration_minutes || 45)}
                            className="w-full py-2 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-white" /> Bắt đầu làm BTVN
                          </button>
                        ) : hw.url ? (
                          <a
                            href={hw.url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <ExternalLink className="w-3 h-3 text-slate-500" /> Xem file bài tập
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* KHỐI 2: ĐỀ KIỂM TRA ĐỊNH KỲ (ĐỀ KT) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-600" /> Đề kiểm tra định kỳ
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700">
                  {(lesson?.test_quizzes || []).length}
                </span>
              </div>

              {(!lesson?.test_quizzes || lesson.test_quizzes.length === 0) ? (
                <p className="text-center text-slate-400 text-xs py-4 font-medium">
                  Chưa có đề kiểm tra định kỳ.
                </p>
              ) : (
                <div className="space-y-2">
                  {lesson.test_quizzes.map((test: any, idx: number) => (
                    <div
                      key={test.id || idx}
                      className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/30 hover:bg-white hover:border-emerald-400 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-xs text-slate-900 line-clamp-1">
                          {test.title || `Đề kiểm tra ${idx + 1}`}
                        </h4>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 shrink-0">
                          Đề KT
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onStartQuiz(test.id, test.title || "Đề kiểm tra", false, test.duration_minutes || 45)}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-white" /> Vào phòng thi kiểm tra
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* KHỐI 3: TÀI LIỆU BÀI GIẢNG & GHI CHÉP VIẾT TAY */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" /> Tài liệu & Viết tay
                </h3>
              </div>

              <div className="space-y-2">
                {/* File bài giảng */}
                {(lesson?.lecture_files || []).map((file: any, idx: number) => (
                  <a
                    key={file.id || idx}
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-slate-50 hover:bg-blue-50/60 border border-slate-200 rounded-xl transition flex items-center justify-between gap-2 group text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-800 group-hover:text-[#1D4ED8] truncate">
                        {file.title || `Bài giảng ${idx + 1}`}
                      </span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
                  </a>
                ))}

                {/* Ghi chép viết tay */}
                {(lesson?.handwritten_notes || []).map((note: any, idx: number) => (
                  <a
                    key={note.id || idx}
                    href={note.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 rounded-xl transition flex items-center justify-between gap-2 group text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 truncate">
                        {note.title || `Ghi chép viết tay ${idx + 1}`}
                      </span>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                  </a>
                ))}

                {(!lesson?.lecture_files || lesson.lecture_files.length === 0) &&
                 (!lesson?.handwritten_notes || lesson.handwritten_notes.length === 0) && (
                  <p className="text-center text-slate-400 text-xs py-2 font-medium">
                    Chưa có tài liệu đính kèm.
                  </p>
                )}
              </div>
            </div>

            {/* KHỐI 4: TÀI LIỆU TĂNG CƯỜNG (NẾU CÓ) */}
            {lesson?.extra_resources && lesson.extra_resources.length > 0 && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-black text-amber-600 uppercase tracking-wider flex items-center gap-2">
                    <Zap className="w-4 h-4 fill-amber-500" /> Tài liệu tăng cường
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700">
                    {lesson.extra_resources.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {lesson.extra_resources.map((item: any, idx: number) => (
                    <a
                      key={item.id || idx}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 bg-amber-50/40 hover:bg-amber-50 border border-amber-200/80 rounded-xl transition flex items-center justify-between gap-2 group text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 group-hover:text-amber-700 truncate">
                          {item.title}
                        </p>
                        {item.note && (
                          <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                            {item.note}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>
      </main>
    </div>
  );
}

export default LessonWorkspaceView;

