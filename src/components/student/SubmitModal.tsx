"use client";

import React, { useState } from "react";
import { X, UploadCloud, Link as LinkIcon, CheckCircle2 } from "lucide-react";
import { Lesson } from "@/types";

interface SubmitModalProps {
  isOpen: boolean;
  lesson: Lesson | null;
  onClose: () => void;
  onSubmit: (lessonId: string, submissionUrl: string) => Promise<boolean>;
}

export const SubmitModal: React.FC<SubmitModalProps> = ({
  isOpen,
  lesson,
  onClose,
  onSubmit,
}) => {
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen || !lesson) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submissionUrl.trim()) {
      setErrorMessage("Vui lòng nhập link bài làm của bạn.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    const success = await onSubmit(lesson.id, submissionUrl.trim());
    setLoading(false);

    if (success) {
      setSubmissionUrl("");
      onClose();
    } else {
      setErrorMessage("Có lỗi xảy ra trong quá trình nộp bài. Vui lòng thử lại!");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase">Nộp bài tập</span>
            <h3 className="font-bold text-slate-900 text-base truncate max-w-[280px]">
              {lesson.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Link bài làm (Google Drive, Dropbox, Ảnh bài giải) *
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="url"
                required
                placeholder="https://drive.google.com/file/d/..."
                value={submissionUrl}
                onChange={(e) => setSubmissionUrl(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              * Lưu ý: Chia sẻ link Drive ở chế độ <strong>"Bất kỳ ai có đường liên kết đều có thể xem"</strong>.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium text-rose-700">
              {errorMessage}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition shadow-sm"
            >
              <UploadCloud className="h-4 w-4" />
              {loading ? "Đang gửi..." : "Xác nhận nộp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};