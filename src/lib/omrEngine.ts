import {
  AnswerSheetTemplateConfig,
  OMRBubbleCoordinate,
  OMRCornerPoint,
  OMRGradingSummary,
  OMRQuestionGradeDetail,
  OMRResultData,
  QuestionType,
} from "@/types";

// KÍCH THƯỚC CHUẨN MA TRẬN A4 SAU KHI NẮN PHẲNG (1200 x 1700 PIXELS - TỶ LỆ CHUẨN 1 : SQRT(2))
export const OMR_CANONICAL_WIDTH = 1200;
export const OMR_CANONICAL_HEIGHT = 1700;

// TỌA ĐỘ 4 ĐIỂM MỐC ĐỊNH VỊ GÓC TRÊN KHUNG CHUẨN 1200x1700
export const CANONICAL_CORNER_TARGETS = {
  topLeft: { x: 42, y: 42 },
  topRight: { x: 1158, y: 42 },
  bottomRight: { x: 1158, y: 1658 },
  bottomLeft: { x: 42, y: 1658 },
};

// NGƯỠNG NHẬN DIỆN TÔ CHÌ TƯƠNG ĐỐI & TUYỆT ĐỐI
const MIN_FILLED_DENSITY = 0.24;
const STRONG_FILLED_DENSITY = 0.38;
const RELATIVE_DOMINANCE_RATIO = 1.25;
const SBD_DOMINANCE_RATIO = 1.2;
const AMBIGUOUS_DIFF_THRESHOLD = 0.075;

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
  boxWidth?: number;
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
  colorTheme?: "moet_crimson" | "classic_black";
}

export interface CustomFourCornersInput {
  topLeft: OMRCornerPoint;
  topRight: OMRCornerPoint;
  bottomRight: OMRCornerPoint;
  bottomLeft: OMRCornerPoint;
}

