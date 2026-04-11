# E-tab Database Schema

Generated: 2026-04-09T15:16:06.316Z

## Table: access_logs

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | YES | - |
| action | character varying(50) | NO | - |
| resource_type | character varying(50) | YES | - |
| resource_id | uuid | YES | - |
| ip_address | inet | YES | - |
| user_agent | text | YES | - |
| metadata | jsonb | YES | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

**Primary Key:** id

---

## Table: admin_logs

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| admin_id | uuid | YES | - |
| action | character varying(50) | NO | - |
| target_type | character varying(50) | YES | - |
| target_id | uuid | YES | - |
| details | jsonb | YES | - |
| created_at | timestamp without time zone | YES | now() |

**Primary Key:** id

**Foreign Keys:**
- admin_id → admins(id)

---

## Table: admins

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| email | character varying(255) | NO | - |
| password_hash | character varying(255) | NO | - |
| first_name | character varying(100) | NO | - |
| last_name | character varying(100) | NO | - |
| phone | character varying(20) | YES | - |
| is_super_admin | boolean | YES | false |
| is_active | boolean | YES | true |
| last_login | timestamp without time zone | YES | - |
| created_at | timestamp without time zone | YES | now() |
| updated_at | timestamp without time zone | YES | now() |

**Primary Key:** id

**Unique Constraints:** email

---

## Table: ai_tutor_conversations

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| learner_id | uuid | NO | - |
| subject | character varying(50) | NO | - |
| message | text | NO | - |
| response | text | NO | - |
| context | text | YES | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| school_id | uuid | YES | - |

**Primary Key:** id

**Foreign Keys:**
- school_id → schools(id)
- learner_id → users(id)

---

## Table: ai_tutor_usage

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| learner_id | uuid | NO | - |
| usage_date | date | YES | CURRENT_DATE |
| question_count | integer | YES | 0 |

**Primary Key:** id

**Foreign Keys:**
- learner_id → users(id)

**Unique Constraints:** learner_id, usage_date

---

## Table: announcements

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| subject_id | uuid | NO | - |
| teacher_id | uuid | NO | - |
| title | character varying(255) | NO | - |
| content | text | NO | - |
| applicable_grades | ARRAY | YES | '{}'::character varying[] |
| is_pinned | boolean | YES | false |
| is_active | boolean | YES | true |
| view_count | integer | YES | 0 |
| created_at | timestamp without time zone | YES | now() |
| updated_at | timestamp without time zone | YES | now() |
| applicable_grade_ids | ARRAY | YES | - |
| school_id | uuid | YES | - |

**Primary Key:** id

**Foreign Keys:**
- school_id → schools(id)
- teacher_id → users(id)
- subject_id → modules(id)

---

## Table: assignment_submissions

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| assignment_id | uuid | NO | - |
| learner_id | uuid | NO | - |
| submission_text | text | YES | - |
| submission_url | character varying(500) | YES | - |
| file_url | character varying(500) | YES | - |
| file_name | character varying(255) | YES | - |
| file_type | character varying(100) | YES | - |
| marks_obtained | integer | YES | - |
| feedback | text | YES | - |
| status | character varying(20) | YES | 'submitted'::character varying |
| submitted_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| graded_at | timestamp without time zone | YES | - |
| graded_by | uuid | YES | - |
| is_late | boolean | YES | false |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| school_id | uuid | YES | - |
| original_filename | character varying(500) | YES | - |
| file_size | bigint | YES | 0 |

**Primary Key:** id

**Foreign Keys:**
- school_id → schools(id)
- assignment_id → assignments(id)
- learner_id → users(id)
- graded_by → users(id)

**Unique Constraints:** assignment_id, learner_id

---

## Table: assignments

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| title | character varying(255) | NO | - |
| description | text | YES | - |
| subject_id | uuid | NO | - |
| teacher_id | uuid | YES | - |
| grade | character varying(20) | YES | - |
| due_date | timestamp without time zone | YES | - |
| total_marks | integer | YES | 100 |
| assignment_type | character varying(50) | YES | - |
| instructions | text | YES | - |
| attachment_url | character varying(500) | YES | - |
| is_published | boolean | YES | false |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| max_marks | integer | YES | 100 |
| passing_marks | integer | YES | 50 |
| allow_late_submission | boolean | YES | false |
| late_penalty_percent | integer | YES | 0 |
| submission_type | character varying(50) | YES | 'file'::character varying |
| max_file_size_mb | integer | YES | 10 |
| allowed_file_types | ARRAY | YES | - |
| applicable_grades | ARRAY | YES | - |
| applicable_grade_ids | ARRAY | YES | - |
| available_from | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| status | character varying(20) | YES | 'draft'::character varying |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| school_id | uuid | YES | - |

**Primary Key:** id

**Foreign Keys:**
- school_id → schools(id)
- subject_id → modules(id)

---

