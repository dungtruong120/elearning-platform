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
    <div className="mt-3 font-sans text-left">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 text-xs font-bold transition cursor-pointer shadow-2xs"
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>
            {mode === "REVIEW_SOCRATIC"
              ? "Hỏi AI giải thích lỗi sai"
              : mode === "VIDEO_QA"
              ? "Hỏi AI đoạn video này"
              : "Hỏi gợi ý Gia sư AI"}
          </span>
        </button>
      ) : (
        <div className="rounded-2xl border border-indigo-200 bg-white shadow-md overflow-hidden animate-in fade-in duration-150">
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 shrink-0" />
              <span className="text-xs font-extrabold tracking-tight">
                Trợ giảng AI •{" "}
                {mode === "REVIEW_SOCRATIC"
                  ? "Phân tích lỗi sai từng bước"
                  : "Gợi ý tư duy (Khóa đáp án)"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-white/20 text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nội dung hội thoại */}
          <div className="p-3.5 max-h-80 overflow-y-auto space-y-3 bg-slate-50/60 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-600">
                  {mode === "REVIEW_SOCRATIC"
                    ? "Thầy/cô AI sẽ chỉ ra chỗ em bị bẫy và dẫn dắt từng bước tới biểu thức bấm máy nhé!"
                    : "Chào em! Hãy chọn gợi ý nhanh bên dưới, nhập câu hỏi hoặc chụp ảnh bài nháp để thầy/cô AI hướng dẫn hướng làm nhé."}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {quickPrompts.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(q)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-semibold transition cursor-pointer text-left"
                    >
                      + {q}
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
                    className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-xs"
                        : "bg-white border border-slate-200 text-slate-800 rounded-bl-xs"
                    }`}
                  >
                    {msg.imagePreview && (
                      <img
                        src={msg.imagePreview}
                        alt="Ảnh đính kèm"
                        className="max-h-40 rounded-lg mb-2 border border-white/20 object-contain"
                      />
                    )}
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    ) : (
                      <>
                        <MathTextRenderer content={msg.text} />

                        {/* Thanh phản hồi 1 chạm & Chuyển Trợ giảng */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleFeedback(idx, "like")}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border transition cursor-pointer ${
                                msg.feedback === "like"
                                  ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-bold"
                                  : "bg-slate-50 border-slate-200 text-slate-500 hover:text-emerald-700"
                              }`}
                            >
                              <ThumbsUp className="w-3 h-3" /> Đã hiểu
                            </button>
                            <button
                              type="button"
                              disabled={isLoading || cooldownSec > 0}
                              onClick={() => handleFeedback(idx, "dislike")}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border transition cursor-pointer ${
                                msg.feedback === "dislike"
                                  ? "bg-amber-50 border-amber-300 text-amber-700 font-bold"
                                  : "bg-slate-50 border-slate-200 text-slate-500 hover:text-amber-700"
                              }`}
                            >
                              <ThumbsDown className="w-3 h-3" /> Giải cách khác
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyForHumanTutor(idx)}
                            title="Copy câu hỏi & lời giải để nhắn hỏi Trợ giảng"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50/70 hover:bg-blue-100 text-blue-700 font-semibold transition cursor-pointer"
                          >
                            {copiedIdx === idx ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" /> Đã copy gửi Trợ giảng
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" /> Hỏi Trợ giảng thật
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
                <span>Trợ giảng AI đang phân tích bài toán...</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold flex items-start gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Preview ảnh đính kèm */}
          {selectedImage && (
            <div className="px-3.5 py-2 bg-indigo-50/70 border-t border-indigo-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={selectedImage}
                  alt="Preview"
                  className="w-10 h-10 rounded object-cover border border-indigo-200"
                />
                <span className="text-[11px] font-bold text-indigo-800">
                  Đã nén & đính kèm ảnh bài làm
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Thanh nhập câu hỏi */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-1.5"
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
              title="Tải ảnh bài nháp từ máy"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer shrink-0"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleScreenSnip}
              title="Chụp nhanh màn hình hiện tại"
              className="hidden sm:flex p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer shrink-0"
            >
              <Camera className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                cooldownSec > 0
                  ? `Đợi ${cooldownSec}s để hỏi tiếp...`
                  : "Nhập thắc mắc của em..."
              }
              className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={isLoading || cooldownSec > 0 || (!inputText.trim() && !selectedImage)}
              className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
