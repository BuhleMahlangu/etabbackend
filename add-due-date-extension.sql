-- ============================================
-- ADD DUE DATE EXTENSION TRACKING
-- ============================================

-- Add extension fields to assignments table
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS original_due_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS extended_due_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS extended_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS extended_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS extension_reason TEXT;

-- Add extension fields to quizzes table
ALTER TABLE quizzes 
ADD COLUMN IF NOT EXISTS original_due_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS extended_due_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS extended_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS extended_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS extension_reason TEXT;

-- Create index for due date queries
CREATE INDEX IF NOT EXISTS idx_assignments_extended ON assignments(extended_due_date);
CREATE INDEX IF NOT EXISTS idx_quizzes_extended ON quizzes(extended_due_date);

-- ============================================
-- CREATE DUE DATE EXTENSION NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS due_date_extension_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type VARCHAR(20) NOT NULL, -- 'assignment' or 'quiz'
    item_id UUID NOT NULL,
    subject_id UUID REFERENCES modules(id),
    teacher_id UUID REFERENCES users(id),
    original_due_date TIMESTAMP NOT NULL,
    new_due_date TIMESTAMP NOT NULL,
    reason TEXT,
    notified_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_extension_notif_item ON due_date_extension_notifications(item_type, item_id);

SELECT 'Due date extension fields added successfully' as status;
