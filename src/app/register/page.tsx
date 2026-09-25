"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  GraduationCap, User, Mail, Phone, School, BookOpen, 
  Lock, ArrowRight, ShieldCheck, Laptop, MapPin, CheckCircle2,
  Clock, LogIn
} from "lucide-react";
import { Profile, LearningMode } from "@/types";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    school: "",
    grade: "Lớp 12",
    learningMode: "online" as LearningMode,
    password: "",
    confirmPassword: ""
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!formData.fullName.trim() || !formData.email.trim() || !formData.password.trim()) {
      setErrorMsg("Vui lòng điền đầy đủ các thông tin bắt buộc (*)");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg("Mật khẩu xác nhận không khớp. Vui lòng nhập lại.");
      return;
    }

    const newStudent: Profile & { password?: string } = {
      id: `stu-${Date.now()}`,
      full_name: formData.fullName.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      school: formData.school.trim() || "Chưa cập nhật",
      grade: formData.grade,
      learning_mode: formData.learningMode,
      approval_status: "pending",
      role: "student",
      password: formData.password,
      created_at: new Date().toISOString()
    };

    if (typeof window !== "undefined") {
      try {
        const savedList = localStorage.getItem("edunexus_registered_students");
        const list: Profile[] = savedList ? JSON.parse(savedList) : [];
        const updatedList = [newStudent, ...list.filter(s => s.email?.toLowerCase() !== newStudent.email.toLowerCase())];
        localStorage.setItem("edunexus_registered_students", JSON.stringify(updatedList));
        window.dispatchEvent(new Event("storage"));
      } catch (err) {
        console.error("Lỗi lưu thông tin đăng ký:", err);
      }
    }

    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans text-slate-800">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-xl bg-white border border-slate-200 shadow-xl shadow-slate-200/60 rounded-3xl p-6 sm:p-10 text-slate-800 relative"
      >
        {!isSubmitted ? (
          <>
            {/* Header Form */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md shadow-blue-500/20 text-white">
                <GraduationCap className="w-7 h-7" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Đăng Ký Tài Khoản Học Viên</h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">Hệ thống Đào tạo & Khảo thí Toán học TCT EduNexus</p>
            </div>

            {errorMsg && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs sm:text-sm text-rose-700 font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              {/* Lựa chọn hình thức học Online / Offline */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Hình thức học tập *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setFormData({ ...formData, learningMode: "offline" })}
                    className={`cursor-pointer p-4 rounded-2xl border text-center transition-all ${
                      formData.learningMode === "offline"
                        ? "bg-blue-50/80 border-blue-600 shadow-xs text-blue-900 ring-2 ring-blue-600/20"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/80"
                    }`}
                  >
                    <MapPin className={`w-6 h-6 mx-auto mb-1.5 ${formData.learningMode === "offline" ? "text-blue-600" : "text-slate-400"}`} />
                    <div className="font-extrabold text-sm">Học sinh Offline</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Lớp trực tiếp tại cơ sở</div>
                  </motion.div>

                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setFormData({ ...formData, learningMode: "online" })}
                    className={`cursor-pointer p-4 rounded-2xl border text-center transition-all ${
                      formData.learningMode === "online"
                        ? "bg-indigo-50/80 border-indigo-600 shadow-xs text-indigo-900 ring-2 ring-indigo-600/20"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100/80"
                    }`}
                  >
                    <Laptop className={`w-6 h-6 mx-auto mb-1.5 ${formData.learningMode === "online" ? "text-indigo-600" : "text-slate-400"}`} />
                    <div className="font-extrabold text-sm">Học sinh Online</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Lớp học qua Zoom / Meet</div>
                  </motion.div>
                </div>
              </div>

              {/* Họ và tên */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Họ và tên học sinh *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    required
                    type="text"
                    value={formData.fullName}
                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="Ví dụ: Nguyễn Văn An"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-hidden transition-all"
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email liên hệ *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      required
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="student@gmail.com"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-hidden transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Số điện thoại *</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      required
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="0987654321"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-hidden transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Trường THPT & Khối lớp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Trường THPT</label>
                  <div className="relative">
                    <School className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={formData.school}
                      onChange={e => setFormData({ ...formData, school: e.target.value })}
                      placeholder="THPT Chuyên, Chu Văn An..."
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-hidden transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Khối lớp</label>
                  <div className="relative">
                    <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <select
                      value={formData.grade}
                      onChange={e => setFormData({ ...formData, grade: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 outline-hidden cursor-pointer"
                    >
                      <option value="Lớp 12">Lớp 12 (Luyện thi Đại học)</option>
                      <option value="Lớp 11">Lớp 11</option>
                      <option value="Lớp 10">Lớp 10</option>
                      <option value="Ôn ĐGNL/TSA">Khối ĐGNL / ĐGTD</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Mật khẩu & Xác nhận */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu *</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      required
                      type="password"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-hidden transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Xác nhận mật khẩu *</label>
                  <div className="relative">
                    <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      required
                      type="password"
                      value={formData.confirmPassword}
                      onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-hidden transition-all"
                    />
                  </div>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full mt-2 py-3 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer"
              >
                Gửi Hồ Sơ Đăng Ký <ArrowRight className="w-4 h-4" />
              </motion.button>

              <div className="text-center pt-2">
                <span className="text-xs text-slate-500">Đã có tài khoản? </span>
                <Link href="/login" className="text-xs font-bold text-blue-600 hover:underline">
                  Đăng nhập ngay
                </Link>
              </div>
            </form>
          </>
        ) : (
          <div className="text-center py-6 space-y-5">
            <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-3xl flex items-center justify-center mx-auto text-amber-600 shadow-sm">
              <Clock className="w-8 h-8" />
            </div>
            
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-900">Đăng Ký Thành Công!</h2>
              <p className="text-xs sm:text-sm text-slate-500">Hồ sơ đã được gửi đến Ban Giám Vụ TCT EduNexus.</p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2 text-xs sm:text-sm text-slate-700">
              <p><strong className="text-slate-900">Học sinh:</strong> {formData.fullName}</p>
              <p><strong className="text-slate-900">Email:</strong> {formData.email}</p>
              <p><strong className="text-slate-900">Hình thức học:</strong> {formData.learningMode === "online" ? "Học sinh Online (Zoom / Meet)" : "Học sinh Offline (Cơ sở TCT)"}</p>
              <p><strong className="text-amber-600 font-bold">Trạng thái:</strong> Đang chờ Ban Giám Vụ xét duyệt</p>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Tài khoản của bạn đang được xét duyệt. Sau khi được duyệt, bạn có thể đăng nhập bằng email và mật khẩu vừa tạo để vào lớp.
            </p>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/login")}
              className="w-full py-3 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" /> Chuyển Đến Trang Đăng Nhập
            </motion.button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