## Table: deadlines

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | uuid_generate_v4() |
| subject_id | uuid | YES | - |
| teacher_id | uuid | YES | - |
| title | character varying(255) | NO | - |
| description | text | YES | - |
| due_date | timestamp without time zone | NO | - |
| max_marks | numeric | YES | - |
| weight_percentage | numeric | YES | - |
| applicable_grades | ARRAY | YES | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| grade_id | uuid | YES | - |

**Primary Key:** id

**Foreign Keys:**
- grade_id → grades(id)
- subject_id → subjects(id)

---

## Table: enrollments

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | uuid_generate_v4() |
| learner_id | uuid | YES | - |
| subject_id | uuid | YES | - |
| grade | USER-DEFINED | NO | - |
| academic_year | character varying(10) | NO | - |
| semester | character varying(20) | YES | 'Full Year'::character varying |
| term_1_mark | numeric | YES | - |
| term_2_mark | numeric | YES | - |
| term_3_mark | numeric | YES | - |
| term_4_mark | numeric | YES | - |
| final_mark | numeric | YES | - |
| has_passed | boolean | YES | - |
| status | USER-DEFINED | YES | 'active'::academic_status |
| enrolled_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| completed_at | timestamp without time zone | YES | - |

**Primary Key:** id

**Foreign Keys:**
- subject_id → subjects(id)

**Unique Constraints:** learner_id, subject_id, academic_year

---

## Table: grade_modules

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| grade_id | uuid | NO | - |
| module_id | uuid | NO | - |
| is_compulsory | boolean | YES | false |

**Primary Key:** grade_id, module_id

**Foreign Keys:**
- grade_id → grades(id)
- module_id → modules(id)

---

## Table: grade_progression

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | uuid_generate_v4() |
| learner_id | uuid | YES | - |
| from_grade | USER-DEFINED | NO | - |
| to_grade | USER-DEFINED | NO | - |
| academic_year | character varying(10) | NO | - |
| promotion_date | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| reason | character varying(50) | YES | 'passed'::character varying |
| all_subjects_passed | boolean | YES | true |

**Primary Key:** id

---

## Table: grade_subjects

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| subject_id | uuid | NO | - |
| grade | character varying(20) | NO | - |
| is_compulsory | boolean | YES | false |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

**Primary Key:** id

**Foreign Keys:**
- subject_id → subjects(id)

**Unique Constraints:** subject_id, grade

---

## Table: grades

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| name | character varying(20) | NO | - |
| phase | character varying(20) | NO | - |
| level | integer | NO | - |

**Primary Key:** id

**Unique Constraints:** name, level

---

## Table: learner_modules

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| learner_id | uuid | YES | - |
| module_id | uuid | YES | - |
| grade_id | uuid | YES | - |
| status | character varying(20) | YES | 'active'::character varying |
| progress_percent | integer | YES | 0 |
| enrolled_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| completion_percentage | integer | YES | 0 |

**Primary Key:** id

**Foreign Keys:**
- module_id → modules(id)
- grade_id → grades(id)

**Unique Constraints:** learner_id, module_id

---

## Table: learner_profiles

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | - |
| selected_grade | character varying(20) | NO | - |
| enrolled_modules | jsonb | YES | '[]'::jsonb |
| enrollment_date | timestamp without time zone | YES | CURRENT_TIMESTAMP |

**Primary Key:** id

**Unique Constraints:** user_id

---

## Table: learner_subjects

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| learner_id | uuid | NO | - |
| subject_id | uuid | NO | - |
| grade_at_enrollment | character varying(20) | YES | - |
| enrollment_date | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| status | character varying(20) | YES | 'active'::character varying |
| progress_percent | integer | YES | 0 |

**Primary Key:** id

**Foreign Keys:**
- subject_id → subjects(id)

**Unique Constraints:** learner_id, subject_id

---

## Table: materials

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | uuid_generate_v4() |
| subject_id | uuid | YES | - |
| uploaded_by | uuid | YES | - |
| title | character varying(255) | NO | - |
| description | text | YES | - |
| file_url | text | NO | - |
| file_type | character varying(50) | YES | - |
| file_size_bytes | bigint | YES | - |
| week_number | integer | YES | - |
| is_published | boolean | YES | false |
| download_count | integer | YES | 0 |
| view_count | integer | YES | 0 |
| applicable_grades | ARRAY | YES | - |
| cloudinary_public_id | character varying(255) | YES | - |
| cloudinary_resource_type | character varying(20) | YES | 'raw'::character varying |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| grade_id | uuid | YES | - |
| school_id | uuid | YES | - |
| original_filename | character varying(500) | YES | - |

**Primary Key:** id

**Foreign Keys:**
- school_id → schools(id)
- grade_id → grades(id)
- subject_id → modules(id)

---

