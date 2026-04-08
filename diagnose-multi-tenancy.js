const db = require('./src/config/database');

async function diagnoseIssues() {
  console.log('🔍 Diagnosing Multi-Tenancy Issues...\n');
  
  // Check 1: Orphaned records (records without valid school)
  console.log('1️⃣ Checking for orphaned records...');
  const orphaned = await db.query(`
    SELECT 'users' as table, COUNT(*) as count FROM users WHERE school_id IS NULL
    UNION ALL
    SELECT 'subjects', COUNT(*) FROM subjects WHERE school_id IS NULL
    UNION ALL
    SELECT 'modules', COUNT(*) FROM modules WHERE school_id IS NULL
    UNION ALL
    SELECT 'pending_teachers', COUNT(*) FROM pending_teachers WHERE school_id IS NULL
  `);
  console.log(orphaned.rows);
  
  // Check 2: School code mismatches
  console.log('\n2️⃣ Checking school_code consistency...');
  const mismatches = await db.query(`
    SELECT 
      u.email,
      u.school_code as user_code,
      s.code as school_code
    FROM users u
    JOIN schools s ON u.school_id = s.id
    WHERE u.school_code != s.code
  `);
  console.log(`Found ${mismatches.rows.length} mismatches`);
  if (mismatches.rows.length > 0) console.log(mismatches.rows.slice(0, 5));
  
  // Check 3: Cross-school references
  console.log('\n3️⃣ Checking for cross-school references...');
  const crossRefs = await db.query(`
    SELECT 
      ta.id,
      t.email as teacher,
      t.school_code as teacher_school,
      m.code as module,
      m.school_code as module_school
    FROM teacher_assignments ta
    JOIN users t ON ta.teacher_id = t.id
    JOIN modules m ON ta.subject_id = m.id
    WHERE t.school_id != m.school_id
  `);
  console.log(`Found ${crossRefs.rows.length} cross-school teacher assignments`);
  if (crossRefs.rows.length > 0) console.log(crossRefs.rows.slice(0, 5));
  
  // Check 4: Duplicate subject codes within same school
  console.log('\n4️⃣ Checking for duplicate subject codes per school...');
  const dups = await db.query(`
    SELECT school_code, code, COUNT(*) as count
    FROM subjects
    GROUP BY school_code, code
    HAVING COUNT(*) > 1
  `);
  console.log(`Found ${dups.rows.length} duplicate codes`);
  if (dups.rows.length > 0) console.log(dups.rows);
  
  // Check 5: Performance - query patterns
  console.log('\n5️⃣ Table sizes (performance indicators)...');
  const sizes = await db.query(`
    SELECT 
      'users' as table, COUNT(*) as rows FROM users
    UNION ALL SELECT 'subjects', COUNT(*) FROM subjects
    UNION ALL SELECT 'modules', COUNT(*) FROM modules
    UNION ALL SELECT 'learner_modules', COUNT(*) FROM learner_modules
    UNION ALL SELECT 'assignments', COUNT(*) FROM assignments
    UNION ALL SELECT 'teacher_assignments', COUNT(*) FROM teacher_assignments
  `);
  console.log(sizes.rows);
  
  // Check 6: Index usage on school columns
  console.log('\n6️⃣ Checking indexes on school columns...');
  const indexes = await db.query(`
    SELECT 
      tablename, 
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND (indexdef ILIKE '%school_id%' OR indexdef ILIKE '%school_code%')
    ORDER BY tablename
  `);
  console.log(`Found ${indexes.rows.length} indexes on school columns`);
  console.log(indexes.rows.map(r => `${r.tablename}: ${r.indexname}`).join('\n'));
  
  process.exit(0);
}

diagnoseIssues();
