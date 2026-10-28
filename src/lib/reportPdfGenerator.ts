import {
  DailyReportConfig,
  StudentDailyScoreData,
  WrongQuestionReviewItem,
} from "@/types/report";
import { OMR_CANONICAL_WIDTH, OMR_CANONICAL_HEIGHT } from "@/lib/omrEngine";

function escapeHtml(raw: any): string {
  if (raw === null || raw === undefined) return "";
  return String(raw)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatScoreBadge(score: number | null | undefined): string {
  if (score === null || score === undefined || isNaN(Number(score))) {
    return "-- / 10";
  }
  return `${Number(score).toFixed(2).replace(/\.00$/, ".0")} / 10`;
}

/**
 * DỰNG VECTOR SVG BANNER HEADER THƯƠNG HIỆU TCT (100% TÂM CHÍ TÀI - KHÔNG DÙNG EDUNEXUS)
 */
function renderTCTBrandHeaderHTML(): string {
  return `
    <div class="tct-brand-header">
      <svg viewBox="0 0 1068 82" xmlns="http://www.w3.org/2000/svg" class="tct-header-svg">
        <!-- Khối cam đổ bóng sau Logo TCT -->
        <polygon points="8,14 152,14 138,76 0,76" fill="#F58220" />
        <!-- Khung nghiêng nền trắng viền xanh đậm chứa chữ TCT -->
        <polygon points="0,4 142,4 128,66 0,66" fill="#FFFFFF" stroke="#003399" stroke-width="2.6" />
        <text x="68" y="43" font-family="Arial, sans-serif" font-size="32" font-weight="900" text-anchor="middle" fill="#003399" letter-spacing="1">TCT</text>
        <text x="66" y="59" font-family="Arial, sans-serif" font-size="9.5" font-weight="900" text-anchor="middle" fill="#003399" letter-spacing="1.2">TÂM CHÍ TÀI</text>

        <!-- Slogan chính giữa -->
        <text x="372" y="34" font-family="'Times New Roman', Times, serif" font-size="18.5" font-style="italic" font-weight="bold" text-anchor="middle" fill="#003399">
          Chuyên luyện thi vào 10, HSA, TSA và THPT
        </text>
        <text x="372" y="58" font-family="Arial, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" fill="#334155">
          Hotline: 0972 26 16 16  •  Đ/c: Số 10, Tạ Quang Bửu, Bách Khoa, Hà Nội
        </text>

        <!-- 2 Khối hình bình hành màu cam -->
        <polygon points="586,24 628,24 613,62 571,62" fill="#F58220" />
        <polygon points="642,24 684,24 669,62 627,62" fill="#F58220" />

        <!-- Khung viền xanh bên phải -->
        <polygon points="700,24 1065,24 1065,62 685,62" fill="#FFFFFF" stroke="#003399" stroke-width="2.2" />
        <text x="878" y="48" font-family="'Times New Roman', Times, serif" font-size="16.5" font-style="italic" font-weight="bold" text-anchor="middle" fill="#003399">
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
      <svg viewBox="0 0 1068 44" xmlns="http://www.w3.org/2000/svg" class="tct-footer-svg">
        <circle cx="24" cy="22" r="12" fill="none" stroke="#003399" stroke-width="1.8" />
        <path d="M19,16 C21,14 23,17 22,19 C21,21 24,24 26,23 C28,22 31,24 29,26 C26,29 17,20 19,16 Z" fill="#003399" />
        <text x="44" y="27" font-family="'Times New Roman', Times, serif" font-size="15.5" font-weight="bold" fill="#003399">0972 26 16 16</text>

        <circle cx="215" cy="22" r="12" fill="#003399" />
        <polygon points="215,14 207,21 210,21 210,28 220,28 220,21 223,21" fill="#FFFFFF" />
        <text x="235" y="27" font-family="'Times New Roman', Times, serif" font-size="15.5" font-weight="bold" fill="#003399">
          Số 10, Tạ Quang Bửu, Bách Khoa, Hà Nội
        </text>

        <text x="635" y="26" font-family="Arial, sans-serif" font-size="11.5" font-weight="bold" fill="#64748B">
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
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="omr-overlay-svg">
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
          ? `<span style="color:#059669; font-weight:bold;">Có mặt</span>`
          : stu.attendance === "late"
          ? `<span style="color:#D97706; font-weight:bold;">Đi muộn</span>`
          : `<span style="color:#DC2626; font-weight:bold;">Vắng mặt</span>`;

      return `
        <tr>
          <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
          <td style="text-align:center; font-family:monospace; font-weight:bold; color:#003399;">${escapeHtml(
            stu.sbd
          )}</td>
          <td style="font-weight:bold;">${escapeHtml(stu.studentName)}</td>
          <td>${escapeHtml(stu.school)}</td>
          <td style="text-align:center; font-weight:bold; color:#059669;">${
            stu.homeworkScore !== null ? `${stu.homeworkScore}đ` : "--"
          }</td>
          <td style="text-align:center; font-weight:bold; color:#1D4ED8;">${
            stu.dailyTestScore !== null ? `${stu.dailyTestScore}đ` : "--"
          }</td>
          <td style="text-align:center; font-weight:bold; color:#7C3AED;">${
            stu.practiceScore !== null ? `${stu.practiceScore}đ` : "--"
          }</td>
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
              <th style="width:38px; text-align:center;">STT</th>
              <th style="width:78px; text-align:center;">SBD</th>
              <th>Họ và tên học sinh</th>
              <th>Trường THPT</th>
              <th style="width:74px; text-align:center;">Điểm BTVN</th>
              <th style="width:78px; text-align:center;">Test Ngày</th>
              <th style="width:78px; text-align:center;">Đề Tháng</th>
              <th style="width:82px; text-align:center;">Chuyên cần</th>
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
 * DỰNG TRANG 1: PHIẾU BÁO CÁO KẾT QUẢ BUỔI HỌC CỦA TỪNG HỌC SINH (BRANDING TCT 100%)
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

  const hwSubLabel =
    student.homeworkCorrect !== null &&
    student.homeworkCorrect !== undefined &&
    student.homeworkTotal
      ? `Đúng ${student.homeworkCorrect}/${student.homeworkTotal} câu BTVN`
      : student.homeworkScore !== null
      ? "Đã hoàn thành BTVN"
      : "Chưa nộp bài tập về nhà";

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

  const practiceSubLabel =
    student.practiceExamTitle ||
    config.practiceExamTitle ||
    `Đề thực chiến Tháng ${config.selectedMonth}`;

  const p1Display =
    student.part1Score ||
    (student.dailyTestScore !== null ? "Đã tổng hợp vào điểm chung" : "Chưa kiểm tra");
  const p2Display =
    student.part2Score ||
    (student.dailyTestScore !== null ? "Đã tổng hợp vào điểm chung" : "Chưa kiểm tra");
  const p3Display =
    student.part3Score ||
    (student.dailyTestScore !== null ? "Đã tổng hợp vào điểm chung" : "Chưa kiểm tra");

  const attendancePresentChecked = student.attendance === "present" ? "☑" : "☐";
  const attendanceLateChecked = student.attendance === "late" ? "☑" : "☐";
  const attendanceAbsentChecked = student.attendance === "absent" ? "☑" : "☐";

  const hwDoneChecked = student.homeworkStatus === "completed" ? "☑" : "☐";
  const hwMissingChecked = student.homeworkStatus === "missing" ? "☑" : "☐";
  const hwLateChecked = student.homeworkStatus === "late" ? "☑" : "☐";

  const directorName = config.centerDirectorName || "Ban Giám Đốc Trung Tâm TCT";
  const teacherName = config.teacherName || "Thầy Trương Ngọc Dũng";

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
              <div class="score-card-value">${formatScoreBadge(student.homeworkScore)}</div>
              <div class="score-card-sub">${escapeHtml(hwSubLabel)}</div>
            </div>

            <div class="score-card score-card-blue">
              <div class="score-card-title">2. BÀI KIỂM TRA TẠI LỚP</div>
              <div class="score-card-value">${formatScoreBadge(student.dailyTestScore)}</div>
              <div class="score-card-sub">${escapeHtml(testSubLabel)}</div>
            </div>

            <div class="score-card score-card-orange">
              <div class="score-card-title">3. ĐỀ LUYỆN THI THỰC CHIẾN</div>
              <div class="score-card-value">${formatScoreBadge(student.practiceScore)}</div>
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
                <th>Cấu trúc phần thi</th>
                <th>Dạng thức câu hỏi</th>
                <th style="text-align:center;">Kết quả đạt được</th>
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

        <!-- 5. NHẬN XÉT CỦA GIÁO VIÊN & TÌNH HÌNH CHUYÊN CẦN -->
        <div class="section-box">
          <div class="section-header">5. NHẬN XÉT CỦA GIÁO VIÊN & Ý THỨC CHUYÊN CẦN</div>
          <div class="teacher-comment-box">
            "${escapeHtml(
              student.teacherComment ||
                `Em ${student.studentName} có ý thức học tập nghiêm túc trên lớp, nắm được phương pháp giải các dạng toán trọng tâm của buổi học. Gia đình nhắc nhở con duy trì luyện tập đều đặn các câu vận dụng để tối ưu tốc độ làm bài.`
            )}"
          </div>

          <div class="attendance-check-row">
            <div>
              <strong>Chuyên cần buổi học:</strong>
              <span>${attendancePresentChecked} Có mặt đúng giờ</span>
              <span>${attendanceLateChecked} Đi học muộn</span>
              <span>${attendanceAbsentChecked} Nghỉ học</span>
            </div>
            <div>
              <strong>Ý thức làm BTVN:</strong>
              <span>${hwDoneChecked} Hoàn thành đầy đủ</span>
              <span>${hwLateChecked} Nộp muộn</span>
              <span>${hwMissingChecked} Chưa hoàn thành</span>
            </div>
          </div>
        </div>

        <!-- 6. CHỮ KÝ XÁC NHẬN -->
        <div class="signature-grid">
          <div class="signature-col">
            <div class="sig-title">ĐẠI DIỆN TRUNG TÂM TÂM CHÍ TÀI</div>
            <div class="sig-stamp">ĐÃ XÁC NHẬN CHẤT LƯỢNG ĐÀO TẠO</div>
            <div class="sig-name">${escapeHtml(directorName)}</div>
          </div>
          <div class="signature-col">
            <div class="sig-title">GIÁO VIÊN PHỤ TRÁCH CHUYÊN MÔN</div>
            <div class="sig-space"></div>
            <div class="sig-name">${escapeHtml(teacherName)}</div>
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
 * DỰNG TRANG 2: TRANG PHỤ BẢN ĐỐI SOÁT BÀI THI GIẤY OMR (TỰ ĐỘNG CHÈN NGAY SAU BÁO CÁO CỦA HỌC SINH)
 */
