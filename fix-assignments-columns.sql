-- Fix missing columns in assignments table

-- Add missing columns to assignments table
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS max_marks INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS passing_marks INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS instructions TEXT,
ADD COLUMN IF NOT EXISTS allow_late_submission BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS late_penalty_percent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS submission_type VARCHAR(50) DEFAULT 'file',
ADD COLUMN IF NOT EXISTS max_file_size_mb INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS allowed_file_types VARCHAR(50)[],
ADD COLUMN IF NOT EXISTS applicable_grades VARCHAR(50)[],
ADD COLUMN IF NOT EXISTS applicable_grade_ids UUID[];

-- Verify columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assignments'
ORDER BY ordinal_position;
