-- Fix foreign key for assignments table

-- Drop the wrong foreign key
ALTER TABLE assignments 
DROP CONSTRAINT IF EXISTS assignments_subject_id_fkey;

-- Add correct foreign key to modules
ALTER TABLE assignments 
ADD CONSTRAINT assignments_subject_id_fkey 
FOREIGN KEY (subject_id) REFERENCES modules(id) ON DELETE CASCADE;

-- Also fix teacher_id if needed
ALTER TABLE assignments 
DROP CONSTRAINT IF EXISTS assignments_teacher_id_fkey;

ALTER TABLE assignments 
ADD CONSTRAINT assignments_teacher_id_fkey 
FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE;

SELECT 'Foreign keys fixed!' as status;
