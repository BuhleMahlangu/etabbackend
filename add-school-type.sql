-- Add school_type column to schools table
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS school_type VARCHAR(20) DEFAULT 'high_school' 
CHECK (school_type IN ('primary_school', 'high_school', 'combined'));

-- Update existing schools with correct types
UPDATE schools 
SET school_type = CASE 
    WHEN code = 'KPS' THEN 'primary_school'
    WHEN code IN ('KHS', 'SSS') THEN 'high_school'
    ELSE 'high_school'
END;

-- Verify
SELECT code, name, school_type FROM schools;
