-- Add ALL missing columns to assignments table

ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS available_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES modules(id),
ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES users(id);

-- Verify all columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assignments'
ORDER BY ordinal_position;
