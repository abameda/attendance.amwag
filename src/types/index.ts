// Database Types
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'employee';
  branch: string | null;
  job_title: string | null;
  shift_start: string | null;
  shift_end: string | null;
  off_day: string | null; // Day of week: 'sunday', 'monday', 'tuesday', etc.
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  ip_address: string | null;
  status: 'present' | 'late' | 'absent';
  late_minutes: number;
  early_departure_minutes: number;
  created_at: string;
  // Joined data
  profiles?: Profile;
}

// Form Types
export interface CreateEmployeeForm {
  email: string;
  password: string;
  full_name: string;
  branch: string;
  job_title: string;
  shift_start: string;
  shift_end: string;
  off_day: string;
}

export interface UpdateEmployeeForm {
  full_name?: string;
  branch?: string;
  job_title?: string;
  shift_start?: string;
  shift_end?: string;
  off_day?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Attendance Log for Admin View
export interface AttendanceLogEntry {
  id: string;
  employee_name: string;
  branch: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  late_minutes: number;
  early_departure_minutes: number;
  status: 'present' | 'late' | 'absent';
  ip_address: string | null;
}

// Dashboard Stats
export interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
}
