-- Add check_out_ip column to track where employees check out from
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_ip text;

-- Add comment for documentation
COMMENT ON COLUMN attendance.check_out_ip IS 'IP address used during check-out';
