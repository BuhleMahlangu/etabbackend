# E-TAB School Filtering Refactoring - Complete Summary

## Overview
This document summarizes all changes made to implement automatic school filtering across the E-TAB backend API. This ensures multi-tenant data isolation where learners and teachers can only access data from their own school.

## Schools in System
- **KHS** - Kayamandi High School
- **KPS** - Kayamandi Primary School  
- **DEMO** - Demo School

---

## Files Modified

### 1. src/controllers/assignmentController.js

#### Change 1.1: `getAssignmentById` Function
**Location:** Lines 256-317

**BEFORE:**
```javascript
const getAssignmentById = async (req, res) => {
  // ...
  const result = await db.query(
    `SELECT a.*, 
            u.first_name || ' ' || u.last_name as teacher_name,
            m.name as subject_name, m.code as subject_code
     FROM assignments a
     JOIN users u ON a.teacher_id = u.id
     JOIN modules m ON a.subject_id = m.id
     WHERE a.id = $1`,
    [id]
  );
  // No school verification!
```

**AFTER:**
```javascript
const getAssignmentById = async (req, res) => {
  const userSchoolId = req.user.schoolId;  // NEW
  // ...
  const result = await db.query(
    `SELECT a.*, 
            u.first_name || ' ' || u.last_name as teacher_name,
            m.name as subject_name, m.code as subject_code,
            m.school_id as subject_school_id              // NEW
     FROM assignments a
     JOIN users u ON a.teacher_id = u.id
     JOIN modules m ON a.subject_id = m.id
     WHERE a.id = $1`,
    [id]
  );
  
  // NEW: Verify assignment belongs to user's school
  if (userSchoolId && assignment.subject_school_id !== userSchoolId) {
    return res.status(403).json({ success: false, message: 'Assignment not available for your school' });
  }
```

**Purpose:** Prevents users from viewing assignments belonging to other schools.

---

#### Change 1.2: `getAssignmentSubmissions` Function
**Location:** Lines 650-685

**BEFORE:**
```javascript
const getAssignmentSubmissions = async (req, res) => {
  // Verify teacher owns the assignment
  const assignmentCheck = await db.query(
    'SELECT teacher_id FROM assignments WHERE id = $1',
    [assignmentId]
  );
  // No school verification!
```

**AFTER:**
```javascript
const getAssignmentSubmissions = async (req, res) => {
  const userSchoolId = req.user.schoolId;  // NEW
  
  // Verify teacher owns the assignment (and it's in their school)
  const assignmentCheck = await db.query(
    `SELECT a.teacher_id, m.school_id 
     FROM assignments a
     JOIN modules m ON a.subject_id = m.id
     WHERE a.id = $1`,
    [assignmentId]
  );
  
  // NEW: Verify school access
  if (userSchoolId && assignmentCheck.rows[0].school_id !== userSchoolId) {
    return res.status(403).json({ success: false, message: 'Assignment not available for your school' });
  }
```

**Purpose:** Ensures teachers can only view submissions for assignments in their school.

---

### 2. src/controllers/enrollmentController.js

#### Change 2.1: `processGradeProgression` Function
**Location:** Lines 40-120

**BEFORE:**
```javascript
const processGradeProgression = async (req, res) => {
  const { learnerId } = req.params;
  const academicYear = new Date().getFullYear().toString();

  // Get all enrollments for current year
  const enrollments = await db.query(
    `SELECT e.*, s.name as subject_name
     FROM enrollments e
     JOIN subjects s ON e.subject_id = s.id
     WHERE e.learner_id = $1 AND e.academic_year = $2`,
    [learnerId, academicYear]
  );
  // No school filtering!
```