// TỌA ĐỘ CHUẨN CẶP ĐÔI PHẦN II (4 KHUNG ĐÔI: [C1|C2], [C3|C4], [C5|C6], [C7|C8])
const MOET_PART2_PAIRED_X: { trueX: number; falseX: number }[] = [
  { trueX: 118, falseX: 158 }, // Câu 1 (Nửa trái hộp đôi 1)
  { trueX: 214, falseX: 254 }, // Câu 2 (Nửa phải hộp đôi 1)
  { trueX: 390, falseX: 430 }, // Câu 3 (Nửa trái hộp đôi 2)
  { trueX: 486, falseX: 526 }, // Câu 4 (Nửa phải hộp đôi 2)
  { trueX: 662, falseX: 702 }, // Câu 5 (Nửa trái hộp đôi 3)
  { trueX: 758, falseX: 798 }, // Câu 6 (Nửa phải hộp đôi 3)
  { trueX: 934, falseX: 974 }, // Câu 7 (Nửa trái hộp đôi 4)
  { trueX: 1030, falseX: 1070 }, // Câu 8 (Nửa phải hộp đôi 4)
];

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
    startY: 232,
    rowStep: 26,
    radius: 9.2,
  },
  examCode: {
    cols: 3,
    startX: 1034,
    colStep: 28,
    startY: 232,
    rowStep: 26,
    radius: 9.2,
  },
  part1: {
    blocks: [
      {
        pageIndex: 1,
        startQuestion: 1,
        endQuestion: 10,
        startX: 138,
        optionStepX: 44,
        startY: 590,
        rowStepY: 28,
        radius: 9.5,
      },
      {
        pageIndex: 1,
        startQuestion: 11,
        endQuestion: 20,
        startX: 396,
        optionStepX: 44,
        startY: 590,
        rowStepY: 28,
        radius: 9.5,
      },
      {
        pageIndex: 1,
        startQuestion: 21,
        endQuestion: 30,
        startX: 654,
        optionStepX: 44,
        startY: 590,
        rowStepY: 28,
        radius: 9.5,
      },
      {
        pageIndex: 1,
        startQuestion: 31,
        endQuestion: 40,
        startX: 912,
        optionStepX: 44,
        startY: 590,
        rowStepY: 28,
        radius: 9.5,
      },
    ],
  },
  part2: {
    blocks: MOET_PART2_PAIRED_X.map((pos, idx) => ({
      pageIndex: 1,
      questionNumber: idx + 1,
      trueX: pos.trueX,
      falseX: pos.falseX,
      startY: 992,
      rowStepY: 27,
      radius: 9.0,
    })),
  },
  part3: {
    blocks: [0, 1, 2, 3, 4, 5].map((idx) => ({
      pageIndex: 1,
      questionNumber: idx + 1,
      startX: 120 + idx * 178,
      colStepX: 27,
      minusY: 1254,
      commaY: 1279,
      digit0Y: 1304,
      rowStepY: 25,
      radius: 8.6,
      boxWidth: 178,
    })),
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
 * TÍNH TOÁN BỐ CỤC CỘT PHẦN III CHUẨN MẪU BỘ GD&ĐT (HỖ TRỢ 1 ĐẾN 8 CÂU TRÊN CÙNG 1 KHUNG BẢNG LIỀN MẠCH)
 * Khung bảng Phần III rộng từ X = 65 đến X = 1133 (Tổng chiều rộng 1068px)
 */
function computePart3RowGeometry(questionsInRow: number): {
  startXs: number[];
  colStepX: number;
  boxWidth: number;
  radius: number;
} {
  const numCols = Math.max(6, Math.min(8, questionsInRow));
  const totalTableWidth = 1068; // Từ X = 65 đến X = 1133
  const cellWidth = totalTableWidth / numCols;

  let colStepX = 27;
  let radius = 8.6;
  let leftOffsetToFirstCol = 55;

  if (numCols === 7) {
    colStepX = 24;
    radius = 8.2;
    leftOffsetToFirstCol = 46;
  } else if (numCols >= 8) {
    colStepX = 22;
    radius = 7.8;
    leftOffsetToFirstCol = 40;
  }

  const startXs: number[] = [];
  for (let i = 0; i < numCols; i++) {
    startXs.push(Math.round((65 + i * cellWidth + leftOffsetToFirstCol) * 10) / 10);
  }

  return {
    startXs,
    colStepX,
    boxWidth: cellWidth,
    radius,
  };
}

/**
 * THUẬT TOÁN DÀN TRANG THÔNG MINH (SMART SINGLE-PAGE COMPACTION & AUTO-PAGINATION)
 */
export function buildDynamicOMRBlueprint(examOrConfig?: any): OMRTemplateBlueprint {
  const resolved = resolveCompleteExamObject(examOrConfig);
  const counts = extractExamQuestionCounts(resolved);

  const p1Limit = Math.max(0, counts.part1Count);
  const p2Limit = Math.max(0, counts.part2Count);
  const p3Limit = Math.max(0, counts.part3Count);

  const colStartXs = [138, 396, 654, 912];

  // TRƯỜNG HỢP 1: ĐỀ VỪA KHÍT TRONG 1 TRANG A4 DUY NHẤT (P1 <= 40, P2 <= 8, P3 <= 8)
  if (p1Limit <= 40 && p2Limit <= 8 && p3Limit <= 8) {
    let cursorY = 532;

    const dynamicPart1Blocks: OMRPart1Block[] = [];
    if (p1Limit > 0) {
      const numCols = Math.ceil(p1Limit / 10);
      let maxRowsP1 = 1;
      for (let c = 0; c < numCols; c++) {
        const sQ = c * 10 + 1;
        const eQ = Math.min(p1Limit, (c + 1) * 10);
        maxRowsP1 = Math.max(maxRowsP1, eQ - sQ + 1);
      }

      const startYForP1 = cursorY + 52;
      for (let c = 0; c < numCols; c++) {
        const startQ = c * 10 + 1;
        const endQ = Math.min(p1Limit, (c + 1) * 10);
        dynamicPart1Blocks.push({
          pageIndex: 1,
          startQuestion: startQ,
          endQuestion: endQ,
          startX: colStartXs[c],
          optionStepX: 44,
          startY: startYForP1,
          rowStepY: 28,
          radius: 9.5,
        });
      }

      const p1BoxH = Math.max(66, maxRowsP1 * 28 + 34);
      cursorY = startYForP1 - 42 + p1BoxH + 22;
    }

    const dynamicPart2Blocks: OMRPart2Block[] = [];
    if (p2Limit > 0) {
      const startYForP2 = cursorY + 60;
      for (let q = 1; q <= p2Limit; q++) {
        const pos = MOET_PART2_PAIRED_X[q - 1];
        dynamicPart2Blocks.push({
          pageIndex: 1,
          questionNumber: q,
          trueX: pos.trueX,
          falseX: pos.falseX,
          startY: startYForP2,
          rowStepY: 27,
          radius: 9.0,
        });
      }
      cursorY = startYForP2 - 48 + 160 + 22;
    }

    const dynamicPart3Blocks: OMRPart3Block[] = [];
    if (p3Limit > 0) {
      const p3Geo = computePart3RowGeometry(p3Limit);
      const boxTopP3 = cursorY + 24;
      // Dành 42px phía trên cho chữ "Câu X" và hàng 4 ô vuông viết tay đáp số
      const minusY = boxTopP3 + 76;
      const commaY = minusY + 25;
      const digit0Y = commaY + 25;

      for (let q = 1; q <= p3Limit; q++) {
        dynamicPart3Blocks.push({
          pageIndex: 1,
          questionNumber: q,
          startX: p3Geo.startXs[q - 1],
          colStepX: p3Geo.colStepX,
          minusY,
          commaY,
          digit0Y,
          rowStepY: 25,
          radius: p3Geo.radius,
          boxWidth: p3Geo.boxWidth,
        });
      }
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

  // TRƯỜNG HỢP 2: ĐỀ DÀI (> 40 CÂU HOẶC NHIỀU HÀNG PHẦN II, III) -> BẺ TRANG FLOW TỰ ĐỘNG
  const MAX_SAFE_Y = 1580;
  const NEW_PAGE_START_Y = 172;

  let currentPage = 1;
  let cursorY = 532;

  const dynamicPart1Blocks: OMRPart1Block[] = [];
  const dynamicPart2Blocks: OMRPart2Block[] = [];
  const dynamicPart3Blocks: OMRPart3Block[] = [];

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

      const tierTitleGap = 30;
      const boxHeight = Math.max(66, maxRowsInTier * 28 + 34);
      const neededHeight = tierTitleGap + boxHeight + 18;

      if (cursorY + neededHeight > MAX_SAFE_Y) {
        currentPage++;
        cursorY = NEW_PAGE_START_Y;
      }

      const startYForCircles = cursorY + tierTitleGap + 42;

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
          rowStepY: 28,
          radius: 9.5,
        });
      }

      cursorY = startYForCircles - 42 + boxHeight + 24;
    }
  }

  if (p2Limit > 0) {
    const totalP2Rows = Math.ceil(p2Limit / 8);
    for (let r = 0; r < totalP2Rows; r++) {
      const isFirstRowOfP2 = r === 0;
      const headerSpace = isFirstRowOfP2 ? 32 : 12;
      const boxH = 160;
      const neededHeight = headerSpace + boxH + 16;

      if (cursorY + neededHeight > MAX_SAFE_Y) {
        currentPage++;
        cursorY = NEW_PAGE_START_Y;
      }

      const startYForCircles = cursorY + headerSpace + 48;
      const qStart = r * 8 + 1;
      const qEnd = Math.min(p2Limit, (r + 1) * 8);

      for (let q = qStart; q <= qEnd; q++) {
        const col8 = (q - 1) % 8;
        const pos = MOET_PART2_PAIRED_X[col8];
        dynamicPart2Blocks.push({
          pageIndex: currentPage,
          questionNumber: q,
          trueX: pos.trueX,
          falseX: pos.falseX,
          startY: startYForCircles,
          rowStepY: 27,
          radius: 9.0,
        });
      }

      cursorY = startYForCircles - 48 + boxH + 22;
    }
  }

  if (p3Limit > 0) {
    const perRow = p3Limit <= 8 ? p3Limit : 6;
    const p3Geo = computePart3RowGeometry(perRow);
    const totalP3Rows = Math.ceil(p3Limit / perRow);

    for (let r = 0; r < totalP3Rows; r++) {
      const isFirstRowOfP3 = r === 0;
      const headerSpace = isFirstRowOfP3 ? 32 : 14;
      const boxH = 382;
      const neededHeight = headerSpace + boxH + 16;

      if (cursorY + neededHeight > MAX_SAFE_Y) {
        currentPage++;
        cursorY = NEW_PAGE_START_Y;
      }

      const boxTop = cursorY + headerSpace;
      const minusY = boxTop + 76;
      const commaY = minusY + 25;
      const digit0Y = commaY + 25;

      const qStart = r * perRow + 1;
      const qEnd = Math.min(p3Limit, (r + 1) * perRow);

      for (let q = qStart; q <= qEnd; q++) {
        const colIdx = (q - 1) % perRow;
        dynamicPart3Blocks.push({
          pageIndex: currentPage,
          questionNumber: q,
          startX: p3Geo.startXs[colIdx],
          colStepX: p3Geo.colStepX,
          minusY,
          commaY,
          digit0Y,
          rowStepY: 25,
          radius: p3Geo.radius,
          boxWidth: p3Geo.boxWidth,
        });
      }

      cursorY = boxTop + boxH + 22;
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
  const sensitivity = 0.86;

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
      binary[idx] = gray[idx] < localMean * sensitivity && gray[idx] < 198 ? 1 : 0;
    }
  }

  return { gray, binary, width, height };
}

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
      if (gray[rowOffset + x] >= 140) brightCount++;
    }
    rowBrightRatio[y] = brightCount / Math.ceil(width / 2);
  }

  for (let x = 0; x < width; x++) {
    let brightCount = 0;
    for (let y = 0; y < height; y += 2) {
      if (gray[y * width + x] >= 140) brightCount++;
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
    left: Math.max(0, left - 4),
    right: Math.min(width - 1, right + 4),
    top: Math.max(0, top - 4),
    bottom: Math.min(height - 1, bottom + 4),
  };
}

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
  missingCornersError?: boolean;
  geometryWarning?: string;
} {
  const paperBox = optionalGray
    ? detectWhitePaperBoundingBox(optionalGray, width, height)
    : { left: 0, right: width - 1, top: 0, bottom: height - 1 };

  const paperW = Math.max(120, paperBox.right - paperBox.left);
  const paperH = Math.max(120, paperBox.bottom - paperBox.top);

  const findCornerSquareCentroid = (
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
        if (innerDensity < 0.62) continue;

        const centerX = Math.round(x + patchSize / 2);
        const centerY = Math.round(y + patchSize / 2);

        let spanLeft = 0;
        while (spanLeft < patchSize * 1.45 && centerX - spanLeft >= 0 && binary[centerY * width + (centerX - spanLeft)] === 1) {
          spanLeft++;
        }
        let spanRight = 0;
        while (spanRight < patchSize * 1.45 && centerX + spanRight < width && binary[centerY * width + (centerX + spanRight)] === 1) {
          spanRight++;
        }
        let spanUp = 0;
        while (spanUp < patchSize * 1.45 && centerY - spanUp >= 0 && binary[(centerY - spanUp) * width + centerX] === 1) {
          spanUp++;
        }
        let spanDown = 0;
        while (spanDown < patchSize * 1.45 && centerY + spanDown < height && binary[(centerY + spanDown) * width + centerX] === 1) {
          spanDown++;
        }

        const blobW = Math.max(1, spanLeft + spanRight);
        const blobH = Math.max(1, spanUp + spanDown);
        const aspectRatio = blobW / blobH;
        if (aspectRatio < 0.75 || aspectRatio > 1.32) continue;

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
            const isBrightGray = optionalGray ? optionalGray[ry * width + rx] >= 130 : true;
            if (isWhiteBinary && isBrightGray) {
              ringWhiteCount++;
            }
          }
        }

        const quietZoneRatio = ringWhiteCount / Math.max(1, ringSamples);
        if (quietZoneRatio < 0.62) continue;

        const refinedCx = Math.round(centerX + (spanRight - spanLeft) * 0.5);
        const refinedCy = Math.round(centerY + (spanDown - spanUp) * 0.5);

        const distToCorner = Math.hypot(refinedCx - targetCornerX, refinedCy - targetCornerY);
        const maxDist = Math.hypot(paperW, paperH);
        const proximityScore = 1 - distToCorner / maxDist;
        const squarenessScore = 1 - Math.min(0.4, Math.abs(1 - aspectRatio));

        const totalScore =
          innerDensity * 0.3 +
          quietZoneRatio * 0.3 +
          proximityScore * 0.25 +
          squarenessScore * 0.15;

        if (!bestCandidate || totalScore > bestCandidate.score) {
          bestCandidate = { x: refinedCx, y: refinedCy, score: totalScore };
        }
      }
    }

    return bestCandidate ? { x: bestCandidate.x, y: bestCandidate.y } : null;
  };

  const searchW = Math.floor(paperW * 0.18);
  const searchH = Math.floor(paperH * 0.16);

  const tl = findCornerSquareCentroid(
    paperBox.left + 2,
    paperBox.left + searchW,
    paperBox.top + 2,
    paperBox.top + searchH,
    paperBox.left,
    paperBox.top
  );

  const tr = findCornerSquareCentroid(
    paperBox.right - searchW,
    paperBox.right - 2,
    paperBox.top + 2,
    paperBox.top + searchH,
    paperBox.right,
    paperBox.top
  );

  const br = findCornerSquareCentroid(
    paperBox.right - searchW,
    paperBox.right - 2,
    paperBox.bottom - searchH,
    paperBox.bottom - 2,
    paperBox.right,
    paperBox.bottom
  );

  const bl = findCornerSquareCentroid(
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

    if (
      widthRatio >= 0.78 &&
      heightRatio >= 0.78 &&
      topEdge > width * 0.45 &&
      leftEdge > height * 0.52
    ) {
      return {
        topLeft: tl,
        topRight: tr,
        bottomRight: br,
        bottomLeft: bl,
        detected: true,
        missingCornersError: false,
      };
    }
  }

  const missingList: string[] = [];
  if (!tl) missingList.push("Trên-Trái");
  if (!tr) missingList.push("Trên-Phải");
  if (!bl) missingList.push("Dưới-Trái");
  if (!br) missingList.push("Dưới-Phải");

  return {
    topLeft: tl || { x: Math.round(paperBox.left + paperW * 0.035), y: Math.round(paperBox.top + paperH * 0.025) },
    topRight: tr || { x: Math.round(paperBox.right - paperW * 0.035), y: Math.round(paperBox.top + paperH * 0.025) },
    bottomRight: br || { x: Math.round(paperBox.right - paperW * 0.035), y: Math.round(paperBox.bottom - paperH * 0.025) },
    bottomLeft: bl || { x: Math.round(paperBox.left + paperW * 0.035), y: Math.round(paperBox.bottom - paperH * 0.025) },
    detected: false,
    missingCornersError: true,
    geometryWarning: `⚠️ CẢNH BÁO: Ảnh chụp bị thiếu mốc góc định vị (${missingList.join(", ") || "méo tỷ lệ khung"}). Vui lòng dùng chuột KÉO 4 CHỐT GHIM MÀU XANH trên ảnh vào đúng 4 góc phiếu rồi bấm [⚡ Nắn phẳng & Quét lại], hoặc chụp lại đủ 4 góc!`,
  };
}

