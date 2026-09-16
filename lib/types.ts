export type UserRole = 'ADMIN' | 'TEACHER';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type AttendanceStatus = 'present' | 'late' | 'absent';
export type AbsenceReason = 'sick' | 'excused' | 'valid' | 'unexcused';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export interface ClassInfo {
  id: string;
  name: string;
  teacher_id: string | null;
  student_count: number;
  teacher?: Profile;
}

export interface Student {
  id: string;
  full_name: string;
  class_id: string;
}

export interface StudentWithStatus extends Student {
  status: AttendanceStatus;
  absence_reason?: AbsenceReason | null;
}

export interface ScheduleEntry {
  id: string;
  class_id: string;
  day_of_week: number;
  lesson_number: number;
  subject: string;
  teacher_id: string;
  class?: ClassInfo;
  teacher?: Profile;
}

export interface AttendanceLog {
  id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  absence_reason?: AbsenceReason | null;
  marked_by: string;
  created_at: string;
  student?: Student;
}

export interface DashboardStats {
  present: number;
  late: number;
  absent: number;
  total: number;
}

export interface ClassBarStat {
  name: string;
  percentage: number | null;
  isBest: boolean;
  markedCount: number;
}

export interface TrendPoint {
  date: string;
  label: string;
  percentage: number | null;
}

export interface WeeklyTrend {
  averagePct: number | null;
  changePp: number | null;
  points: TrendPoint[];
}

export interface AttendanceInsight {
  tone: 'risk' | 'watch' | 'good';
  text: string;
}

export interface LogEntry {
  class_id: string;
  class_name: string;
  teacher_name: string;
  date: string;
  present_count: number;
  late_count: number;
  absent_count: number;
}