**AFTER:**
```javascript
const processGradeProgression = async (req, res) => {
  const { learnerId } = req.params;
  const { schoolId, isSuperAdmin } = req.user;  // NEW
  const academicYear = new Date().getFullYear().toString();

  // NEW: Verify permission - only super admins or same school admins
  if (!isSuperAdmin && schoolId) {
    const learnerCheck = await db.query(
      'SELECT school_id FROM users WHERE id = $1',
      [learnerId]
    );
    if (learnerCheck.rows.length === 0 || learnerCheck.rows[0].school_id !== schoolId) {
      return res.status(403).json({ success: false, message: 'Not authorized to process this learner' });
    }
  }

  // Get all enrollments for current year (school-filtered)
  let enrollmentsQuery = `
    SELECT e.*, s.name as subject_name
     FROM enrollments e
     JOIN subjects s ON e.subject_id = s.id
     WHERE e.learner_id = $1 AND e.academic_year = $2
  `;
  
  // NEW: Apply school filter for non-super-admins
  if (!isSuperAdmin && schoolId) {
    enrollmentsQuery += ` AND s.school_id = '${schoolId}'`;
  }
  
  const enrollments = await db.query(enrollmentsQuery, [learnerId, academicYear]);
```

**Purpose:** Ensures grade progression only processes enrollments from the same school.

---

#### Change 2.2: `getReport` Function
**Location:** Lines 122-153

**BEFORE:**
```javascript
const getReport = async (req, res) => {
  const { learnerId } = req.params;
  const academicYear = req.query.year || new Date().getFullYear().toString();

  const result = await db.query(
    `SELECT e.*, s.name as subject_name, s.code as subject_code, s.credits
     FROM enrollments e
     JOIN subjects s ON e.subject_id = s.id
     WHERE e.learner_id = $1 AND e.academic_year = $2
     ORDER BY s.name`,
    [learnerId, academicYear]
  );
  // No school filtering!
```

**AFTER:**
```javascript
const getReport = async (req, res) => {
  const { learnerId } = req.params;
  const { schoolId, isSuperAdmin } = req.user;  // NEW
  const academicYear = req.query.year || new Date().getFullYear().toString();

  // NEW: Verify permission
  if (!isSuperAdmin && schoolId) {
    const learnerCheck = await db.query(
      'SELECT school_id FROM users WHERE id = $1',
      [learnerId]
    );
    if (learnerCheck.rows.length === 0 || learnerCheck.rows[0].school_id !== schoolId) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this report' });
    }
  }

  // Build school-filtered query
  let query = `
    SELECT e.*, s.name as subject_name, s.code as subject_code, s.credits
     FROM enrollments e
     JOIN subjects s ON e.subject_id = s.id
     WHERE e.learner_id = $1 AND e.academic_year = $2
  `;
  
  // NEW: Apply school filter
  if (!isSuperAdmin && schoolId) {
    query += ` AND s.school_id = '${schoolId}'`;
  }
  
  query += ` ORDER BY s.name`;
  const result = await db.query(query, [learnerId, academicYear]);
```

**Purpose:** Ensures student reports only include subjects from the same school.

---

#### Change 2.3: `getMySubjects` Function
**Location:** Lines 155-200

**BEFORE:**
```javascript
const getMySubjects = async (req, res) => {
  const learnerId = req.user.userId;

  const result = await db.query(`
    SELECT 
      m.id as subject_id,
      m.name as subject_name,
      m.code as subject_code,
      -- ...
    FROM learner_modules lm
    JOIN modules m ON lm.module_id = m.id
    JOIN grades g ON lm.grade_id = g.id
    WHERE lm.learner_id = $1 
    AND lm.status = 'active'
    ORDER BY m.name
  `, [learnerId]);
  // No school filtering!
```

**AFTER:**
```javascript
const getMySubjects = async (req, res) => {
  const learnerId = req.user.userId;
  const userSchoolId = req.user.schoolId;  // NEW

  // Base query with school filter
  let query = `
    SELECT 
      m.id as subject_id,
      m.name as subject_name,
      m.code as subject_code,
      -- ...
    FROM learner_modules lm
    JOIN modules m ON lm.module_id = m.id
    JOIN grades g ON lm.grade_id = g.id
    WHERE lm.learner_id = $1 
    AND lm.status = 'active'
  `;
  
  let params = [learnerId];
  
  // NEW: Add school filter
  if (userSchoolId) {
    query += ` AND m.school_id = $2`;
    params.push(userSchoolId);
  }
  
  query += ` ORDER BY m.name`;
  const result = await db.query(query, params);
```

