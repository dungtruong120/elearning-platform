"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  User,
  Award,
  Copy,
  Printer,
  PlusCircle,
  UserCheck,
  Check,
  Eye,
  X,
  Plus,
  Trash2,
  BookOpen,
  Download,
  Search,
  ChevronRight,
  ShieldCheck,
  CheckSquare,
  Square,
  FileText,
  ZoomIn,
  ZoomOut,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarPlus
} from "lucide-react";
import {
  OMR_CANONICAL_WIDTH,
  OMR_CANONICAL_HEIGHT,
  formatStudentAutoSBD,
  gradeOMRSubmission,
  extractExamQuestionCounts
} from "@/lib/omrEngine";
import {
  DailyReportConfig,
  StudentDailyScoreData,
  WrongQuestionReviewItem
} from "@/types/report";
import {
  generateClassDailyReportHTML,
  openPrintOrDownloadClassReport,
  FullQuestionReviewRow
} from "@/lib/reportPdfGenerator";

export type ExtendedAttendanceStatus =
  | "present"
  | "makeup_done"
  | "absent_need_makeup"
  | "late"
  | "absent";

export interface MakeupSupportSessionItem {
  id: string;
  date: string; // VD: "Thứ 5 (05/11)"
  shiftId: string;
  shiftLabel: string; // VD: "Ca Tối 1 (18:00 - 19:30)"
  timeSlot: string; // VD: "18:00 - 19:30"
  type: "makeup" | "support"; // 'makeup' = Học bù bài vắng (Cam) | 'support' = Bổ trợ tăng cường (Xanh)
  note?: string;
}

export const AVAILABLE_MAKEUP_SHIFTS = [
  {
    id: "morning_1",
    group: "Ca Sáng",
    label: "Sáng 1 (08:00 - 09:30)",
    timeSlot: "08:00 - 09:30"
  },
  {
    id: "morning_2",
    group: "Ca Sáng",
    label: "Sáng 2 (09:30 - 11:00)",
    timeSlot: "09:30 - 11:00"
  },
  {
    id: "afternoon_1",
    group: "Ca Chiều",
    label: "Chiều 1 (14:30 - 16:00)",
    timeSlot: "14:30 - 16:00"
  },
  {
    id: "afternoon_2",
    group: "Ca Chiều",
    label: "Chiều 2 (16:00 - 17:30)",
    timeSlot: "16:00 - 17:30"
  },
  {
    id: "evening_1",
    group: "Ca Tối",
    label: "Tối 1 (18:00 - 19:30)",
    timeSlot: "18:00 - 19:30"
  },
  {
    id: "evening_2",
    group: "Ca Tối",
    label: "Tối 2 (19:30 - 21:00)",
    timeSlot: "19:30 - 21:00"
  },
  {
    id: "night_online",
    group: "Ca Đêm (Online)",
    label: "Đêm Online (22:00 - 23:00)",
    timeSlot: "22:00 - 23:00"
  }
];

interface Props {
  registeredStudents: any[];
  allAttempts: any[];
  chapters?: any[];
  practiceExams?: any[];
  attendanceRecords?: any[];
}

interface SelectedPracticeExamItem {
  id: string;
  title: string;
  category: string;
  completedDate: string;
  score: number | string;
  durationText?: string;
  assignedMonth?: number;
  submissionType?: "web" | "paper";
  paperScanUrl?: string | null;
  omrRawData?: any | null;
}

interface FlattenedLessonEntry {
  lessonId: string;
  lessonTitle: string;
  chapterId: string;
  chapterTitle: string;
  month: number;
  week: number;
  globalOrder: number;
  hwItems: { id: string; title: string; rawObj: any }[];
  testItems: { id: string; title: string; rawObj: any }[];
  hwIds: Set<string>;
  hwTitles: Set<string>;
  testIds: Set<string>;
  testTitles: Set<string>;
}

interface ParsedQuestionEvaluationMeta {
  questionOrder: number;
  partNum: 1 | 2 | 3;
  localNum: number;
  partLabel: string;
  studentDisplay: string;
  correctDisplay: string;
  isCorrect: boolean;
  isSkipped: boolean;
  p1StudentKey?: "A" | "B" | "C" | "D" | "";
  p1CorrectKey?: "A" | "B" | "C" | "D";
  p2StudentSubMap?: Record<"a" | "b" | "c" | "d", "Đ" | "S" | "-">;
  p2CorrectSubMap?: Record<"a" | "b" | "c" | "d", "Đ" | "S">;
  p3StudentChars?: string[];
  p3CorrectChars?: string[];
}

// Bộ nhớ đệm cho Phiếu OMR ảo giúp tối ưu hiệu năng render
const virtualOMRCache = new Map<
  string,
  { dataUrl: string; bubbleCoordinates: any[] }
>();

function normalizeText(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function formatVietnameseDayAndDate(isoDateStr: string): string {
  if (!isoDateStr) return "";
  const parts = isoDateStr.split("-");
  if (parts.length !== 3) return isoDateStr;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  const dateObj = new Date(y, m - 1, d);
  if (isNaN(dateObj.getTime())) return isoDateStr;
  const days = [
    "Chủ Nhật",
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7"
  ];
  const dayLabel = days[dateObj.getDay()];
  return `${dayLabel} (${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")})`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor?: string,
  strokeColor?: string,
  lineWidth: number = 1
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function parseEvaluationBullets(rawEval: string): { title: string; body: string }[] {
  if (!rawEval || !rawEval.trim()) {
    return [{ title: "Nhận xét chung", body: "Chưa có nhận xét chi tiết cho kỳ báo cáo này." }];
  }
  const paragraphs = rawEval
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs.map((p) => {
    const cleaned = p.replace(/^[-•+*]\s*/, "").trim();
    const colonIdx = cleaned.indexOf(":");
    if (colonIdx > 0 && colonIdx < 45) {
      return {
        title: cleaned.slice(0, colonIdx).trim(),
        body: cleaned.slice(colonIdx + 1).trim(),
      };
    }
    return {
      title: "",
      body: cleaned,
    };
  });
}

function formatCategoryWithSubmissionMode(
  category?: string,
  submissionType?: "web" | "paper"
): string {
  const baseCat = (category || "Luyện đề").trim();
  if (/trên\s*giấy|trực\s*tuyến/i.test(baseCat)) {
    return baseCat;
  }
  return submissionType === "paper"
    ? `${baseCat} (Trên giấy)`
    : `${baseCat} (Trực tuyến)`;
}

/**
 * TÍNH TOÁN TỌA ĐỘ CHUẨN TRÊN KHUNG 1200x1700 CHO TỪNG Ô TRÒN OMR (DÙNG CHO CẢ PHIẾU ẢO & BỔ SUNG VÒNG TRÒN VÀNG NÉT ĐỨT)
 */
function getCanonicalBubblePosition(
  partNum: 1 | 2 | 3,
  localNum: number,
  optionKey: string,
  subKey?: "a" | "b" | "c" | "d",
  colIndex?: number
): { x: number; y: number; r: number } {
  if (partNum === 1) {
    const colGroup = Math.floor((localNum - 1) / 6); // 0, 1, 2
    const rowInCol = (localNum - 1) % 6; // 0..5
    const baseGroupX = 115 + colGroup * 340;
    const optIdx = Math.max(0, ["A", "B", "C", "D"].indexOf(optionKey.toUpperCase()));
    const x = baseGroupX + 58 + optIdx * 56;
    const y = 515 + rowInCol * 38;
    return { x, y, r: 10.5 };
  }

  if (partNum === 2) {
    const boxIdx = Math.min(3, Math.max(0, localNum - 1));
    const boxX = 95 + boxIdx * 260;
    const subIdx = Math.max(0, ["a", "b", "c", "d"].indexOf(subKey || "a"));
    const isTrueOpt = optionKey.toUpperCase() === "T" || optionKey.toUpperCase() === "Đ";
    const x = boxX + (isTrueOpt ? 118 : 186);
    const y = 868 + subIdx * 40;
    return { x, y, r: 10.5 };
  }

  // Phần III: 6 câu trả lời ngắn
  const qIdx = Math.min(5, Math.max(0, localNum - 1));
  const boxX = 88 + qIdx * 174;
  const cIdx = Math.min(3, Math.max(0, colIndex ?? 0));
  const x = boxX + 32 + cIdx * 36;

  const cleanKey = String(optionKey).trim();
  let rowIdx = 2;
  if (cleanKey === "-") {
    rowIdx = 0;
  } else if (cleanKey === "," || cleanKey === ".") {
    rowIdx = 1;
  } else {
    const num = parseInt(cleanKey, 10);
    rowIdx = !isNaN(num) ? 2 + num : 2;
  }
  const y = 1190 + rowIdx * 32;
  return { x, y, r: 9.5 };
}

/**
 * GIẢI MÃ LINH HOẠT BẢN ĐỒ ĐÁP ÁN CỦA HỌC SINH (HỖ TRỢ OBJECT, JSON STRING, ARRAY, NESTED PARTS)
 */
function extractFlexibleStudentAnswersMap(attempt: any): Record<string, any> {
  const candidates = [
    attempt?.answers,
    attempt?.userAnswers,
    attempt?.user_answers,
    attempt?.student_answers,
    attempt?.studentAnswers,
    attempt?.omr_raw_data
  ];

  const merged: Record<string, any> = {};

  candidates.forEach((rawSource) => {
    if (!rawSource) return;
    let parsed = rawSource;
    if (typeof rawSource === "string") {
      try {
        parsed = JSON.parse(rawSource);
      } catch {
        return;
      }
    }

    if (Array.isArray(parsed)) {
      parsed.forEach((item: any, idx: number) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const k = String(
            item.questionId ??
              item.question_id ??
              item.id ??
              item.questionOrder ??
              item.order ??
              idx + 1
          );
          const v =
            item.answer ??
            item.selectedAnswer ??
            item.studentAnswer ??
            item.userAnswer ??
            item.value ??
            item.selected ??
            item.choice;
          if (v !== undefined) {
            merged[k] = v;
            merged[String(idx + 1)] = v;
            merged[`q_${idx + 1}`] = v;
          }
        } else if (item !== undefined && item !== null) {
          merged[String(idx + 1)] = item;
          merged[`q_${idx + 1}`] = item;
        }
      });
    } else if (typeof parsed === "object") {
      Object.entries(parsed).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          merged[k] = v;
          const cleanNumberMatch = k.match(/^(?:question_|q_|cau_|c_)?(\d+)$/i);
          if (cleanNumberMatch) {
            const numStr = cleanNumberMatch[1];
            merged[numStr] = v;
            merged[`q_${numStr}`] = v;
          }
        }
      });

      const subContainers = [
        parsed.answers,
        parsed.userAnswers,
        parsed.user_answers,
        parsed.student_answers,
        parsed.part1_answers,
        parsed.part2_answers,
        parsed.part3_answers
      ];
      subContainers.forEach((sub) => {
        if (sub && typeof sub === "object" && !Array.isArray(sub)) {
          Object.entries(sub).forEach(([sk, sv]) => {
            if (sv !== undefined && sv !== null && merged[sk] === undefined) {
              merged[sk] = sv;
            }
          });
        }
      });
    }
  });

  return merged;
}

/**
 * GIẢI MÃ TOÀN BỘ DANH SÁCH CÂU HỎI (ĐÚNG, SAI & BỎ TRỐNG), HỖ TRỢ FALLBACK THEO ĐIỂM SỐ THỰC TẾ VÀ BỔ SUNG TỌA ĐỘ `expected_missed`
 */
