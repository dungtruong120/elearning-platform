import {
  DailyReportConfig,
  StudentDailyScoreData
} from "@/types/report";

export interface FullQuestionReviewRow {
  questionNumber: number;
  part: string; // "Phần I" | "Phần II" | "Phần III"
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  isSkipped?: boolean;
  isOmrFormatError?: boolean;
  resultStatusText?: string;
}

export type ExtendedAttendanceStatus =
  | "present"
  | "makeup_done"
  | "absent_need_makeup"
  | "late"
  | "absent";

export interface MakeupSessionItem {
  id: string;
  date: string;
  shiftId: string;
  shiftLabel: string;
  timeSlot?: string;
  type: "makeup" | "support";
  note?: string;
}

export interface DailyPracticeExamSummaryItem {
  id: string;
  title: string;
  isHsa: boolean;
  score: number | string;
  maxScore: number;
  completedDate: string;
}

export const STANDARD_SUPPORT_SHIFTS = [
  {
    id: "morning_1",
    code: "CA 1",
    shortBadge: "CA 1 (08h-09h30)",
    label: "Ca Sáng 1",
    time: "08:00 - 09:30"
  },
  {
    id: "morning_2",
    code: "CA 2",
    shortBadge: "CA 2 (09h30-11h)",
    label: "Ca Sáng 2",
    time: "09:30 - 11:00"
  },
  {
    id: "afternoon_1",
    code: "CA 3",
    shortBadge: "CA 3 (14h30-16h)",
    label: "Ca Chiều 1",
    time: "14:30 - 16:00"
  },
  {
    id: "afternoon_2",
    code: "CA 4",
    shortBadge: "CA 4 (16h-17h30)",
    label: "Ca Chiều 2",
    time: "16:00 - 17:30"
  },
  {
    id: "evening_1",
    code: "CA 5",
    shortBadge: "CA 5 (18h-19h30)",
    label: "Ca Tối 1",
    time: "18:00 - 19:30"
  },
  {
    id: "evening_2",
    code: "CA 6",
    shortBadge: "CA 6 (19h30-21h)",
    label: "Ca Tối 2",
    time: "19:30 - 21:00"
  },
  {
    id: "night_online",
    code: "CA 7 (ĐÊM)",
    shortBadge: "CA ĐÊM (22h-23h)",
    label: "Ca Đêm (Online)",
    time: "22:00 - 23:00"
  }
];

export const TCT_BRANDING_FOOTER_TEXT =
  "TRUNG TÂM TOÁN TÂM CHÍ TÀI (TCT) • Hotline: 0972 26 16 16 • Địa chỉ: Số 10, Tạ Quang Bửu, Bách Khoa, Hà Nội";

export type ExtendedStudentDailyReportData = StudentDailyScoreData & {
  homeworkQuizTitle?: string;
  allQuestionsReviewList?: FullQuestionReviewRow[];
  allRows?: FullQuestionReviewRow[];
  questionReviews?: FullQuestionReviewRow[];
  attendanceStatus?: ExtendedAttendanceStatus;
  attendanceNote?: string;
  makeupSessions?: MakeupSessionItem[];
  practiceExamList?: DailyPracticeExamSummaryItem[];
  exportPages?: 1 | 2;
};

export interface DayColumnScheduleItem {
  dayIndex: number;
  dayTitle: string;
  shortDate: string;
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
    return "--";
  }
  return `${Number(score).toFixed(1)} / 10`;
}

function parseFlexibleDateString(rawStr: string, fallbackYear: number = 2026): Date | null {
  if (!rawStr) return null;
  const clean = String(rawStr).trim();

  const dmyMatch = clean.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmyMatch) {
    const dt = new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1]));
    if (!isNaN(dt.getTime())) return dt;
  }

  const isoMatch = clean.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const dt = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    if (!isNaN(dt.getTime())) return dt;
  }

  const dmMatch = clean.match(/(\d{1,2})\/(\d{1,2})/);
  if (dmMatch) {
    const dt = new Date(fallbackYear, Number(dmMatch[2]) - 1, Number(dmMatch[1]));
    if (!isNaN(dt.getTime())) return dt;
  }

  return null;
}

