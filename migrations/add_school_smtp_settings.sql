-- Add SMTP settings to schools table
-- This allows each school to send emails from their own domain

-- Check if columns exist before adding
DO $$
BEGIN
    -- SMTP Host
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schools' AND column_name = 'smtp_host'
    ) THEN
        ALTER TABLE schools ADD COLUMN smtp_host VARCHAR(255);
    END IF;

    -- SMTP Port
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schools' AND column_name = 'smtp_port'
    ) THEN
        ALTER TABLE schools ADD COLUMN smtp_port INTEGER DEFAULT 587;
    END IF;

    -- SMTP User
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schools' AND column_name = 'smtp_user'
    ) THEN
        ALTER TABLE schools ADD COLUMN smtp_user VARCHAR(255);
    END IF;

    -- SMTP Password
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schools' AND column_name = 'smtp_password'
    ) THEN
        ALTER TABLE schools ADD COLUMN smtp_password VARCHAR(255);
    END IF;

    -- SMTP From Email
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schools' AND column_name = 'smtp_from_email'
    ) THEN
        ALTER TABLE schools ADD COLUMN smtp_from_email VARCHAR(255);
    END IF;

    -- SMTP From Name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schools' AND column_name = 'smtp_from_name'
    ) THEN
        ALTER TABLE schools ADD COLUMN smtp_from_name VARCHAR(255) DEFAULT 'E-tab Learning';
    END IF;

    -- SMTP Secure (SSL/TLS)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schools' AND column_name = 'smtp_secure'
    ) THEN
        ALTER TABLE schools ADD COLUMN smtp_secure BOOLEAN DEFAULT false;
    END IF;

    -- SMTP Enabled
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'schools' AND column_name = 'smtp_enabled'
    ) THEN
        ALTER TABLE schools ADD COLUMN smtp_enabled BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Show updated table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'schools' 
AND column_name LIKE 'smtp%'
ORDER BY ordinal_position;
