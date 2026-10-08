export type AdminTab = 
  | "lessons" 
  | "analytics" 
  | "practice" 
  | "notifications" 
  | "students" 
  | "online_schedule" 
  | "reports";

export const EXAM_CATEGORIES: string[] = [
  "ĐGNL HSA (ĐHQGHN)",
  "ĐGTD TSA (ĐHBK)",
  "Tốt Nghiệp THPT",
  "Giữa Kì 1",
  "Học Kì 1",
  "Giữa Kì 2",
  "Học Kì 2",
  "Luyện đề"
];

export const INITIAL_CHAPTERS = [
  { 
    id: "chap-1", 
    title: "Chương 1: Ứng dụng đạo hàm để khảo sát hàm số", 
    lessons: [
      { 
        id: "les-1", 
        title: "Bài 1: Tính đơn điệu của hàm số", 
        description: "", 
        duration: 45, 
        format: "Zoom", 
        target_mode: "all",
        lecture_files: [], 
        homework_files: [], 
        handwritten_notes: [], 
        video_list: [], 
        test_quizzes: [], 
        extra_resources: [] 
      }
    ] 
  }
];
