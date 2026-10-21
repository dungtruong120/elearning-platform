import {
  AnswerSheetTemplateConfig,
  OMRBubbleCoordinate,
  OMRCornerPoint,
  OMRGradingSummary,
  OMRQuestionGradeDetail,
  OMRResultData,
  QuestionType,
} from "@/types";

// KÍCH THƯỚC CHUẨN MA TRẬN A4 SAU KHI NẮN PHẲNG (1200 x 1700 PIXELS)
export const OMR_CANONICAL_WIDTH = 1200;
export const OMR_CANONICAL_HEIGHT = 1700;

// TỌA ĐỘ 4 ĐIỂM MỐC ĐỊNH VỊ GÓC TRÊN KHUNG CHUẨN 1200x1700
export const CANONICAL_CORNER_TARGETS = {
  topLeft: { x: 42, y: 42 },
  topRight: { x: 1158, y: 42 },
  bottomRight: { x: 1158, y: 1658 },
  bottomLeft: { x: 42, y: 1658 },
};

// NGƯỠNG NHẬN DIỆN TÔ CHÌ TƯƠNG ĐỐI & TUYỆT ĐỐI (CÂN CHỈNH CHỐNG BÓNG MỜ ĐIỆN THOẠI)
const MIN_FILLED_DENSITY = 0.27;
const STRONG_FILLED_DENSITY = 0.41;
const RELATIVE_DOMINANCE_RATIO = 1.24;
const AMBIGUOUS_DIFF_THRESHOLD = 0.08;

export interface OMRPart1Block {
  pageIndex?: number;
  startQuestion: number;
  endQuestion: number;
  startX: number;
  optionStepX: number;
  startY: number;
  rowStepY: number;
  radius: number;
}

export interface OMRPart2Block {
  pageIndex?: number;
  questionNumber: number;
  trueX: number;
  falseX: number;
  startY: number;
  rowStepY: number;
  radius: number;
}

export interface OMRPart3Block {
  pageIndex?: number;
  questionNumber: number;
  startX: number;
  colStepX: number;
  minusY: number;
  commaY: number;
  digit0Y: number;
  rowStepY: number;
  radius: number;
}

export interface OMRSectionTitleAnchor {
  pageIndex: number;
  part: 1 | 2 | 3;
  titleY: number;
  label: string;
}

export interface OMRTemplateBlueprint {
  templateId?: string;
  totalPages?: number;
  part1TotalQuestions?: number;
  part2TotalQuestions?: number;
  part3TotalQuestions?: number;
  sectionHeaders?: OMRSectionTitleAnchor[];
  sbd: {
    cols: number;
    startX: number;
    colStep: number;
    startY: number;
    rowStep: number;
    radius: number;
  };
  examCode: {
    cols: number;
    startX: number;
    colStep: number;
    startY: number;
    rowStep: number;
    radius: number;
  };
  part1: {
    blocks: OMRPart1Block[];
  };
  part2: {
    blocks: OMRPart2Block[];
  };
  part3: {
    blocks: OMRPart3Block[];
  };
}

export interface DynamicExamSheetConfig {
  examTitle?: string;
  examCode?: string;
  studentSbd?: string;
  studentName?: string;
  className?: string;
  part1Count?: number;
  part2Count?: number;
  part3Count?: number;
}

export const MOET_2025_OMR_BLUEPRINT: OMRTemplateBlueprint = {
  templateId: "moet_standard_2025",
  totalPages: 1,
  part1TotalQuestions: 40,
  part2TotalQuestions: 8,
  part3TotalQuestions: 6,
  sbd: {
    cols: 6,
    startX: 830,
    colStep: 28,
    startY: 225,
    rowStep: 27,
    radius: 9.5,
  },
  examCode: {
    cols: 3,
    startX: 1034,
    colStep: 28,
    startY: 225,
    rowStep: 27,
    radius: 9.5,
  },
  part1: {
    blocks: [
      {
        pageIndex: 1,
        startQuestion: 1,
        endQuestion: 10,
        startX: 138,
        optionStepX: 44,
        startY: 600,
        rowStepY: 30,
        radius: 10,
      },
      {
        pageIndex: 1,
        startQuestion: 11,
        endQuestion: 20,
        startX: 396,
        optionStepX: 44,
        startY: 600,
        rowStepY: 30,
        radius: 10,
      },
      {
        pageIndex: 1,
        startQuestion: 21,
        endQuestion: 30,
        startX: 654,
        optionStepX: 44,
        startY: 600,
        rowStepY: 30,
        radius: 10,
      },
      {
        pageIndex: 1,
        startQuestion: 31,
        endQuestion: 40,
        startX: 912,
        optionStepX: 44,
        startY: 600,
        rowStepY: 30,
        radius: 10,
      },
    ],
  },
  part2: {
    blocks: [
      { pageIndex: 1, questionNumber: 1, trueX: 118, falseX: 160, startY: 1032, rowStepY: 29, radius: 9.5 },
      { pageIndex: 1, questionNumber: 2, trueX: 250, falseX: 292, startY: 1032, rowStepY: 29, radius: 9.5 },
      { pageIndex: 1, questionNumber: 3, trueX: 382, falseX: 424, startY: 1032, rowStepY: 29, radius: 9.5 },
      { pageIndex: 1, questionNumber: 4, trueX: 514, falseX: 556, startY: 1032, rowStepY: 29, radius: 9.5 },
      { pageIndex: 1, questionNumber: 5, trueX: 646, falseX: 688, startY: 1032, rowStepY: 29, radius: 9.5 },
      { pageIndex: 1, questionNumber: 6, trueX: 778, falseX: 820, startY: 1032, rowStepY: 29, radius: 9.5 },
      { pageIndex: 1, questionNumber: 7, trueX: 910, falseX: 952, startY: 1032, rowStepY: 29, radius: 9.5 },
      { pageIndex: 1, questionNumber: 8, trueX: 1042, falseX: 1084, startY: 1032, rowStepY: 29, radius: 9.5 },
    ],
  },
  part3: {
    blocks: [
      { pageIndex: 1, questionNumber: 1, startX: 122, colStepX: 27, minusY: 1268, commaY: 1295, digit0Y: 1322, rowStepY: 27, radius: 9 },
      { pageIndex: 1, questionNumber: 2, startX: 294, colStepX: 27, minusY: 1268, commaY: 1295, digit0Y: 1322, rowStepY: 27, radius: 9 },
      { pageIndex: 1, questionNumber: 3, startX: 466, colStepX: 27, minusY: 1268, commaY: 1295, digit0Y: 1322, rowStepY: 27, radius: 9 },
      { pageIndex: 1, questionNumber: 4, startX: 638, colStepX: 27, minusY: 1268, commaY: 1295, digit0Y: 1322, rowStepY: 27, radius: 9 },
      { pageIndex: 1, questionNumber: 5, startX: 810, colStepX: 27, minusY: 1268, commaY: 1295, digit0Y: 1322, rowStepY: 27, radius: 9 },
      { pageIndex: 1, questionNumber: 6, startX: 982, colStepX: 27, minusY: 1268, commaY: 1295, digit0Y: 1322, rowStepY: 27, radius: 9 },
    ],
  },
};

export function deriveExamCode3Digits(examOrId?: any): string {
  if (!examOrId) return "101";
  if (typeof examOrId === "object" && examOrId.examCode && /^\d{3}$/.test(String(examOrId.examCode))) {
    return String(examOrId.examCode);
  }
  const str = String(
    typeof examOrId === "object" ? examOrId.id || examOrId.title || "101" : examOrId
  );
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) % 900;
  }
  return String(100 + Math.abs(hash)).slice(0, 3);
}

export function formatStudentAutoSBD(studentOrIndex: any, optionalStudentsList?: any[]): string {
  if (typeof studentOrIndex === "number" && studentOrIndex > 0 && studentOrIndex < 100000) {
    return String(Math.floor(studentOrIndex)).padStart(6, "0").slice(-6);
  }

  if (typeof studentOrIndex === "string" && /^\d{1,6}$/.test(studentOrIndex.trim())) {
    const n = parseInt(studentOrIndex.trim(), 10);
    if (n > 0) return String(n).padStart(6, "0").slice(-6);
  }

  if (typeof window !== "undefined") {
    try {
      const targetId = String(
        typeof studentOrIndex === "object" ? studentOrIndex?.id || "" : studentOrIndex || ""
      )
        .trim()
        .toLowerCase();
      const targetUser = String(
        typeof studentOrIndex === "object" ? studentOrIndex?.username || "" : studentOrIndex || ""
      )
        .trim()
        .toLowerCase();
      const targetName = String(
        typeof studentOrIndex === "object" ? studentOrIndex?.full_name || "" : ""
      )
        .trim()
        .toLowerCase();

      const savedDirRaw = localStorage.getItem("edunexus_sbd_directory");
      if (savedDirRaw) {
        const savedDir = JSON.parse(savedDirRaw);
        if (Array.isArray(savedDir) && savedDir.length > 0) {
          const found = savedDir.find(
            (item: any) =>
              (targetId && String(item.id || "").trim().toLowerCase() === targetId) ||
              (targetUser && String(item.username || "").trim().toLowerCase() === targetUser) ||
              (targetName && String(item.full_name || "").trim().toLowerCase() === targetName)
          );
          if (found && found.sbd) return String(found.sbd).padStart(6, "0").slice(-6);
        }
      }

      const pool: { id: string; username: string; full_name: string }[] = [];
      const seen = new Set<string>();

      const pushCandidate = (idVal: any, userVal: any, nameVal: any) => {
        const key = String(idVal || userVal || nameVal || "").trim();
        if (!key || seen.has(key.toLowerCase())) return;
        seen.add(key.toLowerCase());
        pool.push({
          id: String(idVal || key).trim(),
          username: String(userVal || key).trim(),
          full_name: String(nameVal || userVal || key).trim(),
        });
      };

      if (Array.isArray(optionalStudentsList)) {
        optionalStudentsList.forEach((s: any) =>
          pushCandidate(s?.id, s?.username, s?.full_name || s?.name)
        );
      }

      const regRaw = localStorage.getItem("edunexus_registered_students");
      if (regRaw) {
        const regList = JSON.parse(regRaw);
        if (Array.isArray(regList)) {
          regList.forEach((s: any) =>
            pushCandidate(s?.id, s?.username, s?.full_name || s?.name)
          );
        }
      }

      const attRaw = localStorage.getItem("edunexus_attempts");
      if (attRaw) {
        const attList = JSON.parse(attRaw);
        if (Array.isArray(attList)) {
          attList.forEach((a: any) =>
            pushCandidate(
              a?.student_id || a?.studentId || a?.user_id,
              a?.username || a?.user_name,
              a?.student_name || a?.studentName || a?.full_name
            )
          );
        }
      }

      if (typeof studentOrIndex === "object" && studentOrIndex) {
        pushCandidate(
          studentOrIndex.id,
          studentOrIndex.username,
          studentOrIndex.full_name
        );
      }

      if (pool.length > 0) {
        pool.sort((a, b) => a.full_name.localeCompare(b.full_name, "vi"));
        const matchIdx = pool.findIndex(
          (p) =>
            (targetId && p.id.toLowerCase() === targetId) ||
            (targetUser && p.username.toLowerCase() === targetUser) ||
            (targetName && p.full_name.toLowerCase() === targetName)
        );
        if (matchIdx !== -1) {
          return String(matchIdx + 1).padStart(6, "0").slice(-6);
        }
      }
    } catch {}
  }

  if (typeof studentOrIndex === "object" && studentOrIndex?.student_code) {
    const codeStr = String(studentOrIndex.student_code).trim();
    if (/^\d{1,6}$/.test(codeStr)) {
      return codeStr.padStart(6, "0").slice(-6);
    }
  }

  return "000001";
}

