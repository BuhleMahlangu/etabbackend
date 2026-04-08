const db = require('./src/config/database');
const { v4: uuidv4 } = require('uuid');

// All FET subjects
const fetSubjects = [
  { code: 'ENG-FET', name: 'English Home Language', department: 'Languages', compulsory: true },
  { code: 'ZUL-FET', name: 'isiZulu First Additional Language', department: 'Languages', compulsory: true },
  { code: 'LO-FET', name: 'Life Orientation', department: 'Life Orientation', compulsory: true },
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
  { code: 'MATH-FET', name: 'Mathematics', department: 'Mathematics' },
  { code: 'MATH-LIT', name: 'Mathematical Literacy', department: 'Mathematics' },
  { code: 'MECH-TECH', name: 'Mechanical Technology', department: 'Technology' },
  { code: 'MUSIC', name: 'Music', department: 'Arts' },
  { code: 'PHY-SCI', name: 'Physical Sciences', department: 'Science' },
  { code: 'REL-STUD', name: 'Religion Studies', department: 'Humanities' },
  { code: 'TOUR', name: 'Tourism', department: 'Services' },
  { code: 'VIS-ARTS', name: 'Visual Arts', department: 'Arts' }
];

async function addSubjects() {
  try {
    // Get all schools
    const schoolsResult = await db.query('SELECT id, code, name FROM schools');
    
    for (const school of schoolsResult.rows) {
      console.log(`\n📚 Adding FET subjects for ${school.code}...`);
      
      // Get existing FET subject codes for this school
      const existingResult = await db.query(
        `SELECT code FROM subjects WHERE school_id = $1 AND phase = 'FET'`,
        [school.id]
      );
      const existingCodes = new Set(existingResult.rows.map(s => s.code));
      
      let added = 0;
      
      for (const subject of fetSubjects) {
        const fullCode = `${school.code}-${subject.code}`;
        
        if (existingCodes.has(fullCode)) {
          continue; // Skip if already exists
        }
        
        // Add subject
        await db.query(
          `INSERT INTO subjects (id, code, name, phase, department, credits, school_id, school_code, applicable_grades, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)`,
          [
            uuidv4(),
            fullCode,
            subject.name,
            'FET',
            subject.department,
            10,
            school.id,
            school.code,
            ['Grade 10', 'Grade 11', 'Grade 12']
          ]
        );
        
        added++;
        console.log(`  ✅ Added: ${subject.name}`);
      }
      
      if (added === 0) {
        console.log('  ℹ️ All subjects already exist');
      } else {
        console.log(`  📊 Added ${added} new subjects`);
      }
    }
    
    console.log('\n✅ Done!');
    
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
  process.exit(0);
}

addSubjects();
