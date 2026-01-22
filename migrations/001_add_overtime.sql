-- =============================================
-- Overtime System Migration
-- Run this in your Supabase SQL Editor
-- =============================================

-- Add overtime_enabled to profiles (default TRUE for all employees)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS overtime_enabled BOOLEAN DEFAULT TRUE;

-- Add overtime_minutes to attendance (default 0)
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER DEFAULT 0;

-- Update existing employees to have overtime enabled by default
UPDATE public.profiles SET overtime_enabled = TRUE WHERE overtime_enabled IS NULL;

-- Update existing attendance records to have 0 overtime
UPDATE public.attendance SET overtime_minutes = 0 WHERE overtime_minutes IS NULL;
