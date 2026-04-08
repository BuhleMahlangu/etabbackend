const db = require('./src/config/database');

async function check() {
  try {
    // Check support_messages columns
    const columns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'support_messages'
      ORDER BY ordinal_position
    `);
    
    console.log('support_messages columns:');
    columns.rows.forEach(c => {
      console.log(`  ${c.column_name}: ${c.data_type}`);
    });
    
    // Check if the message exists
    const message = await db.query(
      'SELECT * FROM support_messages WHERE id = $1',
      ['25647401-c48e-4c33-9003-5826a6b6d00b']
    );
    
    if (message.rows.length > 0) {
      console.log('\nMessage found:', message.rows[0]);
    } else {
      console.log('\nMessage not found');
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

check();
