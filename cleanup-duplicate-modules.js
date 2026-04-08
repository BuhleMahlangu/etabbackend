const db = require('./src/config/database');

async function cleanup() {
  try {
    console.log('Finding duplicate modules...\n');
    
    // Find modules with similar names for each school
    const schools = await db.query('SELECT id, code FROM schools');
    
    for (const school of schools.rows) {
      console.log(`${school.code}:`);
      
      // Find potential duplicates by matching first part of name
      const modules = await db.query(
        `SELECT id, code, name 
         FROM modules 
         WHERE school_id = $1 
         ORDER BY name, code`,
        [school.id]
      );
      
      // Group by similar names
      const groups = {};
      modules.rows.forEach(m => {
        // Extract base name (e.g., "Dramatic Arts" from "Dramatic Arts module...")
        const baseName = m.name.replace(/ module for.*$/i, '').trim();
        if (!groups[baseName]) groups[baseName] = [];
        groups[baseName].push(m);
      });
      
      // Find duplicates
      let hasDuplicates = false;
      for (const [name, items] of Object.entries(groups)) {
        if (items.length > 1) {
          hasDuplicates = true;
          console.log(`  ⚠️  "${name}" has ${items.length} modules:`);
          items.forEach(i => console.log(`     - ${i.code}: ${i.name}`));
          
          // Keep the first one, delete others
          const keep = items[0];
          const toDelete = items.slice(1);
          
          console.log(`     -> Keeping: ${keep.code}`);
          console.log(`     -> Deleting: ${toDelete.map(d => d.code).join(', ')}`);
          
          // Delete duplicates
          for (const dup of toDelete) {
            try {
              // First delete related records
              await db.query('DELETE FROM teacher_assignments WHERE subject_id = $1', [dup.id]);
              await db.query('DELETE FROM learner_modules WHERE module_id = $1', [dup.id]);
              await db.query('DELETE FROM grade_modules WHERE module_id = $1', [dup.id]);
              // Then delete the module
              await db.query('DELETE FROM modules WHERE id = $1', [dup.id]);
              console.log(`        ✅ Deleted ${dup.code}`);
            } catch (err) {
              console.log(`        ⚠️ Could not delete ${dup.code}: ${err.message}`);
            }
          }
        }
      }
      
      if (!hasDuplicates) {
        console.log('  ✅ No duplicates found');
      }
      console.log('');
    }
    
    console.log('✅ Cleanup complete!');
    
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
}

cleanup();