function renderStudentOMRAppendixPageHTML(
  config: DailyReportConfig,
  student: StudentDailyScoreData,
  studentOrder: number,
  totalStudents: number,
  isLastPageOfWholeDoc: boolean
): string {
  const wrongList: WrongQuestionReviewItem[] = Array.isArray(student.wrongQuestionsList)
    ? student.wrongQuestionsList
    : [];

  const totalQ = student.dailyTestTotal || 0;
  const correctQ = student.dailyTestCorrect ?? Math.max(0, totalQ - wrongList.length);
  const wrongCount = wrongList.length;

  const wrongRowsHtml =
    wrongList.length === 0
      ? `
        <tr>
          <td colspan="4" style="text-align:center; padding:18px; color:#059669; font-weight:bold;">
            🎉 Xuất sắc! Con không làm sai câu nào trên phiếu trả lời trắc nghiệm của bài kiểm tra này.
          </td>
        </tr>
      `
      : wrongList
          .slice(0, 18)
          .map(
            (w) => `
            <tr>
              <td style="text-align:center; font-weight:bold; color:#DC2626;">Câu ${
                w.questionNumber
              }</td>
              <td style="text-align:center; font-weight:bold;">${escapeHtml(w.part)}</td>
              <td style="text-align:center; font-family:monospace; font-weight:bold; color:#DC2626; background:#FEF2F2;">
                ${escapeHtml(w.studentAnswer || "Bỏ trống")}
              </td>
              <td style="text-align:center; font-family:monospace; font-weight:bold; color:#059669; background:#ECFDF5;">
                ${escapeHtml(w.correctAnswer)}
              </td>
            </tr>
          `
          )
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

        <!-- BỐ CỤC 2 CỘT A4: TRÁI LÀ ẢNH PHIẾU ĐÃ KHOANH MÀU - PHẢI LÀ BẢNG ĐỐI CHIẾU CÂU SAI -->
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

          <!-- CỘT PHẢI: THỐNG KÊ & BẢNG ĐỐI CHIẾU CÁC CÂU SAI -->
          <div class="omr-right-table-col">
            <div class="omr-col-title">BẢNG ĐỐI CHIẾU ĐÁP ÁN & CÂU BỊ TRỪ ĐIỂM</div>

            <div class="omr-quick-stats">
              <div class="omr-stat-pill stat-blue">
                <span>Điểm bài thi</span>
                <strong>${formatScoreBadge(student.dailyTestScore)}</strong>
              </div>
              <div class="omr-stat-pill stat-green">
                <span>Số câu đúng</span>
                <strong>${correctQ}/${totalQ || "--"} câu</strong>
              </div>
              <div class="omr-stat-pill stat-red">
                <span>Câu sai / trống</span>
                <strong>${wrongCount} câu</strong>
              </div>
            </div>

            <table class="omr-wrong-table">
              <thead>
                <tr>
                  <th style="width:64px; text-align:center;">Câu</th>
                  <th style="width:74px; text-align:center;">Phần</th>
                  <th style="text-align:center;">Con tô / chọn</th>
                  <th style="text-align:center;">Đáp án chuẩn TCT</th>
                </tr>
              </thead>
              <tbody>
                ${wrongRowsHtml}
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
 * HÀM CHÍNH: SINH TOÀN BỘ TÀI LIỆU MULTI-PAGE HTML A4 GỘP CẢ LỚP (CHỐNG TRÀN RAM 100%)
 */
export function generateClassDailyReportHTML(
  reportConfig: DailyReportConfig,
  studentsData: StudentDailyScoreData[]
): string {
  const safeStudents = Array.isArray(studentsData) ? studentsData : [];
  const totalStudents = safeStudents.length;

  let allPagesMarkup = "";

  // 1. Chèn trang bìa tổng hợp điểm cả lớp nếu được bật
  if (reportConfig.includeCoverSummaryPage && totalStudents > 1) {
    allPagesMarkup += renderClassSummaryCoverPageHTML(reportConfig, safeStudents);
  }

  // 2. Duyệt từng học sinh: Trang 1 (Báo cáo ngày) + Trang 2 (Phụ bản OMR nếu học sinh chấm giấy)
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
          font-family: Arial, sans-serif;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35);
        }
        .toolbar-info {
          font-size: 13px;
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
          padding: 9px 20px;
          border-radius: 10px;
          font-weight: bold;
          font-size: 13px;
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
          justify-content: space-between;
        }
        .tct-brand-header {
          width: 100%;
          margin-bottom: 4px;
        }
        .tct-header-svg {
          width: 100%;
          height: auto;
          display: block;
        }
        .tct-brand-footer {
          width: 100%;
          margin-top: auto;
          padding-top: 4px;
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
          padding: 7px 12px;
          margin-bottom: 8px;
        }
        .omr-banner-accent {
          background: #EFF6FF;
        }
        .report-title-banner h1 {
          margin: 0;
          font-size: 20px;
          font-weight: bold;
          color: #003399;
          letter-spacing: 0.5px;
        }
        .report-subtitle {
          margin-top: 3px;
          font-size: 13px;
          color: #1E293B;
        }
        .section-box {
          border: 1.2px solid #CBD5E1;
          border-radius: 6px;
          padding: 8px 12px;
          margin-bottom: 8px;
          background: #FFFFFF;
        }
        .topic-highlight-box {
          background: #FFFBEB;
          border-color: #F58220;
        }
        .section-header {
          font-family: Arial, sans-serif;
          font-size: 11px;
          font-weight: 900;
          color: #003399;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          border-bottom: 1px solid #E2E8F0;
          padding-bottom: 4px;
          margin-bottom: 7px;
        }
        .student-info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px 16px;
          font-size: 13.5px;
        }
        .info-label {
          color: #475569;
        }
        .info-value-primary {
          color: #003399;
          font-size: 15px;
          text-transform: uppercase;
        }
        .sbd-badge {
          font-family: monospace;
          font-size: 14.5px;
          background: #EFF6FF;
          color: #1D4ED8;
          padding: 1px 8px;
          border-radius: 4px;
          border: 1px solid #BFDBFE;
        }
        .topic-title-main {
          font-size: 15px;
          font-weight: bold;
          color: #0F172A;
        }
        .topic-subnote {
          font-size: 12px;
          color: #475569;
          margin-top: 3px;
          font-style: italic;
        }
        .scores-three-cols {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .score-card {
          border-radius: 6px;
          padding: 8px 10px;
          text-align: center;
          border: 1.5px solid #CBD5E1;
        }
        .score-card-green {
          background: #ECFDF5;
          border-color: #10B981;
        }
        .score-card-blue {
          background: #EFF6FF;
          border-color: #2563EB;
        }
        .score-card-orange {
          background: #FFF7ED;
          border-color: #F58220;
        }
        .score-card-title {
          font-family: Arial, sans-serif;
          font-size: 10.5px;
          font-weight: 900;
          color: #1E293B;
        }
        .score-card-value {
          font-size: 22px;
          font-weight: bold;
          color: #003399;
          margin: 4px 0;
        }
        .score-card-sub {
          font-size: 11.5px;
          color: #334155;
        }
        .parts-breakdown-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
        }
        .parts-breakdown-table th,
        .parts-breakdown-table td {
          border: 1px solid #CBD5E1;
          padding: 5px 8px;
        }
        .parts-breakdown-table th {
          background: #F1F5F9;
          font-family: Arial, sans-serif;
          font-size: 10.5px;
          text-transform: uppercase;
          color: #334155;
        }
        .teacher-comment-box {
          background: #F8FAFC;
          border-left: 3.5px solid #003399;
          padding: 8px 10px;
          font-size: 13.5px;
          font-style: italic;
          line-height: 1.45;
          min-height: 54px;
        }
        .attendance-check-row {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin-top: 8px;
          font-size: 12.5px;
          padding-top: 6px;
          border-top: 1px dashed #CBD5E1;
        }
        .attendance-check-row span {
          margin-left: 12px;
        }
        .signature-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          text-align: center;
          margin-top: 4px;
          margin-bottom: 4px;
        }
        .sig-title {
          font-family: Arial, sans-serif;
          font-size: 11px;
          font-weight: bold;
          color: #003399;
        }
        .sig-stamp {
          margin: 12px auto;
          padding: 5px 10px;
          border: 1.5px dashed #DC2626;
          color: #DC2626;
          font-family: Arial, sans-serif;
          font-size: 10px;
          font-weight: bold;
          width: fit-content;
          border-radius: 4px;
        }
        .sig-space {
          height: 36px;
        }
        .sig-name {
          font-size: 13.5px;
          font-weight: bold;
          color: #0F172A;
        }
        /* TRANG 2: PHỤ BẢN OMR */
        .omr-appendix-two-cols {
          display: grid;
          grid-template-columns: 54% 44%;
          gap: 2%;
          flex: 1;
          min-height: 0;
          margin-bottom: 6px;
        }
        .omr-left-image-col,
        .omr-right-table-col {
          border: 1.2px solid #CBD5E1;
          border-radius: 6px;
          padding: 8px;
          display: flex;
          flex-direction: column;
        }
        .omr-col-title {
          font-family: Arial, sans-serif;
          font-size: 10.5px;
          font-weight: 900;
          color: #003399;
          text-align: center;
          border-bottom: 1px solid #E2E8F0;
          padding-bottom: 4px;
          margin-bottom: 6px;
        }
        .omr-sheet-frame {
          position: relative;
          width: 100%;
          aspect-ratio: 1200 / 1700;
          max-height: 212mm;
          margin: 0 auto;
          border: 1px solid #94A3B8;
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
          margin-bottom: 8px;
        }
        .omr-stat-pill {
          padding: 5px;
          border-radius: 5px;
          text-align: center;
          font-family: Arial, sans-serif;
          font-size: 10px;
        }
        .omr-stat-pill span {
          display: block;
          color: #475569;
        }
        .omr-stat-pill strong {
          font-size: 12.5px;
        }
        .stat-blue {
          background: #EFF6FF;
          color: #1D4ED8;
          border: 1px solid #BFDBFE;
        }
        .stat-green {
          background: #ECFDF5;
          color: #059669;
          border: 1px solid #A7F3D0;
        }
        .stat-red {
          background: #FEF2F2;
          color: #DC2626;
          border: 1px solid #FECACA;
        }
        .omr-wrong-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11.5px;
          margin-bottom: 8px;
        }
        .omr-wrong-table th,
        .omr-wrong-table td {
          border: 1px solid #CBD5E1;
          padding: 4px 6px;
        }
        .omr-wrong-table th {
          background: #F1F5F9;
          font-family: Arial, sans-serif;
          font-size: 9.5px;
          text-transform: uppercase;
        }
        .omr-legend-box {
          margin-top: auto;
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 5px;
          padding: 7px 9px;
          font-size: 11px;
        }
        .legend-title {
          font-family: Arial, sans-serif;
          font-size: 9.5px;
          font-weight: bold;
          color: #003399;
          margin-bottom: 4px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 3px;
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
        /* BẢNG TRANG BÌA TỔNG HỢP */
        .summary-cover-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
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
          font-family: Arial, sans-serif;
          font-size: 10.5px;
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
          )} (${totalStudents} học sinh • Tự động kèm phụ bản phiếu OMR)
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
