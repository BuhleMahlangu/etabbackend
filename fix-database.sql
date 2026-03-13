-- Fix missing columns for announcements and quizzes

-- Add columns to announcements table
ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS applicable_grade_ids UUID[],
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- Add columns to quizzes table  
ALTER TABLE quizzes
ADD COLUMN IF NOT EXISTS applicable_grades VARCHAR(50)[],
ADD COLUMN IF NOT EXISTS applicable_grade_ids UUID[];

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'announcements';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'quizzes';
