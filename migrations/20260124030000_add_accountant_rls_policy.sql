-- Add RLS policy to allow 'accountant' role to read attendance records
-- This policy grants SELECT (read) access on the 'attendance' table for users with the 'accountant' role

-- First, check if the policy already exists and drop it if so
DROP POLICY IF EXISTS "Accountants can view all attendance records" ON attendance;

-- Create policy to allow accountants to view attendance records
CREATE POLICY "Accountants can view all attendance records"
ON attendance
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'accountant'
  )
);

-- Also allow accountant to read profiles (for employee names/branches in attendance logs)
DROP POLICY IF EXISTS "Accountants can view all profiles" ON profiles;

CREATE POLICY "Accountants can view all profiles"
ON profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role = 'accountant'
  )
);
