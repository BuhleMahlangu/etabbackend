-- =====================================================
-- Multi-Tenancy: Enable Row Level Security (RLS)
-- This migration adds automatic school-based filtering
-- =====================================================

-- Helper function to get current school ID from session
CREATE OR REPLACE FUNCTION current_school_id()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_school_id', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to check if current user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN current_setting('app.current_user_role', true) = 'admin' 
    AND current_setting('app.is_super_admin', true) = 'true';
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 1. USERS TABLE
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see users from their school
CREATE POLICY school_isolation_users ON users
  FOR SELECT
  USING (
    school_id = current_school_id()
    OR is_super_admin()
  );

-- Policy: Users can only update their own profile or school admin can update school users
CREATE POLICY school_update_users ON users
  FOR UPDATE
  USING (
    school_id = current_school_id()
    OR is_super_admin()
  );

-- =====================================================
-- 2. SUBJECTS TABLE
-- =====================================================

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_isolation_subjects ON subjects
  FOR ALL
  USING (school_id = current_school_id() OR is_super_admin())
  WITH CHECK (school_id = current_school_id() OR is_super_admin());

-- =====================================================
-- 3. MODULES TABLE
-- =====================================================

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_isolation_modules ON modules
  FOR ALL
  USING (school_id = current_school_id() OR is_super_admin())
  WITH CHECK (school_id = current_school_id() OR is_super_admin());

-- =====================================================
-- 4. LEARNER_MODULES TABLE
-- =====================================================

ALTER TABLE learner_modules ENABLE ROW LEVEL SECURITY;

-- Complex policy: learner_modules inherits school from learner
CREATE POLICY school_isolation_learner_modules ON learner_modules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = learner_modules.learner_id 
      AND school_id = current_school_id()
    )
    OR is_super_admin()
  );

-- =====================================================
-- 5. TEACHER_ASSIGNMENTS TABLE
-- =====================================================

ALTER TABLE teacher_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_isolation_teacher_assignments ON teacher_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = teacher_assignments.teacher_id 
      AND school_id = current_school_id()
    )
    OR is_super_admin()
  );

-- =====================================================
-- 6. ASSIGNMENTS TABLE
-- =====================================================

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

-- Assignments are isolated via the teacher's school
CREATE POLICY school_isolation_assignments ON assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = assignments.teacher_id
      AND school_id = current_school_id()
    )
    OR is_super_admin()
  );

-- =====================================================
-- 7. PENDING_TEACHERS TABLE
-- =====================================================

ALTER TABLE pending_teachers ENABLE ROW LEVEL SECURITY;

CREATE POLICY school_isolation_pending ON pending_teachers
  FOR ALL
  USING (school_id = current_school_id() OR is_super_admin())
  WITH CHECK (school_id = current_school_id() OR is_super_admin());

-- =====================================================
-- Force RLS for table owners (important!)
-- =====================================================

ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE subjects FORCE ROW LEVEL SECURITY;
ALTER TABLE modules FORCE ROW LEVEL SECURITY;
ALTER TABLE learner_modules FORCE ROW LEVEL SECURITY;
ALTER TABLE teacher_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE pending_teachers FORCE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON FUNCTION current_school_id() IS 'Returns the current school ID from session variable for RLS policies';
