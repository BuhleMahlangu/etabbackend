-- Add original_filename column to assignment_submissions
ALTER TABLE assignment_submissions 
ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255);

-- Add file_size column for tracking
ALTER TABLE assignment_submissions 
ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT 0;

-- Create index for file lookups
CREATE INDEX IF NOT EXISTS idx_submissions_file ON assignment_submissions(file_url);

SELECT 'Assignment submissions table updated with original_filename support' as status;
