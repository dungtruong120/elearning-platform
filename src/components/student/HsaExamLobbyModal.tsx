"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Clock, FileText, Play, User, X } from "lucide-react";

export interface HsaExamLobbyModalProps {
  isOpen: boolean;
  exam: any;
  studentName: string;
  studentSbd: string;
  onClose: () => void;
  onStartExam: (selectedPartKey: "all" | string) => void;
}

interface NormalizedSection {
  key: string;
  title: string;
  questionCount: number;
  durationMinutes: number;
  maxScore: number;
}

const SECTION_META: Record<
  string,
  { label: string; defaultDuration: number; order: number }
> = {
  quant: {
    label: "Tư duy Định lượng (Toán học & Xử lý số liệu)",
    defaultDuration: 75,
    order: 1,
  },
  dinh_luong: {
    label: "Tư duy Định lượng (Toán học & Xử lý số liệu)",
    defaultDuration: 75,
    order: 1,
  },
  toan: {
    label: "Tư duy Định lượng (Toán học & Xử lý số liệu)",
    defaultDuration: 75,
    order: 1,
  },
  math: {
    label: "Tư duy Định lượng (Toán học & Xử lý số liệu)",
    defaultDuration: 75,
    order: 1,
  },
  qual: {
    label: "Tư duy Định tính (Ngôn ngữ - Văn học)",
    defaultDuration: 60,
    order: 2,
  },
  dinh_tinh: {
    label: "Tư duy Định tính (Ngôn ngữ - Văn học)",
    defaultDuration: 60,
    order: 2,
  },
  van: {
    label: "Tư duy Định tính (Ngôn ngữ - Văn học)",
    defaultDuration: 60,
    order: 2,
  },
  literature: {
    label: "Tư duy Định tính (Ngôn ngữ - Văn học)",
    defaultDuration: 60,
    order: 2,
  },
  english: {
    label: "Tiếng Anh",
    defaultDuration: 60,
    order: 3,
  },
  tieng_anh: {
    label: "Tiếng Anh",
    defaultDuration: 60,
    order: 3,
  },
  science: {
    label: "Khoa học",
    defaultDuration: 60,
    order: 3,
  },
  khoa_hoc: {
    label: "Khoa học",
    defaultDuration: 60,
    order: 3,
  },
};

function normalizeSections(exam: any): NormalizedSection[] {
  if (!exam) return [];

  const rawSource =
    exam.sections ??
    exam.data?.sections ??
    exam.data?.parts ??
    (Array.isArray(exam.data) ? exam.data : null) ??
    (exam.data && typeof exam.data === "object" ? exam.data : null);

  if (!rawSource) return [];

  const list: NormalizedSection[] = [];

  if (Array.isArray(rawSource)) {
    rawSource.forEach((sec: any, idx: number) => {
      if (!sec) return;
      const key = String(sec.key ?? sec.id ?? sec.partKey ?? `part_${idx + 1}`);
      const meta = SECTION_META[key.toLowerCase()];
      const questions = Array.isArray(sec.questions)
        ? sec.questions
        : Array.isArray(sec.items)
        ? sec.items
        : [];
      const qCount =
        typeof sec.questionCount === "number"
          ? sec.questionCount
          : typeof sec.total_questions === "number"
          ? sec.total_questions
          : questions.length;
      if (qCount === 0 && !sec.title && !sec.name) return;

      list.push({
        key,
        title: sec.title || sec.name || meta?.label || `Phần ${idx + 1}`,
        questionCount: qCount || 50,
        durationMinutes:
          Number(sec.durationMinutes ?? sec.duration ?? sec.time_limit) ||
          meta?.defaultDuration ||
          60,
        maxScore: Number(sec.maxScore) || 50,
      });
    });
  } else if (typeof rawSource === "object") {
    const ignoredKeys = new Set([
      "mediaMap",
      "media",
      "metadata",
      "title",
      "description",
      "config",
      "settings",
    ]);

    Object.entries(rawSource).forEach(([key, val]: [string, any], idx: number) => {
      if (ignoredKeys.has(key) || !val) return;
      const meta = SECTION_META[key.toLowerCase()];

      if (Array.isArray(val)) {
        if (val.length === 0) return;
        list.push({
          key,
          title: meta?.label || `Phần ${idx + 1}`,
          questionCount: val.length,
          durationMinutes: meta?.defaultDuration || 60,
          maxScore: 50,
        });
      } else if (typeof val === "object") {
        const questions = Array.isArray(val.questions)
          ? val.questions
          : Array.isArray(val.items)
          ? val.items
          : [];
        const qCount =
          typeof val.questionCount === "number"
            ? val.questionCount
            : typeof val.total_questions === "number"
            ? val.total_questions
            : questions.length;
        if (qCount === 0 && !val.title && !val.name) return;

        list.push({
          key,
          title: val.title || val.name || meta?.label || `Phần ${idx + 1}`,
          questionCount: qCount || 50,
          durationMinutes:
            Number(val.durationMinutes ?? val.duration ?? val.time_limit) ||
            meta?.defaultDuration ||
            60,
          maxScore: Number(val.maxScore) || 50,
        });
      }
    });
  }

  return list.sort((a, b) => {
    const orderA = SECTION_META[a.key.toLowerCase()]?.order ?? 99;
    const orderB = SECTION_META[b.key.toLowerCase()]?.order ?? 99;
    return orderA - orderB;
  });
}

