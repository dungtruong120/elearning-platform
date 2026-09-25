export interface AttendanceRecord {
  id?: string;
  sessionId: string;
  studentId: string;
  studentName?: string;
  sessionDate?: string;
  status: "present" | "absent";
  timestamp?: string;
}

export const AttendanceService = {
  getUnattendedLiveSessions: (studentId: string) => {
    if (typeof window === "undefined") return [];
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const savedSessions = 
        localStorage.getItem("tct_schedule_sessions") || 
        localStorage.getItem("edunexus_online_sessions");
      if (!savedSessions) return [];

      const sessions = JSON.parse(savedSessions);
      const activeSessions = Array.isArray(sessions)
        ? sessions.filter((s: any) => 
            (s.meet_link || s.zoom_link || s.meetingUrl) && 
            (!s.date || s.date === todayStr || s.isoDate === todayStr)
          )
        : [];

      const savedAtt = 
        localStorage.getItem("tct_attendance_records") || 
        localStorage.getItem("edunexus_attendance");
      const records: AttendanceRecord[] = savedAtt ? JSON.parse(savedAtt) : [];

      return activeSessions.filter((s: any) => {
        return !records.some((r: any) => 
          (r.sessionId === s.id || r.sessionDate === s.date) && 
          r.studentId === studentId && 
          r.status === "present"
        );
      });
    } catch {
      return [];
    }
  },

  markAttendance: (record: AttendanceRecord) => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("tct_attendance_records") || "[]";
      const records: AttendanceRecord[] = JSON.parse(saved);
      records.push({ ...record, timestamp: new Date().toISOString() });
      localStorage.setItem("tct_attendance_records", JSON.stringify(records));
      window.dispatchEvent(new Event("attendance_updated"));
    } catch (e) {
      console.error(e);
    }
  }
};