"use client";

import React, { useState, useEffect } from "react";
import { X, CheckCircle2, AlertCircle, Award, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export interface QuizResultDetail {
  question_id: string;
  question_text: string;
  options: string[];
  user_answer: string;
  correct_option: string;
  is_correct: boolean;
  explanation?: string;
}

export interface QuizResultResponse {
  score: number;
  correct_count: number;
  total_questions: number;
  details: QuizResultDetail[];
}

interface QuestionItem {
  id: string;
  quiz_id: string;
  question_text: string;
  options: string[];
  order_index: number;
}

interface QuizTakingModalProps {
  isOpen: boolean;
  quizId: string;
  quizTitle: string;
  studentId: string;
  onClose: () => void;
  onFinished: (score: number) => void;
}

export const QuizTakingModal: React.FC<QuizTakingModalProps> = ({
  isOpen,
  quizId,
  quizTitle,
  studentId,
  onClose,
  onFinished,
}) => {
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResultResponse | null>(null);

  useEffect(() => {
    if (!isOpen || !quizId) return;

    async function loadQuestions() {
      setLoading(true);
      setResult(null);
      setAnswers({});

      const { data, error } = await supabase
        .from("student_quiz_questions_view")
        .select("*")
        .eq("quiz_id", quizId)
        .order("order_index", { ascending: true });

      if (!error && data) {
        setQuestions(data as QuestionItem[]);
      }
      setLoading(false);
    }

    loadQuestions();
  }, [isOpen, quizId]);

  if (!isOpen) return null;

  const handleSelectOption = (questionId: string, optionChar: string) => {
    if (result) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionChar }));
  };

  const handleSubmitQuiz = async () => {
    const unAnswered = questions.filter((q) => !answers[q.id]);
    if (unAnswered.length > 0) {
      if (!confirm("Bạn còn câu hỏi chưa chọn. Bạn có chắc muốn nộp bài?")) {
        return;
      }
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/student/submit-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_id: quizId,
          student_id: studentId,
          answers,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi chấm bài");

      setResult(data);
      onFinished(data.score);
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-2xl flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Bài thi trắc nghiệm</span>
            <h3 className="font-bold text-slate-900 text-base mt-0.5">{quizTitle}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm">Đang tải đề thi...</p>
            </div>
          ) : result ? (
            <div className="space-y-6">
              <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl text-center shadow-lg">
                <Award className="h-12 w-12 mx-auto mb-2 text-amber-300" />
                <h4 className="text-2xl font-black">Điểm Số: {result.score} / 10</h4>
                <p className="text-xs text-blue-100 mt-1">
                  Đúng {result.correct_count} trên tổng số {result.total_questions} câu hỏi.
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 text-sm">Chi tiết đáp án & Lời giải:</h4>
                {result.details.map((item, idx) => (
                  <div
                    key={item.question_id}
                    className={`p-4 rounded-xl border ${
                      item.is_correct ? "border-emerald-200 bg-emerald-50/20" : "border-rose-200 bg-rose-50/20"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2 font-bold text-sm">
                      {item.is_correct ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                      )}
                      <span className="text-slate-900">Câu {idx + 1}: {item.question_text}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mb-3">
                      {item.options.map((opt, oIdx) => {
                        const optChar = String.fromCharCode(65 + oIdx);
                        const isChosen = item.user_answer === optChar;
                        const isCorrectOpt = item.correct_option === optChar;

                        let optClass = "border-slate-200 bg-white text-slate-700";
                        if (isCorrectOpt) optClass = "border-emerald-500 bg-emerald-50 text-emerald-800 font-bold";
                        if (isChosen && !isCorrectOpt) optClass = "border-rose-500 bg-rose-50 text-rose-800 font-bold";

                        return (
                          <div key={oIdx} className={`p-2.5 rounded-lg border ${optClass}`}>
                            {opt}
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-3 bg-slate-100 rounded-lg text-xs text-slate-700">
                      <strong>💡 Lời giải chi tiết: </strong> {item.explanation || "Chưa có giải thích chi tiết."}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            questions.map((q, idx) => (
              <div key={q.id} className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-3">
                <p className="font-bold text-sm text-slate-800">
                  Câu {idx + 1}: {q.question_text}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {q.options.map((opt, optIdx) => {
                    const optChar = String.fromCharCode(65 + optIdx);
                    const isSelected = answers[q.id] === optChar;

                    return (
                      <button
                        key={optIdx}
                        onClick={() => handleSelectOption(q.id, optChar)}
                        className={`text-left p-3 rounded-xl border text-xs sm:text-sm font-medium transition ${
                          isSelected
                            ? "border-blue-600 bg-blue-50 text-blue-900 shadow-sm"
                            : "border-slate-200 hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <span className="text-xs font-semibold text-slate-500">
            {result ? "Đã hoàn thành kiểm tra" : `Đã làm: ${Object.keys(answers).length}/${questions.length} câu`}
          </span>

          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl">
              Đóng
            </button>
            {!result && (
              <button
                onClick={handleSubmitQuiz}
                disabled={submitting || questions.length === 0}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition shadow-sm"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {submitting ? "Đang chấm..." : "Nộp bài"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};