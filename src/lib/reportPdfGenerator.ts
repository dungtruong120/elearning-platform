import {
  DailyReportConfig,
  StudentDailyScoreData,
  WrongQuestionReviewItem,
} from "@/types/report";
import { OMR_CANONICAL_WIDTH, OMR_CANONICAL_HEIGHT } from "@/lib/omrEngine";

export interface FullQuestionReviewRow {
  questionNumber: number;
  part: string; // "Phần I" | "Phần II" | "Phần III"
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  isSkipped?: boolean;
}

export type ExtendedAttendanceStatus =
  | "present"
  | "makeup_done"
  | "absent_need_makeup"
  | "late"
  | "absent";

export interface MakeupSessionItem {
  id: string;
  date: string; // VD: "Thứ 6 (06/11)" hoặc "31/10/2026"
  shiftId: string;
  shiftLabel: string; // VD: "Tối 2 (19:30 - 21:00)"
  timeSlot?: string; // VD: "19:30 - 21:00"
  type: "makeup" | "support"; // 'makeup': Học bù bài vắng (Cam) | 'support': Bổ trợ tăng cường / Online đêm (Xanh)
  note?: string;
}

export const STANDARD_SUPPORT_SHIFTS = [
  {
    id: "morning_1",
    code: "CA 1",
    shortBadge: "CA 1 (08h-09h30)",
    label: "Ca Sáng 1",
    time: "08:00 - 09:30",
  },
  {
    id: "morning_2",
    code: "CA 2",
    shortBadge: "CA 2 (09h30-11h)",
    label: "Ca Sáng 2",
    time: "09:30 - 11:00",
  },
  {
    id: "afternoon_1",
    code: "CA 3",
    shortBadge: "CA 3 (14h30-16h)",
    label: "Ca Chiều 1",
    time: "14:30 - 16:00",
  },
  {
    id: "afternoon_2",
    code: "CA 4",
    shortBadge: "CA 4 (16h-17h30)",
    label: "Ca Chiều 2",
    time: "16:00 - 17:30",
  },
  {
    id: "evening_1",
    code: "CA 5",
    shortBadge: "CA 5 (18h-19h30)",
    label: "Ca Tối 1",
    time: "18:00 - 19:30",
  },
  {
    id: "evening_2",
    code: "CA 6",
    shortBadge: "CA 6 (19h30-21h)",
    label: "Ca Tối 2",
    time: "19:30 - 21:00",
  },
  {
    id: "night_online",
    code: "CA 7 (ĐÊM)",
    shortBadge: "CA ĐÊM (22h-23h)",
    label: "Ca Đêm (Online)",
    time: "22:00 - 23:00",
  },
];

export type ExtendedStudentDailyReportData = StudentDailyScoreData & {
  homeworkQuizTitle?: string;
  allQuestionsReviewList?: FullQuestionReviewRow[];
  attendanceStatus?: ExtendedAttendanceStatus;
  attendanceNote?: string;
  makeupSessions?: MakeupSessionItem[];
};

export interface DayColumnScheduleItem {
  dayIndex: number; // 0 = Thứ 2 ... 6 = Chủ Nhật
  dayTitle: string; // "THỨ 2" ... "CHỦ NHẬT"
  shortDate: string; // VD: "26/10"
  isReportDay: boolean;
  sessions: {
    id: string;
    badgeText: string;
    shiftLabel: string;
    timeSlot: string;
    type: "makeup" | "support";
    note?: string;
  }[];
}

function escapeHtml(raw: any): string {
  if (raw === null || raw === undefined) return "";
  return String(raw)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatStandardScore(score: number | null | undefined): string {
  if (score === null || score === undefined || isNaN(Number(score))) {
    return "-- / 10";
  }
  return `${Number(score).toFixed(2).replace(/\.00$/, ".0")} / 10`;
}

function formatPracticeScore(score: number | null | undefined): string {
  if (
    score === null ||
    score === undefined ||
    isNaN(Number(score)) ||
    Number(score) <= 0
  ) {
    return "Không kiểm tra";
  }
  return `${Number(score).toFixed(2).replace(/\.00$/, ".0")} / 10`;
}

function resolveEffectiveAttendanceStatus(
  student: ExtendedStudentDailyReportData
): ExtendedAttendanceStatus {
  if (student.attendanceStatus) return student.attendanceStatus;
  if (student.attendance === "present") return "present";
  if (student.attendance === "late") return "makeup_done";
  return "absent_need_makeup";
}

function parseFlexibleDateString(
  rawStr: string,
  fallbackYear: number = 2026
): Date | null {
  if (!rawStr) return null;
  const clean = String(rawStr).trim();

  // Định dạng DD/MM/YYYY
  const dmyMatch = clean.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const d = Number(dmyMatch[1]);
    const m = Number(dmyMatch[2]);
    const y = Number(dmyMatch[3]);
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt.getTime())) return dt;
  }

  // Định dạng YYYY-MM-DD
  const isoMatch = clean.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    const dt = new Date(y, m - 1, d);
    if (!isNaN(dt.getTime())) return dt;
  }

  // Định dạng "Thứ 6 (06/11)" hoặc "26/10"
  const dmMatch = clean.match(/(\d{1,2})\/(\d{1,2})/);
  if (dmMatch) {
    const d = Number(dmMatch[1]);
    const m = Number(dmMatch[2]);
    const dt = new Date(fallbackYear, m - 1, d);
    if (!isNaN(dt.getTime())) return dt;
  }

  return null;
}

function formatDayMonth2Digits(dt: Date): string {
  return `${String(dt.getDate()).padStart(2, "0")}/${String(
    dt.getMonth() + 1
  ).padStart(2, "0")}`;
}

function getMondayOfWeek(dt: Date): Date {
  const copy = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const day = copy.getDay(); // 0 = CN, 1 = T2 ... 6 = T7
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

/**
 * XÂY DỰNG DỮ LIỆU LƯỚI LỊCH TUẦN 7 NGÀY (THỨ 2 -> CHỦ NHẬT) VÀ KHỚP CÁC CA ĐÃ CHỌN
 */
export function buildWeeklyCalendar7Days(
  customDateStr: string,
  makeupSessions: MakeupSessionItem[] = []
): {
  weekRangeLabel: string;
  days: DayColumnScheduleItem[];
} {
  const reportDate =
    parseFlexibleDateString(customDateStr, 2026) || new Date(2026, 9, 31);
  const reportYear = reportDate.getFullYear();

  let anchorDate = reportDate;
  if (Array.isArray(makeupSessions) && makeupSessions.length > 0) {
    const firstSessionDate = parseFlexibleDateString(
      makeupSessions[0].date,
      reportYear
    );
    if (firstSessionDate) {
      anchorDate = firstSessionDate;
    }
  }

  const monday = getMondayOfWeek(anchorDate);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const weekRangeLabel = `${formatDayMonth2Digits(
    monday
  )} — ${formatDayMonth2Digits(sunday)}`;

  const dayHeaders = [
    "THỨ 2",
    "THỨ 3",
    "THỨ 4",
    "THỨ 5",
    "THỨ 6",
    "THỨ 7",
    "CHỦ NHẬT",
  ];

  const reportShortDate = formatDayMonth2Digits(reportDate);

  const days: DayColumnScheduleItem[] = dayHeaders.map((title, idx) => {
    const curDate = new Date(monday);
    curDate.setDate(monday.getDate() + idx);
    const shortDate = formatDayMonth2Digits(curDate);

    const matchedSessions = (makeupSessions || [])
      .filter((sess) => {
        if (!sess || !sess.date) return false;
        const parsedSessDate = parseFlexibleDateString(sess.date, reportYear);
        if (parsedSessDate) {
          return formatDayMonth2Digits(parsedSessDate) === shortDate;
        }
        const norm = sess.date.toLowerCase();
        if (idx === 6 && (norm.includes("chủ nhật") || norm.includes("cn"))) {
          return true;
        }
        return norm.includes(`thứ ${idx + 2}`);
      })
      .map((sess) => {
        const stdShift = STANDARD_SUPPORT_SHIFTS.find(
          (s) => s.id === sess.shiftId
        );
        const badgeText =
          stdShift?.shortBadge || sess.shiftLabel || "CA BỔ TRỢ";
        return {
          id: sess.id,
          badgeText,
          shiftLabel: stdShift?.label || sess.shiftLabel,
          timeSlot: stdShift?.time || sess.timeSlot || "",
          type: sess.type,
          note: sess.note,
        };
      });

    return {
      dayIndex: idx,
      dayTitle: title,
      shortDate,
      isReportDay: shortDate === reportShortDate,
      sessions: matchedSessions,
    };
  });

  return { weekRangeLabel, days };
}

/**
 * DỰNG VECTOR SVG BANNER HEADER THƯƠNG HIỆU TCT (100% TÂM CHÍ TÀI - CHUẨN FONT TIMES NEW ROMAN)
 */
function renderTCTBrandHeaderHTML(): string {
  return `
    <div class="tct-brand-header">
      <svg viewBox="0 0 1068 72" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" class="tct-header-svg">
        <polygon points="8,10 152,10 138,66 0,66" fill="#F58220" />
        <polygon points="0,3 142,3 128,58 0,58" fill="#FFFFFF" stroke="#003399" stroke-width="2.4" />
        <text x="68" y="38" font-family="'Times New Roman', Times, serif" font-size="30" font-weight="bold" text-anchor="middle" fill="#003399" letter-spacing="1">TCT</text>
        <text x="66" y="53" font-family="'Times New Roman', Times, serif" font-size="9.5" font-weight="bold" text-anchor="middle" fill="#003399" letter-spacing="1">TÂM CHÍ TÀI</text>

        <text x="372" y="29" font-family="'Times New Roman', Times, serif" font-size="18" font-style="italic" font-weight="bold" text-anchor="middle" fill="#003399">
          Chuyên luyện thi vào 10, HSA, TSA và THPT
        </text>
        <text x="372" y="50" font-family="'Times New Roman', Times, serif" font-size="13" font-weight="bold" text-anchor="middle" fill="#1E293B">
          Hotline: 0972 26 16 16  •  Đ/c: Số 10, Tạ Quang Bửu, Bách Khoa, Hà Nội
        </text>

        <polygon points="586,18 628,18 613,54 571,54" fill="#F58220" />
        <polygon points="642,18 684,18 669,54 627,54" fill="#F58220" />

        <polygon points="700,18 1065,18 1065,54 685,54" fill="#FFFFFF" stroke="#003399" stroke-width="2" />
        <text x="878" y="41" font-family="'Times New Roman', Times, serif" font-size="16" font-style="italic" font-weight="bold" text-anchor="middle" fill="#003399">
          Chuyên Toán Tư Duy - Trắc Nghiệm Tia Chớp
        </text>
      </svg>
    </div>
  `;
}

/**
 * DỰNG THANH CHÂN TRANG (FOOTER) CHUẨN THƯƠNG HIỆU TRUNG TÂM TCT (KHÔNG DÙNG QR ZALO)
 */
function renderTCTBrandFooterHTML(
  pageNumberLabel: string,
  studentQuickTag: string
): string {
  return `
    <div class="tct-brand-footer">
      <div class="tct-footer-bar">
        <div class="tct-footer-brand-text">
          TRUNG TÂM TOÁN TÂM CHÍ TÀI (TCT) &bull; Hotline: 0972 26 16 16 &bull; Địa chỉ: Số 10, Tạ Quang Bửu, Bách Khoa, Hà Nội
        </div>
        <div class="tct-footer-meta">
          <span class="tct-footer-stu-tag">${escapeHtml(studentQuickTag)}</span>
          <span class="tct-footer-page-badge">${escapeHtml(pageNumberLabel)}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * DỰNG LỚP PHỦ VECTOR SVG KHOANH XANH LÁ (ĐÚNG) / ĐỎ (SAI) / VÀNG HỔ PHÁCH NÉT ĐỨT (ĐÁP ÁN ĐÚNG KHI LÀM SAI HOẶC BỎ TRỐNG) / XANH DƯƠNG (SBD & MÃ ĐỀ)
 */
function renderOMROverlaySVG(student: StudentDailyScoreData): string {
  const coords = student.bubbleCoordinates;
  if (!Array.isArray(coords) || coords.length === 0) return "";

  const W = student.canonicalWidth || OMR_CANONICAL_WIDTH;
  const H = student.canonicalHeight || OMR_CANONICAL_HEIGHT;

  const activeBubbles = coords.filter((b) => b && b.status !== "unfilled");
  if (activeBubbles.length === 0) return "";

  const circlesHtml = activeBubbles
    .map((b) => {
      const isSbdOrCode = b.section === "sbd" || b.section === "exam_code";
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

      const dashAttr = isExpectedMissed ? `stroke-dasharray="4 2"` : "";

      return `<circle cx="${b.x}" cy="${b.y}" r="${
        (b.r || 9) + 2.5
      }" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2.4" ${dashAttr} />`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" shape-rendering="geometricPrecision" class="omr-overlay-svg">
      ${circlesHtml}
    </svg>
  `;
}