export function resolveCompleteExamObject(examOrConfig: any): any {
  if (!examOrConfig || typeof examOrConfig !== "object") return examOrConfig;

  const hasDirectQuestions =
    (Array.isArray(examOrConfig.data) && examOrConfig.data.length > 0) ||
    (Array.isArray(examOrConfig.sections) && examOrConfig.sections.length > 0) ||
    (Array.isArray(examOrConfig.questions) && examOrConfig.questions.length > 0);

  if (hasDirectQuestions) return examOrConfig;

  if (typeof window !== "undefined") {
    const targetId = String(
      examOrConfig.quiz_id || examOrConfig.exam_id || examOrConfig.id || ""
    )
      .trim()
      .toLowerCase();
    const targetTitle = String(examOrConfig.examTitle || examOrConfig.title || "")
      .trim()
      .toLowerCase();

    const storageKeys = [
      "edunexus_quizzes",
      "edunexus_practice_exams",
      "edunexus_course_data",
    ];

    for (const key of storageKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) continue;

        if (key === "edunexus_course_data") {
          for (const chap of parsed) {
            for (const les of chap?.lessons || []) {
              const allItems = [
                ...(les?.homework_files || []),
                ...(les?.test_quizzes || []),
              ];
              const foundInCourse = allItems.find((it: any) => {
                const itId = String(it?.id || it?.quiz_id || "").trim().toLowerCase();
                const itTitle = String(it?.title || "").trim().toLowerCase();
                return (
                  (targetId && itId === targetId) ||
                  (targetTitle && itTitle === targetTitle)
                );
              });
              if (
                foundInCourse &&
                ((Array.isArray(foundInCourse.data) && foundInCourse.data.length > 0) ||
                  (Array.isArray(foundInCourse.questions) && foundInCourse.questions.length > 0))
              ) {
                return { ...examOrConfig, ...foundInCourse };
              }
            }
          }
        } else {
          const found = parsed.find((q: any) => {
            const qId = String(q?.id || q?.quiz_id || "").trim().toLowerCase();
            const qTitle = String(q?.title || "").trim().toLowerCase();
            return (
              (targetId && qId === targetId) ||
              (targetTitle && qTitle === targetTitle)
            );
          });
          if (found) {
            return {
              ...examOrConfig,
              ...found,
              data: found.data || found.sections || examOrConfig.data,
              questions: found.questions || examOrConfig.questions,
            };
          }
        }
      } catch {}
    }
  }

  return examOrConfig;
}

export function extractExamQuestionCounts(examDataOrQuestions: any): {
  part1Count: number;
  part2Count: number;
  part3Count: number;
  totalCount: number;
} {
  const resolvedExam = resolveCompleteExamObject(examDataOrQuestions);
  if (!resolvedExam) {
    return { part1Count: 40, part2Count: 8, part3Count: 6, totalCount: 54 };
  }

  if (
    typeof resolvedExam.part1Count === "number" &&
    typeof resolvedExam.part2Count === "number" &&
    typeof resolvedExam.part3Count === "number" &&
    !Array.isArray(resolvedExam.data) &&
    !Array.isArray(resolvedExam.sections) &&
    !Array.isArray(resolvedExam.questions)
  ) {
    const total =
      resolvedExam.part1Count + resolvedExam.part2Count + resolvedExam.part3Count;
    if (total > 0) {
      return {
        part1Count: resolvedExam.part1Count,
        part2Count: resolvedExam.part2Count,
        part3Count: resolvedExam.part3Count,
        totalCount: total,
      };
    }
  }

  const rawSections =
    resolvedExam?.data ||
    resolvedExam?.sections ||
    (Array.isArray(resolvedExam) ? resolvedExam : []);

  let p1 = 0;
  let p2 = 0;
  let p3 = 0;

  const classifySingleQ = (q: any, fallbackType?: string) => {
    const rawCorrect = String(
      q?.correct_answer ?? q?.correctAnswer ?? q?.answer ?? "A"
    ).trim();
    const cleanAns = rawCorrect.replace(/[^A-Za-zĐđSsTtFf]/g, "").toUpperCase();

    const isTF =
      q?.type === "true_false" ||
      fallbackType === "true_false" ||
      (["Đ", "S", "T", "F"].includes(cleanAns[0]) && cleanAns.length >= 2) ||
      (Array.isArray(q?.options) &&
        q.options.length > 0 &&
        typeof q.options[0]?.is_true_false_ans === "boolean");

    const isShort =
      !isTF &&
      (q?.type === "short_answer" ||
        fallbackType === "short_answer" ||
        !Array.isArray(q?.options) ||
        q.options.length === 0);

    if (isTF) p2++;
    else if (isShort) p3++;
    else p1++;
  };

  if (Array.isArray(rawSections) && rawSections.length > 0 && rawSections[0]?.questions) {
    rawSections.forEach((sec: any) => {
      const secType =
        sec?.section_type ||
        sec?.type ||
        (sec?.section_title && /đúng\s*sai/i.test(sec.section_title)
          ? "true_false"
          : sec?.section_title && /trả\s*lời\s*ngắn|điền/i.test(sec.section_title)
          ? "short_answer"
          : "multiple_choice");
      (sec?.questions || []).forEach((q: any) => classifySingleQ(q, secType));
    });
  } else if (Array.isArray(resolvedExam?.questions)) {
    resolvedExam.questions.forEach((q: any) => classifySingleQ(q));
  } else if (Array.isArray(rawSections) && rawSections.length > 0) {
    rawSections.forEach((q: any) => classifySingleQ(q));
  }

  const total = p1 + p2 + p3;
  if (total === 0) {
    return { part1Count: 40, part2Count: 8, part3Count: 6, totalCount: 54 };
  }

  return {
    part1Count: p1,
    part2Count: p2,
    part3Count: p3,
    totalCount: total,
  };
}

/**
 * THUẬT TOÁN AUTO-PAGINATION FLOW ENGINE (TRIỆT TIÊU 100% LỖI CHỒNG ĐÈ KHỐI TRANG 2)
 */
export function buildDynamicOMRBlueprint(examOrConfig?: any): OMRTemplateBlueprint {
  const resolved = resolveCompleteExamObject(examOrConfig);
  const counts = extractExamQuestionCounts(resolved);

  const p1Limit = Math.max(0, counts.part1Count);
  const p2Limit = Math.max(0, counts.part2Count);
  const p3Limit = Math.max(0, counts.part3Count);

  const colStartXs = [138, 396, 654, 912];
  const p2ColTrueXs = [118, 250, 382, 514, 646, 778, 910, 1042];
  const p3ColStartXs = [122, 294, 466, 638, 810, 982];

  // Trường hợp 1: Đề tiêu chuẩn vừa khít trong 1 mặt A4 (<= 40 câu P1, <= 8 câu P2, <= 6 câu P3)
  if (p1Limit <= 40 && p2Limit <= 8 && p3Limit <= 6) {
    const dynamicPart1Blocks: OMRPart1Block[] = [];
    if (p1Limit > 0) {
      const numCols = Math.ceil(p1Limit / 10);
      for (let c = 0; c < numCols; c++) {
        const startQ = c * 10 + 1;
        const endQ = Math.min(p1Limit, (c + 1) * 10);
        dynamicPart1Blocks.push({
          pageIndex: 1,
          startQuestion: startQ,
          endQuestion: endQ,
          startX: colStartXs[c],
          optionStepX: 44,
          startY: 600,
          rowStepY: 30,
          radius: 10,
        });
      }
    }

    const dynamicPart2Blocks: OMRPart2Block[] = [];
    for (let q = 1; q <= p2Limit; q++) {
      dynamicPart2Blocks.push({
        pageIndex: 1,
        questionNumber: q,
        trueX: p2ColTrueXs[q - 1],
        falseX: p2ColTrueXs[q - 1] + 42,
        startY: 1032,
        rowStepY: 29,
        radius: 9.5,
      });
    }

    const dynamicPart3Blocks: OMRPart3Block[] = [];
    for (let q = 1; q <= p3Limit; q++) {
      dynamicPart3Blocks.push({
        pageIndex: 1,
        questionNumber: q,
        startX: p3ColStartXs[q - 1],
        colStepX: 27,
        minusY: 1268,
        commaY: 1295,
        digit0Y: 1322,
        rowStepY: 27,
        radius: 9,
      });
    }

    return {
      ...MOET_2025_OMR_BLUEPRINT,
      templateId: `single_${p1Limit}_${p2Limit}_${p3Limit}`,
      totalPages: 1,
      part1TotalQuestions: p1Limit,
      part2TotalQuestions: p2Limit,
      part3TotalQuestions: p3Limit,
      part1: { blocks: dynamicPart1Blocks },
      part2: { blocks: dynamicPart2Blocks },
      part3: { blocks: dynamicPart3Blocks },
    };
  }

  // Trường hợp 2: Đề dài nhiều câu -> Bẻ trang Flow Layout tự động
  const MAX_SAFE_Y = 1585;
  const NEW_PAGE_START_Y = 185;

  let currentPage = 1;
  let cursorY = 535;

  const dynamicPart1Blocks: OMRPart1Block[] = [];
  const dynamicPart2Blocks: OMRPart2Block[] = [];
  const dynamicPart3Blocks: OMRPart3Block[] = [];

  // 1. Dàn trang Phần I theo từng tầng (Mỗi tầng gồm tối đa 4 cột = 40 câu)
  if (p1Limit > 0) {
    const totalBlocks10 = Math.ceil(p1Limit / 10);
    const totalTiers40 = Math.ceil(totalBlocks10 / 4);

    for (let t = 0; t < totalTiers40; t++) {
      const firstBlockIdx = t * 4;
      const lastBlockIdx = Math.min(totalBlocks10 - 1, firstBlockIdx + 3);
      let maxRowsInTier = 1;
      for (let b = firstBlockIdx; b <= lastBlockIdx; b++) {
        const sQ = b * 10 + 1;
        const eQ = Math.min(p1Limit, (b + 1) * 10);
        maxRowsInTier = Math.max(maxRowsInTier, eQ - sQ + 1);
      }

      const tierTitleGap = 36;
      const boxHeight = Math.max(70, maxRowsInTier * 30 + 38);
      const neededHeight = tierTitleGap + boxHeight + 24;

      if (cursorY + neededHeight > MAX_SAFE_Y) {
        currentPage++;
        cursorY = NEW_PAGE_START_Y;
      }

      const startYForCircles = cursorY + tierTitleGap + 46;

      for (let b = firstBlockIdx; b <= lastBlockIdx; b++) {
        const colIdx = b - firstBlockIdx;
        const startQ = b * 10 + 1;
        const endQ = Math.min(p1Limit, (b + 1) * 10);
        dynamicPart1Blocks.push({
          pageIndex: currentPage,
          startQuestion: startQ,
          endQuestion: endQ,
          startX: colStartXs[colIdx],
          optionStepX: 44,
          startY: startYForCircles,
          rowStepY: 30,
          radius: 10,
        });
      }

      cursorY = startYForCircles - 46 + boxHeight + 34;
    }
  }

  // 2. Dàn trang Phần II theo từng hàng (Mỗi hàng tối đa 8 câu Đúng/Sai)
  if (p2Limit > 0) {
    const totalP2Rows = Math.ceil(p2Limit / 8);
    for (let r = 0; r < totalP2Rows; r++) {
      const isFirstRowOfP2 = r === 0;
      const headerSpace = isFirstRowOfP2 ? 38 : 14;
      const boxH = 174;
      const neededHeight = headerSpace + boxH + 20;

      if (cursorY + neededHeight > MAX_SAFE_Y) {
        currentPage++;
        cursorY = NEW_PAGE_START_Y;
      }

      const startYForCircles = cursorY + headerSpace + 52;
      const qStart = r * 8 + 1;
      const qEnd = Math.min(p2Limit, (r + 1) * 8);

      for (let q = qStart; q <= qEnd; q++) {
        const col8 = (q - 1) % 8;
        dynamicPart2Blocks.push({
          pageIndex: currentPage,
          questionNumber: q,
          trueX: p2ColTrueXs[col8],
          falseX: p2ColTrueXs[col8] + 42,
          startY: startYForCircles,
          rowStepY: 29,
          radius: 9.5,
        });
      }

      cursorY = startYForCircles - 52 + boxH + 28;
    }
  }

  // 3. Dàn trang Phần III theo từng hàng (Mỗi hàng tối đa 6 câu Trả lời ngắn)
  if (p3Limit > 0) {
    const totalP3Rows = Math.ceil(p3Limit / 6);
    for (let r = 0; r < totalP3Rows; r++) {
      const isFirstRowOfP3 = r === 0;
      const headerSpace = isFirstRowOfP3 ? 38 : 16;
      const boxH = 388;
      const neededHeight = headerSpace + boxH + 20;

      if (cursorY + neededHeight > MAX_SAFE_Y) {
        currentPage++;
        cursorY = NEW_PAGE_START_Y;
      }

      const boxTop = cursorY + headerSpace;
      const minusY = boxTop + 54;
      const commaY = minusY + 27;
      const digit0Y = commaY + 27;

      const qStart = r * 6 + 1;
      const qEnd = Math.min(p3Limit, (r + 1) * 6);

      for (let q = qStart; q <= qEnd; q++) {
        const col6 = (q - 1) % 6;
        dynamicPart3Blocks.push({
          pageIndex: currentPage,
          questionNumber: q,
          startX: p3ColStartXs[col6],
          colStepX: 27,
          minusY,
          commaY,
          digit0Y,
          rowStepY: 27,
          radius: 9,
        });
      }

      cursorY = boxTop + boxH + 28;
    }
  }

  return {
    ...MOET_2025_OMR_BLUEPRINT,
    templateId: `flow_${p1Limit}_${p2Limit}_${p3Limit}`,
    totalPages: currentPage,
    part1TotalQuestions: p1Limit,
    part2TotalQuestions: p2Limit,
    part3TotalQuestions: p3Limit,
    part1: { blocks: dynamicPart1Blocks },
    part2: { blocks: dynamicPart2Blocks },
    part3: { blocks: dynamicPart3Blocks },
  };
}