## Table: modules

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| code | character varying(50) | NO | - |
| name | character varying(200) | NO | - |
| description | text | YES | - |
| department | character varying(100) | NO | - |
| credits | integer | YES | 1 |
| is_active | boolean | YES | true |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| school_id | uuid | YES | - |
| school_code | character varying(20) | YES | - |

**Primary Key:** id

**Foreign Keys:**
- school_id → schools(id)

**Unique Constraints:** code

---

## Table: notifications

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | uuid_generate_v4() |
| user_id | uuid | YES | - |
| title | character varying(255) | NO | - |
| message | text | YES | - |
| type | character varying(50) | YES | 'general'::character varying |
| is_read | boolean | YES | false |
| related_subject_id | uuid | YES | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| related_id | uuid | YES | - |
| read_at | timestamp without time zone | YES | - |
| school_id | uuid | YES | - |

**Primary Key:** id

**Foreign Keys:**
- school_id → schools(id)
- related_subject_id → subjects(id)

---

## Table: pending_teachers

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| email | character varying(255) | NO | - |
| password_hash | character varying(255) | NO | - |
| first_name | character varying(100) | NO | - |
| last_name | character varying(100) | NO | - |
| employee_number | character varying(50) | YES | - |
| qualification | character varying(255) | YES | - |
| specialization | character varying(255) | YES | - |
| years_experience | integer | YES | 0 |
| bio | text | YES | - |
| assignments | jsonb | YES | '[]'::jsonb |
| status | character varying(20) | YES | 'pending'::character varying |
| requested_at | timestamp without time zone | YES | now() |
| reviewed_at | timestamp without time zone | YES | - |
| reviewed_by | uuid | YES | - |
| rejection_reason | text | YES | - |
| school_id | uuid | YES | - |
| school_code | character varying(20) | YES | - |

**Primary Key:** id

**Foreign Keys:**
- school_id → schools(id)

**Unique Constraints:** email

---

## Table: quiz_answers

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| attempt_id | uuid | NO | - |
| question_id | uuid | NO | - |
| answer_text | text | YES | - |
| selected_options | jsonb | YES | - |
| is_correct | boolean | YES | - |
| points_earned | integer | YES | 0 |
| points_possible | integer | YES | 0 |
| teacher_override | boolean | YES | false |
| teacher_adjusted_points | integer | YES | - |
| teacher_feedback | text | YES | - |
| created_at | timestamp without time zone | YES | now() |

**Primary Key:** id

**Foreign Keys:**
- attempt_id → quiz_attempts(id)
- question_id → quiz_questions(id)

---

## Table: quiz_attempts

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| quiz_id | uuid | NO | - |
| learner_id | uuid | NO | - |
| status | character varying(20) | YES | 'in_progress'::character varying |
| started_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| completed_at | timestamp without time zone | YES | - |
| answers | jsonb | YES | '{}'::jsonb |
| score | integer | YES | - |
| percentage | numeric | YES | - |
| passed | boolean | YES | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| submitted_at | timestamp without time zone | YES | - |
| time_taken_seconds | integer | YES | - |
| total_score | integer | YES | 0 |
| max_possible_score | integer | YES | 0 |
| percentage_score | numeric | YES | - |
| auto_marked | boolean | YES | true |
| teacher_reviewed | boolean | YES | false |
| teacher_id | uuid | YES | - |
| teacher_notes | text | YES | - |
| adjusted_score | integer | YES | - |
| school_id | uuid | YES | - |

**Primary Key:** id

**Foreign Keys:**
- school_id → schools(id)
- teacher_id → users(id)

---

## Table: quiz_questions

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| quiz_id | uuid | NO | - |
| question_text | text | NO | - |
| question_type | character varying(50) | NO | 'multiple_choice'::character varying |
| options | jsonb | YES | - |
| correct_answer | jsonb | YES | - |
| marks | integer | YES | 1 |
| explanation | text | YES | - |
| question_order | integer | YES | 1 |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| correct_answers | jsonb | YES | - |
| points | integer | YES | 1 |
| case_sensitive | boolean | YES | false |

**Primary Key:** id

---

## Table: quizzes

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| subject_id | uuid | NO | - |
| teacher_id | uuid | NO | - |
| title | character varying(255) | NO | - |
| description | text | YES | - |
| time_limit_minutes | integer | YES | 30 |
| max_attempts | integer | YES | 1 |
| passing_score | integer | YES | 50 |
| total_marks | integer | YES | 0 |
| shuffle_questions | boolean | YES | false |
| show_correct_answers | boolean | YES | true |
| applicable_grades | ARRAY | YES | - |
| applicable_grade_ids | ARRAY | YES | - |
| is_published | boolean | YES | false |
| status | character varying(20) | YES | 'draft'::character varying |
| available_from | timestamp without time zone | YES | - |
| available_until | timestamp without time zone | YES | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| school_id | uuid | YES | - |

**Primary Key:** id

