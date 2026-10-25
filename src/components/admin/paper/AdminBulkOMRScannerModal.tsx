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
  Eye,
  ChevronUp,
  ChevronDown,
  FileCheck2
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

  // CHẾ ĐỘ CAMERA DỌC TOÀN MÀN HÌNH & KHAY TRƯỢT ĐÁY (BOTTOM SHEET)
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState<boolean>(true);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [mobileViewTab, setMobileViewTab] = useState<"camera" | "inspect">("camera");
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState<boolean>(false);

  // TOAST NỔI 1.8 GIÂY KHI QUÉT XONG 1 BÀI
  const [quickScanBanner, setQuickScanBanner] = useState<{
    sbd: string;
    studentName: string;
    score: number;
    hasWarning: boolean;
    warningText?: string;
  } | null>(null);

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
    "Căn 4 ô vuông đen của phiếu A4 vào 4 góc khung ngắm"
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
  const guideFrameRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastAutoCaptureTimeRef = useRef<number>(0);
  const matchedHoldStartTimeRef = useRef<number | null>(null);
  const manualSvgRef = useRef<SVGSVGElement | null>(null);
  const bannerTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (effectiveInitialQuiz?.id) {
      setSelectedQuizId(String(effectiveInitialQuiz.id));
    }
  }, [effectiveInitialQuiz]);

  const triggerQuickScanBanner = useCallback((item: ScannedSheetItem) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    const hasWarn =
      item.skippedQuestionsList.length > 0 ||
      item.flaggedQuestions.length > 0 ||
      Boolean(item.geometryWarning);

    const warnStr = item.geometryWarning
      ? "Lệch góc chụp — Chạm để chỉnh 4 góc"
      : item.skippedQuestionsList.length > 0
      ? `Trống câu ${item.skippedQuestionsList.slice(0, 5).join(", ")}`
      : item.flaggedQuestions.length > 0
      ? `Lem chì câu ${item.flaggedQuestions.join(", ")}`
      : undefined;

    setQuickScanBanner({
      sbd: item.detectedSbd,
      studentName: item.matchedStudentName,
      score: item.score,
      hasWarning: hasWarn,
      warningText: warnStr
    });

    bannerTimerRef.current = setTimeout(() => {
      setQuickScanBanner(null);
    }, 2200);
  }, []);

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

  // 3. QUẢN LÝ CAMERA DỌC ĐỘ PHÂN GIẢI CAO & ĐÈN FLASH
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
      setCameraStatusText("Trình duyệt không hỗ trợ mở Camera.");
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
      setCameraStatusText("Căn 4 ô vuông đen của phiếu A4 vào 4 góc khung ngắm");
    } catch {
      setCameraStatusText("Vui lòng cấp quyền Camera cho trình duyệt để quét phiếu.");
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
        showToast("Thiết bị hoặc trình duyệt này không hỗ trợ bật đèn Flash.", "error");
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

  // CẮT CHÍNH XÁC VÙNG VIDEO NẰM TRONG KHUNG NGẮM DỌC A4 ĐỂ QUÉT CHUẨN TỶ LỆ
  const extractA4GuideFrameCanvas = useCallback(
    (video: HTMLVideoElement, targetWidth: number = 1200): HTMLCanvasElement | null => {
      const vW = video.videoWidth;
      const vH = video.videoHeight;
      if (!vW || !vH) return null;

      const videoElRect = video.getBoundingClientRect();
      const guideElRect = guideFrameRef.current?.getBoundingClientRect();

      const outCanvas = document.createElement("canvas");
      const targetHeight = Math.round(targetWidth * 1.4142);
      outCanvas.width = targetWidth;
      outCanvas.height = targetHeight;
      const ctx = outCanvas.getContext("2d");
      if (!ctx) return null;

      // Tính toán vùng hiển thị thực tế khi video dùng object-cover
      if (
        guideElRect &&
        videoElRect.width > 0 &&
        videoElRect.height > 0 &&
        guideElRect.width > 0 &&
        guideElRect.height > 0
      ) {
        const videoAspect = vW / vH;
        const containerAspect = videoElRect.width / videoElRect.height;

        let renderW = videoElRect.width;
        let renderH = videoElRect.height;
        let offsetX = 0;
        let offsetY = 0;

        if (videoAspect > containerAspect) {
          renderH = videoElRect.height;
          renderW = renderH * videoAspect;
          offsetX = (renderW - videoElRect.width) / 2;
        } else {
          renderW = videoElRect.width;
          renderH = renderW / videoAspect;
          offsetY = (renderH - videoElRect.height) / 2;
        }

        const relLeft = guideElRect.left - videoElRect.left + offsetX;
        const relTop = guideElRect.top - videoElRect.top + offsetY;

        // Mở rộng nhẹ 3% lề quanh khung ngắm để không bao giờ cắt lẹm mất mốc đen sát mép
        const padW = guideElRect.width * 0.03;
        const padH = guideElRect.height * 0.03;

        const sx = Math.max(0, ((relLeft - padW) / renderW) * vW);
        const sy = Math.max(0, ((relTop - padH) / renderH) * vH);
        const sWidth = Math.min(vW - sx, ((guideElRect.width + padW * 2) / renderW) * vW);
        const sHeight = Math.min(vH - sy, ((guideElRect.height + padH * 2) / renderH) * vH);

        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
        return outCanvas;
      }

      ctx.drawImage(video, 0, 0, vW, vH, 0, 0, targetWidth, targetHeight);
      return outCanvas;
    },
    []
  );

  // HÀM XỬ LÝ 1 CANVAS ẢNH CHỤP -> TRÍCH XUẤT SBD, MÃ ĐỀ & CHẤM ĐIỂM
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

  // VÒNG LẶP QUÉT REALTIME 4 KHUNG NGẮM GÓC DỌC A4 & TỰ ĐỘNG BẮT ẢNH (AUTO-LOCK 0.4s)
  useEffect(() => {
    if (!isOpen || mobileViewTab !== "camera") return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const now = Date.now();
      if (now - lastAutoCaptureTimeRef.current < 2400) {
        return;
      }

      const checkCanvas = extractA4GuideFrameCanvas(video, 420);
      if (!checkCanvas) return;

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
          setCameraStatusText("🎯 Đã khóa 4 góc! Giữ yên 0.4s để tự động chụp...");
        } else if (now - matchedHoldStartTimeRef.current >= 380) {
          lastAutoCaptureTimeRef.current = now;
          matchedHoldStartTimeRef.current = null;

          setShutterFlash(true);
          setTimeout(() => setShutterFlash(false), 240);
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
              navigator.vibrate([70]);
            } catch {}
          }

          const fullA4Canvas = extractA4GuideFrameCanvas(video, 1200);
          if (fullA4Canvas) {
            const scaleX = fullA4Canvas.width / checkCanvas.width;
            const scaleY = fullA4Canvas.height / checkCanvas.height;
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
              fullA4Canvas,
              `Camera_${new Date().toLocaleTimeString("vi-VN")}`,
              undefined,
              scaledCorners
            );

            if (resultItem) {
              setScannedItems((prev) => [resultItem, ...prev]);
              setActiveInspectId(resultItem.tempId);
              setIsManualCornerMode(false);
              setEditingCorners(resultItem.cornerPoints);
              triggerQuickScanBanner(resultItem);
              setCameraStatusText("✓ Đã chấm xong! Mời đưa phiếu tiếp theo vào...");
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
            ? `Đã khớp ${matchedCount}/4 góc — Đưa đủ 4 ô vuông đen vào 4 góc khung`
            : "Căn 4 ô vuông đen của phiếu A4 vào 4 góc khung ngắm"
        );
      }
    }, 140);

    return () => clearInterval(interval);
  }, [
    isOpen,
    mobileViewTab,
    autoCaptureEnabled,
    extractA4GuideFrameCanvas,
    processSingleCanvas,
    triggerQuickScanBanner
  ]);

  // CHỤP BẰNG NÚT TRÒN SHUTTER Ở ĐÁY MÀN HÌNH
  const handleManualCameraCapture = () => {
    const video = videoRef.current;
    if (!video) return;

    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 220);

    const fullA4Canvas = extractA4GuideFrameCanvas(video, 1200);
    if (!fullA4Canvas) return;

    const resultItem = processSingleCanvas(
      fullA4Canvas,
      `Camera_${new Date().toLocaleTimeString("vi-VN")}`
    );
    if (resultItem) {
      lastAutoCaptureTimeRef.current = Date.now();
      setScannedItems((prev) => [resultItem, ...prev]);
      setActiveInspectId(resultItem.tempId);
      setIsManualCornerMode(!resultItem.warpMatrixApplied);
      setEditingCorners(resultItem.cornerPoints);
      triggerQuickScanBanner(resultItem);
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
      <div className="fixed inset-0 z-[550] bg-slate-950 flex flex-col font-sans text-left select-none overflow-hidden">
        {/* 1. THANH TOP BAR GỌN GÀNG */}
        <div className="px-3 sm:px-5 py-2 bg-slate-900/95 border-b border-slate-800 text-white flex items-center justify-between gap-2 shrink-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <select
              value={selectedQuizId}
              onChange={(e) => setSelectedQuizId(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-white outline-none cursor-pointer max-w-[185px] sm:max-w-[320px] truncate"
            >
              <option value="auto">🤖 Tự nhận diện theo Mã đề</option>
              {allQuizzesPool.map((q) => (
                <option key={q.id} value={q.id}>
                  [Mã {q.examCode}] {q.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Chuyển nhanh giữa Camera & Soi phiếu trên Mobile */}
            <div className="flex lg:hidden bg-slate-800 p-0.5 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setMobileViewTab("camera")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                  mobileViewTab === "camera" ? "bg-emerald-600 text-white" : "text-slate-300"
                }`}
              >
                📷 Quét
              </button>
              <button
                type="button"
                onClick={() => setMobileViewTab("inspect")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                  mobileViewTab === "inspect" ? "bg-purple-600 text-white" : "text-slate-300"
                }`}
              >
                🔍 Soi ({scannedItems.length})
              </button>
            </div>

            {scannedItems.length > 0 && (
              <button
                type="button"
                disabled={isSavingAll}
                onClick={handleSaveAllScannedToSystem}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer"
              >
                {isSavingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Lưu {scannedItems.length} bài</span>
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

        {/* 2. KHÔNG GIAN CHÍNH: TRÊN MOBILE LÀ FULL-HEIGHT PORTRAIT CAMERA, TRÊN IPAD NGANG/PC LÀ CHIA ĐÔI 50/50 */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 relative overflow-hidden">
          {/* CỘT CAMERA DỌC CHUẨN A4 (CHIẾM TRỌN MÀN HÌNH DI ĐỘNG) */}
          <div
            className={`lg:col-span-6 relative flex flex-col min-h-0 bg-black overflow-hidden ${
              mobileViewTab === "inspect" ? "hidden lg:flex" : "flex"
            }`}
          >
            {/* VÙNG VIEWFINDER CAMERA (KHÔNG CÓ BẤT KỲ NÚT NÀO ĐÈ LÊN 4 GÓC) */}
            <div className="relative flex-1 w-full min-h-0 flex items-center justify-center overflow-hidden p-3 sm:p-5">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Hiệu ứng chớp màn hình khi chụp */}
              {shutterFlash && (
                <div className="absolute inset-0 bg-white/90 z-40 pointer-events-none" />
              )}

              {/* TOAST NỔI 1.8 GIÂY KHI QUÉT XONG 1 PHIẾU */}
              <AnimatePresence>
                {quickScanBanner && (
                  <motion.div
                    initial={{ opacity: 0, y: -16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -16, scale: 0.95 }}
                    onClick={() => {
                      setIsBottomSheetExpanded(true);
                      setMobileViewTab("inspect");
                    }}
                    className="absolute top-12 inset-x-4 sm:inset-x-8 z-30 p-3 rounded-2xl bg-slate-900/95 border-2 border-emerald-400 text-white shadow-2xl flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-xs font-black text-emerald-300">
                          ✓ Đã chấm: SBD {quickScanBanner.sbd}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-white truncate mt-0.5">
                        {quickScanBanner.studentName}
                      </p>
                      {quickScanBanner.warningText && (
                        <p className="text-[11px] font-bold text-amber-300 mt-0.5">
                          ⚠️ {quickScanBanner.warningText} (Chạm để xem)
                        </p>
                      )}
                    </div>
                    <div className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-black text-sm shrink-0">
                      {quickScanBanner.score.toFixed(2)}đ
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Thanh trạng thái hướng dẫn nhỏ gọn trên đỉnh */}
              <div className="absolute top-2.5 inset-x-3 flex justify-center z-20 pointer-events-none">
                <span
                  className={`px-3.5 py-1 rounded-full text-[11px] font-extrabold border backdrop-blur-md shadow-md ${
                    realtimeCornersStatus.isMatched
                      ? "bg-emerald-950/90 text-emerald-300 border-emerald-400"
                      : "bg-slate-950/80 text-amber-300 border-amber-400/40"
                  }`}
                >
                  {cameraStatusText}
                </span>
              </div>

              {/* KHUNG NGẮM DỌC TỶ LỆ CHUẨN A4 (ASPECT RATIO 1 : 1.414) — HOÀN TOÀN THÔNG THOÁNG */}
              <div
                ref={guideFrameRef}
                className="relative z-10 h-full max-h-full aspect-[1/1.414] max-w-full rounded-xl shadow-[0_0_0_9999px_rgba(2,6,23,0.52)] pointer-events-none flex flex-col justify-between"
              >
                {/* Viền bao A4 */}
                <div
                  className={`absolute inset-0 rounded-xl border-2 transition-colors ${
                    realtimeCornersStatus.isMatched
                      ? "border-emerald-400 bg-emerald-500/5"
                      : "border-amber-400/50 border-dashed"
                  }`}
                />

                {/* Hàng 2 ô ngắm góc trên: TL & TR */}
                <div className="flex justify-between p-1.5">
                  {[
                    { key: "TL", matched: realtimeCornersStatus.topLeft },
                    { key: "TR", matched: realtimeCornersStatus.topRight }
                  ].map((c) => (
                    <div
                      key={c.key}
                      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-lg border-3 flex items-center justify-center transition-all ${
                        c.matched
                          ? "border-emerald-400 bg-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.7)]"
                          : "border-amber-400 border-dashed bg-amber-500/10"
                      }`}
                    >
                      <span
                        className={`text-[10px] font-black ${
                          c.matched ? "text-emerald-200" : "text-amber-200"
                        }`}
                      >
                        {c.matched ? "✓" : c.key}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Hàng 2 ô ngắm góc dưới: BL & BR (Không bị bất kỳ nút bấm nào che) */}
                <div className="flex justify-between p-1.5">
                  {[
                    { key: "BL", matched: realtimeCornersStatus.bottomLeft },
                    { key: "BR", matched: realtimeCornersStatus.bottomRight }
                  ].map((c) => (
                    <div
                      key={c.key}
                      className={`w-11 h-11 sm:w-12 sm:h-12 rounded-lg border-3 flex items-center justify-center transition-all ${
                        c.matched
                          ? "border-emerald-400 bg-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.7)]"
                          : "border-amber-400 border-dashed bg-amber-500/10"
                      }`}
                    >
                      <span
                        className={`text-[10px] font-black ${
                          c.matched ? "text-emerald-200" : "text-amber-200"
                        }`}
                      >
                        {c.matched ? "✓" : c.key}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. THANH DOCK ĐIỀU KHIỂN CAMERA NẰM RIÊNG Ở ĐÁY (KHÔNG ĐÈ LÊN KHUNG NGẮM A4) */}
            <div className="bg-slate-950 border-t border-slate-800 px-4 py-2.5 flex items-center justify-around shrink-0 z-20">
              {/* Nút Đèn Flash */}
              <button
                type="button"
                onClick={handleToggleTorch}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold transition cursor-pointer ${
                  torchOn
                    ? "bg-amber-400 text-slate-950"
                    : "bg-slate-900 text-slate-300 border border-slate-800"
                }`}
              >
                <Flashlight className="w-4 h-4" />
                <span>{torchOn ? "Flash: Bật" : "Đèn Flash"}</span>
              </button>

              {/* Nút Chụp Tròn To Bản Ở Giữa */}
              <button
                type="button"
                onClick={handleManualCameraCapture}
                className="w-15 h-15 rounded-full bg-white p-1 shadow-[0_0_25px_rgba(16,185,129,0.6)] active:scale-90 transition flex items-center justify-center cursor-pointer"
                title="Bấm để chụp & chấm ngay"
              >
                <div className="w-full h-full rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white">
                  <Camera className="w-6 h-6" />
                </div>
              </button>

              {/* Cụm nút Auto-Lock & Đổi Camera */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAutoCaptureEnabled((p) => !p)}
                  className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-black transition cursor-pointer ${
                    autoCaptureEnabled
                      ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-slate-900 text-slate-400 border border-slate-800"
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>{autoCaptureEnabled ? "Tự chụp: BẬT" : "Tự chụp: TẮT"}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((m) => (m === "environment" ? "user" : "environment"))
                  }
                  className="flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 text-slate-300 border border-slate-800 text-[10px] font-bold cursor-pointer"
                >
                  <SwitchCamera className="w-4 h-4" />
                  <span>Đổi Cam</span>
                </button>
              </div>
            </div>

            {/* 4. KHAY TRƯỢT ĐÁY (BOTTOM SHEET) THU GỌN DANH SÁCH ĐÃ QUÉT TRÊN MOBILE */}
            <div className="bg-slate-900 border-t border-slate-800 text-white shrink-0 z-30">
              <div
                onClick={() => setIsBottomSheetExpanded((prev) => !prev)}
                className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/70 transition"
              >
                <div className="flex items-center gap-2 text-xs font-extrabold">
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  <span>
                    📄 Đã quét: <strong className="text-emerald-400">{scannedItems.length} bài</strong>
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    — {isBottomSheetExpanded ? "Chạm để thu gọn" : "Chạm để xem danh sách / sửa điểm"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {scannedItems.length > 0 && (
                    <button
                      type="button"
                      disabled={isSavingAll}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveAllScannedToSystem();
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Save className="w-3 h-3" />
                      <span>Lưu tất cả</span>
                    </button>
                  )}
                  {isBottomSheetExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              <AnimatePresence>
                {isBottomSheetExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="max-h-[42vh] overflow-y-auto divide-y divide-slate-800 bg-slate-950 custom-scrollbar"
                  >
                    {scannedItems.length === 0 ? (
                      <div className="py-6 text-center text-slate-500 text-xs italic">
                        Chưa có bài nào được quét trong phiên này.
                      </div>
                    ) : (
                      scannedItems.map((item, idx) => (
                        <div
                          key={item.tempId}
                          onClick={() => {
                            setActiveInspectId(item.tempId);
                            setMobileViewTab("inspect");
                          }}
                          className="p-3 flex items-center justify-between gap-2 hover:bg-slate-900 cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                #{idx + 1}
                              </span>
                              <span className="font-mono font-black text-xs text-emerald-400">
                                SBD: {item.detectedSbd}
                              </span>
                              <span className="font-bold text-xs text-white truncate">
                                {item.matchedStudentName}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Mã đề: {item.detectedExamCode} • Đúng {item.correctCount}/{item.totalQuestions} câu
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-black text-xs">
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
                              className="p-1.5 text-slate-500 hover:text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* CỘT PHẢI (6 CỘT TRÊN IPAD/DESKTOP HOẶC TAB "SOI" TRÊN MOBILE): ĐỐI SOÁT ẢNH PHIẾU, CHỈNH 4 GÓC & SỬA ĐÁP ÁN */}
          <div
            className={`lg:col-span-6 bg-slate-900 flex flex-col min-h-0 overflow-hidden ${
              mobileViewTab === "camera" ? "hidden lg:flex" : "flex"
            }`}
          >
            <div className="px-3.5 py-2 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 shrink-0">
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
                  onClick={() => setZoomScale((z) => Math.min(2.4, Number((z + 0.2).toFixed(2))))}
                  className="p-1 rounded bg-slate-800 text-white cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* THÔNG TIN HỌC SINH & SỬA NHANH SBD TRÊN TAB SOI PHIẾU */}
            {activeInspectItem && (
              <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-700">
                    <span className="font-black">SBD:</span>
                    <input
                      type="text"
                      maxLength={6}
                      value={activeInspectItem.detectedSbd}
                      onChange={(e) => handleManualSbdEdit(activeInspectItem, e.target.value)}
                      className="w-15 font-mono font-black text-white bg-slate-900 px-1 rounded border border-blue-600 outline-none text-center"
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
                    className="px-2 py-1 rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold text-white outline-none"
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
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-black text-xs">
                    {activeInspectItem.score.toFixed(2)}đ
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileViewTab("camera")}
                    className="lg:hidden px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-black cursor-pointer"
                  >
                    📷 Quét tiếp
                  </button>
                </div>
              </div>
            )}

            {/* KHUNG ẢNH ĐÃ NẮN PHẲNG + CLICK SỬA NHANH */}
            <div className="flex-1 overflow-auto p-3 sm:p-4 custom-scrollbar flex flex-col items-center justify-start space-y-3">
              {activeInspectItem ? (
                <>
                  {isManualCornerMode && editingCorners ? (
                    <div className="w-full space-y-2">
                      <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-[11px] font-semibold text-center">
                        Kéo 4 chốt tròn màu xanh (<strong>TL, TR, BR, BL</strong>) vào đúng 4 góc tờ phiếu rồi bấm{" "}
                        <strong className="text-amber-300">[⚡ Nắn phẳng & Quét lại]</strong>
                      </div>

                      <div
                        style={{
                          width: `${Math.round(380 * zoomScale)}px`,
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
                              Math.round(activeInspectItem.originalWidth * 0.028)
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
                        width: `${Math.round(380 * zoomScale)}px`,
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
                  )}

                  {/* Bảng chạm sửa nhanh đáp án bên dưới ảnh soi */}
                  <div className="w-full bg-slate-950 rounded-2xl border border-slate-800 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                        Chạm để sửa nhanh đáp án (Tự động tính lại điểm)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowQuickAdjustPanel((p) => !p)}
                        className="text-[11px] text-emerald-400 cursor-pointer"
                      >
                        {showQuickAdjustPanel ? "Thu gọn" : "Mở rộng"}
                      </button>
                    </div>

                    {showQuickAdjustPanel && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                        {(activeInspectItem.questionDetails || []).map((qd: any) => {
                          const isRight = qd.status === "correct";
                          const isSkipped = qd.status === "skipped";
                          return (
                            <div
                              key={qd.questionOrder}
                              className={`p-2 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                                isRight
                                  ? "bg-emerald-950/40 border-emerald-700/50 text-emerald-200"
                                  : isSkipped
                                  ? "bg-amber-950/50 border-amber-600/60 text-amber-200"
                                  : "bg-rose-950/40 border-rose-700/50 text-rose-200"
                              }`}
                            >
                              <div>
                                <span className="font-black">Câu {qd.questionOrder} </span>
                                <span className="text-[10px] opacity-75">
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
                                              ? "bg-emerald-500 text-slate-950 border-emerald-400"
                                              : "bg-rose-600 text-white border-rose-500"
                                            : "bg-slate-900 text-slate-300 border-slate-700"
                                        }`}
                                      >
                                        {optK}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {qd.part === 2 && (
                                <span className="text-[10px] font-bold">
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
                                  className="w-16 px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-center font-black text-xs text-white outline-none"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="my-auto text-center text-slate-500 text-xs p-6 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-slate-700 mx-auto" />
                  <p>
                    Đưa phiếu trả lời vào khung ngắm A4 bên Camera. Ngay khi bắt đủ 4 góc, ảnh đối chiếu xanh/đỏ sẽ hiển thị tại đây!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AnimatePresence>
  );
}

export default AdminBulkOMRScannerModal;
