"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Profile } from "@/types";
import { supabase } from "@/lib/supabaseClient";
import { 
  Lock, Mail, ArrowRight, GraduationCap, AlertCircle, LogOut 
} from "lucide-react";

// DYNAMIC IMPORT CÁC TRANG TRÁNH LỖI SSR HYDRATION
const StudentOnlineDashboard = dynamic(
  () => import("@/components/student/StudentOnlineDashboard"),
  { ssr: false }
);

const StudentOfflineDashboard = dynamic(
  () => import("@/components/student/StudentOfflineDashboard"),
  { ssr: false }
);

const AdminPage = dynamic(
  () => import("@/app/admin/page"),
  { ssr: false }
);

// HÀM TẠO MÃ ĐỊNH DANH HỌC SINH TỰ ĐỘNG CHUẨN PHÂN HỆ
export function generateStudentCode(user: Partial<Profile>): string {
  if (user.student_code && user.student_code.startsWith("HS-")) {
    return user.student_code;
  }
  const isOnline = user.learning_mode === "online" || user.study_mode === "online";
  const prefix = isOnline ? "HS-ONL-2026" : "HS-OFF-2026";
  const idStr = user.id || user.email || "001";
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = (hash * 31 + idStr.charCodeAt(i)) % 900;
  }
  const num = String((Math.abs(hash) % 900) + 100).padStart(3, "0");
  return prefix + "-" + num;
}

// CẤU HÌNH DUY NHẤT TÀI KHOẢN ADMIN ĐƯỢC PHÉP TRUY CẬP ADMIN PANEL
const ADMIN_ACCOUNT = {
  email: "hieu0986357867@gmail.com",
  password: "0394153206"
};

