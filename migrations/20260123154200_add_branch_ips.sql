-- =============================================
-- Branch Allowed IPs Table
-- Stores allowed IP networks for each branch
-- =============================================

CREATE TABLE IF NOT EXISTS public.branch_allowed_ips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_name TEXT NOT NULL,
  ip_network TEXT NOT NULL,  -- First 3 octets, e.g., "81.10.30"
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.branch_allowed_ips ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage
CREATE POLICY "Admins can manage branch IPs" ON public.branch_allowed_ips
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Allow all authenticated users to read (for validation)
CREATE POLICY "Authenticated users can read branch IPs" ON public.branch_allowed_ips
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Add location columns to attendance table
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out_ip TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_in_location TEXT;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out_location TEXT;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_branch_allowed_ips_network ON public.branch_allowed_ips(ip_network);

-- Insert IT Office IP
INSERT INTO public.branch_allowed_ips (branch_name, ip_network, description)
VALUES ('IT Office', '81.10.30', 'مكتب IT - Amwag');
