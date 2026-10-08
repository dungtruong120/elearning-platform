"use client";

import React from "react";
import { Video, Plus, Calendar, Clock, Trash2, Search, ArrowUpDown } from "lucide-react";
import ScheduleView from "@/components/student/ScheduleView";
import { STANDARD_SHIFTS } from "@/types";

interface OnlineScheduleTabProps {
  newSessionForm: any;
  setNewSessionForm: (form: any) => void;
  handleCreateOnlineSession: (e: React.FormEvent) => Promise<void>;
  onlineSessions: any[];
  handleDeleteSession: (id: string, title: string) => Promise<void>;
  setIsAddDateModalOpen: (open: boolean) => void;
  setIsAddStudentModalOpen: (open: boolean) => void;
  attendanceSearchText: string;
  setAttendanceSearchText: (txt: string) => void;
  attendanceFilterMode: "all" | "online" | "offline";
  setAttendanceFilterMode: (mode: "all" | "online" | "offline") => void;
  registeredStudents: any[];
  attendanceSortAZ: boolean;
  setAttendanceSortAZ: (fn: (prev: boolean) => boolean) => void;
  sessionDates: string[];
  handleDeleteAttendanceDate: (date: string) => Promise<void>;
  sortedAndFilteredStudents: any[];
  attendanceRecords: any[];
  handleToggleAttendance: (stuId: string, stuName: string, date: string) => void;
}

