import { sql, type InferInsertModel, type InferSelectModel } from 'drizzle-orm';
import {
  char,
  date,
  datetime,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  time,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';

export const users = mysqlTable(
  'users',
  {
    id: char('id', { length: 36 }).primaryKey(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 72 }).notNull(),
    fullName: varchar('full_name', { length: 255 }).notNull(),
    role: mysqlEnum('role', ['admin', 'accountant', 'employee']).notNull().default('employee'),
    branch: varchar('branch', { length: 255 }),
    jobTitle: varchar('job_title', { length: 255 }),
    shiftStart: time('shift_start'),
    shiftEnd: time('shift_end'),
    offDay: varchar('off_day', { length: 20 }),
    overtimeEnabled: tinyint('overtime_enabled').notNull().default(1),
    mustChangePassword: tinyint('must_change_password').notNull().default(0),
    createdAt: datetime('created_at', { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime('updated_at', { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => ({
    roleIdx: index('idx_users_role').on(table.role),
    branchIdx: index('idx_users_branch').on(table.branch),
  })
);

export const sessions = mysqlTable(
  'sessions',
  {
    id: char('id', { length: 64 }).primaryKey(),
    userId: char('user_id', { length: 36 }).notNull(),
    createdAt: datetime('created_at', { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    expiresAt: datetime('expires_at', { fsp: 3 }).notNull(),
    userAgent: varchar('user_agent', { length: 500 }),
    ipAddress: varchar('ip_address', { length: 45 }),
  },
  (table) => ({
    userIdx: index('idx_sessions_user_id').on(table.userId),
    expiresIdx: index('idx_sessions_expires_at').on(table.expiresAt),
  })
);

export const attendance = mysqlTable(
  'attendance',
  {
    id: char('id', { length: 36 }).primaryKey(),
    userId: char('user_id', { length: 36 }).notNull(),
    date: date('date').notNull(),
    checkInTime: datetime('check_in_time', { fsp: 3 }),
    checkOutTime: datetime('check_out_time', { fsp: 3 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    checkOutIp: varchar('check_out_ip', { length: 45 }),
    checkInLocation: text('check_in_location'),
    checkOutLocation: text('check_out_location'),
    status: mysqlEnum('status', ['present', 'late', 'absent', 'missing_checkout'])
      .notNull()
      .default('present'),
    lateMinutes: int('late_minutes').notNull().default(0),
    earlyDepartureMinutes: int('early_departure_minutes').notNull().default(0),
    overtimeMinutes: int('overtime_minutes').notNull().default(0),
    createdAt: datetime('created_at', { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => ({
    userDateUnique: uniqueIndex('uk_user_date').on(table.userId, table.date),
    userIdx: index('idx_attendance_user_id').on(table.userId),
    dateIdx: index('idx_attendance_date').on(table.date),
    dashIdx: index('idx_attendance_user_date_status').on(table.userId, table.date, table.status),
  })
);

export const branchAllowedIps = mysqlTable(
  'branch_allowed_ips',
  {
    id: char('id', { length: 36 }).primaryKey(),
    branchName: varchar('branch_name', { length: 255 }).notNull(),
    ruleType: mysqlEnum('rule_type', ['exact_ip', 'cidr']).notNull().default('exact_ip'),
    ipNetwork: varchar('ip_network', { length: 45 }).notNull(),
    description: text('description'),
    isActive: tinyint('is_active').notNull().default(1),
    createdBy: char('created_by', { length: 36 }),
    createdAt: datetime('created_at', { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: datetime('updated_at', { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (table) => ({
    branchIdx: index('idx_branch_allowed_ips_branch').on(table.branchName),
    activeIdx: index('idx_branch_allowed_ips_active').on(table.isActive),
    ruleTypeIdx: index('idx_branch_allowed_ips_rule_type').on(table.ruleType),
    networkIdx: index('idx_branch_allowed_ips_network').on(table.ipNetwork),
  })
);

export const globalSettings = mysqlTable('global_settings', {
  id: tinyint('id').primaryKey().default(1),
  earlyCheckinMinutes: int('early_checkin_minutes').notNull().default(60),
  lateGraceMinutes: int('late_grace_minutes').notNull().default(0),
  checkoutWindowMinutes: int('checkout_window_minutes').notNull().default(60),
  maxOvertimeMinutes: int('max_overtime_minutes').notNull().default(180),
  updatedAt: datetime('updated_at', { fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
});

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;
export type Attendance = InferSelectModel<typeof attendance>;
export type NewAttendance = InferInsertModel<typeof attendance>;
export type BranchIp = InferSelectModel<typeof branchAllowedIps>;
export type GlobalSettings = InferSelectModel<typeof globalSettings>;
