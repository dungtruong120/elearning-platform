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
  Layers,
  Zap,
  Award,
  Loader2,
  Printer,
  Camera,
  CheckCircle2,
  Eye
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
  } catch {
    return url;
  }
}

export function LessonWorkspaceView({
  lesson,
  profile,
  onBackToCatalog,
  onStartQuiz
}: LessonWorkspaceViewProps) {
  const allVideos: any[] = useMemo(
    () => (Array.isArray(lesson?.video_list) ? lesson.video_list : []),
    [lesson?.video_list]
  );

  const lectureVideos = useMemo(() => {
    return allVideos.filter((v) => !v?.type || v.type === "lecture");
  }, [allVideos]);

  const homeworkSolutionVideos = useMemo(() => {
    return allVideos.filter((v) => v?.type === "homework_solution");
  }, [allVideos]);

  const [videoTab, setVideoTab] = useState<"lecture" | "homework_solution">(() =>
    lectureVideos.length === 0 && homeworkSolutionVideos.length > 0
      ? "homework_solution"
      : "lecture"
  );
  const [isVideoLoading, setIsVideoLoading] = useState<boolean>(true);
  const [selectedLectureIdx, setSelectedLectureIdx] = useState<number>(0);
  const [selectedSolutionIdx, setSelectedSolutionIdx] = useState<number>(0);

  // Tự động chọn tab Chữa BTVN nếu chưa có Video lý thuyết nhưng đã có Video chữa BTVN
  useEffect(() => {
    if (lectureVideos.length === 0 && homeworkSolutionVideos.length > 0) {
      setVideoTab("homework_solution");
    } else {
      setVideoTab("lecture");
    }
    setSelectedLectureIdx(0);
    setSelectedSolutionIdx(0);
    setIsVideoLoading(true);
  }, [lesson?.id, lectureVideos.length, homeworkSolutionVideos.length]);

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

  // Lưu trữ danh sách các lượt nộp bài (bao gồm cả Web và Giấy) để đồng bộ tiến độ hoàn thành
  const [studentAttempts, setStudentAttempts] = useState<any[]>([]);

  // Số báo danh tự động của học sinh (đồng bộ 100% với Bảng SBD Lớp của Admin)
  const [studentAutoSbd, setStudentAutoSbd] = useState<string>(() =>
    formatStudentAutoSBD(profile)
  );

  const loadStudentAttemptsFromStorage = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("edunexus_attempts");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setStudentAttempts(parsed);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadStudentAttemptsFromStorage();
    if (typeof window !== "undefined") {
      window.addEventListener("storage", loadStudentAttemptsFromStorage);
      return () => window.removeEventListener("storage", loadStudentAttemptsFromStorage);
    }
  }, [loadStudentAttemptsFromStorage]);

  useEffect(() => {
    if (profile?.student_code) {
      setStudentAutoSbd(
        String(profile.student_code).replace(/\D/g, "").padStart(6, "0").slice(-6)
      );
    } else {
      setStudentAutoSbd(formatStudentAutoSBD(profile));
    }
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

  // Tìm lượt nộp điểm cao nhất của học sinh cho 1 BTVN hoặc Đề KT cụ thể
  const findBestAttemptForQuizItem = useCallback(
    (quizItem: any) => {
      if (!quizItem || studentAttempts.length === 0) return null;
      const qId = String(quizItem.id || quizItem.quiz_id || "").trim().toLowerCase();
      const qTitle = String(quizItem.title || "").trim().toLowerCase();
      const stuId = String(fallbackProfile.id || "").trim().toLowerCase();
      const stuName = String(fallbackProfile.full_name || "").trim().toLowerCase();

      const matching = studentAttempts.filter((a: any) => {
        if (!a) return false;
        const aStuId = String(a.studentId || a.student_id || a.user_id || "").trim().toLowerCase();
        const aStuName = String(a.studentName || a.student_name || a.full_name || "")
          .trim()
          .toLowerCase();
        const isMyAttempt =
          (stuId && aStuId === stuId) ||
          (stuName && aStuName === stuName) ||
          aStuId.includes(stuId);
        if (!isMyAttempt) return false;

        const aQId = String(a.quizId || a.quiz_id || a.exam_id || "").trim().toLowerCase();
        const aQTitle = String(a.examTitle || a.quizTitle || a.title || "").trim().toLowerCase();
        return (qId && aQId === qId) || (qTitle && aQTitle === qTitle);
      });

      if (matching.length === 0) return null;
      return matching.reduce((best, cur) =>
        Number(cur.score ?? cur.points ?? 0) >= Number(best.score ?? best.points ?? 0) ? cur : best
      );
    },
    [studentAttempts, fallbackProfile]
  );

  const activeTabVideos = useMemo(() => {
    return videoTab === "lecture" ? lectureVideos : homeworkSolutionVideos;
  }, [videoTab, lectureVideos, homeworkSolutionVideos]);

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

  // Tách BTVN thành 2 nhóm rõ ràng: Đề làm trực tuyến/OMR & File đề tải về (PDF/Drive)
  const { quizHomeworks, driveHomeworks } = useMemo(() => {
    const allHw = Array.isArray(lesson?.homework_files) ? lesson.homework_files : [];
    const quizList: any[] = [];
    const driveList: any[] = [];

    allHw.forEach((hw: any) => {
      if (!hw) return;
      const isDrive = hw.is_drive_file === true || hw.is_quiz === false;
      if (isDrive) driveList.push(hw);
      else quizList.push(hw);
    });

    return { quizHomeworks: quizList, driveHomeworks: driveList };
  }, [lesson?.homework_files]);

  const lectureFiles = useMemo(
    () => (Array.isArray(lesson?.lecture_files) ? lesson.lecture_files : []),
    [lesson?.lecture_files]
  );
  const handwrittenNotes = useMemo(
    () => (Array.isArray(lesson?.handwritten_notes) ? lesson.handwritten_notes : []),
    [lesson?.handwritten_notes]
  );
  const extraResources = useMemo(
    () => (Array.isArray(lesson?.extra_resources) ? lesson.extra_resources : []),
    [lesson?.extra_resources]
  );

  const totalLearningDocsCount =
    lectureFiles.length + handwrittenNotes.length + extraResources.length;

  /**
   * Nạp đầy đủ dữ liệu câu hỏi của đề thi / BTVN từ localStorage hoặc Supabase
   * Tối ưu Egress: chỉ kéo các trường cần thiết, không dùng select("*")
   */
  const resolveFullExamData = useCallback(async (rawQuizItem: any, isHw: boolean) => {
    if (!rawQuizItem) return null;

    const pickNonEmpty = (...cands: any[]) => {
      for (let c of cands) {
        if (!c) continue;
        if (typeof c === "string") {
          try {
            c = JSON.parse(c);
          } catch {
            continue;
          }
        }
        if (Array.isArray(c) && c.length > 0) return c;
      }
      return [];
    };

    const localResolved = resolveCompleteExamObject(rawQuizItem);
    const localQuestions = pickNonEmpty(
      localResolved?.sections,
      localResolved?.data,
      localResolved?.questions
    );

    if (localQuestions.length > 0) {
      return {
        ...localResolved,
        data: localQuestions,
        sections: localQuestions,
        is_homework: isHw
      };
    }

    const targetId = String(
      rawQuizItem.quiz_id || rawQuizItem.exam_id || rawQuizItem.id || ""
    ).trim();
    const targetTitle = String(rawQuizItem.title || "").trim();

    try {
      setIsResolvingExam(true);

      const targetTable = isHw ? "homeworks" : "practice_exams";
      const selectCols = isHw
        ? "id, lesson_id, title, data, sections, media_map, duration_minutes"
        : "id, title, data, media_map, duration_minutes";

      let dbRecord: any = null;

      if (targetId) {
        const filterStr = isHw
          ? `id.eq.${targetId},lesson_id.eq.${targetId}`
          : `id.eq.${targetId}`;

        const { data: byId } = await supabase
          .from(targetTable)
          .select(selectCols)
          .or(filterStr)
          .limit(1)
          .maybeSingle();

        if (byId) dbRecord = byId;
      }

      if (!dbRecord && targetTitle) {
        const { data: byTitle } = await supabase
          .from(targetTable)
          .select(selectCols)
          .ilike("title", `%${targetTitle}%`)
          .limit(1)
          .maybeSingle();

        if (byTitle) dbRecord = byTitle;
      }

      if (dbRecord) {
        const validSections = pickNonEmpty(dbRecord.sections, dbRecord.data);
        return {
          ...rawQuizItem,
          ...dbRecord,
          data: validSections,
          sections: validSections,
          is_homework: isHw
        };
      }
    } catch (err) {
      console.warn("Lỗi nạp dữ liệu đề thi:", err);
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
      loadStudentAttemptsFromStorage();
      if (attemptRecord && scannedExam) {
        setReviewingPaperAttempt({
          attempt: attemptRecord,
          exam: scannedExam
        });
      }
    },
    [activePaperScanExam, loadStudentAttemptsFromStorage]
  );

  if (activeDigitalExam) {
    return (
      <DigitalAnswerSheetView
        exam={activeDigitalExam}
        profile={fallbackProfile}
        isHomework={isEntryHomework}
        onBack={() => setActiveDigitalExam(null)}
        onSubmitted={(attemptRecord) => {
          const targetEx = activeDigitalExam;
          setActiveDigitalExam(null);
          loadStudentAttemptsFromStorage();
          setReviewingPaperAttempt({
            attempt: attemptRecord,
            exam: targetEx
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

  const totalHomeworkCount = quizHomeworks.length + driveHomeworks.length;

  return (
    <div className="fixed inset-0 z-[100] bg-[#F1F5F9] antialiased text-slate-800 tracking-tight flex flex-col overflow-hidden">
      {/* 1. HEADER 3 PHẦN CÂN ĐỐI — TIÊU ĐỀ BÀI HỌC NỔI BẬT Ở CHÍNH GIỮA */}
      <header className="h-15 sm:h-16 bg-white border-b border-slate-200/90 flex items-center justify-between gap-3 px-3.5 sm:px-6 shrink-0 z-20">
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onBackToCatalog}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200/90 bg-white hover:bg-[#F8FAFC] transition text-xs font-semibold text-slate-700 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
            <span>Quay lại</span>
          </button>
        </div>

        <div className="flex-1 text-center px-2 min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
            {lesson?.title || "Chi tiết bài học"}
          </h1>
          <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
            Chương trình học • {lesson?.format || "Zoom"} • {lesson?.duration || 45} phút
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {isResolvingExam && (
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-[#1D4ED8] border border-blue-200 text-[11px] font-semibold">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Đang nạp...
            </span>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-xs font-semibold text-slate-800 leading-tight">
              {profile?.full_name || "Học sinh"}
            </p>
            <p className="text-[10px] font-medium text-slate-500 uppercase">
              {profile?.grade || "Lớp 12"} • SBD: {studentAutoSbd}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center text-xs font-semibold">
            {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : "T"}
          </div>
        </div>
      </header>

      {/* 2. KHÔNG GIAN HỌC TẬP CHÍNH (2 CỘT: TRÁI 8 - PHẢI 4) */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-3.5 sm:p-5 lg:p-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
          {/* CỘT TRÁI (8 CỘT): VIDEO BÀI GIẢNG & THÔNG TIN BUỔI HỌC */}
          <div className="lg:col-span-8 space-y-4 text-left">
            <div className="bg-white p-1 rounded-xl border border-slate-200/90 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setVideoTab("lecture");
                  setIsVideoLoading(true);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  videoTab === "lecture"
                    ? "bg-[#1D4ED8] text-white"
                    : "bg-white text-slate-600 hover:bg-[#F8FAFC] hover:text-slate-900"
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Video Bài Giảng Lý Thuyết</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                    videoTab === "lecture"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
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
                    ? "bg-[#1D4ED8] text-white"
                    : "bg-white text-slate-600 hover:bg-[#F8FAFC] hover:text-slate-900"
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>Video Chữa Chi Tiết BTVN</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                    videoTab === "homework_solution"
                      ? "bg-white/20 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {homeworkSolutionVideos.length}
                </span>
              </button>
            </div>

            {/* KHUNG VIDEO THÔNG MINH: CHỈ HIỆN ASPECT-VIDEO KHI CÓ LINK VIDEO THẬT */}
            {currentEmbedUrl ? (
              <div className="bg-slate-100/80 border border-slate-200/90 rounded-xl overflow-hidden aspect-video w-full relative flex items-center justify-center">
                {isVideoLoading && (
                  <div className="absolute inset-0 bg-slate-100/90 flex flex-col items-center justify-center text-slate-500 gap-2 z-10">
                    <Loader2 className="w-7 h-7 text-[#1D4ED8] animate-spin" />
                    <span className="text-xs font-medium text-slate-600">
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
              </div>
            ) : (
              <div className="bg-white border border-slate-200/90 rounded-xl py-8 px-6 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="w-11 h-11 rounded-xl bg-[#F8FAFC] border border-slate-200/90 text-[#1D4ED8] flex items-center justify-center shrink-0">
                  {videoTab === "lecture" ? (
                    <Video className="w-5 h-5" />
                  ) : (
                    <PenTool className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-slate-800">
                    {videoTab === "lecture"
                      ? "Chưa có video bài giảng lý thuyết"
                      : "Chưa có video chữa chi tiết bài tập về nhà"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {videoTab === "lecture"
                      ? "Nội dung video đang được giáo viên cập nhật. Bạn có thể xem tài liệu hoặc làm bài tập ở cột bên phải."
                      : "Video chữa chi tiết BTVN sẽ hiển thị tại đây ngay khi giáo viên đăng tải."}
                  </p>
                </div>
              </div>
            )}

            {activeTabVideos.length > 1 && (
              <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 space-y-2">
                <h4 className="text-[10px] font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" /> Danh sách các phần video (
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
                            ? "bg-blue-50 border-[#1D4ED8] text-[#1D4ED8]"
                            : "bg-[#F8FAFC] border-slate-200/90 hover:bg-slate-100 text-slate-700"
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
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white text-[#1D4ED8] border border-blue-200 shrink-0">
                            Đang phát
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#F8FAFC] text-slate-700 border border-slate-200/90 text-[10px] font-semibold uppercase tracking-wider">
                    {lesson?.format || "Zoom"}
                  </span>
                  {lesson?.target_mode && (
                    <span className="px-2 py-0.5 rounded bg-[#F8FAFC] text-slate-700 border border-slate-200/90 text-[10px] font-semibold uppercase tracking-wider">
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
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] hover:text-blue-800 transition"
                  >
                    <span>Mở link gốc</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                {lesson?.title}
              </h2>

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

          {/* CỘT PHẢI (4 CỘT): 3 KHỐI TỐI GIẢN (BTVN, ĐỀ KT ĐỊNH KỲ, TÀI LIỆU HỌC TẬP) */}
          <div className="lg:col-span-4 space-y-4 text-left">
            {/* KHỐI 1: BÀI TẬP VỀ NHÀ (TÁCH RÕ 2 LOẠI: ĐỀ TRỰC TUYẾN/OMR & FILE TẢI VỀ) */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-[#1D4ED8]" /> Bài tập về nhà
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-[#1D4ED8]">
                  {totalHomeworkCount}
                </span>
              </div>

              {totalHomeworkCount === 0 ? (
                <p className="text-center text-slate-400 text-xs py-3 font-normal italic">
                  Chưa có bài tập về nhà cho bài học này.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* Loại 1: Đề làm trực tuyến / Phiếu OMR */}
                  {quizHomeworks.length > 0 && (
                    <div className="space-y-2">
                      {driveHomeworks.length > 0 && (
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Đề làm trực tuyến / Phiếu OMR
                        </p>
                      )}
                      {quizHomeworks.map((hw: any, idx: number) => {
                        const bestHwAttempt = findBestAttemptForQuizItem(hw);
                        const isPaperDone =
                          bestHwAttempt?.submission_type === "paper" ||
                          Boolean(bestHwAttempt?.paper_scan_url) ||
                          Boolean(bestHwAttempt?.omr_raw_data);

                        return (
                          <div
                            key={hw.id || idx}
                            className="p-3 rounded-xl border border-slate-200/90 bg-[#F8FAFC] hover:bg-white transition-all space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-semibold text-xs text-slate-800 line-clamp-1">
                                {hw.title || `BTVN Phần ${idx + 1}`}
                              </h4>
                              {bestHwAttempt ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-[#1D4ED8] border border-blue-200 shrink-0 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {Number(
                                    bestHwAttempt.score ?? bestHwAttempt.points ?? 0
                                  ).toFixed(1)}
                                  đ
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 shrink-0">
                                  Trắc nghiệm
                                </span>
                              )}
                            </div>

                            <div className="space-y-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenExamEntry(hw, true)}
                                className="w-full py-2 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Play className="w-3 h-3 fill-white" />
                                <span>
                                  {bestHwAttempt ? "Làm lại BTVN" : "Bắt đầu làm BTVN"}
                                </span>
                              </button>

                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handlePrintSheetForQuiz(hw, true)}
                                  className="py-1.5 px-2 bg-white hover:bg-[#F8FAFC] text-slate-700 border border-slate-200/90 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                                  title="In phiếu trả lời A4 tương ứng với BTVN này"
                                >
                                  <Printer className="w-3 h-3 text-slate-500" />
                                  <span>In phiếu giấy</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={async () => {
                                    const resolved = await resolveFullExamData(hw, true);
                                    setIsEntryHomework(true);
                                    setActivePaperScanExam(resolved);
                                  }}
                                  className="py-1.5 px-2 bg-white hover:bg-[#F8FAFC] text-slate-700 border border-slate-200/90 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                                  title="Chụp hoặc tải ảnh phiếu BTVN đã làm trên giấy để chấm điểm"
                                >
                                  <Camera className="w-3 h-3 text-slate-500" />
                                  <span>Quét phiếu giấy</span>
                                </button>
                              </div>

                              {bestHwAttempt && isPaperDone && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const resolved = await resolveFullExamData(hw, true);
                                    setReviewingPaperAttempt({
                                      attempt: bestHwAttempt,
                                      exam: resolved
                                    });
                                  }}
                                  className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] border border-blue-200 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3 h-3" /> Xem lại phiếu đã chấm (
                                  {Number(bestHwAttempt.score).toFixed(1)}đ)
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Loại 2: File đề BTVN tải về (PDF / Drive) */}
                  {driveHomeworks.length > 0 && (
                    <div className="space-y-1.5">
                      {quizHomeworks.length > 0 && (
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          File đề BTVN tải về
                        </p>
                      )}
                      {driveHomeworks.map((hw: any, idx: number) => (
                        <a
                          key={hw.id || idx}
                          href={hw.url || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2.5 bg-[#F8FAFC] hover:bg-blue-50/50 border border-slate-200/90 hover:border-blue-200 rounded-xl transition flex items-center justify-between gap-2.5 group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-800 group-hover:text-[#1D4ED8] truncate">
                                {hw.title || `File BTVN ${idx + 1}`}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                File đề BTVN (PDF / Drive)
                              </p>
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#1D4ED8] shrink-0">
                            <span>Mở file</span>
                            <ExternalLink className="w-3 h-3" />
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* KHỐI 2: ĐỀ KIỂM TRA ĐỊNH KỲ */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-[#1D4ED8]" /> Đề kiểm tra định kỳ
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                  {(lesson?.test_quizzes || []).length}
                </span>
              </div>

              {!lesson?.test_quizzes || lesson.test_quizzes.length === 0 ? (
                <p className="text-center text-slate-400 text-xs py-3 font-normal italic">
                  Chưa có đề kiểm tra định kỳ.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {lesson.test_quizzes.map((test: any, idx: number) => {
                    const bestTestAttempt = findBestAttemptForQuizItem(test);
                    const isPaperDone =
                      bestTestAttempt?.submission_type === "paper" ||
                      Boolean(bestTestAttempt?.paper_scan_url) ||
                      Boolean(bestTestAttempt?.omr_raw_data);

                    return (
                      <div
                        key={test.id || idx}
                        className="p-3 rounded-xl border border-slate-200/90 bg-[#F8FAFC] hover:bg-white transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-xs text-slate-800 line-clamp-1">
                            {test.title || `Đề kiểm tra ${idx + 1}`}
                          </h4>
                          {bestTestAttempt ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-[#1D4ED8] border border-blue-200 shrink-0 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {Number(
                                bestTestAttempt.score ?? bestTestAttempt.points ?? 0
                              ).toFixed(1)}
                              đ
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 shrink-0">
                              Đề KT
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenExamEntry(test, false)}
                            className="w-full py-2 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Play className="w-3 h-3 fill-white" />
                            <span>
                              {bestTestAttempt ? "Thi lại Đề KT" : "Vào phòng thi kiểm tra"}
                            </span>
                          </button>

                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePrintSheetForQuiz(test, false)}
                              className="py-1.5 px-2 bg-white hover:bg-[#F8FAFC] text-slate-700 border border-slate-200/90 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                              title="In phiếu trả lời A4 tương ứng với Đề kiểm tra này"
                            >
                              <Printer className="w-3 h-3 text-slate-500" />
                              <span>In phiếu giấy</span>
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                const resolved = await resolveFullExamData(test, false);
                                setIsEntryHomework(false);
                                setActivePaperScanExam(resolved);
                              }}
                              className="py-1.5 px-2 bg-white hover:bg-[#F8FAFC] text-slate-700 border border-slate-200/90 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                              title="Chụp hoặc tải ảnh phiếu Đề kiểm tra đã làm trên giấy"
                            >
                              <Camera className="w-3 h-3 text-slate-500" />
                              <span>Quét phiếu giấy</span>
                            </button>
                          </div>

                          {bestTestAttempt && isPaperDone && (
                            <button
                              type="button"
                              onClick={async () => {
                                const resolved = await resolveFullExamData(test, false);
                                setReviewingPaperAttempt({
                                  attempt: bestTestAttempt,
                                  exam: resolved
                                });
                              }}
                              className="w-full py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] border border-blue-200 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" /> Xem lại phiếu đã chấm (
                              {Number(bestTestAttempt.score).toFixed(1)}đ)
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* KHỐI 3: TÀI LIỆU HỌC TẬP (GỘP GỌN BÀI GIẢNG LÝ THUYẾT + GHI CHÉP VIẾT TAY + TÀI LIỆU TĂNG CƯỜNG) */}
            <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#1D4ED8]" /> Tài liệu học tập
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-700">
                  {totalLearningDocsCount}
                </span>
              </div>

              {totalLearningDocsCount === 0 ? (
                <p className="text-center text-slate-400 text-xs py-2 font-normal italic">
                  Chưa có tài liệu học tập đính kèm.
                </p>
              ) : (
                <div className="space-y-3">
                  {/* 1. Bài giảng lý thuyết */}
                  {lectureFiles.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Bài giảng lý thuyết
                      </p>
                      {lectureFiles.map((file: any, idx: number) => (
                        <a
                          key={file.id || idx}
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                          className="py-2 px-2.5 bg-[#F8FAFC] hover:bg-blue-50/50 border border-slate-200/90 hover:border-blue-200 rounded-lg transition flex items-center justify-between gap-2 group text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0" />
                            <span className="text-xs font-medium text-slate-700 group-hover:text-[#1D4ED8] truncate">
                              {file.title || `Bài giảng ${idx + 1}`}
                            </span>
                          </div>
                          <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#1D4ED8] shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* 2. Ghi chép viết tay */}
                  {handwrittenNotes.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Ghi chép viết tay
                      </p>
                      {handwrittenNotes.map((note: any, idx: number) => (
                        <a
                          key={note.id || idx}
                          href={note.url}
                          target="_blank"
                          rel="noreferrer"
                          className="py-2 px-2.5 bg-[#F8FAFC] hover:bg-blue-50/50 border border-slate-200/90 hover:border-blue-200 rounded-lg transition flex items-center justify-between gap-2 group text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <BookOpen className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#1D4ED8] shrink-0" />
                            <span className="text-xs font-medium text-slate-700 group-hover:text-[#1D4ED8] truncate">
                              {note.title || `Ghi chép viết tay ${idx + 1}`}
                            </span>
                          </div>
                          <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#1D4ED8] shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* 3. Tài liệu tăng cường */}
                  {extraResources.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Tài liệu tăng cường
                      </p>
                      {extraResources.map((item: any, idx: number) => (
                        <a
                          key={item.id || idx}
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="py-2 px-2.5 bg-[#F8FAFC] hover:bg-blue-50/50 border border-slate-200/90 hover:border-blue-200 rounded-lg transition flex items-center justify-between gap-2 group text-left"
                        >
                          <div className="flex items-start gap-2 min-w-0">
                            <Zap className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-800 group-hover:text-[#1D4ED8] truncate">
                                {item.title || `Tài liệu tăng cường ${idx + 1}`}
                              </p>
                              {item.note && (
                                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                                  {item.note}
                                </p>
                              )}
                            </div>
                          </div>
                          <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#1D4ED8] shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
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

          if (typeof window !== "undefined") {
            try {
              sessionStorage.setItem(
                "tct_active_exam_room",
                JSON.stringify({
                  ...selectedQuizForEntry,
                  id: qId,
                  title: qTitle
                })
              );
            } catch {}
          }

          (onStartQuiz as any)(qId, qTitle, isEntryHomework, qDuration, selectedQuizForEntry);
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

      {/* 4. MODAL CHỤP / TẢI ẢNH QUÉT PHIẾU GIẤY */}
      {activePaperScanExam && (
        <SafePaperScanModal
          isOpen={Boolean(activePaperScanExam)}
          onClose={() => setActivePaperScanExam(null)}
          exam={activePaperScanExam}
          profile={fallbackProfile}
          isHomework={isEntryHomework}
          onScanComplete={handlePaperScanCompleted}
          onSubmitted={handlePaperScanCompleted}
          onScanSuccess={handlePaperScanCompleted}
          onComplete={handlePaperScanCompleted}
        />
      )}
    </div>
  );
}

export default LessonWorkspaceView;