/**
 * GIẢI MÃ CHUỖI MỆNH ĐỀ PHẦN II ("a)Đ b)S c)Đ d)S") THÀNH BẢN ĐỒ { a, b, c, d }
 */
function parsePart2SubMap(
  rawStr: string
): Record<"a" | "b" | "c" | "d", "Đ" | "S" | "-"> {
  const res: Record<"a" | "b" | "c" | "d", "Đ" | "S" | "-"> = {
    a: "-",
    b: "-",
    c: "-",
    d: "-",
  };
  if (!rawStr) return res;
  (["a", "b", "c", "d"] as const).forEach((k) => {
    const m = rawStr.match(new RegExp(`${k}\\)?\\s*([ĐDSSTF-])`, "i"));
    if (m && m[1]) {
      const ch = m[1].toUpperCase();
      if (ch === "Đ" || ch === "D" || ch === "T") res[k] = "Đ";
      else if (ch === "S" || ch === "F") res[k] = "S";
    }
  });
  return res;
}

/**
 * RENDER 4 BADGE RIÊNG BIỆT CHO CÂU HỎI ĐÚNG/SAI (PHẦN II):
 * - Ý nào đúng: in nền xanh lá chữ trắng `[a) Đ]`
 * - Ý nào sai: in nền đỏ chữ trắng `[d) Đ ➔ S]` (hoặc `[d) Trống ➔ S]`)
 */
function renderPart2SubBadgesHTML(
  studentAnswerStr: string,
  correctAnswerStr: string
): string {
  const stuMap = parsePart2SubMap(studentAnswerStr);
  const corMap = parsePart2SubMap(correctAnswerStr);

  const badges = (["a", "b", "c", "d"] as const)
    .map((k) => {
      const sVal = stuMap[k];
      const cVal = corMap[k] === "-" ? (k === "a" || k === "c" ? "Đ" : "S") : corMap[k];
      const isSubRight = sVal !== "-" && sVal === cVal;

      if (isSubRight) {
        return `<span class="p2-sub-badge p2-sub-badge-ok">[${k}) ${sVal}]</span>`;
      }
      const sLabel = sVal === "-" ? "_" : sVal;
      return `<span class="p2-sub-badge p2-sub-badge-err">[${k}) ${sLabel} &#10140; ${cVal}]</span>`;
    })
    .join(" ");

  return `<div class="p2-badges-wrap">${badges}</div>`;
}

/**
 * DỰNG TRANG BÌA TỔNG KẾT ĐIỂM CẢ LỚP
 */