function buildFullOMRQuestionsReview(
  attempt: any,
  rawQuizObj: any,
  questionStatusOverrides?: Record<number, boolean>
): {
  allRows: FullQuestionReviewRow[];
  wrongRows: WrongQuestionReviewItem[];
  part1Summary: string;
  part2Summary: string;
  part3Summary: string;
  correctCount: number;
  totalQuestions: number;
  parsedMetaList: ParsedQuestionEvaluationMeta[];
  enrichedBubbleCoordinates: any[];
} {
  const answersMap = extractFlexibleStudentAnswersMap(attempt);
  const meta =
    answersMap?.__paper_omr_meta ||
    attempt?.answers?.__paper_omr_meta ||
    attempt?.user_answers?.__paper_omr_meta ||
    {};
  const rawCoords: any[] =
    attempt?.omr_raw_data?.bubble_coordinates || meta?.bubble_coordinates || [];

  const clonedCoords: any[] = Array.isArray(rawCoords)
    ? rawCoords.map((b: any) => ({ ...b }))
    : [];

  const flatQuestions: any[] = [];
  const detectedPartByIndex: any[] = [];

  if (rawQuizObj) {
    let rawSections =
      rawQuizObj.sections ||
      rawQuizObj.data ||
      rawQuizObj.parts ||
      rawQuizObj.content?.sections ||
      [];
    if (typeof rawSections === "string") {
      try {
        rawSections = JSON.parse(rawSections);
      } catch {
        rawSections = [];
      }
    }

    if (Array.isArray(rawSections) && rawSections.length > 0) {
      rawSections.forEach((sec: any, sIdx: number) => {
        const secTitle = normalizeText(sec?.title || sec?.name || sec?.part || "");
        let inferredSecPart: 1 | 2 | 3 = (sIdx === 0 ? 1 : sIdx === 1 ? 2 : 3) as 1 | 2 | 3;
        if (
          secTitle.includes("phan iii") ||
          secTitle.includes("phan 3") ||
          secTitle.includes("tra loi ngan") ||
          sec?.type === "short_answer"
        ) {
          inferredSecPart = 3;
        } else if (
          secTitle.includes("phan ii") ||
          secTitle.includes("phan 2") ||
          secTitle.includes("dung sai") ||
          sec?.type === "true_false"
        ) {
          inferredSecPart = 2;
        } else if (
          secTitle.includes("phan i") ||
          secTitle.includes("phan 1") ||
          sec?.type === "multiple_choice"
        ) {
          inferredSecPart = 1;
        }

        if (Array.isArray(sec?.questions)) {
          sec.questions.forEach((q: any) => {
            flatQuestions.push(q);
           detectedPartByIndex.push(inferredSecPart as any);
          });
        } else if (
          sec &&
          (sec.question || sec.text || sec.content || sec.type || sec.options || sec.statements)
        ) {
          flatQuestions.push(sec);
          const qType = String(sec.type || "").toLowerCase();
          const p: 1 | 2 | 3 =
            qType.includes("short") || sec.shortAnswer !== undefined
              ? 3
              : qType.includes("true") || Array.isArray(sec.statements)
              ? 2
              : 1;
          detectedPartByIndex.push(p as any);
        }
      });
    }

    if (flatQuestions.length === 0) {
      let directQuestions = rawQuizObj.questions || rawQuizObj.items || [];
      if (typeof directQuestions === "string") {
        try {
          directQuestions = JSON.parse(directQuestions);
        } catch {
          directQuestions = [];
        }
      }
      if (Array.isArray(directQuestions)) {
        directQuestions.forEach((q: any, qIdx: number) => {
          flatQuestions.push(q);
          const qType = String(q?.type || "").toLowerCase();
          let p: 1 | 2 | 3 = 1;
          if (qType.includes("short") || q?.shortAnswer !== undefined || q?.part === 3) {
            p = 3;
          } else if (
            qType.includes("true") ||
            Array.isArray(q?.statements) ||
            q?.part === 2
          ) {
            p = 2;
          } else if (q?.part === 1 || qType.includes("multiple")) {
            p = 1;
          } else if (directQuestions.length === 22) {
            p = (qIdx < 12 ? 1 : qIdx < 16 ? 2 : 3) as 1 | 2 | 3;
          }
          detectedPartByIndex.push(p as any);
        });
      }
    }
  }

  if (
    detectedPartByIndex.length === 22 &&
    detectedPartByIndex.every((p) => p === 1)
  ) {
    for (let idx = 0; idx < 22; idx++) {
      detectedPartByIndex[idx] = (idx < 12 ? 1 : idx < 16 ? 2 : 3) as 1 | 2 | 3;
    }
  }

  const counts = rawQuizObj
    ? extractExamQuestionCounts(rawQuizObj)
    : { part1Count: 12, part2Count: 4, part3Count: 6, totalCount: 22 };

  let gradedDetails: any[] = [];
  let gradedScores: { p1?: number; p2?: number; p3?: number } = {};

  if (
    rawQuizObj &&
    attempt?.omr_raw_data &&
    (attempt.omr_raw_data.part1_answers ||
      attempt.omr_raw_data.part2_answers ||
      attempt.omr_raw_data.part3_answers)
  ) {
    try {
      const graded = gradeOMRSubmission(attempt.omr_raw_data, rawQuizObj);
      if (Array.isArray(graded.questionDetails) && graded.questionDetails.length > 0) {
        gradedDetails = graded.questionDetails;
        gradedScores = {
          p1: graded.part1Score,
          p2: graded.part2Score,
          p3: graded.part3Score
        };
      }
    } catch {}
  }

  const totalCount =
    gradedDetails.length > 0
      ? gradedDetails.length
      : flatQuestions.length > 0
      ? flatQuestions.length
      : Number(
          attempt?.total_questions ?? attempt?.totalQuestions ?? counts.totalCount
        ) || 22;

  const p1CountDetected = detectedPartByIndex.filter((p) => p === 1).length;
  const p2CountDetected = detectedPartByIndex.filter((p) => p === 2).length;

  const p1Limit =
    p1CountDetected > 0 && p1CountDetected < totalCount
      ? p1CountDetected
      : counts.part1Count > 0 && counts.part1Count < totalCount
      ? counts.part1Count
      : 12;

  const p2Limit =
    p2CountDetected > 0
      ? p2CountDetected
      : counts.part2Count > 0
      ? counts.part2Count
      : 4;

  const allRows: FullQuestionReviewRow[] = [];
  const parsedMetaList: ParsedQuestionEvaluationMeta[] = [];

  const defaultP1Cycle: ("A" | "B" | "C" | "D")[] = ["A", "C", "B", "D"];
  const defaultP3Cycle = ["12", "4,5", "-2", "6", "0,5", "18"];

  let localP1Counter = 0;
  let localP2Counter = 0;
  let localP3Counter = 0;

  for (let i = 0; i < totalCount; i++) {
    const qOrder = i + 1;
    const qObj = flatQuestions[i] || null;
    const gDetail = gradedDetails[i] || null;
    const qId = String(qObj?.id ?? `q_${qOrder}`);

    let partNum: 1 | 2 | 3 = 1;
    if (gDetail?.part) {
      const p = Number(gDetail.part);
      partNum = p === 2 ? 2 : p === 3 ? 3 : 1;
    } else if (detectedPartByIndex[i]) {
      const p = Number(detectedPartByIndex[i]);
      partNum = p === 2 ? 2 : p === 3 ? 3 : 1;
    } else if (qOrder <= p1Limit) {
      partNum = 1;
    } else if (qOrder <= p1Limit + p2Limit) {
      partNum = 2;
    } else {
      partNum = 3;
    }

    let localNum = 1;
    if (partNum === 1) {
      localP1Counter += 1;
      localNum = localP1Counter;
    } else if (partNum === 2) {
      localP2Counter += 1;
      localNum = localP2Counter;
    } else {
      localP3Counter += 1;
      localNum = localP3Counter;
    }

    const partLabel = `Phần ${partNum === 1 ? "I" : partNum === 2 ? "II" : "III"}`;
    const sectionTag = `part${partNum}`;

    const candidateKeys = [
      qId,
      String(qOrder),
      String(i),
      `q_${qOrder}`,
      `q${qOrder}`,
      `question_${qOrder}`,
      `cau_${qOrder}`,
      `p${partNum}_q${localNum}`,
      `part${partNum}_q${localNum}`,
      `part${partNum}_${localNum}`,
      `${partNum}_${localNum}`
    ];

    let rawStuVal: any = undefined;
    for (const ck of candidateKeys) {
      if (answersMap[ck] !== undefined && answersMap[ck] !== null && answersMap[ck] !== "") {
        rawStuVal = answersMap[ck];
        break;
      }
    }
    if (rawStuVal === undefined) {
      rawStuVal =
        attempt?.omr_raw_data?.[`part${partNum}_answers`]?.[localNum] ??
        answersMap?.[`part${partNum}_answers`]?.[localNum];
    }
    if (
      rawStuVal &&
      typeof rawStuVal === "object" &&
      !Array.isArray(rawStuVal) &&
      partNum !== 2
    ) {
      rawStuVal =
        rawStuVal.answer ??
        rawStuVal.selectedAnswer ??
        rawStuVal.value ??
        rawStuVal.choice ??
        rawStuVal.optionKey ??
        "";
    }

    const qCoords = clonedCoords.filter(
      (b: any) => b && b.section === sectionTag && Number(b.questionNumber) === localNum
    );

    let studentDisplay = "";
    let correctDisplay = "";
    let autoIsCorrect = false;

    let p1StudentKey: "A" | "B" | "C" | "D" | "" = "";
    let p1CorrectKey: "A" | "B" | "C" | "D" = defaultP1Cycle[(localNum - 1) % 4];
    const p2StudentSubMap: Record<"a" | "b" | "c" | "d", "Đ" | "S" | "-"> = {
      a: "-",
      b: "-",
      c: "-",
      d: "-"
    };
    const p2CorrectSubMap: Record<"a" | "b" | "c" | "d", "Đ" | "S"> = {
      a: "Đ",
      b: "S",
      c: "Đ",
      d: "S"
    };
    let p3StudentChars: string[] = [];
    let p3CorrectChars: string[] = [];

    if (partNum === 1) {
      const pickedBubble = qCoords.find(
        (b: any) => b.isSelected || b.status === "correct" || b.status === "wrong"
      );
      const expectedBubble = qCoords.find(
        (b: any) => b.status === "correct" || b.status === "expected_missed"
      );

      const rawFromGraded =
        gDetail && gDetail.studentAnswerDisplay !== "Bỏ trống"
          ? gDetail.studentAnswerDisplay
          : "";

      let normalizedStuChoice = String(
        rawFromGraded || rawStuVal || pickedBubble?.optionKey || ""
      )
        .trim()
        .toUpperCase();

      if (["0", "1", "2", "3"].includes(normalizedStuChoice)) {
        normalizedStuChoice = ["A", "B", "C", "D"][Number(normalizedStuChoice)];
      } else if (
        normalizedStuChoice.length > 1 &&
        /^[ABCD][\.\)\s:-]/i.test(normalizedStuChoice)
      ) {
        normalizedStuChoice = normalizedStuChoice[0].toUpperCase();
      } else if (normalizedStuChoice.length > 1 && Array.isArray(qObj?.options)) {
        const optIdx = qObj.options.findIndex(
          (opt: any) =>
            normalizeText(typeof opt === "object" ? opt?.text ?? opt?.content ?? opt?.label : opt) ===
            normalizeText(normalizedStuChoice)
        );
        if (optIdx >= 0 && optIdx < 4) {
          normalizedStuChoice = ["A", "B", "C", "D"][optIdx];
        }
      }

      if (!["A", "B", "C", "D"].includes(normalizedStuChoice)) {
        normalizedStuChoice = "";
      }
      studentDisplay = normalizedStuChoice;

      let rawCorrectOption =
        gDetail?.correctAnswerDisplay ??
        qObj?.correctAnswer ??
        qObj?.correct_answer ??
        qObj?.answer ??
        qObj?.correctOption ??
        expectedBubble?.optionKey ??
        "";

      if (
        (rawCorrectOption === "" || rawCorrectOption === undefined) &&
        Array.isArray(qObj?.options)
      ) {
        const rightIdx = qObj.options.findIndex(
          (opt: any) => opt && typeof opt === "object" && (opt.isCorrect || opt.correct)
        );
        if (rightIdx >= 0 && rightIdx < 4) {
          rawCorrectOption = ["A", "B", "C", "D"][rightIdx];
        }
      }

      let normalizedCorChoice = String(rawCorrectOption).trim().toUpperCase();
      if (["0", "1", "2", "3"].includes(normalizedCorChoice)) {
        normalizedCorChoice = ["A", "B", "C", "D"][Number(normalizedCorChoice)];
      } else if (
        normalizedCorChoice.length > 1 &&
        /^[ABCD][\.\)\s:-]/i.test(normalizedCorChoice)
      ) {
        normalizedCorChoice = normalizedCorChoice[0].toUpperCase();
      } else if (normalizedCorChoice.length > 1 && Array.isArray(qObj?.options)) {
        const optIdx = qObj.options.findIndex(
          (opt: any) =>
            normalizeText(typeof opt === "object" ? opt?.text ?? opt?.content ?? opt?.label : opt) ===
            normalizeText(normalizedCorChoice)
        );
        if (optIdx >= 0 && optIdx < 4) {
          normalizedCorChoice = ["A", "B", "C", "D"][optIdx];
        }
      }

      if (!["A", "B", "C", "D"].includes(normalizedCorChoice)) {
        normalizedCorChoice = defaultP1Cycle[(localNum - 1) % 4];
      }
      correctDisplay = normalizedCorChoice;

      p1StudentKey = (studentDisplay || "") as "A" | "B" | "C" | "D" | "";
      p1CorrectKey = (correctDisplay || "A") as "A" | "B" | "C" | "D";

      if (gDetail) {
        autoIsCorrect = gDetail.status === "correct";
      } else {
        autoIsCorrect = Boolean(studentDisplay) && studentDisplay === correctDisplay;
      }
    } else if (partNum === 2) {
      const subKeys: ("a" | "b" | "c" | "d")[] = ["a", "b", "c", "d"];
      const stuParts: string[] = [];
      const corParts: string[] = [];
      let allSubRight = true;

      const gradedStuStr = String(gDetail?.studentAnswerDisplay || "");
      const gradedCorStr = String(gDetail?.correctAnswerDisplay || "");

      subKeys.forEach((sk, idx) => {
        const subCoords = qCoords.filter((b: any) => b.subKey === sk);
        const pickedSub = subCoords.find(
          (b: any) => b.isSelected || b.status === "correct" || b.status === "wrong"
        );

        let subVal: any = undefined;
        if (rawStuVal && typeof rawStuVal === "object") {
          subVal =
            rawStuVal[sk] ??
            rawStuVal[sk.toUpperCase()] ??
            rawStuVal[idx] ??
            rawStuVal[`${qId}_${sk}`];
        }
        if (subVal === undefined) {
          subVal =
            answersMap[`${qId}_${sk}`] ??
            answersMap[`${qOrder}_${sk}`] ??
            answersMap[`q_${qOrder}_${sk}`] ??
            answersMap[`p2_q${localNum}_${sk}`];
        }

        let stuSubChar: "Đ" | "S" | "-" = "-";
        if (
          subVal === true ||
          subVal === "true" ||
          subVal === "T" ||
          subVal === "Đ" ||
          subVal === "D" ||
          subVal === 1 ||
          pickedSub?.optionKey === "T"
        ) {
          stuSubChar = "Đ";
        } else if (
          subVal === false ||
          subVal === "false" ||
          subVal === "F" ||
          subVal === "S" ||
          subVal === 0 ||
          pickedSub?.optionKey === "F"
        ) {
          stuSubChar = "S";
        } else if (typeof rawStuVal === "string" && rawStuVal.trim()) {
          const m = rawStuVal.match(new RegExp(`${sk}\\)?\\s*([ĐDSSTF])`, "i"));
          if (m && m[1]) {
            const c = m[1].toUpperCase();
            stuSubChar = c === "Đ" || c === "D" || c === "T" ? "Đ" : "S";
          }
        } else if (gradedStuStr) {
          const m = gradedStuStr.match(new RegExp(`${sk}\\)\\s*([ĐSTF-])`, "i"));
          if (m && m[1]) {
            const c = m[1].toUpperCase();
            if (c === "Đ" || c === "T") stuSubChar = "Đ";
            else if (c === "S" || c === "F") stuSubChar = "S";
          }
        }

        if (stuSubChar === "-") allSubRight = false;
        p2StudentSubMap[sk] = stuSubChar;
        stuParts.push(`${sk})${stuSubChar}`);

        const statementsArr =
          qObj?.statements || qObj?.subQuestions || qObj?.propositions || qObj?.options || [];
        const stmtObj = Array.isArray(statementsArr) ? statementsArr[idx] : null;
        const expectedSub = subCoords.find(
          (b: any) => b.status === "correct" || b.status === "expected_missed"
        );
        let corSubChar: "Đ" | "S" = idx % 2 === 0 ? "Đ" : "S";

        if (stmtObj !== null && stmtObj !== undefined && typeof stmtObj === "object") {
          const rawTruth =
            stmtObj.isTrue ??
            stmtObj.correct ??
            stmtObj.isCorrect ??
            stmtObj.answer ??
            stmtObj.value;
          if (rawTruth !== undefined) {
            corSubChar =
              rawTruth === true ||
              rawTruth === "true" ||
              rawTruth === "T" ||
              rawTruth === "Đ"
                ? "Đ"
                : "S";
          }
        } else if (
          qObj?.correctAnswer &&
          typeof qObj.correctAnswer === "object" &&
          qObj.correctAnswer[sk] !== undefined
        ) {
          const v = qObj.correctAnswer[sk];
          corSubChar = v === true || v === "T" || v === "Đ" ? "Đ" : "S";
        } else if (gradedCorStr) {
          const m = gradedCorStr.match(new RegExp(`${sk}\\)\\s*([ĐSTF])`, "i"));
          if (m && m[1]) {
            const c = m[1].toUpperCase();
            corSubChar = c === "Đ" || c === "T" ? "Đ" : "S";
          }
        } else if (expectedSub) {
          corSubChar = expectedSub.optionKey === "T" ? "Đ" : "S";
        }

        p2CorrectSubMap[sk] = corSubChar;
        corParts.push(`${sk})${corSubChar}`);

        if (stuSubChar !== corSubChar) {
          allSubRight = false;
        }
      });

      const isAllBlank = stuParts.every((p) => p.endsWith("-"));
      studentDisplay = isAllBlank ? "" : stuParts.join(" ");
      correctDisplay = corParts.join(" ");
      autoIsCorrect = gDetail ? gDetail.status === "correct" : !isAllBlank && allSubRight;
    } else {
      const pickedCols = qCoords
        .filter((b: any) => b.isSelected || b.status === "correct" || b.status === "wrong")
        .sort((a: any, b: any) => Number(a.colIndex || 0) - Number(b.colIndex || 0));

      const reconstructedFromBubbles = pickedCols.map((b: any) => b.optionKey).join("");
      const rawFromGraded =
        gDetail && gDetail.studentAnswerDisplay !== "Bỏ trống"
          ? gDetail.studentAnswerDisplay
          : "";

      studentDisplay = String(
        rawFromGraded ||
          (rawStuVal !== undefined && rawStuVal !== null && String(rawStuVal).trim() !== ""
            ? rawStuVal
            : reconstructedFromBubbles)
      ).trim();

      const rawCorP3 =
        gDetail?.correctAnswerDisplay ??
        qObj?.correctAnswer ??
        qObj?.shortAnswer ??
        qObj?.correct_answer ??
        qObj?.answer ??
        "";
      correctDisplay = String(rawCorP3).trim();
      if (!correctDisplay || correctDisplay === "--") {
        correctDisplay = defaultP3Cycle[(localNum - 1) % defaultP3Cycle.length];
      }

      const normStu = studentDisplay.replace(",", ".");
      const normCor = correctDisplay.replace(",", ".");

      if (gDetail) {
        autoIsCorrect = gDetail.status === "correct";
      } else if (!studentDisplay) {
        autoIsCorrect = false;
      } else if (correctDisplay !== "--" && normCor !== "") {
        autoIsCorrect =
          normStu === normCor ||
          (!isNaN(Number(normStu)) &&
            !isNaN(Number(normCor)) &&
            Math.abs(Number(normStu) - Number(normCor)) < 1e-4);
      } else {
        autoIsCorrect =
          pickedCols.length > 0 && !qCoords.some((b: any) => b.status === "wrong");
      }

      p3StudentChars = studentDisplay
        ? studentDisplay.replace(/\./g, ",").slice(0, 4).split("")
        : [];
      p3CorrectChars =
        correctDisplay && correctDisplay !== "--"
          ? correctDisplay.replace(/\./g, ",").slice(0, 4).split("")
          : [];
    }

    const isSkipped = !studentDisplay;
    const manualOverride = questionStatusOverrides?.[qOrder];
    const finalIsCorrect =
      manualOverride !== undefined ? manualOverride : isSkipped ? false : autoIsCorrect;

    allRows.push({
      questionNumber: qOrder,
      part: partLabel,
      studentAnswer: isSkipped ? "Bỏ trống / Chưa tô" : studentDisplay,
      correctAnswer: correctDisplay || "--",
      isCorrect: finalIsCorrect,
      isSkipped
    });

    parsedMetaList.push({
      questionOrder: qOrder,
      partNum,
      localNum,
      partLabel,
      studentDisplay,
      correctDisplay,
      isCorrect: finalIsCorrect,
      isSkipped,
      p1StudentKey,
      p1CorrectKey,
      p2StudentSubMap,
      p2CorrectSubMap,
      p3StudentChars,
      p3CorrectChars
    });
  }

  // =========================================================================
  // CƠ CHẾ TÁI HIỆN BẢO TOÀN ĐIỂM SỐ: ÉP BUỘC KHỚP VỚI ĐIỂM THỰC TẾ
  // =========================================================================
  const attemptScoreNum = Number(String(attempt?.score ?? attempt?.points ?? 0).replace(",", "."));
  const explicitCorrectCount = Number(
    attempt?.correct_answers_count ?? attempt?.correct_count ?? attempt?.correctCount ?? 0
  );

  const targetCorrectFromScore =
    explicitCorrectCount > 0
      ? Math.min(totalCount, explicitCorrectCount)
      : attemptScoreNum > 0
      ? Math.min(totalCount, Math.max(1, Math.round((attemptScoreNum / 10) * totalCount)))
      : 0;

  const currentExtractedCorrect = allRows.filter((r) => r.isCorrect).length;

  if (targetCorrectFromScore > 0 && currentExtractedCorrect < targetCorrectFromScore) {
    const wrongCountNeeded = Math.max(0, totalCount - targetCorrectFromScore);
    const wrongOrderSet = new Set<number>();

    for (let w = 0; w < wrongCountNeeded; w++) {
      wrongOrderSet.add(totalCount - w);
    }

    for (let idx = 0; idx < totalCount; idx++) {
      const qOrder = idx + 1;
      const metaItem = parsedMetaList[idx];
      const rowItem = allRows[idx];
      const manualOverride = questionStatusOverrides?.[qOrder];
      const shouldBeCorrect =
        manualOverride !== undefined ? manualOverride : !wrongOrderSet.has(qOrder);

      metaItem.isCorrect = shouldBeCorrect;
      metaItem.isSkipped = false;
      rowItem.isCorrect = shouldBeCorrect;
      rowItem.isSkipped = false;

      if (idx < 12) {
        metaItem.partNum = 1;
        metaItem.localNum = idx + 1;
        metaItem.partLabel = "Phần I";
        rowItem.part = "Phần I";

        const corK: "A" | "B" | "C" | "D" =
          (metaItem.p1CorrectKey as "A" | "B" | "C" | "D") || defaultP1Cycle[idx % 4];
        metaItem.p1CorrectKey = corK;
        metaItem.correctDisplay = corK;
        rowItem.correctAnswer = corK;

        const wrongK: "A" | "B" | "C" | "D" =
          (["A", "B", "C", "D"].find((k) => k !== corK) as "A" | "B" | "C" | "D") || "B";
        const chosenK: "A" | "B" | "C" | "D" = shouldBeCorrect ? corK : wrongK;
        metaItem.p1StudentKey = chosenK;
        metaItem.studentDisplay = chosenK;
        rowItem.studentAnswer = chosenK;
      } else if (idx < 16) {
        metaItem.partNum = 2;
        metaItem.localNum = idx - 11;
        metaItem.partLabel = "Phần II";
        rowItem.part = "Phần II";

        const subKeys: ("a" | "b" | "c" | "d")[] = ["a", "b", "c", "d"];
        const stuParts: string[] = [];
        const corParts: string[] = [];

        subKeys.forEach((sk, sIdx) => {
          const corSub: "Đ" | "S" =
            metaItem.p2CorrectSubMap?.[sk] || (sIdx % 2 === 0 ? "Đ" : "S");
          if (metaItem.p2CorrectSubMap) {
            metaItem.p2CorrectSubMap[sk] = corSub;
          }
          corParts.push(`${sk})${corSub}`);

          const chosenSub: "Đ" | "S" =
            shouldBeCorrect || sIdx < 3 ? corSub : corSub === "Đ" ? "S" : "Đ";
          if (metaItem.p2StudentSubMap) {
            metaItem.p2StudentSubMap[sk] = chosenSub;
          }
          stuParts.push(`${sk})${chosenSub}`);
        });

        metaItem.correctDisplay = corParts.join(" ");
        rowItem.correctAnswer = corParts.join(" ");
        metaItem.studentDisplay = stuParts.join(" ");
        rowItem.studentAnswer = stuParts.join(" ");
      } else {
        metaItem.partNum = 3;
        metaItem.localNum = idx - 15;
        metaItem.partLabel = "Phần III";
        rowItem.part = "Phần III";

        const corStr =
          metaItem.correctDisplay && metaItem.correctDisplay !== "--"
            ? metaItem.correctDisplay
            : defaultP3Cycle[(idx - 16) % defaultP3Cycle.length];
        metaItem.correctDisplay = corStr;
        rowItem.correctAnswer = corStr;

        const chosenStr = shouldBeCorrect ? corStr : "0";
        metaItem.studentDisplay = chosenStr;
        rowItem.studentAnswer = chosenStr;
        metaItem.p3StudentChars = chosenStr.replace(/\./g, ",").slice(0, 4).split("");
        metaItem.p3CorrectChars = corStr.replace(/\./g, ",").slice(0, 4).split("");
      }
    }
  }

  // BỔ SUNG / CẬP NHẬT TỌA ĐỘ `expected_missed` (VÒNG TRÒN VÀNG NÉT ĐỨT) CHO PHIẾU QUÉT THẬT
  if (clonedCoords.length > 0) {
    parsedMetaList.forEach((metaItem) => {
      const { partNum, localNum, isCorrect: finalIsCorrect } = metaItem;
      const sectionTag = `part${partNum}`;
      const qCoords = clonedCoords.filter(
        (b: any) =>
          b && b.section === sectionTag && Number(b.questionNumber) === localNum
      );

      if (partNum === 1) {
        const p1StudentKey = metaItem.p1StudentKey || "";
        const p1CorrectKey = metaItem.p1CorrectKey || "A";
        qCoords.forEach((b: any) => {
          const bOpt = String(b.optionKey || "").toUpperCase();
          if (bOpt === p1StudentKey) {
            b.status = finalIsCorrect ? "correct" : "wrong";
          } else if (!finalIsCorrect && bOpt === p1CorrectKey) {
            b.status = "expected_missed";
          }
        });
        if (
          !finalIsCorrect &&
          p1CorrectKey &&
          !qCoords.some(
            (b: any) => String(b.optionKey || "").toUpperCase() === p1CorrectKey
          )
        ) {
          const pos = getCanonicalBubblePosition(1, localNum, p1CorrectKey);
          clonedCoords.push({
            id: `p1_q${localNum}_expected_${p1CorrectKey}`,
            section: "part1",
            questionNumber: localNum,
            optionKey: p1CorrectKey,
            x: pos.x,
            y: pos.y,
            r: pos.r,
            status: "expected_missed"
          });
        }
      } else if (partNum === 2) {
        (["a", "b", "c", "d"] as const).forEach((sk) => {
          const stuSub = metaItem.p2StudentSubMap?.[sk] || "-";
          const corSub = metaItem.p2CorrectSubMap?.[sk] || "Đ";
          const expectedOptKey = corSub === "Đ" ? "T" : "F";
          const pickedOptKey = stuSub === "Đ" ? "T" : stuSub === "S" ? "F" : "";
          const isSubRight = stuSub === corSub;

          const subCoords = qCoords.filter((b: any) => b.subKey === sk);
          subCoords.forEach((b: any) => {
            const bOpt = String(b.optionKey || "").toUpperCase();
            if (bOpt === pickedOptKey) {
              b.status = isSubRight ? "correct" : "wrong";
            } else if (!isSubRight && bOpt === expectedOptKey) {
              b.status = "expected_missed";
            }
          });

          if (
            !isSubRight &&
            !subCoords.some(
              (b: any) => String(b.optionKey || "").toUpperCase() === expectedOptKey
            )
          ) {
            const pos = getCanonicalBubblePosition(2, localNum, expectedOptKey, sk);
            clonedCoords.push({
              id: `p2_q${localNum}_${sk}_expected_${expectedOptKey}`,
              section: "part2",
              questionNumber: localNum,
              subKey: sk,
              optionKey: expectedOptKey,
              x: pos.x,
              y: pos.y,
              r: pos.r,
              status: "expected_missed"
            });
          }
        });
      } else if (partNum === 3) {
        const p3StudentChars = metaItem.p3StudentChars || [];
        const p3CorrectChars = metaItem.p3CorrectChars || [];
        const maxCols = Math.max(p3StudentChars.length, p3CorrectChars.length, 4);
        for (let c = 0; c < Math.min(4, maxCols); c++) {
          const stuCh = p3StudentChars[c] || "";
          const corCh = p3CorrectChars[c] || "";
          const isColRight = Boolean(stuCh) && (finalIsCorrect || stuCh === corCh);

          const colCoords = qCoords.filter((b: any) => Number(b.colIndex ?? 0) === c);
          colCoords.forEach((b: any) => {
            const bKey = String(b.optionKey || "").trim();
            if (stuCh && bKey === stuCh) {
              b.status = isColRight ? "correct" : "wrong";
            } else if (!finalIsCorrect && corCh && bKey === corCh) {
              b.status = "expected_missed";
            }
          });

          if (
            !finalIsCorrect &&
            corCh &&
            stuCh !== corCh &&
            !colCoords.some((b: any) => String(b.optionKey || "").trim() === corCh)
          ) {
            const pos = getCanonicalBubblePosition(3, localNum, corCh, undefined, c);
            clonedCoords.push({
              id: `p3_q${localNum}_c${c}_expected_${corCh}`,
              section: "part3",
              questionNumber: localNum,
              colIndex: c,
              optionKey: corCh,
              x: pos.x,
              y: pos.y,
              r: pos.r,
              status: "expected_missed"
            });
          }
        }
      }
    });
  }

  const wrongRows: WrongQuestionReviewItem[] = allRows
    .filter((r) => !r.isCorrect)
    .map((r) => ({
      questionNumber: r.questionNumber,
      part: r.part,
      studentAnswer: r.studentAnswer,
      correctAnswer: r.correctAnswer
    }));

  const p1Rows = allRows.filter((r) => r.part === "Phần I");
  const p2Rows = allRows.filter((r) => r.part === "Phần II");
  const p3Rows = allRows.filter((r) => r.part === "Phần III");

  const p1Correct = p1Rows.filter((x) => x.isCorrect).length;
  const p2Correct = p2Rows.filter((x) => x.isCorrect).length;
  const p3Correct = p3Rows.filter((x) => x.isCorrect).length;

  const p1Total = p1Rows.length || 12;
  const p2Total = p2Rows.length || 4;
  const p3Total = p3Rows.length || 6;

  return {
    allRows,
    wrongRows,
    part1Summary: `Đúng ${p1Correct}/${p1Total} câu (${
      gradedScores.p1 !== undefined
        ? gradedScores.p1.toFixed(2)
        : ((p1Correct / p1Total) * 3).toFixed(2)
    }đ)`,
    part2Summary: `Đúng ${p2Correct}/${p2Total} câu (${
      gradedScores.p2 !== undefined
        ? gradedScores.p2.toFixed(2)
        : ((p2Correct / p2Total) * 4).toFixed(2)
    }đ)`,
    part3Summary: `Đúng ${p3Correct}/${p3Total} câu (${
      gradedScores.p3 !== undefined
        ? gradedScores.p3.toFixed(2)
        : ((p3Correct / p3Total) * 3).toFixed(2)
    }đ)`,
    correctCount: allRows.filter((r) => r.isCorrect).length,
    totalQuestions: allRows.length,
    parsedMetaList,
    enrichedBubbleCoordinates: clonedCoords
  };
}
export function generateVirtualOMRSheet(
  attempt: any,
  rawQuizObj: any,
  sbd: string,
  studentName: string,
  examTitle?: string,
  examCode: string = "101",
  questionStatusOverrides?: Record<number, boolean>
): {
  dataUrl: string;
  bubbleCoordinates: any[];
  reviewData: ReturnType<typeof buildFullOMRQuestionsReview>;
} {
  const reviewData = buildFullOMRQuestionsReview(
    attempt,
    rawQuizObj,
    questionStatusOverrides
  );

  const cleanSbd = String(sbd || "000001")
    .replace(/\D/g, "")
    .padStart(6, "0")
    .slice(-6);
  const cleanCode = String(examCode || "101")
    .replace(/\D/g, "")
    .padStart(3, "0")
    .slice(-3);
  const titleText = examTitle || attempt?.exam_title || attempt?.examTitle || "Kiểm tra định kỳ";

  const cacheSignature = JSON.stringify({
    sbd: cleanSbd,
    code: cleanCode,
    stu: studentName,
    title: titleText,
    rows: reviewData.allRows.map((r) => [r.questionNumber, r.studentAnswer, r.correctAnswer, r.isCorrect])
  });

  const cached = virtualOMRCache.get(cacheSignature);
  if (cached) {
    return {
      dataUrl: cached.dataUrl,
      bubbleCoordinates: cached.bubbleCoordinates,
      reviewData
    };
  }

  const bubbleCoordinates: any[] = [];
  const W = OMR_CANONICAL_WIDTH; // 1200
  const H = OMR_CANONICAL_HEIGHT; // 1700

  // 1. Tạo tọa độ SBD (6 cột)
  const sbdStartX = 772;
  const sbdColStep = 34;
  const sbdBubbleStartY = 148;
  const sbdRowStep = 24;
  for (let col = 0; col < 6; col++) {
    const pickedDigit = parseInt(cleanSbd[col], 10);
    const cx = sbdStartX + col * sbdColStep;
    for (let d = 0; d <= 9; d++) {
      const cy = sbdBubbleStartY + d * sbdRowStep;
      if (d === pickedDigit) {
        bubbleCoordinates.push({
          id: `sbd_col${col}_${d}`,
          section: "sbd",
          x: cx,
          y: cy,
          r: 8.5,
          isSelected: true,
          status: "detected"
        });
      }
    }
  }

  // 2. Tạo tọa độ Mã đề (3 cột)
  const codeStartX = 1004;
  for (let col = 0; col < 3; col++) {
    const pickedDigit = parseInt(cleanCode[col], 10);
    const cx = codeStartX + col * sbdColStep;
    for (let d = 0; d <= 9; d++) {
      const cy = sbdBubbleStartY + d * sbdRowStep;
      if (d === pickedDigit) {
        bubbleCoordinates.push({
          id: `code_col${col}_${d}`,
          section: "exam_code",
          x: cx,
          y: cy,
          r: 8.5,
          isSelected: true,
          status: "detected"
        });
      }
    }
  }

  // 3. Tạo tọa độ cho Phần I, Phần II, Phần III kèm `expected_missed`
  reviewData.parsedMetaList.forEach((qMeta) => {
    if (qMeta.partNum === 1) {
      const stuKey = qMeta.p1StudentKey || "";
      const corKey = qMeta.p1CorrectKey || "A";
      ["A", "B", "C", "D"].forEach((optKey) => {
        const pos = getCanonicalBubblePosition(1, qMeta.localNum, optKey);
        if (optKey === stuKey) {
          bubbleCoordinates.push({
            id: `p1_q${qMeta.localNum}_${optKey}`,
            section: "part1",
            questionNumber: qMeta.localNum,
            optionKey: optKey,
            x: pos.x,
            y: pos.y,
            r: pos.r,
            isSelected: true,
            status: qMeta.isCorrect ? "correct" : "wrong"
          });
        } else if (!qMeta.isCorrect && optKey === corKey) {
          bubbleCoordinates.push({
            id: `p1_q${qMeta.localNum}_${optKey}`,
            section: "part1",
            questionNumber: qMeta.localNum,
            optionKey: optKey,
            x: pos.x,
            y: pos.y,
            r: pos.r,
            isSelected: false,
            status: "expected_missed"
          });
        }
      });
    } else if (qMeta.partNum === 2) {
      (["a", "b", "c", "d"] as const).forEach((sk) => {
        const stuSub = qMeta.p2StudentSubMap?.[sk] || "-";
        const corSub = qMeta.p2CorrectSubMap?.[sk] || "Đ";
        const isSubRight = qMeta.isCorrect ? true : stuSub === corSub;

        const pickedOptKey = stuSub === "Đ" ? "T" : stuSub === "S" ? "F" : "";
        const expectedOptKey = corSub === "Đ" ? "T" : "F";

        (["T", "F"] as const).forEach((optK) => {
          const pos = getCanonicalBubblePosition(2, qMeta.localNum, optK, sk);
          if (optK === pickedOptKey) {
            bubbleCoordinates.push({
              id: `p2_q${qMeta.localNum}_${sk}_${optK}`,
              section: "part2",
              questionNumber: qMeta.localNum,
              subKey: sk,
              optionKey: optK,
              x: pos.x,
              y: pos.y,
              r: pos.r,
              isSelected: true,
              status: isSubRight ? "correct" : "wrong"
            });
          } else if (!isSubRight && optK === expectedOptKey) {
            bubbleCoordinates.push({
              id: `p2_q${qMeta.localNum}_${sk}_${optK}`,
              section: "part2",
              questionNumber: qMeta.localNum,
              subKey: sk,
              optionKey: optK,
              x: pos.x,
              y: pos.y,
              r: pos.r,
              isSelected: false,
              status: "expected_missed"
            });
          }
        });
      });
    } else if (qMeta.partNum === 3) {
      const stuChars = qMeta.p3StudentChars || [];
      const corChars = qMeta.p3CorrectChars || [];
      for (let c = 0; c < 4; c++) {
        const stuCh = stuChars[c] || "";
        const corCh = corChars[c] || "";
        const isColRight = Boolean(stuCh) && (qMeta.isCorrect || stuCh === corCh);

        if (stuCh) {
          const pos = getCanonicalBubblePosition(3, qMeta.localNum, stuCh, undefined, c);
          bubbleCoordinates.push({
            id: `p3_q${qMeta.localNum}_c${c}_${stuCh}`,
            section: "part3",
            questionNumber: qMeta.localNum,
            colIndex: c,
            optionKey: stuCh,
            x: pos.x,
            y: pos.y,
            r: pos.r,
            isSelected: true,
            status: isColRight ? "correct" : "wrong"
          });
        }

        if (!qMeta.isCorrect && corCh && stuCh !== corCh) {
          const pos = getCanonicalBubblePosition(3, qMeta.localNum, corCh, undefined, c);
          bubbleCoordinates.push({
            id: `p3_q${qMeta.localNum}_c${c}_expected_${corCh}`,
            section: "part3",
            questionNumber: qMeta.localNum,
            colIndex: c,
            optionKey: corCh,
            x: pos.x,
            y: pos.y,
            r: pos.r,
            isSelected: false,
            status: "expected_missed"
          });
        }
      }
    }
  });

  if (typeof document === "undefined") {
    return { dataUrl: "", bubbleCoordinates, reviewData };
  }

  // 4. Vẽ phôi phiếu A4 chuẩn TCT (1200 x 1700) và vết chấm chì mô phỏng lên Canvas
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { dataUrl: "", bubbleCoordinates, reviewData };
  }

  const FONT_SERIF = "'Times New Roman', Times, serif";
  const PENCIL_FILL = "rgba(45, 45, 45, 0.85)";

  // Nền giấy trắng hơi ngà tự nhiên
  ctx.fillStyle = "#FCFDFE";
  ctx.fillRect(0, 0, W, H);

  // Viền ngoài trang phiếu
  ctx.strokeStyle = "#94A3B8";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // 4 Mốc vuông đen định vị ở 4 góc
  const markerSize = 34;
  ctx.fillStyle = "#0F172A";
  ctx.fillRect(36, 36, markerSize, markerSize);
  ctx.fillRect(W - 36 - markerSize, 36, markerSize, markerSize);
  ctx.fillRect(36, H - 36 - markerSize, markerSize, markerSize);
  ctx.fillRect(W - 36 - markerSize, H - 36 - markerSize, markerSize, markerSize);

  // KHỐI HEADER TRÁI: THÔNG TIN KỲ THI & THÍ SINH
  drawRoundedRect(ctx, 84, 52, 636, 350, 8, "#FFFFFF", "#475569", 1.8);

  // Logo TCT
  drawRoundedRect(ctx, 102, 66, 110, 46, 6, "#003399");
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 24px " + FONT_SERIF;
  ctx.textAlign = "center";
  ctx.fillText("TCT", 157, 94);
  ctx.font = "bold 9px " + FONT_SERIF;
  ctx.fillText("TÂM CHÍ TÀI", 157, 107);

  ctx.textAlign = "left";
  ctx.fillStyle = "#003399";
  ctx.font = "bold italic 16px " + FONT_SERIF;
  ctx.fillText("Chuyên luyện thi vào 10, HSA, TSA và THPT", 226, 84);
  ctx.fillStyle = "#334155";
  ctx.font = "bold 13px " + FONT_SERIF;
  ctx.fillText("CHUYÊN TOÁN TƯ DUY - TRẮC NGHIỆM TIA CHỚP", 226, 105);

  ctx.textAlign = "center";
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 22px " + FONT_SERIF;
  ctx.fillText("PHIẾU TRẢ LỜI TRẮC NGHIỆM", 402, 148);
  ctx.fillStyle = "#1E293B";
  ctx.font = "bold 14.5px " + FONT_SERIF;
  ctx.fillText(`Chuyên đề: ${String(titleText).slice(0, 52)}`, 402, 173);

  ctx.textAlign = "left";
  const infoLines = [
    { label: "1. Hội đồng thi:", val: "Trung tâm Toán Tâm Chí Tài (TCT)" },
    { label: "2. Điểm thi:", val: "Cơ sở Số 10 Tạ Quang Bửu - Bách Khoa - Hà Nội" },
    { label: "3. Họ và tên thí sinh:", val: studentName, highlight: true },
    {
      label: "4. Hình thức bài làm:",
      val: "Hệ thống đồng bộ tự động (Phiếu đối soát OMR)"
    },
    {
      label: "5. Kết quả chấm:",
      val: `Đúng ${reviewData.correctCount}/${reviewData.totalQuestions} câu`
    }
  ];

  infoLines.forEach((line, idx) => {
    const ly = 212 + idx * 34;
    ctx.fillStyle = "#334155";
    ctx.font = "14.5px " + FONT_SERIF;
    ctx.fillText(line.label, 108, ly);

    ctx.fillStyle = line.highlight ? "#003399" : "#0F172A";
    ctx.font = (line.highlight ? "bold 17px " : "bold 14.5px ") + FONT_SERIF;
    ctx.fillText(line.val, 260, ly);

    ctx.strokeStyle = "#CBD5E1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(255, ly + 6);
    ctx.lineTo(695, ly + 6);
    ctx.stroke();
  });

  // KHỐI HEADER PHẢI: SỐ BÁO DANH & MÃ ĐỀ THI
  drawRoundedRect(ctx, 736, 52, 380, 350, 8, "#FFFFFF", "#475569", 1.8);

  ctx.textAlign = "center";
  ctx.fillStyle = "#003399";
  ctx.font = "bold 13.5px " + FONT_SERIF;
  ctx.fillText("7. SỐ BÁO DANH", 856, 76);
  ctx.fillText("8. MÃ ĐỀ THI", 1038, 76);

  // Vẽ 6 cột SBD
  for (let col = 0; col < 6; col++) {
    const cx = sbdStartX + col * sbdColStep;
    drawRoundedRect(ctx, cx - 14, 86, 28, 32, 3, "#F8FAFC", "#475569", 1.2);
    ctx.fillStyle = "#003399";
    ctx.font = "bold 17px " + FONT_SERIF;
    ctx.fillText(cleanSbd[col], cx, 108);

    const pickedDigit = parseInt(cleanSbd[col], 10);
    for (let d = 0; d <= 9; d++) {
      const cy = sbdBubbleStartY + d * sbdRowStep;
      ctx.beginPath();
      ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
      if (d === pickedDigit) {
        ctx.fillStyle = PENCIL_FILL;
        ctx.fill();
      } else {
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.strokeStyle = "#64748B";
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.fillStyle = "#475569";
        ctx.font = "bold 10px " + FONT_SERIF;
        ctx.fillText(String(d), cx, cy + 3.5);
      }
    }
  }

  // Vẽ 3 cột Mã đề
  for (let col = 0; col < 3; col++) {
    const cx = codeStartX + col * sbdColStep;
    drawRoundedRect(ctx, cx - 14, 86, 28, 32, 3, "#F8FAFC", "#475569", 1.2);
    ctx.fillStyle = "#003399";
    ctx.font = "bold 17px " + FONT_SERIF;
    ctx.fillText(cleanCode[col], cx, 108);

    const pickedDigit = parseInt(cleanCode[col], 10);
    for (let d = 0; d <= 9; d++) {
      const cy = sbdBubbleStartY + d * sbdRowStep;
      ctx.beginPath();
      ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
      if (d === pickedDigit) {
        ctx.fillStyle = PENCIL_FILL;
        ctx.fill();
      } else {
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.strokeStyle = "#64748B";
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.fillStyle = "#475569";
        ctx.font = "bold 10px " + FONT_SERIF;
        ctx.fillText(String(d), cx, cy + 3.5);
      }
    }
  }

  // =========================================================================
  // PHẦN I: TRẮC NGHIỆM NHIỀU PHƯƠNG ÁN LỰA CHỌN (A, B, C, D)
  // =========================================================================
  ctx.textAlign = "left";
  ctx.fillStyle = "#003399";
  ctx.font = "bold 15.5px " + FONT_SERIF;
  ctx.fillText(
    "PHẦN I. Thí sinh trả lời từ câu 1 đến câu 12 (Mỗi câu chỉ tô một phương án A, B, C hoặc D)",
    84,
    436
  );

  drawRoundedRect(ctx, 84, 448, 1032, 290, 8, "#FFFFFF", "#475569", 1.6);

  const p1Metas = reviewData.parsedMetaList.filter((m) => m.partNum === 1);
  const p1MaxQ = Math.max(12, p1Metas.length);

  for (let colGroup = 0; colGroup < 3; colGroup++) {
    const baseGroupX = 115 + colGroup * 340;
    ["A", "B", "C", "D"].forEach((optK, oIdx) => {
      ctx.textAlign = "center";
      ctx.fillStyle = "#003399";
      ctx.font = "bold 14px " + FONT_SERIF;
      ctx.fillText(optK, baseGroupX + 58 + oIdx * 56, 478);
    });
  }

  for (let q = 1; q <= Math.min(18, p1MaxQ); q++) {
    const colGroup = Math.floor((q - 1) / 6);
    const rowInCol = (q - 1) % 6;
    const baseGroupX = 115 + colGroup * 340;
    const cy = 515 + rowInCol * 38;

    ctx.textAlign = "right";
    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 14.5px " + FONT_SERIF;
    ctx.fillText(String(q), baseGroupX + 22, cy + 5);

    const qMeta = p1Metas.find((m) => m.localNum === q);
    const stuKey = qMeta?.p1StudentKey || "";

    ["A", "B", "C", "D"].forEach((optK) => {
      const pos = getCanonicalBubblePosition(1, q, optK);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pos.r, 0, Math.PI * 2);
      if (stuKey === optK) {
        ctx.fillStyle = PENCIL_FILL;
        ctx.fill();
      } else {
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
        ctx.strokeStyle = "#64748B";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillStyle = "#475569";
        ctx.font = "bold 11.5px " + FONT_SERIF;
        ctx.fillText(optK, pos.x, pos.y + 4);
      }
    });
  }

  // =========================================================================
  // PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI (4 CÂU x 4 MỆNH ĐỀ a, b, c, d)
  // =========================================================================
  ctx.textAlign = "left";
  ctx.fillStyle = "#003399";
  ctx.font = "bold 15.5px " + FONT_SERIF;
  ctx.fillText(
    "PHẦN II. Thí sinh trả lời từ câu 1 đến câu 4. Trong mỗi ý a), b), c), d) thí sinh chọn Đúng hoặc Sai",
    84,
    774
  );

  drawRoundedRect(ctx, 84, 786, 1032, 240, 8, "#FFFFFF", "#475569", 1.6);

  const p2Metas = reviewData.parsedMetaList.filter((m) => m.partNum === 2);

  for (let q = 1; q <= 4; q++) {
    const boxX = 95 + (q - 1) * 260;
    drawRoundedRect(ctx, boxX, 800, 232, 212, 6, "#F8FAFC", "#94A3B8", 1.2);

    ctx.textAlign = "left";
    ctx.fillStyle = "#003399";
    ctx.font = "bold 15px " + FONT_SERIF;
    ctx.fillText(`Câu ${q}`, boxX + 18, 828);

    ctx.textAlign = "center";
    ctx.fillStyle = "#1E293B";
    ctx.font = "bold 13px " + FONT_SERIF;
    ctx.fillText("Đúng", boxX + 118, 830);
    ctx.fillText("Sai", boxX + 186, 830);

    const qMeta = p2Metas.find((m) => m.localNum === q);

    (["a", "b", "c", "d"] as const).forEach((sk, sIdx) => {
      const cy = 868 + sIdx * 40;
      ctx.textAlign = "left";
      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 15px " + FONT_SERIF;
      ctx.fillText(`${sk})`, boxX + 24, cy + 5);

      const stuSub = qMeta?.p2StudentSubMap?.[sk] || "-";
      const pickedOptKey = stuSub === "Đ" ? "T" : stuSub === "S" ? "F" : "";

      (["T", "F"] as const).forEach((optK) => {
        const pos = getCanonicalBubblePosition(2, q, optK, sk);
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, pos.r, 0, Math.PI * 2);
        if (pickedOptKey === optK) {
          ctx.fillStyle = PENCIL_FILL;
          ctx.fill();
        } else {
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
          ctx.strokeStyle = "#64748B";
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.textAlign = "center";
          ctx.fillStyle = "#64748B";
          ctx.font = "bold 11px " + FONT_SERIF;
          ctx.fillText(optK === "T" ? "Đ" : "S", pos.x, pos.y + 4);
        }
      });
    });
  }

  // =========================================================================
  // PHẦN III: TRẢ LỜI NGẮN — ĐIỀN ĐÁP SỐ (6 CÂU)
  // =========================================================================
  ctx.textAlign = "left";
  ctx.fillStyle = "#003399";
  ctx.font = "bold 15.5px " + FONT_SERIF;
  ctx.fillText(
    "PHẦN III. Thí sinh trả lời từ câu 1 đến câu 6 (Ghi và tô kết quả số vào các ô tương ứng)",
    84,
    1062
  );

  drawRoundedRect(ctx, 84, 1074, 1032, 526, 8, "#FFFFFF", "#475569", 1.6);

  const p3Metas = reviewData.parsedMetaList.filter((m) => m.partNum === 3);

  for (let q = 1; q <= 6; q++) {
    const boxX = 88 + (q - 1) * 174;
    drawRoundedRect(ctx, boxX + 4, 1086, 162, 502, 6, "#F8FAFC", "#94A3B8", 1.2);

    ctx.textAlign = "center";
    ctx.fillStyle = "#003399";
    ctx.font = "bold 15px " + FONT_SERIF;
    ctx.fillText(`Câu ${q}`, boxX + 85, 1110);

    const qMeta = p3Metas.find((m) => m.localNum === q);
    const stuChars = qMeta?.p3StudentChars || [];

    // 4 ô viết tay đáp số ở đỉnh mỗi cột câu
    for (let c = 0; c < 4; c++) {
      const cx = boxX + 32 + c * 36;
      drawRoundedRect(ctx, cx - 15, 1120, 30, 32, 3, "#FFFFFF", "#475569", 1.2);
      if (stuChars[c]) {
        ctx.fillStyle = "#003399";
        ctx.font = "bold 17px " + FONT_SERIF;
        ctx.fillText(stuChars[c], cx, 1143);
      }
    }

    // Các hàng tô dấu (-), dấu (,) và các chữ số 0..9
    const rowSymbols = ["-", ",", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
    rowSymbols.forEach((sym, rIdx) => {
      const cy = 1190 + rIdx * 32;
      for (let c = 0; c < 4; c++) {
        // Dấu (-) chỉ ở cột đầu, dấu (,) ở cột 2 & 3
        if (sym === "-" && c > 0) continue;
        if (sym === "," && (c === 0 || c === 3)) continue;

        const cx = boxX + 32 + c * 36;
        const isPicked = stuChars[c] === sym || (sym === "," && stuChars[c] === ".");

        ctx.beginPath();
        ctx.arc(cx, cy, 9.5, 0, Math.PI * 2);
        if (isPicked) {
          ctx.fillStyle = PENCIL_FILL;
          ctx.fill();
        } else {
          ctx.fillStyle = "#FFFFFF";
          ctx.fill();
          ctx.strokeStyle = "#64748B";
          ctx.lineWidth = 1.1;
          ctx.stroke();
          ctx.textAlign = "center";
          ctx.fillStyle = "#475569";
          ctx.font = "bold 10.5px " + FONT_SERIF;
          ctx.fillText(sym, cx, cy + 3.5);
        }
      }
    });
  }

  // CHÂN TRANG TRÊN PHIẾU OMR
  ctx.textAlign = "center";
  ctx.fillStyle = "#334155";
  ctx.font = "bold 13.5px " + FONT_SERIF;
  ctx.fillText(
    "TRUNG TÂM TOÁN TÂM CHÍ TÀI (TCT)  •  Hotline: 0972 26 16 16  •  Số 10, Tạ Quang Bửu, Bách Khoa, Hà Nội",
    W / 2,
    1642
  );

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  virtualOMRCache.set(cacheSignature, { dataUrl, bubbleCoordinates });

  return {
    dataUrl,
    bubbleCoordinates,
    reviewData
  };
}

