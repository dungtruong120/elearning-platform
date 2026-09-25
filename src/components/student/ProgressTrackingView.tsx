"use client";
import React, { useMemo } from "react";
import { CheckCircle2, CircleDashed, Play, BookOpen, Layers, Award } from "lucide-react";

interface ProgressTrackingViewProps {
  chapters: any[];
  pastAttempts: any[];
  onStartExam: (quizId: string, quizTitle: string, isHomework: boolean, durationMinutes?: number) => void;
}

export const ProgressTrackingView: React.FC<ProgressTrackingViewProps> = ({ chapters = [], pastAttempts = [], onStartExam }) => {

  // TÍNH TOÁN TIẾN ĐỘ TỔNG QUAN (SAFE-CHECKED)
  const stats = useMemo(() => {
    let totalHW = 0; let doneHW = 0;
    let totalTest = 0; let doneTest = 0;

    const safeChapters = chapters || [];
    safeChapters.forEach(chap => {
      const safeLessons = chap?.lessons || [];
      safeLessons.forEach((les: any) => {
        const hwQuizzes = les.homework_files?.filter((f: any) => f.is_quiz) || [];
        const testQuizzes = les.test_quizzes || [];

        hwQuizzes.forEach((hw: any) => {
          totalHW++;
          if (pastAttempts.some(a => a.quizId === hw.id)) doneHW++;
        });

        testQuizzes.forEach((test: any) => {
          totalTest++;
          if (pastAttempts.some(a => a.quizId === test.id)) doneTest++;
        });
      });
    });

    const totalTasks = totalHW + totalTest;
    const completedTasks = doneHW + doneTest;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return { totalHW, doneHW, totalTest, doneTest, progressPercent };
  }, [chapters, pastAttempts]);

  const getQuizResult = (quizId: string) => {
    const attempts = (pastAttempts || []).filter(a => a.quizId === quizId);
    if (attempts.length === 0) return null;
    const maxScore = Math.max(...attempts.map(a => Number(a.score) || 0));
    return { maxScore, count: attempts.length };
  };

  const safeChapters = chapters || [];

  if (safeChapters.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center bg-white/80 backdrop-blur-2xl rounded-3xl border border-slate-200/80 shadow-sm">
        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-700">Đang tải dữ liệu tiến trình bài học...</h3>
        <p className="text-xs text-slate-400 mt-1">Hệ thống đang đồng bộ nội dung chương trình học của bạn.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 font-sans">
      
      {/* KHỐI THỐNG KÊ TỔNG QUAN (TCT THEME) */}
      <div className="bg-white/80 backdrop-blur-2xl rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center gap-6 md:gap-8">
        <div className="w-24 h-24 shrink-0 rounded-full border-[6px] border-blue-50 text-[#1D4ED8] flex items-center justify-center font-black text-2xl relative shadow-inner bg-white">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path className="text-blue-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
            <path className="text-[#1D4ED8] drop-shadow-sm transition-all duration-1000 ease-out" strokeDasharray={`${stats.progressPercent}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
          </svg>
          {stats.progressPercent}%
        </div>
        <div className="flex-1 space-y-3 w-full">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Tiến độ nhiệm vụ học tập</h2>
            <p className="text-sm text-slate-500 font-medium">Bạn đã hoàn thành {stats.doneHW + stats.doneTest} trên tổng số {stats.totalHW + stats.totalTest} nhiệm vụ.</p>
          </div>
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-100">
            <div>
              <span className="text-[11px] font-bold text-[#1D4ED8] uppercase tracking-wider block mb-1">BÀI TẬP VỀ NHÀ</span>
              <span className="text-sm font-bold text-slate-800">{stats.doneHW} / {stats.totalHW} đã nộp</span>
            </div>
            <div>
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">BÀI KIỂM TRA</span>
              <span className="text-sm font-bold text-slate-800">{stats.doneTest} / {stats.totalTest} hoàn thành</span>
            </div>
          </div>
        </div>
      </div>

      {/* DANH SÁCH CHI TIẾT TỪNG CHƯƠNG & BÀI HỌC */}
      <div className="space-y-6">
        {safeChapters.map((chap) => {
          const safeLessons = chap?.lessons || [];
          if (safeLessons.length === 0) return null;
          
          return (
            <div key={chap.id} className="bg-white/80 backdrop-blur-2xl rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-100 flex items-center gap-3">
                <Layers className="w-5 h-5 text-[#1D4ED8]" />
                <h3 className="font-extrabold text-slate-900 text-[14px] uppercase tracking-wide">{chap.title}</h3>
              </div>
              
              <div className="divide-y divide-slate-100/80">
                {safeLessons.map((les: any) => {
                  const hwQuizzes = les.homework_files?.filter((f: any) => f.is_quiz) || [];
                  const testQuizzes = les.test_quizzes || [];

                  return (
                    <div key={les.id} className="p-6 transition-colors hover:bg-slate-50/40">
                      <div className="flex items-center gap-2.5 mb-4">
                        <BookOpen className="w-4 h-4 text-slate-400" />
                        <h4 className="font-bold text-slate-900 text-[14px]">{les.title}</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* CỘT BTVN */}
                        <div className="space-y-3">
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 block">Nhiệm vụ BTVN</span>
                          {hwQuizzes.length === 0 ? (
                            <p className="text-[13px] text-slate-400 italic">Không có BTVN cho bài này.</p>
                          ) : hwQuizzes.map((hw: any) => {
                            const res = getQuizResult(hw.id);
                            return (
                              <div key={hw.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-100 bg-white shadow-xs">
                                <span className="text-[13px] font-semibold text-slate-700 truncate pr-2" title={hw.title}>{hw.title}</span>
                                {res ? (
                                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-xl text-[11px] font-bold whitespace-nowrap">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã nộp BTVN - {res.maxScore}/10
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-xl text-[11px] font-bold whitespace-nowrap">
                                      <CircleDashed className="w-3.5 h-3.5" /> Chưa nộp
                                    </span>
                                    <button onClick={() => onStartExam(hw.id, hw.title, true, 0)} className="px-4 py-1.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white rounded-xl text-xs font-bold transition-all shadow-sm whitespace-nowrap">
                                      Làm BTVN
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* CỘT BÀI KIỂM TRA */}
                        <div className="space-y-3">
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 block">Bài Kiểm Tra Định Kỳ</span>
                          {testQuizzes.length === 0 ? (
                            <p className="text-[13px] text-slate-400 italic">Không có bài kiểm tra.</p>
                          ) : testQuizzes.map((test: any) => {
                            const res = getQuizResult(test.id);
                            return (
                              <div key={test.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-100 bg-white shadow-xs">
                                <span className="text-[13px] font-semibold text-slate-700 truncate pr-2" title={test.title}>{test.title}</span>
                                {res ? (
                                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 text-[#1D4ED8] border border-blue-200/80 rounded-xl text-[11px] font-bold whitespace-nowrap">
                                    <Award className="w-3.5 h-3.5" /> Đã làm - {res.maxScore}/10 ({res.count} lần)
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-xl text-[11px] font-bold whitespace-nowrap">
                                      <CircleDashed className="w-3.5 h-3.5" /> Chưa làm
                                    </span>
                                    <button onClick={() => onStartExam(test.id, test.title, false, test.duration_minutes)} className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap">
                                      <Play className="w-3.5 h-3.5 fill-white" /> Vào làm
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};