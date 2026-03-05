-- Migration: Add missing_checkout status to attendance table
-- Also ensures off_day column exists on profiles (referenced in code but may be missing from base schema)

-- Step 1: Drop the existing status check constraint
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;

-- Step 2: Re-add the constraint with missing_checkout included
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
  CHECK (status IN ('present', 'late', 'absent', 'missing_checkout'));

-- Step 3: Add off_day column to profiles if it doesn't already exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS off_day TEXT;