function renderClassSummaryCoverPageHTML(
  config: DailyReportConfig & { homeworkTopicLabel?: string },
  students: ExtendedStudentDailyReportData[]
): string {
  const effectiveTopic =
    (config.overrideTopicTitle && config.overrideTopicTitle.trim()) ||
    config.topicTitle ||
    "Chuyên đề Toán Tư Duy & Trắc Nghiệm Tia Chớp";

  const rowsHtml = students
    .map((stu, idx) => {
      const attStatus = resolveEffectiveAttendanceStatus(stu);
      const sessions = Array.isArray(stu.makeupSessions) ? stu.makeupSessions : [];
      const firstMakeupDate = sessions.length > 0 ? sessions[0].date : "";

      let attBadge = `<span style="color:#047857; font-weight:bold;">✓ Có mặt</span>`;
      if (attStatus === "makeup_done") {
        attBadge = `<span style="color:#B45309; font-weight:bold;">↺ Nghỉ (Đã bù)</span>`;
      } else if (attStatus === "absent_need_makeup" || attStatus === "absent") {
        attBadge = firstMakeupDate
          ? `<span style="color:#DC2626; font-weight:bold;">⚠️ Vắng (Hẹn bù ${escapeHtml(
              firstMakeupDate
            )})</span>`
          : `<span style="color:#DC2626; font-weight:bold;">⚠️ Vắng (Chưa bù)</span>`;
      }

      const pracDisplay =
        stu.practiceScore !== null &&
        stu.practiceScore !== undefined &&
        Number(stu.practiceScore) > 0
          ? `${stu.practiceScore}đ`
          : "Không KT";

      return `
        <tr>
          <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
          <td style="text-align:center; font-weight:bold; color:#003399;">${escapeHtml(
            stu.sbd
          )}</td>
          <td style="font-weight:bold;">${escapeHtml(stu.studentName)}</td>
          <td>${escapeHtml(stu.school)}</td>
          <td style="text-align:center; font-weight:bold; color:#047857;">${
            stu.homeworkScore !== null && stu.homeworkScore !== undefined
              ? `${stu.homeworkScore}đ`
              : "--"
          }</td>
          <td style="text-align:center; font-weight:bold; color:#1D4ED8;">${
            stu.dailyTestScore !== null && stu.dailyTestScore !== undefined
              ? `${stu.dailyTestScore}đ`
              : "Chưa KT"
          }</td>
          <td style="text-align:center; font-weight:bold; color:#C2410C;">${pracDisplay}</td>
          <td style="text-align:center;">${attBadge}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <section class="a4-page page-break">
      <div class="a4-inner">
        ${renderTCTBrandHeaderHTML()}

        <div class="report-title-banner">
          <h1>BẢNG TỔNG HỢP KẾT QUẢ HỌC TẬP CẢ LỚP (${students.length} HỌC VIÊN)</h1>
          <div class="report-subtitle">
            Ngày học: <strong>${escapeHtml(config.customDateStr)}</strong>  •  Tuần ${
    config.selectedWeek
  } - Tháng ${config.selectedMonth}  •  Chuyên đề hôm nay: <strong>${escapeHtml(
    effectiveTopic
  )}</strong>
          </div>
        </div>

        <table class="summary-cover-table">
          <thead>
            <tr>
              <th style="width:38px; text-align:center;">STT</th>
              <th style="width:76px; text-align:center;">SBD</th>
              <th>Họ và tên học sinh</th>
              <th>Trường THPT</th>
              <th style="width:72px; text-align:center;">Điểm BTVN</th>
              <th style="width:76px; text-align:center;">Test Ngày</th>
              <th style="width:80px; text-align:center;">Đề Tháng</th>
              <th style="width:155px; text-align:center;">Chuyên Cần</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        ${renderTCTBrandFooterHTML("Mục lục Lớp", `Tổng số: ${students.length} học sinh`)}
      </div>
    </section>
  `;
}

/**
 * DỰNG TRANG 1: PHIẾU BÁO CÁO KẾT QUẢ BUỔI HỌC CỦA TỪNG HỌC SINH
 */
function renderSingleStudentDailyReportPageHTML(
  config: DailyReportConfig & { homeworkTopicLabel?: string },
  student: ExtendedStudentDailyReportData,
  studentOrder: number,
  totalStudents: number
): string {
  const effectiveTopic =
    (config.overrideTopicTitle && config.overrideTopicTitle.trim()) ||
    config.topicTitle ||
    "Chuyên đề Toán Tư Duy & Luyện Đề Thực Chiến";

  const hasValidHwScore =
    student.homeworkScore !== null &&
    student.homeworkScore !== undefined &&
    !isNaN(Number(student.homeworkScore));

  const hwTitleLabel =
    student.homeworkQuizTitle ||
    config.homeworkTopicLabel ||
    "Bài tập về nhà buổi trước";

  const hwSubLabel =
    student.homeworkCorrect !== null &&
    student.homeworkCorrect !== undefined &&
    student.homeworkTotal
      ? `BTVN tuần trước: ${hwTitleLabel} (Đúng ${student.homeworkCorrect}/${student.homeworkTotal} câu)`
      : hasValidHwScore
      ? `BTVN tuần trước: ${hwTitleLabel}`
      : `Chưa nộp BTVN tuần trước (${hwTitleLabel})`;

  const hasValidTestReview = Boolean(
    student.dailyTestScore !== null &&
      student.dailyTestScore !== undefined &&
      !isNaN(Number(student.dailyTestScore)) &&
      student.hasPaperOMR
  );

  const hasDailyTestScore =
    student.dailyTestScore !== null &&
    student.dailyTestScore !== undefined &&
    !isNaN(Number(student.dailyTestScore));

  const testMainValueHtml = hasDailyTestScore
    ? `<div class="score-card-value">${formatStandardScore(student.dailyTestScore)}</div>`
    : `<div class="score-card-value score-card-untested">CHƯA KIỂM TRA</div>`;

  const testSubLabel = hasDailyTestScore
    ? student.dailyTestCorrect !== null &&
      student.dailyTestCorrect !== undefined &&
      student.dailyTestTotal
      ? `Kiểm tra buổi hôm nay: Đúng ${student.dailyTestCorrect}/${student.dailyTestTotal} câu (Đối soát OMR Trang 2)`
      : "Kiểm tra định kỳ tại lớp hôm nay"
    : "Chưa tham gia kiểm tra buổi này";

  const hasPracticeExam =
    student.practiceScore !== null &&
    student.practiceScore !== undefined &&
    !isNaN(Number(student.practiceScore)) &&
    Number(student.practiceScore) > 0;

  const practiceSubLabel = hasPracticeExam
    ? student.practiceExamTitle ||
      config.practiceExamTitle ||
      `Đề thực chiến Tháng ${config.selectedMonth}`
    : "Không tổ chức kiểm tra đề tháng";

  const p1Display = student.part1Score || "Đã tổng hợp vào điểm chung";
  const p2Display = student.part2Score || "Đã tổng hợp vào điểm chung";
  const p3Display = student.part3Score || "Đã tổng hợp vào điểm chung";

  // MỤC 4: Nếu chưa kiểm tra, hiển thị khối thông báo tinh tế thay vì bảng trống
  const section4ContentHtml = hasDailyTestScore
    ? `
      <table class="parts-breakdown-table">
        <thead>
          <tr>
            <th style="width:140px;">Cấu trúc phần thi</th>
            <th>Dạng thức câu hỏi</th>
            <th style="width:230px; text-align:center;">Kết quả đạt được</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Phần I</strong></td>
            <td>Trắc nghiệm nhiều phương án lựa chọn (A, B, C, D)</td>
            <td style="text-align:center; font-weight:bold; color:#003399;">${escapeHtml(
              p1Display
            )}</td>
          </tr>
          <tr>
            <td><strong>Phần II</strong></td>
            <td>Trắc nghiệm Đúng / Sai (4 mệnh đề a, b, c, d mỗi câu)</td>
            <td style="text-align:center; font-weight:bold; color:#003399;">${escapeHtml(
              p2Display
            )}</td>
          </tr>
          <tr>
            <td><strong>Phần III</strong></td>
            <td>Trả lời ngắn — Điền đáp số toán học thực tế</td>
            <td style="text-align:center; font-weight:bold; color:#003399;">${escapeHtml(
              p3Display
            )}</td>
          </tr>
        </tbody>
      </table>
    `
    : `
      <div class="untested-sync-notice">
        <div class="untested-sync-icon">📅</div>
        <div class="untested-sync-text">
          Buổi học này học sinh chưa tham gia làm bài kiểm tra định kỳ tại lớp. Hệ thống đã đồng bộ chuyển sang trang <strong>Lịch Học Bù &amp; Bổ Trợ Kiến Thức</strong>.
        </div>
      </div>
    `;

  const attStatus = resolveEffectiveAttendanceStatus(student);

  // MỤC 5: Render DUY NHẤT 1 BADGE TRẠNG THÁI CHÍNH THỨC của học sinh
  let singleOfficialAttendanceBadgeHtml = "";
  if (attStatus === "present") {
    singleOfficialAttendanceBadgeHtml = `
      <div class="official-single-badge badge-att-green">
        ✓ CHUYÊN CẦN: CÓ MẶT ĐÚNG GIỜ &bull; THÁI ĐỘ HỌC TẬP TỐT
      </div>
    `;
  } else if (attStatus === "makeup_done") {
    singleOfficialAttendanceBadgeHtml = `
      <div class="official-single-badge badge-att-amber">
        &#8634; NGHỈ BUỔI CHÍNH &bull; ĐÃ HOÀN THÀNH HỌC BÙ &amp; BTVN
      </div>
    `;
  } else {
    singleOfficialAttendanceBadgeHtml = `
      <div class="official-single-badge badge-att-red">
        ⚠️ NGHỈ BUỔI CHÍNH &bull; ĐÃ XẾP LỊCH HẸN HỌC BÙ (CHI TIẾT TRANG 2)
      </div>
    `;
  }

  let singleOfficialHomeworkBadgeHtml = "";
  if (student.homeworkStatus === "completed") {
    singleOfficialHomeworkBadgeHtml = `
      <div class="official-single-badge badge-hw-green">
        ✓ Ý THỨC BTVN: HOÀN THÀNH ĐẦY ĐỦ BÀI TẬP VỀ NHÀ ĐÚNG HẠN
      </div>
    `;
  } else if (student.homeworkStatus === "late") {
    singleOfficialHomeworkBadgeHtml = `
      <div class="official-single-badge badge-hw-amber">
        ⚠️ Ý THỨC BTVN: ĐÃ NỘP BÀI TẬP VỀ NHÀ (NỘP MUỘN HƠN QUY ĐỊNH)
      </div>
    `;
  } else {
    singleOfficialHomeworkBadgeHtml = `
      <div class="official-single-badge badge-hw-red">
        ✕ Ý THỨC BTVN: CHƯA HOÀN THÀNH ĐẦY ĐỦ BTVN TUẦN TRƯỚC — CẦN BỔ SUNG NGAY
      </div>
    `;
  }

  const sessions = Array.isArray(student.makeupSessions) ? student.makeupSessions : [];
  const scheduledQuickNoteHtml =
    sessions.length > 0
      ? `
        <div class="makeup-scheduled-callout">
          <strong>📅 Lịch hẹn Học bù / Bổ trợ đã xếp (${sessions.length} ca):</strong>
          ${sessions
            .map(
              (s) =>
                `${escapeHtml(s.date)} — ${escapeHtml(s.shiftLabel)} (${
                  s.type === "makeup" ? "Học bù bài vắng" : "Bổ trợ kiến thức"
                }${s.note ? `: ${escapeHtml(s.note)}` : ""})`
            )
            .join("  •  ")}
          <em>(Xem bảng lịch tuần chi tiết ở Trang 2)</em>
        </div>
      `
      : "";

  return `
    <section class="a4-page page-break">
      <div class="a4-inner">
        ${renderTCTBrandHeaderHTML()}

        <div class="report-title-banner">
          <h1>PHIẾU BÁO CÁO KẾT QUẢ BUỔI HỌC</h1>
          <div class="report-subtitle">
            Ngày học: <strong>${escapeHtml(config.customDateStr)}</strong>  •  Tuần ${
    config.selectedWeek
  } - Tháng ${config.selectedMonth}
          </div>
        </div>

        <!-- 1. THÔNG TIN HỌC VIÊN -->
        <div class="section-box">
          <div class="section-header">1. THÔNG TIN HỌC VIÊN</div>
          <div class="student-info-grid">
            <div><span class="info-label">Họ và tên thí sinh:</span> <strong class="info-value-primary">${escapeHtml(
              student.studentName
            )}</strong></div>
            <div><span class="info-label">Số báo danh (SBD):</span> <strong class="sbd-badge">${escapeHtml(
              student.sbd
            )}</strong></div>
            <div><span class="info-label">Trường THPT:</span> <strong>${escapeHtml(
              student.school || "THPT"
            )}</strong></div>
            <div><span class="info-label">Lớp / Khối:</span> <strong>${escapeHtml(
              student.grade || "Lớp 12"
            )}</strong></div>
            <div><span class="info-label">Phân hệ theo học:</span> <strong>Học sinh ${escapeHtml(
              student.learningMode
            )}</strong></div>
            <div><span class="info-label">Hồ sơ báo cáo:</span> <strong>#${studentOrder}/${totalStudents} (Trang 1/2)</strong></div>
          </div>
        </div>

        <!-- 2. NỘI DUNG CHUYÊN ĐỀ BUỔI HỌC HÔM NAY -->
        <div class="section-box topic-highlight-box">
          <div class="section-header">2. NỘI DUNG CHUYÊN ĐỀ BUỔI HỌC HÔM NAY (TUẦN ${
            config.selectedWeek
          } - THÁNG ${config.selectedMonth})</div>
          <div class="topic-title-main">
            📘 Chuyên đề: ${escapeHtml(effectiveTopic.toUpperCase())}
          </div>
          <div class="topic-subnote">
            BTVN thu &amp; đối soát trong buổi hôm nay: <strong>${escapeHtml(
              hwTitleLabel
            )}</strong>
          </div>
        </div>

        <!-- 3. KẾT QUẢ ĐIỂM SỐ TRONG NGÀY (3 CỘT TÁCH BIỆT NGUỒN) -->
        <div class="section-box">
          <div class="section-header">3. KẾT QUẢ ĐIỂM SỐ ĐÁNH GIÁ TRONG NGÀY</div>
          <div class="scores-three-cols">
            <div class="score-card score-card-green">
              <div class="score-card-title">1. ĐIỂM BÀI TẬP VỀ NHÀ</div>
              <div class="score-card-value">${formatStandardScore(student.homeworkScore)}</div>
              <div class="score-card-sub">${escapeHtml(hwSubLabel)}</div>
            </div>

            <div class="score-card score-card-blue">
              <div class="score-card-title">2. BÀI KIỂM TRA TẠI LỚP</div>
              ${testMainValueHtml}
              <div class="score-card-sub">${escapeHtml(testSubLabel)}</div>
            </div>

            <div class="score-card score-card-orange">
              <div class="score-card-title">3. ĐỀ LUYỆN THI THỰC CHIẾN</div>
              <div class="score-card-value ${
                hasPracticeExam ? "" : "score-card-value-muted"
              }">${formatPracticeScore(student.practiceScore)}</div>
              <div class="score-card-sub">${escapeHtml(practiceSubLabel)}</div>
            </div>
          </div>
        </div>

        <!-- 4. ĐÁNH GIÁ CHI TIẾT CÁC PHẦN KIỂM TRA TẠI LỚP -->
        <div class="section-box">
          <div class="section-header">4. PHÂN TÍCH CẤU TRÚC BÀI KIỂM TRA TẠI LỚP THEO FORM MỚI BỘ GD&amp;ĐT</div>
          ${section4ContentHtml}
        </div>

        <!-- 5. NHẬN XÉT CỦA GIÁO VIÊN & BADGE CHUYÊN CẦN DUY NHẤT -->
        <div class="section-box" style="margin-bottom:auto;">
          <div class="section-header">5. NHẬN XÉT CỦA GIÁO VIÊN &amp; TÌNH HÌNH CHUYÊN CẦN TRONG NGÀY</div>
          <div class="teacher-comment-box">
            "${escapeHtml(
              student.teacherComment ||
                `Em ${student.studentName} có ý thức học tập nghiêm túc trên lớp, nắm được phương pháp giải các dạng toán trọng tâm của buổi học. Gia đình nhắc nhở con duy trì luyện tập đều đặn các câu vận dụng để tối ưu tốc độ làm bài.`
            )}"
          </div>

          ${scheduledQuickNoteHtml}

          <div class="single-badges-stack">
            ${singleOfficialAttendanceBadgeHtml}
            ${singleOfficialHomeworkBadgeHtml}
          </div>
        </div>

        ${renderTCTBrandFooterHTML(
          `Trang 1/2 • HS ${studentOrder}/${totalStudents}`,
          `${student.studentName} • SBD: ${student.sbd} (${
            hasValidTestReview
              ? "Xem tiếp Phiếu OMR & Đối soát ở Trang 2"
              : "Xem tiếp Lịch Học Bù & Bổ Trợ ở Trang 2"
          })`
        )}
      </div>
    </section>
  `;
}

/**
 * KHỐI LỊCH TUẦN 7 NGÀY THU GỌN Ở ĐÁY TRANG 2 (DÙNG CHO KỊCH BẢN A: CÓ BÀI THI OMR)
 */
function renderBottomMakeupScheduleSectionHTML(
  config: DailyReportConfig & { homeworkTopicLabel?: string },
  student: ExtendedStudentDailyReportData
): string {
  const sessions: MakeupSessionItem[] = Array.isArray(student.makeupSessions)
    ? student.makeupSessions
    : [];

  const { weekRangeLabel, days } = buildWeeklyCalendar7Days(
    config.customDateStr,
    sessions
  );

  const hasMakeup = sessions.some((s) => s.type === "makeup");
  const hasSupport = sessions.some((s) => s.type === "support");

  const sessionsSummaryText = sessions
    .map((s) => `${s.date} - ${s.shiftLabel}`)
    .join("; ");

  const purposeText =
    hasMakeup && hasSupport
      ? "học bù & bổ trợ"
      : hasMakeup
      ? "học bù bài vắng"
      : "bổ trợ tăng cường";

  const alertBoxHtml =
    sessions.length > 0
      ? `
        <div class="weekly-alert-bar">
          <span>📌</span>
          <div>
            Kính gửi phụ huynh, học sinh <strong>${escapeHtml(
              student.studentName
            )}</strong> có lịch <strong>${purposeText}</strong> vào: <strong>${escapeHtml(
          sessionsSummaryText
        )}</strong>. Kính mong phụ huynh nhắc con đi học đúng giờ.
          </div>
        </div>
      `
      : `
        <div class="weekly-alert-bar">
          <span>📌</span>
          <div>
            Học sinh <strong>${escapeHtml(
              student.studentName
            )}</strong> tham gia học chính khóa đầy đủ. Khung lịch dưới đây hiển thị các ca bổ trợ / giải đáp bài tập định kỳ trong tuần của TCT.
          </div>
        </div>
      `;

  const sevenDayColumnsHtml = days
    .map((dayCol) => {
      const hasScheduled = dayCol.sessions.length > 0;
      const isMakeupDay = dayCol.sessions.some((s) => s.type === "makeup");

      const colCardClass = hasScheduled
        ? isMakeupDay
          ? "day-col-card day-col-makeup"
          : "day-col-card day-col-support"
        : dayCol.isReportDay
        ? "day-col-card day-col-today"
        : "day-col-card day-col-empty";

      const todayPill =
        dayCol.isReportDay && !hasScheduled
          ? `<span class="day-today-badge">HÔM NAY</span>`
          : "";

      const bodyHtml = hasScheduled
        ? `<div class="day-sessions-stack">
            ${dayCol.sessions
              .slice(0, 2)
              .map(
                (sess) => `
                  <div class="day-session-pill ${
                    sess.type === "makeup"
                      ? "pill-makeup-orange"
                      : "pill-support-blue"
                  }">
                    <div class="pill-shift-code">${escapeHtml(
                      sess.badgeText
                    )}</div>
                    <div class="pill-shift-type">${
                      sess.type === "makeup" ? "Học bù" : "Bổ trợ"
                    }</div>
                  </div>
                `
              )
              .join("")}
          </div>`
        : `<div class="day-empty-label">Không có ca học</div>`;

      return `
        <div class="${colCardClass}">
          <div class="day-col-header">
            <div class="day-col-top-line">
              <span class="day-title-text">${escapeHtml(dayCol.dayTitle)}</span>
              ${todayPill}
            </div>
            <div class="day-date-text">${escapeHtml(dayCol.shortDate)}</div>
          </div>
          ${bodyHtml}
        </div>
      `;
    })
    .join("");

  const standardShiftPillsHtml = STANDARD_SUPPORT_SHIFTS.map(
    (s) => `
      <div class="std-shift-mini-pill">
        <span class="std-pill-code">${escapeHtml(s.code)}:</span>
        <span class="std-pill-time">${escapeHtml(s.time)}</span>
      </div>
    `
  ).join("");

  return `
    <div class="bottom-weekly-schedule-container">
      <div class="weekly-header-bar">
        <div class="weekly-title-group">
          <span class="weekly-main-title">BẢNG LỊCH HỌC BÙ &amp; BỔ TRỢ TĂNG CƯỜNG KIẾN THỨC TRONG TUẦN</span>
          <span class="weekly-date-range-badge">${escapeHtml(
            weekRangeLabel
          )}</span>
        </div>
        <div class="weekly-legend-group">
          <span class="legend-tag-orange">■ Màu Cam: Học bù bài vắng</span>
          <span class="legend-tag-blue">■ Màu Xanh: Bổ trợ / Online đêm</span>
        </div>
      </div>

      ${alertBoxHtml}

      <div class="weekly-seven-cols-grid">
        ${sevenDayColumnsHtml}
      </div>

      <div class="weekly-std-shifts-bar">
        <div class="std-shifts-label">🕒 7 KHUNG GIỜ CA HỌC CHUẨN XÁC ĐỊNH TRƯỚC TẠI TCT:</div>
        <div class="std-shifts-pills-row">
          ${standardShiftPillsHtml}
        </div>
      </div>
    </div>
  `;
}

/**
 * KỊCH BẢN B (SMART ADAPTIVE LAYOUT - hasValidTestReview === false):
 * - ẨN HOÀN TOÀN KHUNG PHIẾU OMR & BẢNG 22 CÂU HỎI.
 * - PHÓNG TO BẢNG LỊCH HỌC BÙ & BỔ TRỢ TĂNG CƯỜNG TCT CHIẾM TOÀN BỘ NỬA TRÊN TRANG 2.
 * - NỬA DƯỚI TRANG 2: 2 KHỐI NỘI DUNG THỰC CHIẾN ("KẾ HOẠCH HỌC TẬP & MỤC TIÊU RÈN LUYỆN TRỌNG TÂM TUẦN TỚI" + "QUY ĐỊNH HỌC BÙ & HỖ TRỢ HỌC SINH TẠI TCT").
 */
function renderScenarioBExpandedScheduleAndActionPlanHTML(
  config: DailyReportConfig & { homeworkTopicLabel?: string },
  student: ExtendedStudentDailyReportData,
  effectiveTopic: string
): string {
  const sessions: MakeupSessionItem[] = Array.isArray(student.makeupSessions)
    ? student.makeupSessions
    : [];

  const { weekRangeLabel, days } = buildWeeklyCalendar7Days(
    config.customDateStr,
    sessions
  );

  const hwTitleLabel =
    student.homeworkQuizTitle ||
    config.homeworkTopicLabel ||
    `BTVN Chuyên đề ${effectiveTopic}`;

  const sessionsSummaryText = sessions
    .map(
      (s) =>
        `${s.date} — ${s.shiftLabel}${s.note ? ` (${s.note})` : ""}`
    )
    .join("; ");

  const expandedAlertHtml =
    sessions.length > 0
      ? `
        <div class="expanded-schedule-alert alert-has-sessions">
          <div class="expanded-alert-icon">📌</div>
          <div class="expanded-alert-content">
            <strong>THÔNG BÁO LỊCH HẸN HỌC BÙ / BỔ TRỢ GỬI PHỤ HUYNH:</strong>
            Học sinh <strong>${escapeHtml(
              student.studentName
            )}</strong> (SBD: <strong>${escapeHtml(
          student.sbd
        )}</strong>) đã được xếp lịch học tại Trung tâm vào: <strong>${escapeHtml(
          sessionsSummaryText
        )}</strong>. Kính mong Gia đình nhắc con đến đúng khung giờ ca hẹn để đảm bảo tiến độ chuyên đề <strong>"${escapeHtml(
          effectiveTopic
        )}"</strong>.
          </div>
        </div>
      `
      : `
        <div class="expanded-schedule-alert alert-no-sessions">
          <div class="expanded-alert-icon">📅</div>
          <div class="expanded-alert-content">
            <strong>THÔNG BÁO LỊCH BỔ TRỢ &amp; HỌC BÙ ĐỊNH KỲ TRONG TUẦN:</strong>
            Buổi học ngày <strong>${escapeHtml(
              config.customDateStr
            )}</strong> học sinh <strong>${escapeHtml(
          student.studentName
        )}</strong> chưa có bài kiểm tra định kỳ tại lớp. Phụ huynh và học sinh theo dõi bảng các khung giờ ca học bù &amp; bổ trợ tiêu chuẩn dưới đây để đăng ký tham gia ôn tập chuyên đề <strong>"${escapeHtml(
          effectiveTopic
        )}"</strong>.
          </div>
        </div>
      `;

  const expandedSevenColsHtml = days
    .map((dayCol) => {
      const hasScheduled = dayCol.sessions.length > 0;
      const isMakeupDay = dayCol.sessions.some((s) => s.type === "makeup");

      const colClass = hasScheduled
        ? isMakeupDay
          ? "exp-day-col exp-day-makeup"
          : "exp-day-col exp-day-support"
        : dayCol.isReportDay
        ? "exp-day-col exp-day-today"
        : "exp-day-col exp-day-empty";

      const todayTag =
        dayCol.isReportDay && !hasScheduled
          ? `<span class="exp-today-pill">BUỔI CHÍNH</span>`
          : "";

      const sessionsBodyHtml = hasScheduled
        ? `<div class="exp-sessions-list">
            ${dayCol.sessions
              .map(
                (sess) => `
                  <div class="exp-session-card ${
                    sess.type === "makeup"
                      ? "exp-card-orange"
                      : "exp-card-blue"
                  }">
                    <div class="exp-sess-type-tag">
                      ${
                        sess.type === "makeup"
                          ? "🟧 HỌC BÙ BÀI VẮNG"
                          : "🟦 BỔ TRỢ TĂNG CƯỜNG"
                      }
                    </div>
                    <div class="exp-sess-time">
                      🕒 ${escapeHtml(sess.timeSlot || sess.badgeText)}
                    </div>
                    <div class="exp-sess-shift-name">
                      ${escapeHtml(sess.shiftLabel)}
                    </div>
                    <div class="exp-sess-topic">
                      📘 Bài: ${escapeHtml(
                        sess.note || effectiveTopic
                      )}
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>`
        : `
          <div class="exp-empty-slot">
            <div class="exp-empty-circle">—</div>
            <div class="exp-empty-text">Chưa xếp ca hẹn riêng</div>
            <div class="exp-empty-sub">Mở các ca chuẩn 1 &rarr; 7</div>
          </div>
        `;

      return `
        <div class="${colClass}">
          <div class="exp-day-header">
            <div class="exp-day-title-row">
              <span class="exp-day-name">${escapeHtml(dayCol.dayTitle)}</span>
              ${todayTag}
            </div>
            <div class="exp-day-date">${escapeHtml(dayCol.shortDate)}</div>
          </div>
          ${sessionsBodyHtml}
        </div>
      `;
    })
    .join("");

  const stdShiftsGridHtml = STANDARD_SUPPORT_SHIFTS.map(
    (s) => `
      <div class="exp-std-shift-box">
        <div class="exp-std-code">${escapeHtml(s.code)} — ${escapeHtml(
      s.label
    )}</div>
        <div class="exp-std-time">${escapeHtml(s.time)}</div>
      </div>
    `
  ).join("");

  return `
    <div class="scenario-b-wrapper">
      <!-- NỬA TRÊN TRANG 2: BẢNG LỊCH HỌC BÙ & BỔ TRỢ TĂNG CƯỜNG TCT PHÓNG TO -->
      <div class="expanded-schedule-master-box">
        <div class="expanded-schedule-top-header">
          <div>
            <div class="expanded-schedule-title">
              BẢNG LỊCH HỌC BÙ &amp; BỔ TRỢ TĂNG CƯỜNG KIẾN THỨC TẠI TRUNG TÂM TOÁN TÂM CHÍ TÀI (TCT)
            </div>
            <div class="expanded-schedule-sub">
              Tuần áp dụng: <strong>${escapeHtml(
                weekRangeLabel
              )}</strong> &bull; Chuyên đề cần nắm vững: <strong>${escapeHtml(
    effectiveTopic
  )}</strong>
            </div>
          </div>
          <div class="expanded-schedule-legends">
            <span class="exp-legend-orange">■ Cam: Ca Học bù bài vắng</span>
            <span class="exp-legend-blue">■ Xanh: Ca Bổ trợ tăng cường</span>
          </div>
        </div>

        ${expandedAlertHtml}

        <div class="expanded-seven-days-grid">
          ${expandedSevenColsHtml}
        </div>

        <div class="expanded-std-shifts-panel">
          <div class="expanded-std-shifts-title">
            🕒 Khung giờ 7 Ca học bù &amp; Bổ trợ cố định hàng tuần tại Trung tâm Toán Tâm Chí Tài:
          </div>
          <div class="expanded-std-shifts-row">
            ${stdShiftsGridHtml}
          </div>
        </div>
      </div>

      <!-- NỬA DƯỚI TRANG 2: 2 KHỐI HỘP NỘI DUNG THỰC CHIẾN ĐẦY ĐẶN, CHUYÊN NGHIỆP -->
      <div class="scenario-b-bottom-two-boxes">
        <!-- KHỐI 1: KẾ HOẠCH HỌC TẬP & MỤC TIÊU RÈN LUYỆN TRỌNG TÂM TUẦN TỚI -->
        <div class="action-plan-box">
          <div class="action-plan-header">
            1. KẾ HOẠCH HỌC TẬP &amp; MỤC TIÊU RÈN LUYỆN TRỌNG TÂM TUẦN TỚI
          </div>
          <div class="action-plan-body">
            <div class="plan-bullet-item">
              <span class="plan-bullet-num">01</span>
              <div class="plan-bullet-text">
                <strong>Ôn tập lý thuyết &amp; dạng toán trọng tâm:</strong> Hệ thống hóa toàn bộ công thức cốt lõi, phương pháp giải nhanh và các bẫy sai lầm thường gặp của chuyên đề <strong>"${escapeHtml(
                  effectiveTopic
                )}"</strong> (Tuần ${config.selectedWeek} - Tháng ${
    config.selectedMonth
  }).
              </div>
            </div>
            <div class="plan-bullet-item">
              <span class="plan-bullet-num">02</span>
              <div class="plan-bullet-text">
                <strong>Hoàn thành &amp; quy định nộp Bài tập về nhà:</strong> Học sinh tự giác hoàn thành 100% phiếu bài tập <strong>"${escapeHtml(
                  hwTitleLabel
                )}"</strong>, trình bày rõ ràng các bước biến đổi và nộp đúng hạn trước khi bắt đầu buổi học chính khóa kế tiếp.
              </div>
            </div>
            <div class="plan-bullet-item">
              <span class="plan-bullet-num">03</span>
              <div class="plan-bullet-text">
                <strong>Rèn luyện kỹ năng làm đề cấu trúc mới 3 Phần:</strong> Chủ động bấm giờ tự luyện tại nhà tối thiểu 45–60 phút/ngày cho cả 3 dạng thức: Trắc nghiệm nhiều lựa chọn (Phần I), Trắc nghiệm Đúng/Sai 4 ý (Phần II) và Điền đáp số trả lời ngắn (Phần III).
              </div>
            </div>
          </div>
        </div>

        <!-- KHỐI 2: QUY ĐỊNH HỌC BÙ & HỖ TRỢ HỌC SINH TẠI TRUNG TÂM TOÁN TÂM CHÍ TÀI (TCT) -->
        <div class="action-plan-box regulation-box-accent">
          <div class="action-plan-header">
            2. QUY ĐỊNH HỌC BÙ &amp; HỖ TRỢ HỌC SINH TẠI TRUNG TÂM TOÁN TÂM CHÍ TÀI (TCT)
          </div>
          <div class="action-plan-body">
            <div class="plan-bullet-item">
              <span class="plan-bullet-num reg-num">A</span>
              <div class="plan-bullet-text">
                <strong>Tuân thủ nghiêm túc giờ giấc ca hẹn:</strong> Học sinh có lịch hẹn học bù hoặc bổ trợ cần có mặt tại cơ sở <strong>Số 10, Tạ Quang Bửu, Bách Khoa, Hà Nội</strong> trước giờ vào ca ít nhất 5–10 phút để ổn định vị trí và nhận tài liệu.
              </div>
            </div>
            <div class="plan-bullet-item">
              <span class="plan-bullet-num reg-num">B</span>
              <div class="plan-bullet-text">
                <strong>Chuẩn bị đầy đủ học liệu khi đi học bù:</strong> Học sinh bắt buộc mang theo đầy đủ <strong>Phiếu học tập chuyên đề, Vở ghi lý thuyết, Máy tính cầm tay</strong> và các bài tập còn vướng mắc để Giáo viên / Trợ giảng trực tiếp kiểm tra, hướng dẫn 1-1.
              </div>
            </div>
            <div class="plan-bullet-item">
              <span class="plan-bullet-num reg-num">C</span>
              <div class="plan-bullet-text">
                <strong>Kiểm tra đánh giá sau ca học bù:</strong> Sau khi hoàn thành nội dung lý thuyết và bài tập của bài vắng, học sinh sẽ thực hiện bài Test ngắn kiểm tra mức độ hiểu bài trước khi kết thúc ca học bù. Phụ huynh cần đổi lịch ca học vui lòng liên hệ Hotline <strong>0972 26 16 16</strong>.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * DỰNG TRANG 2 THEO CƠ CHẾ "SMART ADAPTIVE LAYOUT":
 * - Kịch bản A (hasValidTestReview === true): Phiếu OMR + Bảng đối chiếu 22 câu (Badge Phần II & Phần III) + Lịch tuần thu gọn.
 * - Kịch bản B (hasValidTestReview === false): Ẩn OMR & bảng câu hỏi, phóng to Bảng Lịch Học Bù & Bổ Trợ + 2 Khối Kế hoạch & Quy định TCT.
 */
