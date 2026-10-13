"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { 
  GraduationCap, Mail, Lock, ArrowRight, AlertCircle, 
  Loader2, CheckCircle2 
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      // 1. Đăng nhập qua Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (authError) {
        throw new Error(authError.message === "Invalid login credentials" 
          ? "Email hoặc mật khẩu không chính xác!" 
          : authError.message
        );
      }

      const user = authData.user;
      if (!user) throw new Error("Không thể xác thực thông tin tài khoản!");

      // 2. Tra cứu trực tiếp từ Database Supabase (Nguồn chuẩn xác thực nhất)
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      let foundStudent = profileData;

      // Fallback tra cứu qua email nếu id không khớp
      if (!foundStudent) {
        const { data: profileByEmail } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", cleanEmail)
          .maybeSingle();
        foundStudent = profileByEmail;
      }

      // Fallback tra cứu trong localStorage nếu mạng offline
      if (!foundStudent && typeof window !== "undefined") {
        try {
          const rawLocal = localStorage.getItem("edunexus_registered_students");
          if (rawLocal) {
            const list = JSON.parse(rawLocal);
            foundStudent = list.find((s: any) => 
              s.id === user.id || (s.email && s.email.toLowerCase() === cleanEmail)
            );
          }
        } catch (e) {}
      }

      // NẾU LÀ TÀI KHOẢN ADMIN THÌ CHO PHÉP VÀO THẲNG
      if (foundStudent?.role === "admin" || cleanEmail.includes("admin")) {
        localStorage.setItem("edunexus_current_user", JSON.stringify(foundStudent || { id: user.id, role: "admin", email: cleanEmail }));
        router.push("/admin");
        return;
      }

      // 3. KIỂM TRA ĐIỀU KIỆN XÉT DUYỆT CỦA HỌC SINH (HỖ TRỢ ĐỒNG BỘ CẢ 3 TRƯỜNG DỮ LIỆU)
      if (foundStudent) {
        const studentStatus = foundStudent.approval_status || foundStudent.status;
        const isStudentApproved = studentStatus === "approved" || foundStudent.is_approved === true;

        if (!isStudentApproved && studentStatus !== "rejected") {
          setErrorMsg("Tài khoản của bạn đang được xét duyệt. Vui lòng liên hệ quản trị viên.");
          setLoading(false);
          return;
        }

        if (studentStatus === "rejected") {
          setErrorMsg("Tài khoản của bạn đã bị từ chối hoặc khóa truy cập.");
          setLoading(false);
          return;
        }

        // Lưu thông tin học sinh hiện tại vào localStorage
        localStorage.setItem("edunexus_current_user", JSON.stringify(foundStudent));
        localStorage.setItem("tct_current_user", JSON.stringify(foundStudent));
      } else {
        // Nếu user tồn tại trong Auth nhưng chưa có profile, ghi nhận cơ bản
        const basicUser = {
          id: user.id,
          email: cleanEmail,
          full_name: user.user_metadata?.full_name || "Học sinh",
          role: "student",
          approval_status: "pending",
        };
        localStorage.setItem("edunexus_current_user", JSON.stringify(basicUser));
      }

      router.push("/");
    } catch (err: any) {
      setErrorMsg(err.message || "Đăng nhập không thành công. Vui lòng thử lại!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-6 font-sans select-none text-slate-800">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-10 shadow-xl space-y-6 animate-in zoom-in-95 duration-200 text-left">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-[#1D4ED8] rounded-2xl mx-auto flex items-center justify-center text-white shadow-sm shadow-blue-600/30 mb-2">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Đăng Nhập TCT Study
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Hệ thống học tập & thi thử trực tuyến
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Email đăng nhập <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                required
                type="email"
                placeholder="email@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Mật khẩu <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                required
                type="password"
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 pt-3"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xác thực...</span>
              </>
            ) : (
              <>
                <span>Đăng nhập vào hệ thống</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500 font-medium">
            Chưa có tài khoản?{" "}
            <Link href="/register" className="font-bold text-[#1D4ED8] hover:underline cursor-pointer">
              Đăng ký xét duyệt ngay
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