/**
 * CHUYỂN ĐỔI ẢNH SANG GRAYSCALE VÀ NHỊ PHÂN HÓA THÍCH NGHI (INTEGRAL IMAGE THRESHOLDING)
 */
export function computeAdaptiveBinaryMask(imageData: ImageData): {
  gray: Uint8Array;
  binary: Uint8Array;
  width: number;
  height: number;
} {
  const { width, height, data } = imageData;
  const totalPixels = width * height;
  const gray = new Uint8Array(totalPixels);
  const binary = new Uint8Array(totalPixels);
  const integral = new Float64Array((width + 1) * (height + 1));

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[p] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }

  const stride = width + 1;
  for (let y = 1; y <= height; y++) {
    let rowSum = 0;
    const srcRowOffset = (y - 1) * width;
    const dstRowOffset = y * stride;
    const prevRowOffset = (y - 1) * stride;
    for (let x = 1; x <= width; x++) {
      rowSum += gray[srcRowOffset + (x - 1)];
      integral[dstRowOffset + x] = integral[prevRowOffset + x] + rowSum;
    }
  }

  const halfWin = Math.max(12, Math.round(Math.min(width, height) * 0.016));
  const sensitivity = 0.85;

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - halfWin);
    const y2 = Math.min(height - 1, y + halfWin);
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - halfWin);
      const x2 = Math.min(width - 1, x + halfWin);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * stride + (x2 + 1)] -
        integral[y1 * stride + (x2 + 1)] -
        integral[(y2 + 1) * stride + x1] +
        integral[y1 * stride + x1];

      const localMean = sum / count;
      const idx = y * width + x;
      binary[idx] = gray[idx] < localMean * sensitivity && gray[idx] < 195 ? 1 : 0;
    }
  }

  return { gray, binary, width, height };
}

/**
 * TÌM BIÊN TỜ GIẤY TRẮNG (PAPER REGION BOUNDING BOX)
 */
function detectWhitePaperBoundingBox(
  gray: Uint8Array,
  width: number,
  height: number
): { left: number; right: number; top: number; bottom: number } {
  const rowBrightRatio = new Float32Array(height);
  const colBrightRatio = new Float32Array(width);

  for (let y = 0; y < height; y++) {
    let brightCount = 0;
    const rowOffset = y * width;
    for (let x = 0; x < width; x += 2) {
      if (gray[rowOffset + x] >= 145) brightCount++;
    }
    rowBrightRatio[y] = brightCount / Math.ceil(width / 2);
  }

  for (let x = 0; x < width; x++) {
    let brightCount = 0;
    for (let y = 0; y < height; y += 2) {
      if (gray[y * width + x] >= 145) brightCount++;
    }
    colBrightRatio[x] = brightCount / Math.ceil(height / 2);
  }

  let top = 0;
  while (top < height * 0.35 && rowBrightRatio[top] < 0.42) top++;

  let bottom = height - 1;
  while (bottom > height * 0.65 && rowBrightRatio[bottom] < 0.42) bottom--;

  let left = 0;
  while (left < width * 0.35 && colBrightRatio[left] < 0.42) left++;

  let right = width - 1;
  while (right > width * 0.65 && colBrightRatio[right] < 0.42) right--;

  return {
    left: Math.max(0, left - 8),
    right: Math.min(width - 1, right + 8),
    top: Math.max(0, top - 8),
    bottom: Math.min(height - 1, bottom + 8),
  };
}

/**
 * THUẬT TOÁN TÌM 4 MỐC ĐEN ĐỊNH VỊ GÓC KHẮT KHE (CHỐNG BẮT NHẦM BÀN TAY & BÓNG BÀN 100%)
 */
export function detectOMRCornerMarkers(
  binary: Uint8Array,
  width: number,
  height: number,
  optionalGray?: Uint8Array
): {
  topLeft: OMRCornerPoint;
  topRight: OMRCornerPoint;
  bottomRight: OMRCornerPoint;
  bottomLeft: OMRCornerPoint;
  detected: boolean;
  geometryWarning?: string;
} {
  const paperBox = optionalGray
    ? detectWhitePaperBoundingBox(optionalGray, width, height)
    : { left: 0, right: width - 1, top: 0, bottom: height - 1 };

  const paperW = Math.max(100, paperBox.right - paperBox.left);
  const paperH = Math.max(100, paperBox.bottom - paperBox.top);

  const findIsolatedSquareMarker = (
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    targetCornerX: number,
    targetCornerY: number
  ): OMRCornerPoint | null => {
    const patchSize = Math.max(10, Math.round(Math.min(paperW, paperH) * 0.02));
    const step = Math.max(2, Math.floor(patchSize / 4));
    const ringRadius = Math.max(patchSize + 4, Math.round(patchSize * 1.55));

    let bestCandidate: { x: number; y: number; score: number } | null = null;

    for (let y = minY; y <= maxY - patchSize; y += step) {
      for (let x = minX; x <= maxX - patchSize; x += step) {
        let innerDark = 0;
        let innerTotal = 0;
        for (let py = 0; py < patchSize; py += 2) {
          const rowOffset = (y + py) * width + x;
          for (let px = 0; px < patchSize; px += 2) {
            innerTotal++;
            if (binary[rowOffset + px] === 1) innerDark++;
          }
        }
        const innerDensity = innerDark / Math.max(1, innerTotal);
        if (innerDensity < 0.6) continue;

        const centerX = Math.round(x + patchSize / 2);
        const centerY = Math.round(y + patchSize / 2);

        let ringWhiteCount = 0;
        let ringSamples = 0;
        const ringDirs = [
          [-ringRadius, 0],
          [ringRadius, 0],
          [0, -ringRadius],
          [0, ringRadius],
          [-ringRadius, -ringRadius],
          [ringRadius, -ringRadius],
          [-ringRadius, ringRadius],
          [ringRadius, ringRadius],
        ];

        for (const [dx, dy] of ringDirs) {
          const rx = centerX + dx;
          const ry = centerY + dy;
          if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
            ringSamples++;
            const isWhiteBinary = binary[ry * width + rx] === 0;
            const isBrightGray = optionalGray ? optionalGray[ry * width + rx] >= 135 : true;
            if (isWhiteBinary && isBrightGray) {
              ringWhiteCount++;
            }
          }
        }

        const quietZoneRatio = ringWhiteCount / Math.max(1, ringSamples);
        if (quietZoneRatio < 0.62) continue;

        const doubleR = Math.round(patchSize * 1.9);
        let farDarkCount = 0;
        let farTotal = 0;
        for (const [dx, dy] of ringDirs) {
          const fx = centerX + Math.round((dx / ringRadius) * doubleR);
          const fy = centerY + Math.round((dy / ringRadius) * doubleR);
          if (fx >= 0 && fx < width && fy >= 0 && fy < height) {
            farTotal++;
            if (binary[fy * width + fx] === 1) farDarkCount++;
          }
        }
        if (farTotal > 0 && farDarkCount / farTotal > 0.45) continue;

        const distToCorner = Math.hypot(centerX - targetCornerX, centerY - targetCornerY);
        const maxDist = Math.hypot(paperW, paperH);
        const proximityScore = 1 - distToCorner / maxDist;

        const totalScore =
          innerDensity * 0.35 + quietZoneRatio * 0.35 + proximityScore * 0.3;

        if (!bestCandidate || totalScore > bestCandidate.score) {
          bestCandidate = { x: centerX, y: centerY, score: totalScore };
        }
      }
    }

    return bestCandidate ? { x: bestCandidate.x, y: bestCandidate.y } : null;
  };

  const searchW = Math.floor(paperW * 0.24);
  const searchH = Math.floor(paperH * 0.22);

  const tl = findIsolatedSquareMarker(
    paperBox.left + 2,
    paperBox.left + searchW,
    paperBox.top + 2,
    paperBox.top + searchH,
    paperBox.left,
    paperBox.top
  );

  const tr = findIsolatedSquareMarker(
    paperBox.right - searchW,
    paperBox.right - 2,
    paperBox.top + 2,
    paperBox.top + searchH,
    paperBox.right,
    paperBox.top
  );

  const br = findIsolatedSquareMarker(
    paperBox.right - searchW,
    paperBox.right - 2,
    paperBox.bottom - searchH,
    paperBox.bottom - 2,
    paperBox.right,
    paperBox.bottom
  );

  const bl = findIsolatedSquareMarker(
    paperBox.left + 2,
    paperBox.left + searchW,
    paperBox.bottom - searchH,
    paperBox.bottom - 2,
    paperBox.left,
    paperBox.bottom
  );

  if (tl && tr && br && bl) {
    const topEdge = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const bottomEdge = Math.hypot(br.x - bl.x, br.y - bl.y);
    const leftEdge = Math.hypot(bl.x - tl.x, bl.y - tl.y);
    const rightEdge = Math.hypot(br.x - tr.x, br.y - tr.y);

    const widthRatio = Math.min(topEdge, bottomEdge) / Math.max(1, Math.max(topEdge, bottomEdge));
    const heightRatio = Math.min(leftEdge, rightEdge) / Math.max(1, Math.max(leftEdge, rightEdge));

    if (widthRatio >= 0.72 && heightRatio >= 0.72 && topEdge > width * 0.45 && leftEdge > height * 0.45) {
      return {
        topLeft: tl,
        topRight: tr,
        bottomRight: br,
        bottomLeft: bl,
        detected: true,
      };
    }
  }

  if (tl && tr && (bl || br)) {
    const dxTop = tr.x - tl.x;
    const dyTop = tr.y - tl.y;
    const topLen = Math.hypot(dxTop, dyTop);
    const expectedHeight = topLen * ((1658 - 42) / (1158 - 42));
    const nx = -dyTop / Math.max(1, topLen);
    const ny = dxTop / Math.max(1, topLen);

    const inferredBL = bl || {
      x: Math.round(tl.x + nx * expectedHeight),
      y: Math.round(tl.y + ny * expectedHeight),
    };
    const inferredBR = br || {
      x: Math.round(tr.x + nx * expectedHeight),
      y: Math.round(tr.y + ny * expectedHeight),
    };

    return {
      topLeft: tl,
      topRight: tr,
      bottomRight: inferredBR,
      bottomLeft: inferredBL,
      detected: true,
      geometryWarning:
        "Hệ thống phát hiện 1 góc dưới bị che khuất (do ngón tay hoặc bóng mờ) và đã tự động nội suy vuông góc từ 3 mốc còn lại.",
    };
  }

  return {
    topLeft: { x: paperBox.left + paperW * 0.035, y: paperBox.top + paperH * 0.025 },
    topRight: { x: paperBox.right - paperW * 0.035, y: paperBox.top + paperH * 0.025 },
    bottomRight: { x: paperBox.right - paperW * 0.035, y: paperBox.bottom - paperH * 0.025 },
    bottomLeft: { x: paperBox.left + paperW * 0.035, y: paperBox.bottom - paperH * 0.025 },
    detected: false,
    geometryWarning:
      "Chưa bắt đủ 4 ô vuông đen ở 4 góc phiếu (có thể do tay che góc phiếu). Vui lòng không đặt ngón tay đè lên 4 góc đen!",
  };
}