function renderStudentSecondPageHTML(
  config: DailyReportConfig & { homeworkTopicLabel?: string },
  student: ExtendedStudentDailyReportData,
  studentOrder: number,
  totalStudents: number,
  isLastPageOfWholeDoc: boolean
): string {
  const effectiveTopic =
    (config.overrideTopicTitle && config.overrideTopicTitle.trim()) ||
    config.topicTitle ||
    "Chuyên đề Toán Tư Duy & Luyện Đề Thực Chiến";

  const hasValidTestReview = Boolean(
    student.dailyTestScore !== null &&
      student.dailyTestScore !== undefined &&
      !isNaN(Number(student.dailyTestScore)) &&
      student.hasPaperOMR &&
      student.scannedPaperImageUrl
  );

  // ============================================================================
  // KỊCH BẢN B: HỌC SINH CHƯA KIỂM TRA HOẶC NGHỈ HỌC (hasValidTestReview === false)
  // ============================================================================
  if (!hasValidTestReview) {
    return `
      <section class="a4-page ${isLastPageOfWholeDoc ? "last-a4-page" : "page-break"}">
        <div class="a4-inner">
          ${renderTCTBrandHeaderHTML()}

          <div class="report-title-banner omr-banner-accent">
            <h1>LỊCH HỌC BÙ &amp; BỔ TRỢ TĂNG CƯỜNG KIẾN THỨC • KẾ HOẠCH RÈN LUYỆN TUẦN TỚI</h1>
            <div class="report-subtitle">
              Học sinh: <strong>${escapeHtml(
                student.studentName
              )}</strong>  •  SBD: <strong>${escapeHtml(
      student.sbd
    )}</strong>  •  Chuyên đề: <strong>${escapeHtml(effectiveTopic)}</strong>
            </div>
          </div>

          ${renderScenarioBExpandedScheduleAndActionPlanHTML(
            config,
            student,
            effectiveTopic
          )}

          ${renderTCTBrandFooterHTML(
            `Trang 2/2 • HS ${studentOrder}/${totalStudents}`,
            `${student.studentName} • SBD: ${student.sbd}`
          )}
        </div>
      </section>
    `;
  }

  // ============================================================================
  // KỊCH BẢN A: HỌC SINH CÓ BÀI THI (hasValidTestReview === true)
  // ============================================================================
  const fullQuestions: FullQuestionReviewRow[] = Array.isArray(
    student.allQuestionsReviewList
  )
    ? student.allQuestionsReviewList
    : [];

  const wrongList: WrongQuestionReviewItem[] = Array.isArray(
    student.wrongQuestionsList
  )
    ? student.wrongQuestionsList
    : [];

  const displayRows: FullQuestionReviewRow[] =
    fullQuestions.length > 0
      ? fullQuestions
      : wrongList.map((w) => ({
          questionNumber: w.questionNumber,
          part: w.part,
          studentAnswer: w.studentAnswer || "Bỏ trống / Chưa tô",
          correctAnswer: w.correctAnswer || "--",
          isCorrect: false,
          isSkipped:
            !w.studentAnswer ||
            w.studentAnswer === "Bỏ trống" ||
            w.studentAnswer === "Chưa tô" ||
            w.studentAnswer === "Bỏ trống / Chưa tô",
        }));

  const totalQ =
    displayRows.length > 0 ? displayRows.length : student.dailyTestTotal || 22;

  const wrongOrSkippedCount =
    displayRows.length > 0
      ? displayRows.filter((r) => !r.isCorrect).length
      : wrongList.length;

  const correctQ =
    displayRows.length > 0
      ? displayRows.filter((r) => r.isCorrect).length
      : student.dailyTestCorrect ?? Math.max(0, totalQ - wrongOrSkippedCount);

  const tableRowsHtml =
    displayRows.length === 0
      ? `
        <tr>
          <td colspan="5" style="text-align:center; padding:10px; color:#047857; font-weight:bold; font-size:11px;">
            Bài thi đã được chấm điểm tự động qua hệ thống OMR (${formatStandardScore(
              student.dailyTestScore
            )}).
          </td>
        </tr>
      `
      : displayRows
          .slice(0, 22)
          .map((row) => {
            const isRight = row.isCorrect;
            const rawStuAns = String(row.studentAnswer || "").trim();
            const isBlank =
              Boolean(row.isSkipped) ||
              !rawStuAns ||
              rawStuAns === "Bỏ trống" ||
              rawStuAns === "Chưa tô" ||
              rawStuAns === "Bỏ trống / Chưa tô";

            const isPart2 = row.part === "Phần II";
            const isPart3 = row.part === "Phần III";

            let studentAnswerCellInnerHtml = "";
            let correctAnswerCellInnerHtml = escapeHtml(row.correctAnswer || "--");

            if (isPart2) {
              // Phần II: Render 4 badge riêng biệt [a) Đ] (Xanh) hoặc [d) Đ -> S] (Đỏ)
              studentAnswerCellInnerHtml = renderPart2SubBadgesHTML(
                rawStuAns,
                row.correctAnswer || ""
              );
            } else if (isPart3) {
              // Phần III: Câu bỏ trống in badge xám nhạt "Chưa điền / Bỏ trống"
              if (isBlank) {
                studentAnswerCellInnerHtml = `<span class="p3-blank-badge">Chưa điền / Bỏ trống</span>`;
              } else {
                studentAnswerCellInnerHtml = `<span class="p3-num-val">${escapeHtml(
                  rawStuAns
                )}</span>`;
              }
            } else {
              // Phần I: Trắc nghiệm A, B, C, D
              studentAnswerCellInnerHtml = isBlank
                ? `<span class="p3-blank-badge">Chưa tô</span>`
                : `<strong>${escapeHtml(rawStuAns)}</strong>`;
            }

            return `
              <tr class="${isRight ? "row-correct" : "row-wrong"}">
                <td style="text-align:center; font-weight:bold; color:${
                  isRight ? "#0F172A" : "#DC2626"
                };">Câu ${row.questionNumber}</td>
                <td style="text-align:center; font-weight:bold; color:#334155;">${escapeHtml(
                  row.part
                )}</td>
                <td style="text-align:center; font-weight:bold; color:${
                  isRight ? "#047857" : "#DC2626"
                }; background:${isRight ? "#F0FDF4" : "#FEF2F2"};">
                  ${studentAnswerCellInnerHtml}
                </td>
                <td style="text-align:center; font-weight:bold; color:#003399; background:#EFF6FF;">
                  ${correctAnswerCellInnerHtml}
                </td>
                <td style="text-align:center; font-weight:bold; color:${
                  isRight ? "#047857" : isBlank ? "#64748B" : "#DC2626"
                };">
                  ${isRight ? "✓ Đúng" : isBlank ? "— Trống" : "✗ Sai"}
                </td>
              </tr>
            `;
          })
          .join("");

  return `
    <section class="a4-page ${isLastPageOfWholeDoc ? "last-a4-page" : "page-break"}">
      <div class="a4-inner">
        ${renderTCTBrandHeaderHTML()}

        <div class="report-title-banner omr-banner-accent">
          <h1>PHỤ BẢN ĐỐI SOÁT PHIẾU TRẢ LỜI TRẮC NGHIỆM (OMR) &amp; LỊCH BỔ TRỢ</h1>
          <div class="report-subtitle">
            Học sinh: <strong>${escapeHtml(
              student.studentName
            )}</strong>  •  SBD: <strong>${escapeHtml(
    student.sbd
  )}</strong>  •  Chuyên đề: <strong>${escapeHtml(
    student.paperExamTitle || effectiveTopic
  )}</strong>
          </div>
        </div>

        <div class="omr-appendix-two-cols">
          <div class="omr-left-image-col">
            <div class="omr-col-title">PHIẾU TRẢ LỜI TRẮC NGHIỆM OMR CỦA HỌC SINH</div>
            <div class="omr-sheet-frame">
              <img src="${student.scannedPaperImageUrl}" alt="Phiếu OMR của ${escapeHtml(
    student.studentName
  )}" class="omr-sheet-img" />
              ${renderOMROverlaySVG(student)}
            </div>
          </div>

          <div class="omr-right-table-col">
            <div class="omr-col-title">BẢNG ĐỐI CHIẾU CHI TIẾT TỪNG CÂU TRONG ĐỀ THI</div>

            <div class="omr-quick-stats">
              <div class="omr-stat-pill stat-blue">
                <span>Điểm bài thi</span>
                <strong>${formatStandardScore(student.dailyTestScore)}</strong>
              </div>
              <div class="omr-stat-pill stat-green">
                <span>Số câu đúng</span>
                <strong>${correctQ}/${totalQ} câu</strong>
              </div>
              <div class="omr-stat-pill stat-red">
                <span>Câu sai / trống</span>
                <strong>${wrongOrSkippedCount} câu</strong>
              </div>
            </div>

            <table class="omr-wrong-table">
              <thead>
                <tr>
                  <th style="width:42px; text-align:center;">Câu</th>
                  <th style="width:46px; text-align:center;">Phần</th>
                  <th style="text-align:center;">Bài làm của con</th>
                  <th style="width:88px; text-align:center;">Đáp án đề</th>
                  <th style="width:52px; text-align:center;">Kết quả</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
            </table>

            <div class="omr-legend-box">
              <div class="legend-title">CHÚ GIẢI KHOANH MÀU TRÊN PHIẾU OMR:</div>
              <div class="legend-grid-compact">
                <div class="legend-item">
                  <span class="legend-dot dot-green"></span>
                  <span><strong>Xanh lá:</strong> Tô đúng</span>
                </div>
                <div class="legend-item">
                  <span class="legend-dot dot-red"></span>
                  <span><strong>Đỏ:</strong> Tô sai</span>
                </div>
                <div class="legend-item">
                  <span class="legend-dot dot-amber"></span>
                  <span><strong>Vàng đứt:</strong> Đáp án đúng</span>
                </div>
                <div class="legend-item">
                  <span class="legend-dot dot-blue"></span>
                  <span><strong>Xanh dương:</strong> SBD &amp; Mã đề</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        ${renderBottomMakeupScheduleSectionHTML(config, student)}

        ${renderTCTBrandFooterHTML(
          `Trang 2/2 • HS ${studentOrder}/${totalStudents}`,
          `${student.studentName} • SBD: ${student.sbd}`
        )}
      </div>
    </section>
  `;
}

