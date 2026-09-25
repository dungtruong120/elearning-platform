"use client";
import React from "react";
import { Play, HelpCircle, ArrowRight, CheckCircle } from "lucide-react";

export const LessonCard: React.FC<any> = ({ lesson, onOpenWorkspace, onStartQuiz }) => {
  const isSubmitted = Boolean(lesson.is_submitted);
  const testQuizzes = lesson.test_quizzes || [];
  const hasTest = testQuizzes.length > 0;

  return (
    <div onClick={() => onOpenWorkspace(lesson)} className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer group font-sans ${isSubmitted ? "border-emerald-200 bg-emerald-50/40 hover:border-emerald-300" : "bg-white border-slate-200 hover:border-blue-400/80 shadow-xs hover:shadow-sm"}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className={`mt-0.5 h-6 w-6 rounded-full flex items-center justify-center border transition-colors shrink-0 ${isSubmitted ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-slate-300 group-hover:border-blue-500"}`}>
            <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug tracking-tight">{lesson.title}</h4>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2.5 lg:pt-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onOpenWorkspace(lesson)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
            <Play className="h-3.5 w-3.5 text-blue-600" /> Vào bài học
          </button>
          
          {hasTest && (
            <button 
              onClick={() => onStartQuiz(testQuizzes[0].id, testQuizzes[0].title, false, testQuizzes[0].duration_minutes)} 
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition"
            >
              <HelpCircle className="h-3.5 w-3.5" /> Làm bài test <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};