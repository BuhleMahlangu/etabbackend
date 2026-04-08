#!/usr/bin/env node

/**
 * Pre-deployment Checklist Script
 * Run this before deploying to production
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

let issues = [];
let warnings = [];

console.log('🔍 E-tab Pre-Deployment Checklist\n');
console.log('=' .repeat(50) + '\n');

// Check 1: .env exists and .env.example is used
console.log('1️⃣  Checking environment files...');
const envExists = fs.existsSync(path.join(__dirname, '..', '.env'));
const envExampleExists = fs.existsSync(path.join(__dirname, '..', '.env.example'));

if (!envExists) {
  issues.push('❌ .env file not found! Copy from .env.example');
} else {
  console.log(`${GREEN}✓${RESET} .env file exists`);
}

if (!envExampleExists) {
  warnings.push('⚠️  .env.example not found');
}

// Check 2: .env is in .gitignore
console.log('\n2️⃣  Checking .gitignore...');
const gitignorePath = path.join(__dirname, '..', '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignore = fs.readFileSync(gitignorePath, 'utf8');
  if (gitignore.includes('.env')) {
    console.log(`${GREEN}✓${RESET} .env is in .gitignore`);
  } else {
    issues.push('❌ .env is NOT in .gitignore! Add it immediately!');
  }
} else {
  issues.push('❌ .gitignore not found!');
}

// Check 3: JWT_SECRET strength
console.log('\n3️⃣  Checking JWT_SECRET...');
if (envExists) {
  const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const jwtMatch = env.match(/JWT_SECRET=(.+)/);
  
  if (!jwtMatch) {
    issues.push('❌ JWT_SECRET not found in .env');
  } else {
    const jwtSecret = jwtMatch[1].trim();
    if (jwtSecret.length < 32) {
      issues.push('❌ JWT_SECRET is too short (min 32 chars, recommend 64+)');
    } else if (jwtSecret === 'etab_super_secret_key_change_in_production_2024' ||
               jwtSecret === 'dev_secret_not_for_production' ||
               jwtSecret === 'GENERATE_A_128_CHARACTER_HEX_STRING_HERE') {
      issues.push('❌ JWT_SECRET is using default/placeholder value!');
    } else {
      console.log(`${GREEN}✓${RESET} JWT_SECRET looks secure (${jwtSecret.length} chars)`);
    }
  }
  
  // Check 4: NODE_ENV
  console.log('\n4️⃣  Checking NODE_ENV...');
  if (env.includes('NODE_ENV=production')) {
    console.log(`${GREEN}✓${RESET} NODE_ENV is set to production`);
  } else {
    warnings.push('⚠️  NODE_ENV is not set to production');
  }
  
  // Check 5: Email service
  console.log('\n5️⃣  Checking email configuration...');
  if (env.includes('EMAIL_SERVICE=sendgrid')) {
    if (env.includes('SENDGRID_API_KEY=SG.') || env.includes('SENDGRID_API_KEY=your_')) {
      issues.push('❌ SendGrid API key looks like placeholder');
    } else {
      console.log(`${GREEN}✓${RESET} SendGrid configured`);
    }
  } else if (env.includes('EMAIL_SERVICE=ethereal')) {
    warnings.push('⚠️  Using Ethereal (dev only) - emails will be simulated');
  }
  
  // Check 6: Database URL
  console.log('\n6️⃣  Checking database configuration...');
  if (env.includes('localhost') && env.includes('NODE_ENV=production')) {
    warnings.push('⚠️  Database may be pointing to localhost in production');
  } else {
    console.log(`${GREEN}✓${RESET} Database configured`);
  }
  
  // Check 7: CORS
  console.log('\n7️⃣  Checking CORS configuration...');
  if (env.includes('CORS_ORIGIN=*') || env.includes('localhost')) {
    issues.push('❌ CORS_ORIGIN is too permissive or using localhost');
  } else {
    console.log(`${GREEN}✓${RESET} CORS configured for production`);
  }
  
  // Check 8: Cloudinary
  console.log('\n8️⃣  Checking Cloudinary...');
  if (env.includes('CLOUDINARY_API_SECRET=9pTz') || env.includes('your_')) {
    warnings.push('⚠️  Cloudinary credentials may be default/placeholder');
  } else {
    console.log(`${GREEN}✓${RESET} Cloudinary configured`);
  }
}

// Check 9: No console.log in production (basic check)
console.log('\n9️⃣  Checking for debug console statements...');
const serverPath = path.join(__dirname, '..', 'src', 'server.js');
if (fs.existsSync(serverPath)) {
  const serverCode = fs.readFileSync(serverPath, 'utf8');
  const consoleCount = (serverCode.match(/console\.log/g) || []).length;
  if (consoleCount > 10) {
    warnings.push(`⚠️  Found ${consoleCount} console.log statements (consider removing for production)`);
  } else {
    console.log(`${GREEN}✓${RESET} Console statements look reasonable`);
  }
}

// Print Summary
console.log('\n' + '='.repeat(50));
console.log('📊 SUMMARY\n');

if (issues.length === 0 && warnings.length === 0) {
  console.log(`${GREEN}🎉 All checks passed! Ready for deployment!${RESET}\n`);
  process.exit(0);
} else {
  if (issues.length > 0) {
    console.log(`${RED}❌ CRITICAL ISSUES (Must fix before deploy):${RESET}\n`);
    issues.forEach(issue => console.log(issue));
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log(`${YELLOW}⚠️  WARNINGS (Recommend fixing):${RESET}\n`);
    warnings.forEach(warning => console.log(warning));
    console.log('');
  }
  
  if (issues.length > 0) {
    console.log(`${RED}❌ Deployment BLOCKED - fix critical issues first${RESET}\n`);
    process.exit(1);
  } else {
    console.log(`${YELLOW}⚠️  Deployment possible but warnings should be addressed${RESET}\n`);
    process.exit(0);
  }
}
