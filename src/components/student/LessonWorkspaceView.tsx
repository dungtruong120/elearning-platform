"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  ArrowLeft,
  Video,
  PenTool,
  FileText,
  BookOpen,
  Clock,
  Play,
  ExternalLink,
  ChevronRight,
  Layers,
  Zap,
  Award,
  Loader2,
  Printer
} from "lucide-react";
import { Profile, ExamAttempt } from "@/types";
import {
  openPrintableDynamicAnswerSheet,
  formatStudentAutoSBD,
  resolveCompleteExamObject
} from "@/lib/omrEngine";
import { ExamEntryModal } from "@/components/student/ExamEntryModal";
import { DigitalAnswerSheetView } from "@/components/student/paper/DigitalAnswerSheetView";
import { PaperScanModal } from "@/components/student/paper/PaperScanModal";
import { PaperReviewView } from "@/components/student/paper/PaperReviewView";
import { supabase } from "@/lib/supabaseClient";

const SafePaperScanModal = PaperScanModal as React.ComponentType<any>;

interface LessonWorkspaceViewProps {
  lesson: any;
  profile?: Profile | null;
  onBackToCatalog: () => void;
  onStartQuiz: (
    quizId: string,
    quizTitle: string,
    isHomework: boolean,
    durationMinutes?: number
  ) => void;
}

/**
 * Hàm chuẩn hóa link video YouTube hoặc Google Drive sang URL nhúng iframe an toàn
 */