export function solvePerspectiveHomography3x3(
  dstPts: [OMRCornerPoint, OMRCornerPoint, OMRCornerPoint, OMRCornerPoint],
  srcPts: [OMRCornerPoint, OMRCornerPoint, OMRCornerPoint, OMRCornerPoint]
): number[] {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const x = dstPts[i].x;
    const y = dstPts[i].y;
    const u = srcPts[i].x;
    const v = srcPts[i].y;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }

  const n = 8;
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(A[col][col]);
    for (let row = col + 1; row < n; row++) {
      const absVal = Math.abs(A[row][col]);
      if (absVal > maxVal) {
        maxVal = absVal;
        maxRow = row;
      }
    }

    if (maxRow !== col) {
      const tmp = A[col];
      A[col] = A[maxRow];
      A[maxRow] = tmp;
    }

    const pivot = A[col][col];
    if (Math.abs(pivot) < 1e-10) continue;

    for (let j = col; j <= n; j++) {
      A[col][j] /= pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = A[row][col];
      if (Math.abs(factor) < 1e-12) continue;
      for (let j = col; j <= n; j++) {
        A[row][j] -= factor * A[col][j];
      }
    }
  }

  return [
    A[0][8],
    A[1][8],
    A[2][8],
    A[3][8],
    A[4][8],
    A[5][8],
    A[6][8],
    A[7][8],
    1,
  ];
}

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

  const dstTargets: [OMRCornerPoint, OMRCornerPoint, OMRCornerPoint, OMRCornerPoint] = [
    CANONICAL_CORNER_TARGETS.topLeft,
    CANONICAL_CORNER_TARGETS.topRight,
    CANONICAL_CORNER_TARGETS.bottomRight,
    CANONICAL_CORNER_TARGETS.bottomLeft,
  ];

  const srcCorners: [OMRCornerPoint, OMRCornerPoint, OMRCornerPoint, OMRCornerPoint] = [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ];

  const H = solvePerspectiveHomography3x3(dstTargets, srcCorners);
  const h00 = H[0], h01 = H[1], h02 = H[2];
  const h10 = H[3], h11 = H[4], h12 = H[5];
  const h20 = H[6], h21 = H[7];

  for (let y = 0; y < dstHeight; y++) {
    const rowBaseX = h01 * y + h02;
    const rowBaseY = h11 * y + h12;
    const rowBaseW = h21 * y + 1.0;

    for (let x = 0; x < dstWidth; x++) {
      const w = h20 * x + rowBaseW;
      const invW = Math.abs(w) > 1e-8 ? 1.0 / w : 1.0;
      const srcX = (h00 * x + rowBaseX) * invW;
      const srcY = (h10 * x + rowBaseY) * invW;

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

function measureTimingTrackVerticalOffset(
  binary: Uint8Array,
  width: number,
  height: number
): number {
  const expectedYs = [232, 258, 284, 310, 336, 362, 388, 414, 440, 466];
  const diffs: number[] = [];

  for (const expY of expectedYs) {
    let bestY = expY;
    let maxDark = 0;
    for (let dy = -12; dy <= 12; dy++) {
      const y = expY + dy;
      if (y < 5 || y >= height - 5) continue;
      let darkCount = 0;
      for (let py = -3; py <= 3; py++) {
        const rowOff = (y + py) * width;
        for (let x = 1142; x <= 1164; x++) {
          if (x < width && binary[rowOff + x] === 1) darkCount++;
        }
      }
      if (darkCount > maxDark) {
        maxDark = darkCount;
        bestY = y;
      }
    }
    if (maxDark >= 35) {
      diffs.push(bestY - expY);
    }
  }

  if (diffs.length < 4) return 0;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)];
}

function snapSubGridOffsetToBubbleCentroids(
  binary: Uint8Array,
  gray: Uint8Array,
  width: number,
  height: number,
  sampleCenters: { x: number; y: number; r: number }[],
  maxShiftX: number = 14,
  maxShiftY: number = 14
): { dx: number; dy: number } {
  if (sampleCenters.length === 0) return { dx: 0, dy: 0 };

  let bestDx = 0;
  let bestDy = 0;
  let bestContrastScore = -1;

  for (let dy = -maxShiftY; dy <= maxShiftY; dy += 2) {
    for (let dx = -maxShiftX; dx <= maxShiftX; dx += 2) {
      let score = 0;
      for (let i = 0; i < sampleCenters.length; i++) {
        const c = sampleCenters[i];
        const cx = Math.round(c.x + dx);
        const cy = Math.round(c.y + dy);
        if (cx < 10 || cx >= width - 10 || cy < 10 || cy >= height - 10) continue;

        const centerIdx = cy * width + cx;
        const darkVal = 255 - gray[centerIdx];
        if (darkVal > 75) {
          score += darkVal * (binary[centerIdx] === 1 ? 1.5 : 0.8);
        }
      }
      const penalty = (Math.abs(dx) + Math.abs(dy)) * 1.2;
      const total = score - penalty;
      if (total > bestContrastScore) {
        bestContrastScore = total;
        bestDx = dx;
        bestDy = dy;
      }
    }
  }

  return { dx: bestDx, dy: bestDy };
}

export function measureBubbleWithLocalPeak(
  binary: Uint8Array,
  gray: Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number
): { density: number; peakX: number; peakY: number } {
  const sampleAtPoint = (cx: number, cy: number): number => {
    const rInner = Math.max(3, radius * 0.78);
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
          const grayDarkness = Math.max(0, (218 - gray[idx]) / 218);
          weightedDarkSum += isBinaryDark * 0.65 + grayDarkness * 0.35;
        }
      }
    }

    if (totalSamples === 0) return 0;
    return weightedDarkSum / totalSamples;
  };

  let bestDensity = sampleAtPoint(centerX, centerY);
  let bestX = centerX;
  let bestY = centerY;

  if (bestDensity >= 0.14) {
    const offsets = [-3, -1.5, 0, 1.5, 3];
    for (const ox of offsets) {
      for (const oy of offsets) {
        if (ox === 0 && oy === 0) continue;
        const d = sampleAtPoint(centerX + ox, centerY + oy);
        if (d > bestDensity) {
          bestDensity = d;
          bestX = centerX + ox;
          bestY = centerY + oy;
        }
      }
    }
  }

  return {
    density: Number(Math.min(1, bestDensity).toFixed(3)),
    peakX: Math.round(bestX * 10) / 10,
    peakY: Math.round(bestY * 10) / 10,
  };
}

