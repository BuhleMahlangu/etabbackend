-- Fix foreign key references - the system uses 'modules' table, not 'subjects'

-- ============================================
-- FIX ANNOUNCEMENTS TABLE
-- ============================================

-- Drop existing foreign key if exists
ALTER TABLE announcements 
DROP CONSTRAINT IF EXISTS announcements_subject_id_fkey;

-- Add correct foreign key to modules table
ALTER TABLE announcements 
ADD CONSTRAINT announcements_subject_id_fkey 
FOREIGN KEY (subject_id) REFERENCES modules(id) ON DELETE CASCADE;

-- ============================================
-- FIX QUIZZES TABLE  
-- ============================================

-- Drop existing foreign key if exists
ALTER TABLE quizzes 
DROP CONSTRAINT IF EXISTS quizzes_subject_id_fkey;

-- Add correct foreign key to modules table
ALTER TABLE quizzes 
ADD CONSTRAINT quizzes_subject_id_fkey 
FOREIGN KEY (subject_id) REFERENCES modules(id) ON DELETE CASCADE;

-- ============================================
-- VERIFY FIXES
-- ============================================
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_name IN ('announcements', 'quizzes');
