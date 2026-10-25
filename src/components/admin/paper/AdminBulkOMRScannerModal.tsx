"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  X,
  Loader2,
  Trash2,
  Save,
  ZoomIn,
  ZoomOut,
  SwitchCamera,
  Edit3,
  AlertTriangle,
  Crosshair,
  Zap,
  CheckCircle2,
  Flashlight,
  Play,
  Eye
} from "lucide-react";
import { supabase as defaultSupabaseClient } from "@/lib/supabaseClient";
import {
  scanOMRSheetFromCanvas,
  gradeOMRSubmission,
  detectRealtimeCornerBoxes,
  deriveExamCode3Digits,
  formatStudentAutoSBD,
  CustomFourCornersInput,
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
  originalImageUrl: string;
  originalWidth: number;
  originalHeight: number;
  cornerPoints: CustomFourCornersInput;
  warpMatrixApplied: boolean;
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
  skippedQuestionsList: number[];
  geometryWarning?: string;
  warpedImageUrl: string;
  omrRawData: any;
  normalizedAnswers: Record<string, any>;
  questionDetails: any[];
  rawQuizObj: any;
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

  // CHẾ ĐỘ CAMERA 100% TOÀN MÀN HÌNH & MOBILE VIEW
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState<boolean>(true);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [mobileViewTab, setMobileViewTab] = useState<"camera" | "inspect">("camera");

  // TRẠNG THÁI 4 KHUNG NGẮM GÓC REALTIME (VÀNG -> XANH NGỌC)
  const [realtimeCornersStatus, setRealtimeCornersStatus] = useState<{
    isMatched: boolean;
    confidence: number;
    topLeft: boolean;
    topRight: boolean;
    bottomRight: boolean;
    bottomLeft: boolean;
  }>({
    isMatched: false,
    confidence: 0,
    topLeft: false,
    topRight: false,
    bottomRight: false,
    bottomLeft: false
  });

  const [cameraStatusText, setCameraStatusText] = useState<string>(
    "Đưa 4 ô vuông đen ở 4 góc phiếu khớp vào 4 khung ngắm..."
  );

  const [selectedQuizId, setSelectedQuizId] = useState<string>(
    effectiveInitialQuiz?.id ? String(effectiveInitialQuiz.id) : "auto"
  );

  const [scannedItems, setScannedItems] = useState<ScannedSheetItem[]>([]);
  const [activeInspectId, setActiveInspectId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);
  const [showQuickAdjustPanel, setShowQuickAdjustPanel] = useState<boolean>(true);

  // STATE CHO CHẾ ĐỘ KÉO CHỈNH 4 GÓC THỦ CÔNG (MANUAL 4-CORNER PIN ADJUSTER)
  const [isManualCornerMode, setIsManualCornerMode] = useState<boolean>(false);
  const [editingCorners, setEditingCorners] = useState<CustomFourCornersInput | null>(null);
  const [draggingCornerKey, setDraggingCornerKey] = useState<
    "topLeft" | "topRight" | "bottomRight" | "bottomLeft" | null
  >(null);
  const [isRewarpingManual, setIsRewarpingManual] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastAutoCaptureTimeRef = useRef<number>(0);
  const matchedHoldStartTimeRef = useRef<number | null>(null);
  const manualSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (effectiveInitialQuiz?.id) {
      setSelectedQuizId(String(effectiveInitialQuiz.id));
    }
  }, [effectiveInitialQuiz]);

  // 1. TỔNG HỢP DANH MỤC TẤT CẢ ĐỀ THI (BTVN + ĐỀ KT + LUYỆN ĐỀ)
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

  // 2. BẢNG TRA CỨU HỌC SINH THEO SBD (000001 -> 0000NN)
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

  // 3. QUẢN LÝ CAMERA TOÀN MÀN HÌNH & ĐÈN FLASH (TORCH API)
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
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
          height: { ideal: 1440 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraStatusText("Đưa 4 ô vuông đen ở 4 góc phiếu khớp vào 4 khung ngắm...");
    } catch {
      setCameraStatusText("Vui lòng cấp quyền truy cập Camera trên trình duyệt để quét phiếu.");
    }
  }, [facingMode, stopCamera]);

  const handleToggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextTorch = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as any]
      });
      setTorchOn(nextTorch);
    } catch {
      if (showToast) {
        showToast("Thiết bị hoặc trình duyệt này không hỗ trợ bật đèn Flash trực tiếp.", "error");
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, startCamera, stopCamera]);

  // HÀM XỬ LÝ 1 CANVAS ẢNH CHỤP -> TRÍCH XUẤT SBD, MÃ ĐỀ, CÂU BỎ TRỐNG & CHẤM ĐIỂM
  const processSingleCanvas = useCallback(
    (
      canvas: HTMLCanvasElement,
      labelName: string,
      originalDataUrl?: string,
      customCorners?: CustomFourCornersInput | null
    ): ScannedSheetItem | null => {
      let targetQuizEntry =
        selectedQuizId !== "auto"
          ? allQuizzesPool.find((q) => q.id === selectedQuizId) || allQuizzesPool[0]
          : allQuizzesPool[0];

      const preliminaryOmr = scanOMRSheetFromCanvas(
        canvas,
        targetQuizEntry?.rawObj,
        1,
        customCorners
      );

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
          ? scanOMRSheetFromCanvas(canvas, targetQuizEntry.rawObj, 1, customCorners)
          : preliminaryOmr;

      const graded = gradeOMRSubmission(finalOmr, targetQuizEntry?.rawObj);

      const cleanSbd = String(finalOmr.detected_sbd || "").trim();
      const parsedStt = parseInt(cleanSbd.replace(/\D/g, ""), 10);
      const matchedStu =
        sbdLookupMap.get(cleanSbd) ||
        (!isNaN(parsedStt) ? sbdLookupMap.get(String(parsedStt)) : undefined) ||
        null;

      const fallbackCorners: CustomFourCornersInput = finalOmr.corner_points || {
        topLeft: { x: Math.round(canvas.width * 0.04), y: Math.round(canvas.height * 0.03) },
        topRight: { x: Math.round(canvas.width * 0.96), y: Math.round(canvas.height * 0.03) },
        bottomRight: { x: Math.round(canvas.width * 0.96), y: Math.round(canvas.height * 0.97) },
        bottomLeft: { x: Math.round(canvas.width * 0.04), y: Math.round(canvas.height * 0.97) }
      };

      const skippedList = (graded.questionDetails || [])
        .filter((q: any) => q.status === "skipped")
        .map((q: any) => Number(q.questionOrder));

      const item: ScannedSheetItem = {
        tempId: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fileName: labelName,
        originalImageUrl: originalDataUrl || canvas.toDataURL("image/jpeg", 0.9),
        originalWidth: canvas.width,
        originalHeight: canvas.height,
        cornerPoints: fallbackCorners,
        warpMatrixApplied: Boolean(finalOmr.warp_matrix_applied),
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
        skippedQuestionsList: skippedList,
        geometryWarning: graded.updatedOmrData.geometry_warning,
        warpedImageUrl: graded.updatedOmrData.warped_image_data_url || "",
        omrRawData: graded.updatedOmrData,
        normalizedAnswers: graded.normalizedAnswers,
        questionDetails: graded.questionDetails || [],
        rawQuizObj: targetQuizEntry?.rawObj || null
      };

      return item;
    },
    [selectedQuizId, allQuizzesPool, sbdLookupMap]
  );

  // VÒNG LẶP QUÉT REALTIME 4 KHUNG NGẮM GÓC & TỰ ĐỘNG BẮT ẢNH (AUTO-LOCK 0.4s, KHÓA 2.5s)
  useEffect(() => {
    if (!isOpen) return;

    const checkCanvas = document.createElement("canvas");
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const now = Date.now();
      // Đang trong thời gian khóa 2.5s sau khi vừa chụp xong 1 phiếu
      if (now - lastAutoCaptureTimeRef.current < 2500) {
        return;
      }

      const vW = video.videoWidth || 1280;
      const vH = video.videoHeight || 720;
      checkCanvas.width = 480;
      checkCanvas.height = Math.round((vH / vW) * 480);
      const ctx = checkCanvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, checkCanvas.width, checkCanvas.height);
      const rtResult = detectRealtimeCornerBoxes(checkCanvas);

      setRealtimeCornersStatus({
        isMatched: rtResult.isMatched,
        confidence: rtResult.confidence,
        topLeft: rtResult.cornerStatus.topLeft,
        topRight: rtResult.cornerStatus.topRight,
        bottomRight: rtResult.cornerStatus.bottomRight,
        bottomLeft: rtResult.cornerStatus.bottomLeft
      });

      if (!autoCaptureEnabled) return;

      if (rtResult.isMatched && rtResult.detectedCorners) {
        if (!matchedHoldStartTimeRef.current) {
          matchedHoldStartTimeRef.current = now;
          setCameraStatusText("🎯 Đã khớp 4 góc! Giữ yên 0.4 giây để tự động chụp...");
        } else if (now - matchedHoldStartTimeRef.current >= 380) {
          // Đã giữ vững 4 góc trong ~0.4 giây -> KÍCH HOẠT CHỤP & CHẤM TỰ ĐỘNG!
          lastAutoCaptureTimeRef.current = now;
          matchedHoldStartTimeRef.current = null;

          setShutterFlash(true);
          setTimeout(() => setShutterFlash(false), 260);
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
              navigator.vibrate([80]);
            } catch {}
          }

          const fullCanvas = document.createElement("canvas");
          fullCanvas.width = vW;
          fullCanvas.height = vH;
          const fCtx = fullCanvas.getContext("2d");
          if (fCtx) {
            fCtx.drawImage(video, 0, 0, vW, vH);
            const scaleX = vW / checkCanvas.width;
            const scaleY = vH / checkCanvas.height;
            const scaledCorners: CustomFourCornersInput = {
              topLeft: {
                x: Math.round(rtResult.detectedCorners.topLeft.x * scaleX),
                y: Math.round(rtResult.detectedCorners.topLeft.y * scaleY)
              },
              topRight: {
                x: Math.round(rtResult.detectedCorners.topRight.x * scaleX),
                y: Math.round(rtResult.detectedCorners.topRight.y * scaleY)
              },
              bottomRight: {
                x: Math.round(rtResult.detectedCorners.bottomRight.x * scaleX),
                y: Math.round(rtResult.detectedCorners.bottomRight.y * scaleY)
              },
              bottomLeft: {
                x: Math.round(rtResult.detectedCorners.bottomLeft.x * scaleX),
                y: Math.round(rtResult.detectedCorners.bottomLeft.y * scaleY)
              }
            };

            const resultItem = processSingleCanvas(
              fullCanvas,
              `Camera_${new Date().toLocaleTimeString("vi-VN")}`,
              undefined,
              scaledCorners
            );

            if (resultItem) {
              setScannedItems((prev) => [resultItem, ...prev]);
              setActiveInspectId(resultItem.tempId);
              setIsManualCornerMode(false);
              setEditingCorners(resultItem.cornerPoints);
              setCameraStatusText(
                `✓ Đã chấm: ${resultItem.matchedStudentName} (${resultItem.score}đ) — Thay phiếu mới sau 2.5s!`
              );
            }
          }
        }
      } else {
        matchedHoldStartTimeRef.current = null;
        const matchedCount =
          (rtResult.cornerStatus.topLeft ? 1 : 0) +
          (rtResult.cornerStatus.topRight ? 1 : 0) +
          (rtResult.cornerStatus.bottomRight ? 1 : 0) +
          (rtResult.cornerStatus.bottomLeft ? 1 : 0);
        setCameraStatusText(
          matchedCount > 0
            ? `Đã bắt ${matchedCount}/4 góc vuông đen — Căn đủ 4 góc vào khung ngắm...`
            : "Đưa 4 ô vuông đen ở 4 góc phiếu khớp vào 4 khung ngắm..."
        );
      }
    }, 140);

    return () => clearInterval(interval);
  }, [isOpen, autoCaptureEnabled, processSingleCanvas]);

  // CHỤP BẰNG NÚT BẤM TAY TRỰC TIẾP TRÊN CAMERA
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

    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 240);

    fCtx.drawImage(video, 0, 0, vW, vH);
    const resultItem = processSingleCanvas(
      fullCanvas,
      `Camera_${new Date().toLocaleTimeString("vi-VN")}`
    );
    if (resultItem) {
      lastAutoCaptureTimeRef.current = Date.now();
      setScannedItems((prev) => [resultItem, ...prev]);
      setActiveInspectId(resultItem.tempId);
      setIsManualCornerMode(!resultItem.warpMatrixApplied);
      setEditingCorners(resultItem.cornerPoints);
      if (!resultItem.warpMatrixApplied) {
        setMobileViewTab("inspect");
      }
    }
  };

  const handleUpdateScannedItem = (
    tempId: string,
    updates: Partial<ScannedSheetItem>
  ) => {
    setScannedItems((prev) =>
      prev.map((it) => (it.tempId === tempId ? { ...it, ...updates } : it))
    );
  };

  const activeInspectItem =
    scannedItems.find((i) => i.tempId === activeInspectId) || scannedItems[0] || null;

  useEffect(() => {
    if (activeInspectItem) {
      setEditingCorners(activeInspectItem.cornerPoints);
    }
  }, [activeInspectItem?.tempId]);

  // XỬ LÝ KÉO THẢ 4 CHỐT GHIM GÓC TRÊN SVG
  const handleCornerSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingCornerKey || !manualSvgRef.current || !activeInspectItem || !editingCorners) {
      return;
    }
    const rect = manualSvgRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;

    const newX = Math.max(
      0,
      Math.min(activeInspectItem.originalWidth, Math.round(relX * activeInspectItem.originalWidth))
    );
    const newY = Math.max(
      0,
      Math.min(activeInspectItem.originalHeight, Math.round(relY * activeInspectItem.originalHeight))
    );

    setEditingCorners((prev) =>
      prev
        ? {
            ...prev,
            [draggingCornerKey]: { x: newX, y: newY }
          }
        : null
    );
  };

  const handleApplyManualCornersAndRescan = async () => {
    if (!activeInspectItem || !editingCorners || isRewarpingManual) return;
    setIsRewarpingManual(true);

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = activeInspectItem.originalImageUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = activeInspectItem.originalWidth || img.naturalWidth || OMR_CANONICAL_WIDTH;
      canvas.height = activeInspectItem.originalHeight || img.naturalHeight || OMR_CANONICAL_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const rescanned = processSingleCanvas(
          canvas,
          activeInspectItem.fileName,
          activeInspectItem.originalImageUrl,
          editingCorners
        );

        if (rescanned) {
          handleUpdateScannedItem(activeInspectItem.tempId, {
            ...rescanned,
            tempId: activeInspectItem.tempId,
            cornerPoints: editingCorners,
            warpMatrixApplied: true,
            geometryWarning: undefined
          });
          setIsManualCornerMode(false);
          if (showToast) {
            showToast(
              `✓ Đã nắn phẳng theo 4 góc mới! SBD: ${rescanned.detectedSbd} — Điểm: ${rescanned.score}đ`,
              "success"
            );
          }
        }
      }
    } catch (err) {
      console.error("Lỗi quét lại theo 4 góc thủ công:", err);
    } finally {
      setIsRewarpingManual(false);
    }
  };

  // CLICK-TO-ADJUST: SỬA NHANH SBD
  const handleManualSbdEdit = (item: ScannedSheetItem, newSbdRaw: string) => {
    const cleanSbd = newSbdRaw.replace(/[^0-9]/g, "").slice(0, 6);
    const parsedStt = parseInt(cleanSbd, 10);
    const matchedStu =
      sbdLookupMap.get(cleanSbd) ||
      (!isNaN(parsedStt) ? sbdLookupMap.get(String(parsedStt)) : undefined) ||
      null;

    const updatedCoords = (item.omrRawData?.bubble_coordinates || []).map((b: any) => {
      if (b.section !== "sbd") return b;
      const colMatch = String(b.id || "").match(/sbd-col(\d+)-(\d+)/);
      if (!colMatch) return b;
      const colIdx = Number(colMatch[1]);
      const digitStr = colMatch[2];
      const isNowSelected = cleanSbd[colIdx] === digitStr;
      return {
        ...b,
        isSelected: isNowSelected,
        status: isNowSelected ? "detected" : "unfilled"
      };
    });

    handleUpdateScannedItem(item.tempId, {
      detectedSbd: cleanSbd,
      matchedStudentId: matchedStu?.id || item.matchedStudentId,
      matchedStudentName:
        matchedStu?.full_name ||
        (cleanSbd ? `Học sinh (SBD: ${cleanSbd})` : item.matchedStudentName),
      matchedSchool: matchedStu?.school || item.matchedSchool,
      omrRawData: {
        ...item.omrRawData,
        detected_sbd: cleanSbd,
        bubble_coordinates: updatedCoords
      }
    });
  };

  // CLICK-TO-ADJUST: CLICK ĐỔI NHANH ĐÁP ÁN PHẦN I / PHẦN II / PHẦN III
  const handleQuickAdjustAnswer = (
    item: ScannedSheetItem,
    part: 1 | 2 | 3,
    localQuestionNum: number,
    newVal: any,
    subKey?: "a" | "b" | "c" | "d"
  ) => {
    const nextOmr = {
      ...item.omrRawData,
      part1_answers: { ...(item.omrRawData?.part1_answers || {}) },
      part2_answers: { ...(item.omrRawData?.part2_answers || {}) },
      part3_answers: { ...(item.omrRawData?.part3_answers || {}) },
      bubble_coordinates: (item.omrRawData?.bubble_coordinates || []).map((b: any) => ({
        ...b
      }))
    };

    if (part === 1) {
      const currentPicked = nextOmr.part1_answers[localQuestionNum] || "";
      const nextPicked = currentPicked === newVal ? "" : String(newVal);
      nextOmr.part1_answers[localQuestionNum] = nextPicked;
      nextOmr.bubble_coordinates.forEach((b: any) => {
        if (b.section === "part1" && b.questionNumber === localQuestionNum) {
          b.isSelected = b.optionKey === nextPicked;
          b.status = b.isSelected ? "detected" : "unfilled";
        }
      });
    } else if (part === 2 && subKey) {
      const curQMap = {
        a: null,
        b: null,
        c: null,
        d: null,
        ...(nextOmr.part2_answers[localQuestionNum] || {})
      };
      curQMap[subKey] = curQMap[subKey] === newVal ? null : Boolean(newVal);
      nextOmr.part2_answers[localQuestionNum] = curQMap;
      nextOmr.bubble_coordinates.forEach((b: any) => {
        if (
          b.section === "part2" &&
          b.questionNumber === localQuestionNum &&
          b.subKey === subKey
        ) {
          const isTrueBubble = b.optionKey === "T";
          b.isSelected = curQMap[subKey] !== null && isTrueBubble === curQMap[subKey];
          b.status = b.isSelected ? "detected" : "unfilled";
        }
      });
    } else if (part === 3) {
      nextOmr.part3_answers[localQuestionNum] = String(newVal || "").trim();
    }

    const regraded = gradeOMRSubmission(nextOmr, item.rawQuizObj);
    const nextSkippedList = (regraded.questionDetails || [])
      .filter((q: any) => q.status === "skipped")
      .map((q: any) => Number(q.questionOrder));

    handleUpdateScannedItem(item.tempId, {
      score: regraded.score,
      part1Score: regraded.part1Score,
      part2Score: regraded.part2Score,
      part3Score: regraded.part3Score,
      correctCount: regraded.correctCount,
      wrongCount: regraded.wrongCount,
      skippedCount: regraded.skippedCount,
      skippedQuestionsList: nextSkippedList,
      omrRawData: regraded.updatedOmrData,
      normalizedAnswers: regraded.normalizedAnswers,
      questionDetails: regraded.questionDetails || []
    });
  };

  // LƯU 1 BÀI ĐANG CHỌN & QUÉT TIẾP NGAY LẬP TỨC (1 CHẠM TRÊN MOBILE)
  const handleSaveSingleItemAndContinue = async (item: ScannedSheetItem) => {
    const nowIso = new Date().toISOString();
    const record: any = {
      id: `att-paper-${Date.now()}`,
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

    try {
      fetch("/api/student/scan-paper", {
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
      }).catch(() => {});

      if (effectiveSupabase) {
        Promise.allSettled([
          effectiveSupabase.from("exam_attempts").insert([record]),
          effectiveSupabase.from("quiz_results").insert([record])
        ]).catch(() => {});
      }
    } catch {}

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_attempts");
        const parsed = saved ? JSON.parse(saved) : [];
        const merged = [record, ...(Array.isArray(parsed) ? parsed : [])];
        localStorage.setItem("edunexus_attempts", JSON.stringify(merged));
        window.dispatchEvent(new Event("storage"));
      } catch {}
    }

    if (onSavedBatchAttempts) {
      onSavedBatchAttempts([record]);
    }

    if (showToast) {
      showToast(
        `✓ Đã lưu điểm ${item.matchedStudentName} (${item.score}đ) — Sẵn sàng quét bài tiếp theo!`,
        "success"
      );
    }

    setScannedItems((prev) => prev.filter((x) => x.tempId !== item.tempId));
    setMobileViewTab("camera");
    lastAutoCaptureTimeRef.current = 0;
  };

  // LƯU TẤT CẢ ĐIỂM VÀO HỆ THỐNG
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

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[550] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-0 sm:p-2 md:p-4 font-sans text-left cursor-pointer"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white sm:rounded-3xl max-w-6xl w-full h-full sm:h-[96vh] border border-slate-200 shadow-2xl flex flex-col overflow-hidden cursor-default"
        >
          {/* HEADER TỐI ƯU MOBILE & IPAD */}
          <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shrink-0">
                <Camera className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="truncate">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-emerald-400 block truncate">
                  100% REALTIME CAMERA OMR • 4-CORNER AUTO-LOCK
                </span>
                <h3 className="text-xs sm:text-sm font-black text-white truncate">
                  Camera Chấm Bài Thi Giấy Liên Tục
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <select
                value={selectedQuizId}
                onChange={(e) => setSelectedQuizId(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-[11px] sm:text-xs font-bold text-white outline-none cursor-pointer max-w-[170px] sm:max-w-[260px]"
              >
                <option value="auto">🤖 Tự nhận diện theo Mã đề</option>
                {allQuizzesPool.map((q) => (
                  <option key={q.id} value={q.id}>
                    [Mã {q.examCode}] {q.title}
                  </option>
                ))}
              </select>

              {/* Nút chuyển nhanh giữa Camera & Ảnh soi chi tiết trên Mobile */}
              <div className="flex lg:hidden bg-slate-800 p-0.5 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setMobileViewTab("camera")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                    mobileViewTab === "camera" ? "bg-emerald-600 text-white" : "text-slate-300"
                  }`}
                >
                  📷 Camera
                </button>
                <button
                  type="button"
                  onClick={() => setMobileViewTab("inspect")}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                    mobileViewTab === "inspect" ? "bg-purple-600 text-white" : "text-slate-300"
                  }`}
                >
                  🔍 Soi phiếu ({scannedItems.length})
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

          {/* BODY CHIA 2 NỬA TỐI ƯU TRÊN IPAD/DESKTOP & LINH HOẠT TRÊN MOBILE */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden bg-slate-50">
            {/* NỬA TRÁI (7 CỘT TRÊN IPAD/DESKTOP): VIEWFINDER CAMERA 4 KHUNG NGẮM GÓC + BẢNG KIỂM TRA NHANH */}
            <div
              className={`lg:col-span-7 border-r border-slate-200 flex flex-col min-h-0 p-2.5 sm:p-4 space-y-3 overflow-y-auto custom-scrollbar ${
                mobileViewTab === "inspect" ? "hidden lg:flex" : "flex"
              }`}
            >
              {/* KHUNG CAMERA TOÀN MÀN HÌNH VỚI 4 Ô NGẮM ĐỘNG */}
              <div className="bg-slate-950 rounded-2xl overflow-hidden border-2 border-slate-800 relative aspect-[4/3] sm:aspect-video max-h-[340px] w-full flex items-center justify-center shrink-0 shadow-lg">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Hiệu ứng chớp màn hình khi Auto-Capture */}
                {shutterFlash && (
                  <div className="absolute inset-0 bg-white/90 z-30 pointer-events-none transition-opacity" />
                )}

                {/* LỚP OVERLAY 4 KHUNG NGẮM GÓC (4-CORNER ALIGNMENT TARGET BOXES) */}
                <svg
                  viewBox="0 0 400 300"
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full pointer-events-none z-10"
                >
                  {/* Khung viền dẫn hướng tờ giấy A4 */}
                  <rect
                    x="32"
                    y="22"
                    width="336"
                    height="256"
                    fill="none"
                    stroke={realtimeCornersStatus.isMatched ? "#10B981" : "rgba(234, 179, 8, 0.45)"}
                    strokeWidth={realtimeCornersStatus.isMatched ? "2.5" : "1.5"}
                    strokeDasharray={realtimeCornersStatus.isMatched ? undefined : "6 4"}
                  />

                  {/* 4 Ô Vuông Ngắm Mục Tiêu ở 4 Góc */}
                  {[
                    { x: 18, y: 12, active: realtimeCornersStatus.topLeft, label: "TL" },
                    { x: 334, y: 12, active: realtimeCornersStatus.topRight, label: "TR" },
                    { x: 334, y: 240, active: realtimeCornersStatus.bottomRight, label: "BR" },
                    { x: 18, y: 240, active: realtimeCornersStatus.bottomLeft, label: "BL" }
                  ].map((box, bIdx) => (
                    <g key={bIdx}>
                      <rect
                        x={box.x}
                        y={box.y}
                        width="48"
                        height="48"
                        rx="6"
                        fill={
                          box.active
                            ? "rgba(16, 185, 129, 0.28)"
                            : "rgba(234, 179, 8, 0.12)"
                        }
                        stroke={box.active ? "#10B981" : "#EAB308"}
                        strokeWidth={box.active ? "3" : "2"}
                        strokeDasharray={box.active ? undefined : "5 3"}
                      />
                      <text
                        x={box.x + 24}
                        y={box.y + 28}
                        fontSize="10"
                        fontWeight="bold"
                        textAnchor="middle"
                        fill={box.active ? "#A7F3D0" : "#FEF08A"}
                      >
                        {box.active ? "✓ KHỚP" : box.label}
                      </text>
                    </g>
                  ))}
                </svg>

                {/* Thanh trạng thái trên đỉnh Camera */}
                <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 z-20">
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-extrabold border backdrop-blur-md transition ${
                      realtimeCornersStatus.isMatched
                        ? "bg-emerald-950/90 text-emerald-300 border-emerald-400 shadow-md"
                        : "bg-slate-900/85 text-amber-300 border-amber-400/40"
                    }`}
                  >
                    {cameraStatusText}
                  </span>

                  <button
                    type="button"
                    onClick={() => setAutoCaptureEnabled((prev) => !prev)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase cursor-pointer shrink-0 ${
                      autoCaptureEnabled
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {autoCaptureEnabled ? "Auto-Lock: BẬT" : "Auto-Lock: TẮT"}
                  </button>
                </div>

                {/* Thanh nút điều khiển dưới đáy Camera (Thao tác 1 tay dễ dàng) */}
                <div className="absolute bottom-2.5 inset-x-3 flex items-center justify-center gap-2.5 z-20">
                  <button
                    type="button"
                    onClick={handleToggleTorch}
                    className={`p-2.5 rounded-2xl text-xs font-bold transition cursor-pointer ${
                      torchOn
                        ? "bg-amber-400 text-slate-950 shadow-md"
                        : "bg-slate-900/85 text-white border border-slate-700"
                    }`}
                    title="Bật/Tắt đèn Flash"
                  >
                    <Flashlight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleManualCameraCapture}
                    className="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs sm:text-sm font-black shadow-xl transition flex items-center gap-2 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    <span>📸 Bắt ảnh & Chấm ngay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFacingMode((m) => (m === "environment" ? "user" : "environment"))
                    }
                    className="p-2.5 rounded-2xl bg-slate-900/85 text-white border border-slate-700 text-xs font-bold cursor-pointer"
                    title="Đổi Camera trước/sau"
                  >
                    <SwitchCamera className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* THẺ KIỂM TRA NHANH & CẢNH BÁO CÂU TRỐNG / TÔ MỜ CHO BÀI VỪA QUÉT */}
              {activeInspectItem && (
                <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-xs p-3 sm:p-3.5 space-y-2.5 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase">
                        ✓ Vừa quét
                      </span>

                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-[#1D4ED8] border border-blue-200 text-xs">
                        <span className="font-black">SBD:</span>
                        <input
                          type="text"
                          maxLength={6}
                          value={activeInspectItem.detectedSbd}
                          onChange={(e) =>
                            handleManualSbdEdit(activeInspectItem, e.target.value)
                          }
                          className="w-16 font-mono font-black text-[#1D4ED8] bg-white px-1 rounded border border-blue-200 outline-none text-center"
                        />
                      </div>

                      <select
                        value={activeInspectItem.matchedStudentId}
                        onChange={(e) => {
                          const stu = studentDirectory.find((s) => s.id === e.target.value);
                          if (stu) {
                            handleManualSbdEdit(activeInspectItem, stu.sbd);
                            handleUpdateScannedItem(activeInspectItem.tempId, {
                              matchedStudentId: stu.id,
                              matchedStudentName: stu.full_name,
                              matchedSchool: stu.school,
                              detectedSbd: stu.sbd
                            });
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-extrabold text-slate-900 outline-none"
                      >
                        <option value={activeInspectItem.matchedStudentId}>
                          {activeInspectItem.matchedStudentName}
                        </option>
                        {studentDirectory.map((s) => (
                          <option key={s.id} value={s.id}>
                            [{s.sbd}] {s.full_name}
                          </option>
                        ))}
                      </select>

                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[11px]">
                        Mã đề: {activeInspectItem.detectedExamCode}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-rose-600 text-white font-black text-sm shadow-xs">
                        {activeInspectItem.score.toFixed(2)}đ
                      </span>

                      <button
                        type="button"
                        onClick={() => handleSaveSingleItemAndContinue(activeInspectItem)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Lưu & Quét tiếp</span>
                      </button>
                    </div>
                  </div>

                  {/* CẢNH BÁO PHÁT HIỆN CÂU BỎ TRỐNG HOẶC TÔ MỜ */}
                  {(activeInspectItem.skippedQuestionsList.length > 0 ||
                    activeInspectItem.flaggedQuestions.length > 0 ||
                    activeInspectItem.geometryWarning) && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          {activeInspectItem.geometryWarning ? (
                            activeInspectItem.geometryWarning
                          ) : (
                            <>
                              Phát hiện{" "}
                              {activeInspectItem.skippedQuestionsList.length > 0 && (
                                <strong className="text-rose-700">
                                  Câu {activeInspectItem.skippedQuestionsList.slice(0, 8).join(", ")}
                                  {activeInspectItem.skippedQuestionsList.length > 8 ? "..." : ""}{" "}
                                  bỏ trống
                                </strong>
                              )}
                              {activeInspectItem.skippedQuestionsList.length > 0 &&
                                activeInspectItem.flaggedQuestions.length > 0 &&
                                " & "}
                              {activeInspectItem.flaggedQuestions.length > 0 && (
                                <strong className="text-amber-800">
                                  Câu {activeInspectItem.flaggedQuestions.join(", ")} tô mờ/lem chì
                                </strong>
                              )}{" "}
                              — Chạm bên dưới để kiểm tra / sửa nhanh!
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setIsManualCornerMode(true);
                            setMobileViewTab("inspect");
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-[11px] font-black cursor-pointer"
                        >
                          🎯 Chỉnh 4 góc
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileViewTab("inspect")}
                          className="lg:hidden px-2.5 py-1 rounded-lg bg-slate-800 text-white text-[11px] font-bold cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 inline mr-1" />
                          Xem ảnh
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DANH SÁCH CÁC PHIẾU ĐÃ QUÉT TRONG PHIÊN */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shrink-0">
                <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">
                    Danh sách chờ lưu ({scannedItems.length} bài)
                  </span>
                  {scannedItems.length > 0 && (
                    <button
                      type="button"
                      disabled={isSavingAll}
                      onClick={handleSaveAllScannedToSystem}
                      className="px-3.5 py-1.5 rounded-xl bg-[#1D4ED8] hover:bg-blue-700 text-white text-xs font-black shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingAll ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang lưu...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Lưu tất cả ({scannedItems.length} bài)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="max-h-[150px] overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                  {scannedItems.length === 0 ? (
                    <div className="py-6 text-center text-slate-400 text-xs italic">
                      Đưa phiếu trả lời vào khung ngắm Camera phía trên để tự động quét.
                    </div>
                  ) : (
                    scannedItems.map((item, idx) => {
                      const isSelected = activeInspectItem?.tempId === item.tempId;
                      return (
                        <div
                          key={item.tempId}
                          onClick={() => setActiveInspectId(item.tempId)}
                          className={`px-3.5 py-2 flex items-center justify-between gap-2 transition cursor-pointer ${
                            isSelected ? "bg-purple-50/90" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-black text-[10px]">
                              #{idx + 1}
                            </span>
                            <span className="font-mono font-black text-xs text-[#1D4ED8]">
                              [{item.detectedSbd}]
                            </span>
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {item.matchedStudentName}
                            </span>
                            <span className="text-[11px] text-slate-400 hidden sm:inline">
                              • Đúng {item.correctCount}/{item.totalQuestions}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 font-black text-xs">
                              {item.score.toFixed(2)}đ
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setScannedItems((prev) =>
                                  prev.filter((x) => x.tempId !== item.tempId)
                                );
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* KHUNG CHẠM SỬA NHANH ĐÁP ÁN TỪNG CÂU (CLICK-TO-ADJUST PANEL) */}
              {activeInspectItem && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shrink-0">
                  <div className="px-4 py-2 bg-indigo-50/80 border-b border-indigo-100 flex items-center justify-between">
                    <span className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>
                        Chạm sửa nhanh đáp án: {activeInspectItem.matchedStudentName}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowQuickAdjustPanel((p) => !p)}
                      className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      {showQuickAdjustPanel ? "Thu gọn" : "Mở rộng"}
                    </button>
                  </div>

                  {showQuickAdjustPanel && (
                    <div className="p-2.5 max-h-[165px] overflow-y-auto custom-scrollbar">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(activeInspectItem.questionDetails || []).map((qd: any) => {
                          const isRight = qd.status === "correct";
                          const isSkipped = qd.status === "skipped";
                          return (
                            <div
                              key={qd.questionOrder}
                              className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                                isRight
                                  ? "bg-emerald-50/40 border-emerald-200"
                                  : isSkipped
                                  ? "bg-amber-50/60 border-amber-300"
                                  : "bg-rose-50/40 border-rose-200"
                              }`}
                            >
                              <div>
                                <span className="font-black text-slate-800">
                                  Câu {qd.questionOrder}{" "}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  (ĐA: {qd.correctAnswerDisplay})
                                </span>
                              </div>

                              {qd.part === 1 && (
                                <div className="flex items-center gap-1">
                                  {["A", "B", "C", "D"].map((optK) => {
                                    const picked = qd.studentAnswerDisplay === optK;
                                    return (
                                      <button
                                        key={optK}
                                        type="button"
                                        onClick={() =>
                                          handleQuickAdjustAnswer(
                                            activeInspectItem,
                                            1,
                                            qd.questionOrder,
                                            optK
                                          )
                                        }
                                        className={`w-6 h-6 rounded-md font-black text-[10px] border transition cursor-pointer ${
                                          picked
                                            ? isRight
                                              ? "bg-emerald-600 text-white border-emerald-700"
                                              : "bg-rose-600 text-white border-rose-700"
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                        }`}
                                      >
                                        {optK}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {qd.part === 2 && (
                                <span className="text-[10px] font-bold text-slate-700">
                                  {qd.studentAnswerDisplay}
                                </span>
                              )}

                              {qd.part === 3 && (
                                <input
                                  type="text"
                                  value={
                                    qd.studentAnswerDisplay === "Bỏ trống"
                                      ? ""
                                      : qd.studentAnswerDisplay
                                  }
                                  placeholder="Trống"
                                  onChange={(e) => {
                                    const p1Count = (activeInspectItem.questionDetails || []).filter(
                                      (x: any) => x.part === 1
                                    ).length;
                                    const p2Count = (activeInspectItem.questionDetails || []).filter(
                                      (x: any) => x.part === 2
                                    ).length;
                                    const localNum = qd.questionOrder - p1Count - p2Count;
                                    handleQuickAdjustAnswer(
                                      activeInspectItem,
                                      3,
                                      Math.max(1, localNum),
                                      e.target.value
                                    );
                                  }}
                                  className="w-16 px-1.5 py-0.5 rounded border border-slate-300 bg-white text-center font-black text-xs text-slate-800 outline-none focus:border-blue-600"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* NỬA PHẢI (5 CỘT TRÊN IPAD/DESKTOP): XEM ẢNH ĐÃ CHẤM HOẶC KÉO CHỈNH 4 CHỐT GHIM GÓC */}
            <div
              className={`lg:col-span-5 bg-slate-900 flex flex-col min-h-0 ${
                mobileViewTab === "camera" ? "hidden lg:flex" : "flex"
              }`}
            >
              <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsManualCornerMode((v) => !v)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition cursor-pointer ${
                      isManualCornerMode
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>{isManualCornerMode ? "Đang chỉnh 4 góc" : "🎯 Kéo chỉnh 4 góc"}</span>
                  </button>

                  {isManualCornerMode && (
                    <button
                      type="button"
                      disabled={isRewarpingManual}
                      onClick={handleApplyManualCornersAndRescan}
                      className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black flex items-center gap-1 shadow-md cursor-pointer"
                    >
                      {isRewarpingManual ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 fill-slate-950" />
                      )}
                      <span>⚡ Nắn phẳng & Quét lại</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
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
                    onClick={() => setZoomScale((z) => Math.min(2.4, Number((z + 0.2).toFixed(2))))}
                    className="p-1 rounded bg-slate-800 text-white cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-3 sm:p-4 custom-scrollbar flex flex-col items-center justify-start">
                {activeInspectItem ? (
                  isManualCornerMode && editingCorners ? (
                    <div className="w-full space-y-2">
                      <div className="p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-[11px] font-semibold text-center">
                        Dùng ngón tay hoặc chuột kéo 4 chốt tròn màu xanh (<strong>TL, TR, BR, BL</strong>) đặt vào đúng 4 góc của tờ phiếu rồi bấm{" "}
                        <strong className="text-amber-300">[⚡ Nắn phẳng & Quét lại]</strong>
                      </div>

                      <div
                        style={{
                          width: `${Math.round(420 * zoomScale)}px`,
                          maxWidth: "100%",
                          aspectRatio: `${activeInspectItem.originalWidth} / ${activeInspectItem.originalHeight}`
                        }}
                        className="relative mx-auto rounded-xl overflow-hidden border-2 border-emerald-500 bg-black shadow-2xl select-none touch-none"
                      >
                        <img
                          src={activeInspectItem.originalImageUrl}
                          alt="Ảnh chụp gốc"
                          className="w-full h-full object-fill block pointer-events-none select-none"
                        />

                        <svg
                          ref={manualSvgRef}
                          viewBox={`0 0 ${activeInspectItem.originalWidth} ${activeInspectItem.originalHeight}`}
                          preserveAspectRatio="none"
                          onPointerMove={handleCornerSvgPointerMove}
                          onPointerUp={() => setDraggingCornerKey(null)}
                          onPointerLeave={() => setDraggingCornerKey(null)}
                          className="absolute inset-0 w-full h-full cursor-crosshair"
                        >
                          <polygon
                            points={`${editingCorners.topLeft.x},${editingCorners.topLeft.y} ${editingCorners.topRight.x},${editingCorners.topRight.y} ${editingCorners.bottomRight.x},${editingCorners.bottomRight.y} ${editingCorners.bottomLeft.x},${editingCorners.bottomLeft.y}`}
                            fill="rgba(16, 185, 129, 0.12)"
                            stroke="#10B981"
                            strokeWidth={Math.max(3, Math.round(activeInspectItem.originalWidth * 0.004))}
                            strokeDasharray="10 6"
                          />

                          {(
                            [
                              { key: "topLeft", label: "TL", pt: editingCorners.topLeft },
                              { key: "topRight", label: "TR", pt: editingCorners.topRight },
                              { key: "bottomRight", label: "BR", pt: editingCorners.bottomRight },
                              { key: "bottomLeft", label: "BL", pt: editingCorners.bottomLeft }
                            ] as const
                          ).map((corner) => {
                            const pinR = Math.max(
                              18,
                              Math.round(activeInspectItem.originalWidth * 0.026)
                            );
                            return (
                              <g
                                key={corner.key}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  setDraggingCornerKey(corner.key);
                                }}
                                className="cursor-grab active:cursor-grabbing"
                              >
                                <circle
                                  cx={corner.pt.x}
                                  cy={corner.pt.y}
                                  r={pinR}
                                  fill="#10B981"
                                  stroke="#FFFFFF"
                                  strokeWidth={4}
                                />
                                <text
                                  x={corner.pt.x}
                                  y={corner.pt.y + 5}
                                  fontSize={Math.max(12, Math.round(pinR * 0.75))}
                                  fontWeight="bold"
                                  textAnchor="middle"
                                  fill="#FFFFFF"
                                >
                                  {corner.label}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        width: `${Math.round(420 * zoomScale)}px`,
                        maxWidth: "100%",
                        aspectRatio: `${OMR_CANONICAL_WIDTH} / ${OMR_CANONICAL_HEIGHT}`,
                        transition: "width 0.18s ease-out"
                      }}
                      className="relative rounded-xl overflow-hidden border border-slate-700 bg-white shadow-2xl shrink-0"
                    >
                      <img
                        src={activeInspectItem.warpedImageUrl}
                        alt="Phiếu đã chấm"
                        className="w-full h-full object-fill block select-none"
                      />
                      {activeInspectItem.omrRawData?.bubble_coordinates && (
                        <svg
                          viewBox={`0 0 ${OMR_CANONICAL_WIDTH} ${OMR_CANONICAL_HEIGHT}`}
                          preserveAspectRatio="none"
                          className="absolute inset-0 w-full h-full"
                        >
                          {activeInspectItem.omrRawData.bubble_coordinates
                            .filter((b: any) => b.status !== "unfilled")
                            .map((b: any) => {
                              const isSbdOrCode =
                                b.section === "sbd" || b.section === "exam_code";

                              const strokeColor = isSbdOrCode
                                ? "#7C3AED"
                                : b.status === "correct"
                                ? "#10B981"
                                : b.status === "wrong"
                                ? "#EF4444"
                                : b.status === "expected_missed"
                                ? "#3B82F6"
                                : "#F59E0B";

                              return (
                                <g
                                  key={b.id}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    if (b.section === "part1" && b.questionNumber) {
                                      handleQuickAdjustAnswer(
                                        activeInspectItem,
                                        1,
                                        b.questionNumber,
                                        b.optionKey
                                      );
                                    }
                                  }}
                                >
                                  <circle
                                    cx={b.x}
                                    cy={b.y}
                                    r={b.r + 2.5}
                                    fill={
                                      isSbdOrCode
                                        ? "rgba(124, 58, 237, 0.25)"
                                        : b.status === "correct"
                                        ? "rgba(16,185,129,0.24)"
                                        : b.status === "wrong"
                                        ? "rgba(239,68,68,0.24)"
                                        : "none"
                                    }
                                    stroke={strokeColor}
                                    strokeWidth={2.4}
                                    strokeDasharray={
                                      b.status === "expected_missed" ? "4 2" : undefined
                                    }
                                  />
                                </g>
                              );
                            })}
                        </svg>
                      )}
                    </div>
                  )
                ) : (
                  <div className="my-auto text-center text-slate-500 text-xs p-6 space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-slate-700 mx-auto" />
                    <p>
                      Đưa phiếu trả lời vào khung ngắm Camera bên trái. Ngay khi bắt đủ 4 góc, ảnh đối chiếu xanh/đỏ sẽ hiển thị tại đây!
                    </p>
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
