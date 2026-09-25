"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { 
  GraduationCap, User, Mail, Lock, Phone, School, 
  ArrowRight, AlertCircle, CheckCircle2, Globe, Users 
} from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    school: "",
    grade: "Lớp 12",
    learningMode: "online" as "online" | "offline",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const emailTrim = formData.email.trim().toLowerCase();
    const fullNameTrim = formData.fullName.trim();

    if (!fullNameTrim || !emailTrim || !formData.password) {
      setErrorMessage("Vui lòng điền đầy đủ các thông tin bắt buộc!");
      return;
    }

    if (formData.password.length < 6) {
      setErrorMessage("Mật khẩu phải có tối thiểu 6 ký tự!");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp!");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Tạo tài khoản trong Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailTrim,
        password: formData.password,
        options: {
          data: {
            full_name: fullNameTrim,
          },
        },
      });

      if (authError) {
        throw new Error(authError.message);
      }

      const userId = authData.user?.id || ("stu-" + Date.now());

      // 2. Tạo bản ghi hồ sơ học sinh trực tiếp vào bảng "profiles" trên Supabase
      const newProfile = {
        id: userId,
        full_name: fullNameTrim,
        email: emailTrim,
        phone: formData.phone.trim(),
        school: formData.school.trim() || "THPT",
        grade: formData.grade,
        role: "student",
        learning_mode: formData.learningMode,
        study_mode: formData.learningMode,
        approval_status: "pending", // Đặt ở trạng thái Chờ duyệt
        created_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert([newProfile]);

      if (profileError) {
        throw new Error(profileError.message);
      }

      // Lưu dự phòng vào cache local
      if (typeof window !== "undefined") {
        try {
          const localList = JSON.parse(localStorage.getItem("edunexus_registered_students") || "[]");
          localStorage.setItem("edunexus_registered_students", JSON.stringify([newProfile, ...localList]));
        } catch {}
      }

      setIsSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Đăng ký không thành công. Vui lòng thử lại!");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center p-4 font-sans select-none text-slate-800">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 p-8 shadow-xl text-center space-y-5 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-black text-slate-900">Đăng Ký Thành Công!</h2>
            <p className="text-xs text-slate-500">
              Hồ sơ của bạn đã được gửi lên hệ thống và đang ở trạng thái <strong>Chờ xét duyệt</strong>.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-1.5 font-medium text-slate-600">
            <p><strong>Họ và tên:</strong> {formData.fullName}</p>
            <p><strong>Email:</strong> {formData.email}</p>
            <p><strong>Hình thức học:</strong> {formData.learningMode === "online" ? "Lớp Online" : "Lớp Offline"}</p>
            <p><strong>Trạng thái:</strong> <span className="text-amber-600 font-bold">Chờ duyệt từ Ban Giám Khảo</span></p>
          </div>

          <Link
            href="/"
            className="w-full py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
          >
            <span>Về trang chủ đăng nhập</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-6 font-sans select-none text-slate-800">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-[#1D4ED8] rounded-2xl mx-auto flex items-center justify-center text-white shadow-sm shadow-blue-600/30 mb-2">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Đăng Ký Học Viên TCT
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Tạo tài khoản học tập & luyện thi trực tuyến
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Họ và tên */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Họ và tên học sinh <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                required
                type="text"
                placeholder="VD: Nguyễn Văn An"
                value={formData.fullName}
                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
              />
            </div>
          </div>

          {/* Email & Số điện thoại */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Email tài khoản <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  required
                  type="email"
                  placeholder="an.nguyen@gmail.com"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Số điện thoại / Zalo
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  placeholder="0912345678"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          {/* Trường học & Khối lớp */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Trường THPT đang học
              </label>
              <div className="relative">
                <School className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="VD: THPT Chuyên Hà Nội"
                  value={formData.school}
                  onChange={e => setFormData({ ...formData, school: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Khối lớp
              </label>
              <select
                value={formData.grade}
                onChange={e => setFormData({ ...formData, grade: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition cursor-pointer"
              >
                <option value="Lớp 12">Lớp 12 (Ôn thi TN & ĐGNL)</option>
                <option value="Lớp 11">Lớp 11</option>
                <option value="Lớp 10">Lớp 10</option>
              </select>
            </div>
          </div>

          {/* Phân luồng: Học Online hay Học Offline */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Hình thức đăng ký học tập <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, learningMode: "online" })}
                className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                  formData.learningMode === "online"
                    ? "bg-blue-50 border-[#1D4ED8] text-[#1D4ED8] ring-2 ring-blue-500/20 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className={`p-2 rounded-xl ${formData.learningMode === "online" ? "bg-[#1D4ED8] text-white" : "bg-white text-slate-400 border border-slate-200"}`}>
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-black text-xs block">Lớp Online</span>
                  <span className="text-[10px] text-slate-500 block">Học Zoom & Video</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, learningMode: "offline" })}
                className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 cursor-pointer ${
                  formData.learningMode === "offline"
                    ? "bg-purple-50 border-purple-600 text-purple-700 ring-2 ring-purple-600/20 shadow-xs"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className={`p-2 rounded-xl ${formData.learningMode === "offline" ? "bg-purple-600 text-white" : "bg-white text-slate-400 border border-slate-200"}`}>
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-black text-xs block">Lớp Offline</span>
                  <span className="text-[10px] text-slate-500 block">Học tại cơ sở TCT</span>
                </div>
              </button>
            </div>
          </div>

          {/* Mật khẩu & Nhập lại mật khẩu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Mật khẩu đăng nhập <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  required
                  type="password"
                  placeholder="Tối thiểu 6 ký tự"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Nhập lại mật khẩu <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  required
                  type="password"
                  placeholder="Xác nhận mật khẩu"
                  value={formData.confirmPassword}
                  onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 pt-3"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang gửi hồ sơ xét duyệt...</span>
              </>
            ) : (
              <>
                <span>Gửi hồ sơ đăng ký tài khoản</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500 font-medium">
            Đã có tài khoản?{" "}
            <Link href="/" className="font-bold text-[#1D4ED8] hover:underline">
              Đăng nhập ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