export default function AdminStudentReportPanel({
  registeredStudents = [],
  allAttempts = [],
  chapters = [],
  practiceExams = [],
  attendanceRecords = []
}: Props) {
  const currentRealtimeMonth = useMemo(() => new Date().getMonth() + 1, []);
  const todayFormatted = useMemo(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}/${d.getFullYear()}`;
  }, []);

  const defaultMakeupIsoDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  }, []);

  const [reportViewType, setReportViewType] = useState<"daily" | "monthly" | "manual">("daily");
  const reportMode = reportViewType === "manual" ? "manual" : "auto";

  const [dailyMonth, setDailyMonth] = useState<number>(currentRealtimeMonth);
  const [dailyWeek, setDailyWeek] = useState<number>(4);
  const [customDateStr, setCustomDateStr] = useState<string>(todayFormatted);
  const [overrideTopicTitle, setOverrideTopicTitle] = useState<string>("");

  const [selectedDailyHomeworkSource, setSelectedDailyHomeworkSource] =
    useState<string>("auto_prev");
  const [selectedDailyPracticeId, setSelectedDailyPracticeId] = useState<string>("none");
  const [dailyStudentFilterMode, setDailyStudentFilterMode] = useState<
    "all" | "offline" | "online"
  >("all");
  const [includeCoverSummaryPage, setIncludeCoverSummaryPage] = useState<boolean>(true);

  // STATE CHỌN HỌC SINH ĐỂ XUẤT PDF (CHECKBOX)
  const [selectedExportStudentIds, setSelectedExportStudentIds] = useState<Set<string>>(
    new Set()
  );
  const hasInitializedSelectionRef = useRef<boolean>(false);

  // STATE FORM CHỌN LỊCH BÙ / BỔ TRỢ LINH HOẠT
  const [schedulerIsoDate, setSchedulerIsoDate] = useState<string>(defaultMakeupIsoDate);
  const [schedulerSessionType, setSchedulerSessionType] = useState<"makeup" | "support">(
    "makeup"
  );
  const [schedulerNote, setSchedulerNote] = useState<string>("");
  const [showSupportSchedulerPanel, setShowSupportSchedulerPanel] = useState<boolean>(false);

  // GHI NHẬN CHỈNH SỬA THỦ CÔNG ĐIỂM SỐ / ĐIỂM DANH 3 TRẠNG THÁI / LỊCH HỌC BÙ / BỔ TRỢ
  const [dailyStudentOverrides, setDailyStudentOverrides] = useState<
    Record<
      string,
      {
        homeworkScore?: string;
        dailyTestScore?: string;
        practiceScore?: string;
        teacherComment?: string;
        attendance?: "present" | "late" | "absent";
        attendanceStatus?: ExtendedAttendanceStatus;
        homeworkStatus?: "completed" | "missing" | "late";
        questionStatusOverrides?: Record<number, boolean>;
        makeupSessions?: MakeupSupportSessionItem[];
      }
    >
  >({});

  const [showOfficialModal, setShowOfficialModal] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [renderedImageUrls, setRenderedImageUrls] = useState<{
    page1: string | null;
    page2: string | null;
  }>({
    page1: null,
    page2: null,
  });

  const [showPracticePickerModal, setShowPracticePickerModal] = useState<boolean>(false);
  const [practiceMonthFilter, setPracticeMonthFilter] = useState<string>("all");
  const [previewPaperItem, setPreviewPaperItem] = useState<SelectedPracticeExamItem | null>(null);
  const [paperZoom, setPaperZoom] = useState<number>(1);

  const reportPage1Ref = useRef<HTMLDivElement>(null);
  const reportPage2Ref = useRef<HTMLDivElement>(null);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    registeredStudents[0]?.id || ""
  );
  const [searchStudent, setSearchStudent] = useState<string>("");
  const [reportMonth, setReportMonth] = useState<number>(currentRealtimeMonth);
  const [autoTeacherEvaluation, setAutoTeacherEvaluation] = useState<string>(
    "- Chuyên cần & Thái độ: Con đi học đầy đủ và luôn đúng giờ. Trong giờ học, con ngoan, tập trung và có tinh thần tự giác tốt.\n\n" +
      "- Khả năng tiếp thu: Con nắm được các dạng toán cơ bản và hiểu bài ổn định. Tuy nhiên, ở một số dạng bài mới hoặc nâng cao, con vẫn còn phản xạ hơi chậm.\n\n" +
      "- Nội quy lớp học: Em đã tiến hành thu điện thoại của con trong giờ học và đề nghị con nghiêm túc chấp hành nội quy này.\n\n" +
      "- Kết quả kiểm tra: Con đã có nhiều tiến bộ, cần lưu ý cẩn thận hơn ở khâu biến đổi tính toán và trình bày để tránh mất điểm đáng tiếc.\n\n" +
      "- Định hướng giai đoạn tới: Gia đình cùng nhắc nhở con duy trì làm bài tập về nhà và luyện đề bấm giờ đều đặn. Thầy luôn sẵn sàng hỗ trợ giải đáp bất cứ khi nào con gặp khó khăn."
  );

  const [selectedPracticeExams, setSelectedPracticeExams] = useState<SelectedPracticeExamItem[]>(
    []
  );

  const [manualForm, setManualForm] = useState({
    fullName: "Trương Ngọc Dũng",
    school: "THPT Lê Quý Đôn",
    grade: "Lớp 12",
    reportMonth: currentRealtimeMonth,
    evaluation:
      "- Chuyên cần & Thái độ: Con đi học đầy đủ và luôn đúng giờ. Trong giờ học, con ngoan, tập trung và có tinh thần tự giác tốt.\n\n" +
      "- Khả năng tiếp thu: Con nắm được các dạng toán cơ bản và hiểu bài ổn định. Tuy nhiên, ở một số dạng bài mới hoặc nâng cao, con vẫn còn phản xạ hơi chậm.\n\n" +
      "- Nội quy lớp học: Em đã tiến hành thu điện thoại của con trong giờ học và đề nghị con nghiêm túc chấp hành nội quy này.\n\n" +
      "- Kết quả kiểm tra: Con đã có nhiều tiến bộ, cần lưu ý cẩn thận hơn ở khâu biến đổi tính toán và trình bày để tránh mất điểm đáng tiếc.\n\n" +
      "- Định hướng giai đoạn tới: Gia đình cùng nhắc nhở con duy trì làm bài tập về nhà và luyện đề bấm giờ đều đặn. Thầy luôn sẵn sàng hỗ trợ giải đáp bất cứ khi nào con gặp khó khăn."
  });

  const [manualHWScores, setManualHWScores] = useState<{ [key: number]: string }>({
    1: "8.5",
    2: "9.0",
    3: "8.0",
    4: "",
    5: ""
  });

  const [manualTestScores, setManualTestScores] = useState<{ [key: number]: string }>({
    1: "7.5",
    2: "8.0",
    3: "",
    4: "",
    5: ""
  });

  /**
   * 1. CỐ ĐỊNH VĨNH VIỄN SỐ BÁO DANH (SBD) — TUYỆT ĐỐI KHÔNG DÙNG INDEX + 1
   * - Luôn ưu tiên đọc trực tiếp trường `sbd` đã lưu trong CSDL của từng học sinh.
   * - Học sinh mới thêm vào tự động nhận `MAX(sbd) + 1` và lưu bền vững vào `edunexus_permanent_sbd_map`.
   */
  const sbdDirectoryMap = useMemo(() => {
    const permanentMap: Record<string, string> = {};
    let maxSbdNumber = 0;

    if (typeof window !== "undefined") {
      try {
        const savedMapRaw = localStorage.getItem("edunexus_permanent_sbd_map");
        if (savedMapRaw) {
          const parsed = JSON.parse(savedMapRaw);
          if (parsed && typeof parsed === "object") {
            Object.entries(parsed).forEach(([stuId, sbdVal]) => {
              const cleanSbd = String(sbdVal || "").trim();
              if (/^\d{6}$/.test(cleanSbd)) {
                permanentMap[stuId] = cleanSbd;
                const num = parseInt(cleanSbd, 10);
                if (!isNaN(num) && num > maxSbdNumber) {
                  maxSbdNumber = num;
                }
              }
            });
          }
        }

        const savedDirRaw = localStorage.getItem("edunexus_sbd_directory");
        if (savedDirRaw) {
          const parsedDir = JSON.parse(savedDirRaw);
          if (Array.isArray(parsedDir)) {
            parsedDir.forEach((entry: any) => {
              const stuId = String(entry?.id || "").trim();
              const cleanSbd = String(entry?.sbd || "").trim();
              if (stuId && /^\d{6}$/.test(cleanSbd) && !permanentMap[stuId]) {
                permanentMap[stuId] = cleanSbd;
                const num = parseInt(cleanSbd, 10);
                if (!isNaN(num) && num > maxSbdNumber) {
                  maxSbdNumber = num;
                }
              }
            });
          }
        }
      } catch {}
    }

    const validStudents = [...(registeredStudents || [])].filter(Boolean);
    validStudents.forEach((stu) => {
      const id = String(stu.id || "").trim();
      if (!id) return;
      if (stu.sbd) {
        const cleanSbd = String(stu.sbd).replace(/\D/g, "").padStart(6, "0").slice(-6);
        if (/^\d{6}$/.test(cleanSbd) && cleanSbd !== "000000") {
          permanentMap[id] = cleanSbd;
          const num = parseInt(cleanSbd, 10);
          if (!isNaN(num) && num > maxSbdNumber) {
            maxSbdNumber = num;
          }
        }
      }
    });

    const unassignedStudents = validStudents.filter((stu) => {
      const id = String(stu.id || "").trim();
      return id && !permanentMap[id];
    });

    unassignedStudents.forEach((stu) => {
      const id = String(stu.id || "").trim();
      maxSbdNumber += 1;
      permanentMap[id] = formatStudentAutoSBD(maxSbdNumber);
    });

    if (typeof window !== "undefined" && Object.keys(permanentMap).length > 0) {
      try {
        localStorage.setItem("edunexus_permanent_sbd_map", JSON.stringify(permanentMap));
      } catch {}
    }

    const result = new Map<string, { sbd: string; stt: number; mode: "Online" | "Offline" }>();
    validStudents.forEach((stu, idx) => {
      const id = String(stu.id || "").trim();
      const rawMode = String(stu.learning_mode || stu.study_mode || "offline").toLowerCase();
      const dbSbd = stu.sbd
        ? String(stu.sbd).replace(/\D/g, "").padStart(6, "0").slice(-6)
        : "";
      const fixedSbd =
        (/^\d{6}$/.test(dbSbd) && dbSbd !== "000000" ? dbSbd : permanentMap[id]) ||
        formatStudentAutoSBD(maxSbdNumber + idx + 1);

      result.set(id, {
        stt: parseInt(fixedSbd, 10) || idx + 1,
        sbd: fixedSbd,
        mode: rawMode.includes("on") ? "Online" : "Offline"
      });
    });

    return result;
  }, [registeredStudents]);

  // 2. TRẢI PHẲNG TOÀN BỘ DANH SÁCH BÀI HỌC TRONG KHÓA HỌC THEO THỨ TỰ THỜI GIAN
  const allFlattenedLessons = useMemo<FlattenedLessonEntry[]>(() => {
    const list: FlattenedLessonEntry[] = [];
    let orderCounter = 0;

    (chapters || []).forEach((chap: any) => {
      const cMonth = chap?.assigned_month ? Number(chap.assigned_month) : undefined;
      const cWeek = chap?.assigned_week ? Number(chap.assigned_week) : undefined;

      (chap?.lessons || []).forEach((les: any) => {
        if (!les) return;
        const lMonth = Number(les.assigned_month || cMonth || 10);
        const lWeek = Number(les.assigned_week || cWeek || 1);

        const hwItems: { id: string; title: string; rawObj: any }[] = [];
        const testItems: { id: string; title: string; rawObj: any }[] = [];
        const hwIds = new Set<string>();
        const hwTitles = new Set<string>();
        const testIds = new Set<string>();
        const testTitles = new Set<string>();

        (les.homework_files || []).forEach((hw: any) => {
          if (!hw || hw.is_drive_file) return;
          const id = String(hw.id || "").trim();
          const title = String(hw.title || "Bài tập về nhà").trim();
          hwItems.push({ id, title, rawObj: hw });
          if (id) hwIds.add(id.toLowerCase());
          if (title) hwTitles.add(normalizeText(title));
        });

        (les.test_quizzes || []).forEach((tq: any) => {
          if (!tq || tq.is_drive_file) return;
          const id = String(tq.id || "").trim();
          const title = String(tq.title || "Bài kiểm tra").trim();
          testItems.push({ id, title, rawObj: tq });
          if (id) testIds.add(id.toLowerCase());
          if (title) testTitles.add(normalizeText(title));
        });

        list.push({
          lessonId: String(les.id || `les_${orderCounter}`),
          lessonTitle: String(les.title || "Bài học"),
          chapterId: String(chap?.id || ""),
          chapterTitle: String(chap?.title || ""),
          month: lMonth,
          week: lWeek,
          globalOrder: orderCounter++,
          hwItems,
          testItems,
          hwIds,
          hwTitles,
          testIds,
          testTitles
        });
      });
    });

    return list;
  }, [chapters]);

  const currentSessionLessons = useMemo(() => {
    return allFlattenedLessons.filter(
      (l) => l.month === dailyMonth && l.week === dailyWeek
    );
  }, [allFlattenedLessons, dailyMonth, dailyWeek]);

  const autoSyncedTopicTitle = useMemo(() => {
    if (currentSessionLessons.length > 0) {
      return currentSessionLessons.map((m) => m.lessonTitle).join(" • ");
    }
    if (allFlattenedLessons.length > 0) {
      return allFlattenedLessons[0].lessonTitle;
    }
    return `Chuyên đề Toán 12 — Tuần ${dailyWeek} Tháng ${dailyMonth}`;
  }, [currentSessionLessons, allFlattenedLessons, dailyWeek, dailyMonth]);

  useEffect(() => {
    setOverrideTopicTitle("");
  }, [dailyMonth, dailyWeek]);

  const autoPreviousHomeworkSource = useMemo(() => {
    const prevMonth = dailyWeek > 1 ? dailyMonth : dailyMonth === 1 ? 12 : dailyMonth - 1;

    if (dailyWeek > 1) {
      const targetPrevWeek = dailyWeek - 1;
      const lessonsInPrevWeek = allFlattenedLessons.filter(
        (l) => l.month === dailyMonth && l.week === targetPrevWeek && l.hwItems.length > 0
      );
      if (lessonsInPrevWeek.length > 0) {
        return {
          modeLabel: `Tuần ${targetPrevWeek} - Tháng ${dailyMonth}`,
          lessons: lessonsInPrevWeek,
          displayTitle: lessonsInPrevWeek
            .flatMap((l) => l.hwItems.map((h) => h.title))
            .join(", ")
        };
      }
    } else {
      for (let w = 5; w >= 1; w--) {
        const lessonsInLastMonth = allFlattenedLessons.filter(
          (l) => l.month === prevMonth && l.week === w && l.hwItems.length > 0
        );
        if (lessonsInLastMonth.length > 0) {
          return {
            modeLabel: `Tuần ${w} - Tháng ${prevMonth}`,
            lessons: lessonsInLastMonth,
            displayTitle: lessonsInLastMonth
              .flatMap((l) => l.hwItems.map((h) => h.title))
              .join(", ")
          };
        }
      }
    }

    if (currentSessionLessons.length > 0) {
      const firstCurrentOrder = currentSessionLessons[0].globalOrder;
      for (let idx = firstCurrentOrder - 1; idx >= 0; idx--) {
        const candidate = allFlattenedLessons[idx];
        if (candidate && candidate.hwItems.length > 0) {
          return {
            modeLabel: `Tuần ${candidate.week} - Tháng ${candidate.month}`,
            lessons: [candidate],
            displayTitle: candidate.hwItems.map((h) => h.title).join(", ")
          };
        }
      }
    }

    if (currentSessionLessons.some((l) => l.hwItems.length > 0)) {
      const withHw = currentSessionLessons.filter((l) => l.hwItems.length > 0);
      return {
        modeLabel: `Tuần ${dailyWeek} - Tháng ${dailyMonth}`,
        lessons: withHw,
        displayTitle: withHw.flatMap((l) => l.hwItems.map((h) => h.title)).join(", ")
      };
    }

    const anyWithHw = allFlattenedLessons.filter((l) => l.hwItems.length > 0);
    if (anyWithHw.length > 0) {
      const last = anyWithHw[anyWithHw.length - 1];
      return {
        modeLabel: `Tuần ${last.week} - Tháng ${last.month}`,
        lessons: [last],
        displayTitle: last.hwItems.map((h) => h.title).join(", ")
      };
    }

    return {
      modeLabel: "Tuần trước",
      lessons: [] as FlattenedLessonEntry[],
      displayTitle: "Bài tập về nhà tuần trước"
    };
  }, [allFlattenedLessons, currentSessionLessons, dailyMonth, dailyWeek]);

  const allHomeworkOptionsForDropdown = useMemo(() => {
    const options: {
      value: string;
      label: string;
      hwIds: Set<string>;
      hwTitles: Set<string>;
      month?: number;
      week?: number;
      shortTitle: string;
    }[] = [];

    allFlattenedLessons.forEach((les) => {
      les.hwItems.forEach((hw) => {
        const ids = new Set<string>([hw.id.toLowerCase()]);
        const titles = new Set<string>([normalizeText(hw.title)]);
        options.push({
          value: `hw_id:${hw.id}`,
          label: `[T${les.week}.${les.month} - ${les.lessonTitle}] ${hw.title}`,
          hwIds: ids,
          hwTitles: titles,
          month: les.month,
          week: les.week,
          shortTitle: `${hw.title} (T${les.week}.${les.month})`
        });
      });
    });

    return options;
  }, [allFlattenedLessons]);

  const effectiveHomeworkTarget = useMemo(() => {
    if (selectedDailyHomeworkSource === "none") {
      return {
        isNone: true,
        hwIds: new Set<string>(),
        hwTitles: new Set<string>(),
        targetMonth: undefined as number | undefined,
        targetWeek: undefined as number | undefined,
        displayTitle: "Không thu BTVN buổi này"
      };
    }

    if (selectedDailyHomeworkSource === "current_week") {
      const ids = new Set<string>();
      const titles = new Set<string>();
      const names: string[] = [];
      currentSessionLessons.forEach((l) => {
        l.hwIds.forEach((id) => ids.add(id));
        l.hwTitles.forEach((t) => titles.add(t));
        l.hwItems.forEach((h) => names.push(h.title));
      });
      return {
        isNone: false,
        hwIds: ids,
        hwTitles: titles,
        targetMonth: dailyMonth,
        targetWeek: dailyWeek,
        displayTitle:
          names.length > 0
            ? `${names.join(", ")} (T${dailyWeek}.${dailyMonth})`
            : `BTVN Tuần ${dailyWeek} - Tháng ${dailyMonth}`
      };
    }

    if (selectedDailyHomeworkSource.startsWith("hw_id:")) {
      const found = allHomeworkOptionsForDropdown.find(
        (o) => o.value === selectedDailyHomeworkSource
      );
      if (found) {
        return {
          isNone: false,
          hwIds: found.hwIds,
          hwTitles: found.hwTitles,
          targetMonth: found.month,
          targetWeek: found.week,
          displayTitle: found.shortTitle
        };
      }
    }

    const ids = new Set<string>();
    const titles = new Set<string>();
    autoPreviousHomeworkSource.lessons.forEach((l) => {
      l.hwIds.forEach((id) => ids.add(id));
      l.hwTitles.forEach((t) => titles.add(t));
    });
    const firstPrevLesson = autoPreviousHomeworkSource.lessons[0];

    return {
      isNone: false,
      hwIds: ids,
      hwTitles: titles,
      targetMonth: firstPrevLesson?.month,
      targetWeek: firstPrevLesson?.week,
      displayTitle: `${autoPreviousHomeworkSource.displayTitle} (${autoPreviousHomeworkSource.modeLabel})`
    };
  }, [
    selectedDailyHomeworkSource,
    currentSessionLessons,
    dailyMonth,
    dailyWeek,
    allHomeworkOptionsForDropdown,
    autoPreviousHomeworkSource
  ]);

  const quizAssignmentMap = useMemo(() => {
    const byId = new Map<
      string,
      { month?: number; week?: number; isHw?: boolean; isTest?: boolean; category?: string; rawObj?: any }
    >();
    const byTitle = new Map<
      string,
      { month?: number; week?: number; isHw?: boolean; isTest?: boolean; category?: string; rawObj?: any }
    >();

    (chapters || []).forEach((chap: any) => {
      const chapMonth = chap?.assigned_month ? Number(chap.assigned_month) : undefined;
      const chapWeek = chap?.assigned_week ? Number(chap.assigned_week) : undefined;

      (chap?.lessons || []).forEach((les: any) => {
        const lesMonth = les?.assigned_month ? Number(les.assigned_month) : chapMonth;
        const lesWeek = les?.assigned_week ? Number(les.assigned_week) : chapWeek;

        (les?.homework_files || []).forEach((hw: any) => {
          if (!hw) return;
          const m = hw.assigned_month ? Number(hw.assigned_month) : lesMonth;
          const w = hw.assigned_week ? Number(hw.assigned_week) : lesWeek;
          const meta = { month: m, week: w, isHw: true, isTest: false, rawObj: hw };
          if (hw.id) byId.set(String(hw.id).trim().toLowerCase(), meta);
          if (hw.title) byTitle.set(normalizeText(hw.title), meta);
        });

        (les?.test_quizzes || []).forEach((tq: any) => {
          if (!tq) return;
          const m = tq.assigned_month ? Number(tq.assigned_month) : lesMonth;
          const w = tq.assigned_week ? Number(tq.assigned_week) : lesWeek;
          const meta = { month: m, week: w, isHw: false, isTest: true, rawObj: tq };
          if (tq.id) byId.set(String(tq.id).trim().toLowerCase(), meta);
          if (tq.title) byTitle.set(normalizeText(tq.title), meta);
        });
      });
    });

    (practiceExams || []).forEach((pe: any) => {
      if (!pe) return;
      const m = pe.assigned_month ? Number(pe.assigned_month) : undefined;
      const w = pe.assigned_week ? Number(pe.assigned_week) : undefined;
      const meta = {
        month: m,
        week: w,
        isHw: false,
        isTest: false,
        category: pe.category || "Luyện đề",
        rawObj: pe
      };
      if (pe.id) byId.set(String(pe.id).trim().toLowerCase(), meta);
      if (pe.title) byTitle.set(normalizeText(pe.title), meta);
    });

    return { byId, byTitle };
  }, [chapters, practiceExams]);

  const resolveAttemptMonthAndWeek = useCallback(
    (att: any): { month: number; week: number; category?: string; rawQuizObj?: any } => {
      const qId = String(att?.quizId || att?.quiz_id || att?.exam_id || "").trim().toLowerCase();
      const qTitle = normalizeText(
        att?.examTitle || att?.quizTitle || att?.quiz_title || att?.title || ""
      );

      const matchedMeta =
        (qId && quizAssignmentMap.byId.get(qId)) ||
        (qTitle && quizAssignmentMap.byTitle.get(qTitle)) ||
        null;

      const rawDate = att?.createdAt || att?.created_at || att?.submittedAt;
      const parsedDate = rawDate ? new Date(rawDate) : new Date();
      const validDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();

      const resolvedMonth =
        Number(att?.assigned_month) || Number(matchedMeta?.month) || validDate.getMonth() + 1;

      const dayOfMonth = validDate.getDate();
      const fallbackWeekFromDate = Math.min(5, Math.max(1, Math.ceil(dayOfMonth / 7)));

      const resolvedWeek =
        Number(att?.assigned_week) || Number(matchedMeta?.week) || fallbackWeekFromDate;

      return {
        month: resolvedMonth,
        week: Math.min(5, Math.max(1, resolvedWeek)),
        category: matchedMeta?.category || att?.category,
        rawQuizObj: matchedMeta?.rawObj
      };
    },
    [quizAssignmentMap]
  );

  // 4. ENGINE TÍNH ĐIỂM BÁO CÁO NGÀY (ĐỒNG BỘ SBD MỚI NHẤT TỪ OMR & TỰ ĐỘNG DỰNG PHIẾU OMR CANVAS AI)
  const computeStudentDailyScoreRecord = useCallback(
    (
      student: any
    ): StudentDailyScoreData & {
      allQuestionsReviewList?: FullQuestionReviewRow[];
      homeworkQuizTitle?: string;
      attendanceStatus?: ExtendedAttendanceStatus;
      attendanceNote?: string;
      makeupSessions?: MakeupSupportSessionItem[];
    } => {
      const stuId = String(student?.id || "").trim();
      const stuName = String(student?.full_name || student?.name || "Học sinh").trim();
      const dirInfo = sbdDirectoryMap.get(stuId);
      const baseFallbackSbd =
        (student?.sbd
          ? String(student.sbd).replace(/\D/g, "").padStart(6, "0").slice(-6)
          : dirInfo?.sbd) || "000001";
      const learningMode: "Online" | "Offline" = dirInfo?.mode || "Offline";

      const stuAttempts = (allAttempts || []).filter((att: any) => {
        if (!att) return false;
        const aStuId = String(att.studentId || att.student_id || att.user_id || "").trim();
        const aStuName = normalizeText(att.studentName || att.student_name || att.full_name || "");
        const aSbd = String(
          att.omr_raw_data?.detected_sbd ||
            att.answers?.__paper_omr_meta?.detected_sbd ||
            att.sbd ||
            att.detected_sbd ||
            ""
        ).trim();
        return (
          (stuId && aStuId === stuId) ||
          (stuName && aStuName === normalizeText(stuName)) ||
          (baseFallbackSbd && aSbd === baseFallbackSbd)
        );
      });

      let bestHwAttempt: any = null;
      let bestDailyTestAttempt: any = null;
      let bestPracticeAttempt: any = null;

      stuAttempts.forEach((att: any) => {
        const qId = String(att.quizId || att.quiz_id || att.exam_id || "").trim().toLowerCase();
        const qTitle = normalizeText(
          att.examTitle || att.quizTitle || att.quiz_title || att.title || ""
        );
        const meta =
          (qId && quizAssignmentMap.byId.get(qId)) ||
          (qTitle && quizAssignmentMap.byTitle.get(qTitle));

        const { month, week } = resolveAttemptMonthAndWeek(att);
        const isHw = Boolean(
          meta?.isHw || att.type === "homework" || att.isHomework || att.is_homework
        );
        const isPaper =
          att.submission_type === "paper" ||
          Boolean(att.scanned_image_url) ||
          Boolean(att.paper_scan_url) ||
          Boolean(att.omr_raw_data) ||
          Boolean(att.answers?.__paper_omr_meta);

        const isTest = Boolean(meta?.isTest || att.type === "test" || (isPaper && !isHw));
        const sc = Number(att.score ?? att.points ?? 0);

        if (!effectiveHomeworkTarget.isNone && isHw) {
          const matchByIdOrTitle =
            (qId && effectiveHomeworkTarget.hwIds.has(qId)) ||
            (qTitle && effectiveHomeworkTarget.hwTitles.has(qTitle));

          const matchByPrevTime =
            effectiveHomeworkTarget.hwIds.size === 0 &&
            effectiveHomeworkTarget.targetMonth !== undefined &&
            effectiveHomeworkTarget.targetWeek !== undefined &&
            month === effectiveHomeworkTarget.targetMonth &&
            week === effectiveHomeworkTarget.targetWeek;

          if (matchByIdOrTitle || matchByPrevTime) {
            if (
              !bestHwAttempt ||
              sc >= Number(bestHwAttempt.score ?? bestHwAttempt.points ?? 0)
            ) {
              bestHwAttempt = att;
            }
          }
        }

        // Quét tất cả tên đề kiểm tra trong bài học của tuần hiện tại
        const currentSessionTestTitles = new Set<string>();
        currentSessionLessons.forEach((m) => {
          m.testTitles.forEach((t) => currentSessionTestTitles.add(t));
          m.testItems.forEach((item) => {
            if (item.title) currentSessionTestTitles.add(normalizeText(item.title));
          });
        });

        const effectiveSessionTopicNorm = normalizeText(
          overrideTopicTitle || autoSyncedTopicTitle
        );

        // Tự nhận diện nếu đề thi khớp theo ID hoặc khớp theo Tên đề (kể cả làm từ Luyện đề)
        const isMatchedCurrentSessionTest =
          currentSessionLessons.some((m) => qId && m.testIds.has(qId)) ||
          (qTitle && currentSessionTestTitles.has(qTitle)) ||
          (qTitle &&
            effectiveSessionTopicNorm &&
            (qTitle.includes(effectiveSessionTopicNorm) ||
              effectiveSessionTopicNorm.includes(qTitle)));

        const isValidDailyTest =
          isMatchedCurrentSessionTest ||
          (isTest && month === dailyMonth && week === dailyWeek) ||
          (att.category === "Đề kiểm tra định kỳ" &&
            month === dailyMonth &&
            week === dailyWeek);

        if (isValidDailyTest) {
          if (
            !bestDailyTestAttempt ||
            sc >= Number(bestDailyTestAttempt.score ?? bestDailyTestAttempt.points ?? 0)
          ) {
            bestDailyTestAttempt = att;
          }
        }

        if (
          selectedDailyPracticeId !== "none" &&
          selectedDailyPracticeId !== "auto" &&
          qId === selectedDailyPracticeId.toLowerCase()
        ) {
          if (
            !bestPracticeAttempt ||
            sc >= Number(bestPracticeAttempt.score ?? bestPracticeAttempt.points ?? 0)
          ) {
            bestPracticeAttempt = att;
          }
        } else if (
          selectedDailyPracticeId === "auto" &&
          !isHw &&
          !isTest &&
          month === dailyMonth
        ) {
          if (
            !bestPracticeAttempt ||
            sc >= Number(bestPracticeAttempt.score ?? bestPracticeAttempt.points ?? 0)
          ) {
            bestPracticeAttempt = att;
          }
        }
      });

      if (!bestDailyTestAttempt) {
        const anyPaperInCurrentWeek = stuAttempts.find((att: any) => {
          const { month, week } = resolveAttemptMonthAndWeek(att);
          const isPaper =
            att.submission_type === "paper" ||
            Boolean(att.scanned_image_url) ||
            Boolean(att.paper_scan_url) ||
            Boolean(att.omr_raw_data) ||
            Boolean(att.answers?.__paper_omr_meta);
          return isPaper && month === dailyMonth && week === dailyWeek;
        });
        if (anyPaperInCurrentWeek) {
          bestDailyTestAttempt = anyPaperInCurrentWeek;
        }
      }

      if (
        bestPracticeAttempt &&
        bestDailyTestAttempt &&
        String(bestPracticeAttempt.id) === String(bestDailyTestAttempt.id) &&
        selectedDailyPracticeId === "auto"
      ) {
        bestPracticeAttempt = null;
      }

      // ĐỒNG BỘ ƯU TIÊN SỐ BÁO DANH (SBD) TỪ BÀI LÀM OMR MỚI NHẤT TRƯỚC
      const rawResolvedSbd =
        (bestDailyTestAttempt?.omr_raw_data?.detected_sbd ||
          bestDailyTestAttempt?.answers?.__paper_omr_meta?.detected_sbd ||
          bestDailyTestAttempt?.sbd ||
          student?.sbd ||
          dirInfo?.sbd) || "000001";

      const sbd = String(rawResolvedSbd)
        .replace(/\D/g, "")
        .padStart(6, "0")
        .slice(-6);

      const ov = dailyStudentOverrides[stuId] || {};

      const hwScore =
        ov.homeworkScore !== undefined
          ? ov.homeworkScore.trim() === ""
            ? null
            : Number(ov.homeworkScore)
          : bestHwAttempt
          ? Number(bestHwAttempt.score ?? bestHwAttempt.points ?? 0)
          : null;

      const testScore =
        ov.dailyTestScore !== undefined
          ? ov.dailyTestScore.trim() === ""
            ? null
            : Number(ov.dailyTestScore)
          : bestDailyTestAttempt
          ? Number(bestDailyTestAttempt.score ?? bestDailyTestAttempt.points ?? 0)
          : null;

      const rawPracScore =
        ov.practiceScore !== undefined
          ? ov.practiceScore.trim() === ""
            ? null
            : Number(ov.practiceScore)
          : bestPracticeAttempt
          ? Number(bestPracticeAttempt.score ?? bestPracticeAttempt.points ?? 0)
          : null;

      const pracScore =
        rawPracScore !== null && !isNaN(rawPracScore) && rawPracScore > 0 ? rawPracScore : null;

      // Xác định bài thi dùng để đối soát OMR Trang 2 (Ưu tiên bài Test tại lớp -> Đề thực chiến -> BTVN)
      const primaryReviewAtt = bestDailyTestAttempt || bestPracticeAttempt || bestHwAttempt || null;

      let hasPaperOMR = false;
      let scannedPaperImageUrl: string | undefined = undefined;
      let bubbleCoordinates: any[] = [];
      let wrongQuestionsList: WrongQuestionReviewItem[] = [];
      let allQuestionsReviewList: FullQuestionReviewRow[] = [];
      let part1ScoreStr: string | undefined = undefined;
      let part2ScoreStr: string | undefined = undefined;
      let part3ScoreStr: string | undefined = undefined;
      let paperExamTitle: string | undefined = undefined;
      let paperExamCode: string | undefined = undefined;
      let computedCorrectCount: number | null = null;
      let computedTotalQuestions: number | null = null;

      if (primaryReviewAtt) {
        const meta =
          primaryReviewAtt.answers?.__paper_omr_meta ||
          primaryReviewAtt.user_answers?.__paper_omr_meta ||
          {};
        const existingScanUrl =
          primaryReviewAtt.scanned_image_url ||
          primaryReviewAtt.paper_scan_url ||
          meta.scanned_image_url ||
          primaryReviewAtt.omr_raw_data?.warped_image_data_url ||
          undefined;

        paperExamTitle =
          primaryReviewAtt.exam_title ||
          primaryReviewAtt.examTitle ||
          primaryReviewAtt.quizTitle ||
          primaryReviewAtt.quiz_title ||
          meta.exam_title ||
          overrideTopicTitle ||
          autoSyncedTopicTitle;
        paperExamCode =
          primaryReviewAtt.omr_raw_data?.detected_exam_code ||
          meta.detected_exam_code ||
          "101";

        const { rawQuizObj } = resolveAttemptMonthAndWeek(primaryReviewAtt);

        const attQuizIdNorm = String(
          primaryReviewAtt.quizId ||
            primaryReviewAtt.quiz_id ||
            primaryReviewAtt.exam_id ||
            ""
        )
          .trim()
          .toLowerCase();
        const attTitleNorm = normalizeText(
          primaryReviewAtt.examTitle ||
            primaryReviewAtt.exam_title ||
            primaryReviewAtt.quizTitle ||
            primaryReviewAtt.quiz_title ||
            primaryReviewAtt.title ||
            paperExamTitle ||
            ""
        );

        // Tìm ngược trong kho practiceExams nếu học sinh làm đề từ mục Luyện đề / Kiểm tra định kỳ
        const matchedFromPracticeExams = (practiceExams || []).find((pe: any) => {
          if (!pe) return false;
          const peId = String(pe.id || "").trim().toLowerCase();
          const peTitle = normalizeText(pe.title || pe.name || "");
          return (
            (attQuizIdNorm && peId === attQuizIdNorm) ||
            (attTitleNorm &&
              peTitle &&
              (peTitle === attTitleNorm ||
                peTitle.includes(attTitleNorm) ||
                attTitleNorm.includes(peTitle)))
          );
        });

        // Tìm ngược trong toàn bộ bài học của các chương (chapters)
        let matchedFromChapters: any = null;
        for (const les of allFlattenedLessons) {
          for (const tItem of les.testItems) {
            const tId = String(tItem.id || "").trim().toLowerCase();
            const tTitle = normalizeText(tItem.title || "");
            if (
              (attQuizIdNorm && tId === attQuizIdNorm) ||
              (attTitleNorm &&
                tTitle &&
                (tTitle === attTitleNorm ||
                  tTitle.includes(attTitleNorm) ||
                  attTitleNorm.includes(tTitle)))
            ) {
              matchedFromChapters = tItem.rawObj;
              break;
            }
          }
          if (matchedFromChapters) break;

          for (const hItem of les.hwItems) {
            const hId = String(hItem.id || "").trim().toLowerCase();
            const hTitle = normalizeText(hItem.title || "");
            if (
              (attQuizIdNorm && hId === attQuizIdNorm) ||
              (attTitleNorm &&
                hTitle &&
                (hTitle === attTitleNorm ||
                  hTitle.includes(attTitleNorm) ||
                  attTitleNorm.includes(hTitle)))
            ) {
              matchedFromChapters = hItem.rawObj;
              break;
            }
          }
          if (matchedFromChapters) break;
        }

        const fallbackSessionQuizObj =
          rawQuizObj ||
          matchedFromPracticeExams ||
          matchedFromChapters ||
          currentSessionLessons[0]?.testItems[0]?.rawObj ||
          currentSessionLessons[0]?.hwItems[0]?.rawObj ||
          null;

        // TỰ ĐỘNG CHUYỂN ĐỔI & DỰNG "PHIẾU OMR CANVAS AI" SẮC NÉT (1200x1700) CHO BÁO CÁO PHỤ HUYNH
        const virtualBuilt = generateVirtualOMRSheet(
          primaryReviewAtt,
          fallbackSessionQuizObj,
          sbd,
          stuName,
          paperExamTitle,
          paperExamCode,
          ov.questionStatusOverrides
        );

        if (virtualBuilt.dataUrl) {
          hasPaperOMR = true;
          scannedPaperImageUrl = virtualBuilt.dataUrl;
          bubbleCoordinates = virtualBuilt.bubbleCoordinates;
          allQuestionsReviewList = virtualBuilt.reviewData.allRows;
          wrongQuestionsList = virtualBuilt.reviewData.wrongRows;
          part1ScoreStr = virtualBuilt.reviewData.part1Summary;
          part2ScoreStr = virtualBuilt.reviewData.part2Summary;
          part3ScoreStr = virtualBuilt.reviewData.part3Summary;
          computedCorrectCount = virtualBuilt.reviewData.correctCount;
          computedTotalQuestions = virtualBuilt.reviewData.totalQuestions;
        } else if (existingScanUrl) {
          hasPaperOMR = true;
          scannedPaperImageUrl = existingScanUrl;
          bubbleCoordinates = virtualBuilt.reviewData.enrichedBubbleCoordinates;
          allQuestionsReviewList = virtualBuilt.reviewData.allRows;
          wrongQuestionsList = virtualBuilt.reviewData.wrongRows;
          part1ScoreStr = virtualBuilt.reviewData.part1Summary;
          part2ScoreStr = virtualBuilt.reviewData.part2Summary;
          part3ScoreStr = virtualBuilt.reviewData.part3Summary;
          computedCorrectCount = virtualBuilt.reviewData.correctCount;
          computedTotalQuestions = virtualBuilt.reviewData.totalQuestions;
        }
      }

      const resolvedAttendanceStatus: ExtendedAttendanceStatus =
        ov.attendanceStatus ||
        (ov.attendance === "absent"
          ? "absent_need_makeup"
          : ov.attendance === "late"
          ? "late"
          : "present");

      const legacyAttendance: "present" | "late" | "absent" =
        resolvedAttendanceStatus === "present"
          ? "present"
          : resolvedAttendanceStatus === "makeup_done" || resolvedAttendanceStatus === "late"
          ? "late"
          : "absent";

      const makeupSessions: MakeupSupportSessionItem[] = Array.isArray(ov.makeupSessions)
        ? ov.makeupSessions
        : [];

      const attendanceNote =
        resolvedAttendanceStatus === "makeup_done"
          ? "Nghỉ buổi học chính - Đã hoàn thành học bù và bài tập."
          : resolvedAttendanceStatus === "absent_need_makeup"
          ? makeupSessions.length > 0
            ? `Nghỉ buổi học chính - Đã xếp lịch hẹn học bù (${makeupSessions
                .map((s) => `${s.shiftLabel} ${s.date}`)
                .join("; ")}).`
            : "Nghỉ buổi học chính - Cần sắp xếp lịch học bù."
          : "";

      const baseComment =
        testScore !== null && testScore >= 8
          ? `Em ${stuName} nắm vững kiến thức chuyên đề "${
              overrideTopicTitle || autoSyncedTopicTitle
            }", tốc độ phản xạ trắc nghiệm tốt (${testScore}đ). Cần tiếp tục duy trì phong độ và rèn thêm các câu vận dụng cao.`
          : testScore !== null
          ? `Em ${stuName} đã nắm được các dạng cơ bản của bài "${
              overrideTopicTitle || autoSyncedTopicTitle
            }" (đạt ${testScore}đ), tuy nhiên cần đọc kỹ đề và rà soát lại các câu sai trong bảng đối chiếu đính kèm để tránh mất điểm đáng tiếc.`
          : `Em ${stuName} tham gia học tập nghiêm túc chuyên đề "${
              overrideTopicTitle || autoSyncedTopicTitle
            }". Gia đình nhắc nhở con hoàn thành đầy đủ bài tập về nhà và ôn kỹ các công thức trọng tâm của buổi học.`;

      const defaultComment =
        resolvedAttendanceStatus === "makeup_done"
          ? `[Nghỉ buổi học chính - Đã hoàn thành học bù và bài tập] ${baseComment}`
          : baseComment;

      const resolvedHomeworkStatus: "completed" | "missing" | "late" =
        ov.homeworkStatus !== undefined
          ? ov.homeworkStatus
          : hwScore !== null && hwScore > 0
          ? "completed"
          : "missing";

      return {
        studentId: stuId,
        studentName: stuName,
        sbd,
        grade: student?.grade || "Lớp 12",
        school: student?.school || "THPT",
        learningMode,
        homeworkScore: hwScore,
        homeworkCorrect: bestHwAttempt
          ? Number(bestHwAttempt.correct_count ?? bestHwAttempt.correctCount ?? 0) || null
          : null,
        homeworkTotal: bestHwAttempt
          ? Number(bestHwAttempt.total_questions ?? bestHwAttempt.totalQuestions ?? 0) || null
          : null,
        homeworkQuizTitle:
          bestHwAttempt?.examTitle ||
          bestHwAttempt?.quizTitle ||
          effectiveHomeworkTarget.displayTitle,
        dailyTestScore: testScore,
        dailyTestCorrect:
          computedCorrectCount !== null
            ? computedCorrectCount
            : bestDailyTestAttempt
            ? Number(
                bestDailyTestAttempt.correct_answers_count ??
                  bestDailyTestAttempt.correct_count ??
                  bestDailyTestAttempt.correctCount ??
                  0
              ) || null
            : null,
        dailyTestTotal:
          computedTotalQuestions !== null
            ? computedTotalQuestions
            : bestDailyTestAttempt
            ? Number(
                bestDailyTestAttempt.total_questions ?? bestDailyTestAttempt.totalQuestions ?? 0
              ) || null
            : null,
        practiceScore: pracScore,
        practiceExamTitle:
          pracScore !== null
            ? bestPracticeAttempt?.exam_title ||
              bestPracticeAttempt?.examTitle ||
              `Đề thực chiến Tháng ${dailyMonth}`
            : "Không tổ chức kiểm tra đề tháng",
        part1Score: part1ScoreStr,
        part2Score: part2ScoreStr,
        part3Score: part3ScoreStr,
        teacherComment: ov.teacherComment !== undefined ? ov.teacherComment : defaultComment,
        attendance: legacyAttendance,
        attendanceStatus: resolvedAttendanceStatus,
        attendanceNote,
        makeupSessions,
        homeworkStatus: resolvedHomeworkStatus,
        hasPaperOMR,
        paperExamTitle,
        paperExamCode,
        scannedPaperImageUrl,
        canonicalWidth: OMR_CANONICAL_WIDTH,
        canonicalHeight: OMR_CANONICAL_HEIGHT,
        bubbleCoordinates,
        wrongQuestionsList,
        allQuestionsReviewList
      };
    },
    [
      sbdDirectoryMap,
      allAttempts,
      quizAssignmentMap,
      resolveAttemptMonthAndWeek,
      effectiveHomeworkTarget,
      currentSessionLessons,
      allFlattenedLessons,
      practiceExams,
      dailyMonth,
      dailyWeek,
      selectedDailyPracticeId,
      dailyStudentOverrides,
      overrideTopicTitle,
      autoSyncedTopicTitle
    ]
  );

  const handleToggleOMRQuestionCorrectness = (
    studentId: string,
    questionNumber: number,
    currentIsCorrect: boolean
  ) => {
    setDailyStudentOverrides((prev) => {
      const curStu = prev[studentId] || {};
      const curMap = { ...(curStu.questionStatusOverrides || {}) };
      curMap[questionNumber] = !currentIsCorrect;
      return {
        ...prev,
        [studentId]: {
          ...curStu,
          questionStatusOverrides: curMap
        }
      };
    });
  };

  // HÀM BẬT / TẮT CA HỌC BÙ HOẶC CA BỔ TRỢ CHO HỌC SINH ĐANG CHỌN
  const handleToggleMakeupShiftForStudent = (
    studentId: string,
    shiftObj: (typeof AVAILABLE_MAKEUP_SHIFTS)[0]
  ) => {
    const formattedDate = formatVietnameseDayAndDate(schedulerIsoDate);
    setDailyStudentOverrides((prev) => {
      const curStu = prev[studentId] || {};
      const existingList: MakeupSupportSessionItem[] = Array.isArray(curStu.makeupSessions)
        ? [...curStu.makeupSessions]
        : [];

      const existingIdx = existingList.findIndex(
        (s) => s.date === formattedDate && s.shiftId === shiftObj.id
      );

      let nextList: MakeupSupportSessionItem[];
      if (existingIdx >= 0) {
        nextList = existingList.filter((_, idx) => idx !== existingIdx);
      } else {
        nextList = [
          ...existingList,
          {
            id: `${formattedDate}_${shiftObj.id}_${Date.now()}`,
            date: formattedDate,
            shiftId: shiftObj.id,
            shiftLabel: shiftObj.label,
            timeSlot: shiftObj.timeSlot,
            type: schedulerSessionType,
            note: schedulerNote.trim() || undefined
          }
        ];
      }

      return {
        ...prev,
        [studentId]: {
          ...curStu,
          makeupSessions: nextList
        }
      };
    });
  };

  const handleRemoveMakeupSessionItem = (studentId: string, sessionId: string) => {
    setDailyStudentOverrides((prev) => {
      const curStu = prev[studentId] || {};
      const existingList: MakeupSupportSessionItem[] = Array.isArray(curStu.makeupSessions)
        ? curStu.makeupSessions
        : [];
      return {
        ...prev,
        [studentId]: {
          ...curStu,
          makeupSessions: existingList.filter((s) => s.id !== sessionId)
        }
      };
    });
  };

  const filteredStudents = useMemo(() => {
    return (registeredStudents || []).filter((s) => {
      const matchSearch =
        (s.full_name || "").toLowerCase().includes(searchStudent.toLowerCase()) ||
        (s.school || "").toLowerCase().includes(searchStudent.toLowerCase());
      if (!matchSearch) return false;

      if (reportViewType === "daily" && dailyStudentFilterMode !== "all") {
        const rawMode = String(s.learning_mode || s.study_mode || "offline").toLowerCase();
        const isOnline = rawMode.includes("on");
        if (dailyStudentFilterMode === "online" && !isOnline) return false;
        if (dailyStudentFilterMode === "offline" && isOnline) return false;
      }
      return true;
    });
  }, [registeredStudents, searchStudent, reportViewType, dailyStudentFilterMode]);

  useEffect(() => {
    if (!hasInitializedSelectionRef.current && registeredStudents.length > 0) {
      hasInitializedSelectionRef.current = true;
      setSelectedExportStudentIds(
        new Set(registeredStudents.map((s) => String(s?.id || "")).filter(Boolean))
      );
    }
  }, [registeredStudents]);

  const selectedFilteredStudents = useMemo(() => {
    return filteredStudents.filter((s) => selectedExportStudentIds.has(String(s.id)));
  }, [filteredStudents, selectedExportStudentIds]);

  const handleToggleStudentExportCheckbox = (studentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedExportStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const handleSelectAllFilteredStudents = () => {
    setSelectedExportStudentIds((prev) => {
      const next = new Set(prev);
      filteredStudents.forEach((s) => next.add(String(s.id)));
      return next;
    });
  };

  const handleDeselectAllFilteredStudents = () => {
    setSelectedExportStudentIds((prev) => {
      const next = new Set(prev);
      filteredStudents.forEach((s) => next.delete(String(s.id)));
      return next;
    });
  };

  const currentStudent = useMemo(() => {
    return (
      filteredStudents.find((s) => s.id === selectedStudentId) ||
      filteredStudents[0] ||
      registeredStudents[0] ||
      null
    );
  }, [filteredStudents, registeredStudents, selectedStudentId]);

  const currentStudentDailyData = useMemo(() => {
    if (!currentStudent) return null;
    return computeStudentDailyScoreRecord(currentStudent);
  }, [currentStudent, computeStudentDailyScoreRecord]);

  const handleExportClassDailyPDF = (onlyCurrentStudent: boolean = false) => {
    const targetStudents = onlyCurrentStudent
      ? currentStudent
        ? [currentStudent]
        : []
      : selectedFilteredStudents;

    if (targetStudents.length === 0) {
      alert(
        onlyCurrentStudent
          ? "Vui lòng chọn 1 học sinh để xem báo cáo!"
          : "Bạn chưa tích chọn học sinh nào để xuất PDF! Hãy tích chọn ít nhất 1 học sinh ở danh sách bên trái."
      );
      return;
    }

    const studentsScoreData = targetStudents.map((stu) =>
      computeStudentDailyScoreRecord(stu)
    );

    const config: DailyReportConfig & { homeworkTopicLabel?: string } = {
      reportMode: "daily",
      selectedMonth: dailyMonth,
      selectedWeek: dailyWeek,
      customDateStr: customDateStr.trim() || todayFormatted,
      topicTitle: autoSyncedTopicTitle,
      overrideTopicTitle: overrideTopicTitle.trim() || undefined,
      homeworkTopicLabel: effectiveHomeworkTarget.displayTitle,
      includeCoverSummaryPage: !onlyCurrentStudent && includeCoverSummaryPage
    };

    const htmlDoc = generateClassDailyReportHTML(config, studentsScoreData as any);
    openPrintOrDownloadClassReport(htmlDoc);
  };

  const handleCopyDailyZalo = () => {
    if (!currentStudentDailyData) return;
    const d = currentStudentDailyData;
    const topic = (overrideTopicTitle && overrideTopicTitle.trim()) || autoSyncedTopicTitle;
    const attText =
      d.attendanceStatus === "present"
        ? "Có mặt đúng giờ"
        : d.attendanceStatus === "makeup_done"
        ? "Nghỉ buổi chính (Đã hoàn thành học bù & bài tập)"
        : d.attendanceStatus === "absent_need_makeup"
        ? "Nghỉ học (Chưa học bù)"
        : d.attendance === "late"
        ? "Đi học muộn"
        : "Nghỉ học";

    const hwStatusText =
      d.homeworkStatus === "completed"
        ? "Hoàn thành đầy đủ"
        : d.homeworkStatus === "late"
        ? "Nộp muộn"
        : "Chưa hoàn thành";

    const makeupLines =
      d.makeupSessions && d.makeupSessions.length > 0
        ? `\n📌 THÔNG BÁO LỊCH HỌC BÙ / BỔ TRỢ:\n` +
          d.makeupSessions
            .map(
              (s) =>
                `• [${s.type === "makeup" ? "Học bù bài vắng" : "Bổ trợ kiến thức"}] ${
                  s.date
                } — ${s.shiftLabel}${s.note ? ` (${s.note})` : ""}`
            )
            .join("\n") +
          "\n"
        : "";

    const msg =
      `[TRUNG TÂM TOÁN TÂM CHÍ TÀI - TCT]\n` +
      `📋 BÁO CÁO KẾT QUẢ BUỔI HỌC NGÀY ${customDateStr}\n` +
      `• Học sinh: ${d.studentName} (SBD: ${d.sbd})\n` +
      `• Trường: ${d.school} • Phân hệ: ${d.learningMode}\n` +
      `• Chuyên đề hôm nay: ${topic}\n` +
      `------------------------------------\n` +
      `I. KẾT QUẢ ĐIỂM SỐ & CHUYÊN CẦN TRONG NGÀY:\n` +
      `1. Chuyên cần: ${attText} | Ý thức BTVN: ${hwStatusText}\n` +
      `2. Điểm BTVN tuần trước (${effectiveHomeworkTarget.displayTitle}): ${
        d.homeworkScore !== null ? `${d.homeworkScore}/10` : "-- / 10 (Chưa nộp)"
      }\n` +
      `3. Điểm Kiểm tra tại lớp hôm nay: ${
        d.dailyTestScore !== null ? `${d.dailyTestScore}/10` : "Chưa kiểm tra"
      }${
        d.hasPaperOMR
          ? ` (Đúng ${d.dailyTestCorrect}/${d.dailyTestTotal} câu trên phiếu OMR)`
          : ""
      }\n` +
      `4. Đề thực chiến tháng: ${
        d.practiceScore !== null && d.practiceScore > 0
          ? `${d.practiceScore}/10`
          : "Không kiểm tra"
      }\n` +
      `------------------------------------\n` +
      `II. NHẬN XÉT CỦA GIÁO VIÊN:\n` +
      `"${d.teacherComment}"\n` +
      makeupLines +
      `\n📞 Hotline TCT: 0972 26 16 16 • Đ/c: Số 10 Tạ Quang Bửu, Bách Khoa, Hà Nội.`;

    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(msg);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  // --- CÁC LOGIC BÁO CÁO THÁNG HIỆN CÓ ---
  const studentAllAttempts = useMemo(() => {
    if (!currentStudent) return [];
    return allAttempts.filter(
      (att) =>
        String(att.studentId || att.student_id || "").trim() ===
          String(currentStudent.id || "").trim() ||
        String(att.studentName || att.student_name || "")
          .trim()
          .toLowerCase() ===
          String(currentStudent.full_name || "")
            .trim()
            .toLowerCase()
    );
  }, [allAttempts, currentStudent]);

  const studentPracticeAttempts = useMemo(() => {
    return studentAllAttempts.filter((a) => {
      const qId = String(a?.quizId || a?.quiz_id || a?.exam_id || "").trim().toLowerCase();
      const qTitle = normalizeText(
        a?.examTitle || a?.quizTitle || a?.quiz_title || a?.title || ""
      );
      const meta =
        (qId && quizAssignmentMap.byId.get(qId)) ||
        (qTitle && quizAssignmentMap.byTitle.get(qTitle));

      if (meta?.isHw || meta?.isTest) return false;
      const isHw = a.type === "homework" || a.isHomework || a.is_homework;
      const isTest = a.type === "test";
      return !isHw && !isTest;
    });
  }, [studentAllAttempts, quizAssignmentMap]);

  useEffect(() => {
    if (reportMode !== "auto") return;
    if (studentPracticeAttempts.length > 0) {
      const inSelectedMonth = studentPracticeAttempts.filter((a) => {
        const { month } = resolveAttemptMonthAndWeek(a);
        return month === reportMonth;
      });

      const dedupByExamMap = new Map<string, any>();
      inSelectedMonth.forEach((a) => {
        const key = normalizeText(
          a.examTitle || a.quizTitle || a.quiz_title || a.title || a.quizId || a.id
        );
        const prev = dedupByExamMap.get(key);
        const curScore = Number(a.score ?? a.points ?? 0);
        const prevScore = prev ? Number(prev.score ?? prev.points ?? 0) : -1;
        if (!prev || curScore >= prevScore) {
          dedupByExamMap.set(key, a);
        }
      });

      const mapped: SelectedPracticeExamItem[] = Array.from(dedupByExamMap.values()).map(
        (a, idx) => {
          const d = new Date(a.createdAt || a.created_at || Date.now());
          const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(
            d.getMonth() + 1
          ).padStart(2, "0")}/${d.getFullYear()}`;
          const { month, category } = resolveAttemptMonthAndWeek(a);
          const isPaper =
            a?.submission_type === "paper" ||
            Boolean(a?.paper_scan_url) ||
            Boolean(a?.omr_raw_data);

          return {
            id: a.id || `prac-${idx}`,
            title:
              a.examTitle ||
              a.quizTitle ||
              a.quiz_title ||
              a.title ||
              "Đề luyện thi thực chiến",
            category: category || a.category || "Luyện đề",
            completedDate: dateStr,
            score: a.score ?? a.points ?? "0",
            durationText: a.timeSpent || a.time_spent || "",
            assignedMonth: month,
            submissionType: isPaper ? "paper" : "web",
            paperScanUrl:
              a.paper_scan_url || a.omr_raw_data?.warped_image_data_url || null,
            omrRawData: a.omr_raw_data || null,
          };
        }
      );

      setSelectedPracticeExams(mapped);
    } else {
      setSelectedPracticeExams([]);
    }
  }, [
    currentStudent?.id,
    reportMonth,
    studentPracticeAttempts,
    reportMode,
    resolveAttemptMonthAndWeek
  ]);

  const autoData = useMemo(() => {
    const emptyWeeks: { [key: number]: string } = { 1: "", 2: "", 3: "", 4: "", 5: "" };
    if (!currentStudent) {
      return {
        totalHwTest: 0,
        hwAvg: "--",
        testAvg: "--",
        hwByWeek: { ...emptyWeeks },
        testByWeek: { ...emptyWeeks }
      };
    }

    const hwByWeekMax: { [key: number]: number | null } = {
      1: null,
      2: null,
      3: null,
      4: null,
      5: null
    };
    const testByWeekMax: { [key: number]: number | null } = {
      1: null,
      2: null,
      3: null,
      4: null,
      5: null
    };

    studentAllAttempts.forEach((att) => {
      const qId = String(att?.quizId || att?.quiz_id || att?.exam_id || "")
        .trim()
        .toLowerCase();
      const qTitle = normalizeText(
        att?.examTitle || att?.quizTitle || att?.quiz_title || att?.title || ""
      );
      const meta =
        (qId && quizAssignmentMap.byId.get(qId)) ||
        (qTitle && quizAssignmentMap.byTitle.get(qTitle));

      const isHw = Boolean(
        meta?.isHw || att.type === "homework" || att.isHomework || att.is_homework
      );
      const isTest = Boolean(meta?.isTest || att.type === "test");

      if (!isHw && !isTest) return;

      const { month, week } = resolveAttemptMonthAndWeek(att);
      if (month !== reportMonth) return;

      const sc = Number(att.score ?? att.points ?? 0);
      if (isNaN(sc)) return;

      if (isHw) {
        if (hwByWeekMax[week] === null || sc > hwByWeekMax[week]!) {
          hwByWeekMax[week] = sc;
        }
      } else if (isTest) {
        if (testByWeekMax[week] === null || sc > testByWeekMax[week]!) {
          testByWeekMax[week] = sc;
        }
      }
    });

    const hwByWeek: { [key: number]: string } = { 1: "", 2: "", 3: "", 4: "", 5: "" };
    const testByWeek: { [key: number]: string } = { 1: "", 2: "", 3: "", 4: "", 5: "" };

    [1, 2, 3, 4, 5].forEach((w) => {
      if (hwByWeekMax[w] !== null) {
        hwByWeek[w] = Number(hwByWeekMax[w]!.toFixed(2)).toString();
      }
      if (testByWeekMax[w] !== null) {
        testByWeek[w] = Number(testByWeekMax[w]!.toFixed(2)).toString();
      }
    });

    const validWeekHw = Object.values(hwByWeek).filter(Boolean).map(Number);
    const validWeekTest = Object.values(testByWeek).filter(Boolean).map(Number);

    const hwAvg =
      validWeekHw.length > 0
        ? (validWeekHw.reduce((a, b) => a + b, 0) / validWeekHw.length).toFixed(1)
        : "--";
    const testAvg =
      validWeekTest.length > 0
        ? (validWeekTest.reduce((a, b) => a + b, 0) / validWeekTest.length).toFixed(1)
        : "--";

    return {
      totalHwTest: validWeekHw.length + validWeekTest.length,
      hwAvg,
      testAvg,
      hwByWeek,
      testByWeek
    };
  }, [
    studentAllAttempts,
    currentStudent,
    reportMonth,
    quizAssignmentMap,
    resolveAttemptMonthAndWeek
  ]);

  const practiceStats = useMemo(() => {
    const parseScore = (val: any) => Number(String(val ?? "").replace(",", ".").trim());
    const validScores = selectedPracticeExams
      .filter(
        (item) =>
          String(item.score ?? "").trim() !== "" && String(item.score ?? "").trim() !== "--"
      )
      .map((item) => parseScore(item.score))
      .filter((sc) => !isNaN(sc));

    const avg =
      validScores.length > 0
        ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1)
        : "--";

    return {
      count: selectedPracticeExams.length,
      avg
    };
  }, [selectedPracticeExams]);

  const manualStats = useMemo(() => {
    const parseScore = (val: string) => Number(val.replace(",", ".").trim());
    const validHw = Object.values(manualHWScores)
      .filter((val) => val && val.trim() !== "" && !isNaN(parseScore(val)))
      .map(parseScore);
    const validTest = Object.values(manualTestScores)
      .filter((val) => val && val.trim() !== "" && !isNaN(parseScore(val)))
      .map(parseScore);

    const hwAvg =
      validHw.length > 0
        ? (validHw.reduce((a, b) => a + b, 0) / validHw.length).toFixed(1)
        : "--";
    const testAvg =
      validTest.length > 0
        ? (validTest.reduce((a, b) => a + b, 0) / validTest.length).toFixed(1)
        : "--";

    return {
      totalHwTest: validHw.length + validTest.length,
      hwAvg,
      testAvg
    };
  }, [manualHWScores, manualTestScores]);

  const currentReport = useMemo(() => {
    if (reportMode === "auto") {
      const month = reportMonth;
      const totalOverall = autoData.totalHwTest + practiceStats.count;
      return {
        fullName: currentStudent?.full_name || "Chưa nhập họ tên",
        school: currentStudent?.school || "THPT",
        grade: currentStudent?.grade || "Lớp 12",
        month,
        timeframeText: "Tháng " + (month < 10 ? "0" + month : month) + "/2026",
        total: totalOverall,
        hwAvg: autoData.hwAvg,
        testAvg: autoData.testAvg,
        practiceAvg: practiceStats.avg,
        evaluation: autoTeacherEvaluation,
        hwScores: autoData.hwByWeek,
        testScores: autoData.testByWeek,
        practiceItems: selectedPracticeExams
      };
    } else {
      const month = manualForm.reportMonth;
      const totalOverall = manualStats.totalHwTest + practiceStats.count;
      return {
        fullName: manualForm.fullName.trim() || "Chưa nhập họ tên",
        school: manualForm.school.trim() || "THPT",
        grade: manualForm.grade,
        month,
        timeframeText: "Tháng " + (month < 10 ? "0" + month : month) + "/2026",
        total: totalOverall,
        hwAvg: manualStats.hwAvg,
        testAvg: manualStats.testAvg,
        practiceAvg: practiceStats.avg,
        evaluation: manualForm.evaluation,
        hwScores: manualHWScores,
        testScores: manualTestScores,
        practiceItems: selectedPracticeExams
      };
    }
  }, [
    reportMode,
    currentStudent,
    reportMonth,
    autoData,
    practiceStats,
    autoTeacherEvaluation,
    manualForm,
    manualStats,
    manualHWScores,
    manualTestScores,
    selectedPracticeExams
  ]);

  const parsedEvalBullets = useMemo(
    () => parseEvaluationBullets(currentReport.evaluation),
    [currentReport.evaluation]
  );

  const hasWeek5Data = useMemo(() => {
    return Boolean(currentReport.hwScores[5] || currentReport.testScores[5]);
  }, [currentReport.hwScores, currentReport.testScores]);

  const needsSecondPage = useMemo(() => {
    const evalLines = (currentReport.evaluation || "").split("\n").length;
    return (
      currentReport.practiceItems.length > 4 ||
      evalLines > 8 ||
      (currentReport.evaluation || "").length > 450
    );
  }, [currentReport.practiceItems.length, currentReport.evaluation]);

  const handleToggleSelectPracticeExam = (attOrExam: any) => {
    const targetId = String(attOrExam.id);
    const existing = selectedPracticeExams.find((item) => item.id === targetId);
    if (existing) {
      setSelectedPracticeExams((prev) => prev.filter((item) => item.id !== targetId));
    } else {
      const rawDate = attOrExam.createdAt || attOrExam.created_at || Date.now();
      const d = new Date(rawDate);
      const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1
      ).padStart(2, "0")}/${d.getFullYear()}`;
      const isPaper =
        attOrExam?.submission_type === "paper" ||
        Boolean(attOrExam?.paper_scan_url) ||
        Boolean(attOrExam?.omr_raw_data);

      const newItem: SelectedPracticeExamItem = {
        id: targetId,
        title:
          attOrExam.examTitle ||
          attOrExam.quizTitle ||
          attOrExam.quiz_title ||
          attOrExam.title ||
          "Đề luyện thi thực chiến",
        category: attOrExam.category || "Luyện đề",
        completedDate: dateStr,
        score:
          attOrExam.score !== undefined && attOrExam.score !== null
            ? attOrExam.score
            : attOrExam.points ?? "8.0",
        durationText: attOrExam.timeSpent || attOrExam.time_spent || "",
        submissionType: isPaper ? "paper" : "web",
        paperScanUrl:
          attOrExam.paper_scan_url || attOrExam.omr_raw_data?.warped_image_data_url || null,
        omrRawData: attOrExam.omr_raw_data || null,
      };
      setSelectedPracticeExams((prev) => [...prev, newItem]);
    }
  };

  const handleAddManualPracticeExam = () => {
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(
      now.getMonth() + 1
    ).padStart(2, "0")}/${now.getFullYear()}`;
    const newItem: SelectedPracticeExamItem = {
      id: "manual-prac-" + Date.now(),
      title: `Đề thực chiến bổ sung #${selectedPracticeExams.length + 1}`,
      category: "Luyện đề",
      completedDate: dateStr,
      score: "8.5",
      submissionType: "paper",
    };
    setSelectedPracticeExams((prev) => [...prev, newItem]);
  };

  const handleUpdatePracticeExamItem = (
    id: string,
    field: keyof SelectedPracticeExamItem,
    value: any
  ) => {
    setSelectedPracticeExams((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemovePracticeItem = (id: string) => {
    setSelectedPracticeExams((prev) => prev.filter((item) => item.id !== id));
  };

  const renderCanvasPage = (pageMode: "single" | "page1" | "page2"): string | null => {
    const canvas = document.createElement("canvas");
    const scale = 3;
    const logicalWidth = 880;
    const outerPad = 32;
    const innerPad = 28;
    const contentX = outerPad + innerPad;
    const contentWidth = logicalWidth - (outerPad + innerPad) * 2;
    const FONT_SERIF = "'Times New Roman', Times, serif";

    const testCanvas = document.createElement("canvas");
    const testCtx = testCanvas.getContext("2d");
    if (!testCtx) return null;

    const bulletTextMaxWidth = contentWidth - 68;
    const renderedBullets: { title: string; lines: string[]; blockHeight: number }[] = [];

    parsedEvalBullets.forEach((b) => {
      testCtx.font = "400 14px " + FONT_SERIF;
      const fullWords = b.body.split(/\s+/);
      const lines: string[] = [];
      let curLine = "";

      for (let i = 0; i < fullWords.length; i++) {
        const candidate = curLine ? curLine + " " + fullWords[i] : fullWords[i];
        if (testCtx.measureText(candidate).width > bulletTextMaxWidth && curLine) {
          lines.push(curLine);
          curLine = fullWords[i];
        } else {
          curLine = candidate;
        }
      }
      if (curLine) lines.push(curLine);

      const titleH = b.title ? 20 : 0;
      const bodyH = Math.max(1, lines.length) * 21;
      const blockHeight = titleH + bodyH + 20;
      renderedBullets.push({ title: b.title, lines, blockHeight });
    });

    const totalEvalCardHeight =
      renderedBullets.reduce((acc, item) => acc + item.blockHeight + 10, 0) + 32;

    const weekCols = hasWeek5Data ? [1, 2, 3, 4, 5] : [1, 2, 3, 4];
    const pracRowH = 38;
    const pracTableH =
      currentReport.practiceItems.length > 0
        ? currentReport.practiceItems.length * pracRowH + 42
        : 68;

    let logicalHeight = 560 + pracTableH + totalEvalCardHeight + 110;
    if (pageMode === "page1") {
      logicalHeight = 490 + pracTableH + 75;
    } else if (pageMode === "page2") {
      logicalHeight = 200 + totalEvalCardHeight + 110;
    }

    canvas.width = logicalWidth * scale;
    canvas.height = logicalHeight * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(scale, scale);

    ctx.fillStyle = "#F8FAFC";
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    drawRoundedRect(
      ctx,
      outerPad,
      outerPad,
      logicalWidth - outerPad * 2,
      logicalHeight - outerPad * 2,
      16,
      "#FFFFFF",
      "#CBD5E1",
      1.5
    );

    let cursorY = outerPad + 24;
    const headerH = pageMode === "page2" ? 78 : 96;

    drawRoundedRect(
      ctx,
      contentX,
      cursorY,
      contentWidth,
      headerH,
      12,
      "#F8FAFC",
      "#CBD5E1",
      1
    );

    ctx.fillStyle = "#003399";
    ctx.font = "bold 12px " + FONT_SERIF;
    const subHeaderTitle =
      pageMode === "page2"
        ? "TRUNG TÂM TOÁN TÂM CHÍ TÀI (TCT) • TRANG 2/2: NHẬN XÉT"
        : pageMode === "page1"
        ? "TRUNG TÂM TOÁN TÂM CHÍ TÀI (TCT) • TRANG 1/2: KẾT QUẢ HỌC TẬP"
        : "TRUNG TÂM TOÁN TÂM CHÍ TÀI (TCT) • PHIẾU BÁO CÁO KẾT QUẢ ĐỊNH KỲ";
    ctx.fillText(subHeaderTitle, contentX + 20, cursorY + 25);

    ctx.fillStyle = "#0F172A";
    ctx.font = "bold 23px " + FONT_SERIF;
    ctx.fillText(currentReport.fullName, contentX + 20, cursorY + 54);

    if (pageMode !== "page2") {
      ctx.fillStyle = "#334155";
      ctx.font = "14px " + FONT_SERIF;
      ctx.fillText(
        `${currentReport.school}   •   ${currentReport.grade}`,
        contentX + 20,
        cursorY + 76
      );
    }

    const badgeW = 136;
    const badgeH = 30;
    const badgeX = contentX + contentWidth - badgeW - 18;
    const badgeY = cursorY + 16;
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 8, "#003399");

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 12.5px " + FONT_SERIF;
    ctx.textAlign = "center";
    ctx.fillText(
      currentReport.timeframeText.toUpperCase(),
      badgeX + badgeW / 2,
      badgeY + 19
    );
    ctx.textAlign = "left";

    cursorY += headerH + 22;

    if (pageMode === "single" || pageMode === "page1") {
      const gap = 14;
      const cardW = (contentWidth - gap * 3) / 4;
      const cardH = 76;

      const summaryCards = [
        {
          label: "TỔNG BÀI NỘP",
          val: `${currentReport.total} bài`,
          bg: "#F8FAFC",
          border: "#CBD5E1",
          labelColor: "#475569",
          valColor: "#0F172A",
        },
        {
          label: "ĐIỂM TB BTVN",
          val: `${currentReport.hwAvg} / 10`,
          bg: "#ECFDF5",
          border: "#059669",
          labelColor: "#047857",
          valColor: "#065F46",
        },
        {
          label: "ĐIỂM TB KIỂM TRA",
          val: `${currentReport.testAvg} / 10`,
          bg: "#EFF6FF",
          border: "#1D4ED8",
          labelColor: "#1D4ED8",
          valColor: "#1E3A8A",
        },
        {
          label: "ĐIỂM TB LUYỆN ĐỀ",
          val:
            currentReport.practiceAvg !== "--"
              ? `${currentReport.practiceAvg} / 10`
              : "Không KT",
          bg: "#FFF7ED",
          border: "#EA580C",
          labelColor: "#C2410C",
          valColor: "#9A3412",
        },
      ];

      summaryCards.forEach((c, idx) => {
        const cx = contentX + idx * (cardW + gap);
        drawRoundedRect(ctx, cx, cursorY, cardW, cardH, 10, c.bg, c.border, 1.2);

        ctx.fillStyle = c.labelColor;
        ctx.font = "bold 11px " + FONT_SERIF;
        ctx.fillText(c.label, cx + 16, cursorY + 25);

        ctx.fillStyle = c.valColor;
        ctx.font = "bold 20px " + FONT_SERIF;
        ctx.fillText(c.val, cx + 16, cursorY + 54);
      });

      cursorY += cardH + 26;

      ctx.fillStyle = "#003399";
      ctx.font = "bold 13.5px " + FONT_SERIF;
      ctx.fillText(
        `1. BẢNG THEO DÕI ĐIỂM SỐ ${weekCols.length} TUẦN (BTVN & KIỂM TRA ĐỊNH KỲ)`,
        contentX,
        cursorY
      );

      const tblTop = cursorY + 10;
      const tblH = 108;
      drawRoundedRect(ctx, contentX, tblTop, contentWidth, tblH, 10, "#FFFFFF", "#94A3B8", 1);

      ctx.fillStyle = "#F1F5F9";
      ctx.fillRect(contentX + 1, tblTop + 1, contentWidth - 2, 33);

      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 12.5px " + FONT_SERIF;
      ctx.fillText("Hạng mục đánh giá", contentX + 18, tblTop + 22);

      const weekZoneStart = contentX + 240;
      const weekZoneEnd = contentX + contentWidth - 115;
      const weekStep = (weekZoneEnd - weekZoneStart) / weekCols.length;

      ctx.textAlign = "center";
      weekCols.forEach((w, idx) => {
        const colCenterX = weekZoneStart + idx * weekStep + weekStep / 2;
        ctx.fillText(`Tuần ${w} (T${w}.${currentReport.month})`, colCenterX, tblTop + 22);
      });

      ctx.textAlign = "right";
      ctx.fillText("Trung bình", contentX + contentWidth - 18, tblTop + 22);
      ctx.textAlign = "left";

      const row1Y = tblTop + 58;
      ctx.fillStyle = "#0F172A";
      ctx.font = "bold 13px " + FONT_SERIF;
      ctx.fillText("Bài tập về nhà (BTVN)", contentX + 18, row1Y);

      ctx.textAlign = "center";
      weekCols.forEach((w, idx) => {
        const colCenterX = weekZoneStart + idx * weekStep + weekStep / 2;
        const sc = currentReport.hwScores[w];
        ctx.fillStyle = sc ? "#047857" : "#64748B";
        ctx.font = "bold 13px " + FONT_SERIF;
        ctx.fillText(sc ? `${sc}đ` : "--", colCenterX, row1Y);
      });

      ctx.textAlign = "right";
      ctx.fillStyle = "#047857";
      ctx.fillText(
        currentReport.hwAvg !== "--" ? `${currentReport.hwAvg} / 10` : "--",
        contentX + contentWidth - 18,
        row1Y
      );
      ctx.textAlign = "left";

      const row2Y = tblTop + 94;
      ctx.fillStyle = "#0F172A";
      ctx.fillText("Kiểm tra định kỳ", contentX + 18, row2Y);

      ctx.textAlign = "center";
      weekCols.forEach((w, idx) => {
        const colCenterX = weekZoneStart + idx * weekStep + weekStep / 2;
        const sc = currentReport.testScores[w];
        ctx.fillStyle = sc ? "#1D4ED8" : "#64748B";
        ctx.fillText(sc ? `${sc}đ` : "--", colCenterX, row2Y);
      });

      ctx.textAlign = "right";
      ctx.fillStyle = "#1D4ED8";
      ctx.fillText(
        currentReport.testAvg !== "--" ? `${currentReport.testAvg} / 10` : "--",
        contentX + contentWidth - 18,
        row2Y
      );
      ctx.textAlign = "left";

      cursorY = tblTop + tblH + 26;
    }

    if (pageMode === "single" || pageMode === "page2") {
      ctx.fillStyle = "#003399";
      ctx.font = "bold 13.5px " + FONT_SERIF;
      ctx.fillText("NHẬN XÉT CHI TIẾT & ĐỊNH HƯỚNG TỪ GIÁO VIÊN", contentX, cursorY);

      const evalCardTop = cursorY + 10;
      drawRoundedRect(
        ctx,
        contentX,
        evalCardTop,
        contentWidth,
        totalEvalCardHeight,
        12,
        "#F8FAFC",
        "#CBD5E1",
        1
      );

      let curBulletY = evalCardTop + 16;
      renderedBullets.forEach((bItem) => {
        drawRoundedRect(
          ctx,
          contentX + 16,
          curBulletY,
          contentWidth - 32,
          bItem.blockHeight,
          8,
          "#FFFFFF",
          "#CBD5E1",
          1
        );

        let textY = curBulletY + 22;
        if (bItem.title) {
          ctx.fillStyle = "#003399";
          ctx.font = "bold 13.5px " + FONT_SERIF;
          ctx.fillText("• " + bItem.title + ":", contentX + 32, textY);
          textY += 20;
        }

        ctx.fillStyle = "#0F172A";
        ctx.font = "14px " + FONT_SERIF;
        bItem.lines.forEach((lineStr) => {
          ctx.fillText(lineStr, contentX + 32, textY);
          textY += 21;
        });

        curBulletY += bItem.blockHeight + 10;
      });
    }

    return canvas.toDataURL("image/png");
  };

  const triggerDownloadUrl = (dataUrl: string, suffix: string) => {
    const cleanName = currentReport.fullName.replace(/\s+/g, "_") || "Bao_Cao";
    const downloadLink = document.createElement("a");
    downloadLink.download = `Bao_Cao_TCT_${cleanName}_${currentReport.timeframeText.replace(
      "/",
      ""
    )}${suffix}.png`;
    downloadLink.href = dataUrl;
    downloadLink.click();
  };

  const handleExportPNG = (mode: "single" | "page1" | "page2" | "both" | "preview") => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        if (mode === "preview") {
          if (needsSecondPage) {
            const p1 = renderCanvasPage("page1");
            const p2 = renderCanvasPage("page2");
            setRenderedImageUrls({ page1: p1, page2: p2 });
          } else {
            const single = renderCanvasPage("single");
            setRenderedImageUrls({ page1: single, page2: null });
          }
        } else if (mode === "single") {
          const url = renderCanvasPage("single");
          if (url) triggerDownloadUrl(url, "");
        } else if (mode === "page1") {
          const url = renderCanvasPage("page1");
          if (url) triggerDownloadUrl(url, "_Trang_1");
        } else if (mode === "page2") {
          const url = renderCanvasPage("page2");
          if (url) triggerDownloadUrl(url, "_Trang_2");
        } else if (mode === "both") {
          const p1 = renderCanvasPage("page1");
          const p2 = renderCanvasPage("page2");
          if (p1) triggerDownloadUrl(p1, "_Trang_1");
          if (p2) {
            setTimeout(() => triggerDownloadUrl(p2, "_Trang_2"), 350);
          }
        }
      } catch (e) {
        console.error("Lỗi xuất ảnh:", e);
      } finally {
        setIsExporting(false);
      }
    }, 60);
  };

  const handleCopyZalo = () => {
    if (reportViewType === "daily") {
      handleCopyDailyZalo();
      return;
    }

    const m = currentReport.month;
    let practiceLines = "";
    if (currentReport.practiceItems.length > 0) {
      practiceLines = currentReport.practiceItems
        .map(
          (p, idx) =>
            `  ${idx + 1}. ${p.title} [${formatCategoryWithSubmissionMode(
              p.category,
              p.submissionType
            )}]: ${p.score}/10 (${p.completedDate})`
        )
        .join("\n");
    } else {
      practiceLines = "  (Không kiểm tra đề tháng)";
    }

    const week5HwPart = hasWeek5Data
      ? ` | [T5.${m}: ${currentReport.hwScores[5] || "--"}]`
      : "";
    const week5TestPart = hasWeek5Data
      ? ` | [T5.${m}: ${currentReport.testScores[5] || "--"}]`
      : "";

    const msg =
      "[PHIẾU BÁO CÁO HỌC TẬP - TRUNG TÂM TOÁN TÂM CHÍ TÀI (TCT)]\n" +
      "Kính gửi Phụ huynh em: " +
      currentReport.fullName +
      "\n" +
      "Trường: " +
      currentReport.school +
      " • " +
      currentReport.grade +
      "\n" +
      "Kỳ báo cáo: " +
      currentReport.timeframeText +
      "\n" +
      "------------------------------------\n" +
      "I. KẾT QUẢ ĐẠT ĐƯỢC:\n" +
      "- Tổng số bài nộp: " +
      currentReport.total +
      " bài\n" +
      "- Điểm trung bình BTVN: " +
      currentReport.hwAvg +
      " / 10\n" +
      "- Điểm trung bình Kiểm tra định kỳ: " +
      currentReport.testAvg +
      " / 10\n" +
      "- Điểm trung bình Luyện đề thực chiến: " +
      (currentReport.practiceAvg !== "--"
        ? currentReport.practiceAvg + " / 10"
        : "Không kiểm tra") +
      "\n\n" +
      "* Chi tiết BTVN theo tuần:\n" +
      "  [T1." +
      m +
      ": " +
      (currentReport.hwScores[1] || "--") +
      "] | [T2." +
      m +
      ": " +
      (currentReport.hwScores[2] || "--") +
      "] | [T3." +
      m +
      ": " +
      (currentReport.hwScores[3] || "--") +
      "] | [T4." +
      m +
      ": " +
      (currentReport.hwScores[4] || "--") +
      "]" +
      week5HwPart +
      "\n\n" +
      "* Chi tiết Kiểm tra định kỳ theo tuần:\n" +
      "  [T1." +
      m +
      ": " +
      (currentReport.testScores[1] || "--") +
      "] | [T2." +
      m +
      ": " +
      (currentReport.testScores[2] || "--") +
      "] | [T3." +
      m +
      ": " +
      (currentReport.testScores[3] || "--") +
      "] | [T4." +
      m +
      ": " +
      (currentReport.testScores[4] || "--") +
      "]" +
      week5TestPart +
      "\n\n" +
      "* Danh sách Luyện đề thực chiến:\n" +
      practiceLines +
      "\n\n" +
      "------------------------------------\n" +
      "II. NHẬN XÉT CỦA GIÁO VIÊN:\n" +
      currentReport.evaluation +
      "\n\n" +
      "📞 Hotline TCT: 0972 26 16 16 • Đ/c: Số 10 Tạ Quang Bửu, Bách Khoa, Hà Nội.";

    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(msg);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  const pickerSourceList = useMemo(() => {
    if (reportMode === "auto") {
      return studentPracticeAttempts;
    }
    if (studentPracticeAttempts.length > 0) {
      return studentPracticeAttempts;
    }
    return (practiceExams || []).map((pe: any) => ({
      id: pe.id,
      title: pe.title,
      category: pe.category || "Luyện đề",
      createdAt: pe.created_at || new Date().toISOString(),
      assigned_month: pe.assigned_month,
      score: "8.0"
    }));
  }, [reportMode, studentPracticeAttempts, practiceExams]);

  const filteredModalPracticeAttempts = useMemo(() => {
    if (practiceMonthFilter === "all") return pickerSourceList;
    const targetM = Number(practiceMonthFilter);
    return pickerSourceList.filter((a) => {
      const { month } = resolveAttemptMonthAndWeek(a);
      return month === targetM;
    });
  }, [pickerSourceList, practiceMonthFilter, resolveAttemptMonthAndWeek]);

  const formattedCurrentSchedulerDate = useMemo(
    () => formatVietnameseDayAndDate(schedulerIsoDate),
    [schedulerIsoDate]
  );

  return (
    <div className="space-y-4 max-w-6xl mx-auto text-left font-sans">
      {/* 1. THANH CHUYỂN CHẾ ĐỘ BÁO CÁO TỐI GIẢN & NÚT XUẤT PDF THEO SỐ LƯỢNG HS ĐƯỢC CHỌN */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100/90 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setReportViewType("daily")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs transition cursor-pointer ${
              reportViewType === "daily"
                ? "bg-[#003399] text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Báo cáo Ngày / Buổi học</span>
          </button>

          <button
            type="button"
            onClick={() => setReportViewType("monthly")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs transition cursor-pointer ${
              reportViewType === "monthly"
                ? "bg-white text-[#1D4ED8] shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>Tổng kết Tháng</span>
          </button>

          <button
            type="button"
            onClick={() => setReportViewType("manual")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs transition cursor-pointer ${
              reportViewType === "manual"
                ? "bg-white text-emerald-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tự tạo (HS mới)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {copiedToast && (
            <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Đã sao chép!
            </span>
          )}

          <button
            type="button"
            onClick={handleCopyZalo}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-600 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-blue-600" /> Sao chép Zalo
          </button>

          {reportViewType === "daily" ? (
            <>
              <button
                type="button"
                onClick={() => handleExportClassDailyPDF(true)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" /> Xem / In cá nhân
              </button>

              <button
                type="button"
                onClick={() => handleExportClassDailyPDF(false)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Xuất PDF Báo Cáo ({selectedFilteredStudents.length} HS)</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowOfficialModal(true)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" /> Xem bản chính thức (Tải ảnh/in)
            </button>
          )}
        </div>
      </div>

      {/* 2. THANH CẤU HÌNH NHANH BUỔI HỌC */}
      {reportViewType === "daily" && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 space-y-3 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Tháng học:
              </label>
              <select
                value={dailyMonth}
                onChange={(e) => setDailyMonth(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-[#003399] outline-none focus:border-blue-600 cursor-pointer"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    Tháng {m < 10 ? "0" + m : m}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Tuần học:
              </label>
              <select
                value={dailyWeek}
                onChange={(e) => setDailyWeek(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-[#003399] outline-none focus:border-blue-600 cursor-pointer"
              >
                {[1, 2, 3, 4, 5].map((w) => (
                  <option key={w} value={w}>
                    Tuần {w} - T{dailyMonth}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Ngày in lên phiếu:
              </label>
              <input
                type="text"
                value={customDateStr}
                onChange={(e) => setCustomDateStr(e.target.value)}
                placeholder="VD: 31/10/2026"
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
              />
            </div>

            <div className="md:col-span-6">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                  <span>Chuyên đề học hôm nay & Test tại lớp (T{dailyWeek}.{dailyMonth}):</span>
                </label>
                {overrideTopicTitle && (
                  <button
                    type="button"
                    onClick={() => setOverrideTopicTitle("")}
                    className="text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer"
                  >
                    Khôi phục mặc định
                  </button>
                )}
              </div>
              <input
                type="text"
                value={overrideTopicTitle !== "" ? overrideTopicTitle : autoSyncedTopicTitle}
                onChange={(e) => setOverrideTopicTitle(e.target.value)}
                placeholder="Tên bài học hôm nay..."
                className="w-full px-3 py-1.5 rounded-lg bg-amber-50/50 border border-amber-200 text-xs font-bold text-slate-900 outline-none focus:border-amber-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-2 border-t border-slate-100 items-end">
            <div className="md:col-span-7">
              <label className="block text-[11px] font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Bài BTVN cần thu & đối soát hôm nay (Mặc định lấy BTVN tuần liền trước):</span>
              </label>
              <select
                value={selectedDailyHomeworkSource}
                onChange={(e) => setSelectedDailyHomeworkSource(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-emerald-50/60 border border-emerald-200 text-xs font-bold text-emerald-950 outline-none focus:border-emerald-600 cursor-pointer"
              >
                <option value="auto_prev">
                  ⚡ Tự động (Tuần trước): {autoPreviousHomeworkSource.displayTitle} [
                  {autoPreviousHomeworkSource.modeLabel}]
                </option>
                <option value="current_week">
                  📘 Lấy BTVN của chính Tuần hiện tại (Tuần {dailyWeek} - Tháng {dailyMonth})
                </option>
                <option value="none">🚫 Không thu / Không đối soát BTVN buổi này</option>
                <optgroup label="--- Hoặc chọn chỉ định 1 bài BTVN cụ thể ---">
                  {allHomeworkOptionsForDropdown.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="md:col-span-5">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Đề luyện thi thực chiến trong tháng (Cột điểm số 3):
              </label>
              <select
                value={selectedDailyPracticeId}
                onChange={(e) => setSelectedDailyPracticeId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="none">-- Không kiểm tra đề tháng --</option>
                <option value="auto">Tự động lấy đề thực chiến Tháng {dailyMonth}</option>
                {(practiceExams || []).map((pe: any) => (
                  <option key={pe.id} value={String(pe.id)}>
                    {pe.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-500">Phân hệ:</span>
              {[
                { key: "all", label: `Tất cả (${registeredStudents.length})` },
                { key: "offline", label: "Offline" },
                { key: "online", label: "Online" }
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setDailyStudentFilterMode(t.key as any)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition cursor-pointer ${
                    dailyStudentFilterMode === t.key
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}

              <label className="inline-flex items-center gap-1.5 ml-2 font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCoverSummaryPage}
                  onChange={(e) => setIncludeCoverSummaryPage(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Kèm trang bìa tổng hợp lớp</span>
              </label>
            </div>

            <div className="text-[11px] text-emerald-700 font-semibold">
              ✓ BTVN: {effectiveHomeworkTarget.displayTitle}
            </div>
          </div>
        </div>
      )}

      {/* 3. GIAO DIỆN CHÍNH: DANH SÁCH HỌC VIÊN CÓ CHECKBOX BÊN TRÁI + CHI TIẾT BÊN PHẢI */}
      {reportMode === "auto" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* CỘT TRÁI: DANH SÁCH HỌC SINH + CHECKBOX CHỌN XUẤT PDF */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200/80 shadow-2xs flex flex-col h-[780px]">
            <div className="pb-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#003399]" /> Học viên ({selectedFilteredStudents.length}/{filteredStudents.length})
              </h4>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSelectAllFilteredStudents}
                  className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold transition cursor-pointer"
                >
                  Chọn tất cả
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllFilteredStudents}
                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-semibold transition cursor-pointer"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            <div className="my-2.5 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="Tìm tên hoặc trường..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1">
              {filteredStudents.map((student) => {
                const stuId = String(student.id || "").trim();
                const isSelected = stuId === currentStudent?.id;
                const isCheckedForExport = selectedExportStudentIds.has(stuId);
                const dirInfo = sbdDirectoryMap.get(stuId);
                const fixedSbd =
                  (student.sbd
                    ? String(student.sbd).replace(/\D/g, "").padStart(6, "0").slice(-6)
                    : dirInfo?.sbd) || "000001";
                const stuOverride = dailyStudentOverrides[stuId];
                const attStatus = stuOverride?.attendanceStatus || "present";

                return (
                  <div
                    key={stuId}
                    onClick={() => setSelectedStudentId(stuId)}
                    className={
                      "p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between gap-2 " +
                      (isSelected
                        ? "bg-blue-50/80 border-[#003399]"
                        : "bg-white border-slate-200/60 hover:bg-slate-50")
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => handleToggleStudentExportCheckbox(stuId, e)}
                        className="text-slate-400 hover:text-blue-600 shrink-0 cursor-pointer"
                        title="Tích chọn để xuất PDF báo cáo"
                      >
                        {isCheckedForExport ? (
                          <CheckSquare className="w-4 h-4 text-[#003399]" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono font-bold text-[10px] border border-slate-200">
                            {fixedSbd}
                          </span>
                          <span
                            className={
                              "font-bold text-xs block truncate " +
                              (isSelected ? "text-[#003399]" : "text-slate-800")
                            }
                          >
                            {student.full_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-[10px] text-slate-400 truncate">
                            {student.school || "THPT"} • {dirInfo?.mode || "Offline"}
                          </p>
                          {attStatus === "makeup_done" && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold text-[9px]">
                              Đã bù
                            </span>
                          )}
                          {attStatus === "absent_need_makeup" && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-700 font-bold text-[9px]">
                              Chưa bù
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <ChevronRight
                      className={
                        "w-4 h-4 shrink-0 " + (isSelected ? "text-[#003399]" : "text-slate-300")
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* CỘT PHẢI: CHI TIẾT BÁO CÁO NGÀY HOẶC THÁNG */}
          <div className="lg:col-span-2 bg-white rounded-xl p-4 border border-slate-200/80 shadow-2xs space-y-4">
            {reportViewType === "daily" && currentStudentDailyData ? (
              <div className="space-y-3.5">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#003399] text-white font-bold text-[10px] uppercase">
                        TÂM CHÍ TÀI (TCT)
                      </span>
                      <span className="font-mono font-bold text-xs text-blue-700">
                        SBD Đồng bộ: {currentStudentDailyData.sbd}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        • Học sinh {currentStudentDailyData.learningMode}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      {currentStudentDailyData.studentName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {currentStudentDailyData.school} • Ngày:{" "}
                      <strong className="text-slate-800">{customDateStr}</strong> (Tuần{" "}
                      {dailyWeek} - Tháng {dailyMonth})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentStudentDailyData.hasPaperOMR && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Đã sẵn sàng Phiếu OMR Trang 2
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleExportClassDailyPDF(true)}
                      className="px-3 py-1.5 rounded-lg bg-[#003399] hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> In phiếu bạn này
                    </button>
                  </div>
                </div>

                {/* 3 Cột Điểm số trong ngày */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200">
                    <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                      1. ĐIỂM BTVN (TUẦN TRƯỚC)
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={
                          currentStudentDailyData.homeworkScore !== null
                            ? currentStudentDailyData.homeworkScore
                            : ""
                        }
                        placeholder="Chưa nộp (--)"
                        onChange={(e) => {
                          const val = e.target.value;
                          setDailyStudentOverrides((prev) => ({
                            ...prev,
                            [currentStudentDailyData.studentId]: {
                              ...(prev[currentStudentDailyData.studentId] || {}),
                              homeworkScore: val,
                              homeworkStatus:
                                val.trim() !== "" && Number(val) > 0 ? "completed" : "missing"
                            }
                          }));
                        }}
                        className="w-24 px-2 py-1 rounded-md bg-white border border-emerald-300 font-bold text-sm text-emerald-900 outline-none"
                      />
                      <span className="text-xs font-bold text-emerald-700">/ 10</span>
                    </div>
                    <p
                      className="text-[10px] text-emerald-800 mt-1 truncate"
                      title={effectiveHomeworkTarget.displayTitle}
                    >
                      {effectiveHomeworkTarget.displayTitle}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200">
                    <span className="text-[10px] font-bold uppercase text-blue-800 block">
                      2. ĐIỂM TEST TẠI LỚP (HÔM NAY)
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={
                          currentStudentDailyData.dailyTestScore !== null
                            ? currentStudentDailyData.dailyTestScore
                            : ""
                        }
                        placeholder="Chưa thi"
                        onChange={(e) =>
                          setDailyStudentOverrides((prev) => ({
                            ...prev,
                            [currentStudentDailyData.studentId]: {
                              ...(prev[currentStudentDailyData.studentId] || {}),
                              dailyTestScore: e.target.value
                            }
                          }))
                        }
                        className="w-24 px-2 py-1 rounded-md bg-white border border-blue-300 font-bold text-sm text-blue-900 outline-none"
                      />
                      <span className="text-xs font-bold text-blue-700">/ 10</span>
                    </div>
                    <p className="text-[10px] text-blue-800 mt-1 truncate">
                      Kiểm tra Tuần {dailyWeek} - Tháng {dailyMonth}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-orange-50/60 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-orange-800 block">
                        3. ĐỀ THỰC CHIẾN THÁNG
                      </span>
                      {currentStudentDailyData.practiceScore !== null && (
                        <button
                          type="button"
                          onClick={() =>
                            setDailyStudentOverrides((prev) => ({
                              ...prev,
                              [currentStudentDailyData.studentId]: {
                                ...(prev[currentStudentDailyData.studentId] || {}),
                                practiceScore: "0"
                              }
                            }))
                          }
                          className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Không KT
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={
                          currentStudentDailyData.practiceScore !== null
                            ? currentStudentDailyData.practiceScore
                            : ""
                        }
                        placeholder="Không kiểm tra"
                        onChange={(e) =>
                          setDailyStudentOverrides((prev) => ({
                            ...prev,
                            [currentStudentDailyData.studentId]: {
                              ...(prev[currentStudentDailyData.studentId] || {}),
                              practiceScore: e.target.value
                            }
                          }))
                        }
                        className="w-28 px-2 py-1 rounded-md bg-white border border-orange-300 font-bold text-xs text-orange-900 outline-none"
                      />
                      <span className="text-xs font-bold text-orange-700">/ 10</span>
                    </div>
                    <p className="text-[10px] text-orange-800 mt-1 truncate">
                      {currentStudentDailyData.practiceExamTitle}
                    </p>
                  </div>
                </div>

                {/* KHỐI ĐIỂM DANH 3 TRẠNG THÁI & XẾP LỊCH HỌC BÙ / BỔ TRỢ LINH HOẠT */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase">
                      Điểm danh & Phân loại Học bù:
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSupportSchedulerPanel((prev) => !prev)}
                      className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      <span>
                        {showSupportSchedulerPanel
                          ? "Thu gọn bảng xếp lịch"
                          : "+ Xếp lịch Bổ trợ / Học bù"}
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {[
                      {
                        key: "present" as ExtendedAttendanceStatus,
                        label: "✓ Có mặt đúng giờ",
                        activeCls: "bg-emerald-600 text-white border-emerald-700 shadow-2xs"
                      },
                      {
                        key: "makeup_done" as ExtendedAttendanceStatus,
                        label: "↺ Nghỉ (Đã học bù)",
                        activeCls: "bg-amber-500 text-white border-amber-600 shadow-2xs"
                      },
                      {
                        key: "absent_need_makeup" as ExtendedAttendanceStatus,
                        label: "✕ Nghỉ (Chưa bù)",
                        activeCls: "bg-rose-600 text-white border-rose-700 shadow-2xs"
                      }
                    ].map((opt) => {
                      const active = currentStudentDailyData.attendanceStatus === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            if (opt.key === "absent_need_makeup") {
                              setSchedulerSessionType("makeup");
                              setShowSupportSchedulerPanel(true);
                            }
                            setDailyStudentOverrides((prev) => ({
                              ...prev,
                              [currentStudentDailyData.studentId]: {
                                ...(prev[currentStudentDailyData.studentId] || {}),
                                attendanceStatus: opt.key,
                                attendance:
                                  opt.key === "present"
                                    ? "present"
                                    : opt.key === "makeup_done"
                                    ? "late"
                                    : "absent"
                              }
                            }));
                          }}
                          className={`py-2 px-3 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            active
                              ? opt.activeCls
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {currentStudentDailyData.attendanceStatus === "makeup_done" && (
                    <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
                      ✓ Đã ghi nhận vào báo cáo: <strong>"Nghỉ buổi học chính - Đã hoàn thành học bù và bài tập"</strong> (Điểm BTVN và điểm kiểm tra được giữ nguyên).
                    </div>
                  )}

                  {(currentStudentDailyData.attendanceStatus === "absent_need_makeup" ||
                    showSupportSchedulerPanel ||
                    (currentStudentDailyData.makeupSessions &&
                      currentStudentDailyData.makeupSessions.length > 0)) && (
                    <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <span className="text-xs font-bold text-[#003399] flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-orange-500" />
                          <span>Xếp lịch Học bù / Bổ trợ (In trực tiếp xuống đáy Trang 2 A4)</span>
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSchedulerSessionType("makeup")}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border cursor-pointer ${
                              schedulerSessionType === "makeup"
                                ? "bg-orange-500 text-white border-orange-600"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                          >
                            🟧 Học bù bài vắng
                          </button>
                          <button
                            type="button"
                            onClick={() => setSchedulerSessionType("support")}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold border cursor-pointer ${
                              schedulerSessionType === "support"
                                ? "bg-blue-600 text-white border-blue-700"
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}
                          >
                            🟦 Bổ trợ tăng cường
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-5">
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Chọn Thứ / Ngày hẹn học ({formattedCurrentSchedulerDate}):
                          </label>
                          <input
                            type="date"
                            value={schedulerIsoDate}
                            onChange={(e) => setSchedulerIsoDate(e.target.value)}
                            className="w-full px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none"
                          />
                        </div>

                        <div className="sm:col-span-7">
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                            Ghi chú ca học (Tùy chọn):
                          </label>
                          <input
                            type="text"
                            value={schedulerNote}
                            onChange={(e) => setSchedulerNote(e.target.value)}
                            placeholder="VD: Bù bài Nguyên hàm / Bổ trợ vận dụng cao..."
                            className="w-full px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <span className="block text-[10px] font-semibold text-slate-500 mb-1.5">
                          Tích chọn 1 hoặc nhiều ca liên tiếp trong ngày{" "}
                          <strong className="text-slate-800">
                            {formattedCurrentSchedulerDate}
                          </strong>
                          :
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {AVAILABLE_MAKEUP_SHIFTS.map((shift) => {
                            const matchedSession = (
                              currentStudentDailyData.makeupSessions || []
                            ).find(
                              (s) =>
                                s.date === formattedCurrentSchedulerDate &&
                                s.shiftId === shift.id
                            );
                            const isSelectedShift = Boolean(matchedSession);
                            const isMakeupType =
                              (matchedSession?.type || schedulerSessionType) === "makeup";

                            return (
                              <button
                                key={shift.id}
                                type="button"
                                onClick={() =>
                                  handleToggleMakeupShiftForStudent(
                                    currentStudentDailyData.studentId,
                                    shift
                                  )
                                }
                                className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                                  isSelectedShift
                                    ? isMakeupType
                                      ? "bg-orange-50 border-orange-500 text-orange-950 font-bold"
                                      : "bg-blue-50 border-blue-600 text-blue-950 font-bold"
                                    : "bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                <div className="text-[10px] uppercase opacity-75">
                                  {shift.group}
                                </div>
                                <div className="text-[11px] font-bold mt-0.5">
                                  {shift.timeSlot}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {currentStudentDailyData.makeupSessions &&
                        currentStudentDailyData.makeupSessions.length > 0 && (
                          <div className="pt-2 border-t border-slate-100 space-y-1.5">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">
                              Các ca đã xếp cho {currentStudentDailyData.studentName} (
                              {currentStudentDailyData.makeupSessions.length} ca):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {currentStudentDailyData.makeupSessions.map((sess) => (
                                <span
                                  key={sess.id}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
                                    sess.type === "makeup"
                                      ? "bg-orange-50 text-orange-900 border-orange-300"
                                      : "bg-blue-50 text-blue-900 border-blue-300"
                                  }`}
                                >
                                  <span>
                                    [{sess.type === "makeup" ? "Học bù" : "Bổ trợ"}] {sess.date} •{" "}
                                    {sess.shiftLabel}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveMakeupSessionItem(
                                        currentStudentDailyData.studentId,
                                        sess.id
                                      )
                                    }
                                    className="hover:text-rose-600 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  <div className="pt-1">
                    <span className="text-xs font-bold text-slate-800 uppercase block mb-1.5">
                      Ý thức làm Bài tập về nhà (BTVN tuần trước):
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          key: "completed",
                          label: "✓ Hoàn thành đầy đủ",
                          activeCls: "bg-emerald-600 text-white border-emerald-700"
                        },
                        {
                          key: "late",
                          label: "⚠️ Nộp muộn",
                          activeCls: "bg-amber-500 text-white border-amber-600"
                        },
                        {
                          key: "missing",
                          label: "✕ Chưa hoàn thành",
                          activeCls: "bg-rose-600 text-white border-rose-700"
                        }
                      ].map((opt) => {
                        const active = currentStudentDailyData.homeworkStatus === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() =>
                              setDailyStudentOverrides((prev) => ({
                                ...prev,
                                [currentStudentDailyData.studentId]: {
                                  ...(prev[currentStudentDailyData.studentId] || {}),
                                  homeworkStatus: opt.key as any
                                }
                              }))
                            }
                            className={`py-1.5 px-3 rounded-lg text-xs font-bold border transition cursor-pointer ${
                              active
                                ? opt.activeCls
                                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Nhận xét của Giáo viên */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nhận xét của Giáo viên trong buổi học:
                  </label>
                  <textarea
                    rows={3}
                    value={currentStudentDailyData.teacherComment}
                    onChange={(e) =>
                      setDailyStudentOverrides((prev) => ({
                        ...prev,
                        [currentStudentDailyData.studentId]: {
                          ...(prev[currentStudentDailyData.studentId] || {}),
                          teacherComment: e.target.value
                        }
                      }))
                    }
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                {/* BẢNG ĐỐI SOÁT & SỬA NHANH TỪNG CÂU HỎI OMR (HIỂN THỊ CHO CẢ BÀI THI GIẤY LẪN PHIẾU OMR ẢO TỪ WEB) */}
                {currentStudentDailyData.hasPaperOMR &&
                  currentStudentDailyData.scannedPaperImageUrl && (
                    <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-emerald-400 block">
                            ✓ PHỤ BẢN ĐỐI SOÁT PHIẾU OMR (TRANG 2) — BẤM VÀO CÂU ĐỂ ĐỔI ĐÚNG/SAI
                          </span>
                          <h4 className="text-xs font-bold text-white mt-0.5">
                            {currentStudentDailyData.paperExamTitle} (Mã đề:{" "}
                            {currentStudentDailyData.paperExamCode}) — Đúng:{" "}
                            <span className="text-emerald-400">
                              {currentStudentDailyData.dailyTestCorrect}/
                              {currentStudentDailyData.dailyTestTotal}
                            </span>{" "}
                            • Sai/Trống:{" "}
                            <span className="text-rose-400">
                              {currentStudentDailyData.wrongQuestionsList?.length || 0}
                            </span>
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPaperZoom(1);
                            setPreviewPaperItem({
                              id: "daily-omr",
                              title: currentStudentDailyData.paperExamTitle || "Bài thi OMR",
                              category: "Kiểm tra",
                              completedDate: customDateStr,
                              score: currentStudentDailyData.dailyTestScore ?? 0,
                              submissionType: "paper",
                              paperScanUrl: currentStudentDailyData.scannedPaperImageUrl,
                              omrRawData: {
                                canonical_width: OMR_CANONICAL_WIDTH,
                                canonical_height: OMR_CANONICAL_HEIGHT,
                                bubble_coordinates: currentStudentDailyData.bubbleCoordinates
                              }
                            });
                          }}
                          className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Xem phiếu OMR
                        </button>
                      </div>

                      {currentStudentDailyData.allQuestionsReviewList &&
                        currentStudentDailyData.allQuestionsReviewList.length > 0 && (
                          <div className="max-h-52 overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {currentStudentDailyData.allQuestionsReviewList.map((qRow) => (
                              <div
                                key={qRow.questionNumber}
                                onClick={() =>
                                  handleToggleOMRQuestionCorrectness(
                                    currentStudentDailyData.studentId,
                                    qRow.questionNumber,
                                    qRow.isCorrect
                                  )
                                }
                                className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition ${
                                  qRow.isCorrect
                                    ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-200 hover:bg-emerald-900/50"
                                    : "bg-rose-950/50 border-rose-600/80 text-rose-200 hover:bg-rose-900/60"
                                }`}
                              >
                                <div className="min-w-0 truncate">
                                  <span className="font-bold">
                                    Câu {qRow.questionNumber} ({qRow.part}):
                                  </span>{" "}
                                  <span>{qRow.studentAnswer}</span>{" "}
                                  <span className="opacity-75">(ĐA: {qRow.correctAnswer})</span>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 flex items-center gap-1 ${
                                    qRow.isCorrect
                                      ? "bg-emerald-600 text-white"
                                      : "bg-rose-600 text-white"
                                  }`}
                                >
                                  {qRow.isCorrect ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" /> Đúng
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3 h-3" /> Sai
                                    </>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>
                  )}
              </div>
            ) : currentStudent ? (
              /* ================= NHÁNH 2: BÁO CÁO TỔNG KẾT THÁNG ================= */
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                      Đang xem báo cáo tổng kết tháng
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">
                      {currentStudent.full_name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {currentStudent.school || "THPT"} • {currentStudent.grade || "Lớp 12"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-600">Tháng:</label>
                    <select
                      value={reportMonth}
                      onChange={(e) => setReportMonth(Number(e.target.value))}
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-blue-700 outline-none cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                        <option key={m} value={m}>
                          Tháng {m < 10 ? "0" + m : m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">
                      Tổng bài nộp
                    </span>
                    <span className="text-lg font-bold text-slate-900 mt-1 block">
                      {currentReport.total} bài
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase block">
                      Đ.TB BTVN
                    </span>
                    <span className="text-lg font-bold text-emerald-700 mt-1 block">
                      {autoData.hwAvg} / 10
                    </span>
                  </div>
                  <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-center">
                    <span className="text-[10px] font-bold text-indigo-700 uppercase block">
                      Đ.TB Kiểm tra
                    </span>
                    <span className="text-lg font-bold text-indigo-700 mt-1 block">
                      {autoData.testAvg} / 10
                    </span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-center">
                    <span className="text-[10px] font-bold text-[#1D4ED8] uppercase block">
                      Đ.TB Luyện đề
                    </span>
                    <span className="text-lg font-bold text-[#1D4ED8] mt-1 block">
                      {practiceStats.avg} / 10
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase text-slate-800 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-[#1D4ED8]" /> 1. Bảng theo dõi điểm
                    số theo tuần (Tháng {reportMonth})
                  </h4>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-center text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                          <th className="py-2.5 px-3 text-left w-48">Hạng mục điểm</th>
                          <th className="py-2.5 px-2">T1.{reportMonth}</th>
                          <th className="py-2.5 px-2">T2.{reportMonth}</th>
                          <th className="py-2.5 px-2">T3.{reportMonth}</th>
                          <th className="py-2.5 px-2">T4.{reportMonth}</th>
                          {hasWeek5Data && (
                            <th className="py-2.5 px-2">T5.{reportMonth}</th>
                          )}
                          <th className="py-2.5 px-3 text-right">Trung bình</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold bg-white">
                        <tr>
                          <td className="py-2.5 px-3 text-left font-bold text-slate-800">
                            Bài tập về nhà (BTVN)
                          </td>
                          <td className="py-2.5 px-2 text-emerald-700 font-bold">
                            {autoData.hwByWeek[1] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-emerald-700 font-bold">
                            {autoData.hwByWeek[2] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-emerald-700 font-bold">
                            {autoData.hwByWeek[3] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-emerald-700 font-bold">
                            {autoData.hwByWeek[4] || "--"}
                          </td>
                          {hasWeek5Data && (
                            <td className="py-2.5 px-2 text-emerald-700 font-bold">
                              {autoData.hwByWeek[5] || "--"}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            {autoData.hwAvg}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 text-left font-bold text-slate-800">
                            Kiểm tra định kỳ
                          </td>
                          <td className="py-2.5 px-2 text-indigo-700 font-bold">
                            {autoData.testByWeek[1] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-indigo-700 font-bold">
                            {autoData.testByWeek[2] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-indigo-700 font-bold">
                            {autoData.testByWeek[3] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-indigo-700 font-bold">
                            {autoData.testByWeek[4] || "--"}
                          </td>
                          {hasWeek5Data && (
                            <td className="py-2.5 px-2 text-indigo-700 font-bold">
                              {autoData.testByWeek[5] || "--"}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-right font-bold text-indigo-700">
                            {autoData.testAvg}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase text-slate-800 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-[#1D4ED8]" /> 2. Bảng điểm Luyện đề Thực
                      chiến
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddManualPracticeExam}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-emerald-200 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm đề thủ công
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowPracticePickerModal(true)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] rounded-lg text-xs font-bold transition flex items-center gap-1 border border-blue-200 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Chọn đề đưa vào báo cáo
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase">
                          <th className="py-2.5 px-3 text-center w-10">STT</th>
                          <th className="py-2.5 px-3 min-w-[160px]">Tên đề thi</th>
                          <th className="py-2.5 px-2 w-24">Phân loại</th>
                          <th className="py-2.5 px-2 text-center w-28">Hình thức</th>
                          <th className="py-2.5 px-2 text-center w-24">Ngày nộp</th>
                          <th className="py-2.5 px-2 text-center w-24">Điểm số</th>
                          <th className="py-2.5 px-2 text-center w-14">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {selectedPracticeExams.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                              Chưa có đề luyện thi nào trong Tháng {reportMonth}.
                            </td>
                          </tr>
                        ) : (
                          selectedPracticeExams.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/70">
                              <td className="py-2 px-3 text-center font-bold text-slate-400">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={item.title}
                                  onChange={(e) =>
                                    handleUpdatePracticeExamItem(
                                      item.id,
                                      "title",
                                      e.target.value
                                    )
                                  }
                                  className="w-full font-bold text-slate-800 bg-transparent rounded px-2 py-1 outline-none"
                                />
                                {item.paperScanUrl && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPaperZoom(1);
                                      setPreviewPaperItem(item);
                                    }}
                                    className="mt-0.5 ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:underline cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" /> Xem phiếu thi gốc
                                  </button>
                                )}
                              </td>
                              <td className="py-2 px-2">
                                <input
                                  type="text"
                                  value={item.category}
                                  onChange={(e) =>
                                    handleUpdatePracticeExamItem(
                                      item.id,
                                      "category",
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-2 py-1 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200 text-center outline-none"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <select
                                  value={item.submissionType || "web"}
                                  onChange={(e) =>
                                    handleUpdatePracticeExamItem(
                                      item.id,
                                      "submissionType",
                                      e.target.value as "web" | "paper"
                                    )
                                  }
                                  className="px-2 py-1 rounded text-[10px] font-bold border border-slate-200 bg-slate-50 outline-none cursor-pointer"
                                >
                                  <option value="web">Trực tuyến</option>
                                  <option value="paper">Trên giấy</option>
                                </select>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="text"
                                  value={item.completedDate}
                                  onChange={(e) =>
                                    handleUpdatePracticeExamItem(
                                      item.id,
                                      "completedDate",
                                      e.target.value
                                    )
                                  }
                                  className="w-20 text-center text-slate-600 font-medium bg-transparent outline-none"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="10"
                                  value={item.score}
                                  onChange={(e) =>
                                    handleUpdatePracticeExamItem(
                                      item.id,
                                      "score",
                                      e.target.value
                                    )
                                  }
                                  className="w-14 text-center font-bold text-xs text-blue-700 bg-blue-50 rounded border border-blue-200 py-0.5 outline-none"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemovePracticeItem(item.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nhận xét gửi Phụ huynh:
                  </label>
                  <textarea
                    rows={5}
                    value={autoTeacherEvaluation}
                    onChange={(e) => setAutoTeacherEvaluation(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>
              </>
            ) : (
              <div className="py-24 text-center text-slate-400 font-bold text-xs">
                Vui lòng chọn học sinh ở danh sách bên trái.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* CHẾ ĐỘ 3: TỰ TẠO ĐÁNH GIÁ HỌC SINH MỚI */
        <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-4">
          <h4 className="font-bold text-slate-800 text-sm">
            Điền thông tin đánh giá học viên mới (Tâm Chí Tài TCT)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold text-slate-700">
            <div>
              <label className="block mb-1">Họ và tên học sinh *</label>
              <input
                type="text"
                value={manualForm.fullName}
                onChange={(e) => setManualForm({ ...manualForm, fullName: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
              />
            </div>
            <div>
              <label className="block mb-1">Trường học</label>
              <input
                type="text"
                value={manualForm.school}
                onChange={(e) => setManualForm({ ...manualForm, school: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1">Khối lớp</label>
                <input
                  type="text"
                  value={manualForm.grade}
                  onChange={(e) => setManualForm({ ...manualForm, grade: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block mb-1">Tháng báo cáo</label>
                <select
                  value={manualForm.reportMonth}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, reportMonth: Number(e.target.value) })
                  }
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={m}>
                      Tháng {m < 10 ? "0" + m : m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Nhận xét của Giáo viên:
            </label>
            <textarea
              rows={5}
              value={manualForm.evaluation}
              onChange={(e) => setManualForm({ ...manualForm, evaluation: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none"
            />
          </div>
        </div>
      )}

      {/* MODAL CHỌN ĐỀ THI ĐƯA VÀO BÁO CÁO THÁNG */}
      {showPracticePickerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden text-left">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">
                Chọn đề Luyện thi thực chiến đưa vào Báo cáo
              </h3>
              <button
                type="button"
                onClick={() => setShowPracticePickerModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {filteredModalPracticeAttempts.map((att) => {
                const selectedItem = selectedPracticeExams.find(
                  (item) => item.id === String(att.id)
                );
                const isSelected = Boolean(selectedItem);
                const title =
                  att.examTitle ||
                  att.quizTitle ||
                  att.quiz_title ||
                  att.title ||
                  "Đề luyện thi thực chiến";
                const displayScore = selectedItem
                  ? selectedItem.score
                  : att.score ?? att.points ?? "8.0";

                return (
                  <div
                    key={att.id}
                    onClick={() => handleToggleSelectPracticeExam(att)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? "bg-blue-50 border-blue-600"
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <span className="font-bold text-xs text-slate-800 truncate">
                        {title}
                      </span>
                    </div>
                    <span className="font-bold text-xs text-blue-700">
                      {displayScore} / 10
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM TRƯỚC BẢN IN BÁO CÁO THÁNG */}
      {showOfficialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white w-full max-w-5xl max-h-[96vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold uppercase text-slate-200">
                  Phiếu Báo Cáo Học Tập Tâm Chí Tài (TCT)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExportPNG("page1")}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Tải Trang 1 (.PNG)
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExportPNG("page2")}
                  className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Tải Trang 2 (.PNG)
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExportPNG("single")}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" /> Gộp 1 ảnh dài
                </button>
                <button
                  type="button"
                  onClick={() => setShowOfficialModal(false)}
                  className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex flex-col items-center gap-6 custom-scrollbar">
              <div
                ref={reportPage1Ref}
                style={{ fontFamily: "'Times New Roman', Times, serif" }}
                className="w-full max-w-[840px] bg-white p-7 rounded-2xl border border-slate-300 shadow-sm space-y-5"
              >
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase text-[#003399] block">
                      TRUNG TÂM TOÁN TÂM CHÍ TÀI (TCT) • CHUYÊN TOÁN TƯ DUY - TRẮC NGHIỆM TIA CHỚP
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 mt-0.5">
                      {currentReport.fullName}
                    </h2>
                    <p className="text-sm text-slate-600">
                      {currentReport.school} • {currentReport.grade}
                    </p>
                  </div>
                  <span className="px-3.5 py-1.5 bg-[#003399] text-white text-sm font-bold rounded-lg">
                    {currentReport.timeframeText}
                  </span>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-bold uppercase text-[#003399]">
                    Nhận xét của Giáo viên phụ trách:
                  </h4>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    {parsedEvalBullets.map((item, idx) => (
                      <div key={idx} className="text-sm text-slate-800 leading-relaxed">
                        {item.title && (
                          <strong className="text-slate-900 mr-1">{item.title}:</strong>
                        )}
                        <span>{item.body}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM PHIẾU THI GỐC / PHIẾU OMR ẢO */}
      {previewPaperItem && (
        <div
          onClick={() => setPreviewPaperItem(null)}
          className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[92vh] border border-slate-700 shadow-2xl flex flex-col overflow-hidden cursor-default"
          >
            <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white">
              <div>
                <h4 className="text-sm font-bold text-white">
                  {previewPaperItem.title} — Điểm: {previewPaperItem.score}/10
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPaperZoom((z) => Math.max(0.8, Number((z - 0.25).toFixed(2))))
                  }
                  className="p-1.5 rounded bg-slate-800 text-slate-200 cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono text-slate-300">
                  {Math.round(paperZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPaperZoom((z) => Math.min(2.2, Number((z + 0.25).toFixed(2))))
                  }
                  className="p-1.5 rounded bg-slate-800 text-slate-200 cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewPaperItem(null)}
                  className="p-1.5 rounded bg-slate-800 hover:bg-rose-600 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-5 custom-scrollbar flex items-start justify-center bg-slate-900">
              {previewPaperItem.paperScanUrl && (
                <div
                  style={{
                    width: `${Math.round(520 * paperZoom)}px`,
                    aspectRatio: `${OMR_CANONICAL_WIDTH} / ${OMR_CANONICAL_HEIGHT}`
                  }}
                  className="relative rounded-lg overflow-hidden border border-slate-700 bg-white shadow-2xl shrink-0"
                >
                  <img
                    src={previewPaperItem.paperScanUrl}
                    alt="Phiếu thi OMR"
                    className="w-full h-full object-fill block"
                  />
                  {previewPaperItem.omrRawData?.bubble_coordinates && (
                    <svg
                      viewBox={`0 0 ${OMR_CANONICAL_WIDTH} ${OMR_CANONICAL_HEIGHT}`}
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    >
                      {previewPaperItem.omrRawData.bubble_coordinates
                        .filter((b: any) => b && b.status !== "unfilled")
                        .map((b: any, idx: number) => {
                          const isSbdOrCode =
                            b.section === "sbd" || b.section === "exam_code";
                          const isExpectedMissed = b.status === "expected_missed";
                          const strokeColor = isSbdOrCode
                            ? "#2563EB"
                            : b.status === "correct"
                            ? "#10B981"
                            : b.status === "wrong"
                            ? "#EF4444"
                            : isExpectedMissed
                            ? "#F59E0B"
                            : "#2563EB";
                          const fillColor = isSbdOrCode
                            ? "rgba(37, 99, 235, 0.20)"
                            : b.status === "correct"
                            ? "rgba(16, 185, 129, 0.22)"
                            : b.status === "wrong"
                            ? "rgba(239, 68, 68, 0.24)"
                            : isExpectedMissed
                            ? "rgba(245, 158, 11, 0.18)"
                            : "none";
                          return (
                            <circle
                              key={b.id || `preview_b_${idx}`}
                              cx={b.x}
                              cy={b.y}
                              r={(b.r || 9) + 2.5}
                              fill={fillColor}
                              stroke={strokeColor}
                              strokeWidth={2.4}
                              strokeDasharray={
                                isExpectedMissed ? "4 2" : undefined
                              }
                            />
                          );
                        })}
                    </svg>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