export default function RootPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [emailInput, setEmailInput] = useState<string>("");
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // HÀM DỌN SẠCH TẤT CẢ PHIÊN ĐĂNG NHẬP TRƯỚC KHI GHI MỚI HOẶC KHI ĐĂNG XUẤT
  const clearAllSessions = () => {
    if (typeof window === "undefined") return;
    localStorage.removeItem("tct_current_user");
    localStorage.removeItem("edunexus_current_user");
    localStorage.removeItem("edunexus_user_session");
    sessionStorage.clear();
  };

  // 1. KIỂM TRA VÀ DUY TRÌ PHIÊN ĐĂNG NHẬP HIỆN TẠI (F5 KHÔNG MẤT DỮ LIỆU)
  const loadUserSession = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const activeUserStr =
        localStorage.getItem("tct_current_user") ||
        localStorage.getItem("edunexus_current_user");

      if (activeUserStr && activeUserStr !== "undefined" && activeUserStr !== "null") {
        const parsed = JSON.parse(activeUserStr);
        if (parsed && parsed.id) {
          if (parsed.role === "admin" && parsed.email?.toLowerCase() !== ADMIN_ACCOUNT.email.toLowerCase()) {
            parsed.role = "student";
            parsed.learning_mode = parsed.learning_mode || "online";
            parsed.study_mode = parsed.study_mode || "online";
          }

          if (parsed.role === "student" && !parsed.student_code) {
            parsed.student_code = generateStudentCode(parsed);
          }

          localStorage.setItem("tct_current_user", JSON.stringify(parsed));
          localStorage.setItem("edunexus_current_user", JSON.stringify(parsed));
          setCurrentUser(parsed);
        } else {
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      console.warn("Lỗi đọc session đăng nhập:", e);
      setCurrentUser(null);
    } finally {
      setIsMounted(true);
    }
  }, []);

  useEffect(() => {
    loadUserSession();
    window.addEventListener("storage", loadUserSession);
    return () => window.removeEventListener("storage", loadUserSession);
  }, [loadUserSession]);

  // 2. XỬ LÝ ĐĂNG NHẬP QUA FORM
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    const emailTrim = emailInput.trim().toLowerCase();
    const passwordTrim = passwordInput.trim();

    if (!emailTrim) {
      setErrorMessage("Vui lòng nhập Email hoặc Tài khoản.");
      setIsSubmitting(false);
      return;
    }

    if (!passwordTrim) {
      setErrorMessage("Vui lòng nhập mật khẩu.");
      setIsSubmitting(false);
      return;
    }

    clearAllSessions();

    // 2.1. NẾU LÀ TÀI KHOẢN ADMIN ĐẶC BIỆT
    if (emailTrim === ADMIN_ACCOUNT.email.toLowerCase()) {
      if (passwordTrim !== ADMIN_ACCOUNT.password) {
        setErrorMessage("Mật khẩu Quản trị viên không chính xác.");
        setIsSubmitting(false);
        return;
      }

      const adminUser = {
        id: "admin-master",
        full_name: "Thầy Nam (Quản Trị TCT)",
        email: ADMIN_ACCOUNT.email,
        role: "admin",
        approval_status: "approved"
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("tct_current_user", JSON.stringify(adminUser));
        localStorage.setItem("edunexus_current_user", JSON.stringify(adminUser));
      }

      setCurrentUser(adminUser);
      setIsSubmitting(false);
      return;
    }

    // 2.2. XÁC THỰC HỌC SINH QUA SUPABASE
    try {
      // Gọi Supabase Auth để kiểm tra mật khẩu học sinh
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailTrim,
        password: passwordTrim
      });

      let studentProfile: any = null;

      if (!authError && authData.user) {
        // Lấy profile từ Supabase theo ID người dùng
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .single();
        studentProfile = profile;
      } else {
        // Dự phòng: Tìm trực tiếp trong bảng profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", emailTrim)
          .single();
        studentProfile = profile;
      }

      // Kiểm tra trạng thái tài khoản
      if (!studentProfile) {
        throw new Error("Tài khoản hoặc mật khẩu không chính xác!");
      }

      if (studentProfile.approval_status === "pending") {
        throw new Error("Tài khoản của bạn đang chờ Ban Giám Khảo xét duyệt!");
      }

      if (studentProfile.approval_status === "rejected") {
        throw new Error("Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ trung tâm!");
      }

      const isOffline = studentProfile.learning_mode === "offline" || studentProfile.study_mode === "offline";
      const finalStudent = {
        ...studentProfile,
        student_code: studentProfile.student_code || generateStudentCode(studentProfile),
        study_mode: isOffline ? "offline" : "online",
        learning_mode: isOffline ? "offline" : "online"
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("tct_current_user", JSON.stringify(finalStudent));
        localStorage.setItem("edunexus_current_user", JSON.stringify(finalStudent));
      }

      setCurrentUser(finalStudent);
    } catch (err: any) {
      setErrorMessage(err.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại!");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. XỬ LÝ ĐĂNG XUẤT HỆ THỐNG
  const handleLogout = () => {
    clearAllSessions();
    setEmailInput("");
    setPasswordInput("");
    setCurrentUser(null);
  };

  // MÀN HÌNH CHỜ BAN ĐẦU
  if (!isMounted) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-[#1D4ED8] rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-500 tracking-wider uppercase">dungtruong.tct</p>
        </div>
      </div>
    );
  }

  // 4. ĐIỀU HƯỚNG GIAO DIỆN THEO ĐÚNG VAI TRÒ
  if (currentUser) {
    if (currentUser.role === "admin" && currentUser.email?.toLowerCase() === ADMIN_ACCOUNT.email.toLowerCase()) {
      return (
        <div className="relative w-full h-full">
          <button
            type="button"
            onClick={handleLogout}
            className="fixed top-3 right-36 z-[100] px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" /> Thoát Admin
          </button>
          <AdminPage />
        </div>
      );
    }

    const isOffline = currentUser.study_mode === "offline" || currentUser.learning_mode === "offline";
    if (isOffline) {
      return <StudentOfflineDashboard initialProfile={currentUser} onLogout={handleLogout} />;
    }

    return <StudentOnlineDashboard initialProfile={currentUser} onLogout={handleLogout} />;
  }

  // 5. GIAO DIỆN ĐĂNG NHẬP CHÍNH THỨC
  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-6 font-sans select-none text-slate-800">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-[0_10px_35px_rgba(0,0,0,0.04)] relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-[#1D4ED8] rounded-2xl mx-auto flex items-center justify-center text-white shadow-sm shadow-blue-600/30 mb-2">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Đăng Nhập dungtruong.tct
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Cổng học tập & thi thử Toán trực tuyến
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 text-left">
              Email / Tài khoản <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                required
                type="text"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="Nhập email hoặc tài khoản..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 text-left">
              Mật khẩu <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                required
                type="password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang vào hệ thống...</span>
              </>
            ) : (
              <>
                <span>Vào không gian học tập</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* NÚT CHUYỂN SANG TRANG ĐĂNG KÝ HỌC VIÊN MỚI */}
        <div className="pt-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500 font-medium">
            Chưa có tài khoản học viên?{" "}
            <Link 
              href="/register" 
              className="font-bold text-[#1D4ED8] hover:underline cursor-pointer"
            >
              Đăng ký xét duyệt ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