export function measureBubbleDensity(
  binary: Uint8Array,
  gray: Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radius: number
): number {
  return measureBubbleWithLocalPeak(binary, gray, width, height, centerX, centerY, radius)
    .density;
}

function pickDominantBubble<T extends { key: string; density: number }>(
  candidates: T[],
  minThreshold: number = MIN_FILLED_DENSITY,
  dominanceRatioRequired: number = RELATIVE_DOMINANCE_RATIO
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

  const ratio = second.density > 0.04 ? top.density / second.density : 99;
  const diff = top.density - second.density;

  if (
    second.density >= STRONG_FILLED_DENSITY &&
    diff < AMBIGUOUS_DIFF_THRESHOLD &&
    ratio < dominanceRatioRequired
  ) {
    return { selected: top, isAmbiguous: true };
  }

  if (top.density >= STRONG_FILLED_DENSITY || ratio >= dominanceRatioRequired) {
    return { selected: top, isAmbiguous: false };
  }

  return { selected: null, isAmbiguous: false };
}

export function scanOMRSheetFromCanvas(
  sourceCanvasOrImageData: HTMLCanvasElement | ImageData,
  blueprintOrExam?: OMRTemplateBlueprint | any,
  targetPageIndex: number = 1,
  customCorners?: CustomFourCornersInput | null
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

  const cornerResult = customCorners
    ? {
        topLeft: customCorners.topLeft,
        topRight: customCorners.topRight,
        bottomRight: customCorners.bottomRight,
        bottomLeft: customCorners.bottomLeft,
        detected: true,
        missingCornersError: false,
        geometryWarning: undefined,
      }
    : detectOMRCornerMarkers(
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
        warpedDataUrl = tempCanvas.toDataURL("image/jpeg", 0.9);
      }
    } catch {}
  }

  const canonicalMask = computeAdaptiveBinaryMask(warpedImageData);
  const { binary, gray, width, height } = canonicalMask;

  const timingTrackDy = measureTimingTrackVerticalOffset(binary, width, height);

  const bubbleCoordinates: OMRBubbleCoordinate[] = [];
  const flaggedQuestionsSet = new Set<number>();
  let confidenceSum = 0;
  let confidenceCount = 0;

  // 1. QUÉT KHUNG SỐ BÁO DANH (6 CỘT x 10 HÀNG)
  const sbdDigits: string[] = [];
  if (targetPageIndex === 1) {
    const sbdPreviewCenters: { x: number; y: number; r: number }[] = [];
    for (let col = 0; col < blueprint.sbd.cols; col++) {
      for (let digit = 0; digit <= 9; digit++) {
        sbdPreviewCenters.push({
          x: blueprint.sbd.startX + col * blueprint.sbd.colStep,
          y: blueprint.sbd.startY + digit * blueprint.sbd.rowStep + timingTrackDy,
          r: blueprint.sbd.radius,
        });
      }
    }
    const sbdShift = snapSubGridOffsetToBubbleCentroids(
      binary,
      gray,
      width,
      height,
      sbdPreviewCenters,
      10,
      10
    );

    for (let col = 0; col < blueprint.sbd.cols; col++) {
      const theoreticalCx =
        blueprint.sbd.startX + col * blueprint.sbd.colStep + sbdShift.dx;
      const colCandidates: {
        key: string;
        density: number;
        x: number;
        y: number;
      }[] = [];

      for (let digit = 0; digit <= 9; digit++) {
        const theoreticalCy =
          blueprint.sbd.startY +
          digit * blueprint.sbd.rowStep +
          timingTrackDy +
          sbdShift.dy;
        const measured = measureBubbleWithLocalPeak(
          binary,
          gray,
          width,
          height,
          theoreticalCx,
          theoreticalCy,
          blueprint.sbd.radius
        );
        colCandidates.push({
          key: String(digit),
          density: measured.density,
          x: measured.peakX,
          y: measured.peakY,
        });
      }

      const { selected } = pickDominantBubble(
        colCandidates,
        0.21,
        SBD_DOMINANCE_RATIO
      );
      sbdDigits.push(selected ? selected.key : "");

      colCandidates.forEach((cand) => {
        const isSel = selected?.key === cand.key;
        bubbleCoordinates.push({
          id: `sbd-col${col}-${cand.key}`,
          pageIndex: 1,
          section: "sbd",
          optionKey: cand.key,
          x: isSel ? cand.x : Math.round(theoreticalCx * 10) / 10,
          y: cand.y,
          r: blueprint.sbd.radius,
          density: cand.density,
          isSelected: isSel,
          status: isSel ? "detected" : "unfilled",
        });
      });
    }
  }

  // 2. QUÉT KHUNG MÃ ĐỀ THI (3 CỘT x 10 HÀNG)
  const examCodeDigits: string[] = [];
  if (targetPageIndex === 1) {
    const codePreviewCenters: { x: number; y: number; r: number }[] = [];
    for (let col = 0; col < blueprint.examCode.cols; col++) {
      for (let digit = 0; digit <= 9; digit++) {
        codePreviewCenters.push({
          x: blueprint.examCode.startX + col * blueprint.examCode.colStep,
          y: blueprint.examCode.startY + digit * blueprint.examCode.rowStep + timingTrackDy,
          r: blueprint.examCode.radius,
        });
      }
    }
    const codeShift = snapSubGridOffsetToBubbleCentroids(
      binary,
      gray,
      width,
      height,
      codePreviewCenters,
      10,
      10
    );

    for (let col = 0; col < blueprint.examCode.cols; col++) {
      const theoreticalCx =
        blueprint.examCode.startX + col * blueprint.examCode.colStep + codeShift.dx;
      const colCandidates: {
        key: string;
        density: number;
        x: number;
        y: number;
      }[] = [];

      for (let digit = 0; digit <= 9; digit++) {
        const theoreticalCy =
          blueprint.examCode.startY +
          digit * blueprint.examCode.rowStep +
          timingTrackDy +
          codeShift.dy;
        const measured = measureBubbleWithLocalPeak(
          binary,
          gray,
          width,
          height,
          theoreticalCx,
          theoreticalCy,
          blueprint.examCode.radius
        );
        colCandidates.push({
          key: String(digit),
          density: measured.density,
          x: measured.peakX,
          y: measured.peakY,
        });
      }

      const { selected } = pickDominantBubble(
        colCandidates,
        0.21,
        SBD_DOMINANCE_RATIO
      );
      examCodeDigits.push(selected ? selected.key : "");

      colCandidates.forEach((cand) => {
        const isSel = selected?.key === cand.key;
        bubbleCoordinates.push({
          id: `code-col${col}-${cand.key}`,
          pageIndex: 1,
          section: "exam_code",
          optionKey: cand.key,
          x: isSel ? cand.x : Math.round(theoreticalCx * 10) / 10,
          y: cand.y,
          r: blueprint.examCode.radius,
          density: cand.density,
          isSelected: isSel,
          status: isSel ? "detected" : "unfilled",
        });
      });
    }
  }

  // 3. QUÉT PHẦN I: TRẮC NGHIỆM 4 PHƯƠNG ÁN (A, B, C, D)
  const part1Answers: Record<number, string> = {};
  const optionKeys = ["A", "B", "C", "D"];

  blueprint.part1.blocks
    .filter((b) => (b.pageIndex || 1) === targetPageIndex)
    .forEach((block) => {
      const p1PreviewCenters: { x: number; y: number; r: number }[] = [];
      for (let qNum = block.startQuestion; qNum <= block.endQuestion; qNum++) {
        const rowIdx = qNum - block.startQuestion;
        const cy = block.startY + rowIdx * block.rowStepY;
        optionKeys.forEach((_, optIdx) => {
          p1PreviewCenters.push({
            x: block.startX + optIdx * block.optionStepX,
            y: cy,
            r: block.radius,
          });
        });
      }

      const p1Shift = snapSubGridOffsetToBubbleCentroids(
        binary,
        gray,
        width,
        height,
        p1PreviewCenters,
        12,
        12
      );

      for (let qNum = block.startQuestion; qNum <= block.endQuestion; qNum++) {
        const rowIdx = qNum - block.startQuestion;
        const theoreticalCy = block.startY + rowIdx * block.rowStepY + p1Shift.dy;
        const rowCandidates: {
          key: string;
          density: number;
          x: number;
          y: number;
        }[] = [];

        optionKeys.forEach((optKey, optIdx) => {
          const theoreticalCx = block.startX + optIdx * block.optionStepX + p1Shift.dx;
          const measured = measureBubbleWithLocalPeak(
            binary,
            gray,
            width,
            height,
            theoreticalCx,
            theoreticalCy,
            block.radius
          );
          rowCandidates.push({
            key: optKey,
            density: measured.density,
            x: measured.peakX,
            y: measured.peakY,
          });
        });

        const { selected, isAmbiguous } = pickDominantBubble(
          rowCandidates,
          MIN_FILLED_DENSITY
        );
        if (selected) {
          part1Answers[qNum] = selected.key;
          confidenceSum += isAmbiguous ? 68 : Math.min(100, 78 + selected.density * 32);
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
            y: cand.y,
            r: block.radius,
            density: cand.density,
            isSelected: isSel,
            status: isAmbiguous && isSel ? "ambiguous" : isSel ? "detected" : "unfilled",
          });
        });
      }
    });

  // 4. QUÉT PHẦN II: TRẮC NGHIỆM ĐÚNG / SAI (4 Ý a, b, c, d)
  const part2Answers: Record<number, Record<"a" | "b" | "c" | "d", boolean | null>> = {};
  const subKeys: ("a" | "b" | "c" | "d")[] = ["a", "b", "c", "d"];
  const p1Offset = blueprint.part1TotalQuestions ?? 40;

  blueprint.part2.blocks
    .filter((b) => (b.pageIndex || 1) === targetPageIndex)
    .forEach((block) => {
      const qNum = block.questionNumber;
      const globalQOrder = p1Offset + qNum;
      part2Answers[qNum] = { a: null, b: null, c: null, d: null };

      const p2PreviewCenters: { x: number; y: number; r: number }[] = [];
      subKeys.forEach((_, subIdx) => {
        const cy = block.startY + subIdx * block.rowStepY;
        p2PreviewCenters.push({ x: block.trueX, y: cy, r: block.radius });
        p2PreviewCenters.push({ x: block.falseX, y: cy, r: block.radius });
      });

      const p2Shift = snapSubGridOffsetToBubbleCentroids(
        binary,
        gray,
        width,
        height,
        p2PreviewCenters,
        12,
        12
      );

      subKeys.forEach((subK, subIdx) => {
        const theoreticalCy = block.startY + subIdx * block.rowStepY + p2Shift.dy;
        const measuredTrue = measureBubbleWithLocalPeak(
          binary,
          gray,
          width,
          height,
          block.trueX + p2Shift.dx,
          theoreticalCy,
          block.radius
        );
        const measuredFalse = measureBubbleWithLocalPeak(
          binary,
          gray,
          width,
          height,
          block.falseX + p2Shift.dx,
          theoreticalCy,
          block.radius
        );

        const pairCandidates = [
          { key: "T", density: measuredTrue.density, x: measuredTrue.peakX, y: measuredTrue.peakY },
          { key: "F", density: measuredFalse.density, x: measuredFalse.peakX, y: measuredFalse.peakY },
        ];

        const { selected, isAmbiguous } = pickDominantBubble(
          pairCandidates,
          MIN_FILLED_DENSITY
        );
        if (selected) {
          part2Answers[qNum][subK] = selected.key === "T";
          confidenceSum += isAmbiguous ? 68 : Math.min(100, 78 + selected.density * 32);
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
            y: cand.y,
            r: block.radius,
            density: cand.density,
            isSelected: isSel,
            status: isAmbiguous && isSel ? "ambiguous" : isSel ? "detected" : "unfilled",
          });
        });
      });
    });

  // 5. QUÉT PHẦN III: TRẢ LỜI NGẮN (4 CỘT SỐ MỖI CÂU)
  const part3Answers: Record<number, string> = {};
  const p2Offset = p1Offset + (blueprint.part2TotalQuestions ?? 8);

  blueprint.part3.blocks
    .filter((b) => (b.pageIndex || 1) === targetPageIndex)
    .forEach((block) => {
      const qNum = block.questionNumber;
      const globalQOrder = p2Offset + qNum;
      const chars: string[] = [];

      const p3PreviewCenters: { x: number; y: number; r: number }[] = [];
      for (let col = 0; col < 4; col++) {
        const cx = block.startX + col * block.colStepX;
        for (let d = 0; d <= 9; d++) {
          p3PreviewCenters.push({
            x: cx,
            y: block.digit0Y + d * block.rowStepY,
            r: block.radius,
          });
        }
      }

      const p3Shift = snapSubGridOffsetToBubbleCentroids(
        binary,
        gray,
        width,
        height,
        p3PreviewCenters,
        12,
        12
      );

      for (let col = 0; col < 4; col++) {
        const theoreticalCx = block.startX + col * block.colStepX + p3Shift.dx;
        const colCandidates: {
          key: string;
          density: number;
          x: number;
          y: number;
        }[] = [];

        if (col === 0) {
          const mMinus = measureBubbleWithLocalPeak(
            binary,
            gray,
            width,
            height,
            theoreticalCx,
            block.minusY + p3Shift.dy,
            block.radius
          );
          colCandidates.push({
            key: "-",
            density: mMinus.density,
            x: mMinus.peakX,
            y: mMinus.peakY,
          });
        }

        if (col === 1 || col === 2) {
          const mComma = measureBubbleWithLocalPeak(
            binary,
            gray,
            width,
            height,
            theoreticalCx,
            block.commaY + p3Shift.dy,
            block.radius
          );
          colCandidates.push({
            key: ",",
            density: mComma.density,
            x: mComma.peakX,
            y: mComma.peakY,
          });
        }

        for (let digit = 0; digit <= 9; digit++) {
          const theoreticalCy = block.digit0Y + digit * block.rowStepY + p3Shift.dy;
          const mDigit = measureBubbleWithLocalPeak(
            binary,
            gray,
            width,
            height,
            theoreticalCx,
            theoreticalCy,
            block.radius
          );
          colCandidates.push({
            key: String(digit),
            density: mDigit.density,
            x: mDigit.peakX,
            y: mDigit.peakY,
          });
        }

        const { selected, isAmbiguous } = pickDominantBubble(
          colCandidates,
          MIN_FILLED_DENSITY
        );
        if (selected) {
          chars.push(selected.key);
          confidenceSum += isAmbiguous ? 68 : Math.min(100, 78 + selected.density * 32);
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
            x: cand.x,
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
    confidenceCount > 0 ? Number((confidenceSum / confidenceCount).toFixed(1)) : 98.0;

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
            b.isSelected = true;
          } else if (b.optionKey === expectedOpt && !isRight) {
            b.status = "expected_missed";
            b.isSelected = false;
          } else {
            b.status = "unfilled";
            b.isSelected = false;
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
 * DỰNG MÃ SVG VECTOR SẮC NÉT CHO BANNER HEADER TCT & BANNER FOOTER TCT
 */
function renderTCTHeaderAndFooterSVG(pageIdx: number): string {
  const SERIF = "'Times New Roman', Times, serif";
  return `
    <!-- BANNER HEADER TCT Ở ĐẦU TRANG -->
    <g transform="translate(65, 20)">
      <polygon points="8,14 146,14 132,70 0,70" fill="#F58220" />
      <polygon points="0,4 136,4 123,60 0,60" fill="#FFFFFF" stroke="#003399" stroke-width="2.2" />
      <text x="64" y="40" font-family="Arial, sans-serif" font-size="30" font-weight="900" text-anchor="middle" fill="#003399" letter-spacing="1">TCT</text>
      <text x="63" y="54" font-family="Arial, sans-serif" font-size="9" font-weight="900" text-anchor="middle" fill="#003399" letter-spacing="1.2">TÂM CHÍ TÀI</text>

      <text x="365" y="44" font-family="${SERIF}" font-size="18" font-style="italic" font-weight="bold" text-anchor="middle" fill="#003399">Chuyên luyện thi vào 10, HSA, TSA và THPT</text>

      <polygon points="575,26 618,26 603,60 560,60" fill="#F58220" />
      <polygon points="632,26 675,26 660,60 617,60" fill="#F58220" />

      <polygon points="692,26 1068,26 1068,60 677,60" fill="#FFFFFF" stroke="#003399" stroke-width="2" />
      <text x="875" y="48" font-family="${SERIF}" font-size="16.5" font-style="italic" font-weight="bold" text-anchor="middle" fill="#003399">Chuyên Toán Tư Duy - Trắc Nghiệm Tia Chớp</text>
    </g>

    <!-- BANNER FOOTER TCT Ở CUỐI TRANG -->
    <g transform="translate(65, 1632)">
      <circle cx="88" cy="18" r="12" fill="none" stroke="#003399" stroke-width="1.6" />
      <path d="M83,12 C85,10 87,13 86,15 C85,17 88,20 90,19 C92,18 95,20 93,22 C90,25 81,16 83,12 Z" fill="#003399" />
      <text x="108" y="24" font-family="${SERIF}" font-size="17" font-weight="bold" fill="#003399">0972 26 16 16</text>

      <circle cx="328" cy="18" r="12" fill="#003399" />
      <polygon points="328,10 320,17 323,17 323,24 333,24 333,17 336,17" fill="#FFFFFF" />
      <text x="348" y="24" font-family="${SERIF}" font-size="17" font-weight="bold" fill="#003399">Số 10, Tạ Quang Bửu, Bách Khoa, Hà Nội</text>

      <polygon points="828,2 850,2 836,36 814,36" fill="#F58220" />
      <polygon points="852,2 1068,2 1068,36 838,36" fill="#FFFFFF" stroke="#003399" stroke-width="2" />
      <text x="905" y="25" font-family="${SERIF}" font-size="20" font-weight="bold" text-anchor="middle" fill="#0033CC">${pageIdx}</text>
    </g>
  `;
}

/**
 * DỰNG MÃ SVG CHO TỪNG TRANG A4 (ĐỒNG BỘ 100% PHONG CÁCH GỐC BỘ GD&ĐT, FONT TIMES NEW ROMAN,
 * HỘP ĐÔI PHẦN II [CÂU 1 | CÂU 2] VÀ HÀNG 4 Ô VUÔNG VIẾT TAY ĐÁP SỐ PHẦN III)
 */
export function generatePrintableAnswerSheetPagesSVG(examOrConfig?: any): string[] {
  const resolved = resolveCompleteExamObject(examOrConfig);
  const blueprint = buildDynamicOMRBlueprint(resolved);
  const W = OMR_CANONICAL_WIDTH;
  const H = OMR_CANONICAL_HEIGHT;
  const corners = CANONICAL_CORNER_TARGETS;

  const SERIF = "'Times New Roman', Times, serif";
  // Sử dụng biến CSS var(--omr-stroke) để người dùng có thể đổi nhanh giữa màu Đỏ Hồng Bộ GD&ĐT (#BE185D) và màu Đen (#111827) ngay trên cửa sổ in
  const LINE_COLOR = "var(--omr-stroke, #BE185D)";
  const TEXT_DARK = "#111827";

  const rawTitle =
    resolved?.examTitle ||
    resolved?.title ||
    "KỲ THI TỐT NGHIỆP TRUNG HỌC PHỔ THÔNG";
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

    // 1. 4 Mốc vuông đen định vị góc chuẩn A4 (Luôn tô đen #000000 để OMR bắt góc)
    const markerSize = 30;
    [
      corners.topLeft,
      corners.topRight,
      corners.bottomRight,
      corners.bottomLeft,
    ].forEach((pt) => {
      svgElements += `<rect x="${pt.x - markerSize / 2}" y="${pt.y - markerSize / 2}" width="${markerSize}" height="${markerSize}" fill="#000000" />`;
    });

    // 2. Dải vạch nhịp bước (Timing Tracks) dọc mép phải
    for (let ty = 232; ty <= 466; ty += 26) {
      svgElements += `<rect x="1146" y="${ty - 3.5}" width="16" height="7" fill="#000000" />`;
    }

    // 3. Banner Header & Footer TCT
    svgElements += renderTCTHeaderAndFooterSVG(pageIdx);

    if (pageIdx === 1) {
      // ================= HEADER & KHUNG THÔNG TIN TRANG 1 CHUẨN GỐC BỘ GD&ĐT =================
      svgElements += `
        <text x="420" y="114" font-family="${SERIF}" font-size="23" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">PHIẾU TRẢ LỜI TRẮC NGHIỆM</text>
        <text x="420" y="140" font-family="${SERIF}" font-size="15.5" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">Kỳ thi: ${safeTitle}</text>

        <!-- Khung Thông Tin Học Sinh & Giám Thị nguyên bản 100% mẫu Bộ GD&ĐT -->
        <rect x="65" y="156" width="710" height="330" fill="none" stroke="${LINE_COLOR}" stroke-width="1" />
        <line x1="255" y1="156" x2="255" y2="486" stroke="${LINE_COLOR}" stroke-width="0.9" />
        <line x1="65" y1="321" x2="255" y2="321" stroke="${LINE_COLOR}" stroke-width="0.9" />

        <text x="160" y="180" font-family="${SERIF}" font-size="13" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">Họ tên, chữ ký Giám thị 1</text>
        <text x="160" y="345" font-family="${SERIF}" font-size="13" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">Họ tên, chữ ký Giám thị 2</text>

        <text x="272" y="195" font-family="${SERIF}" font-size="14" fill="${TEXT_DARK}">1. Hội đồng thi: ............................................................................</text>
        <text x="272" y="242" font-family="${SERIF}" font-size="14" fill="${TEXT_DARK}">2. Điểm thi: ...................................................................................</text>
        <text x="272" y="289" font-family="${SERIF}" font-size="14" fill="${TEXT_DARK}">3. Phòng thi số: ............................................................................</text>
        <text x="272" y="336" font-family="${SERIF}" font-size="14" fill="${TEXT_DARK}">4. Họ và tên thí sinh: ${presetName ? `<tspan font-weight="bold">${presetName}</tspan>` : "...................................................................."}</text>
        <text x="272" y="383" font-family="${SERIF}" font-size="14" fill="${TEXT_DARK}">5. Ngày sinh: ........../........../20........   (Nam / Nữ)</text>
        <text x="272" y="430" font-family="${SERIF}" font-size="14" fill="${TEXT_DARK}">6. Chữ ký của thí sinh: ................................................................</text>

        <text x="420" y="510" font-family="${SERIF}" font-size="13" font-style="italic" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">Chú ý: Giữ cho phiếu phẳng, không bôi bẩn, không làm rách. Tô kín ô tròn bằng bút chì đen.</text>
      `;

      // Mục 7. Số báo danh (Có kẻ lưới ca-rô mảnh bao quanh từng ô tròn như Ảnh 2)
      const sbdLeft = blueprint.sbd.startX - 14;
      const sbdWidth = blueprint.sbd.cols * blueprint.sbd.colStep;
      const sbdGridTop = blueprint.sbd.startY - 13;
      const sbdGridHeight = 10 * blueprint.sbd.rowStep;

      svgElements += `
        <text x="${sbdLeft + sbdWidth / 2}" y="148" font-family="${SERIF}" font-size="14" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">7. Số báo danh</text>
        <rect x="${sbdLeft}" y="156" width="${sbdWidth}" height="34" fill="none" stroke="${LINE_COLOR}" stroke-width="1" />
        <rect x="${sbdLeft}" y="${sbdGridTop}" width="${sbdWidth}" height="${sbdGridHeight}" fill="none" stroke="${LINE_COLOR}" stroke-width="1" />
      `;
      for (let r = 1; r < 10; r++) {
        const ry = sbdGridTop + r * blueprint.sbd.rowStep;
        svgElements += `<line x1="${sbdLeft}" y1="${ry}" x2="${sbdLeft + sbdWidth}" y2="${ry}" stroke="${LINE_COLOR}" stroke-width="0.65" />`;
      }
      for (let c = 0; c < blueprint.sbd.cols; c++) {
        const cx = blueprint.sbd.startX + c * blueprint.sbd.colStep;
        if (c > 0) {
          const vx = sbdLeft + c * blueprint.sbd.colStep;
          svgElements += `
            <line x1="${vx}" y1="156" x2="${vx}" y2="190" stroke="${LINE_COLOR}" stroke-width="0.75" />
            <line x1="${vx}" y1="${sbdGridTop}" x2="${vx}" y2="${sbdGridTop + sbdGridHeight}" stroke="${LINE_COLOR}" stroke-width="0.65" />
          `;
        }
        const presetDigit = presetSbd[c] || "";
        if (presetDigit) {
          svgElements += `<text x="${cx}" y="179" font-family="${SERIF}" font-size="16" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">${presetDigit}</text>`;
        }
        for (let d = 0; d <= 9; d++) {
          const cy = blueprint.sbd.startY + d * blueprint.sbd.rowStep;
          const isPreFilled = presetDigit === String(d);
          svgElements += `
            <circle cx="${cx}" cy="${cy}" r="${blueprint.sbd.radius}" fill="${isPreFilled ? "#111827" : "none"}" stroke="${LINE_COLOR}" stroke-width="0.9" />
            <text x="${cx}" y="${cy + 3.5}" font-family="${SERIF}" font-size="10.5" font-weight="bold" text-anchor="middle" fill="${isPreFilled ? "#FFFFFF" : LINE_COLOR}">${d}</text>
          `;
        }
      }

      // Mục 8. Mã đề thi (Có kẻ lưới ca-rô mảnh bao quanh từng ô tròn như Ảnh 2)
      const codeLeft = blueprint.examCode.startX - 14;
      const codeWidth = blueprint.examCode.cols * blueprint.examCode.colStep;
      const codeGridTop = blueprint.examCode.startY - 13;
      const codeGridHeight = 10 * blueprint.examCode.rowStep;

      svgElements += `
        <text x="${codeLeft + codeWidth / 2}" y="148" font-family="${SERIF}" font-size="14" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">8. Mã đề thi</text>
        <rect x="${codeLeft}" y="156" width="${codeWidth}" height="34" fill="none" stroke="${LINE_COLOR}" stroke-width="1" />
        <rect x="${codeLeft}" y="${codeGridTop}" width="${codeWidth}" height="${codeGridHeight}" fill="none" stroke="${LINE_COLOR}" stroke-width="1" />
      `;
      for (let r = 1; r < 10; r++) {
        const ry = codeGridTop + r * blueprint.examCode.rowStep;
        svgElements += `<line x1="${codeLeft}" y1="${ry}" x2="${codeLeft + codeWidth}" y2="${ry}" stroke="${LINE_COLOR}" stroke-width="0.65" />`;
      }
      for (let c = 0; c < blueprint.examCode.cols; c++) {
        const cx = blueprint.examCode.startX + c * blueprint.examCode.colStep;
        if (c > 0) {
          const vx = codeLeft + c * blueprint.examCode.colStep;
          svgElements += `
            <line x1="${vx}" y1="156" x2="${vx}" y2="190" stroke="${LINE_COLOR}" stroke-width="0.75" />
            <line x1="${vx}" y1="${codeGridTop}" x2="${vx}" y2="${codeGridTop + codeGridHeight}" stroke="${LINE_COLOR}" stroke-width="0.65" />
          `;
        }
        const presetCodeDigit = presetCode[c] || "";
        if (presetCodeDigit) {
          svgElements += `<text x="${cx}" y="179" font-family="${SERIF}" font-size="16" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">${presetCodeDigit}</text>`;
        }
        for (let d = 0; d <= 9; d++) {
          const cy = blueprint.examCode.startY + d * blueprint.examCode.rowStep;
          const isPreFilled = presetCodeDigit === String(d);
          svgElements += `
            <circle cx="${cx}" cy="${cy}" r="${blueprint.examCode.radius}" fill="${isPreFilled ? "#111827" : "none"}" stroke="${LINE_COLOR}" stroke-width="0.9" />
            <text x="${cx}" y="${cy + 3.5}" font-family="${SERIF}" font-size="10.5" font-weight="bold" text-anchor="middle" fill="${isPreFilled ? "#FFFFFF" : LINE_COLOR}">${d}</text>
          `;
        }
      }
    } else {
      // ================= SUB-HEADER TINH GỌN TRANG 2 =================
      svgElements += `
        <text x="600" y="122" font-family="${SERIF}" font-size="17" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">
          PHIẾU TRẢ LỜI TRẮC NGHIỆM — TRANG ${pageIdx} / ${totalPages}   •   ${safeTitle}   •   MÃ ĐỀ: ${presetCode}
        </text>
        <line x1="65" y1="136" x2="1133" y2="136" stroke="${LINE_COLOR}" stroke-width="1" />
      `;
    }

    // 4. Vẽ PHẦN I: Trắc nghiệm 4 phương án A, B, C, D
    const pageP1Blocks = blueprint.part1.blocks.filter(
      (b) => (b.pageIndex || 1) === pageIdx
    );
    if (pageP1Blocks.length > 0) {
      const firstBlockTopY = pageP1Blocks[0].startY - 42;

      svgElements += `
        <text x="65" y="${firstBlockTopY - 10}" font-family="${SERIF}" font-size="15.5" font-weight="bold" fill="${TEXT_DARK}">PHẦN I</text>
      `;

      const opts = ["A", "B", "C", "D"];
      pageP1Blocks.forEach((b) => {
        const boxLeft = b.startX - 48;
        const boxTop = b.startY - 42;
        const numRows = b.endQuestion - b.startQuestion + 1;
        const boxH = Math.max(66, numRows * b.rowStepY + 34);

        svgElements += `<rect x="${boxLeft}" y="${boxTop}" width="232" height="${boxH}" fill="none" stroke="${LINE_COLOR}" stroke-width="1" />`;
        opts.forEach((k, idx) => {
          const ox = b.startX + idx * b.optionStepX;
          svgElements += `<text x="${ox}" y="${b.startY - 20}" font-family="${SERIF}" font-size="13.5" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">${k}</text>`;
        });

        for (let q = b.startQuestion; q <= b.endQuestion; q++) {
          const rIdx = q - b.startQuestion;
          const cy = b.startY + rIdx * b.rowStepY;
          svgElements += `<text x="${b.startX - 28}" y="${cy + 4.5}" font-family="${SERIF}" font-size="13" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">${q}</text>`;
          opts.forEach((k, idx) => {
            const cx = b.startX + idx * b.optionStepX;
            svgElements += `
              <circle cx="${cx}" cy="${cy}" r="${b.radius}" fill="none" stroke="${LINE_COLOR}" stroke-width="0.9" />
              <text x="${cx}" y="${cy + 3.2}" font-family="${SERIF}" font-size="8.5" text-anchor="middle" fill="${LINE_COLOR}" opacity="0.55">${k}</text>
            `;
          });
        }
      });
    }

    // 5. Vẽ PHẦN II: Trắc nghiệm Đúng / Sai GHÉP CẶP ĐÔI [Câu 1 | Câu 2] chuẩn Ảnh 5 (image_d9f51d.png)
    const pageP2Blocks = blueprint.part2.blocks.filter(
      (b) => (b.pageIndex || 1) === pageIdx
    );
    if (pageP2Blocks.length > 0) {
      const firstY = pageP2Blocks[0].startY;
      svgElements += `
        <text x="65" y="${firstY - 56}" font-family="${SERIF}" font-size="15.5" font-weight="bold" fill="${TEXT_DARK}">PHẦN II</text>
      `;

      const subLabels = ["a)", "b)", "c)", "d)"];
      // Nhóm các câu theo từng hàng (startY) và ghép từng cặp 2 câu (2k, 2k+1) vào 1 khung chữ nhật vuông góc
      const rowYSet = Array.from(new Set(pageP2Blocks.map((b) => b.startY)));

      rowYSet.forEach((rowStartY) => {
        const blocksInRow = pageP2Blocks.filter((b) => b.startY === rowStartY);
        for (let i = 0; i < blocksInRow.length; i += 2) {
          const leftBlock = blocksInRow[i];
          const rightBlock = blocksInRow[i + 1];

          const pairBoxLeft = leftBlock.trueX - 53;
          const pairBoxTop = rowStartY - 48;
          const pairBoxWidth = rightBlock ? 214 : 118;
          const pairBoxHeight = 160;
          const dividerX = pairBoxLeft + 118;

          svgElements += `
            <rect x="${pairBoxLeft}" y="${pairBoxTop}" width="${pairBoxWidth}" height="${pairBoxHeight}" fill="none" stroke="${LINE_COLOR}" stroke-width="1" />
          `;

          if (rightBlock) {
            svgElements += `
              <line x1="${dividerX}" y1="${pairBoxTop}" x2="${dividerX}" y2="${pairBoxTop + pairBoxHeight}" stroke="${LINE_COLOR}" stroke-width="0.9" />
            `;
          }

          // Nhãn a), b), c), d) ở cột đầu tiên bên trái của mỗi hộp đôi
          subLabels.forEach((lbl, idx) => {
            const cy = rowStartY + idx * leftBlock.rowStepY;
            svgElements += `
              <text x="${leftBlock.trueX - 31}" y="${cy + 4.5}" font-family="${SERIF}" font-size="13.5" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">${lbl}</text>
            `;
          });

          // Vẽ câu bên trái của cặp
          const leftCenter = (leftBlock.trueX + leftBlock.falseX) / 2;
          svgElements += `
            <text x="${leftCenter}" y="${pairBoxTop + 19}" font-family="${SERIF}" font-size="13.5" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">Câu ${leftBlock.questionNumber}</text>
            <text x="${leftBlock.trueX}" y="${pairBoxTop + 37}" font-family="${SERIF}" font-size="11.5" text-anchor="middle" fill="${TEXT_DARK}">Đúng</text>
            <text x="${leftBlock.falseX}" y="${pairBoxTop + 37}" font-family="${SERIF}" font-size="11.5" text-anchor="middle" fill="${TEXT_DARK}">Sai</text>
          `;
          subLabels.forEach((_, idx) => {
            const cy = rowStartY + idx * leftBlock.rowStepY;
            svgElements += `
              <circle cx="${leftBlock.trueX}" cy="${cy}" r="${leftBlock.radius}" fill="none" stroke="${LINE_COLOR}" stroke-width="0.9" />
              <circle cx="${leftBlock.falseX}" cy="${cy}" r="${leftBlock.radius}" fill="none" stroke="${LINE_COLOR}" stroke-width="0.9" />
            `;
          });

          // Vẽ câu bên phải của cặp (nếu có)
          if (rightBlock) {
            const rightCenter = (rightBlock.trueX + rightBlock.falseX) / 2;
            svgElements += `
              <text x="${rightCenter}" y="${pairBoxTop + 19}" font-family="${SERIF}" font-size="13.5" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">Câu ${rightBlock.questionNumber}</text>
              <text x="${rightBlock.trueX}" y="${pairBoxTop + 37}" font-family="${SERIF}" font-size="11.5" text-anchor="middle" fill="${TEXT_DARK}">Đúng</text>
              <text x="${rightBlock.falseX}" y="${pairBoxTop + 37}" font-family="${SERIF}" font-size="11.5" text-anchor="middle" fill="${TEXT_DARK}">Sai</text>
            `;
            subLabels.forEach((_, idx) => {
              const cy = rowStartY + idx * rightBlock.rowStepY;
              svgElements += `
                <circle cx="${rightBlock.trueX}" cy="${cy}" r="${rightBlock.radius}" fill="none" stroke="${LINE_COLOR}" stroke-width="0.9" />
                <circle cx="${rightBlock.falseX}" cy="${cy}" r="${rightBlock.radius}" fill="none" stroke="${LINE_COLOR}" stroke-width="0.9" />
              `;
            });
          }
        }
      });
    }

    // 6. Vẽ PHẦN III: Trả lời ngắn CÓ HÀNG 4 Ô VUÔNG VIẾT TAY ĐÁP SỐ Ở ĐẦU MỖI CÂU chuẩn Ảnh 5 (image_d9f51d.png)
    const pageP3Blocks = blueprint.part3.blocks.filter(
      (b) => (b.pageIndex || 1) === pageIdx
    );
    if (pageP3Blocks.length > 0) {
      const firstMinusY = pageP3Blocks[0].minusY;
      const firstBoxTop = firstMinusY - 76;

      svgElements += `
        <text x="65" y="${firstBoxTop - 10}" font-family="${SERIF}" font-size="15.5" font-weight="bold" fill="${TEXT_DARK}">PHẦN III</text>
      `;

      // Nhóm theo từng hàng ngang
      const rowMinusYSet = Array.from(new Set(pageP3Blocks.map((b) => b.minusY)));

      rowMinusYSet.forEach((rMinusY) => {
        const blocksInRow = pageP3Blocks.filter((b) => b.minusY === rMinusY);
        const boxTop = rMinusY - 76;
        const boxHeight = 382;
        const cellW = blocksInRow[0]?.boxWidth || 178;
        const totalRowW = cellW * blocksInRow.length;

        // Khung bảng liền mạch bao ngoài hàng Phần III
        svgElements += `
          <rect x="65" y="${boxTop}" width="${totalRowW}" height="${boxHeight}" fill="none" stroke="${LINE_COLOR}" stroke-width="1" />
        `;

        blocksInRow.forEach((b, idxInRow) => {
          const cellLeft = 65 + idxInRow * cellW;
          if (idxInRow > 0) {
            svgElements += `
              <line x1="${cellLeft}" y1="${boxTop}" x2="${cellLeft}" y2="${boxTop + boxHeight}" stroke="${LINE_COLOR}" stroke-width="0.9" />
            `;
          }

          const q = b.questionNumber;
          const writeBoxTop = boxTop + 30;
          const writeBoxH = 25;
          const writeCellW = b.colStepX;
          const writeBoxLeft = b.startX - writeCellW / 2;
          const writeBoxTotalW = writeCellW * 4;

          // Tiêu đề "Câu X" và Hàng 4 ô vuông viết tay đáp số
          svgElements += `
            <text x="${cellLeft + 18}" y="${boxTop + 21}" font-family="${SERIF}" font-size="13.5" font-weight="bold" fill="${TEXT_DARK}">Câu ${q}</text>
            <rect x="${writeBoxLeft}" y="${writeBoxTop}" width="${writeBoxTotalW}" height="${writeBoxH}" fill="none" stroke="${LINE_COLOR}" stroke-width="0.9" />
          `;
          for (let c = 1; c < 4; c++) {
            const vx = writeBoxLeft + c * writeCellW;
            svgElements += `
              <line x1="${vx}" y1="${writeBoxTop}" x2="${vx}" y2="${writeBoxTop + writeBoxH}" stroke="${LINE_COLOR}" stroke-width="0.75" />
            `;
          }

          // Hàng dấu âm (-) và dấu phẩy (,)
          svgElements += `
            <text x="${b.startX - 20}" y="${b.minusY + 4}" font-family="${SERIF}" font-size="15" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">−</text>
            <circle cx="${b.startX}" cy="${b.minusY}" r="${b.radius}" fill="none" stroke="${LINE_COLOR}" stroke-width="0.9" />

            <text x="${b.startX - 20}" y="${b.commaY + 4}" font-family="${SERIF}" font-size="15" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">,</text>
            <circle cx="${b.startX + b.colStepX}" cy="${b.commaY}" r="${b.radius}" fill="none" stroke="${LINE_COLOR}" stroke-width="0.9" />
            <circle cx="${b.startX + 2 * b.colStepX}" cy="${b.commaY}" r="${b.radius}" fill="none" stroke="${LINE_COLOR}" stroke-width="0.9" />
          `;

          // 10 hàng chữ số từ 0 đến 9 căn thẳng trục dọc với 4 ô vuông viết tay
          for (let d = 0; d <= 9; d++) {
            const cy = b.digit0Y + d * b.rowStepY;
            svgElements += `<text x="${b.startX - 20}" y="${cy + 4}" font-family="${SERIF}" font-size="12.5" font-weight="bold" text-anchor="middle" fill="${TEXT_DARK}">${d}</text>`;
            for (let c = 0; c < 4; c++) {
              const cx = b.startX + c * b.colStepX;
              svgElements += `<circle cx="${cx}" cy="${cy}" r="${b.radius}" fill="none" stroke="${LINE_COLOR}" stroke-width="0.85" />`;
            }
          }
        });
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
 * MỞ CỬA SỔ IN PHIẾU A4 CHUẨN BỘ GD&ĐT (CÓ NÚT CHUYỂN TÔNG MÀU ĐỎ HỒNG BỘ GD&ĐT HOẶC ĐEN TRUYỀN THỐNG)
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
        :root { --omr-stroke: #BE185D; }
        body.black-theme { --omr-stroke: #111827; }
        @page { size: A4 portrait; margin: 5mm; }
        body { margin: 0; padding: 0; background: #f1f5f9; font-family: 'Times New Roman', Times, serif; display: flex; flex-direction: column; align-items: center; }
        .toolbar { width: 100%; max-width: 840px; margin: 12px auto; padding: 10px 18px; background: #0f172a; color: #fff; border-radius: 12px; display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center; box-sizing: border-box; font-family: Arial, sans-serif; }
        .btn-group { display: flex; align-items: center; gap: 8px; }
        .btn-theme { background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 7px 12px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; }
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
          <strong>Phiếu Trả Lời A4 Chuẩn Mẫu Bộ GD&ĐT:</strong> ${String(title).replace(/[<>&"]/g, "")}
          <span style="margin-left:8px; font-size:12px; color:#93c5fd;">(${counts.totalCount} câu • ${pagesSvg.length} trang A4)</span>
        </div>
        <div class="btn-group">
          <button class="btn-theme" onclick="document.body.classList.toggle('black-theme')">🎨 Đổi màu viền (Đỏ Bộ GD&ĐT / Đen)</button>
          <button class="btn-print" onclick="window.print()">🖨 In Phiếu / Lưu PDF (${pagesSvg.length} trang A4)</button>
        </div>
      </div>
      ${pagesHtml}
    </body>
    </html>
  `;

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
}
