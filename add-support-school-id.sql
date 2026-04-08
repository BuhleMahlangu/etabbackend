-- Add school_id column to support_messages table
ALTER TABLE support_messages 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_support_messages_school_id ON support_messages(school_id);

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'support_messages';
