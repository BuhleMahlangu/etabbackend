const db = require('./src/config/database');

// List of all official FET subjects
const officialFETSubjects = [
  // Compulsory
  { code: 'HL-FET', name: 'Home Language', department: 'Languages', compulsory: true },
  { code: 'FAL-FET', name: 'First Additional Language', department: 'Languages', compulsory: true },
  { code: 'LO-FET', name: 'Life Orientation', department: 'Life Orientation', compulsory: true },
  
  // Optional
  { code: 'ACC', name: 'Accounting', department: 'Business' },
  { code: 'AGR-SCI', name: 'Agricultural Sciences', department: 'Science' },
  { code: 'AGR-TECH', name: 'Agricultural Technology', department: 'Technology' },
  { code: 'BUS', name: 'Business Studies', department: 'Business' },
  { code: 'CAT', name: 'Computer Applications Technology', department: 'Technology' },
  { code: 'CIV-TECH', name: 'Civil Technology', department: 'Technology' },
  { code: 'CON-STUD', name: 'Consumer Studies', department: 'Services' },
  { code: 'DANCE', name: 'Dance Studies', department: 'Arts' },
  { code: 'DESIGN', name: 'Design', department: 'Arts' },
  { code: 'DRAMA', name: 'Dramatic Arts', department: 'Arts' },
  { code: 'ECON', name: 'Economics', department: 'Business' },
  { code: 'EGD', name: 'Engineering Graphics and Design', department: 'Technology' },
  { code: 'ELEC-TECH', name: 'Electrical Technology', department: 'Technology' },
  { code: 'GEO', name: 'Geography', department: 'Humanities' },
  { code: 'HIST', name: 'History', department: 'Humanities' },
  { code: 'HOSP', name: 'Hospitality Studies', department: 'Services' },
  { code: 'INFO-TECH', name: 'Information Technology', department: 'Technology' },
  { code: 'LIFE-SCI', name: 'Life Sciences', department: 'Science' },
  { code: 'MATH', name: 'Mathematics', department: 'Mathematics' },
  { code: 'MATH-LIT', name: 'Mathematical Literacy', department: 'Mathematics' },
  { code: 'MECH-TECH', name: 'Mechanical Technology', department: 'Technology' },
  { code: 'MUSIC', name: 'Music', department: 'Arts' },
  { code: 'PHY-SCI', name: 'Physical Sciences', department: 'Science' },
  { code: 'REL-STUD', name: 'Religion Studies', department: 'Humanities' },
  { code: 'TOUR', name: 'Tourism', department: 'Services' },
  { code: 'VIS-ARTS', name: 'Visual Arts', department: 'Arts' }
];

async function check() {
  try {
    // Get all schools
    const schoolsResult = await db.query('SELECT id, code, name FROM schools');
    
    for (const school of schoolsResult.rows) {
      console.log(`\n${school.code}: ${school.name}`);
      console.log('='.repeat(50));
      
      // Get existing FET subjects for this school
      const existingResult = await db.query(
        `SELECT code, name FROM subjects 
         WHERE school_id = $1 AND phase = 'FET'`,
        [school.id]
      );
      
      const existingCodes = new Set(existingResult.rows.map(s => s.code.replace(`${school.code}-`, '')));
      
      // Find missing subjects
      const missing = officialFETSubjects.filter(s => !existingCodes.has(s.code));
      
      if (missing.length === 0) {
        console.log('✅ All FET subjects present');
      } else {
        console.log(`❌ Missing ${missing.length} subjects:`);
        missing.forEach(s => {
          console.log(`   - ${s.code}: ${s.name}`);
        });
      }
    }
    
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
}

check();
