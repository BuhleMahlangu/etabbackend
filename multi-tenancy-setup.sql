-- ============================================
-- MULTI-TENANCY SETUP
-- Run this to add school isolation to your database
-- ============================================

-- ============================================
-- SCHOOLS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL, -- Short code (e.g., 'JHS', 'RHS')
    logo_url TEXT,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    principal_name VARCHAR(255),
    emis_number VARCHAR(50), -- South African EMIS number
    province VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    subscription_plan VARCHAR(50) DEFAULT 'free', -- free, basic, premium
    subscription_expires_at TIMESTAMP,
    max_teachers INTEGER DEFAULT 10,
    max_learners INTEGER DEFAULT 500,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schools_code ON schools(code);
CREATE INDEX IF NOT EXISTS idx_schools_active ON schools(is_active);

-- ============================================
-- ADD SCHOOL_ID TO EXISTING TABLES
-- ============================================

-- Users table (teachers, learners, admins)
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);

-- Modules/Subjects
ALTER TABLE modules ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_modules_school ON modules(school_id);

-- Quizzes
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_quizzes_school ON quizzes(school_id);

-- Quiz attempts
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_school ON quiz_attempts(school_id);

-- Assignments
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_assignments_school ON assignments(school_id);

-- Assignment submissions
ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_submissions_school ON assignment_submissions(school_id);

-- Materials
ALTER TABLE materials ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_materials_school ON materials(school_id);

-- Announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_announcements_school ON announcements(school_id);

-- Notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_notifications_school ON notifications(school_id);

-- AI Tutor conversations
ALTER TABLE ai_tutor_conversations ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_tutor_school ON ai_tutor_conversations(school_id);

-- ============================================
-- SCHOOL ADMINS TABLE
-- Users who can manage their specific school
-- ============================================
CREATE TABLE IF NOT EXISTS school_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'admin', -- admin, principal, hod
    permissions JSONB DEFAULT '{}', -- {'can_add_teachers': true, ...}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(school_id, user_id)
);

-- ============================================
-- INSERT SAMPLE SCHOOL (For testing)
-- ============================================
INSERT INTO schools (name, code, subscription_plan, max_teachers, max_learners)
VALUES ('Demo School', 'DEMO', 'premium', 50, 1000)
ON CONFLICT (code) DO NOTHING;

-- Update existing data to belong to demo school
UPDATE users SET school_id = (SELECT id FROM schools WHERE code = 'DEMO') WHERE school_id IS NULL;
UPDATE modules SET school_id = (SELECT id FROM schools WHERE code = 'DEMO') WHERE school_id IS NULL;
UPDATE quizzes SET school_id = (SELECT id FROM schools WHERE code = 'DEMO') WHERE school_id IS NULL;
UPDATE assignments SET school_id = (SELECT id FROM schools WHERE code = 'DEMO') WHERE school_id IS NULL;
UPDATE materials SET school_id = (SELECT id FROM schools WHERE code = 'DEMO') WHERE school_id IS NULL;

SELECT 'Multi-tenancy setup complete!' as status;