**Foreign Keys:**
- school_id → schools(id)
- subject_id → modules(id)

---

## Table: school_admins

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| school_id | uuid | NO | - |
| user_id | uuid | NO | - |
| role | character varying(50) | YES | 'admin'::character varying |
| permissions | jsonb | YES | '{}'::jsonb |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

**Primary Key:** id

**Foreign Keys:**
- school_id → schools(id)
- user_id → users(id)

**Unique Constraints:** school_id, user_id

---

## Table: schools

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| name | character varying(255) | NO | - |
| code | character varying(50) | NO | - |
| logo_url | text | YES | - |
| address | text | YES | - |
| phone | character varying(50) | YES | - |
| email | character varying(255) | YES | - |
| principal_name | character varying(255) | YES | - |
| emis_number | character varying(50) | YES | - |
| province | character varying(100) | YES | - |
| is_active | boolean | YES | true |
| subscription_plan | character varying(50) | YES | 'free'::character varying |
| subscription_expires_at | timestamp without time zone | YES | - |
| max_teachers | integer | YES | 10 |
| max_learners | integer | YES | 500 |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| school_type | character varying(20) | YES | 'high_school'::character varying |
| smtp_host | character varying(255) | YES | - |
| smtp_port | integer | YES | 587 |
| smtp_user | character varying(255) | YES | - |
| smtp_password | character varying(255) | YES | - |
| smtp_from_email | character varying(255) | YES | - |
| smtp_from_name | character varying(255) | YES | 'E-tab Learning'::character varying |
| smtp_secure | boolean | YES | false |
| smtp_enabled | boolean | YES | false |

**Primary Key:** id

**Unique Constraints:** code

---

## Table: subject_messages

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| subject_id | uuid | NO | - |
| sender_id | uuid | NO | - |
| sender_role | character varying(20) | NO | - |
| recipient_id | uuid | NO | - |
| message | text | NO | - |
| is_read | boolean | YES | false |
| read_at | timestamp without time zone | YES | - |
| parent_message_id | uuid | YES | - |
| created_at | timestamp without time zone | YES | now() |

**Primary Key:** id

**Foreign Keys:**
- subject_id → modules(id)
- sender_id → users(id)
- recipient_id → users(id)
- parent_message_id → subject_messages(id)

---

## Table: subject_selection

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| grade | character varying(20) | NO | - |
| modules | jsonb | NO | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

**Primary Key:** id

**Unique Constraints:** grade

---

## Table: subjects

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | uuid_generate_v4() |
| code | character varying(20) | NO | - |
| name | character varying(255) | NO | - |
| description | text | YES | - |
| phase | USER-DEFINED | NO | - |
| applicable_grades | ARRAY | NO | - |
| credits | integer | YES | 1 |
| is_compulsory | boolean | YES | true |
| department | character varying(100) | YES | - |
| cover_image_url | text | YES | - |
| cloudinary_public_id | character varying(255) | YES | - |
| is_active | boolean | YES | true |
| created_by | uuid | YES | - |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| school_id | uuid | YES | - |
| school_code | character varying(20) | YES | - |

**Primary Key:** id

**Foreign Keys:**
- school_id → schools(id)

**Unique Constraints:** code

---

## Table: subjectselection

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| grade | character varying(20) | NO | - |
| modules | jsonb | NO | - |
| phase | character varying(20) | NO | - |
| total_credits | integer | YES | 0 |
| created_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |

**Primary Key:** id

**Unique Constraints:** grade

---

## Table: submissions

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| assignment_id | uuid | NO | - |
| student_id | uuid | NO | - |
| submission_text | text | YES | - |
| attachment_url | character varying(500) | YES | - |
| marks_obtained | integer | YES | - |
| feedback | text | YES | - |
| status | character varying(20) | YES | 'submitted'::character varying |
| submitted_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| graded_at | timestamp without time zone | YES | - |

**Primary Key:** id

**Foreign Keys:**
- assignment_id → assignments(id)

---

## Table: support_messages

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| user_id | uuid | NO | - |
| subject | character varying(255) | NO | - |
| message | text | NO | - |
| category | character varying(50) | YES | 'general'::character varying |
| status | character varying(20) | YES | 'open'::character varying |
| admin_response | text | YES | - |
| responded_by | uuid | YES | - |
| responded_at | timestamp without time zone | YES | - |
| created_at | timestamp without time zone | YES | now() |
| school_id | uuid | YES | - |
| is_read | boolean | YES | false |
| user_notified | boolean | YES | false |
| is_super_admin_message | boolean | YES | false |

**Primary Key:** id

**Foreign Keys:**
- user_id → users(id)
- school_id → schools(id)

---

## Table: teacher_assignments

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | uuid_generate_v4() |
| teacher_id | uuid | YES | - |
| subject_id | uuid | YES | - |
| academic_year | character varying(10) | NO | - |
| is_active | boolean | YES | true |
| assigned_at | timestamp without time zone | YES | CURRENT_TIMESTAMP |
| grade_id | uuid | YES | - |
| is_primary | boolean | YES | false |

