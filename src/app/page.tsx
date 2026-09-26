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

// DANH SÁCH TÀI KHOẢN MẪU CHUẨN XÁC VAI TRÒ
const DEFAULT_ACCOUNTS = [
  {
    id: "admin-master",
    email: "hieu0986357867@gmail.com",
    full_name: "Thầy Nam (Quản Trị TCT)",
    role: "admin" as const,
    grade: "Admin",
    school: "Hệ thống TCT",
    study_mode: "all",
    learning_mode: "all",
    approval_status: "approved"
  },
  {
    id: "stu-online-1",
    email: "quang.truong@gmail.com",
    student_code: "HS-ONL-2026-081",
    full_name: "Trương Ngọc Quang",
    role: "student" as const,
    grade: "Lớp 12",
    school: "THPT Chuyên",
    study_mode: "online",
    learning_mode: "online",
    approval_status: "approved"
  },
  {
    id: "stu-offline-1",
    email: "dung.truong@gmail.com",
    student_code: "HS-OFF-2026-042",
    full_name: "Trương Ngọc Dũng",
    role: "student" as const,
    grade: "Lớp 12",
    school: "THPT Kim Liên",
    study_mode: "offline",
    learning_mode: "offline",
    approval_status: "approved"
  }
];

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
    try {
      localStorage.removeItem("tct_current_user");
      localStorage.removeItem("edunexus_current_user");
      localStorage.removeItem("edunexus_user_session");
      sessionStorage.clear();
      supabase.auth.signOut();
    } catch (e) {
      console.error("Lỗi dọn session:", e);
    }
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
          }

          if (parsed.role === "student" && !parsed.student_code) {
            parsed.student_code = generateStudentCode(parsed);
          }

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

    // 2.1. NẾU LÀ TÀI KHOẢN ADMIN
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

    // 2.2. KIỂM TRA TÀI KHOẢN HỌC SINH MẪU CỐ ĐỊNH TRƯỚC
    let matchedAccount: any = DEFAULT_ACCOUNTS.find(
      acc => acc.role === "student" && acc.email.toLowerCase() === emailTrim
    );

    // 2.3. NẾU KHÔNG PHẢI TÀI KHOẢN MẪU -> TRUY VẤN SUPABASE CHUẨN XÁC
    if (!matchedAccount) {
      try {
        // Thử đăng nhập qua Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: emailTrim,
          password: passwordTrim
        });

        let profileData: any = null;

        if (!authError && authData?.user) {
          const { data: p } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", authData.user.id)
            .maybeSingle();
          profileData = p;
        }

        // Dự phòng truy vấn trực tiếp bảng profiles theo email
        if (!profileData) {
          const { data: pByEmail } = await supabase
            .from("profiles")
            .select("*")
            .eq("email", emailTrim)
            .maybeSingle();
          profileData = pByEmail;
        }

        if (profileData) {
          if (profileData.approval_status === "pending") {
            setErrorMessage("Tài khoản của bạn đang chờ Ban Giám Khảo xét duyệt!");
            setIsSubmitting(false);
            return;
          }

          if (profileData.approval_status === "rejected") {
            setErrorMessage("Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ trung tâm!");
            setIsSubmitting(false);
            return;
          }

          const rawMode = String(profileData.learning_mode || profileData.study_mode || "online").toLowerCase().trim();
          const isOnline = rawMode !== "offline";

          matchedAccount = {
            id: profileData.id,
            student_code: profileData.student_code || generateStudentCode({ id: profileData.id, learning_mode: isOnline ? "online" : "offline" }),
            full_name: profileData.full_name || "Học sinh TCT",
            email: profileData.email,
            grade: profileData.grade || "Lớp 12",
            school: profileData.school || "THPT",
            role: "student",
            study_mode: isOnline ? "online" : "offline",
            learning_mode: isOnline ? "online" : "offline",
            approval_status: profileData.approval_status || "approved"
          };
        }
      } catch (err: any) {
        console.warn("Lỗi kiểm tra Supabase:", err);
      }
    }

    // 2.4. KIỂM TRA TRONG LOCALSTORAGE
    if (!matchedAccount && typeof window !== "undefined") {
      try {
        const registered = localStorage.getItem("edunexus_registered_students");
        if (registered) {
          const list: any[] = JSON.parse(registered);
          const found = list.find(
            s =>
              (s.email && s.email.toLowerCase() === emailTrim) ||
              (s.full_name && s.full_name.toLowerCase() === emailTrim)
          );
          if (found) {
            const isOffline = found.learning_mode === "offline" || found.study_mode === "offline";
            matchedAccount = {
              id: found.id || ("stu-" + Date.now()),
              student_code: found.student_code || generateStudentCode({ id: found.id, learning_mode: isOffline ? "offline" : "online" }),
              full_name: found.full_name || "Học sinh TCT",
              email: found.email || emailTrim,
              grade: found.grade || "Lớp 12",
              school: found.school || "THPT",
              role: "student",
              study_mode: isOffline ? "offline" : "online",
              learning_mode: isOffline ? "offline" : "online",
              approval_status: found.approval_status || "approved"
            };
          }
        }
      } catch (err) {}
    }

    // 2.5. NẾU HOÀN TOÀN KHÔNG TÌM THẤY TÀI KHOẢN
    if (!matchedAccount) {
      setErrorMessage("Tài khoản hoặc mật khẩu không chính xác!");
      setIsSubmitting(false);
      return;
    }

    if (!matchedAccount.student_code && matchedAccount.role === "student") {
      matchedAccount.student_code = generateStudentCode(matchedAccount);
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("tct_current_user", JSON.stringify(matchedAccount));
      localStorage.setItem("edunexus_current_user", JSON.stringify(matchedAccount));
    }

    setCurrentUser(matchedAccount);
    setIsSubmitting(false);
  };

  // 3. XỬ LÝ ĐĂNG XUẤT HỆ THỐNG DỨT ĐIỂM
  const handleLogout = () => {
    clearAllSessions();
    setCurrentUser(null);
    setEmailInput("");
    setPasswordInput("");
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
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

  // 4. ĐIỀU HƯỚNG GIAO DIỆN THEO ĐÚNG VAI TRÒ & PHÂN HỆ
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

    // Chuẩn hóa kiểm tra: chỉ khi ghi rõ ràng 'offline' thì mới vào OfflineDashboard
    const userMode = String(currentUser.learning_mode || currentUser.study_mode || "").toLowerCase().trim();
    if (userMode === "offline") {
      return <StudentOfflineDashboard initialProfile={currentUser} onLogout={handleLogout} />;
    }

    // Mặc định tất cả học sinh Online (hoặc học sinh chưa xác định) vào StudentOnlineDashboard
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
