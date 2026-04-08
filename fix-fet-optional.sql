-- For FET phase (Grades 10-12), only HL, FAL, and LO should be compulsory
-- All other subjects should be optional

-- Update FET optional subjects (not HL, FAL, LO)
UPDATE grade_modules gm
SET is_compulsory = false
FROM modules m
JOIN subjects s ON m.code = s.code AND m.school_id = s.school_id
WHERE gm.module_id = m.id
AND s.phase = 'FET'
AND s.code NOT LIKE '%-HL-%'  -- Home Language
AND s.code NOT LIKE '%-FAL%'  -- First Additional Language  
AND s.code NOT LIKE '%-LO-%'  -- Life Orientation
AND s.code NOT LIKE '%-ENG-FET' -- English HL
AND s.code NOT LIKE '%-ZUL-FET' -- Zulu FAL
AND s.code NOT LIKE '%-LO-FET'; -- Life Orientation

-- Verify the update
SELECT s.code, s.name, gm.is_compulsory
FROM subjects s
JOIN modules m ON s.code = m.code AND s.school_id = m.school_id
JOIN grade_modules gm ON m.id = gm.module_id
WHERE s.phase = 'FET'
AND s.school_id = '2dce4350-f837-439e-8047-b023b7ea936a'
ORDER BY gm.is_compulsory DESC, s.name;
