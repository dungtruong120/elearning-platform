"use client";

import React, { useState } from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { Lesson } from "@/types";

interface QuizModalProps {
  isOpen: boolean;
  lesson: Lesson | null;
  onClose: () => void;
  onSuccess: (id: string) => void;
}

export const QuizModal: React.FC<QuizModalProps> = ({ isOpen, lesson, onClose, onSuccess }) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [resultStatus, setResultStatus] = useState<"idle" | "correct" | "wrong">("idle");

  if (!isOpen || !lesson || !lesson.quiz) return null;

  const handleCheck = () => {
    if (selectedIdx === null) return;
    if (selectedIdx === lesson.quiz?.correct_answer) {
      setResultStatus("correct");
      onSuccess(lesson.id);
    } else {
      setResultStatus("wrong");
    }
  };

  const resetAndClose = () => {
    setSelectedIdx(null);
    setResultStatus("idle");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold text-purple-600 uppercase">Trắc nghiệm nhanh</span>
            <h3 className="font-bold text-slate-900 text-base mt-0.5">{lesson.title}</h3>
          </div>
          <button onClick={resetAndClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="py-6">
          <p className="text-sm font-semibold text-slate-800 mb-4">{lesson.quiz.question}</p>
          <div className="space-y-2.5">
            {lesson.quiz.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setSelectedIdx(idx);
                  setResultStatus("idle");
                }}
                className={`w-full text-left p-3.5 rounded-xl border text-sm font-medium transition-all ${
                  selectedIdx === idx
                    ? "border-purple-600 bg-purple-50 text-purple-900"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {resultStatus === "correct" && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-800">
              <Check className="h-4 w-4 text-emerald-600" />
              Chính xác! Bài học đã được tự động đánh dấu hoàn thành.
            </div>
          )}

          {resultStatus === "wrong" && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-rose-800">
              <AlertCircle className="h-4 w-4 text-rose-600" />
              Chưa chính xác! Bạn vui lòng xem lại video và thử lại.
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button onClick={resetAndClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl">
            Đóng
          </button>
          <button
            onClick={handleCheck}
            disabled={selectedIdx === null}
            className="px-5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-50 transition"
          >
            Kiểm tra
          </button>
        </div>
      </div>
    </div>
  );
};