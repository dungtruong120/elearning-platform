"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  UploadCloud,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  Save,
  Trash2,
  RefreshCw,
  FileText,
  UserCheck,
  Printer,
  Edit3,
  Sparkles,
  Check
} from "lucide-react";
import {
  scanOMRSheetFromCanvas,
  gradeOMRSubmission,
  formatStudentAutoSBD,
  openPrintableDynamicAnswerSheet,
  OMR_CANONICAL_WIDTH,
  OMR_CANONICAL_HEIGHT
} from "@/lib/omrEngine";
import {
  ExamAttempt,
  OMRResultData,
  OMRGradingSummary
} from "@/types";

export interface StudentSBDRecord {
  stt: number;
  sbd: string;
  id: string;
  username: string;
  full_name: string;
  school?: string;
  grade?: string;
}

export interface BulkScannedPaperItem {
  localId: string;
  fileName: string;
  status: "processing" | "ready" | "flagged" | "error";
  errorMessage?: string;
  detectedSbd: string;
  detectedExamCode: string;
  matchedStudent: StudentSBDRecord | null;
  matchedExam: any | null;
  score: number;
  manualScoreOverride: number | null;
  correctCount: number;
  totalQuestions: number;
  confidence: number;
  flaggedQuestions: number[];
  warpedImageUrl: string;
  omrData: OMRResultData;
  gradingSummary: OMRGradingSummary;
}

export interface AdminBulkOMRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  practiceExams: any[];
  defaultSelectedExam?: any | null;
  studentsList: StudentSBDRecord[];
  supabase: any;
  showToast: (msg: string, type?: "success" | "error") => void;
  onBulkSavedSuccess?: (newAttempts: ExamAttempt[]) => void;
}

