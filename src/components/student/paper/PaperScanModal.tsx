"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Upload,
  X,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Loader2,
  Maximize2,
  FileCheck2,
  SwitchCamera,
  Eye,
  Send
} from "lucide-react";
import { Profile, ExamAttempt, OMRGradingSummary } from "@/types";
import {
  scanOMRSheetFromCanvas,
  gradeOMRSubmission,
  OMR_CANONICAL_WIDTH,
  OMR_CANONICAL_HEIGHT
} from "@/lib/omrEngine";
import { supabase } from "@/lib/supabaseClient";

export interface PaperScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: any;
  profile: Profile;
  isHomework?: boolean;
  onScanComplete?: (attemptRecord: ExamAttempt, gradingSummary: OMRGradingSummary) => void;
}

export function PaperScanModal({
  isOpen,
  onClose,
  exam,
  profile,
  isHomework = false,
  onScanComplete
}: PaperScanModalProps) {
  const [mode, setMode] = useState<"camera" | "upload" | "scanning" | "preview_result">("camera");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanWarning, setScanWarning] = useState<string | null>(null);

  const [capturedImageSrc, setCapturedImageSrc] = useState<string | null>(null);
  const [scanStepIndex, setScanStepIndex] = useState<number>(0);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [isSavingSubmission, setIsSavingSubmission] = useState<boolean>(false);

  // Cho phép học sinh chỉnh sửa nhanh đáp án nếu ảnh chụp bị bóng mờ ở một vài câu
  const [gradingResult, setGradingResult] = useState<OMRGradingSummary | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const SCAN_MESSAGES = [
    "Đang nhận diện 4 điểm định vị góc phiếu...",
    "Đang nắn thẳng bề mặt giấy và khử bóng mờ...",
    "Đang bóc tách Số báo danh, Mã đề và đáp án tô chì..."
  ];

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCameraStream = useCallback(async () => {
    stopCameraStream();
    setCameraError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Trình duyệt không hỗ trợ mở Camera trực tiếp. Vui lòng chọn 'Tải ảnh có sẵn'.");
      setMode("upload");
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
    } catch (err) {
      setCameraError("Không thể truy cập Camera (Chưa cấp quyền hoặc thiết bị không có Camera). Bạn có thể tải ảnh từ máy.");
      setMode("upload");
    }
  }, [facingMode, stopCameraStream]);

  useEffect(() => {
    if (isOpen && mode === "camera") {
      startCameraStream();
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [isOpen, mode, startCameraStream, stopCameraStream]);

  // HÀM CHẠY TIẾN TRÌNH QUÉT OMR VÀ CHẤM ĐIỂM TỰ ĐỘNG
  const executeOMRProcessing = async (imgElement: HTMLImageElement) => {
    setMode("scanning");
    setScanWarning(null);
    setScanStepIndex(0);
    setScanProgress(15);

    const workCanvas = document.createElement("canvas");
    const maxDim = 1800;
    let targetW = imgElement.naturalWidth || imgElement.width || OMR_CANONICAL_WIDTH;
    let targetH = imgElement.naturalHeight || imgElement.height || OMR_CANONICAL_HEIGHT;

    if (targetW > maxDim || targetH > maxDim) {
      const ratio = Math.min(maxDim / targetW, maxDim / targetH);
      targetW = Math.round(targetW * ratio);
      targetH = Math.round(targetH * ratio);
    }

    workCanvas.width = targetW;
    workCanvas.height = targetH;
    const ctx = workCanvas.getContext("2d");
    if (!ctx) {
      setScanWarning("Không thể khởi tạo bộ xử lý ảnh trên trình duyệt này.");
      setMode("upload");
      return;
    }

    ctx.drawImage(imgElement, 0, 0, targetW, targetH);

    // Bước 1: Định vị 4 góc
    await new Promise((r) => setTimeout(r, 550));
    setScanStepIndex(1);
    setScanProgress(52);

    // Bước 2: Nắn thẳng bề mặt giấy
    await new Promise((r) => setTimeout(r, 600));
    setScanStepIndex(2);
    setScanProgress(85);

    try {
      const omrRaw = scanOMRSheetFromCanvas(workCanvas);
      const graded = gradeOMRSubmission(omrRaw, exam);

      await new Promise((r) => setTimeout(r, 450));
      setScanProgress(100);

      if (!omrRaw.warp_matrix_applied) {
        setScanWarning(
          "Không tìm thấy đủ 4 mốc góc đen, hệ thống đã tự động căn khung chuẩn. Nếu kết quả lệch, vui lòng chụp toàn bộ mặt trước của phiếu!"
        );
      } else if (omrRaw.flagged_questions.length > 0) {
        setScanWarning(
          `Phát hiện ${omrRaw.flagged_questions.length} câu có dấu hiệu tô mờ hoặc tẩy chưa sạch (Câu ${omrRaw.flagged_questions.join(", ")}). Vui lòng kiểm tra trước khi xác nhận nộp!`
        );
      }

      if (omrRaw.warped_image_data_url) {
        setCapturedImageSrc(omrRaw.warped_image_data_url);
      }

      setGradingResult(graded);
      setMode("preview_result");
    } catch (error) {
      console.error("Lỗi xử lý OMR:", error);
      setScanWarning("Không tìm thấy đủ 4 mốc góc, vui lòng chụp toàn bộ mặt trước của phiếu!");
      setMode("upload");
    }
  };

  // CHỤP ẢNH TRỰC TIẾP TỪ VIDEO CAMERA
  const handleCaptureFromVideo = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const vW = video.videoWidth || 1280;
    const vH = video.videoHeight || 720;

    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = vW;
    captureCanvas.height = vH;
    const ctx = captureCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, vW, vH);
    const dataUrl = captureCanvas.toDataURL("image/jpeg", 0.92);
    setCapturedImageSrc(dataUrl);
    stopCameraStream();

    const img = new Image();
    img.onload = () => {
      executeOMRProcessing(img);
    };
    img.src = dataUrl;
  };

  // TẢI ẢNH CÓ SẴN TỪ THIẾT BỊ
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = String(ev.target?.result || "");
      if (!dataUrl) return;
      setCapturedImageSrc(dataUrl);
      stopCameraStream();

      const img = new Image();
      img.onload = () => {
        executeOMRProcessing(img);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // LƯU KẾT QUẢ CHẤM BÀI TRÊN GIẤY LÊN SUPABASE & LOCALSTORAGE
  const handleConfirmSubmitPaperExam = async () => {
    if (!gradingResult || isSavingSubmission) return;
    setIsSavingSubmission(true);

    const nowIso = new Date().toISOString();
    const attemptId = "att-paper-" + Date.now();
    const studentId = String(profile?.id || profile?.username || "student");
    const studentName = String(profile?.full_name || profile?.username || "Học sinh");
    const quizId = String(exam?.id || "quiz-paper");
    const quizTitle = String(exam?.title || "Đề thi trên giấy");

    let finalScanImageUrl = gradingResult.updatedOmrData.warped_image_data_url || capturedImageSrc || "";

    // Thử tải ảnh phiếu đã nắn phẳng lên Supabase Storage bucket "exam-paper-scans"
    if (finalScanImageUrl && finalScanImageUrl.startsWith("data:image/")) {
      try {
        const res = await fetch(finalScanImageUrl);
        const blob = await res.blob();
        const filePath = `${quizId}/${studentId}_${Date.now()}.jpg`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("exam-paper-scans")
          .upload(filePath, blob, {
            contentType: "image/jpeg",
            upsert: true
          });

        if (!uploadError && uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from("exam-paper-scans")
            .getPublicUrl(filePath);
          if (publicUrlData?.publicUrl) {
            finalScanImageUrl = publicUrlData.publicUrl;
          }
        }
      } catch (storageErr) {
        // Giữ nguyên DataURL nếu bucket chưa được tạo
      }
    }

    const updatedOmrPayload = {
      ...gradingResult.updatedOmrData,
      warped_image_data_url: finalScanImageUrl
    };

    const attemptRecord: ExamAttempt = {
      id: attemptId,
      quiz_id: quizId,
      quizId: quizId,
      exam_id: quizId,
      quiz_title: quizTitle,
      quizTitle: quizTitle,
      exam_title: quizTitle,
      examTitle: quizTitle,
      student_id: studentId,
      studentId: studentId,
      user_id: studentId,
      student_name: studentName,
      studentName: studentName,
      full_name: studentName,
      user_name: studentName,
      school: profile?.school || "THPT",
      score: gradingResult.score,
      points: gradingResult.score,
      total_questions: gradingResult.totalQuestions,
      totalQuestions: gradingResult.totalQuestions,
      correct_count: gradingResult.correctCount,
      correctCount: gradingResult.correctCount,
      time_spent: "Làm trên giấy",
      timeSpent: "Làm trên giấy",
      duration_seconds: 0,
      is_homework: Boolean(isHomework),
      isHomework: Boolean(isHomework),
      type: isHomework ? "homework" : "practice",
      submission_type: "paper",
      paper_scan_url: finalScanImageUrl,
      omr_raw_data: updatedOmrPayload,
      recognition_confidence: updatedOmrPayload.confidence,
      flagged_questions: updatedOmrPayload.flagged_questions,
      answers: gradingResult.normalizedAnswers,
      userAnswers: gradingResult.normalizedAnswers,
      user_answers: gradingResult.normalizedAnswers,
      created_at: nowIso,
      createdAt: nowIso,
      submittedAt: nowIso
    };

    // 1. Lưu vào localStorage
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_attempts");
        const parsed = saved ? JSON.parse(saved) : [];
        const updated = [attemptRecord, ...parsed];
        localStorage.setItem("edunexus_attempts", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      } catch (e) {}
    }

    // 2. Đồng bộ lên API Backend & Supabase
    try {
      await fetch("/api/student/submit-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attemptRecord)
      });
    } catch {}

    try {
      await Promise.allSettled([
        supabase.from("exam_attempts").insert([attemptRecord]),
        supabase.from("attempts").insert([attemptRecord]),
        supabase.from("quiz_attempts").insert([attemptRecord])
      ]);
    } catch {}

    try {
      const channel = supabase.channel("admin-realtime-global-sync");
      channel.send({
        type: "broadcast",
        event: "new_attempt",
        payload: attemptRecord
      });
    } catch {}

    setIsSavingSubmission(false);

    if (onScanComplete) {
      onScanComplete(attemptRecord, {
        ...gradingResult,
        updatedOmrData: updatedOmrPayload
      });
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 font-sans text-left"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]"
        >
          {/* INPUT CHỌN ẢNH ẨN */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* HEADER MODAL */}
          <div className="px-4 sm:px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                <Camera className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block">
                  CHẤM BÀI TRÊN GIẤY BẰNG AI / OMR
                </span>
                <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                  {exam?.title || "Phiếu trả lời trắc nghiệm"}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {mode === "camera" && (
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))
                  }
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  title="Đổi Camera trước / sau"
                >
                  <SwitchCamera className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Đổi Camera</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* BODY MODAL */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-4 bg-slate-50">
            {/* THÔNG BÁO CẢNH BÁO NẾU CÓ */}
            {scanWarning && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-start gap-2.5 shadow-2xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{scanWarning}</div>
              </div>
            )}

            {/* CHẾ ĐỘ 1 & 2: CAMERA STREAM HOẶC TẢI ẢNH LÊN */}
            {(mode === "camera" || mode === "upload") && (
              <div className="space-y-4">
                <div className="relative bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-300 aspect-[3/4] max-h-[58vh] mx-auto flex items-center justify-center shadow-inner">
                  {mode === "camera" && !cameraError ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />

                      {/* KHUNG NGẮM CĂN CHỈNH 4 GÓC (TARGET RETICLE) */}
                      <div className="absolute inset-5 sm:inset-7 pointer-events-none border border-emerald-400/40 rounded-xl flex flex-col justify-between p-2">
                        <div className="flex justify-between">
                          <div className="w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl-md shadow-sm" />
                          <div className="w-7 h-7 border-t-4 border-r-4 border-emerald-400 rounded-tr-md shadow-sm" />
                        </div>

                        <div className="mx-auto px-3 py-1 rounded-full bg-slate-900/75 text-emerald-300 text-[11px] font-bold tracking-wide border border-emerald-400/30 backdrop-blur-xs text-center">
                          Đặt 4 ô vuông đen ở 4 góc phiếu khớp vào 4 góc khung xanh
                        </div>

                        <div className="flex justify-between">
                          <div className="w-7 h-7 border-b-4 border-l-4 border-emerald-400 rounded-bl-md shadow-sm" />
                          <div className="w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br-md shadow-sm" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="p-8 text-center space-y-3 max-w-md">
                      <div className="w-16 h-16 rounded-2xl bg-slate-800 text-blue-400 flex items-center justify-center mx-auto border border-slate-700">
                        <Upload className="w-8 h-8" />
                      </div>
                      <h4 className="text-sm font-bold text-white">
                        Tải ảnh chụp Phiếu trả lời trắc nghiệm
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {cameraError ||
                          "Hãy chụp thẳng mặt trước của tờ phiếu A4 ở nơi đủ ánh sáng, đảm bảo rõ cả 4 ô vuông đen ở 4 góc phiếu."}
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-5 py-2.5 bg-[#1D4ED8] hover:bg-blue-600 text-white rounded-xl text-xs font-bold shadow-md transition inline-flex items-center gap-2 cursor-pointer"
                      >
                        <Upload className="w-4 h-4" /> Chọn ảnh từ máy
                      </button>
                    </div>
                  )}
                </div>

                {/* CỤM NÚT ĐIỀU KHIỂN CAMERA & UPLOAD */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  {mode === "camera" && !cameraError ? (
                    <button
                      type="button"
                      onClick={handleCaptureFromVideo}
                      className="w-full sm:w-auto px-8 py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-2xl font-black text-xs sm:text-sm shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" /> 📸 Chụp phiếu
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("camera");
                        startCameraStream();
                      }}
                      className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" /> Mở Camera chụp
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-2xl font-bold text-xs sm:text-sm shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-[#1D4ED8]" /> 📁 Tải ảnh có sẵn
                  </button>
                </div>
              </div>
            )}

            {/* CHẾ ĐỘ 3: HIỆU ỨNG LASER SCANNING TRÊN ẢNH VỪA CHỤP */}
            {mode === "scanning" && (
              <div className="space-y-5 py-2">
                <div className="relative rounded-2xl overflow-hidden border-2 border-[#1D4ED8] max-w-md mx-auto aspect-[3/4] max-h-[54vh] bg-slate-900 shadow-xl">
                  {capturedImageSrc && (
                    <img
                      src={capturedImageSrc}
                      alt="Đang quét phiếu"
                      className="w-full h-full object-contain opacity-85"
                    />
                  )}

                  {/* TIA LASER QUÉT DỌC MÀN HÌNH */}
                  <motion.div
                    initial={{ top: "2%" }}
                    animate={{ top: ["4%", "94%", "4%"] }}
                    transition={{ duration: 1.7, repeat: Infinity, ease: "linear" }}
                    className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_20px_4px_rgba(16,185,129,0.85)] z-20"
                  />

                  <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 via-transparent to-blue-950/50 pointer-events-none" />
                </div>

                <div className="max-w-md mx-auto bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5 text-center">
                  <div className="flex items-center justify-center gap-2 text-xs font-extrabold text-[#1D4ED8]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{SCAN_MESSAGES[scanStepIndex] || SCAN_MESSAGES[0]}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-300 rounded-full"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* CHẾ ĐỘ 4: XEM TRƯỚC KẾT QUẢ BÓC TÁCH TRƯỚC KHI XÁC NHẬN NỘP */}
            {mode === "preview_result" && gradingResult && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {/* ẢNH ĐÃ NẮN PHẲNG + OVERLAY BUBBLE */}
                <div className="md:col-span-5 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>Ảnh phiếu đã nắn phẳng</span>
                    <span className="text-emerald-600 font-extrabold">
                      Độ tin cậy: {gradingResult.updatedOmrData.confidence}%
                    </span>
                  </div>

                  <div className="relative w-full aspect-[12/17] rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                    {capturedImageSrc && (
                      <img
                        src={capturedImageSrc}
                        alt="Phiếu đã quét"
                        className="w-full h-full object-fill"
                      />
                    )}
                    <svg
                      viewBox={`0 0 ${OMR_CANONICAL_WIDTH} ${OMR_CANONICAL_HEIGHT}`}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    >
                      {gradingResult.updatedOmrData.bubble_coordinates
                        .filter((b) => b.status !== "unfilled")
                        .map((b) => {
                          const strokeColor =
                            b.status === "correct"
                              ? "#10B981"
                              : b.status === "wrong"
                              ? "#EF4444"
                              : b.status === "expected_missed"
                              ? "#3B82F6"
                              : b.status === "ambiguous"
                              ? "#F59E0B"
                              : "#6366F1";

                          return (
                            <circle
                              key={b.id}
                              cx={b.x}
                              cy={b.y}
                              r={b.r + 3}
                              fill={
                                b.status === "correct"
                                  ? "rgba(16,185,129,0.22)"
                                  : b.status === "wrong"
                                  ? "rgba(239,68,68,0.22)"
                                  : "none"
                              }
                              stroke={strokeColor}
                              strokeWidth={2.5}
                              strokeDasharray={b.status === "expected_missed" ? "4 2" : undefined}
                            />
                          );
                        })}
                    </svg>
                  </div>
                </div>

                {/* BẢNG TÓM TẮT KẾT QUẢ CHẤM */}
                <div className="md:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase">
                        Đã quét thành công
                      </span>
                      <h4 className="text-sm sm:text-base font-black text-slate-900 mt-1">
                        Điểm chấm tự động: <span className="text-[#1D4ED8]">{gradingResult.score.toFixed(2)} / 10</span>
                      </h4>
                    </div>

                    <div className="text-right text-xs font-bold text-slate-500">
                      <div>SBD: <strong className="text-slate-800">{gradingResult.updatedOmrData.detected_sbd}</strong></div>
                      <div>Mã đề: <strong className="text-[#1D4ED8]">{gradingResult.updatedOmrData.detected_exam_code}</strong></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block">Câu đúng</span>
                      <span className="text-base font-black text-emerald-700">{gradingResult.correctCount}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                      <span className="text-[10px] font-bold text-rose-700 uppercase block">Câu sai</span>
                      <span className="text-base font-black text-rose-700">{gradingResult.wrongCount}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-600 uppercase block">Bỏ trống</span>
                      <span className="text-base font-black text-slate-700">{gradingResult.skippedCount}</span>
                    </div>
                  </div>

                  <div className="max-h-52 overflow-y-auto custom-scrollbar border border-slate-100 rounded-xl divide-y divide-slate-100">
                    {gradingResult.questionDetails.map((qd) => (
                      <div
                        key={qd.questionOrder}
                        className="px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50"
                      >
                        <span className="font-bold text-slate-700">
                          Câu {qd.questionOrder} <span className="text-[10px] text-slate-400">(Phần {qd.part})</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">
                            Tô: <strong className="text-slate-800">{qd.studentAnswerDisplay}</strong>
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              qd.status === "correct"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : qd.status === "skipped"
                                ? "bg-slate-100 text-slate-500"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            {qd.status === "correct"
                              ? "✓ Đúng"
                              : qd.status === "skipped"
                              ? "Trống"
                              : `✕ Sai (ĐA: ${qd.correctAnswerDisplay})`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setGradingResult(null);
                        setScanWarning(null);
                        setMode("camera");
                      }}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Chụp / Quét lại
                    </button>

                    <button
                      type="button"
                      disabled={isSavingSubmission}
                      onClick={handleConfirmSubmitPaperExam}
                      className="flex-1 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl text-xs font-black shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      {isSavingSubmission ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Đang lưu kết quả & mở bài chấm...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Xác nhận nộp & Xem chi tiết bài chấm</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default PaperScanModal;