export default function HsaExamLobbyModal({
  isOpen,
  exam,
  studentName,
  studentSbd,
  onClose,
  onStartExam,
}: HsaExamLobbyModalProps) {
  const sections = useMemo(() => normalizeSections(exam), [exam]);
  const [selectedPartKey, setSelectedPartKey] = useState<"all" | string>("all");

  useEffect(() => {
    if (isOpen) {
      setSelectedPartKey("all");
    }
  }, [isOpen, exam?.id]);

  if (!isOpen) return null;

  const examTitle =
    exam?.title || exam?.name || "Kỳ thi Đánh giá năng lực (HSA)";

  const totalQuestions = sections.reduce((sum, s) => sum + s.questionCount, 0);
  const totalDuration = sections.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalMaxScore = sections.reduce((sum, s) => sum + s.maxScore, 0);

  const activeSummary =
    selectedPartKey === "all"
      ? {
          label: `Toàn bộ đề thi (${sections.length} phần)`,
          questions: totalQuestions,
          duration: totalDuration,
          maxScore: totalMaxScore,
        }
      : (() => {
          const found = sections.find((s) => s.key === selectedPartKey);
          return found
            ? {
                label: found.title,
                questions: found.questionCount,
                duration: found.durationMinutes,
                maxScore: found.maxScore,
              }
            : {
                label: "Phần thi đã chọn",
                questions: totalQuestions,
                duration: totalDuration,
                maxScore: totalMaxScore,
              };
        })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hsa-lobby-title"
    >
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-[#F8FAFC] px-6 py-4 rounded-t-lg">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Phòng chờ thi Đánh giá năng lực HSA
            </p>
            <h2
              id="hsa-lobby-title"
              className="mt-0.5 text-lg font-bold text-slate-900"
            >
              {examTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-6 py-5">
          {/* Student Info Bar */}
          <div className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-[#F8FAFC] p-3.5 sm:grid-cols-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-600">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Họ và tên thí sinh</p>
                <p className="truncate text-sm font-semibold text-slate-900">
                  {studentName || "Thí sinh tự do"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-600">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">Số báo danh (SBD)</p>
                <p className="truncate font-mono text-sm font-semibold text-slate-900">
                  {studentSbd || "HSA000000"}
                </p>
              </div>
            </div>
          </div>

          {/* Exam Structure Table */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Cấu trúc đề thi ({sections.length} phần)
              </h3>
              <span className="text-xs text-slate-500">
                Thang điểm: 50 điểm / phần
              </span>
            </div>

            {sections.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-slate-200">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-3.5 py-2.5">Phần thi</th>
                      <th className="px-3 py-2.5 text-center">Số câu</th>
                      <th className="px-3 py-2.5 text-center">Thời gian</th>
                      <th className="px-3.5 py-2.5 text-right">Điểm tối đa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {sections.map((sec) => (
                      <tr key={sec.key} className="hover:bg-slate-50/70">
                        <td className="px-3.5 py-2.5 font-medium text-slate-800">
                          {sec.title}
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-600">
                          {sec.questionCount}
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-600">
                          {sec.durationMinutes} phút
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-medium text-slate-700">
                          {sec.maxScore}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {sections.length > 1 && (
                    <tfoot className="border-t border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-slate-800">
                      <tr>
                        <td className="px-3.5 py-2">Tổng cộng</td>
                        <td className="px-3 py-2 text-center">
                          {totalQuestions} câu
                        </td>
                        <td className="px-3 py-2 text-center">
                          {totalDuration} phút
                        </td>
                        <td className="px-3.5 py-2 text-right">
                          {totalMaxScore} điểm
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-slate-200 bg-[#F8FAFC] p-4 text-center text-sm text-slate-500">
                Đề thi chưa có dữ liệu phần thi chi tiết.
              </div>
            )}
          </div>

          {/* Mode Selection */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
              Chọn chế độ làm bài
            </h3>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setSelectedPartKey("all")}
                className={`flex w-full items-center justify-between rounded-md border px-3.5 py-2.5 text-left text-sm transition-colors ${
                  selectedPartKey === "all"
                    ? "border-blue-700 bg-blue-50/60 text-blue-900"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      selectedPartKey === "all"
                        ? "border-blue-700 bg-blue-700"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {selectedPartKey === "all" && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="font-semibold">
                    Thi toàn bộ các phần có trong đề
                  </span>
                </div>
                <span className="text-xs font-medium text-slate-500">
                  {totalQuestions} câu · {totalDuration} phút
                </span>
              </button>

              {sections.length > 1 && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {sections.map((sec) => {
                    const isSelected = selectedPartKey === sec.key;
                    return (
                      <button
                        key={sec.key}
                        type="button"
                        onClick={() => setSelectedPartKey(sec.key)}
                        className={`flex flex-col justify-between rounded-md border p-3 text-left transition-colors ${
                          isSelected
                            ? "border-blue-700 bg-blue-50/60 text-blue-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="line-clamp-2 text-xs font-semibold">
                            {sec.title}
                          </span>
                          <span
                            className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                              isSelected
                                ? "border-blue-700 bg-blue-700"
                                : "border-slate-300 bg-white"
                            }`}
                          >
                            {isSelected && (
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            )}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {sec.questionCount} câu
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {sec.durationMinutes}p
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse items-center justify-between gap-3 border-t border-slate-200 bg-[#F8FAFC] px-6 py-4 rounded-b-lg sm:flex-row">
          <div className="text-xs text-slate-600">
            Đang chọn:{" "}
            <span className="font-semibold text-slate-900">
              {activeSummary.label}
            </span>{" "}
            ({activeSummary.questions} câu · {activeSummary.duration} phút)
          </div>
          <div className="flex w-full items-center justify-end gap-2.5 sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={sections.length === 0}
              onClick={() => onStartExam(selectedPartKey)}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-800 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              Bắt đầu làm bài
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
