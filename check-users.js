const db = require('./src/config/database');

async function checkUsers() {
  const res = await db.query("SELECT id, email, role, first_name FROM users WHERE role = 'learner'");
  console.log('Learners:');
  res.rows.forEach(u => console.log('  -', u.email, '|', u.first_name));
  process.exit(0);
}
checkUsers();
