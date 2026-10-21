export type LearningMode = "online" | "offline";
export type StudyMode = "online" | "offline";
export type TargetMode = "online" | "offline" | "all";
export type TargetAudience = "online" | "offline" | "all";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type SubmissionType = "web" | "paper";

export type OMRBubbleStatus =
  | "correct"
  | "wrong"
  | "expected_missed"
  | "unfilled"
  | "ambiguous"
  | "detected";

export interface OMRBubbleCoordinate {
  id: string;
  section: "sbd" | "exam_code" | "part1" | "part2" | "part3";
  questionNumber?: number;
  subKey?: string;
  optionKey: string;
  x: number;
  y: number;
  r: number;
  density: number;
  isSelected: boolean;
  status: OMRBubbleStatus;
}

export interface OMRCornerPoint {
  x: number;
  y: number;
}

export interface OMRResultData {
  detected_sbd: string;
  detected_exam_code: string;
  confidence: number;
  warp_matrix_applied: boolean;
  canonical_width: number;
  canonical_height: number;
  warped_image_data_url?: string;
  corner_points?: {
    topLeft: OMRCornerPoint;
    topRight: OMRCornerPoint;
    bottomRight: OMRCornerPoint;
    bottomLeft: OMRCornerPoint;
  };
  part1_answers: Record<number, string>;
  part2_answers: Record<number, Record<"a" | "b" | "c" | "d", boolean | null>>;
  part3_answers: Record<number, string>;
  flagged_questions: number[];
  bubble_coordinates: OMRBubbleCoordinate[];
}

export interface OMRQuestionGradeDetail {
  questionOrder: number;
  part: 1 | 2 | 3;
  questionId: string;
  type: QuestionType;
  studentAnswerDisplay: string;
  correctAnswerDisplay: string;
  status: "correct" | "wrong" | "partial" | "skipped";
  pointsEarned: number;
  maxPoints: number;
  isFlagged?: boolean;
}

export interface OMRGradingSummary {
  score: number;
  rawPointsEarned: number;
  maxPossiblePoints: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  part1Score: number;
  part2Score: number;
  part3Score: number;
  normalizedAnswers: Record<string, any>;
  questionDetails: OMRQuestionGradeDetail[];
  updatedOmrData: OMRResultData;
}

export interface ExamAttempt {
  id: string;
  quiz_id?: string;
  quizId?: string;
  exam_id?: string;
  quiz_title?: string;
  quizTitle?: string;
  exam_title?: string;
  examTitle?: string;
  student_id?: string;
  studentId?: string;
  user_id?: string;
  student_name?: string;
  studentName?: string;
  full_name?: string;
  user_name?: string;
  username?: string;
  school?: string;
  score: number;
  points?: number;
  total_questions?: number;
  totalQuestions?: number;
  correct_count?: number;
  correctCount?: number;
  time_spent?: string;
  timeSpent?: string;
  duration_seconds?: number;
  durationSeconds?: number;
  is_homework?: boolean;
  isHomework?: boolean;
  type?: "homework" | "test" | "practice";
  answers?: Record<string, any>;
  userAnswers?: Record<string, any>;
  user_answers?: Record<string, any>;
  submission_type?: SubmissionType;
  paper_scan_url?: string | null;
  omr_raw_data?: OMRResultData | null;
  recognition_confidence?: number;
  flagged_questions?: number[];
  feedback?: string;
  assigned_month?: number;
  assigned_week?: number;
  created_at?: string;
  createdAt?: string;
  submittedAt?: string;
  [key: string]: any;
}

export type QuizResult = ExamAttempt;

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  school?: string;
  grade?: string;
  learning_mode?: LearningMode;
  study_mode?: StudyMode;
  approval_status?: ApprovalStatus;
  role?: "student" | "admin" | "teacher";
  created_at?: string;
  username?: string;
  student_code?: string;
  [key: string]: any;
}

export interface StandardShift {
  id: string;
  name: string;
  timeSlot: string;
}

export const STANDARD_SHIFTS: StandardShift[] = [
  { id: "ca-1", name: "Ca 1", timeSlot: "08:00 - 09:30" },
  { id: "ca-2", name: "Ca 2", timeSlot: "09:30 - 11:00" },
  { id: "ca-3", name: "Ca 3", timeSlot: "14:30 - 16:00" },
  { id: "ca-4", name: "Ca 4", timeSlot: "16:00 - 17:30" },
  { id: "ca-5", name: "Ca 5", timeSlot: "18:00 - 19:30" },
  { id: "ca-6", name: "Ca 6", timeSlot: "19:30 - 21:00" },
  { id: "ca-7", name: "Ca 7", timeSlot: "21:00 - 23:00" },
];

export interface OnlineSession {
  id: string;
  title: string;
  subject?: string;
  date: string; // e.g. "24/09"
  isoDate?: string; // e.g. "2026-09-24"
  dayOfWeek?: string; // e.g. "Thứ 5"
  shiftId?: string; // e.g. "ca-6"
  shiftName?: string; // e.g. "Ca 6"
  timeSlot: string; // e.g. "19:30 - 21:00"
  meetingUrl?: string;
  guideImages?: string[];
  createdAt?: string;
  room?: string; // e.g. "P.201 TCT"
  teacherName?: string; // e.g. "Thầy Nam"
  target_mode?: TargetMode; // "online" | "offline" | "all"
  audience?: TargetAudience; // "online" | "offline" | "all"
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  sessionDate: string;
  status: "present" | "absent" | "auto_present" | "exempt";
  mode?: "online_auto" | "offline_self" | "manual";
  attendedAt?: string;
  note?: string;
}

export type QuestionType = "multiple_choice" | "true_false" | "short_answer";

export interface QuestionOption {
  key: string;
  text_html: string;
  is_true_false_ans?: boolean | null;
}

export interface ParsedQuestion {
  id: string;
  order_index: number;
  section_title?: string;
  type: QuestionType;
  original_label: string;
  prompt_html: string;
  options: QuestionOption[];
  correct_answer: string;
  solution_html?: string;
  has_valid_answer?: boolean;
}

export interface ExamSection {
  section_title: string;
  section_type: QuestionType;
  questions: ParsedQuestion[];
}

export interface ExamSettings {
  title: string;
  duration_minutes: number;
  category?: string;
  driveUrl?: string;
  solutionVideoUrl?: string;
  allowViewFile?: boolean;
  allowPaperScan?: boolean;
}

export interface Lesson {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  format?: string;
  target_mode?: TargetMode;
  assigned_month?: number;
  assigned_week?: number;
  lecture_files?: any[];
  homework_files?: any[];
  handwritten_notes?: any[];
  video_list?: any[];
  test_quizzes?: any[];
  extra_resources?: any[];
}

export interface Chapter {
  id: string;
  title: string;
  target_mode?: TargetMode;
  assigned_month?: number;
  assigned_week?: number;
  lessons: Lesson[];
}

export interface QuizItem {
  id: string;
  title: string;
  [key: string]: any;
}

export type QuizSubCategory = string;
