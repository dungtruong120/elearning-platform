"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ArrowLeft,
  Clock,
  Send,
  FileText,
  Eraser,
  Printer,
  Loader2,
} from "lucide-react";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  Profile,
  ExamAttempt,
  OMRResultData,
  OMRBubbleCoordinate,
} from "@/types";
import {
  buildDynamicOMRBlueprint,
  gradeOMRSubmission,
  openPrintableDynamicAnswerSheet,
  formatStudentAutoSBD,
  deriveExamCode3Digits,
  resolveCompleteExamObject,
  OMR_CANONICAL_WIDTH,
  OMR_CANONICAL_HEIGHT,
  CANONICAL_CORNER_TARGETS,
} from "@/lib/omrEngine";
import { PaperReviewView } from "@/components/student/paper/PaperReviewView";
import { supabase } from "@/lib/supabaseClient";

export interface DigitalAnswerSheetViewProps {
  exam: any;
  profile: Profile;
  isHomework?: boolean;
  onBack: () => void;
  onSubmitted?: (attempt: ExamAttempt) => void;
}

function sanitizeLatexForDigitalView(tex: string): string {
  if (!tex) return "";
  return String(tex)
    .replace(/\\in\s+fty/gi, "\\infty")
    .replace(/\\inftyminus/gi, "\\infty -")
    .replace(/\\inftyplus/gi, "\\infty +")
    .replace(
      /(\\infty|\\cup|\\cap|\\notin|\\subseteq|\\subset(?![a-zA-Z])|\\in(?![a-zA-Z])|\\forall|\\exists|\\rightarrow|\\Rightarrow|\\Leftrightarrow)([a-zA-Z])/g,
      "$1 $2"
    );
}

