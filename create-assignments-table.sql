-- ============================================
-- ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    max_marks INTEGER DEFAULT 100,
    passing_marks INTEGER DEFAULT 50,
    due_date TIMESTAMP NOT NULL,
    available_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    allow_late_submission BOOLEAN DEFAULT false,
    late_penalty_percent INTEGER DEFAULT 0,
    submission_type VARCHAR(50) DEFAULT 'file', -- file, text, link
    max_file_size_mb INTEGER DEFAULT 10,
    allowed_file_types VARCHAR(50)[],
    is_published BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'draft', -- draft, published, closed
    applicable_grades VARCHAR(50)[],
    applicable_grade_ids UUID[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assignments_subject ON assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher ON assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);

-- ============================================
-- ASSIGNMENT SUBMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS assignment_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_text TEXT,
    submission_url VARCHAR(500),
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    marks_obtained INTEGER,
    feedback TEXT,
    status VARCHAR(20) DEFAULT 'submitted', -- submitted, graded, returned, late
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    graded_at TIMESTAMP,
    graded_by UUID REFERENCES users(id),
    is_late BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assignment_id, learner_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_learner ON assignment_submissions(learner_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON assignment_submissions(status);

-- ============================================
-- VERIFY TABLES
-- ============================================
SELECT 'Assignments tables created successfully' as status;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('assignments', 'assignment_submissions')
ORDER BY table_name;