/**
 * NẮN PHẲNG ẢNH BẰNG PHÉP NỘI SUY PHỐI CẢNH 4 ĐIỂM (FOUR-POINT BILINEAR WARP)
 */
export function warpPerspectiveToCanonical(
  sourceImageData: ImageData,
  corners: {
    topLeft: OMRCornerPoint;
    topRight: OMRCornerPoint;
    bottomRight: OMRCornerPoint;
    bottomLeft: OMRCornerPoint;
  },
  dstWidth: number = OMR_CANONICAL_WIDTH,
  dstHeight: number = OMR_CANONICAL_HEIGHT
): ImageData {
  const srcW = sourceImageData.width;
  const srcH = sourceImageData.height;
  const srcPixels = sourceImageData.data;

  const dstImageData = new ImageData(dstWidth, dstHeight);
  const dstPixels = dstImageData.data;

  const padX = CANONICAL_CORNER_TARGETS.topLeft.x;
  const padY = CANONICAL_CORNER_TARGETS.topLeft.y;
  const innerW = CANONICAL_CORNER_TARGETS.topRight.x - padX;
  const innerH = CANONICAL_CORNER_TARGETS.bottomLeft.y - padY;

  const { topLeft, topRight, bottomRight, bottomLeft } = corners;

  for (let y = 0; y < dstHeight; y++) {
    const v = (y - padY) / innerH;
    for (let x = 0; x < dstWidth; x++) {
      const u = (x - padX) / innerW;

      const srcX =
        (1 - u) * (1 - v) * topLeft.x +
        u * (1 - v) * topRight.x +
        u * v * bottomRight.x +
        (1 - u) * v * bottomLeft.x;

      const srcY =
        (1 - u) * (1 - v) * topLeft.y +
        u * (1 - v) * topRight.y +
        u * v * bottomRight.y +
        (1 - u) * v * bottomLeft.y;

      const dstIdx = (y * dstWidth + x) * 4;

      if (srcX >= 0 && srcX < srcW - 1 && srcY >= 0 && srcY < srcH - 1) {
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const dx = srcX - x0;
        const dy = srcY - y0;

        const idx00 = (y0 * srcW + x0) * 4;
        const idx10 = idx00 + 4;
        const idx01 = ((y0 + 1) * srcW + x0) * 4;
        const idx11 = idx01 + 4;

        for (let c = 0; c < 3; c++) {
          const val =
            srcPixels[idx00 + c] * (1 - dx) * (1 - dy) +
            srcPixels[idx10 + c] * dx * (1 - dy) +
            srcPixels[idx01 + c] * (1 - dx) * dy +
            srcPixels[idx11 + c] * dx * dy;
          dstPixels[dstIdx + c] = Math.round(val);
        }
        dstPixels[dstIdx + 3] = 255;
      } else {
        dstPixels[dstIdx] = 255;
        dstPixels[dstIdx + 1] = 255;
        dstPixels[dstIdx + 2] = 255;
        dstPixels[dstIdx + 3] = 255;
      }
    }
  }

  return dstImageData;
}

/**
 * ĐO MẬT ĐỘ ĐIỂM TỐI TRONG Ô TRÒN KÈM DÒ TÂM CỤC BỘ (SUB-GRID LOCAL PEAK ALIGNMENT)
 */
export function measureBubbleDensity(
  binary: Uint8Array,
  gray: Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number
): number {
  const sampleAtPoint = (cx: number, cy: number): number => {
    const rInner = Math.max(3, radius * 0.76);
    const rSq = rInner * rInner;
    const minX = Math.max(0, Math.floor(cx - rInner));
    const maxX = Math.min(width - 1, Math.ceil(cx + rInner));
    const minY = Math.max(0, Math.floor(cy - rInner));
    const maxY = Math.min(height - 1, Math.ceil(cy + rInner));

    let totalSamples = 0;
    let weightedDarkSum = 0;

    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy;
      const rowOffset = y * width;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        if (dx * dx + dy * dy <= rSq) {
          totalSamples++;
          const idx = rowOffset + x;
          const isBinaryDark = binary[idx] === 1 ? 1 : 0;
          const grayDarkness = Math.max(0, (215 - gray[idx]) / 215);
          weightedDarkSum += isBinaryDark * 0.65 + grayDarkness * 0.35;
        }
      }
    }

    if (totalSamples === 0) return 0;
    return weightedDarkSum / totalSamples;
  };

  let maxDensity = sampleAtPoint(centerX, centerY);
  if (maxDensity >= 0.2) {
    const offsets = [-3, 0, 3];
    for (const ox of offsets) {
      for (const oy of offsets) {
        if (ox === 0 && oy === 0) continue;
        const d = sampleAtPoint(centerX + ox, centerY + oy);
        if (d > maxDensity) maxDensity = d;
      }
    }
  }

  return Number(Math.min(1, maxDensity).toFixed(3));
}

function pickDominantBubble<T extends { key: string; density: number }>(
  candidates: T[],
  minThreshold: number = MIN_FILLED_DENSITY
): {
  selected: T | null;
  isAmbiguous: boolean;
} {
  if (!candidates || candidates.length === 0) {
    return { selected: null, isAmbiguous: false };
  }

  const sorted = [...candidates].sort((a, b) => b.density - a.density);
  const top = sorted[0];
  const second = sorted[1];

  if (top.density < minThreshold) {
    return { selected: null, isAmbiguous: false };
  }

  if (!second) {
    return { selected: top, isAmbiguous: false };
  }

  const ratio = second.density > 0.05 ? top.density / second.density : 99;
  const diff = top.density - second.density;

  if (
    second.density >= STRONG_FILLED_DENSITY &&
    diff < AMBIGUOUS_DIFF_THRESHOLD &&
    ratio < RELATIVE_DOMINANCE_RATIO
  ) {
    return { selected: top, isAmbiguous: true };
  }

  if (top.density >= STRONG_FILLED_DENSITY || ratio >= RELATIVE_DOMINANCE_RATIO) {
    return { selected: top, isAmbiguous: false };
  }

  return { selected: null, isAmbiguous: false };
}

/**
 * QUÉT TOÀN BỘ PHIẾU TRẢ LỜI TRẮC NGHIỆM TỪ CANVAS HOẶC IMAGEDATA (HỖ TRỢ BLUEPRINT ĐỘNG & ĐA TRANG)
 */
