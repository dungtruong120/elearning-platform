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

/**
 * DỰNG VECTOR SVG BANNER HEADER THƯƠNG HIỆU TCT (100% TÂM CHÍ TÀI - CHUẨN FONT TIMES NEW ROMAN)
 */
function renderTCTBrandHeaderHTML(): string {
  return `
    <div class="tct-brand-header">
      <svg viewBox="0 0 1068 82" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" class="tct-header-svg">
        <polygon points="8,14 152,14 138,76 0,76" fill="#F58220" />
        <polygon points="0,4 142,4 128,66 0,66" fill="#FFFFFF" stroke="#003399" stroke-width="2.4" />
        <text x="68" y="43" font-family="'Times New Roman', Times, serif" font-size="33" font-weight="bold" text-anchor="middle" fill="#003399" letter-spacing="1">TCT</text>
        <text x="66" y="59" font-family="'Times New Roman', Times, serif" font-size="10" font-weight="bold" text-anchor="middle" fill="#003399" letter-spacing="1">TÂM CHÍ TÀI</text>

        <text x="372" y="34" font-family="'Times New Roman', Times, serif" font-size="19" font-style="italic" font-weight="bold" text-anchor="middle" fill="#003399">
          Chuyên luyện thi vào 10, HSA, TSA và THPT
        </text>
        <text x="372" y="58" font-family="'Times New Roman', Times, serif" font-size="13.5" font-weight="bold" text-anchor="middle" fill="#1E293B">
          Hotline: 0972 26 16 16  •  Đ/c: Số 10, Tạ Quang Bửu, Bách Khoa, Hà Nội
        </text>

        <polygon points="586,24 628,24 613,62 571,62" fill="#F58220" />
        <polygon points="642,24 684,24 669,62 627,62" fill="#F58220" />

        <polygon points="700,24 1065,24 1065,62 685,62" fill="#FFFFFF" stroke="#003399" stroke-width="2" />
        <text x="878" y="48" font-family="'Times New Roman', Times, serif" font-size="17" font-style="italic" font-weight="bold" text-anchor="middle" fill="#003399">
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
      <svg viewBox="0 0 1068 44" xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" class="tct-footer-svg">
        <circle cx="24" cy="22" r="12" fill="none" stroke="#003399" stroke-width="1.8" />
        <path d="M19,16 C21,14 23,17 22,19 C21,21 24,24 26,23 C28,22 31,24 29,26 C26,29 17,20 19,16 Z" fill="#003399" />
        <text x="44" y="27" font-family="'Times New Roman', Times, serif" font-size="15.5" font-weight="bold" fill="#003399">0972 26 16 16</text>

        <circle cx="215" cy="22" r="12" fill="#003399" />
        <polygon points="215,14 207,21 210,21 210,28 220,28 220,21 223,21" fill="#FFFFFF" />
        <text x="235" y="27" font-family="'Times New Roman', Times, serif" font-size="15.5" font-weight="bold" fill="#003399">
          Số 10, Tạ Quang Bửu, Bách Khoa, Hà Nội
        </text>

        <text x="580" y="27" font-family="'Times New Roman', Times, serif" font-size="13" font-weight="bold" fill="#475569">
          ${escapeHtml(studentQuickTag)}
        </text>

        <polygon points="835,4 857,4 843,40 821,40" fill="#F58220" />
        <polygon points="859,4 1065,4 1065,40 845,40" fill="#FFFFFF" stroke="#003399" stroke-width="2" />
        <text x="955" y="28" font-family="'Times New Roman', Times, serif" font-size="15.5" font-weight="bold" text-anchor="middle" fill="#0033CC">
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
 * DỰNG TRANG BÌA TỔNG KẾT ĐIỂM CẢ LỚP (TÙY CHỌN Ở TRANG ĐẦU FILE PDF)
 */
function renderClassSummaryCoverPageHTML(
  config: DailyReportConfig,
  students: StudentDailyScoreData[]
): string {
  const effectiveTopic =
    (config.overrideTopicTitle && config.overrideTopicTitle.trim()) ||
    config.topicTitle ||
    "Chuyên đề Toán Tư Duy & Trắc Nghiệm Tia Chớp";

  const rowsHtml = students
    .map((stu, idx) => {
      const attBadge =
        stu.attendance === "present"
          ? `<span style="color:#047857; font-weight:bold;">✓ Có mặt đúng giờ</span>`
          : stu.attendance === "late"
          ? `<span style="color:#B45309; font-weight:bold;">⚠️ Đi học muộn</span>`
          : `<span style="color:#DC2626; font-weight:bold;">✕ Nghỉ học</span>`;

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
  } - Tháng ${config.selectedMonth}  •  Chuyên đề: <strong>${escapeHtml(
    effectiveTopic
  )}</strong>
          </div>
        </div>

        <table class="summary-cover-table">
          <thead>
            <tr>
              <th style="width:40px; text-align:center;">STT</th>
              <th style="width:80px; text-align:center;">SBD</th>
              <th>Họ và tên học sinh</th>
              <th>Trường THPT</th>
              <th style="width:76px; text-align:center;">Điểm BTVN</th>
              <th style="width:80px; text-align:center;">Test Ngày</th>
              <th style="width:86px; text-align:center;">Đề Tháng</th>
              <th style="width:125px; text-align:center;">Chuyên cần</th>
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
 * (ĐÃ XÓA KHỐI CHỮ KÝ THỪA, PHÓNG TO CHUYÊN CẦN & CHUẨN HÓA FONT TIMES NEW ROMAN SẮC NÉT)
 */
function renderSingleStudentDailyReportPageHTML(
  config: DailyReportConfig,
  student: StudentDailyScoreData,
  studentOrder: number,
  totalStudents: number,
  isLastPageOfWholeDoc: boolean
): string {
  const effectiveTopic =
    (config.overrideTopicTitle && config.overrideTopicTitle.trim()) ||
    config.topicTitle ||
    "Chuyên đề Toán Tư Duy & Luyện Đề Thực Chiến";

  const hasValidHwScore =
    student.homeworkScore !== null &&
    student.homeworkScore !== undefined &&
    !isNaN(Number(student.homeworkScore));

  const hwSubLabel =
    student.homeworkCorrect !== null &&
    student.homeworkCorrect !== undefined &&
    student.homeworkTotal
      ? `Đúng ${student.homeworkCorrect}/${student.homeworkTotal} câu BTVN`
      : hasValidHwScore
      ? "Đã hoàn thành bài tập về nhà"
      : "Chưa hoàn thành / Chưa nộp BTVN";

  const testSubLabel =
    student.dailyTestCorrect !== null &&
    student.dailyTestCorrect !== undefined &&
    student.dailyTestTotal
      ? `Đúng ${student.dailyTestCorrect}/${student.dailyTestTotal} câu (${
          student.hasPaperOMR ? "Chấm phiếu OMR" : "Làm trên hệ thống"
        })`
      : student.dailyTestScore !== null
      ? student.hasPaperOMR
        ? "Bài kiểm tra trên giấy OMR"
        : "Bài kiểm tra tại lớp"
      : "Chưa có điểm kiểm tra ngày";

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

  // THẺ HUY HIỆU CHUYÊN CẦN & Ý THỨC BTVN TO RÕ, NỔI BẬT
  const attOptions = [
    {
      key: "present",
      label: "Có mặt đúng giờ",
      activeClass: "status-pill-active-green"
    },
    {
      key: "late",
      label: "Đi học muộn",
      activeClass: "status-pill-active-amber"
    },
    {
      key: "absent",
      label: "Nghỉ học",
      activeClass: "status-pill-active-red"
    }
  ];

  const hwOptions = [
    {
      key: "completed",
      label: "Hoàn thành đầy đủ",
      activeClass: "status-pill-active-green"
    },
    {
      key: "late",
      label: "Nộp muộn",
      activeClass: "status-pill-active-amber"
    },
    {
      key: "missing",
      label: "Chưa hoàn thành",
      activeClass: "status-pill-active-red"
    }
  ];

  const attendancePillsHtml = attOptions
    .map((opt) => {
      const isSelected = student.attendance === opt.key;
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

  return `
    <section class="a4-page ${isLastPageOfWholeDoc ? "" : "page-break"}">
      <div class="a4-inner">
        ${renderTCTBrandHeaderHTML()}

        <!-- TIÊU ĐỀ PHIẾU BÁO CÁO -->
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
            <div><span class="info-label">Mã hồ sơ lớp:</span> <strong>#${studentOrder}/${totalStudents}</strong></div>
          </div>
        </div>

        <!-- 2. NỘI DUNG CHUYÊN ĐỀ BUỔI HỌC -->
        <div class="section-box topic-highlight-box">
          <div class="section-header">2. NỘI DUNG CHUYÊN ĐỀ BUỔI HỌC (ĐỒNG BỘ TỪ CHƯƠNG TRÌNH HỌC)</div>
          <div class="topic-title-main">
            📘 Chuyên đề: ${escapeHtml(effectiveTopic.toUpperCase())}
          </div>
          <div class="topic-subnote">
            Lộ trình chuẩn: Tuần ${config.selectedWeek} — Tháng ${
    config.selectedMonth
  }  •  Phương pháp Toán Tư Duy & Phản xạ Trắc Nghiệm Tia Chớp TCT
          </div>
        </div>

        <!-- 3. KẾT QUẢ ĐIỂM SỐ TRONG NGÀY (3 CỘT) -->
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
          <div class="section-header">4. PHÂN TÍCH CẤU TRÚC BÀI KIỂM TRA THEO FORM MỚI BỘ GD&ĐT</div>
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

        <!-- 5. NHẬN XÉT CỦA GIÁO VIÊN & THẺ HUY HIỆU CHUYÊN CẦN LỚN NỔI BẬT -->
        <div class="section-box" style="margin-bottom:auto;">
          <div class="section-header">5. NHẬN XÉT CỦA GIÁO VIÊN & TÌNH HÌNH CHUYÊN CẦN TRONG NGÀY</div>
          <div class="teacher-comment-box">
            "${escapeHtml(
              student.teacherComment ||
                `Em ${student.studentName} có ý thức học tập nghiêm túc trên lớp, nắm được phương pháp giải các dạng toán trọng tâm của buổi học. Gia đình nhắc nhở con duy trì luyện tập đều đặn các câu vận dụng để tối ưu tốc độ làm bài.`
            )}"
          </div>

          <div class="attendance-highlight-container">
            <div class="attendance-highlight-group">
              <div class="attendance-group-label">CHUYÊN CẦN BUỔI HỌC:</div>
              <div class="attendance-pills-grid">
                ${attendancePillsHtml}
              </div>
            </div>

            <div class="attendance-highlight-group">
              <div class="attendance-group-label">Ý THỨC LÀM BÀI TẬP VỀ NHÀ (BTVN):</div>
              <div class="attendance-pills-grid">
                ${hwStatusPillsHtml}
              </div>
            </div>
          </div>
        </div>

        ${renderTCTBrandFooterHTML(
          `HS ${studentOrder}/${totalStudents}`,
          `${student.studentName} • SBD: ${student.sbd}${
            student.hasPaperOMR ? " (Kèm phiếu OMR trang sau)" : ""
          }`
        )}
      </div>
    </section>
  `;
}

/**
 * DỰNG TRANG 2: TRANG PHỤ BẢN ĐỐI SOÁT BÀI THI GIẤY OMR
 * (HIỂN THỊ ĐẦY ĐỦ TẤT CẢ CÁC CÂU CỦA ĐỀ: CÂU | PHẦN | CON TÔ/CHỌN | ĐÁP ÁN CHUẨN TCT | KẾT QUẢ ✓ ĐÚNG / ✗ SAI)
 */
function renderStudentOMRAppendixPageHTML(
  config: DailyReportConfig,
  student: StudentDailyScoreData,
  studentOrder: number,
  totalStudents: number,
  isLastPageOfWholeDoc: boolean
): string {
  const fullQuestions: FullQuestionReviewRow[] = Array.isArray(
    (student as any).allQuestionsReviewList
  )
    ? (student as any).allQuestionsReviewList
    : [];

  const wrongList: WrongQuestionReviewItem[] = Array.isArray(student.wrongQuestionsList)
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
            w.studentAnswer === "Chưa tô"
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
          <td colspan="5" style="text-align:center; padding:16px; color:#047857; font-weight:bold; font-size:13px;">
            Bài thi đã được chấm điểm tự động qua hệ thống OMR (${formatStandardScore(
              student.dailyTestScore
            )}).
          </td>
        </tr>
      `
      : displayRows
          .map((row) => {
            const isRight = row.isCorrect;
            const rawStuAns = String(row.studentAnswer || "").trim();
            const isBlank =
              !rawStuAns ||
              rawStuAns === "Bỏ trống" ||
              rawStuAns === "Chưa tô" ||
              rawStuAns === "Bỏ trống / Chưa tô";

            const stuAnsDisplay = isBlank ? "Bỏ trống / Chưa tô" : rawStuAns;

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
                  ${isRight ? "✓ Đúng" : isBlank ? "✗ Bỏ trống" : "✗ Sai"}
                </td>
              </tr>
            `;
          })
          .join("");

  return `
    <section class="a4-page ${isLastPageOfWholeDoc ? "" : "page-break"}">
      <div class="a4-inner">
        ${renderTCTBrandHeaderHTML()}

        <div class="report-title-banner omr-banner-accent">
          <h1>PHỤ BẢN ĐỐI SOÁT PHIẾU TRẢ LỜI TRẮC NGHIỆM GỐC (OMR)</h1>
          <div class="report-subtitle">
            Học sinh: <strong>${escapeHtml(
              student.studentName
            )}</strong>  •  SBD: <strong>${escapeHtml(
    student.sbd
  )}</strong>  •  Bài thi: <strong>${escapeHtml(
    student.paperExamTitle || config.topicTitle || "Kiểm tra tại lớp"
  )}</strong> (Mã đề: <strong>${escapeHtml(student.paperExamCode || "101")}</strong>)
          </div>
        </div>

        <!-- BỐ CỤC 2 CỘT A4: TRÁI LÀ ẢNH PHIẾU ĐÃ KHOANH MÀU - PHẢI LÀ BẢNG ĐỐI CHIẾU TOÀN BỘ CÂU HỎI -->
        <div class="omr-appendix-two-cols">
          <!-- CỘT TRÁI: ẢNH SCAN PHIẾU GỐC + VECTOR SVG OVERLAY -->
          <div class="omr-left-image-col">
            <div class="omr-col-title">ẢNH PHIẾU LÀM BÀI GỐC CỦA HỌC SINH</div>
            <div class="omr-sheet-frame">
              ${
                student.scannedPaperImageUrl
                  ? `<img src="${student.scannedPaperImageUrl}" alt="Phiếu OMR của ${escapeHtml(
                      student.studentName
                    )}" class="omr-sheet-img" />`
                  : `<div style="padding:40px; text-align:center; color:#64748B;">Không tìm thấy ảnh phiếu gốc</div>`
              }
              ${renderOMROverlaySVG(student)}
            </div>
          </div>

          <!-- CỘT PHẢI: THỐNG KÊ & BẢNG ĐỐI CHIẾU TẤT CẢ CÁC CÂU TRONG ĐỀ -->
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
                  <th style="width:48px; text-align:center;">Câu</th>
                  <th style="width:56px; text-align:center;">Phần</th>
                  <th style="text-align:center;">Con tô / chọn</th>
                  <th style="text-align:center;">Đáp án TCT</th>
                  <th style="width:68px; text-align:center;">Kết quả</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml}
              </tbody>
            </table>

            <div class="omr-legend-box">
              <div class="legend-title">HƯỚNG DẪN PHỤ HUYNH ĐỌC KẾT QUẢ TRÊN PHIẾU:</div>
              <div class="legend-item">
                <span class="legend-dot dot-green"></span>
                <span><strong>Khoanh tròn Xanh lá:</strong> Câu học sinh tô đúng đáp án.</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot dot-red"></span>
                <span><strong>Khoanh tròn Đỏ:</strong> Câu học sinh tô sai đáp án.</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot dot-amber"></span>
                <span><strong>Khoanh tròn Vàng nét đứt:</strong> Vị trí đáp án đúng của đề để con đối chiếu sửa bài.</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot dot-blue"></span>
                <span><strong>Khoanh tròn Xanh dương:</strong> Nhận diện tự động 6 chữ số SBD và 3 chữ số Mã đề.</span>
              </div>
            </div>
          </div>
        </div>

        ${renderTCTBrandFooterHTML(
          `Phụ bản OMR`,
          `${student.studentName} • SBD: ${student.sbd}`
        )}
      </div>
    </section>
  `;
}

/**
 * HÀM CHÍNH: SINH TOÀN BỘ TÀI LIỆU MULTI-PAGE HTML A4 GỘP CẢ LỚP
 * (KHÓA FONT TIMES NEW ROMAN SẮC NÉT 100%, KHÔNG VỠ NÉT)
 */
export function generateClassDailyReportHTML(
  reportConfig: DailyReportConfig,
  studentsData: StudentDailyScoreData[]
): string {
  const safeStudents = Array.isArray(studentsData) ? studentsData : [];
  const totalStudents = safeStudents.length;

  let allPagesMarkup = "";

  if (reportConfig.includeCoverSummaryPage && totalStudents > 1) {
    allPagesMarkup += renderClassSummaryCoverPageHTML(reportConfig, safeStudents);
  }

  safeStudents.forEach((stu, idx) => {
    const isLastStudent = idx === totalStudents - 1;
    const hasOMRPage = Boolean(stu.hasPaperOMR && stu.scannedPaperImageUrl);

    allPagesMarkup += renderSingleStudentDailyReportPageHTML(
      reportConfig,
      stu,
      idx + 1,
      totalStudents,
      isLastStudent && !hasOMRPage
    );

    if (hasOMRPage) {
      allPagesMarkup += renderStudentOMRAppendixPageHTML(
        reportConfig,
        stu,
        idx + 1,
        totalStudents,
        isLastStudent
      );
    }
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
          height: 297mm;
          background: #FFFFFF;
          margin: 14px auto;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
          position: relative;
          overflow: hidden;
        }
        .page-break {
          page-break-after: always;
          break-after: page;
        }
        .a4-inner {
          width: 100%;
          height: 100%;
          padding: 9mm 11mm 8mm 11mm;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }
        .tct-brand-header {
          width: 100%;
          margin-bottom: 5px;
        }
        .tct-header-svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .tct-brand-footer {
          width: 100%;
          margin-top: auto;
          padding-top: 6px;
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
          padding: 8px 12px;
          margin-bottom: 9px;
        }
        .omr-banner-accent {
          background: #EFF6FF;
        }
        .report-title-banner h1 {
          margin: 0;
          font-size: 21px;
          font-weight: bold;
          color: #003399;
          letter-spacing: 0.4px;
        }
        .report-subtitle {
          margin-top: 4px;
          font-size: 14px;
          color: #0F172A;
        }
        .section-box {
          border: 1px solid #94A3B8;
          border-radius: 6px;
          padding: 9px 13px;
          margin-bottom: 9px;
          background: #FFFFFF;
        }
        .topic-highlight-box {
          background: #FFFBEB;
          border: 1.5px solid #F58220;
        }
        .section-header {
          font-size: 13px;
          font-weight: bold;
          color: #003399;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 1px solid #CBD5E1;
          padding-bottom: 4px;
          margin-bottom: 8px;
        }
        .student-info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 7px 18px;
          font-size: 14.5px;
        }
        .info-label {
          color: #334155;
        }
        .info-value-primary {
          color: #003399;
          font-size: 16px;
          text-transform: uppercase;
        }
        .sbd-badge {
          font-size: 15px;
          background: #EFF6FF;
          color: #003399;
          padding: 1px 10px;
          border-radius: 4px;
          border: 1px solid #93C5FD;
          letter-spacing: 1px;
        }
        .topic-title-main {
          font-size: 16px;
          font-weight: bold;
          color: #0F172A;
        }
        .topic-subnote {
          font-size: 13px;
          color: #334155;
          margin-top: 4px;
          font-style: italic;
        }
        .scores-three-cols {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .score-card {
          border-radius: 6px;
          padding: 9px 10px;
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
          font-size: 12px;
          font-weight: bold;
          color: #0F172A;
        }
        .score-card-value {
          font-size: 24px;
          font-weight: bold;
          color: #003399;
          margin: 5px 0;
        }
        .score-card-value-muted {
          font-size: 19px;
          color: #B45309;
          margin: 7px 0 5px 0;
        }
        .score-card-sub {
          font-size: 12.5px;
          color: #1E293B;
        }
        .parts-breakdown-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13.5px;
        }
        .parts-breakdown-table th,
        .parts-breakdown-table td {
          border: 1px solid #94A3B8;
          padding: 6px 10px;
        }
        .parts-breakdown-table th {
          background: #F1F5F9;
          font-size: 12px;
          text-transform: uppercase;
          color: #0F172A;
        }
        .teacher-comment-box {
          background: #F8FAFC;
          border-left: 4px solid #003399;
          border-top: 1px solid #E2E8F0;
          border-right: 1px solid #E2E8F0;
          border-bottom: 1px solid #E2E8F0;
          padding: 10px 12px;
          font-size: 14.5px;
          font-style: italic;
          line-height: 1.5;
          color: #0F172A;
        }
        /* KHỐI CHUYÊN CẦN & BTVN PHÓNG TO DẠNG BADGE TRỰC QUAN */
        .attendance-highlight-container {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1.5px dashed #94A3B8;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .attendance-highlight-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .attendance-group-label {
          font-size: 13px;
          font-weight: bold;
          color: #003399;
          letter-spacing: 0.2px;
        }
        .attendance-pills-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .status-pill {
          padding: 7px 10px;
          border-radius: 6px;
          font-size: 14.5px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          text-align: center;
        }
        .status-pill-icon {
          font-size: 16px;
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
        /* TRANG 2: PHỤ BẢN OMR */
        .omr-appendix-two-cols {
          display: grid;
          grid-template-columns: 52% 46.5%;
          gap: 1.5%;
          flex: 1;
          min-height: 0;
          margin-bottom: 6px;
        }
        .omr-left-image-col,
        .omr-right-table-col {
          border: 1px solid #94A3B8;
          border-radius: 6px;
          padding: 7px;
          display: flex;
          flex-direction: column;
        }
        .omr-col-title {
          font-size: 12px;
          font-weight: bold;
          color: #003399;
          text-align: center;
          border-bottom: 1px solid #CBD5E1;
          padding-bottom: 4px;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .omr-sheet-frame {
          position: relative;
          width: 100%;
          aspect-ratio: 1200 / 1700;
          max-height: 214mm;
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
          gap: 6px;
          margin-bottom: 6px;
        }
        .omr-stat-pill {
          padding: 4px 5px;
          border-radius: 5px;
          text-align: center;
          font-size: 11.5px;
        }
        .omr-stat-pill span {
          display: block;
          color: #334155;
        }
        .omr-stat-pill strong {
          font-size: 13.5px;
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
          font-size: 11.5px;
          margin-bottom: 6px;
        }
        .omr-wrong-table th,
        .omr-wrong-table td {
          border: 1px solid #94A3B8;
          padding: 2.5px 5px;
          line-height: 1.25;
        }
        .omr-wrong-table th {
          background: #F1F5F9;
          font-size: 10.5px;
          text-transform: uppercase;
          color: #0F172A;
        }
        .omr-legend-box {
          margin-top: auto;
          background: #F8FAFC;
          border: 1px solid #CBD5E1;
          border-radius: 5px;
          padding: 6px 8px;
          font-size: 11.5px;
        }
        .legend-title {
          font-size: 11px;
          font-weight: bold;
          color: #003399;
          margin-bottom: 3px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 2px;
        }
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
          flex-shrink: 0;
        }
        .dot-green {
          background: rgba(16, 185, 129, 0.35);
          border: 2px solid #10B981;
        }
        .dot-red {
          background: rgba(239, 68, 68, 0.35);
          border: 2px solid #EF4444;
        }
        .dot-amber {
          background: transparent;
          border: 2px dashed #F59E0B;
        }
        .dot-blue {
          background: rgba(37, 99, 235, 0.35);
          border: 2px solid #2563EB;
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
            height: 297mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-toolbar">
        <div class="toolbar-info">
          <strong>HỆ THỐNG BÁO CÁO HỌC TẬP TÂM CHÍ TÀI (TCT)</strong> — Ngày ${escapeHtml(
            reportConfig.customDateStr
          )} (${totalStudents} học sinh • Bản in Vector sắc nét 100%)
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
