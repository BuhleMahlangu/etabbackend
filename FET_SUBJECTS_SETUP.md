# FET (Grades 10-12) Subject Structure

## Overview

For FET phase (Grades 10-12), learners have:
- **3 Compulsory Subjects** (auto-enrolled)
- **20+ Optional Subjects** (learners choose up to 4)

## Compulsory Subjects (All Schools)

| Code | Name | Department |
|------|------|------------|
| HL-FET | Home Language | Languages |
| FAL-FET | First Additional Language | Languages |
| LO-FET | Life Orientation | Life Orientation |

## Optional Subjects (Examples)

| Code | Name | Department |
|------|------|------------|
| MATH-FET | Mathematics | Mathematics |
| MATHL-FET | Mathematical Literacy | Mathematics |
| PHYSC-FET | Physical Sciences | Science |
| LIFESC-FET | Life Sciences | Science |
| GEO-FET | Geography | Humanities |
| HIST-FET | History | Humanities |
| ECON-FET | Economics | Business |
| BUS-FET | Business Studies | Business |
| ACCN-FET | Accounting | Business |
| IT-FET | Information Technology | Technology |
| CAT-FET | Computer Applications | Technology |
| EGD-FET | Engineering Graphics | Technology |
| TOUR-FET | Tourism | Services |
| HOSP-FET | Hospitality | Services |
| CONS-FET | Consumer Studies | Services |
| AGRIC-FET | Agricultural Sciences | Science |
| VA-FET | Visual Arts | Arts |
| DA-FET | Dramatic Arts | Arts |
| MUS-FET | Music | Arts |
| REL-FET | Religion Studies | Humanities |

## School-Specific Module Counts

| School | Grade | Compulsory | Optional | Total |
|--------|-------|------------|----------|-------|
| DEMO | 10 | 3 | 20 | 23 |
| DEMO | 11 | 3 | 20 | 23 |
| DEMO | 12 | 3 | 20 | 23 |
| KHS | 10 | 3 | 30 | 33 |
| KHS | 11 | 3 | 30 | 33 |
| KHS | 12 | 3 | 30 | 33 |
| KPS | 10 | 3 | 30 | 33 |
| KPS | 11 | 3 | 30 | 33 |
| KPS | 12 | 3 | 30 | 33 |

*Note: KHS and KPS have additional optional subjects (ACC, BUS, ECON from lower grades also available)*

## Auto-Enrollment Logic

### For FET (Grades 10-12):
```javascript
// Only auto-enroll in compulsory subjects
const toEnroll = modules.filter(m => m.is_compulsory);

// Optional subjects must be manually selected by learner
// Maximum 4 optional subjects allowed
```

### Code Implementation:
```javascript
// In subjectRoutes.js /select-grade endpoint
const toEnroll = modulesResult.rows.filter(m => {
  if (level >= 10) return m.is_compulsory;  // FET: Only compulsory
  return true;  // Foundation/Intermediate: All modules
});
```

## Database Schema

### grade_modules Table:
```sql
CREATE TABLE grade_modules (
  grade_id UUID REFERENCES grades(id),
  module_id UUID REFERENCES modules(id),
  is_compulsory BOOLEAN DEFAULT false,
  PRIMARY KEY (grade_id, module_id)
);
```

### Key Queries:

**Get compulsory subjects for a grade:**
```sql
SELECT m.* 
FROM modules m
JOIN grade_modules gm ON m.id = gm.module_id
WHERE gm.grade_id = $1
AND m.school_id = $2
AND gm.is_compulsory = true;
```

**Get optional subjects for a grade:**
```sql
SELECT m.* 
FROM modules m
JOIN grade_modules gm ON m.id = gm.module_id
WHERE gm.grade_id = $1
AND m.school_id = $2
AND gm.is_compulsory = false;
```

## Current Status

✅ All schools have correct FET subject structure  
✅ Compulsory/Optional flags set correctly  
✅ All FET learners enrolled in compulsory subjects  
✅ Optional subject selection working (max 4 limit enforced)

## Rules Summary

1. **Foundation Phase (Gr 1-3)**: Auto-enroll in ALL subjects
2. **Intermediate Phase (Gr 4-6)**: Auto-enroll in ALL subjects
3. **Senior Phase (Gr 7-9)**: Auto-enroll in ALL subjects
4. **FET Phase (Gr 10-12)**: Auto-enroll ONLY in 3 compulsory subjects
5. **FET Optional**: Learners must manually choose up to 4 optional subjects