export function scanOMRSheetFromCanvas(
  sourceCanvasOrImageData: HTMLCanvasElement | ImageData,
  blueprintOrExam?: OMRTemplateBlueprint | any,
  targetPageIndex: number = 1
): OMRResultData {
  const blueprint: OMRTemplateBlueprint =
    blueprintOrExam && blueprintOrExam.sbd && blueprintOrExam.part1
      ? blueprintOrExam
      : buildDynamicOMRBlueprint(blueprintOrExam);

  let rawImageData: ImageData;

  if (sourceCanvasOrImageData instanceof ImageData) {
    rawImageData = sourceCanvasOrImageData;
  } else {
    const ctx = sourceCanvasOrImageData.getContext("2d");
    if (!ctx) {
      throw new Error("Không thể khởi tạo Canvas 2D Context để quét phiếu OMR.");
    }
    rawImageData = ctx.getImageData(
      0,
      0,
      sourceCanvasOrImageData.width,
      sourceCanvasOrImageData.height
    );
  }

  const initialMask = computeAdaptiveBinaryMask(rawImageData);
  const cornerResult = detectOMRCornerMarkers(
    initialMask.binary,
    initialMask.width,
    initialMask.height,
    initialMask.gray
  );

  const warpedImageData = warpPerspectiveToCanonical(
    rawImageData,
    cornerResult,
    OMR_CANONICAL_WIDTH,
    OMR_CANONICAL_HEIGHT
  );

  let warpedDataUrl: string | undefined = undefined;
  if (typeof document !== "undefined") {
    try {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = OMR_CANONICAL_WIDTH;
      tempCanvas.height = OMR_CANONICAL_HEIGHT;
      const tempCtx = tempCanvas.getContext("2d");
      if (tempCtx) {
        tempCtx.putImageData(warpedImageData, 0, 0);
        warpedDataUrl = tempCanvas.toDataURL("image/jpeg", 0.88);
      }
    } catch {}
  }

  const canonicalMask = computeAdaptiveBinaryMask(warpedImageData);
  const { binary, gray, width, height } = canonicalMask;

  const bubbleCoordinates: OMRBubbleCoordinate[] = [];
  const flaggedQuestionsSet = new Set<number>();
  let confidenceSum = 0;
  let confidenceCount = 0;

  // 1. Quét Số báo danh (6 cột - ở Trang 1)
  const sbdDigits: string[] = [];
  if (targetPageIndex === 1) {
    for (let col = 0; col < blueprint.sbd.cols; col++) {
      const cx = blueprint.sbd.startX + col * blueprint.sbd.colStep;
      const colCandidates: { key: string; density: number; y: number }[] = [];

      for (let digit = 0; digit <= 9; digit++) {
        const cy = blueprint.sbd.startY + digit * blueprint.sbd.rowStep;
        const density = measureBubbleDensity(
          binary,
          gray,
          width,
          height,
          cx,
          cy,
          blueprint.sbd.radius
        );
        colCandidates.push({ key: String(digit), density, y: cy });
      }

      const { selected } = pickDominantBubble(colCandidates, MIN_FILLED_DENSITY);
      sbdDigits.push(selected ? selected.key : "");

      colCandidates.forEach((cand) => {
        const isSel = selected?.key === cand.key;
        bubbleCoordinates.push({
          id: `sbd-col${col}-${cand.key}`,
          pageIndex: 1,
          section: "sbd",
          optionKey: cand.key,
          x: cx,
          y: cand.y,
          r: blueprint.sbd.radius,
          density: cand.density,
          isSelected: isSel,
          status: isSel ? "detected" : "unfilled",
        });
      });
    }
  }

  // 2. Quét Mã đề thi (3 cột - ở Trang 1)
  const examCodeDigits: string[] = [];
  if (targetPageIndex === 1) {
    for (let col = 0; col < blueprint.examCode.cols; col++) {
      const cx = blueprint.examCode.startX + col * blueprint.examCode.colStep;
      const colCandidates: { key: string; density: number; y: number }[] = [];

      for (let digit = 0; digit <= 9; digit++) {
        const cy = blueprint.examCode.startY + digit * blueprint.examCode.rowStep;
        const density = measureBubbleDensity(
          binary,
          gray,
          width,
          height,
          cx,
          cy,
          blueprint.examCode.radius
        );
        colCandidates.push({ key: String(digit), density, y: cy });
      }

      const { selected } = pickDominantBubble(colCandidates, MIN_FILLED_DENSITY);
      examCodeDigits.push(selected ? selected.key : "");

      colCandidates.forEach((cand) => {
        const isSel = selected?.key === cand.key;
        bubbleCoordinates.push({
          id: `code-col${col}-${cand.key}`,
          pageIndex: 1,
          section: "exam_code",
          optionKey: cand.key,
          x: cx,
          y: cand.y,
          r: blueprint.examCode.radius,
          density: cand.density,
          isSelected: isSel,
          status: isSel ? "detected" : "unfilled",
        });
      });
    }
  }

  // 3. Quét Phần I: Trắc nghiệm nhiều lựa chọn (A, B, C, D)
  const part1Answers: Record<number, string> = {};
  const optionKeys = ["A", "B", "C", "D"];

  blueprint.part1.blocks
    .filter((b) => (b.pageIndex || 1) === targetPageIndex)
    .forEach((block) => {
      for (let qNum = block.startQuestion; qNum <= block.endQuestion; qNum++) {
        const rowIdx = qNum - block.startQuestion;
        const cy = block.startY + rowIdx * block.rowStepY;
        const rowCandidates: { key: string; density: number; x: number }[] = [];

        optionKeys.forEach((optKey, optIdx) => {
          const cx = block.startX + optIdx * block.optionStepX;
          const density = measureBubbleDensity(
            binary,
            gray,
            width,
            height,
            cx,
            cy,
            block.radius
          );
          rowCandidates.push({ key: optKey, density, x: cx });
        });

        const { selected, isAmbiguous } = pickDominantBubble(
          rowCandidates,
          MIN_FILLED_DENSITY
        );
        if (selected) {
          part1Answers[qNum] = selected.key;
          confidenceSum += isAmbiguous ? 65 : Math.min(100, 75 + selected.density * 35);
          confidenceCount++;
        }
        if (isAmbiguous) {
          flaggedQuestionsSet.add(qNum);
        }

        rowCandidates.forEach((cand) => {
          const isSel = selected?.key === cand.key;
          bubbleCoordinates.push({
            id: `p1-q${qNum}-${cand.key}`,
            pageIndex: targetPageIndex,
            section: "part1",
            questionNumber: qNum,
            optionKey: cand.key,
            x: cand.x,
            y: cy,
            r: block.radius,
            density: cand.density,
            isSelected: isSel,
            status: isAmbiguous && isSel ? "ambiguous" : isSel ? "detected" : "unfilled",
          });
        });
      }
    });

  // 4. Quét Phần II: Trắc nghiệm Đúng / Sai (4 ý a, b, c, d)
  const part2Answers: Record<number, Record<"a" | "b" | "c" | "d", boolean | null>> = {};
  const subKeys: ("a" | "b" | "c" | "d")[] = ["a", "b", "c", "d"];
  const p1Offset = blueprint.part1TotalQuestions ?? 40;

  blueprint.part2.blocks
    .filter((b) => (b.pageIndex || 1) === targetPageIndex)
    .forEach((block) => {
      const qNum = block.questionNumber;
      const globalQOrder = p1Offset + qNum;
      part2Answers[qNum] = { a: null, b: null, c: null, d: null };

      subKeys.forEach((subK, subIdx) => {
        const cy = block.startY + subIdx * block.rowStepY;
        const densityTrue = measureBubbleDensity(
          binary,
          gray,
          width,
          height,
          block.trueX,
          cy,
          block.radius
        );
        const densityFalse = measureBubbleDensity(
          binary,
          gray,
          width,
          height,
          block.falseX,
          cy,
          block.radius
        );

        const pairCandidates = [
          { key: "T", density: densityTrue, x: block.trueX },
          { key: "F", density: densityFalse, x: block.falseX },
        ];

        const { selected, isAmbiguous } = pickDominantBubble(
          pairCandidates,
          MIN_FILLED_DENSITY
        );
        if (selected) {
          part2Answers[qNum][subK] = selected.key === "T";
          confidenceSum += isAmbiguous ? 65 : Math.min(100, 75 + selected.density * 35);
          confidenceCount++;
        }
        if (isAmbiguous) {
          flaggedQuestionsSet.add(globalQOrder);
        }

        pairCandidates.forEach((cand) => {
          const isSel = selected?.key === cand.key;
          bubbleCoordinates.push({
            id: `p2-q${qNum}-${subK}-${cand.key}`,
            pageIndex: targetPageIndex,
            section: "part2",
            questionNumber: qNum,
            subKey: subK,
            optionKey: cand.key,
            x: cand.x,
            y: cy,
            r: block.radius,
            density: cand.density,
            isSelected: isSel,
            status: isAmbiguous && isSel ? "ambiguous" : isSel ? "detected" : "unfilled",
          });
        });
      });
    });

  // 5. Quét Phần III: Trả lời ngắn (4 cột số mỗi câu)
  const part3Answers: Record<number, string> = {};
  const p2Offset = p1Offset + (blueprint.part2TotalQuestions ?? 8);

  blueprint.part3.blocks
    .filter((b) => (b.pageIndex || 1) === targetPageIndex)
    .forEach((block) => {
      const qNum = block.questionNumber;
      const globalQOrder = p2Offset + qNum;
      const chars: string[] = [];

      for (let col = 0; col < 4; col++) {
        const cx = block.startX + col * block.colStepX;
        const colCandidates: { key: string; density: number; y: number }[] = [];

        if (col === 0) {
          const dMinus = measureBubbleDensity(
            binary,
            gray,
            width,
            height,
            cx,
            block.minusY,
            block.radius
          );
          colCandidates.push({ key: "-", density: dMinus, y: block.minusY });
        }

        if (col === 1 || col === 2) {
          const dComma = measureBubbleDensity(
            binary,
            gray,
            width,
            height,
            cx,
            block.commaY,
            block.radius
          );
          colCandidates.push({ key: ",", density: dComma, y: block.commaY });
        }

        for (let digit = 0; digit <= 9; digit++) {
          const cy = block.digit0Y + digit * block.rowStepY;
          const dDigit = measureBubbleDensity(
            binary,
            gray,
            width,
            height,
            cx,
            cy,
            block.radius
          );
          colCandidates.push({ key: String(digit), density: dDigit, y: cy });
        }

        const { selected, isAmbiguous } = pickDominantBubble(
          colCandidates,
          MIN_FILLED_DENSITY
        );
        if (selected) {
          chars.push(selected.key);
          confidenceSum += isAmbiguous ? 65 : Math.min(100, 75 + selected.density * 35);
          confidenceCount++;
        }
        if (isAmbiguous) {
          flaggedQuestionsSet.add(globalQOrder);
        }

        colCandidates.forEach((cand) => {
          const isSel = selected?.key === cand.key;
          bubbleCoordinates.push({
            id: `p3-q${qNum}-c${col}-${cand.key}`,
            pageIndex: targetPageIndex,
            section: "part3",
            questionNumber: qNum,
            subKey: String(col),
            optionKey: cand.key,
            x: cx,
            y: cand.y,
            r: block.radius,
            density: cand.density,
            isSelected: isSel,
            status: isAmbiguous && isSel ? "ambiguous" : isSel ? "detected" : "unfilled",
          });
        });
      }

      part3Answers[qNum] = chars.join("");
    });

  const avgConfidence =
    confidenceCount > 0 ? Number((confidenceSum / confidenceCount).toFixed(1)) : 96.5;

  return {
    detected_sbd: sbdDigits.join("") || "Chưa tô",
    detected_exam_code: examCodeDigits.join("") || "Chưa tô",
    confidence: avgConfidence,
    warp_matrix_applied: cornerResult.detected,
    canonical_width: OMR_CANONICAL_WIDTH,
    canonical_height: OMR_CANONICAL_HEIGHT,
    scanned_page_index: targetPageIndex,
    total_pages: blueprint.totalPages || 1,
    warped_image_data_url: warpedDataUrl,
    geometry_warning: cornerResult.geometryWarning,
    corner_points: {
      topLeft: cornerResult.topLeft,
      topRight: cornerResult.topRight,
      bottomRight: cornerResult.bottomRight,
      bottomLeft: cornerResult.bottomLeft,
    },
    part1_answers: part1Answers,
    part2_answers: part2Answers,
    part3_answers: part3Answers,
    flagged_questions: Array.from(flaggedQuestionsSet).sort((a, b) => a - b),
    bubble_coordinates: bubbleCoordinates,
  };
}

export const processOMR = scanOMRSheetFromCanvas;

/**
 * GỘP KẾT QUẢ QUÉT CỦA NHIỀU TRANG (TRANG 1 + TRANG 2...) THÀNH 1 BẢN GHI OMR DUY NHẤT
 */