**Purpose:** Ensures learners only see their enrolled subjects from their own school.

---

#### Change 2.4: `getEnrollmentHistory` Function
**Location:** Lines 202-311

**BEFORE:**
```javascript
const getEnrollmentHistory = async (req, res) => {
  const learnerId = req.user.userId;
  const { phase } = req.query;
  // ...
  const result = await db.query(`
    SELECT 
      m.id as subject_id,
      -- ...
    FROM learner_modules lm
    JOIN modules m ON lm.module_id = m.id
    JOIN grades g ON lm.grade_id = g.id
    WHERE lm.learner_id = $1 
    ${gradeFilter}
    AND lm.status = 'active'
    ORDER BY g.level DESC, m.name
  `, [learnerId, userGradeId]);
  // No school filtering!
```

**AFTER:**
```javascript
const getEnrollmentHistory = async (req, res) => {
  const learnerId = req.user.userId;
  const userSchoolId = req.user.schoolId;  // NEW
  const { phase } = req.query;
  // ...
  
  // NEW: Query learner_modules with school filter
  let schoolFilter = '';
  let params = [learnerId, userGradeId];
  
  if (userSchoolId) {
    schoolFilter = `AND m.school_id = $3`;
    params.push(userSchoolId);
  }

  const result = await db.query(`
    SELECT 
      m.id as subject_id,
      -- ...
    FROM learner_modules lm
    JOIN modules m ON lm.module_id = m.id
    JOIN grades g ON lm.grade_id = g.id
    WHERE lm.learner_id = $1 
    ${gradeFilter}
    ${schoolFilter}                        -- NEW
    AND lm.status = 'active'
    ORDER BY g.level DESC, m.name
  `, params);
```

**Purpose:** Ensures enrollment history only shows subjects from the user's school.

---

### 3. src/controllers/teacherController.js

#### Change 3.1: `getMyStudents` Function
**Location:** Lines 6-79

**BEFORE:**
```javascript
const getMyStudents = async (req, res) => {
  const teacherId = req.user.userId;

  // Get teacher's subject assignments
  const assignmentsQuery = `
    SELECT ta.subject_id, ta.grade_id, m.name as subject_name, g.name as grade_name
    FROM teacher_assignments ta
    JOIN modules m ON ta.subject_id = m.id
    JOIN grades g ON ta.grade_id = g.id
    WHERE ta.teacher_id = $1 AND ta.is_active = true
  `;
  // No school filtering!
  
  // Get all students enrolled in these subjects
  const studentsQuery = `
    SELECT DISTINCT
      u.id, u.first_name, u.last_name, u.email, u.grade_id,
      g.name as grade_name, lm.enrolled_at, lm.completion_percentage as overall_progress
    FROM users u
    JOIN learner_modules lm ON u.id = lm.learner_id
    JOIN grades g ON u.grade_id = g.id
    WHERE lm.module_id = ANY($1)
      AND lm.status = 'active'
      AND u.role = 'learner'
    ORDER BY u.last_name, u.first_name
  `;
  // No school filtering!
```

**AFTER:**
```javascript
const getMyStudents = async (req, res) => {
  const teacherId = req.user.userId;
  const userSchoolId = req.user.schoolId;  // NEW

  // Get teacher's subject assignments (school-filtered)
  let assignmentsQuery = `
    SELECT ta.subject_id, ta.grade_id, m.name as subject_name, g.name as grade_name
    FROM teacher_assignments ta
    JOIN modules m ON ta.subject_id = m.id
    JOIN grades g ON ta.grade_id = g.id
    WHERE ta.teacher_id = $1 AND ta.is_active = true
  `;
  
  if (userSchoolId) {
    assignmentsQuery += ` AND m.school_id = '${userSchoolId}'`;
  }
  
  // Get all students enrolled in these subjects (school-filtered)
  let studentsQuery = `
    SELECT DISTINCT
      u.id, u.first_name, u.last_name, u.email, u.grade_id, u.school_id,
      g.name as grade_name, lm.enrolled_at, lm.completion_percentage as overall_progress
    FROM users u
    JOIN learner_modules lm ON u.id = lm.learner_id
    JOIN grades g ON u.grade_id = g.id
    JOIN modules m ON lm.module_id = m.id
    WHERE lm.module_id = ANY($1)
      AND lm.status = 'active'
      AND u.role = 'learner'
  `;
  
  if (userSchoolId) {
    studentsQuery += ` AND m.school_id = '${userSchoolId}' AND u.school_id = '${userSchoolId}'`;
  }
  studentsQuery += ` ORDER BY u.last_name, u.first_name`;
```

