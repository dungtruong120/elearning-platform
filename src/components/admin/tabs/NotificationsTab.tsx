"use client";

import React from "react";
import { Send, List, Trash2 } from "lucide-react";

interface NotificationsTabProps {
  notifTitle: string;
  setNotifTitle: (t: string) => void;
  notifContent: string;
  setNotifContent: (c: string) => void;
  notifType: "teacher" | "urgent" | "exam";
  setNotifType: (t: "teacher" | "urgent" | "exam") => void;
  sysNotifications: any[];
  handleSendNotification: (e: React.FormEvent) => Promise<void>;
  handleDeleteNotification: (id: string) => Promise<void>;
}

export default function NotificationsTab({
  notifTitle,
  setNotifTitle,
  notifContent,
  setNotifContent,
  notifType,
  setNotifType,
  sysNotifications,
  handleSendNotification,
  handleDeleteNotification
}: NotificationsTabProps) {
  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-300 text-left">
      <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col h-fit">
        <h3 className="font-extrabold text-slate-900 text-[15px] mb-5 flex items-center gap-2">
          <Send className="w-4 h-4 text-[#1D4ED8]" /> Soạn thông báo mới
        </h3>
        <form onSubmit={handleSendNotification} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Tiêu đề thông báo</label>
            <input 
              type="text" 
              value={notifTitle} 
              onChange={e => setNotifTitle(e.target.value)} 
              required 
              placeholder="VD: Lịch học tuần này..." 
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] outline-none" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Nội dung chi tiết</label>
            <textarea 
              rows={4} 
              value={notifContent} 
              onChange={e => setNotifContent(e.target.value)} 
              required 
              placeholder="Nội dung gửi cho học sinh..." 
              className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8] outline-none resize-none custom-scrollbar" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Phân loại</label>
            <select 
              value={notifType} 
              onChange={e => setNotifType(e.target.value as any)} 
              className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:border-[#1D4ED8] outline-none bg-white cursor-pointer"
            >
              <option value="teacher">Giáo viên</option>
              <option value="urgent">Khẩn cấp / Hạn chót</option>
              <option value="exam">Nhắc nhở bài kiểm tra</option>
            </select>
          </div>
          <button 
            type="submit" 
            className="w-full mt-4 py-3 bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-[13px] rounded-2xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" /> Gửi thông báo tới toàn bộ học sinh
          </button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-[24px] p-6 shadow-sm flex flex-col h-[calc(100vh-150px)]">
        <h3 className="font-extrabold text-slate-900 text-[15px] mb-5 flex items-center gap-2 shrink-0">
          <List className="w-4 h-4 text-[#1D4ED8]" /> Lịch sử gửi ({(sysNotifications || []).length})
        </h3>
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
          {(!sysNotifications || sysNotifications.length === 0) ? (
            <div className="py-10 text-center text-slate-400 text-sm font-medium italic">
              Chưa có thông báo nào được phát đi.
            </div>
          ) : (
            sysNotifications.map(notif => (
              <div key={notif.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl relative group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={
                      "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest " + 
                      (notif.type === 'urgent' ? 'bg-rose-100 text-rose-700' : notif.type === 'exam' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-[#1D4ED8]')
                    }>
                      {notif.type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(notif.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => handleDeleteNotification(notif.id)} 
                    className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h4 className="font-bold text-slate-800 text-[13px]">{notif.title}</h4>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{notif.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
