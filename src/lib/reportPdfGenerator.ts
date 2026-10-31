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

  // Nếu học sinh có lịch hẹn học bù/bổ trợ, ưu tiên hiển thị tuần chứa lịch hẹn đầu tiên
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

    // Lọc các ca khớp với ngày này (theo DD/MM hoặc theo Thứ trong tuần)
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
      <svg viewBox="0 0 1068 74" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" class="tct-header-svg">
        <polygon points="8,11 152,11 138,68 0,68" fill="#F58220" />
        <polygon points="0,3 142,3 128,60 0,60" fill="#FFFFFF" stroke="#003399" stroke-width="2.4" />
        <text x="68" y="39" font-family="'Times New Roman', Times, serif" font-size="31" font-weight="bold" text-anchor="middle" fill="#003399" letter-spacing="1">TCT</text>
        <text x="66" y="54" font-family="'Times New Roman', Times, serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#003399" letter-spacing="1">TÂM CHÍ TÀI</text>

        <text x="372" y="30" font-family="'Times New Roman', Times, serif" font-size="18.5" font-style="italic" font-weight="bold" text-anchor="middle" fill="#003399">
          Chuyên luyện thi vào 10, HSA, TSA và THPT
        </text>
        <text x="372" y="52" font-family="'Times New Roman', Times, serif" font-size="13.5" font-weight="bold" text-anchor="middle" fill="#1E293B">
          Hotline: 0972 26 16 16  •  Đ/c: Số 10, Tạ Quang Bửu, Bách Khoa, Hà Nội
        </text>

        <polygon points="586,19 628,19 613,56 571,56" fill="#F58220" />
        <polygon points="642,19 684,19 669,56 627,56" fill="#F58220" />

        <polygon points="700,19 1065,19 1065,56 685,56" fill="#FFFFFF" stroke="#003399" stroke-width="2" />
        <text x="878" y="43" font-family="'Times New Roman', Times, serif" font-size="16.5" font-style="italic" font-weight="bold" text-anchor="middle" fill="#003399">
          Chuyên Toán Tư Duy - Trắc Nghiệm Tia Chớp
        </text>
      </svg>
    </div>
  `;
}

/**
 * DỰNG VECTOR SVG BANNER FOOTER THƯƠNG HIỆU TCT Ở ĐÁY TRANG A4
 */
function renderTCTBrandFooterHTML(
  pageNumberLabel: string,
  studentQuickTag: string
): string {
  return `
    <div class="tct-brand-footer">
      <svg viewBox="0 0 1068 38" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" class="tct-footer-svg">
        <circle cx="24" cy="19" r="10.5" fill="none" stroke="#003399" stroke-width="1.8" />
        <path d="M19,13 C21,11 23,14 22,16 C21,18 24,21 26,20 C28,19 31,21 29,23 C26,26 17,17 19,13 Z" fill="#003399" />
        <text x="44" y="24" font-family="'Times New Roman', Times, serif" font-size="14.5" font-weight="bold" fill="#003399">0972 26 16 16</text>

        <circle cx="215" cy="19" r="10.5" fill="#003399" />
        <polygon points="215,11 207,18 210,18 210,25 220,25 220,18 223,18" fill="#FFFFFF" />
        <text x="235" y="24" font-family="'Times New Roman', Times, serif" font-size="14.5" font-weight="bold" fill="#003399">
          Số 10, Tạ Quang Bửu, Bách Khoa, Hà Nội
        </text>

        <text x="560" y="24" font-family="'Times New Roman', Times, serif" font-size="12.5" font-weight="bold" fill="#475569">
          ${escapeHtml(studentQuickTag)}
        </text>

        <polygon points="835,3 857,3 843,35 821,35" fill="#F58220" />
        <polygon points="859,3 1065,3 1065,35 845,35" fill="#FFFFFF" stroke="#003399" stroke-width="2" />
        <text x="955" y="24" font-family="'Times New Roman', Times, serif" font-size="14" font-weight="bold" text-anchor="middle" fill="#0033CC">
          ${escapeHtml(pageNumberLabel)}
        </text>
      </svg>
    </div>
  `;
}

/**
 * DỰNG LỚP PHỦ VECTOR SVG KHOANH XANH / ĐỎ / NÉT ĐỨT ĐÈ LÊN ẢNH PHIẾU CHẤM OMR
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
      const strokeColor = isSbdOrCode
        ? "#2563EB"
        : b.status === "correct"
        ? "#10B981"
        : b.status === "wrong"
        ? "#EF4444"
        : b.status === "expected_missed"
        ? "#F59E0B"
        : "#6366F1";

      const fillColor = isSbdOrCode
        ? "rgba(37, 99, 235, 0.20)"
        : b.status === "correct"
        ? "rgba(16, 185, 129, 0.22)"
        : b.status === "wrong"
        ? "rgba(239, 68, 68, 0.24)"
        : "none";

      const dashAttr =
        b.status === "expected_missed" ? `stroke-dasharray="4 2"` : "";

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
 * DỰNG TRANG BÌA TỔNG KẾT ĐIỂM CẢ LỚP (ĐỒNG BỘ CỘT CHUYÊN CẦN & LỊCH HẸN BÙ)
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
        attBadge = `<span style="color:#B45309; font-weight:bold;">Nghỉ (Đã bù)</span>`;
      } else if (attStatus === "absent_need_makeup" || attStatus === "absent") {
        attBadge = firstMakeupDate
          ? `<span style="color:#DC2626; font-weight:bold;">Vắng (Hẹn bù ${escapeHtml(
              firstMakeupDate
            )})</span>`
          : `<span style="color:#DC2626; font-weight:bold;">Vắng (Chưa xếp lịch bù)</span>`;
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
              : "--"
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
              <th style="width:155px; text-align:center;">Chuyên cần & Lịch bù</th>
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

  const testSubLabel =
    student.dailyTestCorrect !== null &&
    student.dailyTestCorrect !== undefined &&
    student.dailyTestTotal
      ? `Kiểm tra buổi hôm nay: Đúng ${student.dailyTestCorrect}/${student.dailyTestTotal} câu (${
          student.hasPaperOMR ? "Chấm phiếu OMR" : "Làm trên hệ thống"
        })`
      : student.dailyTestScore !== null
      ? student.hasPaperOMR
        ? "Kiểm tra trong buổi học hôm nay (Phiếu OMR)"
        : "Kiểm tra trong buổi học hôm nay"
      : "Chưa có điểm kiểm tra buổi hôm nay";

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

  const p1Display =
    student.part1Score ||
    (student.dailyTestScore !== null ? "Đã tổng hợp vào điểm chung" : "Chưa kiểm tra");
  const p2Display =
    student.part2Score ||
    (student.dailyTestScore !== null ? "Đã tổng hợp vào điểm chung" : "Chưa kiểm tra");
  const p3Display =
    student.part3Score ||
    (student.dailyTestScore !== null ? "Đã tổng hợp vào điểm chung" : "Chưa kiểm tra");

  const attStatus = resolveEffectiveAttendanceStatus(student);

  const attOptions = [
    {
      key: "present",
      label: "Có mặt đúng giờ",
      activeClass: "status-pill-active-green",
    },
    {
      key: "makeup_done",
      label: "Nghỉ (Đã học bù)",
      activeClass: "status-pill-active-amber",
    },
    {
      key: "absent_need_makeup",
      label: "Nghỉ (Chưa bù)",
      activeClass: "status-pill-active-red",
    },
  ];

  const hwOptions = [
    {
      key: "completed",
      label: "Hoàn thành đầy đủ",
      activeClass: "status-pill-active-green",
    },
    {
      key: "late",
      label: "Nộp muộn",
      activeClass: "status-pill-active-amber",
    },
    {
      key: "missing",
      label: "Chưa hoàn thành",
      activeClass: "status-pill-active-red",
    },
  ];

  const attendancePillsHtml = attOptions
    .map((opt) => {
      const isSelected = attStatus === opt.key;
      return `
        <div class="status-pill ${isSelected ? opt.activeClass : "status-pill-inactive"}">
          <span class="status-pill-icon">${isSelected ? "☑" : "☐"}</span>
          <span>${opt.label}</span>
        </div>
      `;
    })
    .join("");

  const hwStatusPillsHtml = hwOptions
    .map((opt) => {
      const isSelected = student.homeworkStatus === opt.key;
      return `
        <div class="status-pill ${isSelected ? opt.activeClass : "status-pill-inactive"}">
          <span class="status-pill-icon">${isSelected ? "☑" : "☐"}</span>
          <span>${opt.label}</span>
        </div>
      `;
    })
    .join("");

  const makeupCompletedBannerHtml =
    attStatus === "makeup_done"
      ? `
        <div class="makeup-done-callout">
          <strong>📌 Ghi chú chuyên cần:</strong> Nghỉ buổi học chính — Đã hoàn thành học bù và bài tập đầy đủ.
        </div>
      `
      : "";

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
                })`
            )
            .join("  •  ")}
          <em>(Xem bảng lịch tuần 7 ngày ở đáy Trang 2)</em>
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
            <div><span class="info-label">Số báo danh cố định (SBD):</span> <strong class="sbd-badge">${escapeHtml(
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
            BTVN thu & đối soát trong buổi hôm nay: <strong>${escapeHtml(
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
              <div class="score-card-value">${formatStandardScore(student.dailyTestScore)}</div>
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
          <div class="section-header">4. PHÂN TÍCH CẤU TRÚC BÀI KIỂM TRA TẠI LỚP THEO FORM MỚI BỘ GD&ĐT</div>
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
        </div>

        <!-- 5. NHẬN XÉT CỦA GIÁO VIÊN & THẺ HUY HIỆU CHUYÊN CẦN -->
        <div class="section-box" style="margin-bottom:auto;">
          <div class="section-header">5. NHẬN XÉT CỦA GIÁO VIÊN & TÌNH HÌNH CHUYÊN CẦN TRONG NGÀY</div>
          <div class="teacher-comment-box">
            "${escapeHtml(
              student.teacherComment ||
                `Em ${student.studentName} có ý thức học tập nghiêm túc trên lớp, nắm được phương pháp giải các dạng toán trọng tâm của buổi học. Gia đình nhắc nhở con duy trì luyện tập đều đặn các câu vận dụng để tối ưu tốc độ làm bài.`
            )}"
          </div>

          ${makeupCompletedBannerHtml}
          ${scheduledQuickNoteHtml}

          <div class="attendance-highlight-container">
            <div class="attendance-highlight-group">
              <div class="attendance-group-label">ĐIỂM DANH & TRẠNG THÁI HỌC BÙ:</div>
              <div class="attendance-pills-grid">
                ${attendancePillsHtml}
              </div>
            </div>

            <div class="attendance-highlight-group">
              <div class="attendance-group-label">Ý THỨC LÀM BÀI TẬP VỀ NHÀ (BTVN TUẦN TRƯỚC):</div>
              <div class="attendance-pills-grid">
                ${hwStatusPillsHtml}
              </div>
            </div>
          </div>
        </div>

        ${renderTCTBrandFooterHTML(
          `Trang 1/2 • HS ${studentOrder}/${totalStudents}`,
          `${student.studentName} • SBD: ${student.sbd} (Xem tiếp Đối soát & Lịch học ở Trang 2)`
        )}
      </div>
    </section>
  `;
}

/**
 * KHỐI LỊCH TUẦN 7 NGÀY (THỨ 2 -> CHỦ NHẬT) + THANH 7 KHUNG GIỜ CA CHUẨN Ở ĐÁY TRANG 2 (~58mm)
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

  // Lưới 7 cột (Thứ 2 -> Chủ Nhật)
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

  // Thanh 7 khung giờ ca chuẩn xác định trước ở dưới cùng
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
      <!-- 1. Header & Chú thích màu -->
      <div class="weekly-header-bar">
        <div class="weekly-title-group">
          <span class="weekly-main-title">BẢNG LỊCH HỌC BÙ & BỔ TRỢ TĂNG CƯỜNG KIẾN THỨC TRONG TUẦN</span>
          <span class="weekly-date-range-badge">${escapeHtml(
            weekRangeLabel
          )}</span>
        </div>
        <div class="weekly-legend-group">
          <span class="legend-tag-orange">■ Màu Cam: Học bù bài vắng</span>
          <span class="legend-tag-blue">■ Màu Xanh: Bổ trợ / Online đêm</span>
        </div>
      </div>

      <!-- 2. Thanh thông báo gửi phụ huynh -->
      ${alertBoxHtml}

      <!-- 3. Lưới Lịch Tuần 7 Cột (Thứ 2 -> Chủ Nhật) -->
      <div class="weekly-seven-cols-grid">
        ${sevenDayColumnsHtml}
      </div>

      <!-- 4. Thanh 7 Khung Giờ Ca Chuẩn Cố Định Ở Dưới Cùng -->
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
 * DỰNG TRANG 2: ĐỐI SOÁT BÀI THI GIẤY OMR (HOẶC KHUNG TỰ LUYỆN) + LỊCH TUẦN 7 NGÀY Ở ĐÁY TRANG
 * CĂN CHỈNH PIXEL-PERFECT VỪA KHÍT 1 TRANG A4 (297mm), TUYỆT ĐỐI KHÔNG TRÀN SANG TRANG 3
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

  const hasOMR = Boolean(student.hasPaperOMR && student.scannedPaperImageUrl);

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
            w.studentAnswer === "Chưa tô",
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
          <td colspan="5" style="text-align:center; padding:12px; color:#047857; font-weight:bold; font-size:12px;">
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
              !rawStuAns ||
              rawStuAns === "Bỏ trống" ||
              rawStuAns === "Chưa tô" ||
              rawStuAns === "Bỏ trống / Chưa tô";

            const stuAnsDisplay = isBlank ? "Bỏ trống" : rawStuAns;

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
                  ${escapeHtml(stuAnsDisplay)}
                </td>
                <td style="text-align:center; font-weight:bold; color:#003399; background:#EFF6FF;">
                  ${escapeHtml(row.correctAnswer || "--")}
                </td>
                <td style="text-align:center; font-weight:bold; color:${
                  isRight ? "#047857" : "#DC2626"
                };">
                  ${isRight ? "✓ Đúng" : isBlank ? "✗ Trống" : "✗ Sai"}
                </td>
              </tr>
            `;
          })
          .join("");

  const upperContentHtml = hasOMR
    ? `
      <div class="omr-appendix-two-cols">
        <div class="omr-left-image-col">
          <div class="omr-col-title">ẢNH PHIẾU LÀM BÀI GỐC CỦA HỌC SINH</div>
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
                <th style="width:44px; text-align:center;">Câu</th>
                <th style="width:52px; text-align:center;">Phần</th>
                <th style="text-align:center;">Con chọn</th>
                <th style="text-align:center;">Đáp án TCT</th>
                <th style="width:62px; text-align:center;">Kết quả</th>
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
                <span><strong>Xanh dương:</strong> SBD & Mã đề</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
    : `
      <div class="self-study-guideline-box">
        <div class="section-header">NỘI DUNG ÔN TẬP TRỌNG TÂM & KẾ HOẠCH TỰ LUYỆN TẠI NHÀ</div>
        <div class="study-topic-banner">
          📘 Chuyên đề trọng tâm: <strong>${escapeHtml(effectiveTopic.toUpperCase())}</strong>
        </div>
        <div class="study-checklist-grid">
          <div class="study-step-card">
            <div class="study-step-title">1. ÔN TẬP LÝ THUYẾT & CÔNG THỨC CỐT LÕI</div>
            <p>Rà soát lại toàn bộ hệ thống định nghĩa, tính chất và các dạng bài tập mẫu đã được giảng dạy trong buổi học Tuần ${
              config.selectedWeek
            } - Tháng ${config.selectedMonth}.</p>
          </div>
          <div class="study-step-card">
            <div class="study-step-title">2. HOÀN THÀNH BÀI TẬP VỀ NHÀ (BTVN)</div>
            <p>Thực hành đầy đủ phiếu Bài tập về nhà của chuyên đề <strong>${escapeHtml(
              effectiveTopic
            )}</strong> và nộp đúng hạn trước buổi học tuần kế tiếp.</p>
          </div>
          <div class="study-step-card">
            <div class="study-step-title">3. RÈN PHẢN XẠ TRẮC NGHIỆM 3 PHẦN (FORM MỚI)</div>
            <p>Luyện kỹ năng bấm giờ cho cả 3 phần: Trắc nghiệm ABCD (Phần I), Đúng/Sai 4 mệnh đề (Phần II) và Điền đáp số trả lời ngắn (Phần III).</p>
          </div>
          <div class="study-step-card">
            <div class="study-step-title">4. ĐĂNG KÝ CA HỌC BÙ / BỔ TRỢ KHI CẦN</div>
            <p>Nếu con vắng mặt hoặc còn vướng mắc ở các câu vận dụng, gia đình theo dõi bảng lịch tuần 7 ngày bên dưới để cho con tham gia học bù kịp thời.</p>
          </div>
        </div>
      </div>
    `;

  return `
    <section class="a4-page ${isLastPageOfWholeDoc ? "" : "page-break"}">
      <div class="a4-inner">
        ${renderTCTBrandHeaderHTML()}

        <div class="report-title-banner omr-banner-accent">
          <h1>${
            hasOMR
              ? "PHỤ BẢN ĐỐI SOÁT PHIẾU TRẢ LỜI TRẮC NGHIỆM (OMR) & LỊCH BỔ TRỢ"
              : "KẾ HOẠCH ÔN TẬP TỰ LUYỆN & LỊCH HỌC BÙ / BỔ TRỢ HÀNG TUẦN"
          }</h1>
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

        ${upperContentHtml}

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
          box-sizing: border-box;
        }
        .page-break {
          page-break-after: always;
          break-after: page;
        }
        .a4-inner {
          width: 100%;
          height: 100%;
          padding: 7mm 10mm 6mm 10mm;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }
        .tct-brand-header {
          width: 100%;
          margin-bottom: 3px;
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
        .tct-footer-svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .report-title-banner {
          text-align: center;
          background: #F8FAFC;
          border-top: 2px solid #003399;
          border-bottom: 2px solid #F58220;
          padding: 4.5px 10px;
          margin-bottom: 5px;
          flex-shrink: 0;
        }
        .omr-banner-accent {
          background: #EFF6FF;
        }
        .report-title-banner h1 {
          margin: 0;
          font-size: 17px;
          font-weight: bold;
          color: #003399;
          letter-spacing: 0.2px;
        }
        .report-subtitle {
          margin-top: 2px;
          font-size: 12.5px;
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
        .makeup-done-callout {
          margin-top: 7px;
          padding: 6px 10px;
          background: #FEF3C7;
          border: 1px solid #F59E0B;
          border-radius: 5px;
          font-size: 13px;
          color: #92400E;
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
        .attendance-highlight-container {
          margin-top: 9px;
          padding-top: 8px;
          border-top: 1.5px dashed #94A3B8;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .attendance-highlight-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .attendance-group-label {
          font-size: 12.5px;
          font-weight: bold;
          color: #003399;
        }
        .attendance-pills-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .status-pill {
          padding: 6px 8px;
          border-radius: 6px;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-align: center;
        }
        .status-pill-icon {
          font-size: 15px;
          font-style: normal;
        }
        .status-pill-inactive {
          background: #F8FAFC;
          border: 1px solid #CBD5E1;
          color: #64748B;
          font-weight: normal;
        }
        .status-pill-active-green {
          background: #DCFCE7;
          border: 2px solid #059669;
          color: #065F46;
          font-weight: bold;
        }
        .status-pill-active-amber {
          background: #FEF3C7;
          border: 2px solid #D97706;
          color: #92400E;
          font-weight: bold;
        }
        .status-pill-active-red {
          background: #FEE2E2;
          border: 2px solid #DC2626;
          color: #991B1B;
          font-weight: bold;
        }

        /* ==============================================================
           TRANG 2: THÂN TRÊN (ĐỐI SOÁT OMR ~152mm) + ĐÁY TRANG (LỊCH 7 NGÀY ~60mm)
           ============================================================== */
        .omr-appendix-two-cols {
          display: grid;
          grid-template-columns: 48% 50.5%;
          gap: 1.5%;
          height: 152mm;
          max-height: 152mm;
          margin-bottom: 5px;
          flex-shrink: 0;
        }
        .omr-left-image-col,
        .omr-right-table-col {
          border: 1px solid #94A3B8;
          border-radius: 6px;
          padding: 5.5px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #FFFFFF;
        }
        .omr-col-title {
          font-size: 11px;
          font-weight: bold;
          color: #003399;
          text-align: center;
          border-bottom: 1px solid #CBD5E1;
          padding-bottom: 3px;
          margin-bottom: 4px;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .omr-sheet-frame {
          position: relative;
          height: 138mm;
          max-height: 138mm;
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
          gap: 5px;
          margin-bottom: 4px;
          flex-shrink: 0;
        }
        .omr-stat-pill {
          padding: 2px 4px;
          border-radius: 4px;
          text-align: center;
          font-size: 10px;
        }
        .omr-stat-pill span {
          display: block;
          color: #334155;
        }
        .omr-stat-pill strong {
          font-size: 12px;
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
          font-size: 10.2px;
          margin-bottom: 3px;
        }
        .omr-wrong-table th,
        .omr-wrong-table td {
          border: 1px solid #94A3B8;
          padding: 1.25px 4px;
          line-height: 1.12;
        }
        .omr-wrong-table th {
          background: #F1F5F9;
          font-size: 9.5px;
          text-transform: uppercase;
          color: #0F172A;
        }
        .omr-legend-box {
          margin-top: auto;
          background: #F8FAFC;
          border: 1px solid #CBD5E1;
          border-radius: 4px;
          padding: 3.5px 6px;
          font-size: 10px;
          flex-shrink: 0;
        }
        .legend-title {
          font-size: 9.5px;
          font-weight: bold;
          color: #003399;
          margin-bottom: 1.5px;
        }
        .legend-grid-compact {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5px 8px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .legend-dot {
          width: 7.5px;
          height: 7.5px;
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
          background: transparent;
          border: 1.5px dashed #F59E0B;
        }
        .dot-blue {
          background: rgba(37, 99, 235, 0.35);
          border: 1.5px solid #2563EB;
        }

        /* KHUNG NỘI DUNG TỰ LUYỆN KHI HỌC SINH KHÔNG CÓ BÀI KIỂM TRA OMR */
        .self-study-guideline-box {
          border: 1px solid #94A3B8;
          border-radius: 6px;
          padding: 10px 14px;
          margin-bottom: 5px;
          background: #FFFFFF;
          height: 152mm;
          max-height: 152mm;
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }
        .study-topic-banner {
          background: #FFFBEB;
          border: 1.5px solid #F58220;
          border-radius: 6px;
          padding: 7px 12px;
          font-size: 13.5px;
          color: #0F172A;
          margin-bottom: 8px;
        }
        .study-checklist-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          flex: 1;
        }
        .study-step-card {
          border: 1px solid #CBD5E1;
          border-radius: 6px;
          padding: 8px 11px;
          background: #F8FAFC;
        }
        .study-step-title {
          font-size: 12.5px;
          font-weight: bold;
          color: #003399;
          margin-bottom: 5px;
        }
        .study-step-card p {
          margin: 0;
          font-size: 12.5px;
          line-height: 1.4;
          color: #1E293B;
        }

        /* ==============================================================
           KHUNG LỊCH TUẦN 7 NGÀY (THỨ 2 -> CHỦ NHẬT) Ở ĐÁY TRANG 2 (~60mm)
           ============================================================== */
        .bottom-weekly-schedule-container {
          border: 2px solid #1E40AF;
          border-radius: 10px;
          padding: 6.5px 9px;
          background: #FFFFFF;
          color: #1E293B;
          margin-top: auto;
          margin-bottom: 2px;
          flex-shrink: 0;
        }
        .weekly-header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;
          border-bottom: 1px solid #E2E8F0;
          padding-bottom: 3.5px;
          margin-bottom: 4.5px;
        }
        .weekly-title-group {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .weekly-main-title {
          font-size: 11px;
          font-weight: bold;
          color: #003399;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .weekly-date-range-badge {
          font-size: 10px;
          font-weight: bold;
          color: #1E3A8A;
          background: #EFF6FF;
          border: 1px solid #BFDBFE;
          padding: 0.5px 6px;
          border-radius: 4px;
          white-space: nowrap;
        }
        .weekly-legend-group {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 10px;
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
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          line-height: 1.3;
          color: #9A3412;
          margin-bottom: 5px;
          display: flex;
          align-items: center;
          gap: 5px;
        }
        .weekly-seven-cols-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 5px;
          margin-bottom: 5px;
        }
        .day-col-card {
          border-radius: 7px;
          padding: 4px 4.5px;
          text-align: center;
          min-height: 54px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
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
          padding-bottom: 2px;
          margin-bottom: 3px;
        }
        .day-col-top-line {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 3px;
        }
        .day-title-text {
          font-size: 10px;
          font-weight: bold;
          color: #0F172A;
        }
        .day-today-badge {
          font-size: 7.5px;
          font-weight: bold;
          background: #2563EB;
          color: #FFFFFF;
          padding: 0.5px 3.5px;
          border-radius: 3px;
        }
        .day-date-text {
          font-size: 9px;
          color: #64748B;
          font-weight: bold;
        }
        .day-empty-label {
          font-size: 8.8px;
          color: #94A3B8;
          font-style: italic;
          margin: auto 0;
        }
        .day-sessions-stack {
          display: flex;
          flex-direction: column;
          gap: 2.5px;
          margin: auto 0;
        }
        .day-session-pill {
          border-radius: 4px;
          padding: 2px 3px;
          font-size: 8.8px;
          line-height: 1.15;
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
          font-size: 8.8px;
          font-weight: bold;
        }
        .pill-shift-type {
          font-size: 7.8px;
          text-transform: uppercase;
          opacity: 0.9;
        }
        .weekly-std-shifts-bar {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 6px;
          padding: 3.5px 6px;
        }
        .std-shifts-label {
          font-size: 8.8px;
          font-weight: bold;
          color: #334155;
          text-transform: uppercase;
          margin-bottom: 2.5px;
        }
        .std-shifts-pills-row {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .std-shift-mini-pill {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 4px;
          padding: 1.5px 2px;
          text-align: center;
          font-size: 8.5px;
          white-space: nowrap;
        }
        .std-pill-code {
          font-weight: bold;
          color: #1D4ED8;
          display: block;
          font-size: 8.2px;
        }
        .std-pill-time {
          color: #0F172A;
          font-weight: bold;
          font-size: 8.3px;
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
          }
        }
      </style>
    </head>
    <body>
      <div class="print-toolbar">
        <div class="toolbar-info">
          <strong>HỆ THỐNG BÁO CÁO HỌC TẬP TÂM CHÍ TÀI (TCT)</strong> — Ngày ${escapeHtml(
            reportConfig.customDateStr
          )} (${totalStudents} học sinh • Chuẩn 2 trang A4/HS kèm Lịch Tuần 7 Ngày)
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
 * MỞ CỬA SỔ IN / LƯU FILE PDF ĐA TRANG GỘP TOÀN BỘ HỌC SINH
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
