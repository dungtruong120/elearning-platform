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
  Crosshair,
  Zap,
  CheckCircle2,
  Flashlight,
  ChevronUp,
  ChevronDown,
  FileCheck2,
  AlertTriangle,
  Volume2,
  VolumeX,
  UserCheck
} from "lucide-react";
import { supabase as defaultSupabaseClient } from "@/lib/supabaseClient";
import {
  scanOMRSheetFromCanvas,
  gradeOMRSubmission,
  detectRealtimeCornerBoxes,
  deriveExamCode3Digits,
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
  onSavedSuccess?: () => void;
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
  isSbdMatchedInList: boolean;
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
  syncedToCloud?: boolean;
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const parts = dataUrl.split(";base64,");
    if (parts.length < 2) return null;
    const contentType = parts[0].split(":")[1] || "image/jpeg";
    const raw = window.atob(parts[1].replace(/[\r\n\s]+/g, ""));
    const uInt8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    return new Blob([uInt8Array], { type: contentType });
  } catch {
    return null;
  }
}

function normalizeSbd6Digits(rawSbd: any): string {
  if (rawSbd === null || rawSbd === undefined) return "";
  const digitsOnly = String(rawSbd).replace(/\D/g, "");
  if (!digitsOnly) return "";
  return digitsOnly.padStart(6, "0").slice(-6);
}

/**
 * PHÁT ÂM THANH BEEP NHẸ BẰNG WEB AUDIO API KHI QUÉT THÀNH CÔNG
 */
