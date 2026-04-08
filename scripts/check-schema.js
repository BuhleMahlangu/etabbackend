#!/usr/bin/env node
const db = require('../src/config/database');

async function checkSchema() {
  const result = await db.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'modules'
    ORDER BY ordinal_position
  `);
  
  console.log('Modules table columns:');
  result.rows.forEach(col => {
    console.log('  - ' + col.column_name + ' (' + col.data_type + ')');
  });
  
  await db.end();
}

checkSchema().catch(console.error);
