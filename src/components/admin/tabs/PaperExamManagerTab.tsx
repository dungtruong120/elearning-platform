"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Printer,
  Camera,
  Users,
  Search,
  Filter,
  Eye,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  BookOpen,
  Award,
  Target,
  Upload,
  X,
  Save,
  ZoomIn,
  ZoomOut,
  Loader2,
  Sparkles,
  ScanLine,
  Download
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  extractExamQuestionCounts,
  deriveExamCode3Digits,
  formatStudentAutoSBD,
  generatePrintableAnswerSheetPagesSVG,
  openPrintableDynamicAnswerSheet,
  scanOMRSheetFromCanvas,
  gradeOMRSubmission,
  OMR_CANONICAL_WIDTH,
  OMR_CANONICAL_HEIGHT
} from "@/lib/omrEngine";

export interface PaperExamManagerTabProps {
  chapters?: any[];
  practiceExams?: any[];
  registeredStudents?: any[];
  allAttempts?: any[];
  setAllAttempts?: React.Dispatch<React.SetStateAction<any[]>> | ((attempts: any[]) => void);
  onOpenBulkScannerModal?: (selectedQuiz?: any) => void;
  showToast?: (msg: string, type?: "success" | "error") => void;
}

interface UnifiedQuizSourceItem {
  id: string;
  title: string;
  sourceType: "homework" | "test" | "practice";
  sourceLabel: string;
  chapterId?: string;
  chapterTitle?: string;
  lessonId?: string;
  lessonTitle?: string;
  assignedMonth?: number;
  assignedWeek?: number;
  examCode: string;
  part1Count: number;
  part2Count: number;
  part3Count: number;
  totalQuestions: number;
  rawQuizObj: any;
}

