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
  Clock,
  History
} from "lucide-react";
import {
  OMR_CANONICAL_WIDTH,
  OMR_CANONICAL_HEIGHT,
  gradeOMRSubmission,
  buildDynamicOMRBlueprint
} from "@/lib/omrEngine";
import {
  DailyReportConfig,
  StudentDailyScoreData,
  WrongQuestionReviewItem
} from "@/types/report";
import {
  generateClassDailyReportHTML,
  openPrintOrDownloadClassReport,
  FullQuestionReviewRow,
  DailyPracticeExamSummaryItem
} from "@/lib/reportPdfGenerator";

function getSupabaseClientSafe() {
  if (typeof window !== "undefined") {
    const win = window as any;
    if (win.supabase) return win.supabase;
    if (win.__supabase) return win.__supabase;
  }
  return null;
}

export type ExtendedAttendanceStatus =
  | "present"
  | "makeup_done"
  | "absent_need_makeup"
  | "late"
  | "absent";

export interface MakeupSupportSessionItem {
  id: string;
  date: string;
  shiftId: string;
  shiftLabel: string;
  timeSlot: string;
  type: "makeup" | "support";
  note?: string;
}

export interface CandidateAttemptOption {
  id: string;
  quizId: string;
  title: string;
  score: number;
  createdAtText: string;
  rawTimestamp: number;
  hasRichAnswers: boolean;
  answerKeyCount: number;
  rawAttempt: any;
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

export const TCT_BRANDING_FOOTER_TEXT =
  "TRUNG TÂM TOÁN TÂM CHÍ TÀI (TCT) • Hotline: 0972 26 16 16 • Địa chỉ: Số 10, Tạ Quang Bửu, Bách Khoa, Hà Nội";

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

export interface ParsedQuestionEvaluationMeta {
  questionOrder: number;
  partNum: 1 | 2 | 3;
  localNum: number;
  partLabel: string;
  studentDisplay: string;
  correctDisplay: string;
  resultStatusText?: string;
  isCorrect: boolean;
  isSkipped: boolean;
  isOmrFormatError?: boolean;
  p1StudentKey?: "A" | "B" | "C" | "D" | "";
  p1CorrectKey?: "A" | "B" | "C" | "D" | "";
  p2StudentSubMap?: Record<"a" | "b" | "c" | "d", "Đ" | "S" | "-">;
  p2CorrectSubMap?: Record<"a" | "b" | "c" | "d", "Đ" | "S">;
  p2SubCorrectFlags?: Record<"a" | "b" | "c" | "d", boolean>;
  p3StudentChars?: string[];
  p3CorrectChars?: string[];
}

export type ComputedStudentDailyRecord = StudentDailyScoreData & {
  allQuestionsReviewList?: FullQuestionReviewRow[];
  parsedQuestionMetaList?: ParsedQuestionEvaluationMeta[];
  homeworkQuizTitle?: string;
  attendanceStatus?: ExtendedAttendanceStatus;
  attendanceNote?: string;
  makeupSessions?: MakeupSupportSessionItem[];
  availableTestAttempts?: CandidateAttemptOption[];
  activeAttemptId?: string | null;
  activeQuizId?: string;
  activeQuizTitle?: string;
  hasResolvedQuizDefinition?: boolean;
  exportPages?: 1 | 2;
  practiceExamList?: DailyPracticeExamSummaryItem[];
};

const virtualOMRCache = new Map<string, { dataUrl: string; bubbleCoordinates: any[] }>();
const globalResolvedQuizzesMemoryCache: Record<string, any> = {};

function normalizeText(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * LÀM SẠCH TÊN CHUYÊN ĐỀ BUỔI HỌC (LOẠI BỎ TIỀN TỐ TRÙNG LẶP KIỂU "Test • test • ")
 */
function cleanLessonTopicTitle(rawTitle: string): string {
  if (!rawTitle) return "";
  const parts = String(rawTitle)
    .split("•")
    .map((p) => p.trim())
    .filter(Boolean);

  const uniqueMeaningful: string[] = [];
  const seenNorm = new Set<string>();

  for (const part of parts) {
    const norm = normalizeText(part);
    if (!norm) continue;
    if (norm === "test" || norm === "kiểm tra" || norm === "kiem tra") continue;
    if (seenNorm.has(norm)) continue;
    seenNorm.add(norm);
    uniqueMeaningful.push(part);
  }

  if (uniqueMeaningful.length > 0) {
    return uniqueMeaningful.join(" • ");
  }
  return parts[0] || String(rawTitle).trim();
}

function detectIsHsaAttemptOrExam(att?: any, examMeta?: any): { isHsa: boolean; maxScore: number } {
  const format = String(examMeta?.exam_format || att?.exam_format || "")
    .normalize("NFC")
    .trim()
    .toLowerCase();
  const cat = String(examMeta?.category || att?.category || "")
    .normalize("NFC")
    .toLowerCase();
  const title = String(
    examMeta?.title || att?.examTitle || att?.exam_title || att?.quizTitle || att?.quiz_title || ""
  )
    .normalize("NFC")
    .toLowerCase();

  const isHsa =
    format === "hsa" ||
    att?.submission_type === "web_hsa" ||
    att?.answers?.__hsa_meta?.examFormat === "hsa" ||
    cat.includes("hsa") ||
    cat.includes("đgnl") ||
    cat.includes("dgnl") ||
    title.includes("hsa") ||
    title.includes("đgnl") ||
    title.includes("dgnl");

  if (!isHsa) {
    return { isHsa: false, maxScore: 10 };
  }

  const metaMax = Number(att?.answers?.__hsa_meta?.maxPossibleScore);
  if (!isNaN(metaMax) && metaMax >= 50) {
    return { isHsa: true, maxScore: Math.min(150, metaMax) };
  }
  const sc = Number(att?.score ?? att?.points ?? 0);
  if (sc > 50) return { isHsa: true, maxScore: 150 };
  const partsCount = Number(examMeta?.hsa_parts_count || 0);
  if (partsCount > 0) return { isHsa: true, maxScore: Math.min(150, partsCount * 50) };
  return { isHsa: true, maxScore: 50 };
}

function formatAttemptTimestampShort(rawDate: any): string {
  if (!rawDate) return "Không rõ giờ";
  const dt = new Date(rawDate);
  if (isNaN(dt.getTime())) return String(rawDate);
  const hh = String(dt.getHours()).padStart(2, "0");
  const mm = String(dt.getMinutes()).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  const mo = String(dt.getMonth() + 1).padStart(2, "0");
  return `${hh}:${mm} ngày ${dd}/${mo}`;
}

function formatDateDDMMYYYY(rawDate: any): string {
  const dt = rawDate ? new Date(rawDate) : new Date();
  if (isNaN(dt.getTime())) return "";
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(
    2,
    "0"
  )}/${dt.getFullYear()}`;
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
        body: cleaned.slice(colonIdx + 1).trim()
      };
    }
    return {
      title: "",
      body: cleaned
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
  return submissionType === "paper" ? `${baseCat} (Trên giấy)` : `${baseCat} (Trực tuyến)`;
}

function getCanonicalBubblePosition(
  partNum: 1 | 2 | 3,
  localNum: number,
  optionKey: string,
  subKey?: "a" | "b" | "c" | "d",
  colIndex?: number,
  blueprint?: any
): { x: number; y: number; r: number } {
  if (blueprint) {
    if (partNum === 1 && Array.isArray(blueprint.part1?.blocks)) {
      const b = blueprint.part1.blocks.find(
        (blk: any) => localNum >= blk.startQuestion && localNum <= blk.endQuestion
      );
      if (b) {
        const rowIdx = localNum - b.startQuestion;
        const optIdx = Math.max(0, ["A", "B", "C", "D"].indexOf(String(optionKey).toUpperCase()));
        return {
          x: b.startX + optIdx * b.optionStepX,
          y: b.startY + rowIdx * b.rowStepY,
          r: b.radius || 9.5
        };
      }
    }

    if (partNum === 2 && Array.isArray(blueprint.part2?.blocks)) {
      const b = blueprint.part2.blocks.find((blk: any) => blk.questionNumber === localNum);
      if (b) {
        const subIdx = Math.max(0, ["a", "b", "c", "d"].indexOf(subKey || "a"));
        const isTrueOpt =
          String(optionKey).toUpperCase() === "T" || String(optionKey).toUpperCase() === "Đ";
        return {
          x: isTrueOpt ? b.trueX : b.falseX,
          y: b.startY + subIdx * b.rowStepY,
          r: b.radius || 9.0
        };
      }
    }

    if (partNum === 3 && Array.isArray(blueprint.part3?.blocks)) {
      const b = blueprint.part3.blocks.find((blk: any) => blk.questionNumber === localNum);
      if (b) {
        const c = Math.max(0, Math.min(3, colIndex ?? 0));
        const cx = b.startX + c * b.colStepX;
        const cleanKey = String(optionKey).trim();
        let cy = b.digit0Y;
        if (cleanKey === "-") cy = b.minusY;
        else if (cleanKey === "," || cleanKey === ".") cy = b.commaY;
        else {
          const num = parseInt(cleanKey, 10);
          cy = b.digit0Y + (!isNaN(num) ? num * b.rowStepY : 0);
        }
        return {
          x: cx,
          y: cy,
          r: b.radius || 8.6
        };
      }
    }
  }

  if (partNum === 1) {
    const colGroup = Math.floor((localNum - 1) / 6);
    const rowInCol = (localNum - 1) % 6;
    const baseGroupX = 115 + colGroup * 340;
    const optIdx = Math.max(0, ["A", "B", "C", "D"].indexOf(String(optionKey).toUpperCase()));
    return { x: baseGroupX + 58 + optIdx * 56, y: 515 + rowInCol * 38, r: 10.5 };
  }

  if (partNum === 2) {
    const boxIdx = Math.min(3, Math.max(0, localNum - 1));
    const boxX = 95 + boxIdx * 260;
    const subIdx = Math.max(0, ["a", "b", "c", "d"].indexOf(subKey || "a"));
    const isTrueOpt =
      String(optionKey).toUpperCase() === "T" || String(optionKey).toUpperCase() === "Đ";
    return { x: boxX + (isTrueOpt ? 118 : 186), y: 868 + subIdx * 40, r: 10.5 };
  }

  const qIdx = Math.min(5, Math.max(0, localNum - 1));
  const boxX = 88 + qIdx * 174;
  const cIdx = Math.min(3, Math.max(0, colIndex ?? 0));
  const cleanKey = String(optionKey).trim();
  let rowIdx = 2;
  if (cleanKey === "-") rowIdx = 0;
  else if (cleanKey === "," || cleanKey === ".") rowIdx = 1;
  else {
    const num = parseInt(cleanKey, 10);
    rowIdx = !isNaN(num) ? 2 + num : 2;
  }
  return { x: boxX + 32 + cIdx * 36, y: 1190 + rowIdx * 32, r: 9.5 };
}

const INTERNAL_META_KEYS = new Set([
  "part1_answers",
  "part2_answers",
  "part3_answers",
  "bubble_coordinates",
  "detected_sbd",
  "detected_exam_code",
  "warped_image_data_url",
  "canonical_width",
  "canonical_height"
]);

function extractFlexibleStudentAnswersMap(attempt: any): Record<string, any> {
  const merged: Record<string, any> = {};

  const setAliasIfEmptyOrBetter = (aliasKey: string, val: any) => {
    if (!aliasKey || val === undefined || val === null || val === "") return;
    const existing = merged[aliasKey];
    if (existing === undefined || existing === null || existing === "") {
      merged[aliasKey] = val;
    } else if (
      typeof val === "object" &&
      !Array.isArray(val) &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      merged[aliasKey] = { ...existing, ...val };
    }
  };

  const registerStandardizedKeys = (rawKey: string, val: any) => {
    if (val === undefined || val === null) return;
    const keyTrimmed = String(rawKey).trim();
    if (!keyTrimmed) return;

    merged[keyTrimmed] = val;

    const bindQuestionNumberAliases = (num: number, subKey?: string) => {
      if (isNaN(num) || num <= 0) return;
      const numStr = String(num);
      if (subKey) {
        const sk = subKey.toLowerCase();
        setAliasIfEmptyOrBetter(`${numStr}_${sk}`, val);
        setAliasIfEmptyOrBetter(`q-${numStr}_${sk}`, val);
        setAliasIfEmptyOrBetter(`q_${numStr}_${sk}`, val);
        setAliasIfEmptyOrBetter(`cau_${numStr}_${sk}`, val);
        setAliasIfEmptyOrBetter(`question_${numStr}_${sk}`, val);
        if (num >= 13 && num <= 16) {
          setAliasIfEmptyOrBetter(`p2_q${num - 12}_${sk}`, val);
        }
        const curObj =
          merged[numStr] && typeof merged[numStr] === "object" && !Array.isArray(merged[numStr])
            ? { ...merged[numStr] }
            : {};
        curObj[sk] = val;
        merged[numStr] = curObj;
        merged[`q-${numStr}`] = curObj;
        merged[`q_${numStr}`] = curObj;
      } else {
        setAliasIfEmptyOrBetter(numStr, val);
        setAliasIfEmptyOrBetter(`q-${numStr}`, val);
        setAliasIfEmptyOrBetter(`q_${numStr}`, val);
        setAliasIfEmptyOrBetter(`q${numStr}`, val);
        setAliasIfEmptyOrBetter(`cau_${numStr}`, val);
        setAliasIfEmptyOrBetter(`cau-${numStr}`, val);
        setAliasIfEmptyOrBetter(`question_${numStr}`, val);
        setAliasIfEmptyOrBetter(`c_${numStr}`, val);
      }
    };

    const simpleNumMatch = keyTrimmed.match(/^(?:question[-_]?|q[-_]?|cau[-_]?|c[-_]?)?(\d+)$/i);
    if (simpleNumMatch) {
      bindQuestionNumberAliases(parseInt(simpleNumMatch[1], 10));
      return;
    }

    const simpleSubMatch = keyTrimmed.match(
      /^(?:question[-_]?|q[-_]?|cau[-_]?|c[-_]?)?(\d+)[-_.:]([abcd])$/i
    );
    if (simpleSubMatch) {
      bindQuestionNumberAliases(parseInt(simpleSubMatch[1], 10), simpleSubMatch[2]);
      return;
    }

    const secQMatch = keyTrimmed.match(
      /^sec(?:tion)?[-_](\d+)[-_](?:question|q|cau|c)[-_](\d+)(?:[-_][a-z0-9]+)?(?:[-_.:]([abcd]))?$/i
    );
    if (secQMatch) {
      const secIdx = parseInt(secQMatch[1], 10);
      const rawQNum = parseInt(secQMatch[2], 10);
      const subKey = secQMatch[3];

      let globalOrder = rawQNum;
      if (secIdx === 0) {
        globalOrder = rawQNum;
      } else if (secIdx === 1) {
        globalOrder = rawQNum <= 4 ? 12 + rawQNum : rawQNum;
      } else if (secIdx === 2) {
        globalOrder = rawQNum <= 6 ? 16 + rawQNum : rawQNum;
      }

      bindQuestionNumberAliases(globalOrder, subKey);
      const partNum = secIdx === 0 ? 1 : secIdx === 1 ? 2 : 3;
      const localNum =
        secIdx === 0
          ? rawQNum
          : secIdx === 1
            ? rawQNum > 12
              ? rawQNum - 12
              : rawQNum
            : rawQNum > 16
              ? rawQNum - 16
              : rawQNum;
      if (subKey) {
        setAliasIfEmptyOrBetter(`p${partNum}_q${localNum}_${subKey.toLowerCase()}`, val);
      } else {
        setAliasIfEmptyOrBetter(`p${partNum}_q${localNum}`, val);
        setAliasIfEmptyOrBetter(`part${partNum}_q${localNum}`, val);
      }
      return;
    }

    const qWithHashMatch = keyTrimmed.match(
      /^(?:question|q|cau|c)[-_](\d+)[-_][a-z0-9]+?(?:[-_.:]([abcd]))?$/i
    );
    if (qWithHashMatch) {
      bindQuestionNumberAliases(parseInt(qWithHashMatch[1], 10), qWithHashMatch[2]);
    }
  };

  const ingestSource = (rawSource: any) => {
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
        const orderKey = String(idx + 1);
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const k = String(
            item.questionId ??
              item.question_id ??
              item.id ??
              item.questionOrder ??
              item.order ??
              orderKey
          );
          const v =
            item.answer ??
            item.selectedAnswer ??
            item.studentAnswer ??
            item.userAnswer ??
            item.value ??
            item.selected ??
            item.choice ??
            item.statements ??
            item.subAnswers;
          if (v !== undefined) {
            registerStandardizedKeys(k, v);
            registerStandardizedKeys(orderKey, v);
          }
        } else if (item !== undefined && item !== null) {
          registerStandardizedKeys(orderKey, item);
        }
      });
    } else if (typeof parsed === "object") {
      Object.entries(parsed).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          registerStandardizedKeys(k, v);
        }
      });

      const subContainers = [
        parsed.answers,
        parsed.userAnswers,
        parsed.user_answers,
        parsed.student_answers,
        parsed.studentAnswers,
        parsed.detail,
        parsed.details,
        parsed.part1_answers,
        parsed.part2_answers,
        parsed.part3_answers
      ];
      subContainers.forEach((sub) => {
        if (sub && typeof sub === "object" && !Array.isArray(sub)) {
          Object.entries(sub).forEach(([sk, sv]) => {
            if (sv !== undefined && sv !== null && merged[sk] === undefined) {
              registerStandardizedKeys(sk, sv);
            }
          });
        } else if (Array.isArray(sub)) {
          ingestSource(sub);
        }
      });
    }
  };

  const primaryAnswerSource =
    attempt?.answers ??
    attempt?.userAnswers ??
    attempt?.user_answers ??
    attempt?.student_answers ??
    attempt?.detail;

  const directCandidates = [
    primaryAnswerSource,
    attempt?.answers,
    attempt?.userAnswers,
    attempt?.user_answers,
    attempt?.student_answers,
    attempt?.detail,
    attempt?.studentAnswers,
    attempt?.omr_raw_data
  ];

  directCandidates.forEach((src) => ingestSource(src));

  return merged;
}

function hasValidQuestionsOrSections(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;
  const rawSec =
    obj.sections ||
    obj.data ||
    obj.parts ||
    obj.content?.sections ||
    obj.questions ||
    obj.items;
  if (Array.isArray(rawSec) && rawSec.length > 0) return true;
  if (typeof rawSec === "string" && rawSec.trim().length > 2) return true;
  if (
    rawSec &&
    typeof rawSec === "object" &&
    (Array.isArray(rawSec.sections) || Array.isArray(rawSec.questions))
  ) {
    return true;
  }
  return false;
}

function resolveCompleteQuizObject(
  attempt: any,
  rawQuizObj: any,
  externalCacheMap?: Record<string, any>
): any {
  if (hasValidQuestionsOrSections(rawQuizObj)) {
    return rawQuizObj;
  }

  const targetQuizId = String(
    attempt?.quizId || attempt?.quiz_id || attempt?.exam_id || rawQuizObj?.id || ""
  )
    .trim()
    .toLowerCase();

  const targetQuizTitle = normalizeText(
    attempt?.examTitle ||
      attempt?.exam_title ||
      attempt?.quizTitle ||
      attempt?.quiz_title ||
      attempt?.title ||
      rawQuizObj?.title ||
      ""
  );

  const lookupCaches = [externalCacheMap, globalResolvedQuizzesMemoryCache];
  for (const cacheObj of lookupCaches) {
    if (!cacheObj) continue;
    if (targetQuizId && hasValidQuestionsOrSections(cacheObj[targetQuizId])) {
      return cacheObj[targetQuizId];
    }
    if (targetQuizTitle && hasValidQuestionsOrSections(cacheObj[`title:${targetQuizTitle}`])) {
      return cacheObj[`title:${targetQuizTitle}`];
    }
  }

  if (typeof window === "undefined") {
    return rawQuizObj;
  }

  const matchQuizEntry = (candidate: any): boolean => {
    if (!candidate || typeof candidate !== "object") return false;
    const cId = String(candidate.id || candidate.quiz_id || candidate.exam_id || "")
      .trim()
      .toLowerCase();
    const cTitle = normalizeText(candidate.title || candidate.name || candidate.exam_title || "");
    if (targetQuizId && cId && cId === targetQuizId) return true;
    if (
      targetQuizTitle &&
      cTitle &&
      (cTitle === targetQuizTitle ||
        cTitle.includes(targetQuizTitle) ||
        targetQuizTitle.includes(cTitle))
    ) {
      return true;
    }
    return false;
  };

  try {
    const rawPracticeExams = localStorage.getItem("edunexus_practice_exams");
    if (rawPracticeExams) {
      const parsedExams = JSON.parse(rawPracticeExams);
      const examsList = Array.isArray(parsedExams)
        ? parsedExams
        : Array.isArray(parsedExams?.exams)
          ? parsedExams.exams
          : [];
      const foundExam = examsList.find(
        (ex: any) => matchQuizEntry(ex) && hasValidQuestionsOrSections(ex)
      );
      if (foundExam) {
        if (targetQuizId) globalResolvedQuizzesMemoryCache[targetQuizId] = foundExam;
        if (targetQuizTitle) {
          globalResolvedQuizzesMemoryCache[`title:${targetQuizTitle}`] = foundExam;
        }
        return foundExam;
      }
    }
  } catch {}

  try {
    const rawCourseData = localStorage.getItem("edunexus_course_data");
    if (rawCourseData) {
      const parsedCourse = JSON.parse(rawCourseData);
      const chaptersList = Array.isArray(parsedCourse)
        ? parsedCourse
        : Array.isArray(parsedCourse?.chapters)
          ? parsedCourse.chapters
          : [];

      for (const chap of chaptersList) {
        for (const les of chap?.lessons || []) {
          for (const tq of les?.test_quizzes || []) {
            if (matchQuizEntry(tq) && hasValidQuestionsOrSections(tq)) {
              if (targetQuizId) globalResolvedQuizzesMemoryCache[targetQuizId] = tq;
              if (targetQuizTitle) {
                globalResolvedQuizzesMemoryCache[`title:${targetQuizTitle}`] = tq;
              }
              return tq;
            }
          }
          for (const hw of les?.homework_files || []) {
            if (matchQuizEntry(hw) && hasValidQuestionsOrSections(hw)) {
              if (targetQuizId) globalResolvedQuizzesMemoryCache[targetQuizId] = hw;
              if (targetQuizTitle) {
                globalResolvedQuizzesMemoryCache[`title:${targetQuizTitle}`] = hw;
              }
              return hw;
            }
          }
        }
      }
    }
  } catch {}

  return rawQuizObj;
}

function normalizeTrueFalseSubChar(val: any): "Đ" | "S" | "-" {
  if (val === true || val === 1) return "Đ";
  if (val === false || val === 0) return "S";
  if (val === undefined || val === null) return "-";
  const str = String(val).trim().toUpperCase();
  if (!str || str === "-") return "-";
  if (
    str === "TRUE" ||
    str === "T" ||
    str === "Đ" ||
    str === "D" ||
    str === "1" ||
    str === "ĐÚNG"
  ) {
    return "Đ";
  }
  if (str === "FALSE" || str === "F" || str === "S" || str === "0" || str === "SAI") {
    return "S";
  }
  return "-";
}

function extractPart2CorrectSubMap(
  qObj: any,
  gDetail: any,
  qCoords: any[]
): Record<"a" | "b" | "c" | "d", "Đ" | "S"> {
  const result: Record<"a" | "b" | "c" | "d", "Đ" | "S"> = {
    a: "Đ",
    b: "S",
    c: "Đ",
    d: "S"
  };
  const subKeys: ("a" | "b" | "c" | "d")[] = ["a", "b", "c", "d"];
  const rawCorAnswer =
    qObj?.correctAnswer ?? qObj?.correct_answer ?? qObj?.answer ?? gDetail?.correctAnswerDisplay;

  if (typeof rawCorAnswer === "string") {
    const cleanedCompact = rawCorAnswer.replace(/\s+/g, "").toUpperCase();
    if (/^[ĐDSTF]{4}$/i.test(cleanedCompact)) {
      subKeys.forEach((sk, idx) => {
        const ch = cleanedCompact[idx];
        result[sk] = ch === "Đ" || ch === "D" || ch === "T" ? "Đ" : "S";
      });
      return result;
    }
  }

  const statementsArr =
    qObj?.statements || qObj?.subQuestions || qObj?.propositions || qObj?.options || [];
  const gradedCorStr = String(
    gDetail?.correctAnswerDisplay || (typeof rawCorAnswer === "string" ? rawCorAnswer : "") || ""
  );

  subKeys.forEach((sk, idx) => {
    const stmtObj = Array.isArray(statementsArr) ? statementsArr[idx] : null;
    const subCoords = qCoords.filter((b: any) => b.subKey === sk);
    const expectedSub = subCoords.find(
      (b: any) => b.status === "correct" || b.status === "expected_missed"
    );

    if (stmtObj !== null && stmtObj !== undefined && typeof stmtObj === "object") {
      const rawTruth =
        stmtObj.isTrue ??
        stmtObj.correct ??
        stmtObj.isCorrect ??
        stmtObj.answer ??
        stmtObj.correctAnswer ??
        stmtObj.value;
      const parsed = normalizeTrueFalseSubChar(rawTruth);
      if (parsed === "Đ" || parsed === "S") {
        result[sk] = parsed;
        return;
      }
    }

    if (
      rawCorAnswer &&
      typeof rawCorAnswer === "object" &&
      !Array.isArray(rawCorAnswer) &&
      (rawCorAnswer[sk] !== undefined || rawCorAnswer[sk.toUpperCase()] !== undefined)
    ) {
      const parsed = normalizeTrueFalseSubChar(
        rawCorAnswer[sk] ?? rawCorAnswer[sk.toUpperCase()]
      );
      if (parsed === "Đ" || parsed === "S") {
        result[sk] = parsed;
        return;
      }
    }

    if (Array.isArray(rawCorAnswer) && rawCorAnswer[idx] !== undefined) {
      const parsed = normalizeTrueFalseSubChar(rawCorAnswer[idx]);
      if (parsed === "Đ" || parsed === "S") {
        result[sk] = parsed;
        return;
      }
    }

    if (gradedCorStr) {
      const m = gradedCorStr.match(new RegExp(`${sk}\\)?[\\s:-]*([ĐDSTF])`, "i"));
      if (m && m[1]) {
        const c = m[1].toUpperCase();
        result[sk] = c === "Đ" || c === "D" || c === "T" ? "Đ" : "S";
        return;
      }
    }

    if (expectedSub) {
      result[sk] =
        String(expectedSub.optionKey).toUpperCase() === "T" ||
        String(expectedSub.optionKey).toUpperCase() === "Đ"
          ? "Đ"
          : "S";
    }
  });

  return result;
}

function buildFullOMRQuestionsReview(
  attempt: any,
  rawQuizObjInput: any,
  questionStatusOverrides?: Record<number, boolean>,
  cachedExamsMap?: Record<string, any>
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
  const rawQuizObj = resolveCompleteQuizObject(attempt, rawQuizObjInput, cachedExamsMap);
  const blueprint = buildDynamicOMRBlueprint(rawQuizObj);
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

  const part1Questions: any[] = [];
  const part2Questions: any[] = [];
  const part3Questions: any[] = [];

  if (rawQuizObj) {
    let rawSections =
      rawQuizObj.sections ??
      rawQuizObj.data ??
      rawQuizObj.parts ??
      rawQuizObj.content?.sections ??
      [];
    if (typeof rawSections === "string") {
      try {
        rawSections = JSON.parse(rawSections);
      } catch {
        rawSections = [];
      }
    }

    if (
      rawSections &&
      typeof rawSections === "object" &&
      !Array.isArray(rawSections) &&
      Array.isArray(rawSections.sections)
    ) {
      rawSections = rawSections.sections;
    }

    if (Array.isArray(rawSections) && rawSections.length > 0) {
      rawSections.forEach((sec: any, sIdx: number) => {
        if (!sec) return;
        const secType = String(sec.type || sec.sectionType || "").toLowerCase();
        const secTitle = normalizeText(sec.title || sec.name || sec.part || "");

        let targetPart: 1 | 2 | 3 = sIdx === 0 ? 1 : sIdx === 1 ? 2 : 3;
        if (
          secType === "multiple_choice" ||
          secTitle.includes("phan i ") ||
          secTitle.endsWith("phan i") ||
          secTitle.includes("phan 1") ||
          secTitle.includes("nhieu phuong an")
        ) {
          targetPart = 1;
        } else if (
          secType === "true_false" ||
          secTitle.includes("phan ii") ||
          secTitle.includes("phan 2") ||
          secTitle.includes("dung sai")
        ) {
          targetPart = 2;
        } else if (
          secType === "short_answer" ||
          secTitle.includes("phan iii") ||
          secTitle.includes("phan 3") ||
          secTitle.includes("tra loi ngan")
        ) {
          targetPart = 3;
        }

        const secQuestions =
          sec.questions ?? sec.items ?? sec.data ?? (Array.isArray(sec) ? sec : null);

        if (Array.isArray(secQuestions)) {
          secQuestions.forEach((q: any) => {
            if (!q) return;
            if (targetPart === 1) part1Questions.push(q);
            else if (targetPart === 2) part2Questions.push(q);
            else part3Questions.push(q);
          });
        }
      });
    }
  }

  const orderedEntries: { qObj: any; partNum: 1 | 2 | 3; localNum: number }[] = [];
  if (part1Questions.length > 0 || part2Questions.length > 0 || part3Questions.length > 0) {
    part1Questions.forEach((q, idx) =>
      orderedEntries.push({ qObj: q, partNum: 1, localNum: idx + 1 })
    );
    part2Questions.forEach((q, idx) =>
      orderedEntries.push({ qObj: q, partNum: 2, localNum: idx + 1 })
    );
    part3Questions.forEach((q, idx) =>
      orderedEntries.push({ qObj: q, partNum: 3, localNum: idx + 1 })
    );
  } else {
    const p1Count = blueprint.part1TotalQuestions ?? 12;
    const p2Count = blueprint.part2TotalQuestions ?? 4;
    const p3Count = blueprint.part3TotalQuestions ?? 6;
    for (let i = 1; i <= p1Count; i++) orderedEntries.push({ qObj: null, partNum: 1, localNum: i });
    for (let i = 1; i <= p2Count; i++) orderedEntries.push({ qObj: null, partNum: 2, localNum: i });
    for (let i = 1; i <= p3Count; i++) orderedEntries.push({ qObj: null, partNum: 3, localNum: i });
  }

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

  const totalCount = orderedEntries.length || 22;
  const allRows: FullQuestionReviewRow[] = [];
  const parsedMetaList: ParsedQuestionEvaluationMeta[] = [];

  for (let i = 0; i < totalCount; i++) {
    const qOrder = i + 1;
    const entry = orderedEntries[i];
    const qObj = entry?.qObj || null;
    const partNum: 1 | 2 | 3 = entry?.partNum || (qOrder <= 12 ? 1 : qOrder <= 16 ? 2 : 3);
    const localNum: number =
      entry?.localNum || (partNum === 1 ? qOrder : partNum === 2 ? qOrder - 12 : qOrder - 16);
    const gDetail = gradedDetails[i] || null;
    const rawQId = qObj?.id !== undefined && qObj?.id !== null ? String(qObj.id).trim() : "";

    const partLabel = `Phần ${partNum === 1 ? "I" : partNum === 2 ? "II" : "III"}`;
    const sectionTag = `part${partNum}`;

    const candidateKeys = [
      ...(rawQId ? [rawQId, `q-${rawQId}`, `q_${rawQId}`, `cau_${rawQId}`] : []),
      String(qOrder),
      `q-${qOrder}`,
      `q_${qOrder}`,
      `q${qOrder}`,
      `cau_${qOrder}`,
      `cau-${qOrder}`,
      `question_${qOrder}`,
      `c_${qOrder}`,
      `p${partNum}_q${localNum}`,
      `part${partNum}_q${localNum}`
    ];

    let rawStuVal: any = undefined;
    for (const ck of candidateKeys) {
      if (answersMap[ck] !== undefined && answersMap[ck] !== null && answersMap[ck] !== "") {
        rawStuVal = answersMap[ck];
        break;
      }
    }

    const qCoords = clonedCoords.filter(
      (b: any) => b && b.section === sectionTag && Number(b.questionNumber) === localNum
    );

    let studentDisplay = "";
    let correctDisplay = "";
    let resultStatusText: string | undefined = undefined;
    let autoIsCorrect = false;
    let isSkipped = false;
    let isOmrFormatError = false;

    let p1StudentKey: "A" | "B" | "C" | "D" | "" = "";
    let p1CorrectKey: "A" | "B" | "C" | "D" | "" = "";
    const p2StudentSubMap: Record<"a" | "b" | "c" | "d", "Đ" | "S" | "-"> = {
      a: "-",
      b: "-",
      c: "-",
      d: "-"
    };
    let p2CorrectSubMap: Record<"a" | "b" | "c" | "d", "Đ" | "S"> = {
      a: "Đ",
      b: "S",
      c: "Đ",
      d: "S"
    };
    const p2SubCorrectFlags: Record<"a" | "b" | "c" | "d", boolean> = {
      a: false,
      b: false,
      c: false,
      d: false
    };
    let p3StudentChars: string[] = [];
    let p3CorrectChars: string[] = [];

    if (partNum === 1) {
      let normalizedStuChoice = String(rawStuVal ?? gDetail?.studentAnswerDisplay ?? "")
        .trim()
        .toUpperCase();
      if (!["A", "B", "C", "D"].includes(normalizedStuChoice)) normalizedStuChoice = "";
      studentDisplay = normalizedStuChoice;
      isSkipped = !studentDisplay;

      let normalizedCorChoice = String(
        qObj?.correctAnswer ?? qObj?.correct_answer ?? gDetail?.correctAnswerDisplay ?? ""
      )
        .trim()
        .toUpperCase();
      if (!["A", "B", "C", "D"].includes(normalizedCorChoice)) normalizedCorChoice = "";
      correctDisplay = normalizedCorChoice;
      p1StudentKey = (studentDisplay || "") as "A" | "B" | "C" | "D" | "";
      p1CorrectKey = (correctDisplay || "") as "A" | "B" | "C" | "D" | "";
      autoIsCorrect =
        Boolean(studentDisplay) && Boolean(correctDisplay) && studentDisplay === correctDisplay;
    } else if (partNum === 2) {
      const subKeys: ("a" | "b" | "c" | "d")[] = ["a", "b", "c", "d"];
      p2CorrectSubMap = extractPart2CorrectSubMap(qObj, gDetail, qCoords);
      const stuParts: string[] = [];
      const corParts: string[] = [];
      let allSubRight = true;

      subKeys.forEach((sk, idx) => {
        let subVal: any = undefined;
        if (rawStuVal && typeof rawStuVal === "object" && !Array.isArray(rawStuVal)) {
          subVal = rawStuVal[sk] ?? rawStuVal[sk.toUpperCase()] ?? rawStuVal[idx];
        }
        const stuSubChar = normalizeTrueFalseSubChar(subVal);
        const corSubChar = p2CorrectSubMap[sk];
        const isThisSubCorrect = stuSubChar !== "-" && stuSubChar === corSubChar;
        p2StudentSubMap[sk] = stuSubChar;
        p2SubCorrectFlags[sk] = isThisSubCorrect;
        if (!isThisSubCorrect) allSubRight = false;
        stuParts.push(`${sk})${stuSubChar}`);
        corParts.push(`${sk})${corSubChar}`);
      });

      const isAllBlank = subKeys.every((sk) => p2StudentSubMap[sk] === "-");
      isSkipped = isAllBlank;
      studentDisplay = isAllBlank ? "Trống" : stuParts.join("  ");
      correctDisplay = corParts.join("  ");
      autoIsCorrect = !isAllBlank && allSubRight;
    } else {
      const rawStudentStr = String(rawStuVal ?? gDetail?.studentAnswerDisplay ?? "").trim();
      const rawCorrectStr = String(
        qObj?.correctAnswer ?? qObj?.correct_answer ?? gDetail?.correctAnswerDisplay ?? ""
      ).trim();

      if (!rawStudentStr || rawStudentStr === "Trống" || rawStudentStr === "Bỏ trống") {
        isSkipped = true;
        studentDisplay = "Trống";
        correctDisplay = rawCorrectStr || "--";
        autoIsCorrect = false;
      } else if (rawStudentStr.length > 4) {
        isOmrFormatError = true;
        studentDisplay = `${rawStudentStr} (Sai form OMR > 4 ô)`;
        correctDisplay = rawCorrectStr || "--";
        resultStatusText = "✕ Sai quy cách OMR";
        autoIsCorrect = false;
      } else {
        studentDisplay = rawStudentStr;
        correctDisplay = rawCorrectStr || "--";
        const normStu = rawStudentStr.replace(/\s+/g, "").replace(/,/g, ".");
        const normCor = rawCorrectStr.replace(/\s+/g, "").replace(/,/g, ".");
        autoIsCorrect =
          Boolean(normCor) &&
          (normStu === normCor ||
            (!isNaN(Number(normStu)) &&
              !isNaN(Number(normCor)) &&
              Math.abs(Number(normStu) - Number(normCor)) < 1e-4));
        p3StudentChars = rawStudentStr.replace(/\./g, ",").slice(0, 4).split("");
      }
      p3CorrectChars =
        correctDisplay && correctDisplay !== "--"
          ? correctDisplay.replace(/\./g, ",").slice(0, 4).split("")
          : [];
    }

    const manualOverride = questionStatusOverrides?.[qOrder];
    const finalIsCorrect =
      manualOverride !== undefined
        ? manualOverride
        : isSkipped || isOmrFormatError
          ? false
          : autoIsCorrect;

    allRows.push({
      questionNumber: qOrder,
      part: partLabel,
      studentAnswer: isSkipped ? "Trống" : studentDisplay,
      correctAnswer: correctDisplay || "--",
      isCorrect: finalIsCorrect,
      isSkipped,
      isOmrFormatError,
      resultStatusText
    });

    parsedMetaList.push({
      questionOrder: qOrder,
      partNum,
      localNum,
      partLabel,
      studentDisplay: isSkipped ? "Trống" : studentDisplay,
      correctDisplay: correctDisplay || "--",
      resultStatusText,
      isCorrect: finalIsCorrect,
      isSkipped,
      isOmrFormatError,
      p1StudentKey,
      p1CorrectKey,
      p2StudentSubMap,
      p2CorrectSubMap,
      p2SubCorrectFlags,
      p3StudentChars,
      p3CorrectChars
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
  questionStatusOverrides?: Record<number, boolean>,
  cachedExamsMap?: Record<string, any>
): {
  dataUrl: string;
  bubbleCoordinates: any[];
  reviewData: ReturnType<typeof buildFullOMRQuestionsReview>;
} {
  const reviewData = buildFullOMRQuestionsReview(
    attempt,
    rawQuizObj,
    questionStatusOverrides,
    cachedExamsMap
  );

  const resolvedQuiz = resolveCompleteQuizObject(attempt, rawQuizObj, cachedExamsMap);
  const blueprint = buildDynamicOMRBlueprint(resolvedQuiz);

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
    templateId: blueprint.templateId,
    sbd: cleanSbd,
    code: cleanCode,
    stu: studentName,
    title: titleText,
    rows: reviewData.parsedMetaList.map((m) => [
      m.questionOrder,
      m.studentDisplay,
      m.correctDisplay,
      m.isCorrect
    ])
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
  reviewData.parsedMetaList.forEach((qMeta) => {
    if (qMeta.partNum === 1) {
      const stuKey = qMeta.p1StudentKey || "";
      const corKey = qMeta.p1CorrectKey || "";
      ["A", "B", "C", "D"].forEach((optKey) => {
        const pos = getCanonicalBubblePosition(1, qMeta.localNum, optKey, undefined, undefined, blueprint);
        if (stuKey && optKey === stuKey) {
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
        } else if (!qMeta.isCorrect && corKey && optKey === corKey) {
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
    }
  });

  virtualOMRCache.set(cacheSignature, { dataUrl: "", bubbleCoordinates });
  return { dataUrl: "", bubbleCoordinates, reviewData };
}

export default function AdminStudentReportPanel({
  registeredStudents = [],
  allAttempts = [],
  chapters = [],
  practiceExams = []
}: Props) {
  const currentRealtimeMonth = useMemo(() => new Date().getMonth() + 1, []);
  const todayFormatted = useMemo(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}/${d.getFullYear()}`;
  }, []);

  const [reportViewType, setReportViewType] = useState<"daily" | "monthly" | "manual">("daily");
  const reportMode = reportViewType === "manual" ? "manual" : "auto";

  const [dailyMonth, setDailyMonth] = useState<number>(currentRealtimeMonth);
  const [dailyWeek, setDailyWeek] = useState<number>(4);
  const [customDateStr, setCustomDateStr] = useState<string>(todayFormatted);
  const [overrideTopicTitle, setOverrideTopicTitle] = useState<string>("");

  const [selectedDailyHomeworkSource, setSelectedDailyHomeworkSource] =
    useState<string>("auto_prev");
  const [dailyStudentFilterMode, setDailyStudentFilterMode] = useState<
    "all" | "offline" | "online" | "completed" | "not_completed"
  >("all");
  const [includeCoverSummaryPage, setIncludeCoverSummaryPage] = useState<boolean>(true);

  const [selectedAttemptIdOverride, setSelectedAttemptIdOverride] = useState<string | null>(null);

  const [cachedExamsMap, setCachedExamsMap] = useState<Record<string, any>>(() => ({
    ...globalResolvedQuizzesMemoryCache
  }));
  const fetchedQuizKeysRef = useRef<Set<string>>(new Set());

  const [selectedExportStudentIds, setSelectedExportStudentIds] = useState<Set<string>>(
    new Set()
  );
  const hasInitializedSelectionRef = useRef<boolean>(false);

  // GHI NHẬN CHỈNH SỬA THỦ CÔNG: ĐIỂM BTVN, TEST NGÀY, DANH SÁCH LUYỆN ĐỀ (THPT & ĐGNL HSA), NHẬN XÉT, Ý THỨC BTVN
  const [dailyStudentOverrides, setDailyStudentOverrides] = useState<
    Record<
      string,
      {
        homeworkScore?: string;
        dailyTestScore?: string;
        teacherComment?: string;
        homeworkStatus?: "completed" | "missing" | "late";
        practiceExamList?: DailyPracticeExamSummaryItem[];
        exportPages?: 1 | 2;
      }
    >
  >({});

  const [showOfficialModal, setShowOfficialModal] = useState<boolean>(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [renderedImageUrls] = useState<{
    page1: string | null;
    page2: string | null;
  }>({
    page1: null,
    page2: null
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
    "- Chuyên cần & Thái độ: Con đi học đầy đủ, tập trung và có tinh thần tự giác tốt.\n\n" +
      "- Khả năng tiếp thu: Con nắm được các dạng toán cơ bản và hiểu bài ổn định.\n\n" +
      "- Định hướng giai đoạn tới: Gia đình cùng nhắc nhở con duy trì làm BTVN và luyện đề đều đặn."
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
      "- Chuyên cần & Thái độ: Con đi học đầy đủ và luôn đúng giờ.\n\n" +
      "- Khả năng tiếp thu: Con nắm được các dạng toán cơ bản và hiểu bài ổn định.\n\n" +
      "- Định hướng giai đoạn tới: Duy trì làm bài tập về nhà và luyện đề bấm giờ đều đặn."
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

  useEffect(() => {
    setSelectedAttemptIdOverride(null);
  }, [selectedStudentId, dailyMonth, dailyWeek]);

  const combinedAllAttempts = useMemo(() => {
    const byId = new Map<string, any>();
    const withoutIdList: any[] = [];

    const countKeys = (att: any): number => {
      const cand =
        att?.answers ??
        att?.userAnswers ??
        att?.user_answers ??
        att?.student_answers ??
        att?.detail;
      if (!cand) return 0;
      if (typeof cand === "string") {
        try {
          return Object.keys(JSON.parse(cand)).length;
        } catch {
          return 0;
        }
      }
      if (typeof cand === "object") return Object.keys(cand).length;
      return 0;
    };

    const mergeTwoAttemptRecords = (existing: any, incoming: any) => {
      const existingKeyCount = countKeys(existing);
      const incomingKeyCount = countKeys(incoming);
      const mergedObj = { ...existing, ...incoming };

      if (existingKeyCount > incomingKeyCount) {
        mergedObj.answers = existing.answers ?? incoming.answers;
      } else if (incomingKeyCount > 0) {
        mergedObj.answers = incoming.answers ?? existing.answers;
      }

      const scExist = Number(existing?.score ?? existing?.points ?? 0);
      const scIncom = Number(incoming?.score ?? incoming?.points ?? 0);
      mergedObj.score = Math.max(scExist, scIncom);

      return mergedObj;
    };

    (allAttempts || []).forEach((att: any) => {
      if (!att) return;
      const id = String(att.id || "").trim();
      if (id) byId.set(id, att);
      else withoutIdList.push(att);
    });

    if (typeof window !== "undefined") {
      try {
        const rawLocal = localStorage.getItem("edunexus_attempts");
        if (rawLocal) {
          const parsedLocal = JSON.parse(rawLocal);
          if (Array.isArray(parsedLocal)) {
            parsedLocal.forEach((lAtt: any) => {
              if (!lAtt) return;
              const id = String(lAtt.id || "").trim();
              if (id) {
                if (byId.has(id)) byId.set(id, mergeTwoAttemptRecords(byId.get(id), lAtt));
                else byId.set(id, lAtt);
              } else {
                withoutIdList.push(lAtt);
              }
            });
          }
        }
      } catch {}
    }

    return [...Array.from(byId.values()), ...withoutIdList];
  }, [allAttempts]);

  /**
   * HÀM TẢI ĐỀ THI ZERO EGRESS OVERHEAD — KHỚP CHÍNH XÁC CỘT `id, title, category, exam_format, data` CỦA BẢNG `practice_exams`
   */
  const fetchQuizDataZeroEgress = useCallback(
    async (quizIdRaw?: string, quizTitleRaw?: string): Promise<any | null> => {
      const cleanId = String(quizIdRaw || "").trim();
      const normId = cleanId.toLowerCase();
      const cleanTitle = String(quizTitleRaw || "").trim();
      const normTitle = normalizeText(cleanTitle);

      if (!normId && !normTitle) return null;

      if (normId && hasValidQuestionsOrSections(cachedExamsMap[normId])) {
        return cachedExamsMap[normId];
      }
      if (normTitle && hasValidQuestionsOrSections(cachedExamsMap[`title:${normTitle}`])) {
        return cachedExamsMap[`title:${normTitle}`];
      }

      const localResolved = resolveCompleteQuizObject(
        { quizId: cleanId, examTitle: cleanTitle },
        null,
        cachedExamsMap
      );
      if (hasValidQuestionsOrSections(localResolved)) {
        setCachedExamsMap((prev) => {
          const next = { ...prev };
          if (normId) next[normId] = localResolved;
          if (normTitle) next[`title:${normTitle}`] = localResolved;
          return next;
        });
        return localResolved;
      }

      const requestSignature = `${normId}__${normTitle}`;
      if (fetchedQuizKeysRef.current.has(requestSignature)) {
        return null;
      }
      fetchedQuizKeysRef.current.add(requestSignature);

      if (typeof window === "undefined") return null;

      try {
        let fetchedExamObj: any = null;

        const globalSupabase = getSupabaseClientSafe();
        if (globalSupabase && typeof globalSupabase.from === "function") {
          const orClauses: string[] = [];
          if (cleanId) orClauses.push(`id.eq.${cleanId}`);
          if (cleanTitle) orClauses.push(`title.ilike.%${cleanTitle}%`);

          if (orClauses.length > 0) {
            const { data } = await globalSupabase
              .from("practice_exams")
              .select("id, title, category, exam_format, data")
              .or(orClauses.join(","))
              .limit(1);

            if (Array.isArray(data) && data.length > 0 && hasValidQuestionsOrSections(data[0])) {
              fetchedExamObj = data[0];
            }
          }
        }

        if (!fetchedExamObj) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

          if (supabaseUrl && supabaseAnonKey) {
            const orParts: string[] = [];
            if (cleanId) orParts.push(`id.eq.${encodeURIComponent(cleanId)}`);
            if (cleanTitle) orParts.push(`title.ilike.*${encodeURIComponent(cleanTitle)}*`);

            if (orParts.length > 0) {
              const queryUrl = `${supabaseUrl.replace(
                /\/$/,
                ""
              )}/rest/v1/practice_exams?select=id,title,category,exam_format,data&or=(${orParts.join(
                ","
              )})&limit=1`;

              const resp = await fetch(queryUrl, {
                method: "GET",
                headers: {
                  apikey: supabaseAnonKey,
                  Authorization: `Bearer ${supabaseAnonKey}`,
                  Accept: "application/json"
                }
              });

              if (resp.ok) {
                const rows = await resp.json();
                if (Array.isArray(rows) && rows.length > 0 && hasValidQuestionsOrSections(rows[0])) {
                  fetchedExamObj = rows[0];
                }
              }
            }
          }
        }

        if (fetchedExamObj && hasValidQuestionsOrSections(fetchedExamObj)) {
          const resolvedId = String(fetchedExamObj.id || cleanId || "")
            .trim()
            .toLowerCase();
          const resolvedTitle = normalizeText(fetchedExamObj.title || cleanTitle || "");

          if (resolvedId) globalResolvedQuizzesMemoryCache[resolvedId] = fetchedExamObj;
          if (normId) globalResolvedQuizzesMemoryCache[normId] = fetchedExamObj;
          if (resolvedTitle) {
            globalResolvedQuizzesMemoryCache[`title:${resolvedTitle}`] = fetchedExamObj;
          }
          if (normTitle) {
            globalResolvedQuizzesMemoryCache[`title:${normTitle}`] = fetchedExamObj;
          }

          setCachedExamsMap((prev) => {
            const next = { ...prev };
            if (resolvedId) next[resolvedId] = fetchedExamObj;
            if (normId) next[normId] = fetchedExamObj;
            if (resolvedTitle) next[`title:${resolvedTitle}`] = fetchedExamObj;
            if (normTitle) next[`title:${normTitle}`] = fetchedExamObj;
            return next;
          });

          return fetchedExamObj;
        }
      } catch {}

      return null;
    },
    [cachedExamsMap]
  );

  const sbdDirectoryMap = useMemo(() => {
    const result = new Map<string, { sbd: string; stt: number; mode: "Online" | "Offline" }>();

    (registeredStudents || []).filter(Boolean).forEach((stu, idx) => {
      const id = String(stu.id || "").trim();
      if (!id) return;

      const rawMode = String(stu.learning_mode || stu.study_mode || "offline").toLowerCase();
      const codeFromDb = stu.student_code || stu.sbd || stu.studentCode;

      let finalSbd = "";
      if (codeFromDb) {
        finalSbd = String(codeFromDb).replace(/\D/g, "").padStart(6, "0").slice(-6);
      } else {
        finalSbd = String(idx + 1).padStart(6, "0").slice(-6);
      }

      result.set(id, {
        stt: parseInt(finalSbd, 10) || idx + 1,
        sbd: finalSbd,
        mode: rawMode.includes("on") ? "Online" : "Offline"
      });
    });

    return result;
  }, [registeredStudents]);

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
    return allFlattenedLessons.filter((l) => l.month === dailyMonth && l.week === dailyWeek);
  }, [allFlattenedLessons, dailyMonth, dailyWeek]);

  // LÀM SẠCH TÊN CHUYÊN ĐỀ TỰ ĐỘNG (LOẠI BỎ TIỀN TỐ TRÙNG LẶP KIỂU "Test • test • ")
  const autoSyncedTopicTitle = useMemo(() => {
    if (currentSessionLessons.length > 0) {
      const cleanedList = currentSessionLessons
        .map((m) => cleanLessonTopicTitle(m.lessonTitle))
        .filter((t) => {
          const n = normalizeText(t);
          return n && n !== "test" && n !== "kiểm tra";
        });
      if (cleanedList.length > 0) {
        return Array.from(new Set(cleanedList)).join(" • ");
      }
      return cleanLessonTopicTitle(currentSessionLessons[0].lessonTitle);
    }
    if (allFlattenedLessons.length > 0) {
      return cleanLessonTopicTitle(allFlattenedLessons[0].lessonTitle);
    }
    return `Chuyên đề Toán 12 — Tuần ${dailyWeek} Tháng ${dailyMonth}`;
  }, [currentSessionLessons, allFlattenedLessons, dailyWeek, dailyMonth]);

  useEffect(() => {
    setOverrideTopicTitle("");
  }, [dailyMonth, dailyWeek]);

  const quizAssignmentMap = useMemo(() => {
    const byId = new Map<
      string,
      {
        month?: number;
        week?: number;
        isHw?: boolean;
        isTest?: boolean;
        category?: string;
        rawObj?: any;
      }
    >();
    const byTitle = new Map<
      string,
      {
        month?: number;
        week?: number;
        isHw?: boolean;
        isTest?: boolean;
        category?: string;
        rawObj?: any;
      }
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
      const qId = String(att?.quizId || att?.quiz_id || att?.exam_id || "")
        .trim()
        .toLowerCase();
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

  const autoPreviousHomeworkSource = useMemo(() => {
    const candidateWeeks: { month: number; week: number }[] = [];
    for (let w = dailyWeek - 1; w >= 1; w--) {
      candidateWeeks.push({ month: dailyMonth, week: w });
    }
    const prevMonth = dailyMonth === 1 ? 12 : dailyMonth - 1;
    for (let w = 5; w >= 1; w--) {
      candidateWeeks.push({ month: prevMonth, week: w });
    }

    let firstFoundCandidateWithHw: {
      modeLabel: string;
      lessons: FlattenedLessonEntry[];
      displayTitle: string;
    } | null = null;

    for (const { month: m, week: w } of candidateWeeks) {
      const lessonsInWeek = allFlattenedLessons.filter(
        (l) => l.month === m && l.week === w && l.hwItems.length > 0
      );

      if (lessonsInWeek.length > 0) {
        const candidateHwIds = new Set<string>();
        const candidateHwTitles = new Set<string>();
        lessonsInWeek.forEach((l) => {
          l.hwIds.forEach((id) => candidateHwIds.add(id));
          l.hwTitles.forEach((t) => candidateHwTitles.add(t));
        });

        const displayTitle = lessonsInWeek
          .flatMap((l) => l.hwItems.map((h) => h.title))
          .join(", ");
        const modeLabel = `Tuần ${w} - Tháng ${m}`;
        const candidateObj = { modeLabel, lessons: lessonsInWeek, displayTitle };

        if (!firstFoundCandidateWithHw) firstFoundCandidateWithHw = candidateObj;

        const hasActualSubmissions = (combinedAllAttempts || []).some((att: any) => {
          if (!att) return false;
          const aQId = String(att.quizId || att.quiz_id || att.exam_id || "")
            .trim()
            .toLowerCase();
          const aTitle = normalizeText(
            att.examTitle || att.exam_title || att.quizTitle || att.quiz_title || att.title || ""
          );
          const meta =
            (aQId && quizAssignmentMap.byId.get(aQId)) ||
            (aTitle && quizAssignmentMap.byTitle.get(aTitle));
          const isHw = Boolean(
            meta?.isHw || att.type === "homework" || att.isHomework || att.is_homework
          );
          if (!isHw) return false;
          if (aQId && candidateHwIds.has(aQId)) return true;
          if (
            aTitle &&
            (candidateHwTitles.has(aTitle) ||
              Array.from(candidateHwTitles).some(
                (ct) => ct && (ct.includes(aTitle) || aTitle.includes(ct))
              ))
          ) {
            return true;
          }
          return false;
        });

        if (hasActualSubmissions) return candidateObj;
      }
    }

    if (firstFoundCandidateWithHw) return firstFoundCandidateWithHw;

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
  }, [
    dailyWeek,
    dailyMonth,
    allFlattenedLessons,
    combinedAllAttempts,
    quizAssignmentMap,
    currentSessionLessons
  ]);

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
          label: `[T${les.week}.${les.month} - ${cleanLessonTopicTitle(les.lessonTitle)}] ${hw.title}`,
          hwIds: ids,
          hwTitles: titles,
          month: les.month,
          week: les.week,
          shortTitle: hw.title
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
          names.length > 0 ? names.join(", ") : `BTVN Tuần ${dailyWeek} - Tháng ${dailyMonth}`
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
      displayTitle: autoPreviousHomeworkSource.displayTitle
    };
  }, [
    selectedDailyHomeworkSource,
    currentSessionLessons,
    dailyMonth,
    dailyWeek,
    allHomeworkOptionsForDropdown,
    autoPreviousHomeworkSource
  ]);

  /**
   * ENGINE TÍNH ĐIỂM BÁO CÁO NGÀY (MẶC ĐỊNH 1 TRANG A4 + ĐỒNG BỘ DANH SÁCH LUYỆN ĐỀ THPT & ĐGNL HSA)
   */
  const computeStudentDailyScoreRecord = useCallback(
    (
      student: any,
      attemptIdOverrideForStudent?: string | null
    ): ComputedStudentDailyRecord => {
      const stuId = String(student?.id || "").trim();
      const stuName = String(student?.full_name || student?.name || "Học sinh").trim();
      const dirInfo = sbdDirectoryMap.get(stuId);
      const baseFallbackSbd =
        (student?.sbd
          ? String(student.sbd).replace(/\D/g, "").padStart(6, "0").slice(-6)
          : dirInfo?.sbd) || "000001";
      const learningMode: "Online" | "Offline" = dirInfo?.mode || "Offline";

      const stuAttempts = combinedAllAttempts.filter((att: any) => {
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
        const isCustomSbdMatched = Boolean(
          baseFallbackSbd && baseFallbackSbd !== "000001" && aSbd === baseFallbackSbd
        );
        return (
          (stuId && aStuId === stuId) ||
          (stuName && aStuName === normalizeText(stuName)) ||
          isCustomSbdMatched
        );
      });

      let bestHwAttempt: any = null;
      const candidateDailyTestAttempts: any[] = [];
      const practiceBestByQuizKey = new Map<string, DailyPracticeExamSummaryItem>();

      const currentSessionTestTitles = new Set<string>();
      currentSessionLessons.forEach((m) => {
        m.testTitles.forEach((t) => currentSessionTestTitles.add(t));
        m.testItems.forEach((item) => {
          if (item.title) currentSessionTestTitles.add(normalizeText(item.title));
        });
      });

      const cleanTopicForComment = cleanLessonTopicTitle(
        overrideTopicTitle || autoSyncedTopicTitle
      );
      const effectiveSessionTopicNorm = normalizeText(cleanTopicForComment);

      stuAttempts.forEach((att: any) => {
        const qId = String(att.quizId || att.quiz_id || att.exam_id || "")
          .trim()
          .toLowerCase();
        const rawTitle = String(
          att.examTitle || att.exam_title || att.quizTitle || att.quiz_title || att.title || ""
        ).trim();
        const qTitle = normalizeText(rawTitle);
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
            (qTitle && effectiveHomeworkTarget.hwTitles.has(qTitle)) ||
            (qTitle &&
              Array.from(effectiveHomeworkTarget.hwTitles).some(
                (ht) => ht && (ht.includes(qTitle) || qTitle.includes(ht))
              ));

          if (matchByIdOrTitle) {
            if (!bestHwAttempt || sc >= Number(bestHwAttempt.score ?? bestHwAttempt.points ?? 0)) {
              bestHwAttempt = att;
            }
          }
        }

        const isMatchedCurrentSessionTest =
          currentSessionLessons.some((m) => qId && m.testIds.has(qId)) ||
          (qTitle && currentSessionTestTitles.has(qTitle)) ||
          (qTitle &&
            effectiveSessionTopicNorm &&
            (qTitle.includes(effectiveSessionTopicNorm) ||
              effectiveSessionTopicNorm.includes(qTitle)));

        const isValidDailyTest =
          !isHw &&
          (isMatchedCurrentSessionTest ||
            (isTest && month === dailyMonth && week === dailyWeek) ||
            (att.category === "Đề kiểm tra định kỳ" &&
              month === dailyMonth &&
              week === dailyWeek) ||
            (isPaper && month === dailyMonth && week === dailyWeek));

        if (isValidDailyTest) {
          candidateDailyTestAttempts.push(att);
        }

        // Gom toàn bộ Đề luyện thi THPT & ĐGNL HSA trong tháng hiện tại vào mảng practiceExamList
        const isPracticeCandidate = !isHw && !isValidDailyTest && !meta?.isTest && month === dailyMonth;
        if (isPracticeCandidate && !isNaN(sc)) {
          const { isHsa, maxScore } = detectIsHsaAttemptOrExam(att, meta?.rawObj);
          const dedupKey = qId || qTitle || String(att.id || Math.random());
          const prev = practiceBestByQuizKey.get(dedupKey);
          const prevScoreNum = prev ? Number(prev.score) : -1;

          if (!prev || sc >= prevScoreNum) {
            practiceBestByQuizKey.set(dedupKey, {
              id: String(att.id || dedupKey),
              title: rawTitle || (isHsa ? "Đề thi thử ĐGNL HSA" : "Đề luyện thi THPT"),
              isHsa,
              score: Number(sc.toFixed(1)),
              maxScore,
              completedDate: formatDateDDMMYYYY(att.createdAt || att.created_at || Date.now())
            });
          }
        }
      });

      const sortedTestAttemptOptions: CandidateAttemptOption[] = candidateDailyTestAttempts
        .map((att: any, idx: number) => {
          const extractedMap = extractFlexibleStudentAnswersMap(att);
          const answerKeyCount = Object.keys(extractedMap).filter(
            (k) => !k.startsWith("__") && !INTERNAL_META_KEYS.has(k)
          ).length;
          const rawScore = Number(att?.score ?? att?.points ?? 0);
          const rawTime =
            att?.createdAt || att?.created_at || att?.submittedAt || att?.updated_at;
          const parsedTs = rawTime ? new Date(rawTime).getTime() : 0;

          return {
            id: String(att?.id || `att_idx_${idx}`),
            quizId: String(att?.quizId || att?.quiz_id || att?.exam_id || "").trim(),
            title: String(
              att?.examTitle ||
                att?.exam_title ||
                att?.quizTitle ||
                att?.quiz_title ||
                att?.title ||
                cleanTopicForComment
            ).trim(),
            score: isNaN(rawScore) ? 0 : rawScore,
            createdAtText: formatAttemptTimestampShort(rawTime),
            rawTimestamp: isNaN(parsedTs) ? 0 : parsedTs,
            hasRichAnswers: answerKeyCount > 0,
            answerKeyCount,
            rawAttempt: att
          };
        })
        .sort((a, b) => {
          if (Math.abs(b.score - a.score) > 1e-4) return b.score - a.score;
          if (a.hasRichAnswers !== b.hasRichAnswers) return b.hasRichAnswers ? 1 : -1;
          return b.rawTimestamp - a.rawTimestamp;
        });

      let bestDailyTestAttempt: any =
        sortedTestAttemptOptions.length > 0 ? sortedTestAttemptOptions[0].rawAttempt : null;

      if (attemptIdOverrideForStudent) {
        const overriddenOpt = sortedTestAttemptOptions.find(
          (opt) => opt.id === attemptIdOverrideForStudent
        );
        if (overriddenOpt) bestDailyTestAttempt = overriddenOpt.rawAttempt;
      }

      const sbd = student?.student_code
        ? String(student.student_code).replace(/\D/g, "").padStart(6, "0").slice(-6)
        : dirInfo?.sbd || "000001";

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

      const autoPracticeExamList = Array.from(practiceBestByQuizKey.values());
      const finalPracticeExamList =
        ov.practiceExamList !== undefined ? ov.practiceExamList : autoPracticeExamList;

      // Câu nhận xét tự động súc tích, tự nhiên, không dính tiền tố chương trùng lặp
      const defaultComment =
        testScore !== null && testScore >= 8
          ? `Em ${stuName} nắm chắc kiến thức bài "${cleanTopicForComment}", đạt ${testScore}/10 ở bài kiểm tra trên lớp. Tiếp tục giữ vững phong độ và rèn thêm các câu vận dụng.`
          : testScore !== null
            ? `Em ${stuName} nắm được các dạng cơ bản bài "${cleanTopicForComment}" (${testScore}/10). Cần đọc kỹ đề, kiểm tra lại các bước biến đổi và hoàn thiện BTVN đều đặn.`
            : hwScore !== null
              ? `Em ${stuName} đã hoàn thành BTVN (${hwScore}/10) và theo dõi tốt nội dung bài "${cleanTopicForComment}". Gia đình nhắc con ôn tập kỹ công thức trọng tâm trước buổi tới.`
              : `Em ${stuName} học tập nghiêm túc chuyên đề "${cleanTopicForComment}". Gia đình nhắc nhở con hoàn thành đầy đủ BTVN để củng cố kiến thức buổi học.`;

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
        dailyTestCorrect: bestDailyTestAttempt
          ? Number(
              bestDailyTestAttempt.correct_answers_count ??
                bestDailyTestAttempt.correct_count ??
                bestDailyTestAttempt.correctCount ??
                0
            ) || null
          : null,
        dailyTestTotal: bestDailyTestAttempt
          ? Number(
              bestDailyTestAttempt.total_questions ?? bestDailyTestAttempt.totalQuestions ?? 0
            ) || null
          : null,
        practiceScore: null,
        practiceExamTitle: "",
        teacherComment: ov.teacherComment !== undefined ? ov.teacherComment : defaultComment,
        attendance: "present",
        attendanceStatus: "present",
        homeworkStatus: resolvedHomeworkStatus,
        hasPaperOMR: false,
        availableTestAttempts: sortedTestAttemptOptions,
        activeAttemptId: bestDailyTestAttempt ? String(bestDailyTestAttempt.id || "") : null,
        activeQuizId: bestDailyTestAttempt
          ? String(bestDailyTestAttempt.quizId || bestDailyTestAttempt.exam_id || "")
          : "",
        activeQuizTitle: bestDailyTestAttempt
          ? String(bestDailyTestAttempt.examTitle || bestDailyTestAttempt.quizTitle || "")
          : "",
        hasResolvedQuizDefinition: true,
        exportPages: ov.exportPages ?? 1,
        practiceExamList: finalPracticeExamList
      };
    },
    [
      sbdDirectoryMap,
      combinedAllAttempts,
      quizAssignmentMap,
      resolveAttemptMonthAndWeek,
      effectiveHomeworkTarget,
      currentSessionLessons,
      dailyMonth,
      dailyWeek,
      dailyStudentOverrides,
      overrideTopicTitle,
      autoSyncedTopicTitle
    ]
  );

  const studentDailyScoreRecordsMap = useMemo(() => {
    const map = new Map<string, ComputedStudentDailyRecord>();
    (registeredStudents || []).forEach((stu) => {
      if (!stu) return;
      const stuId = String(stu.id || "").trim();
      if (!stuId) return;
      const attemptOverride =
        stuId === String(selectedStudentId || "").trim() ? selectedAttemptIdOverride : null;
      map.set(stuId, computeStudentDailyScoreRecord(stu, attemptOverride));
    });
    return map;
  }, [
    registeredStudents,
    selectedStudentId,
    selectedAttemptIdOverride,
    computeStudentDailyScoreRecord
  ]);

  const filteredStudents = useMemo(() => {
    return (registeredStudents || []).filter((s) => {
      if (!s) return false;
      const stuId = String(s.id || "").trim();
      const matchSearch =
        (s.full_name || "").toLowerCase().includes(searchStudent.toLowerCase()) ||
        (s.school || "").toLowerCase().includes(searchStudent.toLowerCase()) ||
        String(sbdDirectoryMap.get(stuId)?.sbd || "").includes(searchStudent.trim());
      if (!matchSearch) return false;

      if (reportViewType === "daily" && dailyStudentFilterMode !== "all") {
        const rawMode = String(s.learning_mode || s.study_mode || "offline").toLowerCase();
        const isOnline = rawMode.includes("on");
        if (dailyStudentFilterMode === "online" && !isOnline) return false;
        if (dailyStudentFilterMode === "offline" && isOnline) return false;

        if (
          dailyStudentFilterMode === "completed" ||
          dailyStudentFilterMode === "not_completed"
        ) {
          const rec =
            studentDailyScoreRecordsMap.get(stuId) || computeStudentDailyScoreRecord(s);
          const hasDoneWork =
            rec.dailyTestScore !== null ||
            rec.homeworkScore !== null ||
            (rec.practiceExamList && rec.practiceExamList.length > 0);
          if (dailyStudentFilterMode === "completed" && !hasDoneWork) return false;
          if (dailyStudentFilterMode === "not_completed" && hasDoneWork) return false;
        }
      }
      return true;
    });
  }, [
    registeredStudents,
    searchStudent,
    sbdDirectoryMap,
    reportViewType,
    dailyStudentFilterMode,
    studentDailyScoreRecordsMap,
    computeStudentDailyScoreRecord
  ]);

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
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
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
    const stuId = String(currentStudent.id || "").trim();
    return (
      studentDailyScoreRecordsMap.get(stuId) ||
      computeStudentDailyScoreRecord(currentStudent, selectedAttemptIdOverride)
    );
  }, [
    currentStudent,
    studentDailyScoreRecordsMap,
    computeStudentDailyScoreRecord,
    selectedAttemptIdOverride
  ]);

  const handleUpdateStudentPracticeList = (
    studentId: string,
    updater: (list: DailyPracticeExamSummaryItem[]) => DailyPracticeExamSummaryItem[]
  ) => {
    const baseList =
      dailyStudentOverrides[studentId]?.practiceExamList ??
      currentStudentDailyData?.practiceExamList ??
      [];
    setDailyStudentOverrides((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        practiceExamList: updater(baseList)
      }
    }));
  };

  const handleAddDailyPracticeRow = (studentId: string, isHsa: boolean) => {
    handleUpdateStudentPracticeList(studentId, (list) => [
      ...list,
      {
        id: `daily-prac-${Date.now()}`,
        title: isHsa ? "Đề thi thử ĐGNL HSA" : "Đề luyện thi THPT",
        isHsa,
        score: isHsa ? 40 : 8.5,
        maxScore: isHsa ? 50 : 10,
        completedDate: customDateStr
      }
    ]);
  };

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

    const studentsScoreData = targetStudents.map((stu) => {
      const stuId = String(stu.id || "").trim();
      const record =
        studentDailyScoreRecordsMap.get(stuId) ||
        computeStudentDailyScoreRecord(
          stu,
          stuId === String(currentStudent?.id || "").trim() ? selectedAttemptIdOverride : null
        );
      return {
        ...record,
        exportPages: 1 as const
      };
    });

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
    const topic = cleanLessonTopicTitle(
      (overrideTopicTitle && overrideTopicTitle.trim()) || autoSyncedTopicTitle
    );

    const hwStatusText =
      d.homeworkStatus === "completed"
        ? "Hoàn thành đầy đủ"
        : d.homeworkStatus === "late"
          ? "Nộp muộn"
          : "Chưa nộp BTVN";

    const practiceLines =
      d.practiceExamList && d.practiceExamList.length > 0
        ? `\n📝 KẾT QUẢ LUYỆN ĐỀ (THPT & ĐGNL HSA):\n` +
          d.practiceExamList
            .map(
              (p, idx) =>
                `  ${idx + 1}. ${p.title} [${p.isHsa ? "ĐGNL HSA" : "THPT"}]: ${p.score}/${
                  p.maxScore
                }${p.isHsa ? "đ" : ""} (${p.completedDate})`
            )
            .join("\n") +
          "\n"
        : "";

    const msg =
      `[TRUNG TÂM TOÁN TÂM CHÍ TÀI - TCT]\n` +
      `📋 BÁO CÁO KẾT QUẢ BUỔI HỌC NGÀY ${customDateStr}\n` +
      `• Học sinh: ${d.studentName} (SBD: ${d.sbd})\n` +
      `• Trường: ${d.school} • ${d.grade}\n` +
      `• Nội dung buổi học: ${topic}\n` +
      `------------------------------------\n` +
      `1. Bài tập về nhà (${effectiveHomeworkTarget.displayTitle}): ${
        d.homeworkScore !== null ? `${d.homeworkScore}/10` : "Chưa nộp"
      } (${hwStatusText})\n` +
      `2. Kiểm tra tại lớp: ${
        d.dailyTestScore !== null ? `${d.dailyTestScore}/10` : "Chưa kiểm tra"
      }\n` +
      practiceLines +
      `------------------------------------\n` +
      `💬 NHẬN XÉT CỦA GIÁO VIÊN:\n` +
      `"${d.teacherComment}"\n\n` +
      `📞 ${TCT_BRANDING_FOOTER_TEXT}`;

    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(msg);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  // --- LOGIC BÁO CÁO TỔNG KẾT THÁNG ---
  const studentAllAttempts = useMemo(() => {
    if (!currentStudent) return [];
    return combinedAllAttempts.filter(
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
  }, [combinedAllAttempts, currentStudent]);

  const studentPracticeAttempts = useMemo(() => {
    return studentAllAttempts.filter((a) => {
      const qId = String(a?.quizId || a?.quiz_id || a?.exam_id || "")
        .trim()
        .toLowerCase();
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
            paperScanUrl: a.paper_scan_url || a.omr_raw_data?.warped_image_data_url || null,
            omrRawData: a.omr_raw_data || null
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
        omrRawData: attOrExam.omr_raw_data || null
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
      submissionType: "paper"
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
    if (pageMode === "page1") logicalHeight = 490 + pracTableH + 75;
    else if (pageMode === "page2") logicalHeight = 200 + totalEvalCardHeight + 110;

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

    drawRoundedRect(ctx, contentX, cursorY, contentWidth, headerH, 12, "#F8FAFC", "#CBD5E1", 1);

    ctx.fillStyle = "#003399";
    ctx.font = "bold 12px " + FONT_SERIF;
    ctx.fillText(
      "TRUNG TÂM TOÁN TÂM CHÍ TÀI (TCT) • PHIẾU BÁO CÁO KẾT QUẢ ĐỊNH KỲ",
      contentX + 20,
      cursorY + 25
    );

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
    ctx.fillText(currentReport.timeframeText.toUpperCase(), badgeX + badgeW / 2, badgeY + 19);
    ctx.textAlign = "left";

    cursorY += headerH + 22;

    if (pageMode === "single" || pageMode === "page1") {
      const gap = 14;
      const cardW = (contentWidth - gap * 3) / 4;
      const cardH = 76;

      const summaryCards = [
        { label: "TỔNG BÀI NỘP", val: `${currentReport.total} bài`, valColor: "#0F172A" },
        { label: "ĐIỂM TB BTVN", val: `${currentReport.hwAvg} / 10`, valColor: "#003399" },
        { label: "ĐIỂM TB KIỂM TRA", val: `${currentReport.testAvg} / 10`, valColor: "#003399" },
        {
          label: "ĐIỂM TB LUYỆN ĐỀ",
          val: currentReport.practiceAvg !== "--" ? `${currentReport.practiceAvg} / 10` : "--",
          valColor: "#003399"
        }
      ];

      summaryCards.forEach((c, idx) => {
        const cx = contentX + idx * (cardW + gap);
        drawRoundedRect(ctx, cx, cursorY, cardW, cardH, 10, "#F8FAFC", "#CBD5E1", 1.2);
        ctx.fillStyle = "#475569";
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
        ctx.fillStyle = sc ? "#003399" : "#64748B";
        ctx.fillText(sc ? `${sc}đ` : "--", colCenterX, row1Y);
      });
      ctx.textAlign = "right";
      ctx.fillStyle = "#003399";
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
        ctx.fillStyle = sc ? "#003399" : "#64748B";
        ctx.fillText(sc ? `${sc}đ` : "--", colCenterX, row2Y);
      });
      ctx.textAlign = "right";
      ctx.fillStyle = "#003399";
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

    ctx.textAlign = "center";
    ctx.fillStyle = "#334155";
    ctx.font = "bold 12px " + FONT_SERIF;
    ctx.fillText(TCT_BRANDING_FOOTER_TEXT, logicalWidth / 2, logicalHeight - outerPad - 14);

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

  const handleExportPNG = (mode: "single" | "page1" | "page2" | "both") => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        if (mode === "single") {
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
          if (p2) setTimeout(() => triggerDownloadUrl(p2, "_Trang_2"), 350);
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
    const practiceLines =
      currentReport.practiceItems.length > 0
        ? currentReport.practiceItems
            .map(
              (p, idx) =>
                `  ${idx + 1}. ${p.title} [${formatCategoryWithSubmissionMode(
                  p.category,
                  p.submissionType
                )}]: ${p.score}/10 (${p.completedDate})`
            )
            .join("\n")
        : "  (Chưa làm đề luyện thi trong tháng)";

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
      "- Điểm TB BTVN: " +
      currentReport.hwAvg +
      " / 10\n" +
      "- Điểm TB Kiểm tra: " +
      currentReport.testAvg +
      " / 10\n" +
      "- Điểm TB Luyện đề: " +
      (currentReport.practiceAvg !== "--" ? currentReport.practiceAvg + " / 10" : "--") +
      "\n\n" +
      `* BTVN theo tuần: [T1.${m}: ${currentReport.hwScores[1] || "--"}] | [T2.${m}: ${
        currentReport.hwScores[2] || "--"
      }] | [T3.${m}: ${currentReport.hwScores[3] || "--"}] | [T4.${m}: ${
        currentReport.hwScores[4] || "--"
      }]\n` +
      `* Luyện đề thực chiến:\n${practiceLines}\n\n` +
      "------------------------------------\n" +
      "II. NHẬN XÉT CỦA GIÁO VIÊN:\n" +
      currentReport.evaluation +
      "\n\n" +
      `📞 ${TCT_BRANDING_FOOTER_TEXT}`;

    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(msg);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  const pickerSourceList = useMemo(() => {
    if (reportMode === "auto") return studentPracticeAttempts;
    if (studentPracticeAttempts.length > 0) return studentPracticeAttempts;
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

  const availableTestAttemptsForCurrent = currentStudentDailyData?.availableTestAttempts || [];
  const bestCandidateAttempt = availableTestAttemptsForCurrent[0] || null;

  return (
    <div className="space-y-4 max-w-6xl mx-auto text-left font-sans">
      {/* 1. THANH CHUYỂN CHẾ ĐỘ BÁO CÁO & NÚT XUẤT PDF */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setReportViewType("daily")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs transition cursor-pointer ${
              reportViewType === "daily"
                ? "bg-[#003399] text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Báo cáo Buổi học (1 Trang A4)</span>
          </button>

          <button
            type="button"
            onClick={() => setReportViewType("monthly")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs transition cursor-pointer ${
              reportViewType === "monthly"
                ? "bg-white text-[#1D4ED8]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <span>Tổng kết Tháng</span>
          </button>

          <button
            type="button"
            onClick={() => setReportViewType("manual")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs transition cursor-pointer ${
              reportViewType === "manual"
                ? "bg-white text-[#1D4ED8]"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5 text-[#1D4ED8]" />
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
            className="px-3 py-1.5 bg-white border border-slate-200 hover:border-[#1D4ED8] text-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-[#1D4ED8]" /> Sao chép Zalo
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
                className="px-3.5 py-1.5 bg-[#003399] hover:bg-blue-800 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Xuất PDF Báo Cáo ({selectedFilteredStudents.length} HS)</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowOfficialModal(true)}
              className="px-3.5 py-1.5 bg-[#1D4ED8] hover:bg-blue-800 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" /> Xem bản chính thức
            </button>
          )}
        </div>
      </div>

      {/* 2. THANH CẤU HÌNH NHANH BUỔI HỌC */}
      {reportViewType === "daily" && (
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Tháng học:
              </label>
              <select
                value={dailyMonth}
                onChange={(e) => setDailyMonth(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs font-bold text-[#003399] outline-none focus:border-[#1D4ED8] cursor-pointer"
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
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs font-bold text-[#003399] outline-none focus:border-[#1D4ED8] cursor-pointer"
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
                placeholder="VD: 25/11/2026"
                className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-[#1D4ED8]"
              />
            </div>

            <div className="md:col-span-6">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-[#1D4ED8]" />
                  <span>Nội dung buổi học (T{dailyWeek}.{dailyMonth}):</span>
                </label>
                {overrideTopicTitle && (
                  <button
                    type="button"
                    onClick={() => setOverrideTopicTitle("")}
                    className="text-[10px] font-semibold text-[#1D4ED8] hover:underline cursor-pointer"
                  >
                    Khôi phục mặc định
                  </button>
                )}
              </div>
              <input
                type="text"
                value={overrideTopicTitle !== "" ? overrideTopicTitle : autoSyncedTopicTitle}
                onChange={(e) => setOverrideTopicTitle(e.target.value)}
                placeholder="VD: Bài 4: Đổi biến + Lượng giác hóa"
                className="w-full px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs font-bold text-slate-900 outline-none focus:border-[#1D4ED8] focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 pt-2 border-t border-slate-100 items-end">
            <div className="md:col-span-8">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#1D4ED8]" />
                <span>Bài BTVN đối soát trong buổi học:</span>
              </label>
              <select
                value={selectedDailyHomeworkSource}
                onChange={(e) => setSelectedDailyHomeworkSource(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] border border-slate-200 text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] cursor-pointer"
              >
                <option value="auto_prev">
                  Tự động (Tuần trước): {autoPreviousHomeworkSource.displayTitle} [
                  {autoPreviousHomeworkSource.modeLabel}]
                </option>
                <option value="current_week">
                  Lấy BTVN của chính Tuần hiện tại (Tuần {dailyWeek} - Tháng {dailyMonth})
                </option>
                <option value="none">Không thu / Không đối soát BTVN buổi này</option>
                <optgroup label="--- Chọn chỉ định 1 bài BTVN cụ thể ---">
                  {allHomeworkOptionsForDropdown.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="md:col-span-4 flex items-center justify-end">
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCoverSummaryPage}
                  onChange={(e) => setIncludeCoverSummaryPage(e.target.checked)}
                  className="rounded border-slate-300 text-[#1D4ED8]"
                />
                <span>Kèm trang bìa tổng hợp lớp</span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-500">Lọc học sinh:</span>
              {[
                { key: "all", label: `Tất cả (${registeredStudents.length})` },
                { key: "offline", label: "Offline" },
                { key: "online", label: "Online" },
                { key: "completed", label: "Đã có điểm" },
                { key: "not_completed", label: "Chưa có điểm" }
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setDailyStudentFilterMode(t.key as any)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition cursor-pointer ${
                    dailyStudentFilterMode === t.key
                      ? "bg-[#003399] text-white border-[#003399]"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-[#F8FAFC]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="text-[11px] text-slate-500 font-semibold">
              BTVN đối soát: <strong className="text-slate-800">{effectiveHomeworkTarget.displayTitle}</strong>
            </div>
          </div>
        </div>
      )}

      {/* 3. GIAO DIỆN CHÍNH: DANH SÁCH HỌC VIÊN + CHI TIẾT BÁO CÁO */}
      {reportMode === "auto" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* CỘT TRÁI: DANH SÁCH HỌC SINH */}
          <div className="bg-white rounded-xl p-3.5 border border-slate-200 flex flex-col h-[720px]">
            <div className="pb-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#003399]" /> Học viên (
                {selectedFilteredStudents.length}/{filteredStudents.length})
              </h4>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSelectAllFilteredStudents}
                  className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] text-[10px] font-bold transition cursor-pointer"
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
                placeholder="Tìm tên, SBD hoặc trường..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#F8FAFC] border border-slate-200 rounded-lg text-xs font-medium outline-none focus:border-[#1D4ED8]"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar pr-1">
              {filteredStudents.map((student) => {
                const stuId = String(student.id || "").trim();
                const isSelected = stuId === currentStudent?.id;
                const isCheckedForExport = selectedExportStudentIds.has(stuId);
                const dirInfo = sbdDirectoryMap.get(stuId);
                const stuDataQuick =
                  studentDailyScoreRecordsMap.get(stuId) ||
                  computeStudentDailyScoreRecord(student);
                const fixedSbd = stuDataQuick.sbd || dirInfo?.sbd || "000001";
                const pracCount = stuDataQuick.practiceExamList?.length || 0;

                return (
                  <div
                    key={stuId}
                    onClick={() => setSelectedStudentId(stuId)}
                    className={
                      "p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between gap-2 " +
                      (isSelected
                        ? "bg-blue-50/70 border-[#003399]"
                        : "bg-white border-slate-200/70 hover:bg-[#F8FAFC]")
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={(e) => handleToggleStudentExportCheckbox(stuId, e)}
                        className="text-slate-400 hover:text-[#1D4ED8] shrink-0 cursor-pointer"
                        title="Tích chọn để xuất PDF báo cáo"
                      >
                        {isCheckedForExport ? (
                          <CheckSquare className="w-4 h-4 text-[#003399]" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono font-bold text-[10px] border border-slate-200 shrink-0">
                            {fixedSbd}
                          </span>
                          <span
                            className={
                              "font-bold text-xs truncate " +
                              (isSelected ? "text-[#003399]" : "text-slate-800")
                            }
                          >
                            {student.full_name}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <span
                            className={`px-1.5 py-0.2 rounded font-semibold text-[10px] ${
                              stuDataQuick.homeworkScore !== null
                                ? "bg-blue-50 text-[#003399] border border-blue-200"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {stuDataQuick.homeworkScore !== null
                              ? `BTVN: ${stuDataQuick.homeworkScore}`
                              : "BTVN: --"}
                          </span>

                          <span
                            className={`px-1.5 py-0.2 rounded font-semibold text-[10px] ${
                              stuDataQuick.dailyTestScore !== null
                                ? "bg-blue-50 text-[#003399] border border-blue-200"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {stuDataQuick.dailyTestScore !== null
                              ? `KT: ${stuDataQuick.dailyTestScore}`
                              : "Chưa KT"}
                          </span>

                          {pracCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-semibold text-[10px]">
                              {pracCount} đề
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

          {/* CỘT PHẢI: CHI TIẾT BÁO CÁO 1 TRANG A4 TINH GỌN */}
          <div className="lg:col-span-2 bg-white rounded-xl p-4 border border-slate-200 space-y-4">
            {reportViewType === "daily" && currentStudentDailyData ? (
              <div className="space-y-4">
                {/* HEADER HỌC SINH */}
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-[#003399] text-white font-bold text-[10px] uppercase">
                        TÂM CHÍ TÀI (TCT)
                      </span>
                      <span className="font-mono font-bold text-xs text-[#1D4ED8]">
                        SBD: {currentStudentDailyData.sbd}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-semibold text-[10px]">
                        Phiếu 1 Trang A4
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      {currentStudentDailyData.studentName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {currentStudentDailyData.school} • {currentStudentDailyData.grade} • Ngày{" "}
                      <strong className="text-slate-800">{customDateStr}</strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExportClassDailyPDF(true)}
                    className="px-3.5 py-2 rounded-lg bg-[#003399] hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" /> In phiếu bạn này (1 Trang A4)
                  </button>
                </div>

                {/* DROPDOWN CHỌN LƯỢT NỘP NẾU CÓ NHIỀU LẦN KIỂM TRA */}
                {availableTestAttemptsForCurrent.length > 1 && bestCandidateAttempt && (
                  <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#003399]">
                      <History className="w-3.5 h-3.5 text-[#1D4ED8] shrink-0" />
                      <span>
                        Có {availableTestAttemptsForCurrent.length} lượt nộp bài kiểm tra:
                      </span>
                    </div>

                    <select
                      value={selectedAttemptIdOverride || ""}
                      onChange={(e) => {
                        const nextId = e.target.value || null;
                        setSelectedAttemptIdOverride(nextId);
                        const chosenOpt = availableTestAttemptsForCurrent.find(
                          (o) => o.id === (nextId || bestCandidateAttempt.id)
                        );
                        if (chosenOpt && (chosenOpt.quizId || chosenOpt.title)) {
                          fetchQuizDataZeroEgress(chosenOpt.quizId, chosenOpt.title);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white border border-blue-300 text-xs font-bold text-blue-900 outline-none cursor-pointer"
                    >
                      <option value="">
                        Điểm cao nhất: {bestCandidateAttempt.score}đ
                      </option>
                      {availableTestAttemptsForCurrent.map((attOpt, idx) => (
                        <option key={`${attOpt.id}_${idx}`} value={attOpt.id}>
                          Lần nộp lúc {attOpt.createdAtText}: {attOpt.score}đ
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 2 CỘT ĐIỂM CHÍNH: BTVN & KIỂM TRA TẠI LỚP + Ý THỨC BTVN */}
                <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold uppercase text-slate-600 block">
                        1. Điểm Bài tập về nhà (BTVN)
                      </span>
                      <div className="flex items-center gap-1.5">
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
                          placeholder="Chưa nộp"
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
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] border border-slate-200 font-bold text-sm text-[#003399] outline-none focus:border-[#1D4ED8] focus:bg-white"
                        />
                        <span className="text-xs font-bold text-slate-500 shrink-0">/ 10</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold uppercase text-slate-600 block">
                        2. Điểm Kiểm tra tại lớp
                      </span>
                      <div className="flex items-center gap-1.5">
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
                          placeholder="Chưa kiểm tra"
                          onChange={(e) =>
                            setDailyStudentOverrides((prev) => ({
                              ...prev,
                              [currentStudentDailyData.studentId]: {
                                ...(prev[currentStudentDailyData.studentId] || {}),
                                dailyTestScore: e.target.value
                              }
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] border border-slate-200 font-bold text-sm text-[#003399] outline-none focus:border-[#1D4ED8] focus:bg-white"
                        />
                        <span className="text-xs font-bold text-slate-500 shrink-0">/ 10</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70">
                    <span className="text-[11px] font-bold text-slate-600">
                      Ý thức làm BTVN:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { key: "completed", label: "Hoàn thành đầy đủ" },
                        { key: "late", label: "Nộp muộn" },
                        { key: "missing", label: "Chưa nộp BTVN" }
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
                            className={`py-1 px-2.5 rounded-md text-[11px] font-semibold border transition cursor-pointer ${
                              active
                                ? "bg-[#003399] text-white border-[#003399]"
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

                {/* BẢNG LUYỆN ĐỀ (THPT & ĐGNL HSA) TRONG KỲ — CHO PHÉP CHỈNH SỬA / THÊM / XÓA */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase text-slate-800 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-[#003399]" />
                      <span>Luyện đề (THPT &amp; ĐGNL HSA) trong kỳ</span>
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleAddDailyPracticeRow(currentStudentDailyData.studentId, false)
                        }
                        className="px-2.5 py-1 bg-white hover:bg-[#F8FAFC] text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-[#1D4ED8]" /> Thêm đề THPT
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleAddDailyPracticeRow(currentStudentDailyData.studentId, true)
                        }
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] border border-blue-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Thêm đề HSA
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-bold text-[11px]">
                          <th className="py-2 px-3">Tên đề thi</th>
                          <th className="py-2 px-2 w-28 text-center">Phân loại</th>
                          <th className="py-2 px-2 w-24 text-center">Ngày làm</th>
                          <th className="py-2 px-2 w-32 text-center">Điểm / Thang</th>
                          <th className="py-2 px-2 w-10 text-center">Xóa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {!currentStudentDailyData.practiceExamList ||
                        currentStudentDailyData.practiceExamList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-5 text-center text-slate-400 italic text-xs">
                              Học sinh chưa có điểm đề THPT / ĐGNL HSA trong kỳ (bảng này sẽ tự động ẩn trên phiếu in).
                            </td>
                          </tr>
                        ) : (
                          currentStudentDailyData.practiceExamList.map((item) => (
                            <tr key={item.id} className="hover:bg-[#F8FAFC]">
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={item.title}
                                  onChange={(e) =>
                                    handleUpdateStudentPracticeList(
                                      currentStudentDailyData.studentId,
                                      (list) =>
                                        list.map((r) =>
                                          r.id === item.id ? { ...r, title: e.target.value } : r
                                        )
                                    )
                                  }
                                  className="w-full font-semibold text-slate-800 bg-transparent outline-none focus:bg-white rounded px-1.5 py-0.5"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <select
                                  value={item.isHsa ? "hsa" : "thpt"}
                                  onChange={(e) => {
                                    const nextIsHsa = e.target.value === "hsa";
                                    handleUpdateStudentPracticeList(
                                      currentStudentDailyData.studentId,
                                      (list) =>
                                        list.map((r) =>
                                          r.id === item.id
                                            ? {
                                                ...r,
                                                isHsa: nextIsHsa,
                                                maxScore: nextIsHsa ? 50 : 10
                                              }
                                            : r
                                        )
                                    );
                                  }}
                                  className="px-2 py-1 rounded border border-slate-200 bg-[#F8FAFC] text-[11px] font-bold text-[#003399] outline-none cursor-pointer"
                                >
                                  <option value="thpt">THPT</option>
                                  <option value="hsa">ĐGNL HSA</option>
                                </select>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="text"
                                  value={item.completedDate}
                                  onChange={(e) =>
                                    handleUpdateStudentPracticeList(
                                      currentStudentDailyData.studentId,
                                      (list) =>
                                        list.map((r) =>
                                          r.id === item.id
                                            ? { ...r, completedDate: e.target.value }
                                            : r
                                        )
                                    )
                                  }
                                  className="w-20 text-center text-slate-600 bg-transparent outline-none"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={item.score}
                                    onChange={(e) =>
                                      handleUpdateStudentPracticeList(
                                        currentStudentDailyData.studentId,
                                        (list) =>
                                          list.map((r) =>
                                            r.id === item.id ? { ...r, score: e.target.value } : r
                                          )
                                      )
                                    }
                                    className="w-14 text-center font-bold text-xs text-[#003399] bg-blue-50 border border-blue-200 rounded py-0.5 outline-none"
                                  />
                                  <span className="text-slate-400">/</span>
                                  {item.isHsa ? (
                                    <select
                                      value={item.maxScore}
                                      onChange={(e) =>
                                        handleUpdateStudentPracticeList(
                                          currentStudentDailyData.studentId,
                                          (list) =>
                                            list.map((r) =>
                                              r.id === item.id
                                                ? { ...r, maxScore: Number(e.target.value) }
                                                : r
                                            )
                                        )
                                      }
                                      className="px-1 py-0.5 rounded border border-slate-200 text-[11px] font-semibold bg-white outline-none"
                                    >
                                      <option value={50}>50đ</option>
                                      <option value={150}>150đ</option>
                                    </select>
                                  ) : (
                                    <span className="text-xs font-semibold text-slate-600">10</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateStudentPracticeList(
                                      currentStudentDailyData.studentId,
                                      (list) => list.filter((r) => r.id !== item.id)
                                    )
                                  }
                                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
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

                {/* NHẬN XÉT CỦA GIÁO VIÊN */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nhận xét của Giáo viên gửi Phụ huynh:
                  </label>
                  <textarea
                    rows={4}
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
                    className="w-full p-3 rounded-xl bg-[#F8FAFC] border border-slate-200 text-xs font-medium text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white leading-relaxed"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 text-center text-[11px] font-bold text-slate-500">
                  {TCT_BRANDING_FOOTER_TEXT}
                </div>
              </div>
            ) : currentStudent ? (
              /* ================= NHÁNH 2: BÁO CÁO TỔNG KẾT THÁNG ================= */
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#F8FAFC] rounded-xl border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#1D4ED8] block">
                      Báo cáo tổng kết tháng
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
                      className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-[#003399] outline-none cursor-pointer"
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
                  <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Tổng bài nộp
                    </span>
                    <span className="text-lg font-bold text-slate-900 mt-1 block">
                      {currentReport.total} bài
                    </span>
                  </div>
                  <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Đ.TB BTVN
                    </span>
                    <span className="text-lg font-bold text-[#003399] mt-1 block">
                      {autoData.hwAvg} / 10
                    </span>
                  </div>
                  <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Đ.TB Kiểm tra
                    </span>
                    <span className="text-lg font-bold text-[#003399] mt-1 block">
                      {autoData.testAvg} / 10
                    </span>
                  </div>
                  <div className="p-3 bg-[#F8FAFC] rounded-xl border border-slate-200 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Đ.TB Luyện đề
                    </span>
                    <span className="text-lg font-bold text-[#003399] mt-1 block">
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
                        <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-700 font-bold">
                          <th className="py-2.5 px-3 text-left w-48">Hạng mục điểm</th>
                          <th className="py-2.5 px-2">T1.{reportMonth}</th>
                          <th className="py-2.5 px-2">T2.{reportMonth}</th>
                          <th className="py-2.5 px-2">T3.{reportMonth}</th>
                          <th className="py-2.5 px-2">T4.{reportMonth}</th>
                          {hasWeek5Data && <th className="py-2.5 px-2">T5.{reportMonth}</th>}
                          <th className="py-2.5 px-3 text-right">Trung bình</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold bg-white">
                        <tr>
                          <td className="py-2.5 px-3 text-left font-bold text-slate-800">
                            Bài tập về nhà (BTVN)
                          </td>
                          <td className="py-2.5 px-2 text-[#003399] font-bold">
                            {autoData.hwByWeek[1] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-[#003399] font-bold">
                            {autoData.hwByWeek[2] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-[#003399] font-bold">
                            {autoData.hwByWeek[3] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-[#003399] font-bold">
                            {autoData.hwByWeek[4] || "--"}
                          </td>
                          {hasWeek5Data && (
                            <td className="py-2.5 px-2 text-[#003399] font-bold">
                              {autoData.hwByWeek[5] || "--"}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-right font-bold text-[#003399]">
                            {autoData.hwAvg}
                          </td>
                        </tr>
                        <tr>
                          <td className="py-2.5 px-3 text-left font-bold text-slate-800">
                            Kiểm tra định kỳ
                          </td>
                          <td className="py-2.5 px-2 text-[#003399] font-bold">
                            {autoData.testByWeek[1] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-[#003399] font-bold">
                            {autoData.testByWeek[2] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-[#003399] font-bold">
                            {autoData.testByWeek[3] || "--"}
                          </td>
                          <td className="py-2.5 px-2 text-[#003399] font-bold">
                            {autoData.testByWeek[4] || "--"}
                          </td>
                          {hasWeek5Data && (
                            <td className="py-2.5 px-2 text-[#003399] font-bold">
                              {autoData.testByWeek[5] || "--"}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-right font-bold text-[#003399]">
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
                      <Award className="w-4 h-4 text-[#1D4ED8]" /> 2. Bảng điểm Luyện đề Thực chiến
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddManualPracticeExam}
                        className="px-3 py-1.5 bg-white hover:bg-[#F8FAFC] text-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-slate-200 cursor-pointer"
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
                        <tr className="bg-[#F8FAFC] border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase">
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
                            <tr key={item.id} className="hover:bg-[#F8FAFC]">
                              <td className="py-2 px-3 text-center font-bold text-slate-400">
                                {idx + 1}
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={item.title}
                                  onChange={(e) =>
                                    handleUpdatePracticeExamItem(item.id, "title", e.target.value)
                                  }
                                  className="w-full font-bold text-slate-800 bg-transparent rounded px-2 py-1 outline-none"
                                />
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
                                  className="w-full px-2 py-1 rounded text-[10px] font-bold uppercase bg-blue-50 text-[#1D4ED8] border border-blue-200 text-center outline-none"
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
                                  className="px-2 py-1 rounded text-[10px] font-bold border border-slate-200 bg-[#F8FAFC] outline-none cursor-pointer"
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
                                    handleUpdatePracticeExamItem(item.id, "score", e.target.value)
                                  }
                                  className="w-14 text-center font-bold text-xs text-[#003399] bg-blue-50 rounded border border-blue-200 py-0.5 outline-none"
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
                    className="w-full p-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white"
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 text-center text-[11px] font-bold text-slate-500">
                  {TCT_BRANDING_FOOTER_TEXT}
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
                className="w-full p-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs font-semibold outline-none"
              />
            </div>
            <div>
              <label className="block mb-1">Trường học</label>
              <input
                type="text"
                value={manualForm.school}
                onChange={(e) => setManualForm({ ...manualForm, school: e.target.value })}
                className="w-full p-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs font-semibold outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block mb-1">Khối lớp</label>
                <input
                  type="text"
                  value={manualForm.grade}
                  onChange={(e) => setManualForm({ ...manualForm, grade: e.target.value })}
                  className="w-full p-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block mb-1">Tháng báo cáo</label>
                <select
                  value={manualForm.reportMonth}
                  onChange={(e) =>
                    setManualForm({ ...manualForm, reportMonth: Number(e.target.value) })
                  }
                  className="w-full p-2.5 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs font-semibold outline-none"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-3.5 bg-[#F8FAFC] border border-slate-200 rounded-xl space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                Điểm BTVN theo tuần (T1 - T5):
              </span>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((w) => (
                  <div key={w}>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                      Tuần {w}
                    </label>
                    <input
                      type="text"
                      value={manualHWScores[w] || ""}
                      onChange={(e) =>
                        setManualHWScores((prev) => ({ ...prev, [w]: e.target.value }))
                      }
                      placeholder="--"
                      className="w-full px-2 py-1 text-center bg-white border border-slate-200 rounded-md text-xs font-bold text-[#003399] outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3.5 bg-[#F8FAFC] border border-slate-200 rounded-xl space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                Điểm Kiểm tra định kỳ theo tuần (T1 - T5):
              </span>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((w) => (
                  <div key={w}>
                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                      Tuần {w}
                    </label>
                    <input
                      type="text"
                      value={manualTestScores[w] || ""}
                      onChange={(e) =>
                        setManualTestScores((prev) => ({ ...prev, [w]: e.target.value }))
                      }
                      placeholder="--"
                      className="w-full px-2 py-1 text-center bg-white border border-slate-200 rounded-md text-xs font-bold text-[#003399] outline-none"
                    />
                  </div>
                ))}
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
              className="w-full p-3 bg-[#F8FAFC] border border-slate-200 rounded-xl text-xs font-medium outline-none"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 text-center text-[11px] font-bold text-slate-500">
            {TCT_BRANDING_FOOTER_TEXT}
          </div>
        </div>
      )}

      {/* MODAL CHỌN ĐỀ THI ĐƯA VÀO BÁO CÁO THÁNG */}
      {showPracticePickerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white w-full max-w-3xl rounded-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden text-left">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-[#F8FAFC]">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-slate-800 text-sm">
                  Chọn đề Luyện thi thực chiến đưa vào Báo cáo
                </h3>
                <select
                  value={practiceMonthFilter}
                  onChange={(e) => setPracticeMonthFilter(e.target.value)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-[#1D4ED8] outline-none cursor-pointer"
                >
                  <option value="all">Tất cả các tháng</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                    <option key={m} value={String(m)}>
                      Tháng {m < 10 ? "0" + m : m}
                    </option>
                  ))}
                </select>
              </div>
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
                        ? "bg-blue-50 border-[#1D4ED8]"
                        : "bg-white border-slate-200 hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <span className="font-bold text-xs text-slate-800 truncate">{title}</span>
                    </div>
                    <span className="font-bold text-xs text-[#1D4ED8]">{displayScore} / 10</span>
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
          <div className="bg-white w-full max-w-5xl max-h-[96vh] rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
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
                  className="px-3 py-1.5 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Tải Trang 1 (.PNG)
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExportPNG("page2")}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Tải Trang 2 (.PNG)
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExportPNG("single")}
                  className="px-3 py-1.5 bg-[#003399] hover:bg-blue-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
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
                className="w-full max-w-[840px] bg-white p-7 rounded-2xl border border-slate-300 space-y-5"
              >
                <div className="p-4 bg-[#F8FAFC] rounded-xl border border-slate-200 flex items-center justify-between">
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

                <div ref={reportPage2Ref} className="space-y-2">
                  <h4 className="text-sm font-bold uppercase text-[#003399]">
                    Nhận xét của Giáo viên phụ trách:
                  </h4>
                  <div className="p-4 bg-[#F8FAFC] rounded-xl border border-slate-200 space-y-2">
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

                {renderedImageUrls.page1 && (
                  <div className="pt-2 space-y-2">
                    <img
                      src={renderedImageUrls.page1}
                      alt="Preview Trang 1"
                      className="w-full rounded-xl border border-slate-200"
                    />
                  </div>
                )}

                <div className="pt-3 border-t border-slate-200 text-center text-xs font-bold text-slate-600">
                  {TCT_BRANDING_FOOTER_TEXT}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL XEM PHIẾU THI GỐC */}
      {previewPaperItem && (
        <div
          onClick={() => setPreviewPaperItem(null)}
          className="fixed inset-0 z-[200] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[92vh] border border-slate-700 flex flex-col overflow-hidden cursor-default"
          >
            <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white">
              <h4 className="text-sm font-bold text-white">
                {previewPaperItem.title} — Điểm: {previewPaperItem.score}/10
              </h4>
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
                  className="relative rounded-lg overflow-hidden border border-slate-700 bg-white shrink-0"
                >
                  <img
                    src={previewPaperItem.paperScanUrl}
                    alt="Phiếu thi OMR"
                    className="w-full h-full object-fill block"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
