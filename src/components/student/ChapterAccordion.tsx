"use client";
import React from "react";
import { BookOpen, Play, CheckCircle2, FileText, Clock, ChevronRight, PenTool, Award, Layers } from "lucide-react";

interface ChapterAccordionProps {
  chapters: any[];
  pastAttempts: any[];
  onOpenLesson: (lesson: any) => void;
  onStartExam: (quizId: string, quizTitle: string, isHomework: boolean, durationMinutes?: number) => void;
}

export const ChapterAccordion: React.FC<ChapterAccordionProps> = ({ chapters = [], pastAttempts = [], onOpenLesson, onStartExam }) => {
  
  const getQuizResult = (quizId: string) => {
    if (!quizId) return null;
    const attempts = (pastAttempts || []).filter(a => a.quizId === quizId);
    if (attempts.length === 0) return null;
    const maxScore = Math.max(...attempts.map(a => Number(a.score) || 0));
    return { maxScore, count: attempts.length };
  };

  const safeChapters = chapters || [];

  if (safeChapters.length === 0) {
    return (
      <div className="py-20 text-center bg-white/90 backdrop-blur-2xl rounded-3xl border border-slate-200/80 shadow-sm max-w-4xl mx-auto">
        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-700">Chưa có chương trình học nào.</h3>
        <p className="text-xs text-slate-400 mt-1">Giáo viên sẽ cập nhật nội dung bài giảng sớm nhất.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-sans">
      {safeChapters.map((chap, idx) => {
        const lessons = chap?.lessons || [];
        
        let totalTasks = 0;
        let completedTasks = 0;
        lessons.forEach((les: any) => {
          const hwList = les.homework_files?.filter((f: any) => f.is_quiz) || [];
          const testList = les.test_quizzes || [];
          totalTasks += hwList.length + testList.length;
          hwList.forEach((hw: any) => { if (pastAttempts.some(a => a.quizId === hw.id)) completedTasks++; });
          testList.forEach((test: any) => { if (pastAttempts.some(a => a.quizId === test.id)) completedTasks++; });
        });
        const chapterProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const chapterNumStr = String(idx + 1).padStart(2, '0');

        return (
          <div key={chap.id || idx} className="bg-white/90 backdrop-blur-2xl rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] space-y-6">
            
            {/* THẺ CHƯƠNG HỌC (CHAPTER CONTAINER) */}
            <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#1D4ED8] text-white flex items-center justify-center font-black text-base shadow-sm">
                  {chapterNumStr}
                </div>
                <div>
                  <span className="text-[10px] font-extrabold text-[#1D4ED8] uppercase tracking-widest block">
                    CHƯƠNG {idx + 1}
                  </span>
                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg tracking-tight">
                    {chap.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <span className="text-[11px] font-bold text-slate-500 block">Tiến độ chương</span>
                  <span className="text-xs font-black text-slate-900">{completedTasks}/{totalTasks} nhiệm vụ</span>
                </div>
                <div className="px-4 py-1.5 bg-blue-50 text-[#1D4ED8] font-black text-xs rounded-xl border border-blue-100">
                  {chapterProgress}%
                </div>
              </div>
            </div>

            {/* THẺ BÀI HỌC CHI TIẾT (LESSON CARD) */}
            <div className="space-y-3.5">
              {lessons.map((les: any, lIdx: number) => {
                const testQuiz = les.test_quizzes?.[0]; 
                const hwQuiz = les.homework_files?.find((f: any) => f.is_quiz); 
                
                const testRes = testQuiz ? getQuizResult(testQuiz.id) : null;
                const hwRes = hwQuiz ? getQuizResult(hwQuiz.id) : null;
                const isLessonDone = (testRes && hwRes) || (testRes && !hwQuiz) || (!testQuiz && hwRes);
                const lessonNumStr = String(lIdx + 1).padStart(2, '0');

                return (
                  <div key={les.id} className="relative p-5 sm:p-6 rounded-2xl border border-slate-200/80 bg-white hover:border-[#1D4ED8]/60 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-5 group overflow-hidden">
                    
                    {/* Số thứ tự bài học chìm mờ tinh tế ở góc phải */}
                    <div className="absolute right-4 bottom-2 text-6xl font-black text-slate-50 select-none pointer-events-none group-hover:text-blue-50/50 transition-colors">
                      {lessonNumStr}
                    </div>

                    {/* CỘT TRÁI & TRUNG TÂM: THÔNG TIN BÀI HỌC */}
                    <div className="space-y-2 flex-1 relative z-10">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isLessonDone ? 'bg-emerald-500 shadow-xs' : 'bg-amber-400'}`} />
                        <h4 className="font-bold text-slate-900 text-base group-hover:text-[#1D4ED8] transition-colors">
                          {les.title}
                        </h4>
                      </div>
                      
                      <p className="text-xs text-slate-500 font-medium line-clamp-1 pl-5">
                        {les.description || "Video bài học chuyên sâu, tài liệu lý thuyết và hệ thống bài tập tự luyện."}
                      </p>

                      {/* Hàng ngang thông số chi tiết */}
                      <div className="flex flex-wrap items-center gap-4 pl-5 pt-1 text-xs font-semibold text-slate-500">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400"/> 45 phút</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5 text-slate-400"/> {(les.lecture_files?.length || 0) + (les.homework_files?.length || 0)} tài liệu</span>
                      </div>

                      {/* Nhãn trạng thái bài tập */}
                      <div className="flex flex-wrap items-center gap-2 pl-5 pt-2">
                        {hwQuiz && (
                          hwRes ? (
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5"/> BTVN: {hwRes.maxScore}/10đ
                            </span>
                          ) : (
                            <button 
                              onClick={() => onStartExam(hwQuiz.id, hwQuiz.title, true, 0)} 
                              className="px-3.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <PenTool className="w-3.5 h-3.5"/> Làm BTVN
                            </button>
                          )
                        )}

                        {testQuiz && (
                          testRes ? (
                            <span className="px-3 py-1 bg-blue-50 text-[#1D4ED8] border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1">
                              <Award className="w-3.5 h-3.5"/> Test: {testRes.maxScore}/10đ
                            </span>
                          ) : (
                            <button 
                              onClick={() => onStartExam(testQuiz.id, testQuiz.title, false, testQuiz.duration_minutes || 45)} 
                              className="px-3.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-white"/> Làm Test
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* CỘT PHẢI: NÚT BẤM HÀNH ĐỘNG CHUYÊN NGHIỆP */}
                    <div className="shrink-0 relative z-10 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 flex items-center justify-end">
                      <button 
                        onClick={() => onOpenLesson(les)} 
                        className="w-full md:w-auto px-6 py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-2xl text-xs font-bold transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Vào học ngay</span>
                        <ChevronRight className="w-4 h-4"/>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>

          </div>
        );
      })}
    </div>
  );
};