export default function OnlineScheduleTab({
  newSessionForm,
  setNewSessionForm,
  handleCreateOnlineSession,
  onlineSessions,
  handleDeleteSession,
  setIsAddDateModalOpen,
  setIsAddStudentModalOpen,
  attendanceSearchText,
  setAttendanceSearchText,
  attendanceFilterMode,
  setAttendanceFilterMode,
  registeredStudents,
  attendanceSortAZ,
  setAttendanceSortAZ,
  sessionDates,
  handleDeleteAttendanceDate,
  sortedAndFilteredStudents,
  attendanceRecords,
  handleToggleAttendance
}: OnlineScheduleTabProps) {
  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto text-left">
      <div className="bg-white/90 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 text-[#1D4ED8]">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Link học Online
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Phát link phòng học trực tuyến Zoom / Google Meet & tự do tùy chỉnh khung giờ học
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1D4ED8] text-xs font-bold">
            Zoom / Google Meet
          </span>
        </div>

        <form onSubmit={handleCreateOnlineSession} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Tiêu đề buổi học *</label>
              <input
                required
                type="text"
                value={newSessionForm.title}
                onChange={e => setNewSessionForm({ ...newSessionForm, title: e.target.value })}
                placeholder="VD: Chuyên đề 3: Tích phân & Ứng dụng thực tế"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ngày học (Cột điểm danh) *</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  required
                  value={newSessionForm.isoDate}
                  onChange={e => {
                    const val = e.target.value;
                    const parts = val.split("-");
                    const disp = parts.length === 3 ? parts[2] + "/" + parts[1] : val;
                    setNewSessionForm({ ...newSessionForm, isoDate: val, displayDate: disp });
                  }}
                  className="w-1/2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
                />
                <input
                  type="text"
                  required
                  value={newSessionForm.displayDate}
                  onChange={e => setNewSessionForm({ ...newSessionForm, displayDate: e.target.value })}
                  placeholder="24/09"
                  title="Tên cột hiển thị trên bảng điểm danh"
                  className="w-1/2 px-3 py-2.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs font-black text-[#1D4ED8] outline-none focus:border-[#1D4ED8] focus:bg-white transition text-center"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Khung giờ ca học (Tùy chỉnh tự do) *</label>
              <div className="space-y-1.5">
                <select
                  value={newSessionForm.shiftId}
                  onChange={e => {
                    const shId = e.target.value;
                    if (shId === "custom") {
                      setNewSessionForm({ ...newSessionForm, shiftId: "custom", shiftName: "Ca học" });
                    } else {
                      const sh = STANDARD_SHIFTS.find(s => s.id === shId);
                      if (sh) {
                        setNewSessionForm({ ...newSessionForm, shiftId: shId, shiftName: sh.name, timeSlot: sh.timeSlot });
                      }
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition cursor-pointer"
                >
                  <option value="custom">-- Tự nhập giờ tùy ý (Ví dụ: 21:30 - 23:00) --</option>
                  {STANDARD_SHIFTS.map(sh => (
                    <option key={sh.id} value={sh.id}>{sh.name} ({sh.timeSlot})</option>
                  ))}
                </select>
                <input
                  required
                  type="text"
                  value={newSessionForm.timeSlot}
                  onChange={e => setNewSessionForm({ ...newSessionForm, timeSlot: e.target.value })}
                  placeholder="21:30 - 23:00"
                  className="w-full px-3 py-2 bg-white border border-blue-200 rounded-xl text-xs font-black text-[#1D4ED8] outline-none focus:border-[#1D4ED8] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Đối tượng nhận link *</label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setNewSessionForm({ ...newSessionForm, audience: "online" })}
                  className={
                    "py-1.5 rounded-lg text-[11px] font-black transition " + 
                    (newSessionForm.audience === "online" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900")
                  }
                >
                  Lớp Online
                </button>
                <button
                  type="button"
                  onClick={() => setNewSessionForm({ ...newSessionForm, audience: "offline" })}
                  className={
                    "py-1.5 rounded-lg text-[11px] font-black transition " + 
                    (newSessionForm.audience === "offline" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900")
                  }
                >
                  Lớp Offline
                </button>
                <button
                  type="button"
                  onClick={() => setNewSessionForm({ ...newSessionForm, audience: "all" })}
                  className={
                    "py-1.5 rounded-lg text-[11px] font-black transition " + 
                    (newSessionForm.audience === "all" ? "bg-white text-[#1D4ED8] shadow-sm" : "text-slate-600 hover:text-slate-900")
                  }
                >
                  Cả hai
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Link phòng học (Zoom/Meet URL) *</label>
              <input
                required
                type="url"
                value={newSessionForm.meetingUrl}
                onChange={e => setNewSessionForm({ ...newSessionForm, meetingUrl: e.target.value })}
                placeholder="https://zoom.us/j/... hoặc https://meet.google.com/..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Danh sách Link Ảnh Hướng dẫn vào lớp (Mỗi link 1 dòng)
            </label>
            <textarea
              rows={2}
              value={newSessionForm.guideImagesText}
              onChange={e => setNewSessionForm({ ...newSessionForm, guideImagesText: e.target.value })}
              placeholder="https://example.com/huong-dan-zoom-1.png&#10;https://example.com/huong-dan-zoom-2.png"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 outline-none focus:border-[#1D4ED8] focus:bg-white transition resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Phát Link Buổi Học
            </button>
          </div>
        </form>
      </div>

      {onlineSessions.length > 0 && (
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Danh sách các ca học đã phát ({onlineSessions.length} ca)</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-semibold">
              * Nhấn vào biểu tượng thùng rác để xóa ca học nếu phát nhầm
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {onlineSessions.map((sess: any) => {
              const tMode = (sess.target_mode || sess.audience || "all").toLowerCase();
              const isAll = tMode === "all";
              const isOnline = tMode === "online";

              return (
                <div key={sess.id} className="p-3.5 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col justify-between gap-3 group">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="text-xs font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                        {sess.date || "Ca học"}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className={
                          "px-2 py-0.5 rounded text-[9px] font-black uppercase " + 
                          (isAll 
                            ? "bg-blue-100 text-[#1D4ED8] border border-blue-200" 
                            : isOnline 
                            ? "bg-indigo-100 text-indigo-700 border border-indigo-200" 
                            : "bg-emerald-100 text-emerald-700 border border-emerald-200")
                        }>
                          {isAll ? "Cả 2" : isOnline ? "Online" : "Offline"}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSession(sess.id, sess.title)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa ca học này khỏi hệ thống"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <h5 className="font-bold text-xs text-slate-800 line-clamp-1 leading-snug">
                      {sess.title}
                    </h5>
                    <p className="text-[11px] text-slate-500 font-semibold mt-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> {sess.timeSlot}
                    </p>
                  </div>

                  {sess.meetingUrl && (
                    <a 
                      href={sess.meetingUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-[10px] text-blue-600 font-bold hover:underline truncate block"
                    >
                      🔗 {sess.meetingUrl}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-slate-50 to-blue-50/40 border-b border-slate-200 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
                  BẢNG ĐIỂM DANH TRỰC TUYẾN (GOOGLE SHEETS SPREADSHEET GRID)
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddDateModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-sm transition-all cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" /> + Thêm ngày học
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddStudentModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm học sinh
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                • Tự động tích dấu <strong className="text-emerald-600 font-bold">✓</strong> khi học sinh bấm 'Vào học ngay' • Click ô để điểm danh Có mặt / Vắng • Buổi Online chỉ tính chuyên cần cho học sinh Online.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-slate-600 shrink-0">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-emerald-500 rounded-xs" /> = Có mặt</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 bg-slate-300 rounded-xs" /> = Vắng</span>
              <span className="flex items-center gap-1"><span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded border" /> = Miễn</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200/70">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={attendanceSearchText}
                  onChange={e => setAttendanceSearchText(e.target.value)}
                  placeholder="Tìm nhanh theo tên học sinh..."
                  className="pl-8 pr-4 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#1D4ED8] w-56 transition"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setAttendanceFilterMode("all")}
                  className={
                    "px-3 py-1 rounded-lg text-xs font-bold transition " + 
                    (attendanceFilterMode === "all" ? "bg-white text-[#1D4ED8] shadow-xs" : "text-slate-600 hover:text-slate-900")
                  }
                >
                  Tất cả ({registeredStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceFilterMode("online")}
                  className={
                    "px-3 py-1 rounded-lg text-xs font-bold transition " + 
                    (attendanceFilterMode === "online" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900")
                  }
                >
                  Lớp Online ({registeredStudents.filter(s => s.learning_mode === "online" || s.study_mode === "online").length})
                </button>
                <button
                  type="button"
                  onClick={() => setAttendanceFilterMode("offline")}
                  className={
                    "px-3 py-1 rounded-lg text-xs font-bold transition " + 
                    (attendanceFilterMode === "offline" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900")
                  }
                >
                  Lớp Offline ({registeredStudents.filter(s => s.learning_mode === "offline" || s.study_mode === "offline").length})
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setAttendanceSortAZ(prev => !prev)}
              className={
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-black transition cursor-pointer " + 
                (attendanceSortAZ ? "bg-blue-50 border-blue-400 text-[#1D4ED8] shadow-2xs" : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50")
              }
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Sắp xếp: {attendanceSortAZ ? "Tên (A → Z) ✓" : "Mặc định"}</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[550px] custom-scrollbar">
          <table className="w-full text-center text-xs border-collapse select-none">
            <thead>
              <tr className="bg-slate-100/90 text-slate-700 font-black text-[11px] uppercase tracking-wider sticky top-0 z-20 border-b border-slate-300">
                <th className="py-3.5 px-3 border-r border-slate-300 bg-slate-200/80 w-24">Trạng thái</th>
                <th className="py-3.5 px-2 border-r border-slate-300 bg-slate-200/80 w-12">STT</th>
                <th className="py-3.5 px-4 border-r border-slate-300 bg-slate-200/80 text-left min-w-[140px]">Họ đệm</th>
                <th className="py-3.5 px-3 border-r border-slate-300 bg-slate-200/80 text-left min-w-[90px]">Tên</th>
                <th className="py-3.5 px-2 border-r border-slate-300 bg-slate-200/80 text-center w-20">Lớp</th>

                {sessionDates.map(dateCol => {
                  const sessMeta = onlineSessions.find(s => s.date === dateCol);
                  const aud = sessMeta?.audience || "all";
                  return (
                    <th key={dateCol} className="py-2.5 px-2 border-r border-slate-300 bg-blue-100/70 text-[#1D4ED8] min-w-[75px] relative group">
                      <div className="flex items-center justify-between gap-1 px-1">
                        <span className="font-black text-xs">{dateCol}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAttendanceDate(dateCol);
                          }}
                          title={"Xóa cột ngày " + dateCol}
                          className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 transition p-0.5 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className={
                        "inline-block px-1.5 py-0.2 rounded text-[8px] font-extrabold uppercase " + 
                        (aud === "online" ? "bg-indigo-200 text-indigo-800" : aud === "offline" ? "bg-emerald-200 text-emerald-800" : "bg-blue-200 text-blue-900")
                      }>
                        {aud === "online" ? "On" : aud === "offline" ? "Off" : "Full"}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedAndFilteredStudents.map((stu, sIdx) => {
                const nameParts = (stu.full_name || "").trim().split(" ");
                const firstName = nameParts.pop() || "";
                const lastName = nameParts.join(" ");

                return (
                  <tr key={stu.id || sIdx} className="hover:bg-blue-50/30 transition-colors bg-white">
                    <td className="py-2.5 px-3 border-r border-slate-200 font-bold">
                      <span className={
                        "inline-block px-2 py-1 rounded-md text-[10px] uppercase font-black tracking-wider " + 
                        (stu.approval_status === "approved" 
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                          : "bg-rose-100 text-rose-800 border border-rose-200")
                      }>
                        {stu.approval_status === "approved" ? "Học" : "Nghỉ"}
                      </span>
                    </td>

                    <td className="py-2.5 px-2 border-r border-slate-200 text-slate-400 font-bold">
                      {sIdx + 1}
                    </td>

                    <td className="py-2.5 px-4 border-r border-slate-200 text-left font-semibold text-slate-800">
                      {lastName}
                    </td>

                    <td className="py-2.5 px-3 border-r border-slate-200 text-left font-extrabold text-[#1D4ED8]">
                      {firstName}
                    </td>

                    <td className="py-2.5 px-2 border-r border-slate-200 text-center">
                      <span className={
                        "px-1.5 py-0.5 rounded text-[9px] font-black uppercase " + 
                        (stu.learning_mode === "online" || stu.study_mode === "online" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200")
                      }>
                        {stu.learning_mode === "online" || stu.study_mode === "online" ? "Online" : "Offline"}
                      </span>
                    </td>

                    {sessionDates.map(dateCol => {
                      const sessMeta = onlineSessions.find(s => s.date === dateCol);
                      const aud = sessMeta?.audience || "all";
                      const isOnlineStu = stu.learning_mode === "online" || stu.study_mode === "online";
                      
                      const isExempt = (aud === "online" && !isOnlineStu) ||
                                       (aud === "offline" && isOnlineStu);

                      const attRecord = attendanceRecords.find(
                        a => (a.studentId === stu.id || a.studentId === stu.username || a.studentName === stu.full_name) && a.sessionDate === dateCol && (a.status === "present" || a.status === "auto_present")
                      );
                      const isAttended = Boolean(attRecord);

                      if (isExempt) {
                        return (
                          <td
                            key={dateCol}
                            title={"Miễn điểm danh: Buổi học này chỉ áp dụng cho lớp " + (aud === "online" ? "Online" : "Offline")}
                            className="py-2.5 px-2 border-r border-slate-200 bg-slate-50/40 text-slate-300 font-medium text-[11px] italic"
                          >
                            Miễn
                          </td>
                        );
                      }

                      return (
                        <td
                          key={dateCol}
                          onClick={() => handleToggleAttendance(stu.id, stu.full_name, dateCol)}
                          title={"Click để bật/tắt điểm danh " + stu.full_name + " (" + dateCol + ")"}
                          className={
                            "py-2.5 px-2 border-r border-slate-200 font-black text-sm cursor-pointer transition-colors " + 
                            (isAttended ? "bg-emerald-50/80 text-emerald-600 hover:bg-emerald-100" : "text-slate-300 hover:bg-slate-100/70")
                          }
                        >
                          {isAttended ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 shadow-2xs">
                              ✓
                            </span>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pt-2">
        <ScheduleView profile={null} mode="all" isAdmin={true} />
      </div>
    </div>
  );
}
