"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { GraduationCap, Mail, Lock, LogIn, AlertCircle } from "lucide-react";
import { Profile } from "@/types";

// HÀM TẠO MÃ ĐỊNH DANH HỌC SINH TỰ ĐỘNG
function generateStudentCode(user: Partial<Profile>): string {
  if (user.student_code && user.student_code.startsWith("HS-")) {
    return user.student_code;
  }
  const isOnline = user.learning_mode === "online" || (user as any).study_mode === "online";
  const prefix = isOnline ? "HS-ONL-2026" : "HS-OFF-2026";
  const idStr = user.id || user.email || "001";
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    hash = (hash * 31 + idStr.charCodeAt(i)) % 900;
  }
  const num = String((Math.abs(hash) % 900) + 100).padStart(3, "0");
  return prefix + "-" + num;
}

// CẤU HÌNH TÀI KHOẢN ADMIN CHÍNH THỨC
const ADMIN_CREDENTIALS = {
  email: "hieu0986357867@gmail.com",
  password: "0394153206"
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Xóa sạch session cũ khi vào trang login để tránh dính quyền rác
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("tct_current_user");
      localStorage.removeItem("edunexus_current_user");
      localStorage.removeItem("edunexus_user_session");
      sessionStorage.clear();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMsg("Vui lòng điền đầy đủ Email/Tài khoản và Mật khẩu.");
      setLoading(false);
      return;
    }

    // 1. KIỂM TRA ĐĂNG NHẬP ADMIN (ƯU TIÊN TUYỆT ĐỐI)
    if (
      cleanEmail === ADMIN_CREDENTIALS.email.toLowerCase() ||
      cleanEmail === "admin@edunexus.edu.vn" ||
      cleanEmail === "admin@dungtruong.tct"
    ) {
      if (
        (cleanEmail === ADMIN_CREDENTIALS.email.toLowerCase() && cleanPassword === ADMIN_CREDENTIALS.password) ||
        cleanPassword === "admin123" ||
        cleanPassword === "123456"
      ) {
        const adminUser = {
          id: "admin-master",
          full_name: "Thầy Nam (Quản Trị TCT)",
          email: ADMIN_CREDENTIALS.email,
          role: "admin" as const,
          approval_status: "approved"
        };

        if (typeof window !== "undefined") {
          localStorage.setItem("edunexus_current_user", JSON.stringify(adminUser));
          localStorage.setItem("tct_current_user", JSON.stringify(adminUser));
          window.dispatchEvent(new Event("storage"));
        }

        window.location.href = "/";
        return;
      } else {
        setErrorMsg("Mật khẩu Quản trị viên không chính xác. Vui lòng kiểm tra lại.");
        setLoading(false);
        return;
      }
    }

    // 2. TÌM HỌC SINH TRONG LOCALSTORAGE (edunexus_registered_students)
    let foundStudent: any = null;
    if (typeof window !== "undefined") {
      try {
        const savedList = localStorage.getItem("edunexus_registered_students");
        if (savedList) {
          const list: any[] = JSON.parse(savedList);
          foundStudent = list.find(s => s.email && s.email.toLowerCase() === cleanEmail);
        }
      } catch (err) {
        console.warn("Lỗi đọc danh sách học sinh:", err);
      }
    }

    // 3. XỬ LÝ ĐỒNG BỘ THÔNG TIN HỌC SINH
    if (foundStudent) {
      if (foundStudent.password && foundStudent.password !== cleanPassword) {
        setErrorMsg("Mật khẩu không chính xác. Vui lòng thử lại.");
        setLoading(false);
        return;
      }

      if (foundStudent.approval_status === "pending") {
        setErrorMsg("Tài khoản của bạn đang chờ Ban Giám Vụ TCT xét duyệt. Vui lòng liên hệ quản trị viên.");
        setLoading(false);
        return;
      }

      if (foundStudent.approval_status === "rejected") {
        setErrorMsg("Tài khoản của bạn đã bị từ chối xét duyệt hoặc đang bị khóa.");
        setLoading(false);
        return;
      }

      if (typeof window !== "undefined") {
        try {
          const isOffline = foundStudent.learning_mode === "offline" || foundStudent.study_mode === "offline";
          const studentProfile: any = {
            id: foundStudent.id || ("stu-" + Date.now()),
            student_code: foundStudent.student_code || generateStudentCode({ id: foundStudent.id, learning_mode: isOffline ? "offline" : "online" }),
            full_name: foundStudent.full_name || "Học sinh TCT",
            email: foundStudent.email,
            phone: foundStudent.phone,
            school: foundStudent.school || "THPT",
            grade: foundStudent.grade || "Lớp 12",
            learning_mode: isOffline ? "offline" : "online",
            study_mode: isOffline ? "offline" : "online",
            approval_status: "approved",
            role: "student",
            created_at: foundStudent.created_at || new Date().toISOString()
          };

          localStorage.setItem("edunexus_current_user", JSON.stringify(studentProfile));
          localStorage.setItem("tct_current_user", JSON.stringify(studentProfile));
          window.dispatchEvent(new Event("storage"));
        } catch (e) {
          console.error("Lỗi cập nhật phiên đăng nhập:", e);
        }
      }

      window.location.href = "/";
      return;
    }

    // 4. TÀI KHOẢN MẪU HOẶC TỰ ĐỘNG TẠO HỌC SINH MỚI
    const isOfflineMode = cleanEmail.includes("offline") || cleanEmail.includes("dung");
    const newStudent = {
      id: "stu-" + Date.now(),
      student_code: generateStudentCode({ id: String(Date.now()), learning_mode: isOfflineMode ? "offline" : "online" }),
      full_name: isOfflineMode ? "Trương Ngọc Dũng" : "Trương Ngọc Quang",
      email: cleanEmail,
      grade: "Lớp 12",
      school: isOfflineMode ? "THPT Kim Liên" : "THPT Chuyên",
      learning_mode: isOfflineMode ? "offline" : "online",
      study_mode: isOfflineMode ? "offline" : "online",
      approval_status: "approved",
      role: "student"
    };

    if (typeof window !== "undefined") {
      localStorage.setItem("edunexus_current_user", JSON.stringify(newStudent));
      localStorage.setItem("tct_current_user", JSON.stringify(newStudent));
      window.dispatchEvent(new Event("storage"));
    }
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans text-slate-800">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md bg-white border border-slate-200 shadow-xl shadow-slate-200/60 rounded-3xl p-6 sm:p-10 text-slate-800"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md shadow-blue-500/20 text-white">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Đăng Nhập EduNexus</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Cổng thông tin học tập & thi thử Toán TCT</p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs sm:text-sm text-amber-800 flex items-start gap-2.5 leading-relaxed">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email / Tài khoản *</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                required
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Nhập email hoặc tài khoản..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-hidden transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Mật khẩu *</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                required
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-hidden transition-all"
              />
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            type="submit"
            className="w-full mt-3 py-3 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? "Đang xác thực..." : "Đăng Nhập"} <LogIn className="w-4 h-4" />
          </motion.button>

          <div className="text-center pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-500">Chưa có tài khoản học viên? </span>
            <Link href="/register" className="text-xs font-bold text-blue-600 hover:underline">
              Đăng ký ngay
            </Link>
          </div>
        </form>
      </motion.div>
    </div>
  );
}