function normalizeStr(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export default function PaperExamManagerTab({
  chapters = [],
  practiceExams = [],
  registeredStudents = [],
  allAttempts: propAttempts = [],
  setAllAttempts,
  onOpenBulkScannerModal,
  showToast
}: PaperExamManagerTabProps) {
  // BỘ LỌC ĐA TẦNG
  const [sourceFilter, setSourceFilter] = useState<"all" | "homework" | "test" | "practice">("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [selectedChapterId, setSelectedChapterId] = useState<string>("all");
  const [selectedLessonId, setSelectedLessonId] = useState<string>("all");
  const [selectedQuizId, setSelectedQuizId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // STATE MODAL XEM TRƯỚC PHIẾU IN A4, BẢNG SBD LỚP, CHẤM HÀNG LOẠT & PHÚC KHẢO
  const [showSheetPreviewModal, setShowSheetPreviewModal] = useState<boolean>(false);
  const [showSbdDirectoryModal, setShowSbdDirectoryModal] = useState<boolean>(false);
  const [showInternalBulkScanner, setShowInternalBulkScanner] = useState<boolean>(false);

  const [inspectingAttempt, setInspectingAttempt] = useState<any | null>(null);
  const [editScoreInput, setEditScoreInput] = useState<string>("");
  const [isSavingScore, setIsSavingScore] = useState<boolean>(false);
  const [zoomScale, setZoomScale] = useState<number>(1);

  // STATE MÁY QUÉT HÀNG LOẠT NỘI BỘ
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const [batchProgressText, setBatchProgressText] = useState<string>("");
  const [batchScannedResults, setBatchScannedResults] = useState<any[]>([]);
  const batchFileInputRef = useRef<HTMLInputElement | null>(null);

  // Nạp dự phòng từ localStorage nếu props trống
  const [localAttempts, setLocalAttempts] = useState<any[]>([]);
  const [localStudents, setLocalStudents] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedAtt = localStorage.getItem("edunexus_attempts");
      const delIds = new Set<string>(
        JSON.parse(localStorage.getItem("edunexus_deleted_attempt_ids") || "[]")
      );
      if (savedAtt) {
        const parsed = JSON.parse(savedAtt);
        if (Array.isArray(parsed)) {
          setLocalAttempts(parsed.filter((a: any) => !delIds.has(String(a?.id || ""))));
        }
      }
    } catch {}

    try {
      const savedStu = localStorage.getItem("edunexus_registered_students");
      if (savedStu) {
        const parsedStu = JSON.parse(savedStu);
        if (Array.isArray(parsedStu)) setLocalStudents(parsedStu);
      }
    } catch {}
  }, [propAttempts, registeredStudents]);

  const effectiveAttempts = useMemo(() => {
    if (Array.isArray(propAttempts) && propAttempts.length > 0) return propAttempts;
    return localAttempts;
  }, [propAttempts, localAttempts]);

  const effectiveStudents = useMemo(() => {
    if (Array.isArray(registeredStudents) && registeredStudents.length > 0) {
      return registeredStudents;
    }
    return localStudents;
  }, [registeredStudents, localStudents]);

  // 1. TẠO DANH MỤC SỐ BÁO DANH (SBD) TỰ ĐỘNG CHO CẢ LỚP (000001 -> 0000NN)
  const sbdDirectoryList = useMemo(() => {
    const pool: { id: string; username: string; full_name: string; school: string; mode: string }[] = [];
    const seen = new Set<string>();

    (effectiveStudents || []).forEach((s: any) => {
      if (!s) return;
      const key = String(s.id || s.username || s.full_name || "").trim();
      if (!key || seen.has(key.toLowerCase())) return;
      seen.add(key.toLowerCase());
      pool.push({
        id: String(s.id || key),
        username: String(s.username || ""),
        full_name: String(s.full_name || s.name || s.username || "Học sinh"),
        school: String(s.school || "THPT"),
        mode: String(s.learning_mode || s.study_mode || "offline").toLowerCase().includes("on")
          ? "Online"
          : "Offline"
      });
    });

    pool.sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));

    const directory = pool.map((stu, idx) => ({
      ...stu,
      stt: idx + 1,
      sbd: formatStudentAutoSBD(idx + 1)
    }));

    if (typeof window !== "undefined" && directory.length > 0) {
      try {
        localStorage.setItem("edunexus_sbd_directory", JSON.stringify(directory));
      } catch {}
    }

    return directory;
  }, [effectiveStudents]);

  const sbdToStudentMap = useMemo(() => {
    const map = new Map<string, (typeof sbdDirectoryList)[0]>();
    sbdDirectoryList.forEach((item) => {
      map.set(item.sbd, item);
      map.set(String(item.stt), item);
    });
    return map;
  }, [sbdDirectoryList]);

  // 2. TỔNG HỢP TOÀN BỘ ĐỀ THI TỪ 3 NGUỒN: BTVN, ĐỀ KIỂM TRA ĐỊNH KỲ & KHO LUYỆN ĐỀ
  const allUnifiedQuizzes = useMemo<UnifiedQuizSourceItem[]>(() => {
    const list: UnifiedQuizSourceItem[] = [];

    (chapters || []).forEach((chap: any) => {
      const cId = String(chap?.id || "");
      const cTitle = String(chap?.title || "Chương");

      (chap?.lessons || []).forEach((les: any) => {
        const lId = String(les?.id || "");
        const lTitle = String(les?.title || "Bài học");
        const lMonth = Number(les?.assigned_month) || 10;
        const lWeek = Number(les?.assigned_week) || 1;

        (les?.homework_files || []).forEach((hw: any) => {
          if (!hw || hw.is_drive_file) return;
          const counts = extractExamQuestionCounts(hw);
          list.push({
            id: String(hw.id),
            title: String(hw.title || "Bài tập về nhà"),
            sourceType: "homework",
            sourceLabel: "BTVN",
            chapterId: cId,
            chapterTitle: cTitle,
            lessonId: lId,
            lessonTitle: lTitle,
            assignedMonth: Number(hw.assigned_month) || lMonth,
            assignedWeek: Number(hw.assigned_week) || lWeek,
            examCode: deriveExamCode3Digits(hw),
            part1Count: counts.part1Count,
            part2Count: counts.part2Count,
            part3Count: counts.part3Count,
            totalQuestions: counts.totalCount,
            rawQuizObj: hw
          });
        });

        (les?.test_quizzes || []).forEach((tq: any) => {
          if (!tq || tq.is_drive_file) return;
          const counts = extractExamQuestionCounts(tq);
          list.push({
            id: String(tq.id),
            title: String(tq.title || "Đề kiểm tra định kỳ"),
            sourceType: "test",
            sourceLabel: "Đề KT định kỳ",
            chapterId: cId,
            chapterTitle: cTitle,
            lessonId: lId,
            lessonTitle: lTitle,
            assignedMonth: Number(tq.assigned_month) || lMonth,
            assignedWeek: Number(tq.assigned_week) || lWeek,
            examCode: deriveExamCode3Digits(tq),
            part1Count: counts.part1Count,
            part2Count: counts.part2Count,
            part3Count: counts.part3Count,
            totalQuestions: counts.totalCount,
            rawQuizObj: tq
          });
        });
      });
    });

    (practiceExams || []).forEach((pe: any) => {
      if (!pe) return;
      const counts = extractExamQuestionCounts(pe);
      list.push({
        id: String(pe.id),
        title: String(pe.title || "Đề luyện thi thực chiến"),
        sourceType: "practice",
        sourceLabel: pe.category || "Luyện đề",
        assignedMonth: Number(pe.assigned_month) || undefined,
        assignedWeek: Number(pe.assigned_week) || undefined,
        examCode: deriveExamCode3Digits(pe),
        part1Count: counts.part1Count,
        part2Count: counts.part2Count,
        part3Count: counts.part3Count,
        totalQuestions: counts.totalCount,
        rawQuizObj: pe
      });
    });

    return list;
  }, [chapters, practiceExams]);

  // Danh sách bài học thuộc chương đang chọn
  const lessonsInSelectedChapter = useMemo(() => {
    if (selectedChapterId === "all") return [];
    const found = (chapters || []).find((c: any) => String(c?.id) === selectedChapterId);
    return found?.lessons || [];
  }, [chapters, selectedChapterId]);

  // Lọc danh sách các bài thi thỏa mãn bộ lọc Nguồn + Tháng + Chương + Bài học
  const filteredQuizzes = useMemo(() => {
    return allUnifiedQuizzes.filter((q) => {
      if (sourceFilter !== "all" && q.sourceType !== sourceFilter) return false;
      if (monthFilter !== "all" && q.assignedMonth && q.assignedMonth !== Number(monthFilter)) {
        return false;
      }
      if (selectedChapterId !== "all" && q.chapterId !== selectedChapterId) return false;
      if (selectedLessonId !== "all" && q.lessonId !== selectedLessonId) return false;
      return true;
    });
  }, [allUnifiedQuizzes, sourceFilter, monthFilter, selectedChapterId, selectedLessonId]);

  // Bài thi đang được chọn để Xuất phiếu in A4 hoặc Chấm bài giấy
  const activeSelectedQuiz = useMemo<UnifiedQuizSourceItem | null>(() => {
    if (selectedQuizId !== "all") {
      const exact = allUnifiedQuizzes.find((q) => q.id === selectedQuizId);
      if (exact) return exact;
    }
    return filteredQuizzes[0] || allUnifiedQuizzes[0] || null;
  }, [selectedQuizId, filteredQuizzes, allUnifiedQuizzes]);

  // 3. LỌC DANH SÁCH CÁC BÀI THI TRÊN GIẤY ĐÃ NỘP
  const paperSubmissionsList = useMemo(() => {
    const quizMapById = new Map<string, UnifiedQuizSourceItem>();
    const quizMapByTitle = new Map<string, UnifiedQuizSourceItem>();
    allUnifiedQuizzes.forEach((q) => {
      quizMapById.set(q.id.trim().toLowerCase(), q);
      quizMapByTitle.set(normalizeStr(q.title), q);
    });

    return (effectiveAttempts || [])
      .filter((att: any) => {
        if (!att) return false;
        const isPaper =
          att.submission_type === "paper" ||
          att.submission_type === "digital_sheet" ||
          Boolean(att.paper_scan_url) ||
          Boolean(att.omr_raw_data);
        return isPaper;
      })
      .map((att: any) => {
        const qId = String(att.quizId || att.quiz_id || att.exam_id || "").trim().toLowerCase();
        const qTitle = normalizeStr(att.examTitle || att.quizTitle || att.quiz_title || att.title || "");
        const matchedQuiz =
          (qId && quizMapById.get(qId)) ||
          (qTitle && quizMapByTitle.get(qTitle)) ||
          null;

        const sourceType: "homework" | "test" | "practice" = matchedQuiz
          ? matchedQuiz.sourceType
          : att.isHomework || att.is_homework || att.type === "homework"
          ? "homework"
          : att.type === "test"
          ? "test"
          : "practice";

        const rawDate = att.createdAt || att.created_at || att.submittedAt;
        const validDate = rawDate ? new Date(rawDate) : new Date();
        const month = Number(att.assigned_month) || matchedQuiz?.assignedMonth || (validDate.getMonth() + 1);

        const detectedSbd =
          att.omr_raw_data?.detected_sbd ||
          formatStudentAutoSBD(att.studentId || att.student_id || 1);
        const detectedCode =
          att.omr_raw_data?.detected_exam_code ||
          matchedQuiz?.examCode ||
          "101";

        const flaggedList: number[] = Array.isArray(att.flagged_questions)
          ? att.flagged_questions
          : Array.isArray(att.omr_raw_data?.flagged_questions)
          ? att.omr_raw_data.flagged_questions
          : [];

        return {
          ...att,
          resolvedQuiz: matchedQuiz,
          sourceType,
          sourceLabel:
            sourceType === "homework"
              ? "BTVN"
              : sourceType === "test"
              ? "Đề KT định kỳ"
              : "Luyện đề",
          chapterId: matchedQuiz?.chapterId || "",
          lessonId: matchedQuiz?.lessonId || "",
          month,
          detectedSbd,
          detectedCode,
          flaggedList,
          paperScanUrl:
            att.paper_scan_url || att.omr_raw_data?.warped_image_data_url || "",
          studentDisplayName:
            att.studentName || att.student_name || att.full_name || "Học sinh",
          examDisplayTitle:
            att.examTitle || att.quizTitle || matchedQuiz?.title || "Bài thi giấy",
          scoreVal: Number(att.score ?? att.points ?? 0),
          correctVal: Number(att.correctCount ?? att.correct_count ?? 0),
          totalQVal: Number(
            att.totalQuestions ?? att.total_questions ?? matchedQuiz?.totalQuestions ?? 0
          ),
          dateFormatted: validDate.toLocaleString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
          })
        };
      })
      .filter((item) => {
        if (sourceFilter !== "all" && item.sourceType !== sourceFilter) return false;
        if (monthFilter !== "all" && item.month !== Number(monthFilter)) return false;
        if (selectedChapterId !== "all" && item.chapterId !== selectedChapterId) return false;
        if (selectedLessonId !== "all" && item.lessonId !== selectedLessonId) return false;
        if (
          selectedQuizId !== "all" &&
          String(item.quizId || item.quiz_id || "") !== selectedQuizId
        ) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = normalizeStr(searchQuery);
          const matchName = normalizeStr(item.studentDisplayName).includes(q);
          const matchExam = normalizeStr(item.examDisplayTitle).includes(q);
          const matchSbd = normalizeStr(item.detectedSbd).includes(q);
          if (!matchName && !matchExam && !matchSbd) return false;
        }
        return true;
      });
  }, [
    effectiveAttempts,
    allUnifiedQuizzes,
    sourceFilter,
    monthFilter,
    selectedChapterId,
    selectedLessonId,
    selectedQuizId,
    searchQuery
  ]);

  // IN DANH SÁCH SBD CỦA CẢ LỚP RA GIẤY A4
  const handlePrintSbdDirectory = () => {
    if (typeof window === "undefined") return;
    const win = window.open("", "_blank");
    if (!win) return;

    const rowsHtml = sbdDirectoryList
      .map(
        (stu) => `
        <tr>
          <td style="text-align:center; font-weight:bold;">${stu.stt}</td>
          <td style="text-align:center; font-weight:900; color:#1D4ED8; font-size:15px; letter-spacing:1px;">${stu.sbd}</td>
          <td style="font-weight:bold;">${stu.full_name}</td>
          <td>${stu.school}</td>
          <td style="text-align:center;">${stu.mode}</td>
        </tr>
      `
      )
      .join("");

    win.document.open();
    win.document.write(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8" />
        <title>Bảng Tra Cứu Số Báo Danh Lớp Học - TCT EduNexus</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
          h2 { margin: 0 0 6px 0; color: #1e3a8a; text-transform: uppercase; }
          p { margin: 0 0 16px 0; font-size: 13px; color: #475569; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
          th { background: #eff6ff; color: #1e40af; text-transform: uppercase; font-size: 11px; }
          tr:nth-child(even) { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h2>BẢNG TRA CỨU SỐ BÁO DANH (SBD) HỌC VIÊN — TÂM CHÍ TÀI EDUNEXUS</h2>
        <p>Học sinh dùng đúng 6 chữ số SBD của mình để tô vào mục 7 trên Phiếu trả lời trắc nghiệm A4.</p>
        <table>
          <thead>
            <tr>
              <th style="width:50px; text-align:center;">STT</th>
              <th style="width:130px; text-align:center;">SỐ BÁO DANH (6 SỐ)</th>
              <th>Họ và tên học sinh</th>
              <th>Trường THPT</th>
              <th style="width:90px; text-align:center;">Phân hệ</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `);
    win.document.close();
  };

  // XỬ LÝ QUÉT HÀNG LOẠT ẢNH PHIẾU TRONG TRƯỜNG HỢP CHẤM TRỰC TIẾP TẠI TAB NÀY
  const handleBatchFilesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !activeSelectedQuiz) return;

    setIsBatchProcessing(true);
    const fileArray = Array.from(files);
    const newlyGraded: any[] = [];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setBatchProgressText(
        `Đang quét & chấm phiếu ${i + 1}/${fileArray.length}: ${file.name}...`
      );

      try {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(String(ev.target?.result || ""));
          reader.readAsDataURL(file);
        });

        const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = dataUrl;
        });

        const canvas = document.createElement("canvas");
        canvas.width = imgEl.naturalWidth || imgEl.width || OMR_CANONICAL_WIDTH;
        canvas.height = imgEl.naturalHeight || imgEl.height || OMR_CANONICAL_HEIGHT;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        ctx.drawImage(imgEl, 0, 0);

        const omrRaw = scanOMRSheetFromCanvas(canvas, activeSelectedQuiz.rawQuizObj);
        const graded = gradeOMRSubmission(omrRaw, activeSelectedQuiz.rawQuizObj);

        // Đối soát học sinh tự động từ SBD quét được
        const matchedStudent =
          sbdToStudentMap.get(omrRaw.detected_sbd) ||
          sbdToStudentMap.get(String(parseInt(omrRaw.detected_sbd, 10))) ||
          null;

        const studentId = matchedStudent?.id || `sbd_${omrRaw.detected_sbd}`;
        const studentName =
          matchedStudent?.full_name || `Thí sinh SBD ${omrRaw.detected_sbd}`;
        const nowIso = new Date().toISOString();

        const attemptRecord: any = {
          id: `att-paper-bulk-${Date.now()}-${i}`,
          quiz_id: activeSelectedQuiz.id,
          quizId: activeSelectedQuiz.id,
          exam_id: activeSelectedQuiz.id,
          quiz_title: activeSelectedQuiz.title,
          quizTitle: activeSelectedQuiz.title,
          exam_title: activeSelectedQuiz.title,
          examTitle: activeSelectedQuiz.title,
          student_id: studentId,
          studentId: studentId,
          user_id: studentId,
          student_name: studentName,
          studentName: studentName,
          full_name: studentName,
          school: matchedStudent?.school || "THPT",
          score: graded.score,
          points: graded.score,
          total_questions: graded.totalQuestions,
          totalQuestions: graded.totalQuestions,
          correct_count: graded.correctCount,
          correctCount: graded.correctCount,
          time_spent: "Làm trên giấy",
          timeSpent: "Làm trên giấy",
          is_homework: activeSelectedQuiz.sourceType === "homework",
          isHomework: activeSelectedQuiz.sourceType === "homework",
          type: activeSelectedQuiz.sourceType,
          submission_type: "paper",
          paper_scan_url: graded.updatedOmrData.warped_image_data_url || dataUrl,
          omr_raw_data: graded.updatedOmrData,
          recognition_confidence: graded.updatedOmrData.confidence,
          flagged_questions: graded.updatedOmrData.flagged_questions,
          answers: graded.normalizedAnswers,
          userAnswers: graded.normalizedAnswers,
          user_answers: graded.normalizedAnswers,
          assigned_month: activeSelectedQuiz.assignedMonth,
          assigned_week: activeSelectedQuiz.assignedWeek,
          created_at: nowIso,
          createdAt: nowIso,
          submittedAt: nowIso
        };

        newlyGraded.push(attemptRecord);

        try {
          await fetch("/api/student/scan-paper", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attemptId: attemptRecord.id,
              examId: activeSelectedQuiz.id,
              examTitle: activeSelectedQuiz.title,
              studentId,
              studentName,
              school: matchedStudent?.school || "THPT",
              score: graded.score,
              totalQuestions: graded.totalQuestions,
              correctCount: graded.correctCount,
              isHomework: activeSelectedQuiz.sourceType === "homework",
              answers: graded.normalizedAnswers,
              omrData: graded.updatedOmrData,
              imageBase64: attemptRecord.paper_scan_url
            })
          });
        } catch {}
      } catch (err) {
        console.error("Lỗi chấm ảnh:", file.name, err);
      }
    }

    if (newlyGraded.length > 0) {
      const merged = [...newlyGraded, ...effectiveAttempts];
      if (typeof setAllAttempts === "function") {
        (setAllAttempts as any)(merged);
      }
      setLocalAttempts(merged);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("edunexus_attempts", JSON.stringify(merged));
          window.dispatchEvent(new Event("storage"));
        } catch {}
      }
      setBatchScannedResults((prev) => [...newlyGraded, ...prev]);
      if (showToast) {
        showToast(`Đã chấm tự động thành công ${newlyGraded.length} phiếu trả lời!`, "success");
      }
    }

    setIsBatchProcessing(false);
    setBatchProgressText("");
    e.target.value = "";
  };

  // LƯU ĐIỂM SỬA THỦ CÔNG KHI GIÁO VIÊN PHÚC KHẢO BÀI GIẤY
  const handleSaveInspectScore = async () => {
    if (!inspectingAttempt || isSavingScore) return;
    const newScore = Number(String(editScoreInput).replace(",", "."));
    if (isNaN(newScore) || newScore < 0 || newScore > 10) {
      alert("Vui lòng nhập điểm hợp lệ từ 0 đến 10!");
      return;
    }

    setIsSavingScore(true);
    const targetId = String(inspectingAttempt.id || "");

    const updatedList = effectiveAttempts.map((a: any) =>
      String(a?.id || "") === targetId ? { ...a, score: newScore, points: newScore } : a
    );

    if (typeof setAllAttempts === "function") {
      (setAllAttempts as any)(updatedList);
    }
    setLocalAttempts(updatedList);
    setInspectingAttempt((prev: any) =>
      prev ? { ...prev, score: newScore, scoreVal: newScore } : null
    );

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_attempts", JSON.stringify(updatedList));
        window.dispatchEvent(new Event("storage"));
      } catch {}
    }

    try {
      await Promise.allSettled([
        supabase
          .from("exam_attempts")
          .update({ score: newScore, points: newScore })
          .eq("id", targetId),
        supabase
          .from("quiz_results")
          .update({ score: newScore, points: newScore })
          .eq("id", targetId)
      ]);
    } catch {}

    setIsSavingScore(false);
    if (showToast) {
      showToast("Đã cập nhật điểm số bài thi giấy!", "success");
    }
  };

  // XÓA 1 BÀI THI GIẤY
  const handleDeletePaperAttempt = async (att: any) => {
    if (!confirm(`Xác nhận xóa bài nộp trên giấy của ${att.studentDisplayName}?`)) return;
    const targetId = String(att.id || "");
    const updated = effectiveAttempts.filter((a: any) => String(a?.id || "") !== targetId);

    if (typeof setAllAttempts === "function") {
      (setAllAttempts as any)(updated);
    }
    setLocalAttempts(updated);

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("edunexus_attempts", JSON.stringify(updated));
        window.dispatchEvent(new Event("storage"));
      } catch {}
    }

    try {
      await Promise.allSettled([
        supabase.from("exam_attempts").delete().eq("id", targetId),
        supabase.from("quiz_results").delete().eq("id", targetId)
      ]);
    } catch {}
  };

  const previewSvgPages = useMemo(() => {
    if (!showSheetPreviewModal || !activeSelectedQuiz) return [];
    return generatePrintableAnswerSheetPagesSVG({
      ...activeSelectedQuiz.rawQuizObj,
      examTitle: activeSelectedQuiz.title,
      examCode: activeSelectedQuiz.examCode
    });
  }, [showSheetPreviewModal, activeSelectedQuiz]);

  return (
    <div className="space-y-5 max-w-6xl mx-auto text-left font-sans animate-in fade-in duration-200">
      {/* 1. BANNER & 3 NÚT CÔNG CỤ NGHIỆP VỤ TRUNG TÂM */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shrink-0">
              <ScanLine className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-black uppercase tracking-wider">
                  TRUNG TÂM KHẢO THÍ OMR
                </span>
                <span className="text-xs font-bold text-emerald-600">
                  • Đã đồng bộ {allUnifiedQuizzes.length} đề (BTVN, Đề KT & Luyện đề)
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-0.5">
                Chấm thi & Quản lý Bài làm trên Giấy (AI OMR)
              </h2>
            </div>
          </div>

          {/* 3 NÚT CHỨC NĂNG TRUNG TÂM */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowSbdDirectoryModal(true)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200/80 text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Users className="w-4 h-4 text-[#1D4ED8]" />
              <span>📋 Bảng SBD Lớp ({sbdDirectoryList.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSheetPreviewModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>📄 Xuất phiếu in theo bài đã chọn</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (typeof onOpenBulkScannerModal === "function") {
                  onOpenBulkScannerModal(activeSelectedQuiz?.rawQuizObj || activeSelectedQuiz);
                } else {
                  setShowInternalBulkScanner(true);
                }
              }}
              className="px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>📷 Chấm bài thi giấy cả lớp</span>
            </button>
          </div>
        </div>

        {/* 2. THANH LỌC NGUỒN BÀI ĐA TẦNG (BTVN | ĐỀ KT | LUYỆN ĐỀ + THÁNG + CHƯƠNG/BÀI) */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-[#1D4ED8]" /> Nguồn bài:
              </span>
              {[
                { key: "all", label: "Tất cả nguồn", icon: FileText },
                { key: "homework", label: "Bài tập về nhà (BTVN)", icon: BookOpen },
                { key: "test", label: "Đề kiểm tra định kỳ", icon: Award },
                { key: "practice", label: "Kho Luyện đề thực chiến", icon: Target }
              ].map((item) => {
                const Icon = item.icon;
                const active = sourceFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSourceFilter(item.key as any);
                      setSelectedQuizId("all");
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                      active
                        ? "bg-[#1D4ED8] text-white shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* LỌC THEO THÁNG */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500">Tháng:</span>
              <select
                value={monthFilter}
                onChange={(e) => {
                  setMonthFilter(e.target.value);
                  setSelectedQuizId("all");
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-black text-[#1D4ED8] outline-none cursor-pointer"
              >
                <option value="all">Tất cả tháng</option>
                {[8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7].map((m) => (
                  <option key={m} value={String(m)}>
                    Tháng {m < 10 ? "0" + m : m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* CHỌN CHƯƠNG -> BÀI HỌC -> ĐỀ CỤ THỂ ĐỂ IN PHIẾU HOẶC CHẤM ĐIỂM */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-1">
            {sourceFilter !== "practice" && (
              <>
                <div className="md:col-span-3">
                  <select
                    value={selectedChapterId}
                    onChange={(e) => {
                      setSelectedChapterId(e.target.value);
                      setSelectedLessonId("all");
                      setSelectedQuizId("all");
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:border-[#1D4ED8] cursor-pointer"
                  >
                    <option value="all">-- Tất cả Chương học --</option>
                    {(chapters || []).map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <select
                    value={selectedLessonId}
                    onChange={(e) => {
                      setSelectedLessonId(e.target.value);
                      setSelectedQuizId("all");
                    }}
                    disabled={selectedChapterId === "all"}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:border-[#1D4ED8] disabled:opacity-50 cursor-pointer"
                  >
                    <option value="all">-- Tất cả Bài học --</option>
                    {lessonsInSelectedChapter.map((l: any) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className={sourceFilter === "practice" ? "md:col-span-8" : "md:col-span-6"}>
              <select
                value={activeSelectedQuiz?.id || "all"}
                onChange={(e) => setSelectedQuizId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-purple-50/70 border border-purple-200 text-xs font-black text-purple-900 outline-none focus:border-purple-600 cursor-pointer"
              >
                {filteredQuizzes.length === 0 ? (
                  <option value="all">-- Không có bài thi nào trong bộ lọc này --</option>
                ) : (
                  filteredQuizzes.map((q) => (
                    <option key={q.id} value={q.id}>
                      [{q.sourceLabel} • Mã đề {q.examCode}] {q.title} ({q.totalQuestions} câu: P1={q.part1Count}, P2={q.part2Count}, P3={q.part3Count})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. BẢNG TỔNG HỢP ĐIỂM BÀI THI TRÊN GIẤY & PHÚC KHẢO */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-600" />
            <h3 className="font-extrabold text-slate-900 text-sm">
              Danh sách Bài thi trên Giấy đã chấm ({paperSubmissionsList.length} bài)
            </h3>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm học sinh, SBD, tên đề..."
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-purple-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-white text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 text-center w-12">STT</th>
                <th className="py-3 px-4">Học sinh</th>
                <th className="py-3 px-3 text-center">SBD</th>
                <th className="py-3 px-4">Tên bài thi & Nguồn</th>
                <th className="py-3 px-3 text-center">Mã đề</th>
                <th className="py-3 px-3 text-center">Câu đúng</th>
                <th className="py-3 px-3 text-center">Điểm số</th>
                <th className="py-3 px-3 text-center">Trạng thái OMR</th>
                <th className="py-3 px-4 text-right">Phúc khảo & Sửa điểm</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paperSubmissionsList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400 italic">
                    Chưa có bài làm trên giấy nào trong bộ lọc này. Hãy bấm <strong>"📷 Chấm bài thi giấy cả lớp"</strong> để quét phiếu của học sinh.
                  </td>
                </tr>
              ) : (
                paperSubmissionsList.map((item, idx) => {
                  const hasWarning = item.flaggedList && item.flaggedList.length > 0;
                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div>{item.studentDisplayName}</div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {item.dateFormatted}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-black text-[11px] border border-slate-200">
                          {item.detectedSbd}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800">{item.examDisplayTitle}</div>
                        <span
                          className={`inline-block mt-0.5 px-2 py-0.2 rounded text-[9px] font-black uppercase border ${
                            item.sourceType === "homework"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : item.sourceType === "test"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }`}
                        >
                          {item.sourceLabel}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-black text-[#1D4ED8]">
                        {item.detectedCode}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">
                        {item.correctVal}/{item.totalQVal || "--"}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 font-black text-xs">
                          {item.scoreVal.toFixed(2)}đ
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {hasWarning ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-bold"
                            title={`Các câu nghi ngờ tẩy lem: Câu ${item.flaggedList.join(", ")}`}
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Lem chì ({item.flaggedList.length} câu)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" /> Hợp lệ
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setZoomScale(1);
                              setEditScoreInput(item.scoreVal.toFixed(2));
                              setInspectingAttempt(item);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-600 text-purple-700 hover:text-white border border-purple-200 text-[11px] font-bold transition inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Xem phiếu & Sửa điểm</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePaperAttempt(item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Xóa bài nộp này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: XEM TRƯỚC & IN PHIẾU TRẢ LỜI A4 ĐỘNG THEO BÀI ĐÃ CHỌN */}
      {/* ===================================================================== */}
      {showSheetPreviewModal && activeSelectedQuiz && (
        <div
          onClick={() => setShowSheetPreviewModal(false)}
          className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-4xl w-full max-h-[94vh] border border-slate-200 shadow-2xl flex flex-col overflow-hidden cursor-default"
          >
            <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block">
                  MẪU PHIẾU A4 TỰ ĐỘNG CO GIÃN & BẺ TRANG ({previewSvgPages.length} TRANG A4)
                </span>
                <h3 className="text-sm font-bold text-white">
                  {activeSelectedQuiz.title} — Mã đề: {activeSelectedQuiz.examCode} ({activeSelectedQuiz.totalQuestions} câu)
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openPrintableDynamicAnswerSheet({
                      ...activeSelectedQuiz.rawQuizObj,
                      examTitle: activeSelectedQuiz.title,
                      examCode: activeSelectedQuiz.examCode
                    })
                  }
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> Mở cửa sổ In / Lưu PDF chuẩn A4
                </button>
                <button
                  type="button"
                  onClick={() => setShowSheetPreviewModal(false)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/80 space-y-6 custom-scrollbar flex flex-col items-center">
              {previewSvgPages.map((svgMarkup, idx) => (
                <div
                  key={idx}
                  className="w-full max-w-[760px] bg-white rounded-xl shadow-xl border border-slate-300 overflow-hidden"
                >
                  <div className="px-4 py-1.5 bg-slate-800 text-slate-200 text-[11px] font-bold flex justify-between">
                    <span>Trang {idx + 1} / {previewSvgPages.length}</span>
                    <span>Chuẩn khổ A4 (4 góc định vị độc lập)</span>
                  </div>
                  <div
                    className="w-full"
                    dangerouslySetInnerHTML={{ __html: svgMarkup }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: BẢNG TRA CỨU SỐ BÁO DANH (SBD) CẢ LỚP */}
      {/* ===================================================================== */}
      {showSbdDirectoryModal && (
        <div
          onClick={() => setShowSbdDirectoryModal(false)}
          className="fixed inset-0 z-[500] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[88vh] border border-slate-200 shadow-2xl flex flex-col overflow-hidden cursor-default"
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-900">
                  Bảng Tra Cứu Số Báo Danh (SBD) Học Viên ({sbdDirectoryList.length} bạn)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Khi chấm phiếu giấy, AI OMR đọc 6 số ở mục 7 để tự động gắn điểm vào đúng tên học sinh.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintSbdDirectory}
                  className="px-3.5 py-2 rounded-xl bg-[#1D4ED8] hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" /> In bảng SBD
                </button>
                <button
                  type="button"
                  onClick={() => setShowSbdDirectoryModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-14">STT</th>
                    <th className="py-2.5 px-3 text-center w-32">SBD (6 chữ số)</th>
                    <th className="py-2.5 px-4">Họ và tên học sinh</th>
                    <th className="py-2.5 px-3">Trường</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sbdDirectoryList.map((stu) => (
                    <tr key={stu.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-center font-bold text-slate-400">{stu.stt}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="px-2.5 py-0.5 rounded bg-blue-50 text-[#1D4ED8] border border-blue-200 font-mono font-black text-xs">
                          {stu.sbd}
                        </span>
                      </td>
                      <td className="py-2 px-4 font-bold text-slate-800">{stu.full_name}</td>
                      <td className="py-2 px-3 text-slate-500">{stu.school}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: CHẤM BÀI THI GIẤY HÀNG LOẠT CHO CẢ LỚP */}
      {/* ===================================================================== */}
      {showInternalBulkScanner && (
        <div
          onClick={() => setShowInternalBulkScanner(false)}
          className="fixed inset-0 z-[500] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-2xl w-full p-6 border border-slate-200 shadow-2xl space-y-4 cursor-default"
          >
            <input
              ref={batchFileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleBatchFilesUpload}
            />

            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-purple-600 block">
                  CHẤM PHIẾU TRẮC NGHIỆM HÀNG LOẠT (AI OMR)
                </span>
                <h3 className="text-base font-black text-slate-900">
                  Đang chấm cho bài: {activeSelectedQuiz?.title || "Chưa chọn bài"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInternalBulkScanner(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              onClick={() => !isBatchProcessing && batchFileInputRef.current?.click()}
              className="p-8 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50/40 hover:bg-purple-50 transition text-center space-y-3 cursor-pointer"
            >
              {isBatchProcessing ? (
                <div className="space-y-2 py-4">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto" />
                  <p className="text-xs font-extrabold text-purple-900">{batchProgressText}</p>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center mx-auto shadow-md">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      Bấm để chọn nhiều ảnh chụp phiếu trả lời của cả lớp
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Hệ thống tự động căn 4 góc đen (chống bắt nhầm bàn tay), đọc SBD 6 số để nhận diện học sinh và chấm điểm tức thì.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: XEM PHIẾU GỐC CÓ VIỀN XANH / ĐỎ & CHỈNH SỬA ĐIỂM TRỰC TIẾP */}
      {/* ===================================================================== */}
      {inspectingAttempt && (
        <div
          onClick={() => setInspectingAttempt(null)}
          className="fixed inset-0 z-[550] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[94vh] border border-slate-700 shadow-2xl flex flex-col overflow-hidden cursor-default"
          >
            <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-purple-600 text-white text-[10px] font-black uppercase">
                    PHÚC KHẢO BÀI GIẤY OMR
                  </span>
                  <span className="text-xs text-slate-300 font-bold">
                    SBD: {inspectingAttempt.detectedSbd} • Mã đề: {inspectingAttempt.detectedCode}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mt-0.5">
                  {inspectingAttempt.studentDisplayName} — {inspectingAttempt.examDisplayTitle}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                  <span className="text-xs font-bold text-slate-300">Điểm:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={editScoreInput}
                    onChange={(e) => setEditScoreInput(e.target.value)}
                    className="w-14 bg-slate-950 text-white font-black text-xs text-center py-1 rounded border border-slate-600 outline-none focus:border-blue-400"
                  />
                  <button
                    type="button"
                    disabled={isSavingScore}
                    onClick={handleSaveInspectScore}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Lưu điểm
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.max(0.8, Number((z - 0.25).toFixed(2))))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale((z) => Math.min(2.2, Number((z + 0.25).toFixed(2))))}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingAttempt(null)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5 custom-scrollbar flex items-start justify-center bg-slate-900">
              {inspectingAttempt.paperScanUrl ? (
                <div
                  style={{
                    width: `${Math.round(560 * zoomScale)}px`,
                    transition: "width 0.18s ease-out"
                  }}
                  className="relative rounded-xl overflow-hidden border border-slate-700 bg-white shadow-2xl shrink-0"
                >
                  <img
                    src={inspectingAttempt.paperScanUrl}
                    alt="Phiếu thi gốc của học sinh"
                    className="w-full h-auto block"
                  />
                  {inspectingAttempt.omr_raw_data?.bubble_coordinates && (
                    <svg
                      viewBox={`0 0 ${
                        inspectingAttempt.omr_raw_data.canonical_width || OMR_CANONICAL_WIDTH
                      } ${
                        inspectingAttempt.omr_raw_data.canonical_height || OMR_CANONICAL_HEIGHT
                      }`}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    >
                      {inspectingAttempt.omr_raw_data.bubble_coordinates
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
                <div className="py-12 text-center text-slate-400 text-xs">
                  Không tìm thấy ảnh quét của lượt nộp này.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
