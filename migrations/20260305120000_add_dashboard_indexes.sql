-- =============================================
-- Composite index for dashboard stat queries
-- =============================================
-- The admin dashboard counts attendance by (date, status) on every load.
-- A composite index lets Postgres satisfy all four count queries
-- (present, late, total checked-in, and date-only) via index-only scans
-- without touching the heap.
--
-- This also makes the single-column idx_attendance_date redundant,
-- since the leading column of the composite index covers date-only lookups.
-- We drop it to avoid wasted write amplification on inserts/updates.
-- =============================================

-- Add composite index: covers eq(date, today).eq(status, 'present') etc.
CREATE INDEX IF NOT EXISTS idx_attendance_date_status
  ON public.attendance(date, status);

-- Drop the now-redundant single-column date index
DROP INDEX IF EXISTS idx_attendance_date;