**Purpose:** Ensures teachers only see students from their own school.

---

#### Change 3.2: `getMyAssignments` Function
**Location:** Lines 81-137

**BEFORE:**
```javascript
const getMyAssignments = async (req, res) => {
  const teacherId = req.user.userId;

  const query = `
    SELECT 
      g.id as grade_id, g.name as grade_name,
      m.id as subject_id, m.name as subject_name, m.code as subject_code, ta.is_primary
    FROM teacher_assignments ta
    JOIN modules m ON ta.subject_id = m.id
    JOIN grades g ON ta.grade_id = g.id
    WHERE ta.teacher_id = $1 AND ta.is_active = true
    ORDER BY g.level, m.name
  `;
  // No school filtering!
```

**AFTER:**
```javascript
const getMyAssignments = async (req, res) => {
  const teacherId = req.user.userId;
  const userSchoolId = req.user.schoolId;  // NEW

  let query = `
    SELECT 
      g.id as grade_id, g.name as grade_name,
      m.id as subject_id, m.name as subject_name, m.code as subject_code, ta.is_primary
    FROM teacher_assignments ta
    JOIN modules m ON ta.subject_id = m.id
    JOIN grades g ON ta.grade_id = g.id
    WHERE ta.teacher_id = $1 AND ta.is_active = true
  `;
  
  if (userSchoolId) {
    query += ` AND m.school_id = '${userSchoolId}'`;
  }
  query += ` ORDER BY g.level, m.name`;
```

**Purpose:** Ensures teachers only see their subject assignments from their own school.

---

#### Change 3.3: `getDashboard` Function
**Location:** Lines 139-192

**BEFORE:**
```javascript
const getDashboard = async (req, res) => {
  const teacherId = req.user.userId;

  // Get total students taught
  const studentsQuery = `
    SELECT COUNT(DISTINCT lm.learner_id)
    FROM teacher_assignments ta
    JOIN learner_modules lm ON ta.subject_id = lm.module_id
    WHERE ta.teacher_id = $1 AND ta.is_active = true
      AND lm.status = 'active'
  `;
  // No school filtering!
  
  // Similar queries for subjects, assignments, pending - all without school filter
```

**AFTER:**
```javascript
const getDashboard = async (req, res) => {
  const teacherId = req.user.userId;
  const userSchoolId = req.user.schoolId;  // NEW

  // Get total students taught (school-filtered via modules)
  let studentsQuery = `
    SELECT COUNT(DISTINCT lm.learner_id)
    FROM teacher_assignments ta
    JOIN learner_modules lm ON ta.subject_id = lm.module_id
    JOIN modules m ON ta.subject_id = m.id
    WHERE ta.teacher_id = $1 AND ta.is_active = true
      AND lm.status = 'active'
  `;
  
  if (userSchoolId) {
    studentsQuery += ` AND m.school_id = '${userSchoolId}'`;
  }
  
  // Similar school filtering applied to subjects, assignments, and pending queries
```

**Purpose:** Ensures teacher dashboard stats only count data from their own school.

---

### 4. src/controllers/authController.js

#### Change 4.1: `getMe` Function - Enrolled Subjects Query
**Location:** Lines 616-627

