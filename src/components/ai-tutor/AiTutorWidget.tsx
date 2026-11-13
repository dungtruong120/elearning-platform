"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  X,
  ImagePlus,
  Loader2,
  ShieldAlert,
  Bot,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  Camera,
} from "lucide-react";
import MathTextRenderer from "./MathTextRenderer";

export type AiTutorMode = "HIDDEN" | "HOMEWORK_HINT" | "REVIEW_SOCRATIC" | "VIDEO_QA";

export interface AiTutorWidgetProps {
  mode: AiTutorMode;
  questionKey?: string;
  lessonTitle?: string;
  questionType?: "multiple_choice" | "true_false" | "short_answer" | "video";
  questionText: string;
  options?: string[];
  studentAnswer?: string;
  correctAnswer?: string;
  officialSolution?: string;
  videoTimestamp?: string;
}

interface Message {
  role: "user" | "model";
  text: string;
  imagePreview?: string;
  feedback?: "like" | "dislike";
}

const DAILY_LIMIT = 15;
const STORAGE_QUOTA_KEY = "tct_ai_tutor_daily_quota";

// Hàm nén ảnh tự động trên trình duyệt xuống chiều ngang tối đa 1024px (~120KB)
function compressImageToBase64(file: File | Blob, maxWidth = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Không thể xử lý ảnh"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => reject(new Error("Lỗi đọc file ảnh"));
      img.src = String(event.target?.result || "");
    };
    reader.onerror = () => reject(new Error("Lỗi tải file"));
    reader.readAsDataURL(file);
  });
}

export default function AiTutorWidget({
  mode,
  questionKey,
  lessonTitle,
  questionType = "multiple_choice",
  questionText,
  options = [],
  studentAnswer,
  correctAnswer,
  officialSolution,
  videoTimestamp,
}: AiTutorWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = setTimeout(() => setCooldownSec((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldownSec]);

  // Ẩn hoàn toàn nếu đang làm bài kiểm tra tính giờ
  if (mode === "HIDDEN") return null;

  const checkAndIncrementQuota = (): boolean => {
    if (typeof window === "undefined") return true;
    const today = new Date().toISOString().slice(0, 10);
    try {
      const raw = localStorage.getItem(STORAGE_QUOTA_KEY);
      const parsed = raw ? JSON.parse(raw) : { date: today, count: 0 };
      if (parsed.date !== today) {
        localStorage.setItem(STORAGE_QUOTA_KEY, JSON.stringify({ date: today, count: 1 }));
        return true;
      }
      if (parsed.count >= DAILY_LIMIT) return false;
      localStorage.setItem(
        STORAGE_QUOTA_KEY,
        JSON.stringify({ date: today, count: parsed.count + 1 })
      );
      return true;
    } catch {
      return true;
    }
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToBase64(file);
      setSelectedImage(compressed);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể nén ảnh nháp.");
    }
    e.target.value = "";
  };

  // Chụp nhanh màn hình (hữu ích khi xem Video hoặc đề có hình vẽ)
  const handleScreenSnip = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" } as any,
        audio: false,
      });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement("canvas");
      const maxWidth = 1024;
      let width = video.videoWidth;
      let height = video.videoHeight;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0, width, height);

      stream.getTracks().forEach((t) => t.stop());
      setSelectedImage(canvas.toDataURL("image/jpeg", 0.8));
      setErrorMsg(null);
    } catch {
      // Người dùng hủy chia sẻ màn hình hoặc trình duyệt không hỗ trợ
    }
  };

  const handleSendMessage = async (customPrompt?: string, isDislikeRetry = false) => {
    const promptToSend = (customPrompt ?? inputText).trim();
    if ((!promptToSend && !selectedImage) || isLoading || cooldownSec > 0) return;

    if (!checkAndIncrementQuota()) {
      setErrorMsg(
        `Em đã dùng hết ${DAILY_LIMIT} lượt hỏi AI hôm nay. Hãy tự suy nghĩ thêm hoặc nhắn tin cho trợ giảng nhé!`
      );
      return;
    }

    setErrorMsg(null);
    const userMsg: Message = {
      role: "user",
      text: promptToSend || "Thầy/cô xem giúp em ảnh này với ạ.",
      imagePreview: selectedImage || undefined,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputText("");
    const imageToUpload = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          isDislikeFeedback: isDislikeRetry,
          questionContext: {
            questionKey,
            lessonTitle,
            questionType,
            questionText,
            options,
            studentAnswer,
            correctAnswer,
            officialSolution,
            videoTimestamp,
          },
          messages: nextMessages.map((m) => ({ role: m.role, text: m.text })),
          imageBase64: imageToUpload || undefined,
          imageMimeType: "image/jpeg",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi kết nối trợ giảng AI");

      setMessages((prev) => [...prev, { role: "model", text: data.reply }]);
      setCooldownSec(5); // Cooldown 5s chống spam
    } catch (err: any) {
      setErrorMsg(err.message || "Không thể kết nối AI lúc này.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = (idx: number, type: "like" | "dislike") => {
    setMessages((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, feedback: type } : m))
    );
    if (type === "dislike") {
      handleSendMessage(
        "Cách giải thích trên hơi khó hiểu với em. Thầy/cô hãy đổi hoàn toàn phương pháp tiếp cận khác trực quan và ngắn gọn hơn giúp em nhé!",
        true
      );
    }
  };

  const handleCopyForHumanTutor = (idx: number) => {
    const aiReply = messages[idx]?.text || "";
    const textToCopy = `[HỎI TRỢ GIẢNG - ${lessonTitle || "BTVN"}]\n• Đề bài: ${questionText}\n• Em đã hỏi AI nhưng chưa rõ phần này:\n"${aiReply.slice(0, 250)}..."\nThầy/cô giảng giúp em với ạ!`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2500);
  };

  const quickPrompts =
    mode === "REVIEW_SOCRATIC"
      ? [
          "Tại sao đáp án em chọn lại bị sai?",
          "Giải thích chi tiết bước biến đổi trong lời giải",
          "Có mẹo bấm Casio nhanh cho câu này không?",
        ]
      : mode === "VIDEO_QA"
      ? [
          "Giải thích lại công thức thầy/cô vừa dùng ở đoạn này",
          "Tại sao lại biến đổi được sang bước tiếp theo ạ?",
        ]
      : [
          "Bài này thuộc dạng gì & dùng công thức nào?",
          "Gợi ý giúp em bước biến đổi đầu tiên",
          "Kiểm tra giúp em ảnh nháp này sai ở đâu",
        ];