export function AdminBulkOMRScannerModal({
  isOpen,
  onClose,
  practiceExams,
  defaultSelectedExam = null,
  studentsList,
  supabase,
  showToast,
  onBulkSavedSuccess
}: AdminBulkOMRScannerModalProps) {
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [scannedItems, setScannedItems] = useState<BulkScannedPaperItem[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0
  });
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);

  // Chế độ Camera quét liên tục
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Modal xem chi tiết & phúc khảo từng bài
  const [inspectingItemId, setInspectingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (defaultSelectedExam?.id) {
        setSelectedExamId(String(defaultSelectedExam.id));
      } else if (practiceExams && practiceExams.length > 0 && !selectedExamId) {
        setSelectedExamId(String(practiceExams[0].id));
      }
    } else {
      stopCameraStream();
    }
  }, [isOpen, defaultSelectedExam, practiceExams]);

  const activeExamObj = useMemo(() => {
    if (!practiceExams || practiceExams.length === 0) return null;
    return (
      practiceExams.find((ex) => String(ex.id) === String(selectedExamId)) ||
      defaultSelectedExam ||
      practiceExams[0]
    );
  }, [practiceExams, selectedExamId, defaultSelectedExam]);

  const inspectingItem = useMemo(() => {
    if (!inspectingItemId) return null;
    return scannedItems.find((item) => item.localId === inspectingItemId) || null;
  }, [scannedItems, inspectingItemId]);

  /**
   * Đối chiếu SBD đọc được từ phiếu với danh sách học sinh trong lớp
   */
  const matchStudentBySbd = useCallback(
    (rawSbd: string): StudentSBDRecord | null => {
      if (!rawSbd || rawSbd === "Chưa tô") return null;
      const cleanDigits = rawSbd.replace(/\D/g, "");
      if (!cleanDigits) return null;

      const padded6 = formatStudentAutoSBD(cleanDigits);
      const numericStt = parseInt(cleanDigits, 10);

      // 1. Khớp chính xác SBD 6 chữ số hoặc STT
      const exact = studentsList.find(
        (st) =>
          st.sbd === padded6 ||
          st.stt === numericStt ||
          formatStudentAutoSBD(st.id) === padded6
      );
      if (exact) return exact;

      return null;
    },
    [studentsList]
  );

  /**
   * Nạp 1 file ảnh hoặc frame video lên Canvas và chạy OMR Engine
   */
  const processSingleImageSource = useCallback(
    async (
      imgSource: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
      fileNameLabel: string,
      widthPx: number,
      heightPx: number
    ): Promise<BulkScannedPaperItem> => {
      const workCanvas = document.createElement("canvas");
      workCanvas.width = widthPx;
      workCanvas.height = heightPx;
      const ctx = workCanvas.getContext("2d");
      if (!ctx) {
        throw new Error("Không thể khởi tạo bộ xử lý ảnh Canvas 2D.");
      }
      ctx.drawImage(imgSource, 0, 0, widthPx, heightPx);

      const targetExam = activeExamObj || practiceExams[0] || {};
      const omrRaw = scanOMRSheetFromCanvas(workCanvas, targetExam);
      const graded = gradeOMRSubmission(omrRaw, targetExam);
      const matchedStu = matchStudentBySbd(omrRaw.detected_sbd);

      const hasWarning =
        graded.updatedOmrData.flagged_questions.length > 0 ||
        !matchedStu ||
        omrRaw.detected_sbd === "Chưa tô";

      return {
        localId: "scan-" + Date.now() + "-" + Math.random().toString(36).substring(2, 7),
        fileName: fileNameLabel,
        status: hasWarning ? "flagged" : "ready",
        detectedSbd: omrRaw.detected_sbd,
        detectedExamCode: omrRaw.detected_exam_code,
        matchedStudent: matchedStu,
        matchedExam: targetExam,
        score: graded.score,
        manualScoreOverride: null,
        correctCount: graded.correctCount,
        totalQuestions: graded.totalQuestions,
        confidence: omrRaw.confidence,
        flaggedQuestions: graded.updatedOmrData.flagged_questions,
        warpedImageUrl: graded.updatedOmrData.warped_image_data_url || workCanvas.toDataURL("image/jpeg", 0.85),
        omrData: graded.updatedOmrData,
        gradingSummary: graded
      };
    },
    [activeExamObj, practiceExams, matchStudentBySbd]
  );

  /**
   * Xử lý tải hàng loạt file ảnh phiếu trả lời của cả lớp
   */
  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    if (!activeExamObj) {
      showToast("Vui lòng chọn đề thi chuẩn trước khi quét phiếu!", "error");
      return;
    }

    const filesArray = Array.from(fileList);
    setIsProcessingBatch(true);
    setProcessingProgress({ current: 0, total: filesArray.length });

    const newResults: BulkScannedPaperItem[] = [];

    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      setProcessingProgress({ current: i + 1, total: filesArray.length });

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Lỗi đọc file ảnh"));
          reader.readAsDataURL(file);
        });

        const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("Ảnh không hợp lệ"));
          img.src = dataUrl;
        });

        // Cho phép UI render thanh tiến trình mượt mà
        await new Promise((r) => setTimeout(r, 30));

        const scannedItem = await processSingleImageSource(
          imgEl,
          file.name,
          imgEl.naturalWidth || imgEl.width,
          imgEl.naturalHeight || imgEl.height
        );
        newResults.push(scannedItem);
      } catch (err: any) {
        newResults.push({
          localId: "err-" + Date.now() + "-" + i,
          fileName: file.name,
          status: "error",
          errorMessage: err?.message || "Không nhận diện được phiếu",
          detectedSbd: "Lỗi",
          detectedExamCode: "---",
          matchedStudent: null,
          matchedExam: activeExamObj,
          score: 0,
          manualScoreOverride: null,
          correctCount: 0,
          totalQuestions: 0,
          confidence: 0,
          flaggedQuestions: [],
          warpedImageUrl: "",
          omrData: {
            detected_sbd: "",
            detected_exam_code: "",
            confidence: 0,
            warp_matrix_applied: false,
            canonical_width: OMR_CANONICAL_WIDTH,
            canonical_height: OMR_CANONICAL_HEIGHT,
            part1_answers: {},
            part2_answers: {},
            part3_answers: {},
            flagged_questions: [],
            bubble_coordinates: []
          },
          gradingSummary: {
            score: 0,
            rawPointsEarned: 0,
            maxPossiblePoints: 10,
            totalQuestions: 0,
            correctCount: 0,
            wrongCount: 0,
            skippedCount: 0,
            part1Score: 0,
            part2Score: 0,
            part3Score: 0,
            normalizedAnswers: {},
            questionDetails: [],
            updatedOmrData: {
              detected_sbd: "",
              detected_exam_code: "",
              confidence: 0,
              warp_matrix_applied: false,
              canonical_width: OMR_CANONICAL_WIDTH,
              canonical_height: OMR_CANONICAL_HEIGHT,
              part1_answers: {},
              part2_answers: {},
              part3_answers: {},
              flagged_questions: [],
              bubble_coordinates: []
            }
          }
        });
      }
    }

    setScannedItems((prev) => [...newResults, ...prev]);
    setIsProcessingBatch(false);
    showToast(`Đã quét và chấm tự động ${newResults.length} phiếu trả lời!`, "success");
  };

  /**
   * Bật / Tắt Camera quét phiếu trực tiếp
   */
  const startCameraStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 100);
    } catch (err) {
      showToast("Không thể truy cập Camera. Vui lòng cấp quyền hoặc tải file ảnh lên!", "error");
    }
  };

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const handleCaptureFromCamera = async () => {
    if (!videoRef.current || !activeExamObj) return;
    const vid = videoRef.current;
    const w = vid.videoWidth || 1280;
    const h = vid.videoHeight || 720;

    try {
      const item = await processSingleImageSource(
        vid,
        `Camera_Capture_${scannedItems.length + 1}.jpg`,
        w,
        h
      );
      setScannedItems((prev) => [item, ...prev]);
      showToast(
        `Đã chụp & chấm phiếu: SBD ${item.detectedSbd} - Điểm: ${item.score}`,
        "success"
      );
    } catch {
      showToast("Lỗi khi chụp và phân tích phiếu từ Camera!", "error");
    }
  };

  /**
   * Giáo viên gán lại học sinh cho bài quét nếu học sinh tô nhầm SBD
   */
  const handleChangeMatchedStudent = (localId: string, newStudentId: string) => {
    const foundStu = studentsList.find((s) => String(s.id) === String(newStudentId)) || null;
    setScannedItems((prev) =>
      prev.map((item) => {
        if (item.localId !== localId) return item;
        const nextStatus =
          foundStu && item.flaggedQuestions.length === 0 ? "ready" : "flagged";
        return {
          ...item,
          matchedStudent: foundStu,
          detectedSbd: foundStu ? foundStu.sbd : item.detectedSbd,
          status: nextStatus
        };
      })
    );
  };

  /**
   * Giáo viên chỉnh sửa điểm trực tiếp (Phúc khảo / Tẩy chì lem)
   */
  const handleManualScoreChange = (localId: string, newScoreVal: string) => {
    const parsed = parseFloat(newScoreVal);
    setScannedItems((prev) =>
      prev.map((item) => {
        if (item.localId !== localId) return item;
        if (newScoreVal === "" || isNaN(parsed)) {
          return { ...item, manualScoreOverride: null };
        }
        const clamped = Math.min(10, Math.max(0, Number(parsed.toFixed(2))));
        return { ...item, manualScoreOverride: clamped };
      })
    );
  };

  /**
   * Lưu toàn bộ danh sách bài thi giấy vừa chấm vào Hệ thống (Supabase + LocalStorage + API)
   */
  const handleSaveAllScannedAttempts = async () => {
    const validItems = scannedItems.filter((it) => it.status !== "error" && it.matchedExam);
    if (validItems.length === 0) {
      showToast("Chưa có bài chấm hợp lệ nào để lưu!", "error");
      return;
    }

    setIsSavingAll(true);
    const nowIso = new Date().toISOString();
    const createdAttempts: ExamAttempt[] = [];

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      const finalScore =
        item.manualScoreOverride !== null ? item.manualScoreOverride : item.score;

      const stuId = item.matchedStudent?.id || `sbd-${item.detectedSbd || i + 1}`;
      const stuName =
        item.matchedStudent?.full_name || `Thí sinh SBD ${item.detectedSbd || "Chưa rõ"}`;
      const stuSchool = item.matchedStudent?.school || "THPT";
      const exObj = item.matchedExam || activeExamObj;
      const exId = String(exObj?.id || "practice-paper");
      const exTitle = String(exObj?.title || "Đề thi trên giấy");

      const attemptObj: ExamAttempt = {
        id: `att-admin-paper-${Date.now()}-${i}`,
        quiz_id: exId,
        quizId: exId,
        exam_id: exId,
        quiz_title: exTitle,
        quizTitle: exTitle,
        exam_title: exTitle,
        examTitle: exTitle,
        student_id: stuId,
        studentId: stuId,
        user_id: stuId,
        student_name: stuName,
        studentName: stuName,
        full_name: stuName,
        user_name: stuName,
        school: stuSchool,
        score: finalScore,
        points: finalScore,
        total_questions: item.totalQuestions,
        totalQuestions: item.totalQuestions,
        correct_count: item.correctCount,
        correctCount: item.correctCount,
        time_spent: "Thi giấy (Admin OMR)",
        timeSpent: "Thi giấy (Admin OMR)",
        duration_seconds: 0,
        is_homework: false,
        isHomework: false,
        type: "practice",
        submission_type: "paper",
        paper_scan_url: item.warpedImageUrl,
        omr_raw_data: item.omrData,
        recognition_confidence: item.confidence,
        flagged_questions: item.flaggedQuestions,
        answers: item.gradingSummary.normalizedAnswers,
        userAnswers: item.gradingSummary.normalizedAnswers,
        user_answers: item.gradingSummary.normalizedAnswers,
        created_at: nowIso,
        createdAt: nowIso,
        submittedAt: nowIso
      };

      createdAttempts.push(attemptObj);

      try {
        await fetch("/api/student/scan-paper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId: attemptObj.id,
            examId: exId,
            examTitle: exTitle,
            studentId: stuId,
            studentName: stuName,
            school: stuSchool,
            score: finalScore,
            totalQuestions: item.totalQuestions,
            correctCount: item.correctCount,
            isHomework: false,
            answers: item.gradingSummary.normalizedAnswers,
            omrData: item.omrData,
            imageBase64: item.warpedImageUrl
          })
        });
      } catch {}
    }

    // Lưu vào localStorage để đồng bộ tức thì
    if (typeof window !== "undefined") {
      try {
        const rawLocal = localStorage.getItem("edunexus_attempts");
        const parsedLocal = rawLocal ? JSON.parse(rawLocal) : [];
        localStorage.setItem(
          "edunexus_attempts",
          JSON.stringify([...createdAttempts, ...parsedLocal])
        );
        window.dispatchEvent(new Event("storage"));
      } catch {}
    }

    // Lưu lên Supabase
    if (supabase) {
      try {
        await Promise.allSettled([
          supabase.from("exam_attempts").insert(createdAttempts),
          supabase.from("attempts").insert(createdAttempts)
        ]);
      } catch {}
    }

    setIsSavingAll(false);
    showToast(
      `Đã lưu thành công ${createdAttempts.length} bài thi giấy vào hệ thống bảng điểm!`,
      "success"
    );
    if (onBulkSavedSuccess) {
      onBulkSavedSuccess(createdAttempts);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[550] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 font-sans text-left cursor-pointer"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl max-w-6xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden cursor-default"
        >
          {/* 1. HEADER MODAL */}
          <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
                <Camera className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                    ADMIN BULK OMR SCANNER
                  </span>
                  <span className="text-xs text-slate-300 font-semibold">
                    Nhận diện SBD tự động • Chấm hàng loạt
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-extrabold text-white truncate">
                  Hệ Thống Chấm Bài Thi Giấy Hàng Loạt Cả Lớp
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-600 text-slate-200 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2. THANH CHỌN ĐỀ THI CHUẨN & CÔNG CỤ NẠP ẢNH HÀNG LOẠT */}
          <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
              <label className="text-xs font-extrabold text-slate-700 shrink-0">
                Đề thi áp dụng đáp án:
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-white border-2 border-blue-200 focus:border-[#1D4ED8] text-xs font-extrabold text-slate-900 outline-none cursor-pointer flex-1 max-w-md shadow-2xs"
              >
                {(practiceExams || []).map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} ({ex.category || "Luyện đề"})
                  </option>
                ))}
              </select>

              {activeExamObj && (
                <button
                  type="button"
                  onClick={() => openPrintableDynamicAnswerSheet(activeExamObj)}
                  className="px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" /> In phiếu A4 đề này
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <label className="px-4 py-2.5 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-extrabold shadow-xs transition flex items-center gap-2 cursor-pointer">
                <UploadCloud className="w-4 h-4" />
                <span>+ Tải lên nhiều ảnh phiếu cả lớp</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFilesSelected(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => (isCameraActive ? stopCameraStream() : startCameraStream())}
                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold border transition flex items-center gap-1.5 cursor-pointer ${
                  isCameraActive
                    ? "bg-rose-600 text-white border-rose-700"
                    : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>{isCameraActive ? "Tắt Camera" : "Mở Camera quét liên tục"}</span>
              </button>
            </div>
          </div>

          {/* 3. BODY NỘI DUNG CHÍNH */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar bg-[#F8FAFC]">
            {/* KHỐI CAMERA NẾU ĐANG BẬT */}
            {isCameraActive && (
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 border border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Đặt tờ phiếu A4 nằm gọn trong khung hình (rõ 4 góc vuông đen)
                  </span>
                  <button
                    type="button"
                    onClick={handleCaptureFromCamera}
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" /> Chụp & Chấm ngay bài này
                  </button>
                </div>
                <div className="max-w-xl mx-auto rounded-xl overflow-hidden border-2 border-emerald-500/60 bg-black aspect-[3/4] max-h-[360px] flex items-center justify-center">
                  <video ref={videoRef} className="w-full h-full object-contain" playsInline muted />
                </div>
              </div>
            )}

            {/* THANH TIẾN TRÌNH ĐANG QUÉT HÀNG LOẠT */}
            {isProcessingBatch && (
              <div className="p-4 rounded-2xl bg-blue-50 border-2 border-blue-400 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-[#1D4ED8] animate-spin shrink-0" />
                  <div>
                    <p className="text-xs font-extrabold text-blue-950">
                      Đang quét OMR & chấm điểm tự động: Bài {processingProgress.current} /{" "}
                      {processingProgress.total}
                    </p>
                    <p className="text-[11px] text-blue-700">
                      Hệ thống đang nắn phẳng góc A4, đọc Số Báo Danh (6 cột) và đối chiếu đáp án...
                    </p>
                  </div>
                </div>
                <span className="text-sm font-black text-[#1D4ED8]">
                  {Math.round((processingProgress.current / Math.max(1, processingProgress.total)) * 100)}%
                </span>
              </div>
            )}

            {/* KHU VỰC KÉO THẢ NẾU CHƯA CÓ BÀI QUÉT NÀO */}
            {scannedItems.length === 0 && !isProcessingBatch && (
              <label className="border-2 border-dashed border-blue-300 hover:border-[#1D4ED8] bg-white hover:bg-blue-50/30 rounded-3xl p-10 text-center flex flex-col items-center justify-center gap-3 cursor-pointer transition-all">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#1D4ED8] border border-blue-200 flex items-center justify-center">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div className="space-y-1 max-w-lg">
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                    Kéo thả hoặc bấm vào đây để chọn hàng loạt ảnh chụp Phiếu trả lời của cả lớp
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Hỗ trợ chọn cùng lúc 20 - 50 ảnh phiếu. Hệ thống tự động đọc cột{" "}
                    <strong>Số Báo Danh (SBD)</strong> để khớp đúng tên học sinh theo STT trong danh
                    sách lớp và chấm điểm ngay lập tức.
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleFilesSelected(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}

            {/* BẢNG KẾT QUẢ CHẤM HÀNG LOẠT & ĐỐI SOÁT */}
            {scannedItems.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                      Danh sách bài thi giấy vừa chấm ({scannedItems.length} bài)
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                      Hợp lệ: {scannedItems.filter((i) => i.status === "ready").length}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">
                      Cần kiểm tra: {scannedItems.filter((i) => i.status === "flagged").length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Xóa danh sách vừa quét để quét lại từ đầu?")) {
                        setScannedItems([]);
                      }
                    }}
                    className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                  >
                    Xóa tất cả danh sách tạm
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] uppercase text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-3 font-bold text-center w-12">STT</th>
                        <th className="py-3 px-3 font-bold">SBD Quét được</th>
                        <th className="py-3 px-4 font-bold min-w-[200px]">
                          Học sinh tương ứng (Theo SBD)
                        </th>
                        <th className="py-3 px-3 font-bold text-center">Mã đề</th>
                        <th className="py-3 px-3 font-bold text-center">Số câu đúng</th>
                        <th className="py-3 px-3 font-bold text-center">Điểm OMR</th>
                        <th className="py-3 px-3 font-bold text-center">Sửa điểm (Nếu lem)</th>
                        <th className="py-3 px-3 font-bold text-center">Trạng thái</th>
                        <th className="py-3 px-4 font-bold text-right">Phúc khảo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {scannedItems.map((item, idx) => {
                        const displayFinalScore =
                          item.manualScoreOverride !== null ? item.manualScoreOverride : item.score;

                        return (
                          <tr key={item.localId} className="hover:bg-blue-50/30 transition">
                            <td className="py-3 px-3 text-center font-bold text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono font-black text-xs">
                                {item.detectedSbd}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <select
                                value={item.matchedStudent?.id || ""}
                                onChange={(e) =>
                                  handleChangeMatchedStudent(item.localId, e.target.value)
                                }
                                className={`w-full px-2.5 py-1.5 rounded-xl border text-xs font-bold outline-none cursor-pointer ${
                                  item.matchedStudent
                                    ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                                    : "bg-amber-50 border-amber-300 text-amber-900"
                                }`}
                              >
                                <option value="">-- Chọn học sinh thủ công --</option>
                                {studentsList.map((st) => (
                                  <option key={st.id} value={st.id}>
                                    SBD {st.sbd} - {st.full_name} ({st.school || "Lớp 12"})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">
                              {item.detectedExamCode}
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-slate-700">
                              {item.correctCount}/{item.totalQuestions}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#1D4ED8] border border-blue-200 font-black text-xs">
                                { displayFinalScore } đ
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <input
                                type="number"
                                step="0.05"
                                min="0"
                                max="10"
                                placeholder={String(item.score)}
                                value={
                                  item.manualScoreOverride !== null
                                    ? String(item.manualScoreOverride)
                                    : ""
                                }
                                onChange={(e) =>
                                  handleManualScoreChange(item.localId, e.target.value)
                                }
                                className="w-20 px-2 py-1 rounded-lg border border-slate-300 focus:border-[#1D4ED8] text-center font-extrabold text-xs outline-none"
                                title="Nhập điểm mới nếu muốn ghi đè điểm máy chấm"
                              />
                            </td>
                            <td className="py-3 px-3 text-center">
                              {item.status === "ready" ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                                  <CheckCircle2 className="w-3 h-3" /> Hợp lệ
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                                  <AlertTriangle className="w-3 h-3" /> Kiểm tra
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setInspectingItemId(item.localId)}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" /> Soi phiếu
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setScannedItems((prev) =>
                                      prev.filter((x) => x.localId !== item.localId)
                                    )
                                  }
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MODAL NHỎ SOI ẢNH PHIẾU ĐỐI CHIẾU Ô XANH (ĐÚNG) / ĐỎ (SAI) */}
            {inspectingItem && (
              <div className="p-5 rounded-3xl bg-slate-900 text-white space-y-4 border-2 border-indigo-500 shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                      PHÚC KHẢO & ĐỐI CHIẾU ẢNH QUÉT OMR
                    </span>
                    <h4 className="text-sm sm:text-base font-extrabold text-white">
                      Học sinh:{" "}
                      {inspectingItem.matchedStudent?.full_name ||
                        `SBD ${inspectingItem.detectedSbd}`}{" "}
                      — Điểm:{" "}
                      <span className="text-emerald-400">
                        {inspectingItem.manualScoreOverride ?? inspectingItem.score} / 10
                      </span>
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => setInspectingItemId(null)}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer"
                  >
                    Đóng khung soi phiếu
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Ảnh phiếu đã khoanh vùng */}
                  <div className="lg:col-span-6 bg-black rounded-2xl p-2 border border-slate-700 max-h-[520px] overflow-auto">
                    <div className="relative w-full">
                      <img
                        src={inspectingItem.warpedImageUrl}
                        alt="Warped Answer Sheet"
                        className="w-full h-auto block rounded-lg"
                      />
                      <svg
                        viewBox={`0 0 ${OMR_CANONICAL_WIDTH} ${OMR_CANONICAL_HEIGHT}`}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                      >
                        {inspectingItem.omrData.bubble_coordinates.map((b) => {
                          if (b.status === "unfilled") return null;
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
                              r={b.r + 3}
                              fill="none"
                              stroke={strokeColor}
                              strokeWidth="3"
                            />
                          );
                        })}
                      </svg>
                    </div>
                  </div>

                  {/* Bảng chi tiết từng câu của bài đang soi */}
                  <div className="lg:col-span-6 space-y-3 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
                    <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300">
                        Chỉnh sửa điểm trực tiếp sau phúc khảo:
                      </span>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="10"
                        value={
                          inspectingItem.manualScoreOverride !== null
                            ? String(inspectingItem.manualScoreOverride)
                            : String(inspectingItem.score)
                        }
                        onChange={(e) =>
                          handleManualScoreChange(inspectingItem.localId, e.target.value)
                        }
                        className="w-24 px-3 py-1.5 rounded-lg bg-slate-950 border border-indigo-400 text-emerald-400 font-black text-sm text-center outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {inspectingItem.gradingSummary.questionDetails.map((qd) => (
                        <div
                          key={qd.questionOrder}
                          className={`p-2.5 rounded-xl border text-xs ${
                            qd.status === "correct"
                              ? "bg-emerald-950/50 border-emerald-700/60 text-emerald-200"
                              : qd.status === "wrong"
                              ? "bg-rose-950/50 border-rose-700/60 text-rose-200"
                              : "bg-slate-800 border-slate-700 text-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between font-black">
                            <span>Câu {qd.questionOrder}</span>
                            <span>
                              +{qd.pointsEarned}/{qd.maxPoints}
                            </span>
                          </div>
                          <div className="text-[11px] mt-1">
                            HS tô: <strong>{qd.studentAnswerDisplay}</strong> • Đ/A:{" "}
                            <strong className="text-amber-300">{qd.correctAnswerDisplay}</strong>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 4. FOOTER LƯU TOÀN BỘ ĐIỂM */}
          <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-4 shrink-0">
            <div className="text-xs text-slate-500 font-medium">
              Mọi bài chấm sẽ được gắn nhãn{" "}
              <strong className="text-purple-700">[📄 Giấy]</strong> trên Bảng điểm Analytics & Báo
              cáo Phụ huynh.
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-bold transition cursor-pointer"
              >
                Đóng
              </button>

              <button
                type="button"
                disabled={scannedItems.length === 0 || isSavingAll}
                onClick={handleSaveAllScannedAttempts}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSavingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang đồng bộ điểm...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Lưu toàn bộ điểm vào hệ thống ({scannedItems.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default AdminBulkOMRScannerModal;
