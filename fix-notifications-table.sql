-- Fix notifications table - add missing related_id column

-- Check if column exists and add it if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'related_id'
    ) THEN
        ALTER TABLE notifications ADD COLUMN related_id UUID;
        RAISE NOTICE 'Added related_id column to notifications table';
    ELSE
        RAISE NOTICE 'related_id column already exists';
    END IF;
END $$;

-- Verify the table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notifications' 
ORDER BY ordinal_position;
