"use client";

import React from "react";
import { Search, Globe, Users, Check, Trash2 } from "lucide-react";

interface StudentsTabProps {
  registeredStudents: any[];
  studentFilter: "all" | "pending" | "approved" | "rejected";
  setStudentFilter: (f: "all" | "pending" | "approved" | "rejected") => void;
  studentSearch: string;
  setStudentSearch: (s: string) => void;
  handleUpdateStudentStatus: (studentId: string, status: "approved" | "rejected") => Promise<void>;
  handleDeleteStudent: (studentId: string) => Promise<void>;
}

export default function StudentsTab({
  registeredStudents,
  studentFilter,
  setStudentFilter,
  studentSearch,
  setStudentSearch,
  handleUpdateStudentStatus,
  handleDeleteStudent
}: StudentsTabProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto text-left">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white/90 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tổng học viên</span>
          <span className="text-2xl font-black text-slate-900 mt-1 block">{registeredStudents.length}</span>
        </div>
        <div className="bg-white/90 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider block">Học sinh Online</span>
          <span className="text-2xl font-black text-[#1D4ED8] mt-1 block">
            {registeredStudents.filter(s => s.learning_mode === "online" || s.study_mode === "online").length}
          </span>
        </div>
        <div className="bg-white/90 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[11px] font-bold text-purple-500 uppercase tracking-wider block">Học sinh Offline</span>
          <span className="text-2xl font-black text-purple-700 mt-1 block">
            {registeredStudents.filter(s => s.learning_mode === "offline" || s.study_mode === "offline").length}
          </span>
        </div>
        <div className="bg-white/90 backdrop-blur-xl p-5 rounded-3xl border border-amber-200 shadow-xs bg-amber-50/40">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Chờ xét duyệt</span>
          <span className="text-2xl font-black text-amber-600 mt-1 block">
            {registeredStudents.filter(s => s.approval_status === "pending").length}
          </span>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-xl p-4 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "Tất cả" },
            { key: "pending", label: "Chờ duyệt" },
            { key: "approved", label: "Đã duyệt" },
            { key: "rejected", label: "Bị khóa / Từ chối" }
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStudentFilter(tab.key as any)}
              className={
                "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer " + 
                (studentFilter === tab.key
                  ? "bg-[#1D4ED8] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200")
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={studentSearch}
            onChange={e => setStudentSearch(e.target.value)}
            placeholder="Tìm tên, email, trường..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] transition"
          />
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-2xl rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1D4ED8] text-white text-[11px] uppercase tracking-wider font-black">
              <tr>
                <th className="py-4 px-4 text-center w-12">STT</th>
                <th className="py-4 px-5">Họ và tên</th>
                <th className="py-4 px-5">Liên hệ</th>
                <th className="py-4 px-4">Trường & Khối</th>
                <th className="py-4 px-4 text-center">Hình thức</th>
                <th className="py-4 px-4 text-center">Trạng thái</th>
                <th className="py-4 px-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {registeredStudents
                .filter(s => studentFilter === "all" || s.approval_status === studentFilter)
                .filter(s => {
                  const q = studentSearch.toLowerCase();
                  return s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.school?.toLowerCase().includes(q);
                })
                .map((student, idx) => {
                  const isPending = student.approval_status === "pending";
                  const isApproved = student.approval_status === "approved";
                  return (
                    <tr key={student.id || idx} className="hover:bg-slate-50/60 transition-colors bg-white/70">
                      <td className="py-4 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-4 px-5 font-bold text-slate-800">
                        <div>{student.full_name}</div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                          ĐK: {new Date(student.created_at || Date.now()).toLocaleDateString("vi-VN")}
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-semibold text-slate-700">{student.email}</div>
                        <div className="text-[10px] text-slate-400">{student.phone || "--"}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-medium text-slate-800">{student.school}</div>
                        <div className="text-[10px] text-blue-600 font-bold">{student.grade}</div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {student.learning_mode === "online" || student.study_mode === "online" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-[#1D4ED8] font-bold text-[10px] uppercase rounded-lg border border-blue-100">
                            <Globe className="w-3 h-3" /> Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 text-purple-700 font-bold text-[10px] uppercase rounded-lg border border-purple-100">
                            <Users className="w-3 h-3" /> Offline
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        {isPending ? (
                          <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-extrabold text-[10px] uppercase rounded-lg border border-amber-200 animate-pulse">
                            Chờ duyệt
                          </span>
                        ) : isApproved ? (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-[10px] uppercase rounded-lg border border-emerald-200">
                            Đã duyệt
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-rose-50 text-rose-700 font-extrabold text-[10px] uppercase rounded-lg border border-rose-200">
                            Đã khóa
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStudentStatus(student.id, "approved")}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" /> Duyệt
                            </button>
                          )}
                          {isApproved && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStudentStatus(student.id, "rejected")}
                              className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl text-[11px] font-bold transition cursor-pointer"
                              title="Khóa quyền vào học"
                            >
                              Khóa
                            </button>
                          )}
                          {!isApproved && !isPending && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStudentStatus(student.id, "approved")}
                              className="px-2.5 py-1.5 bg-blue-100 hover:bg-blue-200 text-[#1D4ED8] rounded-xl text-[11px] font-bold transition cursor-pointer"
                              title="Mở khóa lại"
                            >
                              Mở lại
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteStudent(student.id)}
                            className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Xóa học sinh vĩnh viễn"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
