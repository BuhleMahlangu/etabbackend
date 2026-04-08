-- Update the check_role constraint to include 'school_admin'
ALTER TABLE users DROP CONSTRAINT IF EXISTS check_role;

ALTER TABLE users ADD CONSTRAINT check_role 
  CHECK (role IN ('learner', 'teacher', 'admin', 'school_admin'));

-- Verify
SELECT conname, pg_get_constraintdef(oid) as def 
FROM pg_constraint 
WHERE conrelid = 'users'::regclass AND contype = 'c' AND conname = 'check_role';
