# Multi-Tenancy Setup Guide

This guide explains how to set up multi-tenancy so your E-Tab platform can serve multiple schools with isolated data.

## What Multi-Tenancy Does

- Each school has completely isolated data
- One deployment serves all schools
- Super admin can manage all schools
- School admins only see their school

## Setup Steps

### 1. Run Database Migration

```bash
# Connect to your database and run:
psql -U your_username -d your_database -f multi-tenancy-setup.sql

# Or use the Node script:
node -e "require('./src/config/database').query(require('fs').readFileSync('./multi-tenancy-setup.sql', 'utf8'))"
```

### 2. Create First School

```sql
-- Insert your first school
INSERT INTO schools (name, code, subscription_plan, max_teachers, max_learners)
VALUES ('Your School Name', 'YOURCODE', 'premium', 50, 1000);

-- Update existing users to belong to this school
UPDATE users SET school_id = (SELECT id FROM schools WHERE code = 'YOURCODE') WHERE school_id IS NULL;
```

### 3. Add School Middleware to Routes

In `server.js`, add the school middleware to your routes:

```javascript
const { attachSchoolContext, verifySchoolActive } = require('./middleware/schoolMiddleware');
const schoolRoutes = require('./routes/schoolRoutes');

// Public routes (no school needed)
app.use('/api/auth', authRoutes);

// Protected routes - require school context
app.use('/api/schools', authenticate, restrictTo('super_admin'), schoolRoutes);
app.use('/api/quizzes', authenticate, attachSchoolContext, verifySchoolActive, quizRoutes);
app.use('/api/assignments', authenticate, attachSchoolContext, verifySchoolActive, assignmentRoutes);
// ... add to all other routes
```

### 4. Update Controllers to Use School Filter

**Before:**
```javascript
const result = await db.query('SELECT * FROM quizzes WHERE subject_id = $1', [subjectId]);
```

**After:**
```javascript
const schoolQuery = require('../utils/schoolQuery');
const result = await schoolQuery.query(req.schoolId, 
  'SELECT * FROM quizzes WHERE subject_id = $1', 
  [subjectId]
);
```

### 5. Test School Isolation

1. Create two schools: School A and School B
2. Add a teacher to School A
3. Add a teacher to School B
4. Create a quiz as School A teacher
5. Verify School B teacher cannot see it

## School Management Endpoints

### Super Admin Only
- `POST /api/schools` - Create new school
- `GET /api/schools` - List all schools
- `PUT /api/schools/:id/subscription` - Update subscription

### School Admin
- `GET /api/schools/my` - Get current school details
- `PUT /api/schools/my` - Update school settings

## User Roles

| Role | Description |
|------|-------------|
| `super_admin` | Can access all schools (you) |
| `admin` | School admin, manages their school |
| `principal` | Same as admin, just different title |
| `teacher` | Teacher at a specific school |
| `learner` | Student at a specific school |

## Security Guarantees

1. **Database-level isolation**: All queries filtered by `school_id`
2. **JWT contains school**: Token includes user's school
3. **Middleware validation**: Every request verified for school access
4. **Subscription limits**: Enforced on teacher/learner counts

## Revenue Models

| Plan | Max Teachers | Max Learners | Price (Monthly) |
|------|--------------|--------------|-----------------|
| Free | 3 | 100 | R0 |
| Basic | 10 | 500 | R500 |
| Premium | 50 | 2000 | R2000 |
| Enterprise | Unlimited | Unlimited | Custom |

## Next Steps

1. Run the database migration
2. Test with two sample schools
3. Add subscription payment integration (PayFast/Stripe)
4. Create onboarding flow for new schools

## Troubleshooting

**Users can't login after migration:**
```sql
-- Run this to assign all existing users to demo school
UPDATE users SET school_id = (SELECT id FROM schools WHERE code = 'DEMO') WHERE school_id IS NULL;
```

**"School not found" errors:**
- Check that JWT token contains school_id
- Verify school exists in database
- Ensure user.school_id is set correctly