**Primary Key:** id

**Foreign Keys:**
- grade_id → grades(id)
- subject_id → modules(id)

**Unique Constraints:** teacher_id, subject_id, academic_year, teacher_id, subject_id, academic_year

---

## Table: users

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | NO | gen_random_uuid() |
| email | character varying(255) | NO | - |
| password_hash | character varying(255) | NO | - |
| first_name | character varying(100) | NO | - |
| last_name | character varying(100) | NO | - |
| role | character varying(20) | NO | 'learner'::character varying |
| grade_id | uuid | YES | - |
| grade | character varying(20) | YES | - |
| current_grade | integer | YES | - |
| teacher_subjects | ARRAY | YES | - |
| is_active | boolean | YES | true |
| created_at | timestamp with time zone | YES | CURRENT_TIMESTAMP |
| updated_at | timestamp with time zone | YES | CURRENT_TIMESTAMP |
| last_login | timestamp with time zone | YES | - |
| school_id | uuid | YES | - |
| school_code | character varying(20) | YES | - |
| phone | character varying(50) | YES | - |
| bio | text | YES | - |
| avatar_url | character varying(500) | YES | - |
| email_notifications | boolean | YES | true |

**Primary Key:** id

**Foreign Keys:**
- grade_id → grades(id)
- school_id → schools(id)

**Unique Constraints:** email

---

## Table: users_backup

| Column | Type | Nullable | Default |
|--------|------|----------|----------|
| id | uuid | YES | - |
| email | character varying(255) | YES | - |
| password_hash | character varying(255) | YES | - |
| first_name | character varying(100) | YES | - |
| last_name | character varying(100) | YES | - |
| role | USER-DEFINED | YES | - |
| current_grade | USER-DEFINED | YES | - |
| teacher_subjects | ARRAY | YES | - |
| profile_image_url | text | YES | - |
| cloudinary_public_id | character varying(255) | YES | - |
| is_active | boolean | YES | - |
| last_login | timestamp without time zone | YES | - |
| created_at | timestamp without time zone | YES | - |
| updated_at | timestamp without time zone | YES | - |
| grade | character varying(20) | YES | - |
| grade_id | uuid | YES | - |

---

## Indexes

