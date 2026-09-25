"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { QuizItem, QuizSubCategory } from "@/types";
import { 
  Target, 
  Clock, 
  HelpCircle, 
  Play, 
  CheckCircle2 
} from "lucide-react";

interface PracticeCenterViewProps {
  quizzes: QuizItem[];
  onStartExam: (quizId: string, quizTitle: string) => void;
}

const TABS: { key: QuizSubCategory | "ALL"; label: string }[] = [
  { key: "ALL", label: "Tất cả đề" },
  { key: "HSA", label: "ĐGNL HSA (ĐHQGHN)" },
  { key: "TSA", label: "ĐGTD TSA (ĐHBK)" },
  { key: "THPT", label: "Tốt Nghiệp THPT" },
  { key: "GHK1", label: "Giữa Kì 1" },
  { key: "HK1", label: "Học Kì 1" },
  { key: "GHK2", label: "Giữa Kì 2" },
  { key: "HK2", label: "Học Kì 2" },
];

export const PracticeCenterView: React.FC<PracticeCenterViewProps> = ({
  quizzes,
  onStartExam,
}) => {
  const [activeTab, setActiveTab] = useState<QuizSubCategory | "ALL">("ALL");

  const filteredQuizzes = useMemo(() => {
    return quizzes.filter((q) => {
      if (q.category !== "exam_prep") return false;
      if (activeTab === "ALL") return true;
      return q.sub_category === activeTab;
    });
  }, [quizzes, activeTab]);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      
      {/* HEADER TỐI GIẢN */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Hệ thống luyện đề
          </h2>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 font-sans">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span><strong className="text-slate-900">{filteredQuizzes.length}</strong> đề thi khả dụng</span>
        </div>
      </div>

      {/* THANH TABS LỌC ĐỒNG BỘ SLIDING MATTE LIQUID GLASS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none font-sans p-1 bg-slate-100/70 rounded-2xl border border-slate-200/70">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <motion.button
              key={tab.key}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => setActiveTab(tab.key)}
              className={`relative px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                isActive ? "text-indigo-900 font-extrabold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {/* Vệt kính lỏng lì trượt mượt mà (Không bóng lóa) */}
              {isActive && (
                <motion.div
                  layoutId="practiceMattePill"
                  className="absolute inset-0 rounded-xl liquid-glass-matte-light"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* LƯỚI DANH SÁCH ĐỀ THI VỚI NÚT BẤM CHẠM NHÚN */}
      {filteredQuizzes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs text-slate-400">
          <HelpCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">Chưa có đề thi nào trong phân mục này.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredQuizzes.map((quiz) => (
            <motion.div
              key={quiz.id}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5 font-sans">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                    {quiz.sub_category}
                  </span>
                  {quiz.is_completed ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Đã làm: {quiz.user_score}đ
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                      Chưa làm
                    </span>
                  )}
                </div>

                <h4 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2 leading-snug">
                  {quiz.title}
                </h4>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 py-2.5 border-y border-slate-100 my-2.5 font-sans">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{quiz.duration_minutes} Phút</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    <span>{quiz.total_questions} Câu hỏi</span>
                  </div>
                </div>
              </div>

              {/* Nút bấm kính lỏng đàn hồi khi click */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={() => onStartExam(quiz.id, quiz.title)}
                className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition font-sans mt-1 ${
                  quiz.is_completed
                    ? "liquid-btn-secondary text-slate-800 hover:bg-slate-200/80"
                    : "liquid-btn-primary text-white"
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{quiz.is_completed ? "Làm lại đề thi" : "Bắt đầu làm đề"}</span>
              </motion.button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};