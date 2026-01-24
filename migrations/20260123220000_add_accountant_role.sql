-- Add 'accountant' role to the profiles table check constraint
-- Run this in Supabase SQL Editor

-- First, drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Then, add the new constraint that includes 'accountant'
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'employee', 'accountant'));