function formatDayMonth2Digits(dt: Date): string {
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function getMondayOfWeek(dt: Date): Date {
  const copy = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

/**
 * GIỮ NGUYÊN EXPORT `buildWeeklyCalendar7Days` ĐỂ BẢO TOÀN TƯƠNG THÍCH CHÉO
 */
export function buildWeeklyCalendar7Days(
  customDateStr: string,
  makeupSessions: MakeupSessionItem[] = []
): {
  weekRangeLabel: string;
  days: DayColumnScheduleItem[];
} {
  const reportDate = parseFlexibleDateString(customDateStr, 2026) || new Date(2026, 9, 31);
  const reportYear = reportDate.getFullYear();

  let anchorDate = reportDate;
  if (Array.isArray(makeupSessions) && makeupSessions.length > 0) {
    const firstSessionDate = parseFlexibleDateString(makeupSessions[0].date, reportYear);
    if (firstSessionDate) anchorDate = firstSessionDate;
  }

  const monday = getMondayOfWeek(anchorDate);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const weekRangeLabel = `${formatDayMonth2Digits(monday)} — ${formatDayMonth2Digits(sunday)}`;
  const dayHeaders = ["THỨ 2", "THỨ 3", "THỨ 4", "THỨ 5", "THỨ 6", "THỨ 7", "CHỦ NHẬT"];
  const reportShortDate = formatDayMonth2Digits(reportDate);

  const days: DayColumnScheduleItem[] = dayHeaders.map((title, idx) => {
    const curDate = new Date(monday);
    curDate.setDate(monday.getDate() + idx);
    const shortDate = formatDayMonth2Digits(curDate);

    const matchedSessions = (makeupSessions || [])
      .filter((sess) => {
        if (!sess || !sess.date) return false;
        const parsedSessDate = parseFlexibleDateString(sess.date, reportYear);
        if (parsedSessDate) return formatDayMonth2Digits(parsedSessDate) === shortDate;
        const norm = sess.date.toLowerCase();
        if (idx === 6 && (norm.includes("chủ nhật") || norm.includes("cn"))) return true;
        return norm.includes(`thứ ${idx + 2}`);
      })
      .map((sess) => {
        const stdShift = STANDARD_SUPPORT_SHIFTS.find((s) => s.id === sess.shiftId);
        return {
          id: sess.id,
          badgeText: stdShift?.shortBadge || sess.shiftLabel || "CA BỔ TRỢ",
          shiftLabel: stdShift?.label || sess.shiftLabel,
          timeSlot: stdShift?.time || sess.timeSlot || "",
          type: sess.type,
          note: sess.note
        };
      });

    return {
      dayIndex: idx,
      dayTitle: title,
      shortDate,
      isReportDay: shortDate === reportShortDate,
      sessions: matchedSessions
    };
  });

  return { weekRangeLabel, days };
}

/**
 * BANNER VECTOR SVG THƯƠNG HIỆU TÂM CHÍ TÀI (TCT)
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

function renderTCTBrandFooterHTML(pageNumberLabel: string): string {
  return `
    <div class="tct-brand-footer">
      <div class="tct-footer-bar">
        <div class="tct-footer-brand-text">${escapeHtml(TCT_BRANDING_FOOTER_TEXT)}</div>
        <span class="tct-footer-page-badge">${escapeHtml(pageNumberLabel)}</span>
      </div>
    </div>
  `;
}

/**
 * TRANG BÌA TỔNG HỢP LỚP (KHI IN NHIỀU HỌC SINH VÀ CÓ CHỌN KÈM TRANG BÌA)
 */
function renderClassSummaryCoverPageHTML(
  config: DailyReportConfig & { homeworkTopicLabel?: string },
  students: ExtendedStudentDailyReportData[]
): string {
  const effectiveTopic =
    (config.overrideTopicTitle && config.overrideTopicTitle.trim()) ||
    config.topicTitle ||
    "Chuyên đề Toán Tư Duy";

  const rowsHtml = students
    .map((stu, idx) => {
      const pracCount = Array.isArray(stu.practiceExamList) ? stu.practiceExamList.length : 0;
      const pracSummary =
        pracCount > 0
          ? stu
              .practiceExamList!.slice(0, 2)
              .map(
                (p) =>
                  `${p.isHsa ? "HSA" : "THPT"}: ${p.score}/${p.maxScore}${p.isHsa ? "đ" : ""}`
              )
              .join(", ")
          : "--";

      return `
        <tr>
          <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
          <td style="text-align:center; font-weight:bold; color:#003399;">${escapeHtml(
            stu.sbd
          )}</td>
          <td style="font-weight:bold;">${escapeHtml(stu.studentName)}</td>
          <td>${escapeHtml(stu.school)}</td>
          <td style="text-align:center; font-weight:bold; color:#003399;">${
            stu.homeworkScore !== null && stu.homeworkScore !== undefined
              ? `${Number(stu.homeworkScore).toFixed(1)}`
              : "Chưa nộp"
          }</td>
          <td style="text-align:center; font-weight:bold; color:#003399;">${
            stu.dailyTestScore !== null && stu.dailyTestScore !== undefined
              ? `${Number(stu.dailyTestScore).toFixed(1)}`
              : "Chưa KT"
          }</td>
          <td style="text-align:center; font-weight:bold; color:#334155;">${escapeHtml(
            pracSummary
          )}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <section class="a4-page page-break">
      <div class="a4-inner">
        ${renderTCTBrandHeaderHTML()}

        <div class="report-title-banner">
          <h1>BẢNG TỔNG HỢP KẾT QUẢ BUỔI HỌC (${students.length} HỌC SINH)</h1>
          <div class="report-subtitle">
            Ngày ${escapeHtml(config.customDateStr)} • Tuần ${config.selectedWeek} - Tháng ${
    config.selectedMonth
  } • <strong>${escapeHtml(effectiveTopic)}</strong>
          </div>
        </div>

        <table class="summary-cover-table">
          <thead>
            <tr>
              <th style="width:40px; text-align:center;">STT</th>
              <th style="width:76px; text-align:center;">SBD</th>
              <th>Họ và tên</th>
              <th>Trường THPT</th>
              <th style="width:78px; text-align:center;">BTVN</th>
              <th style="width:78px; text-align:center;">KT Lớp</th>
              <th style="width:155px; text-align:center;">Luyện đề (THPT/HSA)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        ${renderTCTBrandFooterHTML("Bảng tổng hợp lớp")}
      </div>
    </section>
  `;
}

/**
 * PHIẾU BÁO CÁO 1 TRANG A4 KHOA HỌC, TỐI GIẢN, DỄ ĐỌC TRÊN ĐIỆN THOẠI QUA ZALO
 */
function renderSingleStudentOnePageReportHTML(
  config: DailyReportConfig & { homeworkTopicLabel?: string },
  student: ExtendedStudentDailyReportData,
  isLastPageOfWholeDoc: boolean
): string {
  const effectiveTopic =
    (config.overrideTopicTitle && config.overrideTopicTitle.trim()) ||
    config.topicTitle ||
    "Chuyên đề Toán 12";

  const hwTitleLabel =
    student.homeworkQuizTitle || config.homeworkTopicLabel || "Bài tập về nhà";

  const hasValidHwScore =
    student.homeworkScore !== null &&
    student.homeworkScore !== undefined &&
    !isNaN(Number(student.homeworkScore));

  const hwSubLabel = hasValidHwScore
    ? student.homeworkCorrect !== null &&
      student.homeworkCorrect !== undefined &&
      student.homeworkTotal
      ? `Đúng ${student.homeworkCorrect}/${student.homeworkTotal} câu`
      : "Đã nộp bài"
    : "Chưa nộp";

  const hasDailyTestScore =
    student.dailyTestScore !== null &&
    student.dailyTestScore !== undefined &&
    !isNaN(Number(student.dailyTestScore));

  const testSubLabel = hasDailyTestScore
    ? student.dailyTestCorrect !== null &&
      student.dailyTestCorrect !== undefined &&
      student.dailyTestTotal
      ? `Đúng ${student.dailyTestCorrect}/${student.dailyTestTotal} câu`
      : "Kiểm tra trực tiếp tại lớp"
    : "Chưa kiểm tra";

  const practiceList: DailyPracticeExamSummaryItem[] = Array.isArray(student.practiceExamList)
    ? student.practiceExamList.filter((item) => item && String(item.title || "").trim() !== "")
    : [];

  const practiceTableBlockHtml =
    practiceList.length > 0
      ? `
        <div class="practice-subblock">
          <div class="subblock-label">Kết quả Luyện đề (THPT &amp; ĐGNL HSA) trong kỳ:</div>
          <table class="practice-clean-table">
            <thead>
              <tr>
                <th>Tên đề thi</th>
                <th style="width:110px; text-align:center;">Phân loại</th>
                <th style="width:95px; text-align:center;">Ngày làm</th>
                <th style="width:105px; text-align:center;">Điểm số</th>
              </tr>
            </thead>
            <tbody>
              ${practiceList
                .slice(0, 6)
                .map((p) => {
                  const scoreStr = p.isHsa
                    ? `${p.score} / ${p.maxScore}đ`
                    : `${p.score} / ${p.maxScore || 10}`;
                  return `
                    <tr>
                      <td style="font-weight:bold; color:#0F172A;">${escapeHtml(p.title)}</td>
                      <td style="text-align:center;">
                        <span class="${p.isHsa ? "tag-hsa" : "tag-thpt"}">
                          ${p.isHsa ? "ĐGNL HSA" : "THPT"}
                        </span>
                      </td>
                      <td style="text-align:center; color:#334155;">${escapeHtml(
                        p.completedDate || config.customDateStr
                      )}</td>
                      <td style="text-align:center; font-weight:bold; color:#003399;">${escapeHtml(
                        scoreStr
                      )}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      `
      : "";

  const hwStatusLineText =
    student.homeworkStatus === "completed"
      ? "Hoàn thành đầy đủ"
      : student.homeworkStatus === "late"
        ? "Nộp muộn hơn quy định"
        : "Chưa nộp BTVN";

  return `
    <section class="a4-page ${isLastPageOfWholeDoc ? "last-a4-page" : "page-break"}">
      <div class="a4-inner">
        ${renderTCTBrandHeaderHTML()}

        <!-- TIÊU ĐỀ CHÍNH GỌN GÀNG -->
        <div class="report-title-banner">
          <h1>BÁO CÁO KẾT QUẢ BUỔI HỌC</h1>
          <div class="report-subtitle">
            Ngày ${escapeHtml(config.customDateStr)} • Tuần ${config.selectedWeek} - Tháng ${
    config.selectedMonth
  }
          </div>
        </div>

        <!-- 1. THÔNG TIN HỌC SINH (GỌN 2 DÒNG) -->
        <div class="section-box">
          <div class="section-header">1. THÔNG TIN HỌC SINH</div>
          <div class="student-two-lines">
            <div class="student-line-row">
              <span>Họ và tên: <strong class="student-name-main">${escapeHtml(
                student.studentName
              )}</strong></span>
              <span>SBD: <strong class="sbd-badge">${escapeHtml(student.sbd)}</strong></span>
            </div>
            <div class="student-line-row student-line-secondary">
              <span>Trường: <strong>${escapeHtml(student.school || "THPT")}</strong></span>
              <span>Lớp: <strong>${escapeHtml(student.grade || "Lớp 12")}</strong></span>
            </div>
          </div>
        </div>

        <!-- 2. NỘI DUNG BUỔI HỌC -->
        <div class="section-box topic-clean-box">
          <div class="section-header">2. NỘI DUNG BUỔI HỌC</div>
          <div class="topic-title-main">${escapeHtml(effectiveTopic)}</div>
          <div class="topic-subnote">BTVN đối soát: <strong>${escapeHtml(
            hwTitleLabel
          )}</strong></div>
        </div>

        <!-- 3. KẾT QUẢ ĐIỂM SỐ BUỔI HỌC (2 CỘT LỚN CÂN ĐỐI, NỀN #F8FAFC, NHẤN #003399 & #F58220) -->
        <div class="section-box">
          <div class="section-header">3. KẾT QUẢ ĐIỂM SỐ BUỔI HỌC</div>
          <div class="scores-two-cols">
            <div class="score-card-clean">
              <div class="score-card-title">BÀI TẬP VỀ NHÀ</div>
              <div class="score-card-value ${hasValidHwScore ? "" : "score-value-muted"}">
                ${hasValidHwScore ? formatStandardScore(student.homeworkScore) : "Chưa nộp"}
              </div>
              <div class="score-card-sub">${escapeHtml(hwSubLabel)}</div>
            </div>

            <div class="score-card-clean score-card-accent">
              <div class="score-card-title">KIỂM TRA TẠI LỚP</div>
              <div class="score-card-value ${hasDailyTestScore ? "" : "score-value-muted"}">
                ${hasDailyTestScore ? formatStandardScore(student.dailyTestScore) : "Chưa kiểm tra"}
              </div>
              <div class="score-card-sub">${escapeHtml(testSubLabel)}</div>
            </div>
          </div>
        </div>

        <!-- 4. KẾT QUẢ LUYỆN ĐỀ (NẾU CÓ) & NHẬN XÉT CỦA GIÁO VIÊN -->
        <div class="section-box section-grow">
          <div class="section-header">4. ${
            practiceList.length > 0
              ? "KẾT QUẢ LUYỆN ĐỀ (THPT &amp; ĐGNL HSA) &amp; NHẬN XÉT CỦA GIÁO VIÊN"
              : "NHẬN XÉT CỦA GIÁO VIÊN"
          }</div>

          ${practiceTableBlockHtml}

          <div class="teacher-comment-box">
            "${escapeHtml(
              student.teacherComment ||
                `Em ${student.studentName} tham gia học tập nghiêm túc. Gia đình nhắc con ôn kỹ công thức trọng tâm và hoàn thiện BTVN đúng hạn.`
            )}"
          </div>

          <div class="compact-status-line">
            Ý thức BTVN: <strong>${escapeHtml(hwStatusLineText)}</strong>
          </div>
        </div>

        ${renderTCTBrandFooterHTML("Trang 1/1")}
      </div>
    </section>
  `;
}

/**
 * HÀM CHÍNH: SINH TÀI LIỆU HTML A4 — DUY NHẤT 1 TRANG A4 (`Trang 1/1`) CHO MỖI HỌC SINH
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
    allPagesMarkup += renderSingleStudentOnePageReportHTML(reportConfig, stu, isLastStudent);
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
          page-break-after: always;
          break-after: page;
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
          padding: 10mm 13mm 9mm 13mm;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }
        .tct-brand-header {
          width: 100%;
          margin-bottom: 8px;
          flex-shrink: 0;
        }
        .tct-header-svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .report-title-banner {
          text-align: center;
          background: #F8FAFC;
          border-top: 2.5px solid #003399;
          border-bottom: 2.5px solid #F58220;
          padding: 9px 14px;
          margin-bottom: 12px;
          flex-shrink: 0;
        }
        .report-title-banner h1 {
          margin: 0;
          font-size: 20px;
          font-weight: bold;
          color: #003399;
          letter-spacing: 0.4px;
        }
        .report-subtitle {
          margin-top: 4px;
          font-size: 14.5px;
          color: #334155;
        }
        .section-box {
          border: 1px solid #CBD5E1;
          border-radius: 8px;
          padding: 12px 15px;
          margin-bottom: 12px;
          background: #FFFFFF;
        }
        .section-grow {
          margin-bottom: auto;
        }
        .section-header {
          font-size: 13.5px;
          font-weight: bold;
          color: #003399;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 1px solid #E2E8F0;
          padding-bottom: 5px;
          margin-bottom: 10px;
        }
        .student-two-lines {
          display: flex;
          flex-direction: column;
          gap: 7px;
          font-size: 15.5px;
        }
        .student-line-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .student-line-secondary {
          font-size: 14.5px;
          color: #334155;
        }
        .student-name-main {
          color: #003399;
          font-size: 17.5px;
          text-transform: uppercase;
        }
        .sbd-badge {
          font-size: 15px;
          background: #F8FAFC;
          color: #003399;
          padding: 2px 10px;
          border-radius: 5px;
          border: 1px solid #CBD5E1;
          letter-spacing: 0.8px;
        }
        .topic-clean-box {
          border-left: 4px solid #F58220;
          background: #FFFFFF;
        }
        .topic-title-main {
          font-size: 17px;
          font-weight: bold;
          color: #0F172A;
          line-height: 1.35;
        }
        .topic-subnote {
          font-size: 13.5px;
          color: #475569;
          margin-top: 5px;
        }
        .scores-two-cols {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }
        .score-card-clean {
          border-radius: 8px;
          padding: 14px 12px;
          text-align: center;
          background: #F8FAFC;
          border: 1.5px solid #CBD5E1;
          border-top: 3.5px solid #003399;
        }
        .score-card-accent {
          border-top: 3.5px solid #F58220;
        }
        .score-card-title {
          font-size: 13px;
          font-weight: bold;
          color: #334155;
          letter-spacing: 0.3px;
        }
        .score-card-value {
          font-size: 30px;
          font-weight: bold;
          color: #003399;
          margin: 8px 0 6px 0;
        }
        .score-value-muted {
          font-size: 20px;
          color: #64748B;
          margin: 13px 0 11px 0;
        }
        .score-card-sub {
          font-size: 13.5px;
          color: #475569;
        }
        .practice-subblock {
          margin-bottom: 12px;
        }
        .subblock-label {
          font-size: 13.5px;
          font-weight: bold;
          color: #1E293B;
          margin-bottom: 6px;
        }
        .practice-clean-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13.5px;
        }
        .practice-clean-table th,
        .practice-clean-table td {
          border: 1px solid #CBD5E1;
          padding: 6px 9px;
        }
        .practice-clean-table th {
          background: #F8FAFC;
          color: #003399;
          font-size: 12.5px;
          text-transform: uppercase;
        }
        .tag-thpt {
          display: inline-block;
          padding: 1px 7px;
          border-radius: 4px;
          background: #F8FAFC;
          border: 1px solid #CBD5E1;
          color: #003399;
          font-size: 11.5px;
          font-weight: bold;
        }
        .tag-hsa {
          display: inline-block;
          padding: 1px 7px;
          border-radius: 4px;
          background: #FFF7ED;
          border: 1px solid #F58220;
          color: #9A3412;
          font-size: 11.5px;
          font-weight: bold;
        }
        .teacher-comment-box {
          background: #F8FAFC;
          border-left: 4px solid #003399;
          border-top: 1px solid #E2E8F0;
          border-right: 1px solid #E2E8F0;
          border-bottom: 1px solid #E2E8F0;
          border-radius: 0 6px 6px 0;
          padding: 12px 14px;
          font-size: 15.5px;
          font-style: italic;
          line-height: 1.55;
          color: #0F172A;
        }
        .compact-status-line {
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px dashed #CBD5E1;
          font-size: 14px;
          color: #334155;
        }
        .compact-status-line strong {
          color: #003399;
        }
        .tct-brand-footer {
          width: 100%;
          margin-top: auto;
          padding-top: 8px;
          flex-shrink: 0;
        }
        .tct-footer-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          border-top: 2px solid #003399;
          background: #F8FAFC;
          padding: 6px 12px;
          border-radius: 4px;
        }
        .tct-footer-brand-text {
          font-size: 11.8px;
          font-weight: bold;
          color: #003399;
        }
        .tct-footer-page-badge {
          font-size: 11.5px;
          font-weight: bold;
          color: #FFFFFF;
          background: #003399;
          border: 1px solid #F58220;
          padding: 2px 9px;
          border-radius: 4px;
          white-space: nowrap;
        }
        .summary-cover-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13.5px;
          margin-bottom: auto;
        }
        .summary-cover-table th,
        .summary-cover-table td {
          border: 1px solid #CBD5E1;
          padding: 6px 8px;
        }
        .summary-cover-table th {
          background: #F8FAFC;
          color: #003399;
          font-size: 12px;
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
          )} (${totalStudents} học sinh • Chuẩn 1 trang A4/HS)
        </div>
        <button class="btn-print-pdf" onclick="window.print()">
          🖨 In Báo Cáo / Lưu File PDF (${totalStudents} Học Sinh)
        </button>
      </div>

      ${allPagesMarkup}
    </body>
    </html>
  `;
}

export function openPrintOrDownloadClassReport(htmlContent: string): void {
  if (typeof window === "undefined" || !htmlContent) return;

  const printWin = window.open("", "_blank");
  if (!printWin) {
    alert(
      "Trình duyệt đang chặn cửa sổ bật lên (Pop-up). Vui lòng cho phép Pop-up để mở và lưu file PDF Báo cáo!"
    );
    return;
  }

  printWin.document.open();
  printWin.document.write(htmlContent);
  printWin.document.close();
}