/**
 * HÀM CHÍNH: SINH TOÀN BỘ TÀI LIỆU MULTI-PAGE HTML A4
 * ĐẢM BẢO MỖI HỌC SINH LUÔN HIỂN THỊ TRỌN VẸN ĐÚNG 2 TRANG A4 (TRANG 1 + TRANG 2), KHÔNG TRÀN SANG TRANG 3
 */
export function generateClassDailyReportHTML(
  reportConfig: DailyReportConfig & { homeworkTopicLabel?: string },
  studentsData: ExtendedStudentDailyReportData[]
): string {
  const safeStudents = Array.isArray(studentsData) ? studentsData : [];
  const totalStudents = safeStudents.length;

  let allPagesMarkup = "";

  if (reportConfig.includeCoverSummaryPage && totalStudents > 1) {
    allPagesMarkup += renderClassSummaryCoverPageHTML(reportConfig, safeStudents);
  }

  safeStudents.forEach((stu, idx) => {
    const isLastStudent = idx === totalStudents - 1;

    allPagesMarkup += renderSingleStudentDailyReportPageHTML(
      reportConfig,
      stu,
      idx + 1,
      totalStudents
    );

    allPagesMarkup += renderStudentSecondPageHTML(
      reportConfig,
      stu,
      idx + 1,
      totalStudents,
      isLastStudent
    );
  });

  const docTitle = `Bao_Cao_TCT_Ngay_${reportConfig.customDateStr.replace(
    /\//g,
    "_"
  )}_${totalStudents}_Hoc_Sinh`;

  return `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(docTitle)}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 0;
        }
        * {
          box-sizing: border-box;
          font-family: 'Times New Roman', Times, serif !important;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          margin: 0;
          padding: 0;
          background: #334155;
          font-family: 'Times New Roman', Times, serif;
          color: #0F172A;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .print-toolbar {
          position: sticky;
          top: 0;
          z-index: 999;
          width: 100%;
          background: #0F172A;
          color: #FFFFFF;
          padding: 12px 24px;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
        }
        .toolbar-info {
          font-size: 15px;
        }
        .toolbar-info strong {
          color: #F58220;
        }
        .toolbar-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .btn-print-pdf {
          background: #003399;
          color: #FFFFFF;
          border: 2px solid #F58220;
          padding: 9px 22px;
          border-radius: 8px;
          font-weight: bold;
          font-size: 15px;
          cursor: pointer;
        }
        .btn-print-pdf:hover {
          background: #1D4ED8;
        }
        /* KHÓA CHẶT KÍCH THƯỚC MỖI TRANG A4 297MM - CHỐNG TRÀN TRANG 3 TUYỆT ĐỐI */
        .a4-page {
          width: 210mm;
          min-height: 297mm;
          height: 297mm;
          max-height: 297mm;
          background: #FFFFFF;
          margin: 14px auto;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
          position: relative;
          overflow: hidden;
          page-break-after: always;
          break-after: page;
          box-sizing: border-box;
        }
        .last-a4-page {
          page-break-after: auto;
          break-after: auto;
        }
        .page-break {
          page-break-after: always;
          break-after: page;
        }
        .a4-inner {
          width: 100%;
          height: 100%;
          padding: 6.5mm 10mm 5.5mm 10mm;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }
        .tct-brand-header {
          width: 100%;
          margin-bottom: 2.5px;
          flex-shrink: 0;
        }
        .tct-header-svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .tct-brand-footer {
          width: 100%;
          margin-top: auto;
          padding-top: 3px;
          flex-shrink: 0;
        }
        .tct-footer-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          border-top: 2px solid #003399;
          background: #F8FAFC;
          padding: 4px 10px;
          border-radius: 4px;
        }
        .tct-footer-brand-text {
          font-size: 11.2px;
          font-weight: bold;
          color: #003399;
          letter-spacing: 0.1px;
        }
        .tct-footer-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        }
        .tct-footer-stu-tag {
          font-size: 10.2px;
          font-weight: bold;
          color: #475569;
        }
        .tct-footer-page-badge {
          font-size: 10.5px;
          font-weight: bold;
          color: #FFFFFF;
          background: #003399;
          border: 1px solid #F58220;
          padding: 1.5px 7px;
          border-radius: 4px;
        }
        .report-title-banner {
          text-align: center;
          background: #F8FAFC;
          border-top: 2px solid #003399;
          border-bottom: 2px solid #F58220;
          padding: 4px 10px;
          margin-bottom: 4.5px;
          flex-shrink: 0;
        }
        .omr-banner-accent {
          background: #EFF6FF;
        }
        .report-title-banner h1 {
          margin: 0;
          font-size: 16.5px;
          font-weight: bold;
          color: #003399;
          letter-spacing: 0.2px;
        }
        .report-subtitle {
          margin-top: 1.5px;
          font-size: 12px;
          color: #0F172A;
        }
        .section-box {
          border: 1px solid #94A3B8;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 8px;
          background: #FFFFFF;
        }
        .topic-highlight-box {
          background: #FFFBEB;
          border: 1.5px solid #F58220;
        }
        .section-header {
          font-size: 12.5px;
          font-weight: bold;
          color: #003399;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 1px solid #CBD5E1;
          padding-bottom: 4px;
          margin-bottom: 7px;
        }
        .student-info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px 16px;
          font-size: 14px;
        }
        .info-label {
          color: #334155;
        }
        .info-value-primary {
          color: #003399;
          font-size: 15.5px;
          text-transform: uppercase;
        }
        .sbd-badge {
          font-size: 14.5px;
          background: #EFF6FF;
          color: #003399;
          padding: 1px 9px;
          border-radius: 4px;
          border: 1px solid #93C5FD;
          letter-spacing: 1px;
        }
        .topic-title-main {
          font-size: 15.5px;
          font-weight: bold;
          color: #0F172A;
        }
        .topic-subnote {
          font-size: 12.5px;
          color: #334155;
          margin-top: 3px;
          font-style: italic;
        }
        .scores-three-cols {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 9px;
        }
        .score-card {
          border-radius: 6px;
          padding: 8px 9px;
          text-align: center;
          border: 1.5px solid #94A3B8;
        }
        .score-card-green {
          background: #ECFDF5;
          border-color: #059669;
        }
        .score-card-blue {
          background: #EFF6FF;
          border-color: #1D4ED8;
        }
        .score-card-orange {
          background: #FFF7ED;
          border-color: #EA580C;
        }
        .score-card-title {
          font-size: 11.5px;
          font-weight: bold;
          color: #0F172A;
        }
        .score-card-value {
          font-size: 23px;
          font-weight: bold;
          color: #003399;
          margin: 4px 0;
        }
        .score-card-untested {
          font-size: 17.5px;
          font-weight: bold;
          color: #1E40AF;
          margin: 7px 0 5px 0;
          letter-spacing: 0.4px;
        }
        .score-card-value-muted {
          font-size: 18px;
          color: #B45309;
          margin: 6px 0 4px 0;
        }
        .score-card-sub {
          font-size: 11.5px;
          color: #1E293B;
          line-height: 1.25;
        }
        .parts-breakdown-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .parts-breakdown-table th,
        .parts-breakdown-table td {
          border: 1px solid #94A3B8;
          padding: 5px 9px;
        }
        .parts-breakdown-table th {
          background: #F1F5F9;
          font-size: 11.5px;
          text-transform: uppercase;
          color: #0F172A;
        }
        .untested-sync-notice {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #F8FAFC;
          border: 1.5px dashed #60A5FA;
          border-radius: 6px;
          padding: 10px 14px;
          color: #1E3A8A;
        }
        .untested-sync-icon {
          font-size: 22px;
          flex-shrink: 0;
        }
        .untested-sync-text {
          font-size: 13.5px;
          line-height: 1.4;
          color: #1E293B;
        }
        .teacher-comment-box {
          background: #F8FAFC;
          border-left: 4px solid #003399;
          border-top: 1px solid #E2E8F0;
          border-right: 1px solid #E2E8F0;
          border-bottom: 1px solid #E2E8F0;
          padding: 8px 11px;
          font-size: 14px;
          font-style: italic;
          line-height: 1.45;
          color: #0F172A;
        }
        .makeup-scheduled-callout {
          margin-top: 7px;
          padding: 6px 10px;
          background: #FFF7ED;
          border: 1px solid #EA580C;
          border-radius: 5px;
          font-size: 12.5px;
          color: #9A3412;
        }
        /* BADGE CHÍNH THỨC DUY NHẤT Ở MỤC 5 TRANG 1 */
        .single-badges-stack {
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1.5px dashed #CBD5E1;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .official-single-badge {
          width: 100%;
          padding: 7.5px 12px;
          border-radius: 6px;
          font-size: 13.5px;
          font-weight: bold;
          text-align: center;
          letter-spacing: 0.2px;
        }
        .badge-att-green,
        .badge-hw-green {
          background: #ECFDF5;
          border: 2px solid #059669;
          color: #065F46;
        }
        .badge-att-amber,
        .badge-hw-amber {
          background: #FEF3C7;
          border: 2px solid #D97706;
          color: #92400E;
        }
        .badge-att-red,
        .badge-hw-red {
          background: #FEF2F2;
          border: 2px solid #DC2626;
          color: #991B1B;
        }

        /* ==============================================================
           TRANG 2 — KỊCH BẢN A: ĐỐI SOÁT OMR (145mm) + LỊCH TUẦN (57mm)
           ============================================================== */
        .omr-appendix-two-cols {
          display: grid;
          grid-template-columns: 47.5% 51%;
          gap: 1.5%;
          height: 145mm;
          max-height: 145mm;
          margin-bottom: 4px;
          flex-shrink: 0;
        }
        .omr-left-image-col,
        .omr-right-table-col {
          border: 1px solid #94A3B8;
          border-radius: 6px;
          padding: 5px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #FFFFFF;
        }
        .omr-col-title {
          font-size: 10.5px;
          font-weight: bold;
          color: #003399;
          text-align: center;
          border-bottom: 1px solid #CBD5E1;
          padding-bottom: 2.5px;
          margin-bottom: 3.5px;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .omr-sheet-frame {
          position: relative;
          height: 132mm;
          max-height: 132mm;
          aspect-ratio: 1200 / 1700;
          margin: 0 auto;
          border: 1px solid #64748B;
          overflow: hidden;
          background: #FFFFFF;
        }
        .omr-sheet-img {
          width: 100%;
          height: 100%;
          object-fit: fill;
          display: block;
        }
        .omr-overlay-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .omr-quick-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
          margin-bottom: 3.5px;
          flex-shrink: 0;
        }
        .omr-stat-pill {
          padding: 2px 3px;
          border-radius: 4px;
          text-align: center;
          font-size: 9.5px;
        }
        .omr-stat-pill span {
          display: block;
          color: #334155;
        }
        .omr-stat-pill strong {
          font-size: 11.5px;
        }
        .stat-blue {
          background: #EFF6FF;
          color: #1D4ED8;
          border: 1px solid #93C5FD;
        }
        .stat-green {
          background: #ECFDF5;
          color: #047857;
          border: 1px solid #6EE7B7;
        }
        .stat-red {
          background: #FEF2F2;
          color: #DC2626;
          border: 1px solid #FCA5A5;
        }
        .omr-wrong-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9.2px;
          margin-bottom: 3px;
        }
        .omr-wrong-table th,
        .omr-wrong-table td {
          border: 1px solid #94A3B8;
          padding: 1.2px 2.5px;
          line-height: 1.12;
        }
        .omr-wrong-table th {
          background: #F1F5F9;
          font-size: 8.8px;
          text-transform: uppercase;
          color: #0F172A;
        }
        /* BADGE PHẦN II (ĐÚNG/SAI) & PHẦN III (TRẢ LỜI NGẮN) */
        .p2-badges-wrap {
          display: flex;
          flex-wrap: nowrap;
          justify-content: center;
          align-items: center;
          gap: 2px;
        }
        .p2-sub-badge {
          display: inline-block;
          padding: 0.5px 3px;
          border-radius: 2.5px;
          font-size: 8.1px;
          font-weight: bold;
          color: #FFFFFF;
          white-space: nowrap;
        }
        .p2-sub-badge-ok {
          background: #059669;
        }
        .p2-sub-badge-err {
          background: #DC2626;
        }
        .p3-blank-badge {
          display: inline-block;
          background: #E2E8F0;
          color: #475569;
          border: 1px solid #CBD5E1;
          padding: 0.5px 5px;
          border-radius: 3px;
          font-size: 8.3px;
          font-weight: bold;
          font-style: italic;
        }
        .p3-num-val {
          font-weight: bold;
          font-size: 9.5px;
        }

        .omr-legend-box {
          margin-top: auto;
          background: #F8FAFC;
          border: 1px solid #CBD5E1;
          border-radius: 4px;
          padding: 3px 5px;
          font-size: 9.5px;
          flex-shrink: 0;
        }
        .legend-title {
          font-size: 9px;
          font-weight: bold;
          color: #003399;
          margin-bottom: 1.5px;
        }
        .legend-grid-compact {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5px 6px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .legend-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }
        .dot-green {
          background: rgba(16, 185, 129, 0.35);
          border: 1.5px solid #10B981;
        }
        .dot-red {
          background: rgba(239, 68, 68, 0.35);
          border: 1.5px solid #EF4444;
        }
        .dot-amber {
          background: rgba(245, 158, 11, 0.18);
          border: 1.5px dashed #F59E0B;
        }
        .dot-blue {
          background: rgba(37, 99, 235, 0.35);
          border: 1.5px solid #2563EB;
        }

        /* ==============================================================
           KHUNG LỊCH TUẦN 7 NGÀY THU GỌN Ở ĐÁY TRANG 2 (KỊCH BẢN A)
           ============================================================== */
        .bottom-weekly-schedule-container {
          border: 2px solid #1E40AF;
          border-radius: 9px;
          padding: 5.5px 8px;
          background: #FFFFFF;
          color: #1E293B;
          height: 57mm;
          max-height: 58mm;
          margin-top: auto;
          margin-bottom: 2px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          flex-shrink: 0;
          overflow: hidden;
        }
        .weekly-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;
          border-bottom: 1px solid #E2E8F0;
          padding-bottom: 2.5px;
          margin-bottom: 3px;
          flex-shrink: 0;
        }
        .weekly-title-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .weekly-main-title {
          font-size: 10.5px;
          font-weight: bold;
          color: #003399;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .weekly-date-range-badge {
          font-size: 9.5px;
          font-weight: bold;
          color: #1E3A8A;
          background: #EFF6FF;
          border: 1px solid #BFDBFE;
          padding: 0.5px 5px;
          border-radius: 4px;
          white-space: nowrap;
        }
        .weekly-legend-group {
          display: flex;
          align-items: center;
          gap: 9px;
          font-size: 9.5px;
          white-space: nowrap;
        }
        .legend-tag-orange {
          color: #EA580C;
          font-weight: bold;
        }
        .legend-tag-blue {
          color: #2563EB;
          font-weight: bold;
        }
        .weekly-alert-bar {
          border: 1px solid #FDBA74;
          background: #FFF7ED;
          padding: 3px 7px;
          border-radius: 5px;
          font-size: 10.2px;
          line-height: 1.25;
          color: #9A3412;
          margin-bottom: 3.5px;
          display: flex;
          align-items: center;
          gap: 5px;
          flex-shrink: 0;
        }
        .weekly-seven-cols-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4.5px;
          margin-bottom: 3.5px;
          flex: 1;
          min-height: 0;
        }
        .day-col-card {
          border-radius: 6px;
          padding: 3px 3.5px;
          text-align: center;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
        }
        .day-col-empty {
          border: 1px solid #E2E8F0;
          background: #F8FAFC;
        }
        .day-col-today {
          border: 1.5px solid #60A5FA;
          background: #EFF6FF;
        }
        .day-col-makeup {
          border: 2px solid #F97316;
          background: #FFF7ED;
        }
        .day-col-support {
          border: 2px solid #2563EB;
          background: #EFF6FF;
        }
        .day-col-header {
          border-bottom: 1px solid #E2E8F0;
          padding-bottom: 1.5px;
          margin-bottom: 2px;
        }
        .day-col-top-line {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2.5px;
        }
        .day-title-text {
          font-size: 9.5px;
          font-weight: bold;
          color: #0F172A;
        }
        .day-today-badge {
          font-size: 7px;
          font-weight: bold;
          background: #2563EB;
          color: #FFFFFF;
          padding: 0.5px 3px;
          border-radius: 2.5px;
        }
        .day-date-text {
          font-size: 8.5px;
          color: #64748B;
          font-weight: bold;
        }
        .day-empty-label {
          font-size: 8.2px;
          color: #94A3B8;
          font-style: italic;
          margin: auto 0;
        }
        .day-sessions-stack {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin: auto 0;
        }
        .day-session-pill {
          border-radius: 3.5px;
          padding: 1.5px 2px;
          font-size: 8.2px;
          line-height: 1.1;
        }
        .pill-makeup-orange {
          background: #FFEDD5;
          border: 1px solid #EA580C;
          color: #9A3412;
          font-weight: bold;
        }
        .pill-support-blue {
          background: #DBEAFE;
          border: 1px solid #2563EB;
          color: #1E3A8A;
          font-weight: bold;
        }
        .pill-shift-code {
          font-size: 8.2px;
          font-weight: bold;
        }
        .pill-shift-type {
          font-size: 7.2px;
          text-transform: uppercase;
          opacity: 0.9;
        }
        .weekly-std-shifts-bar {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 5px;
          padding: 2.5px 5px;
          flex-shrink: 0;
        }
        .std-shifts-label {
          font-size: 8.2px;
          font-weight: bold;
          color: #334155;
          text-transform: uppercase;
          margin-bottom: 1.5px;
        }
        .std-shifts-pills-row {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 3.5px;
        }
        .std-shift-mini-pill {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 3.5px;
          padding: 1px 2px;
          text-align: center;
          font-size: 8px;
          white-space: nowrap;
        }
        .std-pill-code {
          font-weight: bold;
          color: #1D4ED8;
          display: block;
          font-size: 7.8px;
        }
        .std-pill-time {
          color: #0F172A;
          font-weight: bold;
          font-size: 7.9px;
        }

        /* ==============================================================
           TRANG 2 — KỊCH BẢN B: LỊCH HỌC BÙ PHÓNG TO (NỬA TRÊN) + 2 KHỐI NỘI DUNG (NỬA DƯỚI)
           ============================================================== */
        .scenario-b-wrapper {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 8px;
          flex: 1;
          min-height: 0;
          margin-bottom: 4px;
        }
        .expanded-schedule-master-box {
          border: 2px solid #003399;
          border-radius: 8px;
          padding: 9px 11px;
          background: #FFFFFF;
          display: flex;
          flex-direction: column;
          gap: 7px;
          height: 112mm;
          max-height: 112mm;
          flex-shrink: 0;
        }
        .expanded-schedule-top-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
          border-bottom: 1.5px solid #CBD5E1;
          padding-bottom: 5px;
        }
        .expanded-schedule-title {
          font-size: 13px;
          font-weight: bold;
          color: #003399;
          text-transform: uppercase;
        }
        .expanded-schedule-sub {
          font-size: 11.5px;
          color: #334155;
          margin-top: 2px;
        }
        .expanded-schedule-legends {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          font-size: 10.5px;
          white-space: nowrap;
        }
        .exp-legend-orange {
          color: #EA580C;
          font-weight: bold;
        }
        .exp-legend-blue {
          color: #1D4ED8;
          font-weight: bold;
        }
        .expanded-schedule-alert {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11.8px;
          line-height: 1.35;
        }
        .alert-has-sessions {
          background: #FFF7ED;
          border: 1.5px solid #F97316;
          color: #9A3412;
        }
        .alert-no-sessions {
          background: #EFF6FF;
          border: 1.5px solid #60A5FA;
          color: #1E3A8A;
        }
        .expanded-alert-icon {
          font-size: 18px;
          flex-shrink: 0;
        }
        .expanded-seven-days-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
          flex: 1;
          min-height: 0;
        }
        .exp-day-col {
          border-radius: 7px;
          padding: 5px 5px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          height: 100%;
          overflow: hidden;
        }
        .exp-day-empty {
          border: 1px solid #CBD5E1;
          background: #F8FAFC;
        }
        .exp-day-today {
          border: 2px solid #3B82F6;
          background: #EFF6FF;
        }
        .exp-day-makeup {
          border: 2px solid #EA580C;
          background: #FFF7ED;
        }
        .exp-day-support {
          border: 2px solid #2563EB;
          background: #EFF6FF;
        }
        .exp-day-header {
          text-align: center;
          border-bottom: 1px solid #CBD5E1;
          padding-bottom: 4px;
          margin-bottom: 5px;
        }
        .exp-day-title-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
        }
        .exp-day-name {
          font-size: 11px;
          font-weight: bold;
          color: #0F172A;
        }
        .exp-today-pill {
          font-size: 7.5px;
          font-weight: bold;
          background: #1D4ED8;
          color: #FFFFFF;
          padding: 1px 4px;
          border-radius: 3px;
        }
        .exp-day-date {
          font-size: 10.5px;
          font-weight: bold;
          color: #475569;
          margin-top: 1px;
        }
        .exp-sessions-list {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin: auto 0;
        }
        .exp-session-card {
          border-radius: 5px;
          padding: 5px 4px;
          text-align: left;
          line-height: 1.25;
        }
        .exp-card-orange {
          background: #FFEDD5;
          border: 1.5px solid #EA580C;
          color: #9A3412;
        }
        .exp-card-blue {
          background: #DBEAFE;
          border: 1.5px solid #2563EB;
          color: #1E3A8A;
        }
        .exp-sess-type-tag {
          font-size: 8.5px;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .exp-sess-time {
          font-size: 9.8px;
          font-weight: bold;
          color: #0F172A;
        }
        .exp-sess-shift-name {
          font-size: 9px;
          font-weight: bold;
          margin-top: 1px;
        }
        .exp-sess-topic {
          font-size: 8.5px;
          margin-top: 2px;
          color: #1E293B;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .exp-empty-slot {
          margin: auto 0;
          text-align: center;
          color: #94A3B8;
          padding: 6px 2px;
        }
        .exp-empty-circle {
          font-size: 14px;
          font-weight: bold;
        }
        .exp-empty-text {
          font-size: 9.5px;
          font-style: italic;
          color: #64748B;
          margin-top: 2px;
        }
        .exp-empty-sub {
          font-size: 8.2px;
          color: #94A3B8;
          margin-top: 2px;
        }
        .expanded-std-shifts-panel {
          background: #F8FAFC;
          border: 1px solid #CBD5E1;
          border-radius: 6px;
          padding: 5px 8px;
          flex-shrink: 0;
        }
        .expanded-std-shifts-title {
          font-size: 9.8px;
          font-weight: bold;
          color: #003399;
          text-transform: uppercase;
          margin-bottom: 3.5px;
        }
        .expanded-std-shifts-row {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .exp-std-shift-box {
          background: #FFFFFF;
          border: 1px solid #CBD5E1;
          border-radius: 4px;
          padding: 2.5px 3px;
          text-align: center;
        }
        .exp-std-code {
          font-size: 8.3px;
          font-weight: bold;
          color: #003399;
        }
        .exp-std-time {
          font-size: 8.8px;
          font-weight: bold;
          color: #0F172A;
          margin-top: 1px;
        }

        /* 2 KHỐI HỘP NỘI DUNG Ở NỬA DƯỚI TRANG 2 (KỊCH BẢN B) */
        .scenario-b-bottom-two-boxes {
          display: flex;
          flex-direction: column;
          gap: 7px;
          flex: 1;
          min-height: 0;
        }
        .action-plan-box {
          border: 1.5px solid #94A3B8;
          border-radius: 7px;
          padding: 7px 11px;
          background: #FFFFFF;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .regulation-box-accent {
          border-color: #F58220;
          background: #FFFBEB;
        }
        .action-plan-header {
          font-size: 11.8px;
          font-weight: bold;
          color: #003399;
          text-transform: uppercase;
          border-bottom: 1px solid #CBD5E1;
          padding-bottom: 3.5px;
          margin-bottom: 5px;
        }
        .action-plan-body {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin: auto 0;
        }
        .plan-bullet-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .plan-bullet-num {
          background: #003399;
          color: #FFFFFF;
          font-size: 10px;
          font-weight: bold;
          padding: 1.5px 6px;
          border-radius: 4px;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .reg-num {
          background: #EA580C;
        }
        .plan-bullet-text {
          font-size: 11.6px;
          line-height: 1.36;
          color: #0F172A;
        }

        .summary-cover-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-bottom: auto;
        }
        .summary-cover-table th,
        .summary-cover-table td {
          border: 1px solid #94A3B8;
          padding: 5px 7px;
        }
        .summary-cover-table th {
          background: #EFF6FF;
          color: #003399;
          font-size: 11.5px;
          text-transform: uppercase;
        }
        .summary-cover-table tr:nth-child(even) {
          background: #F8FAFC;
        }
        @media print {
          body {
            background: #FFFFFF;
          }
          .print-toolbar {
            display: none !important;
          }
          .a4-page {
            margin: 0;
            box-shadow: none;
            width: 210mm;
            min-height: 297mm;
            height: 297mm;
            max-height: 297mm;
            overflow: hidden;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-toolbar">
        <div class="toolbar-info">
          <strong>HỆ THỐNG BÁO CÁO HỌC TẬP TÂM CHÍ TÀI (TCT)</strong> — Ngày ${escapeHtml(
            reportConfig.customDateStr
          )} (${totalStudents} học sinh • Chuẩn 2 trang A4/HS • Smart Adaptive Layout)
        </div>
        <div class="toolbar-actions">
          <button class="btn-print-pdf" onclick="window.print()">
            🖨 In Báo Cáo / Lưu File PDF (${totalStudents} Học Sinh)
          </button>
        </div>
      </div>

      ${allPagesMarkup}
    </body>
    </html>
  `;
}

/**
 * MỞ CỬA SỔ IN / LƯU FILE PDF ĐA TRANG GỘP TOÀN BỘ HỌC SINH ĐƯỢC CHỌN
 */
export function openPrintOrDownloadClassReport(htmlContent: string): void {
  if (typeof window === "undefined" || !htmlContent) return;

  const printWin = window.open("", "_blank");
  if (!printWin) {
    alert(
      "Trình duyệt đang chặn cửa sổ bật lên (Pop-up). Vui lòng cho phép Pop-up để mở và lưu file PDF Báo cáo cả lớp!"
    );
    return;
  }

  printWin.document.open();
  printWin.document.write(htmlContent);
  printWin.document.close();
}