function DigitalQuestionMath({ content }: { content?: string }) {
  const html = useMemo(() => {
    if (!content) return "";
    let str = sanitizeLatexForDigitalView(String(content));
    str = str.replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => "$$" + m + "$$");
    str = str.replace(/\\\(([\s\S]*?)\\\)/g, (_, m) => "$" + m + "$");

    str = str.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
      try {
        return katex.renderToString(tex.trim(), {
          displayMode: true,
          throwOnError: false,
        });
      } catch {
        return `$$${tex}$$`;
      }
    });

    str = str.replace(/\$([^$\n]+?)\$/g, (m, tex) => {
      try {
        return katex.renderToString(tex.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch {
        return m;
      }
    });

    if (!/<(p|div|table|ul|ol|br|img)/i.test(str)) {
      str = str.replace(/\n/g, "<br/>");
    }
    return str;
  }, [content]);

  if (!content) return null;
  return (
    <div
      className="leading-relaxed break-words text-xs sm:text-[13.5px] text-slate-800"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function DigitalAnswerSheetView({
  exam,
  profile,
  isHomework = false,
  onBack,
  onSubmitted,
}: DigitalAnswerSheetViewProps) {
  // Tự động nạp đầy đủ câu hỏi của đề thi (kể cả đề BTVN Tổng Ôn > 100 câu)
  const resolvedExam = useMemo(() => resolveCompleteExamObject(exam), [exam]);
  const blueprint = useMemo(
    () => buildDynamicOMRBlueprint(resolvedExam),
    [resolvedExam]
  );

  const p1Count = blueprint.part1TotalQuestions ?? 40;
  const p2Count = blueprint.part2TotalQuestions ?? 8;
  const p3Count = blueprint.part3TotalQuestions ?? 6;
  const totalQuestionsCount = p1Count + p2Count + p3Count;

  // Chuẩn hóa SBD 6 chữ số khớp 100% với Bảng SBD Lớp của Admin
  const defaultSbd = useMemo(() => {
    return formatStudentAutoSBD(profile);
  }, [profile]);

  const defaultExamCode = useMemo(() => {
    return deriveExamCode3Digits(resolvedExam);
  }, [resolvedExam]);

  // STATE CÁC Ô TÔ TRÊN PHIẾU ĐIỆN TỬ
  const [sbdCols, setSbdCols] = useState<string[]>(() => defaultSbd.split(""));
  const [examCodeCols, setExamCodeCols] = useState<string[]>(() =>
    defaultExamCode.split("")
  );

  // Phần I: Câu 1..p1Count -> 'A' | 'B' | 'C' | 'D' | ''
  const [part1Selections, setPart1Selections] = useState<Record<number, string>>({});

  // Phần II: Câu 1..p2Count -> { a: boolean | null, b: boolean | null, c: boolean | null, d: boolean | null }
  const [part2Selections, setPart2Selections] = useState<
    Record<number, Record<"a" | "b" | "c" | "d", boolean | null>>
  >({});

  // Phần III: Câu 1..p3Count -> 4 cột ký tự ['', '', '', '']
  const [part3Selections, setPart3Selections] = useState<Record<number, string[]>>({});

  const [leftTabMode, setLeftTabMode] = useState<"questions" | "pdf">("questions");
  const durationMinutes = isHomework
    ? 0
    : Number(resolvedExam?.duration_minutes || resolvedExam?.duration || 45);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() =>
    durationMinutes > 0 ? durationMinutes * 60 : 0
  );
  const [timeSpentSeconds, setTimeSpentSeconds] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [completedAttempt, setCompletedAttempt] = useState<ExamAttempt | null>(null);

  // Tách danh sách câu hỏi phẳng từ resolvedExam để hiển thị bên cột trái
  const flatQuestionsList = useMemo(() => {
    const rawSections =
      resolvedExam?.data ||
      resolvedExam?.sections ||
      (Array.isArray(resolvedExam?.questions)
        ? [{ questions: resolvedExam.questions }]
        : []);

    const list: {
      order: number;
      part: 1 | 2 | 3;
      localOrder: number;
      prompt: string;
      options: any[];
    }[] = [];

    let p1 = 0;
    let p2 = 0;
    let p3 = 0;
    let orderCounter = 0;

    if (Array.isArray(rawSections)) {
      rawSections.forEach((sec: any) => {
        const secType =
          sec?.section_type ||
          sec?.type ||
          (sec?.section_title && /đúng\s*sai/i.test(sec.section_title)
            ? "true_false"
            : sec?.section_title && /trả\s*lời\s*ngắn|điền/i.test(sec.section_title)
            ? "short_answer"
            : "multiple_choice");

        (sec?.questions || []).forEach((q: any) => {
          orderCounter++;
          const rawCorrect = String(
            q?.correct_answer ?? q?.correctAnswer ?? "A"
          ).trim();
          const cleanAns = rawCorrect
            .replace(/[^A-Za-zĐđSsTtFf]/g, "")
            .toUpperCase();
          const isTF =
            q?.type === "true_false" ||
            secType === "true_false" ||
            (["Đ", "S", "T", "F"].includes(cleanAns[0]) && cleanAns.length >= 2) ||
            (Array.isArray(q?.options) &&
              q.options.length > 0 &&
              typeof q.options[0]?.is_true_false_ans === "boolean");
          const isShort =
            !isTF &&
            (q?.type === "short_answer" ||
              secType === "short_answer" ||
              !Array.isArray(q?.options) ||
              q.options.length === 0);

          if (isTF) {
            p2++;
            list.push({
              order: orderCounter,
              part: 2,
              localOrder: p2,
              prompt: q.prompt_html || q.prompt || q.text || `Câu ${orderCounter}`,
              options: Array.isArray(q.options) ? q.options : [],
            });
          } else if (isShort) {
            p3++;
            list.push({
              order: orderCounter,
              part: 3,
              localOrder: p3,
              prompt: q.prompt_html || q.prompt || q.text || `Câu ${orderCounter}`,
              options: [],
            });
          } else {
            p1++;
            list.push({
              order: orderCounter,
              part: 1,
              localOrder: p1,
              prompt: q.prompt_html || q.prompt || q.text || `Câu ${orderCounter}`,
              options: Array.isArray(q.options) ? q.options : [],
            });
          }
        });
      });
    }
    return list;
  }, [resolvedExam]);

  // Đồng hồ đếm giờ
  useEffect(() => {
    if (completedAttempt || isSubmitting) return;
    const timer = setInterval(() => {
      setTimeSpentSeconds((prev) => prev + 1);
      if (!isHomework && durationMinutes > 0) {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleSubmitDigitalSheet();
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [completedAttempt, isSubmitting, isHomework, durationMinutes]);

  // Đếm tổng số câu đã tô
  const answeredTotalCount = useMemo(() => {
    const c1 = Object.values(part1Selections).filter(Boolean).length;
    const c2 = Object.values(part2Selections).filter(
      (sub) => sub && Object.values(sub).some((v) => v !== null && v !== undefined)
    ).length;
    const c3 = Object.values(part3Selections).filter(
      (cols) => Array.isArray(cols) && cols.some((ch) => Boolean(ch))
    ).length;
    return c1 + c2 + c3;
  }, [part1Selections, part2Selections, part3Selections]);

  // Xử lý click tô / tẩy ô Phần I
  const togglePart1Bubble = (qNum: number, optKey: string) => {
    setPart1Selections((prev) => ({
      ...prev,
      [qNum]: prev[qNum] === optKey ? "" : optKey,
    }));
  };

  // Xử lý click tô / tẩy ô Phần II (Đúng / Sai)
  const togglePart2Bubble = (
    qNum: number,
    subKey: "a" | "b" | "c" | "d",
    val: boolean
  ) => {
    setPart2Selections((prev) => {
      const currentQ = prev[qNum] || { a: null, b: null, c: null, d: null };
      const currentSubVal = currentQ[subKey];
      return {
        ...prev,
        [qNum]: {
          ...currentQ,
          [subKey]: currentSubVal === val ? null : val,
        },
      };
    });
  };

  // Xử lý click tô / tẩy ô Phần III (Lưới trả lời ngắn 4 cột)
  const togglePart3Bubble = (qNum: number, colIdx: number, charKey: string) => {
    setPart3Selections((prev) => {
      const currentCols = prev[qNum] ? [...prev[qNum]] : ["", "", "", ""];
      currentCols[colIdx] = currentCols[colIdx] === charKey ? "" : charKey;
      return {
        ...prev,
        [qNum]: currentCols,
      };
    });
  };

  // Xử lý tẩy toàn bộ phiếu
  const handleClearAllBubbles = () => {
    if (!confirm("Bạn có chắc muốn tẩy trắng toàn bộ các ô đã tô trên phiếu?"))
      return;
    setPart1Selections({});
    setPart2Selections({});
    setPart3Selections({});
  };

  // Sinh ảnh Canvas mô phỏng tờ phiếu đã tô chì để lưu vào paper_scan_url phục vụ xem lại
  const renderFilledDigitalSheetDataUrl = useCallback(
    (bubbleCoords: OMRBubbleCoordinate[]): string => {
      if (typeof document === "undefined") return "";
      const canvas = document.createElement("canvas");
      canvas.width = OMR_CANONICAL_WIDTH;
      canvas.height = OMR_CANONICAL_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";

      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, OMR_CANONICAL_WIDTH, OMR_CANONICAL_HEIGHT);

      // Vẽ 4 mốc góc đen
      ctx.fillStyle = "#000000";
      [
        CANONICAL_CORNER_TARGETS.topLeft,
        CANONICAL_CORNER_TARGETS.topRight,
        CANONICAL_CORNER_TARGETS.bottomRight,
        CANONICAL_CORNER_TARGETS.bottomLeft,
      ].forEach((pt) => {
        ctx.fillRect(pt.x - 14, pt.y - 14, 28, 28);
      });

      // Vẽ tiêu đề
      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 24px Arial";
      ctx.textAlign = "center";
      ctx.fillText("PHIẾU TRẢ LỜI TRẮC NGHIỆM ĐIỆN TỬ", 420, 92);
      ctx.fillStyle = "#1D4ED8";
      ctx.font = "bold 14px Arial";
      ctx.fillText(String(resolvedExam?.title || "ĐỀ THI EDUNEXUS"), 420, 122);

      ctx.textAlign = "left";
      ctx.fillStyle = "#334155";
      ctx.font = "bold 13px Arial";
      ctx.fillText(`Thí sinh: ${profile?.full_name || "Học sinh"}`, 80, 210);
      ctx.fillText(`Số báo danh: ${sbdCols.join("")}`, 80, 240);
      ctx.fillText(`Mã đề thi: ${examCodeCols.join("")}`, 80, 270);

      // Vẽ các ô tròn và tô chì những ô đã chọn
      bubbleCoords.forEach((b) => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        if (b.isSelected) {
          ctx.fillStyle = "#1E293B";
          ctx.fill();
        } else {
          ctx.strokeStyle = "#94A3B8";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      });

      return canvas.toDataURL("image/jpeg", 0.88);
    },
    [resolvedExam?.title, profile?.full_name, sbdCols, examCodeCols]
  );

  // NỘP PHIẾU TÔ ONLINE -> CHẤM BẰNG OMR ENGINE VÀ MỞ MÀN HÌNH ĐỐI SOÁT
  const handleSubmitDigitalSheet = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const coords: OMRBubbleCoordinate[] = [];
    const optKeys = ["A", "B", "C", "D"];

    // 1. Phần I (Hỗ trợ đầy đủ mọi câu hỏi 1..p1Count, kể cả > 100 câu)
    blueprint.part1.blocks.forEach((block) => {
      for (let q = block.startQuestion; q <= block.endQuestion; q++) {
        const rIdx = q - block.startQuestion;
        const cy = block.startY + rIdx * block.rowStepY;
        const picked = part1Selections[q] || "";
        optKeys.forEach((k, idx) => {
          const cx = block.startX + idx * block.optionStepX;
          const isSel = picked === k;
          coords.push({
            id: `p1-q${q}-${k}`,
            section: "part1",
            questionNumber: q,
            optionKey: k,
            x: cx,
            y: cy,
            r: block.radius,
            density: isSel ? 0.92 : 0.05,
            isSelected: isSel,
            status: isSel ? "detected" : "unfilled",
          });
        });
      }
    });

    // 2. Phần II
    const subKeys: ("a" | "b" | "c" | "d")[] = ["a", "b", "c", "d"];
    blueprint.part2.blocks.forEach((block) => {
      const q = block.questionNumber;
      const qMap = part2Selections[q] || { a: null, b: null, c: null, d: null };
      subKeys.forEach((sk, idx) => {
        const cy = block.startY + idx * block.rowStepY;
        const val = qMap[sk];
        coords.push({
          id: `p2-q${q}-${sk}-T`,
          section: "part2",
          questionNumber: q,
          subKey: sk,
          optionKey: "T",
          x: block.trueX,
          y: cy,
          r: block.radius,
          density: val === true ? 0.92 : 0.05,
          isSelected: val === true,
          status: val === true ? "detected" : "unfilled",
        });
        coords.push({
          id: `p2-q${q}-${sk}-F`,
          section: "part2",
          questionNumber: q,
          subKey: sk,
          optionKey: "F",
          x: block.falseX,
          y: cy,
          r: block.radius,
          density: val === false ? 0.92 : 0.05,
          isSelected: val === false,
          status: val === false ? "detected" : "unfilled",
        });
      });
    });

    // 3. Phần III
    const p3StringAnswers: Record<number, string> = {};
    blueprint.part3.blocks.forEach((block) => {
      const q = block.questionNumber;
      const cols = part3Selections[q] || ["", "", "", ""];
      p3StringAnswers[q] = cols.join("");

      for (let c = 0; c < 4; c++) {
        const cx = block.startX + c * block.colStepX;
        const pickedChar = cols[c] || "";
        if (c === 0) {
          const isMinus = pickedChar === "-";
          coords.push({
            id: `p3-q${q}-c${c}--`,
            section: "part3",
            questionNumber: q,
            subKey: String(c),
            optionKey: "-",
            x: cx,
            y: block.minusY,
            r: block.radius,
            density: isMinus ? 0.92 : 0.05,
            isSelected: isMinus,
            status: isMinus ? "detected" : "unfilled",
          });
        }
        if (c === 1 || c === 2) {
          const isComma = pickedChar === ",";
          coords.push({
            id: `p3-q${q}-c${c}-,`,
            section: "part3",
            questionNumber: q,
            subKey: String(c),
            optionKey: ",",
            x: cx,
            y: block.commaY,
            r: block.radius,
            density: isComma ? 0.92 : 0.05,
            isSelected: isComma,
            status: isComma ? "detected" : "unfilled",
          });
        }
        for (let d = 0; d <= 9; d++) {
          const cy = block.digit0Y + d * block.rowStepY;
          const isDigit = pickedChar === String(d);
          coords.push({
            id: `p3-q${q}-c${c}-${d}`,
            section: "part3",
            questionNumber: q,
            subKey: String(c),
            optionKey: String(d),
            x: cx,
            y: cy,
            r: block.radius,
            density: isDigit ? 0.92 : 0.05,
            isSelected: isDigit,
            status: isDigit ? "detected" : "unfilled",
          });
        }
      }
    });

    const syntheticSheetUrl = renderFilledDigitalSheetDataUrl(coords);

    const omrPayload: OMRResultData = {
      detected_sbd: sbdCols.join("") || defaultSbd,
      detected_exam_code: examCodeCols.join("") || defaultExamCode,
      confidence: 100,
      warp_matrix_applied: true,
      canonical_width: OMR_CANONICAL_WIDTH,
      canonical_height: OMR_CANONICAL_HEIGHT,
      warped_image_data_url: syntheticSheetUrl,
      part1_answers: part1Selections,
      part2_answers: part2Selections,
      part3_answers: p3StringAnswers,
      flagged_questions: [],
      bubble_coordinates: coords,
    };

    const graded = gradeOMRSubmission(omrPayload, resolvedExam);
    const nowIso = new Date().toISOString();
    const durationStr =
      Math.floor(timeSpentSeconds / 60) +
      "p " +
      (timeSpentSeconds % 60) +
      "s (Phiếu Onl)";

    const studentId = String(profile?.id || profile?.username || "student");
    const studentName = String(
      profile?.full_name || profile?.username || "Học sinh"
    );
    const quizId = String(resolvedExam?.id || "quiz-digital");
    const quizTitle = String(resolvedExam?.title || "Đề thi Phiếu Online");

    const attemptRecord: ExamAttempt = {
      id: "att-paper-onl-" + Date.now(),
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
      score: graded.score,
      points: graded.score,
      total_questions: graded.totalQuestions,
      totalQuestions: graded.totalQuestions,
      correct_count: graded.correctCount,
      correctCount: graded.correctCount,
      time_spent: durationStr,
      timeSpent: durationStr,
      duration_seconds: timeSpentSeconds,
      is_homework: Boolean(isHomework),
      isHomework: Boolean(isHomework),
      type: isHomework ? "homework" : "practice",
      submission_type: "paper",
      paper_scan_url: syntheticSheetUrl,
      omr_raw_data: graded.updatedOmrData,
      recognition_confidence: 100,
      flagged_questions: [],
      answers: graded.normalizedAnswers,
      userAnswers: graded.normalizedAnswers,
      user_answers: graded.normalizedAnswers,
      created_at: nowIso,
      createdAt: nowIso,
      submittedAt: nowIso,
    };

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("edunexus_attempts");
        const parsed = saved ? JSON.parse(saved) : [];
        localStorage.setItem(
          "edunexus_attempts",
          JSON.stringify([attemptRecord, ...parsed])
        );
        window.dispatchEvent(new Event("storage"));
      } catch {}
    }

    try {
      await fetch("/api/student/scan-paper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: attemptRecord.id,
          examId: quizId,
          examTitle: quizTitle,
          studentId,
          studentName,
          school: profile?.school || "THPT",
          score: graded.score,
          totalQuestions: graded.totalQuestions,
          correctCount: graded.correctCount,
          isHomework,
          answers: graded.normalizedAnswers,
          omrData: graded.updatedOmrData,
          imageBase64: syntheticSheetUrl,
        }),
      });
    } catch {}

    try {
      await Promise.allSettled([
        supabase.from("exam_attempts").insert([attemptRecord]),
        supabase.from("attempts").insert([attemptRecord]),
      ]);
    } catch {}

    setIsSubmitting(false);
    setCompletedAttempt(attemptRecord);
    if (onSubmitted) {
      onSubmitted(attemptRecord);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  };

  // NẾU ĐÃ NỘP PHIẾU -> MỞ NGAY MÀN HÌNH XEM LẠI BÀI CHẤM TRÊN PHIẾU (PAPER REVIEW VIEW)
  if (completedAttempt) {
    return (
      <PaperReviewView
        attempt={completedAttempt}
        exam={resolvedExam}
        profile={profile}
        onBack={onBack}
      />
    );
  }

  const pdfEmbedUrl = resolvedExam?.driveUrl || resolvedExam?.url || "";

  return (
    <div className="fixed inset-0 z-[140] bg-[#F1F5F9] flex flex-col overflow-hidden font-sans text-left text-slate-800">
      {/* 1. HEADER THANH CÔNG CỤ LÀM BÀI */}
      <header className="h-14 sm:h-15 px-3 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-3 shrink-0 shadow-2xs z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (
                confirm(
                  "Bạn có chắc muốn thoát khỏi Phiếu tô trắc nghiệm Online?"
                )
              ) {
                onBack();
              }
            }}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider shrink-0">
                📝 PHIẾU TÔ ONLINE
              </span>
              <h2 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                {resolvedExam?.title || "Phiếu trả lời trắc nghiệm Bộ GD&ĐT"}
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 font-semibold truncate">
              Thí sinh:{" "}
              <strong className="text-slate-800">{profile?.full_name}</strong>{" "}
              (SBD: <strong className="text-emerald-700">{sbdCols.join("")}</strong>) • Đã
              tô:{" "}
              <strong className="text-[#1D4ED8]">
                {answeredTotalCount}/{totalQuestionsCount} câu
              </strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-[#1D4ED8] text-xs font-black tabular-nums flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {isHomework || durationMinutes === 0
                ? formatTimer(timeSpentSeconds)
                : formatTimer(secondsRemaining)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClearAllBubbles}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            title="Tẩy toàn bộ các ô đã tô"
          >
            <Eraser className="w-3.5 h-3.5" /> Tẩy phiếu
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmitDigitalSheet}
            className="px-4 py-2 rounded-xl bg-[#1D4ED8] hover:bg-[#1E40AF] text-white text-xs font-black shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang chấm OMR...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>
                  Nộp phiếu ({answeredTotalCount}/{totalQuestionsCount})
                </span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* 2. SPLIT-SCREEN 2 CỘT: CỘT TRÁI (ĐỀ THI) - CỘT PHẢI (TỜ PHIẾU TRẮC NGHIỆM BỘ GD&ĐT TƯƠNG TÁC) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
        {/* CỘT TRÁI (6 CỘT): XEM CÂU HỎI ĐỀ THI HOẶC FILE PDF ĐỀ */}
        <div className="lg:col-span-6 border-r border-slate-200 bg-white flex flex-col min-h-0">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLeftTabMode("questions")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  leftTabMode === "questions"
                    ? "bg-[#1D4ED8] text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                Nội dung câu hỏi ({flatQuestionsList.length})
              </button>
              {pdfEmbedUrl && (
                <button
                  type="button"
                  onClick={() => setLeftTabMode("pdf")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    leftTabMode === "pdf"
                      ? "bg-[#1D4ED8] text-white shadow-2xs"
                      : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  File đề gốc
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() =>
                openPrintableDynamicAnswerSheet({
                  ...resolvedExam,
                  studentSbd: sbdCols.join(""),
                  studentName: profile?.full_name || "",
                })
              }
              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3 h-3" /> In phiếu giấy A4 ({blueprint.totalPages || 1} trang)
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar bg-[#F8FAFC]">
            {leftTabMode === "pdf" && pdfEmbedUrl ? (
              <iframe
                src={pdfEmbedUrl}
                className="w-full h-full min-h-[500px] rounded-xl border border-slate-200 bg-white"
                title="File đề thi"
              />
            ) : flatQuestionsList.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-2">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-bold text-slate-700">
                  Hãy xem đề thi trong tài liệu đính kèm và tô đáp án vào Phiếu
                  trả lời bên phải.
                </p>
              </div>
            ) : (
              flatQuestionsList.map((q) => (
                <div
                  key={q.order}
                  className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                    <span className="px-2 py-0.5 rounded bg-blue-50 text-[#1D4ED8] font-black text-xs border border-blue-200">
                      Câu {q.order} (Phần {q.part} - Câu {q.localOrder})
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {q.part === 1
                        ? "Trắc nghiệm A, B, C, D"
                        : q.part === 2
                        ? "Đúng / Sai (4 ý)"
                        : "Trả lời ngắn"}
                    </span>
                  </div>

                  <DigitalQuestionMath content={q.prompt} />

                  {q.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt: any, idx: number) => (
                        <div
                          key={opt.key || idx}
                          className="p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs flex items-start gap-2"
                        >
                          <span className="font-black text-[#1D4ED8] shrink-0">
                            {opt.key || ["A", "B", "C", "D"][idx]}.
                          </span>
                          <DigitalQuestionMath
                            content={opt.text_html || opt.text || ""}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* CỘT PHẢI (6 CỘT): TỜ PHIẾU TRẮC NGHIỆM BỘ GD&ĐT MÔ PHỎNG TƯƠNG TÁC TÔ CHÌ */}
        <div className="lg:col-span-6 overflow-y-auto p-3 sm:p-5 custom-scrollbar bg-slate-200/70 flex justify-center">
          <div className="w-full max-w-[660px] bg-white rounded-xl shadow-xl border-2 border-slate-300 p-4 sm:p-6 space-y-5 relative h-fit">
            {/* 4 Ô VUÔNG ĐỊNH VỊ GÓC PHIẾU CHUẨN BỘ GD&ĐT */}
            <div className="w-4 h-4 bg-black absolute top-3 left-3" />
            <div className="w-4 h-4 bg-black absolute top-3 right-3" />
            <div className="w-4 h-4 bg-black absolute bottom-3 left-3" />
            <div className="w-4 h-4 bg-black absolute bottom-3 right-3" />

            {/* TIÊU ĐỀ PHIẾU & KHUNG SBD / MÃ ĐỀ */}
            <div className="pt-2 border-b-2 border-rose-300 pb-4 space-y-3">
              <div className="text-center">
                <h3 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
                  PHIẾU TRẢ LỜI TRẮC NGHIỆM ({totalQuestionsCount} CÂU)
                </h3>
                <p className="text-[11px] font-bold text-rose-700">
                  (Mẫu chuẩn Bộ GD&ĐT — Chạm vào ô tròn để tô chì 2B, chạm lại để
                  tẩy)
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start pt-1">
                <div className="sm:col-span-6 p-3 rounded-xl border border-rose-200 bg-rose-50/20 space-y-1.5 text-xs">
                  <div>
                    <span className="text-slate-500">Họ và tên:</span>{" "}
                    <strong className="text-slate-900 uppercase">
                      {profile?.full_name}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Lớp / Trường:</span>{" "}
                    <strong className="text-slate-800">
                      {profile?.grade || "Lớp 12"} • {profile?.school || "THPT"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Đề thi:</span>{" "}
                    <strong className="text-[#1D4ED8]">
                      {resolvedExam?.title}
                    </strong>
                  </div>
                </div>

                {/* Ô SỐ BÁO DANH & MÃ ĐỀ */}
                <div className="sm:col-span-6 flex items-center justify-end gap-3">
                  <div className="p-2.5 rounded-xl border border-rose-300 bg-white text-center">
                    <span className="text-[10px] font-black uppercase text-rose-800 block mb-1">
                      7. Số báo danh
                    </span>
                    <div className="flex gap-1">
                      {sbdCols.map((d, cIdx) => (
                        <input
                          key={cIdx}
                          type="text"
                          maxLength={1}
                          value={d}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            setSbdCols((prev) => {
                              const next = [...prev];
                              next[cIdx] = val;
                              return next;
                            });
                          }}
                          className="w-6 h-7 border border-rose-300 rounded text-center font-black text-xs text-slate-900 outline-none focus:border-blue-600"
                        />
                      ))}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl border border-rose-300 bg-white text-center">
                    <span className="text-[10px] font-black uppercase text-rose-800 block mb-1">
                      8. Mã đề
                    </span>
                    <div className="flex gap-1">
                      {examCodeCols.map((d, cIdx) => (
                        <input
                          key={cIdx}
                          type="text"
                          maxLength={1}
                          value={d}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            setExamCodeCols((prev) => {
                              const next = [...prev];
                              next[cIdx] = val;
                              return next;
                            });
                          }}
                          className="w-6 h-7 border border-rose-300 rounded text-center font-black text-xs text-[#1D4ED8] outline-none focus:border-blue-600"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PHẦN I: TRẮC NGHIỆM 4 PHƯƠNG ÁN A, B, C, D (HIỂN THỊ ĐẦY ĐỦ KỂ CẢ ĐỀ > 100 CÂU) */}
            {p1Count > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 bg-black inline-block" />
                  <h4 className="text-xs font-black uppercase text-slate-900">
                    PHẦN I: Trắc nghiệm nhiều phương án lựa chọn (Từ câu 1 đến
                    câu {p1Count})
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {blueprint.part1.blocks.map((block, bIdx) => (
                    <div
                      key={bIdx}
                      className="border border-rose-300 rounded-xl p-2.5 bg-rose-50/10 space-y-1.5"
                    >
                      <div className="grid grid-cols-5 text-[10px] font-black text-rose-700 text-center pb-1 border-b border-rose-200">
                        <span>Câu</span>
                        <span>A</span>
                        <span>B</span>
                        <span>C</span>
                        <span>D</span>
                      </div>

                      {Array.from(
                        { length: block.endQuestion - block.startQuestion + 1 },
                        (_, i) => block.startQuestion + i
                      ).map((qNum) => {
                        const selectedKey = part1Selections[qNum] || "";
                        return (
                          <div
                            key={qNum}
                            className="grid grid-cols-5 items-center py-0.5 text-center"
                          >
                            <span className="text-[11px] font-black text-slate-800">
                              {qNum}
                            </span>
                            {["A", "B", "C", "D"].map((optKey) => {
                              const isFilled = selectedKey === optKey;
                              return (
                                <button
                                  key={optKey}
                                  type="button"
                                  onClick={() => togglePart1Bubble(qNum, optKey)}
                                  className={`w-6 h-6 rounded-full mx-auto flex items-center justify-center text-[10px] font-bold transition-all cursor-pointer border ${
                                    isFilled
                                      ? "bg-slate-800 border-slate-900 text-white shadow-inner scale-105"
                                      : "bg-white border-rose-300 text-rose-500 hover:border-slate-500"
                                  }`}
                                >
                                  {optKey}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI */}
            {p2Count > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-rose-200">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 bg-black inline-block" />
                  <h4 className="text-xs font-black uppercase text-slate-900">
                    PHẦN II: Trắc nghiệm Đúng / Sai ({p2Count} câu)
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {blueprint.part2.blocks.map((block) => {
                    const qNum = block.questionNumber;
                    const qState = part2Selections[qNum] || {
                      a: null,
                      b: null,
                      c: null,
                      d: null,
                    };
                    return (
                      <div
                        key={qNum}
                        className="border border-rose-300 rounded-xl p-2.5 bg-rose-50/10 space-y-1.5"
                      >
                        <div className="text-center font-black text-xs text-slate-900 border-b border-rose-200 pb-1">
                          Câu {qNum}
                        </div>
                        <div className="grid grid-cols-3 text-[10px] font-bold text-rose-700 text-center">
                          <span>Ý</span>
                          <span>Đúng</span>
                          <span>Sai</span>
                        </div>

                        {(["a", "b", "c", "d"] as const).map((sk) => {
                          const val = qState[sk];
                          return (
                            <div
                              key={sk}
                              className="grid grid-cols-3 items-center py-0.5 text-center"
                            >
                              <span className="text-xs font-bold text-slate-800">
                                {sk})
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePart2Bubble(qNum, sk, true)}
                                className={`w-6 h-6 rounded-full mx-auto border flex items-center justify-center text-[9px] font-bold transition cursor-pointer ${
                                  val === true
                                    ? "bg-slate-800 border-slate-900 text-white shadow-inner scale-105"
                                    : "bg-white border-rose-300 text-rose-400 hover:border-slate-500"
                                }`}
                              >
                                Đ
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  togglePart2Bubble(qNum, sk, false)
                                }
                                className={`w-6 h-6 rounded-full mx-auto border flex items-center justify-center text-[9px] font-bold transition cursor-pointer ${
                                  val === false
                                    ? "bg-slate-800 border-slate-900 text-white shadow-inner scale-105"
                                    : "bg-white border-rose-300 text-rose-400 hover:border-slate-500"
                                }`}
                              >
                                S
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PHẦN III: TRẢ LỜI NGẮN (TÔ LƯỚI SỐ 4 CỘT) */}
            {p3Count > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-rose-200">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 bg-black inline-block" />
                  <h4 className="text-xs font-black uppercase text-slate-900">
                    PHẦN III: Trả lời ngắn - Tô kết quả ({p3Count} câu)
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {blueprint.part3.blocks.map((block) => {
                    const qNum = block.questionNumber;
                    const cols = part3Selections[qNum] || ["", "", "", ""];

                    return (
                      <div
                        key={qNum}
                        className="border border-rose-300 rounded-xl p-2.5 bg-rose-50/10 space-y-1.5"
                      >
                        <div className="flex items-center justify-between border-b border-rose-200 pb-1">
                          <span className="font-black text-xs text-slate-900">
                            Câu {qNum}
                          </span>
                          <div className="flex gap-1">
                            {[0, 1, 2, 3].map((cIdx) => (
                              <span
                                key={cIdx}
                                className="w-5 h-5 rounded border border-rose-300 bg-white flex items-center justify-center font-black text-xs text-[#1D4ED8]"
                              >
                                {cols[cIdx] || ""}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Hàng dấu âm (-) */}
                        <div className="grid grid-cols-5 items-center text-center text-[10px]">
                          <span className="font-black text-slate-700">-</span>
                          <button
                            type="button"
                            onClick={() => togglePart3Bubble(qNum, 0, "-")}
                            className={`w-5 h-5 rounded-full mx-auto border cursor-pointer ${
                              cols[0] === "-"
                                ? "bg-slate-800 border-slate-900 text-white"
                                : "bg-white border-rose-300"
                            }`}
                          />
                          <span />
                          <span />
                          <span />
                        </div>

                        {/* Hàng dấu phẩy (,) */}
                        <div className="grid grid-cols-5 items-center text-center text-[10px]">
                          <span className="font-black text-slate-700">,</span>
                          <span />
                          {[1, 2].map((cIdx) => (
                            <button
                              key={cIdx}
                              type="button"
                              onClick={() => togglePart3Bubble(qNum, cIdx, ",")}
                              className={`w-5 h-5 rounded-full mx-auto border cursor-pointer ${
                                cols[cIdx] === ","
                                  ? "bg-slate-800 border-slate-900 text-white"
                                  : "bg-white border-rose-300"
                              }`}
                            />
                          ))}
                          <span />
                        </div>

                        {/* Các hàng chữ số 0..9 */}
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                          <div
                            key={digit}
                            className="grid grid-cols-5 items-center text-center text-[10px]"
                          >
                            <span className="font-bold text-slate-600">
                              {digit}
                            </span>
                            {[0, 1, 2, 3].map((cIdx) => {
                              const isPicked = cols[cIdx] === String(digit);
                              return (
                                <button
                                  key={cIdx}
                                  type="button"
                                  onClick={() =>
                                    togglePart3Bubble(
                                      qNum,
                                      cIdx,
                                      String(digit)
                                    )
                                  }
                                  className={`w-5 h-5 rounded-full mx-auto border text-[9px] font-bold transition cursor-pointer ${
                                    isPicked
                                      ? "bg-slate-800 border-slate-900 text-white scale-105"
                                      : "bg-white border-rose-300 text-rose-400 hover:border-slate-500"
                                  }`}
                                >
                                  {digit}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DigitalAnswerSheetView;
