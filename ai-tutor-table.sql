-- ============================================
-- AI TUTOR CONVERSATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ai_tutor_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(50) NOT NULL, -- Subject code (MAT, ENG, etc.)
    message TEXT NOT NULL, -- Student's question
    response TEXT NOT NULL, -- AI's response
    context TEXT, -- Optional: quiz/assignment context
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_tutor_learner ON ai_tutor_conversations(learner_id);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_subject ON ai_tutor_conversations(subject);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_date ON ai_tutor_conversations(created_at);

-- ============================================
-- AI TUTOR USAGE STATS (Daily tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_tutor_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    learner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_date DATE DEFAULT CURRENT_DATE,
    question_count INTEGER DEFAULT 0,
    UNIQUE(learner_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_learner_date ON ai_tutor_usage(learner_id, usage_date);

SELECT 'AI Tutor tables created successfully' as status;
