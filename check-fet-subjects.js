const db = require('./src/config/database');

async function check() {
  try {
    const result = await db.query(`
      SELECT s.code, s.name, s.phase, s.applicable_grades,
             COALESCE(
               (SELECT bool_or(gm.is_compulsory) 
                FROM modules m 
                JOIN grade_modules gm ON m.id = gm.module_id 
                WHERE m.code = s.code AND m.school_id = s.school_id),
               false
             ) as is_compulsory,
             COALESCE(
               (SELECT bool_or(NOT gm.is_compulsory) 
                FROM modules m 
                JOIN grade_modules gm ON m.id = gm.module_id 
                WHERE m.code = s.code AND m.school_id = s.school_id),
               false
             ) as is_optional
      FROM subjects s
      WHERE s.school_id = '2dce4350-f837-439e-8047-b023b7ea936a'
      AND s.phase = 'FET'
      ORDER BY s.name
    `);
    
    console.log('FET subjects at SSS:');
    console.log('===================');
    
    const compulsory = result.rows.filter(s => s.is_compulsory);
    const optional = result.rows.filter(s => s.is_optional && !s.is_compulsory);
    const neither = result.rows.filter(s => !s.is_compulsory && !s.is_optional);
    
    console.log('\n📚 Compulsory:');
    compulsory.forEach(s => {
      console.log(`  ✅ ${s.code}: ${s.name}`);
    });
    
    console.log(`\n📖 Optional (${optional.length}):`);
    optional.forEach(s => {
      console.log(`  ⭕ ${s.code}: ${s.name}`);
    });
    
    if (neither.length > 0) {
      console.log(`\n❓ Not linked to grade_modules (${neither.length}):`);
      neither.forEach(s => {
        console.log(`  ⚠️  ${s.code}: ${s.name}`);
      });
    }
    
    console.log(`\nTotal: ${result.rows.length} FET subjects`);
    console.log(`  - Compulsory: ${compulsory.length}`);
    console.log(`  - Optional: ${optional.length}`);
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

check();
