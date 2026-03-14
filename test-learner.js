const db = require('./src/config/database');
const http = require('http');

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } 
        catch(e) { resolve({ error: 'Invalid JSON', raw: data }); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

async function test() {
  // Find learner with data
  const learnerRes = await db.query(`
    SELECT u.id, u.email, u.first_name, COUNT(s.id) as submissions
    FROM users u
    LEFT JOIN assignment_submissions s ON u.id = s.learner_id
    WHERE u.role = 'learner'
    GROUP BY u.id, u.email, u.first_name
    ORDER BY submissions DESC
  `);
  
  console.log('Learners with submissions:');
  learnerRes.rows.forEach(l => console.log('  -', l.email, '| Submissions:', l.submissions));
  
  const learner = learnerRes.rows.find(l => l.submissions > 0) || learnerRes.rows[0];
  console.log('\nTesting with:', learner.email);
  
  // Try login with common passwords
  const passwords = ['password123', 'password', '123456', 'learner123'];
  
  for (const pwd of passwords) {
    const loginRes = await request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login',
      method: 'POST', headers: { 'Content-Type': 'application/json' }
    }, { email: learner.email, password: pwd });
    
    if (loginRes.success) {
      console.log('✅ Login successful with password:', pwd);
      
      const progressRes = await request({
        hostname: 'localhost', port: 5000, path: '/api/progress/my-progress',
        method: 'GET', headers: { 'Authorization': 'Bearer ' + loginRes.token }
      });
      
      console.log('\nProgress API:', progressRes.success ? '✅' : '❌');
      if (progressRes.success) {
        console.log('  Subjects:', progressRes.data.subjects.length);
        console.log('  Overall:', progressRes.data.overall.overallGrade, progressRes.data.overall.overallPercentage + '%');
        progressRes.data.subjects.forEach(s => {
          console.log('  -', s.subjectName, s.letterGrade, s.overallPercentage + '%');
        });
      }
      break;
    }
  }
  
  process.exit(0);
}

test().catch(console.error);
