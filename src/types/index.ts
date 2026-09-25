export type LearningMode = "online" | "offline";
export type StudyMode = "online" | "offline";
export type TargetMode = "online" | "offline" | "all";
export type TargetAudience = "online" | "offline" | "all";
export type ApprovalStatus = "pending" | "approved" | "rejected";

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
}

export interface Lesson {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  format?: string;
  target_mode?: TargetMode;
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
  lessons: Lesson[];
}