| Table | Index | Definition |
|-------|-------|------------|
| access_logs | access_logs_pkey | CREATE UNIQUE INDEX access_logs_pkey ON public.access_logs USING btree (id)... |
| admin_logs | admin_logs_pkey | CREATE UNIQUE INDEX admin_logs_pkey ON public.admin_logs USING btree (id)... |
| admins | admins_email_key | CREATE UNIQUE INDEX admins_email_key ON public.admins USING btree (email)... |
| admins | admins_pkey | CREATE UNIQUE INDEX admins_pkey ON public.admins USING btree (id)... |
| ai_tutor_conversations | ai_tutor_conversations_pkey | CREATE UNIQUE INDEX ai_tutor_conversations_pkey ON public.ai_tutor_conversations USING btree (id)... |
| ai_tutor_conversations | idx_ai_tutor_date | CREATE INDEX idx_ai_tutor_date ON public.ai_tutor_conversations USING btree (created_at)... |
| ai_tutor_conversations | idx_ai_tutor_learner | CREATE INDEX idx_ai_tutor_learner ON public.ai_tutor_conversations USING btree (learner_id)... |
| ai_tutor_conversations | idx_ai_tutor_school | CREATE INDEX idx_ai_tutor_school ON public.ai_tutor_conversations USING btree (school_id)... |
| ai_tutor_conversations | idx_ai_tutor_subject | CREATE INDEX idx_ai_tutor_subject ON public.ai_tutor_conversations USING btree (subject)... |
| ai_tutor_usage | ai_tutor_usage_learner_id_usage_date_key | CREATE UNIQUE INDEX ai_tutor_usage_learner_id_usage_date_key ON public.ai_tutor_usage USING btree (l... |
| ai_tutor_usage | ai_tutor_usage_pkey | CREATE UNIQUE INDEX ai_tutor_usage_pkey ON public.ai_tutor_usage USING btree (id)... |
| ai_tutor_usage | idx_ai_usage_learner_date | CREATE INDEX idx_ai_usage_learner_date ON public.ai_tutor_usage USING btree (learner_id, usage_date)... |
| announcements | announcements_pkey | CREATE UNIQUE INDEX announcements_pkey ON public.announcements USING btree (id)... |
| announcements | idx_announcements_active | CREATE INDEX idx_announcements_active ON public.announcements USING btree (is_active, created_at DES... |
| announcements | idx_announcements_school | CREATE INDEX idx_announcements_school ON public.announcements USING btree (school_id)... |
| announcements | idx_announcements_subject | CREATE INDEX idx_announcements_subject ON public.announcements USING btree (subject_id)... |
| announcements | idx_announcements_teacher | CREATE INDEX idx_announcements_teacher ON public.announcements USING btree (teacher_id)... |
| assignment_submissions | assignment_submissions_assignment_id_learner_id_key | CREATE UNIQUE INDEX assignment_submissions_assignment_id_learner_id_key ON public.assignment_submiss... |
| assignment_submissions | assignment_submissions_pkey | CREATE UNIQUE INDEX assignment_submissions_pkey ON public.assignment_submissions USING btree (id)... |
| assignment_submissions | idx_submissions_school | CREATE INDEX idx_submissions_school ON public.assignment_submissions USING btree (school_id)... |
| assignments | assignments_pkey | CREATE UNIQUE INDEX assignments_pkey ON public.assignments USING btree (id)... |
| assignments | idx_assignments_school | CREATE INDEX idx_assignments_school ON public.assignments USING btree (school_id)... |
| assignments | idx_assignments_teacher | CREATE INDEX idx_assignments_teacher ON public.assignments USING btree (teacher_id)... |
| deadlines | deadlines_pkey | CREATE UNIQUE INDEX deadlines_pkey ON public.deadlines USING btree (id)... |
| deadlines | idx_deadlines_subject | CREATE INDEX idx_deadlines_subject ON public.deadlines USING btree (subject_id)... |
| enrollments | enrollments_learner_id_subject_id_academic_year_key | CREATE UNIQUE INDEX enrollments_learner_id_subject_id_academic_year_key ON public.enrollments USING ... |
| enrollments | enrollments_pkey | CREATE UNIQUE INDEX enrollments_pkey ON public.enrollments USING btree (id)... |
| enrollments | idx_enrollments_learner | CREATE INDEX idx_enrollments_learner ON public.enrollments USING btree (learner_id)... |
| enrollments | idx_enrollments_status | CREATE INDEX idx_enrollments_status ON public.enrollments USING btree (status)... |
| enrollments | idx_enrollments_subject | CREATE INDEX idx_enrollments_subject ON public.enrollments USING btree (subject_id)... |
| grade_modules | grade_modules_pkey | CREATE UNIQUE INDEX grade_modules_pkey ON public.grade_modules USING btree (grade_id, module_id)... |
| grade_modules | idx_grade_modules_grade | CREATE INDEX idx_grade_modules_grade ON public.grade_modules USING btree (grade_id)... |
| grade_modules | idx_grade_modules_module | CREATE INDEX idx_grade_modules_module ON public.grade_modules USING btree (module_id)... |
| grade_progression | grade_progression_pkey | CREATE UNIQUE INDEX grade_progression_pkey ON public.grade_progression USING btree (id)... |
| grade_subjects | grade_subjects_pkey | CREATE UNIQUE INDEX grade_subjects_pkey ON public.grade_subjects USING btree (id)... |
| grade_subjects | grade_subjects_subject_id_grade_key | CREATE UNIQUE INDEX grade_subjects_subject_id_grade_key ON public.grade_subjects USING btree (subjec... |
| grade_subjects | idx_grade_subjects_grade | CREATE INDEX idx_grade_subjects_grade ON public.grade_subjects USING btree (grade)... |
| grade_subjects | idx_grade_subjects_subject | CREATE INDEX idx_grade_subjects_subject ON public.grade_subjects USING btree (subject_id)... |
| grades | grades_level_key | CREATE UNIQUE INDEX grades_level_key ON public.grades USING btree (level)... |
| grades | grades_name_key | CREATE UNIQUE INDEX grades_name_key ON public.grades USING btree (name)... |
| grades | grades_pkey | CREATE UNIQUE INDEX grades_pkey ON public.grades USING btree (id)... |
| learner_modules | idx_learner_modules_learner | CREATE INDEX idx_learner_modules_learner ON public.learner_modules USING btree (learner_id)... |
| learner_modules | idx_learner_modules_module | CREATE INDEX idx_learner_modules_module ON public.learner_modules USING btree (module_id)... |
| learner_modules | learner_modules_learner_id_module_id_key | CREATE UNIQUE INDEX learner_modules_learner_id_module_id_key ON public.learner_modules USING btree (... |
| learner_modules | learner_modules_pkey | CREATE UNIQUE INDEX learner_modules_pkey ON public.learner_modules USING btree (id)... |
| learner_profiles | learner_profiles_pkey | CREATE UNIQUE INDEX learner_profiles_pkey ON public.learner_profiles USING btree (id)... |
| learner_profiles | learner_profiles_user_id_key | CREATE UNIQUE INDEX learner_profiles_user_id_key ON public.learner_profiles USING btree (user_id)... |
| learner_subjects | idx_learner_subjects_learner | CREATE INDEX idx_learner_subjects_learner ON public.learner_subjects USING btree (learner_id)... |
| learner_subjects | idx_learner_subjects_subject | CREATE INDEX idx_learner_subjects_subject ON public.learner_subjects USING btree (subject_id)... |
| learner_subjects | learner_subjects_learner_id_subject_id_key | CREATE UNIQUE INDEX learner_subjects_learner_id_subject_id_key ON public.learner_subjects USING btre... |
| learner_subjects | learner_subjects_pkey | CREATE UNIQUE INDEX learner_subjects_pkey ON public.learner_subjects USING btree (id)... |
| materials | idx_materials_school | CREATE INDEX idx_materials_school ON public.materials USING btree (school_id)... |
| materials | materials_pkey | CREATE UNIQUE INDEX materials_pkey ON public.materials USING btree (id)... |
| modules | idx_modules_school | CREATE INDEX idx_modules_school ON public.modules USING btree (school_id)... |
| modules | modules_code_key | CREATE UNIQUE INDEX modules_code_key ON public.modules USING btree (code)... |
| modules | modules_pkey | CREATE UNIQUE INDEX modules_pkey ON public.modules USING btree (id)... |
| notifications | idx_notifications_school | CREATE INDEX idx_notifications_school ON public.notifications USING btree (school_id)... |
| notifications | idx_notifications_user | CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, is_read)... |
| notifications | notifications_pkey | CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id)... |
| pending_teachers | idx_pending_teachers_school | CREATE INDEX idx_pending_teachers_school ON public.pending_teachers USING btree (school_id)... |
| pending_teachers | pending_teachers_email_key | CREATE UNIQUE INDEX pending_teachers_email_key ON public.pending_teachers USING btree (email)... |
| pending_teachers | pending_teachers_pkey | CREATE UNIQUE INDEX pending_teachers_pkey ON public.pending_teachers USING btree (id)... |
| quiz_answers | idx_quiz_answers_attempt_id | CREATE INDEX idx_quiz_answers_attempt_id ON public.quiz_answers USING btree (attempt_id)... |
| quiz_answers | idx_quiz_answers_question_id | CREATE INDEX idx_quiz_answers_question_id ON public.quiz_answers USING btree (question_id)... |
| quiz_answers | quiz_answers_pkey | CREATE UNIQUE INDEX quiz_answers_pkey ON public.quiz_answers USING btree (id)... |
| quiz_attempts | idx_quiz_attempts_created_at | CREATE INDEX idx_quiz_attempts_created_at ON public.quiz_attempts USING btree (created_at)... |
| quiz_attempts | idx_quiz_attempts_learner_id | CREATE INDEX idx_quiz_attempts_learner_id ON public.quiz_attempts USING btree (learner_id)... |
| quiz_attempts | idx_quiz_attempts_quiz_id | CREATE INDEX idx_quiz_attempts_quiz_id ON public.quiz_attempts USING btree (quiz_id)... |
| quiz_attempts | idx_quiz_attempts_school | CREATE INDEX idx_quiz_attempts_school ON public.quiz_attempts USING btree (school_id)... |
| quiz_attempts | idx_quiz_attempts_status | CREATE INDEX idx_quiz_attempts_status ON public.quiz_attempts USING btree (status)... |
| quiz_attempts | quiz_attempts_pkey | CREATE UNIQUE INDEX quiz_attempts_pkey ON public.quiz_attempts USING btree (id)... |
| quiz_questions | quiz_questions_pkey | CREATE UNIQUE INDEX quiz_questions_pkey ON public.quiz_questions USING btree (id)... |
| quizzes | idx_quizzes_school | CREATE INDEX idx_quizzes_school ON public.quizzes USING btree (school_id)... |
| quizzes | quizzes_pkey | CREATE UNIQUE INDEX quizzes_pkey ON public.quizzes USING btree (id)... |
| school_admins | school_admins_pkey | CREATE UNIQUE INDEX school_admins_pkey ON public.school_admins USING btree (id)... |
| school_admins | school_admins_school_id_user_id_key | CREATE UNIQUE INDEX school_admins_school_id_user_id_key ON public.school_admins USING btree (school_... |
| schools | idx_schools_active | CREATE INDEX idx_schools_active ON public.schools USING btree (is_active)... |
| schools | idx_schools_code | CREATE INDEX idx_schools_code ON public.schools USING btree (code)... |
| schools | schools_code_key | CREATE UNIQUE INDEX schools_code_key ON public.schools USING btree (code)... |
| schools | schools_pkey | CREATE UNIQUE INDEX schools_pkey ON public.schools USING btree (id)... |
| subject_messages | idx_subject_messages_created_at | CREATE INDEX idx_subject_messages_created_at ON public.subject_messages USING btree (created_at)... |
| subject_messages | idx_subject_messages_is_read | CREATE INDEX idx_subject_messages_is_read ON public.subject_messages USING btree (is_read)... |
| subject_messages | idx_subject_messages_recipient_id | CREATE INDEX idx_subject_messages_recipient_id ON public.subject_messages USING btree (recipient_id)... |
| subject_messages | idx_subject_messages_sender_id | CREATE INDEX idx_subject_messages_sender_id ON public.subject_messages USING btree (sender_id)... |
| subject_messages | idx_subject_messages_subject_id | CREATE INDEX idx_subject_messages_subject_id ON public.subject_messages USING btree (subject_id)... |
| subject_messages | subject_messages_pkey | CREATE UNIQUE INDEX subject_messages_pkey ON public.subject_messages USING btree (id)... |
| subject_selection | idx_subject_selection_grade | CREATE INDEX idx_subject_selection_grade ON public.subject_selection USING btree (grade)... |
| subject_selection | subject_selection_grade_key | CREATE UNIQUE INDEX subject_selection_grade_key ON public.subject_selection USING btree (grade)... |
| subject_selection | subject_selection_pkey | CREATE UNIQUE INDEX subject_selection_pkey ON public.subject_selection USING btree (id)... |
| subjects | idx_subjects_phase | CREATE INDEX idx_subjects_phase ON public.subjects USING btree (phase)... |
| subjects | idx_subjects_school_code | CREATE INDEX idx_subjects_school_code ON public.subjects USING btree (school_code)... |
| subjects | idx_subjects_school_id | CREATE INDEX idx_subjects_school_id ON public.subjects USING btree (school_id)... |
| subjects | subjects_code_key | CREATE UNIQUE INDEX subjects_code_key ON public.subjects USING btree (code)... |
| subjects | subjects_pkey | CREATE UNIQUE INDEX subjects_pkey ON public.subjects USING btree (id)... |
| subjectselection | idx_subjectselection_grade | CREATE INDEX idx_subjectselection_grade ON public.subjectselection USING btree (grade)... |
| subjectselection | subjectselection_grade_key | CREATE UNIQUE INDEX subjectselection_grade_key ON public.subjectselection USING btree (grade)... |
| subjectselection | subjectselection_pkey | CREATE UNIQUE INDEX subjectselection_pkey ON public.subjectselection USING btree (id)... |
| submissions | idx_submissions_assignment | CREATE INDEX idx_submissions_assignment ON public.submissions USING btree (assignment_id)... |
| submissions | idx_submissions_student | CREATE INDEX idx_submissions_student ON public.submissions USING btree (student_id)... |
| submissions | submissions_pkey | CREATE UNIQUE INDEX submissions_pkey ON public.submissions USING btree (id)... |
| support_messages | idx_support_messages_created_at | CREATE INDEX idx_support_messages_created_at ON public.support_messages USING btree (created_at)... |
| support_messages | idx_support_messages_school_id | CREATE INDEX idx_support_messages_school_id ON public.support_messages USING btree (school_id)... |
| support_messages | idx_support_messages_status | CREATE INDEX idx_support_messages_status ON public.support_messages USING btree (status)... |
| support_messages | idx_support_messages_user_id | CREATE INDEX idx_support_messages_user_id ON public.support_messages USING btree (user_id)... |
| support_messages | support_messages_pkey | CREATE UNIQUE INDEX support_messages_pkey ON public.support_messages USING btree (id)... |
| teacher_assignments | idx_teacher_assignments_grade | CREATE INDEX idx_teacher_assignments_grade ON public.teacher_assignments USING btree (grade_id)... |
| teacher_assignments | idx_teacher_assignments_teacher | CREATE INDEX idx_teacher_assignments_teacher ON public.teacher_assignments USING btree (teacher_id)... |
| teacher_assignments | teacher_assignments_pkey | CREATE UNIQUE INDEX teacher_assignments_pkey ON public.teacher_assignments USING btree (id)... |
| teacher_assignments | teacher_assignments_teacher_id_subject_id_academic_year_key | CREATE UNIQUE INDEX teacher_assignments_teacher_id_subject_id_academic_year_key ON public.teacher_as... |
| teacher_assignments | teacher_assignments_teacher_subject_year_unique | CREATE UNIQUE INDEX teacher_assignments_teacher_subject_year_unique ON public.teacher_assignments US... |
| users | idx_users_current_grade | CREATE INDEX idx_users_current_grade ON public.users USING btree (current_grade)... |
| users | idx_users_email | CREATE INDEX idx_users_email ON public.users USING btree (email)... |
| users | idx_users_grade_id | CREATE INDEX idx_users_grade_id ON public.users USING btree (grade_id)... |
| users | idx_users_role | CREATE INDEX idx_users_role ON public.users USING btree (role)... |
| users | idx_users_school | CREATE INDEX idx_users_school ON public.users USING btree (school_id)... |
| users | users_email_key | CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)... |
| users | users_pkey | CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)... |
