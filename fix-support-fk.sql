-- Fix foreign key constraint to allow both admins and users (school admins)

-- First check the current constraint
SELECT 
    tc.constraint_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_name = 'support_messages_responded_by_fkey';

-- Drop the foreign key constraint
ALTER TABLE support_messages 
DROP CONSTRAINT IF EXISTS support_messages_responded_by_fkey;

-- Add comment explaining the column can reference either admins.id or users.id
COMMENT ON COLUMN support_messages.responded_by IS 'ID of admin or school admin who responded (can reference admins.id or users.id)';
