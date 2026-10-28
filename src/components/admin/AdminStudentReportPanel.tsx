"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  User,
  Award,
  Copy,
  Printer,
  Sparkles,
  PlusCircle,
  UserCheck,
  Check,
  Eye,
  X,
  Plus,
  Trash2,
  BookOpen,
  Download,
  ImageIcon,
  Search,
  ChevronRight,
  ShieldCheck,
  Filter,
  CheckSquare,
  Square,
  FileText,
  Layers,
  ZoomIn,
  ZoomOut,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  XCircle
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

function normalizeText(str: any): string {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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
 * GIẢI MÃ TOÀN BỘ DANH SÁCH CÂU HỎI (ĐÚNG, SAI & BỎ TRỐNG) CHO PHỤ BẢN OMR TRANG 2
 * Khắc phục 100% lỗi báo 22/22 câu đúng khi học sinh bỏ trống hoặc làm sai trên phiếu
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
} {
  const answersMap = attempt?.answers || attempt?.user_answers || attempt?.userAnswers || {};
  const meta = answersMap?.__paper_omr_meta || {};
  const coords: any[] =
    attempt?.omr_raw_data?.bubble_coordinates || meta?.bubble_coordinates || [];

  // Bước 1: Nếu có omr_raw_data đầy đủ và rawQuizObj, thử dùng gradeOMRSubmission
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
        const allRows: FullQuestionReviewRow[] = graded.questionDetails.map((qd: any) => {
          const qNum = Number(qd.questionOrder);
          const manualOverride = questionStatusOverrides?.[qNum];
          const isRight =
            manualOverride !== undefined ? manualOverride : qd.status === "correct";
          const rawAns = String(qd.studentAnswerDisplay || "").trim();
          const isSkipped = !rawAns || rawAns === "Bỏ trống";

          return {
            questionNumber: qNum,
            part: `Phần ${qd.part === 1 ? "I" : qd.part === 2 ? "II" : "III"}`,
            studentAnswer: isSkipped ? "Bỏ trống / Chưa tô" : rawAns,
            correctAnswer: String(qd.correctAnswerDisplay || "--"),
            isCorrect: isRight,
            isSkipped
          };
        });

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

        return {
          allRows,
          wrongRows,
          part1Summary:
            p1Rows.length > 0
              ? `Đúng ${p1Rows.filter((x) => x.isCorrect).length}/${p1Rows.length} câu (${graded.part1Score.toFixed(2)}đ)`
              : "Không có trong đề",
          part2Summary:
            p2Rows.length > 0
              ? `Đúng ${p2Rows.filter((x) => x.isCorrect).length}/${p2Rows.length} câu (${graded.part2Score.toFixed(2)}đ)`
              : "Không có trong đề",
          part3Summary:
            p3Rows.length > 0
              ? `Đúng ${p3Rows.filter((x) => x.isCorrect).length}/${p3Rows.length} câu (${graded.part3Score.toFixed(2)}đ)`
              : "Không có trong đề",
          correctCount: allRows.filter((r) => r.isCorrect).length,
          totalQuestions: allRows.length
        };
      }
    } catch {}
  }

  // Bước 2: Khôi phục từ danh sách câu hỏi của đề gốc (rawQuizObj) + answersMap + bubble_coordinates
  const flatQuestions: any[] = [];
  if (rawQuizObj) {
    const sections = rawQuizObj.sections || rawQuizObj.data || [];
    if (Array.isArray(sections)) {
      sections.forEach((sec: any) => {
        if (Array.isArray(sec?.questions)) {
          flatQuestions.push(...sec.questions);
        } else if (sec && (sec.question || sec.text || sec.content || sec.type)) {
          flatQuestions.push(sec);
        }
      });
    }
    if (flatQuestions.length === 0 && Array.isArray(rawQuizObj.questions)) {
      flatQuestions.push(...rawQuizObj.questions);
    }
  }

  const counts = rawQuizObj
    ? extractExamQuestionCounts(rawQuizObj)
    : { part1Count: 12, part2Count: 4, part3Count: 6, totalCount: 22 };

  const totalCount =
    flatQuestions.length > 0
      ? flatQuestions.length
      : Number(attempt?.total_questions ?? attempt?.totalQuestions ?? counts.totalCount) || 22;

  const p1Limit = counts.part1Count || 12;
  const p2Limit = counts.part2Count || 4;

  const allRows: FullQuestionReviewRow[] = [];

  for (let i = 0; i < totalCount; i++) {
    const qOrder = i + 1;
    const qObj = flatQuestions[i] || null;
    const qId = String(qObj?.id || `q_${qOrder}`);

    let partNum: 1 | 2 | 3 = 1;
    let localNum = qOrder;
    if (qOrder <= p1Limit) {
      partNum = 1;
      localNum = qOrder;
    } else if (qOrder <= p1Limit + p2Limit) {
      partNum = 2;
      localNum = qOrder - p1Limit;
    } else {
      partNum = 3;
      localNum = qOrder - p1Limit - p2Limit;
    }

    const partLabel = `Phần ${partNum === 1 ? "I" : partNum === 2 ? "II" : "III"}`;

    // Lấy câu trả lời của học sinh từ answersMap hoặc từ bubble_coordinates
    let rawStuVal =
      answersMap[qId] ??
      answersMap[String(qOrder)] ??
      answersMap[`p${partNum}_q${localNum}`];

    const sectionTag = `part${partNum}`;
    const qCoords = coords.filter(
      (b: any) => b && b.section === sectionTag && Number(b.questionNumber) === localNum
    );

    let studentDisplay = "";
    let correctDisplay = "";
    let autoIsCorrect = false;

    if (partNum === 1) {
      const pickedBubble = qCoords.find(
        (b: any) => b.isSelected || b.status === "correct" || b.status === "wrong"
      );
      const expectedBubble = qCoords.find(
        (b: any) => b.status === "correct" || b.status === "expected_missed"
      );

      studentDisplay = String(
        rawStuVal || pickedBubble?.optionKey || ""
      )
        .trim()
        .toUpperCase();

      correctDisplay = String(
        qObj?.correctAnswer || qObj?.answer || expectedBubble?.optionKey || "A"
      )
        .trim()
        .toUpperCase();

      const hasWrongBubble = qCoords.some((b: any) => b.status === "wrong");
      const hasMissedBubble = qCoords.some((b: any) => b.status === "expected_missed");

      if (qCoords.length > 0) {
        autoIsCorrect =
          Boolean(studentDisplay) && !hasWrongBubble && !hasMissedBubble;
      } else {
        autoIsCorrect = Boolean(studentDisplay) && studentDisplay === correctDisplay;
      }
    } else if (partNum === 2) {
      const subKeys: ("a" | "b" | "c" | "d")[] = ["a", "b", "c", "d"];
      const stuParts: string[] = [];
      const corParts: string[] = [];
      let allSubRight = true;

      subKeys.forEach((sk, idx) => {
        const subCoords = qCoords.filter((b: any) => b.subKey === sk);
        const pickedSub = subCoords.find(
          (b: any) => b.isSelected || b.status === "correct" || b.status === "wrong"
        );
        const subVal =
          rawStuVal && typeof rawStuVal === "object" ? rawStuVal[sk] : undefined;

        let stuSubChar = "-";
        if (subVal === true || pickedSub?.optionKey === "T") stuSubChar = "Đ";
        else if (subVal === false || pickedSub?.optionKey === "F") stuSubChar = "S";
        else allSubRight = false;

        stuParts.push(`${sk})${stuSubChar}`);

        const stmtObj = Array.isArray(qObj?.statements) ? qObj.statements[idx] : null;
        const expectedSub = subCoords.find(
          (b: any) => b.status === "correct" || b.status === "expected_missed"
        );
        let corSubChar = "Đ";
        if (stmtObj !== null && stmtObj !== undefined) {
          const isT = Boolean(stmtObj.isTrue ?? stmtObj.correct ?? stmtObj.answer);
          corSubChar = isT ? "Đ" : "S";
        } else if (expectedSub) {
          corSubChar = expectedSub.optionKey === "T" ? "Đ" : "S";
        }
        corParts.push(`${sk})${corSubChar}`);

        if (stuSubChar !== corSubChar) {
          allSubRight = false;
        }
      });

      const isAllBlank = stuParts.every((p) => p.endsWith("-"));
      studentDisplay = isAllBlank ? "" : stuParts.join(" ");
      correctDisplay = corParts.join(" ");
      autoIsCorrect = !isAllBlank && allSubRight;
    } else {
      // Phần III: Trả lời ngắn
      const pickedCols = qCoords
        .filter((b: any) => b.isSelected || b.status === "correct" || b.status === "wrong")
        .sort((a: any, b: any) => Number(a.colIndex || 0) - Number(b.colIndex || 0));

      const reconstructedFromBubbles = pickedCols.map((b: any) => b.optionKey).join("");
      studentDisplay = String(
        rawStuVal !== undefined && rawStuVal !== null && String(rawStuVal).trim() !== ""
          ? rawStuVal
          : reconstructedFromBubbles
      ).trim();

      correctDisplay = String(
        qObj?.correctAnswer ?? qObj?.shortAnswer ?? qObj?.answer ?? "--"
      ).trim();

      const normStu = studentDisplay.replace(",", ".");
      const normCor = correctDisplay.replace(",", ".");
      const hasWrongCol = qCoords.some((b: any) => b.status === "wrong");

      if (!studentDisplay) {
        autoIsCorrect = false;
      } else if (correctDisplay !== "--" && normCor !== "") {
        autoIsCorrect =
          normStu === normCor ||
          (!isNaN(Number(normStu)) &&
            !isNaN(Number(normCor)) &&
            Math.abs(Number(normStu) - Number(normCor)) < 1e-4);
      } else {
        autoIsCorrect = !hasWrongCol && pickedCols.length > 0;
      }
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

  return {
    allRows,
    wrongRows,
    part1Summary:
      p1Rows.length > 0
        ? `Đúng ${p1Rows.filter((x) => x.isCorrect).length}/${p1Rows.length} câu`
        : "Không có trong đề",
    part2Summary:
      p2Rows.length > 0
        ? `Đúng ${p2Rows.filter((x) => x.isCorrect).length}/${p2Rows.length} câu`
        : "Không có trong đề",
    part3Summary:
      p3Rows.length > 0
        ? `Đúng ${p3Rows.filter((x) => x.isCorrect).length}/${p3Rows.length} câu`
        : "Không có trong đề",
    correctCount: allRows.filter((r) => r.isCorrect).length,
    totalQuestions: allRows.length
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

  const [reportViewType, setReportViewType] = useState<"daily" | "monthly" | "manual">("daily");
  const reportMode = reportViewType === "manual" ? "manual" : "auto";

  const [dailyMonth, setDailyMonth] = useState<number>(currentRealtimeMonth);
  const [dailyWeek, setDailyWeek] = useState<number>(4);
  const [customDateStr, setCustomDateStr] = useState<string>(todayFormatted);
  const [overrideTopicTitle, setOverrideTopicTitle] = useState<string>("");
  const [selectedDailyPracticeId, setSelectedDailyPracticeId] = useState<string>("none");
  const [dailyStudentFilterMode, setDailyStudentFilterMode] = useState<
    "all" | "offline" | "online"
  >("all");
  const [includeCoverSummaryPage, setIncludeCoverSummaryPage] = useState<boolean>(true);

  // Ghi nhận chỉnh sửa thủ công điểm số / nhận xét / chuyên cần / kết quả từng câu OMR của học viên
  const [dailyStudentOverrides, setDailyStudentOverrides] = useState<
    Record<
      string,
      {
        homeworkScore?: string;
        dailyTestScore?: string;
        practiceScore?: string;
        teacherComment?: string;
        attendance?: "present" | "late" | "absent";
        homeworkStatus?: "completed" | "missing" | "late";
        questionStatusOverrides?: Record<number, boolean>;
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

  const sbdDirectoryMap = useMemo(() => {
    const sorted = [...(registeredStudents || [])].filter(Boolean);
    sorted.sort((a, b) =>
      String(a.full_name || a.name || "").localeCompare(
        String(b.full_name || b.name || ""),
        "vi"
      )
    );
    const map = new Map<string, { sbd: string; stt: number; mode: "Online" | "Offline" }>();
    sorted.forEach((stu, idx) => {
      const id = String(stu.id || "").trim();
      const rawMode = String(stu.learning_mode || stu.study_mode || "offline").toLowerCase();
      map.set(id, {
        stt: idx + 1,
        sbd: stu.sbd ? String(stu.sbd).padStart(6, "0").slice(-6) : formatStudentAutoSBD(idx + 1),
        mode: rawMode.includes("on") ? "Online" : "Offline"
      });
    });
    return map;
  }, [registeredStudents]);

  const matchedLessonsForDaily = useMemo(() => {
    const matched: {
      lessonId: string;
      lessonTitle: string;
      chapterTitle: string;
      hwIds: Set<string>;
      hwTitles: Set<string>;
      testIds: Set<string>;
      testTitles: Set<string>;
      rawQuizzesMap: Map<string, any>;
    }[] = [];

    (chapters || []).forEach((chap: any) => {
      const cMonth = chap?.assigned_month ? Number(chap.assigned_month) : undefined;
      const cWeek = chap?.assigned_week ? Number(chap.assigned_week) : undefined;

      (chap?.lessons || []).forEach((les: any) => {
        if (!les) return;
        const lMonth = Number(les.assigned_month || cMonth || 10);
        const lWeek = Number(les.assigned_week || cWeek || 1);

        if (lMonth === dailyMonth && lWeek === dailyWeek) {
          const hwIds = new Set<string>();
          const hwTitles = new Set<string>();
          const testIds = new Set<string>();
          const testTitles = new Set<string>();
          const rawQuizzesMap = new Map<string, any>();

          (les.homework_files || []).forEach((hw: any) => {
            if (!hw) return;
            if (hw.id) {
              hwIds.add(String(hw.id).trim().toLowerCase());
              rawQuizzesMap.set(String(hw.id).trim().toLowerCase(), hw);
            }
            if (hw.title) {
              hwTitles.add(normalizeText(hw.title));
              rawQuizzesMap.set(normalizeText(hw.title), hw);
            }
          });

          (les.test_quizzes || []).forEach((tq: any) => {
            if (!tq) return;
            if (tq.id) {
              testIds.add(String(tq.id).trim().toLowerCase());
              rawQuizzesMap.set(String(tq.id).trim().toLowerCase(), tq);
            }
            if (tq.title) {
              testTitles.add(normalizeText(tq.title));
              rawQuizzesMap.set(normalizeText(tq.title), tq);
            }
          });

          matched.push({
            lessonId: String(les.id || ""),
            lessonTitle: String(les.title || "Bài học"),
            chapterTitle: String(chap?.title || ""),
            hwIds,
            hwTitles,
            testIds,
            testTitles,
            rawQuizzesMap
          });
        }
      });
    });

    return matched;
  }, [chapters, dailyMonth, dailyWeek]);

  const autoSyncedTopicTitle = useMemo(() => {
    if (matchedLessonsForDaily.length > 0) {
      return matchedLessonsForDaily.map((m) => m.lessonTitle).join(" • ");
    }
    for (const chap of chapters || []) {
      if (Array.isArray(chap?.lessons) && chap.lessons.length > 0) {
        return String(chap.lessons[0].title || "Chuyên đề Toán Tư Duy TCT");
      }
    }
    return `Chuyên đề Toán 12 — Tuần ${dailyWeek} Tháng ${dailyMonth}`;
  }, [matchedLessonsForDaily, chapters, dailyWeek, dailyMonth]);

  useEffect(() => {
    setOverrideTopicTitle("");
  }, [dailyMonth, dailyWeek]);

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

  // 3. TÍNH TOÁN DỮ LIỆU BÁO CÁO NGÀY (KHÔNG GÁN ĐIỂM BỪA SANG ĐỀ THỰC CHIẾN & TÁI TẠO ĐỦ 22 CÂU OMR)
  const computeStudentDailyScoreRecord = useCallback(
    (student: any): StudentDailyScoreData & { allQuestionsReviewList?: FullQuestionReviewRow[] } => {
      const stuId = String(student?.id || "").trim();
      const stuName = String(student?.full_name || student?.name || "Học sinh").trim();
      const dirInfo = sbdDirectoryMap.get(stuId);
      const sbd = dirInfo?.sbd || formatStudentAutoSBD(1);
      const learningMode: "Online" | "Offline" = dirInfo?.mode || "Offline";

      const stuAttempts = (allAttempts || []).filter((att: any) => {
        if (!att) return false;
        const aStuId = String(att.studentId || att.student_id || att.user_id || "").trim();
        const aStuName = normalizeText(att.studentName || att.student_name || att.full_name || "");
        const aSbd = String(
          att.omr_raw_data?.detected_sbd ||
            att.answers?.__paper_omr_meta?.detected_sbd ||
            ""
        ).trim();
        return (
          (stuId && aStuId === stuId) ||
          (stuName && aStuName === normalizeText(stuName)) ||
          (sbd && aSbd === sbd)
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

        const belongsToMatchedLessonHw = matchedLessonsForDaily.some(
          (m) => (qId && m.hwIds.has(qId)) || (qTitle && m.hwTitles.has(qTitle))
        );
        const belongsToMatchedLessonTest = matchedLessonsForDaily.some(
          (m) => (qId && m.testIds.has(qId)) || (qTitle && m.testTitles.has(qTitle))
        );

        const sc = Number(att.score ?? att.points ?? 0);

        // 1. Khớp BTVN của Tuần/Tháng đang chọn
        if (isHw && (belongsToMatchedLessonHw || (month === dailyMonth && week === dailyWeek))) {
          if (!bestHwAttempt || sc >= Number(bestHwAttempt.score ?? bestHwAttempt.points ?? 0)) {
            bestHwAttempt = att;
          }
        }

        // 2. Khớp Bài Kiểm Tra tại lớp trong Ngày/Tuần đang chọn
        if (
          isTest &&
          (belongsToMatchedLessonTest || (month === dailyMonth && week === dailyWeek))
        ) {
          if (
            !bestDailyTestAttempt ||
            sc >= Number(bestDailyTestAttempt.score ?? bestDailyTestAttempt.points ?? 0)
          ) {
            bestDailyTestAttempt = att;
          }
        }

        // 3. Khớp Đề Luyện Thi Thực Chiến Tháng (CHỈ LẤY KHI GIÁO VIÊN CHỌN CỤ THỂ ĐỀ THỰC CHIẾN VÀ KHÔNG TRÙNG BÀI TEST TẠI LỚP)
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
        const anyPaperInMonth = stuAttempts.find((att: any) => {
          const { month } = resolveAttemptMonthAndWeek(att);
          const isPaper =
            att.submission_type === "paper" ||
            Boolean(att.scanned_image_url) ||
            Boolean(att.paper_scan_url) ||
            Boolean(att.omr_raw_data) ||
            Boolean(att.answers?.__paper_omr_meta);
          return isPaper && month === dailyMonth;
        });
        if (anyPaperInMonth) {
          bestDailyTestAttempt = anyPaperInMonth;
        }
      }

      // Đảm bảo không bao giờ lấy trùng bài Test tại lớp gán sang Đề thực chiến tháng (trừ khi giáo viên cố tình chọn đúng đề đó)
      if (
        bestPracticeAttempt &&
        bestDailyTestAttempt &&
        String(bestPracticeAttempt.id) === String(bestDailyTestAttempt.id) &&
        selectedDailyPracticeId === "auto"
      ) {
        bestPracticeAttempt = null;
      }

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

      // Nếu điểm đề thực chiến <= 0 hoặc null -> Gán null để hiển thị "Không kiểm tra"
      const pracScore =
        rawPracScore !== null && !isNaN(rawPracScore) && rawPracScore > 0 ? rawPracScore : null;

      const paperSourceAtt =
        (bestDailyTestAttempt &&
        (bestDailyTestAttempt.submission_type === "paper" ||
          bestDailyTestAttempt.scanned_image_url ||
          bestDailyTestAttempt.paper_scan_url ||
          bestDailyTestAttempt.omr_raw_data ||
          bestDailyTestAttempt.answers?.__paper_omr_meta)
          ? bestDailyTestAttempt
          : null) ||
        (bestPracticeAttempt &&
        (bestPracticeAttempt.submission_type === "paper" ||
          bestPracticeAttempt.scanned_image_url ||
          bestPracticeAttempt.paper_scan_url ||
          bestPracticeAttempt.omr_raw_data ||
          bestPracticeAttempt.answers?.__paper_omr_meta)
          ? bestPracticeAttempt
          : null);

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

      if (paperSourceAtt) {
        const meta =
          paperSourceAtt.answers?.__paper_omr_meta ||
          paperSourceAtt.user_answers?.__paper_omr_meta ||
          {};
        scannedPaperImageUrl =
          paperSourceAtt.scanned_image_url ||
          paperSourceAtt.paper_scan_url ||
          meta.scanned_image_url ||
          paperSourceAtt.omr_raw_data?.warped_image_data_url ||
          undefined;

        if (scannedPaperImageUrl) {
          hasPaperOMR = true;
          bubbleCoordinates =
            paperSourceAtt.omr_raw_data?.bubble_coordinates ||
            meta.bubble_coordinates ||
            [];
          paperExamTitle =
            paperSourceAtt.exam_title ||
            paperSourceAtt.examTitle ||
            meta.exam_title ||
            autoSyncedTopicTitle;
          paperExamCode =
            paperSourceAtt.omr_raw_data?.detected_exam_code ||
            meta.detected_exam_code ||
            "101";

          const { rawQuizObj } = resolveAttemptMonthAndWeek(paperSourceAtt);
          const reviewBuilt = buildFullOMRQuestionsReview(
            paperSourceAtt,
            rawQuizObj,
            ov.questionStatusOverrides
          );

          allQuestionsReviewList = reviewBuilt.allRows;
          wrongQuestionsList = reviewBuilt.wrongRows;
          part1ScoreStr = reviewBuilt.part1Summary;
          part2ScoreStr = reviewBuilt.part2Summary;
          part3ScoreStr = reviewBuilt.part3Summary;
          computedCorrectCount = reviewBuilt.correctCount;
          computedTotalQuestions = reviewBuilt.totalQuestions;
        }
      }

      const defaultComment =
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

      // Tự động đặt trạng thái BTVN: nếu không có điểm BTVN thì mặc định là "missing" (Chưa hoàn thành), vẫn tôn trọng lựa chọn thủ công của giáo viên
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
        attendance: ov.attendance !== undefined ? ov.attendance : "present",
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
      matchedLessonsForDaily,
      dailyMonth,
      dailyWeek,
      selectedDailyPracticeId,
      dailyStudentOverrides,
      overrideTopicTitle,
      autoSyncedTopicTitle
    ]
  );

  // Cho phép giáo viên bấm đổi nhanh trạng thái Đúng/Sai của từng câu OMR nếu máy quét bắt sót vết chì mờ
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
      : filteredStudents;

    if (targetStudents.length === 0) {
      alert("Không có học sinh nào trong danh sách để xuất báo cáo!");
      return;
    }

    const studentsScoreData = targetStudents.map((stu) =>
      computeStudentDailyScoreRecord(stu)
    );

    const config: DailyReportConfig = {
      reportMode: "daily",
      selectedMonth: dailyMonth,
      selectedWeek: dailyWeek,
      customDateStr: customDateStr.trim() || todayFormatted,
      topicTitle: autoSyncedTopicTitle,
      overrideTopicTitle: overrideTopicTitle.trim() || undefined,
      includeCoverSummaryPage: !onlyCurrentStudent && includeCoverSummaryPage
    };

    const htmlDoc = generateClassDailyReportHTML(config, studentsScoreData);
    openPrintOrDownloadClassReport(htmlDoc);
  };

  const handleCopyDailyZalo = () => {
    if (!currentStudentDailyData) return;
    const d = currentStudentDailyData;
    const topic = (overrideTopicTitle && overrideTopicTitle.trim()) || autoSyncedTopicTitle;
    const attText =
      d.attendance === "present"
        ? "Có mặt đúng giờ"
        : d.attendance === "late"
        ? "Đi học muộn"
        : "Nghỉ học";
    const hwStatusText =
      d.homeworkStatus === "completed"
        ? "Hoàn thành đầy đủ"
        : d.homeworkStatus === "late"
        ? "Nộp muộn"
        : "Chưa hoàn thành";

    const msg =
      `[TRUNG TÂM TOÁN TÂM CHÍ TÀI - TCT]\n` +
      `📋 BÁO CÁO KẾT QUẢ BUỔI HỌC NGÀY ${customDateStr}\n` +
      `• Học sinh: ${d.studentName} (SBD: ${d.sbd})\n` +
      `• Trường: ${d.school} • Phân hệ: ${d.learningMode}\n` +
      `• Chuyên đề: ${topic}\n` +
      `------------------------------------\n` +
      `I. KẾT QUẢ ĐIỂM SỐ & CHUYÊN CẦN TRONG NGÀY:\n` +
      `1. Chuyên cần: ${attText} | Ý thức BTVN: ${hwStatusText}\n` +
      `2. Điểm Bài tập về nhà (BTVN): ${
        d.homeworkScore !== null ? `${d.homeworkScore}/10` : "-- / 10 (Chưa nộp)"
      }\n` +
      `3. Điểm Kiểm tra tại lớp: ${
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
      `"${d.teacherComment}"\n\n` +
      `📞 Hotline TCT: 0972 26 16 16 • Đ/c: Số 10 Tạ Quang Bửu, Bách Khoa, Hà Nội.`;

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
    const scale = 3; // Độ phân giải 3x siêu nét
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

  return (
    <div className="space-y-5 max-w-6xl mx-auto text-left font-sans">
      {/* 1. THANH CHUYỂN CHẾ ĐỘ BÁO CÁO (NGÀY / THÁNG / TỰ TẠO) & NÚT XUẤT PDF CẢ LỚP */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 w-fit">
          <button
            type="button"
            onClick={() => setReportViewType("daily")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-extrabold text-xs transition cursor-pointer ${
              reportViewType === "daily"
                ? "bg-[#003399] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>📅 Báo cáo theo Ngày / Buổi học</span>
          </button>

          <button
            type="button"
            onClick={() => setReportViewType("monthly")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-extrabold text-xs transition cursor-pointer ${
              reportViewType === "monthly"
                ? "bg-white text-[#1D4ED8] shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <UserCheck className="w-4 h-4 text-blue-600" />
            <span>📊 Báo cáo Tổng kết Tháng</span>
          </button>

          <button
            type="button"
            onClick={() => setReportViewType("manual")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-extrabold text-xs transition cursor-pointer ${
              reportViewType === "manual"
                ? "bg-white text-emerald-700 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>Tự tạo đánh giá (HS mới)</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {copiedToast && (
            <span className="text-xs text-emerald-600 font-bold animate-in fade-in flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Đã sao chép!
            </span>
          )}

          <button
            type="button"
            onClick={handleCopyZalo}
            className="px-3 py-2 bg-white border border-slate-300 hover:border-blue-600 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-blue-600" /> Sao chép gửi Zalo
          </button>

          {reportViewType === "daily" ? (
            <>
              <button
                type="button"
                onClick={() => handleExportClassDailyPDF(true)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" /> Xem / In cá nhân
              </button>

              <button
                type="button"
                onClick={() => handleExportClassDailyPDF(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>📑 Xuất PDF Báo Cáo Cả Lớp ({filteredStudents.length} HS)</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowOfficialModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Eye className="w-4 h-4" /> Xem bản chính thức (Để tải ảnh/in)
            </button>
          )}
        </div>
      </div>

      {/* 2. THANH CẤU HÌNH NHANH CHO CHẾ ĐỘ "BÁO CÁO THEO NGÀY / BUỔI HỌC" */}
      {reportViewType === "daily" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3.5 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Tháng học:
              </label>
              <select
                value={dailyMonth}
                onChange={(e) => setDailyMonth(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-[#003399] outline-none focus:border-blue-600 cursor-pointer"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                  <option key={m} value={m}>
                    Tháng {m < 10 ? "0" + m : m}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Tuần trong tháng:
              </label>
              <select
                value={dailyWeek}
                onChange={(e) => setDailyWeek(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-[#003399] outline-none focus:border-blue-600 cursor-pointer"
              >
                {[1, 2, 3, 4, 5].map((w) => (
                  <option key={w} value={w}>
                    Tuần {w} - Tháng {dailyMonth}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Ngày học (in lên phiếu):
              </label>
              <input
                type="text"
                value={customDateStr}
                onChange={(e) => setCustomDateStr(e.target.value)}
                placeholder="VD: 28/10/2026"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-blue-600"
              />
            </div>

            <div className="md:col-span-6">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                  <span>Tên chuyên đề buổi học (Tự động đồng bộ từ #lessons):</span>
                </label>
                {overrideTopicTitle && (
                  <button
                    type="button"
                    onClick={() => setOverrideTopicTitle("")}
                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Khôi phục theo bài học gốc
                  </button>
                )}
              </div>
              <input
                type="text"
                value={overrideTopicTitle !== "" ? overrideTopicTitle : autoSyncedTopicTitle}
                onChange={(e) => setOverrideTopicTitle(e.target.value)}
                placeholder="Tên bài học trong ngày..."
                className="w-full px-3.5 py-2 rounded-xl bg-amber-50/70 border border-amber-300 text-xs font-extrabold text-slate-900 outline-none focus:border-amber-600 focus:bg-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-500">Lọc danh sách xuất PDF:</span>
              {[
                { key: "all", label: `Tất cả (${registeredStudents.length})` },
                { key: "offline", label: "Học sinh Offline" },
                { key: "online", label: "Học sinh Online" }
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setDailyStudentFilterMode(t.key as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    dailyStudentFilterMode === t.key
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}

              <label className="inline-flex items-center gap-1.5 ml-2 font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCoverSummaryPage}
                  onChange={(e) => setIncludeCoverSummaryPage(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Kèm trang bìa tổng hợp điểm cả lớp</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500">Đề thực chiến tháng:</span>
              <select
                value={selectedDailyPracticeId}
                onChange={(e) => setSelectedDailyPracticeId(e.target.value)}
                className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[260px]"
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
        </div>
      )}

      {/* 3. GIAO DIỆN CHÍNH: DANH SÁCH HỌC VIÊN BÊN TRÁI + CHI TIẾT BÁO CÁO BÊN PHẢI */}
      {reportMode === "auto" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* CỘT TRÁI: DANH SÁCH HỌC SINH */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col h-[780px]">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#003399]" /> Danh sách học viên
              </h4>
              <span className="text-[11px] font-bold text-slate-400">
                {filteredStudents.length} bạn
              </span>
            </div>

            <div className="my-3 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="Tìm tên hoặc trường..."
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
              {filteredStudents.map((student) => {
                const isSelected = student.id === currentStudent?.id;
                const dirInfo = sbdDirectoryMap.get(String(student.id || "").trim());
                return (
                  <div
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={
                      "p-3 rounded-xl border transition cursor-pointer flex items-center justify-between " +
                      (isSelected
                        ? "bg-blue-50/90 border-[#003399] shadow-2xs"
                        : "bg-white border-slate-200/60 hover:bg-slate-50")
                    }
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono font-bold text-[10px] border border-slate-200">
                          {dirInfo?.sbd || "000001"}
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
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {student.school || "THPT"} • {dirInfo?.mode || "Offline"}
                      </p>
                    </div>
                    <ChevronRight
                      className={
                        "w-4 h-4 " + (isSelected ? "text-[#003399]" : "text-slate-300")
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* CỘT PHẢI: HIỂN THỊ THEO CHẾ ĐỘ NGÀY HOẶC CHẾ ĐỘ THÁNG */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-5">
            {reportViewType === "daily" && currentStudentDailyData ? (
              /* ================= NHÁNH 1: BÁO CÁO THEO NGÀY / BUỔI HỌC (BRANDING TCT 100%) ================= */
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#003399] text-white font-bold text-[10px] uppercase">
                        TÂM CHÍ TÀI (TCT)
                      </span>
                      <span className="font-mono font-bold text-xs text-blue-700">
                        SBD: {currentStudentDailyData.sbd}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">
                        • Học sinh {currentStudentDailyData.learningMode}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">
                      {currentStudentDailyData.studentName}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {currentStudentDailyData.school} • Ngày báo cáo:{" "}
                      <strong className="text-slate-800">{customDateStr}</strong> (Tuần{" "}
                      {dailyWeek} - Tháng {dailyMonth})
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentStudentDailyData.hasPaperOMR && (
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Đã đính kèm Phiếu OMR
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleExportClassDailyPDF(true)}
                      className="px-3.5 py-2 rounded-xl bg-[#003399] hover:bg-blue-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" /> In phiếu của bạn này
                    </button>
                  </div>
                </div>

                {/* Khối chuyên đề buổi học */}
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
                  <span className="text-[10px] font-bold uppercase text-amber-800 block">
                    NỘI DUNG CHUYÊN ĐỀ BUỔI HỌC:
                  </span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    📘 {overrideTopicTitle || autoSyncedTopicTitle}
                  </div>
                </div>

                {/* 3 Cột Điểm số trong ngày */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                    <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                      1. ĐIỂM BÀI TẬP VỀ NHÀ
                    </span>
                    <div className="flex items-center gap-1.5 mt-1.5">
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
                        className="w-28 px-2.5 py-1 rounded-lg bg-white border border-emerald-300 font-bold text-sm text-emerald-900 outline-none"
                      />
                      <span className="text-xs font-bold text-emerald-700">/ 10</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
                    <span className="text-[10px] font-bold uppercase text-blue-800 block">
                      2. ĐIỂM TEST TẠI LỚP (OMR/WEB)
                    </span>
                    <div className="flex items-center gap-1.5 mt-1.5">
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
                        className="w-28 px-2.5 py-1 rounded-lg bg-white border border-blue-300 font-bold text-sm text-blue-900 outline-none"
                      />
                      <span className="text-xs font-bold text-blue-700">/ 10</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200">
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
                          Đặt Không KT
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
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
                        className="w-32 px-2.5 py-1 rounded-lg bg-white border border-orange-300 font-bold text-xs text-orange-900 outline-none"
                      />
                      <span className="text-xs font-bold text-orange-700">/ 10</span>
                    </div>
                  </div>
                </div>

                {/* KHỐI CHỌN TRỰC QUAN CHUYÊN CẦN & Ý THỨC BTVN (DẠNG NÚT LỚN NỔI BẬT) */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <span className="text-xs font-extrabold text-slate-800 uppercase block mb-2">
                      Chuyên cần buổi học (Hiển thị thẻ lớn trên Báo cáo):
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          key: "present",
                          label: "✓ Có mặt đúng giờ",
                          activeCls: "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                        },
                        {
                          key: "late",
                          label: "⚠️ Đi học muộn",
                          activeCls: "bg-amber-500 text-white border-amber-600 shadow-xs"
                        },
                        {
                          key: "absent",
                          label: "✕ Nghỉ học",
                          activeCls: "bg-rose-600 text-white border-rose-700 shadow-xs"
                        }
                      ].map((opt) => {
                        const active = currentStudentDailyData.attendance === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() =>
                              setDailyStudentOverrides((prev) => ({
                                ...prev,
                                [currentStudentDailyData.studentId]: {
                                  ...(prev[currentStudentDailyData.studentId] || {}),
                                  attendance: opt.key as any
                                }
                              }))
                            }
                            className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
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

                  <div>
                    <span className="text-xs font-extrabold text-slate-800 uppercase block mb-2">
                      Ý thức làm Bài tập về nhà (BTVN):
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          key: "completed",
                          label: "✓ Hoàn thành đầy đủ",
                          activeCls: "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                        },
                        {
                          key: "late",
                          label: "⚠️ Nộp muộn",
                          activeCls: "bg-amber-500 text-white border-amber-600 shadow-xs"
                        },
                        {
                          key: "missing",
                          label: "✕ Chưa hoàn thành",
                          activeCls: "bg-rose-600 text-white border-rose-700 shadow-xs"
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
                            className={`py-2 px-3 rounded-xl text-xs font-extrabold border transition cursor-pointer ${
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

                {/* Nhận xét của Giáo viên trong ngày */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
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
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 outline-none focus:border-blue-600 focus:bg-white"
                  />
                </div>

                {/* BẢNG ĐỐI SOÁT & SỬA NHANH TỪNG CÂU HỎI OMR TRƯỚC KHI XUẤT PDF */}
                {currentStudentDailyData.hasPaperOMR &&
                  currentStudentDailyData.scannedPaperImageUrl && (
                    <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-emerald-400 block">
                            ✓ PHỤ BẢN ĐỐI SOÁT PHIẾU OMR (TRANG 2) — BẤM VÀO CÂU ĐỂ ĐỔI ĐÚNG/SAI NẾU CẦN
                          </span>
                          <h4 className="text-xs font-bold text-white mt-0.5">
                            Bài thi: {currentStudentDailyData.paperExamTitle} (Mã đề:{" "}
                            {currentStudentDailyData.paperExamCode}) — Đúng:{" "}
                            <span className="text-emerald-400">
                              {currentStudentDailyData.dailyTestCorrect}/
                              {currentStudentDailyData.dailyTestTotal} câu
                            </span>{" "}
                            • Sai/Trống:{" "}
                            <span className="text-rose-400">
                              {currentStudentDailyData.wrongQuestionsList?.length || 0} câu
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
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Phóng to xem phiếu OMR
                        </button>
                      </div>

                      {currentStudentDailyData.allQuestionsReviewList &&
                        currentStudentDailyData.allQuestionsReviewList.length > 0 && (
                          <div className="max-h-56 overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
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
                                title="Bấm để đảo trạng thái Đúng / Sai cho câu này"
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
                                  <span>Chọn: {qRow.studentAnswer}</span>{" "}
                                  <span className="opacity-75">(ĐA: {qRow.correctAnswer})</span>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-extrabold shrink-0 flex items-center gap-1 ${
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
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-5">
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

      {/* MODAL XEM PHIẾU THI GỐC OMR */}
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
                    alt="Phiếu thi gốc"
                    className="w-full h-full object-fill block"
                  />
                  {previewPaperItem.omrRawData?.bubble_coordinates && (
                    <svg
                      viewBox={`0 0 ${OMR_CANONICAL_WIDTH} ${OMR_CANONICAL_HEIGHT}`}
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    >
                      {previewPaperItem.omrRawData.bubble_coordinates
                        .filter((b: any) => b.status !== "unfilled")
                        .map((b: any) => {
                          const strokeColor =
                            b.status === "correct"
                              ? "#10B981"
                              : b.status === "wrong"
                              ? "#EF4444"
                              : b.status === "expected_missed"
                              ? "#F59E0B"
                              : "#2563EB";
                          return (
                            <circle
                              key={b.id}
                              cx={b.x}
                              cy={b.y}
                              r={(b.r || 9) + 2.5}
                              fill={
                                b.status === "correct"
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