export function mergeMultiPageOMRResults(pagesResults: OMRResultData[]): OMRResultData {
  if (!pagesResults || pagesResults.length === 0) {
    throw new Error("Không có dữ liệu trang OMR nào để gộp.");
  }
  if (pagesResults.length === 1) return pagesResults[0];

  const base = pagesResults[0];
  const mergedPart1: Record<number, string> = { ...base.part1_answers };
  const mergedPart2: Record<number, Record<"a" | "b" | "c" | "d", boolean | null>> = {
    ...base.part2_answers,
  };
  const mergedPart3: Record<number, string> = { ...base.part3_answers };
  const mergedFlags = new Set<number>(base.flagged_questions);
  const mergedCoords: OMRBubbleCoordinate[] = [...base.bubble_coordinates];
  const secondaryUrls: string[] = [];

  for (let i = 1; i < pagesResults.length; i++) {
    const p = pagesResults[i];
    Object.assign(mergedPart1, p.part1_answers);
    Object.assign(mergedPart2, p.part2_answers);
    Object.assign(mergedPart3, p.part3_answers);
    p.flagged_questions.forEach((f) => mergedFlags.add(f));
    mergedCoords.push(...p.bubble_coordinates);
    if (p.warped_image_data_url) secondaryUrls.push(p.warped_image_data_url);
  }

  return {
    ...base,
    secondary_page_image_urls: secondaryUrls,
    part1_answers: mergedPart1,
    part2_answers: mergedPart2,
    part3_answers: mergedPart3,
    flagged_questions: Array.from(mergedFlags).sort((a, b) => a - b),
    bubble_coordinates: mergedCoords,
  };
}

/**
 * HÀM CHẤM ĐIỂM TỰ ĐỘNG BÀI LÀM OMR VÀ CẬP NHẬT TRẠNG THÁI BOUNDING BOX (XANH / ĐỎ)
 */
export function gradeOMRSubmission(
  omrData: OMRResultData,
  examDataOrQuestions: any
): OMRGradingSummary {
  const resolvedExam = resolveCompleteExamObject(examDataOrQuestions);

  const rawSections =
    resolvedExam?.data ||
    resolvedExam?.sections ||
    (Array.isArray(resolvedExam) ? resolvedExam : []);

  const flatQuestions: {
    id: string;
    globalOrder: number;
    part: 1 | 2 | 3;
    localNumberInPart: number;
    type: QuestionType;
    correctAnswer: string;
    options: any[];
  }[] = [];

  let p1Counter = 0;
  let p2Counter = 0;
  let p3Counter = 0;
  let globalCounter = 0;

  const pushQuestion = (q: any, fallbackType?: string) => {
    globalCounter++;
    const rawCorrect = String(
      q?.correct_answer ?? q?.correctAnswer ?? q?.answer ?? "A"
    ).trim();
    const cleanAns = rawCorrect.replace(/[^A-Za-zĐđSsTtFf]/g, "").toUpperCase();

    const isTF =
      q?.type === "true_false" ||
      fallbackType === "true_false" ||
      (["Đ", "S", "T", "F"].includes(cleanAns[0]) && cleanAns.length >= 2) ||
      (Array.isArray(q?.options) &&
        q.options.length > 0 &&
        typeof q.options[0]?.is_true_false_ans === "boolean");

    const isShort =
      !isTF &&
      (q?.type === "short_answer" ||
        fallbackType === "short_answer" ||
        !Array.isArray(q?.options) ||
        q.options.length === 0);

    if (isTF) {
      p2Counter++;
      flatQuestions.push({
        id: String(q?.id || `q-${globalCounter}`),
        globalOrder: globalCounter,
        part: 2,
        localNumberInPart: p2Counter,
        type: "true_false",
        correctAnswer: rawCorrect,
        options: Array.isArray(q?.options) ? q.options : [],
      });
    } else if (isShort) {
      p3Counter++;
      flatQuestions.push({
        id: String(q?.id || `q-${globalCounter}`),
        globalOrder: globalCounter,
        part: 3,
        localNumberInPart: p3Counter,
        type: "short_answer",
        correctAnswer: rawCorrect,
        options: [],
      });
    } else {
      p1Counter++;
      flatQuestions.push({
        id: String(q?.id || `q-${globalCounter}`),
        globalOrder: globalCounter,
        part: 1,
        localNumberInPart: p1Counter,
        type: "multiple_choice",
        correctAnswer: rawCorrect,
        options: Array.isArray(q?.options) ? q.options : [],
      });
    }
  };

  if (Array.isArray(rawSections) && rawSections.length > 0 && rawSections[0]?.questions) {
    rawSections.forEach((sec: any) => {
      const secType =
        sec?.section_type ||
        sec?.type ||
        (sec?.section_title && /đúng\s*sai/i.test(sec.section_title)
          ? "true_false"
          : sec?.section_title && /trả\s*lời\s*ngắn|điền/i.test(sec.section_title)
          ? "short_answer"
          : "multiple_choice");

      (sec?.questions || []).forEach((q: any) => pushQuestion(q, secType));
    });
  } else if (Array.isArray(resolvedExam?.questions)) {
    resolvedExam.questions.forEach((q: any) => pushQuestion(q));
  } else if (Array.isArray(rawSections)) {
    rawSections.forEach((q: any) => pushQuestion(q));
  }

  const normalizeShortStr = (val: string) =>
    String(val || "")
      .trim()
      .toLowerCase()
      .replace(/,/g, ".")
      .replace(/\s+/g, "")
      .replace(/[−–—]/g, "-");

  const updatedCoordinates: OMRBubbleCoordinate[] = omrData.bubble_coordinates.map((b) => ({
    ...b,
  }));

  const normalizedAnswers: Record<string, any> = {};
  const questionDetails: OMRQuestionGradeDetail[] = [];

  let part1Score = 0;
  let part2Score = 0;
  let part3Score = 0;
  let maxPossiblePoints = 0;

  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  const isStandardTHPTWeight = p2Counter > 0 || p3Counter > 0;

  flatQuestions.forEach((q) => {
    const gOrder = q.globalOrder;
    const isFlagged = omrData.flagged_questions.includes(gOrder);

    if (q.part === 1) {
      const qMaxPt = isStandardTHPTWeight ? 0.25 : 1.0;
      maxPossiblePoints += qMaxPt;

      const selectedOpt = (omrData.part1_answers[q.localNumberInPart] || "")
        .trim()
        .toUpperCase();
      const expectedOpt = (q.correctAnswer || "A").trim().toUpperCase();

      if (selectedOpt) {
        normalizedAnswers[q.id] = selectedOpt;
        normalizedAnswers[`q-${gOrder}`] = selectedOpt;
        normalizedAnswers[`q_${gOrder}`] = selectedOpt;
        normalizedAnswers[String(gOrder)] = selectedOpt;
      }

      const isRight = Boolean(selectedOpt && selectedOpt === expectedOpt);
      const status = !selectedOpt ? "skipped" : isRight ? "correct" : "wrong";
      const earned = isRight ? qMaxPt : 0;

      part1Score += earned;
      if (status === "correct") correctCount++;
      else if (status === "wrong") wrongCount++;
      else skippedCount++;

      updatedCoordinates.forEach((b) => {
        if (b.section === "part1" && b.questionNumber === q.localNumberInPart) {
          if (b.optionKey === selectedOpt) {
            b.status = isRight ? "correct" : "wrong";
          } else if (b.optionKey === expectedOpt && !isRight) {
            b.status = "expected_missed";
          }
        }
      });

      questionDetails.push({
        questionOrder: gOrder,
        part: 1,
        questionId: q.id,
        type: "multiple_choice",
        studentAnswerDisplay: selectedOpt || "Bỏ trống",
        correctAnswerDisplay: expectedOpt,
        status,
        pointsEarned: earned,
        maxPoints: qMaxPt,
        isFlagged,
      });
    } else if (q.part === 2) {
      const qMaxPt = 1.0;
      maxPossiblePoints += qMaxPt;

      const stuSubMap = omrData.part2_answers[q.localNumberInPart] || {
        a: null,
        b: null,
        c: null,
        d: null,
      };

      const expectedBoolMap: Record<"a" | "b" | "c" | "d", boolean> = {
        a: true,
        b: true,
        c: true,
        d: true,
      };
      const cleanExpected = (q.correctAnswer || "ĐĐĐĐ")
        .replace(/[^A-Za-zĐđSsTtFf]/g, "")
        .toUpperCase();

      const subKeys: ("a" | "b" | "c" | "d")[] = ["a", "b", "c", "d"];
      subKeys.forEach((sk, idx) => {
        const optItem = Array.isArray(q.options) ? q.options[idx] : null;
        if (optItem && typeof optItem.is_true_false_ans === "boolean") {
          expectedBoolMap[sk] = optItem.is_true_false_ans;
        } else {
          const expChar = cleanExpected[idx] || "Đ";
          expectedBoolMap[sk] = expChar === "Đ" || expChar === "D" || expChar === "T";
        }
      });

      let rightSubCount = 0;
      let answeredSubCount = 0;
      const tfAnswerForExamRoom: Record<string, "T" | "F"> = {};
      const stuDisplayParts: string[] = [];
      const corrDisplayParts: string[] = [];

      subKeys.forEach((sk) => {
        const expBool = expectedBoolMap[sk];
        const stuBool = stuSubMap[sk];

        corrDisplayParts.push(`${sk}) ${expBool ? "Đ" : "S"}`);

        if (stuBool !== null && stuBool !== undefined) {
          answeredSubCount++;
          tfAnswerForExamRoom[sk] = stuBool ? "T" : "F";
          stuDisplayParts.push(`${sk}) ${stuBool ? "Đ" : "S"}`);
          if (stuBool === expBool) {
            rightSubCount++;
          }
        } else {
          stuDisplayParts.push(`${sk}) _`);
        }

        updatedCoordinates.forEach((b) => {
          if (
            b.section === "part2" &&
            b.questionNumber === q.localNumberInPart &&
            b.subKey === sk
          ) {
            const bubbleRepresentsTrue = b.optionKey === "T";
            if (b.isSelected) {
              b.status = bubbleRepresentsTrue === expBool ? "correct" : "wrong";
            } else if (bubbleRepresentsTrue === expBool && stuBool !== expBool) {
              b.status = "expected_missed";
            }
          }
        });
      });

      if (answeredSubCount > 0) {
        normalizedAnswers[q.id] = tfAnswerForExamRoom;
        normalizedAnswers[`q-${gOrder}`] = tfAnswerForExamRoom;
        normalizedAnswers[`q_${gOrder}`] = tfAnswerForExamRoom;
        normalizedAnswers[String(gOrder)] = tfAnswerForExamRoom;
      }

      let earned = 0;
      if (rightSubCount === 1) earned = 0.1;
      else if (rightSubCount === 2) earned = 0.25;
      else if (rightSubCount === 3) earned = 0.5;
      else if (rightSubCount === 4) earned = 1.0;

      part2Score += earned;

      let status: "correct" | "wrong" | "partial" | "skipped" = "skipped";
      if (answeredSubCount === 0) {
        status = "skipped";
        skippedCount++;
      } else if (rightSubCount === 4) {
        status = "correct";
        correctCount++;
      } else if (rightSubCount > 0) {
        status = "partial";
        wrongCount++;
      } else {
        status = "wrong";
        wrongCount++;
      }

      questionDetails.push({
        questionOrder: gOrder,
        part: 2,
        questionId: q.id,
        type: "true_false",
        studentAnswerDisplay:
          answeredSubCount > 0 ? stuDisplayParts.join(" • ") : "Bỏ trống",
        correctAnswerDisplay: corrDisplayParts.join(" • "),
        status,
        pointsEarned: earned,
        maxPoints: qMaxPt,
        isFlagged,
      });
    } else {
      const qMaxPt = isStandardTHPTWeight ? 0.5 : 1.0;
      maxPossiblePoints += qMaxPt;

      const stuRawStr = (omrData.part3_answers[q.localNumberInPart] || "").trim();
      const expRawStr = (q.correctAnswer || "").trim();

      if (stuRawStr) {
        normalizedAnswers[q.id] = stuRawStr;
        normalizedAnswers[`q-${gOrder}`] = stuRawStr;
        normalizedAnswers[`q_${gOrder}`] = stuRawStr;
        normalizedAnswers[String(gOrder)] = stuRawStr;
      }

      const isRight = Boolean(
        stuRawStr &&
          expRawStr &&
          normalizeShortStr(stuRawStr) === normalizeShortStr(expRawStr)
      );
      const status = !stuRawStr ? "skipped" : isRight ? "correct" : "wrong";
      const earned = isRight ? qMaxPt : 0;

      part3Score += earned;
      if (status === "correct") correctCount++;
      else if (status === "wrong") wrongCount++;
      else skippedCount++;

      updatedCoordinates.forEach((b) => {
        if (
          b.section === "part3" &&
          b.questionNumber === q.localNumberInPart &&
          b.isSelected
        ) {
          b.status = isRight ? "correct" : "wrong";
        }
      });

      questionDetails.push({
        questionOrder: gOrder,
        part: 3,
        questionId: q.id,
        type: "short_answer",
        studentAnswerDisplay: stuRawStr || "Bỏ trống",
        correctAnswerDisplay: expRawStr,
        status,
        pointsEarned: earned,
        maxPoints: qMaxPt,
        isFlagged,
      });
    }
  });

  const rawPointsEarned = Number((part1Score + part2Score + part3Score).toFixed(2));
  const scaledScoreOn10 =
    maxPossiblePoints > 0
      ? Number(Math.min(10, (rawPointsEarned / maxPossiblePoints) * 10).toFixed(2))
      : 0;

  return {
    score: scaledScoreOn10,
    rawPointsEarned,
    maxPossiblePoints: Number(maxPossiblePoints.toFixed(2)),
    totalQuestions: flatQuestions.length,
    correctCount,
    wrongCount,
    skippedCount,
    part1Score: Number(part1Score.toFixed(2)),
    part2Score: Number(part2Score.toFixed(2)),
    part3Score: Number(part3Score.toFixed(2)),
    normalizedAnswers,
    questionDetails,
    updatedOmrData: {
      ...omrData,
      bubble_coordinates: updatedCoordinates,
    },
  };
}

