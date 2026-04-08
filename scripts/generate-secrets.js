const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 Generating secure secrets for production...\n');

// Generate various secrets
const secrets = {
  jwtSecret: crypto.randomBytes(64).toString('hex'),
  jwtRefreshSecret: crypto.randomBytes(64).toString('hex'),
  sessionSecret: crypto.randomBytes(32).toString('hex'),
  csrfSecret: crypto.randomBytes(32).toString('hex'),
  apiKeySalt: crypto.randomBytes(16).toString('hex'),
};

console.log('✅ Generated Secrets:');
console.log('=====================\n');

console.log('# JWT Secret (for auth tokens):');
console.log(secrets.jwtSecret);
console.log('\n# JWT Refresh Secret:');
console.log(secrets.jwtRefreshSecret);
console.log('\n# Session Secret:');
console.log(secrets.sessionSecret);
console.log('\n# CSRF Secret:');
console.log(secrets.csrfSecret);
console.log('\n# API Key Salt:');
console.log(secrets.apiKeySalt);

console.log('\n\n📝 Instructions:');
console.log('================');
console.log('1. Copy .env.example to .env');
console.log('2. Replace JWT_SECRET with the value above');
console.log('3. Set your actual database, Cloudinary, and SendGrid credentials');
console.log('4. NEVER commit .env to git!\n');

// Save to file
const secretsPath = path.join(__dirname, '..', '.secrets-generated.txt');
const content = `
E-tab Production Secrets - Generated on ${new Date().toISOString()}
========================================================================

JWT_SECRET=${secrets.jwtSecret}
JWT_REFRESH_SECRET=${secrets.jwtRefreshSecret}
SESSION_SECRET=${secrets.sessionSecret}
CSRF_SECRET=${secrets.csrfSecret}
API_KEY_SALT=${secrets.apiKeySalt}

⚠️  KEEP THIS FILE SECURE - DO NOT COMMIT TO GIT
`;

fs.writeFileSync(secretsPath, content);
console.log(`💾 Secrets also saved to: ${secretsPath}`);
console.log('🗑️  Delete this file after setting up your .env!\n');
