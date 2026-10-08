"use client";

import React, { useMemo } from "react";
import { Trophy, Loader2 } from "lucide-react";

interface AnalyticsTabProps {
  analyticsData: any[];
  analyticsModeFilter: "all" | "online" | "offline";
  setAnalyticsModeFilter: (filter: "all" | "online" | "offline") => void;
  rankingScope: "lesson" | "chapter" | "course";
  setRankingScope: (scope: "lesson" | "chapter" | "course") => void;
  selectedChapterId: string;
  setSelectedChapterId: (id: string) => void;
  selectedLessonId: string;
  setSelectedLessonId: (id: string) => void;
  chapters: any[];
  isLoadingAnalytics?: boolean;
}

export default function AnalyticsTab({
  analyticsData,
  analyticsModeFilter,
  setAnalyticsModeFilter,
  rankingScope,
  setRankingScope,
  selectedChapterId,
  setSelectedChapterId,
  selectedLessonId,
  setSelectedLessonId,
  chapters,
  isLoadingAnalytics = false
}: AnalyticsTabProps) {
  const activeLessons = useMemo(() => {
    return (chapters || []).find(c => c?.id === selectedChapterId)?.lessons || [];
  }, [chapters, selectedChapterId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-6xl mx-auto text-left">
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0">
          <button
            type="button"
            onClick={() => setAnalyticsModeFilter("all")}
            className={
              "px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer " + 
              (analyticsModeFilter === "all" ? "bg-white text-[#1D4ED8] shadow-xs" : "text-slate-600 hover:text-slate-900")
            }
          >
            Toàn bộ học sinh
          </button>
          <button
            type="button"
            onClick={() => setAnalyticsModeFilter("online")}
            className={
              "px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer " + 
              (analyticsModeFilter === "online" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900")
            }
          >
            Học sinh Online
          </button>
          <button
            type="button"
            onClick={() => setAnalyticsModeFilter("offline")}
            className={
              "px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer " + 
              (analyticsModeFilter === "offline" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900")
            }
          >
            Học sinh Offline
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
            <button 
              type="button"
              onClick={() => setRankingScope("course")} 
              className={
                "px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer " + 
                (rankingScope === "course" ? "bg-white text-[#1D4ED8] shadow-2xs" : "text-slate-500 hover:text-slate-800")
              }
            >
              Toàn khóa
            </button>
            <button 
              type="button"
              onClick={() => setRankingScope("chapter")} 
              className={
                "px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer " + 
                (rankingScope === "chapter" ? "bg-white text-[#1D4ED8] shadow-2xs" : "text-slate-500 hover:text-slate-800")
              }
            >
              Từng chương
            </button>
            <button 
              type="button"
              onClick={() => setRankingScope("lesson")} 
              className={
                "px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer " + 
                (rankingScope === "lesson" ? "bg-white text-[#1D4ED8] shadow-2xs" : "text-slate-500 hover:text-slate-800")
              }
            >
              Từng bài
            </button>
          </div>
          
          {(rankingScope === "chapter" || rankingScope === "lesson") && (
            <select 
              value={selectedChapterId} 
              onChange={e => { setSelectedChapterId(e.target.value); setSelectedLessonId("all"); }} 
              className="px-3 py-1.5 text-xs font-bold text-[#1D4ED8] bg-blue-50 border border-blue-200 rounded-xl focus:border-blue-500 outline-none transition cursor-pointer"
            >
              <option value="all" disabled>-- Chọn Chương --</option>
              {(chapters || []).map(c => <option key={c?.id} value={c?.id}>{c?.title}</option>)}
            </select>
          )}
          {rankingScope === "lesson" && selectedChapterId !== "all" && (
            <select 
              value={selectedLessonId} 
              onChange={e => setSelectedLessonId(e.target.value)} 
              className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-xl focus:border-indigo-500 outline-none transition cursor-pointer"
            >
              <option value="all" disabled>-- Chọn Bài học --</option>
              {activeLessons.map((l: any) => <option key={l?.id} value={l?.id}>{l?.title}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" /> Bảng điểm & Xếp hạng học viên TCT
          </h3>
          <span className="text-xs text-slate-500 font-bold">
            {isLoadingAnalytics ? "Đang tính điểm..." : `${analyticsData.length} học viên`}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-white text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 font-bold text-center w-14">Hạng</th>
                <th className="py-3 px-4 font-bold min-w-[160px]">Học sinh</th>
                <th className="py-3 px-3 font-bold text-center w-24">Phân hệ</th>
                <th className="py-3 px-3 font-bold text-center w-24">Lượt làm</th>
                <th className="py-3 px-3 font-bold text-center w-24">Đ.Max BTVN</th>
                <th className="py-3 px-3 font-bold text-center w-24">Đ.Max KT</th>
                <th className="py-3 px-4 font-bold text-center text-[#1D4ED8] w-28">Tổng kết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingAnalytics ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <Loader2 className="w-7 h-7 text-[#1D4ED8] animate-spin" />
                      <span className="text-xs font-bold text-slate-500">
                        Đang đồng bộ và tính toán điểm số tức thì...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : analyticsData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    Chưa có dữ liệu làm bài nào của học sinh.
                  </td>
                </tr>
              ) : (
                analyticsData.map((st, idx) => {
                  const rank = idx + 1;
                  const isTop1 = rank === 1;
                  const isTop2 = rank === 2;
                  const isTop3 = rank === 3;

                  return (
                    <tr key={st.id || idx} className="hover:bg-slate-50/60 transition-colors bg-white">
                      <td className="py-2.5 px-3 text-center font-black">
                        {isTop1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-black shadow-2xs" title="Hạng 1 - Huy hiệu Vàng">
                            🥇
                          </span>
                        ) : isTop2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-700 border border-slate-300 text-xs font-black" title="Hạng 2 - Huy hiệu Bạc">
                            🥈
                          </span>
                        ) : isTop3 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-800 border border-orange-300 text-xs font-black" title="Hạng 3 - Huy hiệu Đồng">
                            🥉
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold">#{rank}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-800">
                        <div>{st.name}</div>
                        <span className="text-[10px] text-slate-400 font-normal">{st.school || "THPT"}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={
                          "px-2 py-0.5 rounded text-[9px] font-black uppercase " + 
                          (st.mode === "online" 
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200" 
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200")
                        }>
                          {st.mode === "online" ? "Online" : "Offline"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium text-slate-600">{st.totalAttempts} lượt</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-600">{Number(st.hwMax || st.hwAvg || 0).toFixed(1)}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-600">{Number(st.testMax || st.testAvg || 0).toFixed(1)}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 font-black rounded-lg border border-emerald-200">
                          {Number(st.overallAvg || 0).toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
