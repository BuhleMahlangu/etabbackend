const db = require('./src/config/database');

async function checkAssignments() {
  // Check all assignments
  const allRes = await db.query(`
    SELECT a.id, a.title, a.subject_id, a.is_published, a.status, a.applicable_grade_ids,
           m.name as subject_name
    FROM assignments a
    JOIN modules m ON a.subject_id = m.id
  `);
  
  console.log('All Assignments:');
  allRes.rows.forEach(a => {
    console.log('  -', a.title);
    console.log('    Subject:', a.subject_name, '| Published:', a.is_published, '| Status:', a.status);
    console.log('    Grade IDs:', a.applicable_grade_ids);
  });
  
  // Check published assignments for specific subject
  const mathId = '697dff02-24ce-4bd7-8cd5-8bf476ca1746';
  const mathRes = await db.query(`
    SELECT * FROM assignments 
    WHERE subject_id = $1 AND is_published = true AND status = 'published'
  `, [mathId]);
  
  console.log('\nPublished assignments for Mathematics:', mathRes.rows.length);
  
  process.exit(0);
}

checkAssignments();
