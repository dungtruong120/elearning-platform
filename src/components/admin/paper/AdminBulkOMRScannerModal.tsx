"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Upload,
  X,
  Loader2,
  Trash2,
  Save,
  ZoomIn,
  ZoomOut,
  SwitchCamera
} from "lucide-react";
import { supabase as defaultSupabaseClient } from "@/lib/supabaseClient";
import {
  scanOMRSheetFromCanvas,
  gradeOMRSubmission,
  computeAdaptiveBinaryMask,
  detectOMRCornerMarkers,
  deriveExamCode3Digits,
  formatStudentAutoSBD,
  OMR_CANONICAL_WIDTH,
  OMR_CANONICAL_HEIGHT
} from "@/lib/omrEngine";

export interface StudentSBDRecord {
  id?: string;
  studentId?: string;
  username?: string;
  full_name?: string;
  studentName?: string;
  sbd: string;
  stt?: number;
  school?: string;
  grade?: string;
  learningMode?: string;
  [key: string]: any;
}

export interface AdminBulkOMRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedQuiz?: any;
  defaultSelectedExam?: any;
  chapters?: any[];
  practiceExams?: any[];
  registeredStudents?: any[];
  studentsList?: StudentSBDRecord[];
  supabase?: any;
  onSavedBatchAttempts?: (newAttempts: any[]) => void;
  showToast?: (msg: string, type?: "success" | "error") => void;
}

interface ScannedSheetItem {
  tempId: string;
  fileName: string;
  detectedSbd: string;
  detectedExamCode: string;
  matchedStudentId: string;
  matchedStudentName: string;
  matchedSchool: string;
  matchedQuizId: string;
  matchedQuizTitle: string;
  sourceType: "homework" | "test" | "practice";
  assignedMonth?: number;
  assignedWeek?: number;
  score: number;
  part1Score: number;
  part2Score: number;
  part3Score: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  totalQuestions: number;
  confidence: number;
  flaggedQuestions: number[];
  geometryWarning?: string;
  warpedImageUrl: string;
  omrRawData: any;
  normalizedAnswers: Record<string, any>;
}

