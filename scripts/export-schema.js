#!/usr/bin/env node
/**
 * Export complete database schema (tables, columns, types, constraints)
 */

const db = require('../src/config/database');
const fs = require('fs');

async function exportSchema() {
  console.log('🔍 Exporting database schema...\n');
  
  let output = '# E-tab Database Schema\n\n';
  output += `Generated: ${new Date().toISOString()}\n\n`;
  
  // Get all tables
  const tablesQuery = `
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  
  const tables = await db.query(tablesQuery);
  
  console.log(`Found ${tables.rows.length} tables\n`);
  
  for (const table of tables.rows) {
    const tableName = table.table_name;
    output += `## Table: ${tableName}\n\n`;
    
    // Get columns
    const columnsQuery = `
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        numeric_precision,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = $1
      ORDER BY ordinal_position
    `;
    
    const columns = await db.query(columnsQuery, [tableName]);
    
    output += '| Column | Type | Nullable | Default |\n';
    output += '|--------|------|----------|----------|\n';
    
    for (const col of columns.rows) {
      let type = col.data_type;
      if (col.character_maximum_length) {
        type += `(${col.character_maximum_length})`;
      }
      
      output += `| ${col.column_name} | ${type} | ${col.is_nullable} | ${col.column_default || '-'} |\n`;
    }
    
    output += '\n';
    
    // Get primary keys
    const pkQuery = `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public'
      AND tc.table_name = $1
      AND tc.constraint_type = 'PRIMARY KEY'
    `;
    
    const pks = await db.query(pkQuery, [tableName]);
    if (pks.rows.length > 0) {
      output += `**Primary Key:** ${pks.rows.map(r => r.column_name).join(', ')}\n\n`;
    }
    
    // Get foreign keys
    const fkQuery = `
      SELECT
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.table_schema = 'public'
      AND tc.table_name = $1
      AND tc.constraint_type = 'FOREIGN KEY'
    `;
    
    const fks = await db.query(fkQuery, [tableName]);
    if (fks.rows.length > 0) {
      output += `**Foreign Keys:**\n`;
      for (const fk of fks.rows) {
        output += `- ${fk.column_name} → ${fk.foreign_table_name}(${fk.foreign_column_name})\n`;
      }
      output += '\n';
    }
    
    // Get unique constraints
    const uniqueQuery = `
      SELECT tc.constraint_name, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public'
      AND tc.table_name = $1
      AND tc.constraint_type = 'UNIQUE'
    `;
    
    const uniques = await db.query(uniqueQuery, [tableName]);
    if (uniques.rows.length > 0) {
      output += `**Unique Constraints:** ${uniques.rows.map(r => r.column_name).join(', ')}\n\n`;
    }
    
    output += '---\n\n';
  }
  
  // Get indexes
  output += '## Indexes\n\n';
  const indexesQuery = `
    SELECT
      tablename,
      indexname,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `;
  
  const indexes = await db.query(indexesQuery);
  output += '| Table | Index | Definition |\n';
  output += '|-------|-------|------------|\n';
  
  for (const idx of indexes.rows) {
    output += `| ${idx.tablename} | ${idx.indexname} | ${idx.indexdef.substring(0, 100)}... |\n`;
  }
  
  // Save to file
  fs.writeFileSync('DATABASE_SCHEMA.md', output);
  console.log('✅ Schema exported to DATABASE_SCHEMA.md');
  
  // Also print summary
  console.log('\n📊 Summary:');
  console.log(`Tables: ${tables.rows.length}`);
  console.log(`Indexes: ${indexes.rows.length}`);
  
  await db.end();
  process.exit(0);
}

exportSchema().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