function getEmbedVideoUrl(url: string): string {
  if (!url) return "";
  try {
    const trimmed = url.trim();
    if (trimmed.includes("youtube.com/watch?v=")) {
      const videoId = trimmed.split("v=")[1]?.split("&")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (trimmed.includes("youtu.be/")) {
      const videoId = trimmed.split("youtu.be/")[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    if (trimmed.includes("youtube.com/embed/")) {
      return trimmed;
    }
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
  const [videoTab, setVideoTab] = useState<"lecture" | "homework_solution">("lecture");
  const [isVideoLoading, setIsVideoLoading] = useState<boolean>(true);

  const [selectedQuizForEntry, setSelectedQuizForEntry] = useState<any | null>(null);
  const [isEntryHomework, setIsEntryHomework] = useState<boolean>(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [isResolvingExam, setIsResolvingExam] = useState<boolean>(false);

  const [activeDigitalExam, setActiveDigitalExam] = useState<any | null>(null);
  const [activePaperScanExam, setActivePaperScanExam] = useState<any | null>(null);
  const [reviewingPaperAttempt, setReviewingPaperAttempt] = useState<{
    attempt: ExamAttempt;
    exam: any;
  } | null>(null);

  // Số báo danh tự động của học sinh (đồng bộ 100% với Bảng SBD Lớp của Admin)
  const [studentAutoSbd, setStudentAutoSbd] = useState<string>(() =>
    formatStudentAutoSBD(profile)
  );

  useEffect(() => {
    let isMounted = true;
    const syncCanonicalSbdFromDb = async () => {
      if (!profile) return;
      try {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, full_name, role, school, grade")
          .neq("role", "admin");

        if (Array.isArray(profs) && profs.length > 0) {
          const sorted = [...profs].sort((a: any, b: any) =>
            String(a.full_name || a.username || "").localeCompare(
              String(b.full_name || b.username || ""),
              "vi"
            )
          );
          const dir = sorted.map((p: any, i: number) => ({
            stt: i + 1,
            sbd: String(i + 1).padStart(6, "0"),
            id: String(p.id || ""),
            username: String(p.username || ""),
            full_name: String(p.full_name || p.username || "Học sinh")
          }));
          if (typeof window !== "undefined") {
            localStorage.setItem("edunexus_sbd_directory", JSON.stringify(dir));
          }
          if (isMounted) {
            setStudentAutoSbd(formatStudentAutoSBD(profile, dir));
          }
          return;
        }
      } catch {}

      if (isMounted) {
        setStudentAutoSbd(formatStudentAutoSBD(profile));
      }
    };

    syncCanonicalSbdFromDb();
    return () => {
      isMounted = false;
    };
  }, [profile]);

  const fallbackProfile: Profile = useMemo(() => {
    if (profile) return profile;
    return {
      id: "student-guest",
      username: "student",
      full_name: "Học sinh",
      role: "student",
      grade: "Lớp 12",
      school: "THPT"
    } as Profile;
  }, [profile]);

  const allVideos: any[] = useMemo(() => lesson?.video_list || [], [lesson?.video_list]);

  const lectureVideos = useMemo(() => {
    return allVideos.filter((v) => !v.type || v.type === "lecture");
  }, [allVideos]);

  const homeworkSolutionVideos = useMemo(() => {
    return allVideos.filter((v) => v.type === "homework_solution");
  }, [allVideos]);

  const activeTabVideos = useMemo(() => {
    return videoTab === "lecture" ? lectureVideos : homeworkSolutionVideos;
  }, [videoTab, lectureVideos, homeworkSolutionVideos]);

  const [selectedLectureIdx, setSelectedLectureIdx] = useState<number>(0);
  const [selectedSolutionIdx, setSelectedSolutionIdx] = useState<number>(0);

  const currentPlayingVideo = useMemo(() => {
    if (videoTab === "lecture") {
      return lectureVideos[selectedLectureIdx] || lectureVideos[0] || null;
    } else {
      return homeworkSolutionVideos[selectedSolutionIdx] || homeworkSolutionVideos[0] || null;
    }
  }, [
    videoTab,
    lectureVideos,
    selectedLectureIdx,
    homeworkSolutionVideos,
    selectedSolutionIdx
  ]);

  const currentEmbedUrl = useMemo(() => {
    return currentPlayingVideo ? getEmbedVideoUrl(currentPlayingVideo.url) : "";
  }, [currentPlayingVideo]);

  /**
   * Nạp đầy đủ dữ liệu câu hỏi của đề thi / BTVN Tổng Ôn (100+ câu) từ localStorage hoặc Supabase (`quizzes` & `practice_exams`)
   */
  const resolveFullExamData = useCallback(async (rawQuizItem: any, isHw: boolean) => {
    if (!rawQuizItem) return null;

    // 1. Thử tìm trong kho localStorage trước
    const localResolved = resolveCompleteExamObject(rawQuizItem);
    const hasQuestionsLocal =
      (Array.isArray(localResolved?.data) && localResolved.data.length > 0) ||
      (Array.isArray(localResolved?.sections) && localResolved.sections.length > 0) ||
      (Array.isArray(localResolved?.questions) && localResolved.questions.length > 0);

    if (hasQuestionsLocal) {
      return {
        ...localResolved,
        is_homework: isHw
      };
    }

    const targetId = String(
      rawQuizItem.quiz_id || rawQuizItem.exam_id || rawQuizItem.id || ""
    ).trim();
    const targetTitle = String(rawQuizItem.title || "").trim();

    try {
      setIsResolvingExam(true);

      // 2. Tìm trên bảng quizzes theo id
      if (targetId) {
        const { data: dbQuiz } = await supabase
          .from("quizzes")
          .select("*")
          .eq("id", targetId)
          .maybeSingle();

        if (dbQuiz && (dbQuiz.data || dbQuiz.questions || dbQuiz.sections)) {
          return {
            ...dbQuiz,
            ...rawQuizItem,
            data: dbQuiz.data || dbQuiz.sections || rawQuizItem.data,
            questions: dbQuiz.questions || rawQuizItem.questions,
            is_homework: isHw
          };
        }

        // 3. Tìm trên bảng practice_exams theo id
        const { data: dbPrac } = await supabase
          .from("practice_exams")
          .select("*")
          .eq("id", targetId)
          .maybeSingle();

        if (dbPrac && (dbPrac.data || dbPrac.questions || dbPrac.sections)) {
          return {
            ...dbPrac,
            ...rawQuizItem,
            data: dbPrac.data || dbPrac.sections || rawQuizItem.data,
            questions: dbPrac.questions || rawQuizItem.questions,
            is_homework: isHw
          };
        }
      }

      // 4. Tìm theo tiêu đề nếu id là id tạm của file đính kèm
      if (targetTitle) {
        const { data: byTitleQuiz } = await supabase
          .from("quizzes")
          .select("*")
          .ilike("title", targetTitle)
          .limit(1)
          .maybeSingle();

        if (byTitleQuiz && (byTitleQuiz.data || byTitleQuiz.questions)) {
          return {
            ...byTitleQuiz,
            ...rawQuizItem,
            data: byTitleQuiz.data || byTitleQuiz.sections,
            questions: byTitleQuiz.questions,
            is_homework: isHw
          };
        }

        const { data: byTitlePrac } = await supabase
          .from("practice_exams")
          .select("*")
          .ilike("title", targetTitle)
          .limit(1)
          .maybeSingle();

        if (byTitlePrac && (byTitlePrac.data || byTitlePrac.questions)) {
          return {
            ...byTitlePrac,
            ...rawQuizItem,
            data: byTitlePrac.data || byTitlePrac.sections,
            questions: byTitlePrac.questions,
            is_homework: isHw
          };
        }
      }
    } catch {
    } finally {
      setIsResolvingExam(false);
    }

    return {
      ...rawQuizItem,
      is_homework: isHw
    };
  }, []);

  const handleOpenExamEntry = async (quizItem: any, isHomeworkFlag: boolean) => {
    const resolved = await resolveFullExamData(quizItem, isHomeworkFlag);
    setSelectedQuizForEntry(resolved);
    setIsEntryHomework(isHomeworkFlag);
    setIsEntryModalOpen(true);
  };

  const handlePrintSheetForQuiz = async (quizItem: any, isHomeworkFlag: boolean) => {
    const resolved = await resolveFullExamData(quizItem, isHomeworkFlag);
    openPrintableDynamicAnswerSheet({
      ...resolved,
      examTitle:
        resolved?.title || (isHomeworkFlag ? "Bài tập về nhà" : "Đề kiểm tra định kỳ"),
      studentSbd: studentAutoSbd,
      studentName: fallbackProfile.full_name || ""
    });
  };

  const handlePaperScanCompleted = useCallback(
    (attemptRecord: ExamAttempt) => {
      const scannedExam = activePaperScanExam;
      setActivePaperScanExam(null);
      if (attemptRecord && scannedExam) {
        setReviewingPaperAttempt({
          attempt: attemptRecord,
          exam: scannedExam
        });
      }
    },
    [activePaperScanExam]
  );

  if (activeDigitalExam) {
    return (
      <DigitalAnswerSheetView
        exam={activeDigitalExam}
        profile={fallbackProfile}
        isHomework={isEntryHomework}
        onBack={() => setActiveDigitalExam(null)}
        onSubmitted={(attemptRecord) => {
          setActiveDigitalExam(null);
          setReviewingPaperAttempt({
            attempt: attemptRecord,
            exam: activeDigitalExam
          });
        }}
      />
    );
  }

  if (reviewingPaperAttempt) {
    return (
      <PaperReviewView
        attempt={reviewingPaperAttempt.attempt}
        exam={reviewingPaperAttempt.exam}
        profile={fallbackProfile}
        onBack={() => setReviewingPaperAttempt(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-[#F8FAFC] antialiased text-slate-800 tracking-tight flex flex-col overflow-hidden">
      {/* 1. THANH ĐIỀU HƯỚNG HEADER TINH GỌN */}
      <header className="h-14 sm:h-15 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-3.5 sm:px-6 shrink-0 z-20 shadow-2xs">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onBackToCatalog}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500" /> Quay lại
          </button>

          <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-400 truncate">
            <span
              onClick={onBackToCatalog}
              className="hover:text-slate-700 cursor-pointer transition-colors shrink-0"
            >
              Chương trình học
            </span>
            <ChevronRight className="w-3 h-3 shrink-0" />
            <span className="text-blue-700 font-semibold truncate">
              {lesson?.title || "Chi tiết bài học"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {isResolvingExam && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Đang nạp câu hỏi...
            </span>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-800 leading-tight">
              {profile?.full_name || "Học sinh"}
            </p>
            <p className="text-[10px] font-medium text-blue-600 uppercase">
              {profile?.grade || "Lớp 12"} • SBD: {studentAutoSbd}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold shadow-2xs border border-white">
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "T"}
          </div>
        </div>
      </header>

      {/* 2. KHÔNG GIAN HỌC TẬP CHÍNH (2 CỘT: TRÁI 8 - PHẢI 4) */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-3.5 sm:p-5 lg:p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          {/* CỘT TRÁI (8 CỘT): PHÂN HỆ VIDEO BÀI GIẢNG & VIDEO CHỮA BTVN */}
          <div className="lg:col-span-8 space-y-4 text-left">
            <div className="bg-white p-1 rounded-xl border border-slate-200/80 shadow-2xs flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setVideoTab("lecture");
                  setIsVideoLoading(true);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  videoTab === "lecture"
                    ? "bg-blue-600 text-white shadow-2xs"
                    : "bg-slate-50/80 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Video Bài Giảng Lý Thuyết</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                    videoTab === "lecture"
                      ? "bg-white/20 text-white"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {lectureVideos.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setVideoTab("homework_solution");
                  setIsVideoLoading(true);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  videoTab === "homework_solution"
                    ? "bg-amber-600 text-white shadow-2xs"
                    : "bg-slate-50/80 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Video Chữa Chi Tiết BTVN</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                    videoTab === "homework_solution"
                      ? "bg-white/20 text-white"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {homeworkSolutionVideos.length}
                </span>
              </button>
            </div>

            <div className="bg-[#0F172A] rounded-2xl overflow-hidden shadow-xs border border-slate-200/80 aspect-video w-full relative flex items-center justify-center">
              {currentEmbedUrl ? (
                <>
                  {isVideoLoading && (
                    <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-slate-400 gap-2 z-10 animate-pulse">
                      <div className="w-10 h-10 rounded-full border-2 border-slate-700 border-t-blue-500 animate-spin" />
                      <span className="text-xs font-medium text-slate-300">
                        Đang chuẩn bị video bài học...
                      </span>
                    </div>
                  )}
                  <iframe
                    src={currentEmbedUrl}
                    className="w-full h-full border-0"
                    allowFullScreen
                    onLoad={() => setIsVideoLoading(false)}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    title={currentPlayingVideo?.title || "Video bài học"}
                  />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 ${
                      videoTab === "lecture"
                        ? "bg-blue-950/70 text-blue-400"
                        : "bg-amber-950/70 text-amber-400"
                    }`}
                  >
                    {videoTab === "lecture" ? (
                      <Video className="w-6 h-6" />
                    ) : (
                      <PenTool className="w-6 h-6" />
                    )}
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base text-white">
                    {videoTab === "lecture"
                      ? "Chưa có video bài giảng lý thuyết"
                      : "Chưa có video chữa chi tiết bài tập về nhà"}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm font-normal">
                    {videoTab === "lecture"
                      ? "Thầy cô đang hoàn thiện nội dung video cho bài học này. Em vui lòng xem tài liệu hoặc tham gia buổi học trực tuyến."
                      : "Video giải chi tiết BTVN sẽ được cập nhật sau khi hoàn thành buổi học hoặc hạn nộp bài tập."}
                  </p>
                </div>
              )}
            </div>

            {activeTabVideos.length > 1 && (
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
                <h4 className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-500" /> Danh sách các phần video (
                  {activeTabVideos.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {activeTabVideos.map((vid, idx) => {
                    const isSelected =
                      (videoTab === "lecture" ? selectedLectureIdx : selectedSolutionIdx) === idx;
                    return (
                      <button
                        key={vid.id || idx}
                        type="button"
                        onClick={() => {
                          setIsVideoLoading(true);
                          if (videoTab === "lecture") setSelectedLectureIdx(idx);
                          else setSelectedSolutionIdx(idx);
                        }}
                        className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? videoTab === "lecture"
                              ? "bg-blue-50/80 border-blue-600 text-blue-800 ring-1 ring-blue-500/20"
                              : "bg-amber-50/80 border-amber-500 text-amber-800 ring-1 ring-amber-500/20"
                            : "bg-slate-50/60 border-slate-100 hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Play
                            className={`w-3 h-3 shrink-0 ${
                              isSelected ? "fill-current" : "text-slate-400"
                            }`}
                          />
                          <span className="text-xs font-semibold truncate">
                            {vid.title || `Phần ${idx + 1}`}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-white shadow-2xs shrink-0">
                            Đang phát
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-semibold uppercase tracking-wider">
                    {lesson?.format || "Zoom"}
                  </span>
                  {lesson?.target_mode && (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        lesson.target_mode === "online"
                          ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                          : lesson.target_mode === "offline"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {lesson.target_mode === "online"
                        ? "Lớp Online"
                        : lesson.target_mode === "offline"
                        ? "Lớp Offline"
                        : "Toàn khóa"}
                    </span>
                  )}
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> {lesson?.duration || 45} phút
                  </span>
                </div>

                {currentPlayingVideo?.url && (
                  <a
                    href={currentPlayingVideo.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                  >
                    <span>Mở link gốc</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <h1 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">
                {lesson?.title}
              </h1>

              {lesson?.description ? (
                <p className="text-xs text-slate-600 leading-relaxed font-normal whitespace-pre-wrap">
                  {lesson.description}
                </p>
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Bài học thuộc chuyên đề trọng tâm ôn thi Tốt nghiệp THPT và Đánh giá Năng lực TCT.
                </p>
              )}
            </div>
          </div>

          {/* CỘT PHẢI (4 CỘT): COMPACT ACTION PANEL */}
          <div className="lg:col-span-4 space-y-4 text-left">
            {/* KHỐI 1: BÀI TẬP VỀ NHÀ (BTVN) */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-blue-600" /> Bài tập về nhà
                </h3>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">
                  {(lesson?.homework_files || []).length}
                </span>
              </div>

              {!lesson?.homework_files || lesson.homework_files.length === 0 ? (
                <p className="text-center text-slate-400 text-xs py-3 font-normal italic">
                  Chưa có bài tập về nhà cho bài học này.
                </p>
              ) : (
                <div className="space-y-2">
                  {lesson.homework_files.map((hw: any, idx: number) => {
                    const isQuiz = hw.is_quiz !== false;
                    return (
                      <div
                        key={hw.id || idx}
                        className="p-3 rounded-lg border border-slate-200/70 bg-slate-50/50 hover:bg-white hover:border-blue-200 transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-xs text-slate-800 line-clamp-1">
                            {hw.title || `BTVN Phần ${idx + 1}`}
                          </h4>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                            {isQuiz ? "Trắc nghiệm" : "Tài liệu"}
                          </span>
                        </div>

                        {isQuiz ? (
                          <div className="space-y-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenExamEntry(hw, true)}
                              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-white" /> Bắt đầu làm BTVN
                            </button>

                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => handlePrintSheetForQuiz(hw, true)}
                                className="py-1.5 px-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                                title="Tải hoặc in phiếu trả lời trắc nghiệm A4 theo cấu trúc BTVN này"
                              >
                                <Printer className="w-3 h-3" /> In Phiếu A4
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  const resolved = await resolveFullExamData(hw, true);
                                  setIsEntryHomework(true);
                                  setActiveDigitalExam(resolved);
                                }}
                                className="py-1.5 px-2 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                                title="Mở nhanh Phiếu tô trắc nghiệm Online trên màn hình"
                              >
                                <PenTool className="w-3 h-3" /> Tô Phiếu Onl
                              </button>
                            </div>
                          </div>
                        ) : hw.url ? (
                          <a
                            href={hw.url}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1 shadow-2xs"
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

            {/* KHỐI 2: ĐỀ KIỂM TRA ĐỊNH KỲ */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-emerald-600" /> Đề kiểm tra định kỳ
                </h3>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                  {(lesson?.test_quizzes || []).length}
                </span>
              </div>

              {!lesson?.test_quizzes || lesson.test_quizzes.length === 0 ? (
                <p className="text-center text-slate-400 text-xs py-3 font-normal italic">
                  Chưa có đề kiểm tra định kỳ.
                </p>
              ) : (
                <div className="space-y-2">
                  {lesson.test_quizzes.map((test: any, idx: number) => (
                    <div
                      key={test.id || idx}
                      className="p-3 rounded-lg border border-emerald-100 bg-emerald-50/20 hover:bg-white hover:border-emerald-300 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold text-xs text-slate-800 line-clamp-1">
                          {test.title || `Đề kiểm tra ${idx + 1}`}
                        </h4>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-emerald-100 text-emerald-800 shrink-0">
                          Đề KT
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenExamEntry(test, false)}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-white" /> Vào phòng thi kiểm tra
                        </button>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handlePrintSheetForQuiz(test, false)}
                            className="py-1.5 px-2 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                            title="Tải hoặc in phiếu trả lời trắc nghiệm A4 theo cấu trúc Đề KT này"
                          >
                            <Printer className="w-3 h-3" /> In Phiếu A4
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              const resolved = await resolveFullExamData(test, false);
                              setIsEntryHomework(false);
                              setActiveDigitalExam(resolved);
                            }}
                            className="py-1.5 px-2 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                            title="Mở nhanh Phiếu tô trắc nghiệm Online trên màn hình"
                          >
                            <PenTool className="w-3 h-3" /> Tô Phiếu Onl
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* KHỐI 3: TÀI LIỆU BÀI GIẢNG & GHI CHÉP VIẾT TAY */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-600" /> Tài liệu & Viết tay
                </h3>
              </div>

              <div className="space-y-1.5">
                {(lesson?.lecture_files || []).map((file: any, idx: number) => (
                  <a
                    key={file.id || idx}
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-2.5 bg-slate-50 hover:bg-blue-50/60 border border-slate-100 hover:border-blue-200 rounded-lg transition flex items-center justify-between gap-2 group text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700 truncate">
                        {file.title || `Bài giảng ${idx + 1}`}
                      </span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-600 shrink-0" />
                  </a>
                ))}

                {(lesson?.handwritten_notes || []).map((note: any, idx: number) => (
                  <a
                    key={note.id || idx}
                    href={note.url}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-2.5 bg-slate-50 hover:bg-indigo-50/60 border border-slate-100 hover:border-indigo-200 rounded-lg transition flex items-center justify-between gap-2 group text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="text-xs font-medium text-slate-700 group-hover:text-indigo-600 truncate">
                        {note.title || `Ghi chép viết tay ${idx + 1}`}
                      </span>
                    </div>
                    <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                  </a>
                ))}

                {(!lesson?.lecture_files || lesson.lecture_files.length === 0) &&
                  (!lesson?.handwritten_notes || lesson.handwritten_notes.length === 0) && (
                    <p className="text-center text-slate-400 text-xs py-2 font-normal italic">
                      Chưa có tài liệu đính kèm.
                    </p>
                  )}
              </div>
            </div>

            {/* KHỐI 4: TÀI LIỆU TĂNG CƯỜNG */}
            {lesson?.extra_resources && lesson.extra_resources.length > 0 && (
              <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 fill-amber-500 text-amber-500" /> Tài liệu tăng
                    cường
                  </h3>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">
                    {lesson.extra_resources.length}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {lesson.extra_resources.map((item: any, idx: number) => (
                    <a
                      key={item.id || idx}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 px-2.5 bg-amber-50/40 hover:bg-amber-50 border border-amber-200/70 rounded-lg transition flex items-center justify-between gap-2 group text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800 group-hover:text-amber-800 truncate">
                          {item.title}
                        </p>
                        {item.note && (
                          <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                            {item.note}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="w-3 h-3 text-amber-600 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 3. POPUP CHỌN HÌNH THỨC LÀM BÀI (WEB vs QUÉT PHIẾU GIẤY vs TÔ PHIẾU ONLINE) */}
      <ExamEntryModal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        exam={selectedQuizForEntry}
        isHomework={isEntryHomework}
        studentSbd={studentAutoSbd}
        studentName={fallbackProfile.full_name || "Học sinh"}
        onSelectWeb={() => {
          if (!selectedQuizForEntry) return;
          const qId = String(
            selectedQuizForEntry.quiz_id ||
              selectedQuizForEntry.exam_id ||
              selectedQuizForEntry.id ||
              ""
          );
          const qTitle =
            selectedQuizForEntry.title ||
            (isEntryHomework ? "Bài tập về nhà" : "Đề kiểm tra");
          const qDuration = Number(
            selectedQuizForEntry.duration_minutes || selectedQuizForEntry.duration || 45
          );
          onStartQuiz(qId, qTitle, isEntryHomework, qDuration);
        }}
        onSelectPaperScan={() => {
          if (!selectedQuizForEntry) return;
          setActivePaperScanExam(selectedQuizForEntry);
        }}
        onSelectDigitalSheet={() => {
          if (!selectedQuizForEntry) return;
          setActiveDigitalExam(selectedQuizForEntry);
        }}
      />

      {/* 4. MODAL CHỤP / TẢI ẢNH QUÉT PHIẾU GIẤY (NHÁNH 2A - TƯƠNG THÍCH ĐA PROP INTERFACE) */}
      {activePaperScanExam && (
        <SafePaperScanModal
          isOpen={Boolean(activePaperScanExam)}
          onClose={() => setActivePaperScanExam(null)}
          exam={activePaperScanExam}
          profile={fallbackProfile}
          isHomework={isEntryHomework}
          onSubmitted={handlePaperScanCompleted}
          onScanSuccess={handlePaperScanCompleted}
          onComplete={handlePaperScanCompleted}
        />
      )}
    </div>
  );
}

export default LessonWorkspaceView;
