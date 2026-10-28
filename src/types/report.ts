import { OMRBubbleCoordinate } from "@/types";

export interface WrongQuestionReviewItem {
  questionNumber: number;
  part: string; // "Phần I" | "Phần II" | "Phần III"
  studentAnswer: string;
  correctAnswer: string;
  reasonNote?: string;
}

export interface DailyReportConfig {
  reportMode: "daily" | "monthly";
  selectedMonth: number;
  selectedWeek: number; // 1 | 2 | 3 | 4
  customDateStr: string; // VD: "28/10/2026"
  topicTitle: string; // Tên bài học tự động lấy từ #lessons
  overrideTopicTitle?: string;
  targetPracticeExamId?: string; // Đề luyện thi thực chiến trong tháng
  practiceExamTitle?: string;
  teacherName?: string;
  centerDirectorName?: string;
  includeCoverSummaryPage?: boolean; // Tùy chọn in trang bìa tổng hợp cả lớp ở trang đầu
}

export interface StudentDailyScoreData {
  studentId: string;
  studentName: string;
  sbd: string;
  grade?: string;
  school: string;
  learningMode: "Online" | "Offline";
  // Điểm số 3 cột chính trong ngày
  homeworkScore: number | null;
  homeworkCorrect?: number | null;
  homeworkTotal: number | null;
  dailyTestScore: number | null;
  dailyTestCorrect?: number | null;
  dailyTestTotal: number | null;
  practiceScore: number | null;
  practiceExamTitle?: string;
  // Đánh giá chi tiết Phần I, II, III của Bài kiểm tra tại lớp (nếu có)
  part1Score?: string;
  part2Score?: string;
  part3Score?: string;
  teacherComment: string;
  attendance: "present" | "late" | "absent";
  homeworkStatus: "completed" | "missing" | "late";
  // Dữ liệu phụ bản OMR (tự động kích hoạt Trang 2 nếu học sinh làm bài trên phiếu giấy)
  hasPaperOMR: boolean;
  paperExamTitle?: string;
  paperExamCode?: string;
  scannedPaperImageUrl?: string; // URL ảnh đã nắn phẳng chuẩn 1200x1700
  canonicalWidth?: number;
  canonicalHeight?: number;
  bubbleCoordinates?: OMRBubbleCoordinate[];
  wrongQuestionsList?: WrongQuestionReviewItem[];
}

export interface BatchExportProgress {
  isExporting: boolean;
  currentStudentIndex: number;
  totalStudents: number;
  statusMessage: string;
}