return (
    <div className="fixed bottom-16 lg:bottom-6 right-4 sm:right-6 z-[150] font-sans text-left">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg shadow-indigo-500/30 border border-white/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
          <span className="text-xs font-extrabold tracking-tight">
            {mode === "REVIEW_SOCRATIC"
              ? "Hỏi AI câu này"
              : mode === "VIDEO_QA"
              ? "Hỏi AI bài giảng"
              : "Gia sư AI"}
          </span>
        </button>
      ) : (
        <div className="w-[330px] sm:w-[370px] rounded-2xl border border-indigo-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header khung chat mini */}
          <div className="px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Bot className="w-4 h-4 shrink-0" />
              <span className="text-xs font-extrabold tracking-tight truncate">
                {mode === "REVIEW_SOCRATIC"
                  ? "Gia sư AI • Chữa lỗi sai"
                  : mode === "VIDEO_QA"
                  ? "Gia sư AI • Hỏi bài giảng"
                  : "Gia sư AI • Gợi ý hướng làm"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-white/20 text-white transition cursor-pointer shrink-0"
              title="Thu gọn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nội dung hội thoại */}
          <div className="p-3 max-h-72 overflow-y-auto space-y-2.5 bg-slate-50/70 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-[11.5px] text-slate-600 leading-relaxed">
                  {mode === "REVIEW_SOCRATIC"
                    ? "Thầy/cô AI đã nắm được đáp án em chọn. Bấm gợi ý nhanh bên dưới hoặc hỏi bước em chưa rõ nhé:"
                    : "Em đang vướng ở bước nào? Bấm chọn gợi ý hoặc gửi ảnh nháp để thầy/cô AI hướng dẫn nhé:"}
                </p>
                <div className="flex flex-col gap-1.5">
                  {quickPrompts.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(q)}
                      className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[11px] font-semibold transition cursor-pointer text-left"
                    >
                      ✨ {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-3 py-2 text-xs shadow-2xs ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-xs"
                        : "bg-white border border-slate-200 text-slate-800 rounded-bl-xs"
                    }`}
                  >
                    {msg.imagePreview && (
                      <img
                        src={msg.imagePreview}
                        alt="Ảnh đính kèm"
                        className="max-h-36 rounded-lg mb-1.5 border border-white/20 object-contain"
                      />
                    )}
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    ) : (
                      <>
                        <MathTextRenderer content={msg.text} />

                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5 text-[10px]">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleFeedback(idx, "like")}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                msg.feedback === "like"
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-bold"
                                  : "bg-slate-50 border-slate-200 text-slate-500 hover:text-emerald-700"
                              }`}
                            >
                              <ThumbsUp className="w-2.5 h-2.5" /> Hiểu rồi
                            </button>
                            <button
                              type="button"
                              disabled={isLoading || cooldownSec > 0}
                              onClick={() => handleFeedback(idx, "dislike")}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                msg.feedback === "dislike"
                                  ? "bg-amber-50 border-amber-300 text-amber-700 font-bold"
                                  : "bg-slate-50 border-slate-200 text-slate-500 hover:text-amber-700"
                              }`}
                            >
                              <ThumbsDown className="w-2.5 h-2.5" /> Cách khác
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyForHumanTutor(idx)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold transition cursor-pointer"
                          >
                            {copiedIdx === idx ? (
                              <>
                                <Check className="w-2.5 h-2.5 text-emerald-600" /> Đã copy
                              </>
                            ) : (
                              <>
                                <Copy className="w-2.5 h-2.5" /> Hỏi Trợ giảng
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-indigo-600 font-semibold py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Trợ giảng AI đang phân tích...</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold flex items-start gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {selectedImage && (
            <div className="px-3 py-1.5 bg-indigo-50/80 border-t border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={selectedImage}
                  alt="Preview"
                  className="w-8 h-8 rounded object-cover border border-indigo-200"
                />
                <span className="text-[11px] font-bold text-indigo-800">Đã đính kèm ảnh</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Thanh nhập câu hỏi */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2 bg-white border-t border-slate-200 flex items-center gap-1.5"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImagePick}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Gửi ảnh bài nháp"
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer shrink-0"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleScreenSnip}
              title="Chụp màn hình"
              className="hidden sm:flex p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer shrink-0"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={cooldownSec > 0 ? `Đợi ${cooldownSec}s...` : "Hỏi về câu này..."}
              className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={isLoading || cooldownSec > 0 || (!inputText.trim() && !selectedImage)}
              className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