/**
 * DỰNG MÃ SVG CHO TỪNG TRANG A4 (CÓ LOGO TCT NỔI BẬT + AUTO-PAGINATION BẺ TRANG CHUẨN XÁC)
 */
export function generatePrintableAnswerSheetPagesSVG(examOrConfig?: any): string[] {
  const resolved = resolveCompleteExamObject(examOrConfig);
  const blueprint = buildDynamicOMRBlueprint(resolved);
  const W = OMR_CANONICAL_WIDTH;
  const H = OMR_CANONICAL_HEIGHT;
  const corners = CANONICAL_CORNER_TARGETS;

  const rawTitle =
    resolved?.examTitle ||
    resolved?.title ||
    "ĐỀ KIỂM TRA & LUYỆN THI - TÂM CHÍ TÀI EDUNEXUS";
  const safeTitle = String(rawTitle).replace(/[<>&"]/g, "");

  const rawSbdInput = resolved?.studentSbd || "";
  const presetSbd =
    /^\d{6}$/.test(String(rawSbdInput).trim())
      ? String(rawSbdInput).trim()
      : "";

  const presetCode = deriveExamCode3Digits(resolved);
  const presetName = String(resolved?.studentName || "").replace(/[<>&"]/g, "");

  const p1Max = blueprint.part1TotalQuestions ?? 40;
  const p2Max = blueprint.part2TotalQuestions ?? 8;
  const p3Max = blueprint.part3TotalQuestions ?? 6;
  const totalPages = blueprint.totalPages || 1;

  const pagesSvgList: string[] = [];

  for (let pageIdx = 1; pageIdx <= totalPages; pageIdx++) {
    let svgElements = "";

    const markerSize = 28;
    [
      corners.topLeft,
      corners.topRight,
      corners.bottomRight,
      corners.bottomLeft,
    ].forEach((pt) => {
      svgElements += `<rect x="${pt.x - markerSize / 2}" y="${pt.y - markerSize / 2}" width="${markerSize}" height="${markerSize}" fill="#000000" />`;
    });

    for (let ty = 225; ty <= 470; ty += 27) {
      svgElements += `<rect x="1146" y="${ty - 4}" width="16" height="8" fill="#000000" />`;
    }

    svgElements += `
      <g transform="translate(65, 62)">
        <rect x="0" y="0" width="52" height="52" rx="12" fill="#1D4ED8" />
        <text x="26" y="33" font-family="Arial, sans-serif" font-size="19" font-weight="900" text-anchor="middle" fill="#FFFFFF">TCT</text>
        <text x="64" y="22" font-family="Arial, sans-serif" font-size="14" font-weight="900" fill="#0F172A">TÂM CHÍ TÀI</text>
        <text x="64" y="40" font-family="Arial, sans-serif" font-size="10.5" font-weight="bold" fill="#1D4ED8">EDUNEXUS OMR SYSTEM</text>
      </g>
    `;

    if (pageIdx === 1) {
      svgElements += `
        <text x="485" y="86" font-family="Arial, sans-serif" font-size="22" font-weight="900" text-anchor="middle" fill="#000000">PHIẾU TRẢ LỜI TRẮC NGHIỆM ${totalPages > 1 ? `(TRANG 1/${totalPages})` : ""}</text>
        <text x="485" y="116" font-family="Arial, sans-serif" font-size="16" font-weight="900" text-anchor="middle" fill="#1D4ED8">${safeTitle}</text>
        <rect x="65" y="148" width="710" height="335" fill="none" stroke="#334155" stroke-width="1.5" rx="6" />
        <line x1="255" y1="148" x2="255" y2="483" stroke="#334155" stroke-width="1.2" />
        <line x1="65" y1="315" x2="255" y2="315" stroke="#334155" stroke-width="1.2" />
        <text x="160" y="176" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#334155">Họ tên, chữ ký Giám thị 1</text>
        <text x="160" y="342" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#334155">Họ tên, chữ ký Giám thị 2</text>
        <text x="275" y="185" font-family="Arial, sans-serif" font-size="13" fill="#0f172a">1. Trung tâm / Hội đồng: <tspan font-weight="bold">Hệ thống Luyện thi Toán TCT</tspan></text>
        <text x="275" y="225" font-family="Arial, sans-serif" font-size="13" fill="#0f172a">2. Điểm bài thi: ...........................................................................</text>
        <text x="275" y="265" font-family="Arial, sans-serif" font-size="13" fill="#0f172a">3. Lớp / Ca học: ..........................................................................</text>
        <text x="275" y="305" font-family="Arial, sans-serif" font-size="13" fill="#0f172a">4. Họ và tên thí sinh: ${presetName ? `<tspan font-weight="bold">${presetName}</tspan>` : ".................................................................."}</text>
        <text x="275" y="345" font-family="Arial, sans-serif" font-size="13" fill="#0f172a">5. Ngày làm bài: ........../........../2026</text>
        <text x="275" y="385" font-family="Arial, sans-serif" font-size="13" fill="#0f172a">6. Chữ ký của thí sinh: ..............................................................</text>
        <text x="275" y="432" font-family="Arial, sans-serif" font-size="12.5" font-weight="bold" fill="#1D4ED8">Cấu trúc đề: ${p1Max + p2Max + p3Max} câu (Phần I: ${p1Max} câu • Phần II: ${p2Max} câu • Phần III: ${p3Max} câu)</text>
        <text x="275" y="460" font-family="Arial, sans-serif" font-size="11.5" font-weight="bold" fill="#dc2626">* Học sinh tra cứu đúng SBD theo STT lớp (VD: 000001, 000002...) để tô vào mục 7.</text>
        <text x="415" y="512" font-family="Arial, sans-serif" font-size="11.5" font-style="italic" font-weight="bold" text-anchor="middle" fill="#0f172a">Chú ý: Không đặt ngón tay đè lên 4 ô vuông đen ở 4 góc phiếu khi chụp ảnh chấm điểm.</text>
      `;

      svgElements += `
        <text x="${blueprint.sbd.startX + 70}" y="144" font-family="Arial, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#000">7. Số báo danh</text>
        <rect x="${blueprint.sbd.startX - 18}" y="154" width="${blueprint.sbd.cols * blueprint.sbd.colStep + 8}" height="34" fill="none" stroke="#334155" stroke-width="1.2" />
        <rect x="${blueprint.sbd.startX - 18}" y="200" width="${blueprint.sbd.cols * blueprint.sbd.colStep + 8}" height="${10 * blueprint.sbd.rowStep + 14}" fill="none" stroke="#334155" stroke-width="1.2" />
      `;
      for (let c = 0; c < blueprint.sbd.cols; c++) {
        const cx = blueprint.sbd.startX + c * blueprint.sbd.colStep;
        if (c > 0) {
          svgElements += `<line x1="${cx - blueprint.sbd.colStep / 2}" y1="154" x2="${cx - blueprint.sbd.colStep / 2}" y2="188" stroke="#cbd5e1" stroke-width="1" />`;
        }
        const presetDigit = presetSbd[c] || "";
        if (presetDigit) {
          svgElements += `<text x="${cx}" y="177" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#0f172a">${presetDigit}</text>`;
        }
        for (let d = 0; d <= 9; d++) {
          const cy = blueprint.sbd.startY + d * blueprint.sbd.rowStep;
          const isPreFilled = presetDigit === String(d);
          svgElements += `
            <circle cx="${cx}" cy="${cy}" r="${blueprint.sbd.radius}" fill="${isPreFilled ? "#0f172a" : "none"}" stroke="#475569" stroke-width="1.1" />
            <text x="${cx}" y="${cy + 3.5}" font-family="Arial, sans-serif" font-size="9.5" text-anchor="middle" fill="${isPreFilled ? "#ffffff" : "#475569"}">${d}</text>
          `;
        }
      }

      svgElements += `
        <text x="${blueprint.examCode.startX + 28}" y="144" font-family="Arial, sans-serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#000">8. Mã đề thi</text>
        <rect x="${blueprint.examCode.startX - 18}" y="154" width="${blueprint.examCode.cols * blueprint.examCode.colStep + 8}" height="34" fill="none" stroke="#334155" stroke-width="1.2" />
        <rect x="${blueprint.examCode.startX - 18}" y="200" width="${blueprint.examCode.cols * blueprint.examCode.colStep + 8}" height="${10 * blueprint.examCode.rowStep + 14}" fill="none" stroke="#334155" stroke-width="1.2" />
      `;
      for (let c = 0; c < blueprint.examCode.cols; c++) {
        const cx = blueprint.examCode.startX + c * blueprint.examCode.colStep;
        const presetCodeDigit = presetCode[c] || "";
        if (presetCodeDigit) {
          svgElements += `<text x="${cx}" y="177" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#0f172a">${presetCodeDigit}</text>`;
        }
        for (let d = 0; d <= 9; d++) {
          const cy = blueprint.examCode.startY + d * blueprint.examCode.rowStep;
          const isPreFilled = presetCodeDigit === String(d);
          svgElements += `
            <circle cx="${cx}" cy="${cy}" r="${blueprint.examCode.radius}" fill="${isPreFilled ? "#0f172a" : "none"}" stroke="#475569" stroke-width="1.1" />
            <text x="${cx}" y="${cy + 3.5}" font-family="Arial, sans-serif" font-size="9.5" text-anchor="middle" fill="${isPreFilled ? "#ffffff" : "#475569"}">${d}</text>
          `;
        }
      }
    } else {
      svgElements += `
        <text x="620" y="88" font-family="Arial, sans-serif" font-size="22" font-weight="900" text-anchor="middle" fill="#000000">PHIẾU TRẢ LỜI TRẮC NGHIỆM — TRANG ${pageIdx} / ${totalPages}</text>
        <text x="620" y="118" font-family="Arial, sans-serif" font-size="15.5" font-weight="900" text-anchor="middle" fill="#1D4ED8">${safeTitle} • Mã đề: ${presetCode} • Họ tên: ${presetName || "........................................"} • SBD: ${presetSbd || ".............."}</text>
        <line x1="65" y1="138" x2="1135" y2="138" stroke="#334155" stroke-width="1.5" />
      `;
    }

    const pageP1Blocks = blueprint.part1.blocks.filter(
      (b) => (b.pageIndex || 1) === pageIdx
    );
    if (pageP1Blocks.length > 0) {
      const minQ = pageP1Blocks[0].startQuestion;
      const maxQ = pageP1Blocks[pageP1Blocks.length - 1].endQuestion;
      const firstBlockTopY = pageP1Blocks[0].startY - 46;

      svgElements += `
        <text x="65" y="${firstBlockTopY - 14}" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#000">PHẦN I: Trắc nghiệm nhiều phương án lựa chọn (Từ câu ${minQ} đến câu ${maxQ} / Tổng ${p1Max} câu)</text>
      `;

      const opts = ["A", "B", "C", "D"];
      pageP1Blocks.forEach((b) => {
        const boxLeft = b.startX - 48;
        const boxTop = b.startY - 46;
        const numRows = b.endQuestion - b.startQuestion + 1;
        const boxH = Math.max(70, numRows * b.rowStepY + 38);

        svgElements += `<rect x="${boxLeft}" y="${boxTop}" width="232" height="${boxH}" fill="none" stroke="#334155" stroke-width="1.3" rx="5" />`;
        opts.forEach((k, idx) => {
          const ox = b.startX + idx * b.optionStepX;
          svgElements += `<text x="${ox}" y="${b.startY - 24}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#0f172a">${k}</text>`;
        });

        for (let q = b.startQuestion; q <= b.endQuestion; q++) {
          const rIdx = q - b.startQuestion;
          const cy = b.startY + rIdx * b.rowStepY;
          svgElements += `<text x="${b.startX - 28}" y="${cy + 4}" font-family="Arial, sans-serif" font-size="11.5" font-weight="bold" text-anchor="middle" fill="#0f172a">${q}</text>`;
          opts.forEach((_, idx) => {
            const cx = b.startX + idx * b.optionStepX;
            svgElements += `<circle cx="${cx}" cy="${cy}" r="${b.radius}" fill="none" stroke="#334155" stroke-width="1.2" />`;
          });
        }
      });
    }

    const pageP2Blocks = blueprint.part2.blocks.filter(
      (b) => (b.pageIndex || 1) === pageIdx
    );
    if (pageP2Blocks.length > 0) {
      const firstY = pageP2Blocks[0].startY;
      const minQ2 = pageP2Blocks[0].questionNumber;
      const maxQ2 = pageP2Blocks[pageP2Blocks.length - 1].questionNumber;
      svgElements += `
        <text x="65" y="${firstY - 64}" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#000">PHẦN II: Trắc nghiệm Đúng / Sai (Câu ${minQ2} đến Câu ${maxQ2} / Tổng ${p2Max} câu)</text>
      `;
      const subLabels = ["a)", "b)", "c)", "d)"];
      pageP2Blocks.forEach((b) => {
        const q = b.questionNumber;
        const boxLeft = b.trueX - 42;
        const boxTop = b.startY - 52;
        const centerX = (b.trueX + b.falseX) / 2 + 2;

        svgElements += `
          <rect x="${boxLeft}" y="${boxTop}" width="118" height="174" fill="none" stroke="#334155" stroke-width="1.3" rx="5" />
          <line x1="${boxLeft}" y1="${boxTop + 24}" x2="${boxLeft + 118}" y2="${boxTop + 24}" stroke="#cbd5e1" stroke-width="1" />
          <text x="${centerX}" y="${boxTop + 17}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#000">Câu ${q}</text>
          <text x="${b.trueX}" y="${boxTop + 40}" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#334155">Đúng</text>
          <text x="${b.falseX}" y="${boxTop + 40}" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#334155">Sai</text>
        `;
        subLabels.forEach((lbl, idx) => {
          const cy = b.startY + idx * b.rowStepY;
          svgElements += `
            <text x="${b.trueX - 24}" y="${cy + 4}" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#0f172a">${lbl}</text>
            <circle cx="${b.trueX}" cy="${cy}" r="${b.radius}" fill="none" stroke="#334155" stroke-width="1.2" />
            <circle cx="${b.falseX}" cy="${cy}" r="${b.radius}" fill="none" stroke="#334155" stroke-width="1.2" />
          `;
        });
      });
    }

    const pageP3Blocks = blueprint.part3.blocks.filter(
      (b) => (b.pageIndex || 1) === pageIdx
    );
    if (pageP3Blocks.length > 0) {
      const firstBoxTop = pageP3Blocks[0].minusY - 54;
      const minQ3 = pageP3Blocks[0].questionNumber;
      const maxQ3 = pageP3Blocks[pageP3Blocks.length - 1].questionNumber;
      svgElements += `
        <text x="65" y="${firstBoxTop - 14}" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#000">PHẦN III: Trả lời ngắn - Điền đáp số (Câu ${minQ3} đến Câu ${maxQ3} / Tổng ${p3Max} câu)</text>
      `;
      pageP3Blocks.forEach((b) => {
        const q = b.questionNumber;
        const boxLeft = b.startX - 36;
        const boxTop = b.minusY - 54;
        svgElements += `
          <rect x="${boxLeft}" y="${boxTop}" width="152" height="388" fill="none" stroke="#334155" stroke-width="1.3" rx="5" />
          <text x="${b.startX + 40}" y="${boxTop + 24}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#000">Câu ${q}</text>
          <text x="${b.startX - 20}" y="${b.minusY + 4}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#000">-</text>
          <circle cx="${b.startX}" cy="${b.minusY}" r="${b.radius}" fill="none" stroke="#334155" stroke-width="1.2" />
          <text x="${b.startX - 20}" y="${b.commaY + 4}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#000">,</text>
          <circle cx="${b.startX + b.colStepX}" cy="${b.commaY}" r="${b.radius}" fill="none" stroke="#334155" stroke-width="1.2" />
          <circle cx="${b.startX + 2 * b.colStepX}" cy="${b.commaY}" r="${b.radius}" fill="none" stroke="#334155" stroke-width="1.2" />
        `;
        for (let d = 0; d <= 9; d++) {
          const cy = b.digit0Y + d * b.rowStepY;
          svgElements += `<text x="${b.startX - 20}" y="${cy + 4}" font-family="Arial, sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#0f172a">${d}</text>`;
          for (let c = 0; c < 4; c++) {
            const cx = b.startX + c * b.colStepX;
            svgElements += `<circle cx="${cx}" cy="${cy}" r="${b.radius}" fill="none" stroke="#334155" stroke-width="1.1" />`;
          }
        }
      });
    }

    pagesSvgList.push(
      `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="#ffffff" />${svgElements}</svg>`
    );
  }

  return pagesSvgList;
}

export function generatePrintableAnswerSheetSVG(examOrConfig?: any): string {
  const pages = generatePrintableAnswerSheetPagesSVG(examOrConfig);
  return pages.join("");
}

/**
 * MỞ CỬA SỔ IN TRỰC TIẾP PHIẾU TRẢ LỜI TRẮC NGHIỆM A4 ĐỘNG THEO CẤU TRÚC ĐỀ THI
 */
export function openPrintableDynamicAnswerSheet(examOrConfig?: any) {
  if (typeof window === "undefined") return;
  const printWin = window.open("", "_blank");
  if (!printWin) return;

  const resolved = resolveCompleteExamObject(examOrConfig);
  const counts = extractExamQuestionCounts(resolved);
  const pagesSvg = generatePrintableAnswerSheetPagesSVG(resolved);
  const title =
    resolved?.examTitle || resolved?.title || "Phiếu Trả Lời Trắc Nghiệm A4";

  const pagesHtml = pagesSvg
    .map(
      (svgItem, idx) => `
      <div class="sheet-wrap ${idx < pagesSvg.length - 1 ? "page-break" : ""}">
        ${svgItem}
      </div>
    `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8" />
      <title>Phiếu Trả Lời Trắc Nghiệm A4 - ${String(title).replace(/[<>&"]/g, "")}</title>
      <style>
        @page { size: A4 portrait; margin: 5mm; }
        body { margin: 0; padding: 0; background: #f1f5f9; font-family: Arial, sans-serif; display: flex; flex-direction: column; align-items: center; }
        .toolbar { width: 100%; max-width: 820px; margin: 12px auto; padding: 10px 18px; background: #0f172a; color: #fff; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box; }
        .btn-print { background: #2563eb; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 13px; }
        .sheet-wrap { background: #fff; width: 210mm; max-width: 100%; box-shadow: 0 10px 30px rgba(0,0,0,0.12); margin-bottom: 24px; break-inside: avoid; }
        .page-break { page-break-after: always; break-after: page; }
        svg { width: 100%; height: auto; display: block; }
        @media print {
          body { background: #fff; }
          .toolbar { display: none !important; }
          .sheet-wrap { box-shadow: none; width: 100%; margin: 0; }
        }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <div>
          <strong>Phiếu Trả Lời A4 Tự Động Theo Đề:</strong> ${String(title).replace(/[<>&"]/g, "")}
          <span style="margin-left:8px; font-size:12px; color:#93c5fd;">(${counts.totalCount} câu • ${pagesSvg.length} trang A4)</span>
        </div>
        <button class="btn-print" onclick="window.print()">🖨 In Phiếu / Lưu PDF (${pagesSvg.length} trang A4)</button>
      </div>
      ${pagesHtml}
    </body>
    </html>
  `;

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}
