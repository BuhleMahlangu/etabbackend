# Admin Management API - Complete Reference

## Overview

School admins can now fully manage their school's users (teachers and learners) and subjects through the admin dashboard.

---

## 👥 User Management Endpoints

### Get User Details
```http
GET /api/admin/users/:id
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "learner",
    "grade": "Grade 10",
    "currentGrade": 10,
    "isActive": true,
    "schoolId": "uuid",
    "schoolCode": "DEMO"
  }
}
```

---

### Update User
```http
PUT /api/admin/users/:id
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "email": "newemail@example.com",
  "grade": "Grade 11"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User updated successfully",
  "user": { ... }
}
```

---

### Update User Status (Activate/Deactivate)
```http
PATCH /api/admin/users/:id/status
```

**Request Body:**
```json
{
  "isActive": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "User deactivated successfully",
  "user": { ... }
}
```

---

### Delete User
```http
DELETE /api/admin/users/:id
```

**Response:**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Note:** Also deletes related records (teacher_assignments, learner_modules, enrollments)

---

## 📚 Subject Management Endpoints

### List All Subjects
```http
GET /api/admin/subjects
```

**Query Parameters:**
- `phase` - Filter by phase (Foundation, Intermediate, Senior, FET)
- `grade` - Filter by grade name (e.g., "Grade 10")

**Response:**
```json
{
  "success": true,
  "count": 42,
  "subjects": [
    {
      "id": "uuid",
      "code": "DEMO-MATH-FET",
      "name": "Mathematics",
      "phase": "FET",
      "applicable_grades": ["Grade 10", "Grade 11", "Grade 12"],
      "department": "Mathematics",
      "credits": 10,
      "school_id": "uuid",
      "school_code": "DEMO",
      "is_active": true
    }
  ]
}
```

---

### Get Subject Details
```http
GET /api/admin/subjects/:id
```

**Response:**
```json
{
  "success": true,
  "subject": {
    "id": "uuid",
    "code": "DEMO-MATH-FET",
    "name": "Mathematics",
    ...
  }
}
```

---

### Create Subject
```http
POST /api/admin/subjects
```

**Request Body:**
```json
{
  "code": "MATH-FET",
  "name": "Mathematics",
  "phase": "FET",
  "applicableGrades": ["Grade 10", "Grade 11", "Grade 12"],
  "department": "Mathematics",
  "credits": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subject created successfully",
  "subject": {
    "id": "uuid",
    "code": "DEMO-MATH-FET",
    "name": "Mathematics",
    ...
  }
}
```

**Note:** School prefix (e.g., "DEMO-") is automatically added to the code

---

### Update Subject
```http
PUT /api/admin/subjects/:id
```

**Request Body:**
```json
{
  "name": "Advanced Mathematics",
  "applicableGrades": ["Grade 11", "Grade 12"],
  "department": "Mathematics",
  "credits": 15,
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subject updated successfully",
  "subject": { ... }
}
```

---

### Delete Subject
```http
DELETE /api/admin/subjects/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Subject deleted successfully"
}
```

---

## 🎓 Grade Management Endpoints

### List All Grades
```http
GET /api/admin/grades
```

**Response:**
```json
{
  "success": true,
  "count": 12,
  "grades": [
    {
      "id": "uuid",
      "name": "Grade 10",
      "level": 10,
      "phase": "FET"
    },
    {
      "id": "uuid",
      "name": "Grade 11",
      "level": 11,
      "phase": "FET"
    }
  ]
}
```

---

## 🔒 Security & Permissions

### School Admin Permissions:
- ✅ Can view/manage users from their school only
- ✅ Can view/manage subjects from their school only
- ✅ Cannot access other schools' data
- ✅ Cannot delete or modify users from other schools

### Super Admin Permissions:
- ✅ Can access all schools (if UI supports it)
- ✅ Can manage system-wide settings

---

## 📝 Complete Endpoint Summary

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard` | Get dashboard statistics |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/users` | List all users (teachers + learners) |
| GET | `/admin/users/:id` | Get user details |
| PUT | `/admin/users/:id` | Update user |
| PATCH | `/admin/users/:id/status` | Toggle user active status |
| DELETE | `/admin/users/:id` | Delete user |

### Teachers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/teachers` | List all teachers |
| GET | `/admin/teachers/pending` | List pending teachers |
| POST | `/admin/teachers/:id/approve` | Approve pending teacher |
| POST | `/admin/teachers/:id/reject` | Reject pending teacher |

### Learners
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/learners` | List all learners |

### Subjects
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/subjects` | List all subjects |
| GET | `/admin/subjects/:id` | Get subject details |
| POST | `/admin/subjects` | Create new subject |
| PUT | `/admin/subjects/:id` | Update subject |
| DELETE | `/admin/subjects/:id` | Delete subject |

### Grades
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/grades` | List all grades |

---

## 🧪 Testing

Run the test to verify all endpoints:
```bash
node test-admin-management.js
```

Expected result: ✅ 7/7 tests passed

---

## 🎉 Summary

School admins can now:
1. **Manage Users**
   - View all teachers and learners
   - Edit user information
   - Activate/deactivate accounts
   - Delete users

2. **Manage Subjects**
   - View all school subjects
   - Create new subjects
   - Edit subject details
   - Delete subjects

3. **View System Data**
   - Dashboard statistics
   - Grade structure
   - All managed within their school only

**All endpoints are school-scoped for security!** 🔐