function playScanSuccessBeep() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime); // C6
    osc.frequency.exponentialRampToValueAtTime(1318.5, ctx.currentTime + 0.08); // E6

    gain.gain.setValueAtTime(0.16, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, 200);
  } catch {}
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
  onSavedSuccess,
  showToast
}: AdminBulkOMRScannerModalProps) {
  const effectiveSupabase = propSupabase || defaultSupabaseClient;
  const effectiveInitialQuiz = initialSelectedQuiz || defaultSelectedExam || null;

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState<boolean>(true);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [mobileViewTab, setMobileViewTab] = useState<"camera" | "inspect">("camera");
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState<boolean>(false);

  // THẺ XEM NHANH KẾT QUẢ TRỰC TIẾP TRÊN MÀN HÌNH CAMERA (GIỮ 4 GIÂY HOẶC ĐẾN KHI QUÉT BÀI TIẾP THEO)
  const [liveScannedCardId, setLiveScannedCardId] = useState<string | null>(null);

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
    "Căn 4 mốc vuông đen vào 4 góc khung ngắm"
  );

  const [selectedQuizId, setSelectedQuizId] = useState<string>(
    effectiveInitialQuiz?.id ? String(effectiveInitialQuiz.id) : "auto"
  );

  const [scannedItems, setScannedItems] = useState<ScannedSheetItem[]>([]);
  const [activeInspectId, setActiveInspectId] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);
  const [showQuickAdjustPanel, setShowQuickAdjustPanel] = useState<boolean>(true);

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
  const liveCardTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (effectiveInitialQuiz?.id) {
      setSelectedQuizId(String(effectiveInitialQuiz.id));
    }
  }, [effectiveInitialQuiz]);

  const triggerLiveBottomCardFeedback = useCallback(
    (item: ScannedSheetItem) => {
      if (liveCardTimerRef.current) {
        clearTimeout(liveCardTimerRef.current);
      }
      setLiveScannedCardId(item.tempId);

      if (soundEnabled) {
        playScanSuccessBeep();
      }
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate([55, 30, 55]);
        } catch {}
      }

      liveCardTimerRef.current = setTimeout(() => {
        setLiveScannedCardId((prevId) => (prevId === item.tempId ? null : prevId));
      }, 4000);
    },
    [soundEnabled]
  );

  useEffect(() => {
    return () => {
      if (liveCardTimerRef.current) clearTimeout(liveCardTimerRef.current);
    };
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

  /**
   * 2. DANH MỤC HỌC SINH & BẢNG TRA CỨU SBD CỐ ĐỊNH 6 CHỮ SỐ
   * - TUYỆT ĐỐI KHÔNG SORT THEO CHỮ CÁI VÀ KHÔNG DÙNG INDEX + 1 ĐỂ TRÁNH ĐẢO LỘN SBD.
   * - Giữ nguyên danh sách học sinh từ props truyền vào + đọc SBD cố định đã gắn cho từng học sinh.
   * - `sbdLookupMap` CHỈ dùng key duy nhất là SBD 6 chữ số (VD: "000002").
   */
  const studentDirectory = useMemo(() => {
    const permanentSbdById: Record<string, string> = {};
    if (typeof window !== "undefined") {
      try {
        const rawPerm = localStorage.getItem("edunexus_permanent_sbd_map");
        if (rawPerm) {
          const parsedPerm = JSON.parse(rawPerm);
          if (parsedPerm && typeof parsedPerm === "object") {
            Object.entries(parsedPerm).forEach(([k, v]) => {
              const norm = normalizeSbd6Digits(v);
              if (norm) permanentSbdById[String(k).trim()] = norm;
            });
          }
        }
        const rawDir = localStorage.getItem("edunexus_sbd_directory");
        if (rawDir) {
          const parsedDir = JSON.parse(rawDir);
          if (Array.isArray(parsedDir)) {
            parsedDir.forEach((entry: any) => {
              const idKey = String(entry?.id || entry?.studentId || "").trim();
              const norm = normalizeSbd6Digits(entry?.sbd);
              if (idKey && norm && !permanentSbdById[idKey]) {
                permanentSbdById[idKey] = norm;
              }
            });
          }
        }
      } catch {}
    }

    const sourceArr =
      Array.isArray(studentsList) && studentsList.length > 0
        ? studentsList
        : Array.isArray(registeredStudents)
        ? registeredStudents
        : [];

    const pool = [...sourceArr].filter(Boolean);

    return pool.map((stu, idx) => {
      const id = String(stu.id || stu.studentId || `stu_${idx + 1}`).trim();
      const explicitSbd = normalizeSbd6Digits(stu.sbd);
      const savedPermanentSbd = permanentSbdById[id] || "";
      const finalSbd = explicitSbd || savedPermanentSbd || "";

      return {
        id,
        full_name: String(stu.full_name || stu.studentName || stu.name || "Học sinh").trim(),
        school: String(stu.school || "THPT").trim(),
        sbd: finalSbd
      };
    });
  }, [studentsList, registeredStudents]);

  const sbdLookupMap = useMemo(() => {
    const map = new Map<string, (typeof studentDirectory)[0]>();
    studentDirectory.forEach((s) => {
      const clean6 = normalizeSbd6Digits(s.sbd);
      if (clean6 && clean6.length === 6) {
        map.set(clean6, s);
      }
    });
    return map;
  }, [studentDirectory]);

  // 3. HÀM GHI DỮ LIỆU TRỰC TIẾP LÊN SUPABASE
  const persistPaperAttemptToSupabase = useCallback(
    async (item: ScannedSheetItem, customAttemptId?: string) => {
      const nowIso = new Date().toISOString();
      const attemptId =
        customAttemptId || `paper_${item.matchedQuizId}_${item.matchedStudentId}`;

      let uploadedImageUrl: string | null = item.warpedImageUrl || null;

      if (
        effectiveSupabase &&
        uploadedImageUrl &&
        uploadedImageUrl.startsWith("data:image")
      ) {
        try {
          const blob = dataUrlToBlob(uploadedImageUrl);
          if (blob) {
            const safeExam = String(item.matchedQuizId || "exam").replace(
              /[^a-zA-Z0-9_-]/g,
              "_"
            );
            const safeStu = String(
              item.detectedSbd || item.matchedStudentId || "stu"
            ).replace(/[^a-zA-Z0-9_-]/g, "_");
            const filePath = `paper_scans/${safeExam}/${safeStu}_${Date.now()}.jpg`;
            const { error: upErr } = await effectiveSupabase.storage
              .from("exam-media")
              .upload(filePath, blob, {
                contentType: "image/jpeg",
                cacheControl: "31536000",
                upsert: true
              });

            if (!upErr) {
              const { data: pubData } = effectiveSupabase.storage
                .from("exam-media")
                .getPublicUrl(filePath);
              if (pubData?.publicUrl) {
                uploadedImageUrl = pubData.publicUrl;
              }
            }
          }
        } catch {}
      }

      const enrichedAnswersPayload = {
        ...(item.normalizedAnswers || {}),
        __paper_omr_meta: {
          submission_type: "paper",
          detected_sbd: item.detectedSbd,
          detected_exam_code: item.detectedExamCode,
          student_name: item.matchedStudentName,
          school: item.matchedSchool,
          exam_title: item.matchedQuizTitle,
          source_type: item.sourceType,
          scanned_image_url: uploadedImageUrl,
          flagged_questions: item.flaggedQuestions,
          confidence: item.confidence,
          bubble_coordinates: item.omrRawData?.bubble_coordinates || []
        }
      };

      if (effectiveSupabase) {
        const primaryPayload: Record<string, any> = {
          exam_id: item.matchedQuizId,
          student_id: item.matchedStudentId,
          score: Number(item.score),
          total_questions: Number(item.totalQuestions),
          correct_answers_count: Number(item.correctCount),
          answers: enrichedAnswersPayload,
          submission_type: "paper",
          scanned_image_url: uploadedImageUrl,
          created_at: nowIso,
          updated_at: nowIso
        };

        try {
          const { error: upsertErr1 } = await effectiveSupabase
            .from("exam_attempts")
            .upsert(primaryPayload, { onConflict: "exam_id, student_id" });

          if (upsertErr1) {
            const secondaryPayload: Record<string, any> = {
              id: attemptId,
              quiz_id: item.matchedQuizId,
              exam_id: item.matchedQuizId,
              student_id: item.matchedStudentId,
              student_name: item.matchedStudentName,
              exam_title: item.matchedQuizTitle,
              score: Number(item.score),
              total_questions: Number(item.totalQuestions),
              correct_count: Number(item.correctCount),
              answers: enrichedAnswersPayload,
              submission_type: "paper",
              paper_scan_url: uploadedImageUrl,
              created_at: nowIso
            };

            const { error: upsertErr2 } = await effectiveSupabase
              .from("exam_attempts")
              .upsert(secondaryPayload);

            if (upsertErr2) {
              await effectiveSupabase.from("exam_attempts").upsert({
                id: attemptId,
                quiz_id: item.matchedQuizId,
                student_id: item.matchedStudentId,
                student_name: item.matchedStudentName,
                exam_title: item.matchedQuizTitle,
                score: Number(item.score),
                answers: enrichedAnswersPayload,
                created_at: nowIso
              });
            }
          }
        } catch (dbErr) {
          console.warn("Cảnh báo ghi exam_attempts:", dbErr);
        }

        try {
          await effectiveSupabase.from("quiz_results").upsert({
            id: attemptId,
            quiz_id: item.matchedQuizId,
            student_id: item.matchedStudentId,
            student_name: item.matchedStudentName,
            quiz_title: item.matchedQuizTitle,
            score: Number(item.score),
            total_questions: Number(item.totalQuestions),
            correct_count: Number(item.correctCount),
            answers: enrichedAnswersPayload,
            is_homework: item.sourceType === "homework",
            created_at: nowIso
          });
        } catch {}

        try {
          await effectiveSupabase.channel("admin-realtime-global-sync").send({
            type: "broadcast",
            event: "new_attempt",
            payload: { exam_id: item.matchedQuizId, student_id: item.matchedStudentId }
          });
        } catch {}
      }

      try {
        await fetch("/api/student/scan-paper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            examId: item.matchedQuizId,
            examTitle: item.matchedQuizTitle,
            studentId: item.matchedStudentId,
            studentName: item.matchedStudentName,
            school: item.matchedSchool,
            score: Number(item.score),
            totalQuestions: Number(item.totalQuestions),
            correctCount: Number(item.correctCount),
            isHomework: item.sourceType === "homework",
            answers: enrichedAnswersPayload,
            omrData: item.omrRawData,
            imageBase64: uploadedImageUrl
          })
        });
      } catch {}

      return {
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
        total_questions: Number(item.totalQuestions),
        totalQuestions: Number(item.totalQuestions),
        correct_count: Number(item.correctCount),
        correctCount: Number(item.correctCount),
        correct_answers_count: Number(item.correctCount),
        time_spent: "Làm trên giấy",
        timeSpent: "Làm trên giấy",
        duration_seconds: 0,
        is_homework: item.sourceType === "homework",
        isHomework: item.sourceType === "homework",
        type: item.sourceType,
        submission_type: "paper",
        paper_scan_url: uploadedImageUrl || item.warpedImageUrl,
        scanned_image_url: uploadedImageUrl || item.warpedImageUrl,
        omr_raw_data: item.omrRawData,
        recognition_confidence: item.confidence,
        flagged_questions: item.flaggedQuestions,
        answers: enrichedAnswersPayload,
        userAnswers: enrichedAnswersPayload,
        user_answers: enrichedAnswersPayload,
        assigned_month: item.assignedMonth,
        assigned_week: item.assignedWeek,
        created_at: nowIso,
        createdAt: nowIso,
        updated_at: nowIso
      };
    },
    [effectiveSupabase]
  );

  // 4. QUẢN LÝ CAMERA ĐỘ PHÂN GIẢI CAO & ĐÈN FLASH TRÊN IPAD / ĐIỆN THOẠI
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
      setCameraStatusText("Căn 4 mốc vuông đen vào 4 góc khung ngắm");
    } catch {
      setCameraStatusText("Vui lòng cấp quyền Camera cho trình duyệt.");
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
        showToast("Thiết bị này không hỗ trợ bật đèn Flash.", "error");
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

  /**
   * 5. CẮT KHUNG NGẮM A4 CHUẨN XÁC TRÊN MỌI MÀN HÌNH IPAD (4:3) & ĐIỆN THOẠI (20:9)
   * - Bổ sung biên an toàn 5% (0.05) xung quanh khung ngắm để không bao giờ cắt lẹm 4 góc vuông đen
   */
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

        // Biên an toàn 5% xung quanh khung ngắm để không cắt lẹm 4 góc định vị màu đen kể cả khi đặt hơi nghiêng
        const padW = guideElRect.width * 0.05;
        const padH = guideElRect.height * 0.05;

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

      // SO KHỚP SBD TUYỆT ĐỐI THEO MÃ 6 CHỮ SỐ CỐ ĐỊNH
      const rawDetectedSbd = String(finalOmr.detected_sbd || "").trim();
      const formattedSbd6 =
        rawDetectedSbd && rawDetectedSbd !== "Chưa tô"
          ? normalizeSbd6Digits(rawDetectedSbd)
          : "";
      const matchedStu = formattedSbd6 ? sbdLookupMap.get(formattedSbd6) || null : null;

      const fallbackCorners: CustomFourCornersInput = finalOmr.corner_points || {
        topLeft: { x: Math.round(canvas.width * 0.04), y: Math.round(canvas.height * 0.03) },
        topRight: { x: Math.round(canvas.width * 0.96), y: Math.round(canvas.height * 0.03) },
        bottomRight: {
          x: Math.round(canvas.width * 0.96),
          y: Math.round(canvas.height * 0.97)
        },
        bottomLeft: { x: Math.round(canvas.width * 0.04), y: Math.round(canvas.height * 0.97) }
      };

      const skippedList = (graded.questionDetails || [])
        .filter((q: any) => q.status === "skipped")
        .map((q: any) => Number(q.questionOrder));

      const displaySbd = formattedSbd6 || rawDetectedSbd || "Chưa tô";

      const item: ScannedSheetItem = {
        tempId: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        fileName: labelName,
        originalImageUrl: originalDataUrl || canvas.toDataURL("image/jpeg", 0.9),
        originalWidth: canvas.width,
        originalHeight: canvas.height,
        cornerPoints: fallbackCorners,
        warpMatrixApplied: Boolean(finalOmr.warp_matrix_applied),
        detectedSbd: displaySbd,
        detectedExamCode: finalOmr.detected_exam_code || targetQuizEntry?.examCode || "101",
        isSbdMatchedInList: Boolean(matchedStu),
        matchedStudentId: matchedStu?.id || `unmatched_sbd_${displaySbd}_${Date.now()}`,
        matchedStudentName: matchedStu
          ? matchedStu.full_name
          : `Chưa khớp danh sách (SBD: ${displaySbd})`,
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
        rawQuizObj: targetQuizEntry?.rawObj || null,
        syncedToCloud: false
      };

      return item;
    },
    [selectedQuizId, allQuizzesPool, sbdLookupMap]
  );

  const autoSyncSingleItemInBackground = useCallback(
    async (item: ScannedSheetItem) => {
      try {
        const syncedRecord = await persistPaperAttemptToSupabase(item);
        setScannedItems((prev) =>
          prev.map((x) => (x.tempId === item.tempId ? { ...x, syncedToCloud: true } : x))
        );
        if (typeof window !== "undefined") {
          try {
            const saved = localStorage.getItem("edunexus_attempts");
            const parsed = saved ? JSON.parse(saved) : [];
            const filtered = (Array.isArray(parsed) ? parsed : []).filter(
              (a: any) => String(a?.id) !== String(syncedRecord.id)
            );
            localStorage.setItem(
              "edunexus_attempts",
              JSON.stringify([syncedRecord, ...filtered])
            );
            window.dispatchEvent(new Event("storage"));
          } catch {}
        }
        if (onSavedBatchAttempts) {
          onSavedBatchAttempts([syncedRecord]);
        }
        if (onSavedSuccess) {
          onSavedSuccess();
        }
      } catch (err) {
        console.warn("Lỗi auto-sync bài quét:", err);
      }
    },
    [persistPaperAttemptToSupabase, onSavedBatchAttempts, onSavedSuccess]
  );

  // 6. VÒNG LẶP QUÉT REALTIME NHẠY BÉN (HOLD 180MS & COOLDOWN 1200MS)
  useEffect(() => {
    if (!isOpen || mobileViewTab !== "camera") return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      const now = Date.now();
      // Cooldown 1200ms giữa 2 lần chụp tự động để lật tờ tiếp theo là ăn ngay
      if (now - lastAutoCaptureTimeRef.current < 1200) {
        return;
      }

      const checkCanvas = extractA4GuideFrameCanvas(video, 440);
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
          setCameraStatusText("Đã khớp 4 góc — Đang chụp tự động...");
        } else if (now - matchedHoldStartTimeRef.current >= 180) {
          lastAutoCaptureTimeRef.current = now;
          matchedHoldStartTimeRef.current = null;

          setShutterFlash(true);
          setTimeout(() => setShutterFlash(false), 180);

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
              triggerLiveBottomCardFeedback(resultItem);
              setCameraStatusText("✓ Đã nhận bài! Mời đưa phiếu tiếp theo vào...");
              autoSyncSingleItemInBackground(resultItem);
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
            ? `Đã khớp ${matchedCount}/4 góc phiếu`
            : "Căn 4 mốc vuông đen vào 4 góc khung ngắm"
        );
      }
    }, 110);

    return () => clearInterval(interval);
  }, [
    isOpen,
    mobileViewTab,
    autoCaptureEnabled,
    extractA4GuideFrameCanvas,
    processSingleCanvas,
    triggerLiveBottomCardFeedback,
    autoSyncSingleItemInBackground
  ]);

  const handleManualCameraCapture = () => {
    const video = videoRef.current;
    if (!video) return;

    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 180);

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
      triggerLiveBottomCardFeedback(resultItem);
      autoSyncSingleItemInBackground(resultItem);
      // Giữ nguyên màn hình Camera luôn mở để giáo viên xem Live Bottom Card và quét liên tục
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

  const liveCardItem = useMemo(() => {
    if (!liveScannedCardId) return null;
    return scannedItems.find((i) => i.tempId === liveScannedCardId) || null;
  }, [liveScannedCardId, scannedItems]);

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
      Math.min(
        activeInspectItem.originalWidth,
        Math.round(relX * activeInspectItem.originalWidth)
      )
    );
    const newY = Math.max(
      0,
      Math.min(
        activeInspectItem.originalHeight,
        Math.round(relY * activeInspectItem.originalHeight)
      )
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
      canvas.width =
        activeInspectItem.originalWidth || img.naturalWidth || OMR_CANONICAL_WIDTH;
      canvas.height =
        activeInspectItem.originalHeight || img.naturalHeight || OMR_CANONICAL_HEIGHT;
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
          const updatedItem: ScannedSheetItem = {
            ...rescanned,
            tempId: activeInspectItem.tempId,
            cornerPoints: editingCorners,
            warpMatrixApplied: true,
            geometryWarning: undefined
          };
          handleUpdateScannedItem(activeInspectItem.tempId, updatedItem);
          setIsManualCornerMode(false);
          await autoSyncSingleItemInBackground(updatedItem);
          if (showToast) {
            showToast(
              `✓ Đã nắn phẳng & đồng bộ điểm! SBD: ${rescanned.detectedSbd} (${rescanned.score}đ)`,
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

  // GÁN HỌC SINH HOẶC SỬA SBD THỦ CÔNG (CHỈ SO KHỚP THEO SBD 6 CHỮ SỐ)
  const handleManualSbdEdit = (item: ScannedSheetItem, newSbdRaw: string) => {
    const cleanInput = newSbdRaw.replace(/[^0-9]/g, "").slice(0, 6);
    const paddedSbd = cleanInput.length > 0 ? cleanInput.padStart(6, "0") : "";
    const matchedStu =
      (cleanInput.length === 6 ? sbdLookupMap.get(cleanInput) : undefined) ||
      (paddedSbd ? sbdLookupMap.get(paddedSbd) : undefined) ||
      null;

    const effectiveSbd = matchedStu ? matchedStu.sbd : cleanInput;

    const updatedCoords = (item.omrRawData?.bubble_coordinates || []).map((b: any) => {
      if (b.section !== "sbd") return b;
      const colMatch = String(b.id || "").match(/sbd-col(\d+)-(\d+)/);
      if (!colMatch) return b;
      const colIdx = Number(colMatch[1]);
      const digitStr = colMatch[2];
      const isNowSelected = effectiveSbd[colIdx] === digitStr;
      return {
        ...b,
        isSelected: isNowSelected,
        status: isNowSelected ? "detected" : "unfilled"
      };
    });

    const nextItem: ScannedSheetItem = {
      ...item,
      detectedSbd: effectiveSbd || "Chưa tô",
      isSbdMatchedInList: Boolean(matchedStu),
      matchedStudentId:
        matchedStu?.id || `unmatched_sbd_${effectiveSbd || Date.now()}`,
      matchedStudentName: matchedStu
        ? matchedStu.full_name
        : `Chưa khớp danh sách (SBD: ${effectiveSbd || "Chưa tô"})`,
      matchedSchool: matchedStu?.school || item.matchedSchool,
      omrRawData: {
        ...item.omrRawData,
        detected_sbd: effectiveSbd,
        bubble_coordinates: updatedCoords
      }
    };

    handleUpdateScannedItem(item.tempId, nextItem);
    if (matchedStu || effectiveSbd.length === 6) {
      autoSyncSingleItemInBackground(nextItem);
    }
  };

  const handleAssignStudentDirectly = (item: ScannedSheetItem, studentId: string) => {
    const stu = studentDirectory.find((s) => s.id === studentId);
    if (!stu) return;

    const nextItem: ScannedSheetItem = {
      ...item,
      detectedSbd: stu.sbd || item.detectedSbd,
      isSbdMatchedInList: true,
      matchedStudentId: stu.id,
      matchedStudentName: stu.full_name,
      matchedSchool: stu.school || "THPT",
      omrRawData: {
        ...item.omrRawData,
        detected_sbd: stu.sbd || item.detectedSbd
      }
    };

    handleUpdateScannedItem(item.tempId, nextItem);
    autoSyncSingleItemInBackground(nextItem);
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

    const updatedItem: ScannedSheetItem = {
      ...item,
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
    };

    handleUpdateScannedItem(item.tempId, updatedItem);
    autoSyncSingleItemInBackground(updatedItem);
  };

  // LƯU TẤT CẢ ĐIỂM LÊN SUPABASE & ĐÓNG MODAL
  const handleSaveAllScannedToSystem = async () => {
    if (scannedItems.length === 0 || isSavingAll) return;
    setIsSavingAll(true);

    const formattedAttempts: any[] = [];

    for (let i = 0; i < scannedItems.length; i++) {
      const item = scannedItems[i];
      const syncedRecord = await persistPaperAttemptToSupabase(
        item,
        `paper_${item.matchedQuizId}_${item.matchedStudentId}`
      );
      formattedAttempts.push(syncedRecord);
    }

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_attempts");
        const parsed = saved ? JSON.parse(saved) : [];
        const newIds = new Set(formattedAttempts.map((x) => String(x.id)));
        const existingFiltered = (Array.isArray(parsed) ? parsed : []).filter(
          (a: any) => !newIds.has(String(a?.id))
        );
        const merged = [...formattedAttempts, ...existingFiltered];
        localStorage.setItem("edunexus_attempts", JSON.stringify(merged));
        window.dispatchEvent(new Event("storage"));
      } catch {}
    }

    if (onSavedBatchAttempts) {
      onSavedBatchAttempts(formattedAttempts);
    }
    if (onSavedSuccess) {
      onSavedSuccess();
    }

    if (showToast) {
      showToast(
        `Đã đồng bộ thành công ${formattedAttempts.length} bài thi giấy lên Supabase!`,
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
        {/* 1. THANH TOP BAR TỐI GIẢN */}
        <div className="px-3 sm:px-5 py-2 bg-slate-900 border-b border-slate-800 text-white flex items-center justify-between gap-2 shrink-0 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <select
              value={selectedQuizId}
              onChange={(e) => setSelectedQuizId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-white outline-none cursor-pointer max-w-[190px] sm:max-w-[340px] truncate"
            >
              <option value="auto">Tự nhận diện theo Mã đề (3 số)</option>
              {allQuizzesPool.map((q) => (
                <option key={q.id} value={q.id}>
                  [Mã {q.examCode}] {q.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex lg:hidden bg-slate-800 p-0.5 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setMobileViewTab("camera")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                  mobileViewTab === "camera" ? "bg-blue-600 text-white" : "text-slate-300"
                }`}
              >
                Camera
              </button>
              <button
                type="button"
                onClick={() => setMobileViewTab("inspect")}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                  mobileViewTab === "inspect" ? "bg-blue-600 text-white" : "text-slate-300"
                }`}
              >
                Soi phiếu ({scannedItems.length})
              </button>
            </div>

            {scannedItems.length > 0 && (
              <button
                type="button"
                disabled={isSavingAll}
                onClick={handleSaveAllScannedToSystem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {isSavingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Lưu tất cả ({scannedItems.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. KHÔNG GIAN CHÍNH */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 relative overflow-hidden">
          {/* CỘT CAMERA DỌC CHUẨN A4 — TỐI ƯU RESPONSIVE CHO IPAD & TABLET */}
          <div
            className={`lg:col-span-6 relative flex flex-col min-h-0 bg-black overflow-hidden ${
              mobileViewTab === "inspect" ? "hidden lg:flex" : "flex"
            }`}
          >
            <div className="relative flex-1 w-full min-h-0 flex items-center justify-center overflow-hidden px-3 py-2 sm:px-6 sm:py-4">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover"
              />

              {shutterFlash && (
                <div className="absolute inset-0 bg-white/85 z-40 pointer-events-none" />
              )}

              {/* Thông báo ngắn gọn trên đỉnh khung ngắm */}
              <div className="absolute top-2.5 inset-x-3 flex justify-center z-20 pointer-events-none">
                <span
                  className={`px-3.5 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-xs shadow-md ${
                    realtimeCornersStatus.isMatched
                      ? "bg-emerald-950/90 text-emerald-300 border-emerald-500"
                      : "bg-slate-900/85 text-slate-200 border-slate-700"
                  }`}
                >
                  {cameraStatusText}
                </span>
              </div>

              {/* KHUNG NGẮM DỌC TỶ LỆ CHUẨN A4 CĂN GIỮA CÂN ĐỐI TRÊN IPAD & ĐIỆN THOẠI */}
              <div
                ref={guideFrameRef}
                className="relative z-10 h-full max-h-[68vh] sm:max-h-[72vh] aspect-[1/1.414] max-w-[88vw] rounded-lg shadow-[0_0_0_9999px_rgba(2,6,23,0.52)] pointer-events-none flex flex-col justify-between"
              >
                <div
                  className={`absolute inset-0 rounded-lg border-2 transition-colors ${
                    realtimeCornersStatus.isMatched
                      ? "border-emerald-500"
                      : "border-amber-400/70 border-dashed"
                  }`}
                />

                {/* 2 Ô góc trên */}
                <div className="flex justify-between p-1.5">
                  {[
                    { key: "TL", matched: realtimeCornersStatus.topLeft },
                    { key: "TR", matched: realtimeCornersStatus.topRight }
                  ].map((c) => (
                    <div
                      key={c.key}
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-md border-2 flex items-center justify-center transition-all ${
                        c.matched
                          ? "border-emerald-400 bg-emerald-500/30 scale-105"
                          : "border-amber-400 border-dashed bg-black/25"
                      }`}
                    >
                      <span className="text-[10px] font-bold text-white">
                        {c.matched ? "✓" : c.key}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 2 Ô góc dưới */}
                <div className="flex justify-between p-1.5">
                  {[
                    { key: "BL", matched: realtimeCornersStatus.bottomLeft },
                    { key: "BR", matched: realtimeCornersStatus.bottomRight }
                  ].map((c) => (
                    <div
                      key={c.key}
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-md border-2 flex items-center justify-center transition-all ${
                        c.matched
                          ? "border-emerald-400 bg-emerald-500/30 scale-105"
                          : "border-amber-400 border-dashed bg-black/25"
                      }`}
                    >
                      <span className="text-[10px] font-bold text-white">
                        {c.matched ? "✓" : c.key}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* THẺ XEM NHANH KẾT QUẢ (LIVE BOTTOM CARD) NỔI TRỰC TIẾP TRÊN CAMERA */}
              <AnimatePresence>
                {liveCardItem && (
                  <motion.div
                    key={liveCardItem.tempId}
                    initial={{ opacity: 0, y: 24, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-3 inset-x-3 sm:inset-x-6 z-30 rounded-2xl bg-slate-900/95 border-2 border-emerald-500/90 p-3 sm:p-3.5 text-white shadow-2xl backdrop-blur-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-mono font-bold text-xs">
                            SBD: {liveCardItem.detectedSbd}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-mono font-bold text-[11px]">
                            Mã đề: {liveCardItem.detectedExamCode}
                          </span>
                          {liveCardItem.syncedToCloud && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950/90 border border-emerald-700 text-emerald-300 text-[10px] font-bold">
                              ✓ Đã lưu Cloud
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {liveCardItem.isSbdMatchedInList ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                          )}
                          <h4
                            className={`text-sm sm:text-base font-extrabold truncate ${
                              liveCardItem.isSbdMatchedInList
                                ? "text-white"
                                : "text-amber-300"
                            }`}
                          >
                            {liveCardItem.matchedStudentName}
                          </h4>
                        </div>

                        {/* Nếu SBD chưa khớp danh sách -> Hiển thị nút chọn tay nhanh ngay trên thẻ Camera */}
                        {!liveCardItem.isSbdMatchedInList && (
                          <div className="pt-1 flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssignStudentDirectly(
                                    liveCardItem,
                                    e.target.value
                                  );
                                }
                              }}
                              className="w-full max-w-[260px] px-2 py-1 rounded-lg bg-slate-800 border border-amber-500/80 text-xs font-bold text-amber-200 outline-none cursor-pointer"
                            >
                              <option value="">
                                -- Chọn nhanh học sinh cho bài này --
                              </option>
                              {studentDirectory.map((stu) => (
                                <option key={stu.id} value={stu.id}>
                                  [{stu.sbd || "Chưa SBD"}] {stu.full_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Khối Điểm số lớn, rõ ràng */}
                      <div className="text-right shrink-0">
                        <div className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-black text-lg sm:text-xl leading-none shadow-md">
                          {liveCardItem.score.toFixed(2)}đ
                        </div>
                      </div>
                    </div>

                    {/* Thống kê Đúng / Sai / Bỏ trống & Nút mở chỉnh sửa nhanh */}
                    <div className="mt-2.5 pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 sm:gap-3 font-bold">
                        <span className="text-emerald-400">
                          ✓ Đúng: {liveCardItem.correctCount}/
                          {liveCardItem.totalQuestions}
                        </span>
                        <span className="text-rose-400">
                          ✗ Sai: {liveCardItem.wrongCount}
                        </span>
                        <span className="text-amber-300">
                          ○ Trống: {liveCardItem.skippedCount}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveInspectId(liveCardItem.tempId);
                            setMobileViewTab("inspect");
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Chỉnh sửa bài này</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLiveScannedCardId(null)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
                          title="Đóng thẻ xem nhanh"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 3. THANH CÔNG CỤ DƯỚI ĐÁY (ĐÈN FLASH, ÂM BÁO, NÚT CHỤP, ĐỔI CAMERA) */}
            <div className="bg-slate-950 border-t border-slate-800 px-4 py-2.5 flex items-center justify-between sm:justify-around shrink-0 z-20">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  className={`p-2.5 rounded-full border transition cursor-pointer ${
                    torchOn
                      ? "bg-amber-400 text-slate-950 border-amber-300 shadow-md"
                      : "bg-slate-900 text-slate-300 border-slate-800 hover:text-white"
                  }`}
                  title="Bật / Tắt đèn Flash"
                >
                  <Flashlight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setSoundEnabled((prev) => !prev)}
                  className={`p-2.5 rounded-full border transition cursor-pointer ${
                    soundEnabled
                      ? "bg-slate-900 text-emerald-400 border-emerald-800/80"
                      : "bg-slate-900 text-slate-500 border-slate-800"
                  }`}
                  title={soundEnabled ? "Âm báo Beep: Đang BẬT" : "Âm báo Beep: Đang TẮT"}
                >
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Nút chụp tròn lớn trung tâm */}
              <button
                type="button"
                onClick={handleManualCameraCapture}
                className="w-14 h-14 rounded-full bg-white p-1 shadow-lg active:scale-95 transition flex items-center justify-center cursor-pointer"
                title="Chụp & Chấm ngay"
              >
                <div className="w-full h-full rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white">
                  <Camera className="w-6 h-6" />
                </div>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAutoCaptureEnabled((p) => !p)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                    autoCaptureEnabled
                      ? "bg-emerald-950/60 text-emerald-400 border-emerald-700"
                      : "bg-slate-900 text-slate-400 border-slate-800"
                  }`}
                >
                  {autoCaptureEnabled ? "Tự chụp: BẬT" : "Tự chụp: TẮT"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((m) => (m === "environment" ? "user" : "environment"))
                  }
                  className="p-2.5 rounded-full bg-slate-900 text-slate-300 border border-slate-800 hover:text-white cursor-pointer"
                  title="Đổi Camera Trước / Sau"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 4. KHAY TRƯỢT ĐÁY DANH SÁCH ĐÃ QUÉT (BOTTOM SHEET) */}
            <div className="bg-slate-900 border-t border-slate-800 text-white shrink-0 z-30">
              <div
                onClick={() => setIsBottomSheetExpanded((prev) => !prev)}
                className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-800/70 transition"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  <span>Đã quét trong phiên: {scannedItems.length} bài</span>
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
                      className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
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
                    className="max-h-[36vh] overflow-y-auto divide-y divide-slate-800 bg-slate-950 custom-scrollbar"
                  >
                    {scannedItems.length === 0 ? (
                      <div className="py-6 text-center text-slate-500 text-xs">
                        Chưa có bài nào được quét.
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
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                #{scannedItems.length - idx}
                              </span>
                              <span className="font-mono font-bold text-xs text-blue-400">
                                SBD: {item.detectedSbd}
                              </span>
                              <span
                                className={`font-semibold text-xs truncate ${
                                  item.isSbdMatchedInList
                                    ? "text-white"
                                    : "text-amber-300"
                                }`}
                              >
                                {item.matchedStudentName}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                ({item.correctCount}/{item.totalQuestions} câu)
                              </span>
                              {item.syncedToCloud && (
                                <span className="text-[10px] text-emerald-400 font-medium">
                                  ✓ Đã lưu Cloud
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-white font-bold text-xs border border-slate-700">
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

          {/* CỘT PHẢI: XEM ẢNH PHIẾU ĐÃ CHẤM & SỬA NHANH */}
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
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                    isManualCornerMode
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>
                    {isManualCornerMode ? "Đang chỉnh 4 góc" : "Kéo chỉnh 4 góc"}
                  </span>
                </button>

                {isManualCornerMode && (
                  <button
                    type="button"
                    disabled={isRewarpingManual}
                    onClick={handleApplyManualCornersAndRescan}
                    className="px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    {isRewarpingManual ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5" />
                    )}
                    <span>Nắn phẳng & Quét lại</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setZoomScale((z) => Math.max(0.8, Number((z - 0.2).toFixed(2))))
                  }
                  className="p-1 rounded bg-slate-800 text-white cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px]">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setZoomScale((z) => Math.min(2.4, Number((z + 0.2).toFixed(2))))
                  }
                  className="p-1 rounded bg-slate-800 text-white cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {activeInspectItem && (
              <div className="px-3.5 py-2 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                    <span className="font-semibold">SBD:</span>
                    <input
                      type="text"
                      maxLength={6}
                      value={activeInspectItem.detectedSbd}
                      onChange={(e) =>
                        handleManualSbdEdit(activeInspectItem, e.target.value)
                      }
                      className="w-16 font-mono font-bold text-white bg-slate-950 px-1 rounded border border-slate-700 outline-none text-center"
                    />
                  </div>

                  <select
                    value={
                      activeInspectItem.isSbdMatchedInList
                        ? activeInspectItem.matchedStudentId
                        : ""
                    }
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAssignStudentDirectly(
                          activeInspectItem,
                          e.target.value
                        );
                      }
                    }}
                    className={`px-2 py-1 rounded-md border text-xs font-semibold outline-none cursor-pointer ${
                      activeInspectItem.isSbdMatchedInList
                        ? "border-slate-700 bg-slate-800 text-white"
                        : "border-amber-500 bg-amber-950/60 text-amber-200"
                    }`}
                  >
                    {!activeInspectItem.isSbdMatchedInList && (
                      <option value="">
                        ⚠️ {activeInspectItem.matchedStudentName} (Bấm chọn HS)
                      </option>
                    )}
                    {studentDirectory.map((s) => (
                      <option key={s.id} value={s.id}>
                        [{s.sbd || "Chưa SBD"}] {s.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-bold text-xs">
                    {activeInspectItem.score.toFixed(2)}đ ({activeInspectItem.correctCount}/
                    {activeInspectItem.totalQuestions})
                  </span>
                  <button
                    type="button"
                    onClick={() => setMobileViewTab("camera")}
                    className="lg:hidden px-3 py-1 rounded-md bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Quay lại Camera
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto p-3 sm:p-4 custom-scrollbar flex flex-col items-center justify-start space-y-3">
              {activeInspectItem ? (
                <>
                  {isManualCornerMode && editingCorners ? (
                    <div className="w-full space-y-2">
                      <div
                        style={{
                          width: `${Math.round(380 * zoomScale)}px`,
                          maxWidth: "100%",
                          aspectRatio: `${activeInspectItem.originalWidth} / ${activeInspectItem.originalHeight}`
                        }}
                        className="relative mx-auto rounded-lg overflow-hidden border border-emerald-500 bg-black shadow-xl select-none touch-none"
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
                            strokeWidth={Math.max(
                              3,
                              Math.round(activeInspectItem.originalWidth * 0.004)
                            )}
                            strokeDasharray="10 6"
                          />

                          {(
                            [
                              { key: "topLeft", label: "TL", pt: editingCorners.topLeft },
                              { key: "topRight", label: "TR", pt: editingCorners.topRight },
                              {
                                key: "bottomRight",
                                label: "BR",
                                pt: editingCorners.bottomRight
                              },
                              {
                                key: "bottomLeft",
                                label: "BL",
                                pt: editingCorners.bottomLeft
                              }
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
                                  strokeWidth={3}
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
                      className="relative rounded-lg overflow-hidden border border-slate-700 bg-white shadow-xl shrink-0"
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
                                ? "#2563EB"
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
                                        ? "rgba(37, 99, 235, 0.22)"
                                        : b.status === "correct"
                                        ? "rgba(16,185,129,0.22)"
                                        : b.status === "wrong"
                                        ? "rgba(239,68,68,0.22)"
                                        : "none"
                                    }
                                    stroke={strokeColor}
                                    strokeWidth={2.2}
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

                  <div className="w-full bg-slate-950 rounded-xl border border-slate-800 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                        Chỉnh sửa nhanh đáp án
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowQuickAdjustPanel((p) => !p)}
                        className="text-[11px] text-blue-400 cursor-pointer"
                      >
                        {showQuickAdjustPanel ? "Thu gọn" : "Mở rộng"}
                      </button>
                    </div>

                    {showQuickAdjustPanel && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[190px] overflow-y-auto custom-scrollbar pr-1">
                        {(activeInspectItem.questionDetails || []).map((qd: any) => {
                          const isRight = qd.status === "correct";
                          const isSkipped = qd.status === "skipped";
                          return (
                            <div
                              key={qd.questionOrder}
                              className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                                isRight
                                  ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-200"
                                  : isSkipped
                                  ? "bg-amber-950/40 border-amber-700/50 text-amber-200"
                                  : "bg-rose-950/30 border-rose-800/50 text-rose-200"
                              }`}
                            >
                              <div>
                                <span className="font-bold">Câu {qd.questionOrder} </span>
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
                                        className={`w-6 h-6 rounded font-bold text-[10px] border transition cursor-pointer ${
                                          picked
                                            ? isRight
                                              ? "bg-emerald-600 text-white border-emerald-500"
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
                                <span className="text-[10px] font-semibold">
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
                                    const p1Count = (
                                      activeInspectItem.questionDetails || []
                                    ).filter((x: any) => x.part === 1).length;
                                    const p2Count = (
                                      activeInspectItem.questionDetails || []
                                    ).filter((x: any) => x.part === 2).length;
                                    const localNum = qd.questionOrder - p1Count - p2Count;
                                    handleQuickAdjustAnswer(
                                      activeInspectItem,
                                      3,
                                      Math.max(1, localNum),
                                      e.target.value
                                    );
                                  }}
                                  className="w-16 px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900 text-center font-bold text-xs text-white outline-none"
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
                <div className="my-auto text-center text-slate-500 text-xs p-6">
                  Kết quả quét và ảnh đối chiếu sẽ hiển thị tại đây.
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
