-- Fix inconsistent subject names

-- Economic and Management Sciences -> Economic Management Sciences
UPDATE subjects 
SET name = 'Economic Management Sciences'
WHERE name LIKE '%Economic%Management%Sciences%' 
OR name = 'Economic and Management Sciences';

-- Fix First Additional Language to be more specific or generic consistently
-- Make them all generic since the specific language varies by school
UPDATE subjects 
SET name = 'First Additional Language'
WHERE name IN ('isiZulu First Additional', 'isiZulu First Additional Language', 'First Additional');

-- Fix Home Language to be consistent
UPDATE subjects 
SET name = 'Home Language'
WHERE name IN ('English Home Language', 'HL');

-- Fix Natural Sciences variations
UPDATE subjects 
SET name = 'Natural Sciences'
WHERE name IN ('Natural Sciences and Technology');

-- Fix any other variations
UPDATE subjects 
SET name = 'Life Orientation'
WHERE name = 'Life orientation';

-- Verify
SELECT code, name, phase FROM subjects WHERE phase IN ('Intermediate', 'Senior') ORDER BY phase, name;
