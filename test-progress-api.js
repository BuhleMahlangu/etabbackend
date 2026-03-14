const http = require('http');

function request(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

async function testProgress() {
  try {
    // Login
    const loginRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'thabo@gmail.com', password: 'password123' });
    
    if (!loginRes.success) {
      console.log('❌ Login failed:', loginRes.message);
      return;
    }
    
    const token = loginRes.token;
    console.log('✅ Logged in as:', loginRes.user.email);
    console.log('   User ID:', loginRes.user.id);
    
    // Get progress
    const progressRes = await request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/progress/my-progress',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    
    if (!progressRes.success) {
      console.log('❌ Progress fetch failed:', progressRes.message);
      return;
    }
    
    console.log('\n📊 Progress Data:');
    console.log('\nOverall Stats:');
    console.log('  - Total Subjects:', progressRes.data.overall.totalSubjects);
    console.log('  - Overall Grade:', progressRes.data.overall.overallGrade);
    console.log('  - Overall %:', progressRes.data.overall.overallPercentage);
    console.log('  - Total Assignments:', progressRes.data.overall.totalAssignments);
    console.log('  - Graded Assignments:', progressRes.data.overall.gradedAssignments);
    console.log('  - Assignment Avg:', progressRes.data.overall.assignmentAverage + '%');
    
    console.log('\nSubjects:', progressRes.data.subjects.length);
    progressRes.data.subjects.forEach(s => {
      console.log('\n  📚', s.subjectName, '(' + s.subjectCode + ')');
      console.log('     Grade:', s.letterGrade, '| Overall:', s.overallPercentage + '%');
      console.log('     Assignments:', s.assignments.submitted + '/' + s.assignments.total, 
                  '| Marks:', s.assignments.marksObtained + '/' + s.assignments.maxMarks,
                  '| ' + s.assignments.percentage + '%');
      console.log('     Quizzes:', s.quizzes.completed + '/' + s.quizzes.total,
                  '| Avg:', s.quizzes.averagePercentage + '%');
    });
    
    console.log('\n✅ API is working!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
  process.exit(0);
}

testProgress();