**BEFORE:**
```javascript
let enrolledSubjects = [];
if (result.rows[0].role === 'learner') {
  const enrollments = await db.query(
    `SELECT e.*, s.name as subject_name, s.code as subject_code 
     FROM enrollments e
     JOIN subjects s ON e.subject_id = s.id
     WHERE e.learner_id = $1 AND e.academic_year = $2`,
    [req.user.userId, new Date().getFullYear().toString()]
  );
  enrolledSubjects = enrollments.rows;
}
```

**AFTER:**
```javascript
let enrolledSubjects = [];
if (result.rows[0].role === 'learner') {
  const learnerSchoolId = result.rows[0].school_id;  // NEW
  
  let enrollmentQuery = `
    SELECT e.*, s.name as subject_name, s.code as subject_code 
     FROM enrollments e
     JOIN subjects s ON e.subject_id = s.id
     WHERE e.learner_id = $1 AND e.academic_year = $2
  `;
  
  // NEW: Apply school filter
  if (learnerSchoolId) {
    enrollmentQuery += ` AND s.school_id = '${learnerSchoolId}'`;
  }
  
  const enrollments = await db.query(enrollmentQuery, [req.user.userId, new Date().getFullYear().toString()]);
  enrolledSubjects = enrollments.rows;
}
```

**Purpose:** Ensures getMe endpoint only returns enrolled subjects from the user's school.

---

## Files Already Properly Filtered (No Changes Needed)

### src/routes/subjectRoutes.js
The following endpoints already had proper school filtering:
- ✅ `GET /my-subjects` - Filters by `m.school_id = $3::uuid`
- ✅ `POST /select-grade` - Filters by `m.school_id = $2::uuid`
- ✅ `POST /enroll` - Filters by `m.school_id = $3::uuid`
- ✅ `POST /drop` - Filters via join `m.school_id = u.school_id`
- ✅ `GET /:id` - Filters via join `m.school_id = u.school_id`
- ✅ `GET /grade-subjects/:gradeId` - Filters by `schoolCode` parameter

---

## Test Script

A comprehensive test script has been created at `test-school-filtering.js` to verify:
1. My Subjects endpoint filters by school
2. Assignment endpoints filter by school
3. Get Me endpoint returns school-scoped data
4. Enrollment History filters by school
5. Teacher endpoints are school-scoped
6. Grade-Subjects endpoint filters by schoolCode

Run with:
```bash
node test-school-filtering.js
```

---

## Security Verification Checklist

| Endpoint | School Filter | Verified |
|----------|--------------|----------|
| GET /subjects/my-subjects | ✅ | Yes |
| POST /subjects/select-grade | ✅ | Yes |
| POST /subjects/enroll | ✅ | Yes |
| POST /subjects/drop | ✅ | Yes |
| GET /subjects/:id | ✅ | Yes |
| GET /subjects/grade-subjects/:gradeId | ✅ | Yes |
| GET /assignments | ✅ | Yes |
| GET /assignments/:id | ✅ | **Fixed** |
| GET /assignments/:id/submissions | ✅ | **Fixed** |
| GET /assignments/my-assignments | ✅ | Yes |
| GET /auth/me | ✅ | **Fixed** |
| GET /enrollments/history | ✅ | **Fixed** |
| GET /enrollments/report | ✅ | **Fixed** |
| POST /enrollments/progression | ✅ | **Fixed** |
| GET /teachers/my-students | ✅ | **Fixed** |
| GET /teachers/my-assignments | ✅ | **Fixed** |
| GET /teachers/dashboard | ✅ | **Fixed** |

---

## Pattern Summary

For every database query, ensure ONE of these is true:
1. ✅ Uses `req.user.schoolId` in WHERE clause
2. ✅ Uses schoolCode parameter in WHERE clause
3. ✅ Joins through a table that is already school-filtered
4. ✅ Explicitly verifies school ownership before returning data

---

## Rollback Instructions

If any issues arise, the original versions of the modified files can be restored from git:
```bash
git checkout src/controllers/assignmentController.js
git checkout src/controllers/enrollmentController.js
git checkout src/controllers/teacherController.js
git checkout src/controllers/authController.js
```

---

**Last Updated:** 2026-03-17
**Refactored By:** Kimi Code CLI