export function AdminBulkOMRScannerModal({
  isOpen,
  onClose,
  initialSelectedQuiz,
  defaultSelectedExam,
  chapters = [],
  practiceExams = [],
  registeredStudents = [],
  studentsList = [],
  supabase: propSupabase,
  onSavedBatchAttempts,
  showToast
}: AdminBulkOMRScannerModalProps) {
  const effectiveSupabase = propSupabase || defaultSupabaseClient;
  const effectiveInitialQuiz = initialSelectedQuiz || defaultSelectedExam || null;

  const [inputMode, setInputMode] = useState<"upload" | "camera">("upload");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState<boolean>(true);
  const [cameraStatusText, setCameraStatusText] = useState<string>(
    "Đưa phiếu vào khung ngắm để tự động bắt 4 góc..."
  );

  const [selectedQuizId, setSelectedQuizId] = useState<string>(
    effectiveInitialQuiz?.id ? String(effectiveInitialQuiz.id) : "auto"
  );

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressText, setProgressText] = useState<string>("");
  const [scannedItems, setScannedItems] = useState<ScannedSheetItem[]>([]);
  const [activeInspectId, setActiveInspectId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastAutoCaptureTimeRef = useRef<number>(0);

  useEffect(() => {
    if (effectiveInitialQuiz?.id) {
      setSelectedQuizId(String(effectiveInitialQuiz.id));
    }
  }, [effectiveInitialQuiz]);

  // 1. TỔNG HỢP DANH MỤC TẤT CẢ ĐỀ THI (BTVN + ĐỀ KT + LUYỆN ĐỀ) ĐỂ TỰ ĐỘNG KHỚP MÃ ĐỀ
  const allQuizzesPool = useMemo(() => {
    const list: {
      id: string;
      title: string;
      examCode: string;
      sourceType: "homework" | "test" | "practice";
      assignedMonth?: number;
      assignedWeek?: number;
      rawObj: any;
    }[] = [];

    (chapters || []).forEach((chap: any) => {
      (chap?.lessons || []).forEach((les: any) => {
        const lMonth = Number(les?.assigned_month) || 10;
        const lWeek = Number(les?.assigned_week) || 1;

        (les?.homework_files || []).forEach((hw: any) => {
          if (!hw || hw.is_drive_file) return;
          list.push({
            id: String(hw.id),
            title: String(hw.title || "BTVN"),
            examCode: deriveExamCode3Digits(hw),
            sourceType: "homework",
            assignedMonth: Number(hw.assigned_month) || lMonth,
            assignedWeek: Number(hw.assigned_week) || lWeek,
            rawObj: hw
          });
        });

        (les?.test_quizzes || []).forEach((tq: any) => {
          if (!tq || tq.is_drive_file) return;
          list.push({
            id: String(tq.id),
            title: String(tq.title || "Đề kiểm tra"),
            examCode: deriveExamCode3Digits(tq),
            sourceType: "test",
            assignedMonth: Number(tq.assigned_month) || lMonth,
            assignedWeek: Number(tq.assigned_week) || lWeek,
            rawObj: tq
          });
        });
      });
    });

    (practiceExams || []).forEach((pe: any) => {
      if (!pe) return;
      list.push({
        id: String(pe.id),
        title: String(pe.title || "Luyện đề"),
        examCode: deriveExamCode3Digits(pe),
        sourceType: "practice",
        assignedMonth: Number(pe.assigned_month) || undefined,
        assignedWeek: Number(pe.assigned_week) || undefined,
        rawObj: pe
      });
    });

    return list;
  }, [chapters, practiceExams]);

  // 2. BẢNG TRA CỨU HỌC SINH THEO SBD (000001 -> 0000NN) HỖ TRỢ CẢ studentsList LẪN registeredStudents
  const studentDirectory = useMemo(() => {
    const sourceArr =
      Array.isArray(studentsList) && studentsList.length > 0
        ? studentsList
        : Array.isArray(registeredStudents)
        ? registeredStudents
        : [];

    const pool = [...sourceArr].filter(Boolean);
    pool.sort((a, b) =>
      String(a.full_name || a.studentName || a.name || "").localeCompare(
        String(b.full_name || b.studentName || b.name || ""),
        "vi"
      )
    );
    return pool.map((stu, idx) => ({
      id: String(stu.id || stu.studentId || `stu_${idx + 1}`),
      full_name: String(stu.full_name || stu.studentName || stu.name || "Học sinh"),
      school: String(stu.school || "THPT"),
      stt: stu.stt || idx + 1,
      sbd: stu.sbd ? String(stu.sbd).padStart(6, "0").slice(-6) : formatStudentAutoSBD(idx + 1)
    }));
  }, [studentsList, registeredStudents]);

  const sbdLookupMap = useMemo(() => {
    const map = new Map<string, (typeof studentDirectory)[0]>();
    studentDirectory.forEach((s) => {
      map.set(s.sbd, s);
      map.set(String(s.stt), s);
    });
    return map;
  }, [studentDirectory]);

  // 3. QUẢN LÝ CAMERA QUÉT LIÊN TỤC
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatusText("Trình duyệt không hỗ trợ Camera trực tiếp.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraStatusText("Không thể mở Camera. Vui lòng sử dụng chế độ Kéo thả ảnh.");
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    if (isOpen && inputMode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, inputMode, startCamera, stopCamera]);

  // HÀM XỬ LÝ 1 CANVAS ẢNH CHỤP -> TRÍCH XUẤT SBD, MÃ ĐỀ & CHẤM ĐIỂM
  const processSingleCanvas = useCallback(
    (canvas: HTMLCanvasElement, labelName: string): ScannedSheetItem | null => {
      let targetQuizEntry =
        selectedQuizId !== "auto"
          ? allQuizzesPool.find((q) => q.id === selectedQuizId) || allQuizzesPool[0]
          : allQuizzesPool[0];

      const preliminaryOmr = scanOMRSheetFromCanvas(canvas, targetQuizEntry?.rawObj);

      if (selectedQuizId === "auto" && preliminaryOmr.detected_exam_code !== "Chưa tô") {
        const byCode = allQuizzesPool.find(
          (q) => q.examCode === preliminaryOmr.detected_exam_code
        );
        if (byCode) {
          targetQuizEntry = byCode;
        }
      }

      const finalOmr =
        targetQuizEntry && selectedQuizId === "auto"
          ? scanOMRSheetFromCanvas(canvas, targetQuizEntry.rawObj)
          : preliminaryOmr;

      const graded = gradeOMRSubmission(finalOmr, targetQuizEntry?.rawObj);

      const cleanSbd = String(finalOmr.detected_sbd || "").trim();
      const parsedStt = parseInt(cleanSbd.replace(/\D/g, ""), 10);
      const matchedStu =
        sbdLookupMap.get(cleanSbd) ||
        (!isNaN(parsedStt) ? sbdLookupMap.get(String(parsedStt)) : undefined) ||
        null;

      const item: ScannedSheetItem = {
        tempId: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fileName: labelName,
        detectedSbd: cleanSbd || "Chưa tô",
        detectedExamCode: finalOmr.detected_exam_code || targetQuizEntry?.examCode || "101",
        matchedStudentId: matchedStu?.id || `sbd_${cleanSbd || Date.now()}`,
        matchedStudentName:
          matchedStu?.full_name ||
          (cleanSbd && cleanSbd !== "Chưa tô" ? `Học sinh (SBD: ${cleanSbd})` : "Chưa rõ SBD"),
        matchedSchool: matchedStu?.school || "THPT",
        matchedQuizId: targetQuizEntry?.id || "quiz-paper",
        matchedQuizTitle: targetQuizEntry?.title || "Đề thi trên giấy",
        sourceType: targetQuizEntry?.sourceType || "practice",
        assignedMonth: targetQuizEntry?.assignedMonth,
        assignedWeek: targetQuizEntry?.assignedWeek,
        score: graded.score,
        part1Score: graded.part1Score,
        part2Score: graded.part2Score,
        part3Score: graded.part3Score,
        correctCount: graded.correctCount,
        wrongCount: graded.wrongCount,
        skippedCount: graded.skippedCount,
        totalQuestions: graded.totalQuestions,
        confidence: graded.updatedOmrData.confidence,
        flaggedQuestions: graded.updatedOmrData.flagged_questions || [],
        geometryWarning: graded.updatedOmrData.geometry_warning,
        warpedImageUrl: graded.updatedOmrData.warped_image_data_url || "",
        omrRawData: graded.updatedOmrData,
        normalizedAnswers: graded.normalizedAnswers
      };

      return item;
    },
    [selectedQuizId, allQuizzesPool, sbdLookupMap]
  );

  // VÒNG LẶP AUTO-CAPTURE KHI CAMERA BẮT ĐỦ 4 GÓC HỢP LỆ
  useEffect(() => {
    if (!isOpen || inputMode !== "camera" || !autoCaptureEnabled) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      const now = Date.now();
      if (now - lastAutoCaptureTimeRef.current < 3500) return;

      const vW = video.videoWidth || 1280;
      const vH = video.videoHeight || 720;
      const checkCanvas = document.createElement("canvas");
      checkCanvas.width = 600;
      checkCanvas.height = Math.round((vH / vW) * 600);
      const ctx = checkCanvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, checkCanvas.width, checkCanvas.height);
      const imgData = ctx.getImageData(0, 0, checkCanvas.width, checkCanvas.height);
      const mask = computeAdaptiveBinaryMask(imgData);
      const corners = detectOMRCornerMarkers(mask.binary, mask.width, mask.height, mask.gray);

      if (corners.detected && !corners.geometryWarning) {
        lastAutoCaptureTimeRef.current = now;
        setCameraStatusText("✓ Đã bắt chuẩn 4 góc! Đang chụp & chấm tự động...");

        const fullCanvas = document.createElement("canvas");
        fullCanvas.width = vW;
        fullCanvas.height = vH;
        const fCtx = fullCanvas.getContext("2d");
        if (fCtx) {
          fCtx.drawImage(video, 0, 0, vW, vH);
          const resultItem = processSingleCanvas(
            fullCanvas,
            `Camera_${new Date().toLocaleTimeString("vi-VN")}`
          );
          if (resultItem) {
            setScannedItems((prev) => [resultItem, ...prev]);
            setActiveInspectId(resultItem.tempId);
            setCameraStatusText(
              `✓ Đã chấm: ${resultItem.matchedStudentName} (${resultItem.score}đ) — Mời đưa phiếu tiếp theo vào!`
            );
          }
        }
      }
    }, 650);

    return () => clearInterval(interval);
  }, [isOpen, inputMode, autoCaptureEnabled, processSingleCanvas]);

  const handleManualCameraCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    const vW = video.videoWidth || 1280;
    const vH = video.videoHeight || 720;
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = vW;
    fullCanvas.height = vH;
    const fCtx = fullCanvas.getContext("2d");
    if (!fCtx) return;

    fCtx.drawImage(video, 0, 0, vW, vH);
    const resultItem = processSingleCanvas(
      fullCanvas,
      `Camera_${new Date().toLocaleTimeString("vi-VN")}`
    );
    if (resultItem) {
      setScannedItems((prev) => [resultItem, ...prev]);
      setActiveInspectId(resultItem.tempId);
    }
  };

  const handleMultipleFilesSelect = async (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    setIsProcessing(true);
    const filesArr = Array.from(filesList);
    const newResults: ScannedSheetItem[] = [];

    for (let i = 0; i < filesArr.length; i++) {
      const f = filesArr[i];
      setProgressText(`Đang quét phiếu ${i + 1} / ${filesArr.length}: ${f.name}...`);

      try {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(String(e.target?.result || ""));
          reader.readAsDataURL(f);
        });

        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = dataUrl;
        });

        const canvas = document.createElement("canvas");
        const maxDim = 1800;
        let w = img.naturalWidth || img.width || OMR_CANONICAL_WIDTH;
        let h = img.naturalHeight || img.height || OMR_CANONICAL_HEIGHT;
        if (w > maxDim || h > maxDim) {
          const r = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.drawImage(img, 0, 0, w, h);

        const scanned = processSingleCanvas(canvas, f.name);
        if (scanned) {
          newResults.push(scanned);
        }
      } catch (e) {
        console.error("Lỗi quét ảnh:", f.name, e);
      }
    }

    if (newResults.length > 0) {
      setScannedItems((prev) => [...newResults, ...prev]);
      setActiveInspectId(newResults[0].tempId);
    }

    setIsProcessing(false);
    setProgressText("");
  };

  const handleUpdateScannedItem = (
    tempId: string,
    updates: Partial<ScannedSheetItem>
  ) => {
    setScannedItems((prev) =>
      prev.map((it) => (it.tempId === tempId ? { ...it, ...updates } : it))
    );
  };

  const handleSaveAllScannedToSystem = async () => {
    if (scannedItems.length === 0 || isSavingAll) return;
    setIsSavingAll(true);

    const nowIso = new Date().toISOString();
    const formattedAttempts: any[] = [];

    for (let i = 0; i < scannedItems.length; i++) {
      const item = scannedItems[i];
      const attemptId = `att-paper-${Date.now()}-${i}`;

      const record: any = {
        id: attemptId,
        quiz_id: item.matchedQuizId,
        quizId: item.matchedQuizId,
        exam_id: item.matchedQuizId,
        quiz_title: item.matchedQuizTitle,
        quizTitle: item.matchedQuizTitle,
        exam_title: item.matchedQuizTitle,
        examTitle: item.matchedQuizTitle,
        student_id: item.matchedStudentId,
        studentId: item.matchedStudentId,
        user_id: item.matchedStudentId,
        student_name: item.matchedStudentName,
        studentName: item.matchedStudentName,
        full_name: item.matchedStudentName,
        school: item.matchedSchool,
        score: Number(item.score),
        points: Number(item.score),
        total_questions: item.totalQuestions,
        totalQuestions: item.totalQuestions,
        correct_count: item.correctCount,
        correctCount: item.correctCount,
        time_spent: "Làm trên giấy",
        timeSpent: "Làm trên giấy",
        duration_seconds: 0,
        is_homework: item.sourceType === "homework",
        isHomework: item.sourceType === "homework",
        type: item.sourceType,
        submission_type: "paper",
        paper_scan_url: item.warpedImageUrl,
        omr_raw_data: item.omrRawData,
        recognition_confidence: item.confidence,
        flagged_questions: item.flaggedQuestions,
        answers: item.normalizedAnswers,
        userAnswers: item.normalizedAnswers,
        user_answers: item.normalizedAnswers,
        assigned_month: item.assignedMonth,
        assigned_week: item.assignedWeek,
        created_at: nowIso,
        createdAt: nowIso,
        submittedAt: nowIso
      };

      formattedAttempts.push(record);

      try {
        await fetch("/api/student/scan-paper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId: record.id,
            examId: record.quiz_id,
            examTitle: record.quiz_title,
            studentId: record.student_id,
            studentName: record.student_name,
            school: record.school,
            score: record.score,
            totalQuestions: record.total_questions,
            correctCount: record.correct_count,
            isHomework: record.is_homework,
            answers: record.answers,
            omrData: record.omr_raw_data,
            imageBase64: record.paper_scan_url
          })
        });
      } catch {}
    }

    try {
      if (effectiveSupabase) {
        await Promise.allSettled([
          effectiveSupabase.from("exam_attempts").insert(formattedAttempts),
          effectiveSupabase.from("quiz_results").insert(formattedAttempts)
        ]);
      }
    } catch {}

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_attempts");
        const parsed = saved ? JSON.parse(saved) : [];
        const merged = [...formattedAttempts, ...(Array.isArray(parsed) ? parsed : [])];
        localStorage.setItem("edunexus_attempts", JSON.stringify(merged));
        window.dispatchEvent(new Event("storage"));
      } catch {}
    }

    if (onSavedBatchAttempts) {
      onSavedBatchAttempts(formattedAttempts);
    }

    if (showToast) {
      showToast(
        `Đã lưu thành công ${formattedAttempts.length} bài thi giấy vào hệ thống!`,
        "success"
      );
    }

    setIsSavingAll(false);
    setScannedItems([]);
    onClose();
  };

  if (!isOpen) return null;

  const activeInspectItem =
    scannedItems.find((i) => i.tempId === activeInspectId) || scannedItems[0] || null;

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[550] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 font-sans text-left cursor-pointer"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl max-w-6xl w-full max-h-[95vh] border border-slate-200 shadow-2xl flex flex-col overflow-hidden cursor-default"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleMultipleFilesSelect(e.target.files);
              e.target.value = "";
            }}
          />

          {/* HEADER */}
          <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-300 block">
                  MÁY QUÉT CHẤM THI OMR HÀNG LOẠT (CHỐNG BẮT NHẦM BÀN TAY)
                </span>
                <h3 className="text-sm sm:text-base font-black text-white">
                  Chấm bài thi giấy cả lớp & Đối soát SBD tự động
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedQuizId}
                onChange={(e) => setSelectedQuizId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white outline-none cursor-pointer max-w-[260px]"
              >
                <option value="auto">🤖 Tự nhận diện đề theo Mã đề (3 số)</option>
                {allQuizzesPool.map((q) => (
                  <option key={q.id} value={q.id}>
                    [Mã {q.examCode}] {q.title}
                  </option>
                ))}
              </select>

              <div className="flex bg-slate-800 p-0.5 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setInputMode("upload")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    inputMode === "upload" ? "bg-purple-600 text-white" : "text-slate-300"
                  }`}
                >
                  📁 Tải nhiều ảnh
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("camera")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    inputMode === "camera" ? "bg-purple-600 text-white" : "text-slate-300"
                  }`}
                >
                  📷 Camera liên tục
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* BODY CHIA 2 CỘT */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden bg-slate-50">
            {/* CỘT TRÁI (7 CỘT) */}
            <div className="lg:col-span-7 border-r border-slate-200 flex flex-col min-h-0 p-4 space-y-4 overflow-y-auto custom-scrollbar">
              {inputMode === "upload" ? (
                <div
                  onClick={() => !isProcessing && fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!isProcessing) handleMultipleFilesSelect(e.dataTransfer.files);
                  }}
                  className="p-6 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-100/50 transition text-center space-y-2 cursor-pointer shrink-0"
                >
                  {isProcessing ? (
                    <div className="py-3 space-y-2">
                      <Loader2 className="w-7 h-7 animate-spin text-purple-600 mx-auto" />
                      <p className="text-xs font-extrabold text-purple-900">{progressText}</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-11 h-11 rounded-2xl bg-purple-600 text-white flex items-center justify-center mx-auto shadow-sm">
                        <Upload className="w-5 h-5" />
                      </div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900">
                        Kéo thả 20–50 ảnh phiếu trả lời vào đây hoặc Bấm để chọn ảnh
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        AI OMR tự động lọc bỏ bóng bàn tay, nắn phẳng 4 góc, đọc SBD 6 số và chấm điểm ngay.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="bg-slate-950 rounded-2xl overflow-hidden border border-slate-300 relative aspect-video max-h-[260px] flex items-center justify-center shrink-0">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                    <span className="px-3 py-1 rounded-full bg-slate-900/80 text-emerald-300 text-[11px] font-bold border border-emerald-400/30">
                      {cameraStatusText}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAutoCaptureEnabled((prev) => !prev)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer ${
                        autoCaptureEnabled
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {autoCaptureEnabled ? "Auto-Capture: BẬT" : "Auto-Capture: TẮT"}
                    </button>
                  </div>

                  <div className="absolute bottom-3 inset-x-0 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleManualCameraCapture}
                      className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black shadow-lg cursor-pointer"
                    >
                      📸 Chụp & Chấm ngay
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFacingMode((m) => (m === "environment" ? "user" : "environment"))
                      }
                      className="px-3 py-2 rounded-xl bg-slate-800/90 text-white text-xs font-bold cursor-pointer"
                    >
                      <SwitchCamera className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* DANH SÁCH KẾT QUẢ VỪA QUÉT */}
              <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col min-h-[240px]">
                <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">
                    Danh sách phiếu vừa quét ({scannedItems.length} bài)
                  </span>
                  {scannedItems.length > 0 && (
                    <button
                      type="button"
                      disabled={isSavingAll}
                      onClick={handleSaveAllScannedToSystem}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingAll ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang lưu...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Lưu tất cả điểm vào hệ thống ({scannedItems.length})</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                  {scannedItems.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs italic">
                      Chưa có phiếu nào được quét trong phiên này.
                    </div>
                  ) : (
                    scannedItems.map((item, idx) => {
                      const isSelected = activeInspectItem?.tempId === item.tempId;
                      return (
                        <div
                          key={item.tempId}
                          onClick={() => setActiveInspectId(item.tempId)}
                          className={`p-3 flex flex-wrap items-center justify-between gap-2 transition cursor-pointer ${
                            isSelected ? "bg-purple-50/80" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-black text-[10px]">
                                #{idx + 1}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1D4ED8] border border-blue-200 font-mono font-black text-[11px]">
                                SBD: {item.detectedSbd}
                              </span>

                              <select
                                value={item.matchedStudentId}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const stu = studentDirectory.find((s) => s.id === e.target.value);
                                  if (stu) {
                                    handleUpdateScannedItem(item.tempId, {
                                      matchedStudentId: stu.id,
                                      matchedStudentName: stu.full_name,
                                      matchedSchool: stu.school,
                                      detectedSbd: stu.sbd
                                    });
                                  }
                                }}
                                className="px-2 py-0.5 rounded-lg border border-slate-200 bg-white text-xs font-extrabold text-slate-900 outline-none"
                              >
                                <option value={item.matchedStudentId}>
                                  {item.matchedStudentName}
                                </option>
                                {studentDirectory.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    [{s.sbd}] {s.full_name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="text-[11px] text-slate-500 font-semibold flex items-center gap-2 flex-wrap">
                              <span>Đề: {item.matchedQuizTitle}</span>
                              <span>• Đúng: {item.correctCount}/{item.totalQuestions}</span>
                              {item.flaggedQuestions.length > 0 && (
                                <span className="text-amber-700 font-bold">
                                  ⚠️ Lem chì câu {item.flaggedQuestions.join(", ")}
                                </span>
                              )}
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-1 rounded-xl">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                value={item.score}
                                onChange={(e) =>
                                  handleUpdateScannedItem(item.tempId, {
                                    score: Number(e.target.value)
                                  })
                                }
                                className="w-12 text-center font-black text-xs text-rose-600 bg-transparent outline-none"
                              />
                              <span className="text-[10px] font-bold text-rose-400">đ</span>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                setScannedItems((prev) =>
                                  prev.filter((x) => x.tempId !== item.tempId)
                                )
                              }
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* CỘT PHẢI (5 CỘT): ẢNH ĐỐI SOÁT OMR CỦA BÀI ĐANG CHỌN */}
            <div className="lg:col-span-5 bg-slate-900 flex flex-col min-h-0">
              <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300 shrink-0">
                <span className="font-bold truncate">
                  {activeInspectItem
                    ? `Ảnh chấm: ${activeInspectItem.matchedStudentName} (${activeInspectItem.score}đ)`
                    : "Xem chi tiết ảnh chấm OMR"}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setZoomScale((z) => Math.max(0.8, Number((z - 0.2).toFixed(2))))}
                    className="p-1 rounded bg-slate-800 text-white cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-[11px]">{Math.round(zoomScale * 100)}%</span>
                  <button
                    type="button"
                    onClick={() => setZoomScale((z) => Math.min(2.2, Number((z + 0.2).toFixed(2))))}
                    className="p-1 rounded bg-slate-800 text-white cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 custom-scrollbar flex items-start justify-center">
                {activeInspectItem?.warpedImageUrl ? (
                  <div
                    style={{
                      width: `${Math.round(420 * zoomScale)}px`,
                      transition: "width 0.18s ease-out"
                    }}
                    className="relative rounded-xl overflow-hidden border border-slate-700 bg-white shadow-2xl shrink-0"
                  >
                    <img
                      src={activeInspectItem.warpedImageUrl}
                      alt="Phiếu đã chấm"
                      className="w-full h-auto block"
                    />
                    {activeInspectItem.omrRawData?.bubble_coordinates && (
                      <svg
                        viewBox={`0 0 ${OMR_CANONICAL_WIDTH} ${OMR_CANONICAL_HEIGHT}`}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                      >
                        {activeInspectItem.omrRawData.bubble_coordinates
                          .filter((b: any) => b.status !== "unfilled")
                          .map((b: any) => {
                            const strokeColor =
                              b.status === "correct"
                                ? "#10B981"
                                : b.status === "wrong"
                                ? "#EF4444"
                                : b.status === "expected_missed"
                                ? "#3B82F6"
                                : "#F59E0B";

                            return (
                              <circle
                                key={b.id}
                                cx={b.x}
                                cy={b.y}
                                r={b.r + 2.5}
                                fill={
                                  b.status === "correct"
                                    ? "rgba(16,185,129,0.22)"
                                    : b.status === "wrong"
                                    ? "rgba(239,68,68,0.22)"
                                    : "none"
                                }
                                stroke={strokeColor}
                                strokeWidth={2}
                                strokeDasharray={
                                  b.status === "expected_missed" ? "4 2" : undefined
                                }
                              />
                            );
                          })}
                      </svg>
                    )}
                  </div>
                ) : (
                  <div className="my-auto text-center text-slate-500 text-xs p-6">
                    Hãy tải ảnh phiếu hoặc chụp bằng Camera ở khung bên trái để xem kết quả khoanh vùng OMR.
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default AdminBulkOMRScannerModal;
