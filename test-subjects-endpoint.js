const db = require('./src/config/database');

async function test() {
  try {
    const schoolId = '2dce4350-f837-439e-8047-b023b7ea936a'; // SSS school
    
    // Get school type
    const schoolResult = await db.query(
      'SELECT school_type FROM schools WHERE id = $1',
      [schoolId]
    );
    const schoolType = schoolResult.rows[0]?.school_type || 'high_school';
    console.log('School type:', schoolType);
    
    // Determine allowed phases
    let allowedPhases = [];
    if (schoolType === 'primary_school') {
      allowedPhases = ['Foundation', 'Intermediate'];
    } else if (schoolType === 'high_school') {
      allowedPhases = ['Senior', 'FET'];
    } else {
      allowedPhases = ['Foundation', 'Intermediate', 'Senior', 'FET'];
    }
    console.log('Allowed phases:', allowedPhases);
    
    // Build and run query
    let query = `
      SELECT s.*, 
             COALESCE(
               (SELECT bool_or(gm.is_compulsory) 
                FROM modules m 
                JOIN grade_modules gm ON m.id = gm.module_id 
                WHERE m.code = s.code AND m.school_id = s.school_id),
               false
             ) as has_compulsory,
             COALESCE(
               (SELECT bool_or(NOT gm.is_compulsory) 
                FROM modules m 
                JOIN grade_modules gm ON m.id = gm.module_id 
                WHERE m.code = s.code AND m.school_id = s.school_id),
               false
             ) as has_optional
      FROM subjects s
      WHERE s.school_id = $1
    `;
    
    const params = [schoolId];
    
    if (allowedPhases.length > 0) {
      const placeholders = allowedPhases.map((_, i) => `$${i + 2}`).join(',');
      query += ` AND s.phase IN (${placeholders})`;
      params.push(...allowedPhases);
    }
    
    query += ` ORDER BY s.phase, s.name`;
    
    console.log('Query:', query);
    console.log('Params:', params);
    
    const result = await db.query(query, params);
    console.log(`\n✅ Found ${result.rows.length} subjects`);
    
    // Group by phase
    const byPhase = {};
    result.rows.forEach(s => {
      if (!byPhase[s.phase]) byPhase[s.phase] = [];
      byPhase[s.phase].push(s.name);
    });
    
    Object.entries(byPhase).forEach(([phase, subjects]) => {
      console.log(`${phase}: ${subjects.length} subjects`);
    });
    
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
}

test();
