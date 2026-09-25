"use client";

import React from "react";
import { motion } from "framer-motion";
import { QuizItem } from "@/types";
import { 
  FileQuestion, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  Play,
  HelpCircle
} from "lucide-react";

interface AssessmentListViewProps {
  quizzes: QuizItem[];
  onStartExam: (quizId: string, quizTitle: string) => void;
}

export const AssessmentListView: React.FC<AssessmentListViewProps> = ({
  quizzes,
  onStartExam,
}) => {
  const assessmentQuizzes = quizzes.filter((q) => q.category === "assessment");

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-200 inline-block mb-1.5 font-sans">
            Đánh giá bắt buộc
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Bài Kiểm Tra Đánh Giá Định Kỳ
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Các bài kiểm tra 15 phút, 1 tiết hoặc khảo sát năng lực định kỳ theo tiến độ học tập.
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-500 bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 font-sans">
          Tổng số: <strong className="text-slate-900">{assessmentQuizzes.length}</strong> bài kiểm tra
        </div>
      </div>

      {assessmentQuizzes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs text-slate-400">
          <HelpCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">Hiện tại không có bài kiểm tra định kỳ nào đang mở.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assessmentQuizzes.map((quiz) => {
            const isDone = Boolean(quiz.is_completed);

            return (
              <div
                key={quiz.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isDone ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200"
                  }`}>
                    <FileQuestion className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1 font-sans">
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-900 text-white">
                        Chính thức
                      </span>
                      {isDone ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          ✓ Đã nộp: {quiz.user_score} / 10đ
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Chưa nộp
                        </span>
                      )}
                    </div>

                    <h4 className="text-base font-bold text-slate-900 leading-snug">
                      {quiz.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1 font-sans">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{quiz.duration_minutes} Phút</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Hạn: {quiz.deadline ? new Date(quiz.deadline).toLocaleDateString("vi-VN") : "Không giới hạn"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-auto font-sans">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onStartExam(quiz.id, quiz.title)}
                    className={`w-full md:w-auto px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition ${
                      isDone
                        ? "liquid-btn-secondary text-slate-800"
                        : "liquid-btn-primary text-white"
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isDone ? "Xem lại bài thi" : "Vào kiểm tra ngay"}</span>
                  </motion.button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};