-- Create assignment_submissions table

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
    status VARCHAR(20) DEFAULT 'submitted',
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

SELECT 'assignment_submissions table created!' as status;
