-- Fix the escaped backslashes in requested_changes field
-- This script will clean up the double/triple-encoded JSON strings

-- First, let's see what we have
SELECT id, employee_id, 
       requested_changes::text as requested_changes_text,
       LENGTH(requested_changes::text) as length,
       LEFT(requested_changes::text, 100) as preview
FROM requests 
WHERE requested_changes IS NOT NULL 
  AND request_type = 'profile_edit';

-- Update the corrupted entries by setting them to NULL
-- They will need to be re-submitted by users
UPDATE requests 
SET requested_changes = NULL
WHERE requested_changes IS NOT NULL 
  AND request_type = 'profile_edit'
  AND (
    requested_changes::text LIKE '"\"%' 
    OR requested_changes::text LIKE '"\\%'
    OR LENGTH(requested_changes::text) > 500  -- Abnormally long due to escaping
  );

-- Verify the update
SELECT id, employee_id, requested_changes::text as requested_changes_text, status
FROM requests 
WHERE request_type = 'profile_edit';
